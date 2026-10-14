/**
 * `report1.v1`: what the MODEL writes for a full analysis (architecture 5.7, ADR-052;
 * build step 7 plan decisions D10 and D9).
 *
 * Five keys and no others: a headline, the zones it picked, and three lists of lines
 * (why, what would change the picture, risks). A line is `{ text, cites }`; the text may
 * hold `{value id}` placeholders and nothing else that looks like a number the engines
 * did not give. **There is no direction field**: the bias, the trend relation, the rule
 * and the archetype are copied by the server from the synthesis reading, so direction
 * cannot drift from synthesis and the model has nothing to get wrong. A key that names
 * one of them is refused as FORBIDDEN_KEY.
 *
 * The model's five fields are not the six sections of the report the trader reads. The
 * server composes those from the fields AND from engine data; `REPORT1_SECTIONS` is the
 * exact mapping (decision D10), tested for completeness: every model field feeds exactly
 * one section.
 *
 * `validateReport1` is plain code (no `ajv`, assumption A4 of step 6): it reports every
 * problem with the path it was found at and never throws. `config/reply/report1-1.schema.json`
 * is the same contract for readers outside TypeScript (the provider's `json_schema` mode
 * reads it); a test lists what only the code enforces.
 *
 * Pure.
 *
 * @module lib/reply/contracts/report1
 */

import { Issues, join } from './intake';
import {
  checkLines,
  checkZoneIds,
  exactModelObject,
  finish,
  modelText,
} from './shape';
import type { ReplyContext, ReportLine, Validation } from './shape';

/** The five keys of the model's JSON, in the order the prompt names them. */
export const REPORT1_KEYS = [
  'headline',
  'zones',
  'rationale',
  'watch',
  'risks',
] as const;

/**
 * Hard limits. §5.4 gives the answer 1,500 tokens ("the schema keeps it short"); a token
 * is not less than about 1.6 characters in the scripts that cost most, so the whole of the
 * model's text is held to 2,400 characters. A typical reply (a headline, three reasons, two
 * watch lines, two risks) is about 1,200.
 */
export const REPORT1_LIMITS = {
  headline: 160,
  lineText: 240,
  rationale: { min: 1, max: 6 },
  /** the invalidation line of every chosen zone goes here (checked by part 4) */
  watch: { min: 1, max: 4 },
  risks: { min: 0, max: 5 },
  totalChars: 2400,
} as const;

export interface Report1Model {
  headline: string;
  /** zone ids of the packet's synthesis reading, at most five, none twice; empty is allowed (stand aside) */
  zones: string[];
  rationale: ReportLine[];
  watch: ReportLine[];
  risks: ReportLine[];
}

export type Report1Validation = Validation<Report1Model>;

/**
 * Check what the model returned. Without a `context` only the shape is checked; with one,
 * the zones, the cited ids and the placeholders must exist in the packet it was given.
 */
export function validateReport1(
  value: unknown,
  context: ReplyContext = {}
): Report1Validation {
  const issues = new Issues();
  const record = exactModelObject(value, '', REPORT1_KEYS, issues);
  if (record === undefined) return { ok: false, issues: issues.list };

  const valueIds =
    context.valueIds === undefined ? undefined : new Set(context.valueIds);
  const headline = modelText(
    record['headline'],
    'headline',
    issues,
    { max: REPORT1_LIMITS.headline },
    valueIds
  );
  const zones = checkZoneIds(record['zones'], 'zones', issues, context);
  const lines = (key: 'rationale' | 'watch' | 'risks') =>
    checkLines(
      record[key],
      key,
      issues,
      { ...REPORT1_LIMITS[key], textMax: REPORT1_LIMITS.lineText },
      context
    );
  const rationale = lines('rationale');
  const watch = lines('watch');
  const risks = lines('risks');

  if (
    headline !== undefined &&
    rationale !== undefined &&
    watch !== undefined &&
    risks !== undefined
  ) {
    const total =
      headline.length +
      [...rationale, ...watch, ...risks].reduce(
        (sum, line) => sum + line.text.length,
        0
      );
    if (total > REPORT1_LIMITS.totalChars) {
      issues.add(
        '',
        'TOO_LONG',
        `the texts add up to ${total} characters; the most is ${REPORT1_LIMITS.totalChars}`
      );
    }
  }

  return finish(issues, () => ({
    headline: headline as string,
    zones: zones as string[],
    rationale: rationale as ReportLine[],
    watch: watch as ReportLine[],
    risks: risks as ReportLine[],
  }));
}

