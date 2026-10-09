/**
 * @jest-environment node
 */

import {
  Engine4InputError,
  Rational,
  resolveSymbolSpec,
  sizeSetup,
  sizeWithTarget,
  targetAt,
} from '@/lib/engine4';
import type { SizedSetup, SizingInput, SymbolSpecInput } from '@/lib/engine4';

import {
  loadOracle,
  sameText,
  sameValue,
  toSizingInput,
} from './helpers/oracle';

const GOLD: SymbolSpecInput = {
  contractSize: '100',
  volumeMin: '0.01',
  volumeStep: '0.01',
  volumeMax: '100',
  typicalSpread: '0',
  point: '0.01',
};

/** Architecture 6.7's worked example (file G's inputs): equity $10,000, BUY 2,545.00, 1.00% risk, $15.00 stop, $4 commission. */
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

const r = (text: string): Rational => Rational.of(text);

function ok(input: SizingInput): SizedSetup {
  const result = sizeSetup(input);
  if (result.status !== 'OK') {
    throw new Error(
      `expected a lot, got ${result.status}: ${result.causes.join(',')}`
    );
  }
  return result;
}

describe('the corrected 6.7 table (the unit-test fixture of the architecture)', () => {
  test('lot 0.06, declared $100.00, actual $90.24 (0.90%), leverage used 1.527x', () => {
    const sized = ok(DOC);
    expect(sized.lot.toString()).toBe('0.06');
    expect(sized.limitedBy).toBe('RISK');
    expect(sized.declaredRisk.toDecimal(2)).toBe('100.00');
    expect(sized.actualRisk.toDecimal(2)).toBe('90.24');
    expect(sized.actualRisk.toString()).toBe('90.24');
    expect(sized.actualRiskPct.toDecimal(2)).toBe('0.90');
    expect(sized.leverageUsed.toDecimal(3)).toBe('1.527');
    expect(sized.leverageUsed.toString()).toBe('1.527');
    expect(sized.stopPrice.toDecimal(2)).toBe('2530.00');
  });

  test.each([
    ['1.5', '22.60', '2567.60', '135.36'],
    ['1.75', '26.36', '2571.36', '157.92'],
    ['2', '30.12', '2575.12', '180.48'],
  ])(
    'RRR %s: distance %s, target %s, net profit %s',
    (rrr, distance, price, net) => {
      const { sizing, target } = sizeWithTarget(DOC, rrr);
      expect(sizing.status).toBe('OK');
      expect(target.targetDistance.toDecimal(2)).toBe(distance);
      expect(target.targetPrice.toDecimal(2)).toBe(price);
      expect(target.netProfit?.toDecimal(2)).toBe(net);
      // the figures are exact, not merely the rounding of something longer
      expect(target.targetDistance.eq(r(distance))).toBe(true);
      expect(target.targetPrice.eq(r(price))).toBe(true);
      expect(target.netProfit?.eq(r(net))).toBe(true);
    }
  );

  test('the same figures come out of the oracle (it is the document that is checked, twice)', () => {
    const oracle = loadOracle().cases.find((c) => c.id === 'doc-6.7-buy');
    expect(oracle).toBeDefined();
    expect(oracle?.sizing.lot).toBe('0.06');
    expect(oracle?.sizing.actual_risk_2dp).toBe('90.24');
    expect(oracle?.sizing.leverage_used_3dp).toBe('1.527');
    const normal = oracle?.with_trend.scenarios.map((s) => [
      s.rrr,
      s.target_distance_2dp,
      s.target_price_2dp,
      s.net_profit_2dp,
    ]);
    expect(normal).toEqual([
      ['1.5', '22.60', '2567.60', '135.36'],
      ['1.75', '26.36', '2571.36', '157.92'],
      ['2', '30.12', '2575.12', '180.48'],
    ]);
  });

  test('net profit is exactly RRR x actual risk, and RRR is net profit / actual loss (ADR-065)', () => {
    for (const rrr of ['1.5', '1.75', '2', '2.85', '3.5']) {
      const { sizing, target } = sizeWithTarget(DOC, rrr);
      if (sizing.status !== 'OK' || target.netProfit === null)
        throw new Error('no lot');
      expect(target.netProfit.eq(r(rrr).mul(sizing.actualRisk))).toBe(true);
      expect(target.netProfit.div(sizing.actualRisk).eq(r(rrr))).toBe(true);
    }
  });

  test('6.7 note: at the default 1:1.5 leverage the cap clamps this example to 0.05 lot', () => {
    const sized = ok({ ...DOC, maxLeverage: '1.5' });
    expect(sized.lot.toString()).toBe('0.05');
    expect(sized.limitedBy).toBe('LEVERAGE');
    expect(sized.actualRisk.toString()).toBe('75.2');
    expect(sized.leverageUsed.toString()).toBe('1.2725');
    expect(sized.leverageUsed.lte(r('1.5'))).toBe(true);
    expect(sized.declaredRisk.toString()).toBe('100');
  });
});

