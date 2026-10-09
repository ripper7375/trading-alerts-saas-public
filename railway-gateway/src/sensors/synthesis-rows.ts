import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import {
  type CycleRunResult,
  type SynthesisProfileResult,
  type SynthesisRunResult,
  synthesisSectionProblems,
} from './cycle-run-result';
import { slotToIso } from './inputs/stats-slot';
import { type SynReadingCheck } from './syn-validator';

/**
 * The rows of `synthesis_readings` and `entry_zones` (build step 4 part 5), made from the `synthesis` section of
 * a runner result, and the TypeScript twin of every CHECK constraint the migration
 * `20261004000000_add_synthesis_tables` puts on them.
 *
 * WHY A TWIN. Decision 3 of the part 4 hand-off (approved): SYN rows are written in the same transaction as the
 * cycle's `mcd_outputs` rows, and a failing CHECK fails the whole transaction. A SYN row that breaks one would
 * therefore lose the sensors' rows too, which is the opposite of what the runner guarantees (a bug in synthesis
 * can only cost SYN rows). So nothing reaches the transaction that this file has not already judged: every rule the
 * database would apply to a row is applied here first, under the SAME NAME as the constraint, and a profile whose
 * rows fail any of them is left out whole (its reading and its zones) while the sensors' rows and the other profile
 * are written. The database stays what it was meant to be: a last line of defence that should never fire.
 *
 * The twin must not drift from the migration. `test/sensors-synthesis-rows.spec.ts` compares the list of names with
 * the migration's, and `test/sensors-synthesis.pg.spec.ts` (gated) feeds both the same rows, damaged one rule at a
 * time, and requires that whatever the database refuses this refuses first, under the same name.
 *
 * These constants are decisions (a stop of at least 13, five zones, half a cent), not tuning: they are the
 * migration's, and `zone_params.yaml` holds the same 13 and 5. A spec compares all three places.
 */

export const SYNTHESIS_PROFILES = ['DAY_TRADER', 'SCALPER'] as const;
export const MAX_ZONES = 5;
export const MIN_STOP_DISTANCE = 13;
/** Prices are on a cent grid, so a difference of less than half a cent is the same figure in DOUBLE PRECISION. */
export const PRICE_TOLERANCE = 0.005;
export const INVALIDATION_BASES = [
  'LEVEL',
  'MINIMUM_STOP',
  'NO_LEVEL',
] as const;
const DIRECTIONS = ['LONG', 'SHORT'] as const;
const FLAGS = ['shadow', 'live'] as const;

type Json = Prisma.InputJsonValue;
type Doc = Record<string, unknown>;

/** A row of `synthesis_readings`, as Prisma takes it (`id` and `created_at` are the database's). */
export interface SynthesisReadingRow {
  symbol: string;
  cycle_slot: number;
  profile: string;
  flag: string;
  rules_version: string;
  rules_sha256: string;
  rule_id: string;
  branch_id: string | null;
  status: string;
  status_reasons: string[];
  data_status: string;
  archetype: string | null;
  bias: string;
  trend_relation: string | null;
  stand_aside: boolean;
  reading_json: string;
  reading: Json;
  reading_sha256: string;
  zone_count: number;
  zones_reason: string | null;
  zones_json: string;
  zones_sha256: string;
  zone_params_version: string;
  zone_params_sha256: string;
  reference_price: number | null;
  guard_problems: string[];
  inputs_sha256: string | null;
  retuning_observed: boolean;
  retuning_applied: boolean;
  runner_version: string;
  python_version: string;
  duration_ms: number;
  evaluated_at: number;
}

/** A row of `entry_zones`, as Prisma takes it. */
export interface EntryZoneRow {
  symbol: string;
  cycle_slot: number;
  profile: string;
  zone_id: string;
  rank: number;
  bias: string;
  low: number;
  high: number;
  reference_price: number;
  source_sensors: string[];
  confluence_count: number;
  invalidation_price: number;
  invalidation_basis: string;
  stop_distance: number;
  next_opposing_price: number | null;
  runway: number | null;
  runway_ratio: number | null;
  levels: Json;
  zone_params_version: string;
  zone_params_sha256: string;
}

