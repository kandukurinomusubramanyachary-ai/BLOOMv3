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

test('the shared request deadline bounds all retries and provider fallbacks', async () => {
  const { ProviderManager } = require('../src/providers/providerManager');
  let calls = 0;
  const provider = { isConfigured: () => true, async *stream() { calls++; await new Promise(() => {}); } };
  const manager = new ProviderManager({ providers: { first: provider, second: provider }, config: { requestTimeoutMs: 30, timeouts: { SMART: 1000 }, retries: 2, retry: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 } } });
  const started = Date.now();
  await assert.rejects(manager.generate({ providerNames: ['first', 'second'], route: 'SMART', messages: [] }), error => error.code === 'ALL_PROVIDERS_FAILED');
  assert.ok(Date.now() - started < 500, 'must not spend the route timeout on every retry/provider');
  assert.equal(calls, 1);
});

test('standalone production transport cannot start with authentication disabled', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const child = spawnSync(process.execPath, [path.resolve(__dirname, '../src/server.js')], {
    env: { ...process.env, NODE_ENV: ' production ', MEG_API_KEY: '' },
    encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Standalone production Meg requires MEG_API_KEY/);
});
