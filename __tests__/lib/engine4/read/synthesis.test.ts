/**
 * @jest-environment node
 */

/**
 * The reader of one stored synthesis reading (build step 5, part 6): the rule and
 * the rules version the consent record names, the badge context, and the hashes the
 * reading recorded of its bundle and its sensors. The text of the reading must hash to
 * the hash stored beside it, and a reading that fails that, or is not what it should
 * be, is an answer (`ok: false`), never a guess.
 *
 * The readings below are the REAL ones of the signed-off golden scenarios.
 */

import { createHash } from 'crypto';

import { badgeContextFromReading } from '@/lib/engine4';
import { readSynthesisDetail } from '@/lib/engine4/read/synthesis';
import type {
  SynthesisDetailClient,
  SynthesisDetailRow,
} from '@/lib/engine4/read/synthesis';

import { golden, readingOf } from '../helpers/setup';
import { slotSeconds } from '../helpers/stored';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const sha = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const G = golden('01-');
const R = readingOf(G);
const SLOT = slotSeconds(String(R.reading['cycle_slot']));
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function rowOf(over: Partial<SynthesisDetailRow> = {}): SynthesisDetailRow {
  return {
    rule_id: String(R.reading['rule_id']),
    rules_version: String(R.reading['rules_version']),
    branch_id: (R.reading['branch_id'] as string | null) ?? null,
    flag: 'live',
    reading_json: R.readingJson,
    reading_sha256: sha(R.readingJson),
    inputs_sha256: HASH_A,
    ...over,
  };
}

function client(answer: () => Promise<SynthesisDetailRow | null>) {
  const calls: unknown[] = [];
  const fake: SynthesisDetailClient = {
    synthesisReading: {
      findFirst: async (args) => {
        calls.push(args);
        return answer();
      },
    },
  };
  return { fake, calls };
}

/** A reading whose text and hash agree, with one change made to the parsed document. */
function changed(edit: (reading: any) => void): SynthesisDetailRow {
  const reading = JSON.parse(R.readingJson) as any;
  edit(reading);
  const text = JSON.stringify(reading);
  return rowOf({ reading_json: text, reading_sha256: sha(text) });
}