/** The names of the 11 CHECK constraints of `synthesis_readings`, in the migration's order. */
export const READING_CHECKS = [
  'synthesis_readings_flag_is_shadow_or_live',
  'synthesis_readings_profile_is_known',
  'synthesis_readings_stand_aside_is_the_bias',
  'synthesis_readings_zone_count_range',
  'synthesis_readings_zones_need_a_direction',
  'synthesis_readings_zones_reason_follows_the_count',
  'synthesis_readings_list_columns_not_null',
  'synthesis_readings_reasons_follow_the_status',
  'synthesis_readings_reading_text_is_its_copy_and_hash',
  'synthesis_readings_zones_text_is_its_count_and_hash',
  'synthesis_readings_columns_repeat_the_reading',
] as const;

/** The names of the 14 CHECK constraints of `entry_zones`, in the migration's order. */
export const ZONE_CHECKS = [
  'entry_zones_profile_is_known',
  'entry_zones_bias_is_a_direction',
  'entry_zones_rank_and_id',
  'entry_zones_prices_are_positive',
  'entry_zones_reference_price_is_inside_the_zone',
  'entry_zones_invalidation_is_beyond_the_reference_price',
  'entry_zones_stop_distance_is_at_least_13',
  'entry_zones_stop_distance_is_the_distance',
  'entry_zones_invalidation_basis_is_known',
  'entry_zones_sources_not_empty',
  'entry_zones_confluence_at_least_the_source',
  'entry_zones_runway_is_all_or_nothing',
  'entry_zones_runway_is_the_distance_to_the_opposing_level',
  'entry_zones_levels_match_the_columns',
] as const;

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const isRecord = (value: unknown): value is Doc =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** JSON with the keys of every object sorted: two documents are the same document when this is the same text (JSONB has no key order). */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    isRecord(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        )
      : inner
  );
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------- the twins of the CHECK constraints

/** A name and a sentence, the way every problem here is written. */
const issue = (name: string, what: string): string => `${name}: ${what}`;

/** Every CHECK of `synthesis_readings` that `row` would break. Empty list = the database would accept it. */
export function readingRowProblems(row: SynthesisReadingRow): string[] {
  const out: string[] = [];
  const push = (name: (typeof READING_CHECKS)[number], what: string) =>
    out.push(issue(name, what));

  if (!(FLAGS as readonly string[]).includes(row.flag))
    push(READING_CHECKS[0], `flag is ${String(row.flag)}, not shadow or live`);
  if (!(SYNTHESIS_PROFILES as readonly string[]).includes(row.profile))
    push(READING_CHECKS[1], `profile is ${String(row.profile)}`);
  if (row.stand_aside !== (row.bias === 'STAND_ASIDE'))
    push(
      READING_CHECKS[2],
      `stand_aside is ${String(row.stand_aside)} but bias is ${String(row.bias)}`
    );
  if (
    !Number.isInteger(row.zone_count) ||
    row.zone_count < 0 ||
    row.zone_count > MAX_ZONES
  )
    push(
      READING_CHECKS[3],
      `zone_count ${String(row.zone_count)} is not 0 to ${MAX_ZONES}`
    );
  if (
    row.zone_count !== 0 &&
    !(DIRECTIONS as readonly string[]).includes(row.bias)
  )
    push(
      READING_CHECKS[4],
      `${String(row.zone_count)} zones for a reading with bias ${String(row.bias)}`
    );
  if (row.zone_count > 0 !== (row.zones_reason === null))
    push(
      READING_CHECKS[5],
      `${String(row.zone_count)} zones with zones_reason ${String(row.zones_reason)}`
    );
  if (!Array.isArray(row.status_reasons) || !Array.isArray(row.guard_problems))
    push(READING_CHECKS[6], 'a list column is not a list');
  if (
    Array.isArray(row.status_reasons) &&
    (row.status === 'VALID') !== (row.status_reasons.length === 0)
  )
    push(
      READING_CHECKS[7],
      `status ${String(row.status)} with ${row.status_reasons.length} reasons`
    );

  const parsedReading = parseJson(row.reading_json);
  if (
    !parsedReading.ok ||
    canonical(parsedReading.value) !== canonical(row.reading) ||
    sha256(row.reading_json) !== row.reading_sha256
  )
    push(
      READING_CHECKS[8],
      !parsedReading.ok
        ? 'reading_json is not JSON'
        : canonical(parsedReading.value) !== canonical(row.reading)
          ? 'the JSONB copy is not the document of reading_json'
          : 'reading_sha256 is not the SHA-256 of reading_json'
    );

  const parsedZones = parseJson(row.zones_json);
  if (
    !parsedZones.ok ||
    !Array.isArray(parsedZones.value) ||
    parsedZones.value.length !== row.zone_count ||
    sha256(row.zones_json) !== row.zones_sha256
  )
    push(
      READING_CHECKS[9],
      'zones_json is not a list of zone_count rows hashing to zones_sha256'
    );

  const reading = parsedReading.ok ? parsedReading.value : undefined;
  if (!isRecord(reading) || !readingColumnsRepeat(row, reading))
    push(READING_CHECKS[10], 'a column differs from the reading it repeats');
  return out;
}