describe('plan F6: the default profile at the 18 Sep price', () => {
  const f6: SizingInput = {
    ...DOC,
    entry: '4367.20',
    stopDistance: '16.78',
    equity: '5000',
    riskPct: '1.50',
    maxLeverage: '1.5',
  };

  test('the leverage limit, not the risk limit, sets a 0.01 lot: actual risk $16.82 (0.34%) against $75.00', () => {
    const sized = ok(f6);
    expect(sized.lot.toString()).toBe('0.01');
    expect(sized.limitedBy).toBe('LEVERAGE');
    expect(sized.declaredRisk.toString()).toBe('75');
    expect(sized.actualRisk.toDecimal(2)).toBe('16.82');
    expect(sized.actualRiskPct.toDecimal(2)).toBe('0.34');
    expect(sized.maxLotByLeverage.toDecimal(4)).toBe('0.0172');
  });

  test('at the 1:5 ceiling the lot is 0.04 and the risk 1.35%', () => {
    const sized = ok({ ...f6, maxLeverage: '5' });
    expect(sized.lot.toString()).toBe('0.04');
    expect(sized.actualRiskPct.toDecimal(2)).toBe('1.35');
  });

  test('the M15 UOEDT stop ($88.24) sizes to nothing: the risk lot is 0.0085', () => {
    const result = sizeSetup({ ...f6, stopDistance: '88.24' });
    expect(result.status).toBe('UNDERFLOW');
    expect(result.lotAtStop.toDecimal(4)).toBe('0.0085');
    if (result.status === 'UNDERFLOW') expect(result.causes).toEqual(['RISK']);
  });
});

describe('the lot is rounded down, never up', () => {
  test('0.0665 lot is 0.06', () => {
    expect(ok(DOC).lot.toString()).toBe('0.06');
  });

  test('a raw lot that is exactly a step is kept', () => {
    // equity 1504 at 1% risk is $15.04, and one lot of this stop loses $1,504: exactly 0.01
    const sized = ok({ ...DOC, equity: '1504' });
    expect(sized.rawLot.toString()).toBe('0.01');
    expect(sized.lot.toString()).toBe('0.01');
    expect(sized.actualRisk.eq(sized.declaredRisk)).toBe(true);
  });

  test('a cent less equity is an underflow, not a rounded-up 0.01 lot', () => {
    const result = sizeSetup({ ...DOC, equity: '1503.99' });
    expect(result.status).toBe('UNDERFLOW');
    expect(result.lot).toBeNull();
    expect(result.rawLot.lt(r('0.01'))).toBe(true);
  });

  test('0.0599999.. stays 0.05', () => {
    // pick the equity so that the risk lot is just under 0.06: 0.06 lot loses $90.24 = 1.0% of 9024
    const exact = ok({ ...DOC, equity: '9024' });
    expect(exact.lot.toString()).toBe('0.06');
    const under = ok({ ...DOC, equity: '9023.99' });
    expect(under.lot.toString()).toBe('0.05');
    expect(under.rawLot.lt(r('0.06'))).toBe(true);
  });

  test('a tie between the risk lot and the leverage lot is reported as RISK', () => {
    const sized = ok({
      ...DOC,
      entry: '2000.00',
      stopDistance: '20.00',
      equity: '10000',
      riskPct: '1',
      maxLeverage: '1',
      commission: '0',
    });
    expect(sized.lotAtStop.eq(sized.maxLotByLeverage)).toBe(true);
    expect(sized.lot.toString()).toBe('0.05');
    expect(sized.limitedBy).toBe('RISK');
    expect(sized.leverageUsed.toString()).toBe('1');
  });

  test("the broker's maximum lot is a third limit", () => {
    const sized = ok({
      ...DOC,
      equity: '5000000',
      spec: { ...GOLD, volumeMax: '2' },
    });
    expect(sized.limitedBy).toBe('BROKER_MAX');
    expect(sized.lot.toString()).toBe('2');
  });
});

