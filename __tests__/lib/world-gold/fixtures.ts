import { FORMULA_VERSION, MARKETS } from '@/lib/world-gold/catalog';
import { localTimeToUtc } from '@/lib/world-gold/schedule';
import type { DerivedClose, WorldGoldFx } from '@/lib/world-gold/types';
export const RATES = {
  GBP: 0.8,
  THB: 33,
  HKD: 7.8,
  JPY: 150,
  INR: 84,
  AED: 3.6725,
  TRY: 34,
  EUR: 0.92,
  CHF: 0.85,
  AUD: 1.5,
};
export function fxFixture(
  updatedAt = '2026-10-15T10:00:00.000Z',
  observedAt = '2026-10-15T10:01:00.000Z'
): WorldGoldFx {
  return {
    provider: 'currencybeacon',
    rates: { ...RATES },
    updatedAt,
    observedAt,
    expiresAt: new Date(Date.parse(observedAt) + 3600000).toISOString(),
  };
}
export function closeFixture(
  marketId = 'gb',
  sessionDate = '2026-10-14'
): DerivedClose {
  const market = MARKETS.find((item) => item.id === marketId);
  if (!market) throw new Error('Unknown fixture market');
  const cutoff = localTimeToUtc(
    sessionDate,
    market.closeMinutes,
    market.timeZone
  );
  return {
    marketId,
    sessionDate,
    formulaVersion: FORMULA_VERSION,
    closedAt: cutoff.toISOString(),
    goldBarClosedAt: cutoff.toISOString(),
    fxPublishedAt: new Date(cutoff.getTime() - 30 * 60000).toISOString(),
    fxObservedAt: new Date(cutoff.getTime() - 29 * 60000).toISOString(),
    prices: Object.fromEntries(market.units.map((unit) => [unit.id, 100])),
  };
}
