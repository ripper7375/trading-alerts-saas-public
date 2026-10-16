# Real-database proofs for the NestJS Tier 2 fixes

Companion to [the execution hand-off](../2026-10-16-nestjs-tier0-tier2-execution.md). Each script runs the
**compiled** money-service (`cd money-service && npm run build`) against a **scratch** PostgreSQL and fires
10 to 20 callers at once, to show a race closed. Where it can, a script also runs the **old** algorithm as a
control (2.2 and 2.3), or the new code without its database guard (2.1, below), so that a pass means something:
the control must show the defect.

> **These scripts insert and delete rows. Never point them at a real database.** They connect to
> `postgresql://postgres@127.0.0.1:55432/t2` unless `PROOF_DATABASE_URL` says otherwise.

## Setup (once)

1. A scratch server, without Docker: the recipe in
   [database-traps.md](../../../.claude/architecture/database-traps.md) ("A real Postgres server without Docker").
   These runs used PostgreSQL 18.0 on port 55432, database `t2`.
2. The **before** schema (money-service's Prisma schema at the commit before this work):

   ```bash
   git show bd67b30c:money-service/prisma/schema.prisma > old-ms.prisma
   # a scratch prisma.config.mjs OUTSIDE the repo: export default { datasource: { url: 'postgresql://postgres@127.0.0.1:1/none' } };
   npx prisma migrate diff --config <scratch config> --from-empty --to-schema old-ms.prisma --script > old-ms.sql
   # keep the text from the first "-- CreateEnum"; apply with: psql -v ON_ERROR_STOP=1 -d t2 -f old-ms.sql
   ```

3. `seed-2.1-duplicates.sql` (a user, an affiliate, a code, and the two kinds of duplicate the migration must refuse).

## Run, in this order

| Step | Command                                                                                                                                                    | What it shows                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a    | `psql -d t2 -f preflight-2.1.sql`                                                                                                                          | The pre-flight queries find both duplicates.                                                                                                                                                                   |
| b    | `psql -d t2 -v ON_ERROR_STOP=1 -1 -f ../../../prisma/migrations/20261016000000_.../migration.sql`                                                          | The migration **refuses** (unique index cannot be built) and rolls back completely.                                                                                                                            |
| c    | `psql -d t2 -c "DELETE FROM \"Commission\" WHERE id IN ('k2','cb2')"`, then the same migration again                                                       | It applies. `prisma migrate diff --from-config-datasource --to-schema money-service/prisma/schema.prisma --exit-code` then exits 0 (no drift).                                                                 |
| d    | `node proof-2.1-stripe-dual-delivery.js`                                                                                                                   | 20 concurrent claims: 1 wins. The lease takes over a dead claim exactly once. 10 concurrent credits of one invoice: 1 row. Refund and dispute races: counters move once.                                       |
| e    | `node proof-2.2-affiliate-claim.js`                                                                                                                        | Control: the old dLocal conversion paid 10 times (earnings 100 to 370). The new one pays once.                                                                                                                 |
| f    | `psql -d t2 -f seed-2.3.sql && node proof-2.3-dlocal-riseworks-completion.js`                                                                              | Control: 10 outbox events and 10 notifications; the RiseWorks balance moved 10 times. New: once each; a later replay does not extend the subscription expiry.                                                  |
| g    | `psql -d t2 -c "SET session_replication_role = replica; INSERT INTO \"Subscription\"(...) 'u-ghost' ..."`, `node proof-2.4-subscription-updated-atomic.js` | An orphaned subscription: the tier write fails, the subscription change **rolls back**, the handler throws. (The ghost row is inserted under the replica role to skip the foreign key; see the script header.) |
| h    | `node proof-2.6-outbox-recovery.js`                                                                                                                        | Stale and legacy-stuck `PROCESSING` rows are delivered; a row claimed a minute ago is left alone; a failed delivery returns to `PENDING` with its claim time cleared.                                          |
| i    | `node proof-redis-command-forms.js`                                                                                                                        | The `SET ... EX/PX ... NX` forms of 2.7 and 2.9 (against `ioredis-mock`; **not** a real Redis, there is none on this machine).                                                                                 |

Negative control for the migration itself: drop `Commission_affiliateCodeId_stripeInvoiceId_key`, run step d again,
and the credit race fails with 10 commission rows (earnings 100 to 158). Recreate the index afterwards.

## Not covered here

Anything that needs a real Redis (the outbox consumer claim, the cron locks) is covered by unit tests against
in-memory stand-ins and by step i only. See the hand-off, "Not verified".
