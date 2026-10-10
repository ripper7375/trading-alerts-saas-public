---
type: Concept/ResolvedBlockers
status: archived
source: CLAUDE.md '## Waiting on' items marked RESOLVED (L4896-L5317)
tags: [history, blockers, resolved]
---

# Resolved Waiting-on items

Blocks are verbatim copies from the pre-OKF `CLAUDE.md` (backup: `CLAUDE-480KB-PRE-OKF-BACKUP.md`, sha256 `ad804d40…68a1ef`, also in git history before this refactor). Each `<!-- CLAUDE.md Lx-Ly -->` comment gives the original line range. Order is the original file order (newest first, with some out-of-order ad-hoc entries).

Open items live in [../waiting-on.md](../waiting-on.md).

<!-- CLAUDE.md L4939-L4957 -->

- **RESOLVED 2026-09-11 — the R2 chart-render path is DEPLOYED AND LIVE end to end.** Bucket
  `davintrade-renders` created private, five `R2_*` vars set in Vercel (Production) and redeployed,
  `MT5Renderer` registered under NSSM and uploading, both objects present and refreshing, and the
  PRO/FREE entitlement verified in a real browser. Full account in the 2026-09-11 ad-hoc entry at
  the top of this file. **Two things a later session still needs to know:**
  **(a) Bucket privacy is dashboard-confirmed, not script-proven.** The Definition of Done asked
  for it to be "verified by T4's public-access check, not assumed", and that literal wording is
  **not** met. The reason is worth keeping: **an unsigned GET against the S3 endpoint is refused
  even on a PUBLIC bucket** — R2's S3 API is never anonymous — so the check as originally specified
  would have passed on a public bucket and produced false assurance. Public read on R2 lives on a
  _different_ hostname (the managed `pub-<hash>.r2.dev` domain, or a connected custom domain).
  Davin confirmed in the dashboard that r2.dev is disabled and no custom domain exists. To close
  it properly, set `CF_API_TOKEN` (a Cloudflare API token with **Workers R2 Storage: Read**, a
  different credential from the S3 keys) and re-run `scratch/verify-r2.ts`, whose check 5c then
  answers definitively. Until then that check reports **UNPROVEN**, deliberately, rather than PASS.
  **(b) The renders are currently SYNTHETIC.** `MT5Renderer` reads
  `C:\Scripts\renderer\fixture.db`, a seeded fixture whose bars are dated around **9 June 2026**.
  Real candles wait on the `.ex5` rebuild (its own blocking item above). A June-dated axis on a
  downloaded PNG is the fixture, not a bug.

<!-- CLAUDE.md L4977-L4992 -->

- **RESOLVED 2026-09-11 — the MQL5 recompile and VPS deployment are DONE.** This entry stood as the
  top blocking item from 2026-09-09, warning that the 10 statistic-emitting binaries were a build
  behind the EDT Quality Metrics blocks added at 14:52–14:54. **That is no longer true.** Davin
  compiled all 13 indicators **plus** `EconomicCalendarExport_v2_29.mq5` natively in MetaEditor on
  the Windows Server 2022 VPS with 0 errors, and committed the binaries (`aa0335ae`).
  **Re-verified here, not taken on trust:** every one of the **15** `.mq5` sources in `mq5/` now has
  an `.ex5` **newer than its source** — 0 missing, 0 stale, by direct mtime comparison. The
  collector, schema and push worker are deployed and `MT5Collector` / `MT5PushWorker` /
  `MT5Renderer` all run under NSSM.
  **Worth keeping from the original entry, because the hazard it described was real and is the
  thing to check if this ever regresses:** a stale binary here **hides itself**. The pipeline looks
  entirely healthy — timestamps correct, cycles validating, `indicator_statistics` rows genuinely
  written — while every new statistic field is NULL, because an old-format `_Statistic.txt` lacks
  those sections and the parser correctly reads _missing_ as NULL rather than 0. Nothing errors.
  **So after any future indicator rebuild, confirm a fresh `_Statistic.txt` actually contains an
  `[EDT CHANNEL]` section before trusting a green cycle.**

<!-- CLAUDE.md L4993-L5022 -->

