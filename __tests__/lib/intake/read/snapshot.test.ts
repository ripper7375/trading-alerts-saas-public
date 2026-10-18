/**
 * @jest-environment node
 */

/**
 * The snapshot reader (`lib/intake/read/snapshot.ts`, architecture 4.2 step 4): the cycle,
 * its live status, the sensors' LIVE readings and the trader's synthesis reading with its
 * zones. Every query goes to a fake client made from the stored worlds (the 16 golden
 * scenarios and the three stored cycles), which answers the way the database would; the
 * same queries against a real PostgreSQL are in `__tests__/intake/intake-readers.pg.spec.ts`.
 *
 * The reader never throws and never believes a row it cannot check: a row whose envelope
 * does not hash to its stored hash, or says something the packet would refuse, is a
 * PROBLEM and the sensor is listed as unavailable.
 */

import { createHash } from 'crypto';

import { SENSOR_ROSTER } from '@/lib/intake';
import {
  readSnapshot,
  type SnapshotProblemCode,
} from '@/lib/intake/read/snapshot';

import { clone } from '../helpers/packets';
import {
  depsFor,
  goldenWorlds,
  rosterWith,
  storedWorlds,
  zoneRowsOf,
  type World,
} from '../helpers/world';

const WORLDS = [...goldenWorlds(), ...storedWorlds()];
const TRADERS = ['DAY_TRADER', 'SCALPER'] as const;
const GATE = new Set(
  SENSOR_ROSTER.sensors.filter((s) => !s.on_board).map((s) => s.mcd_id)
);

const world = (prefix: string): World => {
  const found = WORLDS.find((w) => w.name.startsWith(prefix));
  if (found === undefined) throw new Error(`no world ${prefix}`);
  return found;
};
const sha = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');
const codes = (
  problems: { code: SnapshotProblemCode }[]
): SnapshotProblemCode[] => problems.map((p) => p.code);

describe('every stored world is read whole and without a problem', () => {
  const cases = WORLDS.flatMap((w) =>
    TRADERS.map((t) => [`${w.name} ${t}`, w, t] as const)
  );

  it.each(cases)('%s', async (_name, w, traderType) => {
    const { deps } = depsFor(w);
    const snapshot = await readSnapshot({ traderType }, deps);
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.data.status).toBe('FRESH');
    expect(snapshot.data.cycle_slot).toBe(w.slotIso);
    expect(snapshot.data.slot_seconds).toBe(w.slot);

    // every sensor on the board has its live row, byte for byte what the worker stored
    const onBoard = w.sensors.filter((s) => !GATE.has(s.mcd_id));
    expect(snapshot.live_ids).toEqual(onBoard.map((s) => s.mcd_id));
    expect(Object.keys(snapshot.rows)).toEqual(snapshot.live_ids);
    for (const stored of onBoard) {
      const row = snapshot.rows[stored.mcd_id]!;
      expect(row.envelope_sha256).toBe(stored.envelope_sha256);
      expect(row.envelope).toEqual(JSON.parse(stored.envelope_json));
      expect(sha(stored.envelope_json)).toBe(stored.envelope_sha256);
      expect(row.facts.status).toBe(stored.status);
    }

    // and the trader's synthesis reading, with the zones the worker stored
    const stored = w.synthesis.find((s) => s.profile === traderType)!;
    const synthesis = snapshot.synthesis!;
    expect(synthesis.profile).toBe(traderType);
    expect(synthesis.reading_sha256).toBe(stored.reading_sha256);
    expect(synthesis.reading).toEqual(JSON.parse(stored.reading_json));
    expect(synthesis.zones_sha256).toBe(stored.zones_sha256);
    expect(synthesis.zones).toEqual(JSON.parse(stored.zones_json));
    expect(synthesis.zones_reason).toBe(stored.zones_reason);
    expect(snapshot.data.last_price?.price).toBe(stored.reference_price);
  });

  it('knows the real hashes of the worker: each stored hash is the SHA-256 of its stored text', () => {
    for (const w of WORLDS) {
      for (const sensor of w.sensors)
        expect(sha(sensor.envelope_json)).toBe(sensor.envelope_sha256);
      for (const row of w.synthesis) {
        expect(sha(row.reading_json)).toBe(row.reading_sha256);
        expect(sha(row.zones_json)).toBe(row.zones_sha256);
      }
    }
  });
});

