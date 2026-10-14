/**
 * Chat threads in the database (build step 7; `chat_threads`, architecture 5.13 and 7.5).
 *
 * A thread is one trader's conversation with the AI analyst. It is personal data: the
 * database deletes it with the account (`ON DELETE CASCADE`), and its messages with it. Every
 * function here takes the user id and puts it in the `where` of the query, so a thread of
 * another trader is simply not found: `NOT_FOUND` for "does not exist" and "is not yours"
 * alike, and existence is never leaked (the gate says `THREAD_INVALID`, never "forbidden").
 *
 * A trader's delete removes the thread and, by the foreign key, its messages. It does not
 * touch `request_traces`: the trace holds no question (decision D16) and is the 7-year audit
 * row; this file has no delegate for it at all.
 *
 * @module lib/platform/chat/threads-store
 */

import { prisma } from '@/lib/db/prisma';
import { TRADER_TYPES } from '@/lib/reply/contracts/intake';
import type { TraderType } from '@/lib/reply/contracts/intake';

import { sanitizeTitle } from './title';

export const THREAD_SYMBOL = /^[A-Z0-9._]{1,24}$/;
export const TITLE_SOURCES = ['AUTO', 'USER'] as const;
export type TitleSource = (typeof TITLE_SOURCES)[number];

/** Threads a list returns at most (and by default). */
export const THREAD_LIST_MAX = 100;
export const THREAD_LIST_DEFAULT = 50;

