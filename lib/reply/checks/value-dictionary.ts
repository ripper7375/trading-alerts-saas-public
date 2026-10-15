/**
 * The value dictionary of a cycle (build step 7 part 4; architecture 5.8, plan section 4).
 *
 * ONE SOURCE, THREE USERS. The prompt shows the model ids beside values, the resolver (part 5)
 * fills `{id}` placeholders from this dictionary, and the number check judges the literals a model
 * typed anyway against it. Because it is one map, the three cannot disagree.
 *
 * ADDRESSABLE AND MATCH-ONLY. An entry is ADDRESSABLE when the prompt shows its id
 * (`context/values.ts` is the one place those ids are named, and this file asks it for every one):
 * `LAST_PRICE`, `DAY.open|high|low`, `PROFILE.*`, the levels of the sensors' envelopes, the six
 * fields of a stored zone, `EVENT<n>.time`. The model may write those in braces. The rest are
 * MATCH-ONLY: values that are in the context but the model is not offered an id for, so a number it
 * types that equals one is not called wrong. They are the distances from the last price to each
 * level and zone (`DIST.*`, architecture 5.8), the other facts of a stored zone, the times of the
 * data stamp, the figures in a reading's details, and the figures in the sensors' own sentences
 * (`note`, `commentary`, the synthesis reasons), which are engine output the prompt shows in full.
 * Single OHLC bar values are NOT in it, as 5.8 says: a day of bars covers almost every price of the
 * day's range to within $0.05, so matching against them would pass nearly anything.
 *
 * KINDS AND TOLERANCES. Prices and dollar distances match within $0.05 (`PRICE_TOLERANCE`); a
 * percentage, a ratio and a count match exactly (their stored decimals); a time matches to the
 * minute, or to the second when the literal gives seconds. The stored value is a number; a literal
 * is judged by `matcher.ts`.
 *
 * Pure.
 *
 * @module lib/reply/checks/value-dictionary
 */

import { levelsOf } from '../context/readings';
import { formatCompactOhlc } from '../context/ohlc-compact';
import type { DayBars } from '../context/ohlc-compact';
import { inline } from '../context/prompt';
import {
  DAY_IDS,
  LAST_PRICE_ID,
  PROFILE_FIELDS,
  eventValueId,
  levelValueIds,
  profileValueId,
  zoneValueId,
} from '../context/values';
import type { ProfileField, ZoneField } from '../context/values';
import type { IntakePacket } from '../contracts/intake';
import { NUMBER_CLASSES } from '../contracts/trace-fields';
import type { NumberClass } from '../contracts/trace-fields';
import { extractNumbers } from './extract';

/** ±$0.05 on prices and dollar distances (architecture 5.8). */
export const PRICE_TOLERANCE = 0.05;

export interface ValueEntry {
  id: string;
  kind: NumberClass;
  /**
   * In the unit of the kind: dollars for a price or a distance, percentage points for a
   * percentage, the ratio itself, a count, and for a time the unix seconds (a clock-only time is
   * the seconds since midnight).
   */
  value: number;
  /** absolute, in the same unit; 0 is an exact match */
  tolerance: number;
  /** whether the prompt shows this id, so the model may write it in braces */
  addressable: boolean;
}

export interface ValueDictionary {
  entries: readonly ValueEntry[];
  byId: ReadonlyMap<string, ValueEntry>;
}

export interface DictionaryOptions {
  /** how many events the prompt listed (the rest have no id offered); all of them when omitted */
  eventsShown?: number;
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** A number, or null for anything else (the builder refuses one that is not finite). */
const numeric = (value: unknown): number | null =>
  typeof value === 'number' ? value : null;
/** The price of a level written as `{ name, tf, price }` in a stored zone. */
const priceOf = (level: unknown): number | null =>
  isRec(level) ? numeric(level['price']) : null;
const word = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? inline(value) : null;

/** How many figures of each source are taken, so a long reading cannot grow the dictionary without bound. */
export const DICTIONARY_LIMITS = {
  detailsPerSensor: 60,
  narrativePerSource: 12,
  entries: 600,
} as const;

class Builder {
  readonly entries: ValueEntry[] = [];
  private readonly ids = new Set<string>();