describe('what is asked of the database', () => {
  it('asks for the live rows of the cycle, one query per table, by the unique keys', async () => {
    const w = world('01-');
    const { deps, calls } = depsFor(w);
    await readSnapshot({ traderType: 'SCALPER' }, deps);
    expect(calls.mcd).toEqual([
      {
        where: { symbol: 'XAUUSD', cycle_slot: w.slot, flag: 'live' },
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
    expect(calls.synthesis).toEqual([
      {
        where: {
          symbol: 'XAUUSD',
          cycle_slot: w.slot,
          profile: 'SCALPER',
          flag: 'live',
        },
        select: {
          flag: true,
          reading_json: true,
          reading_sha256: true,
          zone_count: true,
          zones_reason: true,
          zones_json: true,
          zones_sha256: true,
          reference_price: true,
        },
      },
    ]);
    expect(calls.zones).toEqual([
      {
        where: { symbol: 'XAUUSD', profile: 'SCALPER', cycle_slot: w.slot },
        orderBy: { rank: 'asc' },
        select: {
          zone_id: true,
          rank: true,
          bias: true,
          low: true,
          high: true,
          reference_price: true,
        },
      },
    ]);
    // the gateway answered, so the newest-cycle fallback was not used
    expect(calls.cycle).toEqual([]);
  });

  it('asks for no zones when there is no synthesis row, and for nothing when there is no cycle', async () => {
    const none = depsFor(world('01-'), { synthesis: () => [] });
    await readSnapshot({ traderType: 'DAY_TRADER' }, none.deps);
    expect(none.calls.zones).toEqual([]);
    const noCycle = depsFor(world('01-'), { noCycle: true });
    await readSnapshot({ traderType: 'DAY_TRADER' }, noCycle.deps);
    expect(noCycle.calls.mcd).toEqual([]);
    expect(noCycle.calls.synthesis).toEqual([]);
  });

  it('uses the symbol it is given', async () => {
    const { deps, calls } = depsFor(world('01-'));
    await readSnapshot({ traderType: 'DAY_TRADER', symbol: 'XAUUSD' }, deps);
    expect((calls.mcd[0] as { where: { symbol: string } }).where.symbol).toBe(
      'XAUUSD'
    );
  });
});

describe('the cycle and its status', () => {
  it.each(['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'] as const)(
    'carries the gateway’s %s',
    async (gateway) => {
      const { deps } = depsFor(world('04-'), { gateway });
      const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
      expect(snapshot.data.status).toBe(gateway);
      expect(snapshot.data.flags).toEqual([]);
      expect(snapshot.problems).toEqual([]);
    }
  );

  it('carries the retuning mark', async () => {
    const { deps } = depsFor(world('04-'), { retuning: true });
    expect(
      (await readSnapshot({ traderType: 'DAY_TRADER' }, deps)).data.retuning
    ).toBe(true);
  });

  it('says UNKNOWN when the gateway cannot be asked, and takes the slot from the newest ready cycle', async () => {
    const w = world('04-');
    const { deps, calls } = depsFor(w, { gateway: 'THROWS' });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.data.status).toBe('UNKNOWN');
    expect(snapshot.data.flags).toEqual(['GATEWAY_UNREACHABLE']);
    expect(snapshot.data.retuning).toBe(false);
    expect(snapshot.data.cycle_slot).toBe(w.slotIso);
    expect(snapshot.problems).toEqual([
      {
        code: 'GATEWAY_UNREACHABLE',
        detail: 'UNREACHABLE: the gateway could not be reached',
      },
    ]);
    expect(calls.cycle).toEqual([
      {
        where: { symbol: 'XAUUSD', state: 'READY' },
        orderBy: { slot: 'desc' },
        select: { slot: true },
      },
    ]);
    // the board and the readings are there; only the status is not known
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('has no slot when the gateway is down and the database has no ready cycle', async () => {
    const { deps, calls } = depsFor(world('04-'), {
      gateway: 'THROWS',
      newestReady: null,
    });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.data).toMatchObject({
      status: 'UNKNOWN',
      cycle_slot: null,
      slot_seconds: null,
    });
    expect(snapshot.rows).toEqual({});
    expect(calls.mcd).toEqual([]);
  });

  it('reports a database that fails while the gateway is down', async () => {
    const { deps } = depsFor(world('04-'), {
      gateway: 'THROWS',
      failCycle: true,
    });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(codes(snapshot.problems)).toEqual([
      'GATEWAY_UNREACHABLE',
      'DATABASE_ERROR',
    ]);
    expect(snapshot.data.cycle_slot).toBeNull();
  });

  it('refuses a slot that is not a cycle slot, from the gateway and from the database', async () => {
    const base = depsFor(world('04-'));
    const bad = {
      ...base.deps,
      fetchCurrentCycle: async () => {
        const body = await base.deps.fetchCurrentCycle();
        return {
          ...body,
          cycle: { ...body.cycle!, slot: body.cycle!.slot + 7 },
        };
      },
    };
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, bad);
    expect(codes(snapshot.problems)).toEqual(['BAD_SLOT']);
    expect(snapshot.data.cycle_slot).toBeNull();
    const down = depsFor(world('04-'), {
      gateway: 'THROWS',
      newestReady: world('04-').slot + 1,
    });
    expect(
      codes(
        (await readSnapshot({ traderType: 'DAY_TRADER' }, down.deps)).problems
      )
    ).toEqual(['GATEWAY_UNREACHABLE', 'BAD_SLOT']);
  });

  it('says there is no cycle when the gateway has none, and lists the sensors that should be live as absent', async () => {
    const live = rosterWith({ MCD1: 'live', MCD2: 'live' });
    const { deps } = depsFor(world('04-'), { noCycle: true });
    const snapshot = await readSnapshot(
      { traderType: 'DAY_TRADER', roster: live },
      deps
    );
    expect(codes(snapshot.problems)).toEqual(['NO_CYCLE']);
    expect(snapshot.data.cycle_slot).toBeNull();
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2']);
    expect(snapshot.rows).toEqual({});
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.data.flags).toEqual([]);
  });

  it('flags SENSORS_NOT_LIVE when nothing is live, and not otherwise', async () => {
    const none = depsFor(world('04-'), { mcd: () => [] });
    expect(
      (await readSnapshot({ traderType: 'DAY_TRADER' }, none.deps)).data.flags
    ).toEqual(['SENSORS_NOT_LIVE']);
    const both = depsFor(world('04-'), { mcd: () => [], gateway: 'THROWS' });
    expect(
      (await readSnapshot({ traderType: 'DAY_TRADER' }, both.deps)).data.flags
    ).toEqual(['GATEWAY_UNREACHABLE', 'SENSORS_NOT_LIVE']);
    const some = depsFor(world('04-'));
    expect(
      (await readSnapshot({ traderType: 'DAY_TRADER' }, some.deps)).data.flags
    ).toEqual([]);
  });
});

describe('a database that fails', () => {
  it('turns a failed sensor query into a problem, and still reads the synthesis', async () => {
    const { deps } = depsFor(world('04-'), { failMcd: true });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(codes(snapshot.problems)).toEqual([
      'DATABASE_ERROR',
      'SYNTHESIS_WITHOUT_SENSORS',
    ]);
    expect(snapshot.rows).toEqual({});
    // no sensor could be read, so the synthesis that read them is not shown (D7)
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.data.flags).toEqual(['SENSORS_NOT_LIVE']);
  });

  it('keeps the configured-live sensors on the board as absent when their rows cannot be read', async () => {
    const live = rosterWith({ MCD1: 'live', MCD2: 'live', MCD3: 'live' });
    const { deps } = depsFor(world('04-'), { failMcd: true });
    const snapshot = await readSnapshot(
      { traderType: 'DAY_TRADER', roster: live },
      deps
    );
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(snapshot.rows).toEqual({});
    expect(snapshot.data.flags).toEqual([]);
  });

  it('turns a failed synthesis query into a problem', async () => {
    const { deps } = depsFor(world('04-'), { failSynthesis: true });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(codes(snapshot.problems)).toEqual(['DATABASE_ERROR']);
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('turns a failed zones query into a problem and does not use the reading', async () => {
    const { deps } = depsFor(world('04-'), { failZones: true });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(codes(snapshot.problems)).toEqual(['DATABASE_ERROR']);
    expect(snapshot.synthesis).toBeNull();
  });

  it('never throws, whatever fails', async () => {
    const { deps } = depsFor(world('04-'), {
      gateway: 'THROWS',
      failCycle: true,
      failMcd: true,
      failSynthesis: true,
      failZones: true,
    });
    await expect(
      readSnapshot({ traderType: 'SCALPER' }, deps)
    ).resolves.toMatchObject({
      data: { status: 'UNKNOWN', cycle_slot: null },
    });
  });
});

describe('a sensor row that cannot be believed is listed as absent, with a problem', () => {
  const run = async (change: (rows: any[]) => any[], prefix = '04-') => {
    const { deps } = depsFor(world(prefix), { mcd: change });
    return readSnapshot({ traderType: 'DAY_TRADER' }, deps);
  };

  it('does not hash to the stored hash', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) =>
        r.mcd_id === 'MCD2'
          ? { ...r, envelope_sha256: sha('something else') }
          : r
      )
    );
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(Object.keys(snapshot.rows)).toEqual(['MCD1', 'MCD3']);
    expect(snapshot.problems).toEqual([
      {
        code: 'ROW_UNREADABLE',
        detail: 'MCD2: the stored envelope does not hash to its stored hash',
      },
    ]);
  });

  it('has an envelope that was changed and kept its old hash', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) =>
        r.mcd_id === 'MCD1'
          ? {
              ...r,
              envelope_json: r.envelope_json.replace('"LONG"', '"SHORT"'),
            }
          : r
      )
    );
    expect(Object.keys(snapshot.rows)).toEqual(['MCD2', 'MCD3']);
    expect(codes(snapshot.problems)).toEqual(['ROW_UNREADABLE']);
  });

  const tampered = (change: (envelope: any) => void) => (rows: any[]) =>
    rows.map((r) => {
      if (r.mcd_id !== 'MCD3') return r;
      const envelope = JSON.parse(r.envelope_json);
      change(envelope);
      const text = JSON.stringify(envelope);
      return { ...r, envelope_json: text, envelope_sha256: sha(text) };
    });

  it.each([
    [
      'is not JSON',
      (rows: any[]) =>
        rows.map((r) =>
          r.mcd_id === 'MCD3'
            ? {
                ...r,
                envelope_json: 'not json',
                envelope_sha256: sha('not json'),
              }
            : r
        ),
    ],
    [
      'is another sensor’s',
      tampered((e) => {
        e.mcd_id = 'MCD1';
      }),
    ],
    [
      'is of another cycle',
      tampered((e) => {
        e.cycle_slot = '2026-10-05T14:25Z';
      }),
    ],
    [
      'has an unknown status',
      tampered((e) => {
        e.status = 'FINE';
      }),
    ],
    [
      'has a state the sensor does not have',
      tampered((e) => {
        e.state_code = 'MCD1_UP_IN_CORRIDOR';
      }),
    ],
    [
      'is not mcd-output/1',
      tampered((e) => {
        e.schema_version = 'mcd-output/2';
      }),
    ],
  ])('has an envelope that %s', async (_name, change) => {
    const snapshot = await run(change);
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(Object.keys(snapshot.rows)).toEqual(['MCD1', 'MCD2']);
    expect(snapshot.problems).toHaveLength(1);
    expect(snapshot.problems[0]).toMatchObject({ code: 'ROW_UNREADABLE' });
    expect(snapshot.problems[0]!.detail.startsWith('MCD3: ')).toBe(true);
  });

  it('has a status that differs from its column', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => (r.mcd_id === 'MCD1' ? { ...r, status: 'STALE' } : r))
    );
    expect(Object.keys(snapshot.rows)).toEqual(['MCD2', 'MCD3']);
    expect(snapshot.problems[0]!.detail).toBe(
      'MCD1: the row says STALE and the envelope VALID'
    );
  });

  it('is there twice: neither copy is trusted', async () => {
    const snapshot = await run((rows) => [
      ...rows,
      rows.find((r) => r.mcd_id === 'MCD2'),
    ]);
    expect(Object.keys(snapshot.rows)).toEqual(['MCD1', 'MCD3']);
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(snapshot.problems).toEqual([
      { code: 'ROW_UNREADABLE', detail: 'MCD2: two live rows for one cycle' },
    ]);
  });

  it('is of a sensor the roster does not know: reported, and given no line', async () => {
    const snapshot = await run((rows) => [
      ...rows,
      { ...rows[0], mcd_id: 'MCD9' },
    ]);
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(snapshot.problems).toEqual([
      {
        code: 'SENSOR_UNKNOWN',
        detail: 'MCD9 has a live row but is not in the roster',
      },
    ]);
  });

  it('is the gate’s: silently no line (a gate is expected to have a row)', async () => {
    const snapshot = await readSnapshot(
      { traderType: 'DAY_TRADER' },
      depsFor(world('01-')).deps
    );
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.live_ids).not.toContain('MCD0');
  });
});

