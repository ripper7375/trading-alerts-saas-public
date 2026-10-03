import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { slotToIso } from '../src/sensors/inputs/stats-slot';
import {
  CycleReplayer,
  compareReading,
  formatReplayReport,
  inspectStoredBundle,
  loadFixtureCycle,
  loadStoredCycle,
  parseReplayArgs,
  parseSlotArgument,
  runReplayCommand,
} from '../src/sensors/replay';
import type { ReplayCliOptions } from '../src/sensors/replay';
import {
  ENGINE_DIR,
  FIXTURES_DIR,
  FIXTURE_SLOTS,
} from './helpers/cycle-fixtures';
import {
  ENGINE_MCD_IDS,
  RecordingRunner,
  answering,
  asWrittenBy,
  fakeReplayDatabase,
  makeTempRoot,
  resultEqualTo,
  rowsOf,
  storedCycle,
  withChangedEnvelope,
  withReading,
  withTamperedText,
} from './helpers/replay-world';
import { outputOf, sha256 } from './helpers/sensors-worker-world';

/**
 * The details of the replay (build step 3, part 5), one case for each branch of the loaders, the report and the
 * command that `sensors-replay.spec.ts` does not pin by itself: what each column and each field is carried as,
 * what each malformed fixture is refused for, what each line of the text report is for. They were written from a
 * mutation check of `src/sensors/replay.ts`: each one kills mutants that the first spec let through.
 */

const [V1, V3] = FIXTURE_SLOTS;
const OPTIONS: ReplayCliOptions = {
  db: false,
  fixtures: false,
  slots: [],
  symbol: 'XAUUSD',
  python: null,
  engineDir: null,
  fixturesDir: null,
  json: false,
  help: false,
};

const dirs: string[] = [];
afterAll(() =>
  dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))
);

/** A fixture folder with one slot: the real `.cycle.json` after `change`, and a bundle that is never read by a loader. */
function fixtureDir(change: (cycle: Record<string, any>) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-details-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, `${V1.stem}.bundle.json`), '{"x":1}');
  const cycle = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, `${V1.stem}.cycle.json`), 'utf8')
  );
  change(cycle);
  fs.writeFileSync(
    path.join(dir, `${V1.stem}.cycle.json`),
    JSON.stringify(cycle)
  );
  return dir;
}

// ====================================================================== loadStoredCycle

describe('loadStoredCycle carries every column through as it is', () => {
  it('maps each column of the bundle row and of every reading, whatever it holds', async () => {
    const { input, outputs } = rowsOf(storedCycle(V1));
    const oddInput = {
      ...input,
      bundle_gz: Buffer.from('zz'),
      bundle_encoding: 'zstd',
      bundle_bytes: 7,
      inputs_sha256: 'ii',
      retuning_observed: true,
    };
    const oddOutputs = outputs.map((o, i) => ({
      ...o,
      flag: i === 0 ? 'live' : 'shadow',
      evaluator_version: `9.${i}.0`,
      envelope_json: `json-${i}`,
      envelope_sha256: `hash-${i}`,
      inputs_sha256: `inputs-${i}`,
      retuning_applied: i % 2 === 0,
      runner_version: `runner-${i}`,
    }));
    const loaded = await loadStoredCycle(
      fakeReplayDatabase(oddInput, oddOutputs).database,
      'XAUUSD',
      V1.slot
    );
    expect(loaded.bundle).toEqual({
      form: 'gzip-text',
      gz: Buffer.from('zz'),
      encoding: 'zstd',
      bytes: 7,
      inputsSha256: 'ii',
      retuningObserved: true,
    });
    expect(loaded.readings.map((r) => ({ ...r }))).toEqual(
      outputs.map((_o, i) => ({
        mcdId: ENGINE_MCD_IDS[i],
        flag: i === 0 ? 'live' : 'shadow',
        evaluatorVersion: `9.${i}.0`,
        envelopeJson: `json-${i}`,
        envelopeSha256: `hash-${i}`,
        inputsSha256: `inputs-${i}`,
        retuningApplied: i % 2 === 0,
        runnerVersion: `runner-${i}`,
      }))
    );
  });

  it('asks both tables for the symbol and the slot it was given', async () => {
    const db = fakeReplayDatabase(null, []);
    const loaded = await loadStoredCycle(db.database, 'EURUSD', V3.slot);
    expect(loaded).toMatchObject({ symbol: 'EURUSD', slot: V3.slot });
    expect(db.findUnique.mock.calls[0][0].where).toEqual({
      symbol_cycle_slot: { symbol: 'EURUSD', cycle_slot: V3.slot },
    });
    expect(db.findMany.mock.calls[0][0].where).toEqual({
      symbol: 'EURUSD',
      cycle_slot: V3.slot,
    });
  });
});

