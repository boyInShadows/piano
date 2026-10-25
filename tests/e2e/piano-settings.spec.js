import { closeSettings, openSettings, clickControl } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

test('sound activation and recovery stay inside the fallboard at desktop and short landscape sizes', async ({ page }) => {
  await page.route('**/audio/piano/**/*.mp3', (route) => route.abort());
  for (const viewport of [{ width: 1440, height: 900 }, { width: 838, height: 286 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const checkPlacement = async (name) => {
      const button = await page.getByRole('button', { name, exact: true }).boundingBox();
      const cabinet = await page.locator('.fallboard').boundingBox();
      expect(button.y).toBeGreaterThanOrEqual(cabinet.y);
      expect(button.y + button.height).toBeLessThanOrEqual(cabinet.y + cabinet.height);
      expect(button.x).toBeGreaterThanOrEqual(cabinet.x);
      expect(button.x + button.width).toBeLessThanOrEqual(cabinet.x + cabinet.width);
    };
    await checkPlacement('Enable sound');
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry sound', exact: true })).toBeVisible();
    await expect(page.getByText('Sound could not start. Try again.', { exact: true })).toBeVisible();
    await checkPlacement('Retry sound');
  }
});

test('Settings remains dismissible when the native Popover API is unavailable', async ({ page }) => {
  await page.addInitScript(() => { delete HTMLElement.prototype.showPopover; });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  await trigger.click();
  await expect(page.locator('#piano-settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Piano settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#piano-settings')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(8, 8);
  await expect(page.locator('#piano-settings')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('ready instrument fills the page while secondary controls stay behind the gear', async ({ page }) => {
  await page.setViewportSize({ width: 838, height: 286 });
  await page.goto('/');
  await closeSettings(page);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveCount(0);
  const bounds = await page.locator('main').boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 838, height: 286 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(286);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toBeVisible();
});

test('Settings gear opens an overlay without resizing the keyboard and restores focus on Escape', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(trigger.locator('svg')).toBeVisible();
  const before = await page.locator('.key-viewport').boundingBox();
  await trigger.click();
  await expect(page.locator('#piano-settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Piano settings' })).toBeFocused();
  expect(await page.locator('.key-viewport').boundingBox()).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#piano-settings')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('controls remain usable during metronome and recording, and outside tap dismisses the panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await clickControl(page, 'Metronome');
  await closeSettings(page);
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await clickControl(page, 'Record');
  await expect(page.locator('#piano-settings')).toBeHidden();
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  await clickControl(page, 'Stop recording');
  await clickControl(page, 'Stop all');
  await page.mouse.click(8, 8);
  await expect(page.locator('#piano-settings')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
});
