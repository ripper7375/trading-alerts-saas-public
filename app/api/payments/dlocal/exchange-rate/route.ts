/**
 * GET /api/payments/dlocal/exchange-rate
 *
 * Returns the current exchange rate from USD to the specified currency.
 *
 * Query Parameters:
 * - currency: 3-letter currency code (required)
 *
 * Response:
 * - 200: { currency, rate, timestamp }
 * - 400: Missing or invalid currency
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/dlocal/currency-converter.service';
import { logger } from '@/lib/logger';
import type { DLocalCurrency } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

const SUPPORTED_CURRENCIES: DLocalCurrency[] = [
  'INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY'
];

function isSupportedCurrency(currency: string): currency is DLocalCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as DLocalCurrency);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency');

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
          supportedCurrencies: SUPPORTED_CURRENCIES
        },
        { status: 400 }
      );
    }

    logger.info('Fetching exchange rate', { currency });

    const rate = await getExchangeRate(currency);

    return NextResponse.json({
      currency,
      rate,
      baseCurrency: 'USD',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get exchange rate', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to get exchange rate' },
      { status: 500 }
    );
  }
}
