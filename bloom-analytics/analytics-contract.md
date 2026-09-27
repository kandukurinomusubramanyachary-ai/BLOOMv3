# Bloom Analytics prototype freeze contract

This isolated HTML dashboard uses deterministic synthetic fixtures only. It is not connected to production and its counts are not real product telemetry.

- Android and iOS Strength sessions use guided mode only, with no camera/pose telemetry.
- Web Strength attempts camera/pose initialization. Successful attempts enter tracked mode; permission denial, pose failure, or camera startup failure can lead to guided fallback. Failure events precede fallback and guided entry.
- `Bug reporters (unique)` counts distinct users with at least one `bug_report` event in the selected range.
- Primary activation requires a meaningful action on signup day. Seven-day engagement additionally requires an action on D1–D7 and a mature D7 observation window. Retention uses exact D1/D7/D30 and a separate within-seven-days measure with mature denominators.
- Analytics must never expose conversation text, symptoms or other health values, cycle/period dates, notes, mood/free text, onboarding answers, doctor reports, names, phone/email, exact delivery/address data, camera frames, or pose landmarks. Onboarding step labels are permitted; answer values are not.

Before future production integration: implement validated event ingestion, a server-side property allowlist, event IDs and deduplication, a timezone policy, internal/test traffic exclusion, consent/privacy/legal review, founder-only authorization, and real app instrumentation. None of these production tasks is implemented or authorized by this freeze pass.

Run `node bloom-analytics/validate.js` for fixture and metric boundary checks. Browser checks additionally cover custom-range interactions and responsive layouts.