describe('a lot below the broker minimum is an UNDERFLOW result with no lot', () => {
  test('the causes say which limit blocks it', () => {
    const riskOnly = sizeSetup({ ...DOC, equity: '1500' });
    expect(riskOnly.status === 'UNDERFLOW' && riskOnly.causes).toEqual([
      'RISK',
    ]);

    const leverageOnly = sizeSetup({
      ...DOC,
      entry: '4367.20',
      stopDistance: '16.78',
      equity: '2800',
      riskPct: '1.50',
      maxLeverage: '1.5',
    });
    expect(leverageOnly.status === 'UNDERFLOW' && leverageOnly.causes).toEqual([
      'LEVERAGE',
    ]);

    const both = sizeSetup({ ...DOC, equity: '500', riskPct: '0.5' });
    expect(both.status === 'UNDERFLOW' && both.causes).toEqual([
      'RISK',
      'LEVERAGE',
    ]);
  });

  test('the stop price and the declared risk are still worked out', () => {
    const result = sizeSetup({ ...DOC, equity: '1500' });
    expect(result.status).toBe('UNDERFLOW');
    expect(result.stopPrice.toString()).toBe('2530');
    expect(result.declaredRisk.toString()).toBe('15');
    expect('actualRisk' in result).toBe(false);
    expect('leverageUsed' in result).toBe(false);
  });

  test('a target has no net profit without a lot, but its distance and price stand', () => {
    const result = sizeSetup({ ...DOC, equity: '1500' });
    const target = targetAt(result, '1.5');
    expect(target.netProfit).toBeNull();
    expect(target.targetDistance.toDecimal(2)).toBe('22.60');
    expect(target.targetPrice.toDecimal(2)).toBe('2567.60');
  });
});

describe('spread (D3)', () => {
  const spread25 = { ...GOLD, typicalSpread: '25' }; // 25 points x 0.01 = 0.25

  test('with a spread of zero BUY and SELL are the 6.7 table, mirrored', () => {
    const buy = ok(DOC);
    const sell = ok({ ...DOC, side: 'SELL' });
    expect(sell.lot.eq(buy.lot)).toBe(true);
    expect(sell.actualRisk.eq(buy.actualRisk)).toBe(true);
    expect(sell.leverageUsed.eq(buy.leverageUsed)).toBe(true);
    expect(sell.stopPrice.toDecimal(2)).toBe('2560.00');
    expect(sell.stopChartLevel.eq(sell.stopPrice)).toBe(true);
    const buyTarget = targetAt(buy, '1.5');
    const sellTarget = targetAt(sell, '1.5');
    expect(sellTarget.targetDistance.eq(buyTarget.targetDistance)).toBe(true);
    expect(sellTarget.targetPrice.toDecimal(2)).toBe('2522.40');
    expect(sellTarget.netProfit?.eq(buyTarget.netProfit ?? Rational.ZERO)).toBe(
      true
    );
  });

  test('a BUY fills at the ask and pays the spread in its loss and its target', () => {
    const { sizing, target } = sizeWithTarget(
      { ...DOC, spec: spread25 },
      '1.5'
    );
    if (sizing.status !== 'OK') throw new Error('no lot');
    expect(sizing.spreadPrice.toString()).toBe('0.25');
    expect(sizing.fillPrice.toString()).toBe('2545.25');
    expect(sizing.lossPerOunce.toString()).toBe('15.25');
    expect(sizing.lossPerLot.toString()).toBe('1529');
    expect(sizing.lot.toString()).toBe('0.06');
    expect(sizing.actualRisk.toString()).toBe('91.74');
    expect(sizing.leverageUsed.toString()).toBe('1.52715');
    expect(sizing.stopPrice.toString()).toBe('2530');
    expect(sizing.stopChartLevel.toString()).toBe('2530');
    // gain per ounce 1.5 x 15.25 + 4 x 2.5 / 100 = 22.975; the target is 0.25 further out
    expect(target.gainPerOunce.toString()).toBe('22.975');
    expect(target.targetDistance.toString()).toBe('23.225');
    expect(target.targetPrice.toString()).toBe('2568.225');
    expect(target.targetChartLevel.toString()).toBe('2568.225');
    expect(target.netProfit?.toString()).toBe('137.61');
    expect(target.netProfit?.eq(r('1.5').mul(sizing.actualRisk))).toBe(true);
  });

  test('a SELL fills on the bid: the spread moves where its stop and target trigger, not its risk', () => {
    const { sizing, target } = sizeWithTarget(
      { ...DOC, side: 'SELL', spec: spread25 },
      '1.5'
    );
    if (sizing.status !== 'OK') throw new Error('no lot');
    expect(sizing.fillPrice.toString()).toBe('2545');
    expect(sizing.lossPerOunce.toString()).toBe('15');
    expect(sizing.actualRisk.toString()).toBe('90.24');
    // the stop triggers on the ask; the chart (bid) level is the stop minus the spread
    expect(sizing.stopPrice.toString()).toBe('2560');
    expect(sizing.stopChartLevel.toString()).toBe('2559.75');
    expect(target.targetDistance.toString()).toBe('22.6');
    expect(target.targetPrice.toString()).toBe('2522.4');
    expect(target.targetChartLevel.toString()).toBe('2522.15');
    expect(target.netProfit?.toString()).toBe('135.36');
  });

  test('the spread is points x the point of the symbol, from the broker row', () => {
    const wide = sizeSetup({
      ...DOC,
      spec: { ...GOLD, typicalSpread: '40', point: '0.001' },
    });
    expect(wide.spreadPrice.toString()).toBe('0.04');
  });
});

