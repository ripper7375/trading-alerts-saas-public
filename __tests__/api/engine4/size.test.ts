/**
 * @jest-environment node
 */

/**
 * POST /api/engine4/size (build step 5, part 6; architecture 6.7, 6.10).
 *
 * The server recomputes everything from the cycle, the zone and the trader's own
 * inputs. The tests hold three things to account: the route's `ValidatedSetup` is
 * byte-identical to what the engine makes from the same data; nothing a client
 * sends beyond its own inputs changes a single byte of it; and every unknown or
 * hostile value is a RESULT (200 with the failing check), never a thrown error.
 */

jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/db/prisma', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .prismaModule()
);
jest.mock('@/lib/redis/client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .redisModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .gatewayModule()
);
jest.mock('@/lib/engine4/read/cycle', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .cycleModule()
);
jest.mock('@/lib/engine4/read/specs', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .specsModule()
);
jest.mock('@/lib/engine4/read/events', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .eventsModule()
);
jest.mock('@/lib/engine4/read/bars', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .barsModule()
);
jest.mock('@/lib/engine4/read/synthesis', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .synthesisModule()
);
jest.mock('@/lib/engine4/read/structure-levels', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .structureModule()
);

import { createHash } from 'crypto';

import * as profileRoute from '@/app/api/engine4/profile/route';
import * as sizeRoute from '@/app/api/engine4/size/route';
import {
  badgeContextFromReading,
  decideBadge,
  nextOpposingLevel,
  serializeValidatedSetup,
  validateSetup,
} from '@/lib/engine4';

import { setup as engineSetup } from '../../lib/engine4/helpers/setup';
import { readingOf } from '../../lib/engine4/helpers/setup';
import { calls, db, post, resetAll, signIn, world } from './helpers/mocks';
import { ROOMY, Z1_FIELDS } from './helpers/world';

type Json = any;

const ORIGINAL_ENV = process.env;

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV, ENGINE4_REPORT2_ENABLED: 'true' };
  jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
  resetAll();
  signIn('PRO');
  await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY }));
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function size(
  body: object
): Promise<{ status: number; json: Json; text: string }> {
  const response = await sizeRoute.POST(post('/api/engine4/size', body));
  const text = await response.text();
  return { status: response.status, json: JSON.parse(text) as Json, text };
}

const asked = (extra: object = {}): object => ({
  cycleSlot: world.slot,
  ...Z1_FIELDS,
  ...extra,
});

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** The engine's own answer from the same stored cycle, made without the route. */
function engineText(
  fields: object,
  golden?: string
): { text: string; sha: string } {
  const text = serializeValidatedSetup(
    validateSetup(
      engineSetup(golden === undefined ? {} : { golden }).ctx,
      fields
    )
  );
  return { text, sha: sha256(text) };
}

describe('the route and the engine give the same setup, byte for byte', () => {
  test.each([
    ['Z1 at the pre-set risk', {}],
    ['Z2', { zoneId: 'Z2', entry: '4350.16', stopDistance: '16.1' }],
    ['a pill picked with no entry typed', { entry: undefined }],
    ['a custom entry inside the day', { zoneId: undefined, entry: '4360' }],
    ['a custom entry outside the day', { zoneId: undefined, entry: '4500' }],
    ['risk above Max RPT', { riskPct: '1.6' }],
    ['risk above the half-risk pre-set (an override)', { riskPct: '1.5' }],
    ['a stop closer than Min SLD', { stopDistance: '12.99' }],
    ['an RRR over the counter-trend cap', { rrr: '2.51' }],
    ['a small account (underflow)', { equity: '300', riskPct: '0.5' }],
    ['the wrong side', { side: 'SELL' }],
    [
      'nothing but the cycle',
      {
        zoneId: undefined,
        entry: undefined,
        equity: undefined,
        riskPct: undefined,
        stopDistance: undefined,
        rrr: undefined,
      },
    ],
  ])('%s', async (_label, over) => {
    const fields = { ...Z1_FIELDS, ...over };
    const { status, json } = await size({ cycleSlot: world.slot, ...fields });
    const expected = engineText(fields);
    expect(status).toBe(200);
    expect(JSON.stringify(json.setup)).toBe(expected.text);
    expect(json.setupSha256).toBe(expected.sha);
  });

  test('the good setup passes all eight checks and sizes a lot', async () => {
    const { json } = await size(asked());
    expect(json.setup.ok).toBe(true);
    expect(json.setup.checks.map((c: Json) => c.status)).toEqual(
      Array(8).fill('PASS')
    );
    expect(json.setup.scenarios.sizing.status).toBe('OK');
    expect(json.setup.scenarios.scenarios.map((s: Json) => s.name)).toEqual([
      'CONSERVATIVE',
      'NORMAL',
      'AGGRESSIVE',
    ]);
    expect(json.profileSnapshotId).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.offer.verdict).toBe('OFFERED');
  });
});

