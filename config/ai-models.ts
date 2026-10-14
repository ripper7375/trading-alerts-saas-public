/**
 * The launch registry of AI models (build step 7 part 3; architecture 5.10, ADR-055, ADR-077).
 *
 * DATA AND TYPES ONLY. The checker is `lib/reply/gateway/registry.ts`, which runs it when it is
 * loaded and refuses to start on a damaged table, and `__tests__/lib/reply/gateway/registry.test.ts`,
 * which runs it on this file in CI. Nothing here reads the environment, the network or the clock,
 * so the picker (part 8) can import it from a client component.
 *
 * EVERY ROW IS A CANDIDATE, AND EVERY ROW IS UNVERIFIED (decision D1, plan finding S7-F2). The
 * names are the six models of file D, and the Gemini 3.6 Flash placeholder in the picker. This file
 * was written without a key and without a call, so what it knows is NOT what OpenRouter serves:
 *
 *  - `slug` is the `vendor/model` pattern OpenRouter uses, guessed from the display name. Step S1
 *    of the runbook (`node scripts/reply/gateway-smoke.js --list-models`) prints the live slug,
 *    price, context and features next to these, and a row that does not match is corrected by a
 *    person.
 *  - A row with `verified_at: null` carries placeholders on the SAFE side, and the validator holds
 *    it to that: no JSON-schema mode, no caching, no vision, no price, no language, no evaluation
 *    run, and a context window and an output limit no larger than the floor below. Safe means the
 *    prompt always fits, the reply is always checked by our validator, and no chart is sent to a
 *    model that may not be able to read one.
 *  - `price_in` and `price_out` (USD per million tokens, so also micro-dollars per token) stay
 *    `null` until a person writes them WITH the date they were read (`priced_at`). The validator
 *    refuses a price without its date and a date without its price. With no price the gateway
 *    still takes the cost the provider reports; it just cannot estimate one when none is reported.
 *  - `launch_role` names the launch pair (ADR-055: one default, one fallback of another vendor,
 *    both `passed`). Nobody is named yet: the pair is named after S1 and the recorded evaluation
 *    of part 10, by editing these two fields and `status` in two rows.
 *
 * A model is `passed` only with an evaluation run (`eval_run`: its id and date) that part 10's
 * gate (`__tests__/lib/reply/eval-gate.test.ts`, not built yet) holds to the current fingerprint.
 * Only passed models reach the picker and the fallback.
 *
 * @module config/ai-models
 */

export const AI_MODEL_STATUSES = ['candidate', 'passed', 'retired'] as const;
export type AiModelStatus = (typeof AI_MODEL_STATUSES)[number];

/**
 * How a model's provider caches a prompt prefix (architecture 5.4, ADR-049). NONE: not at all.
 * AUTO: by itself, from the prefix, with no marker. EXPLICIT: only after a `cache_control`
 * breakpoint (Anthropic Claude and the like); GPT-5.6's own explicit mode is not this one.
 */
export const PROMPT_CACHING_MODES = ['NONE', 'AUTO', 'EXPLICIT'] as const;
export type PromptCachingMode = (typeof PROMPT_CACHING_MODES)[number];

