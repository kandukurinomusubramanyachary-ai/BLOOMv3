import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useReducedMotion } from '../../components/Motion';
import { STRENGTH_COPY, EXERCISE_COPY } from './constants';
import { STRENGTH_TYPE as T, useStrengthStyles } from './strengthTheme';
import useStrengthSession from './useStrengthSession.web';
import { poseEngineIdForExercise } from './poseCapability';
import CameraStage from './components/CameraStage.web';
import FramingGuide from './components/FramingGuide';
import MovementGuide from './components/MovementGuide';
import SessionControls from './components/SessionControls';
import StrengthSummary from './components/StrengthSummary';
import { StrengthButton, StrengthHeader, StrengthScreenFrame, StrengthNote, SetProgress } from './components/StrengthUI';

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Catalog history receives scalar session facts only, never frames or landmarks.
function historySummary(result, exercise) {
  const summary = result.summary;
  return {
    id: summary.id, exerciseId: exercise.id, name: exercise.name,
    sessionMode: 'pose', completionState: summary.completionState,
    reps: summary.acceptedReps, sets: summary.totalSets,
    completedSets: summary.completedSets, targetReps: summary.targetReps,
    durationSec: summary.durationSeconds, completedAt: summary.completedAt,
  };
}

export default function TrackedStrengthScreen({ exercise, sets = 1, onExit, onFallback, onComplete, onNext, nextLabel, workoutProgress }) {
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const reducedMotion = useReducedMotion();
  const poseEngineId = poseEngineIdForExercise(exercise?.id);
  const session = useStrengthSession({ uid: user?.uid, exerciseId: poseEngineId, sets, targetReps: exercise?.defaultReps });
  const {
    phase, instruction, calibrationGood, countdown, reps, cueText, pauseReason,
    muted, setMuted, showSkeleton, setShowSkeleton, cameraFailure, unsupported,
    currentSet, totalSets, targetReps, beginCamera, cameraReady, cameraError, onFrame,
    startCountdown, togglePause, stop, continueSet, summaryResult, summaryError,
    reset, retrySummary, cameraActive, inferenceActive, voiceAvailable, hasProgress,
  } = session;
  const [showSafety, setShowSafety] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [savedSummaryId, setSavedSummaryId] = useState(null);
  const [localSaveError, setLocalSaveError] = useState(null);
  const completionRef = useRef(onComplete);
  const saveAttempt = useRef({ id: null, pending: false });
  const mounted = useRef(true);
  const restEndsAt = useRef(0);
  const repScale = useRef(new Animated.Value(1)).current;
  completionRef.current = onComplete;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const saveLocalHistory = useCallback(async () => {
    if (!summaryResult?.summary || saveAttempt.current.pending) return;
    const id = summaryResult.summary.id;
    if (savedSummaryId === id) return;
    saveAttempt.current = { id, pending: true };
    setLocalSaveError(null);
    try {
      await completionRef.current?.(historySummary(summaryResult, exercise));
      if (mounted.current) setSavedSummaryId(id);
    } catch {
      if (mounted.current) setLocalSaveError('Your session is safe, but Bloom could not update your workout history. Try saving again before you leave.');
    } finally {
      saveAttempt.current.pending = false;
    }
  }, [exercise, savedSummaryId, summaryResult]);

  useEffect(() => {
    if (phase === 'summary' && summaryResult?.summary && saveAttempt.current.id !== summaryResult.summary.id) {
      void saveLocalHistory();
    }
  }, [phase, saveLocalHistory, summaryResult]);

  useEffect(() => {
    if (phase !== 'between_sets') return undefined;
    const configuredRest = Number(exercise?.restSec);
    const restSeconds = Number.isFinite(configuredRest) ? Math.max(0, Math.round(configuredRest)) : 30;
    restEndsAt.current = Date.now() + restSeconds * 1000;
    setRestRemaining(restSeconds);
    // Wall-clock based: returning to a backgrounded tab does not prolong the rest.
    const timer = setInterval(() => setRestRemaining(Math.max(0, Math.ceil((restEndsAt.current - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [phase, currentSet, exercise?.restSec]);

  useEffect(() => {
    repScale.stopAnimation();
    repScale.setValue(1);
    if (reducedMotion || reps < 1) return undefined;
    const animation = Animated.sequence([
      Animated.timing(repScale, { toValue: 1.055, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(repScale, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reps, reducedMotion, repScale]);

  const unavailable = !poseEngineId || unsupported;
  const working = phase === 'active' || phase === 'paused';
  const localSavePending = Boolean(summaryResult?.summary && savedSummaryId !== summaryResult.summary.id);
  const exitBlocked = ['saving', 'save_error'].includes(phase) || (phase === 'summary' && localSavePending);
  const saveOrExit = exitBlocked ? undefined : hasProgress ? stop : onExit;
  const cameraHeight = phase === 'between_sets' ? 144 : Math.max(280, Math.min(540, height * 0.55));
  const trackingPaused = phase === 'paused' && !['manual', 'page_hidden'].includes(pauseReason);
  const progressFraction = workoutProgress?.total > 0 ? (workoutProgress.current - 1) / workoutProgress.total : undefined;
  const progressLabel = workoutProgress?.total > 0 ? `Exercise ${workoutProgress.current} of ${workoutProgress.total}` : null;
  const movement = exercise || EXERCISE_COPY[poseEngineId];

  return <StrengthScreenFrame testID="strength-camera-screen" contentStyle={s.content}
    header={<StrengthHeader title={exercise?.name || 'Camera guidance'} subtitle={[progressLabel, `${phaseLabel(phase)} · Set ${currentSet} of ${totalSets}`].filter(Boolean).join(' · ')}
      onBack={saveOrExit} backLabel={hasProgress ? 'Finish and save Strength session' : 'Back to Strength'} progress={progressFraction} />}
    footer={phase === 'select' ? <>
      {!unavailable ? <StrengthButton title="Enable camera" icon="camera-outline" onPress={beginCamera} /> : null}
      <StrengthButton title="Continue guided" variant={unavailable ? 'primary' : 'secondary'} onPress={onFallback} />
    </> : working ? <SessionControls paused={phase === 'paused'} muted={muted} onPause={togglePause} onMute={() => setMuted(!muted)} onStop={stop} voiceAvailable={voiceAvailable} /> : null}>

    {phase === 'select' ? <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>{unavailable ? 'Move without a camera.' : 'A little guidance, your way.'}</Text>
      <Text style={s.body}>{unavailable ? 'Camera tracking is not available for this movement. You can follow the guided session instead.' : 'Bloom uses your camera for movement and basic form guidance. Your video stays on this device; it is not recorded or uploaded.'}</Text>
      {movement ? <MovementGuide exercise={movement} compact /> : null}
      {!unavailable ? <>
        <StrengthNote icon="phone-portrait-outline">Prop your phone securely with your full body in view. {EXERCISE_COPY[poseEngineId]?.view} works best.</StrengthNote>
      </> : null}
      <StrengthButton title={showSafety ? 'Hide privacy and safety' : 'Privacy and safety'} variant="ghost" icon="shield-checkmark-outline" onPress={() => setShowSafety(value => !value)} accessibilityState={{ expanded: showSafety }} />
      {showSafety ? <View style={s.details}><Text style={s.supporting}>{STRENGTH_COPY.cameraPrivacyBody}</Text><Text style={s.supporting}>{STRENGTH_COPY.safety}</Text></View> : null}
    </View> : null}

    {cameraActive ? <>
      {/* This same CameraStage remains mounted across rest and pause. Inference is controlled by the hook. */}
      <View style={[s.stageWrap, { height: cameraHeight }]}>
        <CameraStage active={cameraActive} inferenceActive={inferenceActive} showSkeleton={showSkeleton} onReady={cameraReady} onError={cameraError} onFrame={onFrame} />
      </View>
      {phase === 'loading' ? <Text style={s.supporting}>Allow camera access when your browser asks. First-time setup may take a moment.</Text> : null}
      {phase === 'calibrating' ? <View style={s.group}>
        <FramingGuide instruction={instruction} tone={calibrationGood ? 'good' : 'neutral'} />
        <Text style={s.supporting}>{EXERCISE_COPY[poseEngineId]?.view} · Keep your head and feet visible.</Text>
      </View> : null}
      {phase === 'ready' ? <View style={s.group}>
        <FramingGuide instruction="Your full body is in view." tone="good" />
        <StrengthButton title="Start exercise" icon="play-outline" onPress={startCountdown} />
      </View> : null}
      {phase === 'countdown' ? <View style={s.countdownWrap}>
        <Text accessibilityLiveRegion="polite" style={s.countdown}>{countdown || 'Go'}</Text>
        <Text style={s.supporting}>Settle into your starting position.</Text>
      </View> : null}
      {phase === 'between_sets' ? <View style={s.rest}>
        <Text accessibilityRole="header" style={s.heading}>Nice work. Catch your breath.</Text>
        <Text style={s.restTime} accessibilityLabel={`${restRemaining} seconds rest remaining`}>{formatTime(restRemaining)}</Text>
        <Text style={s.body}>{restRemaining ? `Next: set ${currentSet} of ${totalSets}` : 'Take more time if you need it.'}</Text>
        <Text style={s.supporting}>{targetReps} reps · {exercise?.name}</Text>
        <View style={s.fullWidth}><StrengthButton title={restRemaining ? 'Skip rest · I’m ready' : 'I’m ready'} onPress={continueSet} />
          <StrengthButton title="Add 15 seconds" variant="secondary" onPress={() => { restEndsAt.current = Math.max(Date.now(), restEndsAt.current) + 15000; setRestRemaining(Math.ceil((restEndsAt.current - Date.now()) / 1000)); }} />
          <StrengthButton title="Finish and save" variant="ghost" onPress={stop} />
        </View>
      </View> : null}
      {working ? <View style={s.group}>
        <View style={s.repRow}>
          <View accessible accessibilityLabel={`${reps} of ${targetReps} repetitions this set`}>
            <Animated.Text style={[s.repValue, { transform: [{ scale: repScale }] }]}>{String(reps).padStart(2, '0')}<Text style={s.repTarget}> / {targetReps}</Text></Animated.Text>
          </View>
          <View style={s.setInfo}><Text style={s.supporting}>Set {currentSet} of {totalSets}</Text><SetProgress current={currentSet} total={totalSets} /></View>
        </View>
        <FramingGuide tone={trackingPaused ? 'adjust' : 'neutral'} instruction={phase === 'paused' ? (trackingPaused ? cueText || 'Move back into view when you are ready.' : 'Paused. Take the time you need.') : cueText || 'Move at your own pace.'} icon={phase === 'paused' && !trackingPaused ? 'pause-outline' : undefined} />
      </View> : null}
      {phase !== 'countdown' && phase !== 'between_sets' ? <View style={s.group}>
        <StrengthButton title={showOptions ? 'Hide camera options' : 'Camera options'} variant="ghost" onPress={() => setShowOptions(value => !value)} accessibilityState={{ expanded: showOptions }} />
        {showOptions ? <View style={s.group}>
          <StrengthButton title={showSkeleton ? 'Hide pose lines' : 'Show pose lines'} variant="secondary" onPress={() => setShowSkeleton(!showSkeleton)} />
          {!hasProgress ? <StrengthButton title="Continue guided" variant="secondary" onPress={onFallback} /> : null}
          {!voiceAvailable ? <Text style={s.supporting}>{STRENGTH_COPY.voiceUnavailable}</Text> : null}
        </View> : null}
      </View> : null}
    </> : null}

    {phase === 'permission' ? <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>Let’s get you moving.</Text>
      <FramingGuide tone="important" instruction="Camera guidance is unavailable." />
      <Text style={s.body}>{cameraFailure?.message || STRENGTH_COPY.modelFailed}</Text>
      {hasProgress ? <><Text style={s.supporting}>Your completed reps are still here. Save them before starting another session.</Text><StrengthButton title="Finish and save" onPress={stop} /></> : <>
        <StrengthButton title="Try camera again" icon="camera-outline" onPress={beginCamera} />
        <StrengthButton title="Continue guided" variant="secondary" onPress={onFallback} />
      </>}
    </View> : null}
    {phase === 'saving' ? <View style={s.saving} accessibilityState={{ busy: true }}><ActivityIndicator color={c.accent} /><Text style={s.heading}>Saving your movement…</Text><Text style={s.body}>Keep this screen open for a moment.</Text></View> : null}
    {phase === 'summary' && summaryResult ? <StrengthSummary {...summaryResult} onDone={onNext || onExit} doneLabel={nextLabel || 'Done'}
      onAgain={onNext ? undefined : reset} localSaveError={localSaveError} savingLocal={localSavePending && !localSaveError} onRetryLocal={saveLocalHistory} /> : null}
    {phase === 'save_error' ? <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>Your result is still here.</Text>
      <StrengthNote tone="important" icon="alert-circle-outline">{summaryError}</StrengthNote>
      <StrengthButton title="Try saving again" onPress={retrySummary} />
    </View> : null}
  </StrengthScreenFrame>;
}

function phaseLabel(phase) {
  return { select: 'Camera setup', loading: 'Getting ready', calibrating: 'Find your position', ready: 'Ready', countdown: 'Get ready', active: 'Camera guidance', paused: 'Paused', between_sets: 'Rest', saving: 'Saving', summary: 'Session summary', permission: 'Camera help', save_error: 'Save pending' }[phase] || 'Strength';
}

const sheet = c => ({
  content: { gap: 16, paddingTop: 12 }, section: { gap: 20, paddingVertical: 12 }, group: { gap: 12 },
  title: { ...T.title, color: c.ink }, heading: { ...T.heading, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted },
  details: { gap: 16, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 },
  stageWrap: { width: '100%', borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  countdownWrap: { alignItems: 'center', gap: 8 }, countdown: { color: c.accent, fontSize: 44, lineHeight: 52, fontWeight: '600', fontVariant: ['tabular-nums'] },
  repRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  repValue: { color: c.ink, fontSize: 42, lineHeight: 52, fontWeight: '600', fontVariant: ['tabular-nums'] }, repTarget: { ...T.heading, color: c.muted },
  setInfo: { flex: 1, maxWidth: 160, gap: 12, alignItems: 'flex-end' },
  rest: { gap: 12, alignItems: 'center', paddingVertical: 8 }, restTime: { color: c.ink, fontSize: 48, lineHeight: 56, fontWeight: '600', fontVariant: ['tabular-nums'] },
  fullWidth: { width: '100%', gap: 8, marginTop: 8 }, saving: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
});
