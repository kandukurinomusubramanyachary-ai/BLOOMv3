/**
 * devSampleData
 *
 * Local/preview-only sample history (check-ins + periods) used to seed the
 * data screens (Today, Timeline, Insights, Doctor Report) when the app is
 * running with the fake login enabled (EXPO_PUBLIC_BLOOM_DEV_AUTH=1) and no
 * real stored data exists yet.
 *
 * This module is intentionally tiny and self-contained. It is only ever read
 * under the DEV-auth seed path in AppContext and never touches real data.
 *
 * IMPORTANT: this file is not committed to the repo in any branch; it is a
 * preview fallback reconstructed so the app can bundle and render.
 */
import { subDays } from 'date-fns';
import { localDateKey } from '../utils/dateKey';

const CYCLE_LENGTH = 28;
const PERIOD_LENGTH = 5;

const MOODS = [
  'calm', 'happy', 'low', 'anxious', 'irritated',
  'overwhelmed', 'emotionally_sensitive',
];

// Symptoms rise in the luteal phase and peak around the start of bleeding.
const LUTEAL_SYMPTOMS = [
  'cramps', 'bloating', 'cravings', 'mood_swings', 'breast_tenderness',
  'fatigue', 'headache', 'acne', 'insomnia',
];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function pick(list, index) {
  return list[index % list.length];
}

/**
 * Build a realistic sequence of daily check-ins for the trailing window.
 * @param {number} days how many days of history to generate (default 60)
 * @returns {Array<object>} check-in records shaped like the DailyCheckIn model
 */
export function buildSampleCheckins(days = 60) {
  const checkins = [];
  const today = new Date();

  for (let offset = days - 1; offset >= 1; offset -= 1) {
    const date = subDays(today, offset);
    const key = localDateKey(date);
    // 0 = today, descending; cycle position measured from the most recent
    // period start. Assume the most recent period start fell around offset 3.
    const cycleDay = ((3 + offset) % CYCLE_LENGTH) + 1;

    // Luteal phase is roughly cycle days 14-28.
    const luteal = cycleDay >= 14;
    const bleed = cycleDay <= PERIOD_LENGTH;

    const mood = pick(MOODS, offset + (bleed ? 3 : 0));
    const energy = clamp(8 - (luteal ? 3 : 0) - (bleed ? 2 : 0), 1, 10);
    const sleep = clamp(7.5 - (luteal ? 1.2 : 0) + (offset % 5 === 0 ? 0.6 : 0), 4, 9);
    const sleepQuality = sleep >= 7 ? 'good' : sleep >= 5.5 ? 'fair' : 'poor';
    const stress = clamp(3 + (luteal ? 3 : 0) + (offset % 7 === 0 ? 1 : 0), 0, 10);
    const pain = bleed ? clamp(6 - (cycleDay - 1) * 1.5, 2, 7) : (luteal ? 2 : 0);

    const symptoms = [];
    if (bleed) symptoms.push('cramps', 'fatigue', 'acne');
    if (luteal) {
      const subset = pushUniqueSymptoms(symptoms, LUTEAL_SYMPTOMS, Math.floor(offset % 4) + 1);
      // keep deterministic but light
      void subset;
    }
    if (luteal && symptoms.length === 0) symptoms.push('bloating');

    const flows = bleed ? (['spotting', 'light', 'medium', 'heavy', 'light']) : null;
    const flow = flows ? flows[clamp(cycleDay - 1, 0, flows.length - 1)] : 'none';

    const symptomSeverity = {};
    symptoms.forEach((symptom) => {
      symptomSeverity[symptom] = bleed && symptom === 'cramps' ? 'severe'
        : luteal ? 'moderate'
          : 'mild';
    });

    // Deterministic pseudo-random-ish variation by day offset.
    const cravings = luteal ? (offset % 3 === 0 ? 'chocolate' : 'salty snacks') : null;
    const water = clamp(6 + (offset % 5), 4, 10);
    const movement = offset % 2 === 0 ? 'walked 20 minutes' : null;

    checkins.push({
      id: key,
      date: key,
      mood,
      energy,
      sleep,
      sleepQuality,
      pain,
      flow,
      symptoms,
      symptomSeverity,
      cravings,
      water,
      stress,
      movement,
      movementNote: movement,
      notes: bleed ? `Day ${cycleDay} of my cycle.` : null,
    });
  }

  return checkins;
}

function pushUniqueSymptoms(target, list, count) {
  const result = [];
  for (let i = 0; i < count && i < list.length; i += 1) {
    const symptom = list[i];
    if (!target.includes(symptom)) {
      target.push(symptom);
      result.push(symptom);
    }
  }
  return result;
}

/**
 * Build period entries for the trailing window so cycle prediction and the
 * timeline/calendar have a cycle history to reason about.
 * @param {number} cycles how many cycles of history to generate (default 3)
 * @returns {Array<object>} PeriodEntry-shaped records
 */
export function buildSamplePeriods(cycles = 3) {
  const periods = [];
  const today = new Date();

  // Most recent period start 3 days ago, then every CYCLE_LENGTH days back.
  for (let i = 0; i < cycles; i += 1) {
    const startOffset = 3 + i * CYCLE_LENGTH;
    const startDate = subDays(today, startOffset);
    const endDate = subDays(today, startOffset - (PERIOD_LENGTH - 1));
    periods.push({
      id: `period-${localDateKey(startDate)}`,
      startDate: localDateKey(startDate),
      endDate: localDateKey(endDate),
      flow: 'medium',
      source: 'manual',
    });
  }

  return periods;
}
