/**
 * @jest-environment node
 */

import {
  Engine4InputError,
  Rational,
  RRR_NOTCH,
  buildScenarios,
} from '@/lib/engine4';
import type { ScenarioSet, SizingInput, SymbolSpecInput } from '@/lib/engine4';

import {
  loadOracle,
  sameText,
  sameValue,
  toSizingInput,
} from './helpers/oracle';
import type { OracleScenarioSet } from './helpers/oracle';

const GOLD: SymbolSpecInput = {
  contractSize: '100',
  volumeMin: '0.01',
  volumeStep: '0.01',
  volumeMax: '100',
  typicalSpread: '0',
  point: '0.01',
};

const DOC: SizingInput = {
  side: 'BUY',
  entry: '2545.00',
  stopDistance: '15.00',
  equity: '10000',
  riskPct: '1.00',
  maxLeverage: '5',
  commission: '4',
  spec: GOLD,
};

const names = (set: ScenarioSet): string[] => set.scenarios.map((s) => s.name);
const rrrs = (set: ScenarioSet): string[] =>
  set.scenarios.map((s) => s.rrr.toString());

describe('Normal is the target RRR; one notch (0.25) each side', () => {
  test('the notch is 0.25 (D5)', () => {
    expect(RRR_NOTCH).toBe('0.25');
  });

  test('1.75 gives 1.50, 1.75, 2.00 (the 6.7 example)', () => {
    const set = buildScenarios(DOC, { targetRrr: '1.75', counterTrend: false });
    expect(names(set)).toEqual(['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE']);
    expect(rrrs(set)).toEqual(['1.5', '1.75', '2']);
    expect(set.omitted).toEqual([]);
    expect(set.normalRrr.toString()).toBe('1.75');
    expect(set.normalCapped).toBe(false);
  });

  test('all three share one lot and one stop; only the target moves', () => {
    const set = buildScenarios(DOC, { targetRrr: '1.75', counterTrend: false });
    expect(set.sizing.status).toBe('OK');
    const distances = set.scenarios.map((s) =>
      s.target.targetDistance.toDecimal(2)
    );
    expect(distances).toEqual(['22.60', '26.36', '30.12']);
    const prices = set.scenarios.map((s) => s.target.targetPrice.toDecimal(2));
    expect(prices).toEqual(['2567.60', '2571.36', '2575.12']);
    const net = set.scenarios.map((s) => s.target.netProfit?.toDecimal(2));
    expect(net).toEqual(['135.36', '157.92', '180.48']);
  });

  test('a typed RRR such as 2.85 is kept as it is', () => {
    const set = buildScenarios(DOC, { targetRrr: '2.85', counterTrend: false });
    expect(rrrs(set)).toEqual(['2.6', '2.85', '3.1']);
  });
});

describe('at the edges, the scenario that falls outside 1.50 to 3.50 is left out (D5)', () => {
  test('1.50: no Conservative', () => {
    const set = buildScenarios(DOC, { targetRrr: '1.5', counterTrend: false });
    expect(names(set)).toEqual(['NORMAL', 'AGGRESSIVE']);
    expect(set.omitted).toEqual([
      expect.objectContaining({
        name: 'CONSERVATIVE',
        reason: 'BELOW_MIN_RRR',
      }),
    ]);
    expect(set.omitted[0]?.rrr.toString()).toBe('1.25');
  });

  test('1.60: Conservative would be 1.35', () => {
    const set = buildScenarios(DOC, { targetRrr: '1.6', counterTrend: false });
    expect(names(set)).toEqual(['NORMAL', 'AGGRESSIVE']);
    expect(set.omitted[0]?.rrr.toString()).toBe('1.35');
  });

  test('1.75 keeps all three (1.50 is the lowest allowed)', () => {
    expect(
      names(buildScenarios(DOC, { targetRrr: '1.75', counterTrend: false }))
    ).toHaveLength(3);
  });

  test('3.50: no Aggressive', () => {
    const set = buildScenarios(DOC, { targetRrr: '3.5', counterTrend: false });
    expect(names(set)).toEqual(['CONSERVATIVE', 'NORMAL']);
    expect(set.omitted).toEqual([
      expect.objectContaining({ name: 'AGGRESSIVE', reason: 'ABOVE_MAX_RRR' }),
    ]);
  });

  test('3.25 keeps Aggressive at exactly 3.50', () => {
    const set = buildScenarios(DOC, { targetRrr: '3.25', counterTrend: false });
    expect(rrrs(set)).toEqual(['3', '3.25', '3.5']);
  });
});

