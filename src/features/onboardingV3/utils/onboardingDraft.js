const { ONBOARDING_STEPS } = require('../data/options');

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

module.exports = { restoreOnboardingHistory };
