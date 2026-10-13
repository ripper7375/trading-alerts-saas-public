/**
 * @jest-environment node
 */

/**
 * The intake readers against a REAL PostgreSQL (build step 6, part 4): the snapshot reader
 * (`lib/intake/read/snapshot.ts`) and the events reader (`lib/intake/read/events.ts`) run for
 * real, with the real generated market Prisma client and the real tables, CHECK constraints and
 * unique keys of the migration files
 *   20260910120000_add_economic_events
 *   20261002000000_add_cycle_pipeline_tables
 *   20261003000000_add_sensor_tables
 *   20261004000000_add_synthesis_tables.
 * Only the gateway is replaced (the scratch database has no gateway): its answer is made from
 * the stored world, as in the unit tests.
 *
 * What it adds to `__tests__/lib/intake/read/`, which runs the same readers on a fake client:
 *  1. the fake client answers EXACTLY as PostgreSQL does: the snapshot of every golden scenario
 *     and every stored cycle, for both trader types, is equal through the database and through
 *     the fake (the 300 tests of the unit suites rest on that fake);
 *  2. the `flag = 'live'` filter works in the database: a shadow sensor and a shadow synthesis
 *     reading never reach the board, and because the unique key leaves room for ONE row per
 *     sensor and cycle, a live row cannot hide behind a shadow row;
 *  3. the unique keys refuse a second row; a live sensor with no row for the slot (or only a
 *     shadow one) becomes ABSENT, said out loud;
 *  4. what the database does not check, the reader does: an `mcd_outputs` row whose envelope
 *     does not hash to its stored hash (no CHECK covers it) is listed as ABSENT; `entry_zones`
 *     rows that disagree with the stored zones document make the reading unusable;
 *  5. the database refuses a synthesis reading whose text does not hash to its stored hash;
 *  6. with the gateway down, the newest READY cycle of `market_cycles` gives the slot;
 *  7. the news calendar over the real append-only `economic_events` table, with the real
 *     `distinct` query: a rescheduled release, the HIGH filter, the order, the age.
 *
 * SKIPPED unless BOTH are set (the same two variables and the same recipe as
 * __tests__/engine4/engine4-tables.pg.spec.ts, see its header and
 * .claude/architecture/database-traps.md):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of entry_zones, synthesis_readings,
 *                        mcd_outputs, market_cycles and economic_events in that database
 *
 * To run it on a throwaway database:
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and
 *      create an empty database;
 *   2. apply the four MIGRATION FILES themselves, in the order above, with
 *      `psql -v ON_ERROR_STOP=1 -d <db> -f <file>` (a `migrate diff` of the schema has no CHECK
 *      constraints, and the first test below fails if they are missing);
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/intake/intake-readers.pg.spec.ts' --coverage=false
 *   4. stop and remove the instance.
 */

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

// the real market client, pointed at the scratch database
jest.mock('@/lib/db/market-prisma', () => {
  if (
    process.env['CYCLE_PG_URL'] === undefined ||
    process.env['CYCLE_PG_ALLOW_WIPE'] !== 'yes'
  ) {
    return { __esModule: true, marketPrisma: {} };
  }
  const { PrismaClient } = require('.prisma/market-client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  return {
    __esModule: true,
    marketPrisma: new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env['CYCLE_PG_URL'] }),
    }),
  };
});

import { marketPrisma } from '@/lib/db/market-prisma';
import {
  EVENTS_MAX_ITEMS,
  validatePacket,
  type TraderType,
} from '@/lib/intake';
import { readUpcomingEvents } from '@/lib/intake/read/events';
import {
  defaultSnapshotDeps,
  readSnapshot,
  type SnapshotDeps,
} from '@/lib/intake/read/snapshot';

import { runWorld } from '../lib/intake/helpers/assemble';
import {
  depsFor,
  gatewayBody,
  goldenWorlds,
  rosterWith,
  storedWorlds,
  type World,
} from '../lib/intake/helpers/world';
import {
  calendarRow,
  cycleRow,
  mcdRow,
  readingRow,
  zoneRows,
  type Doc,
} from './helpers/rows';

const GOLDEN = goldenWorlds();
const STORED = storedWorlds();
const TRADERS: TraderType[] = ['DAY_TRADER', 'SCALPER'];

/** What the database said when it refused a write: Prisma's error code and message. */
async function refusal(
  write: Promise<unknown>
): Promise<{ code: string | undefined; message: string }> {
  try {
    await write;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code, message: String(e.message) };
  }
  throw new Error('expected the database to refuse this write, but it did not');
}

