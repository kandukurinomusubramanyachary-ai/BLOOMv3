const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8091';
const output = path.join(__dirname, '..', '.expo', 'diet-review');
const requestedViewport = process.argv.find((argument) => argument.startsWith('--viewport='))?.slice('--viewport='.length);
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: 'desktop', width: 1280, height: 900 },
].filter((viewport) => !requestedViewport || viewport.name === requestedViewport);

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
}

async function openDiet(page) {
  await page.getByRole('tab', { name: 'Diet', exact: true }).click();
  await page.getByText('What do you need right now?', { exact: true }).waitFor();
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await openDiet(page);

      const actions = [
        page.getByRole('button', { name: /Find me something\. Quick, light or satisfying ideas/ }),
        page.getByRole('button', { name: /Craving rescue\. Help me with what I'm craving/ }),
        page.getByRole('button', { name: /My rescue kit\. Foods you've saved for busy days/ }),
      ];
      for (const action of actions) assert.equal(await action.count(), 1, `${viewport.name}: missing or duplicated home action`);
      assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth + 1), true, `${viewport.name}: horizontal overflow`);
      await screenshot(page, `${viewport.name}-home`);

      await actions[0].click();
      await page.getByText('What sounds good right now?', { exact: true }).waitFor();
      for (const label of ['Quick & filling', 'Something light', 'Something sweet', 'Something savoury', 'Not sure']) {
        assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1, `${viewport.name}: missing ${label} food idea choice`);
      }
      await screenshot(page, `${viewport.name}-find-choice`);
      await page.getByRole('button', { name: 'Quick & filling', exact: true }).click();
      await page.getByText('Here are three food ideas', { exact: true }).waitFor();
      const findChoices = page.getByText('Choose this', { exact: true });
      assert.equal(await findChoices.count(), 3, `${viewport.name}: Find me something does not show three choices`);
      const nearbyButtons = page.getByRole('button', { name: /Find .* nearby for delivery/ });
      assert.equal(await nearbyButtons.count(), 3, `${viewport.name}: prepared food ideas do not expose delivery discovery`);
      await nearbyButtons.first().click();
      await page.getByText('Live delivery availability isn’t connected yet.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: /Check on Swiggy/ }).count(), 1, `${viewport.name}: missing Swiggy handoff`);
      assert.equal(await page.getByRole('link', { name: /Check on Zomato/ }).count(), 1, `${viewport.name}: missing Zomato handoff`);
      await screenshot(page, `${viewport.name}-delivery-handoff`);
      await findChoices.first().click();
      await page.getByText('Did that hit the craving?', { exact: true }).waitFor();

      await actions[1].click();
      await page.getByText('What are you craving right now?', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Sweet', exact: true }).click();
      await page.getByText('Here are three gentle options', { exact: true }).waitFor();
      const cravingChoices = page.getByText('Choose this', { exact: true });
      assert.equal(await cravingChoices.count(), 3, `${viewport.name}: Craving rescue does not show three choices`);
      await screenshot(page, `${viewport.name}-craving-results`);
      await cravingChoices.first().click();
      await page.getByText('Did that hit the craving?', { exact: true }).waitFor();

      await actions[2].click();
      const kitHeading = page.getByRole('heading', { name: 'My rescue kit', exact: true });
      await kitHeading.waitFor();
      await screenshot(page, `${viewport.name}-kit`);
      await page.keyboard.press('Escape');
      await kitHeading.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, [], `${viewport.name}: uncaught application errors`);
      console.log(`PASS ${viewport.name}: three distinct Diet actions, results, kit, Escape, overflow, runtime errors`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
