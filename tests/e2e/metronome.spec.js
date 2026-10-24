import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.metronomeAudio = { clicks: [], contexts: [], nodes: [] };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options) { super(options); window.metronomeAudio.contexts.push(this); }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        const stop = oscillator.stop.bind(oscillator);
        const event = { stops: [] };
        oscillator.start = (time) => {
          Object.assign(event, { time, now: this.currentTime, frequency: oscillator.frequency.value });
          window.metronomeAudio.clicks.push(event);
          return start(time);
        };
        oscillator.stop = (time) => { event.stops.push(time); return stop(time); };
        return oscillator;
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = destination.context.createAnalyser();
        analyser.fftSize = 2048;
        connect.call(this, analyser);
        window.metronomeAudio.analyser = analyser;
      }
      return connect.call(this, destination, ...args);
    };
  });
  await page.goto('/');
});

async function ready(page) {
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
}

test('metronome stays gesture gated, schedules 4/4 on the audio clock, and survives tempo edits without duplicate clicks', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Metronome', exact: true });
  await expect(toggle).toBeHidden();
  expect(await page.evaluate(() => window.metronomeAudio.contexts.length)).toBe(0);
  await ready(page);
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('240');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => window.metronomeAudio.clicks.length)).toBeGreaterThanOrEqual(5);
  const events = await page.evaluate(() => window.metronomeAudio.clicks.slice(0, 5));
  expect(events.map((event) => event.frequency)).toEqual([1320, 880, 880, 880, 1320]);
  for (let index = 1; index < events.length; index += 1) expect(events[index].time - events[index - 1].time).toBeCloseTo(0.25, 3);
  expect(events.every((event) => event.time >= event.now)).toBe(true);
  await expect(page.locator('#metronome-beat-description')).toHaveText(/Beat [1-4] of 4 at 240 BPM/);
  const edited = await page.evaluate(() => window.metronomeAudio.clicks.length);
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('120');
  await expect.poll(() => page.evaluate((offset) => window.metronomeAudio.clicks.length - offset, edited)).toBeGreaterThanOrEqual(4);
  const changed = await page.evaluate((offset) => window.metronomeAudio.clicks.slice(offset), edited);
  expect(changed.at(-1).time - changed.at(-2).time).toBeCloseTo(0.5, 3);
  for (let index = 1; index < changed.length; index += 1) expect(changed[index].time - changed[index - 1].time).toBeGreaterThanOrEqual(0.249);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const stopped = await page.evaluate(() => window.metronomeAudio.clicks.length);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.metronomeAudio.clicks.length)).toBe(stopped);
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('40');
  await toggle.click();
  await expect.poll(() => page.evaluate((offset) => window.metronomeAudio.clicks.length - offset, stopped), { timeout: 6000 }).toBeGreaterThanOrEqual(2);
  const slow = await page.evaluate((offset) => window.metronomeAudio.clicks.slice(offset), stopped);
  expect(slow[1].time - slow[0].time).toBeCloseTo(1.5, 3);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
  expect(await page.evaluate(() => window.metronomeAudio.contexts.length)).toBe(1);
});

test('rapid toggles, stop-all, range, focus, visibility, settings and suspension leave no running click', async ({ page }) => {
  await ready(page);
  const toggle = page.getByRole('button', { name: 'Metronome', exact: true });
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('240');
  for (let cycle = 0; cycle < 4; cycle += 1) { await toggle.click(); await toggle.click(); }
  const interruptions = [
    () => page.getByRole('button', { name: 'Stop all', exact: true }).click(),
    () => page.getByRole('button', { name: 'Higher octave' }).click(),
    () => page.evaluate(() => window.dispatchEvent(new Event('blur'))),
    () => page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    }),
    async () => { await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus(); await page.keyboard.press('Escape'); },
    async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); },
    async () => { await page.getByRole('button', { name: 'Help', exact: true }).click(); await page.getByRole('button', { name: 'Play', exact: true }).click(); },
    () => page.setViewportSize({ width: 568, height: 320 }),
  ];
  for (const interrupt of interruptions) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await interrupt();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const stopped = await page.evaluate(() => window.metronomeAudio.clicks.length);
    await page.waitForTimeout(180);
    expect(await page.evaluate(() => window.metronomeAudio.clicks.length)).toBe(stopped);
  }
  await toggle.click();
  await page.evaluate(() => window.metronomeAudio.contexts[0].suspend());
  await expect(page.getByRole('button', { name: 'Resume sound', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume sound', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.metronomeAudio.contexts.length)).toBe(1);
});

test('mute silences real output while preserving the running beat and reduced motion stays quiet', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Metronome', exact: true });
  await expect(toggle).toBeVisible();
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('240');
  await toggle.click();
  expect(await peak(page, 600)).toBeGreaterThan(0.0001);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(120);
  expect(await peak(page, 600)).toBeLessThan(0.0001);
  const before = await page.evaluate(() => window.metronomeAudio.clicks.length);
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  expect(await peak(page, 600)).toBeGreaterThan(0.0001);
  expect(await page.evaluate(() => window.metronomeAudio.clicks.length)).toBeGreaterThan(before);
  await expect(page.locator('.metronome-beats')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: testInfo.outputPath('settings-metronome.png') });
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
});

async function peak(page, duration) {
  return page.evaluate(async (duration) => {
    const analyser = window.metronomeAudio.analyser;
    const data = new Float32Array(analyser.fftSize);
    const end = performance.now() + duration;
    let peak = 0;
    while (performance.now() < end) {
      analyser.getFloatTimeDomainData(data);
      peak = Math.max(peak, ...data.map(Math.abs));
      await new Promise(requestAnimationFrame);
    }
    return peak;
  }, duration);
}
