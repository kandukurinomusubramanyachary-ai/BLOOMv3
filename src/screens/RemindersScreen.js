import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';
import { notifications } from '../services/notifications';
import ScreenHeader from '../components/ScreenHeader';
import ScreenScaffold from '../components/ScreenScaffold';
import {
  generateWaterReminderTimes,
  normalizeWaterReminderSettings,
  waterReminderService,
} from '../services/waterReminders';

const WATER_INTERVALS = [2, 3, 4];

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

function formatClock(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`;
}

function shiftClock(value, hours) {
  const [hour, minute] = String(value).split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + hours * 60));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function waterScheduleSummary(settings) {
  try {
    return `${generateWaterReminderTimes(settings).length} quiet reminders daily · ${formatClock(settings.startTime)}–${formatClock(settings.endTime)}`;
  } catch {
    return 'Choose an end time later than the start time.';
  }
}

export default function RemindersScreen({ navigation }) {
  const { state, saveSettings } = useApp();
  const [reminders, setReminders] = useState(() => mergeReminders(state.settings?.reminders));
  const [water, setWater] = useState(() => normalizeWaterReminderSettings(state.settings?.waterReminders));
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    void notifications.setupAndroidChannel().catch((error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Bloom reminders] Notification channel setup failed.', error);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    async function initializeWaterReminders() {
      if (Platform.OS === 'web') return;
      const current = normalizeWaterReminderSettings(state.settings?.waterReminders);
      try {
        let permission = await waterReminderService.permissionStatus();
        let next = current;
        if (current.enabled && !permission.granted && !current.permissionRequested) {
          permission = await waterReminderService.requestNotificationPermission();
          next = { ...current, permissionRequested: true, enabled: permission.granted };
        } else if (current.enabled && !permission.granted) {
          next = { ...current, enabled: false };
        }
        if (next.enabled && permission.granted) {
          next = await waterReminderService.reconcileWaterReminders(next);
        }
        if (!active) return;
        if (JSON.stringify(next) !== JSON.stringify(current)) {
          await saveSettings({ waterReminders: next });
        }
        setWater(next);
        if (!permission.granted && current.enabled) {
          setError(permission.canAskAgain
            ? 'Bloom needs notification permission before water reminders can turn on.'
            : 'Notifications are blocked for Bloom. Enable them in your device settings, then try again.');
        }
      } catch {
        if (active) setError('Bloom could not prepare water reminders. Your settings are still here.');
      }
    }
    void initializeWaterReminders();
    return () => { active = false; };
  }, []);

  async function updateWater(nextValue, successMessage, requestPermission = false) {
    if (busyKey) return;
    setBusyKey('water');
    setError('');
    setStatus('');
    const previous = water;
    try {
      let next = normalizeWaterReminderSettings({ ...previous, ...nextValue });
      generateWaterReminderTimes(next);
      if (requestPermission && next.enabled) {
        const permission = await waterReminderService.requestNotificationPermission();
        next = { ...next, permissionRequested: true };
        if (!permission.granted) {
          next = { ...next, enabled: false, notificationIds: [], scheduleSignature: null };
          await saveSettings({ waterReminders: next });
          setWater(next);
          setError(permission.canAskAgain
            ? 'Bloom needs notification permission before water reminders can turn on.'
            : 'Notifications are blocked for Bloom. Enable them in your device settings, then try again.');
          return;
        }
      }
      const scheduled = await waterReminderService.rescheduleWaterReminders(next, previous);
      try {
        await saveSettings({ waterReminders: scheduled });
      } catch (saveError) {
        await waterReminderService.rescheduleWaterReminders(previous, scheduled).catch(() => undefined);
        throw saveError;
      }
      setWater(scheduled);
      setStatus(successMessage);
    } catch (updateError) {
      setError(updateError?.message === 'End time must be later than the start time.'
        ? updateError.message
        : 'Bloom could not update water reminders. Please try again.');
    } finally {
      setBusyKey(null);
    }
  }

  async function schedule(key, reminder) {
    const config = REMINDER_CONFIGS.find((item) => item.key === key);
    const [hour, minute] = reminder.time.split(':').map(Number);
    const weekday = key === 'weekly' ? Number(reminder.day) + 1 : null;
    await notifications.scheduleReminder(key, config.title, config.body, hour, minute, true, weekday);
  }

  async function toggleReminder(key, enabled) {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    setStatus('');

    try {
      if (enabled) {
        const permissionGranted = await notifications.requestPermissions();
        if (!permissionGranted) {
          const permissionError = new Error('Notifications are turned off for Bloom. You can enable them in your device settings.');
          permissionError.code = 'permission';
          throw permissionError;
        }
      }

      const updated = {
        ...reminders,
        [key]: { ...reminders[key], enabled },
      };
      await saveSettings({ reminders: updated });
      if (enabled) await schedule(key, updated[key]);
      else await notifications.cancelReminder(key);
      setReminders(updated);
      setStatus(`${REMINDER_CONFIGS.find((item) => item.key === key)?.label} reminder ${enabled ? 'turned on' : 'turned off'}.`);
    } catch (updateError) {
      setError(
        updateError.code === 'permission'
          ? updateError.message
          : 'Bloom could not update this reminder. Please try again.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function adjustTime(key, minutes) {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    setStatus('');
    const current = reminders[key] || DEFAULT_REMINDERS[key];
    const [hour, minute] = current.time.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute + minutes, 0, 0);
    const newTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const updated = { ...reminders, [key]: { ...current, time: newTime } };

    try {
      await saveSettings({ reminders: updated });
      if (updated[key].enabled) await schedule(key, updated[key]);
      setReminders(updated);
      setStatus(`${REMINDER_CONFIGS.find((item) => item.key === key)?.label} reminder moved to ${newTime}.`);
    } catch (updateError) {
      setError('Bloom could not update this reminder time. Please try again.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ScreenScaffold
      contentContainerStyle={styles.scrollContent}
      innerStyle={styles.content}
    >
          <BackButton onPress={() => navigation.goBack()} />
          <ScreenHeader
            title='Reminders'
            subtitle='Choose a few useful prompts. Missing one never resets your progress.'
          />

          {error ? (
            <View style={styles.errorState} accessibilityRole='alert' accessibilityLiveRegion='assertive'>
              <Icon name='alert-circle-outline' size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {status ? (
            <View style={styles.successState} accessibilityRole='status' accessibilityLiveRegion='polite'>
              <Icon name='checkmark-circle-outline' size={20} color={COLORS.sage} />
              <Text style={styles.successText}>{status}</Text>
            </View>
          ) : null}

          <View style={styles.waterIntro}>
            <View style={styles.waterIntroIcon}><Icon name='water-outline' size={21} color={COLORS.sage} /></View>
            <View style={styles.reminderCopy}>
              <Text style={styles.waterIntroTitle}>Stay gently hydrated</Text>
              <Text style={styles.waterIntroText}>Bloom can send quiet reminders during the day so you don’t have to remember on your own.</Text>
            </View>
          </View>

          <View style={styles.waterCard}>
            <Pressable
              onPress={() => updateWater(
                { enabled: !water.enabled },
                `Water reminders turned ${water.enabled ? 'off' : 'on'}.`,
                !water.enabled
              )}
              disabled={Boolean(busyKey) || Platform.OS === 'web'}
              accessibilityRole='switch'
              accessibilityLabel='Water reminders'
              accessibilityState={{ checked: water.enabled, disabled: Boolean(busyKey) || Platform.OS === 'web', busy: busyKey === 'water' }}
              style={({ pressed, hovered, focused }) => [styles.waterHeader, hovered && styles.headerHovered, focused && styles.headerFocused, pressed && styles.headerPressed]}
            >
              <View style={styles.iconBox}><Icon name='water-outline' size={20} color={COLORS.brand} /></View>
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderLabel}>Water reminders</Text>
                <Text style={styles.reminderDesc}>{Platform.OS === 'web' ? 'Available in the Bloom mobile app' : 'Quiet prompts within your active hours'}</Text>
              </View>
              <View style={[styles.switchTrack, water.enabled && styles.switchTrackActive]}>
                <View style={[styles.switchKnob, water.enabled && styles.switchKnobActive]}>
                  {water.enabled ? <Icon name='checkmark' size={12} color={COLORS.brand} /> : null}
                </View>
              </View>
            </Pressable>

            <View style={[styles.waterControls, !water.enabled && styles.controlsDisabled]} pointerEvents={water.enabled ? 'auto' : 'none'}>
              <Text style={styles.controlLabel}>Remind me every</Text>
              <View style={styles.intervalRow} accessibilityRole='radiogroup'>
                {WATER_INTERVALS.map((hours) => {
                  const selected = water.intervalHours === hours;
                  return <Pressable key={hours} onPress={() => updateWater({ intervalHours: hours }, `Water reminders will arrive every ${hours} hours.`)} disabled={Boolean(busyKey)} accessibilityRole='radio' accessibilityState={{ checked: selected, disabled: Boolean(busyKey) }} style={({ pressed, focused }) => [styles.intervalButton, selected && styles.intervalButtonSelected, focused && styles.focusedControl, pressed && styles.pressed]}><Text style={[styles.intervalText, selected && styles.intervalTextSelected]}>{hours} hours</Text></Pressable>;
                })}
              </View>

              <Text style={styles.controlLabel}>Active hours</Text>
              <View style={styles.activeHours}>
                <TimeControl label='Start' value={water.startTime} disabled={Boolean(busyKey)} onEarlier={() => updateWater({ startTime: shiftClock(water.startTime, -1) }, `Active hours now begin at ${formatClock(shiftClock(water.startTime, -1))}.`)} onLater={() => updateWater({ startTime: shiftClock(water.startTime, 1) }, `Active hours now begin at ${formatClock(shiftClock(water.startTime, 1))}.`)} />
                <TimeControl label='End' value={water.endTime} disabled={Boolean(busyKey)} onEarlier={() => updateWater({ endTime: shiftClock(water.endTime, -1) }, `Active hours now end at ${formatClock(shiftClock(water.endTime, -1))}.`)} onLater={() => updateWater({ endTime: shiftClock(water.endTime, 1) }, `Active hours now end at ${formatClock(shiftClock(water.endTime, 1))}.`)} />
              </View>
              <Text style={styles.scheduleSummary}>{waterScheduleSummary(water)}</Text>
            </View>
          </View>

          <Text style={styles.otherHeading}>Other reminders</Text>

          <View style={styles.list}>
            {REMINDER_CONFIGS.map((config, index) => {
              const reminder = reminders[config.key] || DEFAULT_REMINDERS[config.key];
              const busy = busyKey === config.key;
              return (
                <View
                  key={config.key}
                  style={[
                    styles.reminderItem,
                    index < REMINDER_CONFIGS.length - 1 && styles.reminderItemDivider,
                  ]}
                >
                  <Pressable
                    onPress={() => toggleReminder(config.key, !reminder.enabled)}
                    disabled={Boolean(busyKey)}
                    accessibilityRole='switch'
                    accessibilityLabel={`${config.label} reminder`}
                    accessibilityHint={config.desc}
                    accessibilityState={{ checked: Boolean(reminder.enabled), disabled: Boolean(busyKey), busy }}
                    style={({ pressed, hovered, focused }) => [
                      styles.reminderHeader,
                      hovered && !busyKey && styles.headerHovered,
                      focused && styles.headerFocused,
                      pressed && !busyKey && styles.headerPressed,
                    ]}
                  >
                    <View style={styles.iconBox}>
                      <Icon name={config.icon} size={20} color={COLORS.brand} />
                    </View>
                    <View style={styles.reminderCopy}>
                      <Text style={styles.reminderLabel}>{config.label}</Text>
                      <Text style={styles.reminderDesc}>{config.desc}</Text>
                    </View>
                    <View style={[styles.switchTrack, reminder.enabled && styles.switchTrackActive]}>
                      <View style={[styles.switchKnob, reminder.enabled && styles.switchKnobActive]}>
                        {reminder.enabled ? <Icon name='checkmark' size={12} color={COLORS.brand} /> : null}
                      </View>
                    </View>
                  </Pressable>

                  {reminder.enabled ? (
                    <View style={styles.timePicker}>
                      <Pressable
                        onPress={() => adjustTime(config.key, -30)}
                        disabled={Boolean(busyKey)}
                        accessibilityRole='button'
                        accessibilityLabel={`Move ${config.label} 30 minutes earlier`}
                        accessibilityState={{ disabled: Boolean(busyKey), busy }}
                        style={({ pressed, hovered, focused }) => [
                          styles.timeButton,
                          hovered && !busyKey && styles.timeButtonHovered,
                          focused && styles.focusedControl,
                          pressed && !busyKey && styles.pressed,
                        ]}
                      >
                        <Icon name='remove' size={22} color={COLORS.ink} />
                      </Pressable>
                      <View style={styles.timeCopy} accessible accessibilityLabel={`${config.label} reminder time ${reminder.time}`}>
                        <Text style={styles.timeLabel}>{busy ? 'Updating' : 'Reminder time'}</Text>
                        <Text style={styles.timeText}>{reminder.time}</Text>
                      </View>
                      <Pressable
                        onPress={() => adjustTime(config.key, 30)}
                        disabled={Boolean(busyKey)}
                        accessibilityRole='button'
                        accessibilityLabel={`Move ${config.label} 30 minutes later`}
                        accessibilityState={{ disabled: Boolean(busyKey), busy }}
                        style={({ pressed, hovered, focused }) => [
                          styles.timeButton,
                          hovered && !busyKey && styles.timeButtonHovered,
                          focused && styles.focusedControl,
                          pressed && !busyKey && styles.pressed,
                        ]}
                      >
                        <Icon name='add' size={22} color={COLORS.ink} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.note}>
            <Icon name='notifications-outline' size={18} color={COLORS.sage} />
            <Text style={styles.noteText}>
              Bloom uses quiet, neutral notification text. Your device controls whether reminders are delivered.
            </Text>
          </View>
    </ScreenScaffold>
  );
}

function TimeControl({ label, value, disabled, onEarlier, onLater }) {
  return (
    <View style={styles.timeControl}>
      <Text style={styles.timeControlLabel}>{label}</Text>
      <View style={styles.timeControlRow}>
        <Pressable onPress={onEarlier} disabled={disabled} accessibilityRole='button' accessibilityLabel={`Move ${label.toLowerCase()} time one hour earlier`} style={({ pressed, focused }) => [styles.compactTimeButton, focused && styles.focusedControl, pressed && styles.pressed]}><Icon name='remove' size={18} color={COLORS.ink} /></Pressable>
        <Text style={styles.waterTime}>{formatClock(value)}</Text>
        <Pressable onPress={onLater} disabled={disabled} accessibilityRole='button' accessibilityLabel={`Move ${label.toLowerCase()} time one hour later`} style={({ pressed, focused }) => [styles.compactTimeButton, focused && styles.focusedControl, pressed && styles.pressed]}><Icon name='add' size={18} color={COLORS.ink} /></Pressable>
      </View>
    </View>
  );
}

function BackButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='Go back'
      hitSlop={8}
      style={({ pressed, hovered, focused }) => [
        styles.backButton,
        hovered && styles.backButtonHovered,
        focused && styles.backButtonFocused,
        pressed && styles.pressed,
      ]}
    >
      <Icon name='chevron-back' size={20} color={COLORS.ink} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = createThemedStyles({
  scrollContent: { paddingBottom: 48 },
  content: { maxWidth: LAYOUT.phoneMaxWidth, paddingTop: 12 },
  backButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { ...TYPOGRAPHY.supporting, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  errorState: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: '#FFF7F6' },
  errorText: { flex: 1, ...TYPOGRAPHY.supporting, color: COLORS.error },
  successState: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight },
  successText: { flex: 1, ...TYPOGRAPHY.supporting, color: COLORS.body },
  waterIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14, padding: 16, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.sageLight },
  waterIntroIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  waterIntroTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  waterIntroText: { marginTop: 3, ...TYPOGRAPHY.supporting, color: COLORS.body },
  waterCard: { overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.canvas },
  waterHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  waterControls: { gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.hairline, backgroundColor: COLORS.surfaceSoft },
  controlsDisabled: { opacity: 0.5 },
  controlLabel: { ...TYPOGRAPHY.supporting, fontWeight: '700', color: COLORS.ink },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.canvas },
  intervalButtonSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  intervalText: { ...TYPOGRAPHY.supporting, fontWeight: '600', color: COLORS.body },
  intervalTextSelected: { color: COLORS.brand },
  activeHours: { gap: 10 },
  timeControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  timeControlLabel: { ...TYPOGRAPHY.supporting, color: COLORS.body },
  timeControlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactTimeButton: { width: 44, height: 44, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  waterTime: { width: 74, ...TYPOGRAPHY.supporting, fontWeight: '700', color: COLORS.ink, textAlign: 'center', fontVariant: ['tabular-nums'] },
  scheduleSummary: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  otherHeading: { marginBottom: 10, ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.canvas,
  },
  reminderItem: { backgroundColor: COLORS.canvas },
  reminderItemDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  reminderHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  headerPressed: { backgroundColor: COLORS.surfaceSoft },
  headerHovered: { backgroundColor: COLORS.surfaceWarm },
  headerFocused: {
    backgroundColor: COLORS.brandSoft,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1 },
  reminderLabel: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  reminderDesc: { marginTop: 2, ...TYPOGRAPHY.caption, color: COLORS.muted },
  switchTrack: { width: 50, height: 28, justifyContent: 'center', paddingHorizontal: 2, borderRadius: 14, backgroundColor: COLORS.hairline },
  switchTrackActive: { backgroundColor: COLORS.brand },
  switchKnob: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  switchKnobActive: { transform: [{ translateX: 22 }] },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: COLORS.hairline, backgroundColor: COLORS.surfaceSoft },
  timeButton: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.hairline, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  timeButtonHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: {
    borderColor: COLORS.brand,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  timeCopy: { minWidth: 98, alignItems: 'center' },
  timeLabel: { ...TYPOGRAPHY.eyebrow, color: COLORS.muted },
  timeText: { marginTop: 2, fontSize: 20, lineHeight: 25, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4, paddingVertical: 20 },
  noteText: { flex: 1, ...TYPOGRAPHY.supporting, color: COLORS.muted },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 10,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
});
