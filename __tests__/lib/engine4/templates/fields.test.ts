/**
 * @jest-environment node
 */

/**
 * What the modal can say before it asks the server (build step 5, part 7).
 *
 * The prechecks are the browser's copy of checks 0 to 3 of `validateSetup`. A copy
 * that drifted would tell a trader "fine" about a value the server refuses, or
 * "wrong" about one it accepts, so the central test is differential: over a sweep of
 * values the precheck and the validator are asked the same question and must give the
 * same answer, code for code.
 */

import {
  Rational,
  buildModalDefinition,
  validateSetup,
  type SetupFields,
} from '@/lib/engine4';
import {
  allowedEntryRange,
  initialStop,
  limitsOf,
  parseTyped,
  precheckCustomEntry,
  precheckEquity,
  precheckRisk,
  precheckRrr,
  precheckStop,
  sameStopSelection,
  shownEntryRange,
  stopDistanceFor,
} from '@/lib/engine4/templates/fields';
import { readWire, type WireOfferedModal } from '@/lib/engine4/templates/wire';

import { loadGoldens } from '../helpers/stored';
import { setup, zonesOf } from '../helpers/setup';
import { toWire } from '../../../components/report2/helpers/engine-api';

const BASE: SetupFields = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

type Ctx = ReturnType<typeof setup>['ctx'];

/** the modal and the validator's context, the context optionally changed after the offer was made */
function modalOf(
  options: Parameters<typeof setup>[0] = {},
  change: Partial<Ctx> = {}
): { ctx: Ctx; modal: WireOfferedModal } {
  const ctx: Ctx = { ...setup(options).ctx, ...change };
  const modal = toWire<WireOfferedModal>(
    buildModalDefinition({
      profile: ctx.profile,
      offer: ctx.offer,
      zones: ctx.zones,
      structure: ctx.structure,
      range: ctx.range,
      livePrice: ctx.livePrice,
    })
  );
  if (modal.status === ('NOT_OFFERED' as string))
    throw new Error('not offered');
  return { ctx, modal };
}

describe('parseTyped', () => {
  test.each([
    ['', 'MISSING'],
    ['   ', 'MISSING'],
    ['abc', 'BAD'],
    ['1,5', 'BAD'],
    ['--1', 'BAD'],
    ['1.2.3', 'BAD'],
    ['1.5', 'OK'],
    [' 1.5 ', 'OK'],
    ['1e2', 'OK'],
    ['-3', 'OK'],
    ['.5', 'BAD'],
  ])('%j is %s', (text, state) => {
    expect(parseTyped(text).state).toBe(state);
  });

  test('reads a decimal exactly, with no JavaScript number', () => {
    const parsed = parseTyped('0.1');
    expect(parsed.state).toBe('OK');
    if (parsed.state === 'OK') {
      expect(parsed.value.add(Rational.of('0.2')).eq(Rational.of('0.3'))).toBe(
        true
      );
    }
  });
});

