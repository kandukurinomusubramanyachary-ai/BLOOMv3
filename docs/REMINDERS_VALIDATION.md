# Local reminder behavior

Reminders are scheduled locally through Expo Notifications 57; no remote push registration or delivery service is implemented. All seven reminder types and water reminders share a serialized account-aware coordinator. Startup/settings/foreground reconciliation cancels legacy owned identifiers and replaces the expected schedule. Notification text stays neutral.

Account changes synchronously invalidate in-flight work. Queued cancellation runs after any in-flight native scheduling finishes, preventing a late schedule from surviving logout or switching. Explicit logout and deletion await cancellation; a cancellation failure remains visible as a failed account action. Cold logged-out startup removes schedules from the previous process. Device-local daily and weekly trigger fields preserve wall-clock preferences; returning to foreground repairs schedules after timezone changes. OS delivery is still device-controlled.

Scheduling precedes settings persistence. Scheduling or persistence failure cancels partial work and restores the previous schedule where possible; a failed activation does not report success. Passive startup does not request permission. Explicit activation requests permission and reports denial. Existing enabled preferences can remain saved while permission is off, with a visible explanation in Reminders.

Automated coverage: in-flight logout/switch, stale preference writes, duplicate reconciliation, legacy cancellation, cold logout, denied permission, schedule failure, disk failure, invalid days/times, SDK daily/weekly/date trigger schemas, India/DST/UTC wall-clock fields and water schedule generation/cancellation. Physical delivery, reboot/battery/focus behavior and live timezone travel need device acceptance.
