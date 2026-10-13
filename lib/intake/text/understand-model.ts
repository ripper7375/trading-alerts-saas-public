/**
 * The real adapter behind the Understand port (architecture 4.2 step 2, ADR-039, ADR-077; plan
 * part 5, decision D4 option (A), finding F14).
 *
 * `runUnderstand` (part 2) makes the one model call through `UnderstandPort`; this file is the
 * thin, isolated adapter that answers it with a real model, and it is the ONLY place in the
 * intake path that knows a provider, a key or a URL. Step 7's model gateway replaces it.
 *
 *  - The provider is OpenRouter, the gateway the architecture keeps (5.10), through its
 *    OpenAI-compatible `chat/completions` endpoint. There is no SDK: one `fetch`, so no new
 *    dependency. The model is one of the 1.0x models of 5.6 and is NAMED BY THE ENVIRONMENT, not
 *    here (`INTAKE_UNDERSTAND_MODEL`): this file holds no model id that could go stale.
 *  - The request asks for a JSON object at temperature 0 and a small `max_tokens`, and asks the
 *    provider not to keep or train on the prompt (`provider.data_collection: "deny"`, ADR-077).
 *    The trader's question is ONLY in the user message, as a JSON string field; the system
 *    message is the fixed prompt.
 *  - A time budget of one second per attempt and ONE retry (decision D4), for a network error, a
 *    timeout, a 429 or a 5xx. A 4xx, an answer that is not a completion, or a refused request is
 *    not retried: the same request would fail the same way.
 *  - It returns the model's text as it came. It checks nothing: `runUnderstand` holds the answer
 *    to `understand-result/1`, and ANY failure there or here is the same refusal to the trader
 *    (`UNDERSTANDING_FAILED`, nothing else runs, no units charged). When the call fails the port
 *    REJECTS with an `UnderstandModelError` whose `code` goes to the trace.
 *
 * The key is read from the environment by the caller and appears only in the `Authorization`
 * header: in no message, no code and no log line. The URL must be https, or http on this machine.
 * The request is not redirected.
 *
 * The request and the response follow the OpenAI-compatible format that OpenRouter documents.
 * They are held to by the unit tests with a fake `fetch`; the adapter has NOT been called
 * against a real endpoint (that needs a key and is the first recorded run of part 9).
 *
 * Imported BY PATH, never through the `lib/intake` barrel: it calls the network and uses a timer.
 *
 * @module lib/intake/text/understand-model
 */

import type { UnderstandPort, UnderstandRequest } from './understand';

export const DEFAULT_UNDERSTAND_BASE_URL = 'https://openrouter.ai/api/v1';
/** The budget of one attempt (decision D4: a one-second budget). */
export const UNDERSTAND_TIMEOUT_MS = 1_000;
/** One retry. */
export const UNDERSTAND_RETRIES = 1;
/** The answer is a small JSON object: the English text is at most 1,000 characters. */
export const UNDERSTAND_MAX_TOKENS = 700;
/** The largest reply read. */
export const UNDERSTAND_MAX_RESPONSE_CHARS = 65_536;

export type UnderstandModelErrorCode =
  | 'NOT_CONFIGURED'
  | 'URL_REFUSED'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'BAD_RESPONSE'
  | 'RESPONSE_TOO_LARGE'
  | `HTTP_${number}`;

/** A failed call. `code` is for the trace; the message never holds the key or the question. */
export class UnderstandModelError extends Error {
  constructor(readonly code: UnderstandModelErrorCode) {
    super(`the Understand call failed: ${code}`);
    this.name = 'UnderstandModelError';
  }
}

export interface UnderstandModelConfig {
  apiKey: string;
  /** the model id the gateway knows, named by the environment */
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

/** The configuration from the environment, or null when the key or the model is missing or empty. */
export function understandConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>
): UnderstandModelConfig | null {
  const apiKey = env['INTAKE_UNDERSTAND_API_KEY'];
  const model = env['INTAKE_UNDERSTAND_MODEL'];
  if (
    typeof apiKey !== 'string' ||
    apiKey === '' ||
    typeof model !== 'string' ||
    model.trim() === ''
  ) {
    return null;
  }
  const baseUrl = env['INTAKE_UNDERSTAND_BASE_URL'];
  return {
    apiKey,
    model: model.trim(),
    ...(typeof baseUrl === 'string' && baseUrl.trim() !== ''
      ? { baseUrl: baseUrl.trim() }
      : {}),
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

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name: unknown }).name === 'AbortError';

/** One attempt: the model's text, or an error that says whether trying again could help. */
async function attempt(
  endpoint: URL,
  config: UnderstandModelConfig,
  request: UnderstandRequest,
  fetchImpl: FetchLike
): Promise<{ text: string } | { error: UnderstandModelError; retry: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? UNDERSTAND_TIMEOUT_MS
  );
  try {
    const response = await fetchImpl(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        temperature: 0,
        max_tokens: UNDERSTAND_MAX_TOKENS,
        response_format: { type: 'json_object' },
        provider: { data_collection: 'deny' },
      }),
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      return {
        error: new UnderstandModelError(`HTTP_${response.status}`),
        retry: response.status === 429 || response.status >= 500,
      };
    }
    const raw = await response.text();
    if (raw.length > UNDERSTAND_MAX_RESPONSE_CHARS) {
      return {
        error: new UnderstandModelError('RESPONSE_TOO_LARGE'),
        retry: false,
      };
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return { error: new UnderstandModelError('BAD_RESPONSE'), retry: false };
    }
    const content = contentOf(body);
    if (content === undefined) {
      return { error: new UnderstandModelError('BAD_RESPONSE'), retry: false };
    }
    return { text: content };
  } catch (error) {
    return {
      error: new UnderstandModelError(
        isAbort(error) ? 'TIMEOUT' : 'UNREACHABLE'
      ),
      retry: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** `choices[0].message.content` of a completion, when it is text. */
function contentOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first: unknown = choices[0];
  if (typeof first !== 'object' || first === null) return undefined;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content !== '' ? content : undefined;
}

/**
 * The port. `config` null means "not configured": every call rejects with `NOT_CONFIGURED` and
 * nothing is sent. `fetchImpl` is the platform's `fetch`; a test passes its own.
 */
export function createModelUnderstandPort(
  config: UnderstandModelConfig | null,
  fetchImpl: FetchLike = fetch as FetchLike
): UnderstandPort {
  const endpoint =
    config === null
      ? null
      : completionsEndpoint(config.baseUrl ?? DEFAULT_UNDERSTAND_BASE_URL);
  return {
    async understand(request: UnderstandRequest): Promise<unknown> {
      if (config === null) throw new UnderstandModelError('NOT_CONFIGURED');
      if (endpoint === null) throw new UnderstandModelError('URL_REFUSED');
      // one attempt always, then up to `retries` more while a retry could help (a negative count is none)
      let outcome = await attempt(endpoint, config, request, fetchImpl);
      for (
        let tries = 0;
        !('text' in outcome) &&
        outcome.retry &&
        tries < (config.retries ?? UNDERSTAND_RETRIES);
        tries += 1
      ) {
        outcome = await attempt(endpoint, config, request, fetchImpl);
      }
      if ('text' in outcome) return outcome.text;
      throw outcome.error;
    },
  };
}
