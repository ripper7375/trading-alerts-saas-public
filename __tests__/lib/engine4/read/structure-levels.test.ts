/**
 * @jest-environment node
 */

import { gzipSync } from 'zlib';

import { Engine4InputError } from '@/lib/engine4';
import {
  BUNDLE_RETENTION_SECONDS,
  readStructureLevels,
} from '@/lib/engine4/read/structure-levels';
import type { McdOutputRow } from '@/lib/engine4/read/structure-levels';

import {
  bundleRow,
  fakeClient,
  fakeRowsFor,
  loadGoldens,
  sha256Hex,
  type FakeCycle,
} from '../helpers/stored';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const SEP_18 = '2026-09-18T2055Z';
const stored = fakeRowsFor(SEP_18);
const NOW = stored.slot + 600;
const RETENTION = Number(BUNDLE_RETENTION_SECONDS);

const base = (): FakeCycle => ({
  slot: stored.slot,
  mcdRows: stored.mcdRows.map((row) => ({ ...row })),
  cycleRow: { ...stored.cycleRow },
});

const request = (over: Record<string, unknown> = {}) => ({
  cycleSlot: stored.slot,
  nowSeconds: NOW,
  ...over,
});

const codes = (result: { problems: { code: string }[] }): string[] =>
  result.problems.map((p) => p.code);

/** An envelope as a sensor stores one, whatever else is in it. */
function envelopeRow(
  mcdId: string,
  body: Record<string, unknown>,
  inputsSha: string | null
): McdOutputRow {
  const envelope_json = JSON.stringify({ mcd_id: mcdId, ...body });
  return {
    mcd_id: mcdId,
    status: String(body['status']),
    envelope_json,
    envelope_sha256: sha256Hex(envelope_json),
    inputs_sha256: inputsSha,
  };
}

describe('the stored 18 Sep cycle', () => {
  test('is read whole: the six channel levels and the five support and resistance levels', async () => {
    const { client } = fakeClient(base());
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(true);
    expect(result.problems).toEqual([]);
    const text = result.levels.map(
      (l) => `${l.origin} ${l.tf} ${l.name} ${l.price.toString()}`
    );
    expect(text).toEqual([
      'MCD1 M15 UOEDT 4279.46',
      'MCD1 M15 baseline 4214.17',
      'MCD1 M15 LOEDT 4126.24',
      'MCD2 M5 UOEDT 4384.23',
      'MCD2 M5 baseline 4367.2',
      'MCD2 M5 LOEDT 4350.16',
      'sr_levels M15 sr_1 4369.57',
      'sr_levels M15 sr_2 4350.92',
      'sr_levels M15 sr_3 4334.56',
      'sr_levels M15 sr_5 4386.2',
      'sr_levels M15 sr_6 4398.29',
    ]);
  });

  test('the three sensors are reported, all usable (CAUTIONARY counts)', async () => {
    const { client } = fakeClient(base());
    const result = await readStructureLevels(request(), client);
    expect(result.sensors.map((s) => [s.mcdId, s.status, s.available])).toEqual(
      [
        ['MCD1', 'CAUTIONARY', true],
        ['MCD2', 'CAUTIONARY', true],
        ['MCD3', 'CAUTIONARY', true],
      ]
    );
    expect(result.inputsSha256).toBe(stored.cycleRow.inputs_sha256);
  });

  test("it asks for the cycle's three sensors only, of XAUUSD, and for no more columns than it uses", async () => {
    const { client, calls } = fakeClient(base());
    await readStructureLevels(request(), client);
    expect(calls.mcdWhere).toEqual([
      {
        symbol: 'XAUUSD',
        cycle_slot: stored.slot,
        mcd_id: { in: ['MCD1', 'MCD2', 'MCD3'] },
      },
    ]);
    expect(calls.bundleWhere).toEqual([
      { symbol: 'XAUUSD', cycle_slot: stored.slot },
    ]);
  });

  test('it asks only for the columns it checks and reads, all of them', async () => {
    const { client, calls } = fakeClient(base());
    await readStructureLevels(request(), client);
    expect(calls.mcdSelect).toEqual([
      {
        mcd_id: true,
        status: true,
        envelope_json: true,
        envelope_sha256: true,
        inputs_sha256: true,
      },
    ]);
    expect(calls.bundleSelect).toEqual([
      {
        bundle_gz: true,
        bundle_encoding: true,
        bundle_bytes: true,
        inputs_sha256: true,
      },
    ]);
  });

  test('another symbol is asked for by name', async () => {
    const { client, calls } = fakeClient(base());
    const result = await readStructureLevels(
      request({ symbol: 'EURUSD' }),
      client
    );
    expect(calls.mcdWhere[0]).toMatchObject({ symbol: 'EURUSD' });
    // the fake holds rows for the slot whatever the symbol: the point is the query
    expect(result.complete).toBe(true);
  });

  test('the hashes the synthesis reading recorded are accepted when they match', async () => {
    const golden = loadGoldens().find((g) => g.id.startsWith('01-'));
    const reading = golden?.readings[0]?.reading as {
      inputs: Record<string, { envelope_sha256: string | null }>;
    };
    const { client } = fakeClient(base());
    const result = await readStructureLevels(
      request({
        expectedInputsSha256: stored.cycleRow.inputs_sha256,
        expectedEnvelopeSha256: {
          MCD1: reading.inputs['MCD1']?.envelope_sha256,
          MCD2: reading.inputs['MCD2']?.envelope_sha256,
          MCD3: reading.inputs['MCD3']?.envelope_sha256,
        },
      }),
      client
    );
    expect(result.problems).toEqual([]);
    expect(result.complete).toBe(true);
  });

  test("the stored reading hashes are the worker's own: each envelope text hashes to its stored hash", () => {
    for (const row of stored.mcdRows) {
      expect(sha256Hex(row.envelope_json)).toBe(row.envelope_sha256);
    }
  });
});

