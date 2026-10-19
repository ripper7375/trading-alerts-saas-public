/**
 * Account-deletion lifecycle (F21, Option B: soft delete with an admin audit trail).
 *
 * PENDING --confirm--> CONFIRMED --24 h, worker--> PROCESSING --> COMPLETED
 *     \                    \
 *      '--cancel-------------'--> CANCELLED      (PENDING also --> EXPIRED after 7 days)
 *
 * The user is locked out the moment the request is CONFIRMED (isActive = false). The grace period
 * is the time left to cancel from the e-mail link. After it, the worker claims the request
 * (PROCESSING: from here a cancel is refused), cancels billing, removes the live artifacts and sets
 * User.deletedAt; the User, Account, Payment and Commission rows stay.
 *
 * PROCESSING is a value of a plain string column, so it needs no migration. It is the worker's
 * claim: claiming BEFORE the irreversible billing call is what makes a cancel and the worker
 * unable to both win, whatever their clocks say.
 *
 * @module account-deletion/account-deletion.constants
 */

/** How long a CONFIRMED request can still be cancelled, and how long the worker waits. */
export const DELETION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/** How often the worker looks for requests whose grace period is over. */
export const DELETION_WORKER_INTERVAL_MS = 5 * 60 * 1000;

/** How long a PROCESSING claim may sit before another run takes it over (a crashed worker). */
export const DELETION_CLAIM_STALE_MS = 30 * 60 * 1000;

/** Requests handled per run; the rest wait for the next one. */
export const DELETION_BATCH_SIZE = 50;

export const DELETION_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

/** Error code returned to a client that signs in (or refreshes) on a deactivated account. */
export const ACCOUNT_DEACTIVATED_CODE = 'ACCOUNT_DEACTIVATED';
