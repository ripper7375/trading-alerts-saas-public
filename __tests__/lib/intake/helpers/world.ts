/**
 * Stored worlds for the part 4 tests: what the database would hold for a cycle, made from
 * the files Davin signed off. Nothing here invents a reading.
 *
 *  - `goldenWorlds()`: the 16 golden scenarios (`mcd_worker/golden/*\/expected.json`): the
 *    sensors' final envelopes with the worker's own canonical text and hashes, the two
 *    synthesis readings with their zones, and the cycle's reference price;
 *  - `storedWorlds()`: the three stored real cycles of the worker's fixtures
 *    (`fixtures/<slot>.cycle.json` and `<slot>.synthesis.json`): 18 Sep 20:55, 28 Sep 14:15
 *    and 28 Sep 23:15. They are the same cycles as golden 01 to 03, taken from the files
 *    the worker wrote when it ran them.
 *
 * `fakeClient` answers the four queries of `read/snapshot.ts` from a world, honouring the
 * `where` the reader sends (the symbol, the slot, the profile, and `flag = 'live'`), so a
 * test can leave shadow rows in the world and see that the reader never asks for them.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import type { CurrentCycleResponse } from '@/lib/active-indicator/gateway-client';
import type {
  EntryZoneRow,
  McdOutputRow,
  SnapshotClient,
  SnapshotDeps,
  SynthesisReadingRow,
} from '@/lib/intake/read/snapshot';
import { SENSOR_ROSTER, type Roster } from '@/lib/intake';

import { WORKER, entryRowOf, slotSeconds } from '../../engine4/helpers/stored';

export interface WorldSensor extends McdOutputRow {
  /** the envelope's own cycle slot, as text */
  cycle_slot: string;
}

export interface WorldSynthesis extends SynthesisReadingRow {
  profile: 'DAY_TRADER' | 'SCALPER';
}

export interface World {
  name: string;
  /** a stored real cycle rather than a synthetic one */
  real: boolean;
  slotIso: string;
  slot: number;
  sensors: WorldSensor[];
  synthesis: WorldSynthesis[];
  /** the zone parameters the zones were built with (the real tables store them beside each row) */
  zoneParams: { version: string; sha256: string };
  /** the hash of the cycle's bundle, as the worker recorded it on every row of the cycle */
  inputsSha256: string | null;
  runnerVersion: string;
}

const readJson = (path: string): Record<string, any> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;

interface StoredReading {
  profile: 'DAY_TRADER' | 'SCALPER';
  reading_json: string;
  reading_sha256: string;
  zones_json: string;
  zones_sha256: string;
  zones_reason: string | null;
}

function synthesisRows(
  readings: StoredReading[],
  referencePrice: number | null
): WorldSynthesis[] {
  return readings.map((r) => ({
    profile: r.profile,
    flag: 'live',
    reading_json: r.reading_json,
    reading_sha256: r.reading_sha256,
    zone_count: (JSON.parse(r.zones_json) as unknown[]).length,
    zones_reason: r.zones_reason,
    zones_json: r.zones_json,
    zones_sha256: r.zones_sha256,
    reference_price: referencePrice,
  }));
}

export function goldenWorlds(): World[] {
  const dir = join(WORKER, 'golden');
  const out: World[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/^\d\d-/.test(name)) continue;
    const scenario = readJson(join(dir, name, 'scenario.json'));
    const expected = readJson(join(dir, name, 'expected.json'));
    const iso = String(expected['cycle_slot']);
    out.push({
      name,
      real: scenario['kind'] === 'cycle',
      slotIso: iso,
      slot: slotSeconds(iso),
      sensors: (expected['sensors'] as any[]).map((s) => ({
        mcd_id: s.mcd_id,
        flag: 'live',
        status: s.status,
        envelope_json: s.envelope_json,
        envelope_sha256: s.envelope_sha256,
        cycle_slot: iso,
      })),
      synthesis: synthesisRows(
        expected['synthesis'].readings as StoredReading[],
        typeof expected['reference_price'] === 'number'
          ? expected['reference_price']
          : null
      ),
      zoneParams: {
        version: String(expected['synthesis'].zones_version),
        sha256: String(expected['synthesis'].zones_sha256),
      },
      inputsSha256:
        typeof expected['inputs_sha256'] === 'string'
          ? expected['inputs_sha256']
          : null,
      runnerVersion: '1.0.0',
    });
  }
  return out;
}

