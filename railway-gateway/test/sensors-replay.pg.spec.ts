/**
 * Replay on a REAL Postgres, with the REAL Python runner (build step 3, part 5): the sensor worker writes a
 * cycle exactly as it does in production (a fake `cycle-ready` job, then the real loader, runner, validator and
 * writer, `test/sensors-worker.pg.spec.ts`), and a replay then reads what the worker stored, from the two sensor
 * tables alone, and runs it again.
 *
 * It shows, on the database: every stored cycle (v1, v3, v4) replays VERIFIED, byte for byte, after the market
 * tables that fed it are gone; the same three in one `scripts/replay-cycle.js --db` command; a changed byte of the
 * stored bundle is TAMPERED_BUNDLE; a bundle and its hash rewritten together is still caught, by the readings; an
 * older evaluator's row is VERSION_MISMATCH; a changed envelope under the same version is LOGIC_DIVERGENCE; a row that
 * does not hash to itself is STORED_READING_CORRUPT; the 90-day retention (a bundle deleted, readings kept) is
 * NOT_REPLAYABLE; a cycle made under enforced RETUNING replays under it; and a replay changes no row.
 *
 * SKIPPED unless ALL of these hold (the same gate as the worker's spec):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics, indicator_configs,
 *                        market_cycles, active_indicator_settings, mcd_outputs and market_cycle_inputs in that database
 *   Python 3 with PyYAML and jsonschema on the PATH (SENSOR_PYTHON names another interpreter)
 *
 * To run it on a throwaway database: the recipe in the header of test/sensors-worker.pg.spec.ts (a scratch
 * cluster, the gateway's tables without the three sensor tables, then the sensor migration itself), and
 *   CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest test/sensors-replay.pg.spec.ts
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
import { CycleReadyProcessor } from '../src/sensors/cycle-ready.processor';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { PythonCycleRunner } from '../src/sensors/python-runner';
import {
  CycleReplayReport,
  CycleReplayer,
  loadStoredCycle,
  runReplayCommand,
} from '../src/sensors/replay';
import { SensorConfig } from '../src/sensors/sensor-config';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
} from './helpers/cycle-fixtures';
import { SeedPlan, buildSeedPlan } from './helpers/inputs-world';
import { pythonAvailable } from './helpers/kit-runner';
import { seedPlanInto } from './helpers/pg-seed';
import { fakeJob, readyJobData, sha256 } from './helpers/sensors-worker-world';

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
const [V1] = FIXTURE_SLOTS;

suite('replay of cycles the worker stored, on a real Postgres', () => {
  jest.setTimeout(300_000);
  let prisma: PrismaService;
  let dir: string;
  let shadow: string;
  let subset: string;
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

  async function wipeMarket(): Promise<void> {
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
  async function wipe(): Promise<void> {
    // TRUNCATE, not DELETE, for the sensor tables: it also resets the planner statistics, which
    // sensor-tables.pg.spec.ts (the index-use test) reads, so the gated specs pass in any order
    await prisma.$executeRawUnsafe('TRUNCATE mcd_outputs, market_cycle_inputs');
    await wipeMarket();
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-replay-pg-'));
    shadow = path.join(dir, 'shadow.yaml');
    fs.writeFileSync(
      shadow,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'shadow'\n  MCD2: 'shadow'\n  MCD3: 'shadow'\n",
      'utf8'
    );
    subset = path.join(dir, 'subset.yaml');
    fs.writeFileSync(
      subset,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'off'\n  MCD2: 'shadow'\n  MCD3: 'off'\n",
      'utf8'
    );
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
    writer = new McdOutputsWriter(prisma, new EnvelopeValidator());
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

  const planOf = (fixture: FixtureSlot, retuning = false): SeedPlan => {
    const plan = buildSeedPlan(readFixtureBundle(fixture));
    if (retuning) plan.cycles[0]['retuning'] = true;
    return plan;
  };

  /** The worker, as in production: seed the market tables, run a `cycle-ready` job, and the sensor tables are written. */
  async function workerWrites(
    fixture: FixtureSlot,
    over: Partial<SensorConfig> = {},
    retuning = false
  ): Promise<void> {
    await seedPlanInto(prisma, planOf(fixture, retuning));
    const outcome = await processorWith(over).handle(
      fakeJob(readyJobData(fixture, { retuning })),
      fixture.slot + 70
    );
    expect(outcome?.outcome).toBe('WRITTEN');
  }

  const replayer = () =>
    new CycleReplayer({
      python: PYTHON,
      engineDir: ENGINE_DIR,
      runnerTimeoutMs: 120_000,
    });
  const replay = async (fixture: FixtureSlot): Promise<CycleReplayReport> =>
    replayer().replay(await loadStoredCycle(prisma, 'XAUUSD', fixture.slot));

  const update = (
    fixture: FixtureSlot,
    mcdId: string,
    data: Record<string, unknown>
  ) =>
    prisma.mcdOutput.update({
      where: {
        symbol_cycle_slot_mcd_id: {
          symbol: 'XAUUSD',
          cycle_slot: fixture.slot,
          mcd_id: mcdId,
        },
      },
      data: data as never,
    });
  const reading = (fixture: FixtureSlot, mcdId: string) =>
    prisma.mcdOutput.findUniqueOrThrow({
      where: {
        symbol_cycle_slot_mcd_id: {
          symbol: 'XAUUSD',
          cycle_slot: fixture.slot,
          mcd_id: mcdId,
        },
      },
    });
  const bundleRow = (fixture: FixtureSlot) =>
    prisma.marketCycleInput.findUniqueOrThrow({
      where: {
        symbol_cycle_slot: { symbol: 'XAUUSD', cycle_slot: fixture.slot },
      },
    });
  const bundleText = async (fixture: FixtureSlot) =>
    gunzipSync(Buffer.from((await bundleRow(fixture)).bundle_gz)).toString(
      'utf8'
    );

  /** Every stored row of both sensor tables as text: what a read-only replay must leave exactly as it was. */
  async function snapshot(): Promise<string> {
    const outputs = await prisma.mcdOutput.findMany({
      orderBy: [{ cycle_slot: 'asc' }, { mcd_id: 'asc' }],
    });
    const inputs = await prisma.marketCycleInput.findMany({
      orderBy: { cycle_slot: 'asc' },
    });
    return sha256(
      JSON.stringify({
        outputs,
        inputs: inputs.map((i) => ({
          ...i,
          bundle_gz: Buffer.from(i.bundle_gz).toString('base64'),
        })),
      })
    );
  }

  // ------------------------------------------------------------------ determinism

  describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'the stored cycle %s',
    (_name, fixture) => {
      it('is VERIFIED: the stored bundle and the stored readings, read from the database, replay byte for byte', async () => {
        await workerWrites(fixture);
        const report = await replay(fixture);
        expect(report).toMatchObject({
          origin: 'database',
          slot: fixture.slot,
          verdict: 'VERIFIED',
          findings: [],
        });
        expect(report.mcds.map((m) => [m.mcdId, m.verdict])).toEqual([
          ['MCD0', 'VERIFIED'],
          ['MCD1', 'VERIFIED'],
          ['MCD2', 'VERIFIED'],
          ['MCD3', 'VERIFIED'],
        ]);
        const row = await bundleRow(fixture);
        expect(report.inputs).toEqual({
          storedSha256: row.inputs_sha256,
          textSha256: row.inputs_sha256,
          replayedSha256: row.inputs_sha256,
        });
        for (const mcd of report.mcds) {
          const stored = await reading(fixture, mcd.mcdId);
          expect(mcd.replayedEnvelopeSha256).toBe(stored.envelope_sha256);
          expect(mcd).toMatchObject({ textEqual: true, hashEqual: true });
        }
      });

      it('still replays after the tables that fed it are gone: the stored bundle is what is replayed, not market_data_v6', async () => {
        await workerWrites(fixture);
        await wipeMarket();
        expect(await prisma.marketDataV6.count()).toBe(0);
        expect(await prisma.indicatorStatistic.count()).toBe(0);
        const report = await replay(fixture);
        expect(report.verdict).toBe('VERIFIED');
      });
    }
  );

  it('a replay reads only: both sensor tables are exactly as they were after a VERIFIED replay and after a replay that found a difference', async () => {
    await workerWrites(V1);
    const before = await snapshot();
    expect((await replay(V1)).verdict).toBe('VERIFIED');
    expect(await snapshot()).toBe(before);

    const older = await reading(V1, 'MCD1');
    const asOld = older.envelope_json.replace(
      '"evaluator_version":"2.0.1"',
      '"evaluator_version":"2.0.0"'
    );
    await update(V1, 'MCD1', {
      envelope_json: asOld,
      envelope_sha256: sha256(asOld),
      evaluator_version: '2.0.0',
    });
    const changed = await snapshot();
    expect((await replay(V1)).verdict).toBe('VERSION_MISMATCH');
    expect(await snapshot()).toBe(changed);
  });

  it('replays v1, v3 and v4 in one command from the database: three VERIFIED, exit 0, the database closed', async () => {
    for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
    expect(await prisma.mcdOutput.count()).toBe(12);
    expect(await prisma.marketCycleInput.count()).toBe(3);
    let closed = 0;
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
          close: async () => {
            closed += 1;
          },
        }),
      }
    );
    expect(result.reports.map((r) => r.verdict)).toEqual([
      'VERIFIED',
      'VERIFIED',
      'VERIFIED',
    ]);
    expect(result.exitCode).toBe(0);
    expect(closed).toBe(1);
  });

  it('scripts/replay-cycle.js --db, the real script against this database: slots as ISO text and as unix seconds, exit 0', async () => {
    for (const fixture of FIXTURE_SLOTS) await workerWrites(fixture);
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        [path.join(ROOT, 'scripts', 'replay-cycle.js'), ...args],
        {
          cwd: ROOT,
          encoding: 'utf8',
          timeout: 280_000,
          env: { ...process.env, DATABASE_URL: URL },
        }
      );
    const all = run([
      '--db',
      '--slot',
      '2026-09-18T20:55Z',
      '--slot',
      String(FIXTURE_SLOTS[1].slot),
      '--slot',
      '2026-09-28T23:15Z',
    ]);
    expect(all.stderr).toBe('');
    expect(all.status).toBe(0);
    expect(all.stdout).toContain('3 cycle(s): 3 VERIFIED');
    expect(all.stdout).toContain('from the database');

    const missing = run(['--db', '--slot', '2026-09-18T21:00Z']);
    expect(missing.status).toBe(2);
    expect(missing.stdout).toContain('NOT_REPLAYABLE (NOTHING_STORED)');
  });

  it('a cycle stored with only MCD0 and MCD2 on replays with only those two', async () => {
    await workerWrites(V1, { workerConfigPath: subset });
    expect(
      (await prisma.mcdOutput.findMany()).map((r) => r.mcd_id).sort()
    ).toEqual(['MCD0', 'MCD2']);
    const report = await replay(V1);
    expect(report.verdict).toBe('VERIFIED');
    expect(report.mcds.map((m) => m.mcdId)).toEqual(['MCD0', 'MCD2']);
  });

  // ------------------------------------------------------------------ RETUNING

  describe('RETUNING: the cycle replays under the rule it was made under', () => {
    it('enforced: all four CAUTIONARY with RETUNING on the rows, and the replay is told to enforce, VERIFIED', async () => {
      await workerWrites(V1, { retuningEnforced: true }, true);
      const rows = await prisma.mcdOutput.findMany();
      expect(rows.every((r) => r.retuning_observed && r.retuning_applied)).toBe(
        true
      );
      const report = await replay(V1);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.retuning).toMatchObject({
        enforcedForReplay: true,
        storedApplied: true,
        replayedApplied: true,
        storedObserved: true,
        replayedObserved: true,
      });
    });

    it('observed and not applied: the replay is not told to enforce, and the envelopes stay the ordinary ones, VERIFIED', async () => {
      await workerWrites(V1, { retuningEnforced: false }, true);
      const report = await replay(V1);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.retuning).toMatchObject({
        enforcedForReplay: false,
        storedApplied: false,
        storedObserved: true,
        replayedObserved: true,
      });
    });

    it('readings of one slot made under different enforcement are NOT_REPLAYABLE (MIXED_RETUNING)', async () => {
      await workerWrites(V1);
      await update(V1, 'MCD2', { retuning_applied: true });
      const report = await replay(V1);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'MIXED_RETUNING',
      });
    });
  });

  // ------------------------------------------------------------------ the findings, on stored rows

  describe('what a replay says when the stored cycle has been changed', () => {
    it('(b) one changed byte of the stored bundle is TAMPERED_BUNDLE, and nothing was run', async () => {
      await workerWrites(V1);
      const row = await bundleRow(V1);
      const text = await bundleText(V1);
      const altered = text.replace('4326.5', '4326.6');
      expect(altered).not.toBe(text);
      await prisma.marketCycleInput.update({
        where: { id: row.id },
        data: { bundle_gz: gzipSync(Buffer.from(altered, 'utf8')) },
      });
      const report = await replay(V1);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'HASH',
        mcds: [],
        inputs: { replayedSha256: null, storedSha256: row.inputs_sha256 },
        runner: { wallMs: null },
      });
      expect(report.inputs.textSha256).toBe(sha256(altered));
    });

    it('(b) a bundle rewritten together with its hash and length, the readings left alone, is TAMPERED_BUNDLE: the readings name the old inputs', async () => {
      await workerWrites(V1);
      const row = await bundleRow(V1);
      const altered = (await bundleText(V1)).replace('4326.5', '4326.6');
      await prisma.marketCycleInput.update({
        where: { id: row.id },
        data: {
          bundle_gz: gzipSync(Buffer.from(altered, 'utf8')),
          bundle_bytes: Buffer.byteLength(altered, 'utf8'),
          inputs_sha256: sha256(altered),
        },
      });
      const report = await replay(V1);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'READINGS_NAME_OTHER_INPUTS',
      });
    });

    it('(c) a row written by evaluator 2.0.0 is VERSION_MISMATCH against evaluator 2.0.1; the other MCDs stay VERIFIED', async () => {
      await workerWrites(V1);
      const row = await reading(V1, 'MCD1');
      const asOld = row.envelope_json.replace(
        '"evaluator_version":"2.0.1"',
        '"evaluator_version":"2.0.0"'
      );
      expect(asOld).not.toBe(row.envelope_json);
      await update(V1, 'MCD1', {
        envelope_json: asOld,
        envelope_sha256: sha256(asOld),
        evaluator_version: '2.0.0',
      });
      const report = await replay(V1);
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.mcds.map((m) => [m.mcdId, m.verdict])).toEqual([
        ['MCD0', 'VERIFIED'],
        ['MCD1', 'VERSION_MISMATCH'],
        ['MCD2', 'VERIFIED'],
        ['MCD3', 'VERIFIED'],
      ]);
      expect(report.mcds[1]).toMatchObject({
        storedEvaluatorVersion: '2.0.0',
        replayedEvaluatorVersion: '2.0.1',
      });
    });

    it('(d) the same version and inputs with another envelope on file is LOGIC_DIVERGENCE, located', async () => {
      await workerWrites(V1);
      const row = await reading(V1, 'MCD2');
      const changed = row.envelope_json.replace(
        '"status":"CAUTIONARY"',
        '"status":"VALID"'
      );
      expect(changed).not.toBe(row.envelope_json);
      await update(V1, 'MCD2', {
        envelope_json: changed,
        envelope_sha256: sha256(changed),
      });
      const report = await replay(V1);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(
        report.mcds.filter((m) => m.verdict !== 'VERIFIED').map((m) => m.mcdId)
      ).toEqual(['MCD2']);
      expect(report.mcds[2].difference?.stored).toContain('VALID');
    });

    it('a row whose text no longer hashes to its own envelope_sha256 is STORED_READING_CORRUPT', async () => {
      await workerWrites(V1);
      const row = await reading(V1, 'MCD0');
      await update(V1, 'MCD0', {
        envelope_json: row.envelope_json.replace('"VALID"', '"VALIF"'),
      });
      const report = await replay(V1);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.mcds[0].verdict).toBe('STORED_READING_CORRUPT');
    });
  });

  // ------------------------------------------------------------------ retention and absence

  describe('what a replay says when something is not stored', () => {
    it('a bundle past its 90 days is deleted and the readings stay: NOT_REPLAYABLE (NO_STORED_BUNDLE), and the summary says why', async () => {
      await workerWrites(V1);
      await prisma.marketCycleInput.deleteMany({});
      const report = await replay(V1);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_BUNDLE',
      });
      expect(report.summary).toContain('bundles are kept 90 days');
      expect(await prisma.mcdOutput.count()).toBe(4);
    });

    it('a slot the worker never wrote is NOT_REPLAYABLE (NOTHING_STORED)', async () => {
      const report = await replayer().replay(
        await loadStoredCycle(prisma, 'XAUUSD', V1.slot)
      );
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NOTHING_STORED',
      });
    });

    it('a bundle without readings is NOT_REPLAYABLE (NO_STORED_READINGS)', async () => {
      await workerWrites(V1);
      await prisma.mcdOutput.deleteMany({});
      const report = await replay(V1);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_READINGS',
      });
    });

    it('another symbol at the same slot is another cycle: nothing stored', async () => {
      await workerWrites(V1);
      const report = await replayer().replay(
        await loadStoredCycle(prisma, 'EURUSD', V1.slot)
      );
      expect(report.cause).toBe('NOTHING_STORED');
    });
  });
});
