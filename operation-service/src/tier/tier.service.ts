import { Injectable } from '@nestjs/common';

import {
  canAccessSymbol,
  SYMBOLS,
  TIMEFRAMES,
  type Tier,
} from './tier.schemas';

interface SymbolInfo {
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'index' | 'commodity';
  proOnly: boolean;
}

interface TimeframeInfo {
  value: string;
  label: string;
  proOnly: boolean;
}

interface Combination {
  symbol: string;
  timeframe: string;
}

const SYMBOLS_INFO: SymbolInfo[] = [
  {
    symbol: 'XAUUSD',
    name: 'Gold/US Dollar',
    category: 'commodity',
    proOnly: false, // V8: no PRO-only symbols
  },
];

const TIMEFRAME_LABELS: Record<string, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
};

const COMBINATIONS: Combination[] = SYMBOLS.flatMap((symbol) =>
  TIMEFRAMES.map((timeframe) => ({ symbol, timeframe }))
);

const TIMEFRAMES_INFO: TimeframeInfo[] = TIMEFRAMES.map((tf) => ({
  value: tf,
  label: TIMEFRAME_LABELS[tf] || tf,
  proOnly: false, // V8: no PRO-only timeframes
}));

/**
 * Ports `app/api/tier/{symbols,check/[symbol],combinations}/route.ts`
 * (387 lines total) verbatim. Session 4B-10.
 *
 * `JwtAuthGuard` already guarantees an authenticated caller before any
 * method here runs. None of the 3 SOURCE routes apply tier gating (V8:
 * FREE and PRO get identical symbol/timeframe access) — these methods
 * accept `userTier` only to echo it back in the response, matching SOURCE.
 *
 * @module tier/tier.service
 */
@Injectable()
export class TierService {
  getSymbols(userTier: Tier) {
    return {
      success: true,
      tier: userTier,
      symbols: [...SYMBOLS],
      symbolsInfo: SYMBOLS_INFO,
      count: SYMBOLS.length,
      totalAvailable: SYMBOLS.length,
    };
  }

  checkSymbolAccess(userTier: Tier, symbol: string) {
    const upperSymbol = symbol.toUpperCase();
    const allowed = canAccessSymbol(upperSymbol, userTier);

    const response: {
      success: boolean;
      symbol: string;
      allowed: boolean;
      tier: Tier;
      reason?: string;
      accessibleSymbols?: readonly string[];
    } = {
      success: true,
      symbol: upperSymbol,
      allowed,
      tier: userTier,
    };

    if (!allowed) {
      response.reason = `Symbol ${upperSymbol} is not supported. This platform provides XAUUSD data only.`;
      response.accessibleSymbols = SYMBOLS;
    }

    return response;
  }

  getCombinations(userTier: Tier) {
    return {
      success: true,
      tier: userTier,
      combinations: COMBINATIONS,
      count: COMBINATIONS.length,
      totalPossible: COMBINATIONS.length,
      symbols: SYMBOLS,
      timeframes: TIMEFRAMES_INFO,
      limits: {
        symbolCount: SYMBOLS.length,
        timeframeCount: TIMEFRAMES.length,
        totalCombinations: COMBINATIONS.length,
      },
    };
  }
}
