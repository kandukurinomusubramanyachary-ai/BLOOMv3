import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let notificationHandlerConfigured = false;

export function configureNotificationHandler() {
  if (notificationHandlerConfigured) return true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
    return true;
  } catch {
    return false;
  }
}

class NotificationService {
  async getPermissionStatus() {
    configureNotificationHandler();
    const permission = await Notifications.getPermissionsAsync();
    return {
      status: permission.status,
      granted: permission.granted === true || permission.status === 'granted',
      canAskAgain: permission.canAskAgain !== false,
    };
  }

  async requestPermission() {
    configureNotificationHandler();
    const existing = await this.getPermissionStatus();
    if (existing.granted || !existing.canAskAgain) return existing;
    const permission = await Notifications.requestPermissionsAsync();
    return {
      status: permission.status,
      granted: permission.granted === true || permission.status === 'granted',
      canAskAgain: permission.canAskAgain !== false,
    };
  }

  async requestPermissions() {
    return (await this.requestPermission()).granted;
  }

  async scheduleReminder(identifier, title, body, hour, minute, repeats = true, weekday = null) {
    configureNotificationHandler();
    await this.cancelReminder(identifier);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23
      || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('Reminder time is invalid.');
    }

    const trigger = Number.isInteger(weekday) && weekday >= 1 && weekday <= 7
      ? { weekday, hour, minute, repeats: true }
      : { hour, minute, repeats };
    
    if (Platform.OS === 'android') {
      trigger.channelId = 'bloom-reminders';
    }
    
    const content = {
      title,
      body,
      sound: false,
      ...(Platform.OS === 'android'
        ? { priority: Notifications.AndroidNotificationPriority.LOW }
        : {}),
    };

    return Notifications.scheduleNotificationAsync({
      content: {
        ...content,
      },
      trigger,
      identifier,
    });
  }

  async cancelReminder(identifier) {
    configureNotificationHandler();
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  async cancelAllReminders() {
    configureNotificationHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getScheduledReminders() {
    configureNotificationHandler();
    return Notifications.getAllScheduledNotificationsAsync();
  }

  async scheduleDailyReminder({ identifier, title, body, hour, minute, channelId, data }) {
    configureNotificationHandler();
    const trigger = { hour, minute, repeats: true };
    if (Platform.OS === 'android' && channelId) trigger.channelId = channelId;
    return Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data,
        sound: false,
        ...(Platform.OS === 'android'
          ? { priority: Notifications.AndroidNotificationPriority.DEFAULT }
          : {}),
      },
      trigger,
    });
  }

  async setupAndroidChannel() {
    configureNotificationHandler();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bloom-reminders', {
        name: 'Bloom Reminders',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 0, 0, 0],
        lightColor: '#C0755A',
        sound: null,
        enableVibrate: false,
      });
    }
  }

  async setupWaterReminderChannel() {
    configureNotificationHandler();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bloom-water-reminders', {
        name: 'Water reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
        vibrationPattern: [0],
        lightColor: '#C0755A',
      });
    }
  }
}

export const notifications = new NotificationService();
