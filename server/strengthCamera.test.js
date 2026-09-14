const test = require('node:test');
const assert = require('node:assert/strict');
const { startCameraSession, describeCameraError } = require('../src/features/strength/services/cameraSession');
const { createCoverTransform, mapNormalizedPoint } = require('../src/features/strength/engine/poseTransform');
const { angle, deviationFromVertical } = require('../src/features/strength/engine/jointAngles');

test('joint angles use square units for portrait and landscape camera frames', () => {
  for (const aspectRatio of [3 / 4, 4 / 3, 16 / 9]) {
    const a = { x: 0.5, y: 0.2, aspectRatio };
    const b = { x: 0.5, y: 0.5, aspectRatio };
    const c = { x: 0.5 + 0.2 / aspectRatio, y: 0.7, aspectRatio };
    assert.ok(Math.abs(angle(a, b, c) - 135) < 0.001);
    assert.ok(Math.abs(deviationFromVertical(b, c) - 45) < 0.001);
  }
});

const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const state = { stops: 0, closes: 0, detections: 0, requests: 0, errors: [], frames: [], enabled: true, callbacks: new Map(), nextId: 0 };
  let ended;
  const track = { stop: () => state.stops++, addEventListener: (_, fn) => { ended = fn; }, removeEventListener: () => { ended = null; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const detector = { close: () => state.closes++, detect: () => { state.detections++; return { poses: [] }; } };
  const video = { srcObject: null, play: async () => {}, currentTime: 0, readyState: 2, videoWidth: 640 };
  const env = { isSecureContext: true, document: { hidden: false }, navigator: { mediaDevices: { getUserMedia: async constraints => { state.requests++; assert.equal(constraints.audio, false); return stream; } } }, requestAnimationFrame: fn => { const id = ++state.nextId; state.callbacks.set(id, fn); return id; }, cancelAnimationFrame: id => state.callbacks.delete(id) };
  const options = { video, env, createDetector: async () => detector, settings: () => ({ inferenceActive: state.enabled }), onFrame: frame => state.frames.push(frame), onError: error => state.errors.push(error) };
  return { state, options, stream, detector, video, env, end: () => ended?.(), frame: ts => { const pending = [...state.callbacks.values()]; state.callbacks.clear(); pending.forEach(fn => fn(ts)); } };
}

test('camera runs once per fresh video frame, skips hidden/paused frames, and releases on stop', async () => {
  const f = fixture(); const session = startCameraSession(f.options); await session.ready;
  f.frame(100); f.frame(200); // same camera frame must not advance engine twice
  assert.equal(f.state.detections, 1);
  f.video.currentTime++; f.state.enabled = false; f.frame(300);
  f.state.enabled = true; f.env.document.hidden = true; f.frame(400);
  assert.equal(f.state.detections, 1);
  f.env.document.hidden = false; f.frame(500);
  assert.equal(f.state.detections, 2);
  session.stop(); session.stop();
  assert.equal(f.state.stops, 1); assert.equal(f.state.closes, 1);
  assert.equal(f.video.srcObject, null); assert.equal(f.state.callbacks.size, 0);
});

test('late camera grant after leaving stops that stream without starting the model', async () => {
  const f = fixture(); const pending = deferred(); let models = 0;
  f.env.navigator.mediaDevices.getUserMedia = () => pending.promise;
  const session = startCameraSession({ ...f.options, createDetector: () => { models++; return f.detector; } });
  session.stop(); await session.ready; pending.resolve(f.stream); await tick();
  assert.equal(f.state.stops, 1); assert.equal(models, 0); assert.equal(f.video.srcObject, null);
  assert.equal(f.state.errors.length, 0);
});

test('late detector initialization is disposed without stopping a newer preview', async () => {
  const f = fixture(); const pending = deferred();
  const old = startCameraSession({ ...f.options, createDetector: () => pending.promise });
  await tick(); old.stop(); await old.ready;
  const next = fixture(); next.options.video = f.video;
  const current = startCameraSession(next.options); await current.ready;
  pending.resolve(f.detector); await tick();
  assert.equal(f.state.closes, 1); assert.equal(next.state.stops, 0);
  assert.equal(f.video.srcObject, next.stream); current.stop();
});

test('model failures close the camera and leave no animation loop', async () => {
  const f = fixture(); const session = startCameraSession({ ...f.options, createDetector: async () => { throw new Error('model'); } });
  await session.ready;
  assert.equal(f.state.stops, 1); assert.equal(f.state.errors.length, 1);
  assert.equal(f.video.srcObject, null); assert.equal(f.state.callbacks.size, 0);
});

test('detector failures and camera disconnection release all resources', async () => {
  for (const mode of ['detect', 'ended']) {
    const f = fixture(); const session = startCameraSession(f.options); await session.ready;
    if (mode === 'detect') { f.detector.detect = () => { throw new Error('inference'); }; f.frame(100); } else f.end();
    assert.equal(f.state.stops, 1); assert.equal(f.state.closes, 1);
    assert.equal(f.state.errors.length, 1); assert.equal(f.state.callbacks.size, 0);
  }
});

test('startup timeout reports recovery and disposes a later model response', async () => {
  const f = fixture(); const pending = deferred();
  const session = startCameraSession({ ...f.options, createDetector: () => pending.promise, startupTimeoutMs: 10 });
  await session.ready; assert.equal(f.state.errors[0].code, 'model_timeout');
  pending.resolve(f.detector); await tick();
  assert.equal(f.state.stops, 1); assert.equal(f.state.closes, 1);
});

test('insecure phone URLs and unsupported browsers never request the camera', async () => {
  for (const mode of ['insecure', 'unsupported']) {
    const f = fixture();
    if (mode === 'insecure') f.env.isSecureContext = false; else f.env.navigator.mediaDevices = undefined;
    await startCameraSession(f.options).ready;
    assert.equal(f.state.requests, 0);
    assert.equal(describeCameraError(f.state.errors[0]).kind, mode);
  }
});

test('camera error copy distinguishes HTTPS, permission, missing camera, busy and timeout', () => {
  assert.match(describeCameraError({ code: 'insecure_context' }).message, /HTTPS/);
  assert.equal(describeCameraError({ name: 'NotAllowedError' }).kind, 'denied');
  assert.equal(describeCameraError({ name: 'NotFoundError' }).kind, 'missing');
  assert.equal(describeCameraError({ name: 'NotReadableError' }).kind, 'busy');
  assert.equal(describeCameraError({ code: 'camera_timeout' }).kind, 'timeout');
});

test('portrait and landscape contain previews keep all landmarks visible and mirrored', () => {
  for (const [viewWidth, viewHeight] of [[280, 360], [680, 230]]) {
    const transform = createCoverTransform({ sourceWidth: 640, sourceHeight: 480, viewWidth, viewHeight, mirrored: true, fit: 'contain' });
    const a = mapNormalizedPoint({ x: 0, y: 0 }, transform);
    const b = mapNormalizedPoint({ x: 1, y: 1 }, transform);
    assert.ok(a.x <= viewWidth && b.x >= 0 && a.y >= 0 && b.y <= viewHeight);
    assert.ok(a.x > b.x);
  }
});
