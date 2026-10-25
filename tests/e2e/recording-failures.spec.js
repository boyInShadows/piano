import { goTo } from '../helpers/pianoUi.js';
import { expect, test } from '@playwright/test';

test('unavailable IndexedDB explains the storage failure without blocking the library view', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: null });
  });
  await page.goto('/');
  await goTo(page, 'Recordings');
  await expect(page.getByRole('status').filter({ hasText: 'IndexedDB is unavailable in this browser.' })).toBeVisible();
  await expect(page.getByText('No saved recordings yet.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recordings-indexeddb-unavailable.png') });
});

test('corrupt stored recordings are ignored and the library remains usable', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Recordings');
  await expect(page.getByText('No saved recordings yet.')).toBeVisible();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('qazals-piano.recordings.v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('recordings', 'readwrite');
      transaction.objectStore('recordings').put({ id: 'corrupt', title: 'Corrupt take', duration: -1 });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await goTo(page, 'Recordings');
  await expect(page.getByText('No saved recordings yet.')).toBeVisible();
  await expect(page.locator('.recording-item')).toHaveCount(0);
});
