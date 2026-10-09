import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gzipSync } from 'zlib';
import type { SynthesisRunResult } from '../src/sensors/cycle-run-result';
import { PythonCycleRunner } from '../src/sensors/python-runner';
import {
  CycleReplayReport,
  CycleReplayer,
  ReplayCliOptions,
  StoredCycle,
  runReplayCommand,
} from '../src/sensors/replay';
import {
  ENGINE_DIR,
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
} from './helpers/cycle-fixtures';
import { pythonAvailable } from './helpers/kit-runner';
import {
  withProfile,
  withSynthesisSection,
  withTamperedText,
} from './helpers/replay-world';
import { sha256, storedSynthesis } from './helpers/sensors-worker-world';

/**
 * Replay of SYN readings and entry zones with the REAL Python runner (build step 4 part 6): the three stored cycles, a cycle stored the way
 * the worker stores it with `SYN` at `shadow`, copies of the engine folder with another rules file or other zone parameters, and the
 * command line script. `sensors-replay-synthesis.spec.ts` holds the comparison itself on a fake runner.
 */

const [V1, , V4] = FIXTURE_SLOTS;
const ROOT = path.join(__dirname, '..');
const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const SETTINGS = {
  python: PYTHON,
  engineDir: ENGINE_DIR,
  runnerTimeoutMs: 120_000,
};
const DAY = 'DAY_TRADER';
const SCALP = 'SCALPER';

const pythonSuite = pythonAvailable() ? describe : describe.skip;

