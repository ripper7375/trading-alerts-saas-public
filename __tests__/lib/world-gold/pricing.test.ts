/** @jest-environment node */
import { MARKETS } from '@/lib/world-gold/catalog';
import { calculateMarketPrices, priceChange } from '@/lib/world-gold/pricing';
import { RATES } from './fixtures';

describe('World gold production formula oracle (USD 100 per fine gram)', () => {
  const expected: Record<string, Record<string, number>> = {
    gb: { oz: 2488.278144, sovereign: 585.792 },
    th: { baht: 48544.518, gram: 3184.5 },
    hk: { oz: 24260.711904, gram: 780, tael: 29194.22922 },
    jp: { baseGram: 15000, retailGram: 16500 },
    in: { retailGram: 9171.12, tola: 106970.109456 },
    ae: { oz: 11422.7518548, gram: 367.25, tola: 4283.53055 },
    tr: { gram: 3451, ceyrek: 5669.208 },
    de: { oz: 2861.5198656, gram: 92 },
    ch: { oz: 2643.795528, kg: 85000 },
    au: { oz: 4665.52152, kg: 150000 },
  };
  test.each(MARKETS.map((market) => [market.id, market] as const))(
    '%s matches independently worked local unit values',
    (id, market) => {
      const result = calculateMarketPrices(
        market,
        3110.34768,
        RATES[market.currency]
      );
      expect(result).not.toBeNull();
      expect(Object.keys(result ?? {})).toEqual(
        market.units.map((unit) => unit.id)
      );
      for (const [unit, value] of Object.entries(expected[id] ?? {})) {
        // The supplied kg conversion factor is rounded at its tenth decimal place.
        expect(result?.[unit]).toBeCloseTo(value, 3);
      }
    }
  );
  test('GBP quote direction equals division by GBPUSD', () => {
    const gb = MARKETS.find((market) => market.id === 'gb')!;
    expect(calculateMarketPrices(gb, 2650, 1 / 1.305)?.['oz']).toBeCloseTo(
      2650 / 1.305,
      10
    );
  });
  test('Thai purity uses the exact source fraction rather than 0.47294', () => {
    const th = MARKETS.find((market) => market.id === 'th')!;
    const price = calculateMarketPrices(th, 2650, 32.85)?.['baht'];
    expect(price).toBeCloseTo((2650 * 32.85 * 15.244 * 0.965) / 31.1034768, 8);
    expect(price).not.toBeCloseTo(2650 * 32.85 * 0.47294, 2);
  });
  test.each([0, -1, NaN, Infinity, -Infinity])(
    'refuses invalid source %s',
    (value) => {
      expect(calculateMarketPrices(MARKETS[0]!, value, 1)).toBeNull();
      expect(calculateMarketPrices(MARKETS[0]!, 100, value)).toBeNull();
    }
  );
  test('refuses overflowing derived values', () =>
    expect(
      calculateMarketPrices(MARKETS[0]!, Number.MAX_VALUE, Number.MAX_VALUE)
    ).toBeNull());
  test.each([
    [110, 100, 10, 10],
    [90, 100, -10, -10],
    [100, 100, 0, 0],
  ])(
    'absolute and percentage movement use the same unrounded baseline',
    (current, previous, change, percent) => {
      expect(priceChange(current, previous)).toEqual({
        change,
        changePercent: percent,
      });
    }
  );
  test.each([null, 0, -1, NaN, Infinity])(
    'does not fabricate movement from baseline %s',
    (previous) => {
      expect(priceChange(100, previous)).toEqual({
        change: null,
        changePercent: null,
      });
    }
  );
  test('missing current price preserves unavailable movement', () =>
    expect(priceChange(null, 100)).toEqual({
      change: null,
      changePercent: null,
    }));
});
