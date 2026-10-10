/**
 * @jest-environment node
 */

/**
 * The single validator (build step 5, part 4; architecture 6.10, ADR-067).
 *
 * The starting point is the real 18 Sep 20:55 cycle: a LONG counter-trend rally,
 * CAUTIONARY (so the risk opens at half), Z1 at 4367.20 with a structural stop
 * 16.78 away (4350.42), a profile with room (equity 10,000, leverage 1:5, Max RPT
 * 1.5%, Min SLD 13). Each of the eight checks is held to its boundary: the value
 * on the line is accepted and the value one step over is refused.
 */

import {
  Rational,
  dayRange,
  serializeValidatedSetup,
  sizeSetup,
  validateSetup,
} from '@/lib/engine4';
import type { SetupFields, ValidatedSetup } from '@/lib/engine4';

import { loadGoldens } from './helpers/stored';
import {
  ROOMY_PROFILE,
  golden,
  setup,
  testBars,
  zonesOf,
} from './helpers/setup';
import type { SetupOptions } from './helpers/setup';

// the modal's fields for Z1 at the pre-set risk
const MODAL: SetupFields = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

function run(
  over: SetupOptions = {},
  fields: SetupFields = {}
): ValidatedSetup {
  return validateSetup(setup(over).ctx, { ...MODAL, ...fields });
}

const check = (v: ValidatedSetup, id: number) => v.checks[id]!;
const statuses = (v: ValidatedSetup) =>
  v.checks.map((c) => c.status[0]).join('');

/** A wider day, so the 5% typo filter, not the range, is what binds. */
const WIDE = (now: number) => dayRange(testBars(now, '4800', '4200'), now);

