import { Platform } from 'react-native';
import { notifications } from './notifications';

export const WATER_REMINDER_CATEGORY = 'bloom-water-reminders';
export const WATER_REMINDER_DEFAULTS = Object.freeze({
  enabled: true,
  intervalHours: 3,
  startTime: '08:00',
  endTime: '23:00',
  notificationIds: [],
  scheduleSignature: null,
  permissionRequested: false,
});

const COPY = [
  { title: 'A little water break 💧', body: 'Take a few sips when you can.' },
  { title: 'Hydration check 💧', body: 'Your body might appreciate some water.' },
  { title: 'Tiny reminder 💧', body: 'A few sips now can go a long way.' },
];

function minutesFromTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

function timeFromMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function normalizeWaterReminderSettings(value = {}) {
  const intervalHours = [2, 3, 4].includes(Number(value.intervalHours))
    ? Number(value.intervalHours)
    : WATER_REMINDER_DEFAULTS.intervalHours;
  const startTime = minutesFromTime(value.startTime) == null ? WATER_REMINDER_DEFAULTS.startTime : value.startTime;
  const endTime = minutesFromTime(value.endTime) == null ? WATER_REMINDER_DEFAULTS.endTime : value.endTime;
  return {
    ...WATER_REMINDER_DEFAULTS,
    ...value,
    enabled: value.enabled !== false,
    intervalHours,
    startTime,
    endTime,
    notificationIds: Array.isArray(value.notificationIds)
      ? [...new Set(value.notificationIds.filter((id) => typeof id === 'string' && id))]
      : [],
    scheduleSignature: typeof value.scheduleSignature === 'string' ? value.scheduleSignature : null,
    permissionRequested: value.permissionRequested === true,
  };
}

export function generateWaterReminderTimes(value = WATER_REMINDER_DEFAULTS) {
  const settings = normalizeWaterReminderSettings(value);
  const start = minutesFromTime(settings.startTime);
  const end = minutesFromTime(settings.endTime);
  if (start == null || end == null || end < start) {
    throw new Error('End time must be later than the start time.');
  }
  const times = [];
  for (let minute = start; minute <= end; minute += settings.intervalHours * 60) {
    times.push(timeFromMinutes(minute));
  }
  return times;
}

export function waterScheduleSignature(value) {
  const settings = normalizeWaterReminderSettings(value);
  return `${settings.intervalHours}h-${settings.startTime.replace(':', '')}-${settings.endTime.replace(':', '')}`;
}

function expectedSchedule(value) {
  const settings = normalizeWaterReminderSettings(value);
  const signature = waterScheduleSignature(settings);
  return generateWaterReminderTimes(settings).map((time, index) => {
    const [hour, minute] = time.split(':').map(Number);
    return {
      identifier: `${WATER_REMINDER_CATEGORY}-${signature}-${time.replace(':', '')}`,
      hour,
      minute,
      ...COPY[index % COPY.length],
    };
  });
}

function isWaterNotification(item) {
  return item?.content?.data?.category === WATER_REMINDER_CATEGORY
    || String(item?.identifier || '').startsWith(`${WATER_REMINDER_CATEGORY}-`);
}

function permissionError(permission) {
  const error = new Error(permission.canAskAgain
    ? 'Bloom needs notification permission before water reminders can turn on.'
    : 'Notifications are blocked for Bloom. Enable them in your device settings, then try again.');
  error.code = 'permission';
  error.canAskAgain = permission.canAskAgain;
  return error;
}

export function createWaterReminderService(adapter = notifications, platform = Platform.OS) {
  async function permissionStatus() {
    if (platform === 'web') return { status: 'unsupported', granted: false, canAskAgain: false };
    return adapter.getPermissionStatus();
  }

  async function requestNotificationPermission() {
    if (platform === 'web') return { status: 'unsupported', granted: false, canAskAgain: false };
    return adapter.requestPermission();
  }

  async function cancelWaterReminders(notificationIds = [], scheduled = null) {
    const current = scheduled || await adapter.getScheduledReminders();
    const ids = new Set(notificationIds);
    current.filter(isWaterNotification).forEach((item) => ids.add(item.identifier));
    await Promise.all([...ids].filter(Boolean).map((id) => adapter.cancelReminder(id)));
    return [];
  }

  async function scheduleWaterReminders(value) {
    const settings = normalizeWaterReminderSettings(value);
    if (!settings.enabled) return { ...settings, notificationIds: [], scheduleSignature: null };
    const permission = await permissionStatus();
    if (!permission.granted) throw permissionError(permission);
    const schedule = expectedSchedule(settings);
    const created = [];
    await adapter.setupWaterReminderChannel();
    try {
      for (const item of schedule) {
        const id = await adapter.scheduleDailyReminder({
          ...item,
          channelId: WATER_REMINDER_CATEGORY,
          data: { category: WATER_REMINDER_CATEGORY, time: `${String(item.hour).padStart(2, '0')}:${String(item.minute).padStart(2, '0')}` },
        });
        created.push(id || item.identifier);
      }
    } catch (error) {
      await Promise.all(created.map((id) => adapter.cancelReminder(id).catch(() => undefined)));
      throw error;
    }
    return { ...settings, notificationIds: created, scheduleSignature: waterScheduleSignature(settings) };
  }

  async function rescheduleWaterReminders(value, previousValue = value) {
    const next = normalizeWaterReminderSettings(value);
    const previous = normalizeWaterReminderSettings(previousValue);
    if (!next.enabled) {
      await cancelWaterReminders(previous.notificationIds);
      return { ...next, notificationIds: [], scheduleSignature: null };
    }
    const scheduled = await scheduleWaterReminders(next);
    const keep = new Set(scheduled.notificationIds);
    await Promise.all(previous.notificationIds
      .filter((id) => !keep.has(id))
      .map((id) => adapter.cancelReminder(id)));
    return scheduled;
  }

  async function reconcileWaterReminders(value) {
    const settings = normalizeWaterReminderSettings(value);
    if (platform === 'web') return settings;
    if (!settings.enabled) {
      if (settings.notificationIds.length) await cancelWaterReminders(settings.notificationIds);
      return { ...settings, notificationIds: [], scheduleSignature: null };
    }
    const permission = await permissionStatus();
    if (!permission.granted) return settings;
    const scheduled = await adapter.getScheduledReminders();
    const expected = expectedSchedule(settings).map((item) => item.identifier);
    const actualWaterIds = scheduled.filter(isWaterNotification).map((item) => item.identifier);
    const consistent = settings.scheduleSignature === waterScheduleSignature(settings)
      && expected.length === actualWaterIds.length
      && expected.every((id) => actualWaterIds.includes(id))
      && expected.every((id) => settings.notificationIds.includes(id));
    if (consistent) return settings;
    const repaired = await scheduleWaterReminders(settings);
    await cancelWaterReminders(
      actualWaterIds.filter((id) => !repaired.notificationIds.includes(id)),
      []
    );
    return repaired;
  }

  return {
    permissionStatus,
    requestNotificationPermission,
    cancelWaterReminders,
    scheduleWaterReminders,
    rescheduleWaterReminders,
    reconcileWaterReminders,
  };
}

export const waterReminderService = createWaterReminderService();
