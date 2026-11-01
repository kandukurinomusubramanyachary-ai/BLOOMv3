# Final hardening evidence ? 2026-11-01

This is an engineering record, not release approval. The integration branch is
`fix/bloom-final-production-hardening`, isolated under the original workspace's
ignored `.expo/final-hardening` directory. Original local changes, the website
PR and cinematic work are untouched. No public deployment or store submission
has been made.

## Baseline and completed checkpoints

- PR #12 baseline: `01a40510ae706424aebd2155878f7cd39b30db3f`.
- Baseline: clean npm installs with Node 22.23.2/npm 10.9.9; Bloom 373/373,
  Meg 43/43, rules 14/14, typecheck, native config, benchmark and web export passed.
  Doctor failed only the ten current SDK patch mismatches.
- Meg checkpoint `a6041f3`: Bloom 379/379 and Meg 47/47. Synthetic fixtures
  exercise the real routing/safety/storage code; no fixture is a production
  provider. Restart replay preserves the assistant ID; feedback removal and
  restoration are tested on real SQLite; ordinary history excludes memories,
  request hashes and metrics. Missing keys plus disabled Ollama fail readiness.
- SDK checkpoint `88e6327`: Expo 57.0.31 companion matrix, clean npm ci,
  Doctor 21/21, typecheck, Bloom 379/379, web export and Android prebuild passed.
  iOS project generation/compilation is assigned to the existing macOS CI job,
  because Expo deliberately does not generate iOS projects on Windows.
- Privacy checkpoint before the deletion receipt: Bloom 386/386 and Meg 47/47.
  Tests cover pending-write draining, stale profile callbacks and effective
  backend memory opt-out, including separating the response cache by that choice.
- Deletion receipt rules: 16/16 emulator tests. Owner cleanup remains possible;
  creates and updates are denied after the receipt, including after profile
  removal. The receipt requires recent owner authentication and cannot be
  changed or removed by clients. Recovery can sign in without recreating an
  already-removed profile.
- Full Firebase SDK account driver passed in Auth/Firestore emulators with the
  receipt: signup/profile, owner sync, login restoration, isolation, offline
  cache/reconnect and Firestore/Auth deletion. The driver imports the actual
  application profile/data services. Initial cold emulator attempts returned
  `unavailable`; subsequent complete runs passed. The runner has a deadline,
  loopback proxy exclusions and strips inherited debug flags.

## Owner decisions and live checks

The owner confirmed `bloom-mvp-14b2e` (existing EAS preview) as the final beta
Firebase target. The workspace/connected Firebase tool's `bloom-hackathon`
configuration is a different project and must not be substituted into this RC.
An ignored QA configuration was obtained from existing public EAS values.
The existing preview backend reports `openai-compatible`, rather than the
candidate's Meg V2 health contract. It has not been modified or redeployed.

Against the confirmed live Firebase project, disposable reserved-domain QA
identities passed signup/profile creation, check-in synchronization, fresh
login restoration, unauthorized read/write rejection and offline/reconnect.
The new deletion barrier was denied by the older deployed rules. The driver
then removed its test documents and Auth accounts; its cleanup journal is absent.
This is partial live evidence, not a passing complete account-deletion rehearsal.
No real user health records were accessed.

The owner has no Gemini/Groq/OpenRouter server key yet. A genuine supported
cloud-provider response and production latency therefore remain unverified.
`npm run check:meg-live` is ready to execute with a dedicated QA token or QA
credentials after the backend/configuration is approved. It requires an actual
supported cloud provider, checks replay/history/feedback, and reports timing
without printing conversation content or credentials.

Operating country: India. Publisher identity, support contact/URL, retention
and deletion periods remain pending owner/legal confirmation. Public release
must remain blocked until those values and legal copy are approved.

## Dependency security work in progress

The first runtime-tree audit reported eight high and one critical advisory
nodes. Supported-range updates patched body-parser, shell-quote and re2js.
Firestore's stale grpc range needs a scoped patched 1.x transport; actual SDK
and emulator RPC tests passed with 1.14.6. Expo CLI's inspected Zod consumers
use object/string/enum/array schemas compatible with the patched release; tests
exercise the actual plugin schemas and MCP schema builder. A freshly generated
lockfile and complete verification are required before accepting that override.

