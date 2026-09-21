import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DARK_COLORS } from '../../../utils/constants';
import { createCoverTransform, mapNormalizedPoint } from '../engine/poseTransform';

const BODY_CONNECTIONS = Object.freeze([
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
]);

const JOINTS = Object.freeze([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]);

function pointConfidence(point) {
  if (!point) return 0;
  const confidence = Math.min(Number(point.visibility ?? 1), Number(point.presence ?? 1));
  return Number.isFinite(confidence) ? confidence : 0;
}

function resizeCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const density = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height, scaleX: pixelWidth / width, scaleY: pixelHeight / height };
}

export function clearPoseOverlay(canvas) {
  const context = canvas?.getContext?.('2d');
  if (!context) return;
  const { width, height, scaleX, scaleY } = resizeCanvas(canvas);
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  context.clearRect(0, 0, width, height);
}

export function drawPoseOverlay(canvas, frame) {
  const context = canvas?.getContext?.('2d');
  if (!context) return;
  const { width, height, scaleX, scaleY } = resizeCanvas(canvas);
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!frame?.landmarks?.length || !frame.sourceWidth || !frame.sourceHeight) return;

  const transform = createCoverTransform({
    sourceWidth: frame.sourceWidth,
    sourceHeight: frame.sourceHeight,
    viewWidth: width,
    viewHeight: height,
    mirrored: frame.mirrored,
    fit: frame.fit,
  });
  const points = frame.landmarks.map((point) => mapNormalizedPoint(point, transform));

  // Clip at the image edges, including letterboxing and object-fit crops.
  context.save();
  context.beginPath();
  context.rect(transform.offsetX, transform.offsetY, transform.renderedWidth, transform.renderedHeight);
  context.clip();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const [from, to] of BODY_CONNECTIONS) {
    const a = points[from];
    const b = points[to];
    const confidence = Math.min(pointConfidence(a), pointConfidence(b));
    const grace = Boolean(a?.stale || b?.stale);
    if (!a || !b || (!grace && confidence < 0.5)) continue;
    context.globalAlpha = grace ? 0.38 : Math.max(0.62, confidence);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.strokeStyle = DARK_COLORS.canvas;
    context.lineWidth = 4.5;
    context.stroke();
    context.strokeStyle = DARK_COLORS.ink;
    context.lineWidth = 2.5;
    context.stroke();
  }

  for (const id of JOINTS) {
    const joint = points[id];
    const confidence = pointConfidence(joint);
    if (!joint || (!joint.stale && confidence < 0.5)) continue;
    context.globalAlpha = joint.stale ? 0.42 : Math.max(0.7, confidence);
    context.fillStyle = DARK_COLORS.accent;
    context.strokeStyle = DARK_COLORS.canvas;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(joint.x, joint.y, id === 0 ? 3 : id >= 23 ? 4.5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
}

const PoseOverlay = forwardRef(function PoseOverlay(_props, ref) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  useImperativeHandle(ref, () => ({
    clear: () => { frameRef.current = null; clearPoseOverlay(canvasRef.current); },
    draw: (frame) => { frameRef.current = frame; drawPoseOverlay(canvasRef.current, frame); },
  }), []);
  useEffect(() => {
    const redraw = () => drawPoseOverlay(canvasRef.current, frameRef.current);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
    observer?.observe(canvasRef.current);
    window.addEventListener('resize', redraw);
    window.addEventListener('orientationchange', redraw);
    window.visualViewport?.addEventListener('resize', redraw);
    // DPR can change when a desktop window moves between Retina/non-Retina displays.
    let densityQuery;
    const watchDensity = () => {
      densityQuery?.removeEventListener?.('change', watchDensity);
      densityQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      densityQuery?.addEventListener?.('change', watchDensity);
      redraw();
    };
    watchDensity();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', redraw);
      window.removeEventListener('orientationchange', redraw);
      window.visualViewport?.removeEventListener('resize', redraw);
      densityQuery?.removeEventListener?.('change', watchDensity);
      frameRef.current = null;
    };
  }, []);
  return <canvas ref={canvasRef} aria-hidden='true' style={styles.canvas} />;
});

const styles = {
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
};

export default PoseOverlay;
