import { EXERCISE_LIBRARY, exerciseById } from './exerciseLibrary';

// These choices combine shipped movements, not health-personalized prescriptions.
const SEQUENCES = [
  { id: 'everyday-strength', name: 'Everyday strength', intro: 'A little space for your whole body. Start steady, and take the rests you need.', focus: 'full', level: 'steady', icon: 'fitness-outline', ids: ['bodyweight-squat', 'wall-pushup', 'standing-side-leg-raise'] },
  { id: 'a-gentle-start', name: 'A gentle start', intro: 'Three simple movements, with support nearby. There is no pace to keep up with.', focus: 'full', level: 'gentle', icon: 'leaf-outline', sets: 1, ids: ['calf-raise', 'wall-pushup', 'standing-side-leg-raise'] },
  { id: 'grounded-core', name: 'Grounded core', intro: 'Slow, controlled movement close to the floor. Make yourself comfortable.', focus: 'core', level: 'steady', icon: 'body-outline', ids: ['glute-bridge', 'bird-dog', 'dead-bug'] },
  { id: 'lower-body-foundation', name: 'Lower-body foundation', intro: 'Build a comfortable rhythm through your legs and hips, one movement at a time.', focus: 'lower', level: 'steady', icon: 'walk-outline', ids: ['bodyweight-squat', 'glute-bridge', 'calf-raise', 'wall-sit'] },
  { id: 'the-full-session', name: 'The full session', intro: 'More time to move through the library. Adjust any set count before you begin.', focus: 'full', level: 'strong', icon: 'fitness-outline', sets: 5, ids: EXERCISE_LIBRARY.map(item => item.id) },
];
export function exerciseSeconds(exercise, sets = exercise.defaultSets) {
  const requested = Number(sets);
  const count = Number.isFinite(requested) ? Math.max(1, Math.min(5, Math.floor(requested))) : 1;
  const active = exercise.mode === 'hold' ? exercise.holdSec : exercise.defaultReps * exercise.tempoSec;
  return active * count + exercise.restSec * (count - 1) + 3;
}
export function equipmentFor(exercise) {
  if (['wall-pushup', 'wall-sit'].includes(exercise.id)) return 'A stable wall';
  if (['glute-bridge', 'bird-dog', 'dead-bug'].includes(exercise.id)) return 'Mat optional';
  return 'Support nearby';
}
export const WORKOUT_PLANS = Object.freeze(SEQUENCES.map(plan => ({
  ...plan, exercises: plan.ids.map(id => ({ exercise: exerciseById(id), sets: plan.sets || exerciseById(id).defaultSets })),
})));
export function singleMovePlan(exercise, sets = exercise.defaultSets) {
  return { id: exercise.id, name: exercise.name, intro: exercise.intro, focus: exercise.focus, level: exercise.level, icon: exercise.icon, exercises: [{ exercise, sets }] };
}
export function planMinutes(plan) {
  return Math.max(1, Math.ceil((plan.exercises.reduce((sum, item) => sum + exerciseSeconds(item.exercise, item.sets), 0) + Math.max(0, plan.exercises.length - 1) * 30) / 60));
}
export function planEquipment(plan) {
  return [...new Set(plan.exercises.map(item => equipmentFor(item.exercise)))].join(' · ');
}
