/**
 * The composer (build step 7 part 5; architecture 5.2 step 7, 5.7, ADR-052, plan decisions D10,
 * D11, D12): turns what the model wrote and what the engines said into the reply the trader
 * reads, a `reply-result/1` that the contract accepts.
 *
 * WHAT COMES FROM WHERE (`REPORT1_SECTIONS`, decision D10)
 *   1 summary        the headline is the model's (placeholders filled); the DIRECTION line is the
 *                    synthesis reading's, copied, never the model's;
 *   2 alignment      the trend relation and the two channels' status, state code and bias are the
 *                    engines'; the model's `rationale` lines, filled, explain them;
 *   3 levels         the engines' alone: the sensors' channel geometry and the context levels;
 *   4 zones          the stored entry zones the model picked, field for field;
 *   5 what changes   the model's `watch` lines, filled; a chosen zone whose invalidation no line
 *                    gives gets one from the stored zone (the structural "always" row, D12);
 *   6 risks and news the model's `risks` lines, filled, and the calendar block as the packet has it.
 *
 * NUMBERS. A literal the number check could not verify, even after the one regeneration, is
 * replaced by the "not verified" mark of the reply's language BEFORE the placeholders are filled
 * (the check's spans are in the model's own text); a figure the model never typed reaches the
 * reply only by its id. A placeholder that cannot be filled fails the composition: a sentence
 * with a hole in it is not shown.
 *
 * A COMPOSITION THAT THE CONTRACT REFUSES IS A BUG, NOT A REPLY: the result is validated before it
 * is returned and a refusal comes back as `INVALID_RESULT` with the contract's own words.
 *
 * Pure.
 *
 * @module lib/reply/report1/compose
 */

import { answerTexts } from '../contracts/answer';
import type { AnswerModel } from '../contracts/answer';
import { flagAll } from '../checks/number-check';
import type { NumberViolation } from '../checks/number-check';
import type { ValueDictionary } from '../checks/value-dictionary';
import { missingInvalidationLines } from '../checks/wording-check';
import { secondsOfSlot } from '../contracts/intake';
import type { IntakePacket, Locale } from '../contracts/intake';
import { report1Texts } from '../contracts/report1';
import type { Report1Model } from '../contracts/report1';
import { validateReplyResult } from '../contracts/result';
import type {
  AnswerResult,
  ComposedReport1,
  DirectionLine,
  ResolvedLine,
  Report1Result,
  TradeSetupAction,
} from '../contracts/result';
import { actionZoneIds } from '../gate/shape';
import { invalidationText } from './invalidation-line';
import { resolveLines, resolveText } from './resolve';
import type { ResolveFailure, ResolveOptions } from './resolve';
import {
  channelLines,
  directionLine,
  levelLines,
  newsBlock,
  zoneLines,
} from './sections';
import type { SectionFailure } from './sections';
import { buildResultBase } from './stamp';
import type { ReplyFrame } from './stamp';

export type { ReplyFrame } from './stamp';

export type ComposeFailureCode =
  | SectionFailure['code']
  | ResolveFailure['code']
  | 'LOCALE_MISMATCH'
  | 'INVALID_RESULT';

export interface ComposeFailure {
  code: ComposeFailureCode;
  /** where in the reply, when the failure has a place */
  path: string | null;
  detail: string;
}

export type ComposeOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; failures: ComposeFailure[] };

const fromSection = (failure: SectionFailure): ComposeFailure => ({
  code: failure.code,
  path: null,
  detail: failure.detail,
});

const fromResolve = (failure: ResolveFailure): ComposeFailure => ({
  code: failure.code,
  path: failure.path,
  detail: failure.detail,
});

export function resolveOptionsOf(packet: IntakePacket): ResolveOptions {
  return {
    locale: packet.question.reply_locale,
    referenceSeconds: secondsOfSlot(packet.data.cycle_slot),
  };
}

// ---------------------------------------------------------------------------
// Unverified numbers
// ---------------------------------------------------------------------------

/** How many of the violations name a text this reply has (the rest are not applied and not counted). */
function appliedCount(
  paths: ReadonlySet<string>,
  flagged: readonly NumberViolation[]
): number {
  return flagged.filter((violation) => paths.has(violation.path)).length;
}

