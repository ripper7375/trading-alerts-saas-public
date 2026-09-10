@echo off
REM ============================================================================
REM install_services.bat — v6 pipeline VPS service installer (Windows + NSSM)
REM ----------------------------------------------------------------------------
REM Installs the two long-running Python services of the v6 export-collection
REM pipeline as auto-restarting NSSM services:
REM   MT5Relay      — mt5_api_relay_for_v2_29.py      (legacy socket relay; optional)
REM   MT5Collector  — export_collector_validator_v2.py (collect->validate->promote)
REM   MT5PushWorker — backfill_worker_api_gateway_v5.py (market_data -> API gateway)
REM
REM The 13 MQL5 indicators + the EA are NOT services; they run inside the MT5
REM terminal (attached to the XAUUSD M5 and M15 charts) and auto-export every
REM minute. Run this script from an elevated (Administrator) cmd.
REM
REM Prerequisites:
REM   - NSSM on PATH            (https://nssm.cc)
REM   - Python 3.8+ with: pip install aiohttp requests
REM   - For MT5Renderer only: pip install boto3 matplotlib pandas numpy
REM   - Edit the CONFIG block below for this VPS.
REM ============================================================================

setlocal

REM ---------- CONFIG (edit per VPS) ----------
set PYTHON=C:\Python311\python.exe
set ROOT=C:\Scripts
set RELAY=%ROOT%\relay\mt5_api_relay_for_v2_29.py
set COLLECTOR=%ROOT%\collector\export_collector_validator_v2.py
set PUSHWORKER=%ROOT%\backfill\backfill_worker_api_gateway_v5.py
set EXPORT_DIR=C:\MT5\MQL5\Files
set DB=%ROOT%\database\xauusd.db
set LOGS=%ROOT%\logs
set BACKFILL_API_KEY=PUT_REAL_KEY_HERE
set API_GATEWAY_URL=PUT_REAL_RAILWAY_GATEWAY_URL_HERE
REM ---- Chart renderer -> Cloudflare R2 (private bucket) ----
set RENDERER=%ROOT%\renderer\mtf_render_upload_worker.py
set R2_ACCOUNT_ID=PUT_R2_ACCOUNT_ID_HERE
set R2_ACCESS_KEY_ID=PUT_R2_ACCESS_KEY_ID_HERE
set R2_SECRET_ACCESS_KEY=PUT_R2_SECRET_ACCESS_KEY_HERE
set R2_BUCKET=davintrade-renders
REM -------------------------------------------

if not exist "%LOGS%" mkdir "%LOGS%"

echo === Installing MT5Relay (optional legacy socket relay) ===
nssm install MT5Relay "%PYTHON%" "%RELAY%"
nssm set MT5Relay AppDirectory "%ROOT%\relay"
nssm set MT5Relay AppStdout "%LOGS%\relay.log"
nssm set MT5Relay AppStderr "%LOGS%\relay.err.log"
nssm set MT5Relay AppExit Default Restart
nssm set MT5Relay Start SERVICE_AUTO_START

echo === Installing MT5Collector (v6 pipeline engine) ===
nssm install MT5Collector "%PYTHON%" "%COLLECTOR%" --export-dir "%EXPORT_DIR%" --db "%DB%" --timeframes M5,M15
nssm set MT5Collector AppDirectory "%ROOT%\collector"
nssm set MT5Collector AppStdout "%LOGS%\collector.log"
nssm set MT5Collector AppStderr "%LOGS%\collector.err.log"
nssm set MT5Collector AppExit Default Restart
nssm set MT5Collector Start SERVICE_AUTO_START

echo === Installing MT5PushWorker (market_data -> gateway) ===
nssm install MT5PushWorker "%PYTHON%" "%PUSHWORKER%"
nssm set MT5PushWorker AppDirectory "%ROOT%\backfill"
nssm set MT5PushWorker AppEnvironmentExtra BACKFILL_API_KEY=%BACKFILL_API_KEY% API_GATEWAY_URL=%API_GATEWAY_URL%
nssm set MT5PushWorker AppStdout "%LOGS%\push_worker.log"
nssm set MT5PushWorker AppStderr "%LOGS%\push_worker.err.log"
nssm set MT5PushWorker AppExit Default Restart
nssm set MT5PushWorker Start SERVICE_AUTO_START

echo === Installing MT5Renderer (chart PNGs -^> Cloudflare R2) ===
REM Read-only against xauusd.db. A rendering failure must never affect price
REM ingestion, so this service is independent of the collector/push worker.
nssm install MT5Renderer "%PYTHON%" "%RENDERER%"
nssm set MT5Renderer AppDirectory "%ROOT%\renderer"
nssm set MT5Renderer AppEnvironmentExtra R2_ACCOUNT_ID=%R2_ACCOUNT_ID% R2_ACCESS_KEY_ID=%R2_ACCESS_KEY_ID% R2_SECRET_ACCESS_KEY=%R2_SECRET_ACCESS_KEY% R2_BUCKET=%R2_BUCKET% MTF_DB_PATH=%DB%
nssm set MT5Renderer AppStdout "%LOGS%\renderer.log"
nssm set MT5Renderer AppStderr "%LOGS%\renderer.err.log"
nssm set MT5Renderer AppExit Default Restart
nssm set MT5Renderer Start SERVICE_AUTO_START

echo === Starting services (collector first, then push worker, relay last) ===
nssm start MT5Collector
nssm start MT5PushWorker
nssm start MT5Relay
nssm start MT5Renderer

echo.
echo Done. Verify with:  nssm status MT5Collector ^& nssm status MT5PushWorker
echo Tail logs in:        %LOGS%
echo.
echo NOTE: the collector needs only sqlite_schema_v6_xauusd.sql beside it. It has
echo no other local dependency — MQL5 is the single source of every value and the
echo collector calculates nothing. (The former Python calc stack is parked in
echo calculation-split-between-mt5-and-python-PENDING-PROJECT\ and must NOT be
echo deployed to the VPS.)

endlocal
