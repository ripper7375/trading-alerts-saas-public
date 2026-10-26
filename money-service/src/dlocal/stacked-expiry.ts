/**
 * Stacked expiry for a dLocal payment (Manage Subscription S4, decision D6,
 * defect B10; docs/handoffs/2026-10-21-manage-subscription-proposal.md §7 W6).
 *
 * A dLocal payment buys a period that ends at `expiresAt`; there is no
 * recurring billing. A customer who pays again BEFORE the plan ends keeps the
 * days they have left: the new period starts where the current one ends,
 * `max(now, current expiry) + duration`. Before S4 the webhook set
 * `now + duration`, which threw the remaining days away.
 *
 * The current expiry only counts when the row is a LIVE dLocal plan
 * (`currentExpiryOf`): a Stripe row also stores `expiresAt` (its next billing
 * date), and a cancelled one can still hold a date months ahead that must not
 * be added to a new dLocal purchase.
 *
 * No imports: byte copy of money-service/src/dlocal/stacked-expiry.ts; a test
 * fails on any difference.
 *
 * @module lib/dlocal/stacked-expiry
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The expiry a dLocal subscription row contributes to the next payment: its
 * `expiresAt` while it is an ACTIVE dLocal plan, else null (nothing to stack).
 */
export function currentExpiryOf(
  row:
    | {
        status?: string | null;
        dLocalPaymentId?: string | null;
        expiresAt?: Date | string | null;
      }
    | null
    | undefined
): Date | null {
  if (!row || row.status !== 'ACTIVE' || !row.dLocalPaymentId) return null;
  if (!row.expiresAt) return null;
  const expiresAt = new Date(row.expiresAt);
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt;
}

/**
 * `max(now, currentExpiresAt) + durationDays`. A missing or unreadable current
 * expiry counts as "already over", so the period starts now.
 */
export function stackedExpiry(
  currentExpiresAt: Date | string | null | undefined,
  durationDays: number,
  now: number = Date.now()
): Date {
  const current = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;
  const start = Math.max(now, Number.isNaN(current) ? 0 : current);
  return new Date(start + durationDays * DAY_MS);
}
