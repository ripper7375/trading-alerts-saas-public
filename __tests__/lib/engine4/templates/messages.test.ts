/**
 * @jest-environment node
 */

/**
 * From codes to words (build step 5, part 7). Engine 4 gives a CODE for every
 * refusal, notice and reason; the words are keys of the text registry. The tests run
 * the real validator and offer check over a wide sweep of bad inputs and bad
 * contexts, collect every code that comes out, and require that each one has a
 * specific message: a code the table does not know would fall back to a general
 * sentence, which hides what is wrong from the trader.
 */

import {
  ENTRY_TYPO_FRACTION,
  NOT_OFFERED_ROW,
  validateSetup,
  type SetupFields,
  type ValidatedSetup,
} from '@/lib/engine4';
import { ERROR_STATUS } from '@/lib/engine4/server/errors';
import {
  describeApiError,
  describeCheckCode,
  describeNotOffered,
  describeNotice,
} from '@/lib/engine4/templates/messages';
import { REPORT2_KEYS } from '@/lib/engine4/templates/text';

import { setup, type SetupOptions } from '../helpers/setup';

const GENERIC = 'report2.err.generic';
const known = new Set<string>(REPORT2_KEYS);

const BASE: SetupFields = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

/** every code a check reports, over a sweep of what a trader can type and of what the world can be */
function sweep(): Set<string> {
  const codes = new Set<string>();
  const collect = (v: ValidatedSetup): void => {
    for (const check of v.checks)
      for (const code of check.codes) codes.add(code);
  };
  const run = (options: SetupOptions, fields: SetupFields): void =>
    collect(validateSetup(setup(options).ctx, fields));

  // what the trader types, on the 18 Sep cycle (a counter-trend rally)
  for (const entry of [
    '',
    'abc',
    '0',
    '-1',
    '4000',
    '9999',
    '4282.52',
    '4427.43',
    '1e999',
  ]) {
    run({}, { ...BASE, entry, zoneId: undefined });
  }
  run({}, { ...BASE, entry: undefined, zoneId: 'Z9' });
  run({}, { ...BASE, entry: undefined, zoneId: undefined });
  for (const equity of ['', 'x', '0', '-5']) run({}, { ...BASE, equity });
  for (const riskPct of ['', 'x', '0', '-1', '2', '99'])
    run({}, { ...BASE, riskPct });
  for (const stopDistance of ['', 'x', '0', '-3', '5', '12.99', '99999']) {
    run({}, { ...BASE, stopDistance });
  }
  for (const rrr of ['', 'x', '1', '1.49', '2.51', '4'])
    run({}, { ...BASE, rrr });
  run({ gProfile: 'DAY_TRADER' }, { ...BASE, side: 'SELL' });
  run({}, { ...BASE, side: 'sideways' });
  // a with-trend cycle: the cap is the ordinary 3.50
  run(
    { golden: '04-' },
    {
      zoneId: 'Z1',
      equity: '10000',
      riskPct: '1',
      stopDistance: '30.5',
      rrr: '4',
    }
  );

  // what the world can be
  run({ list: null }, BASE);
  run({ list: { schemaVersion: 1, listVersion: 1, events: [] } }, BASE);
  run({ calendarAge: null }, BASE);
  run({ dataStatus: { status: 'STALE', dataAsOfSlot: 1 } }, BASE);
  run({ dataStatus: { status: 'MARKET_CLOSED', dataAsOfSlot: 1 } }, BASE);
  run({ dataStatus: null }, BASE);
  run({ price: 4349 }, BASE);
  run({ price: null }, BASE);
  run({ specs: null }, BASE);
  run({ specsAge: 8 * 86400 }, BASE);
  run({ pinned: { bias: 'NEUTRAL' } }, BASE);
  run({ pinned: { bias: 'STAND_ASIDE' } }, BASE);
  run({ pinned: { bias: 'LONG', status: 'INVALID' } }, BASE);
  run({}, { ...BASE, equity: '300', riskPct: '0.5' });
  run({ zones: [] }, BASE);
  run(
    { range: { ok: false, code: 'NO_BARS', detail: 'no bars' } as never },
    { ...BASE, entry: '4370', zoneId: undefined }
  );
  return codes;
}

