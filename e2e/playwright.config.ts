/**
 * Playwright Configuration — Session 10-2 (Drawing Engine & Line-Alert e2e)
 *
 * Created fresh for this session (the referenced config never existed outside
 * `e2e/archive/`, which the archived multi-browser + storageState-setup shape
 * was overkill for a single regression spec). Runs against already-started
 * local servers (monolith `next dev` on :3000, `operation-service` static
 * `node dist/main` + `node dist/main-worker` on :3001) — no `webServer`
 * auto-start block, matching Session 10-1's own manual-boot precedent
 * (`LESSONS-LEARNED.md` L24: don't run `start:dev`/watch-mode concurrently
 * with the worker process).
 *
 * @module e2e/playwright.config
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: 'test-results',
});
