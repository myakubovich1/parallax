import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerConfig, providerStatus, providerFailure} from './providers.mjs';

test('runtime defaults match the OpenAI example even when a Gemini key is also present', () => {
  const config = {PARALLAX_API_KEY: 'openai-test-key', PARALLAX_GEMINI_API_KEY: 'gemini-test-key'};
  const provider = providerConfig(config);
  assert.equal(provider.name, 'openai');
  assert.equal(provider.model, 'gpt-5.6-sol');
  assert.equal(provider.key, config.PARALLAX_API_KEY);
  assert.equal(providerStatus(config, provider).providerSource, 'default');
});

test('explicit provider settings take precedence and whitespace is normalized', () => {
  const provider = providerConfig({PARALLAX_PROVIDER: ' OpenAI\n', PARALLAX_MODEL: ' gpt-5.6-sol\n', PARALLAX_API_KEY: ' key\n'});
  assert.equal(provider.name, 'openai');
  assert.equal(provider.model, 'gpt-5.6-sol');
  assert.equal(provider.key, 'key');
  const gemini = providerConfig({PARALLAX_PROVIDER: 'gemini', PARALLAX_API_KEY: 'openai-only'});
  assert.equal(gemini.name, 'gemini');
  assert.equal(gemini.key, undefined);
  assert.match(gemini.missing, /explicitly selects Gemini/);
  assert.match(gemini.missing, /PARALLAX_PROVIDER=openai/);
  assert.throws(()=>providerConfig({PARALLAX_PROVIDER: '"openai"'}), /Set PARALLAX_PROVIDER/);
});

test('empty secrets are reported as missing and diagnostics never expose either provider key', () => {
  const config = {PARALLAX_PROVIDER: 'openai', PARALLAX_API_KEY: ' \n', PARALLAX_GEMINI_API_KEY: 'private-gemini-value', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: 'preview-commit'};
  const status = providerStatus(config, providerConfig(config));
  assert.equal(status.configured, false);
  assert.equal(status.providerSource, 'environment');
  assert.equal(status.deployment.environment, 'preview');
  assert.equal(status.deployment.commit, 'preview-commit');
  assert.equal(JSON.stringify(status).includes('private-gemini-value'), false);
  assert.equal(JSON.stringify(status).includes('PARALLAX_GEMINI_API_KEY'), false);
});

test('OpenAI model-access and structured-output errors are actionable without leaking upstream messages', () => {
  const provider = providerConfig({});
  const modelError = providerFailure(provider, 404, {error: {code: 'model_not_found', message: 'secret-value'}});
  assert.match(modelError, /PARALLAX_MODEL/);
  assert.equal(modelError.includes('secret-value'), false);
  assert.match(providerFailure(provider, 400, {error: {param: 'response_format'}}), /structured outputs/);
});
