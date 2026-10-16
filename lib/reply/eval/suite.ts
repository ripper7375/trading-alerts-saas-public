/**
 * The evaluation suite (build step 7 part 10; architecture 5.10, 7.7; ADR-055, ADR-079; plan
 * part 10 items 2 and 3).
 *
 * WHAT IT IS. A run is the record of asking a model (or the fixture model) every cell of the
 * golden scenario set: for each cell, what each call returned, what it cost and how long it took,
 * what the checks found, and what the pipeline did with it. This file holds
 *
 *   JUDGING    `judgeReplies`: from the replies a cell's calls returned, WHAT THE CHECKS FOUND, by
 *              the same functions the answer step uses (validate, check, decide, compose). It is
 *              pure, so it can be run again on a recorded run on every deploy with no model call;
 *   SCORING    `summarizeCells` and `replayRun`: the bars of 5.10 over a run's cells, and a replay
 *              that recomputes every judgement from the recorded replies and says what differs;
 *   THE GATE   `evalGate`: a model joins the registry as `passed` only with a LIVE run whose
 *              fingerprint is the current one and whose bars all hold.
 *
 * WHAT A STAND-IN RUN IS. The first run committed is made with the fixture model (`kind:
 * 'STAND_IN'`): its replies are written by the test harness, not by a model. It proves the
 * mechanism end to end and measures NOTHING about a model, a language or a price, and it can never
 * make a model `passed` (the gate refuses it by name). Every place that quotes it says so.
 *
 * THE JUDGE MIRRORS THE ANSWER STEP (`run/answer-step.ts`): one extra call at most, shared by the
 * schema retry and the check regeneration; the first thing that goes wrong spends it. The
 * orchestrator test of the harness holds the two together on every scenario, so a change to one
 * that is not made to the other fails there.
 *
 * Pure.
 *
 * @module lib/reply/eval/suite
 */

import {
  checkAnswer,
  checkReport1,
  decideFinal,
  decideFirst,
} from '../checks/report';
import type { CheckPass } from '../checks/report';
import { addressableIds } from '../checks/value-dictionary';
import type { ValueDictionary } from '../checks/value-dictionary';
import { validateAnswer } from '../contracts/answer';
import type { AnswerModel } from '../contracts/answer';
import { canonicalJson, sha256Hex } from '../contracts/intake';
import type {
  EventsStatus,
  IntakePacket,
  Locale,
  TraderType,
} from '../contracts/intake';
import { validateReport1 } from '../contracts/report1';
import type { Report1Model } from '../contracts/report1';
import type { FixedReason, ResultNote } from '../contracts/result';
import { contextOfPacket } from '../contracts/shape';
import type { Validation } from '../contracts/shape';
import { composeReport1 } from '../report1/compose';

import {
  currentFingerprint,
  fingerprintDifferences,
  fingerprintProblems,
} from './fingerprint';
import type { CurrentParts, Fingerprint } from './fingerprint';
import { EVAL_LOCALES } from './languages';
import { cellId, isScored } from './scenarios';
import type { CellKey, Outcome, Scenario } from './scenarios';
import { costTime, evaluateBars, localeScores } from './scoring';
import type {
  BarRow,
  CostTime,
  Judgement,
  LocaleScore,
  ScoredCell,
} from './scoring';

export const RUN_SCHEMA = 'eval-run/1';

export type RunKind = 'STAND_IN' | 'LIVE';

/** Printed on every report, summary and file of a stand-in run. */
export const STAND_IN_LABEL =
  "STAND-IN RUN: the replies are the fixture model's, written by the test harness. It shows the mechanism and measures nothing about a model, a language or a price.";

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

/** One logical call to the answer model: the primary, then the fallback if it failed. */
export interface CallRecord {
  /** who wrote the reply; null when both failed */
  slot: 'PRIMARY' | 'FALLBACK' | null;
  /** the host that served it, as the gateway reported it (`fixture` for the fixture model); null when unknown */
  host: string | null;
  /** the reply text; null when the call returned nothing */
  text: string | null;
  /** requests sent for this call (the primary's, then the fallback's) */
  tries: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  cost_micro_usd: number;
  /** the cost was worked out from the registry's price because the provider reported none */
  cost_estimated: boolean;
  latency_ms: number;
}