describe('a good setup', () => {
  const v = run();

  test('passes all eight checks', () => {
    expect(v.ok).toBe(true);
    expect(statuses(v)).toBe('PPPPPPPP');
    expect(v.checks.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(v.checks.map((c) => c.name)).toEqual([
      'ENTRY',
      'RISK',
      'STOP',
      'RRR',
      'LEVERAGE',
      'BLACKOUT',
      'SETUP',
      'LOT',
    ]);
    expect(v.checks.every((c) => c.codes.length === 0)).toBe(true);
  });

  test('says what the setup is, in canonical text', () => {
    expect(v.schema).toBe('validated-setup/1');
    expect(v.side).toBe('BUY');
    expect(v.counterTrend).toBe(true);
    expect(v.entry).toEqual({ price: '4367.2', source: 'ZONE', zoneId: 'Z1' });
    expect(v.equity).toBe('10000');
    expect(v.riskPct).toBe('0.75');
    expect(v.rrr).toBe('1.75');
    expect(v.stop.distance).toBe('16.78');
    expect(v.stop.price).toBe('4350.42');
    expect(v.stop.kind).toBe('STRUCTURAL');
    expect(v.stop.level).toContain('sr_2');
    expect(v.profile).toEqual(ROOMY_PROFILE);
  });

  test('is pinned to its cycle and records the versions it used', () => {
    expect(v.pinnedSlot).toBe('1789764900');
    expect(v.versions).toEqual({ specs: '3', tier1List: 4 });
  });

  test('sizes it: 75 dollars of risk buys 0.04 lot, rounded down', () => {
    // loss per lot at the stop: (16.78 + 0.25 spread) x 100 + 4 commission = 1707; 75 / 1707 = 0.0439
    const sizing = v.scenarios!.sizing;
    expect(sizing.status).toBe('OK');
    if (sizing.status !== 'OK') return;
    expect(sizing.lot.toString()).toBe('0.04');
    expect(sizing.limitedBy).toBe('RISK');
    expect(sizing.declaredRisk.toString()).toBe('75');
    expect(sizing.actualRisk.toString()).toBe('68.28');
    expect(sizing.leverageUsed.lte(Rational.of('5'))).toBe(true);
  });

  test('builds the three scenarios, the counter-trend cap applying', () => {
    expect(v.scenarios!.counterTrend).toBe(true);
    expect(v.scenarios!.scenarios.map((s) => s.name)).toEqual([
      'CONSERVATIVE',
      'NORMAL',
      'AGGRESSIVE',
    ]);
    expect(v.scenarios!.scenarios.map((s) => s.rrr.toString())).toEqual([
      '1.5',
      '1.75',
      '2',
    ]);
    expect(v.underflow).toBeNull();
  });

  test('matches the sizing of part 1 for the same inputs', () => {
    const direct = sizeSetup({
      side: 'BUY',
      entry: '4367.2',
      stopDistance: '16.78',
      equity: '10000',
      riskPct: '0.75',
      maxLeverage: '5',
      commission: '4',
      spec: {
        contractSize: '100',
        volumeMin: '0.01',
        volumeStep: '0.01',
        volumeMax: '100',
        typicalSpread: '25',
        point: '0.01',
      },
    });
    expect(JSON.stringify(v.scenarios!.sizing)).toBe(JSON.stringify(direct));
  });

  test('records the notices of the offer', () => {
    expect(v.notices).toContain('CAUTIONARY');
  });

  test('is plain JSON: no bigint anywhere', () => {
    expect(() => serializeValidatedSetup(v)).not.toThrow();
    expect(JSON.parse(serializeValidatedSetup(v)).entry.price).toBe('4367.2');
  });
});

describe('check 0: the entry', () => {
  test('a pick of Z1 with no price typed fills the price in', () => {
    const v = run({}, { entry: undefined });
    expect(v.entry).toEqual({ price: '4367.2', source: 'ZONE', zoneId: 'Z1' });
    expect(check(v, 0).status).toBe('PASS');
  });

  test('a zone price is a zone however it is written', () => {
    for (const entry of ['4367.20', '4367.2000', 4367.2, ' 4367.2 ']) {
      const v = run({}, { entry, zoneId: undefined });
      expect(v.entry).toEqual({
        price: '4367.2',
        source: 'ZONE',
        zoneId: 'Z1',
      });
      expect(check(v, 0).notes).toEqual(['ENTRY_ON_ZONE_PRICE']);
    }
  });

  test('the zone is the one whose price it is, whatever zone was picked', () => {
    const v = run({}, { entry: '4350.16', zoneId: 'Z1' });
    expect(v.entry.zoneId).toBe('Z2');
  });

  test('a price that is not a zone price is a custom entry, the pick ignored', () => {
    const v = run({}, { entry: '4375', zoneId: 'Z1' });
    expect(v.entry).toEqual({ price: '4375', source: 'CUSTOM', zoneId: null });
    expect(check(v, 0).status).toBe('PASS');
    expect(check(v, 0).notes).toEqual([]);
  });

  test.each([
    [{ entry: undefined, zoneId: undefined }, 'ENTRY_MISSING'],
    [{ entry: '', zoneId: '' }, 'ENTRY_MISSING'],
    [{ entry: undefined, zoneId: 'Z9' }, 'ENTRY_ZONE_UNKNOWN'],
    [{ entry: undefined, zoneId: 5 }, 'ENTRY_ZONE_UNKNOWN'],
    [{ entry: 'abc' }, 'ENTRY_NOT_A_NUMBER'],
    [{ entry: '4,367.20' }, 'ENTRY_NOT_A_NUMBER'],
    [{ entry: Number.NaN }, 'ENTRY_NOT_A_NUMBER'],
    [{ entry: 0 }, 'ENTRY_NOT_POSITIVE'],
    [{ entry: -4367.2 }, 'ENTRY_NOT_POSITIVE'],
  ])('refuses %p with %s', (fields, code) => {
    const v = run({}, fields as SetupFields);
    expect(check(v, 0).status).toBe('FAIL');
    expect(check(v, 0).codes).toEqual([code]);
    expect(v.entry).toEqual({ price: null, source: null, zoneId: null });
    expect(v.ok).toBe(false);
  });

  describe('the one-day range widened by half its height (4282.525 to 4427.425)', () => {
    test.each([
      ['4282.525', true],
      ['4282.524', false],
      ['4427.425', true],
      ['4427.426', false],
      ['4375', true],
      ['4200', false],
    ])('a custom entry of %s: accepted %p', (entry, accepted) => {
      const v = run({}, { entry, zoneId: undefined });
      expect(check(v, 0).status).toBe(accepted ? 'PASS' : 'FAIL');
      if (!accepted) {
        expect(check(v, 0).codes).toEqual(['ENTRY_OUTSIDE_DAY_RANGE']);
        expect(check(v, 0).detail[0]).toContain('4282.525');
      }
    });

    test('a refused entry is not sized', () => {
      const v = run({}, { entry: '4500', zoneId: undefined });
      expect(statuses(v)).toBe('FPPPSPPS');
      expect(v.scenarios).toBeNull();
      expect(check(v, 4).status).toBe('SKIPPED');
      expect(check(v, 7).status).toBe('SKIPPED');
    });
  });

  describe('the 5% typo filter (4159.3945 to 4597.2255 around 4378.31)', () => {
    const withWide = (entry: string) => {
      const s = setup({});
      const ctx = { ...s.ctx, range: WIDE(s.now) };
      return validateSetup(ctx, { ...MODAL, entry, zoneId: undefined });
    };

    test.each([
      ['4597.2255', true],
      ['4597.2256', false],
      ['4159.3945', true],
      ['4159.3944', false],
      ['43673.2', false],
    ])('a custom entry of %s: accepted %p', (entry, accepted) => {
      const v = withWide(entry);
      expect(check(v, 0).status).toBe(accepted ? 'PASS' : 'FAIL');
      if (!accepted) expect(check(v, 0).codes).toEqual(['ENTRY_TYPO']);
    });
  });

  describe('what is not known refuses a custom entry, never a zone price', () => {
    test('no closed bar: the range is unknown', () => {
      const v = run(
        { range: dayRange([], 1_790_000_000) },
        { entry: '4375', zoneId: undefined }
      );
      expect(check(v, 0).codes).toEqual(['DAY_RANGE_UNKNOWN']);
      const pill = run({ range: dayRange([], 1_790_000_000) });
      expect(check(pill, 0).status).toBe('PASS');
    });

    test('no live price', () => {
      const v = run({ price: null }, { entry: '4375', zoneId: undefined });
      expect(check(v, 0).codes).toEqual(['LIVE_PRICE_UNKNOWN']);
    });
  });

  test('a zone price needs neither the range nor the filter', () => {
    const s = setup();
    const narrow = dayRange(
      [{ openTime: s.now - 600, high: '4380', low: '4379.5' }],
      s.now
    );
    const pill = validateSetup({ ...s.ctx, range: narrow }, MODAL);
    expect(check(pill, 0).status).toBe('PASS');
    const custom = validateSetup(
      { ...s.ctx, range: narrow },
      { ...MODAL, entry: '4367.21', zoneId: undefined }
    );
    expect(check(custom, 0).codes).toEqual(['ENTRY_OUTSIDE_DAY_RANGE']);
  });
});

describe('check 1: risk, and the equity it is a percent of', () => {
  test.each([
    ['1.5', true],
    ['1.51', false],
    ['1.5000001', false],
    ['0.75', true],
    ['0.0001', true],
    ['0', false],
    ['-0.5', false],
  ])('a risk of %s: accepted %p (Max RPT 1.5)', (riskPct, accepted) => {
    const v = run({}, { riskPct });
    expect(check(v, 1).status).toBe(accepted ? 'PASS' : 'FAIL');
    expect(v.riskPct).toBe(accepted ? Rational.of(riskPct).toString() : null);
  });

  test.each([
    [{ riskPct: '1.51' }, 'RISK_ABOVE_MAX_RPT'],
    [{ riskPct: '0' }, 'RISK_NOT_POSITIVE'],
    [{ riskPct: -1 }, 'RISK_NOT_POSITIVE'],
    [{ riskPct: '1.2%' }, 'RISK_NOT_A_NUMBER'],
    [{ riskPct: 'high' }, 'RISK_NOT_A_NUMBER'],
    [{ riskPct: undefined }, 'RISK_MISSING'],
    [{ riskPct: '  ' }, 'RISK_MISSING'],
    [{ riskPct: null }, 'RISK_MISSING'],
  ])('refuses %p with %s', (fields, code) => {
    const v = run({}, fields as SetupFields);
    expect(check(v, 1).codes).toEqual([code]);
  });

  test('names the Max RPT it was held to', () => {
    expect(check(run({}, { riskPct: '1.6' }), 1).detail[0]).toContain('1.5%');
  });

  test('a higher Max RPT in the profile moves the line', () => {
    const v = run({ profile: { maxRiskPct: '2' } }, { riskPct: '2' });
    expect(check(v, 1).status).toBe('PASS');
    expect(
      check(run({ profile: { maxRiskPct: '2' } }, { riskPct: '2.01' }), 1)
        .status
    ).toBe('FAIL');
  });

  test.each([
    [{ equity: undefined }, 'EQUITY_MISSING'],
    [{ equity: 'lots' }, 'EQUITY_NOT_A_NUMBER'],
    [{ equity: '10,000' }, 'EQUITY_NOT_A_NUMBER'],
    [{ equity: 0 }, 'EQUITY_NOT_POSITIVE'],
    [{ equity: -5 }, 'EQUITY_NOT_POSITIVE'],
  ])('equity %p is refused with %s, under check 1', (fields, code) => {
    const v = run({}, fields as SetupFields);
    expect(check(v, 1).codes).toEqual([code]);
    expect(v.equity).toBeNull();
    expect(v.scenarios).toBeNull();
  });

  test('the equity may differ from the profile (an edit mid-session)', () => {
    const v = run({}, { equity: '12000' });
    expect(v.equity).toBe('12000');
    expect(check(v, 1).status).toBe('PASS');
    expect(v.profile.equity).toBe('10000');
  });

  test('both problems are reported', () => {
    const v = run({}, { equity: 'x', riskPct: '9' });
    expect(check(v, 1).codes).toEqual([
      'EQUITY_NOT_A_NUMBER',
      'RISK_ABOVE_MAX_RPT',
    ]);
  });
});

describe('check 2: the stop', () => {
  test.each([
    ['13', true],
    ['12.99', false],
    ['12.999', false],
    ['13.01', true],
    ['20', true],
  ])('a stop of %s: accepted %p (Min SLD 13)', (stopDistance, accepted) => {
    const v = run({}, { stopDistance });
    expect(check(v, 2).status).toBe(accepted ? 'PASS' : 'FAIL');
    if (!accepted) {
      expect(check(v, 2).codes).toEqual(['STOP_BELOW_MIN_SLD']);
      expect(check(v, 2).detail[0]).toContain('13');
    }
  });

  test.each([
    [{ stopDistance: undefined }, 'STOP_MISSING'],
    [{ stopDistance: 'tight' }, 'STOP_NOT_A_NUMBER'],
    [{ stopDistance: '$18.50' }, 'STOP_NOT_A_NUMBER'],
    [{ stopDistance: 0 }, 'STOP_NOT_POSITIVE'],
    [{ stopDistance: -18.5 }, 'STOP_NOT_POSITIVE'],
    [{ stopDistance: '4367.2' }, 'STOP_PRICE_NOT_POSITIVE'],
    [{ stopDistance: '5000' }, 'STOP_PRICE_NOT_POSITIVE'],
  ])('refuses %p with %s', (fields, code) => {
    const v = run({}, fields as SetupFields);
    expect(check(v, 2).codes).toEqual([code]);
    expect(v.stop).toEqual({
      distance: null,
      price: null,
      kind: null,
      level: null,
    });
  });

  test('a stop exactly as far as the entry is below zero: refused; a cent less: accepted', () => {
    expect(check(run({}, { stopDistance: '4367.2' }), 2).status).toBe('FAIL');
    expect(check(run({}, { stopDistance: '4367.19' }), 2).status).toBe('PASS');
  });

  test('a SELL stop has no floor above its entry', () => {
    const v = run(
      { golden: '03-' },
      { zoneId: 'Z1', entry: '4170.13', stopDistance: '5000', riskPct: '0.5' }
    );
    expect(check(v, 2).status).toBe('PASS');
    expect(v.side).toBe('SELL');
    expect(v.stop.price).toBe('9170.13');
  });

  describe('is named for what it is', () => {
    test('a structural option is named with its level', () => {
      const v = run({}, { stopDistance: '17.54' });
      expect(v.stop.kind).toBe('STRUCTURAL');
      expect(v.stop.level).toContain('LOEDT');
      expect(v.stop.price).toBe('4349.66');
      expect(check(v, 2).notes).toEqual(['STOP_STRUCTURAL']);
    });

    test('any other distance is custom', () => {
      const v = run({}, { stopDistance: '18.5' });
      expect(v.stop.kind).toBe('CUSTOM');
      expect(v.stop.level).toBeNull();
      expect(v.stop.price).toBe('4348.7');
      expect(check(v, 2).notes).toEqual(['STOP_CUSTOM']);
    });

    test('one cent off a structural distance is custom', () => {
      expect(run({}, { stopDistance: '16.79' }).stop.kind).toBe('CUSTOM');
      expect(run({}, { stopDistance: '16.77' }).stop.kind).toBe('CUSTOM');
    });

    test("the zone's minimum stop (no structure behind it) is named so", () => {
      // golden 13, DAY_TRADER: a SHORT whose Z1 invalidation is the 13-dollar minimum, not a level
      const v = run(
        { golden: '13-' },
        { zoneId: 'Z1', entry: '4138', stopDistance: '13', riskPct: '0.5' }
      );
      expect(v.entry.zoneId).toBe('Z1');
      expect(v.stop.kind).toBe('MINIMUM_STOP');
      expect(v.stop.level).toBeNull();
      expect(v.stop.price).toBe('4151');
      expect(check(v, 2).notes).toEqual(['STOP_MINIMUM']);
    });

    test('a custom entry gets the structural options of ITS price', () => {
      // from 4400 the nearest levels are others than from 4367.20
      const v = run(
        {},
        { entry: '4400', zoneId: undefined, stopDistance: '16.78' }
      );
      expect(v.stop.kind).toBe('CUSTOM');
    });

    test('with the levels unreadable, every stop is custom', () => {
      const v = run(
        { structure: { complete: false, levels: [], problems: [] } },
        { stopDistance: '16.78' }
      );
      expect(v.stop.kind).toBe('CUSTOM');
    });
  });
});

describe('check 3: the RRR', () => {
  test.each([
    ['1.5', true],
    ['1.49', false],
    ['2', true],
    ['2.5', true],
    ['2.51', false],
    ['3.5', false],
  ])(
    'a counter-trend setup, RRR %s: accepted %p (cap 2.5)',
    (rrr, accepted) => {
      const v = run({}, { rrr });
      expect(check(v, 3).status).toBe(accepted ? 'PASS' : 'FAIL');
      if (!accepted) {
        expect(check(v, 3).codes).toEqual([
          Rational.of(rrr).lt(Rational.of('1.5'))
            ? 'RRR_BELOW_MIN'
            : 'RRR_ABOVE_COUNTER_TREND_CAP',
        ]);
      }
    }
  );

  describe('with the trend', () => {
    const withTrend: SetupOptions = {
      pinned: {
        status: 'VALID',
        statusReasons: [],
        trendRelation: 'WITH_TREND',
      },
    };

    test.each([
      ['1.5', true],
      ['1.49', false],
      ['2.51', true],
      ['3.5', true],
      ['3.51', false],
      ['4', false],
    ])('RRR %s: accepted %p (range 1.5 to 3.5)', (rrr, accepted) => {
      const v = run(withTrend, { rrr });
      expect(v.counterTrend).toBe(false);
      expect(check(v, 3).status).toBe(accepted ? 'PASS' : 'FAIL');
      if (!accepted && Rational.of(rrr).gt(Rational.of('3.5'))) {
        expect(check(v, 3).codes).toEqual(['RRR_ABOVE_MAX']);
      }
    });
  });

  test.each([
    [{ rrr: undefined }, 'RRR_MISSING'],
    [{ rrr: 'two' }, 'RRR_NOT_A_NUMBER'],
    [{ rrr: '2.5x' }, 'RRR_NOT_A_NUMBER'],
    [{ rrr: 0 }, 'RRR_BELOW_MIN'],
    [{ rrr: -2 }, 'RRR_BELOW_MIN'],
  ])('refuses %p with %s', (fields, code) => {
    const v = run({}, fields as SetupFields);
    expect(check(v, 3).codes).toEqual([code]);
    expect(v.rrr).toBeNull();
  });

  test("the cap follows the SETUP, not the profile's style (ADR-064)", () => {
    // a Trend Following profile, a counter-trend setup, RRR 3: refused
    const v = run(
      { style: 'TREND_FOLLOWING', profile: { style: 'TREND_FOLLOWING' } },
      { rrr: '3' }
    );
    expect(check(v, 3).codes).toEqual(['RRR_ABOVE_COUNTER_TREND_CAP']);
  });
});

describe('check 4: leverage', () => {
  test('a lot the risk limit sets is nowhere near the leverage limit', () => {
    const v = run();
    expect(check(v, 4).status).toBe('PASS');
    expect(check(v, 4).notes).toEqual([]);
  });

  test('a lot the leverage limit sets is clamped, and says so', () => {
    // equity 5,000 at 1:1.5 allows 7,500 of exposure, about 0.017 lot at 4,367
    const v = run(
      { profile: { equity: '5000', maxLeverage: '1.5' } },
      { equity: '5000', riskPct: '1.5' }
    );
    expect(check(v, 4).status).toBe('PASS');
    expect(check(v, 4).notes).toEqual(['LOT_CLAMPED_BY_LEVERAGE']);
    const sizing = v.scenarios!.sizing;
    expect(sizing.status).toBe('OK');
    if (sizing.status === 'OK') {
      expect(sizing.limitedBy).toBe('LEVERAGE');
      expect(sizing.leverageUsed.lte(Rational.of('1.5'))).toBe(true);
    }
  });

  test('a lot exactly at the leverage limit is accepted', () => {
    // SELL at 4000, equity 10,000, 1:2: the most is exactly 0.05 lot, which is exactly 2.0 of leverage
    const s = setup({
      golden: '03-',
      profile: { maxLeverage: '2', maxRiskPct: '2' },
      specs: { typical_spread: 0 },
    });
    const range = dayRange(
      [{ openTime: s.now - 600, high: '4200', low: '3900' }],
      s.now
    );
    const v = validateSetup(
      { ...s.ctx, range },
      {
        entry: '4000',
        equity: '10000',
        riskPct: '2',
        stopDistance: '13',
        rrr: '1.75',
      }
    );
    expect(check(v, 0).status).toBe('PASS');
    const sizing = v.scenarios!.sizing;
    expect(sizing.status).toBe('OK');
    if (sizing.status === 'OK') {
      expect(sizing.limitedBy).toBe('LEVERAGE');
      expect(sizing.lot.toString()).toBe('0.05');
      expect(sizing.leverageUsed.toString()).toBe('2');
    }
    expect(check(v, 4).status).toBe('PASS');
    expect(check(v, 4).notes).toEqual(['LOT_CLAMPED_BY_LEVERAGE']);
  });

  test('is skipped when there is no lot to look at', () => {
    expect(check(run({}, { riskPct: '9' }), 4).status).toBe('SKIPPED');
    expect(check(run({ specs: null }), 4).status).toBe('SKIPPED');
  });
});

describe('check 5: no Tier-1 release within the window', () => {
  const cpi = (offset: number, over: Record<string, unknown> = {}) => ({
    valueId: 'v1',
    eventId: '900000001',
    eventName: 'TEST US CPI',
    eventTime: 1789764900 + 150 + offset,
    currency: 'USD',
    importance: 'HIGH',
    timeMode: 0,
    capturedAt: 1789764900 - 3600,
    ...over,
  });

  test.each([
    [-16 * 60, true],
    [-14 * 60, false],
    [14 * 60, false],
    [16 * 60, true],
    [15 * 60, false],
    [15 * 60 + 1, true],
  ])('a release %p seconds from now: allowed %p', (offset, allowed) => {
    const v = run({ events: [cpi(offset)] });
    expect(check(v, 5).status).toBe(allowed ? 'PASS' : 'FAIL');
    if (!allowed) {
      expect(check(v, 5).codes).toEqual(['TIER1_BLACKOUT']);
      expect(check(v, 5).detail[0]).toContain('TEST US CPI');
      expect(check(v, 5).detail[0]).toContain('the window ends');
    }
  });

  test('an approximate time widens it to an hour', () => {
    expect(
      check(run({ events: [cpi(-59 * 60, { timeMode: 1 })] }), 5).status
    ).toBe('FAIL');
    expect(
      check(run({ events: [cpi(-61 * 60, { timeMode: 1 })] }), 5).status
    ).toBe('PASS');
  });

  test('a blocked setup is still sized: only the blackout stands in the way', () => {
    const v = run({ events: [cpi(60)] });
    expect(statuses(v)).toBe('PPPPPFPP');
    expect(v.ok).toBe(false);
    expect(v.scenarios).not.toBeNull();
  });

  test.each<[SetupOptions, string, number | null]>([
    [{ list: null }, 'LIST_INVALID', null],
    [
      { list: { schemaVersion: 1, listVersion: 1, events: [] } },
      'LIST_NOT_SET',
      1,
    ],
    [{ calendarAge: null }, 'CALENDAR_EMPTY', 4],
  ])(
    'a blackout that cannot be judged (%p) fails closed with %s',
    (over, code, listVersion) => {
      const v = run(over);
      expect(check(v, 5).status).toBe('FAIL');
      expect(check(v, 5).codes).toEqual([code]);
      expect(v.versions.tier1List).toBe(listVersion);
    }
  );

  test('other HIGH-impact USD releases in the holding window are warnings, not a block', () => {
    const v = run({
      events: [
        {
          valueId: 'o1',
          eventId: '800000001',
          eventName: 'TEST Other USD',
          eventTime: 1789764900 + 150 + 3 * 3600,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 0,
          capturedAt: 1789764900 - 3600,
        },
      ],
    });
    expect(check(v, 5).status).toBe('PASS');
    expect(v.warnings).toEqual([
      {
        eventId: '800000001',
        eventName: 'TEST Other USD',
        eventTime: String(1789764900 + 150 + 3 * 3600),
        approximate: false,
        tier1: false,
      },
    ]);
  });

  test('a late calendar is noted and the blackout still applies', () => {
    const v = run({ calendarAge: 6 * 3600, events: [cpi(60)] });
    expect(check(v, 5).status).toBe('FAIL');
    const quiet = run({ calendarAge: 6 * 3600 });
    expect(check(quiet, 5).status).toBe('PASS');
    expect(check(quiet, 5).notes).toEqual(['CALENDAR_LATE']);
  });
});

describe('check 6: the setup is still valid and the data allows it', () => {
  test.each([
    [{ status: 'STALE', dataAsOfSlot: 1789764000 }, 'DATA_STALE'],
    [{ status: 'MARKET_CLOSED', dataAsOfSlot: 1789764000 }, 'MARKET_CLOSED'],
    [null, 'DATA_STATUS_UNKNOWN'],
  ])('the data status %p: refused with %s', (dataStatus, code) => {
    const v = run({ dataStatus });
    expect(check(v, 6).status).toBe('FAIL');
    expect(check(v, 6).codes).toEqual([code]);
    expect(v.ok).toBe(false);
  });

  test('DELAYED data allows it, the delay a notice', () => {
    const v = run({
      dataStatus: { status: 'DELAYED', dataAsOfSlot: 1789764900 },
    });
    expect(check(v, 6).status).toBe('PASS');
    expect(v.notices).toContain('DATA_DELAYED');
  });

  test('a synthesis that stands aside is not a setup, and there is no side', () => {
    const v = run({ pinned: { bias: 'STAND_ASIDE', trendRelation: null } });
    expect(check(v, 6).codes).toEqual(['SYNTHESIS_STAND_ASIDE']);
    expect(v.side).toBeNull();
    expect(v.counterTrend).toBe(false);
    expect(v.scenarios).toBeNull();
  });

  test('a newer cycle that changed the picture asks for a refresh', () => {
    const base = setup();
    const newer = {
      cycleSlot: base.slot + 300,
      bias: 'SHORT',
      status: 'CAUTIONARY',
      statusReasons: ['MCD0_DEFECT_M5'],
      trendRelation: 'WITH_TREND',
      ruleId: 'OTHER',
      branchId: null,
      retuning: false,
    };
    const v = run({ newest: newer });
    expect(check(v, 6).codes).toEqual(['SETUP_CHANGED']);
    expect(v.ok).toBe(false);
  });

  test('a picked zone past its invalidation is refused, another zone is not', () => {
    // the newest price is 4350.42, Z1's invalidation; Z2's is 4334.06
    const z1 = run({ price: 4350.42 }, { entry: '4367.2', zoneId: 'Z1' });
    expect(check(z1, 6).codes).toEqual(['PAST_INVALIDATION']);
    expect(check(z1, 6).detail[0]).toContain('Z1');
    const z2 = run(
      { price: 4350.42 },
      { entry: '4350.16', zoneId: 'Z2', stopDistance: '16.1' }
    );
    expect(check(z2, 6).status).toBe('PASS');
  });

  test('one cent above the invalidation is still valid', () => {
    const v = run({ price: 4350.43 });
    expect(check(v, 6).status).toBe('PASS');
  });

  test('a custom entry is not tied to a zone, so a zone past its invalidation does not refuse it', () => {
    const v = run({ price: 4350.42 }, { entry: '4375', zoneId: undefined });
    expect(check(v, 6).status).toBe('PASS');
  });

  test('every zone past its invalidation: the offer check refuses (row 9)', () => {
    const v = run({ price: 4300 });
    expect(check(v, 6).codes).toEqual(['PAST_INVALIDATION']);
  });

  test('a zone the offer did not check fails closed', () => {
    const s = setup();
    const v = validateSetup(
      { ...s.ctx, offer: { ...s.ctx.offer, zones: [] } },
      MODAL
    );
    expect(check(v, 6).codes).toEqual(['ZONE_NOT_CHECKED']);
  });

  test("the blackout and the broker figures are not this check's business", () => {
    const blackout = run({
      events: [
        {
          valueId: 'v1',
          eventId: '900000001',
          eventName: 'TEST US CPI',
          eventTime: 1789764900 + 150 + 60,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 0,
          capturedAt: 1789764900 - 3600,
        },
      ],
    });
    expect(check(blackout, 6).status).toBe('PASS');
    const noSpecs = run({ specs: null });
    expect(check(noSpecs, 6).status).toBe('PASS');
  });

  describe("the direction is the synthesis', never the trader's", () => {
    test.each([
      ['BUY', true],
      ['LONG', true],
      ['SELL', false],
      ['SHORT', false],
    ])('a typed side of %s: accepted %p', (side, accepted) => {
      const v = run({}, { side });
      expect(check(v, 6).status).toBe(accepted ? 'PASS' : 'FAIL');
      if (!accepted) expect(check(v, 6).codes).toEqual(['DIRECTION_MISMATCH']);
    });

    test.each(['buy', 'up', 5, true, 'constructor', '__proto__', 'toString'])(
      'a side of %p is not recognised',
      (side) => {
        const v = run({}, { side });
        expect(check(v, 6).codes).toEqual(['SIDE_NOT_RECOGNISED']);
      }
    );

    test.each([undefined, null, ''])('no side typed (%p) is fine', (side) => {
      expect(check(run({}, { side }), 6).status).toBe('PASS');
    });

    test('a side with a space around it is read', () => {
      expect(check(run({}, { side: ' BUY ' }), 6).status).toBe('PASS');
    });
  });
});

describe('check 7: the lot', () => {
  // loss per lot at the stop: (16.78 + 0.25) x 100 + 4 = 1707 dollars
  test('a lot of exactly the broker minimum is accepted', () => {
    const v = run({}, { equity: '1707', riskPct: '1' });
    expect(check(v, 7).status).toBe('PASS');
    const sizing = v.scenarios!.sizing;
    expect(sizing.status).toBe('OK');
    if (sizing.status === 'OK') expect(sizing.lot.toString()).toBe('0.01');
    expect(v.underflow).toBeNull();
    expect(check(v, 7).notes).toEqual(['LIMITED_BY_RISK']);
  });

  test('a cent of equity less is an underflow, never rounded up to the minimum', () => {
    const v = run({}, { equity: '1706.99', riskPct: '1' });
    expect(check(v, 7).status).toBe('FAIL');
    expect(check(v, 7).codes).toEqual(['LOT_BELOW_BROKER_MINIMUM']);
    expect(check(v, 7).notes).toEqual(['CAUSE_RISK']);
    expect(v.scenarios!.sizing.status).toBe('UNDERFLOW');
    expect(v.ok).toBe(false);
  });

  test("the underflow help stays inside the trader's limits", () => {
    const v = run({}, { equity: '1706.99', riskPct: '1' });
    const kinds = v.underflow!.options.map((o) => o.kind);
    expect(kinds).toContain('RAISE_RISK');
    expect(kinds).toContain('DECLINE');
    for (const option of v.underflow!.options) {
      if (option.kind === 'RAISE_RISK') {
        expect(option.riskPct.lte(Rational.of(ROOMY_PROFILE.maxRiskPct))).toBe(
          true
        );
      }
    }
    expect(JSON.stringify(v.underflow)).not.toContain('EQUITY_SET');
  });

  test('the targets are still worked out when there is no lot', () => {
    const v = run({}, { equity: '1706.99', riskPct: '1' });
    expect(v.scenarios!.scenarios).toHaveLength(3);
    expect(
      v.scenarios!.scenarios.every((s) => s.target.netProfit === null)
    ).toBe(true);
  });

  test('a lot the leverage limit forbids says so as a fact, not an offer', () => {
    const v = run(
      { profile: { maxLeverage: '1' } },
      { equity: '1000', riskPct: '1.5' }
    );
    expect(check(v, 7).codes).toEqual(['LOT_BELOW_BROKER_MINIMUM']);
    expect(check(v, 7).notes).toContain('CAUSE_LEVERAGE');
    const kinds = v.underflow!.options.map((o) => o.kind);
    expect(kinds).not.toContain('RAISE_RISK');
    expect(v.underflow!.facts.map((f) => f.kind)).toContain(
      'EQUITY_NEEDED_FOR_LEVERAGE'
    );
  });

  test.each([[null, 'NO_SPECS']])(
    'no broker row (%p): refused, %s',
    (specs, note) => {
      const v = run({ specs });
      expect(check(v, 7).codes).toEqual(['NO_BROKER_FIGURES']);
      expect(check(v, 7).notes).toEqual([note]);
      expect(v.scenarios).toBeNull();
      expect(v.versions.specs).toBeNull();
    }
  );

  test('a broker row over 7 days old is not usable', () => {
    const fresh = run({ specsAge: 7 * 86400 });
    expect(check(fresh, 7).status).toBe('PASS');
    const stale = run({ specsAge: 7 * 86400 + 1 });
    expect(check(stale, 7).codes).toEqual(['NO_BROKER_FIGURES']);
    expect(check(stale, 7).notes).toEqual(['SPECS_STALE']);
  });

  test('is reported even when the inputs are also wrong', () => {
    const v = run({ specs: null }, { riskPct: '9' });
    expect(check(v, 7).status).toBe('FAIL');
    expect(check(v, 1).status).toBe('FAIL');
  });

  test('is skipped when the numbers are not acceptable and the broker is fine', () => {
    const v = run({}, { stopDistance: '5' });
    expect(check(v, 7).status).toBe('SKIPPED');
    expect(check(v, 4).status).toBe('SKIPPED');
  });

  test('a change in the broker row changes the lot with no change in code', () => {
    const base = run({}, { equity: '100000', riskPct: '1' });
    const small = run(
      { specs: { contract_size: 10 } },
      { equity: '100000', riskPct: '1' }
    );
    const lot = (v: ValidatedSetup) => {
      const s = v.scenarios!.sizing;
      return s.status === 'OK' ? s.lot.toString() : s.status;
    };
    expect(lot(small)).not.toBe(lot(base));
  });
});

describe('how a refusal cascades', () => {
  test('a check that needs a refused input is SKIPPED, not failed again', () => {
    const v = run({}, { riskPct: '9' });
    expect(statuses(v)).toBe('PFPPSPPS');
    expect(v.ok).toBe(false);
    expect(v.scenarios).toBeNull();
    expect(v.underflow).toBeNull();
  });

  test('every check is reported, in order, on a setup that is wrong everywhere', () => {
    const v = run(
      { dataStatus: { status: 'STALE', dataAsOfSlot: null }, specs: null },
      {
        entry: '4500',
        zoneId: undefined,
        riskPct: '5',
        stopDistance: '3',
        rrr: '9',
      }
    );
    expect(v.checks).toHaveLength(8);
    expect(statuses(v)).toBe('FFFFSPFF');
    expect(v.ok).toBe(false);
  });

  test('nothing is thrown for a setup full of nonsense', () => {
    expect(() =>
      validateSetup(setup().ctx, {
        side: {},
        zoneId: [],
        entry: {},
        equity: [],
        riskPct: () => 1,
        stopDistance: Symbol('x'),
        rrr: new Date(),
      })
    ).not.toThrow();
  });

  test('an empty form is every field missing', () => {
    const v = validateSetup(setup().ctx, {});
    expect(check(v, 0).codes).toEqual(['ENTRY_MISSING']);
    expect(check(v, 1).codes).toEqual(['EQUITY_MISSING', 'RISK_MISSING']);
    expect(check(v, 2).codes).toEqual(['STOP_MISSING']);
    expect(check(v, 3).codes).toEqual(['RRR_MISSING']);
  });
});

describe('which zone an entry belongs to', () => {
  test("zones of the other side are not this reading's, even with the same ids", () => {
    // the 28 Sep downtrend has a Z1 and a Z2 too (SHORT, 4170.13 and 4249.14)
    const both = [...zonesOf(golden('01-')), ...zonesOf(golden('03-'))];
    const picked = run({ zones: both }, { entry: undefined, zoneId: 'Z1' });
    expect(picked.entry).toEqual({
      price: '4367.2',
      source: 'ZONE',
      zoneId: 'Z1',
    });
    // and a price that is only the other side's zone price is not a zone price here
    const other = run({ zones: both }, { entry: '4170.13', zoneId: undefined });
    expect(other.entry.source).toBe('CUSTOM');
    expect(check(other, 0).codes).toEqual(['ENTRY_OUTSIDE_DAY_RANGE']);
  });

  test('two zones at one price: the better-ranked one, whatever order they come in', () => {
    const [z1, z2] = zonesOf(golden('01-'));
    const twin = { ...z2!, referencePrice: z1!.referencePrice };
    for (const zones of [
      [z1!, twin],
      [twin, z1!],
    ]) {
      const v = run({ zones }, { entry: '4367.2', zoneId: undefined });
      expect(v.entry.zoneId).toBe('Z1');
    }
  });

  test("a zone's minimum stop is named only at exactly that distance", () => {
    const over = { golden: '13-' };
    const fields = { zoneId: 'Z1', entry: '4138', riskPct: '0.5' };
    expect(run(over, { ...fields, stopDistance: '13' }).stop.kind).toBe(
      'MINIMUM_STOP'
    );
    expect(run(over, { ...fields, stopDistance: '20' }).stop.kind).toBe(
      'CUSTOM'
    );
    expect(run(over, { ...fields, stopDistance: '13.01' }).stop.kind).toBe(
      'CUSTOM'
    );
  });
});

describe('what the validator hands to the underflow help', () => {
  test('a nearer structural stop is offered when it would give a lot', () => {
    // 2,000 of equity at 1%: 20 dollars. At the 33.14 stop a lot costs 3,343, at 16.78 it costs 1,707.
    const v = run({}, { equity: '2000', riskPct: '1', stopDistance: '33.14' });
    expect(check(v, 7).codes).toEqual(['LOT_BELOW_BROKER_MINIMUM']);
    const nearer = v.underflow!.options.flatMap((o) =>
      o.kind === 'NEARER_STRUCTURAL_STOP' ? [o.stopDistance.toString()] : []
    );
    expect(nearer).toEqual(['16.78', '17.54']);
  });

  test('raising the risk is not offered above Max RPT', () => {
    // 1,000 of equity at 1%: a minimum lot costs 17.07, which is 1.71% of the equity, over the 1.5%
    const v = run({}, { equity: '1000', riskPct: '1' });
    expect(check(v, 7).codes).toEqual(['LOT_BELOW_BROKER_MINIMUM']);
    const kinds = v.underflow!.options.map((o) => o.kind);
    expect(kinds).not.toContain('RAISE_RISK');
    expect(kinds).toContain('DECLINE');
  });
});

describe('what check 6 takes from the offer check', () => {
  test('no price to judge the zones by', () => {
    const v = run({ price: null }, { entry: '4375', zoneId: undefined });
    expect(check(v, 6).codes).toEqual(['PRICE_UNKNOWN']);
  });

  test("no zone on the reading's side", () => {
    const v = run({ zones: [] }, { entry: '4375', zoneId: undefined });
    expect(check(v, 6).codes).toEqual(['NO_ZONES']);
  });

  test('a side typed against a synthesis with no direction adds nothing', () => {
    const v = run(
      { pinned: { bias: 'STAND_ASIDE', trendRelation: null } },
      { side: 'BUY' }
    );
    expect(check(v, 6).codes).toEqual(['SYNTHESIS_STAND_ASIDE']);
  });

  test('a clear blackout has nothing to note', () => {
    expect(check(run(), 5).notes).toEqual([]);
  });
});

describe('the half-risk pre-set and its override (6.6, ADR-061)', () => {
  const reasons = ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'];

  test('a CAUTIONARY cycle pre-sets half of Max RPT, with the reason', () => {
    const v = run();
    expect(v.risk).toEqual({
      preset: '0.75',
      max: '1.5',
      halfRisk: true,
      reasons,
    });
  });

  test('the pre-set itself is not an override', () => {
    expect(run({}, { riskPct: '0.75' }).overrides.defectFlag).toBeNull();
  });

  test('less than the pre-set is not an override', () => {
    expect(run({}, { riskPct: '0.5' }).overrides.defectFlag).toBeNull();
  });

  test('more than the pre-set, up to Max RPT, is an override and records the reason', () => {
    const v = run({}, { riskPct: '1.5' });
    expect(check(v, 1).status).toBe('PASS');
    expect(v.overrides.defectFlag).toEqual({
      preset: '0.75',
      chosen: '1.5',
      reasons,
    });
  });

  test('one step above the pre-set is already an override', () => {
    expect(run({}, { riskPct: '0.76' }).overrides.defectFlag).toEqual({
      preset: '0.75',
      chosen: '0.76',
      reasons,
    });
  });

  test('above Max RPT is refused and records no override', () => {
    const v = run({}, { riskPct: '1.51' });
    expect(check(v, 1).status).toBe('FAIL');
    expect(v.overrides.defectFlag).toBeNull();
  });

  test('a RETUNING cycle halves it too', () => {
    const v = run(
      { retuning: true, pinned: { status: 'VALID', statusReasons: [] } },
      { riskPct: '1' }
    );
    expect(v.risk.halfRisk).toBe(true);
    expect(v.risk.preset).toBe('0.75');
    expect(v.overrides.defectFlag).toEqual({
      preset: '0.75',
      chosen: '1',
      reasons: ['RETUNING'],
    });
  });

  test('a cycle with nothing wrong pre-sets the full Max RPT and has nothing to override', () => {
    const v = run(
      { pinned: { status: 'VALID', statusReasons: [] } },
      { riskPct: '1.5' }
    );
    expect(v.risk).toEqual({
      preset: '1.5',
      max: '1.5',
      halfRisk: false,
      reasons: [],
    });
    expect(v.overrides.defectFlag).toBeNull();
  });

  test('half of an odd Max RPT is exact', () => {
    const v = run({ profile: { maxRiskPct: '1.75' } }, { riskPct: '0.875' });
    expect(v.risk.preset).toBe('0.875');
    expect(v.overrides.defectFlag).toBeNull();
    expect(
      run({ profile: { maxRiskPct: '1.75' } }, { riskPct: '0.88' }).overrides
        .defectFlag
    ).not.toBeNull();
  });

  test('the override is recorded even when other checks fail', () => {
    const v = run({}, { riskPct: '1.2', stopDistance: '5' });
    expect(v.overrides.defectFlag?.chosen).toBe('1.2');
  });
});

describe('the same setup, however it arrives, is byte-identical (6.14, ADR-067)', () => {
  const modal: SetupFields = {
    zoneId: 'Z1',
    entry: '4367.20',
    equity: '10000',
    riskPct: '0.75',
    stopDistance: '16.78',
    rrr: '1.75',
  };
  // what section 4 extracts from "risk 0.75%, stop $16.78, RRR 1.75 at 4367.2": numbers and loose text
  const chat: SetupFields = {
    side: 'BUY',
    entry: 4367.2,
    equity: 10000,
    riskPct: 0.75,
    stopDistance: 16.78,
    rrr: 1.75,
  };
  const loose: SetupFields = {
    side: 'LONG',
    entry: ' 4367.2000 ',
    equity: '10000.00',
    riskPct: '0.750',
    stopDistance: '16.7800',
    rrr: '1.7500',
  };
  const pillOnly: SetupFields = { ...modal, entry: undefined };

  const text = (fields: SetupFields, over: SetupOptions = {}) =>
    serializeValidatedSetup(validateSetup(setup(over).ctx, fields));

  test('modal fields, chat numbers, loose chat text and a bare pick all give the same text', () => {
    const reference = text(modal);
    expect(text(chat)).toBe(reference);
    expect(text(loose)).toBe(reference);
    expect(text(pillOnly)).toBe(reference);
  });

  test('the same input twice gives the same text', () => {
    expect(text(modal)).toBe(text(modal));
  });

  test('also for a custom entry', () => {
    const a = text({
      ...modal,
      zoneId: undefined,
      entry: '4375.50',
      stopDistance: '20',
    });
    const b = text({ ...chat, entry: 4375.5, stopDistance: 20 });
    expect(a).toBe(b);
    expect(JSON.parse(a).entry.source).toBe('CUSTOM');
  });

  test('also for a SELL', () => {
    const over: SetupOptions = { golden: '03-' };
    const a = text(
      {
        zoneId: 'Z1',
        equity: '10000',
        riskPct: '0.75',
        stopDistance: '44.37',
        rrr: '1.75',
      },
      over
    );
    const b = text(
      {
        side: 'SELL',
        entry: 4170.13,
        equity: 10000,
        riskPct: 0.75,
        stopDistance: 44.37,
        rrr: 1.75,
      },
      over
    );
    expect(a).toBe(b);
    expect(JSON.parse(a).side).toBe('SELL');
  });

  test('also when it is refused: the same refusal, the same text', () => {
    const a = text({ ...modal, riskPct: '1.6', stopDistance: '12' });
    const b = text({ ...chat, riskPct: 1.6, stopDistance: 12 });
    expect(a).toBe(b);
    expect(JSON.parse(a).ok).toBe(false);
  });

  test('a different value gives different text', () => {
    expect(text({ ...modal, riskPct: '0.5' })).not.toBe(text(modal));
  });
});

describe('what the validator leaves alone', () => {
  test('does not change the context it is given', () => {
    const s = setup();
    const zoneIds = s.ctx.zones.map((z) => z.zoneId);
    const profile = JSON.stringify(s.ctx.profile);
    const reversed = { ...s.ctx, zones: [...s.ctx.zones].reverse() };
    const before = reversed.zones.map((z) => z.zoneId);
    validateSetup(reversed, MODAL);
    expect(reversed.zones.map((z) => z.zoneId)).toEqual(before);
    expect(s.ctx.zones.map((z) => z.zoneId)).toEqual(zoneIds);
    expect(JSON.stringify(s.ctx.profile)).toBe(profile);
  });

  test('hands back its own copy of the profile', () => {
    const s = setup();
    const v = validateSetup(s.ctx, MODAL);
    v.profile.equity = '1';
    expect(s.ctx.profile.equity).toBe('10000');
  });

  test('zones given in any order give the same answer', () => {
    const s = setup();
    const forward = serializeValidatedSetup(validateSetup(s.ctx, MODAL));
    const reversed = serializeValidatedSetup(
      validateSetup({ ...s.ctx, zones: [...s.ctx.zones].reverse() }, MODAL)
    );
    expect(reversed).toBe(forward);
  });
});

describe('every golden reading, validated at its own first zone', () => {
  const cases = loadGoldens().flatMap((g) =>
    g.readings
      .filter((r) => r.zones.length > 0)
      .map((r) => ({
        prefix: g.id.slice(0, 3),
        id: g.id,
        profile: r.profile,
        reading: r,
      }))
  );

  test.each(cases.map((c) => [`${c.id} ${c.profile}`, c] as const))(
    '%s: the checks that depend on the numbers pass or fail by the zone, never by accident',
    (_label, c) => {
      const s = setup({ golden: c.prefix, gProfile: c.profile });
      const zone = c.reading.zones[0]!;
      const v = validateSetup(s.ctx, {
        zoneId: zone['zone_id'],
        equity: '10000',
        riskPct: '0.5',
        stopDistance: String(zone['stop_distance']),
        rrr: '1.5',
      });
      expect(v.checks).toHaveLength(8);
      // the zone's price is always a legal entry
      expect(check(v, 0).status).toBe('PASS');
      expect(v.entry.zoneId).toBe(zone['zone_id']);
      // the zone's own stop distance is at least the builder's 13, and Min SLD is 13
      expect(check(v, 2).status).toBe('PASS');
      expect(check(v, 1).status).toBe('PASS');
      expect(check(v, 3).status).toBe('PASS');
      // wherever the synthesis gives a direction, the side is the zone's
      expect(v.side).toBe(zone['bias'] === 'LONG' ? 'BUY' : 'SELL');
      expect(() => serializeValidatedSetup(v)).not.toThrow();
    }
  );

  test('there are cases for at least the 31 golden zones', () => {
    expect(
      cases.reduce((n, c) => n + c.reading.zones.length, 0)
    ).toBeGreaterThanOrEqual(31);
  });
});
