/**
 * @jest-environment node
 */

/**
 * Property tests over generated profiles (build step 5, part 1).
 *
 * Each case is a profile that passed `validateProfile`, a broker row, a side,
 * an entry, a stop and a risk chosen inside the profile's own limits. The
 * generator is seeded and works in BigInt, so a failure repeats on every
 * machine. Every property is checked in exact arithmetic.
 */

import {
  PROFILE_BOUNDS,
  Rational,
  buildScenarios,
  completeProfile,
  sizeSetup,
  targetAt,
  underflowHelp,
} from '@/lib/engine4';
import type {
  SizedSetup,
  SizingInput,
  SymbolSpecInput,
  TraderProfile,
  UnderflowHelp,
  UnderflowSetup,
} from '@/lib/engine4';

import { decimalText, makeRng } from './helpers/rng';
import type { Rng } from './helpers/rng';

const r = (text: string): Rational => Rational.of(text);
const HUNDRED = Rational.int(100n);

const spec = (
  contractSize: string,
  volume: [string, string, string],
  typicalSpread: string,
  point: string
): SymbolSpecInput => ({
  contractSize,
  volumeMin: volume[0],
  volumeStep: volume[1],
  volumeMax: volume[2],
  typicalSpread,
  point,
});

const SPECS: SymbolSpecInput[] = [
  spec('100', ['0.01', '0.01', '100'], '0', '0.01'),
  spec('100', ['0.01', '0.01', '100'], '25', '0.01'),
  spec('100', ['0.01', '0.01', '5'], '40', '0.01'),
  spec('100', ['0.10', '0.10', '100'], '20', '0.01'),
  spec('100', ['0.05', '0.05', '30'], '10', '0.01'),
  spec('10', ['0.01', '0.01', '500'], '30', '0.01'),
  spec('1000', ['0.01', '0.01', '100'], '5', '0.001'),
  spec('5000', ['0.10', '0.10', '50'], '3', '0.001'),
  spec('100', ['0.001', '0.001', '100'], '12', '0.01'),
];

interface Generated {
  profile: TraderProfile;
  /** the risk chosen for this trade: at or under the profile's Max RPT */
  riskPct: string;
  input: SizingInput;
  /** this SETUP is counter-trend (ADR-064) */
  counterTrend: boolean;
  structuralStops: string[];
}

function generate(rng: Rng): Generated {
  const style = rng.pick([
    'TREND_FOLLOWING',
    'TREND_COUNTERING',
    'BOTH',
  ] as const);
  const band = rng.int(0n, 9n);
  const equityCents =
    band < 2n
      ? rng.int(100_000n, 999_999n)
      : band < 6n
        ? rng.int(1_000_000n, 9_999_999n)
        : rng.int(10_000_000n, 99_999_999n);
  const built = completeProfile({
    traderType: rng.pick(['SCALPER', 'DAY_TRADER'] as const),
    style,
    maxRiskPct: rng.pick(['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2']),
    maxLeverage: rng.pick(['0.75', '1', '1.5', '2', '2.5', '3', '4.2', '5']),
    // a Trend Countering profile may not go above 2.50 (6.2)
    targetRrr: decimalText(
      rng.int(150n, style === 'TREND_COUNTERING' ? 250n : 350n),
      2
    ),
    equity: decimalText(equityCents, 2),
    minSld: rng.pick(['5', '8', '13', '20']),
    commission: rng.pick(['0', '2', '3.5', '4', '7.25', '10']),
  });
  if (!built.ok) {
    throw new Error(
      `the generator built a refused profile: ${JSON.stringify(built.issues)}`
    );
  }
  const profile = built.profile;

  const maxRiskUnits = r(profile.maxRiskPct).mul(HUNDRED).floor();
  const riskPct = decimalText(rng.int(50n, maxRiskUnits), 2);
  const minSldUnits = r(profile.minSld).mul(HUNDRED).floor();
  const structuralStops: string[] = [];
  for (let count = rng.int(0n, 4n); count > 0n; count -= 1n) {
    structuralStops.push(
      decimalText(rng.int(minSldUnits, minSldUnits + 3_000n), 2)
    );
  }
  return {
    profile,
    riskPct,
    counterTrend: style === 'TREND_COUNTERING' || rng.chance(30n),
    structuralStops,
    input: {
      side: rng.pick(['BUY', 'SELL'] as const),
      entry: decimalText(rng.int(100_000n, 550_000n), 2),
      // at most $150, so that even a SELL's largest target stays above zero
      stopDistance: decimalText(rng.int(300n, 15_000n), 2),
      equity: profile.equity,
      riskPct,
      maxLeverage: profile.maxLeverage,
      commission: profile.commission,
      spec: rng.pick(SPECS),
    },
  };
}

