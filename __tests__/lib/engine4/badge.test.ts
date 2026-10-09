/**
 * @jest-environment node
 */

import {
  Rational,
  badgeContextFromReading,
  buildScenarios,
  decideBadge,
} from '@/lib/engine4';
import type { BadgeContext, Level, Scenario, SizingInput } from '@/lib/engine4';

const r = (text: string): Rational => Rational.of(text);

const GOLD = {
  contractSize: '100',
  volumeMin: '0.01',
  volumeStep: '0.01',
  volumeMax: '100',
  typicalSpread: '0',
  point: '0.01',
};

/** The 6.7 example: a BUY at 2,545.00 with a $15.00 stop. Targets at 1.5, 1.75 and 2.0: 2567.60, 2571.36, 2575.12. */
const BUY: SizingInput = {
  side: 'BUY',
  entry: '2545.00',
  stopDistance: '15.00',
  equity: '10000',
  riskPct: '1.00',
  maxLeverage: '5',
  commission: '4',
  spec: GOLD,
};
const SELL: SizingInput = { ...BUY, side: 'SELL' };

const scenariosOf = (
  input: SizingInput,
  targetRrr = '1.75',
  counterTrend = false
): Scenario[] => buildScenarios(input, { targetRrr, counterTrend }).scenarios;

const level = (price: string): Level => ({
  name: 'sr_1',
  tf: 'M15',
  price: r(price),
  origin: 'sr_levels',
});

const WITH_TREND_BOTH: BadgeContext = {
  trendRelation: 'WITH_TREND',
  conflict: false,
  trendOnBothTimeframes: true,
};
const WITH_TREND_ONE: BadgeContext = {
  trendRelation: 'WITH_TREND',
  conflict: false,
  trendOnBothTimeframes: false,
};
const COUNTER: BadgeContext = {
  trendRelation: 'COUNTER_TREND',
  conflict: false,
  trendOnBothTimeframes: false,
};
const CONFLICT: BadgeContext = {
  trendRelation: 'WITH_TREND',
  conflict: true,
  trendOnBothTimeframes: true,
};

function badgeFor(
  context: BadgeContext,
  nextLevel: Level | null,
  input: SizingInput = BUY,
  scenarios: Scenario[] = scenariosOf(input)
) {
  return decideBadge({ side: input.side, context, scenarios, nextLevel });
}

