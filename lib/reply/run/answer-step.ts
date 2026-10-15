/**
 * The metered model execution of one request (architecture 5.2 steps 3 to 6, 5.8, 5.9, 5.10;
 * build step 7 part 7a; ADR-055; decisions D11, D23).
 *
 * It takes a packet the answer gate let through and the shape (Report 1 or a short answer), and
 * either returns the model's checked words or says why a FIXED ANSWER must be sent instead:
 *
 *   assemble the prompt (caps, cut order, chart slot) > call the primary model, the fallback on a
 *   failure > read the JSON > check the schema > the numbers and the wording > ONE extra call if
 *   something failed and the hold allows it > decide: deliver, flag the numbers still unverified,
 *   or send the fixed answer.
 *
 * ONE EXTRA CALL. The hold covers the answer twice and no more. The extra call is spent on the
 * first thing that goes wrong: JSON that is not the schema (a "schema retry") or a number or phrase
 * that fails its check (the "regeneration" of decision D11). Whichever it was spent on, there is no
 * second one; a reply that is still wrong after it is flagged (numbers) or replaced by the fixed
 * answer (wording, schema). A failed extra call falls back to the first reply: its numbers are
 * flagged, a wording failure is the fixed answer.
 *
 * WHEN IT STOPS. The request's deadline reaches every call as an abort signal, so a call that is
 * still running when the deadline passes ends at once and the answer is the board-only fixed one
 * (`DEADLINE`). A client that has left is not an abort signal here: once a model call has been
 * sent the run is finished and paid for (see `Hold`).
 *
 * Nothing here composes the reply or touches storage: the result is the model's words, the passes
 * of the checks and what the calls cost; the orchestrator composes, settles and stores.
 *
 * Pure: the model, the clock and the log are ports.
 *
 * @module lib/reply/run/answer-step
 */

import answer1Schema from '@/config/reply/answer-1.schema.json';
import report1Schema from '@/config/reply/report1-1.schema.json';

import { emptyClassCounts } from '../checks/number-check';
import type { NumberViolation } from '../checks/number-check';
import {
  checkAnswer,
  checkReport1,
  decideFinal,
  decideFirst,
} from '../checks/report';
import type { CheckPass, FinalDecision } from '../checks/report';
import {
  addressableIds,
  buildValueDictionary,
} from '../checks/value-dictionary';
import type { ValueDictionary } from '../checks/value-dictionary';
import { emptyCategoryCounts } from '../checks/wording-check';
import { assemble, sealAssembly } from '../context/assemble';
import { capOf } from '../context/caps';
import type { HistoryRow } from '../context/history';
import type { DayBars } from '../context/ohlc-compact';
import { PROMPTS_VERSION } from '../context/static-text';
import { estimateRawTokens } from '../context/tokens';
import { validateAnswer } from '../contracts/answer';
import type { AnswerModel } from '../contracts/answer';
import { BIASES } from '../contracts/intake';
import type { Bias, IntakePacket, Issue } from '../contracts/intake';
import { validateReport1 } from '../contracts/report1';
import type { Report1Model } from '../contracts/report1';
import type { FixedReason } from '../contracts/result';
import { contextOfPacket } from '../contracts/shape';
import type { Validation } from '../contracts/shape';
import type { ContextComponent, ReplyShape } from '../contracts/trace-fields';
import { completeWithFallback } from '../gateway/fallback';
import type { FallbackOutcome } from '../gateway/fallback';
import { messagesFromPrompt } from '../gateway/messages';
import type { ChatMessage, ModelRequest } from '../gateway/types';
import type { ChartRead } from '../read/chart';
import type { Hold } from './hold';
import { checkRetryMessage, schemaRetryMessage } from './regenerate';
import type { ReplyPorts } from './types';

/** An extra call needs at least this long before the deadline: a call can take most of 20 seconds. */
export const MIN_EXTRA_CALL_MS = 12_000;

/** What the chart costs the model in tokens, declared to the assembler: the cap of its row of 5.4. */
export const CHART_TOKENS = capOf('CHART').cap;

