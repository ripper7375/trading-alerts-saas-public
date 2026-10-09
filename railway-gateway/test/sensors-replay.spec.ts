import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { RunnerError } from '../src/sensors/cycle-run-result';
import { slotToIso } from '../src/sensors/inputs/stats-slot';
import { PythonCycleRunner } from '../src/sensors/python-runner';
import {
  CycleReplayReport,
  CycleReplayer,
  REPLAY_USAGE,
  ReplayCliOptions,
  StoredCycle,
  compareReading,
  exitCodeFor,
  firstDifference,
  formatReplayReport,
  formatReplayReports,
  inspectStoredBundle,
  listFixtureSlots,
  loadFixtureCycle,
  loadStoredCycle,
  mcdIdsInWorkerConfig,
  parseReplayArgs,
  parseSlotArgument,
  replayWorkerConfig,
  runReplayCommand,
  storedReadingProblems,
} from '../src/sensors/replay';
import {
  ENGINE_DIR,
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import { pythonAvailable } from './helpers/kit-runner';
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
  stubBundleText,
  textOf,
  withChangedEnvelope,
  withReading,
  withTamperedText,
} from './helpers/replay-world';
import {
  outputOf,
  sha256,
  unitResult,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

const [V1, V3, V4] = FIXTURE_SLOTS;
const ROOT = path.join(__dirname, '..');
const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const SETTINGS = {
  python: PYTHON,
  engineDir: ENGINE_DIR,
  runnerTimeoutMs: 120_000,
};

// ====================================================================== small pure parts

describe('firstDifference', () => {
  it('is null for equal texts', () => {
    expect(firstDifference('abc', 'abc')).toBeNull();
    expect(firstDifference('', '')).toBeNull();
  });

  it('names the first character that differs, with what is around it', () => {
    expect(firstDifference('abcdef', 'abXdef')).toEqual({
      offset: 2,
      stored: 'abcdef',
      replayed: 'abXdef',
    });
  });

  it('a text that is a prefix of the other differs where the shorter one ends', () => {
    expect(firstDifference('abc', 'abcd')).toEqual({
      offset: 3,
      stored: 'abc',
      replayed: 'abcd',
    });
    expect(firstDifference('abcd', 'abc')?.offset).toBe(3);
  });

  it('keeps 30 characters before the difference and 30 after it, no more', () => {
    const left = `${'a'.repeat(100)}X${'b'.repeat(100)}`;
    const right = `${'a'.repeat(100)}Y${'b'.repeat(100)}`;
    const d = firstDifference(left, right)!;
    expect(d.offset).toBe(100);
    expect(d.stored).toBe(`${'a'.repeat(30)}X${'b'.repeat(29)}`);
    expect(d.replayed).toBe(`${'a'.repeat(30)}Y${'b'.repeat(29)}`);
  });
});

describe('the worker configuration of a replay', () => {
  it('reads the MCD ids the committed worker_config.yaml lists', () => {
    const text = fs.readFileSync(
      path.join(ENGINE_DIR, 'mcd_worker', 'worker_config.yaml'),
      'utf8'
    );
    expect(mcdIdsInWorkerConfig(text)).toEqual(ENGINE_MCD_IDS);
  });

  it('ignores comments and blank lines, accepts CRLF, and stops at the next top-level key', () => {
    const text =
      "# a comment\r\nschema: mcd-worker-config/1\r\nflags:\r\n  # note\r\n  MCD0: 'off'\r\n\r\n  MCD1: \"shadow\"\r\nother:\r\n  MCD9: 'live'\r\n";
    expect(mcdIdsInWorkerConfig(text)).toEqual(['MCD0', 'MCD1']);
  });

  it('does not take the synthesis flag for an MCD', () => {
    const text =
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'off'\n  SYN: 'off'\n  MCD1: 'off'\nsynthesis:\n  rules_version: draft-1\n";
    expect(mcdIdsInWorkerConfig(text)).toEqual(['MCD0', 'MCD1']);
  });

  it('finds nothing when there is no flags block', () => {
    expect(mcdIdsInWorkerConfig('schema: x\n  MCD0: off\n')).toEqual([]);
    expect(mcdIdsInWorkerConfig('')).toEqual([]);
  });

  it('writes every engine MCD, off unless a stored reading says otherwise, with quoted values', () => {
    const text = replayWorkerConfig(
      ENGINE_MCD_IDS,
      new Map([
        ['MCD0', 'shadow'],
        ['MCD2', 'live'],
      ])
    );
    expect(text).toBe(
      [
        'schema: mcd-worker-config/1',
        'flags:',
        "  MCD0: 'shadow'",
        "  MCD1: 'off'",
        "  MCD2: 'live'",
        "  MCD3: 'off'",
        '',
      ].join('\n')
    );
  });

  it('adds a stored MCD the engine no longer lists (the runner then refuses it, which is the honest answer) and sorts by number', () => {
    const text = replayWorkerConfig(
      ['MCD2', 'MCD9', 'MCD0'],
      new Map([['MCD10', 'shadow']])
    );
    expect(text.split('\n').slice(2, -1)).toEqual([
      "  MCD0: 'off'",
      "  MCD2: 'off'",
      "  MCD9: 'off'",
      "  MCD10: 'shadow'",
    ]);
  });

  it('lists an MCD once when the engine and the stored rows both name it', () => {
    const text = replayWorkerConfig(['MCD0'], new Map([['MCD0', 'shadow']]));
    expect(text.match(/MCD0/g)).toHaveLength(1);
  });
});

// ====================================================================== the stored inputs

describe('inspectStoredBundle: can the stored inputs be vouched for', () => {
  it('accepts a bundle whose text hashes as stored, and hands back the text, its hash and the parsed bundle', () => {
    const stored = storedCycle(V1);
    const inspection = inspectStoredBundle(stored);
    expect(inspection).toMatchObject({
      ok: true,
      text: stubBundleText(V1),
      textSha256: sha256(stubBundleText(V1)),
      bundle: JSON.parse(stubBundleText(V1)),
    });
  });

  it('refuses an encoding it cannot read', () => {
    const stored = storedCycle(V1);
    if (stored.bundle?.form !== 'gzip-text') throw new Error('setup');
    const result = inspectStoredBundle({
      ...stored,
      bundle: { ...stored.bundle, encoding: 'zstd' },
    });
    expect(result).toMatchObject({ ok: false, reason: 'ENCODING' });
    if (!result.ok) expect(result.detail).toContain('zstd');
  });

  it('refuses bytes that do not unzip', () => {
    const stored = storedCycle(V1);
    if (stored.bundle?.form !== 'gzip-text') throw new Error('setup');
    const result = inspectStoredBundle({
      ...stored,
      bundle: { ...stored.bundle, gz: Buffer.from('not gzip at all') },
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'UNREADABLE',
      textSha256: null,
    });
  });

  it('refuses a changed byte: the text no longer hashes to the stored inputs_sha256, and says both hashes', () => {
    const stored = withTamperedText(storedCycle(V1));
    const result = inspectStoredBundle(stored);
    expect(result).toMatchObject({ ok: false, reason: 'HASH' });
    if (!result.ok) {
      expect(result.detail).toContain(sha256(textOf(stored)));
      expect(result.detail).toContain(sha256(stubBundleText(V1)));
      expect(result.textSha256).toBe(sha256(textOf(stored)));
    }
  });

  it('a one-bit change that keeps the length is still caught by the hash', () => {
    const stored = withTamperedText(storedCycle(V1), (text) =>
      text.replace('FRESH', 'FRESI')
    );
    expect(textOf(stored)).toHaveLength(stubBundleText(V1).length);
    expect(inspectStoredBundle(stored)).toMatchObject({
      ok: false,
      reason: 'HASH',
    });
  });

  it('refuses a recorded length that is not the length of the text, even when the hash matches', () => {
    const stored = storedCycle(V1);
    if (stored.bundle?.form !== 'gzip-text') throw new Error('setup');
    const result = inspectStoredBundle({
      ...stored,
      bundle: { ...stored.bundle, bytes: stored.bundle.bytes + 1 },
    });
    expect(result).toMatchObject({ ok: false, reason: 'LENGTH' });
  });

  it('refuses a text that hashes right and is not JSON', () => {
    const text = 'this is not json';
    const stored = storedCycle(V1, text);
    expect(inspectStoredBundle(stored)).toMatchObject({
      ok: false,
      reason: 'NOT_JSON',
    });
  });

  it('refuses a bundle stored under the wrong slot or the wrong symbol', () => {
    const other = JSON.stringify({
      cycle_slot: slotToIso(V3.slot),
      symbol: 'XAUUSD',
    });
    const wrongSlot = inspectStoredBundle(storedCycle(V1, other));
    expect(wrongSlot).toMatchObject({ ok: false, reason: 'OTHER_CYCLE' });
    if (!wrongSlot.ok) {
      expect(wrongSlot.detail).toContain(slotToIso(V3.slot));
      expect(wrongSlot.detail).toContain(slotToIso(V1.slot));
    }
    const wrongSymbol = inspectStoredBundle(
      storedCycle(
        V1,
        JSON.stringify({ cycle_slot: slotToIso(V1.slot), symbol: 'EURUSD' })
      )
    );
    expect(wrongSymbol).toMatchObject({ ok: false, reason: 'OTHER_CYCLE' });
    expect(
      inspectStoredBundle(storedCycle(V1, JSON.stringify([1, 2, 3])))
    ).toMatchObject({ ok: false, reason: 'OTHER_CYCLE' });
  });

  it('refuses inputs that a reading does not name (the bundle kept is not the one the reading was made from), naming the MCDs', () => {
    let stored = storedCycle(V1);
    stored = withReading(stored, 'MCD2', (r) => ({
      ...r,
      inputsSha256: 'f'.repeat(64),
    }));
    stored = withReading(stored, 'MCD3', (r) => ({ ...r, inputsSha256: null }));
    const result = inspectStoredBundle(stored);
    expect(result).toMatchObject({
      ok: false,
      reason: 'READINGS_NAME_OTHER_INPUTS',
    });
    if (!result.ok) {
      expect(result.detail).toContain('MCD2, MCD3');
      expect(result.detail).toContain('f'.repeat(64));
      expect(result.detail).toContain('null');
    }
  });

  it('a fixture (a parsed file, no stored text) is checked for the cycle it is and for the readings, not for a text hash', () => {
    const stored = loadFixtureCycle(FIXTURES_DIR, V1.slot);
    expect(inspectStoredBundle(stored)).toMatchObject({
      ok: true,
      text: null,
      textSha256: null,
    });
    const moved = loadFixtureCycle(FIXTURES_DIR, V1.slot);
    moved.slot = V3.slot;
    expect(inspectStoredBundle(moved)).toMatchObject({
      ok: false,
      reason: 'OTHER_CYCLE',
    });
  });

  it('needs a stored bundle to look at', () => {
    expect(() =>
      inspectStoredBundle({ ...storedCycle(V1), bundle: null })
    ).toThrow(RangeError);
  });
});

describe('storedReadingProblems: a stored row that disagrees with itself', () => {
  const reading = storedCycle(V1).readings[1]; // MCD1

  it('has none when text, hash, MCD, slot and version agree', () => {
    for (const r of storedCycle(V1).readings)
      expect(storedReadingProblems(r, V1.slot)).toEqual([]);
  });

  it('notices a text that does not hash to the stored hash', () => {
    expect(
      storedReadingProblems(
        { ...reading, envelopeJson: `${reading.envelopeJson} ` },
        V1.slot
      )
    ).toContain('envelope_json does not hash to the stored envelope_sha256');
  });

  it('notices a text that is not JSON, or not an object', () => {
    for (const [text, said] of [
      ['{not json', 'envelope_json is not JSON'],
      ['[1]', 'envelope_json is not an object'],
    ] as const) {
      const r = {
        ...reading,
        envelopeJson: text,
        envelopeSha256: sha256(text),
      };
      expect(storedReadingProblems(r, V1.slot)).toEqual([said]);
    }
  });

  it('notices an envelope of another MCD, another slot, or another evaluator version than the row says', () => {
    expect(
      storedReadingProblems({ ...reading, mcdId: 'MCD2' }, V1.slot).join()
    ).toContain('the envelope is MCD MCD1');
    expect(storedReadingProblems(reading, V3.slot).join()).toContain(
      `the envelope is for slot ${slotToIso(V1.slot)}`
    );
    expect(
      storedReadingProblems(
        { ...reading, evaluatorVersion: '9.9.9' },
        V1.slot
      ).join()
    ).toContain("evaluator_version 9.9.9 is not the envelope's 2.0.1");
  });
});

// ====================================================================== one MCD

describe('compareReading: one stored reading against what the replay gave', () => {
  const stored = storedCycle(V1);
  const result = resultEqualTo(stored, V1);
  const replayedOf = (id: string) =>
    result.results.find((r) => r.mcd_id === id)!;
  const readingOf = (id: string) =>
    stored.readings.find((r) => r.mcdId === id)!;

  it('VERIFIED when the text, the hash and the version are equal', () => {
    for (const id of ENGINE_MCD_IDS) {
      expect(
        compareReading(readingOf(id), V1.slot, replayedOf(id))
      ).toMatchObject({
        mcdId: id,
        verdict: 'VERIFIED',
        textEqual: true,
        hashEqual: true,
        difference: null,
        replayedEnvelopeSha256: readingOf(id).envelopeSha256,
      });
    }
  });

  it('VERSION_MISMATCH when the evaluator is not the version that wrote the row, though the text differs too', () => {
    const old = asWrittenBy(readingOf('MCD1'), '2.0.0');
    const verdict = compareReading(old, V1.slot, replayedOf('MCD1'));
    expect(verdict).toMatchObject({
      verdict: 'VERSION_MISMATCH',
      storedEvaluatorVersion: '2.0.0',
      replayedEvaluatorVersion: '2.0.1',
      textEqual: false,
      hashEqual: false,
    });
    expect(verdict.detail).toContain('2.0.1');
    expect(verdict.detail).toContain('2.0.0');
    expect(verdict.difference?.stored).toContain('2.0.0');
  });

  it('LOGIC_DIVERGENCE when the version is the same and the text differs, and says where', () => {
    const changed = withChangedEnvelope(
      readingOf('MCD2'),
      '"status":"CAUTIONARY"',
      '"status":"VALID"'
    );
    const verdict = compareReading(changed, V1.slot, replayedOf('MCD2'));
    expect(verdict).toMatchObject({
      verdict: 'LOGIC_DIVERGENCE',
      textEqual: false,
      hashEqual: false,
    });
    expect(verdict.detail).toContain('the same evaluator version 2.0.1');
    expect(verdict.difference).not.toBeNull();
    expect(verdict.difference!.stored).toContain('VALID');
    expect(verdict.difference!.replayed).toContain('CAUTIONARY');
  });

  it('a stored hash that is not the hash of the stored text is STORED_READING_CORRUPT, not a divergence (the row checks come first)', () => {
    const row = { ...readingOf('MCD0'), envelopeSha256: 'a'.repeat(64) };
    expect(compareReading(row, V1.slot, replayedOf('MCD0'))).toMatchObject({
      verdict: 'STORED_READING_CORRUPT',
    });
  });

  it('LOGIC_DIVERGENCE when the runner reports a hash that is not the hash of its own text', () => {
    const lying = { ...replayedOf('MCD0'), envelope_sha256: 'b'.repeat(64) };
    const verdict = compareReading(readingOf('MCD0'), V1.slot, lying);
    expect(verdict.verdict).toBe('LOGIC_DIVERGENCE');
    expect(verdict.detail).toContain('its own text hashes to');
    expect(verdict.textEqual).toBe(true);
  });

  it('LOGIC_DIVERGENCE when the replay produced nothing for an MCD that has a stored reading', () => {
    const verdict = compareReading(readingOf('MCD3'), V1.slot, undefined);
    expect(verdict).toMatchObject({
      verdict: 'LOGIC_DIVERGENCE',
      replayedEvaluatorVersion: null,
      replayedEnvelopeSha256: null,
      textEqual: null,
      hashEqual: null,
    });
    expect(verdict.detail).toContain('produced no reading for MCD3');
  });

  it('STORED_READING_CORRUPT comes before a version difference: a row that disagrees with itself proves nothing', () => {
    const row = {
      ...asWrittenBy(readingOf('MCD1'), '2.0.0'),
      envelopeSha256: 'c'.repeat(64),
    };
    expect(compareReading(row, V1.slot, replayedOf('MCD1')).verdict).toBe(
      'STORED_READING_CORRUPT'
    );
  });

  it('STORED_READING_CORRUPT also covers a replay that gave nothing, without inventing a hash', () => {
    const row = { ...readingOf('MCD1'), envelopeSha256: 'c'.repeat(64) };
    expect(compareReading(row, V1.slot, undefined)).toMatchObject({
      verdict: 'STORED_READING_CORRUPT',
      replayedEnvelopeSha256: null,
      replayedEvaluatorVersion: null,
    });
  });
});

// ====================================================================== the replay, on a fake runner

describe('CycleReplayer on a fake runner', () => {
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const left = () => fs.readdirSync(tempRoot);
  const replayer = (runner: RecordingRunner) =>
    new CycleReplayer(SETTINGS, runner.hooks(tempRoot));

  describe('a deterministic cycle', () => {
    it('is VERIFIED, with every MCD verified, the inputs hash agreed and the runner told what it must be told', async () => {
      const stored = storedCycle(V1);
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);

      expect(report).toMatchObject({
        origin: 'database',
        symbol: 'XAUUSD',
        slot: V1.slot,
        slotIso: '2026-09-18T20:55Z',
        verdict: 'VERIFIED',
        cause: null,
        tamperReason: null,
        findings: [],
        inputs: {
          storedSha256: sha256(stubBundleText(V1)),
          textSha256: sha256(stubBundleText(V1)),
          replayedSha256: sha256(stubBundleText(V1)),
        },
        retuning: {
          enforcedForReplay: false,
          storedApplied: false,
          replayedApplied: false,
          storedObserved: false,
          replayedObserved: false,
        },
        runner: {
          storedVersions: ['1.0.0'],
          replayedVersion: '1.0.0',
          wallMs: 123,
        },
      });
      expect(report.summary).toBe(
        '4 of 4 readings equal the stored ones, envelope text and SHA-256, byte for byte'
      );
      expect(report.mcds.map((m) => [m.mcdId, m.verdict])).toEqual(
        ENGINE_MCD_IDS.map((id) => [id, 'VERIFIED'])
      );
    });

    it('sends the stored bundle, parsed from the stored text, and starts the runner from the engine folder with a configuration of its own', async () => {
      const stored = storedCycle(V1);
      const runner = answering(resultEqualTo(stored, V1));
      await replayer(runner).replay(stored);

      expect(runner.requests).toHaveLength(1);
      expect(runner.requests[0]).toEqual({
        bundle: JSON.parse(stubBundleText(V1)),
        retuningEnforced: false,
      });
      expect(runner.starts).toHaveLength(1);
      const { settings } = runner.starts[0];
      expect(settings.python).toBe(PYTHON);
      expect(settings.engineDir).toBe(ENGINE_DIR);
      expect(settings.runnerTimeoutMs).toBe(120_000);
      expect(
        path.dirname(settings.workerConfigPath as string).startsWith(tempRoot)
      ).toBe(true);
      expect(path.basename(settings.workerConfigPath as string)).toBe(
        'worker_config.yaml'
      );
    });

    it('runs the MCDs under the flags stored on the rows, and every MCD without a stored reading off', async () => {
      let stored = storedCycle(V1);
      stored = {
        ...stored,
        readings: stored.readings.filter((r) => r.mcdId !== 'MCD1'),
      };
      stored = withReading(stored, 'MCD0', (r) => ({ ...r, flag: 'live' }));
      const runner = answering(
        resultEqualTo(stored, V1, {
          results: unitResult(V1).results.filter((r) => r.mcd_id !== 'MCD1'),
        })
      );
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(runner.starts[0].config).toBe(
        [
          'schema: mcd-worker-config/1',
          'flags:',
          "  MCD0: 'live'",
          "  MCD1: 'off'",
          "  MCD2: 'shadow'",
          "  MCD3: 'shadow'",
          '',
        ].join('\n')
      );
    });

    it('deletes its temporary configuration when it is done', async () => {
      const stored = storedCycle(V1);
      await replayer(answering(resultEqualTo(stored, V1))).replay(stored);
      expect(left()).toEqual([]);
    });

    it('tells the runner RETUNING was enforced exactly when the stored readings say it was applied', async () => {
      let stored = storedCycle(V1);
      stored = {
        ...stored,
        bundle: {
          ...(stored.bundle as object),
          retuningObserved: true,
        } as never,
        readings: stored.readings.map((r) => ({
          ...r,
          retuningApplied: true,
        })),
      };
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(runner.requests[0].retuningEnforced).toBe(true);
      expect(report.retuning).toMatchObject({
        enforcedForReplay: true,
        storedApplied: true,
        replayedApplied: true,
        storedObserved: true,
        replayedObserved: true,
      });
      expect(report.verdict).toBe('VERIFIED');
    });

    it('does not enforce RETUNING for a cycle that saw it and did not apply it', async () => {
      let stored = storedCycle(V1);
      stored = {
        ...stored,
        bundle: {
          ...(stored.bundle as object),
          retuningObserved: true,
        } as never,
        readings: stored.readings.map((r) => ({
          ...r,
          retuningApplied: false,
        })),
      };
      const runner = answering(
        resultEqualTo(stored, V1, {
          retuning: { observed: true, enforced: false, applied: false },
        })
      );
      const report = await replayer(runner).replay(stored);
      expect(runner.requests[0].retuningEnforced).toBe(false);
      expect(report.verdict).toBe('VERIFIED');
    });
  });

  describe('(b) a tampered bundle', () => {
    it('is TAMPERED_BUNDLE, and the runner is never started: nothing is run on inputs nobody can vouch for', async () => {
      const stored = withTamperedText(storedCycle(V1));
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const report = await replayer(runner).replay(stored);

      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'HASH',
        cause: null,
        mcds: [],
        inputs: {
          storedSha256: sha256(stubBundleText(V1)),
          textSha256: sha256(textOf(stored)),
          replayedSha256: null,
        },
        runner: { replayedVersion: null, wallMs: null },
      });
      expect(report.summary).toContain('the unzipped bundle hashes to');
      expect(report.summary).toContain('nothing was run');
      expect(runner.requests).toEqual([]);
      expect(runner.starts).toEqual([]);
      expect(left()).toEqual([]);
    });

    it.each([
      ['an encoding it cannot read', 'ENCODING'],
      ['bytes that do not unzip', 'UNREADABLE'],
      ['a wrong recorded length', 'LENGTH'],
    ] as const)(
      '%s is TAMPERED_BUNDLE (%s) without a run',
      async (_what, reason) => {
        const base = storedCycle(V1);
        if (base.bundle?.form !== 'gzip-text') throw new Error('setup');
        const patch =
          reason === 'ENCODING'
            ? { encoding: 'zstd' }
            : reason === 'UNREADABLE'
              ? { gz: Buffer.from('nope') }
              : { bytes: base.bundle.bytes + 5 };
        const runner = answering(resultEqualTo(base, V1));
        const report = await replayer(runner).replay({
          ...base,
          bundle: { ...base.bundle, ...patch },
        });
        expect(report).toMatchObject({
          verdict: 'TAMPERED_BUNDLE',
          tamperReason: reason,
        });
        expect(runner.requests).toEqual([]);
      }
    );

    it('a reading that names other inputs is TAMPERED_BUNDLE too, with the MCD named', async () => {
      const stored = withReading(storedCycle(V1), 'MCD2', (r) => ({
        ...r,
        inputsSha256: 'e'.repeat(64),
      }));
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'READINGS_NAME_OTHER_INPUTS',
      });
      expect(report.summary).toContain('MCD2');
      expect(runner.requests).toEqual([]);
    });

    it('is decided before the stored readings are looked at: tampered inputs and a corrupt row is TAMPERED_BUNDLE', async () => {
      let stored = withTamperedText(storedCycle(V1));
      stored = withReading(stored, 'MCD0', (r) => ({
        ...r,
        envelopeSha256: 'd'.repeat(64),
      }));
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('TAMPERED_BUNDLE');
    });
  });

  describe('(c) an evaluator version that is not the one that wrote the row', () => {
    it('is VERSION_MISMATCH, naming the MCD and both versions, and the other MCDs are still VERIFIED', async () => {
      const stored = withReading(storedCycle(V1), 'MCD1', (r) =>
        asWrittenBy(r, '2.0.0')
      );
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);

      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.summary).toBe(
        'MCD1: the evaluator is 2.0.1 now, the row was written by 2.0.0'
      );
      expect(report.mcds.map((m) => [m.mcdId, m.verdict])).toEqual([
        ['MCD0', 'VERIFIED'],
        ['MCD1', 'VERSION_MISMATCH'],
        ['MCD2', 'VERIFIED'],
        ['MCD3', 'VERIFIED'],
      ]);
      expect(report.cause).toBeNull();
      expect(report.tamperReason).toBeNull();
    });

    it('is not a logic divergence even when the replayed text equals the stored one and only the version column differs: the row then disagrees with itself', async () => {
      const stored = withReading(storedCycle(V1), 'MCD1', (r) => ({
        ...r,
        evaluatorVersion: '2.0.0',
      }));
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
    });

    it('wins over a logic divergence found in another MCD of the same cycle, which stays visible per MCD', async () => {
      let stored = withReading(storedCycle(V1), 'MCD1', (r) =>
        asWrittenBy(r, '2.0.0')
      );
      stored = withReading(stored, 'MCD2', (r) =>
        withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
      );
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.mcds.find((m) => m.mcdId === 'MCD2')?.verdict).toBe(
        'LOGIC_DIVERGENCE'
      );
    });
  });

  describe('(d) a logic divergence', () => {
    it('is LOGIC_DIVERGENCE: same version, inputs as stored, another envelope; the summary says where', async () => {
      const stored = withReading(storedCycle(V1), 'MCD2', (r) =>
        withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
      );
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.summary).toContain(
        'MCD2: the same evaluator version 2.0.1 gave another envelope'
      );
      expect(
        report.mcds.filter((m) => m.verdict !== 'VERIFIED').map((m) => m.mcdId)
      ).toEqual(['MCD2']);
      expect(
        report.mcds.find((m) => m.mcdId === 'MCD2')?.difference
      ).not.toBeNull();
    });

    it('a replay that produces nothing for a stored MCD is a divergence', async () => {
      const stored = storedCycle(V1);
      const report = await replayer(
        answering(
          resultEqualTo(stored, V1, {
            results: unitResult(V1).results.filter((r) => r.mcd_id !== 'MCD3'),
          })
        )
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.summary).toContain('MCD3: the replay produced no reading');
    });

    it('a replay that also produces an MCD nobody stored is a divergence, named in a finding', async () => {
      const stored = storedCycle(V1);
      const base = unitResult(V1);
      const extra = { ...base.results[0], mcd_id: 'MCD9' };
      const report = await replayer(
        answering(
          resultEqualTo(stored, V1, {
            results: [...base.results, extra],
            runtime: {
              python: '3.11.9',
              timings_ms: { MCD0: 1, MCD1: 1, MCD2: 1, MCD3: 1, MCD9: 1 },
            },
          })
        )
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.findings.join('\n')).toContain(
        'also produced MCD9, which have no stored reading'
      );
      expect(report.mcds.map((m) => m.verdict)).toEqual([
        'VERIFIED',
        'VERIFIED',
        'VERIFIED',
        'VERIFIED',
      ]);
    });

    it('the runner that wrote the rows being another version than the runner now is said in a finding, not made a verdict of its own', async () => {
      const stored = withReading(storedCycle(V1), 'MCD3', (r) =>
        withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
      );
      const report = await replayer(
        answering(
          resultEqualTo(storedCycle(V1), V1, { runner_version: '1.1.0' })
        )
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.findings).toContain(
        'the runner is 1.1.0 now, the rows were written by 1.0.0'
      );
    });

    it('the canonical form of the bundle changing (the same stored text, hashed differently by the runner) is a divergence even when every envelope is equal', async () => {
      const stored = storedCycle(V1);
      const runner = answering(
        resultEqualTo(stored, V1, { inputs_sha256: 'f'.repeat(64) })
      );
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
      expect(report.inputs.replayedSha256).toBe('f'.repeat(64));
      expect(report.summary).toBe(report.findings[0]);
      expect(report.findings[0]).toContain(
        'the canonical form of a bundle changed'
      );
    });

    it('RETUNING applied on the rows and not applied by a replay of the stored bundle is a divergence', async () => {
      let stored = storedCycle(V1);
      stored = {
        ...stored,
        readings: stored.readings.map((r) => ({ ...r, retuningApplied: true })),
      };
      const runner = answering(
        resultEqualTo(storedCycle(V1), V1, {
          retuning: { observed: false, enforced: true, applied: false },
        })
      );
      const report = await replayer(runner).replay(stored);
      expect(runner.requests[0].retuningEnforced).toBe(true);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.findings[0]).toContain(
        'the readings say RETUNING was applied (true)'
      );
    });

    it('a stored retuning_observed that is not what the stored bundle says is a divergence', async () => {
      const stored = storedCycle(V1);
      const flipped = {
        ...stored,
        bundle: {
          ...(stored.bundle as object),
          retuningObserved: true,
        } as never,
      };
      const report = await replayer(
        answering(resultEqualTo(stored, V1))
      ).replay(flipped);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.findings[0]).toContain(
        'the stored retuning_observed is true and the stored bundle says false'
      );
    });
  });

  describe('a stored row that disagrees with itself', () => {
    it('is STORED_READING_CORRUPT, ahead of a version difference or a divergence elsewhere', async () => {
      let stored = withReading(storedCycle(V1), 'MCD0', (r) => ({
        ...r,
        envelopeSha256: 'a'.repeat(64),
      }));
      stored = withReading(stored, 'MCD1', (r) => asWrittenBy(r, '2.0.0'));
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.summary).toContain(
        'MCD0: the stored row disagrees with itself'
      );
    });
  });

  describe('a fixture, which has no stored text', () => {
    const fixtureStored = (): StoredCycle =>
      loadFixtureCycle(FIXTURES_DIR, V1.slot);
    const fixtureResult = (over = {}) => ({
      ...unitResultWithSynthesis(V1),
      inputs_sha256: readFixtureCycle(V1).inputs_sha256,
      ...over,
    });

    it('is VERIFIED when the runner hashes the parsed bundle to the stored inputs_sha256 and every envelope is equal', async () => {
      const runner = answering(fixtureResult());
      const report = await replayer(runner).replay(fixtureStored());
      expect(report).toMatchObject({
        origin: 'fixture',
        verdict: 'VERIFIED',
        inputs: {
          textSha256: null,
          storedSha256: readFixtureCycle(V1).inputs_sha256,
        },
      });
      expect(runner.requests[0].bundle).toEqual(readFixtureBundle(V1));
    });

    it('is TAMPERED_BUNDLE (the replayed hash differs) when the runner hashes the file to something else, and says why that cannot be told from a changed canonical form', async () => {
      const runner = answering(
        fixtureResult({ inputs_sha256: '0'.repeat(64) })
      );
      const report = await replayer(runner).replay(fixtureStored());
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'REPLAYED_HASH_DIFFERS',
      });
      expect(report.findings[0]).toContain('cannot be told apart');
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
    });

    it('that verdict outranks a version difference found in the same run', async () => {
      const stored = fixtureStored();
      stored.readings = stored.readings.map((r) =>
        r.mcdId === 'MCD1' ? asWrittenBy(r, '2.0.0') : r
      );
      const report = await replayer(
        answering(fixtureResult({ inputs_sha256: '0'.repeat(64) }))
      ).replay(stored);
      expect(report.verdict).toBe('TAMPERED_BUNDLE');
      expect(report.mcds.find((m) => m.mcdId === 'MCD1')?.verdict).toBe(
        'VERSION_MISMATCH'
      );
    });
  });

  describe('NOT_REPLAYABLE, with the cause named', () => {
    it('NOTHING_STORED: no bundle and no reading', async () => {
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const report = await replayer(runner).replay({
        ...storedCycle(V1),
        bundle: null,
        readings: [],
      });
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NOTHING_STORED',
        mcds: [],
      });
      expect(report.summary).toContain(
        'nothing is stored for XAUUSD at 2026-09-18T20:55Z'
      );
      expect(runner.requests).toEqual([]);
    });

    it('NO_STORED_BUNDLE: readings and no bundle (the bundle is kept 90 days, the readings are kept for good), and says so', async () => {
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const report = await replayer(runner).replay({
        ...storedCycle(V1),
        bundle: null,
      });
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_BUNDLE',
      });
      expect(report.summary).toContain('4 reading(s) are stored');
      expect(report.summary).toContain('bundles are kept 90 days');
      expect(runner.requests).toEqual([]);
    });

    it('NO_STORED_READINGS: a bundle and nothing to compare with', async () => {
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const report = await replayer(runner).replay({
        ...storedCycle(V1),
        readings: [],
      });
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_READINGS',
      });
      expect(runner.requests).toEqual([]);
    });

    it('MIXED_RETUNING: readings made under different enforcement cannot be reproduced by one run', async () => {
      const stored = withReading(storedCycle(V1), 'MCD2', (r) => ({
        ...r,
        retuningApplied: true,
      }));
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'MIXED_RETUNING',
      });
      expect(report.summary).toContain(
        'MCD0 applied false, MCD1 applied false, MCD2 applied true'
      );
      expect(runner.requests).toEqual([]);
    });

    it('NO_WORKER_CONFIG: the engine’s configuration cannot be read, or lists no MCD', async () => {
      const stored = storedCycle(V1);
      const unreadable = await new CycleReplayer(SETTINGS, {
        engineMcdIds: () => {
          throw new Error('ENOENT: no such file');
        },
        tempRoot,
      }).replay(stored);
      expect(unreadable).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_WORKER_CONFIG',
      });
      expect(unreadable.summary).toContain('ENOENT');
      const empty = await new CycleReplayer(SETTINGS, {
        engineMcdIds: () => [],
        tempRoot,
      }).replay(stored);
      expect(empty).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_WORKER_CONFIG',
      });
      expect(left()).toEqual([]);
    });

    it('reads the engine’s worker_config.yaml itself when no list is given, and names a missing engine folder', async () => {
      const stored = storedCycle(V1);
      const missing = await new CycleReplayer(
        { ...SETTINGS, engineDir: path.join(tempRoot, 'no-engine') },
        { tempRoot }
      ).replay(stored);
      expect(missing).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_WORKER_CONFIG',
      });
      const runner = answering(resultEqualTo(stored, V1));
      const ok = await new CycleReplayer(SETTINGS, {
        makeRunner: (settings) => {
          runner.starts.push({
            settings,
            config: fs.readFileSync(
              settings.workerConfigPath as string,
              'utf8'
            ),
          });
          return runner;
        },
        tempRoot,
      }).replay(stored);
      expect(ok.verdict).toBe('VERIFIED');
      expect(runner.starts[0].config).toContain("MCD3: 'shadow'");
    });

    it.each([
      ['SPAWN', false, 'it will fail the same way again'],
      ['TIMEOUT', true, 'a retry may help'],
      ['REQUEST', false, 'it will fail the same way again'],
      ['EXIT', true, 'a retry may help'],
      ['OUTPUT', false, 'it will fail the same way again'],
    ] as const)(
      'RUNNER_FAILED on a %s, nothing invented, nothing left behind',
      async (kind, retryable, said) => {
        const stored = storedCycle(V1);
        const runner = new RecordingRunner(() => {
          throw new RunnerError(kind, `the runner said ${kind}`, retryable);
        });
        const report = await replayer(runner).replay(stored);
        expect(report).toMatchObject({
          verdict: 'NOT_REPLAYABLE',
          cause: 'RUNNER_FAILED',
          mcds: [],
          runner: { replayedVersion: null, wallMs: null },
        });
        expect(report.summary).toBe(
          `the runner gave no result (${kind}): the runner said ${kind}`
        );
        expect(report.findings).toEqual([`runner failure ${kind}, ${said}`]);
        expect(left()).toEqual([]);
      }
    );

    it('an error that is not the runner’s is a bug, not a verdict: it is thrown, and the temporary folder is still removed', async () => {
      const runner = new RecordingRunner(() => {
        throw new TypeError('a bug');
      });
      await expect(replayer(runner).replay(storedCycle(V1))).rejects.toThrow(
        'a bug'
      );
      expect(left()).toEqual([]);
    });
  });
});

