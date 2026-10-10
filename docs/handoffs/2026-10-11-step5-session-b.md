# Hand-off: build step 5 session B (check) · 2026-10-10 20:39 UTC (2026-10-11 local)

Session: B (check) · Task: session B for build step 5 (Chapter 6, Engine 4 and Report 2)

**Verdict: all 8 items of §6.14 are met. No failure found. Sign-off for build step 5.** The check
changed nothing in the repository; this report is the only file added.

Checked against: `main` at `a594c289` (parts 1 to 8; 2 commits ahead of `origin/main` at the start). The
working tree of `lib/engine4`, `__tests__`, `scripts/engine4`, `prisma`, `app`, `components`, `config`
and the docs of step 5 was identical to `HEAD`.

## 1. Done in this session

- Read chapter 6 and section 7.10 of `docs/STACK-D-ARCHITECTURE.md`.
- Checked each of the 8 "Done when" items of §6.14 against the code and the tests (open the code, run
  the tests; section 4 below).
- Ran the three commands of the prompt, and the component and API suites the items depend on.
- Ran the two gated PostgreSQL specs on a scratch PostgreSQL 18 of my own, and wrote an independent SQL
  scenario for item 8 (section 3).
- Recomputed the §6.7 table and the §6.5 example by hand.

## 2. Files changed

| Path                                          | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `docs/handoffs/2026-10-11-step5-session-b.md` | This report. The only repository change. |

Side effect to disclose: Jest's coverage run rewrote the git-ignored `coverage/lcov.info`. `tsc --noEmit` did
not touch either `tsconfig.tsbuildinfo` (their timestamps pre-date the session). `current-state.md` and
`waiting-on.md` were not touched (the Advisor writes the next prompt from this report).

## 3. Tests and commands run, with results