// ====================================================================== the fixtures

describe('the fixture loader: what each file must hold', () => {
  it('a folder with only the bundle, or only the cycle, has nothing stored for the slot', () => {
    for (const keep of ['bundle', 'cycle']) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-details-'));
      dirs.push(dir);
      fs.writeFileSync(path.join(dir, `${V1.stem}.${keep}.json`), '{}');
      expect(loadFixtureCycle(dir, V1.slot)).toMatchObject({
        origin: 'fixture',
        bundle: null,
        readings: [],
      });
    }
  });

  it.each([
    ['no symbol', (c: any) => delete c.symbol],
    ['no inputs_sha256', (c: any) => delete c.inputs_sha256],
    ['no runner_version', (c: any) => delete c.runner_version],
    ['no retuning', (c: any) => delete c.retuning],
    ['no retuning.observed', (c: any) => delete c.retuning.observed],
    ['no retuning.applied', (c: any) => delete c.retuning.applied],
    ['no results', (c: any) => delete c.results],
    ['a results that is not a list', (c: any) => (c.results = {})],
    ['a retuning that is not an object', (c: any) => (c.retuning = true)],
  ])('refuses a stored cycle with %s, naming the file', (_what, change) => {
    const dir = fixtureDir(change);
    expect(() => loadFixtureCycle(dir, V1.slot)).toThrow(
      `${V1.stem}.cycle.json is not a stored cycle`
    );
  });

  it.each([
    ['mcd_id'],
    ['flag'],
    ['evaluator_version'],
    ['envelope_json'],
    ['envelope_sha256'],
  ])(
    'refuses a stored reading without %s, naming its place in the list',
    (key) => {
      const dir = fixtureDir((c) => delete c.results[2][key]);
      expect(() => loadFixtureCycle(dir, V1.slot)).toThrow(
        `${V1.stem}.cycle.json: results[2] is not a stored reading`
      );
    }
  );

  it.each([[5], [null], ['text'], [[]]])(
    'refuses a stored reading that is not an object (%j), without a crash of its own',
    (entry) => {
      const dir = fixtureDir((c) => (c.results[0] = entry));
      expect(() => loadFixtureCycle(dir, V1.slot)).toThrow(
        'results[0] is not a stored reading'
      );
    }
  );

  it('carries what the cycle file says: RETUNING observed and applied, the runner version, the flag, the symbol and the stored hash', () => {
    for (const [observed, applied] of [
      [true, true],
      [true, false],
      [false, true],
    ] as const) {
      const dir = fixtureDir((c) => {
        c.retuning = { observed, enforced: applied, applied };
        c.runner_version = '7.7.7';
        c.symbol = 'EURUSD';
        c.inputs_sha256 = 'f'.repeat(64);
        c.results[1].flag = 'live';
      });
      const loaded = loadFixtureCycle(dir, V1.slot);
      expect(loaded.symbol).toBe('EURUSD');
      expect(loaded.bundle).toEqual({
        form: 'parsed',
        bundle: { x: 1 },
        inputsSha256: 'f'.repeat(64),
        retuningObserved: observed,
      });
      expect(loaded.readings).toHaveLength(4);
      for (const r of loaded.readings) {
        expect(r.retuningApplied).toBe(applied);
        expect(r.runnerVersion).toBe('7.7.7');
        expect(r.inputsSha256).toBe('f'.repeat(64));
      }
      expect(loaded.readings.map((r) => r.flag)).toEqual([
        'shadow',
        'live',
        'shadow',
        'shadow',
      ]);
    }
  });

  it('sorts the readings by MCD number whatever order the file lists them in', () => {
    const dir = fixtureDir((c) => c.results.reverse());
    expect(loadFixtureCycle(dir, V1.slot).readings.map((r) => r.mcdId)).toEqual(
      ENGINE_MCD_IDS
    );
  });
});

// ====================================================================== the stored inputs and one reading

