/**
 * Read the newest `symbol_specs` row of a symbol and judge it (architecture
 * 6.9, ADR-066): the broker's contract size, volume limits and typical spread
 * that sizing uses, with the row's `version` for the consent record.
 *
 * The newest row is the one with the latest `captured_at`, then the highest
 * `version`, as the gateway reads it. Whether it is usable (older than 7 days,
 * in the future, unreadable) is `readBrokerFigures`'s call; this file only
 * fetches. A database error is not thrown: it is the answer
 * (`DATABASE_ERROR`), and Report 2 is then not offered.
 *
 * @module lib/engine4/read/specs
 */

import { marketPrisma } from '@/lib/db/market-prisma';

import {
  readBrokerFigures,
  type BrokerResult,
  type SymbolSpecRow,
} from '../broker';
import type { DecimalLike } from '../exact';
import { readSeconds } from '../time';

const DEFAULT_SYMBOL = 'XAUUSD';

/** The one delegate of `marketPrisma` this reader calls: the real one fits with no cast; a test passes its own. */
export interface SpecsClient {
  symbolSpec: {
    findFirst(args: {
      where: { symbol: string };
      orderBy: [{ captured_at: 'desc' }, { version: 'desc' }];
      select: Record<keyof SymbolSpecRow, true>;
    }): Promise<SymbolSpecRow | null>;
  };
}

export interface SpecsRequest {
  /** the clock, unix UTC seconds; passed in so the reader holds no clock of its own */
  nowSeconds: DecimalLike;
  symbol?: string;
}

/**
 * The broker figures as of `nowSeconds`: figures, or the reason there are none
 * (`NO_SPECS`, `SPECS_STALE`, `SPECS_FROM_THE_FUTURE`, `SPECS_UNREADABLE`,
 * `DATABASE_ERROR`).
 */
export async function readNewestBrokerFigures(
  request: SpecsRequest,
  client: SpecsClient = { symbolSpec: marketPrisma.symbolSpec }
): Promise<BrokerResult> {
  readSeconds('nowSeconds', request.nowSeconds);
  let row: SymbolSpecRow | null;
  try {
    row = await client.symbolSpec.findFirst({
      where: { symbol: request.symbol ?? DEFAULT_SYMBOL },
      orderBy: [{ captured_at: 'desc' }, { version: 'desc' }],
      select: {
        symbol: true,
        version: true,
        captured_at: true,
        contract_size: true,
        volume_min: true,
        volume_step: true,
        volume_max: true,
        tick_size: true,
        typical_spread: true,
        swap_long: true,
        swap_short: true,
        point: true,
        digits: true,
        swap_mode: true,
      },
    });
  } catch (error) {
    return {
      ok: false,
      code: 'DATABASE_ERROR',
      detail: `the symbol_specs row could not be read: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      version: null,
      capturedAt: null,
      ageSeconds: null,
    };
  }
  return readBrokerFigures(row, request.nowSeconds);
}
