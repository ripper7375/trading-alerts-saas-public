/**
 * The parts of a reply that are the ENGINES' alone (build step 7 part 5; architecture 5.7,
 * decision D10): direction, the alignment of the two channels, the levels, the entry zones, the
 * news, and the board of a fixed answer. Each is copied from what the packet carries, never from
 * the model, so nothing the model writes can change what the engines said.
 *
 *  - DIRECTION is the synthesis reading's bias, trend relation, rule, archetype and stand-aside
 *    flag, for the trader type of the packet. There is no other source (ADR-052).
 *  - A LEVEL is quoted by its id in the cycle's value dictionary, and only when the dictionary
 *    holds that id at that price: a level the dictionary cannot vouch for is left out, not shown.
 *  - A ZONE is the stored entry zone, field for field; a zone whose numbers are not what the
 *    contract allows fails the composition (`BAD_ZONE`) rather than being repaired.
 *  - The BOARD of a fixed answer is the sensor, its status and its state code. The sensor's own
 *    one-line summary is free English text and has no translation (decision D20, finding S7-F11),
 *    so it is never carried.
 *
 * Pure.
 *
 * @module lib/reply/report1/sections
 */

import type { ValueDictionary } from '../checks/value-dictionary';
import { levelsOf } from '../context/readings';
import { inline } from '../context/prompt';
import { levelValueIds } from '../context/values';
import {
  BIASES,
  TIMEFRAMES,
  TREND_RELATIONS,
  sensorById,
} from '../contracts/intake';
import type { IntakePacket, Timeframe } from '../contracts/intake';
import { MCD, RULE_ID } from '../contracts/fields';
import {
  ARCHETYPES,
  INVALIDATION_BASES,
  RESULT_LIMITS,
  ZONE_BIASES,
} from '../contracts/result';
import type {
  ChannelLine,
  ComposedZone,
  DirectionLine,
  FixedBoardLine,
  LevelLine,
  NewsBlock,
} from '../contracts/result';
import { VALUE_ID, ZONE_ID } from '../contracts/shape';

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export type SectionFailureCode =
  | 'NO_SYNTHESIS'
  | 'BAD_SYNTHESIS'
  | 'UNKNOWN_ZONE'
  | 'BAD_ZONE';

export interface SectionFailure {
  code: SectionFailureCode;
  detail: string;
}

export type Sectioned<T> =
  | { ok: true; value: T }
  | { ok: false; failure: SectionFailure };

const bad = (
  code: SectionFailureCode,
  detail: string
): { ok: false; failure: SectionFailure } => ({
  ok: false,
  failure: { code, detail },
});

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

/**
 * The direction line of the synthesis reading for the packet's trader type. Every field is read as
 * it is stored and refused when it is not one of the contract's values: a direction that had to be
 * guessed is not stated.
 */
export function directionLine(packet: IntakePacket): Sectioned<DirectionLine> {
  const synthesis = packet.readings.synthesis;
  if (synthesis === null) {
    return bad('NO_SYNTHESIS', 'the packet carries no synthesis reading');
  }
  const reading = synthesis.reading;
  const { bias, trend_relation, rule_id, archetype, stand_aside } = reading;

  if (
    typeof bias !== 'string' ||
    !(BIASES as readonly string[]).includes(bias)
  ) {
    return bad('BAD_SYNTHESIS', 'the reading has no bias the contract knows');
  }
  if (
    trend_relation !== null &&
    (typeof trend_relation !== 'string' ||
      !(TREND_RELATIONS as readonly string[]).includes(trend_relation))
  ) {
    return bad(
      'BAD_SYNTHESIS',
      'the trend relation is not one the contract knows'
    );
  }
  if (typeof rule_id !== 'string' || !RULE_ID.test(rule_id)) {
    return bad('BAD_SYNTHESIS', 'the rule id is missing or malformed');
  }
  if (
    archetype !== null &&
    archetype !== undefined &&
    (typeof archetype !== 'string' ||
      !(ARCHETYPES as readonly string[]).includes(archetype))
  ) {
    return bad('BAD_SYNTHESIS', 'the archetype is not one the contract knows');
  }
  if (typeof stand_aside !== 'boolean') {
    return bad('BAD_SYNTHESIS', 'the stand-aside flag is missing');
  }
  return {
    ok: true,
    value: {
      bias: bias as DirectionLine['bias'],
      trend_relation: (trend_relation ??
        null) as DirectionLine['trend_relation'],
      rule_id,
      archetype: (archetype ?? null) as DirectionLine['archetype'],
      stand_aside,
      profile: synthesis.profile,
    },
  };
}

// ---------------------------------------------------------------------------
// Alignment: the channels
// ---------------------------------------------------------------------------

/**
 * The channel sensors of the board: an independent sensor of one timeframe (the M15 and the M5
 * channel). An unavailable one is listed with its status and no state, never dropped (ADR-040).
 */