export interface CellRecord {
  id: string;
  scenario: string;
  trader: TraderType;
  locale: Locale;
  pass: number;
  /** what the pipeline answered with */
  outcome: Outcome;
  fixed_reason: FixedReason | null;
  refusal: string | null;
  /** a refusal for the quota carried the balance (the limit, what is left, what was needed) */
  balance_shown: boolean;
  notes: ResultNote[];
  /** the reply states a direction */
  direction_stated: boolean;
  /** the stated direction is the synthesis reading's; null when none is stated */
  direction_equals_syn: boolean | null;
  /** the calendar block's status in a Report 1; null otherwise */
  news_status: EventsStatus | null;
  /** answer-model requests sent (the Understand call is not one) */
  model_calls: number;
  fallback_used: boolean;
  /** the answer model's calls in order */
  calls: CallRecord[];
  /** units charged for the whole request (micro-dollars, decision D2) */
  units: number;
  /** the request's time, milliseconds */
  latency_ms: number;
  /** what the checks found; null when no model reply was produced */
  judgement: Judgement | null;
}

export interface RunSummary {
  cells: number;
  scored_cells: number;
  bars: BarRow[];
  locales: LocaleScore[];
  cost_time: CostTime;
  /** every bar holds */
  all_pass: boolean;
}

export interface EvalRun {
  schema: typeof RUN_SCHEMA;
  id: string;
  kind: RunKind;
  /** the stand-in banner, or a line naming the live run */
  label: string;
  /** YYYY-MM-DD, given by the caller (this code reads no clock) */
  made_on: string;
  /** how many times each cell was run */
  passes: number;
  model: { slug: string; provider: string };
  fingerprint: Fingerprint;
  /** a digest of every world (cycle and trader type) the cells ran on */
  worlds: Record<string, string>;
  cells: CellRecord[];
  summary: RunSummary;
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

/** The world a cell ran on: its packet (with the cell's locale), the cycle's dictionary, the shape asked. */
export interface JudgeWorld {
  packet: IntakePacket;
  dictionary: ValueDictionary;
  shape: 'REPORT1' | 'ANSWER';
}

function synthesisBiasOf(
  packet: IntakePacket
): ('LONG' | 'SHORT' | 'NEUTRAL' | 'STAND_ASIDE') | null {
  const bias = packet.readings.synthesis?.reading['bias'];
  return bias === 'LONG' ||
    bias === 'SHORT' ||
    bias === 'NEUTRAL' ||
    bias === 'STAND_ASIDE'
    ? bias
    : null;
}

type Read = { ok: true; model: Report1Model | AnswerModel } | { ok: false };

function read(world: JudgeWorld, text: string): Read {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    return { ok: false };
  }
  const context = contextOfPacket(
    world.packet,
    addressableIds(world.dictionary)
  );
  const checked: Validation<Report1Model | AnswerModel> =
    world.shape === 'REPORT1'
      ? validateReport1(value, context)
      : validateAnswer(value, context);
  return checked.ok ? { ok: true, model: checked.value } : { ok: false };
}

function checkOne(
  world: JudgeWorld,
  model: Report1Model | AnswerModel
): CheckPass {
  const bias = synthesisBiasOf(world.packet);
  const locale = world.packet.question.reply_locale;
  return world.shape === 'REPORT1'
    ? checkReport1(model as Report1Model, {
        dictionary: world.dictionary,
        locale,
        bias,
      })
    : checkAnswer(model as AnswerModel, { dictionary: world.dictionary, bias });
}

function nothingDelivered(
  reason: FixedReason,
  partial: Partial<Judgement>
): Judgement {
  return {
    schema_ok_first: false,
    schema_retries: 0,
    schema_ok_final: false,
    regenerations: 0,
    final_action: 'FIXED_ANSWER',
    fixed_reason: reason,
    numbers_flagged: 0,
    numbers_unverified_shown: 0,
    wording_violations_shown: 0,
    direction_equals_syn: null,
    zones_valid: null,
    stand_aside_kept: null,
    clean: false,
    ...partial,
  };
}

