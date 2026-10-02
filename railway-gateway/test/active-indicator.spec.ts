import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ActiveIndicator,
  ActiveIndicatorService,
} from '../src/cycle/active-indicator/active-indicator.service';
import {
  CHANNEL_SOURCES,
  MAX_REASON_LENGTH,
  MAX_SCHEDULE_AHEAD_SEC,
  MAX_SET_BY_LENGTH,
} from '../src/cycle/active-indicator/channel-sources';
import {
  buildCurrentCycleBody,
  resolutionSlot,
} from '../src/cycle/active-indicator/current-cycle';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { slotOf } from '../src/cycle/slot';
import { FakePrisma, FakeSetting } from './helpers/fake-cycle-store';
import { REFRESH_SLOT, putCycle } from './helpers/reader-world';

/**
 * The active-indicator setting (rule 6, ADR-010): ONE channel indicator per
 * timeframe, effective from a named slot, for MCDs, chart and UI together.
 *
 * The property that matters is the flip: a setting effective from slot T applies
 * to the first cycle at or after T and to no earlier one, for EVERY consumer,
 * because every consumer asks about the slot of the cycle it is working on. The
 * consumers on the gateway side are tested here through the real functions they
 * call; the monolith's route and hook are tested against the same contract (their
 * tests read test/fixtures/cycles-current-*.json, written by this spec's flip
 * test).
 */

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const T = REFRESH_SLOT; // the slot a change takes effect at
const NOW = T - 3600; // an hour before it
const SLOT = 300;

function build(options: { seed?: boolean } = {}) {
  const prisma = new FakePrisma();
  if (options.seed !== false) prisma.seedActiveIndicators();
  const cycles = new CycleReaderService(prisma as unknown as PrismaService);
  const service = new ActiveIndicatorService(
    prisma as unknown as PrismaService,
    cycles
  );
  return { prisma, cycles, service };
}

const sources = (
  r: Record<'M5' | 'M15', ActiveIndicator | null>
): [string | undefined, string | undefined] => [r.M5?.source, r.M15?.source];

describe('the starting values and the lists that must agree', () => {
  it('the migration seeds M15 non_b and M5 best_fit_a from slot 0 (ADR-010), as the tests assume', () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../prisma/migrations/20261002000000_add_cycle_pipeline_tables/migration.sql'
      ),
      'utf8'
    );
    expect(sql).toContain(
      "('seed_active_indicator_m15_non_b', 'M15', 'non_b', 0, 'migration', 'ADR-010 starting value')"
    );
    expect(sql).toContain(
      "('seed_active_indicator_m5_best_fit_a', 'M5', 'best_fit_a', 0, 'migration', 'ADR-010 starting value')"
    );
    const { prisma } = build();
    expect(
      prisma.settings.map((s) => [
        s.timeframe,
        s.source,
        s.effective_slot,
        s.set_by,
      ])
    ).toEqual([
      ['M15', 'non_b', 0, 'migration'],
      ['M5', 'best_fit_a', 0, 'migration'],
    ]);
  });

  it('the channel sources are exactly the ones the Prisma schema documents, in both copies', () => {
    for (const file of [
      '../../prisma/market-data/schema.prisma',
      '../prisma/schema.prisma',
    ]) {
      const schema = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const line = schema
        .split('\n')
        .find((l) => /^\s*source\s+String\s+\/\/ a channel indicator:/.test(l));
      expect(line).toBeDefined();
      const listed = line!
        .split('indicator:')[1]
        .split('(')[0]
        .split('|')
        .map((s) => s.trim());
      expect([...CHANNEL_SOURCES]).toEqual(listed);
    }
  });

  it("they are the monolith's centroid variants plus the fractal EDT", () => {
    const text = fs.readFileSync(
      path.join(__dirname, '../../types/indicator.ts'),
      'utf8'
    );
    const block = text.slice(text.indexOf('export const CENTROID_VARIANTS'));
    const variants = [
      ...block.slice(0, block.indexOf('] as const')).matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect([...CHANNEL_SOURCES]).toEqual([...variants, 'fractal_edt']);
  });
});

