/**
 * The adapter behind the Understand port (architecture 4.2 step 2, ADR-039, ADR-077, ADR-098 D4;
 * built in step 6 part 5, moved onto the model gateway in step 7 part 3).
 *
 * `runUnderstand` (step 6 part 2) makes the one model call through `UnderstandPort`; this file is
 * what answers it with a real model, and it is now a THIN WRAPPER: the request, the key, the
 * timeout, the retry and the reading of the answer are the gateway's
 * (`lib/reply/gateway/understand-adapter.ts` on `openrouter.ts`), the one place that holds the key
 * and calls a model. What is kept here is the intake path's own surface, unchanged for its
 * callers: the names `createModelUnderstandPort`, `understandConfigFromEnv`,
 * `UnderstandModelError` and the five constants, and the contract that a failed call REJECTS with
 * an `UnderstandModelError` whose `code` goes to the trace (and nothing else: no message of the
 * provider, no key, no question).
 *
 *  - The model is NAMED BY THE ENVIRONMENT (`INTAKE_UNDERSTAND_MODEL`), not here: this file holds
 *    no model id that could go stale. The key is `OPENROUTER_API_KEY`, or its older name
 *    `INTAKE_UNDERSTAND_API_KEY` (step 7 plan decision D5: one key for the whole gateway).
 *  - The call is a JSON object at temperature 0, at most 700 tokens, a second for one attempt and
 *    ONE retry, with `provider.data_collection: "deny"`; the trader's question is only in the user
 *    message. These are held in the gateway adapter and by its tests.
 *  - Any failure here is the same refusal to the trader (`UNDERSTANDING_FAILED`, nothing else
 *    runs, no units charged); `runUnderstand` holds the answer to `understand-result/1`.
 *
 * Imported BY PATH, never through the `lib/intake` barrel: it reaches the network through the
 * gateway. This file itself uses no network and no timer, and it imports exactly one outside
 * module, the gateway's Understand adapter (`lib/reply/gateway/understand-adapter`), which is why
 * `lib/reply` lists this file among its importers.
 *
 * @module lib/intake/text/understand-model
 */

import {
  DEFAULT_UNDERSTAND_BASE_URL,
  GatewayError,
  UNDERSTAND_MAX_RESPONSE_CHARS,
  UNDERSTAND_MAX_TOKENS,
  UNDERSTAND_RETRIES,
  UNDERSTAND_TIMEOUT_MS,
  completionsEndpoint,
  createGatewayUnderstandPort,
  understandConfigFromEnv,
  type FetchLike,
  type GatewayErrorCode,
  type UnderstandGatewayConfig,
} from '@/lib/reply/gateway/understand-adapter';

import type { UnderstandPort, UnderstandRequest } from './understand';

export {
  DEFAULT_UNDERSTAND_BASE_URL,
  UNDERSTAND_MAX_RESPONSE_CHARS,
  UNDERSTAND_MAX_TOKENS,
  UNDERSTAND_RETRIES,
  UNDERSTAND_TIMEOUT_MS,
  completionsEndpoint,
  understandConfigFromEnv,
};

/** The code of a failed call: a word of the gateway's list, or `HTTP_<status>`. */
export type UnderstandModelErrorCode = GatewayErrorCode;

/** A failed call. `code` is for the trace; the message never holds the key or the question. */
export class UnderstandModelError extends Error {
  constructor(readonly code: UnderstandModelErrorCode) {
    super(`the Understand call failed: ${code}`);
    this.name = 'UnderstandModelError';
  }
}

export type UnderstandModelConfig = UnderstandGatewayConfig;

/**
 * The port. `config` null means "not configured": every call rejects with `NOT_CONFIGURED` and
 * nothing is sent. `fetchImpl` is the platform's `fetch` unless a test passes its own.
 */
export function createModelUnderstandPort(
  config: UnderstandModelConfig | null,
  fetchImpl?: FetchLike
): UnderstandPort {
  const inner = createGatewayUnderstandPort(config, fetchImpl);
  return {
    async understand(request: UnderstandRequest): Promise<unknown> {
      try {
        return await inner.understand(request);
      } catch (error) {
        if (error instanceof GatewayError) {
          throw new UnderstandModelError(error.code);
        }
        throw error;
      }
    },
  };
}
