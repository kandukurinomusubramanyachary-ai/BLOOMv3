const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const accountWork = require('../src/services/accountWork');

function load(relative, mocks) {
  const filename = path.resolve(__dirname, '../src', relative);
  const code = babel.transformFileSync(filename, {
    babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]],
  }).code;
  const moduleValue = { exports: {} };
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('../components/')) return name;
    return name.startsWith('.') ? require(path.resolve(path.dirname(filename), name)) : require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, moduleValue, moduleValue.exports);
  return moduleValue.exports;
}

test('JSON file includes saved Strength history alongside the existing account records', async () => {
  const { exportService } = load('services/export.js', {
    'expo-file-system/legacy': {}, 'expo-sharing': {}, 'react-native': { Platform: { OS: 'web' } },
    './doctorReport': { doctorReportToText: () => '' },
  });
  let file;
  exportService.saveAndShare = async (name, content, mime) => { file = { name, data: JSON.parse(content), mime }; };
  await exportService.exportToJSON({ strengthSessions: [{ id: 'saved', reps: 16 }], checkins: [{ date: '2026-09-20' }], megV2Data: { conversations: [] } });
  assert.deepEqual(file.data.STRENGTH_SESSIONS, [{ id: 'saved', reps: 16 }]);
  assert.equal(file.data.CHECKINS[0].date, '2026-09-20');
  assert.deepEqual(file.data.MEG_V2, { conversations: [] });
  assert.equal(file.mime, 'application/json');
});

test('a pending JSON export cannot share the previous account after sign-out', async t => {
  const uid = 'export-account';
  let release;
  const response = new Promise(resolve => { release = resolve; });
  let files = 0;
  const Component = load('screens/ExportDataScreen.js', {
    react: React,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Platform: { select: value => value.web } },
    '../context/AppContext': { useApp: () => ({ state: { checkins: [], periods: [], bookmarks: [] } }) },
    '../context/AuthContext': { useAuth: () => ({ user: { uid } }) },
    '../utils/constants': { COLORS: {}, LAYOUT: {}, TYPOGRAPHY: {}, WEB_FOCUS: {}, createThemedStyles: value => value },
    '../services/megAccountData': { requestMegAccountData: () => response },
    '../services/storage': { storage: { forUser: selectedUid => {
      assert.equal(selectedUid, uid); return { getStrengthSessions: async () => [{ id: 'private' }] };
    } } },
    '../services/export': { exportService: { exportToJSON: async () => { files++; } } },
  }).default;
  let renderer;
  act(() => { renderer = create(React.createElement(Component, { navigation: {} })); });
  t.after(() => act(() => renderer.unmount()));
  const button = renderer.root.findAllByType('Pressable').find(item => item.props.accessibilityLabel === 'Export as JSON');
  let exporting;
  act(() => { exporting = button.props.onPress(); });
  accountWork.invalidate(uid);
  await act(async () => { release({ conversations: [] }); await exporting; });
  assert.equal(files, 0);
  assert.match(renderer.root.findAllByType('Text').find(item => item.props.accessibilityRole === 'alert').props.children, /Export did not finish/);
});
