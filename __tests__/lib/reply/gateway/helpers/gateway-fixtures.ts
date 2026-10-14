/**
 * Helpers of the gateway tests (build step 7 part 3): a fake `fetch` that records what it was
 * sent, completion bodies, a valid registry row and a valid request.
 */

import type { AiModel } from '@/config/ai-models';
import { DEFAULT_CALIBRATION } from '@/lib/reply/context/tokens';
import type { ModelRequest, ModelTarget } from '@/lib/reply/gateway/types';

/** The key every test uses. It has the shape of a real one so that a leak is easy to see. */
export const KEY = 'sk-or-v1-3f9a1c2b7d8e4a60-gateway-test-key';

export type Handler = (
  input: string,
  init: RequestInit
) => Promise<Response> | Response;

export interface RecordedCall {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  /** the JSON body, parsed */
  body: Record<string, any>;
}

export function fetchFake(handler: Handler) {
  const calls: RecordedCall[] = [];
  return {
    calls,
    fetch: async (url: string, init: RequestInit) => {
      calls.push({
        url,
        init,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: JSON.parse(String(init.body)),
      });
      return handler(url, init);
    },
  };
}

export interface CompletionOptions {
  usage?: Record<string, unknown> | null;
  model?: string;
  provider?: string;
  id?: string;
  finish_reason?: string;
  extra?: Record<string, unknown>;
}

/** A 200 completion in the OpenAI-compatible shape OpenRouter documents. */
export function completion(
  content: unknown,
  options: CompletionOptions = {}
): Response {
  const body: Record<string, unknown> = {
    id: options.id ?? 'gen-1700000000-abcdef',
    model: options.model ?? 'vendor-a/model-one',
    provider: options.provider ?? 'Test Host',
    choices: [
      {
        index: 0,
        finish_reason: options.finish_reason ?? 'stop',
        message: { role: 'assistant', content },
      },
    ],
    ...(options.usage === null
      ? {}
      : {
          usage: options.usage ?? {
            prompt_tokens: 18_000,
            completion_tokens: 900,
            total_tokens: 18_900,
            prompt_tokens_details: { cached_tokens: 16_000 },
            cost: 0.00765,
          },
        }),
    ...(options.extra ?? {}),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A model that can see, enforces a schema and caches by itself, at a dated price. */
export const TARGET: ModelTarget = {
  slug: 'vendor-a/model-one',
  vision: true,
  context_budget: 120_000,
  max_output_tokens: 4_096,
  json_schema: true,
  prompt_caching: 'AUTO',
  provider_only: null,
  price_in: 0.3,
  price_out: 2.5,
  calibration: DEFAULT_CALIBRATION,
};

export const target = (overrides: Partial<ModelTarget> = {}): ModelTarget => ({
  ...TARGET,
  ...overrides,
});

export const SCHEMA = {
  type: 'object',
  properties: { headline: { type: 'string' } },
  required: ['headline'],
  additionalProperties: false,
};

export const request = (
  overrides: Partial<ModelRequest> = {}
): ModelRequest => ({
  messages: [
    { role: 'system', content: 'You write short, checked market notes.' },
    {
      role: 'user',
      content: 'DATA AS OF 18 SEP 20:55 UTC\nWhat does the board say?',
    },
  ],
  max_output_tokens: 1_500,
  temperature: 0.2,
  response: { kind: 'JSON_SCHEMA', name: 'report1', schema: SCHEMA },
  ...overrides,
});

/** A valid, fully checked registry row: passed, dated price, a run, no launch role. */
export const registryRow = (overrides: Partial<AiModel> = {}): AiModel => ({
  slug: 'vendor-a/model-one',
  name: 'Model One',
  multiplier: 1,
  vision: true,
  context_tokens: 128_000,
  context_budget: 120_000,
  max_output_tokens: 4_096,
  json_schema: true,
  prompt_caching: 'AUTO',
  languages_ok: ['en-US', 'de'],
  units_per_msg: 18_000,
  eval_run: { id: 'run-0001', date: '2026-10-20' },
  status: 'passed',
  price_in: 0.3,
  price_out: 2.5,
  priced_at: '2026-10-14',
  calibration: { ...DEFAULT_CALIBRATION },
  roles: ['understand', 'answer'],
  provider_only: null,
  tier_access: ['FREE', 'PRO'],
  launch_role: null,
  verified_at: '2026-10-14',
  ...overrides,
});
