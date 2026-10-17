/**
 * The thread, message and trace stores as the orchestrator's ports (build step 7 part 7a).
 *
 * `lib/reply` is pure and cannot import the platform, so it asks for ports; these are the ports,
 * over the stores of part 1. Each adds almost nothing: it turns the orchestrator's words into the
 * store's, and the store's refusals into a code. A refusal is a result (`ok: false`); a database
 * error is thrown, and the orchestrator decides what the trader is told.
 *
 * Every function takes the stores' client through `options`, so a test passes an in-memory one and
 * the real stores' validation (the trace contract, the delivered-reply check, the forbidden keys,
 * the ownership in every `where`) runs for real.
 *
 * Server code only: it reaches the database.
 *
 * @module lib/reply/server/store-ports
 */

import 'server-only';

import {
  appendExchange,
  listMessages,
} from '@/lib/platform/chat/messages-store';
import type { MessageStoreClient } from '@/lib/platform/chat/messages-store';
import {
  createThread,
  deleteThread,
  getThread,
} from '@/lib/platform/chat/threads-store';
import type { ThreadStoreClient } from '@/lib/platform/chat/threads-store';
import { deriveThreadTitle } from '@/lib/platform/chat/title';
import { readTrace, writeTrace } from '@/lib/platform/traces/store';
import type { TraceStoreClient } from '@/lib/platform/traces/store';
import type { AuditKey } from '@/lib/platform/traces/hash';
import type { Delivered } from '@/lib/platform/delivered';

import type { HistoryRow } from '../context/history';
import type { PacketIntent } from '../contracts/intake';
import type { ThreadsPort, TracesPort } from '../run/types';

/** The paths and codes of the first issues, as a short text for the log; a value never goes in. */
export function issueDetail(
  issues: readonly { path: string; code: string }[] | undefined
): string {
  return (issues ?? [])
    .slice(0, 5)
    .map(
      (issue) => `${issue.path === '' ? '(root)' : issue.path} ${issue.code}`
    )
    .join('; ');
}

/** The latest messages the history is made from: enough for ten verbatim and a summary of the rest. */
export const HISTORY_WINDOW = 30;

export interface ThreadsPortOptions {
  /** the chat tables' client; the shared database client unless a test passes its own */
  client?: ThreadStoreClient & MessageStoreClient;
}

export function createThreadsPort(
  options: ThreadsPortOptions = {}
): ThreadsPort {
  return {
    async context(userId, threadId) {
      const thread = await getThread(userId, threadId, options);
      if (thread === null) return { thread: null, history: [] };
      const rows = await listMessages(userId, threadId, {
        ...options,
        afterSeq: Math.max(0, thread.message_count - HISTORY_WINDOW),
      });
      const history: HistoryRow[] = (rows ?? []).map((row) => ({
        seq: row.seq,
        role: row.role,
        kind: row.kind,
        intent: row.intent,
        body_text: row.body_text,
        body_json: row.body_json,
        cycle_slot: row.cycle_slot,
      }));
      return {
        thread: {
          id: thread.id,
          lastCycleSlot: thread.last_cycle_slot,
          messageCount: thread.message_count,
        },
        history,
      };
    },

    async create(input) {
      const made = await createThread(
        {
          id: input.id,
          userId: input.userId,
          symbol: input.symbol,
          traderType: input.traderType,
          title: deriveThreadTitle({
            symbol: input.symbol,
            intent: input.intent,
            bias: input.bias,
            cycleSlot: input.cycleSlot,
          }),
        },
        options
      );
      return made.ok ? { ok: true } : { ok: false, code: made.code };
    },

    async append(input) {
      const done = await appendExchange(
        {
          userId: input.userId,
          threadId: input.threadId,
          requestId: input.requestId,
          user:
            input.user.kind === 'TYPED'
              ? {
                  kind: 'TYPED',
                  text: input.user.text,
                  intent: input.user.intent as PacketIntent | null,
                }
              : { kind: 'INSTANT', intent: input.user.intent },
          reply: input.reply,
          now: new Date(input.nowMs),
        },
        options
      );
      return done.ok
        ? { ok: true }
        : { ok: false, code: done.code, detail: issueDetail(done.issues) };
    },

    async discard(userId, threadId) {
      return deleteThread(userId, threadId, options);
    },
  };
}

export interface TracesPortOptions {
  client?: TraceStoreClient;
  key?: AuditKey;
}

export function createTracesPort(options: TracesPortOptions = {}): TracesPort {
  return {
    async write(input) {
      const written = await writeTrace(
        {
          userId: input.userId,
          trace: input.trace,
          reply: input.reply as Delivered | null,
        },
        options
      );
      return written.ok
        ? { ok: true }
        : {
            ok: false,
            code: written.code,
            detail: issueDetail(written.issues),
          };
    },

    async find(requestId) {
      const row = await readTrace(requestId, options);
      return row === null
        ? null
        : {
            userId: row.user_id,
            replyJson: row.reply_json,
            outcome: row.outcome,
          };
    },
  };
}
