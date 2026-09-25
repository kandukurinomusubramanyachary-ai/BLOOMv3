/**
 * Deterministic personalization engine.
 *
 * Takes raw onboarding responses and synthesizes:
 * 1. Warm, human, non-clinical summary narrative
 * 2. Primary focus area & top themes
 * 3. Exactly ONE personalized first recommended action
 * 4. Clean handoff object for Meg AI context
 * 5. Clean handoff object for Home screen customization
 */

const {
  CYCLE_PATTERN_OPTIONS,
  EMOTIONAL_STATE_OPTIONS,
  ENERGY_LEVEL_OPTIONS,
  PRIORITY_OPTIONS,
  REASONS_OPTIONS,
  SYMPTOM_OPTIONS,
} = require('../data/options');

/**
 * Normalizes raw onboarding answers into a consistent structure.
 */
function normalizeOnboardingAnswers(raw = {}) {
  const firstName = String(raw.firstName || '').trim();
  const reasonsForJoining = Array.isArray(raw.reasonsForJoining)
    ? raw.reasonsForJoining.filter(Boolean)
    : [];
  const cyclePattern = typeof raw.cyclePattern === 'string' && raw.cyclePattern
    ? raw.cyclePattern
    : 'not_sure';
  const cycleLengthEstimate = typeof raw.cycleLengthEstimate === 'string' && raw.cycleLengthEstimate
    ? raw.cycleLengthEstimate
    : 'not_sure';
  const symptoms = Array.isArray(raw.symptoms)
    ? raw.symptoms.filter(Boolean)
    : [];
  const emotionalState = typeof raw.emotionalState === 'string' && raw.emotionalState
    ? raw.emotionalState
    : null;
  const energyLevel = typeof raw.energyLevel === 'number' && Number.isFinite(raw.energyLevel)
    ? Math.max(1, Math.min(5, Math.round(raw.energyLevel)))
    : null;
  const priorities = Array.isArray(raw.priorities)
    ? raw.priorities.slice(0, 3).filter(Boolean)
    : [];

  return {
    firstName: firstName || 'Friend',
    hasExplicitName: Boolean(firstName),
    reasonsForJoining,
    cyclePattern,
    cycleLengthEstimate,
    symptoms,
    emotionalState,
    energyLevel,
    priorities,
  };
}

/**
 * Determines primary focus area from user's priorities and selections.
 */
function resolvePrimaryFocus(answers) {
  const { priorities, reasonsForJoining } = answers;

  if (priorities.length > 0) {
    return priorities[0];
  }

  // Fallbacks if user skipped priorities:
  if (reasonsForJoining.includes('fitness_strength')) return 'build_strength';
  if (reasonsForJoining.includes('emotional_support')) return 'emotional_support';
  if (reasonsForJoining.includes('understand_symptoms')) return 'manage_symptoms';
  if (reasonsForJoining.includes('irregular_periods') || reasonsForJoining.includes('diagnosed_pcos')) {
    return 'understand_cycle';
  }

  return 'understand_cycle';
}

/**
 * Generates the single personalized recommended first action.
 */
function generateFirstAction(answers) {
  const primaryFocus = resolvePrimaryFocus(answers);
  const name = answers.firstName || 'you';

  switch (primaryFocus) {
    case 'emotional_support':
      return {
        id: 'meg_chat',
        type: 'meg',
        title: 'Talk to Meg',
        badge: 'Emotional Care',
        icon: 'chatbubbles',
        description: `Meg already knows a little about what ${answers.hasExplicitName ? name : 'your body'} has been holding lately. Start a calm, private conversation.`,
        actionLabel: 'Open Meg',
        route: 'Meg',
        contextHint: 'Meg is ready with a gentle check-in.',
      };

    case 'build_strength':
      return {
        id: 'strength_start',
        type: 'strength',
        title: 'Begin a gentle Strength session',
        badge: 'Movement',
        icon: 'fitness',
        description: 'Explore calm, hormone-aware movement paced to respect your daily energy reserve.',
        actionLabel: 'Explore Strength',
        route: 'Strength',
        contextHint: 'Camera guidance is available on web; guided pacing on phone.',
      };

    case 'manage_symptoms':
      return {
        id: 'checkin_symptoms',
        type: 'checkin',
        title: 'Start your first 30-second check-in',
        badge: 'Daily Comfort',
        icon: 'pulse',
        description: 'Log your baseline symptoms and sensations today so Bloom can begin mapping your patterns.',
        actionLabel: 'Start 30-sec check-in',
        route: 'DailyCheckIn',
        contextHint: 'Quick 3-step check-in, no medical jargon.',
      };

    case 'healthier_habits':
      return {
        id: 'diet_explore',
        type: 'diet',
        title: 'Explore nourishing food ideas',
        badge: 'Nourishment',
        icon: 'nutrition',
        description: 'Discover balanced, blood-sugar-friendly meal inspiration without strict calorie tracking.',
        actionLabel: 'View Diet & Meals',
        route: 'Diet',
        contextHint: 'Gentle food reflections, never judgment.',
      };

    case 'prepare_doctor':
      return {
        id: 'checkin_doctor_prep',
        type: 'checkin',
        title: 'Log your first daily record',
        badge: 'Doctor Prep',
        icon: 'medical',
        description: 'Start capturing your cycle and symptoms now so you have organized data ready for your next doctor appointment.',
        actionLabel: 'Start 30-sec check-in',
        route: 'DailyCheckIn',
        contextHint: 'Your logs feed directly into doctor-ready summaries.',
      };

    case 'understand_cycle':
    default:
      return {
        id: 'cycle_snapshot',
        type: 'timeline',
        title: 'Build your first cycle picture',
        badge: 'Cycle Insights',
        icon: 'calendar',
        description: 'Take 30 seconds to log today. Bloom will begin piecing together your cycle rhythm at your own pace.',
        actionLabel: 'Start 30-sec check-in',
        route: 'DailyCheckIn',
        contextHint: 'No calendar perfection required.',
      };
  }
}