/** True when every column that repeats a field of the reading equals it (the twin of `synthesis_readings_columns_repeat_the_reading`). */
function readingColumnsRepeat(row: SynthesisReadingRow, reading: Doc): boolean {
  const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
  const nullable = (value: unknown) => (value === undefined ? null : value);
  return (
    reading['profile'] === row.profile &&
    typeof row.cycle_slot === 'number' &&
    Number.isInteger(row.cycle_slot) &&
    reading['cycle_slot'] === slotToIsoSafe(row.cycle_slot) &&
    reading['rules_version'] === row.rules_version &&
    reading['rules_sha256'] === row.rules_sha256 &&
    reading['rule_id'] === row.rule_id &&
    nullable(reading['branch_id']) === row.branch_id &&
    reading['status'] === row.status &&
    same(reading['status_reasons'], row.status_reasons) &&
    reading['data_status'] === row.data_status &&
    nullable(reading['archetype']) === row.archetype &&
    reading['bias'] === row.bias &&
    nullable(reading['trend_relation']) === row.trend_relation &&
    reading['stand_aside'] === row.stand_aside &&
    Array.isArray(reading['zones']) &&
    reading['zones'].length === row.zone_count
  );
}

function slotToIsoSafe(slot: number): string | null {
  try {
    return slotToIso(slot);
  } catch {
    return null;
  }
}

