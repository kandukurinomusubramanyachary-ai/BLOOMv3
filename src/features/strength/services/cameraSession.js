// Own resources per attempt: a late permission/model response must never stop
// a newer camera session or leave a camera running after navigation.
const { STRENGTH_DEFAULTS, STRENGTH_COPY } = require('../constants');

function cameraError(code) {
  return Object.assign(new Error(code), { code });
}

function describeCameraError(error) {
  const code = error?.code;
  if (code === 'insecure_context') return { kind: 'insecure', message: STRENGTH_COPY.secureCamera };
  if (code === 'unsupported') return { kind: 'unsupported', message: STRENGTH_COPY.browserUnsupported };
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return { kind: 'denied', message: STRENGTH_COPY.permissionDenied };
  if (error?.name === 'NotFoundError') return { kind: 'missing', message: STRENGTH_COPY.cameraMissing };
  if (['NotReadableError', 'AbortError'].includes(error?.name) || code === 'camera_ended') return { kind: 'busy', message: STRENGTH_COPY.cameraBusy };
  if (code === 'camera_timeout') return { kind: 'timeout', message: STRENGTH_COPY.cameraTimeout };
  return { kind: 'failed', message: STRENGTH_COPY.modelFailed };
}

function startCameraSession({ video, createDetector, onReady, onFrame, onError, settings, env = globalThis, startupTimeoutMs = 45000 }) {
  let stopped = false;
  let stream = null;
  let detector = null;
  let animationFrame = null;
  let cancelPending = null;
  let lastSampleAt = -Infinity;
  let lastVideoTime = -1;
  const ended = () => fail(cameraError('camera_ended'));
  const disposeSafely = (dispose, value) => {
    // Cleanup must not mask the original failure or reject a late response.
    try { dispose(value); } catch { /* Resource may already be invalidated. */ }
  };
  const releaseStream = (value) => value?.getTracks().forEach(track => {
    track.removeEventListener?.('ended', ended);
    track.stop();
  });

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelPending?.();
    if (animationFrame !== null) env.cancelAnimationFrame(animationFrame);
    releaseStream(stream);
    disposeSafely(value => value?.close(), detector);
    if (video.srcObject === stream) video.srcObject = null;
  }

  function fail(error) {
    if (stopped) return;
    stop();
    onError?.(error);
  }

  // Abandon promptly; dispose resources even if an unabortable browser API
  // resolves after cancellation/timeout (getUserMedia has no AbortSignal).
  function acquire(promise, dispose = () => {}, code = 'model_timeout') {
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cancelPending = null;
        callback(value);
      };
      const timer = setTimeout(() => finish(reject, cameraError(code)), startupTimeoutMs);
      cancelPending = () => finish(reject, cameraError('cancelled'));
      Promise.resolve(promise).then(value => {
        if (finished || stopped) { disposeSafely(dispose, value); return; }
        finish(resolve, value);
      }, error => finish(reject, error));
    });
  }

  const ready = (async () => {
    try {
      if (env.isSecureContext === false) throw cameraError('insecure_context');
      if (!env.navigator?.mediaDevices?.getUserMedia) throw cameraError('unsupported');
      stream = await acquire(env.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
      }), releaseStream, 'camera_timeout');
      if (stopped) { releaseStream(stream); return; }
      stream.getVideoTracks().forEach(track => track.addEventListener?.('ended', ended));
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await acquire(video.play(), undefined, 'camera_timeout');
      if (stopped) return;
      detector = await acquire(createDetector(), value => value.close());
      if (stopped) { disposeSafely(value => value.close(), detector); return; }
      onReady?.();

      function sample(now) {
        if (stopped) return;
        const enabled = settings().inferenceActive && !env.document?.hidden;
        if (enabled && now - lastSampleAt >= 1000 / STRENGTH_DEFAULTS.sampleRate && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
          lastSampleAt = now;
          lastVideoTime = video.currentTime;
          try {
            const result = detector.detect(video, now);
            if (!stopped) onFrame?.({ ...result, ts: now });
          } catch (error) { fail(error); return; }
        }
        if (!stopped) animationFrame = env.requestAnimationFrame(sample);
      }
      if (!stopped) animationFrame = env.requestAnimationFrame(sample);
    } catch (error) { fail(error); }
  })();

  return { stop, ready };
}

module.exports = { startCameraSession, describeCameraError };