describe('the codes of the eight checks', () => {
  const codes = sweep();

  test('the sweep reaches a good many of them', () => {
    expect(codes.size).toBeGreaterThan(20);
  });

  test.each([...sweep()].sort())('%s has its own message', (code) => {
    const described = describeCheckCode(code, {
      riskMax: '1.5',
      stopMin: '13',
      rrrMin: '1.5',
      rrrMax: '2.5',
    });
    expect(described.key).not.toBe(GENERIC);
    expect(known.has(described.key)).toBe(true);
  });

  test.each([
    'ENTRY_MISSING',
    'ENTRY_ZONE_UNKNOWN',
    'ENTRY_NOT_A_NUMBER',
    'ENTRY_NOT_POSITIVE',
    'ENTRY_OUTSIDE_DAY_RANGE',
    'ENTRY_TYPO',
    'LIVE_PRICE_UNKNOWN',
    'DAY_RANGE_UNKNOWN',
    'EQUITY_MISSING',
    'EQUITY_NOT_A_NUMBER',
    'EQUITY_NOT_POSITIVE',
    'RISK_MISSING',
    'RISK_NOT_A_NUMBER',
    'RISK_NOT_POSITIVE',
    'RISK_ABOVE_MAX_RPT',
    'STOP_MISSING',
    'STOP_NOT_A_NUMBER',
    'STOP_NOT_POSITIVE',
    'STOP_BELOW_MIN_SLD',
    'STOP_PRICE_NOT_POSITIVE',
    'RRR_MISSING',
    'RRR_NOT_A_NUMBER',
    'RRR_BELOW_MIN',
    'RRR_ABOVE_MAX',
    'RRR_ABOVE_COUNTER_TREND_CAP',
    'LEVERAGE_ABOVE_MAX',
    'TIER1_BLACKOUT',
    'LIST_NOT_SET',
    'LIST_INVALID',
    'LIST_INCOMPLETE',
    'CALENDAR_UNAVAILABLE',
    'CALENDAR_EMPTY',
    'EVENT_UNREADABLE',
    'SETUP_CHANGED',
    'ZONE_NOT_CHECKED',
    'PAST_INVALIDATION',
    'SIDE_NOT_RECOGNISED',
    'DIRECTION_MISMATCH',
    'NO_BROKER_FIGURES',
    'SIZING_REFUSED',
    'LOT_BELOW_BROKER_MINIMUM',
  ])(
    '%s, written down in the source, is mapped (even one the sweep cannot reach)',
    (code) => {
      expect(describeCheckCode(code).key).not.toBe(GENERIC);
    }
  );

  test('every reason of the offer check that a check repeats (rows 6, 7 and 9) has a message', () => {
    for (const [code, row] of Object.entries(NOT_OFFERED_ROW)) {
      if (row === 6 || row === 7 || row === 9) {
        expect(describeCheckCode(code).key).not.toBe(GENERIC);
      }
    }
  });

  test('a code nobody listed gets the general sentence, never a raw token', () => {
    const described = describeCheckCode('SOME_NEW_CODE');
    expect(described.key).toBe(GENERIC);
    expect(described.params).toEqual({});
  });

  test('a prototype name is not a code', () => {
    expect(describeCheckCode('constructor').key).toBe(GENERIC);
    expect(describeCheckCode('toString').key).toBe(GENERIC);
  });

  test('a message that quotes a limit carries the limit as a typed figure', () => {
    const limits = {
      riskMax: '1.5',
      stopMin: '13',
      rrrMin: '1.5',
      rrrMax: '2.5',
    };
    expect(describeCheckCode('RISK_ABOVE_MAX_RPT', limits).params).toEqual({
      max: { kind: 'percent', text: '1.5' },
    });
    expect(describeCheckCode('STOP_BELOW_MIN_SLD', limits).params).toEqual({
      min: { kind: 'price', text: '13' },
    });
    expect(describeCheckCode('RRR_BELOW_MIN', limits).params).toEqual({
      min: { kind: 'ratio', text: '1.5' },
      max: { kind: 'ratio', text: '2.5' },
    });
    expect(
      describeCheckCode('RRR_ABOVE_COUNTER_TREND_CAP', limits).params
    ).toEqual({
      max: { kind: 'ratio', text: '2.5' },
    });
  });

  test('without the limit the message still comes, with the gap left for the text to show', () => {
    expect(describeCheckCode('RISK_ABOVE_MAX_RPT').params).toEqual({});
    expect(describeCheckCode('RRR_ABOVE_MAX').params).toEqual({});
  });
});

