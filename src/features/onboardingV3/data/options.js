/**
 * Onboarding V3 options, questions, metadata, and microcopy.
 */

const ONBOARDING_STEPS = Object.freeze({
  WELCOME: 0,
  NAME: 1,
  REASONS: 2,
  CYCLE: 3,
  SYMPTOMS: 4,
  EMOTIONS: 5,
  ENERGY: 6,
  PRIORITIES: 7,
  PROCESSING: 8,
  RESULT: 9,
});

const TOTAL_INTERACTIVE_STEPS = 7; // Steps 1 through 7 (excluding Welcome, Processing, Result)

const REASONS_OPTIONS = [
  {
    id: 'irregular_periods',
    label: 'My periods are irregular',
    icon: 'calendar-outline',
    description: 'Cycles vary widely or show up unpredictably',
  },
  {
    id: 'diagnosed_pcos',
    label: 'I have PCOS / PCOD',
    icon: 'flower-outline',
    description: 'Confirmed diagnosis, looking for supportive daily balance',
  },
  {
    id: 'suspected_pcos',
    label: 'I think I may have PCOS / PCOD',
    icon: 'help-circle-outline',
    description: 'Noticing signs and want to track without self-judgment',
  },
  {
    id: 'understand_symptoms',
    label: 'I want to understand my symptoms',
    icon: 'pulse-outline',
    description: 'Connect cramps, mood, sleep, and physical signals',
  },
  {
    id: 'fitness_strength',
    label: 'I want help with fitness / strength',
    icon: 'fitness-outline',
    description: 'Gentle, hormone-respectful workouts that feel sustainable',
  },
  {
    id: 'emotional_support',
    label: 'I want emotional support',
    icon: 'heart-outline',
    description: 'A compassionate, non-clinical space to reflect',
  },
  {
    id: 'understand_body',
    label: 'I want to understand my body better',
    icon: 'sparkles-outline',
    description: 'Learn my natural patterns at my own pace',
  },
  {
    id: 'something_else',
    label: 'Something else',
    icon: 'ellipsis-horizontal-outline',
    description: 'Taking things one day at a time',
  },
];

const CYCLE_PATTERN_OPTIONS = [
  {
    id: 'regular',
    label: 'Mostly regular',
    tag: 'Predictable',
    description: 'Arrives roughly around the same time each month (26–32 days)',
  },
  {
    id: 'sometimes_unpredictable',
    label: 'Sometimes unpredictable',
    tag: 'Fluctuating',
    description: 'Can shift by a week or two depending on stress and life',
  },
  {
    id: 'very_irregular',
    label: 'Very irregular',
    tag: 'Irregular',
    description: 'Ranges widely between 35 and 90+ days without a set rhythm',
  },
  {
    id: 'no_recent_period',
    label: 'I haven’t had a period recently',
    tag: 'Paused / Missing',
    description: 'It has been several months, or postpartum/birth control transition',
  },
  {
    id: 'not_sure',
    label: 'I’m not sure',
    tag: 'Uncertain',
    description: 'Haven’t been keeping track yet — and that is completely okay',
  },
];

const CYCLE_LENGTH_OPTIONS = [
  { id: 'under_24', label: 'Under 24 days', tag: 'Shorter' },
  { id: '25_30', label: '25 – 30 days', tag: 'Standard' },
  { id: '31_38', label: '31 – 38 days', tag: 'A bit longer' },
  { id: '39_55', label: '39 – 55 days', tag: 'Longer' },
  { id: '55_plus', label: '55+ days / Variable', tag: 'Extended' },
  { id: 'not_sure', label: 'I’m not sure', tag: 'Uncertain' },
];

const SYMPTOM_OPTIONS = [
  { id: 'cramps', label: 'Cramps & pelvic ache', icon: 'pulse-outline', category: 'physical' },
  { id: 'bloating', label: 'Bloating & fullness', icon: 'water-outline', category: 'physical' },
  { id: 'fatigue', label: 'Fatigue / low stamina', icon: 'battery-dead-outline', category: 'energy' },
  { id: 'cravings', label: 'Sugar & food cravings', icon: 'restaurant-outline', category: 'diet' },
  { id: 'mood_changes', label: 'Mood swings & irritability', icon: 'swap-horizontal-outline', category: 'emotional' },
  { id: 'acne', label: 'Acne / skin flares', icon: 'sparkles-outline', category: 'physical' },
  { id: 'sleep_problems', label: 'Trouble sleeping or waking', icon: 'moon-outline', category: 'energy' },
  { id: 'hair_fall', label: 'Hair fall / thinning', icon: 'leaf-outline', category: 'physical' },
  { id: 'unwanted_hair', label: 'Unwanted facial/body hair', icon: 'body-outline', category: 'physical' },
  { id: 'headaches', label: 'Headaches or brain fog', icon: 'medical-outline', category: 'physical' },
  { id: 'weight_changes', label: 'Weight resistance / shifts', icon: 'fitness-outline', category: 'physical' },
  { id: 'irregular_periods', label: 'Late or skipped periods', icon: 'calendar-outline', category: 'cycle' },
];

