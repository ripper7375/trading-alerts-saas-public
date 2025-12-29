/**
 * Settings Page Object
 *
 * Encapsulates all interactions with the settings page for E2E tests.
 *
 * @module e2e/pages/settings.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  // Tabs
  readonly profileTab: Locator;
  readonly subscriptionTab: Locator;
  readonly notificationsTab: Locator;
  readonly securityTab: Locator;

  // Profile section
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly saveProfileButton: Locator;
  readonly avatarUpload: Locator;

  // Subscription section
  readonly currentPlanDisplay: Locator;
  readonly subscriptionStatus: Locator;
  readonly renewalDate: Locator;
  readonly cancelSubscriptionButton: Locator;
  readonly upgradeButton: Locator;
  readonly paymentMethod: Locator;

  // Cancel modal
  readonly cancelModal: Locator;
  readonly cancelConfirmButton: Locator;
  readonly cancelDismissButton: Locator;
  readonly cancellationReason: Locator;

  // Notifications section
  readonly emailNotificationsToggle: Locator;
  readonly pushNotificationsToggle: Locator;
  readonly alertNotificationsToggle: Locator;
  readonly marketingEmailsToggle: Locator;

  // Security section
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly changePasswordButton: Locator;
  readonly twoFactorToggle: Locator;
  readonly deleteAccountButton: Locator;

  // Messages
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Tabs
    this.profileTab = page.locator('[data-testid="settings-profile-tab"]');
    this.subscriptionTab = page.locator(
      '[data-testid="settings-subscription-tab"]'
    );
    this.notificationsTab = page.locator(
      '[data-testid="settings-notifications-tab"]'
    );
    this.securityTab = page.locator('[data-testid="settings-security-tab"]');

    // Profile section
    this.nameInput = page.locator('[data-testid="profile-name-input"]');
    this.emailInput = page.locator('[data-testid="profile-email-input"]');
    this.saveProfileButton = page.locator('[data-testid="save-profile-button"]');
    this.avatarUpload = page.locator('[data-testid="avatar-upload"]');

    // Subscription section
    this.currentPlanDisplay = page.locator('[data-testid="current-plan"]');
    this.subscriptionStatus = page.locator('[data-testid="subscription-status"]');
    this.renewalDate = page.locator('[data-testid="renewal-date"]');
    this.cancelSubscriptionButton = page.locator(
      '[data-testid="cancel-subscription-button"]'
    );
    this.upgradeButton = page.locator('[data-testid="upgrade-button"]');
    this.paymentMethod = page.locator('[data-testid="payment-method"]');

    // Cancel modal
    this.cancelModal = page.locator('[data-testid="cancel-modal"]');
    this.cancelConfirmButton = page.locator(
      '[data-testid="confirm-cancel-button"]'
    );
    this.cancelDismissButton = page.locator(
      '[data-testid="dismiss-cancel-button"]'
    );
    this.cancellationReason = page.locator(
      '[data-testid="cancellation-reason"]'
    );

    // Notifications section
    this.emailNotificationsToggle = page.locator(
      '[data-testid="email-notifications-toggle"]'
    );
    this.pushNotificationsToggle = page.locator(
      '[data-testid="push-notifications-toggle"]'
    );
    this.alertNotificationsToggle = page.locator(
      '[data-testid="alert-notifications-toggle"]'
    );
    this.marketingEmailsToggle = page.locator(
      '[data-testid="marketing-emails-toggle"]'
    );

    // Security section
    this.currentPasswordInput = page.locator(
      '[data-testid="current-password-input"]'
    );
    this.newPasswordInput = page.locator('[data-testid="new-password-input"]');
    this.confirmPasswordInput = page.locator(
      '[data-testid="confirm-password-input"]'
    );
    this.changePasswordButton = page.locator(
      '[data-testid="change-password-button"]'
    );
    this.twoFactorToggle = page.locator('[data-testid="two-factor-toggle"]');
    this.deleteAccountButton = page.locator(
      '[data-testid="delete-account-button"]'
    );

    // Messages
    this.successMessage = page.locator('[data-testid="success-message"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  /**
   * Navigate to settings page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/settings');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.profileTab.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Go to subscription tab
   */
  async goToSubscriptionTab(): Promise<void> {
    await this.subscriptionTab.click();
    await this.currentPlanDisplay.waitFor({ state: 'visible' });
  }

  /**
   * Go to notifications tab
   */
  async goToNotificationsTab(): Promise<void> {
    await this.notificationsTab.click();
    await this.emailNotificationsToggle.waitFor({ state: 'visible' });
  }

  /**
   * Go to security tab
   */
  async goToSecurityTab(): Promise<void> {
    await this.securityTab.click();
    await this.currentPasswordInput.waitFor({ state: 'visible' });
  }

  /**
   * Get current plan name
   */
  async getCurrentPlan(): Promise<string> {
    return (await this.currentPlanDisplay.textContent()) || '';
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(): Promise<string> {
    return (await this.subscriptionStatus.textContent()) || '';
  }

  /**
   * Get renewal date
   */
  async getRenewalDate(): Promise<string> {
    return (await this.renewalDate.textContent()) || '';
  }

  /**
   * Check if cancel button is visible (only for active subscriptions)
   */
  async isCancelButtonVisible(): Promise<boolean> {
    return await this.cancelSubscriptionButton.isVisible();
  }

  /**
   * Start cancellation flow
   */
  async clickCancelSubscription(): Promise<void> {
    await this.cancelSubscriptionButton.click();
    await this.cancelModal.waitFor({ state: 'visible' });
  }

  /**
   * Select cancellation reason
   */
  async selectCancellationReason(reason: string): Promise<void> {
    await this.cancellationReason.selectOption(reason);
  }

  /**
   * Confirm cancellation
   */
  async confirmCancellation(): Promise<void> {
    await this.cancelConfirmButton.click();
    await this.successMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Dismiss cancellation modal
   */
  async dismissCancellation(): Promise<void> {
    await this.cancelDismissButton.click();
    await this.cancelModal.waitFor({ state: 'hidden' });
  }

  /**
   * Complete cancellation flow
   */
  async cancelSubscription(reason?: string): Promise<void> {
    await this.goToSubscriptionTab();
    await this.clickCancelSubscription();
    if (reason) {
      await this.selectCancellationReason(reason);
    }
    await this.confirmCancellation();
  }

  /**
   * Update profile name
   */
  async updateName(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.saveProfileButton.click();
    await this.successMessage.waitFor({ state: 'visible' });
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.goToSecurityTab();
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.changePasswordButton.click();
  }

  /**
   * Toggle email notifications
   */
  async toggleEmailNotifications(): Promise<void> {
    await this.goToNotificationsTab();
    await this.emailNotificationsToggle.click();
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string | null> {
    if (await this.successMessage.isVisible()) {
      return await this.successMessage.textContent();
    }
    return null;
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
}
