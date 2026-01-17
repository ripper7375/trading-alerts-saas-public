# ============================================================================
# Flask MT5 Service - Windows Service Installation Script
# ============================================================================
# This script installs Flask MT5 service as a Windows Service using NSSM
#
# Prerequisites:
# - Run windows-setup.ps1 first
# - NSSM (Non-Sucking Service Manager) will be downloaded automatically
#
# Usage:
#   .\windows-install-service.ps1
# ============================================================================

#Requires -RunAsAdministrator

param(
    [string]$InstallPath = "C:\trading-alerts\mt5-service",
    [string]$ServiceName = "MT5FlaskService",
    [string]$DisplayName = "Flask MT5 Service",
    [string]$Description = "MT5 real-time indicator service with WebSocket support"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Flask MT5 Service - Windows Service Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Check if service already exists
# ============================================================================

Write-Host "[1/5] Checking existing service..." -ForegroundColor Yellow

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "  - Service '$ServiceName' already exists" -ForegroundColor Yellow
    Write-Host "  - Current status: $($existingService.Status)" -ForegroundColor Yellow

    $response = Read-Host "  - Do you want to reinstall? (y/n)"
    if ($response -ne 'y') {
        Write-Host "  - Installation cancelled" -ForegroundColor Yellow
        exit 0
    }

    Write-Host "  - Stopping existing service..." -NoNewline
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Write-Host " OK" -ForegroundColor Green

    Write-Host "  - Removing existing service..." -NoNewline
    # If NSSM is available, use it to remove
    $nssmPath = Join-Path $InstallPath "nssm.exe"
    if (Test-Path $nssmPath) {
        & $nssmPath remove $ServiceName confirm
    } else {
        sc.exe delete $ServiceName
    }
    Write-Host " OK" -ForegroundColor Green

    Start-Sleep -Seconds 2
}

# ============================================================================
# Step 2: Download NSSM if not present
# ============================================================================

Write-Host "`n[2/5] Setting up NSSM..." -ForegroundColor Yellow

$nssmPath = Join-Path $InstallPath "nssm.exe"

if (!(Test-Path $nssmPath)) {
    Write-Host "  - Downloading NSSM..." -NoNewline

    $nssmVersion = "2.24"
    $nssmUrl = "https://nssm.cc/release/nssm-$nssmVersion.zip"
    $tempZip = Join-Path $env:TEMP "nssm.zip"
    $tempExtract = Join-Path $env:TEMP "nssm"

    try {
        # Download NSSM
        Invoke-WebRequest -Uri $nssmUrl -OutFile $tempZip -UseBasicParsing

        # Extract
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        # Copy appropriate version (64-bit or 32-bit)
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        $nssmExe = Get-ChildItem -Path $tempExtract -Recurse -Filter "nssm.exe" | Where-Object { $_.FullName -like "*$arch*" } | Select-Object -First 1

        if ($nssmExe) {
            Copy-Item $nssmExe.FullName -Destination $nssmPath -Force
            Write-Host " OK" -ForegroundColor Green
        } else {
            throw "NSSM executable not found in download"
        }

        # Cleanup
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
        Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        Write-Host "    Please download NSSM manually from https://nssm.cc/download" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  - NSSM already installed" -ForegroundColor Green
}

# ============================================================================
# Step 3: Verify installation files
# ============================================================================

Write-Host "`n[3/5] Verifying installation..." -ForegroundColor Yellow

$pythonExe = Join-Path $InstallPath "venv\Scripts\python.exe"
$runScript = Join-Path $InstallPath "run.py"
$logsDir = Join-Path $InstallPath "logs"

$errors = @()

if (!(Test-Path $pythonExe)) {
    $errors += "Python executable not found: $pythonExe"
}

if (!(Test-Path $runScript)) {
    $errors += "run.py not found: $runScript"
}

if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "  - Created logs directory" -ForegroundColor Green
}

if ($errors.Count -gt 0) {
    Write-Host "  - FAILED - Missing files:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    Write-Host "  - Run windows-setup.ps1 first" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "  - All files verified" -ForegroundColor Green
}

# ============================================================================
# Step 4: Install Windows Service
# ============================================================================

Write-Host "`n[4/5] Installing Windows Service..." -ForegroundColor Yellow

# Install service
Write-Host "  - Creating service '$ServiceName'..." -NoNewline
& $nssmPath install $ServiceName $pythonExe $runScript

if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}

# Configure service
Write-Host "  - Configuring service parameters..." -NoNewline

& $nssmPath set $ServiceName AppDirectory $InstallPath
& $nssmPath set $ServiceName DisplayName $DisplayName
& $nssmPath set $ServiceName Description $Description
& $nssmPath set $ServiceName Start SERVICE_AUTO_START

# Configure logging
$stdoutLog = Join-Path $logsDir "flask-stdout.log"
$stderrLog = Join-Path $logsDir "flask-stderr.log"

& $nssmPath set $ServiceName AppStdout $stdoutLog
& $nssmPath set $ServiceName AppStderr $stderrLog

# Set log rotation (10MB, 5 files)
& $nssmPath set $ServiceName AppRotateFiles 1
& $nssmPath set $ServiceName AppRotateBytes 10485760  # 10MB
& $nssmPath set $ServiceName AppRotateOnline 1

# Set environment variables from .env file
$envPath = Join-Path $InstallPath ".env"
if (Test-Path $envPath) {
    & $nssmPath set $ServiceName AppEnvironmentExtra (Get-Content $envPath | Out-String)
}

Write-Host " OK" -ForegroundColor Green

# ============================================================================
# Step 5: Start Service
# ============================================================================

Write-Host "`n[5/5] Starting service..." -ForegroundColor Yellow

Write-Host "  - Starting '$ServiceName'..." -NoNewline
& $nssmPath start $ServiceName

Start-Sleep -Seconds 5

# Check service status
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($service -and $service.Status -eq 'Running') {
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  - Service is running" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  - Service failed to start. Check logs:" -ForegroundColor Yellow
    Write-Host "    $stderrLog" -ForegroundColor Gray
}

# ============================================================================
# Summary
# ============================================================================

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Service Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $ServiceName" -ForegroundColor White
Write-Host "Display Name: $DisplayName" -ForegroundColor White
Write-Host "Status: $($service.Status)" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  Check status:" -ForegroundColor White
Write-Host "    Get-Service $ServiceName" -ForegroundColor Gray
Write-Host ""
Write-Host "  View logs:" -ForegroundColor White
Write-Host "    Get-Content $stderrLog -Tail 50" -ForegroundColor Gray
Write-Host ""
Write-Host "  Restart service:" -ForegroundColor White
Write-Host "    Restart-Service $ServiceName" -ForegroundColor Gray
Write-Host ""
Write-Host "  Stop service:" -ForegroundColor White
Write-Host "    Stop-Service $ServiceName" -ForegroundColor Gray
Write-Host ""
Write-Host "  Remove service:" -ForegroundColor White
Write-Host "    $nssmPath remove $ServiceName confirm" -ForegroundColor Gray
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Yellow
Write-Host "  HTTP Health Check:" -ForegroundColor White
Write-Host "    http://localhost:5001/api/health" -ForegroundColor Gray
Write-Host "  WebSocket:" -ForegroundColor White
Write-Host "    ws://localhost:5001/socket.io" -ForegroundColor Gray
Write-Host ""
