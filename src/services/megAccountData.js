import { auth } from './firebase';
const { resolveMegApiBaseUrl } = require('./megUrlPolicy');

// Privacy operations intentionally never use the preview/dev token.
export async function requestMegAccountData({ method = 'GET', conversationId, expectedUid } = {}) {
  const user = auth?.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Sign in again to manage your Meg data.');
  const baseUrl = resolveMegApiBaseUrl({
    configuredValue: process.env.EXPO_PUBLIC_MEG_API_URL,
    isDevelopment: typeof __DEV__ !== 'undefined' && __DEV__,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid) throw new Error('Your sign-in changed. Please retry.');
    const path = conversationId ? `/api/meg/conversations/${encodeURIComponent(conversationId)}` : '/api/meg/data';
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
    if (!response.ok) throw new Error('Meg data could not be updated. Check your connection and retry.');
    const result = await response.json();
    if (method === 'DELETE' && result?.ok !== true) throw new Error('Meg did not confirm deletion. Please retry.');
    if (auth.currentUser?.uid !== user.uid) throw new Error('Your sign-in changed. Please retry.');
    return result;
  } catch {
    throw new Error('Meg data could not be verified. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}
