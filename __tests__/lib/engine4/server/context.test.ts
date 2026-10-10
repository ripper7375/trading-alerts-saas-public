/**
 * @jest-environment node
 */

/**
 * The loader that reads everything a route needs, once (build step 5, part 6). The
 * readers are handed in, so the tests see exactly what each one is asked, in what
 * order, with what clock, and what the loader does when one of them cannot answer.
 * The data is the stored 18 Sep 20:55 cycle (`ReaderWorld`).
 */

import { Engine4HttpError } from '@/lib/engine4/server/errors';
import { loadWorld, traceDataOf } from '@/lib/engine4/server/context';
import type { ContextDeps } from '@/lib/engine4/server/context';
import { TraceBuilder } from '@/lib/engine4/server/trace';
import { PROFILE_DEFAULTS } from '@/lib/engine4';
import type { StoredProfile } from '@/lib/engine4/store/profile-store';

import { world } from '../../../api/engine4/helpers/world';

// The loader imports the readers, the stores and the gateway client; none is used for real here.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/active-indicator/gateway-client', () => ({
  fetchCurrentCycle: jest.fn(),
}));

const PROFILE = {
  ...PROFILE_DEFAULTS,
  style: 'BOTH' as const,
  maxLeverage: '5',
  equity: '10000',
};
const STORED: StoredProfile = {
  profile: PROFILE,
  snapshotId: 'snap-1',
  updatedAt: new Date('2026-10-10T08:00:00.000Z'),
};

interface Calls {
  [name: string]: jest.Mock;
}

function deps(over: Partial<ContextDeps> = {}): {
  deps: ContextDeps;
  calls: Calls;
} {
  const calls: Calls = {
    readProfile: jest.fn(async () => STORED),
    fetchCurrentCycle: jest.fn(async () => world.gatewayBody()),
    readOfferSnapshot: jest.fn(
      async (r: { profile: string; pinnedSlot?: number }) => world.snapshot(r)
    ),
    readNewestBrokerFigures: jest.fn(async () => world.specs()),
    loadTier1List: jest.fn(() => world.tier1()),
    readCalendar: jest.fn(async () => world.calendar()),
    readClosedM5Bars: jest.fn(async () => world.bars()),
    readSynthesisDetail: jest.fn(async () => world.detail()),
    readStructureLevels: jest.fn(async () => world.structure()),
  };
  const built: ContextDeps = {
    clock: () => world.nowMs,
    readProfile: calls['readProfile'] as never,
    fetchCurrentCycle: calls['fetchCurrentCycle'] as never,
    readOfferSnapshot: calls['readOfferSnapshot'] as never,
    readNewestBrokerFigures: calls['readNewestBrokerFigures'] as never,
    loadTier1List: calls['loadTier1List'] as never,
    readCalendar: calls['readCalendar'] as never,
    readClosedM5Bars: calls['readClosedM5Bars'] as never,
    readSynthesisDetail: calls['readSynthesisDetail'] as never,
    readStructureLevels: calls['readStructureLevels'] as never,
    ...over,
  };
  return { deps: built, calls };
}

const trace = (): TraceBuilder =>
  new TraceBuilder('size', 'POST', () => 0, 'r');
const request = { userId: 'u1', cycleSlot: null, zoneId: null };

beforeEach(() => world.reset());

