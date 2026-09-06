import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../utils/constants';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { STRENGTH_COPY } from './constants';
import useStrengthSession from './useStrengthSession.web';
import { poseEngineIdForExercise } from './poseCapability';
import CameraStage from './components/CameraStage.web';
import FramingGuide from './components/FramingGuide';
import SessionControls from './components/SessionControls';
import StrengthSummary from './components/StrengthSummary';
import ProgressRing from './components/ProgressRing';

// Web pose-tracked session. Brings up the camera, streams frames through the
// deterministic Strength engine, and falls back to the guided session whenever
// camera / MediaPipe / permissions are unavailable or the selected movement has
// no deterministic pose engine.
export default function TrackedStrengthScreen({ exercise, sets = 1, onExit, onFallback }) {
  const { user } = useAuth();
  const poseEngineId = poseEngineIdForExercise(exercise?.id);
  const targetReps = Number.isFinite(Number(exercise?.defaultReps)) && Number(exercise.defaultReps) > 0
    ? Number(exercise.defaultReps)
    : undefined;
  const session = useStrengthSession({
    uid: user?.uid,
    exerciseId: poseEngineId,
    sets,
    targetReps,
  });

  const {
    phase, instruction, calibrationGood, countdown, reps, cueText, pauseReason,
    muted, setMuted, showSkeleton, setShowSkeleton, cameraFailure,
    unsupported, currentSet, totalSets, targetReps: activeTargetReps,
    beginCamera, cameraReady, cameraError, onFrame, startCountdown, togglePause, stop,
    continueSet,
    summaryResult, summaryError, savingSummary, reset, retrySummary,
    cameraActive, inferenceActive, voiceAvailable,
  } = session;

  // Fail safe: if this movement has no pose engine (or an invalid engine id
  // reached the hook), route straight to the guided fallback. Never run the
  // squat engine under another movement.
  useEffect(() => {
    if (!poseEngineId || unsupported) {
      onFallback?.();
    }
  }, [poseEngineId, unsupported, onFallback]);

  // The hook starts in 'select' and does not launch the camera itself; the
  // screen drives that. Auto-start on entry, and re-arm after reset/again.
  useEffect(() => {
    if (poseEngineId && !unsupported && phase === 'select') {
      beginCamera();
    }
  }, [poseEngineId, unsupported, phase, beginCamera]);

  // Between-set rest is surfaced by the dedicated overlay (continue button);
  // the rep footer is only for an in-progress set.
  const inSession = ['active', 'paused', 'countdown', 'ready'].includes(phase);
  const isFailed = phase === 'permission' || cameraFailure != null;

  const ringProgress = phase === 'countdown' ? 1 - countdown / 3
    : phase === 'active' || phase === 'paused' ? 0
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="End Strength session" style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}>
          <Icon name="chevron-back" size={22} color={COLORS.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{exercise?.name}</Text>
          <Text style={styles.headerMeta}>
            {phaseLabel(phase)}
            {phase === 'active' || phase === 'between_sets' ? ` · Set ${currentSet}/${totalSets} · ${reps}/${activeTargetReps} reps` : ''}
          </Text>
        </View>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.stageWrap}>
        <CameraStage
          active={cameraActive}
          inferenceActive={inferenceActive}
          showSkeleton={showSkeleton}
          onReady={cameraReady}
          onError={cameraError}
          onFrame={onFrame}
        />

        {phase === 'calibrating' ? (
          <View style={styles.overlay}>
            <FramingGuide instruction={instruction} good={calibrationGood} />
          </View>
        ) : null}

        {phase === 'ready' ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Get ready</Text>
            <Text style={styles.overlayText}>{instruction}</Text>
            <Button title="Begin set" icon="play" onPress={startCountdown} style={styles.beginButton} />
          </View>
        ) : null}

        {phase === 'countdown' ? (
          <View style={styles.overlay}>
            <Text style={styles.countdown}>{countdown}</Text>
            <Text style={styles.overlayText}>Get into your starting position…</Text>
          </View>
        ) : null}

        {phase === 'between_sets' ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Set {currentSet} of {totalSets} complete</Text>
            <Text style={styles.overlayText}>Rest, then press Continue to start set {Math.min(currentSet + 1, totalSets)}.</Text>
            <Button title={`Continue · set ${Math.min(currentSet + 1, totalSets)}`} icon="play" onPress={continueSet} style={styles.beginButton} />
          </View>
        ) : null}
      </View>

      {inSession ? (
        <View style={styles.footer}>
          <View style={styles.activeRow}>
            <ProgressRing progress={ringProgress} size={120} strokeWidth={9} color={COLORS.brand} trackColor={COLORS.surfaceStrong}>
              <Text style={styles.repValue}>{phase === 'paused' ? '⏸' : reps}</Text>
              <Text style={styles.repLabel}>{phase === 'paused' ? 'Paused' : 'reps'}</Text>
            </ProgressRing>
            <View style={styles.cueWrap}>
              <Text style={styles.cueLabel}>FORM</Text>
              <Text style={styles.cueText}>{cueText || 'Move when you are ready.'}</Text>
              {phase === 'paused' && pauseReason ? (
                <Text style={styles.pauseNote}>{STRENGTH_COPY[pauseReasonKey(pauseReason)] || pauseReason}</Text>
              ) : null}
            </View>
          </View>
          <SessionControls
            paused={phase === 'paused'}
            muted={muted}
            onPause={togglePause}
            onMute={() => setMuted(!muted)}
            onStop={stop}
          />
        </View>
      ) : null}

      {isFailed ? (
        <View style={styles.footOverlay}>
          <Icon name="alert-circle-outline" size={22} color={COLORS.warning} />
          <Text style={styles.footTitle}>Camera guidance is unavailable</Text>
          <Text style={styles.footText}>{cameraFailure?.message || STRENGTH_COPY.modelFailed}</Text>
          <View style={styles.footButtons}>
            <Button title="Try again" variant="secondary" onPress={beginCamera} style={styles.footButton} />
            <Button title="Continue guided" onPress={onFallback} style={styles.footButton} />
          </View>
        </View>
      ) : null}

      {phase === 'saving' ? (
        <View style={styles.footOverlay}>
          <ActivityIndicator color={COLORS.brand} />
          <Text style={styles.footText}>Saving your session…</Text>
        </View>
      ) : null}

      {phase === 'summary' && summaryResult ? (
        <StrengthSummary
          summary={summaryResult.summary}
          observation={summaryResult.observation}
          focus={summaryResult.focus}
          synced={summaryResult.synced}
          onDone={() => { reset(); onExit(); }}
          onAgain={() => { reset(); beginCamera(); }}
        />
      ) : null}

      {phase === 'save_error' ? (
        <View style={styles.footOverlay}>
          <Icon name="alert-circle-outline" size={22} color={COLORS.error} />
          <Text style={styles.footText}>{summaryError || 'Your session could not be saved.'}</Text>
          <View style={styles.footButtons}>
            <Button title="Try again" variant="secondary" onPress={retrySummary} style={styles.footButton} />
            <Button title="Continue guided" onPress={onFallback} style={styles.footButton} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function phaseLabel(phase) {
  switch (phase) {
    case 'loading': return 'Preparing camera';
    case 'calibrating': return 'Framing';
    case 'ready': return 'Ready';
    case 'countdown': return 'Countdown';
    case 'active': return 'Tracking';
    case 'paused': return 'Paused';
    case 'saving': return 'Saving';
    case 'summary': return 'Complete';
    default: return 'Set up';
  }
}

function pauseReasonKey(reason) {
  switch (reason) {
    case 'multi_person': return 'onePerson';
    case 'low_confidence': return 'stepBack';
    case 'page_hidden': return 'pageHidden';
    default: return '';
  }
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.md, paddingVertical: SIZES.compact },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerCopy: { alignItems: 'center' },
  headerTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  headerMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 1 },
  stageWrap: { flex: 1, marginHorizontal: SIZES.gutter, borderRadius: 18, overflow: 'hidden' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SIZES.md, gap: SIZES.sm },
  overlayTitle: { ...TYPOGRAPHY.sectionTitle, color: '#F7F4F5' },
  overlayText: { ...TYPOGRAPHY.supporting, color: '#F7F4F5', maxWidth: 360 },
  countdown: { color: '#F7F4F5', fontSize: 72, lineHeight: 80, fontWeight: '800', textAlign: 'center', marginBottom: SIZES.xs },
  beginButton: { alignSelf: 'stretch', marginTop: SIZES.sm },
  footer: { padding: SIZES.gutter, gap: SIZES.md },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.lg },
  repValue: { ...TYPOGRAPHY.display, color: COLORS.ink, fontSize: 44, lineHeight: 50 },
  repLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted, textAlign: 'center' },
  cueWrap: { flex: 1, gap: SIZES.xs },
  cueLabel: { ...TYPOGRAPHY.eyebrow, color: COLORS.muted },
  cueText: { ...TYPOGRAPHY.body, color: COLORS.ink },
  pauseNote: { ...TYPOGRAPHY.caption, color: COLORS.warning, marginTop: SIZES.xs },
  footOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, padding: SIZES.xl, backgroundColor: COLORS.scrim },
  footTitle: { ...TYPOGRAPHY.sectionTitle, color: '#F7F4F5', textAlign: 'center' },
  footText: { ...TYPOGRAPHY.supporting, color: '#F7F4F5', textAlign: 'center', maxWidth: 420 },
  footButtons: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  footButton: { flex: 1 },
});
