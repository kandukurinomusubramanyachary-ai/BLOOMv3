const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8086';
const output = path.join(__dirname, '..', '.expo', 'ui-review');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    await page.getByRole('tab', { name: 'Strength', exact: true }).click();
    const strengthTitle = page.getByRole('heading', { name: 'Strength', exact: true });
    await strengthTitle.waitFor();
    const strengthHeader = await strengthTitle.evaluate((title) => {
      const row = title.parentElement;
      const icon = row?.firstElementChild;
      const titleBox = title.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();
      return {
        childCount: row?.children.length,
        gap: iconBox ? titleBox.left - iconBox.right : null,
        headerChildCount: row?.parentElement?.parentElement?.children.length,
      };
    });
    assert.equal(strengthHeader.childCount, 2, 'Strength icon and title must share one inline group');
    assert.ok(strengthHeader.gap >= 0 && strengthHeader.gap <= 12, 'Strength icon must sit beside its title');
    assert.equal(strengthHeader.headerChildCount, 1, 'Strength header must not retain a far-right action slot');
    await page.screenshot({ path: path.join(output, 'strength-header.png'), animations: 'disabled' });

    await page.getByRole('tab', { name: 'Diet', exact: true }).click();
    await page.getByRole('heading', { name: 'Diet', exact: true }).waitFor();
    await page.getByText('Food that fits today.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open your profile', exact: true }).count(), 0, 'Diet must not render a profile action');
    await page.screenshot({ path: path.join(output, 'diet-header.png'), animations: 'disabled' });

    assert.deepEqual(pageErrors, [], 'Header verification must not produce uncaught errors');
    console.log('PASS Strength and Diet header verification');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
