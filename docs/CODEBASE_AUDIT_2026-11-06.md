# BLOOM code audit and cleanup — 6 November 2026

The cleanup candidate preserves the latest hardening work, fixes a delivery-location cache leak, reconnects omitted tests, and removes verified unused code. Public release still needs the external acceptance work listed below.

## Baseline and scope

- Repository: `kandukurinomusubramanyachary-ai/BLOOMv3`.
- Cleanup branch: `chore/bloom-audit-cleanup-20261106`.
- Baseline: `7b60c52cd7b6d88c6d73516a7f92ae2399860b00`, the head of PR #13, `fix/bloom-final-production-hardening`.
- `main` was `15241e53e14a783dba5736e314c4a2525f8d77f5`. Starting cleanup there would omit 29 hardening commits.
- The audit assumes a private beta, owner-scoped Firebase data, and the documented single-writer SQLite deployment. It does not certify a multi-replica deployment.
- Source inspection covered startup/navigation, account and storage guards, delivery discovery, reminder coordination, and Strength entry points/runtime loading. Existing regression tests cover additional flows. This was not a line-by-line review of every large screen, native implementation, or historical commit.

## Workflow and selected guidance

All four requested repositories were cloned outside the product checkout. No installer, lifecycle hook, global configuration, or copied skill collection was added to BLOOM.

