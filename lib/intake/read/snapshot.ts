/**
 * The snapshot of the latest complete cycle (architecture 4.2 step 4, plan decisions D7 and
 * D8, findings F8, F9 and F16): the data status, the sensors' LIVE readings of the cycle,
 * the trader's synthesis reading and its entry zones.
 *
 *  - The cycle and its live status come from the gateway (`fetchCurrentCycle`, F16), which
 *    computes STALE and MARKET_CLOSED on every read. If the gateway cannot be asked the
 *    status is UNKNOWN and the snapshot says so (`GATEWAY_UNREACHABLE`); the newest READY
 *    cycle of `market_cycles` is then used for the slot, so the board can still be shown
 *    and Section 5 still gets no direction from an UNKNOWN status.
 *  - The sensors' rows are those of that slot with `flag = 'live'` and nothing else: a
 *    `shadow` row is never shown to a trader. A row is believed only if its envelope text
 *    hashes to the hash stored beside it and says what the packet validator will accept
 *    (`facts.ts`); a row that fails is a PROBLEM and the sensor is listed as ABSENT.
 *  - The synthesis reading is the trader's type's LIVE row for the slot, with its zones read
 *    from the same row's `zones_json` (checked against `zones_sha256`) and cross-checked
 *    against the `entry_zones` rows. Zones are all or nothing: if they disagree the reading
 *    is not used.
 *  - The data line's price is the stored reading's `reference_price`: the close of the last
 *    closed M5 bar, labelled with that bar (D8).
 *
 * Nothing here throws for a database or a gateway error: each is a problem in the answer.
 * The clock is never read; the cycle decides what "now" means.
 *
 * Imported BY PATH, never through the `lib/intake` barrel.
 *
 * @module lib/intake/read/snapshot
 */

import 'server-only';

import { createHash } from 'crypto';

import {
  fetchCurrentCycle,
  type CurrentCycleResponse,
} from '@/lib/active-indicator/gateway-client';
import { marketPrisma } from '@/lib/db/market-prisma';

import { liveSensorIds } from '../board';
import {
  sensorFactsOf,
  synthesisFactsOf,
  type SensorFacts,
  type SynthesisFacts,
} from '../facts';
import type { DataFlag, DataStatus, LastPrice } from '../packet';
import { SENSOR_ROSTER, type Roster, type TraderType } from '../roster';
import { SLOT_SECONDS, isSlotSeconds, slotIso } from '../slots';

const DEFAULT_SYMBOL = 'XAUUSD';

/** The columns of an `mcd_outputs` row this reader uses. */
export interface McdOutputRow {
  mcd_id: string;
  flag: string;
  status: string;
  envelope_json: string;
  envelope_sha256: string;
}

/** The columns of a `synthesis_readings` row this reader uses. */
export interface SynthesisReadingRow {
  flag: string;
  reading_json: string;
  reading_sha256: string;
  zone_count: number;
  zones_reason: string | null;
  zones_json: string;
  zones_sha256: string;
  reference_price: number | null;
}

/** The columns of an `entry_zones` row this reader compares with the stored zones document. */
export interface EntryZoneRow {
  zone_id: string;
  rank: number;
  bias: string;
  low: number;
  high: number;
  reference_price: number;
}

/**
 * The delegates of `marketPrisma` this reader calls. The real ones fit with no cast; a test
 * passes its own. Every query names the symbol and the slot, so the unique keys
 * `(symbol, cycle_slot, mcd_id)` and `(symbol, cycle_slot, profile)` serve them.
 */
export interface SnapshotClient {
  mcdOutput: {
    findMany(args: {
      where: { symbol: string; cycle_slot: number; flag: 'live' };
      orderBy: { mcd_id: 'asc' };
      select: Record<keyof McdOutputRow, true>;
    }): Promise<McdOutputRow[]>;
  };
  synthesisReading: {
    findFirst(args: {
      where: {
        symbol: string;
        cycle_slot: number;
        profile: string;
        flag: 'live';
      };
      select: Record<keyof SynthesisReadingRow, true>;
    }): Promise<SynthesisReadingRow | null>;
  };
  entryZone: {
    findMany(args: {
      where: { symbol: string; profile: string; cycle_slot: number };
      orderBy: { rank: 'asc' };
      select: Record<keyof EntryZoneRow, true>;
    }): Promise<EntryZoneRow[]>;
  };
  marketCycle: {
    findFirst(args: {
      where: { symbol: string; state: 'READY' };
      orderBy: { slot: 'desc' };
      select: { slot: true };
    }): Promise<{ slot: number } | null>;
  };
}