// ====================================================================== reading what is stored

describe('loadStoredCycle: the two tables, read with a select', () => {
  it('maps the bundle row and the readings, sorts the readings by MCD number, and asks for no more columns than it uses', async () => {
    const stored = storedCycle(V1);
    const { input, outputs } = rowsOf(stored);
    const db = fakeReplayDatabase(input, [...outputs].reverse());
    const loaded = await loadStoredCycle(db.database, 'XAUUSD', V1.slot);

    expect(loaded).toEqual(stored);
    expect(db.findUnique).toHaveBeenCalledTimes(1);
    expect(db.findUnique).toHaveBeenCalledWith({
      where: { symbol_cycle_slot: { symbol: 'XAUUSD', cycle_slot: V1.slot } },
      select: {
        bundle_gz: true,
        bundle_encoding: true,
        bundle_bytes: true,
        inputs_sha256: true,
        retuning_observed: true,
      },
    });
    expect(db.findMany).toHaveBeenCalledTimes(1);
    const args = db.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ symbol: 'XAUUSD', cycle_slot: V1.slot });
    expect(Object.keys(args.select).sort()).toEqual(
      [
        'envelope_json',
        'envelope_sha256',
        'evaluator_version',
        'flag',
        'inputs_sha256',
        'mcd_id',
        'retuning_applied',
        'runner_version',
      ].sort()
    );
    // the JSONB copy of the envelope is not read: the text is the evidence
    expect(args.select).not.toHaveProperty('envelope');
  });

  it('exposes only reads: the fake has findUnique and findMany and nothing that writes, and the load still works', async () => {
    const db = fakeReplayDatabase(null, []);
    expect(Object.keys(db.database).sort()).toEqual([
      'entryZone',
      'marketCycleInput',
      'mcdOutput',
      'synthesisReading',
    ]);
    expect(Object.keys(db.database.marketCycleInput)).toEqual(['findUnique']);
    expect(Object.keys(db.database.mcdOutput)).toEqual(['findMany']);
    expect(Object.keys(db.database.synthesisReading)).toEqual(['findMany']);
    expect(Object.keys(db.database.entryZone)).toEqual(['findMany']);
    expect(await loadStoredCycle(db.database, 'XAUUSD', V1.slot)).toEqual({
      origin: 'database',
      symbol: 'XAUUSD',
      slot: V1.slot,
      bundle: null,
      readings: [],
      synthesis: null,
      synthesisTablesMissing: false,
    });
  });

  it('sorts MCD10 after MCD9', async () => {
    const stored = storedCycle(V1);
    const { input, outputs } = rowsOf(stored);
    const make = (id: string) => ({ ...outputs[0], mcd_id: id });
    const db = fakeReplayDatabase(input, [
      make('MCD10'),
      make('MCD9'),
      make('MCD2'),
    ]);
    const loaded = await loadStoredCycle(db.database, 'XAUUSD', V1.slot);
    expect(loaded.readings.map((r) => r.mcdId)).toEqual([
      'MCD2',
      'MCD9',
      'MCD10',
    ]);
  });

  it('a loaded cycle replays the same as the cycle it was built from', async () => {
    const stored = storedCycle(V1);
    const { input, outputs } = rowsOf(stored);
    const loaded = await loadStoredCycle(
      fakeReplayDatabase(input, outputs).database,
      'XAUUSD',
      V1.slot
    );
    const tempRoot = makeTempRoot();
    try {
      const runner = answering(resultEqualTo(stored, V1));
      const report = await new CycleReplayer(
        SETTINGS,
        runner.hooks(tempRoot)
      ).replay(loaded);
      expect(report.verdict).toBe('VERIFIED');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('the stored fixtures', () => {
  const tmp: string[] = [];
  const makeDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-fixtures-'));
    tmp.push(dir);
    return dir;
  };
  afterAll(() =>
    tmp.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))
  );
  const copy = (
    fixture: FixtureSlot,
    dir: string,
    files = ['bundle', 'cycle']
  ) => {
    for (const kind of files)
      fs.copyFileSync(
        path.join(FIXTURES_DIR, `${fixture.stem}.${kind}.json`),
        path.join(dir, `${fixture.stem}.${kind}.json`)
      );
  };

  it('lists the three stored slots, v1, v3 and v4, oldest first', () => {
    expect(listFixtureSlots(FIXTURES_DIR)).toEqual(
      FIXTURE_SLOTS.map((f) => f.slot)
    );
  });

  it('lists nothing for a folder that is not there, and only the slots that have both files', () => {
    expect(
      listFixtureSlots(path.join(os.tmpdir(), 'no-such-replay-folder'))
    ).toEqual([]);
    const dir = makeDir();
    copy(V1, dir);
    copy(V3, dir, ['cycle']); // no bundle
    copy(V4, dir, ['bundle']); // no cycle
    fs.writeFileSync(path.join(dir, '2026-02-30T1000Z.cycle.json'), '{}');
    fs.writeFileSync(path.join(dir, '2026-02-30T1000Z.bundle.json'), '{}');
    fs.writeFileSync(path.join(dir, 'notes.cycle.json'), '{}');
    expect(listFixtureSlots(dir)).toEqual([V1.slot]);
  });

  it('loads a stored cycle as a parsed bundle and four readings, with the stored hash on each', () => {
    const stored = loadFixtureCycle(FIXTURES_DIR, V3.slot);
    const cycle = readFixtureCycle(V3);
    expect(stored).toMatchObject({
      origin: 'fixture',
      symbol: 'XAUUSD',
      slot: V3.slot,
    });
    expect(stored.bundle).toEqual({
      form: 'parsed',
      bundle: readFixtureBundle(V3),
      inputsSha256: cycle.inputs_sha256,
      retuningObserved: false,
    });
    expect(stored.readings.map((r) => r.mcdId)).toEqual(ENGINE_MCD_IDS);
    for (const [i, r] of stored.readings.entries()) {
      expect(r).toMatchObject({
        flag: 'shadow',
        evaluatorVersion: cycle.results[i].evaluator_version,
        envelopeJson: cycle.results[i].envelope_json,
        envelopeSha256: cycle.results[i].envelope_sha256,
        inputsSha256: cycle.inputs_sha256,
        retuningApplied: false,
        runnerVersion: cycle.runner_version,
      });
    }
  });

  it('a slot with no fixture is a cycle with nothing stored', () => {
    expect(loadFixtureCycle(makeDir(), V1.slot)).toEqual({
      origin: 'fixture',
      symbol: 'XAUUSD',
      slot: V1.slot,
      bundle: null,
      readings: [],
      synthesis: null,
      synthesisTablesMissing: false,
    });
  });

  it('a fixture that is not what it should be throws and names the file', () => {
    const notJson = makeDir();
    fs.writeFileSync(path.join(notJson, `${V1.stem}.bundle.json`), '{oops');
    fs.writeFileSync(path.join(notJson, `${V1.stem}.cycle.json`), '{}');
    expect(() => loadFixtureCycle(notJson, V1.slot)).toThrow(
      `${V1.stem}.bundle.json is not JSON`
    );

    const notCycle = makeDir();
    fs.writeFileSync(path.join(notCycle, `${V1.stem}.bundle.json`), '{}');
    fs.writeFileSync(
      path.join(notCycle, `${V1.stem}.cycle.json`),
      '{"symbol":"XAUUSD"}'
    );
    expect(() => loadFixtureCycle(notCycle, V1.slot)).toThrow(
      `${V1.stem}.cycle.json is not a stored cycle`
    );

    const badReading = makeDir();
    fs.writeFileSync(path.join(badReading, `${V1.stem}.bundle.json`), '{}');
    const cycle = readFixtureCycle(V1) as unknown as Record<string, unknown>;
    fs.writeFileSync(
      path.join(badReading, `${V1.stem}.cycle.json`),
      JSON.stringify({ ...cycle, results: [{ mcd_id: 'MCD0' }] })
    );
    expect(() => loadFixtureCycle(badReading, V1.slot)).toThrow(
      'results[0] is not a stored reading'
    );
  });
});

