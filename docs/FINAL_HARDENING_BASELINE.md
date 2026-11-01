# Final hardening baseline — 2026-11-01

Candidate: PR #12, `01a40510ae706424aebd2155878f7cd39b30db3f`.
Integration branch: `fix/bloom-final-production-hardening`.

The isolated checkout preserves the original workspace's uncommitted work and
does not touch the website/cinematic branches. PR #12 is 13 commits ahead of
`main` (`15241e53e14a783dba5736e314c4a2525f8d77f5`) with no missing main commits.
`release/bloom-v3` is 16 commits behind main; `release/bloom-v3-prelaunch` is 47
commits behind main. Neither older release branch contains unique candidate work.
PR #12's Reports/Strength aggregation, local feedback preservation, first-login
onboarding and cautious cycle estimates are included unchanged at this baseline.

## Confirmed evidence

- PR #12 Verify Bloom run `41295473698`: integration tests, Meg tests, benchmark,
  Firestore emulator, typecheck and native config passed. Expo Doctor failed;
  web/container checks were skipped after that failure.
- Doctor's current matrix reports ten stale patch versions, including Expo
  `~57.0.31`, metro-runtime `~57.0.17`, asset `~57.0.20`, build-properties
  `~57.0.22`, constants `~57.0.22`, crypto `~57.0.4`, notifications `~57.0.24`,
  screen-capture `~57.0.4`, sharing `~57.0.24` and splash-screen `~57.0.10`.
  The installed SDK's current checks will determine the final versions.
- PR #12 Native builds run `41295473704` passed Android and unsigned iOS
  compilation. This is earlier-commit evidence, not final candidate evidence.
- Isolated Meg `npm ci` passed with Node 22.23.2/npm 10.9.9. Its 43 tests passed,
  zero skipped. The sandbox initially blocked child processes; the same suite
  passed with the approved process permission.

## Defects requiring work

1. Readiness counts the default Ollama adapter as configured even when local
   fallback is disabled. A no-key backend can misleadingly report ready.
2. Groq's default `llama-3.1-8b-instant` is retired for free/developer accounts
   ([provider deprecation record](https://console.groq.com/docs/deprecations)).
3. UI history loads legacy Firestore conversations while active Meg V2 persists
   messages in SQLite. Backend history restoration and feedback need a coherent,
   UID-verified path rather than a legacy document that may not exist.
4. Notification scheduling lives largely in a settings screen. Account changes
   and in-flight scheduling need a central cancellation/lifecycle boundary.
5. Legal screens contain short placeholders, not complete reviewable drafts;
   publication requires real owner/contact/retention decisions and reviewed URLs.
6. Native Strength has guided mode and web pose tracking, but no compiled native
   pose module. Native tracking must stay unavailable until build and device
   evidence supports enabling it.

## Baseline completion and external gates

Root clean installation passed: 1,260 packages with Node 22.23.2/npm 10.9.9.
Bloom passed 373 tests; Meg passed 43; Firestore rules passed 14 with Java 21.
Typecheck, native configuration and the 200-case deterministic benchmark passed.
Web export passed. Doctor passed 20/21 checks and confirmed the ten package
mismatches. Initial commands during installation and an incorrectly selected
Java 17 path were setup failures, then rerun successfully. Final post-change
results are recorded separately in the release verification report.

Live cloud-provider response, production Firebase lifecycle, signing credentials,
approved legal identity/URLs, store metadata and real-device delivery/pose
accuracy remain external acceptance gates. Missing keys must fail closed. No
public deployment, release-branch merge or store submission is authorized.
