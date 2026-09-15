const { distance, midpoint, point } = require('./jointAngles');

function visibilityOf(item) {
  return Number(item?.visibility ?? item?.presence ?? 0);
}

function bodyBounds(landmarks) {
  const visible = (landmarks || []).filter((item) => visibilityOf(item) >= 0.35
    && Number.isFinite(item?.x) && Number.isFinite(item?.y));
  if (!visible.length) return null;
  const xs = visible.map((item) => Number(item.x));
  const ys = visible.map((item) => Number(item.y));
  return {
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
  };
}

function checkBodyFraming(landmarks, cameraView, thresholds = {}) {
  const bounds = bodyBounds(landmarks);
  if (!bounds) return { ok: false, reason: 'no_pose', instruction: 'Looking for you…' };
  // Framing is a setup check, separate from the exercise's rep thresholds.
  // A confident prediction can still be outside the actual camera image.
  const coreIds = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
  const inFrame = item => item && Number.isFinite(item.x) && Number.isFinite(item.y)
    && item.x >= 0.01 && item.x <= 0.99 && item.y >= 0.01 && item.y <= 0.99;
  const confidence = item => {
    const value = item && !item.stale
      ? Math.min(Number(item.visibility ?? item.presence ?? 0), Number(item.presence ?? item.visibility ?? 0)) : 0;
    return Number.isFinite(value) ? value : 0;
  };
  const head = point(landmarks, 0);
  if (head && !inFrame(head)) return { ok: false, reason: 'head_out', instruction: 'Step back so your head is in view.' };
  const feetIds = [27, 28, 31, 32];
  if (feetIds.some(id => !inFrame(point(landmarks, id)) || confidence(point(landmarks, id)) < 0.5)) {
    return { ok: false, reason: 'feet_out', instruction: 'Step back so I can see both feet.' };
  }
  if (coreIds.some(id => point(landmarks, id) && !inFrame(point(landmarks, id)))) {
    return { ok: false, reason: 'body_out', instruction: 'Move into the centre so your whole body is in view.' };
  }
  // Side-view exercises naturally occlude the far arm/leg. Require the head,
  // torso and at least one full side, rather than rejecting a correct side view.
  const sides = cameraView === 'side-view'
    ? [[0, 11, 13, 15, 23, 25], [0, 12, 14, 16, 24, 26]] : [coreIds];
  if (!sides.some(ids => ids.every(id => confidence(point(landmarks, id)) >= 0.5))) {
    return { ok: false, reason: 'low_confidence', instruction: 'I need a clearer view. Face the light and keep your body visible.' };
  }
  const bodyHeight = bounds.bottom - bounds.top;
  const centreX = (bounds.left + bounds.right) / 2;
  const minimumHeight = thresholds.minimumHeight ?? 0.55;
  const maximumHeight = thresholds.maximumHeight ?? 0.9;
  if (bodyHeight < minimumHeight) return { ok: false, reason: 'too_far', instruction: 'Come a little closer.' };
  if (bodyHeight > maximumHeight) return { ok: false, reason: 'too_close', instruction: 'Step back a little.' };
  const displayCentreX = thresholds.mirrored ? 1 - centreX : centreX;
  if (displayCentreX < 0.2) return { ok: false, reason: 'off_centre', instruction: 'Move slightly to your right.' };
  if (displayCentreX > 0.8) return { ok: false, reason: 'off_centre', instruction: 'Move slightly to your left.' };

  const shoulderMid = midpoint(point(landmarks, 11), point(landmarks, 12));
  const hipMid = midpoint(point(landmarks, 23), point(landmarks, 24));
  const torso = distance(shoulderMid, hipMid) || 0.001;
  const shoulderWidth = Math.abs((point(landmarks, 11)?.x || 0) - (point(landmarks, 12)?.x || 0));
  const hipWidth = Math.abs((point(landmarks, 23)?.x || 0) - (point(landmarks, 24)?.x || 0));
  if (cameraView === 'side-view') {
    const aligned = Math.abs((hipMid?.x || 0) - (shoulderMid?.x || 0)) < 0.1;
    if (shoulderWidth >= 0.3 * torso || !aligned) {
      return { ok: false, reason: 'wrong_angle', instruction: 'Turn slightly to your side.' };
    }
  } else if (shoulderWidth < 0.6 * torso || hipWidth < 0.4 * torso) {
    return { ok: false, reason: 'wrong_angle', instruction: 'Face the camera more directly.' };
  }
  return { ok: true, reason: null, instruction: 'Good — I can see your full body.', bodyHeight, centreX };
}

function requiredLandmarksVisible(landmarks, ids, threshold = 0.5) {
  const missing = (ids || []).filter((id) => {
    const item = point(landmarks, id);
    const confidence = Math.min(visibilityOf(item), Number(item?.presence ?? item?.visibility ?? 0));
    return !Number.isFinite(item?.x) || !Number.isFinite(item?.y)
      || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1
      || !Number.isFinite(confidence) || confidence < threshold;
  });
  return { ok: missing.length === 0, missing };
}

module.exports = { bodyBounds, checkBodyFraming, requiredLandmarksVisible, visibilityOf };