/**
 * What the checks found in the replies of a cell's calls (`replies[i]` is the text call i returned,
 * null when it returned nothing). Null when the first call returned nothing: no model reply, no
 * judgement. The same sequence as `run/answer-step.ts`.
 */
export function judgeReplies(
  world: JudgeWorld,
  replies: readonly (string | null)[]
): Judgement | null {
  const first = replies[0];
  if (first === undefined || first === null) return null;

  let index = 0;
  let reply = read(world, first);
  const schemaOkFirst = reply.ok;
  let retries: 0 | 1 = 0;
  let extraSpent = false;

  if (!reply.ok) {
    extraSpent = true;
    retries = 1;
    const second = replies[1];
    if (second === undefined || second === null) {
      return nothingDelivered('SCHEMA_FAILED', {
        schema_ok_first: false,
        schema_retries: 1,
      });
    }
    index = 1;
    reply = read(world, second);
    if (!reply.ok) {
      return nothingDelivered('SCHEMA_FAILED', {
        schema_ok_first: false,
        schema_retries: 1,
      });
    }
  }

  let delivered = reply.model;
  const firstPass = checkOne(world, delivered);
  const firstDecision = decideFirst(firstPass, !extraSpent);
  let secondPass: CheckPass | null = null;
  let regenerations: 0 | 1 = 0;

  if (firstDecision.request !== null) {
    // the call is spent whether or not its reply is usable
    regenerations = 1;
    const again = replies[index + 1];
    if (again !== undefined && again !== null) {
      const regenerated = read(world, again);
      if (regenerated.ok) {
        delivered = regenerated.model;
        secondPass = checkOne(world, delivered);
      }
    }
  }

  const finalPass = secondPass ?? firstPass;
  const final = decideFinal(finalPass);
  if (final.action === 'FIXED_ANSWER') {
    return nothingDelivered('WORDING_FAILED', {
      schema_ok_first: schemaOkFirst,
      schema_retries: retries,
      schema_ok_final: true,
      regenerations,
      wording_violations_shown: 0,
    });
  }

  // the numbers still unverified are replaced by the mark; any that remain were not
  const unverifiedShown = Math.max(
    0,
    finalPass.numbers.violations.length - final.flagged.length
  );

  let direction: boolean | null = null;
  let zones: boolean | null = null;
  let standAside: boolean | null = null;
  if (world.shape === 'REPORT1') {
    const model = delivered as Report1Model;
    const composed = composeReport1({
      packet: world.packet,
      dictionary: world.dictionary,
      model,
      flagged: final.flagged,
    });
    const synthesis = world.packet.readings.synthesis;
    const stored = new Set(
      (synthesis?.zones ?? []).map((zone) => String(zone['zone_id']))
    );
    zones = model.zones.every((id) => stored.has(id));
    if (composed.ok && synthesis !== null) {
      const line = composed.value.report.direction;
      const reading = synthesis.reading;
      direction =
        line.bias === reading['bias'] &&
        line.trend_relation === (reading['trend_relation'] ?? null) &&
        line.rule_id === reading['rule_id'] &&
        line.archetype === (reading['archetype'] ?? null) &&
        line.stand_aside === reading['stand_aside'] &&
        line.profile === synthesis.profile;
      standAside =
        reading['stand_aside'] === true
          ? line.stand_aside === true && model.zones.length === 0
          : true;
    } else {
      direction = false;
      standAside = false;
    }
  }

  const clean =
    retries === 0 &&
    regenerations === 0 &&
    final.flagged.length === 0 &&
    (world.shape === 'ANSWER' || direction === true);

  return {
    schema_ok_first: schemaOkFirst,
    schema_retries: retries,
    schema_ok_final: true,
    regenerations,
    final_action: final.action,
    fixed_reason: null,
    numbers_flagged: final.flagged.length,
    numbers_unverified_shown: unverifiedShown,
    wording_violations_shown: finalPass.wording.violations,
    direction_equals_syn: direction,
    zones_valid: zones,
    stand_aside_kept: standAside,
    clean,
  };
}