pythonSuite('replay of SYN readings with the real Python runner', () => {
  jest.setTimeout(300_000);
  let dir: string;
  let shadowSyn: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-syn-real-'));
    shadowSyn = path.join(dir, 'shadow-syn.yaml');
    fs.writeFileSync(
      shadowSyn,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'shadow'\n  MCD2: 'shadow'\n  MCD3: 'shadow'\n  SYN: 'shadow'\nsynthesis:\n  rules_version: 'draft-1'\n"
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  /** What the worker would have stored for a fixture's bundle with SYN at shadow: the runner’s own text and readings, SYN rows included, in the database form. */
  async function storedByRunnerWithSyn(
    fixture: FixtureSlot
  ): Promise<StoredCycle> {
    const run = await new PythonCycleRunner({
      ...SETTINGS,
      workerConfigPath: shadowSyn,
    }).run({
      bundle: readFixtureBundle(fixture) as unknown,
      retuningEnforced: false,
    });
    const r = run.result;
    const text = r.bundle_canonical_json as string;
    const base: StoredCycle = {
      origin: 'database',
      symbol: r.symbol,
      slot: fixture.slot,
      bundle: {
        form: 'gzip-text',
        gz: gzipSync(Buffer.from(text, 'utf8')),
        encoding: 'gzip',
        bytes: Buffer.byteLength(text, 'utf8'),
        inputsSha256: r.inputs_sha256 as string,
        retuningObserved: r.retuning.observed,
      },
      readings: r.results.map((x) => ({
        mcdId: x.mcd_id,
        flag: x.flag,
        evaluatorVersion: x.evaluator_version,
        envelopeJson: x.envelope_json,
        envelopeSha256: x.envelope_sha256,
        inputsSha256: r.inputs_sha256,
        retuningApplied: r.retuning.applied,
        runnerVersion: r.runner_version,
      })),
      synthesis: null,
      synthesisTablesMissing: false,
    };
    return withSynthesisSection(base, r.synthesis as SynthesisRunResult);
  }

  describe('the three stored cycles (v1, v3, v4)', () => {
    it('--fixtures: every cycle is VERIFIED including the SYN readings and the entry zones, exit 0', async () => {
      const result = await runReplayCommand(options(), { env: {} });
      expect(
        result.reports.map((r) => [
          r.slotIso,
          r.verdict,
          r.mcds.length,
          r.synthesis.state,
          r.synthesis.profiles.map((p) => p.verdict),
          r.synthesis.zones.replayed,
        ])
      ).toEqual([
        [
          '2026-09-18T20:55Z',
          'VERIFIED',
          4,
          'REPLAYED',
          ['VERIFIED', 'VERIFIED'],
          4,
        ],
        [
          '2026-09-28T14:15Z',
          'VERIFIED',
          4,
          'REPLAYED',
          ['VERIFIED', 'VERIFIED'],
          0,
        ],
        [
          '2026-09-28T23:15Z',
          'VERIFIED',
          4,
          'REPLAYED',
          ['VERIFIED', 'VERIFIED'],
          4,
        ],
      ]);
      for (const report of result.reports) {
        expect(report.findings).toEqual([]);
        expect(report.synthesis.zones.stored).toBe(
          report.synthesis.zones.replayed
        );
        for (const p of report.synthesis.profiles)
          expect(p).toMatchObject({
            readingEqual: true,
            zonesEqual: true,
            difference: null,
          });
      }
      expect(result.exitCode).toBe(0);
    });

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      'a cycle stored the way the worker stores it, SYN rows and entry_zones rows included, replays VERIFIED: %s',
      async (_name, fixture) => {
        const stored = await storedByRunnerWithSyn(fixture);
        expect(stored.synthesis?.profiles).toHaveLength(2);
        const report = await new CycleReplayer(SETTINGS).replay(stored);
        expect(report.verdict).toBe('VERIFIED');
        expect(
          report.synthesis.profiles.every((p) => p.verdict === 'VERIFIED')
        ).toBe(true);
        // and what is stored is what the fixture file holds, byte for byte
        const file = storedSynthesis(fixture);
        expect(stored.synthesis?.profiles.map((p) => p.readingSha256)).toEqual(
          file.readings.map((r) => r.reading_sha256)
        );
        expect(stored.synthesis?.profiles.map((p) => p.zonesSha256)).toEqual(
          file.readings.map((r) => r.zones_sha256)
        );
      }
    );

    it('a stored entry_zones row that is one cent off is STORED_READING_CORRUPT, found without a divergence in the engine', async () => {
      const stored = withProfile(await storedByRunnerWithSyn(V1), DAY, (p) => ({
        ...p,
        zoneRows: [
          { ...p.zoneRows![0], low: p.zoneRows![0].low + 0.01 },
          p.zoneRows![1],
        ],
      }));
      const report = await new CycleReplayer(SETTINGS).replay(stored);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
      expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
        'STORED_READING_CORRUPT',
        'VERIFIED',
      ]);
    });

    it('a reading stored with another bias is a LOGIC_DIVERGENCE located in that trader type’s reading, under the same version and hash', async () => {
      const stored = withProfile(
        await storedByRunnerWithSyn(V1),
        SCALP,
        (p) => {
          const text = (p.readingJson as string).replace(
            '"bias":"LONG"',
            '"bias":"SHORT"'
          );
          return { ...p, readingJson: text, readingSha256: sha256(text) };
        }
      );
      const report = await new CycleReplayer(SETTINGS).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(
        report.synthesis.profiles.map((p) => [p.profile, p.verdict])
      ).toEqual([
        [DAY, 'VERIFIED'],
        [SCALP, 'LOGIC_DIVERGENCE'],
      ]);
      expect(report.synthesis.profiles[1].difference?.in).toBe('reading');
    });

    it('a tampered bundle is TAMPERED_BUNDLE and a SYN row cannot say otherwise', async () => {
      const stored = await storedByRunnerWithSyn(V1);
      const report = await new CycleReplayer(SETTINGS).replay(
        withTamperedText(stored, (t) => t.replace('4326.5', '4326.6'))
      );
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'HASH',
      });
      expect(report.synthesis.state).toBe('STORED');
    });
  });

  describe('a copy of the engine folder with another rules file', () => {
    const engines: string[] = [];
    afterAll(() =>
      engines.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))
    );

    /** The Python packages of the engine without their tests, fixtures and caches: enough to run a cycle. */
    function engineCopy(): string {
      const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-engine-'));
      engines.push(copy);
      for (const name of [
        'mcd_common',
        'mcd0',
        'mcd1',
        'mcd2',
        'mcd3',
        'mcd_worker',
      ]) {
        fs.cpSync(path.join(ENGINE_DIR, name), path.join(copy, name), {
          recursive: true,
          filter: (src) =>
            !/[\\/](__pycache__|tests|fixtures)([\\/]|$)/.test(src),
        });
      }
      return copy;
    }
    const rulesFile = (copy: string, version: string): string =>
      path.join(copy, 'mcd_worker', 'synthesis', 'rules', `${version}.yaml`);
    const SUMMARY = 'summary: No rule matched, NEUTRAL';

    it('draft-2 added and made current, draft-1 kept: the replay still asks for draft-1 and the stored cycle is VERIFIED', async () => {
      const stored = await storedByRunnerWithSyn(V1);
      const copy = engineCopy();
      const text = fs.readFileSync(rulesFile(copy, 'draft-1'), 'utf8');
      expect(text).toContain(SUMMARY);
      fs.writeFileSync(
        rulesFile(copy, 'draft-2'),
        text
          .replace('rules_version: draft-1', 'rules_version: draft-2')
          .replace(SUMMARY, 'summary: No rule matched here, NEUTRAL')
      );
      const config = path.join(copy, 'mcd_worker', 'worker_config.yaml');
      fs.writeFileSync(
        config,
        fs
          .readFileSync(config, 'utf8')
          .replace('rules_version: draft-1', 'rules_version: draft-2')
      );

      const report = await new CycleReplayer({
        ...SETTINGS,
        engineDir: copy,
      }).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.rulesVersion).toEqual({
        stored: 'draft-1',
        requested: 'draft-1',
        replayed: 'draft-1',
      });
    });

    it('draft-1 gone and draft-2 current: VERSION_MISMATCH, told apart from a divergence, with the sensors VERIFIED', async () => {
      const stored = await storedByRunnerWithSyn(V1);
      const copy = engineCopy();
      const text = fs.readFileSync(rulesFile(copy, 'draft-1'), 'utf8');
      fs.writeFileSync(
        rulesFile(copy, 'draft-2'),
        text
          .replace('rules_version: draft-1', 'rules_version: draft-2')
          .replace(SUMMARY, 'summary: No rule matched here, NEUTRAL')
      );
      fs.rmSync(rulesFile(copy, 'draft-1'));
      const config = path.join(copy, 'mcd_worker', 'worker_config.yaml');
      fs.writeFileSync(
        config,
        fs
          .readFileSync(config, 'utf8')
          .replace('rules_version: draft-1', 'rules_version: draft-2')
      );

      const report = await new CycleReplayer({
        ...SETTINGS,
        engineDir: copy,
      }).replay(stored);
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.synthesis.rulesVersion).toEqual({
        stored: 'draft-1',
        requested: 'draft-2',
        replayed: 'draft-2',
      });
      expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
        'VERSION_MISMATCH',
        'VERSION_MISMATCH',
      ]);
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
    });

    it('draft-1 edited in place, same version: LOGIC_DIVERGENCE, the file changed without a new version', async () => {
      const stored = await storedByRunnerWithSyn(V1);
      const copy = engineCopy();
      const file = rulesFile(copy, 'draft-1');
      const text = fs.readFileSync(file, 'utf8');
      expect(text).toContain(SUMMARY);
      fs.writeFileSync(
        file,
        text.replace(SUMMARY, 'summary: No rule matched here, NEUTRAL')
      );

      const report = await new CycleReplayer({
        ...SETTINGS,
        engineDir: copy,
      }).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
        'LOGIC_DIVERGENCE',
        'LOGIC_DIVERGENCE',
      ]);
      expect(report.summary).toContain(
        'the rules file changed without a new version'
      );
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
    });

    it('zone_params.yaml edited in place, same version: LOGIC_DIVERGENCE, named', async () => {
      const stored = await storedByRunnerWithSyn(V1);
      const copy = engineCopy();
      const file = path.join(
        copy,
        'mcd_worker',
        'synthesis',
        'zone_params.yaml'
      );
      const text = fs.readFileSync(file, 'utf8');
      expect(text).toContain('value: 0.10');
      fs.writeFileSync(file, text.replace('value: 0.10', 'value: 0.11'));

      const report = await new CycleReplayer({
        ...SETTINGS,
        engineDir: copy,
      }).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.summary).toContain(
        'zone_params.yaml changed without a new version'
      );
    });
  });

  describe('the command line script, on the real engine', () => {
    const script = path.join(ROOT, 'scripts', 'replay-cycle.js');
    const run = (args: string[]) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 240_000,
        env: { ...process.env, DATABASE_URL: '' },
      });

    it('--fixtures prints the SYN readings and zones of v1, v3 and v4 as VERIFIED, exit 0', () => {
      const r = run(['--fixtures']);
      expect(r.status).toBe(0);
      expect(
        r.stdout.match(
          /^ {2}VERIFIED: 4 of 4 readings .*; 2 of 2 SYN readings and their \d+ entry zone\(s\) equal/gm
        )
      ).toHaveLength(3);
      expect(
        r.stdout.match(/^ {2}SYN DAY_TRADER {1,2}VERIFIED/gm)
      ).toHaveLength(3);
      expect(r.stdout.match(/^ {2}SYN SCALPER +VERIFIED/gm)).toHaveLength(3);
      expect(r.stdout).toContain('3 cycle(s): 3 VERIFIED');
    });

    it('--json carries the SYN profiles with their verdicts', () => {
      const r = run(['--fixtures', '--slot', '2026-09-28T23:15Z', '--json']);
      expect(r.status).toBe(0);
      const reports = JSON.parse(r.stdout) as CycleReplayReport[];
      expect(
        reports[0].synthesis.profiles.map((p) => [p.profile, p.verdict])
      ).toEqual([
        [DAY, 'VERIFIED'],
        [SCALP, 'VERIFIED'],
      ]);
      expect(reports[0].synthesis.zones).toEqual({ stored: 4, replayed: 4 });
    });

    it('a fixture folder whose synthesis.json was changed is a LOGIC_DIVERGENCE, exit 1', () => {
      const copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-cli-syn-'));
      try {
        for (const kind of ['cycle', 'bundle', 'synthesis'])
          fs.copyFileSync(
            path.join(FIXTURES_DIR, `${V4.stem}.${kind}.json`),
            path.join(copyDir, `${V4.stem}.${kind}.json`)
          );
        const file = path.join(copyDir, `${V4.stem}.synthesis.json`);
        const section = JSON.parse(
          fs.readFileSync(file, 'utf8')
        ) as SynthesisRunResult;
        const text = (section.readings[0].reading_json as string).replace(
          '"bias":"SHORT"',
          '"bias":"LONG"'
        );
        expect(text).not.toBe(section.readings[0].reading_json);
        section.readings[0].reading_json = text;
        section.readings[0].reading_sha256 = sha256(text);
        fs.writeFileSync(file, JSON.stringify(section));
        const r = run(['--fixtures', '--fixtures-dir', copyDir]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('SYN DAY_TRADER');
        expect(r.stdout).toContain('LOGIC_DIVERGENCE');
        expect(r.stdout).toContain('1 cycle(s): 1 LOGIC_DIVERGENCE');
      } finally {
        fs.rmSync(copyDir, { recursive: true, force: true });
      }
    });
  });

  function options(): ReplayCliOptions {
    return {
      db: false,
      fixtures: true,
      slots: [],
      symbol: 'XAUUSD',
      python: null,
      engineDir: null,
      fixturesDir: null,
      json: false,
      help: false,
    };
  }
});
