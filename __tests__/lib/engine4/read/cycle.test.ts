/**
 * @jest-environment node
 */

/**
 * The reader of the cycle, the synthesis readings and the entry zones the offer
 * check needs (build step 5, part 3). Rows are made from the stored 18 Sep
 * cycle (a signed-off golden scenario); the fake client answers the way the
 * Prisma queries would and records what it was asked.
 */

import {
  Engine4InputError,
  checkBlackout,
  checkOffer,
  readBrokerFigures,
} from '@/lib/engine4';
import type { CycleRow, EntryZoneRow, SynthesisRow } from '@/lib/engine4';
import { readOfferSnapshot } from '@/lib/engine4/read/cycle';
import type { CycleClient } from '@/lib/engine4/read/cycle';

import { entryRowOf, loadGoldens, slotSeconds } from '../helpers/stored';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const golden = loadGoldens().find((g) => g.id.startsWith('01-'))!;
const day = golden.readings.find((r) => r.profile === 'DAY_TRADER')!;
const SLOT = slotSeconds('2026-09-18T20:55Z');
const NOW = SLOT + 150;
const PRICE = 4378.31;

const synthesisRow = (over: Partial<SynthesisRow> = {}): SynthesisRow => ({
  cycle_slot: SLOT,
  bias: String(day.reading['bias']),
  status: String(day.reading['status']),
  status_reasons: day.reading['status_reasons'] as string[],
  trend_relation: String(day.reading['trend_relation']),
  rule_id: String(day.reading['rule_id']),
  branch_id: String(day.reading['branch_id']),
  retuning_observed: false,
  reference_price: PRICE,
  zone_count: day.zones.length,
  flag: 'shadow',
  ...over,
});

const zoneRows = (): EntryZoneRow[] =>
  day.zones.map((doc) => entryRowOf(doc) as unknown as EntryZoneRow);

interface Data {
  newest: SynthesisRow | null;
  bySlot: Record<number, SynthesisRow>;
  zones: EntryZoneRow[];
  cycle: CycleRow | null;
}

const CYCLE: CycleRow = {
  slot: SLOT,
  data_status: 'FRESH',
  retuning: false,
  ready_at: SLOT + 75,
};

function client(
  data: Partial<Data> = {},
  fail: Partial<Record<'newest' | 'pinned' | 'zones' | 'cycle', true>> = {}
) {
  const all: Data = {
    newest: synthesisRow(),
    bySlot: { [SLOT]: synthesisRow() },
    zones: zoneRows(),
    cycle: CYCLE,
    ...data,
  };
  const calls = {
    synthesis: [] as unknown[],
    zones: [] as unknown[],
    cycle: [] as unknown[],
  };
  const fake: CycleClient = {
    synthesisReading: {
      findFirst: async (args) => {
        calls.synthesis.push(args);
        const pinned = args.where.cycle_slot !== undefined;
        if (pinned && fail.pinned) throw new Error('pinned down');
        if (!pinned && fail.newest) throw new Error('newest down');
        return pinned
          ? (all.bySlot[args.where.cycle_slot as number] ?? null)
          : all.newest;
      },
    },
    entryZone: {
      findMany: async (args) => {
        calls.zones.push(args);
        if (fail.zones) throw new Error('zones down');
        return all.zones;
      },
    },
    marketCycle: {
      findFirst: async (args) => {
        calls.cycle.push(args);
        if (fail.cycle) throw new Error('cycle down');
        return all.cycle;
      },
    },
  };
  return { fake, calls };
}

const codes = (snapshot: { problems: { code: string }[] }) =>
  snapshot.problems.map((p) => p.code);

