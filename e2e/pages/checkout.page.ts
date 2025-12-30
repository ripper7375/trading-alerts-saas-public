/**
 * Checkout Page Object
 *
 * Encapsulates all interactions with checkout and pricing pages for E2E tests.
 *
 * @module e2e/pages/checkout.page
 */

import { Page, Locator, expect } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;

  // Pricing page elements
  readonly pricingTitle: Locator;
  readonly freePlanCard: Locator;
  readonly proPlanCard: Locator;
  readonly proUpgradeButton: Locator;
  readonly currentPlanBadge: Locator;

  // Plan details
  readonly proPriceDisplay: Locator;
  readonly proFeaturesList: Locator;

  // Discount code elements
  readonly discountCodeInput: Locator;
  readonly applyDiscountButton: Locator;
  readonly discountAppliedBadge: Locator;
  readonly discountError: Locator;
  readonly originalPrice: Locator;
  readonly discountedPrice: Locator;
  readonly discountAmount: Locator;

  // dLocal elements
  readonly countryDetectedBadge: Locator;
  readonly planSelector: Locator;
  readonly threeDayPlanOption: Locator;
  readonly monthlyPlanOption: Locator;
  readonly paymentMethodSelector: Locator;
  readonly paymentMethodOptions: Locator;
  readonly localPriceDisplay: Locator;
  readonly currencyDisplay: Locator;
  readonly proceedToPaymentButton: Locator;

  // Stripe elements
  readonly stripeCheckoutButton: Locator;

  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Pricing page elements
    this.pricingTitle = page.locator('[data-testid="pricing-title"]');
    this.freePlanCard = page.locator('[data-testid="free-plan-card"]');
    this.proPlanCard = page.locator('[data-testid="pro-plan-card"]');
    this.proUpgradeButton = page.locator('[data-testid="pro-upgrade-button"]');
    this.currentPlanBadge = page.locator('[data-testid="current-plan-badge"]');

    // Plan details
    this.proPriceDisplay = page.locator('[data-testid="pro-price"]');
    this.proFeaturesList = page.locator('[data-testid="pro-features"]');

    // Discount code elements
    this.discountCodeInput = page.locator('[data-testid="discount-code-input"]');
    this.applyDiscountButton = page.locator(
      '[data-testid="apply-discount-button"]'
    );
    this.discountAppliedBadge = page.locator(
      '[data-testid="discount-applied-badge"]'
    );
    this.discountError = page.locator('[data-testid="discount-error"]');
    this.originalPrice = page.locator('[data-testid="original-price"]');
    this.discountedPrice = page.locator('[data-testid="discounted-price"]');
    this.discountAmount = page.locator('[data-testid="discount-amount"]');

    // dLocal elements
    this.countryDetectedBadge = page.locator(
      '[data-testid="country-detected-badge"]'
    );
    this.planSelector = page.locator('[data-testid="plan-selector"]');
    this.threeDayPlanOption = page.locator('[data-testid="three-day-plan"]');
    this.monthlyPlanOption = page.locator('[data-testid="monthly-plan"]');
    this.paymentMethodSelector = page.locator(
      '[data-testid="payment-method-selector"]'
    );
    this.paymentMethodOptions = page.locator(
      '[data-testid="payment-method-option"]'
    );
    this.localPriceDisplay = page.locator('[data-testid="local-price"]');
    this.currencyDisplay = page.locator('[data-testid="currency-display"]');
    this.proceedToPaymentButton = page.locator(
      '[data-testid="proceed-to-payment"]'
    );

    // Stripe elements
    this.stripeCheckoutButton = page.locator(
      '[data-testid="stripe-checkout-button"]'
    );

    // Messages
    this.errorMessage = page.locator('[data-testid="checkout-error"]');
    this.successMessage = page.locator('[data-testid="checkout-success"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
  }

  /**
   * Navigate to pricing page
   */
  async goto(): Promise<void> {
    await this.page.goto('/pricing');
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.proPlanCard.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Click PRO upgrade button
   */
  async clickUpgradeToPro(): Promise<void> {
    await this.proUpgradeButton.click();
  }

  /**
   * Get PRO plan price
   */
  async getProPrice(): Promise<string> {
    return (await this.proPriceDisplay.textContent()) || '';
  }

  /**
   * Enter and apply discount code
   */
  async applyDiscountCode(code: string): Promise<void> {
    await this.discountCodeInput.fill(code);
    await this.applyDiscountButton.click();
    // Wait for validation response
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if discount was applied successfully
   */
  async isDiscountApplied(): Promise<boolean> {
    return await this.discountAppliedBadge.isVisible();
  }

  /**
   * Get discount error message
   */
  async getDiscountError(): Promise<string | null> {
    if (await this.discountError.isVisible()) {
      return await this.discountError.textContent();
    }
    return null;
  }

  /**
   * Get original price (before discount)
   */
  async getOriginalPrice(): Promise<string> {
    return (await this.originalPrice.textContent()) || '';
  }

  /**
   * Get discounted price
   */
  async getDiscountedPrice(): Promise<string> {
    return (await this.discountedPrice.textContent()) || '';
  }

  /**
   * Check if dLocal checkout is shown (for emerging markets)
   */
  async isDLocalCheckout(): Promise<boolean> {
    return await this.countryDetectedBadge.isVisible();
  }

  /**
   * Select 3-day trial plan (dLocal)
   */
  async selectThreeDayPlan(): Promise<void> {
    await this.threeDayPlanOption.click();
  }

  /**
   * Select monthly plan (dLocal)
   */
  async selectMonthlyPlan(): Promise<void> {
    await this.monthlyPlanOption.click();
  }

  /**
   * Get available payment methods (dLocal)
   */
  async getPaymentMethods(): Promise<string[]> {
    const methods = await this.paymentMethodOptions.allTextContents();
    return methods;
  }

  /**
   * Select payment method by name (dLocal)
   */
  async selectPaymentMethod(methodName: string): Promise<void> {
    await this.page
      .locator(`[data-testid="payment-method-option"]:has-text("${methodName}")`)
      .click();
  }

  /**
   * Get local currency price (dLocal)
   */
  async getLocalPrice(): Promise<string> {
    return (await this.localPriceDisplay.textContent()) || '';
  }

  /**
   * Get currency code (dLocal)
   */
  async getCurrency(): Promise<string> {
    return (await this.currencyDisplay.textContent()) || '';
  }

  /**
   * Proceed to payment (dLocal)
   */
  async proceedToPayment(): Promise<void> {
    await this.proceedToPaymentButton.click();
    // Wait for redirect or loading
    await this.loadingSpinner.waitFor({ state: 'visible' });
  }

  /**
   * Start Stripe checkout
   */
  async startStripeCheckout(): Promise<void> {
    await this.stripeCheckoutButton.click();
    // Wait for redirect to Stripe
    await this.page.waitForURL(/checkout\.stripe\.com/);
  }

  /**
   * Complete Stripe test payment
   */
  async completeStripeTestPayment(): Promise<void> {
    // Fill Stripe test card details
    await this.page.waitForSelector('input[name="cardNumber"]');
    await this.page.fill('input[name="cardNumber"]', '4242424242424242');
    await this.page.fill('input[name="cardExpiry"]', '12/30');
    await this.page.fill('input[name="cardCvc"]', '123');
    await this.page.fill('input[name="billingName"]', 'Test User');

    // Submit payment
    await this.page.click('button[data-testid="hosted-payment-submit-button"]');

    // Wait for redirect back to app
    await this.page.waitForURL(/success|dashboard/, { timeout: 30000 });
  }

  /**
   * Check if checkout error is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get checkout error message
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Check if on success page
   */
  async isOnSuccessPage(): Promise<boolean> {
    return this.page.url().includes('success');
  }
}