describe('a synthesis row that cannot be believed is not used', () => {
  const run = async (
    change: (rows: any[]) => any[],
    zones?: (rows: any[]) => any[],
    prefix = '01-'
  ) => {
    const { deps } = depsFor(world(prefix), {
      synthesis: change,
      ...(zones ? { zones } : {}),
    });
    return readSnapshot({ traderType: 'DAY_TRADER' }, deps);
  };
  const rehash = (row: any, key: 'reading' | 'zones', text: string) => ({
    ...row,
    [`${key}_json`]: text,
    [`${key}_sha256`]: sha(text),
  });

  it('is believed when untouched, with its two zones', async () => {
    const snapshot = await run((rows) => rows);
    expect(snapshot.synthesis?.zones).toHaveLength(2);
    expect(snapshot.problems).toEqual([]);
  });

  it('has a reading that does not hash to its hash', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => ({ ...r, reading_sha256: sha('x') }))
    );
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.problems).toEqual([
      {
        code: 'SYNTHESIS_UNREADABLE',
        detail: 'the stored reading does not hash to its stored hash',
      },
    ]);
  });

  it('has zones that do not hash to their hash', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => ({ ...r, zones_sha256: sha('x') }))
    );
    expect(snapshot.synthesis).toBeNull();
    expect(codes(snapshot.problems)).toEqual(['ZONES_UNREADABLE']);
  });

  it('has zones that are not a list', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => rehash(r, 'zones', '{"zone_id":"Z1"}'))
    );
    expect(codes(snapshot.problems)).toEqual(['ZONES_UNREADABLE']);
  });

  it('has a zone count that is not the document’s', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => ({ ...r, zone_count: 3 }))
    );
    expect(codes(snapshot.problems)).toEqual(['ZONES_MISMATCH']);
  });

  it('has a reason for no zones that does not fit the zones', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => ({ ...r, zones_reason: 'NO_ZONE_SOURCES' }))
    );
    expect(codes(snapshot.problems)).toEqual(['SYNTHESIS_UNREADABLE']);
    const missing = await run(
      (rows) =>
        rows.map((r) => ({
          ...rehash(r, 'zones', '[]'),
          zone_count: 0,
          zones_reason: null,
        })),
      undefined,
      '09-'
    );
    expect(codes(missing.problems)).toEqual(['SYNTHESIS_UNREADABLE']);
  });

  it('has a reading that says something the packet would refuse', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => {
        const reading = JSON.parse(r.reading_json);
        reading.bias = 'UP';
        return rehash(r, 'reading', JSON.stringify(reading));
      })
    );
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.problems[0]).toMatchObject({
      code: 'SYNTHESIS_UNREADABLE',
    });
  });

  it('has zone rows that are not the zones of the document', async () => {
    const changes: [string, (rows: any[]) => any[]][] = [
      ['a zone fewer', (rows) => rows.slice(1)],
      [
        'a different price',
        (rows) =>
          rows.map((r, i) => (i === 0 ? { ...r, low: r.low + 0.01 } : r)),
      ],
      [
        'a different bias',
        (rows) => rows.map((r, i) => (i === 1 ? { ...r, bias: 'SHORT' } : r)),
      ],
      ['a different order', (rows) => [...rows].reverse()],
      [
        'a zone more',
        (rows) => [...rows, { ...rows[0], zone_id: 'Z3', rank: 3 }],
      ],
      ['no zone rows at all', () => []],
    ];
    for (const [, change] of changes) {
      const snapshot = await run((rows) => rows, change);
      expect(snapshot.synthesis).toBeNull();
      expect(codes(snapshot.problems)).toEqual(['ZONES_MISMATCH']);
    }
  });

  it('is not used when it is for the other trader type or another cycle', async () => {
    const w = world('01-');
    const other = {
      ...w,
      synthesis: w.synthesis.map((s) => ({
        ...s,
        profile: 'SCALPER' as const,
      })),
    };
    const { deps } = depsFor(other);
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.synthesis).toBeNull();
    expect(snapshot.problems).toEqual([]);
    const shifted = depsFor(w, {
      synthesis: (rows) =>
        rows.map((r) =>
          rehash(
            r,
            'reading',
            r.reading_json.replace(w.slotIso, '2026-09-18T20:50Z')
          )
        ),
    });
    expect(
      codes(
        (await readSnapshot({ traderType: 'DAY_TRADER' }, shifted.deps))
          .problems
      )
    ).toEqual(['SYNTHESIS_UNREADABLE']);
  });

  it('is used with no reference price, and then the data line has no price', async () => {
    const snapshot = await run((rows) =>
      rows.map((r) => ({ ...r, reference_price: null }))
    );
    expect(snapshot.synthesis?.facts.reference_price).toBeNull();
    expect(snapshot.data.last_price).toBeNull();
    expect(snapshot.problems).toEqual([]);
  });

  it('is used with no zones and a reason (golden 09, a range)', async () => {
    const snapshot = await run((rows) => rows, undefined, '09-');
    expect(snapshot.synthesis?.zones).toEqual([]);
    expect(snapshot.synthesis?.zones_reason).toBe('NOT_DIRECTIONAL');
    expect(snapshot.problems).toEqual([]);
  });

  it('is not shown without a live sensor', async () => {
    const { deps } = depsFor(world('01-'), { mcd: () => [] });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.synthesis).toBeNull();
    expect(codes(snapshot.problems)).toEqual(['SYNTHESIS_WITHOUT_SENSORS']);
  });
});

