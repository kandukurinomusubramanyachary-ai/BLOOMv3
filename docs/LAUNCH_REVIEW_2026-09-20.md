# Bloom launch review — 20 September 2026

Historical snapshot. The subsequent SDK migration, GitHub integration and
remaining launch gates are recorded in [the native release record](NATIVE_RELEASE.md).
The statements below describe the September 20 review, before that integration.

## Release status

The repository review and the fixes described here are complete. **Production launch is still blocked by configuration, remaining dependency advisories and device acceptance.** The updated source has not been deployed. Passing JavaScript exports does not establish that signed Android/iOS apps build successfully or perform well on physical phones.

Reviewed starting point: `feat/strength-10of10`, commit `5a4023c`. The supplied repository has no configured Git remote. Changes are delivered as an updated source archive and a patch against that commit; they are not pushed or merged.

The review covered app startup and navigation, authentication/profile provisioning, account isolation, Today/check-ins and periods, Timeline, Diet, Meg frontend/backend, export/deletion, Strength, local/cloud storage, Firestore rules, dependencies, CI and distribution configuration. The deepest behavioral investigation focused on Strength and account lifecycle. Existing tests include behavioral tests and source-contract checks; they are not all end-to-end tests.

## Changes delivered

### Strength flow and presentation

- Replaced the incorrect navigation-focus callback with actual focus state. Switching tabs or hiding the page pauses tracking while retaining accepted reps. Returning before a workout starts requires fresh positioning; the initial countdown cannot start a session in the background.
- Fixed recalibration getting stuck after returning to the app. Foreground state now gates countdown, inference and movement transitions.
- Exposed a retry state when summary persistence fails instead of displaying an empty summary screen. Retries retain the original summary identifier.
- Kept the completed exercise mounted until both its pending-sync summary and local workout history are saved. A failed history write now has an explicit retry action. A tracked-to-guided transition passes through a saved summary before mounting the guided player.
- Removed automatic movement start when rest expires. The user starts the next movement with **I’m ready**. Leaving/advancing is blocked during an unfinished transition save.
- Preserved per-exercise cue counts and set totals, reset pause counts for each movement, and cleared stale transition summaries.
- Allowed long Strength header titles to shrink within narrow layouts. Corrected next-movement labels and native guided-mode descriptions. This is a source/layout improvement; no visual screenshot acceptance was completed in this environment.

### Performance and privacy

- Camera inference now leaves additional time between expensive frames based on measured inference duration. Sustained inference above 150 ms for five seconds releases camera/model resources and offers guided recovery. Brief startup slowness can recover without ending the session.
- These thresholds are recovery behavior, not measurements proving smooth operation on all phones. Web pose inference remains synchronous; physical-device profiling and potential worker/native work remain separate requirements.
- Added bounded `totalSets` and `completedSets` to the summary allowlist and Firestore schema. Multi-set totals such as five sets of 24 reps can now fit the rules. Camera frames and landmarks remain excluded from the persisted summary contract.
- Fenced queued Strength uploads across account invalidation. Data deletion waits for outstanding Strength work, including an SDK upload that outlives its foreground timeout. If that upload cannot finish while offline, deletion reports a recoverable error rather than claiming success. Local deletion also waits for a history write already in progress.

### Account, export and backend

- Included previously omitted authentication, deletion and release-configuration suites in the main test command. Their failures exposed account-lifecycle issues that are now fixed.
- Authentication now clears the previously exposed account on sign-out, listener errors and failed profile restoration, including callbacks arriving during another auth operation. Old account cleanup is idempotent; disposed sessions reject new operations.
- JSON export includes this device’s saved Strength history alongside existing app records and authenticated Meg data. An account change while the asynchronous export is being prepared prevents sharing the previous account’s data. CSV/text retain their explicitly narrower contents.
- Corrected a missed existing safety benchmark pattern in Meg and stopped combined diagnosis/medication questions from being escalated to an emergency solely because two nonurgent rules matched. The benchmark test now requires every safety fixture to select the safety route. This is deterministic routing verification, not clinical validation or a live-provider evaluation.
- Enabled Strength in the example configuration and removed the old blanket release-check prohibition. Real Firebase, HTTPS backend, disabled development authentication and approved policy/support URLs remain required. Existing private local configuration was not rewritten.
- Updated compatible transitive releases of `brace-expansion`, `browserslist`, `js-yaml` and `nanoid`, plus their resolver-selected dependencies. Expo/React Native major versions are unchanged. Added React 18.2 test renderer for actual hook/component regressions, while preserving the lockfile’s optional Firebase peer entries.

## Verification performed

Local runtime: Node **24.19.0**, npm **11.9.0**. Dependency updates and the final lockfile dry-run used npm **10.9.9**, matching CI’s npm pin. CI specifies Node 22 and Java 21; no remote CI run was available in this checkout.

