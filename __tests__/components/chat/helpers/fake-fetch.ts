/**
 * A fetch that answers the chat routes with what the REAL message route answered, recorded
 * (`app/dev/chat/recorded.json`, see `record.ts`), so the panel's tests drive the panel's own client
 * code (`wire.ts`, the stream hook, the provider) over the server's own bytes.
 *
 * `streamResponse` makes a genuine NDJSON `Response` whose body is a `ReadableStream`; `chunk` cuts
 * the text at a chosen size, so a line, or a multi-byte character, can be split across two reads the
 * way a network splits them.
 */

import recordedJson from '../../../../app/dev/chat/recorded.json';

import type { Exchange } from './record';

export const RECORDED = recordedJson as unknown as Record<string, Exchange>;

const encoder = new TextEncoder();

export function ndjson(events: readonly unknown[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('');
}

/** A streamed NDJSON response. `chunk` is the size, in bytes, of each read; 0 sends it in one read. */
export function streamResponse(
  text: string,
  options: { chunk?: number; status?: number; contentType?: string } = {}
): Response {
  const bytes = encoder.encode(text);
  const size =
    options.chunk === undefined || options.chunk <= 0
      ? bytes.length
      : options.chunk;
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      'content-type':
        options.contentType ?? 'application/x-ndjson; charset=utf-8',
    },
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** What the route answered for a recorded exchange, as a response. */
export function responseOf(
  name: string,
  options: { chunk?: number } = {}
): Response {
  const exchange = RECORDED[name];
  if (exchange === undefined) throw new Error(`no recorded exchange ${name}`);
  return exchange.kind === 'STREAM'
    ? streamResponse(ndjson(exchange.events), {
        ...options,
        status: exchange.status,
      })
    : jsonResponse(exchange.body, exchange.status);
}

export interface Call {
  url: string;
  method: string;
  body: unknown;
  signal: AbortSignal | undefined;
}

export interface FakeRoutes {
  /** `GET /api/chat/state`; a response or a function that makes one */
  state?: Response | (() => Response);
  /** `POST /api/chat/message`; a response, or a function of the request body */
  message?: (
    body: Record<string, unknown>,
    call: Call
  ) => Response | Promise<Response>;
  /** `POST /api/engine4/offer` */
  offer?: Response | (() => Response);
}

export interface FakeFetch {
  fetch: typeof fetch;
  calls: Call[];
  posts: () => Call[];
  gets: () => Call[];
}

export function fakeFetch(routes: FakeRoutes): FakeFetch {
  const calls: Call[] = [];
  const impl = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? 'GET';
    let body: unknown = null;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: Call = { url, method, body, signal: init?.signal ?? undefined };
    calls.push(call);
    if (url.endsWith('/api/chat/state')) {
      const state = routes.state;
      if (state === undefined) return jsonResponse({ success: false }, 500);
      return typeof state === 'function' ? state() : state.clone();
    }
    if (url.endsWith('/api/chat/message')) {
      if (routes.message === undefined)
        return jsonResponse({ success: false }, 500);
      return routes.message(body as Record<string, unknown>, call);
    }
    if (url.endsWith('/api/engine4/offer')) {
      const offer = routes.offer;
      if (offer === undefined) return jsonResponse({ success: false }, 404);
      return typeof offer === 'function' ? offer() : offer.clone();
    }
    return jsonResponse({ success: false }, 404);
  };
  const mocked = jest.fn(impl) as unknown as typeof fetch;
  return {
    fetch: mocked,
    calls,
    posts: () => calls.filter((c) => c.method === 'POST'),
    gets: () => calls.filter((c) => c.method === 'GET'),
  };
}

/** The state answer of the route with models and a balance: the shape `readInfo` reads. */
export function stateBody(
  overrides: {
    models?: unknown[];
    quota?: Record<string, unknown>;
    profile?: unknown;
    cycle?: unknown;
  } = {}
): unknown {
  return {
    success: true,
    models: overrides.models ?? [
      {
        slug: 'vendor-a/model-a',
        name: 'Model A',
        multiplier: 1,
        vision: true,
        units_per_msg: 18_000,
        default: true,
      },
      {
        slug: 'vendor-b/model-b',
        name: 'Model B',
        multiplier: 3,
        vision: false,
        units_per_msg: null,
        default: false,
      },
    ],
    quota: {
      configured: true,
      month: '2026-10',
      limit_units: 20_000_000,
      used_units: 10_000_000,
      reserved_units: 0,
      available_units: 10_000_000,
      ...(overrides.quota ?? {}),
    },
    profile:
      overrides.profile === undefined
        ? { trader_type: 'DAY_TRADER' }
        : overrides.profile,
    cycle:
      overrides.cycle === undefined
        ? { slot: '2026-09-18T20:55Z', data_status: 'FRESH' }
        : overrides.cycle,
  };
}

// ---------------------------------------------------------------------------------------
// Reading what was recorded
// ---------------------------------------------------------------------------------------

import type {
  IntakeRefusal,
  ReplyResult,
  StreamEvent,
} from '@/components/chat/types';

export function eventsOf(name: string): StreamEvent[] {
  const exchange = RECORDED[name];
  if (exchange === undefined || exchange.kind !== 'STREAM') {
    throw new Error(`${name} is not a recorded stream`);
  }
  return exchange.events as StreamEvent[];
}

/** The reply of a recorded stream that ends in a result. */
export function resultOf(name: string): ReplyResult {
  const last = eventsOf(name).at(-1) as StreamEvent;
  if (last.type !== 'result')
    throw new Error(`${name} does not end in a result`);
  return last.result;
}

export function resultOfKind<K extends ReplyResult['kind']>(
  name: string,
  kind: K
): Extract<ReplyResult, { kind: K }> {
  const result = resultOf(name);
  if (result.kind !== kind)
    throw new Error(`${name} is ${result.kind}, not ${kind}`);
  return result as Extract<ReplyResult, { kind: K }>;
}

/** The refusal in a recorded stream or in a recorded JSON body. */
export function refusalOf(name: string): IntakeRefusal {
  const exchange = RECORDED[name];
  if (exchange === undefined) throw new Error(`no recorded exchange ${name}`);
  if (exchange.kind === 'JSON') {
    return (exchange.body as { refusal: IntakeRefusal }).refusal;
  }
  const last = exchange.events.at(-1) as StreamEvent;
  if (last.type !== 'refusal')
    throw new Error(`${name} does not end in a refusal`);
  return last.refusal;
}