// ====================================================================== the command line

describe('the command line arguments', () => {
  const ok = (...argv: string[]): ReplayCliOptions => {
    const parsed = parseReplayArgs(argv);
    if ('error' in parsed) throw new Error(parsed.error);
    return parsed;
  };
  const bad = (...argv: string[]): string => {
    const parsed = parseReplayArgs(argv);
    if (!('error' in parsed)) throw new Error('expected an error');
    return parsed.error;
  };

  it('reads a slot as ISO text or as unix seconds, and nothing else', () => {
    expect(parseSlotArgument('2026-09-18T20:55Z')).toBe(V1.slot);
    expect(parseSlotArgument(String(V1.slot))).toBe(V1.slot);
    expect(parseSlotArgument('2026-09-18T20:56Z')).toBeNull();
    expect(parseSlotArgument('2026-02-30T10:00Z')).toBeNull();
    expect(parseSlotArgument(String(V1.slot + 1))).toBeNull();
    expect(parseSlotArgument('-300')).toBeNull();
    expect(parseSlotArgument('1.5')).toBeNull();
    expect(parseSlotArgument('99999999999999999999')).toBeNull();
    expect(parseSlotArgument('')).toBeNull();
    expect(parseSlotArgument('yesterday')).toBeNull();
  });

  it('--fixtures alone replays every stored fixture', () => {
    expect(ok('--fixtures')).toEqual({
      db: false,
      fixtures: true,
      slots: [],
      symbol: 'XAUUSD',
      python: null,
      engineDir: null,
      fixturesDir: null,
      json: false,
      help: false,
    });
  });

  it('takes --db with repeated slots (once each), a symbol, an interpreter and folders', () => {
    expect(
      ok(
        '--db',
        '--slot',
        '2026-09-18T20:55Z',
        '--slot',
        String(V3.slot),
        '--slot',
        String(V1.slot),
        '--symbol',
        'EURUSD',
        '--python',
        'py3',
        '--engine-dir',
        'E',
        '--fixtures-dir',
        'F',
        '--json'
      )
    ).toEqual({
      db: true,
      fixtures: false,
      slots: [V1.slot, V3.slot],
      symbol: 'EURUSD',
      python: 'py3',
      engineDir: 'E',
      fixturesDir: 'F',
      json: true,
      help: false,
    });
  });

  it('--help (or -h) needs no source and is not checked further', () => {
    expect(ok('--help').help).toBe(true);
    expect(ok('-h').help).toBe(true);
  });

  it.each([
    [['--nope'], 'unknown argument --nope'],
    [[], 'give exactly one of --db and --fixtures'],
    [['--db', '--fixtures'], 'give exactly one of --db and --fixtures'],
    [['--db'], '--db needs at least one --slot'],
    [['--fixtures', '--slot'], '--slot needs an ISO 8601 UTC slot'],
    [['--fixtures', '--slot', '--json'], '--slot needs an ISO 8601 UTC slot'],
    [['--fixtures', '--slot', 'soon'], '--slot needs an ISO 8601 UTC slot'],
    [['--fixtures', '--symbol'], '--symbol needs a value'],
    [['--fixtures', '--python', ''], '--python needs a value'],
    [['--fixtures', '--engine-dir', '--json'], '--engine-dir needs a value'],
    [['--fixtures', '--fixtures-dir'], '--fixtures-dir needs a value'],
  ] as const)('refuses %j with a message', (argv, message) => {
    expect(bad(...argv)).toContain(message);
  });
});

