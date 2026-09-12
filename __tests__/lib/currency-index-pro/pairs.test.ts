import {
  CURRENCY_PAIRS,
  resolvePairAction,
  classifyConfluence,
  scorePairs,
  type IndexState,
  type CurrencyCode,
} from '@/lib/currency-index-pro/pairs';

function state(
  currency: CurrencyCode,
  overrides: Partial<IndexState> = {}
): IndexState {
  return {
    currency,
    changePct: 0,
    zone: 'NEUTRAL',
    signal: 'NONE',
    ...overrides,
  };
}

describe('CURRENCY_PAIRS', () => {
  it('has exactly 28 unique pairs (C(8,2))', () => {
    expect(CURRENCY_PAIRS).toHaveLength(28);
    expect(new Set(CURRENCY_PAIRS.map((p) => p.pair)).size).toBe(28);
  });
});

describe('resolvePairAction (spec Section 6.1 quoting invariant)', () => {
  it('spec worked example: JPY Overbought (as QUOTE) -> BUY USDJPY, EURJPY, GBPJPY', () => {
    const jpyOverbought = state('JPY', { zone: 'OVERBOUGHT' });
    const usd = state('USD');
    const eur = state('EUR');
    const gbp = state('GBP');

    // USDJPY: base=USD, quote=JPY
    expect(resolvePairAction(usd, jpyOverbought)).toBe('BUY');
    // EURJPY: base=EUR, quote=JPY
    expect(resolvePairAction(eur, jpyOverbought)).toBe('BUY');
    // GBPJPY: base=GBP, quote=JPY
    expect(resolvePairAction(gbp, jpyOverbought)).toBe('BUY');
  });

  it('spec worked example: EUR Overbought (as BASE) -> SELL EURUSD', () => {
    const eurOverbought = state('EUR', { zone: 'OVERBOUGHT' });
    const usd = state('USD');
    expect(resolvePairAction(eurOverbought, usd)).toBe('SELL');
  });

  it('spec worked example: GBP Oversold (as BASE) -> BUY GBPJPY', () => {
    const gbpOversold = state('GBP', { zone: 'OVERSOLD' });
    const jpy = state('JPY');
    expect(resolvePairAction(gbpOversold, jpy)).toBe('BUY');
  });

  it('spec worked example: USD Oversold (as QUOTE) -> SELL EURUSD', () => {
    const eur = state('EUR');
    const usdOversold = state('USD', { zone: 'OVERSOLD' });
    expect(resolvePairAction(eur, usdOversold)).toBe('SELL');
  });

  it('returns null when neither currency has a Stage A zone reading', () => {
    expect(resolvePairAction(state('USD'), state('EUR'))).toBeNull();
  });
});

describe('classifyConfluence', () => {
  it('is DOUBLE_CONFLUENCE when one side confirms sell and the other confirms buy, in either order', () => {
    const sell = state('EUR', { signal: 'CONFIRMED_SELL' });
    const buy = state('JPY', { signal: 'CONFIRMED_BUY' });
    expect(classifyConfluence(sell, buy)).toBe('DOUBLE_CONFLUENCE');
    expect(classifyConfluence(buy, sell)).toBe('DOUBLE_CONFLUENCE');
  });

  it('is SINGLE_CONFIRMED when only one side has a confirmed Stage B signal', () => {
    const confirmed = state('EUR', { signal: 'CONFIRMED_SELL' });
    expect(classifyConfluence(confirmed, state('JPY'))).toBe(
      'SINGLE_CONFIRMED'
    );
  });

  it('is SINGLE_CONFLUENCE when one side is merely in a Stage A zone, unconfirmed', () => {
    const zoned = state('EUR', { zone: 'OVERBOUGHT' });
    expect(classifyConfluence(zoned, state('JPY'))).toBe('SINGLE_CONFLUENCE');
  });

  it('is BASELINE_DIVERGENCE when neither side has any zone or signal', () => {
    expect(classifyConfluence(state('EUR'), state('JPY'))).toBe(
      'BASELINE_DIVERGENCE'
    );
  });

  it('two same-direction confirmed signals (not opposite) are SINGLE_CONFIRMED, not DOUBLE_CONFLUENCE', () => {
    const bothSell = [
      state('EUR', { signal: 'CONFIRMED_SELL' }),
      state('JPY', { signal: 'CONFIRMED_SELL' }),
    ] as const;
    expect(classifyConfluence(...bothSell)).toBe('SINGLE_CONFIRMED');
  });
});

describe('scorePairs', () => {
  function allNeutralStates(): Record<CurrencyCode, IndexState> {
    const currencies: CurrencyCode[] = [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF',
      'NZD',
    ];
    return Object.fromEntries(currencies.map((c) => [c, state(c)])) as Record<
      CurrencyCode,
      IndexState
    >;
  }

  it('scores and ranks all 28 pairs, sorted descending by score', () => {
    const states = allNeutralStates();
    states.EUR = state('EUR', { changePct: 0.9, zone: 'OVERBOUGHT' });
    states.JPY = state('JPY', { changePct: -0.9, zone: 'OVERSOLD' });

    const scores = scorePairs(states);
    expect(scores).toHaveLength(28);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.score).toBeGreaterThanOrEqual(scores[i]!.score);
    }
  });

  it('weights a Double Confluence (Golden Setup) pair at 4x the baseline divergence', () => {
    const states = allNeutralStates();
    // EURJPY divergence spread = |0.9 - (-0.9)| = 1.8 either way.
    states.EUR = state('EUR', {
      changePct: 0.9,
      zone: 'OVERBOUGHT',
      signal: 'CONFIRMED_SELL',
    });
    states.JPY = state('JPY', {
      changePct: -0.9,
      zone: 'OVERSOLD',
      signal: 'CONFIRMED_BUY',
    });

    const scores = scorePairs(states);
    const eurjpy = scores.find((p) => p.pair === 'EURJPY')!;
    expect(eurjpy.confluenceLevel).toBe('DOUBLE_CONFLUENCE');
    expect(eurjpy.divergenceSpread).toBeCloseTo(1.8, 8);
    expect(eurjpy.score).toBeCloseTo(1.8 * 4.0, 8);
  });

  it('throws rather than silently scoring against a missing currency state', () => {
    const states = allNeutralStates();
    // @ts-expect-error -- deliberately deleting a required key for this test
    delete states.NZD;
    expect(() => scorePairs(states)).toThrow(/NZD/);
  });
});