describe('the table of architecture 6.5 (BUY, targets 2567.60, 2571.36, 2575.12)', () => {
  test('with the trend on M5 and M15 and room for all three: Aggressive', () => {
    const result = badgeFor(WITH_TREND_BOTH, level('2580'));
    expect(result.badge).toBe('AGGRESSIVE');
    expect(result.row).toBe('WITH_TREND_BOTH_TIMEFRAMES');
    expect(result.cap).toBe('AGGRESSIVE');
    expect(result.fitting).toEqual(['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE']);
    expect(result.noBadgeReason).toBeNull();
  });

  test('with the trend on M5 and M15 but room only for Normal: Normal', () => {
    const result = badgeFor(WITH_TREND_BOTH, level('2573'));
    expect(result.badge).toBe('NORMAL');
    expect(result.fitting).toEqual(['CONSERVATIVE', 'NORMAL']);
  });

  test('with the trend on M5 and M15 but room only for Conservative: Conservative', () => {
    const result = badgeFor(WITH_TREND_BOTH, level('2570'));
    expect(result.badge).toBe('CONSERVATIVE');
    expect(result.fitting).toEqual(['CONSERVATIVE']);
  });

  test('with the trend on one timeframe only: never above Normal', () => {
    const roomy = badgeFor(WITH_TREND_ONE, level('2580'));
    expect(roomy.badge).toBe('NORMAL');
    expect(roomy.row).toBe('WITH_TREND');
    expect(roomy.cap).toBe('NORMAL');
    // the Aggressive target fits but is not allowed the badge
    expect(roomy.fitting).toContain('AGGRESSIVE');
    expect(badgeFor(WITH_TREND_ONE, level('2570')).badge).toBe('CONSERVATIVE');
  });

  test('counter-trend: Conservative however much room there is', () => {
    const result = badgeFor(COUNTER, level('2580'));
    expect(result.badge).toBe('CONSERVATIVE');
    expect(result.row).toBe('COUNTER_TREND');
    expect(result.cap).toBe('CONSERVATIVE');
    expect(result.fitting).toEqual(['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE']);
  });

  test('a conflict: Conservative, even with the trend on both timeframes', () => {
    const result = badgeFor(CONFLICT, level('2580'));
    expect(result.badge).toBe('CONSERVATIVE');
    expect(result.row).toBe('CONFLICT');
  });

  test('counter-trend wins over a conflict in naming the row', () => {
    const both = badgeFor(
      {
        trendRelation: 'COUNTER_TREND',
        conflict: true,
        trendOnBothTimeframes: false,
      },
      null
    );
    expect(both.row).toBe('COUNTER_TREND');
    expect(both.badge).toBe('CONSERVATIVE');
  });

  test('no opposing level at all: every scenario fits and the row decides', () => {
    expect(badgeFor(WITH_TREND_BOTH, null).badge).toBe('AGGRESSIVE');
    expect(badgeFor(WITH_TREND_ONE, null).badge).toBe('NORMAL');
    expect(badgeFor(COUNTER, null).badge).toBe('CONSERVATIVE');
  });

  test('the level is carried so the report can name it', () => {
    const named = level('2573');
    expect(badgeFor(WITH_TREND_BOTH, named).nextLevel).toBe(named);
    expect(badgeFor(WITH_TREND_BOTH, null).nextLevel).toBeNull();
  });
});

describe('no scenario fits before the next level: no badge', () => {
  test('a level below the lowest target', () => {
    const result = badgeFor(WITH_TREND_BOTH, level('2560'));
    expect(result.badge).toBeNull();
    expect(result.noBadgeReason).toBe('NO_SCENARIO_FITS');
    expect(result.fitting).toEqual([]);
  });

  test('every row alike', () => {
    for (const context of [
      WITH_TREND_BOTH,
      WITH_TREND_ONE,
      COUNTER,
      CONFLICT,
    ]) {
      expect(badgeFor(context, level('2560')).badge).toBeNull();
    }
  });

  test('a target exactly AT the level is not before it (D8)', () => {
    const at = badgeFor(WITH_TREND_BOTH, level('2567.60'));
    expect(at.badge).toBeNull();
    expect(at.noBadgeReason).toBe('NO_SCENARIO_FITS');
    const justBefore = badgeFor(WITH_TREND_BOTH, level('2567.61'));
    expect(justBefore.badge).toBe('CONSERVATIVE');
  });

  test('each scenario is judged on its own target', () => {
    // Normal is 2571.36: a level there gives Normal no room, Conservative still some
    expect(badgeFor(WITH_TREND_BOTH, level('2571.36')).fitting).toEqual([
      'CONSERVATIVE',
    ]);
    expect(badgeFor(WITH_TREND_BOTH, level('2571.37')).fitting).toEqual([
      'CONSERVATIVE',
      'NORMAL',
    ]);
  });
});

describe('a SELL is the mirror (targets 2522.40, 2518.64, 2514.88)', () => {
  test('the targets must stay above a support', () => {
    expect(badgeFor(WITH_TREND_BOTH, level('2510'), SELL).badge).toBe(
      'AGGRESSIVE'
    );
    expect(badgeFor(WITH_TREND_BOTH, level('2518'), SELL).badge).toBe('NORMAL');
    expect(badgeFor(WITH_TREND_BOTH, level('2520'), SELL).badge).toBe(
      'CONSERVATIVE'
    );
    expect(badgeFor(WITH_TREND_BOTH, level('2523'), SELL).badge).toBeNull();
  });

  test('at the level is not before it', () => {
    expect(badgeFor(WITH_TREND_BOTH, level('2522.40'), SELL).badge).toBeNull();
    expect(badgeFor(WITH_TREND_BOTH, level('2522.39'), SELL).badge).toBe(
      'CONSERVATIVE'
    );
  });
});

