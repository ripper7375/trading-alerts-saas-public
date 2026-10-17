/**
 * The OpenRouter adapter: the ONE place that holds the key and calls a model (build step 7
 * part 3; architecture 5.10, ADR-055, ADR-077; decisions D1 and D5; plan findings S7-F2, S7-F16).
 *
 * One `fetch` to the OpenAI-compatible `chat/completions` endpoint of OpenRouter, no SDK, no new
 * dependency. What every request carries:
 *
 *  - `provider.data_collection: "deny"` (ADR-077): the provider may not keep or train on the prompt.
 *    A registry `provider_only` list adds `provider.only`, and a JSON-schema request adds
 *    `provider.require_parameters` so a host that would ignore the schema is not used.
 *  - `usage: { include: true }`: asks for the token counts and the cost, which `usage.ts` turns
 *    into integer micro-dollars (ADR-050). OpenRouter's documentation (read 2026-10-14) now says
 *    usage is ALWAYS returned and this parameter is deprecated with no effect; it is sent because
 *    the order asks for it and costs nothing. If the S1 smoke shows a JSON-schema call refused for
 *    want of a host while `require_parameters` is on, drop this field first.
 *  - `response_format`: `json_schema` (strict) when the model enforces it, otherwise `json_object`;
 *    the validator is the caller's either way (a provider can ignore a schema), and the result's
 *    `response_mode` says which was sent.
 *  - cache breakpoints (`cache_control: { type: "ephemeral" }`, the form OpenRouter documents for
 *    Anthropic Claude, explicit Gemini caching and Qwen) on the cacheable text parts, only for a
 *    model whose `prompt_caching` is `EXPLICIT`; an `AUTO` model caches by prefix on its own
 *    (OpenAI, DeepSeek, Moonshot, Z.AI, Gemini 2.5 implicit) and `NONE` does not. GPT-5.6's
 *    optional explicit mode uses a different field (`prompt_cache_breakpoint`) that is NOT sent here.
 *
 * Time and retries (decision D23, amended by the Next.js remediation T1-b): one attempt waits
 * `timeout_ms` (the primary model 25 s, the fallback 20 s; the Understand call keeps its one
 * second). ONE retry for HTTP 429, HTTP 5xx or a network error; NONE for any other 4xx, a body that
 * is not a completion, a body that is too large, or a request that was aborted by the caller's own
 * deadline: the same request would fail the same way. The retry is immediate.
 *
 * A TIMEOUT is not retried by a model port (`createOpenRouterModelPort`: the primary and the
 * fallback). A model that did not answer in 25 s will not answer in the next 25 s, and the second
 * attempt would eat the deadline the fallback needs: 25 + 25 + 20 s is more than the 55 s of
 * `REPLY_DEADLINE_MS`, 25 + 20 s is not. The primary gives up at once and `fallback.ts` asks the
 * other vendor. `callOpenRouter` itself still retries a timeout unless told not to
 * (`retryOnTimeout`), because the Understand call (one second an attempt, no fallback) keeps its
 * documented retry.
 *
 * THE KEY. It is read once into the `Authorization` header and appears nowhere else: not in the
 * URL, the body, a header other than that one, a result, a code, an exception, a log line or a
 * trace. Every failure is a CODE (`types.ts`); the text of a provider's error, the exception behind
 * a failed `fetch` and the body of a refused request are never copied. The few strings taken from a
 * good response (the served model, the host, the generation id, the finish reason) must be plain
 * words, and a response that contains the key anywhere in what is surfaced is refused as a bad
 * response. The URL must be https, or http on this machine, carry no user name, and is not
 * redirected.
 *
 * The request and the response follow the format OpenRouter documents. They are held to by the unit
 * tests with a fake `fetch`; the adapter has NOT been called against a real endpoint. The first
 * contact is the key-gated smoke script `scripts/reply/gateway-smoke.js` (runbook S1). Anything the
 * adapter does not recognise fails closed: a code, the fallback model, then the board-only answer.
 *
 * Imported BY PATH, never through a barrel. It uses `fetch`, a timer and the clock (for the latency
 * it reports; a test passes its own); `__tests__/lib/reply/boundaries.test.ts` allows exactly that
 * here and nowhere else in `lib/reply`.
 *
 * @module lib/reply/gateway/openrouter
 */

