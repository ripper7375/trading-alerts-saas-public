/**
 * The trace of an intake request (architecture 4.11 item 10 and 7.4, plan part 5).
 *
 * Section 7.4 has one trace row per answer, filled by Sections 4, 5 and 6, each its own
 * fields. This is Section 4's part: the request group (request id, tier, language, intent),
 * the data group (cycle slot, data status, sensor statuses, synthesis rule) and the knowledge
 * group (M*, chunk ids, index build id), plus the duration of every stage. `request_traces` is
 * chapter 7's table, so this chapter returns the trace at the one place each route answers
 * (`server/respond.ts`) and a later writer plugs in there, as it does for Engine 4.
 *
 * Two rules keep it honest:
 *  - for a packet, every field the packet also carries is COPIED from `packet.trace` (which the
 *    packet validator holds to the rest of the packet), never worked out a second time, so the
 *    two cannot disagree; `packet_sha256` is the fingerprint of the whole packet, trace included
 *    (decision D9 (e)), and cannot be a field of the packet it fingerprints;
 *  - it carries no user id, no text the trader typed and no secret: the server's own request
 *    id is what support opens. Problems are CODES (`KNOWLEDGE_TIMEOUT`), never messages.
 *
 * Section 4 charges nothing in step 6 (the quota is a pre-check; the units follow the model's
 * cost and are step 7's), so `units_charged` is the number 0 on every answer.
 *
 * Pure: the clock is a port, and so are the request id and the start time (the caller makes
 * them), so a test runs a request on a clock it moves by hand.
 *
 * @module lib/intake/trace
 */

import type { Intent } from './intents';
import type { Locale } from './locales';
import type {
  BoardStatus,
  DataStatus,
  IntakePacket,
  KnowledgeStatus,
} from './packet';
import type { IntakeRefusal, RefusalCode, RefusalStage } from './refusal';

/** The stages of a request, in the order they run. A stage that did not run is not in the list. */
export const TRACE_STAGES = [
  'GATE',
  'DOOR',
  'UNDERSTAND',
  'SCOPE',
  'SNAPSHOT',
  /** the data block is built, with a STALE or UNKNOWN status said in it, before anything is assembled (4.11 item 8) */
  'DATA',
  'EVENTS',
  'BOARD',
  'ROUTE',
  'RETRIEVE',
  'ASSEMBLE',
] as const;

export type TraceStageName = (typeof TRACE_STAGES)[number];

export interface TraceStage {
  name: TraceStageName;
  ms: number;
}

export type TraceOutcome =
  /** a packet was built */
  | 'PACKET'
  /** the request ended in an `intake-refusal/1` */
  | 'REFUSED'
  /** the flag is off */
  | 'DISABLED'
  /** the body could not be read (malformed, too big, wrong type) */
  | 'REQUEST_FAILED'
  /** something went wrong on our side */
  | 'ERROR';

export type TraceRoute = 'typed' | 'instant';

export interface IntakeTrace {
  request_id: string;
  route: TraceRoute;
  method: string;
  started_at: string;
  outcome: TraceOutcome;
  tier: string | null;
  refusal_code: RefusalCode | null;
  refusal_stage: RefusalStage | null;
  /** the interface setting the server read */
  interface_locale: Locale | null;
  /** the language of the question: a family, `und`, or the interface's own for an instant prompt; null before it is known */
  language: string | null;
  /** the locale the answer or the reply is written in */
  reply_locale: Locale | null;
  intent: Intent | null;
  m_star: string[];
  /** the ids of the chunks, then of the expansions */
  chunk_ids: string[];
  index_build_id: string | null;
  knowledge_status: KnowledgeStatus | null;
  cycle_slot: string | null;
  data_status: DataStatus | null;
  sensor_statuses: Record<string, BoardStatus>;
  synthesis_rule: string | null;
  intake_version: string | null;
  routing_version: string | null;
  /** the SHA-256 of the whole packet; null when there is none */
  packet_sha256: string | null;
  /** signals of the understanding step: `TERM_DROPPED`, `AMBIGUOUS_NUMBER` */
  question_flags: string[];
  /** codes of what failed or was left out along the way: a reader's problem, a refused model answer, a failed service */
  problems: string[];
  /** what the router noted (`NO_TERM`, `PRIMARY_UNAVAILABLE:MCD1`): for a person debugging a route, not a failure */
  route_notes: string[];
  units_charged: 0;
  timings: { total_ms: number; stages: TraceStage[] };
}

