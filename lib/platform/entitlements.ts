/**
 * The typed readers of the entitlement table (build step 7 part 6; architecture 7.3, ADR-074).
 *
 * `config/entitlements.ts` is the table; this file is what the server reads it through. Each
 * function answers one question a gate asks, and every one of them is `entitlementOf` and a
 * comparison: there is no second place a value is written, and no function here caches or copies
 * one, so a value changed in the table is the value every reader sees on its next call.
 *
 * Readers wired today: the session gate (`canUseAiChat`, through `lib/intake/server/access.ts`)
 * and the quota port (`quotaModeOf`). The others are the questions the chart route, the Trade
 * Setup modal, the model picker and the history panel will ask when they are moved onto the table
 * (parts 7 and 8); they exist now so those parts add a caller and not a second source.
 *
 * An unknown tier reads as Free. Pure: no I/O, no clock, no randomness.
 *
 * @module lib/platform/entitlements
 */

import {
  ENTITLEMENT_FEATURES,
  entitlementOf,
  entitlementTierOf,
  type EntitlementFeature,
  type EntitlementTier,
  type EntitlementValues,
} from '@/config/entitlements';

export { entitlementTierOf, type EntitlementTier };

/** The live AI analyst (chat and Report 1) is metered in monthly units: the Free tier's recorded demo is not it. */
export function canUseAiChat(tier: unknown): boolean {
  return entitlementOf('ai_chat_and_report1', tier) === 'MONTHLY_UNITS';
}

/** The Free tier's recorded demo conversation (ADR-072). */
export function seesRecordedDemo(tier: unknown): boolean {
  return entitlementOf('ai_chat_and_report1', tier) === 'RECORDED_DEMO';
}

export type QuotaMode = 'NONE' | 'MONTHLY_UNITS';

/** How a tier's use of the live analyst is counted: not at all (it has none) or against the monthly units. */
export function quotaModeOf(tier: unknown): QuotaMode {
  return canUseAiChat(tier) ? 'MONTHLY_UNITS' : 'NONE';
}

export function canUseReport2(tier: unknown): boolean {
  return entitlementOf('report2', tier) === true;
}

export function canSendChartToModel(tier: unknown): boolean {
  return entitlementOf('chart_image_to_model', tier) === true;
}

export function canDownloadChart(tier: unknown): boolean {
  return entitlementOf('chart_download', tier) === true;
}

export function hasSessionClock(tier: unknown): boolean {
  return entitlementOf('session_clock_and_countdown', tier) === true;
}

/** Whether the trader may pick among the models that have passed (ADR-055); otherwise the launch default only. */
export function canChooseModel(tier: unknown): boolean {
  return entitlementOf('model_choice', tier) === 'PASSED_MODELS';
}

/** Months a tier's transcripts are kept (ADR-076): 12, or 0 for a tier that has no history. */
export function chatHistoryMonths(tier: unknown): number {
  return entitlementOf('chat_history', tier) === 'TWELVE_MONTHS' ? 12 : 0;
}

/** Every value of one tier, for a single call that tells the interface what it may show. */
export function entitlementsOf(tier: unknown): {
  tier: EntitlementTier;
  values: { [F in EntitlementFeature]: EntitlementValues[F] };
} {
  const values = {} as { [F in EntitlementFeature]: EntitlementValues[F] };
  for (const feature of ENTITLEMENT_FEATURES) {
    (values as Record<string, unknown>)[feature] = entitlementOf(feature, tier);
  }
  return { tier: entitlementTierOf(tier), values };
}
