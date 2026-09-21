const fs = require('node:fs');

function validateStoreBuilds(builds, commit, app, projectId) {
  const issues = [];
  if (!/^[a-f0-9]{40}$/i.test(commit || '')) return ['A full release commit SHA is required.'];
  if (!Array.isArray(builds)) return ['EAS build output must be an array.'];
  for (const platform of ['ANDROID', 'IOS']) {
    const candidates = builds.filter(build => build?.platform === platform);
    if (candidates.length !== 1) { issues.push(`Expected exactly one ${platform} build.`); continue; }
    const build = candidates[0];
    if (build.status !== 'FINISHED') issues.push(`${platform} build has not finished successfully.`);
    if (build.gitCommitHash !== commit) issues.push(`${platform} build belongs to a different commit.`);
    if ((build.app?.id || build.project?.id) !== projectId) issues.push(`${platform} build belongs to a different EAS project.`);
    if (build.buildProfile !== 'production' || build.distribution !== 'STORE') issues.push(`${platform} build is not a production store build.`);
    if (platform === 'IOS' && build.isForIosSimulator !== false) issues.push('iOS build must target physical devices.');
    const expectedBuild = platform === 'IOS' ? app.ios.buildNumber : app.android.versionCode;
    if (build.appVersion !== app.version || String(build.appBuildVersion) !== String(expectedBuild)) issues.push(`${platform} version does not match the release configuration.`);
    try {
      const url = new URL(build.artifacts?.applicationArchiveUrl || build.artifacts?.buildUrl);
      if (url.protocol !== 'https:') throw new Error();
    } catch { issues.push(`${platform} build has no downloadable HTTPS artifact.`); }
  }
  return issues;
}

if (require.main === module) {
  const app = require('../app.json').expo;
  try {
    const issues = validateStoreBuilds(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), process.argv[3], app, app.extra.eas.projectId);
    if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
    else console.log('Both signed production artifacts completed for this commit. Real-device and production rehearsal sign-off is still required before tagging.');
  } catch { console.error('Could not read EAS build evidence.'); process.exitCode = 1; }
}

module.exports = { validateStoreBuilds };
