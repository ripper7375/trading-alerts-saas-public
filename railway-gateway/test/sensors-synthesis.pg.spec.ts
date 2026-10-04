/**
 * The SYN write path on a REAL Postgres, with the REAL Python runner (build step 4 part 5): a `cycle-ready` job goes through
 * the processor, the database loader reads the cycle's rows (and the `sr_*` levels of the last closed bar of each timeframe),
 * the runner makes the sensors' readings and, with the `SYN` flag on, the Day Trader and Scalper readings and their entry
 * zones; the SYN writer judges every row, and the rows go to the database in ONE transaction with the sensors'. The job is a
 * fake (Bull and Redis are not involved); everything after it is real.
 *
 * Two blocks. The first needs only the tables and asks the question that justifies the design (decision 3 of the part 4
 * hand-off, option (a)): does the TypeScript twin of the 25 CHECK constraints refuse everything the database refuses, under
 * the same name? Every row of the shared corpus (`test/helpers/synthesis-rows.ts`, valid and damaged one rule at a time) is
 * given to the twin and to the database. The second needs Python as well and shows the flow: the rows of the three stored
 * cycles are the stored files byte for byte, a second delivery writes nothing, `SYN` off writes nothing and leaves the
 * sensors' rows exactly as before, a damaged section is left out without costing the sensors anything, and the one
 * transaction really is one (a SYN row that the twin did not catch undoes the sensors' rows, which is what the twin is for).
 *
 * SKIPPED unless ALL of these hold (the second block also needs Python 3 with PyYAML and jsonschema on the PATH):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics, indicator_configs, market_cycles,
 *                        active_indicator_settings, mcd_outputs, market_cycle_inputs, synthesis_readings and entry_zones in
 *                        that database
 *
 * To run it on a throwaway database (see database-traps.md and the part 4 hand-off):
 *   1. start a scratch cluster (`initdb`, then `postgres.exe` with Start-Process on a high port) and create an empty database;
 *   2. create the gateway's tables from its own schema (`prisma migrate diff --config <scratch config outside the repo>
 *      --from-empty --to-schema railway-gateway/prisma/schema.prisma --script`) WITHOUT the five sensor and synthesis tables
 *      (mcd_outputs, market_cycle_inputs, state_statistics, synthesis_readings, entry_zones), then apply
 *      prisma/migrations/20261003000000_add_sensor_tables/migration.sql and
 *      prisma/migrations/20261004000000_add_synthesis_tables/migration.sql themselves: the CHECK constraints are what is shown;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest test/sensors-synthesis.pg.spec.ts
 *   4. stop the cluster and delete its folder.
 */
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import { ActiveIndicatorService } from '../src/cycle/active-indicator/active-indicator.service';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleReadyProcessor,
  SensorJobOutcome,
} from '../src/sensors/cycle-ready.processor';
import type { CycleRunResult } from '../src/sensors/cycle-run-result';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import {
  CYCLE_RUNNER,
  CycleRunner,
  PythonCycleRunner,
  RunnerRequest,
} from '../src/sensors/python-runner';
import { SensorConfig } from '../src/sensors/sensor-config';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import {
  EntryZoneRow,
  SynthesisReadingRow,
  ZONE_CHECKS,
  READING_CHECKS,
  readingRowProblems,
  sha256,
  zoneRowProblems,
} from '../src/sensors/synthesis-rows';
import { SynthesisWriter } from '../src/sensors/synthesis.writer';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
} from './helpers/cycle-fixtures';
import { SeedPlan, buildSeedPlan } from './helpers/inputs-world';
import { pythonAvailable } from './helpers/kit-runner';
import { seedPlanInto } from './helpers/pg-seed';
import { fakeJob, readyJobData } from './helpers/sensors-worker-world';
import {
  Doc,
  ROW_CASES,
  contextOf,
  storedReadingRow,
  zoneRowFrom,
} from './helpers/synthesis-rows';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const databaseEnabled =
  URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  URL !== '' &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const parity = databaseEnabled ? describe : describe.skip;