export function storedWorlds(): World[] {
  const dir = join(WORKER, 'fixtures');
  const out: World[] = [];
  for (const file of readdirSync(dir).sort()) {
    const match = /^(.+)\.cycle\.json$/.exec(file);
    if (match === null) continue;
    const cycle = readJson(join(dir, file));
    const synthesis = readJson(join(dir, `${match[1]}.synthesis.json`));
    const iso = String(cycle['cycle_slot']);
    out.push({
      name: match[1] as string,
      real: true,
      slotIso: iso,
      slot: slotSeconds(iso),
      sensors: (cycle['results'] as any[]).map((s) => ({
        mcd_id: s.mcd_id,
        flag: 'live',
        status: s.status,
        envelope_json: s.envelope_json,
        envelope_sha256: s.envelope_sha256,
        cycle_slot: iso,
      })),
      synthesis: synthesisRows(
        synthesis['readings'] as StoredReading[],
        synthesis['reference_price'] as number
      ),
      zoneParams: {
        version: String(synthesis['zones_version']),
        sha256: String(synthesis['zones_sha256']),
      },
      inputsSha256:
        typeof cycle['inputs_sha256'] === 'string'
          ? cycle['inputs_sha256']
          : null,
      runnerVersion: String(cycle['runner_version']),
    });
  }
  return out;
}

/** The entry_zones rows of a synthesis row, as the gateway stores them. */
export function zoneRowsOf(row: WorldSynthesis): EntryZoneRow[] {
  return (JSON.parse(row.zones_json) as Record<string, unknown>[]).map(
    (doc) => entryRowOf(doc) as unknown as EntryZoneRow
  );
}

export interface FakeCalls {
  mcd: unknown[];
  synthesis: unknown[];
  zones: unknown[];
  cycle: unknown[];
}

export interface FakeOptions {
  failMcd?: boolean;
  failSynthesis?: boolean;
  failZones?: boolean;
  failCycle?: boolean;
  /** change the world's rows before they are answered, per table */
  mcd?: (rows: McdOutputRow[]) => McdOutputRow[];
  synthesis?: (rows: SynthesisReadingRow[]) => SynthesisReadingRow[];
  zones?: (rows: EntryZoneRow[]) => EntryZoneRow[];
  /** answer rows whatever `flag` the query names (a database that ignored the filter) */
  ignoreFlagFilter?: boolean;
  /** the slot of the newest READY cycle `market_cycles` holds */
  newestReady?: number | null;
}