/**
 * The model's report with each unverified literal replaced by the "not verified" mark of the
 * locale. The texts come back in the order `report1Texts` lists them, which is how they are put
 * back.
 */
export function flagReport1(
  model: Report1Model,
  flagged: readonly NumberViolation[],
  locale: Locale
): Report1Model {
  if (flagged.length === 0) return model;
  const texts = flagAll(report1Texts(model), flagged, locale);
  let next = 0;
  const take = (): string => (texts[next++] as { text: string }).text;
  return {
    headline: take(),
    zones: [...model.zones],
    rationale: model.rationale.map((line) => ({ ...line, text: take() })),
    watch: model.watch.map((line) => ({ ...line, text: take() })),
    risks: model.risks.map((line) => ({ ...line, text: take() })),
  };
}

// ---------------------------------------------------------------------------
// Report 1
// ---------------------------------------------------------------------------

export interface ComposeReport1Input {
  packet: IntakePacket;
  dictionary: ValueDictionary;
  /** the model's report, checked against the packet's context (`validateReport1`) */
  model: Report1Model;
  /** the literals still unverified after the one regeneration (`decideFinal`) */
  flagged?: readonly NumberViolation[];
}

export interface ComposedReport {
  report: ComposedReport1;
  /** how many literals were replaced by the "not verified" mark */
  numbersFlagged: number;
  /** the zones whose invalidation line the server had to add */
  addedInvalidation: string[];
}

/** Does this direction line say what the packet's synthesis reading says? Compared field by field. */
export function directionEqualsSynthesis(
  packet: IntakePacket,
  direction: DirectionLine
): boolean {
  const synthesis = packet.readings.synthesis;
  if (synthesis === null) return false;
  const reading = synthesis.reading;
  return (
    direction.bias === reading['bias'] &&
    direction.trend_relation === (reading['trend_relation'] ?? null) &&
    direction.rule_id === reading['rule_id'] &&
    direction.archetype === (reading['archetype'] ?? null) &&
    direction.stand_aside === reading['stand_aside'] &&
    direction.profile === synthesis.profile
  );
}

/** The six sections of Report 1. */
export function composeReport1(
  input: ComposeReport1Input
): ComposeOutcome<ComposedReport> {
  const { packet, dictionary } = input;
  const options = resolveOptionsOf(packet);
  const locale = options.locale;

  const direction = directionLine(packet);
  if (!direction.ok)
    return { ok: false, failures: [fromSection(direction.failure)] };
  const zones = zoneLines(packet, input.model.zones);
  if (!zones.ok) return { ok: false, failures: [fromSection(zones.failure)] };

  const flagged = input.flagged ?? [];
  const shown = flagReport1(input.model, flagged, locale);
  const numbersFlagged = appliedCount(
    new Set(report1Texts(input.model).map((text) => text.path)),
    flagged
  );

  const headline = resolveText(shown.headline, 'headline', dictionary, options);
  const rationale = resolveLines(
    shown.rationale,
    'rationale',
    dictionary,
    options
  );
  const watch = resolveLines(shown.watch, 'watch', dictionary, options);
  const risks = resolveLines(shown.risks, 'risks', dictionary, options);

  // the structural row: every chosen zone says where it is cancelled
  const addedInvalidation = missingInvalidationLines(
    input.model.zones,
    input.model.watch
  );
  const added = addedInvalidation.map((zoneId, index) => ({
    zoneId,
    line: resolveText(
      invalidationText(locale, zoneId),
      `watch[${input.model.watch.length + index}].text`,
      dictionary,
      options
    ),
  }));

  const failures = [
    headline,
    rationale,
    watch,
    risks,
    ...added.map((a) => a.line),
  ].flatMap((result) => (result.ok ? [] : result.failures.map(fromResolve)));
  if (failures.length > 0) return { ok: false, failures };

  // nothing failed: every resolution above is a success
  const filled = <T extends { ok: boolean }>(
    result: T
  ): Extract<T, { ok: true }> => result as Extract<T, { ok: true }>;
  const addedLines: ResolvedLine[] = added.map(({ zoneId, line }) => ({
    text: filled(line).text,
    cites: [zoneId],
  }));

  return {
    ok: true,
    value: {
      report: {
        headline: filled(headline).text,
        direction: direction.value,
        alignment: {
          trend_relation: direction.value.trend_relation,
          channels: channelLines(packet),
          lines: filled(rationale).lines,
        },
        levels: levelLines(packet, dictionary),
        zones: zones.value,
        watch: [...filled(watch).lines, ...addedLines],
        risks: filled(risks).lines,
        news: newsBlock(packet),
      },
      numbersFlagged,
      addedInvalidation,
    },
  };
}

