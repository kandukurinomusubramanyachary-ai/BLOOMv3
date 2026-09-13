// Store display fields only, never camera frames, landmarks or runtime state.
const finite = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
function dateKey(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function normalizeHistory(input, { exercise, sets, workoutId, workoutName } = {}) {
  if (!input?.id || !exercise?.id) throw new Error('The session could not be saved. Please try again.');
  const isPose = input.sessionMode === 'pose' || input.acceptedReps != null;
  const completedAt = input.completedAt && dateKey(input.completedAt) ? new Date(input.completedAt).toISOString() : new Date().toISOString();
  return {
    id: String(input.id), exerciseId: exercise.id, name: exercise.name,
    focus: exercise.focus, mode: exercise.mode, sessionMode: isPose ? 'pose' : 'guided',
    sets: Math.min(5, Math.max(1, Math.floor(finite(sets || input.sets) || 1))),
    reps: exercise.mode === 'hold' ? 0 : Math.floor(finite(input.reps ?? input.acceptedReps)),
    holdSec: exercise.mode === 'hold' ? finite(exercise.holdSec) : 0,
    durationSec: Math.round(finite(input.durationSec ?? input.durationSeconds)),
    completionState: ['stopped', 'abandoned'].includes(input.completionState) ? input.completionState : 'completed', completedAt,
    ...(workoutId ? { workoutId: String(workoutId), workoutName: String(workoutName || '') } : {}),
  };
}
function historyStats(records = [], now = new Date()) {
  const valid = records.filter(item => item?.completedAt && dateKey(item.completedAt));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = dateKey(d); const items = valid.filter(item => dateKey(item.completedAt) === key);
    days.push({ key, label: d.toLocaleDateString('en', { weekday: 'short' }), count: items.length, seconds: items.reduce((n, item) => n + finite(item.durationSec), 0) });
  }
  const keys = new Set(days.map(day => day.key)); const week = valid.filter(item => keys.has(dateKey(item.completedAt)));
  return {
    sessions: valid.length, weekSessions: week.length, days,
    activeDays: days.filter(day => day.count > 0).length,
    weekMinutes: Math.round(week.reduce((n, item) => n + finite(item.durationSec), 0) / 60),
    totalMinutes: Math.round(valid.reduce((n, item) => n + finite(item.durationSec), 0) / 60),
    measuredReps: valid.filter(item => item.sessionMode === 'pose').reduce((n, item) => n + finite(item.reps), 0),
    pacedReps: valid.filter(item => item.sessionMode !== 'pose').reduce((n, item) => n + finite(item.reps), 0),
    areas: Object.entries(valid.reduce((all, item) => { if (item.focus) all[item.focus] = (all[item.focus] || 0) + 1; return all; }, {})).sort((a, b) => b[1] - a[1]),
  };
}
module.exports = { normalizeHistory, historyStats };