describe('a counter-trend setup is capped at 2.50 (ADR-064)', () => {
  test('2.25: Aggressive would be 2.50, which is allowed', () => {
    const set = buildScenarios(DOC, { targetRrr: '2.25', counterTrend: true });
    expect(rrrs(set)).toEqual(['2', '2.25', '2.5']);
  });

  test('2.50: no Aggressive (2.75 passes the cap)', () => {
    const set = buildScenarios(DOC, { targetRrr: '2.5', counterTrend: true });
    expect(names(set)).toEqual(['CONSERVATIVE', 'NORMAL']);
    expect(set.omitted).toEqual([
      expect.objectContaining({
        name: 'AGGRESSIVE',
        reason: 'ABOVE_COUNTER_TREND_CAP',
      }),
    ]);
    expect(set.normalCapped).toBe(false);
  });

  test('a profile RRR above the cap is lowered to it for this setup, and says so', () => {
    const set = buildScenarios(DOC, { targetRrr: '3', counterTrend: true });
    expect(set.normalCapped).toBe(true);
    expect(set.normalRrr.toString()).toBe('2.5');
    expect(rrrs(set)).toEqual(['2.25', '2.5']);
  });

  test('the same RRR with the trend is untouched', () => {
    const set = buildScenarios(DOC, { targetRrr: '3', counterTrend: false });
    expect(set.normalCapped).toBe(false);
    expect(rrrs(set)).toEqual(['2.75', '3', '3.25']);
  });

  test('no scenario of a counter-trend setup ever passes 2.50', () => {
    for (const rrr of [
      '1.5',
      '1.75',
      '2',
      '2.25',
      '2.5',
      '2.75',
      '3',
      '3.25',
      '3.5',
    ]) {
      const set = buildScenarios(DOC, { targetRrr: rrr, counterTrend: true });
      for (const scenario of set.scenarios) {
        expect(scenario.rrr.lte(Rational.of('2.5'))).toBe(true);
      }
      expect(names(set)).toContain('NORMAL');
    }
  });

  test('every scenario is inside 1.50 to 3.50 and a notch apart', () => {
    for (const counterTrend of [false, true]) {
      for (let units = 150n; units <= 350n; units += 5n) {
        const text = `${units / 100n}.${(100n + (units % 100n)).toString().slice(1)}`;
        const set = buildScenarios(DOC, { targetRrr: text, counterTrend });
        const values = set.scenarios.map((s) => s.rrr);
        for (const value of values) {
          expect(
            value.gte(Rational.of('1.5')) && value.lte(Rational.of('3.5'))
          ).toBe(true);
        }
        for (let i = 1; i < values.length; i += 1) {
          const gap = (values[i] as Rational).sub(values[i - 1] as Rational);
          expect(gap.eq(Rational.of(RRR_NOTCH))).toBe(true);
        }
        expect(set.scenarios.length + set.omitted.length).toBe(3);
      }
    }
  });
});

describe('an underflow still shows where the targets would sit', () => {
  test('distances and prices are worked out, net profit is null', () => {
    const set = buildScenarios(
      { ...DOC, equity: '1500' },
      { targetRrr: '1.75', counterTrend: false }
    );
    expect(set.sizing.status).toBe('UNDERFLOW');
    expect(names(set)).toEqual(['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE']);
    for (const scenario of set.scenarios) {
      expect(scenario.target.netProfit).toBeNull();
    }
    expect(set.scenarios[1]?.target.targetDistance.toDecimal(2)).toBe('26.36');
  });
});

