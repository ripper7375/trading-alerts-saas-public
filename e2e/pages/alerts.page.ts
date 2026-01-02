/**
 * Alerts Page Object
 *
 * Encapsulates all interactions with the alerts page for E2E tests.
 *
 * @module e2e/pages/alerts.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class AlertsPage {
  readonly page: Page;

  // Page elements
  readonly pageTitle: Locator;
  readonly createAlertButton: Locator;
  readonly alertsList: Locator;
  readonly alertItems: Locator;
  readonly emptyState: Locator;
  readonly alertLimitWarning: Locator;

  // Create alert form
  readonly alertForm: Locator;
  readonly symbolSelect: Locator;
  readonly timeframeSelect: Locator;
  readonly conditionSelect: Locator;
  readonly priceInput: Locator;
  readonly alertNameInput: Locator;
  readonly submitAlertButton: Locator;
  readonly cancelButton: Locator;

  // Alert item elements (within list)
  readonly alertToggle: Locator;
  readonly alertDeleteButton: Locator;
  readonly alertEditButton: Locator;

  // Filters
  readonly statusFilter: Locator;
  readonly symbolFilter: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly upgradePrompt: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page elements
    this.pageTitle = page.locator('[data-testid="alerts-title"]');
    this.createAlertButton = page.locator('[data-testid="create-alert-button"]');
    this.alertsList = page.locator('[data-testid="alerts-list"]');
    this.alertItems = page.locator('[data-testid="alert-item"]');
    this.emptyState = page.locator('[data-testid="alerts-empty-state"]');
    this.alertLimitWarning = page.locator('[data-testid="alert-limit-warning"]');

    // Create alert form
    this.alertForm = page.locator('[data-testid="alert-form"]');
    this.symbolSelect = page.locator('[data-testid="symbol-select"]');
    this.timeframeSelect = page.locator('[data-testid="timeframe-select"]');
    this.conditionSelect = page.locator('[data-testid="condition-select"]');
    this.priceInput = page.locator('[data-testid="price-input"]');
    this.alertNameInput = page.locator('[data-testid="alert-name-input"]');
    this.submitAlertButton = page.locator('[data-testid="submit-alert-button"]');
    this.cancelButton = page.locator('[data-testid="cancel-button"]');

    // Alert item elements
    this.alertToggle = page.locator('[data-testid="alert-toggle"]');
    this.alertDeleteButton = page.locator('[data-testid="alert-delete-button"]');
    this.alertEditButton = page.locator('[data-testid="alert-edit-button"]');

    // Filters
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.symbolFilter = page.locator('[data-testid="symbol-filter"]');

    // Messages
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.successMessage = page.locator('[data-testid="success-message"]');
    this.upgradePrompt = page.locator('[data-testid="upgrade-prompt"]');
  }

  /**
   * Navigate to alerts page
   */
  async goto(): Promise<void> {
    await this.page.goto('/alerts');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.createAlertButton.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Open create alert form
   */
  async openCreateForm(): Promise<void> {
    await this.createAlertButton.click();
    await this.alertForm.waitFor({ state: 'visible' });
  }

  /**
   * Get alert count
   */
  async getAlertCount(): Promise<number> {
    return await this.alertItems.count();
  }

  /**
   * Get available symbols in dropdown
   */
  async getAvailableSymbols(): Promise<string[]> {
    await this.openCreateForm();
    await this.symbolSelect.click();
    const options = await this.page
      .locator('[data-testid="symbol-option"]')
      .allTextContents();
    await this.page.keyboard.press('Escape');
    return options;
  }

  /**
   * Get available timeframes in dropdown
   */
  async getAvailableTimeframes(): Promise<string[]> {
    await this.openCreateForm();
    await this.timeframeSelect.click();
    const options = await this.page
      .locator('[data-testid="timeframe-option"]')
      .allTextContents();
    await this.page.keyboard.press('Escape');
    return options;
  }

  /**
   * Create a new alert
   */
  async createAlert(
    symbol: string,
    timeframe: string,
    condition: string,
    price: number,
    name?: string
  ): Promise<void> {
    await this.openCreateForm();

    // Select symbol
    await this.symbolSelect.click();
    await this.page
      .locator(`[data-testid="symbol-option"]:has-text("${symbol}")`)
      .click();

    // Select timeframe
    await this.timeframeSelect.click();
    await this.page
      .locator(`[data-testid="timeframe-option"]:has-text("${timeframe}")`)
      .click();

    // Select condition
    await this.conditionSelect.click();
    await this.page
      .locator(`[data-testid="condition-option"]:has-text("${condition}")`)
      .click();

    // Enter price
    await this.priceInput.fill(price.toString());

    // Optional name
    if (name) {
      await this.alertNameInput.fill(name);
    }

    // Submit
    await this.submitAlertButton.click();
  }

  /**
   * Create alert and expect success
   */
  async createAlertAndExpectSuccess(
    symbol: string,
    timeframe: string,
    condition: string,
    price: number,
    name?: string
  ): Promise<void> {
    const initialCount = await this.getAlertCount();
    await this.createAlert(symbol, timeframe, condition, price, name);
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
    await expect(this.alertItems).toHaveCount(initialCount + 1);
  }

  /**
   * Create alert and expect error
   */
  async createAlertAndExpectError(
    symbol: string,
    timeframe: string,
    condition: string,
    price: number,
    expectedError?: string
  ): Promise<void> {
    await this.createAlert(symbol, timeframe, condition, price);
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });

    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * Toggle alert active state
   */
  async toggleAlert(index: number): Promise<void> {
    const alert = this.alertItems.nth(index);
    const toggle = alert.locator('[data-testid="alert-toggle"]');
    await toggle.click();
  }

  /**
   * Delete alert
   */
  async deleteAlert(index: number): Promise<void> {
    const alert = this.alertItems.nth(index);
    const deleteBtn = alert.locator('[data-testid="alert-delete-button"]');
    await deleteBtn.click();

    // Confirm deletion
    const confirmBtn = this.page.locator('[data-testid="confirm-delete"]');
    await confirmBtn.click();
  }

  /**
   * Get alert details by index
   */
  async getAlertDetails(
    index: number
  ): Promise<{
    symbol: string;
    timeframe: string;
    isActive: boolean;
  }> {
    const alert = this.alertItems.nth(index);
    const symbol =
      (await alert.locator('[data-testid="alert-symbol"]').textContent()) || '';
    const timeframe =
      (await alert.locator('[data-testid="alert-timeframe"]').textContent()) ||
      '';
    const toggle = alert.locator('[data-testid="alert-toggle"]');
    const isActive = await toggle.isChecked();

    return { symbol, timeframe, isActive };
  }

  /**
   * Filter alerts by status
   */
  async filterByStatus(status: 'all' | 'active' | 'inactive'): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  /**
   * Filter alerts by symbol
   */
  async filterBySymbol(symbol: string): Promise<void> {
    await this.symbolFilter.selectOption(symbol);
  }

  /**
   * Check if upgrade prompt is visible
   */
  async isUpgradePromptVisible(): Promise<boolean> {
    return await this.upgradePrompt.isVisible();
  }

  /**
   * Check if at alert limit
   */
  async isAtAlertLimit(): Promise<boolean> {
    return await this.alertLimitWarning.isVisible();
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }
}
