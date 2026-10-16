# Runbook — Deploying build step 7 (prompt and AI reply, chapter 5) and staging its flags

**Scope:** the two migrations of this step, the secrets, the first contact with OpenRouter, the live evaluation run, the measurement that sets the Pro
allowance, the readings and approvals that must come before any trader sees a model's words, the live cycle flow, the archive question, the one-week staging on
your own account, and the activation, with the checks after each stage and how to switch everything off again.
**Written:** 2026-10-16, at the close of build step 7 (parts 1 to 10), from the part hand-offs `docs/handoffs/2026-10-1[456]-step7-part*.md`, the plan
`2026-10-14-step7-plan.md`, ADR-099 and the code.
**Who:** Davin. The Executor never deploys, enters a sign-in, sets a variable in Vercel or Railway, applies a production migration or touches production.

## ⛔ The rule: no flag is turned on in production before S9, and S9 needs everything above it

Nothing in step 7 is switched on. `REPLY_ENABLED` is **set nowhere**; every route of the chat answers **404 to everybody** until it is exactly `true`
(`TRUE`, `1` and ` true` are off). `INTAKE_ENABLED` stays `false` for good: `/api/intake` and `/api/intake/instant` call the Understand model with no
hold, so they are dev-only tools (ADR-099 D8) and `isIntakeEnabled` is false in any production build, a Vercel preview included.

> **A Vercel preview deployment reaches the production database** (`waiting-on.md`, "Preview deployments hit the production DB"). Do not turn any flag of
> this runbook on for a preview.

> **Nothing here has been run against production, or against a real model.** Step 7 was built and tested on fixtures, the 16 golden cycles, a fixture model
> and a scratch PostgreSQL 18.1. **No key exists and no model was ever called.** The recorded evaluation run in the repository is a **STAND-IN**: the fixture
> model's replies, written by the test harness. It shows the mechanism and measures nothing about a model, a language or a price, and the release gate
> refuses it as evidence by name. Where a step says "expect", that is the expectation from the tests, not an observation.

## 0. What exists, what does not

