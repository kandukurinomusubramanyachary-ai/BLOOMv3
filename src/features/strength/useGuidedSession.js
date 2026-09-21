import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { reducer, initialState, COUNTDOWN_SEC, TICK_MS } from './guidedSessionEngine';
import { createVoiceCoach } from './services/voiceCoach';

// Deterministic, camera-free guided-workout timing engine.
//
// Phases: 'idle' → 'countdown' → 'active' → 'rest' → (loop) → 'complete'.
// It ticks on a single interval, is fully pausable, and emits per-rep and
// per-set events the UI animates against. No camera, no model, no Meg.
//
// All pure state-machine logic lives in ../guidedSessionEngine (framework-free
// and unit-tested); this hook is only the React/interval glue around it.

export function useGuidedSession(exercise, sets) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(exercise, sets));
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const voice = useRef(null);
  if (!voice.current) voice.current = createVoiceCoach();
  const [muted, updateMuted] = useState(() => voice.current.muted);
  const lastVoiceEvent = useRef(-1);

  // Reset whenever the target exercise/sets change and we are idle/complete.
  useEffect(() => {
    voice.current.cancel();
    lastVoiceEvent.current = -1;
    dispatch({ type: 'RESET', exercise, sets });
  }, [exercise, sets]);

  const running = state.phase === 'countdown' || state.phase === 'active' || state.phase === 'rest';

  useEffect(() => {
    if (!running) {
      lastTsRef.current = null;
      if (rafRef.current) clearInterval(rafRef.current);
      rafRef.current = null;
      return undefined;
    }
    lastTsRef.current = Date.now();
    rafRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - (lastTsRef.current || now);
      lastTsRef.current = now;
      dispatch({ type: 'TICK', delta: Math.min(delta, 250) });
    }, TICK_MS);
    return () => {
      if (rafRef.current) clearInterval(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  const start = useCallback(() => {
    voice.current.resume('Find your starting position. We will begin in three.');
    dispatch({ type: 'START' });
  }, []);
  const pause = useCallback((options = {}) => {
    const running = ['countdown', 'active', 'rest'].includes(stateRef.current.phase);
    voice.current.pause(running && !options.silent ? 'Paused. Take the time you need.' : undefined);
    dispatch({ type: 'PAUSE' });
  }, []);
  const resume = useCallback(() => {
    if (stateRef.current.phase !== 'paused') return;
    voice.current.resume(stateRef.current.resumePhase === 'rest' ? 'Rest timer resumed.' : 'Resuming. Move at your own pace.');
    dispatch({ type: 'RESUME' });
  }, []);
  const skipRest = useCallback(() => dispatch({ type: 'SKIP_REST' }), []);
  const addRest = useCallback(() => dispatch({ type: 'ADD_REST' }), []);
  const reset = useCallback(() => {
    voice.current.cancel();
    lastVoiceEvent.current = -1;
    dispatch({ type: 'RESET', exercise, sets });
  }, [exercise, sets]);
  const setMuted = useCallback(value => {
    voice.current.setMuted(value);
    updateMuted(Boolean(value));
    if (!value) voice.current.activate('Voice guidance on.', { allowWhilePaused: true });
  }, []);

  // The timer ticks at 10 Hz; speech only responds to unique engine events.
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'paused' || lastVoiceEvent.current === state.eventNonce) return;
    lastVoiceEvent.current = state.eventNonce;
    const cue = { channel: 'session', priority: 90, interrupt: true, cooldownMs: 0 };
    if (state.lastEvent === 'set-start') {
      voice.current.speak(`Set ${state.currentSet}. ${exercise.cues?.[0] || 'Move at your own pace.'}`, cue);
    } else if (state.lastEvent === 'rest-start') {
      voice.current.speak('Set complete. Take a breath before the next set.', cue);
    } else if (state.lastEvent === 'complete') {
      voice.current.speak('All sets complete. Nice work. Take a moment to recover.', cue);
    } else if (state.lastEvent === 'rep' && state.repsPerSet >= 6 && state.currentRep === Math.ceil(state.repsPerSet / 2)) {
      voice.current.speak('Halfway through this set. Keep a comfortable pace.', { channel: 'milestone', priority: 30, dropIfBusy: true });
    }
  }, [state.eventNonce, state.phase, state.lastEvent, state.currentSet, state.currentRep, state.repsPerSet, exercise]);

  useFocusEffect(useCallback(() => () => pause({ silent: true }), [pause]));
  useEffect(() => () => voice.current.dispose(), []);

  // Backgrounded time is never presented as exercise completed. Returning
  // to Bloom leaves the session paused until the user explicitly resumes.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pause({ silent: true });
    });
    const document = Platform.OS === 'web' ? globalThis.document : null;
    const onVisibility = () => { if (document?.hidden) pause({ silent: true }); };
    document?.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => {
      subscription.remove();
      document?.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pause]);

  const controls = useMemo(
    () => ({ start, pause, resume, skipRest, addRest, reset }),
    [start, pause, resume, skipRest, addRest, reset]
  );

  return { state, controls, muted, setMuted, voiceAvailable: voice.current.available };
}

export const GUIDED_CONSTANTS = { COUNTDOWN_SEC, TICK_MS };