const EMOTIONAL_STATE_OPTIONS = [
  {
    id: 'pretty_good',
    label: 'Pretty good',
    icon: 'sunny-outline',
    description: 'Feeling relatively balanced and grounded right now',
  },
  {
    id: 'overwhelmed',
    label: 'A little overwhelmed',
    icon: 'rainy-outline',
    description: 'A lot of responsibilities or body signals competing for focus',
  },
  {
    id: 'stressed',
    label: 'Stressed & tense',
    icon: 'flash-outline',
    description: 'Mental tension or daily pressure wearing me down',
  },
  {
    id: 'low_drained',
    label: 'Low / drained',
    icon: 'cloud-outline',
    description: 'Hard to find enthusiasm; energy feels very thin',
  },
  {
    id: 'frustrated_body',
    label: 'Frustrated with my body',
    icon: 'flower-outline',
    description: 'Feeling like my body isn’t cooperating or doing what it should',
  },
  {
    id: 'anxious_health',
    label: 'Anxious about my health',
    icon: 'heart-outline',
    description: 'Worrying about what my symptoms mean for the future',
  },
  {
    id: 'changes_a_lot',
    label: 'It changes a lot',
    icon: 'swap-horizontal-outline',
    description: 'Fine one day, completely exhausted or emotional the next',
  },
];

const ENERGY_LEVEL_OPTIONS = [
  {
    id: 1,
    level: 1,
    label: 'Very low',
    sublabel: 'Running on empty',
    description: 'Even small tasks feel heavy today',
    icon: 'battery-dead-outline',
    color: '#B52F50',
  },
  {
    id: 2,
    level: 2,
    label: 'Low',
    sublabel: 'Easily tired',
    description: 'Dragging through the day with limited reserve',
    icon: 'battery-half-outline',
    color: '#C0755A',
  },
  {
    id: 3,
    level: 3,
    label: 'Okay',
    sublabel: 'Steady enough',
    description: 'Managing baseline tasks with quiet pacing',
    icon: 'leaf-outline',
    color: '#9A651E',
  },
  {
    id: 4,
    level: 4,
    label: 'Good',
    sublabel: 'Pleasantly alert',
    description: 'Comfortable focus and physical stamina',
    icon: 'sunny-outline',
    color: '#60745C',
  },
  {
    id: 5,
    level: 5,
    label: 'High',
    sublabel: 'Vibrant & active',
    description: 'Abundant drive and readiness for movement',
    icon: 'flash-outline',
    color: '#2E7D32',
  },
];

const PRIORITY_OPTIONS = [
  {
    id: 'understand_cycle',
    label: 'Understand my cycle patterns',
    tag: 'Cycle insights',
    icon: 'calendar-outline',
    description: 'Make sense of unpredictable dates, phases, and windows',
  },
  {
    id: 'manage_symptoms',
    label: 'Manage & reduce symptoms',
    tag: 'Daily comfort',
    icon: 'pulse-outline',
    description: 'Learn what soothes cramps, bloating, and flare-ups',
  },
  {
    id: 'emotional_support',
    label: 'Feel emotionally supported',
    tag: 'Meg AI care',
    icon: 'chatbubbles-outline',
    description: 'A compassionate space that listens without judgment',
  },
  {
    id: 'build_strength',
    label: 'Build strength safely',
    tag: 'Movement',
    icon: 'fitness-outline',
    description: 'Gentle, hormone-friendly movement paced to my body',
  },
  {
    id: 'improve_consistency',
    label: 'Build gentle consistency',
    tag: 'Small habits',
    icon: 'sparkles-outline',
    description: '30-second daily check-ins that never feel like homework',
  },
  {
    id: 'prepare_doctor',
    label: 'Prepare better for doctor visits',
    tag: 'Health history',
    icon: 'medical-outline',
    description: 'Turn months of daily notes into clear appointment summaries',
  },
  {
    id: 'healthier_habits',
    label: 'Nourish food & energy',
    tag: 'Diet & nourishment',
    icon: 'nutrition-outline',
    description: 'Blood sugar-friendly ideas without rigid food rules',
  },
];

module.exports = {
  ONBOARDING_STEPS,
  TOTAL_INTERACTIVE_STEPS,
  REASONS_OPTIONS,
  CYCLE_PATTERN_OPTIONS,
  CYCLE_LENGTH_OPTIONS,
  SYMPTOM_OPTIONS,
  EMOTIONAL_STATE_OPTIONS,
  ENERGY_LEVEL_OPTIONS,
  PRIORITY_OPTIONS,
};
