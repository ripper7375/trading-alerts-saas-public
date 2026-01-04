/**
 * Register Page Object
 *
 * Encapsulates all interactions with the registration page for E2E tests.
 *
 * @module e2e/pages/register.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;

  // Form elements
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;

  // OAuth buttons
  readonly googleButton: Locator;
  readonly twitterButton: Locator;
  readonly linkedinButton: Locator;

  // Links
  readonly loginLink: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly validationErrors: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form elements
    this.nameInput = page.locator('#name');
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.termsCheckbox = page.locator('#terms');
    this.submitButton = page.locator('button[type="submit"]');

    // OAuth buttons - using text-based locators
    this.googleButton = page.locator('button:has-text("Google")');
    this.twitterButton = page.locator('button:has-text("Login with X")');
    this.linkedinButton = page.locator('button:has-text("LinkedIn")');

    // Links
    this.loginLink = page.locator('a[href*="login"]');

    // Messages - register form shows errors in a div and validation errors in p tags
    this.errorMessage = page.locator('.bg-red-50 .text-red-700, .dark\\:bg-red-900\\/20 .text-red-300');
    this.successMessage = page.locator('text=sent a verification link');
    this.validationErrors = page.locator('.text-red-600.text-sm');
  }

  /**
   * Navigate to register page
   */
  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.emailInput.waitFor({ state: 'visible' });
  }

  /**
   * Fill registration form
   */
  async fillForm(
    name: string,
    email: string,
    password: string,
    confirmPassword?: string
  ): Promise<void> {
    // Clear and fill each field, using blur to trigger validation
    await this.nameInput.clear();
    await this.nameInput.fill(name);
    await this.nameInput.blur();

    await this.emailInput.clear();
    await this.emailInput.fill(email);
    await this.emailInput.blur();

    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
    await this.passwordInput.blur();

    await this.confirmPasswordInput.clear();
    await this.confirmPasswordInput.fill(confirmPassword || password);
    await this.confirmPasswordInput.blur();
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(): Promise<void> {
    await this.termsCheckbox.check();
  }

  /**
   * Submit registration form
   */
  async submit(): Promise<void> {
    // Wait for button to be enabled (form valid)
    await this.submitButton.waitFor({ state: 'visible' });
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        return btn && !btn.disabled;
      },
      { timeout: 5000 }
    );
    await this.submitButton.click();
  }

  /**
   * Complete registration and wait for verification pending page
   */
  async registerAndWaitForVerification(
    name: string,
    email: string,
    password: string
  ): Promise<void> {
    await this.fillForm(name, email, password);
    await this.acceptTerms();
    await this.submit();
    await this.page.waitForURL('**/verify-email/pending', { timeout: 15000 });
  }

  /**
   * Register and expect error
   */
  async registerAndExpectError(
    name: string,
    email: string,
    password: string,
    expectedError?: string
  ): Promise<void> {
    await this.fillForm(name, email, password);
    await this.acceptTerms();
    await this.submit();
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });

    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * Get all validation error messages
   * Waits for errors to appear first (for validation tests)
   */
  async getValidationErrors(): Promise<string[]> {
    // Wait a moment for react-hook-form validation to complete
    await this.page.waitForTimeout(500);
    // Try to wait for at least one error, but don't fail if none
    try {
      await this.validationErrors.first().waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      // No validation errors visible - return empty array
    }
    const errors = await this.validationErrors.allTextContents();
    return errors;
  }

  /**
   * Navigate to login page
   */
  async goToLogin(): Promise<void> {
    await this.loginLink.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * Check if form is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.emailInput.isVisible();
  }
}
