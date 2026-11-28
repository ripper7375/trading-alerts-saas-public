# Stack D Handoff & Vultr Cutoff Status (2026-11-27)

- **Author:** Antigravity (Advisor, Computer 1)
- **Date:** 2026-11-27 04:36 +07:00 (`2026-11-26T21:36:00Z`)
- **Purpose:** Clean session handoff for starting a **new Antigravity / Claude Code session** to provision Thai VPS hosting and finish **Stack D MVP 100% Live**.
- **Repository Baseline:** `origin/main` = `fd4e18d5` (Computer 2 synced to `fd4e18d5`; Computer 1 `HEAD` intentionally still at `f64698a3`, files already mirrored byte-for-byte via Syncthing — see Phase 0 before committing from Computer 1).

---

## 1. Completed Work & Current Live State

### 1.1 Stage B3, MCD0 1.1.0 & M5 Switch (`shadow` mode active on Railway)

1. **Stage B3 Closed (`2026-11-26`):** Evidence recorded in `docs/handoffs/2026-11-26-b3-evidence/`; Q1–Q5 answered in [2026-11-26-antigravity-reply-b3-b4.md](2026-11-26-antigravity-reply-b3-b4.md).
2. **`MCD0 1.1.0` (Variant A4, [ADR-101](../adr/101-mcd0-1-1-0-thresholds-and-r2-per-timeframe.md)) Built & Deployed (`12f69ed3`):**
   - Parameters: `r2_timeframes: [M5]`, `min_r2_model_a/b: 0.00` (M15 skips `R2_A`, `R2_B` while M15 uses `non_b`), `min_fit_ratio: 1.25–3.20`, `geo_ratio: 0.50–2.00`.
   - Verified on Computer 1: `mcd0.test_mcd0_unit_tests` `129/129` PASS (`T12 = 548` tokens in `o200k_base` <= 600), `test_golden` `65/65` PASS, Golden `01–03` re-approved (`16/16` `--require-approved`), clean worktree `test:ci` `21,665` passed / `0` failed.
   - Deployed `12f69ed3` to Railway `railway-gateway` (`37ecb038`, `LOG_LEVEL` unset so `Authorized caller:` debug spam is gone in production) and Vercel.
3. **M5 Active Indicator Switched to `most_recent` ([ADR-100](../adr/100-m5-active-indicator-is-most-recent.md), docs pushed in `fd4e18d5`):**
   - Davin confirmed `ACTIVE_INDICATOR_FROM_GATEWAY` is **NOT set** in Vercel Production and kept it unset (Step 2 §7 cutover deferred until §1.5 write-key decision).
   - `MARKET_GATEWAY_URL` and `MARKET_GATEWAY_API_KEY` added in Vercel Production (and `MARKET_GATEWAY_API_KEY` set to type **`Secret`** on `2026-11-27`); a `monolith_` key was appended to Railway `API_KEYS` (deployment `5352db9b`).
   - M5 switched to `most_recent` effective slot **`1795704000`** (`2026-11-26T14:40:00Z`); M15 remains `non_b`; new `MCD2` / `MCD3` statistics series started.
   - Live DB verification (`12/12` checks passed over 13 READY slots `14:40Z`–`15:40Z`): `MCD0` `1.1.0`, `M5=most_recent`, `M15=non_b`, `0` `NO_SETTING`/`NO_STATS_AT_SLOT`/`EVALUATOR_ERROR`; first-hour M5 `FIT_B` flag rate `7/13` (`54%`) is a single 35-minute run and NOT calibrated on yet. Full record: [2026-11-26-m5-switch-result.md](2026-11-26-m5-switch-result.md).

### 1.2 Vultr VPS Backup & Billing Cutoff (`2026-11-27`)

To stop ongoing Vultr charges while finishing Stack D on lower-cost Thailand VPS hosting:

