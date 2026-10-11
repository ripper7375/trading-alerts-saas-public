/**
 * The fixed texts of the intake path, in English (architecture 4.2, 4.3 and 4.4, ADR-038,
 * plan part 3): the reply to every refusal, the two instant prompts of Panel C, and one
 * trader-facing sentence per status reason code a sensor can give.
 *
 * This file is the single source of the English. It is (1) the fallback `t(key, text)` gets,
 * (2) the content of the en-GB and en-US dictionaries, and (3) the list the 19 dictionaries
 * are held to, key by key (`__tests__/lib/intake/text.test.ts`): a key that is in a dictionary
 * and not here, or here and not in a dictionary, fails a test. It follows the pattern of
 * `REPORT2_TEXT` (`lib/engine4/templates/text.ts`), whose two small helpers are repeated below
 * because this folder imports only its own files.
 *
 * Numbers are never in the text: a `{name}` placeholder is filled by the caller (the door's
 * limit, a sensor's name, a state's name). No language model writes any of it. Placeholders are
 * `{name}` only, the same in every language.
 *
 * Every translation is a DRAFT until a native speaker has read it, and the replies to refusals
 * (`INTAKE_COUNSEL_KEYS`) also wait for counsel (plan decision D14): drafts ship in all 19
 * languages and the intake flag stays off.
 *
 * Reason codes are those of `railway-gateway/sensors/mcd_common/reason_codes.py` (standard
 * Appendix D): twelve fixed codes, three that carry the sensor they are inherited from
 * (`UPSTREAM_STALE:MCD1`), and the synthesis code that carries a state (`MODIFIER_CAUTION:<state>`).
 * The tests read that file, so a new code there fails here until its text is written.
 *
 * @module lib/intake/text
 */

import type { InstantIntent } from './intents';
import type { RefusalCode } from './refusal';

export const INTAKE_TEXT = {
  // -- the reply to a refusal (intake-refusal/1) ------------------------------
  'intake.refusal.not_signed_in': 'Please sign in to ask the AI analyst.',
  'intake.refusal.tier_required': 'The AI analyst is part of the Pro plan.',
  'intake.refusal.thread_invalid':
    'This conversation is not available. Start a new one about gold (XAUUSD).',
  'intake.refusal.profile_not_set': 'Confirm your trading profile first.',
  'intake.refusal.quota_insufficient':
    'Your AI analyst allowance is used up for now. Please try again later.',
  'intake.refusal.feature_unavailable': 'The AI analyst is not available yet.',
  'intake.refusal.question_empty': 'Type a question about gold (XAUUSD) first.',
  'intake.refusal.question_too_long':
    'Your question is too long. Please keep it to {limit} characters or fewer.',
  'intake.refusal.understanding_failed':
    'That question could not be read just now. Please try again.',
  'intake.refusal.out_of_scope':
    'This analyst covers gold (XAUUSD) on the M5 and M15 charts only. Ask about those.',

  // -- the two instant prompts of Panel C (4.2, 4.10) --------------------------
  'intake.instant.m5': 'Explain the current M5 chart',
  'intake.instant.m15': 'Explain the current M15 chart',

  // -- the reason a sensor reading is cautionary, out of date or unavailable ---
  'intake.reason.data_stale':
    'The market data is out of date, so this sensor has no usable reading.',
  'intake.reason.retuning':
    'The chart indicator is being re-tuned, so this reading is less reliable for now.',
  'intake.reason.no_setting':
    'No indicator setting is available for this timeframe, so this sensor cannot read it.',
  'intake.reason.detection_mismatch':
    'The indicator found in the data does not match its setting, so treat this reading with caution.',
  'intake.reason.no_stats_at_slot':
    'The statistics for this moment are not available yet, so this reading is out of date.',
  'intake.reason.containment_low':
    'The price is not staying inside the channel well enough for a reliable reading.',
  'intake.reason.insufficient_bars':
    'There are not enough closed bars yet for a reliable reading.',
  'intake.reason.discontinuity':
    'The bars have gaps or are out of order, so this reading cannot be trusted.',
  'intake.reason.sanity_failed':
    'The channel values are impossible, so this reading cannot be trusted.',
  'intake.reason.upstream_cautionary':
    '{sensor} is cautionary, so this reading is cautionary too.',
  'intake.reason.upstream_unavailable':
    '{sensor} has no valid reading, so this one is unavailable.',
  'intake.reason.upstream_stale':
    '{sensor} is out of date, so this one is too.',
  'intake.reason.mcd0_defect_m5':
    'The M5 channel does not fit the price well enough, so readings that use it are cautionary.',
  'intake.reason.mcd0_defect_m15':
    'The M15 channel does not fit the price well enough, so readings that use it are cautionary.',
  'intake.reason.evaluator_error':
    'This sensor hit an unexpected error and has no reading right now.',
  'intake.reason.modifier_caution':
    'Another sensor adds caution to this reading: {state}.',
} as const;

export type IntakeTextKey = keyof typeof INTAKE_TEXT;

/** Every key, in the order of the registry. */
export const INTAKE_KEYS = Object.keys(INTAKE_TEXT) as IntakeTextKey[];

/** The replies to refusals: safety-related wording, which also waits for counsel (decision D14). */
export const INTAKE_COUNSEL_KEYS: readonly IntakeTextKey[] = INTAKE_KEYS.filter(
  (key) => key.startsWith('intake.refusal.')
);

export type TextParams = Readonly<Record<string, string>>;

/** Fill `{name}` placeholders; one that has no value is left as it is, so a gap is visible. */
export function fillText(text: string, params?: TextParams): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? (params[name] as string)
      : whole
  );
}