describe('each precheck at its boundary', () => {
  test('equity: above zero', () => {
    expect(precheckEquity('')).toBe('EQUITY_MISSING');
    expect(precheckEquity('x')).toBe('EQUITY_NOT_A_NUMBER');
    expect(precheckEquity('0')).toBe('EQUITY_NOT_POSITIVE');
    expect(precheckEquity('-1')).toBe('EQUITY_NOT_POSITIVE');
    expect(precheckEquity('0.01')).toBeNull();
    expect(precheckEquity('5000')).toBeNull();
  });

  test('risk: above zero and at most Max RPT, exactly', () => {
    expect(precheckRisk('', '1.5')).toBe('RISK_MISSING');
    expect(precheckRisk('x', '1.5')).toBe('RISK_NOT_A_NUMBER');
    expect(precheckRisk('0', '1.5')).toBe('RISK_NOT_POSITIVE');
    expect(precheckRisk('1.5', '1.5')).toBeNull();
    expect(precheckRisk('1.50', '1.5')).toBeNull();
    expect(precheckRisk('1.5000000000000001', '1.5')).toBe(
      'RISK_ABOVE_MAX_RPT'
    );
    expect(precheckRisk('0.75', '1.5')).toBeNull();
  });

  test('stop: above zero, at least Min SLD, and a BUY stop price above zero', () => {
    expect(precheckStop('', '13')).toBe('STOP_MISSING');
    expect(precheckStop('x', '13')).toBe('STOP_NOT_A_NUMBER');
    expect(precheckStop('0', '13')).toBe('STOP_NOT_POSITIVE');
    expect(precheckStop('12.99', '13')).toBe('STOP_BELOW_MIN_SLD');
    expect(precheckStop('13', '13')).toBeNull();
    expect(precheckStop('4367.2', '13', { side: 'BUY', entry: '4367.2' })).toBe(
      'STOP_PRICE_NOT_POSITIVE'
    );
    expect(
      precheckStop('4367.1', '13', { side: 'BUY', entry: '4367.2' })
    ).toBeNull();
    // a SELL's stop price is above the entry, so there is nothing to refuse
    expect(
      precheckStop('9999', '13', { side: 'SELL', entry: '4367.2' })
    ).toBeNull();
    // with no entry yet, only the distance can be judged
    expect(precheckStop('9999', '13', { side: 'BUY', entry: null })).toBeNull();
  });

  test('RRR: from 1.50, to 3.50, or the counter-trend cap of 2.50', () => {
    const open = { min: '1.5', max: '3.5', counterTrend: false };
    const capped = { min: '1.5', max: '2.5', counterTrend: true };
    expect(precheckRrr('', open)).toBe('RRR_MISSING');
    expect(precheckRrr('x', open)).toBe('RRR_NOT_A_NUMBER');
    expect(precheckRrr('1.49', open)).toBe('RRR_BELOW_MIN');
    expect(precheckRrr('1.5', open)).toBeNull();
    expect(precheckRrr('3.5', open)).toBeNull();
    expect(precheckRrr('3.51', open)).toBe('RRR_ABOVE_MAX');
    expect(precheckRrr('2.5', capped)).toBeNull();
    expect(precheckRrr('2.51', capped)).toBe('RRR_ABOVE_COUNTER_TREND_CAP');
  });
});

describe('a custom entry', () => {
  const { modal } = modalOf();
  const bounds = modal.custom.entry;
  const zones = modal.pills.map((pill) => pill.price);

  test('the definition gives both bounds on the 18 Sep cycle', () => {
    expect(bounds.day).not.toBeNull();
    expect(bounds.typo).not.toBeNull();
  });

  test('inside both bounds is fine; the edges themselves are fine; one cent past is not', () => {
    const day = bounds.day;
    if (day === null) throw new Error('no day bound');
    const lower = readWire(day.lower);
    const upper = readWire(day.upper);
    const cent = Rational.of('0.01');
    expect(precheckCustomEntry(lower.toString(), bounds, zones)).toBeNull();
    expect(precheckCustomEntry(upper.toString(), bounds, zones)).toBeNull();
    expect(precheckCustomEntry(lower.sub(cent).toString(), bounds, zones)).toBe(
      'ENTRY_OUTSIDE_DAY_RANGE'
    );
    expect(precheckCustomEntry(upper.add(cent).toString(), bounds, zones)).toBe(
      'ENTRY_OUTSIDE_DAY_RANGE'
    );
    expect(precheckCustomEntry('4370', bounds, zones)).toBeNull();
  });

  test('the typo filter is looked at first', () => {
    expect(precheckCustomEntry('9999', bounds, zones)).toBe('ENTRY_TYPO');
    expect(precheckCustomEntry('100', bounds, zones)).toBe('ENTRY_TYPO');
  });

  test('a zone price is the zone and always legal', () => {
    for (const price of zones) {
      expect(precheckCustomEntry(price, bounds, zones)).toBeNull();
      expect(precheckCustomEntry(`${price}0`, bounds, zones)).toBeNull();
    }
  });

  test('empty, not a number and not above zero', () => {
    expect(precheckCustomEntry('', bounds, zones)).toBe('ENTRY_MISSING');
    expect(precheckCustomEntry('abc', bounds, zones)).toBe(
      'ENTRY_NOT_A_NUMBER'
    );
    expect(precheckCustomEntry('0', bounds, zones)).toBe('ENTRY_NOT_POSITIVE');
    expect(precheckCustomEntry('-4', bounds, zones)).toBe('ENTRY_NOT_POSITIVE');
  });

  test('an unknown bound refuses: it is never a pass', () => {
    expect(
      precheckCustomEntry('4370', { day: bounds.day, typo: null }, zones)
    ).toBe('LIVE_PRICE_UNKNOWN');
    expect(
      precheckCustomEntry('4370', { day: null, typo: bounds.typo }, zones)
    ).toBe('DAY_RANGE_UNKNOWN');
    // but a zone price needs no bound
    expect(
      precheckCustomEntry(zones[0] as string, { day: null, typo: null }, zones)
    ).toBeNull();
  });

  test('allowedEntryRange is the stricter of the two bounds, and null when either is unknown', () => {
    const range = allowedEntryRange(bounds);
    expect(range).not.toBeNull();
    if (range !== null && bounds.day !== null && bounds.typo !== null) {
      expect(readWire(range.low).gte(readWire(bounds.day.lower))).toBe(true);
      expect(readWire(range.low).gte(readWire(bounds.typo.lower))).toBe(true);
      expect(readWire(range.high).lte(readWire(bounds.day.upper))).toBe(true);
      expect(readWire(range.high).lte(readWire(bounds.typo.upper))).toBe(true);
    }
    expect(allowedEntryRange({ day: null, typo: bounds.typo })).toBeNull();
    expect(allowedEntryRange({ day: bounds.day, typo: null })).toBeNull();
  });
});

