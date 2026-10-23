/**
 * Payout-details hold (WS-9, CODE-06A).
 *
 * A Wise payout recipient that has just been added or changed is not paid for
 * 72 hours. Someone who takes over an account can point the payout at their
 * own bank in one request; the hold gives the owner (who is e-mailed and gets
 * an in-app alert at the moment of the change) time to notice and say so.
 *
 * `AffiliateWiseRecipient.detailsChangedAt` records the moment. NULL means no
 * change is on record (every row that existed before the column did), and such
 * a recipient is never held.
 *
 * Pure functions only. Twin of the constant in `lib/disbursement/constants.ts`
 * (the monolith's admin views print the end of the hold).
 */

/** How long a new or changed recipient is not paid, in hours. */
export const PAYOUT_DETAILS_HOLD_HOURS = 72;

const HOUR_MS = 60 * 60 * 1000;

/** The first moment a recipient changed at `changedAt` may be paid. */
export function payoutHoldUntil(changedAt: Date): Date {
  return new Date(changedAt.getTime() + PAYOUT_DETAILS_HOLD_HOURS * HOUR_MS);
}

/**
 * A recipient changed after this instant is still held at `now`; one changed at
 * or before it is not. This is the `lte` bound of the eligibility query.
 */
export function payoutHoldCutoff(now: Date): Date {
  return new Date(now.getTime() - PAYOUT_DETAILS_HOLD_HOURS * HOUR_MS);
}

/** True while a recipient changed at `changedAt` may not be paid. */
export function isOnPayoutHold(
  changedAt: Date | null | undefined,
  now: Date
): boolean {
  if (!changedAt) return false;
  return changedAt.getTime() > payoutHoldCutoff(now).getTime();
}

export type RecipientChangeKind = 'ADDED' | 'REPLACED';

/** The parts of a recipient that decide where the money goes. */
export interface RecipientDestination {
  detailsFingerprint: string | null;
  accountHolderName: string;
  targetCurrency: string;
  recipientCountry: string;
  legalType: string;
  requirementsType: string;
}

export interface StoredRecipientDestination extends RecipientDestination {
  status: string;
}

const DESTINATION_FIELDS: ReadonlyArray<keyof RecipientDestination> = [
  'detailsFingerprint',
  'accountHolderName',
  'targetCurrency',
  'recipientCountry',
  'legalType',
  'requirementsType',
];

/**
 * Decides whether submitting `next` is an addition or a change that starts the
 * hold, given the recipient already stored (if any).
 *
 * - no stored recipient, or one that was removed (ARCHIVED): an addition;
 * - a stored recipient that is not ACTIVE (INVALID, DRAFT, PENDING_DETAILS), or
 *   any destination field that differs (a missing stored fingerprint counts as
 *   different): a replacement;
 * - an ACTIVE recipient with the same destination: not a change (null), so
 *   re-saving the same details can neither end nor restart a hold.
 *
 * `wiseRecipientId` is not compared: Wise assigns a new id to every submission,
 * even for identical details.
 */
export function classifyRecipientChange(
  existing: StoredRecipientDestination | null | undefined,
  next: RecipientDestination
): RecipientChangeKind | null {
  if (!existing || existing.status === 'ARCHIVED') return 'ADDED';
  if (existing.status !== 'ACTIVE') return 'REPLACED';
  for (const field of DESTINATION_FIELDS) {
    if (
      field === 'detailsFingerprint' &&
      existing.detailsFingerprint === null
    ) {
      return 'REPLACED';
    }
    if (existing[field] !== next[field]) return 'REPLACED';
  }
  return null;
}
