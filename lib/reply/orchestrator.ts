/**
 * The orchestrator (architecture 5.2 and 7.4; build step 7 part 7a; ADR-054, ADR-055, ADR-075,
 * ADR-076, ADR-077; decisions D8, D11, D15, D16, D21, D23, D24).
 *
 * `runReply` takes ONE request from the gate to a stored reply, over ports:
 *
 *   1  GATE      flag, session, tier, [the body is read and a request already served is returned
 *                from the store], thread (owned by the caller), profile, quota floor, and then the
 *                HOLD of the worst case (`Hold`, taken inside the gate's own quota check)
 *   2  INTAKE    the whole intake path in process (`runIntake`, no HTTP): door, Understand, scope,
 *                snapshot, data, events, board, route, retrieval, the packet
 *   3  ANSWER    the answer gate (5.3) and the shape (5.2): a fixed text, the Trade Setup action,
 *                a short answer or a Report 1. A refusal, a stale cycle and Report 2 make NO model call
 *   4  MODEL     the context (caps, cut order, chart rule), the primary model and its fallback, the
 *                schema, the number and wording checks, ONE extra call, the backstops (`runAnswerStep`)
 *   5  COMPOSE   Report 1 / short answer / fixed answer / action, the direction copied from the
 *                synthesis, the stamp, what changed since the thread's last cycle
 *   6  SETTLE    the hold becomes the charge for what the paid calls cost, the rest is released
 *   7  STORE     the thread (a first message makes one, titled from the answer), the trace row and the
 *                two messages, all AWAITED before the run returns: billing and audit are not best-effort
 *
 * THE FIVE THINGS THAT MUST HOLD (acceptance 5.14, plan part 7):
 *  - no model is called for a Free trader, a caller who is not signed in, an unknown tier, a thread
 *    of another trader, an empty balance, a STALE cycle or a Report 2 request: those end in the gate
 *    or in step 3, and the tests count the model port's calls;
 *  - a reply charges once: the request id is a function of the trader and the client's id, so a
 *    double click finds its own hold and its own stored reply;
 *  - a client that leaves before any model call costs nothing; one that leaves after it pays for
 *    what was spent and finds the reply stored;
 *  - the direction of a Report 1 is the synthesis reading's, copied by the composer;
 *  - the trace says what happened: the calls that were made, what the ledger charged, what the checks saw.
 *
 * WHAT IT DOES NOT DO. It owns no route, no stream and no HTTP status (part 7b), no key, no
 * database client and no clock of its own: every one is a port. It does not write the question
 * into the trace (D16), and it does not store a refusal as a message.
 *
 * Pure: all I/O is behind `ReplyPorts`.
 *
 * @module lib/reply/orchestrator
 */

import { buildChecksGroup } from './checks/report';
import {
  PacketInvalidError,
  TraceRecorder,
  runIntake,
  secondsOfSlot,
  slotIso,
  validateRefusal,
} from './contracts/intake';
import type {
  Bias,
  GateCaller,
  IntakePacket,
  IntakePorts,
  IntakeRefusal,
  RequestRead,
  TraderType,
} from './contracts/intake';
import type { ReplyResult } from './contracts/result';
import { validateReplyResult } from './contracts/result';
import type { FixedReason } from './contracts/result';
import type { ReplyErrorCode, StageEvent } from './contracts/stage-events';
import type {
  ReplyOutcome,
  ReplyShape,
  TraceAnswerGate,
} from './contracts/trace-fields';
import { evaluateAnswerGate, gateTrace, report2Open } from './gate/answer-gate';
import type { GateDecision } from './gate/answer-gate';
import { resolveShape, traceShape } from './gate/shape';
import type { ShapeResolution } from './gate/shape';
import { chartCalledFor, readChart } from './read/chart';
import type { ChartRead } from './read/chart';
import { stateChanges, statesOfPacket } from './report1/changes';
import {
  composeAnswerResult,
  composeReport1Result,
  directionEqualsSynthesis,
} from './report1/compose';
import type { ReplyFrame } from './report1/compose';
import { composeFixedAnswer, dataIsLive } from './report1/fixed-answer';
import { buildActionResult } from './report1/stamp';
import { buildValueDictionary } from './checks/value-dictionary';
import type { ValueDictionary } from './checks/value-dictionary';
import type { DayBars } from './context/ohlc-compact';
import { Hold, HoldStopped } from './run/hold';
import { requestIdOf } from './run/request-id';
import { EventedRecorder, StageTracker } from './run/stages';
import { buildTrace, quietChecks } from './run/trace';
import { isAborted, runAnswerStep } from './run/answer-step';
import type { AnswerStep } from './run/answer-step';
import type {
  ReplyOptions,
  ReplyPorts,
  ReplyRequest,
  ReplyRun,
} from './run/types';
import type { StoredReply } from './run/types';

