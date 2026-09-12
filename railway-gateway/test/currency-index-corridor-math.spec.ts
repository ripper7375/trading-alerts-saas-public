import {
  summarizeDayMetrics,
  computeVolatilityCorridor,
  FX_INDEX_NAMES,
} from '../src/worker/currency-index-corridor-math';

describe('FX_INDEX_NAMES', () => {
  it('lists exactly the 8 G8 currency indices, never XAUX', () => {
    expect(FX_INDEX_NAMES).toHaveLength(8);
    expect(FX_INDEX_NAMES).not.toContain('XAUX');
    expect(FX_INDEX_NAMES).toEqual(
      expect.arrayContaining([
        'USDX',
        'EURX',
        'GBPX',
        'JPYX',
        'AUDX',
        'CADX',
        'CHFX',
        'NZDX',
      ])
    );
  });
});

describe('summarizeDayMetrics', () => {
  it('returns null for an empty day (index had no data at all)', () => {
    expect(summarizeDayMetrics([])).toBeNull();
  });

  it('computes open/peak-high/peak-low/close from a bar sequence that both rises and falls', () => {
    // A day that opens at 0, rises to +0.82%, falls back through 0 to
    // -0.35%, then closes at -0.10%.
    const bars = [
      { bar_time: 100, value: 100.0, change_pct: 0.0 },
      { bar_time: 105, value: 100.82, change_pct: 0.82 },
      { bar_time: 110, value: 99.65, change_pct: -0.35 },
      { bar_time: 115, value: 99.9, change_pct: -0.1 },
    ];

    expect(summarizeDayMetrics(bars)).toEqual({
      open_value: 100.0,
      peak_high_pct: 0.82,
      peak_low_pct: 0.35,
      close_pct: -0.1,
    });
  });

  it('never reports a negative peak_low_pct even for a monotonically-rising day', () => {
    // Every bar stays at or above the open -- there was no real drawdown,
    // so peak_low_pct must be 0, not a fabricated negative-turned-positive
    // number.
    const bars = [
      { bar_time: 100, value: 100.0, change_pct: 0.0 },
      { bar_time: 105, value: 100.2, change_pct: 0.2 },
      { bar_time: 110, value: 100.5, change_pct: 0.5 },
    ];

    const summary = summarizeDayMetrics(bars);
    expect(summary?.peak_low_pct).toBe(0);
    expect(summary?.peak_high_pct).toBe(0.5);
  });

  it('reads open_value/close_pct from the actual first/last bar, not an assumed session-open value', () => {
    // Defensive case: the query window's first row isn't exactly the
    // session-open bar (a data gap) -- the function must use what it was
    // actually given, not fabricate a reference point.
    const bars = [
      { bar_time: 105, value: 100.3, change_pct: 0.3 },
      { bar_time: 110, value: 100.1, change_pct: 0.1 },
    ];

    expect(summarizeDayMetrics(bars)).toEqual({
      open_value: 100.3,
      peak_high_pct: 0.3,
      peak_low_pct: 0.1,
      close_pct: 0.1,
    });
  });
});

