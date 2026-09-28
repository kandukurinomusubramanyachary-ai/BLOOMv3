import { Linking, Platform } from 'react-native';

const PROVIDER_HOSTS = {
  swiggy: ['swiggy.com'],
  zomato: ['zomato.com'],
};

export function providerSearchUrl(provider, query) {
  const encoded = encodeURIComponent(String(query || '').trim());
  if (provider === 'swiggy') return `https://www.swiggy.com/search?query=${encoded}`;
  if (provider === 'zomato') return `https://www.zomato.com/search?q=${encoded}`;
  return '';
}

export function safeProviderUrl(provider, value) {
  if (!value || !PROVIDER_HOSTS[provider]) return '';
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    const allowed = PROVIDER_HOSTS[provider]
      .some((host) => hostname === host || hostname.endsWith(`.${host}`));
    return parsed.protocol === 'https:' && allowed ? parsed.toString() : '';
  } catch {
    return '';
  }
}

async function canOpen(linking, url) {
  try { return await linking.canOpenURL(url); } catch { return false; }
}

export async function openFoodProvider({
  provider,
  query,
  providerUrl,
  platform = Platform.OS,
  linking = Linking,
  browserWindow = typeof window !== 'undefined' ? window : null,
} = {}) {
  const fallbackUrl = providerSearchUrl(provider, query);
  if (!fallbackUrl) return false;
  const canonicalUrl = safeProviderUrl(provider, providerUrl);
  const targetUrl = canonicalUrl || fallbackUrl;

  try {
    if (platform === 'web' && browserWindow?.open) {
      const opened = browserWindow.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (opened) return true;
      await linking.openURL(fallbackUrl);
      return true;
    }

    if (await canOpen(linking, targetUrl)) {
      await linking.openURL(targetUrl);
      return true;
    }
    if (targetUrl !== fallbackUrl && await canOpen(linking, fallbackUrl)) {
      await linking.openURL(fallbackUrl);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