const flow = databaseEnabled && pythonAvailable() ? describe : describe.skip;

const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const TWIN_NAMES: readonly string[] = [...READING_CHECKS, ...ZONE_CHECKS];

/** The constraint a Postgres error message names: `violates check constraint "<name>"`. */
function violated(message: string): string | undefined {
  return /violates check constraint "(\w+)"/.exec(message)?.[1];
}

describe('(the rest of this file needs a database: see the header)', () => {
  it('knows the 25 constraints of the migration', () => {
    expect(TWIN_NAMES).toHaveLength(25);
  });
});

parity(
  'the TypeScript twin of the CHECK constraints against a real PostgreSQL',
  () => {
    jest.setTimeout(240_000);
    let prisma: PrismaService;

    beforeAll(async () => {
      process.env['DATABASE_URL'] = URL;
      prisma = new PrismaService();
      await prisma.$connect();
    });
    afterAll(async () => {
      await prisma.$executeRawUnsafe('DELETE FROM entry_zones');
      await prisma.$executeRawUnsafe('DELETE FROM synthesis_readings');
      await prisma.$disconnect();
    });
    beforeEach(async () => {
      await prisma.$executeRawUnsafe('DELETE FROM entry_zones');
      await prisma.$executeRawUnsafe('DELETE FROM synthesis_readings');
    });

    it('the database has all 25 constraints the twin has a name for, and no other', async () => {
      const found = await prisma.$queryRawUnsafe<{ conname: string }[]>(
        `SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
          AND conrelid IN ('synthesis_readings'::regclass, 'entry_zones'::regclass)
        ORDER BY 1`
      );
      expect(found.map((f) => f.conname)).toEqual([...TWIN_NAMES].sort());
    });

    it.each(ROW_CASES.map((c) => [`${c.kind}: ${c.label}`, c] as const))(
      '%s',
      async (_label, c) => {
        const row = c.build();
        const twin =
          c.kind === 'reading'
            ? readingRowProblems(row as unknown as SynthesisReadingRow)
            : zoneRowProblems(row as unknown as EntryZoneRow);
        if (c.dbSkip !== undefined) {
          // Prisma will not send what the database would refuse; the twin must still refuse it
          expect(twin.length).toBeGreaterThan(0);
          return;
        }
        let refusal: string | undefined;
        try {
          if (c.kind === 'reading')
            await prisma.synthesisReading.create({ data: row as never });
          else await prisma.entryZone.create({ data: row as never });
        } catch (error) {
          refusal = String((error as { message?: string }).message);
        }

        if (c.constraint === null) {
          // a valid row: both accept it
          expect(refusal).toBeUndefined();
          expect(twin).toEqual([]);
          return;
        }
        // the database refuses it, and names a constraint ...
        expect(refusal).toBeDefined();
        const named = violated(refusal!);
        expect(named).toBeDefined();
        // ... and the twin refused it first, naming that constraint among its own and the one the case is about
        expect(twin.length).toBeGreaterThan(0);
        const twinNames = twin.map((problem) => problem.split(': ')[0]);
        expect(twinNames).toContain(named);
        expect(twinNames).toContain(c.constraint);
      }
    );

    it('the twin never refuses a row the database accepts, over the whole corpus (nothing is rejected needlessly)', async () => {
      for (const c of ROW_CASES.filter((x) => x.constraint === null)) {
        const row = c.build();
        const twin =
          c.kind === 'reading'
            ? readingRowProblems(row as unknown as SynthesisReadingRow)
            : zoneRowProblems(row as unknown as EntryZoneRow);
        expect({ label: c.label, twin }).toEqual({ label: c.label, twin: [] });
      }
    });
  }
);

