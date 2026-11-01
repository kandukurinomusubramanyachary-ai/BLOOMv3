// Synthetic QA only. Supply a dedicated Firebase QA account or a short-lived
// QA ID token through the process environment. Never print credentials/content.
require('dotenv').config({ quiet: true });
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { resolveMegApiBaseUrl } = require('../src/services/megUrlPolicy');

async function main() {
  const base = resolveMegApiBaseUrl({ configuredValue: process.env.EXPO_PUBLIC_MEG_API_URL,
    isDevelopment: process.env.BLOOM_QA_ALLOW_LOCAL_BACKEND === '1' });
  let token = process.env.BLOOM_QA_FIREBASE_ID_TOKEN;
  const started = performance.now();
  if (!token) {
    for (const key of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'BLOOM_QA_EMAIL', 'BLOOM_QA_PASSWORD']) {
      if (!process.env[key]) throw Error(key + ' is required for the dedicated QA account.');
    }
    const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(process.env.EXPO_PUBLIC_FIREBASE_API_KEY), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.BLOOM_QA_EMAIL, password: process.env.BLOOM_QA_PASSWORD, returnSecureToken: true }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('QA Firebase login failed.');
    token = (await response.json()).idToken;
  }
  if (!token) throw Error('QA token is unavailable.');
  const authenticationMs = Math.round(performance.now() - started);
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, { method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(95000) });
    if (!response.ok) throw Error('QA request failed with HTTP ' + response.status + ' at ' + path.split('/').slice(0, 4).join('/'));
    return { data: await response.json(), timing: response.headers.get('server-timing') };
  }
  const body = { conversationId: 'qa-' + randomUUID(), messageId: 'qa-' + randomUUID(), message: 'Hello from a synthetic Bloom connection test. Please say hello briefly.', supportMode: 'listen', language: 'en' };
  const responseStarted = performance.now();
  const first = await request('/api/meg/chat', 'POST', body);
  if (!first.data.message || !['gemini', 'groq', 'openrouter'].includes(first.data.provider)) throw Error('A genuine supported cloud-provider response was not confirmed.');
  const replyMs = Math.round(performance.now() - responseStarted);
  const replay = await request('/api/meg/chat', 'POST', body);
  if (replay.data.messageId !== first.data.messageId || replay.data.message !== first.data.message) throw Error('Retry did not replay the same assistant reply.');
  const feedbackPath = '/api/meg/conversations/' + body.conversationId + '/messages/' + first.data.messageId + '/feedback';
  await request(feedbackPath, 'PATCH', { feedback: 'helpful' });
  let history = (await request('/api/meg/conversations')).data.conversations.find(item => item.id === body.conversationId);
  if (history?.messages?.length !== 2 || history.messages.find(item => item.id === first.data.messageId)?.feedback !== 'helpful') throw Error('History or feedback restoration failed.');
  await request(feedbackPath, 'PATCH', { feedback: null });
  history = (await request('/api/meg/conversations')).data.conversations.find(item => item.id === body.conversationId);
  if (history.messages.find(item => item.id === first.data.messageId)?.feedback !== null) throw Error('Feedback removal was not persisted.');
  console.log(JSON.stringify({ status: 'PASS', provider: first.data.provider, authenticationMs, replyMs, serverTiming: first.timing, replay: true, history: true, feedback: true, syntheticConversationId: body.conversationId }));
  console.log('The synthetic QA conversation remains for restart/device acceptance. No health records or reply contents were printed.');
}
main().catch(error => { console.error('BLOCKED/FAIL: ' + (/required|unavailable|confirmed|failed|persisted|replay/.test(error.message) ? error.message : 'Check QA configuration and service connectivity.')); process.exitCode = 1; });