describe('changing a broker figure changes the lot with no code change (6.14)', () => {
  test.each([
    ['the 6.7 row', GOLD, '0.06'],
    ['a contract of 10 ounces', { ...GOLD, contractSize: '10' }, '0.64'],
    [
      'a lot step of 0.001',
      { ...GOLD, volumeMin: '0.001', volumeStep: '0.001' },
      '0.066',
    ],
    [
      'a lot step of 0.05',
      { ...GOLD, volumeMin: '0.05', volumeStep: '0.05' },
      '0.05',
    ],
  ] as const)('%s gives %s', (_name, spec, lot) => {
    expect(ok({ ...DOC, spec }).lot.toString()).toBe(lot);
  });

  test.each([
    ['a contract of 1,000 ounces', { ...GOLD, contractSize: '1000' }],
    [
      'a lot step and minimum of 0.1',
      { ...GOLD, volumeMin: '0.1', volumeStep: '0.1' },
    ],
  ] as const)('%s makes the 6.7 example an underflow', (_name, spec) => {
    expect(sizeSetup({ ...DOC, spec }).status).toBe('UNDERFLOW');
  });

  test('the broker row is read as given: numbers from a Float column mean their decimal text', () => {
    const asNumbers: SizingInput = {
      side: 'BUY',
      entry: 2545,
      stopDistance: 15,
      equity: 10000,
      riskPct: 1,
      maxLeverage: 5,
      commission: 4,
      spec: {
        contractSize: 100,
        volumeMin: 0.01,
        volumeStep: 0.01,
        volumeMax: 100,
        typicalSpread: 25,
        point: 0.01,
      },
    };
    const fromNumbers = sizeSetup(asNumbers);
    const fromText = sizeSetup({
      ...DOC,
      spec: { ...GOLD, typicalSpread: '25' },
    });
    expect(JSON.stringify(fromNumbers)).toBe(JSON.stringify(fromText));
    expect(fromNumbers.status).toBe('OK');
  });
});

describe('a result is plain data', () => {
  test('JSON.stringify works and holds exact text', () => {
    const json = JSON.parse(JSON.stringify(sizeSetup(DOC))) as Record<
      string,
      unknown
    >;
    expect(json['status']).toBe('OK');
    expect(json['lot']).toBe('0.06');
    expect(json['actualRisk']).toBe('90.24');
    expect(json['leverageUsed']).toBe('1.527');
    expect(typeof json['maxLotByLeverage']).toBe('string');
  });

  test('the same input twice gives the same result', () => {
    expect(JSON.stringify(sizeSetup(DOC))).toBe(
      JSON.stringify(sizeSetup({ ...DOC }))
    );
  });

  test('sizeWithTarget is sizeSetup plus targetAt', () => {
    const together = sizeWithTarget(DOC, '1.75');
    expect(JSON.stringify(together.sizing)).toBe(
      JSON.stringify(sizeSetup(DOC))
    );
    expect(JSON.stringify(together.target)).toBe(
      JSON.stringify(targetAt(sizeSetup(DOC), '1.75'))
    );
  });
});

