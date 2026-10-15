/**
 * The words of one reply run (build step 7 part 7a; architecture 5.2, plan part 7).
 *
 * `runReply` is the orchestrator: it takes ONE request from the gate to a stored reply over
 * ports, and everything it touches that is not pure is a port declared here, so a test replaces
 * and COUNTS each one: the intake path's own ports (the session, the market data, the knowledge
 * service), the model gateway, the quota meter, the thread and message store, the trace writer,
 * the chart and the day's bars. The production adapters are in `server/ports.ts`; the fakes are
 * in `__tests__/lib/reply/run/`.
 *
 * Pure: nothing here does anything.
 *
 * @module lib/reply/run/types
 */

import type { HistoryRow } from '../context/history';
import type {
  Bias,
  GateCaller,
  IntakePorts,
  InstantIntent,
  IntakeRefusal,
  PacketIntent,
  RequestKind,
  TraderType,
  UnderstandPort,
} from '../contracts/intake';
import type { StageEvent, ReplyErrorCode } from '../contracts/stage-events';
import type { ReplyResult } from '../contracts/result';
import type { ReplyTrace } from '../contracts/trace-fields';
import type { FallbackPorts } from '../gateway/fallback';
import type { ModelCallResult } from '../gateway/types';
import type { RequestBounds } from '../meter/estimate';
import type { Meter } from '../meter/quota-port';
import type { ChartPort } from '../read/chart';
import type { DayBarsRead } from '../read/day-bars';
import type { CycleStates } from '../report1/changes';

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

/**
 * What the route reads from a body: the question or the label that was pressed, the thread, and
 * the client's idempotency key. Nothing about who is calling, the tier or the language: those
 * come from the session and the interface setting, on the server.
 */
export type ReplyRequest =
  | {
      kind: 'TYPED';
      question: string;
      threadId: string | null;
      clientRequestId: string;
    }
  | {
      kind: 'INSTANT';
      intent: InstantIntent;
      threadId: string | null;
      clientRequestId: string;
    };

// ---------------------------------------------------------------------------
// The ports
// ---------------------------------------------------------------------------

/** A thread of the trader and the latest of its messages, for the history and the "what changed" opening. */
export interface ThreadContext {
  /** null when the trader has no such thread */
  thread: {
    id: string;
    lastCycleSlot: number | null;
    messageCount: number;
  } | null;
  /** the latest stored messages, oldest first */
  history: HistoryRow[];
}

/** A store's answer: done, or refused with a code and the paths and codes of what was wrong (never values). */
export type StoreOutcome =
  | { ok: true }
  | { ok: false; code: string; detail?: string };

export interface ThreadsPort {
  context(userId: string, threadId: string): Promise<ThreadContext>;
  /**
   * Make a thread with an id the orchestrator chose (the first reply names its thread). Its
   * title is derived from the first answer: the symbol, the chart or the intent, the bias and
   * the cycle (decision D15); the adapter words it, the orchestrator only says what it was.
   */
  create(input: {
    id: string;
    userId: string;
    symbol: string;
    traderType: TraderType;
    intent: PacketIntent;
    bias: Bias | null;
    /** the cycle slot of the first answer, unix UTC seconds; null when it had none */
    cycleSlot: number | null;
  }): Promise<StoreOutcome>;
  /** the trader's message and the reply, in one transaction */
  append(input: {
    userId: string;
    threadId: string;
    requestId: string;
    user:
      | { kind: 'TYPED'; text: string; intent: string | null }
      | { kind: 'INSTANT'; intent: InstantIntent };
    reply: unknown;
    nowMs: number;
  }): Promise<StoreOutcome>;
  /** remove a thread this request made, when its first message could not be stored */
  discard(userId: string, threadId: string): Promise<boolean>;
}

/** The stored answer to a request that was already served (idempotency). */
export interface StoredReply {
  /** null once the account that made it was deleted */
  userId: string | null;
  replyJson: string | null;
  outcome: string;
}

export interface TracesPort {
  /** one row for the answer; a refused trace comes back as a code, a database error is thrown */
  write(input: {
    userId: string;
    trace: ReplyTrace;
    reply: unknown;
  }): Promise<StoreOutcome>;
  find(requestId: string): Promise<StoredReply | null>;
}

/** A deadline for the whole request (decision D23): the signal fires when it passes. */
export interface Deadline {
  signal: AbortSignal;
  cancel(): void;
}

export interface ReplyPorts {
  /** the step 6 ports; the Understand model is wrapped by the orchestrator so its paid call is recorded */
  intake: Omit<IntakePorts, 'understand'>;
  /** builds the Understand port for ONE request; `onCall` receives the result of every call it makes */
  understand(hooks: {
    onCall: (result: ModelCallResult) => void;
  }): UnderstandPort;
  /** the bounds of the worst case a request of this kind could cost; null when no model can answer */
  bounds(kind: RequestKind): RequestBounds | null;
  meter: Meter;
  models: FallbackPorts;
  dayBars(slot: string): Promise<DayBarsRead>;
  chart: ChartPort;
  /** the entitlement table lets this tier have the model inspect the chart */
  tierAllowsChart(tier: string): boolean;
  /** the sensors' states at an earlier cycle (null when they could not be read) */
  previousStates(slot: string): Promise<CycleStates | null>;
  threads: ThreadsPort;
  traces: TracesPort;
  /** an id for a thread that does not exist yet */
  newThreadId(): string;
  /** an id for a request that has no user (nothing to derive it from) */
  anonymousRequestId(): string;
  deadline(ms: number): Deadline;
  /** a code and its detail for the server log; never the question, never a key */
  log(code: string, detail?: Readonly<Record<string, string | number>>): void;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export interface ReplyOptions {
  /**
   * The client's connection. If it is aborted BEFORE any model has been called the hold is
   * released and nothing is charged; once a model has been dispatched the run is finished,
   * settled and stored anyway, so a reload shows the reply and the trader pays for what was spent.
   */
  signal?: AbortSignal;
  /** progress, in the order of `REPLY_STAGES` */
  emit?: (event: StageEvent) => void;
  /** the request deadline in milliseconds; 55 seconds when omitted (decision D23) */
  deadlineMs?: number;
}

/** What a refusal at the hold says about the balance (the hold could not be covered). */
export interface QuotaDetail {
  limitUnits: number;
  availableUnits: number;
  neededUnits: number;
}

export type ReplyRun<F> =
  /** the flag is off: the route does not exist */
  | { kind: 'DISABLED' }
  /** the body could not be read: the route's own failure */
  | { kind: 'REQUEST_FAILED'; failure: F }
  /** the request did not become a reply; `quota` is set when the balance is why */
  | {
      kind: 'REFUSED';
      requestId: string;
      refusal: IntakeRefusal;
      quota: QuotaDetail | null;
      /** a `request_traces` row was written for it */
      traced: boolean;
    }
  /** a reply, made now or (replayed) returned from the store */
  | {
      kind: 'REPLY';
      requestId: string;
      result: ReplyResult;
      replayed: boolean;
    }
  /** the client left before any model was called: nothing was spent */
  | { kind: 'ABORTED'; requestId: string }
  | {
      kind: 'ERROR';
      requestId: string;
      code: ReplyErrorCode;
      retryable: boolean;
    };

/** The caller the gate accepted, with the identity the reply needs. */
export interface ReplyCaller extends GateCaller {
  requestId: string;
}
