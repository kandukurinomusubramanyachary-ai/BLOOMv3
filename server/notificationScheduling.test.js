const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function fixture(platform) {
  const scheduled = [];
  let handler;
  const api = {
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
    AndroidNotificationPriority: { LOW: 'low', DEFAULT: 'default' },
    setNotificationHandler: value => { handler = value; },
    cancelScheduledNotificationAsync: async () => {},
    scheduleNotificationAsync: async value => { scheduled.push(value); return value.identifier; },
  };
  const code = babel.transformFileSync(path.resolve(__dirname, '../src/services/notifications.js'), {
    babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]],
  }).code;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'expo-notifications') return api;
    if (name === 'react-native') return { Platform: { OS: platform } };
    return require(name);
  }, mod, mod.exports);
  return { service: mod.exports.notifications, scheduled, get handler() { return handler; } };
}

test('daily and weekly reminders use the typed native scheduling API on Android and iOS', async () => {
  for (const platform of ['android', 'ios']) {
    const f = fixture(platform);
    await f.service.scheduleReminder('daily', 'Daily', 'Body', 9, 30);
    await f.service.scheduleReminder('weekly', 'Weekly', 'Body', 10, 15, true, 2);
    await f.service.scheduleDailyReminder({ identifier: 'water', title: 'Water', body: '', hour: 11, minute: 0, channelId: 'water' });
    assert.deepEqual(f.scheduled.map(item => item.trigger.type), ['daily', 'weekly', 'daily']);
    assert.equal(f.scheduled[1].trigger.weekday, 2);
    assert.equal(f.scheduled[0].trigger.channelId, platform === 'android' ? 'bloom-reminders' : undefined);
    const behavior = await f.handler.handleNotification();
    assert.equal(behavior.shouldShowBanner, true);
    assert.equal(behavior.shouldShowList, true);
    assert.equal(behavior.shouldPlaySound, false);
  }
});

test('one-time reminders use a future date and invalid reminder times are rejected', async () => {
  const f = fixture('ios');
  await f.service.scheduleReminder('once', 'Once', 'Body', 0, 0, false);
  assert.equal(f.scheduled[0].trigger.type, 'date');
  assert.ok(f.scheduled[0].trigger.date.getTime() > Date.now());
  await assert.rejects(f.service.scheduleDailyReminder({ hour: 25, minute: 0 }), /invalid/);
});
