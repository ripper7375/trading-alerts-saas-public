---
type: Concept/BlockersAndTraps
status: active
severity: high
updated_at: 2026-11-28
tags: [blockers, deploys, migrations, verification, stack-c, stack-d]
related_docs:
  - ../architecture/database-traps.md
  - ./history/resolved-waiting-on.md
  - ./history/waiting-on-details-archive-2026-11-25.md
  - ./current-state.md
---

# Waiting on — open blockers and unverified items

Concise index of genuinely open items. When resolved, move to
[resolved-waiting-on.md](./history/resolved-waiting-on.md). Full verbatim pre-slim details
(snapshot 2026-11-25) are in [waiting-on-details-archive-2026-11-25.md](./history/waiting-on-details-archive-2026-11-25.md);
search it with `Grep` instead of bulk-reading.

> **Commit bundle reminder:** Before committing `waiting-on.md` or `.claude/state/`, always stage their linked
> untracked files together — especially `docs/handoffs/2026-11-27-stack-d-handoff-and-vultr-cutoff.md` and
> [waiting-on-details-archive-2026-11-25.md](./history/waiting-on-details-archive-2026-11-25.md) — and verify with
> `node scripts/agents/check-operating-docs.mjs` (without `--tracked-only`) so relative links never break on `main`.

## Payments & Launch

- **dLocal retirement order (2026-11-23) — OPEN (Davin + Advisor):** dLocal declined a production
  account, so integration is sandbox-only and DavinTrade has not launched. Void: real dLocal webhooks,
  sandbox runs, dLocal half of B.4 / 415 watch. Needs retirement order: post-dLocal payment method for
  10 countries, 3-day trial / Renew-now fate, `DLOCAL_*` env vars, sandbox webhook, wording/OpenAPI.
  Re-derive footprint with `git grep -il dlocal`.

## Security, CI & Governance

- **Admin sign-in finding (2026-11-26) — OPEN (Davin):** read, not tested. Details are only in the gitignored
  `davintrade-pre-launch-security-check-lists/` (note dated 2026-11-26).
- **Ruleset Stage 2 on `main` (2026-11-21) — OPEN (Davin):** Stage 1 (`27789976`, no delete/force-push)
  is active. Stage 2 (PR required + checks) is drafted in gitignored
  `davintrade-security-monitoring-pipeline/rulesets/README.md` and needs Davin's explicit sign-off.