describe('what it refuses', () => {
  test.each(['1.49', '3.51', '0', '-2', '4', 'x'])(
    'a target RRR of %s',
    (value) => {
      expect(() =>
        buildScenarios(DOC, { targetRrr: value, counterTrend: false })
      ).toThrow(Engine4InputError);
    }
  );

  test('a counter-trend flag that is not true or false', () => {
    expect(() =>
      buildScenarios(DOC, { targetRrr: '1.75', counterTrend: 'yes' as never })
    ).toThrow(/counterTrend/);
    expect(() =>
      buildScenarios(DOC, {
        targetRrr: '1.75',
        counterTrend: undefined as never,
      })
    ).toThrow(Engine4InputError);
  });

  test('a sizing input the engine refuses', () => {
    expect(() =>
      buildScenarios(
        { ...DOC, entry: '0' },
        { targetRrr: '1.75', counterTrend: false }
      )
    ).toThrow(Engine4InputError);
  });
});

describe('against the independent oracle (scripts/engine4/oracle.py)', () => {
  const cases = loadOracle().cases;

  function compare(
    problems: string[],
    label: string,
    set: ScenarioSet,
    want: OracleScenarioSet
  ): void {
    sameValue(problems, `${label} normalRrr`, set.normalRrr, want.normal_rrr);
    if (set.normalCapped !== want.normal_capped) {
      problems.push(
        `${label} normalCapped: engine ${set.normalCapped} but oracle ${want.normal_capped}`
      );
    }
    if (set.scenarios.length !== want.scenarios.length) {
      problems.push(
        `${label} scenarios: engine ${names(set).join(',')} but oracle ${want.scenarios
          .map((s) => s.name)
          .join(',')}`
      );
    } else {
      set.scenarios.forEach((scenario, index) => {
        const w = want.scenarios[index];
        if (w === undefined) return;
        const at = `${label} ${w.name}`;
        sameText(problems, `${at} name`, scenario.name, w.name);
        sameValue(problems, `${at} rrr`, scenario.rrr, w.rrr);
        sameValue(
          problems,
          `${at} gainPerOunce`,
          scenario.target.gainPerOunce,
          w.gain_per_ounce
        );
        sameValue(
          problems,
          `${at} distance`,
          scenario.target.targetDistance,
          w.target_distance
        );
        sameText(
          problems,
          `${at} distance 2dp`,
          scenario.target.targetDistance.toDecimal(2),
          w.target_distance_2dp
        );
        sameValue(
          problems,
          `${at} price`,
          scenario.target.targetPrice,
          w.target_price
        );
        sameText(
          problems,
          `${at} price 2dp`,
          scenario.target.targetPrice.toDecimal(2),
          w.target_price_2dp
        );
        sameValue(
          problems,
          `${at} chart level`,
          scenario.target.targetChartLevel,
          w.target_chart_level
        );
        sameText(
          problems,
          `${at} chart level 2dp`,
          scenario.target.targetChartLevel.toDecimal(2),
          w.target_chart_level_2dp
        );
        sameValue(
          problems,
          `${at} net profit`,
          scenario.target.netProfit,
          w.net_profit
        );
        sameText(
          problems,
          `${at} net profit 2dp`,
          scenario.target.netProfit === null
            ? null
            : scenario.target.netProfit.toDecimal(2),
          w.net_profit_2dp
        );
      });
    }
    const got = set.omitted.map(
      (o) => `${o.name}:${o.rrr.toString()}:${o.reason}`
    );
    const exp = want.omitted.map(
      (o) => `${o.name}:${Rational.of(o.rrr).toString()}:${o.reason}`
    );
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      problems.push(
        `${label} omitted: engine ${got.join(' ')} but oracle ${exp.join(' ')}`
      );
    }
  }

  test.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const input = toSizingInput(c.input);
    const problems: string[] = [];
    compare(
      problems,
      'with the trend',
      buildScenarios(input, {
        targetRrr: c.input.target_rrr,
        counterTrend: false,
      }),
      c.with_trend
    );
    compare(
      problems,
      'counter-trend',
      buildScenarios(input, {
        targetRrr: c.input.target_rrr,
        counterTrend: true,
      }),
      c.counter_trend
    );
    expect(problems).toEqual([]);
  });
});