import { withMargin } from '../context/tokens';
import {
  type ChatMessage,
  type ContentPart,
  type FetchLike,
  type GatewayConfig,
  type GatewayErrorCode,
  type ModelCallResult,
  type ModelPort,
  type ModelRequest,
  type ModelTarget,
  type ResponseMode,
} from './types';
import { extractUsage } from './usage';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
/** One attempt of the primary model (decision D23). */
export const ANSWER_TIMEOUT_MS = 25_000;
/** One attempt of the fallback model (decision D23). */
export const FALLBACK_TIMEOUT_MS = 20_000;
/** One retry. */
export const GATEWAY_RETRIES = 1;
/** The largest response read, in characters: a reply is a few thousand tokens, the rest is metadata. */
export const GATEWAY_MAX_RESPONSE_CHARS = 1_048_576;
/** The most temperature the API takes. */
const MAX_TEMPERATURE = 2;
const MAX_TIMEOUT_MS = 600_000;

export const API_KEY_ENV = 'OPENROUTER_API_KEY';
/** The name the intake path used before the gateway existed (decision D5: kept as an alias). */
export const API_KEY_ALIAS_ENV = 'INTAKE_UNDERSTAND_API_KEY';
export const BASE_URL_ENV = 'OPENROUTER_BASE_URL';
export const BASE_URL_ALIAS_ENV = 'INTAKE_UNDERSTAND_BASE_URL';

type Env = Readonly<Record<string, string | undefined>>;

const nonEmpty = (value: string | undefined): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/**
 * The connection from an env object (the caller passes `process.env`; this file reads none): the
 * key from `OPENROUTER_API_KEY`, else its alias `INTAKE_UNDERSTAND_API_KEY`, and an optional base
 * URL from `OPENROUTER_BASE_URL`, else `INTAKE_UNDERSTAND_BASE_URL`. Null when there is no key.
 */
export function gatewayConfigFromEnv(env: Env): GatewayConfig | null {
  const apiKey = nonEmpty(env[API_KEY_ENV]) ?? nonEmpty(env[API_KEY_ALIAS_ENV]);
  if (apiKey === undefined) return null;
  const baseUrl =
    nonEmpty(env[BASE_URL_ENV]) ?? nonEmpty(env[BASE_URL_ALIAS_ENV]);
  return {
    apiKey,
    ...(baseUrl !== undefined ? { baseUrl: baseUrl.trim() } : {}),
  };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The `chat/completions` endpoint under a base URL, or null when this adapter will not call it. */
export function completionsEndpoint(base: string): URL | null {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '') return null;
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
  ) {
    return null;
  }
  url.hash = '';
  url.search = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
  return url;
}

// ---------------------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------------------

