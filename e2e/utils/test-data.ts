/**
 * Test Data Generators for E2E Tests
 *
 * Provides utilities for generating test data, mock responses, and test constants.
 *
 * @module e2e/utils/test-data
 */

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@trading-alerts.test`;
}

/**
 * Generate a secure test password
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now()}!`;
}

/**
 * Test user configurations
 */
export const TEST_USERS = {
  free: {
    email: 'free-test@trading-alerts.test',
    password: 'TestPassword123!',
    name: 'Free Test User',
    tier: 'FREE' as const,
  },
  pro: {
    email: 'pro-test@trading-alerts.test',
    password: 'TestPassword123!',
    name: 'Pro Test User',
    tier: 'PRO' as const,
  },
  admin: {
    email: 'admin-test@trading-alerts.test',
    password: 'AdminPassword123!',
    name: 'Admin Test User',
    role: 'ADMIN' as const,
  },
  affiliate: {
    email: 'affiliate-test@trading-alerts.test',
    password: 'AffiliatePassword123!',
    name: 'Affiliate Test User',
    isAffiliate: true,
  },
  unverified: {
    email: 'unverified@trading-alerts.test',
    password: 'TestPassword123!',
    name: 'Unverified User',
    emailVerified: false,
  },
};

/**
 * Test discount codes
 */
export const TEST_CODES = {
  valid10: {
    code: 'TESTCODE10',
    discountPercent: 10,
    commissionPercent: 20,
    status: 'ACTIVE',
  },
  valid20: {
    code: 'TESTCODE20',
    discountPercent: 20,
    commissionPercent: 20,
    status: 'ACTIVE',
  },
  expired: {
    code: 'EXPIREDCODE',
    discountPercent: 10,
    commissionPercent: 20,
    status: 'EXPIRED',
  },
  used: {
    code: 'USEDCODE',
    discountPercent: 10,
    commissionPercent: 20,
    status: 'USED',
  },
  suspendedAffiliate: {
    code: 'SUSPENDEDAFF',
    discountPercent: 10,
    commissionPercent: 20,
    status: 'ACTIVE',
    affiliateStatus: 'SUSPENDED',
  },
};

/**
 * Trading symbols configuration
 */
export const SYMBOLS = {
  free: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'],
  proOnly: [
    'GBPUSD',
    'AUDUSD',
    'USDCAD',
    'NZDUSD',
    'USDCHF',
    'EURGBP',
    'EURJPY',
    'GBPJPY',
    'XAGUSD',
    'US100',
  ],
  all: [
    'BTCUSD',
    'EURUSD',
    'USDJPY',
    'US30',
    'XAUUSD',
    'GBPUSD',
    'AUDUSD',
    'USDCAD',
    'NZDUSD',
    'USDCHF',
    'EURGBP',
    'EURJPY',
    'GBPJPY',
    'XAGUSD',
    'US100',
  ],
};

/**
 * Timeframes configuration
 */
export const TIMEFRAMES = {
  free: ['H1', 'H4', 'D1'],
  proOnly: ['M5', 'M15', 'M30', 'H2', 'H8', 'H12'],
  all: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'],
};

/**
 * Tier limits
 */
export const TIER_LIMITS = {
  FREE: {
    maxAlerts: 5,
    maxWatchlistItems: 5,
    symbolCount: 5,
    timeframeCount: 3,
  },
  PRO: {
    maxAlerts: 20,
    maxWatchlistItems: 50,
    symbolCount: 15,
    timeframeCount: 9,
  },
};

/**
 * Pricing configuration
 */
export const PRICING = {
  PRO_MONTHLY: 29.0,
  THREE_DAY_TRIAL: 1.99,
  CURRENCY: 'USD',
};

/**
 * dLocal countries configuration
 */
export const DLOCAL_COUNTRIES = {
  IN: {
    country: 'IN',
    currency: 'INR',
    paymentMethods: ['UPI', 'Paytm', 'PhonePe'],
  },
  NG: {
    country: 'NG',
    currency: 'NGN',
    paymentMethods: ['Bank Transfer'],
  },
  PK: {
    country: 'PK',
    currency: 'PKR',
    paymentMethods: ['JazzCash', 'Easypaisa'],
  },
  VN: {
    country: 'VN',
    currency: 'VND',
    paymentMethods: ['MoMo', 'VNPay'],
  },
  ID: {
    country: 'ID',
    currency: 'IDR',
    paymentMethods: ['OVO', 'GoPay', 'Dana'],
  },
  TH: {
    country: 'TH',
    currency: 'THB',
    paymentMethods: ['TrueMoney', 'Thai QR'],
  },
  ZA: {
    country: 'ZA',
    currency: 'ZAR',
    paymentMethods: ['Instant EFT'],
  },
  TR: {
    country: 'TR',
    currency: 'TRY',
    paymentMethods: ['Bank Transfer'],
  },
};

/**
 * Stripe test cards
 */
export const STRIPE_TEST_CARDS = {
  success: {
    number: '4242424242424242',
    expiry: '12/30',
    cvc: '123',
    name: 'Test User',
  },
  declined: {
    number: '4000000000000002',
    expiry: '12/30',
    cvc: '123',
    name: 'Test User',
  },
  insufficientFunds: {
    number: '4000000000009995',
    expiry: '12/30',
    cvc: '123',
    name: 'Test User',
  },
  requiresAuth: {
    number: '4000002500003155',
    expiry: '12/30',
    cvc: '123',
    name: 'Test User',
  },
};

/**
 * Generate mock alert data
 */
export function generateAlertData(
  overrides: Partial<{
    symbol: string;
    timeframe: string;
    condition: string;
    price: number;
    name: string;
  }> = {}
): {
  symbol: string;
  timeframe: string;
  condition: string;
  price: number;
  name: string;
} {
  return {
    symbol: 'BTCUSD',
    timeframe: 'H1',
    condition: 'PRICE_ABOVE',
    price: 50000,
    name: `Test Alert ${Date.now()}`,
    ...overrides,
  };
}

/**
 * Generate mock notification data
 */
export function generateNotificationData(
  overrides: Partial<{
    type: string;
    title: string;
    message: string;
    priority: string;
  }> = {}
): {
  type: string;
  title: string;
  message: string;
  priority: string;
} {
  return {
    type: 'ALERT',
    title: 'Price Alert Triggered',
    message: 'BTCUSD has reached your target price',
    priority: 'HIGH',
    ...overrides,
  };
}

/**
 * Calculate expected discount
 */
export function calculateDiscount(
  originalPrice: number,
  discountPercent: number
): {
  discountAmount: number;
  finalPrice: number;
} {
  const discountAmount = originalPrice * (discountPercent / 100);
  const finalPrice = originalPrice - discountAmount;
  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
  };
}

/**
 * Calculate expected commission
 */
export function calculateCommission(
  grossRevenue: number,
  discountPercent: number,
  commissionPercent: number
): {
  discountAmount: number;
  netRevenue: number;
  commissionAmount: number;
} {
  const discountAmount = grossRevenue * (discountPercent / 100);
  const netRevenue = grossRevenue - discountAmount;
  const commissionAmount = netRevenue * (commissionPercent / 100);
  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
  };
}