describe('the client cannot change a figure by sending one', () => {
  const baseline = async (): Promise<{ text: string; sha: string }> => {
    const { json } = await size(asked());
    return {
      text: JSON.stringify(json.setup),
      sha: json.setupSha256 as string,
    };
  };

  test('a lot, scenarios, sizing, checks, verdicts, a profile and broker figures it computes itself are not read', async () => {
    const honest = await baseline();
    const { json } = await size(
      asked({
        lot: '99',
        rawLot: '99',
        sizing: { status: 'OK', lot: '99' },
        scenarios: { sizing: { lot: '99' }, scenarios: [] },
        setup: { ok: true, scenarios: null },
        ok: true,
        checks: [],
        verdict: 'OFFERED',
        offer: { verdict: 'OFFERED' },
        badge: 'AGGRESSIVE',
        profile: { maxRiskPct: '100', maxLeverage: '500', minSld: '0.01' },
        maxRiskPct: '100',
        maxLeverage: '500',
        minSld: '0.01',
        targetRrr: '100',
        commission: '0',
        spec: { contractSize: '1', volumeMin: '0.00001' },
        specs: { contractSize: 1 },
        contractSize: 1,
        volumeStep: '0.00001',
        spread: 0,
        typicalSpread: 0,
        price: 1,
        livePrice: 1,
        dataStatus: { status: 'FRESH' },
        nowSeconds: 1,
        zones: [{ zoneId: 'Z1', referencePrice: '1' }],
        levels: [],
        structure: { complete: false },
        userId: 'user_victim',
        profileSnapshotId: 'forged',
        pinnedSlot: 1,
      })
    );
    expect(JSON.stringify(json.setup)).toBe(honest.text);
    expect(json.setupSha256).toBe(honest.sha);
    expect(json.setup.scenarios.sizing.lot).not.toBe('99');
    expect(json.setup.profile).toEqual(ROOMY);
    expect(json.badge.badge).toBeNull();
    expect(json.profileSnapshotId).not.toBe('forged');
  });

  test('a risk over Max RPT is refused whatever profile the client claims', async () => {
    const { json } = await size(
      asked({ riskPct: '5', profile: { maxRiskPct: '10' }, maxRiskPct: '10' })
    );
    expect(json.setup.ok).toBe(false);
    expect(json.setup.checks[1].codes).toEqual(['RISK_ABOVE_MAX_RPT']);
    expect(json.setup.scenarios).toBeNull();
  });

  test('a stop under Min SLD is refused whatever Min SLD the client claims', async () => {
    const { json } = await size(
      asked({ stopDistance: '5', minSld: '1', profile: { minSld: '1' } })
    );
    expect(json.setup.checks[2].codes).toEqual(['STOP_BELOW_MIN_SLD']);
  });

  test('the leverage limit is the stored one, not a larger one the client names', async () => {
    // a tight stop on a small risk would need a lot the 1:1.5 limit does not allow
    await profileRoute.POST(
      post('/api/engine4/profile', {
        profile: { ...ROOMY, maxLeverage: '1.5' },
      })
    );
    const honest = await size(asked({ stopDistance: '13', riskPct: '1.5' }));
    const lying = await size(
      asked({
        stopDistance: '13',
        riskPct: '1.5',
        maxLeverage: '5',
        profile: { maxLeverage: '5' },
      })
    );
    expect(lying.text.replace(/"requestId":"[^"]+"/, '')).toContain(
      '"maxLeverage":"1.5"'
    );
    expect(JSON.stringify(lying.json.setup)).toBe(
      JSON.stringify(honest.json.setup)
    );
  });

  test('the zone price comes from the stored zone, not from the client`s idea of it', async () => {
    const { json } = await size(
      asked({
        entry: undefined,
        zones: [{ zoneId: 'Z1', referencePrice: '1' }],
      })
    );
    expect(json.setup.entry).toEqual({
      price: '4367.2',
      source: 'ZONE',
      zoneId: 'Z1',
    });
  });

  test('a side the client names is only compared with the synthesis`s direction', async () => {
    const { json } = await size(asked({ side: 'SELL' }));
    expect(json.setup.side).toBe('BUY');
    expect(json.setup.checks[6].codes).toEqual(['DIRECTION_MISMATCH']);
    expect(json.setup.ok).toBe(false);
  });

  test('the server`s clock decides, whatever time the client claims', async () => {
    await size(asked({ nowSeconds: 5, now: 5, time: 5 }));
    for (const call of [calls.specs, calls.bars]) {
      expect(call).toHaveBeenCalledWith({ nowSeconds: BigInt(world.now) });
    }
  });
});

