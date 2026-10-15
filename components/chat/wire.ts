/**
 * The browser's side of the two chat routes (build step 7 part 8): `POST /api/chat/message` (an NDJSON
 * stream, ADR-054) and `GET /api/chat/state`.
 *
 * Nothing here knows about React. `sendMessage` posts one request and reads the stream with a
 * `ReadableStreamDefaultReader` and a `TextDecoder`: it hands every stage event to a callback as it
 * arrives, and returns the ONE terminal event (`result`, `refusal` or `error`) or the reason there was
 * none. The reply is delivered whole (D24), so there is nothing to patch together: a stream that ends
 * without a terminal event, a half line, a line that is not JSON and a result that is not one of the
 * four kinds all become `BAD_STREAM`, and nothing is drawn from them.
 *
 * A request the server turns away BEFORE the stream begins (the allowance cannot cover it, the tier,
 * the profile, the body) is not a stream: it is a JSON body with an HTTP status
 * (`lib/reply/server/errors.ts`). A refusal in it is the trader's to read; the rest is a failure.
 *
 * The strict validators of `lib/reply/contracts` are not imported: they sit on the intake pipeline and
 * the server must not reach the browser bundle. The server validates every event it sends; this file
 * checks only what the panel needs to draw something true (a known kind, the fields it reads).
 *
 * @module components/chat/wire
 */

import { CHAT_ROUTES, STAGES } from './limits';
import type {
  ChatInfo,
  DataStatus,
  ErrorEvent,
  IntakeRefusal,
  PickerModel,
  QuotaBody,
  QuotaState,
  RefusalEvent,
  ResultEvent,
  StageEvent,
  StreamEvent,
  TerminalEvent,
  TraderType,
} from './types';

type Fetch = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RESULT_KINDS = ['REPORT1', 'ANSWER', 'FIXED_ANSWER', 'ACTION'];
const STAGE_STATUSES = ['STARTED', 'DONE', 'SKIPPED'];

// ---------------------------------------------------------------------------------------
// One line of the stream
// ---------------------------------------------------------------------------------------

/** One event, or null for a line that is not an event the panel can use. */
export function parseEventLine(line: string): StreamEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  switch (value['type']) {
    case 'stage':
      return typeof value['stage'] === 'string' &&
        (STAGES as readonly string[]).includes(value['stage']) &&
        typeof value['status'] === 'string' &&
        STAGE_STATUSES.includes(value['status'])
        ? (value as unknown as StageEvent)
        : null;
    case 'result': {
      const result = value['result'];
      return typeof value['request_id'] === 'string' &&
        isRecord(result) &&
        typeof result['kind'] === 'string' &&
        RESULT_KINDS.includes(result['kind']) &&
        typeof result['thread_id'] === 'string' &&
        typeof result['reply_locale'] === 'string' &&
        isRecord(result['stamp']) &&
        isRecord(result['provenance']) &&
        isRecord(result['checks']) &&
        Array.isArray(result['changes']) &&
        Array.isArray(result['notes'])
        ? (value as unknown as ResultEvent)
        : null;
    }
    case 'refusal':
      return typeof value['request_id'] === 'string' &&
        readRefusal(value['refusal']) !== null
        ? (value as unknown as RefusalEvent)
        : null;
    case 'error':
      return typeof value['request_id'] === 'string' &&
        typeof value['code'] === 'string' &&
        typeof value['retryable'] === 'boolean'
        ? (value as unknown as ErrorEvent)
        : null;
    default:
      return null;
  }
}

function readRefusal(value: unknown): IntakeRefusal | null {
  return isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['stage'] === 'string' &&
    typeof value['reply'] === 'string' &&
    typeof value['reply_locale'] === 'string'
    ? (value as unknown as IntakeRefusal)
    : null;
}

