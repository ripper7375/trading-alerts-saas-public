/**
 * @jest-environment node
 */

/**
 * Report 2 as a fixed template (build step 5, part 7): the document built from what
 * the routes answer. Every case starts from the stored 18 Sep 20:55 cycle (or another
 * stored golden one) run through the REAL Engine 4; the expected figures below were
 * worked out by hand from the 6.7 formulas, not copied from the code under test.
 *
 * The 18 Sep reading at the test profile (equity 10,000, 1:5 leverage, commission $4;
 * the sensors are CAUTIONARY so the risk opens at half of 1.50%): Z1 at 4367.20, the
 * stored stop 4350.42 ($16.78, behind the M15 level sr_2), spread 25 points = $0.25.
 * A BUY loses $16.78 + $0.25 = $17.03 an ounce, so a lot loses 17.03 x 100 + 4 =
 * $1,707. Declared risk 0.75% of 10,000 = $75; lot = 75 / 1,707 = 0.0439 -> 0.04;
 * actual risk 0.04 x 1,707 = $68.28 (0.68%). Net profit = RRR x actual risk.
 */

import { Rational } from '@/lib/engine4';
import {
  COMPULSORY_KEYS,
  REPORT2_DISCLAIMER_VERSION,
  REPORT2_TEMPLATE_VERSION,
  buildReport2,
  limitsFromSetup,
  lotText,
  type Report2Document,
} from '@/lib/engine4/templates/report2';
import { REPORT2_KEYS } from '@/lib/engine4/templates/text';
import { readWire } from '@/lib/engine4/templates/wire';

import {
  scene,
  sizeAnswer,
  toWire,
  type Scene,
} from '../../../components/report2/helpers/engine-api';

const Z1 = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

function documentOf(
  world: Scene,
  fields: Record<string, unknown>,
  withBlackout = false
): Report2Document {
  const answer = sizeAnswer(world, fields);
  return buildReport2({
    setup: answer.setup,
    badge: answer.badge,
    offer: answer.offer,
    ...(withBlackout ? { blackout: toWire(world.s.ctx.blackout) } : {}),
  });
}