1. **Clean Shutdown & Outbox Drain:**
   - Closed both MT5 terminals (`C:\MT5` and `C:\MT5-B`) cleanly via GUI, stopped `MT5Collector`, waited for `MT5PushWorker` to drain, and verified **`unsynced = 0`** across **all 5 outbox tables** in `C:\Scripts\database\xauusd.db` (`market_data`, `indicator_statistics`, `economic_events`, `cycle_manifests`, `symbol_specs`).
   - Stopped all 4 installed NSSM services (`MT5Collector`, `MT5PushWorker`, `MT5Renderer`, `DavinTradeCentroidWatchdog`). (`MT5Relay` and `DavinTradeCurrencyIndexEngine` were not installed.)
2. **Compact Local Backup Created & Verified:**
   - Original `xauusd.db` had grown to `25,868.1 MB` due to `9,342,000` un-pruned rows in `raw_best_fit_a` (across 15 `raw_*` staging tables / `17,365` cycles). Built a compact `xauusd.db` (`23.68 MB`) preserving 100% of `market_data` (`6,000`), `indicator_statistics` (`21,948`), `economic_events` (`752`), `cycle_manifests` (`1,376`), `symbol_specs` (`19`), latest `500` `collection_cycles`, `sqlite_sequence`, and full live schema/indexes/triggers.
   - Packaged `vultr-mt5-backup-2026-11-27.zip` (`394.99 MB`, `SHA-256: E2EAA41D5611F9EBEE5C4D42B0A7EB2102DAA32E5C48EC54A8C8D16AB0EB970C`) containing:
     - `nssm-registry/` (`MT5Collector.reg`, `MT5PushWorker.reg`, `MT5Renderer.reg`, `DavinTradeCentroidWatchdog.reg`) — **private, never store inside git repo**
     - `Scripts/` (`collector/`, `backfill/`, `renderer/`, `admin/`, `centroid_watchdog/`, `logs/`, `database/` with compact `xauusd.db`, `xauusd.db.pre-step2`, `centroid_watchdog_state.json`; skipped `rejected_rows.jsonl` `529.6 MB` and the bloated `25.9 GB` staging DB)
     - `MT5/` (`/XJ` skipped junction), `AppData-MetaQuotes-Terminal/` (real Terminal A data folder `E23367DD11DBEB0EF97D08185EAB7295` + `BC0920179969B4827B19D827E641184E` + `Common`), `MT5-B/` (portable), `MT5-B-ex5-backup-20261119/`, `mt5-paths-info.txt`, `python311-pip-freeze.txt`.
   - Copied directly over RDP Drive Mapping (`robocopy ... /Z`, `0 FAILED`) to Davin's private PC folder outside git, and verified exact `SHA-256` match.
3. **Vultr Teardown:**
   - Removed temp backup directory from VPS, shut down Windows (`Stop-Computer`), created Vultr snapshot `windows-mt5-paused-2026-11-27` (`100 GB`, `Complete`), deleted the two older snapshots (`webchat-setup-backup` `2026-09-10` and `No label` `2026-09-11`), and destroyed `davintrade-mt5-vps` (`Compute -> Instances` = `0`).
4. **Effect on Cloud Services While Paused:**
   - Railway (`railway-gateway`, Postgres, Redis) and Vercel remain untouched and safe; existing `mcd_outputs`, `market_cycles`, and `market_data_v6` rows stay intact. New live 5-minute cycles simply pause until the new Windows VPS starts pushing again.

---

## 2. Standing Guardrails (Do Not Break)

