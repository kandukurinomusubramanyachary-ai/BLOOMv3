// Run against a local Expo web preview to guard the Timeline header composition.
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
      await page.getByRole('tab', { name: 'Timeline', exact: true }).click();

      const lockup = page.getByRole('img', { name: 'Bloom', exact: true });
      await lockup.waitFor();
      const lockupBox = await lockup.boundingBox();
      const headerBox = await lockup.evaluate((element) => {
        const bounds = element.parentElement?.getBoundingClientRect();
        return bounds ? { x: bounds.x, width: bounds.width } : null;
      });
      assert.ok(lockupBox, `${viewport.name}: Bloom lockup must be visible`);
      assert.ok(headerBox, `${viewport.name}: Timeline brand header must be visible`);
      assert.ok(
        Math.abs(lockupBox.x + lockupBox.width / 2 - (headerBox.x + headerBox.width / 2)) <= 1,
        `${viewport.name}: Bloom lockup must be centered within its header`
      );
      assert.equal(
        await page.getByRole('button', { name: 'Return to the current month', exact: true }).count(),
        0,
        `${viewport.name}: Timeline must not render a header calendar action`
      );
      await page.getByRole('tab', { name: 'Month', exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Year', exact: true }).waitFor();
      assert.deepEqual(pageErrors, [], `${viewport.name}: uncaught application errors`);

      await page.screenshot({
        path: path.join(output, `timeline-header-${viewport.name}.png`),
        animations: 'disabled',
      });
      console.log(`PASS ${viewport.name}: Timeline has one centered Bloom lockup and no header calendar action`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