/**
 * Builds the narrative "Bloom understands you" cards deterministically.
 */
function buildPersonalizedSummary(rawAnswers) {
  const answers = normalizeOnboardingAnswers(rawAnswers);
  const {
    firstName,
    hasExplicitName,
    reasonsForJoining,
    cyclePattern,
    symptoms,
    emotionalState,
    energyLevel,
    priorities,
  } = answers;

  // 1. Cycle finding
  let cycleNarrative = 'Your body has its own natural rhythm.';
  let cycleHeadline = 'Cycle rhythm';
  if (cyclePattern === 'very_irregular') {
    cycleNarrative = 'Your cycle has been unpredictable lately. Bloom is designed specifically to support shifting windows without expecting a textbook 28-day schedule.';
    cycleHeadline = 'Unpredictable cycle rhythm';
  } else if (cyclePattern === 'no_recent_period') {
    cycleNarrative = 'You haven’t had a recent period. Bloom focuses on your daily symptoms, energy, and comfort rather than pressuring you with missing cycle dates.';
    cycleHeadline = 'Flexible tracking mode';
  } else if (cyclePattern === 'sometimes_unpredictable') {
    cycleNarrative = 'Your cycle shifts from time to time. Bloom adapts your estimates based on real logged dates rather than rigid calculations.';
    cycleHeadline = 'Adaptive cycle estimates';
  } else if (cyclePattern === 'regular') {
    cycleNarrative = 'Your cycle is mostly regular. Bloom will help you observe how subtle phase transitions correlate with energy, cravings, and stamina.';
    cycleHeadline = 'Regular cycle cadence';
  } else if (reasonsForJoining.includes('irregular_periods')) {
    cycleNarrative = 'Your cycle has varied widely. Bloom helps you track without assuming a textbook 28-day cadence.';
    cycleHeadline = 'Support for irregular cycles';
  }

  // 2. Symptoms finding
  const symptomLabels = symptoms.map((id) => {
    const match = SYMPTOM_OPTIONS.find((s) => s.id === id);
    return match ? match.label.toLowerCase().split('&')[0].trim() : id;
  });

  let symptomNarrative = 'You’re ready to start with a clean slate and notice what comes up.';
  let symptomHeadline = 'Daily physical signals';
  if (symptomLabels.length > 0) {
    const listString = symptomLabels.length === 1
      ? symptomLabels[0]
      : symptomLabels.length === 2
        ? `${symptomLabels[0]} and ${symptomLabels[1]}`
        : `${symptomLabels.slice(0, 2).join(', ')}, and ${symptomLabels[2] || symptomLabels[1]}`;
    symptomNarrative = `Your body has been carrying ${listString}. Instead of dismissing these, we will track them quietly to uncover relief patterns.`;
    symptomHeadline = `${symptoms.length} physical signal${symptoms.length === 1 ? '' : 's'} to monitor`;
  }

  // 3. Emotional & Energy finding
  let emotionalNarrative = '';
  let energyLabel = null;
  if (energyLevel) {
    const energyOpt = ENERGY_LEVEL_OPTIONS.find((e) => e.level === energyLevel);
    energyLabel = energyOpt ? energyOpt.label.toLowerCase() : null;
  }

  if (emotionalState === 'overwhelmed' || emotionalState === 'low_drained') {
    emotionalNarrative = `You’ve been feeling ${emotionalState === 'overwhelmed' ? 'a little overwhelmed' : 'low on reserve'}${energyLabel ? ` with ${energyLabel} energy` : ''}. Bloom gives you permission to slow down. Rest is genuinely productive here.`;
  } else if (emotionalState === 'frustrated_body') {
    emotionalNarrative = 'Feeling at odds with your own body is deeply exhausting. Bloom is built to be a gentle ally, never another critic.';
  } else if (emotionalState === 'anxious_health') {
    emotionalNarrative = 'Health worries can feel heavy when you carry them alone. Bloom organizes your real observations so you have clarity instead of uncertainty.';
  } else if (emotionalState === 'stressed') {
    emotionalNarrative = `Stress takes a real toll on cycle and energy. Bloom’s short 30-second check-ins are designed to lighten the load, not add to it.`;
  } else if (energyLabel) {
    emotionalNarrative = `Your energy has been ${energyLabel} lately. Bloom paces recommendations to your actual capacity each day.`;
  } else {
    emotionalNarrative = 'We’ll check in softly with your mood and energy so you can notice emotional patterns without feeling judged.';
  }

  // 4. Affirmation message
  const affirmation = (reasonsForJoining.includes('diagnosed_pcos') || reasonsForJoining.includes('suspected_pcos'))
    ? 'Bloom is built around PCOS reality: your body deserves patience, not pressure. We’ll help you notice patterns instead of expecting perfection.'
    : 'Your body doesn’t always follow a textbook calendar. We’ll meet you exactly where you are today.';

  const recommendedAction = generateFirstAction(answers);

  return {
    firstName: hasExplicitName ? firstName : 'Friend',
    greeting: hasExplicitName ? `Bloom is ready for you, ${firstName}.` : 'Bloom is ready for you.',
    affirmation,
    cards: [
      {
        id: 'cycle',
        icon: 'calendar',
        headline: cycleHeadline,
        narrative: cycleNarrative,
        highlight: cyclePattern !== 'not_sure',
      },
      {
        id: 'symptoms',
        icon: 'pulse',
        headline: symptomHeadline,
        narrative: symptomNarrative,
        highlight: symptoms.length > 0,
      },
      {
        id: 'state',
        icon: 'heart',
        headline: 'Emotional & energy space',
        narrative: emotionalNarrative,
        highlight: Boolean(emotionalState || energyLevel),
      },
    ],
    recommendedAction,
  };
}

