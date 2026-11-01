const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadDoctorReport() {
  const filename = path.resolve(__dirname, '../src/services/doctorReport.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false, configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  }).code;
  const moduleValue = { exports: {} };
  new Function('require', 'module', 'exports', transformed)(require, moduleValue, moduleValue.exports);
  return moduleValue.exports;
}

const { buildDoctorReport, doctorReportToText } = loadDoctorReport();
const base = {
  profile: { name: 'Synthetic tester' },
  settings: {}, checkins: [], periods: [], medications: [], meals: [],
};

test('doctor summary includes only in-range unique Strength sessions alongside legacy movements', () => {
  const report = buildDoctorReport({
    ...base,
    movements: [{ id: 'legacy-1', date: '2026-10-12', status: 'completed' }],
    strengthSessions: [
      { id: 'legacy-1', completedAt: '2026-10-12T10:00:00.000Z', sessionMode: 'guided', completionState: 'completed' },
      { id: 'guided-1', completedAt: '2026-10-13T10:00:00.000Z', sessionMode: 'guided', completionState: 'completed' },
      { id: 'guided-1', completedAt: '2026-10-13T10:00:00.000Z', sessionMode: 'guided', completionState: 'completed' },
      { id: 'pose-1', completedAt: '2026-10-14T10:00:00.000Z', sessionMode: 'pose', completionState: 'completed' },
      { id: 'stopped-1', completedAt: '2026-10-15T10:00:00.000Z', sessionMode: 'guided', completionState: 'stopped' },
      { id: 'old-1', completedAt: '2026-09-10T10:00:00.000Z', sessionMode: 'pose', completionState: 'completed' },
      { id: 'invalid-1', completedAt: 'bad-date', sessionMode: 'pose', completionState: 'completed' },
    ],
  }, { startDate: '2026-10-01', endDate: '2026-10-31' });
  assert.deepEqual(report.movement, {
    entries: 4,
    completed: 3,
    partial: 1,
    guidedSessions: 2,
    cameraGuidedSessions: 1,
  });
  assert.match(doctorReportToText(report), /2 timer-paced \(not measured\), 1 camera-guided/);
  assert.equal(report.megIncluded, false);
});

test('doctor summary excludes all lifestyle records when disabled', () => {
  const report = buildDoctorReport({
    ...base,
    strengthSessions: [{ id: 'one', completedAt: '2026-10-14T10:00:00.000Z', sessionMode: 'guided', completionState: 'completed' }],
  }, { includeLifestyle: false });
  assert.equal(report.movement, null);
  assert.equal(report.meals, null);
  assert.equal(report.sleep, null);
  assert.doesNotMatch(doctorReportToText(report), /Strength sessions:/);
});

test('doctor summary retains legacy movement totals without Strength data', () => {
  const report = buildDoctorReport({
    ...base,
    movements: [{ id: 'move', date: '2026-10-15', status: 'partial' }],
  }, { startDate: '2026-10-01', endDate: '2026-10-31' });
  assert.equal(report.movement.entries, 1);
  assert.equal(report.movement.completed, 0);
  assert.equal(report.movement.partial, 1);
  assert.equal(report.movement.guidedSessions, 0);
  assert.equal(report.movement.cameraGuidedSessions, 0);
});
