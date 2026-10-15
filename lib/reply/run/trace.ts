/**
 * The trace of one answer (architecture 7.4, ADR-075; build step 7 part 7a, decision D16).
 *
 * ONE row per answer, written ONCE at the end of the request. This file builds its groups from
 * what the run knows, and nothing else: the request group and the data group come from the packet
 * the intake path built (copied, never worked out a second time), the knowledge group from its
 * pack, the model group from the calls that were really made and what the ledger really charged,
 * the checks group from the checks themselves. The risk group stays empty: Section 6 attaches it
 * later with `attachRisk`.
 *
 * WHAT IT NEVER HOLDS. No text the trader typed, anywhere (D16: "missed knowledge" is the intent,
 * the sensors M*, the locale, a count and the packet's fingerprint), no user id (the store keeps
 * it in its own column), no key. The validator of the contract is strict, so there is no field a
 * question could be put in.
 *
 * Pure.
 *
 * @module lib/reply/run/trace
 */

import { DEFAULT_LOCALE, familyOfLocale } from '../contracts/intake';
import type {
  IntakePacket,
  IntakeTrace,
  Locale,
  PacketIntent,
} from '../contracts/intake';
import type { FixedReason } from '../contracts/result';
import {
  CONTEXT_COMPONENTS,
  NUMBER_CLASSES,
  WORDING_CATEGORIES,
} from '../contracts/trace-fields';
import type {
  ContextComponent,
  ModelCallRecord,
  ReplyOutcome,
  ReplyShape,
  ReplyTrace,
  TraceAnswerGate,
  TraceChecksGroup,
  TraceKnowledgeGroup,
} from '../contracts/trace-fields';
import { REPLY_VERSION } from '../version';
import { answerTokens, totalCost } from './calls';
import type { ReplyRequest } from './types';

export interface TraceInput {
  request: ReplyRequest;
  requestId: string;
  tier: string;
  /** the thread the reply was filed in; null when the request made none */
  threadId: string | null;
  /** the intake recorder's snapshot: the locales, the language, the problems and the stage times */
  intake: IntakeTrace;
  packet: IntakePacket | null;
  intent: PacketIntent;
  replyLocale: Locale;
  startedAt: string;
  totalMs: number;
  deadlineHit: boolean;
  /** the stages after the intake path's own (context, model, checks, ...) */
  stages: readonly { name: string; ms: number }[];
  shape: ReplyShape;
  gate: TraceAnswerGate | null;
  /** from the model step; the quiet defaults when no model ran */
  checks: TraceChecksGroup | null;
  fixedReason: FixedReason | null;
  directionEqualsSyn: boolean | null;
  calls: readonly ModelCallRecord[];
  model: string | null;
  promptVersion: string | null;
  fallbackUsed: boolean;
  components: Readonly<Record<ContextComponent, number>> | null;
  cycleBlockSha256: string | null;
  packetSha256: string | null;
  unitsCharged: number;
  outcome: ReplyOutcome;
}

const zeros = <K extends string>(words: readonly K[]): Record<K, number> => {
  const out = {} as Record<K, number>;
  for (const word of words) out[word] = 0;
  return out;
};

/** The checks of a request in which no model wrote an answer. */
export function quietChecks(
  shape: ReplyShape,
  gate: TraceAnswerGate | null,
  fixedReason: FixedReason | null,
  directionEqualsSyn: boolean | null
): TraceChecksGroup {
  return {
    answer_gate: gate,
    shape,
    schema_retries: 0,
    numbers: {
      extracted: 0,
      matched: 0,
      violations: 0,
      flagged: 0,
      classes: zeros(NUMBER_CLASSES),
    },
    wording: {
      violations: 0,
      categories: zeros(WORDING_CATEGORIES),
      fixed_answer: false,
    },
    regenerations: 0,
    direction_equals_syn: directionEqualsSyn,
    fixed_reason: fixedReason,
  };
}