flow('the SYN write path, from a job to rows, with the real runner', () => {
  jest.setTimeout(300_000);
  let prisma: PrismaService;
  let dir: string;
  let synConfig: string;
  let sensorsOnly: string;

  const config = (workerConfigPath: string): SensorConfig => ({
    retuningEnforced: false,
    python: PYTHON,
    engineDir: ENGINE_DIR,
    workerConfigPath,
    maxJobAgeSeconds: 600,
    runnerTimeoutMs: 120_000,
  });

  const processorWith = (
    workerConfigPath: string,
    options: {
      damage?: (result: CycleRunResult) => void;
      writer?: McdOutputsWriter;
    } = {}
  ) => {
    const cfg = config(workerConfigPath);
    const real = new PythonCycleRunner(cfg);
    const runner: CycleRunner = options.damage
      ? {
          async run(request: RunnerRequest) {
            const out = await real.run(request);
            options.damage!(out.result);
            return out;
          },
        }
      : real;
    return new CycleReadyProcessor(
      new DatabaseInputsSource(
        prisma,
        new ActiveIndicatorService(prisma, new CycleReaderService(prisma))
      ),
      runner,
      options.writer ?? writer(),
      cfg
    );
  };
  const writer = () =>
    new McdOutputsWriter(
      prisma,
      new EnvelopeValidator(),
      new SynthesisWriter(new SynReadingValidator())
    );

  async function wipe(): Promise<void> {
    await prisma.$executeRawUnsafe(
      'TRUNCATE mcd_outputs, market_cycle_inputs, synthesis_readings, entry_zones'
    );
    for (const table of [
      'indicator_statistics',
      'indicator_configs',
      'market_data_v6',
      'market_cycles',
      'active_indicator_settings',
    ]) {
      await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
    }
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-syn-pg-'));
    sensorsOnly = path.join(dir, 'sensors-only.yaml');
    fs.writeFileSync(
      sensorsOnly,
      'schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n',
      'utf8'
    );
    synConfig = path.join(dir, 'with-syn.yaml');
    fs.writeFileSync(
      synConfig,
      'schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n  SYN: shadow\nsynthesis:\n  rules_version: draft-1\n',
      'utf8'
    );
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await wipe();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const planOf = (fixture: FixtureSlot): SeedPlan =>
    buildSeedPlan(readFixtureBundle(fixture));
  const NOW = (fixture: FixtureSlot) => fixture.slot + 70;
  const written = (outcome: SensorJobOutcome | undefined) => {
    expect(outcome?.outcome).toBe('WRITTEN');
    return outcome as Extract<SensorJobOutcome, { outcome: 'WRITTEN' }>;
  };
  const handle = (
    processor: CycleReadyProcessor,
    fixture: FixtureSlot,
    nowSec = NOW(fixture)
  ) => processor.handle(fakeJob(readyJobData(fixture)), nowSec);

  /** `zones_json` of a profile in the stored file, rewritten so only the change is wrong. */
  function rewriteZones(profile: Doc, change: (zone: Doc) => void): void {
    const zones = JSON.parse(profile['zones_json']) as Doc[];
    zones.forEach(change);
    profile['zones_json'] = JSON.stringify(zones);
    profile['zones_sha256'] = sha256(profile['zones_json']);
  }

  // ------------------------------------------------------------------ the three stored cycles

  describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'the stored cycle %s, from a job to rows',
    (_name, fixture) => {
      it('writes the SYN readings and zones of the stored files, byte for byte, in the same transaction as the sensors’ rows', async () => {
        await seedPlanInto(prisma, planOf(fixture));
        const outcome = written(
          await handle(processorWith(synConfig), fixture)
        );
        const ctx = contextOf(fixture);
        const zoneCount = ctx.synthesis.readings.reduce(
          (n, r) => n + (JSON.parse(r.zones_json) as Doc[]).length,
          0
        );
        expect(outcome).toMatchObject({
          outputsInserted: 4,
          synthesis: {
            readingsInserted: 2,
            readingsExisting: 0,
            zonesInserted: zoneCount,
            zonesExisting: 0,
            refused: [],
            error: null,
          },
        });

        const readings = await prisma.synthesisReading.findMany({
          where: { symbol: 'XAUUSD', cycle_slot: fixture.slot },
          orderBy: { profile: 'asc' },
        });
        expect(readings.map((r) => r.profile)).toEqual([
          'DAY_TRADER',
          'SCALPER',
        ]);
        const sensorRows = await prisma.mcdOutput.findMany({
          where: { symbol: 'XAUUSD', cycle_slot: fixture.slot },
        });
        for (const row of readings) {
          const stored = ctx.synthesis.readings.find(
            (r) => r.profile === row.profile
          )!;
          // the database loader's cycle gives the engine's own readings: the same text, the same hash
          expect(row.reading_json).toBe(stored.reading_json);
          expect(row.reading_sha256).toBe(stored.reading_sha256);
          expect(row.zones_json).toBe(stored.zones_json);
          expect(row.zones_sha256).toBe(stored.zones_sha256);
          expect(row.reading).toEqual(JSON.parse(stored.reading_json!));
          expect(row.zones_reason).toBe(stored.zones_reason);
          expect(row.zone_count).toBe(
            (JSON.parse(stored.zones_json) as Doc[]).length
          );
          expect(row).toMatchObject({
            flag: 'shadow',
            rules_version: ctx.synthesis.rules_version,
            rules_sha256: ctx.synthesis.rules_sha256,
            zone_params_version: ctx.synthesis.zones_version,
            zone_params_sha256: ctx.synthesis.zones_sha256,
            reference_price: ctx.synthesis.reference_price,
            retuning_observed: false,
            retuning_applied: false,
            evaluated_at: NOW(fixture),
          });
          // joined to the sensor rows it was made from by the bundle hash, and each input named in the reading is a stored envelope
          expect(row.inputs_sha256).toBe(sensorRows[0].inputs_sha256);
          const inputs = (row.reading as Doc)['inputs'] as Record<
            string,
            { envelope_sha256: string }
          >;
          for (const [mcd, input] of Object.entries(inputs)) {
            expect(
              sensorRows.find((s) => s.mcd_id === mcd)!.envelope_sha256
            ).toBe(input.envelope_sha256);
          }
        }

        const zones = await prisma.entryZone.findMany({
          where: { symbol: 'XAUUSD', cycle_slot: fixture.slot },
          orderBy: [{ profile: 'asc' }, { rank: 'asc' }],
        });
        expect(zones).toHaveLength(zoneCount);
        for (const zone of zones) {
          const expected = (
            JSON.parse(
              ctx.synthesis.readings.find((r) => r.profile === zone.profile)!
                .zones_json
            ) as Doc[]
          )[zone.rank - 1];
          const row = zoneRowFrom(expected);
          for (const [column, value] of Object.entries(row))
            expect([column, (zone as unknown as Doc)[column]]).toEqual([
              column,
              value,
            ]);
        }
      });

      it('a second delivery of the job writes nothing and keeps the first rows', async () => {
        await seedPlanInto(prisma, planOf(fixture));
        const processor = processorWith(synConfig);
        await handle(processor, fixture);
        const first = await snapshot();
        const again = written(
          await handle(processor, fixture, NOW(fixture) + 9)
        );
        expect(again).toMatchObject({
          outputsInserted: 0,
          synthesis: {
            readingsInserted: 0,
            readingsExisting: 2,
            zonesInserted: 0,
          },
        });
        expect(await snapshot()).toBe(first);
      });
    }
  );

  async function snapshot(): Promise<string> {
    return JSON.stringify([
      await prisma.mcdOutput.findMany({ orderBy: { id: 'asc' } }),
      await prisma.synthesisReading.findMany({ orderBy: { id: 'asc' } }),
      await prisma.entryZone.findMany({ orderBy: { id: 'asc' } }),
    ]);
  }

  it('the stored bundle carries the context_levels the loader read from market_data_v6, and the zones were built from them', async () => {
    const fixture = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(fixture));
    await handle(processorWith(synConfig), fixture);
    const [input] = await prisma.marketCycleInput.findMany();
    const bundle = JSON.parse(
      gunzipSync(Buffer.from(input.bundle_gz)).toString('utf8')
    ) as Doc;
    const stored = readFixtureBundle(fixture).context_levels!;
    expect(Object.keys(bundle['context_levels']).sort()).toEqual(['M15', 'M5']);
    expect(bundle['context_levels'].M15.sr_1).toBe(stored.M15!['sr_1']);
    expect(bundle['context_levels'].M15.sr_2).toBe(stored.M15!['sr_2']);
    expect(Object.keys(bundle['context_levels'].M15)).toHaveLength(16);
    // the zones carry sr_levels as the levels behind them: the stored 18 Sep zones are confluence with sr_1 and sr_2
    const zones = await prisma.entryZone.findMany({
      where: { profile: 'DAY_TRADER' },
      orderBy: { rank: 'asc' },
    });
    expect(
      JSON.stringify((zones[0].levels as Doc)['confluence_levels'])
    ).toContain('"origin":"sr_levels"');
  });

  it('with the SYN flag off nothing is written to the SYN tables and the sensors’ rows are exactly what they were', async () => {
    const fixture = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(fixture));
    const off = written(await handle(processorWith(sensorsOnly), fixture));
    expect(off).not.toHaveProperty('synthesis');
    expect(await prisma.synthesisReading.count()).toBe(0);
    expect(await prisma.entryZone.count()).toBe(0);
    const sensorsOff = JSON.stringify(
      (await prisma.mcdOutput.findMany({ orderBy: { mcd_id: 'asc' } })).map(
        ({ id: _id, created_at: _created, duration_ms: _ms, ...rest }) => rest
      )
    );

    await wipe();
    await seedPlanInto(prisma, planOf(fixture));
    await handle(processorWith(synConfig), fixture);
    const sensorsOn = JSON.stringify(
      (await prisma.mcdOutput.findMany({ orderBy: { mcd_id: 'asc' } })).map(
        ({ id: _id, created_at: _created, duration_ms: _ms, ...rest }) => rest
      )
    );
    expect(sensorsOn).toBe(sensorsOff);
  });

  it('the SYN flag turned on after the sensors have been written adds the SYN rows alone', async () => {
    const fixture = FIXTURE_SLOTS[2];
    await seedPlanInto(prisma, planOf(fixture));
    await handle(processorWith(sensorsOnly), fixture);
    const later = written(
      await handle(processorWith(synConfig), fixture, NOW(fixture) + 60)
    );
    expect(later).toMatchObject({
      outputsInserted: 0,
      outputsExisting: 4,
      synthesis: { readingsInserted: 2, zonesInserted: 4 },
    });
  });

  it('a damaged section never reaches the tables: the Day Trader is left out and logged, the Scalper and every sensor are written', async () => {
    const fixture = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(fixture));
    const outcome = written(
      await handle(
        processorWith(synConfig, {
          damage: (result) => {
            rewriteZones(
              result.synthesis!.readings[0] as unknown as Doc,
              (z) => {
                z['invalidation_price'] = Number(
                  (z['reference_price'] - 12.99).toFixed(2)
                );
                z['stop_distance'] = 12.99;
              }
            );
          },
        }),
        fixture
      )
    );
    expect(outcome.synthesis?.refused).toHaveLength(1);
    expect(outcome.synthesis?.refused[0].problems.join('\n')).toContain(
      'entry_zones_stop_distance_is_at_least_13'
    );
    expect(await prisma.mcdOutput.count()).toBe(4);
    expect(
      (await prisma.synthesisReading.findMany()).map((r) => r.profile)
    ).toEqual(['SCALPER']);
    expect(
      (await prisma.entryZone.findMany()).every((z) => z.profile === 'SCALPER')
    ).toBe(true);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('SYN_READING_REFUSED DAY_TRADER (GATEWAY)')
    );
  });

  it.each([['entry_zones'], ['synthesis_readings']])(
    'a database without %s loses nothing: the SYN rows are left out, the sensors are written, and the next cycle writes them once the table is there',
    async (table) => {
      const fixture = FIXTURE_SLOTS[0];
      await seedPlanInto(prisma, planOf(fixture));
      const processor = processorWith(synConfig);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE ${table} RENAME TO ${table}_away`
      );
      try {
        const outcome = written(await handle(processor, fixture));
        expect(outcome.synthesis).toMatchObject({
          readingsInserted: 0,
          zonesInserted: 0,
          error: 'SYN_TABLES_MISSING',
        });
        expect(await prisma.mcdOutput.count()).toBe(4);
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE ${table}_away RENAME TO ${table}`
        );
      }
      expect(await prisma.synthesisReading.count()).toBe(0);
      expect(await prisma.entryZone.count()).toBe(0);
      const later = written(
        await handle(processor, fixture, NOW(fixture) + 60)
      );
      expect(later.synthesis).toMatchObject({
        readingsInserted: 2,
        zonesInserted: 4,
        error: null,
      });
    }
  );

  it('an engine error leaves the SYN tables empty and writes the sensors', async () => {
    const fixture = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(fixture));
    const outcome = written(
      await handle(
        processorWith(synConfig, {
          damage: (result) => {
            result.synthesis!.error = 'SYNTHESIS_ERROR';
            result.synthesis!.readings = [];
          },
        }),
        fixture
      )
    );
    expect(outcome.synthesis?.error).toBe('SYNTHESIS_ERROR');
    expect(await prisma.mcdOutput.count()).toBe(4);
    expect(await prisma.synthesisReading.count()).toBe(0);
  });

  it('the transaction really is one: a SYN row the twin did not catch is refused by the database and undoes the sensors’ rows too (which is what the twin is for)', async () => {
    const fixture = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(fixture));
    const validator = new SynReadingValidator();
    const honest = new SynthesisWriter(validator);
    // a writer whose twin has been blinded: it hands the transaction a zone with a 12.99 stop
    const blinded = {
      prepare: (write: Parameters<SynthesisWriter['prepare']>[0]) => {
        const prepared = honest.prepare(write);
        prepared.zones[0] = {
          ...prepared.zones[0],
          invalidation_price: Number(
            (prepared.zones[0].reference_price - 12.99).toFixed(2)
          ),
          stop_distance: 12.99,
        };
        return prepared;
      },
    } as unknown as SynthesisWriter;
    const processor = processorWith(synConfig, {
      writer: new McdOutputsWriter(prisma, new EnvelopeValidator(), blinded),
    });
    await expect(handle(processor, fixture)).rejects.toThrow(
      /entry_zones_stop_distance_is_at_least_13/
    );
    expect(await prisma.mcdOutput.count()).toBe(0);
    expect(await prisma.marketCycleInput.count()).toBe(0);
    expect(await prisma.synthesisReading.count()).toBe(0);
    expect(await prisma.entryZone.count()).toBe(0);
  });

  it('the rows the writer sends are accepted by the database for every stored cycle: no CHECK fires on real data (the twin and the engine agree)', async () => {
    for (const fixture of FIXTURE_SLOTS) {
      await seedPlanInto(prisma, planOf(fixture));
      const outcome = written(await handle(processorWith(synConfig), fixture));
      expect(outcome.synthesis?.refused).toEqual([]);
      await wipe();
    }
  });

  it('a corpus row built from the stored files is the row the writer sends (the helper’s mapping and the writer’s are independent)', async () => {
    const fixture = FIXTURE_SLOTS[1];
    await seedPlanInto(prisma, planOf(fixture));
    await handle(processorWith(synConfig), fixture);
    const ctx = contextOf(fixture);
    const sent = await prisma.synthesisReading.findMany({
      orderBy: { profile: 'asc' },
    });
    for (const row of sent) {
      const expected = storedReadingRow(ctx, row.profile);
      for (const column of [
        'reading_json',
        'reading_sha256',
        'zones_json',
        'zones_sha256',
        'rule_id',
        'bias',
        'status',
      ])
        expect([column, (row as unknown as Doc)[column]]).toEqual([
          column,
          expected[column],
        ]);
    }
  });
});
