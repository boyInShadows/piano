import { expect, test } from '@playwright/test';

async function recordDraft(page) {
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  const keyboard = page.getByRole('group', { name: 'Piano keyboard', exact: true });
  await keyboard.focus();
  await page.keyboard.down('a');
  await page.waitForTimeout(120);
  await page.keyboard.up('a');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.getByRole('button', { name: 'Recordings', exact: true }).click();
  await expect(page.locator('.recording-draft')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
});

test('saves a draft, reloads the library, replays it, and deletes it with confirmation', async ({ page }) => {
  await recordDraft(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await expect(page.locator('.recording-draft')).toHaveCount(0);
  await expect(page.locator('.recording-item')).toContainText('Take 1');

  await page.reload();
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Recordings', exact: true }).click();
  await expect(page.locator('.recording-item')).toContainText('Take 1');

  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Replaying recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Replaying recording' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recordings', exact: true }).click();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.recording-item')).toHaveCount(0);
  await expect(page.getByText('No saved recordings yet.')).toBeVisible();
});

test('restores a finalized unsaved draft after reload without adding it to the library', async ({ page }) => {
  await recordDraft(page);
  await page.reload();
  await page.getByRole('button', { name: 'Recordings', exact: true }).click();
  await expect(page.locator('.recording-draft')).toContainText('Unsaved draft: Take 1');
  await expect(page.locator('.recording-item')).toHaveCount(0);
});
