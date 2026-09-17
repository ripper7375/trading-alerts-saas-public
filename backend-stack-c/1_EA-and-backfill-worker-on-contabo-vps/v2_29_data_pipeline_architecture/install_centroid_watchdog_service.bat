@echo off
REM ============================================================================
REM install_centroid_watchdog_service.bat — Centroid Watchdog VPS service installer
REM ----------------------------------------------------------------------------
REM Installs centroid_watchdog.py (Pillar 2 of
REM ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT) as its own auto-restarting NSSM
REM service:
REM   DavinTradeCentroidWatchdog — centroid_watchdog.py
REM
REM DELIBERATELY A SEPARATE SCRIPT FROM install_services.bat, for the same reason
REM install_currency_gold_index_engine_service.bat is: install_services.bat is
REM NOT safe to re-run wholesale on a live VPS. Batch files do not stop on error,
REM so `nssm install MT5PushWorker ...` fails harmlessly for an existing service
REM but the NEXT line still runs and would overwrite the live push worker's real
REM credentials with that file's placeholders (a hazard already recorded in this
REM repo's history). Running THIS file can never touch MT5Collector,
REM MT5PushWorker, MT5Renderer or MT5Relay in any way.
REM
REM The watchdog is read-only with respect to everything else on this box: it
REM opens no database, holds no lock, and only READS .txt files from the standby
REM export directory. If it crashes, the alert pipeline is unaffected.
REM
REM Prerequisites:
REM   - Python 3.11 with `requests` (already required by MT5PushWorker).
REM   - The 7 centroid indicators rebuilt from the 2026-09-18 sources and
REM     attached to the STANDBY terminal's charts, so their _Statistic.txt files
REM     carry [CENTROIDS_DETAIL]. Without that the watchdog logs
REM     "pre-upgrade file" and correctly refuses to reason about them.
REM   - Run this script from an elevated (Administrator) cmd.
REM ============================================================================

setlocal

REM ---------- CONFIG (edit per VPS) ----------
set PYTHON=C:\Python311\python.exe
set ROOT=C:\Scripts
set WATCHDOG=%ROOT%\centroid_watchdog\centroid_watchdog.py

REM The terminal the administrator TUNES. This is what is watched.
set WATCHDOG_STANDBY_DIR=C:\MT5-B\MQL5\Files
REM The terminal currently FEEDING production. Read only for impact analysis
REM (how far the candidate line has moved from the approved one).
set WATCHDOG_ACTIVE_DIR=C:\MT5-A\MQL5\Files

set WATCHDOG_STATE_PATH=%ROOT%\database\centroid_watchdog_state.json
set WATCHDOG_LOG_DIR=%ROOT%\logs

REM Leave the webhook blank to run in log-only mode -- alerts are still written
REM in full to centroid_watchdog.log, so nothing is lost while it is unset.
REM FORMAT: generic | discord | telegram
set ADMIN_ALERT_WEBHOOK_URL=
set ADMIN_ALERT_WEBHOOK_FORMAT=generic
set ADMIN_ALERT_TELEGRAM_CHAT_ID=
REM -------------------------------------------

if not exist "%WATCHDOG_LOG_DIR%" mkdir "%WATCHDOG_LOG_DIR%"

echo === Installing DavinTradeCentroidWatchdog (Pillar 2: event-driven centroid alerting) ===
nssm install DavinTradeCentroidWatchdog "%PYTHON%" "%WATCHDOG%"
nssm set DavinTradeCentroidWatchdog AppDirectory "%ROOT%\centroid_watchdog"
nssm set DavinTradeCentroidWatchdog AppEnvironmentExtra WATCHDOG_STANDBY_DIR=%WATCHDOG_STANDBY_DIR% WATCHDOG_ACTIVE_DIR=%WATCHDOG_ACTIVE_DIR% WATCHDOG_STATE_PATH=%WATCHDOG_STATE_PATH% WATCHDOG_LOG_DIR=%WATCHDOG_LOG_DIR% ADMIN_ALERT_WEBHOOK_URL=%ADMIN_ALERT_WEBHOOK_URL% ADMIN_ALERT_WEBHOOK_FORMAT=%ADMIN_ALERT_WEBHOOK_FORMAT% ADMIN_ALERT_TELEGRAM_CHAT_ID=%ADMIN_ALERT_TELEGRAM_CHAT_ID%
nssm set DavinTradeCentroidWatchdog AppStdout "%WATCHDOG_LOG_DIR%\centroid_watchdog_service.log"
nssm set DavinTradeCentroidWatchdog AppStderr "%WATCHDOG_LOG_DIR%\centroid_watchdog_service.err.log"
nssm set DavinTradeCentroidWatchdog AppExit Default Restart
nssm set DavinTradeCentroidWatchdog Start SERVICE_AUTO_START

nssm start DavinTradeCentroidWatchdog

echo.
echo Done. Verify with:  nssm status DavinTradeCentroidWatchdog
echo Tail logs in:        %WATCHDOG_LOG_DIR%\centroid_watchdog.log
echo.
echo EXPECTED ON FIRST START: one "seeded with N existing centroid(s)" line per
echo source per timeframe (14 in total) and NO alert. That is deliberate. The
echo centroids already on screen are not news, and without seeding every restart
echo of this service would announce them as new.
echo.
echo IMPORTANT — WHEN YOU PROMOTE A TERMINAL, SWAP THESE TWO PATHS:
echo   nssm set DavinTradeCentroidWatchdog AppEnvironmentExtra ... (full set)
echo   nssm restart DavinTradeCentroidWatchdog
echo AppEnvironmentExtra REPLACES the whole set, so every variable above must be
echo repeated in that command, not just the two that changed. Left unswapped, the
echo watchdog keeps watching the terminal that is now frozen and will never see
echo another centroid form — silently, because a frozen terminal reports zero
echo centroids and that looks exactly like a quiet market.

endlocal