describe('loadWorld', () => {
  test('a trader with no profile stops it before anything else is read', async () => {
    const { deps: d, calls } = deps({ readProfile: async () => null });
    await expect(loadWorld(request, trace(), d)).rejects.toMatchObject({
      name: 'Engine4HttpError',
      code: 'PROFILE_NOT_SET',
      message: 'Confirm your trading profile first.',
    });
    await expect(loadWorld(request, trace(), d)).rejects.toBeInstanceOf(
      Engine4HttpError
    );
    for (const name of [
      'fetchCurrentCycle',
      'readOfferSnapshot',
      'readNewestBrokerFigures',
      'readCalendar',
      'readClosedM5Bars',
    ]) {
      expect(calls[name]).not.toHaveBeenCalled();
    }
  });

  test('a clock that does not fit a database integer stops the level read with the name of the field', async () => {
    const { deps: d } = deps({ clock: () => 4_000_000_000_000 });
    await expect(loadWorld(request, trace(), d)).rejects.toMatchObject({
      name: 'Engine4InputError',
      message: 'nowSeconds does not fit a database integer',
    });
  });

  test('a pinned cycle that does not fit a database integer is refused with the name of the field', async () => {
    const { deps: d } = deps({
      readOfferSnapshot: async (r: {
        profile: string;
        pinnedSlot?: number;
      }) => ({
        ...world.snapshot(r),
        pinned: { ...world.snapshot(r).pinned!, cycleSlot: 4_000_000_000 },
      }),
    });
    await expect(loadWorld(request, trace(), d)).rejects.toMatchObject({
      name: 'Engine4InputError',
      message: 'pinnedSlot does not fit a database integer',
    });
  });

  test('reads the profile of the signed-in trader', async () => {
    const { deps: d, calls } = deps();
    await loadWorld({ ...request, userId: 'user_42' }, trace(), d);
    expect(calls['readProfile']).toHaveBeenCalledWith('user_42');
  });

  test('takes the clock once, in whole seconds, and hands it to every reader', async () => {
    const { deps: d, calls } = deps({ clock: () => 1_789_765_050_999 });
    const loaded = await loadWorld(request, trace(), d);
    expect(loaded.nowSeconds).toBe(1_789_765_050n);
    expect(calls['readNewestBrokerFigures']).toHaveBeenCalledWith({
      nowSeconds: 1_789_765_050n,
    });
    expect(calls['readClosedM5Bars']).toHaveBeenCalledWith({
      nowSeconds: 1_789_765_050n,
    });
    expect(calls['readCalendar']).toHaveBeenCalledWith({
      nowSeconds: 1_789_765_050n,
      traderType: 'DAY_TRADER',
      list: world.tier1().list,
    });
    expect(calls['readStructureLevels']).toHaveBeenCalledWith(
      expect.objectContaining({ nowSeconds: 1_789_765_050 })
    );
  });

  test('asks for the newest reading of the trader type when no cycle was named, and the named one when it was', async () => {
    const a = deps();
    await loadWorld(request, trace(), a.deps);
    expect(a.calls['readOfferSnapshot']).toHaveBeenCalledWith({
      profile: 'DAY_TRADER',
    });
    const b = deps();
    await loadWorld({ ...request, cycleSlot: world.slot }, trace(), b.deps);
    expect(b.calls['readOfferSnapshot']).toHaveBeenCalledWith({
      profile: 'DAY_TRADER',
      pinnedSlot: world.slot,
    });
    const c = deps({
      readProfile: async () => ({
        ...STORED,
        profile: { ...PROFILE, traderType: 'SCALPER' },
      }),
    });
    await loadWorld(request, trace(), c.deps);
    expect(c.calls['readOfferSnapshot']).toHaveBeenCalledWith({
      profile: 'SCALPER',
    });
  });

  test('reads the levels of the pinned cycle against the hashes the reading recorded', async () => {
    const { deps: d, calls } = deps();
    await loadWorld(request, trace(), d);
    expect(calls['readSynthesisDetail']).toHaveBeenCalledWith({
      profile: 'DAY_TRADER',
      cycleSlot: world.slot,
    });
    expect(calls['readStructureLevels']).toHaveBeenCalledWith({
      cycleSlot: world.slot,
      nowSeconds: world.now,
      expectedInputsSha256: null,
      expectedEnvelopeSha256: { MCD1: null, MCD2: null, MCD3: null },
    });
  });

  test('without the reading`s hashes the levels are still read, with no expectation', async () => {
    world.knobs.detail = 'TAMPERED';
    const { deps: d, calls } = deps();
    const loaded = await loadWorld(request, trace(), d);
    const asked = calls['readStructureLevels']!.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect('expectedInputsSha256' in asked).toBe(false);
    expect('expectedEnvelopeSha256' in asked).toBe(false);
    expect(loaded.synthesis).toBeNull();
    expect(loaded.synthesisProblem).toMatchObject({ code: 'READING_TAMPERED' });
    expect(loaded.problems).toContain('SYNTHESIS_READING_TAMPERED');
  });

  test('with no pinned reading nothing is read for it, and the levels are incomplete with the reason', async () => {
    world.knobs.readingMissing = true;
    const { deps: d, calls } = deps();
    const loaded = await loadWorld(request, trace(), d);
    expect(calls['readSynthesisDetail']).not.toHaveBeenCalled();
    expect(calls['readStructureLevels']).not.toHaveBeenCalled();
    expect(loaded.ctx.structure).toEqual({
      complete: false,
      levels: [],
      problems: [
        {
          code: 'NO_SENSOR_READINGS',
          detail: 'there is no pinned cycle to read levels for',
        },
      ],
    });
    expect(loaded.ctx.offer.verdict).toBe('NOT_OFFERED');
    expect(loaded.sensors).toEqual([]);
  });

  test('times a stage for each read, and only for the reads it made', async () => {
    const full = trace();
    await loadWorld(request, full, deps().deps);
    expect(
      full
        .snapshot()
        .timings.stages.map((s) => s.name)
        .sort()
    ).toEqual([
      'bars',
      'calendar',
      'cycle',
      'gateway',
      'profile',
      'specs',
      'structure',
      'synthesis',
    ]);
    world.knobs.readingMissing = true;
    const short = trace();
    await loadWorld(request, short, deps().deps);
    expect(
      short
        .snapshot()
        .timings.stages.map((s) => s.name)
        .sort()
    ).toEqual(['bars', 'calendar', 'cycle', 'gateway', 'profile', 'specs']);
  });

  test('hands the engine the pinned reading`s zones, the newest price and the trader`s profile', async () => {
    const { ctx, snapshot } = await loadWorld(request, trace(), deps().deps);
    expect(ctx.profile).toBe(PROFILE);
    expect(ctx.zones).toBe(snapshot.zones);
    expect(ctx.livePrice).toBe(snapshot.price);
    expect(ctx.livePrice).toBe(4378.31);
    expect(ctx.offer.verdict).toBe('OFFERED');
    expect(ctx.range.ok).toBe(true);
  });

  test('passes the picked zone to the offer check, and nothing when none was picked', async () => {
    const picked = await loadWorld(
      { ...request, zoneId: 'Z9' },
      trace(),
      deps().deps
    );
    expect(picked.ctx.offer.reason?.code).toBe('ZONE_UNKNOWN');
    const none = await loadWorld(request, trace(), deps().deps);
    expect(none.ctx.offer.reason).toBeNull();
  });
});