const SCHEMA_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const IMAGE_DATA_URL =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function imageUrlAllowed(url: string): boolean {
  if (IMAGE_DATA_URL.test(url)) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

/** Why a request cannot be sent, as a code; null when it can. Nothing is sent for a request that fails. */
export function requestProblem(
  target: ModelTarget,
  request: ModelRequest
): 'REQUEST_INVALID' | 'VISION_UNSUPPORTED' | 'CONTEXT_TOO_LARGE' | null {
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    return 'REQUEST_INVALID';
  }
  let images = false;
  for (const entry of request.messages) {
    const message: unknown = entry;
    if (
      !isRecord(message) ||
      !['system', 'user', 'assistant'].includes(message['role'] as string)
    ) {
      return 'REQUEST_INVALID';
    }
    const content: unknown = message['content'];
    if (typeof content === 'string') {
      if (content === '') return 'REQUEST_INVALID';
      continue;
    }
    if (!Array.isArray(content) || content.length === 0)
      return 'REQUEST_INVALID';
    for (const part of content as unknown[]) {
      if (!isRecord(part)) return 'REQUEST_INVALID';
      if (part['type'] === 'text') {
        if (typeof part['text'] !== 'string' || part['text'] === '') {
          return 'REQUEST_INVALID';
        }
      } else if (part['type'] === 'image') {
        if (typeof part['url'] !== 'string' || !imageUrlAllowed(part['url'])) {
          return 'REQUEST_INVALID';
        }
        images = true;
      } else {
        return 'REQUEST_INVALID';
      }
    }
  }
  if (
    !Number.isInteger(request.max_output_tokens) ||
    request.max_output_tokens < 1 ||
    request.max_output_tokens > target.max_output_tokens
  ) {
    return 'REQUEST_INVALID';
  }
  if (
    typeof request.temperature !== 'number' ||
    !Number.isFinite(request.temperature) ||
    request.temperature < 0 ||
    request.temperature > MAX_TEMPERATURE
  ) {
    return 'REQUEST_INVALID';
  }
  if (
    request.timeout_ms !== undefined &&
    (!Number.isInteger(request.timeout_ms) ||
      request.timeout_ms < 1 ||
      request.timeout_ms > MAX_TIMEOUT_MS)
  ) {
    return 'REQUEST_INVALID';
  }
  const response: unknown = request.response;
  if (!isRecord(response)) return 'REQUEST_INVALID';
  if (response['kind'] === 'JSON_SCHEMA') {
    if (
      typeof response['name'] !== 'string' ||
      !SCHEMA_NAME.test(response['name']) ||
      !isRecord(response['schema'])
    ) {
      return 'REQUEST_INVALID';
    }
  } else if (
    response['kind'] !== 'TEXT' &&
    response['kind'] !== 'JSON_OBJECT'
  ) {
    return 'REQUEST_INVALID';
  }
  if (images && !target.vision) return 'VISION_UNSUPPORTED';
  const estimate = request.estimated_prompt_tokens;
  if (estimate !== undefined) {
    if (!Number.isInteger(estimate) || estimate < 0) return 'REQUEST_INVALID';
    if (withMargin(estimate, target.calibration) > target.context_budget) {
      return 'CONTEXT_TOO_LARGE';
    }
  }
  return null;
}

/** What `response_format` the model gets: the schema where it enforces one, else a JSON object. */
export function responseModeFor(
  target: ModelTarget,
  request: ModelRequest
): ResponseMode {
  if (request.response.kind === 'TEXT') return 'TEXT';
  if (request.response.kind === 'JSON_OBJECT') return 'JSON_OBJECT';
  return target.json_schema ? 'JSON_SCHEMA' : 'JSON_OBJECT';
}

function wirePart(part: ContentPart, explicitCaching: boolean): unknown {
  if (part.type === 'image') {
    return { type: 'image_url', image_url: { url: part.url } };
  }
  return {
    type: 'text',
    text: part.text,
    ...(explicitCaching && part.cacheable === true
      ? { cache_control: { type: 'ephemeral' } }
      : {}),
  };
}

/**
 * The messages as the API takes them. A message that is all text with no cache breakpoint to mark
 * is ONE string (its parts joined with nothing between them, the way `promptText` of part 2 reads a
 * prompt, and the form every provider takes); a message with an image, or with a breakpoint, is
 * typed parts.
 */
export function wireMessages(
  messages: readonly ChatMessage[],
  target: Pick<ModelTarget, 'prompt_caching'>
): unknown[] {
  const explicitCaching = target.prompt_caching === 'EXPLICIT';
  return messages.map((message) => {
    const content = message.content;
    if (typeof content === 'string') {
      return { role: message.role, content };
    }
    const plain = content.every(
      (part) =>
        part.type === 'text' && !(explicitCaching && part.cacheable === true)
    );
    if (plain) {
      return {
        role: message.role,
        content: content
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join(''),
      };
    }
    return {
      role: message.role,
      content: content.map((part) => wirePart(part, explicitCaching)),
    };
  });
}