const CASES = 4000;
const SEED = 20261009n;
const generated: Generated[] = (() => {
  const rng = makeRng(SEED);
  const out: Generated[] = [];
  for (let i = 0; i < CASES; i += 1) out.push(generate(rng));
  return out;
})();

interface SizedItem {
  g: Generated;
  result: SizedSetup;
}
interface UnderflowItem {
  g: Generated;
  result: UnderflowSetup;
}

const sized: SizedItem[] = [];
const underflowed: UnderflowItem[] = [];
for (const g of generated) {
  const result = sizeSetup(g.input);
  if (result.status === 'OK') sized.push({ g, result });
  else underflowed.push({ g, result });
}

/** Up to three failures, each with the input that caused it. */
function failures<T extends { g: Generated }>(
  items: T[],
  check: (item: T) => string | null
): string[] {
  const out: string[] = [];
  for (const item of items) {
    const message = check(item);
    if (message !== null) {
      out.push(`${message} :: ${JSON.stringify(item.g.input)}`);
      if (out.length >= 3) break;
    }
  }
  return out;
}

const contract = (g: Generated): Rational =>
  r(g.input.spec.contractSize as string);
const minimum = (g: Generated): Rational => r(g.input.spec.volumeMin as string);
const contextOf = (g: Generated) => ({
  maxRiskPct: g.profile.maxRiskPct,
  minSld: g.profile.minSld,
  structuralStopDistances: g.structuralStops,
});

describe('the generator', () => {
  test('is repeatable, and covers sized setups and underflows of every cause', () => {
    expect(generate(makeRng(SEED)).input).toEqual(generated[0]?.input);
    expect(sized.length).toBeGreaterThan(CASES / 4);
    expect(underflowed.length).toBeGreaterThan(CASES / 10);
    const causes = new Set(
      underflowed.map(({ result }) => result.causes.join('+'))
    );
    expect(causes).toEqual(new Set(['RISK', 'LEVERAGE', 'RISK+LEVERAGE']));
    const limits = new Set(sized.map(({ result }) => result.limitedBy));
    expect(limits).toEqual(new Set(['RISK', 'LEVERAGE', 'BROKER_MAX']));
    expect(new Set(generated.map((g) => g.input.side))).toEqual(
      new Set(['BUY', 'SELL'])
    );
    expect(new Set(generated.map((g) => g.profile.style)).size).toBe(3);
  });

  test('every profile is inside the 6.2 bounds and every risk is inside Max RPT', () => {
    expect(
      failures(
        generated.map((g) => ({ g })),
        ({ g }) => {
          const risk = r(g.profile.maxRiskPct);
          if (
            risk.lt(r(PROFILE_BOUNDS.maxRiskPct.min)) ||
            risk.gt(r(PROFILE_BOUNDS.maxRiskPct.max))
          ) {
            return 'Max RPT outside 0.5 to 2.0';
          }
          if (
            r(g.profile.maxLeverage).gt(r(PROFILE_BOUNDS.maxLeverageCeiling))
          ) {
            return 'leverage above the 1:5 ceiling';
          }
          return r(g.riskPct).gt(risk) ? 'risk above Max RPT' : null;
        }
      )
    ).toEqual([]);
  });
});