| Check | Observed result |
| --- | --- |
| Root dependency installation | Passed before edits; compatible dependency updates subsequently installed |
| `npm ci --prefix meg-engine-v2` | Passed, including SQLite dependency installation |
| Final npm 10.9.9 `ci --dry-run --ignore-scripts --no-audit --no-fund` | Passed; lockfile accepted, not a second clean install |
| `npm test` | **318 passed**, zero failures/skips |
| `npm test --prefix meg-engine-v2` | **41 passed**, zero failures/skips |
| Meg deterministic benchmark | 200 fixtures; intent 93.5%, route 100%; safety route 20/20 |
| `npm run typecheck` | Passed under the repository’s existing TypeScript configuration |
| Expo export for web, Android and iOS | Passed with Strength enabled, development auth disabled and `.env` loading disabled |
| Exported main bundle sizes | Web 2.91 MB; iOS Hermes 5.57 MB; Android Hermes 5.59 MB; size is not a speed measurement |
| `git diff --check` | Passed |
| Root `npm audit --omit=dev` after updates | 49 findings: 1 critical, 10 high, 36 moderate, 2 low; previously 54 including 14 high |
| Meg engine `npm audit --omit=dev` | Zero reported findings at the time of this check |
| `npm run release:config:check` | Correctly blocked: six missing Firebase fields, enabled local development auth, nonpublic backend and missing policy/support URLs |
| Firestore emulator tests | Blocked: available Java is 17; installed Firebase tooling requires Java 21. Attempt to obtain Java 21 was blocked by network access. New rules tests are included but not passed locally |
| Browser visual/session checks | Blocked: the provided browser could not reach the local preview (`ERR_BLOCKED_BY_CLIENT`). Existing browser smoke scripts were not executed in this pass |
| Physical phones, signed native builds, live Firebase/provider flows, production container and remote CI | Not verified in this environment |

The native exports above are JavaScript/Hermes bundles, not APK/AAB/IPA builds. No provider credentials were used for these tests. Earlier reports in this repository contain results from different dates and must not be interpreted as fresh verification of this revision.

## Platform capability

| Target | Strength capability in this source | Acceptance still needed |
| --- | --- | --- |
| Android Chrome over HTTPS | Camera tracking for squat, wall push-up and side-leg raise; guided mode for other movements | Real permissions, framing/rep accuracy, responsiveness, background/resume and export |
| iPhone Safari over HTTPS | Same web capability, subject to browser/device support | Same checks plus Safari camera, audio and page lifecycle |
| Native Android | Guided workouts and local history | Signed build, physical-device layout, lifecycle, sharing, notifications and app lock |
| Native iOS | Guided workouts and local history | Signed build, physical-device layout, lifecycle, sharing, notifications and app lock |

**Native camera-based rep tracking is not implemented in this repository.** It requires a native camera/pose integration and its own build/device acceptance. Guided pacing does not measure form. No claim is made that every phone is supported or that any platform is free of lag.

## Remaining release requirements

1. **Configure real services.** Supply the six `EXPO_PUBLIC_FIREBASE_*` values, the public HTTPS `EXPO_PUBLIC_MEG_API_URL`, and the policy/terms/support URLs listed in `.env.example`. Configure Firebase Admin credentials and at least one Meg provider key only in the backend’s private environment/secret settings. Disable both development-auth flags. Rebuild after public environment changes.
2. **Complete infrastructure activation.** Set allowed production origins, persistent Meg SQLite storage and operational backup/restore procedures. Verify `/live`, truthful `/health`, authenticated chat, export, deletion and restart behavior against the actual deployment. Existing operational guidance is in `docs/PRODUCTION_OPERATIONS.md` and `docs/firebase-setup.md`.
3. **Run the Firestore gate before deployment.** Run `npm run test:rules` with Java 21, review the multi-set schema changes, then deploy the verified rules to the selected project. Rules were not deployed here.
4. **Resolve the remaining dependency findings.** The critical `tar` finding and several high findings belong to the old Expo/React Native tool dependency graph. Others include `@xmldom/xmldom`, `image-size` and `postcss`. Audit proposes major framework updates for several chains. Their presence is not proof of a reachable production exploit, but compatibility/security review remains a release requirement. No forced cross-major overrides or unvalidated SDK migration were applied.
5. **Complete mobile acceptance.** Follow `docs/strength/PHONE_TESTING.md` on representative small/older and current Android/iPhone devices, including long sessions, slow/offline networks, denied camera permissions, large text, dark mode, account switching and deletion during a delayed upload. Measure responsiveness and battery/thermal behavior. Review movement thresholds with an appropriately qualified professional before presenting them as form guidance.
6. **For app-store release, build and test the native apps.** Follow and refresh `STORE_MIGRATION_PLAN.md` against the selected current toolchain/store requirements. Decide whether guided Strength is the intended native launch experience; native camera tracking remains additional implementation work.

## Applying this delivery

The updated ZIP contains the source changes, tests and this report, while preserving the supplied repository and unrelated files. Generated builds, installed dependencies and temporary inspection logs are not added. Private configuration already present in the supplied archive remains private source material; treat the archive accordingly.

The companion patch targets commit `5a4023c`. Apply it to a clean checkout of that commit with `git apply Bloom-launch-fixes.patch`, then install root and Meg dependencies and run the checks above. The patch contains the code/test/documentation changes and no local credentials.
