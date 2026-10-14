/**
 * The pieces the two model contracts (`report1.v1` and `answer.v1`) share: the grammar of a
 * `{value id}` placeholder, the rules for a text the model wrote, the shape of a cited
 * line, and the context a reply is checked against (architecture 5.7, ADR-052).
 *
 * The model writes WORDS; the numbers come from the engines. A number reaches a trader in
 * one way only: the model writes the id of a value in braces (`{MCD2.baseline}`), and the
 * server fills it from the value dictionary of the cycle (part 4/5). So the grammar is
 * strict: every `{` and `}` in a text must belong to a well-formed placeholder, because
 * a half-open brace is something the resolver would either print or choke on.
 *
 * Validation has two levels, as in `lib/intake`:
 *  - SHAPE, always: types, limits, patterns, the grammar;
 *  - CONTEXT, when a `ReplyContext` is given (the orchestrator always gives one): the ids
 *    the model chose must exist in THIS packet: the zones it picked, the sensors it cites,
 *    the values it placed.
 *
 * Pure.
 *
 * @module lib/reply/contracts/shape
 */

import { Issues, at, exactObject, join, list, text } from './intake';
import type { Issue, IntakePacket, Locale, StringRule } from './intake';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** `MCD2.baseline`, `Z1.invalidation`, `DAY.high`, `LAST_PRICE`: a head and up to three parts. */
export const VALUE_ID =
  /^[A-Z][A-Z0-9_]{0,23}(\.[A-Za-z0-9][A-Za-z0-9_]{0,31}){0,3}$/;

/** More placeholders than this in one text is a template, not a sentence. */
export const MAX_PLACEHOLDERS_PER_TEXT = 8;

/** At most five zones are kept after ranking (`zone_params.yaml`, `max_zones`). */
export const ZONE_ID = /^Z[1-5]$/;
export const MAX_ZONES = 5;

/**
 * What a line may cite: a sensor (the gate, MCD0, never speaks), a zone or the synthesis.
 */
export const CITE_ID = /^(MCD([1-9]|1[0-5])|Z[1-5]|SYN)$/;
export const MAX_CITES = 4;

/**
 * Characters a text of the model may not contain: controls (newline and tab included: a
 * line is one line), the line and paragraph separators, the bidirectional embeddings,
 * overrides and isolates (the server adds its own isolates around prices; the model has no
 * use for them and "Trojan Source" is made of them), the byte order mark, and the tag
 * characters that hide a second text inside the first. The marks Arabic, Persian and Urdu
 * use (U+200C, U+200D, U+200E, U+200F, U+061C) are allowed.
 *
 * The JSON Schema twin writes the BMP part of this as a `pattern`; the tag characters are
 * not expressible there (Python's `re` has no `\u{...}`), so `schema-parity.test.ts` lists
 * that one as a rule only the code enforces.
 */
export const FORBIDDEN_TEXT_CHARS =
  /[\p{Cc}\u{2028}\u{2029}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}\u{E0000}-\u{E007F}]/u;

/** The same rule without the tag characters, as the JSON Schema twin spells it. */
export const SCHEMA_TEXT_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]*$';

// ---------------------------------------------------------------------------
// The context a reply is checked against
// ---------------------------------------------------------------------------

export interface ReplyContext {
  /** the zones of the packet's synthesis reading */
  zoneIds?: readonly string[];
  /** what a line may cite: the sensors of the packet, its zones and `SYN` */
  citeIds?: readonly string[];
  /** the ids of the value dictionary of this cycle */
  valueIds?: readonly string[];
  /** the locale the packet says the reply is written in (`answer.v1` declares its own) */
  replyLocale?: Locale;
}

/**
 * The context of a packet. The value dictionary is built from the packet and the day's
 * bars by part 4/5, so its ids arrive as an argument.
 */
