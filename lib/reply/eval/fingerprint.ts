/**
 * The fingerprint of an evaluation run (build step 7 part 10; architecture 5.10: "run on every
 * model or prompt change"; plan part 10 item 3).
 *
 * A recorded run is evidence about ONE configuration: this model, served by this provider, asked
 * with this prompt, checked by these wording lists, fitted to these caps, over this scenario set.
 * Change any of the six and the run no longer describes what would be deployed, so the gate
 * (`suite.ts`) refuses a model whose run carries another fingerprint.
 *
 *   model slug and provider   what answered
 *   prompt version and hash   the static rules and the wording guide the model is given
 *   wording lists hash        the 17 phrase files, the categories and their version
 *   caps hash                 the token caps of the context (architecture 5.4)
 *   scenario set hash         the scenarios as written and the worlds they run on
 *
 * The hashes are SHA-256 of canonical JSON (sorted keys, no whitespace), so they do not change
 * with the line endings of a checkout. Pure: the hashing is the Web Crypto of the intake path.
 *
 * @module lib/reply/eval/fingerprint
 */

import { CONTEXT_CAPS } from '../context/caps';
import {
  PROMPTS_VERSION,
  SYSTEM_RULES_TEXT,
  WORDING_GUIDE_TEXT,
} from '../context/static-text';
import {
  WORDING_VERSION,
  SHIPPED_WORDING_FILES,
} from '../checks/wording-lists';
import { canonicalJson, sha256Hex } from '../contracts/intake';

/** What the fingerprint is made of. */
export interface FingerprintParts {
  model_slug: string;
  /** who served the model: the host the gateway reported, or `fixture` for the fixture model */
  provider: string;
  prompt_version: string;
  prompt_sha256: string;
  wording_version: string;
  wording_sha256: string;
  caps_sha256: string;
  scenario_set_sha256: string;
}

export interface Fingerprint extends FingerprintParts {
  /** SHA-256 over the eight parts above */
  sha256: string;
}

/** The parts that do not name a model: what the code and the data are right now. */
export type CurrentParts = Omit<FingerprintParts, 'model_slug' | 'provider'>;

const PART_KEYS: readonly (keyof FingerprintParts)[] = [
  'model_slug',
  'provider',
  'prompt_version',
  'prompt_sha256',
  'wording_version',
  'wording_sha256',
  'caps_sha256',
  'scenario_set_sha256',
];

const HASH = /^[0-9a-f]{64}$/;

export async function promptSha256(): Promise<string> {
  return sha256Hex(
    canonicalJson({
      version: PROMPTS_VERSION,
      rules: SYSTEM_RULES_TEXT,
      guide: WORDING_GUIDE_TEXT,
    })
  );
}

export async function wordingSha256(): Promise<string> {
  return sha256Hex(
    canonicalJson({ version: WORDING_VERSION, files: SHIPPED_WORDING_FILES })
  );
}

export async function capsSha256(): Promise<string> {
  return sha256Hex(canonicalJson(CONTEXT_CAPS));
}

/** What the code and the data are right now, given the hash of the scenario set. */
export async function currentParts(
  scenarioSetSha256: string
): Promise<CurrentParts> {
  return {
    prompt_version: PROMPTS_VERSION,
    prompt_sha256: await promptSha256(),
    wording_version: WORDING_VERSION,
    wording_sha256: await wordingSha256(),
    caps_sha256: await capsSha256(),
    scenario_set_sha256: scenarioSetSha256,
  };
}

/** The fingerprint of eight parts. */
export async function fingerprintOf(
  parts: FingerprintParts
): Promise<Fingerprint> {
  const ordered = {} as Record<string, string>;
  for (const key of PART_KEYS) ordered[key] = parts[key];
  return { ...parts, sha256: await sha256Hex(canonicalJson(ordered)) };
}

/** The fingerprint a model would have now: its name, its host and the current parts. */
export async function currentFingerprint(
  model: { slug: string; provider: string },
  current: CurrentParts
): Promise<Fingerprint> {
  return fingerprintOf({
    model_slug: model.slug,
    provider: model.provider,
    ...current,
  });
}

/** Is this value a fingerprint whose hash agrees with its parts? Problems in words; empty when it does. */
export async function fingerprintProblems(value: unknown): Promise<string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['the fingerprint is not an object'];
  }
  const record = value as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of [...PART_KEYS, 'sha256']) {
    if (typeof record[key] !== 'string' || record[key] === '') {
      problems.push(`fingerprint.${key} is missing`);
    }
  }
  for (const key of Object.keys(record)) {
    if (key !== 'sha256' && !(PART_KEYS as readonly string[]).includes(key)) {
      problems.push(`fingerprint.${key} is not a part`);
    }
  }
  for (const key of [
    'prompt_sha256',
    'wording_sha256',
    'caps_sha256',
    'scenario_set_sha256',
    'sha256',
  ]) {
    if (typeof record[key] === 'string' && !HASH.test(record[key] as string)) {
      problems.push(`fingerprint.${key} is not a SHA-256`);
    }
  }
  if (problems.length > 0) return problems;
  const made = await fingerprintOf(record as unknown as FingerprintParts);
  return made.sha256 === record['sha256']
    ? []
    : ['fingerprint.sha256 does not match its parts'];
}

const PART_WORDS: Readonly<Record<keyof FingerprintParts, string>> = {
  model_slug: 'the model is another',
  provider: 'the provider is another',
  prompt_version: 'the prompt version changed',
  prompt_sha256: 'the prompt text changed',
  wording_version: 'the wording version changed',
  wording_sha256: 'the wording lists changed',
  caps_sha256: 'the context caps changed',
  scenario_set_sha256: 'the scenarios or the worlds they run on changed',
};

/** What is different between a recorded fingerprint and the current one, in words. */
export function fingerprintDifferences(
  recorded: FingerprintParts,
  current: FingerprintParts
): string[] {
  return PART_KEYS.filter((key) => recorded[key] !== current[key]).map(
    (key) => PART_WORDS[key]
  );
}
