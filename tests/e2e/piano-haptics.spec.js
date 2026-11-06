import { expect, test } from '@playwright/test';
import { enableSound } from '../helpers/pianoUi.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 838, height: 286 } });

test('accepted touch presses give one short pulse without buzzing on hold, release, mouse or keyboard', async ({ page, context }) => {
  await page.addInitScript(() => {
    window.hapticPulses = [];
    Object.defineProperty(navigator, 'vibrate', { value: (duration) => { window.hapticPulses.push(duration); return true; } });
  });
  await page.goto('/');
  const key = page.getByRole('button', { name: 'C4', exact: true });
  await key.tap();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(await page.evaluate(() => window.hapticPulses)).toEqual([]);
  const box = await key.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height * 0.85 };
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.hapticPulses)).toEqual([10]);
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(key).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press('a');
  expect(await page.evaluate(() => window.hapticPulses)).toEqual([10]);
});

for (const support of ['missing', 'denied', 'throws']) {
  test(`touch notes still play and release when vibration is ${support}`, async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'vibrate', { value: mode === 'missing' ? undefined : () => {
        if (mode === 'throws') throw new Error('Vibration unavailable');
        return false;
      } });
    }, support);
    await page.goto('/');
    await enableSound(page);
    await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
    const key = page.getByRole('button', { name: 'C4', exact: true });
    const box = await key.boundingBox();
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height * 0.85 }] });
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(key).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
  });
}
