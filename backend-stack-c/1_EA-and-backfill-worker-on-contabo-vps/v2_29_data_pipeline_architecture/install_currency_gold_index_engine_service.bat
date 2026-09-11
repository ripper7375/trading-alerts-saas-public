@echo off
REM ============================================================================
REM install_currency_gold_index_engine_service.bat — Lane 4 VPS service installer
REM ----------------------------------------------------------------------------
REM Installs currency_gold_index_engine.py (the G8 Currency & Gold Index Suite
REM engine, "Lane 4") as its own auto-restarting NSSM service:
REM   DavinTradeCurrencyIndexEngine — currency_gold_index_engine.py
REM
REM DELIBERATELY A SEPARATE SCRIPT FROM install_services.bat, not a block
REM appended to it. install_services.bat is NOT safe to re-run wholesale on a
REM live VPS that already has services registered: batch files do not stop on
REM error, so `nssm install MT5PushWorker ...` fails harmlessly for an existing
REM service, but the NEXT line still executes and would overwrite the running
REM push worker's real credentials with this file's own CONFIG placeholders
REM (already flagged as a live hazard in this repo's history — see CLAUDE.md's
REM 2026-09-11 entry). A separate script for Lane 4 makes that scenario
REM impossible: running this file can never touch MT5Collector, MT5PushWorker,
REM MT5Renderer, or MT5Relay in any way.
REM
REM Lane 4 is otherwise fully independent of the v6 alert pipeline (see
REM currency_gold_index_engine.py's own module docstring): its own process, own
REM SQLite file (never xauusd.db), own input files (8 independent
REM OHLCV_{SYMBOL}_M5.txt exports that no alert indicator writes). This script
REM does not touch anything install_services.bat manages.
REM
REM Prerequisites (in addition to install_services.bat's own):
REM   - The generic, already-compiled ohlcvexportlightweight_v2_29.mq5 attached
REM     to 8 independent MT5 charts: EURUSD, USDJPY, GBPUSD, AUDUSD, NZDUSD,
REM     USDCAD, USDCHF, XAUUSD (all M5) — each with its default InpBaseFileName
REM     "OHLCV" so they write OHLCV_{SYMBOL}_M5.txt into %EXPORT_DIR%.
REM   - Run this script from an elevated (Administrator) cmd.
REM ============================================================================

setlocal

REM ---------- CONFIG (edit per VPS) ----------
set PYTHON=C:\Python311\python.exe
set ROOT=C:\Scripts
set ENGINE=%ROOT%\currency_gold_index_engine\currency_gold_index_engine.py
set CGI_EXPORT_DIR=C:\MT5\MQL5\Files
set CGI_DB_PATH=%ROOT%\database\currency_gold_indices.db
set CGI_LOG_DIR=%ROOT%\logs
set BACKFILL_API_KEY=PUT_REAL_KEY_HERE
set API_GATEWAY_URL=PUT_REAL_RAILWAY_GATEWAY_URL_HERE
REM -------------------------------------------

if not exist "%CGI_LOG_DIR%" mkdir "%CGI_LOG_DIR%"

echo === Installing DavinTradeCurrencyIndexEngine (Lane 4: Currency ^& Gold Index Suite) ===
nssm install DavinTradeCurrencyIndexEngine "%PYTHON%" "%ENGINE%"
nssm set DavinTradeCurrencyIndexEngine AppDirectory "%ROOT%\currency_gold_index_engine"
nssm set DavinTradeCurrencyIndexEngine AppEnvironmentExtra CGI_EXPORT_DIR=%CGI_EXPORT_DIR% CGI_DB_PATH=%CGI_DB_PATH% CGI_LOG_DIR=%CGI_LOG_DIR% BACKFILL_API_KEY=%BACKFILL_API_KEY% API_GATEWAY_URL=%API_GATEWAY_URL%
nssm set DavinTradeCurrencyIndexEngine AppStdout "%CGI_LOG_DIR%\currency_gold_index_engine_service.log"
nssm set DavinTradeCurrencyIndexEngine AppStderr "%CGI_LOG_DIR%\currency_gold_index_engine_service.err.log"
nssm set DavinTradeCurrencyIndexEngine AppExit Default Restart
nssm set DavinTradeCurrencyIndexEngine Start SERVICE_AUTO_START

nssm start DavinTradeCurrencyIndexEngine

echo.
echo Done. Verify with:  nssm status DavinTradeCurrencyIndexEngine
echo Tail logs in:        %CGI_LOG_DIR%\currency_gold_index_engine.log
echo.
echo NOTE: until Phase 2 (the NestJS gateway endpoint) ships, every push attempt
echo will fail closed and log a warning — this is expected. Rows accumulate in
echo currency_gold_indices.db with synced_at IS NULL and drain automatically the
echo first time the endpoint becomes reachable. Nothing is lost while it waits.

endlocal
