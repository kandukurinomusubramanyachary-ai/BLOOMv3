// Synthetic local-account QA; never uses a person's webcam or health records.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = process.env.BLOOM_TEST_URL || 'http://127.0.0.1:8085';
const output = path.join(__dirname, '..', '.impeccable', 'review');
const historyKey = '@bloom_user:v1:dev-user:bloom_strength_sessions_v1';

async function inspect(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const element of document.querySelectorAll('div')) {
      if (element.scrollHeight > element.clientHeight && /auto|scroll/.test(getComputedStyle(element).overflowY)) element.scrollTop = 0;
    }
  });
  const issues = await page.evaluate(() => {
    const errors = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('root horizontal overflow');
    for (const el of document.querySelectorAll('[role="button"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      if (r.width < 44 || r.height < 44) errors.push('small control: ' + el.getAttribute('aria-label'));
    }
    return errors;
  });
  assert.deepEqual(issues, [], name);
  await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
}
async function boot(browser, viewport, theme = 'light', mode = 'denied') {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(({ theme, mode }) => {
    localStorage.setItem('@bloom_user:v1:dev-user:bloom_settings', JSON.stringify({ theme }));
    window.cameraRequests = 0; window.cameraTracks = []; window.motionAt = null;
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.cameraRequests++;
      if (mode === 'denied') throw new DOMException('Synthetic denial', 'NotAllowedError');
      if (constraints.audio !== false) throw new Error('Audio requested');
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const draw = () => { ctx.fillStyle = '#302923'; ctx.fillRect(0, 0, 640, 480); ctx.fillStyle = '#DDD0C4'; ctx.font = '22px sans-serif'; ctx.fillText('Synthetic camera test', 190, 240); };
      draw(); const interval = setInterval(draw, 40); const stream = canvas.captureStream(25);
      stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { clearInterval(interval); stop(); }; });
      window.cameraTracks.push(...stream.getTracks()); return stream;
    };
    if (mode === 'fixture') window.Vision = {
      FilesetResolver: { forVisionTasks: async () => ({}) },
      PoseLandmarker: { createFromOptions: async () => ({ close() {}, detectForVideo() {
        const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.15, z: 0, visibility: 1, presence: 1 }));
        const coordinates = { 11: [0.4, 0.3], 12: [0.6, 0.3], 23: [0.43, 0.55], 24: [0.57, 0.55], 25: [0.43, 0.72], 26: [0.57, 0.72], 27: [0.43, 0.9], 28: [0.57, 0.9], 31: [0.43, 0.94], 32: [0.57, 0.94] };
        for (const [id, [x, y]] of Object.entries(coordinates)) Object.assign(points[id], { x, y });
        if (window.motionAt !== null && (performance.now() - window.motionAt) % 3400 < 1700) points[27].x = 0.18;
        return { landmarks: [points], close() {} };
      } }) },
    };
  }, { theme, mode });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.getByRole('tab', { name: 'Strength', exact: true }).click();
  await page.getByText('Ready to move?', { exact: true }).waitFor();
  return { context, page, errors };
}
async function pickMove(page, name) {
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Single movements', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + name + ',') }).click();
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const item of [
      { name: 'mobile', width: 375, height: 812, theme: 'light' },
      { name: 'phone390', width: 390, height: 844, theme: 'light' },
      { name: 'phone430-dark', width: 430, height: 932, theme: 'dark' },
      { name: 'desktop', width: 1280, height: 900, theme: 'light' },
    ]) {
      const { context, page, errors } = await boot(browser, { width: item.width, height: item.height }, item.theme);
      await inspect(page, item.name);
      await page.getByRole('button', { name: 'View today’s workout', exact: true }).click();
      await inspect(page, item.name + '-overview');
      await page.getByRole('button', { name: /^Bodyweight squat,/ }).click();
      await page.getByRole('button', { name: '1 sets', exact: true }).click();
      await inspect(page, item.name + '-movement');
      await page.getByRole('button', { name: 'Back to workout', exact: true }).click();
      assert.match(await page.locator('body').innerText(), /1 sets/);
      await page.getByRole('button', { name: 'Start workout', exact: true }).click();
      assert.equal(await page.evaluate(() => window.cameraRequests), 0);
      assert.equal(await page.getByRole('tab', { name: 'Strength', exact: true }).count(), 0, 'session hides distracting app navigation');
      await inspect(page, item.name + '-consent');
      await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
      await page.getByText('Camera guidance is unavailable.', { exact: true }).waitFor();
      await inspect(page, item.name + '-camera-error');
      await page.getByRole('button', { name: 'Continue guided', exact: true }).click();
      await page.getByTestId('strength-begin').waitFor();
      await inspect(page, item.name + '-guided-prep');
      if (item.name === 'phone390') {
        await page.clock.install();
        await page.getByTestId('strength-begin').click();
        await page.clock.runFor(3300);
        await inspect(page, 'phone390-active');
        await page.getByTestId('strength-pause').click();
        await inspect(page, 'phone390-paused');
        await page.getByTestId('strength-resume').click();
        await page.evaluate(() => {
          window.failHistory = true;
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (window.failHistory && key.endsWith('bloom_strength_sessions_v1')) throw new DOMException('Synthetic storage full', 'QuotaExceededError');
            return set.call(this, key, value);
          };
        });
        await page.clock.runFor(41000);
        await page.getByTestId('strength-retry-save').waitFor();
        await inspect(page, 'phone390-save-error');
        assert.equal(await page.getByTestId('strength-done').isDisabled(), true);
        await page.evaluate(() => { window.failHistory = false; });
        await page.getByTestId('strength-retry-save').click();
        await page.getByRole('button', { name: 'Next exercise', exact: true }).waitFor();
        await inspect(page, 'phone390-completion');
        await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
        await inspect(page, 'phone390-transition');
        await page.getByRole('button', { name: 'Finish here', exact: true }).click();
        await inspect(page, 'phone390-workout-finished');
        await page.getByRole('button', { name: 'View progress', exact: true }).click();
        await inspect(page, 'phone390-progress');
        assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, historyKey), 1, 'retry does not duplicate history');
        await page.reload(); await page.getByRole('tab', { name: 'Strength', exact: true }).click();
        await page.getByRole('button', { name: 'View Bodyweight squat session', exact: true }).click();
        await inspect(page, 'phone390-history');
      }
      assert.deepEqual(errors, [], item.name + ': browser exceptions');
      await context.close(); console.log('PASS responsive flow ' + item.name);
    }
    const guided = await boot(browser, { width: 390, height: 844 });
    await pickMove(guided.page, 'Calf raise');
    await guided.page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await guided.page.clock.install(); await guided.page.getByTestId('strength-begin').click();
    await guided.page.clock.runFor(49000);
    await guided.page.getByTestId('strength-add-rest').waitFor();
    await guided.page.getByTestId('strength-add-rest').click();
    await inspect(guided.page, 'phone390-guided-rest');
    await guided.page.getByTestId('strength-skip-rest').click();
    await guided.page.getByTestId('strength-pause').click();
    await guided.page.getByRole('button', { name: 'End exercise', exact: true }).click();
    await inspect(guided.page, 'phone390-exit-confirmation');
    assert.deepEqual(guided.errors, []); await guided.context.close();
    console.log('PASS guided rest extension, skip and confirmed exit');

    const tracked = await boot(browser, { width: 390, height: 844 }, 'light', 'fixture');
    const p = tracked.page;
    await pickMove(p, 'Standing side-leg raise');
    await p.getByRole('button', { name: 'Start workout', exact: true }).click();
    await p.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await p.getByRole('button', { name: 'Start exercise', exact: true }).waitFor();
    await inspect(p, 'phone390-camera-ready');
    await p.getByRole('button', { name: 'Start exercise', exact: true }).click();
    await p.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    await inspect(p, 'phone390-camera-active');
    await p.evaluate(() => { window.motionAt = performance.now(); });
    await p.getByText('Nice work. Catch your breath.', { exact: true }).waitFor();
    await p.evaluate(() => { window.motionAt = null; });
    await p.getByRole('button', { name: 'Add 15 seconds', exact: true }).click();
    await inspect(p, 'phone390-camera-rest');
    assert.equal(await p.evaluate(() => window.cameraRequests), 1);
    assert.ok(await p.evaluate(() => window.cameraTracks.every(track => track.readyState === 'live')));
    await p.getByRole('button', { name: 'Finish and save', exact: true }).click();
    await p.getByTestId('strength-done').waitFor();
    await p.getByText('Saved on this device.', { exact: false }).first().waitFor();
    await inspect(p, 'phone390-camera-summary');
    assert.ok(await p.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')));
    assert.deepEqual(tracked.errors, []); await tracked.context.close();
    console.log('PASS camera consent, fixture reps, persistent rest camera, save and release');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
