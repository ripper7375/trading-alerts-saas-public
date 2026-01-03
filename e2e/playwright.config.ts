/**
 * Playwright Configuration
 * Trading Alerts SaaS E2E Testing
 *
 * @module e2e/playwright.config
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Environment-specific base URLs
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  // Test directory
  testDir: './tests',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Fully parallel test execution
  fullyParallel: true,

  // Fail the build on CI if test.only is left
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Workers for parallel execution
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Global timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL,

    // Collect trace when retrying
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Geolocation for dLocal tests
    geolocation: { longitude: -122.4194, latitude: 37.7749 },

    // Permissions
    permissions: ['geolocation', 'notifications'],

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',
  },

  // Browser projects
  projects: [
    // Setup project for authentication state
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Chromium
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },

    // Firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      dependencies: ['setup'],
    },

    // WebKit
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
      dependencies: ['setup'],
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Don't set env - let Next.js load .env.local automatically
    cwd: path.join(__dirname, '..'),
  },

  // Global setup
  globalSetup: path.join(__dirname, 'global.setup.ts'),

  // Global teardown
  globalTeardown: path.join(__dirname, 'global.teardown.ts'),
});
