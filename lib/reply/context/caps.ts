/**
 * The context caps of architecture 5.4 as data (build step 7 part 2, ADR-048).
 *
 * `config/reply/context-caps.v1.json` is the table: ten components, each with its cap in
 * estimated tokens, the segment it sits in (ADR-049), and its place in the cut order. This file
 * reads it, checks it, and names the pieces. The check is strict because the numbers are the
 * contract: the ten ids are exactly the ten components the trace records, each once and in the
 * table's order; every cap is a whole number above zero; the total equals the sum of the caps;
 * the cut ranks are 1 to 4, each used once, and a component that has a rank has a way to shrink
 * and one that has none is never cut.
 *
 * Pure: the JSON is imported at build time.
 *
 * @module lib/reply/context/caps
 */

import capsFile from '@/config/reply/context-caps.v1.json';

import { CONTEXT_COMPONENTS } from '../contracts/trace-fields';
import type { ContextComponent } from '../contracts/trace-fields';

export const CAPS_SCHEMA = 'context-caps/1';

/** Where a component sits in the prompt (ADR-049), in prompt order; OUTPUT is the answer's room. */
export const SEGMENT_IDS = [
  'STATIC',
  'CYCLE',
  'CHART',
  'USER',
  'OUTPUT',
] as const;
export type SegmentId = (typeof SEGMENT_IDS)[number];

/** What happens to a component that is over its cap (the "When over" column of 5.4). */
export const WHEN_OVER = [
  'NEVER_CUT',
  'SUMMARY_MODE',
  'DROPPED_BY_GATE_OR_TIER',
  'DETAILS_DROPPED',
  'EXPANSIONS_THEN_CHUNK_4',
  'OLDER_TURNS_TO_SUMMARY',
  'SCHEMA_KEEPS_IT_SHORT',
] as const;
export type WhenOver = (typeof WHEN_OVER)[number];

/** The ladder each ranked component follows; the rank is the order of ADR-048. */
export const RANK_WHEN_OVER: Readonly<Record<number, WhenOver>> = {
  1: 'OLDER_TURNS_TO_SUMMARY',
  2: 'EXPANSIONS_THEN_CHUNK_4',
  3: 'SUMMARY_MODE',
  4: 'DETAILS_DROPPED',
};

export interface ComponentCap {
  id: ContextComponent;
  label: string;
  cap: number;
  segment: SegmentId;
  /** 1 (cut first) to 4; null: never cut by the cut order */
  cut_rank: 1 | 2 | 3 | 4 | null;
  when_over: WhenOver;
}

export interface ContextLimits {
  history_verbatim_messages: number;
  history_summary_max_tokens: number;
  ohlc_summary_m5_bars: number;
  ohlc_summary_m15_bars: number;
  knowledge_max_chunks: number;
  ohlc_summary_target_tokens: number;
}

export interface ContextCaps {
  schema: typeof CAPS_SCHEMA;
  version: string;
  total: number;
  components: ComponentCap[];
  limits: ContextLimits;
}

const LIMIT_KEYS: readonly (keyof ContextLimits)[] = [
  'history_verbatim_messages',
  'history_summary_max_tokens',
  'ohlc_summary_m5_bars',
  'ohlc_summary_m15_bars',
  'knowledge_max_chunks',
  'ohlc_summary_target_tokens',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** What is wrong with a caps document; an empty list means it can be used. */
export function capsProblems(value: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(value)) return ['the caps document must be an object'];
  if (value['schema'] !== CAPS_SCHEMA) {
    problems.push(`schema must be ${CAPS_SCHEMA}`);
  }
  if (typeof value['version'] !== 'string' || value['version'] === '') {
    problems.push('version must be a non-empty string');
  }
  const components = value['components'];
  let sum = 0;
  if (!Array.isArray(components)) {
    problems.push('components must be a list');
  } else {
    if (components.length !== CONTEXT_COMPONENTS.length) {
      problems.push(`components must have ${CONTEXT_COMPONENTS.length} rows`);
    }
    const ranks = new Set<number>();
    components.forEach((row: unknown, index) => {
      const where = `components[${index}]`;
      if (!isRecord(row)) {
        problems.push(`${where} must be an object`);
        return;
      }
      if (row['id'] !== CONTEXT_COMPONENTS[index]) {
        problems.push(
          `${where}.id must be ${String(CONTEXT_COMPONENTS[index])} (the table's order)`
        );
      }
      if (typeof row['label'] !== 'string' || row['label'] === '') {
        problems.push(`${where}.label must be a non-empty string`);
      }
      if (!isCount(row['cap'])) {
        problems.push(`${where}.cap must be a whole number above zero`);
      } else {
        sum += row['cap'];
      }
      if (!(SEGMENT_IDS as readonly unknown[]).includes(row['segment'])) {
        problems.push(
          `${where}.segment must be one of ${SEGMENT_IDS.join(', ')}`
        );
      }
      if (!(WHEN_OVER as readonly unknown[]).includes(row['when_over'])) {
        problems.push(`${where}.when_over is not a known rule`);
      }
      const rank = row['cut_rank'];
      if (rank === null) {
        if (
          row['when_over'] !== undefined &&
          Object.values(RANK_WHEN_OVER).includes(row['when_over'] as WhenOver)
        ) {
          problems.push(`${where} has a rule that needs a cut_rank`);
        }
      } else if (
        typeof rank !== 'number' ||
        !Number.isInteger(rank) ||
        rank < 1 ||
        rank > 4
      ) {
        problems.push(`${where}.cut_rank must be null or 1 to 4`);
      } else {
        if (ranks.has(rank))
          problems.push(`${where}.cut_rank ${rank} is used twice`);
        ranks.add(rank);
        if (RANK_WHEN_OVER[rank] !== row['when_over']) {
          problems.push(
            `${where}: cut_rank ${rank} goes with ${String(RANK_WHEN_OVER[rank])}`
          );
        }
      }
    });
    for (const wanted of [1, 2, 3, 4]) {
      if (!ranks.has(wanted))
        problems.push(`no component has cut_rank ${wanted}`);
    }
  }
  if (!isCount(value['total'])) {
    problems.push('total must be a whole number above zero');
  } else if (Array.isArray(components) && value['total'] !== sum) {
    problems.push(`total ${value['total']} is not the sum of the caps, ${sum}`);
  }
  const limits = value['limits'];
  if (!isRecord(limits)) {
    problems.push('limits must be an object');
  } else {
    for (const key of LIMIT_KEYS) {
      if (!isCount(limits[key]))
        problems.push(`limits.${key} must be a whole number above zero`);
    }
    for (const key of Object.keys(limits)) {
      if (!LIMIT_KEYS.includes(key as keyof ContextLimits)) {
        problems.push(`limits.${key} is not a known limit`);
      }
    }
  }
  return problems;
}

/** The checked table; throws with every problem named when the document is wrong. */
export function parseCaps(value: unknown): ContextCaps {
  const problems = capsProblems(value);
  if (problems.length > 0) {
    throw new Error(`context caps are unusable: ${problems.join('; ')}`);
  }
  return value as ContextCaps;
}

/** The committed table, checked once at load. */
export const CONTEXT_CAPS: ContextCaps = parseCaps(capsFile);

export function capOf(
  id: ContextComponent,
  caps: ContextCaps = CONTEXT_CAPS
): ComponentCap {
  const found = caps.components.find((row) => row.id === id);
  if (found === undefined) throw new Error(`no cap for ${id}`);
  return found;
}