  /**
   * Add an entry. A value that is missing or not a finite number, or one over the limit, adds
   * nothing and gives null; otherwise the entry, under its id or the id with `_2`, `_3` ... when
   * that id is taken.
   */
  add(
    id: string,
    kind: NumberClass,
    value: number | null,
    addressable: boolean
  ): ValueEntry | null {
    if (
      value === null ||
      !Number.isFinite(value) ||
      this.entries.length >= DICTIONARY_LIMITS.entries
    ) {
      return null;
    }
    let unique = id;
    for (let n = 2; this.ids.has(unique); n += 1) unique = `${id}_${n}`;
    this.ids.add(unique);
    const entry: ValueEntry = {
      id: unique,
      kind,
      value,
      tolerance: kind === 'PRICE' || kind === 'DISTANCE' ? PRICE_TOLERANCE : 0,
      addressable,
    };
    this.entries.push(entry);
    return entry;
  }
}

/** `2026-09-18T20:55:03Z` or the slot `2026-09-18T20:55Z`, as unix seconds; null for anything else. */
export function secondsOfInstant(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const found = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/.exec(
    text
  );
  if (found === null) return null;
  const [, year, month, day, hour, minute, second] = found as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string | undefined,
  ];
  const parts = [year, month, day, hour, minute, second ?? '0'].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const ms = Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2],
    parts[3],
    parts[4],
    parts[5]
  );
  const back = new Date(ms);
  // a month of 13 or an hour of 25 would roll over into another date: refuse it
  const same =
    back.getUTCFullYear() === parts[0] &&
    back.getUTCMonth() === parts[1] - 1 &&
    back.getUTCDate() === parts[2] &&
    back.getUTCHours() === parts[3] &&
    back.getUTCMinutes() === parts[4] &&
    back.getUTCSeconds() === parts[5];
  return same ? ms / 1000 : null;
}

const ZONE_PRICE_FIELDS: readonly {
  key: string;
  field: ZoneField;
  kind: NumberClass;
}[] = [
  { key: 'low', field: 'low', kind: 'PRICE' },
  { key: 'high', field: 'high', kind: 'PRICE' },
  { key: 'reference_price', field: 'reference', kind: 'PRICE' },
  { key: 'invalidation_price', field: 'invalidation', kind: 'PRICE' },
  { key: 'stop_distance', field: 'stop_distance', kind: 'DISTANCE' },
  { key: 'runway', field: 'runway', kind: 'DISTANCE' },
];

const PROFILE_KINDS: Readonly<Record<ProfileField, NumberClass>> = {
  max_risk_pct: 'PCT',
  max_leverage: 'RATIO',
  target_rrr: 'RATIO',
  min_sld: 'DISTANCE',
};

/** What a figure harvested from a sentence of the engines is, by how it was written and its size. */
function kindOfHarvested(
  syntax: string,
  integer: boolean,
  value: number
): NumberClass {
  if (syntax === 'PERCENT') return 'PCT';
  if (syntax === 'RATIO') return 'RATIO';
  if (syntax === 'MONEY') return value >= 1000 ? 'PRICE' : 'DISTANCE';
  if (integer) return 'COUNT';
  if (value >= 1000) return 'PRICE';
  return value >= 10 ? 'DISTANCE' : 'RATIO';
}

/** Add the figures a sentence of the engines holds, as match-only entries. */
function harvest(
  builder: Builder,
  source: string,
  sentence: unknown,
  limit: number
): void {
  if (typeof sentence !== 'string' || sentence === '') return;
  let taken = 0;
  for (const literal of extractNumbers(sentence)) {
    if (taken >= limit) break;
    if (literal.clock !== null) {
      builder.add(
        `${source}.n${taken + 1}`,
        'TIME',
        literal.clock.minuteOfDay * 60 + (literal.clock.second ?? 0),
        false
      );
      taken += 1;
      continue;
    }
    for (const reading of literal.readings) {
      builder.add(
        `${source}.n${taken + 1}`,
        kindOfHarvested(literal.syntax, literal.integer, reading),
        reading,
        false
      );
    }
    taken += 1;
  }
}

