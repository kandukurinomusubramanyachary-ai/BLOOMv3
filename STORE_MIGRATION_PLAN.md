# Bloom store migration plan

Reviewed 2026-09-07. This hardening task targets a web beta. No Expo, React Native, app identifier, or Meg generation migration was performed.

## Current baseline

- Expo SDK 51 (`~51.0.0`), React Native 0.74.5, React 18.2.0.
- Release version: 1.1.0, with visible UI reading `app.json`.
- iOS: `com.bloom.app`; Android: `com.bloomhealth.app`. Both unchanged, pending founder approval of store ownership/signing.
- Strength disabled. Native pose tracking is not part of this release.

## Store requirements

Apple requires uploads built with Xcode 26 or later and the iOS 26 SDK or later since April 28, 2026. The present SDK 51 native build has not been validated against this requirement. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/)

New Google Play apps and updates must target Android 16/API 36 from August 31, 2026. Do not assume this legacy native stack meets that target by changing a version number alone. [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

## Separate migration workflow

1. Obtain explicit approval for a native migration branch and confirmed store identifiers/signing accounts. Keep web-beta fixes separate and retain a rollback build.
2. Follow Expo's incremental SDK upgrade workflow, one SDK generation at a time from 51. At each step align Expo packages, React Native and React, run `npx expo install --fix`, `npx expo-doctor`, all Bloom/Meg/rules tests, and development builds. Review each SDK's release notes before choosing the final supported target. [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
3. Validate New Architecture compatibility, navigation/gesture/screen dependencies, Firebase native Auth persistence and AsyncStorage compatibility. The current Firebase peer resolution installs a newer nested AsyncStorage for web dependencies while Expo 51 uses root 1.23.1; native compatibility requires explicit testing, not a forced override.
4. Review changes to notifications, file export/sharing, secure storage, local authentication, screen capture, keyboard/safe areas and platform permission descriptions. Test upgrades against existing UID-scoped device data; do not reset users' records as a migration shortcut.
5. Build signed release artifacts with the required Apple toolchain and Android target. Inspect actual artifact manifests/toolchain output, not just `app.json`. Test on real devices and internal distribution tracks.
6. Founder/legal review: published privacy/terms/support, retention and backup policy, store privacy/data-safety forms, account-deletion flow and support URL, age rating/eligibility, health-content wording and screenshots. No legal or medical approval is implied by this report.

## Acceptance and risks

Do not submit until native clean installs/builds, existing automated suites, store validations and real-device account lifecycle tests pass. Cross-generation SDK changes are a separate engineering project; changing targetSdkVersion or installing current Expo Go alone is insufficient. Use development builds for the selected SDK. Meg V2 remains unchanged in generation; Meg V3 is out of scope.

Web beta still needs real Firebase/backend configuration, durable deployment verification, reviewed legal pages and a green remote Verify Bloom run. These are web launch gates, not reasons to perform an unapproved native SDK migration.
