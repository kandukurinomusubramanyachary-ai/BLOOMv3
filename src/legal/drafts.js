// Unpublished review drafts. Never imply approval from a configured URL alone.
module.exports = {
  "privacy": {
    "title": "Privacy Policy",
    "sections": [
      [
        "Who operates Bloom",
        "Operating country: India. Publisher/legal identity: [PENDING FINAL CONFIRMATION]. Privacy contact, monitored support address, effective date and approved version: [PENDING]. This is an unpublished review draft. Public release remains blocked until these fields and the policies below are approved."
      ],
      [
        "Information you provide",
        "Bloom uses your email and Firebase account identifier for sign-in. Profile and wellness records can include your name, cycle dates, symptoms, daily check-ins, mood, sleep, water, meals and nutrition preferences. Workout history includes exercise, duration, completion and either timer-paced or camera-measured repetitions. You choose what to enter. Avoid adding information about other people."
      ],
      [
        "Meg conversations and choices",
        "When you send a message, Bloom sends the message, relevant conversation context and selected wellness context to its authenticated Meg backend. The configured AI provider processes that context to generate a reply. Provider identity, processing locations, contractual terms and retention: [PENDING APPROVED PROVIDER INVENTORY]. No live cloud model key is currently available for this candidate. Messages, replies and feedback can be stored in the device cache, legacy Firestore history and Meg SQLite storage. Turning memory off prevents cross-conversation memory retrieval and new memory extraction; it does not delete existing messages or remove the current conversation from context. Use conversation deletion or account deletion to remove stored content."
      ],
      [
        "Purposes and consent",
        "Account and wellness storage support the features you request, synchronization, reports and personalized guidance. Operational data consent is separate from the optional model-improvement preference. The optional preference is stored; no model-training or human-review pipeline is implemented in this candidate. Do not interpret it as a guarantee of anonymization. Declining it does not disable the core service. Final legal bases, notice wording and withdrawal handling require legal review."
      ],
      [
        "Camera and notifications",
        "Guided Strength needs no camera. Optional web tracking and the separately gated native QA implementation process camera images on the device. Bloom does not intentionally persist or upload frames or raw pose landmarks through the tracking pipeline. Session summaries can be saved. Camera access starts only after selecting tracking and granting permission. Reminders are local scheduled notifications, not verified remote push delivery. Device permission and lock-screen settings control their visibility."
      ],
      [
        "Storage, providers and transfers",
        "Firebase Authentication and Cloud Firestore process account and synchronized wellness records. The Meg service stores conversation and memory data in SQLite. Device storage keeps account-scoped caches and settings; exported files become copies controlled by you and apps you share them with. Google Cloud hosting, AI providers and any operational logs/backups must be inventoried before release. Processing regions, international transfers and safeguards: [PENDING LEGAL AND HOSTING REVIEW]. This draft does not promise that all data stays in India."
      ],
      [
        "Controls, export and deletion",
        "Use Privacy settings to control memory and other privacy preferences; device settings control camera and notifications. Reports offers export. Profile offers tracking-data deletion and full account deletion, which are different actions. Account deletion requires recent password confirmation, removes active Meg and Firestore records, then the Firebase login and account-scoped device data. A UID-only deletion receipt blocks stale devices from recreating records. Partial failures are shown and can be retried. Receipt retention, backup expiration and legally required exceptions are [PENDING]; no immediate total-erasure promise is made."
      ],
      [
        "Security and rights",
        "The candidate uses authenticated HTTPS endpoints, UID-scoped access rules and account isolation. App lock supplements device security. No system can promise absolute security. Rights, identity verification, grievance contact, response periods, breach process, children/age eligibility and applicable Indian-law commencement requirements are [PENDING LEGAL REVIEW]. Request access, correction, consent withdrawal or deletion through [PENDING MONITORED CONTACT]. Do not send passwords or full health records to support. Material policy changes require updated notice and approval."
      ]
    ]
  },
  "terms": {
    "title": "Terms of Service",
    "sections": [
      [
        "Parties and scope",
        "These unpublished draft terms concern Bloom, operated in India by [PENDING PUBLISHER LEGAL IDENTITY]. Effective date, minimum age, eligibility, approved markets and acceptance mechanism: [PENDING LEGAL REVIEW]. Do not treat this draft as approved terms."
      ],
      [
        "Your account",
        "Provide accurate account information, protect your password and use only an account you are authorized to access. Keep your device secure and report suspected unauthorized access through [PENDING SUPPORT CONTACT]. Password recovery uses Firebase email delivery; delivery can depend on your mailbox and provider configuration."
      ],
      [
        "Wellness service",
        "Bloom records wellness information, estimates cycle patterns, provides reports, offers Meg guidance and supports guided or eligible camera-tracked movement. Estimates and AI replies can be incomplete or wrong. They do not diagnose, treat or prescribe, confirm ovulation or pregnancy, or provide reliable contraception. Read the medical/wellness disclaimer and consult a qualified professional for personal medical decisions."
      ],
      [
        "Acceptable use",
        "Do not access another person’s data, interfere with the service, bypass security controls, upload unlawful content or use Bloom to harm others. Do not rely on Meg for emergencies. Do not provide third-party private information without appropriate authority. Enforcement, notice, appeal and legally permitted suspension procedures: [PENDING LEGAL REVIEW]."
      ],
      [
        "Your information and permissions",
        "You retain applicable rights in information you provide. Bloom needs permission to process it to deliver the requested features as described in the Privacy Policy. Required operational consent and optional model-improvement choices remain separate. Camera and notifications are optional device permissions; guided movement remains available. No sale of user content or model-training license is granted by this draft. Final content/license wording: [PENDING LEGAL REVIEW]."
      ],
      [
        "Availability and third parties",
        "Connectivity, Firebase, hosting and the configured AI provider affect availability. Missing provider configuration or outages can prevent replies; the app reports a recoverable error. Features and beta builds can change. Export copies you wish to retain before deleting an account. Fees, subscriptions, service-change notice and discontinuation terms: [PENDING; no payment flow is implemented in this candidate]."
      ],
      [
        "Ending use and disputes",
        "You can stop using Bloom or request account deletion in Profile. Data handling and retained deletion receipts are described in the retention and deletion drafts. Warranty wording, liability limitations, mandatory consumer protections, governing law, dispute venue, grievance process and contact details require Indian legal review and remain [PENDING]. Nothing in this draft is intended to waive non-waivable rights."
      ]
    ]
  },
  "disclaimer": {
    "title": "Medical and wellness disclaimer",
    "sections": [
      [
        "Purpose",
        "Bloom is a wellness tracking and educational tool. Its cycle estimates, symptom summaries, nutrition suggestions, AI conversations and exercise cues are not medical diagnosis, treatment or a substitute for professional care. Publisher and effective date: [PENDING]."
      ],
      [
        "Limits of estimates and AI",
        "Cycle estimates depend on the information entered and can vary with irregular cycles, medication, illness and other factors. Do not use Bloom alone to prevent or confirm pregnancy, time treatment or determine fertility. Meg can generate incorrect or unsuitable advice. Ask a qualified clinician about persistent symptoms, medication, pregnancy concerns or changes in health."
      ],
      [
        "Movement safety",
        "Choose movements suitable for your circumstances and follow clinician guidance after injury, surgery, pregnancy or illness. Stop if you feel pain, dizziness or unwell. Guided reps follow a timer and do not measure movement. Camera counts depend on visibility and pose estimation and can be wrong; they do not assess form or injury risk reliably."
      ],
      [
        "Urgent help",
        "Bloom and Meg are not monitored emergency services. For immediate danger or urgent symptoms, contact local emergency services or seek urgent in-person care. Do not wait for an app reply. Final regulated-health classification, eligibility and disclaimer wording: [PENDING LEGAL REVIEW]."
      ]
    ]
  },
  "deletion": {
    "title": "Account deletion instructions",
    "sections": [
      [
        "Delete in the app",
        "For a disposable account, open Profile, choose Delete account, enter your current password and confirm. Export records first if you want a copy. Keep the app online until the operation finishes. A success message must mean the required active-store steps completed; an error means deletion may be partial and should be retried. Publisher/contact/effective date: [PENDING]."
      ],
      [
        "What the operation does",
        "The app confirms recent identity, writes an account-deletion barrier, removes the authenticated user’s Meg records and memory, removes private Firestore tracking, diet, legacy Meg and profile records, deletes the Firebase login and clears account-scoped device storage. Reminders are canceled on account lifecycle changes. A deletion receipt containing UID and request timestamp remains to prevent old devices from recreating records. Retention and authorized cleanup of that receipt: [PENDING LEGAL REVIEW]."
      ],
      [
        "Other copies and failures",
        "Deleting tracking data alone does not delete your login. Clearing one conversation does not delete your account. Exports and copies you shared outside Bloom are outside this deletion workflow. Provider-side logs, backups and legally retained records have [PENDING RETENTION AND DELETION PERIODS]. If deletion fails, new writes are paused when the barrier exists; return to Profile and retry Delete account. Do not interpret a failed attempt as completed deletion."
      ],
      [
        "Request without the app",
        "Public deletion-request URL: [PENDING APPROVED HTTPS URL]. Monitored support/privacy contact and identity-verification process: [PENDING]. The public page must name Bloom or its approved publisher and provide a functioning request path without requiring app reinstallation. This external support intake has not been published or operationally verified; public release is blocked until it is available. Request handling times and exceptions require approval."
      ]
    ]
  },
  "retention": {
    "title": "Data retention disclosures",
    "sections": [
      [
        "Approval required",
        "All retention durations, deletion deadlines, backup expiration and legal exceptions are [PENDING LEGAL REVIEW]. No duration is implied by this draft. Publisher, privacy contact, policy version and effective date: [PENDING]. The approved schedule must cover each store below before release."
      ],
      [
        "Active records",
        "Firebase Authentication holds account identifiers and credentials managed by Firebase. Firestore holds profile, check-ins, periods, meals and legacy Meg records. Meg SQLite holds conversation metadata, messages, feedback, extracted memories and request/replay metadata. Device caches/settings and workout history are scoped to the account. Define retention trigger, maximum duration, deletion owner and verification for each store: [PENDING]."
      ],
      [
        "Deletion barriers and backups",
        "A UID-only Firestore deletion receipt prevents stale authenticated devices from recreating deleted records. It cannot be removed by the client. Authorized server cleanup, token-expiry safeguards, maximum receipt lifetime and audit requirements: [PENDING]. Hosting logs, database backups, provider logs, disaster recovery copies and support records require a separate approved schedule and tested purge procedure. Active-store deletion does not prove backup or provider deletion."
      ],
      [
        "Temporary processing and exports",
        "Camera frames and raw landmarks are used transiently for on-device tracking and are not intentionally saved by that pipeline. Local notification schedules remain on the device until canceled or replaced. Export files and shared copies remain wherever you save them; manage those copies yourself. Existing OS backups and independently shared copies are not under the account-deletion workflow."
      ],
      [
        "Review process",
        "Before publication, the publisher must approve and implement the retention schedule, resolve provider/hosting contracts and exceptions, verify deletion/recovery behavior and document how requests are handled. Policy updates must reflect actual deployed systems. Do not replace pending fields with assumed industry-standard periods."
      ]
    ]
  },
  "support": {
    "title": "Support and contact",
    "sections": [
      [
        "Contact",
        "Bloom operates from India. Publisher: [PENDING LEGAL IDENTITY]. Monitored support email or URL, privacy/grievance contact, operating hours and response expectations: [PENDING APPROVAL]. During the private beta, contact the person who invited you. No public support service is represented as available yet."
      ],
      [
        "What to include",
        "Describe the screen, steps, expected result and app version. A screenshot may help if you remove names, cycle data, conversations and other private details. Never send your password, authentication token, model key or complete health export. Support should request only the minimum information needed."
      ],
      [
        "Common issues",
        "For login, check connectivity and email spelling; use password recovery if needed. For sync, reconnect and wait for the app to finish. For Meg outages, keep the conversation and retry when service is restored. A missing AI provider is a service configuration issue, not something a user should fix. For reminders, review device notification permission and battery/focus settings. Guided Strength works without a camera."
      ],
      [
        "Privacy, export and deletion",
        "Open Privacy settings for controls, Reports for export and Profile for account deletion. For an inaccessible account, use [PENDING PUBLIC DELETION REQUEST URL AND VERIFIED INTAKE]. If deletion shows an error, it may be partial; retry or contact the approved support channel when configured. Request-response and escalation periods remain pending legal review."
      ],
      [
        "Safety and accessibility",
        "Bloom support is not emergency or medical care. Seek appropriate local urgent care for immediate danger. Report accessibility problems with your device model, text-size setting and affected control, without sending health information. Final escalation, incident response and grievance handling: [PENDING]."
      ]
    ]
  },
  "dataSafety": {
    "title": "Google Play Data Safety mapping",
    "sections": [
      [
        "Submission status",
        "DRAFT FOR STORE REVIEW ONLY. Do not submit this mapping until the publisher, live providers, deployed behavior, backup retention and SDK inventory are approved. This is an engineering inventory, not a completed Play Console declaration. Operating country: India. Publisher, support/deletion URLs, policy effective date: [PENDING]."
      ],
      [
        "Collected data inventory",
        "Personal information: email, account UID and optional profile/name. Health and fitness: cycle/symptoms, check-ins, sleep, mood, hydration, meal/nutrition and workout summaries. Messages/other user-generated content: Meg prompts, replies and feedback, which may themselves contain health data. App interactions: only persisted feature records/feedback confirmed in code; review any hosting access logs and SDK diagnostics separately. Account authentication uses Firebase. Required/optional answers depend on the feature and must be checked against the released signup flow."
      ],
      [
        "Purposes and recipients",
        "App functionality, account management and personalization are confirmed purposes. Firebase and the Meg hosting service process synchronized data; the configured AI provider receives requested conversation context. Decide Play’s collected/shared/service-provider categories from actual contracts and policy definitions, not assumptions. Provider names, regions, retention, human access and sharing exemptions: [PENDING VERIFIED INVENTORY]. No advertising SDK or remote push-token registration is implemented in this candidate."
      ],
      [
        "Camera and notifications",
        "On-device tracking does not intentionally transmit or persist camera images or raw landmarks. Record only the actual on-device use and declared camera permission; do not mark remote image collection without evidence. Native tracking remains gated pending device acceptance. Local reminders do not require a remote push service. Inspect the final merged manifests and dependency SDK disclosures before answering device identifiers or diagnostics questions."
      ],
      [
        "Security and deletion answers",
        "Release endpoints require HTTPS and private stores use authenticated UID isolation. In-app account deletion and data export are implemented and tested in emulators; the live target still needs candidate rules/backend deployment. Public deletion-request intake and approved retention exceptions are pending. Do not claim verified production deletion or a published deletion URL until deployment and operational acceptance pass."
      ],
      [
        "Store checklist",
        "Finalize the public Privacy Policy and deletion-request URL; name the approved publisher; reconcile all data types, required/optional collection, purposes, recipients, transport encryption, deletion options, children/target-audience and health-app declarations against the signed binary and services. Obtain legal and publisher approval before submitting. Review Google Play’s current User Data, account deletion, health-content and Data Safety instructions."
      ]
    ]
  }
};