/** The request deadline (decision D23): after it the board-only answer is sent. */
export const REPLY_DEADLINE_MS = 55_000;

/** The symbol the analyst is about (decision D6 of step 6). */
const SYMBOL = 'XAUUSD';

/** The failure `runIntake` is given for a request that was served before; never leaves this file. */
const REPLAYED = Symbol('replayed');
type Replayed = typeof REPLAYED;

const OUTCOME_OF_KIND: Readonly<Record<ReplyResult['kind'], ReplyOutcome>> = {
  REPORT1: 'REPORT1',
  ANSWER: 'ANSWER',
  FIXED_ANSWER: 'FIXED_ANSWER',
  ACTION: 'OPEN_TRADE_SETUP',
};

/** What the run knows of the request as it goes; the pieces the end needs are collected here. */
interface RunState {
  caller: GateCaller | null;
  request: ReplyRequest | null;
  requestId: string | null;
  replay: StoredReply | null;
  snapshot: Awaited<ReturnType<IntakePorts['snapshot']>> | null;
}

/**
 * The stored answer of a request as a run's outcome, or null when it cannot be read as one (a row
 * written for an ERROR has no reply). The row was found by this trader's own request id and its
 * owner was compared before it got here.
 */
function parseStored(
  stored: StoredReply,
  requestId: string
): Extract<ReplyRun<never>, { kind: 'REPLY' | 'REFUSED' }> | null {
  if (stored.replyJson === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(stored.replyJson);
  } catch {
    return null;
  }
  const result = validateReplyResult(value);
  if (result.ok) {
    return { kind: 'REPLY', requestId, result: result.value, replayed: true };
  }
  const refusal = validateRefusal(value);
  if (refusal.ok) {
    return {
      kind: 'REFUSED',
      requestId,
      refusal: refusal.refusal,
      quota: null,
      traced: true,
    };
  }
  return null;
}

const bareDirection = (result: ReplyResult): Bias | null => {
  if (result.kind === 'REPORT1') return result.report.direction.bias;
  if (result.kind === 'FIXED_ANSWER')
    return result.fixed.direction?.bias ?? null;
  return null;
};