function sanitizeKey(parts: readonly string[]): string {
  const joined = parts.join('_').replace(/[^A-Za-z0-9_]/g, '_');
  return joined.slice(0, 32).replace(/^_+/, '') || 'x';
}

/** The numeric leaves of a reading's `details`, by their path. */
function detailLeaves(
  value: unknown,
  path: readonly string[],
  out: { path: string[]; value: number }[],
  depth: number
): void {
  if (out.length >= DICTIONARY_LIMITS.detailsPerSensor || depth > 5) return;
  const number = numeric(value);
  if (number !== null) {
    out.push({ path: [...path], value: number });
    return;
  }
  if (isRec(value)) {
    for (const key of Object.keys(value)) {
      detailLeaves(value[key], [...path, key], out, depth + 1);
    }
  }
}

function kindOfDetail(key: string, value: number): NumberClass {
  if (/(rate|pct|percent)$/i.test(key)) return 'PCT';
  if (Number.isInteger(value)) return 'COUNT';
  return 'RATIO';
}

/**
 * The dictionary of one cycle: the packet's readings, zones, profile, calendar and last price, and
 * the day's bars for the day line. `dayBars` is null when the day could not be read (then there
 * are no `DAY.*` entries and the prompt says the OHLC is unavailable).
 */
export function buildValueDictionary(
  packet: IntakePacket,
  dayBars: DayBars | null,
  options: DictionaryOptions = {}
): ValueDictionary {
  const builder = new Builder();
  /** the prices of the levels and zones: each gets its distance from the last price (5.8) */
  const bases: ValueEntry[] = [];
  const base = (
    id: string,
    value: number | null,
    addressable: boolean
  ): void => {
    const entry = builder.add(id, 'PRICE', value, addressable);
    if (entry !== null) bases.push(entry);
  };

  // the fixed ids
  const last = packet.data.last_price;
  if (last !== null) {
    builder.add(LAST_PRICE_ID, 'PRICE', last.price, true);
    builder.add('LAST_PRICE.bar', 'TIME', secondsOfInstant(last.bar), false);
  }
  const day =
    dayBars === null
      ? null
      : formatCompactOhlc(dayBars, { mode: 'SUMMARY', lastPrice: null }).day;
  if (day !== null) {
    builder.add(DAY_IDS.open, 'PRICE', Number(day.open), true);
    builder.add(DAY_IDS.high, 'PRICE', Number(day.high), true);
    builder.add(DAY_IDS.low, 'PRICE', Number(day.low), true);
  }
  builder.add(
    'CYCLE.slot',
    'TIME',
    secondsOfInstant(packet.data.cycle_slot),
    false
  );

  // the trader's profile
  for (const field of PROFILE_FIELDS) {
    const value = Number(packet.profile[field]);
    if (packet.profile[field] !== '' && Number.isFinite(value)) {
      builder.add(profileValueId(field), PROFILE_KINDS[field], value, true);
    }
  }

  // the sensors' levels and details
  for (const sensor of packet.readings.sensors) {
    const mcd = inline(sensor.mcd_id);
    const levels = levelsOf(sensor.envelope).map((level) => ({
      ...level,
      name: inline(level.name),
      tf: inline(level.tf),
    }));
    const ids = levelValueIds(
      mcd,
      levels.map((level) => ({ name: level.name, tf: level.tf }))
    );
    levels.forEach((level, index) => {
      const id = ids[index];
      if (id === null || id === undefined) {
        base(`${mcd}.lvl_${index + 1}`, level.price, false);
      } else {
        base(id, level.price, true);
      }
    });
    const leaves: { path: string[]; value: number }[] = [];
    detailLeaves(sensor.envelope['details'], [], leaves, 0);
    for (const leaf of leaves) {
      const key = leaf.path[leaf.path.length - 1] ?? '';
      builder.add(
        `${mcd}.details.${sanitizeKey(leaf.path)}`,
        kindOfDetail(key, leaf.value),
        leaf.value,
        false
      );
    }
    harvest(
      builder,
      `${mcd}.note`,
      sensor.envelope['summary_line'],
      DICTIONARY_LIMITS.narrativePerSource
    );
    harvest(
      builder,
      `${mcd}.commentary`,
      sensor.envelope['commentary'],
      DICTIONARY_LIMITS.narrativePerSource
    );
  }

  // the synthesis reading's own sentences, and the board's
  const synthesis = packet.readings.synthesis;
  if (synthesis !== null && Array.isArray(synthesis.reading['reasons'])) {
    synthesis.reading['reasons'].forEach((reason, index) => {
      harvest(
        builder,
        `SYN.reason${index + 1}`,
        reason,
        DICTIONARY_LIMITS.narrativePerSource
      );
    });
  }
  for (const line of packet.board.sensors) {
    harvest(
      builder,
      `BOARD.${inline(line.mcd_id)}`,
      line.summary,
      DICTIONARY_LIMITS.narrativePerSource
    );
  }
  harvest(
    builder,
    'BOARD.SYN',
    packet.board.syn.summary,
    DICTIONARY_LIMITS.narrativePerSource
  );

  // the entry zones
  for (const zone of synthesis?.zones ?? []) {
    const id = word(zone['zone_id']);
    if (id === null) continue;
    for (const { key, field, kind } of ZONE_PRICE_FIELDS) {
      const value = numeric(zone[key]);
      const valueId = zoneValueId(id, field);
      if (valueId === null) continue;
      if (kind === 'PRICE') base(valueId, value, true);
      else builder.add(valueId, kind, value, true);
    }
    builder.add(
      `${id}.runway_ratio`,
      'RATIO',
      numeric(zone['runway_ratio']),
      false
    );
    builder.add(`${id}.rank`, 'COUNT', numeric(zone['rank']), false);
    builder.add(
      `${id}.confluence_count`,
      'COUNT',
      numeric(zone['confluence_count']),
      false
    );
    base(
      `${id}.invalidation_level`,
      priceOf(zone['invalidation_level']),
      false
    );
    base(`${id}.next_opposing`, priceOf(zone['next_opposing_level']), false);
    const confluence = zone['confluence_levels'];
    (Array.isArray(confluence) ? confluence : []).forEach((level, index) => {
      base(`${id}.confluence_${index + 1}`, priceOf(level), false);
    });
  }

  // the calendar
  if (packet.events.status !== 'UNAVAILABLE') {
    const shown = options.eventsShown ?? packet.events.items.length;
    packet.events.items.forEach((event, index) => {
      const seconds = secondsOfInstant(event.time);
      const id = eventValueId(index + 1);
      if (id !== null && index < shown) builder.add(id, 'TIME', seconds, true);
      else builder.add(`EVENT${index + 1}.time`, 'TIME', seconds, false);
    });
  }

  // distances from the last price to each level and zone (5.8)
  if (last !== null) {
    for (const entry of bases) {
      builder.add(
        `DIST.${entry.id}`,
        'DISTANCE',
        Math.abs(last.price - entry.value),
        false
      );
    }
  }

  const entries = builder.entries;
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) };
}

/** The ids the model may write in braces, in the dictionary's order. */
export function addressableIds(dictionary: ValueDictionary): string[] {
  return dictionary.entries
    .filter((entry) => entry.addressable)
    .map((entry) => entry.id);
}

/** A count of entries by kind (the review and the tests read it). */
export function countByKind(
  dictionary: ValueDictionary
): Record<NumberClass, number> {
  const counts = {} as Record<NumberClass, number>;
  for (const kind of NUMBER_CLASSES) counts[kind] = 0;
  for (const entry of dictionary.entries) counts[entry.kind] += 1;
  return counts;
}
