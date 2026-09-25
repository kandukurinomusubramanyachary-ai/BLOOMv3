const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeOnboardingAnswers,
  resolvePrimaryFocus,
  generateFirstAction,
  buildPersonalizedSummary,
  buildOnboardingResult,
} = require('../src/features/onboardingV3/utils/personalization');

test('normalizeOnboardingAnswers handles empty / partial inputs gracefully', () => {
  const norm = normalizeOnboardingAnswers({});
  assert.equal(norm.firstName, 'Friend');
  assert.equal(norm.hasExplicitName, false);
  assert.deepEqual(norm.reasonsForJoining, []);
  assert.equal(norm.cyclePattern, 'not_sure');
  assert.deepEqual(norm.symptoms, []);
  assert.equal(norm.emotionalState, null);
  assert.equal(norm.energyLevel, null);
  assert.deepEqual(norm.priorities, []);
});

test('normalizeOnboardingAnswers trims explicit name', () => {
  const norm = normalizeOnboardingAnswers({ firstName: '  Ananya  ' });
  assert.equal(norm.firstName, 'Ananya');
  assert.equal(norm.hasExplicitName, true);
});

test('Persona A: PCOS + irregular cycles + fatigue + mood + emotional support priority', () => {
  const personaA = {
    firstName: 'Priya',
    reasonsForJoining: ['diagnosed_pcos', 'irregular_periods', 'emotional_support'],
    cyclePattern: 'very_irregular',
    cycleLengthEstimate: '55_plus',
    symptoms: ['fatigue', 'mood_changes', 'cramps'],
    emotionalState: 'low_drained',
    energyLevel: 1,
    priorities: ['emotional_support', 'manage_symptoms'],
  };

  const result = buildOnboardingResult(personaA);
  assert.equal(result.onboardingRecord.firstName, 'Priya');
  assert.equal(result.onboardingRecord.primaryFocus, 'emotional_support');
  assert.equal(result.summary.recommendedAction.type, 'meg');
  assert.equal(result.summary.recommendedAction.route, 'Meg');
  assert.ok(result.summary.recommendedAction.title.includes('Meg'));
  assert.ok(result.summary.affirmation.includes('PCOS'));
  assert.ok(result.summary.cards[0].narrative.includes('unpredictable'));
  assert.ok(result.summary.cards[1].narrative.includes('fatigue'));
  assert.ok(result.summary.cards[2].narrative.includes('low on reserve'));
  assert.equal(result.homePersonalizationHandoff.primaryPriority, 'emotional_support');
  assert.equal(result.megHandoff.userName, 'Priya');
  assert.deepEqual(result.megHandoff.onboardingSummary.reasons, personaA.reasonsForJoining);
});

test('Persona B: No known diagnosis + irregular periods + acne + cycle understanding', () => {
  const personaB = {
    firstName: 'Maya',
    reasonsForJoining: ['irregular_periods', 'understand_symptoms'],
    cyclePattern: 'sometimes_unpredictable',
    cycleLengthEstimate: '39_55',
    symptoms: ['acne', 'irregular_periods'],
    emotionalState: 'anxious_health',
    energyLevel: 3,
    priorities: ['understand_cycle'],
  };

  const result = buildOnboardingResult(personaB);
  assert.equal(result.onboardingRecord.firstName, 'Maya');
  assert.equal(result.onboardingRecord.primaryFocus, 'understand_cycle');
  assert.equal(result.summary.recommendedAction.type, 'timeline');
  assert.equal(result.summary.recommendedAction.route, 'DailyCheckIn');
  assert.ok(result.summary.cards[0].headline.includes('Adaptive'));
  assert.ok(result.summary.cards[2].narrative.includes('Health worries'));
});

test('Persona C: Mostly regular cycle + interested primarily in Strength', () => {
  const personaC = {
    firstName: 'Sara',
    reasonsForJoining: ['fitness_strength'],
    cyclePattern: 'regular',
    cycleLengthEstimate: '25_30',
    symptoms: [],
    emotionalState: 'pretty_good',
    energyLevel: 5,
    priorities: ['build_strength'],
  };

  const result = buildOnboardingResult(personaC);
  assert.equal(result.onboardingRecord.firstName, 'Sara');
  assert.equal(result.onboardingRecord.primaryFocus, 'build_strength');
  assert.equal(result.summary.recommendedAction.type, 'strength');
  assert.equal(result.summary.recommendedAction.route, 'Strength');
  assert.ok(result.summary.cards[0].headline.includes('Regular'));
  assert.equal(result.homePersonalizationHandoff.primaryPriority, 'build_strength');
});

test('Persona D: User skips all optional questions', () => {
  const personaD = {
    firstName: '',
    reasonsForJoining: [],
    cyclePattern: 'not_sure',
    cycleLengthEstimate: 'not_sure',
    symptoms: [],
    emotionalState: null,
    energyLevel: null,
    priorities: [],
  };

  const result = buildOnboardingResult(personaD);
  assert.equal(result.onboardingRecord.firstName, 'Friend');
  assert.equal(result.onboardingRecord.hasExplicitName, false);
  assert.equal(result.summary.recommendedAction.type, 'timeline');
  assert.ok(result.summary.greeting.includes('Bloom is ready for you'));
  assert.ok(result.summary.cards.length === 3);
  assert.equal(result.megHandoff.userName, null);
  assert.deepEqual(result.megHandoff.onboardingSummary.topSymptoms, []);
});

test('priority limit enforces maximum 3 items', () => {
  const answers = {
    priorities: ['understand_cycle', 'manage_symptoms', 'emotional_support', 'build_strength'],
  };
  const norm = normalizeOnboardingAnswers(answers);
  assert.equal(norm.priorities.length, 3);
  assert.deepEqual(norm.priorities, ['understand_cycle', 'manage_symptoms', 'emotional_support']);
});
