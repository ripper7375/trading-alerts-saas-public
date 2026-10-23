/**
 * Payout-details hold, monolith side (WS-9, CODE-06A).
 *
 * A Wise payout recipient that has just been added or changed is not paid for
 * 72 hours. money-service enforces it (`AffiliateWiseRecipient.detailsChangedAt`,
 * its eligibility query and `WisePaymentProvider.prepareBatch`); this file is
 * what the admin views use to print the end of the hold and to flag a batch
 * line. Hand-synced twin of
 * `money-service/src/disbursement/payout-details-hold.ts` (LESSONS-LEARNED L1:
 * never a shared package); `__tests__/lib/disbursement/payout-details-hold.test.ts`
 * holds the two together.
 *
 * Pure functions only. `detailsChangedAt` NULL means "no change on record"
 * (every recipient that predates the column) and is never held.
 */

/** How long a new or changed recipient is not paid, in hours. */
export const PAYOUT_DETAILS_HOLD_HOURS = 72;

const HOUR_MS = 60 * 60 * 1000;

/** The first moment a recipient changed at `changedAt` may be paid. */
export function payoutHoldUntil(changedAt: Date): Date {
  return new Date(changedAt.getTime() + PAYOUT_DETAILS_HOLD_HOURS * HOUR_MS);
}

/** True while a recipient changed at `changedAt` may not be paid. */
export function isOnPayoutHold(
  changedAt: Date | null | undefined,
  now: Date
): boolean {
  if (!changedAt) return false;
  return (
    changedAt.getTime() > now.getTime() - PAYOUT_DETAILS_HOLD_HOURS * HOUR_MS
  );
}

/**
 * Whether a payout to this affiliate is the first one since their recipient
 * was added or changed. True when a change is on record and the affiliate has
 * not been paid since (or never). A payout at the very instant of the change
 * does not prove the new details were paid, so it counts as "not since".
 */
export function changedSinceLastPaid(
  changedAt: Date | null | undefined,
  lastPaidAt: Date | null | undefined
): boolean {
  if (!changedAt) return false;
  if (!lastPaidAt) return true;
  return changedAt.getTime() >= lastPaidAt.getTime();
}
