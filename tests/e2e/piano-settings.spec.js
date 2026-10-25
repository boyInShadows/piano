import { expect, test } from '@playwright/test';

test('Settings gear opens an overlay without resizing the keyboard and restores focus on Escape', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(trigger.locator('svg')).toBeVisible();
  const before = await page.locator('.key-viewport').boundingBox();
  await trigger.click();
  await expect(page.locator('#piano-settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keyboard settings' })).toBeFocused();
  expect(await page.locator('.key-viewport').boundingBox()).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#piano-settings')).toBeHidden();
  await expect(trigger).toBeFocused();
});