export interface SnapshotDeps {
  fetchCurrentCycle(): Promise<CurrentCycleResponse>;
  client: SnapshotClient;
}

export function defaultSnapshotDeps(): SnapshotDeps {
  return {
    fetchCurrentCycle,
    client: {
      mcdOutput: marketPrisma.mcdOutput,
      synthesisReading: marketPrisma.synthesisReading,
      entryZone: marketPrisma.entryZone,
      marketCycle: marketPrisma.marketCycle,
    },
  };
}

export interface SnapshotRequest {
  /** DAY_TRADER or SCALPER: selects the synthesis reading and the primary sensor */
  traderType: TraderType;
  symbol?: string;
  /** the sensors that exist; the committed roster unless a test draws up another */
  roster?: Roster;
}

export type SnapshotProblemCode =
  | 'GATEWAY_UNREACHABLE'
  | 'NO_CYCLE'
  | 'BAD_SLOT'
  | 'DATABASE_ERROR'
  | 'SENSOR_UNKNOWN'
  | 'ROW_UNREADABLE'
  | 'SYNTHESIS_UNREADABLE'
  | 'ZONES_UNREADABLE'
  | 'ZONES_MISMATCH'
  | 'SYNTHESIS_WITHOUT_SENSORS';

export interface SnapshotProblem {
  code: SnapshotProblemCode;
  detail: string;
}

/** A sensor's live row that was believed: its envelope as stored, its hash and its facts. */
export interface LiveRow {
  mcd_id: string;
  envelope_sha256: string;
  envelope: Record<string, unknown>;
  facts: SensorFacts;
}

/** The trader's live synthesis reading with its zones, as the packet carries them. */
export interface SynthesisSnapshot {
  profile: TraderType;
  reading_sha256: string;
  reading: Record<string, unknown>;
  zones_sha256: string;
  zones_reason: string | null;
  zones: Record<string, unknown>[];
  facts: SynthesisFacts;
}

export interface SnapshotData {
  status: DataStatus;
  retuning: boolean;
  /** `2026-09-18T20:55Z`; null when no cycle could be found */
  cycle_slot: string | null;
  slot_seconds: number | null;
  last_price: LastPrice | null;
  flags: DataFlag[];
}