describe('zone rows come from the same document', () => {
  it('has the entry_zones rows of every stored reading equal to its zones document', () => {
    for (const w of WORLDS) {
      for (const row of w.synthesis) {
        const docs = JSON.parse(row.zones_json) as Record<string, unknown>[];
        const rows = zoneRowsOf(row);
        expect(rows).toHaveLength(docs.length);
        rows.forEach((stored, i) => {
          expect(stored.zone_id).toBe(docs[i]!['zone_id']);
          expect(stored.low).toBe(docs[i]!['low']);
          expect(stored.high).toBe(docs[i]!['high']);
        });
      }
    }
  });

  it('does not touch the world it was given', async () => {
    const w = world('01-');
    const before = clone(w);
    await readSnapshot({ traderType: 'DAY_TRADER' }, depsFor(w).deps);
    expect(w).toEqual(before);
  });
});

describe('what the reader is exact about', () => {
  const rehash = (row: any, key: 'reading' | 'zones', text: string) => ({
    ...row,
    [`${key}_json`]: text,
    [`${key}_sha256`]: sha(text),
  });

  it('goes on to the rows after a row it cannot use, whatever is wrong with it', async () => {
    // the bad row is the FIRST, so a reader that stopped at it would lose the other two
    const corrupt: [
      string,
      (rows: any[]) => any[],
      Record<string, unknown>?,
    ][] = [
      [
        'a hash that is not the text’s',
        (rows) =>
          rows.map((r) =>
            r.mcd_id === 'MCD1' ? { ...r, envelope_sha256: sha('x') } : r
          ),
      ],
      [
        'text that is not JSON',
        (rows) =>
          rows.map((r) =>
            r.mcd_id === 'MCD1'
              ? { ...r, envelope_json: 'nope', envelope_sha256: sha('nope') }
              : r
          ),
      ],
      [
        'a status that is not the envelope’s',
        (rows) =>
          rows.map((r) =>
            r.mcd_id === 'MCD1' ? { ...r, status: 'STALE' } : r
          ),
      ],
      [
        'a second row for the same sensor and cycle',
        (rows) => [rows[0], ...rows],
      ],
      [
        'a sensor the roster does not know, before the others',
        (rows) => [{ ...rows[0], mcd_id: 'MCD0X' }, ...rows],
      ],
    ];
    for (const [label, change] of corrupt) {
      const { deps } = depsFor(world('04-'), { mcd: change });
      const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
      expect({
        label,
        ids: Object.keys(snapshot.rows).filter((id) => id !== 'MCD1'),
      }).toEqual({
        label,
        ids: ['MCD2', 'MCD3'],
      });
    }
  });

  it('goes on past a row that is not live when the database answered it anyway', async () => {
    const w = world('04-');
    const shadowFirst = {
      ...w,
      sensors: w.sensors.map((x) =>
        x.mcd_id === 'MCD1' ? { ...x, flag: 'shadow' } : x
      ),
    };
    const { deps } = depsFor(shadowFirst, { ignoreFlagFilter: true });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.live_ids).toEqual(['MCD2', 'MCD3']);
  });

  it('goes on past a gate before the sensors, and past an unknown sensor', async () => {
    const snapshot = await readSnapshot(
      { traderType: 'DAY_TRADER' },
      depsFor(world('01-')).deps
    );
    expect(snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    const unknownFirst = depsFor(world('04-'), {
      mcd: (rows) => [{ ...rows[0]!, mcd_id: 'MCD9' }, ...rows],
    });
    const unknown = await readSnapshot(
      { traderType: 'DAY_TRADER' },
      unknownFirst.deps
    );
    expect(unknown.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(unknown.problems.map((x) => x.code)).toEqual(['SENSOR_UNKNOWN']);
  });

  it('says what the gateway did, whatever it threw', async () => {
    const base = depsFor(world('04-')).deps;
    const throwing = (thrown: unknown) => ({
      ...base,
      fetchCurrentCycle: async (): Promise<never> => {
        throw thrown;
      },
    });
    const details = async (thrown: unknown) =>
      (await readSnapshot({ traderType: 'DAY_TRADER' }, throwing(thrown)))
        .problems[0]!.detail;
    expect(await details(new Error('boom'))).toBe('UNKNOWN: boom');
    expect(
      await details(Object.assign(new Error('late'), { kind: 'TIMEOUT' }))
    ).toBe('TIMEOUT: late');
    expect(await details('plain text')).toBe('UNKNOWN: unknown error');
    expect(await details(null)).toBe('UNKNOWN: unknown error');
    expect(await details({ kind: 'REJECTED' })).toBe('REJECTED: unknown error');
    expect(await details({ other: 1 })).toBe('UNKNOWN: unknown error');
  });

  it('says what the database did when it threw something that is not an error', async () => {
    const base = depsFor(world('04-'));
    const deps = {
      ...base.deps,
      client: {
        ...base.deps.client,
        mcdOutput: {
          findMany: async (): Promise<never> => {
            throw 'plain text';
          },
        },
      },
    };
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.problems[0]).toEqual({
      code: 'DATABASE_ERROR',
      detail: "the sensors' readings could not be read: unknown error",
    });
  });

  it('says the gateway has no ready cycle, and that no cycle is not a retuning one', async () => {
    const { deps } = depsFor(world('04-'), { noCycle: true });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.problems).toEqual([
      { code: 'NO_CYCLE', detail: 'the gateway has no ready cycle' },
    ]);
    expect(snapshot.data.retuning).toBe(false);
    expect(snapshot.data.status).toBe('FRESH');
  });

  it('reports nothing but the gateway when it is down and the database has no ready cycle', async () => {
    const { deps } = depsFor(world('04-'), {
      gateway: 'THROWS',
      newestReady: null,
    });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.problems.map((x) => x.code)).toEqual([
      'GATEWAY_UNREACHABLE',
    ]);
  });

  it('says in its own words why a synthesis reading was not used', async () => {
    const w = world('01-');
    const detail = async (
      change: (rows: any[]) => any[],
      zones?: (rows: any[]) => any[]
    ) => {
      const { deps } = depsFor(w, {
        synthesis: change,
        ...(zones ? { zones } : {}),
      });
      return (
        await readSnapshot({ traderType: 'DAY_TRADER' }, deps)
      ).problems.map((x) => [x.code, x.detail]);
    };
    expect(
      await detail((rows) =>
        rows.map((r) => ({ ...r, zones_sha256: sha('x') }))
      )
    ).toEqual([
      ['ZONES_UNREADABLE', 'the stored zones do not hash to their stored hash'],
    ]);
    expect(
      await detail((rows) =>
        rows.map((r) => rehash(r, 'zones', '{"zone_id":"Z1"}'))
      )
    ).toEqual([['ZONES_UNREADABLE', 'the stored zones are not a list']]);
    expect(
      await detail((rows) => rows.map((r) => ({ ...r, zone_count: 3 })))
    ).toEqual([
      ['ZONES_MISMATCH', 'the reading has 3 zones and the document 2'],
    ]);
    expect(
      await detail((rows) =>
        rows.map((r) => ({ ...r, zones_reason: 'NO_ZONE_SOURCES' }))
      )
    ).toEqual([
      [
        'SYNTHESIS_UNREADABLE',
        'the reason for no zones is set exactly when there are none',
      ],
    ]);
    expect(
      await detail(
        (rows) => rows,
        (rows) => rows.slice(1)
      )
    ).toEqual([
      [
        'ZONES_MISMATCH',
        'the entry_zones rows are not the zones of the stored reading',
      ],
    ]);
  });

  it('says in its own words that a live synthesis reading has no sensor to have read', async () => {
    const { deps } = depsFor(world('04-'), { mcd: () => [] });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(snapshot.problems).toEqual([
      {
        code: 'SYNTHESIS_WITHOUT_SENSORS',
        detail: 'a live synthesis reading exists but no sensor is live',
      },
    ]);
  });
});