| Command                                                                                                                | Result                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `python scripts/engine4/worked_examples.py check --require-approved`                                                   | Exit 0. 10 examples, 10 approved, 0 pending, 0 problems.                          |
| `ENGINE4_REQUIRE_APPROVED=1 npx jest __tests__/lib/engine4/`                                                           | 46 of 46 suites, 3941 of 3941 tests pass. **The process exits 1** (note A below). |
| the same with `--coverage=false`                                                                                       | 46 of 46 suites, 3941 of 3941 tests, exit 0.                                      |
| `npx tsc --noEmit`                                                                                                     | Exit 0, no errors (about 50 s).                                                   |
| `ENGINE4_REQUIRE_APPROVED=1 npx jest __tests__/components/report2/ __tests__/api/engine4/`                             | 15 of 15 suites, 579 of 579 tests pass (exit 1 for the same coverage reason).     |
| gated specs `__tests__/engine4/*.pg.spec.ts`, `jest -i --testMatch ... --coverage=false`, on a scratch PostgreSQL 18.0 | 2 of 2 suites, **189 of 189** tests, none skipped (the builder's count was 189).  |
| independent SQL scenario for item 8 (`psql`, scratch database)                                                         | see item 8 below.                                                                 |

The scratch PostgreSQL: its own `initdb` cluster in the session scratchpad on 127.0.0.1:55433 (not the Windows
service, not the leftover `e4pg6` folder in `%TEMP%`, no `.env` file), the pre-part-5 non-market schema from
`git show 19b8b216^:prisma/non-market-data/schema.prisma` through a scratch Prisma config outside the repo,
then the migration file itself. Stopped and deleted at the end; the port is closed.

## 4. "Done when" items (§6.14), with evidence

| #   | Item                                                                                                           | Evidence (checked in this session)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verdict      |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 1   | Releases at -16, -14, +14, +16 minutes give allowed, blocked, blocked, allowed                                 | `__tests__/lib/engine4/blackout.test.ts:103` runs the four offsets; `:117` the inclusive edges (-15:01 clear, -15:00 and +15:00 blocked, +15:01 clear); `:202` the same four offsets at six release times across the 1 Nov 2026 US daylight-saving change. Worked example 08 (16 probes, 9 blocked, 7 clear) is APPROVED and matches the engine.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Met          |
| 2   | The corrected table runs as a unit test; this document and the code agree                                      | The 22.60 / 2567.60 / 135.36, 26.36 / 2571.36 / 157.92 and 30.12 / 2575.12 / 180.48 figures are the same in §6.7, `sizing.test.ts:70`, the oracle fixture (`sizing.test.ts:88`) and worked example 01. I recomputed: lot 100/1504 = 0.0665 -> 0.06, actual risk 0.06 x 1504 = 90.24, leverage 1.527, 1.5x distance 22.5 + 4 x 2.5/100 = 22.60, net 135.36 = 1.5 x 90.24. The §6.8 figures ($509.00, $3,008.00, $2,911.47, $5,885.34, 1.77%) also match examples 04, 05 and 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Met          |
| 3   | A CAUTIONARY cycle pre-sets half the risk; an override shows in the consent record                             | Half preset: `modal-definition.test.ts:59` and `:172` (0.75 of 1.50, with the reasons), `validate.test.ts:1062`. Override up to Max RPT recorded, above Max RPT refused with no override: `validate.test.ts:1083` to `:1105`. In the consent row: `__tests__/api/engine4/consent.test.ts:232` (`overrides.defectFlag` = preset 0.75, chosen 1.5, reasons) and, on a real database, `engine4-routes.pg.spec.ts:359`. Example 07 is APPROVED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Met          |
| 4   | On the stored 18 Sep example (Z1, entry 4367.20) no badge is given and M15 `sr_1` 4369.57, 2.37 away, is named | `room.test.ts:121` (level 4369.57, room 2.37); `badge.test.ts:156` (`NO_SCENARIO_FITS`); `__tests__/components/report2/report2-card.test.tsx:51` (the card shows "No badge", names `sr_1 at 4,369.57, 2.37 away`, and does not show the old 4384.28). Example 02 is APPROVED and `check` confirms its figures still equal the stored cycle. I recomputed the Conservative target: 1.5 x 16.78 + 0.10 = 25.27, so 4392.47, past the level.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Met          |
| 5   | No offered underflow option exceeds Max RPT or asks for a different equity                                     | `lib/engine4/underflow.ts:75` rounds the raise UP to 0.01% and `:76` compares the ROUNDED figure with Max RPT, so an offered value can never exceed it. Only `RAISE_RISK`, `NEARER_STRUCTURAL_STOP` and `DECLINE` exist; equity is a fact, never an option. `validate.ts:468` passes the profile's Max RPT. `properties.test.ts:467` checks every generated underflow (no option above Max RPT, below Min SLD or carrying an equity or leverage key; more than 20 offers seen); `:501` re-sizes every offer taken; `underflow.test.ts:99` to `:150` pin the boundary (2.00% offered, a cent above it not). No "Set equity" text remains in `lib`, `components` or `app`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Met          |
| 6   | The same setup typed in chat and entered in the modal gives identical results                                  | `validate.test.ts:1151` (modal text, chat numbers, loose chat text and a bare pick give the same serialised text; also a custom entry, a SELL and a refusal). At the route: `__tests__/api/engine4/size.test.ts:314` (text from the modal and numbers from chat give the same setup and the same SHA-256). `api-parity.test.ts:259` is a different parity: the real routes against the component stand-in, byte for byte.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Met (note B) |
| 7   | Changing contract size or lot step in `symbol_specs` changes the lot with no code change                       | `sizing.test.ts:333` to `:358` (a 10-ounce contract gives 0.64; steps of 0.001 and 0.05 change the lot; a 1,000-ounce contract or a 0.1 minimum makes the §6.7 example an underflow). The oracle fixture holds `spec-change-contract-10` and `spec-change-step-0.1`. No contract size, lot step or minimum is hard-coded outside `sizing.ts`, `broker.ts`, `types.ts`, `underflow.ts` and the column list of `read/specs.ts`. The path is the `symbol_specs` row -> `readBrokerFigures` -> `validate.ts:463` -> `sizeSetup`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Met          |
| 8   | Deleting a test account keeps its hashed history and consent rows                                              | Design: `ON DELETE SET NULL` on `user_trade_preferences_history.user_id` (`migration.sql:135`) and `trade_consent_records.user_id` (`:138`); hash, key version and the other columns are plain columns; the append-only function (`:301`) lets one UPDATE through, `user_id` from a value to NULL with every other column equal, and refuses every other UPDATE, DELETE and TRUNCATE (23001). `schema.prisma` has the same rules. Runtime: the 189 gated tests pass, including "deleting a User (the point of the design)" and the plain-SQL `DELETE FROM "User"` test. **Independent SQL scenario** (my own, on PostgreSQL 18): one user, a snapshot, a current profile and an ACCEPT consent row with an override. Seven tamper attempts were each refused with 23001 (consent UPDATE of a column, consent UPDATE of the hash, consent DELETE, history UPDATE, history DELETE, consent TRUNCATE, re-owning a consent row). After `DELETE FROM "User"`: current profile 0 rows; history 1 row and consent 1 row, `user_id` NULL, hash intact, key version 3, `override_chosen` 1.5 and the reasons intact; a DELETE of the orphaned consent row is still refused. | Met (note C) |

## 5. Not finished

Nothing remains of the build step 5 check. Open items that belong to Davin, not to this check (all already
in the part 8 hand-off or the runbook `docs/runbooks/deploy-stack-d-step5.md`):

1. Deploy in the order of the runbook, with the migration `20261010000000_add_engine4_tables` applied first
   (never applied by this session).
2. Supply the four Tier-1 event ids (decision D13); until then every offer is "not offered: calendar list
   not set" by design (fails closed).
3. Provision `ENGINE4_AUDIT_HMAC_KEY` and `ENGINE4_AUDIT_HMAC_KEY_VERSION` before any route writes.

## 6. Decisions needed from Davin

1. **The Jest exit code (note A).** Options: leave it (every subset run of Jest exits 1 in this repo today, so
   it is not specific to step 5); pass `--coverage=false` in the step's verification command; or exempt the
   subset in `jest.config.js`. I recommend the second, which changes no file. Nothing blocks on it.
2. **The account-deletion job (note C).** The app has no production code that deletes a `User` yet (only
   `lib/db/seed.ts` and `app/api/test/seed/route.ts` do). It needs a decision when it is written: it must
   delete the `User` row for the `SET NULL` to fire.

## 7. Problems and surprises the next session must know

- **A. The command's exit code.** `ENGINE4_REQUIRE_APPROVED=1 npx jest __tests__/lib/engine4/` exits 1 although
  all 3941 tests pass: `jest.config.js` has a global coverage threshold (18% statements and lines, 15% functions)
  and a subset reaches 9.84%. The same command with `--coverage=false` exits 0. A background-task wrapper that
  appends `echo` to the command reports 0 whatever Jest returned; read the exit code from the output file.
- **B. Item 6 mapping.** The prompt named `api-parity.test.ts` for item 6; that file checks the real routes
  against the component stand-in. The modal-versus-chat proof is `validate.test.ts:1151` and `size.test.ts:314`.
  The real chat extraction (section 4 of the architecture, build step 6) does not exist yet, so "chat" in these
  tests means numbers and loose text given to the same validator. That is what §6.10 asks to be proved now.
- **C. The gated pg specs are not part of the three commands.** They are skipped without `CYCLE_PG_URL` and
  `CYCLE_PG_ALLOW_WIPE=yes`, and the part 8 hand-off says they were not re-run in that part. They were run here
  (189 of 189). Item 8 is only proved at the database level; the application never deletes a user yet (decision 2).
- **D.** The Windows machine has PostgreSQL 18 binaries at `C:\Program Files\PostgreSQL\18\bin`; the recipe in
  the header of `engine4-tables.pg.spec.ts` worked unchanged apart from the port (55433 here).
- **E.** Not in scope and not checked: the `davintrade-mobile-app/` TypeScript errors the part 5 hand-off
  mentions (the root `tsc` is clean in this checkout), `npm run lint`, and the full root Jest suite.

## 8. State

- Last commit before this report: `a594c289` (`feat(engine4): Step 5 part 8 ...`), on `main`, 2 commits ahead of
  `origin/main`. This report is committed on top of it, locally, and not pushed.
- Migrations written but not applied: `20261002000000_add_cycle_pipeline_tables`,
  `20261003000000_add_sensor_tables`, `20261004000000_add_synthesis_tables`,
  `20261010000000_add_engine4_tables`.
- Services changed: none. Nothing deployed. The scratch PostgreSQL cluster is stopped and deleted.

## 9. Suggested next task

Davin takes decision 1 above and works the runbook's pre-deploy items (migration, the Tier-1 ids, the HMAC key).
After that, the next build step of the roadmap in §7.10 is **step 6, Section 4 (Intake and knowledge)**: session A
with a plan first. An optional pre-deploy session could re-run the gated pg specs against a copy of production
data once the migration is applied there.
