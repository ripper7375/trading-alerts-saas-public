/**
 * The cycle inputs loader on a REAL Postgres, into the REAL Python runner (build step 3,
 * part 3): the stored cycles v1, v3 and v4 are laid out as rows (bars with their channel
 * columns, the bar forming at the slot and the one after it, statistics of the slot and
 * of the slots either side, the READY cycles, the setting), the database loader reads
 * them, `python -m mcd_worker.cli` reads what the loader built, and every envelope must
 * equal the one stored for the cycle. The ADR-083 boundaries and the rules 2, 5, 6 and 9
 * are then asked of the same database (test/helpers/inputs-scenarios.ts, the scenarios
 * test/sensors-inputs-runner.spec.ts also runs on an in-memory stand-in).
 *
 * SKIPPED unless ALL of these hold:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics,
 *                        indicator_configs, market_cycles and active_indicator_settings in
 *                        that database
 *   Python 3 with PyYAML and jsonschema on the PATH (SENSOR_PYTHON names another interpreter)
 *
 * To run it on a throwaway database (see database-traps.md, "A real Postgres server without
 * Docker", and the part 3 hand-off):
 *   1. start a scratch cluster (`initdb`, then `postgres.exe` started with Start-Process on a high
 *      port, never `pg_ctl start` through a tool pipe) and create an empty database;
 *   2. create the tables from the gateway’s own schema: `prisma migrate diff --config <scratch config
 *      outside the repo> --from-empty --to-schema railway-gateway/prisma/schema.prisma --script`,
 *      applied with `psql -v ON_ERROR_STOP=1` (this spec needs only five of its tables);
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes
 *      npx jest test/sensors-inputs.pg.spec.ts
 *   4. stop the cluster and delete its folder.
 */
import { Logger } from '@nestjs/common';
import { ActiveIndicatorService } from '../src/cycle/active-indicator/active-indicator.service';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import { PrismaService } from '../src/prisma/prisma.service';
import { FIXTURE_SLOTS, readFixtureBundle } from './helpers/cycle-fixtures';
import { defineLoaderToRunnerScenarios } from './helpers/inputs-scenarios';
import { POISON, SeedPlan, buildSeedPlan } from './helpers/inputs-world';
import { pythonAvailable } from './helpers/kit-runner';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled =
  URL !== '' &&
  process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes' &&
  pythonAvailable();
if (
  URL !== '' &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

type Row = Record<string, unknown>;

/** Rows in chunks: one INSERT of a thousand bars would pass the 65,535 bind parameters Postgres allows. */
function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** A nullable JSON column is left out when it is null: Prisma wants DbNull for a null there, and the table default is NULL. */
const withoutNulls = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

suite('the database loader on a real Postgres, into the runner', () => {
  jest.setTimeout(180_000);
  let prisma: PrismaService;
  let seeded: string | undefined;

  async function seed(plan: SeedPlan): Promise<void> {
    // children before parents: indicator_statistics holds a foreign key to indicator_configs
    for (const table of [
      'indicator_statistics',
      'indicator_configs',
      'market_data_v6',
      'market_cycles',
      'active_indicator_settings',
    ]) {
      await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
    }
    await prisma.indicatorConfig.createMany({
      data: plan.configHashes.map((config_hash) => ({
        config_hash,
        source: 'seed',
        params: {},
        first_seen: 1,
      })),
    });
    await prisma.marketCycle.createMany({
      data: plan.cycles.map(withoutNulls) as never,
    });
    for (const part of chunks(plan.bars, 150)) {
      await prisma.marketDataV6.createMany({ data: part as never });
    }
    for (const part of chunks(plan.statistics, 20)) {
      await prisma.indicatorStatistic.createMany({ data: part as never });
    }
    await prisma.activeIndicatorSetting.createMany({
      data: plan.settings as never,
    });
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const open = async (plan: SeedPlan, key?: string) => {
    if (key === undefined || key !== seeded) {
      await seed(plan);
      seeded = key;
    }
    return new DatabaseInputsSource(
      prisma,
      new ActiveIndicatorService(prisma, new CycleReaderService(prisma))
    );
  };

  describe('the tables hold what the loader must not read', () => {
    it('the bar forming at the slot, the bar after it, the neighbouring slots’ statistics and the live-bar columns are really in the database', async () => {
      const plan = buildSeedPlan(readFixtureBundle(FIXTURE_SLOTS[0]));
      await open(plan);
      const [{ bars }] = await prisma.$queryRawUnsafe<Array<{ bars: bigint }>>(
        `SELECT count(*) AS bars FROM market_data_v6 WHERE close = ${POISON}`
      );
      expect(Number(bars)).toBe(4); // two timeframes, the forming bar and the one after it
      const [{ stats }] = await prisma.$queryRawUnsafe<
        Array<{ stats: bigint }>
      >(
        `SELECT count(*) AS stats FROM indicator_statistics WHERE containment_rate = 1.25 OR live_close = ${POISON}`
      );
      expect(Number(stats)).toBeGreaterThan(10);
      seeded = undefined;
    });

    it('and none of it reaches the bundle', async () => {
      const plan = buildSeedPlan(readFixtureBundle(FIXTURE_SLOTS[1]));
      const source = await open(plan);
      const loaded = await source.loadCycleInputs('XAUUSD', plan.slot);
      if (loaded.status !== 'OK') throw new Error(JSON.stringify(loaded));
      const text = JSON.stringify(loaded.bundle);
      expect(text).not.toContain('424242');
      expect(
        loaded.bundle.bars.M5[loaded.bundle.bars.M5.length - 1].timestamp
      ).toBe(plan.slot - 300);
      seeded = undefined;
    });
  });

  describe('the READY filter, on the real query', () => {
    it.each(['PENDING', 'INCOMPLETE'])(
      'a %s row at the slot is not a cycle: NOT_READY',
      async (state) => {
        const plan = buildSeedPlan(readFixtureBundle(FIXTURE_SLOTS[0]));
        plan.cycles[0]['state'] = state;
        const source = await open(plan);
        expect(await source.loadCycleInputs('XAUUSD', plan.slot)).toMatchObject(
          {
            status: 'NOT_READY',
            reason: 'CYCLE_NOT_READY',
          }
        );
        seeded = undefined;
      }
    );

    it('a READY row that cannot be trusted is INVALID_CYCLE_ROW', async () => {
      const plan = buildSeedPlan(readFixtureBundle(FIXTURE_SLOTS[0]));
      plan.cycles[0]['data_status'] = 'FRESH';
      plan.cycles[0]['ready_at'] = null;
      const source = await open(plan);
      expect(await source.loadCycleInputs('XAUUSD', plan.slot)).toMatchObject({
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
      });
      seeded = undefined;
    });
  });

  defineLoaderToRunnerScenarios({ open });
});