- **Flags stay `shadow`:** Keep `MCD0`–`MCD3` and `SYN` at `shadow` until `draft-2.yaml` + Stage B4 certification complete.
- **`ACTIVE_INDICATOR_FROM_GATEWAY` stays unset:** Do not enable until Step 2 §1.5 write-key decision and explicit Step 2 §7 cutover order.
- **⛔ Hard Pre-Deploy Gate on `knowledge-service`:** Never build or deploy `knowledge-service` until `knowledge-service/corpus/D2/mcd0.md` is updated to `MCD0 1.1.0` bounds, `knowledge-service/tests/test_corpus_d1_d2.py` passes, and `knowledge-service/corpus/approval/D2-MCD0.json` is re-approved by Davin.
- **Git & Secrets Hygiene:** Public repository. Never use `git stash` or `git add -A`. Never paste `.reg` keys, DB URLs, broker credentials, or real VPS IPs into tracked files or prompts (use aliases `<MT5_VPS_IP>`, `<CHAT_VPS_IP>`, `<PROD_DB>`). Preserve `.gitignore` (+2 local lines), `docs/runbooks/deploy-stack-d-step3.md` (+6 guardrail lines), and uncommitted `.claude/` OKF edits.

---

## 3. Remaining Work to Stack D MVP 100% Live

### Phase 0 — Local Hygiene (Before Next Commit / Switch)

1. **Computer 1 Git Realignment:** When convenient (and before any commit/pull on Computer 1), align Computer 1 `HEAD` from `f64698a3` to `fd4e18d5` (`git fetch origin main && git reset --mixed origin/main`) — do **not** commit/push/rebase from Computer 1 while `1` commit behind `origin/main`.
2. **After Thai VPS Runs Cleanly:** Delete emergency Vultr snapshot `windows-mt5-paused-2026-11-27` to bring Vultr billing to $0.

### Phase 1 — Provision Thailand VPS Hosting & Resume Shadow Ingestion

