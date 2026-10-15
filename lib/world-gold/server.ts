import { FORMULA_VERSION, MARKETS } from './catalog';
import {
  FX_STALE_MS,
  fxQualifiesForClose,
  getFxAtClose,
  getWorldGoldFx,
  validFx,
} from './fx';
import { calculateMarketPrices, priceChange } from './pricing';
import {
  dueCloses,
  getMarketSchedule,
  previousScheduledDate,
} from './schedule';
import { insertDerivedClose, readDerivedCloses, readGoldQuote } from './store';
import type {
  CloseHistory,
  DerivedClose,
  GoldQuote,
  WorldGoldFx,
  WorldGoldSnapshot,
} from './types';

export function buildWorldGoldSnapshot(
  now: Date,
  gold: GoldQuote | null,
  fxInput: WorldGoldFx | null,
  history: CloseHistory
): WorldGoldSnapshot {
  const fx = fxInput && validFx(fxInput, now) ? fxInput : null;
  return {
    generatedAt: now.toISOString(),
    gold,
    fx: fx
      ? {
          provider: 'currencybeacon',
          updatedAt: fx.updatedAt,
          stale: now.getTime() - Date.parse(fx.updatedAt) > FX_STALE_MS,
        }
      : null,
    historyAvailable: history.available,
    markets: MARKETS.map((market) => {
      const schedule = getMarketSchedule(market, now);
      const previousDate = previousScheduledDate(market, schedule.localDate);
      const previous = history.available
        ? history.closes.find(
            (close) =>
              close.marketId === market.id &&
              close.sessionDate === previousDate &&
              close.formulaVersion === FORMULA_VERSION
          )
        : undefined;
      const prices =
        gold && fx
          ? calculateMarketPrices(market, gold.price, fx.rates[market.currency])
          : null;
      return {
        id: market.id,
        status: schedule.isOpen ? ('open' as const) : ('closed' as const),
        units: market.units.map((unit) => {
          const price = prices?.[unit.id] ?? null;
          const previousClose = previous?.prices[unit.id] ?? null;
          return {
            id: unit.id,
            price,
            previousClose,
            ...priceChange(price, previousClose),
          };
        }),
        // Calculated price cannot be newer than its oldest input.
        updatedAt:
          gold && fx
            ? new Date(
                Math.min(Date.parse(gold.updatedAt), Date.parse(fx.updatedAt))
              ).toISOString()
            : null,
        previousCloseAt: previous?.closedAt ?? null,
      };
    }),
  };
}
export interface SnapshotDependencies {
  gold(now: Date): Promise<GoldQuote | null>;
  fx(now: Date): Promise<WorldGoldFx | null>;
  history(now: Date): Promise<CloseHistory>;
}
const snapshotDependencies: SnapshotDependencies = {
  gold: readGoldQuote,
  fx: getWorldGoldFx,
  history: readDerivedCloses,
};
export async function getWorldGoldSnapshot(
  dependencies: SnapshotDependencies = snapshotDependencies
): Promise<WorldGoldSnapshot> {
  const startedAt = new Date();
  const [gold, fx, history] = await Promise.all([
    dependencies.gold(startedAt),
    dependencies.fx(startedAt),
    dependencies.history(startedAt),
  ]);
  return buildWorldGoldSnapshot(new Date(), gold, fx, history);
}
export interface CaptureDependencies {
  primeFx(now: Date): Promise<WorldGoldFx | null>;
  fxAtClose(cutoff: Date, now: Date): Promise<WorldGoldFx | null>;
  goldAtClose(cutoff: Date): Promise<GoldQuote | null>;
  history(now: Date): Promise<CloseHistory>;
  insert(close: DerivedClose): Promise<boolean>;
}
const captureDependencies: CaptureDependencies = {
  primeFx: getWorldGoldFx,
  fxAtClose: getFxAtClose,
  goldAtClose: readGoldQuote,
  history: readDerivedCloses,
  insert: insertDerivedClose,
};
export interface CaptureResult {
  generatedAt: string;
  historyAvailable: boolean;
  stored: string[];
  alreadyPresent: string[];
  unavailable: string[];
}
export async function captureWorldGoldCloses(
  now = new Date(),
  dependencies: CaptureDependencies = captureDependencies
): Promise<CaptureResult> {
  // Independent cron traffic keeps an observation before each close, even with no page visitors.
  const [, history] = await Promise.all([
    dependencies.primeFx(now),
    dependencies.history(now),
  ]);
  const result: CaptureResult = {
    generatedAt: now.toISOString(),
    historyAvailable: history.available,
    stored: [],
    alreadyPresent: [],
    unavailable: [],
  };
  if (!history.available) return result;
  for (const market of MARKETS) {
    for (const candidate of dueCloses(market, now)) {
      const key = `${market.id}:${candidate.date}`;
      if (
        history.closes.some(
          (close) =>
            close.marketId === market.id &&
            close.sessionDate === candidate.date &&
            close.formulaVersion === FORMULA_VERSION
        )
      ) {
        result.alreadyPresent.push(key);
        continue;
      }
      const [gold, fx] = await Promise.all([
        dependencies.goldAtClose(candidate.cutoff),
        dependencies.fxAtClose(candidate.cutoff, now),
      ]);
      const validGold =
        gold &&
        !gold.stale &&
        Date.parse(gold.updatedAt) <= candidate.cutoff.getTime() &&
        candidate.cutoff.getTime() - Date.parse(gold.updatedAt) <=
          15 * 60 * 1000;
      const validCloseFx = fx && fxQualifiesForClose(fx, candidate.cutoff, now);
      const prices =
        validGold && fx && validCloseFx
          ? calculateMarketPrices(market, gold.price, fx.rates[market.currency])
          : null;
      if (!gold || !fx || !prices || gold.stale) {
        result.unavailable.push(key);
        continue;
      }
      const close: DerivedClose = {
        marketId: market.id,
        sessionDate: candidate.date,
        formulaVersion: FORMULA_VERSION,
        closedAt: candidate.cutoff.toISOString(),
        goldBarClosedAt: gold.updatedAt,
        fxPublishedAt: fx.updatedAt,
        fxObservedAt: fx.observedAt,
        prices,
      };
      try {
        const inserted = await dependencies.insert(close);
        (inserted ? result.stored : result.alreadyPresent).push(key);
      } catch {
        result.historyAvailable = false;
        result.unavailable.push(key);
      }
    }
  }
  return result;
}
