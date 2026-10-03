import { gunzipSync } from 'zlib';
import { PrismaService } from '../src/prisma/prisma.service';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import {
  CycleWriteRefused,
  INPUTS_RETENTION_DAYS,
  McdOutputsWriter,
} from '../src/sensors/mcd-outputs.writer';
import {
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import {
  FakeSensorPrisma,
  STUB_BUNDLE_TEXT,
  sha256,
  unitResult,
} from './helpers/sensors-worker-world';

/**
 * The writer (build step 3 part 4): one transaction per cycle with every reading, the bundle and
 * the 90-day cleanup; append-only by key; and the last gate before a row exists. The database
 * itself (CHECKs, rollback of a statement that fails) is asked in `sensors-worker.pg.spec.ts`;
 * here a Prisma that is lazy and transactional like the real one shows what the writer sends.
 */

const v1 = FIXTURE_SLOTS[0];
const NOW = v1.slot + 70;

function make() {
  const prisma = new FakeSensorPrisma();
  const writer = new McdOutputsWriter(
    prisma as unknown as PrismaService,
    new EnvelopeValidator()
  );
  return { prisma, writer };
}

const write = (
  fixture: FixtureSlot = v1,
  over: Partial<ReturnType<typeof unitResult>> = {},
  evaluatedAt = NOW
) => ({
  symbol: 'XAUUSD',
  slot: fixture.slot,
  result: unitResult(fixture, over),
  evaluatedAt,
});

describe('McdOutputsWriter: what a cycle writes', () => {
  it('writes one row per MCD the runner ran, with every column of the reading and of the cycle', async () => {
    const { prisma, writer } = make();
    const summary = await writer.writeCycle(write());
    expect(summary).toEqual({
      outputsInserted: 4,
      outputsExisting: 0,
      inputsInserted: true,
      inputsDeleted: 0,
    });
    const stored = readFixtureCycle(v1);
    expect(prisma.outputs).toHaveLength(4);
    stored.results.forEach((reading, index) => {
      const row = prisma.outputs[index];
      expect(row).toMatchObject({
        symbol: 'XAUUSD',
        cycle_slot: v1.slot,
        mcd_id: reading.mcd_id,
        flag: reading.flag,
        evaluator_version: reading.evaluator_version,
        status: reading.status,
        state_code: reading.state_code,
        bias: reading.bias,
        envelope_json: reading.envelope_json,
        envelope_sha256: reading.envelope_sha256,
        evaluator_envelope_sha256: reading.evaluator_envelope_sha256,
        inputs_sha256: sha256(STUB_BUNDLE_TEXT),
        inherited_reasons: reading.inherited_reasons,
        guard_problems: reading.guard_problems,
        retuning_observed: stored.retuning.observed,
        retuning_applied: stored.retuning.applied,
        runner_version: stored.runner_version,
        python_version: '3.11.9',
        evaluated_at: NOW,
      });
      expect(row['duration_ms']).toBe(1.5 + index);
      // the JSON copy is the same document as the text
      expect(row['envelope']).toEqual(JSON.parse(reading.envelope_json));
    });
  });

  it('stores the envelope text byte for byte as the runner wrote it', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write());
    const stored = readFixtureCycle(v1);
    expect(prisma.outputs.map((r) => r['envelope_json'])).toEqual(
      stored.results.map((r) => r.envelope_json)
    );
    for (const row of prisma.outputs)
      expect(sha256(row['envelope_json'] as string)).toBe(
        row['envelope_sha256']
      );
  });

  it('stores the bundle text the runner returned, gzipped, with its length in bytes and its hash (never a rebuilt text)', async () => {
    const { prisma, writer } = make();
    const text = '{"bars":{"M5":[{"close":1e-05}]},"unit":"°"}';
    await writer.writeCycle(
      write(v1, { bundle_canonical_json: text, inputs_sha256: sha256(text) })
    );
    expect(prisma.inputs).toHaveLength(1);
    const row = prisma.inputs[0];
    expect(row).toMatchObject({
      symbol: 'XAUUSD',
      cycle_slot: v1.slot,
      bundle_encoding: 'gzip',
      bundle_bytes: Buffer.byteLength(text, 'utf8'),
      inputs_sha256: sha256(text),
      retuning_observed: false,
    });
    expect(Buffer.byteLength(text, 'utf8')).toBe(text.length + 1); // the degree sign is two bytes: bytes, not characters
    expect(gunzipSync(row['bundle_gz'] as Buffer).toString('utf8')).toBe(text);
  });

  it('the bundle row and the readings are written by ONE transaction, in that order, and nothing is written outside it', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write());
    expect(prisma.transactions).toEqual([
      {
        ops: [
          'mcdOutput.createMany',
          'marketCycleInput.createMany',
          'marketCycleInput.deleteMany',
        ],
        committed: true,
      },
    ]);
    expect(prisma.autocommitted).toEqual([]);
  });

  it('records RETUNING as observed and as applied, separately', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(
      write(v1, {
        retuning: { observed: true, enforced: false, applied: false },
      })
    );
    expect(
      new Set(
        prisma.outputs.map((r) =>
          [r['retuning_observed'], r['retuning_applied']].join()
        )
      )
    ).toEqual(new Set(['true,false']));
    expect(prisma.inputs[0]['retuning_observed']).toBe(true);
  });

  it('a result with no bundle text writes the readings (inputs_sha256 NULL) and no bundle row', async () => {
    const { prisma, writer } = make();
    const summary = await writer.writeCycle(
      write(v1, { bundle_canonical_json: null, inputs_sha256: null })
    );
    expect(summary).toMatchObject({
      outputsInserted: 4,
      inputsInserted: false,
    });
    expect(prisma.outputs.every((r) => r['inputs_sha256'] === null)).toBe(true);
    expect(prisma.inputs).toEqual([]);
  });
});

