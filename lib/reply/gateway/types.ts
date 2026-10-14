/**
 * The types of the model gateway (build step 7 part 3; architecture 5.10, 5.2, ADR-055, ADR-077).
 *
 * The gateway is the ONE place that holds the key and talks to a model provider. These are the
 * words it is spoken to in and answers in: a request in provider-neutral form, a result that is
 * either an answer with its usage or a failure with a code, the port a test replaces, and the
 * error the Understand port rejects with. Nothing here does anything.
 *
 * Every failure is a CODE from `GATEWAY_ERROR_CODES`, never a message taken from the provider or
 * from the exception behind it: a free-text message could carry the key, the trader's words or a
 * provider's stack, and a code cannot.
 *
 * @module lib/reply/gateway/types
 */

import type { AiModel } from '@/config/ai-models';

/** One chat message, after the chart has been fetched: text, and images by URL. */
export type ChatRole = 'system' | 'user' | 'assistant';

export type ContentPart =
  /**
   * `cacheable` says the text is the same for many requests (a prompt prefix): a model whose
   * `prompt_caching` is `EXPLICIT` gets a cache breakpoint after it, any other model gets none.
   */
  | { type: 'text'; text: string; cacheable?: boolean }
  /** an image the model can read: an https URL or a `data:` URL */
  | { type: 'image'; url: string };

export interface ChatMessage {
  role: ChatRole;
  content: string | readonly ContentPart[];
}

/**
 * What the reply must look like.
 *  - TEXT: free text.
 *  - JSON_OBJECT: any JSON object (the Understand call; our validator holds it to its schema).
 *  - JSON_SCHEMA: the caller's schema. Sent as `json_schema` when the model enforces it
 *    (`json_schema: true` in the registry), otherwise as `json_object`; the result says which
 *    (`response_mode`). Either way the reply is only text: the validator is the caller's.
 */
export type ResponseSpec =
  | { kind: 'TEXT' }
  | { kind: 'JSON_OBJECT' }
  | {
      kind: 'JSON_SCHEMA';
      name: string;
      schema: Readonly<Record<string, unknown>>;
    };

export type ResponseMode = 'TEXT' | 'JSON_OBJECT' | 'JSON_SCHEMA';

export interface ModelRequest {
  messages: readonly ChatMessage[];
  /** at most the model's `max_output_tokens` */
  max_output_tokens: number;
  temperature: number;
  response: ResponseSpec;
  /** the wait for ONE attempt; default by the caller (25 s for the primary, 20 s for the fallback) */
  timeout_ms?: number;
  /** the request's own deadline: an aborted signal ends the call at once and is never retried */
  signal?: AbortSignal;
  /**
   * The caller's estimate of the prompt, in estimator tokens BEFORE the safety margin
   * (`estimateRawTokens`). When it is given, each model applies its own margin and refuses a prompt
   * that is more than its `context_budget` (`CONTEXT_TOO_LARGE`, nothing sent): that is how a
   * fallback with a smaller window is skipped.
   */
  estimated_prompt_tokens?: number;
}

/**
 * The part of a registry row the adapter needs. An `AiModel` is one; so is the model the Understand
 * environment names, which may not be in the registry at all.
 */
export type ModelTarget = Pick<
  AiModel,
  | 'slug'
  | 'vision'
  | 'context_budget'
  | 'max_output_tokens'
  | 'json_schema'
  | 'prompt_caching'
  | 'provider_only'
  | 'price_in'
  | 'price_out'
  | 'calibration'
>;

export const GATEWAY_COST_FLAG = 'COST_ESTIMATED';
export type CostFlag = typeof GATEWAY_COST_FLAG;

/**
 * What the provider reported, in whole numbers. A count the provider did not give, or gave in a
 * form that cannot be right, is null, never a guess.
 */
export interface UsageCapture {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  /** tokens served from the provider's cache: 0 means "none", null means "not said" */
  cached_tokens: number | null;
  /**
   * The cost in integer micro-dollars: the provider's own figure when it reported one, otherwise
   * an estimate from the registry price (and then `cost_flag` is `COST_ESTIMATED`), otherwise null
   * (and `cost_flag` is `COST_ESTIMATED` too: the caller must price the call itself).
   */
  cost_micro_usd: number | null;
  cost_flag: CostFlag | null;
}

export interface ModelAnswer {
  ok: true;
  text: string;
  /** the slug asked for */
  model: string;
  /** the model the provider says answered, when it says so and it is a plain name */
  served_model: string | null;
  /** the host the provider says served it, when it says so and it is a plain name */
  host: string | null;
  /** the provider's id of this generation, when it is a plain id */
  generation_id: string | null;
  response_mode: ResponseMode;
  /** `stop`, `length` (the reply may be cut short), ...; null when absent or not a plain word */
  finish_reason: string | null;
  usage: UsageCapture;
  /** whole milliseconds from the first attempt to the end, by the injected clock */
  latency_ms: number;
  attempts: number;
}

export interface ModelFailure {
  ok: false;
  code: GatewayErrorCode;
  model: string;
  latency_ms: number;
  attempts: number;
}

export type ModelCallResult = ModelAnswer | ModelFailure;

/** One model, ready to be asked. A test replaces it; `createOpenRouterModelPort` makes the real one. */
export interface ModelPort {
  readonly target: ModelTarget;
  complete(request: ModelRequest): Promise<ModelCallResult>;
}

export const GATEWAY_ERROR_CODES = [
  'NOT_CONFIGURED',
  'URL_REFUSED',
  'REQUEST_INVALID',
  'VISION_UNSUPPORTED',
  'CONTEXT_TOO_LARGE',
  'ABORTED',
  'TIMEOUT',
  'UNREACHABLE',
  'BAD_RESPONSE',
  'RESPONSE_TOO_LARGE',
] as const;

/** A failure of the call: a word from the list, or `HTTP_<status>` of a refused request. */
export type GatewayErrorCode =
  | (typeof GATEWAY_ERROR_CODES)[number]
  | `HTTP_${number}`;

/** A failed call as an exception, for the ports whose contract is to reject (the Understand port). */
export class GatewayError extends Error {
  constructor(readonly code: GatewayErrorCode) {
    super(`the model gateway call failed: ${code}`);
    this.name = 'GatewayError';
  }
}

/** The platform's `fetch`, or a test's. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** The connection to the gateway: the key and, for a test or a proxy, another base URL. */
export interface GatewayConfig {
  apiKey: string;
  baseUrl?: string;
}
