import { expect, test } from '@playwright/test';
import { PREFERENCES_KEY } from '../../src/lib/pianoPreferences.js';

test('reload restores only preferences and keeps audio, transport, sustain and pressed notes stopped', async ({ page }) => {
  await page.addInitScript(() => {
    window.contextsCreated = 0;
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext { constructor(options) { super(options); window.contextsCreated += 1; } };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Volume', exact: true }).fill('68');
  await page.getByRole('checkbox', { name: 'Show note names' }).check();
  await page.getByRole('checkbox', { name: 'Show keyboard shortcuts' }).check();
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await enable(page);
  await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('131');
  await page.getByRole('button', { name: 'Latch sustain' }).click();
  await page.getByRole('button', { name: 'Metronome', exact: true }).click();
  await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
  await page.keyboard.down('a');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(1);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PREFERENCES_KEY);
  expect(saved).toEqual({ version: 1, volume: 68, showNotes: true, showShortcuts: true, bpm: 131 });
  await page.reload();
  await page.keyboard.up('a');
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.contextsCreated)).toBe(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('68');
  await expect(page.getByRole('checkbox', { name: 'Show note names' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show keyboard shortcuts' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await enable(page);
  await expect(page.getByRole('slider', { name: 'Tempo', exact: true })).toHaveValue('131');
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Latch sustain' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'C4', exact: true }).getByText('C4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'C4', exact: true }).getByText('A', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('malformed preferences use defaults and recover after a valid edit', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), PREFERENCES_KEY);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Saved settings could not be read. Defaults are in use.')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('35');
  await page.getByRole('slider', { name: 'Volume', exact: true }).fill('44');
  await expect(page.getByText('Saved settings could not be read. Defaults are in use.')).toBeHidden();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).volume, PREFERENCES_KEY)).toBe(44);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await enable(page);
});

for (const failure of ['read', 'write']) {
  test(`blocked storage ${failure} keeps settings and playing usable without claiming a save`, async ({ page }, testInfo) => {
    await page.addInitScript((failure) => {
      if (failure === 'read') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      else Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    }, failure);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('slider', { name: 'Volume', exact: true }).fill('53');
    await page.getByRole('checkbox', { name: 'Show note names' }).check();
    await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('53');
    await expect(page.getByText('Settings could not be saved in this browser. Changes last until you reload.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`storage-${failure}.png`) });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await enable(page);
    await page.getByRole('slider', { name: 'Tempo', exact: true }).fill('150');
    await page.getByRole('group', { name: 'Piano keyboard', exact: true }).focus();
    await page.keyboard.down('a');
    await expect(page.locator('.piano-key[aria-pressed="true"]')).toHaveCount(1);
    await page.keyboard.up('a');
    await page.getByRole('button', { name: 'Metronome', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Stop all', exact: true }).click();
    expect(errors).toEqual([]);
  });
}

test('settings remain reachable on portrait, short landscape and enlarged text layouts', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('slider', { name: 'Volume', exact: true }).fill('65');
    await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('65');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}-${height}.png`) });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; document.body.style.fontSize = '200%'; });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show note names' }).check();
  await page.getByRole('slider', { name: 'Volume', exact: true }).fill('70');
  for (const name of ['Show note names', 'Show keyboard shortcuts']) {
    const checkbox = page.getByRole('checkbox', { name });
    const input = await checkbox.boundingBox();
    const label = await checkbox.locator('..').boundingBox();
    expect(Math.abs(input.y + input.height / 2 - label.y - label.height / 2)).toBeLessThan(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('settings-enlarged-text.png') });
});

async function enable(page) {
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
}
