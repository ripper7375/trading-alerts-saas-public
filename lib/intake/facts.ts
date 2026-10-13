/**
 * What the board and the router need to know of a stored reading (build step 6 part 4).
 *
 * The readers (`read/`) fetch a sensor's envelope (`mcd-output/1`) or the trader's synthesis
 * reading (`syn-output/1`) and check its hash; this file reads the MEANING out of the parsed
 * document: the status, the state code, the bias, the one-line summary, the reasons and the
 * prices of the levels. It applies the same rules the packet validator applies to a board
 * line, so a reading that passes here can be put on the board and into the packet. A reading
 * that does not pass is reported with the reason and is treated by the caller as UNAVAILABLE
 * (a sensor listed as ABSENT; the synthesis as not running): a document nobody can trust is
 * never half used.
 *
 * Pure: no I/O, no clock.
 *
 * @module lib/intake/facts
 */

import { isRecord } from './check';
import {
  BIASES,
  REASON,
  RULE_ID,
  SENSOR_STATUSES,
  STATE_CODE,
  TREND_RELATIONS,
  type Bias,
  type SensorStatus,
  type TrendRelation,
} from './packet';
import {
  SENSOR_ROSTER,
  sensorById,
  type Roster,
  type TraderType,
} from './roster';

/** The longest one-line summary a board line carries (the envelope schema's own limit). */
export const SENSOR_SUMMARY_MAX = 80;
/** The synthesis line may run longer (the packet contract). */
export const SYNTHESIS_SUMMARY_MAX = 120;
export const REASONS_MAX = 12;
const STATE_CODE_MAX = 48;
const RULE_ID_MAX = 60;
const ZONE_ID = /^Z[1-5]$/;
const MCD_ID = /^MCD([0-9]|1[0-5])$/;

export interface SensorFacts {
  mcd_id: string;
  status: SensorStatus;
  /** null exactly when the sensor is INVALID or STALE */
  state_code: string | null;
  /** null exactly when the sensor is INVALID or STALE */
  bias: Bias | null;
  summary: string | null;
  reasons: string[];
  /** the prices of the envelope's levels, in the order it lists them */
  levels: number[];
}

export interface SynthesisFacts {
  profile: TraderType;
  status: SensorStatus;
  rule_id: string;
  bias: Bias;
  trend_relation: TrendRelation | null;
  summary: string;
  /** the close of the last closed M5 bar of the stored reading; null when it had none */
  reference_price: number | null;
  /** the sensors that supplied the entry zones (the union over the zones), in id order */
  zone_sources: string[];
  /** the reference price of the first zone: the entry the reading proposes; null with no zones */
  entry_price: number | null;
}

/** MCD ids without repeats or strangers, in ascending order of the MCD number. */
export function orderedMcdIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)]
    .filter((id) => MCD_ID.test(id))
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
}

export type FactsResult<T> =
  | { ok: true; facts: T }
  | { ok: false; reason: string };

const fail = (reason: string): { ok: false; reason: string } => ({
  ok: false,
  reason,
});

/** A usable sensor: it says something (VALID or CAUTIONARY). INVALID and STALE are unavailable. */
export function isUsable(status: SensorStatus | 'ABSENT'): boolean {
  return status === 'VALID' || status === 'CAUTIONARY';
}

const inList = <T extends string>(
  list: readonly T[],
  value: unknown
): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

function reasonsOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > REASONS_MAX) return undefined;
  const out: string[] = [];
  for (const reason of value) {
    if (typeof reason !== 'string' || !REASON.test(reason)) return undefined;
    out.push(reason);
  }
  return out;
}

function levelPrices(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: number[] = [];
  for (const level of value) {
    if (!isRecord(level)) return undefined;
    const price = level['price'];
    if (typeof price !== 'number' || !Number.isFinite(price)) return undefined;
    out.push(price);
  }
  return out;
}

/**
 * The facts of a sensor's envelope for the cycle `slot`. The document must be the sensor's
 * own (`mcd_id`), of that cycle, with a status the packet knows, and a board line that the
 * packet validator will accept: state code and bias exactly when the sensor is usable, a
 * state code that belongs to the sensor, a summary of at most 80 characters, and a reason
 * for every status but VALID.
 */