export function contextOfPacket(
  packet: IntakePacket,
  valueIds?: readonly string[]
): ReplyContext {
  const zoneIds = (packet.readings.synthesis?.zones ?? []).map((zone) =>
    String(zone['zone_id'])
  );
  const sensors = new Set<string>([
    ...packet.readings.m_star,
    ...packet.board.sensors.map((line) => line.mcd_id),
  ]);
  const citeIds = [
    ...sensors,
    ...(packet.readings.synthesis !== null ? ['SYN'] : []),
    ...zoneIds,
  ];
  return {
    zoneIds,
    citeIds,
    ...(valueIds !== undefined ? { valueIds } : {}),
    replyLocale: packet.question.reply_locale,
  };
}

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

export interface PlaceholderScan {
  /** the ids of the well-formed placeholders, in order, repeats kept */
  ids: string[];
  /** what is wrong with the braces, one entry per fault */
  faults: string[];
}

/**
 * Every `{...}` of a text. A brace that is not part of `{VALUE_ID}` is a fault: a stray
 * `{` or `}`, a nested `{{x}}`, an empty `{}`, a placeholder with a space or a lower-case
 * head.
 */
export function scanPlaceholders(value: string): PlaceholderScan {
  const ids: string[] = [];
  const faults: string[] = [];
  for (const match of value.matchAll(/\{([^{}]*)\}|[{}]/g)) {
    const inner = match[1];
    if (inner === undefined) {
      faults.push(`a stray "${match[0]}" at ${match.index}`);
    } else if (!VALUE_ID.test(inner)) {
      faults.push(
        `"{${inner.slice(0, 40)}}" at ${match.index} is not a value id`
      );
    } else {
      ids.push(inner);
    }
  }
  return { ids, faults };
}

// ---------------------------------------------------------------------------
// A text the model wrote
// ---------------------------------------------------------------------------

export interface ModelTextRule extends StringRule {
  max: number;
}

/**
 * A text of the model within the rule: non-blank, free of the characters above, braces
 * only as placeholders, and (given a context) placeholders that exist in this cycle.
 */
export function modelText(
  value: unknown,
  path: string,
  issues: Issues,
  rule: ModelTextRule,
  valueIds?: ReadonlySet<string>
): string | undefined {
  const checked = text(value, path, issues, rule);
  if (checked === undefined) return undefined;
  if (checked.trim() === '') {
    issues.add(path, 'TOO_SHORT', 'must not be blank');
    return undefined;
  }
  if (FORBIDDEN_TEXT_CHARS.test(checked)) {
    issues.add(
      path,
      'BAD_FORMAT',
      'must be one line of plain text (no control, line-separator, bidirectional-override or tag character)'
    );
    return undefined;
  }
  const { ids, faults } = scanPlaceholders(checked);
  for (const fault of faults) issues.add(path, 'BAD_FORMAT', fault);
  if (ids.length > MAX_PLACEHOLDERS_PER_TEXT) {
    issues.add(
      path,
      'TOO_MANY',
      `must have at most ${MAX_PLACEHOLDERS_PER_TEXT} placeholders`
    );
  }
  if (valueIds !== undefined) {
    for (const id of new Set(ids)) {
      if (!valueIds.has(id)) {
        issues.add(path, 'NOT_ONE_OF', `{${id}} is not a value of this cycle`);
      }
    }
  }
  return faults.length === 0 ? checked : undefined;
}

// ---------------------------------------------------------------------------
// Cites, zones and lines
// ---------------------------------------------------------------------------

function idSet(
  ids: readonly string[] | undefined
): ReadonlySet<string> | undefined {
  return ids === undefined ? undefined : new Set(ids);
}

/** The ids a line cites: well formed, none twice, and (given a context) in the packet. */
export function checkCites(
  value: unknown,
  path: string,
  issues: Issues,
  context: ReplyContext = {}
): string[] | undefined {
  const items = list(value, path, issues, { max: MAX_CITES });
  if (items === undefined) return undefined;
  const known = idSet(context.citeIds);
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((item, index) => {
    const here = at(path, index);
    const id = text(item, here, issues, { pattern: CITE_ID });
    if (id === undefined) return;
    if (seen.has(id)) {
      issues.add(here, 'DUPLICATE', `${id} is cited twice`);
      return;
    }
    seen.add(id);
    if (known !== undefined && !known.has(id)) {
      issues.add(here, 'NOT_ONE_OF', `${id} is not in this packet`);
    }
    out.push(id);
  });
  return out;
}

