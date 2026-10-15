/**
 * The browser's side of the threads routes (build step 7 part 9):
 *
 *   GET    /api/chat/threads?limit&after   the trader's threads, newest message first, a page at a time
 *   GET    /api/chat/threads/[id]          one thread and its messages
 *   PATCH  /api/chat/threads/[id]          rename it
 *   DELETE /api/chat/threads/[id]          delete the thread and its messages (the audit trace stays)
 *
 * Like `wire.ts` it knows nothing of React and never throws: every call answers `{ ok: true, ... }` or
 * `{ ok: false, reason }`. It checks only what Panel A and Panel B need to draw something true; the
 * strict validators are the server's, which checked every row before it was stored. A route that is not
 * switched on answers 404 `FEATURE_DISABLED` to everybody, which is `DISABLED` here; a thread that is
 * not the trader's and a thread that does not exist are one answer, `NOT_FOUND`.
 *
 * What a thread holds is stored as the server delivered it, so reading it back is turning each stored
 * message into the item the live panel would have drawn: the trader's bubble, the reply card, the refusal
 * card. The messages are the transcript; the server's records of the request are not part of it.
 *
 * @module components/chat/threads-wire
 */

import type { ChatItem } from './chat-state';
import { CHAT_ROUTES, INSTANT_INTENTS_UI } from './limits';
import type { Bias, InstantIntent, ThreadSummary } from './types';
import { isReplyResultShape, readRefusal } from './wire';

type Fetch = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const BIAS_VALUES: readonly string[] = [
  'LONG',
  'SHORT',
  'NEUTRAL',
  'STAND_ASIDE',
];

const isAbort = (error: unknown, signal: AbortSignal | undefined): boolean =>
  (signal !== undefined && signal.aborted) ||
  (error instanceof Error && error.name === 'AbortError');

/** The error code of a JSON error body (`{ success: false, error: { code } }`), or null. */
function errorCode(body: unknown): string | null {
  return isRecord(body) &&
    isRecord(body['error']) &&
    typeof body['error']['code'] === 'string'
    ? body['error']['code']
    : null;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// A thread
// ---------------------------------------------------------------------------------------

/** One thread of the list, or null when the row is not one the panel can draw. */
export function readThread(value: unknown): ThreadSummary | null {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    value['id'] === '' ||
    typeof value['title'] !== 'string' ||
    typeof value['last_message_at'] !== 'string'
  ) {
    return null;
  }
  const bias = value['last_bias'];
  const count = value['message_count'];
  return {
    id: value['id'],
    title: value['title'],
    titleSource: value['title_source'] === 'USER' ? 'USER' : 'AUTO',
    lastBias:
      typeof bias === 'string' && BIAS_VALUES.includes(bias)
        ? (bias as Bias)
        : null,
    lastPreview:
      typeof value['last_preview'] === 'string' ? value['last_preview'] : '',
    messageCount:
      typeof count === 'number' && Number.isFinite(count) ? count : 0,
    lastMessageAt: value['last_message_at'],
    lastCycleSlot:
      typeof value['last_cycle_slot'] === 'string'
        ? value['last_cycle_slot']
        : null,
  };
}

// ---------------------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------------------

export type ListOutcome =
  | { ok: true; threads: ThreadSummary[]; next: string | null }
  | { ok: false; reason: 'DISABLED' | 'FAILED' | 'NETWORK' | 'ABORTED' };

export interface ListArgs {
  limit?: number;
  /** the `next` cursor the previous page gave */
  after?: string;
  signal?: AbortSignal;
}

