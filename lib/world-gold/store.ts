/** PostgreSQL stores derived prices and timestamps only: no raw CurrencyBeacon quote or FX table. */
import { marketPrisma } from '@/lib/db/market-prisma';
import { logger } from '@/lib/logger';
import { FORMULA_VERSION, MARKETS } from './catalog';
import {
  localParts,
  localTimeToUtc,
  scheduledDay,
  shiftDate,
} from './schedule';
import type { CloseHistory, DerivedClose, GoldQuote } from './types';

export const GOLD_STALE_MS = 15 * 60 * 1000;
export interface WorldGoldSql {
  query<T>(sql: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  execute(sql: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
const database: WorldGoldSql = {
  query: <T>(sql: TemplateStringsArray, ...values: unknown[]) =>
    marketPrisma.$queryRaw<T>(sql, ...values),
  execute: (sql, ...values) => marketPrisma.$executeRaw(sql, ...values),
};
export interface GoldReader {
  marketDataV6: {
    findFirst(args: {
      where: { symbol: string; timeframe: string; timestamp: { lte: number } };
      orderBy: { timestamp: 'desc' };
      select: { close: true; timestamp: true };
    }): Promise<{ close: number; timestamp: number } | null>;
  };
}
const goldDatabase: GoldReader = { marketDataV6: marketPrisma.marketDataV6 };
async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('World gold database timeout')),
          3000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function readGoldQuote(
  cutoff = new Date(),
  client: GoldReader = goldDatabase
): Promise<GoldQuote | null> {
  if (client === goldDatabase && !process.env['DATABASE_URL']) return null;
  const endSeconds = Math.floor(cutoff.getTime() / 1000);
  try {
    const row = await bounded(
      client.marketDataV6.findFirst({
        where: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: { lte: endSeconds - 300 },
        },
        orderBy: { timestamp: 'desc' },
        select: { close: true, timestamp: true },
      })
    );
    if (
      !row ||
      !Number.isFinite(row.close) ||
      row.close <= 0 ||
      !Number.isInteger(row.timestamp) ||
      row.timestamp < 0 ||
      row.timestamp + 300 > endSeconds
    )
      return null;
    const endMs = (row.timestamp + 300) * 1000;
    return {
      price: row.close,
      updatedAt: new Date(endMs).toISOString(),
      stale: cutoff.getTime() - endMs > GOLD_STALE_MS,
    };
  } catch {
    logger.warn('[world-gold] Gold price database unavailable');
    return null;
  }
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function validDerivedClose(close: DerivedClose): boolean {
  const market = MARKETS.find((entry) => entry.id === close.marketId);
  if (
    !market ||
    close.formulaVersion !== FORMULA_VERSION ||
    !/^\d{4}-\d{2}-\d{2}$/.test(close.sessionDate)
  )
    return false;
  const day = Date.parse(`${close.sessionDate}T00:00:00Z`);
  if (
    !Number.isFinite(day) ||
    new Date(day).toISOString().slice(0, 10) !== close.sessionDate ||
    !scheduledDay(market, close.sessionDate)
  )
    return false;
  const closed = Date.parse(close.closedAt),
    gold = Date.parse(close.goldBarClosedAt);
  const published = Date.parse(close.fxPublishedAt),
    observed = Date.parse(close.fxObservedAt);
  if (
    ![closed, gold, published, observed].every(
      (value) => Number.isFinite(value) && value >= 0
    ) ||
    closed !==
      localTimeToUtc(
        close.sessionDate,
        market.closeMinutes,
        market.timeZone
      ).getTime() ||
    gold > closed ||
    closed - gold > GOLD_STALE_MS ||
    published > observed ||
    observed > closed ||
    closed - published > 65 * 60 * 1000
  )
    return false;
  const prices = object(close.prices);
  return (
    prices !== null &&
    Object.keys(prices).length === market.units.length &&
    market.units.every((unit) => {
      const value = prices[unit.id];
      return typeof value === 'number' && Number.isFinite(value) && value > 0;
    })
  );
}
interface StoredClose {
  market_id: string;
  session_date: string;
  formula_version: string;
  closed_at: number;
  gold_bar_closed_at: number;
  fx_published_at: number;
  fx_observed_at: number;
  prices: unknown;
}
function fromRow(row: StoredClose): DerivedClose | null {
  try {
    const close: DerivedClose = {
      marketId: row.market_id,
      sessionDate: row.session_date,
      formulaVersion: row.formula_version,
      closedAt: new Date(row.closed_at * 1000).toISOString(),
      goldBarClosedAt: new Date(row.gold_bar_closed_at * 1000).toISOString(),
      fxPublishedAt: new Date(row.fx_published_at * 1000).toISOString(),
      fxObservedAt: new Date(row.fx_observed_at * 1000).toISOString(),
      prices: row.prices as Record<string, number>,
    };
    return validDerivedClose(close) ? close : null;
  } catch {
    return null;
  }
}
export async function readDerivedCloses(
  now = new Date(),
  client: WorldGoldSql = database
): Promise<CloseHistory> {
  if (client === database && !process.env['DATABASE_URL'])
    return { available: false, closes: [] };
  const dates = MARKETS.map(
    (market) => localParts(now, market.timeZone).date
  ).sort();
  const from = shiftDate(dates[0] as string, -10);
  const to = dates[dates.length - 1] as string;
  try {
    const rows = await bounded(client.query<StoredClose[]>`
      SELECT market_id, session_date, formula_version, closed_at, gold_bar_closed_at,
             fx_published_at, fx_observed_at, prices
      FROM world_gold_closes
      WHERE formula_version = ${FORMULA_VERSION} AND session_date >= ${from} AND session_date <= ${to}
      ORDER BY session_date DESC LIMIT 120
    `);
    return {
      available: true,
      closes: rows
        .map(fromRow)
        .filter((row): row is DerivedClose => row !== null),
    };
  } catch {
    // Missing migration and a failed database both have an honest unavailable state.
    logger.warn('[world-gold] Derived close history unavailable');
    return { available: false, closes: [] };
  }
}
export async function insertDerivedClose(
  close: DerivedClose,
  client: WorldGoldSql = database
): Promise<boolean> {
  if (!validDerivedClose(close)) throw new Error('Invalid derived close');
  const seconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000);
  const count = await bounded(client.execute`
    INSERT INTO world_gold_closes
      (market_id, session_date, formula_version, closed_at, gold_bar_closed_at, fx_published_at, fx_observed_at, prices)
    VALUES (${close.marketId}, ${close.sessionDate}, ${close.formulaVersion}, ${seconds(close.closedAt)},
      ${seconds(close.goldBarClosedAt)}, ${seconds(close.fxPublishedAt)}, ${seconds(close.fxObservedAt)}, ${JSON.stringify(close.prices)}::jsonb)
    ON CONFLICT (market_id, session_date, formula_version) DO NOTHING
  `);
  return count === 1;
}
