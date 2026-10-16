/**
 * Scoring a run (build step 7 part 10; architecture 5.10, plan part 10 item 2).
 *
 * The table of 5.10 as arithmetic:
 *
 *   Golden scenarios  direction = synthesis, zone ids valid, stand-aside kept        100%
 *   Schema            a valid `report1.v1` after at most one retry                   100%
 *   Numbers           no unverified number shown                                     100%
 *   Wording           no listed phrase in any language                               100%
 *   Languages         all 19 within 5 points of English                              19 / 19
 *   Cost and time     units per message and p90 time recorded                        feeds 5.6
 *
 * plus one row of this suite's own: every cell meets the expectation its scenario was approved
 * with.
 *
 * A LANGUAGE'S SCORE is the share of its scored runs that pass every check without a retry, a
 * regeneration or a flag (plan part 10). It is held in integer basis points (1/100 of a point) so
 * the comparison with English never meets a float: with about 40 scored runs a locale one run
 * under is 2.5 points down and two runs under is 5.0 (inside the bar) and three is 7.5 (outside).
 * A locale with no scored run cannot be shown to be within 5 points, so it fails. English with no
 * scored run fails everything.
 *
 * Pure.
 *
 * @module lib/reply/eval/scoring
 */

import type { FixedReason } from '../contracts/result';
import type { Locale } from '../contracts/intake';

import {
  BASELINE_LOCALE,
  EVAL_LOCALES,
  LANGUAGE_BAR_POINTS,
} from './languages';

/** What the checks and the composer found in one cell's delivered reply (recomputed by a replay). */
export interface Judgement {
  /** the first reply parsed and passed the schema */
  schema_ok_first: boolean;
  /** the model was asked again because the JSON or its shape was wrong */
  schema_retries: 0 | 1;
  /** a valid reply was in hand at the end (false: `SCHEMA_FAILED`) */
  schema_ok_final: boolean;
  /** the extra call spent on the number and wording checks (decision D11) */
  regenerations: 0 | 1;
  final_action: 'DELIVER' | 'FLAG_NUMBERS' | 'FIXED_ANSWER';
  fixed_reason: FixedReason | null;
  /** literals replaced by the "not verified" mark in the delivered reply */
  numbers_flagged: number;
  /** violations the delivered reply still shows although they were not replaced (must be 0) */
  numbers_unverified_shown: number;
  /** listed phrases in the delivered reply (must be 0: a second failure is a fixed answer) */
  wording_violations_shown: number;
  /** the composed direction is the synthesis reading's; null when nothing was composed */
  direction_equals_syn: boolean | null;
  /** every chosen zone is a stored zone of the reading; null when nothing was composed */
  zones_valid: boolean | null;
  /** a stand-aside reading stayed a stand-aside reply; null when nothing was composed */
  stand_aside_kept: boolean | null;
  /** delivered with no retry, no regeneration and nothing flagged */
  clean: boolean;
}