describe('readSynthesisDetail', () => {
  test('asks for the one reading of the symbol, profile and cycle, and only the columns it uses', async () => {
    const { fake, calls } = client(async () => rowOf());
    await readSynthesisDetail({ profile: 'DAY_TRADER', cycleSlot: SLOT }, fake);
    expect(calls).toEqual([
      {
        where: { symbol: 'XAUUSD', profile: 'DAY_TRADER', cycle_slot: SLOT },
        select: {
          rule_id: true,
          rules_version: true,
          branch_id: true,
          flag: true,
          reading_json: true,
          reading_sha256: true,
          inputs_sha256: true,
        },
      },
    ]);
  });

  test('asks for another symbol when told to', async () => {
    const { fake, calls } = client(async () => null);
    await readSynthesisDetail(
      { profile: 'SCALPER', cycleSlot: SLOT, symbol: 'EURUSD' },
      fake
    );
    expect(calls[0]).toMatchObject({
      where: { symbol: 'EURUSD', profile: 'SCALPER' },
    });
  });

  test('gives the rule, the rules version, the branch and the flag of the 18 Sep reading', async () => {
    const { fake } = client(async () => rowOf());
    const read = await readSynthesisDetail(
      { profile: 'DAY_TRADER', cycleSlot: SLOT },
      fake
    );
    expect(read).toMatchObject({
      ok: true,
      detail: {
        ruleId: 'R1_MACRO_COUNTER_TREND_RALLY',
        rulesVersion: 'draft-1',
        branchId: 'BREACH_UP',
        flag: 'live',
      },
    });
  });

  test('the badge context is the one the reading itself gives', async () => {
    const { fake } = client(async () => rowOf());
    const read = await readSynthesisDetail(
      { profile: 'DAY_TRADER', cycleSlot: SLOT },
      fake
    );
    if (!read.ok) throw new Error('the read failed');
    expect(read.detail.badge).toEqual(badgeContextFromReading(R.reading));
    expect(read.detail.badge).toMatchObject({ trendRelation: 'COUNTER_TREND' });
  });

  test('gives the hash of the bundle as stored, and the hash each sensor`s reading has in the reading', async () => {
    const { fake } = client(async () => rowOf());
    const read = await readSynthesisDetail(
      { profile: 'DAY_TRADER', cycleSlot: SLOT },
      fake
    );
    if (!read.ok) throw new Error('the read failed');
    expect(read.detail.inputsSha256).toBe(HASH_A);
    const inputs = R.reading['inputs'] as Record<
      string,
      { envelope_sha256: string | null }
    >;
    for (const sensor of ['MCD1', 'MCD2', 'MCD3'] as const) {
      expect(read.detail.envelopeSha256[sensor]).toBe(
        inputs[sensor]!.envelope_sha256
      );
      expect(read.detail.envelopeSha256[sensor]).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test('a reading with no bundle hash or no sensor hash records none, which is not an error', async () => {
    const row = changed((reading) => {
      reading['inputs']['MCD2']['envelope_sha256'] = null;
      delete reading['inputs']['MCD3']['envelope_sha256'];
    });
    const { fake } = client(async () => ({ ...row, inputs_sha256: null }));
    const read = await readSynthesisDetail(
      { profile: 'DAY_TRADER', cycleSlot: SLOT },
      fake
    );
    if (!read.ok) throw new Error('the read failed');
    expect(read.detail.inputsSha256).toBeNull();
    expect(read.detail.envelopeSha256.MCD2).toBeNull();
    expect(read.detail.envelopeSha256.MCD3).toBeNull();
    expect(read.detail.envelopeSha256.MCD1).toMatch(/^[0-9a-f]{64}$/);
  });

  test('a reading with no direction has no badge context', async () => {
    const row = changed((reading) => {
      reading['bias'] = 'STAND_ASIDE';
      reading['trend_relation'] = null;
    });
    const { fake } = client(async () => row);
    const read = await readSynthesisDetail(
      { profile: 'DAY_TRADER', cycleSlot: SLOT },
      fake
    );
    expect(read).toMatchObject({ ok: true, detail: { badge: null } });
  });

  test('no row is NOT_FOUND', async () => {
    const { fake } = client(async () => null);
    expect(
      await readSynthesisDetail(
        { profile: 'DAY_TRADER', cycleSlot: SLOT },
        fake
      )
    ).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      detail: `there is no synthesis reading for cycle ${SLOT}`,
    });
  });

  test('a reading that does not hash to its stored hash is TAMPERED, and its text is not used', async () => {
    const { fake } = client(async () =>
      rowOf({ reading_json: R.readingJson.replace('LONG', 'SHORT') })
    );
    expect(
      await readSynthesisDetail(
        { profile: 'DAY_TRADER', cycleSlot: SLOT },
        fake
      )
    ).toMatchObject({ ok: false, code: 'READING_TAMPERED' });
  });

  test('a stored hash in capitals, or empty, is not the hash', async () => {
    for (const reading_sha256 of [sha(R.readingJson).toUpperCase(), '']) {
      const { fake } = client(async () => rowOf({ reading_sha256 }));
      expect(
        await readSynthesisDetail(
          { profile: 'DAY_TRADER', cycleSlot: SLOT },
          fake
        )
      ).toMatchObject({ ok: false, code: 'READING_TAMPERED' });
    }
  });

  test('text that hashes right but is not JSON, or not an object, is UNREADABLE', async () => {
    for (const text of ['not json', '[]', '"x"', 'null', '5']) {
      const { fake } = client(async () =>
        rowOf({ reading_json: text, reading_sha256: sha(text) })
      );
      expect(
        await readSynthesisDetail(
          { profile: 'DAY_TRADER', cycleSlot: SLOT },
          fake
        )
      ).toMatchObject({ ok: false, code: 'READING_UNREADABLE' });
    }
  });

  test('a recorded hash that is not a SHA-256 is UNREADABLE', async () => {
    for (const bad of ['xyz', 'A'.repeat(64), 5, 'a'.repeat(63)]) {
      const row = changed((reading) => {
        reading['inputs']['MCD1']['envelope_sha256'] = bad;
      });
      const { fake } = client(async () => row);
      expect(
        await readSynthesisDetail(
          { profile: 'DAY_TRADER', cycleSlot: SLOT },
          fake
        )
      ).toMatchObject({ ok: false, code: 'READING_UNREADABLE' });
    }
    for (const bad of ['xyz', HASH_B.toUpperCase(), '']) {
      const { fake } = client(async () => rowOf({ inputs_sha256: bad }));
      expect(
        await readSynthesisDetail(
          { profile: 'DAY_TRADER', cycleSlot: SLOT },
          fake
        )
      ).toMatchObject({ ok: false, code: 'READING_UNREADABLE' });
    }
  });

  test('a database error is an answer, not a throw', async () => {
    const { fake } = client(async () => {
      throw new Error('connection reset');
    });
    expect(
      await readSynthesisDetail(
        { profile: 'DAY_TRADER', cycleSlot: SLOT },
        fake
      )
    ).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the synthesis reading could not be read: connection reset',
    });
  });

  test('a thrown value that is not an Error is still an answer', async () => {
    const { fake } = client(async () => {
      throw 'boom';
    });
    expect(
      await readSynthesisDetail(
        { profile: 'DAY_TRADER', cycleSlot: SLOT },
        fake
      )
    ).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the synthesis reading could not be read: unknown error',
    });
  });

  test('a cycle that is not a whole number of seconds names the field', async () => {
    const { fake } = client(async () => rowOf());
    await expect(
      readSynthesisDetail({ profile: 'DAY_TRADER', cycleSlot: 1.5 }, fake)
    ).rejects.toThrow('cycleSlot must be a whole number of seconds');
  });

  test('a clock-like cycle that is not a whole number of seconds is refused before the database is asked', async () => {
    const { fake, calls } = client(async () => rowOf());
    for (const cycleSlot of [0, -300, 1.5]) {
      await expect(
        readSynthesisDetail({ profile: 'DAY_TRADER', cycleSlot }, fake)
      ).rejects.toThrow();
    }
    expect(calls).toEqual([]);
  });
});