describe('the lot', () => {
  test('is never rounded up, sits on the lot step, and is as large as the step allows', () => {
    expect(
      failures(sized, ({ g, result }) => {
        const step = r(g.input.spec.volumeStep as string);
        if (result.lot.gt(result.rawLot))
          return 'lot above the raw lot (rounded up)';
        if (!result.lot.div(step).isInteger())
          return 'lot is not a multiple of the step';
        if (result.rawLot.sub(result.lot).gte(step))
          return 'lot is a whole step below the raw lot';
        return null;
      })
    ).toEqual([]);
  });

  test('is between the broker minimum and the broker maximum', () => {
    expect(
      failures(sized, ({ g, result }) =>
        result.lot.lt(minimum(g)) ||
        result.lot.gt(r(g.input.spec.volumeMax as string))
          ? 'lot outside the broker limits'
          : null
      )
    ).toEqual([]);
  });

  test('never exceeds the leverage lot or the risk lot', () => {
    expect(
      failures(sized, ({ result }) =>
        result.lot.gt(result.maxLotByLeverage) ||
        result.lot.gt(result.lotAtStop)
          ? 'lot above a limit'
          : null
      )
    ).toEqual([]);
  });

  test('leverage used is never above the limit, and is lot x contract x fill / equity', () => {
    expect(
      failures(sized, ({ g, result }) => {
        const worked = result.lot
          .mul(contract(g))
          .mul(result.fillPrice)
          .div(r(g.profile.equity));
        if (!worked.eq(result.leverageUsed))
          return 'leverage used is not lot x contract x fill / equity';
        return result.leverageUsed.gt(r(g.profile.maxLeverage))
          ? 'leverage used above the limit'
          : null;
      })
    ).toEqual([]);
  });

  test('actual risk is at or under declared risk, which is at or under Max RPT', () => {
    expect(
      failures(sized, ({ g, result }) => {
        if (result.actualRisk.gt(result.declaredRisk))
          return 'actual risk above declared';
        const ceiling = r(g.profile.maxRiskPct)
          .div(HUNDRED)
          .mul(r(g.profile.equity));
        if (result.actualRisk.gt(ceiling)) return 'actual risk above Max RPT';
        return result.actualRiskPct.gt(r(g.profile.maxRiskPct))
          ? 'actual risk % above Max RPT'
          : null;
      })
    ).toEqual([]);
  });

  test('actual risk is what the stop costs: fill to stop, times the lot, plus the commission', () => {
    expect(
      failures(sized, ({ g, result }) => {
        const perOunce =
          result.side === 'BUY'
            ? result.fillPrice.sub(result.stopPrice)
            : result.stopPrice.sub(result.fillPrice);
        const loss = result.lot
          .mul(contract(g))
          .mul(perOunce)
          .add(result.lot.mul(result.commission));
        return loss.eq(result.actualRisk)
          ? null
          : 'actual risk differs from the price-based loss';
      })
    ).toEqual([]);
  });

  test('more equity never gives a smaller lot; a wider stop never gives a larger one', () => {
    const lotOf = (input: SizingInput): Rational => {
      const result = sizeSetup(input);
      return result.status === 'OK' ? result.lot : Rational.ZERO;
    };
    expect(
      failures(
        generated.slice(0, 1500).map((g) => ({ g })),
        ({ g }) => {
          const base = lotOf(g.input);
          const richer = lotOf({
            ...g.input,
            equity: r(g.input.equity as string)
              .mul(r('1.5'))
              .toString(),
          });
          if (richer.lt(base)) return 'more equity gave a smaller lot';
          const wider = lotOf({
            ...g.input,
            stopDistance: r(g.input.stopDistance as string)
              .mul(r('1.5'))
              .toString(),
          });
          return wider.gt(base) ? 'a wider stop gave a larger lot' : null;
        }
      )
    ).toEqual([]);
  });

  test('the same input always gives the same result', () => {
    for (const g of generated.slice(0, 300)) {
      expect(JSON.stringify(sizeSetup(g.input))).toBe(
        JSON.stringify(sizeSetup({ ...g.input }))
      );
    }
  });
});