- **RESOLVED 2026-09-09 — the four pending migrations are applied to PRODUCTION, and the
  database picture is now settled for good.** Davin applied them with
  `prisma.production.config.ts` against `maglev.proxy.rlwy.net:58290`; verified afterwards:
  `market_data_v6` present with 90 columns (`best_fit_a` ×8, `best_fit_b` ×8), `cycle_id` and
  `collected_at` both `NOT NULL`, `indicator_statistics` + `indicator_configs` created,
  `UserAppearance.theme` default `'light'`, 19 migrations recorded with **0 failed** — and the
  live data untouched (24 users / 2 accounts / 5 payments / 1 commission / 2 alerts, identical
  before and after).
  **The database question that consumed most of the day, settled with evidence:**
  - **`maglev.proxy.rlwy.net:58290` is production.** Confirmed three ways: `railway-gateway`'s
    `DATABASE_URL` resolves to `postgres.railway.internal` (this service's private address); it
    holds 39 app tables with 7 months of real activity (2026-01-22 → 2026-08-15); and it carries
    the `User.profile` column, the exact fix that made live OAuth work on 2026-09-01.
  - **`turntable.proxy.rlwy.net:55082` is a staging clone.** Full app schema including `User`,
    49 tables, `market_data_v6` present but **0 rows**. It is what `.env.local` points at.
  - **Production had never had `market_data_v6` at all.** `20260705000000_add_market_data_v6` was
    recorded `applied` with **`steps=0`** on _both_ databases — i.e. marked applied without
    executing. The table was created here for the first time on 2026-09-09 by running that
    migration's SQL directly via `prisma db execute`, which made the recorded state true without
    any migration-history surgery. **This is the fourth instance of the `db push`-bypassing-
    migration-history drift class** the 2026-09-01 entry documented three times; it now warrants a
    real audit rather than another one-off note.
  - **Corollary worth internalising: the v6 pipeline has never written a row to Postgres.** The
    gateway was pointed at a database with no `market_data_v6` in it. Every other symptom lines up
    — `completed 0` on the queue for days, the `.ex5` never redeployed, the timestamp bug sitting
    unfixed as the "#1 gating item" for two years.
  - **Methodological note that cost real time:** `maglev` and `turntable` are Railway's _shared_
    TCP proxy hostnames — many services sit behind each, and the **port** identifies the service.
    Reasoning about which project owns an endpoint from its hostname is unsound. Read the
    service's own Settings → Networking panel.

<!-- CLAUDE.md L5023-L5034 -->

- **RESOLVED 2026-09-09 — Postgres superuser password rotated after exposure.** The credential
  appeared in screenshots during the migration work. Rotated end to end and verified: all three
  referencing services reconnected, `/affiliate/leaderboard` (which hits Prisma per request)
  returns 200. Full procedure, including the five gotchas that actually bit, is now a runbook:
  `docs/runbooks/rotate-postgres-credentials.md`. The two worth knowing here:
  **services do NOT auto-restart when a referenced variable changes** — they must be redeployed,
  and a large `uptime` in a health response is how you spot one that hasn't — and **a placeholder
  in an instruction can be executed literally**: the password was briefly set to the string `NEW`
  because a command used `'NEW'` as a stand-in. Prefer `\password`, which has no placeholder.
  Also mapped and recorded: three separate DB passwords exist (`postgres`, `core_app`,
  `money_svc`); the pgbouncer userlist contains only the latter two, so rotating `postgres` does
  **not** touch pgbouncer and does **not** affect `money-service`.

<!-- CLAUDE.md L5048-L5077 -->

- **RESOLVED 2026-09-09 — staging project audited and the dead monolith service deleted.** The
  project **named** "postgre for staging" (`ce1d2134-…`) turned out to hold a **full duplicate
  stack**, not just a database: `Postgres` (= `turntable`, the local-dev DB both `.env` and
  `.env.local` point at), a second `railway-gateway`, `Redis`, and
  `trading-alerts-saas-public` — a deployment of this repo.
  **`trading-alerts-saas-public` deleted** after a full examination, every check pointing the same
  way: **20 deployments, all FAILED, never once succeeded** (created 2026-09-04); its URL served
  404; `volumes: []` so no state; source was this GitHub repo so nothing unique lived on it; no
  custom domain; no tracked file referenced its hostname; and the only Railway references to it
  were the auto-injected `RAILWAY_SERVICE_TRADING_ALERTS_SAAS_PUBLIC_URL` sibling variables. Its
  sole effect on the world was **a failed build on every push to `main`** — it was GitHub-connected
  to this repo with no watch paths, so several of today's own pushes triggered failures there. Four
  hand-configured variables were lost with it (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `POSTGRESQL_URI`,
  `REDIS_URL`), all trivially reconstructable; the secret signs sessions for an app that never
  started.
  **Deletion confirmed by two independent probes**, not by a success message: the service vanished
  from the listing, **and** `RAILWAY_SERVICE_TRADING_ALERTS_SAAS_PUBLIC_URL` disappeared from all
  three siblings (Railway strips it only on a real delete). Production verified unaffected
  afterwards — gateway `healthy`, `/affiliate/leaderboard` 200.
  **Two process lessons, both of which produced a false "done" today:**
  1. **`railway service delete` via CLI reported an ambiguous decode error while actually
     failing.** Probably 2FA in non-interactive mode (the CLI here is 5.27.0, several versions
     behind). Never treat a CLI mutation as done without re-probing the object.
  2. **The Railway UI stages destructive changes and requires the "Apply N changes → Deploy"
     button.** Clicking "Remove" only marks the service `Removed — Service will be deleted`. This
     is the _same_ pattern as the 2026-08-31 Root Directory incident already in this file.
     **The database itself was deliberately kept** — it is the local dev DB and the only migration
     rehearsal target, which today proved worth having. Recommended follow-up: **rename** the project
     to something honest (`davintrade-dev-db`), since the misleading name is what caused three
     sessions to misread the topology, and deleting it would break local development.

<!-- CLAUDE.md L5082-L5091 -->

- **RESOLVED 2026-09-09 — `railway-gateway` could not build at all.** `NODE_ENV=production` made
  npm omit devDependencies, while the build needs them: first `@nestjs/cli` (`sh: 1: nest: not
found`, exit 127), then `@types/express`/`@types/compression` (TS7016). It had been broken for
  hours behind a warm build cache and only surfaced when enough rebuilds ran. **This blocked the
  password rotation** — a service that cannot deploy cannot pick up a new credential. Fixed by
  matching the two sibling services: `@nestjs/cli` moved to `dependencies` (as in
  operation-service and money-service) plus a `nixpacks.toml` mirroring operation-service's
  (`NPM_CONFIG_PRODUCTION=false`, explicit install/build phases). Commits `60dd7edc`, `b327f997`.
  **General lesson: any redeploy can surface an unrelated latent build failure**, so confirm a
  service can deploy _before_ depending on a redeploy to carry a change.

<!-- CLAUDE.md L5140-L5144 -->

- **RESOLVED 2026-09-09 — centroid EDT fractal source / unreproducible certification.** Dissolved
  rather than fixed, by removing the Python calculation split entirely: there is no longer a
  Python EDT stage to use the wrong fractal source, and no port to certify. The finding is
  preserved in `FIELD-CONSISTENCY-AUDIT-v2_29.md` §5 and carried forward as an open bug to fix
  **first** if the calc stack is ever revived. Original entry follows for context:

<!-- CLAUDE.md L5145-L5161 -->

- **~~MAJOR — centroid EDT fractal source: certification unreproducible, production may use the
  wrong fractal source~~** (2026-09-09 field-consistency-audit session) — `golden_certification.py`
  crashes on every centroid variant (`TypeError: CentroidRegressionParams.__init__() got an
  unexpected keyword argument 'fractals'`), empirically reproduced against real M5/M15 data;
  confirmed via full `git log` that `centroid_regression.py`'s `calculate()` has never accepted a
  `fractals` override, so it has always self-detected fractals from raw OHLCV highs/lows — the
  exact approach `CERTIFICATION.md`'s own "Production rule" says was tested and rejected in favor
  of the staged `horiz_high_map`/`horiz_low_map` columns. Production's `calculate_stage()` is
  wired the identical self-detecting way (confirmed by reading the exact call site). This means
  the M15 50/50 / M5 39/50 "CERTIFIED" verdict for every centroid variant's Base_FL/UOEDT/LOEDT
  is stale, unreproducible evidence, and the EDT values currently live in production may not be
  the ones actually certified. Needs Davin's decision: restore fractal-injection support and
  re-certify against real MT5 data, or formally revise `CERTIFICATION.md`/the blueprint's own
  §6.4 to accept self-detected fractals as the intended design. Full detail:
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
FIELD-CONSISTENCY-AUDIT-v2_29.md` §5. Not something this Executor can resolve unilaterally — it's
  a correctness judgment call on certified trading math, not a naming/type/nullability fix.

<!-- CLAUDE.md L5162-L5169 -->

- **RESOLVED 2026-09-09 — `market_data_v6` provenance NOT NULL migration applied.**
  `20260909000000_market_data_v6_provenance_not_null` tightens `cycle_id`/`collected_at` to
  `NOT NULL`, matching `sqlite_schema_v6_xauusd.sql`'s own constraint and `promote_cycle()`'s
  actual (always-populated) behavior. It went in as part of Davin's `migrate deploy` run rather
  than after the recommended `SELECT COUNT(*) ... WHERE cycle_id IS NULL OR collected_at IS NULL`
  pre-flight — but the check turned out to be belt-and-braces: `SET NOT NULL` errors out if a
  single violating row exists, so a clean apply proves there were none. **Subject to the same
  staging-vs-production question as the item above.**

<!-- CLAUDE.md L5245-L5251 -->

- **RESOLVED 2026-09-01:** OAuth `error=Callback` — see the two same-day ad-hoc entries above.
  Root cause was untracked schema drift (`User.profile`, then a second layer:
  `MarketingAsset`/`MarketingAssetStatus`/`MarketingAssetCategory`), not the apex/www cookie theory
  the first entry chased — that fix stayed in as valid hardening but wasn't the active cause.
  Davin confirmed live, in his own browser, that both Google and Twitter/X sign-in now work.
  **LinkedIn was never actually tested** (Davin's original report and every live check this session
  ran only covered Google/Twitter/X) — flagged in case it still needs its own confirmation pass.

<!-- waiting-on.md, resolved 2026-10-01 -->

- **RESOLVED 2026-10-01 — replica v3 is tracked.** The MCD3 fixture for replica v3 (the only real consolidated trend) names
  `market_data_v6_replicated_v3.xlsx` by SHA-256; Davin committed the workbook (with v2, v4 and the replica batches) in `dde1420e`
  "01102026_15:20". The committed blob's SHA-256 (`cce23cda…0bffd`) equals the one in `fixtures/2026-09-28T1415Z.source.md`; the v4
  and v1 hashes match too. Original item, text as it stood:
  - **MCD3 fixtures need replica v3 tracked (2026-10-01).** `market_data_v6_replicated_v3.xlsx` (2 MB) and `_v2.xlsx` are
    untracked; the v3 fixture (the only real consolidated trend) names it by SHA-256 in `fixtures/2026-09-28T1415Z.source.md`.
    Until Davin commits it, the provenance and equivalence tests skip the v3 parts in a fresh checkout. The kit also writes an
    absolute `D:/...` workbook path into `<slot>.source.md` for a workbook outside the engine folder (v3 and v4, as for MCD1 and
    MCD2); the SHA-256 is what matters.

<!-- session 2026-10-01 mcd3-p6 -->

- **RESOLVED 2026-10-01 — MCD3 envelope size: Davin approved a ceiling of 670 tokens (A22).** Moved here from `waiting-on.md`. The independent check (task P6) added that with the candidates of live data (every variant populated, architecture review A3) the seven consolidated states are 624 to 632 tokens even when VALID and the worst case is 656 (two upstream cautions and RETUNING); MCD1 (392) and MCD2 (386) stay far below, so the three-sensor worst case is about 1,430 of 2,000 (ADR-048). The manifest A22 reads "Pass (Approved by Davin: derived dual-horizon ceiling <= 670 tokens)" and two `test_t12_*` tests pin the ceiling. The original item, verbatim:

  > - **MCD3 envelope size (2026-10-01, task P3): the real CAUTIONARY readings are 607 and 611 tokens, over the standard's
  >   600 ("should").** The plain real envelopes pass (515, 550, 587). Two 64-character `config_hash` values cost about 72
  >   tokens and are mandated; six levels about 132; the commentary about 124; `details` about 77. Options for Davin, none
  >   applied: accept; shorten templates T01 to T07 (about 35 tokens); drop the two trend words from `details` (about 15).
  >   Manifest `mcd3-manifest-work-completion.md` A22 and §7; pinned below 650 by a test.

<!-- moved from waiting-on.md on 2026-10-01 (task P7) -->

- **RESOLVED 2026-10-01 (task P7, MCD2 and MCD1 2.0.1; hand-off [2026-10-01-1453-p7b-mcd2-mcd1.md](../../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md)).**
  MCD2's window is now `min(T_EDT − 1, 288)` closed bars and a channel under 48 closed bars is INVALID + `INSUFFICIENT_BARS`; MCD1 requires the
  channel to hold `N_micro` closed bars (`T_EDT − 1 ≥ N_micro`, else INVALID + `INSUFFICIENT_BARS`). Parameter `t_edt_open_bar_rows` = 1; decision entry
  ADR-083 (Proposed). The item, verbatim as it stood:

  > - **MCD2 and MCD1 windows reach one bar before a short channel (2026-10-01) — simulated, open, not fixed.** The
  >   committed MCD2 reads `max(48, min(T_EDT, 288))` closed M5 bars. Because `T_EDT` counts the forming bar (item above),
  >   an M5 channel with `T_EDT` 49 to 288 has only `T_EDT − 1` closed bars with a channel, so MCD2's tier 2 reads a null
  >   and ends INVALID + `DISCONTINUITY`; MCD1 does the same at `T_EDT` ≤ 96 (its window floor). Simulated on the v1
  >   bundle (`T_EDT` 289 and above VALID; 288 and below INVALID); **no replica triggers it** (smallest real `T_EDT`
  >   is 314, the v3 fractal), but live fractal channels can be short, and MCD3 would then see
  >   `UPSTREAM_UNAVAILABLE:MCD2`. MCD3's window is `T_EDT − 1` and is not affected. The fix is a PATCH to MCD2 and
  >   MCD1 (window = `min(T_EDT − 1, cap)`, no fixture changes): task P7, Davin's call. Hand-off:
  >   [2026-10-01-0703-mcd3-p2.md](../../../docs/handoffs/2026-10-01-0703-mcd3-p2.md) §7 item 2. **Davin deferred the P7 patch until after
  >   the MCD3 stage-3 sign-off (2026-10-01); he granted that sign-off the same day, so the patch is now the next task.** A background-task chip for it was offered and left open.
  >   **Part (a) of P7 is written (2026-10-01):** a "Change 2026-10-01" section in `mcd2/concept.md` and `mcd1/concept.md` (PATCH, 2.0.1;
  >   no fixture output moves; fixtures' smallest `T_EDT` is 314 on M5 and 500 on M15). It waits for Davin's confirmation, with one question
  >   first: `min(T_EDT − 1, cap)` applied literally also drops the 48-bar (MCD2) and 96-bar (MCD1) floors, so the sections keep them as
  >   minimums (INVALID + `INSUFFICIENT_BARS`). Hand-off: [2026-10-01-1435-p7a-mcd2-mcd1.md](../../../docs/handoffs/2026-10-01-1435-p7a-mcd2-mcd1.md).

<!-- session 2026-10-02 step2-part10 -->

- **RESOLVED 2026-10-02 (build step 2 part 10) — how RETUNING can end on the real pipeline.** As it stood after part 9: _"The ordered definition of the re-push count can never reach 0 on the real
  collector (it re-queues the whole window every cycle), so RETUNING would not end; Davin decides before step 3 reads the flag."_ The cause: `promote_cycle()` rewrites every bar of the window with
  `INSERT OR REPLACE` and does not list `synced_at`, so after every cycle all of the roughly 3,000 M5 rows are unsent again, and the manifest is built right after the cycle's newest bars were sent. The sender's
  `repush_rows_unsent` (unsent rows older than `slot - 300`) was therefore about 2,700 or more in every manifest, never 0, promote or not (pinned by
  `test_the_collectors_full_requeue_leaves_the_whole_window_unsent_at_manifest_time`).
  **Resolution:** Davin chose Option A in the part 10 order. The gateway counts, while a symbol is RETUNING, the M5 rows of the window (`slot - 3000 * 300` to the slot) in `market_data_v6` whose `cycle_id` is below the
  promote cycle's `m5_collection_cycle_id`; at 0, the first manifest that is verified (READY) ends it and a `RETUNE_COMPLETE` event is written. The sender's field stays as a diagnostic. ADR-015 was amended in place
  and STACK-D-ARCHITECTURE.md section 1.6 item 2 changed with it. Also gone with it: part 9's note that a sender without the count never ends a RETUNING, so a promote between the gateway deploy and the VPS file
  deploy is harmless now. **Still open from it:** Davin to confirm the one-step reading of "followed by one verified manifest" (hand-off `2026-10-02-1300-step2-part10.md`, decision 1).

<!-- build step 3 part 1 questions, settled 2026-10-03 -->

- **RESOLVED 2026-10-03 (Davin) — build step 3 part 1 questions** (the Python cycle runner, `docs/handoffs/2026-10-02-2359-step3-part1.md` section 6): (1) a CAUTIONARY MCD0 marks nobody, option (a) as built: only a VALID MCD0 defect propagates
  (`PROPAGATING_STATUSES` in `inheritance.py`); (2) both extra flag rules stay (no MCD above an MCD it reads, no channel MCD above MCD0); (3) a guard failure stays INVALID with `EVALUATOR_ERROR` (no new reason code);
  (6) the bundle sizing is accepted: 1.1 to 1.7 GB compressed for 90 days (build step 3 part 2 measured 1.14 to 1.79 GB from the real fixtures). **Carried, still open:** (4) whether a gate needs checklist items 7 and 8 (so whether MCD0 can reach `live`):
  Davin will formalise gate applicability in steps 4 and 6; (5) per-MCD rollback is a commit and a gateway deploy (flags in the committed `worker_config.yaml`); an optional env override is for part 4.

<!-- build step 3 part 2 questions, settled 2026-10-03 -->

- **RESOLVED 2026-10-03 (Davin) - build step 3 part 2 questions D1 to D6** (the sensor tables, `docs/handoffs/2026-10-03-0050-step3-part2.md` section 6), all approved as built: (D1) the table shapes (`cycle_slot` as unix seconds Int, snake_case
  timestamps, `config_hash_key` as the canonical JSON string of the envelope's `config_hash`, all the audit and version columns kept); (D2) the JSONB copy of the envelope stays beside `envelope_json`; (D3) `mcd_outputs` has no retention (kept
  indefinitely), and **part 4 owns the 90-day cleanup of `market_cycle_inputs`: delete where `cycle_slot < now - 90 days` after each cycle**; (D4) the six measured columns of `state_statistics` stay nullable behind the n >= 30 CHECK, and
  `opposing_level_rate` stays NULL until step 4; (D5) append-only by key, not by trigger; (D6) the two extra CHECKs stay. The migration `20261003000000_add_sensor_tables` is therefore final as a file; it is still NOT applied (B0).

<!-- build step 3 part 3 questions, settled 2026-10-03 -->

- **RESOLVED 2026-10-03 (Davin) - build step 3 part 3 decisions** (the cycle inputs loader, `docs/handoffs/2026-10-03-0215-step3-part3.md` section 6): (1) the bundle carries the columns the evaluators read, not 33 on every bar (the last closed bar of each timeframe carries every candidate),
  approved as built; (2) the M15 cover rule in `closed-channel.ts` stays; (3) **option (a)**: `mcd_worker/cli.py` and `cycle_runner.py` return `bundle_canonical_json` and the worker stores that exact Python-serialised text in `market_cycle_inputs.bundle_gz`
  (built in part 4); (4) Q13 confirmed as built (refusal only when both timeframes USE the same source under two tunings); (5) the `closed_bars_digest` check is deferred to the Phase B live measurement. Decision 6 (M15 left out when its cycle is not READY) was not answered and stays as built.

<!-- build step 3 part 4 decisions, resolved 2026-10-03 -->

- **RESOLVED 2026-10-03 — Davin's decisions on the part 4 hand-off (build step 3, the sensor worker), as built.** (1) a skipped job is recorded in the job's return value and a log line, no table; (2) the reading of a cycle that cannot be loaded is STALE with the kit's `DATA_STALE`, no kit change; (3) and (4) the worker writes nothing when every MCD is off, and the retry window is 2 s then 6 s; (5) the three edits to `app.module.ts`, `package.json` and `.env.example` are confirmed; (6) the engine reaches the Railway image through the plan's `sync-sensor-kit.js` (a copy of the engine inside the gateway package), option (a), a Phase B task, nothing in part 5; (7) and (8) Ajv `strictTypes: false` stays and `runner_version` stays 1.0.0. The text of the open list, as the part 4 session left it:

  Open then, all Davin's: (1) a skipped job is recorded in the job's return value (Bull keeps 100) and a log line, not a table; (2) a cycle that cannot be loaded gets STALE readings with the kit's `DATA_STALE`; (3) every MCD off writes nothing; (4) retry window 2 s then 6 s, then STALE; a READY row that
  appears after the STALE rows are written is never evaluated; (5) confirm `app.module.ts`, the `sync:mcd-output-schema` script and `.env.example`; (6) engine in the Railway image; (7) Ajv `strictTypes: false` for the kit's schema, or a PATCH to the schema; (8) `runner_version` stays 1.0.0;
  (9) `test/sensor-tables.pg.spec.ts` "the retention delete is served by the cycle_slot index" depends on planner statistics (fails on a table that has held rows, passes on a fresh one; the real cleanup uses the index on a populated table); (10) part 3's decision 6.
  Items (9) and (10) were not addressed in his reply and stay open as built (see [waiting-on](../waiting-on.md)).

<!-- build step 3 part 5 decisions and the plan's Q9 b answers, resolved 2026-10-03 -->

- **RESOLVED 2026-10-03 (Davin) - build step 3 part 5 decisions (replay and determinism, `docs/handoffs/2026-10-03-0830-step3-part5.md` section 6), all confirmed as built.** (1) all six replay verdicts stay, including `STORED_READING_CORRUPT` and
  `NOT_REPLAYABLE` with its cause; (2) a tampered bundle ends the replay before the Python runner starts; (3) to (6) the JSON round trip of the stored text, the temporary configuration that carries the stored flags, the fixture hash comparison and the
  read-only `--db` stay as built; (7) part 4's carry-forwards: item 9 (the planner-dependent index-use test of part 2) is taken up in part 7, and item 10 (part 3's decision 6) stays as built, the M15 reading is left out, and the cycle STALE, when its cycle is
  not READY. **Plan Q9 (b), the arithmetic of `state_statistics`, answered the same day:** the reference price is the close of the last closed M5 bar at the slot (`last_closed_bar.close`, the bar opened at T - 300); the forward move at the horizon H
  (2 h = 24 M5 bars, 12 h = 144) is `P_horizon - P_ref` for LONG and NEUTRAL / STAND_ASIDE (raw), `P_ref - P_horizon` for SHORT, in USD per ounce; the spread is the first and third quartile beside the median; the adverse excursion, never negative, is
  `max(0, P_ref - min(low))` for LONG, `max(0, max(high) - P_ref)` for SHORT and `max(|P_ref - min(low)|, |max(high) - P_ref|)` for NEUTRAL / STAND_ASIDE, over the bars of `[T, T + H]`; `opposing_level_rate` stays NULL until step 4 defines levels and stops
  (part 2 D4). Built in part 6 (`mcd_worker/statistics/`).

<!-- build step 3 part 6 decisions, resolved 2026-10-03 -->

- **RESOLVED 2026-10-03 (Davin) - build step 3 part 6 decisions (`state_statistics` and the n >= 30 gate, `docs/handoffs/2026-10-03-1000-step3-part6.md` section 6), all confirmed as built.** (1) strict window integrity stays: an outcome needs every M5 bar of its window, so an occurrence whose window spans
  a closure or a gap is left out of n and is never stretched; (2) ADR-022 stays as written: n counts cycle occurrences (not independent episodes); (3) the choice of which readings count as occurrences (CAUTIONARY readings, readings under enforced RETUNING) is DEFERRED to the B4
  historical replay, to be decided on the real counts; (4) the Q9 (b) arithmetic is recorded in `docs/STACK-D-ARCHITECTURE.md` section 2.8 (done in part 7); (5) all the smaller builder's calls of hand-off section 6 stay as built (the `PROVISIONAL` reasons and words, `NO_HISTORY` for a series never seen,
  one bias per state in a series, the golden rows under `mcd_worker/tests/data/`).

<!-- session 2026-10-03 step3-phase-a-commit, resolved -->

- **RESOLVED 2026-10-03 — session B's findings F1 to F5 on build step 3 Phase A** (check: `docs/handoffs/2026-10-03-1415-step3-session-b-check.md`; Davin's answers applied in `docs/handoffs/2026-10-03-1510-step3-commit.md`).
  **F1** "a detection mismatch gives CAUTIONARY" was not met as written (the specs and tests end the reading STALE or INVALID): option (a), the words changed, not the MCDs: architecture 2.4 and 2.11 and standard T6 say CAUTIONARY is recorded at tier 1 and the checks continue; `sensors-worker.pg.spec.ts` has the scenario through the whole worker (STALE with `[DETECTION_MISMATCH, NO_STATS_AT_SLOT]`, on M5 and on M15); no MCD version change.
  **F2** item 7 ("during a promote every sensor reports CAUTIONARY") holds only with `SENSOR_RETUNING_ENFORCED=true`: architecture 2.11 item 7 says enforcement defaults to false in production until the B5 promote rehearsal. **F3** "flag off until all nine items pass" was out of date: architecture 2.9 and 2.11 item 9, standard R14 and section 13 say `shadow` requires items 1 to 6 and `live` all nine (Q7).
  **F4** runbook section 7 said a missing interpreter is retried three times: it is discarded at once (as is a refused configuration, exit 2); a crash, a timeout and a database failure are retried. **F5** `mcd_worker/guards.py` now also refuses "percent", "percentage" and the plural in free texts (whole words, any case).
  Also resolved here: part 7's open item "the `DETECTION_MISMATCH` scenario through the worker is not in a spec" (it is, with F1).

<!-- session 2026-10-03 step3-sync-kit, resolved -->

- **RESOLVED 2026-10-03 — the open items of the Phase A commit hand-off that the sync-kit order closed** (`docs/handoffs/2026-10-03-1535-step3-sync-kit.md`). (a) The standard's version: PATCH **1.0.5**, header "Version 1.0.5, 3 October 2026 (PATCH: align R14, T6 and §13 with Decision Q7 and approved MCD specs)", commit `66dca628`. (b) `docs/handoffs/2026-10-02-1635-step2-commit.md` was untracked and linked from two step 3 hand-offs: it is committed with the step 3 commit hand-off in `66dca628`. (c) `scripts/sync-sensor-kit.js` "not built": built and committed in `4797ffa8` (the runbook's 34 files in `railway-gateway/sensors/`, `npm run sync:sensor-kit` and `check:sensor-kit`, 58 tests).
  The text of the open items as the Phase A wrap-up left them: "(3) before B0, `sync-sensor-kit.js` and Python in the Railway image; before B4, a statistics command and a point-in-time replay; (4) the standard's header says 1.0.4 although R14, T6 and section 13 changed: PATCH 1.0.5 or not (Davin); (5) `docs/handoffs/2026-10-02-1635-step2-commit.md` is untracked and linked from two step 3 hand-offs: commit it or not (Davin)." Python in the image, the statistics command and the point-in-time replay stay open.

<!-- session 2026-10-04 step4-part2, resolved -->

- **RESOLVED 2026-10-04 (Davin) — the five readings of the build step 4 part 1 hand-off** (`docs/handoffs/2026-10-04-0156-step4-part1.md` section 6): (1) a data stand-aside is an INVALID or STALE reading with STAND_ASIDE (the primary sensor STALE gives `UPSTREAM_STALE:<id>`, otherwise `UPSTREAM_UNAVAILABLE:<id>`), approved as built; (2) a cycle with no match counts every available sensor as read for caution, approved; (3) MCD3's redundant `UPSTREAM_CAUTIONARY:<id>` echoes are dropped from the reasons a reading carries: **changed in part 2**, with the safeguard that a CAUTIONARY reading keeps them only when nothing else explains the caution; (4) the loader requires the data check as each trader type's first row, approved; (5) `inputs` is an object per sensor and the architecture 3.5 example is corrected in part 7, approved. The rules table of 3.4 was approved as `draft-1` on the same date.

<!-- session 2026-10-04 step4-part3, resolved -->

- **RESOLVED 2026-10-04 (Davin) — the six readings of the build step 4 part 2 hand-off** (`docs/handoffs/2026-10-04-0226-step4-part2.md` section 6), all approved as built: (1) D7 (e) kept as built, a level between the reference price and the zone's far edge counts as the opposing level too (conservative obstacle detection); (2) M15 levels count as structure and as confluence; (3) levels come from every available sensor, not only those the matched rule read; (4) a LONG whose price is below the whole M5 channel has no zones (`NO_ZONE_SOURCES`), noted for Report 1's wording (step 7); (5) the `context_levels` JSON shape `{"M5": {"sr_1": 4369.57, "sr_2": null, ...}, "M15": {...}}` approved (built in part 3); (6) the extended zone audit fields approved. He then ordered part 3 (runner integration, additive `context_levels`, the `SYN` flag, rebuilt fixtures; the 12 MCD envelope hashes byte-identical; standard version bumped; `sync-sensor-kit` verified), which is built: hand-off `docs/handoffs/2026-10-04-0319-step4-part3.md`.

<!-- session 2026-10-04 step4-part4, resolved -->

- **RESOLVED 2026-10-04 (Davin) — the build step 4 part 3 hand-off** (`docs/handoffs/2026-10-04-0319-step4-part3.md`), approved including its decisions 1 to 6: (1) the sensor kit sync list grew in part 3 (45 files) rather than part 5, kept as built; (2) `INPUTS_REFUSED` is a legal `data_status` of a SYN reading; (3) a failed synthesis gives no SYN rows for the cycle (`synthesis.error`); (4) `synthesis` is part of `deterministic_dict`; (5) the gateway's bundle validator allows `context_levels`; (6) the two small gateway edits beyond the bundle type. He ordered parts 1 to 3 committed locally by explicit paths in logical commits (no `git add -A`, no push), which is done (`45d6695d`, `bade01c9`, `091c67fc`, `d44575be`, `46e7f9f8`), and then part 4, built: hand-off `docs/handoffs/2026-10-04-0508-step4-part4.md`.

<!-- session 2026-10-04 step4-part5, resolved -->

- **RESOLVED 2026-10-04 (Davin) — the build step 4 part 4 hand-off** (`docs/handoffs/2026-10-04-0508-step4-part4.md`), approved including its six choices: (1) no foreign keys; (2) the database re-derives the SHA-256 and the JSONB copy of every stored text; (3) **option (a)** for transaction safety: the writer pre-validates readings, zones and every CHECK invariant in TypeScript before the single atomic transaction (built in part 5); (4) retention not defined, kept like `mcd_outputs`; (5) refused readings are logged (built in part 5; counted by part 6's kit); (6) the constants in the database (5 zones, a stop of at least 13) need a new migration to change, and a test must hold `zone_params.yaml`'s `min_stop_distance` to the database's 13 (built in part 5, `sensors-synthesis-rows.spec.ts`). He ordered part 4 committed locally in one clean commit by explicit paths (done: `d800adc5`) and then part 5, built: hand-off `docs/handoffs/2026-10-04-0813-step4-part5.md`.

<!-- session 2026-10-04 step4-part6, resolved -->

- **RESOLVED 2026-10-04 (Davin) — the build step 4 part 5 hand-off** (`docs/handoffs/2026-10-04-0813-step4-part5.md`), approved including its decisions 1 to 5: (1) **keep `SYN_TABLES_MISSING`** (the gateway asks once whether the two SYN tables exist and leaves the SYN rows out if not, so a gateway with `SYN` on before the migration loses no sensor rows); (2) refused readings are **counted from the log lines and the job outcomes** (built in part 6: `--log`, `--jobs`, `--redis`); (3) `context_levels` are read when the job runs and frozen in the stored bundle; (4) the twin of the 25 CHECKs stays a second copy; (5) there is no gateway-side SYN switch (the flag is the engine's). He ordered part 5 committed locally by explicit paths (done: `4302b510`, not pushed) and then part 6, built: hand-off `docs/handoffs/2026-10-04-1118-step4-part6.md`.

<!-- session 2026-10-09 step4-part7, resolved -->

- **RESOLVED 2026-10-09 (Davin's order) — build step 4 part 6 is committed locally as `506018d1`** (25 files by explicit path; hand-off `docs/handoffs/2026-10-04-1118-step4-part6.md`). The work had been kept in `stash@{0}` (`wip-railway-gateway-step4-part6`), restored with `git stash apply` (the stash is still there: applied, not dropped). The one conflict (`davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`) was resolved by keeping HEAD's version; the unrelated mobile-app and asset changes were not touched (the status was identical before and after). The restore wrote the 25 files back with CRLF, which failed one spec (the shebang check of `scripts/replay-cycle.js`); they were converted back to LF and the gateway was re-run clean (63 suites, 10 skipped, 2,686 tests, 0 failures; `tsc` clean). **Not resolved by the order:** the six choices of the part 6 hand-off section 6 (still open above). Also found: parts 1 to 5 (`45d6695d` to `4302b510`) are already on `origin/main`, so the "NOT pushed (seven commits)" lines of the older entries are out of date; only `506018d1` (and part 7, uncommitted) are not pushed.
- **RESOLVED 2026-10-09 — build step 4 part 7 is built** (the first golden scenarios, architecture 3.5 and 3.7 corrected, ADR-084 to ADR-092, the runbook's SYN steps, the closing): see the part 7 entry above and `docs/handoffs/2026-10-09-1024-step4-part7.md`. Its own open items are in the part 7 entry of [waiting-on.md](../waiting-on.md).
- **RESOLVED 2026-10-09 (Davin) — the part 7 hand-off** (`docs/handoffs/2026-10-09-1024-step4-part7.md`) is reviewed and approved, **and all 16 golden scenarios are signed** (`approved_by` Davin, `approved_on` 2026-10-09; the hashes recorded when each was generated were left as he reviewed them; `python -B -m mcd_worker.tools.golden check --require-approved` passes with 16 approved, 0 pending, 0 problems). Part 7 was then committed locally by explicit paths (not pushed) and `stash@{0}` (`wip-railway-gateway-step4-part6`, already committed as `506018d1`) was dropped. His other choices of the hand-off section 6 are not answered by this order and stay open in [waiting-on.md](../waiting-on.md).

<!-- session 2026-10-10 step5-part3, resolved -->

- **RESOLVED 2026-10-10 (Davin's order) — build step 5 part 2 is committed locally as `c1d49d9f`** (25 files by explicit path; hand-off `docs/handoffs/2026-10-09-2224-step5-part2.md`), **and the ten readings of its section 6 are approved as built.** The open text this replaces, verbatim:

- Build step 5 part 2 (2026-10-10): structure levels, stop options, room and badge BUILT and NOT committed (Davin: stop after part 2), nothing deployed, no migration, no dependency, nothing in the app imports the module · **part 1 is COMMITTED LOCALLY (`b6cb56ae`, not pushed) after Davin approved the eight readings of its hand-off as built (resolved)** · OPEN, Davin: (1) the ten readings of `docs/handoffs/2026-10-09-2224-step5-part2.md` section 6, built as the default: where a stop option comes from, Min SLD on the stop, the pre-selection, **the badge table's open cells** (conflict, "the trend on M5 and M15", the highest fitting scenario within the cap, none at the 1.50 floor for a counter-trend setup), room and badge on the target's chart level, **degrade when a stored zone disagrees with its levels (an addition)**, the reader all-or-nothing and not in the barrel, the loosened guard for `read/`, `DecimalLike` admits `Rational`, files beyond the plan's list · (2) commit part 2 by explicit path; push `506018d1`, `706852a0`, `6e8d6a2f`, `b6cb56ae` and part 2 · (3) the plan's own to-dos (D12, D13, D14, D16) as in the line below · production must pass `expectedInputsSha256` and `expectedEnvelopeSha256` from the SYN reading to the reader · next: part 3 (the offer check, the Tier-1 blackout, the broker figures) ·

- **RESOLVED 2026-10-10 (Davin's order, in the part 2 session) — build step 5 part 1 is committed locally as `b6cb56ae`** (26 files by explicit path; hand-off `docs/handoffs/2026-10-09-1620-step5-part1.md`), **and the eight readings of its section 6 are approved as built.** The open text this replaces, verbatim:

- Build step 5 part 1 (2026-10-09): arithmetic and sizing (`lib/engine4/`, the oracle `scripts/engine4/oracle.py`, 9 test files with 2,048 tests) BUILT and NOT committed (Davin: do not commit or push), nothing deployed, no migration, no dependency, nothing imports the module yet · **the step 5 plan is APPROVED in full by Davin (D1 to D17, A1 to A7, every recommended option)** (resolved) · OPEN, Davin: (1) the readings of the hand-off `docs/handoffs/2026-10-09-1620-step5-part1.md` section 6, built as the default: **the leverage steps use the fill price (a gap in D3, money maths)**, the broker's maximum lot is a third limit, the counter-trend cap (profile: Trend Countering only; a counter-trend setup lowers Normal to 2.50), no leverage floor above zero, exact underflow figures rounded UP by the template, a self-contradicting broker row refused, targets shown on an underflow, the 2.3 MB fixture · (2) commit part 1 by explicit path; push `506018d1`, `706852a0`, `6e8d6a2f` and part 1 · (3) the plan's own to-dos, none blocks building: D12 provision `ENGINE4_AUDIT_HMAC_KEY` (part 5), D13 the Tier-1 event ids from production `economic_events` (part 3, to go live: until then the check fails closed), D14 counsel on the disclaimer and consent wording (part 7), D16 the red root `tsc` (364 errors, all in the untracked `davintrade-mobile-app/`) · "every mutant killed" is not literally true: 26 of 435 survive as equivalent or unreachable (hand-off section 4) · next: part 2 (structure levels, stop options, room, badge) ·

<!-- session 2026-10-10 step5-part4, resolved -->

- **RESOLVED 2026-10-10 (Davin's order) — build step 5 part 3 is committed locally as `07cc26ec`** (31 files by explicit path; hand-off `docs/handoffs/2026-10-09-2340-step5-part3.md`), **and the thirteen readings of its section 6 are approved as built.** The open text this replaces, verbatim:

- Build step 5 part 3 (2026-10-10): the offer check, the Tier-1 blackout, the broker figures and three readers BUILT and NOT committed (Davin: stop after part 3), nothing deployed, no migration, no dependency, nothing in the app imports the module · **part 2 is COMMITTED LOCALLY (`c1d49d9f`, not pushed) after Davin approved the ten readings of its hand-off as built (resolved)** · OPEN, Davin: (1) the thirteen readings of `docs/handoffs/2026-10-09-2340-step5-part3.md` section 6, built as the default: **the live data status comes from the gateway, not a TypeScript twin (not supplied = not offered)**, what else fails closed beyond the empty list (an incomplete Tier-1 list, an unreadable calendar, an unusable synthesis, no zone or price, bad specs), window edges inclusive and an unknown `time_mode` approximate, what counts as a changed synthesis, what the past-invalidation test uses, half risk from `retuning_observed`, a style notice both ways, the calendar's age is the age of the newest observation, the extra fields of the Tier-1 file, `Number(<bigint>)` allowed by the guard, typed default clients with no cast, files beyond the plan's list · (2) **D13: the four Tier-1 event ids from production `economic_events` (the read-only query is in the hand-off section 9): until then every offer is "not offered: calendar list not set"**, and until the exporter runs on a terminal (F9) "no broker figures" · (3) commit part 3 by explicit path; push `506018d1`, `706852a0`, `6e8d6a2f`, `b6cb56ae`, `c1d49d9f` and part 3 · (4) the plan's other to-dos (D12, D14, D16) · when the ids are in the file, three tests that document the empty state change in the same commit (hand-off section 5) · production must pass `expectedInputsSha256` and `expectedEnvelopeSha256` to the structure reader (part 2) · findings: the calendar's age is the age of the newest observation (rows are written on change), and `lib/economic-events/queries.ts` can return a stale observation (hand-off section 7) · next: part 4 (the single validator and the modal definition) ·

<!-- session 2026-10-10 step5-part5, resolved -->

- **RESOLVED 2026-10-10 (Davin's order) — build step 5 part 4 is committed locally as `eba2b64d`** (20 files by explicit path; hand-off `docs/handoffs/2026-10-10-0320-step5-part4.md`), **the thirteen readings of its section 6 are approved as built, and D12 is approved: a `key_version` integer is stored beside each `user_id_hash`, and an old hash is never recomputed when `ENGINE4_AUDIT_HMAC_KEY` is rotated.** The open text this replaces, verbatim:

- Build step 5 part 4 (2026-10-10): the entry bound, the single validator and the modal definition BUILT and NOT committed (Davin: stop after part 4), nothing deployed, no migration, no dependency, nothing in the app imports the module · **part 3 is COMMITTED LOCALLY (`07cc26ec`, not pushed) after Davin approved the thirteen readings of its hand-off as built (resolved)** · OPEN, Davin: (1) the thirteen readings of `docs/handoffs/2026-10-10-0320-step5-part4.md` section 6, built as the default: what `ValidatedSetup` holds (the validation, the sizing, the scenarios, the underflow help; NOT the badge), the fields (all required, `stopDistance` in dollars, equity read under check 1), an entry is a zone price or a custom entry by its VALUE, the 5% filter before the day range and what is not known refuses a custom entry, the one-day range (closed bars, no minimum count), check 6 is the offer check run again (rows 6, 7 and 9; the blackout is check 5, the broker figures check 7), no broker figures fails check 7, the PASS / FAIL / SKIPPED statuses, the override record above the half-risk pre-set, the modal definition (a zone past its invalidation stays a flagged pill), no separate Engine 4 version string, additive changes to earlier parts · (2) **D12 before part 5: what happens to old hashes when `ENGINE4_AUDIT_HMAC_KEY` is rotated (my default: never recomputed, a key version stored beside each hash)** · (3) D13, the Tier-1 ids (until then check 5 fails for every setup); commit part 4 by explicit path; push `506018d1`, `706852a0`, `6e8d6a2f`, `b6cb56ae`, `c1d49d9f`, `07cc26ec` and part 4 · (4) the plan's other to-dos (D14, D16) · the reader of the M5 bars (`market_data_v6`: `timestamp`, `high`, `low`) is not built (part 6) · production must pass `expectedInputsSha256` and `expectedEnvelopeSha256` to the structure reader (part 2) · next: part 5 (the three tables and stores, a migration FILE) ·

<!-- session 2026-10-10 step5-part6, resolved -->

- **RESOLVED 2026-10-10 (Davin's order) — build step 5 part 5 is committed as `19b8b216` (Davin pushed it later the same day)** (25 files by explicit path; hand-off `docs/handoffs/2026-10-10-0445-step5-part5.md`), **and the twelve readings of its section 6 are approved as built** (the CURRENT profile cascades on deleting the account while the history and the consent record keep `user_id` NULL; the migration is in `prisma/migrations/`; canonical decimal TEXT; the counter-trend cap is also a database rule; an unchanged save writes no snapshot; a missing `ENGINE4_AUDIT_HMAC_KEY` stops every write and only `NODE_ENV=test` uses the public test key; the trigger lets `user_id` go to NULL; what the consent record stores; what `recordConsent` refuses; `ENGINE4_VERSION = '1.0.0'`). The open text this replaces, verbatim:

- Build step 5 part 5 (2026-10-10): the three tables (`user_trade_preferences`, `user_trade_preferences_history`, `trade_consent_records`), the keyed user-id hash and the stores BUILT and NOT committed (Davin: stop after part 5); **the migration `20261010000000_add_engine4_tables` is a FILE, NOT applied** (applied only on a throwaway local PostgreSQL 18, zero drift), nothing deployed, no dependency, nothing in the app imports the module · **part 4 is COMMITTED LOCALLY (`eba2b64d`, not pushed) after Davin approved the thirteen readings of its hand-off and D12 (resolved)** · OPEN, Davin: (1) the twelve readings of `docs/handoffs/2026-10-10-0445-step5-part5.md` section 6, built as the default: **the CURRENT profile cascades on deleting the account while the history and the consent record keep `user_id` NULL (a departure from the order's literal "SET NULL")**, the migration is in `prisma/migrations/` (the order's folder does not exist), the profile figures are canonical decimal TEXT, the counter-trend cap is also a database rule, an unchanged save writes no snapshot, **a missing `ENGINE4_AUDIT_HMAC_KEY` stops every write and only `NODE_ENV=test` uses the public test key**, the trigger lets `user_id` go to NULL (so a `User.id` cannot be changed while audit rows name it), what the consent record stores, what `recordConsent` refuses, `ENGINE4_VERSION = '1.0.0'` · (2) **before any route writes: provision `ENGINE4_AUDIT_HMAC_KEY` (32 characters or more) and `ENGINE4_AUDIT_HMAC_KEY_VERSION` in Vercel, run `prisma migrate status`, and apply this migration (it needs none of the three older pending ones)** · (3) D13, the Tier-1 ids; commit part 5 by explicit path; push the seven local commits (`506018d1`, `706852a0`, `6e8d6a2f`, `b6cb56ae`, `c1d49d9f`, `07cc26ec`, `eba2b64d`) and part 5 · (4) retention (7 years, architecture 7.5) has no job and the trigger forbids a DELETE, so the first retention job needs its own decision · (5) D14, D16 of the plan · next: part 6 (the routes, the first callers of the stores, and the reader of the M5 bars) ·

<!-- session 2026-10-10 step5-part7, resolved -->

- **RESOLVED 2026-10-10 (Davin's order) — build step 5 part 6 is committed locally as `b60f5223`** (44 files by explicit path, one of them part 6's sixth route-layer test file, which the order's list had left out; hand-off `docs/handoffs/2026-10-10-0840-step5-part6.md`; not pushed), **and all the decisions of its section 6 are approved as built** (the consent route requires `shownSetupSha256`; one submit, one record through a Redis guard that fails open; a `shadow` SYN reading is offered and the flag reported; the badge is decided on the server and not when the levels cannot be read; the template and disclaimer versions are DRAFT strings; the names and shapes of the routes). The open text this replaces, verbatim:

- Build step 5 part 6 (2026-10-10): the four routes `app/api/engine4/{profile,offer,size,consent}`, the route layer `lib/engine4/server/` and the readers of the closed M5 bars and of one stored synthesis reading BUILT and NOT committed (Davin: stop after part 6); **off unless `ENGINE4_REPORT2_ENABLED` is exactly `true` (set nowhere), 404 to everybody otherwise**, nothing deployed, no migration, no dependency, nothing in the app calls the routes · **part 5 is COMMITTED (`19b8b216`) and PUSHED (Davin pushed everything through it while part 6 was built) after he approved the twelve readings of its hand-off as built (resolved)** · OPEN, Davin: (1) the readings of `docs/handoffs/2026-10-10-0840-step5-part6.md` section 6, built as the default: **the consent route requires `shownSetupSha256` and refuses a setup that is not the one shown (409 `SETUP_CHANGED`)** (3); **one submit writes one record through a Redis guard that fails open, not a database guarantee: as built, or a unique `submission_id` column in the part 5 migration, or both (recommended before the flag goes live)** (4); **a `shadow` SYN reading is offered like a `live` one, the flag is reported** (6); the badge is decided on the server and not decided when the levels cannot be read (7); the template and disclaimer versions are DRAFT strings (8); the names and shapes of the routes (1) · (2) **before the flag goes on: provision `ENGINE4_AUDIT_HMAC_KEY` (32 characters or more) and its version, `REDIS_URL` and `MARKET_GATEWAY_URL` / `MARKET_GATEWAY_API_KEY` where the routes run, run `prisma migrate status`, apply the part 5 migration** · (3) D13, the Tier-1 ids; commit part 6 by explicit path · (4) **RESOLVED while part 6 was built: the push, and D16 (Davin's commits `00470ef3`, `c72f95bd` and `f1adf52d` fixed the 5 errors his `6674f302` had added and excluded `davintrade-mobile-app` in `tsconfig.json`; the root `tsc` exits 0 with 0 errors)** · (5) retention, D14 · still true: no rate limit and no `Origin` check on the routes; the two new market readers never ran against a real database; the Redis guard cannot stop two racing presses when Redis is down · next: part 7 (Report 2, the modal and the card) ·
