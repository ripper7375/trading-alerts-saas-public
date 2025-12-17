/**
 * Tier Symbols API Route
 *
 * GET /api/tier/symbols
 * Returns list of symbols accessible by the authenticated user's tier.
 *
 * @module app/api/tier/symbols/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  FREE_SYMBOLS,
  PRO_SYMBOLS,
} from '@/lib/tier-config';
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

/**
 * Symbol metadata with display names and categories
 */
const SYMBOL_INFO: Record<string, Omit<SymbolInfo, 'symbol' | 'proOnly'>> = {
  AUDJPY: { name: 'Australian Dollar/Japanese Yen', category: 'forex' },
  AUDUSD: { name: 'Australian Dollar/US Dollar', category: 'forex' },
  BTCUSD: { name: 'Bitcoin/US Dollar', category: 'crypto' },
  ETHUSD: { name: 'Ethereum/US Dollar', category: 'crypto' },
  EURUSD: { name: 'Euro/US Dollar', category: 'forex' },
  GBPJPY: { name: 'British Pound/Japanese Yen', category: 'forex' },
  GBPUSD: { name: 'British Pound/US Dollar', category: 'forex' },
  NDX100: { name: 'Nasdaq 100 Index', category: 'index' },
  NZDUSD: { name: 'New Zealand Dollar/US Dollar', category: 'forex' },
  US30: { name: 'Dow Jones Industrial Average', category: 'index' },
  USDCAD: { name: 'US Dollar/Canadian Dollar', category: 'forex' },
  USDCHF: { name: 'US Dollar/Swiss Franc', category: 'forex' },
  USDJPY: { name: 'US Dollar/Japanese Yen', category: 'forex' },
  XAGUSD: { name: 'Silver/US Dollar', category: 'commodity' },
  XAUUSD: { name: 'Gold/US Dollar', category: 'commodity' },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get symbols for a specific tier
 */
function getSymbolsForTier(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

/**
 * Build symbol info array with proOnly flag
 */
function buildSymbolInfo(tier: Tier): SymbolInfo[] {
  const accessibleSymbols = getSymbolsForTier(tier);

  return [...PRO_SYMBOLS].map((symbol) => {
    const info = SYMBOL_INFO[symbol];
    return {
      symbol,
      name: info?.name || symbol,
      category: info?.category || 'forex',
      proOnly: !FREE_SYMBOLS.includes(symbol as typeof FREE_SYMBOLS[number]),
    };
  }).filter((s) => accessibleSymbols.includes(s.symbol));
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/symbols
 *
 * Returns list of symbols accessible by the authenticated user's tier.
 * Includes symbol metadata like display names and categories.
 *
 * @returns 200: List of accessible symbols with metadata
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (FREE tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "symbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"],
 *   "symbolsInfo": [...],
 *   "count": 5,
 *   "totalAvailable": 15
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
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

    //───────────────────────────────────────────────────────
    // STEP 2: Get User Tier
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 3: Get Symbols for Tier
    //───────────────────────────────────────────────────────
    const symbols = getSymbolsForTier(userTier);
    const symbolsInfo = buildSymbolInfo(userTier);

    //───────────────────────────────────────────────────────
    // STEP 4: Build Response
    //───────────────────────────────────────────────────────
    const response: SymbolsResponse = {
      success: true,
      tier: userTier,
      symbols: [...symbols],
      symbolsInfo,
      count: symbols.length,
      totalAvailable: PRO_SYMBOLS.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('GET /api/tier/symbols error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch symbols',
        message: 'An error occurred while fetching available symbols. Please try again.',
      },
      { status: 500 }
    );
  }
}