describe('readOfferSnapshot: what it asks for', () => {
  test('without a pinned cycle: the newest reading of the profile, its zones, the newest ready cycle', async () => {
    const { fake, calls } = client();
    await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    const select = {
      cycle_slot: true,
      bias: true,
      status: true,
      status_reasons: true,
      trend_relation: true,
      rule_id: true,
      branch_id: true,
      retuning_observed: true,
      reference_price: true,
      zone_count: true,
      flag: true,
    };
    expect(calls.synthesis).toEqual([
      {
        where: { symbol: 'XAUUSD', profile: 'DAY_TRADER' },
        orderBy: { cycle_slot: 'desc' },
        select,
      },
    ]);
    expect(calls.zones).toEqual([
      {
        where: { symbol: 'XAUUSD', profile: 'DAY_TRADER', cycle_slot: SLOT },
        orderBy: { rank: 'asc' },
        select: {
          zone_id: true,
          rank: true,
          bias: true,
          low: true,
          high: true,
          reference_price: true,
          invalidation_price: true,
          invalidation_basis: true,
          stop_distance: true,
          next_opposing_price: true,
          runway: true,
          runway_ratio: true,
          levels: true,
        },
      },
    ]);
    expect(calls.cycle).toEqual([
      {
        where: { symbol: 'XAUUSD', state: 'READY' },
        orderBy: { slot: 'desc' },
        select: {
          slot: true,
          data_status: true,
          retuning: true,
          ready_at: true,
        },
      },
    ]);
  });

  test('with a pinned cycle: also the reading of that cycle, and the zones are its zones', async () => {
    const { fake, calls } = client({
      newest: synthesisRow({ cycle_slot: SLOT + 300 }),
    });
    await readOfferSnapshot({ profile: 'SCALPER', pinnedSlot: SLOT }, fake);
    expect(calls.synthesis).toHaveLength(2);
    expect((calls.synthesis[1] as { where: unknown }).where).toEqual({
      symbol: 'XAUUSD',
      profile: 'SCALPER',
      cycle_slot: SLOT,
    });
    expect((calls.zones[0] as { where: unknown }).where).toEqual({
      symbol: 'XAUUSD',
      profile: 'SCALPER',
      cycle_slot: SLOT,
    });
  });

  test('another symbol is asked for by name, in every query', async () => {
    const { fake, calls } = client();
    await readOfferSnapshot({ profile: 'DAY_TRADER', symbol: 'EURUSD' }, fake);
    for (const list of [calls.synthesis, calls.zones, calls.cycle]) {
      for (const call of list) {
        expect((call as { where: { symbol: string } }).where.symbol).toBe(
          'EURUSD'
        );
      }
    }
  });
});

describe('readOfferSnapshot: what it returns', () => {
  test('the newest cycle is the pinned one: no refresh candidate, the price of that reading', async () => {
    const { fake } = client();
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.pinned).toEqual({
      cycleSlot: SLOT,
      bias: 'LONG',
      status: 'CAUTIONARY',
      statusReasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
      trendRelation: 'COUNTER_TREND',
      ruleId: 'R1_MACRO_COUNTER_TREND_RALLY',
      branchId: 'BREACH_UP',
      retuning: false,
    });
    expect(snapshot.newest).toBeNull();
    expect(snapshot.price).toBe(PRICE);
    expect(snapshot.flag).toBe('shadow');
    expect(snapshot.zones.map((z) => z.zoneId)).toEqual(['Z1', 'Z2']);
    expect(snapshot.cycle).toEqual({
      slot: BigInt(SLOT),
      storedDataStatus: 'FRESH',
      retuning: false,
      readyAt: BigInt(SLOT + 75),
    });
  });

  test('a pinned cycle that is not the newest: both readings, and the price of the NEWEST (A2)', async () => {
    const newer = synthesisRow({
      cycle_slot: SLOT + 300,
      bias: 'SHORT',
      reference_price: 4360.1,
    });
    const { fake } = client({ newest: newer });
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(snapshot.pinned?.cycleSlot).toBe(SLOT);
    expect(snapshot.pinned?.bias).toBe('LONG');
    expect(snapshot.newest?.cycleSlot).toBe(SLOT + 300);
    expect(snapshot.newest?.bias).toBe('SHORT');
    expect(snapshot.price).toBe(4360.1);
    expect(snapshot.zones.map((z) => z.zoneId)).toEqual(['Z1', 'Z2']);
    expect(snapshot.problems).toEqual([]);
  });

  test('a pinned cycle that is the newest has no newer reading', async () => {
    const { fake } = client();
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(snapshot.newest).toBeNull();
    expect(snapshot.problems).toEqual([]);
  });

  test('RETUNING is read from what the cycle observed', async () => {
    const { fake } = client({
      newest: synthesisRow({ retuning_observed: true }),
    });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.pinned?.retuning).toBe(true);
  });

  test('a reading with no direction and no zones is read as it is', async () => {
    const stand = synthesisRow({
      bias: 'STAND_ASIDE',
      status: 'VALID',
      status_reasons: [],
      trend_relation: null,
      branch_id: null,
      zone_count: 0,
      reference_price: null,
    });
    const { fake } = client({ newest: stand, zones: [] });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.pinned?.bias).toBe('STAND_ASIDE');
    expect(snapshot.pinned?.trendRelation).toBeNull();
    expect(snapshot.zones).toEqual([]);
    expect(snapshot.price).toBeNull();
  });

  test('a cycle with no ready time is read', async () => {
    const { fake } = client({
      cycle: { ...CYCLE, ready_at: null, data_status: null },
    });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.cycle).toEqual({
      slot: BigInt(SLOT),
      storedDataStatus: null,
      retuning: false,
      readyAt: null,
    });
  });

  test('no ready cycle yet', async () => {
    const { fake } = client({ cycle: null });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.cycle).toBeNull();
    expect(snapshot.problems).toEqual([]);
  });
});