describe('computeVolatilityCorridor', () => {
  it('returns null for an empty pool (Lane 4 bootstrap: no prior closed days)', () => {
    expect(computeVolatilityCorridor([])).toBeNull();
  });

  it('returns zero std_dev for a single-point pool rather than NaN/Infinity', () => {
    const corridor = computeVolatilityCorridor([0.5]);
    expect(corridor).toEqual({
      mean_excursion: 0.5,
      std_dev: 0,
      strike_zone_pct: 0.5,
      extreme_zone_pct: 0.5,
    });
  });

  it('computes mu_basket/sigma_basket against a hand-computed example (spec Section 3.2)', () => {
    // 4-point pool: mean = (0.4+0.6+0.8+1.0)/4 = 0.7
    // sample variance = sum((x-0.7)^2) / (4-1)
    //   = (0.09 + 0.01 + 0.01 + 0.09) / 3 = 0.20 / 3 = 0.0666...
    // std_dev = sqrt(0.0666...) = 0.2581988897...
    const excursions = [0.4, 0.6, 0.8, 1.0];
    const corridor = computeVolatilityCorridor(excursions);

    expect(corridor?.mean_excursion).toBeCloseTo(0.7, 10);
    expect(corridor?.std_dev).toBeCloseTo(0.2581988897471611, 10);
    expect(corridor?.strike_zone_pct).toBeCloseTo(0.7, 10);
    expect(corridor?.extreme_zone_pct).toBeCloseTo(0.9581988897471611, 10);
  });

  it("pools every (currency, day) excursion flat, matching the spec's 1/(8N) denominator rather than averaging per-currency means first", () => {
    // 2 currencies x 2 days = 4 pooled points, not 2 per-currency averages
    // then averaged again -- the two groupings give different results, so
    // this pins the pooled-flat behavior explicitly.
    const excursions = [0.2, 0.2, 0.2, 1.8]; // one outlier day for one currency
    const corridor = computeVolatilityCorridor(excursions);
    // flat mean = (0.2+0.2+0.2+1.8)/4 = 0.6 -- NOT (avg(0.2,0.2)+avg(0.2,1.8))/2 = 0.7
    expect(corridor?.mean_excursion).toBeCloseTo(0.6, 10);
  });

  it('matches an INDEPENDENT numpy computation on a realistic 8-currency x 20-day dataset (Phase 5 spec V1: "matches Python pandas verification within 0.001%")', () => {
    // pandas is not installed in this environment; numpy's ddof=1 std is the
    // same sample-stddev primitive pandas.Series.std() delegates to, so this
    // is an equivalent independent cross-check. Reference values computed by
    // scratch/v1_corridor_crosscheck.py against this exact 160-element array
    // (deterministic, not random, so it's reproducible by hand):
    //   mean_excursion (mu_basket) = 0.72523510625
    //   std_dev (sigma_basket)     = 0.12182226007314206
    const excursions = [
      0.5, 0.562074, 0.585465, 0.567056, 0.54216, 0.552054, 0.606029, 0.672849,
      0.709468, 0.700606, 0.672799, 0.67, 0.713171, 0.781008, 0.82953, 0.832514,
      0.805605, 0.79193, 0.822451, 0.887494, 0.552074, 0.575465, 0.557056,
      0.53216, 0.542054, 0.596029, 0.662849, 0.699468, 0.690606, 0.662799, 0.66,
      0.703171, 0.771008, 0.81953, 0.822514, 0.795605, 0.78193, 0.812451,
      0.877494, 0.935647, 0.565465, 0.547056, 0.52216, 0.532054, 0.586029,
      0.652849, 0.689468, 0.680606, 0.652799, 0.65, 0.693171, 0.761008, 0.80953,
      0.812514, 0.785605, 0.77193, 0.802451, 0.867494, 0.925647, 0.941833,
      0.537056, 0.51216, 0.522054, 0.576029, 0.642849, 0.679468, 0.670606,
      0.642799, 0.64, 0.683171, 0.751008, 0.79953, 0.802514, 0.775605, 0.76193,
      0.792451, 0.857494, 0.915647, 0.931833, 0.909557, 0.50216, 0.512054,
      0.566029, 0.632849, 0.669468, 0.660606, 0.632799, 0.63, 0.673171,
      0.741008, 0.78953, 0.792514, 0.765605, 0.75193, 0.782451, 0.847494,
      0.905647, 0.921833, 0.899557, 0.877689, 0.502054, 0.556029, 0.622849,
      0.659468, 0.650606, 0.622799, 0.62, 0.663171, 0.731008, 0.77953, 0.782514,
      0.755605, 0.74193, 0.772451, 0.837494, 0.895647, 0.911833, 0.889557,
      0.867689, 0.884721, 0.546029, 0.612849, 0.649468, 0.640606, 0.612799,
      0.61, 0.653171, 0.721008, 0.76953, 0.772514, 0.745605, 0.73193, 0.762451,
      0.827494, 0.885647, 0.901833, 0.879557, 0.857689, 0.874721, 0.933382,
      0.602849, 0.639468, 0.630606, 0.602799, 0.6, 0.643171, 0.711008, 0.75953,
      0.762514, 0.735605, 0.72193, 0.752451, 0.817494, 0.875647, 0.891833,
      0.869557, 0.847689, 0.864721, 0.923382, 0.988128,
    ];
    expect(excursions).toHaveLength(160); // 8 currencies x 20 days

    const corridor = computeVolatilityCorridor(excursions);

    // 1e-9 -- far tighter than the spec's own 0.001% acceptance bar.
    expect(corridor?.mean_excursion).toBeCloseTo(0.72523510625, 9);
    expect(corridor?.std_dev).toBeCloseTo(0.12182226007314206, 9);
    expect(corridor?.strike_zone_pct).toBeCloseTo(0.72523510625, 9);
    expect(corridor?.extreme_zone_pct).toBeCloseTo(0.847057366323142, 9);
  });
});