// ---------------------------------------------------------------------------
// Expectations
// ---------------------------------------------------------------------------

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** What differs between a cell and the expectation its scenario was approved with, in words. */
export function expectationProblems(
  scenario: Scenario,
  cell: CellRecord
): string[] {
  const expect = scenario.expect;
  const problems: string[] = [];
  const say = (what: string, wanted: unknown, got: unknown): void => {
    problems.push(
      `${cell.id}: ${what} should be ${JSON.stringify(wanted)}, was ${JSON.stringify(got)}`
    );
  };
  if (cell.outcome !== expect.outcome)
    say('the outcome', expect.outcome, cell.outcome);
  if (cell.fixed_reason !== expect.fixed_reason) {
    say('the fixed reason', expect.fixed_reason, cell.fixed_reason);
  }
  if (cell.refusal !== expect.refusal)
    say('the refusal', expect.refusal, cell.refusal);
  if (expect.refusal === 'QUOTA_INSUFFICIENT' && !cell.balance_shown) {
    say('the balance shown with the refusal', true, cell.balance_shown);
  }
  if (
    cell.model_calls < expect.model_calls.min ||
    cell.model_calls > expect.model_calls.max
  ) {
    say(
      'the model calls',
      `${expect.model_calls.min} to ${expect.model_calls.max}`,
      cell.model_calls
    );
  }
  const judgement = cell.judgement;
  const regenerations = judgement?.regenerations ?? 0;
  const retries = judgement?.schema_retries ?? 0;
  if (regenerations !== expect.regenerations) {
    say('the regenerations', expect.regenerations, regenerations);
  }
  if (retries !== expect.schema_retries) {
    say('the schema retries', expect.schema_retries, retries);
  }
  if (expect.numbers_flagged !== null) {
    const flagged = judgement?.numbers_flagged ?? 0;
    if (flagged !== expect.numbers_flagged) {
      say('the numbers flagged', expect.numbers_flagged, flagged);
    }
  }
  if (cell.direction_stated !== (expect.direction === 'SYN')) {
    say(
      'the direction stated',
      expect.direction === 'SYN',
      cell.direction_stated
    );
  }
  if (expect.direction === 'SYN' && cell.direction_equals_syn !== true) {
    say(
      'the direction equal to the synthesis reading',
      true,
      cell.direction_equals_syn
    );
  }
  if (expect.news_status !== null && cell.news_status !== expect.news_status) {
    say('the calendar status', expect.news_status, cell.news_status);
  }
  if (cell.outcome === 'REPORT1') {
    if (judgement?.zones_valid !== expect.zones_valid) {
      say(
        'the zone ids valid',
        expect.zones_valid,
        judgement?.zones_valid ?? null
      );
    }
    if (judgement?.stand_aside_kept !== expect.stand_aside_kept) {
      say(
        'the stand-aside kept',
        expect.stand_aside_kept,
        judgement?.stand_aside_kept ?? null
      );
    }
  }
  if (!sameSet(cell.notes, expect.notes))
    say('the notes', expect.notes, cell.notes);
  if (cell.fallback_used !== expect.fallback_used) {
    say('the fallback used', expect.fallback_used, cell.fallback_used);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function scoredCellsOf(
  cells: readonly CellRecord[],
  scenarios: readonly Scenario[]
): ScoredCell[] {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  return cells.map((cell) => {
    const scenario = byId.get(cell.scenario);
    return {
      locale: cell.locale,
      scored: scenario !== undefined && isScored(scenario),
      judgement: cell.judgement,
      expectation_met:
        scenario !== undefined &&
        expectationProblems(scenario, cell).length === 0,
      units: cell.units,
      latency_ms: cell.latency_ms,
      model_replied: cell.judgement !== null,
      cost_estimated: cell.calls.some((call) => call.cost_estimated),
    };
  });
}

export function summarizeCells(
  cells: readonly CellRecord[],
  scenarios: readonly Scenario[]
): RunSummary {
  const scored = scoredCellsOf(cells, scenarios);
  const bars = evaluateBars(scored);
  return {
    cells: cells.length,
    scored_cells: scored.filter((cell) => cell.scored).length,
    bars,
    locales: localeScores(scored),
    cost_time: costTime(scored),
    all_pass: bars.every((bar) => bar.ok),
  };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/** The digest of a world (a cycle for one trader type): its dictionary and its synthesis reading. */
export async function worldDigestOf(
  packet: IntakePacket,
  dictionary: ValueDictionary
): Promise<string> {
  return sha256Hex(
    canonicalJson({
      slot: packet.data.cycle_slot,
      entries: dictionary.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        value: entry.value,
        tolerance: entry.tolerance,
        addressable: entry.addressable,
      })),
      synthesis: packet.readings.synthesis,
      board: packet.board,
    })
  );
}

