import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './docs/artifacts/test-results',
  fullyParallel: true,
  // Audio-clock and performance measurements share the machine's real audio output.
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'docs/artifacts/playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:3217',
    browserName: 'chromium',
    channel: 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3217',
    url: 'http://127.0.0.1:3217',
    reuseExistingServer: false,
  },
});
