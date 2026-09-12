@echo off
setlocal EnableDelayedExpansion
title MT5 Collector - Active / Hot-Standby Promotion Tool
color 0F

:: ============================================================================
:: promote_terminal.bat — Active / Hot-Standby MT5 Terminal Promotion Script
:: ----------------------------------------------------------------------------
:: Purpose:
::   Automates the promotion switch between Terminal A and Terminal B for MT5Collector.
::   Performs pre-flight checks, updates NSSM AppParameters with full arguments,
::   restarts the service, and displays live tail logs for verification.
:: ============================================================================

:: 1. ตรวจสอบสิทธิ์ Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ============================================================================
    echo [ERROR] สิทธิ์ไม่เพียงพอ! กรุณาคลิกขวาที่ไฟล์นี้แล้วเลือก "Run as administrator"
    echo [ERROR] Administrator privileges required. Please Run as Administrator.
    echo ============================================================================
    echo.
    pause
    exit /b 1
)

:: ---------- CONFIGURATION (สามารถปรับแต่งพาธให้ตรงกับ VPS ได้ที่นี่) ----------
set "SERVICE_NAME=MT5Collector"
set "PYTHON_EXE=C:\Python311\python.exe"
set "SCRIPT_PATH=C:\Scripts\collector\export_collector_validator_v2.py"
set "DB_PATH=C:\Scripts\database\xauusd.db"
set "TIMEFRAMES=M5,M15"
set "LOG_FILE=C:\Scripts\logs\collector.log"

set "DIR_TERMINAL_A=C:\MT5-A\MQL5\Files"
set "DIR_TERMINAL_B=C:\MT5-B\MQL5\Files"
:: ----------------------------------------------------------------------------

:MENU
cls
color 0B
echo ============================================================================
echo         MT5 COLLECTOR ACTIVE / HOT-STANDBY PROMOTION TOOL (v2.29)
echo ============================================================================
echo.

:: 2. ตรวจสอบสถานะ Service และ Argument ปัจจุบัน
set "CURRENT_PARAMS="
for /f "tokens=*" %%i in ('nssm get %SERVICE_NAME% AppParameters 2^>nul') do (
    set "CURRENT_PARAMS=%%i"
)

if "%CURRENT_PARAMS%"=="" (
    color 0C
    echo [คำเตือน] ไม่สามารถดึงข้อมูลจาก Service: %SERVICE_NAME% ได้
    echo กรุณาตรวจสอบว่าติดตั้ง NSSM และ Service %SERVICE_NAME% เรียบร้อยแล้วหรือไม่
    echo.
    set "CURRENT_ACTIVE=UNKNOWN"
) else (
    echo %CURRENT_PARAMS% | findstr /i /c:"%DIR_TERMINAL_A%" >nul
    if !errorlevel! equ 0 (
        set "CURRENT_ACTIVE=Terminal A"
        set "CURRENT_DIR=%DIR_TERMINAL_A%"
        set "RECOMMENDED_TARGET=Terminal B"
        set "RECOMMENDED_DIR=%DIR_TERMINAL_B%"
    ) else (
        echo %CURRENT_PARAMS% | findstr /i /c:"%DIR_TERMINAL_B%" >nul
        if !errorlevel! equ 0 (
            set "CURRENT_ACTIVE=Terminal B"
            set "CURRENT_DIR=%DIR_TERMINAL_B%"
            set "RECOMMENDED_TARGET=Terminal A"
            set "RECOMMENDED_DIR=%DIR_TERMINAL_A%"
        ) else (
            set "CURRENT_ACTIVE=CUSTOM / OTHER"
            set "CURRENT_DIR=%CURRENT_PARAMS%"
            set "RECOMMENDED_TARGET=Terminal B"
            set "RECOMMENDED_DIR=%DIR_TERMINAL_B%"
        )
    )
)

