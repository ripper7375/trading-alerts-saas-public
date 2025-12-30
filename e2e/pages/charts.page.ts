/**
 * Charts Page Object
 *
 * Encapsulates all interactions with the charts page for E2E tests.
 *
 * @module e2e/pages/charts.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class ChartsPage {
  readonly page: Page;

  // Page elements
  readonly pageTitle: Locator;
  readonly chartContainer: Locator;
  readonly symbolSelector: Locator;
  readonly timeframeSelector: Locator;
  readonly chartCanvas: Locator;

  // Symbol dropdown
  readonly symbolOptions: Locator;
  readonly symbolSearchInput: Locator;

  // Timeframe options
  readonly timeframeOptions: Locator;

  // Chart controls
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly resetZoomButton: Locator;
  readonly fullscreenButton: Locator;

  // Price display
  readonly currentPrice: Locator;
  readonly priceChange: Locator;
  readonly priceChangePercent: Locator;

  // Loading states
  readonly loadingSpinner: Locator;
  readonly chartError: Locator;

  // Tier restriction elements
  readonly upgradePrompt: Locator;
  readonly tierRestrictionMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page elements
    this.pageTitle = page.locator('[data-testid="charts-title"]');
    this.chartContainer = page.locator('[data-testid="chart-container"]');
    this.symbolSelector = page.locator('[data-testid="symbol-selector"]');
    this.timeframeSelector = page.locator('[data-testid="timeframe-selector"]');
    this.chartCanvas = page.locator('[data-testid="chart-canvas"]');

    // Symbol dropdown
    this.symbolOptions = page.locator('[data-testid="symbol-option"]');
    this.symbolSearchInput = page.locator('[data-testid="symbol-search"]');

    // Timeframe options
    this.timeframeOptions = page.locator('[data-testid="timeframe-option"]');

    // Chart controls
    this.zoomInButton = page.locator('[data-testid="zoom-in-button"]');
    this.zoomOutButton = page.locator('[data-testid="zoom-out-button"]');
    this.resetZoomButton = page.locator('[data-testid="reset-zoom-button"]');
    this.fullscreenButton = page.locator('[data-testid="fullscreen-button"]');

    // Price display
    this.currentPrice = page.locator('[data-testid="current-price"]');
    this.priceChange = page.locator('[data-testid="price-change"]');
    this.priceChangePercent = page.locator(
      '[data-testid="price-change-percent"]'
    );

    // Loading states
    this.loadingSpinner = page.locator('[data-testid="chart-loading"]');
    this.chartError = page.locator('[data-testid="chart-error"]');

    // Tier restriction elements
    this.upgradePrompt = page.locator('[data-testid="upgrade-prompt"]');
    this.tierRestrictionMessage = page.locator(
      '[data-testid="tier-restriction-message"]'
    );
  }

  /**
   * Navigate to charts page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/charts');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.symbolSelector.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Wait for chart to render
   */
  async waitForChartRender(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
    await this.chartCanvas.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get available symbols
   */
  async getAvailableSymbols(): Promise<string[]> {
    await this.symbolSelector.click();
    const options = await this.symbolOptions.allTextContents();
    await this.page.keyboard.press('Escape');
    return options;
  }

  /**
   * Get available timeframes
   */
  async getAvailableTimeframes(): Promise<string[]> {
    await this.timeframeSelector.click();
    const options = await this.timeframeOptions.allTextContents();
    await this.page.keyboard.press('Escape');
    return options;
  }

  /**
   * Select a symbol
   */
  async selectSymbol(symbol: string): Promise<void> {
    await this.symbolSelector.click();
    await this.page
      .locator(`[data-testid="symbol-option"]:has-text("${symbol}")`)
      .click();
    await this.waitForChartRender();
  }

  /**
   * Select a timeframe
   */
  async selectTimeframe(timeframe: string): Promise<void> {
    await this.timeframeSelector.click();
    await this.page
      .locator(`[data-testid="timeframe-option"]:has-text("${timeframe}")`)
      .click();
    await this.waitForChartRender();
  }

  /**
   * Try to select a restricted symbol (for FREE users)
   */
  async trySelectRestrictedSymbol(symbol: string): Promise<void> {
    await this.symbolSelector.click();
    const option = this.page.locator(
      `[data-testid="symbol-option"]:has-text("${symbol}")`
    );

    // Check if option is disabled/locked
    const isDisabled = await option.getAttribute('data-disabled');
    if (isDisabled === 'true') {
      await option.click();
      // Should show upgrade prompt
      await this.upgradePrompt.waitFor({ state: 'visible' });
    } else {
      await option.click();
    }
  }

  /**
   * Try to select a restricted timeframe (for FREE users)
   */
  async trySelectRestrictedTimeframe(timeframe: string): Promise<void> {
    await this.timeframeSelector.click();
    const option = this.page.locator(
      `[data-testid="timeframe-option"]:has-text("${timeframe}")`
    );

    // Check if option is disabled/locked
    const isDisabled = await option.getAttribute('data-disabled');
    if (isDisabled === 'true') {
      await option.click();
      // Should show upgrade prompt
      await this.upgradePrompt.waitFor({ state: 'visible' });
    } else {
      await option.click();
    }
  }

  /**
   * Get current selected symbol
   */
  async getCurrentSymbol(): Promise<string> {
    return (await this.symbolSelector.textContent()) || '';
  }

  /**
   * Get current selected timeframe
   */
  async getCurrentTimeframe(): Promise<string> {
    return (await this.timeframeSelector.textContent()) || '';
  }

  /**
   * Get current price displayed
   */
  async getCurrentPrice(): Promise<string> {
    return (await this.currentPrice.textContent()) || '';
  }

  /**
   * Get price change value
   */
  async getPriceChange(): Promise<string> {
    return (await this.priceChange.textContent()) || '';
  }

  /**
   * Check if chart is visible
   */
  async isChartVisible(): Promise<boolean> {
    return await this.chartCanvas.isVisible();
  }

  /**
   * Check if chart error is displayed
   */
  async hasChartError(): Promise<boolean> {
    return await this.chartError.isVisible();
  }

  /**
   * Get chart error message
   */
  async getChartErrorMessage(): Promise<string | null> {
    if (await this.chartError.isVisible()) {
      return await this.chartError.textContent();
    }
    return null;
  }

  /**
   * Check if upgrade prompt is visible
   */
  async isUpgradePromptVisible(): Promise<boolean> {
    return await this.upgradePrompt.isVisible();
  }

  /**
   * Zoom in on chart
   */
  async zoomIn(): Promise<void> {
    await this.zoomInButton.click();
  }

  /**
   * Zoom out on chart
   */
  async zoomOut(): Promise<void> {
    await this.zoomOutButton.click();
  }

  /**
   * Reset chart zoom
   */
  async resetZoom(): Promise<void> {
    await this.resetZoomButton.click();
  }

  /**
   * Enter fullscreen mode
   */
  async enterFullscreen(): Promise<void> {
    await this.fullscreenButton.click();
  }

  /**
   * Search for symbol
   */
  async searchSymbol(query: string): Promise<void> {
    await this.symbolSelector.click();
    await this.symbolSearchInput.fill(query);
  }

  /**
   * Wait for real-time price update
   */
  async waitForPriceUpdate(timeout: number = 30000): Promise<void> {
    const initialPrice = await this.getCurrentPrice();
    await this.page.waitForFunction(
      (initial) => {
        const current = document.querySelector(
          '[data-testid="current-price"]'
        )?.textContent;
        return current !== initial;
      },
      initialPrice,
      { timeout }
    );
  }
}
