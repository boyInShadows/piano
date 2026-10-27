import { expect, test } from '@playwright/test';

test.describe('mobile audio unlock', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 838, height: 286 } });

  test('a completed touch retries a pending audio unlock without playing a released note', async ({ page }) => {
    await page.addInitScript(() => {
      const NativeContext = window.AudioContext;
      let completedTouch = false;
      window.addEventListener('pointerup', () => { completedTouch = true; }, true);
      window.AudioContext = class extends NativeContext {
        resume() {
          if (completedTouch) return super.resume();
          return new Promise((resolve, reject) => {
            this.addEventListener('statechange', () => {
              if (this.state === 'running') resolve();
            });
            super.suspend().catch(reject);
          });
        }
      };
    });
    await page.goto('/');
    const key = page.getByRole('button', { name: 'C4', exact: true });
    await expect(key).toBeVisible();
    const bounds = await key.boundingBox();
    const touch = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.85 };
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await expect(page.getByRole('progressbar', { name: 'Piano samples loaded' })).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
    expect(await page.evaluate(() => window.pianoStarts)).toBe(0);
    await expect(key).toHaveAttribute('aria-pressed', 'false');
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.pianoStarts)).toBe(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(key).toHaveAttribute('aria-pressed', 'false');
  });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.pianoStarts = 0;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.duration > 0.2 && !this.loop) window.pianoStarts++;
      return original.apply(this, args);
    };
  });
});

test('a held first piano key starts sound without a separate enable action', async ({ page }) => {
  await page.goto('/');
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await expect(key).toBeEnabled();
  const bounds = await key.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.85);
  await page.mouse.down();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pianoStarts)).toBe(1);
  await page.mouse.up();
  await expect(key).toHaveAttribute('aria-pressed', 'false');
});

test('a key released while samples load cannot play later', async ({ page }) => {
  let releaseSamples;
  const samplesHeld = new Promise((resolve) => { releaseSamples = resolve; });
  await page.route('**/audio/piano/**/*.mp3', async (route) => { await samplesHeld; await route.continue(); });
  await page.goto('/');
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await expect(key).toBeEnabled();
  const bounds = await key.boundingBox();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.85);
  await expect(page.getByRole('progressbar', { name: 'Piano samples loaded' })).toBeVisible();
  releaseSamples();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.pianoStarts)).toBe(0);
});

test('the first keyboard shortcut activates and plays while held', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.key-surface')).toBeVisible();
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('a');
  await expect(key).toHaveAttribute('aria-pressed', 'false');
});

test('reobserving an unchanged keyboard width preserves the first held note', async ({ page }) => {
  // The fixture needs an octave-count change to recreate the resize observer.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver;
    let keyboardMeasurements = 0;
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback) {
        super((entries, observer) => {
          if (entries.some((entry) => entry.target.classList.contains('key-viewport')) && ++keyboardMeasurements > 1) {
            window.repeatKeyboardMeasurement = () => callback(entries, observer);
          } else callback(entries, observer);
        });
      }
    };
  });
  let releaseSamples;
  const samplesHeld = new Promise((resolve) => { releaseSamples = resolve; });
  await page.route('**/audio/piano/**/*.mp3', async (route) => { await samplesHeld; await route.continue(); });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.repeatKeyboardMeasurement === 'function');
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await expect(page.getByRole('progressbar', { name: 'Piano samples loaded' })).toBeVisible();
  await page.evaluate(() => window.repeatKeyboardMeasurement());
  releaseSamples();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pianoStarts)).toBe(1);
  await page.keyboard.up('a');
  await expect(key).toHaveAttribute('aria-pressed', 'false');
});

test('a first drag can leave during loading and reenter after sound is ready', async ({ page }) => {
  let releaseSamples;
  const samplesHeld = new Promise((resolve) => { releaseSamples = resolve; });
  await page.route('**/audio/piano/**/*.mp3', async (route) => { await samplesHeld; await route.continue(); });
  await page.goto('/');
  const first = await page.getByRole('button', { name: 'C4', exact: true }).boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height * 0.85);
  await page.mouse.down();
  await expect(page.getByRole('progressbar', { name: 'Piano samples loaded' })).toBeVisible();
  await page.mouse.move(0, 0);
  releaseSamples();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(await page.evaluate(() => window.pianoStarts)).toBe(0);
  const key = page.getByRole('button', { name: 'E4', exact: true });
  const next = await key.boundingBox();
  await page.mouse.move(next.x + next.width / 2, next.y + next.height * 0.85);
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(key).toHaveAttribute('aria-pressed', 'false');
});

for (const interruption of ['keyup', 'Escape', 'blur']) {
  test(`first-key activation cancels safely on ${interruption}`, async ({ page }) => {
    let releaseSamples;
    const samplesHeld = new Promise((resolve) => { releaseSamples = resolve; });
    await page.route('**/audio/piano/**/*.mp3', async (route) => { await samplesHeld; await route.continue(); });
    await page.goto('/');
    await expect(page.locator('.key-surface')).toBeVisible();
    await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
    await page.keyboard.down('a');
    await expect(page.getByRole('progressbar', { name: 'Piano samples loaded' })).toBeVisible();
    if (interruption === 'keyup') await page.keyboard.up('a');
    if (interruption === 'Escape') await page.keyboard.press('Escape');
    if (interruption === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    releaseSamples();
    await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
    await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.pianoStarts)).toBe(0);
    await page.keyboard.up('a');
  });
}
