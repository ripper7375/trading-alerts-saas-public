/**
 * The threads API (build step 7 part 7b; architecture 5.13 and 7.5; decisions D15, D16, D18):
 *
 *   GET    /api/chat/threads        the trader's threads, newest message first, a page at a time
 *   GET    /api/chat/threads/[id]   one thread and its messages
 *   PATCH  /api/chat/threads/[id]   rename it ({ "title": "..." }); the trader's title is never replaced
 *   DELETE /api/chat/threads/[id]   delete the thread and its messages (the trace stays: it holds no
 *                                   question and is the 7-year audit row)
 *
 * WHO MAY ASK. The route is off unless `REPLY_ENABLED` is exactly `true` (404 to everybody); then the
 * caller must be signed in (401) and have the live analyst (403), the same two checks the message route
 * makes, in the same order, from the same ports. The user id is the SESSION's and nothing else; a path or
 * a query that names another is only an id to look for in THIS trader's rows.
 *
 * NO EXISTENCE LEAK. Every store call puts the user id in its `where`, so a thread of another trader is
 * not found, and "not found" and "not yours" are one answer: 404 THREAD_INVALID, the same body, the same
 * words. The messages of a thread are read only after the thread was found to be the trader's.
 *
 * Server code only: it reads a session and a database.
 *
 * @module lib/reply/server/threads-api
 */

import 'server-only';

import {
  listMessages,
  type MessageRow,
  type MessageStoreClient,
} from '@/lib/platform/chat/messages-store';
import {
  deleteThread,
  getThread,
  listThreads,
  renameThread,
  THREAD_LIST_DEFAULT,
  THREAD_LIST_MAX,
  type ThreadCursor,
  type ThreadRow,
  type ThreadStoreClient,
} from '@/lib/platform/chat/threads-store';
import { canUseAiChat } from '@/lib/platform/entitlements';
import { sessionPort as realSessionPort } from '@/lib/intake/server/access';

import type { GateSession, SessionPort } from '../contracts/intake';
import { isSlotSeconds, slotIso } from '../contracts/intake';
import { chatErrorResponse, jsonResponse } from './errors';
import { allowListSession, isReplyEnabled, type Env } from './flags';
import { readJsonBody } from './request';

/** What the chat routes need to know who is asking: the flag, the session, the tier. */
export interface ChatAuth {
  enabled(): boolean;
  session: SessionPort;
  /** may a trader of this tier use the live analyst */
  allows(tier: string): boolean;
}

export interface ThreadsApiDeps {
  auth: ChatAuth;
  /** the chat tables' client; the shared one unless a test passes its own */
  chat?: ThreadStoreClient & MessageStoreClient;
}

/** The production wiring: the flag, the session behind the staging allow-list, the entitlement table. */
export function createChatAuth(env: Env = process.env): ChatAuth {
  return {
    enabled: () => isReplyEnabled(env),
    session: allowListSession(realSessionPort(), env),
    allows: (tier) => canUseAiChat(tier),
  };
}

export type Authorized =
  | { ok: true; caller: GateSession }
  | { ok: false; response: Response };

/** Flag, then session, then tier: the first that fails is the answer. A port that throws fails closed. */
export async function authorize(auth: ChatAuth): Promise<Authorized> {
  if (!auth.enabled()) {
    return { ok: false, response: chatErrorResponse('FEATURE_DISABLED') };
  }
  let session: GateSession | null;
  try {
    session = await auth.session.current();
  } catch {
    return { ok: false, response: chatErrorResponse('NOT_SIGNED_IN') };
  }
  if (
    session === null ||
    typeof session.userId !== 'string' ||
    session.userId === ''
  ) {
    return { ok: false, response: chatErrorResponse('NOT_SIGNED_IN') };
  }
  let allowed: boolean;
  try {
    allowed = auth.allows(session.tier);
  } catch {
    return { ok: false, response: chatErrorResponse('FEATURE_UNAVAILABLE') };
  }
  if (!allowed) {
    return { ok: false, response: chatErrorResponse('TIER_REQUIRED') };
  }
  return { ok: true, caller: session };
}

const notYours = (): Response =>
  chatErrorResponse('THREAD_INVALID', { status: 404 });

const unavailable = (): Response => chatErrorResponse('FEATURE_UNAVAILABLE');

// ---------------------------------------------------------------------------
// What goes over the wire
// ---------------------------------------------------------------------------

const iso = (date: Date): string => date.toISOString();
const slotText = (seconds: number | null): string | null =>
  seconds !== null && isSlotSeconds(seconds) ? slotIso(seconds) : null;

export function threadView(row: ThreadRow) {
  return {
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    title_source: row.title_source,
    trader_type: row.trader_type,
    last_bias: row.last_bias,
    last_cycle_slot: slotText(row.last_cycle_slot),
    last_preview: row.last_preview,
    message_count: row.message_count,
    report_count: row.report_count,
    last_message_at: iso(row.last_message_at),
    created_at: iso(row.created_at),
  };
}