const TEMPERATURE = 0.2;

export interface AnswerStepInput {
  ports: ReplyPorts;
  hold: Hold;
  packet: IntakePacket;
  shape: Extract<ReplyShape, 'REPORT1' | 'ANSWER'>;
  chart: ChartRead;
  dayBars: DayBars | null;
  history: readonly HistoryRow[];
  /** the request's deadline: the signal the calls obey and the instant it passes (ms) */
  deadline: { signal: AbortSignal; atMs: number };
  now: () => number;
  /** called once, when the first reply has come back and its checking begins */
  onFirstReply?: () => void;
}

/** What the checks saw, for the trace's checks group (built once the composer has judged the direction). */
export interface CheckRecord {
  first: CheckPass;
  second: CheckPass | null;
  final: FinalDecision;
  /** times the model's JSON failed its schema and was asked again */
  schemaRetries: number;
}

/** What every step that got as far as a prompt reports. */
export interface StepFacts {
  /** the dictionary of the cycle; null when no prompt could be made */
  dictionary: ValueDictionary | null;
  components: Record<ContextComponent, number> | null;
  cycleBlockSha256: string | null;
  promptVersion: string;
  /** a call went to the fallback model */
  fallbackUsed: boolean;
  record: CheckRecord;
}

export type FixedByStep = Extract<
  FixedReason,
  'WORDING_FAILED' | 'SCHEMA_FAILED' | 'MODEL_UNAVAILABLE' | 'DEADLINE'
>;

export type AnswerStep =
  | (StepFacts & {
      ok: true;
      shape: 'REPORT1';
      model: Report1Model;
      /** the model that wrote the delivered reply */
      slug: string;
      flagged: NumberViolation[];
    })
  | (StepFacts & {
      ok: true;
      shape: 'ANSWER';
      model: AnswerModel;
      slug: string;
      flagged: NumberViolation[];
    })
  | (StepFacts & { ok: false; reason: FixedByStep });

/** The client left before any model was called: nothing was spent. */
export interface AnswerAborted {
  ok: false;
  reason: 'ABORTED';
}

export const isAborted = (
  step: AnswerStep | AnswerAborted
): step is AnswerAborted => step.ok === false && step.reason === 'ABORTED';

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

export function emptyPass(): CheckPass {
  return {
    numbers: {
      extracted: 0,
      exempt: 0,
      matched: 0,
      matchRate: 1,
      violations: [],
      classes: emptyClassCounts(),
      needsRegeneration: false,
    },
    wording: {
      ok: true,
      findings: [],
      violations: 0,
      categories: emptyCategoryCounts(),
      languages: [],
      unsupportedLocale: false,
    },
  };
}

const NO_FLAGS: FinalDecision = {
  action: 'DELIVER',
  fixedReason: null,
  flagged: [],
};

/** How many of the calendar's events the prompt lists: the ones the assembler kept. */
export function eventsShownOf(total: number, omitted: number): number {
  return Math.max(0, total - omitted);
}

/** The synthesis reading's bias, or null when the synthesis is not running. */
export function synthesisBias(packet: IntakePacket): Bias | null {
  const bias = packet.readings.synthesis?.reading['bias'];
  return typeof bias === 'string' &&
    (BIASES as readonly string[]).includes(bias)
    ? (bias as Bias)
    : null;
}

type Parsed<T> =
  | { ok: true; model: T }
  | { ok: false; outcome: 'BAD_JSON' | 'BAD_SCHEMA'; issues: Issue[] };

function parseModel<T>(
  text: string,
  validate: (value: unknown) => Validation<T>
): Parsed<T> {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    return { ok: false, outcome: 'BAD_JSON', issues: [] };
  }
  const checked = validate(value);
  return checked.ok
    ? { ok: true, model: checked.value }
    : { ok: false, outcome: 'BAD_SCHEMA', issues: checked.issues };
}