export interface Snapshot {
  data: SnapshotData;
  /** the sensors that have a line on the board, in id order */
  live_ids: string[];
  /** the live rows that were believed, by sensor id */
  rows: Record<string, LiveRow>;
  synthesis: SynthesisSnapshot | null;
  problems: SnapshotProblem[];
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

interface Pinned {
  status: DataStatus;
  retuning: boolean;
  slot: number | null;
  flags: DataFlag[];
}

/** Ask the gateway for the cycle and the status; fall back to the database for the slot. */
async function pinCycle(
  deps: SnapshotDeps,
  symbol: string,
  problems: SnapshotProblem[]
): Promise<Pinned> {
  try {
    const gateway = await deps.fetchCurrentCycle();
    const slot = gateway.cycle === null ? null : gateway.cycle.slot;
    if (slot === null) {
      problems.push({
        code: 'NO_CYCLE',
        detail: 'the gateway has no ready cycle',
      });
    } else if (!isSlotSeconds(slot)) {
      problems.push({
        code: 'BAD_SLOT',
        detail: `${String(slot)} is not a cycle slot`,
      });
    }
    return {
      status: gateway.dataStatus.status,
      retuning: gateway.cycle?.retuning ?? false,
      slot: slot !== null && isSlotSeconds(slot) ? slot : null,
      flags: [],
    };
  } catch (error) {
    const kind =
      typeof error === 'object' && error !== null && 'kind' in error
        ? String((error as { kind: unknown }).kind)
        : 'UNKNOWN';
    problems.push({
      code: 'GATEWAY_UNREACHABLE',
      detail: `${kind}: ${messageOf(error)}`,
    });
  }
  let slot: number | null = null;
  try {
    const row = await deps.client.marketCycle.findFirst({
      where: { symbol, state: 'READY' },
      orderBy: { slot: 'desc' },
      select: { slot: true },
    });
    if (row !== null && isSlotSeconds(row.slot)) slot = row.slot;
    else if (row !== null) {
      problems.push({
        code: 'BAD_SLOT',
        detail: `${String(row.slot)} is not a cycle slot`,
      });
    }
  } catch (error) {
    problems.push({
      code: 'DATABASE_ERROR',
      detail: `the newest cycle could not be read: ${messageOf(error)}`,
    });
  }
  return {
    status: 'UNKNOWN',
    retuning: false,
    slot,
    flags: ['GATEWAY_UNREACHABLE'],
  };
}

async function readSensorRows(
  deps: SnapshotDeps,
  symbol: string,
  slot: number,
  roster: Roster,
  problems: SnapshotProblem[]
): Promise<{ ids: string[]; rows: Record<string, LiveRow> }> {
  let found: McdOutputRow[] = [];
  try {
    found = await deps.client.mcdOutput.findMany({
      where: { symbol, cycle_slot: slot, flag: 'live' },
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
    problems.push({
      code: 'DATABASE_ERROR',
      detail: `the sensors' readings could not be read: ${messageOf(error)}`,
    });
    return { ids: [], rows: {} };
  }

  const known = new Map(
    roster.sensors.map((sensor) => [sensor.mcd_id, sensor])
  );
  const iso = slotIso(slot);
  const ids: string[] = [];
  const rows: Record<string, LiveRow> = {};
  const seen = new Set<string>();
  for (const row of found) {
    if (row.flag !== 'live') continue; // the query asks for live only; a row that is not is never believed
    const sensor = known.get(row.mcd_id);
    if (sensor === undefined) {
      problems.push({
        code: 'SENSOR_UNKNOWN',
        detail: `${row.mcd_id} has a live row but is not in the roster`,
      });
      continue;
    }
    if (!sensor.on_board) continue; // a gate (MCD0) has a row and no line on the board
    // the sensor ran live at this slot: it has a line even if its row cannot be believed
    ids.push(row.mcd_id);
    const unreadable = (detail: string): void => {
      problems.push({
        code: 'ROW_UNREADABLE',
        detail: `${row.mcd_id}: ${detail}`,
      });
    };
    if (seen.has(row.mcd_id)) {
      // the unique key (symbol, slot, sensor) allows one row; two means neither can be trusted
      delete rows[row.mcd_id];
      unreadable('two live rows for one cycle');
      continue;
    }
    seen.add(row.mcd_id);
    if (
      typeof row.envelope_json !== 'string' ||
      sha256(row.envelope_json) !== row.envelope_sha256
    ) {
      unreadable('the stored envelope does not hash to its stored hash');
      continue;
    }
    const envelope = parseJson(row.envelope_json);
    const facts = sensorFactsOf(
      envelope,
      { mcd_id: row.mcd_id, slot: iso },
      roster
    );
    if (!facts.ok) {
      unreadable(facts.reason);
      continue;
    }
    if (facts.facts.status !== row.status) {
      unreadable(
        `the row says ${row.status} and the envelope ${facts.facts.status}`
      );
      continue;
    }
    rows[row.mcd_id] = {
      mcd_id: row.mcd_id,
      envelope_sha256: row.envelope_sha256,
      envelope: envelope as Record<string, unknown>,
      facts: facts.facts,
    };
  }
  return { ids, rows };
}

async function readSynthesis(
  deps: SnapshotDeps,
  symbol: string,
  slot: number,
  traderType: TraderType,
  problems: SnapshotProblem[]
): Promise<SynthesisSnapshot | null> {
  let row: SynthesisReadingRow | null;
  try {
    row = await deps.client.synthesisReading.findFirst({
      where: { symbol, cycle_slot: slot, profile: traderType, flag: 'live' },
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
    });
  } catch (error) {
    problems.push({
      code: 'DATABASE_ERROR',
      detail: `the synthesis reading could not be read: ${messageOf(error)}`,
    });
    return null;
  }
  if (row === null || row.flag !== 'live') return null;

  const unreadable = (code: SnapshotProblemCode, detail: string): null => {
    problems.push({ code, detail });
    return null;
  };
  if (
    typeof row.reading_json !== 'string' ||
    sha256(row.reading_json) !== row.reading_sha256
  ) {
    return unreadable(
      'SYNTHESIS_UNREADABLE',
      'the stored reading does not hash to its stored hash'
    );
  }
  if (
    typeof row.zones_json !== 'string' ||
    sha256(row.zones_json) !== row.zones_sha256
  ) {
    return unreadable(
      'ZONES_UNREADABLE',
      'the stored zones do not hash to their stored hash'
    );
  }
  const reading = parseJson(row.reading_json);
  const zones = parseJson(row.zones_json);
  if (!Array.isArray(zones)) {
    return unreadable('ZONES_UNREADABLE', 'the stored zones are not a list');
  }
  if (zones.length !== row.zone_count) {
    return unreadable(
      'ZONES_MISMATCH',
      `the reading has ${row.zone_count} zones and the document ${zones.length}`
    );
  }
  if ((zones.length === 0) !== (row.zones_reason !== null)) {
    return unreadable(
      'SYNTHESIS_UNREADABLE',
      'the reason for no zones is set exactly when there are none'
    );
  }

  const facts = synthesisFactsOf(reading, zones, row.reference_price, {
    profile: traderType,
    slot: slotIso(slot),
  });
  if (!facts.ok) return unreadable('SYNTHESIS_UNREADABLE', facts.reason);

  // the zone rows must be the document's zones (all or nothing)
  let zoneRows: EntryZoneRow[];
  try {
    zoneRows = await deps.client.entryZone.findMany({
      where: { symbol, profile: traderType, cycle_slot: slot },
      orderBy: { rank: 'asc' },
      select: {
        zone_id: true,
        rank: true,
        bias: true,
        low: true,
        high: true,
        reference_price: true,
      },
    });
  } catch (error) {
    return unreadable(
      'DATABASE_ERROR',
      `the entry zones could not be read: ${messageOf(error)}`
    );
  }
  const agree =
    zoneRows.length === zones.length &&
    zoneRows.every((stored, index) => {
      const doc = zones[index] as Record<string, unknown>;
      return (
        stored.zone_id === doc['zone_id'] &&
        stored.rank === doc['rank'] &&
        stored.bias === doc['bias'] &&
        stored.low === doc['low'] &&
        stored.high === doc['high'] &&
        stored.reference_price === doc['reference_price']
      );
    });
  if (!agree) {
    return unreadable(
      'ZONES_MISMATCH',
      'the entry_zones rows are not the zones of the stored reading'
    );
  }

  return {
    profile: traderType,
    reading_sha256: row.reading_sha256,
    reading: reading as Record<string, unknown>,
    zones_sha256: row.zones_sha256,
    zones_reason: row.zones_reason,
    zones: zones as Record<string, unknown>[],
    facts: facts.facts,
  };
}

export async function readSnapshot(
  request: SnapshotRequest,
  deps: SnapshotDeps = defaultSnapshotDeps()
): Promise<Snapshot> {
  const roster = request.roster ?? SENSOR_ROSTER;
  const symbol = request.symbol ?? DEFAULT_SYMBOL;
  const problems: SnapshotProblem[] = [];

  const pinned = await pinCycle(deps, symbol, problems);
  let rowIds: string[] = [];
  let rows: Record<string, LiveRow> = {};
  let synthesis: SynthesisSnapshot | null = null;

  if (pinned.slot !== null) {
    // The sensors' rows and the synthesis reading are keyed by the pinned slot
    // alone and read different tables, so they are read together. Each reader
    // writes its problems into a list of its own, and the lists are appended
    // below in the order the readers used to run one after the other (sensors,
    // then synthesis), so `problems` keeps its order.
    const sensorProblems: SnapshotProblem[] = [];
    const synthesisProblems: SnapshotProblem[] = [];
    const [sensors, read] = await Promise.all([
      readSensorRows(deps, symbol, pinned.slot, roster, sensorProblems),
      readSynthesis(
        deps,
        symbol,
        pinned.slot,
        request.traderType,
        synthesisProblems
      ),
    ]);
    problems.push(...sensorProblems, ...synthesisProblems);
    rowIds = sensors.ids;
    rows = sensors.rows;
    synthesis = read;
  }

  const liveIds = liveSensorIds(rowIds, roster);
  if (liveIds.length === 0 && synthesis !== null) {
    // nothing live for the synthesis to have read: it is not running (D7)
    problems.push({
      code: 'SYNTHESIS_WITHOUT_SENSORS',
      detail: 'a live synthesis reading exists but no sensor is live',
    });
    synthesis = null;
  }

  const flags: DataFlag[] = [...pinned.flags];
  if (liveIds.length === 0) flags.push('SENSORS_NOT_LIVE'); // D7: the packet says so

  const reference = synthesis?.facts.reference_price ?? null;
  const lastPrice: LastPrice | null =
    pinned.slot !== null && reference !== null
      ? {
          price: reference,
          timeframe: 'M5',
          // the closed bar the reading's close belongs to opened one slot before the cycle
          bar: slotIso(Math.max(0, pinned.slot - SLOT_SECONDS)),
        }
      : null;

  return {
    data: {
      status: pinned.status,
      retuning: pinned.retuning,
      cycle_slot: pinned.slot === null ? null : slotIso(pinned.slot),
      slot_seconds: pinned.slot,
      last_price: lastPrice,
      flags,
    },
    live_ids: liveIds,
    rows,
    synthesis,
    problems,
  };
}