/** The fields a run fills; the identity (id, route, method, start) and the timings are the recorder's. */
export type TraceFields = Omit<
  IntakeTrace,
  'request_id' | 'route' | 'method' | 'started_at' | 'timings' | 'units_charged'
>;

export interface TraceRecorderOptions {
  requestId: string;
  route: TraceRoute;
  method: string;
  /** ISO time of the start, made by the caller (this file reads no clock for dates) */
  startedAt: string;
  /** milliseconds; any monotonic or wall clock the caller likes */
  clock: () => number;
}

function emptyFields(): TraceFields {
  return {
    outcome: 'ERROR',
    tier: null,
    refusal_code: null,
    refusal_stage: null,
    interface_locale: null,
    language: null,
    reply_locale: null,
    intent: null,
    m_star: [],
    chunk_ids: [],
    index_build_id: null,
    knowledge_status: null,
    cycle_slot: null,
    data_status: null,
    sensor_statuses: {},
    synthesis_rule: null,
    intake_version: null,
    routing_version: null,
    packet_sha256: null,
    question_flags: [],
    problems: [],
    route_notes: [],
  };
}

/** Collects a request's trace fields and times its stages. */
export class TraceRecorder {
  readonly requestId: string;
  private readonly began: number;
  private readonly stages: TraceStage[] = [];
  private fields: TraceFields = emptyFields();

  constructor(private readonly options: TraceRecorderOptions) {
    this.requestId = options.requestId;
    this.began = options.clock();
  }

  /** Run one stage and record how long it took, whether it succeeded or threw. */
  async stage<T>(name: TraceStageName, run: () => Promise<T>): Promise<T> {
    const start = this.options.clock();
    try {
      return await run();
    } finally {
      this.stages.push({
        name,
        ms: Math.max(0, this.options.clock() - start),
      });
    }
  }

  /** Add or replace trace fields. */
  set(patch: Partial<TraceFields>): void {
    this.fields = { ...this.fields, ...patch };
  }

  /** Remember a problem by its code; a code is kept once. */
  problem(code: string): void {
    if (!this.fields.problems.includes(code)) {
      this.fields = {
        ...this.fields,
        problems: [...this.fields.problems, code],
      };
    }
  }

  problems(codes: readonly string[]): void {
    for (const code of codes) this.problem(code);
  }

  /** The stage names recorded so far, in the order they finished. */
  get stageNames(): TraceStageName[] {
    return this.stages.map((stage) => stage.name);
  }

  /** The request ended in a packet: copy what the packet says of itself, so the two agree. */
  recordPacket(packet: IntakePacket, packetSha256: string): void {
    const trace = packet.trace;
    this.set({
      outcome: 'PACKET',
      refusal_code: null,
      refusal_stage: null,
      language: trace.language,
      reply_locale: trace.reply_locale,
      intent: trace.intent,
      m_star: [...trace.m_star],
      chunk_ids: [...trace.chunk_ids],
      index_build_id: trace.index_build_id,
      knowledge_status: packet.knowledge?.status ?? null,
      cycle_slot: trace.cycle_slot,
      data_status: trace.data_status,
      sensor_statuses: { ...trace.sensor_statuses },
      synthesis_rule: trace.synthesis_rule,
      intake_version: trace.intake_version,
      routing_version: trace.routing_version,
      packet_sha256: packetSha256,
      question_flags: [...packet.question.flags],
    });
  }

  /** The request ended in a refusal. */
  recordRefusal(refusal: IntakeRefusal): void {
    this.set({
      outcome: 'REFUSED',
      refusal_code: refusal.code,
      refusal_stage: refusal.stage,
      reply_locale: refusal.reply_locale,
    });
  }

  snapshot(): IntakeTrace {
    return {
      request_id: this.options.requestId,
      route: this.options.route,
      method: this.options.method,
      started_at: this.options.startedAt,
      ...this.fields,
      m_star: [...this.fields.m_star],
      chunk_ids: [...this.fields.chunk_ids],
      sensor_statuses: { ...this.fields.sensor_statuses },
      question_flags: [...this.fields.question_flags],
      problems: [...this.fields.problems],
      route_notes: [...this.fields.route_notes],
      units_charged: 0,
      timings: {
        total_ms: Math.max(0, this.options.clock() - this.began),
        stages: this.stages.map((stage) => ({ ...stage })),
      },
    };
  }
}