describe('exitCodeFor and the report text', () => {
  const report = (verdict: CycleReplayReport['verdict']): CycleReplayReport =>
    ({ verdict }) as CycleReplayReport;

  it('is 0 only when every cycle is VERIFIED', () => {
    expect(exitCodeFor([report('VERIFIED'), report('VERIFIED')])).toBe(0);
  });

  it('is 1 when a difference was found, whatever else happened', () => {
    for (const verdict of [
      'TAMPERED_BUNDLE',
      'STORED_READING_CORRUPT',
      'VERSION_MISMATCH',
      'LOGIC_DIVERGENCE',
    ] as const) {
      expect(exitCodeFor([report('VERIFIED'), report(verdict)])).toBe(1);
      expect(exitCodeFor([report('NOT_REPLAYABLE'), report(verdict)])).toBe(1);
    }
  });

  it('is 2 when a cycle could not be replayed and none differed, or when there was nothing to replay', () => {
    expect(exitCodeFor([report('VERIFIED'), report('NOT_REPLAYABLE')])).toBe(2);
    expect(exitCodeFor([])).toBe(2);
  });

  it('prints one block per cycle with the verdict, the hashes, one line per MCD, and a tally', async () => {
    const tempRoot = makeTempRoot();
    try {
      const stored = withReading(storedCycle(V1), 'MCD2', (r) =>
        withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
      );
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const found = await new CycleReplayer(
        SETTINGS,
        runner.hooks(tempRoot)
      ).replay(stored);
      const fine = await new CycleReplayer(
        SETTINGS,
        runner.hooks(tempRoot)
      ).replay(storedCycle(V1));
      const text = formatReplayReports([fine, found]);

      expect(text).toContain(
        'Replay of XAUUSD at 2026-09-18T20:55Z (slot 1789764900, from the database)'
      );
      expect(text).toContain(
        '  VERIFIED: 4 of 4 readings equal the stored ones'
      );
      expect(text).toContain(
        '  LOGIC_DIVERGENCE: MCD2: the same evaluator version 2.0.1 gave another envelope'
      );
      expect(text).toContain('first difference at character');
      expect(text).toContain(
        'retuning  enforced for the replay false (stored applied false, observed false)'
      );
      expect(text).toMatch(
        /MCD2 +LOGIC_DIVERGENCE +evaluator 2\.0\.1 +sha256 stored [0-9a-f]{16}… replayed [0-9a-f]{16}…/
      );
      expect(
        text.trimEnd().endsWith('2 cycle(s): 1 VERIFIED, 1 LOGIC_DIVERGENCE')
      ).toBe(true);
      expect(formatReplayReports([])).toBe('0 cycle(s): no cycle to replay');
      expect(formatReplayReport(fine)).toBe(text.split('\n\n')[0]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('shows a version change as an arrow, a NOT_REPLAYABLE cause in brackets and a tamper reason in brackets', async () => {
    const tempRoot = makeTempRoot();
    try {
      const runner = answering(resultEqualTo(storedCycle(V1), V1));
      const replayer = new CycleReplayer(SETTINGS, runner.hooks(tempRoot));
      const versioned = await replayer.replay(
        withReading(storedCycle(V1), 'MCD1', (r) => asWrittenBy(r, '2.0.0'))
      );
      expect(formatReplayReport(versioned)).toMatch(
        /MCD1 +VERSION_MISMATCH +evaluator 2\.0\.0 -> 2\.0\.1/
      );
      const gone = await replayer.replay({ ...storedCycle(V1), bundle: null });
      expect(formatReplayReport(gone)).toContain(
        'NOT_REPLAYABLE (NO_STORED_BUNDLE):'
      );
      const tampered = await replayer.replay(withTamperedText(storedCycle(V1)));
      expect(formatReplayReport(tampered)).toContain('TAMPERED_BUNDLE (HASH):');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('runReplayCommand on a fake runner', () => {
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const options = (over: Partial<ReplayCliOptions>): ReplayCliOptions => ({
    db: false,
    fixtures: false,
    slots: [],
    symbol: 'XAUUSD',
    python: null,
    engineDir: null,
    fixturesDir: null,
    json: false,
    help: false,
    ...over,
  });
  const fixtureRunner = () =>
    new RecordingRunner((request) => {
      const bundle = request.bundle as { cycle_slot: string };
      const fixture = FIXTURE_SLOTS.find(
        (f) => slotToIso(f.slot) === bundle.cycle_slot
      )!;
      return outputOf({
        ...unitResultWithSynthesis(fixture),
        inputs_sha256: readFixtureCycle(fixture).inputs_sha256,
      });
    });

  it('--fixtures replays all three stored slots in one command, oldest first, and exits 0', async () => {
    const runner = fixtureRunner();
    const result = await runReplayCommand(options({ fixtures: true }), {
      env: {},
      hooks: runner.hooks(tempRoot),
    });
    expect(result.reports.map((r) => [r.slot, r.verdict])).toEqual(
      FIXTURE_SLOTS.map((f) => [f.slot, 'VERIFIED'])
    );
    expect(runner.requests).toHaveLength(3);
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain('3 cycle(s): 3 VERIFIED');
  });

  it('--fixtures --slot narrows the replay to the slots asked for, in slot order', async () => {
    const result = await runReplayCommand(
      options({ fixtures: true, slots: [V4.slot, V3.slot] }),
      { env: {}, hooks: fixtureRunner().hooks(tempRoot) }
    );
    expect(result.reports.map((r) => r.slot)).toEqual([V3.slot, V4.slot]);
  });

  it('a slot with no fixture is NOT_REPLAYABLE and the command exits 2', async () => {
    const result = await runReplayCommand(
      options({ fixtures: true, slots: [V1.slot + 300] }),
      { env: {}, hooks: fixtureRunner().hooks(tempRoot) }
    );
    expect(result.reports[0]).toMatchObject({
      verdict: 'NOT_REPLAYABLE',
      cause: 'NOTHING_STORED',
    });
    expect(result.exitCode).toBe(2);
  });

  it('an empty fixture folder is nothing to replay: exit 2', async () => {
    const result = await runReplayCommand(
      options({ fixtures: true, fixturesDir: tempRoot }),
      { env: {}, hooks: fixtureRunner().hooks(tempRoot) }
    );
    expect(result.reports).toEqual([]);
    expect(result.exitCode).toBe(2);
    expect(result.text).toBe('0 cycle(s): no cycle to replay');
  });

  it('--json prints the reports as JSON', async () => {
    const result = await runReplayCommand(
      options({ fixtures: true, slots: [V1.slot], json: true }),
      { env: {}, hooks: fixtureRunner().hooks(tempRoot) }
    );
    expect(JSON.parse(result.text)).toEqual(
      JSON.parse(JSON.stringify(result.reports))
    );
    expect(JSON.parse(result.text)[0].verdict).toBe('VERIFIED');
  });

  it('reads the interpreter, the engine folder and the timeout from the environment, and the options win', async () => {
    const seen: Array<{
      python: string;
      engineDir: string;
      runnerTimeoutMs: number;
    }> = [];
    const runner = fixtureRunner();
    const hooks = runner.hooks(tempRoot, {
      makeRunner: (settings) => {
        seen.push({
          python: settings.python,
          engineDir: settings.engineDir,
          runnerTimeoutMs: settings.runnerTimeoutMs,
        });
        return runner;
      },
    });
    await runReplayCommand(
      options({ fixtures: true, slots: [V1.slot], fixturesDir: FIXTURES_DIR }),
      {
        env: {
          SENSOR_PYTHON: 'py-from-env',
          SENSOR_ENGINE_DIR: ENGINE_DIR,
          SENSOR_RUNNER_TIMEOUT_MS: '777',
        },
        hooks,
      }
    );
    await runReplayCommand(
      options({
        fixtures: true,
        slots: [V1.slot],
        python: 'py-from-flag',
        engineDir: ENGINE_DIR,
        fixturesDir: FIXTURES_DIR,
      }),
      { env: { SENSOR_PYTHON: 'py-from-env' }, hooks }
    );
    expect(seen).toEqual([
      { python: 'py-from-env', engineDir: ENGINE_DIR, runnerTimeoutMs: 777 },
      {
        python: 'py-from-flag',
        engineDir: ENGINE_DIR,
        runnerTimeoutMs: 30_000,
      },
    ]);
  });

  describe('--db', () => {
    const wired = (stored: StoredCycle) => {
      const { input, outputs } = rowsOf(stored);
      const db = fakeReplayDatabase(input, outputs);
      const close = jest.fn(async () => undefined);
      return {
        db,
        close,
        openDatabase: async () => ({ database: db.database, close }),
      };
    };

    it('reads each slot asked for, replays it, and closes the database', async () => {
      const stored = storedCycle(V1);
      const { db, close, openDatabase } = wired(stored);
      const runner = answering(resultEqualTo(stored, V1));
      const result = await runReplayCommand(
        options({ db: true, slots: [V1.slot] }),
        { env: {}, openDatabase, hooks: runner.hooks(tempRoot) }
      );
      expect(result.reports.map((r) => r.verdict)).toEqual(['VERIFIED']);
      expect(result.exitCode).toBe(0);
      expect(db.findUnique).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('asks for the symbol it was given', async () => {
      const stored = storedCycle(V1);
      const { db, openDatabase } = wired(stored);
      await runReplayCommand(
        options({ db: true, slots: [V1.slot], symbol: 'EURUSD' }),
        {
          env: {},
          openDatabase,
          hooks: answering(resultEqualTo(stored, V1)).hooks(tempRoot),
        }
      );
      expect(db.findMany.mock.calls[0][0].where.symbol).toBe('EURUSD');
    });

    it('closes the database even when a replay throws', async () => {
      const stored = storedCycle(V1);
      const { close, openDatabase } = wired(stored);
      const runner = new RecordingRunner(() => {
        throw new TypeError('a bug');
      });
      await expect(
        runReplayCommand(options({ db: true, slots: [V1.slot] }), {
          env: {},
          openDatabase,
          hooks: runner.hooks(tempRoot),
        })
      ).rejects.toThrow('a bug');
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('a database that cannot be opened is an error the caller sees, before anything is replayed', async () => {
      await expect(
        runReplayCommand(options({ db: true, slots: [V1.slot] }), {
          env: {},
          openDatabase: async () => {
            throw new Error('no DATABASE_URL');
          },
        })
      ).rejects.toThrow('no DATABASE_URL');
      await expect(
        runReplayCommand(options({ db: true, slots: [V1.slot] }), { env: {} })
      ).rejects.toThrow('openDatabase is not wired');
    });
  });
});

// ====================================================================== the script

describe('scripts/replay-cycle.js', () => {
  const script = path.join(ROOT, 'scripts', 'replay-cycle.js');
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 240_000,
      env: { ...process.env, DATABASE_URL: '', ...env },
    });

  it('is plain JavaScript outside the TypeScript build (tsconfig compiles scripts/**/*.ts) and passes the syntax check', () => {
    // A .ts file under scripts/ would change the build's output layout (dist/main.js to dist/src/main.js).
    const ts = fs
      .readdirSync(path.join(ROOT, 'scripts'))
      .filter((f) => f.endsWith('.ts'));
    expect(ts).toEqual([]);
    expect(execFileSync(process.execPath, ['-c', script]).length).toBe(0);
    expect(
      fs.readFileSync(script, 'utf8').startsWith('#!/usr/bin/env node\n')
    ).toBe(true);
  });

  it('--help prints the usage and exits 0', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout.trimEnd()).toBe(REPLAY_USAGE);
  });

  it('exits 2 with the usage on a bad argument, and when neither source is named', () => {
    const bad = run(['--nope']);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown argument --nope');
    expect(bad.stderr).toContain('Usage:');
    const none = run([]);
    expect(none.status).toBe(2);
    expect(none.stderr).toContain('give exactly one of --db and --fixtures');
    const noSlot = run(['--db']);
    expect(noSlot.status).toBe(2);
    expect(noSlot.stderr).toContain('--db needs at least one --slot');
  });

  it('exits 2 and says why when --db has no DATABASE_URL, without touching a database', () => {
    const r = run(['--db', '--slot', '2026-09-18T20:55Z']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('replay-cycle: DATABASE_URL is not set');
  });

  it('exits 2 for a fixture slot that does not exist (no Python is needed to say so)', () => {
    const r = run(['--fixtures', '--slot', '2030-01-01T00:00Z']);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('NOT_REPLAYABLE (NOTHING_STORED)');
    expect(r.stdout).toContain('1 cycle(s): 1 NOT_REPLAYABLE');
  });

  it('the usage names every verdict and every exit status', () => {
    for (const word of [
      'VERIFIED',
      'TAMPERED_BUNDLE',
      'STORED_READING_CORRUPT',
      'VERSION_MISMATCH',
      'LOGIC_DIVERGENCE',
      'NOT_REPLAYABLE',
      '--db',
      '--fixtures',
      '--slot',
      'Exit status: 0',
    ])
      expect(REPLAY_USAGE).toContain(word);
  });
});

// ====================================================================== the real runner

const pythonSuite = pythonAvailable() ? describe : describe.skip;

pythonSuite('replay with the real Python runner', () => {
  jest.setTimeout(240_000);
  let dir: string;
  let shadow: string;
  let subset: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-real-'));
    shadow = path.join(dir, 'shadow.yaml');
    fs.writeFileSync(
      shadow,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'shadow'\n  MCD2: 'shadow'\n  MCD3: 'shadow'\n"
    );
    subset = path.join(dir, 'subset.yaml');
    fs.writeFileSync(
      subset,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'off'\n  MCD2: 'shadow'\n  MCD3: 'off'\n"
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  /** What the worker would have stored for a bundle: the runner's own text and readings, in the database form. */
  async function storedByRunner(
    fixture: FixtureSlot,
    {
      bundle = readFixtureBundle(fixture) as unknown,
      enforced = false,
      config = shadow,
    }: { bundle?: unknown; enforced?: boolean; config?: string } = {}
  ): Promise<StoredCycle> {
    const run = await new PythonCycleRunner({
      ...SETTINGS,
      workerConfigPath: config,
    }).run({ bundle, retuningEnforced: enforced });
    const r = run.result;
    const text = r.bundle_canonical_json as string;
    return {
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
  }

  const replayer = () => new CycleReplayer(SETTINGS);

  describe('determinism: the three stored cycles replay byte for byte', () => {
    it('every fixture slot (v1, v3, v4) is VERIFIED in one command, all four MCDs each', async () => {
      const result = await runReplayCommand(
        {
          db: false,
          fixtures: true,
          slots: [],
          symbol: 'XAUUSD',
          python: null,
          engineDir: null,
          fixturesDir: null,
          json: false,
          help: false,
        },
        { env: {} }
      );
      expect(
        result.reports.map((r) => [r.slotIso, r.verdict, r.mcds.length])
      ).toEqual([
        ['2026-09-18T20:55Z', 'VERIFIED', 4],
        ['2026-09-28T14:15Z', 'VERIFIED', 4],
        ['2026-09-28T23:15Z', 'VERIFIED', 4],
      ]);
      for (const report of result.reports) {
        expect(report.findings).toEqual([]);
        for (const mcd of report.mcds)
          expect(mcd).toMatchObject({ textEqual: true, hashEqual: true });
        expect(report.inputs.replayedSha256).toBe(report.inputs.storedSha256);
      }
      expect(result.exitCode).toBe(0);
    });

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      'a cycle stored the way the worker stores it (the runner’s own text, gzipped) replays VERIFIED: %s',
      async (_name, fixture) => {
        const stored = await storedByRunner(fixture);
        expect(stored.readings).toHaveLength(4);
        const report = await replayer().replay(stored);
        expect(report.verdict).toBe('VERIFIED');
        expect(report.inputs.textSha256).toBe(report.inputs.storedSha256);
        expect(report.inputs.replayedSha256).toBe(report.inputs.storedSha256);
        // the stored text is the runner's own text, and the replay got that same text back
        expect(sha256(textOf(stored))).toBe(report.inputs.storedSha256);
      }
    );

    it('does not depend on Python’s hash seed: two replays under different PYTHONHASHSEED values are equal', async () => {
      const stored = await storedByRunner(V1);
      const before = process.env['PYTHONHASHSEED'];
      try {
        const reports: CycleReplayReport[] = [];
        for (const seed of ['0', '12345']) {
          process.env['PYTHONHASHSEED'] = seed;
          reports.push(await replayer().replay(stored));
        }
        expect(reports.map((r) => r.verdict)).toEqual(['VERIFIED', 'VERIFIED']);
        expect(reports[0].mcds.map((m) => m.replayedEnvelopeSha256)).toEqual(
          reports[1].mcds.map((m) => m.replayedEnvelopeSha256)
        );
      } finally {
        if (before === undefined) delete process.env['PYTHONHASHSEED'];
        else process.env['PYTHONHASHSEED'] = before;
      }
    });

    it('a bundle with numbers JavaScript and Python write differently (1e-07, 1e+21, a large integer, a denormal, a long decimal) survives the round trip: VERIFIED', async () => {
      const bundle = readFixtureBundle(V1) as unknown as {
        bars: { M5: Array<Record<string, number>> };
      };
      Object.assign(bundle.bars.M5[0], {
        close: 1e-7,
        best_fit_a_ssa: 1e21,
        best_fit_a_uoedt: 9007199254740994,
        best_fit_a_loedt: 5e-324,
        best_fit_b_uoedt: 123456789.123456789,
      });
      const stored = await storedByRunner(V1, { bundle });
      const text = textOf(stored);
      expect(text).toContain('1e-07');
      expect(text).toContain('1e+21');
      expect(text).toContain('9007199254740994');
      expect(text).toContain('5e-324');
      const report = await replayer().replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.inputs.replayedSha256).toBe(report.inputs.storedSha256);
    });
  });

  describe('flags and RETUNING come from the stored rows', () => {
    it('a cycle stored with only MCD0 and MCD2 on replays with only those two (MCD1 and MCD3 stay off), under a committed configuration that has every MCD off', async () => {
      const stored = await storedByRunner(V1, { config: subset });
      expect(stored.readings.map((r) => r.mcdId)).toEqual(['MCD0', 'MCD2']);
      const report = await replayer().replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.mcds.map((m) => m.mcdId)).toEqual(['MCD0', 'MCD2']);
      expect(report.findings).toEqual([]);
    });

    it('a cycle made while RETUNING was enforced replays with enforcement on: all four CAUTIONARY with RETUNING, VERIFIED', async () => {
      const bundle = { ...readFixtureBundle(V1), retuning: true } as unknown;
      const stored = await storedByRunner(V1, { bundle, enforced: true });
      expect(stored.readings.every((r) => r.retuningApplied)).toBe(true);
      expect(
        stored.readings.every((r) => r.envelopeJson.includes('"RETUNING"'))
      ).toBe(true);
      const report = await replayer().replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.retuning).toMatchObject({
        enforcedForReplay: true,
        storedApplied: true,
        replayedApplied: true,
      });
    });

    it('the enforcement matters: the same stored bundle replayed with enforcement OFF would not match, so the switch the replay sends is what makes it VERIFIED', async () => {
      const bundle = { ...readFixtureBundle(V1), retuning: true } as unknown;
      const stored = await storedByRunner(V1, { bundle, enforced: true });
      const wrong = await new PythonCycleRunner({
        ...SETTINGS,
        workerConfigPath: shadow,
      }).run({ bundle: JSON.parse(textOf(stored)), retuningEnforced: false });
      const differing = wrong.result.results.filter(
        (r, i) => r.envelope_sha256 !== stored.readings[i].envelopeSha256
      );
      expect(differing.length).toBeGreaterThan(0);
    });

    it('a cycle that saw RETUNING and did not apply it replays VERIFIED with enforcement off', async () => {
      const bundle = { ...readFixtureBundle(V1), retuning: true } as unknown;
      const stored = await storedByRunner(V1, { bundle, enforced: false });
      expect(stored.readings.every((r) => !r.retuningApplied)).toBe(true);
      const report = await replayer().replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.retuning.enforcedForReplay).toBe(false);
    });
  });

  describe('the four findings, with the real runner', () => {
    it('(b) a tampered bundle: one changed byte is TAMPERED_BUNDLE, no run (no runner time, no replayed hash)', async () => {
      const stored = await storedByRunner(V1);
      const tampered = withTamperedText(stored, (text) =>
        text.replace('4326.5', '4326.6')
      );
      expect(textOf(tampered)).not.toBe(textOf(stored));
      const report = await replayer().replay(tampered);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'HASH',
        mcds: [],
        runner: { wallMs: null },
        inputs: { replayedSha256: null },
      });
    });

    it('(b) a bundle and its hash both rewritten, with the readings left alone, is TAMPERED_BUNDLE: the readings name the old inputs', async () => {
      const stored = await storedByRunner(V1);
      const text = textOf(stored).replace('4326.5', '4326.6');
      const forged: StoredCycle = {
        ...stored,
        bundle: {
          ...(stored.bundle as object),
          gz: gzipSync(Buffer.from(text, 'utf8')),
          bytes: Buffer.byteLength(text, 'utf8'),
          inputsSha256: sha256(text),
        } as never,
      };
      const report = await replayer().replay(forged);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'READINGS_NAME_OTHER_INPUTS',
      });
    });

    it('(c) an evaluator version change: a row written by 2.0.0 is VERSION_MISMATCH against evaluator 2.0.1, and nothing else is flagged', async () => {
      const stored = await storedByRunner(V1);
      const older = withReading(stored, 'MCD1', (r) => asWrittenBy(r, '2.0.0'));
      const report = await replayer().replay(older);
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
        hashEqual: false,
      });
      expect(report.inputs.replayedSha256).toBe(report.inputs.storedSha256);
    });

    it('(d) a logic divergence: the same version and inputs with another stored envelope is LOGIC_DIVERGENCE, located', async () => {
      const stored = await storedByRunner(V1);
      const changed = withReading(stored, 'MCD2', (r) =>
        withChangedEnvelope(r, '"status":"CAUTIONARY"', '"status":"VALID"')
      );
      const report = await replayer().replay(changed);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(
        report.mcds.filter((m) => m.verdict !== 'VERIFIED').map((m) => m.mcdId)
      ).toEqual(['MCD2']);
      const difference = report.mcds[2].difference!;
      expect(difference.stored).toContain('VALID');
      expect(difference.replayed).toContain('CAUTIONARY');
    });

    it('a stored row that does not hash to its own hash is STORED_READING_CORRUPT, not a divergence', async () => {
      const stored = await storedByRunner(V1);
      const broken = withReading(stored, 'MCD0', (r) => ({
        ...r,
        envelopeJson: r.envelopeJson.replace('"VALID"', '"VALIF"'),
      }));
      const report = await replayer().replay(broken);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.mcds[0].verdict).toBe('STORED_READING_CORRUPT');
    });

    it('a fixture whose bundle file was changed is TAMPERED_BUNDLE (REPLAYED_HASH_DIFFERS), found through the runner’s own hash', async () => {
      const copyDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'replay-tampered-fixture-')
      );
      try {
        fs.copyFileSync(
          path.join(FIXTURES_DIR, `${V1.stem}.cycle.json`),
          path.join(copyDir, `${V1.stem}.cycle.json`)
        );
        const bundleText = fs.readFileSync(
          path.join(FIXTURES_DIR, `${V1.stem}.bundle.json`),
          'utf8'
        );
        expect(bundleText).toContain('4326.5');
        fs.writeFileSync(
          path.join(copyDir, `${V1.stem}.bundle.json`),
          bundleText.replace('4326.5', '4326.6')
        );
        const result = await runReplayCommand(
          {
            db: false,
            fixtures: true,
            slots: [],
            symbol: 'XAUUSD',
            python: null,
            engineDir: null,
            fixturesDir: copyDir,
            json: false,
            help: false,
          },
          { env: {} }
        );
        expect(result.reports[0]).toMatchObject({
          verdict: 'TAMPERED_BUNDLE',
          tamperReason: 'REPLAYED_HASH_DIFFERS',
        });
        expect(result.exitCode).toBe(1);
      } finally {
        fs.rmSync(copyDir, { recursive: true, force: true });
      }
    });

    it('a runner that cannot be started is NOT_REPLAYABLE (RUNNER_FAILED), never a verdict about the cycle', async () => {
      const report = await new CycleReplayer({
        ...SETTINGS,
        python: 'no-such-python-for-replay',
      }).replay(await storedByRunner(V1));
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'RUNNER_FAILED',
      });
      expect(report.summary).toContain('SPAWN');
    });

    it('a configuration the runner refuses (a stored MCD the kit does not know) is RUNNER_FAILED (REQUEST), not a verdict about the cycle', async () => {
      const stored = await storedByRunner(V1);
      const alien = withReading(stored, 'MCD0', (r) => ({
        ...r,
        mcdId: 'MCD77',
      }));
      const report = await replayer().replay(alien);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'RUNNER_FAILED',
      });
      expect(report.summary).toContain('(REQUEST)');
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

    it('--fixtures replays v1, v3 and v4 in one command: three VERIFIED, exit 0', () => {
      const r = run(['--fixtures']);
      expect(r.status).toBe(0);
      expect(r.stdout.match(/^ {2}VERIFIED: 4 of 4 readings/gm)).toHaveLength(
        3
      );
      expect(r.stdout).toContain('3 cycle(s): 3 VERIFIED');
      for (const iso of [
        '2026-09-18T20:55Z',
        '2026-09-28T14:15Z',
        '2026-09-28T23:15Z',
      ])
        expect(r.stdout).toContain(`Replay of XAUUSD at ${iso}`);
    });

    it('--fixtures --slot replays one slot, given as ISO text or unix seconds, and --json is JSON', () => {
      const iso = run(['--fixtures', '--slot', '2026-09-28T14:15Z', '--json']);
      expect(iso.status).toBe(0);
      const reports = JSON.parse(iso.stdout);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ slot: V3.slot, verdict: 'VERIFIED' });
      const unix = run(['--fixtures', '--slot', String(V3.slot)]);
      expect(unix.status).toBe(0);
      expect(unix.stdout).toContain('1 cycle(s): 1 VERIFIED');
    });

    it('exits 1 and says TAMPERED_BUNDLE for a fixture folder whose bundle was changed', () => {
      const copyDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'replay-cli-tampered-')
      );
      try {
        for (const kind of ['cycle', 'bundle'])
          fs.copyFileSync(
            path.join(FIXTURES_DIR, `${V4.stem}.${kind}.json`),
            path.join(copyDir, `${V4.stem}.${kind}.json`)
          );
        const file = path.join(copyDir, `${V4.stem}.bundle.json`);
        const text = fs.readFileSync(file, 'utf8');
        const first = /"close":\s*(\d+\.\d+)/.exec(text)!;
        fs.writeFileSync(file, text.replace(first[0], `"close": ${first[1]}1`));
        const r = run(['--fixtures', '--fixtures-dir', copyDir]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('TAMPERED_BUNDLE (REPLAYED_HASH_DIFFERS)');
        expect(r.stdout).toContain('1 cycle(s): 1 TAMPERED_BUNDLE');
      } finally {
        fs.rmSync(copyDir, { recursive: true, force: true });
      }
    });
  });
});
