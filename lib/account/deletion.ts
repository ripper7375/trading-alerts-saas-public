/**
 * Account-deletion lifecycle shared by the monolith's flag-off routes and the sign-in path
 * (F21, Option B: soft delete with an admin audit trail). The 24 h worker itself lives in
 * operation-service (`src/account-deletion/`); these values mirror its constants.
 *
 * PENDING --confirm--> CONFIRMED --24 h, worker--> COMPLETED
 *     \                    \
 *      '--cancel-------------'--> CANCELLED      (PENDING also --> EXPIRED after 7 days)
 *
 * The user is locked out the moment the request is CONFIRMED (`User.isActive = false`). The grace
 * period is the time left to cancel from the e-mail link; after it the worker cancels billing,
 * removes the live artifacts and sets `User.deletedAt`. The User, Account, Payment and Commission
 * rows stay for the admin.
 */

/** How long a CONFIRMED request can still be cancelled, and how long the worker waits. */
export const DELETION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/** The error a sign-in or token refresh returns for a deactivated account. */
export const ACCOUNT_DEACTIVATED_CODE = 'ACCOUNT_DEACTIVATED';
