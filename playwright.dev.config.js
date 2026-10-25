import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';

export default defineConfig({
  ...config,
  reporter: 'list',
  webServer: {
    ...config.webServer,
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3217',
    timeout: 120000,
  },
});
