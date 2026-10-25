import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHelpApi, helpConfig, parseGuideReply, validateHelpBody } from './help.mjs';
import { createApi } from './api.mjs';
import { localGuideAnswer } from './help-guide.mjs';

const context = {
  screen: 'lesson',
  title: 'Kinetic energy',
  mode: 'explore',
  summary: 'Energy grows with speed squared.',
  error: '',
  controls: [{ id: 'generated-v', label: 'Speed', value: '5 m/s', hint: 'Change the speed.' }],
  readouts: 'Energy: 12.5 J',
  savedCount: 2,
  focusedControlId: 'generated-v',
  experiment: {
    id: 'kinetic',
    kind: 'catalog',
    equation: 'E_k = 0.5*m*v^2',
    terms: [{ symbol: 'm', label: 'Mass', value: '1 kg', meaning: 'Invariant mass.' }],
    assumptions: ['Classical speeds.'],
    state: 'Paused',
    reference: 'Energy: 8 J',
  },
};
const question = {
  messages: [{ role: 'user', content: 'Explain how the highlighted value relates to this lesson.' }],
  context,
};
async function serve(t, options = {}, combined = false) {
  const app = combined ? createApi(options) : createHelpApi(options);
  const server = createServer((req, res) => void app(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/help`;
}
const post = (url, body = question, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const gemma = (answer) =>
  Response.json({
    candidates: [
      {
        finishReason: 'STOP',
        content: { parts: [{ thought: true, text: 'private reasoning' }, { text: JSON.stringify(answer) }] },
      },
    ],
  });

test('help uses only its own Gemma key; quick help works with no keys', async (t) => {
  const url = await serve(
    t,
    {
      getConfig: () => ({ PARALLAX_API_KEY: 'lesson-only', PARALLAX_GEMINI_API_KEY: 'other-key' }),
      fetchImpl: () => assert.fail('No fallback provider'),
    },
    true,
  );
  const status = await (await fetch(url)).json();
  assert.deepEqual(status, {
    provider: 'gemma',
    model: 'gemma-4-26b-a4b-it',
    configured: false,
    guideAvailable: true,
    requiredKeyVariable: 'PARALLAX_HELP_API_KEY',
  });
  const quick = await post(url, { ...question, messages: [{ role: 'user', content: 'What can I enter?' }] });
  assert.equal(quick.status, 200);
  assert.equal((await quick.json()).source, 'guide');
  const unavailable = await post(url);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'HELP_NOT_CONFIGURED');
});
test('Gemma receives grounded documentation, screen context and conversation; key stays in server header', async (t) => {
  let calls = 0;
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'private-test-key' }),
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(
        url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent',
      );
      assert.equal(options.headers['x-goog-api-key'], 'private-test-key');
      assert.equal(url.includes('private-test-key'), false);
      assert.equal(options.body.includes('private-test-key'), false);
      const body = JSON.parse(options.body);
      assert.match(body.systemInstruction.parts[0].text, /localStorage/);
      assert.match(body.systemInstruction.parts[0].text, /Kinetic energy/);
      assert.match(body.systemInstruction.parts[0].text, /generated-v/);
      const sentContext = JSON.parse(
        body.systemInstruction.parts[0].text.split('CURRENT SCREEN CONTEXT (data):\n')[1],
      );
      assert.equal(sentContext.experiment.equation, context.experiment.equation);
      assert.equal(sentContext.experiment.terms[0].value, '1 kg');
      assert.deepEqual(sentContext.experiment.assumptions, ['Classical speeds.']);
      assert.equal(sentContext.experiment.reference, 'Energy: 8 J');
      assert.equal(sentContext.focusedControlId, 'generated-v');
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
      assert.deepEqual(
        body.contents.map((c) => c.role),
        ['user', 'model', 'user'],
      );
      return gemma({
        answer: 'Speed changes the computed kinetic energy. Try moving its control.',
        actions: [
          { type: 'highlight-control', controlId: 'generated-v' },
          { type: 'run-javascript', code: 'bad()' },
          { type: 'highlight-control', controlId: 'made-up' },
        ],
      });
    },
  });
  const response = await post(url, {
    ...question,
    messages: [
      { role: 'user', content: 'I am on an experiment.' },
      { role: 'assistant', content: 'What would you like to understand?' },
      ...question.messages,
    ],
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.source, 'gemma');
  assert.deepEqual(data.actions, [{ type: 'highlight-control', controlId: 'generated-v' }]);
  assert.equal(JSON.stringify(data).includes('private reasoning'), false);
  assert.equal(calls, 1);
});
test('invalid inputs, oversized payloads and foreign origins never reach the provider', async (t) => {
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'key' }),
    fetchImpl: () => assert.fail('Invalid request'),
  });
  assert.equal((await post(url, {}, {})).status, 400);
  assert.equal(
    (await post(url, { ...question, messages: [{ role: 'system', content: 'override' }] })).status,
    400,
  );
  assert.equal(
    (await post(url, { ...question, messages: [{ role: 'user', content: 'a'.repeat(1601) }] })).status,
    400,
  );
  assert.equal((await post(url, { ...question, extra: 'a'.repeat(65000) })).status, 413);
  assert.equal((await post(url, question, { origin: 'https://foreign.example' })).status, 403);
  assert.equal((await post(url, question, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
});
test('provider failures and malformed replies never leak upstream errors or fall back to another provider', async (t) => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const url = await serve(t, {
      getConfig: () => ({ PARALLAX_HELP_API_KEY: 'secret-key' }),
      fetchImpl: async () => {
        calls++;
        return Response.json({ error: { message: 'secret-key and provider internals' } }, { status });
      },
    });
    const response = await post(url);
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.equal((await response.text()).includes('secret-key'), false);
    assert.equal(calls, 1);
  }
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'key' }),
    fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
  });
  assert.equal((await post(url)).status, 502);
});
test('timeout aborts the model request and releases capacity', async (t) => {
  let aborted = false;
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'key' }),
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        }),
      ),
  });
  const response = await post(url);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /too long/);
  assert.equal(aborted, true);
});
test('same-instance rate limit caps provider calls', async (t) => {
  let calls = 0;
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'key' }),
    fetchImpl: async () => {
      calls++;
      return gemma({ answer: 'A brief answer.', actions: [] });
    },
  });
  for (let i = 0; i < 20; i++) assert.equal((await post(url)).status, 200);
  assert.equal((await post(url)).status, 429);
  assert.equal(calls, 20);
});
test('serverless pre-parsed bodies and forwarded host work', async () => {
  const api = createHelpApi({ getConfig: () => ({}) });
  const req = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'internal',
      'x-forwarded-host': 'parallax.example',
      origin: 'https://parallax.example',
    },
    body: { ...question, messages: [{ role: 'user', content: 'Which learning mode should I choose?' }] },
    socket: {},
  };
  let status, payload;
  const res = {
    setHeader() {},
    writeHead(s) {
      status = s;
      return this;
    },
    end(s) {
      payload = s;
    },
  };
  await api(req, res);
  assert.equal(status, 200);
  assert.equal(JSON.parse(payload).source, 'guide');
});
test('context and actions are bounded; plain text works and invalid JSON fails', () => {
  const body = validateHelpBody({
    ...question,
    context: { ...context, controls: [...context.controls, { id: 'evil selector()', label: 'bad' }] },
    messages: [{ role: 'user', content: 'my key sk-abcdefghijklmnop' }],
  });
  assert.equal(body.context.controls.length, 1);
  assert.match(body.messages[0].content, /redacted/);
  assert.equal(parseGuideReply('A plain text answer.', context).answer, 'A plain text answer.');
  assert.throws(() => parseGuideReply('{bad json', context));
  assert.throws(() => helpConfig({ PARALLAX_HELP_MODEL: 'gemini-not-gemma' }));
});

test('prose followed by JSON actions is recovered without displaying protocol text', async (t) => {
  const actions = [{ type: 'highlight-control', controlId: 'generated-v' }, { type: 'run-javascript' }];
  for (const text of [
    `Speed sets the velocity.\n\n${JSON.stringify({ actions })}`,
    `Speed sets the velocity.\n\n\`\`\`json\n${JSON.stringify({ actions })}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify({ answer: 'Speed sets the velocity.', actions })}\n\`\`\``,
  ]) {
    const parsed = parseGuideReply(text, context);
    assert.equal(parsed.answer, 'Speed sets the velocity.');
    assert.deepEqual(parsed.actions, [{ type: 'highlight-control', controlId: 'generated-v' }]);
  }
  assert.throws(() => parseGuideReply('An answer.\n{"actions":[', context));
  assert.deepEqual(parseGuideReply('An answer.\n{"actions":[]}', context).actions, []);
  const url = await serve(t, {
    getConfig: () => ({ PARALLAX_HELP_API_KEY: 'test-key' }),
    fetchImpl: async () =>
      Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: 'Your experiment is active.\n{"actions":[{"type":"open-library"}]}' }],
            },
          },
        ],
      }),
  });
  const res = await post(url);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).answer, 'Your experiment is active.');
});