describe('a sensor that cannot give levels', () => {
  const bundle = stored.cycleRow;
  const inputs = bundle.inputs_sha256;

  test('an INVALID or STALE sensor gives none, and is not a problem', async () => {
    const cycle: FakeCycle = {
      slot: stored.slot,
      cycleRow: bundle,
      mcdRows: [
        envelopeRow(
          'MCD1',
          {
            status: 'INVALID',
            state_code: null,
            bias: null,
            levels: [{ name: 'UOEDT', tf: 'M15', price: 4279.46 }],
          },
          inputs
        ),
        envelopeRow(
          'MCD2',
          {
            status: 'VALID',
            state_code: 'MCD2_UP_IN_CORRIDOR',
            regime_status: null,
            bias: 'LONG',
            levels: [{ name: 'LOEDT', tf: 'M5', price: 4350.16 }],
          },
          inputs
        ),
        envelopeRow(
          'MCD3',
          { status: 'STALE', state_code: null, bias: null, levels: [] },
          inputs
        ),
      ],
    };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(true);
    expect(result.sensors.map((s) => [s.mcdId, s.available])).toEqual([
      ['MCD1', false],
      ['MCD2', true],
      ['MCD3', false],
    ]);
    // MCD1's level is not offered; the support and resistance levels of the bundle still are
    const names = result.levels.map((l) => `${l.origin}:${l.name}`);
    expect(names).not.toContain('MCD1:UOEDT');
    expect(names).toContain('MCD2:LOEDT');
    expect(names).toContain('sr_levels:sr_1');
  });

  test('a sensor that was never running (no row, none expected) is not a problem either', async () => {
    const cycle = base();
    cycle.mcdRows = cycle.mcdRows.filter((row) => row.mcd_id !== 'MCD3');
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(true);
    expect(result.sensors.map((s) => s.mcdId)).toEqual(['MCD1', 'MCD2']);
  });

  test('but one the synthesis reading used and that has no row is', async () => {
    const cycle = base();
    cycle.mcdRows = cycle.mcdRows.filter((row) => row.mcd_id !== 'MCD3');
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(
      request({ expectedEnvelopeSha256: { MCD3: 'a'.repeat(64) } }),
      client
    );
    expect(result.complete).toBe(false);
    expect(result.problems).toEqual([
      expect.objectContaining({
        code: 'SENSOR_READING_MISSING',
        mcdId: 'MCD3',
      }),
    ]);
  });
});

