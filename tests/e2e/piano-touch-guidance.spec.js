import { enableSound } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });

test('rotation guidance demonstrates the turn and keeps the compact fallback reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const guide = page.getByRole('region', { name: 'Piano screen guidance' });
  await expect(guide.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  const phone = guide.locator('svg g');
  await expect.poll(() => phone.evaluate((element) => element.getAnimations().length)).toBe(1);
  await phone.evaluate((element) => { for (const animation of element.getAnimations()) animation.finish(); });
  const bounds = await phone.locator('rect').first().boundingBox();
  expect(bounds.width).toBeGreaterThan(bounds.height);
  await expect(guide.getByText(/rotation lock/)).toBeVisible();
  await guide.getByRole('button', { name: 'Use compact keyboard' }).click();
  await expect(page.locator('.piano-key')).toHaveCount(12);
});

test('reduced motion presents the landscape phone without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const guide = page.getByRole('region', { name: 'Piano screen guidance' });
  await expect(guide.getByRole('heading', { name: 'Rotate your phone to play' })).toBeVisible();
  const phone = guide.locator('svg g');
  expect(await phone.evaluate((element) => element.getAnimations().length)).toBe(0);
  const bounds = await phone.locator('rect').first().boundingBox();
  expect(bounds.width).toBeGreaterThan(bounds.height);
  const fallback = await guide.getByRole('button', { name: 'Use compact keyboard' }).boundingBox();
  expect(fallback.y + fallback.height).toBeLessThanOrEqual(568);
});

test('touch piano suppresses the browser tap overlay while retaining its pressed feedback', async ({ page }) => {
  await page.setViewportSize({ width: 838, height: 286 });
  await page.goto('/');
  await enableSound(page);
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  const keyboard = page.getByRole('group', { name: 'Piano keyboard', exact: true });
  await expect(keyboard).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await expect(key).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  const bounds = await key.boundingBox();
  const session = await page.context().newCDPSession(page);
  const touch = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.85 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(key).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'C#4', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'C#4', exact: true })).toHaveCSS('outline-style', 'solid');
});
