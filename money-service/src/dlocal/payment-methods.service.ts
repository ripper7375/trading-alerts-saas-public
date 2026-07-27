/**
 * Payment Methods Service (Session 4A-9, File 6/10)
 *
 * Ported byte-for-byte from lib/dlocal/payment-methods.service.ts -- a
 * real, direct dependency of app/api/payments/dlocal/create/route.ts that
 * the 4A-9 order's own file list omitted (same class of gap as
 * currency-converter.service.ts, ported alongside this file).
 */

import { logger } from '../common/logger.util';

import {
  getPaymentMethods as getCountryPaymentMethods,
  isDLocalCountry,
} from './dlocal.constants';
import type { DLocalCountry, PaymentMethodInfo } from './dlocal.types';

/** Gets available payment methods for a country. */
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

/** Validates if a payment method is available for a country. */
export function isValidPaymentMethod(
  country: DLocalCountry,
  method: string
): boolean {
  const methods = getCountryPaymentMethods(country);
  return methods.includes(method);
}

/** Gets detailed payment method information. */
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
  ];
  const qrMethods = ['Thai QR'];

  if (bankMethods.includes(method)) return 'bank';
  if (walletMethods.includes(method)) return 'wallet';
  if (qrMethods.includes(method)) return 'qr';
  if (method.includes('Card')) return 'card';

  return 'other';
}

/** Gets the default/preferred payment method for a country. */
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
  };

  return defaultMethods[country] || null;
}
