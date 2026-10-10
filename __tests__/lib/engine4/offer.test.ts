/**
 * @jest-environment node
 */

/**
 * The offer check (build step 5, part 3; architecture 6.4, ADR-058, ADR-059).
 *
 * The nine rows of the 6.4 table, one by one; then the checks that fail closed
 * beyond the table; then which "not offered" reason is shown when several apply
 * (plan assumption A1), over every combination.
 *
 * Real stored data where it exists: the 18 Sep cycle (a LONG counter-trend
 * rally, CAUTIONARY, two zones), the 28 Sep 23:15 downtrend (SHORT, two zones)
 * and the 28 Sep 14:15 snapback (LONG, no zones) of the signed-off golden
 * scenarios. The Tier-1 ids are TEST IDS (9000000xx), not MT5 event ids.
 */

import {
  NOT_OFFERED_ROW,
  checkBlackout,
  checkOffer,
  parseLiveDataStatus,
  readBrokerFigures,
  zoneFromStored,
} from '@/lib/engine4';
import type {
  BlackoutResult,
  BrokerResult,
  NotOfferedCode,
  OfferInput,
  OfferSynthesis,
  Tier1List,
  ZoneInput,
} from '@/lib/engine4';

import { loadGoldens, slotSeconds } from './helpers/stored';

const MIN = 60;
const HOUR = 3600;

// -- stored data -----------------------------------------------------------------------