export async function runReply<F>(
  ports: ReplyPorts,
  readRequest: (caller: GateCaller) => Promise<RequestRead<ReplyRequest, F>>,
  options: ReplyOptions = {}
): Promise<ReplyRun<F>> {
  const clock = (): number => ports.intake.now();
  const startedMs = clock();
  const startedAt = new Date(startedMs).toISOString();
  // a client that has gone must not stop the run: a listener that throws is ignored
  const emit = (event: StageEvent): void => {
    try {
      options.emit?.(event);
    } catch {
      // the stream is closed; the run goes on and is stored
    }
  };
  const tracker = new StageTracker(emit, clock);
  const deadlineMs = options.deadlineMs ?? REPLY_DEADLINE_MS;
  const deadline = ports.deadline(deadlineMs);
  const deadlineAtMs = startedMs + deadlineMs;

  const state: RunState = {
    caller: null,
    request: null,
    requestId: null,
    replay: null,
    snapshot: null,
  };
  const hold = new Hold({
    meter: ports.meter,
    bounds: (kind) => ports.bounds(kind),
    requestId: () => state.requestId,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    log: (code, detail) => ports.log(code, detail),
  });
  const recorder = new EventedRecorder(
    {
      requestId: ports.anonymousRequestId(),
      route: 'typed',
      method: 'POST',
      startedAt,
      clock,
    },
    tracker
  );

  /** The body is read after the tier check; a request that was served before ends here with what was stored. */
  const read = async (
    caller: GateCaller
  ): Promise<RequestRead<ReplyRequest, F | Replayed>> => {
    const got = await readRequest(caller);
    if (!got.ok) return got;
    state.caller = caller;
    state.request = got.request;
    state.requestId = await requestIdOf(
      caller.userId,
      got.request.clientRequestId
    );
    try {
      const stored = await ports.traces.find(state.requestId);
      if (stored !== null && stored.userId === caller.userId) {
        state.replay = stored;
        return { ok: false, failure: REPLAYED };
      }
    } catch {
      // the store cannot be read: the hold protects against a second charge all the same
      ports.log('REPLAY_LOOKUP_FAILED');
    }
    return got;
  };

  const intakePorts: IntakePorts = {
    ...ports.intake,
    gate: {
      ...ports.intake.gate,
      quota: hold.wrapQuota(ports.intake.gate.quota),
    },
    snapshot: async (request) => {
      const snapshot = await ports.intake.snapshot(request);
      state.snapshot = snapshot;
      return snapshot;
    },
    understand: hold.wrapUnderstand(
      ports.understand({ onCall: hold.onUnderstandCall })
    ),
  };

  const fail = async (
    code: ReplyErrorCode,
    retryable: boolean
  ): Promise<ReplyRun<F>> => {
    await hold.end();
    return {
      kind: 'ERROR',
      requestId: state.requestId ?? ports.anonymousRequestId(),
      code,
      retryable,
    };
  };

  try {
    let intake;
    try {
      intake = await runIntake<F | Replayed>(intakePorts, recorder, read);
    } catch (error) {
      ports.log(
        error instanceof PacketInvalidError
          ? 'PACKET_INVALID'
          : error instanceof HoldStopped
            ? 'HOLD_STOPPED'
            : 'INTAKE_FAILED'
      );
      return await fail('INTERNAL', false);
    }

    // ---- the request did not become a packet ------------------------------------
    if (intake.kind === 'DISABLED') return { kind: 'DISABLED' };

    if (intake.kind === 'REQUEST_FAILED') {
      if (intake.failure === REPLAYED) {
        // (the reader sets the stored row and the request id before it returns this failure)
        const replayed = parseStored(
          state.replay as StoredReply,
          state.requestId as string
        );
        if (replayed !== null) return replayed;
        // a stored row nobody can read as a reply: the hold below answers a retry
        ports.log('REPLAY_UNREADABLE');
        return await fail('INTERNAL', false);
      }
      return { kind: 'REQUEST_FAILED', failure: intake.failure as F };
    }

    if (intake.kind === 'REFUSED') {
      if (hold.aborted) {
        await hold.end();
        return {
          kind: 'ABORTED',
          requestId: state.requestId ?? ports.anonymousRequestId(),
        };
      }
      if (hold.duplicate !== null) {
        // the same request is running or was settled without its reply being stored: do not run it twice
        ports.log('DUPLICATE_REQUEST', { status: hold.duplicate });
        return {
          kind: 'ERROR',
          requestId: state.requestId ?? ports.anonymousRequestId(),
          code: 'INTERNAL',
          retryable: true,
        };
      }
      await hold.end();
      const requestId = state.requestId ?? ports.anonymousRequestId();
      const traced = await writeRefusalTrace({
        ports,
        state,
        recorder,
        refusal: intake.refusal,
        requestId,
        startedAt,
        startedMs,
      });
      return {
        kind: 'REFUSED',
        requestId,
        refusal: intake.refusal,
        quota: hold.quota,
        traced,
      };
    }

    // ---- a packet ----------------------------------------------------------------
    const reached = intake;
    const serve = async (): Promise<ReplyRun<F>> => {
      const packet = reached.packet;
      const caller = state.caller as GateCaller;
      const request = state.request as ReplyRequest;
      const requestId = state.requestId as string;
      const intent = packet.intent;
      const traderType = packet.profile.trader_type;

      const gate = evaluateAnswerGate({
        intent,
        dataStatus: packet.data.status,
        retuning: packet.data.retuning,
        cycleSlot: packet.data.cycle_slot,
      });
      const zoneIds = (state.snapshot?.synthesis?.zones ?? []).map((zone) =>
        String(zone['zone_id'])
      );
      const resolution = resolveShape({ packet, gate, zoneIds });

      const threadId = request.threadId;
      const slotSeconds = secondsOfSlot(packet.data.cycle_slot);

      // the day's bars: a model prompt needs them, and so does a fixed answer on live data
      const wantsBars =
        resolution.model ||
        (resolution.shape === 'FIXED_ANSWER' && dataIsLive(packet));

      // First wave: the thread's context and the day's bars need nothing from
      // each other, only from the packet, so both are asked for at once.
      const [threadContext, bars] = await Promise.all([
        threadId === null
          ? { thread: null, history: [] }
          : ports.threads.context(caller.userId, threadId),
        wantsBars && packet.data.cycle_slot !== null
          ? ports.dayBars(packet.data.cycle_slot)
          : null,
      ]);
      let dayBars: DayBars | null = null;
      if (bars !== null) {
        if (bars.ok) dayBars = bars.bars;
        else ports.log('DAY_BARS_UNAVAILABLE', { code: bars.code });
      }

      // Second wave: both need the thread's context (its last cycle; its
      // history) and nothing from each other. The earlier cycle is read only
      // when the thread has one and it is not this cycle, so a first question,
      // and a follow-up in the same cycle, never ask for it.
      const last = threadContext.thread?.lastCycleSlot ?? null;
      const earlierSlot =
        last !== null && slotSeconds !== null && last !== slotSeconds
          ? last
          : null;
      const [previous, chartRead] = await Promise.all([
        earlierSlot !== null
          ? ports.previousStates(slotIso(earlierSlot))
          : null,
        // the chart rule (5.3): only for a model call, only when the data, the call, the tier and the model allow it
        resolution.model
          ? readChart(
              {
                cycleSlot: packet.data.cycle_slot,
                dataAllows: gate.chartAllowed,
                calledFor: chartCalledFor({
                  intent,
                  firstOfCycle: !threadContext.history.some(
                    (row) =>
                      row.role === 'ASSISTANT' &&
                      row.kind === 'REPORT1' &&
                      row.cycle_slot === slotSeconds
                  ),
                }),
                tierAllows: ports.tierAllowsChart(caller.tier),
                modelVision: ports.models.primary?.target.vision ?? false,
              },
              ports.chart
            )
          : null,
      ]);

      // what moved since the thread's last cycle, built by code
      const changes: ReplyFrame['changes'] =
        earlierSlot !== null
          ? stateChanges(previous, statesOfPacket(packet))
          : [];
      const chart: ChartRead = chartRead ?? {
        decision: 'NOT_CALLED_FOR',
        note: null,
        reason: null,
        stamp: null,
        image: null,
      };

      // ---- the model, when the shape needs one --------------------------------------
      let step: AnswerStep | null = null;
      if (resolution.model) {
        tracker.enter('MODEL');
        const ran = await runAnswerStep({
          ports,
          hold,
          packet,
          shape: resolution.shape,
          chart,
          dayBars,
          history: threadContext.history,
          deadline: { signal: deadline.signal, atMs: deadlineAtMs },
          now: clock,
          onFirstReply: () => tracker.enter('CHECKS'),
        });
        if (isAborted(ran)) {
          await hold.end();
          return { kind: 'ABORTED', requestId };
        }
        step = ran;
      } else {
        tracker.skipRest();
      }

      // ---- compose ------------------------------------------------------------------
      const threadForReply = threadId ?? ports.newThreadId();
      const frameBase = {
        threadId: threadForReply,
        requestId,
        changes,
        notes: chart.note === null ? [] : [chart.note],
      };
      const regenerationCalls = hold.records.filter(
        (r) => r.role === 'REGENERATE'
      ).length;
      const regenerations: 0 | 1 = regenerationCalls > 0 ? 1 : 0;

      const composed = await composeReply({
        packet,
        gate,
        resolution,
        step,
        dayBars,
        frameBase,
        regenerations,
        dictionaryFor: (existing) =>
          existing ?? buildValueDictionary(packet, dayBars),
      });

      // ---- settle -------------------------------------------------------------------
      const ended = await hold.end();
      const unitsCharged =
        ended.settlement?.ok === true ? ended.settlement.chargedUnits : 0;
      if (ended.settlement !== null && ended.settlement.ok === false) {
        ports.log('SETTLEMENT_FAILED', { code: ended.settlement.code });
      }

      // ---- store --------------------------------------------------------------------
      const result = composed.result;
      const answerGate = gateTrace(gate, chart.decision);
      const checks =
        step === null
          ? quietChecks(
              traceShape(resolution),
              answerGate,
              composed.fixedReason,
              composed.directionEqualsSyn
            )
          : {
              ...buildChecksGroup({
                first: step.record.first,
                second: step.record.second,
                final: step.record.final,
                shape: traceShape(resolution),
                answerGate,
                schemaRetries: step.record.schemaRetries,
                directionEqualsSyn: composed.directionEqualsSyn,
                otherFixedReason: composed.fixedReason,
              }),
              // an extra call that produced nothing usable is still a call that was made
              regenerations,
            };

      const stored = await store({
        ports,
        packet,
        packetSha256: reached.packet_sha256,
        request,
        caller,
        requestId,
        traderType,
        newThread: threadId === null,
        threadId: threadForReply,
        result,
        recorder,
        hold,
        step,
        checks,
        gate: answerGate,
        shape: traceShape(resolution),
        fixedReason: composed.fixedReason,
        directionEqualsSyn: composed.directionEqualsSyn,
        startedAt,
        startedMs,
        deadlineHit: deadline.signal.aborted,
        unitsCharged,
        tracker,
      });
      if (stored !== null) {
        return { kind: 'ERROR', requestId, code: stored, retryable: false };
      }
      tracker.close();
      return { kind: 'REPLY', requestId, result, replayed: false };
    };
    try {
      return await serve();
    } catch (error) {
      // anything the run did not expect: the hold is settled for what was spent (or given back) and the
      // trader is told it failed on our side; the cause goes to the log by name, never the question
      ports.log('RUN_FAILED', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      return await fail('INTERNAL', false);
    }
  } finally {
    deadline.cancel();
  }
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

interface ComposeInput {
  packet: IntakePacket;
  gate: GateDecision;
  resolution: ShapeResolution;
  step: AnswerStep | null;
  dayBars: DayBars | null;
  frameBase: Pick<ReplyFrame, 'threadId' | 'requestId' | 'changes' | 'notes'>;
  regenerations: 0 | 1;
  dictionaryFor: (existing: ValueDictionary | null) => ValueDictionary;
}

interface Composed {
  result: ReplyResult;
  fixedReason: FixedReason | null;
  directionEqualsSyn: boolean | null;
}

async function composeReply(input: ComposeInput): Promise<Composed> {
  const { packet, gate, resolution, step } = input;
  const frame = (
    model: string | null,
    promptVersion: string | null
  ): ReplyFrame => ({
    ...input.frameBase,
    model,
    promptVersion,
    regenerations: input.regenerations,
  });

  const fixed = (
    reason: FixedReason,
    dictionary: ValueDictionary | null
  ): Composed => {
    const made = composeFixedAnswer({
      packet,
      reason,
      dictionary,
      frame: frame(null, null),
    });
    if (!made.ok) {
      // the fixed answer is built from the board alone; if even it is refused, the packet is not one we can answer from
      throw new Error(
        `the fixed answer was refused: ${made.failures.map((f) => `${f.code} ${f.path ?? ''}`).join('; ')}`
      );
    }
    return {
      result: made.value,
      fixedReason: reason,
      directionEqualsSyn:
        made.value.fixed.direction === null
          ? null
          : directionEqualsSynthesis(packet, made.value.fixed.direction),
    };
  };

  if (resolution.shape === 'FIXED_ANSWER') {
    return fixed(resolution.reason, input.dictionaryFor(null));
  }
  if (resolution.shape === 'ACTION') {
    return {
      result: buildActionResult(packet, frame(null, null), resolution.action),
      fixedReason: null,
      directionEqualsSyn: null,
    };
  }
  if (step === null)
    throw new Error('a model shape was resolved and no step ran');

  if (step.ok === false) {
    const reason = step.reason;
    return fixed(reason, input.dictionaryFor(step.dictionary));
  }

  const dictionary = input.dictionaryFor(step.dictionary);
  if (step.shape === 'REPORT1') {
    const made = composeReport1Result({
      packet,
      dictionary,
      model: step.model,
      flagged: step.flagged,
      frame: frame(step.slug, step.promptVersion),
    });
    if (!made.ok) {
      // a reply the contract refuses is never shown: the board-only answer goes out instead
      return fixed('SCHEMA_FAILED', dictionary);
    }
    return {
      result: made.value.result,
      fixedReason: null,
      directionEqualsSyn: made.value.directionEqualsSyn,
    };
  }
  const made = composeAnswerResult({
    packet,
    dictionary,
    model: step.model,
    flagged: step.flagged,
    report2Open: report2Open(gate.report2),
    frame: frame(step.slug, step.promptVersion),
  });
  if (!made.ok) return fixed('SCHEMA_FAILED', dictionary);
  return { result: made.value, fixedReason: null, directionEqualsSyn: null };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

interface StoreInput {
  ports: ReplyPorts;
  packet: IntakePacket;
  packetSha256: string;
  request: ReplyRequest;
  caller: GateCaller;
  requestId: string;
  traderType: TraderType;
  newThread: boolean;
  threadId: string;
  result: ReplyResult;
  recorder: TraceRecorder;
  hold: Hold;
  step: AnswerStep | null;
  checks: ReturnType<typeof quietChecks>;
  gate: TraceAnswerGate;
  shape: ReplyShape;
  fixedReason: FixedReason | null;
  directionEqualsSyn: boolean | null;
  startedAt: string;
  startedMs: number;
  deadlineHit: boolean;
  unitsCharged: number;
  tracker: StageTracker;
}

/** What a refused store write puts in the log: its code and where it found fault. */
const logOf = (refused: {
  code: string;
  detail?: string;
}): Record<string, string> => ({
  code: refused.code,
  ...(refused.detail === undefined || refused.detail === ''
    ? {}
    : { detail: refused.detail }),
});

/** Store the reply; the code of what failed, or null. Everything here is awaited. */
async function store(input: StoreInput): Promise<ReplyErrorCode | null> {
  const { ports, result, packet, caller } = input;
  const clock = (): number => ports.intake.now();
  const bias = bareDirection(result);
  const model = input.step !== null && input.step.ok ? input.step.slug : null;
  const stepFacts = input.step;

  const trace = (outcome: ReplyOutcome) =>
    buildTrace({
      request: input.request,
      requestId: input.requestId,
      tier: caller.tier,
      threadId: outcome === 'ERROR' ? null : input.threadId,
      intake: input.recorder.snapshot(),
      packet,
      intent: packet.intent,
      replyLocale: result.reply_locale,
      startedAt: input.startedAt,
      totalMs: clock() - input.startedMs,
      deadlineHit: input.deadlineHit,
      stages: [],
      shape: input.shape,
      gate: input.gate,
      checks: input.checks,
      fixedReason: input.fixedReason,
      directionEqualsSyn: input.directionEqualsSyn,
      calls: input.hold.records,
      model,
      promptVersion: stepFacts?.promptVersion ?? null,
      fallbackUsed: stepFacts?.fallbackUsed ?? false,
      components: stepFacts?.components ?? null,
      cycleBlockSha256: stepFacts?.cycleBlockSha256 ?? null,
      packetSha256: input.packetSha256,
      unitsCharged: input.unitsCharged,
      outcome,
    });

  let created = false;
  // true until the trace write starts: a store that throws before it leaves no trace row of its own
  let beforeTrace = true;
  try {
    if (input.newThread) {
      const made = await ports.threads.create({
        id: input.threadId,
        userId: caller.userId,
        symbol: SYMBOL,
        traderType: input.traderType,
        intent: packet.intent,
        bias,
        cycleSlot: secondsOfSlot(result.stamp.as_of),
      });
      if (!made.ok) {
        ports.log('THREAD_NOT_STORED', logOf(made));
        await writeErrorTrace(input, trace('ERROR'));
        return 'PERSISTENCE_FAILED';
      }
      created = true;
    }

    beforeTrace = false;
    const written = await ports.traces.write({
      userId: caller.userId,
      trace: trace(OUTCOME_OF_KIND[result.kind]),
      reply: result,
    });
    if (!written.ok) {
      ports.log('TRACE_NOT_STORED', logOf(written));
      if (created) await ports.threads.discard(caller.userId, input.threadId);
      return 'PERSISTENCE_FAILED';
    }

    const appended = await ports.threads.append({
      userId: caller.userId,
      threadId: input.threadId,
      requestId: input.requestId,
      user:
        input.request.kind === 'TYPED'
          ? {
              kind: 'TYPED',
              text: input.request.question,
              intent: packet.intent,
            }
          : { kind: 'INSTANT', intent: input.request.intent },
      reply: result,
      nowMs: clock(),
    });
    if (!appended.ok) {
      ports.log('MESSAGES_NOT_STORED', logOf(appended));
      if (created) await ports.threads.discard(caller.userId, input.threadId);
      return 'PERSISTENCE_FAILED';
    }
    return null;
  } catch (error) {
    ports.log('STORE_FAILED', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    // a charged request whose thread could not be made still leaves its audit row (the error row)
    if (beforeTrace) await writeErrorTrace(input, trace('ERROR'));
    if (created) {
      try {
        await ports.threads.discard(caller.userId, input.threadId);
      } catch {
        ports.log('THREAD_DISCARD_FAILED');
      }
    }
    return 'PERSISTENCE_FAILED';
  }
}

/** The audit row of a request that was charged and could not be filed: outcome ERROR, no reply. */
async function writeErrorTrace(
  input: StoreInput,
  trace: ReturnType<typeof buildTrace>
): Promise<void> {
  try {
    await input.ports.traces.write({
      userId: input.caller.userId,
      trace,
      reply: null,
    });
  } catch {
    input.ports.log('ERROR_TRACE_NOT_STORED');
  }
}

// ---------------------------------------------------------------------------
// A refusal's trace
// ---------------------------------------------------------------------------

interface RefusalTraceInput {
  ports: ReplyPorts;
  state: RunState;
  recorder: TraceRecorder;
  refusal: IntakeRefusal;
  requestId: string;
  startedAt: string;
  startedMs: number;
}

/**
 * A refusal has a `request_traces` row when it can: the trader is known, the body was read (the
 * client's id is the row's key) and the intent is known. The table's intent column holds the nine
 * intents, and the only request whose intent is known when it is refused is an INSTANT one (its
 * label is its intent); a typed question is refused before Understand has read it, or as out of
 * scope, and has none. Nothing was spent on a request refused at the gate (an instant prompt has no
 * Understand call), so the row says 0 units and no calls. It is written once, and its failure never
 * changes what the trader is told.
 */
async function writeRefusalTrace(input: RefusalTraceInput): Promise<boolean> {
  const { state, ports, refusal } = input;
  const caller = state.caller;
  const request = state.request;
  // (the reader sets the caller and the request together; only a button press has a row)
  if (request?.kind !== 'INSTANT' || caller === null) {
    return false;
  }
  try {
    const trace = buildTrace({
      request,
      requestId: input.requestId,
      tier: caller.tier,
      threadId: null,
      intake: input.recorder.snapshot(),
      packet: null,
      intent: request.intent,
      replyLocale: refusal.reply_locale,
      startedAt: input.startedAt,
      totalMs: ports.intake.now() - input.startedMs,
      deadlineHit: false,
      stages: [],
      shape: 'NONE',
      gate: null,
      checks: null,
      fixedReason: null,
      directionEqualsSyn: null,
      calls: [],
      model: null,
      promptVersion: null,
      fallbackUsed: false,
      components: null,
      cycleBlockSha256: null,
      packetSha256: null,
      unitsCharged: 0,
      outcome: 'REFUSED',
    });
    const written = await ports.traces.write({
      userId: caller.userId,
      trace,
      reply: refusal,
    });
    if (!written.ok) ports.log('REFUSAL_TRACE_NOT_STORED', logOf(written));
    return written.ok;
  } catch {
    ports.log('REFUSAL_TRACE_FAILED');
    return false;
  }
}
