const {
  ONBOARDING_STEPS,
  REASONS_OPTIONS,
  CYCLE_PATTERN_OPTIONS,
  CYCLE_LENGTH_OPTIONS,
  SYMPTOM_OPTIONS,
  EMOTIONAL_STATE_OPTIONS,
  ENERGY_LEVEL_OPTIONS,
  PRIORITY_OPTIONS,
} = require('../data/options');

const INITIAL_ONBOARDING_ANSWERS = Object.freeze({
  firstName: '',
  reasonsForJoining: [],
  cyclePattern: null,
  cycleLengthEstimate: null,
  symptoms: [],
  emotionalState: null,
  energyLevel: null,
  priorities: [],
});

function allowedIds(options) {
  return new Set(options.map(option => option.id));
}

function safeSelection(value, options) {
  return allowedIds(options).has(value) ? value : null;
}

function safeSelections(value, options, limit) {
  if (!Array.isArray(value)) return [];
  const allowed = allowedIds(options);
  return [...new Set(value.filter(item => allowed.has(item)))].slice(0, limit);
}

function restoreOnboardingHistory(savedHistory, restoredStep, initialStep = ONBOARDING_STEPS.WELCOME) {
  const maxStep = ONBOARDING_STEPS.RESULT;
  const step = Number.isInteger(restoredStep)
    ? Math.max(ONBOARDING_STEPS.WELCOME, Math.min(maxStep, restoredStep))
    : initialStep;
  const stored = Array.isArray(savedHistory)
    ? savedHistory.filter(value => Number.isInteger(value) && value >= ONBOARDING_STEPS.WELCOME && value <= maxStep)
    : [];
  if (stored.length && stored[stored.length - 1] === step) {
    return stored.filter((value, index) => index === 0 || value !== stored[index - 1]);
  }
  if (step <= initialStep) return [initialStep];
  return Array.from({ length: step - initialStep + 1 }, (_, index) => initialStep + index);
}

function restoreOnboardingDraft(savedDraft, initialStep = ONBOARDING_STEPS.WELCOME) {
  const source = savedDraft && typeof savedDraft === 'object' && !Array.isArray(savedDraft)
    ? savedDraft
    : {};
  const sourceAnswers = source.answers && typeof source.answers === 'object'
    && !Array.isArray(source.answers) ? source.answers : {};
  const history = restoreOnboardingHistory(source.history, source.step, initialStep);
  const step = history[history.length - 1] ?? initialStep;
  const energyIds = allowedIds(ENERGY_LEVEL_OPTIONS);
  return {
    answers: {
      firstName: typeof sourceAnswers.firstName === 'string'
        ? sourceAnswers.firstName.slice(0, 80)
        : '',
      reasonsForJoining: safeSelections(sourceAnswers.reasonsForJoining, REASONS_OPTIONS, 8),
      cyclePattern: safeSelection(sourceAnswers.cyclePattern, CYCLE_PATTERN_OPTIONS),
      cycleLengthEstimate: safeSelection(sourceAnswers.cycleLengthEstimate, CYCLE_LENGTH_OPTIONS),
      symptoms: safeSelections(sourceAnswers.symptoms, SYMPTOM_OPTIONS, 12),
      emotionalState: safeSelection(sourceAnswers.emotionalState, EMOTIONAL_STATE_OPTIONS),
      energyLevel: energyIds.has(sourceAnswers.energyLevel) ? sourceAnswers.energyLevel : null,
      priorities: safeSelections(sourceAnswers.priorities, PRIORITY_OPTIONS, 3),
    },
    history,
    step,
  };
}

module.exports = {
  INITIAL_ONBOARDING_ANSWERS,
  restoreOnboardingDraft,
  restoreOnboardingHistory,
};