describe('McdOutputsWriter: append-only by key', () => {
  it('a cycle delivered twice writes nothing the second time', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write());
    const second = await writer.writeCycle(write(v1, {}, NOW + 40));
    expect(second).toEqual({
      outputsInserted: 0,
      outputsExisting: 4,
      inputsInserted: false,
      inputsDeleted: 0,
    });
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.inputs).toHaveLength(1);
    // the rows keep what they were first written with
    expect(prisma.outputs.every((r) => r['evaluated_at'] === NOW)).toBe(true);
  });

  it('an MCD switched on later adds just its own row to a cycle that exists', async () => {
    const { prisma, writer } = make();
    const full = unitResult(v1);
    await writer.writeCycle({
      ...write(),
      result: { ...full, results: full.results.slice(0, 2) },
    });
    expect(prisma.outputs).toHaveLength(2);
    const second = await writer.writeCycle(write());
    expect(second).toMatchObject({
      outputsInserted: 2,
      outputsExisting: 2,
      inputsInserted: false,
    });
    expect(prisma.outputs.map((r) => r['mcd_id'])).toEqual([
      'MCD0',
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
  });

  it('two cycles are two sets of rows, keyed by slot', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v1));
    await writer.writeCycle(
      write(FIXTURE_SLOTS[1], {}, FIXTURE_SLOTS[1].slot + 70)
    );
    expect(prisma.outputs).toHaveLength(8);
    expect(prisma.inputs.map((r) => r['cycle_slot'])).toEqual([
      v1.slot,
      FIXTURE_SLOTS[1].slot,
    ]);
  });
});

