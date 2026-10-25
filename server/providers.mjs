import { lessonSchema, validateLesson } from './lesson.mjs';

export function providerConfig(config) {
  const name = String(config.PARALLAX_PROVIDER ?? '').trim().toLowerCase() || 'openai';
  if (!['gemini', 'openai'].includes(name)) throw new Error('Set PARALLAX_PROVIDER to gemini or openai.');
  if (name === 'gemini') {
    const model = String(config.PARALLAX_GEMINI_MODEL ?? '').trim() || 'gemini-3.1-flash-lite';
    if (!['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].includes(model)) throw new Error('Choose a supported Gemini Flash model, such as gemini-3.8-flash or gemini-3.1-flash-lite, for the free-tier integration.');
    return { name, model, key: config.PARALLAX_GEMINI_API_KEY?.trim(), missing: 'This deployment explicitly selects Gemini, but PARALLAX_GEMINI_API_KEY is missing. To use OpenAI, set PARALLAX_PROVIDER=openai and PARALLAX_API_KEY in the deployment environment, then redeploy. Gemini is only used when explicitly selected.' };
  }
  return { name, model: String(config.PARALLAX_MODEL ?? '').trim() || 'gpt-5.6-sol', key: config.PARALLAX_API_KEY?.trim(), missing: 'OpenAI is selected, but PARALLAX_API_KEY is missing in this deployment. Add this server-only secret to the Vercel project’s Production and Preview environment variables, then redeploy. Do not prefix the key name with VITE_.' };
}

export function providerStatus(config, provider) {
  return {
    provider: provider.name,
    model: provider.model,
    configured: Boolean(provider.key),
    providerSource: String(config.PARALLAX_PROVIDER ?? '').trim() ? 'environment' : 'default',
    requiredKeyVariable: provider.name === 'openai' ? 'PARALLAX_API_KEY' : 'PARALLAX_GEMINI_API_KEY',
    lessonSchemaVersion: 2,
    deployment: {environment: config.VERCEL_ENV || 'local', commit: config.VERCEL_GIT_COMMIT_SHA || null},
  };
}

export function generationRequest(provider, instructions, request, signal) {
  const input = JSON.stringify({ prompt: request.prompt.trim(), learningMode: request.mode });
  if (provider.name === 'gemini') return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`,
    options: {
      method: 'POST', signal,
      headers: { 'x-goog-api-key': provider.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: lessonSchema, maxOutputTokens: 8000, thinkingConfig: provider.model.startsWith('gemini-2.5-') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' } } }),
    },
  };
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    options: { method: 'POST', signal,
      headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }], max_completion_tokens: 10000,
        response_format: { type: 'json_schema', json_schema: { name: 'equation_lesson', strict: true, schema: lessonSchema } } }),
    },
  };
}

export function readLesson(provider, result) {
  if (provider.name === 'gemini') {
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete or blocked Gemini response');
    const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
    return validateLesson(JSON.parse(text), true);
  }
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal) throw new Error('Incomplete response');
  return validateLesson(JSON.parse(choice.message?.content), true);
}

export function providerFailure(provider, status, failure) {
  if (provider.name === 'gemini') {
    if (status === 429) return 'Gemini’s free-tier quota is exhausted or temporarily rate-limited. Try again after the quota resets. No paid provider was called.';
    if (status === 401 || status === 403 || failure?.error?.details?.some(detail => detail.reason === 'API_KEY_INVALID')) return 'Gemini rejected access. Check PARALLAX_GEMINI_API_KEY and Gemini API availability for your project and region in Google AI Studio.';
    if (status === 404) return 'The selected Gemini model is unavailable for this project. Check model access in Google AI Studio.';
    return 'Gemini could not generate a lesson. Check model access and try again. No paid fallback was called.';
  }
  const quota = status === 429 && ['insufficient_quota', 'credit_balance_exhausted'].includes(failure?.error?.code);
  return quota ? 'The AI account has no API credits remaining. Add credits or check billing in the OpenAI account linked to this environment, then try again.'
    : status === 429 ? 'The AI service is busy. Please try again shortly.'
    : status === 401 ? 'OpenAI rejected authentication. Check PARALLAX_API_KEY in this deployment’s environment variables and redeploy after updating it.'
    : status === 404 || failure?.error?.code === 'model_not_found' ? 'OpenAI could not access the configured PARALLAX_MODEL. Check the model ID and API access for the project that owns PARALLAX_API_KEY.'
    : status === 400 && failure?.error?.param === 'response_format' ? 'The configured OpenAI model rejected structured lesson output. Choose an API model that supports Chat Completions with JSON schema structured outputs.'
    : 'The AI service could not generate a lesson. Check model access and try again.';
}