describe('the reasons a setup is not offered', () => {
  const facts = {
    dataAsOfSlot: '1789764900',
    block: { name: 'US CPI', time: '1789765800', end: '1789766700' },
  };

  test.each(Object.keys(NOT_OFFERED_ROW))(
    '%s has a "not offered" sentence',
    (code) => {
      const described = describeNotOffered(code, facts);
      expect(known.has(described.key)).toBe(true);
      expect(described.key).toMatch(/^report2\.(not_offered|err)\./);
    }
  );

  test('the calendar and the broker figures each group under one sentence', () => {
    const calendar = Object.keys(NOT_OFFERED_ROW).filter((c) =>
      c.startsWith('CALENDAR_')
    );
    const specs = Object.keys(NOT_OFFERED_ROW).filter((c) =>
      c.startsWith('SPECS_')
    );
    expect(calendar.length).toBeGreaterThan(3);
    expect(
      new Set(calendar.map((c) => describeNotOffered(c, facts).key))
    ).toEqual(new Set(['report2.not_offered.calendar']));
    expect(specs.length).toBeGreaterThan(3);
    expect(new Set(specs.map((c) => describeNotOffered(c, facts).key))).toEqual(
      new Set(['report2.not_offered.specs'])
    );
  });

  test('names the release and when its window ends', () => {
    const described = describeNotOffered('TIER1_BLACKOUT', facts);
    expect(described.key).toBe('report2.not_offered.blackout');
    expect(described.params).toEqual({
      name: { kind: 'raw', text: 'US CPI' },
      time: { kind: 'time', text: '1789765800' },
      end: { kind: 'time', text: '1789766700' },
    });
  });

  test('says "the data stopped at hh:mm" only when the time is known', () => {
    expect(describeNotOffered('DATA_STALE', facts).key).toBe(
      'report2.not_offered.data_stale'
    );
    expect(
      describeNotOffered('DATA_STALE', { dataAsOfSlot: null, block: null }).key
    ).toBe('report2.not_offered.data_unknown');
    expect(
      describeNotOffered('TIER1_BLACKOUT', { dataAsOfSlot: null, block: null })
        .key
    ).toBe('report2.err.blackout');
  });

  test('a code nobody listed is "cannot be used", not a crash', () => {
    expect(describeNotOffered('SOMETHING_NEW', facts).key).toBe(
      'report2.not_offered.unusable'
    );
  });
});

describe('the notices of an offered setup', () => {
  const facts = {
    dataAsOfSlot: '1789764900',
    newSlot: '1789765200',
    cap: '2.5',
  };

  test.each([
    ['DATA_DELAYED', 'report2.notice.data_delayed'],
    ['CAUTIONARY', 'report2.notice.cautionary'],
    ['RETUNING', 'report2.notice.retuning'],
    ['STYLE_COUNTER_TREND', 'report2.notice.style_counter_trend'],
    ['STYLE_WITH_TREND', 'report2.notice.style_with_trend'],
    ['NEWER_CYCLE_CHANGED', 'report2.notice.newer_cycle'],
  ])('%s says %s', (code, key) => {
    expect(describeNotice(code, facts)?.key).toBe(key);
  });

  test('the delay without a time says only that the feed is delayed', () => {
    expect(
      describeNotice('DATA_DELAYED', { ...facts, dataAsOfSlot: null })?.key
    ).toBe('report2.notice.data_delayed_plain');
  });

  test('"the picture changed" needs the new slot; without it there is nothing to say', () => {
    expect(
      describeNotice('NEWER_CYCLE_CHANGED', { ...facts, newSlot: null })
    ).toBeNull();
  });

  test('the style notice quotes the cap', () => {
    expect(describeNotice('STYLE_COUNTER_TREND', facts)?.params).toEqual({
      cap: { kind: 'ratio', text: '2.5' },
    });
  });

  test('a notice nobody listed is not shown', () => {
    expect(describeNotice('SOMETHING_NEW', facts)).toBeNull();
  });
});

describe('what a route says when it refuses', () => {
  test.each(Object.keys(ERROR_STATUS))(
    '%s has words of its own or the general sentence',
    (code) => {
      const described = describeApiError(code);
      expect(known.has(described.key)).toBe(true);
      expect(described.key).toMatch(/^report2\.(api|consent)\./);
    }
  );

  test('the codes a trader can act on say so', () => {
    expect(describeApiError('UNAUTHENTICATED').key).toBe(
      'report2.api.unauthenticated'
    );
    expect(describeApiError('TIER_REQUIRED').key).toBe('report2.api.tier');
    expect(describeApiError('PROFILE_NOT_SET').key).toBe('report2.api.profile');
    expect(describeApiError('SETUP_CHANGED').key).toBe(
      'report2.consent.setup_changed'
    );
    expect(describeApiError('SUBMISSION_IN_FLIGHT').key).toBe(
      'report2.api.in_flight'
    );
    expect(describeApiError('NETWORK').key).toBe('report2.api.network');
  });

  test('the route layer is told nothing about itself: an internal failure is the general sentence', () => {
    expect(describeApiError('INTERNAL').key).toBe('report2.api.generic');
    expect(describeApiError('AUDIT_NOT_CONFIGURED').key).toBe(
      'report2.api.unavailable'
    );
    expect(describeApiError('whatever').key).toBe('report2.api.generic');
  });
});

describe('a figure in a sentence is the engine’s, not a number written into 19 texts', () => {
  test('the typo filter’s percentage comes from the engine’s own constant', () => {
    const described = describeCheckCode('ENTRY_TYPO');
    expect(described.key).toBe('report2.err.entry_typo');
    expect(described.params).toEqual({
      limit: { kind: 'percent_free', text: '5' },
    });
    // the same constant the check itself uses (ADR-034)
    expect(ENTRY_TYPO_FRACTION).toBe('0.05');
  });
});
