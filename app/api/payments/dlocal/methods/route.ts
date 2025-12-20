/**
 * GET /api/payments/dlocal/methods
 *
 * Returns available dLocal payment methods for a country.
 *
 * Query Parameters:
 * - country: ISO 2-letter country code (required)
 *
 * Response:
 * - 200: { country, methods: string[] }
 * - 400: Invalid or unsupported country
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethodsForCountry, getPaymentMethodDetails } from '@/lib/dlocal/payment-methods.service';
import { isDLocalCountry } from '@/lib/dlocal/constants';
import { logger } from '@/lib/logger';
import type { DLocalCountry } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const detailed = searchParams.get('detailed') === 'true';

    // Validate country parameter
    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    if (!isDLocalCountry(country)) {
      return NextResponse.json(
        {
          error: 'Invalid or unsupported country',
          supportedCountries: ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']
        },
        { status: 400 }
      );
    }

    logger.info('Fetching payment methods', { country });

    // Return detailed info if requested
    if (detailed) {
      const methodDetails = await getPaymentMethodDetails(country as DLocalCountry);
      return NextResponse.json({
        country,
        methods: methodDetails,
      });
    }

    // Return simple list
    const methods = await getPaymentMethodsForCountry(country as DLocalCountry);

    return NextResponse.json({
      country,
      methods,
    });
  } catch (error) {
    logger.error('Failed to get payment methods', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to get payment methods' },
      { status: 500 }
    );
  }
}
