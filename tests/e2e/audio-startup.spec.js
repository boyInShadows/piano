import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalContext = window.AudioContext;
    window.audioContexts = [];
    window.AudioContext = class extends OriginalContext {
      constructor(options) { super(options); window.audioContexts.push(this); }
      async decodeAudioData(data) {
        const buffer = await super.decodeAudioData(data);
        window.decodedPianoBytes = (window.decodedPianoBytes ?? 0) + buffer.length * buffer.numberOfChannels * 4;
        return buffer;
      }
    };
  });
});

test('loads samples only after a gesture and resumes a single context', async ({ page, request }) => {
  const samples = [];
  page.on('request', (request) => { if (request.url().endsWith('.mp3')) samples.push(request.url()); });
  await page.goto('/');
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(0);
  expect(samples).toHaveLength(0);
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(samples).toHaveLength(16);
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  expect(await page.evaluate(() => window.audioContexts[0].state)).toBe('running');
  expect(await page.evaluate(() => window.decodedPianoBytes)).toBeLessThan(64 * 1024 ** 2);
  const sampleResponse = await request.get('/audio/piano/salamander-v1/A0.mp3');
  expect(sampleResponse.headers()['cache-control']).toContain('immutable');
  await page.evaluate(() => window.audioContexts[0].suspend());
  await expect(page.getByRole('button', { name: 'Resume sound' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume sound' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  expect(samples).toHaveLength(16);
});

test('failed sample load can be retried without another context or stale readiness', async ({ page }) => {
  await page.route('**/A0.mp3', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry sound' })).toBeVisible();
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  await page.unroute('**/A0.mp3');
  await page.getByRole('button', { name: 'Retry sound' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
});
