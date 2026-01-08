@echo off
REM Trading Alerts Sync Script Runner
REM Part 20 - Windows Batch Script
REM
REM This script runs the SQLite to PostgreSQL sync
REM and logs output to sync_output.log

cd /d C:\Scripts\sync_package

REM Run Python sync script and capture output
python sync_to_postgresql.py >> sync_output.log 2>&1

REM Exit with the Python script's exit code
exit /b %ERRORLEVEL%