describe('inspectStoredBundle and compareReading: the words and the fields', () => {
  it('a text that is JSON and not a bundle (null, a number) is OTHER_CYCLE: "something that is not a bundle"', () => {
    for (const text of ['null', '5', '"text"']) {
      const result = inspectStoredBundle(storedCycle(V1, text));
      expect(result).toMatchObject({ ok: false, reason: 'OTHER_CYCLE' });
      if (!result.ok)
        expect(result.detail).toContain('something that is not a bundle');
    }
  });

  it('says "was" for one reading that names other inputs and "were" for several', () => {
    const one = inspectStoredBundle(
      withReading(storedCycle(V1), 'MCD2', (r) => ({ ...r, inputsSha256: 'x' }))
    );
    const two = inspectStoredBundle(
      withReading(
        withReading(storedCycle(V1), 'MCD2', (r) => ({
          ...r,
          inputsSha256: 'x',
        })),
        'MCD3',
        (r) => ({ ...r, inputsSha256: 'y' })
      )
    );
    if (one.ok || two.ok) throw new Error('both should refuse');
    expect(one.detail).toContain(
      'MCD2 was made from inputs x, not the stored bundle'
    );
    expect(two.detail).toContain(
      'MCD2, MCD3 were made from inputs x, y, not the stored bundle'
    );
  });

  it('a corrupt stored row still shows what the replay gave for that MCD, when it gave something', () => {
    const stored = storedCycle(V1);
    const replayed = resultEqualTo(stored, V1).results[1];
    const row = { ...stored.readings[1], envelopeSha256: 'c'.repeat(64) };
    expect(compareReading(row, V1.slot, replayed)).toMatchObject({
      verdict: 'STORED_READING_CORRUPT',
      replayedEvaluatorVersion: '2.0.1',
      replayedEnvelopeSha256: sha256(replayed.envelope_json),
    });
  });
});

// ====================================================================== the replayer's report

describe('CycleReplayer: what the report carries in each case', () => {
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const replayer = (runner: RecordingRunner) =>
    new CycleReplayer(
      {
        python: 'py-under-test',
        engineDir: 'not/the/engine',
        runnerTimeoutMs: 4321,
      },
      runner.hooks(tempRoot)
    );

  it('starts the runner with the interpreter, the engine folder and the time limit it was given', async () => {
    const stored = storedCycle(V1);
    const runner = answering(resultEqualTo(stored, V1));
    await replayer(runner).replay(stored);
    expect(runner.starts[0].settings).toMatchObject({
      python: 'py-under-test',
      engineDir: 'not/the/engine',
      runnerTimeoutMs: 4321,
    });
  });

  it('says the runner changed, with the runner versions, on a version mismatch too, and says nothing when the runner is the same', async () => {
    const stored = withReading(storedCycle(V1), 'MCD1', (r) =>
      asWrittenBy(r, '2.0.0')
    );
    const changed = await replayer(
      answering(resultEqualTo(storedCycle(V1), V1, { runner_version: '1.2.0' }))
    ).replay(stored);
    expect(changed.verdict).toBe('VERSION_MISMATCH');
    expect(changed.findings).toEqual([
      'the runner is 1.2.0 now, the rows were written by 1.0.0',
    ]);
    const same = await replayer(
      answering(resultEqualTo(storedCycle(V1), V1))
    ).replay(stored);
    expect(same.verdict).toBe('VERSION_MISMATCH');
    expect(same.findings).toEqual([]);
  });

  it('a divergence under the same runner has no finding of its own: the MCD line says it all', async () => {
    const stored = withReading(storedCycle(V1), 'MCD2', (r) =>
      withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
    );
    const report = await replayer(
      answering(resultEqualTo(storedCycle(V1), V1))
    ).replay(stored);
    expect(report.verdict).toBe('LOGIC_DIVERGENCE');
    expect(report.findings).toEqual([]);
  });

  it('a report that was not run still carries what is stored: the hash, RETUNING observed, the runner versions', async () => {
    const stored = storedCycle(V1);
    const runner = answering(resultEqualTo(stored, V1));
    const noReadings = await replayer(runner).replay({
      ...stored,
      readings: [],
    });
    expect(noReadings).toMatchObject({
      cause: 'NO_STORED_READINGS',
      inputs: {
        storedSha256: stored.bundle?.inputsSha256,
        textSha256: null,
        replayedSha256: null,
      },
      retuning: { storedObserved: false, enforcedForReplay: null },
      runner: { storedVersions: [] },
    });
    const noBundle = await replayer(runner).replay({ ...stored, bundle: null });
    expect(noBundle).toMatchObject({
      cause: 'NO_STORED_BUNDLE',
      inputs: { storedSha256: null },
      retuning: { storedObserved: null },
      runner: { storedVersions: ['1.0.0'] },
    });
    const mixed = await replayer(runner).replay(
      withReading(stored, 'MCD2', (r) => ({ ...r, retuningApplied: true }))
    );
    expect(mixed).toMatchObject({
      cause: 'MIXED_RETUNING',
      inputs: { storedSha256: stored.bundle?.inputsSha256 },
      retuning: { enforcedForReplay: null, storedApplied: null },
    });
    expect(runner.requests).toEqual([]);
  });

  it('a fixture whose hash differs says what that means in the summary', async () => {
    const stored = loadFixtureCycle(FIXTURES_DIR, V1.slot);
    const report = await replayer(
      answering(
        resultEqualTo(storedCycle(V1), V1, { inputs_sha256: '0'.repeat(64) })
      )
    ).replay(stored);
    expect(report.summary).toBe(
      'the stored bundle does not hash to the stored inputs_sha256 when the runner reads it'
    );
    expect(report.tamperReason).toBe('REPLAYED_HASH_DIFFERS');
  });
});

