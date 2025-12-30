/**
 * Login Page Object
 *
 * Encapsulates all interactions with the login page for E2E tests.
 *
 * @module e2e/pages/login.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly rememberMeCheckbox: Locator;

  // OAuth buttons
  readonly googleButton: Locator;
  readonly twitterButton: Locator;
  readonly linkedinButton: Locator;

  // Links
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form elements
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.rememberMeCheckbox = page.locator('#rememberMe');

    // OAuth buttons - using text-based locators
    this.googleButton = page.locator('button:has-text("Google")');
    this.twitterButton = page.locator('button:has-text("Login with X")');
    this.linkedinButton = page.locator('button:has-text("LinkedIn")');

    // Links
    this.forgotPasswordLink = page.locator('a[href*="forgot-password"]');
    this.registerLink = page.locator('a[href*="register"]');

    // Messages - login form shows errors in an alert div with border-l-4 class
    this.errorMessage = page.locator('.border-l-4 p').first();
    this.successMessage = page.locator('text=Welcome back');
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.emailInput.waitFor({ state: 'visible' });
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.emailInput.press('Tab');
    await this.passwordInput.fill(password);
    await this.passwordInput.press('Tab');
    // Wait for validation
    await this.page.waitForTimeout(200);
    await this.submitButton.click();
  }

  /**
   * Login and wait for dashboard redirect
   */
  async loginAndWaitForDashboard(
    email: string,
    password: string
  ): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });
  }

  /**
   * Login and expect error
   */
  async loginAndExpectError(
    email: string,
    password: string,
    expectedError?: string
  ): Promise<void> {
    await this.login(email, password);
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });

    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * Click Google OAuth login
   */
  async loginWithGoogle(): Promise<void> {
    await this.googleButton.click();
    // OAuth flow will redirect to Google
    await this.page.waitForURL(/accounts\.google\.com/);
  }

  /**
   * Click Twitter OAuth login
   */
  async loginWithTwitter(): Promise<void> {
    await this.twitterButton.click();
    // OAuth flow will redirect to Twitter
    await this.page.waitForURL(/twitter\.com|x\.com/);
  }

  /**
   * Click LinkedIn OAuth login
   */
  async loginWithLinkedIn(): Promise<void> {
    await this.linkedinButton.click();
    // OAuth flow will redirect to LinkedIn
    await this.page.waitForURL(/linkedin\.com/);
  }

  /**
   * Navigate to forgot password page
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('**/forgot-password');
  }

  /**
   * Navigate to register page
   */
  async goToRegister(): Promise<void> {
    await this.registerLink.click();
    await this.page.waitForURL('**/register');
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Check if login form is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.emailInput.isVisible();
  }
}