describe('the 18 Sep reading, Z1 at the pre-set half risk', () => {
  const world = scene();
  const doc = documentOf(world, Z1);

  test('passes all eight checks and is sized', () => {
    expect(doc.ok).toBe(true);
    expect(doc.sized).toBe(true);
    expect(doc.checks).toHaveLength(8);
    expect(doc.checks.every((check) => check.status === 'PASS')).toBe(true);
    expect(doc.checks.map((check) => check.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(doc.offerReason).toBeNull();
  });

  test('the header: a BUY, counter-trend, pinned to the cycle', () => {
    expect(doc.header.side).toBe('BUY');
    expect(doc.header.directionKey).toBe('report2.direction.long');
    expect(doc.header.counterTrend).toBe(true);
    expect(doc.header.pinned).toEqual({
      kind: 'time',
      text: String(world.s.slot),
    });
  });

  test('the setup: the zone price, the stored stop behind its named level, the pre-set half risk and its reasons', () => {
    expect(doc.setup.entry).toEqual({ kind: 'price', text: '4367.20' });
    expect(doc.setup.entrySource).toEqual({
      key: 'report2.entry.zone',
      params: { zone: { kind: 'raw', text: 'Z1' } },
    });
    expect(doc.setup.stopPrice).toEqual({ kind: 'price', text: '4350.42' });
    expect(doc.setup.stopDistance).toEqual({ kind: 'price', text: '16.78' });
    expect(doc.setup.stopHow?.key).toBe('report2.stop.behind');
    expect(doc.setup.stopHow?.params['level']?.text).toMatch(/^M15 sr_2$/);
    expect(doc.setup.equity).toEqual({ kind: 'money', text: '10000.00' });
    expect(doc.setup.riskPct).toEqual({ kind: 'percent', text: '0.75' });
    expect(doc.setup.rrr).toEqual({ kind: 'ratio', text: '1.75' });
    expect(doc.setup.halfRisk).toEqual({
      preset: { kind: 'percent', text: '0.75' },
      max: { kind: 'percent', text: '1.50' },
      reasons: expect.arrayContaining(['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5']),
    });
    // 0.75 is the pre-set half, not more than it: no override
    expect(doc.setup.override).toBeNull();
    // a BUY's stop triggers on the bid, which is the chart level: nothing to add
    expect(doc.setup.stopChartLevel).toBeNull();
  });

  test('declared risk and actual risk side by side, by hand', () => {
    const risk = doc.risk!;
    expect(risk.declared).toEqual({
      money: { kind: 'money', text: '75.00' },
      pct: { kind: 'percent', text: '0.75' },
    });
    expect(risk.lot).toEqual({ kind: 'lot', text: '0.04' });
    expect(risk.actual).toEqual({
      money: { kind: 'money', text: '68.28' },
      pct: { kind: 'percent', text: '0.68' },
    });
    expect(risk.limitedBy?.key).toBe('report2.pair.limited_risk');
    expect(risk.roundedDown).toBe(true);
    expect(risk.spread).toEqual({ kind: 'price', text: '0.25' });
    expect(risk.commission).toEqual({ kind: 'money', text: '4.00' });
    expect(risk.leverageMax).toEqual({ kind: 'multiple', text: '5.00' });
    // 0.04 lot x 100 oz x (4367.20 + 0.25 ask) / 10,000 = 1.7469
    expect(risk.leverageUsed).toEqual({ kind: 'multiple', text: '1.75' });
  });

  test('three scenarios whose net profit is the RRR times the actual risk', () => {
    expect(doc.scenarios.map((s) => s.name)).toEqual([
      'CONSERVATIVE',
      'NORMAL',
      'AGGRESSIVE',
    ]);
    expect(doc.scenarios.map((s) => s.rrr.text)).toEqual([
      '1.50',
      '1.75',
      '2.00',
    ]);
    expect(doc.scenarios.map((s) => s.netProfit?.text)).toEqual([
      '102.42',
      '119.49',
      '136.56',
    ]);
    // a BUY exits on the bid: the target on the chart is the order price
    expect(doc.scenarios.every((s) => s.chartLevel === null)).toBe(true);
    expect(doc.omitted).toEqual([]);
  });

  test('NO badge, and the level that stopped it is named: 4369.57, 2.37 away', () => {
    expect(doc.badge.badge).toBeNull();
    expect(doc.badge.nameKey).toBeNull();
    expect(doc.badge.why?.key).toBe('report2.badge.none_no_fit');
    expect(doc.badge.why?.params['price']).toEqual({
      kind: 'price',
      text: '4369.57',
    });
    expect(doc.badge.why?.params['level']?.text).toMatch(/sr_1$/);
    expect(doc.room).toMatchObject({
      state: 'NAMED',
      price: { kind: 'price', text: '4369.57' },
      room: { kind: 'price', text: '2.37' },
    });
    expect(doc.scenarios.every((s) => !s.badge)).toBe(true);
  });

  test('carries the three compulsory texts, in order, and the versions the consent will record', () => {
    expect(doc.compulsory).toEqual([
      'report2.notice.single_order',
      'report2.notice.broker_order',
      'report2.notice.calculation_tool',
    ]);
    expect([...COMPULSORY_KEYS]).toEqual(doc.compulsory);
    expect(doc.version).toEqual({
      template: REPORT2_TEMPLATE_VERSION,
      disclaimer: REPORT2_DISCLAIMER_VERSION,
    });
    expect(REPORT2_TEMPLATE_VERSION).toBe('report2-template/draft-1');
    expect(REPORT2_DISCLAIMER_VERSION).toBe('disclaimer/draft-1');
  });

  test('the notices of the offer: the half-risk caution', () => {
    expect(doc.notices.map((n) => n.key)).toEqual([
      'report2.notice.cautionary',
    ]);
  });

  test('a trend-following trader is told this counter-trend setup is not their style, with the cap', () => {
    const own = documentOf(scene({ style: 'TREND_FOLLOWING' }), Z1);
    const style = own.notices.find(
      (n) => n.key === 'report2.notice.style_counter_trend'
    );
    expect(style).toEqual({
      key: 'report2.notice.style_counter_trend',
      params: { cap: { kind: 'ratio', text: '2.5' } },
    });
  });

  test('every key it uses is a key of the registry', () => {
    const known = new Set<string>(REPORT2_KEYS);
    const keys: string[] = [
      doc.header.directionKey ?? '',
      ...doc.notices.map((n) => n.key),
      doc.setup.entrySource?.key ?? '',
      doc.setup.stopHow?.key ?? '',
      doc.risk?.limitedBy?.key ?? '',
      ...doc.scenarios.map((s) => s.nameKey),
      doc.badge.why?.key ?? '',
      ...doc.checks.map((c) => c.nameKey),
      ...doc.compulsory,
    ].filter((key) => key !== '');
    for (const key of keys) expect(known.has(key)).toBe(true);
  });

  test('is a pure function of its input: the same answer gives the same document', () => {
    const again = documentOf(scene(), Z1);
    expect(JSON.stringify(again)).toBe(JSON.stringify(doc));
  });
});

describe('a setup that fails its checks is still a document', () => {
  test('a risk above Max RPT: not ok, not sized, the message names the limit', () => {
    const doc = documentOf(scene(), { ...Z1, riskPct: '2' });
    expect(doc.ok).toBe(false);
    expect(doc.sized).toBe(false);
    expect(doc.scenarios).toEqual([]);
    expect(doc.risk).toBeNull();
    const risk = doc.checks[1]!;
    expect(risk.status).toBe('FAIL');
    expect(risk.messages).toEqual([
      {
        key: 'report2.err.risk_max',
        params: { max: { kind: 'percent', text: '1.5' } },
      },
    ]);
    // the later checks that need the numbers were not run
    expect(doc.checks[4]!.status).toBe('SKIPPED');
    expect(doc.checks[7]!.status).toBe('SKIPPED');
    expect(doc.badge.badge).toBeNull();
    expect(doc.room).toEqual({ state: 'NOT_SIZED' });
    // and the three compulsory texts are there all the same
    expect(doc.compulsory).toHaveLength(3);
  });

  test('a stop under Min SLD names the minimum', () => {
    const doc = documentOf(scene(), { ...Z1, stopDistance: '10' });
    expect(doc.checks[2]!.messages[0]).toEqual({
      key: 'report2.err.stop_min',
      params: { min: { kind: 'price', text: '13' } },
    });
  });

  test('an RRR over the counter-trend cap names the cap, not the profile ceiling', () => {
    const doc = documentOf(scene(), { ...Z1, rrr: '3' });
    expect(doc.checks[3]!.messages[0]).toEqual({
      key: 'report2.err.rrr_counter_cap',
      params: { max: { kind: 'ratio', text: '2.5' } },
    });
  });

  test('nothing entered at all is a document too', () => {
    const doc = documentOf(scene(), {});
    expect(doc.ok).toBe(false);
    expect(doc.setup.entry).toBeNull();
    expect(doc.setup.entrySource).toBeNull();
    expect(doc.setup.stopPrice).toBeNull();
    expect(
      doc.checks.filter((c) => c.status === 'FAIL').length
    ).toBeGreaterThan(2);
  });
});

describe('the pre-set half risk and the override', () => {
  test('more than the pre-set half, up to Max RPT, is recorded as an override with the reasons', () => {
    const doc = documentOf(scene(), { ...Z1, riskPct: '1.2' });
    expect(doc.ok).toBe(true);
    expect(doc.setup.override).toEqual({
      chosen: { kind: 'percent', text: '1.20' },
      preset: { kind: 'percent', text: '0.75' },
      reasons: expect.arrayContaining(['MCD0_DEFECT_M15']),
    });
  });

  test('exactly the pre-set half is not an override', () => {
    expect(documentOf(scene(), Z1).setup.override).toBeNull();
    expect(
      documentOf(scene(), { ...Z1, riskPct: '0.5' }).setup.override
    ).toBeNull();
  });
});

describe('a SELL with a spread', () => {
  const world = scene({ golden: '07-' });
  const doc = documentOf(world, {
    zoneId: 'Z1',
    entry: '4282.0',
    equity: '10000',
    riskPct: '0.5',
    stopDistance: '20.5',
    rrr: '1.75',
  });

  test('is a SELL, and its stop and targets trigger on the ask: the chart level is a spread lower', () => {
    expect(doc.header.side).toBe('SELL');
    expect(doc.header.directionKey).toBe('report2.direction.short');
    const stop = doc.setup.stopPrice!;
    const chart = doc.setup.stopChartLevel!;
    expect(readWire(stop.text).sub(readWire(chart.text)).toString()).toBe(
      '0.25'
    );
    for (const scenario of doc.scenarios) {
      expect(scenario.chartLevel).not.toBeNull();
      expect(
        readWire(scenario.price.text)
          .sub(readWire(scenario.chartLevel!.text))
          .toString()
      ).toBe('0.25');
    }
  });

  test('the counter-trend SHORT with room for the Conservative target only is badged CONSERVATIVE, naming 4250', () => {
    expect(doc.badge.badge).toBe('CONSERVATIVE');
    expect(doc.badge.nameKey).toBe('report2.scenario.conservative');
    expect(doc.badge.why).toBeNull();
    expect(doc.scenarios.filter((s) => s.badge).map((s) => s.name)).toEqual([
      'CONSERVATIVE',
    ]);
    expect(doc.room).toMatchObject({
      state: 'NAMED',
      price: { text: '4250.00' },
    });
  });
});

describe('the default profile at today’s gold price (decision D17)', () => {
  const world = scene({
    profile: {
      style: 'TREND_FOLLOWING',
      maxRiskPct: '1.5',
      maxLeverage: '1.5',
      targetRrr: '1.75',
      equity: '5000',
      minSld: '13',
      commission: '4',
    },
  });
  const doc = documentOf(world, {
    ...Z1,
    equity: '5000',
    riskPct: '0.75',
  });

  test('the leverage limit, not the risk limit, sets the lot, and the report says so plainly', () => {
    expect(doc.ok).toBe(true);
    expect(doc.risk?.lot).toEqual({ kind: 'lot', text: '0.01' });
    expect(doc.risk?.limitedBy?.key).toBe('report2.pair.limited_leverage');
    // declared $37.50, actual 0.01 x $1,707 = $17.07: a long way under
    expect(doc.risk?.declared.money.text).toBe('37.50');
    expect(doc.risk?.actual?.money.text).toBe('17.07');
    expect(doc.risk?.actual?.pct.text).toBe('0.34');
  });
});

describe('a lot below the broker minimum', () => {
  const world = scene({
    profile: { equity: '300', maxRiskPct: '1' },
  });
  const doc = documentOf(world, { ...Z1, equity: '300', riskPct: '0.5' });

  test('is stated as a fact, never rounded up, never a different equity to type', () => {
    expect(doc.ok).toBe(false);
    expect(doc.checks[7]!.status).toBe('FAIL');
    expect(doc.checks[7]!.messages[0]!.key).toBe('report2.err.lot_below_min');
    expect(doc.risk?.lot).toBeNull();
    expect(doc.risk?.actual).toBeNull();
    expect(doc.underflow).not.toBeNull();
    // one minimum lot loses $1,707 x 0.01 = $17.07 of $300 = 5.69%
    expect(doc.underflow?.minLotLoss).toEqual({ kind: 'money', text: '17.07' });
    expect(doc.underflow?.minLotRiskPct).toEqual({
      kind: 'percent',
      text: '5.69',
    });
    const facts = doc.underflow!.facts.map((fact) => fact.key);
    expect(facts.length).toBeGreaterThan(0);
    for (const key of facts) {
      expect(key).toMatch(/^report2\.underflow\.fact_(risk|leverage)$/);
    }
  });

  test('no action raises the risk above Max RPT or asks for another equity', () => {
    for (const action of doc.underflow!.actions) {
      if (action.kind === 'RAISE_RISK') {
        expect(readWire(action.riskPct).lte(Rational.of('1'))).toBe(true);
      } else {
        expect(readWire(action.stopDistance).gte(Rational.of('13'))).toBe(true);
      }
    }
  });
});

describe('when the offer no longer stands', () => {
  test('data that stopped names the time it stopped', () => {
    const world = scene({
      dataStatus: { status: 'STALE', dataAsOfSlot: 1789764900 },
    });
    const doc = documentOf(world, Z1);
    expect(doc.ok).toBe(false);
    expect(doc.offerReason).toEqual({
      key: 'report2.not_offered.data_stale',
      params: { time: { kind: 'time', text: '1789764900' } },
    });
  });

  test('a release inside the window names the release and when the window ends', () => {
    const slot = 1789764900;
    const world = scene({
      events: [
        {
          valueId: 'v1',
          eventId: '900000001',
          eventName: 'TEST US CPI',
          eventTime: slot + 150 + 5 * 60,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 0,
          capturedAt: slot - 3600,
        },
      ],
    });
    const doc = documentOf(world, Z1, true);
    expect(doc.checks[5]!.status).toBe('FAIL');
    expect(doc.offerReason?.key).toBe('report2.not_offered.blackout');
    expect(doc.offerReason?.params['name']).toEqual({
      kind: 'raw',
      text: 'TEST US CPI',
    });
    // 15 minutes after the release
    expect(doc.offerReason?.params['end']).toEqual({
      kind: 'time',
      text: String(slot + 150 + 5 * 60 + 15 * 60),
    });
  });

  test('without the blackout the same refusal still has words', () => {
    const slot = 1789764900;
    const world = scene({
      events: [
        {
          valueId: 'v1',
          eventId: '900000001',
          eventName: 'TEST US CPI',
          eventTime: slot + 150 + 5 * 60,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 0,
          capturedAt: slot - 3600,
        },
      ],
    });
    expect(documentOf(world, Z1).offerReason?.key).toBe('report2.err.blackout');
  });

  test('the synthesis standing aside is a reason, with no direction to draw', () => {
    const world = scene({ pinned: { bias: 'STAND_ASIDE' } });
    const doc = documentOf(world, {});
    expect(doc.offerReason?.key).toBe('report2.not_offered.stand_aside');
    expect(doc.header.side).toBeNull();
    expect(doc.header.directionKey).toBeNull();
  });
});

describe('releases while the trade could be open', () => {
  test('are listed as warnings, not blocks', () => {
    const slot = 1789764900;
    const world = scene({
      events: [
        {
          valueId: 'w1',
          eventId: '700000001',
          eventName: 'TEST US Retail Sales',
          eventTime: slot + 150 + 3 * 3600,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 1,
          capturedAt: slot - 3600,
        },
      ],
    });
    const doc = documentOf(world, Z1);
    expect(doc.ok).toBe(true);
    expect(doc.warnings).toEqual([
      {
        name: { kind: 'raw', text: 'TEST US Retail Sales' },
        time: { kind: 'time', text: String(slot + 150 + 3 * 3600) },
        approximate: true,
      },
    ]);
  });
});

describe('limits and lots', () => {
  test('the limits a message quotes come from the setup: the cap on a counter-trend one, the ceiling otherwise', () => {
    const counter = sizeAnswer(scene(), Z1).setup;
    expect(limitsFromSetup(counter)).toEqual({
      riskMax: '1.5',
      stopMin: '13',
      rrrMin: '1.5',
      rrrMax: '2.5',
    });
    const withTrend = sizeAnswer(scene({ golden: '04-' }), {
      zoneId: 'Z1',
      equity: '10000',
      riskPct: '1',
      stopDistance: '30.5',
      rrr: '1.75',
    }).setup;
    expect(withTrend.counterTrend).toBe(false);
    expect(limitsFromSetup(withTrend).rrrMax).toBe('3.5');
  });

  test.each([
    ['0.06', '0.06'],
    ['1', '1.00'],
    ['10', '10.00'],
    ['0.1', '0.10'],
    ['0.015', '0.015'],
    ['0.0100', '0.01'],
    ['2.5', '2.50'],
  ])('a lot of %s is shown as %s', (value, shown) => {
    expect(lotText(Rational.of(value))).toBe(shown);
  });

  test('a lot with no finite decimal form is rounded to four places', () => {
    expect(lotText(Rational.fromFraction(1n, 3n))).toBe('0.3333');
  });
});

describe('display rounding', () => {
  test('rounds to two decimals, half away from zero, from the exact value', () => {
    // 119.49 is exactly 1.75 x 68.28; neither side of the equation passed through a float
    const doc = documentOf(scene(), Z1);
    expect(doc.scenarios[1]!.netProfit?.text).toBe('119.49');
    expect(doc.risk?.actual?.money.text).toBe('68.28');
  });
});
