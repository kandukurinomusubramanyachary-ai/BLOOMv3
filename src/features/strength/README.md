# Bloom Strength

Strength replaces the former Insights tab when `EXPO_PUBLIC_BLOOM_STRENGTH=1` on web. When disabled, the primary navigation contains four tabs.

## Reachable flows (current)

- **Web** (`StrengthScreen.web.js`): selecting a move leads to the **pose-tracked** session (`TrackedStrengthScreen.web.js`) driven by `useStrengthSession.web` + `CameraStage.web` + the deterministic rep engine. Camera denial, MediaPipe init failure, or engine run errors fall back to the **camera-free guided** session (`SessionPlayer`) for the same move. Guided mode is an explicit fallback — it never silently replaces pose tracking.
- **Native** (`StrengthScreen.js`): resolves to the camera-free guided session. There is no native pose module in this repository (see `docs/strength/IMPLEMENTATION_STATUS.md`), so native users are not presented with an unreachable pose path. `TrackedStrengthScreen.js` documents the intended native contract and immediately defers to guided.

See `docs/strength/IMPLEMENTATION_STATUS.md` for the full status of the engine, web/native pose, guided fallback, MediaPipe model, tests, and device validation.

## Privacy boundary

The browser requests camera access only after the user reads the explanation and presses **Enable camera**. MediaPipe Pose Landmarker Lite, its WASM runtime, and model are served from Bloom's local `/public/strength` assets. Frames are read into memory for synchronous inference, never recorded, never uploaded, and discarded after each call.

Only the strict summary allowlist in `engine/strengthPrivacy.js` can enter the UID-scoped device outbox, Firestore, or Strength analytics validation. The Firestore rules independently enforce the same document shape. Bloom currently has no analytics transport, so Strength analytics is a validated no-op.

## Deterministic engine

Each exercise owns versioned states, thresholds, deadbands, required joints, and form cue conditions. The shared rep machine applies confidence gating, minimum transition frames and hold time, minimum cycle time, pause/re-entry behavior, and deterministic accepted-rep events. It does not import Meg or any language model.

Run focused tests with:

```bash
node server/strengthEngine.test.js
```

Exercise thresholds are marked `pending-pro` until professional review. They are product tuning values, not medical claims.

## Native pose runtime status

No native pose module exists in this repository (see `docs/strength/IMPLEMENTATION_STATUS.md`), so **no third-party pose wrapper has been adopted** (including `react-native-mediapipe-posedetection`). Native resolves to the camera-free guided session, and Expo Go continues to use that honest camera-free flow.

If a local `modules/bloom-pose-landmarker` module is ever written (CameraX + MediaPipe Pose Landmarker LIVE_STREAM), it must satisfy all of the following in a disposable development-build spike before native pose tracking can be claimed:

1. Expo prebuild completes with the local Lite model.
2. Android and iOS development builds compile without manual native-project edits.
3. Front-camera landmarks remain aligned in portrait with cover cropping.
4. A ten-minute session stays within the latency and memory budgets.
5. Camera denial, backgrounding, rotation, and detector failure return to Bloom's camera-free guidance without losing the session.
