import { TROY_OUNCE_GRAMS, type GoldMarket } from './catalog';

export function calculateMarketPrices(
  market: GoldMarket,
  xauUsd: number,
  localPerUsd: number
): Record<string, number> | null {
  if (![xauUsd, localPerUsd].every((n) => Number.isFinite(n) && n > 0))
    return null;
  const localPerGram = (xauUsd * localPerUsd) / TROY_OUNCE_GRAMS;
  const prices: Record<string, number> = {};
  for (const unit of market.units) {
    const price =
      localPerGram * unit.grams * (unit.purity ?? 1) * (unit.multiplier ?? 1) +
      (unit.fixedPremium ?? 0);
    if (!Number.isFinite(price) || price <= 0) return null;
    prices[unit.id] = price;
  }
  return prices;
}
export function priceChange(
  current: number | null,
  previous: number | null
): { change: number | null; changePercent: number | null } {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return { change: null, changePercent: null };
  }
  const change = current - previous;
  return { change, changePercent: (change / previous) * 100 };
}
