# Bloom store migration

The authorized V3 migration is integrated on `release/bloom-v3`. The current
baseline is Expo SDK 57, React Native 0.86, React 19.2 and React Navigation 7,
upgraded one SDK at a time from SDK 51. App identifiers remain `com.bloom.app`
(iOS) and `com.bloomhealth.app` (Android) to preserve existing store identity.

Native Strength ships guided workouts. Native camera form tracking is outside
this release's advertised scope. Web retains its supported camera workouts.

See [the release record](docs/NATIVE_RELEASE.md) for build gates, locally managed
version numbers, device acceptance and the production account rehearsal. Actual
signed builds, physical-device tests and live services must pass before tagging
or submitting a release. SDK compatibility and bundle exports do not replace
those checks.

Apple requires Xcode 26 or newer and the iOS 26 SDK for current submissions;
Google Play requires Android API 36 for new apps and updates. The release pins
Expo SDK 57 build images and Android target API 36. Check the actual build
artifacts and signing accounts before submission.

References: [Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
[Apple requirements](https://developer.apple.com/news/upcoming-requirements/),
[Google Play requirements](https://developer.android.com/google/play/requirements/target-sdk).
