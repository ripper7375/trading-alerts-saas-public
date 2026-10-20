/**
 * Currency Index PRO Plan — Phase 2 read layer.
 *
 * @module lib/currency-index-pro/queries
 */

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';

import type { CurrencyIndexBar } from './math';
import type { CorridorThresholds } from './signals';

export interface DailyVolatilityCorridorSnapshot extends CorridorThresholds {
  date: number;
  lookbackDays: number;
  extremeZonePct: number;
  meanExcursion: number;
  stdDev: number;
}

/**
 * The most recently computed corridor (today's, once the Phase 1 aggregator
 * has run today; the prior day's until then). Returns `null` on a genuinely
 * missing table/row -- Lane 4's very first day, or the aggregator not
 * having run yet -- so callers degrade to NEUTRAL zone classification
 * rather than a broken response.
 */
export async function getLatestCorridor(): Promise<DailyVolatilityCorridorSnapshot | null> {
  try {
    const row = await marketPrisma.dailyVolatilityCorridor.findFirst({
      orderBy: { date: 'desc' },
    });
    if (!row) return null;

    return {
      date: row.date,
      lookbackDays: row.lookback_days,
      strikeZonePct: row.strike_zone_pct,
      extremeZonePct: row.extreme_zone_pct,
      meanExcursion: row.mean_excursion,
      stdDev: row.std_dev,
    };
  } catch (error) {
    console.error('[currency-index-pro] corridor query failed:', error);
    return null;
  }
}

export interface IndexSessionBars {
  sessionOpenBarTime: number;
  bars: CurrencyIndexBar[];
}

/** The newest bar of one requested index, reduced to what the second read needs. */
interface LatestSessionOpenRow {
  index_name: string;
  session_open_bar_time: number;
}

/**
 * Every bar from each index's OWN current session-open bar through the
 * latest bar, for a set of indices at once -- one statement for the latest
 * bar per requested index (which also carries that index's own
 * session_open_bar_time), then one OR-clause query for the bars, mirroring
 * `getCurrencyGoldIndexSnapshots()`'s own established 2-query shape rather
 * than round-tripping once per index. `sessionOpenBarTime` is returned
 * directly from the query rather than left for the caller to infer from
 * `bars[0]` -- a real data gap at exactly the open bar would otherwise
 * silently mislabel the session boundary.
 *
 * The lookup does NOT use Prisma's `distinct`: the installed client sends no
 * DISTINCT and no LIMIT for it and removes the duplicates in the application,
 * so every historical row of the requested indices crossed the driver on
 * each call (and the PRO chart and screener call this about four times a
 * minute per open cockpit). The caller's names ARE the filter here, so the
 * statement seeks the newest bar of each requested name directly in the
 * (index_name, bar_time) index: its cost depends on the number of requested
 * names, not on the history (measured:
 * docs/handoffs/2026-10-20-b2-explain.md). The result is ordered by
 * index_name, which the chart route relies on (it reads the first entry).
 */
export async function getTodaysSessionBarsForIndices(
  indexNames: readonly string[]
): Promise<Map<string, IndexSessionBars>> {
  // Nothing requested, nothing to look up: no database round trip.
  if (indexNames.length === 0) return new Map();

  try {
    // `names` is the distinct set of requested names (a repeated name must not
    // give a repeated row); a name with no rows yields no row. No string is
    // built from the names: they are one bound text[] parameter.
    const latest = await marketPrisma.$queryRaw<LatestSessionOpenRow[]>`
      SELECT l."index_name", l."session_open_bar_time"
      FROM (SELECT DISTINCT n FROM unnest(${[...indexNames]}::text[]) AS u(n)) AS names
      CROSS JOIN LATERAL (
        SELECT c."index_name", c."session_open_bar_time"
        FROM "currency_gold_indices" c
        WHERE c."index_name" = names.n
        ORDER BY c."bar_time" DESC
        LIMIT 1
      ) l
      ORDER BY l."index_name" ASC
    `;

    if (latest.length === 0) return new Map();

    const rows = await marketPrisma.currencyGoldIndex.findMany({
      where: {
        OR: latest.map((l) => ({
          index_name: l.index_name,
          bar_time: { gte: l.session_open_bar_time },
        })),
      },
      orderBy: [{ index_name: 'asc' }, { bar_time: 'asc' }],
      select: {
        index_name: true,
        bar_time: true,
        value: true,
        change_pct: true,
      },
    });

    const byIndex = new Map<string, IndexSessionBars>();
    for (const l of latest) {
      byIndex.set(l.index_name, {
        sessionOpenBarTime: l.session_open_bar_time,
        bars: [],
      });
    }
    for (const row of rows) {
      byIndex.get(row.index_name)?.bars.push({
        barTime: row.bar_time,
        value: row.value,
        changePct: row.change_pct,
      });
    }
    return byIndex;
  } catch (error) {
    console.error('[currency-index-pro] session bars query failed:', error);
    return new Map();
  }
}

export interface CurrencyIndexPreferences {
  lookbackDays: number;
  useAutoZones: boolean;
  customObPct: number | null;
  customOsPct: number | null;
  hrmaPeriod: number;
  smmaPeriod: number;
  preferredTf: string;
}

/** Mirrors UserCurrencyIndexPreference's own Prisma-schema defaults. */
export const DEFAULT_CURRENCY_INDEX_PREFERENCES: CurrencyIndexPreferences = {
  lookbackDays: 20,
  useAutoZones: true,
  customObPct: null,
  customOsPct: null,
  hrmaPeriod: 36,
  smmaPeriod: 13,
  preferredTf: 'M15',
};

/**
 * A user's own HRMA/SMMA period + zone-override preferences, defaulting a
 * user with no saved row yet -- same "missing row means defaults, not an
 * error" precedent as `app/api/user/preferences/route.ts`.
 */
export async function getUserCurrencyIndexPreference(
  userId: string
): Promise<CurrencyIndexPreferences> {
  try {
    const row = await prisma.userCurrencyIndexPreference.findUnique({
      where: { userId },
    });
    if (!row) return DEFAULT_CURRENCY_INDEX_PREFERENCES;

    return {
      lookbackDays: row.lookbackDays,
      useAutoZones: row.useAutoZones,
      customObPct: row.customObPct,
      customOsPct: row.customOsPct,
      hrmaPeriod: row.hrmaPeriod,
      smmaPeriod: row.smmaPeriod,
      preferredTf: row.preferredTf,
    };
  } catch (error) {
    console.error('[currency-index-pro] preference read failed:', error);
    return DEFAULT_CURRENCY_INDEX_PREFERENCES;
  }
}
