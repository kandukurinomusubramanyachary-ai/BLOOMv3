const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stepsSource = fs.readFileSync(path.join(root, 'src/components/productTour/tourSteps.js'), 'utf8');
const overlaySource = fs.readFileSync(path.join(root, 'src/components/productTour/ProductTourOverlay.js'), 'utf8');
const source = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .filter(file => /\.(js|jsx)$/.test(file))
  .map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8'))
  .join('\n');

const guideIds = ['appOverview', 'today', 'checkin', 'timeline', 'meg', 'strengthHome', 'strengthWorkout', 'strengthSummary', 'profile'];
const targetIds = [
  'home-today', 'timeline', 'meg', 'strength', 'profile', 'daily-checkin', 'today-snapshot',
  'timeline-cycle', 'timeline-estimates', 'timeline-history', 'meg-welcome', 'meg-context', 'meg-history',
  'strength-recommendation', 'strength-browse', 'strength-progress', 'strength-workout-progress',
  'strength-guidance', 'strength-reps', 'strength-pause', 'strength-summary-result', 'strength-summary-history',
  'checkin-body', 'checkin-mood', 'checkin-save', 'profile-preferences', 'profile-appearance', 'profile-privacy', 'profile-account',
];

test('every progressive guide has explicit metadata and duration copy', () => {
  for (const id of guideIds) {
    assert.match(stepsSource, new RegExp(`${id}:\\s*\\{`));
    assert.match(stepsSource, new RegExp(`${id}:\\s*\\{[^}]*duration:`, 's'));
  }
  assert.doesNotMatch(overlaySource, /tourId === 'strengthHome'.*Meg/);
});

test('overview remains short and excludes Diet', () => {
  const overview = stepsSource.match(/appOverview:\s*\[([\s\S]*?)\n  \],\n  today:/)?.[1] || '';
  assert.equal((overview.match(/step\(/g) || []).length, 5);
  assert.doesNotMatch(overview, /Diet/i);
});

test('configured spotlight targets are registered or intentionally aliased', () => {
  for (const id of targetIds) assert.match(source, new RegExp(`['"]${id}['"]`), `missing target ${id}`);
});

test('tour engine uses persisted per-user storage and hydration gating', () => {
  const context = fs.readFileSync(path.join(root, 'src/components/productTour/ProductTourContext.js'), 'utf8');
  assert.match(context, /AsyncStorage/);
  assert.match(context, /tourStateReady/);
  assert.match(context, /status: 'skipped'/);
  assert.match(context, /status: 'completed'/);
});
