/**
 * The sensors' states at an EARLIER cycle (build step 7 part 5; architecture 5.11): the thread's
 * last cycle, read back so a follow-up on a new cycle can open with what changed
 * (`report1/changes.ts`). Imported by path, never through a barrel, like `read/day-bars.ts`.
 *
 * The same standard of belief as the snapshot reader of the intake path (`lib/intake/read/
 * snapshot.ts`), for the one thing the diff needs, each board sensor's state code at the slot:
 *  - only rows with `flag = 'live'` are read; a `shadow` row is never shown to a trader;
 *  - a row is believed only if its envelope text hashes to the hash stored beside it and says what
 *    the board accepts for that sensor and slot (`sensorFactsOf`); a row that fails is listed in
 *    `unreadable` and the diff leaves that sensor out, because "I could not read it" is not "it was
 *    gone";
 *  - a gate (MCD0) and a sensor the roster does not know have no line on the board and are skipped.
 *
 * POINT IN TIME. The query names the symbol and the slot, so the unique key
 * `(symbol, cycle_slot, mcd_id)` serves it and the same query returns the same rows whenever it is
 * run. FAILS CLOSED: a bad slot or a database error is `ok: false` with the reason, and the reply
 * simply carries no "what changed" line; nothing here throws for a database failure. The clock is
 * never read.
 *
 * @module lib/reply/read/snapshot-at
 */

import { marketPrisma } from '@/lib/db/market-prisma';

import {
  PACKET_SYMBOL,
  secondsOfSlot,
  sensorById,
  sensorFactsOf,
  sha256Hex,
} from '../contracts/intake';
import type { CycleStates } from '../report1/changes';

/** The columns of an `mcd_outputs` row this reader uses. */
export interface McdOutputRow {
  mcd_id: string;
  flag: string;
  status: string;
  envelope_json: string;
  envelope_sha256: string;
}

/** The one delegate of `marketPrisma` this reader calls: the real one fits with no cast; a test passes its own. */
export interface SnapshotAtClient {
  mcdOutput: {
    findMany(args: {
      where: { symbol: string; cycle_slot: number; flag: 'live' };
      orderBy: { mcd_id: 'asc' };
      select: Record<keyof McdOutputRow, true>;
    }): Promise<McdOutputRow[]>;
  };
}

export interface SnapshotAtRequest {
  /** the earlier cycle's slot, `2026-09-18T20:55Z` */
  slot: string;
  symbol?: string;
}

export type SnapshotAtErrorCode = 'BAD_SLOT' | 'DATABASE_ERROR';

export type SnapshotAtRead =
  | { ok: true; states: CycleStates }
  | { ok: false; code: SnapshotAtErrorCode; detail: string };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** The state code of every board sensor that ran live at `slot`. */
export async function readSnapshotAt(
  request: SnapshotAtRequest,
  client: SnapshotAtClient = { mcdOutput: marketPrisma.mcdOutput }
): Promise<SnapshotAtRead> {
  const slotSeconds = secondsOfSlot(request.slot);
  if (slotSeconds === null) {
    return {
      ok: false,
      code: 'BAD_SLOT',
      detail:
        'the cycle slot is not a slot (a UTC time on the five-minute grid)',
    };
  }
  const symbol = request.symbol ?? PACKET_SYMBOL;

  let rows: McdOutputRow[];
  try {
    rows = await client.mcdOutput.findMany({
      where: { symbol, cycle_slot: slotSeconds, flag: 'live' },
      orderBy: { mcd_id: 'asc' },
      select: {
        mcd_id: true,
        flag: true,
        status: true,
        envelope_json: true,
        envelope_sha256: true,
      },
    });
  } catch (error) {
    return {
      ok: false,
      code: 'DATABASE_ERROR',
      detail: `the sensors' readings could not be read: ${messageOf(error)}`,
    };
  }

  const states = new Map<string, string | null>();
  const unreadable: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.flag !== 'live') continue; // the query asks for live only; a row that is not is never believed
    const sensor = sensorById(row.mcd_id);
    if (sensor === undefined || !sensor.on_board) continue;
    if (seen.has(row.mcd_id)) {
      // the unique key allows one row; two means neither can be trusted
      states.delete(row.mcd_id);
      if (!unreadable.includes(row.mcd_id)) unreadable.push(row.mcd_id);
      continue;
    }
    seen.add(row.mcd_id);

    const believed =
      typeof row.envelope_json === 'string' &&
      (await sha256Hex(row.envelope_json)) === row.envelope_sha256;
    const facts = believed
      ? sensorFactsOf(parseJson(row.envelope_json), {
          mcd_id: row.mcd_id,
          slot: request.slot,
        })
      : null;
    if (facts === null || !facts.ok || facts.facts.status !== row.status) {
      unreadable.push(row.mcd_id);
      continue;
    }
    states.set(row.mcd_id, facts.facts.state_code);
  }

  return {
    ok: true,
    states: {
      slot: request.slot,
      sensors: [...states].map(([mcd_id, state_code]) => ({
        mcd_id,
        state_code,
      })),
      unreadable,
    },
  };
}
