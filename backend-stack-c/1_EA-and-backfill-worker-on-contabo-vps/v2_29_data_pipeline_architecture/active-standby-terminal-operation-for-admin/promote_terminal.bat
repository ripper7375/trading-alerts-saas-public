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

:: Frozen-baseline preset tooling (ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT).
:: The terminal being promoted must be switched to MODE_FROZEN_LINE BEFORE the
:: collector is pointed at it -- otherwise it is promoted while still refitting,
:: which is the autonomous repainting this whole architecture exists to stop.
set "PRESET_SCRIPT=C:\Scripts\collector\generate_frozen_preset.py"
set "PRESET_DIR=C:\Scripts\presets"
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
echo   --- Frozen Baseline (ทำก่อนสลับระบบ / do this BEFORE promoting) ---
echo   [4] สร้าง Preset สำหรับ Freeze เส้น (Generate frozen .set presets)
echo   [5] ตรวจสอบว่า Terminal อยู่ในโหมด FROZEN แล้วหรือยัง (Verify FROZEN)
echo   [0] ออกจากโปรแกรม (Exit)
echo ============================================================================
if "%CURRENT_ACTIVE%"=="Terminal A" (
    echo * แนะนำ: ปัจจุบันคือ Terminal A --^> หากต้องการ Promote ให้เลือก [2]
) else if "%CURRENT_ACTIVE%"=="Terminal B" (
    echo * แนะนำ: ปัจจุบันคือ Terminal B --^> หากต้องการ Promote ให้เลือก [1]
)
echo.

