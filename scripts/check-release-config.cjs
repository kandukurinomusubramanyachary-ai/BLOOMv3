const { resolveMegApiBaseUrl, isNonPublicHostname } = require('../src/services/megUrlPolicy');
const { FIREBASE_CONFIG_ENV_NAMES, validateFirebaseConfiguration } = require('../src/services/firebaseConfiguration');

function validateReleaseConfiguration(environment = {}) {
  const config = Object.fromEntries(Object.entries(FIREBASE_CONFIG_ENV_NAMES).map(([key, name]) => [key, environment[name]]));
  const issues = validateFirebaseConfiguration(config, { devAuthFlag: environment.EXPO_PUBLIC_BLOOM_DEV_AUTH });
  try {
    const endpoint = resolveMegApiBaseUrl({ configuredValue: environment.EXPO_PUBLIC_MEG_API_URL, isDevelopment: false });
    const url = new URL(endpoint);
    if (url.username || url.password) throw new Error();
  }
  catch { issues.push('EXPO_PUBLIC_MEG_API_URL must be a public HTTPS backend'); }
  for (const flag of ['MEG_DEV_AUTH']) {
    if (['1', 'true'].includes(String(environment[flag]).trim().toLowerCase())) issues.push(`${flag} must be disabled for this launch`);
  }
  for (const name of Object.keys(environment)) {
    if (/^EXPO_PUBLIC_.*(GEMINI|GROQ|OPENROUTER|SERVICE_ACCOUNT|PRIVATE_KEY|ADMIN_CREDENTIAL|ACCESS_TOKEN)/i.test(name) && environment[name]) issues.push(`${name} must not contain a backend secret`);
  }
  for (const name of ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SUPPORT_URL']) {
    try {
      const url = new URL(environment[name]);
      if (url.protocol !== 'https:' || url.username || url.password || isNonPublicHostname(url.hostname)) throw new Error();
    }
    catch { issues.push(`${name} requires a founder-reviewed public HTTPS page`); }
  }
  return issues;
}

// Names only: never echo configuration values, account contents or credentials.
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const issues = validateReleaseConfiguration(process.env);
  if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  else console.log('Release frontend configuration is present. Verify the live deployment and legal approval separately.');
}

module.exports = { validateReleaseConfiguration };