describe("the spread moves the target's chart level, and the badge follows the chart", () => {
  const wide: SizingInput = {
    ...BUY,
    spec: { ...GOLD, typicalSpread: '25' },
  };

  test("a BUY's target is 0.25 further out, so a level that the bare distance clears may not be cleared", () => {
    const scenarios = scenariosOf(wide);
    expect(scenarios[0]?.target.targetChartLevel.toString()).toBe('2568.225');
    // without the spread the Conservative target would be 2567.60 + ... : a level at 2568.20 is above 2567.60 but below 2568.225
    expect(
      badgeFor(WITH_TREND_BOTH, level('2568.20'), wide, scenarios).badge
    ).toBeNull();
    expect(
      badgeFor(WITH_TREND_BOTH, level('2568.23'), wide, scenarios).badge
    ).toBe('CONSERVATIVE');
  });
});

describe('scenarios that are not all there', () => {
  test('a counter-trend setup whose profile RRR is the 1.50 floor has no Conservative scenario: no badge within its style', () => {
    const scenarios = scenariosOf(BUY, '1.5', true);
    expect(scenarios.map((s) => s.name)).toEqual(['NORMAL', 'AGGRESSIVE']);
    const result = badgeFor(COUNTER, level('2590'), BUY, scenarios);
    expect(result.badge).toBeNull();
    expect(result.noBadgeReason).toBe('NO_SCENARIO_WITHIN_STYLE');
    expect(result.fitting).toEqual(['NORMAL', 'AGGRESSIVE']);
  });

  test('the same setup with the trend gets its Normal badge', () => {
    const scenarios = scenariosOf(BUY, '1.5', false);
    expect(badgeFor(WITH_TREND_ONE, level('2590'), BUY, scenarios).badge).toBe(
      'NORMAL'
    );
  });

  test('a lowest scenario that does not fit means no badge, whatever the higher ones do', () => {
    expect(
      decideBadge({
        side: 'BUY',
        context: WITH_TREND_BOTH,
        scenarios: [],
        nextLevel: level('2580'),
      })
    ).toMatchObject({ badge: null, noBadgeReason: 'NO_SCENARIO_FITS' });
  });

  test('with only the Aggressive scenario left it can carry the badge for the right row', () => {
    const only = scenariosOf(BUY).filter((s) => s.name === 'AGGRESSIVE');
    expect(badgeFor(WITH_TREND_BOTH, null, BUY, only).badge).toBe('AGGRESSIVE');
    expect(badgeFor(WITH_TREND_ONE, null, BUY, only).badge).toBeNull();
  });
});

