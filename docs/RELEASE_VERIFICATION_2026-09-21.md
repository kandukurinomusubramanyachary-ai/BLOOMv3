# Bloom V3 release verification — 21 September 2026

This records local verification, not physical-phone or production-service
certification. The GitHub Actions checks on the release PR are authoritative
for remote native compilation, Firestore rules and container verification.

## Integration and migration

`release/bloom-v3` preserves the September 20 local fixes and reconciles current
main. PR #4 was merged upstream as `121bbf8`; its product source matches the
snapshot already integrated here. The later authentication fixes and complete
authentication/configuration/deletion test suites remain included.

Expo was upgraded incrementally through 52.0.49, 53.0.27, 54.0.37, 55.0.31,
56.0.22 and 57.0.24. Each stage passed app tests, typechecking and web/Android/iOS
JavaScript exports. Doctor was clean through SDK 55. SDK 56 identified a splash
schema migration and the known Hermes advisory, both addressed by the final
SDK 57 configuration and React Native 0.86.3 baseline.

The final baseline uses React 19.2.3, React Navigation 7 and TypeScript 6.0.3.
Startup uses public Expo root registration, navigation includes required theme
fonts, reminder triggers use typed APIs, file sharing uses the supported legacy
filesystem entry point, and splash/status-bar settings use config plugins.

Generated native projects retain their application identifiers. Android targets
API 36 with versionCode 5. iOS has deployment target 16.4 and CFBundleVersion 3.
The native configuration intentionally uses guided Strength and requests no
camera permission. Generated folders are ignored and recreated from app config.

## Final local checks

- 329 app tests and 41 Meg tests passed.
- Typecheck, web/Android/iOS bundle exports, Expo Doctor (21 checks), native
  configuration validation and Android/iOS project generation passed.
- Meg's deterministic benchmark passed all 200 routing fixtures, including
  20/20 safety fixtures; intent accuracy was 93.5%. This is not a clinical or
  live-provider evaluation.
- Root and Meg production dependency audits (`npm audit --omit=dev`) reported
  zero vulnerabilities. This does not certify development dependencies or the
  complete application's security.
- Scoped UUID overrides patch the legacy `xcode` and `gaxios` callers while
  retaining their CommonJS `v4()` API. Native prebuild exercises Xcode project
  generation. A Gaxios multipart regression check validates upload boundaries
  through a capturing adapter, without network or credentials, and checks the
  patched undersized-buffer behavior from
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
  Revisit these overrides when the parent libraries update their dependencies.
- Camera fixtures cover sample throughput, latency, lower resolution, recovery,
  pauses, stalled video, bounded model retries and resource cleanup. They do
  not establish real-person pose accuracy or audible speech on a phone.

## GitHub verification

On commit `37101b7`, [Verify Bloom passed](https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3/actions/runs/35601867527),
including 329 app tests, 41 Meg tests, 12 Firestore rules tests, the benchmark,
typecheck, Expo Doctor, web export, Docker build and container smoke checks.

[Native builds passed](https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3/actions/runs/35601867722):
Android release APK/AAB compilation, unsigned physical-device iOS Release
compilation with Xcode 26.6, and the combined native build gate. Both platform
artifacts were uploaded. These artifacts do not establish signing or acceptance
on a physical phone.

CI runs for pull requests into main or the release branch, and pushes to main.
Updates to the open release PR run once through the pull-request event. This
avoids duplicate push/PR runs cancelling each other on the same commit. A
cancelled workflow skips its native gate instead of reporting a build failure;
a failed platform build still fails the gate.

## Remaining release gates

See [the native release record](NATIVE_RELEASE.md) for the device matrix and
production rehearsal. Signed EAS artifacts, physical-phone acceptance, and a real
Firebase/Meg/account-deletion rehearsal remain required before store submission.
The documented required branch checks still need repository-owner configuration.

Native V3 Strength is guided and camera-free. Web retains camera tracking for
supported movements. Do not advertise native camera form tracking.
