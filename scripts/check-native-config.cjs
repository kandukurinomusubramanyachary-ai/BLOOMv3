const fs = require('node:fs');
const path = require('node:path');

function validateNativeConfiguration(pkg, config, eas) {
  const issues = [];
  const sdk = Number(String(pkg.dependencies?.expo || '').match(/\d+/)?.[0]);
  if (!Number.isInteger(sdk) || sdk < 57) issues.push('Native releases require the validated Expo SDK 57 baseline or newer.');
  if (pkg.version !== config.version) issues.push('App and package versions must match.');
  if (!/^[1-9]\d*$/.test(String(config.ios?.buildNumber || ''))) issues.push('iOS requires a positive build number.');
  if (!Number.isInteger(config.android?.versionCode) || config.android.versionCode < 1) issues.push('Android requires a positive versionCode.');
  if (config.newArchEnabled === false) issues.push('The current Expo SDK requires the New Architecture.');
  const buildProperties = config.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')?.[1];
  if (!(buildProperties?.android?.targetSdkVersion >= 36)) issues.push('Set the Android release target to API 36 or newer.');
  if (Number(buildProperties?.ios?.deploymentTarget) < 16.4 || !buildProperties?.ios?.deploymentTarget) issues.push('SDK 57 requires iOS 16.4 or newer.');
  if (config.orientation !== 'portrait') issues.push('The guided native release is verified in portrait orientation.');
  const production = eas.build?.production;
  if (production?.distribution !== 'store' || production?.android?.buildType !== 'app-bundle' || production?.ios?.simulator !== false) issues.push('Production must build a store AAB and a physical-device iOS app.');
  for (const platform of ['android', 'ios']) {
    if (production?.[platform]?.image !== `sdk-${sdk}`) issues.push(`Pin the production ${platform} EAS image to sdk-${sdk}.`);
  }
  return issues;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const issues = validateNativeConfiguration(read('package.json'), read('app.json').expo, read('eas.json'));
  if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  else console.log('Native configuration is consistent. Compilation, signing and real-device verification are separate gates.');
}

module.exports = { validateNativeConfiguration };