describe('a reading that cannot be trusted degrades the whole read', () => {
  test('a reading whose text does not hash to its hash is tampered', async () => {
    const cycle = base();
    const row = cycle.mcdRows.find((r) => r.mcd_id === 'MCD2');
    if (row === undefined) throw new Error('no MCD2');
    row.envelope_json = row.envelope_json.replace('4350.16', '4350.17');
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(result.levels).toEqual([]);
    expect(result.problems).toEqual([
      expect.objectContaining({
        code: 'SENSOR_READING_TAMPERED',
        mcdId: 'MCD2',
      }),
    ]);
  });

  test('never partial: the readable sensors give no level either', async () => {
    const cycle = base();
    const row = cycle.mcdRows.find((r) => r.mcd_id === 'MCD3');
    if (row === undefined) throw new Error('no MCD3');
    row.envelope_sha256 = 'f'.repeat(64);
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.levels).toEqual([]);
    expect(codes(result)).toEqual(['SENSOR_READING_TAMPERED']);
    // and the sensor that failed is not reported as one that gave levels
    expect(result.sensors.map((x) => [x.mcdId, x.available])).toEqual([
      ['MCD1', true],
      ['MCD2', true],
      ['MCD3', false],
    ]);
  });

  test('a reading that is not the one the synthesis reading names is a mismatch', async () => {
    const { client } = fakeClient(base());
    const result = await readStructureLevels(
      request({ expectedEnvelopeSha256: { MCD1: 'b'.repeat(64) } }),
      client
    );
    expect(result.complete).toBe(false);
    expect(result.problems).toEqual([
      expect.objectContaining({
        code: 'SENSOR_READING_MISMATCH',
        mcdId: 'MCD1',
      }),
    ]);
  });

  test('a reading that is not JSON, or not an object, is unreadable', async () => {
    for (const text of ['not json', '[1,2]', '"x"']) {
      const cycle = base();
      cycle.mcdRows = [
        {
          ...cycle.mcdRows[2],
          mcd_id: 'MCD1',
          envelope_json: text,
          envelope_sha256: sha256Hex(text),
        } as McdOutputRow,
      ];
      const { client } = fakeClient(cycle);
      const result = await readStructureLevels(request(), client);
      expect(codes(result)).toEqual(['SENSOR_READING_UNREADABLE']);
      expect(result.complete).toBe(false);
    }
  });

  test('no reading at all for the cycle', async () => {
    const cycle = base();
    cycle.mcdRows = [];
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(codes(result)).toEqual(['NO_SENSOR_READINGS']);
    expect(result.levels).toEqual([]);
  });

  test('a row of a sensor that is not MCD1 to MCD3 is ignored', async () => {
    const cycle = base();
    // the fake answers whatever it is asked; make it return MCD0 as well
    const { client } = fakeClient(cycle);
    const wide: typeof client = {
      ...client,
      mcdOutput: {
        findMany: async (args) => [
          ...(await client.mcdOutput.findMany(args)),
          ...stored.mcdRows.filter((row) => row.mcd_id === 'MCD0'),
        ],
      },
    };
    const result = await readStructureLevels(request(), wide);
    expect(result.complete).toBe(true);
    expect(result.sensors.map((s) => s.mcdId)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
  });
});

