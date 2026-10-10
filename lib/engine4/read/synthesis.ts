/**
 * Read what Engine 4 needs of one stored synthesis reading beyond the columns
 * the offer check reads (`read/cycle.ts`): the rules version and rule id the
 * consent record names, the badge context (the trend relation, the MCD3
 * conflict and whether both channel sensors vote the reading's direction), and
 * the hashes the reading recorded of the stored bundle and of each sensor's
 * reading, so `readStructureLevels` can insist the rows it reads are the ones the
 * reading was made from.
 *
 * The canonical text of the reading (`reading_json`) must hash to the hash stored
 * beside it. The parsed copy (`reading`, JSONB) is never used: only the text that
 * was hashed. If the row is missing, unreadable or fails its hash, the answer is
 * `ok: false` and the reason; nothing is guessed, and the caller does not record
 * a consent against a reading it could not read. Nothing here throws for a
 * database error.
 *
 * @module lib/engine4/read/synthesis
 */

import { createHash } from 'crypto';

import { marketPrisma } from '@/lib/db/market-prisma';

import { badgeContextFromReading, type BadgeContext } from '../badge';
import { SENSORS, isRecord, type SensorId } from '../levels';
import { readSeconds } from '../time';

const DEFAULT_SYMBOL = 'XAUUSD';
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The columns of a `synthesis_readings` row this reader uses. */
export interface SynthesisDetailRow {
  rule_id: string;
  rules_version: string;
  branch_id: string | null;
  flag: string;
  reading_json: string;
  reading_sha256: string;
  inputs_sha256: string | null;
}

/** The one delegate of `marketPrisma` this reader calls: the real one fits with no cast; a test passes its own. */
export interface SynthesisDetailClient {
  synthesisReading: {
    findFirst(args: {
      where: { symbol: string; profile: string; cycle_slot: number };
      select: Record<keyof SynthesisDetailRow, true>;
    }): Promise<SynthesisDetailRow | null>;
  };
}

export interface SynthesisDetailRequest {
  /** DAY_TRADER or SCALPER */
  profile: string;
  /** the pinned cycle's slot, unix UTC seconds */
  cycleSlot: number;
  symbol?: string;
}

export interface SynthesisDetail {
  ruleId: string;
  rulesVersion: string;
  branchId: string | null;
  /** shadow or live: the SYN flag when the row was written */
  flag: string;
  /** null when the reading has no direction */
  badge: BadgeContext | null;
  /** the hash of the cycle's bundle as the reading recorded it */
  inputsSha256: string | null;
  /** each sensor's reading hash as the reading recorded it (null: it recorded none) */
  envelopeSha256: Record<SensorId, string | null>;
}

export type SynthesisDetailProblemCode =
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  | 'READING_TAMPERED'
  | 'READING_UNREADABLE';

export type SynthesisDetailRead =
  | { ok: true; detail: SynthesisDetail }
  | { ok: false; code: SynthesisDetailProblemCode; detail: string };

function fail(
  code: SynthesisDetailProblemCode,
  detail: string
): SynthesisDetailRead {
  return { ok: false, code, detail };
}

/** A hash as the reading records it, or null when it records none; anything else is not a hash. */
function recordedHash(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && SHA256_HEX.test(value)
    ? value
    : undefined;
}

export async function readSynthesisDetail(
  request: SynthesisDetailRequest,
  client: SynthesisDetailClient = {
    synthesisReading: marketPrisma.synthesisReading,
  }
): Promise<SynthesisDetailRead> {
  readSeconds('cycleSlot', request.cycleSlot);
  let row: SynthesisDetailRow | null;
  try {
    row = await client.synthesisReading.findFirst({
      where: {
        symbol: request.symbol ?? DEFAULT_SYMBOL,
        profile: request.profile,
        cycle_slot: request.cycleSlot,
      },
      select: {
        rule_id: true,
        rules_version: true,
        branch_id: true,
        flag: true,
        reading_json: true,
        reading_sha256: true,
        inputs_sha256: true,
      },
    });
  } catch (error) {
    return fail(
      'DATABASE_ERROR',
      `the synthesis reading could not be read: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
  if (row === null) {
    return fail(
      'NOT_FOUND',
      `there is no synthesis reading for cycle ${request.cycleSlot}`
    );
  }
  if (
    typeof row.reading_json !== 'string' ||
    createHash('sha256').update(row.reading_json, 'utf8').digest('hex') !==
      row.reading_sha256
  ) {
    return fail(
      'READING_TAMPERED',
      'the stored reading does not hash to its stored hash'
    );
  }
  let reading: unknown;
  try {
    reading = JSON.parse(row.reading_json);
  } catch {
    return fail('READING_UNREADABLE', 'the stored reading is not JSON');
  }
  if (!isRecord(reading)) {
    return fail('READING_UNREADABLE', 'the stored reading is not an object');
  }
  const inputs = isRecord(reading['inputs']) ? reading['inputs'] : {};
  const envelopeSha256 = {} as Record<SensorId, string | null>;
  for (const sensor of SENSORS) {
    const entry = inputs[sensor];
    const hash = recordedHash(
      isRecord(entry) ? entry['envelope_sha256'] : null
    );
    if (hash === undefined) {
      return fail(
        'READING_UNREADABLE',
        `the reading records a sensor hash for ${sensor} that is not a SHA-256`
      );
    }
    envelopeSha256[sensor] = hash;
  }
  const inputsSha256 = recordedHash(row.inputs_sha256);
  if (inputsSha256 === undefined) {
    return fail(
      'READING_UNREADABLE',
      'the reading records a bundle hash that is not a SHA-256'
    );
  }
  return {
    ok: true,
    detail: {
      ruleId: row.rule_id,
      rulesVersion: row.rules_version,
      branchId: row.branch_id,
      flag: row.flag,
      badge: badgeContextFromReading(reading),
      inputsSha256,
      envelopeSha256,
    },
  };
}
