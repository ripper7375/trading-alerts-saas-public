/**
 * The checks of one reply, run in order and reported as the trace's `ChecksGroup` (build step 7
 * part 4; architecture 5.8 and 5.9, plan decisions D11 and D12).
 *
 * THE FLOW (one shared regeneration, D11)
 *   1. `runChecks` the model's texts: numbers against the dictionary, then wording.
 *   2. `decideFirst`: nothing failed -> deliver. Something failed and the balance allows one more
 *      call -> REGENERATE once, naming the numbers that failed and the kinds of phrase to avoid.
 *      Something failed and no regeneration is possible -> a wording failure gives the fixed
 *      answer, a number failure is flagged.
 *   3. `decideFinal` after the regeneration, on its texts: a wording failure again -> the fixed
 *      answer (`WORDING_FAILED`); numbers still unmatched -> flagged as "not verified" (the reply
 *      is shown); nothing -> deliver. There is no second regeneration, whichever check failed first.
 *   4. `buildChecksGroup` reports it for the trace: the first pass's counts (so `extracted` =
 *      `matched` + `violations` and the class counts add up), the numbers still flagged at the end,
 *      whether a fixed answer replaced the reply, and the regeneration count.
 *
 * The structural "always" rows (decision D12) are not here: the invalidation line, the stamp,
 * the disclaimer and the statistics' n are guaranteed by how the server composes the reply
 * (`missingInvalidationLines` tells the composer what to add), so they cost no model call.
 *
 * Pure: `runChecks` is a function of its input, so running it again on the same texts gives the
 * same answer (idempotent), and nothing is kept between calls.
 *
 * @module lib/reply/checks/report
 */

import { answerTexts } from '../contracts/answer';
import type { AnswerModel } from '../contracts/answer';
import type { Bias, Locale } from '../contracts/intake';
import { report1Texts } from '../contracts/report1';
import type { Report1Model } from '../contracts/report1';
import type { FixedReason } from '../contracts/result';
import type {
  TraceAnswerGate,
  TraceChecksGroup,
  WordingCategory,
} from '../contracts/trace-fields';
import type { ReplyShape } from '../contracts/trace-fields';
import { checkNumbers, failedLiterals } from './number-check';
import type { NumberCheckResult, NumberViolation } from './number-check';
import type { ValueDictionary } from './value-dictionary';
import { checkWording, missingInvalidationLines } from './wording-check';
import type { ModelText, WordingResult } from './wording-check';

// ---------------------------------------------------------------------------
// One pass
// ---------------------------------------------------------------------------

export interface ChecksInput {
  /** the model's texts with their paths (`report1Texts` / `answerTexts`), placeholders intact */
  texts: readonly ModelText[];
  dictionary: ValueDictionary;
  /** the locale the reply is written in */
  locale: Locale;
  /** the synthesis reading's bias; null when the synthesis is not running */
  bias: Bias | null;
}

export interface CheckPass {
  numbers: NumberCheckResult;
  wording: WordingResult;
}

/** The two checks on one set of texts. */
export function runChecks(input: ChecksInput): CheckPass {
  return {
    numbers: checkNumbers(input.texts, input.dictionary, input.locale),
    wording: checkWording(input.texts, input.locale, input.bias),
  };
}

/** What the checks need besides the model's own words: the cycle's dictionary, the reply's locale and the synthesis bias. */
export interface ChecksContext {
  dictionary: ValueDictionary;
  /** the locale the reply is written in */
  locale: Locale;
  /** the synthesis reading's bias; null when the synthesis is not running */
  bias: Bias | null;
}

export interface Report1Checks extends CheckPass {
  /** the chosen zones whose invalidation no `watch` line gives: the composer adds the line itself (decision D12) */
  missingInvalidation: string[];
}

/** The checks of a `report1.v1` the model returned, over its five fields. */
export function checkReport1(
  report: Report1Model,
  context: ChecksContext
): Report1Checks {
  return {
    ...runChecks({ texts: report1Texts(report), ...context }),
    missingInvalidation: missingInvalidationLines(report.zones, report.watch),
  };
}

/** The checks of an `answer.v1`: the locale it declares is the language it is read in. */
export function checkAnswer(
  answer: AnswerModel,
  context: Omit<ChecksContext, 'locale'>
): CheckPass {
  return runChecks({
    texts: answerTexts(answer),
    ...context,
    locale: answer.locale,
  });
}

export const passFailed = (pass: CheckPass): boolean =>
  pass.numbers.violations.length > 0 || pass.wording.violations > 0;

// ---------------------------------------------------------------------------
// What to ask the model when it is asked again
// ---------------------------------------------------------------------------

