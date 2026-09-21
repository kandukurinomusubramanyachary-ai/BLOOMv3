const FIREBASE_CONFIG_ENV_NAMES = Object.freeze({
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
});

function isDevelopmentAuthEnabled(isDevelopment, flag) {
  return isDevelopment === true && flag === '1';
}

function normalizeFirebaseConfiguration(config = {}) {
  return Object.fromEntries(Object.keys(FIREBASE_CONFIG_ENV_NAMES)
    .map(key => [key, String(config[key] ?? '').trim()]));
}

function validateFirebaseConfiguration(config, { isDevelopment = false, devAuthFlag } = {}) {
  const normalized = normalizeFirebaseConfiguration(config);
  const issues = [];
  for (const [key, name] of Object.entries(FIREBASE_CONFIG_ENV_NAMES)) {
    const value = normalized[key];
    if (!value) issues.push(`${name} is missing`);
    else if (/^(?:undefined|null|changeme|replace[-_ ]?me|your[-_ ]?(?:api[-_ ]?key|auth[-_ ]?domain|project[-_ ]?id|storage[-_ ]?bucket|messaging[-_ ]?sender[-_ ]?id|app[-_ ]?id)|<[^>]+>)$/i.test(value)) {
      issues.push(`${name} contains a placeholder`);
    } else if (/\s/.test(value)) issues.push(`${name} must not contain whitespace`);
  }
  if (normalized.authDomain && !issues.some(issue => issue.startsWith(FIREBASE_CONFIG_ENV_NAMES.authDomain))) {
    // A hostname check works in native builds without depending on a URL polyfill.
    const domain = normalized.authDomain;
    if (domain.length > 253 || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
      issues.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN must be a hostname without a URL scheme or path');
    }
  }
  if (isDevelopment !== true && ['1', 'true'].includes(String(devAuthFlag ?? '').trim().toLowerCase())) {
    issues.push('EXPO_PUBLIC_BLOOM_DEV_AUTH must be disabled in production');
  }
  return issues;
}

module.exports = {
  FIREBASE_CONFIG_ENV_NAMES,
  isDevelopmentAuthEnabled,
  normalizeFirebaseConfiguration,
  validateFirebaseConfiguration,
};
