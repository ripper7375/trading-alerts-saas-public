/**
 * Chat messages in the database (`chat_messages`, architecture 5.13 and 7.5; decision D18).
 *
 * A request makes ONE exchange: the trader's message (a typed question, or the press of an
 * instant prompt, which has no text) and the reply that was delivered. `appendExchange`
 * writes both and updates the thread's summary (Panel A's badge, preview and counts) in ONE
 * transaction, numbering the messages with the thread's own counter: the update takes the
 * row lock, so two requests racing on one thread are numbered one after the other and never
 * twice the same. A repeated request id (a client retry) violates the unique key
 * (`request_id`, `role`) and is `DUPLICATE_REQUEST`: nothing is written twice, and the
 * transaction rolls back whole.
 *
 * Every message expires 12 months after it was made (decision D18, `messageExpiry`); the
 * retention job that deletes them is built with the archive (runbook S7). A trader's delete of
 * a thread and an account deletion remove the messages through the foreign key.
 *
 * The reply is checked by `inspectDelivered` (its contract, and no equity or commission key)
 * before it is kept. Every read takes the user id: a thread that is not the trader's reads
 * as `null`, like a thread that does not exist.
 *
 * @module lib/platform/chat/messages-store
 */

import { prisma } from '@/lib/db/prisma';
import {
  PACKET_INTENTS,
  isInstantIntent,
  secondsOfSlot,
} from '@/lib/reply/contracts/intake';
import type {
  InstantIntent,
  Issue,
  PacketIntent,
} from '@/lib/reply/contracts/intake';

import { inspectDelivered } from '../delivered';
import type { Delivered } from '../delivered';
import { messageExpiry } from '../traces/retention';
import { previewOf } from './title';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export const MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export const MESSAGE_LIST_MAX = 200;
export const MESSAGE_TEXT_MAX = 2000;

export interface MessageRow {
  id: string;
  thread_id: string;
  seq: number;
  request_id: string;
  role: string;
  kind: string;
  intent: string | null;
  body_text: string | null;
  body_json: unknown;
  cycle_slot: number | null;
  created_at: Date;
  expires_at: Date;
}

export interface MessageCreateData {
  thread_id: string;
  seq: number;
  request_id: string;
  role: 'USER' | 'ASSISTANT';
  kind: string;
  intent: string | null;
  body_text: string | null;
  body_json?: JsonObject;
  cycle_slot: number | null;
  created_at: Date;
  expires_at: Date;
}

export interface ThreadSummaryUpdate {
  message_count: { increment: number };
  report_count?: { increment: number };
  last_message_at: Date;
  last_preview?: string;
  last_bias?: string;
  last_cycle_slot?: number;
}

/** What a transaction uses; the real generated client fits with no cast, a test passes its own. */
export interface MessageTx {
  chatThread: {
    /** throws `P2025` when no thread of this trader has that id */
    update(args: {
      where: { id: string; user_id: string };
      data: ThreadSummaryUpdate;
      select: { message_count: true };
    }): Promise<{ message_count: number }>;
  };
  chatMessage: {
    create(args: { data: MessageCreateData }): Promise<MessageRow>;
  };
}

