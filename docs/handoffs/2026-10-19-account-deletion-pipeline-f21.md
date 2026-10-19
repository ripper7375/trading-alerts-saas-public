# Account deletion pipeline (F21): lock at confirm, soft delete after 24 h

**Date:** 2026-10-19 · **Branch:** `main` · **Status:** written and verified; **not committed, pushed, applied or deployed**
(Davin's order: no commit or push before he signs off on this report).

**Order:** Davin's pasted task of 2026-10-19 (Option B: soft delete and deactivation with an admin audit trail, for all users;
full GDPR hard deletion stays a future extension for Eurozone users). It closes the open TODO of
[the Tier 0 to Tier 2 report](./2026-10-16-nestjs-tier0-tier2-execution.md) (Unit 1.1, Section 2 item 4, gap F21).

## 1. Needs from Davin

Before anything is deployed, in this order:

1. **Apply the migration `20261019000000_add_user_deleted_at` first** (it adds the nullable column `"User"."deletedAt"`; the
   pre-flight query and the rollback are in its header). This one is **not optional the way the earlier additive tables were**: the
   regenerated Prisma clients select `deletedAt` in every full-row read of `User` (a `findUnique` with no `select`), so
   operation-service deployed before the column exists fails on **login**, not only on deletion. Old code against the new schema is
   safe. I did not apply it (CLAUDE.md).
2. **Create the Stripe restricted key and set `STRIPE_RESTRICTED_KEY`** on operation-service, on the process that runs the worker (item 3).
   Your decision (2026-10-19, "restricted key in operation-service"). In the Stripe Dashboard: Developers, API keys, "Create restricted
   key", permission **Subscriptions: Write** and nothing else. Without it, a user who has a Stripe subscription is **not** completed
   (the run logs `STRIPE_RESTRICTED_KEY is not set...` and retries every 5 minutes); users without one complete normally.
   `operation-service/package.json` gained `stripe@^14.25.0` (the range money-service uses) and its lockfile moved by 455 bytes.
3. **Confirm the worker process is deployed.** The 24 h job runs only where `src/main-worker.ts` runs (`npm run start:worker`, the
   process that already runs the alert checker), never in the HTTP process. If that Railway service is not running, the job never
   runs, and nobody is completed.
4. **Read the decisions I took (section 4) and reverse any you do not want.** The ones that change behaviour you did not spell out:
   a `PROCESSING` status, cancel refused after 24 h, `ACCOUNT_DEACTIVATED` for every inactive user (including admin-suspended ones), and
   the `jwt` callback now reading the database.
5. The two new login texts are my drafts in 17 languages; no native reader has seen them (same status as the other drafts).
6. **Check the database grants of the role operation-service uses** (section 5 has the queries): a missing one stalls the worker with a
   logged `permission denied`; nothing is deleted.
7. The commit and the push, when you decide.

## 2. Changed and verified

### What now happens

| Moment                                                | What happens                                                                                                                                                                                                                                                                                                       | Where                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| User clicks the e-mail link (confirm)                 | In **one transaction**: `PENDING` to `CONFIRMED` (conditional, so two clicks cannot both win), `User.isActive = false`, every NextAuth `Session` row and every `RefreshToken` deleted, every `UserSession` marked inactive.                                                                                        | `UsersService.confirmDeletion`, the monolith `deletion-confirm` route (flag off) |
| The next request of that user                         | Refused. Monolith: the `jwt` callback throws, NextAuth answers "no session" and clears the cookie. operation-service: `JwtAuthGuard` answers 401 `ACCOUNT_DEACTIVATED`; a new websocket is refused.                                                                                                                | `lib/auth/auth-options.ts`, `JwtAuthGuard`, `RealtimeGateway`                    |
| Sign-in attempts                                      | Password: `ACCOUNT_DEACTIVATED` once the password is right (a wrong password still says `INVALID_CREDENTIALS`, so the state is not revealed). OAuth: sent to `/login?error=ACCOUNT_DEACTIVATED`. Token login, 2FA completion and refresh: `AccountDeactivatedError` (403). The login form says so in 19 languages. | `authorize`, `signIn` callback, `AuthService`                                    |
| Cancel from the e-mail link, inside 24 h              | `CANCELLED`, `isActive = true` again (only if the request had been confirmed, and only if `deletedAt` is null).                                                                                                                                                                                                    | `cancelDeletion` and the monolith route                                          |
| 24 h after confirm (every 5 minutes the worker looks) | **Claim** (`CONFIRMED` to `PROCESSING`, conditional); **stop billing** (`StripeBillingCanceller`); then **one transaction**: delete the user's `DrawingAlert`, `Alert`, `Drawing`, `Notification` rows, sign out again, `User.deletedAt = now` (and `isActive = false`), request to `COMPLETED`.                   | `AccountDeletionWorker`                                                          |
| What stays                                            | The `User` row (`isActive false`, `deletedAt` set), `Account`, `Payment`, `Commission`, `Subscription`, login history, security alerts, `UserSession` rows (inactive).                                                                                                                                             |                                                                                  |

