import { expect, test } from '@playwright/test';
import { clickControl, closeSettings, enableSound, goTo, openSettings } from '../helpers/pianoUi.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 838, height: 286 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await enableSound(page);
});

test('phone performance keeps bass and melody available together without a pan rail', async ({ page }, testInfo) => {
  await expect(page.getByRole('group', { name: 'Bass keyboard', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Piano keyboard', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Pan keyboard' })).toHaveCount(0);
  for (const [width, height] of [[838, 286], [568, 320]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('.piano-key--white[aria-hidden="false"]').evaluateAll((nodes) =>
      nodes.length ? Math.max(...nodes.map((node) => node.getBoundingClientRect().right)) : Infinity)).toBeLessThanOrEqual(width);
    const keys = await page.locator('.piano-key--white[aria-hidden="false"]').evaluateAll((nodes) => nodes.map((node) => {
      const { width, height, x, right, bottom } = node.getBoundingClientRect();
      return { width, height, x, right, bottom };
    }));
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const key of keys) {
      expect(key.width).toBeGreaterThanOrEqual(44);
      expect(key.height).toBeGreaterThanOrEqual(140);
      expect(key.x).toBeGreaterThanOrEqual(0);
      expect(key.right).toBeLessThanOrEqual(width);
      expect(key.bottom).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: testInfo.outputPath(`performance-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('independent fingers play both zones and release without moving either range', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  const points = [];
  for (const [index, name] of ['C2', 'E4'].entries()) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    points.push({ id: index + 1, x: box.x + box.width / 2, y: box.y + box.height * 0.85 });
  }
  const positions = await page.locator('.key-surface').evaluateAll((nodes) => nodes.map((node) => node.style.transform));
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await expect(page.getByRole('button', { name: 'C2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'E4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [points[0]] });
  await expect(page.getByRole('button', { name: 'C2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'E4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  expect(await page.locator('.key-surface').evaluateAll((nodes) => nodes.map((node) => node.style.transform))).toEqual(positions);
});

test('setup selects ranges before playing and stays locked throughout recording and replay', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('combobox', { name: 'Bass starting note', exact: true }).selectOption('48');
  await page.getByRole('combobox', { name: 'Melody starting note', exact: true }).selectOption('72');
  await closeSettings(page);
  await expect(page.getByRole('button', { name: 'C3', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C5', exact: true })).toBeVisible();
  await clickControl(page, 'Record');
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.press('a');
  await openSettings(page);
  await expect(page.getByRole('combobox', { name: 'Keyboard layout', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Bass starting note', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Melody starting note', exact: true })).toBeDisabled();
  await clickControl(page, 'Stop recording');
  await goTo(page, 'Recordings');
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await openSettings(page);
  await expect(page.getByRole('combobox', { name: 'Keyboard layout', exact: true })).toBeDisabled();
  await clickControl(page, 'Stop all');
  await expect(page.getByRole('combobox', { name: 'Keyboard layout', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Keyboard layout', exact: true }).selectOption('continuous');
  await closeSettings(page);
  await expect(page.getByRole('slider', { name: 'Pan keyboard' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Bass keyboard', exact: true })).toHaveCount(0);
});

test('rotation finalizes a two-hand recording and restores a silent fixed layout', async ({ page, context }) => {
  await clickControl(page, 'Record');
  const client = await context.newCDPSession(page);
  const points = [];
  for (const [index, name] of ['C2', 'E4'].entries()) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    points.push({ id: index + 1, x: box.x + box.width / 2, y: box.y + box.height * 0.85 });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.setViewportSize({ width: 838, height: 286 });
  await expect(page.getByRole('group', { name: 'Bass keyboard', exact: true })).toBeVisible();
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Recording musical events' })).toHaveCount(0);
  await goTo(page, 'Recordings');
  await expect(page.locator('.recording-draft')).toBeVisible();
  await expect(page.locator('.recording-draft')).toHaveAttribute('data-event-count', '4');
});

test('overlapping hand ranges share pitch ownership until both fingers release', async ({ page, context }) => {
  await openSettings(page);
  await page.getByRole('combobox', { name: 'Bass starting note', exact: true }).selectOption('60');
  await closeSettings(page);
  const client = await context.newCDPSession(page);
  const points = [];
  for (const [index, name] of ['Bass keyboard', 'Piano keyboard'].entries()) {
    const key = page.getByRole('group', { name, exact: true }).getByRole('button', { name: 'C4', exact: true });
    const box = await key.boundingBox();
    points.push({ id: index + 1, x: box.x + box.width / 2, y: box.y + box.height * 0.85 });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [points[0]] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
});

test('fixed ranges can reach A0 and C8 while arrow focus stays inside the chosen zone', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('combobox', { name: 'Bass starting note', exact: true }).selectOption('21');
  await page.getByRole('combobox', { name: 'Melody starting note', exact: true }).selectOption('108');
  await closeSettings(page);
  await expect(page.getByRole('button', { name: 'A0', exact: true })).toBeVisible();
  const last = page.getByRole('button', { name: 'C8', exact: true });
  await expect(last).toBeVisible();
  await last.focus();
  await page.keyboard.press('ArrowRight');
  await expect(last).toBeFocused();
  await page.keyboard.down('Enter');
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Enter');
  await expect(last).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('slider', { name: 'Pan keyboard' })).toHaveCount(0);
});
