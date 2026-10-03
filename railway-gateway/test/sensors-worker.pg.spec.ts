/**
 * The sensor worker on a REAL Postgres, with the REAL Python runner (build step 3, part 4): a
 * `cycle-ready` job goes through the processor, the database loader reads the cycle's rows, the
 * runner reads the bundle, the validator checks every envelope and the writer commits the
 * readings, the stored bundle and the 90-day cleanup in one transaction. The job is a fake
 * (Bull and Redis are not involved); everything after it is real.
 *
 * It shows, on the database: one row per MCD per cycle, byte for byte the stored envelopes;
 * the stored bundle text replays to the same hashes; INVALID rows and STALE rows exist;
 * re-delivery adds nothing; a statement that fails rolls back the ones before it; the cleanup
 * deletes the bundles older than 90 days and no reading; RETUNING is recorded observed and applied.
 *
 * SKIPPED unless ALL of these hold:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics,
 *                        indicator_configs, market_cycles, active_indicator_settings, mcd_outputs
 *                        and market_cycle_inputs in that database
 *   Python 3 with PyYAML and jsonschema on the PATH (SENSOR_PYTHON names another interpreter)
 *
 * To run it on a throwaway database (see database-traps.md and the part 4 hand-off):
 *   1. start a scratch cluster (`initdb`, then `postgres.exe` with Start-Process on a high port,
 *      never `pg_ctl start` through a tool pipe) and create an empty database;
 *   2. create the gateway's tables from its own schema (`prisma migrate diff --config <scratch
 *      config outside the repo> --from-empty --to-schema railway-gateway/prisma/schema.prisma
 *      --script`) WITHOUT the three sensor tables, then apply
 *      prisma/migrations/20261003000000_add_sensor_tables/migration.sql itself: the CHECK
 *      constraints are part of what is shown, and `migrate diff` cannot see them;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes
 *      npx jest test/sensors-worker.pg.spec.ts
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
  CycleNotReadyError,
  CycleReadyProcessor,
  SensorJobOutcome,
} from '../src/sensors/cycle-ready.processor';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { PythonCycleRunner } from '../src/sensors/python-runner';
import { SensorConfig } from '../src/sensors/sensor-config';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import { SeedPlan, buildSeedPlan } from './helpers/inputs-world';
import { pythonAvailable } from './helpers/kit-runner';
import { seedPlanInto } from './helpers/pg-seed';
import {
  fakeJob,
  readyJobData,
  sha256,
  unitResult,
} from './helpers/sensors-worker-world';

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

const DAY = 86_400;
const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';

suite('the sensor worker on a real Postgres, with the real runner', () => {
  jest.setTimeout(240_000);
  let prisma: PrismaService;
  let dir: string;
  let shadow: string;
  let writer: McdOutputsWriter;

  const config = (over: Partial<SensorConfig> = {}): SensorConfig => ({
    retuningEnforced: false,
    python: PYTHON,
    engineDir: ENGINE_DIR,
    workerConfigPath: shadow,
    maxJobAgeSeconds: 600,
    runnerTimeoutMs: 120_000,
    ...over,
  });

  const processorWith = (over: Partial<SensorConfig> = {}) => {
    const cfg = config(over);
    return new CycleReadyProcessor(
      new DatabaseInputsSource(
        prisma,
        new ActiveIndicatorService(prisma, new CycleReaderService(prisma))
      ),
      new PythonCycleRunner(cfg),
      writer,
      cfg
    );
  };

  async function wipe(): Promise<void> {
    // TRUNCATE, not DELETE, for the sensor tables: it also resets the planner statistics, which
    // sensor-tables.pg.spec.ts (the index-use test) reads, so the two gated specs pass in any order
    await prisma.$executeRawUnsafe('TRUNCATE mcd_outputs, market_cycle_inputs');
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
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-worker-pg-'));
    shadow = path.join(dir, 'shadow.yaml');
    fs.writeFileSync(
      shadow,
      'schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n',
      'utf8'
    );
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
    writer = new McdOutputsWriter(prisma, new EnvelopeValidator());
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sensor_test_refuse_boom() RETURNS trigger AS $$
      BEGIN
        IF NEW.symbol = 'BOOM' THEN
          RAISE EXCEPTION 'sensor_test_refuse_boom: the bundle row of BOOM is refused';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS sensor_test_boom ON market_cycle_inputs'
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS sensor_test_refuse_boom()'
    );
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

  async function rows(slot: number) {
    return prisma.mcdOutput.findMany({
      where: { symbol: 'XAUUSD', cycle_slot: slot },
      orderBy: { mcd_id: 'asc' },
    });
  }

  // ------------------------------------------------------------------ the ordinary cycle

  describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'the stored cycle %s, from a job to rows',
    (_name, fixture) => {
      it('writes one row per MCD with the stored envelope, byte for byte, and the same document as JSONB', async () => {
        await seedPlanInto(prisma, planOf(fixture));
        const outcome = written(
          await processorWith().handle(
            fakeJob(readyJobData(fixture)),
            NOW(fixture)
          )
        );
        expect(outcome).toMatchObject({
          basis: 'INPUTS',
          outputsInserted: 4,
          outputsExisting: 0,
          inputsInserted: true,
          inputsDeleted: 0,
        });
        const stored = readFixtureCycle(fixture);
        const written4 = await rows(fixture.slot);
        expect(written4.map((r) => r.mcd_id)).toEqual([
          'MCD0',
          'MCD1',
          'MCD2',
          'MCD3',
        ]);
        for (const row of written4) {
          const expected = stored.results.find((r) => r.mcd_id === row.mcd_id)!;
          expect(row.envelope_json).toBe(expected.envelope_json);
          expect(row.envelope_sha256).toBe(expected.envelope_sha256);
          expect(row.evaluator_envelope_sha256).toBe(
            expected.evaluator_envelope_sha256
          );
          expect(row.envelope).toEqual(JSON.parse(expected.envelope_json));
          expect(row).toMatchObject({
            flag: 'shadow',
            evaluator_version: expected.evaluator_version,
            status: expected.status,
            state_code: expected.state_code,
            bias: expected.bias,
            inherited_reasons: expected.inherited_reasons,
            guard_problems: expected.guard_problems,
            retuning_observed: false,
            retuning_applied: false,
            runner_version: stored.runner_version,
            evaluated_at: NOW(fixture),
          });
          expect(row.python_version).toMatch(/^3\.\d+\.\d+/);
          expect(row.duration_ms).toBeGreaterThanOrEqual(0);
        }
      });

      it('stores the bundle text the runner wrote: its hash is on every row, and a replay of it gives the same readings', async () => {
        await seedPlanInto(prisma, planOf(fixture));
        await processorWith().handle(
          fakeJob(readyJobData(fixture)),
          NOW(fixture)
        );
        const inputs = await prisma.marketCycleInput.findMany();
        expect(inputs).toHaveLength(1);
        const [input] = inputs;
        const text = gunzipSync(Buffer.from(input.bundle_gz)).toString('utf8');
        expect(input).toMatchObject({
          symbol: 'XAUUSD',
          cycle_slot: fixture.slot,
          bundle_encoding: 'gzip',
          bundle_bytes: Buffer.byteLength(text, 'utf8'),
          retuning_observed: false,
        });
        expect(sha256(text)).toBe(input.inputs_sha256);
        const outputs = await rows(fixture.slot);
        expect(new Set(outputs.map((r) => r.inputs_sha256))).toEqual(
          new Set([input.inputs_sha256])
        );

        // replay: the stored text, parsed and sent back, gives byte-identical envelopes and the same text
        const replay = await new PythonCycleRunner(config()).run({
          bundle: JSON.parse(text),
          retuningEnforced: false,
        });
        expect(replay.result.bundle_canonical_json).toBe(text);
        expect(replay.result.inputs_sha256).toBe(input.inputs_sha256);
        expect(
          replay.result.results.map((r) => [
            r.mcd_id,
            r.envelope_json,
            r.envelope_sha256,
          ])
        ).toEqual(
          outputs.map((r) => [r.mcd_id, r.envelope_json, r.envelope_sha256])
        );
      });
    }
  );

  it('a job delivered twice adds nothing: the rows stay as first written', async () => {
    const v1 = FIXTURE_SLOTS[0];
    await seedPlanInto(prisma, planOf(v1));
    const processor = processorWith();
    await processor.handle(fakeJob(readyJobData(v1)), NOW(v1));
    const again = written(
      await processor.handle(fakeJob(readyJobData(v1)), NOW(v1) + 90)
    );
    expect(again).toMatchObject({
      outputsInserted: 0,
      outputsExisting: 4,
      inputsInserted: false,
    });
    expect(await prisma.mcdOutput.count()).toBe(4);
    expect(await prisma.marketCycleInput.count()).toBe(1);
    expect((await rows(v1.slot)).every((r) => r.evaluated_at === NOW(v1))).toBe(
      true
    );
  });

  it('two cycles are two sets of rows and two bundles', async () => {
    const [v1, v3] = FIXTURE_SLOTS;
    await seedPlanInto(prisma, planOf(v1));
    await processorWith().handle(fakeJob(readyJobData(v1)), NOW(v1));
    await seedPlanInto(prisma, planOf(v3));
    await processorWith().handle(fakeJob(readyJobData(v3)), NOW(v3));
    // the second seed wiped the market tables, not the sensor tables
    expect(await prisma.mcdOutput.count()).toBe(8);
    expect(
      (
        await prisma.marketCycleInput.findMany({
          orderBy: { cycle_slot: 'asc' },
        })
      ).map((r) => r.cycle_slot)
    ).toEqual([v1.slot, v3.slot]);
  });

  // ------------------------------------------------------------------ INVALID and STALE rows exist

  describe('INVALID and STALE readings are rows', () => {
    it('a cycle the loader refuses (Q13) gives four INVALID rows with SANITY_FAILED, written, not skipped', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const plan = planOf(v1);
      plan.settings = [
        {
          timeframe: 'M5',
          source: 'non_b',
          effective_slot: 0,
          set_by: 'test',
          reason: null,
        },
        {
          timeframe: 'M15',
          source: 'non_b',
          effective_slot: 0,
          set_by: 'test',
          reason: null,
        },
      ];
      plan.cycles[0]['config_hashes'] = { M5: { non_b: 'tuned-on-m5' } };
      plan.cycles[1]['config_hashes'] = { M15: { non_b: 'tuned-on-m15' } };
      await seedPlanInto(prisma, plan);
      written(await processorWith().handle(fakeJob(readyJobData(v1)), NOW(v1)));
      const stored = await rows(v1.slot);
      expect(stored.map((r) => r.status)).toEqual([
        'INVALID',
        'INVALID',
        'INVALID',
        'INVALID',
      ]);
      for (const row of stored) {
        expect((row.envelope as any).status_reasons).toContain('SANITY_FAILED');
        expect(row.state_code).toBeNull();
        expect(row.bias).toBeNull();
      }
    });

    // Architecture 2.4 and 2.11 (finding F1 of the step 3 session B check, Davin's option a): a detection mismatch is only
    // RECORDED at tier 1 (CAUTIONARY, `DETECTION_MISMATCH` first among the reasons) and the checks go on; the later tiers
    // end the reading. With a setting that names an indicator the data does not hold, tier 4 finds no statistics row.
    it.each([
      ['M5', 'cherry_a', 'MCD2'],
      ['M15', 'non_a', 'MCD1'],
    ] as const)(
      'a detection mismatch on %s (the setting names %s, the data sits under another indicator) ends %s STALE with [DETECTION_MISMATCH, NO_STATS_AT_SLOT], through the whole worker path',
      async (timeframe, wrong, mcd) => {
        const v1 = FIXTURE_SLOTS[0];
        const plan = planOf(v1);
        plan.settings = plan.settings.map((setting) =>
          setting['timeframe'] === timeframe
            ? { ...setting, source: wrong }
            : setting
        );
        await seedPlanInto(prisma, plan);
        written(
          await processorWith().handle(fakeJob(readyJobData(v1)), NOW(v1))
        );
        const stored = await rows(v1.slot);
        const reasons = (id: string) =>
          (stored.find((r) => r.mcd_id === id)!.envelope as any)
            .status_reasons as string[];
        const reading = stored.find((r) => r.mcd_id === mcd)!;
        expect(reading.status).toBe('STALE');
        expect(reasons(mcd)).toEqual([
          'DETECTION_MISMATCH',
          'NO_STATS_AT_SLOT',
        ]);
        expect(reading.state_code).toBeNull();
        expect(reading.bias).toBeNull();
        // the mismatch alone never leaves a CAUTIONARY reading: whoever reports it also ends STALE or INVALID
        for (const row of stored) {
          if (reasons(row.mcd_id).includes('DETECTION_MISMATCH'))
            expect(['STALE', 'INVALID']).toContain(row.status);
        }
      }
    );

    it('no READY row after the retries gives four STALE rows (DATA_STALE) and a stored STALE bundle; the earlier attempts write nothing', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const plan = planOf(v1);
      plan.cycles = []; // the manifest service announced the cycle and the row never committed
      await seedPlanInto(prisma, plan);
      const processor = processorWith();
      for (const attemptsMade of [0, 1]) {
        await expect(
          processor.handle(
            fakeJob(readyJobData(v1), { attemptsMade, attempts: 3 }),
            NOW(v1)
          )
        ).rejects.toBeInstanceOf(CycleNotReadyError);
        expect(await prisma.mcdOutput.count()).toBe(0);
        expect(await prisma.marketCycleInput.count()).toBe(0);
      }
      const outcome = written(
        await processor.handle(
          fakeJob(readyJobData(v1), { attemptsMade: 2, attempts: 3 }),
          NOW(v1)
        )
      );
      expect(outcome.basis).toBe('STALE_CYCLE_NOT_READY');
      const stored = await rows(v1.slot);
      expect(stored.map((r) => [r.mcd_id, r.status])).toEqual([
        ['MCD0', 'STALE'],
        ['MCD1', 'STALE'],
        ['MCD2', 'STALE'],
        ['MCD3', 'STALE'],
      ]);
      for (const row of stored)
        expect((row.envelope as any).status_reasons).toEqual(['DATA_STALE']);
      const [input] = await prisma.marketCycleInput.findMany();
      const bundle = JSON.parse(
        gunzipSync(Buffer.from(input.bundle_gz)).toString('utf8')
      );
      expect(bundle).toMatchObject({
        data_status: 'STALE',
        bars: { M5: [], M15: [] },
      });
    });

    it('a READY row that cannot be trusted gives STALE rows at once, with no retry', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const plan = planOf(v1);
      plan.cycles[0]['ready_at'] = null;
      await seedPlanInto(prisma, plan);
      const outcome = written(
        await processorWith().handle(
          fakeJob(readyJobData(v1), { attemptsMade: 0, attempts: 3 }),
          NOW(v1)
        )
      );
      expect(outcome.basis).toBe('STALE_INVALID_CYCLE_ROW');
      expect((await rows(v1.slot)).map((r) => r.status)).toEqual([
        'STALE',
        'STALE',
        'STALE',
        'STALE',
      ]);
    });

    it('a job that is too old reads nothing and writes nothing', async () => {
      const v1 = FIXTURE_SLOTS[0];
      await seedPlanInto(prisma, planOf(v1));
      const outcome = await processorWith().handle(
        fakeJob(readyJobData(v1, { readyAt: NOW(v1) - 3600 })),
        NOW(v1)
      );
      expect(outcome).toMatchObject({
        outcome: 'SKIPPED_OLD',
        ageSeconds: 3600,
      });
      expect(await prisma.mcdOutput.count()).toBe(0);
      expect(await prisma.marketCycleInput.count()).toBe(0);
    });

    it('with every MCD off in the worker configuration (the committed file) nothing is written', async () => {
      const v1 = FIXTURE_SLOTS[0];
      await seedPlanInto(prisma, planOf(v1));
      const outcome = await processorWith({
        workerConfigPath: undefined,
      }).handle(fakeJob(readyJobData(v1)), NOW(v1));
      expect(outcome).toEqual({ outcome: 'NOTHING_ENABLED', slot: v1.slot });
      expect(await prisma.mcdOutput.count()).toBe(0);
      expect(await prisma.marketCycleInput.count()).toBe(0);
    });
  });

  // ------------------------------------------------------------------ RETUNING

  describe('RETUNING (rule 9): observed from the READY row, applied only when enforced', () => {
    it('not enforced: recorded as observed, not applied, and no reading changes', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const plan = planOf(v1);
      plan.cycles[0]['retuning'] = true;
      await seedPlanInto(prisma, plan);
      await processorWith().handle(
        fakeJob(readyJobData(v1, { retuning: true })),
        NOW(v1)
      );
      const stored = readFixtureCycle(v1);
      const outputs = await rows(v1.slot);
      expect(
        outputs.map((r) => [r.retuning_observed, r.retuning_applied])
      ).toEqual([
        [true, false],
        [true, false],
        [true, false],
        [true, false],
      ]);
      expect(outputs.map((r) => r.envelope_json)).toEqual(
        stored.results.map((r) => r.envelope_json)
      );
      const [input] = await prisma.marketCycleInput.findMany();
      expect(input.retuning_observed).toBe(true);
      expect(
        JSON.parse(gunzipSync(Buffer.from(input.bundle_gz)).toString('utf8'))
          .retuning
      ).toBe(true);
    });

    it('enforced: applied, and all four are CAUTIONARY with RETUNING', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const plan = planOf(v1);
      plan.cycles[0]['retuning'] = true;
      await seedPlanInto(prisma, plan);
      await processorWith({ retuningEnforced: true }).handle(
        fakeJob(readyJobData(v1, { retuning: true })),
        NOW(v1)
      );
      const outputs = await rows(v1.slot);
      expect(outputs.map((r) => r.status)).toEqual([
        'CAUTIONARY',
        'CAUTIONARY',
        'CAUTIONARY',
        'CAUTIONARY',
      ]);
      expect(
        outputs.every((r) => r.retuning_observed && r.retuning_applied)
      ).toBe(true);
      for (const row of outputs)
        expect((row.envelope as any).status_reasons).toContain('RETUNING');
    });
  });

  // ------------------------------------------------------------------ the 90-day cleanup

  describe('the 90-day cleanup of stored bundles, on the real table', () => {
    const bundleRow = (cycle_slot: number, symbol = 'XAUUSD') => ({
      symbol,
      cycle_slot,
      bundle_gz: Buffer.from('x'),
      bundle_encoding: 'gzip',
      bundle_bytes: 1,
      inputs_sha256: 'h',
      retuning_observed: false,
    });

    it('deletes the bundles older than 90 days in the cycle’s own transaction and no reading', async () => {
      const v1 = FIXTURE_SLOTS[0];
      await seedPlanInto(prisma, planOf(v1));
      const now = NOW(v1);
      const cutoff = now - 90 * DAY;
      await prisma.marketCycleInput.createMany({
        data: [
          bundleRow(cutoff - 300),
          bundleRow(cutoff - 1),
          bundleRow(cutoff),
          bundleRow(cutoff + 300),
          bundleRow(now - DAY),
        ] as never,
      });
      await prisma.mcdOutput.create({
        data: { ...unitResultRow(cutoff - 300) } as never,
      });
      const outcome = written(
        await processorWith().handle(fakeJob(readyJobData(v1)), now)
      );
      expect(outcome.inputsDeleted).toBe(2);
      expect(
        (
          await prisma.marketCycleInput.findMany({
            orderBy: { cycle_slot: 'asc' },
          })
        ).map((r) => r.cycle_slot)
      ).toEqual(
        [cutoff, cutoff + 300, now - DAY, v1.slot].sort((a, b) => a - b)
      );
      // no foreign key, no retention of readings: the old reading outlives its bundle
      expect(
        await prisma.mcdOutput.count({ where: { cycle_slot: cutoff - 300 } })
      ).toBe(1);
    });

    function unitResultRow(cycle_slot: number) {
      const reading = unitResult().results[0];
      return {
        symbol: 'XAUUSD',
        cycle_slot,
        mcd_id: reading.mcd_id,
        flag: 'shadow',
        evaluator_version: reading.evaluator_version,
        status: reading.status,
        state_code: reading.state_code,
        bias: reading.bias,
        envelope_json: reading.envelope_json,
        envelope: JSON.parse(reading.envelope_json),
        envelope_sha256: reading.envelope_sha256,
        evaluator_envelope_sha256: reading.evaluator_envelope_sha256,
        inputs_sha256: null,
        retuning_observed: false,
        retuning_applied: false,
        runner_version: '1.0.0',
        python_version: '3.11.9',
        duration_ms: 1,
        evaluated_at: 1,
      };
    }
  });

  // ------------------------------------------------------------------ atomic

  describe('a cycle is written whole or not at all, on the real database', () => {
    it('a bundle row the database refuses takes the readings written before it back with it', async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TRIGGER sensor_test_boom BEFORE INSERT ON market_cycle_inputs FOR EACH ROW EXECUTE FUNCTION sensor_test_refuse_boom()'
      );
      try {
        const v1 = FIXTURE_SLOTS[0];
        // the first statement (the readings) succeeds inside the transaction, the second (the bundle) is refused
        await expect(
          writer.writeCycle({
            symbol: 'BOOM',
            slot: v1.slot,
            result: unitResult(v1, { symbol: 'BOOM' }),
            evaluatedAt: NOW(v1),
          })
        ).rejects.toThrow(/sensor_test_refuse_boom/);
        expect(
          await prisma.mcdOutput.count({ where: { symbol: 'BOOM' } })
        ).toBe(0);
        expect(
          await prisma.marketCycleInput.count({ where: { symbol: 'BOOM' } })
        ).toBe(0);
        // the same cycle for the real symbol is not affected by the trigger
        const ok = await writer.writeCycle({
          symbol: 'XAUUSD',
          slot: v1.slot,
          result: unitResult(v1),
          evaluatedAt: NOW(v1),
        });
        expect(ok).toMatchObject({ outputsInserted: 4, inputsInserted: true });
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS sensor_test_boom ON market_cycle_inputs'
        );
      }
    });

    it('a reading the CHECK refuses (flag off) leaves no bundle and no other reading', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const result = unitResult(v1);
      result.results[3] = { ...result.results[3], flag: 'off' };
      await expect(
        writer.writeCycle({
          symbol: 'XAUUSD',
          slot: v1.slot,
          result,
          evaluatedAt: NOW(v1),
        })
      ).rejects.toThrow(/mcd_outputs_flag_is_shadow_or_live/);
      expect(await prisma.mcdOutput.count()).toBe(0);
      expect(await prisma.marketCycleInput.count()).toBe(0);
    });

    it('a cycle the writer refuses before the database (a tampered envelope) never reaches it', async () => {
      const v1 = FIXTURE_SLOTS[0];
      const result = unitResult(v1);
      result.results[1] = {
        ...result.results[1],
        envelope_sha256: 'f'.repeat(64),
      };
      await expect(
        writer.writeCycle({
          symbol: 'XAUUSD',
          slot: v1.slot,
          result,
          evaluatedAt: NOW(v1),
        })
      ).rejects.toThrow(/cycle refused, nothing written/);
      expect(await prisma.mcdOutput.count()).toBe(0);
    });
  });

  // ------------------------------------------------------------------ the empty-data case

  it('createMany with nothing to insert is not an error: a cycle with no bundle text writes its readings only', async () => {
    const v1 = FIXTURE_SLOTS[0];
    const summary = await writer.writeCycle({
      symbol: 'XAUUSD',
      slot: v1.slot,
      result: unitResult(v1, {
        bundle_canonical_json: null,
        inputs_sha256: null,
      }),
      evaluatedAt: NOW(v1),
    });
    expect(summary).toMatchObject({
      outputsInserted: 4,
      inputsInserted: false,
    });
    expect(await prisma.marketCycleInput.count()).toBe(0);
    expect((await rows(v1.slot)).every((r) => r.inputs_sha256 === null)).toBe(
      true
    );
  });
});