/** The real client behind the reader, with the gateway answering from the world. */
function realDeps(world: World, gateway?: () => Promise<never>): SnapshotDeps {
  return {
    ...defaultSnapshotDeps(),
    fetchCurrentCycle: gateway ?? (async () => gatewayBody(world)),
  };
}

suite('the intake readers on a real PostgreSQL', () => {
  jest.setTimeout(180_000);

  const db = (): any => marketPrisma;

  const wipe = async () => {
    for (const table of [
      'entry_zones',
      'synthesis_readings',
      'mcd_outputs',
      'market_cycles',
      'economic_events',
    ]) {
      await db().$executeRawUnsafe(`DELETE FROM ${table}`);
    }
  };

  async function seed(
    world: World,
    options: {
      sensor?: (row: Doc) => Doc;
      reading?: (row: Doc) => Doc;
      zones?: (row: Doc) => Doc;
      only?: { sensors?: string[]; profiles?: string[] };
    } = {}
  ): Promise<void> {
    const sensors = world.sensors.filter(
      (s) =>
        options.only?.sensors === undefined ||
        options.only.sensors.includes(s.mcd_id)
    );
    await db().mcdOutput.createMany({
      data: sensors.map((s) =>
        (options.sensor ?? ((r) => r))(mcdRow(world, s))
      ),
    });
    for (const row of world.synthesis) {
      if (
        options.only?.profiles !== undefined &&
        !options.only.profiles.includes(row.profile)
      )
        continue;
      await db().synthesisReading.create({
        data: (options.reading ?? ((r) => r))(readingRow(world, row)),
      });
      if (row.zone_count > 0) {
        await db().entryZone.createMany({
          data: zoneRows(world, row).map((z) =>
            (options.zones ?? ((r) => r))(z)
          ),
        });
      }
    }
  }

  beforeAll(async () => {
    await db().$connect();
  });
  afterAll(async () => {
    await db().$disconnect();
  });
  beforeEach(wipe);

  // -------------------------------------------------------------------------------------

  it('was made from the migration files: the tables, the unique keys and the CHECK constraints exist', async () => {
    const tables = await db().$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('mcd_outputs','synthesis_readings','entry_zones','market_cycles','economic_events')
        ORDER BY 1`
    );
    expect(tables.map((t: any) => t.table_name)).toEqual([
      'economic_events',
      'entry_zones',
      'market_cycles',
      'mcd_outputs',
      'synthesis_readings',
    ]);
    const unique = await db().$queryRawUnsafe(
      `SELECT tablename, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE INDEX%'
          AND tablename IN ('mcd_outputs','synthesis_readings') AND indexname NOT LIKE '%pkey'
        ORDER BY tablename`
    );
    expect(
      unique.map((i: any) => [
        i.tablename,
        i.indexdef.replace(/^.* USING /, ''),
      ])
    ).toEqual([
      ['mcd_outputs', 'btree (symbol, cycle_slot, mcd_id)'],
      ['synthesis_readings', 'btree (symbol, cycle_slot, profile)'],
    ]);
    const checks = await db().$queryRawUnsafe(
      `SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
          AND conrelid IN ('mcd_outputs'::regclass, 'synthesis_readings'::regclass)
        ORDER BY 1`
    );
    const names = checks.map((c: any) => c.conname);
    expect(names).toContain('mcd_outputs_flag_is_shadow_or_live');
    expect(names).toContain('mcd_outputs_reason_lists_not_null');
    expect(
      names.filter((n: string) => n.startsWith('synthesis_readings_')).length
    ).toBe(11);
  });

  describe('the database answers as the fake client does', () => {
    it('gives the same snapshot for the 16 golden scenarios, both trader types', async () => {
      for (const world of GOLDEN) await seed(world);
      let compared = 0;
      for (const world of GOLDEN) {
        for (const traderType of TRADERS) {
          const real = await readSnapshot({ traderType }, realDeps(world));
          const fake = await readSnapshot({ traderType }, depsFor(world).deps);
          expect(real.problems).toEqual([]);
          expect(real).toEqual(fake);
          compared += 1;
        }
      }
      expect(compared).toBe(32);
    });

    it('gives the same snapshot for the 3 stored cycles, both trader types', async () => {
      for (const world of STORED) await seed(world);
      for (const world of STORED) {
        for (const traderType of TRADERS) {
          const real = await readSnapshot({ traderType }, realDeps(world));
          const fake = await readSnapshot({ traderType }, depsFor(world).deps);
          expect(real.problems).toEqual([]);
          expect(real).toEqual(fake);
          expect(real.synthesis?.reading_sha256).toBeDefined();
        }
      }
    });

    it('gives the same board, route and packet, and the validator accepts the packet', async () => {
      for (const world of GOLDEN) await seed(world);
      for (const world of GOLDEN.slice(0, 6)) {
        for (const traderType of TRADERS) {
          const real = await readSnapshot({ traderType }, realDeps(world));
          const run = await runWorld(world, traderType, 'DIRECTION');
          expect(real.live_ids).toEqual(run.snapshot.live_ids);
          expect(validatePacket(run.packet).ok).toBe(true);
        }
      }
    });
  });

  describe("only the rows with flag = 'live' reach the board", () => {
    const world = GOLDEN.find((w) => w.name.startsWith('04-'))!;

    it('leaves a shadow sensor and a shadow synthesis reading out', async () => {
      await seed(world, {
        sensor: (row) =>
          row['mcd_id'] === 'MCD3' ? { ...row, flag: 'shadow' } : row,
        reading: (row) =>
          row['profile'] === 'DAY_TRADER' ? { ...row, flag: 'shadow' } : row,
      });
      const dt = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world)
      );
      expect(dt.live_ids).toEqual(['MCD1', 'MCD2']);
      expect(Object.keys(dt.rows)).toEqual(['MCD1', 'MCD2']);
      expect(dt.synthesis).toBeNull();
      expect(dt.problems).toEqual([]);
      // the Scalper’s row is live, so the Scalper has a synthesis reading and the same two sensors
      const sc = await readSnapshot({ traderType: 'SCALPER' }, realDeps(world));
      expect(sc.synthesis?.profile).toBe('SCALPER');
      expect(sc.live_ids).toEqual(['MCD1', 'MCD2']);
    });

    it('shows nothing live from a cycle written entirely in shadow', async () => {
      await seed(world, {
        sensor: (row) => ({ ...row, flag: 'shadow' }),
        reading: (row) => ({ ...row, flag: 'shadow' }),
      });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world)
      );
      expect(snapshot.live_ids).toEqual([]);
      expect(snapshot.rows).toEqual({});
      expect(snapshot.synthesis).toBeNull();
      expect(snapshot.data.flags).toEqual(['SENSORS_NOT_LIVE']);
    });

    it('refuses a flag that is neither shadow nor live, and `off`, in the table itself', async () => {
      for (const flag of ['off', 'LIVE', '']) {
        const outcome = await refusal(
          db().mcdOutput.create({
            data: mcdRow(world, world.sensors[0]!, { flag }),
          })
        );
        expect(outcome.message).toContain('mcd_outputs_flag_is_shadow_or_live');
      }
    });
  });

  describe('the unique keys leave room for one row per sensor (or reading) per cycle', () => {
    const world = GOLDEN.find((w) => w.name.startsWith('04-'))!;

    it('refuses a second row of one sensor for one cycle, live or shadow', async () => {
      await seed(world);
      const sensor = world.sensors[0]!;
      for (const flag of ['live', 'shadow']) {
        const outcome = await refusal(
          db().mcdOutput.create({ data: mcdRow(world, sensor, { flag }) })
        );
        expect(outcome.code).toBe('P2002');
      }
      // so a live row can never be hidden behind a shadow one: the cycle holds one row per sensor
      const rows = await db().mcdOutput.findMany({
        where: {
          symbol: 'XAUUSD',
          cycle_slot: world.slot,
          mcd_id: sensor.mcd_id,
        },
      });
      expect(rows).toHaveLength(1);
    });

    it('refuses a second reading of one trader type for one cycle', async () => {
      await seed(world);
      const row = world.synthesis[0]!;
      const outcome = await refusal(
        db().synthesisReading.create({
          data: readingRow(world, row, { flag: 'shadow' }),
        })
      );
      expect(outcome.code).toBe('P2002');
    });
  });

  describe('a live sensor with no row for the cycle is ABSENT', () => {
    const world = GOLDEN.find((w) => w.name.startsWith('04-'))!;
    const live = rosterWith({ MCD1: 'live', MCD2: 'live', MCD3: 'live' });

    it('lists the missing sensor and still gives the others', async () => {
      await seed(world, { only: { sensors: ['MCD1', 'MCD2'] } });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER', roster: live },
        realDeps(world)
      );
      expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
      expect(Object.keys(snapshot.rows)).toEqual(['MCD1', 'MCD2']);
      const run = await runWorld(
        { ...world, sensors: world.sensors.filter((s) => s.mcd_id !== 'MCD3') },
        'DAY_TRADER',
        'DIRECTION',
        { roster: live }
      );
      expect(run.board.board.sensors.map((l) => [l.mcd_id, l.status])).toEqual([
        ['MCD1', 'VALID'],
        ['MCD2', 'VALID'],
        ['MCD3', 'ABSENT'],
      ]);
    });

    it('treats a sensor that has only a shadow row as absent too', async () => {
      await seed(world, {
        sensor: (row) =>
          row['mcd_id'] === 'MCD3' ? { ...row, flag: 'shadow' } : row,
      });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER', roster: live },
        realDeps(world)
      );
      expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
      expect(snapshot.rows['MCD3']).toBeUndefined();
      expect(snapshot.problems).toEqual([]);
    });
  });

  describe('what the database does not check, the reader does', () => {
    const world = GOLDEN.find((w) => w.name.startsWith('01-'))!;

    it('lists a sensor whose envelope does not hash to its stored hash as ABSENT (no CHECK covers it)', async () => {
      await seed(world, {
        sensor: (row) =>
          row['mcd_id'] === 'MCD2'
            ? { ...row, envelope_sha256: '0'.repeat(64) }
            : row,
      });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world)
      );
      expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
      expect(Object.keys(snapshot.rows)).toEqual(['MCD1', 'MCD3']);
      expect(snapshot.problems).toEqual([
        {
          code: 'ROW_UNREADABLE',
          detail: 'MCD2: the stored envelope does not hash to its stored hash',
        },
      ]);
    });

    it('does not use a reading whose entry_zones rows are not the stored zones', async () => {
      await seed(world);
      await db().$executeRawUnsafe(
        `UPDATE entry_zones SET low = low - 0.01
          WHERE symbol = 'XAUUSD' AND cycle_slot = ${world.slot} AND profile = 'DAY_TRADER' AND zone_id = 'Z1'`
      );
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world)
      );
      expect(snapshot.synthesis).toBeNull();
      expect(snapshot.problems.map((p) => p.code)).toEqual(['ZONES_MISMATCH']);
      // the Scalper’s zones were not touched
      expect(
        (await readSnapshot({ traderType: 'SCALPER' }, realDeps(world)))
          .problems
      ).toEqual([]);
    });

    it('does not use a reading when a zone row is missing', async () => {
      await seed(world);
      await db().$executeRawUnsafe(
        `DELETE FROM entry_zones WHERE symbol = 'XAUUSD' AND cycle_slot = ${world.slot} AND profile = 'DAY_TRADER' AND zone_id = 'Z2'`
      );
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world)
      );
      expect(snapshot.synthesis).toBeNull();
      expect(snapshot.problems.map((p) => p.code)).toEqual(['ZONES_MISMATCH']);
    });

    it('is protected by the table from a reading whose text does not hash to its hash', async () => {
      const row = world.synthesis[0]!;
      const outcome = await refusal(
        db().synthesisReading.create({
          data: readingRow(world, row, { reading_sha256: '0'.repeat(64) }),
        })
      );
      expect(outcome.message).toMatch(/synthesis_readings_/);
      expect(await db().synthesisReading.count()).toBe(0);
    });
  });

  describe('with the gateway down', () => {
    const world = GOLDEN.find((w) => w.name.startsWith('04-'))!;
    const down = async (): Promise<never> => {
      throw Object.assign(new Error('the gateway could not be reached'), {
        kind: 'UNREACHABLE',
      });
    };

    it('takes the slot from the newest READY cycle of market_cycles, not a newer one that is not ready', async () => {
      await seed(world);
      await db().marketCycle.createMany({
        data: [
          cycleRow(world.slot - 600, 'READY'),
          cycleRow(world.slot, 'READY'),
          cycleRow(world.slot + 300, 'PENDING'),
        ],
      });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world, down)
      );
      expect(snapshot.data.status).toBe('UNKNOWN');
      expect(snapshot.data.flags).toEqual(['GATEWAY_UNREACHABLE']);
      expect(snapshot.data.cycle_slot).toBe(world.slotIso);
      expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
      expect(snapshot.problems.map((p) => p.code)).toEqual([
        'GATEWAY_UNREACHABLE',
      ]);
    });

    it('has no slot when market_cycles holds no ready cycle', async () => {
      await seed(world);
      await db().marketCycle.create({ data: cycleRow(world.slot, 'PENDING') });
      const snapshot = await readSnapshot(
        { traderType: 'DAY_TRADER' },
        realDeps(world, down)
      );
      expect(snapshot.data).toMatchObject({
        status: 'UNKNOWN',
        cycle_slot: null,
      });
      expect(snapshot.rows).toEqual({});
    });
  });

  describe('the news calendar over the append-only table', () => {
    const NOW = 1_790_000_000;
    const HOUR = 3600;

    const seedCalendar = (rows: Doc[]) =>
      db().economicEvent.createMany({ data: rows });

    it('says UNAVAILABLE for an empty table, never “no news”', async () => {
      const { events, problems } = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'NEXT_24H_HIGH',
      });
      expect(events).toMatchObject({
        status: 'UNAVAILABLE',
        calendar_age_seconds: null,
        items: [],
      });
      expect(problems).toEqual(['the news calendar holds no row']);
    });

    it('reads a rescheduled release at its newest time, once', async () => {
      await seedCalendar([
        calendarRow({
          value_id: 'cpi',
          event_id: 'e-cpi',
          captured_at: NOW - 7200,
          event_time: NOW + 2 * HOUR,
        }),
        calendarRow({
          value_id: 'cpi',
          event_id: 'e-cpi',
          captured_at: NOW - 60,
          event_time: NOW + 5 * HOUR,
        }),
        calendarRow({
          value_id: 'moved-out',
          event_id: 'e-out',
          captured_at: NOW - 7200,
          event_time: NOW + 2 * HOUR,
        }),
        calendarRow({
          value_id: 'moved-out',
          event_id: 'e-out',
          captured_at: NOW - 60,
          event_time: NOW + 5 * 24 * HOUR,
        }),
      ]);
      const { events } = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'NEXT_24H_HIGH',
      });
      expect(events.status).toBe('OK');
      expect(events.calendar_age_seconds).toBe(60);
      expect(events.items.map((i) => [i.event_id, i.time])).toEqual([
        [
          'e-cpi',
          new Date((NOW + 5 * HOUR) * 1000).toISOString().replace('.000Z', 'Z'),
        ],
      ]);
    });

    it('filters HIGH importance for the day and keeps everything for the week, soonest first', async () => {
      await seedCalendar([
        calendarRow({
          event_id: 'high',
          importance: 'HIGH',
          event_time: NOW + 3 * HOUR,
        }),
        calendarRow({
          event_id: 'mid',
          importance: 'MODERATE',
          event_time: NOW + 1 * HOUR,
        }),
        calendarRow({
          event_id: 'low-week',
          importance: 'LOW',
          event_time: NOW + 3 * 24 * HOUR,
        }),
        calendarRow({
          event_id: 'far',
          importance: 'HIGH',
          event_time: NOW + 9 * 24 * HOUR,
        }),
        calendarRow({
          event_id: 'past',
          importance: 'HIGH',
          event_time: NOW - HOUR,
        }),
      ]);
      const day = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'NEXT_24H_HIGH',
      });
      expect(day.events.items.map((i) => i.event_id)).toEqual(['high']);
      const week = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'UPCOMING_ALL',
      });
      expect(week.events.items.map((i) => i.event_id)).toEqual([
        'mid',
        'high',
        'low-week',
      ]);
      expect(week.events.scope).toBe('UPCOMING_ALL');
    });

    it('marks an approximate time, and a calendar older than 45 minutes is LATE', async () => {
      await seedCalendar([
        calendarRow({
          event_id: 'exact',
          time_mode: 0,
          captured_at: NOW - 3000,
        }),
        calendarRow({
          event_id: 'day',
          time_mode: 2,
          event_time: NOW + 2 * HOUR,
          captured_at: NOW - 3000,
        }),
      ]);
      const { events } = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'NEXT_24H_HIGH',
      });
      expect(events.status).toBe('LATE');
      expect(events.calendar_age_seconds).toBe(3000);
      expect(events.items.map((i) => [i.event_id, i.approximate])).toEqual([
        ['exact', false],
        ['day', true],
      ]);
    });

    it('caps the list at the packet’s bound', async () => {
      await seedCalendar(
        Array.from({ length: EVENTS_MAX_ITEMS + 10 }, (_, i) =>
          calendarRow({
            event_id: `e${String(i).padStart(3, '0')}`,
            event_time: NOW + 100 + i,
          })
        )
      );
      const { events } = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'UPCOMING_ALL',
      });
      expect(events.items).toHaveLength(EVENTS_MAX_ITEMS);
      expect(events.items[0]!.event_id).toBe('e000');
    });

    it('makes an events block the packet validator accepts', async () => {
      await seedCalendar([
        calendarRow({ event_id: 'cpi', event_time: NOW + HOUR }),
      ]);
      const { events } = await readUpcomingEvents({
        nowSeconds: NOW,
        scope: 'NEXT_24H_HIGH',
      });
      const run = await runWorld(GOLDEN[3]!, 'DAY_TRADER', 'DIRECTION');
      expect(validatePacket({ ...run.packet!, events }).ok).toBe(true);
    });
  });
});