describe('a bundle that is missing, expired or tampered degrades the whole read', () => {
  test('missing: no bundle row for a recent cycle', async () => {
    const cycle = base();
    cycle.cycleRow = null;
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(result.levels).toEqual([]);
    expect(codes(result)).toEqual(['BUNDLE_MISSING']);
    expect(result.inputsSha256).toBeNull();
  });

  test('expired: no row for a cycle older than the 90 days a bundle is kept', async () => {
    const cycle = base();
    cycle.cycleRow = null;
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(
      request({ nowSeconds: stored.slot + RETENTION + 1 }),
      client
    );
    expect(codes(result)).toEqual(['BUNDLE_EXPIRED']);
    expect(result.problems[0]?.detail).toBe(
      'the cycle is older than the 90 days a bundle is kept'
    );
  });

  test('exactly 90 days old is still within the retention', async () => {
    const cycle = base();
    cycle.cycleRow = null;
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(
      request({ nowSeconds: stored.slot + RETENTION }),
      client
    );
    expect(codes(result)).toEqual(['BUNDLE_MISSING']);
    expect(result.problems[0]?.detail).toBe(
      'no bundle is stored for this cycle'
    );
  });

  test('the retention is 90 days of seconds', () => {
    expect(BUNDLE_RETENTION_SECONDS).toBe(7_776_000n);
    expect(RETENTION).toBe(90 * 24 * 3600);
  });

  test('an old cycle whose bundle is still stored is used', async () => {
    const { client } = fakeClient(base());
    const result = await readStructureLevels(
      request({ nowSeconds: stored.slot + RETENTION + 86_400 }),
      client
    );
    expect(result.complete).toBe(true);
  });

  test('tampered: the decompressed text no longer hashes to its hash', async () => {
    const cycle = base();
    const changed = stored.bundleText.replace('4369.57', '4369.58');
    expect(changed).not.toBe(stored.bundleText);
    const bytes = Buffer.from(changed, 'utf8');
    cycle.cycleRow = {
      bundle_gz: gzipSync(bytes),
      bundle_encoding: 'gzip',
      bundle_bytes: bytes.length,
      inputs_sha256: stored.cycleRow.inputs_sha256,
    };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(result.levels).toEqual([]);
    expect(codes(result)).toEqual(['BUNDLE_TAMPERED']);
  });

  test('the length stored with it is wrong', async () => {
    const cycle = base();
    if (cycle.cycleRow === null) throw new Error('no bundle');
    cycle.cycleRow = {
      ...cycle.cycleRow,
      bundle_bytes: cycle.cycleRow.bundle_bytes + 1,
    };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['BUNDLE_SIZE_MISMATCH']);
  });

  test('an encoding other than gzip', async () => {
    const cycle = base();
    if (cycle.cycleRow === null) throw new Error('no bundle');
    cycle.cycleRow = { ...cycle.cycleRow, bundle_encoding: 'zstd' };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['BUNDLE_ENCODING']);
  });

  test('bytes that are not gzip', async () => {
    const cycle = base();
    if (cycle.cycleRow === null) throw new Error('no bundle');
    cycle.cycleRow = {
      ...cycle.cycleRow,
      bundle_gz: Buffer.from('not gzip at all'),
    };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['BUNDLE_UNREADABLE']);
  });

  test('a bundle that is not JSON, or not an object', async () => {
    for (const text of ['not json', '[1,2,3]', '"x"', 'null']) {
      const cycle = base();
      cycle.cycleRow = bundleRow(text);
      cycle.mcdRows = cycle.mcdRows.map((row) => ({
        ...row,
        inputs_sha256: sha256Hex(text),
      }));
      const { client } = fakeClient(cycle);
      const result = await readStructureLevels(request(), client);
      expect(codes(result)).toEqual(['BUNDLE_UNREADABLE']);
      expect(result.complete).toBe(false);
    }
  });

  test('a bundle that unpacks to far too much is refused, not expanded', async () => {
    const cycle = base();
    const huge = Buffer.alloc(70_000_000, 0x20);
    cycle.cycleRow = {
      bundle_gz: gzipSync(huge),
      bundle_encoding: 'gzip',
      bundle_bytes: huge.length,
      inputs_sha256: sha256Hex(huge),
    };
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['BUNDLE_UNREADABLE']);
  });

  test('a bundle with no context_levels gives the channel levels only', async () => {
    const cycle = base();
    cycle.cycleRow = bundleRow(JSON.stringify({ symbol: 'XAUUSD', bars: [] }));
    cycle.mcdRows = cycle.mcdRows.map((row) => ({
      ...row,
      inputs_sha256: cycle.cycleRow?.inputs_sha256 ?? null,
    }));
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(true);
    expect(result.levels).toHaveLength(6);
    expect(result.levels.every((l) => l.origin.startsWith('MCD'))).toBe(true);
  });
});

