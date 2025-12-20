/**
 * dLocal Payment Integration Types
 *
 * Type definitions for dLocal payment processing in supported
 * emerging market countries.
 */

// Payment provider identifier
export type PaymentProvider = 'DLOCAL' | 'STRIPE';

// Supported dLocal countries (8 total)
export type DLocalCountry = 'IN' | 'NG' | 'PK' | 'VN' | 'ID' | 'TH' | 'ZA' | 'TR';

// Corresponding currencies for dLocal countries
export type DLocalCurrency = 'INR' | 'NGN' | 'PKR' | 'VND' | 'IDR' | 'THB' | 'ZAR' | 'TRY';

// Plan types (3-day only for dLocal, monthly for both)
export type PlanType = 'THREE_DAY' | 'MONTHLY';

// Payment status
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

/**
 * Request to create a dLocal payment
 */
export interface DLocalPaymentRequest {
  userId: string;
  amount: number; // USD amount
  currency: DLocalCurrency;
  country: DLocalCountry;
  paymentMethod: string;
  planType: PlanType;
  discountCode?: string;
  email?: string;
  name?: string;
}

/**
 * Response from dLocal payment creation
 */
export interface DLocalPaymentResponse {
  paymentId: string;
  orderId: string;
  paymentUrl: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

/**
 * dLocal webhook payload structure
 */
export interface DLocalWebhookPayload {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
  payment_method_id: string;
  created_date: string;
  approved_date?: string;
  failure_reason?: string;
  payer?: {
    name?: string;
    email?: string;
    document?: string;
  };
}

/**
 * Result of currency conversion
 */
export interface CurrencyConversionResult {
  localAmount: number;
  currency: DLocalCurrency;
  exchangeRate: number;
  usdAmount: number;
}

/**
 * Payment method information
 */
export interface PaymentMethodInfo {
  id: string;
  name: string;
  type: string;
  logo?: string;
}

/**
 * Country configuration
 */
export interface CountryConfig {
  code: DLocalCountry;
  name: string;
  currency: DLocalCurrency;
  paymentMethods: string[];
}

/**
 * Payment creation options
 */
export interface CreatePaymentOptions {
  country: DLocalCountry;
  paymentMethod: string;
  planType: PlanType;
  currency: DLocalCurrency;
  discountCode?: string;
}

/**
 * Payment status response
 */
export interface PaymentStatusResponse {
  id: string;
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  planType: string;
  createdAt: string;
  dLocalStatus?: {
    id: string;
    status: string;
    amount?: number;
    currency?: string;
  };
}