export interface ReplayResult {
  /** what differs, in words; empty when the replay agrees with the record in every cell */
  problems: string[];
  summary: RunSummary;
}

const sameJson = (a: unknown, b: unknown): boolean =>
  canonicalJson(a ?? null) === canonicalJson(b ?? null);

/**
 * Recompute a run from its recorded replies, with no model call. `worldOf` gives the world a cell
 * ran on; the replay judges every cell again, compares with the recorded judgement, re-derives the
 * summary and checks it against the recorded one.
 */
export function replayRun(
  run: EvalRun,
  scenarios: readonly Scenario[],
  worldOf: (cell: CellRecord) => JudgeWorld
): ReplayResult {
  const problems: string[] = [];
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const replayed: CellRecord[] = run.cells.map((cell) => {
    const first = cell.calls[0]?.text;
    const judgement =
      first === undefined || first === null
        ? null
        : judgeReplies(
            worldOf(cell),
            cell.calls.map((call) => call.text)
          );
    if (!sameJson(judgement, cell.judgement)) {
      problems.push(
        `${cell.id}: the judgement of the recorded replies is not the recorded one`
      );
    }
    return { ...cell, judgement };
  });
  for (const cell of replayed) {
    const scenario = byId.get(cell.scenario);
    if (scenario === undefined) {
      problems.push(
        `${cell.id}: the scenario ${cell.scenario} is not in the set`
      );
    } else if (cell.id !== cellId(cell as CellKey)) {
      problems.push(
        `${cell.id}: the cell id does not name its scenario, trader, locale and pass`
      );
    }
  }
  const summary = summarizeCells(replayed, scenarios);
  if (!sameJson(summary, run.summary)) {
    problems.push('the summary of the run is not the summary of its cells');
  }
  return { problems, summary };
}

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

/**
 * The text of a run file: the header in two-space JSON and one cell to a line, so a diff of two runs
 * shows the cells that changed and `grep` finds a cell by its id. Ends with a newline. The file is
 * excluded from Prettier (`.prettierignore`), like the other recorded JSON.
 */
export function runFileText(run: EvalRun): string {
  const { cells, ...header } = run;
  const head = JSON.stringify(header, null, 2);
  const body = cells.map((cell) => '    ' + JSON.stringify(cell)).join(',\n');
  // the header ends with "\n}": reopen it to add the cells member
  return `${head.slice(0, head.length - 2)},\n  "cells": [\n${body}\n  ]\n}\n`;
}