export interface MessageStoreClient extends MessageTx {
  $transaction<T>(fn: (tx: MessageTx) => Promise<T>): Promise<T>;
  chatThread: MessageTx['chatThread'] & {
    findFirst(args: {
      where: { id: string; user_id: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  chatMessage: MessageTx['chatMessage'] & {
    findMany(args: {
      where: { thread_id: string; seq?: { gt: number } };
      orderBy: { seq: 'asc' };
      take: number;
    }): Promise<MessageRow[]>;
  };
}

export interface MessageStoreOptions {
  client?: MessageStoreClient;
}

export type UserMessage =
  | { kind: 'TYPED'; text: string; intent: PacketIntent | null }
  | { kind: 'INSTANT'; intent: InstantIntent };

export interface ExchangeInput {
  userId: string;
  threadId: string;
  /** the server's request id: the user and the assistant message share it */
  requestId: string;
  user: UserMessage;
  /** the reply that was delivered: a `reply-result/1` or an `intake-refusal/1` */
  reply: unknown;
  /** the clock; tests move it by hand */
  now?: Date;
}

export type AppendExchangeCode =
  | 'MISSING_USER'
  | 'BAD_REQUEST_ID'
  | 'BAD_MESSAGE'
  | 'INVALID_REPLY'
  | 'FORBIDDEN_KEY'
  | 'REPLY_MISMATCH'
  | 'NOT_FOUND'
  | 'DUPLICATE_REQUEST';

export type AppendExchangeResult =
  | { ok: true; user: MessageRow; assistant: MessageRow }
  | { ok: false; code: AppendExchangeCode; issues?: Issue[] };

const REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Prisma's error for a unique key that is already taken. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Prisma's error for a row that is not there (here: a thread that is not this trader's). */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

/** The bias, cycle and one line of text a thread shows for a reply. */
function summaryOf(
  reply: Delivered,
  typedText: string | null
): { bias: string | null; slot: number | null; preview: string } {
  if ('stage' in reply) {
    // an intake-refusal/1: the fixed reply the trader read
    return { bias: null, slot: null, preview: previewOf(reply.reply) };
  }
  const result = reply;
  const slot = secondsOfSlot(result.stamp.as_of);
  switch (result.kind) {
    case 'REPORT1':
      return {
        bias: result.report.direction.bias,
        slot,
        preview: previewOf(result.report.headline),
      };
    case 'ANSWER':
      return { bias: null, slot, preview: previewOf(result.answer.text) };
    case 'FIXED_ANSWER':
      return {
        bias: result.fixed.direction?.bias ?? null,
        slot,
        preview: previewOf(typedText ?? ''),
      };
    case 'ACTION':
      return { bias: null, slot, preview: previewOf(typedText ?? '') };
  }
}

/**
 * Write one exchange to a thread of this trader. See the file header. The thread's summary
 * keeps its last bias and cycle when this reply has none (an explanation does not erase the
 * badge of the last report).
 */
export async function appendExchange(
  input: ExchangeInput,
  options: MessageStoreOptions = {}
): Promise<AppendExchangeResult> {
  const { userId, threadId, requestId, user } = input;
  if (typeof userId !== 'string' || userId === '') {
    return { ok: false, code: 'MISSING_USER' };
  }
  if (!REQUEST_ID.test(requestId)) return { ok: false, code: 'BAD_REQUEST_ID' };
  if (typeof threadId !== 'string' || threadId === '') {
    return { ok: false, code: 'NOT_FOUND' };
  }

  let userIntent: string | null;
  let userText: string | null;
  if (user.kind === 'TYPED') {
    if (
      typeof user.text !== 'string' ||
      user.text.trim() === '' ||
      Array.from(user.text).length > MESSAGE_TEXT_MAX ||
      (user.intent !== null &&
        !(PACKET_INTENTS as readonly string[]).includes(user.intent))
    ) {
      return { ok: false, code: 'BAD_MESSAGE' };
    }
    userText = user.text;
    userIntent = user.intent;
  } else {
    if (!isInstantIntent(user.intent))
      return { ok: false, code: 'BAD_MESSAGE' };
    userText = null;
    userIntent = user.intent;
  }

  const delivered = inspectDelivered(input.reply);
  if (!delivered.ok) {
    return { ok: false, code: delivered.code, issues: delivered.issues };
  }
  if (
    'provenance' in delivered.reply &&
    (delivered.reply.provenance.request_id !== requestId ||
      delivered.reply.thread_id !== threadId)
  ) {
    // a reply is filed under the request and the thread it was made for, or not at all
    return { ok: false, code: 'REPLY_MISMATCH' };
  }
  const { slot, bias, preview } = summaryOf(delivered.reply, userText);

  const now = input.now ?? new Date();
  const expires = messageExpiry(now);
  const client: MessageStoreClient = options.client ?? prisma;
  const isReport = delivered.kind === 'REPORT1';

  try {
    return await client.$transaction(
      async (tx): Promise<AppendExchangeResult> => {
        // the update takes the row lock and returns the count it made: the messages' numbers
        const counted = await tx.chatThread.update({
          where: { id: threadId, user_id: userId },
          data: {
            message_count: { increment: 2 },
            ...(isReport ? { report_count: { increment: 1 } } : {}),
            last_message_at: now,
            // an instant prompt has no question: the thread keeps the preview it had
            ...(preview === '' ? {} : { last_preview: preview }),
            ...(bias === null ? {} : { last_bias: bias }),
            ...(slot === null ? {} : { last_cycle_slot: slot }),
          },
          select: { message_count: true },
        });

        const common = {
          thread_id: threadId,
          request_id: requestId,
          cycle_slot: slot,
          created_at: now,
          expires_at: expires,
        };
        const userRow = await tx.chatMessage.create({
          data: {
            ...common,
            seq: counted.message_count - 1,
            role: 'USER',
            kind: user.kind,
            intent: userIntent,
            body_text: userText,
          },
        });
        const assistantRow = await tx.chatMessage.create({
          data: {
            ...common,
            seq: counted.message_count,
            role: 'ASSISTANT',
            kind: delivered.kind,
            intent: userIntent,
            body_text: null,
            body_json: delivered.reply as unknown as JsonObject,
          },
        });
        return { ok: true, user: userRow, assistant: assistantRow };
      }
    );
  } catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, code: 'DUPLICATE_REQUEST' };
    if (isRecordNotFound(error)) return { ok: false, code: 'NOT_FOUND' };
    throw error;
  }
}

export interface ListMessagesOptions extends MessageStoreOptions {
  limit?: number;
  /** only the messages after this sequence number */
  afterSeq?: number;
}

/** The messages of a thread of this trader in order, or null when it is not theirs (or not there). */
export async function listMessages(
  userId: string,
  threadId: string,
  options: ListMessagesOptions = {}
): Promise<MessageRow[] | null> {
  if (typeof userId !== 'string' || userId === '') return null;
  if (typeof threadId !== 'string' || threadId === '') return null;
  const client: MessageStoreClient = options.client ?? prisma;
  const owned = await client.chatThread.findFirst({
    where: { id: threadId, user_id: userId },
    select: { id: true },
  });
  if (owned === null) return null;
  const limit = Math.min(
    Math.max(Math.trunc(options.limit ?? MESSAGE_LIST_MAX), 1),
    MESSAGE_LIST_MAX
  );
  return client.chatMessage.findMany({
    where: {
      thread_id: threadId,
      ...(options.afterSeq === undefined
        ? {}
        : { seq: { gt: options.afterSeq } }),
    },
    orderBy: { seq: 'asc' },
    take: limit,
  });
}
