/**
 * Payment Methods Service
 *
 * Handles retrieval and validation of payment methods by country.
 */

import type { DLocalCountry, PaymentMethodInfo } from '@/types/dlocal';
import {
  getPaymentMethods as getCountryPaymentMethods,
  isDLocalCountry,
} from '@/lib/dlocal/constants';
import { logger } from '@/lib/logger';

/**
 * Maps this codebase's human-readable payment method display names to
 * dLocal's real Payins API `payment_method_id` codes (Session 4A-16, F76).
 * Display names are this app's own labels (`DLOCAL_SUPPORTED_COUNTRIES`
 * countries in lib/dlocal/constants.ts) -- dLocal's API rejects them
 * verbatim with `5010 Method not available`.
 */
export const DLOCAL_METHOD_CODE_MAP: Record<
  DLocalCountry,
  Record<string, string>
> = {
  IN: { UPI: 'UP', Paytm: 'PAYTM', PhonePe: 'PHONEPE', 'Net Banking': 'NB' },
  TH: { TrueMoney: 'TM', 'Rabbit LINE Pay': 'RLP', 'Thai QR': 'TH_QR' },
  VN: { VNPay: 'VNPAY', MoMo: 'MOMO', ZaloPay: 'ZALOPAY' },
  ID: { GoPay: 'GOPAY', OVO: 'OVO', Dana: 'DANA', ShopeePay: 'SHOPEEPAY' },
  NG: {
    'Bank Transfer': 'BANK_TRANSFER',
    USSD: 'USSD',
    Paystack: 'PAYSTACK',
  },
  PK: { JazzCash: 'JAZZCASH', Easypaisa: 'EASYPAISA' },
  ZA: { 'Instant EFT': 'INSTANT_EFT', EFT: 'EFT' },
  TR: { 'Bank Transfer': 'BANK_TRANSFER', 'Local Cards': 'CARD' },
  AE: {
    'Local Cards': 'CARD',
    'Apple Pay': 'APPLEPAY',
    'Bank Transfer': 'BANK_TRANSFER',
  },
};

/**
 * Resolves a display name to dLocal's real `payment_method_id` for the
 * given country. Fails loud -- never sends an unmapped display string to
 * dLocal's API (Session 4A-16, F76).
 */
export function getDLocalMethodCode(
  country: DLocalCountry,
  displayName: string
): string {
  const code = DLOCAL_METHOD_CODE_MAP[country]?.[displayName];
  if (!code) {
    throw new Error(
      `No dLocal method code mapped for payment method "${displayName}" in country "${country}"`
    );
  }
  return code;
}

/**
 * Gets available payment methods for a country
 */
export async function getPaymentMethodsForCountry(
  country: DLocalCountry
): Promise<string[]> {
  if (!isDLocalCountry(country)) {
    logger.error('Unsupported country requested', { country });
    throw new Error('Unsupported country');
  }

  const methods = getCountryPaymentMethods(country);
  logger.info('Retrieved payment methods', {
    country,
    methodCount: methods.length,
  });

  return methods;
}

/**
 * Validates if a payment method is available for a country
 */
export function isValidPaymentMethod(
  country: DLocalCountry,
  method: string
): boolean {
  const methods = getCountryPaymentMethods(country);
  return methods.includes(method);
}

/**
 * Gets detailed payment method information
 */
export async function getPaymentMethodDetails(
  country: DLocalCountry
): Promise<PaymentMethodInfo[]> {
  if (!isDLocalCountry(country)) {
    throw new Error('Unsupported country');
  }

  const methods = getCountryPaymentMethods(country);

  return methods.map((method) => ({
    id: method.toLowerCase().replace(/\s+/g, '_'),
    name: method,
    type: getPaymentMethodType(method),
  }));
}

/**
 * Determines the type of payment method
 */
function getPaymentMethodType(method: string): string {
  const bankMethods = [
    'Net Banking',
    'Bank Transfer',
    'Instant EFT',
    'EFT',
    'USSD',
  ];
  const walletMethods = [
    'UPI',
    'Paytm',
    'PhonePe',
    'GoPay',
    'OVO',
    'Dana',
    'ShopeePay',
    'TrueMoney',
    'Rabbit LINE Pay',
    'VNPay',
    'MoMo',
    'ZaloPay',
    'JazzCash',
    'Easypaisa',
    'Paystack',
    'Apple Pay',
  ];
  const qrMethods = ['Thai QR'];

  if (bankMethods.includes(method)) return 'bank';
  if (walletMethods.includes(method)) return 'wallet';
  if (qrMethods.includes(method)) return 'qr';
  if (method.includes('Card')) return 'card';

  return 'other';
}

/**
 * Gets the default/preferred payment method for a country
 */
export function getDefaultPaymentMethod(country: DLocalCountry): string | null {
  const defaultMethods: Partial<Record<DLocalCountry, string>> = {
    IN: 'UPI',
    NG: 'Bank Transfer',
    PK: 'JazzCash',
    VN: 'VNPay',
    ID: 'GoPay',
    TH: 'TrueMoney',
    ZA: 'Instant EFT',
    TR: 'Bank Transfer',
    AE: 'Local Cards',
  };

  return defaultMethods[country] || null;
}