describe('the sensors’ rows and the synthesis reading are read together', () => {
  const flush = (): Promise<void> =>
    new Promise((resolve) => setImmediate(resolve));
  const gate = () => {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => (open = resolve));
    return { opened, open };
  };

  it('asks for both before either answers', async () => {
    const { deps } = depsFor(world('01-'));
    const mcd = gate();
    const synthesis = gate();
    const asked: string[] = [];
    const { findMany } = deps.client.mcdOutput;
    const { findFirst } = deps.client.synthesisReading;
    deps.client.mcdOutput.findMany = async (args) => {
      asked.push('sensors');
      await mcd.opened;
      return findMany(args);
    };
    deps.client.synthesisReading.findFirst = async (args) => {
      asked.push('synthesis');
      await synthesis.opened;
      return findFirst(args);
    };

    const pending = readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    await flush();
    expect(asked).toEqual(['sensors', 'synthesis']);

    // the synthesis answers first; the snapshot is the same as ever
    synthesis.open();
    await flush();
    mcd.open();
    const snapshot = await pending;
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.live_ids.length).toBeGreaterThan(0);
    expect(snapshot.synthesis?.profile).toBe('DAY_TRADER');
  });

  it('lists the problems in the order of the sequential version: the cycle, the sensors, the synthesis', async () => {
    const { deps } = depsFor(world('01-'), {
      gateway: 'THROWS',
      failMcd: true,
      failSynthesis: true,
    });
    // the sensors fail LAST
    const mcd = gate();
    const { findMany } = deps.client.mcdOutput;
    deps.client.mcdOutput.findMany = async (args) => {
      await mcd.opened;
      return findMany(args);
    };

    const pending = readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    await flush();
    mcd.open();
    const snapshot = await pending;

    expect(snapshot.problems).toEqual([
      {
        code: 'GATEWAY_UNREACHABLE',
        detail: 'UNREACHABLE: the gateway could not be reached',
      },
      {
        code: 'DATABASE_ERROR',
        detail: "the sensors' readings could not be read: connection refused",
      },
      {
        code: 'DATABASE_ERROR',
        detail: 'the synthesis reading could not be read: connection refused',
      },
    ]);
  });

  it('asks for neither without a pinned cycle', async () => {
    const { deps, calls } = depsFor(world('01-'), {
      gateway: 'THROWS',
      newestReady: null,
    });
    const snapshot = await readSnapshot({ traderType: 'DAY_TRADER' }, deps);
    expect(calls.mcd).toEqual([]);
    expect(calls.synthesis).toEqual([]);
    expect(snapshot.synthesis).toBeNull();
  });
});