/** The JSON body of one request. Pure, so a test can read exactly what would be sent. */
export function buildRequestBody(
  target: ModelTarget,
  request: ModelRequest
): Record<string, unknown> {
  const mode = responseModeFor(target, request);
  const provider: Record<string, unknown> = { data_collection: 'deny' };
  if (target.provider_only !== null)
    provider['only'] = [...target.provider_only];
  if (mode === 'JSON_SCHEMA') provider['require_parameters'] = true;

  const body: Record<string, unknown> = {
    model: target.slug,
    messages: wireMessages(request.messages, target),
    temperature: request.temperature,
    max_tokens: request.max_output_tokens,
  };
  if (mode === 'JSON_OBJECT') {
    body['response_format'] = { type: 'json_object' };
  } else if (
    mode === 'JSON_SCHEMA' &&
    request.response.kind === 'JSON_SCHEMA'
  ) {
    body['response_format'] = {
      type: 'json_schema',
      json_schema: {
        name: request.response.name,
        strict: true,
        schema: request.response.schema,
      },
    };
  }
  body['provider'] = provider;
  body['usage'] = { include: true };
  return body;
}

// ---------------------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------------------

export interface CallOptions {
  /** the platform's `fetch`; a test passes its own */
  fetchImpl?: FetchLike;
  /** milliseconds on any steady clock, for the latency; a test passes its own */
  now?: () => number;
  /** retries after the first attempt (default 1; a negative number is none) */
  retries?: number;
  /**
   * whether a TIMEOUT is retried (default true for `callOpenRouter`, false for a model port: see
   * the module comment). It never changes the retry of a 429, a 5xx or a network error.
   */
  retryOnTimeout?: boolean;
  /** the largest response read, in characters */
  maxResponseChars?: number;
}

type Attempt =
  | {
      kind: 'answer';
      text: string;
      body: Record<string, unknown>;
      finish: string | null;
    }
  | { kind: 'failure'; code: GatewayErrorCode; retry: boolean };

const retryable = (status: number): boolean => status === 429 || status >= 500;

const isAbort = (error: unknown): boolean =>
  isRecord(error) && error['name'] === 'AbortError';

/** A short word taken from a response: plain characters only, else null. */
function plain(value: unknown, pattern: RegExp): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,128}$/;
const HOST_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()/-]{0,63}$/;
const GENERATION_ID = /^[A-Za-z0-9._-]{1,128}$/;
const FINISH_REASON = /^[a-z_]{1,32}$/;