describe('the same input gives the same output', () => {
  test('twice in a row, byte for byte, with different request ids', async () => {
    const a = await size(asked());
    const b = await size(asked());
    expect(JSON.stringify(b.json.setup)).toBe(JSON.stringify(a.json.setup));
    expect(b.json.setupSha256).toBe(a.json.setupSha256);
    expect(b.json.trace.requestId).not.toBe(a.json.trace.requestId);
  });

  test('typed in the modal as text and extracted from chat as numbers, one setup', async () => {
    const modal = await size(asked());
    const chat = await size({
      cycleSlot: world.slot,
      side: 'LONG',
      zoneId: 'Z1',
      entry: 4367.2,
      equity: 10000,
      riskPct: 0.75,
      stopDistance: 16.78,
      rrr: 1.75,
    });
    expect(JSON.stringify(chat.json.setup)).toBe(
      JSON.stringify(modal.json.setup)
    );
    expect(chat.json.setupSha256).toBe(modal.json.setupSha256);
  });

  test('the cycle may be named as a number or as text', async () => {
    const a = await size(asked({ cycleSlot: world.slot }));
    const b = await size(asked({ cycleSlot: String(world.slot) }));
    expect(b.json.setupSha256).toBe(a.json.setupSha256);
  });

  test('a changed profile changes the setup, because the profile is read each time', async () => {
    const before = await size(asked());
    await profileRoute.POST(
      post('/api/engine4/profile', { profile: { ...ROOMY, commission: '9' } })
    );
    const after = await size(asked());
    expect(after.json.setupSha256).not.toBe(before.json.setupSha256);
    expect(after.json.setup.profile.commission).toBe('9');
    expect(after.json.profileSnapshotId).not.toBe(
      before.json.profileSnapshotId
    );
  });
});