set "CHOICE="
set /p "CHOICE=กรุณาเลือกหมายเลข [0-5]: "

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
if "%CHOICE%"=="4" (
    goto :GEN_PRESETS
)
if "%CHOICE%"=="5" (
    goto :VERIFY_FROZEN
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

:: 3b. Pre-flight: is the target actually in FROZEN mode yet?
:: Promoting a terminal that is still in MODE_DYNAMIC_AUTOFIT makes it the active
:: producer WHILE it keeps refitting -- so it goes on rewriting ~3000 bars of
:: history in place, which is exactly the behaviour the frozen baseline exists to
:: remove. Nothing about it looks wrong afterwards, so it is checked here.
set "FROZEN_CHECK=NOT_CHECKED"
if exist "%PRESET_SCRIPT%" (
    echo [*] กำลังตรวจสอบว่า %TARGET_TERMINAL% อยู่ในโหมด FROZEN แล้วหรือยัง...
    "%PYTHON_EXE%" "%PRESET_SCRIPT%" --verify --standby-dir "%TARGET_DIR%" >nul 2>&1
    if !errorlevel! equ 0 (
        set "FROZEN_CHECK=FROZEN"
        echo [+] ตรวจสอบผ่าน: ทุก Indicator รายงานโหมด FROZEN
    ) else (
        set "FROZEN_CHECK=NOT_FROZEN"
        color 0C
        echo.
        echo [คำเตือนร้ายแรง] %TARGET_TERMINAL% ยังไม่ได้อยู่ในโหมด FROZEN ทั้งหมด!
        echo หากสลับตอนนี้ Terminal จะยังคงคำนวณเส้นใหม่และเขียนทับประวัติย้อนหลัง ~3,000 แท่ง
        echo ให้เลือกเมนู [4] สร้าง Preset แล้วโหลดเข้า Indicator ก่อน จากนั้นเลือก [5] เพื่อตรวจสอบ
        echo (Target is NOT fully FROZEN. Promoting now keeps the repainting bug alive.)
        echo.
        echo รายละเอียด:
        "%PYTHON_EXE%" "%PRESET_SCRIPT%" --verify --standby-dir "%TARGET_DIR%"
        echo.
    )
) else (
    echo [หมายเหตุ] ไม่พบ %PRESET_SCRIPT% - ข้ามการตรวจสอบโหมด FROZEN
    echo (Frozen-mode check skipped: preset script not installed on this VPS.)
)

echo ----------------------------------------------------------------------------
echo กฎเหล็กก่อนกดยืนยัน:
echo 1. คุณได้ตรวจสอบความถูกต้องของ Indicator บนกราฟ %TARGET_TERMINAL% ด้วยสายตาแล้ว
echo 2. ปล่อยให้ %CURRENT_ACTIVE% รันนิ่งๆ ไว้อย่างเดิม ห้ามปิด เพื่อใช้เป็น Rollback
echo 3. %TARGET_TERMINAL% ถูกตั้งเป็นโหมด FROZEN แล้ว [ สถานะ: %FROZEN_CHECK% ]
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
:GEN_PRESETS
cls
color 0B
echo ============================================================================
echo        สร้าง PRESET สำหรับ FREEZE เส้น (GENERATE FROZEN PRESETS)
echo ============================================================================
echo.
echo เลือก Terminal ที่ "กำลังจะถูก Promote" (อ่านค่าเส้นที่อนุมัติแล้วจากที่นี่)
echo   [A] Terminal A (%DIR_TERMINAL_A%)
echo   [B] Terminal B (%DIR_TERMINAL_B%)
echo   [X] ยกเลิก
echo.
set "SRC="
set /p "SRC=เลือก [A/B/X]: "
if /i "%SRC%"=="X" goto :MENU
if /i "%SRC%"=="A" set "SRC_DIR=%DIR_TERMINAL_A%"
if /i "%SRC%"=="B" set "SRC_DIR=%DIR_TERMINAL_B%"
if not defined SRC_DIR (
    echo [ข้อผิดพลาด] ตัวเลือกไม่ถูกต้อง
    timeout /t 2 >nul
    goto :GEN_PRESETS
)

if not exist "%PRESET_SCRIPT%" (
    color 0C
    echo.
    echo [ข้อผิดพลาด] ไม่พบสคริปต์: "%PRESET_SCRIPT%"
    echo คัดลอก generate_frozen_preset.py ไปไว้ที่พาธนั้นก่อน
    echo.
    pause
    set "SRC_DIR="
    goto :MENU
)

echo.
"%PYTHON_EXE%" "%PRESET_SCRIPT%" --standby-dir "%SRC_DIR%" --out-dir "%PRESET_DIR%"
echo.
echo ============================================================================
echo [ขั้นตอนถัดไป - ต้องทำด้วยมือใน MetaTrader]
echo MetaTrader ไม่มี API ให้โปรแกรมภายนอกแก้ค่า Input ของ Indicator ได้
echo   1. เปิด %SRC_DIR% ^-^> คลิกขวาที่ Indicator แต่ละตัว ^-^> Properties ^-^> Inputs
echo      ^-^> Load ^-^> เลือกไฟล์ *_FROZEN.set ที่อยู่ใน %PRESET_DIR% ^-^> OK
echo   2. กลับมาที่เมนูนี้ แล้วเลือก [5] เพื่อยืนยันว่าเปลี่ยนโหมดสำเร็จจริง
echo   3. จากนั้นจึงค่อยสลับระบบด้วย [1] หรือ [2]
echo ============================================================================
echo.
set "SRC_DIR="
pause
goto :MENU

:: ----------------------------------------------------------------------------
:VERIFY_FROZEN
cls
color 0B
echo ============================================================================
echo          ตรวจสอบโหมด FROZEN (VERIFY FROZEN PROJECTION MODE)
echo ============================================================================
echo.
echo   [A] Terminal A (%DIR_TERMINAL_A%)
echo   [B] Terminal B (%DIR_TERMINAL_B%)
echo   [X] ยกเลิก
echo.
set "VSRC="
set /p "VSRC=เลือก [A/B/X]: "
if /i "%VSRC%"=="X" goto :MENU
if /i "%VSRC%"=="A" set "VDIR=%DIR_TERMINAL_A%"
if /i "%VSRC%"=="B" set "VDIR=%DIR_TERMINAL_B%"
if not defined VDIR (
    echo [ข้อผิดพลาด] ตัวเลือกไม่ถูกต้อง
    timeout /t 2 >nul
    goto :VERIFY_FROZEN
)

if not exist "%PRESET_SCRIPT%" (
    color 0C
    echo [ข้อผิดพลาด] ไม่พบสคริปต์: "%PRESET_SCRIPT%"
    pause
    set "VDIR="
    goto :MENU
)

echo.
"%PYTHON_EXE%" "%PRESET_SCRIPT%" --verify --standby-dir "%VDIR%"
echo.
echo ============================================================================
echo [ความหมาย]
echo - ALL FROZEN  = ปลอดภัย พร้อมสลับระบบมาที่ Terminal นี้
echo - PROBLEM     = ยังไม่ได้โหลด Preset หรือ Terminal ไม่ได้รันอยู่
echo                 ห้ามสลับระบบ เพราะเส้นจะยังถูกคำนวณใหม่และเขียนทับประวัติ
echo ============================================================================
set "VDIR="
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