echo [สถานะการทำงานปัจจุบัน]
echo   - สถานะ Active ปัจจุบัน : [ %CURRENT_ACTIVE% ]
echo   - พาธโฟลเดอร์ที่อ่านอยู่ : %CURRENT_DIR%
echo.
echo ============================================================================
echo เลือกการทำงาน:
echo   [1] สลับระบบไปใช้ Terminal A (%DIR_TERMINAL_A%)
echo   [2] สลับระบบไปใช้ Terminal B (%DIR_TERMINAL_B%)
echo   [3] ดู Log ล่าสุดของ Collector (View Recent Logs)
echo   [0] ออกจากโปรแกรม (Exit)
echo ============================================================================
if "%CURRENT_ACTIVE%"=="Terminal A" (
    echo * แนะนำ: ปัจจุบันคือ Terminal A --^> หากต้องการ Promote ให้เลือก [2]
) else if "%CURRENT_ACTIVE%"=="Terminal B" (
    echo * แนะนำ: ปัจจุบันคือ Terminal B --^> หากต้องการ Promote ให้เลือก [1]
)
echo.

set "CHOICE="
set /p "CHOICE=กรุณาเลือกหมายเลข [0-3]: "

if "%CHOICE%"=="1" (
    set "TARGET_TERMINAL=Terminal A"
    set "TARGET_DIR=%DIR_TERMINAL_A%"
    goto :CONFIRM_SWITCH
)
if "%CHOICE%"=="2" (
    set "TARGET_TERMINAL=Terminal B"
    set "TARGET_DIR=%DIR_TERMINAL_B%"
    goto :CONFIRM_SWITCH
)
if "%CHOICE%"=="3" (
    goto :VIEW_LOGS
)
if "%CHOICE%"=="0" (
    exit /b 0
)

echo.
echo [ข้อผิดพลาด] ตัวเลือกไม่ถูกต้อง กรุณากดเลือกใหม่อีกครั้ง
timeout /t 2 >nul
goto :MENU

:: ----------------------------------------------------------------------------
:CONFIRM_SWITCH
cls
color 0E
echo ============================================================================
echo                   ยืนยันการสลับระบบ (CONFIRMATION)
echo ============================================================================
echo   - สลับจาก : %CURRENT_ACTIVE%
echo   - สลับไป  : %TARGET_TERMINAL% (%TARGET_DIR%)
echo.

:: 3. Pre-flight Check: ตรวจสอบโฟลเดอร์ปลายทางและความสดของไฟล์
echo [*] กำลังตรวจสอบความพร้อมของ %TARGET_TERMINAL%...
if not exist "%TARGET_DIR%" (
    color 0C
    echo.
    echo [ข้อผิดพลาดร้ายแรง] ไม่พบโฟลเดอร์: "%TARGET_DIR%"
    echo กรุณาตรวจสอบว่าติดตั้ง Terminal ถูกต้องตามโฟลเดอร์ที่ระบุหรือไม่
    echo.
    pause
    goto :MENU
)