/**
 * Read a stream to its end, calling `onEvent` for each event as its line completes. Returns the
 * events in order, and whether the text ended cleanly (every line complete and readable).
 */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
): Promise<{ events: StreamEvent[]; clean: boolean }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: StreamEvent[] = [];
  let buffer = '';
  let clean = true;

  const take = (line: string): void => {
    if (line === '') return;
    const event = parseEventLine(line);
    if (event === null) {
      clean = false;
      return;
    }
    events.push(event);
    onEvent(event);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        take(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  // a half line at the end is a cut stream
  if (buffer !== '') clean = false;
  return { events, clean };
}

// ---------------------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------------------

/** Why there was no terminal event, or what the server said instead of a stream. */
export type SendFailure =
  | { kind: 'ABORTED' }
  | { kind: 'NETWORK' }
  | { kind: 'BAD_STREAM' }
  /** the route does not exist: `REPLY_ENABLED` is not on (a 404 for everybody) */
  | { kind: 'DISABLED' }
  /** the gate or the door said no before any stream began; the reply is already in the reader's language */
  | {
      kind: 'REFUSED';
      status: number;
      requestId: string | null;
      refusal: IntakeRefusal;
      quota: QuotaBody | null;
    }
  /** any other status: the code the server gave (`BAD_REQUEST`, `INTERNAL`, ...) */
  | { kind: 'FAILED'; status: number; code: string; requestId: string | null };

export type SendOutcome =
  | { ok: true; terminal: TerminalEvent }
  | { ok: false; failure: SendFailure };

function readQuota(value: unknown): QuotaBody | null {
  return isRecord(value) &&
    typeof value['limit_units'] === 'number' &&
    typeof value['available_units'] === 'number' &&
    typeof value['needed_units'] === 'number'
    ? {
        limit_units: value['limit_units'],
        available_units: value['available_units'],
        needed_units: value['needed_units'],
      }
    : null;
}

/**
 * What a JSON error body of the chat routes says (`lib/reply/server/errors.ts`): the route is off, a
 * refusal the trader reads (with the balance, for an allowance refusal), or a failure with a code.
 * Pure, so the development preview and the tests build exactly the failure the client builds.
 */
export function failureFromBody(status: number, body: unknown): SendFailure {
  const record = isRecord(body) ? body : {};
  const error = isRecord(record['error']) ? record['error'] : {};
  const code = typeof error['code'] === 'string' ? error['code'] : 'INTERNAL';
  const requestId =
    typeof record['request_id'] === 'string' ? record['request_id'] : null;
  if (status === 404 && code === 'FEATURE_DISABLED') {
    return { kind: 'DISABLED' };
  }
  const refusal = readRefusal(record['refusal']);
  if (refusal !== null) {
    return {
      kind: 'REFUSED',
      status,
      requestId,
      refusal,
      quota: readQuota(record['quota']),
    };
  }
  return { kind: 'FAILED', status, code, requestId };
}

async function failureOf(response: Response): Promise<SendFailure> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return failureFromBody(response.status, body);
}

const isAbort = (error: unknown, signal: AbortSignal | undefined): boolean =>
  (signal !== undefined && signal.aborted) ||
  (error instanceof Error && error.name === 'AbortError');

export interface SendArgs {
  fetchImpl: Fetch;
  /** the JSON body: `client_request_id`, `thread_id`, and `question` or `kind` */
  body: Record<string, unknown>;
  signal?: AbortSignal;
  onStage: (event: StageEvent) => void;
}