/** The zones the model picked: ids of the packet's synthesis reading, none twice. */
export function checkZoneIds(
  value: unknown,
  path: string,
  issues: Issues,
  context: ReplyContext = {}
): string[] | undefined {
  const items = list(value, path, issues, { max: MAX_ZONES });
  if (items === undefined) return undefined;
  const known = idSet(context.zoneIds);
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((item, index) => {
    const here = at(path, index);
    const id = text(item, here, issues, { pattern: ZONE_ID });
    if (id === undefined) return;
    if (seen.has(id)) {
      issues.add(here, 'DUPLICATE', `${id} is chosen twice`);
      return;
    }
    seen.add(id);
    if (known !== undefined && !known.has(id)) {
      issues.add(here, 'NOT_ONE_OF', `${id} is not a zone of this reading`);
    }
    out.push(id);
  });
  return out;
}

/** A line of a report: what the model said, and the sensors, zones or synthesis it rests on. */
export interface ReportLine {
  text: string;
  cites: string[];
}

export interface LinesRule {
  min: number;
  max: number;
  textMax: number;
}

/** The lines of one list (`rationale`, `watch`, `risks`). */
export function checkLines(
  value: unknown,
  path: string,
  issues: Issues,
  rule: LinesRule,
  context: ReplyContext = {}
): ReportLine[] | undefined {
  const items = list(value, path, issues, { min: rule.min, max: rule.max });
  if (items === undefined) return undefined;
  const valueIds = idSet(context.valueIds);
  const out: ReportLine[] = [];
  items.forEach((item, index) => {
    const here = at(path, index);
    const record = exactObject(item, here, ['text', 'cites'], issues);
    if (record === undefined) return;
    const line = modelText(
      record['text'],
      join(here, 'text'),
      issues,
      { max: rule.textMax },
      valueIds
    );
    const cites = checkCites(
      record['cites'],
      join(here, 'cites'),
      issues,
      context
    );
    if (line !== undefined && cites !== undefined) {
      out.push({ text: line, cites });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Keys the model must never write
// ---------------------------------------------------------------------------

/**
 * Direction is never the model's (ADR-052): the server copies the bias, the trend relation,
 * the rule and the archetype from the synthesis reading. A key that names any of them is
 * refused for what it is, not as an unknown key, so the trace and the dashboard can count
 * how often a model tries.
 */
export const DIRECTION_KEY =
  /^(direction|bias|side|signal|stance|call|recommendation|action_side|trend|trend_relation|archetype|rule|rule_id|stand_aside)$/i;

/**
 * An object that has exactly `required` keys, where a direction-like key is a
 * FORBIDDEN_KEY and any other extra key is an UNKNOWN_KEY.
 */
export function exactModelObject(
  value: unknown,
  path: string,
  required: readonly string[],
  issues: Issues
): Record<string, unknown> | undefined {
  const inner = new Issues();
  const record = exactObject(value, path, required, inner);
  for (const issue of inner.list) {
    const key = issue.path.slice(path === '' ? 0 : path.length + 1);
    if (
      issue.code === 'UNKNOWN_KEY' &&
      record !== undefined &&
      DIRECTION_KEY.test(key)
    ) {
      issues.add(
        issue.path,
        'FORBIDDEN_KEY',
        'direction is never written by the model: the server copies it from the synthesis reading'
      );
    } else {
      issues.add(issue.path, issue.code, issue.message);
    }
  }
  return record;
}

// ---------------------------------------------------------------------------
// Results of a validator
// ---------------------------------------------------------------------------

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Issue[] };

export function finish<T>(issues: Issues, build: () => T): Validation<T> {
  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, value: build() };
}
