require('dotenv').config({ quiet: true });
const { resolveMegApiBaseUrl } = require('../src/services/megUrlPolicy');
const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']
  .map((name) => `EXPO_PUBLIC_FIREBASE_${name}`);
const issues = required.filter((name) => !String(process.env[name] || '').trim()).map((name) => `${name} is missing`);
try { resolveMegApiBaseUrl({ configuredValue: process.env.EXPO_PUBLIC_MEG_API_URL, isDevelopment: false }); }
catch { issues.push('EXPO_PUBLIC_MEG_API_URL must be a public HTTPS backend'); }
for (const flag of ['EXPO_PUBLIC_BLOOM_DEV_AUTH', 'MEG_DEV_AUTH', 'EXPO_PUBLIC_BLOOM_STRENGTH']) {
  if (['1', 'true'].includes(String(process.env[flag]).trim().toLowerCase())) issues.push(`${flag} must be disabled for this launch`);
}
for (const name of Object.keys(process.env)) {
  if (/^EXPO_PUBLIC_.*(GEMINI|GROQ|OPENROUTER|SERVICE_ACCOUNT|PRIVATE_KEY|ADMIN_CREDENTIAL|ACCESS_TOKEN)/i.test(name) && process.env[name]) issues.push(`${name} must not contain a backend secret`);
}
for (const name of ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SUPPORT_URL']) {
  try { const url = new URL(process.env[name]); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
  catch { issues.push(`${name} requires a founder-reviewed HTTPS page`); }
}
// Names only: never echo configuration values, account contents or credentials.
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log('Release frontend configuration is present. Verify the live deployment and legal approval separately.');