describe('resolveActiveIndicator(timeframe, slot): a step function of the slot', () => {
  it('the starting values apply to every slot, from slot 0 on', async () => {
    const { service } = build();
    for (const slot of [0, 300, T, T + 86400]) {
      expect(sources(await service.resolveAll(slot))).toEqual([
        'best_fit_a',
        'non_b',
      ]);
    }
  });

  it('a setting applies from its slot, inclusive, and not before: the slot before it still gets the old source', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    expect((await service.resolveActiveIndicator('M5', T - SLOT))!.source).toBe(
      'best_fit_a'
    );
    expect((await service.resolveActiveIndicator('M5', T))!.source).toBe(
      'cherry_a'
    );
    expect((await service.resolveActiveIndicator('M5', T + SLOT))!.source).toBe(
      'cherry_a'
    );
    expect(
      (await service.resolveActiveIndicator('M5', T + 30 * 86400))!.source
    ).toBe('cherry_a');
  });

  it('the timeframes are independent: changing M5 leaves M15 alone', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    expect(sources(await service.resolveAll(T))).toEqual(['cherry_a', 'non_b']);
    await service.setActiveIndicator(
      {
        timeframe: 'M15',
        source: 'fractal_edt',
        effectiveSlot: T + 3 * SLOT,
        setBy: 'a@x.test',
      },
      NOW
    );
    expect(sources(await service.resolveAll(T + 2 * SLOT))).toEqual([
      'cherry_a',
      'non_b',
    ]);
    expect(sources(await service.resolveAll(T + 3 * SLOT))).toEqual([
      'cherry_a',
      'fractal_edt',
    ]);
  });

  it('a replay of a slot before a change gets the source that was active then', async () => {
    const { service } = build();
    for (const [source, slot] of [
      ['cherry_a', T],
      ['non_a', T + 6 * SLOT],
    ] as const) {
      await service.setActiveIndicator(
        { timeframe: 'M5', source, effectiveSlot: slot, setBy: 'a@x.test' },
        NOW
      );
    }
    const at = async (slot: number) =>
      (await service.resolveActiveIndicator('M5', slot))!.source;
    expect(await at(T - SLOT)).toBe('best_fit_a');
    expect(await at(T + 5 * SLOT)).toBe('cherry_a');
    expect(await at(T + 6 * SLOT)).toBe('non_a');
  });

  it('settings scheduled out of order still resolve by their slots', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'non_a',
        effectiveSlot: T + 6 * SLOT,
        setBy: 'a@x.test',
      },
      NOW
    );
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    const at = async (slot: number) =>
      (await service.resolveActiveIndicator('M5', slot))!.source;
    expect(await at(T + 2 * SLOT)).toBe('cherry_a'); // the one written later but effective earlier
    expect(await at(T + 6 * SLOT)).toBe('non_a');
  });

  it('two settings for the same slot: the last one written wins (which is how a scheduled change is cancelled)', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'best_fit_a',
        effectiveSlot: T,
        setBy: 'b@x.test',
        reason: 'cancelled',
      },
      NOW
    );
    expect((await service.resolveActiveIndicator('M5', T))!.source).toBe(
      'best_fit_a'
    );
    expect((await service.resolveActiveIndicator('M5', T))!.setBy).toBe(
      'b@x.test'
    );
  });

  it('same slot and same write time: decided by id, the same way every time', async () => {
    const { prisma, service } = build();
    const createdAt = new Date(1_790_000_000_000);
    const base = {
      timeframe: 'M5',
      effective_slot: T,
      set_by: 'x',
      reason: null,
      createdAt,
    };
    prisma.settings.push(
      { ...base, id: 'setting_a', source: 'cherry_a' },
      { ...base, id: 'setting_b', source: 'non_a' }
    );
    expect((await service.resolveActiveIndicator('M5', T))!.settingId).toBe(
      'setting_b'
    );
    prisma.settings.reverse();
    expect((await service.resolveActiveIndicator('M5', T))!.settingId).toBe(
      'setting_b'
    );
  });

  it('agrees with an independent oracle over many settings and slots', async () => {
    const { prisma, service } = build();
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let i = 0; i < 60; i++) {
      const row: FakeSetting = {
        id: `r${i}`,
        timeframe: i % 3 === 0 ? 'M15' : 'M5',
        source: CHANNEL_SOURCES[rand(CHANNEL_SOURCES.length)],
        effective_slot: T + rand(20) * SLOT,
        set_by: 'oracle',
        reason: null,
        createdAt: new Date(1_790_000_000_000 + rand(8) * 1000),
      };
      prisma.settings.push(row);
    }
    const oracle = (timeframe: string, slot: number) =>
      prisma.settings
        .filter((r) => r.timeframe === timeframe && r.effective_slot <= slot)
        .sort(
          (a, b) =>
            b.effective_slot - a.effective_slot ||
            b.createdAt.getTime() - a.createdAt.getTime() ||
            (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
        )[0];
    for (const timeframe of ['M5', 'M15'] as const) {
      for (let k = -2; k < 24; k++) {
        const slot = T + k * SLOT;
        expect(
          (await service.resolveActiveIndicator(timeframe, slot))!.settingId
        ).toBe(oracle(timeframe, slot).id);
      }
    }
  });

  it('a timeframe with no setting at all is null (unknown), never a guess', async () => {
    const { service } = build({ seed: false });
    expect(await service.resolveActiveIndicator('M5', T)).toBeNull();
    expect(await service.resolveAll(T)).toEqual({ M5: null, M15: null });
  });

  it('asks the database for the greatest effective slot at or before the slot, newest write first, with the audit columns', async () => {
    const { prisma, service } = build();
    await service.resolveActiveIndicator('M15', T);
    const [query] = prisma.queries('activeIndicatorSetting', 'findFirst');
    expect(query.args).toEqual({
      where: { timeframe: 'M15', effective_slot: { lte: T } },
      orderBy: [
        { effective_slot: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        id: true,
        timeframe: true,
        source: true,
        effective_slot: true,
        set_by: true,
        reason: true,
        createdAt: true,
      },
    });
  });

  it('reports who set it and why', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'admin@x.test',
        reason: 'tighter channel',
      },
      NOW
    );
    expect(await service.resolveActiveIndicator('M5', T)).toMatchObject({
      timeframe: 'M5',
      source: 'cherry_a',
      effectiveSlot: T,
      setBy: 'admin@x.test',
      reason: 'tighter channel',
    });
    expect(
      (await service.resolveActiveIndicator('M5', T - SLOT))!
    ).toMatchObject({
      setBy: 'migration',
      reason: 'ADR-010 starting value',
    });
  });

  it.each([
    ['a slot that is "now", not a boundary', 'M5', T + 1],
    ['a float', 'M5', T + 0.5],
    ['a negative slot', 'M5', -300],
    ['an unknown timeframe', 'H1', T],
  ])(
    'a caller bug throws and reads nothing: %s',
    async (_label, timeframe, slot) => {
      const { prisma, service } = build();
      await expect(
        service.resolveActiveIndicator(timeframe as 'M5', slot)
      ).rejects.toThrow(RangeError);
      expect(prisma.queryLog).toHaveLength(0);
    }
  );
});

