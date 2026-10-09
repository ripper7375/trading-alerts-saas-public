/**
 * Replay and measurement of SYN readings and entry zones on a REAL Postgres, with the REAL Python runner (build step 4 part 6): the
 * sensor worker writes a cycle exactly as it does in production with `SYN` at `shadow` (a fake `cycle-ready` job, then the real loader,
 * runner, validators and writers, `test/sensors-synthesis.pg.spec.ts`), and a replay then reads what the worker stored from the FOUR
 * tables (market_cycle_inputs, mcd_outputs, synthesis_readings, entry_zones) and runs it again; the measurement kit reads the same
 * tables and the log the worker wrote.
 *
 * It shows, on the database: every stored cycle (v1, v3, v4) replays VERIFIED including its SYN readings and entry zones; a replay
 * changes no row; the three in one `scripts/replay-cycle.js --db` command; a stored zone one cent off, a reading with another bias, an
 * older rules version, a trader type with zones and no reading, and a trader type with nothing stored, each told apart; a database
 * that does not have the SYN tables yet (the migration is Davin's to apply) is read as "no SYN rows" with the error the real driver
 * gives; the measurement kit reports the SYN rows, the replay's SYN counts, and the refusals counted from the log and the job outcome.
 *
 * SKIPPED unless ALL of these hold:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics, indicator_configs, market_cycles,
 *                        active_indicator_settings, mcd_outputs, market_cycle_inputs, synthesis_readings and entry_zones in that database
 *   Python 3 with PyYAML and jsonschema on the PATH (SENSOR_PYTHON names another interpreter)
 *
 * To run it on a throwaway database: the recipe in the header of test/sensors-synthesis.pg.spec.ts (a scratch cluster, the gateway's
 * tables without the five sensor and synthesis tables, then the two migration files themselves), and
 *   CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest test/sensors-replay-synthesis.pg.spec.ts
 */
