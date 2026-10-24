import { expect, test } from '@playwright/test';
import { getNoteName } from '../../src/lib/pianoNotes.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.pianoAudio = { starts: [], stops: [], contexts: [] };
    const NativeContext = window.AudioContext;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = destination.context.createAnalyser();
        analyser.fftSize = 2048;
        connect.call(this, analyser);
        window.pianoAudio.analyser = analyser;
      }
      return connect.call(this, destination, ...args);
    };
    window.AudioContext = class extends NativeContext {
      constructor(options) { super(options); window.pianoAudio.contexts.push(this); }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        const stop = source.stop.bind(source);
        source.start = (...args) => {
          if (source.buffer?.duration > 0.2 && !source.loop) {
            window.pianoAudio.starts.push({ when: args[0], now: this.currentTime, rate: source.playbackRate.value });
          }
          return start(...args);
        };
        source.stop = (...args) => {
          if (source.buffer?.duration > 0.2 && !source.loop) window.pianoAudio.stops.push(args[0]);
          return stop(...args);
        };
        return source;
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
});

test('keyboard chords produce a real audio signal without repeat attacks or a 100ms queue', async ({ page }) => {
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await page.keyboard.down('d');
  await page.keyboard.down('g');
  await page.keyboard.down('a');
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'E4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(3);
  expect(await page.evaluate(() => Math.max(...window.pianoAudio.starts.map((event) => event.when - event.now)))).toBeLessThan(0.02);
  await expect.poll(() => page.evaluate(() => {
    const analyser = window.pianoAudio.analyser;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  })).toBeGreaterThan(0.0001);
  await page.keyboard.up('d');
  await expect(page.getByRole('button', { name: 'E4', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Settings', exact: true }).focus();
  await page.keyboard.up('a');
  await page.keyboard.up('g');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
});

test('mouse and keyboard share ownership, glissando uses hit testing, and Escape blocks stale movement', async ({ page }) => {
  const c = page.getByRole('button', { name: 'C4', exact: true });
  const e = page.getByRole('button', { name: 'E4', exact: true });
  const cBox = await c.boundingBox();
  const eBox = await e.boundingBox();
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height * 0.85);
  await page.mouse.down();
  await page.keyboard.up('a');
  await expect(c).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(1);
  expect(await page.evaluate(() => window.pianoAudio.stops.length)).toBe(0);
  await page.mouse.move(eBox.x + eBox.width / 2, eBox.y + eBox.height * 0.85);
  await expect(c).toHaveAttribute('aria-pressed', 'false');
  await expect(e).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height * 0.85);
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.mouse.up();
});

test('sustain, range changes, focus loss and typing guards preserve safe note state', async ({ page }) => {
  await page.getByRole('button', { name: 'Latch sustain' }).click();
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('Space');
  await page.keyboard.press('a');
  expect(await page.evaluate(() => window.pianoAudio.stops.length)).toBe(0);
  await page.keyboard.up('Space');
  await expect(page.getByRole('button', { name: 'Latch sustain' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.down('d');
  await page.getByRole('button', { name: 'Higher octave' }).click();
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Latch sustain' })).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('d');
  const before = await page.evaluate(() => window.pianoAudio.starts.length);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Volume' }).focus();
  await page.keyboard.press('a');
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(before);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.press('Control+a');
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(before);
  await page.keyboard.down('a');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.keyboard.up('a');
  await page.keyboard.down('d');
  const beforeSuspend = await page.evaluate(() => window.pianoAudio.starts.length);
  await page.evaluate(() => window.pianoAudio.contexts[0].suspend());
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume sound' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(beforeSuspend);
  await page.keyboard.up('d');
});

test('every piano pitch dispatches a finite repitched source', async ({ page }, testInfo) => {
  const lower = page.getByRole('button', { name: 'Lower octave' });
  for (let step = 0; step < 8 && await lower.isEnabled(); step += 1) await lower.click();
  for (let midi = 21; midi <= 108; midi += 1) {
    const key = page.getByRole('button', { name: getNoteName(midi), exact: true });
    while (!await key.count()) await page.getByRole('button', { name: 'Higher octave' }).click();
    await key.focus();
    await page.keyboard.press('Enter');
  }
  const starts = await page.evaluate(() => window.pianoAudio.starts);
  expect(starts).toHaveLength(88);
  expect(starts.every((event) => Number.isFinite(event.rate) && event.rate >= 2 ** (-3 / 12) && event.rate <= 2 ** (3 / 12))).toBe(true);
  await testInfo.attach('all-register-dispatch', { body: JSON.stringify(starts), contentType: 'application/json' });
});

test('physical code mapping ignores printed layout, composition and modifier shortcuts', async ({ page }) => {
  const keyboard = page.getByRole('group', { name: 'Piano keyboard', exact: true });
  await keyboard.focus();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    await keyboard.dispatchEvent('keydown', { code: 'KeyA', key: 'a', [modifier]: true });
  }
  await keyboard.dispatchEvent('keydown', { code: 'KeyA', key: 'a', isComposing: true });
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(0);
  await keyboard.dispatchEvent('keydown', { code: 'KeyA', key: 'ش' });
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await keyboard.dispatchEvent('keyup', { code: 'KeyA', key: 'ش' });
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('native emulated touch releases fingers independently and handles same-pitch cancellation', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const points = [];
  for (const [index, name] of ['C4', 'E4', 'G4'].entries()) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    points.push({ id: index + 1, x: box.x + box.width / 2, y: box.y + box.height * 0.85 });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(3);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [points[0]] });
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);

  const samePitch = [{ ...points[0], id: 4, x: points[0].x - 8 }, { ...points[0], id: 5, x: points[0].x + 8 }];
  const before = await page.evaluate(() => window.pianoAudio.starts.length);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: samePitch });
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(before + 1);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [samePitch[0]] });
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
});

