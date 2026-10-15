/**
 * An in-memory stand-in for the threads routes, for the whole-workspace development preview (build step
 * 7 part 9). It answers `GET /api/chat/threads` (a page at a time, with an opaque cursor),
 * `GET /api/chat/threads/<id>` (the thread and its messages), `PATCH` (rename) and `DELETE`, in the
 * shapes the REAL routes answer (`lib/reply/server/threads-api.ts`), so Panel A's own client code runs
 * over it. The messages it holds are RECORDED replies of the real message route (`../chat/recorded.json`);
 * nothing here writes a reply of its own.
 *
 * Seven worlds, to look at every state of the list: five threads (one of each direction and one with
 * none), many (so that "Show more" has a second page), none, a list that takes a while to arrive, a
 * list that cannot be read, and the chat switched off (the route answers 404 to everybody).
 *
 * A message the preview's message stand-in answers is filed into the store the way the real route files
 * it: the first one makes a thread with a title in the server's deterministic form, a later one extends
 * the thread it was sent into. Nothing leaves the page.
 */

import type {
  IntakeRefusal,
  ReplyResult,
  StreamEvent,
} from '@/components/chat/types';

import { RECORDED } from '../chat/scenarios';
import { localizeRefusal, localizeResult } from '../chat/samples';

export const THREAD_WORLDS = [
  'five',
  'many',
  'none',
  'slow',
  'error',
  'off',
] as const;
export type ThreadWorld = (typeof THREAD_WORLDS)[number];

type Bias = 'LONG' | 'SHORT' | 'NEUTRAL' | 'STAND_ASIDE';

interface Row {
  id: string;
  symbol: string;
  title: string;
  title_source: 'AUTO' | 'USER';
  trader_type: 'DAY_TRADER' | 'SCALPER';
  last_bias: Bias | null;
  last_cycle_slot: string | null;
  last_preview: string;
  message_count: number;
  report_count: number;
  last_message_at: string;
  created_at: string;
}

