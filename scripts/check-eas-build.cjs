const { execFileSync } = require('node:child_process');

// Run inside EAS, where the selected environment is available to the build.
execFileSync(process.execPath, ['scripts/check-native-config.cjs'], { stdio: 'inherit' });
if (process.env.EAS_BUILD_PROFILE === 'production') {
  execFileSync(process.execPath, ['scripts/check-release-config.cjs'], { stdio: 'inherit' });
}
