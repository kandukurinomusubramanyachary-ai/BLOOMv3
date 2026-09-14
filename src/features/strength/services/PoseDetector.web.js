import { STRENGTH_DEFAULTS } from '../constants';

let visionPromise = null;

function loadLocalVisionBundle() {
  if (window.Vision) return Promise.resolve(window.Vision);
  if (visionPromise) return visionPromise;
  const pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/strength/vision_bundle.js';
    script.async = true;
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error('pose_runtime_timeout'));
    }, 15000);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.Vision) resolve(window.Vision);
      else {
        script.remove();
        reject(new Error('pose_runtime_missing'));
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('pose_runtime_failed'));
    };
    document.head.appendChild(script);
  });
  visionPromise = pending.catch((error) => {
    visionPromise = null;
    throw error;
  });
  return visionPromise;
}

export async function createPoseDetector(options = {}) {
  const config = { ...STRENGTH_DEFAULTS, ...options };
  const { FilesetResolver, PoseLandmarker } = await loadLocalVisionBundle();
  const vision = await FilesetResolver.forVisionTasks(config.wasmAssetPath);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: config.modelAssetPath, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: config.poseCount,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  let closed = false;
  // Bound the pixels copied into WASM on phones. Preserve the source aspect
  // ratio so landmarks still map to the uncropped camera preview.
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) { landmarker.close(); throw new Error('pose_canvas_unavailable'); }

  return {
    detect(video, timestamp) {
      if (closed) return { poses: [], latencyMs: 0, sourceWidth: 0, sourceHeight: 0 };
      const began = performance.now();
      const scale = Math.min(1, config.downsampleLongSide / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.drawImage(video, 0, 0, width, height);
      const result = landmarker.detectForVideo(canvas, timestamp);
      try {
        return {
          poses: (result.landmarks || []).map((landmarks) => landmarks.map((item, id) => ({
            id, x: item.x, y: item.y, z: item.z, visibility: item.visibility, presence: item.presence,
            aspectRatio: video.videoWidth / video.videoHeight,
          }))),
          latencyMs: performance.now() - began,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
        };
      } finally { result.close?.(); }
    },
    close() {
      if (closed) return;
      closed = true;
      try { landmarker.close(); } finally { canvas.width = canvas.height = 0; }
    },
  };
}