| Piece                                                                                                                 | State after part 10                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/reply/` (contracts, context, gateway, checks, gate, Report 1, meter, orchestrator)                               | Built and tested. **404 for everybody unless `REPLY_ENABLED` is exactly `true`** (set nowhere)                                                                                                         |
| `POST /api/chat/message`, `GET /api/chat/threads`, `GET\|PATCH\|DELETE /api/chat/threads/[id]`, `GET /api/chat/state` | Built. 404 while the flag is off                                                                                                                                                                       |
| Panels A, B, C (`components/chat/`, `components/charts/`)                                                             | Built, one chat for the three panels. Off, the chat reads nothing and says it is not switched on; the badges are what they were                                                                        |
| Migrations `20261014000000_add_reply_trace_and_chat_tables`, `20261014010000_add_ai_metering_tables`                  | **Files, applied to no real database.** `request_traces`, `chat_threads`, `chat_messages`, `ai_quota_periods`, `ai_usage_reservations`                                                                 |
| `config/ai-models.ts`                                                                                                 | Six **candidates**, every row an unverified placeholder on the safe side, **no model `passed`, no launch pair** (D1)                                                                                   |
| `OPENROUTER_API_KEY`, the spend cap, the HMAC key                                                                     | **None exists.** No key is set anywhere                                                                                                                                                                |
| `PRO_MONTHLY_UNITS`                                                                                                   | **Unset**: the ledger refuses every request (fail closed)                                                                                                                                              |
| The golden scenarios (`config/reply/golden/`)                                                                         | Written (34 scenarios, 680 cells a pass). `approval.json` **PENDING**                                                                                                                                  |
| The recorded runs (`config/reply/eval-runs/`)                                                                         | One: `stand-in.json`, a **STAND-IN**. No live run exists                                                                                                                                               |
| The Free recording (`config/reply/demo/`)                                                                             | 19 files **made from the stand-in run**. `approval.json` **PENDING**. **`loadDemo` shows a trader nothing until the files are approved AND come from a live run**: today Free sees "not available yet" |
| The 17 wording lists, 17 invalidation lines, the static prompt, the `chat.*` texts                                    | **My drafts**, no native reader and no counsel has seen them (Appendix D). The wording lists and the prompt have a `review.md` and a PENDING `approval.json`                                           |
| The archive for `request_traces` (D17)                                                                                | **Does not exist.** A database trigger refuses to delete an unarchived trace, so nothing can be lost; rows stay in PostgreSQL                                                                          |
| The scheduler for `reapExpired`                                                                                       | **Not scheduled** (it needs ONE scheduler). A prerequisite of S8                                                                                                                                       |
| The live sensors (Phase B)                                                                                            | **Not running in production**: with every sensor flag `off` the board is empty and a working chat has nothing to say (plan R1)                                                                         |

## The order at a glance

| #   | Step                                              | What it proves                                                                                                                  | Waits on                             |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| S0  | Migrations check and secrets                      | The two tables exist and are empty; the keys exist and the spend cap is set                                                     | Your decisions D5, D17               |
| S1  | Gateway smoke and model verification              | What OpenRouter serves, at what price, with which features and providers; the registry rows are verified and dated              | S0, a key, the spend cap (D1, D5)    |
| S2  | The live evaluation run for the shortlisted pair  | A model passes or fails the bars of 5.10 on the golden scenarios; the pair is set `passed`                                      | S1, the golden scenarios signed, D25 |
| S3  | `measure-units` calibration                       | Units per first message, instant prompt and (from traces) follow-up, per model; the estimator's error                           | S2, then S8's first days             |
| S4  | Set `PRO_MONTHLY_UNITS` and the model-spend share | The ledger lets a Pro trader ask; the pricing page says an allowance, not a token number                                        | S3, your price and share (D4)        |
| S5  | Native readers and counsel                        | Each area has an `approval.json` that says APPROVED: the wording lists, the invalidation lines, the prompt, the texts, the demo | People who read 17 languages         |
| S6  | The cycles flow (Phase B)                         | Live sensors and SYN `live`: the board has something to say                                                                     | `deploy-stack-d-step3.md` B0 to B5   |
| S7  | The archive and the retention job                 | Traces older than 90 days are archived before anything is deleted, or you decide to keep them in PostgreSQL meanwhile           | D17                                  |
| S8  | Staging on your own account                       | A week of real use: violation rates, cost, p90 times, the five alerts' inputs, the reaper                                       | S0 to S7 as you decide               |
| S9  | Production activation                             | Every Pro trader has the chat and the badges feed Panel B                                                                       | S8 looked sane                       |

**Stop conditions.** Stop, change nothing further, and tell the Advisor if: `prisma migrate status` lists a migration you did not expect; a table of S0 has rows
before anything wrote to it; a smoke call answers from a host that keeps or trains on prompts (ADR-077); the live run's cost is above the cap you set or the
service reports no cost at all; the gate test is red after you edited the registry; the ledger audit (S8) finds `used + reserved > limit`, a `RESERVED` row older
than ten minutes, or a settled line with no trace; a violation rate above 2% of replies in a day; any wording that makes a promise about the market.

## 1. S0 — Migrations and secrets

**Migrations (read-only first).** Against production, from a laptop, through `DATABASE_PUBLIC_URL` (never the private URL), by you:

```bash
npx prisma migrate status
```

Expect the **pending** list to hold these in history order (some of them may already be applied; steps 2 to 5 are listed in their own runbooks and none of
them is needed by this step beyond `"User"`):

```
20261002000000_add_cycle_pipeline_tables   20261003000000_add_sensor_tables   20261004000000_add_synthesis_tables
20261010000000_add_engine4_tables          20261014000000_add_reply_trace_and_chat_tables   20261014010000_add_ai_metering_tables
```

`prisma migrate deploy` applies **every** pending migration. To apply only this step's two, in this order, read the **ROLLOUT ORDER** paragraph of each file's header
(`prisma db execute --file <file>`, then `prisma migrate resolve --applied <name>`). Both are additive: they create tables, indexes, foreign keys to `"User"`, CHECK
constraints and two trigger functions, and write no data.

Then count rows. Every count must be zero:

```sql
SELECT 'request_traces' AS t, count(*) FROM request_traces UNION ALL
SELECT 'chat_threads', count(*) FROM chat_threads UNION ALL
SELECT 'chat_messages', count(*) FROM chat_messages UNION ALL
SELECT 'ai_quota_periods', count(*) FROM ai_quota_periods UNION ALL
SELECT 'ai_usage_reservations', count(*) FROM ai_usage_reservations;
```

**Check the production PostgreSQL version** and run the `pgbench` load test of `environment-gotchas.md` against it before S4: the ledger SQL met two defects on a real
PostgreSQL 18.1 that no model of the tables could show (a settlement could fail its CHECK under concurrency; the reaper lost period updates of a statement over several
periods). Part 6's hand-off, section 8, has the two regression tests and the three rules for any new ledger SQL.

**Secrets** (Vercel, production, and nothing in the repository):

| Variable                                                   | What                                                                                                      | Notes                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `OPENROUTER_API_KEY`                                       | The one key. `INTAKE_UNDERSTAND_API_KEY` is kept as an alias                                              | Set a **monthly spend cap on the OpenRouter account before S1** (D5). The key appears only in the `Authorization` header |
| `ENGINE4_AUDIT_HMAC_KEY`, `ENGINE4_AUDIT_HMAC_KEY_VERSION` | The keyed hash of the user id, shared with Engine 4's audit tables (D5), so one deletion rule covers both | Rotate by raising the version; old rows keep their version                                                               |
| `KNOWLEDGE_SERVICE_URL`, `KNOWLEDGE_SERVICE_KEY`           | The step 6 service. Without it the pack is UNAVAILABLE and the answer is flagged (7.6 row 8)              | `deploy-stack-d-step6.md` S2 and S3                                                                                      |
| `INTAKE_UNDERSTAND_MODEL`                                  | The model id of the Understand call (no id lives in the code)                                             | Verified at S1                                                                                                           |

**The three flags and the allowance stay unset** until the stage that sets them: `REPLY_ENABLED` (S8), `REPLY_ALLOWED_USER_IDS` (S8), `INTAKE_INSTANT_PROMPTS_ENABLED` (S9),
`PRO_MONTHLY_UNITS` (S4), `REPLY_DISABLED_MODELS` (the kill switch of S9).

**Schedule `reapExpired`** (`lib/platform/metering/reaper.ts`) from **one** scheduler only (a second one is harmless but doubles the load of the statement). A reservation older than
ten minutes that nothing settled is expired and its units go back to the trader; without the reaper a settlement the ledger could not make leaves its hold in place.

## 2. S1 — The gateway smoke and the verified registry rows (D1, D5)

The adapter was written from OpenRouter's documented format and has never met the service. The registry holds six **candidates** whose slugs, prices and features nobody has checked.

```bash
node scripts/reply/gateway-smoke.js --list-models        # FREE: reads OpenRouter's public list, sends no key
```

For each registry row it prints what the service says next to what the registry says (`<>` marks a difference): whether the slug exists, the context, the price per million
tokens, image input, structured outputs. Correct a slug that does not match by hand. Then, with the key and the cap:

```bash
OPENROUTER_API_KEY=... node scripts/reply/gateway-smoke.js --call --model <slug> --cap-usd 1 --probe-cache
```

It makes a few tiny calls THROUGH THE REAL ADAPTER (the request is exactly what production sends, `data_collection: "deny"` included): `json_object`, `json_schema`, `vision`, and with
`--probe-cache` two calls with one long prefix. It prints the registry fields it would propose and never edits the file.

**You write the verified fields into `config/ai-models.ts`**, each with its date: `verified_at`, `priced_at`, `price_in`, `price_out`, `vision`, `json_schema`, `prompt_caching`, `context_tokens`,
`context_budget`, `max_output_tokens`, `provider_only`. A model for which no host that keeps no prompts answers (ADR-077) is not eligible. The row stays `candidate`.

**Expect:** `npx jest __tests__/lib/reply/gateway/registry.test.ts` passes (the checker refuses a price without its date, a date without its price, a row that claims a feature the
unverified placeholders may not, and any `passed` row without a run).

## 3. S2 — The live evaluation run (D1, D25)

**Before you spend:** sign the golden scenarios. The run is evidence only against scenarios a person approved.

```bash
node scripts/reply/golden-tool.js record               # rewrites review.md; read config/reply/golden/review.md
# edit config/reply/golden/approval.json: status APPROVED, approved_by, approved_on
node scripts/reply/golden-tool.js check --require-approved
```

**What a run costs.** The golden set is 680 cells a pass; **634 of them are written by the model under test** (the rest are staged failures replayed from scripts, free). The plan repeats each
scenario twice to damp noise, so about **1,270 calls per model**, each with a prompt of 11,000 to 19,600 tokens. `--estimate` prices it from the registry (it calls nothing):

```bash
node scripts/reply/eval-run.js --estimate --model <slug>
```

**You set the cap (decision D25)**; the script refuses to start without `--cap-usd`, and stops after the call that reaches it (so the most it can overspend is one call), writing nothing.

```bash
OPENROUTER_API_KEY=... node scripts/reply/eval-run.js --live --model <default slug> --fallback <fallback slug> --cap-usd <n> --passes 2 --write
OPENROUTER_API_KEY=... node scripts/reply/eval-run.js --live --model <fallback slug> --cap-usd <n> --passes 2 --write
```

The fallback must be a model of **another provider** (ADR-055). `--locales fr,ja` and `--scenarios G01,G02` run a part of the set (for a first look; a partial run does not pass the gate). A run is
written to `config/reply/eval-runs/<id>.json`, named by a **fingerprint**: the model and the host that served it, the prompt text, the wording lists, the caps and the scenarios with the worlds
they run on. Change any of them and the run is stale.

**Read the table it prints** (architecture 5.10): golden scenarios 100%, schema 100% after at most one retry, numbers 100%, wording 100%, all 19 locales within 5 points of English, cost and time
recorded. **A language's score is the share of its runs that pass every check without a retry, a regeneration or a flag.** With 34 scored runs a locale one run under English is 2.9 points down
and two runs under is 5.9: "within 5" tolerates one miss.

**If it passes,** the script prints the registry fields a person would write. Write them (the script never does):

```ts
status: 'passed',
eval_run: { id: 'live-…', date: 'YYYY-MM-DD' },
languages_ok: ['en-US', 'en-GB', /* … all 19 … */],
launch_role: 'default' | 'fallback',   // one of each, of different vendors (ADR-055)
```

**Expect:** `npx jest __tests__/lib/reply/eval-gate.test.ts` is green. It fails if a `passed` model has no live run, if the run's fingerprint is not the current one, if a language is more than 5 points under English,
if a direction is not the synthesis reading's, or if the run is a stand-in. **Run the gate again after every edit to the prompt, the wording lists, the caps or the scenarios**: the run goes stale and the model must be run again.

**Then the Free recording**, once the pair has passed: `node scripts/reply/record-demo.js record --run config/reply/eval-runs/<live run>.json` replays the live run's recorded replies of scenario M01 through the pipeline and writes
`config/reply/demo/` again, from a LIVE run. It is read and signed in S5.

## 4. S3 — `measure-units` (ADR-073)

```bash
node scripts/reply/measure-units.js --run config/reply/eval-runs/<live run>.json --price <Pro price> --share <share>
```

It reads the recorded run as if its cells were `request_traces` rows and prints, per model, the **units** (one unit is one micro-dollar of gateway cost, D2) of an instant prompt and of a first message at the median and the 90th percentile,
the tokens the provider reported, how many costs the provider reported and how many were worked out from the registry price, and what an allowance buys. The price is the SystemConfig price (yours to pass, never a constant of the code).

**Two things the run does not measure.** (1) The Understand call of a typed question is **answered by a fake in the harness** and reported at a fixed 300 micro-dollars, so the units of a typed cell hold 300 that mean nothing; only the instant prompts (scenario M01 and the cells that ask for one) are clean, and the real Understand cost is in S8's traces. (2) The day of bars in the prompt is the test world's seeded walk, **moved so that it ends at the cycle's own last price**: it is consistent with the cycle but it is not market data, so a live run judges a model's compliance with the checks, not its reading of a real day.

**The run has no follow-ups and no estimator comparison.** Run it a second time on real traffic, in the first days of S8, for a follow-up in the same thread and for the estimator's error (the trace's `model.components`, which sum to the estimator's count, against `model.tokens.prompt`, which is what the provider charged):

```bash
node scripts/reply/measure-units.js --db --since <date> --price <Pro price> --share <share>
```

Write the measured prices, the `units_per_msg` and a per-model `calibration` (the margin that keeps a prompt inside the model's window) into the registry. **Expect** the cached share to show whether provider caching engaged (plan R9: if it did not, the cost per message is 2 to 3 times the estimate).

## 5. S4 — The allowance and the pricing text (D4)

The allowance is the Pro price times the share you allow for model spend, divided by the cost of a unit (ADR-073). `measure-units.js --price <usd> --share <0..1>` prints it in exact integers. Set it in Vercel (production):

```
PRO_MONTHLY_UNITS=<the number it prints>
```

The ledger **refuses every request while it is unset**, and the allowance of a month rises at once and never falls mid-month (lowering it applies from the next month: part 6, reading 5). The 500,000-token figure the pricing page prints today
(`aiMonthlyTokenQuota` in `packages/types/src/tier/constants.ts`, shown by `components/pricing/tier-comparison.tsx`) is against ADR-073, which says no token number is published until the first measurement run: change the page to say "monthly AI allowance" with no number,
as a small edit in its own commit.

## 6. S5 — Native readers and counsel

Nothing below is something the build can decide. Each area has a tool that generates a review sheet and holds an `approval.json` that only a person writes; an edit to the content puts the approval back to "written for other content".

| Area                                                                                                                                                                     | Read                                                                                                        | Approve by                                                                                         | The gate that holds                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The 17 wording lists (5 "never" rows, direction words, the "not verified" mark)                                                                                          | `config/reply/wording/review.md`                                                                            | `config/reply/wording/approval.json`                                                               | `node scripts/reply/wording-tool.js check --require-approved`                     |
| The static rules and the wording guide of the prompt                                                                                                                     | `config/reply/prompts/review.md`                                                                            | `config/reply/prompts/approval.json`                                                               | `node scripts/reply/prompts-tool.js check --require-approved`                     |
| The golden scenarios                                                                                                                                                     | `config/reply/golden/review.md`                                                                             | `config/reply/golden/approval.json`                                                                | `node scripts/reply/golden-tool.js check --require-approved`                      |
| The Free recorded example, in 19 languages                                                                                                                               | `config/reply/demo/review.md` (**a stand-in recording: do not approve it; record from the live run first**) | `config/reply/demo/approval.json`                                                                  | `node scripts/reply/record-demo.js check --require-approved`                      |
| The 17 invalidation lines                                                                                                                                                | `config/reply/report1/invalidation-line.v1.json`                                                            | the file's `status` text and `version`, by hand, when the lines are read (it has no approval tool) | `lib/reply/report1/invalidation-line.ts` (the lines are checked for placeholders) |
| The 173 `chat.*` texts of Panels A and B                                                                                                                                 | `components/chat/text.ts` and the 19 dictionaries; `DRAFT_TEXT_KEYS` lists the 15 that counsel reads first  | counsel; the dictionaries                                                                          | `__tests__/components/chat/translation-coverage.test.ts`                          |
| The disclaimers, the fixed answers, the ten refusal replies, the delete confirmation (`chat.threads.delete_body`: it states that the audit record of each request stays) | counsel                                                                                                     | counsel                                                                                            | Appendix D                                                                        |

**The Free tier shows its recorded example only when `config/reply/demo/approval.json` says APPROVED and the files come from a LIVE run**, both (`components/chat/demo-source.ts`, `shownToTraders`). Approving the stand-in recording changes nothing a trader sees, by design.

## 7. S6 — The cycles must flow (Phase B)

A chat with an empty board has nothing to say. **Do not continue past S6 until the sensors run in production**: `deploy-stack-d-step3.md` B0 to B5 (the Railway image with Python 3.11, the live shadow, SYN `live`). Check, from your own session:

```bash
curl -s https://<your host>/api/chat/state -H "Cookie: <your session>"        # 404 until REPLY_ENABLED; then: cycle { slot, data_status }
```

With `REPLY_ENABLED` off this answers 404; the check is meaningful only from S8. Until then, look at `market_cycle_inputs` and `mcd_outputs` for a ready cycle in the last ten minutes.

## 8. S7 — The archive and the retention job (D17)

ADR-076 keeps audit rows 7 years; the architecture keeps `request_traces` 90 days in PostgreSQL "then archived". **No archive writer exists.** A database trigger refuses to delete a trace that has not been archived, so a "90-day cleanup" cannot destroy a legal record, and nothing is scheduled.

Decide one of: (a) provision the archive (the separate compliance design names an object-lock vault) and build the exporter, then schedule the planner (`lib/platform/traces/retention.ts`, a pure function that says what is due); or (b) keep the traces in PostgreSQL and accept the growth until the vault exists. **(b) is safe**; measure the growth in S8:

```sql
SELECT count(*), pg_size_pretty(pg_total_relation_size('request_traces')) AS table_size,
       pg_size_pretty(avg(octet_length(reply_json))::bigint) AS avg_reply
  FROM request_traces;