test('black-key edges win hits and losing pointer capture releases the owner', async ({ page }) => {
  const black = await page.getByRole('button', { name: 'C#4', exact: true }).boundingBox();
  for (const [x, note] of [[black.x - 1, 'C4'], [black.x + 1, 'C#4'], [black.x + black.width - 1, 'C#4'], [black.x + black.width + 1, 'D4']]) {
    await page.mouse.move(x, black.y + 20);
    await page.mouse.down();
    await expect(page.getByRole('button', { name: note, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(1);
    await page.mouse.up();
  }
  await page.evaluate(() => {
    window.pianoGotCapture = false;
    document.querySelector('.key-viewport').addEventListener('gotpointercapture', () => { window.pianoGotCapture = true; }, { once: true });
    document.querySelector('.key-viewport').addEventListener('pointerdown', (event) => { window.lastPianoPointer = event.pointerId; }, { once: true });
  });
  await page.mouse.move(black.x + 2, black.y + 20);
  await page.mouse.down();
  await page.mouse.move(black.x + 2.5, black.y + 20);
  expect(await page.evaluate(() => window.pianoGotCapture)).toBe(true);
  await page.evaluate(() => document.querySelector('.key-viewport').releasePointerCapture(window.lastPianoPointer));
  await page.mouse.move(black.x + 3, black.y + 20);
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.mouse.up();
});

test('native emulated pen plays once and releases cleanly', async ({ page, context }, testInfo) => {
  const client = await context.newCDPSession(page);
  const box = await page.getByRole('button', { name: 'C4', exact: true }).boundingBox();
  const position = { x: box.x + box.width / 2, y: box.y + box.height * 0.85, pointerType: 'pen', button: 'left', clickCount: 1 };
  await client.send('Input.dispatchMouseEvent', { ...position, type: 'mousePressed', buttons: 1 });
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pianoAudio.starts.length)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('piano-ready.png'), fullPage: true });
  await client.send('Input.dispatchMouseEvent', { ...position, type: 'mouseReleased', buttons: 0 });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
});