The worker takes the Unit 2.9 lock (`SET key token PX ttl NX`, `CronLockService`), handles 50 requests per run, isolates each one
(one failure never stops the others), and logs ids and counts only: no address, no name, no token (a test asserts it).

### Files

New: `operation-service/src/account-deletion/` (`account-deletion.constants.ts`, `.worker.ts`, `.scheduler.ts`, `.module.ts`,
`billing-canceller.ts`, `stripe-billing-canceller.ts`, `revoke-user-access.ts` and five specs), `operation-service/src/auth/user-active.util.ts`,
`lib/account/deletion.ts`, `lib/auth/user-active.ts`, `prisma/migrations/20261019000000_add_user_deleted_at/migration.sql`,
`__tests__/api/account-deletion-lockout.test.ts`, `__tests__/lib/auth/account-deactivated.test.ts`.

Changed: `prisma/non-market-data/schema.prisma` (`User.deletedAt`), `operation-service/prisma/schema.prisma` (`User.deletedAt`, and a
read-only `Subscription` mirror with its enum), `types/prisma-stubs.d.ts`, `operation-service/src/{users/users.service.ts,
auth/auth.service.ts, auth/errors.ts, auth/jwt-auth.guard.ts, realtime/realtime.gateway.ts, app.module.ts, main-worker.ts}`,
`lib/auth/{auth-options.ts,errors.ts}`, `components/auth/login-form.tsx`, `app/api/user/account/{deletion-confirm,deletion-cancel}/route.ts`,
two keys in each of the 19 `lib/i18n/dictionaries/*.json`, `operation-service/package.json` and its lockfile, and the specs that
construct `JwtAuthGuard`, `RealtimeGateway` and `UsersService`.

### Evidence