1. **Windows VPS (`MT5 + Collector + PushWorker + Renderer + Watchdog`):**
   - Provision Windows Server 2022 (`>= 2 vCPU / 4 GB RAM`; `4+ GB` recommended if running Terminal A + B together; verify outbound HTTPS to Railway/Cloudflare R2 and MT5 broker ports).
   - Install **Python 3.11** at `C:\Python311` + packages from `python311-pip-freeze.txt`, and install **NSSM**.
   - Extract `vultr-mt5-backup-2026-11-27.zip`: restore `C:\Scripts`, `C:\MT5`, `C:\MT5-B`, `C:\MT5-B-ex5-backup-20261119`, and `AppData-MetaQuotes-Terminal` -> `%APPDATA%\MetaQuotes\Terminal`.
   - Recreate the Terminal A directory junction (`cmd /c mklink /J "C:\MT5\MQL5\Files" "%APPDATA%\MetaQuotes\Terminal\E23367DD11DBEB0EF97D08185EAB7295\MQL5\Files"`), matching `mt5-paths-info.txt`.
   - Restore the 4 NSSM services (`MT5Collector`, `MT5PushWorker`, `MT5Renderer`, `DavinTradeCentroidWatchdog`) from `nssm-registry\*.reg` (or fresh `nssm install` + private `AppEnvironmentExtra`), log into MT5 broker, verify Algo Trading + charts (`EconomicCalendarExport_v2_29` + 15 indicators), start services, and verify live cycles land in `mcd_outputs` with `MCD0` `1.1.0` and `M5=most_recent`.
   - _Permanent pipeline bug fix BEFORE starting Thailand VPS services (required — see [DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md](../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md) §12 item 11):_
     - **Root cause found during Vultr backup:** `export_collector_validator_v2.py` `run_cycle()` calls `purge_cycle_rows(conn, cycle_id)` on rejected cycles only, **not** after a validated cycle finishes (`mark_cycle_finished`), which bloated `xauusd.db` to `25.9 GB` (`9,342,000` old `raw_best_fit_a` rows). Do **not** delete `collection_cycles` right after promote (`indicator_statistics` uses `ON DELETE CASCADE` on `cycle_id`).
     - **Fix in code + tests before deploying to Thailand VPS:** (1) call `purge_cycle_rows(conn, cycle_id)` immediately after `mark_cycle_finished(conn, cycle_id)` (so `raw_*` clears after `promote_cycle()` + `stage_statistics()` while `collection_cycles` and unsynced `indicator_statistics` stay intact) + add regression tests; (2) run `PRAGMA incremental_vacuum;` periodically (confirm `PRAGMA auto_vacuum = 2` on the restored compact `xauusd.db`); (3) add size-based rotation for `rejected_rows.jsonl` (`backfill_worker_api_gateway_v5.py`, reached `529.6 MB` on Vultr).
   - **Then set up Lane 4, the Currency & Gold Index (added 2026-11-28; restoring the backup alone does not cover it):** `DavinTradeCurrencyIndexEngine` is the only producer of `currency_gold_indices` and was never installed (§1.2), so `/pro/currency-index` stays empty with only the 4 services above.
     1. **Files:** if not already inside `vultr-mt5-backup-2026-11-27.zip` (the `Scripts\` folders listed in §1.2 do not include them), copy `currency_gold_index_engine.py` and `install_currency_gold_index_engine_service.bat` from `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/` to `C:\Scripts\currency_gold_index_engine\`.
     2. **Charts (settled 2026-11-28, Davin):** on **Terminal A** (`C:\MT5`), attach `ohlcvexportlightweight_v2_29.ex5` (compiled copy in that folder's `mq5/`), `InpBaseFileName="OHLCV"`, to the 7 separate **FX M5** charts only: `EURUSD`, `USDJPY`, `GBPUSD`, `AUDUSD`, `NZDUSD`, `USDCAD`, `USDCHF`. It is an indicator, not an EA; keep Symbol Selection and Timeframe on "current". It re-exports every minute.
        - **XAUUSD: no new chart.** The engine reads the file that Terminal A's alert-pipeline XAUUSD M5 exporter already writes, `C:\MT5\MQL5\Files\OHLCV_XAUUSD_M5.txt`. **Do not attach a second XAUUSD exporter in Terminal A:** the file name depends only on base name, symbol and timeframe, so both would write that one file. The `.bat` header and [Blueprint §8.3 step 5](../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md) list a dedicated XAUUSD chart: that is the Terminal S layout, not this one. Until then Lane 4 shares this one input, read-only, with the alert pipeline.
        - **⚠ Lane 4 depends on Terminal A, and nothing alarms:** closing Terminal A, or permanently switching away from it without both moving these 7 charts to the replacement terminal and pointing `CGI_EXPORT_DIR` at its `MQL5\Files`, pauses Lane 4 silently. The new folder must hold all 8 files. To repoint, edit `CGI_EXPORT_DIR` in the VPS copy of the `.bat`, re-run it, then run `nssm restart DavinTradeCurrencyIndexEngine`.
        - **Future isolation upgrade — Terminal S (`C:\MT5-S`), once the VPS has >= 6–8 GB RAM:** put all 8 charts there (the 7 FX plus its own XAUUSD chart) and repoint `CGI_EXPORT_DIR` to it, so Lane 4 no longer depends on Terminal A or B.
        - **Broker symbol suffix:** keep `InpTryBothSuffixVersions=true` and check `InpSymbolMapping` (its default maps `USDJPY` and `GBPUSD` to `.i` names) against the broker's symbols. Only a dot suffix is dropped from the file name (`EURUSD.i` -> `OHLCV_EURUSD_M5.txt`); another style such as `EURUSDm` gives a name the engine does not read. The Experts log line `Using symbol:` shows what was exported.
     3. **Verify exports:** all 8 `OHLCV_{SYMBOL}_M5.txt` files are in `C:\MT5\MQL5\Files` (7 from the new FX charts, XAUUSD from the alert-pipeline chart) and their modified times keep advancing while the market is open.
     4. **Service:** leave `CGI_EXPORT_DIR` at the `.bat` default (`C:\MT5\MQL5\Files`). In the VPS copy of the `.bat` only, set `BACKFILL_API_KEY` (one of the gateway's `API_KEYS`) and `API_GATEWAY_URL` (gateway base URL, no path or trailing slash; the engine appends `/api/v1/currency-gold-indices`). Both are private: never commit, paste or screenshot them, including the service's `AppEnvironmentExtra`. Run the `.bat` from an elevated cmd (it also starts the service), then check `nssm status DavinTradeCurrencyIndexEngine` shows `SERVICE_RUNNING` and read `C:\Scripts\logs\currency_gold_index_engine.log`.
     5. **Expected result:** rows are produced only while the market is open (the engine skips a family whose newest bar is older than today's session open). Production `GET /api/market/currency-gold-indices` then returns a non-empty `indices` list and `/pro/currency-index` draws. Corridor zones (`daily_volatility_corridors`) populate after one full trading session closes; until then zones stay neutral.
2. **Linux VPS (Chat Support Bot — When Ready to Re-enable `chat-api.davintrade.app`):**
   - Provision a clean Ubuntu 24.04 VPS in Thailand (`infra/contabo-chat-stack/`), install Docker/Nginx/Certbot, deploy fresh from `infra/contabo-chat-stack/` per [contabo-chat-stack.md](../runbooks/contabo-chat-stack.md) (do **not** rely on the old `2026-09-10` snapshot), set `.env` (`CHAT_JWT_SECRET` matching Vercel Production, `LLM_API_KEY`), point `chat-api` DNS, and test TLS/WebSocket.

### Phase 2 — Shadow Calibration, `draft-2`, & Stage B4 Certification (Step 3–4)

1. Accumulate multi-day (`>= 3–5` trading days) shadow data on `MCD0 1.1.0 + M5 most_recent`, measure flag rates (**printing `fit_b` beside `fit_a`**), and confirm `MCD0 1.1.0` stability.
2. Author synthesis rules **`draft-2.yaml`** (fixing `v3` / M15 `non_b` permanent breakdown driving `VALID LONG` under `R2_EXHAUSTION_SNAPBACK`).
3. Close open calibration checks in [waiting-on.md](../../.claude/state/waiting-on.md):
   - `MCD3` reading bars older than the 288-bar priority push (`3` `INVALID` on 19–20 Nov)
   - Verify `InpExtendLinesToCurrent` setting on VPS charts
   - Run the live forming-bar comparison trace ([deploy-stack-d-step3.md](../runbooks/deploy-stack-d-step3.md) §6 step 1)
4. Build & run the two **Stage B4** certification commands (`mcd_worker/statistics/` + `StateStatisticsWriter`, and point-in-time replay over `market_data_point_in_time`), decide D11 (`CAUTIONARY`/`RETUNING` occurrence rules), and run `B4 --write` into `state_statistics`.

### Phase 3 — Step 2 Web Cutover & Stage B5 `live` Promotion

1. **Step 2 Cutover ([deploy-stack-d-step2.md](../runbooks/deploy-stack-d-step2.md)):**
   - Verify VPS renderer images match active indicator (`M5=most_recent`, `M15=non_b`), run Step 2 §6 verification, settle **§1.5 write-key decision** (`POST /api/v1/active-indicator` scoping `monolith_` vs `API_KEYS`), then execute **§7** (`ACTIVE_INDICATOR_FROM_GATEWAY=true` in Vercel Production + redeploy).
2. **Stage B5 ([deploy-stack-d-step3.md](../runbooks/deploy-stack-d-step3.md) §8):**
   - Settle **Decision 1** (how `RETUNING` ends), rehearse Terminal B promote ([mt5-terminal-promote.md](../runbooks/mt5-terminal-promote.md)), optionally deploy Watchdog D4 (`98543acd7af9` with state re-seed), enable `SENSOR_RETUNING_ENFORCED=true` if chosen, complete all 9 checklist items per MCD, and promote `MCD0`–`MCD3` + `SYN` from `shadow` to **`live`**.
3. **⚠ Keep Lane 4 running through promotions:** the currency-index engine reads Terminal A (Phase 1, Lane 4). A promote to Terminal B that leaves A open does not stop it; keep A's 7 FX charts and its XAUUSD M5 OHLCV exporter attached while retuning. Closing A, or permanently switching away from it without moving the 7 FX charts and updating `CGI_EXPORT_DIR`, pauses Lane 4 with no alarm.

### Phase 4 — Step 5: Engine 4 / Report 2 ([deploy-stack-d-step5.md](../runbooks/deploy-stack-d-step5.md))

- Compile & attach `SymbolSpecsExport` EA/exporter on MT5 Terminals A & B (`symbol_specs` rows <= 7 days old).
- Settle `submission_id` column decision before applying migration `20261010000000`, set `ENGINE4_AUDIT_HMAC_KEY`, verify `config/engine4/tier1-events.json` IDs (D13), complete native/counsel read (D14), run E4 gated specs, and enable Engine 4 flag.

### Phase 5 — Step 6: Intake & Knowledge Service ([deploy-stack-d-step6.md](../runbooks/deploy-stack-d-step6.md))

- **Clear Hard Gate First:** Update `knowledge-service/corpus/D2/mcd0.md` to `MCD0 1.1.0` bounds, update `knowledge-service/tests/test_corpus_d1_d2.py`, re-approve `knowledge-service/corpus/approval/D2-MCD0.json`, pass `pytest`.
- Build & deploy `knowledge-service` Docker image on Railway (`S0`–`S7`), run live Understand model benchmark, complete native/counsel sign-off on glossary & 10 refusal texts, confirm Panel C Option A & `deploy.yml`/`tests.yml` `workflow_call` fix (F5). (`INTAKE_ENABLED` stays `false` until Step 7 meters are live.)

### Phase 6 — Step 7: Prompt & AI Reply → 100% Live ([deploy-stack-d-step7.md](../runbooks/deploy-stack-d-step7.md))

- Apply migrations `20261014010000_add_ai_metering_tables` & `20261014000000_add_reply_trace_and_chat_tables`.
- Configure OpenRouter key + spend cap, verify & benchmark launch model pair (`S1`–`S2`), set `PRO_MONTHLY_UNITS` & schedule `reapExpired` (`S3`–`S4`), complete native/counsel sign-off on `config/reply/` (wording lists, 34 goldens, 19 Free demos, `S5`), complete `S6`–`S7`.
- **S8 (Mandatory 1-Week Staging):** Run live on Davin's account in English for 1 week; verify trace violation rate `< 2%`, p90 latency budgets, and quota ledger audit.
- **S9 (Production Live):** Switch production flags (`INTAKE_ENABLED`, `REPLY_ENABLED`, etc.) ON → **Stack D MVP 100% Live**.

---

## 4. Parallel Hygiene / Pre-Existing Tech Debt (Separate Commits)

- Clean up `mcd_worker/tools/build_fixtures.py` (`SHADOW_ALL` + `'SYN': 'off'`) and the 4 pre-existing `off`/`shadow` worker/registry/DB test failures.
- Commit/align the pending OKF `.claude/` / `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / `.github/workflows/tests.yml` (`--tracked-only`) batch cleanly in its own dedicated commit — **always stage this handoff file (`docs/handoffs/2026-11-27-stack-d-handoff-and-vultr-cutoff.md`) and `.claude/` archive files together with `.claude/state/waiting-on.md` / `current-state.md`** (and run `node scripts/agents/check-operating-docs.mjs` without `--tracked-only`) so relative links stay intact on `main`.
- Resolve pre-existing `prisma-migration` Railway project, GitHub migration-history CI failure, gitignored admin sign-in finding, `dLocal` retirement order, and pre-launch Manage Subscription / Security WS migrations (`waiting-on.md`).

---

## 5. Quick Prompt for Opening the Next Antigravity Session

> Please read `docs/handoffs/2026-11-27-stack-d-handoff-and-vultr-cutoff.md` and `.claude/state/checkpoints/2026-11-27-0436-stack-d-vultr-cutoff.md`. I am starting a new session to resume Stack D work (`Phase 0` / `Phase 1`: Thailand VPS setup and restoring `vultr-mt5-backup-2026-11-27.zip`). Confirm the rules, summarize the immediate next step, and wait for my Thailand VPS details before touching files.
