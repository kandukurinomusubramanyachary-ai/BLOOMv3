// Local UI regression: fresh browser contexts with synthetic dev-account data.
// Run Expo first, then: node scripts/ui-smoke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8081';
const output = path.join(__dirname, '..', '.expo', 'ui-review');
const cases = [
  { name: 'small-phone', width: 320, height: 740, theme: 'light' },
  { name: 'phone', width: 390, height: 844, theme: 'light' },
  { name: 'phone-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'tablet', width: 768, height: 1024, theme: 'light' },
  { name: 'desktop', width: 1280, height: 900, theme: 'light' },
];

async function checkLayout(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => {
    const root = document.getElementById('root');
    const tabs = [...document.querySelectorAll('[role="tab"][aria-label]')].filter(el => el.getBoundingClientRect().width);
    return {
      rootWidth: root.getBoundingClientRect().width,
      rootHeight: root.getBoundingClientRect().height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      tabs: tabs.map(el => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    };
  });
  assert.ok(layout.rootWidth <= layout.viewportWidth + 1, `${name}: root overflows horizontally`);
  assert.ok(layout.rootHeight <= layout.viewportHeight + 1, `${name}: root exceeds visible height`);
  for (const tab of layout.tabs) {
    assert.ok(tab.width >= 44 && tab.height >= 44, `${name}: small tab ${tab.label}`);
    assert.ok(tab.x >= -1 && tab.y >= -1 && tab.x + tab.width <= layout.viewportWidth + 1 && tab.y + tab.height <= layout.viewportHeight + 1, `${name}: clipped tab ${tab.label}`);
  }
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled', timeout: 15000 });
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const selectedCases = process.argv.includes('--meg') ? cases.filter(item => item.name === 'phone') : cases;
    for (const item of selectedCases) {
      const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('@bloom_user:v1:dev-user:bloom_settings', JSON.stringify({ theme }));
      }, item.theme);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.getByRole('tab', { name: 'Today', exact: true }).waitFor();
      for (const screen of ['Today', 'Timeline', 'Meg', 'Strength', 'Diet']) {
        const tab = page.getByRole('tab', { name: screen, exact: true });
        if (!await tab.count() && screen === 'Strength') continue;
        await tab.click();
        await checkLayout(page, `${item.name}-${screen.toLowerCase()}`);
      }
      await page.getByRole('button', { name: 'Quick & filling', exact: true }).click();
      await checkLayout(page, `${item.name}-food-sheet`);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Open your profile', exact: true }).click();
      await checkLayout(page, `${item.name}-profile`);
      if (item.name === 'phone' || item.name === 'small-phone') {
        await page.getByRole('button', { name: /^Personalisation\./ }).click();
        await page.getByRole('textbox', { name: 'Preferred name', exact: true }).fill('A longer preferred name');
        await checkLayout(page, `${item.name}-preferences`);
        await page.getByRole('button', { name: 'Go back', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Back to Bloom', exact: true }).click();
      if (item.name === 'phone' && process.argv.includes('--meg')) {
        await page.getByRole('tab', { name: 'Meg', exact: true }).click();
        await page.getByRole('textbox', { name: 'Message Meg', exact: true }).fill('Hello. Please greet me in one short sentence.');
        const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/meg/chat') && response.request().method() === 'POST', { timeout: 100000 });
        await page.getByRole('button', { name: 'Send message to Meg', exact: true }).click();
        const response = await responsePromise;
        assert.equal(response.status(), 200, 'Meg chat HTTP response');
        const reply = await response.json();
        assert.ok(reply.message?.trim(), 'Meg response must contain text');
        assert.doesNotMatch(reply.message, /trouble reaching|unavailable|lost the connection/i, 'Meg must return a model response');
        console.log('PASS Meg: actual UI send returned a model response');
      }
      if (item.name === 'phone' || item.name === 'small-phone') {
        await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
        await page.getByRole('tab', { name: 'Year', exact: true }).click();
        await checkLayout(page, `${item.name}-year-calendar`);
        await page.getByRole('tab', { name: 'Today', exact: true }).click();
        await page.getByRole('button', { name: 'Start 30-sec check-in', exact: true }).click();
        await page.getByRole('radio', { name: 'Calm', exact: true }).click();
        await checkLayout(page, `${item.name}-checkin`);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await checkLayout(page, `${item.name}-checkin-step2`);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await checkLayout(page, `${item.name}-checkin-review`);
      }
      assert.deepEqual(errors, [], `${item.name}: uncaught application errors`);
      console.log(`PASS ${item.name}: navigation, sheet, profile/back, viewport, touch targets${item.name === 'phone' || item.name === 'small-phone' ? ', preferences, year calendar, check-in steps' : ''}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