/** Every CHECK of `entry_zones` that `row` would break. Empty list = the database would accept it. */
export function zoneRowProblems(row: EntryZoneRow): string[] {
  const out: string[] = [];
  const push = (name: (typeof ZONE_CHECKS)[number], what: string) =>
    out.push(issue(name, what));
  const { low, high, reference_price: ref, invalidation_price: inv } = row;
  const stop = row.stop_distance;

  if (!(SYNTHESIS_PROFILES as readonly string[]).includes(row.profile))
    push(ZONE_CHECKS[0], `profile is ${String(row.profile)}`);
  if (!(DIRECTIONS as readonly string[]).includes(row.bias))
    push(ZONE_CHECKS[1], `bias is ${String(row.bias)}`);
  if (
    !Number.isInteger(row.rank) ||
    row.rank < 1 ||
    row.rank > MAX_ZONES ||
    row.zone_id !== `Z${String(row.rank)}`
  )
    push(
      ZONE_CHECKS[2],
      `rank ${String(row.rank)} with zone_id ${String(row.zone_id)}`
    );
  if (![low, high, ref, inv].every((price) => isNumber(price) && price > 0))
    push(ZONE_CHECKS[3], 'a price is not above zero');
  if (
    !(
      isNumber(low) &&
      isNumber(ref) &&
      isNumber(high) &&
      low <= ref &&
      ref <= high
    )
  )
    push(ZONE_CHECKS[4], 'the reference price is not inside the zone');
  if (
    !(
      (row.bias === 'LONG' && isNumber(inv) && isNumber(ref) && inv < ref) ||
      (row.bias === 'SHORT' && isNumber(inv) && isNumber(ref) && inv > ref)
    )
  )
    push(
      ZONE_CHECKS[5],
      'the invalidation is not on the far side of the reference price'
    );
  if (!(isNumber(stop) && stop >= MIN_STOP_DISTANCE))
    push(
      ZONE_CHECKS[6],
      `stop distance ${String(stop)} is under ${MIN_STOP_DISTANCE}`
    );
  if (
    !(
      isNumber(ref) &&
      isNumber(inv) &&
      isNumber(stop) &&
      Math.abs(Math.abs(ref - inv) - stop) < PRICE_TOLERANCE
    )
  )
    push(
      ZONE_CHECKS[7],
      'the stop distance is not the distance from the reference price to the invalidation'
    );
  if (
    !(INVALIDATION_BASES as readonly string[]).includes(row.invalidation_basis)
  )
    push(
      ZONE_CHECKS[8],
      `invalidation_basis is ${String(row.invalidation_basis)}`
    );
  if (!Array.isArray(row.source_sensors) || row.source_sensors.length < 1)
    push(ZONE_CHECKS[9], 'a zone needs at least one source sensor');
  if (!Number.isInteger(row.confluence_count) || row.confluence_count < 1)
    push(
      ZONE_CHECKS[10],
      `confluence_count is ${String(row.confluence_count)}`
    );

  const opposing = row.next_opposing_price;
  const runway = row.runway;
  const ratio = row.runway_ratio;
  if (
    !(
      (opposing === null) === (runway === null) &&
      (runway === null) === (ratio === null) &&
      (runway === null ||
        (isNumber(runway) && runway > 0 && isNumber(ratio) && ratio >= 0))
    )
  )
    push(
      ZONE_CHECKS[11],
      'the opposing price, the runway and the ratio are not all there or all missing, or are out of range'
    );
  if (opposing !== null) {
    const beyond =
      isNumber(opposing) &&
      isNumber(ref) &&
      ((row.bias === 'LONG' && opposing > ref) ||
        (row.bias === 'SHORT' && opposing < ref));
    const distance =
      isNumber(opposing) &&
      isNumber(ref) &&
      isNumber(runway) &&
      Math.abs(Math.abs(opposing - ref) - runway) < PRICE_TOLERANCE;
    if (!(beyond && distance))
      push(
        ZONE_CHECKS[12],
        'the opposing level is not beyond the reference price, or the runway is not its distance'
      );
  }

  const levels: unknown = row.levels;
  const levelsOk =
    isRecord(levels) &&
    [
      'source_levels',
      'confluence_levels',
      'invalidation_level',
      'next_opposing_level',
    ].every((key) => key in levels) &&
    Array.isArray(levels['confluence_levels']) &&
    levels['confluence_levels'].length === row.confluence_count &&
    (levels['next_opposing_level'] === null) === (opposing === null) &&
    (levels['invalidation_level'] === null) ===
      (row.invalidation_basis === 'NO_LEVEL');
  if (!levelsOk)
    push(
      ZONE_CHECKS[13],
      'the audit document is missing a part or disagrees with the columns'
    );
  return out;
}

// ---------------------------------------------------------------- making the rows

/** Why one trader type's reading and zones were left out (never the sensors' rows). */
export interface SynthesisRefusal {
  /** DAY_TRADER, SCALPER, or ALL when the whole `synthesis` section could not be read. */
  profile: string;
  /** ENGINE: the engine withheld the reading (its own guard). GATEWAY: this check refused it. */
  source: 'ENGINE' | 'GATEWAY';
  problems: string[];
}

export interface PreparedSynthesis {
  /** Whether the result carried a `synthesis` section at all (false: the `SYN` flag is off; nothing to write, nothing to log). */
  ran: boolean;
  readings: SynthesisReadingRow[];
  zones: EntryZoneRow[];
  refused: SynthesisRefusal[];
  /** The engine's `synthesis.error` (`SYNTHESIS_ERROR`), if synthesis raised. */
  error: string | null;
}

