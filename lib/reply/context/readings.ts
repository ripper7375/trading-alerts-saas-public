/**
 * The readings of M* and the entry zones, as the prompt shows them (build step 7 part 2;
 * architecture 5.4 row "Readings for M* + zones", ADR-041, ADR-048).
 *
 * The packet carries each sensor's envelope (`mcd-output/1`) as the worker stored it, the
 * trader's synthesis reading (`syn-output/1`) and its zones. This renders them as short lines:
 * the state, the bias and the reasons, the levels with the id the model quotes them by, the
 * sensor's own one-line note, and (in FULL) its commentary and details. Prices come from the
 * documents unchanged, to the two decimals of gold.
 *
 * TWO FORMS, the ladder of cut rank 4:
 *   FULL              everything above, for every sensor and every zone;
 *   DETAILS_DROPPED   commentary, details and the extras of a zone are gone from every sensor
 *                     EXCEPT the sensors that are never reduced (ADR-041): a warning (a sensor
 *                     that says STAND_ASIDE, or whose LONG or SHORT is the opposite of the
 *                     synthesis) and the trader type's primary sensor. The synthesis reading and
 *                     the zones' prices are never reduced.
 *
 * A document that is not the shape it should be is shown as far as it can be read and never
 * guessed at: a level with no price is left out, a field of the wrong type is left out.
 *
 * Pure.
 *
 * @module lib/reply/context/readings
 */

import { findWarnings, primarySensor, sensorById } from '../contracts/intake';
import type { IntakePacket } from '../contracts/intake';
import { inline, marker, quoteLine } from './prompt';
import { levelValueIds, zoneValueId } from './values';
import type { ZoneField } from './values';

export const READINGS_DETAILS = ['FULL', 'DETAILS_DROPPED'] as const;
export type ReadingsDetail = (typeof READINGS_DETAILS)[number];

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
/** A string field of a document, safe to place in a line (see `inline`). */
const tok = (value: unknown): string | null => {
  const text = str(value);
  return text === null ? null : inline(text);
};
/**
 * The code words of a list in a document, each one-line safe and separated by commas; null when
 * the value is not a list or holds no string, so no line is written for it.
 */
const codes = (values: unknown): string | null => {
  if (!Array.isArray(values)) return null;
  const words = values
    .filter((value): value is string => typeof value === 'string')
    .map(inline);
  return words.length === 0 ? null : words.join(', ');
};
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const PRICE_DIGITS = 2;
const price = (value: number): string => value.toFixed(PRICE_DIGITS);

/** The longest a printed detail value runs before it is shortened. */
const DETAIL_VALUE_MAX = 80;

/** The sensors that are never reduced: the warnings and the trader type's primary sensor. */
export function sensorsKeptInFull(packet: IntakePacket): string[] {
  const syn = packet.board.syn;
  const usable = packet.board.sensors.flatMap((line) =>
    line.status === 'ABSENT'
      ? []
      : [{ mcd_id: line.mcd_id, status: line.status, bias: line.bias }]
  );
  const warnings = findWarnings(
    usable,
    syn.state === 'RUNNING' ? syn.bias : null
  ).map((warning) => warning.mcd_id);
  const kept = new Set<string>(warnings);
  kept.add(primarySensor(packet.profile.trader_type).mcd_id);
  return [...kept];
}