describe('what the readers cannot give', () => {
  test.each([
    [
      'a gateway error with a kind',
      Object.assign(new Error('secret url'), { kind: 'TIMEOUT' }),
      'GATEWAY_TIMEOUT',
    ],
    ['an error with no kind', new Error('x'), 'GATEWAY_UNKNOWN'],
    ['a thrown string', 'boom', 'GATEWAY_UNKNOWN'],
    ['null', null, 'GATEWAY_UNKNOWN'],
  ])(
    '%s: no live status, and the problem names the kind only',
    async (_label, thrown, code) => {
      const { deps: d } = deps({
        fetchCurrentCycle: async () => {
          throw thrown;
        },
      });
      const loaded = await loadWorld(request, trace(), d);
      expect(loaded.liveStatus).toBeNull();
      expect(loaded.problems).toContain(code);
      expect(loaded.problems.join(' ')).not.toContain('secret url');
      expect(loaded.ctx.offer.reasons.map((r) => r.code)).toContain(
        'DATA_STATUS_UNKNOWN'
      );
    }
  );

  test('a gateway answer whose status is not a status is no status', async () => {
    world.knobs.gateway = 'GARBAGE';
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(loaded.liveStatus).toBeNull();
    expect(loaded.problems).toContain('GATEWAY_BAD_STATUS');
  });

  test('a good gateway answer is the live status', async () => {
    world.knobs.gateway = 'DELAYED';
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(loaded.liveStatus).toEqual({
      status: 'DELAYED',
      dataAsOfSlot: world.slot,
    });
  });

  test('the Tier-1 list`s problems, the calendar`s, the broker row`s and the snapshot`s are all kept', async () => {
    world.knobs.list = null;
    world.knobs.calendarFails = true;
    world.knobs.specs = 'NONE';
    world.knobs.readingMissing = true;
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(loaded.problems).toEqual(
      expect.arrayContaining([
        'TIER1_LIST: the Tier-1 list is not set',
        'CALENDAR: the news calendar could not be read',
        'NO_SPECS',
        'PINNED_READING_MISSING',
      ])
    );
  });

  test('M5 bars that could not be read make the range unknown, with the reason', async () => {
    world.knobs.barsFail = true;
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(loaded.ctx.range).toEqual({
      ok: false,
      code: 'NO_CLOSED_BARS',
      detail: 'the M5 bars failed',
    });
    expect(loaded.problems).toContain('DATABASE_ERROR');
  });

  test('no closed bar in the last day is a problem too', async () => {
    const { deps: d } = deps({
      readClosedM5Bars: async () => ({ ok: true, bars: [] }),
    });
    const loaded = await loadWorld(request, trace(), d);
    expect(loaded.ctx.range).toMatchObject({
      ok: false,
      code: 'NO_CLOSED_BARS',
    });
    expect(loaded.problems).toContain('NO_CLOSED_BARS');
  });

  test('levels that could not be read are carried as incomplete, with every problem code', async () => {
    world.knobs.structure = 'INCOMPLETE';
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(loaded.ctx.structure.complete).toBe(false);
    expect(loaded.ctx.structure.levels).toEqual([]);
    expect(loaded.problems).toContain('BUNDLE_MISSING');
  });
});