export interface SynthesisContext {
  symbol: string;
  slot: number;
  result: CycleRunResult;
  evaluatedAt: number;
  /** `SynReadingValidator.check`: the schema, applied to the text. */
  checkReading: (readingJson: string) => SynReadingCheck;
}

const NOTHING: PreparedSynthesis = {
  ran: false,
  readings: [],
  zones: [],
  refused: [],
  error: null,
};

/**
 * The rows a result's synthesis section makes, each judged before it is offered to a transaction. A profile is
 * all or nothing: its reading and its zones are kept together or left out together (a zone only means
 * something beside its reading). Never throws and never touches a database.
 */
export function prepareSynthesis(context: SynthesisContext): PreparedSynthesis {
  const { result } = context;
  if (result.synthesis === undefined) return NOTHING;
  const section = result.synthesis as unknown;
  const shape = synthesisSectionProblems(section);
  if (shape.length > 0)
    return {
      ran: true,
      readings: [],
      zones: [],
      refused: [{ profile: 'ALL', source: 'GATEWAY', problems: shape }],
      error: null,
    };
  const synthesis = section as SynthesisRunResult;
  const prepared: PreparedSynthesis = {
    ran: true,
    readings: [],
    zones: [],
    refused: [],
    error: synthesis.error,
  };
  if (synthesis.error !== null) return prepared; // the engine said it raised: there are no readings to look at
  for (const profileResult of synthesis.readings) {
    const made = profileRows(context, synthesis, profileResult);
    if (made.problems.length > 0) {
      prepared.refused.push({
        profile: profileResult.profile,
        source: made.engineRefused ? 'ENGINE' : 'GATEWAY',
        problems: made.problems,
      });
      continue;
    }
    prepared.readings.push(made.reading!);
    prepared.zones.push(...made.zones);
  }
  return prepared;
}

interface ProfileRows {
  reading?: SynthesisReadingRow;
  zones: EntryZoneRow[];
  problems: string[];
  engineRefused: boolean;
}