const quietRecord = (schemaRetries = 0): CheckRecord => ({
  first: emptyPass(),
  second: null,
  final: NO_FLAGS,
  schemaRetries,
});

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export async function runAnswerStep(
  input: AnswerStepInput
): Promise<AnswerStep | AnswerAborted> {
  const { ports, hold, packet, shape, deadline } = input;
  const primary = ports.models.primary;
  const locale = packet.question.reply_locale;
  const bias = synthesisBias(packet);

  /** A step that ends in the fixed answer; `facts` are whatever it got to know before it did. */
  const fixed = (
    reason: FixedByStep,
    facts: Partial<StepFacts> = {}
  ): AnswerStep => ({
    ok: false,
    reason,
    dictionary: null,
    components: null,
    cycleBlockSha256: null,
    promptVersion: PROMPTS_VERSION,
    fallbackUsed: false,
    record: quietRecord(),
    ...facts,
  });

  if (primary === null) {
    ports.log('NO_PRIMARY_MODEL');
    return fixed('MODEL_UNAVAILABLE');
  }

  // ---- the prompt -------------------------------------------------------------
  const chartImage = input.chart.image;
  const assembled = assemble({
    packet,
    dayBars: input.dayBars,
    history: input.history,
    chart:
      chartImage === null
        ? null
        : { ref: chartImage.ref, tokens: CHART_TOKENS },
    modelBudget: primary.target.context_budget,
    calibration: primary.target.calibration,
  });
  if (!assembled.ok) {
    ports.log('ASSEMBLE_REFUSED', { code: assembled.code });
    return fixed('MODEL_UNAVAILABLE');
  }
  const sealed = await sealAssembly(assembled);
  const dictionary = buildValueDictionary(packet, input.dayBars, {
    eventsShown: eventsShownOf(
      packet.events.items.length,
      sealed.eventsOmitted
    ),
  });
  const context = contextOfPacket(packet, addressableIds(dictionary));
  let fallbackUsed = false;
  const facts = (record: CheckRecord): StepFacts => ({
    dictionary,
    components: { ...sealed.componentTokens },
    cycleBlockSha256: sealed.hashes.cycle,
    promptVersion: PROMPTS_VERSION,
    fallbackUsed,
    record,
  });

  const { messages } = messagesFromPrompt(
    sealed.prompt,
    chartImage === null ? {} : { [chartImage.ref]: chartImage.dataUrl }
  );
  const response: ModelRequest['response'] =
    shape === 'REPORT1'
      ? { kind: 'JSON_SCHEMA', name: 'report1_v1', schema: report1Schema }
      : { kind: 'JSON_SCHEMA', name: 'answer_v1', schema: answer1Schema };

  /** One call (the primary, then the fallback), reported to the hold. `extra` says what an extra call is for. */
  const call = async (
    conversation: readonly ChatMessage[],
    extraText: string,
    extra: 'CHECKS' | null
  ): Promise<FallbackOutcome> => {
    hold.markDispatched();
    const outcome = await completeWithFallback(ports.models, {
      messages: conversation,
      max_output_tokens: primary.target.max_output_tokens,
      temperature: TEMPERATURE,
      response,
      signal: deadline.signal,
      estimated_prompt_tokens: sealed.total + estimateRawTokens(extraText),
    });
    for (const attempt of outcome.attempts) {
      if (attempt.slot === 'FALLBACK') fallbackUsed = true;
      hold.report(
        attempt.slot === 'FALLBACK'
          ? 'FALLBACK'
          : extra === 'CHECKS'
            ? 'REGENERATE'
            : 'ANSWER',
        attempt.result
      );
    }
    return outcome;
  };

  const readReply = (text: string): Parsed<Report1Model | AnswerModel> =>
    parseModel<Report1Model | AnswerModel>(text, (value) =>
      shape === 'REPORT1'
        ? validateReport1(value, context)
        : validateAnswer(value, context)
    );
  const checkReply = (model: Report1Model | AnswerModel): CheckPass =>
    shape === 'REPORT1'
      ? checkReport1(model as Report1Model, { dictionary, locale, bias })
      : checkAnswer(model as AnswerModel, { dictionary, bias });

  const extraAvailable = (): boolean =>
    hold.regenerationAllowed &&
    !deadline.signal.aborted &&
    deadline.atMs - input.now() >= MIN_EXTRA_CALL_MS;

  /** The conversation that asks for the reply again. */
  const askAgain = (
    badReply: string,
    instruction: string
  ): readonly ChatMessage[] => [
    ...messages,
    { role: 'assistant', content: badReply },
    { role: 'user', content: instruction },
  ];

  // ---- the first call ---------------------------------------------------------
  if (hold.checkpoint()) return { ok: false, reason: 'ABORTED' };
  const firstCall = await call(messages, '', null);
  if (firstCall.answer === null) {
    ports.log('MODEL_FAILED', { failure: firstCall.failure ?? 'NONE' });
    return fixed(
      deadline.signal.aborted ? 'DEADLINE' : 'MODEL_UNAVAILABLE',
      facts(quietRecord())
    );
  }
  input.onFirstReply?.();

  let answerText = firstCall.answer.text;
  let answerSlug = firstCall.answer.model;
  let reply = readReply(answerText);
  let schemaRetries = 0;
  let extraSpent = false;

  if (!reply.ok) {
    hold.reclassifyLast(reply.outcome);
    if (!extraAvailable()) {
      ports.log('SCHEMA_FAILED', { retries: 0 });
      return fixed('SCHEMA_FAILED', facts(quietRecord()));
    }
    // the schema retry takes the one extra call
    extraSpent = true;
    schemaRetries = 1;
    const instruction = schemaRetryMessage(reply.issues);
    const retry = await call(
      askAgain(answerText, instruction),
      `${answerText}\n${instruction}`,
      null
    );
    if (retry.answer === null) {
      ports.log('SCHEMA_RETRY_FAILED');
      return fixed('SCHEMA_FAILED', facts(quietRecord(schemaRetries)));
    }
    answerText = retry.answer.text;
    answerSlug = retry.answer.model;
    reply = readReply(answerText);
    if (!reply.ok) {
      hold.reclassifyLast(reply.outcome);
      ports.log('SCHEMA_FAILED', { retries: 1 });
      return fixed('SCHEMA_FAILED', facts(quietRecord(schemaRetries)));
    }
  }

  // ---- the checks ---------------------------------------------------------------
  let delivered = reply.model;
  const firstPass = checkReply(delivered);
  const firstDecision = decideFirst(firstPass, !extraSpent && extraAvailable());
  let secondPass: CheckPass | null = null;

  if (firstDecision.request !== null) {
    const instruction = checkRetryMessage(firstDecision.request);
    const again = await call(
      askAgain(answerText, instruction),
      `${answerText}\n${instruction}`,
      'CHECKS'
    );
    if (again.answer !== null) {
      const regenerated = readReply(again.answer.text);
      if (regenerated.ok) {
        delivered = regenerated.model;
        answerSlug = again.answer.model;
        secondPass = checkReply(delivered);
      } else {
        hold.reclassifyLast(regenerated.outcome);
      }
    }
  }

  // a regeneration that produced nothing usable leaves the first reply to be judged as it stands
  const final: FinalDecision = decideFinal(secondPass ?? firstPass);
  const record: CheckRecord = {
    first: firstPass,
    second: secondPass,
    final,
    schemaRetries,
  };

  if (final.action === 'FIXED_ANSWER') {
    return fixed('WORDING_FAILED', facts(record));
  }
  return shape === 'REPORT1'
    ? {
        ...facts(record),
        ok: true,
        shape: 'REPORT1',
        model: delivered as Report1Model,
        slug: answerSlug,
        flagged: final.flagged,
      }
    : {
        ...facts(record),
        ok: true,
        shape: 'ANSWER',
        model: delivered as AnswerModel,
        slug: answerSlug,
        flagged: final.flagged,
      };
}