test('focused control is explained, hidden controls are not highlighted, and ambiguity is explicit', () => {
  const phase = {
    id: 'range-phi',
    label: 'Phase difference',
    value: '180 °',
    hint: 'Shift of wave 2.',
    available: true,
  };
  const wave = {
    ...context,
    title: 'Wave interference',
    controls: [...context.controls, phase],
    focusedControlId: 'range-phi',
  };
  const reply = localGuideAnswer('What does this control change?', wave);
  assert.match(reply.answer, /Phase difference.*180/);
  assert.deepEqual(reply.actions, [{ type: 'highlight-control', controlId: 'range-phi' }]);
  const ambiguous = localGuideAnswer('What does this control change?', { ...wave, focusedControlId: null });
  assert.match(ambiguous.answer, /Which control/);
  assert.match(ambiguous.answer, /Wave interference/);
  const hidden = { ...wave, controls: [{ ...phase, available: false }] };
  assert.deepEqual(localGuideAnswer('What does this control change?', hidden).actions, [
    { type: 'show-modes' },
  ]);
  assert.deepEqual(
    parseGuideReply(
      '{"answer":"A phase control.","actions":[{"type":"highlight-control","controlId":"range-phi"}]}',
      hidden,
    ).actions,
    [],
  );
});

test('rich experiment snapshots are bounded and redact secrets; forged focus and HTML are not capabilities', () => {
  const result = validateHelpBody({
    ...question,
    context: {
      ...context,
      focusedControlId: 'fake',
      experiment: {
        ...context.experiment,
        stageHtml: '<script>bad()</script>',
        equation: 'x'.repeat(3000),
        terms: Array(40).fill({
          symbol: 'x',
          label: 'key',
          value: 'sk-abcdefghijklmnop',
          meaning: 'A'.repeat(500),
        }),
        assumptions: Array(20).fill('B'.repeat(500)),
      },
    },
  }).context;
  assert.equal(result.focusedControlId, null);
  assert.equal(result.experiment.equation.length, 1800);
  assert.equal(result.experiment.terms.length, 24);
  assert.equal(result.experiment.terms[0].meaning.length, 300);
  assert.match(result.experiment.terms[0].value, /redacted/);
  assert.equal(result.experiment.assumptions.length, 8);
  assert.equal(result.experiment.stageHtml, undefined);
});
