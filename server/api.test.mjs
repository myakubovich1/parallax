import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApi } from './api.mjs';
import { validateLesson } from './lesson.mjs';
import { spring as experiment } from '../verify/fixtures/experiments.mjs';

const lesson = { title: 'Hooke’s law', equation: 'F = -kx', explanation: ['Force is proportional to displacement.'],
  stageHtml: '<p id="force"></p><script>addEventListener("message",e=>{if(e.data.type==="params")document.querySelector("#force").textContent=-2*e.data.params.x})</script>',
  params: [{ id: 'x', label: 'Displacement', symbol: 'x', unit: 'm', min: -2, max: 2, step: 0.1, default: 1, digits: 1, hint: 'Move the spring.' }],
  assumptions: ['Ideal spring, k = 2 N/m.'] };

async function serve(t, options) {
  const api = createApi(options);
  const server = createServer((req, res) => void api(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (base, body, headers = {}) => fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const request = { prompt: 'F = -kx', mode: 'explore' };

test('missing key is reported without contacting provider', async t => {
  const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'openai' }), fetchImpl: () => assert.fail('Provider must not be called') });
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.provider, 'openai');
  assert.equal(status.configured, false);
  assert.equal(status.requiredKeyVariable, 'PARALLAX_API_KEY');
  assert.equal((await post(base, request)).status, 503);
});

test('generated equations use server authentication and return only validated lesson data', async t => {
  const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder' }), fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-only-placeholder');
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(JSON.parse(body.messages[1].content), { prompt: request.prompt, learningMode: request.mode });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(experiment) } }] });
  } });
  const response = await post(base, request);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(text.includes('test-only-placeholder'), false);
  assert.deepEqual(JSON.parse(text), { lesson: experiment });
});

test('bad requests and cross-origin calls are rejected before provider access', async t => {
  const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder' }), fetchImpl: () => assert.fail('Provider must not be called') });
  assert.equal((await post(base, { ...request, prompt: '' })).status, 400);
  assert.equal((await post(base, { ...request, prompt: 'x'.repeat(4001) })).status, 400);
  assert.equal((await post(base, { ...request, mode: 'unknown' })).status, 400);
  assert.equal((await post(base, request, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await post(base, request, { 'Content-Type': 'text/plain' })).status, 415);
});

test('provider errors and invalid content never expose upstream details', async t => {
  for (const upstream of [new Response('sensitive upstream details', { status: 401 }), Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] })]) {
    const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder' }), fetchImpl: async () => upstream });
    const response = await post(base, request);
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes('sensitive'), false);
  }
});

test('schema rejects unsafe slider ranges, duplicate ids and extra fields', () => {
  assert.throws(() => validateLesson({ ...lesson, params: [{ ...lesson.params[0], step: 0 }] }));
  assert.throws(() => validateLesson({ ...lesson, params: [{ ...lesson.params[0], default: 99 }] }));
  assert.throws(() => validateLesson({ ...lesson, params: [...lesson.params, ...lesson.params] }));
  assert.throws(() => validateLesson({ ...lesson, unexpected: true }));
  assert.deepEqual(validateLesson(lesson), lesson);
});


test('billing exhaustion is distinguished from temporary rate limits', async t => {
  for (const code of ['credit_balance_exhausted', 'insufficient_quota', 'rate_limit_exceeded']) {
    const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder' }), fetchImpl: async () => Response.json({ error: { code, message: 'sensitive upstream details' } }, { status: 429 }) });
    const response = await post(base, request);
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.error.includes('sensitive'), false);
    assert.equal(body.error.includes('credits'), code !== 'rate_limit_exceeded');
  }
});


test('default OpenAI mode never switches to Gemini when only a Gemini key exists', async t => {
  const base = await serve(t, { getConfig: () => ({ PARALLAX_GEMINI_API_KEY: 'test-only-placeholder' }), fetchImpl: () => assert.fail('No provider fallback permitted') });
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.provider, 'openai');
  assert.equal(status.providerSource, 'default');
  assert.equal(status.configured, false);
  const response = await post(base, request);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /PARALLAX_API_KEY/);
});