function scalar(value: unknown): string {
  if (typeof value === 'string') {
    const clipped =
      value.length > DETAIL_VALUE_MAX
        ? `${value.slice(0, DETAIL_VALUE_MAX)}...`
        : value;
    return quoteLine(clipped);
  }
  if (Array.isArray(value)) {
    const text = JSON.stringify(value);
    return text.length <= DETAIL_VALUE_MAX ? text : `[${value.length} items]`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * `key=value` pairs of a details object; nested objects are written `outer.inner=value`. A key
 * is a word from a document like any other, so it goes through `inline`.
 */
function flatten(prefix: string, value: unknown, out: string[]): void {
  if (isRec(value)) {
    for (const key of Object.keys(value)) {
      flatten(
        prefix === '' ? inline(key) : `${prefix}.${inline(key)}`,
        value[key],
        out
      );
    }
    return;
  }
  out.push(`${prefix}=${scalar(value)}`);
}

interface Level {
  name: string;
  tf: string;
  price: number;
  role: string | null;
}

function levelsOf(envelope: Rec): Level[] {
  const raw = envelope['levels'];
  if (!Array.isArray(raw)) return [];
  const levels: Level[] = [];
  for (const item of raw) {
    if (!isRec(item)) continue;
    const name = tok(item['name']);
    const tf = tok(item['tf']);
    const value = finite(item['price']);
    if (name === null || tf === null || value === null) continue;
    levels.push({ name, tf, price: value, role: tok(item['role']) });
  }
  return levels;
}

function renderSensor(mcdId: string, envelope: Rec, full: boolean): string {
  const name = sensorById(mcdId)?.name ?? null;
  const head = [
    inline(mcdId),
    ...(name === null ? [] : [name]),
    tok(envelope['status']) ?? 'UNKNOWN',
    tok(envelope['state_code']) ?? 'no state',
    `bias ${tok(envelope['bias']) ?? 'none'}`,
  ];
  const regime = tok(envelope['regime_status']);
  if (regime !== null) head.push(`regime ${regime}`);
  const lines = [head.join(' · ')];

  if (full) {
    const reasons = codes(envelope['status_reasons']);
    if (reasons !== null) lines.push(`  status reasons: ${reasons}`);
  }
  const levels = levelsOf(envelope);
  if (levels.length > 0) {
    const ids = levelValueIds(
      mcdId,
      levels.map((level) => ({ name: level.name, tf: level.tf }))
    );
    const parts = levels.map((level, index) => {
      const id = ids[index];
      const role = level.role === null ? '' : ` (${level.role})`;
      return `${level.tf} ${level.name} ${price(level.price)}${id === null || id === undefined ? '' : ` {${id}}`}${role}`;
    });
    lines.push(`  levels: ${parts.join(' · ')}`);
  }
  const note = str(envelope['summary_line']);
  if (note !== null) lines.push(`  note: ${quoteLine(note)}`);
  if (full) {
    const commentary = str(envelope['commentary']);
    if (commentary !== null)
      lines.push(`  commentary: ${quoteLine(commentary)}`);
    const details = envelope['details'];
    if (isRec(details)) {
      const pairs: string[] = [];
      flatten('', details, pairs);
      if (pairs.length > 0) lines.push(`  details: ${pairs.join(' ')}`);
    }
  }
  return lines.join('\n');
}

function renderSynthesis(packet: IntakePacket): string {
  const entry = packet.readings.synthesis;
  if (entry === null) {
    return 'SYN reading unavailable: the synthesis is not running for this cycle';
  }
  const reading = entry.reading;
  const head = [
    'SYN',
    `profile ${inline(entry.profile)}`,
    `rule ${tok(reading['rule_id']) ?? 'none'}`,
    `branch ${tok(reading['branch_id']) ?? 'none'}`,
    `archetype ${tok(reading['archetype']) ?? 'none'}`,
    tok(reading['status']) ?? 'UNKNOWN',
    `bias ${tok(reading['bias']) ?? 'none'}`,
    tok(reading['trend_relation']) ?? 'no trend relation',
    reading['stand_aside'] === true ? 'stand_aside yes' : 'stand_aside no',
  ];
  const lines = [head.join(' · ')];
  const statusReasons = codes(reading['status_reasons']);
  if (statusReasons !== null) lines.push(`  status reasons: ${statusReasons}`);
  const reasons = reading['reasons'];
  if (Array.isArray(reasons)) {
    const quoted = reasons
      .filter((r): r is string => typeof r === 'string')
      .map(quoteLine);
    if (quoted.length > 0) lines.push(`  reasons: ${quoted.join('; ')}`);
  }
  return lines.join('\n');
}

function zoneField(
  zone: Rec,
  key: string,
  field: ZoneField,
  id: string
): string | null {
  const value = finite(zone[key]);
  if (value === null) return null;
  const valueId = zoneValueId(id, field);
  return `${price(value)}${valueId === null ? '' : ` {${valueId}}`}`;
}

function levelRef(value: unknown): string | null {
  if (!isRec(value)) return null;
  const name = tok(value['name']);
  const tf = tok(value['tf']);
  const at = finite(value['price']);
  if (name === null || at === null) return null;
  return `${name}${tf === null ? '' : ` ${tf}`} ${price(at)}`;
}

function renderZone(zone: Rec, full: boolean): string | null {
  const id = tok(zone['zone_id']);
  if (id === null) return null;
  const low = zoneField(zone, 'low', 'low', id);
  const high = zoneField(zone, 'high', 'high', id);
  const reference = zoneField(zone, 'reference_price', 'reference', id);
  const invalidation = zoneField(
    zone,
    'invalidation_price',
    'invalidation',
    id
  );
  const stop = zoneField(zone, 'stop_distance', 'stop_distance', id);
  const runway = zoneField(zone, 'runway', 'runway', id);
  const head = [
    id,
    `rank ${String(finite(zone['rank']) ?? '?')}`,
    tok(zone['bias']) ?? 'no bias',
  ];
  if (low !== null && high !== null) head.push(`band ${low} to ${high}`);
  if (reference !== null) head.push(`reference ${reference}`);
  if (invalidation !== null) head.push(`invalidation ${invalidation}`);
  if (stop !== null) head.push(`stop distance ${stop}`);
  if (runway !== null) head.push(`runway ${runway}`);
  const lines = [head.join(' · ')];
  if (full) {
    const extra: string[] = [];
    const basis = tok(zone['invalidation_basis']);
    const via = levelRef(zone['invalidation_level']);
    if (basis !== null)
      extra.push(
        `invalidation basis ${basis}${via === null ? '' : ` at ${via}`}`
      );
    const opposing = levelRef(zone['next_opposing_level']);
    if (opposing !== null) extra.push(`next opposing level ${opposing}`);
    const ratio = finite(zone['runway_ratio']);
    if (ratio !== null) extra.push(`runway ratio ${String(ratio)}`);
    const count = finite(zone['confluence_count']);
    const confluence = Array.isArray(zone['confluence_levels'])
      ? zone['confluence_levels']
          .map(levelRef)
          .filter((r): r is string => r !== null)
      : [];
    if (count !== null) {
      extra.push(
        `confluence ${count}${confluence.length > 0 ? ` (${confluence.join(', ')})` : ''}`
      );
    }
    const sources = codes(zone['source_sensors']);
    if (sources !== null) extra.push(`sources ${sources}`);
    if (extra.length > 0) lines.push(`  ${extra.join(' ; ')}`);
  }
  return lines.join('\n');
}

function renderZones(packet: IntakePacket, full: boolean): string {
  const entry = packet.readings.synthesis;
  if (entry === null) return 'ZONES none: the synthesis is not running';
  const rendered = entry.zones
    .map((zone) => renderZone(zone, full))
    .filter((line): line is string => line !== null);
  if (rendered.length === 0) {
    return `ZONES none${entry.zones_reason === null ? '' : ` · reason ${inline(entry.zones_reason)}`}`;
  }
  return `ZONES (rank order)\n${rendered.join('\n')}`;
}

/** The READINGS_ZONES component in one of its two forms. */
export function renderReadings(
  packet: IntakePacket,
  detail: ReadingsDetail
): string {
  const keep = new Set(sensorsKeptInFull(packet));
  const sensors = [...packet.readings.sensors].sort(
    (a, b) => mcdNumber(a.mcd_id) - mcdNumber(b.mcd_id)
  );
  const full = detail === 'FULL';
  const parts = [
    marker('READINGS', {
      m_star: packet.readings.m_star.map(inline).join(',') || 'none',
    }).trimEnd(),
    renderSynthesis(packet),
    ...sensors.map((sensor) =>
      renderSensor(
        sensor.mcd_id,
        sensor.envelope,
        full || keep.has(sensor.mcd_id)
      )
    ),
    renderZones(packet, full),
  ];
  return `${parts.join('\n')}\n`;
}

function mcdNumber(id: string): number {
  const found = /^MCD(\d+)$/.exec(id);
  return found === null ? Number.MAX_SAFE_INTEGER : Number(found[1]);
}
