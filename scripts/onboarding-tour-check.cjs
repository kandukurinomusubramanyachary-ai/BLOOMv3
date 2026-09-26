const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8091';
const output = path.join(__dirname, '..', '.expo', 'onboarding-review');
const tourOnly = process.argv.includes('--tour-only');
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
}

async function enterOnboarding(page) {
  await page.getByRole('button', { name: 'Open your profile', exact: true }).click();
  await page.getByText('Onboarding V3 Preview', { exact: true }).click();
  await page.getByText('Welcome to Bloom', { exact: true }).waitFor();
}

async function completeOnboarding(page, name) {
  await screenshot(page, `${name}-welcome`);
  await page.getByRole('button', { name: 'Get started with Bloom' }).click();
  const nameInput = page.getByRole('textbox', { name: 'What should Bloom call you?' });
  await nameInput.fill('Maya');
  await page.getByRole('button', { name: 'Continue to next question' }).click();
  await page.getByRole('checkbox', { name: 'I want to understand my symptoms' }).click();
  await page.getByRole('button', { name: 'Continue to cycle context' }).click();
  await page.getByRole('button', { name: 'Very irregular' }).click();
  await page.getByRole('radio', { name: '39 – 55 days' }).click();
  await page.getByRole('button', { name: 'Continue to symptoms question' }).click();
  await page.getByRole('checkbox', { name: 'Fatigue / low stamina' }).click();
  await page.getByRole('button', { name: 'Continue to emotional state question' }).click();
  await page.getByRole('button', { name: 'A little overwhelmed' }).click();
  await page.getByRole('button', { name: 'Continue to energy question' }).click();
  await page.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Continue to priorities question' }).click();
  await page.getByRole('button', { name: 'Manage & reduce symptoms' }).click();
  await page.getByRole('button', { name: 'Complete onboarding questions and view summary' }).click();
  await page.getByText('Bloom is ready for you, Maya.', { exact: true }).waitFor({ timeout: 10000 });
  const cta = page.getByRole('button', { name: /Start 30-sec check-in\./ });
  const box = await cta.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, `${name}: result CTA is below the first viewport`);
  await screenshot(page, `${name}-result`);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    for (const viewport of tourOnly ? [] : viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByRole('tab', { name: 'Today', exact: true }).waitFor();
      await enterOnboarding(page);
      await completeOnboarding(page, viewport.name);
      assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth + 1), true, `${viewport.name}: horizontal overflow`);
      assert.deepEqual(errors, [], `${viewport.name}: uncaught application errors`);
      console.log(`PASS ${viewport.name}: welcome, full flow, result CTA visibility, overflow, runtime errors`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await enterOnboarding(page);
    await completeOnboarding(page, 'tour');
    await page.getByRole('button', { name: 'Continue to Bloom home' }).click();
    await page.getByText('Want a quick tour of Bloom?', { exact: true }).waitFor();
    await screenshot(page, 'tour-invitation');
    await page.getByRole('button', { name: 'Show me around' }).click();
    await page.getByText('Your day starts here', { exact: true }).waitFor();
    await screenshot(page, 'tour-step-today');
    for (let index = 0; index < 5; index += 1) {
      const next = page.getByRole('button', { name: index === 4 ? 'Finish tour' : 'Next' });
      if (await next.count()) await next.click();
    }
    await page.getByRole('button', { name: 'Explore Bloom' }).click();
    await page.getByRole('button', { name: 'Open your profile', exact: true }).click();
    await page.getByText('Learn Bloom', { exact: true }).last().click();
    await page.getByText('Short, optional guides for the places that matter. Replay anything whenever you want.', { exact: true }).waitFor();
    await screenshot(page, 'learn-bloom');
    console.log('PASS product tour invitation, overview, completion, and Learn Bloom');

    await page.getByRole('button', { name: /Strength basics\. .*Replay guide/ }).click();
    await page.getByText('Your workout starts here', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Choose what fits today', { exact: true }).waitFor();
    await screenshot(page, 'strength-home-guide-browse');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Your progress stays here', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Finish tour' }).click();
    await page.getByRole('button', { name: 'Explore Bloom' }).click();
    console.log('PASS Strength home guide uses three visible, distinct targets');

    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'Open your profile', exact: true }).click();
    await page.getByText('Learn Bloom', { exact: true }).last().click();
    await page.getByRole('button', { name: /First workout\. .*Replay guide/ }).click();
    const workoutHint = page.getByText('Choose a workout. The guide will begin when the real player is ready.', { exact: true }).filter({ visible: true });
    await workoutHint.waitFor();
    assert.equal(await workoutHint.isVisible(), true, 'First workout replay does not explain how to reach the real player');
    await screenshot(page, 'strength-workout-guide-pending');
    await page.getByRole('button', { name: /View today.s workout/ }).click();
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByText('One movement at a time', { exact: true }).waitFor();
    await screenshot(page, 'strength-workout-guide-active');
    console.log('PASS context-dependent Strength guide waits for the real player target');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
