# Google Play Data Safety mapping

**DRAFT ? UNAPPROVED ? DO NOT PUBLISH**

## Submission status

DRAFT FOR STORE REVIEW ONLY. Do not submit this mapping until the publisher, live providers, deployed behavior, backup retention and SDK inventory are approved. This is an engineering inventory, not a completed Play Console declaration. Operating country: India. Publisher, support/deletion URLs, policy effective date: [PENDING].

## Collected data inventory

Personal information: email, account UID and optional profile/name. Health and fitness: cycle/symptoms, check-ins, sleep, mood, hydration, meal/nutrition and workout summaries. Messages/other user-generated content: Meg prompts, replies and feedback, which may themselves contain health data. App interactions: only persisted feature records/feedback confirmed in code; review any hosting access logs and SDK diagnostics separately. Account authentication uses Firebase. Required/optional answers depend on the feature and must be checked against the released signup flow.

## Purposes and recipients

App functionality, account management and personalization are confirmed purposes. Firebase and the Meg hosting service process synchronized data; the configured AI provider receives requested conversation context. Decide Play?s collected/shared/service-provider categories from actual contracts and policy definitions, not assumptions. Provider names, regions, retention, human access and sharing exemptions: [PENDING VERIFIED INVENTORY]. No advertising SDK or remote push-token registration is implemented in this candidate.

## Camera and notifications

On-device tracking does not intentionally transmit or persist camera images or raw landmarks. Record only the actual on-device use and declared camera permission; do not mark remote image collection without evidence. Native tracking remains gated pending device acceptance. Local reminders do not require a remote push service. Inspect the final merged manifests and dependency SDK disclosures before answering device identifiers or diagnostics questions.

## Security and deletion answers

Release endpoints require HTTPS and private stores use authenticated UID isolation. In-app account deletion and data export are implemented and tested in emulators; the live target still needs candidate rules/backend deployment. Public deletion-request intake and approved retention exceptions are pending. Do not claim verified production deletion or a published deletion URL until deployment and operational acceptance pass.

## Store checklist

Finalize the public Privacy Policy and deletion-request URL; name the approved publisher; reconcile all data types, required/optional collection, purposes, recipients, transport encryption, deletion options, children/target-audience and health-app declarations against the signed binary and services. Obtain legal and publisher approval before submitting. Review Google Play?s current User Data, account deletion, health-content and Data Safety instructions.
