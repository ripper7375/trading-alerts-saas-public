/**
 * The Understand adapter on the gateway core (build step 7 part 3; ADR-098 D4, ADR-039, ADR-077;
 * decision D5; plan part 3 item 7).
 *
 * Step 6 built the Understand call (architecture 4.2 step 2) as its own `fetch` adapter and said
 * step 7's gateway would replace it. This is the replacement: the SAME call, through the one place
 * that holds the key. What ADR-098 D4 fixed stays fixed: a JSON object at temperature 0, at most
 * 700 tokens, a second for one attempt, one retry (for a network error, a timeout, a 429 or a
 * 5xx), a reply of at most 64 KiB, `provider.data_collection: "deny"`, the trader's question only
 * in the user message. The model is NAMED BY THE ENVIRONMENT (`INTAKE_UNDERSTAND_MODEL`), not here,
 * so this file holds no model id that could go stale; if it is in the registry its dated price and
 * provider allow-list are used, otherwise it is called bare.
 *
 * What is new is the BOOKKEEPING. The Understand call is a real, paid call made before the prompt
 * exists (plan finding S7-F6), and the quota ledger settles it with the rest of the request. The
 * `UnderstandPort` contract returns only the model's text, so the usage of every attempt-set goes
 * to an optional `onCall` hook (a success or a failure, with its usage and its latency), and the
 * orchestrator (part 7) collects it. Nothing in it carries the trader's words.
 *
 * It REJECTS with a `GatewayError` whose `code` is the failure (`TIMEOUT`, `HTTP_503`, ...). The
 * intake path's own `UnderstandModelError` wraps it in `lib/intake/text/understand-model.ts`, which
 * keeps its old public surface; `runUnderstand` keeps only the code (to the trace), as before.
 *
 * @module lib/reply/gateway/understand-adapter
 */

import type { AiModel } from '@/config/ai-models';

import type { UnderstandPort, UnderstandRequest } from '../contracts/intake';
import { DEFAULT_CALIBRATION } from '../context/tokens';

import {
  DEFAULT_OPENROUTER_BASE_URL,
  callOpenRouter,
  gatewayConfigFromEnv,
  type CallOptions,
} from './openrouter';
import { findModel } from './registry';
import {
  GatewayError,
  type FetchLike,
  type GatewayConfig,
  type GatewayErrorCode,
  type ModelCallResult,
  type ModelTarget,
} from './types';

// What the intake path's wrapper (`lib/intake/text/understand-model.ts`) needs, from this one module.
export { completionsEndpoint } from './openrouter';
export { GatewayError };
export type { FetchLike, GatewayErrorCode };

export const DEFAULT_UNDERSTAND_BASE_URL = DEFAULT_OPENROUTER_BASE_URL;
/** The budget of one attempt (decision D4: a one-second budget). */
export const UNDERSTAND_TIMEOUT_MS = 1_000;
/** One retry. */
export const UNDERSTAND_RETRIES = 1;
/** The answer is a small JSON object: the English text is at most 1,000 characters. */
export const UNDERSTAND_MAX_TOKENS = 700;
/** The largest reply read. */
export const UNDERSTAND_MAX_RESPONSE_CHARS = 65_536;
/**
 * The prompt is the fixed system text and a question of at most 1,000 characters, far inside any
 * window; this call never states an estimate, so the figure is only the target's required field.
 */
const UNDERSTAND_CONTEXT_BUDGET = 30_000;

export interface UnderstandGatewayConfig {
  apiKey: string;
  /** the model id the gateway knows, named by the environment */
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

export const UNDERSTAND_MODEL_ENV = 'INTAKE_UNDERSTAND_MODEL';

/**
 * The configuration from an env object, or null when the key or the model is missing or empty.
 * The key is `OPENROUTER_API_KEY` or its alias `INTAKE_UNDERSTAND_API_KEY` (decision D5), the model
 * `INTAKE_UNDERSTAND_MODEL`, the optional base URL `OPENROUTER_BASE_URL` or `INTAKE_UNDERSTAND_BASE_URL`.
 */
export function understandConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>
): UnderstandGatewayConfig | null {
  const gateway = gatewayConfigFromEnv(env);
  const model = env[UNDERSTAND_MODEL_ENV];
  if (gateway === null || typeof model !== 'string' || model.trim() === '') {
    return null;
  }
  return { ...gateway, model: model.trim() };
}

/** What the orchestrator collects for the ledger: the whole call, with its usage, never the words. */
export type UnderstandCallRecord = ModelCallResult;

export interface UnderstandHooks {
  /**
   * Called once per `understand` call, after the last attempt, for a success and for a failure.
   * It must not throw: it is the ledger's bookkeeping, and a throw here fails the call loudly
   * rather than leaving a paid call uncounted.
   */
  onCall?: (record: UnderstandCallRecord) => void;
  now?: () => number;
}

/** The model the environment names, as the adapter sees it: the registry row if there is one. */
export function understandTarget(
  model: string,
  registry?: readonly AiModel[]
): ModelTarget {
  const row = findModel(model, registry);
  return {
    slug: model,
    vision: false,
    context_budget: UNDERSTAND_CONTEXT_BUDGET,
    json_schema: false,
    prompt_caching: 'NONE',
    provider_only: row?.provider_only ?? null,
    price_in: row?.price_in ?? null,
    price_out: row?.price_out ?? null,
    calibration: row?.calibration ?? DEFAULT_CALIBRATION,
    max_output_tokens: UNDERSTAND_MAX_TOKENS,
  };
}

/**
 * The port. `config` null means "not configured": every call rejects with `NOT_CONFIGURED` and
 * nothing is sent. `fetchImpl` is the platform's `fetch`; a test passes its own.
 */
export function createGatewayUnderstandPort(
  config: UnderstandGatewayConfig | null,
  fetchImpl?: FetchLike,
  hooks: UnderstandHooks = {}
): UnderstandPort {
  const gateway: GatewayConfig | null =
    config === null
      ? null
      : {
          apiKey: config.apiKey,
          ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
        };
  const target = config === null ? null : understandTarget(config.model);
  const options: CallOptions = {
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
    ...(hooks.now !== undefined ? { now: hooks.now } : {}),
    retries: config?.retries ?? UNDERSTAND_RETRIES,
    maxResponseChars: UNDERSTAND_MAX_RESPONSE_CHARS,
  };
  return {
    async understand(request: UnderstandRequest): Promise<unknown> {
      if (config === null || target === null) {
        throw new GatewayError('NOT_CONFIGURED');
      }
      const result = await callOpenRouter(
        gateway,
        target,
        {
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          temperature: 0,
          max_output_tokens: UNDERSTAND_MAX_TOKENS,
          response: { kind: 'JSON_OBJECT' },
          timeout_ms: config.timeoutMs ?? UNDERSTAND_TIMEOUT_MS,
        },
        options
      );
      hooks.onCall?.(result);
      if (result.ok) return result.text;
      throw new GatewayError(result.code);
    },
  };
}