function knowledgeGroup(
  input: TraceInput,
  packet: IntakePacket | null
): TraceKnowledgeGroup {
  const base: TraceKnowledgeGroup = {
    m_star: packet === null ? [] : [...packet.readings.m_star],
    chunk_ids: packet === null ? [] : [...packet.trace.chunk_ids],
    index_build_id: packet?.knowledge?.index_build_id ?? null,
    status: packet?.knowledge?.status ?? null,
    missed: null,
  };
  // a miss for the corpus backlog: the pack was asked and held nothing. The question is not here.
  if (
    packet !== null &&
    packet.knowledge !== null &&
    packet.knowledge.status === 'EMPTY' &&
    input.packetSha256 !== null
  ) {
    base.missed = {
      intent: packet.intent,
      m_star: [...packet.readings.m_star],
      reply_locale: packet.question.reply_locale,
      chunk_count: 0,
      packet_sha256: input.packetSha256,
    };
  }
  return base;
}

/** The trace of one answer, as the contract (`validateReplyTrace`) reads it. */
export function buildTrace(input: TraceInput): ReplyTrace {
  const { packet, intake } = input;
  const interfaceLocale = intake.interface_locale ?? DEFAULT_LOCALE;
  const model = input.model;
  const checks =
    input.checks ??
    quietChecks(
      input.shape,
      input.gate,
      input.fixedReason,
      input.directionEqualsSyn
    );
  const stages = [
    ...intake.timings.stages.map((stage) => ({
      name: stage.name as string,
      ms: Math.max(0, Math.round(stage.ms)),
    })),
    ...input.stages.map((stage) => ({
      name: stage.name,
      ms: Math.max(0, Math.round(stage.ms)),
    })),
  ];
  const rulesVersion = packet?.readings.synthesis?.reading['rules_version'];

  return {
    request: {
      reply_version: REPLY_VERSION,
      request_id: input.requestId,
      client_request_id: input.request.clientRequestId,
      thread_id: input.threadId,
      tier: input.tier === 'PRO' ? 'PRO' : 'FREE',
      kind: input.request.kind,
      intent: input.intent,
      language:
        packet?.question.language ??
        intake.language ??
        familyOfLocale(interfaceLocale),
      interface_locale: interfaceLocale,
      reply_locale: input.replyLocale,
      question_flags:
        packet === null
          ? [...intake.question_flags]
          : [...packet.question.flags],
    },
    data: {
      cycle_slot: packet?.data.cycle_slot ?? null,
      data_status: packet?.data.status ?? null,
      retuning: packet?.data.retuning ?? false,
      flags: packet === null ? [] : [...packet.data.flags],
      sensor_statuses:
        packet === null ? {} : { ...packet.trace.sensor_statuses },
      synthesis_rule: packet?.trace.synthesis_rule ?? null,
      synthesis_rules_version:
        typeof rulesVersion === 'string' ? rulesVersion : null,
      last_price_bar: packet?.data.last_price?.bar ?? null,
      intake_version: packet?.trace.intake_version ?? null,
      routing_version: packet?.trace.routing_version ?? null,
      packet_sha256: input.packetSha256,
    },
    knowledge: knowledgeGroup(input, packet),
    model: {
      model,
      prompt_version: input.promptVersion,
      fallback_used: input.fallbackUsed,
      components: input.components ?? zeros(CONTEXT_COMPONENTS),
      cycle_block_sha256: input.cycleBlockSha256,
      tokens: answerTokens(input.calls),
      calls: input.calls.map((call) => ({ ...call })),
      units_charged: input.unitsCharged,
      cost_micro_usd: totalCost(input.calls),
    },
    checks,
    risk: null,
    time: {
      started_at: input.startedAt,
      total_ms: Math.max(0, Math.round(input.totalMs)),
      deadline_hit: input.deadlineHit,
      stages,
    },
    outcome: input.outcome,
  };
}