export function channelLines(packet: IntakePacket): ChannelLine[] {
  const out: ChannelLine[] = [];
  for (const line of packet.board.sensors) {
    const sensor = sensorById(line.mcd_id);
    if (
      sensor === undefined ||
      sensor.kind !== 'independent' ||
      sensor.timeframes.length !== 1
    ) {
      continue;
    }
    out.push({
      mcd_id: line.mcd_id,
      timeframe: sensor.timeframes[0] as Timeframe,
      status: line.status,
      state_code: line.state_code,
      bias: line.bias,
    });
  }
  return out.slice(0, RESULT_LIMITS.channels);
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

const LEVEL_NAME = /^[A-Za-z0-9_]{1,40}$/;
const SENSOR_ORIGIN = /^MCD[0-9]+$/;

/** Ids are unique, so two never compare equal. */
const compare = (a: string, b: string): number => (a < b ? -1 : 1);

const timeframeOf = (tf: string): Timeframe | null =>
  (TIMEFRAMES as readonly string[]).includes(tf) ? (tf as Timeframe) : null;

/** The dictionary vouches for this id at this price. */
function vouched(
  dictionary: ValueDictionary,
  id: string,
  price: number
): boolean {
  const entry = dictionary.byId.get(id);
  return (
    entry !== undefined &&
    entry.kind === 'PRICE' &&
    Math.abs(entry.value - price) < 1e-9
  );
}

/**
 * The level refs of a stored zone, each with the dictionary id the zone's builder gave it. A zone
 * with no id of its own gets ids that are not value ids, and so no level is quoted from it.
 */
function zoneRefs(zone: Rec): { id: string; ref: unknown }[] {
  const zoneId = inline(String(zone['zone_id']));
  const refs: { id: string; ref: unknown }[] = [
    { id: `${zoneId}.invalidation_level`, ref: zone['invalidation_level'] },
    { id: `${zoneId}.next_opposing`, ref: zone['next_opposing_level'] },
  ];
  const confluence = zone['confluence_levels'];
  if (Array.isArray(confluence)) {
    confluence.forEach((ref, index) => {
      refs.push({ id: `${zoneId}.confluence_${index + 1}`, ref });
    });
  }
  return refs;
}

/**
 * A level ref of a stored zone as a context level (support or resistance), or null when it is a
 * sensor's own level (already listed from the envelope), is damaged, or the dictionary cannot
 * vouch for it under that id.
 */
function contextLevel(
  id: string,
  ref: unknown,
  dictionary: ValueDictionary
): LevelLine | null {
  if (!isRec(ref)) return null;
  const name = typeof ref['name'] === 'string' ? inline(ref['name']) : null;
  if (name === null || !LEVEL_NAME.test(name)) return null;
  const price = finite(ref['price']);
  if (price === null) return null;
  const origin = ref['origin'];
  if (typeof origin !== 'string' || SENSOR_ORIGIN.test(origin)) return null;
  if (!VALUE_ID.test(id) || !vouched(dictionary, id, price)) return null;
  return {
    id,
    kind: 'CONTEXT',
    timeframe: timeframeOf(String(ref['tf'])),
    name,
    price,
  };
}

/**
 * The levels of the cycle: the channel geometry of the sensors given in full, and the context
 * levels (support and resistance) the stored zones lean on. Highest price first; when there are
 * more than the result holds, the ones nearest the last price are kept.
 */
export function levelLines(
  packet: IntakePacket,
  dictionary: ValueDictionary
): LevelLine[] {
  const found: LevelLine[] = [];

  for (const sensor of packet.readings.sensors) {
    const mcd = inline(sensor.mcd_id);
    const levels = levelsOf(sensor.envelope);
    const ids = levelValueIds(
      mcd,
      levels.map((level) => ({ name: level.name, tf: level.tf }))
    );
    levels.forEach((level, index) => {
      const id = ids[index] ?? `${mcd}.lvl_${index + 1}`;
      if (
        !LEVEL_NAME.test(level.name) ||
        !vouched(dictionary, id, level.price)
      ) {
        return;
      }
      found.push({
        id,
        kind: 'CHANNEL',
        timeframe: timeframeOf(level.tf),
        name: level.name,
        price: level.price,
      });
    });
  }

  // the same support or resistance can be the invalidation of one zone and the next level of another
  const contextSeen = new Set<string>();
  for (const zone of packet.readings.synthesis?.zones ?? []) {
    for (const { id, ref } of zoneRefs(zone)) {
      const level = contextLevel(id, ref, dictionary);
      if (level === null) continue;
      const key = `${level.timeframe}|${level.name}|${level.price}`;
      if (contextSeen.has(key)) continue;
      contextSeen.add(key);
      found.push(level);
    }
  }

  // the result holds a bounded number: keep the ones nearest the last price (the highest, when
  // there is no price), then list them highest first
  const last = packet.data.last_price?.price ?? null;
  const distance = (level: LevelLine): number =>
    last === null ? -level.price : Math.abs(level.price - last);
  return found
    .sort((a, b) => distance(a) - distance(b) || compare(a.id, b.id))
    .slice(0, RESULT_LIMITS.levels)
    .sort((a, b) => b.price - a.price || compare(a.id, b.id));
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

function composeZone(zone: Rec): Sectioned<ComposedZone> {
  const id = zone['zone_id'];
  if (typeof id !== 'string' || !ZONE_ID.test(id)) {
    return bad('BAD_ZONE', 'a stored zone has no zone id');
  }
  const fail = (what: string) => bad('BAD_ZONE', `${id}: ${what}`);

  const bias = zone['bias'];
  if (
    typeof bias !== 'string' ||
    !(ZONE_BIASES as readonly string[]).includes(bias)
  ) {
    return fail('the bias is not LONG or SHORT');
  }
  const basis = zone['invalidation_basis'];
  if (
    typeof basis !== 'string' ||
    !(INVALIDATION_BASES as readonly string[]).includes(basis)
  ) {
    return fail('the invalidation basis is not one the contract knows');
  }
  const need = (key: string): number | null => {
    const value = finite(zone[key]);
    return value !== null && value >= 0 ? value : null;
  };
  const low = need('low');
  const high = need('high');
  const reference = need('reference_price');
  const invalidation = need('invalidation_price');
  const stop = need('stop_distance');
  if (
    low === null ||
    high === null ||
    reference === null ||
    invalidation === null ||
    stop === null
  ) {
    return fail('a price of the zone is missing or not a number');
  }
  if (low > high) return fail('the band starts above where it ends');

  const optional = (value: unknown): number | null | undefined => {
    if (value === null || value === undefined) return null;
    const number = finite(value);
    return number !== null && number >= 0 ? number : undefined;
  };
  const runway = optional(zone['runway']);
  const ratio = optional(zone['runway_ratio']);
  const opposing = isRec(zone['next_opposing_level'])
    ? optional(zone['next_opposing_level']['price'])
    : null;
  if (runway === undefined || ratio === undefined || opposing === undefined) {
    return fail('the runway or the next opposing level is not a number');
  }

  const sources = zone['source_sensors'];
  if (
    !Array.isArray(sources) ||
    sources.some((s) => typeof s !== 'string' || !MCD.test(s)) ||
    new Set(sources).size !== sources.length
  ) {
    return fail('the source sensors are not a list of sensor ids');
  }
  const count = zone['confluence_count'];
  if (
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 64
  ) {
    return fail('the confluence count is not a whole number up to 64');
  }

  return {
    ok: true,
    value: {
      zone_id: id,
      bias: bias as ComposedZone['bias'],
      low,
      high,
      reference_price: reference,
      invalidation_price: invalidation,
      invalidation_basis: basis as ComposedZone['invalidation_basis'],
      stop_distance: stop,
      next_opposing_price: opposing,
      runway,
      runway_ratio: ratio,
      source_sensors: [...(sources as string[])],
      confluence_count: count,
    },
  };
}

/** The stored zones the model picked, in the order it picked them, copied as they were stored. */
export function zoneLines(
  packet: IntakePacket,
  chosen: readonly string[]
): Sectioned<ComposedZone[]> {
  const stored = packet.readings.synthesis?.zones ?? [];
  const out: ComposedZone[] = [];
  for (const id of chosen) {
    const zone = stored.find((candidate) => candidate['zone_id'] === id);
    if (zone === undefined) {
      return bad('UNKNOWN_ZONE', `${id} is not a zone of this reading`);
    }
    const composed = composeZone(zone);
    if (!composed.ok) return composed;
    out.push(composed.value);
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// News and the board
// ---------------------------------------------------------------------------

/**
 * The calendar block, as the packet carries it. An unavailable calendar keeps its status so the
 * reply says it aloud and is never read as "no news" (5.3); an event's time is marked
 * approximate when the calendar's `time_mode` was not exact (the intake reader sets the flag);
 * the packet carries no forecast value, so there is no forecast to show or to call "not
 * published".
 */
export function newsBlock(packet: IntakePacket): NewsBlock {
  return {
    status: packet.events.status,
    calendar_age_seconds: packet.events.calendar_age_seconds,
    items: packet.events.items.map((item) => ({ ...item })),
  };
}

/** The board of a fixed answer: ids, statuses and state codes alone (decision D20). */
export function boardLines(packet: IntakePacket): FixedBoardLine[] {
  return packet.board.sensors
    .filter((line) => MCD.test(line.mcd_id))
    .slice(0, RESULT_LIMITS.boardLines)
    .map((line) => ({
      mcd_id: line.mcd_id,
      status: line.status,
      state_code: line.state_code,
    }));
}
