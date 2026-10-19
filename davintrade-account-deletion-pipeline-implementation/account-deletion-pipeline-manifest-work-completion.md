# Account Deletion Pipeline (F21): Work Completion Manifest (Units F21-a to F21-i, plus follow-up F21-F1)

- **Executor:** Claude Code (single session, 2026-10-19) on Davin's instruction, DavinTrade Monolith (`trading-alerts-saas-public`) and `operation-service`.
- **Owner / Approver:** Davin.
- **Advisor:** Antigravity (wrote the remediation plan that left gap F21 open). This order was issued by Davin directly, as a pasted task.
- **Originating Gap:** F21, the TODO that [`docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md`](../docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md) left open (Unit 1.1, Section 2 item 4): confirming a deletion deleted nothing and queued no job.
- **Product Decision (Davin):** **Option B, soft delete and deactivation with an admin audit trail**, for all users for now. Full GDPR hard deletion / PII anonymization is scheduled as a dedicated future customization for Eurozone users (see detailed roadmap in Section 6).
- **Execution Report:** [`docs/handoffs/2026-10-19-account-deletion-pipeline-f21.md`](../docs/handoffs/2026-10-19-account-deletion-pipeline-f21.md).
- **Session Continuity Record:** the `2026-10-19 account-deletion-pipeline-f21` entry in [`.claude/state/current-state.md`](../.claude/state/current-state.md) and the first item of [`.claude/state/waiting-on.md`](../.claude/state/waiting-on.md).
- **Overall Execution State:** **BUILT, VERIFIED, APPROVED AND COMMITTED LOCALLY (9 / 9 Units; commit `7c8f1ebe` on `main`, 66 files). NOT PUSHED, NOT APPLIED, NOT DEPLOYED.** Davin signed off the report and ordered the commit by explicit paths with no push. The migration `20261019000000_add_user_deleted_at` is a file only: it must be applied **before** any deploy. **Follow-up F21-F1 (the admin list shows "deleted" and returns `deletedAt`) was built afterwards on Davin's word and committed locally in a second commit on `main`, after `7c8f1ebe`** (6 files, section 6); this manifest is a third, docs-only commit. **Nothing of this work is pushed.**

---

## 1. Executive Summary & Master Work Inventory

Confirming an account deletion now **locks the account at once** (`isActive = false`, every session and refresh token gone), and a **24-hour worker** in `operation-service` finishes the job: it cancels the Stripe subscription, removes the live artifacts, stamps `User.deletedAt`, and completes the request. The `User` row, `Account`, `Payment` and `Commission` stay for the admin.

```
PENDING --confirm--> CONFIRMED --24 h, worker--> PROCESSING --> COMPLETED
    \                    \
     '--cancel-------------'--> CANCELLED        (PENDING also --> EXPIRED after 7 days)
```

