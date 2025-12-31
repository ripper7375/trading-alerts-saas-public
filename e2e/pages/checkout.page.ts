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

    // Pricing page elements - using text and CSS based selectors from pricing page
    this.pricingTitle = page.locator('h1:has-text("Choose Your Plan")');
    this.freePlanCard = page.locator('.inline-flex:has-text("FREE TIER")').locator('xpath=ancestor::div[contains(@class, "rounded-lg")]');
    this.proPlanCard = page.locator('.inline-flex:has-text("PRO TIER")').locator('xpath=ancestor::div[contains(@class, "rounded-lg")]');
    this.proUpgradeButton = page.locator('button:has-text("Start 7-Day Trial"), button:has-text("Start PRO Trial")');
    this.currentPlanBadge = page.locator('button:has-text("Current Plan")');

    // Plan details - use text selectors
    this.proPriceDisplay = page.locator('.text-6xl').filter({ hasText: '$' });
    this.proFeaturesList = page.locator('ul:has(.text-blue-600)');

    // Discount code elements - using text/placeholder based selectors
    this.discountCodeInput = page.locator('input[placeholder*="code"], input[name="code"]');
    this.applyDiscountButton = page.locator('button:has-text("Apply")');
    this.discountAppliedBadge = page.locator('text=Discount Applied, text=discount active').first();
    this.discountError = page.locator('.text-red-600, .text-red-500').filter({ hasText: /invalid|expired/i });
    this.originalPrice = page.locator('.line-through');
    this.discountedPrice = page.locator('.text-green-600').filter({ hasText: '$' });
    this.discountAmount = page.locator('text=/Save \\$/');

    // dLocal elements - using text and class based selectors
    this.countryDetectedBadge = page.locator('.inline-flex:has-text("LOCAL PAYMENTS")');
    this.planSelector = page.locator('text=Choose a plan, text=Select plan').first();
    this.threeDayPlanOption = page.locator('button:has-text("3-Day Trial"), a:has-text("3-Day Trial")');
    this.monthlyPlanOption = page.locator('button:has-text("Pay with Local Methods")');
    this.paymentMethodSelector = page.locator('text=Payment Method').first();
    this.paymentMethodOptions = page.locator('li:has(.text-purple-600)');
    this.localPriceDisplay = page.locator('.text-purple-600').filter({ hasText: '$' });
    this.currencyDisplay = page.locator('text=/INR|NGN|IDR|THB/');
    this.proceedToPaymentButton = page.locator('button:has-text("Proceed"), button:has-text("Pay")');

    // Stripe elements
    this.stripeCheckoutButton = page.locator('button:has-text("Checkout"), button:has-text("Pay")');

    // Messages
    this.errorMessage = page.locator('.text-red-700, .text-red-600').first();
    this.successMessage = page.locator('text=Success, text=Thank you').first();
    this.loadingSpinner = page.locator('.animate-spin');
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
