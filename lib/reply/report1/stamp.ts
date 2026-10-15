/**
 * The envelope every reply carries (build step 7 part 5; architecture 5.2 step 7, 5.3 last
 * paragraph): the data stamp ("data as of hh:mm UTC": the cycle's slot, the status, the retuning
 * flag and the packet's flags) and the fields of `reply-result/1` that are not the reply itself.
 *
 * The stamp is DATA. The interface formats the time in its language ("so no translated string is
 * made twice", `contracts/result.ts`), so this file writes no sentence: a stale reply carries the
 * time the data stopped as `stamp.as_of`, a delayed one `data_status: DELAYED`, the last session's
 * `MARKET_CLOSED`, and a retuned cycle `retuning: true`.
 *
 * The disclaimer is a VERSION: the fixed text per language is reviewed by counsel and lives in the
 * interface's dictionaries (part 8); changing the words means a new version here.
 *
 * Pure.
 *
 * @module lib/reply/report1/stamp
 */

import type { IntakePacket } from '../contracts/intake';
import type {
  ActionResult,
  DataStamp,
  ResultBase,
  ResultKind,
  ResultNote,
  StateChange,
  TradeSetupAction,
} from '../contracts/result';
import { REPLY_RESULT_SCHEMA, REPLY_VERSION } from '../version';

/** The version of the fixed disclaimer the interface shows under every reply. */
export const DISCLAIMER_VERSION = 'disclaimer-1';

/** The stamp of a reply: what data it was made from, as the packet says. */
export function buildStamp(packet: IntakePacket): DataStamp {
  return {
    as_of: packet.data.cycle_slot,
    data_status: packet.data.status,
    retuning: packet.data.retuning,
    flags: [...packet.data.flags],
  };
}

/** What the orchestrator knows about the request that the packet does not. */
export interface ResultFrame {
  /** the chat thread the reply belongs to (created before the reply is stored) */
  threadId: string;
  requestId: string;
  /** the model that wrote the delivered reply; null when none did */
  model: string | null;
  promptVersion: string | null;
  /** times the model was asked again (0 or 1) */
  regenerations: 0 | 1;
  /** numbers that stayed unverified and were replaced by the "not verified" mark */
  numbersFlagged: number;
  /** what moved since the thread's last cycle, built by code (`report1/changes.ts`) */
  changes: readonly StateChange[];
  /** what the reply says about its inputs (a chart that was dropped) */
  notes: readonly ResultNote[];
  /** the release of the reply rules; the current one when omitted */
  replyVersion?: string;
}

/** The frame the orchestrator hands a composer, which counts the flagged numbers itself. */
export type ReplyFrame = Omit<ResultFrame, 'numbersFlagged'>;

/** Everything of a result that does not depend on its kind. */
export function buildResultBase<K extends ResultKind>(
  packet: IntakePacket,
  frame: ResultFrame,
  kind: K
): ResultBase & { kind: K } {
  return {
    schema: REPLY_RESULT_SCHEMA,
    kind,
    thread_id: frame.threadId,
    reply_locale: packet.question.reply_locale,
    intent: packet.intent,
    stamp: buildStamp(packet),
    disclaimer_version: DISCLAIMER_VERSION,
    provenance: {
      request_id: frame.requestId,
      model: frame.model,
      prompt_version: frame.promptVersion,
      reply_version: frame.replyVersion ?? REPLY_VERSION,
    },
    checks: {
      numbers_flagged: frame.numbersFlagged,
      regenerations: frame.regenerations,
    },
    changes: frame.changes.map((change) => ({ ...change })),
    notes: [...frame.notes],
  };
}

/**
 * The result of a request that opens the Trade Setup modal (REPORT_2): no model ran, so there is
 * no model, no prompt version and nothing was flagged or regenerated.
 */
export function buildActionResult(
  packet: IntakePacket,
  frame: ReplyFrame,
  action: TradeSetupAction
): ActionResult {
  return {
    ...buildResultBase(
      packet,
      {
        ...frame,
        model: null,
        promptVersion: null,
        regenerations: 0,
        numbersFlagged: 0,
      },
      'ACTION'
    ),
    action: { ...action, zone_ids: [...action.zone_ids] },
  };
}