describe('the eight checks, as results', () => {
  test('a custom entry is held to the one-day range (widened by half its height) and the 5% filter', async () => {
    const entry = async (price: string): Promise<Json> =>
      (await size(asked({ zoneId: undefined, entry: price }))).json.setup
        .checks[0];
    // the test day is 4318.75 to 4391.20: widened by half its height, 4282.525 to 4427.425
    expect((await entry('4360')).status).toBe('PASS');
    expect((await entry('4427.425')).status).toBe('PASS');
    expect((await entry('4282.525')).status).toBe('PASS');
    expect((await entry('4427.426')).codes).toEqual([
      'ENTRY_OUTSIDE_DAY_RANGE',
    ]);
    expect((await entry('4282.524')).codes).toEqual([
      'ENTRY_OUTSIDE_DAY_RANGE',
    ]);
    expect((await entry('4500')).codes).toEqual(['ENTRY_OUTSIDE_DAY_RANGE']);
    // more than 5% from the live price 4378.31 is a typo
    expect((await entry('4700')).codes).toEqual(['ENTRY_TYPO']);
    expect((await entry('437.8')).codes).toEqual(['ENTRY_TYPO']);
    const custom = await size(asked({ zoneId: undefined, entry: '4360' }));
    expect(custom.json.setup.entry.source).toBe('CUSTOM');
  });

  test('with no M5 bars a custom entry is refused (fail closed), and a zone price still stands', async () => {
    world.knobs.barsFail = true;
    const custom = await size(asked({ zoneId: undefined, entry: '4360' }));
    expect(custom.json.setup.checks[0].codes).toEqual(['DAY_RANGE_UNKNOWN']);
    const zone = await size(asked());
    expect(zone.json.setup.checks[0].status).toBe('PASS');
  });

  test('the half-risk pre-set can be overridden up to Max RPT, and the override is in the setup and the trace', async () => {
    const { json } = await size(asked({ riskPct: '1.5' }));
    expect(json.setup.ok).toBe(true);
    expect(json.setup.overrides.defectFlag).toEqual({
      preset: '0.75',
      chosen: '1.5',
      reasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
    });
    expect(json.trace.risk.override).toEqual(json.setup.overrides.defectFlag);
    expect(json.trace.risk.halfRisk).toBe(true);
  });

  test('a news release in the window fails check 5, and the setup is not ok', async () => {
    world.knobs.events = [
      {
        valueId: 'v-1',
        eventId: '900000001',
        eventName: 'TEST US CPI',
        eventTime: world.now + 600,
        currency: 'USD',
        importance: 'HIGH',
        timeMode: 0,
        capturedAt: world.now - 600,
      },
    ];
    const { json } = await size(asked());
    expect(json.setup.ok).toBe(false);
    expect(json.setup.checks[5]).toMatchObject({
      status: 'FAIL',
      codes: ['TIER1_BLACKOUT'],
    });
    expect(json.trace.risk.checks[5]).toMatchObject({
      name: 'BLACKOUT',
      status: 'FAIL',
    });
  });

  test('stale data, no broker figures and a price past the invalidation each fail their check', async () => {
    world.knobs.gateway = 'STALE';
    expect((await size(asked())).json.setup.checks[6].codes).toContain(
      'DATA_STALE'
    );
    world.knobs.gateway = 'FRESH';
    world.knobs.specs = 'NONE';
    const noSpecs = await size(asked());
    expect(noSpecs.json.setup.checks[7].codes).toEqual(['NO_BROKER_FIGURES']);
    expect(noSpecs.json.setup.scenarios).toBeNull();
    world.knobs.specs = 'OK';
    world.knobs.price = 4300;
    expect((await size(asked())).json.setup.checks[6].codes).toContain(
      'PAST_INVALIDATION'
    );
  });

  test('a lot under the broker minimum is a result with the help, inside the trader`s limits', async () => {
    const { json } = await size(asked({ equity: '300', riskPct: '0.5' }));
    expect(json.setup.ok).toBe(false);
    expect(json.setup.checks[7].codes).toEqual(['LOT_BELOW_BROKER_MINIMUM']);
    expect(json.setup.underflow).not.toBeNull();
    expect(json.setup.scenarios.sizing.status).toBe('UNDERFLOW');
  });

  test('a cycle with no reading is a result: the setup is not ok and nothing is sized', async () => {
    const { status, json } = await size(asked({ cycleSlot: world.slot + 300 }));
    expect(status).toBe(200);
    expect(json.setup.ok).toBe(false);
    expect(json.setup.pinnedSlot).toBeNull();
    expect(json.setup.scenarios).toBeNull();
    expect(json.badge.unavailable).toBe('NO_SETUP');
  });

  test.each([
    ['an object', {}],
    ['an array', [1]],
    ['a very long string', '9'.repeat(5000)],
    ['not a number', 'abc'],
    ['hex', '0x10'],
    ['infinity', 'Infinity'],
    ['NaN', 'NaN'],
    ['scientific', '1e999'],
    ['negative zero', '-0'],
    ['a boolean', true],
    ['null', null],
  ])(
    'an entry that is %s is a result, never an error',
    async (_label, entry) => {
      const { status, json } = await size(asked({ zoneId: undefined, entry }));
      expect(status).toBe(200);
      expect(json.setup.ok).toBe(false);
      expect(json.setup.checks[0].status).toBe('FAIL');
    }
  );
});

describe('the cycle and the zone', () => {
  test('cycleSlot is required', async () => {
    const { cycleSlot: _slot, ...rest } = asked() as Json;
    const { status, json } = await size(rest);
    expect(status).toBe(400);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(calls.snapshot).not.toHaveBeenCalled();
  });

  test.each([[0], [-300], [1.5], ['x'], [1789764901], [null]])(
    'cycleSlot %p is a 400',
    async (cycleSlot) => {
      const { status } = await size(asked({ cycleSlot }));
      expect(status).toBe(400);
    }
  );

  test('a trader with no profile is told to confirm one', async () => {
    signIn('PRO', 'user_new');
    const { status, json } = await size(asked());
    expect(status).toBe(409);
    expect(json.error.code).toBe('PROFILE_NOT_SET');
  });
});

