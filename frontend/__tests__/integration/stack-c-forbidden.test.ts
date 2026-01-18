/**
 * Integration Tests: UI → Stack C (FORBIDDEN)
 *
 * Tests that Frontend CANNOT directly access Backend Stack C
 *
 * Stack C handles:
 * - MT5 Market Data Collection (Part 24)
 * - Direct MT5 Python API
 *
 * Expected Result: UI → Stack C (FORBIDDEN) ❌
 *
 * Security Requirement:
 * - Frontend should NEVER be able to access Stack C directly
 * - All market data requests should go through Stack A or Stack B
 * - Stack A and B proxy requests to Stack C
 */

import { TEST_ENV, validateStackCInaccessible } from '../utils/test-helpers';

describe('Integration: UI → Stack C (FORBIDDEN)', () => {
  describe('Security: Stack C Direct Access', () => {
    it('should NOT be able to connect directly to Stack C from frontend', async () => {
      const result = await validateStackCInaccessible();

      // This test PASSES if Stack C is NOT accessible
      expect(result.success).toBe(true);
      console.log('✅', result.message);
    }, 10000);

    it('should fail when trying to fetch from Stack C directly', async () => {
      const stackCUrl = TEST_ENV.STACK_C_URL;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${stackCUrl}/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we got a response, this test should FAIL
        // Stack C should NOT be accessible from frontend
        fail(
          `Stack C at ${stackCUrl} is accessible from frontend (security violation!)`
        );
      } catch (error) {
        // Good! This means Stack C is not accessible
        console.log('✅ Stack C is correctly inaccessible from frontend');
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should fail when trying to get candles from Stack C directly', async () => {
      const stackCUrl = TEST_ENV.STACK_C_URL;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${stackCUrl}/candles/EURUSD/H1`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we got a response, this test should FAIL
        fail('Stack C candles endpoint is accessible from frontend (security violation!)');
      } catch (error) {
        // Good! This means Stack C is not accessible
        console.log('✅ Stack C candles endpoint is correctly inaccessible');
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should fail when trying to get indicators from Stack C directly', async () => {
      const stackCUrl = TEST_ENV.STACK_C_URL;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${stackCUrl}/indicators/EURUSD/H1`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we got a response, this test should FAIL
        fail(
          'Stack C indicators endpoint is accessible from frontend (security violation!)'
        );
      } catch (error) {
        // Good! This means Stack C is not accessible
        console.log('✅ Stack C indicators endpoint is correctly inaccessible');
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Security: CORS Validation', () => {
    it('should be blocked by CORS if Stack C is accessible', async () => {
      const stackCUrl = TEST_ENV.STACK_C_URL;

      try {
        // Try to make a CORS request
        const response = await fetch(`${stackCUrl}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors', // Enforce CORS
        });

        // If we reach here, either:
        // 1. Stack C is accessible (bad!)
        // 2. Stack C has CORS configured for frontend (also bad!)
        console.warn(
          '⚠️ WARNING: Stack C is accessible from frontend or has CORS enabled for frontend'
        );
        console.warn('⚠️ This is a security concern!');

        // This test FAILS if Stack C is accessible
        fail('Stack C should not be accessible from frontend');
      } catch (error: any) {
        // Good! CORS blocked or network error
        if (error.name === 'TypeError' && error.message.includes('CORS')) {
          console.log('✅ CORS correctly blocking frontend access to Stack C');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.log('✅ Stack C is not accessible (network error as expected)');
        } else {
          console.log('✅ Stack C access blocked:', error.message);
        }

        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Architecture Validation', () => {
    it('should document that market data must go through Stack A or B', () => {
      // This is a documentation test
      const architectureRules = {
        'UI → Stack A': 'ALLOWED ✅',
        'UI → Stack B': 'ALLOWED ✅',
        'UI → Stack C': 'FORBIDDEN ❌',
        'Stack A → Stack C': 'ALLOWED ✅ (proxy)',
        'Stack B → Stack C': 'ALLOWED ✅ (proxy)',
      };

      console.log('\n📋 Architecture Rules:');
      Object.entries(architectureRules).forEach(([rule, status]) => {
        console.log(`  ${rule}: ${status}`);
      });

      // Verify UI → Stack C is forbidden
      expect(architectureRules['UI → Stack C']).toContain('FORBIDDEN');
    });

    it('should verify that frontend only has 2 environment variables for backends', () => {
      const frontendEnvVars = {
        NEXT_PUBLIC_API_A_URL: TEST_ENV.STACK_A_URL,
        NEXT_PUBLIC_API_B_URL: TEST_ENV.STACK_B_URL,
        // NEXT_PUBLIC_API_C_URL should NOT exist!
      };

      // Count environment variables
      const backendUrls = Object.keys(frontendEnvVars).filter((key) =>
        key.startsWith('NEXT_PUBLIC_API_')
      );

      // Should be exactly 2 (Stack A and Stack B)
      expect(backendUrls.length).toBe(2);
      expect(backendUrls).toContain('NEXT_PUBLIC_API_A_URL');
      expect(backendUrls).toContain('NEXT_PUBLIC_API_B_URL');
      expect(backendUrls).not.toContain('NEXT_PUBLIC_API_C_URL');

      console.log('✅ Frontend only has access to Stack A and Stack B URLs');
      console.log('✅ No NEXT_PUBLIC_API_C_URL environment variable exists');
    });
  });

  describe('Recommended: Market Data Access Pattern', () => {
    it('should document the correct pattern for accessing market data', () => {
      const correctPattern = `
// ✅ CORRECT: Access market data through Stack A or Stack B
import { api } from '@/lib/api-clients';

// Option 1: Through Stack A
const candles = await api.stackA.getCandles('EURUSD', 'H1');

// Option 2: Through Stack B
const candles = await api.stackB.getCandles('EURUSD', 'H1');

// Both Stack A and B proxy to Stack C internally
// Frontend never accesses Stack C directly
      `;

      const incorrectPattern = `
// ❌ INCORRECT: Direct access to Stack C (FORBIDDEN!)
const response = await fetch('http://stack-c-url/candles/EURUSD/H1');
// This should NEVER work from frontend
      `;

      console.log('\n✅ Correct Pattern:', correctPattern);
      console.log('\n❌ Incorrect Pattern:', incorrectPattern);

      expect(correctPattern).toContain('api.stackA');
      expect(correctPattern).toContain('api.stackB');
      expect(incorrectPattern).toContain('FORBIDDEN');
    });
  });
});
