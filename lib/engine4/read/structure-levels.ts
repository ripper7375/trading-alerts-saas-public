/**
 * Read the structure levels of a cycle from what the sensor worker stored
 * (plan section 3, decision D6 (a)): the channel levels from the sensors'
 * readings in `mcd_outputs`, and the support and resistance levels from the
 * `context_levels` of the cycle's bundle in `market_cycle_inputs`.
 *
 * Nothing here trusts what it reads. A reading's canonical text must hash to the
 * hash stored beside it; the bundle, once decompressed, must hash to its
 * `inputs_sha256` and be as long as `bundle_bytes` says; every row of the cycle
 * must name the same inputs; and when the caller passes the hashes the SYN
 * reading recorded (`inputs_sha256`, and each sensor's `envelope_sha256`), the
 * rows must be those.
 *
 * If anything is missing, expired (the bundle is deleted after 90 days), unreadable
 * or fails a hash, the result is NOT partial: `complete` is false, `levels` is
 * empty and `problems` says why. The caller then offers only the zone's own
 * invalidation (`buildStopChoices`). A level is never guessed. This function
 * never throws for a bad cycle or a database error; it reports them.
 *
 * A sensor whose reading is INVALID or STALE is not a problem: it simply gives
 * no level (`isAvailableReading`).
 *
 * @module lib/engine4/read/structure-levels
 */

import { createHash } from 'crypto';
import { gunzipSync } from 'zlib';

import { marketPrisma } from '@/lib/db/market-prisma';

import { Engine4InputError } from '../types';
import { readPositive } from '../exact';
import {
  SENSORS,
  isAvailableReading,
  isRecord,
  levelsFromReadings,
  srLevelsFromContext,
  type SensorId,
  type StructureProblem,
  type StructureRead,
} from '../levels';

/** `market_cycle_inputs` keeps a bundle for 90 days (step 3, part 4). */
export const BUNDLE_RETENTION_SECONDS = 7_776_000n;
/** A bundle is about 0.5 to 1.2 MB of text; this stops a hostile or broken one from filling memory. */
const MAX_BUNDLE_BYTES = 67_108_864;
const DEFAULT_SYMBOL = 'XAUUSD';

/** The columns of an `mcd_outputs` row this reader uses. */
export interface McdOutputRow {
  mcd_id: string;
  status: string;
  envelope_json: string;
  envelope_sha256: string;
  inputs_sha256: string | null;
}

/** The columns of a `market_cycle_inputs` row this reader uses. */
export interface CycleInputRow {
  bundle_gz: Uint8Array;
  bundle_encoding: string;
  bundle_bytes: number;
  inputs_sha256: string;
}

/** The two delegates of `marketPrisma` this reader calls (a test passes its own). */
export interface StructureClient {
  mcdOutput: {
    findMany(args: {
      where: {
        symbol: string;
        cycle_slot: number;
        mcd_id: { in: string[] };
      };
      select: Record<keyof McdOutputRow, true>;
    }): Promise<McdOutputRow[]>;
  };
  marketCycleInput: {
    findFirst(args: {
      where: { symbol: string; cycle_slot: number };
      select: Record<keyof CycleInputRow, true>;
    }): Promise<CycleInputRow | null>;
  };
}

export interface StructureRequest {
  /** the cycle's slot, unix UTC seconds: the zone's `cycle_slot` */
  cycleSlot: number;
  /** the clock, unix UTC seconds; passed in so the reader holds no clock of its own */
  nowSeconds: number;
  symbol?: string;
  /** the `inputs_sha256` of the zone's SYN reading, when known */
  expectedInputsSha256?: string | null;
  /** each sensor's `envelope_sha256` as the SYN reading recorded it (`inputs.MCDn.envelope_sha256`) */
  expectedEnvelopeSha256?: Partial<Record<SensorId, string | null>>;
}

export interface StructureSensorInfo {
  mcdId: string;
  status: string;
  /** the reading gave levels: VALID or CAUTIONARY and well formed */
  available: boolean;
  envelopeSha256: string;
}

export interface StructureReadResult extends StructureRead {
  sensors: StructureSensorInfo[];
  /** the bundle's own `inputs_sha256`, when a bundle row was found */
  inputsSha256: string | null;
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function integerSeconds(field: string, value: number): bigint {
  const parsed = readPositive(field, value);
  if (!parsed.isInteger()) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `${field} must be a whole number of seconds`,
      field
    );
  }
  return parsed.num;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/**
 * Read the levels behind a zone. `client` defaults to `marketPrisma`; a test
 * hands in its own.
 */