describe('what the engine refuses', () => {
  const refused = (input: SizingInput): Engine4InputError => {
    try {
      sizeSetup(input);
    } catch (error) {
      expect(error).toBeInstanceOf(Engine4InputError);
      return error as Engine4InputError;
    }
    throw new Error('expected a refusal');
  };

  test.each([
    ['entry', { entry: '0' }, 'NOT_POSITIVE'],
    ['entry', { entry: '-5' }, 'NOT_POSITIVE'],
    ['entry', { entry: '2,545' }, 'NOT_A_DECIMAL'],
    ['stopDistance', { stopDistance: '0' }, 'NOT_POSITIVE'],
    ['stopDistance', { stopDistance: 'abc' }, 'NOT_A_DECIMAL'],
    ['equity', { equity: '0' }, 'NOT_POSITIVE'],
    ['riskPct', { riskPct: '0' }, 'NOT_POSITIVE'],
    ['riskPct', { riskPct: '100.01' }, 'OUT_OF_RANGE'],
    ['maxLeverage', { maxLeverage: '0' }, 'NOT_POSITIVE'],
    ['commission', { commission: '-1' }, 'NEGATIVE'],
    ['side', { side: 'LONG' as never }, 'BAD_OPTION'],
    ['stopDistance', { stopDistance: '2545' }, 'OUT_OF_RANGE'],
    ['stopDistance', { stopDistance: '3000' }, 'OUT_OF_RANGE'],
  ])('%s: %j is refused as %s', (field, change, code) => {
    const error = refused({ ...DOC, ...change });
    expect(error.code).toBe(code);
    expect(error.field).toBe(field);
  });

  test.each([
    ['spec.contractSize', { contractSize: '0' }, 'NOT_POSITIVE'],
    ['spec.volumeMin', { volumeMin: '0' }, 'NOT_POSITIVE'],
    ['spec.volumeStep', { volumeStep: '0' }, 'NOT_POSITIVE'],
    ['spec.volumeMax', { volumeMax: '-1' }, 'NOT_POSITIVE'],
    ['spec.typicalSpread', { typicalSpread: '-1' }, 'NEGATIVE'],
    ['spec.point', { point: '0' }, 'NOT_POSITIVE'],
    ['spec.volumeMin', { volumeMin: '0.015' }, 'BAD_SPEC'],
    ['spec.volumeMax', { volumeMax: '0.005', volumeMin: '0.01' }, 'BAD_SPEC'],
  ])('%s: a broker row with %j is refused as %s', (field, change, code) => {
    const error = refused({ ...DOC, spec: { ...GOLD, ...change } });
    expect(error.code).toBe(code);
    expect(error.field).toBe(field);
  });

  test('a broker maximum equal to the minimum is a valid row: the only lot is the minimum', () => {
    const only = { ...GOLD, volumeMax: '0.01' };
    const sized = ok({ ...DOC, spec: only });
    expect(sized.lot.toString()).toBe('0.01');
    expect(sized.limitedBy).toBe('BROKER_MAX');
  });

  test('a risk of exactly 100% is allowed, 100.01% is not', () => {
    const all = sizeSetup({ ...DOC, riskPct: '100' });
    expect(all.status).toBe('OK');
    expect(all.declaredRisk.toString()).toBe('10000');
    expect(() => sizeSetup({ ...DOC, riskPct: '100.01' })).toThrow(
      Engine4InputError
    );
  });

  test('a missing broker row is refused, not defaulted', () => {
    expect(() => sizeSetup({ ...DOC, spec: undefined as never })).toThrow();
  });

  test('a target needs an RRR above zero', () => {
    const sizing = sizeSetup(DOC);
    expect(() => targetAt(sizing, '0')).toThrow(Engine4InputError);
    expect(() => targetAt(sizing, '-1')).toThrow(Engine4InputError);
    expect(() => targetAt(sizing, 'x')).toThrow(Engine4InputError);
  });

  test('a SELL target that would sit at or below zero is refused', () => {
    // an absurd stop for the price: the sizing is fine, a 3.5 RRR target is below zero
    const sizing = sizeSetup({
      ...DOC,
      side: 'SELL',
      entry: '30',
      stopDistance: '10',
    });
    expect(sizing.status).toBe('OK');
    expect(() => targetAt(sizing, '3.5')).toThrow(/target price/);
  });

  test('resolveSymbolSpec gives exact figures and the spread as a price', () => {
    const spec = resolveSymbolSpec({ ...GOLD, typicalSpread: '25' });
    expect(spec.spreadPrice.toString()).toBe('0.25');
    expect(spec.contractSize.toString()).toBe('100');
  });
});