export function messageView(row: MessageRow) {
  return {
    seq: row.seq,
    role: row.role,
    kind: row.kind,
    intent: row.intent,
    /** the trader's own words (a typed message); null for a reply and for an instant prompt */
    text: row.body_text,
    /** the reply that was delivered (`reply-result/1`); null for a trader's message */
    reply: row.body_json,
    cycle_slot: slotText(row.cycle_slot),
    created_at: iso(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// The cursor: opaque to the client, a time and an id to the store
// ---------------------------------------------------------------------------

export function encodeCursor(cursor: ThreadCursor): string {
  return Buffer.from(
    JSON.stringify({ t: cursor.lastMessageAt.getTime(), id: cursor.id }),
    'utf8'
  ).toString('base64url');
}

export function decodeCursor(text: string): ThreadCursor | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(text)) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(text, 'base64url').toString('utf8')
    );
    // (a null has no fields: the destructuring throws and the catch answers; any other value finds none)
    const { t, id } = value as { t?: unknown; id?: unknown };
    if (
      !Number.isSafeInteger(t) ||
      typeof id !== 'string' ||
      id === '' ||
      id.length > 64
    ) {
      return null;
    }
    const lastMessageAt = new Date(t as number);
    return Number.isNaN(lastMessageAt.getTime()) ? null : { lastMessageAt, id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The four handlers
// ---------------------------------------------------------------------------

const storeOptions = (deps: ThreadsApiDeps) =>
  deps.chat === undefined ? {} : { client: deps.chat };

export async function handleThreadsList(
  request: Request,
  deps: ThreadsApiDeps
): Promise<Response> {
  const auth = await authorize(deps.auth);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const limitText = params.get('limit');
  let limit = THREAD_LIST_DEFAULT;
  if (limitText !== null) {
    if (!/^[0-9]{1,3}$/.test(limitText)) {
      return chatErrorResponse('BAD_REQUEST', {
        message: `limit must be a number from 1 to ${THREAD_LIST_MAX}.`,
      });
    }
    limit = Number(limitText);
    if (limit < 1 || limit > THREAD_LIST_MAX) {
      return chatErrorResponse('BAD_REQUEST', {
        message: `limit must be a number from 1 to ${THREAD_LIST_MAX}.`,
      });
    }
  }
  const afterText = params.get('after');
  let after: ThreadCursor | undefined;
  if (afterText !== null) {
    const decoded = decodeCursor(afterText);
    if (decoded === null) {
      return chatErrorResponse('BAD_REQUEST', {
        message: 'after is not a cursor this API gave.',
      });
    }
    after = decoded;
  }

  try {
    const page = await listThreads(auth.caller.userId, {
      limit,
      ...(after === undefined ? {} : { after }),
      ...storeOptions(deps),
    });
    return jsonResponse({
      success: true,
      threads: page.threads.map(threadView),
      next: page.next === null ? null : encodeCursor(page.next),
    });
  } catch {
    return unavailable();
  }
}

export async function handleThreadGet(
  _request: Request,
  threadId: string,
  deps: ThreadsApiDeps
): Promise<Response> {
  const auth = await authorize(deps.auth);
  if (!auth.ok) return auth.response;
  try {
    const thread = await getThread(
      auth.caller.userId,
      threadId,
      storeOptions(deps)
    );
    if (thread === null) return notYours();
    const messages = await listMessages(
      auth.caller.userId,
      threadId,
      storeOptions(deps)
    );
    // the thread was the trader's a moment ago; if it is gone now it is simply not there
    if (messages === null) return notYours();
    return jsonResponse({
      success: true,
      thread: threadView(thread),
      messages: messages.map(messageView),
    });
  } catch {
    return unavailable();
  }
}

export async function handleThreadRename(
  request: Request,
  threadId: string,
  deps: ThreadsApiDeps
): Promise<Response> {
  const auth = await authorize(deps.auth);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return chatErrorResponse(body.failure.code, {
      message: body.failure.message,
    });
  }
  const title = body.body['title'];
  if (typeof title !== 'string') {
    return chatErrorResponse('BAD_REQUEST', { message: 'title must be text.' });
  }
  try {
    const renamed = await renameThread(
      auth.caller.userId,
      threadId,
      title,
      storeOptions(deps)
    );
    if (renamed.ok) {
      return jsonResponse({ success: true, title: renamed.title });
    }
    if (renamed.code === 'TITLE_EMPTY' || renamed.code === 'TITLE_TOO_LONG') {
      return chatErrorResponse('BAD_REQUEST', {
        message:
          renamed.code === 'TITLE_EMPTY'
            ? 'The title is empty.'
            : 'The title is too long (80 characters at most).',
      });
    }
    // no such thread of this trader's (or no trader): one answer, whichever it was
    return notYours();
  } catch {
    return unavailable();
  }
}

export async function handleThreadDelete(
  _request: Request,
  threadId: string,
  deps: ThreadsApiDeps
): Promise<Response> {
  const auth = await authorize(deps.auth);
  if (!auth.ok) return auth.response;
  try {
    const deleted = await deleteThread(
      auth.caller.userId,
      threadId,
      storeOptions(deps)
    );
    return deleted ? jsonResponse({ success: true }) : notYours();
  } catch {
    return unavailable();
  }
}