/** A client that answers the four queries of the snapshot reader from a world. */
export function fakeClient(
  world: World,
  options: FakeOptions = {}
): { client: SnapshotClient; calls: FakeCalls } {
  const calls: FakeCalls = { mcd: [], synthesis: [], zones: [], cycle: [] };
  const client: SnapshotClient = {
    mcdOutput: {
      findMany: async (args) => {
        calls.mcd.push(args);
        if (options.failMcd) throw new Error('connection refused');
        const rows = world.sensors
          .filter(
            (r) =>
              args.where.symbol === 'XAUUSD' &&
              args.where.cycle_slot === world.slot &&
              (options.ignoreFlagFilter === true || r.flag === args.where.flag)
          )
          .map(({ cycle_slot: _ignored, ...row }) => row);
        return (options.mcd ?? ((r) => r))(rows);
      },
    },
    synthesisReading: {
      findFirst: async (args) => {
        calls.synthesis.push(args);
        if (options.failSynthesis) throw new Error('connection refused');
        const found = world.synthesis.find(
          (r) =>
            args.where.symbol === 'XAUUSD' &&
            args.where.cycle_slot === world.slot &&
            r.profile === args.where.profile &&
            (options.ignoreFlagFilter === true || r.flag === args.where.flag)
        );
        if (found === undefined) return null;
        const { profile: _profile, ...row } = found;
        return (options.synthesis ?? ((r) => r))([row])[0] ?? null;
      },
    },
    entryZone: {
      findMany: async (args) => {
        calls.zones.push(args);
        if (options.failZones) throw new Error('connection refused');
        const found = world.synthesis.find(
          (r) =>
            r.profile === args.where.profile &&
            args.where.cycle_slot === world.slot
        );
        return (options.zones ?? ((r) => r))(
          found === undefined ? [] : zoneRowsOf(found)
        );
      },
    },
    marketCycle: {
      findFirst: async (args) => {
        calls.cycle.push(args);
        if (options.failCycle) throw new Error('connection refused');
        const slot =
          options.newestReady === undefined ? world.slot : options.newestReady;
        return slot === null ? null : { slot };
      },
    },
  };
  return { client, calls };
}

export type GatewayStatus = 'FRESH' | 'DELAYED' | 'STALE' | 'MARKET_CLOSED';

/** The body of the gateway's `GET /api/v1/cycles/current` for a world. */
export function gatewayBody(
  world: World,
  options: { status?: GatewayStatus; retuning?: boolean; cycle?: boolean } = {}
): CurrentCycleResponse {
  const status = options.status ?? 'FRESH';
  const hasCycle = options.cycle !== false;
  return {
    contract: 'cycles-current/1',
    now: world.slot + 120,
    cycle: hasCycle
      ? {
          slot: world.slot,
          status: status === 'DELAYED' ? 'DELAYED' : 'FRESH',
          attempts: 1,
          retuning: options.retuning === true,
          closedBarsDigest: null,
          checkReason: null,
          timings: {
            readyAt: world.slot + 20,
            manifestReceivedAt: world.slot + 10,
            slotToReadySec: 20,
            gatewaySec: 10,
            collectorStartedAt: null,
            collectorValidatedAt: null,
            m5ExportAt: null,
            m15ExportAt: null,
          },
        }
      : null,
    dataStatus: {
      status,
      reason: 'test',
      dataAsOfSlot: hasCycle ? world.slot : null,
      secondsSinceReady: 100,
    },
    activeIndicators: {
      resolvedAtSlot: world.slot,
      basis: 'CYCLE',
      byTimeframe: { M5: null, M15: null },
    },
  };
}

export function depsFor(
  world: World,
  options: FakeOptions & {
    gateway?: GatewayStatus | 'THROWS';
    retuning?: boolean;
    noCycle?: boolean;
  } = {}
): { deps: SnapshotDeps; calls: FakeCalls } {
  const { client, calls } = fakeClient(world, options);
  return {
    calls,
    deps: {
      client,
      fetchCurrentCycle: async () => {
        if (options.gateway === 'THROWS') {
          throw Object.assign(new Error('the gateway could not be reached'), {
            kind: 'UNREACHABLE',
          });
        }
        return gatewayBody(world, {
          status: options.gateway ?? 'FRESH',
          retuning: options.retuning === true,
          cycle: options.noCycle !== true,
        });
      },
    },
  };
}

/**
 * The committed roster with the configured flag of some sensors changed. The committed
 * configuration has every sensor `off` (finding F8); a test that wants a live board draws up
 * the rollout it wants.
 */
export function rosterWith(
  flags: Record<string, 'off' | 'shadow' | 'live'>,
  base: Roster = SENSOR_ROSTER
): Roster {
  return {
    ...base,
    sensors: base.sensors.map((sensor) => ({
      ...sensor,
      flag: flags[sensor.mcd_id] ?? sensor.flag,
    })),
  };
}
