import { expect, test } from '@playwright/test';

test('serves the application and hydrates without browser errors', async ({ page, request }, testInfo) => {
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
  await page.getByRole('button', { name: 'About this piano' }).click();
  await expect(page.getByRole('button', { name: 'About this piano' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Recordings will stay in this browser.')).toBeVisible();
  await page.getByRole('button', { name: 'About this piano' }).click();
  await expect(page.getByRole('button', { name: 'About this piano' })).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'About this piano' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone.png'), fullPage: true });
  expect(errors).toEqual([]);
});
