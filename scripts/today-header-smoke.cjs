// Run against a local Expo web preview to guard the Today header composition.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8086';
const output = path.join(__dirname, '..', '.expo', 'ui-review');
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge',
    headless: true,
  });

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.getByRole('tab', { name: 'Today', exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Today', exact: true }).click();

      const profile = page.getByRole('button', { name: 'Open your profile', exact: true });
      await profile.waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Open calendar timeline', exact: true }).count(),
        0,
        `${viewport.name}: Today must not render the calendar shortcut`
      );

      const profileBox = await profile.boundingBox();
      const bloomBox = await page.getByRole('img', { name: 'Bloom', exact: true }).boundingBox();
      assert.ok(profileBox && bloomBox, `${viewport.name}: Today header controls must be visible`);
      assert.ok(profileBox.x + profileBox.width / 2 > viewport.width / 2, `${viewport.name}: profile must remain right-aligned`);
      assert.ok(profileBox.width >= 44 && profileBox.height >= 44, `${viewport.name}: profile touch target is too small`);
      assert.deepEqual(pageErrors, [], `${viewport.name}: uncaught application errors`);

      await page.screenshot({
        path: path.join(output, `today-header-${viewport.name}.png`),
        animations: 'disabled',
      });
      console.log(`PASS ${viewport.name}: Today shows Bloom and a right-aligned profile action only`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
