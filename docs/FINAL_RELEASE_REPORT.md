# Bloom final beta engineering report

Public release is blocked. This branch prepares a private test candidate and review material; no merge, public deployment, legal publication or store submission has occurred.

Repository: https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3  
Review PR: https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3/pull/13  
Integration branch: `fix/bloom-final-production-hardening`  
Engineering code baseline for this report: `55c1cc750ace111b6d61ef8ded64b39136acf716`, including the production container packaging fix. The final report commit changes documentation only. The PR description and build records give the exact validated final head and artifact SHA; an intermediate artifact must not be substituted.

## Milestones

| Milestone | Implementation | Automated tests | External/manual verification | Status |
|---|---|---|---|---|
| 0 — Baseline | Compared main/release branches/PR12; preserved its valid fixes in isolated checkout | Clean reproducible baseline captured | None required | VERIFIED |
| 1 — Meg | Provider compatibility, fail-closed readiness, deadline, replay/feedback, safety/UID persistence and privacy contract gate | Backend/engine regressions, SQLite restart, synthetic outages and browser retries | No supported provider key; legacy hosted service is blocked before private requests; genuine reply/latency need approved deployment | BLOCKED — EXTERNAL DEPENDENCY |
| 2 — Expo | Current SDK57 package matrix and regenerated lockfiles | Clean installs, Doctor21/21, type/web and native compilation | Device behavior belongs to manual checks | VERIFIED |
| 3 — Firebase/privacy | Memory-off retrieval/extraction enforced; stale-write fencing; UID deletion barrier; export/deletion and fresh-signup startup fixed | Rules16/16, SDK account flow, real Firebase browser signup/onboarding/tours, isolation/offline tests | Existing live rules reject the new deletion barrier; candidate rules/backend deployment not approved | BLOCKED — EXTERNAL DEPENDENCY |
| 4 — Native release | Android1.1.0 code6 / iOS build4; lifecycle/app lock/biometric fixes; signed internal Android and unsigned iOS build workflow | Both platform compilation and built-model checks; arm64 ELF alignment | Physical devices pending; EAS has no suitable existing iOS internal-distribution credentials | BLOCKED — EXTERNAL DEPENDENCY |
| 5 — Legal/support | Seven full review drafts, links and required deletion URL; approval registry; no invented identity/contact/periods | Publication/configuration gates and synthetic approved registry tests | Publisher, contacts, provider inventory, retention/deletion, eligibility/jurisdiction and final legal approval pending | BLOCKED — EXTERNAL DEPENDENCY |
| 6 — Strength | Real on-device CameraX/AVFoundation+MediaPipe33 implementation; framing/rep engine; scalar summaries; guided retained | Pose/session/UI permission tests, native builds, synthetic browser tracking/cleanup | Native accuracy, thermal performance and hardware recovery pending; public native flag remains off | IMPLEMENTED — AWAITING MANUAL TEST |
| 7 — Reminders | Serialized account ownership, startup/foreground reconciliation, cancellation, rollback and local wall-clock triggers | Permission/channel ordering, races, denial, timezone, duplicate/cancellation and persistence regressions | Physical delivery/reboot/focus/battery/timezone travel pending | IMPLEMENTED — AWAITING MANUAL TEST |
| 8 — Regression | Root/engine/rules/SDK/browser/web/container/native validation | Final evidence linked in the PR; no failing tests removed or checks disabled | Genuine provider and phone acceptance remain separate | VERIFIED |
| 9 — Review candidate | Separate PR, commit history, source/lockfiles, artifacts, configuration/legal/checklist documents | Exact-SHA CI and build records linked in PR | Founder decides legal/signing/service access and final release | VERIFIED |

## Results and scope

- **30 concrete fixes**, listed with regressions in [FINAL_ISSUE_LEDGER.md](FINAL_ISSUE_LEDGER.md). Native tracking is an additional gated capability, not a claim of verified physical accuracy.
- **426 Bloom tests +50 Meg tests +16 Firestore rule tests =492 passing test cases, zero final failures.** The starting PR12 baseline had430 cases; the net increase is62. The six-stage SDK account driver and browser flows are additional integration evidence.
- Clean Node22/npm10 root and engine installs passed. Doctor21/21, typecheck, native configuration and web export passed. CI also builds/smokes the production container with fail-closed readiness. Its image now copies the shared contract explicitly and loads the packaged server dependency graph at build time.
- Benchmark:200 deterministic cases, route accuracy100%, intent accuracy93.5%, safety routing20/20. This is a routing benchmark, not a medical or production-readiness score.
- Browser evidence: synthetic401/429/500/503, stable retry IDs, offline queue/reload, legal routes, visible export failure, logout/reset navigation; six responsive viewports; Strength framing/overlay/rotation/speech controls/pause/guided/cleanup; actual disposable Firebase signup, onboarding persistence, overview and contextual tours. Browser fixtures do not certify real camera accuracy or audible phone speech.
- Runtime dependency audit:0 high/0 critical,17 moderate/1 low. Full root tree including tools:0 high/0 critical,26 moderate/1 low. Standalone Meg tree:0 vulnerabilities. [Dependency review](DEPENDENCY_SECURITY_REVIEW.md) documents retained upstream compatibility risks; this is not a claim of zero vulnerabilities in all SDKs.
- Candidate rules were not deployed. Live signup/profile/sync/login/isolation/offline checks passed; full live deletion is blocked by old deployed rules. Every disposable QA account/profile was removed; no real user health data was read.

