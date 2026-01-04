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

    // Pricing page elements - Badge has bg-blue-600 for PRO, bg-green-500 for FREE
    // Cards use Card component with border classes
    this.pricingTitle = page.getByRole('heading', { name: 'Choose Your Plan' });
    // FREE card doesn't have extra border, PRO card has border-4 border-blue-600
    this.freePlanCard = page.locator('div:has(> div > span:has-text("FREE TIER"))').first();
    this.proPlanCard = page.locator('div.border-blue-600:has(span:has-text("PRO TIER"))').first();
    this.proUpgradeButton = page.locator('button:has-text("Start 7-Day Trial"), button:has-text("Start PRO Trial")');
    this.currentPlanBadge = page.locator('button:has-text("Current Plan")');

    // Plan details - use text selectors, scoped to PRO card
    // PRO card has border-blue-600, price is in .text-6xl
    this.proPriceDisplay = page.locator('.border-blue-600 .text-6xl').first();
    this.proFeaturesList = page.locator('ul:has(.text-blue-600)');

    // Discount code elements - on /checkout page (dLocal flow)
    this.discountCodeInput = page.locator('#discount-code, input[placeholder="Enter code"]');
    this.applyDiscountButton = page.locator('button:has-text("Apply")');
    // Discount validation messages - component shows "X% discount will be applied!" or error message
    this.discountAppliedBadge = page.locator('.text-green-600:has-text("discount")');
    this.discountError = page.locator('#discount-code-status.text-red-600, p.text-red-600');
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
    // Wait for DOM to be ready, then wait for specific elements
    // Avoid 'networkidle' as it times out with persistent connections
    await this.page.waitForLoadState('domcontentloaded');
    await this.pricingTitle.waitFor({ state: 'visible', timeout: 10000 });
    // Wait for at least one pricing card to be visible
    await this.page.locator('span:has-text("PRO TIER"), span:has-text("FREE TIER")').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Navigate to dLocal checkout page (for discount code tests)
   */
  async gotoDLocalCheckout(country: string = 'IN'): Promise<void> {
    await this.page.goto(`/checkout?country=${country}&plan=MONTHLY`);
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for checkout form to load
    await this.page.locator('text=Complete Your Purchase').waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Click PRO upgrade button
   */
  async clickUpgradeToPro(): Promise<void> {
    await this.proUpgradeButton.click();
  }

  /**
   * Get PRO plan price from pricing page
   */
  async getProPrice(): Promise<string> {
    // Wait for price to be rendered (hook data may load async)
    await this.proPriceDisplay.waitFor({ state: 'visible', timeout: 5000 });
    return (await this.proPriceDisplay.textContent()) || '';
  }

  /**
   * Enter and apply discount code on /checkout page
   * Note: Discount codes are validated on blur/enter, not via Apply button
   */
  async applyDiscountCode(code: string): Promise<void> {
    await this.discountCodeInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.discountCodeInput.fill(code);
    // Trigger validation by pressing Enter or clicking away
    await this.discountCodeInput.press('Enter');
    // Wait for validation response
    await this.page.waitForTimeout(1500);
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
