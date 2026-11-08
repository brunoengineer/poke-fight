// Browser tests: they play the real game in Chromium. `npm run e2e` (see e2e/helpers.ts).
// Desktop only: the game is played with a keyboard or a controller.

import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;
// Not Vite's default (5173) and not poke-gacha's (5199): with reuseExistingServer, tests could otherwise run against
// another project's dev server.
const PORT = 5288;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 3 : undefined,
  timeout: 30_000,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
  },
});
