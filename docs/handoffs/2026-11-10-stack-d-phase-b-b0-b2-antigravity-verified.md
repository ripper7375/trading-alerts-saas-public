# Handoff: Stack D Phase B (Stages B0, B1, B2 & Step 4 SYN Shadow Rollout) — Verified

Date: 2026-11-10, Asia/Bangkok (14:50 UTC)
From / to: Antigravity (Advisor) -> Davin / Claude Code / Codex
Task / order: Stack D Phase B Live Rollout (`docs/runbooks/deploy-stack-d-step2.md`, `docs/runbooks/deploy-stack-d-step3.md` §§1–4 & §9)
Phase/session: Stack D Phase B — B0, B1, B2 & §9 (`SYN`) Live Verification
Source: `d:/SaaS Project/trading-alerts-saas-public`, branch `main`, HEAD `9035cc90`
Status: completed (B0, B1, B2, and §9 SYN shadow rollout verified live; B3 5-trading-day shadow accumulation now in progress)

## Needs from Davin

1. **Rotate `<PROD_DB>` (`DATABASE_PUBLIC_URL`) password on Railway** at a convenient time (since the connection string was pasted in terminal output during Stage B2 verification), and update `DATABASE_URL` / `POSTGRESQL_URI` on any external services that use the public proxy URL if applicable.
2. **Optional Commit of Canonical VPS Pipeline Sources**: Decide when to commit the local Stack C v2.29 pipeline updates (`export_collector_validator_v2.py`, `backfill_worker_api_gateway_v5.py`, and the 16 `.mq5` + 18 `.ex5` indicator files under `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/`) using explicit path staging (`git add <explicit-path>`).
3. **Stage B3 (5 Trading Days of Shadow)**: Let the VPS (`MT5Collector` + `MT5PushWorker`) and Railway Gateway (`SENSOR_WORKER_ENABLED=true`, `MCD0..MCD3=shadow`, `SYN=shadow`) run continuously for 5 trading days, running `measure-sensors.js` daily.

## Changed and verified

### 1. Railway Production Database & Container Rollout (Stage B0 & B1 & §9)

- Applied the 3 additive Stack D migrations on `<PROD_DB>` (`prisma.production.config.ts`):
  - `20261001000000_add_cycle_pipeline_tables`
  - `20261003000000_add_sensor_tables`
  - `20261004000000_add_synthesis_tables`
- Updated `railway-gateway/nixpacks.toml` to provide Python 3.11 (`PyYAML==6.0.2`, `jsonschema==4.25.0`) and synced the 45-file runtime sensor kit (`railway-gateway/sensors/`).
- Enabled `MCD0`, `MCD1`, `MCD2`, `MCD3`, and `SYN` in `'shadow'` mode (`mcd_worker/worker_config.yaml`, `mcdN_registry.yaml`, synced to `railway-gateway/sensors/`), with `SENSOR_WORKER_ENABLED=true` on Railway (`commit 9035cc90`).

### 2. Contabo VPS (`<VPS_IP>`) Live M5 + M15 15-Indicator Pipeline (Milestone 1)

- Removed the 1-second timer starvation bottleneck (`if(time_struct.sec == InpExportSecond && time_struct.min != last_trigger_min)` -> `if(time_struct.min != last_trigger_min)`) across all 16 MQL5 `.mq5` exporters in `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/` and recompiled all 18 `*v2_29.ex5` binaries (`0 errors`).
- Organized the 8 XAUUSD chart tabs on the VPS MT5 terminal (4 M5 tabs + 4 M15 tabs, 3–4 indicators per tab) so all 15 indicators export fresh `<120s` files on both M5 and M15.
- Updated `export_collector_validator_v2.py` and `backfill_worker_api_gateway_v5.py` on both the VPS and local repository:
  - SQLite `timeout=60.0` + `PRAGMA busy_timeout = 60000`
  - Per-row `conn.commit()` in `_send_rows()` so progress is persisted immediately
  - Forming-bar close tolerance (`LIVE_CLOSE_TOLERANCE = 15.0`) and 1-bar (`tf_sec`) relative timestamp tolerance across the `:59 -> :00` export boundary
  - 6-day `synced_at` cutoff (`now - 518400`) in `promote_cycle()` to prevent 20-day historical re-queueing

### 3. Live Verification Evidence (Stage B1, B2 & §9.4)

