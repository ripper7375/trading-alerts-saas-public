/**
 * The entitlement table (build step 7 part 6; architecture 7.3, ADR-074, ADR-072, ADR-073).
 *
 * ONE table in config, read by every gate: the session gate (`lib/intake/server/access.ts`), the
 * tier helpers (`lib/tier-validation.ts`, which the Engine 4 routes use) and the typed readers of
 * `lib/platform/entitlements.ts` (the chart route, the Trade Setup modal, the model picker and the
 * chat history will read those). Four documents disagreed about who gets what (file A, the deployed
 * UI, file D, file I); this file is the one answer, and EVERY VALUE IS DAVIN'S TO CHANGE: edit a
 * value here and every reader follows, with no other file to touch.
 *
 * What a value means:
 *  - a boolean: the feature is on (true) or off (false) for the tier;
 *  - `ai_chat_and_report1`: `MONTHLY_UNITS` is the live analyst, metered against the monthly
 *    allowance of the quota ledger (ADR-050, ADR-073); `RECORDED_DEMO` is the Free tier's recorded
 *    conversation, replayed from storage at no cost per view (ADR-072) and NOT the live analyst;
 *  - `model_choice`: `PASSED_MODELS` lets the trader pick among the models that have passed the
 *    evaluation (ADR-055); `false` is the launch default only;
 *  - `chat_history`: `TWELVE_MONTHS` keeps the trader's transcripts for 12 months, deletable
 *    (ADR-076); `false` keeps none for the tier.
 *
 * An unknown tier reads as FREE: access is never granted by a gap (the rule of the Engine 4 and
 * intake sessions). An unknown feature is refused with an error, never read as "off" or "on".
 *
 * DATA AND PURE READERS ONLY. This file imports nothing, reads no environment, no clock, no
 * network, so a client component can import it (the picker and the modal will).
 *
 * @module config/entitlements
 */

export const ENTITLEMENT_TIERS = ['FREE', 'PRO'] as const;
export type EntitlementTier = (typeof ENTITLEMENT_TIERS)[number];

export const ENTITLEMENT_FEATURES = [
  'ai_chat_and_report1',
  'report2',
  'chart_image_to_model',
  'chart_download',
  'session_clock_and_countdown',
  'model_choice',
  'chat_history',
] as const;
export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];

/** The values each feature may take, as 7.3 states them. */
export interface EntitlementValues {
  ai_chat_and_report1: 'RECORDED_DEMO' | 'MONTHLY_UNITS';
  report2: boolean;
  chart_image_to_model: boolean;
  chart_download: boolean;
  session_clock_and_countdown: boolean;
  model_choice: false | 'PASSED_MODELS';
  chat_history: false | 'TWELVE_MONTHS';
}

export type EntitlementTable = {
  readonly [F in EntitlementFeature]: {
    readonly [T in EntitlementTier]: EntitlementValues[F];
  };
};

/** The table of 7.3. */
export const ENTITLEMENTS: EntitlementTable = Object.freeze({
  ai_chat_and_report1: Object.freeze({
    FREE: 'RECORDED_DEMO',
    PRO: 'MONTHLY_UNITS',
  }),
  report2: Object.freeze({ FREE: false, PRO: true }),
  chart_image_to_model: Object.freeze({ FREE: false, PRO: true }),
  chart_download: Object.freeze({ FREE: false, PRO: true }),
  session_clock_and_countdown: Object.freeze({ FREE: false, PRO: true }),
  model_choice: Object.freeze({ FREE: false, PRO: 'PASSED_MODELS' }),
  chat_history: Object.freeze({ FREE: false, PRO: 'TWELVE_MONTHS' }),
});

/** The tier a value stands for: exactly `PRO` is Pro, anything else (a gap, a typo, a new tier) is Free. */
export function entitlementTierOf(tier: unknown): EntitlementTier {
  return tier === 'PRO' ? 'PRO' : 'FREE';
}

/** Whether a word is one of the features of the table. */
export function isEntitlementFeature(
  value: unknown
): value is EntitlementFeature {
  return (
    typeof value === 'string' &&
    (ENTITLEMENT_FEATURES as readonly string[]).includes(value)
  );
}

/** A reader of one table: every other reader in the repository is this function over `ENTITLEMENTS`. */
export type EntitlementReader = <F extends EntitlementFeature>(
  feature: F,
  tier: unknown
) => EntitlementValues[F];

/**
 * Build the reader of a table. The shipped reader is `entitlementOf`; a test builds another over a
 * table with one value changed to show that every reader follows (architecture 7.13).
 */
export function makeEntitlementOf(table: EntitlementTable): EntitlementReader {
  return (feature, tier) => {
    if (!isEntitlementFeature(feature)) {
      throw new Error(`unknown entitlement feature: ${String(feature)}`);
    }
    return table[feature][entitlementTierOf(tier)] as never;
  };
}

/** What a tier gets of a feature. */
export const entitlementOf: EntitlementReader = makeEntitlementOf(ENTITLEMENTS);