function profileRows(
  context: SynthesisContext,
  synthesis: SynthesisRunResult,
  profileResult: SynthesisProfileResult
): ProfileRows {
  const { symbol, slot, result, evaluatedAt } = context;
  const where = profileResult.profile;
  const isoSlot = slotToIso(slot);
  const fail = (problems: string[], engineRefused = false): ProfileRows => ({
    zones: [],
    problems,
    engineRefused,
  });

  if (
    profileResult.reading_json === null ||
    profileResult.reading_sha256 === null
  )
    return fail(
      [
        `${where}: the engine withheld the reading`,
        ...profileResult.guard_problems,
      ],
      true
    );
  if (!(SYNTHESIS_PROFILES as readonly string[]).includes(where))
    return fail([`${where}: not a trader type`]);

  const problems: string[] = [];
  if (sha256(profileResult.reading_json) !== profileResult.reading_sha256)
    problems.push(`${where}: reading_json does not hash to reading_sha256`);
  const checked = context.checkReading(profileResult.reading_json);
  if (!checked.ok) {
    for (const problem of checked.problems)
      problems.push(`${where}: the reading breaks syn-output/1: ${problem}`);
    return fail(problems);
  }
  const reading = checked.reading;
  if (reading['mcd_id'] !== 'SYN')
    problems.push(`${where}: the reading is ${String(reading['mcd_id'])}`);
  if (reading['profile'] !== where)
    problems.push(`${where}: the reading is for ${String(reading['profile'])}`);
  if (reading['cycle_slot'] !== isoSlot)
    problems.push(
      `${where}: the reading is for slot ${String(reading['cycle_slot'])}, not ${isoSlot}`
    );
  if (reading['rules_version'] !== synthesis.rules_version)
    problems.push(`${where}: rules_version differs from the section's`);
  if (reading['rules_sha256'] !== synthesis.rules_sha256)
    problems.push(`${where}: rules_sha256 differs from the section's`);

  if (sha256(profileResult.zones_json) !== profileResult.zones_sha256)
    problems.push(`${where}: zones_json does not hash to zones_sha256`);
  const parsedZones = parseJson(profileResult.zones_json);
  const zoneDocs =
    parsedZones.ok && Array.isArray(parsedZones.value)
      ? parsedZones.value
      : undefined;
  if (zoneDocs === undefined) {
    problems.push(`${where}: zones_json is not a list`);
    return fail(problems);
  }
  const named = Array.isArray(reading['zones']) ? reading['zones'] : [];
  const zones: EntryZoneRow[] = [];
  zoneDocs.forEach((zoneDoc, index) => {
    const made = zoneRowOf(zoneDoc, {
      symbol,
      slot,
      isoSlot,
      profile: where,
      synthesis,
      where: `${where} zone ${index + 1}`,
    });
    problems.push(...made.problems);
    if (made.row !== undefined) {
      if (made.row.zone_id !== named[index])
        problems.push(
          `${where} zone ${index + 1}: the reading names ${String(named[index])}, the zone row is ${made.row.zone_id}`
        );
      zones.push(made.row);
    }
  });

  const row: SynthesisReadingRow = {
    symbol,
    cycle_slot: slot,
    profile: where,
    flag: synthesis.flag,
    rules_version: String(reading['rules_version']),
    rules_sha256: String(reading['rules_sha256']),
    rule_id: String(reading['rule_id']),
    branch_id: (reading['branch_id'] as string | null) ?? null,
    status: String(reading['status']),
    status_reasons: reading['status_reasons'] as string[],
    data_status: String(reading['data_status']),
    archetype: (reading['archetype'] as string | null) ?? null,
    bias: String(reading['bias']),
    trend_relation: (reading['trend_relation'] as string | null) ?? null,
    stand_aside: reading['stand_aside'] as boolean,
    reading_json: profileResult.reading_json,
    reading: reading as Json,
    reading_sha256: profileResult.reading_sha256,
    zone_count: zoneDocs.length,
    zones_reason: profileResult.zones_reason,
    zones_json: profileResult.zones_json,
    zones_sha256: profileResult.zones_sha256,
    zone_params_version: synthesis.zones_version,
    zone_params_sha256: synthesis.zones_sha256,
    reference_price: synthesis.reference_price,
    guard_problems: profileResult.guard_problems,
    inputs_sha256: result.inputs_sha256,
    retuning_observed: result.retuning.observed,
    retuning_applied: result.retuning.applied,
    runner_version: result.runner_version,
    python_version: result.runtime.python,
    duration_ms: result.runtime.synthesis_ms ?? 0,
    evaluated_at: evaluatedAt,
  };
  problems.push(...readingRowProblems(row));
  for (const zone of zones) problems.push(...zoneRowProblems(zone));
  return problems.length > 0
    ? fail(problems)
    : { reading: row, zones, problems: [], engineRefused: false };
}

interface ZoneContext {
  symbol: string;
  slot: number;
  isoSlot: string;
  profile: string;
  /** Only the zone parameters' identity is read: the section of a result, or the version and hash stored beside a reading. */
  synthesis: Pick<SynthesisRunResult, 'zones_version' | 'zones_sha256'>;
  where: string;
}

/**
 * The `entry_zones` rows a stored `zones_json` makes: what `prepareSynthesis` wrote, rebuilt from the text that is kept
 * beside the reading, so that a replay can hold the rows of the table to it (build step 4 part 6). Problems are about the
 * SHAPE and the IDENTITY of the text (the CHECK twins are `zoneRowProblems`); a text that is not a list gives no rows.
 */
export function zoneRowsOfText(
  zonesJson: string,
  context: {
    symbol: string;
    slot: number;
    profile: string;
    zones_version: string;
    zones_sha256: string;
  }
): { rows: EntryZoneRow[]; problems: string[] } {
  const parsed = parseJson(zonesJson);
  if (!parsed.ok || !Array.isArray(parsed.value))
    return { rows: [], problems: ['zones_json is not a list'] };
  const rows: EntryZoneRow[] = [];
  const problems: string[] = [];
  parsed.value.forEach((zoneDoc: unknown, index: number) => {
    const made = zoneRowOf(zoneDoc, {
      symbol: context.symbol,
      slot: context.slot,
      isoSlot: slotToIso(context.slot),
      profile: context.profile,
      synthesis: context,
      where: `zone ${index + 1}`,
    });
    problems.push(...made.problems);
    if (made.row !== undefined) rows.push(made.row);
  });
  return { rows, problems };
}