/** The placeholders of a text, sorted, for the check that a translation keeps them. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
}

/** The English text of a key with its placeholders filled. */
export function intakeText(key: IntakeTextKey, params?: TextParams): string {
  return fillText(INTAKE_TEXT[key], params);
}

// ---------------------------------------------------------------------------
// Refusals and instant prompts
// ---------------------------------------------------------------------------

/** The key of the fixed reply to each refusal code (a missing code is a compile error). */
export const REFUSAL_TEXT_KEY: Readonly<Record<RefusalCode, IntakeTextKey>> = {
  NOT_SIGNED_IN: 'intake.refusal.not_signed_in',
  TIER_REQUIRED: 'intake.refusal.tier_required',
  THREAD_INVALID: 'intake.refusal.thread_invalid',
  PROFILE_NOT_SET: 'intake.refusal.profile_not_set',
  QUOTA_INSUFFICIENT: 'intake.refusal.quota_insufficient',
  FEATURE_UNAVAILABLE: 'intake.refusal.feature_unavailable',
  QUESTION_EMPTY: 'intake.refusal.question_empty',
  QUESTION_TOO_LONG: 'intake.refusal.question_too_long',
  UNDERSTANDING_FAILED: 'intake.refusal.understanding_failed',
  OUT_OF_SCOPE: 'intake.refusal.out_of_scope',
};

export function refusalTextKey(code: RefusalCode): IntakeTextKey {
  return REFUSAL_TEXT_KEY[code];
}

/** The key of the fixed question of each instant prompt. */
export const INSTANT_TEXT_KEY: Readonly<Record<InstantIntent, IntakeTextKey>> =
  {
    INSTANT_M5_INSPECT: 'intake.instant.m5',
    INSTANT_M15_INSPECT: 'intake.instant.m15',
  };

export function instantTextKey(intent: InstantIntent): IntakeTextKey {
  return INSTANT_TEXT_KEY[intent];
}

// ---------------------------------------------------------------------------
// Reason codes
// ---------------------------------------------------------------------------

/** The fixed codes of standard Appendix D, with the key of the sentence for each. */
export const FIXED_REASON_TEXT_KEY = {
  DATA_STALE: 'intake.reason.data_stale',
  RETUNING: 'intake.reason.retuning',
  NO_SETTING: 'intake.reason.no_setting',
  DETECTION_MISMATCH: 'intake.reason.detection_mismatch',
  NO_STATS_AT_SLOT: 'intake.reason.no_stats_at_slot',
  CONTAINMENT_LOW: 'intake.reason.containment_low',
  INSUFFICIENT_BARS: 'intake.reason.insufficient_bars',
  DISCONTINUITY: 'intake.reason.discontinuity',
  SANITY_FAILED: 'intake.reason.sanity_failed',
  MCD0_DEFECT_M5: 'intake.reason.mcd0_defect_m5',
  MCD0_DEFECT_M15: 'intake.reason.mcd0_defect_m15',
  EVALUATOR_ERROR: 'intake.reason.evaluator_error',
} as const satisfies Record<string, IntakeTextKey>;

export type FixedReasonCode = keyof typeof FIXED_REASON_TEXT_KEY;

/** The codes that carry the sensor they are inherited from: `UPSTREAM_STALE:MCD1`. */
export const UPSTREAM_REASON_TEXT_KEY = {
  UPSTREAM_CAUTIONARY: 'intake.reason.upstream_cautionary',
  UPSTREAM_UNAVAILABLE: 'intake.reason.upstream_unavailable',
  UPSTREAM_STALE: 'intake.reason.upstream_stale',
} as const satisfies Record<string, IntakeTextKey>;

export type UpstreamReasonCode = keyof typeof UPSTREAM_REASON_TEXT_KEY;

/** The synthesis code that carries the state of the sensor that modifies a reading. */
export const MODIFIER_REASON_CODE = 'MODIFIER_CAUTION';
const MODIFIER_REASON_TEXT_KEY: IntakeTextKey =
  'intake.reason.modifier_caution';

const MCD_ID = /^MCD([0-9]|1[0-5])$/;
const STATE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface ReasonText {
  key: IntakeTextKey;
  /** the value of the `{sensor}` or `{state}` placeholder the code carries; empty for a fixed code */
  params: TextParams;
}

/**
 * The text behind a reason code, or `undefined` for a code that is not in Appendix D (a
 * caller shows nothing for it rather than guessing). `UPSTREAM_STALE:MCD1` gives the sentence
 * with `{sensor}` set to `MCD1`; the caller may swap in the sensor's name.
 */
export function reasonTextOf(code: string): ReasonText | undefined {
  if (Object.prototype.hasOwnProperty.call(FIXED_REASON_TEXT_KEY, code)) {
    return { key: FIXED_REASON_TEXT_KEY[code as FixedReasonCode], params: {} };
  }
  const colon = code.indexOf(':');
  if (colon === -1) return undefined;
  const prefix = code.slice(0, colon);
  const argument = code.slice(colon + 1);
  if (
    Object.prototype.hasOwnProperty.call(UPSTREAM_REASON_TEXT_KEY, prefix) &&
    MCD_ID.test(argument)
  ) {
    return {
      key: UPSTREAM_REASON_TEXT_KEY[prefix as UpstreamReasonCode],
      params: { sensor: argument },
    };
  }
  if (prefix === MODIFIER_REASON_CODE && STATE_CODE.test(argument)) {
    return { key: MODIFIER_REASON_TEXT_KEY, params: { state: argument } };
  }
  return undefined;
}
