/**
 * GET /api/payments/dlocal/convert
 *
 * Converts USD amount to local currency.
 *
 * Query Parameters:
 * - amount: USD amount (required, must be positive)
 * - currency: 3-letter currency code (required)
 *
 * Response:
 * - 200: { localAmount, currency, exchangeRate, usdAmount }
 * - 400: Missing or invalid parameters
 */

import { NextRequest, NextResponse } from 'next/server';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { logger } from '@/lib/logger';
import type { DLocalCurrency } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

const SUPPORTED_CURRENCIES: DLocalCurrency[] = [
  'INR',
  'NGN',
  'PKR',
  'VND',
  'IDR',
  'THB',
  'ZAR',
  'TRY',
];

function isSupportedCurrency(currency: string): currency is DLocalCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as DLocalCurrency);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const amountStr = searchParams.get('amount');
    const currency = searchParams.get('currency');

    // Validate amount parameter
    if (!amountStr) {
      return NextResponse.json(
        { error: 'Amount parameter is required' },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate currency parameter
    if (!currency) {
      return NextResponse.json(
        { error: 'Currency parameter is required' },
        { status: 400 }
      );
    }

    if (!isSupportedCurrency(currency)) {
      return NextResponse.json(
        {
          error: 'Invalid or unsupported currency',
          supportedCurrencies: SUPPORTED_CURRENCIES,
        },
        { status: 400 }
      );
    }

    logger.info('Converting currency', { amount, currency });

    const result = await convertUSDToLocal(amount, currency);

    return NextResponse.json({
      localAmount: result.localAmount,
      currency: result.currency,
      exchangeRate: result.exchangeRate,
      usdAmount: result.usdAmount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to convert currency', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to convert currency' },
      { status: 500 }
    );
  }
}
