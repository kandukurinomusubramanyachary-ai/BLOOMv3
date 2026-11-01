# Data retention disclosures

**DRAFT — UNAPPROVED — DO NOT PUBLISH**

## Approval required

All retention durations, deletion deadlines, backup expiration and legal exceptions are [PENDING LEGAL REVIEW]. No duration is implied by this draft. Publisher, privacy contact, policy version and effective date: [PENDING]. The approved schedule must cover each store below before release.

## Active records

Firebase Authentication holds account identifiers and credentials managed by Firebase. Firestore holds profile, check-ins, periods, meals and legacy Meg records. Meg SQLite holds conversation metadata, messages, feedback, extracted memories and request/replay metadata. Device caches/settings and workout history are scoped to the account. Define retention trigger, maximum duration, deletion owner and verification for each store: [PENDING].

## Deletion barriers and backups

A UID-only Firestore deletion receipt prevents stale authenticated devices from recreating deleted records. It cannot be removed by the client. Authorized server cleanup, token-expiry safeguards, maximum receipt lifetime and audit requirements: [PENDING]. Hosting logs, database backups, provider logs, disaster recovery copies and support records require a separate approved schedule and tested purge procedure. Active-store deletion does not prove backup or provider deletion.

## Temporary processing and exports

Camera frames and raw landmarks are used transiently for on-device tracking and are not intentionally saved by that pipeline. Local notification schedules remain on the device until canceled or replaced. Export files and shared copies remain wherever you save them; manage those copies yourself. Existing OS backups and independently shared copies are not under the account-deletion workflow.

## Review process

Before publication, the publisher must approve and implement the retention schedule, resolve provider/hosting contracts and exceptions, verify deletion/recovery behavior and document how requests are handled. Policy updates must reflect actual deployed systems. Do not replace pending fields with assumed industry-standard periods.
