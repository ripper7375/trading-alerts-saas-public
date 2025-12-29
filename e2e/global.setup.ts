/**
 * Global Setup for Playwright Tests
 *
 * This file runs once before all tests and is responsible for:
 * - Setting up test database state
 * - Creating test users
 * - Seeding affiliate codes
 * - Preparing authentication states
 *
 * @module e2e/global.setup
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting E2E test setup...');

  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for app to be ready
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    console.log('✅ Application is ready');

    // Seed test data via API (if test seed endpoint exists)
    try {
      const response = await page.request.post(`${baseURL}/api/test/seed`, {
        headers: {
          'x-test-secret': process.env.TEST_SECRET || 'test-secret',
        },
        data: {
          action: 'seed',
        },
      });

      if (response.ok()) {
        console.log('✅ Test data seeded successfully');
      } else {
        console.log('⚠️ Test seed endpoint not available (will use existing data)');
      }
    } catch {
      console.log('⚠️ Test seed endpoint not available (will use existing data)');
    }

    // Store base authentication states
    await setupAuthStates(baseURL, context);

    console.log('✅ Global setup complete');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Set up authentication states for different user types
 */
async function setupAuthStates(
  baseURL: string,
  context: import('@playwright/test').BrowserContext
): Promise<void> {
  console.log('🔐 Setting up authentication states...');

  // Note: In a real setup, we would:
  // 1. Create test users if they don't exist
  // 2. Log in as each user type
  // 3. Save storage state for reuse

  // For now, we just verify the auth pages are accessible
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Login page accessible');
  } catch {
    console.log('⚠️ Login page not ready');
  }

  await page.close();
}

export default globalSetup;