// ====================================================================== the text report, line by line

describe('the text report: which line says what', () => {
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const SETTINGS = {
    python: 'python',
    engineDir: ENGINE_DIR,
    runnerTimeoutMs: 1000,
  };
  const replay = (
    stored: ReturnType<typeof storedCycle>,
    runner = answering(resultEqualTo(storedCycle(V1), V1))
  ) => new CycleReplayer(SETTINGS, runner.hooks(tempRoot)).replay(stored);

  it('a verified cycle prints its inputs, RETUNING and runner lines and nothing about a difference', async () => {
    const text = formatReplayReport(await replay(storedCycle(V1)));
    expect(text).toContain('  inputs  stored ');
    expect(text).toMatch(/unzipped text [0-9a-f]{16}…/);
    expect(text).toContain('  retuning  enforced for the replay false');
    expect(text).toContain('  runner 1.0.0 (stored 1.0.0), 123 ms');
    expect(text).not.toContain('first difference');
    expect(text).not.toContain('envelope text and SHA-256 equal');
    expect(text.split('\n').filter((l) => l.startsWith('        '))).toEqual(
      []
    );
  });

  it('a tampered cycle prints no runner line (nothing was run) and no replayed hash', async () => {
    const text = formatReplayReport(
      await replay(withTamperedText(storedCycle(V1)))
    );
    expect(text).not.toContain('  runner ');
    expect(text).toContain('replayed none');
    expect(text).not.toContain('  retuning  enforced');
    expect(text).toMatch(/unzipped text [0-9a-f]{16}…/);
  });

  it('a cycle with nothing to compare prints neither an inputs line nor a RETUNING line', async () => {
    const text = formatReplayReport(
      await replay({ ...storedCycle(V1), bundle: null })
    );
    expect(text).not.toContain('  inputs  stored');
    expect(text).not.toContain('  retuning  enforced');
    expect(text).not.toContain('  runner ');
    expect(text).toContain('NOT_REPLAYABLE (NO_STORED_BUNDLE)');
  });

  it('a corrupt stored row prints its detail and no "first difference" (it has none)', async () => {
    const stored = withReading(storedCycle(V1), 'MCD0', (r) => ({
      ...r,
      envelopeSha256: 'a'.repeat(64),
    }));
    const text = formatReplayReport(await replay(stored));
    expect(text).toContain('        the stored row disagrees with itself');
    expect(text).not.toContain('first difference');
  });

  it('a divergence prints where the text first differs, and a note for each finding', async () => {
    const stored = storedCycle(V1);
    const text = formatReplayReport(
      await replay(
        stored,
        answering(resultEqualTo(stored, V1, { inputs_sha256: 'f'.repeat(64) }))
      )
    );
    expect(text).toContain('  note: the stored text hashes as stored');
    const changed = withReading(stored, 'MCD2', (r) =>
      withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
    );
    expect(formatReplayReport(await replay(changed))).toMatch(
      /first difference at character \d+: stored ".*VALID.*" replayed ".*CAUTIONARY.*"/
    );
  });

  it('says where the cycle came from: "a stored fixture" with no unzipped text, or "the database" with one', async () => {
    const fixture = loadFixtureCycle(FIXTURES_DIR, V1.slot);
    const runner = answering(
      resultEqualTo(storedCycle(V1), V1, {
        inputs_sha256: fixture.bundle?.inputsSha256,
      })
    );
    const fromFixture = formatReplayReport(await replay(fixture, runner));
    expect(fromFixture).toContain('from a stored fixture');
    expect(fromFixture).toContain(
      'unzipped text n/a (a fixture has no stored text)'
    );
    const fromDatabase = formatReplayReport(await replay(storedCycle(V1)));
    expect(fromDatabase).toContain('from the database');
    expect(fromDatabase).not.toContain('n/a');
  });

  it('shows a short hash as its first 16 characters and an ellipsis', async () => {
    const stored = storedCycle(V1);
    const text = formatReplayReport(await replay(stored));
    expect(text).toContain(
      `stored ${stored.bundle?.inputsSha256.slice(0, 16)}…`
    );
    expect(text).not.toContain(
      stored.bundle?.inputsSha256.slice(0, 17) as string
    );
  });
});