/** One page of the trader's threads. */
export async function listThreads(
  fetchImpl: Fetch,
  args: ListArgs = {}
): Promise<ListOutcome> {
  const query = new URLSearchParams();
  if (args.limit !== undefined) query.set('limit', String(args.limit));
  if (args.after !== undefined) query.set('after', args.after);
  const text = query.toString();
  const suffix = text === '' ? '' : `?${text}`;
  let response: Response;
  try {
    response = await fetchImpl(`${CHAT_ROUTES.threads}${suffix}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      ...(args.signal === undefined ? {} : { signal: args.signal }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: isAbort(error, args.signal) ? 'ABORTED' : 'NETWORK',
    };
  }
  const body = await readBody(response);
  if (response.status === 404 && errorCode(body) === 'FEATURE_DISABLED') {
    return { ok: false, reason: 'DISABLED' };
  }
  if (
    !response.ok ||
    !isRecord(body) ||
    body['success'] !== true ||
    !Array.isArray(body['threads'])
  ) {
    return { ok: false, reason: 'FAILED' };
  }
  const threads = body['threads']
    .map(readThread)
    .filter((thread): thread is ThreadSummary => thread !== null);
  const next = body['next'];
  return {
    ok: true,
    threads,
    next: typeof next === 'string' && next !== '' ? next : null,
  };
}

// ---------------------------------------------------------------------------------------
// One thread, read back as the items of Panel B
// ---------------------------------------------------------------------------------------

const isInstantIntent = (value: unknown): value is InstantIntent =>
  typeof value === 'string' &&
  (INSTANT_INTENTS_UI as readonly string[]).includes(value);

/**
 * The stored messages of a thread as the items Panel B draws, in order. A message the panel cannot
 * draw (a row of a shape this build does not know) is left out rather than guessed; the rest is shown.
 */
export function itemsFromMessages(messages: readonly unknown[]): ChatItem[] {
  const items: ChatItem[] = [];
  let n = 1;
  const id = (): string => `m${n++}`;
  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message['role'] === 'USER') {
      if (message['kind'] === 'INSTANT' && isInstantIntent(message['intent'])) {
        items.push({
          id: id(),
          kind: 'USER',
          input: { kind: 'INSTANT', intent: message['intent'] },
        });
      } else if (
        message['kind'] === 'TYPED' &&
        typeof message['text'] === 'string' &&
        message['text'] !== ''
      ) {
        items.push({
          id: id(),
          kind: 'USER',
          input: { kind: 'TYPED', question: message['text'] },
        });
      }
    } else if (message['role'] === 'ASSISTANT') {
      const reply = message['reply'];
      if (isReplyResultShape(reply)) {
        const provenance = reply.provenance as { request_id?: unknown };
        items.push({
          id: id(),
          kind: 'RESULT',
          requestId:
            typeof provenance.request_id === 'string'
              ? provenance.request_id
              : '',
          result: reply,
        });
      } else {
        const refusal = readRefusal(reply);
        if (refusal !== null) {
          items.push({
            id: id(),
            kind: 'REFUSAL',
            requestId: null,
            refusal,
            quota: null,
          });
        }
      }
    }
  }
  return items;
}

export type GetOutcome =
  | { ok: true; thread: ThreadSummary; items: ChatItem[] }
  | {
      ok: false;
      reason: 'DISABLED' | 'NOT_FOUND' | 'FAILED' | 'NETWORK' | 'ABORTED';
    };

/** One thread and its messages. */
export async function getThread(
  fetchImpl: Fetch,
  threadId: string,
  signal?: AbortSignal
): Promise<GetOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${CHAT_ROUTES.threads}/${encodeURIComponent(threadId)}`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        ...(signal === undefined ? {} : { signal }),
      }
    );
  } catch (error) {
    return {
      ok: false,
      reason: isAbort(error, signal) ? 'ABORTED' : 'NETWORK',
    };
  }
  const body = await readBody(response);
  const code = errorCode(body);
  if (response.status === 404 && code === 'FEATURE_DISABLED') {
    return { ok: false, reason: 'DISABLED' };
  }
  if (response.status === 404 && code === 'THREAD_INVALID') {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const thread = isRecord(body) ? readThread(body['thread']) : null;
  if (
    !response.ok ||
    !isRecord(body) ||
    body['success'] !== true ||
    thread === null ||
    !Array.isArray(body['messages'])
  ) {
    return { ok: false, reason: 'FAILED' };
  }
  return { ok: true, thread, items: itemsFromMessages(body['messages']) };
}

// ---------------------------------------------------------------------------------------
// Rename and delete
// ---------------------------------------------------------------------------------------

export type RenameOutcome =
  | { ok: true; title: string }
  | {
      ok: false;
      reason:
        | 'DISABLED'
        | 'NOT_FOUND'
        /** the server did not accept the title (empty or too long) */
        | 'INVALID'
        | 'FAILED'
        | 'NETWORK';
    };

/** Rename a thread. The title is sent as typed; the server trims it and answers with the one it kept. */
export async function renameThread(
  fetchImpl: Fetch,
  threadId: string,
  title: string
): Promise<RenameOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${CHAT_ROUTES.threads}/${encodeURIComponent(threadId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  const body = await readBody(response);
  const code = errorCode(body);
  if (response.status === 404 && code === 'FEATURE_DISABLED') {
    return { ok: false, reason: 'DISABLED' };
  }
  if (response.status === 404 && code === 'THREAD_INVALID') {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (response.status === 400) return { ok: false, reason: 'INVALID' };
  if (
    !response.ok ||
    !isRecord(body) ||
    body['success'] !== true ||
    typeof body['title'] !== 'string'
  ) {
    return { ok: false, reason: 'FAILED' };
  }
  return { ok: true, title: body['title'] };
}

export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: 'DISABLED' | 'NOT_FOUND' | 'FAILED' | 'NETWORK' };

/** Delete a thread and its messages. The server keeps the audit record of each request. */
export async function deleteThread(
  fetchImpl: Fetch,
  threadId: string
): Promise<DeleteOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${CHAT_ROUTES.threads}/${encodeURIComponent(threadId)}`,
      { method: 'DELETE', headers: { accept: 'application/json' } }
    );
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  const body = await readBody(response);
  const code = errorCode(body);
  if (response.status === 404 && code === 'FEATURE_DISABLED') {
    return { ok: false, reason: 'DISABLED' };
  }
  if (response.status === 404 && code === 'THREAD_INVALID') {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (!response.ok || !isRecord(body) || body['success'] !== true) {
    return { ok: false, reason: 'FAILED' };
  }
  return { ok: true };
}
