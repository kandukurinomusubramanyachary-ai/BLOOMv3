# Bloom beta production operations

## Configuration

Use `.env.example` as a field list, not a production-ready environment. Run `npm run check:release-config` before publishing a frontend. Its output contains field names only. Set the six public Firebase application fields and a public HTTPS Meg API URL. Publish reviewed Privacy Policy, Terms and a monitored support page into the three public URL slots. Disable both dev-auth flags and keep Strength at 0. Public Firebase application configuration is not Firebase Admin credentials.

Keep provider keys and Firebase Admin credentials in the backend secret manager only. This server's `FIREBASE_SERVICE_ACCOUNT_JSON` format is **base64-encoded JSON**, not raw JSON; alternatively use ADC plus a Firebase project ID. Verify revoked tokens; never use `dev-token` for deployment tests. Firebase project/edition, authorized domains, email/password enablement, password-reset email delivery and deployed rules still require validation in the selected real project.

## Meg activation when credentials are available

1. Use Node 22/npm 10 and run `npm ci` plus `npm ci --prefix meg-engine-v2` if dependencies are not installed. Configure the existing `.env` or deployment environment using `.env.example`; do not overwrite an existing environment file or commit credentials.
2. Supply the six `EXPO_PUBLIC_FIREBASE_*` web-app values and matching backend Firebase project/Admin configuration. Enable email/password sign-in and validate authorized domains/rules in that project. Disable development auth for real-account tests.
3. Set at least one backend-only provider key: `GEMINI_API_KEY`, `GROQ_API_KEY` or `OPENROUTER_API_KEY`. Model/provider defaults are already wired; no source-code edit is required. Never prefix provider or Admin secrets with `EXPO_PUBLIC_`.
4. Run the backend with `npm run server`, set `EXPO_PUBLIC_MEG_API_URL` to its reachable URL, then restart the Expo development server (`npm run web`) or rebuild the deployed frontend. A phone cannot reach your computer through `127.0.0.1`: use a reachable HTTPS backend and allow the exact frontend origin in backend CORS. Do not expose a dev-auth preview publicly.
5. Sign in with a disposable real Firebase account and send a message to Meg. Confirm a genuine provider response, reload history, retry a failed request and test account data export/deletion. For production, also complete the durable-volume/restart checks below and `npm run check:release-config`.

Local code checks are complete, but this authenticated live acceptance test is intentionally deferred until configuration is supplied. A configured health response alone does not prove a model request succeeds. Do not paste secrets into chat or browser consoles.

## Persistence and health

Deploy one Meg V2 process for this SQLite beta; do not share the file between independently running replicas. Mount persistent storage at `/var/lib/bloom/meg-v2`, writable by the image's `node` user. Relative and conventional temporary paths are rejected in production. SQLite failure must fail startup rather than silently switching to JSON. A configured directory alone does not prove durable infrastructure: verify the actual volume survives redeployment.

`GET /live` reports process liveness. `GET /health` returns 200/ready only when a provider is configured with a usable circuit state, authentication project configuration is present in production and SQLite is active. Otherwise it returns 503/not_ready. Health does not validate provider billing, token permissions or email delivery; a real authenticated smoke request is still mandatory. Health exposes no directory paths, keys or chat contents. Public CI deliberately checks an unconfigured container is **not ready**, in addition to unit-testing the ready branch.

## Deployment verification (operator)

Build `docker build -t bloom-launch .`. Start it with a secret-manager environment, an exact HTTPS `CORS_ALLOWED_ORIGINS` allowlist, and a named/bound durable volume. Test `/health`, an authenticated `/api/meg/chat`, `GET /api/meg/data`, individual conversation deletion, and `DELETE /api/meg/data` with a disposable test account. Supply bearer tokens through a protected client, never command-history/log output. Restart with the same volume: a second account's fixture must persist, and deleted fixture data must remain absent. Run token-revocation and account-deletion tests. Do not deploy a localhost/dev-auth preview publicly.

## Privacy boundaries

User and conversation deletion are scoped to the verified Firebase UID, include replay records and associated trace-linked metrics, and wait for active work before erasing. Client lifecycle fences cancel pending sends and reject late local writes. Backend export contains owned records, not other accounts or provider credentials. Firestore history cleanup follows backend cleanup; local cleanup follows remote success. Account deletion clears local UID-scoped storage only after Firebase Auth deletion.

SQLite secure deletion is enabled for the live database, but a logical delete is not a guarantee of physical erasure from WAL snapshots, infrastructure backups, provider retention or another device's offline cache. The founder must approve/document retention and backup expiry and a procedure to reapply deletion records before restoring backups. Do not promise immediate deletion of every backup. Historical metrics without a retained replay trace cannot be retrospectively attributed to a user. Restrict infrastructure/log access and audit it.

## Current security-review residuals

Firestore owner boundaries are covered by emulator tests without loosening rules. Profile and Meg document schemas still accept arbitrary owner-written fields; no role field grants privilege, but schema/size hardening remains advisable. Some bounded arrays/maps do not validate each nested member. Public waitlist creation has no application-level anti-abuse gate and needs rate/size controls before broadly advertising that landing page. These are documented residuals, not a claim of a complete security certification.
