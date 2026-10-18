/**
 * The checker and the readers of the launch registry (build step 7 part 3; architecture 5.10,
 * ADR-055, ADR-077; decisions D1 and D5).
 *
 * `config/ai-models.ts` is the table; this file is what makes it safe to use. `validateRegistry`
 * is run on the table WHEN THIS MODULE IS LOADED (a damaged table stops the route that imports it,
 * it is never half used) and again by the registry's test on every CI run. It returns the problems
 * as a list of plain sentences, like `validateCalibration`.
 *
 * What it refuses, by name (the tests damage each one):
 *  - a row with a key it does not know, a value outside its list (an unknown status, role, tier,
 *    caching mode or launch role) or a bad type;
 *  - a slug that is not `vendor/model`, two rows with one slug, and a `:free` variant (those are
 *    served by hosts that keep prompts, ADR-077);
 *  - a price without the date it was read, a date without a price, one price without the other,
 *    more than six decimals, or an impossible calendar date;
 *  - a window and a budget that do not fit (`context_budget + max_output_tokens` above the
 *    context), a language that is not one of the 19, a duplicate;
 *  - a `passed` model without an evaluation run, a verification date or a dated price pair;
 *  - an UNVERIFIED row (`verified_at: null`) that claims anything: it must be a `candidate`, with no
 *    JSON-schema mode, no caching, no vision, no price, no language, no run and no launch role, and
 *    a window and an output limit within the floor;
 *  - a launch pair that is two defaults, two fallbacks, one without the other, a model that is not
 *    `passed` or has no `answer` role, or two models of ONE vendor (ADR-055: the fallback comes
 *    from another provider).
 *
 * The kill switch (`REPLY_DISABLED_MODELS`, a comma-separated list of slugs) removes a model from
 * the picker and from the launch pair without a deploy. It is read from an env object the caller
 * passes in: this file reads no environment. A name that is not in the registry is ignored, so a
 * typo during an incident cannot make the switch throw.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/gateway/registry
 */

import 'server-only';

import {
  AI_MODELS,
  AI_MODEL_STATUSES,
  LAUNCH_ROLES,
  MODEL_ROLES,
  MODEL_TIERS,
  PROMPT_CACHING_MODES,
  UNVERIFIED_CONTEXT_TOKENS,
  UNVERIFIED_MAX_OUTPUT_TOKENS,
  type AiModel,
  type ModelRole,
  type ModelTier,
} from '@/config/ai-models';

import { validateCalibration } from '../context/tokens';
import { isLocale } from '../contracts/intake';

const MODEL_KEYS: readonly (keyof AiModel)[] = [
  'slug',
  'name',
  'multiplier',
  'vision',
  'context_tokens',
  'context_budget',
  'max_output_tokens',
  'json_schema',
  'prompt_caching',
  'languages_ok',
  'units_per_msg',
  'eval_run',
  'status',
  'price_in',
  'price_out',
  'priced_at',
  'calibration',
  'roles',
  'provider_only',
  'tier_access',
  'launch_role',
  'verified_at',
];

/** `vendor/model`, with an optional `:variant`. Lower case, as OpenRouter writes them. */
const SLUG = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?::[a-z0-9._-]+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_CONTEXT_TOKENS = 10_000_000;
/** A typo guard on a price per million tokens, not a limit of any model. */
export const MAX_PRICE_PER_MILLION = 1_000;
const MAX_NAME_LENGTH = 60;
const MAX_RUN_ID_LENGTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // `Date.UTC` reads the years 0 to 99 as 1900 to 1999; `setUTCFullYear` does not
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** The vendor of a slug: what stands before the slash. */
export function vendorOf(slug: string): string {
  const slash = slug.indexOf('/');
  return slash < 0 ? slug : slug.slice(0, slash);
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

function isPrice(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_PRICE_PER_MILLION &&
    Math.round(value * 1e6) / 1e6 === value
  );
}

function listOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  problems: string[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${label} must be a non-empty list`);
    return;
  }
  const seen = new Set<unknown>();
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      !(allowed as readonly string[]).includes(item)
    ) {
      problems.push(
        `${label} holds ${JSON.stringify(item)}, which is not one of ${allowed.join(', ')}`
      );
    } else if (seen.has(item)) {
      problems.push(`${label} lists ${item} twice`);
    }
    seen.add(item);
  }
}

function validateModel(
  model: unknown,
  label: string,
  problems: string[]
): void {
  if (!isRecord(model)) {
    problems.push(`${label} must be an object`);
    return;
  }
  const add = (message: string): void => {
    problems.push(`${label}: ${message}`);
  };
  const known = new Set<string>(MODEL_KEYS);
  for (const key of Object.keys(model)) {
    if (!known.has(key)) add(`${key} is not a field of the registry`);
  }
  for (const key of MODEL_KEYS) {
    if (!(key in model)) add(`${key} is missing`);
  }

  const slug = model['slug'];
  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    add('slug must be vendor/model in lower case');
  } else if (slug.endsWith(':free')) {
    add('a :free variant is refused: those hosts may keep prompts (ADR-077)');
  }
  const name = model['name'];
  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    name.length > MAX_NAME_LENGTH
  ) {
    add(`name must be text of 1 to ${MAX_NAME_LENGTH} characters`);
  }
  const multiplier = model['multiplier'];
  if (
    typeof multiplier !== 'number' ||
    !Number.isFinite(multiplier) ||
    multiplier <= 0
  ) {
    add('multiplier must be a number above zero');
  }
  if (typeof model['vision'] !== 'boolean') add('vision must be true or false');
  if (typeof model['json_schema'] !== 'boolean')
    add('json_schema must be true or false');
  if (
    typeof model['prompt_caching'] !== 'string' ||
    !(PROMPT_CACHING_MODES as readonly string[]).includes(
      model['prompt_caching']
    )
  ) {
    add(`prompt_caching must be one of ${PROMPT_CACHING_MODES.join(', ')}`);
  }

  const contextTokens = model['context_tokens'];
  const contextBudget = model['context_budget'];
  const maxOutput = model['max_output_tokens'];
  if (!isPositiveInt(contextTokens) || contextTokens > MAX_CONTEXT_TOKENS) {
    add(
      `context_tokens must be a whole number from 1 to ${MAX_CONTEXT_TOKENS}`
    );
  }
  if (!isPositiveInt(contextBudget))
    add('context_budget must be a whole number above zero');
  if (!isPositiveInt(maxOutput))
    add('max_output_tokens must be a whole number above zero');
  if (
    isPositiveInt(contextTokens) &&
    isPositiveInt(contextBudget) &&
    isPositiveInt(maxOutput) &&
    contextBudget + maxOutput > contextTokens
  ) {
    add('context_budget plus max_output_tokens is more than context_tokens');
  }

  const languages = model['languages_ok'];
  if (!Array.isArray(languages)) {
    add('languages_ok must be a list');
  } else {
    const seen = new Set<unknown>();
    for (const language of languages) {
      if (!isLocale(language))
        add(
          `languages_ok holds ${JSON.stringify(language)}, which is not one of the 19 locales`
        );
      else if (seen.has(language)) add(`languages_ok lists ${language} twice`);
      seen.add(language);
    }
  }
  const units = model['units_per_msg'];
  if (units !== null && !isPositiveInt(units)) {
    add('units_per_msg must be null or a whole number above zero');
  }

  const run = model['eval_run'];
  if (run !== null) {
    if (!isRecord(run)) {
      add('eval_run must be null or { id, date }');
    } else {
      const keys = Object.keys(run).sort().join(',');
      if (keys !== 'date,id') add('eval_run must hold exactly id and date');
      if (
        typeof run['id'] !== 'string' ||
        run['id'] === '' ||
        run['id'].length > MAX_RUN_ID_LENGTH
      ) {
        add(`eval_run.id must be text of 1 to ${MAX_RUN_ID_LENGTH} characters`);
      }
      if (!isIsoDate(run['date']))
        add('eval_run.date must be a real date, YYYY-MM-DD');
    }
  }

  const status = model['status'];
  if (
    typeof status !== 'string' ||
    !(AI_MODEL_STATUSES as readonly string[]).includes(status)
  ) {
    add(`status must be one of ${AI_MODEL_STATUSES.join(', ')}`);
  }

  const priceIn = model['price_in'];
  const priceOut = model['price_out'];
  const pricedAt = model['priced_at'];
  if (priceIn !== null && !isPrice(priceIn)) {
    add(
      `price_in must be null or a number from 0 to ${MAX_PRICE_PER_MILLION} with at most six decimals`
    );
  }
  if (priceOut !== null && !isPrice(priceOut)) {
    add(
      `price_out must be null or a number from 0 to ${MAX_PRICE_PER_MILLION} with at most six decimals`
    );
  }
  if ((priceIn === null) !== (priceOut === null)) {
    add('price_in and price_out must both be set or both be null');
  }
  if (pricedAt !== null && !isIsoDate(pricedAt)) {
    add('priced_at must be null or a real date, YYYY-MM-DD');
  }
  if ((priceIn !== null || priceOut !== null) && pricedAt === null) {
    add('a price without the date it was read (priced_at) is refused');
  }
  if (pricedAt !== null && priceIn === null && priceOut === null) {
    add('priced_at is set but there is no price');
  }

  for (const problem of validateCalibration(model['calibration'])) {
    add(`calibration: ${problem}`);
  }
  listOf(model['roles'], MODEL_ROLES, `${label}: roles`, problems);
  const only = model['provider_only'];
  if (only !== null) {
    if (!Array.isArray(only) || only.length === 0) {
      add('provider_only must be null or a non-empty list');
    } else if (
      only.some((item) => typeof item !== 'string' || item.trim() === '') ||
      new Set(only).size !== only.length
    ) {
      add('provider_only must hold distinct, non-empty provider names');
    }
  }
  listOf(model['tier_access'], MODEL_TIERS, `${label}: tier_access`, problems);

  const launch = model['launch_role'];
  if (
    launch !== null &&
    !(LAUNCH_ROLES as readonly (string | null)[]).includes(launch as string)
  ) {
    add(`launch_role must be null or one of ${LAUNCH_ROLES.join(', ')}`);
  }
  const verifiedAt = model['verified_at'];
  if (verifiedAt !== null && !isIsoDate(verifiedAt)) {
    add('verified_at must be null or a real date, YYYY-MM-DD');
  }

  // a model that has passed is a model somebody checked, priced and ran
  if (status === 'passed') {
    if (run === null) add('a passed model needs an evaluation run (eval_run)');
    if (verifiedAt === null)
      add('a passed model needs a verification date (verified_at)');
    if (priceIn === null || priceOut === null || pricedAt === null) {
      add(
        'a passed model needs a dated price pair (price_in, price_out, priced_at)'
      );
    }
  }
  if (status === 'retired' && launch !== null)
    add('a retired model cannot hold a launch role');

  // a row nobody has checked claims nothing
  if (verifiedAt === null) {
    if (status !== 'candidate')
      add('an unverified row (verified_at null) must be a candidate');
    if (model['vision'] !== false)
      add('an unverified row must not claim vision');
    if (model['json_schema'] !== false)
      add('an unverified row must not claim json_schema');
    if (model['prompt_caching'] !== 'NONE')
      add('an unverified row must not claim prompt caching');
    if (priceIn !== null || priceOut !== null || pricedAt !== null) {
      add('an unverified row must not carry a price');
    }
    if (Array.isArray(languages) && languages.length > 0)
      add('an unverified row must not claim a language');
    if (units !== null) add('an unverified row must not carry units_per_msg');
    if (run !== null) add('an unverified row must not carry an evaluation run');
    if (launch !== null) add('an unverified row must not hold a launch role');
    if (
      isPositiveInt(contextTokens) &&
      contextTokens > UNVERIFIED_CONTEXT_TOKENS
    ) {
      add(
        `an unverified row may claim at most ${UNVERIFIED_CONTEXT_TOKENS} tokens of context`
      );
    }
    if (isPositiveInt(maxOutput) && maxOutput > UNVERIFIED_MAX_OUTPUT_TOKENS) {
      add(
        `an unverified row may claim at most ${UNVERIFIED_MAX_OUTPUT_TOKENS} tokens of output`
      );
    }
  }
}

/** The problems of a registry table, as sentences; an empty list means it can be used. */
export function validateRegistry(models: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(models) || models.length === 0) {
    return ['the registry must be a non-empty list of models'];
  }
  const slugs = new Map<string, number>();
  models.forEach((model, index) => {
    const slug =
      isRecord(model) && typeof model['slug'] === 'string'
        ? model['slug']
        : null;
    validateModel(
      model,
      `models[${index}]${slug === null ? '' : ` (${slug})`}`,
      problems
    );
    if (slug !== null) slugs.set(slug, (slugs.get(slug) ?? 0) + 1);
  });
  for (const [slug, count] of slugs) {
    if (count > 1) problems.push(`the slug ${slug} appears ${count} times`);
  }

  // the launch pair (ADR-055)
  const rows = models.filter(isRecord);
  const defaults = rows.filter((model) => model['launch_role'] === 'default');
  const fallbacks = rows.filter((model) => model['launch_role'] === 'fallback');
  if (defaults.length > 1)
    problems.push(
      `the registry names ${defaults.length} default models: there is one`
    );
  if (fallbacks.length > 1)
    problems.push(
      `the registry names ${fallbacks.length} fallback models: there is one`
    );
  if ((defaults.length === 0) !== (fallbacks.length === 0)) {
    problems.push(
      'the launch pair is a default AND a fallback: one without the other is refused (ADR-055)'
    );
  }
  for (const model of [...defaults, ...fallbacks]) {
    const label = `the ${String(model['launch_role'])} model ${String(model['slug'])}`;
    if (model['status'] !== 'passed') problems.push(`${label} is not passed`);
    if (!Array.isArray(model['roles']) || !model['roles'].includes('answer')) {
      problems.push(`${label} has no answer role`);
    }
  }
  const first = defaults[0];
  const second = fallbacks[0];
  if (
    first !== undefined &&
    second !== undefined &&
    typeof first['slug'] === 'string' &&
    typeof second['slug'] === 'string' &&
    vendorOf(first['slug']) === vendorOf(second['slug'])
  ) {
    problems.push(
      `the default and the fallback are both ${vendorOf(first['slug'])} models: the fallback must come from another provider (ADR-055)`
    );
  }
  return problems;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** Check a table and freeze a copy, or throw with every problem named. */
export function loadRegistry(models: readonly AiModel[]): readonly AiModel[] {
  const problems = validateRegistry(models);
  if (problems.length > 0) {
    throw new Error(`config/ai-models.ts is not valid: ${problems.join('; ')}`);
  }
  return deepFreeze(JSON.parse(JSON.stringify(models)) as AiModel[]);
}

/** The registry as it stands: checked when this module is loaded. */
export const AI_MODEL_REGISTRY: readonly AiModel[] = loadRegistry(AI_MODELS);

export function findModel(
  slug: string,
  registry: readonly AiModel[] = AI_MODEL_REGISTRY
): AiModel | undefined {
  return registry.find((model) => model.slug === slug);
}

export function modelsForRole(
  role: ModelRole,
  registry: readonly AiModel[] = AI_MODEL_REGISTRY
): AiModel[] {
  return registry.filter((model) => model.roles.includes(role));
}

// ---------------------------------------------------------------------------------------
// The kill switch
// ---------------------------------------------------------------------------------------

export const DISABLED_MODELS_ENV = 'REPLY_DISABLED_MODELS';

/** The slugs a comma-separated value names, trimmed and lower-cased; blanks are dropped. */
export function parseDisabledModels(
  value: string | undefined
): ReadonlySet<string> {
  if (typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item !== '')
  );
}

export function disabledModelsFromEnv(
  env: Readonly<Record<string, string | undefined>>
): ReadonlySet<string> {
  return parseDisabledModels(env[DISABLED_MODELS_ENV]);
}

// ---------------------------------------------------------------------------------------
// The picker and the launch pair
// ---------------------------------------------------------------------------------------

/** What the picker lists for a tier: models that have passed, may answer, are open to the tier and are not switched off. */
export function pickerModels(
  tier: ModelTier,
  disabled: ReadonlySet<string> = new Set(),
  registry: readonly AiModel[] = AI_MODEL_REGISTRY
): AiModel[] {
  return registry.filter(
    (model) =>
      model.status === 'passed' &&
      model.roles.includes('answer') &&
      model.tier_access.includes(tier) &&
      !disabled.has(model.slug)
  );
}

export interface LaunchPlan {
  /** the model asked first; null when no launch pair is named or every model of it is switched off */
  primary: AiModel | null;
  /** the model asked when the primary fails, of another provider; null when there is none to ask */
  fallback: AiModel | null;
}

/**
 * The two models of a request. Both named and both on: the default asks first and the fallback is
 * behind it. One switched off: the other asks alone (a switched-off default promotes the fallback,
 * which then has no fallback of its own). Both off, or no pair named: nobody, and the caller sends
 * the board-only fixed answer.
 */
export function planLaunch(
  disabled: ReadonlySet<string> = new Set(),
  registry: readonly AiModel[] = AI_MODEL_REGISTRY
): LaunchPlan {
  const live = (role: 'default' | 'fallback'): AiModel | null => {
    const model = registry.find((row) => row.launch_role === role);
    if (
      model === undefined ||
      model.status !== 'passed' ||
      !model.roles.includes('answer') ||
      disabled.has(model.slug)
    ) {
      return null;
    }
    return model;
  };
  const primary = live('default');
  const fallback = live('fallback');
  if (primary !== null) return { primary, fallback };
  return { primary: fallback, fallback: null };
}
