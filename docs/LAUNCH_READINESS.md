# Bloom Launch Readiness

> Historical report from 2026-09-10. The current source review, Strength changes,
> verification results and unresolved launch requirements are in
> [LAUNCH_REVIEW_2026-09-20.md](LAUNCH_REVIEW_2026-09-20.md). The test runs below
> were recorded by the earlier review and were not all repeated in this pass.

## 1. Final status

NOT READY

Local implementation and available automated verification are complete; live service activation is deferred until configuration is supplied. The local hardening branch starts at verified BLOOMv3/main commit `aa91b57a857eabab081dc622ba3c2f71bf55f1ba`. Code hardening is not production approval. Real Firebase/backend configuration, reviewed legal/support pages, Docker deployment verification and a green remote Verify Bloom run remain required. No deployment or main-branch merge was performed. Report finalized 2026-09-10; verification runs completed 2026-09-07.

## 2. What was fixed

- Regenerated the root lock using Node 22/npm 10 in an isolated directory. Added the missing nested Firebase AsyncStorage/idb peer dependencies without overriding Expo 51's root AsyncStorage.
- Pinned Meg's SQLite dependency to 12.11.1 after reproducing 13.0.3's upstream clean-install packaging issue. [Upstream report](https://github.com/WiseLibs/better-sqlite3/issues/1516)
- Added verified-UID Meg V2 account deletion, individual conversation deletion and data export routes. Deletion includes replay records, extracted memories and attributable metrics, waits for in-flight work, and clears response cache. Removed deferred post-response memory writes that could resurrect erased data; scoped cache keys by user/conversation/support mode.
- Sequenced account deletion, added explicit partial-failure messaging, bound local storage to the captured UID, and fenced late callbacks/pending sends across deletion and sign-out.
- Added password recovery with generic account-existence messaging; retained separate required and optional consents. Added Privacy Policy, Terms and Support routes/configuration slots with visibly unapproved templates.
- Distinguished liveness from readiness, required real production SQLite and non-temporary absolute storage configuration, tightened production dev-auth/CORS, added authenticated chat rate limiting and safe errors, removed raw storage exception logging, and made the container non-root.
- Kept Strength off by default and lazy-loaded its navigation component only when enabled. Preserved the earlier camera/pose/rep regression fixes; no native pose implementation added.
- Reconciled visible version with app.json (1.1.0). Removed verified-obsolete import payloads and three migration workflows. They remain recoverable from Git history. `verify.yml` remains canonical.
- Impeccable hardening guidance informed accessible loading/error states and existing-style auth/legal controls; no visual redesign or icon-system replacement.

## 3. Automated verification

Node 22.23.2, npm 10.9.9; Java 21 was downloaded into ignored local tooling for emulator tests. Final clean verification uses an isolated source copy at sibling `bloom-launch-clean`, with no node_modules or local .env copied, to avoid disrupting the existing user preview.

| Command/check | Actual result |
| --- | --- |
| Root `npm ci` | PASS: final isolated clean install, 1,821 packages |
| `npm test` | PASS: final clean run, 183 passed, zero failures/skips |
| `npm run typecheck` | PASS: final clean run |
| `npm run build:web -- --max-workers 2` | PASS: final clean web export to dist |
| `npm ci --prefix meg-engine-v2` | Passed with 12.11.1, including isolated clean copy |
| `npm test --prefix meg-engine-v2` | PASS: final clean run, 39 passed, zero failures/skips |
| `npm run benchmark --prefix meg-engine-v2` | 200 cases; intent 93%, route 99.5%; deterministic benchmark passed |
| `npm run test:rules` | PASS: final clean run, 11 passed, including all private path isolation checks |
| `node scripts/ui-smoke.cjs` with `BLOOM_TEST_URL=http://127.0.0.1:8082` | PASS: 320, 375, 430 dark, 768, 1280 and 1440 dark widths; reduced motion, navigation/profile/check-in checks; no Strength tab, camera or pose asset requests |
| `node scripts/launch-flows.cjs` with the same test URL | PASS: simulated 401/429/503/500 then successful retry with the same message ID; safe errors; offline draft recovery after reload; legal routes; visible failed-export state; logout and password-reset navigation |
| Source-to-clean-copy SHA-256 comparison | PASS: runtime, tests, scripts and package manifests match the verified copy |
| `git diff --check` | PASS; only Windows line-ending conversion warnings |
| `npm run check:release-config` | BLOCKED: six Firebase fields missing, localhost API URL, preview dev-auth flags, unconfigured policy/support URLs |
| `docker build -t bloom-launch-check .` | BLOCKED: Docker is not installed/on PATH |
| Production container authenticated chat/delete/restart | NOT RUN: Docker and production configuration unavailable |
| GitHub Verify Bloom | NOT VERIFIED GREEN: latest inspected main run 34048596592 failed; hardening changes are local, push/PR approval requested |

No existing behavioral test was removed. The ready-health test fixture now explicitly reports ready; additional tests assert not-ready 503 and unauthenticated deletion rejection. Public CI does not fake production credentials: it checks liveness and correctly unavailable readiness for its unconfigured container.

## 4. Authentication

Server tests verify UID extraction exclusively from verified tokens, rejection of missing/invalid/dev tokens for privacy operations and production bypass prevention even with differently cased/whitespace NODE_ENV values. Firebase verification now checks token revocation and production rejects Firebase Auth/Firestore emulator-host overrides. Password-recovery helper tests validate normalization, invalid input, generic success for absent accounts and safe transport errors. Browser tests cover reset-form navigation and keyboard focus, not actual reset-email delivery. Actual reset-email delivery, sign-up/profile provisioning and a complete real-Firebase browser account lifecycle remain unverified without the selected Firebase project/configuration. The optional model-improvement checkbox is not implied by required consent.

## 5. Data privacy and deletion

- **Delete one Meg conversation:** verified-UID backend deletion first, including messages, memories linked to the conversation, request/replay records and attributable metrics; then Firestore messages/parent and local history. Other accounts remain unchanged. Failed backend deletion is not reported as success.
- **Clear Meg history:** delete all authenticated user's active Meg V2 data, then Firestore Meg history, then local Meg conversations. Pending sends are cancelled/fenced.
- **Delete tracked Bloom data:** delete Meg backend/history first, then Firestore cycle/check-in/Strength and Diet records, then UID-scoped device data. The Firebase account/profile remains. Remote failure preserves local data and reports failure; some prior remote stages may already have completed.
- **Delete account:** reauthenticate → Meg backend → Firestore/app/profile → Firebase Auth → captured UID's device storage. Failure stops later stages. If Auth deletion succeeds but local cleanup fails, the signed-out UI explains that the account is gone and device storage still needs clearing.
- **JSON export:** includes the app's saved categories and authenticated Meg V2 server-owned records. Backend failure prevents a misleading complete JSON export. CSV/text remain explicitly narrower exports. CSV cells neutralize spreadsheet formula prefixes.

Deletion is idempotent. Tests exercise memory, JSON and actual SQLite persistence/restart, other-user protection, failures and in-flight work. Live database deletion is not a guarantee of physical deletion from historical backups/provider retention/another offline device. Legacy metrics without a surviving user-linked trace cannot be retrospectively attributed. Founder-approved retention and backup-restore procedures are required; see [production operations](PRODUCTION_OPERATIONS.md).

## 6. Meg

Meg V2 is the active engine.
Meg V3 was intentionally not modified or integrated.

No V3 branch was merged or altered. The authenticated Bloom JSON chat contract remains. The real V2 prompt/routing pipeline is tested with a fixture provider; browser tests exercise the client contract and failures with synthetic responses. No fake reply is substituted into the production app. Local/model fixture tests do not prove production provider billing, connectivity or Firebase permissions. Follow the activation checklist in [production operations](PRODUCTION_OPERATIONS.md) when keys/configuration are available.

## 7. Strength

Launch flag disabled: `EXPO_PUBLIC_BLOOM_STRENGTH=0` in the example and local preview configuration. Feature code/tests retained. Conditional module loading avoids initializing the feature when off; the launch browser regression asserts no Strength tab, camera calls or MediaPipe asset requests. Real-phone camera acceptance remains a future, separately enabled feature boundary.

## 8. Remaining manual device tests

Real iOS Safari/Android Chrome touch/keyboard/safe-area behavior, background/foreground handling, screen-reader navigation and real-device file sharing still require hardware. Native app-lock biometrics, notifications, secure storage and signed-build account removal require native devices/builds. Test representative older/low-memory phones and real connectivity transitions. Backend/Firebase tests blocked by missing configuration are release blockers, not claimed as inherently impossible to automate.

## 9. Store distribution blockers

**Web beta:** supply/verify Firebase project and deployed rules, production HTTPS backend/provider credentials/durable volume, reviewed legal/support pages, full real-account lifecycle/network acceptance, Docker smoke and remote green CI. Firestore residual schema/abuse risks are documented in [security review](FIRESTORE_SECURITY_REVIEW.json); no owner scoping was loosened. A complete sign-up-to-deletion browser flow and all requested network fault combinations have not yet been proven against a real deployment.

**App stores:** no SDK migration was performed. See [STORE_MIGRATION_PLAN.md](../STORE_MIGRATION_PLAN.md) for a separate incremental Expo/React Native migration and Apple/Google toolchain requirements. iOS `com.bloom.app`, Android `com.bloomhealth.app` are unchanged and need founder approval. Web checks are not native/store approval.

## 10. Files changed

The inventory includes preserved earlier Strength work as well as this hardening pass. Changes remain local and uncommitted. The ignored local `.env` also sets Strength to 0; credentials are not included. Removed migration payloads/workflows are recoverable from Git history.

Modified or added:

```text
.dockerignore
.env.example
.github/workflows/verify.yml
.nvmrc
Dockerfile
STORE_MIGRATION_PLAN.md
docs/FIRESTORE_SECURITY_REVIEW.json
docs/LAUNCH_READINESS.md
docs/PRODUCTION_OPERATIONS.md
docs/strength/PHONE_TESTING.md
meg-engine-v2/package.json
meg-engine-v2/package-lock.json
meg-engine-v2/src/cache/responseCache.js
meg-engine-v2/src/http/chatHandler.js
meg-engine-v2/src/memory/memoryStore.js
meg-engine-v2/src/persistence/sqlite.js
meg-engine-v2/src/reliability/rateLimiter.js
package.json
package-lock.json
scripts/check-release-config.cjs
scripts/launch-flows.cjs
scripts/strength-smoke.cjs
scripts/ui-smoke.cjs
server/all.test.js
server/checkinFlow.test.js
server/firebaseAdmin.js
server/firebaseAuth.js
server/firestore.rules.test.js
server/index.js
server/megClient.test.js
server/megDataLifecycle.test.js
server/megV2Bridge.js
server/megV2Bridge.test.js
server/mobileStorage.test.js
server/strengthCamera.test.js
server/strengthEngine.test.js
src/context/AppContext.js
src/context/AuthContext.js
src/features/strength/README.md
src/features/strength/TrackedStrengthScreen.web.js
src/features/strength/components/CameraStage.web.js
src/features/strength/components/PoseOverlay.web.js
src/features/strength/constants.js
src/features/strength/engine/jointAngles.js
src/features/strength/engine/poseTransform.js
src/features/strength/engine/repStateMachine.js
src/features/strength/services/cameraSession.js
src/features/strength/services/PoseDetector.web.js
src/features/strength/useStrengthSession.web.js
src/navigation/MainTabNavigator.js
src/navigation/RootNavigator.js
src/screens/AuthScreen.js
src/screens/ExportDataScreen.js
src/screens/LegalScreen.js
src/screens/MegScreen.js
src/screens/ProfileScreen.js
src/services/accountLifecycle.js
src/services/accountWork.js
src/services/export.js
src/services/meg.js
src/services/megAccountData.js
src/services/megData.js
src/services/passwordRecovery.js
src/services/storage.js
```

Deleted (29 obsolete files):

```text
.github/workflows/build-clean-bloom.yml
.github/workflows/materialize-final5-safe.yml
.github/workflows/promote-new-bloom.yml
.new-bloom-patch/READY
.new-bloom-patch/part-00
.new-bloom-patch/part-01
.new-bloom-patch/part-02
.new-bloom-patch/part-03
.new-bloom-patch/part-04
.new-bloom-patch/part-05
.new-bloom-patch/part-06
.new-bloom-patch/part-07
.new-bloom-patch/part-08
.new-bloom-patch/part-09
.new-bloom-patch/part-10
.new-bloom-patch/part-11
.strength-import/chunk-00.b64
.strength-import/core-00.b64
.strength-v2-source/part00
.strength-v2-source/part01
.strength-v2-source/part02
.strength-v2-source/part03
.strength-v2-source/part04
.strength-v2-source/part05
.strength-v2-source/part06
.strength-v2-source/part07
.strength-v2-source/part08
.strength-v2-source/part09
.strength-v2-source/part10
```