const goldens = loadGoldens();
const golden = (prefix: string) => {
  const found = goldens.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden scenario ${prefix}`);
  return found;
};

function readingOf(prefix: string, profile = 'DAY_TRADER') {
  const found = golden(prefix).readings.find((r) => r.profile === profile);
  if (found === undefined) throw new Error(`no ${profile} reading`);
  return found;
}

function synthesisOf(
  reading: Record<string, unknown>,
  retuning = false
): OfferSynthesis {
  return {
    cycleSlot: slotSeconds(String(reading['cycle_slot'])),
    bias: String(reading['bias']),
    status: String(reading['status']),
    statusReasons: reading['status_reasons'] as string[],
    trendRelation: (reading['trend_relation'] as string | null) ?? null,
    ruleId: String(reading['rule_id']),
    branchId: (reading['branch_id'] as string | null) ?? null,
    retuning,
  };
}

function zonesOf(prefix: string): ZoneInput[] {
  return readingOf(prefix).zones.map((raw) => {
    const zone = zoneFromStored(raw);
    if (zone === null) throw new Error('a golden zone did not read');
    return zone;
  });
}

const SEP18 = readingOf('01-');
const SEP18_SLOT = slotSeconds('2026-09-18T20:55Z');
const SEP18_ZONES = zonesOf('01-'); // LONG: Z1 4367.20 / 4350.42, Z2 4350.16 / 4334.06
const SEP18_PRICE = 4378.31;
const SEP28_ZONES = zonesOf('03-'); // SHORT: Z1 4170.13 / 4214.50, Z2 4249.14 / 4266.25
const SEP28_SLOT = slotSeconds('2026-09-28T23:15Z');

// -- the rest of the input ---------------------------------------------------------------

const NOW = SEP18_SLOT + 150;

const TEST_LIST: Tier1List = {
  schemaVersion: 1,
  listVersion: 4,
  events: [
    { eventId: '900000001', kind: 'CPI', name: 'TEST US CPI' },
    { eventId: '900000002', kind: 'CORE_PCE', name: 'TEST US Core PCE' },
    { eventId: '900000003', kind: 'FOMC_RATE_DECISION', name: 'TEST FOMC' },
    { eventId: '900000004', kind: 'NFP', name: 'TEST NFP' },
  ],
};

function blackout(
  over: Partial<Parameters<typeof checkBlackout>[0]> = {}
): BlackoutResult {
  return checkBlackout({
    nowSeconds: NOW,
    traderType: 'DAY_TRADER',
    list: TEST_LIST,
    events: [],
    newestCapturedAt: NOW - 10 * MIN,
    ...over,
  });
}

const SPECS_ROW = {
  symbol: 'XAUUSD',
  version: 3,
  captured_at: NOW - 86_400,
  contract_size: 100,
  volume_min: 0.01,
  volume_step: 0.01,
  volume_max: 100,
  tick_size: 0.01,
  typical_spread: 25,
  swap_long: -66.5,
  swap_short: 34.2,
  point: 0.01,
  digits: 2,
  swap_mode: 1,
};
const specs = (over: Record<string, unknown> = {}): BrokerResult =>
  readBrokerFigures({ ...SPECS_ROW, ...over }, NOW);

/** A LONG, VALID, with-trend reading: the plain row 1 case. */
const PLAIN: OfferSynthesis = {
  cycleSlot: SEP18_SLOT,
  bias: 'LONG',
  status: 'VALID',
  statusReasons: [],
  trendRelation: 'WITH_TREND',
  ruleId: 'TEST_RULE',
  branchId: 'TEST_BRANCH',
  retuning: false,
};

function input(over: Partial<OfferInput> = {}): OfferInput {
  return {
    nowSeconds: NOW,
    style: 'BOTH',
    pinned: PLAIN,
    newest: null,
    dataStatus: { status: 'FRESH', dataAsOfSlot: SEP18_SLOT },
    blackout: blackout(),
    specs: specs(),
    zones: SEP18_ZONES,
    price: SEP18_PRICE,
    ...over,
  };
}

const codes = (result: ReturnType<typeof checkOffer>) =>
  result.reasons.map((r) => r.code);
const noticeCodes = (result: ReturnType<typeof checkOffer>) =>
  result.notices.map((n) => n.code);

// -- the nine rows ------------------------------------------------------------------------

describe('row 1: synthesis LONG or SHORT, cycle FRESH', () => {
  test.each(['LONG', 'SHORT'])('%s is offered, with nothing to say', (bias) => {
    const zones = bias === 'LONG' ? SEP18_ZONES : SEP28_ZONES;
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, bias },
        zones,
        price: bias === 'LONG' ? SEP18_PRICE : 4125.32,
      })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(result.reason).toBeNull();
    expect(result.reasons).toEqual([]);
    expect(result.notices).toEqual([]);
    expect(result.halfRiskPreset).toBe(false);
    expect(result.halfRiskReasons).toEqual([]);
    expect(result.refresh).toBeNull();
  });

  test('echoes what the consent record needs', () => {
    const result = checkOffer(input());
    expect(result.pinnedSlot).toBe(BigInt(SEP18_SLOT));
    expect(result.dataAsOfSlot).toBe(BigInt(SEP18_SLOT));
    expect(result.specsVersion).toBe(3n);
    expect(result.tier1ListVersion).toBe(4);
    expect(result.zones).toEqual([
      { zoneId: 'Z1', invalidated: false },
      { zoneId: 'Z2', invalidated: false },
    ]);
  });
});

describe('the direction and the trend relation of the pinned synthesis', () => {
  test.each([
    ['LONG', 'WITH_TREND'],
    ['LONG', 'COUNTER_TREND'],
    ['SHORT', 'WITH_TREND'],
    ['SHORT', 'COUNTER_TREND'],
  ])('%s %s is handed on', (bias, trendRelation) => {
    const zones = bias === 'LONG' ? SEP18_ZONES : SEP28_ZONES;
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, bias, trendRelation },
        zones,
        price: bias === 'LONG' ? SEP18_PRICE : 4125.32,
      })
    );
    expect(result.direction).toBe(bias);
    expect(result.trendRelation).toBe(trendRelation);
  });

  test('is still known when a LATER row is what refuses the offer', () => {
    const result = checkOffer(
      input({ dataStatus: { status: 'STALE', dataAsOfSlot: SEP18_SLOT } })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.direction).toBe('LONG');
    expect(result.trendRelation).toBe('WITH_TREND');
  });

  test('is still known when a refresh is offered', () => {
    const result = checkOffer(
      input({
        newest: { ...PLAIN, cycleSlot: SEP18_SLOT + 300, bias: 'SHORT' },
      })
    );
    expect(result.verdict).toBe('REFRESH_OFFERED');
    expect(result.direction).toBe('LONG');
  });

  test.each([
    ['NEUTRAL', null],
    ['STAND_ASIDE', null],
  ])('%s gives no direction and no trend relation', (bias, trendRelation) => {
    const result = checkOffer(
      input({ pinned: { ...PLAIN, bias, trendRelation } })
    );
    expect(result.direction).toBeNull();
    expect(result.trendRelation).toBeNull();
  });

  test.each([
    ['a reading that is not there', null],
    ['a direction that is INVALID', { ...PLAIN, status: 'INVALID' }],
    ['a direction with no trend relation', { ...PLAIN, trendRelation: null }],
  ])('%s gives none either', (_label, pinned) => {
    const result = checkOffer(input({ pinned }));
    expect(result.direction).toBeNull();
    expect(result.trendRelation).toBeNull();
  });
});

describe('row 2: cycle DELAYED', () => {
  test('is offered, and says what the data is as of', () => {
    const result = checkOffer(
      input({ dataStatus: { status: 'DELAYED', dataAsOfSlot: SEP18_SLOT } })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(result.notices).toEqual([
      { code: 'DATA_DELAYED', detail: 'data as of 20:55 UTC' },
    ]);
    expect(result.halfRiskPreset).toBe(false);
  });

  test('without a time it still says the data is delayed', () => {
    const result = checkOffer(
      input({ dataStatus: { status: 'DELAYED', dataAsOfSlot: null } })
    );
    expect(result.notices).toEqual([
      { code: 'DATA_DELAYED', detail: 'the data is delayed' },
    ]);
  });
});

describe('row 3: sensors CAUTIONARY, or the cycle RETUNING', () => {
  test('CAUTIONARY is offered with half the risk pre-set, and the reasons', () => {
    const result = checkOffer(
      input({
        pinned: {
          ...PLAIN,
          status: 'CAUTIONARY',
          statusReasons: ['MCD0_DEFECT_M5', 'MCD0_DEFECT_M15'],
        },
      })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(result.halfRiskPreset).toBe(true);
    expect(result.halfRiskReasons).toEqual([
      'MCD0_DEFECT_M5',
      'MCD0_DEFECT_M15',
    ]);
    expect(noticeCodes(result)).toEqual(['CAUTIONARY']);
    expect(result.notices[0]?.detail).toContain(
      'MCD0_DEFECT_M5, MCD0_DEFECT_M15'
    );
    expect(result.notices[0]?.detail).toContain('the trader may override');
  });

  test('RETUNING is offered with half the risk pre-set', () => {
    const result = checkOffer(input({ pinned: { ...PLAIN, retuning: true } }));
    expect(result.verdict).toBe('OFFERED');
    expect(result.halfRiskPreset).toBe(true);
    expect(result.halfRiskReasons).toEqual(['RETUNING']);
    expect(noticeCodes(result)).toEqual(['RETUNING']);
  });

  test('both: both reasons, one half', () => {
    const result = checkOffer(
      input({
        pinned: {
          ...PLAIN,
          status: 'CAUTIONARY',
          statusReasons: ['MCD0_DEFECT_M5'],
          retuning: true,
        },
      })
    );
    expect(result.halfRiskPreset).toBe(true);
    expect(result.halfRiskReasons).toEqual(['MCD0_DEFECT_M5', 'RETUNING']);
    expect(noticeCodes(result)).toEqual(['CAUTIONARY', 'RETUNING']);
  });

  test('a CAUTIONARY reading with no reasons still halves the risk', () => {
    const result = checkOffer(
      input({ pinned: { ...PLAIN, status: 'CAUTIONARY', statusReasons: [] } })
    );
    expect(result.halfRiskPreset).toBe(true);
    expect(result.halfRiskReasons).toEqual([]);
  });

  test('VALID is not cautionary', () => {
    expect(checkOffer(input()).halfRiskPreset).toBe(false);
  });

  test('the stored 18 Sep cycle: CAUTIONARY from the MCD0 defect, counter-trend', () => {
    const result = checkOffer(
      input({
        style: 'TREND_FOLLOWING',
        pinned: synthesisOf(SEP18.reading),
      })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(result.halfRiskPreset).toBe(true);
    expect(result.halfRiskReasons).toEqual([
      'MCD0_DEFECT_M15',
      'MCD0_DEFECT_M5',
    ]);
    // the architecture's own example: a default profile also sees the counter-trend notice
    expect(noticeCodes(result)).toEqual(['CAUTIONARY', 'STYLE_COUNTER_TREND']);
  });
});

describe('row 4: a setup outside the trader style', () => {
  test.each([
    ['TREND_FOLLOWING', 'COUNTER_TREND', 'STYLE_COUNTER_TREND'],
    ['TREND_COUNTERING', 'WITH_TREND', 'STYLE_WITH_TREND'],
  ])('%s with a %s setup: %s', (style, relation, code) => {
    const result = checkOffer(
      input({
        style: style as OfferInput['style'],
        pinned: { ...PLAIN, trendRelation: relation },
      })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(noticeCodes(result)).toEqual([code]);
    expect(result.halfRiskPreset).toBe(false);
  });

  test('the counter-trend notice reads as the table says', () => {
    const result = checkOffer(
      input({
        style: 'TREND_FOLLOWING',
        pinned: { ...PLAIN, trendRelation: 'COUNTER_TREND' },
      })
    );
    expect(result.notices[0]?.detail).toBe(
      'Counter-trend setup; your style is trend following'
    );
  });

  test.each([
    ['TREND_FOLLOWING', 'WITH_TREND'],
    ['TREND_COUNTERING', 'COUNTER_TREND'],
    ['BOTH', 'WITH_TREND'],
    ['BOTH', 'COUNTER_TREND'],
  ])('%s with a %s setup is inside the style', (style, relation) => {
    const result = checkOffer(
      input({
        style: style as OfferInput['style'],
        pinned: { ...PLAIN, trendRelation: relation },
      })
    );
    expect(result.notices).toEqual([]);
  });
});

describe('row 5: a newer cycle changed the synthesis', () => {
  const newer = (over: Partial<OfferSynthesis>): OfferSynthesis => ({
    ...PLAIN,
    cycleSlot: SEP18_SLOT + 300,
    ...over,
  });

  test.each([
    ['the bias', { bias: 'SHORT' }, ['BIAS']],
    [
      'the trend relation',
      { trendRelation: 'COUNTER_TREND' },
      ['TREND_RELATION'],
    ],
    ['the rule', { ruleId: 'OTHER_RULE' }, ['RULE']],
    ['the branch', { branchId: 'OTHER_BRANCH' }, ['BRANCH']],
    ['the branch to none', { branchId: null }, ['BRANCH']],
    [
      'the status',
      { status: 'CAUTIONARY', statusReasons: ['MCD0_DEFECT_M5'] },
      ['STATUS'],
    ],
    [
      'several things',
      { bias: 'SHORT', ruleId: 'OTHER_RULE', status: 'CAUTIONARY' },
      ['BIAS', 'RULE', 'STATUS'],
    ],
  ])(
    'a newer reading that changed %s offers a refresh',
    (_label, over, changes) => {
      const result = checkOffer(input({ newest: newer(over) }));
      expect(result.verdict).toBe('REFRESH_OFFERED');
      expect(result.reason).toBeNull();
      expect(result.refresh).toEqual({
        newSlot: BigInt(SEP18_SLOT + 300),
        changes,
      });
      expect(noticeCodes(result)).toEqual(['NEWER_CYCLE_CHANGED']);
      expect(result.notices[0]?.detail).toBe(
        'The picture changed at 21:00 UTC'
      );
    }
  );

  test('a newer reading that changed nothing is no reason to refresh', () => {
    const result = checkOffer(input({ newest: newer({}) }));
    expect(result.verdict).toBe('OFFERED');
    expect(result.refresh).toBeNull();
  });

  test('a changed reason list alone is not a change of the synthesis', () => {
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, status: 'CAUTIONARY', statusReasons: ['A'] },
        newest: newer({ status: 'CAUTIONARY', statusReasons: ['B'] }),
      })
    );
    expect(result.verdict).toBe('OFFERED');
  });

  test('a reading from the same cycle, or an older one, is not newer', () => {
    for (const slot of [SEP18_SLOT, SEP18_SLOT - 300]) {
      const result = checkOffer(
        input({ newest: newer({ cycleSlot: slot, bias: 'SHORT' }) })
      );
      expect(result.verdict).toBe('OFFERED');
    }
  });

  test('a newer reading that cannot be read is not a refresh', () => {
    const result = checkOffer(input({ newest: newer({ bias: 'SIDEWAYS' }) }));
    expect(result.verdict).toBe('OFFERED');
  });

  test('keeps the notices of the pinned picture, and the half risk', () => {
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, status: 'CAUTIONARY', statusReasons: ['X'] },
        dataStatus: { status: 'DELAYED', dataAsOfSlot: SEP18_SLOT },
        newest: newer({ bias: 'SHORT' }),
      })
    );
    expect(result.verdict).toBe('REFRESH_OFFERED');
    expect(noticeCodes(result)).toEqual([
      'DATA_DELAYED',
      'CAUTIONARY',
      'NEWER_CYCLE_CHANGED',
    ]);
    expect(result.halfRiskPreset).toBe(true);
  });

  test('a refresh never hides a reason not to offer', () => {
    const result = checkOffer(
      input({
        dataStatus: { status: 'STALE', dataAsOfSlot: SEP18_SLOT },
        newest: newer({ bias: 'SHORT' }),
      })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.refresh).toBeNull();
  });
});

describe('row 6: synthesis NEUTRAL or STAND_ASIDE', () => {
  test.each([
    ['NEUTRAL', 'SYNTHESIS_NEUTRAL'],
    ['STAND_ASIDE', 'SYNTHESIS_STAND_ASIDE'],
  ])('%s is not offered: %s', (bias, code) => {
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, bias, trendRelation: null, ruleId: 'R9' },
      })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe(code);
    expect(result.reason?.row).toBe(6);
    expect(result.reason?.detail).toContain(bias);
    expect(result.reason?.detail).toContain('rule R9');
    expect(result.notices).toEqual([]);
    expect(result.halfRiskPreset).toBe(false);
  });

  test('the synthesis reason is the status reasons when there are some', () => {
    const result = checkOffer(
      input({
        pinned: {
          ...PLAIN,
          bias: 'STAND_ASIDE',
          trendRelation: null,
          status: 'STALE',
          statusReasons: ['UPSTREAM_STALE:MCD2'],
        },
      })
    );
    expect(result.reason?.detail).toContain('UPSTREAM_STALE:MCD2');
  });

  test('the stored 18 Sep SCALPER and DAY_TRADER readings both name a direction', () => {
    for (const profile of ['DAY_TRADER', 'SCALPER']) {
      const reading = readingOf('01-', profile).reading;
      expect(synthesisOf(reading).bias).toBe('LONG');
    }
  });

  // [what is wrong, the reading, whether it was readable enough to name its cycle]
  test.each<[string, OfferSynthesis | null, boolean]>([
    ['there is no reading', null, false],
    ['the bias is not one of the four', { ...PLAIN, bias: 'UP' }, false],
    ['the status is not one of the four', { ...PLAIN, status: 'GOOD' }, false],
    ['the cycle slot is not a time', { ...PLAIN, cycleSlot: 'friday' }, false],
    [
      'the trend relation is unknown',
      { ...PLAIN, trendRelation: 'SIDEWAYS' },
      false,
    ],
    [
      'a direction has no trend relation',
      { ...PLAIN, trendRelation: null },
      true,
    ],
    ['a direction is INVALID', { ...PLAIN, status: 'INVALID' }, true],
    ['a direction is STALE', { ...PLAIN, status: 'STALE' }, true],
  ])('is unusable when %s (fails closed)', (_label, pinned, named) => {
    const result = checkOffer(input({ pinned }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('SYNTHESIS_UNUSABLE');
    expect(result.reason?.row).toBe(6);
    expect(result.pinnedSlot).toBe(named ? BigInt(SEP18_SLOT) : null);
  });
});

describe('row 7: cycle STALE or MARKET CLOSED', () => {
  test('STALE: "data stopped at hh:mm"', () => {
    const result = checkOffer(
      input({ dataStatus: { status: 'STALE', dataAsOfSlot: SEP18_SLOT - 900 } })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason).toEqual({
      code: 'DATA_STALE',
      row: 7,
      detail: 'data stopped at 20:40 UTC',
    });
  });

  test('STALE with no ready cycle at all', () => {
    const result = checkOffer(
      input({ dataStatus: { status: 'STALE', dataAsOfSlot: null } })
    );
    expect(result.reason?.detail).toBe('data stopped at no ready cycle');
    expect(result.dataAsOfSlot).toBeNull();
  });

  test('MARKET_CLOSED: "market closed", with the last picture', () => {
    const result = checkOffer(
      input({
        dataStatus: { status: 'MARKET_CLOSED', dataAsOfSlot: SEP18_SLOT },
      })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('MARKET_CLOSED');
    expect(result.reason?.row).toBe(7);
    expect(result.reason?.detail).toContain('market is closed');
    expect(result.reason?.detail).toContain('20:55 UTC');
  });

  test.each([
    ['was not obtained', null],
    ['is not one of the four', { status: 'OK', dataAsOfSlot: SEP18_SLOT }],
    ['is in lower case', { status: 'fresh', dataAsOfSlot: SEP18_SLOT }],
    ['has no readable time', { status: 'FRESH', dataAsOfSlot: 'twenty fifty' }],
  ])('a live data status that %s is not an offer', (_label, dataStatus) => {
    const result = checkOffer(input({ dataStatus }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(codes(result)).toContain('DATA_STATUS_UNKNOWN');
    expect(result.reason?.row).toBe(7);
  });
});

describe('row 8: a Tier-1 release within the window', () => {
  const release = (offset: number, over = {}) => ({
    valueId: 'v1',
    eventId: '900000001',
    eventName: 'TEST US CPI',
    eventTime: NOW + offset,
    currency: 'USD',
    importance: 'HIGH',
    timeMode: 0,
    capturedAt: NOW - HOUR,
    ...over,
  });

  test('is not offered; names the release and when the window ends', () => {
    const result = checkOffer(
      input({ blackout: blackout({ events: [release(10 * MIN)] }) })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('TIER1_BLACKOUT');
    expect(result.reason?.row).toBe(8);
    const at = (seconds: number) =>
      new Date(seconds * 1000).toISOString().slice(11, 16);
    expect(result.reason?.detail).toBe(
      `TEST US CPI at ${at(NOW + 10 * MIN)} UTC; the window ends ${at(NOW + 25 * MIN)} UTC`
    );
  });

  test('lists every release that blocks', () => {
    const result = checkOffer(
      input({
        blackout: blackout({
          events: [
            release(5 * MIN, { valueId: 'a' }),
            release(8 * MIN, {
              valueId: 'b',
              eventId: '900000004',
              eventName: 'TEST NFP',
            }),
          ],
        }),
      })
    );
    expect(result.reason?.detail).toContain('TEST US CPI');
    expect(result.reason?.detail).toContain('TEST NFP');
  });

  test('a release outside the window is not a reason', () => {
    const result = checkOffer(
      input({ blackout: blackout({ events: [release(16 * MIN)] }) })
    );
    expect(result.verdict).toBe('OFFERED');
  });

  test('carries the Tier-1 list version into the result', () => {
    expect(
      checkOffer(input({ blackout: blackout({ events: [release(MIN)] }) }))
        .tier1ListVersion
    ).toBe(4);
  });

  test.each([
    [
      'LIST_NOT_SET',
      { list: { schemaVersion: 1 as const, listVersion: 1, events: [] } },
      'CALENDAR_LIST_NOT_SET',
      /not set/,
    ],
    [
      'LIST_INVALID',
      { list: null },
      'CALENDAR_LIST_INVALID',
      /could not be read/,
    ],
    [
      'LIST_INCOMPLETE',
      { list: { ...TEST_LIST, events: TEST_LIST.events.slice(0, 2) } },
      'CALENDAR_LIST_INCOMPLETE',
      /does not cover/,
    ],
    [
      'CALENDAR_UNAVAILABLE',
      { events: null },
      'CALENDAR_UNAVAILABLE',
      /calendar could not be read/,
    ],
    [
      'CALENDAR_EMPTY',
      { newestCapturedAt: null },
      'CALENDAR_EMPTY',
      /holds no release/,
    ],
    [
      'EVENT_UNREADABLE',
      { events: [release(HOUR, { eventTime: 'soon' })] },
      'CALENDAR_UNREADABLE',
      /could not be read/,
    ],
  ])(
    'a blackout that cannot answer (%s) is not an offer',
    (_name, over, code, text) => {
      const result = checkOffer(input({ blackout: blackout(over) }));
      expect(result.verdict).toBe('NOT_OFFERED');
      expect(result.reason?.code).toBe(code);
      expect(result.reason?.row).toBe(8);
      expect(result.reason?.detail).toMatch(text);
    }
  );

  test('the shipped state: an empty list says "calendar list not set"', () => {
    const result = checkOffer(
      input({
        blackout: blackout({
          list: { schemaVersion: 1, listVersion: 1, events: [] },
        }),
      })
    );
    expect(result.reason?.code).toBe('CALENDAR_LIST_NOT_SET');
  });
});

describe('row 9: price already past the zone invalidation', () => {
  // 18 Sep, LONG: Z1 invalidation 4350.42, Z2 invalidation 4334.06
  test.each([
    ['Z1', 4350.43, 'OFFERED'],
    ['Z1', 4350.42, 'NOT_OFFERED'],
    ['Z1', 4300, 'NOT_OFFERED'],
    ['Z2', 4350.43, 'OFFERED'],
    ['Z2', 4340, 'OFFERED'],
    ['Z2', 4334.07, 'OFFERED'],
    ['Z2', 4334.06, 'NOT_OFFERED'],
  ])('LONG, %s picked, price %p: %s', (zoneId, price, verdict) => {
    const result = checkOffer(input({ zoneId, price }));
    expect(result.verdict).toBe(verdict);
    if (verdict === 'NOT_OFFERED') {
      expect(result.reason?.code).toBe('PAST_INVALIDATION');
      expect(result.reason?.row).toBe(9);
      expect(result.reason?.detail).toContain(zoneId);
      expect(result.reason?.detail).toContain('no longer valid');
    }
  });

  // 28 Sep, SHORT: Z1 invalidation 4214.50, Z2 invalidation 4266.25
  test.each([
    ['Z1', 4214.49, 'OFFERED'],
    ['Z1', 4214.5, 'NOT_OFFERED'],
    ['Z1', 4300, 'NOT_OFFERED'],
    ['Z2', 4266.24, 'OFFERED'],
    ['Z2', 4266.25, 'NOT_OFFERED'],
  ])('SHORT, %s picked, price %p: %s', (zoneId, price, verdict) => {
    const result = checkOffer(
      input({
        pinned: synthesisOf(readingOf('03-').reading),
        zones: SEP28_ZONES,
        zoneId,
        price,
      })
    );
    expect(result.verdict).toBe(verdict);
  });

  test('before a zone is picked: offered while any zone is still valid, and says which are not', () => {
    // 4340: Z1 (4350.42) is past, Z2 (4334.06) is not
    const result = checkOffer(input({ price: 4340 }));
    expect(result.verdict).toBe('OFFERED');
    expect(result.zones).toEqual([
      { zoneId: 'Z1', invalidated: true },
      { zoneId: 'Z2', invalidated: false },
    ]);
  });

  test('before a zone is picked: not offered when every zone is past', () => {
    const result = checkOffer(input({ price: 4334.06 }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('PAST_INVALIDATION');
    expect(result.reason?.detail).toContain('every zone');
    expect(result.zones.every((z) => z.invalidated)).toBe(true);
  });

  test('a picked zone decides, whatever the others do', () => {
    const picked = checkOffer(input({ price: 4340, zoneId: 'Z1' }));
    expect(picked.verdict).toBe('NOT_OFFERED');
    const other = checkOffer(input({ price: 4340, zoneId: 'Z2' }));
    expect(other.verdict).toBe('OFFERED');
  });

  test('the stored 18 Sep cycle, at its own price, is valid for both zones', () => {
    const result = checkOffer(
      input({ pinned: synthesisOf(SEP18.reading), zoneId: 'Z1' })
    );
    expect(result.verdict).toBe('OFFERED');
  });

  test('a zone that is not one of this reading fails closed', () => {
    const result = checkOffer(input({ zoneId: 'Z9' }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('ZONE_UNKNOWN');
    expect(result.reason?.row).toBe(9);
  });

  test('a zone on the other side of the reading is not one of its zones', () => {
    const result = checkOffer(input({ zones: SEP28_ZONES }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('NO_ZONES');
    const picked = checkOffer(input({ zones: SEP28_ZONES, zoneId: 'Z1' }));
    expect(picked.reason?.code).toBe('NO_ZONES');
  });

  test('a direction with no zone at all (the stored 28 Sep 14:15 snapback)', () => {
    const reading = readingOf('02-');
    expect(reading.zones).toEqual([]);
    const result = checkOffer(
      input({ pinned: synthesisOf(reading.reading), zones: [], price: 4138.78 })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason).toEqual({
      code: 'NO_ZONES',
      row: 9,
      detail: 'the reading has no entry zone on its side',
    });
  });

  test.each([
    ['is not known', null],
    ['is not a number', 'high'],
    ['is zero', 0],
    ['is negative', -4350],
  ])('a newest price that %s fails closed', (_label, price) => {
    const result = checkOffer(input({ price }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('PRICE_UNKNOWN');
    expect(result.reason?.row).toBe(9);
  });

  test('the price and the zones are not looked at when there is no direction', () => {
    const result = checkOffer(
      input({
        pinned: { ...PLAIN, bias: 'NEUTRAL', trendRelation: null },
        zones: [],
        price: null,
      })
    );
    expect(codes(result)).toEqual(['SYNTHESIS_NEUTRAL']);
    expect(result.zones).toEqual([]);
  });
});

describe('the broker figures (6.9, 7.6): row 10, beyond the table', () => {
  test.each<[string, BrokerResult, NotOfferedCode]>([
    ['no row', readBrokerFigures(null, NOW), 'SPECS_MISSING'],
    [
      'a row older than 7 days',
      specs({ captured_at: NOW - 8 * 86_400 }),
      'SPECS_STALE',
    ],
    ['an unreadable row', specs({ contract_size: 0 }), 'SPECS_UNREADABLE'],
    [
      'a row from the future',
      specs({ captured_at: NOW + HOUR }),
      'SPECS_FROM_THE_FUTURE',
    ],
    [
      'a database error',
      {
        ok: false,
        code: 'DATABASE_ERROR',
        detail: 'the symbol_specs row could not be read: down',
        version: null,
        capturedAt: null,
        ageSeconds: null,
      },
      'SPECS_UNAVAILABLE',
    ],
  ])('%s is not offered: %s', (_label, brokerResult, code) => {
    const result = checkOffer(input({ specs: brokerResult }));
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe(code);
    expect(result.reason?.row).toBe(10);
  });

  test('stale specs return not offered, with the version that was too old', () => {
    const result = checkOffer(
      input({ specs: specs({ captured_at: NOW - 7 * 86_400 - 1 }) })
    );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('SPECS_STALE');
    expect(result.specsVersion).toBe(3n);
  });

  test('specs exactly 7 days old are still current', () => {
    const result = checkOffer(
      input({ specs: specs({ captured_at: NOW - 7 * 86_400 }) })
    );
    expect(result.verdict).toBe('OFFERED');
  });
});

describe('which "not offered" reason is shown when several apply (A1)', () => {
  // one breaker per row; each fails its row and, where it can, nothing else
  const breakers: [number, string, Partial<OfferInput>, NotOfferedCode][] = [
    [
      6,
      'synthesis',
      { pinned: { ...PLAIN, bias: 'NEUTRAL', trendRelation: null } },
      'SYNTHESIS_NEUTRAL',
    ],
    [
      7,
      'data',
      { dataStatus: { status: 'STALE', dataAsOfSlot: SEP18_SLOT } },
      'DATA_STALE',
    ],
    [
      8,
      'blackout',
      {
        blackout: blackout({
          events: [
            {
              valueId: 'v',
              eventId: '900000001',
              eventName: 'TEST US CPI',
              eventTime: NOW,
              currency: 'USD',
              importance: 'HIGH',
              timeMode: 0,
              capturedAt: NOW - HOUR,
            },
          ],
        }),
      },
      'TIER1_BLACKOUT',
    ],
    [9, 'price', { price: 4300 }, 'PAST_INVALIDATION'],
    [
      10,
      'specs',
      { specs: specs({ captured_at: NOW - 9 * 86_400 }) },
      'SPECS_STALE',
    ],
  ];

  const subsets: number[][] = [];
  for (let mask = 1; mask < 1 << breakers.length; mask += 1) {
    subsets.push(
      breakers.map((_b, i) => i).filter((i) => (mask >> i) % 2 === 1)
    );
  }

  test.each(
    subsets.map((s) => [s.map((i) => breakers[i]?.[1]).join(' + '), s] as const)
  )('every combination: %s', (_label, subset) => {
    let over: Partial<OfferInput> = {};
    for (const i of subset) over = { ...over, ...breakers[i]?.[2] };
    const result = checkOffer(input(over));

    // the price is not looked at when the synthesis has no direction
    const expected = subset
      .map((i) => breakers[i] as (typeof breakers)[number])
      .filter(
        ([row]) => !(row === 9 && subset.some((j) => breakers[j]?.[0] === 6))
      );
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(codes(result)).toEqual(expected.map(([, , , code]) => code));
    expect(result.reason).toEqual(result.reasons[0]);
    expect(result.reason?.code).toBe(expected[0]?.[3]);
    expect(result.reasons.map((r) => r.row)).toEqual(
      expected.map(([row]) => row)
    );
    expect(result.notices).toEqual([]);
    expect(result.halfRiskPreset).toBe(false);
    expect(result.refresh).toBeNull();
  });

  test('reasons of one row stay in the order they were found', () => {
    const result = checkOffer(
      input({
        blackout: blackout({ list: null, events: null }),
        specs: specs({ captured_at: NOW - 9 * 86_400 }),
      })
    );
    expect(codes(result)).toEqual([
      'CALENDAR_LIST_INVALID',
      'CALENDAR_UNAVAILABLE',
      'SPECS_STALE',
    ]);
  });

  test('a row cannot be shown ahead of an earlier one even if it is found first', () => {
    // the data status is checked after the synthesis in the code, the price after both; the sort,
    // not the order of discovery, decides
    const result = checkOffer(
      input({
        specs: specs({ captured_at: NOW - 9 * 86_400 }),
        dataStatus: { status: 'MARKET_CLOSED', dataAsOfSlot: SEP18_SLOT },
      })
    );
    expect(codes(result)).toEqual(['MARKET_CLOSED', 'SPECS_STALE']);
  });
});

describe('the table', () => {
  test('every "not offered" code has a row of the 6.4 table, or 10 for the broker figures', () => {
    const rows = new Set(Object.values(NOT_OFFERED_ROW));
    expect([...rows].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
    expect(Object.keys(NOT_OFFERED_ROW).length).toBe(22);
  });

  test('the nine rows have distinct codes between them', () => {
    const nine = [
      'FRESH',
      'DATA_DELAYED',
      'CAUTIONARY',
      'RETUNING',
      'STYLE_COUNTER_TREND',
      'STYLE_WITH_TREND',
      'NEWER_CYCLE_CHANGED',
      'SYNTHESIS_NEUTRAL',
      'SYNTHESIS_STAND_ASIDE',
      'DATA_STALE',
      'MARKET_CLOSED',
      'TIER1_BLACKOUT',
      'PAST_INVALIDATION',
    ];
    expect(new Set(nine).size).toBe(nine.length);
  });
});

describe('what is refused outright', () => {
  test.each([0, -5, 1.5, 'now', null])('a clock of %p', (clock) => {
    expect(() => checkOffer(input({ nowSeconds: clock as number }))).toThrow(
      /nowSeconds/
    );
  });
});

describe('parseLiveDataStatus', () => {
  test.each(['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'])(
    'reads %s',
    (status) => {
      expect(
        parseLiveDataStatus({
          status,
          reason: 'CYCLE_READY_IN_TIME',
          dataAsOfSlot: SEP18_SLOT,
          secondsSinceReady: 30,
        })
      ).toEqual({ status, dataAsOfSlot: SEP18_SLOT });
    }
  );

  test.each([null, undefined])('a %p time of day is no time', (slot) => {
    expect(
      parseLiveDataStatus({ status: 'STALE', dataAsOfSlot: slot })
    ).toEqual({
      status: 'STALE',
      dataAsOfSlot: null,
    });
  });

  test.each([
    ['null', null],
    ['text', 'FRESH'],
    ['a list', ['FRESH']],
    ['an empty object', {}],
    ['an unknown status', { status: 'OK', dataAsOfSlot: SEP18_SLOT }],
    ['a status in lower case', { status: 'fresh', dataAsOfSlot: SEP18_SLOT }],
    ['a status that is not text', { status: 1, dataAsOfSlot: SEP18_SLOT }],
    ['an unreadable time', { status: 'FRESH', dataAsOfSlot: 'now' }],
    ['a time of zero', { status: 'FRESH', dataAsOfSlot: 0 }],
  ])('refuses %s', (_label, raw) => {
    expect(parseLiveDataStatus(raw)).toBeNull();
  });

  test('is what the offer check takes', () => {
    const live = parseLiveDataStatus({
      status: 'DELAYED',
      dataAsOfSlot: SEP18_SLOT,
    });
    expect(checkOffer(input({ dataStatus: live })).notices[0]?.code).toBe(
      'DATA_DELAYED'
    );
  });
});

describe('the stored 28 Sep SHORT downtrend, end to end', () => {
  test('is offered at its own price, with the half risk of its MCD0 defect', () => {
    const result = checkOffer(
      input({
        style: 'TREND_FOLLOWING',
        pinned: synthesisOf(readingOf('03-').reading),
        zones: SEP28_ZONES,
        price: 4125.32,
        dataStatus: { status: 'FRESH', dataAsOfSlot: SEP28_SLOT },
      })
    );
    expect(result.verdict).toBe('OFFERED');
    expect(result.halfRiskPreset).toBe(true);
    expect(noticeCodes(result)).toEqual(['CAUTIONARY']);
    expect(result.pinnedSlot).toBe(BigInt(SEP28_SLOT));
    expect(result.zones.map((z) => z.zoneId)).toEqual(['Z1', 'Z2']);
  });
});
