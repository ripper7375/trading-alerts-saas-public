# Runbook — Deploying build step 5 (Engine 4 and Report 2, chapter 6)

**Scope:** the one migration (`20261010000000_add_engine4_tables`), the environment variables the routes need, and switching
`ENGINE4_REPORT2_ENABLED` on, with the checks after each step and how to switch it off again.
**Written:** 2026-10-10, at the close of build step 5 (parts 1 to 8), from the part hand-offs `docs/handoffs/2026-10-09-*-step5-part*.md` and
`2026-10-10-*-step5-part*.md`, the plan `2026-10-09-1357-step5-plan.md`, the migration's own header and the code.
**Who:** Davin. The Executor never applies a migration, deploys, enters a sign-in or touches production.
**Before you start:** the step 2, 3 and 4 runbooks (`deploy-stack-d-step2.md`, `deploy-stack-d-step3.md` §9) have been done far enough that
there are real cycles, a `symbol_specs` row and `synthesis_readings` rows to offer a setup from. This migration needs none of their migrations;
the routes need their data (§0).

> **Nothing here has been run against production.** Step 5 was built and tested on fixtures, a scratch PostgreSQL 18.0 and component tests. Where a
> step says "expect", that is the expectation from the tests, not an observation. **A consent row cannot be deleted** (§4): do not press Accept
> on a production account to see what happens.

## 0. What exists, what does not