// ---------------------------------------------------------------------------
// Structure of a run
// ---------------------------------------------------------------------------

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** Problems with the shape of a run file, in words; empty for a well-formed run. */
export async function runProblems(value: unknown): Promise<string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['the run is not an object'];
  }
  const run = value as Record<string, unknown>;
  const problems: string[] = [];
  if (run['schema'] !== RUN_SCHEMA)
    problems.push(`schema is not ${RUN_SCHEMA}`);
  if (typeof run['id'] !== 'string' || run['id'] === '')
    problems.push('id is empty');
  if (run['kind'] !== 'STAND_IN' && run['kind'] !== 'LIVE') {
    problems.push('kind is not STAND_IN or LIVE');
  }
  if (run['kind'] === 'STAND_IN' && run['label'] !== STAND_IN_LABEL) {
    problems.push('a stand-in run must carry the stand-in label word for word');
  }
  if (typeof run['made_on'] !== 'string' || !DATE.test(run['made_on'])) {
    problems.push('made_on is not a date');
  }
  if (!Number.isInteger(run['passes']) || (run['passes'] as number) < 1) {
    problems.push('passes is not a count from 1');
  }
  const model = run['model'] as Record<string, unknown> | undefined;
  if (
    typeof model !== 'object' ||
    model === null ||
    typeof model['slug'] !== 'string' ||
    typeof model['provider'] !== 'string'
  ) {
    problems.push('model is not { slug, provider }');
  }
  problems.push(...(await fingerprintProblems(run['fingerprint'])));
  if (!Array.isArray(run['cells']) || run['cells'].length === 0) {
    problems.push('cells is empty');
  }
  if (typeof run['summary'] !== 'object' || run['summary'] === null) {
    problems.push('summary is missing');
  }
  const fingerprint = run['fingerprint'] as Fingerprint | undefined;
  if (
    problems.length === 0 &&
    model !== undefined &&
    fingerprint !== undefined &&
    (fingerprint.model_slug !== model['slug'] ||
      fingerprint.provider !== model['provider'])
  ) {
    problems.push('the fingerprint names another model than the run does');
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export type GateCode =
  | 'NO_RUN'
  | 'RUN_MISSING'
  | 'STAND_IN_IS_NOT_EVIDENCE'
  | 'WRONG_MODEL'
  | 'STALE_FINGERPRINT'
  | 'BAR_FAILED'
  | 'LANGUAGES_INCOMPLETE'
  | 'BROKEN_RUN';

export interface GateProblem {
  model: string;
  code: GateCode;
  message: string;
}

/** The part of a registry row the gate reads. */
export interface GateModel {
  slug: string;
  status: string;
  eval_run: { id: string; date: string } | null;
  languages_ok: readonly string[];
}

/**
 * The release gate of architecture 5.10 over the registry: every `passed` model needs a LIVE
 * recorded run for the CURRENT fingerprint whose bars all hold. Returns the problems; none means
 * the gate is open. Candidates and retired models need nothing.
 */
export async function evalGate(input: {
  models: readonly GateModel[];
  runs: readonly EvalRun[];
  scenarios: readonly Scenario[];
  current: CurrentParts;
}): Promise<GateProblem[]> {
  const out: GateProblem[] = [];
  for (const model of input.models) {
    if (model.status !== 'passed') continue;
    const problem = (code: GateCode, message: string): void => {
      out.push({ model: model.slug, code, message });
    };
    if (model.eval_run === null) {
      problem('NO_RUN', 'the model is `passed` but names no evaluation run');
      continue;
    }
    const run = input.runs.find(
      (candidate) => candidate.id === model.eval_run?.id
    );
    if (run === undefined) {
      problem(
        'RUN_MISSING',
        `the run ${model.eval_run.id} is not under config/reply/eval-runs`
      );
      continue;
    }
    const broken = await runProblems(run);
    if (broken.length > 0) {
      problem('BROKEN_RUN', `the run ${run.id} is damaged: ${broken[0]}`);
      continue;
    }
    if (run.kind !== 'LIVE') {
      problem(
        'STAND_IN_IS_NOT_EVIDENCE',
        `the run ${run.id} is a stand-in run: it measures nothing about a model`
      );
      continue;
    }
    if (run.model.slug !== model.slug) {
      problem('WRONG_MODEL', `the run ${run.id} is of ${run.model.slug}`);
      continue;
    }
    const now = await currentFingerprint(
      { slug: model.slug, provider: run.model.provider },
      input.current
    );
    if (now.sha256 !== run.fingerprint.sha256) {
      problem(
        'STALE_FINGERPRINT',
        `the run ${run.id} is for another configuration: ${fingerprintDifferences(run.fingerprint, now).join('; ')}`
      );
      continue;
    }
    // the bars again, from the cells, not from the summary the file carries
    const summary = summarizeCells(run.cells, input.scenarios);
    for (const bar of summary.bars) {
      if (!bar.ok)
        problem('BAR_FAILED', `${bar.test}: ${bar.bar} (${bar.detail})`);
    }
    const within = new Set(
      summary.locales.filter((score) => score.ok).map((score) => score.locale)
    );
    const missing = EVAL_LOCALES.filter(
      (locale) => !within.has(locale) || !model.languages_ok.includes(locale)
    );
    if (missing.length > 0) {
      problem(
        'LANGUAGES_INCOMPLETE',
        `languages_ok must list all 19 locales and the run must hold each: ${missing.join(', ')}`
      );
    }
  }
  return out;
}
