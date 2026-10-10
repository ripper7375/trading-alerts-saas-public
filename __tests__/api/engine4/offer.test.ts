/**
 * @jest-environment node
 */

/**
 * POST /api/engine4/offer (build step 5, part 6; architecture 6.4 and 6.13).
 *
 * The route reads the trader's profile from the database and everything else from the
 * server's own sources (here: the stored 18 Sep 20:55 cycle behind the readers, the
 * gateway's live status, the broker row, the news calendar), runs `checkOffer`, and
 * answers with the verdict and the modal definition. A fact the client states (a
 * price, a status, a verdict) has nowhere to go. Every unknown fails closed.
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

import * as offerRoute from '@/app/api/engine4/offer/route';
import * as profileRoute from '@/app/api/engine4/profile/route';
import type { CalendarEvent } from '@/lib/engine4';

import { calls, db, post, resetAll, signIn, world } from './helpers/mocks';
import { ROOMY } from './helpers/world';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ENGINE4_REPORT2_ENABLED: 'true' };
  jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
  resetAll();
  signIn('PRO');
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function confirmProfile(profile: object = ROOMY): Promise<string> {
  const body = await (
    await profileRoute.POST(post('/api/engine4/profile', { profile }))
  ).json();
  return body.snapshotId as string;
}

async function offer(body: object = {}): Promise<{
  status: number;
  json: any;
}> {
  const response = await offerRoute.POST(post('/api/engine4/offer', body));
  return { status: response.status, json: await response.json() };
}

/** A Tier-1 release (TEST id) `seconds` from now, with an exact time. */
function release(
  seconds: number,
  over: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    valueId: 'v-1',
    eventId: '900000001',
    eventName: 'TEST US CPI',
    eventTime: world.now + seconds,
    currency: 'USD',
    importance: 'HIGH',
    timeMode: 0,
    capturedAt: world.now - 600,
    ...over,
  };
}

describe('a trader who has not confirmed a profile', () => {
  test('is told to, and nothing else is read', async () => {
    const { status, json } = await offer();
    expect(status).toBe(409);
    expect(json.error.code).toBe('PROFILE_NOT_SET');
    expect(calls.snapshot).not.toHaveBeenCalled();
    expect(calls.gateway).not.toHaveBeenCalled();
    expect(calls.specs).not.toHaveBeenCalled();
  });
});

