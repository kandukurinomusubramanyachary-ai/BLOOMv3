# Bloom Strength — Implementation Status

Precise, honest status of the Strength feature on the `main` branch
(`aa5dfe2757306f145b6d37a2db02e23842a35aa3`). This page records what is
actually implemented and reachable versus what is scaffolded. Nothing here is
described as device-validated unless it has been run on a real device/emulator.

---

## 1. Deterministic rep engine

**Status: implemented and unit-tested — the only truly validated component.**

- `engine/repStateMachine.js` is the shared state machine: confidence gating,
  minimum transition frames + hold, minimum cycle time, pause/re-entry,
  multi-person pause, and deterministic `repAccepted { count, durationMs }`
  events. It does **not** import Meg or any language model.
- Each exercise (`exercises/*.js`) owns versioned states, thresholds, deadbands,
  required joints, and cue conditions. `EXERCISES` is the canonical list.
- Supporting deterministic primitives: `jointAngles`, `landmarkSmoothing`,
  `poseTransform`, `positioningCoach`, `cueScheduler`, `bodyFraming`,
  `strengthPrivacy` (summary allowlist), `strengthSummary`.
- **Tests:** `server/strengthEngine.test.js` = **35/35** (23 original + 12 new
  squat-robustness regression cases; the 23 were not weakened — see §6).

### Determinism & privacy
- The engine derives accepted reps and cues purely from numeric measurements and
  timestamps — no randomness, no external service, no ML model in this path.
- `engine/strengthPrivacy.js` exposes a strict summary allowlist
  (`STRENGTH_DEFAULTS` keys only), enforced by `serializeStrengthSummary` /
  `assertPrivacySafeObject` and mirrored by the Firestore rules. No image,
  landmark, or media key can leave the device.

---

## 1b. Exercise capability map

One source of truth: `src/features/strength/poseCapability.js`
(`POSE_ENGINE_BY_EXERCISE`, `poseEngineIdForExercise`, `supportsPoseTracking`,
`modeForExercise`, `resolveTargetReps`, `normalizeSetCount`). Never guessed,
never defaulted to squat.

### Pose-tracked exercises (have a deterministic pose engine)
| Catalog exercise | Pose engine id |
| --- | --- |
| Bodyweight squat | `bodyweight-squat-v1` |
| Wall push-up | `wall-pushup-v1` |
| Standing side-leg raise | `side-leg-raise-v1` |

### Guided-only exercises (no pose engine → guided flow)
`glute-bridge`, `calf-raise`, `bird-dog`, `dead-bug`, `wall-sit`.

### Safety rules
- Selecting a pose-tracked exercise starts the tracked session (guided fallback
  if camera/MediaPipe is unavailable).
- Selecting a guided-only exercise goes straight to the guided session — it is
  **never** sent through the squat (or any) pose engine.
- `exerciseById()` returns `null` for an unknown id instead of silently
  returning squat; the tracked hook reports `unsupported` (fail-safe) rather
  than defaulting to squat. The rep engine is only ever instantiated with the
  engine id selected from the capability map.
- Set count is passed through the whole flow (catalog → tracked screen → hook);
  target reps is resolved from the selected exercise's `defaultReps`. Set
  orchestration (current set / total sets / per-set target / between-set rest /
  completion) lives **outside** the rep engine, which still counts one set.
- The rep engine tracks one set; the session orchestrator tracks multiple sets.

## 2. Web pose tracking

**Status: implemented, wired end-to-end into the live flow — runtime device
validation still required.**

Components (all reachable from the web entry):

| File | Role |
| --- | --- |
| `StrengthScreen.web.js` | Web entry. Catalog → detail → Start routes to pose tracking; guided is the explicit fallback. |
| `TrackedStrengthScreen.web.js` | Pose session screen. Drives camera, engine hook, cues, summary. Falls back to guided on failure. |
| `useStrengthSession.web.js` | Full tracked-session hook (phases: select/loading/calibrating/ready/countdown/active/paused/saving/summary/save_error/permission). |
| `components/CameraStage.web.js` | Camera lifecycle. Stops tracks, closes the detector, cancels rAF on unmount. |
| `components/PoseOverlay.web.js` | Skeleton / framing overlay. |
| `services/PoseDetector.web.js` | MediaPipe Pose Landmarker Lite wrapper. |

### Asset / path contract (verified)
`PoseDetector.web.js` requests three local assets, all present under
`public/strength/` and carried into the web export (`dist/strength/`):

- `/strength/vision_bundle.js`
- `/strength/wasm` (`vision_wasm_*` internal + nosimd variants)
- `/strength/pose_landmarker_lite.task`

`STRENGTH_DEFAULTS.modelAssetPath` / `wasmAssetPath` match these paths.

### Engine ↔ hook contract (verified)
`repStateMachine.process({ ts, landmarks, poseCount, measurements, confident })`
emits `repAccepted { count, durationMs }`, `pauseRequested { reason }`,
`stateChanged`, `cueCondition`, and matches the exact frame shape produced by
`useStrengthSession.web.js`.

### Reachability (verified)
The web entry is imported by navigation (`MainTabNavigator.js` → `StrengthScreen`).
`TrackedStrengthScreen.web.js` is rendered when a move is started; guided is
reachable via `onFallback` on camera/model/permission failure or from the
unavailable banner.

### Cleanup
`CameraStage.web.js` stops the camera tracks, closes the MediaPipe detector, and
cancels the requestAnimationFrame loop on unmount.

