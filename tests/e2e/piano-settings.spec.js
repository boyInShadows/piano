import { closeSettings, openSettings, clickControl } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

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
