import { toggleSettings, closeSettings, goTo } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

test('serves the selected piano shell and navigates without browser errors', async ({ page, request }, testInfo) => {
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("Qazal&#x27;s Piano");
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle("Qazal's Piano");
  await expect(page.getByRole('heading', { name: "Qazal's Piano", exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C4', exact: true })).toBeVisible();
  await closeSettings(page);
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await expect(page.getByRole('group', { name: 'Piano keyboard', exact: true })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Piano keyboard', exact: true })).toHaveCSS('outline-color', 'rgb(248, 245, 235)');
  await page.screenshot({ path: testInfo.outputPath('desktop-clean.png'), fullPage: true });
  await goTo(page, 'Recordings');
  await expect(page.getByRole('heading', { name: 'Your recordings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your recordings' })).toBeFocused();
  await goTo(page, 'Help');
  await expect(page.getByRole('heading', { name: "Playing Qazal's Piano" })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Playing Qazal's Piano" })).toBeFocused();
  await goTo(page, 'Play');
  await toggleSettings(page);
  await expect(page.getByRole('heading', { name: 'Piano settings' })).toBeFocused();
  await page.getByRole('checkbox', { name: 'Show note names' }).check();
  await toggleSettings(page);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'Show note names' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'C4', exact: true }).getByText('C4')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 320, height: 568 });
  await goTo(page, 'Help');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone-help.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('adapts the key window and keeps both extremes reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const keys = page.locator('.piano-key');
  await expect(keys).toHaveCount(37);
  const next = page.getByRole('button', { name: 'Higher octave' });
  const previous = page.getByRole('button', { name: 'Lower octave' });
  for (let step = 0; step < 8 && await previous.isEnabled(); step += 1) await previous.click();
  await expect(previous).toBeDisabled();
  await expect(page.getByRole('button', { name: 'A0', exact: true })).toBeVisible();
  for (let step = 0; step < 8 && await next.isEnabled(); step += 1) await next.click();
  await expect(next).toBeDisabled();
  await expect(page.getByRole('button', { name: 'C8', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(keys).toHaveCount(25);
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(keys).toHaveCount(13);
  const firstWhite = await page.locator('.piano-key--white').first().boundingBox();
  const firstBlack = await page.locator('.piano-key--black').first().boundingBox();
  expect(firstWhite.width).toBeGreaterThanOrEqual(44);
  expect(firstBlack.width).toBeGreaterThanOrEqual(24);
  const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dataset.midi, {
    x: firstBlack.x + firstBlack.width / 2,
    y: firstBlack.y + firstBlack.height / 2,
  });
  expect(target).toBe(await page.locator('.piano-key--black').first().getAttribute('data-midi'));
  await page.screenshot({ path: testInfo.outputPath('landscape.png'), fullPage: true });
});
