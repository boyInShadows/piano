import { closeSettings, goTo, clickControl, enableSound } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

async function recordDraft(page) {
  await clickControl(page, 'Record');
  const keyboard = page.getByRole('group', { name: 'Piano keyboard', exact: true });
  await closeSettings(page);
  await keyboard.focus();
  await page.keyboard.down('a');
  await page.waitForTimeout(120);
  await page.keyboard.up('a');
  await clickControl(page, 'Stop recording');
  await goTo(page, 'Recordings');
  await expect(page.locator('.recording-draft')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await closeSettings(page);
  await enableSound(page);
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
});

test('saves a draft, reloads the library, replays it, and deletes it with confirmation', async ({ page }) => {
  await recordDraft(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await expect(page.locator('.recording-draft')).toHaveCount(0);
  await expect(page.locator('.recording-item')).toContainText('Take 1');

  await page.reload();
  await closeSettings(page);
  await enableSound(page);
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await goTo(page, 'Recordings');
  await expect(page.locator('.recording-item')).toContainText('Take 1');

  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Replaying recording' })).toBeVisible();
  await clickControl(page, 'Stop all');
  await expect(page.getByRole('status').filter({ hasText: 'Replaying recording' })).toHaveCount(0);
  await goTo(page, 'Recordings');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.recording-item')).toHaveCount(0);
  await expect(page.getByText('No saved recordings yet.')).toBeVisible();
});

test('restores a finalized unsaved draft after reload without adding it to the library', async ({ page }) => {
  await recordDraft(page);
  await page.reload();
  await goTo(page, 'Recordings');
  await expect(page.locator('.recording-draft')).toContainText('Unsaved draft: Take 1');
  await expect(page.locator('.recording-item')).toHaveCount(0);
});
