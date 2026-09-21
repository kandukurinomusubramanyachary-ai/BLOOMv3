import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { STRENGTH_COPY, STRENGTH_DEFAULTS } from './constants';
import { exerciseById } from './exercises';
import { midpoint, point } from './engine/jointAngles';
import { createCueScheduler } from './engine/cueScheduler';
import { createPositioningCoach } from './engine/positioningCoach';
import { createRepStateMachine } from './engine/repStateMachine';
import { decideOnSetComplete } from './engine/workoutProgression';
import { decideOnFocusLost, decideOnFocusGained } from './engine/sessionRetention';
import { normalizeSetCount, resolveTargetReps } from './poseCapability';
import { buildStrengthFocus, buildStrengthObservation } from './engine/strengthSummary';
import { createVoiceCoach } from './services/voiceCoach';
import { flushStrengthOutbox, saveStrengthSummary } from './services/strengthStorage';
import { trackStrengthEvent } from './services/strengthAnalytics';
import { describeCameraError } from './services/cameraSession';

function sessionId() {
  return `strength-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function baselineFrom(landmarks) {
  const leftVisibility = [11, 23, 25, 27].reduce((sum, id) => sum + Number(point(landmarks, id)?.visibility || 0), 0);
  const rightVisibility = [12, 24, 26, 28].reduce((sum, id) => sum + Number(point(landmarks, id)?.visibility || 0), 0);
  return {
    activeSide: rightVisibility > leftVisibility ? 'right' : 'left',
    shoulderMid: midpoint(point(landmarks, 11), point(landmarks, 12)),
    hipMid: midpoint(point(landmarks, 23), point(landmarks, 24)),
    hipDeviation: 0,
  };
}

function freshRuntime() {
  return {
    engine: null, scheduler: null, positioning: null,
    calibrationCompleted: false, baseline: null,
    startedAt: null, exerciseStartedAt: null, pausedAt: null,
    pauseCount: 0, repDurations: [], cueCounts: {},
    ended: false,
    // "One camera, one workout" transition state.
    transitioning: false, autoStart: false,
    transitionFramingReady: false, pendingTransition: null,
    geometry: null, positioningMirror: undefined,
    // Set when leaving a started session (tab switch / page hidden) so the
    // return can offer "Ready to continue?" instead of restarting.
    returning: false,
  };
}

export default function useStrengthSession({
  uid,
  exerciseId: requestedExerciseId,
  sets = 1,
  targetReps: requestedTargetReps,
  hasNext = false,
}) {
  const focused = useIsFocused();
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const foreground = focused && pageVisible;
  // exerciseId is the pose ENGINE id (e.g. bodyweight-squat-v1), passed
  // explicitly by the screen. It is NOT defaulted to squat here: if it is
  // invalid/unsupported the hook reports `unsupported` instead of silently
  // running the squat engine.
  const [phase, setPhase] = useState('select');
  const [currentSet, setCurrentSet] = useState(1);
  const exerciseId = requestedExerciseId;
  const [instruction, setInstruction] = useState('Looking for you…');
  const [calibrationGood, setCalibrationGood] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const exercise = useMemo(() => exerciseById(exerciseId), [exerciseId]);
  const targetReps = useMemo(() => resolveTargetReps(exercise, requestedTargetReps, STRENGTH_DEFAULTS.targetReps), [exercise, requestedTargetReps]);
  const totalSets = normalizeSetCount(sets);
  const currentSetRef = useRef(1);
  const totalSetsRef = useRef(totalSets);
  const targetRepsRef = useRef(targetReps);
  const totalRepsRef = useRef(0);
  const completedSetsRef = useRef(0);
  const exerciseRepsRef = useRef(0); // Reps for the CURRENT exercise only (summaries are per-exercise).
  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;
  totalSetsRef.current = totalSets;
  targetRepsRef.current = targetReps;
  // Set + exercise orchestration lives OUTSIDE the rep engine (which handles one set).
  const unsupported = !exercise;
  const [reps, setReps] = useState(0);
  const [pauseReason, setPauseReason] = useState(null);
  const voice = useRef(null);
  if (!voice.current) voice.current = createVoiceCoach({ rate: STRENGTH_DEFAULTS.speechRate, pitch: STRENGTH_DEFAULTS.speechPitch });
  const [muted, updateMuted] = useState(() => voice.current.muted);
  const formSince = useRef(new Map());
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [cueText, setCueText] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [cameraFailure, setCameraFailure] = useState(null);
  const [transitionSaving, setTransitionSaving] = useState(false);
  const [transitionSaveError, setTransitionSaveError] = useState(null);
  const runtime = useRef(freshRuntime());
  const pendingSummary = useRef(null);
  const summarySaveLock = useRef(false);
  const cameraLaunchLock = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const setMuted = useCallback(value => {
    voice.current.setMuted(value);
    updateMuted(Boolean(value));
    if (!value) voice.current.activate('Voice guidance on.', { allowWhilePaused: true });
  }, []);
  useEffect(() => () => voice.current.dispose(), []);
  useEffect(() => {
    voice.current.clearChannel('positioning');
    if ((phase !== 'calibrating' && phase !== 'workout_rest') || calibrationGood) return undefined;
    const timer = setTimeout(() => voice.current.speak(instruction, {
      id: `position:${instruction}`, channel: 'positioning', priority: 70, cooldownMs: 10000,
    }), 600);
    return () => clearTimeout(timer);
  }, [phase, instruction, calibrationGood]);
  useEffect(() => {
    const flush = () => flushStrengthOutbox(uid).catch((error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Strength] Background sync could not read or write the local outbox.', error);
      }
    });
    void flush();
    const timers = STRENGTH_DEFAULTS.outboxRetryMs.map((delay) => setTimeout(() => {
      void flush();
    }, delay));
    return () => timers.forEach(clearTimeout);
  }, [uid]);

  const resetRuntime = useCallback(() => {
    runtime.current = freshRuntime();
    cameraLaunchLock.current = false;
    formSince.current.clear();
    setCameraFailure(null);
    voice.current.cancel(); setReps(0); setCueText(''); setPauseReason(null); setCalibrationGood(false); setInstruction('Looking for you…');
    currentSetRef.current = 1; setCurrentSet(1); totalRepsRef.current = 0; completedSetsRef.current = 0; exerciseRepsRef.current = 0;
    setTransitionSaving(false); setTransitionSaveError(null);
  }, []);

  const persistPendingSummary = useCallback(async (pending, options = {}) => {
    if (!pending || summarySaveLock.current) return;
    const nextPhase = options.nextPhase || 'summary';
    summarySaveLock.current = true;
    setSavingSummary(true);
    setSummaryError(null);
    try {
      const saved = await saveStrengthSummary(uid, pending.summary);
      pendingSummary.current = null;
      setSummaryResult({
        ...saved,
        observation: buildStrengthObservation(saved.summary, pending.repDurations),
        focus: buildStrengthFocus(saved.summary.cueCounts || {}),
      });
      setPhase(nextPhase);
      trackStrengthEvent(pending.eventName, pending.eventProperties);
    } catch (error) {
      setSummaryError('Bloom could not save this set on your device. Your result is still here—please try again.');
      setPhase('save_error');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Strength] Session summary persistence failed.', error);
      }
    } finally {
      summarySaveLock.current = false;
      setSavingSummary(false);
    }
  }, [uid]);

  const finish = useCallback(async (completionState = 'stopped', acceptedReps = exerciseRepsRef.current + (runtime.current.engine?.snapshot().reps || 0)) => {
    if (!exercise) return;
    const current = runtime.current;
    if (current.ended) return;
    if (!current.startedAt) { setPhase('select'); return; }
    if (phaseRef.current === 'workout_rest') {
      // The current movement already saved itself when the workout transition
      // began. Ending the workout must not write a duplicate record.
      current.ended = true;
      voice.current.cancel();
      setPhase('select');
      return;
    }
    current.ended = true;
    voice.current.cancel();
    if (completionState === 'completed') voice.current.resume('All sets complete. Nice work. Take a moment to recover.');
    setPhase('saving');
    const exerciseStartedAt = current.exerciseStartedAt || current.startedAt;
    const completedAt = new Date();
    const safeSummary = {
      id: sessionId(), exerciseId: exercise.id, exerciseVersion: exercise.exerciseVersion,
      startedAt: exerciseStartedAt.toISOString(), completedAt: completedAt.toISOString(),
      durationSeconds: Math.max(1, Math.round((completedAt - exerciseStartedAt) / 1000)),
      targetReps, acceptedReps, totalSets, completedSets: completedSetsRef.current,
      pauseCount: current.pauseCount, cueCounts: current.scheduler?.snapshot() || {},
      completionState, platform: Platform.OS, privacyVersion: 1,
    };
    const pending = {
      summary: safeSummary,
      repDurations: [...current.repDurations],
      eventName: completionState === 'completed' ? 'strength_session_completed' : 'strength_session_stopped',
      eventProperties: { exerciseId: exercise.id, completionState, acceptedReps, targetReps, totalSets, platform: Platform.OS },
    };
    pendingSummary.current = pending;
    await persistPendingSummary(pending);
  }, [exercise, persistPendingSummary, reps, targetReps, totalSets]);

  // One camera, one workout: the final set of a non-final exercise saves this
  // movement and enters workout rest WITHOUT stopping the camera. The parent
  // advances the plan index; the exercise-change effect below swaps the rep
  // engine and re-framing target while the same camera session keeps running.
  const beginExerciseTransition = useCallback(async () => {
    const current = runtime.current;
    if (!exercise || current.transitioning || current.ended) return;
    current.transitioning = true;
    current.autoStart = true;
    current.transitionFramingReady = false;
    current.calibrationCompleted = false;
    current.engine = null;
    const cueCounts = current.scheduler?.snapshot() || {};
    current.scheduler = createCueScheduler();
    formSince.current.clear();
    currentSetRef.current = 1;
    setReps(0); setCueText(''); setCalibrationGood(false); setPauseReason(null);
    setPhase('workout_rest');
    setSummaryResult(null);
    setTransitionSaving(true); setTransitionSaveError(null);
    voice.current.resume(STRENGTH_COPY.transitionBreath);
    const exerciseStartedAt = current.exerciseStartedAt || current.startedAt;
    const completedAt = new Date();
    const safeSummary = {
      id: sessionId(), exerciseId: exercise.id, exerciseVersion: exercise.exerciseVersion,
      startedAt: exerciseStartedAt.toISOString(), completedAt: completedAt.toISOString(),
      durationSeconds: Math.max(1, Math.round((completedAt - exerciseStartedAt) / 1000)),
      targetReps, acceptedReps: exerciseRepsRef.current, totalSets,
      completedSets: completedSetsRef.current,
      pauseCount: current.pauseCount, cueCounts,
      completionState: 'completed', platform: Platform.OS, privacyVersion: 1,
    };
    const pending = {
      summary: safeSummary,
      repDurations: [...current.repDurations],
      eventName: 'strength_session_completed',
      eventProperties: { exerciseId: exercise.id, completionState: 'completed', acceptedReps: exerciseRepsRef.current, targetReps, totalSets, platform: Platform.OS },
    };
    current.pendingTransition = pending;
    try {
      const saved = await saveStrengthSummary(uid, safeSummary);
      if (current.pendingTransition?.summary.id === safeSummary.id) current.pendingTransition = null;
      setTransitionSaving(false); setTransitionSaveError(null);
      setSummaryResult({
        ...saved,
        observation: buildStrengthObservation(saved.summary, pending.repDurations),
        focus: buildStrengthFocus(saved.summary.cueCounts || {}),
      });
      trackStrengthEvent(pending.eventName, pending.eventProperties);
    } catch (error) {
      setTransitionSaving(false);
      setTransitionSaveError('This movement is safe. Bloom could not save it on your device — try again below.');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Strength] Workout transition save failed.', error);
      }
    }
  }, [exercise, targetReps, totalSets, uid]);

  const retryTransitionSave = useCallback(async () => {
    const pending = runtime.current.pendingTransition;
    if (!pending || summarySaveLock.current) return;
    summarySaveLock.current = true;
    setTransitionSaving(true);
    try {
      const saved = await saveStrengthSummary(uid, pending.summary);
      runtime.current.pendingTransition = null;
      setTransitionSaveError(null);
      setSummaryResult({
        ...saved,
        observation: buildStrengthObservation(saved.summary, pending.repDurations),
        focus: buildStrengthFocus(saved.summary.cueCounts || {}),
      });
      trackStrengthEvent(pending.eventName, pending.eventProperties);
    } catch {
      setTransitionSaveError('This movement is safe. Bloom could not save it on your device — try again below.');
    } finally {
      summarySaveLock.current = false;
      setTransitionSaving(false);
    }
  }, [uid]);

  const onFrame = useCallback((frame) => {
    if (!exercise || !foreground || document.hidden) return;
    const current = runtime.current;

    const mirrored = frame.mirrored ?? true;
    const geometry = frame.sourceWidth && frame.sourceHeight ? `${frame.sourceWidth}:${frame.sourceHeight}:${mirrored}` : null;
    const geometryChanged = geometry && current.geometry && geometry !== current.geometry;
    if (geometry) current.geometry = geometry;
    if (geometryChanged) {
      current.positioning = null;
      current.calibrationCompleted = false;
      current.transitionFramingReady = false;
      current.engine?.interrupt(); // Drops only the partial rep; accepted reps survive.
      formSince.current.clear();
      if (phase === 'active' || phase === 'paused') {
        current.pauseCount += 1;
        setPauseReason(null);
        setCalibrationGood(false);
        setInstruction('Camera view changed. Hold your full body in view.');
        setPhase('calibrating');
        voice.current.resume('Camera view changed. Hold your full body in view before continuing.');
        return;
      }
    }
    // "Ready to continue?": framing runs so the guide is live, but nothing
    // auto-advances — the user taps Resume to start the quick re-framing.
    if (phase === 'resuming') {
      if (!current.positioning || current.positioningMirror !== mirrored) {
        current.positioningMirror = mirrored;
        current.positioning = createPositioningCoach({
          cameraView: exercise.camera,
          mirrored,
          readyHoldMs: STRENGTH_DEFAULTS.baselineHoldMs,
        });
      }
      const positioning = current.positioning.process(frame);
      if (positioning.shouldPublish) {
        setInstruction(positioning.instruction);
        setCalibrationGood(Boolean(positioning.ok));
      }
      return;
    }
    if (['workout_rest', 'calibrating', 'ready', 'countdown'].includes(phase)) {
      // Wait for the completed movement to be saved and the parent to advance.
      if (phase === 'workout_rest' && current.transitioning) return;
      if (!current.positioning || current.positioningMirror !== mirrored) {
        current.positioningMirror = mirrored;
        current.positioning = createPositioningCoach({
          cameraView: exercise.camera,
          mirrored,
          readyHoldMs: STRENGTH_DEFAULTS.baselineHoldMs,
        });
      }
      const positioning = current.positioning.process(frame);
      if (positioning.shouldPublish) {
        setInstruction(positioning.instruction);
        setCalibrationGood(Boolean(positioning.ok));
      }
      // Keep checking after "ready" and during the countdown. A user who
      // steps out of frame must re-establish framing before the set starts.
      if (!positioning.ready && phase !== 'calibrating' && phase !== 'workout_rest') {
        current.calibrationCompleted = false;
        setCalibrationGood(false);
        setInstruction(positioning.instruction);
        voice.current.cancel();
        setCountdown(3);
        setPhase('calibrating');
      }
      if (positioning.ready && phase === 'calibrating' && !current.calibrationCompleted) {
        current.calibrationCompleted = true;
        if (current.startedAt && current.engine) {
          Object.assign(current.baseline, baselineFrom(frame.landmarks));
          current.engine.interrupt();
        } else {
          current.baseline = baselineFrom(frame.landmarks);
          current.engine = createRepStateMachine(exercise, current.baseline);
        }
        if (!current.scheduler) current.scheduler = createCueScheduler();
        if (current.autoStart) {
          // Mid-workout transition: the user already pressed into the rest,
          // so a good frame goes straight to the 3-second start.
          current.autoStart = false;
          setInstruction(STRENGTH_COPY.fullBody);
          setCalibrationGood(true);
          trackStrengthEvent('strength_calibration_result', { exerciseId: exercise.id, result: 'ready', platform: Platform.OS });
          setCountdown(3);
          setPhase('countdown');
          voice.current.resume(STRENGTH_COPY.readyThree);
        } else {
          setInstruction(STRENGTH_COPY.fullBody); setPhase('ready');
          voice.current.speak('Your full body is in view. Start when you are ready.', { channel: 'session', priority: 90, interrupt: true });
          trackStrengthEvent('strength_calibration_result', { exerciseId: exercise.id, result: 'ready', platform: Platform.OS });
        }
        return;
      }
      if (phase === 'workout_rest' && positioning.ready && !current.engine) {
        // Pre-stage the next movement while the user rests: baseline + fresh
        // rep engine for the (already swapped-in) exercise config.
        // workout_rest only exists mid-transition; the exercise-change effect
        // has already cleared `transitioning`, so it must not gate this.
        current.baseline = baselineFrom(frame.landmarks);
        current.engine = createRepStateMachine(exercise, current.baseline);
        current.scheduler = createCueScheduler();
        current.transitionFramingReady = true;
        setInstruction(STRENGTH_COPY.fullBody);
        setCalibrationGood(true);
      }
      return;
    }
    const trackingPause = phase === 'paused' && !['manual', 'page_hidden', 'background'].includes(pauseReason);
    if ((phase !== 'active' && !trackingPause) || !current.engine) return;
    const output = current.engine.process(frame);
    const candidates = [];
    let trackingBlocked = trackingPause;
    let setFinished = false;
    output.events.forEach((event) => {
      if (event.type === 'pauseRequested') {
        trackingBlocked = true;
        formSince.current.clear();
        current.pauseCount += 1; setPauseReason(event.reason); setPhase('paused');
        setCueText(event.reason === 'multi_person' ? STRENGTH_COPY.onePerson : 'I lost a clear view. Return to your starting position when ready.');
        voice.current.pause(event.reason === 'multi_person' ? STRENGTH_COPY.onePerson : 'Paused. Return to your starting position so I can see you clearly.');
      }
      if (event.type === 'stateChanged' && event.from === 'paused') {
        trackingBlocked = false;
        setPauseReason(null); setCueText('Clear view restored. Continue when you are ready.'); setPhase('active');
        voice.current.resume('Clear view restored. Continue when you are ready.');
      }
      if (event.type === 'repAccepted') {
        current.repDurations.push(event.durationMs); setReps(event.count);
        if (targetRepsRef.current >= 6 && event.count === Math.ceil(targetRepsRef.current / 2)) {
          voice.current.speak('Halfway through this set.', { id: `halfway:${currentSetRef.current}`, channel: 'milestone', priority: 30, dropIfBusy: true });
        }
        // Set orchestration happens OUTSIDE the rep engine. `event.count` is
        // the number of reps completed in THIS set (the engine is recreated per
        // set), so compare it against the per-set targetReps.
        if (event.count >= targetRepsRef.current) {
          setFinished = true;
          formSince.current.clear();
          totalRepsRef.current += event.count;
          exerciseRepsRef.current += event.count;
          completedSetsRef.current += 1;
          const decision = decideOnSetComplete({
            currentSet: currentSetRef.current,
            totalSets: totalSetsRef.current,
            hasNext: hasNextRef.current,
          });
          if (decision === 'next-set') {
            // Advanced to the next set: fresh engine, reset rep counter.
            current.engine = createRepStateMachine(exercise, current.baseline);
            currentSetRef.current += 1; setCurrentSet(currentSetRef.current);
            setReps(0); setPauseReason(null); setCueText(`${currentSetRef.current}/${totalSetsRef.current} — press Continue when ready.`);
            setPhase('between_sets');
            voice.current.resume('Set complete. Take a breath before the next set.');
          } else if (decision === 'workout-transition') {
            // Final set of a non-final exercise: camera stays live.
            void beginExerciseTransition();
          } else {
            void finish('completed', exerciseRepsRef.current);
          }
        }
      }
      if (event.type === 'cueCondition') candidates.push(event.cue);
    });
    if (setFinished || trackingBlocked || current.ended) return;
    const present = new Set(candidates.map(cue => cue.id));
    let conditionResolved = false;
    for (const id of formSince.current.keys()) {
      if (!present.has(id)) { formSince.current.delete(id); conditionResolved = true; }
    }
    if (conditionResolved || !candidates.length) voice.current.clearChannel('form');
    const stableCandidates = candidates.filter(cue => {
      if (!formSince.current.has(cue.id)) formSince.current.set(cue.id, frame.ts);
      return frame.ts - formSince.current.get(cue.id) >= 600;
    });
    const scheduled = current.scheduler.schedule(stableCandidates, frame.ts);
    if (scheduled) {
      setCueText(scheduled.cue.text);
      voice.current.speak(scheduled.cue.text, { id: scheduled.cue.id, channel: 'form', priority: scheduled.cue.priority, cooldownMs: scheduled.cue.cooldownMs, ttlMs: 4000 });
    }
  }, [beginExerciseTransition, exercise, finish, foreground, pauseReason, phase]);

  const beginCamera = useCallback(() => {
    if (!exercise) return;
    if (cameraLaunchLock.current) return;
    resetRuntime();
    voice.current.resume('Camera guidance on. Step back until your full body is in view.');
    cameraLaunchLock.current = true;
    setPhase('loading');
    trackStrengthEvent('strength_camera_requested', { exerciseId: exercise.id, platform: Platform.OS });
  }, [exercise, resetRuntime]);
  const cameraReady = useCallback(() => {
    if (!exercise) return;
    cameraLaunchLock.current = false;
    setPhase('calibrating');
    trackStrengthEvent('strength_camera_result', { exerciseId: exercise.id, result: 'granted', platform: Platform.OS });
  }, [exercise]);
  const cameraError = useCallback((error) => {
    if (!exercise) return;
    cameraLaunchLock.current = false;
    const failure = describeCameraError(error);
    voice.current.cancel();
    setInstruction(failure.message);
    setCameraFailure(failure);
    setPhase('permission');
    trackStrengthEvent('strength_camera_result', { exerciseId: exercise.id, result: failure.kind === 'denied' ? 'denied' : 'failed', platform: Platform.OS });
  }, [exercise]);
  const leaveCamera = useCallback((nextPhase = 'permission') => {
    resetRuntime();
    setPhase(nextPhase);
  }, [resetRuntime]);
  const startCountdown = useCallback(() => {
    if (!foreground || document.hidden) return;
    setCountdown(3); setPhase('countdown'); voice.current.resume(STRENGTH_COPY.readyThree);
  }, [foreground]);

  // Workout rest ended (timer or "I'm ready"): a pre-staged engine goes
  // straight to the 3-second start; anything else gets a quick re-framing.
  const continueAfterRest = useCallback(() => {
    if (phaseRef.current !== 'workout_rest' || !foreground || document.hidden
      || transitionSaving || runtime.current.pendingTransition || runtime.current.transitioning) return;
    const current = runtime.current;
    if (current.engine) {
      startCountdown();
    } else {
      current.autoStart = true;
      setCalibrationGood(false);
      setPhase('calibrating');
      voice.current.resume(STRENGTH_COPY.transitionFindYou);
    }
  }, [foreground, startCountdown, transitionSaving]);

  // "Ready to continue?" → fresh framing hold → 3-2-1. The engine — with
  // its accepted reps — is re-armed in the calibrating branch below.
  const beginResume = useCallback(() => {
    const current = runtime.current;
    if (phaseRef.current !== 'resuming') return;
    current.returning = false;
    current.positioning = null;
    current.calibrationCompleted = false;
    current.autoStart = true;
    setCalibrationGood(false);
    setPauseReason(null);
    setCueText('');
    setInstruction(STRENGTH_COPY.transitionFindYou);
    setPhase('calibrating');
  }, []);

  // Continuous workout: the parent advances the plan index while this hook
  // stays mounted (same camera). Swap per-exercise state, never the camera.
  const prevExerciseIdRef = useRef(requestedExerciseId);
  useEffect(() => {
    if (requestedExerciseId === prevExerciseIdRef.current) return undefined;
    const current = runtime.current;
    prevExerciseIdRef.current = requestedExerciseId;
    const next = exerciseById(requestedExerciseId);
    if (!next || !current.transitioning || !current.startedAt) {
      // Not a continuous transition (fresh mount, error recovery, or the
      // camera is gone): fall back to the clean start.
      resetRuntime();
      setPhase('select');
      return undefined;
    }
    current.transitioning = false;
    currentSetRef.current = 1; setCurrentSet(1);
    completedSetsRef.current = 0;
    exerciseRepsRef.current = 0;
    current.exerciseStartedAt = null;
    current.pauseCount = 0;
    current.repDurations = [];
    current.engine = null;
    current.scheduler = createCueScheduler();
    current.calibrationCompleted = false;
    current.transitionFramingReady = false;
    current.positioning = null; // Recreated with the next exercise's camera view.
    formSince.current.clear();
    setReps(0); setCueText(''); setCalibrationGood(false); setPauseReason(null);
    setInstruction('Setting up for the next movement…');
    return undefined;
  }, [requestedExerciseId, resetRuntime]);

  useEffect(() => {
    if (phase !== 'countdown' || !foreground || document.hidden) return undefined;
    if (countdown <= 0) {
      // Keep the session's start time across multiple sets; only re-arm `ended`.
      if (!runtime.current.startedAt) runtime.current.startedAt = new Date();
      if (!runtime.current.exerciseStartedAt) runtime.current.exerciseStartedAt = new Date();
      runtime.current.ended = false; setPhase('active'); setCueText('Move when you are ready.');
      trackStrengthEvent('strength_session_started', { exerciseId: exercise.id, exerciseVersion: exercise.exerciseVersion, platform: Platform.OS });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, exercise, foreground, phase]);

  const togglePause = useCallback(() => {
    if (!['active', 'paused'].includes(phase)) return;
    runtime.current.engine?.interrupt();
    formSince.current.clear();
    if (phase === 'paused') { setPauseReason(null); setCueText('Return to your starting position, then continue.'); setPhase('active'); voice.current.resume('Resuming. Return to your starting position, then continue.'); }
    else { runtime.current.pauseCount += 1; setPauseReason('manual'); setCueText(STRENGTH_COPY.manualPause); setPhase('paused'); voice.current.pause(STRENGTH_COPY.manualPause); trackStrengthEvent('strength_session_paused', { exerciseId: exercise.id, reason: 'manual', platform: Platform.OS }); }
  }, [exercise?.id, phase]);

  // Leaving Strength (tab switch / blur) must never destroy a running
  // workout: pause the set, keep accepted reps, exercise, set and the
  // parent workout index, then offer "Ready to continue?" on the way back.
  useEffect(() => {
    const current = runtime.current;
    if (!foreground) {
      voice.current.cancel();
      const action = decideOnFocusLost({ phase: phaseRef.current, started: Boolean(current.startedAt) });
      if (action === 'pause') {
        current.engine?.interrupt(); // drops only the partial rep; accepted reps survive
        current.pauseCount += 1;
        setPauseReason('background');
        setCueText(STRENGTH_COPY.backgroundPause);
        setPhase('paused');
        current.returning = true;
      } else if (action === 'rollback') {
        setPhase('ready');
        setCountdown(3);
        current.returning = true;
      }
      // 'keep': pre-start setup and wall-clock rest phases simply continue;
      // nothing is reset unless the user explicitly ends the workout.
      return;
    }
    const action = decideOnFocusGained({ phase: phaseRef.current, returning: current.returning, started: Boolean(current.startedAt) });
    if (action === 'prompt') {
      current.returning = false;
      setPauseReason(null);
      setCueText('');
      setPhase('resuming');
    } else if (action === 'reframe') {
      current.positioning = null; // stillness hold is stale: require a fresh one
      current.calibrationCompleted = false;
      setCalibrationGood(false);
      setPhase('calibrating');
    }
  }, [foreground]);

  // Page-hidden follows the same retention rules as navigation focus loss.
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return {
    phase, setPhase, exercise, exerciseId, instruction, calibrationGood,
    countdown, reps, pauseReason, muted, setMuted, showSkeleton, setShowSkeleton, cueText,
    summaryResult, summaryError, savingSummary, cameraFailure,
    unsupported,
    hasProgress: Boolean(runtime.current.startedAt && !runtime.current.ended),
    currentSet, totalSets, targetReps,
    transitionSaving, transitionSaveError,
    beginCamera, cameraReady, cameraError, leaveCamera, onFrame, startCountdown, togglePause,
    continueSet: startCountdown,
    continueAfterRest,
    beginResume,
    retryTransitionSave,
    stop: () => void finish('stopped'),
    retrySummary: () => void persistPendingSummary(pendingSummary.current),
    discardPendingSummary: () => { pendingSummary.current = null; setSummaryError(null); resetRuntime(); setPhase('select'); },
    reset: () => { pendingSummary.current = null; resetRuntime(); setSummaryResult(null); setSummaryError(null); setPhase('select'); },
    cameraActive: ['loading', 'calibrating', 'ready', 'countdown', 'active', 'paused', 'resuming', 'between_sets', 'workout_rest'].includes(phase),
    inferenceActive: foreground && (['workout_rest', 'calibrating', 'ready', 'countdown', 'active', 'resuming'].includes(phase) || (phase === 'paused' && !['manual', 'page_hidden', 'background'].includes(pauseReason))),
    voiceAvailable: voice.current.available,
  };
}
