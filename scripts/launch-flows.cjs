// Functional browser faults use synthetic responses, never a real health record.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.BLOOM_TEST_URL || 'http://127.0.0.1:8082';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    let responseStatus = 401;
    const requests = [];
    await context.route('**/api/meg/chat', async (route) => {
      const body = route.request().postDataJSON(); requests.push(body);
      await route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(responseStatus === 200
        ? { message: 'Synthetic launch test reply.', conversationId: body.conversationId, messageId: 'fixture-reply', source: 'meg-v2' }
        : { error: 'INTERNAL_PROVIDER_SECRET_FIXTURE' }) });
    });
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('tab', { name: 'Meg', exact: true }).click();
    await page.getByRole('textbox', { name: 'Message Meg' }).fill('Synthetic launch network fixture');
    await page.getByRole('button', { name: 'Send message to Meg' }).click();
    const retry = page.getByRole('button', { name: 'Try again', exact: true });
    await retry.waitFor();
    for (const status of [429, 503, 500]) {
      responseStatus = status; await retry.click();
      await page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')].some((button) => button.textContent === 'Try again' && button.getAttribute('aria-disabled') !== 'true'));
    }
    assert.equal(requests.length, 4);
    assert.equal(new Set(requests.map((request) => request.messageId)).size, 1, 'Retry must preserve the message ID');
    assert.ok(!await page.getByText('INTERNAL_PROVIDER_SECRET_FIXTURE', { exact: true }).count());
    responseStatus = 200; await retry.click();
    await page.getByText('Synthetic launch test reply.', { exact: true }).waitFor();
    await context.unroute('**/api/meg/chat');
    await context.setOffline(true);
    await page.getByRole('textbox', { name: 'Message Meg' }).fill('Synthetic offline draft');
    await page.getByRole('button', { name: 'Send message to Meg' }).click();
    await retry.waitFor();
    await context.setOffline(false);
    const saved = await page.evaluate(() => localStorage.getItem('@bloom_user:v1:dev-user:bloom_meg_conversations'));
    assert.match(saved, /Synthetic offline draft/);
    assert.match(saved, /failed/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restored = await page.evaluate(() => localStorage.getItem('@bloom_user:v1:dev-user:bloom_meg_conversations'));
    assert.equal(restored, saved, 'Reload must retain the failed-send queue');
    await page.getByRole('button', { name: 'Open your profile', exact: true }).click();
    for (const label of ['Privacy Policy', 'Terms of Use', 'Contact / Support']) {
      await page.getByRole('button', { name: new RegExp(`^${label.replace('/', '\\/')}\\.`) }).click();
      await page.getByText('Beta template · founder and legal review required', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }
    await page.getByRole('button', { name: /^Export your data\./ }).click();
    await page.getByRole('button', { name: /JSON/ }).click();
    await page.getByText(/Export did not finish\. Check your connection/).waitFor();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await page.getByRole('button', { name: 'Log out of Bloom', exact: true }).click();
    await page.getByRole('tab', { name: 'Log in', exact: true }).click();
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByText('Reset your password', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('test@example.test');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement !== document.body), 'Keyboard focus must remain reachable');
    await page.getByRole('button', { name: 'Back to log in', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('PASS synthetic 401/429/500/503, stable retry, success, offline queue/reload, legal routes, export failure, logout and reset navigation');
    await context.close();
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