export interface ThreadRow {
  id: string;
  user_id: string;
  symbol: string;
  title: string;
  title_source: string;
  trader_type: string;
  last_bias: string | null;
  last_cycle_slot: number | null;
  last_preview: string;
  message_count: number;
  report_count: number;
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ThreadCreateData {
  user_id: string;
  symbol: string;
  title: string;
  title_source: TitleSource;
  trader_type: TraderType;
}

export interface ThreadListWhere {
  user_id: string;
  OR?: (
    | { last_message_at: { lt: Date } }
    | { last_message_at: Date; id: { lt: string } }
  )[];
}

/** The delegate the real generated client fits with no cast; a test passes its own. */
export interface ThreadStoreClient {
  chatThread: {
    create(args: { data: ThreadCreateData }): Promise<ThreadRow>;
    findFirst(args: {
      where: { id: string; user_id: string };
    }): Promise<ThreadRow | null>;
    findMany(args: {
      where: ThreadListWhere;
      orderBy: ({ last_message_at: 'desc' } | { id: 'desc' })[];
      take: number;
    }): Promise<ThreadRow[]>;
    updateMany(args: {
      where: { id: string; user_id: string };
      data: { title: string; title_source: TitleSource };
    }): Promise<{ count: number }>;
    deleteMany(args: {
      where: { id: string; user_id: string };
    }): Promise<{ count: number }>;
  };
}

export interface ThreadStoreOptions {
  client?: ThreadStoreClient;
}

export type ThreadRefusalCode =
  | 'MISSING_USER'
  | 'BAD_SYMBOL'
  | 'BAD_TRADER_TYPE'
  | 'TITLE_EMPTY'
  | 'TITLE_TOO_LONG'
  | 'NOT_FOUND';

export type CreateThreadResult =
  | { ok: true; thread: ThreadRow }
  | { ok: false; code: Exclude<ThreadRefusalCode, 'NOT_FOUND'> };

export interface CreateThreadInput {
  userId: string;
  symbol: string;
  traderType: TraderType;
  /** the deterministic title of the first answer (`deriveThreadTitle`) */
  title: string;
}

const hasUser = (userId: unknown): userId is string =>
  typeof userId === 'string' && userId !== '';

/** Make a thread for a trader. The title is checked like a trader's own; its source is AUTO. */
export async function createThread(
  input: CreateThreadInput,
  options: ThreadStoreOptions = {}
): Promise<CreateThreadResult> {
  if (!hasUser(input.userId)) return { ok: false, code: 'MISSING_USER' };
  if (!THREAD_SYMBOL.test(input.symbol))
    return { ok: false, code: 'BAD_SYMBOL' };
  if (!(TRADER_TYPES as readonly string[]).includes(input.traderType)) {
    return { ok: false, code: 'BAD_TRADER_TYPE' };
  }
  const title = sanitizeTitle(input.title);
  if (!title.ok) {
    return {
      ok: false,
      code: title.code === 'EMPTY' ? 'TITLE_EMPTY' : 'TITLE_TOO_LONG',
    };
  }
  const client: ThreadStoreClient = options.client ?? prisma;
  const thread = await client.chatThread.create({
    data: {
      user_id: input.userId,
      symbol: input.symbol,
      title: title.title,
      title_source: 'AUTO',
      trader_type: input.traderType,
    },
  });
  return { ok: true, thread };
}

/** A thread of this trader, or null (the same answer when it is somebody else's). */
export async function getThread(
  userId: string,
  threadId: string,
  options: ThreadStoreOptions = {}
): Promise<ThreadRow | null> {
  if (!hasUser(userId) || typeof threadId !== 'string' || threadId === '') {
    return null;
  }
  const client: ThreadStoreClient = options.client ?? prisma;
  return client.chatThread.findFirst({
    where: { id: threadId, user_id: userId },
  });
}

export interface ThreadCursor {
  lastMessageAt: Date;
  id: string;
}

export interface ListThreadsOptions extends ThreadStoreOptions {
  limit?: number;
  /** the cursor a previous page returned */
  after?: ThreadCursor;
}

export interface ThreadPage {
  threads: ThreadRow[];
  /** pass it as `after` for the next page; null on the last page */
  next: ThreadCursor | null;
}

/** The trader's threads, newest message first, a page at a time (keyset, so it never skips or repeats one). */
export async function listThreads(
  userId: string,
  options: ListThreadsOptions = {}
): Promise<ThreadPage> {
  if (!hasUser(userId)) return { threads: [], next: null };
  const limit = Math.min(
    Math.max(Math.trunc(options.limit ?? THREAD_LIST_DEFAULT), 1),
    THREAD_LIST_MAX
  );
  const where: ThreadListWhere = { user_id: userId };
  if (options.after !== undefined) {
    where.OR = [
      { last_message_at: { lt: options.after.lastMessageAt } },
      {
        last_message_at: options.after.lastMessageAt,
        id: { lt: options.after.id },
      },
    ];
  }
  const client: ThreadStoreClient = options.client ?? prisma;
  const rows = await client.chatThread.findMany({
    where,
    orderBy: [{ last_message_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const threads = rows.slice(0, limit);
  const last = threads[threads.length - 1];
  return {
    threads,
    next:
      rows.length > limit && last !== undefined
        ? { lastMessageAt: last.last_message_at, id: last.id }
        : null,
  };
}

export type RenameThreadResult =
  | { ok: true; title: string }
  | {
      ok: false;
      code: 'MISSING_USER' | 'TITLE_EMPTY' | 'TITLE_TOO_LONG' | 'NOT_FOUND';
    };

/** The trader's own title for a thread; it is never replaced by a derived one again. */
export async function renameThread(
  userId: string,
  threadId: string,
  rawTitle: string,
  options: ThreadStoreOptions = {}
): Promise<RenameThreadResult> {
  if (!hasUser(userId)) return { ok: false, code: 'MISSING_USER' };
  const title = sanitizeTitle(rawTitle);
  if (!title.ok) {
    return {
      ok: false,
      code: title.code === 'EMPTY' ? 'TITLE_EMPTY' : 'TITLE_TOO_LONG',
    };
  }
  const client: ThreadStoreClient = options.client ?? prisma;
  const updated = await client.chatThread.updateMany({
    where: { id: threadId, user_id: userId },
    data: { title: title.title, title_source: 'USER' },
  });
  return updated.count === 0
    ? { ok: false, code: 'NOT_FOUND' }
    : { ok: true, title: title.title };
}

/**
 * Delete a thread of this trader and, by the foreign key, all its messages. True when a
 * thread was deleted. The request traces are not touched: they hold no question and are the
 * 7-year audit row.
 */
export async function deleteThread(
  userId: string,
  threadId: string,
  options: ThreadStoreOptions = {}
): Promise<boolean> {
  if (!hasUser(userId) || typeof threadId !== 'string' || threadId === '') {
    return false;
  }
  const client: ThreadStoreClient = options.client ?? prisma;
  const deleted = await client.chatThread.deleteMany({
    where: { id: threadId, user_id: userId },
  });
  return deleted.count > 0;
}
