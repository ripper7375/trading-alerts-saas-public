/**
 * Tier Symbols API Route — V8 single-symbol architecture
 *
 * GET /api/tier/symbols
 * Returns the platform's symbol list: XAUUSD only, identical for both tiers.
 *
 * @module app/api/tier/symbols/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { shouldUseOperationServiceForTier } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';
import { SYMBOLS } from '@/lib/tier-config';
import type { Tier } from '@/types/tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SymbolInfo {
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'index' | 'commodity';
  proOnly: boolean;
}

interface SymbolsResponse {
  success: boolean;
  tier: Tier;
  symbols: string[];
  symbolsInfo: SymbolInfo[];
  count: number;
  totalAvailable: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL METADATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYMBOLS_INFO: SymbolInfo[] = [
  {
    symbol: 'XAUUSD',
    name: 'Gold/US Dollar',
    category: 'commodity',
    proOnly: false, // V8: no PRO-only symbols
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/symbols
 *
 * V8: hardcoded to XAUUSD — both tiers have identical symbol access,
 * so no tier gating is applied.
 *
 * @returns 200: List of accessible symbols with metadata
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (any tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "symbols": ["XAUUSD"],
 *   "symbolsInfo": [...],
 *   "count": 1,
 *   "totalAvailable": 1
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to view available symbols',
        },
        { status: 401 }
      );
    }

    // Session 4B-10: when the flag is on, operation-service's
    // TierController (Session 4B-10 PORT) already re-implements the logic
    // below against the same lib/tier-config.ts constants — forward instead.
    if (shouldUseOperationServiceForTier()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        '/tier/symbols'
      );
      return NextResponse.json(body, { status: opStatus });
    }

    const userTier = (session.user.tier as Tier) || 'FREE';

    const response: SymbolsResponse = {
      success: true,
      tier: userTier,
      symbols: [...SYMBOLS],
      symbolsInfo: SYMBOLS_INFO,
      count: SYMBOLS.length,
      totalAvailable: SYMBOLS.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('GET /api/tier/symbols error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch symbols',
        message:
          'An error occurred while fetching available symbols. Please try again.',
      },
      { status: 500 }
    );
  }
}