describe('the prechecks agree with the validator, code for code', () => {
  const { ctx, modal } = modalOf();
  const limits = limitsOf(modal);
  const codes = (check: number, fields: SetupFields): string[] =>
    validateSetup(ctx, fields).checks[check]!.codes;

  test('equity (check 1)', () => {
    for (const equity of [
      '',
      ' ',
      'x',
      '0',
      '-5',
      '0.01',
      '300',
      '10000',
      '1e3',
      '1,5',
    ]) {
      const pre = precheckEquity(equity);
      const real = codes(1, { ...BASE, equity }).filter((c) =>
        c.startsWith('EQUITY_')
      );
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
  });

  test('risk (check 1)', () => {
    for (const riskPct of [
      '',
      'x',
      '0',
      '-1',
      '0.01',
      '0.75',
      '1.5',
      '1.51',
      '2',
      '99',
      ' 1.2 ',
    ]) {
      const pre = precheckRisk(riskPct, limits.riskMax as string);
      const real = codes(1, { ...BASE, riskPct }).filter((c) =>
        c.startsWith('RISK_')
      );
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
  });

  test('stop (check 2)', () => {
    for (const stopDistance of [
      '',
      'x',
      '0',
      '-3',
      '5',
      '12.99',
      '13',
      '16.78',
      '99999',
      '4367.2',
      '4367.19',
    ]) {
      const pre = precheckStop(stopDistance, limits.stopMin as string, {
        side: 'BUY',
        entry: '4367.2',
      });
      const real = codes(2, { ...BASE, stopDistance });
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
  });

  test('RRR (check 3), on a counter-trend cycle and on a with-trend one', () => {
    for (const rrr of [
      '',
      'x',
      '1',
      '1.49',
      '1.5',
      '2.5',
      '2.51',
      '3.5',
      '3.51',
      '4',
    ]) {
      const pre = precheckRrr(rrr, {
        min: modal.rrr.min,
        max: modal.rrr.max,
        counterTrend: modal.counterTrend,
      });
      const real = codes(3, { ...BASE, rrr });
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
    const open = modalOf({ golden: '04-' });
    expect(open.modal.counterTrend).toBe(false);
    for (const rrr of ['3.5', '3.51', '2.51']) {
      const pre = precheckRrr(rrr, {
        min: open.modal.rrr.min,
        max: open.modal.rrr.max,
        counterTrend: open.modal.counterTrend,
      });
      const real = validateSetup(open.ctx, {
        zoneId: 'Z1',
        equity: '10000',
        riskPct: '1',
        stopDistance: '30.5',
        rrr,
      }).checks[3]!.codes;
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
  });

  test('a custom entry (check 0), around both bounds and the zones', () => {
    const day = modal.custom.entry.day!;
    const cent = Rational.of('0.01');
    const lower = readWire(day.lower);
    const upper = readWire(day.upper);
    const candidates = [
      '',
      'abc',
      '0',
      '-1',
      '1e999',
      '100',
      '9999',
      lower.sub(cent).toString(),
      lower.toString(),
      lower.add(cent).toString(),
      upper.sub(cent).toString(),
      upper.toString(),
      upper.add(cent).toString(),
      '4367.2',
      '4367.20',
      '4350.16',
      '4370',
      '4378.31',
    ];
    const zones = modal.pills.map((pill) => pill.price);
    for (const entry of candidates) {
      const pre = precheckCustomEntry(entry, modal.custom.entry, zones);
      const real = codes(0, { ...BASE, entry, zoneId: undefined });
      expect(pre === null ? [] : [pre]).toEqual(real);
    }
  });

  test('a custom entry when a bound is not known', () => {
    const noPrice = modalOf({}, { livePrice: null });
    const noRange = modalOf(
      {},
      { range: { ok: false, code: 'NO_BARS', detail: 'no bars' } as never }
    );
    for (const world of [noPrice, noRange]) {
      const zones = world.modal.pills.map((pill) => pill.price);
      for (const entry of ['4370', '4367.2', 'x']) {
        const pre = precheckCustomEntry(entry, world.modal.custom.entry, zones);
        const real = validateSetup(world.ctx, {
          ...BASE,
          entry,
          zoneId: undefined,
        }).checks[0]!.codes;
        expect(pre === null ? [] : [pre]).toEqual(real);
      }
    }
  });
});

describe('the stop the modal opens on', () => {
  test('is the zone’s own stored invalidation, for every zone of every stored golden cycle', () => {
    let checked = 0;
    for (const g of loadGoldens()) {
      for (const gProfile of ['DAY_TRADER', 'SCALPER']) {
        if (!g.readings.some((r) => r.profile === gProfile)) continue;
        const zones = zonesOf(g, gProfile);
        if (zones.length === 0) continue;
        const s = setup({ golden: g.id.slice(0, 3), gProfile });
        const modal = toWire<WireOfferedModal>(
          buildModalDefinition({
            profile: s.ctx.profile,
            offer: s.ctx.offer,
            zones: s.ctx.zones,
            structure: s.ctx.structure,
            range: s.ctx.range,
            livePrice: s.ctx.livePrice,
          })
        );
        if (modal.status === ('NOT_OFFERED' as string)) continue;
        for (const pill of modal.pills) {
          const zone = zones.find(
            (candidate) => candidate.zoneId === pill.zoneId
          )!;
          const start = initialStop(pill.stop);
          const distance = stopDistanceFor(
            start.selection,
            pill.stop,
            start.custom
          );
          const stored = zone.invalidationPrice.sub(zone.referencePrice).abs();
          expect(readWire(distance).eq(stored)).toBe(true);
          checked += 1;
        }
      }
    }
    // the 31 stored zones are all covered, on whichever profile the cycle offers
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  test('a zone with no structure behind its invalidation opens on the minimum stop, not a structural level', () => {
    let minimum = 0;
    for (const g of loadGoldens()) {
      const zones = zonesOf(g);
      const s = setup({ golden: g.id.slice(0, 3) });
      const modal = toWire<WireOfferedModal>(
        buildModalDefinition({
          profile: s.ctx.profile,
          offer: s.ctx.offer,
          zones: s.ctx.zones,
          structure: s.ctx.structure,
          range: s.ctx.range,
          livePrice: s.ctx.livePrice,
        })
      );
      if (modal.status === ('NOT_OFFERED' as string)) continue;
      for (const pill of modal.pills) {
        const zone = zones.find(
          (candidate) => candidate.zoneId === pill.zoneId
        )!;
        if (zone.invalidationBasis === 'LEVEL') continue;
        expect(initialStop(pill.stop).selection).toEqual({ kind: 'MINIMUM' });
        minimum += 1;
      }
    }
    expect(minimum).toBeGreaterThan(0);
  });

  test('stopDistanceFor: an option is its distance, the minimum is its distance, a custom stop is what was typed', () => {
    const { modal } = modalOf();
    const pill = modal.pills[0]!;
    const option = pill.stop.structural[1]!;
    expect(
      stopDistanceFor(
        { kind: 'OPTION', stopPrice: option.stopPrice },
        pill.stop,
        'typed'
      )
    ).toBe(option.stopDistance);
    expect(stopDistanceFor({ kind: 'CUSTOM' }, pill.stop, '21.5')).toBe('21.5');
    // an entry of one's own has no options: only what was typed
    expect(stopDistanceFor({ kind: 'CUSTOM' }, null, '18')).toBe('18');
    expect(
      stopDistanceFor({ kind: 'OPTION', stopPrice: '1' }, null, '18')
    ).toBe('18');
    // a price that is not one of the options falls back to what was typed
    expect(
      stopDistanceFor({ kind: 'OPTION', stopPrice: '1' }, pill.stop, 'x')
    ).toBe('x');
    expect(stopDistanceFor({ kind: 'MINIMUM' }, pill.stop, 'x')).toBe('x');
  });

  test('sameStopSelection compares a structural option by its stop price', () => {
    expect(sameStopSelection({ kind: 'CUSTOM' }, { kind: 'CUSTOM' })).toBe(
      true
    );
    expect(sameStopSelection({ kind: 'MINIMUM' }, { kind: 'MINIMUM' })).toBe(
      true
    );
    expect(sameStopSelection({ kind: 'MINIMUM' }, { kind: 'CUSTOM' })).toBe(
      false
    );
    expect(
      sameStopSelection(
        { kind: 'OPTION', stopPrice: '1' },
        { kind: 'OPTION', stopPrice: '1' }
      )
    ).toBe(true);
    expect(
      sameStopSelection(
        { kind: 'OPTION', stopPrice: '1' },
        { kind: 'OPTION', stopPrice: '2' }
      )
    ).toBe(false);
  });
});

describe('a stop judged against an entry that is not a number', () => {
  test('gives no stop-price verdict and does not throw: check 0 is the one that speaks', () => {
    for (const entry of ['abc', '', '1,5', '--1']) {
      expect(precheckStop('16.78', '13', { side: 'BUY', entry })).toBeNull();
    }
    expect(precheckStop('16.78', '13', { side: 'BUY', entry: '10' })).toBe(
      'STOP_PRICE_NOT_POSITIVE'
    );
  });
});

describe('the range as it is shown', () => {
  test('is rounded inward, so every edge shown is itself a valid entry (the 18 Sep range ends in half a cent)', () => {
    const { modal } = modalOf();
    const exact = allowedEntryRange(modal.custom.entry)!;
    // the exact edges are half-cents: 4282.525 and 4427.425
    expect(exact.low).toBe('4282.525');
    expect(exact.high).toBe('4427.425');
    const shown = shownEntryRange(modal.custom.entry)!;
    expect(shown).toEqual({ low: '4282.53', high: '4427.42' });
    const zones = modal.pills.map((pill) => pill.price);
    expect(
      precheckCustomEntry(shown.low, modal.custom.entry, zones)
    ).toBeNull();
    expect(
      precheckCustomEntry(shown.high, modal.custom.entry, zones)
    ).toBeNull();
    // and rounding to the nearest cent would have printed an edge that is refused
    expect(precheckCustomEntry('4427.43', modal.custom.entry, zones)).toBe(
      'ENTRY_OUTSIDE_DAY_RANGE'
    );
  });

  test('for any bounds, both shown edges are valid and lie inside the exact range', () => {
    const base = modalOf().modal.custom.entry;
    for (const [lower, upper] of [
      ['100.001', '200.009'],
      ['100.005', '200.005'],
      ['100', '200'],
      ['99.999', '100.001'],
      ['1/3', '10/3'],
    ]) {
      const bounds = {
        day: { lower: lower as string, upper: upper as string },
        typo: { lower: '0', upper: '1000000' },
      };
      const shown = shownEntryRange(bounds);
      if (shown === null) continue;
      expect(precheckCustomEntry(shown.low, bounds, [])).toBeNull();
      expect(precheckCustomEntry(shown.high, bounds, [])).toBeNull();
      expect(readWire(shown.low).gte(readWire(lower as string))).toBe(true);
      expect(readWire(shown.high).lte(readWire(upper as string))).toBe(true);
    }
    expect(base.day).not.toBeNull();
  });

  test('is null when the bounds leave no whole-cent price (or a bound is unknown)', () => {
    const bounds = {
      day: { lower: '100.001', upper: '100.009' },
      typo: { lower: '0', upper: '1000' },
    };
    expect(shownEntryRange(bounds)).toBeNull();
    expect(shownEntryRange({ day: null, typo: bounds.typo })).toBeNull();
  });
});