| Piece                                                                                                          | State after part 8                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/engine4/` (sizing, levels, stops, badge, offer, blackout, validator, modal definition, stores, templates) | Built and tested; imported only by the routes and the components                                                                                                  |
| `app/api/engine4/{profile,offer,size,consent}/route.ts`                                                        | Built. **404 for everybody unless `ENGINE4_REPORT2_ENABLED` is exactly `true`** (set nowhere)                                                                     |
| `components/report2/` (the Trade Setup modal and the card)                                                     | Built. **Nothing in the product opens it** (there is no Report 1 and no chat until step 7); `app/dev/report2` shows it locally and answers 404 in production      |
| Migration `20261010000000_add_engine4_tables`                                                                  | A file. Verified on a scratch PostgreSQL 18.0 with zero drift. **Not applied anywhere**                                                                           |
| Worked examples (`__tests__/lib/engine4/worked-examples/`)                                                     | Ten, made by the independent oracle, **all APPROVED by Davin on 2026-10-11** (§6)                                                                                 |
| **The Tier-1 event ids (D13)**                                                                                 | **Not given.** `config/engine4/tier1-events.json` ships empty, so every offer is "not offered: calendar list not set" (fails closed)                              |
| **A `symbol_specs` producer (F9)**                                                                             | **Not running.** The MQL5 exporter of step 2 part 8 is not compiled. Without a row less than 7 days old every offer is "not offered: SPECS_MISSING / SPECS_STALE" |
| Counsel's disclaimer and consent wording (D14); a native read of the 17 translations                           | **Not done.** The texts are `draft-1`; nine are named in `DRAFT_TEXT_KEYS`                                                                                        |
| A unique `submission_id` column; a retention job; a rate limit; an `Origin` check                              | **Not built.** See §1 (the column must be decided before the migration is applied), §4                                                                            |

## The order at a glance

| #   | Step                                                            | What it proves                                                                   | Waits on                        |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| E0  | Decide the open file changes; find the database that has `User` | The migration is the one you want and goes to the right database                 | Your decisions (§1)             |
| E1  | Apply the migration alone and check it                          | Three tables, 32 CHECKs, four triggers; nothing reads or writes them yet         | E0                              |
| E2  | Environment variables                                           | The stores can write; the live status and the submit guard are reachable         | E1 (the key may be set earlier) |
| E3  | The data the offer needs                                        | A real cycle, a fresh `symbol_specs` row, `synthesis_readings`, the Tier-1 ids   | Steps 2 to 4 live; D13; F9      |
| E4  | The two gated specs on a scratch PostgreSQL                     | The tables and the routes work against a real database                           | A scratch server                |
| E5  | Switch the flag on and look                                     | Each route answers as designed for a signed-out user, a Free user and a Pro user | E1 to E4                        |
| E6  | Roll back                                                       | The flag off hides everything; the tables can go only while empty                | —                               |

**Stop conditions.** Stop, change nothing further, and tell the Advisor if: `prisma migrate status` shows a migration pending that you did not expect
(§1); the migration fails part-way (§1); the check in §1 does not give 3 tables, 32 CHECKs and 4 triggers; a route answers anything but a 404 while the flag is
off; or an offer in production is "offered" with the Tier-1 list empty (it must not be: report it).

---

## 1. E0 and E1 — The migration

`prisma/migrations/20261010000000_add_engine4_tables/migration.sql` (its header has the same recipe and the rollback).

| Table                            | What it holds                                                                                                                                     | After deleting a `User`                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `user_trade_preferences`         | The **current** profile, eight figures as canonical text, one row per user (9 CHECKs)                                                             | The row is deleted (`ON DELETE CASCADE`)                    |
| `user_trade_preferences_history` | One **append-only** snapshot per change to the profile (11 CHECKs)                                                                                | `user_id` becomes NULL; the HMAC hash and every column stay |
| `trade_consent_records`          | One **append-only** row per Accept, Modify or Decline: the whole `ValidatedSetup` as hashed text, its SHA-256, the snapshot, versions (12 CHECKs) | Same                                                        |

It is additive: three tables, seven indexes, foreign keys that only reference `"User"`, 32 CHECKs and one trigger function with four triggers. It touches nothing that
exists and writes no data, so it is safe to apply while the app runs.

**E0a — Decide first: a unique `submission_id` column.** Part 6 guards "one submit, one record" with a Redis key that **fails open** when Redis is down, so two
racing presses can then write two identical rows, and the rows can never be removed. A `submission_id TEXT` column with `UNIQUE (user_id_hash, submission_id)` makes a
double press impossible whatever Redis does. The Executor recommends it **before the flag goes live**; it is a change to this still-unapplied file (and a re-run of
part 5's tests and mutation check, not a new migration). If you want it, order that change **before** you apply the file: after it is applied, the column is another
migration. If you accept the Redis guard as built, say so and carry on.

**E0b — Which database has `User`?** The foreign keys reference `"User"`, so the file must be applied to the database that holds it. `prisma.production.config.ts`
(its header, "SCOPE NOTE") says it is **not verified** whether the Vercel app's own tables and the gateway's `trading-alerts` Postgres are one database. Check
Vercel → Settings → Environment Variables → `DIRECT_URL`'s host before assuming the production config reaches the right one. The readers of the market tables
(`marketPrisma`) and the stores of these tables (`prisma`) may be two databases; both must be reachable from where the routes run.

**Read-only first** (production config only, never the default one; see the step 2 runbook §1.3 for `.env.production.local`):

```bash
npx prisma migrate status --config prisma.production.config.ts
```

`migrate deploy` applies **every** pending migration in history order; `20261002000000`, `20261003000000` and `20261004000000` may still be pending. This migration
depends on none of them, so apply it alone:

```bash
npx prisma db execute --file prisma/migrations/20261010000000_add_engine4_tables/migration.sql --config prisma.production.config.ts
npx prisma migrate resolve --applied 20261010000000_add_engine4_tables --config prisma.production.config.ts
```

**Check it (read-only):**

```sql
SELECT to_regclass('public.user_trade_preferences'), to_regclass('public.user_trade_preferences_history'), to_regclass('public.trade_consent_records');   -- none NULL
SELECT conrelid::regclass AS "table", count(*) AS checks
  FROM pg_constraint
 WHERE contype = 'c'
   AND conrelid IN ('user_trade_preferences'::regclass, 'user_trade_preferences_history'::regclass, 'trade_consent_records'::regclass)
 GROUP BY 1 ORDER BY 1;   -- 9, 11 and 12: 32 in all
SELECT tgname FROM pg_trigger
 WHERE NOT tgisinternal AND tgrelid IN ('user_trade_preferences_history'::regclass, 'trade_consent_records'::regclass)
 ORDER BY 1;   -- four rows: *_append_only and *_no_truncate for each audit table