import { Logger } from '@nestjs/common';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { ActiveIndicatorService } from '../src/cycle/active-indicator/active-indicator.service';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleReadyProcessor,
  SensorJobOutcome,
} from '../src/sensors/cycle-ready.processor';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import {
  CliOptions,
  loadSynthesisRows,
  parseArgs,
  runMeasureCommand,
} from '../src/sensors/measure-sensors';
import { parseSynthesisLog } from '../src/sensors/measure-synthesis';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import {
  CycleRunner,
  PythonCycleRunner,
  RunnerRequest,
} from '../src/sensors/python-runner';
import {
  CycleReplayReport,
  CycleReplayer,
  loadStoredCycle,
  runReplayCommand,
} from '../src/sensors/replay';
import { SensorConfig } from '../src/sensors/sensor-config';
import { SynReadingValidator } from '../src/sensors/syn-validator';
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
import {
  fakeJob,
  readyJobData,
  sha256,
  storedSynthesis,
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

const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const ROOT = path.join(__dirname, '..');
const [V1, , V4] = FIXTURE_SLOTS;
const DAY = 'DAY_TRADER';
const SCALP = 'SCALPER';

suite(
  'replay and measurement of SYN rows the worker stored, on a real Postgres',
  () => {
    jest.setTimeout(300_000);
    let prisma: PrismaService;
    let dir: string;
    let shadowSyn: string;
    let writer: McdOutputsWriter;
    /** Every error and warning line the gateway logged, as Railway would hold them. */
    let logged: string[];

    const config = (over: Partial<SensorConfig> = {}): SensorConfig => ({
      retuningEnforced: false,
      python: PYTHON,
      engineDir: ENGINE_DIR,
      workerConfigPath: shadowSyn,
      maxJobAgeSeconds: 600,
      runnerTimeoutMs: 120_000,
      ...over,
    });

    const processorWith = (runner?: (inner: CycleRunner) => CycleRunner) => {
      const cfg = config();
      const python = new PythonCycleRunner(cfg);
      return new CycleReadyProcessor(
        new DatabaseInputsSource(
          prisma,
          new ActiveIndicatorService(prisma, new CycleReaderService(prisma))
        ),
        runner === undefined ? python : runner(python),
        writer,
        cfg
      );
    };

    async function wipeMarket(): Promise<void> {
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
    async function wipe(): Promise<void> {
      await prisma.$executeRawUnsafe(
        'TRUNCATE mcd_outputs, market_cycle_inputs, synthesis_readings, entry_zones'
      );
      await wipeMarket();
    }

    beforeAll(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-replay-syn-pg-'));
      shadowSyn = path.join(dir, 'shadow-syn.yaml');
      fs.writeFileSync(
        shadowSyn,
        "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'shadow'\n  MCD2: 'shadow'\n  MCD3: 'shadow'\n  SYN: 'shadow'\nsynthesis:\n  rules_version: 'draft-1'\n",
        'utf8'
      );
      process.env['DATABASE_URL'] = URL;
      prisma = new PrismaService();
      await prisma.$connect();
      writer = new McdOutputsWriter(
        prisma,
        new EnvelopeValidator(),
        new SynthesisWriter(new SynReadingValidator())
      );
    });
    afterAll(async () => {
      await wipe();
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    });
    beforeEach(async () => {
      await wipe();
      logged = [];
      const keep = (...args: unknown[]): void => {
        logged.push(String(args[0]));
      };
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(keep);
      jest.spyOn(Logger.prototype, 'error').mockImplementation(keep);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    const planOf = (fixture: FixtureSlot): SeedPlan =>
      buildSeedPlan(readFixtureBundle(fixture));

    /** The worker, as in production, SYN at shadow: seed the market tables, run a `cycle-ready` job, and the four tables are written. */
    async function workerWrites(
      fixture: FixtureSlot,
      runner?: (inner: CycleRunner) => CycleRunner
    ): Promise<Extract<SensorJobOutcome, { outcome: 'WRITTEN' }>> {
      await seedPlanInto(prisma, planOf(fixture));
      const outcome = await processorWith(runner).handle(
        fakeJob(readyJobData(fixture)),
        fixture.slot + 70
      );
      expect(outcome?.outcome).toBe('WRITTEN');
      return outcome as Extract<SensorJobOutcome, { outcome: 'WRITTEN' }>;
    }

    const replayer = () =>
      new CycleReplayer({
        python: PYTHON,
        engineDir: ENGINE_DIR,
        runnerTimeoutMs: 120_000,
      });
    const replay = async (fixture: FixtureSlot): Promise<CycleReplayReport> =>
      replayer().replay(await loadStoredCycle(prisma, 'XAUUSD', fixture.slot));

    /** Every stored row of all four tables as text: what a read-only replay and a read-only kit must leave exactly as it was. */
    async function snapshot(): Promise<string> {
      const outputs = await prisma.mcdOutput.findMany({
        orderBy: [{ cycle_slot: 'asc' }, { mcd_id: 'asc' }],
      });
      const inputs = await prisma.marketCycleInput.findMany({
        orderBy: { cycle_slot: 'asc' },
      });
      const readings = await prisma.synthesisReading.findMany({
        orderBy: [{ cycle_slot: 'asc' }, { profile: 'asc' }],
      });
      const zones = await prisma.entryZone.findMany({
        orderBy: [
          { cycle_slot: 'asc' },
          { profile: 'asc' },
          { zone_id: 'asc' },
        ],
      });
      return sha256(
        JSON.stringify({
          outputs,
          readings,
          zones,
          inputs: inputs.map((i) => ({
            ...i,
            bundle_gz: Buffer.from(i.bundle_gz).toString('base64'),
          })),
        })
      );
    }

    const where = (fixture: FixtureSlot, profile: string) =>
      `symbol = 'XAUUSD' AND cycle_slot = ${fixture.slot} AND profile = '${profile}'`;

    // ------------------------------------------------------------------ determinism

    describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      'the stored cycle %s',
      (_name, fixture) => {
        it('is VERIFIED including its SYN readings and entry zones, read from the four tables', async () => {
          await workerWrites(fixture);
          const file = storedSynthesis(fixture);
          const zones = file.readings.reduce(
            (n, r) => n + (JSON.parse(r.zones_json) as unknown[]).length,
            0
          );
          expect(await prisma.synthesisReading.count()).toBe(2);
          expect(await prisma.entryZone.count()).toBe(zones);

          const stored = await loadStoredCycle(prisma, 'XAUUSD', fixture.slot);
          expect(stored.synthesisTablesMissing).toBe(false);
          expect(stored.synthesis?.profiles.map((p) => p.profile)).toEqual([
            DAY,
            SCALP,
          ]);
          // what the database holds is what the engine made, byte for byte
          expect(
            stored.synthesis?.profiles.map((p) => p.readingSha256)
          ).toEqual(file.readings.map((r) => r.reading_sha256));
          expect(stored.synthesis?.profiles.map((p) => p.zonesSha256)).toEqual(
            file.readings.map((r) => r.zones_sha256)
          );
          expect(
            stored.synthesis?.profiles.reduce(
              (n, p) => n + (p.zoneRows?.length ?? 0),
              0
            )
          ).toBe(zones);

          const report = await replayer().replay(stored);
          expect(report).toMatchObject({
            origin: 'database',
            slot: fixture.slot,
            verdict: 'VERIFIED',
            findings: [],
          });
          expect(report.synthesis).toMatchObject({
            state: 'REPLAYED',
            flag: 'shadow',
            rulesVersion: {
              stored: 'draft-1',
              requested: 'draft-1',
              replayed: 'draft-1',
            },
            notStored: [],
            withheld: [],
            zones: { stored: zones, replayed: zones },
          });
          for (const profile of report.synthesis.profiles) {
            expect(profile).toMatchObject({
              verdict: 'VERIFIED',
              readingEqual: true,
              zonesEqual: true,
              difference: null,
            });
          }
          expect(report.summary).toContain(
            `2 of 2 SYN readings and their ${zones} entry zone(s) equal the stored ones`
          );
        });

        it('still replays after the tables that fed it are gone: the stored bundle and the stored SYN rows are what is replayed', async () => {
          await workerWrites(fixture);
          await wipeMarket();
          expect((await replay(fixture)).verdict).toBe('VERIFIED');
        });
      }
    );

    it('a replay reads only: all four tables are exactly as they were after a VERIFIED replay and after one that found a difference', async () => {
      await workerWrites(V1);
      const before = await snapshot();
      expect((await replay(V1)).verdict).toBe('VERIFIED');
      expect(await snapshot()).toBe(before);

      await prisma.$executeRawUnsafe(
        `UPDATE entry_zones SET low = low + 0.01 WHERE ${where(V1, DAY)} AND zone_id = 'Z1'`
      );
      const changed = await snapshot();
      expect((await replay(V1)).verdict).toBe('STORED_READING_CORRUPT');
      expect(await snapshot()).toBe(changed);
    });

    it('replays v1, v3 and v4 in one command from the database: three VERIFIED with SYN, exit 0', async () => {
      for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
      expect(await prisma.synthesisReading.count()).toBe(6);
      expect(await prisma.entryZone.count()).toBe(8);
      const result = await runReplayCommand(
        {
          db: true,
          fixtures: false,
          slots: FIXTURE_SLOTS.map((f) => f.slot),
          symbol: 'XAUUSD',
          python: null,
          engineDir: null,
          fixturesDir: null,
          json: false,
          help: false,
        },
        {
          env: {},
          openDatabase: async () => ({
            database: prisma,
            close: async () => undefined,
          }),
        }
      );
      expect(result.reports.map((r) => r.verdict)).toEqual([
        'VERIFIED',
        'VERIFIED',
        'VERIFIED',
      ]);
      expect(result.reports.map((r) => r.synthesis.zones.replayed)).toEqual([
        4, 0, 4,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.text.match(/2 of 2 SYN readings/g)).toHaveLength(3);
    });

    it('scripts/replay-cycle.js --db, the real script against this database: SYN lines, three VERIFIED, exit 0', async () => {
      for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
      const run = spawnSync(
        process.execPath,
        [
          path.join(ROOT, 'scripts', 'replay-cycle.js'),
          '--db',
          ...FIXTURE_SLOTS.flatMap((f) => ['--slot', String(f.slot)]),
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
          timeout: 280_000,
          env: { ...process.env, DATABASE_URL: URL },
        }
      );
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('3 cycle(s): 3 VERIFIED');
      expect(
        run.stdout.match(/^ {2}SYN DAY_TRADER {1,2}VERIFIED/gm)
      ).toHaveLength(3);
      expect(run.stdout.match(/^ {2}SYN SCALPER +VERIFIED/gm)).toHaveLength(3);
    });

    // ------------------------------------------------------------------ what a stored row can be made to say

    describe('a stored SYN row changed in the database, and told apart', () => {
      it('an entry_zones row one cent off the zones_json beside the reading: STORED_READING_CORRUPT, for that trader type only', async () => {
        await workerWrites(V1);
        await prisma.$executeRawUnsafe(
          `UPDATE entry_zones SET low = low + 0.01 WHERE ${where(V1, DAY)} AND zone_id = 'Z1'`
        );
        const report = await replay(V1);
        expect(report.verdict).toBe('STORED_READING_CORRUPT');
        expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
        expect(
          report.synthesis.profiles.map((p) => [p.profile, p.verdict])
        ).toEqual([
          [DAY, 'STORED_READING_CORRUPT'],
          [SCALP, 'VERIFIED'],
        ]);
        expect(report.synthesis.profiles[0].detail).toContain(
          'entry_zones: Z1 low is'
        );
      });

      it('a reading with another bias, its text, copy, hash and columns made to agree: LOGIC_DIVERGENCE located in that reading', async () => {
        await workerWrites(V1);
        const row = await prisma.synthesisReading.findFirstOrThrow({
          where: { symbol: 'XAUUSD', cycle_slot: V1.slot, profile: SCALP },
        });
        expect(row.reading_json).toContain('"bias":"LONG"');
        const text = row.reading_json.replace(
          '"bias":"LONG"',
          '"bias":"SHORT"'
        );
        await prisma.$executeRawUnsafe(
          `UPDATE synthesis_readings SET reading_json = $1, reading = $3::jsonb, reading_sha256 = $2, bias = 'SHORT' WHERE ${where(V1, SCALP)}`,
          text,
          sha256(text),
          text
        );
        const report = await replay(V1);
        expect(report.verdict).toBe('LOGIC_DIVERGENCE');
        expect(
          report.synthesis.profiles.map((p) => [p.profile, p.verdict])
        ).toEqual([
          [DAY, 'VERIFIED'],
          [SCALP, 'LOGIC_DIVERGENCE'],
        ]);
        expect(report.synthesis.profiles[1].difference?.in).toBe('reading');
      });

      it('an older rules version on both rows, whose file the engine does not have: VERSION_MISMATCH, found with the real runner, and the sensors VERIFIED', async () => {
        await workerWrites(V1);
        for (const profile of [DAY, SCALP]) {
          const row = await prisma.synthesisReading.findFirstOrThrow({
            where: { symbol: 'XAUUSD', cycle_slot: V1.slot, profile },
          });
          const text = row.reading_json.replace(
            '"rules_version":"draft-1"',
            '"rules_version":"draft-0"'
          );
          expect(text).not.toBe(row.reading_json);
          await prisma.$executeRawUnsafe(
            `UPDATE synthesis_readings SET reading_json = $1, reading = $3::jsonb, reading_sha256 = $2, rules_version = 'draft-0' WHERE ${where(V1, profile)}`,
            text,
            sha256(text),
            text
          );
        }
        const report = await replay(V1);
        expect(report.verdict).toBe('VERSION_MISMATCH');
        expect(report.synthesis.rulesVersion).toEqual({
          stored: 'draft-0',
          requested: 'draft-1',
          replayed: 'draft-1',
        });
        expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
          'VERSION_MISMATCH',
          'VERSION_MISMATCH',
        ]);
        expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
      });

      it('zones with no reading row (there is no foreign key): STORED_READING_CORRUPT, named', async () => {
        await workerWrites(V1);
        await prisma.$executeRawUnsafe(
          `DELETE FROM synthesis_readings WHERE ${where(V1, SCALP)}`
        );
        const report = await replay(V1);
        expect(report.verdict).toBe('STORED_READING_CORRUPT');
        const orphan = report.synthesis.profiles.find(
          (p) => p.profile === SCALP
        );
        expect(orphan?.detail).toBe(
          'entry_zones holds 2 row(s) for SCALPER and synthesis_readings has no row for it'
        );
      });

      it('a trader type with nothing stored (its reading and zones gone) is a note, and the cycle is VERIFIED for what is there', async () => {
        await workerWrites(V1);
        await prisma.$executeRawUnsafe(
          `DELETE FROM entry_zones WHERE ${where(V1, SCALP)}`
        );
        await prisma.$executeRawUnsafe(
          `DELETE FROM synthesis_readings WHERE ${where(V1, SCALP)}`
        );
        const report = await replay(V1);
        expect(report.verdict).toBe('VERIFIED');
        expect(report.synthesis.notStored).toEqual([SCALP]);
        expect(report.findings[0]).toContain(
          'the replay makes a SYN reading for SCALPER and none is stored'
        );
      });

      it('a tampered bundle is TAMPERED_BUNDLE, and the SYN rows are stored and not compared', async () => {
        await workerWrites(V1);
        const row = await prisma.marketCycleInput.findUniqueOrThrow({
          where: {
            symbol_cycle_slot: { symbol: 'XAUUSD', cycle_slot: V1.slot },
          },
        });
        const text = gunzipSync(Buffer.from(row.bundle_gz))
          .toString('utf8')
          .replace('4326.5', '4326.6');
        await prisma.marketCycleInput.update({
          where: {
            symbol_cycle_slot: { symbol: 'XAUUSD', cycle_slot: V1.slot },
          },
          data: { bundle_gz: gzipSync(Buffer.from(text, 'utf8')) },
        });
        const report = await replay(V1);
        expect(report).toMatchObject({
          verdict: 'TAMPERED_BUNDLE',
          tamperReason: 'HASH',
        });
        expect(report.synthesis.state).toBe('STORED');
      });
    });

    // ------------------------------------------------------------------ a database without the tables

    describe('a database that does not have the SYN tables yet', () => {
      const away = async (
        tables: string[],
        body: () => Promise<void>
      ): Promise<void> => {
        for (const t of tables) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE ${t} RENAME TO ${t}_away`
          );
        }
        try {
          await body();
        } finally {
          for (const t of tables) {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE ${t}_away RENAME TO ${t}`
            );
          }
        }
      };

      it.each([
        [['synthesis_readings', 'entry_zones']],
        [['entry_zones']],
        [['synthesis_readings']],
      ])(
        'without %j the replay reads "no SYN rows" with the real driver’s error, notes it, and VERIFIES the sensors',
        async (tables) => {
          await workerWrites(V1);
          await away(tables, async () => {
            const stored = await loadStoredCycle(prisma, 'XAUUSD', V1.slot);
            expect(stored).toMatchObject({
              synthesis: null,
              synthesisTablesMissing: true,
            });
            expect(stored.readings).toHaveLength(4);
            const report = await replayer().replay(stored);
            expect(report.verdict).toBe('VERIFIED');
            expect(report.synthesis.state).toBe('TABLES_MISSING');
            expect(report.findings[0]).toContain('is not applied');
            // the connection is still good after the failed read
            expect(await prisma.mcdOutput.count()).toBe(4);
          });
          // and with the tables back, the cycle replays with its SYN rows again
          expect((await replay(V1)).synthesis.state).toBe('REPLAYED');
        }
      );

      it('the measurement kit reads "no SYN rows" too, with a finding, and the log is still counted', async () => {
        await workerWrites(V1);
        await away(['synthesis_readings', 'entry_zones'], async () => {
          const loaded = await loadSynthesisRows(prisma as never, 'XAUUSD', {
            first: V1.slot,
            last: V1.slot,
          });
          expect(loaded).toEqual({ rows: [], missing: true });
          const log = path.join(dir, 'gateway.log');
          fs.writeFileSync(
            log,
            `Slot ${V1.slot}: SYN_TABLES_MISSING the tables are not there\n`
          );
          const result = await runMeasureCommand(
            options('--db', '--log', log),
            {
              readFile: (file) => fs.readFileSync(file, 'utf8'),
              openDatabase: async () => ({
                database: prisma as never,
                close: async () => undefined,
              }),
            }
          );
          expect(result.report.rows).toBe(4);
          expect(
            result.report.notices.some((f) =>
              f.includes('has no synthesis_readings table yet')
            )
          ).toBe(true);
          expect(
            result.report.findings.some((f) =>
              f.includes('has no synthesis_readings table yet')
            )
          ).toBe(false);
          expect(result.report.synthesis?.refusals.log?.tablesMissing).toBe(1);
          expect(result.report.synthesis?.refusals.stoppedCycles).toEqual([
            V1.slot,
          ]);
        });
      });
    });

    // ------------------------------------------------------------------ the measurement kit on the same database

    const options = (...argv: string[]): CliOptions => {
      const parsed = parseArgs(argv);
      if ('error' in parsed) throw new Error(parsed.error);
      return parsed;
    };
    const synScan = (() => {
      const validator = new SynReadingValidator();
      return (text: string): string[] => {
        const check = validator.check(text);
        return check.ok ? [] : check.problems;
      };
    })();
    const database = () => ({
      openDatabase: async () => ({
        database: prisma as never,
        close: async () => undefined,
      }),
    });

    it('the kit reads the SYN rows of the three stored cycles: 6 rows, the rule hits, the zones per cycle, clean wording, the schema second look passing', async () => {
      for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
      const before = await snapshot();
      const result = await runMeasureCommand(options('--db'), {
        readFile: (file) => fs.readFileSync(file, 'utf8'),
        ...database(),
        scanSynthesis: synScan,
      });
      const s = result.report.synthesis!;
      expect(s).toMatchObject({ rows: 6, cycles: 3 });
      expect(s.rowsPerCycle).toMatchObject({
        complete: 3,
        short: 0,
        sensorCyclesWithoutSyn: [],
      });
      expect(s.profiles[DAY].ruleHits.map((r) => r.ruleId)).toEqual([
        'R1_MACRO_COUNTER_TREND_RALLY',
        'R2_EXHAUSTION_SNAPBACK',
        'R3_TREND_CONTINUATION',
      ]);
      expect(s.zonesPerCycle).toMatchObject({ count: 3, min: 0, max: 4 });
      expect(s.wording).toMatchObject({
        scanned: 6,
        percent: 0,
        banned: 0,
        advice: 0,
        summaryTooLong: 0,
        schema: { ran: true, scanned: 6, failures: 0 },
      });
      expect(result.report.findings.filter((f) => /SYN/.test(f))).toEqual([]);
      expect(await snapshot()).toBe(before);
    });

    it('--replay 3 carries the SYN readings the real replay compared: 6 of 6 VERIFIED', async () => {
      for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
      const result = await runMeasureCommand(options('--db', '--replay', '3'), {
        readFile: (file) => fs.readFileSync(file, 'utf8'),
        ...database(),
        replaySlots: async (db, symbol, slots) => {
          const reports: CycleReplayReport[] = [];
          for (const slot of slots) {
            reports.push(
              await replayer().replay(await loadStoredCycle(db, symbol, slot))
            );
          }
          return reports;
        },
      });
      expect(result.report.determinism).toMatchObject({
        verdict: 'DETERMINISTIC',
        checked: 3,
        synthesis: { replayed: 6, verified: 6 },
      });
      expect(result.text).toContain('SYN readings replayed: 6 of 6 VERIFIED');
    });

    it('a reading the gateway refuses is counted from the log the worker wrote and from the job outcome it returned, and the replay and the kit agree on what is missing', async () => {
      await workerWrites(V4);
      // the gateway's own checks refuse the Day Trader reading of v1 (the zones text no longer hashes to its hash); the Scalper's is written
      class DamagingRunner implements CycleRunner {
        constructor(private readonly inner: CycleRunner) {}
        async run(request: RunnerRequest) {
          const out = await this.inner.run(request);
          const section = out.result.synthesis;
          if (section !== undefined)
            section.readings[0].zones_sha256 = '0'.repeat(64);
          return out;
        }
      }
      const outcome = await workerWrites(
        V1,
        (inner) => new DamagingRunner(inner)
      );
      expect(outcome.synthesis).toMatchObject({
        readingsInserted: 1,
        refused: [{ profile: DAY, source: 'GATEWAY' }],
        error: null,
      });
      expect(
        await prisma.synthesisReading.count({ where: { cycle_slot: V1.slot } })
      ).toBe(1);

      const log = path.join(dir, 'gateway.log');
      fs.writeFileSync(log, logged.join('\n'));
      expect(
        parseSynthesisLog(logged.join('\n')).map((e) => [
          e.kind,
          e.slot,
          e.profile,
          e.source,
        ])
      ).toEqual([['READING_REFUSED', V1.slot, DAY, 'GATEWAY']]);
      const jobsFile = path.join(dir, 'jobs.json');
      fs.writeFileSync(jobsFile, JSON.stringify([outcome]));

      const result = await runMeasureCommand(
        options('--db', '--log', log, '--jobs', jobsFile),
        {
          readFile: (file) => fs.readFileSync(file, 'utf8'),
          ...database(),
          scanSynthesis: synScan,
        }
      );
      const s = result.report.synthesis!;
      expect(s).toMatchObject({ rows: 3, cycles: 2 });
      expect(s.rowsPerCycle.shortCycles).toEqual([
        { slot: V1.slot, have: [SCALP], missing: [DAY] },
      ]);
      expect(s.refusals.log).toMatchObject({
        readingRefused: 1,
        byProfileSource: { 'DAY_TRADER GATEWAY': 1 },
      });
      expect(s.refusals.jobs).toMatchObject({
        written: 1,
        readingRefused: 1,
        byProfileSource: { 'DAY_TRADER GATEWAY': 1 },
      });
      expect(s.refusals.refusedCycles).toEqual([V1.slot]);
      expect(s.refusals.gaps).toEqual({
        checked: 1,
        explained: 1,
        unexplained: [],
      });

      // the replay of that cycle makes the Day Trader reading that nothing stored, and says so, naming the log line to look for
      const report = await replay(V1);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.notStored).toEqual([DAY]);
      expect(report.findings[0]).toContain('SYN_READING_REFUSED');
    });
  }
);
