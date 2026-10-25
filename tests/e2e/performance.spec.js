import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('records a desktop audio and interaction stability baseline', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.performanceEvidence = { contexts: 0, sampleStarts: 0, inputDeltas: [], longTasks: [] };
    const nativeContext = window.AudioContext;
    const nativeDocumentStart = performance.now();
    window.addEventListener('keydown', (event) => {
      if (!event.repeat) window.performanceEvidence.lastKeydown = performance.now();
    }, true);
    if (window.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
      new PerformanceObserver((list) => {
        window.performanceEvidence.longTasks.push(...list.getEntries().map(({ duration }) => duration));
      }).observe({ type: 'longtask', buffered: true });
    }
    window.AudioContext = class extends nativeContext {
      constructor(options) { super(options); window.performanceEvidence.contexts += 1; }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          if (source.buffer?.duration > 0.2 && !source.loop) {
            window.performanceEvidence.sampleStarts += 1;
            if (window.performanceEvidence.lastKeydown !== undefined) {
              window.performanceEvidence.inputDeltas.push(performance.now() - window.performanceEvidence.lastKeydown);
            }
          }
          return start(...args);
        };
        return source;
      }
    };
    window.performanceEvidence.nativeDocumentStart = nativeDocumentStart;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sound ready' })).toBeVisible();
  const keyboard = page.getByRole('group', { name: 'Piano keyboard', exact: true });
  await keyboard.focus();
  for (const code of ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';']) await page.keyboard.down(code);
  await page.waitForTimeout(100);
  for (const code of ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';']) await page.keyboard.up(code);
  await page.getByRole('button', { name: 'Metronome', exact: true }).click();
  await page.waitForTimeout(30_000);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();

  const evidence = await page.evaluate(() => ({
    ...window.performanceEvidence,
    maxLongTaskMs: Math.max(0, ...window.performanceEvidence.longTasks),
    p95InputDispatchMs: [...window.performanceEvidence.inputDeltas].sort((a, b) => a - b)[Math.max(0, Math.ceil(window.performanceEvidence.inputDeltas.length * 0.95) - 1)] ?? null,
    sampleRequests: performance.getEntriesByType('resource').filter(({ name }) => name.endsWith('.mp3')).length,
    sampleTransferBytes: performance.getEntriesByType('resource').filter(({ name }) => name.endsWith('.mp3')).reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
  }));
  await writeFile('docs/artifacts/t16-desktop-performance-baseline.json', JSON.stringify(evidence, null, 2));
  await testInfo.attach('desktop-performance-baseline.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.contexts).toBe(1);
  expect(evidence.sampleRequests).toBe(16);
  expect(evidence.sampleStarts).toBeGreaterThanOrEqual(10);
  expect(evidence.p95InputDispatchMs).not.toBeNull();
});
