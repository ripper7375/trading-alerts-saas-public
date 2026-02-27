@echo off
echo.
echo ========================================
echo   Importing TXT files to Excel...
echo ========================================
echo.

python "%~dp0import_to_excel.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Something went wrong. Make sure Python is installed.
    echo Run:  pip install openpyxl
) else (
    echo.
    echo [DONE] XAUUSD_M5_AllData.xlsx has been updated.
)

echo.
pause