/** What a cell is, for scoring: where it ran, whether it counts, and what the checks found. */
export interface ScoredCell {
  locale: Locale;
  /** the scenario counts toward language scores (`isScored`) */
  scored: boolean;
  judgement: Judgement | null;
  /** the cell met its scenario's approved expectation */
  expectation_met: boolean;
  /** units charged for the request (micro-dollars) */
  units: number;
  latency_ms: number;
  /** a model of the run wrote a reply for this cell */
  model_replied: boolean;
  /** a call's cost was estimated from the registry's price, not reported by the provider */
  cost_estimated: boolean;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/** `numerator / denominator` in basis points, rounded half up; null for an empty denominator. */
export function basisPoints(
  numerator: number,
  denominator: number
): number | null {
  if (denominator <= 0) return null;
  return Math.floor((numerator * 10_000 * 2 + denominator) / (denominator * 2));
}

/** The nearest-rank percentile of a list (the p-th of n is the value of rank ceil(p/100 * n)). */
export function percentile(
  values: readonly number[],
  p: number
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] as number;
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export interface LocaleScore {
  locale: Locale;
  runs: number;
  clean: number;
  /** basis points; null with no scored run */
  score_bp: number | null;
  /** English's score minus this one, basis points; null when either has no score */
  gap_bp: number | null;
  ok: boolean;
}

/** The score of every one of the 19 locales and its gap to English. */
export function localeScores(cells: readonly ScoredCell[]): LocaleScore[] {
  const counts = new Map<Locale, { runs: number; clean: number }>();
  for (const locale of EVAL_LOCALES) counts.set(locale, { runs: 0, clean: 0 });
  for (const cell of cells) {
    if (!cell.scored) continue;
    const count = counts.get(cell.locale);
    if (count === undefined) continue;
    count.runs += 1;
    if (cell.judgement?.clean === true) count.clean += 1;
  }
  const scoreOf = (locale: Locale): number | null => {
    const count = counts.get(locale) as { runs: number; clean: number };
    return basisPoints(count.clean, count.runs);
  };
  const english = scoreOf(BASELINE_LOCALE);
  return EVAL_LOCALES.map((locale) => {
    const count = counts.get(locale) as { runs: number; clean: number };
    const score = scoreOf(locale);
    const gap = english === null || score === null ? null : english - score;
    const ok =
      locale === BASELINE_LOCALE
        ? score !== null
        : gap !== null && gap <= LANGUAGE_BAR_POINTS * 100;
    return {
      locale,
      runs: count.runs,
      clean: count.clean,
      score_bp: score,
      gap_bp: gap,
      ok,
    };
  });
}

// ---------------------------------------------------------------------------
// The bars
// ---------------------------------------------------------------------------

export const BAR_KEYS = [
  'GOLDEN',
  'SCHEMA',
  'NUMBERS',
  'WORDING',
  'LANGUAGES',
  'COST_TIME',
  'EXPECTATIONS',
] as const;
export type BarKey = (typeof BAR_KEYS)[number];

export interface BarRow {
  key: BarKey;
  /** what 5.10 calls the test */
  test: string;
  /** the bar as 5.10 states it */
  bar: string;
  /** cells (or locales) the row looked at */
  checked: number;
  /** of them, how many broke it */
  failed: number;
  ok: boolean;
  /** one line for a person: the numbers behind the verdict */
  detail: string;
}

export interface CostTime {
  /** model-written replies measured */
  messages: number;
  /** of them, how many had a cost the provider did not report (worked out from the price) */
  estimated: number;
  units_p50: number | null;
  units_p90: number | null;
  latency_p50_ms: number | null;
  latency_p90_ms: number | null;
}

export function costTime(cells: readonly ScoredCell[]): CostTime {
  const answered = cells.filter((cell) => cell.model_replied);
  const units = answered.map((cell) => cell.units);
  const latency = answered.map((cell) => cell.latency_ms);
  return {
    messages: answered.length,
    estimated: answered.filter((cell) => cell.cost_estimated).length,
    units_p50: percentile(units, 50),
    units_p90: percentile(units, 90),
    latency_p50_ms: percentile(latency, 50),
    latency_p90_ms: percentile(latency, 90),
  };
}

const pct = (value: number | null): string =>
  value === null ? 'none' : `${(value / 100).toFixed(2)}`;

/** The seven rows of the suite for a set of cells. */
export function evaluateBars(cells: readonly ScoredCell[]): BarRow[] {
  const judged = cells.filter(
    (cell): cell is ScoredCell & { judgement: Judgement } =>
      cell.judgement !== null
  );
  const composed = judged.filter(
    (cell) => cell.judgement.direction_equals_syn !== null
  );

  const goldenFailed = composed.filter(
    (cell) =>
      cell.judgement.direction_equals_syn !== true ||
      cell.judgement.zones_valid !== true ||
      cell.judgement.stand_aside_kept !== true
  );
  const schemaFailed = judged.filter((cell) => !cell.judgement.schema_ok_final);
  const numbersFailed = judged.filter(
    (cell) => cell.judgement.numbers_unverified_shown > 0
  );
  const wordingFailed = judged.filter(
    (cell) => cell.judgement.wording_violations_shown > 0
  );
  const scores = localeScores(cells);
  const languagesFailed = scores.filter((score) => !score.ok);
  const cost = costTime(cells);
  const expectationsFailed = cells.filter((cell) => !cell.expectation_met);

  const worst = scores
    .filter((score) => score.gap_bp !== null)
    .reduce<number>((max, score) => Math.max(max, score.gap_bp as number), 0);
  const english = scores.find((score) => score.locale === BASELINE_LOCALE);

  return [
    {
      key: 'GOLDEN',
      test: 'Golden scenarios',
      bar: 'direction = synthesis; zone ids valid; stand-aside kept: 100%',
      checked: composed.length,
      failed: goldenFailed.length,
      ok: composed.length > 0 && goldenFailed.length === 0,
      detail: `${composed.length - goldenFailed.length} of ${composed.length} composed replies`,
    },
    {
      key: 'SCHEMA',
      test: 'Schema',
      bar: 'valid report after at most one retry: 100%',
      checked: judged.length,
      failed: schemaFailed.length,
      ok: judged.length > 0 && schemaFailed.length === 0,
      detail: `${judged.length - schemaFailed.length} of ${judged.length} replies valid; ${judged.filter((c) => c.judgement.schema_retries === 1).length} needed the retry`,
    },
    {
      key: 'NUMBERS',
      test: 'Numbers',
      bar: 'no unverified number shown: 100%',
      checked: judged.length,
      failed: numbersFailed.length,
      ok: judged.length > 0 && numbersFailed.length === 0,
      detail: `${numbersFailed.length} replies show a number that was neither verified nor marked`,
    },
    {
      key: 'WORDING',
      test: 'Wording',
      bar: 'no listed phrase in any language: 100%',
      checked: judged.length,
      failed: wordingFailed.length,
      ok: judged.length > 0 && wordingFailed.length === 0,
      detail: `${wordingFailed.length} replies show a listed phrase`,
    },
    {
      key: 'LANGUAGES',
      test: 'Languages',
      bar: `all 19 within ${LANGUAGE_BAR_POINTS} points of English: 19 / 19`,
      checked: scores.length,
      failed: languagesFailed.length,
      ok: languagesFailed.length === 0,
      detail:
        english?.score_bp === null || english === undefined
          ? 'English has no scored run'
          : `English ${pct(english.score_bp)}; the widest gap ${pct(worst)} points; ${scores.length - languagesFailed.length} of ${scores.length} locales within ${LANGUAGE_BAR_POINTS}`,
    },
    {
      key: 'COST_TIME',
      test: 'Cost and time',
      bar: 'units per message and p90 time recorded (feeds 5.6)',
      checked: cost.messages,
      failed:
        cost.messages > 0 &&
        cost.units_p90 !== null &&
        cost.latency_p90_ms !== null
          ? 0
          : 1,
      ok:
        cost.messages > 0 &&
        cost.units_p90 !== null &&
        cost.latency_p90_ms !== null,
      detail:
        cost.messages === 0
          ? 'no model-written reply to measure'
          : `${cost.messages} replies (${cost.estimated} with a cost worked out from the price, not reported); units p50 ${cost.units_p50}, p90 ${cost.units_p90}; time p90 ${cost.latency_p90_ms} ms`,
    },
    {
      key: 'EXPECTATIONS',
      test: 'Approved expectations',
      bar: 'every cell meets its scenario: 100%',
      checked: cells.length,
      failed: expectationsFailed.length,
      ok: cells.length > 0 && expectationsFailed.length === 0,
      detail: `${cells.length - expectationsFailed.length} of ${cells.length} cells`,
    },
  ];
}