function readAttempt(
  raw: string,
  apiKey: string,
  maxResponseChars: number
): Attempt {
  if (raw.length > maxResponseChars) {
    return { kind: 'failure', code: 'RESPONSE_TOO_LARGE', retry: false };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  if (!isRecord(body)) {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  // an error carried in a 200: only its number is read, never its text
  if (body['error'] !== undefined && body['error'] !== null) {
    const status = isRecord(body['error']) ? body['error']['code'] : undefined;
    if (
      typeof status === 'number' &&
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
    ) {
      return {
        kind: 'failure',
        code: `HTTP_${status}`,
        retry: retryable(status),
      };
    }
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  const choices = body['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first['message'])) {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  const content = first['message']['content'];
  if (typeof content !== 'string' || content === '') {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  // a response that carries the key is not used or shown
  const surfaced = [
    content,
    body['model'],
    body['provider'],
    body['id'],
    first['finish_reason'],
  ];
  if (
    surfaced.some(
      (value) => typeof value === 'string' && value.includes(apiKey)
    )
  ) {
    return { kind: 'failure', code: 'BAD_RESPONSE', retry: false };
  }
  return {
    kind: 'answer',
    text: content,
    body,
    finish: plain(first['finish_reason'], FINISH_REASON),
  };
}

async function attemptOnce(
  endpoint: URL,
  config: GatewayConfig,
  payload: string,
  request: ModelRequest,
  timeoutMs: number,
  maxResponseChars: number,
  fetchImpl: FetchLike
): Promise<Attempt> {
  const controller = new AbortController();
  const caller = request.signal;
  const onCallerAbort = (): void => controller.abort();
  caller?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: payload,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      return {
        kind: 'failure',
        code: `HTTP_${response.status}`,
        retry: retryable(response.status),
      };
    }
    return readAttempt(await response.text(), config.apiKey, maxResponseChars);
  } catch (error) {
    if (caller?.aborted === true) {
      return { kind: 'failure', code: 'ABORTED', retry: false };
    }
    return {
      kind: 'failure',
      code: isAbort(error) ? 'TIMEOUT' : 'UNREACHABLE',
      retry: true,
    };
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * One model call: the request checked, sent, retried once where a retry could help, and read. It
 * never throws for a failed call; it returns the failure with its code. `config` null means not
 * configured: nothing is sent.
 */
export async function callOpenRouter(
  config: GatewayConfig | null,
  target: ModelTarget,
  request: ModelRequest,
  options: CallOptions = {}
): Promise<ModelCallResult> {
  const now = options.now ?? (() => Date.now());
  const started = now();
  const fail = (code: GatewayErrorCode, attempts: number): ModelCallResult => ({
    ok: false,
    code,
    model: target.slug,
    latency_ms: Math.max(0, Math.round(now() - started)),
    attempts,
  });

  // no configuration, or a key that is not text: nothing to send (an empty key would be a `Bearer ` header)
  if (
    config === null ||
    typeof config.apiKey !== 'string' ||
    config.apiKey.trim() === ''
  ) {
    return fail('NOT_CONFIGURED', 0);
  }
  const endpoint = completionsEndpoint(
    config.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL
  );
  if (endpoint === null) return fail('URL_REFUSED', 0);
  const problem = requestProblem(target, request);
  if (problem !== null) return fail(problem, 0);
  // a function, not a constant: the signal can fire between two attempts
  const aborted = (): boolean => request.signal?.aborted === true;
  if (aborted()) return fail('ABORTED', 0);

  const fetchImpl = options.fetchImpl ?? (fetch as FetchLike);
  const payload = JSON.stringify(buildRequestBody(target, request));
  const timeoutMs = request.timeout_ms ?? ANSWER_TIMEOUT_MS;
  const maxChars = options.maxResponseChars ?? GATEWAY_MAX_RESPONSE_CHARS;
  const retries = options.retries ?? GATEWAY_RETRIES;
  const retryOnTimeout = options.retryOnTimeout ?? true;

  let attempts = 1;
  let outcome = await attemptOnce(
    endpoint,
    config,
    payload,
    request,
    timeoutMs,
    maxChars,
    fetchImpl
  );
  while (
    outcome.kind === 'failure' &&
    outcome.retry &&
    (retryOnTimeout || outcome.code !== 'TIMEOUT') &&
    attempts - 1 < retries
  ) {
    if (aborted()) return fail('ABORTED', attempts);
    attempts += 1;
    outcome = await attemptOnce(
      endpoint,
      config,
      payload,
      request,
      timeoutMs,
      maxChars,
      fetchImpl
    );
  }
  if (outcome.kind === 'failure') return fail(outcome.code, attempts);

  const body = outcome.body;
  return {
    ok: true,
    text: outcome.text,
    model: target.slug,
    served_model: plain(body['model'], MODEL_NAME),
    host: plain(body['provider'], HOST_NAME),
    generation_id: plain(body['id'], GENERATION_ID),
    response_mode: responseModeFor(target, request),
    finish_reason: outcome.finish,
    usage: extractUsage(body, target),
    latency_ms: Math.max(0, Math.round(now() - started)),
    attempts,
  };
}

/**
 * One model as a port. `defaultTimeoutMs` is the wait for an attempt when a request names none. A
 * port does not retry a timeout (decision D23 as amended: the next model is asked instead), unless
 * its options say `retryOnTimeout: true`.
 */
export function createOpenRouterModelPort(
  config: GatewayConfig | null,
  target: ModelTarget,
  options: CallOptions & { defaultTimeoutMs?: number } = {}
): ModelPort {
  const { defaultTimeoutMs, ...rest } = options;
  const call: CallOptions = {
    ...rest,
    retryOnTimeout: rest.retryOnTimeout ?? false,
  };
  return {
    target,
    complete: (request) =>
      callOpenRouter(
        config,
        target,
        {
          ...request,
          timeout_ms:
            request.timeout_ms ?? defaultTimeoutMs ?? ANSWER_TIMEOUT_MS,
        },
        call
      ),
  };
}