describe('the stored 18 Sep cycle, a good moment', () => {
  let snapshotId: string;
  beforeEach(async () => {
    snapshotId = await confirmProfile();
  });

  test('is offered, and the answer names the cycle every later call must send', async () => {
    const { status, json } = await offer();
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cycleSlot).toBe(String(world.slot));
    expect(json.offer).toMatchObject({
      verdict: 'OFFERED',
      reason: null,
      direction: 'LONG',
      trendRelation: 'COUNTER_TREND',
      halfRiskPreset: true,
      pinnedSlot: String(world.slot),
      dataAsOfSlot: String(world.slot),
      specsVersion: '3',
      tier1ListVersion: 4,
    });
    expect(json.profile).toEqual(ROOMY);
    expect(json.profileSnapshotId).toBe(snapshotId);
  });

  test('the modal has one pill per zone at its reference price, in rank order', async () => {
    const { json } = await offer();
    expect(json.modal.status).toBe('OFFERED');
    expect(json.modal.direction).toBe('LONG');
    expect(json.modal.side).toBe('BUY');
    expect(json.modal.pills.map((p: { zoneId: string }) => p.zoneId)).toEqual([
      'Z1',
      'Z2',
    ]);
    expect(json.modal.pills.map((p: { price: string }) => p.price)).toEqual([
      '4367.2',
      '4350.16',
    ]);
    expect(
      json.modal.pills.every((p: { invalidated: boolean }) => !p.invalidated)
    ).toBe(true);
  });

  test('a CAUTIONARY cycle pre-sets half the risk with the reason, and a counter-trend setup caps the RRR', async () => {
    const { json } = await offer();
    expect(json.modal.risk).toEqual({
      preset: '0.75',
      max: '1.5',
      halfRisk: true,
      reasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
    });
    expect(json.modal.rrr).toMatchObject({
      min: '1.5',
      max: '2.5',
      preset: '1.75',
    });
    expect(json.offer.notices.map((n: { code: string }) => n.code)).toEqual([
      'CAUTIONARY',
    ]);
  });

  test('the stop options behind a pill are the stored levels, nearest first', async () => {
    const { json } = await offer();
    const z1 = json.modal.pills[0].stop;
    expect(z1.mode).toBe('STRUCTURE');
    expect(z1.structural.length).toBeGreaterThan(0);
    expect(z1.preselected.kind).toBeDefined();
  });

  test('the blackout and the calendar age go with it, for the notice the report must show', async () => {
    const { json } = await offer();
    expect(json.blackout.status).toBe('CLEAR');
    expect(json.blackout.calendar).toMatchObject({ late: false });
    expect(json.blackout.warnings).toEqual([]);
  });

  test('bigint seconds arrive as text and prices as canonical decimal text, never as floats', async () => {
    const { json } = await offer();
    expect(typeof json.offer.pinnedSlot).toBe('string');
    expect(typeof json.modal.pills[0].price).toBe('string');
    expect(typeof json.modal.risk.preset).toBe('string');
  });

  test('is the same answer twice', async () => {
    const first = await offer();
    const second = await offer();
    const strip = (j: Record<string, unknown>) => ({ ...j, trace: undefined });
    expect(JSON.stringify(strip(second.json))).toBe(
      JSON.stringify(strip(first.json))
    );
    expect(second.json.trace.requestId).not.toBe(first.json.trace.requestId);
  });

  test('asked for the cycle it is already on, it is the same answer', async () => {
    const without = await offer();
    const withSlot = await offer({ cycleSlot: world.slot });
    const asText = await offer({ cycleSlot: String(world.slot) });
    for (const other of [withSlot, asText]) {
      expect(other.json.offer).toEqual(without.json.offer);
      expect(other.json.modal).toEqual(without.json.modal);
    }
    expect(calls.snapshot).toHaveBeenLastCalledWith({
      profile: 'DAY_TRADER',
      pinnedSlot: world.slot,
    });
  });

  test('takes the clock from the server, never from the body', async () => {
    await offer({ nowSeconds: 1, now: 1, clock: 1 });
    expect(calls.specs).toHaveBeenCalledWith({ nowSeconds: BigInt(world.now) });
    expect(calls.bars).toHaveBeenCalledWith({ nowSeconds: BigInt(world.now) });
  });

  test('ignores every fact the client states', async () => {
    const baseline = await offer();
    const lying = await offer({
      price: 1,
      livePrice: 1,
      dataStatus: { status: 'FRESH' },
      status: 'FRESH',
      verdict: 'OFFERED',
      offer: { verdict: 'OFFERED' },
      modal: { status: 'OFFERED' },
      profile: { maxRiskPct: '99', maxLeverage: '99' },
      specs: { contractSize: 1 },
      zones: [{ zoneId: 'Z9', referencePrice: '1' }],
      blackout: { status: 'CLEAR' },
      userId: 'someone-else',
    });
    expect(lying.json.offer).toEqual(baseline.json.offer);
    expect(lying.json.modal).toEqual(baseline.json.modal);
    expect(lying.json.profile).toEqual(ROOMY);
  });

  test('reads the pinned reading for the profile of the trader type, never one the client names', async () => {
    await offer({ profile: 'SCALPER', traderType: 'SCALPER' });
    expect(calls.snapshot).toHaveBeenCalledWith({ profile: 'DAY_TRADER' });
    expect(calls.detail).toHaveBeenCalledWith({
      profile: 'DAY_TRADER',
      cycleSlot: world.slot,
    });
  });

  test('a stored SYN flag of shadow is reported beside the answer, not hidden', async () => {
    world.knobs.flag = 'shadow';
    const { json } = await offer();
    expect(json.synthesisFlag).toBe('shadow');
    expect(json.trace.data.synthesis.flag).toBe('shadow');
  });

  test('a trader whose style is trend following is told a counter-trend setup is not their style', async () => {
    await confirmProfile({ ...ROOMY, style: 'TREND_FOLLOWING' });
    const { json } = await offer();
    expect(json.offer.verdict).toBe('OFFERED');
    expect(json.offer.notices.map((n: { code: string }) => n.code)).toEqual([
      'CAUTIONARY',
      'STYLE_COUNTER_TREND',
    ]);
  });

  test('the trace carries the Data group of 7.4 and a timed stage per reader', async () => {
    const { json } = await offer();
    expect(json.trace.data).toMatchObject({
      cycleSlot: String(world.slot),
      dataStatus: 'FRESH',
      dataAsOfSlot: String(world.slot),
      specsVersion: '3',
      tier1ListVersion: 4,
      problems: [],
      synthesis: {
        ruleId: 'R1_MACRO_COUNTER_TREND_RALLY',
        rulesVersion: 'draft-1',
        flag: 'live',
        bias: 'LONG',
        status: 'CAUTIONARY',
        trendRelation: 'COUNTER_TREND',
      },
    });
    expect(json.trace.data.sensors).toEqual([
      { mcdId: 'MCD1', status: 'VALID', available: true },
      { mcdId: 'MCD2', status: 'VALID', available: true },
      { mcdId: 'MCD3', status: 'CAUTIONARY', available: true },
    ]);
    expect(json.trace.risk).toMatchObject({
      offerVerdict: 'OFFERED',
      offerReasons: [],
      notices: ['CAUTIONARY'],
      halfRisk: true,
      checks: null,
    });
    const stages = json.trace.timings.stages.map(
      (s: { name: string }) => s.name
    );
    expect(stages.sort()).toEqual(
      [
        'bars',
        'calendar',
        'cycle',
        'gateway',
        'profile',
        'specs',
        'structure',
        'synthesis',
      ].sort()
    );
  });
});

