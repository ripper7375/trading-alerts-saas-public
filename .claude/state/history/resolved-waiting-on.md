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