Primary advisory references:
- [grpc certificate authorization](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- [shell quoting injection](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)
- [body-parser compressed request handling](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [re2js matching exhaustion](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
- [Zod collection validation exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

## Deletion and retention boundary

The new `accountDeletions/{uid}` receipt stores only an immutable request
 timestamp, without email or health fields. It prevents stale sessions from
recreating deleted private data. Its retention/cleanup policy needs legal and
operational approval; no retention period is invented here. Active data removal
is separate from provider logs, backups, other offline devices and any legal
retention obligation. Deployment of these strengthened rules is pending approval.

## Security dependency checkpoint

A clean lockfile regeneration and npm ci passed (1,212 root packages). The
fresh audit reports zero high and zero critical nodes, with 17 moderate and one
low node retained for review. The actual patched Expo CLI plugin/MCP schemas,
Firestore grpc resolution, multipart transport and shell quoting contracts pass.
Doctor passes 21/21 and typecheck passes. The full checkpoint passed Bloom
389/389 and Meg 49/49. Subsequent conversation-key isolation work passed all
10 focused server cases and four SQLite cases, including legacy migration; the
final full suite will be repeated after all milestones.

Conversation metadata is now scoped by UID and conversation ID in memory, JSON
and SQLite. The SQLite migration is transactional and recovers metadata for
previously colliding owner records. A separate regression verifies that crisis
safety flags and the assistant reply ID survive history/replay and restart,
including repair of metadata written by the former implementation. Provider
retries/fallbacks now share a deadline below the client wait budget. Standalone
production Meg refuses to start with API-key authentication disabled.

## Final integration follow-up

All 420 Bloom tests now pass locally, including actual native React permission UI tests and the null-profile startup regression. Meg passes 50/50; Firestore rules pass 16/16. The new SDK account driver passes all six stages. Doctor21/21, typecheck and web export pass. The 200-case benchmark reports route accuracy100%, intent accuracy93.5% and20/20 safety routing, rather than a fabricated perfect intent score.

The real Firebase browser signup found a null profile display-name crash missed by the synthetic developer session; it is fixed and regression-tested. Subsequent disposable-account signup, full onboarding completion, overview tour, Learn Bloom and contextual Strength guides pass. All browser QA profiles and logins were removed. No real health records were accessed.

Android and iOS compilation passed with the new MediaPipe module. Artifact inspection initially found an empty iOS model bundle despite a successful compile. Model resources now live inside the pod root, and CI compares the built iOS model with the source. Android CI verifies the bundled model and16KB ELF alignment;23 arm64 libraries passed. Native tracking stays off in public profiles and requires real-device acceptance. The iOS permission-dialog lifecycle race is covered by helper and actual React UI tests.

The browser launch suite passes synthetic401/429/500/503 recovery, stable retry identity, offline queue restoration, legal routes, export failure, logout and password-recovery navigation. The responsive suite passes six viewports, including dark mode, Timeline/year calendar and check-in steps. Strength browser fixtures pass framing, ten portrait/landscape layouts, rotation, overlay alignment, speech controls, pause/resume, guided fallback and camera cleanup. Fixtures are synthetic and do not certify physical tracking accuracy or audible speech.

Final immutable source/build identifiers, artifact links and external blockers are recorded in FINAL_RELEASE_REPORT.md and PR13. Public release validation remains blocked by16 missing/unapproved legal requirements. No public deployment, merge or store submission has occurred.

The final privacy compatibility gate brings Bloom to426/426 passing tests. A public no-store health probe requires the candidate memory/account-data/feedback capabilities before acquiring tokens or sending chat/context. History/export/deletion are gated too, and account changes during the probe are fenced. The existing hosted legacy backend was actually probed and rejected without authentication or private data. It must be upgraded under an approved deployment before Meg is enabled in this candidate. Genuine provider acceptance remains blocked.
