import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useReducedMotion } from '../../components/Motion';
import { STRENGTH_COPY, EXERCISE_COPY } from './constants';
import { STRENGTH_TYPE as T, useStrengthStyles } from './strengthTheme';
import useStrengthSession from './useStrengthSession.web';
import { poseEngineIdForExercise } from './poseCapability';
import { resolveRestSeconds } from './engine/workoutProgression';
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

export default function TrackedStrengthScreen({ exercise, sets = 1, onExit, onFallback, onComplete, onNext, nextLabel, workoutProgress, nextExercise, onAdvance, onEndWorkout, TourTarget }) {
  const Target = TourTarget || View;
  const { user } = useAuth();
  const { height, width } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width, height: height - 180 });
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const reducedMotion = useReducedMotion();
  const poseEngineId = poseEngineIdForExercise(exercise?.id);
  const session = useStrengthSession({ uid: user?.uid, exerciseId: poseEngineId, sets, targetReps: exercise?.defaultReps, hasNext: Boolean(nextExercise) });
  const {
    phase, instruction, calibrationGood, countdown, reps, cueText, pauseReason,
    muted, setMuted, showSkeleton, setShowSkeleton, cameraFailure, unsupported,
    currentSet, totalSets, targetReps, beginCamera, cameraReady, cameraError, onFrame,
    startCountdown, togglePause, stop, continueSet, summaryResult, summaryError,
    reset, retrySummary, cameraActive, inferenceActive, voiceAvailable, hasProgress,
    transitionSaving, transitionSaveError, continueAfterRest, retryTransitionSave,
    beginResume,
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
  // Captured the moment the workout transition begins — at that instant the
  // props still describe the COMPLETED exercise (the parent advances the
  // index only after saving), so this is the reliable transition metadata.
  const restMetaRef = useRef(null);
  const advancedSummaryRef = useRef(null);
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const saveLocalHistory = useCallback(async () => {
    if (!summaryResult?.summary || saveAttempt.current.pending) return;
    const id = summaryResult.summary.id;
    if (savedSummaryId === id) return;
    saveAttempt.current = { id, pending: true };
    setLocalSaveError(null);
    const meta = phase === 'workout_rest' ? restMetaRef.current : null;
    const completedExercise = meta?.exercise || exercise;
    const completedSets = meta?.sets ?? sets;
    try {
      if (typeof completionRef.current !== 'function') throw new Error('save_handler_missing');
      await completionRef.current(historySummary(summaryResult, completedExercise), { exercise: completedExercise, sets: completedSets });
      if (mounted.current) setSavedSummaryId(id);
    } catch {
      if (mounted.current) setLocalSaveError('Your session is safe, but Bloom could not update your workout history. Try saving again before you leave.');
    } finally {
      saveAttempt.current.pending = false;
    }
  }, [exercise, phase, savedSummaryId, sets, summaryResult]);

  useEffect(() => {
    if ((phase === 'summary' || phase === 'workout_rest') && summaryResult?.summary && saveAttempt.current.id !== summaryResult.summary.id) {
      void saveLocalHistory();
    }
  }, [phase, saveLocalHistory, summaryResult]);

  // Must run before the rest-timer effects: captures completed-exercise facts
  // and asks the parent to advance the plan while this screen stays mounted.
  useEffect(() => {
    if (phase !== 'workout_rest') return undefined;
    restMetaRef.current = {
      exercise, sets,
      restSec: resolveRestSeconds(exercise?.restSec),
      nextName: nextExercise?.exercise?.name || 'Next movement',
    };
    return undefined;
    // [phase] only on purpose: capture happens on the first workout_rest
    // render, before the parent re-renders with the next exercise.
  }, [phase]);

  // Keep the completed exercise mounted until BOTH persistence paths finish.
  // Advancing to a guided player early would unmount this pending save.
  useEffect(() => {
    const id = summaryResult?.summary?.id;
    if (phase !== 'workout_rest' || transitionSaving || transitionSaveError || localSaveError
      || !id || savedSummaryId !== id || advancedSummaryRef.current === id) return;
    advancedSummaryRef.current = id;
    onAdvanceRef.current?.();
  }, [phase, transitionSaving, transitionSaveError, localSaveError, savedSummaryId, summaryResult]);

  const addRestSeconds = useCallback(() => {
    restEndsAt.current = Math.max(Date.now(), restEndsAt.current) + 15000;
    setRestRemaining(Math.ceil((restEndsAt.current - Date.now()) / 1000));
  }, []);

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

  // Workout rest (between exercises): the camera keeps running underneath.
  // Rest can finish in the background, but movement starts only on "I'm ready".
  useEffect(() => {
    if (phase !== 'workout_rest') return undefined;
    const restSeconds = restMetaRef.current?.restSec ?? 30;
    restEndsAt.current = Date.now() + restSeconds * 1000;
    setRestRemaining(restSeconds);
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((restEndsAt.current - Date.now()) / 1000));
      setRestRemaining(left);
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

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
  const transitionBlocked = phase === 'workout_rest' && (transitionSaving || Boolean(transitionSaveError)
    || !summaryResult?.summary || localSavePending || Boolean(localSaveError));
  const exitBlocked = ['saving', 'save_error'].includes(phase) || (phase === 'summary' && localSavePending);
  // During workout rest the current movement is already saved; leaving ends
  // the workout (no duplicate "stopped" record for the finished movement).
  const saveOrExit = phase === 'workout_rest'
    ? (transitionBlocked ? undefined : onEndWorkout)
    : (exitBlocked ? undefined : hasProgress ? stop : onExit);
  const landscape = width > height && height < 600;
  const contentWidth = Math.max(1, Math.min(680, viewport.width) - 40);
  const cameraWidth = landscape ? Math.max(1, (contentWidth - 16) * 0.55) : contentWidth;
  const cameraHeight = ['between_sets', 'workout_rest'].includes(phase) ? 144 : Math.max(120, Math.min(
    540, cameraWidth * videoSize.height / videoSize.width,
    landscape ? viewport.height - 24 : viewport.height - (working ? 180 : 100),
  ));
  const trackingPaused = phase === 'paused' && !['manual', 'page_hidden', 'background'].includes(pauseReason);
  const progressFraction = workoutProgress?.total > 0 ? (workoutProgress.current - 1) / workoutProgress.total : undefined;
  const progressLabel = workoutProgress?.total > 0 ? `Exercise ${workoutProgress.current} of ${workoutProgress.total}` : null;
  const movement = exercise || EXERCISE_COPY[poseEngineId];

  return <StrengthScreenFrame testID="strength-camera-screen" contentStyle={s.content} fitViewport
    onViewportLayout={event => setViewport(event.nativeEvent.layout)}
    header={<Target id="strength-workout-progress"><StrengthHeader title={exercise?.name || 'Camera guidance'} subtitle={[progressLabel, `${phaseLabel(phase)} · Set ${currentSet} of ${totalSets}`].filter(Boolean).join(' · ')}
      onBack={saveOrExit} backLabel={phase === 'workout_rest' ? 'Finish workout' : hasProgress ? 'Finish and save Strength session' : 'Back to Strength'} progress={progressFraction} /></Target>}
    footer={phase === 'select' ? <>
      {!unavailable ? <StrengthButton title="Enable camera" icon="camera-outline" onPress={beginCamera} /> : null}
      <StrengthButton title="Continue guided" variant={unavailable ? 'primary' : 'secondary'} onPress={onFallback} />
    </> : working ? <SessionControls TourTarget={TourTarget} paused={phase === 'paused'} muted={muted} onPause={togglePause} onMute={() => setMuted(!muted)} onStop={stop} voiceAvailable={voiceAvailable} />
      : cameraActive && (phase === 'ready' || voiceAvailable) ? <View style={s.readyControls}>
        {phase === 'ready' ? <StrengthButton title="Start exercise" icon="play-outline" onPress={startCountdown} style={s.growButton} /> : null}
        {voiceAvailable ? <StrengthButton title={muted ? 'Unmute' : 'Mute'} icon={muted ? 'volume-mute-outline' : 'volume-high-outline'} variant="secondary" onPress={() => setMuted(!muted)} style={phase !== 'ready' && s.growButton} /> : null}
      </View> : null}>

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

    {cameraActive ? <View style={[s.cameraLayout, landscape && s.cameraLandscape]}>
      {/* This same CameraStage remains mounted across rest, transitions and pause. Inference is controlled by the hook. */}
      <View style={[s.stageWrap, { height: cameraHeight }, landscape && { width: cameraWidth }]}>
        <CameraStage active={cameraActive} inferenceActive={inferenceActive} showSkeleton={showSkeleton} showIndicator={false} onReady={cameraReady} onError={cameraError} onFrame={onFrame} onVideoSize={setVideoSize} />
      </View>
      <View style={[s.cameraDetails, landscape && s.landscapeDetails]}>
      {phase !== 'loading' ? <Text style={s.supporting}>{STRENGTH_COPY.activeCamera}</Text> : null}
      {phase === 'loading' ? <Text style={s.supporting}>Allow camera access when your browser asks. First-time setup may take a moment.</Text> : null}
      {phase === 'calibrating' ? <View style={s.group}>
        <FramingGuide instruction={instruction} tone={calibrationGood ? 'good' : 'adjust'} />
        <Text style={s.supporting}>{EXERCISE_COPY[poseEngineId]?.view} · Keep your head and feet visible.</Text>
      </View> : null}
      {phase === 'ready' ? <View style={s.group}>
        <FramingGuide instruction="Your full body is in view." tone="good" />
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
          <StrengthButton title="Add 15 seconds" variant="secondary" onPress={addRestSeconds} />
          <StrengthButton title="Finish and save" variant="ghost" onPress={stop} />
        </View>
      </View> : null}
      {phase === 'resuming' ? <View style={s.rest}>
        <Text accessibilityRole="header" style={s.heading}>{STRENGTH_COPY.resumePrompt}</Text>
        <Text style={s.body}>{STRENGTH_COPY.resumeHelp}</Text>
        {reps > 0 ? <Text style={s.supporting}>{String(reps).padStart(2, '0')} of {targetReps} reps kept this set</Text> : null}
        <FramingGuide tone={calibrationGood ? 'good' : 'neutral'} instruction={instruction} />
        <View style={s.fullWidth}>
          <StrengthButton title={STRENGTH_COPY.resume} icon="play-outline" onPress={beginResume} />
          <StrengthButton title="Finish and save" variant="ghost" onPress={stop} />
        </View>
      </View> : null}
      {phase === 'workout_rest' ? <View style={s.rest}>
        <Text accessibilityRole="header" style={s.heading}>Nice work. Catch your breath.</Text>
        <Text style={s.restTime} accessibilityLabel={`${restRemaining} seconds rest remaining`}>{formatTime(restRemaining)}</Text>
        <Text style={s.body}>Next: {restMetaRef.current?.nextName || 'Next movement'}</Text>
        <Text style={s.supporting}>{restMetaRef.current?.exercise?.name || ''} · done</Text>
        {transitionSaving ? <Text style={s.supporting}>Saving this movement…</Text> : null}
        {transitionSaveError ? <View style={s.group}>
          <StrengthNote tone="important" icon="alert-circle-outline">{transitionSaveError}</StrengthNote>
          <StrengthButton title="Try saving again" variant="secondary" onPress={retryTransitionSave} />
        </View> : null}
        {localSaveError ? <View style={s.group}>
          <StrengthNote tone="important" icon="alert-circle-outline">{localSaveError}</StrengthNote>
          <StrengthButton title="Retry workout history save" variant="secondary" onPress={saveLocalHistory} />
        </View> : null}
        <FramingGuide tone={calibrationGood ? 'good' : 'neutral'} instruction={instruction} />
        <View style={s.fullWidth}>
          <StrengthButton title={transitionBlocked ? 'Saving your movement…' : restRemaining ? 'Skip rest · I’m ready' : 'I’m ready'} disabled={transitionBlocked} onPress={continueAfterRest} />
          <StrengthButton title="Add 15 seconds" variant="secondary" onPress={addRestSeconds} />
          {onEndWorkout ? <StrengthButton title="Finish workout" variant="ghost" disabled={transitionBlocked} onPress={onEndWorkout} /> : null}
        </View>
      </View> : null}
      {working ? <View style={s.group}>
        <Target id="strength-reps"><View style={s.repRow}>
          <View accessible accessibilityLabel={`${reps} of ${targetReps} repetitions this set`}>
            <Animated.Text style={[s.repValue, { transform: [{ scale: repScale }] }]}>{String(reps).padStart(2, '0')}<Text style={s.repTarget}> / {targetReps}</Text></Animated.Text>
          </View>
          <View style={s.setInfo}><Text style={s.supporting}>Set {currentSet} of {totalSets}</Text><SetProgress current={currentSet} total={totalSets} /></View>
        </View></Target>
        <Target id="strength-guidance"><FramingGuide tone={trackingPaused ? 'adjust' : 'neutral'} instruction={phase === 'paused' ? (trackingPaused ? cueText || 'Move back into view when you are ready.' : 'Paused. Take the time you need.') : cueText || 'Move at your own pace.'} icon={phase === 'paused' && !trackingPaused ? 'pause-outline' : undefined} /></Target>
      </View> : null}
      {phase !== 'countdown' && phase !== 'between_sets' && phase !== 'workout_rest' && phase !== 'resuming' ? <View style={s.group}>
        <StrengthButton title={showOptions ? 'Hide camera options' : 'Camera options'} variant="ghost" onPress={() => setShowOptions(value => !value)} accessibilityState={{ expanded: showOptions }} />
        {showOptions ? <View style={s.group}>
          <StrengthButton title={showSkeleton ? 'Hide pose lines' : 'Show pose lines'} variant="secondary" onPress={() => setShowSkeleton(!showSkeleton)} />
          {!hasProgress ? <StrengthButton title="Continue guided" variant="secondary" onPress={onFallback} /> : null}
          {!voiceAvailable ? <Text style={s.supporting}>{STRENGTH_COPY.voiceUnavailable}</Text> : null}
        </View> : null}
      </View> : null}
      </View>
    </View> : null}

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
  return { select: 'Camera setup', loading: 'Getting ready', calibrating: 'Find your position', ready: 'Ready', countdown: 'Get ready', active: 'Camera guidance', paused: 'Paused', resuming: 'Ready to continue', between_sets: 'Rest', workout_rest: 'Rest', saving: 'Saving', summary: 'Session summary', permission: 'Camera help', save_error: 'Save pending' }[phase] || 'Strength';
}

const sheet = c => ({
  content: { gap: 16, paddingTop: 12 }, section: { gap: 20, paddingVertical: 12 }, group: { gap: 12 },
  title: { ...T.title, color: c.ink }, heading: { ...T.heading, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted },
  details: { gap: 16, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 },
  stageWrap: { width: '100%', borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  cameraLayout: { gap: 16, minWidth: 0 }, cameraLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  cameraDetails: { gap: 16, minWidth: 0 }, landscapeDetails: { flex: 1 },
  readyControls: { flexDirection: 'row', gap: 8 }, growButton: { flex: 1 },
  countdownWrap: { alignItems: 'center', gap: 8 }, countdown: { color: c.accent, fontSize: 44, lineHeight: 52, fontWeight: '600', fontVariant: ['tabular-nums'] },
  repRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  repValue: { color: c.ink, fontSize: 42, lineHeight: 52, fontWeight: '600', fontVariant: ['tabular-nums'] }, repTarget: { ...T.heading, color: c.muted },
  setInfo: { flex: 1, maxWidth: 160, gap: 12, alignItems: 'flex-end' },
  rest: { gap: 12, alignItems: 'center', paddingVertical: 8 }, restTime: { color: c.ink, fontSize: 48, lineHeight: 56, fontWeight: '600', fontVariant: ['tabular-nums'] },
  fullWidth: { width: '100%', gap: 8, marginTop: 8 }, saving: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
});