## Artifacts and exact validation

Use the download/build links in the PR description for the final exact SHA. Download the signed **native-qa internal Android APK** for device testing. It has development authentication disabled and uses the approved `bloom-mvp-14b2e` Firebase target. The camera feature is explicitly labeled experimental and can be bypassed with Continue guided. Normal preview and production native camera flags are0, and public release validation rejects native tracking until acceptance is reviewed.

The unsigned physical-device iOS `Bloom.app` artifact proves compilation and correct model packaging. It cannot be installed normally without signing. EAS internal iOS distribution was attempted with existing credentials only and failed because no suitable credentials were available. No Apple assets/devices were created and no TestFlight/store upload was performed.

The candidate checks the public Meg V2 capability contract before acquiring a token or sending messages/context/history/export/deletion. The currently hosted older endpoint is rejected. Do not treat an old backend response or intermediate APK as provider acceptance.

Android CI checks the exact bundled pose model and16KB ELF load alignment (23 arm64 libraries inspected). iOS CI compares the actual app-bundled model with source, closing the empty-bundle defect that compilation alone missed. These checks do not replace a16KB device test or physical camera validation.

## Owner-owned release blockers

1. Finalize and approve publisher/legal identity, monitored support/privacy contact and public support/deletion intake, provider inventory and processing regions, retention/deletion/backup periods, eligibility/jurisdiction and effective date. All seven [legal drafts](legal/README.md) remain unapproved. Public gate currently rejects16 unresolved publication requirements.
2. Obtain one supported Gemini/Groq/OpenRouter server credential through the provider console and approve secure server-side secret placement. Do not put it in EXPO_PUBLIC variables or paste it into chat. Codex can configure and validate it after access is provided.
3. Approve deployment of the reviewed candidate backend and rules to the confirmed Firebase project. Use durable supported SQLite storage, a tested backup/deletion schedule and an appropriate single-writer deployment. The existing Cloud Run service has not been replaced or represented as durable/compatible. Codex performs deployment and genuine-provider/deletion rehearsal after approval; the founder does not edit code or run commands.
4. Provide/authorize Apple Developer signing ownership and suitable internal distribution provisioning/device access if iOS installation is required. Codex handles configuration/builds after access is available.
5. Perform the [device checklist](FOUNDER_DEVICE_CHECKLIST.md) and give results. Native camera accuracy, real reminder delivery, app lifecycle, exports, signing/device compatibility and the final release decision require owner/device acceptance.

## Engineering configuration

- Authoritative beta Firebase target: `bloom-mvp-14b2e`. The separately connected `bloom-hackathon` project was not substituted or mutated globally.
- EAS project: `94819776-182f-45d0-bfb1-6c8cc06ea821`. Identifiers retained: Android `com.bloomhealth.app`, iOS `com.bloom.app`.
- Server provider/Admin credentials are server-side secrets. The client receives only Firebase public configuration and an HTTPS backend URL. Production disables developer auth and requires approved legal metadata/URLs. The public contract probe sends no bearer token or private content.
- Legal approval is represented in `config/legal-publication.json`; URLs alone cannot imply approval. Account deletion needs its own functional approved public request URL. Seven in-app drafts are reachable from legal/support screens and never open unapproved external pages.
- Firestore `accountDeletions/{uid}` contains an immutable UID-scoped request timestamp. It blocks stale devices from recreating deleted records. Receipt cleanup/retention, backups and third-party logs still need approved operational policies; active-store deletion is not a promise of immediate erasure everywhere.
- Native local module sources are in `modules/bloom-pose`. MediaPipe0.10.35 and CameraX1.4.2 were verified in their package registries and compiled. No frames/raw landmarks are intentionally saved or uploaded by the tracking pipeline. [Native QA details](strength/NATIVE_POSE_QA.md).
- [Reminder validation](REMINDERS_VALIDATION.md) distinguishes local scheduling from remote push. No remote push-token delivery service is advertised.

## Local review

The isolated synthetic development app runs at **http://localhost:8085** with loopback backend3005. It has no live model provider and uses synthetic developer data. The user’s original workspace/services and separate cinematic task were not modified. The additional real-Firebase browser QA server is stopped after its disposable data is removed.

## Changed files

The integration changes126 files relative to the preserved PR12 head, including this report and the [complete file index](FINAL_CHANGED_FILES.md). The exact reviewed diff and file list are also available in PR13. Primary areas: Meg server/client/SQLite/providers; Expo package lockfiles; Auth/App contexts and Firestore rules; app-lock lifecycle; native pose module/session/UI; notification coordinator; seven legal drafts/publication gates; regression scripts/tests and release documentation. No credentials, environment files, QA cleanup journals or health records are included in the commit.