// ====================================================================== the command line

describe('the command line: the edges of the arguments and the order of the work', () => {
  it('refuses an unix time outside the safe integers even when it is a multiple of 300', () => {
    // 90071992547409600 = 1200 x 75059993789508, exactly representable, and above 2^53
    expect(parseSlotArgument('90071992547409600')).toBeNull();
    expect(parseSlotArgument(String(V1.slot))).toBe(V1.slot);
  });

  it('takes a value that starts with one dash, and refuses a slot that does', () => {
    expect(
      parseReplayArgs(['--fixtures', '--engine-dir', '-weird'])
    ).toMatchObject({
      engineDir: '-weird',
    });
    expect(parseReplayArgs(['--fixtures', '--slot', '-300'])).toHaveProperty(
      'error'
    );
  });

  it('puts each option in its own field', () => {
    expect(
      parseReplayArgs([
        '--fixtures',
        '--symbol',
        'S',
        '--python',
        'P',
        '--engine-dir',
        'E',
        '--fixtures-dir',
        'F',
      ])
    ).toMatchObject({
      symbol: 'S',
      python: 'P',
      engineDir: 'E',
      fixturesDir: 'F',
    });
  });

  it('reads the engine folder from the environment, and an --engine-dir flag wins over it', async () => {
    const tempRoot = makeTempRoot();
    try {
      const seen: string[] = [];
      const runner = new RecordingRunner(() =>
        outputOf(resultEqualTo(storedCycle(V1), V1))
      );
      const hooks = runner.hooks(tempRoot, {
        makeRunner: (settings) => {
          seen.push(settings.engineDir);
          return runner;
        },
      });
      const options = {
        ...OPTIONS,
        fixtures: true,
        slots: [V1.slot],
        fixturesDir: FIXTURES_DIR,
      };
      await runReplayCommand(options, {
        env: { SENSOR_ENGINE_DIR: 'from/the/environment' },
        hooks,
      });
      await runReplayCommand(
        { ...options, engineDir: 'from/the/flag' },
        { env: { SENSOR_ENGINE_DIR: 'from/the/environment' }, hooks }
      );
      expect(seen).toEqual(['from/the/environment', 'from/the/flag']);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('--db replays the slots in slot order whatever order they were given in, and closes the database once', async () => {
    const stored = storedCycle(V1);
    const { input, outputs } = rowsOf(stored);
    const db = fakeReplayDatabase(input, outputs);
    let closed = 0;
    const tempRoot = makeTempRoot();
    try {
      const runner = new RecordingRunner(() =>
        outputOf(resultEqualTo(stored, V1))
      );
      const result = await runReplayCommand(
        { ...OPTIONS, db: true, slots: [V3.slot, V1.slot] },
        {
          env: {},
          openDatabase: async () => ({
            database: db.database,
            close: async () => {
              closed += 1;
            },
          }),
          hooks: runner.hooks(tempRoot),
        }
      );
      expect(result.reports.map((r) => r.slot)).toEqual([V1.slot, V3.slot]);
      expect(
        db.findUnique.mock.calls.map(
          (c) => c[0].where.symbol_cycle_slot.cycle_slot
        )
      ).toEqual([V1.slot, V3.slot]);
      expect(closed).toBe(1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('--fixtures-dir wins over the folder of the engine, and --json is not the text report', async () => {
    const tempRoot = makeTempRoot();
    try {
      const runner = new RecordingRunner(() =>
        outputOf(resultEqualTo(storedCycle(V1), V1))
      );
      const empty = await runReplayCommand(
        { ...OPTIONS, fixtures: true, fixturesDir: tempRoot },
        { env: {}, hooks: runner.hooks(tempRoot) }
      );
      expect(empty.reports).toEqual([]);
      const json = await runReplayCommand(
        { ...OPTIONS, fixtures: true, fixturesDir: tempRoot, json: true },
        { env: {}, hooks: runner.hooks(tempRoot) }
      );
      expect(json.text).toBe('[]');
      expect(slotToIso(V1.slot)).toBe('2026-09-18T20:55Z');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