describe('readOfferSnapshot: what goes wrong is reported, never thrown', () => {
  test('no reading for the profile at all', async () => {
    const { fake, calls } = client({ newest: null });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(codes(snapshot)).toEqual(['NO_READING']);
    expect(snapshot.pinned).toBeNull();
    expect(snapshot.price).toBeNull();
    expect(snapshot.flag).toBeNull();
    expect(snapshot.zones).toEqual([]);
    // no pinned reading, so no zones were asked for
    expect(calls.zones).toEqual([]);
  });

  test('the pinned cycle has no reading', async () => {
    const { fake, calls } = client({ bySlot: {} });
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(codes(snapshot)).toEqual(['PINNED_READING_MISSING']);
    expect(snapshot.problems[0]?.detail).toContain(String(SLOT));
    expect(snapshot.pinned).toBeNull();
    expect(snapshot.flag).toBeNull();
    expect(calls.zones).toEqual([]);
    // the newest price is still known
    expect(snapshot.price).toBe(PRICE);
  });

  test.each([
    ['newest', 'the newest synthesis reading could not be read: newest down'],
    ['cycle', 'the newest cycle could not be read: cycle down'],
    ['zones', 'the entry zones could not be read: zones down'],
  ] as const)('a database error reading the %s', async (step, detail) => {
    const { fake } = client({}, { [step]: true });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.problems).toContainEqual({
      code: 'DATABASE_ERROR',
      detail,
    });
  });

  test('a database error reading the pinned reading', async () => {
    const { fake } = client({}, { pinned: true });
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(snapshot.problems).toEqual([
      {
        code: 'DATABASE_ERROR',
        detail: 'the pinned synthesis reading could not be read: pinned down',
      },
    ]);
    expect(snapshot.pinned).toBeNull();
  });

  test('every read failing at once still returns', async () => {
    const { fake } = client(
      {},
      { newest: true, pinned: true, zones: true, cycle: true }
    );
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(codes(snapshot)).toEqual([
      'DATABASE_ERROR',
      'DATABASE_ERROR',
      'DATABASE_ERROR',
    ]);
    expect(snapshot.pinned).toBeNull();
    expect(snapshot.newest).toBeNull();
    expect(snapshot.zones).toEqual([]);
    expect(snapshot.price).toBeNull();
    expect(snapshot.cycle).toBeNull();
  });

  test('a rejection that is not an Error is still reported', async () => {
    const fake = client().fake;
    fake.marketCycle.findFirst = () => Promise.reject('down');
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(snapshot.problems).toEqual([
      {
        code: 'DATABASE_ERROR',
        detail: 'the newest cycle could not be read: unknown error',
      },
    ]);
  });

  test.each([
    ['a bias that is not text', { bias: 5 }],
    ['a status that is not text', { status: null }],
    ['reasons that are not a list', { status_reasons: 'MCD0' }],
    ['a reason that is not text', { status_reasons: ['A', 3] }],
    ['a trend relation that is not text', { trend_relation: 7 }],
    ['a rule that is not text', { rule_id: null }],
    ['a branch that is not text', { branch_id: 4 }],
    ['a RETUNING flag that is not a boolean', { retuning_observed: 'no' }],
    ['a cycle slot that is not a time', { cycle_slot: 0 }],
  ])('an unreadable pinned reading (%s)', async (_label, over) => {
    const row = synthesisRow(over as Partial<SynthesisRow>);
    const { fake } = client({ newest: row, bySlot: { [SLOT]: row } });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(codes(snapshot)).toContain('READING_UNREADABLE');
    expect(snapshot.pinned).toBeNull();
  });

  test('an unreadable newer reading is a problem and no refresh candidate', async () => {
    const { fake } = client({
      newest: synthesisRow({
        cycle_slot: SLOT + 300,
        bias: 7 as unknown as string,
      }),
    });
    const snapshot = await readOfferSnapshot(
      { profile: 'DAY_TRADER', pinnedSlot: SLOT },
      fake
    );
    expect(codes(snapshot)).toEqual(['READING_UNREADABLE']);
    expect(snapshot.pinned).not.toBeNull();
    expect(snapshot.newest).toBeNull();
  });

  test('zones are all or none: one unreadable row empties the set', async () => {
    const rows = zoneRows();
    rows[1] = { ...rows[1]!, bias: 'UP' };
    const { fake } = client({ zones: rows });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(codes(snapshot)).toEqual(['ZONES_UNREADABLE']);
    expect(snapshot.zones).toEqual([]);
  });

  test('zones are all or none: a missing row empties the set', async () => {
    const { fake } = client({ zones: zoneRows().slice(0, 1) });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(codes(snapshot)).toEqual(['ZONE_COUNT_MISMATCH']);
    expect(snapshot.problems[0]?.detail).toBe(
      'the reading has 2 zones and 1 were found'
    );
    expect(snapshot.zones).toEqual([]);
  });

  test('zones are all or none: an extra row empties the set', async () => {
    const { fake } = client({ zones: [...zoneRows(), ...zoneRows()] });
    const snapshot = await readOfferSnapshot({ profile: 'DAY_TRADER' }, fake);
    expect(codes(snapshot)).toEqual(['ZONE_COUNT_MISMATCH']);
    expect(snapshot.zones).toEqual([]);
  });
});