describe('McdOutputsWriter: the 90-day cleanup of stored bundles, in the same transaction', () => {
  const DAY = 86_400;
  const bundleRow = (cycle_slot: number) => ({
    symbol: 'XAUUSD',
    cycle_slot,
    bundle_gz: Buffer.from('x'),
    bundle_encoding: 'gzip',
    bundle_bytes: 1,
    inputs_sha256: 'h',
    retuning_observed: false,
  });

  it('is 90 days', () => {
    expect(INPUTS_RETENTION_DAYS).toBe(90);
  });

  it('deletes bundles whose cycle_slot is before now - 90 days and keeps the rest', async () => {
    const { prisma, writer } = make();
    const cutoff = NOW - 90 * DAY;
    prisma.inputs.push(
      bundleRow(cutoff - 300),
      bundleRow(cutoff - 1),
      bundleRow(cutoff),
      bundleRow(cutoff + 300),
      bundleRow(NOW - 10 * DAY)
    );
    const summary = await writer.writeCycle(write());
    expect(summary.inputsDeleted).toBe(2);
    expect(prisma.inputs.map((r) => r['cycle_slot']).sort()).toEqual(
      [cutoff, cutoff + 300, NOW - 10 * DAY, v1.slot].sort()
    );
  });

  it('counts the 90 days back from the worker’s clock at the write, not from the slot', async () => {
    const { prisma, writer } = make();
    prisma.inputs.push(bundleRow(v1.slot - 89 * DAY));
    // evaluated 2 days after the slot: that bundle is now 91 days old
    const summary = await writer.writeCycle(write(v1, {}, v1.slot + 2 * DAY));
    expect(summary.inputsDeleted).toBe(1);
  });

  it('deletes the old bundles of any symbol and leaves every reading alone (mcd_outputs has no retention)', async () => {
    const { prisma, writer } = make();
    prisma.inputs.push({ ...bundleRow(1000), symbol: 'EURUSD' });
    prisma.outputs.push({ symbol: 'XAUUSD', cycle_slot: 1000, mcd_id: 'MCD0' });
    await writer.writeCycle(write());
    expect(prisma.inputs.map((r) => r['symbol'])).toEqual(['XAUUSD']);
    expect(prisma.outputs.find((r) => r['cycle_slot'] === 1000)).toBeDefined();
  });

  it('runs on a re-delivery too (it is cheap, and a cycle that only repeats still clears the old)', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write());
    prisma.inputs.push(bundleRow(NOW - 91 * DAY));
    const second = await writer.writeCycle(write());
    expect(second.outputsInserted).toBe(0);
    expect(second.inputsDeleted).toBe(1);
  });

  it('is all or nothing with the readings: when the delete fails, no reading and no bundle of this cycle is kept', async () => {
    const { prisma, writer } = make();
    prisma.inputs.push(bundleRow(NOW - 91 * DAY));
    prisma.failOn('marketCycleInput.deleteMany', new Error('lock timeout'));
    await expect(writer.writeCycle(write())).rejects.toThrow('lock timeout');
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs.map((r) => r['cycle_slot'])).toEqual([NOW - 91 * DAY]);
    expect(prisma.transactions.at(-1)?.committed).toBe(false);
  });
});

describe('McdOutputsWriter: all or nothing', () => {
  it('a bundle row that cannot be written takes the readings back with it', async () => {
    const { prisma, writer } = make();
    prisma.failOn('marketCycleInput.createMany', new Error('disk full'));
    await expect(writer.writeCycle(write())).rejects.toThrow('disk full');
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
  });

  it('readings that cannot be written leave no bundle', async () => {
    const { prisma, writer } = make();
    prisma.failOn('mcdOutput.createMany', new Error('check constraint'));
    await expect(writer.writeCycle(write())).rejects.toThrow(
      'check constraint'
    );
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
  });

  it('a lost connection is an error for the caller (Bull retries) and nothing is half-written', async () => {
    const { prisma, writer } = make();
    prisma.failTransaction(new Error('connection lost'));
    await expect(writer.writeCycle(write())).rejects.toThrow('connection lost');
    expect(prisma.outputs).toEqual([]);
    // and the same cycle written after the connection is back is a clean first write
    prisma.clearFailures();
    expect(await writer.writeCycle(write())).toMatchObject({
      outputsInserted: 4,
    });
  });
});