describe('the rows must belong to one another', () => {
  test('the bundle is not the one the synthesis reading was made from', async () => {
    const { client } = fakeClient(base());
    const result = await readStructureLevels(
      request({ expectedInputsSha256: 'c'.repeat(64) }),
      client
    );
    expect(result.complete).toBe(false);
    expect(codes(result)).toEqual(['INPUTS_MISMATCH']);
  });

  test('a sensor reading made from another bundle than the one stored', async () => {
    const cycle = base();
    const row = cycle.mcdRows.find((r) => r.mcd_id === 'MCD1');
    if (row === undefined) throw new Error('no MCD1');
    row.inputs_sha256 = 'd'.repeat(64);
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(codes(result)).toEqual(['INPUTS_MISMATCH']);
    expect(result.levels).toEqual([]);
  });

  test('a reading with no inputs hash (NULL in the table) is not held against it', async () => {
    const cycle = base();
    cycle.mcdRows = cycle.mcdRows.map((row) => ({
      ...row,
      inputs_sha256: null,
    }));
    const { client } = fakeClient(cycle);
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(true);
  });
});

describe('a database that fails is reported, never thrown', () => {
  test('the readings cannot be read', async () => {
    const { client } = fakeClient(base(), { failMcd: true });
    const result = await readStructureLevels(request(), client);
    expect(result.complete).toBe(false);
    expect(result.levels).toEqual([]);
    expect(codes(result)).toEqual(['DATABASE_ERROR']);
    expect(result.problems[0]?.detail).toMatch(/connection refused/);
  });

  test('the bundle cannot be read', async () => {
    const { client } = fakeClient(base(), { failBundle: true });
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['DATABASE_ERROR']);
  });

  test('both: two reasons, and the failed bundle is not also called missing', async () => {
    const { client } = fakeClient(base(), { failMcd: true, failBundle: true });
    const result = await readStructureLevels(request(), client);
    expect(codes(result)).toEqual(['DATABASE_ERROR', 'DATABASE_ERROR']);
    expect(result.sensors).toEqual([]);
  });

  test('an error that is not an Error is still reported', async () => {
    const { client } = fakeClient(base());
    const odd: typeof client = {
      ...client,
      mcdOutput: {
        findMany: async () => {
          throw 'plain text';
        },
      },
    };
    const result = await readStructureLevels(request(), odd);
    expect(result.problems[0]).toMatchObject({
      code: 'DATABASE_ERROR',
      detail: expect.stringContaining('unknown error'),
    });
  });
});

describe('a request that is not a cycle', () => {
  test.each([
    [{ cycleSlot: 0 }],
    [{ cycleSlot: -300 }],
    [{ cycleSlot: 1.5 }],
    [{ cycleSlot: Number.NaN }],
    [{ nowSeconds: 0 }],
    [{ nowSeconds: 1.5 }],
  ])('%j is refused', async (over) => {
    const { client } = fakeClient(base());
    await expect(readStructureLevels(request(over), client)).rejects.toThrow(
      Engine4InputError
    );
  });
});