describe('what is refused outright', () => {
  test.each(['TRADER', 'OTHER', '', undefined, 'day_trader'])(
    'a profile of %p',
    async (profile) => {
      const { fake, calls } = client();
      await expect(
        readOfferSnapshot({ profile: profile as string }, fake)
      ).rejects.toBeInstanceOf(Engine4InputError);
      expect(calls.synthesis).toEqual([]);
    }
  );

  test.each([0, -300, 1.5])('a pinned slot of %p', async (pinnedSlot) => {
    const { fake, calls } = client();
    await expect(
      readOfferSnapshot({ profile: 'DAY_TRADER', pinnedSlot }, fake)
    ).rejects.toThrow(/pinnedSlot/);
    expect(calls.synthesis).toEqual([]);
  });
});

describe('the snapshot feeds the offer check (the stored 18 Sep cycle)', () => {
  const specs = readBrokerFigures(
    {
      symbol: 'XAUUSD',
      version: 1,
      captured_at: NOW - 3600,
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
    },
    NOW
  );
  const list = {
    schemaVersion: 1 as const,
    listVersion: 1,
    events: [
      { eventId: '900000001', kind: 'CPI' as const, name: 'TEST CPI' },
      { eventId: '900000002', kind: 'CORE_PCE' as const, name: 'TEST PCE' },
      {
        eventId: '900000003',
        kind: 'FOMC_RATE_DECISION' as const,
        name: 'TEST FOMC',
      },
      { eventId: '900000004', kind: 'NFP' as const, name: 'TEST NFP' },
    ],
  };

  async function offer(data: Partial<Data> = {}, pinnedSlot?: number) {
    const { fake } = client(data);
    const snapshot = await readOfferSnapshot(
      pinnedSlot === undefined
        ? { profile: 'DAY_TRADER' }
        : { profile: 'DAY_TRADER', pinnedSlot },
      fake
    );
    return checkOffer({
      nowSeconds: NOW,
      style: 'TREND_FOLLOWING',
      pinned: snapshot.pinned,
      newest: snapshot.newest,
      dataStatus: { status: 'FRESH', dataAsOfSlot: SLOT },
      blackout: checkBlackout({
        nowSeconds: NOW,
        traderType: 'DAY_TRADER',
        list,
        events: [],
        newestCapturedAt: NOW - 600,
      }),
      specs,
      zones: snapshot.zones,
      price: snapshot.price,
    });
  }

  test('is offered, cautionary, with the counter-trend notice', async () => {
    const result = await offer();
    expect(result.verdict).toBe('OFFERED');
    expect(result.halfRiskPreset).toBe(true);
    expect(result.notices.map((n) => n.code)).toEqual([
      'CAUTIONARY',
      'STYLE_COUNTER_TREND',
    ]);
    expect(result.zones).toEqual([
      { zoneId: 'Z1', invalidated: false },
      { zoneId: 'Z2', invalidated: false },
    ]);
  });

  test('a newer cycle that changed the synthesis offers a refresh', async () => {
    const result = await offer(
      { newest: synthesisRow({ cycle_slot: SLOT + 300, bias: 'SHORT' }) },
      SLOT
    );
    expect(result.verdict).toBe('REFRESH_OFFERED');
    expect(result.refresh?.changes).toEqual(['BIAS']);
  });

  test('a newest price past the first zone invalidation marks that zone', async () => {
    const result = await offer({
      newest: synthesisRow({ reference_price: 4350.42 }),
    });
    expect(result.verdict).toBe('OFFERED');
    expect(result.zones.map((z) => [z.zoneId, z.invalidated])).toEqual([
      ['Z1', true],
      ['Z2', false],
    ]);
  });

  test('a snapshot with no reading is not an offer', async () => {
    const result = await offer({ newest: null });
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('SYNTHESIS_UNUSABLE');
  });

  test('a snapshot whose zones were refused is not an offer', async () => {
    const result = await offer({ zones: [] });
    expect(result.verdict).toBe('NOT_OFFERED');
    expect(result.reason?.code).toBe('NO_ZONES');
  });
});