describe('a bad moment fails closed, with the reason of the first row of 6.4 that applies', () => {
  beforeEach(async () => {
    await confirmProfile();
  });

  const notOffered = async (): Promise<any> => {
    const { status, json } = await offer();
    expect(status).toBe(200);
    expect(json.offer.verdict).toBe('NOT_OFFERED');
    expect(json.modal.status).toBe('NOT_OFFERED');
    expect(json.modal.pills).toBeUndefined();
    expect(json.offer.reason).toEqual(json.offer.reasons[0]);
    return json;
  };

  test('no live status from the gateway (it is down)', async () => {
    world.knobs.gateway = 'THROWS';
    const json = await notOffered();
    expect(json.offer.reason.code).toBe('DATA_STATUS_UNKNOWN');
    expect(json.trace.data.problems).toContain('GATEWAY_UNREACHABLE');
    expect(JSON.stringify(json)).not.toContain('could not be reached');
  });

  test('a live status that is not one of the four', async () => {
    world.knobs.gateway = 'GARBAGE';
    const json = await notOffered();
    expect(json.offer.reason.code).toBe('DATA_STATUS_UNKNOWN');
    expect(json.trace.data.problems).toContain('GATEWAY_BAD_STATUS');
  });

  test('STALE and MARKET_CLOSED', async () => {
    world.knobs.gateway = 'STALE';
    expect((await notOffered()).offer.reason.code).toBe('DATA_STALE');
    world.knobs.gateway = 'MARKET_CLOSED';
    expect((await notOffered()).offer.reason.code).toBe('MARKET_CLOSED');
  });

  test('DELAYED is still offered, with its notice', async () => {
    world.knobs.gateway = 'DELAYED';
    const { json } = await offer();
    expect(json.offer.verdict).toBe('OFFERED');
    expect(json.offer.notices.map((n: { code: string }) => n.code)).toContain(
      'DATA_DELAYED'
    );
  });

  test('a Tier-1 release inside its window', async () => {
    world.knobs.events = [release(10 * 60)];
    const json = await notOffered();
    expect(json.offer.reason.code).toBe('TIER1_BLACKOUT');
    expect(json.blackout.status).toBe('BLOCKED');
    expect(json.blackout.blocks[0]).toMatchObject({ eventId: '900000001' });
  });

  test('releases at -16, -14, +14 and +16 minutes: allowed, blocked, blocked, allowed', async () => {
    const verdicts: string[] = [];
    for (const minutes of [-16, -14, 14, 16]) {
      world.knobs.events = [release(minutes * 60)];
      verdicts.push((await offer()).json.offer.verdict as string);
    }
    expect(verdicts).toEqual([
      'OFFERED',
      'NOT_OFFERED',
      'NOT_OFFERED',
      'OFFERED',
    ]);
  });

  test('the Tier-1 list that ships today (empty) is "not set", and a list that cannot be read is "invalid"', async () => {
    world.knobs.list = { schemaVersion: 1, listVersion: 4, events: [] };
    expect((await notOffered()).offer.reason.code).toBe(
      'CALENDAR_LIST_NOT_SET'
    );
    world.knobs.list = null;
    expect((await notOffered()).offer.reason.code).toBe(
      'CALENDAR_LIST_INVALID'
    );
  });

  test('a calendar that cannot be read', async () => {
    world.knobs.calendarFails = true;
    const json = await notOffered();
    expect(json.offer.reason.code).toBe('CALENDAR_UNAVAILABLE');
    expect(json.trace.data.problems).toEqual([
      'CALENDAR: the news calendar could not be read',
    ]);
  });

  test('no broker row, and a broker row older than seven days', async () => {
    world.knobs.specs = 'NONE';
    expect((await notOffered()).offer.reason.code).toBe('SPECS_MISSING');
    world.knobs.specs = 'STALE';
    expect((await notOffered()).offer.reason.code).toBe('SPECS_STALE');
  });

  test('a price already past every invalidation', async () => {
    world.knobs.price = 4300;
    expect((await notOffered()).offer.reason.code).toBe('PAST_INVALIDATION');
  });

  test('no newest price', async () => {
    world.knobs.price = 'NONE';
    expect((await notOffered()).offer.reason.code).toBe('PRICE_UNKNOWN');
  });

  test('a NEUTRAL or STAND_ASIDE synthesis', async () => {
    world.knobs.pinned = { bias: 'NEUTRAL' };
    expect((await notOffered()).offer.reason.code).toBe('SYNTHESIS_NEUTRAL');
    world.knobs.pinned = { bias: 'STAND_ASIDE' };
    expect((await notOffered()).offer.reason.code).toBe(
      'SYNTHESIS_STAND_ASIDE'
    );
  });

  test('no reading for the cycle that was asked for', async () => {
    const response = await offerRoute.POST(
      post('/api/engine4/offer', { cycleSlot: world.slot + 300 })
    );
    const json = await response.json();
    expect(json.offer.verdict).toBe('NOT_OFFERED');
    expect(json.offer.reason.code).toBe('SYNTHESIS_UNUSABLE');
    expect(json.cycleSlot).toBeNull();
    expect(json.trace.data.problems).toContain('PINNED_READING_MISSING');
    // with no pinned cycle there is nothing to read levels for
    expect(calls.detail).not.toHaveBeenCalled();
    expect(calls.structure).not.toHaveBeenCalled();
  });

  test('when several apply, the first in table order is shown and all are returned', async () => {
    world.knobs.gateway = 'THROWS'; // row 7
    world.knobs.specs = 'NONE'; // row 10
    world.knobs.events = [release(5 * 60)]; // row 8
    const json = await notOffered();
    expect(json.offer.reasons.map((r: { code: string }) => r.code)).toEqual([
      'DATA_STATUS_UNKNOWN',
      'TIER1_BLACKOUT',
      'SPECS_MISSING',
    ]);
    expect(json.offer.reason.code).toBe('DATA_STATUS_UNKNOWN');
    expect(json.trace.risk.offerReasons).toEqual([
      'DATA_STATUS_UNKNOWN',
      'TIER1_BLACKOUT',
      'SPECS_MISSING',
    ]);
  });

  test('a newer cycle that changed the picture is a refresh offer, and the pinned setup is kept', async () => {
    world.knobs.newest = {
      cycleSlot: world.slot + 300,
      bias: 'SHORT',
      status: 'VALID',
      statusReasons: [],
      trendRelation: 'WITH_TREND',
      ruleId: 'OTHER',
      branchId: null,
      retuning: false,
    };
    const { json } = await offer({ cycleSlot: world.slot });
    expect(json.offer.verdict).toBe('REFRESH_OFFERED');
    expect(json.offer.refresh.newSlot).toBe(String(world.slot + 300));
    expect(json.modal.refresh.changes).toEqual(
      expect.arrayContaining(['BIAS', 'RULE'])
    );
    expect(json.cycleSlot).toBe(String(world.slot));
  });

  test('unreadable levels degrade the stop options to the zone`s own invalidation, with the reason', async () => {
    world.knobs.structure = 'INCOMPLETE';
    const { json } = await offer();
    expect(json.offer.verdict).toBe('OFFERED');
    expect(json.modal.pills[0].stop.mode).toBe('DEGRADED');
    expect(json.trace.data.problems).toContain('BUNDLE_MISSING');
  });

  test('no M5 bars: the offer stands, a custom entry has no bound', async () => {
    world.knobs.barsFail = true;
    const { json } = await offer();
    expect(json.offer.verdict).toBe('OFFERED');
    expect(json.modal.custom.entry.day).toBeNull();
    expect(json.trace.data.problems).toContain('DATABASE_ERROR');
  });
});