export function sensorFactsOf(
  envelope: unknown,
  expected: { mcd_id: string; slot: string },
  roster: Roster = SENSOR_ROSTER
): FactsResult<SensorFacts> {
  if (!isRecord(envelope)) return fail('the envelope is not an object');
  if (envelope['schema_version'] !== 'mcd-output/1') {
    return fail('the envelope is not mcd-output/1');
  }
  if (envelope['mcd_id'] !== expected.mcd_id) {
    return fail(
      `the envelope names ${String(envelope['mcd_id'])}, not ${expected.mcd_id}`
    );
  }
  if (envelope['cycle_slot'] !== expected.slot) {
    return fail(
      `the envelope is of cycle ${String(envelope['cycle_slot'])}, not ${expected.slot}`
    );
  }
  const status = envelope['status'];
  if (!inList(SENSOR_STATUSES, status))
    return fail('the status is not one the board knows');
  const reasons = reasonsOf(envelope['status_reasons']);
  if (reasons === undefined)
    return fail('the reasons are not a list of reason codes');
  if (status !== 'VALID' && reasons.length === 0) {
    return fail(`a ${status} reading gives no reason`);
  }
  const levels = levelPrices(envelope['levels']);
  if (levels === undefined) return fail('the levels are not a list of prices');
  const summary = envelope['summary_line'];
  if (
    typeof summary !== 'string' ||
    summary.length === 0 ||
    summary.length > SENSOR_SUMMARY_MAX
  ) {
    return fail(`the summary is not 1 to ${SENSOR_SUMMARY_MAX} characters`);
  }

  if (isUsable(status)) {
    const code = envelope['state_code'];
    if (
      typeof code !== 'string' ||
      code.length > STATE_CODE_MAX ||
      !STATE_CODE.test(code)
    ) {
      return fail('the state code is missing or malformed');
    }
    const known = sensorById(expected.mcd_id, roster);
    if (known === undefined || !known.state_codes.includes(code)) {
      return fail(`${code} is not a state of ${expected.mcd_id}`);
    }
    const bias = envelope['bias'];
    if (!inList(BIASES, bias)) return fail('the bias is missing or unknown');
    return {
      ok: true,
      facts: {
        mcd_id: expected.mcd_id,
        status,
        state_code: code,
        bias,
        summary,
        reasons,
        levels,
      },
    };
  }

  if (envelope['state_code'] !== null || envelope['bias'] !== null) {
    return fail(`a ${status} reading has a state code or a bias`);
  }
  return {
    ok: true,
    facts: {
      mcd_id: expected.mcd_id,
      status,
      state_code: null,
      bias: null,
      summary,
      reasons,
      levels,
    },
  };
}

function sourcesOf(zone: Record<string, unknown>): string[] | undefined {
  const sources = zone['source_sensors'];
  if (!Array.isArray(sources)) return undefined;
  const out: string[] = [];
  for (const id of sources) {
    if (typeof id !== 'string' || !MCD_ID.test(id)) return undefined;
    out.push(id);
  }
  return out;
}

/**
 * The facts of the trader's synthesis reading (`syn-output/1`) and of its entry zones for
 * the cycle `slot`. `zones` are the zone documents the worker stored beside the reading, in
 * rank order, and `referencePrice` the column of the same name. The zones must be the ones
 * the reading names, in the same order.
 */
export function synthesisFactsOf(
  reading: unknown,
  zones: readonly unknown[],
  referencePrice: number | null,
  expected: { profile: TraderType; slot: string }
): FactsResult<SynthesisFacts> {
  if (!isRecord(reading)) return fail('the reading is not an object');
  if (reading['schema_version'] !== 'syn-output/1') {
    return fail('the reading is not syn-output/1');
  }
  if (reading['mcd_id'] !== 'SYN') return fail('the reading is not SYN');
  if (reading['profile'] !== expected.profile) {
    return fail(
      `the reading is of ${String(reading['profile'])}, not ${expected.profile}`
    );
  }
  if (reading['cycle_slot'] !== expected.slot) {
    return fail(
      `the reading is of cycle ${String(reading['cycle_slot'])}, not ${expected.slot}`
    );
  }
  const status = reading['status'];
  if (!inList(SENSOR_STATUSES, status))
    return fail('the status is not one the board knows');
  const ruleId = reading['rule_id'];
  if (
    typeof ruleId !== 'string' ||
    ruleId.length > RULE_ID_MAX ||
    !RULE_ID.test(ruleId)
  ) {
    return fail('the rule id is missing or malformed');
  }
  const bias = reading['bias'];
  if (!inList(BIASES, bias)) return fail('the bias is missing or unknown');
  const relation = reading['trend_relation'];
  if (relation !== null && !inList(TREND_RELATIONS, relation)) {
    return fail('the trend relation is unknown');
  }
  const summary = reading['summary_line'];
  if (
    typeof summary !== 'string' ||
    summary.length === 0 ||
    summary.length > SYNTHESIS_SUMMARY_MAX
  ) {
    return fail(`the summary is not 1 to ${SYNTHESIS_SUMMARY_MAX} characters`);
  }
  if (
    referencePrice !== null &&
    !(
      typeof referencePrice === 'number' &&
      Number.isFinite(referencePrice) &&
      referencePrice > 0
    )
  ) {
    return fail('the reference price is not a positive number');
  }

  const named = reading['zones'];
  if (!Array.isArray(named)) return fail('the reading does not list its zones');
  const sources = new Set<string>();
  const ids: string[] = [];
  let entry: number | null = null;
  for (const raw of zones) {
    if (!isRecord(raw)) return fail('a zone is not an object');
    const id = raw['zone_id'];
    if (typeof id !== 'string' || !ZONE_ID.test(id))
      return fail('a zone has no valid id');
    ids.push(id);
    const zoneSources = sourcesOf(raw);
    if (zoneSources === undefined)
      return fail(`${id} does not name its source sensors`);
    for (const source of zoneSources) sources.add(source);
    const price = raw['reference_price'];
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      return fail(`${id} has no valid reference price`);
    }
    if (entry === null) entry = price;
  }
  if (named.length !== ids.length || named.some((id, i) => id !== ids[i])) {
    return fail(
      'the zones are not the ones the reading names, in the same order'
    );
  }

  return {
    ok: true,
    facts: {
      profile: expected.profile,
      status,
      rule_id: ruleId,
      bias,
      trend_relation: relation,
      summary,
      reference_price: referencePrice,
      zone_sources: orderedMcdIds(sources),
      entry_price: entry,
    },
  };
}