export interface ComposedReport1Result {
  result: Report1Result;
  /** for the trace: the structured direction equals the synthesis reading (`checks.direction_equals_syn`) */
  directionEqualsSyn: boolean;
  addedInvalidation: string[];
}

function invalidResult(
  issues: readonly { path: string; code: string; message: string }[]
): ComposeFailure[] {
  return issues.map((issue) => ({
    code: 'INVALID_RESULT' as const,
    path: issue.path,
    detail: `${issue.code}: ${issue.message}`,
  }));
}

/** The whole `reply-result/1` of a Report 1, validated. */
export function composeReport1Result(
  input: ComposeReport1Input & { frame: ReplyFrame }
): ComposeOutcome<ComposedReport1Result> {
  const composed = composeReport1(input);
  if (!composed.ok) return composed;
  const result: Report1Result = {
    ...buildResultBase(
      input.packet,
      { ...input.frame, numbersFlagged: composed.value.numbersFlagged },
      'REPORT1'
    ),
    report: composed.value.report,
  };
  const verdict = validateReplyResult(result);
  if (!verdict.ok)
    return { ok: false, failures: invalidResult(verdict.issues) };
  return {
    ok: true,
    value: {
      result,
      directionEqualsSyn: directionEqualsSynthesis(
        input.packet,
        composed.value.report.direction
      ),
      addedInvalidation: composed.value.addedInvalidation,
    },
  };
}

// ---------------------------------------------------------------------------
// A short answer
// ---------------------------------------------------------------------------

export interface ComposeAnswerInput {
  packet: IntakePacket;
  dictionary: ValueDictionary;
  /** the model's answer, checked against the packet's context (`validateAnswer`) */
  model: AnswerModel;
  flagged?: readonly NumberViolation[];
  /** the gate lets the Trade Setup modal open (`report2Open(gate.report2)`) */
  report2Open: boolean;
  /** the stored zone ids of the cycle, when the packet carries no readings */
  zoneIds?: readonly string[];
  frame: ReplyFrame;
}

/**
 * The whole `reply-result/1` of a short answer, validated. The action the model asked for is kept
 * only when the gate lets Report 2 open and there is a cycle to open it on; the cycle, the trader
 * type and the zones are the server's, never the model's.
 */
export function composeAnswerResult(
  input: ComposeAnswerInput
): ComposeOutcome<AnswerResult> {
  const { packet, dictionary, model } = input;
  const options = resolveOptionsOf(packet);
  if (model.locale !== options.locale) {
    return {
      ok: false,
      failures: [
        {
          code: 'LOCALE_MISMATCH',
          path: 'locale',
          detail: `the answer is written in ${model.locale}, the reply in ${options.locale}`,
        },
      ],
    };
  }

  const flagged = input.flagged ?? [];
  const paths = new Set(answerTexts(model).map((text) => text.path));
  const shown = flagAll(answerTexts(model), flagged, options.locale);
  const text = resolveText(
    (shown[0] as { text: string }).text,
    'text',
    dictionary,
    options
  );
  if (!text.ok) return { ok: false, failures: text.failures.map(fromResolve) };

  let action: TradeSetupAction | null = null;
  if (
    model.action === 'OPEN_TRADE_SETUP' &&
    input.report2Open &&
    packet.data.cycle_slot !== null
  ) {
    action = {
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: packet.data.cycle_slot,
      trader_type: packet.profile.trader_type,
      zone_ids: actionZoneIds(
        input.zoneIds ??
          (packet.readings.synthesis?.zones ?? []).map((zone) =>
            String(zone['zone_id'])
          )
      ),
    };
  }

  const result: AnswerResult = {
    ...buildResultBase(
      packet,
      { ...input.frame, numbersFlagged: appliedCount(paths, flagged) },
      'ANSWER'
    ),
    answer: { text: text.text, cites: [...model.cites] },
    action,
  };
  const verdict = validateReplyResult(result);
  if (!verdict.ok)
    return { ok: false, failures: invalidResult(verdict.issues) };
  return { ok: true, value: result };
}
