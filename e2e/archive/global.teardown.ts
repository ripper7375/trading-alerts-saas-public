/**
 * Global Teardown for Playwright Tests
 *
 * This file runs once after all tests complete and is responsible for:
 * - Cleaning up test data
 * - Resetting database state
 * - Generating summary reports
 *
 * @module e2e/global.teardown
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Starting E2E test teardown...');

  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  try {
    // Clean up test data via API (if test cleanup endpoint exists)
    try {
      const response = await fetch(`${baseURL}/api/test/cleanup`, {
        method: 'POST',
        headers: {
          'x-test-secret': process.env.TEST_SECRET || 'test-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cleanup',
        }),
      });

      if (response.ok) {
        console.log('✅ Test data cleaned up successfully');
      } else {
        console.log('⚠️ Test cleanup endpoint not available');
      }
    } catch {
      console.log('⚠️ Test cleanup endpoint not available');
    }

    console.log('✅ Global teardown complete');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw - teardown failures shouldn't fail the test run
  }
}

export default globalTeardown;