interface Message {
  seq: number;
  role: 'USER' | 'ASSISTANT';
  kind: string;
  intent: string | null;
  text: string | null;
  reply: unknown;
  cycle_slot: string | null;
  created_at: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/** `2026-09-18T20:55Z` as `18 SEP 20:55`, the way the server writes a title. */
function stampWord(slot: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(slot);
  if (match === null) return slot;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[4]}:${match[5]}`;
}

function recordedResult(name: string): ReplyResult | null {
  const exchange = RECORDED[name];
  if (exchange === undefined || exchange.kind !== 'STREAM') return null;
  const last = exchange.events[exchange.events.length - 1] as
    | StreamEvent
    | undefined;
  return last !== undefined && last.type === 'result' ? last.result : null;
}

function recordedRefusal(name: string): IntakeRefusal | null {
  const exchange = RECORDED[name];
  if (exchange === undefined) return null;
  if (exchange.kind === 'JSON') {
    return (exchange.body as { refusal?: IntakeRefusal }).refusal ?? null;
  }
  const last = exchange.events[exchange.events.length - 1] as
    | StreamEvent
    | undefined;
  return last !== undefined && last.type === 'refusal' ? last.refusal : null;
}

const biasOf = (result: ReplyResult): Bias | null =>
  result.kind === 'REPORT1'
    ? result.report.direction.bias
    : result.kind === 'FIXED_ANSWER'
      ? (result.fixed.direction?.bias ?? null)
      : null;

const dayOf = (offset: number): string =>
  new Date(Date.UTC(2026, 8, 28, 23, 15 - offset, 0)).toISOString();

export interface ThreadsStandIn {
  /** the response for a threads URL, or null when the URL is not one of the threads routes */
  handle: (
    url: string,
    init: RequestInit | undefined
  ) => Response | Promise<Response> | null;
  /**
   * File the exchange a message route answered with: makes the thread on the first message, extends it
   * on the next. Returns the id of the thread the reply belongs to.
   */
  accept: (args: { answer: string; body: Record<string, unknown> }) => string;
}

export function threadsStandIn(options: {
  world: () => ThreadWorld;
  language: () => string;
  t: (key: string, fallback?: string) => string;
  /** how long the "slow" world takes to answer, in milliseconds */
  slowMs?: number;
}): ThreadsStandIn {
  const rows: Row[] = [];
  const messages: Record<string, Message[]> = {};
  let seeded: ThreadWorld | null = null;
  let counter = 0;

  const exchange = (
    seq: number,
    user: { text: string } | { instant: string },
    reply: unknown,
    at: string
  ): Message[] => [
    {
      seq,
      role: 'USER',
      kind: 'text' in user ? 'TYPED' : 'INSTANT',
      intent: 'text' in user ? null : user.instant,
      text: 'text' in user ? user.text : null,
      reply: null,
      cycle_slot: null,
      created_at: at,
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
      created_at: at,
    },
  ];

  const seedRow = (
    over: Partial<Row> & Pick<Row, 'id' | 'title' | 'last_bias'>,
    user: { text: string } | { instant: string },
    reply: unknown,
    offset: number
  ): void => {
    const at = dayOf(offset);
    rows.push({
      symbol: 'XAUUSD',
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
      last_cycle_slot: '2026-09-18T20:55Z',
      last_preview: 'text' in user ? user.text : '',
      message_count: 2,
      report_count: 1,
      last_message_at: at,
      created_at: at,
      ...over,
    });
    messages[over.id] = exchange(1, user, reply, at);
  };

  const seed = (world: ThreadWorld): void => {
    rows.length = 0;
    for (const key of Object.keys(messages)) delete messages[key];
    const long = recordedResult('report1-long');
    const short = recordedResult('report1-short-instant');
    const answer = recordedResult('answer');
    const stale = recordedResult('fixed-stale');
    if (world === 'none' || world === 'off' || world === 'error') return;
    if (long === null || short === null || answer === null || stale === null) {
      return;
    }
    if (world === 'five' || world === 'slow') {
      seedRow(
        {
          id: 'th-fixture-0002',
          title: 'XAUUSD · M5 · SHORT · 28 SEP 23:15',
          last_bias: 'SHORT',
          last_cycle_slot: '2026-09-28T23:15Z',
        },
        { instant: 'INSTANT_M5_INSPECT' },
        short,
        0
      );
      seedRow(
        {
          id: 'th-fixture-0001',
          title: 'XAUUSD · M15 · LONG · 18 SEP 20:55',
          last_bias: 'LONG',
        },
        { text: 'What is the direction of gold now?' },
        long,
        25
      );
      seedRow(
        {
          id: 'th-fixture-0007',
          title: 'XAUUSD · DIRECTION · NEUTRAL · 18 SEP 20:55',
          last_bias: 'NEUTRAL',
        },
        { text: 'Is gold ranging today?' },
        answer,
        60
      );
      seedRow(
        {
          id: 'th-fixture-0008',
          title: 'XAUUSD · ENTRY · STAND ASIDE · 18 SEP 20:55',
          last_bias: 'STAND_ASIDE',
        },
        { text: 'Should I enter before the news?' },
        stale,
        95
      );
      seedRow(
        {
          id: 'th-fixture-0003',
          title: 'My notes on MCD2',
          title_source: 'USER',
          last_bias: null,
        },
        { text: 'Why is MCD2 cautionary?' },
        answer,
        130
      );
      return;
    }
    // many: enough for a second page
    const biases: (Bias | null)[] = [
      'LONG',
      'SHORT',
      'NEUTRAL',
      'STAND_ASIDE',
      null,
    ];
    for (let i = 0; i < 45; i += 1) {
      const bias = biases[i % biases.length] ?? null;
      seedRow(
        {
          id: `th-many-${String(i + 1).padStart(2, '0')}`,
          title: `XAUUSD · M15 · ${bias === null ? 'EXPLAIN' : bias.replace('_', ' ')} · ${stampWord(dayOf(i * 40))}`,
          last_bias: bias,
        },
        { text: `Question number ${i + 1}` },
        answer,
        i * 40
      );
    }
  };

  const ensure = (): ThreadWorld => {
    const world = options.world();
    if (seeded !== world) {
      seed(world);
      seeded = world;
    }
    return world;
  };

  const sort = (): void => {
    rows.sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
  };

  const cursorOf = (index: number): string => btoa(String(index));
  const indexOf = (cursor: string): number | null => {
    try {
      const value = Number(atob(cursor));
      return Number.isSafeInteger(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  };

  const localizedMessage = (message: Message): Message => {
    const language = options.language();
    if (language.startsWith('en') || message.reply === null) return message;
    const reply = message.reply as ReplyResult | IntakeRefusal;
    return {
      ...message,
      reply:
        'kind' in reply
          ? localizeResult(reply, language)
          : localizeRefusal(reply, language, options.t),
    };
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const route = async (
    url: string,
    init: RequestInit | undefined
  ): Promise<Response> => {
    const world = ensure();
    if (world === 'off') {
      return json(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      );
    }
    const match = /\/api\/chat\/threads(?:\/([^/?]+))?(?:\?(.*))?$/.exec(url);
    if (match === null) return json({ success: false }, 404);
    const method = init?.method ?? 'GET';
    const id = match[1] === undefined ? null : decodeURIComponent(match[1]);
    const query = new URLSearchParams(match[2] ?? '');

    if (id === null) {
      if (world === 'slow') await wait(options.slowMs ?? 2500);
      if (world === 'error') {
        return json(
          { success: false, error: { code: 'FEATURE_UNAVAILABLE' } },
          503
        );
      }
      const limit = Number(query.get('limit') ?? 50);
      const after = query.get('after');
      const start = after === null ? 0 : indexOf(after);
      if (start === null) return json({ success: false }, 400);
      sort();
      return json({
        success: true,
        threads: rows.slice(start, start + limit),
        next: start + limit < rows.length ? cursorOf(start + limit) : null,
      });
    }

    const row = rows.find((r) => r.id === id);
    if (row === undefined) {
      return json(
        { success: false, error: { code: 'THREAD_INVALID', message: 'No' } },
        404
      );
    }
    if (method === 'GET') {
      await wait(350);
      return json({
        success: true,
        thread: row,
        messages: (messages[id] ?? []).map(localizedMessage),
      });
    }
    if (method === 'PATCH') {
      let title: unknown = null;
      try {
        title = (JSON.parse(String(init?.body)) as { title?: unknown }).title;
      } catch {
        title = null;
      }
      if (typeof title !== 'string' || title.trim() === '') {
        return json({ success: false, error: { code: 'BAD_REQUEST' } }, 400);
      }
      row.title = title.trim().slice(0, 80);
      row.title_source = 'USER';
      return json({ success: true, title: row.title });
    }
    if (method === 'DELETE') {
      rows.splice(rows.indexOf(row), 1);
      delete messages[id];
      return json({ success: true });
    }
    return json({ success: false }, 405);
  };

  return {
    handle: (url, init) =>
      /\/api\/chat\/threads(\/|\?|$)/.test(url) ? route(url, init) : null,

    accept: ({ answer, body }) => {
      ensure();
      const result = recordedResult(answer);
      const refusal = recordedRefusal(answer);
      const given =
        typeof body['thread_id'] === 'string' ? body['thread_id'] : null;
      const id = given ?? `th-preview-${(counter += 1)}`;
      const now = new Date().toISOString();
      const user: { text: string } | { instant: string } =
        typeof body['kind'] === 'string'
          ? { instant: body['kind'] }
          : { text: String(body['question'] ?? '') };
      const reply: unknown = result ?? refusal;
      // a reply that is not a result or a refusal (an error, a failure) is not filed
      if (reply === null) return id;
      const filed = result === null ? reply : { ...result, thread_id: id };
      const row = rows.find((r) => r.id === id);
      const bias = result === null ? null : biasOf(result);
      const stored = messages[id] ?? (messages[id] = []);
      stored.push(...exchange(stored.length + 1, user, filed, now));
      if (row === undefined) {
        const timeframe =
          'instant' in user
            ? user.instant === 'INSTANT_M5_INSPECT'
              ? 'M5'
              : 'M15'
            : 'M15';
        const slot =
          result === null ? '2026-09-18T20:55Z' : (result.stamp.as_of ?? '');
        rows.push({
          id,
          symbol: 'XAUUSD',
          title: `XAUUSD · ${timeframe} · ${bias === null ? 'EXPLAIN' : bias.replace('_', ' ')} · ${stampWord(slot)}`,
          title_source: 'AUTO',
          trader_type: 'DAY_TRADER',
          last_bias: bias,
          last_cycle_slot: slot === '' ? null : slot,
          last_preview: 'text' in user ? user.text : '',
          message_count: 2,
          report_count: result !== null && result.kind === 'REPORT1' ? 1 : 0,
          last_message_at: now,
          created_at: now,
        });
      } else {
        row.message_count += 2;
        row.last_message_at = now;
        if (bias !== null) row.last_bias = bias;
        if ('text' in user) row.last_preview = user.text;
      }
      sort();
      return id;
    },
  };
}