:: ตรวจสอบความสดของไฟล์ในโฟลเดอร์ปลายทางด้วย PowerShell
set "FRESH_CHECK="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "$files = Get-ChildItem -Path '%TARGET_DIR%' -Filter '*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending;" ^
    "if (-not $files) { Write-Output 'NO_FILES'; } else {" ^
    "    $diff = (Get-Date) - $files[0].LastWriteTime;" ^
    "    if ($diff.TotalMinutes -gt 15) { Write-Output ('STALE:' + [int]$diff.TotalMinutes); } else { Write-Output 'OK'; }" ^
    "}"`) do (
    set "FRESH_CHECK=%%A"
)

if "%FRESH_CHECK%"=="NO_FILES" (
    color 0C
    echo [คำเตือน] ไม่พบไฟล์ .txt ส่งออกจาก %TARGET_TERMINAL% เลย!
    echo ตรวจสอบให้แน่ใจว่า MT5 เปิดรันอยู่และ Indicator กำลัง Export ไฟล์
    echo.
) else if "%FRESH_CHECK:~0,5%"=="STALE" (
    color 0C
    echo [คำเตือนร้ายแรง] ไฟล์ล่าสุดใน %TARGET_TERMINAL% เก่าเกิน %FRESH_CHECK:~6% นาที!
    echo MT5 อาจจะปิดอยู่ หรือไม่ได้เชื่อมต่อกราฟ (Cold Standby)
    echo หากสลับไปตอนนี้ ระบบ Stale-Guard อาจปฏิเสธข้อมูล!
    echo.
) else (
    echo [+] ตรวจสอบผ่าน: พบไฟล์ Export สดใหม่พร้อมใช้งาน
    echo.
)

echo ----------------------------------------------------------------------------
echo กฎเหล็กก่อนกดยืนยัน:
echo 1. คุณได้ตรวจสอบความถูกต้องของ Indicator บนกราฟ %TARGET_TERMINAL% ด้วยสายตาแล้ว
echo 2. ปล่อยให้ %CURRENT_ACTIVE% รันนิ่งๆ ไว้อย่างเดิม ห้ามปิด เพื่อใช้เป็น Rollback
echo ----------------------------------------------------------------------------
echo.
set "CONFIRM="
set /p "CONFIRM=ต้องการดำเนินการสลับระบบทันทีหรือไม่? (พิมพ์ Y เพื่อยืนยัน / N เพื่อยกเลิก): "

if /i "%CONFIRM%" neq "Y" (
    echo.
    echo [ยกเลิก] ยกเลิกการทำงาน ไม่มีการเปลี่ยนแปลงใดๆ
    timeout /t 2 >nul
    goto :MENU
)

:: 4. สั่งสลับระบบ (The Switch)
cls
color 0A
echo ============================================================================
echo                      กำลังดำเนินการสลับระบบ...
echo ============================================================================
echo.
echo [1/3] กำลังตั้งค่า Service ให้ชี้ไปที่ %TARGET_TERMINAL%...
nssm set %SERVICE_NAME% AppParameters "%SCRIPT_PATH% --export-dir %TARGET_DIR% --db %DB_PATH% --timeframes %TIMEFRAMES%"

if %errorlevel% neq 0 (
    color 0C
    echo [ข้อผิดพลาด] ไม่สามารถตั้งค่า %SERVICE_NAME% ผ่าน nssm ได้!
    pause
    goto :MENU
)

echo [2/3] กำลังสั่ง Restart Service: %SERVICE_NAME%...
nssm restart %SERVICE_NAME%

if %errorlevel% neq 0 (
    color 0C
    echo [ข้อผิดพลาด] ไม่สามารถสั่ง restart %SERVICE_NAME% ได้!
    pause
    goto :MENU
)

echo.
echo [3/3] สลับระบบสำเร็จเรียบร้อย!
echo.
echo ============================================================================
echo                       ผลการทำงานล่าสุด (LATEST LOGS)
echo ============================================================================
timeout /t 2 >nul
powershell -NoProfile -Command ^
    "if (Test-Path '%LOG_FILE%') { Get-Content '%LOG_FILE%' -Tail 25 } else { Write-Host 'ยังไม่พบไฟล์ Log ที่: %LOG_FILE%' }"

echo ============================================================================
echo [ข้อสังเกต]:
echo - ตรวจสอบว่าใน Log บรรทัดบนมีข้อความ 'exports=%TARGET_DIR%'
echo - ระบบจะทยอยซิงค์ข้อมูลย้อนหลัง (~3,000 แท่ง) ขึ้นระบบประมาณ 5-6 นาที
echo - หากพบความผิดปกติ สามารถรันไฟล์นี้เพื่อสลับกลับ (Rollback) ได้ทันที
echo ============================================================================
echo.
pause
goto :MENU

:: ----------------------------------------------------------------------------
:VIEW_LOGS
cls
color 0B
echo ============================================================================
echo                 LOG ล่าสุดของ %SERVICE_NAME% (30 บรรทัด)
echo ============================================================================
echo.
powershell -NoProfile -Command ^
    "if (Test-Path '%LOG_FILE%') { Get-Content '%LOG_FILE%' -Tail 30 } else { Write-Host 'ยังไม่พบไฟล์ Log ที่: %LOG_FILE%' }"
echo.
echo ============================================================================
pause
goto :MENU