| Requested source and pinned revision | Guidance selected | Application to BLOOM |
| --- | --- | --- |
| [mattpocock/skills](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d) | Debugging feedback loops, module design, standards/spec review | Reproduce defects before changing behavior; retain useful interfaces; review the final diff against the cleanup scope and existing conventions. |
| [affaan-m/ECC](https://github.com/affaan-m/ECC/tree/b38be6a7f6350964d59328b52f0624e1d1d552d1) | Refactor cleanup and verification loop | Establish a passing baseline, treat detector results as candidates, verify each file/artifact removal, and report checks separately from device acceptance. |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills/tree/2c606141936f1eeef17fa3043a72095b4765b9c2) | Explicit assumptions, small changes, verifiable goals | Interpret “undercarriage code” as dead/duplicate/abandoned code; avoid speculative features or a framework rewrite. |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail/tree/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846) | Correctness and privacy before code reduction | Remove shared cache state instead of adding another account/cache abstraction. Preserve validation, accessibility, error handling, and real calibration. |

The repeatable workflow is:

1. **Inventory refs and work in isolation.** Capture the default branch, open PRs, exact heads, and ancestry before selecting the base. Output: baseline and branch ledger.
2. **Map the running product.** Follow entry points, platform variants, navigation, account boundaries, storage, API calls, and background work. Output: runtime map and protected runtime assets.
3. **Run the baseline.** Install both lockfiles; execute the existing app/engine tests, typecheck, web export, configuration checks, rules tests, and account emulator. Keep failures visible.
4. **Investigate concrete defects.** Build a failing case at the caller-facing interface. Preserve it as a regression when fixing the root cause. Do not list hypothetical bugs without a trigger and consequence.
5. **Identify removal candidates.** Combine a platform-aware local import graph, Knip, Babel binding analysis, and whole-tree literal/name searches. Treat config, platform files, tests, and dynamic assets as higher-risk candidates.
6. **Remove a complete unused unit.** Confirm no import, dynamic/string/config/test consumer or build requirement. Run the full app suite after each deleted source file and after the upload-fragment artifact. Restore the unit if a check fails.
7. **Simplify remaining dead declarations.** Remove unreferenced import bindings, old aliases, and unused configuration objects without changing styling, native permission handling, or calibration behavior. Verify the affected suites and build.
8. **Reconcile dependencies.** Remove a direct dependency only when the runtime does not import or generate from it. Regenerate its lockfile with npm; retain lazy-loaded packages and native peers.
9. **Prepare branch cleanup.** Delete only after checking current heads, ancestry, open PRs, CI/release references, and recovery commits. Preserve unique work. Remote deletion must be independently verified.
10. **Review the candidate.** Check standards and requested scope separately; trace callers beyond the diff. Resolve concrete findings before publishing the review branch.
11. **Report evidence accurately.** Distinguish automated checks, browser checks, native compilation, device acceptance, and deployment. A local test pass does not establish provider or phone acceptance.

## Runtime map

| Flow | Active implementation |
| --- | --- |
| Bootstrap, failure recovery, auth gate | `index.js`, `App.js`, `src/context/AuthContext.js` |
| App/account state and mutation fences | `src/context/AppContext.js`, `src/services/accountWork.js`, `storage.js`, `userData.js` |
| Navigation and onboarding | `src/navigation/RootNavigator.js`, `MainTabNavigator.js`, `src/features/onboardingV3/OnboardingV3Screen.js` |
| Daily tracking and reports | Today, Timeline, DailyCheckIn, DoctorReport screens and their service modules |
| Meg | `src/services/meg.js` → authenticated `server/index.js` → `server/megV2Bridge.js` → `meg-engine-v2` |
| Strength | Platform-selected `StrengthScreen`/`TrackedStrengthScreen`, shared `StrengthExperience`, guided session player, native `modules/bloom-pose` |
| Web pose runtime | `PoseDetector.web.js` dynamically loads `public/strength/vision_bundle.js`, WASM variants, and the model |
| Reminders | `reminderCoordinatorCore.js`, `notifications.js`, `waterReminders.js` |
| Delivery discovery | `DietDeliveryDiscovery.js`, `foodDelivery/index.js`, Swiggy adapter, validated Swiggy/Zomato external links |

## Findings and changes

### 1. Delivery availability could reuse another account’s location — fixed

**What this is:** Food search uses an authenticated backend to find items for a delivery location.

**Problem:** The module-wide cache key contained provider, query, and address-consent state, but no account identity. Searching for the same food after an account switch could return the previous account’s nearby restaurants for two minutes. The new regression failed with account A’s result where account B’s result was required.

**Fix:** Delete the global response cache and in-flight request map. Results, consent, and abort signals now stay with each request. The UI retains its existing `searchingRef` guard against repeated taps in the same component. Different callers no longer share a cancellation signal.

**If omitted:** A later account can see location-derived results from an earlier account, and an aborted caller can interrupt another search. Removing cross-component caching can increase requests when separate screens make the same search; authorized search is still unavailable until its backend is configured.

### 2. The normal test command omitted onboarding/tour tests — fixed

**What this is:** `npm test` runs `server/all.test.js`; two test files under `tests/` were not included.

**Problem:** Eleven test cases were silently excluded. Running them separately found four failures caused by stale expectations: fabricated `Friend` names, an old priority order, and source-text assertions for status objects now created by `createTourRecord`.

**Fix:** Include both files in the normal test command. Update persona expectations to the existing no-fabricated-name and deterministic-priority contracts already covered by `server/onboardingTour.test.js`. Remove two obsolete status-object source assertions; the existing behavioral tests still assert that completed and skipped records stay handled. No product behavior was changed to satisfy the stale tests.

**If omitted:** The normal green result would keep excluding these cases. The final root suite has 438 cases: the original 426, eleven reconnected cases, and one additional account-switch regression. The cancellation regression replaces the old shared-request expectation.

### 3. Unused product files and transfer fragments remained tracked — removed

**What this is:** Old UI experiments, a replaced manual Strength screen, a duplicate statistics module, an unused onboarding barrel, an unavailable provider stub, and an old source-transfer payload.

**Problem:** These files have no running-product consumer. The upload fragments also form an incomplete base64/gzip payload, not a runtime asset.

**Fix:** Remove the units in the ledger below. The full root suite passed after every source-file removal and after the transfer artifact removal. A conservative import graph went from 170 source files with six unreachable candidates to 164/164 reachable source files. This does not prove every export inside a reachable file is necessary.

**If omitted:** Future changes must keep distinguishing obsolete implementations from the active ones.

### 4. A second MediaPipe browser distribution was installed but unused — removed

**What this is:** Direct dependency `@mediapipe/tasks-vision@1.0.1`.

**Problem:** BLOOM loads its checked-in web runtime from `public/strength`; no application, test, script, or native build imports this npm package. Its installed directory occupied approximately 36 MiB locally.

**Fix:** Remove the direct dependency and regenerate `package-lock.json`. npm also removed an already-marked extraneous `google-logging-utils` entry. Keep all checked-in web pose assets and the native module/model.

**If omitted:** Clean installs keep downloading an unused distribution. The measured saving concerns installed dependencies, not APK size or the already tree-shaken web bundle.

### 5. Branch names no longer distinguish active from incorporated work — cleanup prepared

**What this is:** Fourteen remote branches at audit time.

**Problem:** Several obsolete feature/snapshot refs coexist with active unmerged fixes and unique feature work.

**Fix:** Record the exact refs below. Every deletion candidate is already an ancestor of `main`; its commits remain recoverable there. Keep open PR heads, the workflow-referenced release branch, and unique work.

**Status:** No remote branch was deleted. The linked GitHub tools expose no branch-delete operation; Git CLI write access is unauthenticated. A browser attempt did not change the branch, and a fresh GitHub API read confirmed all original refs remain.

### 6. Final Expo validation found a newer SDK patch set — aligned

The first Doctor run passed 21 checks. A later run reported eight patch-version mismatches. The upgrade command timed out contacting Expo; the exact versions reported by Doctor were then installed together through npm, with the lockfile regenerated. No dependency check was excluded or disabled.

| Package | Previous declaration | Updated declaration |
| --- | --- | --- |
| `expo` | `~57.0.31` | `~57.0.32` |
| `@expo/metro-runtime` | `~57.0.17` | `~57.0.18` |
| `expo-asset` | `~57.0.20` | `~57.0.21` |
| `expo-build-properties` | `~57.0.22` | `~57.0.23` |
| `expo-constants` | `~57.0.22` | `~57.0.23` |
| `expo-notifications` | `~57.0.24` | `~57.0.25` |
| `expo-sharing` | `~57.0.24` | `~57.0.25` |
| `expo-splash-screen` | `~57.0.10` | `~57.0.11` |

Native compilation and physical acceptance must use this updated candidate; older PR #13 artifacts do not validate the new patch set.

The clean-install test run caught the CLI's move to `devtools/` and `mcp/`, JSON-schema plugin validation, and explicit Zod injection for MCP schemas. The compatibility regression now exercises the real plugin constructor and schema validator, still rejects invalid plugin/input data, and adds a malformed-output rejection. The security override was retained.

## Removal ledger

| Removed unit | Evidence / retained replacement |
| --- | --- |
| `src/components/FeedbackStates.js` | No import, route, config, or test consumer. Screens use their own active feedback UI; obsolete prototype documentation reference updated. |
| `src/components/StateChip.js` | No consumer anywhere in the tracked tree. |
| `src/features/onboardingV3/index.js` | Unused barrel; navigation imports the actual screen directly. |
| `src/features/strength/StrengthUnsupportedScreen.js` | Unreferenced old manual practice flow. The active guided player and native/web tracking remain. |
| `src/features/strength/data/strengthStats.js` | Unreferenced old aggregation; the active experience uses tested `sessionHistory.js`. |
| `src/services/foodDelivery/providers/zomatoProvider.js` | Unused always-unconfigured stub. Real Zomato external-search support remains in `openDeliveryProvider.js`. |
| `.strength-upload/part-00` through `part-15` | Sixteen obsolete transfer chunks, 127,999 bytes; referenced only by exclusion rules. Not pose runtime files. |
| `SPACING`, `FOCUS_RING`, old Strength flag/calibration-label array, unused tour aliases | Whole-tree checks found no consumer. Actual layout/focus styles, feature flags, and calibration engines remain. |
| 18 unused named imports | Babel scope analysis; remaining imports preserve each module’s execution and styles. |
| Shared delivery caches and unused npm distribution | Findings 1 and 4 above. |

## Branch ledger

Before any later deletion, re-read the remote and require the recorded head to match. The commits below are recovery references, not a request to force-push or rewrite history.

| Branch | Recorded head | Decision |
| --- | --- | --- |
| `feat/bloom-analytics` | `bb596a3e8e88614e841b2d95f1167ca096700f46` | Delete candidate; incorporated in main. |
| `feat/onboarding-v3-module` | `b752a1bee98396a1a0c185e53942cb049aabedb9` | Delete candidate; merged PR #10. |
| `feat/refined-bloom-pr` | `ad3e5464d96467f6dc7101e54df069c13dbe28ba` | Delete candidate; incorporated in main. |
| `feat/strength-v3-refined` | `b60e105fae593f4048a0953f559f9cc9a3dd1f71` | Delete candidate; incorporated in main. |
| `integration/bloom-v3-clean` | `6130fb4580b6fdf79519afc4eb13e091a8470a61` | Delete candidate; incorporated in main. |
| `release/bloom-v3-prelaunch` | `8aff811abe52480d9ee456c4b46493a255a86041` | Delete candidate; old incorporated checkpoint, no workflow reference found. |
| `release/v3-mobile-test-ready` | `b752a1bee98396a1a0c185e53942cb049aabedb9` | Delete candidate; same merged onboarding head; existing mobile-test-ready tag retained. |
| `snapshot/bloom-v3-current-2026-09-15` | `bf98d6405a05467df1b272c50b9c0ac75258bbe0` | Delete candidate; incorporated checkpoint. |
| `main` | `15241e53e14a783dba5736e314c4a2525f8d77f5` | Keep default branch. |
| `fix/bloom-final-production-hardening` | `7b60c52cd7b6d88c6d73516a7f92ae2399860b00` | Keep PR #13 and cleanup baseline. |
| `fix/prelaunch-safe-quality-20261101` | `01a40510ae706424aebd2155878f7cd39b30db3f` | Keep while PR #12 is open; contained in PR #13, not in main. |
| `release/bloom-v3` | `4388e2c76f170fd3d5525131fb41f29c29503a03` | Keep; CI explicitly targets this release branch. |
| `feat/bloom-site-assets-20-20261024` | `0909fcbb87a5d1b73966524f7936208eb0dd3913` | Keep PR #11; two commits outside the hardening baseline. |
| `feat/refined-bloom-full` | `5017b8bec0c7066a0660d2821d56f457bbf50743` | Keep; 113 commits outside the hardening baseline. Needs a separate content review. |

## Verification

Local runtime: Node `24.22.1`, npm `11.9.0`. Existing CI remains configured for Node 22/npm 10.9.9; a local Node 24 result is not a new Node 22 CI result.

| Check | Result |
| --- | --- |
| Clean root and engine installs | Passed; root clean install repeated after SDK patch alignment. |
| Original root suite before edits | 426/426 passed. |
| Separately discovered onboarding/tour suite before updates | 7 passed, 4 stale expectations failed; all eleven are now included. |
| Final `npm test` | 438/438 passed, zero skipped. |
| `npm test --prefix meg-engine-v2` | 50/50 passed. |
| `npm run test:rules` | 16/16 passed in disposable emulator. |
| `npm run test:accounts` | Six emulator lifecycle scenarios passed, including isolation, offline/reconnect, export and deletion. |
| `npm run typecheck` | Passed. |
| `npm run build:web` | Passed after code/package cleanup; checked-in Strength assets retained. |
| `npm run check:native-config` | Passed. |
| Expo Doctor | 21/21 passed. |
| Deterministic Meg benchmark | 200 cases executed; routing/safety benchmark, not live provider acceptance. |
| Root dependency advisory scan | 0 critical, 0 high, 15 moderate, 0 low after SDK patch alignment. Existing advisory review remains relevant. |
| Deletion loop | Full root suite passed after each of six source deletions and after the transfer artifact. |
| Static analysis | All 164 remaining source files reachable in the conservative multi-platform graph. Manual validation rejected native files, lazy clipboard, rules tooling and browser QA as detector false positives. |
| Browser interaction checks | Not completed. Playwright browser download returned an invalid archive; installed Chromium could not start because the executor denied its socket operation. No passing browser or screenshot result is claimed. |
| Android/iOS compilation, signed installation, real camera/reminder behavior | Not repeated in this cleanup. Prior PR #13 evidence remains historical evidence for its own exact SHA. |
| Production container | Not repeated; Docker is unavailable in this executor. |
| Production deployment / live model response | Not performed. |

The large `bloom-analytics` prototype/design material, manual QA scripts, legal drafts, native sources, security tests, dynamic pose assets and active Diet functionality were retained. Being absent from the application import graph does not make documentation, standalone tools, or public runtime assets dead code.

## Review

### Standards

Read-only review found no introduced documented-standard breach or concrete correctness/security regression. It traced the delivery caller and cancellation guard, test aggregation and unchanged onboarding contracts, removed-file consumers, dynamic Strength runtime, and Expo lock entries. No actionable new code smell was reported. The review itself did not run tests; executed checks are reported above.

### Spec

Read-only review found no introduced semantic defect or unrequested feature expansion. Persona test edits agree with the pre-existing no-fabricated-name and fixed-priority contracts. Tour status behavior remains covered. The eight requested remote branch deletions remain incomplete and are explicitly recorded as a deliverable blocker.

Review summary: standards — zero findings; spec — zero introduced defects, one outstanding remote-deletion requirement. Browser, native/device, and deployment limits remain as recorded above.

## Remaining acceptance work

These are existing release dependencies, not solved by deleting files:

1. Configure an authorized server-side Meg provider credential and verify genuine responses, latency, failure handling and durable storage on the reviewed backend.
2. Deploy the reviewed Firebase deletion-barrier rules/backend only under the established deployment authorization, then verify real account lifecycle behavior. Emulator success does not certify the deployed rules.
3. Complete publisher/support/deletion intake, provider/retention decisions and legal approval; the publication gates remain intact.
4. Validate the installed Android build, Apple signing/distribution, native tracking accuracy/lifecycle and notification delivery on physical devices.
5. Execute and verify the eight recorded remote branch deletions when authenticated branch-management access is available. Preserve the six active/unique refs above and the cleanup branch until its PR is resolved.