```

If it fails part-way the tables are independent and unread: drop whichever exist (`DROP TABLE trade_consent_records, user_trade_preferences, user_trade_preferences_history;
DROP FUNCTION engine4_audit_append_only();`) and stop. **Roll back only while the tables are empty**: the audit tables hold legal records and the trigger does not stop a `DROP TABLE`,
so count the rows first (`SELECT count(*) FROM trade_consent_records;`). Then `prisma migrate resolve --rolled-back 20261010000000_add_engine4_tables`.

---

## 2. E2 — Environment variables

Set these where the routes run (Vercel, Production). None is in the repository, and the Executor never sees a value.

| Variable                                       | Value                                                                                              | Without it                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ENGINE4_AUDIT_HMAC_KEY`                       | A secret of **at least 32 characters**; for example `openssl rand -base64 48`                      | Every write is refused and `consent` answers 503. **Only `NODE_ENV=test` falls back to a public key**; production never does |
| `ENGINE4_AUDIT_HMAC_KEY_VERSION`               | A whole number from 1 to 999999999; **1 for the first key**                                        | Defaults to 1                                                                                                                |
| `REDIS_URL`                                    | The shared Redis (the one `lib/idempotency` and the FX rates use)                                  | The one-submit guard does nothing (it fails open); nothing else breaks                                                       |
| `MARKET_GATEWAY_URL`, `MARKET_GATEWAY_API_KEY` | The gateway's base URL and one key from its `API_KEYS` (the same pair `lib/active-indicator` uses) | The live data status is unknown, so every offer is "not offered: DATA_STATUS_UNKNOWN" (it fails closed)                      |
| `DATABASE_URL`, `DIRECT_URL`                   | Already set                                                                                        | —                                                                                                                            |
| `ENGINE4_REPORT2_ENABLED`                      | `true` — **last, in §5**                                                                           | The four routes answer 404 `FEATURE_DISABLED` to everybody                                                                   |

**The key.** Keep it in your password manager. Losing it loses no data: old rows keep their hash and their key version, but you can no longer _recognise_ an old hash.
**To rotate:** set a new key and a **higher** `ENGINE4_AUDIT_HMAC_KEY_VERSION`; old rows keep the hash and version they were written with (a rotation never recomputes one;
`verifyUserHash` answers `OTHER_KEY_VERSION` rather than guess), and recognising an old hash needs the old key, which you keep.

---

## 3. E3 — The data the offer reads

An offer is "offered" only when every one of these is true; each missing piece makes it **not offered**, never a guess.

| Needed                                                                    | How to see it                                                                                                                                           | If missing, the answer is                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A real cycle, FRESH or DELAYED, and its `synthesis_readings` row          | Steps 2 to 4 live; `SYN` at `shadow` or `live` (`deploy-stack-d-step3.md` §9). A `shadow` reading is offered like a `live` one and the flag is reported | `SYNTHESIS_UNUSABLE`, `DATA_STALE`, `MARKET_CLOSED`          |
| `entry_zones` for the pinned reading and the stored bundle (≤ 90 days)    | Step 4's tables (`20261004000000`), the same runs                                                                                                       | `NO_ZONES`; the stops degrade to the zone's own invalidation |
| **A `symbol_specs` row ≤ 7 days old**                                     | The MQL5 exporter (step 2 part 8) compiled and attached on **both** terminals A and B                                                                   | `SPECS_MISSING`, `SPECS_STALE`, `SPECS_FROM_THE_FUTURE`      |
| **The four Tier-1 event ids (D13)** in `config/engine4/tier1-events.json` | Run the read-only query of `docs/handoffs/2026-10-09-2340-step5-part3.md` §9 on the production `economic_events`; give the ids; raise `listVersion`     | `CALENDAR_LIST_NOT_SET` (every offer)                        |
| A news calendar that has been exported                                    | `economic_events` has rows (live since 11 Sep); a calendar older than 45 minutes still blocks and shows its age                                         | `CALENDAR_EMPTY`, `CALENDAR_UNAVAILABLE`                     |

When the ids are in the config file, three tests that document the empty state change in the same commit: `tier1-config.test.ts` ("ships EMPTY") and two in `read/events.test.ts`.

---

## 4. E4 — Run the two gated specs once on a scratch PostgreSQL

They were written for this and were **not run** in the last two sessions. They are skipped without the two variables and wipe the three tables, so use a scratch server and run them one after the other.
The recipe (the database must hold the non-market schema as it was before this migration, plus the migration file, and nothing else) is in `.claude/architecture/database-traps.md`
("The Engine 4 tables" and "The Engine 4 routes").

