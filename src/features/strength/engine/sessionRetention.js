// Leaving Strength — tab switch, screen blur, page hidden — must NEVER
// destroy a running workout: accepted reps, the current exercise, the
// current set, and the parent workout index all survive. These pure
// decisions are the single source of truth for both the navigation-focus
// and the document-visibility paths.

// Focus/visibility LOST.
//   'pause'    — an active set: interrupt the partial rep, keep accepted reps
//   'rollback' — a running countdown: restart it from a fresh framing hold
//   'keep'     — everything else: pre-start setup (nothing to preserve yet),
//                rest phases (wall-clock rest continues), saving/summary
//                (terminal), an already-paused session
function decideOnFocusLost({ phase, started }) {
  if (phase === 'countdown') return 'rollback';
  if (!started) return 'keep';
  if (phase === 'active') return 'pause';
  return 'keep';
}

// Focus/visibility GAINED.
//   'prompt'  — "Ready to continue?" for a session we paused or rolled back
//   'reframe' — pre-start return: the stillness hold is stale, force a fresh one
//   'none'    — no state change
function decideOnFocusGained({ phase, returning, started }) {
  if (started && returning && (phase === 'paused' || phase === 'ready')) return 'prompt';
  if (!started && (phase === 'calibrating' || phase === 'ready')) return 'reframe';
  return 'none';
}

module.exports = { decideOnFocusLost, decideOnFocusGained };