```

Chat messages expire 12 months from each message (a trader's delete removes the thread at once; an account deletion removes everything and leaves the keyed hash in the audit rows). No job deletes them yet; the planner says what is due.

## 9. S8 — Staging on your own account (D21)

**Prerequisites.** S0 to S5 as you decide them (S6 is needed for the chat to have anything to say), the reaper scheduled, `PRO_MONTHLY_UNITS` set, the pair `passed`. **Use English for the week**: the 18 other locales' lists and texts wait for S5.

Set in Vercel, production:

```
REPLY_ENABLED=true
REPLY_ALLOWED_USER_IDS=<your own user id>        # comma-separated; every other trader is treated as Free by the gate
```

**Leave `INTAKE_INSTANT_PROMPTS_ENABLED` unset.** It is a global switch of the chart badges, not part of the allow-list: turned on now it would make every Pro trader's badge post to a route that refuses them.

**Use it for a week** (typed questions in Panel B; open and delete threads; collapse and reopen Panel B). Then read what the trace says:

```sql
-- the five alerts' inputs (architecture 7.8), over the week
SELECT date_trunc('day', created_at) AS day, count(*) AS replies,
       round(100.0 * count(*) FILTER (WHERE number_violations > 0 OR wording_violations > 0) / count(*), 2) AS pct_with_a_violation,
       round(100.0 * count(*) FILTER (WHERE regenerations > 0) / count(*), 2) AS pct_regenerated,
       percentile_disc(0.9) WITHIN GROUP (ORDER BY total_ms) AS p90_ms,
       percentile_disc(0.9) WITHIN GROUP (ORDER BY units_charged) AS p90_units
  FROM request_traces WHERE model IS NOT NULL GROUP BY 1 ORDER BY 1;