### Remaining runtime risk
Camera permission flow, live MediaPipe initialization, landmark delivery,
transform correctness in a real browser, and the denied-permission fallback have
**not** been executed on a real browser/device here — see §7.

---

## 3. Native pose tracking

**Status: not present in this repository.**

There is **no native pose module** here. An exhaustive search of `git rev-list
--all --objects` across all refs and unreachable objects found no
`modules/bloom-pose-landmarker`, no `.kt`/`.java`, no Expo module, no
podspec/gradle native code, and no `NativeCamera`/MediaPipe native wrapper. The
premise of a restored local native module is **false for this repository**.

Consequently:

- Native (`StrengthScreen.js`) resolves to the **camera-free guided** session.
- `TrackedStrengthScreen.js` documents the intended native contract and
  immediately defers to guided — it is not rendered, so native users are never
  shown an unreachable pose path.
- This is **managed** Expo (SDK 51 / RN 0.74): no `android/` or `ios/` dirs, so a
  native module cannot autolink today without a prebuild/dev build.

### No dependency was added
Bloom does **not** depend on `react-native-mediapipe-posedetection`. Per the
evaluation policy, a different pose library is only considered if a blocking
incompatibility is proven (none is — there is no module to be incompatible
with). If a native module is eventually written, the model must be a deliberately
vendored asset; no arbitrary model was downloaded.

---

## 4. Guided fallback

**Status: implemented and required.**

- `GuidedStrengthScreen.js` (catalog → detail → camera-free `SessionPlayer`)
  powered by `guidedSessionEngine.js` (deterministic, camera-free, resettable,
  rest-skippable).
- On web it is the **explicit** fallback from pose tracking (never a silent
  replacement). On native it is the only supported session for the moves that
  would otherwise be tracked.
- Tests: `server/guidedSessionEngine.test.js` = **13/13**.
- The guided engine does **not** acquire a camera or rep-velocity lock.

---

## 5. MediaPipe model

**Status: web asset is present and path-correct; native has no asset (no module).**

- Web serves the Lite model + Vision WASM from `public/strength/` over a local
  path and carries them into the export. No external/CDN fetch at runtime for
  the model itself.
- Missing-model behavior is explicit: if the model / WASM cannot be loaded or
  MediaPipe init fails, `PoseDetector.web.js` surfaces a failure and
  `TrackedStrengthScreen.web.js` presents the guided fallback (and a “Try
  again”). The web build does **not** ship without the model — the assets are
  versioned in `public/strength/`.

---

## 6. Tests

| Suite | Result |
| --- | --- |
| `server/strengthEngine.test.js` | **35/35** (23 original + 12 new squat robustness cases) |
| `server/strengthContract.test.js` | **10/10** (catalog ↔ engine mapping, fail-safe, target/set preservation, guided routing) |
| `server/guidedSessionEngine.test.js` | **13/13** |
| `server/all.test.js` (full suite incl. Meg v2 bridge, UI hardening, etc.) | **155/155** |

Typecheck: `npx tsc --noEmit` — **clean (exit 0)**.
Web export: `npx expo export --platform web` — **bundled successfully** (assets
carried to `dist/strength/`).

### The 12 new squat robustness cases
1. Ankle landmark lost mid-rep → pauses (low confidence), no phantom rep.
2. Brief ankle loss (below the low-confidence window) → no forced pause, rep completes.
3. Visibility loss then recovery → resumes, in-flight rep still counted.
4. Long visibility loss → pauses, then recovery still completes the rep.
5. Deep squat (knee ≈ 70°) far past the bottom threshold → exactly one rep.
6. Wrong-direction cycle (knees only extend) → zero reps.
7. Seeded measurement noise around thresholds → exactly one clean rep.
8. Landmark-level jitter (not just measurements) → exactly one clean rep.
9. Incomplete rep after visibility loss before the bottom → not counted.
10. Two partial descents that never finish standing → no phantom rep.
11. Stale/duplicated/backwards timestamps → no throw, no premature count.
12. Impossible geometry (degenerate / zero-length limbs) → no crash, no rep.

`multi-person` pausing is covered by the existing suite ("a second pose pauses the rep
engine immediately").

The original 23 tests were **not** weakened; the new cases only add coverage.

---

## 7. Native compile status

**Status: not validated — blocked by repository/environment.**

- Managed Expo with no `android/`/`ios/` projects. A native module would require
  prebuild + a development build. No native compile was performed (no native
  module exists, and no Xcode/Android toolchain check was run here).
- Exercise thresholds are marked `pending-pro` (product tuning, not medical
  claims). This repository does **not** claim a device build of camera pose
  tracking.

---

## 8. Device validation status

**Status: TODO / required — not performed.**

- Web pose tracking (camera permission, MediaPipe init, landmark delivery,
  transforms, engine input, cleanup, denied-permission fallback) must be run in a
  real browser with a camera. Automated tests + bundling validate the code path,
  **not** the live camera sink.
- Breathing (guided) and the deterministic engine are validated by unit tests
  only, not on a device.
- Once a native pose module is added, it needs the five-point device spike:
  1. prebuild completes with the (local) Lite model,
  2. Android + iOS dev builds compile,
  3. front-camera landmarks align in portrait with cover cropping,
  4. a ten-minute session stays within latency/memory budgets,
  5. camera denial / backgrounding / rotation / detector failure return to
     guided without losing the session.

---

## 9. Environment limits

Validation was performed within a headless sandbox: no webcam, no device, no
native toolchain. Confirmations limited to: install from the lockfile
(`npm ci`), the Node test suites, `tsc --noEmit`, and a web export bundle.
