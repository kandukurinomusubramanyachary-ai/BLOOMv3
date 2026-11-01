const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config/env');
const { createProviders } = require('../src/providers');
const { GroqProvider } = require('../src/providers/groq');
const { GeminiProvider } = require('../src/providers/gemini');

test('provider configuration excludes disabled local fallback and uses current Groq default', () => {
  const config = loadConfig({ ENABLE_LOCAL_FALLBACK: ' false ' });
  assert.equal(createProviders(config).ollama.isConfigured(), false);
  assert.equal(config.providers.groq.model, 'openai/gpt-oss-20b');
  assert.equal(createProviders(loadConfig({ ENABLE_LOCAL_FALLBACK: 'true' })).ollama.isConfigured(), true);
});

test('Groq reasoning request reserves visible output without exposing reasoning', () => {
  const body = new GroqProvider({ apiKey: 'synthetic' }).requestBody({ messages: [], maxTokens: 900 });
  assert.equal(body.model, 'openai/gpt-oss-20b');
  assert.equal(body.include_reasoning, false);
  assert.equal(body.reasoning_effort, 'low');
  assert.ok(body.max_completion_tokens >= 2048);
  assert.equal(body.max_tokens, undefined);
});

test('Gemini keeps API key out of request URLs and filters thought parts', async () => {
  const originalFetch = global.fetch;
  let seen;
  global.fetch = async (url, options) => {
    seen = { url, options };
    return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hidden', thought: true }, { text: 'Visible answer' }] } }] }) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const text = await new GeminiProvider({ apiKey: 'synthetic-key' }).generate({ messages: [] });
    assert.equal(text, 'Visible answer');
    assert.doesNotMatch(seen.url, /synthetic-key|key=/);
    assert.equal(seen.options.headers['x-goog-api-key'], 'synthetic-key');
  } finally { global.fetch = originalFetch; }
});

test('provider HTTP errors cannot echo response secrets into telemetry codes', async () => {
  const { assertOk } = require('../src/providers/provider');
  await assert.rejects(assertOk(new Response('synthetic-secret and private prompt', { status: 401 }), 'gemini'), error => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'HTTP_401');
    assert.equal(error.retryable, false);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-secret|private prompt/);
    return true;
  });
});
