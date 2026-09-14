// Uses a synthetic canvas MediaStream, never a person's webcam. Requires Expo web
// and the local development account. Real WASM smoke + isolated pose fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = process.env.BLOOM_TEST_URL || 'http://localhost:8081';
const output = path.join(__dirname, '..', '.expo', 'strength-review');

async function enter(page, move = 'Bodyweight squat') {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Strength', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${move},`) }).click();
  await page.getByRole('button', { name: '2 sets', exact: true }).click();
  await page.getByRole('button', { name: 'Start · 2 sets', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.cameraRequests), 0, 'no camera request before consent');
}

async function inspect(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const buttons = await page.getByRole('button').all();
  for (const button of buttons) {
    if (!await button.isVisible()) continue;
    const r = await button.boundingBox();
    assert.ok(r.width >= 44 && r.height >= 44, `${name}: small button ${await button.getAttribute('aria-label')}`);
    assert.ok(r.x >= -1 && r.x + r.width <= page.viewportSize().width + 1, `${name}: horizontal overflow`);
  }
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
}

async function contextFor(browser, viewport, mode = 'real') {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 900, reducedMotion: 'reduce' });
  await context.addInitScript(mode => {
    window.cameraRequests = 0; window.cameraTracks = []; window.poseCalls = 0; window.motionAt = null;
    window.cameraErrors = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.cameraRequests++;
      if (mode === 'denied') throw new DOMException('Test permission denied', 'NotAllowedError');
      if (constraints.audio !== false) throw new Error('Strength must not request audio');
      // Canvas capture avoids an intermittent Windows Edge fake-camera device
      // disconnect while exercising the real video, WASM and cleanup pipeline.
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d'); let frame = 0;
      const draw = () => { ctx.fillStyle = '#242328'; ctx.fillRect(0, 0, 640, 480); ctx.fillStyle = '#F7F4F5'; ctx.fillRect(frame++ % 600, 220, 20, 20); };
      draw(); const timer = setInterval(draw, 40); const stream = canvas.captureStream(25);
      for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); stop(); }; }
      window.cameraTracks.push(...stream.getTracks()); return stream;
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return play.call(this).catch(error => { window.cameraErrors.push({ stage: 'play', name: error.name, message: error.message }); throw error; });
    };
    if (mode === 'insecure') Object.defineProperty(window, 'isSecureContext', { value: false });
    if (mode === 'fixture') {
      window.Vision = {
        FilesetResolver: { forVisionTasks: async () => ({}) },
        PoseLandmarker: { createFromOptions: async () => ({
          close() {},
          detectForVideo() {
            window.poseCalls++;
            const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.15, z: 0, visibility: 1, presence: 1 }));
            const coordinates = { 11: [0.4, 0.3], 12: [0.6, 0.3], 23: [0.43, 0.55], 24: [0.57, 0.55], 25: [0.43, 0.72], 26: [0.57, 0.72], 27: [0.43, 0.9], 28: [0.57, 0.9], 31: [0.43, 0.94], 32: [0.57, 0.94] };
            for (const [id, [x, y]] of Object.entries(coordinates)) Object.assign(points[id], { x, y });
            if (window.motionAt !== null && (performance.now() - window.motionAt) % 3400 < 1700) points[27].x = 0.18;
            return { landmarks: [points], close() {} };
          },
        }) },
      };
    }
  }, mode);
  return context;
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BLOOM_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    // First run the actual bundled model through the application's camera flow.
    const real = await contextFor(browser, { width: 390, height: 844 });
    const page = await real.newPage(); page.setDefaultTimeout(45000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await enter(page); await inspect(page, 'phone-consent');
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await page.waitForFunction(() => /Framing · Set 1 of 2|Camera guidance is unavailable/.test(document.body.innerText));
    assert.deepEqual(await page.evaluate(() => window.cameraErrors), []);
    assert.match(await page.locator('body').innerText(), /Framing · Set 1 of 2/, 'real model must reach framing');
    assert.ok(await page.evaluate(() => Boolean(window.Vision?.PoseLandmarker)));
    assert.equal(await page.evaluate(() => document.querySelector('video').srcObject.getTracks()[0].readyState), 'live');
    await inspect(page, 'phone-real-camera');
    await page.getByRole('button', { name: 'Continue guided', exact: true }).click();
    await page.getByRole('button', { name: 'Begin', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')));
    assert.deepEqual(errors, []); await real.close();
    console.log('PASS real MediaPipe model: phone camera startup, framing, guided fallback, camera release');

    for (const [mode, viewport] of [['denied', { width: 320, height: 740 }], ['insecure', { width: 844, height: 390 }]]) {
      const context = await contextFor(browser, viewport, mode); const p = await context.newPage();
      await enter(p); await p.getByRole('button', { name: 'Enable camera', exact: true }).click();
      await p.getByText('Camera guidance is unavailable', { exact: true }).waitFor();
      await inspect(p, `${mode}-recovery`);
      if (mode === 'insecure') {
        assert.match(await p.locator('body').innerText(), /HTTPS/);
        assert.equal(await p.evaluate(() => window.cameraRequests), 0);
      } else {
        await p.getByRole('button', { name: 'Try again', exact: true }).click();
        await p.getByText('Camera guidance is unavailable', { exact: true }).waitFor();
        assert.equal(await p.evaluate(() => window.cameraRequests), 2);
      }
      await p.getByRole('button', { name: 'Continue guided', exact: true }).click();
      await p.getByRole('button', { name: 'Begin', exact: true }).waitFor(); await context.close();
      console.log(`PASS ${mode}: mobile recovery and guided fallback`);
    }

    const context = await contextFor(browser, { width: 390, height: 844 }, 'fixture');
    const p = await context.newPage(); p.setDefaultTimeout(50000);
    await enter(p, 'Standing side-leg raise');
    await p.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await p.getByRole('button', { name: 'Begin set', exact: true }).click();
    await p.getByText('Tracking · Set 1 of 2', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Mute', exact: true }).click();
    await p.evaluate(() => { window.motionAt = performance.now(); });
    await p.getByText('Set 1 of 2 complete', { exact: true }).waitFor();
    await p.evaluate(() => { window.motionAt = null; });
    assert.equal(await p.evaluate(() => window.cameraRequests), 1, 'no camera restart between sets');
    assert.ok(await p.evaluate(() => window.cameraTracks.every(track => track.readyState === 'live')));
    await inspect(p, 'phone-between-sets');
    await p.getByRole('button', { name: 'Continue · set 2', exact: true }).click();
    await p.getByText('Tracking · Set 2 of 2', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Pause', exact: true }).click();
    await p.getByRole('button', { name: 'Resume', exact: true }).click();
    await p.getByRole('button', { name: 'Stop set', exact: true }).click();
    await p.getByText('Session Saved', { exact: true }).waitFor();
    await p.getByText('10', { exact: true }).waitFor();
    assert.ok(await p.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')));
    await inspect(p, 'phone-summary');
    await p.getByRole('button', { name: 'Try again', exact: true }).click();
    await p.getByRole('button', { name: 'Enable camera', exact: true }).waitFor();
    assert.equal(await p.evaluate(() => window.cameraRequests), 1, 'try again waits for camera consent');
    await context.close();
    console.log('PASS synthetic pose fixture: reps, two-set transition, pause/resume, accumulated summary, retry consent');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