| Unit       | Order Section | Scope & Change Description                                                                                                                                                                                                                                                                                                                                                                      | Primary Files Touched                                                                                                                                                                                                              | Verification Evidence                                                                                                                                                                                                                                                                       |
| :--------- | :-----------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F21-a**  |    support    | **`User.deletedAt` (schema + migration file):** nullable column added to the source-of-truth schema, the `operation-service` mirror and the type stubs. Migration written as a **file only**, with pre-flight query, rollout order and rollback in its header.                                                                                                                                  | `prisma/non-market-data/schema.prisma`, `operation-service/prisma/schema.prisma`, `types/prisma-stubs.d.ts`, `prisma/migrations/20261019000000_add_user_deleted_at/migration.sql`                                                  | Both Prisma clients regenerated; both `tsc --noEmit` exit 0. Migration **not applied** (CLAUDE.md).                                                                                                                                                                                         |
| **F21-b**  |   1.1, 1.2    | **Lock at confirm, operation-service:** one transaction: `PENDING`→`CONFIRMED` (conditional, so two clicks cannot both win), `User.isActive = false`, `Session` and `RefreshToken` deleted, `UserSession` marked inactive. Logs ids only (the old handler printed the e-mail).                                                                                                                  | `operation-service/src/users/users.service.ts`, `src/account-deletion/{account-deletion.constants.ts,revoke-user-access.ts}`                                                                                                       | 8 confirm tests + 1 revoke-helper test: transaction contents, lost claim changes nothing, already-`CONFIRMED` rejected, 24 h schedule from the stored time, no address or token in any log.                                                                                                 |
| **F21-c**  |   1.1, 1.2    | **Lock at confirm, monolith counterpart** (the flag-off path of `deletion-confirm`): the same transaction and the same log rule. Shared constants in `lib/account/deletion.ts`.                                                                                                                                                                                                                 | `app/api/user/account/deletion-confirm/route.ts`, `lib/account/deletion.ts`                                                                                                                                                        | 6 route tests (new file, 13 with the cancel route).                                                                                                                                                                                                                                         |
| **F21-d**  |       3       | **Cancel parity, both stacks:** one transaction: conditional flip to `CANCELLED` and `isActive = true` **only if the request had been confirmed** and `deletedAt` is null. Refused once 24 h have passed since confirm; the same test sits in the `WHERE`.                                                                                                                                      | `operation-service/src/users/users.service.ts`, `app/api/user/account/deletion-cancel/route.ts`                                                                                                                                    | 10 cancel tests + 7 route tests: `PENDING` leaves `isActive` alone, confirmed restores it, a confirm racing the cancel still restores it, >24 h refused, lost flip refused, `COMPLETED` refused.                                                                                            |
| **F21-e**  |      1.3      | **Sign-in rejection, monolith:** password sign-in answers `ACCOUNT_DEACTIVATED` once the password is right (a wrong password still says `INVALID_CREDENTIALS`); OAuth is sent to `/login?error=ACCOUNT_DEACTIVATED`; the login form shows the notice in 19 languages.                                                                                                                           | `lib/auth/auth-options.ts`, `lib/auth/errors.ts`, `components/auth/login-form.tsx`, 19 files in `lib/i18n/dictionaries/`                                                                                                           | `account-deactivated.test.ts` (5 of its 13 tests: credentials and OAuth) and login-form +4 tests; the i18n coverage test passes with 2 new keys in all 19 dictionaries.                                                                                                                     |
| **F21-f**  |      1.4      | **Existing sessions stop working, monolith:** the NextAuth `jwt` callback reads `User.isActive` on every later session read and throws; NextAuth answers "no session" and clears the cookie. Cached 30 s per instance (positive answers only), fails open on a database error or a missing row.                                                                                                 | `lib/auth/user-active.ts`, `lib/auth/auth-options.ts`                                                                                                                                                                              | The other 8 tests of `account-deactivated.test.ts`: `jwt` callback throws when deactivated, one query per window, a deactivated user re-read every time, fails open, skipped at sign-in; `isUserActive` never caches a negative answer and forgets a positive one after 30 s (fake timers). |
| **F21-g**  |   1.3, 1.4    | **Deactivated users blocked in operation-service:** `AccountDeactivatedError` (403) at login, 2FA completion and refresh (the token rotated in is revoked); `JwtAuthGuard` answers 401 `ACCOUNT_DEACTIVATED`; a new websocket handshake is refused. Same 30 s cache and fail-open rule.                                                                                                         | `src/auth/{auth.service.ts,errors.ts,jwt-auth.guard.ts,user-active.util.ts}`, `src/realtime/realtime.gateway.ts`                                                                                                                   | Guard +6, `AuthService` +5, realtime +1 tests; the e2e socket.io spec still passes with the new dependency.                                                                                                                                                                                 |
| **F21-h**  |       2       | **24 h soft-delete worker:** every 5 minutes behind the Unit 2.9 Redis lock (`SET NX PX`), 50 requests per run, each isolated. Claim (`CONFIRMED`→`PROCESSING`), cancel billing, then **one transaction**: delete `DrawingAlert`, `Alert`, `Drawing`, `Notification`, sign out again, set `User.deletedAt`, mark `COMPLETED`. Enabled only by `main-worker.ts`. Logs carry ids and counts only. | `src/account-deletion/{account-deletion.worker.ts,account-deletion.scheduler.ts,account-deletion.module.ts,billing-canceller.ts}`, `src/app.module.ts`, `src/main-worker.ts`                                                       | 20 worker + 7 scheduler + 2 module-wiring + 1 main-worker pin tests, against an in-memory database that **really applies `where` clauses and rolls back**. 2 mutation checks (see section 4).                                                                                               |
| **F21-i**  |      2.1      | **Stripe cancellation (restricted key):** `StripeBillingCanceller` retrieves the subscription, cancels it if live, and treats "already canceled" and `resource_missing` as done; throws on anything else so the worker retries. Needs only `STRIPE_RESTRICTED_KEY`; never writes `Subscription`.                                                                                                | `src/account-deletion/stripe-billing-canceller.ts`, `operation-service/package.json` + lockfile (`stripe@^14.25.0`), read-only `Subscription` mirror in `operation-service/prisma/schema.prisma`                                   | 17 adapter tests with the SDK's real error classes (including a permission error); a free or dLocal-only user completes without a key.                                                                                                                                                      |
| **F21-F1** |   follow-up   | **Admin list: show "deleted" and return `deletedAt`.** The API labels a soft-deleted user `deleted` (not `suspended`) and returns `deletedAt`; the list shows a grey dot and the date as a tooltip; the user detail page shows a **Deleted** badge and a "Deleted on" row. Built after commit `7c8f1ebe`, on Davin's word; committed locally in its own commit, not pushed.                     | `app/api/admin/users/route.ts`, `app/admin/users/page.tsx`, `app/admin/users/[id]/page.tsx`, `__tests__/api/admin.test.ts`, `__tests__/pages/admin/user-detail.test.tsx`, `__tests__/pages/admin/users-list-status.test.tsx` (new) | 8 new tests (route 4, detail page 2, list page 2); the 25 surrounding admin suites (291 tests) pass; `tsc` and ESLint exit 0; two red checks fail the named tests (section 6).                                                                                                              |

