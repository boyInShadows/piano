import { toggleSettings, closeSettings, goTo, clickControl } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ hasTouch: true, isMobile: true });

test('portrait guidance keeps navigation reachable and compact keys usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  await expect(page.getByText(/rotation lock/)).toBeVisible();
  await goTo(page, 'Help');
  await expect(page.getByRole('heading', { name: "Playing Qazal's Piano" })).toBeVisible();
  await goTo(page, 'Recordings');
  await expect(page.getByRole('heading', { name: 'Your recordings' })).toBeVisible();
  await goTo(page, 'Play');
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('portrait-guide.png') });
  await page.getByRole('button', { name: 'Use compact keyboard' }).click();
  await expect(page.locator('.piano-key')).toHaveCount(12);
  await closeSettings(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await assertGeometry(page, { width, height: width === 320 ? 568 : 844 }, testInfo);
    await page.screenshot({ path: testInfo.outputPath(`compact-${width}.png`) });
  }
  const reached = new Set();
  const lower = page.getByRole('button', { name: 'Lower octave' });
  const higher = page.getByRole('button', { name: 'Higher octave' });
  for (let step = 0; step < 10 && await lower.isEnabled(); step += 1) await lower.click();
  await expect(lower).toBeDisabled();
  for (let step = 0; step < 10; step += 1) {
    (await page.locator('.piano-key').evaluateAll((keys) => keys.map((key) => Number(key.dataset.midi)))).forEach((midi) => reached.add(midi));
    if (await higher.isDisabled()) break;
    await higher.click();
  }
  await expect(higher).toBeDisabled();
  expect([...reached].sort((a, b) => a - b)).toEqual(Array.from({ length: 88 }, (_, index) => index + 21));
  for (let step = 0; step < 4; step += 1) await lower.click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.piano-key')).toHaveCount(25);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.piano-key')).toHaveCount(12);
  await expect(page.locator('.play-layout')).toHaveCSS('height', '844px');
  await assertGeometry(page, { width: 390, height: 844 }, testInfo);
  await closeSettings(page);
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(1);
  await page.keyboard.up('a');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.keyboard.press('o');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
});

test('landscape and tablet geometry retains usable keys and controls', async ({ page }, testInfo) => {
  await page.goto('/');
  await closeSettings(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  for (const [width, height] of [[568, 320], [667, 375], [844, 390], [768, 1024], [1024, 768], [1280, 720], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await assertGeometry(page, { width, height }, testInfo);
    await page.screenshot({ path: testInfo.outputPath(`geometry-${width}-${height}.png`) });
  }
});

test('phone browser bars leave room for playable landscape keys and rotation recovery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 838, height: 286 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  await closeSettings(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await assertGeometry(page, { width: 838, height: 286 }, testInfo);
  await clickControl(page, 'Record');
  await expect(page.getByRole('status').filter({ hasText: 'Recording musical events' })).toBeVisible();
  await assertGeometry(page, { width: 838, height: 286 }, testInfo);
  await clickControl(page, 'Stop recording');
  await closeSettings(page);
  await page.setViewportSize({ width: 393, height: 766 });
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  await page.getByRole('button', { name: 'Use compact keyboard' }).click();
  await assertGeometry(page, { width: 393, height: 766 }, testInfo);
  await page.setViewportSize({ width: 838, height: 286 });
  await assertGeometry(page, { width: 838, height: 286 }, testInfo);
});

test('rotation and shrinking space clear held notes and pedal without recreating audio', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    window.audioContexts = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options) { super(options); window.audioContexts.push(this); }
    };
  });
  await page.goto('/');
  await closeSettings(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await page.setViewportSize({ width: 568, height: 320 });
  await assertGeometry(page, { width: 568, height: 320 }, testInfo);
  await page.screenshot({ path: testInfo.outputPath('ready-landscape-568.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  for (let rotation = 0; rotation < 3; rotation += 1) {
    await clickControl(page, 'Metronome');
    await clickControl(page, 'Latch sustain');
    await closeSettings(page);
    await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
    await page.keyboard.down('Space');
    await page.keyboard.down('a');
    await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
    await page.keyboard.up('a');
    await page.keyboard.up('Space');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('button', { name: 'Latch sustain', includeHidden: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Metronome', exact: true, includeHidden: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  await page.locator('main').evaluate((element) => { element.style.height = '1200px'; });
  await goTo(page, 'Help');
  await page.setViewportSize({ width: 390, height: 844 });
  await goTo(page, 'Play');
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('main').evaluate((element) => { element.style.height = ''; });
  await clickControl(page, 'Latch sustain');
  await closeSettings(page);
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await toggleSettings(page);
  await expect(page.getByRole('heading', { name: 'Piano settings' })).toBeVisible();
  await expect(page.locator('.key-surface')).toBeVisible();
  await toggleSettings(page);
  await page.keyboard.up('a');
  await expect(page.getByRole('button', { name: 'Latch sustain', includeHidden: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
});

test('unusable compact space explains the limit while preserving navigation and zoom', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 280, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use compact keyboard' }).click();
  await expect(page.getByText('This window is too narrow for this key range.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toBeHidden();
  await goTo(page, 'Help');
  await expect(page.getByRole('heading', { name: "Playing Qazal's Piano" })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 250 });
  await goTo(page, 'Play');
  await expect(page.getByRole('heading', { name: 'A little more room to play' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; document.body.style.fontSize = '200%'; });
  await expect(page.locator('.key-surface')).toBeVisible();
  await assertGeometry(page, { width: 1024, height: 768 }, testInfo);
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/user-scalable=no|maximum-scale=1(?:,|$)/);
  await page.screenshot({ path: testInfo.outputPath('zoom-large-text-instrument.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await goTo(page, 'Help');
  await expect(page.getByRole('heading', { name: "Playing Qazal's Piano" })).toBeVisible();
});

async function assertGeometry(page, viewport, testInfo) {
  await expect(page.locator('.piano-key--white').first()).toBeVisible();
  await expect.poll(async () => (await page.locator('.piano-key--white').first().boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
  await expect.poll(async () => {
    const box = await page.locator('.piano-key--white').first().boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(viewport.height);
  const measured = await page.evaluate(() => {
    const boxes = (selector) => [...document.querySelectorAll(selector)].filter((node) => node.getClientRects().length).map((node) => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { label: node.getAttribute('aria-label') || node.textContent, x, y, width, height, right, bottom };
    });
    return { white: boxes('.piano-key--white'), black: boxes('.piano-key--black'), controls: boxes('.settings-button, .range-bar button, .audio-controls button, .audio-controls input'), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(measured.overflow).toBe(false);
  for (const box of measured.white) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(140);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
    expect(box.bottom, box.label).toBeLessThanOrEqual(viewport.height);
  }
  for (const box of measured.black) expect(box.width).toBeGreaterThanOrEqual(24);
  for (const box of measured.controls) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.bottom, box.label).toBeLessThanOrEqual(viewport.height);
  }
  const path = testInfo.outputPath(`geometry-${viewport.width}-${viewport.height}.json`);
  await writeFile(path, JSON.stringify(measured, null, 2));
  await testInfo.attach(`geometry-${viewport.width}-${viewport.height}`, { path, contentType: 'application/json' });
}
