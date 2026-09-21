# Bloom V3 native release

The canonical integration branch is `release/bloom-v3`. It combines current
`main`, PR #4 and the September 20 local Strength/auth/account-deletion fixes.
Use this branch when preparing release builds; the September 15 snapshot is
not the complete release candidate.

## Product scope

Android and iOS V3 ship **guided Strength**: exercise instructions, paced
repetitions, rests, pause/resume and saved workout history. They do not measure
movement or assess form. Native screens say this before a workout starts and
must never request camera permission. Portrait is intentional for this scope.

Web Strength retains camera tracking for squat, wall push-up and standing
side-leg raise. Other movements remain guided. Camera performance now monitors
actual sample throughput and inference latency, reduces input resolution from
512 to 384 pixels under sustained load, reserves time between inferences, and
stops tracking if it cannot sustain the minimum rate. Background time does not
count as poor performance. Completed repetitions remain available to save.
Model initialization retries are bounded; timed-out models are not started
again in parallel.

Do not advertise native camera tracking in store text or screenshots. A native
pose module, native permission/lifecycle handling and physical-phone validation
are a separate implementation project.

## Build gates

- `Verify Bloom` runs the application, backend, Firestore rules, type, web and
  container checks on both `main` and `release/bloom-v3`.
- `Native builds` generates native projects and compiles Android arm64 release APK/AAB
  outputs and an unsigned physical-device iOS release app. The `Native build gate`
  fails unless both platform jobs succeed. These are compilation artifacts,
  not signed store submissions or evidence of a successful phone test.
- `Signed store builds` is manually dispatched against the candidate commit.
  Configure the production GitHub environment's `EXPO_TOKEN`, EAS production
  variables and previously initialized Android/iOS signing credentials. It
  waits for both production builds and rejects queued, failed, simulator,
  unrelated-project, stale-version or different-commit build evidence.
- EAS runs `check:native-config` and, for production, `check:release-config`
  after installing dependencies. Missing Firebase/backend/legal configuration
  fails the build. Never put provider or Admin secrets in `EXPO_PUBLIC_*`.

Configure branch protection to require `verify` and `Native build gate` before
merging a release. Workflow files alone do not enable GitHub branch protection.
Do not tag or submit a release until the signed-build evidence and the following
physical-device/production checks are complete for the same candidate.

Build numbers are managed locally. This candidate increments iOS 2 to 3 and
Android 4 to 5. Once a number has been uploaded to a store, increment it in
`app.json` and commit before rebuilding; do not reuse the same number.

## Physical-device record — pending

Record the commit, artifact/build ID, device model, OS, browser where applicable,
date, tester and result. Do not record health data, account tokens or camera
frames in this public repository.

| Device class | Native guided checks | Browser camera checks | Status |
| --- | --- | --- | --- |
| Low-end Android | Full session, storage, lifecycle, large text | Chrome, 15-minute load and recovery | Pending |
| Samsung/Pixel-class Android | Full session and account lifecycle | Chrome, permissions and framing | Pending |
| Small supported iPhone | Controls, keyboard, safe areas, sharing | Safari, orientation and speech | Pending |
| Current iPhone | Full session and account lifecycle | Safari, 15-minute load and recovery | Pending |

For native builds: install and update without losing existing records; complete
a multi-set workout; stop early; background/foreground during preparation,
countdown, movement and rest; lock/unlock; use dark mode and large text; kill and
reopen; export/share; go offline/reconnect; sign out and switch accounts; delete
the test account. No automatic repetitions should accrue while paused.

For web camera tracking: grant/deny/revoke permission; test low light and
backlighting, loose clothing, cropped head/feet, a second person entering the
frame, rotation, camera interruption, muted/unmuted audible speech and network
loss. Confirm sustained load produces guided recovery and releases the camera.
Use comfortable movement and stop for pain or dizziness. Automated landmarks
and camera fixtures cannot certify real-person tracking accuracy.

## Production rehearsal — pending credentials

Use a dedicated test account and the exact release artifacts/environment:

1. Verify live Firebase Email/Password Auth, authorized domains, deployed
   Firestore rules and the intended App Check enforcement state.
2. Sign up, finish onboarding, close/reopen, log in and receive a real password
   reset email. Confirm the restored account owns its previous records.
3. Complete Strength, reconnect after offline storage, and confirm one saved
   record with the correct mode and rep total.
4. Send a real Meg request, reload history, and verify backend persistence
   across restart/redeployment. Check unauthorized requests are rejected.
5. Log out/in, switch to a second test account and check isolation; export the
   first account, then delete it and verify Firebase/backend/device removal
   remains complete after reconnecting.
6. Open the actual privacy, terms and support URLs from both release builds.
   Confirm their content and store privacy disclosures match the shipped scope.

Passing configuration checks or compiling a native project does not complete
this rehearsal. See [production operations](PRODUCTION_OPERATIONS.md) and
[phone testing](strength/PHONE_TESTING.md) for operational details.

References: [Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
[SDK 57 release notes](https://expo.dev/changelog/sdk-57),
[EAS CI builds](https://docs.expo.dev/build/building-on-ci/),
[Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/),
[Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk).