describe('the targets and net profit', () => {
  test('net profit is exactly RRR x actual risk for every scenario (ADR-065)', () => {
    let checked = 0;
    for (const { g } of sized) {
      const set = buildScenarios(g.input, {
        targetRrr: g.profile.targetRrr,
        counterTrend: g.counterTrend,
      });
      if (set.sizing.status !== 'OK')
        throw new Error('sized above, underflow here');
      for (const scenario of set.scenarios) {
        const profit = scenario.target.netProfit;
        if (profit === null) throw new Error('no net profit with a lot');
        expect(profit.eq(scenario.rrr.mul(set.sizing.actualRisk))).toBe(true);
        expect(profit.div(set.sizing.actualRisk).eq(scenario.rrr)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(sized.length * 2);
  });

  test('net profit is what the target pays: fill to target, times the lot, less the commission', () => {
    let checked = 0;
    for (const { g, result } of sized.slice(0, 1200)) {
      for (const rrr of ['1.5', '2.85', '3.5']) {
        const target = targetAt(result, rrr);
        const perOunce =
          result.side === 'BUY'
            ? target.targetPrice.sub(result.fillPrice)
            : result.fillPrice.sub(target.targetPrice);
        const paid = result.lot
          .mul(contract(g))
          .mul(perOunce)
          .sub(result.lot.mul(result.commission));
        expect(target.netProfit?.eq(paid)).toBe(true);
        expect(target.gainPerOunce.eq(perOunce)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  test('the chart level differs from the trigger price only for a SELL, by exactly the spread', () => {
    for (const { result } of sized.slice(0, 600)) {
      const target = targetAt(result, '1.75');
      if (result.side === 'BUY') {
        expect(target.targetChartLevel.eq(target.targetPrice)).toBe(true);
        expect(result.stopChartLevel.eq(result.stopPrice)).toBe(true);
      } else {
        expect(
          target.targetPrice.sub(target.targetChartLevel).eq(result.spreadPrice)
        ).toBe(true);
        expect(
          result.stopPrice.sub(result.stopChartLevel).eq(result.spreadPrice)
        ).toBe(true);
      }
    }
  });

  test('with a spread of zero a BUY and a SELL size the same lot, risk and profit', () => {
    for (const { g } of generated.slice(0, 800).map((g) => ({ g }))) {
      const flat = { ...g.input.spec, typicalSpread: '0' };
      const buy = sizeSetup({ ...g.input, side: 'BUY', spec: flat });
      const sell = sizeSetup({ ...g.input, side: 'SELL', spec: flat });
      expect(buy.status).toBe(sell.status);
      if (buy.status === 'OK' && sell.status === 'OK') {
        expect(buy.lot.eq(sell.lot)).toBe(true);
        expect(buy.actualRisk.eq(sell.actualRisk)).toBe(true);
        expect(buy.leverageUsed.eq(sell.leverageUsed)).toBe(true);
        const a = targetAt(buy, g.profile.targetRrr);
        const b = targetAt(sell, g.profile.targetRrr);
        expect(a.targetDistance.eq(b.targetDistance)).toBe(true);
        expect(a.netProfit?.toString()).toBe(b.netProfit?.toString());
      }
    }
  });
});

describe('the scenarios', () => {
  test('are one notch apart, inside 1.50 to 3.50, and never above 2.50 for a counter-trend setup', () => {
    for (const g of generated) {
      const set = buildScenarios(g.input, {
        targetRrr: g.profile.targetRrr,
        counterTrend: g.counterTrend,
      });
      const values = set.scenarios.map((s) => s.rrr);
      for (const value of values) {
        expect(value.gte(r('1.5')) && value.lte(r('3.5'))).toBe(true);
        if (g.counterTrend) expect(value.lte(r('2.5'))).toBe(true);
      }
      for (let i = 1; i < values.length; i += 1) {
        expect(
          (values[i] as Rational).sub(values[i - 1] as Rational).eq(r('0.25'))
        ).toBe(true);
      }
      const normal = set.scenarios.find((s) => s.name === 'NORMAL');
      const wanted =
        g.counterTrend && r(g.profile.targetRrr).gt(r('2.5'))
          ? r('2.5')
          : r(g.profile.targetRrr);
      expect(normal?.rrr.eq(wanted)).toBe(true);
    }
  });
});

describe('an underflow', () => {
  test('has no lot: the minimum is never rounded up to, and the raw lot is below it', () => {
    for (const { g, result } of underflowed) {
      expect(result.lot).toBeNull();
      expect(result.rawLot.lt(minimum(g))).toBe(true);
    }
  });

  test('never offers anything above Max RPT, below Min SLD, or in another equity', () => {
    let offers = 0;
    for (const { g } of underflowed) {
      const found = underflowHelp(g.input, contextOf(g)) as UnderflowHelp;
      const equity = r(g.profile.equity);
      expect(found.options[found.options.length - 1]).toEqual({
        kind: 'DECLINE',
      });
      for (const option of found.options) {
        expect(
          Object.keys(option).some((key) => /equity|leverage/i.test(key))
        ).toBe(false);
        if (option.kind === 'RAISE_RISK') {
          expect(option.riskPct.lte(r(g.profile.maxRiskPct))).toBe(true);
          expect(
            option.actualRisk.lte(option.riskPct.div(HUNDRED).mul(equity))
          ).toBe(true);
          offers += 1;
        }
        if (option.kind === 'NEARER_STRUCTURAL_STOP') {
          expect(option.stopDistance.gte(r(g.profile.minSld))).toBe(true);
          expect(
            option.stopDistance.lt(r(g.input.stopDistance as string))
          ).toBe(true);
          expect(
            option.actualRisk.lte(r(g.riskPct).div(HUNDRED).mul(equity))
          ).toBe(true);
          offers += 1;
        }
      }
    }
    expect(offers).toBeGreaterThan(20);
  });

  test("every offer, when taken, gives a lot within the trader's own limits", () => {
    for (const { g } of underflowed) {
      const found = underflowHelp(g.input, contextOf(g)) as UnderflowHelp;
      for (const option of found.options) {
        let taken: ReturnType<typeof sizeSetup> | null = null;
        if (option.kind === 'RAISE_RISK') {
          taken = sizeSetup({ ...g.input, riskPct: option.riskPct.toString() });
        } else if (option.kind === 'NEARER_STRUCTURAL_STOP') {
          taken = sizeSetup({
            ...g.input,
            stopDistance: option.stopDistance.toString(),
          });
        }
        if (taken === null) continue;
        expect(taken.status).toBe('OK');
        if (taken.status === 'OK') {
          expect(taken.actualRiskPct.lte(r(g.profile.maxRiskPct))).toBe(true);
          expect(taken.leverageUsed.lte(r(g.profile.maxLeverage))).toBe(true);
        }
      }
    }
  });

  test('a leverage underflow offers only Decline, and its fact is the exact equity at which a minimum lot fits', () => {
    const blocked = underflowed.filter(({ result }) =>
      result.causes.includes('LEVERAGE')
    );
    expect(blocked.length).toBeGreaterThan(50);
    for (const { g, result } of blocked) {
      const found = underflowHelp(g.input, contextOf(g)) as UnderflowHelp;
      expect(found.options).toEqual([{ kind: 'DECLINE' }]);
      const fact = found.facts.find(
        (f) => f.kind === 'EQUITY_NEEDED_FOR_LEVERAGE'
      );
      if (fact?.kind !== 'EQUITY_NEEDED_FOR_LEVERAGE')
        throw new Error('missing fact');
      const lotThere = fact.equity
        .mul(r(g.profile.maxLeverage))
        .div(result.fillPrice.mul(contract(g)));
      expect(lotThere.eq(minimum(g))).toBe(true);
    }
  });

  test('the equity facts are exact thresholds: enough at the rounded-up cent, not enough a cent below', () => {
    let checked = 0;
    for (const { g } of underflowed.slice(0, 1500)) {
      const found = underflowHelp(g.input, contextOf(g)) as UnderflowHelp;
      for (const fact of found.facts) {
        const cent = r('0.01');
        const enough = fact.equity.ceilToMultiple(cent);
        const short = enough.sub(cent);
        const at = (equity: Rational) =>
          sizeSetup({ ...g.input, equity: equity.toString() });
        const lotLimit = (equity: Rational): Rational =>
          fact.kind === 'EQUITY_NEEDED_FOR_RISK'
            ? at(equity).lotAtStop
            : at(equity).maxLotByLeverage;
        expect(lotLimit(enough).gte(minimum(g))).toBe(true);
        if (short.isPositive())
          expect(lotLimit(short).lt(minimum(g))).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
