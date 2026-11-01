import { auth } from './firebase';
const accountWork = require('./accountWork');
const { assertMegServiceContract } = require('./megServiceContract');
const { resolveMegApiBaseUrl } = require('./megUrlPolicy');

// Privacy operations intentionally never use the preview/dev token.
export async function requestMegAccountData({ method = 'GET', conversationId, messageId, feedback, history = false, expectedUid } = {}) {
  const user = auth?.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Sign in again to manage your Meg data.');
  const version = accountWork.epoch(user.uid);
  const checkAccount = () => {
    if (auth.currentUser?.uid !== user.uid || accountWork.epoch(user.uid) !== version) throw new Error('Your sign-in changed. Please retry.');
  };
  const baseUrl = resolveMegApiBaseUrl({
    configuredValue: process.env.EXPO_PUBLIC_MEG_API_URL,
    isDevelopment: typeof __DEV__ !== 'undefined' && __DEV__,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    await assertMegServiceContract(baseUrl, { signal: controller.signal });
    checkAccount();
    const token = await user.getIdToken();
    checkAccount();
    const path = messageId
      ? `/api/meg/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`
      : history ? '/api/meg/conversations'
      : conversationId ? `/api/meg/conversations/${encodeURIComponent(conversationId)}` : '/api/meg/data';
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: controller.signal,
      ...(method === 'PATCH' ? { body: JSON.stringify({ feedback: feedback ?? null }) } : {}),
    });
    if (!response.ok) throw Object.assign(new Error('Meg data could not be updated.'), { status: response.status });
    const result = await response.json();
    if (method === 'DELETE' && result?.ok !== true) throw new Error('Meg did not confirm deletion. Please retry.');
    checkAccount();
    return result;
  } catch (cause) {
    throw Object.assign(new Error('Meg data could not be verified. Check your connection and try again.'), { status: cause?.status });
  } finally { clearTimeout(timer); }
}