export async function readStructureLevels(
  request: StructureRequest,
  client: StructureClient = marketPrisma as unknown as StructureClient
): Promise<StructureReadResult> {
  const slot = integerSeconds('cycleSlot', request.cycleSlot);
  const now = integerSeconds('nowSeconds', request.nowSeconds);
  const symbol = request.symbol ?? DEFAULT_SYMBOL;
  const problems: StructureProblem[] = [];
  const problem = (
    code: StructureProblem['code'],
    detail: string,
    mcdId?: string
  ): void => {
    problems.push(
      mcdId === undefined ? { code, detail } : { code, detail, mcdId }
    );
  };

  // -- the sensors' readings --------------------------------------------------
  let rows: McdOutputRow[] = [];
  let readFailed = false;
  try {
    rows = await client.mcdOutput.findMany({
      where: {
        symbol,
        cycle_slot: request.cycleSlot,
        mcd_id: { in: [...SENSORS] },
      },
      select: {
        mcd_id: true,
        status: true,
        envelope_json: true,
        envelope_sha256: true,
        inputs_sha256: true,
      },
    });
  } catch (error) {
    readFailed = true;
    problem(
      'DATABASE_ERROR',
      `the sensor readings could not be read: ${messageOf(error)}`
    );
  }

  const readings: Record<string, unknown> = {};
  const sensors: StructureSensorInfo[] = [];
  const rowInputs = new Set<string>();
  for (const row of rows) {
    if (!(SENSORS as readonly string[]).includes(row.mcd_id)) continue;
    const info: StructureSensorInfo = {
      mcdId: row.mcd_id,
      status: row.status,
      available: false,
      envelopeSha256: row.envelope_sha256,
    };
    sensors.push(info);
    if (row.inputs_sha256 !== null) rowInputs.add(row.inputs_sha256);

    if (
      typeof row.envelope_json !== 'string' ||
      sha256Hex(row.envelope_json) !== row.envelope_sha256
    ) {
      problem(
        'SENSOR_READING_TAMPERED',
        'the stored reading does not hash to its stored hash',
        row.mcd_id
      );
      continue;
    }
    const expected =
      request.expectedEnvelopeSha256?.[row.mcd_id as SensorId] ?? null;
    if (expected !== null && expected !== row.envelope_sha256) {
      problem(
        'SENSOR_READING_MISMATCH',
        'the stored reading is not the one the synthesis reading was made from',
        row.mcd_id
      );
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.envelope_json);
    } catch {
      problem(
        'SENSOR_READING_UNREADABLE',
        'the stored reading is not JSON',
        row.mcd_id
      );
      continue;
    }
    if (!isRecord(parsed)) {
      problem(
        'SENSOR_READING_UNREADABLE',
        'the stored reading is not an object',
        row.mcd_id
      );
      continue;
    }
    readings[row.mcd_id] = parsed;
    info.available = isAvailableReading(parsed);
  }
  if (!readFailed && sensors.length === 0) {
    problem('NO_SENSOR_READINGS', 'no sensor reading is stored for this cycle');
  }
  for (const sensor of SENSORS) {
    const expected = request.expectedEnvelopeSha256?.[sensor] ?? null;
    if (
      expected !== null &&
      !readFailed &&
      !sensors.some((info) => info.mcdId === sensor)
    ) {
      problem(
        'SENSOR_READING_MISSING',
        'the synthesis reading used this sensor but no reading of it is stored',
        sensor
      );
    }
  }

  // -- the cycle's bundle ------------------------------------------------------
  let bundleRow: CycleInputRow | null = null;
  let bundleFailed = false;
  try {
    bundleRow = await client.marketCycleInput.findFirst({
      where: { symbol, cycle_slot: request.cycleSlot },
      select: {
        bundle_gz: true,
        bundle_encoding: true,
        bundle_bytes: true,
        inputs_sha256: true,
      },
    });
  } catch (error) {
    bundleFailed = true;
    problem(
      'DATABASE_ERROR',
      `the cycle's bundle could not be read: ${messageOf(error)}`
    );
  }

  let context: unknown;
  let inputsSha256: string | null = null;
  if (bundleRow === null) {
    if (!bundleFailed) {
      // no row for a cycle older than the retention is the clean-up's doing, not a loss
      const expired = now - slot > BUNDLE_RETENTION_SECONDS;
      problem(
        expired ? 'BUNDLE_EXPIRED' : 'BUNDLE_MISSING',
        expired
          ? 'the cycle is older than the 90 days a bundle is kept'
          : 'no bundle is stored for this cycle'
      );
    }
  } else if (bundleRow.bundle_encoding !== 'gzip') {
    problem(
      'BUNDLE_ENCODING',
      `the bundle is stored as ${String(bundleRow.bundle_encoding)}, not gzip`
    );
  } else {
    let text: Buffer | null = null;
    try {
      text = gunzipSync(Buffer.from(bundleRow.bundle_gz), {
        maxOutputLength: MAX_BUNDLE_BYTES,
      });
    } catch (error) {
      problem(
        'BUNDLE_UNREADABLE',
        `the bundle cannot be decompressed: ${messageOf(error)}`
      );
    }
    if (text !== null) {
      inputsSha256 = bundleRow.inputs_sha256;
      if (sha256Hex(text) !== bundleRow.inputs_sha256) {
        problem(
          'BUNDLE_TAMPERED',
          'the decompressed bundle does not hash to its stored hash'
        );
      } else if (text.length !== bundleRow.bundle_bytes) {
        problem(
          'BUNDLE_SIZE_MISMATCH',
          'the decompressed bundle is not as long as bundle_bytes says'
        );
      } else {
        try {
          const bundle: unknown = JSON.parse(text.toString('utf8'));
          if (isRecord(bundle)) context = bundle['context_levels'];
          else problem('BUNDLE_UNREADABLE', 'the bundle is not an object');
        } catch {
          problem('BUNDLE_UNREADABLE', 'the bundle is not JSON');
        }
      }
      const expected = request.expectedInputsSha256 ?? null;
      if (expected !== null && expected !== bundleRow.inputs_sha256) {
        problem(
          'INPUTS_MISMATCH',
          'the stored bundle is not the one the synthesis reading was made from'
        );
      }
      for (const other of rowInputs) {
        if (other !== bundleRow.inputs_sha256) {
          problem(
            'INPUTS_MISMATCH',
            'a sensor reading was made from another bundle than the one stored'
          );
          break;
        }
      }
    }
  }

  const complete = problems.length === 0;
  return {
    complete,
    levels: complete
      ? [...levelsFromReadings(readings), ...srLevelsFromContext(context)]
      : [],
    problems,
    sensors,
    inputsSha256,
  };
}