```bash
CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
  npx jest -i --testMatch '**/__tests__/engine4/*.pg.spec.ts' --coverage=false
```

Expect 189 of 189 (181 for the tables, 8 for the routes). One test shells out to `prisma migrate diff --exit-code` (0 = no drift).

**Why this matters before production:** a consent row written by a test is harmless on a scratch server; **on production it stays for seven years** (the trigger refuses
`UPDATE`, `DELETE` and `TRUNCATE`; only the account-id column can go to NULL). There is no retention job and no way to remove a test row. Preview deployments use the
production database, so a Preview with the flag on writes real records too.

---

## 5. E5 — Switching the flag on

Only when E1 to E3 are done and you have chosen your answers on counsel's wording (D14) and the translations. They are drafts: the three compulsory notices, the three buttons
and the three outcomes (`DRAFT_TEXT_KEYS` in `lib/engine4/templates/text.ts`) are counsel's to replace, and the other 168 words have had no native read. Traders see them.

**1. With the flag still off** (expect a 404 from every route, signed in or not):

```bash
curl -s -i -X POST https://<host>/api/engine4/offer -H 'content-type: application/json' -d '{}' | head -20
# HTTP/1.1 404, body code FEATURE_DISABLED
```

**2. Set `ENGINE4_REPORT2_ENABLED=true`** on Production and redeploy (a Vercel environment variable needs a redeploy). The order of refusal is fixed: flag (404), session (401), tier (403).

| Who calls                               | Expect                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Nobody signed in                        | `401`                                                                                                                                           |
| A Free account                          | `403` (Pro only; a missing or unknown tier counts as Free)                                                                                      |
| A Pro account with no confirmed profile | `GET /api/engine4/profile` answers the defaults with `stored: false`; `offer`, `size` and `consent` answer `409 PROFILE_NOT_SET`                |
| A Pro account with a profile            | `offer` answers OFFERED with its pills and the notices, or NOT_OFFERED with **one** reason (the first in table order) and the rest in the trace |

**3. Sign in yourself** (the Executor never does) as a Pro account and, in the browser's network tab, look at `POST /api/engine4/offer` and `POST /api/engine4/size`. These two write nothing.
Check the 18 Sep rules against whatever the live cycle says: the pills equal the zones' reference prices, the lot is rounded **down**, declared and actual risk are both shown, a CAUTIONARY
cycle pre-sets half the risk, and a Tier-1 release inside ±15 minutes is "not offered". **Do not press Accept, Modify or Decline on production** unless you mean to keep the row.

**4. If the offer is "not offered" for the wrong reason**, the reason code names the missing piece (§3). That is the system working, not a fault.

## 6. The worked examples and the release gate

`__tests__/lib/engine4/worked-examples/` holds ten examples made by `scripts/engine4/oracle.py` and `scripts/engine4/worked_examples.py`. Each folder has
`review.md` (the tables to read) and `approval.json` (PENDING). To approve one, edit its `approval.json`: `status` to `APPROVED`, `approved_by`, `approved_on`
(YYYY-MM-DD); leave the hashes. The gate is

```bash
python scripts/engine4/worked_examples.py check --require-approved      # exit 1 while any example is PENDING
ENGINE4_REQUIRE_APPROVED=1 npx jest __tests__/lib/engine4/worked-examples.test.ts --coverage=false
```

## 7. E6 — Switching it off again

- **Hide everything:** remove `ENGINE4_REPORT2_ENABLED` or set it to anything but `true`, and redeploy. All four routes answer 404 at once. Nothing else depends on them.
- **Rows already written stay.** The profile tables and the consent record are append-only and kept for seven years; a deleted account leaves its rows with a NULL id and a hash.
- **The tables** can be dropped only while empty (§1).

## 8. What is still open after this runbook

D13 (the Tier-1 ids) · F9 (the `symbol_specs` exporter) · D14 (counsel) and a native read of the translations · the `submission_id` column (§1, E0a) · the 7-year retention job (the trigger forbids a `DELETE`) ·
no rate limit and no `Origin` check on the routes · each offer, size and consent reads and unzips about 1 MB of stored bundle (not measured) · the account-deletion job (F21) ·
the two gated specs (§4) · a session B check of build step 5.
