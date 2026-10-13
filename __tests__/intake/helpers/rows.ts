/**
 * Rows of the market tables made from a stored world (`__tests__/lib/intake/helpers/world.ts`),
 * for the gated PostgreSQL spec. The columns and their meaning are those of
 * `prisma/market-data/schema.prisma`; the mapping follows what the gateway's gated specs seed
 * (`railway-gateway/test/helpers/synthesis-rows.ts`) and is written here on its own, so that
 * the database is asked to accept what the stored cycles hold, not what a helper shares.
 *
 * Every scalar column is read OUT of the stored document, so a row agrees with its document by
 * construction; a test that wants a column to disagree overrides it afterwards.
 */

import {
  type World,
  type WorldSensor,
  type WorldSynthesis,
} from '../../lib/intake/helpers/world';

export type Doc = Record<string, any>;

export function mcdRow(world: World, sensor: WorldSensor, over: Doc = {}): Doc {
  const envelope = JSON.parse(sensor.envelope_json) as Doc;
  return {
    symbol: 'XAUUSD',
    cycle_slot: world.slot,
    mcd_id: sensor.mcd_id,
    flag: sensor.flag,
    evaluator_version: String(envelope['evaluator_version'] ?? '2.0.1'),
    status: sensor.status,
    state_code: envelope['state_code'] ?? null,
    bias: envelope['bias'] ?? null,
    envelope_json: sensor.envelope_json,
    envelope,
    envelope_sha256: sensor.envelope_sha256,
    evaluator_envelope_sha256: sensor.envelope_sha256,
    inputs_sha256: world.inputsSha256,
    inherited_reasons: [],
    guard_problems: [],
    retuning_observed: false,
    retuning_applied: false,
    runner_version: world.runnerVersion,
    python_version: '3.11.9',
    duration_ms: 12.5,
    evaluated_at: world.slot + 31,
    ...over,
  };
}

export function readingRow(
  world: World,
  row: WorldSynthesis,
  over: Doc = {}
): Doc {
  const doc = JSON.parse(row.reading_json) as Doc;
  return {
    symbol: 'XAUUSD',
    cycle_slot: world.slot,
    profile: row.profile,
    flag: row.flag,
    rules_version: doc['rules_version'],
    rules_sha256: doc['rules_sha256'],
    rule_id: doc['rule_id'],
    branch_id: doc['branch_id'],
    status: doc['status'],
    status_reasons: doc['status_reasons'],
    data_status: doc['data_status'],
    archetype: doc['archetype'],
    bias: doc['bias'],
    trend_relation: doc['trend_relation'],
    stand_aside: doc['stand_aside'],
    reading_json: row.reading_json,
    reading: doc,
    reading_sha256: row.reading_sha256,
    zone_count: row.zone_count,
    zones_reason: row.zones_reason,
    zones_json: row.zones_json,
    zones_sha256: row.zones_sha256,
    zone_params_version: world.zoneParams.version,
    zone_params_sha256: world.zoneParams.sha256,
    reference_price: row.reference_price,
    guard_problems: [],
    inputs_sha256: world.inputsSha256,
    retuning_observed: false,
    retuning_applied: false,
    runner_version: world.runnerVersion,
    python_version: '3.11.9',
    duration_ms: 48.8,
    evaluated_at: world.slot + 31,
    ...over,
  };
}

export function zoneRows(
  world: World,
  row: WorldSynthesis,
  over: Doc = {}
): Doc[] {
  return (JSON.parse(row.zones_json) as Doc[]).map((zone) => ({
    symbol: 'XAUUSD',
    cycle_slot: world.slot,
    profile: row.profile,
    zone_id: zone['zone_id'],
    rank: zone['rank'],
    bias: zone['bias'],
    low: zone['low'],
    high: zone['high'],
    reference_price: zone['reference_price'],
    source_sensors: zone['source_sensors'],
    confluence_count: zone['confluence_count'],
    invalidation_price: zone['invalidation_price'],
    invalidation_basis: zone['invalidation_basis'],
    stop_distance: zone['stop_distance'],
    next_opposing_price: zone['next_opposing_level']
      ? zone['next_opposing_level']['price']
      : null,
    runway: zone['runway'],
    runway_ratio: zone['runway_ratio'],
    levels: {
      source_levels: zone['source_levels'],
      confluence_levels: zone['confluence_levels'],
      invalidation_level: zone['invalidation_level'],
      next_opposing_level: zone['next_opposing_level'],
    },
    zone_params_version: zone['zones_version'],
    zone_params_sha256: zone['zones_sha256'],
    ...over,
  }));
}

/** A `market_cycles` row. */
export function cycleRow(slot: number, state: string, over: Doc = {}): Doc {
  return {
    symbol: 'XAUUSD',
    slot,
    state,
    attempts: 1,
    manifest_received_at: slot + 5,
    ready_at: state === 'READY' ? slot + 20 : null,
    updatedAt: new Date(0),
    ...over,
  };
}

let counter = 0;

/** An `economic_events` observation. */
export function calendarRow(over: Doc = {}): Doc {
  counter += 1;
  return {
    terminal_id: 'A',
    value_id: `value-${counter}`,
    captured_at: 1_790_000_000,
    event_id: `event-${counter}`,
    event_time: 1_790_003_600,
    country_code: 'US',
    currency: 'USD',
    event_name: `Release ${counter}`,
    importance: 'HIGH',
    time_mode: 0,
    ...over,
  };
}
