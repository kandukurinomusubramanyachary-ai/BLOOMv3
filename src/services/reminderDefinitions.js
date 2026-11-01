const DEFAULT_REMINDERS = {
  checkin: { enabled: true, time: '20:00' },
  period: { enabled: false, time: '20:00' },
  medication: { enabled: false, time: '09:00' },
  meals: { enabled: false, time: '13:00' },
  movement: { enabled: false, time: '18:00' },
  sleep: { enabled: false, time: '22:00' },
  weekly: { enabled: true, time: '09:00', day: 0 },
};

const REMINDER_CONFIGS = [
  {
    key: 'checkin',
    label: 'Daily check-in',
    desc: 'A gentle nudge to notice your day',
    icon: 'checkmark-circle-outline',
    title: 'A note from Bloom',
    body: 'Take a quiet moment for your daily check-in when you are ready.',
  },
  {
    key: 'period',
    label: 'Period logging',
    desc: 'Remember to update bleeding when it is useful',
    icon: 'water-outline',
    title: 'A note from Bloom',
    body: 'You can update your cycle record when it feels useful.',
  },
  {
    key: 'medication',
    label: 'Medicine or supplement',
    desc: 'A private prompt for something you planned',
    icon: 'medkit-outline',
    title: 'A note from Bloom',
    body: 'A gentle reminder for something you planned today.',
  },
  {
    key: 'meals',
    label: 'Meals',
    desc: 'A no-pressure prompt to log a meal',
    icon: 'restaurant-outline',
    title: 'A note from Bloom',
    body: 'Log a meal if it would help you remember your day.',
  },
  {
    key: 'movement',
    label: 'Movement',
    desc: 'A realistic prompt for movement or recovery',
    icon: 'walk-outline',
    title: 'A note from Bloom',
    body: 'Choose movement, stretching or rest based on how you feel.',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    desc: 'A quiet cue to begin winding down',
    icon: 'moon-outline',
    title: 'A note from Bloom',
    body: 'A small wind-down moment may help you prepare for rest.',
  },
  {
    key: 'weekly',
    label: 'Weekly summary',
    desc: 'A gentle prompt to review your week',
    icon: 'analytics-outline',
    title: 'Your Bloom week',
    body: 'Your weekly summary is ready whenever you want to look back.',
  },
];

function mergeReminders(saved = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_REMINDERS).map(([key, value]) => [
      key,
      { ...value, ...(saved[key] || {}) },
    ])
  );
}


module.exports = { DEFAULT_REMINDERS, REMINDER_CONFIGS, mergeReminders };
