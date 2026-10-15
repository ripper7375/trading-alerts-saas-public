/**
 * @jest-environment node
 */

/**
 * The states of an earlier cycle (build step 7 part 5; architecture 5.11): read from stored rows
 * the way the intake path reads them, believed only when they hash to their stored hash and say
 * what the board accepts, and handed to the diff. Nothing here touches a database: the client is
 * a fake with a log of what it was asked.
 */

import { createHash } from 'crypto';

import { readSnapshotAt } from '@/lib/reply/read/snapshot-at';
import type {
  McdOutputRow,
  SnapshotAtClient,
} from '@/lib/reply/read/snapshot-at';
import { stateChanges, statesOfPacket } from '@/lib/reply/report1/changes';

import { GOLDENS } from '../../intake/helpers/packets';
import { packetOf } from './helpers/report1-fixtures';

const slotSeconds = (iso: string): number =>
  Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
    Number(iso.slice(11, 13)),
    Number(iso.slice(14, 16))
  ) / 1000;

const golden = (prefix: string) => {
  const found = GOLDENS.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden ${prefix}`);
  return found;
};

const rowsOf = (prefix: string): McdOutputRow[] =>
  golden(prefix).sensors.map((s) => ({
    mcd_id: s.mcd_id,
    flag: 'live',
    status: s.status,
    envelope_json: s.envelope_json,
    envelope_sha256: s.envelope_sha256,
  }));

function fakeClient(rows: McdOutputRow[] | Error) {
  const asked: unknown[] = [];
  const client: SnapshotAtClient = {
    mcdOutput: {
      async findMany(args) {
        asked.push(args);
        if (rows instanceof Error) throw rows;
        return rows;
      },
    },
  };
  return { client, asked };
}

describe('the states at a slot', () => {
  it('asks for the live rows of that symbol and slot, in sensor order, and nothing else', async () => {
    const { client, asked } = fakeClient(rowsOf('01'));
    await readSnapshotAt({ slot: golden('01').slot }, client);
    expect(asked).toEqual([
      {
        where: {
          symbol: 'XAUUSD',
          cycle_slot: slotSeconds('2026-09-18T20:55Z'),
          flag: 'live',
        },
        orderBy: { mcd_id: 'asc' },
        select: {
          mcd_id: true,
          flag: true,
          status: true,
          envelope_json: true,
          envelope_sha256: true,
        },
      },
    ]);
  });

  it('names another symbol when asked to', async () => {
    const { client, asked } = fakeClient([]);
    await readSnapshotAt(
      { slot: '2026-09-18T20:55Z', symbol: 'EURUSD' },
      client
    );
    expect((asked[0] as { where: { symbol: string } }).where.symbol).toBe(
      'EURUSD'
    );
  });

  it("reads each board sensor's state code, and leaves the gate out", async () => {
    const { client } = fakeClient(rowsOf('01'));
    const read = await readSnapshotAt({ slot: '2026-09-18T20:55Z' }, client);
    expect(read).toEqual({
      ok: true,
      states: {
        slot: '2026-09-18T20:55Z',
        sensors: [
          { mcd_id: 'MCD1', state_code: 'MCD1_DOWN_UPPER_BREAKOUT' },
          { mcd_id: 'MCD2', state_code: 'MCD2_UP_IN_CORRIDOR' },
          {
            mcd_id: 'MCD3',
            state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
          },
        ],
        unreadable: [],
      },
    });
  });

  it('gives a sensor that is INVALID or STALE no state, and does not call it unreadable', async () => {
    const { client } = fakeClient(rowsOf('15'));
    const read = await readSnapshotAt({ slot: golden('15').slot }, client);
    expect(read.ok).toBe(true);
    if (read.ok) {
      const invalid = golden('15').sensors.filter(
        (s) => s.status === 'INVALID' || s.status === 'STALE'
      );
      expect(invalid.length).toBeGreaterThan(0);
      for (const s of invalid.filter((x) => x.mcd_id !== 'MCD0')) {
        expect(
          read.states.sensors.find((x) => x.mcd_id === s.mcd_id)?.state_code
        ).toBeNull();
      }
      expect(read.states.unreadable).toEqual([]);
    }
  });

  it('reads the same states as the packet of the same cycle shows on its board', async () => {
    for (const g of GOLDENS) {
      const { client } = fakeClient(rowsOf(g.id.slice(0, 2)));
      const read = await readSnapshotAt({ slot: g.slot }, client);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.states.sensors).toEqual(
          statesOfPacket(packetOf(g.id.slice(0, 2))).sensors
        );
      }
    }
  });

  it('turns two stored cycles into the diff the reply opens with', async () => {
    const { client } = fakeClient(rowsOf('01'));
    const earlier = await readSnapshotAt({ slot: '2026-09-18T20:55Z' }, client);
    if (!earlier.ok) throw new Error('unreadable');
    const changes = stateChanges(
      earlier.states,
      statesOfPacket(packetOf('02'))
    );
    expect(changes.map((c) => c.mcd_id)).toContain('MCD2');
    expect(changes.find((c) => c.mcd_id === 'MCD2')?.from).toBe(
      'MCD2_UP_IN_CORRIDOR'
    );
  });
});

describe('a row that is not believed', () => {
  const read = async (rows: McdOutputRow[]) => {
    const { client } = fakeClient(rows);
    return readSnapshotAt({ slot: '2026-09-18T20:55Z' }, client);
  };
  const row = (id: string): McdOutputRow =>
    rowsOf('01').find((r) => r.mcd_id === id) as McdOutputRow;

  it('lists a sensor whose envelope does not hash to its stored hash as unreadable, not as absent', async () => {
    const result = await read([
      row('MCD1'),
      { ...row('MCD2'), envelope_sha256: 'f'.repeat(64) },
    ]);
    expect(result).toMatchObject({
      ok: true,
      states: {
        sensors: [{ mcd_id: 'MCD1', state_code: 'MCD1_DOWN_UPPER_BREAKOUT' }],
        unreadable: ['MCD2'],
      },
    });
  });

  it('lists a sensor whose envelope is not JSON, or not an envelope, as unreadable', async () => {
    const hashed = (text: string): McdOutputRow => ({
      ...row('MCD2'),
      envelope_json: text,
      envelope_sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    });
    for (const text of [
      'not json',
      '[]',
      '{}',
      'null',
      '{"schema_version":"mcd-output/2"}',
    ]) {
      const result = await read([hashed(text)]);
      expect(result).toMatchObject({
        ok: true,
        states: { sensors: [], unreadable: ['MCD2'] },
      });
    }
  });

  it('lists a sensor whose envelope belongs to another cycle or another sensor as unreadable', async () => {
    const other = rowsOf('03').find((r) => r.mcd_id === 'MCD2') as McdOutputRow; // a different slot
    expect(await read([other])).toMatchObject({
      states: { unreadable: ['MCD2'] },
    });
    const swapped = { ...row('MCD1'), mcd_id: 'MCD2' }; // MCD1's envelope under MCD2's id
    expect(await read([swapped])).toMatchObject({
      states: { unreadable: ['MCD2'] },
    });
  });

  it('lists a sensor whose row status disagrees with its envelope as unreadable', async () => {
    const result = await read([{ ...row('MCD2'), status: 'VALID' }]);
    expect(result).toMatchObject({
      states: { sensors: [], unreadable: ['MCD2'] },
    });
  });

  it('never believes a row that is not live, even if the database returns one', async () => {
    const result = await read([
      { ...row('MCD1'), flag: 'shadow' },
      row('MCD2'),
    ]);
    expect(result).toMatchObject({
      states: { sensors: [{ mcd_id: 'MCD2' }], unreadable: [] },
    });
  });

  it('skips a sensor the roster does not know and a gate, which have no line on the board', async () => {
    const result = await read([
      { ...row('MCD1'), mcd_id: 'MCD9' },
      row('MCD0'),
      row('MCD2'),
    ]);
    expect(result).toMatchObject({
      states: { sensors: [{ mcd_id: 'MCD2' }], unreadable: [] },
    });
  });

  it('trusts neither of two rows for one sensor', async () => {
    const result = await read([
      row('MCD1'),
      row('MCD2'),
      row('MCD2'),
      row('MCD3'),
    ]);
    expect(result).toMatchObject({
      states: {
        sensors: [{ mcd_id: 'MCD1' }, { mcd_id: 'MCD3' }],
        unreadable: ['MCD2'],
      },
    });
    // and a third does not list it twice
    const three = await read([row('MCD2'), row('MCD2'), row('MCD2')]);
    expect(three).toMatchObject({
      states: { sensors: [], unreadable: ['MCD2'] },
    });
  });

  it('removes only the doubled sensor, whatever comes before and after it', async () => {
    const result = await read([row('MCD2'), row('MCD3'), row('MCD2')]);
    expect(result).toMatchObject({
      states: { sensors: [{ mcd_id: 'MCD3' }], unreadable: ['MCD2'] },
    });
  });

  it('lists a doubled sensor once when its first row was already unreadable', async () => {
    const result = await read([
      row('MCD1'),
      { ...row('MCD2'), envelope_sha256: 'f'.repeat(64) },
      row('MCD2'),
      row('MCD3'),
    ]);
    expect(result).toMatchObject({
      states: {
        sensors: [{ mcd_id: 'MCD1' }, { mcd_id: 'MCD3' }],
        unreadable: ['MCD2'],
      },
    });
  });

  it('goes on to the sensors after one it could not read', async () => {
    const result = await read([
      { ...row('MCD1'), envelope_sha256: 'f'.repeat(64) },
      row('MCD2'),
      row('MCD3'),
    ]);
    expect(result).toMatchObject({
      states: {
        sensors: [{ mcd_id: 'MCD2' }, { mcd_id: 'MCD3' }],
        unreadable: ['MCD1'],
      },
    });
  });

  it('lists a sensor whose row has no envelope text at all as unreadable', async () => {
    for (const envelope_json of [null, undefined, 7]) {
      const result = await read([
        { ...row('MCD1'), envelope_json: envelope_json as unknown as string },
        row('MCD2'),
      ]);
      expect(result).toMatchObject({
        states: { sensors: [{ mcd_id: 'MCD2' }], unreadable: ['MCD1'] },
      });
    }
  });

  it('is an empty cycle, not an error, when no sensor ran live at that slot', async () => {
    expect(await read([])).toEqual({
      ok: true,
      states: { slot: '2026-09-18T20:55Z', sensors: [], unreadable: [] },
    });
  });
});

describe('what it cannot read', () => {
  it('says so for a slot that is not a slot, without asking the database', async () => {
    for (const slot of [
      '',
      'yesterday',
      '2026-09-18T20:56Z',
      '2026-13-18T20:55Z',
      '2026-09-18T20:55:00Z',
    ]) {
      const { client, asked } = fakeClient([]);
      const result = await readSnapshotAt({ slot }, client);
      expect(result).toMatchObject({ ok: false, code: 'BAD_SLOT' });
      expect(asked).toEqual([]);
    }
  });

  it('says so, with the reason, when the database fails, and throws nothing', async () => {
    const result = await readSnapshotAt(
      { slot: '2026-09-18T20:55Z' },
      fakeClient(new Error('connection refused')).client
    );
    expect(result).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: "the sensors' readings could not be read: connection refused",
    });
    const odd = await readSnapshotAt(
      { slot: '2026-09-18T20:55Z' },
      {
        mcdOutput: { findMany: () => Promise.reject('boom') },
      }
    );
    expect(odd).toMatchObject({ ok: false, code: 'DATABASE_ERROR' });
    expect(odd.ok === false && odd.detail).toContain('unknown error');
  });
});