test('Gemini sends key only in server header and validates structured output', async t => {
  let calls = 0;
  const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'gemini', PARALLAX_GEMINI_API_KEY: 'gemini-test-placeholder' }), fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(url.includes('key='), false);
    assert.equal(options.headers['x-goog-api-key'], 'gemini-test-placeholder');
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), { prompt: request.prompt, learningMode: request.mode });
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
    assert.ok(body.generationConfig.responseJsonSchema.properties.stageHtml);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'not output' }, { text: JSON.stringify(experiment) }] } }] });
  } });
  const response = await post(base, request);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { lesson: experiment });
  assert.equal(calls, 1);
});

test('Gemini quota, blocked and invalid output never fall back to a paid provider', async t => {
  for (const upstream of [Response.json({ error: { message: 'private upstream details' } }, { status: 429 }), Response.json({ candidates: [{ finishReason: 'SAFETY' }] }), Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] })]) {
    let calls = 0;
    const base = await serve(t, { getConfig: () => ({ PARALLAX_PROVIDER: 'gemini', PARALLAX_GEMINI_API_KEY: 'gemini-test-placeholder', PARALLAX_API_KEY: 'openai-test-placeholder' }), fetchImpl: async url => {
      calls++;
      assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
      return upstream;
    } });
    const response = await post(base, request);
    assert.ok([429, 502].includes(response.status));
    const text = await response.text();
    assert.equal(text.includes('private upstream details'), false);
    if (response.status === 429) assert.match(text, /free-tier quota/);
    assert.equal(calls, response.status === 429 ? 1 : 2);
  }
});

test('unsupported provider and model are rejected before any network request', async t => {
  for (const config of [{ PARALLAX_PROVIDER: 'unknown' }, { PARALLAX_PROVIDER: 'gemini', PARALLAX_GEMINI_MODEL: 'unexpected-model' }]) {
    const base = await serve(t, { getConfig: () => config, fetchImpl: () => assert.fail('No provider call') });
    assert.equal((await post(base, request)).status, 503);
  }
});

test('a Vercel deployment with only an OpenAI key uses OpenAI and reports safe diagnostics', async t => {
  const config = {PARALLAX_API_KEY: 'test-secret-not-for-browser', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'example-deployment-sha'};
  let calls = 0;
  const base = await serve(t, {getConfig: () => config, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'gpt-5.6-sol');
    return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify(experiment)}}]});
  }});
  const response = await fetch(`${base}/api/status`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const status = await response.json();
  assert.deepEqual(status, {provider: 'openai', model: 'gpt-5.6-sol', configured: true, providerSource: 'default', requiredKeyVariable: 'PARALLAX_API_KEY', lessonSchemaVersion: 2, deployment: {environment: 'production', commit: 'example-deployment-sha'}});
  assert.equal(JSON.stringify(status).includes(config.PARALLAX_API_KEY), false);
  assert.equal((await post(base, request)).status, 200);
  assert.equal(calls, 1);
});

test('serverless pre-parsed body and x-forwarded-host are accepted', async () => {
  const api = createApi({
    getConfig: () => ({ PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder' }),
    fetchImpl: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(experiment) } }] }),
  });
  let status = 0;
  let payload = '';
  const req = {
    url: '/api/generate',
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'internal.vercel.app', 'x-forwarded-host': 'parallax.vercel.app', origin: 'https://parallax.vercel.app' },
    body: request,
    socket: {},
  };
  const res = {
    setHeader() {},
    writeHead(code) { status = code; return this; },
    end(chunk = '') { payload = chunk; this.writableEnded = true; },
    on() {},
    off() {},
  };
  await api(req, res);
  assert.equal(status, 200);
  assert.deepEqual(JSON.parse(payload), { lesson: experiment });
});

test('an invalid numerical lesson gets one same-provider repair attempt', async t => {
  let calls = 0;
  const broken = {...experiment, checks: [{...experiment.checks[0], expectedSI: 999}, experiment.checks[1]]};
  const base = await serve(t, {getConfig: () => ({PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: 'test-only-placeholder'}), fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    calls++;
    if (calls === 2) assert.match(JSON.parse(options.body).messages[0].content, /last response failed/);
    return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify(calls === 1 ? broken : experiment)}}]});
  }});
  assert.equal((await post(base, request)).status, 200);
  assert.equal(calls, 2);
});