describe('the badge is the server`s, and it is honest about what it does not know', () => {
  test('the 18 Sep setup has no badge, and the blocking level 4369.57 is named', async () => {
    const { json } = await size(asked());
    expect(json.badge.badge).toBeNull();
    expect(json.badge.unavailable).toBeNull();
    expect(json.badge.result).toMatchObject({
      row: 'COUNTER_TREND',
      cap: 'CONSERVATIVE',
      fitting: [],
      noBadgeReason: 'NO_SCENARIO_FITS',
      nextLevel: { price: '4369.57' },
    });
    expect(json.trace.risk.badge).toBeNull();
  });

  test('a with-trend cycle is badged as the engine badges it, from the stored levels and the reading', async () => {
    world.use('04-');
    const fields = {
      zoneId: 'Z2',
      entry: '4376.0',
      equity: '10000',
      riskPct: '1',
      stopDistance: '30.5',
      rrr: '1.5',
    };
    const { json } = await size({ cycleSlot: world.slot, ...fields });
    const e = engineSetup({ golden: '04-' });
    const v = validateSetup(e.ctx, fields);
    const expected = decideBadge({
      side: 'BUY',
      context: badgeContextFromReading(readingOf(e.g).reading)!,
      scenarios: v.scenarios!.scenarios,
      nextLevel: nextOpposingLevel(
        e.ctx.structure.levels,
        'BUY',
        v.entry.price!
      ),
    });
    expect(JSON.stringify(json.setup)).toBe(serializeValidatedSetup(v));
    expect(json.badge.badge).toBe(expected.badge);
    expect(JSON.stringify(json.badge.result)).toBe(JSON.stringify(expected));
    expect(json.trace.risk.badge).toBe(expected.badge);
  });

  test('a counter-trend SHORT with room for the Conservative target only is badged CONSERVATIVE, naming the level that stops the others', async () => {
    world.use('07-');
    const fields = {
      zoneId: 'Z1',
      entry: '4282.0',
      equity: '10000',
      riskPct: '0.5',
      stopDistance: '20.5',
      rrr: '1.75',
    };
    const { json } = await size({ cycleSlot: world.slot, ...fields });
    expect(json.setup.ok).toBe(true);
    expect(json.badge.badge).toBe('CONSERVATIVE');
    expect(json.badge.result).toMatchObject({
      row: 'COUNTER_TREND',
      cap: 'CONSERVATIVE',
      fitting: ['CONSERVATIVE'],
      noBadgeReason: null,
      nextLevel: { price: '4250' },
    });
    expect(json.trace.risk.badge).toBe('CONSERVATIVE');
    // the same setup at the lower RRR fits the Normal target, which a counter-trend setup is not given: no badge
    const lower = await size({ cycleSlot: world.slot, ...fields, rrr: '1.5' });
    expect(lower.json.badge.badge).toBeNull();
    expect(lower.json.badge.result.fitting).toEqual(['NORMAL']);
  });

  test('when the levels cannot be read there is NO badge: unknown room is not unlimited room', async () => {
    world.knobs.structure = 'INCOMPLETE';
    const { json } = await size(asked());
    expect(json.setup.ok).toBe(true);
    expect(json.badge).toEqual({
      badge: null,
      result: null,
      unavailable: 'LEVELS_UNAVAILABLE',
    });
  });

  test('when the reading cannot be read there is no badge, and the setup is still validated', async () => {
    world.knobs.detail = 'TAMPERED';
    const { json } = await size(asked());
    expect(json.setup.ok).toBe(true);
    expect(json.badge.unavailable).toBe('SYNTHESIS_UNAVAILABLE');
    expect(json.trace.data.problems).toContain('SYNTHESIS_READING_TAMPERED');
  });

  test('a setup that was not sized has no badge', async () => {
    const { json } = await size(asked({ riskPct: '9' }));
    expect(json.badge.unavailable).toBe('SETUP_NOT_SIZED');
  });
});

describe('the trace', () => {
  test('carries the Risk group: the eight checks, the setup hash, the language, the stages', async () => {
    const { json } = await size(asked({ language: 'ar' }));
    expect(json.trace.language).toBe('ar');
    expect(json.trace.risk.ok).toBe(true);
    expect(
      json.trace.risk.checks.map((c: Json) => `${c.id}${c.name}${c.status}`)
    ).toEqual([
      '0ENTRYPASS',
      '1RISKPASS',
      '2STOPPASS',
      '3RRRPASS',
      '4LEVERAGEPASS',
      '5BLACKOUTPASS',
      '6SETUPPASS',
      '7LOTPASS',
    ]);
    expect(json.trace.risk.setupSha256).toBe(json.setupSha256);
    expect(json.trace.timings.stages.length).toBeGreaterThan(5);
  });

  test('a language the app does not offer is a 400; no language is the default', async () => {
    expect((await size(asked({ language: 'xx' }))).status).toBe(400);
    expect((await size(asked())).json.trace.language).toBe('en-US');
  });
});

describe('a size writes nothing', () => {
  test('no consent, no snapshot, no Redis', async () => {
    const historyBefore = db.history.length;
    await size(asked());
    expect(db.consents).toEqual([]);
    expect(db.history).toHaveLength(historyBefore);
  });
});