---

### Test Suite & Codebase Metrics

| Metric / Checkpoint                 |                                Before this work                                 |                                                                                                                                   After this work (committed `7c8f1ebe`)                                                                                                                                    |
| :---------------------------------- | :-----------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **Monolith test suites**            |                              560 (Session 8 final)                              |                                                                                                                                    **562 total** (561 passed, 1 skipped)                                                                                                                                    |
| **Monolith test cases**             |                                     18,929                                      |                                                                                                                         **18,961 total** (18,934 passed, 27 skipped, **0 failed**)                                                                                                                          |
| **operation-service test suites**   |                     ≈53 (derived: 58 − 5 new, not measured)                     |                                                                                                                                           **58 passed, 0 failed**                                                                                                                                           |
| **operation-service test cases**    | ≈506 (derived: 578 − 72 new, not measured; the checklist's "43 · 401" is stale) |                                                                                                                                          **578 passed, 0 failed**                                                                                                                                           |
| **TypeScript (`tsc --noEmit`)**     |                                     Exit 0                                      |                                                                                                               **Exit 0**, monolith and operation-service (its `tsconfig` includes the specs)                                                                                                                |
| **ESLint**                          |                                     Exit 0                                      |                                                          **Exit 0, `--max-warnings 0`, on every changed monolith source file** (full `npm run lint` not re-run; the pre-commit hook ran `eslint --fix` and `prettier --write` on the staged files)                                                          |
| **Production build (`next build`)** |                               Exit 0 (Session 8)                                |                                                                                                                                                 **Not run**                                                                                                                                                 |
| **New tests in this work**          |                                        —                                        | **102** in commit `7c8f1ebe`: monolith 30 (routes 13, auth callbacks 13, login form 4); operation-service 72 (account-deletion 47, users 12, guard 6, auth 5, realtime 1, worker wiring 1). **Plus 8** for F21-F1, committed afterwards (not part of the totals above): route 4, detail page 2, list page 2 |

The monolith figures are those of the full run on commit `7c8f1ebe`; F21-F1 adds 1 suite and 8 tests on top (about 563 suites and 18,969 tests), and the full suite was **not** re-run after it. The monolith shows +32 tests over Session 8's 18,929, of which 30 are this work's. I did not trace the other 2; the tree already held other uncommitted changes when the session began.

---

## 2. Needs from Davin (Action Items & Operating Decisions)

Listed in the order they must happen:

1. **Apply the migration first.** `20261019000000_add_user_deleted_at` adds the nullable column `"User"."deletedAt"`. It is **not optional the way earlier additive tables were**: the regenerated Prisma clients select `deletedAt` in every full-row read of `User` (a `findUnique` with no `select`), so `operation-service` deployed before the column exists fails on **login**, not only on deletion. Old code against the new schema is safe. Run `prisma migrate status` first, then:
   ```sql
   -- Pre-flight (read-only): expect ZERO rows
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'User' AND column_name = 'deletedAt';
   ```
   Rollback, only before any account is completed: `ALTER TABLE "User" DROP COLUMN "deletedAt";`
2. **Create the Stripe restricted key and set `STRIPE_RESTRICTED_KEY`** on `operation-service`, on the process that runs the worker. In the Stripe Dashboard: Developers, API keys, "Create restricted key", permission **Subscriptions: Write** and nothing else. Without it, a user who has a Stripe subscription is not completed (the run logs `STRIPE_RESTRICTED_KEY is not set...` and retries every 5 minutes); users without one complete normally.
3. **Confirm the worker process is deployed.** The 24 h job runs only where `src/main-worker.ts` runs (`npm run start:worker`, the process that already runs the alert checker), never in the HTTP process. If that Railway service is not running, nobody is ever completed.
4. **Check the grants of the database role `operation-service` uses.** `prisma/roles/roles.sql` gives `core_app` only a transition `SELECT` on `Subscription` ("revoked at cutover") and lists no `Drawing`, `DrawingAlert` or `RefreshToken`. A missing grant stalls the worker with a logged `permission denied`; nothing is deleted. Replace `<role>`:

   ```sql
   SELECT has_table_privilege('<role>', 'public."Subscription"', 'SELECT') AS subscription_select;

   SELECT t AS table_name, has_table_privilege('<role>', format('public.%I', t), 'DELETE') AS can_delete
   FROM unnest(ARRAY['Alert','Drawing','DrawingAlert','Notification','Session','RefreshToken']) AS t;

   SELECT t AS table_name, has_table_privilege('<role>', format('public.%I', t), 'UPDATE') AS can_update
   FROM unnest(ARRAY['User','AccountDeletionRequest','user_sessions']) AS t;
   ```

5. **Deploy order:** migration, then `operation-service` (HTTP and worker), then the monolith. Push when ready (nothing is pushed).
6. **Smoke test with a throwaway account:** request a deletion, confirm it (you are signed out at once; the login says the account is deactivated), cancel from the e-mail link (you can sign in again), confirm again, then backdate that one request and watch the worker finish it within 5 minutes:

   ```sql
   UPDATE "AccountDeletionRequest" SET "confirmedAt" = now() - interval '25 hours'
   WHERE id = '<request id of the throwaway account>';

   -- After the next worker run:
   SELECT id, "isActive", "deletedAt" FROM "User" WHERE id = '<user id>';          -- false, set
   SELECT status, "completedAt" FROM "AccountDeletionRequest" WHERE "userId" = '<user id>';  -- COMPLETED
   SELECT count(*) FROM "Alert" WHERE "userId" = '<user id>';                      -- 0
   SELECT count(*) FROM "Payment" WHERE "userId" = '<user id>';                    -- unchanged
   ```

   For a Stripe **test** subscription, also confirm it is `canceled` in the Stripe test dashboard.

7. **Decisions in section 3 that you may reverse** (a `PROCESSING` status, cancel refused after 24 h, `ACCOUNT_DEACTIVATED` for every inactive user, the `jwt` callback reading the database).
8. **Two new login texts are drafts** in 17 languages; no native reader has seen them (same status as the other drafts).
9. **Review F21-F1 (admin list).** It is committed locally in its own commit (6 files), so it can be dropped or reverted without touching the pipeline. Its `deletedAt` select needs the migration like everything else in this work (the rollout order in item 1 does not change). Look at the users list and one user's detail page once after deploy: they were checked in jsdom only.

---

## 3. Deviations Log (Plan vs. Live Code — Live Code Won, Rule 7)

When the written order and the live code disagreed, live code won. Twelve adaptations were recorded:

```
┌──────────┬─────────────────────────────────────────────────────────────────────┐
│ Unit     │ Adaptation & Architectural Rationale                                │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-i    │ The order said "via StripeService" inside operation-service. That   │
│          │ class, the stripe SDK and the live key exist only in money-service, │
│          │ and the roles file lets core_app only SELECT Subscription. Davin    │
│          │ chose: a RESTRICTED key (Subscriptions: Write) in operation-service.│
│          │ The adapter never writes Subscription; money-service's webhook      │
│          │ (handleSubscriptionDeleted, read) sets CANCELED and the tier.       │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-h    │ A PROCESSING status (a value of a plain string column, no           │
│          │ migration). The worker claims the request BEFORE the irreversible   │
│          │ Stripe call, so a cancel and the worker cannot both win whatever    │
│          │ their clocks say. A claim older than 30 min is taken over (a        │
│          │ crashed run). The order selected only CONFIRMED rows.               │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-d    │ A confirmed request can no longer be cancelled after 24 h. Before,  │
│          │ nothing enforced the 24 h at all. The same test is in the WHERE.    │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-e    │ ACCOUNT_DEACTIVATED replaces 'locked' for EVERY inactive user, so   │
│          │ an admin-suspended user also sees the deactivated notice instead of │
│          │ "locked due to too many failed login attempts" (wrong for them).    │
│          │ The 'locked' branch is gone from the form; its dictionary key stays.│
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-f    │ The NextAuth jwt callback now reads the database: one SELECT per    │
│          │ user per 30 s per instance, positive answers cached, fail open.     │
│          │ Throwing from it is how NextAuth 4.24.13 is told "no session" (its  │
│          │ session route catches it and clears the cookie; read in source).    │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-g    │ JwtAuthGuard now needs PrismaService (global module, no module      │
│          │ changes) and shares the cache and fail-open rule. RealtimeGateway   │
│          │ (not named by the order) is checked at the handshake; a socket      │
│          │ that is already open stays until it closes.                         │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-d    │ Reactivation guard: cancelling sets isActive = true only if the     │
│          │ request had been confirmed AND deletedAt is null. Residual: an      │
│          │ admin-suspended user who confirms from an old link and then cancels │
│          │ is reactivated; isActive cannot tell the two reasons apart.         │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-b/c  │ The old confirm and cancel handlers printed the user's e-mail with  │
│          │ console.log; the rewritten ones log ids only. Two other lines in    │
│          │ users.service.ts still print an address (profile e-mail change,     │
│          │ password change); left alone, not part of this order.               │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-h    │ "Delete device push tokens": there is no push-token table anywhere  │
│          │ in the schema. All of the user's Notification rows are deleted,     │
│          │ read or not.                                                        │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-b    │ Session and RefreshToken rows are DELETED (as ordered). UserSession │
│          │ rows are kept and marked inactive, as revokeAllSessions already did,│
│          │ so the admin keeps the device history.                              │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-e/g  │ The order's "or an active CONFIRMED request exists" is not checked  │
│          │ separately: confirming sets isActive = false in the same            │
│          │ transaction, so the one flag carries it without a second query.     │
├──────────┼─────────────────────────────────────────────────────────────────────┤
│ F21-F1   │ The follow-up was specified for the list only. Reading the user     │
│          │ detail page showed the same isActive -> Active/Inactive mapping, so │
│          │ it was changed too (Deleted badge + "Deleted on"); otherwise the    │
│          │ list and the detail page would have disagreed about one account.    │
└──────────┴─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Comprehensive Verification & Quality Assurance Results

### 1. Static Type Checking & Linting

- **TypeScript:** `npx tsc --noEmit` exited `0` in the monolith (on the finished code, before the last formatting pass) and in `operation-service` (again after the commit).
- **ESLint:** `--max-warnings 0` on every changed monolith source file exited `0`, and again on the six F21-F1 files. The full `npm run lint` was not re-run.
- **Prettier:** run on the new `operation-service` files; `prettier --check --end-of-line auto` on the changed monolith files. The pre-commit hook then ran `eslint --fix` and `prettier --write` on the staged files and changed one line (3,331 insertions in the commit against 3,330 staged); `tsc` and the 241 affected `operation-service` tests were re-run afterwards and pass.

### 2. Automated Test Execution

- **operation-service full suite:** 58 suites, 578 tests, 0 failed. One run under 4 parallel workers timed out `prisma.shutdown.spec.ts` (its own header says it is slow under load, L24); it passes alone (3 of 3) and the whole suite passes with `--maxWorkers=2`.
- **Monolith full suite:** `npx jest --ci --silent --coverage=false --maxWorkers=4`: **561 suites passed (1 skipped), 18,934 tests passed (27 skipped), 0 failed**, 331 s.
- **Worker against a faithful stand-in database.** A `jest.fn()` per Prisma delegate cannot show that a request under 24 h is left alone or that the `User` row survives, so the worker spec runs against an in-memory database that applies equality, `lte`, `gt`, `OR` and the two relation filters on `DrawingAlert`, and rolls a transaction back. It shows:
  - 23 h is skipped, exactly 24 h is picked up, `PENDING`/`CANCELLED`/`COMPLETED` are ignored however old; batches are oldest first.
  - A due request cancels billing **before** anything is deleted, deletes the four artifact kinds **for that user only**, keeps `User` (`isActive false`, `deletedAt` stamped), `Account`, `Payment` and `Commission`, and completes the request.
  - A billing failure removes nothing, releases the request to `CONFIRMED`, and does not stop the next request.
  - A database failure after billing rolls **everything** back and the request is retried once the claim is 30 minutes old (billing asked again, which is idempotent).
  - A cancel, or another worker, winning the claim leaves the user untouched; a stale `PROCESSING` claim is taken over, a fresh one is not.
  - A request whose user row is already gone still completes.
  - Logs contain request and user ids and counts, never an address, a name or a token.

- **F21-F1:** the 3 touched test files (16 tests) and the 25 surrounding admin suites (291 tests) pass; `npx tsc --noEmit` exit 0.

### 3. Regression & Characterization Checks (Red Checks)

Temporary reversions confirmed that the new tests detect regressions (both restored, suite green again):

- The worker's search changed to ignore the 24 h predicate: `skips a request confirmed under 24 h ago` failed.
- `deletedAt: now` removed from the soft-delete update: `keeps the User row for the admin` failed.
- F21-F1: the status mapping in the admin route broken, then the grey-dot branch in the list page broken: `labels a soft-deleted user "deleted"` and `shows deleted, suspended and active users each with their own marker` failed.

### 4. What Was Read, Not Run

- NextAuth 4.24.13's session route (`next-auth/core/routes/session.js`): a throw from the `jwt` callback lands in a `catch` that cleans the cookie and returns an empty body, so `getServerSession` yields `null`.
- money-service's `handleSubscriptionDeleted`: sets the subscription `CANCELED`, the user tier `FREE`, and writes the outbox event `SUBSCRIPTION_CANCELLED`.

---

## 5. Not Verified / Environmental Caveats

Nothing in this work ran against a real service. To be observed in staging or on the first run:

1. **PostgreSQL.** The worker's `where` shapes (including the relation filter `{ alert: { userId } }` on `DrawingAlert.deleteMany`) type-check but did not execute against a database. The in-memory database is a faithful evaluator of the shapes used, not a database.
2. **Stripe.** The adapter ran against a stand-in client; the error classes are the SDK's real ones. No real or test-mode subscription was cancelled.
3. **Redis.** The lock is the existing, already-tested `CronLockService`; it fails open if Redis is unreachable, and the worker's claim makes an overlap harmless, but a live two-replica run was not exercised.
4. **A real browser sign-out.** The `jwt` callback is proven by calling it, and NextAuth's `catch` branch by reading its source; no end-to-end request was made. The login form was checked in jsdom only.
5. **The Railway worker process** and the **production database grants** (section 2 item 4).
6. **Production build.** `next build` was not run for this work.
   **Admin pages in a browser.** F21-F1's grey dot, tooltip and Deleted badge are asserted in jsdom only; the admin area needs a signed-in admin session and the Executor does not enter login credentials.
   **Full monolith suite after F21-F1.** Not re-run; the 25 surrounding admin suites were.
7. **Edge middleware.** `middleware.ts` cannot query the database, so a stale cookie still reaches a page route; the first server-side session read then clears it. API routes and server components check the session and answer 401 or redirect.

---

## 6. Follow-Ups

### F21-F1 — Admin users list: show "deleted" and return `deletedAt` (BUILT, COMMITTED LOCALLY)

**Why.** The order requires the soft-deleted record to stay visible to the admin "marked with `isActive: false` and `deletedAt`". The record was always there and is not filtered out (the list has no status filter), so the audit trail was intact. But `app/api/admin/users/route.ts` computed `status: user.isActive ? 'active' : 'suspended'`, so a completed deletion read as **suspended**, and `deletedAt` was not returned at all. An admin could not tell a deleted account from a suspended one.

**What was built (on Davin's word, after commit `7c8f1ebe`; committed locally in its own commit, not pushed):**

1. `app/api/admin/users/route.ts`: `deletedAt: true` added to the `select`; each user now carries `deletedAt` (null unless deleted); `status` is `'deleted'` when `deletedAt` is set, otherwise the existing `'active'` / `'suspended'`. A row with no `deletedAt` at all is treated as not deleted.
2. `app/admin/users/page.tsx` (the list): `deletedAt` added to the `AdminUser` interface (`status` was already a plain `string`); the dot is **grey** for `deleted` (emerald for active, red for suspended, as before) and the status text carries the deletion date as a `title` tooltip. The status text is the raw API value, as it was; admin pages are not required to be translated (`.claude/rules/i18n-compliance.md`).
3. `app/admin/users/[id]/page.tsx` (the detail page, which I had not read when I specified this): it mapped `isActive` to Active / Inactive. It now selects `deletedAt`, shows a grey **Deleted** badge instead of Inactive for a deleted account, and a "Deleted on" row with the date. `dt('admin.users.deleted', 'Deleted')` and `dt('admin.users.deleted_on', 'Deleted on')` carry English fallbacks; no admin dictionary key was added.

**Tests (8 new):**

- `__tests__/api/admin.test.ts`: a soft-deleted user is `deleted` with its `deletedAt`; an admin suspension stays `suspended` and a live user `active`, both with `deletedAt: null`; a row with no `deletedAt` is `active`; the deleted user comes from the same unfiltered query (`where` is `{}`) and the `select` asks for `deletedAt`.
- `__tests__/pages/admin/user-detail.test.tsx`: a deleted account shows "Deleted" and "Deleted on", not "Inactive", and the `select` asks for `deletedAt`; an admin suspension still shows "Inactive" with no deletion row.
- `__tests__/pages/admin/users-list-status.test.tsx` (new): grey, red and emerald dots for deleted, suspended and active; the deletion date is the tooltip of `deleted` only.

**Evidence.** The three files: 16 tests pass. The 25 surrounding admin suites (`__tests__/pages/admin`, `__tests__/app/admin`, `__tests__/api/admin*`, `admin-user-view-as`, `middleware`): 291 tests pass. `npx tsc --noEmit` exit 0; ESLint `--max-warnings 0` on the six files exit 0; Prettier unchanged. **Red checks** (both restored): breaking the status mapping in the route fails "labels a soft-deleted user deleted"; breaking the grey-dot branch fails "each with their own marker".

**Not verified:** the pages were not opened in a browser (the admin area needs a signed-in admin session, and the Executor does not enter login credentials); the grey dot and the tooltip are asserted in jsdom only. The full Jest suite and `next build` were not re-run for this follow-up.

### Other follow-ups found, not fixed

| #   | Item                                                                                                                                                                                                                                                                                                                                                            | Where / Why                                                                                                     |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| 1   | **A deleted user gets one e-mail.** Cancelling the Stripe subscription triggers Stripe's `customer.subscription.deleted`; money-service writes the outbox event `SUBSCRIPTION_CANCELLED` and `operation-service`'s consumer e-mails "your subscription was cancelled" to the address on the (kept) `User` row. Arguably wanted; say if it should be suppressed. | `money-service/src/stripe/stripe-webhook.service.ts`, `operation-service/src/outbox/outbox-consumer.service.ts` |
| 2   | **money-service crons ignore `isActive`.** A dLocal subscription has no recurring charge, but `checkExpiringSubscriptions` can still send a renewal reminder to a deleted user until the row expires. money-service's `User` mirror has no `isActive` or `deletedAt`.                                                                                           | `money-service/src/crons/subscription.service.ts`, `money-service/prisma/schema.prisma`                         |
| 3   | **Confirmation and cancellation e-mails are still TODO** (preserved from the original source in both stacks).                                                                                                                                                                                                                                                   | `UsersService`, both monolith routes                                                                            |
| 4   | **Residual reactivation** of an admin-suspended user who confirms and then cancels from an old link (section 3). Closing it needs another column (a reason for deactivation).                                                                                                                                                                                   | schema                                                                                                          |
| 5   | **GDPR hard deletion / PII anonymization for Eurozone users** is the planned customization Davin confirmed; this current work implements Option B (preserving `User`, `Account`, `Payment` and `Commission` rows for admin audit) globally, while Eurozone users will be routed to a dedicated GDPR-compliant pipeline in a future phase (see roadmap below).   | product decision / compliance                                                                                   |
| 6   | **Two address-printing log lines** remain in `users.service.ts` (profile e-mail change, password change).                                                                                                                                                                                                                                                       | `operation-service/src/users/users.service.ts`                                                                  |
| 7   | **`prisma/roles/roles.sql` looks out of date** (no `Drawing`, `DrawingAlert`, `RefreshToken`, which `operation-service` already writes). Worth reconciling with production after the grant check.                                                                                                                                                               | `prisma/roles/roles.sql`                                                                                        |

### Eurozone User Customization & GDPR Compliance Roadmap (Future Specification)

**Context & Legal Background:**
While Option B (soft delete, account deactivation, and admin audit trail) is enforced globally for all users currently, European Union / Eurozone users are protected under **GDPR Article 17 ("Right to Erasure / Right to be Forgotten")**. To balance the Right to be Forgotten with statutory retention mandates (e.g. EU accounting, anti-money laundering, and tax directives requiring 5–10 years retention of financial transaction records under GDPR Art. 17(3)(b)), Davin has decided on a tailored Eurozone deletion architecture for future development:

1. **User Jurisdiction Detection & Classification:**
   - Detect whether an account falls under Eurozone/EU jurisdiction via:
     - Billing country associated with Stripe / dLocal customer profiles (`country` code in EU/EEA).
     - Registration IP geolocation tagged at initial account creation.
     - User explicit residence setting in profile.
   - Users tagged with `jurisdiction: 'EU'` will trigger the Eurozone deletion workflow upon confirming account deletion.

2. **Differentiated Pipeline Execution (Option A Hybrid / Cryptographic Anonymization):**
   - **Phase 1 (Lockout & Grace Period):** Retains the standard 24-hour grace window allowing user cancellation. Immediate token revocation and session invalidation (`isActive = false`) occur exactly as in Option B.
   - **Phase 2 (Hard Delete & PII Scrubbing Worker):**
     - **Irreversible PII Anonymization:** For the core `User` row, personal identifiers will be permanently scrubbed:
       - `email` -> replaced with irreversible pseudonymous hash (e.g., `gdpr-deleted-[sha256]@deleted.davintrade.com`).
       - `name` / `firstName` / `lastName` -> replaced with `GDPR Anonymized User`.
       - `passwordHash` / `twoFactorSecret` / backup codes / phone numbers -> permanently set to `NULL`.
       - Linked third-party OAuth `Account` records -> hard deleted.
     - **Non-Statutory Artifact Hard Deletion:** All operational, analytical, and telemetry records (`Alert`, `DrawingAlert`, `Drawing`, `Notification`, `UserSession`, `Session`, `RefreshToken`, user preference settings) will be completely removed from the database (`DELETE CASCADE`).
     - **Statutory Financial Record Preservation:** `Payment` and `Commission` ledger rows will remain in the database to satisfy legal accounting requirements, but all direct links to identifiable personal information will point only to the pseudonymized `User` record.
     - **Worker Status:** The `AccountDeletionRequest` will be stamped as `COMPLETED_GDPR_ANONYMIZED`.

3. **Admin Dashboard Visibility:**
   - In the admin user interface (`app/admin/users`), Eurozone deleted accounts will display a distinct badge: **"GDPR Erased"** with a purple or neutral marker.
   - Sensitive personal information will be completely inaccessible, confirming to administrators that GDPR compliance has been fulfilled while preserving financial aggregates and balance sheet integrity.

### Pre-existing changes left untouched

`.claude/rules/security-overrides.md`, `app/upgrade/success/page.tsx`, `__tests__/pages/checkout/upgrade-success.test.tsx` and several `davintrade-*` documents were already modified or untracked when the session began. They are not part of this work and are not in the commit. The `lint-staged` hook keeps its own automatic backup stashes in the repository; none was created or removed by hand.

---

## 7. Sign-Off & Closeout Declaration

The account deletion pipeline (F21) is complete in code. Confirming a deletion locks the account on the next request in both stacks; cancelling inside 24 hours gives it back; after 24 hours a claimed, idempotent, all-or-nothing worker cancels billing, removes the live artifacts and stamps `deletedAt`, while the user, payment and commission records stay for the admin.

- **Security Boundary:** a deactivated account cannot sign in by password, OAuth, token login, 2FA or refresh, and an existing session or bearer token stops working within 30 seconds; a restricted Stripe key limits what a leak of the worker's environment could do.
- **Reliability:** the claim-first design makes a late cancel and the worker unable to both win; a failed billing call or database step leaves the request for the next run; each request is isolated.
- **Privacy:** the deletion path logs ids and counts only, never an address, a name or a token.
- **Not yet true in production:** nothing is pushed, the migration is not applied, the Stripe key is not created, and no real service has run any of it (section 5).

**Signed off by:**

- **Executor:** Claude Code (2026-10-19 session)
- **Report approved and commit ordered by:** Davin (`ripper7375`), by explicit paths, no push; **F21-F1 requested and its commit, with this manifest's, ordered by Davin**
- **Deploy / migration / push:** pending Davin
- **Date:** October 19, 2026
