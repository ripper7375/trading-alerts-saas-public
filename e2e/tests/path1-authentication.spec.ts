/**
 * Path 1: Login and Authentication E2E Tests
 *
 * Tests the complete authentication flow including:
 * - User registration with email verification
 * - Login with credentials
 * - OAuth login flows
 * - Password reset
 * - Session management
 * - Protected route access
 *
 * @module e2e/tests/path1-authentication
 */

import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_USERS, generateTestEmail, generateTestPassword } from '../utils/test-data';

test.describe('Path 1: Authentication', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Registration Flow', () => {
    test('AUTH-001: New user can register and receives verification email', async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);
      const testEmail = generateTestEmail('register');
      const testPassword = generateTestPassword();

      await registerPage.goto();

      // Fill registration form
      await registerPage.fillForm('Test User', testEmail, testPassword);
      await registerPage.acceptTerms();
      await registerPage.submit();

      // Should redirect to verification pending page
      await expect(page).toHaveURL(/verify-email\/pending/);

      // Verify pending message is displayed
      await expect(
        page.locator('text=sent a verification link')
      ).toBeVisible();
    });

    test('AUTH-002: Registration fails with invalid email format', async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.goto();
      await registerPage.fillForm('Test User', 'invalid-email', 'TestPass123!');
      await registerPage.acceptTerms();
      await registerPage.submit();

      // Should show validation error
      const errors = await registerPage.getValidationErrors();
      expect(errors.some((e) => e.toLowerCase().includes('email'))).toBeTruthy();
    });

    test('AUTH-003: Registration fails with weak password', async ({ page }) => {
      const registerPage = new RegisterPage(page);
      const testEmail = generateTestEmail('weak-pass');

      await registerPage.goto();
      await registerPage.fillForm('Test User', testEmail, '123');
      await registerPage.acceptTerms();
      await registerPage.submit();

      // Should show password validation error
      const errors = await registerPage.getValidationErrors();
      expect(
        errors.some(
          (e) =>
            e.toLowerCase().includes('password') ||
            e.toLowerCase().includes('characters')
        )
      ).toBeTruthy();
    });

    test('AUTH-004: Registration fails with mismatched passwords', async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);
      const testEmail = generateTestEmail('mismatch');

      await registerPage.goto();
      await registerPage.fillForm(
        'Test User',
        testEmail,
        'TestPass123!',
        'DifferentPass123!'
      );
      await registerPage.acceptTerms();
      await registerPage.submit();

      // Should show password mismatch error
      const errors = await registerPage.getValidationErrors();
      expect(errors.some((e) => e.toLowerCase().includes('match'))).toBeTruthy();
    });

    test('AUTH-005: Registration fails with existing email', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.goto();
      await registerPage.fillForm(
        'Test User',
        TEST_USERS.free.email,
        'TestPass123!'
      );
      await registerPage.acceptTerms();
      await registerPage.submit();

      // Should show duplicate email error
      await expect(registerPage.errorMessage).toBeVisible();
      await expect(registerPage.errorMessage).toContainText(/already exists|already registered/i);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Login Flow', () => {
    test('AUTH-006: User can login with valid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Should be on dashboard
      await expect(page).toHaveURL(/dashboard/);

      // User menu should be visible
      await expect(dashboardPage.userMenu).toBeVisible();
    });

    test('AUTH-007: Login fails with invalid password', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndExpectError(
        TEST_USERS.free.email,
        'WrongPassword123!',
        'Invalid credentials'
      );

      // Should remain on login page
      await expect(page).toHaveURL(/login/);
    });

    test('AUTH-008: Login fails with non-existent email', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndExpectError(
        'nonexistent@example.com',
        'TestPass123!',
        'Invalid credentials'
      );
    });

    test('AUTH-009: Login fails for unverified email (credentials)', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndExpectError(
        TEST_USERS.unverified.email,
        TEST_USERS.unverified.password,
        'verify your email'
      );
    });

    test('AUTH-010: Login redirects back to intended destination', async ({
      page,
    }) => {
      // Try to access protected route without auth
      await page.goto('/alerts');

      // Should redirect to login with redirect param
      await expect(page).toHaveURL(/login.*redirect/);

      // Login
      const loginPage = new LoginPage(page);
      await loginPage.login(TEST_USERS.free.email, TEST_USERS.free.password);

      // Should redirect to original destination
      await expect(page).toHaveURL(/alerts/);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OAUTH TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('OAuth Login', () => {
    // SKIP: Requires OAuth config
    test.skip('AUTH-011: Google OAuth button redirects to Google', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();

      // Check Google button exists
      await expect(loginPage.googleButton).toBeVisible();

      // Click should redirect to Google OAuth
      // Note: In CI, we just verify the redirect starts
      const [popup] = await Promise.all([
        page.waitForEvent('popup').catch(() => null),
        loginPage.googleButton.click(),
      ]);

      // Either redirects current page or opens popup
      if (popup) {
        await expect(popup).toHaveURL(/accounts\.google\.com/);
      } else {
        // Wait for navigation
        await page.waitForURL(/accounts\.google\.com|login/, { timeout: 5000 });
      }
    });

    // SKIP: Requires OAuth config
    test.skip('AUTH-012: Twitter OAuth button redirects to Twitter', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await expect(loginPage.twitterButton).toBeVisible();

      // Similar check for Twitter OAuth
      const [popup] = await Promise.all([
        page.waitForEvent('popup').catch(() => null),
        loginPage.twitterButton.click(),
      ]);

      if (popup) {
        await expect(popup).toHaveURL(/twitter\.com|x\.com/);
      }
    });

    // SKIP: Requires OAuth config
    test.skip('AUTH-013: LinkedIn OAuth button redirects to LinkedIn', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await expect(loginPage.linkedinButton).toBeVisible();

      const [popup] = await Promise.all([
        page.waitForEvent('popup').catch(() => null),
        loginPage.linkedinButton.click(),
      ]);

      if (popup) {
        await expect(popup).toHaveURL(/linkedin\.com/);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD RESET TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Password Reset Flow', () => {
    // SKIP: Requires email service
    test.skip('AUTH-014: Can request password reset', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.goToForgotPassword();

      // Should be on forgot password page
      await expect(page).toHaveURL(/forgot-password/);

      // Fill email and submit
      await page.fill('input[type="email"]', TEST_USERS.free.email);
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(page.locator('text=reset link')).toBeVisible({ timeout: 5000 });
    });

    // SKIP: Requires email service
    test.skip('AUTH-015: Password reset with invalid email shows error', async ({
      page,
    }) => {
      await page.goto('/forgot-password');

      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.click('button[type="submit"]');

      // Should show error or generic message (for security)
      // Some apps show success even for non-existent emails
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toContain('forgot-password');
    });

    // SKIP: Requires email service
    test.skip('AUTH-016: Reset password page rejects invalid token', async ({
      page,
    }) => {
      await page.goto('/reset-password?token=invalid-token-12345');

      // Should show error about invalid/expired token
      await expect(
        page.locator('text=invalid|expired').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION MANAGEMENT TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Session Management', () => {
    test('AUTH-017: Session persists across page refresh', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Refresh page
      await page.reload();

      // Should still be authenticated
      await expect(page).toHaveURL(/dashboard/);
      await expect(dashboardPage.userMenu).toBeVisible();
    });

    test('AUTH-018: Logout clears session', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Logout
      await dashboardPage.logout();

      // Should be on login page
      await expect(page).toHaveURL(/login/);

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('AUTH-019: Session includes correct user tier', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login as FREE user
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Check tier badge shows FREE
      const tier = await dashboardPage.getTier();
      expect(tier).toContain('FREE');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROTECTED ROUTES TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Protected Routes', () => {
    test('AUTH-020: Unauthenticated access to dashboard redirects to login', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/login/);
    });

    test('AUTH-021: Unauthenticated access to alerts redirects to login', async ({
      page,
    }) => {
      await page.goto('/alerts');
      await expect(page).toHaveURL(/login/);
    });

    test('AUTH-022: Unauthenticated access to settings redirects to login', async ({
      page,
    }) => {
      await page.goto('/settings');
      await expect(page).toHaveURL(/login/);
    });

    test('AUTH-023: Admin routes blocked for non-admin users', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      // Login as regular user
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Try to access admin route
      await page.goto('/admin');

      // Should be redirected or show forbidden
      const url = page.url();
      expect(url).not.toContain('/admin');
    });

    test('AUTH-024: Affiliate routes blocked for non-affiliate users', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      // Login as regular user
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Try to access affiliate dashboard
      await page.goto('/affiliate/dashboard');

      // Should be redirected or show forbidden
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).not.toMatch(/affiliate\/dashboard/);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL VERIFICATION TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Email Verification', () => {
    test('AUTH-025: Invalid verification token shows error', async ({
      page,
    }) => {
      await page.goto('/verify-email?token=invalid-token-xyz');

      // Should show error message
      await expect(
        page.locator('text=invalid|expired').first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('AUTH-026: Verification pending page has resend option', async ({
      page,
    }) => {
      await page.goto('/verify-email/pending');

      // Should have resend button
      await expect(page.locator('button:has-text("resend")').first()).toBeVisible();
    });
  });
});
