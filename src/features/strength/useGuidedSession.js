import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { reducer, initialState, COUNTDOWN_SEC, TICK_MS } from './guidedSessionEngine';

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

  // Reset whenever the target exercise/sets change and we are idle/complete.
  useEffect(() => {
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

  const start = useCallback(() => dispatch({ type: 'START' }), []);
  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), []);
  const skipRest = useCallback(() => dispatch({ type: 'SKIP_REST' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET', exercise, sets }), [exercise, sets]);

  const controls = useMemo(
    () => ({ start, pause, resume, skipRest, reset }),
    [start, pause, resume, skipRest, reset]
  );

  return { state, controls };
}

export const GUIDED_CONSTANTS = { COUNTDOWN_SEC, TICK_MS };