/**
 * Creates the complete normalized data handoff packages for Meg and Home.
 */
function buildOnboardingResult(rawAnswers) {
  const answers = normalizeOnboardingAnswers(rawAnswers);
  const summary = buildPersonalizedSummary(answers);
  const primaryFocus = resolvePrimaryFocus(answers);
  const completedAt = new Date().toISOString();

  // 1. Canonical Onboarding Record
  const onboardingRecord = {
    version: '3.0.0',
    completedAt,
    firstName: answers.firstName,
    hasExplicitName: answers.hasExplicitName,
    reasonsForJoining: answers.reasonsForJoining,
    cyclePattern: answers.cyclePattern,
    cycleLengthEstimate: answers.cycleLengthEstimate,
    symptoms: answers.symptoms,
    emotionalState: answers.emotionalState,
    energyLevel: answers.energyLevel,
    priorities: answers.priorities,
    primaryFocus,
    recommendedFirstAction: summary.recommendedAction,
  };

  // 2. Meg AI Handoff Contract (safe client context)
  const megHandoff = {
    userName: answers.hasExplicitName ? answers.firstName : null,
    onboardingSummary: {
      reasons: answers.reasonsForJoining,
      cyclePattern: answers.cyclePattern,
      topSymptoms: answers.symptoms.slice(0, 5),
      recentEmotionalState: answers.emotionalState,
      baselineEnergy: answers.energyLevel,
      topPriorities: answers.priorities,
    },
    suggestedFirstTopic: summary.recommendedAction.contextHint,
  };

  // 3. Home Screen Personalization Contract
  const homePersonalizationHandoff = {
    firstName: answers.firstName,
    primaryPriority: primaryFocus,
    topSymptoms: answers.symptoms.slice(0, 4),
    cyclePattern: answers.cyclePattern,
    recommendedAction: summary.recommendedAction,
    welcomePillText: answers.reasonsForJoining.includes('diagnosed_pcos')
      ? 'PCOS gentle tracking'
      : 'Cycle & wellbeing',
  };

  return {
    onboardingRecord,
    megHandoff,
    homePersonalizationHandoff,
    summary,
  };
}

module.exports = {
  normalizeOnboardingAnswers,
  resolvePrimaryFocus,
  generateFirstAction,
  buildPersonalizedSummary,
  buildOnboardingResult,
};