describe('the audited setter: only a future slot, only a real source, appended and logged', () => {
  const NOW_SLOT = slotOf(NOW);
  const ok = {
    timeframe: 'M5' as const,
    source: 'cherry_a' as const,
    setBy: 'admin@x.test',
  };

  it('appends one row that says who, why and when, and returns it', async () => {
    const { prisma, service } = build();
    const before = prisma.settings.length;
    const result = await service.setActiveIndicator(
      {
        ...ok,
        effectiveSlot: NOW_SLOT + 2 * SLOT,
        setBy: '  admin@x.test ',
        reason: 'rehearsal',
      },
      NOW
    );
    expect(result.status).toBe('SET');
    expect(prisma.settings).toHaveLength(before + 1);
    const row = prisma.settings[prisma.settings.length - 1];
    expect(row).toMatchObject({
      timeframe: 'M5',
      source: 'cherry_a',
      effective_slot: NOW_SLOT + 2 * SLOT,
      set_by: 'admin@x.test', // trimmed
      reason: 'rehearsal',
    });
    expect(row.createdAt).toBeInstanceOf(Date);
    if (result.status === 'SET') {
      expect(result.setting).toMatchObject({
        settingId: row.id,
        source: 'cherry_a',
        setBy: 'admin@x.test',
      });
    }
  });

  it('logs the change with who made it', async () => {
    const { service } = build();
    const log = jest.spyOn(Logger.prototype, 'log');
    await service.setActiveIndicator(
      { ...ok, effectiveSlot: NOW_SLOT + SLOT, reason: 'because' },
      NOW
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('M5 -> cherry_a from slot')
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('admin@x.test'));
  });

  it('never touches what is already there: history only grows', async () => {
    const { prisma, service } = build();
    await service.setActiveIndicator(
      { ...ok, effectiveSlot: NOW_SLOT + SLOT },
      NOW
    );
    const frozen = JSON.stringify(prisma.settings);
    await service.setActiveIndicator(
      { ...ok, source: 'non_a', effectiveSlot: NOW_SLOT + 2 * SLOT },
      NOW
    );
    expect(
      JSON.stringify(prisma.settings).startsWith(frozen.slice(0, -1))
    ).toBe(true);
    expect(prisma.settings).toHaveLength(4);
  });

  describe('future slots only', () => {
    it('the current slot and every earlier one are refused, with nothing written', async () => {
      const { prisma, service } = build();
      for (const slot of [NOW_SLOT, NOW_SLOT - SLOT, T - 86400, 0]) {
        const result = await service.setActiveIndicator(
          { ...ok, effectiveSlot: slot },
          NOW
        );
        expect(result).toMatchObject({
          status: 'REFUSED',
          reason: 'SLOT_NOT_FUTURE',
        });
      }
      expect(prisma.settings).toHaveLength(2); // only the seeds
      expect(prisma.queries('activeIndicatorSetting', 'create')).toHaveLength(
        0
      );
    });

    it('the next slot is the earliest that can be set: exactly one slot ahead is accepted', async () => {
      const { service } = build();
      expect(await service.earliestSettableSlot(NOW)).toBe(NOW_SLOT + SLOT);
      expect(
        (
          await service.setActiveIndicator(
            { ...ok, effectiveSlot: NOW_SLOT + SLOT },
            NOW
          )
        ).status
      ).toBe('SET');
    });

    it('the boundary holds at every second of the current slot', async () => {
      const { service } = build();
      for (const offset of [0, 1, 150, 299]) {
        const now = NOW_SLOT + offset;
        expect(await service.earliestSettableSlot(now)).toBe(NOW_SLOT + SLOT);
      }
      expect(await service.earliestSettableSlot(NOW_SLOT + SLOT)).toBe(
        NOW_SLOT + 2 * SLOT
      );
    });

    it('a newest READY cycle AHEAD of the gateway clock raises the floor (a slot already served cannot change)', async () => {
      const { prisma, service } = build();
      putCycle(prisma, NOW_SLOT + 4 * SLOT); // the VPS clock is ahead of the gateway's
      expect(await service.earliestSettableSlot(NOW)).toBe(NOW_SLOT + 5 * SLOT);
      expect(
        await service.setActiveIndicator(
          { ...ok, effectiveSlot: NOW_SLOT + 4 * SLOT },
          NOW
        )
      ).toMatchObject({ status: 'REFUSED', reason: 'SLOT_NOT_FUTURE' });
      expect(
        (
          await service.setActiveIndicator(
            { ...ok, effectiveSlot: NOW_SLOT + 5 * SLOT },
            NOW
          )
        ).status
      ).toBe('SET');
    });

    it('a cycle that is not READY does not move the floor', async () => {
      const { prisma, service } = build();
      putCycle(prisma, NOW_SLOT + 4 * SLOT, {
        state: 'PENDING',
        data_status: null,
        ready_at: null,
      });
      expect(await service.earliestSettableSlot(NOW)).toBe(NOW_SLOT + SLOT);
    });
  });

  describe('a slot on a boundary, not absurdly far ahead', () => {
    it.each([[1], [2], [150], [299]])(
      '%s second(s) past a boundary is refused',
      async (offset) => {
        const { service } = build();
        expect(
          await service.setActiveIndicator(
            { ...ok, effectiveSlot: NOW_SLOT + 2 * SLOT + offset },
            NOW
          )
        ).toMatchObject({ status: 'REFUSED', reason: 'SLOT_NOT_ON_BOUNDARY' });
      }
    );

    it('a fractional or non-numeric slot is refused', async () => {
      const { service } = build();
      for (const slot of [
        NOW_SLOT + 2 * SLOT + 0.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        '123' as never,
      ]) {
        expect(
          await service.setActiveIndicator({ ...ok, effectiveSlot: slot }, NOW)
        ).toMatchObject({
          status: 'REFUSED',
          reason: 'SLOT_NOT_ON_BOUNDARY',
        });
      }
    });

    it('up to a week ahead is accepted, one slot beyond is refused', async () => {
      const { service } = build();
      const farthest = Math.floor((NOW + MAX_SCHEDULE_AHEAD_SEC) / SLOT) * SLOT;
      expect(
        (
          await service.setActiveIndicator(
            { ...ok, effectiveSlot: farthest },
            NOW
          )
        ).status
      ).toBe('SET');
      expect(
        await service.setActiveIndicator(
          { ...ok, effectiveSlot: farthest + SLOT },
          NOW
        )
      ).toMatchObject({ status: 'REFUSED', reason: 'SLOT_TOO_FAR' });
    });

    it('a millisecond timestamp, the classic mistake, is refused', async () => {
      const { service } = build();
      expect(
        await service.setActiveIndicator(
          { ...ok, effectiveSlot: 1_790_000_000_100 },
          NOW
        )
      ).toMatchObject({ status: 'REFUSED', reason: 'SLOT_TOO_FAR' });
    });
  });

  describe('a real source and timeframe, a named author', () => {
    const slot = NOW_SLOT + 2 * SLOT;

    it.each(CHANNEL_SOURCES.map((s) => [s]))(
      '%s is accepted',
      async (source) => {
        const { service } = build();
        expect(
          (
            await service.setActiveIndicator(
              { ...ok, source, effectiveSlot: slot },
              NOW
            )
          ).status
        ).toBe('SET');
      }
    );

    it.each([
      ['bestfit_a'],
      ['fractal'],
      ['resistance'],
      ['support'],
      ['sr_levels'],
      [''],
      ['BEST_FIT_A'],
    ])(
      'the source %p is refused (a statistics source that is not a channel indicator, or a typo)',
      async (source) => {
        const { prisma, service } = build();
        expect(
          await service.setActiveIndicator(
            { ...ok, source: source as 'non_b', effectiveSlot: slot },
            NOW
          )
        ).toMatchObject({ status: 'REFUSED', reason: 'UNKNOWN_SOURCE' });
        expect(prisma.settings).toHaveLength(2);
      }
    );

    it.each([['H1'], ['m5'], ['']])(
      'the timeframe %p is refused',
      async (timeframe) => {
        const { service } = build();
        expect(
          await service.setActiveIndicator(
            { ...ok, timeframe: timeframe as 'M5', effectiveSlot: slot },
            NOW
          )
        ).toMatchObject({ status: 'REFUSED', reason: 'UNKNOWN_TIMEFRAME' });
      }
    );

    it('an author is required, and not just spaces', async () => {
      const { service } = build();
      for (const setBy of ['', '   ', undefined as never]) {
        expect(
          await service.setActiveIndicator(
            { ...ok, setBy, effectiveSlot: slot },
            NOW
          )
        ).toMatchObject({
          status: 'REFUSED',
          reason: 'MISSING_SET_BY',
        });
      }
    });

    it('the author and the reason have limits', async () => {
      const { service } = build();
      expect(
        await service.setActiveIndicator(
          {
            ...ok,
            setBy: 'x'.repeat(MAX_SET_BY_LENGTH + 1),
            effectiveSlot: slot,
          },
          NOW
        )
      ).toMatchObject({ reason: 'SET_BY_TOO_LONG' });
      expect(
        await service.setActiveIndicator(
          {
            ...ok,
            reason: 'x'.repeat(MAX_REASON_LENGTH + 1),
            effectiveSlot: slot,
          },
          NOW
        )
      ).toMatchObject({ reason: 'REASON_TOO_LONG' });
      expect(
        (
          await service.setActiveIndicator(
            {
              ...ok,
              setBy: 'x'.repeat(MAX_SET_BY_LENGTH),
              reason: 'y'.repeat(MAX_REASON_LENGTH),
              effectiveSlot: slot,
            },
            NOW
          )
        ).status
      ).toBe('SET');
    });
  });

  it('listSettings is the audit trail: every row, newest effective slot first, a limit, one timeframe', async () => {
    const { service } = build();
    await service.setActiveIndicator(
      { ...ok, effectiveSlot: NOW_SLOT + 2 * SLOT },
      NOW
    );
    await service.setActiveIndicator(
      {
        ...ok,
        timeframe: 'M15',
        source: 'non_a',
        effectiveSlot: NOW_SLOT + 4 * SLOT,
      },
      NOW
    );
    const all = await service.listSettings();
    expect(all.map((s) => [s.timeframe, s.source, s.setBy])).toEqual([
      ['M15', 'non_a', 'admin@x.test'],
      ['M5', 'cherry_a', 'admin@x.test'],
      // the two seeds tie on slot and time: the id breaks it, the same way every time
      ['M5', 'best_fit_a', 'migration'],
      ['M15', 'non_b', 'migration'],
    ]);
    expect(
      (await service.listSettings({ timeframe: 'M5' })).map((s) => s.source)
    ).toEqual(['cherry_a', 'best_fit_a']);
    expect(await service.listSettings({ limit: 1 })).toHaveLength(1);
    expect(await service.listSettings({ limit: 0 })).toHaveLength(1); // clamped up to 1
    expect(await service.listSettings({ limit: 10_000 })).toHaveLength(4);
  });

  it('the service has no way to change or delete a setting (source guard)', () => {
    const source = fs
      .readFileSync(
        path.join(
          __dirname,
          '../src/cycle/active-indicator/active-indicator.service.ts'
        ),
        'utf8'
      )
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    const calls = [
      ...source.matchAll(/activeIndicatorSetting\s*\.\s*(\w+)/g),
    ].map((m) => m[1]);
    expect(calls.sort()).toEqual(['create', 'findFirst', 'findMany']);
  });
});