```

Expect the share with a violation under 2% of replies a day, a Report 1 p90 under 15 seconds and a short answer under 8 (5.11). Run `measure-units.js --db` (S3's second run). Audit the ledger:

```sql
SELECT count(*) AS broken FROM ai_quota_periods WHERE used + reserved > "limit" OR used < 0 OR reserved < 0;                 -- must be 0
SELECT count(*) AS stuck FROM ai_usage_reservations WHERE status = 'RESERVED' AND created_at < now() - interval '10 minutes';  -- must be 0 (the reaper)
SELECT count(*) AS unfiled FROM ai_usage_reservations r WHERE r.status = 'SETTLED' AND NOT EXISTS (SELECT 1 FROM request_traces t WHERE t.request_id = r.request_id);  -- explain every one
```

## 10. S9 — Production activation, and rolling back

When S8 looked sane (and S5 is done for every locale you will serve):

1. Unset `REPLY_ALLOWED_USER_IDS`. Every Pro trader now has Panel B and Panel A.
2. Set `INTAKE_INSTANT_PROMPTS_ENABLED=true`. The two Market Context badges now post to `POST /api/chat/message` and the answer opens in Panel B.
3. **`INTAKE_ENABLED` stays `false`** and `/api/intake*` stay dev-only (D8). **`ENGINE4_REPORT2_ENABLED` is its own decision** (`deploy-stack-d-step5.md`).
4. Deploy. Watch the S8 queries for the first day, hour by hour.

**Rolling back.** The migrations are additive and unused while the flag is off. The ledger and the traces hold financial and legal records: **never drop them once written to** (the headers say so).

| What you want                     | Do                                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The chat off for everybody        | Unset `REPLY_ENABLED` (or set anything but `true`) **and redeploy**. Every chat route answers 404, Panels A and B say it is not switched on, the badges are what they were (the chart is untouched) |
| The badges back to what they were | Unset `INTAKE_INSTANT_PROMPTS_ENABLED` and redeploy                                                                                                                                                 |
| One model off, no code change     | Set `REPLY_DISABLED_MODELS=<slug>[,<slug>]` and redeploy: the picker, the fallback and the gate stop using it (the other model of the pair answers; both off gives the board-only answer)           |
| Back to your account only         | Set `REPLY_ALLOWED_USER_IDS=<your id>` and redeploy                                                                                                                                                 |
| Stop the spend at once            | Set a monthly cap on the OpenRouter account lower than the spend (the provider side, immediate); then the ledger refuses what it cannot cover                                                       |

**An environment variable on Vercel takes effect with the next deployment, not on the running one.** "Instant" therefore means a redeploy of the same commit (a few minutes; I have not timed one); the plan said "rollback is a flag, not a deploy" and that is true of the **code** (no revert, no migration), not of the clock. Nothing in the repository switches the chat off faster.

## Where things are

| What                     | Where                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Decisions as built       | `docs/adr/099-prompt-and-reply-as-built-in-step-7.md` (D1 to D25), ADR-050, 052 to 057, 072 to 079                                         |
| The architecture         | `docs/STACK-D-ARCHITECTURE.md` chapter 5 (5.4 and 5.5 carry ADR-099's notes), 7.3 to 7.7                                                   |
| Per-part hand-offs       | `docs/handoffs/2026-10-14-step7-part1.md` to `2026-10-16-step7-part10.md`                                                                  |
| The model registry       | `config/ai-models.ts` (data), `lib/reply/gateway/registry.ts` (the checker that runs when it loads)                                        |
| The evaluation suite     | `lib/reply/eval/`, `scripts/reply/eval-run.js`, `config/reply/golden/`, `config/reply/eval-runs/`, `__tests__/lib/reply/eval-gate.test.ts` |
| The Free recording       | `config/reply/demo/`, `scripts/reply/record-demo.js`, `components/chat/demo-source.ts`                                                     |
| The ledger               | `lib/platform/metering/`, `lib/reply/meter/`; the migration header of `20261014010000_add_ai_metering_tables`                              |
| The flags                | `lib/reply/server/flags.ts` (`REPLY_ENABLED`, `REPLY_ALLOWED_USER_IDS`), `lib/reply/gateway/registry.ts` (`REPLY_DISABLED_MODELS`)         |
| The gotchas of this step | `.claude/architecture/environment-gotchas.md` (the ledger SQL rules, the dictionary write, the dev server and the 19 languages)            |
