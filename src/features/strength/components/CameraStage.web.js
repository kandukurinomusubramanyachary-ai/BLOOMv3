import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { STRENGTH_COPY } from '../constants';
import { createLandmarkSmoother, estimateBodyHeight } from '../engine/landmarkSmoothing';
import { createPoseDetector } from '../services/PoseDetector.web';
import { startCameraSession } from '../services/cameraSession';
import PoseOverlay from './PoseOverlay.web';

export default function CameraStage({ active, inferenceActive, showSkeleton = true, showIndicator = true, fit = 'contain', style, onFrame, onReady, onError, onVideoSize }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const callbackRef = useRef({ onFrame, onReady, onError, onVideoSize });
  const settingsRef = useRef({ inferenceActive, showSkeleton, fit });
  const geometryRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  callbackRef.current = { onFrame, onReady, onError, onVideoSize };
  settingsRef.current = { inferenceActive, showSkeleton, fit };

  useEffect(() => {
    if (!active) return undefined;
    const smoother = createLandmarkSmoother();
    const video = videoRef.current;
    const geometryChanged = () => {
      const geometry = `${video.videoWidth}:${video.videoHeight}`;
      if (geometry === geometryRef.current) return;
      geometryRef.current = geometry;
      // A rotated source is a new coordinate system; old filtered points no longer fit it.
      smoother.reset();
      overlayRef.current?.clear();
      if (video.videoWidth && video.videoHeight) callbackRef.current.onVideoSize?.({ width: video.videoWidth, height: video.videoHeight });
    };
    video.addEventListener('resize', geometryChanged);
    video.addEventListener('loadedmetadata', geometryChanged);
    setLoading(true);
    const session = startCameraSession({
      video: videoRef.current,
      createDetector: createPoseDetector,
      settings: () => settingsRef.current,
      onReady: () => {
        const facingMode = video.srcObject?.getVideoTracks?.()[0]?.getSettings?.().facingMode;
        setMirrored(facingMode !== 'environment');
        geometryChanged();
        setLoading(false); callbackRef.current.onReady?.();
      },
      onError: error => { setLoading(false); callbackRef.current.onError?.(error); },
      onFrame: result => {
        const raw = result.poses[0] || [];
        const landmarks = smoother.smooth(raw, result.ts, estimateBodyHeight(raw));
        if (settingsRef.current.showSkeleton) {
          overlayRef.current?.draw({ ...result, landmarks, fit: settingsRef.current.fit });
        } else overlayRef.current?.clear();
        callbackRef.current.onFrame?.({ ...result, landmarks, poseCount: result.poses.length });
      },
    });
    return () => {
      video.removeEventListener('resize', geometryChanged);
      video.removeEventListener('loadedmetadata', geometryChanged);
      session.stop(); smoother.reset(); geometryRef.current = ''; overlayRef.current?.clear();
    };
  }, [active]);

  useEffect(() => {
    if (!showSkeleton || !inferenceActive) overlayRef.current?.clear();
  }, [showSkeleton, inferenceActive]);

  return (
    <View style={[styles.stage, style]} accessibilityLabel='Private camera preview'>
      <video ref={videoRef} muted playsInline autoPlay disablePictureInPicture style={{ ...webStyles.video, objectFit: fit, transform: mirrored ? 'scaleX(-1)' : 'none' }} />
      <PoseOverlay ref={overlayRef} />
      {loading ? <View style={styles.loading} accessibilityState={{ busy: true }}><ActivityIndicator color='#F7F4F5' /><Text style={styles.loadingText}>Getting your movement tracker ready…</Text></View> : null}
      {showIndicator && active && !loading ? <View style={styles.indicator} accessible accessibilityLabel={STRENGTH_COPY.activeCamera}><Icon name='shield-checkmark-outline' size={16} color='#D9E6D4' /><Text style={styles.indicatorText}>Camera on · stays on this device</Text></View> : null}
    </View>
  );
}

const webStyles = {
  video: { position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectPosition: '50% 50%' },
};

const styles = StyleSheet.create({
  stage: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 16, backgroundColor: '#121113' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, backgroundColor: 'rgba(18,17,19,0.82)' },
  loadingText: { color: '#F7F4F5', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  indicator: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(18,17,19,0.88)' },
  indicatorText: { flex: 1, color: '#F7F4F5', fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
