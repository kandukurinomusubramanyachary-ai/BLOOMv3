# Account deletion instructions

**DRAFT ? UNAPPROVED ? DO NOT PUBLISH**

## Delete in the app

For a disposable account, open Profile, choose Delete account, enter your current password and confirm. Export records first if you want a copy. Keep the app online until the operation finishes. A success message must mean the required active-store steps completed; an error means deletion may be partial and should be retried. Publisher/contact/effective date: [PENDING].

## What the operation does

The app confirms recent identity, writes an account-deletion barrier, removes the authenticated user?s Meg records and memory, removes private Firestore tracking, diet, legacy Meg and profile records, deletes the Firebase login and clears account-scoped device storage. Reminders are canceled on account lifecycle changes. A deletion receipt containing UID and request timestamp remains to prevent old devices from recreating records. Retention and authorized cleanup of that receipt: [PENDING LEGAL REVIEW].

## Other copies and failures

Deleting tracking data alone does not delete your login. Clearing one conversation does not delete your account. Exports and copies you shared outside Bloom are outside this deletion workflow. Provider-side logs, backups and legally retained records have [PENDING RETENTION AND DELETION PERIODS]. If deletion fails, new writes are paused when the barrier exists; return to Profile and retry Delete account. Do not interpret a failed attempt as completed deletion.

## Request without the app

Public deletion-request URL: [PENDING APPROVED HTTPS URL]. Monitored support/privacy contact and identity-verification process: [PENDING]. The public page must name Bloom or its approved publisher and provide a functioning request path without requiring app reinstallation. This external support intake has not been published or operationally verified; public release is blocked until it is available. Request handling times and exceptions require approval.