describe('McdOutputsWriter: nothing is written until the cycle is whole and right', () => {
  const refused = async (
    mutate: (r: ReturnType<typeof unitResult>) => void,
    expected: RegExp,
    over: { symbol?: string; slot?: number } = {}
  ) => {
    const { prisma, writer } = make();
    const result = JSON.parse(JSON.stringify(unitResult(v1)));
    mutate(result);
    let caught: unknown;
    try {
      await writer.writeCycle({ ...write(), result, ...over });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CycleWriteRefused);
    expect((caught as CycleWriteRefused).problems.join('; ')).toMatch(expected);
    expect((caught as Error).message).toMatch(/nothing written/);
    // refused before any database call
    expect(prisma.transactions).toEqual([]);
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
  };

  it('refuses an envelope that breaks the schema', () =>
    refused((r) => {
      const e = JSON.parse(r.results[2].envelope_json);
      delete e.mcd_id;
      r.results[2].envelope_json = JSON.stringify(e);
      r.results[2].envelope_sha256 = sha256(r.results[2].envelope_json);
    }, /MCD2: envelope breaks mcd-output\/1: .*mcd_id/));

  it('refuses an envelope that is not JSON', () =>
    refused((r) => {
      r.results[0].envelope_json = 'not json';
      r.results[0].envelope_sha256 = sha256('not json');
    }, /MCD0: envelope breaks mcd-output\/1: <root>: not JSON/));

  it('refuses an envelope that does not hash to the hash the runner reported', () =>
    refused(
      (r) => (r.results[1].envelope_sha256 = 'f'.repeat(64)),
      /MCD1: envelope_json does not hash to envelope_sha256/
    ));

  it('refuses an envelope of another MCD than the row says', () =>
    refused(
      (r) => (r.results[3].mcd_id = 'MCD2'),
      /MCD2: the envelope is MCD MCD3/
    ));

  it('refuses an envelope for another slot than the cycle’s', () =>
    refused((r) => {
      const e = JSON.parse(r.results[0].envelope_json);
      e.cycle_slot = '2026-09-18T20:50Z';
      r.results[0].envelope_json = JSON.stringify(e);
      r.results[0].envelope_sha256 = sha256(r.results[0].envelope_json);
    }, /MCD0: the envelope is for slot 2026-09-18T20:50Z, not 2026-09-18T20:55Z/));

  it.each([
    [
      'evaluator_version',
      (r: any) => (r.results[0].evaluator_version = '9.9.9'),
      /evaluator_version differs/,
    ],
    [
      'status',
      (r: any) =>
        (r.results[0].status =
          r.results[0].status === 'VALID' ? 'CAUTIONARY' : 'VALID'),
      /status differs/,
    ],
    [
      'state_code',
      (r: any) => (r.results[0].state_code = 'MCD0_OTHER'),
      /state_code differs/,
    ],
    ['bias', (r: any) => (r.results[0].bias = 'SHORT'), /bias differs/],
  ])(
    'refuses a row whose %s differs from its envelope',
    (_field, mutate, expected) => refused(mutate, expected)
  );

  it('refuses a result for another slot or symbol than the job’s', async () => {
    await refused(
      (r) => (r.cycle_slot = '2026-09-18T20:50Z'),
      /answered for slot 2026-09-18T20:50Z/
    );
    await refused(
      (r) => (r.symbol = 'EURUSD'),
      /answered for EURUSD, not XAUUSD/
    );
  });

  it('refuses bundle text that does not hash to inputs_sha256', () =>
    refused(
      (r) => (r.bundle_canonical_json = '{"tampered":true}'),
      /bundle_canonical_json does not hash to inputs_sha256/
    ));

  it('lists every problem, not only the first', async () => {
    const { writer } = make();
    const result = JSON.parse(JSON.stringify(unitResult(v1)));
    result.results[0].envelope_sha256 = 'a';
    result.results[1].envelope_sha256 = 'b';
    result.bundle_canonical_json = 'x';
    const problems = writer.problems({ ...write(), result });
    expect(problems).toHaveLength(3);
  });

  it('a slot that is not a slot is a caller bug, thrown, not a refusal', () => {
    const { writer } = make();
    expect(() => writer.problems({ ...write(), slot: v1.slot + 1 })).toThrow(
      RangeError
    );
  });

  it('an untouched stored cycle has no problem (the checks above are not just refusing everything)', () => {
    const { writer } = make();
    for (const fixture of FIXTURE_SLOTS)
      expect(writer.problems(write(fixture))).toEqual([]);
  });
});