export interface RegenerationRequest {
  /** the literals that were not in the context, exactly as the model wrote them */
  numbers: string[];
  /** the kinds of phrase that were found, with the list phrase that matched (no stars) */
  wording: { category: WordingCategory; phrase: string }[];
}

export function regenerationRequest(pass: CheckPass): RegenerationRequest {
  const seen = new Set<string>();
  const wording: RegenerationRequest['wording'] = [];
  for (const finding of pass.wording.findings) {
    const phrase = finding.phrase.replace(/\*/g, '');
    const key = `${finding.category}|${phrase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wording.push({ category: finding.category, phrase });
  }
  return { numbers: failedLiterals(pass.numbers), wording };
}

// ---------------------------------------------------------------------------
// The two decisions
// ---------------------------------------------------------------------------

export type FirstAction =
  | 'DELIVER'
  | 'REGENERATE'
  | 'FLAG_NUMBERS'
  | 'FIXED_ANSWER';
export type FinalAction = 'DELIVER' | 'FLAG_NUMBERS' | 'FIXED_ANSWER';

export interface FirstDecision {
  action: FirstAction;
  request: RegenerationRequest | null;
  fixedReason: FixedReason | null;
}

/**
 * After the first pass. `canRegenerate` is false when the quota cannot cover one more call, the
 * deadline is near, or the model is down: the numbers are then flagged instead (the plan's rule)
 * and a wording failure goes straight to the fixed answer.
 */
export function decideFirst(
  first: CheckPass,
  canRegenerate: boolean
): FirstDecision {
  if (!passFailed(first)) {
    return { action: 'DELIVER', request: null, fixedReason: null };
  }
  if (canRegenerate) {
    return {
      action: 'REGENERATE',
      request: regenerationRequest(first),
      fixedReason: null,
    };
  }
  if (first.wording.violations > 0) {
    return {
      action: 'FIXED_ANSWER',
      request: null,
      fixedReason: 'WORDING_FAILED',
    };
  }
  return { action: 'FLAG_NUMBERS', request: null, fixedReason: null };
}

export interface FinalDecision {
  action: FinalAction;
  fixedReason: FixedReason | null;
  /** the literals to replace by the "not verified" mark, in the texts that are delivered */
  flagged: NumberViolation[];
}

/**
 * The end. `delivered` is the pass of the texts that would be shown: the second pass after a
 * regeneration, the first when there was none.
 */
export function decideFinal(delivered: CheckPass): FinalDecision {
  if (delivered.wording.violations > 0) {
    return {
      action: 'FIXED_ANSWER',
      fixedReason: 'WORDING_FAILED',
      flagged: [],
    };
  }
  if (delivered.numbers.violations.length > 0) {
    return {
      action: 'FLAG_NUMBERS',
      fixedReason: null,
      flagged: delivered.numbers.violations,
    };
  }
  return { action: 'DELIVER', fixedReason: null, flagged: [] };
}

// ---------------------------------------------------------------------------
// The trace's checks group
// ---------------------------------------------------------------------------

export interface ChecksGroupInput {
  first: CheckPass;
  /** the pass over the regenerated texts; null when the model was not asked again */
  second: CheckPass | null;
  final: FinalDecision;
  /** what the request tried to produce */
  shape: ReplyShape;
  answerGate: TraceAnswerGate | null;
  /** times the model's JSON failed its schema and was asked again (part 7) */
  schemaRetries: number;
  /** from the composer (part 5): the structured direction equals the synthesis reading */
  directionEqualsSyn: boolean | null;
  /**
   * A reason that is not the checks' own (the data stopped, the schema failed, the model was
   * down, the deadline passed). When given it wins over the checks' reason.
   */
  otherFixedReason?: FixedReason | null;
}

/** The checks group of a trace, as the composer and the orchestrator call it. */
export type ChecksGroup = TraceChecksGroup;

/** The `checks` group of `request_traces` (`contracts/trace-fields.ts`). */
export function buildChecksGroup(input: ChecksGroupInput): ChecksGroup {
  const { first, second, final } = input;
  return {
    answer_gate: input.answerGate,
    shape: input.shape,
    schema_retries: input.schemaRetries,
    numbers: {
      extracted: first.numbers.extracted,
      matched: first.numbers.matched,
      violations: first.numbers.violations.length,
      flagged: final.flagged.length,
      classes: { ...first.numbers.classes },
    },
    wording: {
      violations: first.wording.violations,
      categories: { ...first.wording.categories },
      fixed_answer: final.action === 'FIXED_ANSWER',
    },
    regenerations: second === null ? 0 : 1,
    direction_equals_syn: input.directionEqualsSyn,
    fixed_reason: input.otherFixedReason ?? final.fixedReason,
  };
}
