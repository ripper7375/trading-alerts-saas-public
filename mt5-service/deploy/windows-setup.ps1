# ============================================================================
# Flask MT5 Service - Windows Setup Script
# ============================================================================
# This script sets up the Flask MT5 service on Contabo Windows VPS
#
# Prerequisites:
# - Windows Server 2019/2022 or Windows 10/11
# - Python 3.9+ installed
# - MT5 terminals installed and configured
# - PowerShell 5.1+
#
# Usage:
#   .\windows-setup.ps1
# ============================================================================

# Require administrator privileges
#Requires -RunAsAdministrator

param(
    [string]$InstallPath = "C:\trading-alerts\mt5-service",
    [string]$PythonPath = "python",
    [int]$Port = 5001
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Flask MT5 Service - Windows Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Verify Prerequisites
# ============================================================================

Write-Host "[1/8] Verifying prerequisites..." -ForegroundColor Yellow

# Check Python
Write-Host "  - Checking Python installation..." -NoNewline
try {
    $pythonVersion = & $PythonPath --version 2>&1
    if ($pythonVersion -match "Python (\d+\.\d+)") {
        $version = [version]$matches[1]
        if ($version -lt [version]"3.9") {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "    Python 3.9+ required. Found: $pythonVersion" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host " OK ($pythonVersion)" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    Python not found. Install from https://python.org" -ForegroundColor Red
    exit 1
}

# Check MT5
Write-Host "  - Checking MT5 installation..." -NoNewline
$mt5Paths = @(
    "C:\Program Files\MetaTrader 5",
    "C:\Program Files (x86)\MetaTrader 5",
    "$env:APPDATA\MetaQuotes\Terminal"
)

$mt5Found = $false
foreach ($path in $mt5Paths) {
    if (Test-Path $path) {
        $mt5Found = $true
        break
    }
}

if ($mt5Found) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " WARNING" -ForegroundColor Yellow
    Write-Host "    MT5 not found in standard locations. Ensure MT5 is installed." -ForegroundColor Yellow
}

# ============================================================================
# Step 2: Create Installation Directory
# ============================================================================

Write-Host "`n[2/8] Creating installation directory..." -ForegroundColor Yellow

if (!(Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "  - Created: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "  - Directory already exists: $InstallPath" -ForegroundColor Green
}

# Create subdirectories
$subdirs = @("logs", "config", "data")
foreach ($dir in $subdirs) {
    $fullPath = Join-Path $InstallPath $dir
    if (!(Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Host "  - Created: $fullPath" -ForegroundColor Green
    }
}

# ============================================================================
# Step 3: Copy Service Files
# ============================================================================

Write-Host "`n[3/8] Copying service files..." -ForegroundColor Yellow

$sourcePath = Split-Path -Parent $PSScriptRoot
if (Test-Path $sourcePath) {
    # Copy all files except deploy folder
    Copy-Item -Path "$sourcePath\*" -Destination $InstallPath -Recurse -Force -Exclude "deploy",".git","__pycache__","*.pyc"
    Write-Host "  - Service files copied successfully" -ForegroundColor Green
} else {
    Write-Host "  - WARNING: Source path not found. Manual copy required." -ForegroundColor Yellow
}

# ============================================================================
# Step 4: Create Virtual Environment
# ============================================================================

Write-Host "`n[4/8] Creating Python virtual environment..." -ForegroundColor Yellow

$venvPath = Join-Path $InstallPath "venv"
if (!(Test-Path $venvPath)) {
    & $PythonPath -m venv $venvPath
    Write-Host "  - Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "  - Virtual environment already exists" -ForegroundColor Green
}

# Activate venv
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
& $activateScript

# ============================================================================
# Step 5: Install Python Dependencies
# ============================================================================

Write-Host "`n[5/8] Installing Python dependencies..." -ForegroundColor Yellow

$pipPath = Join-Path $venvPath "Scripts\pip.exe"
$requirementsPath = Join-Path $InstallPath "requirements.txt"

if (Test-Path $requirementsPath) {
    Write-Host "  - Upgrading pip..." -NoNewline
    & $pipPath install --upgrade pip --quiet
    Write-Host " OK" -ForegroundColor Green

    Write-Host "  - Installing requirements..." -NoNewline
    & $pipPath install -r $requirementsPath --quiet
    Write-Host " OK" -ForegroundColor Green

    Write-Host "  - Installing MetaTrader5 (Windows-only)..." -NoNewline
    & $pipPath install MetaTrader5 --quiet
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host "  - WARNING: requirements.txt not found" -ForegroundColor Yellow
}

# ============================================================================
# Step 6: Create Environment File
# ============================================================================

Write-Host "`n[6/8] Creating environment configuration..." -ForegroundColor Yellow

$envPath = Join-Path $InstallPath ".env"
$envExamplePath = Join-Path $InstallPath ".env.example"

if (!(Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Host "  - Created .env from .env.example" -ForegroundColor Green
        Write-Host "  - IMPORTANT: Edit $envPath with your MT5 credentials" -ForegroundColor Yellow
    } else {
        # Create basic .env
        $envContent = @"
# Flask MT5 Service Configuration
FLASK_ENV=production
FLASK_PORT=$Port

# MT5 Credentials (REQUIRED)
MT5_LOGIN=your_login_here
MT5_PASSWORD=your_password_here
MT5_SERVER=your_broker_server_here

# API Keys
MT5_API_KEY=your_api_key_here
MT5_ADMIN_API_KEY=your_admin_key_here

# Database (if using)
DATABASE_URL=postgresql://user:pass@localhost:5432/trading_alerts
REDIS_URL=redis://localhost:6379

# CORS Origins
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app
"@
        Set-Content -Path $envPath -Value $envContent
        Write-Host "  - Created default .env file" -ForegroundColor Green
        Write-Host "  - IMPORTANT: Edit $envPath with your configuration" -ForegroundColor Yellow
    }
} else {
    Write-Host "  - .env file already exists" -ForegroundColor Green
}

# ============================================================================
# Step 7: Configure Windows Firewall
# ============================================================================

Write-Host "`n[7/8] Configuring Windows Firewall..." -ForegroundColor Yellow

try {
    $ruleName = "Flask MT5 Service - Port $Port"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Host "  - Firewall rule already exists" -ForegroundColor Green
    } else {
        New-NetFirewallRule -DisplayName $ruleName `
                            -Direction Inbound `
                            -Action Allow `
                            -Protocol TCP `
                            -LocalPort $Port `
                            -ErrorAction Stop | Out-Null
        Write-Host "  - Firewall rule created for port $Port" -ForegroundColor Green
    }
} catch {
    Write-Host "  - WARNING: Failed to configure firewall. Configure manually." -ForegroundColor Yellow
}

# ============================================================================
# Step 8: Test Installation
# ============================================================================

Write-Host "`n[8/8] Testing installation..." -ForegroundColor Yellow

$pythonVenvPath = Join-Path $venvPath "Scripts\python.exe"
$runScriptPath = Join-Path $InstallPath "run.py"

if ((Test-Path $pythonVenvPath) -and (Test-Path $runScriptPath)) {
    Write-Host "  - Testing Flask service..." -NoNewline

    # Try to import Flask as a quick test
    $testResult = & $pythonVenvPath -c "import flask; import flask_socketio; import MetaTrader5; print('OK')" 2>&1

    if ($testResult -eq "OK") {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "    Error: $testResult" -ForegroundColor Red
    }
} else {
    Write-Host "  - WARNING: Cannot test - files missing" -ForegroundColor Yellow
}

# ============================================================================
# Summary
# ============================================================================

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Path: $InstallPath" -ForegroundColor White
Write-Host "Python Venv: $venvPath" -ForegroundColor White
Write-Host "Service Port: $Port" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Edit .env file with your MT5 credentials:" -ForegroundColor White
Write-Host "     notepad $envPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Test the service manually:" -ForegroundColor White
Write-Host "     cd $InstallPath" -ForegroundColor Gray
Write-Host "     .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "     python run.py" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Install as Windows Service (optional):" -ForegroundColor White
Write-Host "     .\deploy\windows-install-service.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Access the service:" -ForegroundColor White
Write-Host "     HTTP: http://localhost:$Port/api/health" -ForegroundColor Gray
Write-Host "     WebSocket: ws://localhost:$Port/socket.io" -ForegroundColor Gray
Write-Host ""