describe('against the independent oracle (scripts/engine4/oracle.py)', () => {
  const cases = loadOracle().cases;

  test.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const result = sizeSetup(toSizingInput(c.input));
    const want = c.sizing;
    const problems: string[] = [];

    if (result.status !== want.status) {
      problems.push(
        `status: engine ${result.status} but oracle ${want.status}`
      );
    }
    sameValue(problems, 'fillPrice', result.fillPrice, want.fill_price);
    sameValue(problems, 'spreadPrice', result.spreadPrice, want.spread_price);
    sameValue(
      problems,
      'lossPerOunce',
      result.lossPerOunce,
      want.loss_per_ounce
    );
    sameValue(problems, 'lossPerLot', result.lossPerLot, want.loss_per_lot);
    sameValue(
      problems,
      'maxLotByLeverage',
      result.maxLotByLeverage,
      want.max_lot_by_leverage
    );
    sameValue(problems, 'lotAtStop', result.lotAtStop, want.lot_at_stop);
    sameValue(problems, 'rawLot', result.rawLot, want.raw_lot);
    sameValue(
      problems,
      'declaredRisk',
      result.declaredRisk,
      want.declared_risk
    );
    sameText(
      problems,
      'declaredRisk 2dp',
      result.declaredRisk.toDecimal(2),
      want.declared_risk_2dp
    );
    sameValue(problems, 'stopPrice', result.stopPrice, want.stop_price);
    sameText(
      problems,
      'stopPrice 2dp',
      result.stopPrice.toDecimal(2),
      want.stop_price_2dp
    );
    sameValue(
      problems,
      'stopChartLevel',
      result.stopChartLevel,
      want.stop_chart_level
    );
    sameText(
      problems,
      'stopChartLevel 2dp',
      result.stopChartLevel.toDecimal(2),
      want.stop_chart_level_2dp
    );

    if (result.status === 'OK') {
      sameValue(problems, 'lot', result.lot, want.lot);
      sameText(problems, 'limitedBy', result.limitedBy, want.limited_by);
      sameValue(problems, 'actualRisk', result.actualRisk, want.actual_risk);
      sameText(
        problems,
        'actualRisk 2dp',
        result.actualRisk.toDecimal(2),
        want.actual_risk_2dp
      );
      sameValue(
        problems,
        'actualRiskPct',
        result.actualRiskPct,
        want.actual_risk_pct
      );
      sameText(
        problems,
        'actualRiskPct 2dp',
        result.actualRiskPct.toDecimal(2),
        want.actual_risk_pct_2dp
      );
      sameValue(
        problems,
        'leverageUsed',
        result.leverageUsed,
        want.leverage_used
      );
      sameText(
        problems,
        'leverageUsed 3dp',
        result.leverageUsed.toDecimal(3),
        want.leverage_used_3dp
      );
    } else {
      if (JSON.stringify(result.causes) !== JSON.stringify(want.causes)) {
        problems.push(
          `causes: engine ${result.causes.join(',')} but oracle ${want.causes.join(',')}`
        );
      }
      if (want.lot !== null)
        problems.push('the oracle has a lot for an underflow');
    }
    expect(problems).toEqual([]);
  });

  test('the corpus is varied enough to mean something', () => {
    const statuses = new Set(cases.map((c) => c.sizing.status));
    expect(statuses).toEqual(new Set(['OK', 'UNDERFLOW']));
    const limits = new Set(
      cases
        .filter((c) => c.sizing.status === 'OK')
        .map((c) => c.sizing.limited_by)
    );
    expect(limits).toEqual(new Set(['RISK', 'LEVERAGE', 'BROKER_MAX']));
    const causes = new Set(
      cases
        .filter((c) => c.sizing.status === 'UNDERFLOW')
        .map((c) => c.sizing.causes.join('+'))
    );
    expect(causes).toEqual(new Set(['RISK', 'LEVERAGE', 'RISK+LEVERAGE']));
    expect(new Set(cases.map((c) => c.input.side))).toEqual(
      new Set(['BUY', 'SELL'])
    );
    expect(
      new Set(cases.map((c) => c.input.spec.contract_size)).size
    ).toBeGreaterThanOrEqual(5);
    expect(
      cases.filter((c) => c.input.spec.typical_spread !== '0').length
    ).toBeGreaterThanOrEqual(100);
    expect(
      cases.filter((c) => c.sizing.status === 'OK').length
    ).toBeGreaterThanOrEqual(300);
  });
});
