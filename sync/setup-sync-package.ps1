# Trading Alerts Sync Package - Automated Setup Script
# Part 20 - Windows PowerShell
# 
# This script automates the deployment of the sync package on Contabo VPS

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Trading Alerts Sync Package - Automated Setup" -ForegroundColor Cyan
Write-Host "Part 20 Migration" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# Step 1: Create Directory Structure
# =============================================================================

Write-Host "[1/7] Creating directory structure..." -ForegroundColor Yellow

$syncDir = "C:\Scripts\sync_package"
$logsDir = Join-Path $syncDir "logs"

New-Item -ItemType Directory -Force -Path $syncDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

Write-Host "   ✓ Created: $syncDir" -ForegroundColor Green
Write-Host "   ✓ Created: $logsDir" -ForegroundColor Green
Write-Host ""

# =============================================================================
# Step 2: Check Prerequisites
# =============================================================================

Write-Host "[2/7] Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✓ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check pip
try {
    $pipVersion = pip --version 2>&1
    Write-Host "   ✓ pip: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ pip not found. Please install pip" -ForegroundColor Red
    exit 1
}

Write-Host ""

# =============================================================================
# Step 3: Prompt for PostgreSQL Connection String
# =============================================================================

Write-Host "[3/7] PostgreSQL Configuration..." -ForegroundColor Yellow

$postgresUri = Read-Host "Enter Railway PostgreSQL connection string"

if ([string]::IsNullOrWhiteSpace($postgresUri)) {
    Write-Host "   ✗ PostgreSQL URI is required" -ForegroundColor Red
    exit 1
}

Write-Host "   ✓ PostgreSQL URI configured" -ForegroundColor Green
Write-Host ""

# =============================================================================
# Step 4: Create .env File
# =============================================================================

Write-Host "[4/7] Creating environment configuration..." -ForegroundColor Yellow

$envContent = @"
# Trading Alerts Sync Package Configuration
# Part 20 Migration

SQLITE_PATH=C:\MT5Data\trading_data.db
POSTGRESQL_URI=$postgresUri
LOG_LEVEL=INFO
SYNC_STATE_FILE=C:\Scripts\sync_package\sync_state.json
"@

$envPath = Join-Path $syncDir ".env"
$envContent | Out-File -FilePath $envPath -Encoding ASCII

Write-Host "   ✓ Created: $envPath" -ForegroundColor Green
Write-Host ""

# =============================================================================
# Step 5: Install Python Dependencies
# =============================================================================

Write-Host "[5/7] Installing Python dependencies..." -ForegroundColor Yellow

$requirementsPath = Join-Path $syncDir "requirements.txt"

if (Test-Path $requirementsPath) {
    Set-Location $syncDir
    pip install -r requirements.txt --quiet
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⚠ requirements.txt not found in $syncDir" -ForegroundColor Yellow
    Write-Host "   Please copy all sync package files to $syncDir first" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Step 6: Test Database Connections
# =============================================================================

Write-Host "[6/7] Testing database connections..." -ForegroundColor Yellow

# Test SQLite
$sqlitePath = "C:\MT5Data\trading_data.db"
if (Test-Path $sqlitePath) {
    Write-Host "   ✓ SQLite database found: $sqlitePath" -ForegroundColor Green
} else {
    Write-Host "   ⚠ SQLite database not found: $sqlitePath" -ForegroundColor Yellow
    Write-Host "     Make sure DataCollector.mq5 is running in MT5" -ForegroundColor Yellow
}

# Test PostgreSQL (if psql is available)
try {
    $testQuery = "SELECT 1"
    $env:POSTGRESQL_URI = $postgresUri
    $pgTest = psql $env:POSTGRESQL_URI -c $testQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ PostgreSQL connection successful" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ PostgreSQL connection test skipped (psql not found)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ PostgreSQL connection test skipped (psql not found)" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Step 7: Create Scheduled Task
# =============================================================================

Write-Host "[7/7] Creating Windows Scheduled Task..." -ForegroundColor Yellow

$runScriptPath = "C:\Scripts\run_sync.ps1"

if (Test-Path $runScriptPath) {
    try {
        # Remove existing task if it exists
        Unregister-ScheduledTask -TaskName "TradingAlertsSyncTask" -Confirm:$false -ErrorAction SilentlyContinue
        
        # Create task action
        $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File $runScriptPath"
        
        # Create trigger (every 30 seconds)
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Seconds 30)
        
        # Create settings
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        
        # Create principal (run as SYSTEM)
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        
        # Register task
        Register-ScheduledTask `
            -TaskName "TradingAlertsSyncTask" `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Principal $principal `
            -Description "Trading Alerts SQLite to PostgreSQL Sync (Part 20)" `
            -ErrorAction Stop | Out-Null
        
        Write-Host "   ✓ Scheduled task created: TradingAlertsSyncTask" -ForegroundColor Green
        Write-Host "     Runs every 30 seconds" -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠ Failed to create scheduled task: $_" -ForegroundColor Yellow
        Write-Host "     You can create it manually using Task Scheduler" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠ run_sync.ps1 not found at $runScriptPath" -ForegroundColor Yellow
    Write-Host "     Please copy run_sync.ps1 to C:\Scripts\ first" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Setup Complete
# =============================================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Verify all files are in place:" -ForegroundColor White
Write-Host "   - config.py (with lowercase symbols)" -ForegroundColor Gray
Write-Host "   - db_connections.py" -ForegroundColor Gray
Write-Host "   - sync_to_postgresql.py" -ForegroundColor Gray
Write-Host "   - timeframe_filter.py" -ForegroundColor Gray
Write-Host "   - __init__.py" -ForegroundColor Gray
Write-Host "   - requirements.txt" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Test sync manually:" -ForegroundColor White
Write-Host "   cd C:\Scripts\sync_package" -ForegroundColor Gray
Write-Host "   python sync_to_postgresql.py" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Start scheduled task:" -ForegroundColor White
Write-Host "   Start-ScheduledTask -TaskName TradingAlertsSyncTask" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Monitor logs:" -ForegroundColor White
Write-Host "   Get-Content C:\Scripts\sync_package\sync.log -Tail 50 -Wait" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Verify data in PostgreSQL:" -ForegroundColor White
Write-Host "   psql `$env:POSTGRESQL_URI -c 'SELECT COUNT(*) FROM eurusd_h1;'" -ForegroundColor Gray
Write-Host ""

Write-Host "Documentation: claude-code-windows-deployment-guide.md" -ForegroundColor Cyan
Write-Host ""