/** POST one request and read what comes back. Never throws. */
export async function sendMessage(args: SendArgs): Promise<SendOutcome> {
  const { fetchImpl, body, signal, onStage } = args;
  let response: Response;
  try {
    response = await fetchImpl(CHAT_ROUTES.message, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return {
      ok: false,
      failure: isAbort(error, signal)
        ? { kind: 'ABORTED' }
        : { kind: 'NETWORK' },
    };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.startsWith('application/x-ndjson')) {
    if (response.ok) return { ok: false, failure: { kind: 'BAD_STREAM' } };
    return { ok: false, failure: await failureOf(response) };
  }
  if (response.body === null) {
    return { ok: false, failure: { kind: 'BAD_STREAM' } };
  }

  try {
    const { events, clean } = await readEvents(response.body, (event) => {
      if (event.type === 'stage') onStage(event);
    });
    const terminals = events.filter(
      (event): event is TerminalEvent => event.type !== 'stage'
    );
    const last = events[events.length - 1];
    if (
      !clean ||
      terminals.length !== 1 ||
      last === undefined ||
      last.type === 'stage'
    ) {
      return { ok: false, failure: { kind: 'BAD_STREAM' } };
    }
    return { ok: true, terminal: last };
  } catch (error) {
    return {
      ok: false,
      failure: isAbort(error, signal)
        ? { kind: 'ABORTED' }
        : { kind: 'NETWORK' },
    };
  }
}

// ---------------------------------------------------------------------------------------
// GET /api/chat/state
// ---------------------------------------------------------------------------------------

export type StateOutcome =
  | { ok: true; info: ChatInfo }
  | { ok: false; reason: 'DISABLED' | 'FAILED' | 'NETWORK' | 'ABORTED' };

const DATA_STATUS_VALUES = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
  'UNKNOWN',
];

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function readModel(value: unknown): PickerModel | null {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    typeof value['name'] !== 'string'
  ) {
    return null;
  }
  return {
    slug: value['slug'],
    name: value['name'],
    multiplier: numberOrNull(value['multiplier']) ?? 1,
    vision: value['vision'] === true,
    units_per_msg: numberOrNull(value['units_per_msg']),
    default: value['default'] === true,
  };
}

/** The state answer, or null when it is not one. Anything the panel cannot read is left out. */
export function readInfo(body: unknown): ChatInfo | null {
  if (!isRecord(body) || body['success'] !== true) return null;
  const quota = isRecord(body['quota']) ? body['quota'] : {};
  const quotaState: QuotaState = {
    configured: quota['configured'] === true,
    month: typeof quota['month'] === 'string' ? quota['month'] : '',
    limit_units: numberOrNull(quota['limit_units']),
    used_units: numberOrNull(quota['used_units']),
    reserved_units: numberOrNull(quota['reserved_units']),
    available_units: numberOrNull(quota['available_units']),
  };
  const profile = isRecord(body['profile']) ? body['profile'] : null;
  const traderType =
    profile !== null &&
    (profile['trader_type'] === 'DAY_TRADER' ||
      profile['trader_type'] === 'SCALPER')
      ? (profile['trader_type'] as TraderType)
      : null;
  const cycle = isRecord(body['cycle']) ? body['cycle'] : null;
  return {
    models: (Array.isArray(body['models']) ? body['models'] : [])
      .map(readModel)
      .filter((model): model is PickerModel => model !== null),
    quota: quotaState,
    profile: traderType === null ? null : { trader_type: traderType },
    cycle:
      cycle !== null &&
      typeof cycle['data_status'] === 'string' &&
      DATA_STATUS_VALUES.includes(cycle['data_status'])
        ? {
            slot: typeof cycle['slot'] === 'string' ? cycle['slot'] : null,
            data_status: cycle['data_status'] as DataStatus,
          }
        : null,
  };
}

/** Read the panel's state. Never throws. */
export async function loadInfo(
  fetchImpl: Fetch,
  signal?: AbortSignal
): Promise<StateOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(CHAT_ROUTES.state, {
      method: 'GET',
      headers: { accept: 'application/json' },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: isAbort(error, signal) ? 'ABORTED' : 'NETWORK',
    };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.status === 404) {
    const code =
      isRecord(body) && isRecord(body['error']) ? body['error']['code'] : null;
    if (code === 'FEATURE_DISABLED') return { ok: false, reason: 'DISABLED' };
  }
  const info = response.ok ? readInfo(body) : null;
  return info === null ? { ok: false, reason: 'FAILED' } : { ok: true, info };
}