| Command                                                                 | Cwd                          | Exit | Pass/fail/skip | Evidence / limitation                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python C:\Scripts\check_manifests.py`                                  | VPS `C:\Users\Administrator` | 0    | PASS           | `slot=1794321000` (`14:30Z`): `cycle=10200 (M5, att=1, validated)` + `cycle=10201 (M15, att=1, validated)`; `Manifest built for slot 1794321000 (M5 288 bars, M15 96 bars)` acknowledged (`synced_at=1794321314`).                                                                                                                                                                                |
| `node scripts/measure-cycles.js --db --last 20`                         | `railway-gateway`            | 0    | PASS           | `15 cycles` (`11:50Z` to `14:35Z`): `READY 15`, `INCOMPLETE 0`, `PENDING 0`; `gateway: received to ready = 0s`; `collector validated, after slot` p50 = `31s`; `slot to ready` p50 = `273s` (`DELAYED` vs initial 120s ADR-012 threshold due to sequential per-row HTTP POST of 288–384 priority rows).                                                                                           |
| `node scripts/measure-sensors.js --db --last 20`                        | `railway-gateway`            | 0    | PASS           | `15 cycles`, `60 MCD rows` (`15x4`) + `30 SYN rows` (`15x2`). `EVALUATOR_ERROR: 0`, `guard problems: 0`, `schema/wording violations: 0`. Per-MCD latency (`<1000ms` budget): `MCD0` p50=`95.4ms` (max `162.3ms`), `MCD1` p50=`1.2ms`, `MCD2` p50=`2.6ms`, `MCD3` p50=`2.3ms`, `SYN` p50=`23.9ms` (`0 over`). Cycle latency (`<30s` budget): `signal to done` p50=`0.10s`, max=`0.17s` (`0 over`). |
| `node scripts/replay-cycle.js --db --slot 1794321000 --slot 1794321300` | `railway-gateway`            | 0    | PASS           | `2 cycle(s): 2 VERIFIED` (`14:30Z` and `14:35Z`): 4/4 MCD readings and 2/2 SYN readings (`DAY_TRADER`, `SCALPER`) + entry zones matched stored SHA-256 and envelope text byte-for-byte.                                                                                                                                                                                                           |

## Review findings

- **M15 Tab Duplication & MQL5 Timer Starvation (Fixed & Rechecked)**:
  - _Cause_: On the VPS MT5 terminal, M15 Tab 2 duplicated Tab 4/7 and M15 Tab 9 had `NonMostRecentLineExtensionA/B` attached instead of `BestFitNonMostRecentA/B`. Additionally, `if(time_struct.sec == InpExportSecond ...)` could miss the 1-second `:59` window when chart calculations exceeded 1 second.
  - _Correction_: Removed `time_struct.sec == InpExportSecond` check across all 16 `.mq5` files, recompiled `.ex5` binaries, closed the duplicate M15 tab, and attached `BestFitNonMostRecentA/B` to M15 Tab 9. Rechecked at `14:30Z` (`slot 1794321000`): 15/15 M5 and 15/15 M15 files exported fresh and validated on attempt 1 (`NO_STATS_AT_SLOT` dropped to 0 on `14:30Z` and `14:35Z`).

## Unconfirmed / found

- **VPS `MT5Renderer` Service Log**: `C:\Scripts\logs\renderer.err.log` logs `ERROR cannot read C:\Scripts\renderer\fixture.db: no such table: collection_cycles` every 10 seconds because its NSSM environment points to `fixture.db` instead of `C:\Scripts\database\xauusd.db`. Does not affect `MT5Collector`, `MT5PushWorker`, or the Sensor/SYN pipeline.
- **SYN `NO_MATCH` Observation for `DAY_TRADER`**: On slots `14:30Z` and `14:35Z`, `DAY_TRADER` observed `MCD1 CAUTIONARY (MCD1_DOWN_UPPER_BREAKOUT) | MCD2 INVALID | MCD3 INVALID`, which hits `NO_MATCH` (`NEUTRAL / STAND_ASIDE`) under `draft-1`. Recorded by `measure-sensors.js` as expected for Stage B3 rule table review.

## Next action and ownership

- **Stage B3 (5-Day Shadow Accumulation)**: Monitor daily with `node scripts/measure-sensors.js --db --last 288 --replay 3`.
- **Stage B4 Tooling (Next Engineering Task)**: Build the two Stage B4 certification tools listed in `docs/runbooks/deploy-stack-d-step3.md` §6 (point-in-time loader over `market_data_point_in_time` and CLI wiring for `StateStatisticsWriter.writeRows`).
