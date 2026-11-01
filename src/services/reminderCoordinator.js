import { Platform } from 'react-native';
import { notifications } from './notifications';
import { waterReminderService } from './waterReminders';
const { createReminderCoordinator } = require('./reminderCoordinatorCore');
export const reminderCoordinator = createReminderCoordinator({adapter:notifications,water:waterReminderService,platform:Platform.OS});
