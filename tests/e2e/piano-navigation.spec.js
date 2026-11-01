import { expect, test } from '@playwright/test';
import { clickControl, closeSettings, enableSound, goTo } from '../helpers/pianoUi.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await enableSound(page);
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
});

test('continuous rail reaches both ends, supports direct jumps and resets to Middle C', async ({ page }, testInfo) => {
  const rail = page.getByRole('slider', { name: 'Pan keyboard' });
  await expect(rail).toBeVisible();
  await expect(page.locator('.piano-key')).toHaveCount(88);
  await rail.fill('0');
  await expect(page.getByRole('button', { name: 'A0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lower octave' })).toBeDisabled();
  await rail.fill(await rail.getAttribute('max'));
  await expect(page.getByRole('button', { name: 'C8', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Higher octave' })).toBeDisabled();
  const bounds = await rail.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * 0.35, bounds.y + bounds.height / 2);
  const jumped = Number(await rail.inputValue());
  expect(jumped).toBeGreaterThan(0);
  expect(jumped).toBeLessThan(Number(await rail.getAttribute('max')));
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(Number(await rail.inputValue())).toBeGreaterThan(jumped);
  await page.getByRole('button', { name: 'Middle C' }).click();
  await expect(rail).toHaveValue('23');
  await expect(page.getByRole('status', { name: 'Visible note range' })).toContainText('C4');
  await page.screenshot({ path: testInfo.outputPath('continuous-desktop.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('panning preserves a held pitch, sustain, recording and the running metronome', async ({ page }) => {
  await clickControl(page, 'Record');
  await clickControl(page, 'Metronome');
  await clickControl(page, 'Latch sustain');
  await closeSettings(page);
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  const original = page.locator('[data-midi="60"]');
  await expect(original).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Pan keyboard' }).fill('0');
  await expect(original).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Recording musical events' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Metronome', exact: true, includeHidden: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Latch sustain', includeHidden: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('a');
  await expect(original).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await expect(page.locator('[data-midi="24"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('a');
  await clickControl(page, 'Stop recording');
  await goTo(page, 'Recordings');
  await expect(page.locator('.recording-draft')).toBeVisible();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.getByRole('slider', { name: 'Pan keyboard' }).fill('23');
  await expect(page.getByRole('status').filter({ hasText: 'Replaying recording' })).toBeVisible();
  await clickControl(page, 'Stop all');
});

test('focus navigation reveals offscreen notes without scrolling the page', async ({ page }) => {
  const rail = page.getByRole('slider', { name: 'Pan keyboard' });
  await rail.fill('0');
  await rail.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'C8', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Middle C' }).click();
  await page.getByRole('button', { name: 'C4', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'B3');
  await expect(page.locator(':focus')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.down('Enter');
  await expect(page.locator(':focus')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Enter');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => scrollX === 0 && scrollY === 0)).toBe(true);
});

test('a native touch can pan the rail while another finger holds its original pitch', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const key = await page.getByRole('button', { name: 'C4', exact: true }).boundingBox();
  const held = { id: 1, x: key.x + key.width / 2, y: key.y + key.height * 0.85 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [held] });
  await expect(page.locator('[data-midi="60"]')).toHaveAttribute('aria-pressed', 'true');
  const rail = page.getByRole('slider', { name: 'Pan keyboard' });
  const bounds = await rail.boundingBox();
  const before = Number(await rail.inputValue());
  const navigation = { id: 2, x: bounds.x + 8 + (bounds.width - 16) * before / Number(await rail.getAttribute('max')), y: bounds.y + bounds.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [held, navigation] });
  for (let step = 1; step <= 5; step += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [held, { ...navigation, x: navigation.x - bounds.width * 0.1 * step }] });
  }
  await expect.poll(async () => Number(await rail.inputValue())).toBeLessThan(before);
  await expect(page.locator('[data-midi="60"]')).toHaveAttribute('aria-pressed', 'true');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [held] });
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
});