/** Every text of a report, with its path, in reading order (the checks of part 4 walk these). */
export function report1Texts(
  report: Report1Model
): { path: string; text: string }[] {
  const out = [{ path: 'headline', text: report.headline }];
  for (const key of ['rationale', 'watch', 'risks'] as const) {
    report[key].forEach((line, index) =>
      out.push({ path: join(`${key}[${index}]`, 'text'), text: line.text })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// The six sections of the report the trader reads (architecture 5.7, decision D10)
// ---------------------------------------------------------------------------

/** Where a section's engine data comes from. */
export const ENGINE_SOURCES = [
  /** bias, archetype, rule id and trader type of the synthesis reading */
  'SYN_DIRECTION',
  /** the trend relation of the synthesis reading */
  'SYN_TREND_RELATION',
  /** the M15 and M5 channel sensors' statuses, state codes and biases */
  'CHANNELS',
  /** the levels of the sensors' envelopes (channel geometry) */
  'ENVELOPE_LEVELS',
  /** the context levels (support and resistance) of the stored reading */
  'CONTEXT_LEVELS',
  /** the stored entry zones: band, reference, invalidation, room */
  'STORED_ZONES',
  /** the economic calendar of the packet */
  'EVENTS',
  /** the data status, its flags and the sensors that are unavailable or stand aside */
  'DATA_STATUS',
] as const;
export type EngineSource = (typeof ENGINE_SOURCES)[number];

export const REPORT1_SECTION_IDS = [
  'SUMMARY',
  'ALIGNMENT',
  'LEVELS',
  'ZONES',
  'WHAT_WOULD_CHANGE',
  'RISKS_AND_NEWS',
] as const;
export type Report1SectionId = (typeof REPORT1_SECTION_IDS)[number];

export interface Report1Section {
  id: Report1SectionId;
  /** the number in architecture 5.7 */
  number: number;
  /** the field of `report1.v1` that feeds the section, if one does */
  model: readonly (keyof Report1Model)[];
  engine: readonly EngineSource[];
}

/**
 * Report 1 sections (5.7): 1 Summary · 2 M15 vs M5 alignment · 3 Levels · 4 Entry zones with
 * invalidation and room · 5 What would change the picture · 6 Risks and news. Each model
 * field feeds ONE section; section 3 is the engines' alone, and section 5 the model's alone.
 */
export const REPORT1_SECTIONS: readonly Report1Section[] = [
  {
    id: 'SUMMARY',
    number: 1,
    model: ['headline'],
    engine: ['SYN_DIRECTION'],
  },
  {
    id: 'ALIGNMENT',
    number: 2,
    model: ['rationale'],
    engine: ['SYN_TREND_RELATION', 'CHANNELS'],
  },
  {
    id: 'LEVELS',
    number: 3,
    model: [],
    engine: ['ENVELOPE_LEVELS', 'CONTEXT_LEVELS'],
  },
  {
    id: 'ZONES',
    number: 4,
    model: ['zones'],
    engine: ['STORED_ZONES'],
  },
  {
    id: 'WHAT_WOULD_CHANGE',
    number: 5,
    model: ['watch'],
    engine: [],
  },
  {
    id: 'RISKS_AND_NEWS',
    number: 6,
    model: ['risks'],
    engine: ['EVENTS', 'DATA_STATUS'],
  },
];