/** What a model may be named for: the Understand call of the intake path, or the answer. */
export const MODEL_ROLES = ['understand', 'answer'] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export const MODEL_TIERS = ['FREE', 'PRO'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const LAUNCH_ROLES = ['default', 'fallback'] as const;
export type LaunchRole = (typeof LAUNCH_ROLES)[number];

/**
 * What one model's tokenizer is assumed to do. The same shape as `TokenCalibration` of
 * `lib/reply/context/tokens.ts` (a test holds the two equal); it is written out here so that this
 * file imports nothing.
 */
export interface AiModelCalibration {
  digitsPerToken: number;
  lettersPerToken: number;
  cjkCharsPerToken: number;
  otherCharsPerToken: number;
  /** basis points: 1000 is 10% */
  marginBp: number;
}

export interface AiModelEvalRun {
  /** the id of the recorded run (its fingerprint) */
  id: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface AiModel {
  /** the id OpenRouter knows, `vendor/model` (the vendor is the "provider" of ADR-055) */
  slug: string;
  /** the name the picker shows */
  name: string;
  /** file D's multiplier: DISPLAY ONLY, units follow actual cost (ADR-050) */
  multiplier: number;
  /** can read an image (the chart) */
  vision: boolean;
  /** the model's context window, in the model's own tokens */
  context_tokens: number;
  /** the most prompt the model is given, in its own tokens: what is left of the window after the answer */
  context_budget: number;
  /** the most the model is asked to write, in its own tokens */
  max_output_tokens: number;
  /** the provider enforces `response_format: json_schema`: otherwise `json_object` and our validator */
  json_schema: boolean;
  prompt_caching: PromptCachingMode;
  /** the locales (of the 19) a recorded run showed this model good in; empty until one exists */
  languages_ok: readonly string[];
  /** measured units per message (S3); null until measured */
  units_per_msg: number | null;
  eval_run: AiModelEvalRun | null;
  status: AiModelStatus;
  /** USD per million input tokens, or null when unverified */
  price_in: number | null;
  /** USD per million output tokens, or null when unverified */
  price_out: number | null;
  /** YYYY-MM-DD the two prices were read; null exactly when they are null */
  priced_at: string | null;
  calibration: AiModelCalibration;
  roles: readonly ModelRole[];
  /**
   * An allow-list of OpenRouter provider slugs (`provider.only`, as OpenRouter writes them, for
   * example `google-vertex`), or null for any provider that does not keep or train on prompts
   * (`data_collection: "deny"` is sent on every call whatever this says).
   */
  provider_only: readonly string[] | null;
  tier_access: readonly ModelTier[];
  /** the launch pair (ADR-055); both named or neither */
  launch_role: LaunchRole | null;
  /** YYYY-MM-DD the slug, features, context and providers were checked against the live list (S1); null until then */
  verified_at: string | null;
}

/** The context window and the output limit an unverified row may claim: a floor, not a fact. */
export const UNVERIFIED_CONTEXT_TOKENS = 32_768;
export const UNVERIFIED_MAX_OUTPUT_TOKENS = 2_048;

/** The o200k-like starting calibration of `lib/reply/context/tokens.ts`; S3 replaces it per model. */
const STARTING_CALIBRATION: AiModelCalibration = {
  digitsPerToken: 3,
  lettersPerToken: 4,
  cjkCharsPerToken: 1,
  otherCharsPerToken: 2,
  marginBp: 1000,
};

/** The placeholders of a row nobody has checked yet. */
const UNVERIFIED = {
  vision: false,
  context_tokens: UNVERIFIED_CONTEXT_TOKENS,
  context_budget: UNVERIFIED_CONTEXT_TOKENS - UNVERIFIED_MAX_OUTPUT_TOKENS,
  max_output_tokens: UNVERIFIED_MAX_OUTPUT_TOKENS,
  json_schema: false,
  prompt_caching: 'NONE',
  languages_ok: [],
  units_per_msg: null,
  eval_run: null,
  status: 'candidate',
  price_in: null,
  price_out: null,
  priced_at: null,
  calibration: STARTING_CALIBRATION,
  provider_only: null,
  launch_role: null,
  verified_at: null,
} as const satisfies Partial<AiModel>;

export const AI_MODELS: readonly AiModel[] = [
  {
    ...UNVERIFIED,
    slug: 'google/gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    multiplier: 1.0,
    roles: ['understand', 'answer'],
    tier_access: ['FREE', 'PRO'],
  },
  {
    ...UNVERIFIED,
    slug: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    multiplier: 1.0,
    roles: ['understand', 'answer'],
    tier_access: ['PRO'],
  },
  {
    ...UNVERIFIED,
    slug: 'z-ai/glm-5.2',
    name: 'GLM-5.2',
    multiplier: 2.5,
    roles: ['answer'],
    tier_access: ['PRO'],
  },
  {
    ...UNVERIFIED,
    slug: 'moonshotai/kimi-k3',
    name: 'Kimi K3',
    multiplier: 3.0,
    roles: ['answer'],
    tier_access: ['PRO'],
  },
  {
    ...UNVERIFIED,
    slug: 'openai/gpt-5.6-terra',
    name: 'GPT 5.6 Terra',
    multiplier: 8.0,
    roles: ['answer'],
    tier_access: ['PRO'],
  },
  {
    ...UNVERIFIED,
    slug: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    multiplier: 10.0,
    roles: ['answer'],
    tier_access: ['PRO'],
  },
];
