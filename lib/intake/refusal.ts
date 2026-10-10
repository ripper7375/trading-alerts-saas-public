/**
 * `intake-refusal/1`: what comes back when a request does NOT become a packet
 * (architecture 4.2; plan section 3, "the packet and the refusal are separate
 * contracts").
 *
 * A packet is only ever built for a request that passed the gate, the door and
 * the scope check. Everything else is a refusal: a code, the stage that refused,
 * and a fixed reply written in the locale the trader reads. The reply text comes
 * from the registry of fixed texts (part 3); this file knows only its shape, so a
 * refusal can be built and checked before the words exist.
 *
 * HTTP statuses are NOT here: the route layer (part 5) maps a code to its status,
 * as `lib/engine4/server/errors.ts` does for Engine 4.
 *
 * @module lib/intake/refusal
 */

import { Issues, exactObject, oneOf, text, type Issue } from './check';
import { isLocale, type Locale } from './locales';
import { INTAKE_REFUSAL_SCHEMA } from './version';

/** Where in the request path (4.2) the refusal happened. */
export const REFUSAL_STAGES = ['GATE', 'DOOR', 'UNDERSTAND', 'SCOPE'] as const;
export type RefusalStage = (typeof REFUSAL_STAGES)[number];

export const REFUSAL_CODES = [
  /** the gate (4.2 step 1), in the order it decides: */
  'NOT_SIGNED_IN',
  'TIER_REQUIRED',
  'THREAD_INVALID',
  'PROFILE_NOT_SET',
  'QUOTA_INSUFFICIENT',
  /** a service this step cannot work without is not available */
  'FEATURE_UNAVAILABLE',
  /** the door: the typed question is empty, or longer than the limit (A5) */
  'QUESTION_EMPTY',
  'QUESTION_TOO_LONG',
  /** step 2: the one model call failed or returned something the schema refuses (decision D4) */
  'UNDERSTANDING_FAILED',
  /** step 3: another symbol or timeframe, or the model's own OUT_OF_SCOPE label (ADR-046) */
  'OUT_OF_SCOPE',
] as const;

export type RefusalCode = (typeof REFUSAL_CODES)[number];

export const REFUSAL_STAGE: Readonly<Record<RefusalCode, RefusalStage>> = {
  NOT_SIGNED_IN: 'GATE',
  TIER_REQUIRED: 'GATE',
  THREAD_INVALID: 'GATE',
  PROFILE_NOT_SET: 'GATE',
  QUOTA_INSUFFICIENT: 'GATE',
  FEATURE_UNAVAILABLE: 'GATE',
  QUESTION_EMPTY: 'DOOR',
  QUESTION_TOO_LONG: 'DOOR',
  UNDERSTANDING_FAILED: 'UNDERSTAND',
  OUT_OF_SCOPE: 'SCOPE',
};

/**
 * The checks of the gate in the order it makes them, cheapest first (plan part 5:
 * flag, session, tier, thread, profile, quota). The feature flag is not a refusal:
 * with it off both routes answer 404 to everybody.
 */
export const GATE_ORDER: readonly RefusalCode[] = [
  'NOT_SIGNED_IN',
  'TIER_REQUIRED',
  'THREAD_INVALID',
  'PROFILE_NOT_SET',
  'QUOTA_INSUFFICIENT',
];

/** A fixed reply is a sentence or two, never an essay. */
export const REFUSAL_REPLY_MAX_CHARS = 600;

export interface IntakeRefusal {
  schema: typeof INTAKE_REFUSAL_SCHEMA;
  code: RefusalCode;
  stage: RefusalStage;
  /** the locale `reply` is written in */
  reply_locale: Locale;
  /** the fixed reply, in `reply_locale` */
  reply: string;
}

export type RefusalValidation =
  | { ok: true; refusal: IntakeRefusal }
  | { ok: false; issues: Issue[] };

export function stageOfRefusal(code: RefusalCode): RefusalStage {
  return REFUSAL_STAGE[code];
}

/** The refusal for `code`: its stage is always the code's own. */
export function buildRefusal(
  code: RefusalCode,
  replyLocale: Locale,
  reply: string
): IntakeRefusal {
  return {
    schema: INTAKE_REFUSAL_SCHEMA,
    code,
    stage: REFUSAL_STAGE[code],
    reply_locale: replyLocale,
    reply,
  };
}

export function validateRefusal(value: unknown): RefusalValidation {
  const issues = new Issues();
  const record = exactObject(
    value,
    '',
    ['schema', 'code', 'stage', 'reply_locale', 'reply'],
    issues
  );
  if (record === undefined) return { ok: false, issues: issues.list };

  if (record['schema'] !== INTAKE_REFUSAL_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${INTAKE_REFUSAL_SCHEMA}`);
  }
  const code = oneOf(record['code'], 'code', REFUSAL_CODES, issues);
  const stage = oneOf(record['stage'], 'stage', REFUSAL_STAGES, issues);
  if (
    code !== undefined &&
    stage !== undefined &&
    REFUSAL_STAGE[code] !== stage
  ) {
    issues.add(
      'stage',
      'INCONSISTENT',
      `${code} is refused at the ${REFUSAL_STAGE[code]} stage`
    );
  }
  if (!isLocale(record['reply_locale'])) {
    issues.add('reply_locale', 'NOT_ONE_OF', 'must be one of the 19 locales');
  }
  text(record['reply'], 'reply', issues, {
    max: REFUSAL_REPLY_MAX_CHARS,
  });

  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, refusal: record as unknown as IntakeRefusal };
}
