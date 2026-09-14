function point(landmarks, id) {
  if (!Array.isArray(landmarks)) return null;
  return landmarks[id] || landmarks.find((item) => item?.id === id) || null;
}

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (Number(a.x) + Number(b.x)) / 2, y: (Number(a.y) + Number(b.y)) / 2 };
}

function angle(a, b, c) {
  if (!a || !b || !c) return null;
  // MediaPipe normalizes x/y by different dimensions. Restore square units
  // before measuring angles, especially for portrait phone cameras.
  const aspect = Number(b.aspectRatio) > 0 ? Number(b.aspectRatio) : 1;
  const ab = { x: (Number(a.x) - Number(b.x)) * aspect, y: Number(a.y) - Number(b.y) };
  const cb = { x: (Number(c.x) - Number(b.x)) * aspect, y: Number(c.y) - Number(b.y) };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator));
  return Math.acos(cosine) * (180 / Math.PI);
}

function velocity(current, previous, elapsedMs) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || elapsedMs <= 0) return 0;
  return (current - previous) / (elapsedMs / 1000);
}

function deviationFromVertical(hip, ankle) {
  if (!hip || !ankle) return null;
  const aspect = Number(hip.aspectRatio) > 0 ? Number(hip.aspectRatio) : 1;
  const dx = (Number(ankle.x) - Number(hip.x)) * aspect;
  const dy = Number(ankle.y) - Number(hip.y);
  return Math.abs(Math.atan2(dx, Math.abs(dy) || 0.0001) * (180 / Math.PI));
}

module.exports = { angle, deviationFromVertical, distance, midpoint, point, velocity };