- **Dependabot non-prod triage (2026-11-21) — WATCH OPEN (Davin):** [PR #520](https://github.com/ripper7375/trading-alerts-saas-public/pull/520)
  cleared 5,408 non-prod alerts (90 live remain). Open: (1) confirm daily scheduled run (`17 19 * * *`
  UTC) keeps `failed=0`; (2) rotate `DEPENDABOT_TRIAGE_TOKEN` every 90 days (by 2027-02-19).
- **Security follow-up PRs (#511–#519, 2026-11-21) — OPEN items (Davin):**
  (a) `money-service` launch-day webhook watch (Stripe/RiseWorks 2xx, no 5xx; dLocal void);
  (b) optional `pgbouncer` `verify-1-3b` grant check & 1.26.x decision;
  (c) unread exact `node -v` patch on Railway, Vercel, and chat VPS;
  (d) `Check Production Migration Status` fails on `main` solely on unapplied `20261114000000_add_trendline_context_tables`;
  (e) 6 service major-upgrade advisories (OpenTelemetry `0.x`, `zod`) deferred;
  (f) local checkout sync (mind 3 chat VPS docs from [PR #515](https://github.com/ripper7375/trading-alerts-saas-public/pull/515));
  (g) security-pipeline blueprint update deferred.
  Checklist: [2026-11-21-post-security-followup-checklist.md](../../docs/handoffs/2026-11-21-post-security-followup-checklist.md).
- **Pre-launch security remediation WS-1..WS-17 (2026-10-23..24) — OPEN (Davin):**
  Full plan/checklists live in gitignored `davintrade-pre-launch-security-check-lists/`.
  Open: Phase 0 ops items, Deviations/deploy waves for WS-1..15 (`20261024000000`, `20261025000000`,
  `20261026000000` are already applied in prod per `main` CI check and on `davintrade-dev-db` 2026-11-28; check
  `PAYMENT_DETAILS_ENCRYPTION_KEY` + backfill status before affiliate writes), follow-ups WS-8b and WS-12b, and
  go/no-go on WS-18 (nonce CSP) & WS-19 (Postgres TLS).
- **Node 24.22.3 floor & Brotli guard (`e6fd6494`, 2026-11-12) — OPEN (Davin):**
  Developer machine upgraded to `24.22.3`; guard deployed 2026-11-17. Open: verify patch >= `22.23.5` /
  `24.22.3` on Railway, Vercel, and chat VPS; launch-day 415 check on `money-service` webhooks;
  optional `zstd` refusal decision.
- **Credential clean-up leftovers (2026-10-31) — OPEN (Davin):**
  Confirm 7 legacy password strings in `docs/migration/claude-chat-example-conversation.md` were never real;
  enable `secret_scanning_non_provider_patterns`; revoke old Vercel/Railway tokens; resolve Steps 7, 9, 10;
  fix stale `NOT pushed` note wording on next code batch; and queue pre-launch rotation of `NEXTAUTH_SECRET`
  (Vercel Prod + `operation-service` + `money-service`) and `RESEND_API_KEY` (same 3 targets), which also existed
  in the retired `prisma-migration` service (`Services (0)` removed 2026-11-28; see
  [resolved-waiting-on.md](./history/resolved-waiting-on.md)).

## Stack D, VPS Pipeline & Trading Engine

- **⛔ HARD PRE-DEPLOY GATE — `knowledge-service` (Davin, 2026-11-26) — OPEN:** do **not** build or deploy
  `knowledge-service` until `knowledge-service/corpus/D2/mcd0.md` states the MCD0 1.1.0 bounds, the text is
  approved again, and `knowledge-service/tests/test_corpus_d1_d2.py` passes (not in CI; needs `pytest`).
  Today it still states the 1.0.0 bounds to the user.
- **Stage B4 & calibration (2026-11-26) — OPEN:** B3 closed 2026-11-26
  (`docs/handoffs/2026-11-26-b3-evidence/b3-exit-record.md`). Davin confirmed the Advisor's Q1–Q5
  (`docs/handoffs/2026-11-26-antigravity-reply-b3-b4.md`). Davin confirmed 2026-11-26: M5 `most_recent` (applied
  later with MCD0 1.1.0), flags 10–25% per TF, keep `draft-1`, Q5 close steps, log filter with that deploy. Sweep:
  Davin confirmed MCD0 1.1.0 = variant A4. **Pushed and deployed 2026-11-26** (`12f69ed3`; gateway and Vercel).
  **M5 switched to `most_recent` from slot 1795704000 (2026-11-26 14:40Z)**, `ACTIVE_INDICATOR_FROM_GATEWAY` unset;
  database check 12/12 over 13 slots (`docs/handoffs/2026-11-26-m5-switch/`). Open: measure MCD0 flag rates on the
  new setting over several trading days (first hour M5 7/13, all `FIT_B`: too small to judge; switch accepted
  2026-11-27, thresholds not to be adjusted on it; print `fit_b` beside `fit_a` at the next check); the new MCD2/MCD3
  statistics series count from that slot. Open before B5: `draft-2`; SYN half-risk from the MCD3 modifier; M15
  `non_b` permanent breakdown driving LONG snapbacks (now full risk more often); MCD3 reads bars older than the
  288-bar priority push (3 `INVALID` 19–20 Nov). No B4 `--write`; `InpExtendLinesToCurrent` unread.
- **Web cutover to the gateway's active indicator (Step 2 §7) — OPEN (Davin):** the flag is unset, so the web chart
  overlay defaults to `best_fit_a` while the sensors read M5 `most_recent`; the VPS renderer images are unchecked.
  Waits for the write-key decision of §1.5, then a §7 order. Done 2026-11-27 (Davin): `MARKET_GATEWAY_API_KEY` is
  type Secret in Vercel, value unchanged.
- **Centroid Watchdog D4 follow-the-drift (2026-11-25) — OPEN:**
  Recency filter `d2d78f762cf0` live; D4 (`98543acd7af9`, 6 bars) APPROVED by the Advisor, not deployed: Davin
  still to confirm the deployment with a state re-seed
  (`docs/handoffs/2026-11-25-watchdog-follow-review-followup.md`); webhook stays empty.
- **Terminal B hot standby & promote (2026-11-10..23) — OPEN (Davin):**
  Dry switch rehearsal passed 2026-11-21. Open: **Decision 1** (how RETUNING ends) before live promote / B5,
  auto-start policy after VPS reboot (runbook §9.8), and `install_services.bat` path comments.
- **Build steps 2–7 rollout & approvals — CODE COMPLETE, FLAGS OFF:**
  - _Step 2–4:_ Unapplied migrations (`20261002000000`, `20261003000000`, `20261004000000`), `symbol_specs`
    exporter live test, Python-in-Railway-image choice, B4 stats/replay commands, SYN live run & ADR-088.
  - _Step 5 (Engine 4 / Report 2):_ `submission_id` column decision before `20261010000000`,
    `ENGINE4_AUDIT_HMAC_KEY`, `config/engine4/tier1-events.json` IDs (D13), native/counsel read (D14).
  - _Step 6 (Intake / Knowledge):_ Native/counsel review of glossary & 10 refusal texts, live Understand
    model benchmark (stand-in only so far), `knowledge-service` Docker build & deploy (`S0`–`S7`, **behind the
    MCD0 gate above**),
    Panel C Option A confirmation & `deploy.yml`/`tests.yml` `workflow_call` fix (F5).
  - _Step 7 (Prompt & AI Reply):_ Unapplied migration `20261014010000_add_ai_metering_tables` &
    `20261014000000_add_reply_trace_and_chat_tables`, live model smoke (`S1`), `PRO_MONTHLY_UNITS` &
    reaper schedule, native/counsel sign-off on `config/reply/` prompts/wording/34 goldens/19 demos (`S5`),
    runbook `S0`–`S9`.
- **VPS push-worker & gateway items (2026-09-09..11):**
  Confirm which gateway the VPS push worker targets; measure push-worker throughput; address look-ahead
  bias on historical indicators; Decision Layer blocked (`v2_29_davintrade_decision_layer/` empty);
  (`railway-gateway` watch path is `/railway-gateway/**`, read 2026-11-26.)

## Infrastructure, Database, Billing & UI

- **Chat VPS pgAdmin check (2026-11-08) — OPEN (Davin):**
  On next snapshot restore/rebuild, run [contabo-chat-stack.md](../../docs/runbooks/contabo-chat-stack.md) §4
  commands first + rebuild 3-in-1 per `davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md`.
- **Empty `/pro/currency-index` chart on production (2026-11-28) — OPEN (Davin; gated on Thai Windows VPS):**
  Root cause verified 2026-11-28: the only producer of `currency_gold_indices`, `DavinTradeCurrencyIndexEngine`, was
  never installed, and its Vultr MT5 VPS was destroyed 2026-11-27. Production returns `{"indices":[]}`; the gateway
  logged 0 requests to the endpoint in 7 days. Not a weekend, query or migration fault (`<PROD_DB>` not read by SQL).
  Next: Phase 1 restore, then the Lane 4 steps in the
  [2026-11-27 handoff](../../docs/handoffs/2026-11-27-stack-d-handoff-and-vultr-cutoff.md)
  (commit that untracked handoff together with `waiting-on.md` so the link stays intact).
  Settled 2026-11-28 (Davin): 7 FX M5 charts on Terminal A; the engine reads A's existing `OHLCV_XAUUSD_M5.txt`
  (no second XAUUSD chart). Closing or retiring A without moving the charts and updating `CGI_EXPORT_DIR` pauses
  Lane 4 with no alarm. Future isolation upgrade: Terminal S (`C:\MT5-S`) once RAM >= 6–8 GB.
  _Optional pre-launch polish (Option B, not scheduled):_ honest empty/stale UI (no false `Spread: 0.00%`, mark an
  old session as stale); new text needs all 19 dictionaries.
- **Terminal chart live feed time base & CSP (2026-11-28) — OPEN:**
  `davintrade.app/terminal` renders M5 overlay + 36-slot margin (`8df7591e`), but no candlesticks yet
  ([2026-11-28 chart handoff](../../docs/handoffs/2026-11-28-chart-news-lines.md)). (a) `mt5-service/app/services/indicator_reader.py`
  forwards MT5 `rates[time]` unconverted (possible broker-time vs UTC offset); (b) `next.config.js` CSP `connect-src`
  lists no MT5 socket host and local `.env*` lacks `NEXT_PUBLIC_MT5_WS_URL`. Verify on live market open + Thai MT5 VPS.
- **Database ledger & Wave 2 scaling (2026-09-01..10-24) — OPEN:**
  `20260214000000_rag_dual_memory` marked applied in `_prisma_migrations` with 0 tables created (execute
  SQL manually when needed); Redis T5 latency decision (Unit R); Unit P-operation & F4 push/review;
  gateway/money-service pool deadline orders undrafted.
- **Billing, e-mails & UI verification — OPEN (Davin):**
  - _Manage Subscription S1–S4 (`48bf2bcf`, `1f0b9755`, `e02c8b08`, `9b40bf3d`):_ `STRIPE_PORTAL_CONFIGURATION_ID`,
    apply `20261021000000_add_subscription_management_fields` FIRST, deploy order (`operation` -> `money` -> monolith),
    authenticated checkout/portal review (S4 overlaps dLocal retirement).
  - _Account deletion F21 (`20261019000000_add_user_deleted_at`):_ apply BEFORE deploy.
  - _Disbursement payout settings (F83/F84):_ deploy + go-live checks; _15th indicator rollout_.
  - _Shared FX rates `REDIS_URL`_, _SystemConfig pricing deploy+test_, _Localized e-mails draft review_,
    _Chart-render 2 remaining items_, _Phase 12 handover prompt re-draft_, _`/help` & `/about` 404 on prod_,
    and pre-launch authenticated UI click-throughs (zh-TW, 18-batch locales, All Round Clock, sign-out, BI
    dashboards, `/settings/billing` FREE banner, Journey B).