describe('setting at slot T flips every consumer together at T, and not before', () => {
  // The consumers on the gateway side, each through the function it really calls:
  //   - the sensor-input loader (step 3): resolveAll(slot of the cycle-ready job)
  //   - the VPS renderer and the monolith: GET /api/v1/cycles/current, built from the
  //     newest READY cycle and the setting in force at THAT cycle's slot
  async function consumersAt(
    ctx: ReturnType<typeof build>,
    cycleSlot: number
  ): Promise<Array<[string, [string | undefined, string | undefined]]>> {
    const cycle = await ctx.cycles.getReadyCycle(cycleSlot);
    const loader = sources(await ctx.service.resolveAll(cycleSlot));
    const endpoint = buildCurrentCycleBody({
      now: cycleSlot + 70,
      cycle,
      indicators: await ctx.service.resolveAll(
        resolutionSlot(cycleSlot + 70, cycle).slot
      ),
    });
    return [
      ['sensor-input loader', loader],
      [
        'cycles/current (renderer, monolith)',
        sources(endpoint.activeIndicators.byTimeframe),
      ],
    ];
  }

  it('M5 best_fit_a -> cherry_a at T: both consumers see the old source up to T - 300 and the new one from T', async () => {
    const ctx = build();
    await ctx.service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'admin@x.test',
        reason: 'rehearsal',
      },
      NOW
    );
    for (const k of [-6, -3, -2, -1, 0, 1, 2, 10]) {
      putCycle(ctx.prisma, T + k * SLOT);
    }
    for (const k of [-6, -3, -2, -1]) {
      for (const [consumer, got] of await consumersAt(ctx, T + k * SLOT)) {
        expect([consumer, got]).toEqual([consumer, ['best_fit_a', 'non_b']]);
      }
    }
    for (const k of [0, 1, 2, 10]) {
      for (const [consumer, got] of await consumersAt(ctx, T + k * SLOT)) {
        expect([consumer, got]).toEqual([consumer, ['cherry_a', 'non_b']]);
      }
    }
  });

  it('a setting that is still in the future changes nothing for any cycle that exists', async () => {
    const ctx = build();
    putCycle(ctx.prisma, T - SLOT);
    await ctx.service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'non_a',
        effectiveSlot: T,
        setBy: 'admin@x.test',
      },
      NOW
    );
    for (const [consumer, got] of await consumersAt(ctx, T - SLOT)) {
      expect([consumer, got]).toEqual([consumer, ['best_fit_a', 'non_b']]);
    }
  });

  it('the endpoint reports the setting of the cycle it reports, not of the wall clock', async () => {
    const ctx = build();
    await ctx.service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    putCycle(ctx.prisma, T - SLOT); // the newest READY cycle is the one BEFORE T
    const cycle = await ctx.cycles.getNewestReadyCycle();
    // the wall clock is long past T, but the cycle consumers are working on is T - 300
    const now = T + 86400;
    const body = buildCurrentCycleBody({
      now,
      cycle,
      indicators: await ctx.service.resolveAll(resolutionSlot(now, cycle).slot),
    });
    expect(body.activeIndicators).toMatchObject({
      resolvedAtSlot: T - SLOT,
      basis: 'CYCLE',
    });
    expect(body.activeIndicators.byTimeframe.M5!.source).toBe('best_fit_a');
  });

  it('with no cycle at all the wall-clock slot is used, and the answer says so', async () => {
    const ctx = build();
    await ctx.service.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'a@x.test',
      },
      NOW
    );
    const now = T + 100;
    const body = buildCurrentCycleBody({
      now,
      cycle: null,
      indicators: await ctx.service.resolveAll(resolutionSlot(now, null).slot),
    });
    expect(body.cycle).toBeNull();
    expect(body.activeIndicators).toMatchObject({
      resolvedAtSlot: T,
      basis: 'WALL_CLOCK',
    });
    expect(body.activeIndicators.byTimeframe.M5!.source).toBe('cherry_a');
  });
});