describe('traceDataOf', () => {
  test('is the Data group of 7.4, from what was loaded', async () => {
    const loaded = await loadWorld(request, trace(), deps().deps);
    expect(traceDataOf(loaded)).toEqual({
      cycleSlot: String(world.slot),
      dataStatus: 'FRESH',
      dataAsOfSlot: String(world.slot),
      sensors: [
        { mcdId: 'MCD1', status: 'VALID', available: true },
        { mcdId: 'MCD2', status: 'VALID', available: true },
        { mcdId: 'MCD3', status: 'CAUTIONARY', available: true },
      ],
      synthesis: {
        ruleId: 'R1_MACRO_COUNTER_TREND_RALLY',
        rulesVersion: 'draft-1',
        branchId: 'BREACH_UP',
        flag: 'live',
        bias: 'LONG',
        status: 'CAUTIONARY',
        trendRelation: 'COUNTER_TREND',
      },
      specsVersion: '3',
      tier1ListVersion: 4,
      problems: [],
    });
  });

  test('says null where it knows nothing', async () => {
    world.knobs.readingMissing = true;
    world.knobs.gateway = 'THROWS';
    world.knobs.specs = 'NONE';
    const data = traceDataOf(await loadWorld(request, trace(), deps().deps));
    expect(data).toMatchObject({
      cycleSlot: null,
      dataStatus: null,
      dataAsOfSlot: null,
      synthesis: null,
      specsVersion: null,
      sensors: [],
    });
  });

  test('has no synthesis block when the reading could not be read, though the cycle is known', async () => {
    world.knobs.detail = 'DATABASE_ERROR';
    const data = traceDataOf(await loadWorld(request, trace(), deps().deps));
    expect(data.cycleSlot).toBe(String(world.slot));
    expect(data.synthesis).toBeNull();
  });
});