/** One zone row of `zones_json` as a row of `entry_zones`; its problems are about the SHAPE and the IDENTITY, the CHECK twins judge the rest. */
function zoneRowOf(
  zoneDoc: unknown,
  context: ZoneContext
): { row?: EntryZoneRow; problems: string[] } {
  const { where, synthesis } = context;
  if (!isRecord(zoneDoc))
    return { problems: [`${where}: the zone row is not an object`] };
  const problems: string[] = [];
  const str = (key: string): string => {
    const value = zoneDoc[key];
    if (typeof value !== 'string')
      problems.push(`${where}: ${key} must be a string`);
    return value as string;
  };
  const num = (key: string): number => {
    const value = zoneDoc[key];
    if (!isNumber(value)) problems.push(`${where}: ${key} must be a number`);
    return value as number;
  };
  const numOrNull = (value: unknown, label: string): number | null => {
    if (value === null || value === undefined) return null;
    if (!isNumber(value))
      problems.push(`${where}: ${label} must be a number or null`);
    return value as number;
  };
  const level = (key: string): unknown => {
    const value = zoneDoc[key];
    if (value !== null && !isRecord(value))
      problems.push(`${where}: ${key} must be an object or null`);
    return value ?? null;
  };

  if (zoneDoc['cycle_slot'] !== context.isoSlot)
    problems.push(`${where}: cycle_slot is not ${context.isoSlot}`);
  if (zoneDoc['profile'] !== context.profile)
    problems.push(`${where}: profile is not ${context.profile}`);
  if (zoneDoc['zones_version'] !== synthesis.zones_version)
    problems.push(`${where}: zones_version differs from the section's`);
  if (zoneDoc['zones_sha256'] !== synthesis.zones_sha256)
    problems.push(`${where}: zones_sha256 differs from the section's`);

  const opposingLevel = level('next_opposing_level');
  const opposingPrice = isRecord(opposingLevel)
    ? numOrNull(opposingLevel['price'], 'next_opposing_level.price')
    : null;
  const sources = zoneDoc['source_sensors'];
  if (!isStringList(sources))
    problems.push(`${where}: source_sensors must be a list of strings`);
  const confluenceLevels = zoneDoc['confluence_levels'];
  if (!Array.isArray(confluenceLevels))
    problems.push(`${where}: confluence_levels must be a list`);
  const sourceLevels = zoneDoc['source_levels'];
  if (!Array.isArray(sourceLevels))
    problems.push(`${where}: source_levels must be a list`);

  const row: EntryZoneRow = {
    symbol: context.symbol,
    cycle_slot: context.slot,
    profile: context.profile,
    zone_id: str('zone_id'),
    rank: num('rank'),
    bias: str('bias'),
    low: num('low'),
    high: num('high'),
    reference_price: num('reference_price'),
    source_sensors: sources as string[],
    confluence_count: num('confluence_count'),
    invalidation_price: num('invalidation_price'),
    invalidation_basis: str('invalidation_basis'),
    stop_distance: num('stop_distance'),
    next_opposing_price: opposingPrice,
    runway: numOrNull(zoneDoc['runway'], 'runway'),
    runway_ratio: numOrNull(zoneDoc['runway_ratio'], 'runway_ratio'),
    levels: {
      source_levels: sourceLevels,
      confluence_levels: confluenceLevels,
      invalidation_level: level('invalidation_level'),
      next_opposing_level: opposingLevel,
    } as Json,
    zone_params_version: synthesis.zones_version,
    zone_params_sha256: synthesis.zones_sha256,
  };
  return problems.length > 0 ? { problems } : { row, problems };
}
