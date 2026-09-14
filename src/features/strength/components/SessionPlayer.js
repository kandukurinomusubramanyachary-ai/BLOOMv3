import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';
import { StrengthButton, StrengthHeader, StrengthScreenFrame, StrengthNote, SetProgress } from './StrengthUI';
import MovementGuide from './MovementGuide';
import SessionCompletion from './SessionCompletion';
import ProgressRing from './ProgressRing';
import { useGuidedSession } from '../useGuidedSession';

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

// A changed exercise gets an independent timer and save attempt. Retrying
// persistence always reuses one summary ID, never a new workout record.
export default function SessionPlayer(props) {
  return <GuidedPlayer key={props.exercise.id + ':' + props.sets} {...props} />;
}

function GuidedPlayer({ exercise, sets, onExit, onComplete, onNext, nextLabel = 'Next exercise', workoutProgress }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const { width, fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const { state, controls } = useGuidedSession(exercise, sets);
  const [cueIndex, setCueIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
  const [confirmExit, setConfirmExit] = useState(false);
  const summaryRef = useRef(null);
  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const mountedRef = useRef(true);
  const resumeAfterExitRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!focused) controls.pause();
  }, [focused, controls.pause]);

  useEffect(() => {
    if (state.phase !== 'active') return undefined;
    const timer = setInterval(() => setCueIndex(index => (index + 1) % (exercise.cues?.length || 1)), 6000);
    return () => clearInterval(timer);
  }, [state.phase, exercise.cues]);

  const saveCompletedSession = useCallback(async () => {
    const summary = summaryRef.current;
    if (!summary || savingRef.current || savedRef.current) return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      if (typeof completeRef.current !== 'function') throw new Error('save_handler_missing');
      await completeRef.current(summary);
      savedRef.current = true;
      if (mountedRef.current) setSaveState('saved');
    } catch {
      if (mountedRef.current) setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (state.phase !== 'complete') return;
    if (!summaryRef.current) {
      summaryRef.current = {
        id: 'strength-' + state.startedAt,
        exerciseId: exercise.id,
        name: exercise.name,
        mode: exercise.mode,
        sessionMode: 'guided',
        sets: state.setsPlanned,
        reps: exercise.mode === 'hold' ? 0 : state.totalRepsDone,
        holdSec: exercise.mode === 'hold' ? exercise.holdSec : 0,
        durationSec: Math.round(state.elapsedSec),
        completedAt: new Date().toISOString(),
      };
      void saveCompletedSession();
    }
  }, [state.phase, state.startedAt, state.setsPlanned, state.totalRepsDone, state.elapsedSec, exercise, saveCompletedSession]);

  const isIdle = state.phase === 'idle';
  const isPaused = state.phase === 'paused';
  const visiblePhase = isPaused ? state.resumePhase : state.phase;
  const isRest = visiblePhase === 'rest';
  const isCountdown = visiblePhase === 'countdown';
  const hold = exercise.mode === 'hold';
  const target = hold ? exercise.holdSec + ' sec hold' : exercise.defaultReps + ' paced reps';
  const progressText = typeof workoutProgress === 'string'
    ? workoutProgress
    : workoutProgress?.total ? 'Exercise ' + workoutProgress.current + ' of ' + workoutProgress.total : 'Guided session';
  const progressValue = workoutProgress?.total ? (workoutProgress.current - 1) / workoutProgress.total : undefined;

  const requestExit = () => {
    if (isIdle || (state.phase === 'complete' && savedRef.current)) { onExit?.(); return; }
    if (savingRef.current) return;
    resumeAfterExitRef.current = ['countdown', 'active', 'rest'].includes(state.phase);
    controls.pause();
    setConfirmExit(true);
  };
  const keepMoving = () => {
    setConfirmExit(false);
    if (resumeAfterExitRef.current) controls.resume();
  };
  const repeat = () => {
    summaryRef.current = null;
    savedRef.current = false;
    setSaveState('idle');
    setCueIndex(0);
    controls.reset();
  };

  if (confirmExit) {
    return <StrengthScreenFrame
      header={<StrengthHeader title={exercise.name} subtitle={progressText} />}
      footer={<><StrengthButton title="Stay with this exercise" onPress={keepMoving} />
        <StrengthButton title="Leave exercise" variant="ghost" onPress={onExit} testID="strength-confirm-exit" /></>}>
      <View style={s.preparation}>
        <Text accessibilityRole="header" style={s.title}>Leave this exercise?</Text>
        <Text style={s.body}>This exercise has not been saved. Any exercises you already saved will stay in your history.</Text>
        <StrengthNote icon="pause-outline">Take your time. Your session is paused while you decide.</StrengthNote>
      </View>
    </StrengthScreenFrame>;
  }

  if (state.phase === 'complete') {
    return <StrengthScreenFrame
      header={<StrengthHeader title={exercise.name} subtitle={progressText} />}
      contentStyle={s.completeContent}>
      <SessionCompletion subtitle={exercise.name + ' · guided session complete'}
        stats={[
          { value: state.setsPlanned, label: 'Paced sets' },
          { value: hold ? exercise.holdSec + ' sec' : state.totalRepsDone, label: hold ? 'Per hold' : 'Paced reps' },
          { value: formatClock(state.elapsedSec), label: 'Session time' },
        ]}
        saving={saveState !== 'saved' && saveState !== 'error'}
        saveError={saveState === 'error' ? 'Bloom could not save this session on your device. Try again before leaving.' : null}
        onRetrySave={saveCompletedSession}
        onDone={() => { if (savedRef.current) (onNext || onExit)?.(); }}
        doneLabel={onNext ? nextLabel : 'Done'}
        onAgain={onNext ? undefined : repeat}
        onLeave={requestExit}>
        <StrengthNote icon="time-outline" title="Paced guidance, not measured reps">
          Your summary records the guided timer. Bloom did not measure your movement or assess your form.
        </StrengthNote>
      </SessionCompletion>
    </StrengthScreenFrame>;
  }

  const footer = isIdle
    ? <StrengthButton title="Start exercise" icon="play-outline" onPress={controls.start} testID="strength-begin" />
    : isPaused
      ? <><StrengthButton title="Resume" icon="play-outline" onPress={controls.resume} testID="strength-resume" />
        {isRest ? <StrengthButton title="Add +15 sec" variant="secondary" onPress={controls.addRest} testID="strength-add-rest" /> : null}</>
      : isRest
        ? <><StrengthButton title="Skip rest" onPress={controls.skipRest} testID="strength-skip-rest" />
          <View style={s.controlRow}><StrengthButton title="Add +15 sec" variant="secondary" onPress={controls.addRest} style={s.flex} testID="strength-add-rest" />
            <StrengthButton title="Pause" variant="ghost" onPress={controls.pause} style={s.flex} testID="strength-pause" /></View></>
        : <StrengthButton title="Pause" icon="pause-outline" onPress={controls.pause} testID="strength-pause" />;

  const ringProgress = isCountdown ? 1 - state.remaining / 3
    : hold ? 1 - state.remaining / Math.max(1, state.holdSec) : state.repProgress;
  const bigLabel = isCountdown ? String(Math.ceil(state.remaining)) : isRest ? formatClock(state.remaining)
    : hold ? formatClock(state.remaining) : String(state.currentRep).padStart(2, '0');
  const smallLabel = isCountdown ? 'Starting in' : isRest ? 'Rest remaining' : hold ? 'Hold remaining' : 'of ' + state.repsPerSet + ' paced reps';
  const timerText = <><Text style={[s.timer, isRest && { color: c.sage }]}>{bigLabel}</Text><Text style={s.timerLabel}>{smallLabel}</Text></>;

  return <StrengthScreenFrame testID="strength-guided-session"
    header={<StrengthHeader title={exercise.name} subtitle={progressText} onBack={requestExit}
      backLabel={isIdle ? 'Back to workout' : 'End exercise'} progress={progressValue} />}
    footer={footer} contentStyle={isIdle ? undefined : s.sessionContent}>
    {isIdle ? <>
      <View style={s.preparation}>
        <Text accessibilityRole="header" style={s.title}>Ready when you are.</Text>
        <Text style={s.body}>{target} · {sets} {sets === 1 ? 'set' : 'sets'}</Text>
        <Text style={s.body}>{exercise.intro}</Text>
      </View>
      <MovementGuide exercise={exercise} />
      <StrengthNote icon="time-outline" title="Paced guidance, not measured reps">
        Follow the timer at a comfortable pace. No camera is used, and you can pause whenever you need.
      </StrengthNote>
    </> : <>
      <View style={s.sessionHeading}>
        <Text accessibilityRole="header" style={[s.title, s.centered]}>{isPaused ? 'Paused here.' : isRest ? 'Catch your breath.' : isCountdown ? 'Find your position.' : 'Move at your own pace.'}</Text>
        <Text style={s.supporting}>{isRest ? 'Coming up: set ' : 'Set '}{state.currentSet} of {state.setsPlanned}</Text>
        <SetProgress current={isRest ? state.currentSet - 1 : state.currentSet} total={state.setsPlanned} />
      </View>
      <View style={s.timerArea} accessible accessibilityLabel={smallLabel + ': ' + bigLabel}>
        {isRest || fontScale > 1.2
          ? <View style={s.clock}>{timerText}</View>
          : <ProgressRing progress={ringProgress} size={Math.min(232, width - 64)} strokeWidth={6}
            color={c.accent} trackColor={c.line} animated={!isPaused}
            pulseKey={!isPaused && state.lastEvent === 'rep' ? state.eventNonce : null}>{timerText}</ProgressRing>}
      </View>
      <View style={s.cueArea}>
        <Text style={s.cue}>{isPaused ? 'Your timer is paused. Take all the time you need.'
          : isRest ? 'Nice work. Let your breath settle before the next set.'
            : isCountdown ? 'A little space, a steady breath. We’ll begin together.'
              : exercise.cues?.[cueIndex] || exercise.intro}</Text>
        {!isPaused && !isRest && !isCountdown ? <Text style={s.supporting}>Paced guidance, not measured reps.</Text> : null}
      </View>
      {isRest ? <View style={s.nextSet}>
        <Text style={s.nextTitle}>{exercise.name}</Text><Text style={s.body}>{target} in the next set</Text>
        <Text style={s.supporting}>{exercise.cues?.[0] || exercise.intro}</Text>
      </View> : null}
    </>}
  </StrengthScreenFrame>;
}

const sheet = c => ({
  title: { ...T.title, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted },
  centered: { textAlign: 'center' },
  preparation: { gap: 16 }, sessionContent: { gap: 24, justifyContent: 'center' },
  sessionHeading: { alignItems: 'center', gap: 12 }, timerArea: { alignItems: 'center', paddingVertical: 8 },
  timer: { fontSize: 52, lineHeight: 62, fontWeight: '600', color: c.ink, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  timerLabel: { ...T.supporting, color: c.body, textAlign: 'center', paddingHorizontal: 12 },
  clock: { alignItems: 'center', gap: 8, width: '100%', paddingVertical: 20 },
  cueArea: { gap: 12, alignItems: 'center' }, cue: { ...T.body, color: c.body, textAlign: 'center', maxWidth: 440 },
  nextSet: { gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 20 },
  nextTitle: { ...T.heading, color: c.ink }, controlRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0, paddingHorizontal: 12 }, completeContent: { paddingTop: 8 },
});
