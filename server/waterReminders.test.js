const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadModule() {
  const filename = path.resolve(__dirname, '../src/services/waterReminders.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === 'react-native') return { Platform: { OS: 'ios' } };
    if (request === './notifications') return { notifications: {} };
    return require(request);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', transformed.code)(
    localRequire,
    moduleValue,
    moduleValue.exports,
    filename,
    path.dirname(filename)
  );
  return moduleValue.exports;
}

function notificationAdapter() {
  const scheduled = [{ identifier: 'cycle-reminder', content: { data: { category: 'cycle' } } }];
  return {
    scheduled,
    scheduleCalls: 0,
    channelCalls: 0,
    async getPermissionStatus() { return { status: 'granted', granted: true, canAskAgain: true }; },
    async requestPermission() { return { status: 'granted', granted: true, canAskAgain: true }; },
    async setupWaterReminderChannel() { this.channelCalls += 1; },
    async getScheduledReminders() { return [...scheduled]; },
    async scheduleDailyReminder(item) {
      this.scheduleCalls += 1;
      const record = { identifier: item.identifier, content: { data: item.data } };
      const index = scheduled.findIndex((entry) => entry.identifier === item.identifier);
      if (index >= 0) scheduled[index] = record;
      else scheduled.push(record);
      return item.identifier;
    },
    async cancelReminder(identifier) {
      const index = scheduled.findIndex((entry) => entry.identifier === identifier);
      if (index >= 0) scheduled.splice(index, 1);
    },
  };
}

const {
  createWaterReminderService,
  generateWaterReminderTimes,
  WATER_REMINDER_DEFAULTS,
} = loadModule();

test('default three-hour water window includes both valid boundaries', () => {
  assert.deepEqual(generateWaterReminderTimes(WATER_REMINDER_DEFAULTS), [
    '08:00', '11:00', '14:00', '17:00', '20:00', '23:00',
  ]);
});

test('two and four-hour intervals stay within active hours', () => {
  assert.deepEqual(generateWaterReminderTimes({ intervalHours: 2, startTime: '08:00', endTime: '23:00' }), [
    '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
  ]);
  assert.deepEqual(generateWaterReminderTimes({ intervalHours: 4, startTime: '09:00', endTime: '17:00' }), [
    '09:00', '13:00', '17:00',
  ]);
  assert.deepEqual(generateWaterReminderTimes({ startTime: '10:00', endTime: '10:00' }), ['10:00']);
  assert.throws(() => generateWaterReminderTimes({ startTime: '18:00', endTime: '08:00' }), /End time/);
});

test('reconciliation prevents duplicates and interval changes rebuild only water reminders', async () => {
  const adapter = notificationAdapter();
  const service = createWaterReminderService(adapter, 'ios');
  const initial = await service.scheduleWaterReminders(WATER_REMINDER_DEFAULTS);
  assert.equal(initial.notificationIds.length, 6);
  assert.equal(adapter.scheduleCalls, 6);

  const unchanged = await service.reconcileWaterReminders(initial);
  assert.deepEqual(unchanged, initial);
  assert.equal(adapter.scheduleCalls, 6);

  const rebuilt = await service.rescheduleWaterReminders({ ...initial, intervalHours: 2 }, initial);
  assert.equal(rebuilt.notificationIds.length, 8);
  assert.equal(adapter.scheduled.filter((item) => item.content.data.category === 'bloom-water-reminders').length, 8);
  assert.ok(adapter.scheduled.some((item) => item.identifier === 'cycle-reminder'));
});

test('disabling cancels only Bloom water reminder identifiers', async () => {
  const adapter = notificationAdapter();
  const service = createWaterReminderService(adapter, 'ios');
  const enabled = await service.scheduleWaterReminders(WATER_REMINDER_DEFAULTS);
  const disabled = await service.rescheduleWaterReminders({ ...enabled, enabled: false }, enabled);

  assert.deepEqual(disabled.notificationIds, []);
  assert.equal(disabled.scheduleSignature, null);
  assert.deepEqual(adapter.scheduled.map((item) => item.identifier), ['cycle-reminder']);
});