describe('what the route accepts', () => {
  beforeEach(async () => {
    await confirmProfile();
  });

  test.each([
    ['not a multiple of 300', '1789764901'],
    ['a multiple of 60 but not of 300', '1789764960'],
    ['text', 'abc'],
    ['negative', -300],
    ['zero', 0],
    ['a fraction', 1.5],
    ['too large', '99999999999'],
    ['an object', {}],
    ['an array', [300]],
    ['a boolean', true],
    ['scientific', '1e9'],
    ['padded with zeros', '01789764900'],
  ])('a cycleSlot that is %s is a 400', async (_label, cycleSlot) => {
    const { status, json } = await offer({ cycleSlot });
    expect(status).toBe(400);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(calls.snapshot).not.toHaveBeenCalled();
  });

  test.each([
    ['has spaces', 'Z 1'],
    ['is too long', 'Z'.repeat(33)],
    ['is a number', 5],
    ['has a slash', 'Z1/..'],
  ])('a zoneId that %s is a 400', async (_label, zoneId) => {
    const { status } = await offer({ zoneId });
    expect(status).toBe(400);
  });

  test('a zoneId that is well formed but not in the reading is a result: ZONE_UNKNOWN', async () => {
    const { json } = await offer({ zoneId: 'Z9' });
    expect(json.offer.verdict).toBe('NOT_OFFERED');
    expect(json.offer.reason.code).toBe('ZONE_UNKNOWN');
  });

  test('nothing is written by an offer', async () => {
    const before = db.calls.length;
    await offer();
    expect(
      db.calls.slice(before).filter((c) => /create|upsert/.test(c))
    ).toEqual([]);
    expect(db.consents).toEqual([]);
  });
});