describe('the context of a SYN reading', () => {
  const DEFAULT_INPUTS = {
    MCD1: {
      status: 'VALID',
      bias: 'LONG',
      state_code: 'MCD1_UP_IN_CORRIDOR',
    },
    MCD2: {
      status: 'VALID',
      bias: 'LONG',
      state_code: 'MCD2_UP_IN_CORRIDOR',
    },
    MCD3: {
      status: 'VALID',
      bias: 'LONG',
      state_code: 'MCD3_BULL_CONSOLIDATED',
    },
  };
  const reading = (
    over: Record<string, unknown> = {},
    inputs: Record<string, unknown> = DEFAULT_INPUTS
  ) => ({
    bias: 'LONG',
    trend_relation: 'WITH_TREND',
    inputs,
    ...over,
  });

  test('a with-trend reading whose two channel sensors agree: both timeframes', () => {
    expect(badgeContextFromReading(reading())).toEqual({
      trendRelation: 'WITH_TREND',
      conflict: false,
      trendOnBothTimeframes: true,
    });
  });

  test('a channel sensor that votes another way (or is absent) is not "the trend on both"', () => {
    const base = DEFAULT_INPUTS;
    expect(
      badgeContextFromReading(
        reading({}, { ...base, MCD1: { status: 'VALID', bias: 'SHORT' } })
      )?.trendOnBothTimeframes
    ).toBe(false);
    expect(
      badgeContextFromReading(
        reading({}, { ...base, MCD1: { status: 'ABSENT', bias: null } })
      )?.trendOnBothTimeframes
    ).toBe(false);
    expect(
      badgeContextFromReading(reading({}, { MCD2: base.MCD2 }))
        ?.trendOnBothTimeframes
    ).toBe(false);
    // and the same for MCD2, the M5 sensor
    expect(
      badgeContextFromReading(
        reading({}, { ...base, MCD2: { status: 'VALID', bias: 'SHORT' } })
      )?.trendOnBothTimeframes
    ).toBe(false);
    expect(
      badgeContextFromReading(
        reading({}, { ...base, MCD2: { status: 'ABSENT', bias: null } })
      )?.trendOnBothTimeframes
    ).toBe(false);
    expect(
      badgeContextFromReading(reading({}, { MCD1: base.MCD1 }))
        ?.trendOnBothTimeframes
    ).toBe(false);
  });

  test('the conflict is MCD3 reporting a trend conflict, and only that', () => {
    const base = DEFAULT_INPUTS;
    const withMcd3 = (state: string | null) =>
      badgeContextFromReading(
        reading(
          {},
          { ...base, MCD3: { status: 'CAUTIONARY', state_code: state } }
        )
      )?.conflict;
    expect(withMcd3('MCD3_NON_CONSOLIDATED_TREND_CONFLICT')).toBe(true);
    expect(withMcd3('MCD3_NON_CONSOLIDATED_OVERFLOW')).toBe(false);
    expect(withMcd3('MCD3_BULL_CONSOLIDATED')).toBe(false);
    expect(withMcd3(null)).toBe(false);
  });

  test('a counter-trend reading is never "with the trend on both"', () => {
    expect(
      badgeContextFromReading(reading({ trend_relation: 'COUNTER_TREND' }))
    ).toEqual({
      trendRelation: 'COUNTER_TREND',
      conflict: false,
      trendOnBothTimeframes: false,
    });
  });

  test('the direction of the reading is the one the channel sensors are compared with', () => {
    const base = DEFAULT_INPUTS;
    const short = badgeContextFromReading(
      reading(
        { bias: 'SHORT' },
        {
          ...base,
          MCD1: { status: 'VALID', bias: 'SHORT' },
          MCD2: { status: 'VALID', bias: 'SHORT' },
        }
      )
    );
    expect(short?.trendOnBothTimeframes).toBe(true);
  });

  test.each([
    ['a stand-aside', { bias: 'STAND_ASIDE', trend_relation: null }],
    ['a neutral', { bias: 'NEUTRAL', trend_relation: null }],
    ['no relation', { trend_relation: null }],
    ['an unknown relation', { trend_relation: 'SIDEWAYS' }],
  ])('%s has no badge context', (_why, over) => {
    expect(badgeContextFromReading(reading(over))).toBeNull();
  });

  test.each([null, undefined, 'x', 5, []])('%j has none', (value) => {
    expect(badgeContextFromReading(value)).toBeNull();
  });

  test('a reading without inputs has a context with no conflict and no trend on both', () => {
    expect(
      badgeContextFromReading({ bias: 'LONG', trend_relation: 'WITH_TREND' })
    ).toEqual({
      trendRelation: 'WITH_TREND',
      conflict: false,
      trendOnBothTimeframes: false,
    });
  });
});