- `npx tsc --noEmit`: monolith exit 0, operation-service exit 0 (its `tsconfig` includes the specs).
- ESLint with `--max-warnings 0` on every changed monolith source file: exit 0. Prettier run on the new operation-service files.
- **operation-service `npm test`: 58 suites, 578 tests, 0 failed** (the checklist's "43 · 401" baseline is stale). One run under 4 parallel
  workers timed out `prisma.shutdown.spec.ts` (its own header says it is slow under load, L24); it passes alone (3 of 3) and the whole
  suite passes again with `--maxWorkers=2`.
- New tests: worker 20, Stripe adapter 17, scheduler 7, module wiring 2, revoke helper 1 (47 in `src/account-deletion`);
  `UsersService` confirm and cancel 18 (12 of them new; the users specs now total 91 with the controller's); `JwtAuthGuard` +6;
  `AuthService` +5; realtime +1; worker wiring +1; monolith routes 13, auth callbacks 13, login form +4.
- The worker spec runs against an **in-memory database that really applies the `where` clauses and really rolls a transaction back**,
  because a `jest.fn()` per delegate cannot show that a request under 24 h is left alone or that the `User` row survives. It shows:
  23 h and 59 min is skipped, exactly 24 h is picked up, PENDING/CANCELLED/COMPLETED are ignored however old; a due request cancels
  billing **before** anything is deleted, deletes the four artifact kinds for that user only, keeps `User`, `Account`, `Payment`,
  `Commission`, stamps `deletedAt`, completes the request; a billing failure removes nothing, releases the request and does not stop
  the next one; a database failure after billing rolls everything back and the request is retried once the claim is 30 minutes old;
  a cancel or another worker winning the claim leaves the user untouched. Mutation check: removing the 24 h predicate and removing
  `deletedAt` each fail the test that names them (both restored).
- **Full monolith Jest run: 561 suites passed (1 skipped), 18,934 tests passed (27 skipped), 0 failed** (+2 suites, +30 tests over Session 8's
  560 and 18,929). `prettier` was run on the changed files after that run; the 7 suites it touched were run again and pass.

## 3. Cancel parity (order section 3)

Both stacks now cancel in one transaction: `CANCELLED`, `cancelledAt`, and `isActive = true` when the request had been confirmed. The
worker ignores a cancelled request (its search is `CONFIRMED` and old, or a stale `PROCESSING`). Tests: PENDING cancel leaves
`isActive` alone; a confirmed cancel restores it; a confirm that lands between the read and the flip still restores it; a cancel after
24 h, a cancel of a `COMPLETED` request and a lost conditional flip are all refused and touch nothing.

## 4. Decisions I took (Deviations)

1. **The order's "via StripeService" does not hold in operation-service.** `StripeService`, the `stripe` SDK and the live key exist
   only in money-service, and the roles file lets `core_app` only `SELECT` `Subscription`. I asked; you chose a restricted key in
   operation-service. The adapter reads `Subscription` (read-only mirror in the schema), retrieves the subscription from Stripe,
   cancels it if it is live, and treats "already canceled" and `resource_missing` as done. It never writes `Subscription`:
   money-service's webhook (`handleSubscriptionDeleted`, read) sets `CANCELED`, tier `FREE` and an outbox event.
2. **A `PROCESSING` status** (a value of a plain string column, so no migration). The worker claims the request before the
   irreversible Stripe call, so a cancel and the worker cannot both win whatever their clocks say; a claim older than 30 minutes is
   taken over (a crashed run). Without it a click at the 24 h boundary could cancel the subscription and still be accepted.
3. **A confirmed request can no longer be cancelled after 24 h** (it could, indefinitely, because nothing enforced the 24 h). The
   same test is in the `WHERE` of the conditional update.
4. **`ACCOUNT_DEACTIVATED` replaces `locked` for every inactive user**, so an admin-suspended user also sees "This account has been
   deactivated or is scheduled for deletion" instead of "locked due to too many failed login attempts" (which was wrong for them).
   The old `locked` branch and its text key are gone from the form (the key stays in the dictionaries).
5. **The `jwt` callback now reads the database** (one `SELECT isActive` per user per 30 seconds per server instance; only a positive
   answer is cached). It **fails open** on a database error or a missing row. Throwing from the callback is how NextAuth 4.24.13 is
   told "no session": its session route catches it and clears the cookie (read in `next-auth/core/routes/session.js`).
6. **`JwtAuthGuard` now needs `PrismaService`** (global module, so no module changes) and shares the same 30 s cache and fail-open
   rule; **new websocket handshakes** are refused too. A socket that is already open stays until it closes.
7. **Reactivation guard.** Cancelling a confirmed request sets `isActive = true` only if the request had been confirmed and
   `deletedAt` is null. **Residual:** a user an admin suspended, who then confirms a deletion from an old e-mail link and cancels it,
   is reactivated; `isActive` cannot tell the two reasons apart without another column.
8. **Logs.** The old confirm and cancel handlers printed the user's e-mail with `console.log`; the rewritten ones log ids only. Two
   other lines in `users.service.ts` still print an address (the profile e-mail change and the password change); I left them, they
   are not part of this order.
9. **"Delete device push tokens / active Notification records":** there is no push-token table anywhere in the schema. All of the
   user's `Notification` rows are deleted, read or not.
10. **`Session` and `RefreshToken` rows are deleted** (as ordered); `UserSession` rows are kept and marked inactive, which is what
    `revokeAllSessions` already did, so the admin keeps the device history.
11. **Two files not named by the order** carry the check: `RealtimeGateway` (above) and `lib/auth/errors.ts` / `operation-service/src/auth/errors.ts`
    (`AccountDeactivatedError`, kept in step).

## 5. Unconfirmed and found

**Not verified (no real service was available):** the worker against PostgreSQL (the Prisma `where` shapes, such as the relation
filter on `DrawingAlert`, type-check but did not run on a database; the in-memory database is a faithful evaluator of the shapes I
used, not a database), Stripe (the adapter runs against a stand-in client; the error classes are the SDK's real ones), Redis (the lock
is the existing, already-tested class), a real browser session being signed out (the callback is proven by calling it, and NextAuth's
catch branch by reading its source, not by an end-to-end request), the login form in a browser (jsdom only), the Railway worker.

**Database grants not checked (read-only SQL for you).** `prisma/roles/roles.sql` is where `core_app` is meant to get its rights. It
grants `SELECT` on `Subscription` only as a "temporary bridge, revoked at cutover", and it does not list `Drawing`, `DrawingAlert` or
`RefreshToken` at all (operation-service already writes those, so the file is probably out of date, but I could not look at production).
If the role operation-service connects as lacks any of them, the worker fails closed: the Stripe step (or the delete) throws
`permission denied`, nothing is removed, the run logs the error and retries. Check before the first run:
`SELECT has_table_privilege('<role>', '"Subscription"', 'SELECT')`, and `DELETE` on `"Alert"`, `"Drawing"`, `"DrawingAlert"`,
`"Notification"`, `"Session"`, `"RefreshToken"`, and `UPDATE` on `"User"`, `"AccountDeletionRequest"`, `"user_sessions"`.

**Found, not fixed:**

- **A deleted user receives one e-mail.** Cancelling the Stripe subscription makes Stripe send `customer.subscription.deleted`;
  money-service writes the outbox event `SUBSCRIPTION_CANCELLED` and operation-service's consumer e-mails "your subscription was
  cancelled" to the address on the (kept) `User` row. Arguably wanted; say if it should be suppressed.
- **money-service crons ignore `isActive`.** A dLocal subscription has no recurring charge, but `checkExpiringSubscriptions` can still send
  a renewal reminder to a deleted user until the row expires. money-service's `User` mirror has no `isActive` or `deletedAt`.
- **The edge middleware** still lets a stale cookie reach a page; the first server-side session read then clears it. It cannot query the database.
- **The admin list** (`app/api/admin/users/route.ts`) shows these users as `suspended` and does not return `deletedAt`; the row is there
  and not filtered out, so the audit trail is intact, but "deleted" is not a status yet. A small follow-up if you want it.
- The Tier 2 report's open item (4) said `confirmDeletion` queues no job; that is now closed (see waiting-on).
- Pre-existing, untouched: `.claude/rules/security-overrides.md`, `app/upgrade/success/page.tsx`, its test and several docs folders were
  already modified or untracked when this session started; none of them is part of this work.

## 6. Rollout order

1. Back up, then apply `20261019000000_add_user_deleted_at` (`prisma migrate status` first).
2. Create the restricted Stripe key; set `STRIPE_RESTRICTED_KEY` on the worker process of operation-service.
3. Deploy operation-service (HTTP and worker), then the monolith.
4. Smoke test with a throwaway account: request, confirm (you are signed out at once and the login says deactivated), cancel from the link
   (you can sign in again), confirm again and use `UPDATE "AccountDeletionRequest" SET "confirmedAt" = now() - interval '25 hours' ...` on
   that one row to watch the worker complete it within 5 minutes; check the `User` row (`isActive false`, `deletedAt` set), that `Account`
   and `Payment` remain, and, for a Stripe test subscription, that it is `canceled` in the Stripe test dashboard.
