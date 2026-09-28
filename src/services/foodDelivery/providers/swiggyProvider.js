import { auth } from '../../firebase';

const configuredBaseUrl = process.env.EXPO_PUBLIC_FOOD_DELIVERY_API_URL;

function cleanBaseUrl(value) {
  const candidate = String(value || '').trim().replace(/\/+$/, '');
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (!isDevelopment && parsed.protocol !== 'https:') return '';
    return candidate;
  } catch {
    return '';
  }
}

export function createSwiggyProvider({
  baseUrl = configuredBaseUrl,
  fetchImpl = (...args) => fetch(...args),
  getAuthToken = async () => auth?.currentUser?.getIdToken?.(),
} = {}) {
  const apiBaseUrl = cleanBaseUrl(baseUrl);

  return {
    id: 'swiggy',
    isConfigured: () => Boolean(apiBaseUrl),
    async search({ query, useSavedAddress = false, signal } = {}) {
      if (!apiBaseUrl) return { state: 'provider-unavailable', provider: 'swiggy' };
      const token = await getAuthToken();
      if (!token) return { state: 'provider-unavailable', provider: 'swiggy' };

      const response = await fetchImpl(`${apiBaseUrl}/api/food-delivery/swiggy/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: String(query || '').trim().slice(0, 120),
          useSavedAddress: useSavedAddress === true,
        }),
        signal,
      });

      let payload = {};
      try { payload = await response.json(); } catch { payload = {}; }
      if (response.status === 409 || response.status === 428 || payload?.state === 'location-required') {
        return { state: 'location-required', provider: 'swiggy' };
      }
      if (response.status === 501 || payload?.state === 'provider-unavailable') {
        return { state: 'provider-unavailable', provider: 'swiggy' };
      }
      if (!response.ok) throw new Error('food_delivery_provider_request_failed');
      return payload;
    },
  };
}

export const swiggyProvider = createSwiggyProvider();
