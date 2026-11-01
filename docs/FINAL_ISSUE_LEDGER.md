# Final hardening issue ledger

30 concrete engineering fixes, grouped by defect rather than counting dependency nodes. Native on-device tracking is an additional implemented capability awaiting device acceptance. A missing provider key and unapproved legal decisions are external release blockers, not claimed resolved.

| # | Confirmed defect or hardening gap | Result | Regression evidence |
|---|---|---|---|
| 1 | Meg disabled-local readiness | Missing keys plus disabled Ollama fail closed | server/finalMegHardening.test.js |
| 2 | Retired Groq model and incompatible request fields | Supported model and completion/reasoning request options | meg-engine-v2/tests/productionProviders.test.js |
| 3 | Gemini key in URL | Key sent in request header; thought parts excluded | meg-engine-v2/tests/providerAdapters.test.js |
| 4 | Sensitive provider errors in telemetry | Stable status codes replace provider response bodies | meg-engine-v2/tests/productionProviders.test.js |
| 5 | Feedback lost or resurrected during merge | Persist feedback/removal timestamps and backend history | server/finalMegHardening.test.js |
| 6 | Retry returned wrong assistant identity | Stable reply ID and legacy replay migration | server/finalMegHardening.test.js |
| 7 | Safety metadata lost on restart | Persist urgent/safety flags in SQLite/history/replay | server/finalMegHardening.test.js |
| 8 | Conversation metadata collided across UIDs | Composite owner/conversation keys with migration | meg-engine-v2/tests/sqlite.test.js |
| 9 | Retries exceeded client wait budget | One shared bounded provider deadline | meg-engine-v2/tests/timeoutFallback.test.js |
| 10 | Standalone production auth could be absent | Reject startup without server API authentication | meg-engine-v2/tests/productionProviders.test.js |
| 11 | Expo companion patch mismatch | Validated SDK 57 matrix and clean lockfile | Expo Doctor plus native CI |
| 12 | Root high/critical dependency vulnerabilities | Patched supported ranges and scoped compatibility-verified overrides | server/dependencyCompatibility.test.js |
| 13 | Standalone backend vulnerable transport lock | Patch body-parser/proxy-addr; remove unused mobile dependency | server/dependencyAdvisories.test.js |
| 14 | Disabled Meg memory still retrieved data | Enforce retrieval/extraction/cache policy end to end | meg-engine-v2/tests/memoryControl.test.js |
| 15 | Stale asynchronous account writes | UID/epoch guards and drain before deletion | server/privacyRaces.test.js |
| 16 | Old authenticated devices recreated deleted records | Immutable owner deletion barrier blocks new writes | server/firestore.rules.test.js |
| 17 | App lock missed iOS inactive transitions | Preserve first-away timestamp and exact timeout boundary | server/appLockLifecycle.test.js |
| 18 | Late biometric results unlocked a later lock | Revision guard and concurrent-prompt gate | server/appLockLifecycle.test.js |
| 19 | Missing full legal disclosures | Seven reviewable unpublished drafts with pending fields | server/legalPublication.test.js |
| 20 | URLs alone could imply release approval | Required legal registry and external deletion URL fail closed | server/legalPublication.test.js |
| 21 | Unsupported anonymization consent claim | Accurate separate future-program preference; no invented review pipeline | server/firebaseConfiguration.test.js |
| 22 | Schedules depended on screen interaction and duplicated | Startup/settings/foreground reconciliation with owned identifiers | server/reminderCoordinator.test.js |
| 23 | Reminder work survived account changes | Serialized cancellation and synchronous generation invalidation | server/reminderCoordinator.test.js |
| 24 | Failed scheduling still saved enabled preferences | Schedule/persist transaction with previous-schedule restoration | server/reminderCoordinator.test.js |
| 25 | Timezone-sensitive clock adjustment | Use local typed triggers and wall-clock arithmetic | server/notificationScheduling.test.js |
| 26 | iOS pose model bundle was empty despite compile success | Pod-root resources and built-artifact source comparison | server/nativePoseSession.test.js and native CI |
| 27 | Android permission requested before channel creation | Create channel before permission prompt | server/notificationScheduling.test.js |
| 28 | iOS permission dialog invalidated explicit camera request | Preserve pending intent through inactive; cancel on blur/unmount | server/nativePosePermissionUI.test.js |
| 29 | Fresh Firebase startup crashed before profile hydration | Nullable display names are safe during signup/session restoration | server/uiHardening.test.js and real-Firebase browser signup |
| 30 | Candidate could send data to the legacy backend lacking new privacy controls | Public capability probe gates chat, history, export and deletion before tokens/private payloads | server/megServiceContract.test.js and actual legacy probe |
