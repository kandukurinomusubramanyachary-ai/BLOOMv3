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
  const video = { srcObject: null, play: async () => {}, currentTime: 0, readyState: 2, videoWidth: 640, videoHeight: 480 };
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

test('slow inference leaves a rendering gap and sustained overload releases the camera', async () => {
  const f = fixture();
  f.detector.detect = () => { f.state.detections++; return { poses: [], latencyMs: 200 }; };
  const session = startCameraSession(f.options); await session.ready;
  f.frame(0);
  f.video.currentTime++; f.frame(220);
  assert.equal(f.state.detections, 1, 'do not immediately repeat a 200ms inference');
  for (let ts = 300; ts <= 5400; ts += 300) { f.video.currentTime++; f.frame(ts); }
  assert.equal(f.state.errors[0]?.code, 'slow_device');
  assert.equal(describeCameraError(f.state.errors[0]).kind, 'performance');
  assert.equal(f.state.stops, 1);
  assert.equal(f.state.closes, 1);
});

test('a brief slow initialization does not reject an otherwise usable device', async () => {
  const f = fixture();
  let latencyMs = 200;
  f.detector.detect = () => ({ poses: [], latencyMs });
  const session = startCameraSession(f.options); await session.ready;
  f.frame(0); latencyMs = 20;
  for (let ts = 300; ts < 6000; ts += 100) { f.video.currentTime++; f.frame(ts); }
  assert.equal(f.state.errors.length, 0);
  assert.ok(f.state.frames.length > 40);
  session.stop();
});

test('low camera FPS reduces input size before offering guided mode', async () => {
  const f = fixture();
  const sizes = [];
  f.detector.setInputSize = size => sizes.push(size);
  const session = startCameraSession(f.options); await session.ready;
  for (let ts = 0; ts <= 8000 && !f.state.errors.length; ts += 50) {
    if (ts % 250 === 0) f.video.currentTime++;
    f.frame(ts);
  }
  assert.ok(sizes.includes(512));
  assert.ok(sizes.includes(384));
  assert.equal(f.state.errors[0]?.code, 'slow_device');
  assert.equal(f.state.stops, 1);
  assert.equal(f.state.closes, 1);
});

test('reduced processing can recover tracking without forcing guided mode', async () => {
  const f = fixture();
  let size = 512;
  f.detector.setInputSize = value => { size = value; };
  f.detector.detect = () => ({ poses: [], latencyMs: size === 512 ? 160 : 35 });
  const session = startCameraSession(f.options); await session.ready;
  for (let ts = 0; ts < 12000; ts += 20) { f.video.currentTime++; f.frame(ts); }
  assert.equal(size, 384);
  assert.equal(f.state.errors.length, 0);
  assert.ok(f.state.frames.length > 70);
  session.stop();
});

test('a stalled camera fails safely, while a paused camera does not accrue low FPS time', async () => {
  for (const paused of [true, false]) {
    const f = fixture();
    const session = startCameraSession(f.options); await session.ready;
    f.frame(0); f.state.enabled = !paused;
    for (let ts = 100; ts < 10000; ts += 100) f.frame(ts);
    assert.equal(f.state.errors.length, paused ? 0 : 1);
    if (paused) {
      f.state.enabled = true;
      for (let ts = 10000; ts < 17000; ts += 100) { f.video.currentTime++; f.frame(ts); }
      assert.equal(f.state.errors.length, 0);
    }
    session.stop();
  }
});

test('transient model load failures retry within a bounded attempt count', async () => {
  const f = fixture();
  let attempts = 0;
  const session = startCameraSession({ ...f.options, createDetector: async () => {
    attempts++;
    if (attempts < 3) throw new Error('Temporary model fetch failure');
    return f.detector;
  } });
  await session.ready;
  assert.equal(attempts, 3);
  assert.equal(f.state.errors.length, 0);
  session.stop();
  const failed = fixture();
  attempts = 0;
  await startCameraSession({ ...failed.options, createDetector: async () => { attempts++; throw new Error('Offline'); } }).ready;
  assert.equal(attempts, 3);
  assert.equal(failed.state.errors.length, 1);
  assert.equal(failed.state.stops, 1);
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

test('camera frames expose actual source dimensions and front/rear mirroring after rotation', async () => {
  const f = fixture();
  let facingMode = 'user';
  f.stream.getVideoTracks()[0].getSettings = () => ({facingMode});
  const session = startCameraSession(f.options); await session.ready;
  try {
    f.frame(100);
    assert.equal(f.state.frames[0].mirrored,true);
    assert.equal(f.state.frames[0].sourceWidth,640);
    f.video.videoWidth=480; f.video.videoHeight=640; f.video.currentTime++; facingMode='environment'; f.frame(200);
    assert.equal(f.state.frames[1].mirrored,false);
    assert.equal(f.state.frames[1].sourceWidth,480);
    assert.equal(f.state.frames[1].sourceHeight,640);
  } finally { session.stop(); }
});
