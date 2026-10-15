/**
 * An in-memory stand-in for the threads routes (build step 7 part 9), in the shapes the REAL routes
 * answer (`lib/reply/server/threads-api.ts`: `threadView`, `messageView`, the opaque cursor, the
 * 404 `THREAD_INVALID` for a thread that is not the trader's, the 404 `FEATURE_DISABLED` when the
 * flag is off). Panel A's tests drive the panel's own client code over it.
 *
 * The routes are pure functions of the store, so a test can read what was asked (`calls`) and what is
 * stored (`threads`), and a message route stand-in can file an exchange into it the way the real one
 * does (`file`).
 */

import type { ReplyResult } from '@/components/chat/types';

import { jsonResponse, type Call } from './fake-fetch';

export interface ThreadJson {
  id: string;
  symbol: string;
  title: string;
  title_source: 'AUTO' | 'USER';
  trader_type: 'DAY_TRADER' | 'SCALPER';
  last_bias: 'LONG' | 'SHORT' | 'NEUTRAL' | 'STAND_ASIDE' | null;
  last_cycle_slot: string | null;
  last_preview: string;
  message_count: number;
  report_count: number;
  last_message_at: string;
  created_at: string;
}

export interface MessageJson {
  seq: number;
  role: 'USER' | 'ASSISTANT';
  kind: string;
  intent: string | null;
  text: string | null;
  reply: unknown;
  cycle_slot: string | null;
  created_at: string;
}

export function threadJson(over: Partial<ThreadJson> = {}): ThreadJson {
  return {
    id: 'th-1',
    symbol: 'XAUUSD',
    title: 'XAUUSD · M15 · LONG · 18 SEP 20:55',
    title_source: 'AUTO',
    trader_type: 'DAY_TRADER',
    last_bias: 'LONG',
    last_cycle_slot: '2026-09-18T20:55Z',
    last_preview: 'Gold is holding above the channel.',
    message_count: 2,
    report_count: 1,
    last_message_at: '2026-09-18T21:02:00.000Z',
    created_at: '2026-09-18T21:00:00.000Z',
    ...over,
  };
}

/** The two stored messages of one exchange, as `GET /api/chat/threads/[id]` lists them. */
export function exchangeJson(
  seq: number,
  user: { text: string } | { instant: string },
  reply: unknown
): MessageJson[] {
  return [
    {
      seq,
      role: 'USER',
      kind: 'text' in user ? 'TYPED' : 'INSTANT',
      intent: 'text' in user ? null : user.instant,
      text: 'text' in user ? user.text : null,
      reply: null,
      cycle_slot: null,
      created_at: '2026-09-18T21:00:00.000Z',
    },
    {
      seq: seq + 1,
      role: 'ASSISTANT',
      kind:
        typeof reply === 'object' &&
        reply !== null &&
        typeof (reply as { kind?: unknown }).kind === 'string'
          ? (reply as { kind: string }).kind
          : 'REFUSAL',
      intent: null,
      text: null,
      reply,
      cycle_slot: null,
      created_at: '2026-09-18T21:00:05.000Z',
    },
  ];
}

const cursorOf = (index: number): string =>
  Buffer.from(JSON.stringify({ t: index, id: 'x' }), 'utf8').toString(
    'base64url'
  );
const indexOf = (cursor: string): number | null => {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return Number.isSafeInteger(value.t) ? (value.t as number) : null;
  } catch {
    return null;
  }
};

export interface ThreadsServer {
  /** the handler to give `fakeFetch({ threads })` */
  handle: (call: Call) => Response;
  /** the threads in the store, newest message first */
  threads: ThreadJson[];
  messages: Record<string, MessageJson[]>;
  calls: Call[];
  /** make every route answer 404 FEATURE_DISABLED, as with `REPLY_ENABLED` off */
  disable: () => void;
  /** make the next calls of a method fail with a status (once, unless `times` says more) */
  failNext: (method: string, status?: number, times?: number) => void;
  /** file an exchange into a thread, creating it on the first one, the way the message route does */
  file: (args: {
    threadId: string;
    title: string;
    user: { text: string } | { instant: string };
    reply: ReplyResult;
  }) => void;
}

