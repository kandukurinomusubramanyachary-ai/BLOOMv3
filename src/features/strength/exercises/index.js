const squat = require('./squat');
const wallPushup = require('./wallPushup');
const sideLegRaise = require('./sideLegRaise');

const EXERCISES = Object.freeze([squat, wallPushup, sideLegRaise]);

function exerciseById(id) {
  // Unknown exercise IDs must NOT silently resolve to squat. Return null so
  // callers can fail safe (route to guided / unsupported) instead of counting
  // the wrong movement.
  return EXERCISES.find((exercise) => exercise.id === id) || null;
}

module.exports = { EXERCISES, exerciseById, sideLegRaise, squat, wallPushup };
