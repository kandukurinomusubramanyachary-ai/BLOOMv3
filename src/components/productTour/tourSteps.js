import { Platform } from 'react-native';

const step = (id, title, description, actionLabel = 'Next') => ({ id, title, description, actionLabel });

export const GUIDE_METADATA = {
  appOverview: { title: 'Want a quick tour of Bloom?', duration: 'under a minute', body: 'We can show you where the important things live.' },
  today: { title: 'Want a quick guide to Today?', duration: '15 sec', body: 'We’ll point out the few things that are most useful to know.' },
  checkin: { title: 'Want a quick guide to Check-In?', duration: '20 sec', body: 'We’ll show you the important parts without explaining every field.' },
  timeline: { title: 'Want a quick guide to Timeline?', duration: '15 sec', body: 'We’ll show you where to look for patterns over time.' },
  meg: { title: 'Want a quick guide to Meg?', duration: '20 sec', body: 'We’ll show you how Bloom context can continue into conversation.' },
  strengthHome: { title: 'Want a quick guide to Strength?', duration: '20 sec', body: 'We’ll show you how to find a session that fits today.' },
  strengthWorkout: { title: 'Want help with your first workout?', duration: '25 sec', body: 'Start a workout and the guide will meet you there.', requiresContext: true, contextHint: 'Choose a workout. The guide will begin when the real player is ready.' },
  strengthSummary: { title: 'Want to understand your workout summary?', duration: '15 sec', body: 'Finish a workout and the guide will open with your real summary.', requiresContext: true, contextHint: 'Complete a workout. The guide will begin when your summary appears.' },
  profile: { title: 'Want a quick guide to Profile?', duration: '15 sec', body: 'We’ll show you where personalization, appearance, and privacy live.' },
};

export const TOUR_SETS = {
  appOverview: [
    step('home-today', 'Your day starts here', 'Bloom brings together what matters today — your check-in, cycle context, energy, and next step.'),
    step('timeline', 'See your patterns over time', 'Your cycle, symptoms, check-ins, and important dates come together here.'),
    step('meg', 'Meet Meg', 'Talk naturally about your body, symptoms, emotions, or anything that feels confusing.'),
    step('strength', 'Build strength at your own pace', 'Bloom includes guided workouts designed around consistency and daily energy.'),
    step('profile', 'Make Bloom yours', 'Manage personalization, appearance, privacy, reminders, and your account here.', 'Finish'),
  ],
  today: [
    step('home-today', 'What matters today', 'Bloom brings the most relevant thing to the top so you do not have to decide where to start.'),
    step('daily-checkin', 'A quick check-in helps Bloom learn your patterns', 'Logging how you feel takes only a short moment and connects symptoms, mood, energy, and cycle information over time.'),
    step('today-snapshot', 'Your next step', 'Bloom uses what you have logged to make the app feel more relevant to your day.', 'Finish'),
  ],
  timeline: [
    step('timeline-cycle', 'Your history in one place', 'See cycle dates, check-ins, symptoms, and important changes over time.'),
    step('timeline-estimates', 'Patterns, not perfection', 'Bloom works even when periods are irregular or unpredictable.'),
    step('timeline-history', 'Look back when something feels important', 'Tap a day or record to understand what was happening then.', 'Finish'),
  ],
  meg: [
    step('meg-welcome', 'Talk naturally', 'You do not need special wording. Tell Meg what is happening in your own words.'),
    step('meg-context', 'Your check-in can continue here', 'Meg can use relevant information you logged to make the conversation feel connected.'),
    step('meg-history', 'Return to a conversation when it helps', 'Your recent conversations stay together so you can pick up a useful thread.', 'Finish'),
  ],
  strengthHome: [
    step('strength-recommendation', 'Your workout starts here', 'Bloom helps you choose a session without needing to plan everything yourself.'),
    step('strength-browse', 'Choose what fits today', 'Pick a session that matches your time and energy.'),
    step('strength-progress', 'Your progress stays here', 'Past sessions help you see your consistency over time.', 'Finish'),
  ],
  strengthWorkout: Platform.OS === 'web' ? [
    step('strength-workout-progress', 'One movement at a time', 'Bloom guides you through your current movement, sets, and rest.'),
    step('strength-guidance', 'Watch this for guidance', 'Bloom shows simple cues while you move.'),
    step('strength-reps', 'Your progress updates here', 'On supported tracked workouts, Bloom can count accepted reps.'),
    step('strength-pause', 'Pause whenever you need', 'You stay in control of the workout.', 'Finish'),
  ] : [
    step('strength-workout-progress', 'One movement at a time', 'Bloom guides the current movement, sets, and rest.'),
    step('strength-guidance', 'Follow the pace that feels right', 'Use the timer and simple cues. Your movement is not measured.'),
    step('strength-pause', 'Pause whenever you need', 'You stay in control of the workout.', 'Finish'),
  ],
  strengthSummary: [
    step('strength-summary-result', 'Your session at a glance', 'See what you completed without needing to interpret complicated metrics.'),
    step('strength-summary-history', 'This becomes part of your progress', 'Completed sessions can contribute to your Strength history.', 'Finish'),
  ],
  checkin: [
    step('checkin-body', 'Tell Bloom what you notice', 'Choose only the symptoms or body signals that matter today.', 'Finish'),
  ],
  profile: [
    step('profile-preferences', 'Make Bloom fit you', 'Update preferences and guidance settings here.'),
    step('profile-appearance', 'Choose how Bloom looks', 'Switch between the available appearance options whenever you like.'),
    step('profile-privacy', 'Your data stays in your control', 'Privacy, export, and account options live here.', 'Finish'),
  ],
};

export const TOUR_SET_LABELS = {
  appOverview: 'Getting around Bloom', today: 'Today', checkin: 'Daily Check-In', timeline: 'Timeline', meg: 'Meg', strengthHome: 'Strength basics', strengthWorkout: 'First workout', strengthSummary: 'Workout summary', profile: 'Profile & appearance',
};

export const TOUR_STEPS = TOUR_SETS.appOverview;
export const PRODUCT_TOUR_STORAGE_KEY = '@bloom_product_tours_v3';