const THREAD_PATH = /\/api\/chat\/threads(?:\/([^/?]+))?(?:\?(.*))?$/;

export function threadsServer(
  initial: ThreadJson[] = [],
  messages: Record<string, MessageJson[]> = {}
): ThreadsServer {
  const server: ThreadsServer = {
    threads: [...initial],
    messages: { ...messages },
    calls: [],
    handle: () => jsonResponse({ success: false }, 404),
    disable: () => undefined,
    failNext: () => undefined,
    file: () => undefined,
  };
  let disabled = false;
  const failures: { method: string; status: number; times: number }[] = [];

  server.disable = () => {
    disabled = true;
  };
  server.failNext = (method, status = 500, times = 1) => {
    failures.push({ method, status, times });
  };

  const sort = (): void => {
    server.threads.sort((a, b) =>
      a.last_message_at < b.last_message_at ? 1 : -1
    );
  };

  server.file = ({ threadId, title, user, reply }) => {
    const stored =
      server.messages[threadId] ?? (server.messages[threadId] = []);
    stored.push(...exchangeJson(stored.length + 1, user, reply));
    const now = new Date().toISOString();
    const existing = server.threads.find((thread) => thread.id === threadId);
    const bias =
      reply.kind === 'REPORT1'
        ? reply.report.direction.bias
        : reply.kind === 'FIXED_ANSWER'
          ? (reply.fixed.direction?.bias ?? null)
          : null;
    if (existing === undefined) {
      server.threads.push(
        threadJson({
          id: threadId,
          title,
          last_bias: bias,
          last_cycle_slot: reply.stamp.as_of,
          message_count: 2,
          last_message_at: now,
          created_at: now,
        })
      );
    } else {
      existing.message_count += 2;
      existing.last_message_at = now;
      if (bias !== null) existing.last_bias = bias;
    }
    sort();
  };

  server.handle = (call) => {
    server.calls.push(call);
    if (disabled) {
      return jsonResponse(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      );
    }
    const failure = failures.find((f) => f.method === call.method);
    if (failure !== undefined) {
      failure.times -= 1;
      if (failure.times <= 0) failures.splice(failures.indexOf(failure), 1);
      return jsonResponse(
        { success: false, error: { code: 'FEATURE_UNAVAILABLE' } },
        failure.status
      );
    }
    const match = THREAD_PATH.exec(call.url);
    if (match === null) return jsonResponse({ success: false }, 404);
    const id = match[1] === undefined ? null : decodeURIComponent(match[1]);
    const query = new URLSearchParams(match[2] ?? '');
    const notYours = (): Response =>
      jsonResponse(
        {
          success: false,
          error: { code: 'THREAD_INVALID', message: 'No such thread.' },
        },
        404
      );

    if (id === null) {
      if (call.method !== 'GET') return jsonResponse({ success: false }, 405);
      const limit = Number(query.get('limit') ?? 50);
      const after = query.get('after');
      const start = after === null ? 0 : indexOf(after);
      if (start === null) return jsonResponse({ success: false }, 400);
      const page = server.threads.slice(start, start + limit);
      const more = start + limit < server.threads.length;
      return jsonResponse({
        success: true,
        threads: page,
        next: more ? cursorOf(start + limit) : null,
      });
    }

    const thread = server.threads.find((t) => t.id === id);
    if (thread === undefined) return notYours();
    if (call.method === 'GET') {
      return jsonResponse({
        success: true,
        thread,
        messages: server.messages[id] ?? [],
      });
    }
    if (call.method === 'PATCH') {
      const title = (call.body as { title?: unknown } | null)?.title;
      if (typeof title !== 'string' || title.trim() === '') {
        return jsonResponse(
          { success: false, error: { code: 'BAD_REQUEST' } },
          400
        );
      }
      thread.title = title.trim();
      thread.title_source = 'USER';
      return jsonResponse({ success: true, title: thread.title });
    }
    if (call.method === 'DELETE') {
      server.threads = server.threads.filter((t) => t.id !== id);
      delete server.messages[id];
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false }, 405);
  };

  return server;
}
