# Trading Alerts Sync Script Runner
# Part 20 - Windows PowerShell Script
#
# This script runs the SQLite to PostgreSQL sync
# and can be scheduled via Windows Task Scheduler

# Change to sync package directory
Set-Location "C:\Scripts\sync_package"

# Run Python sync script
try {
    python sync_to_postgresql.py
    
    # Log success
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sync completed successfully at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    } else {
        Write-Error "Sync failed with exit code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} catch {
    Write-Error "Error running sync script: $_"
    exit 1
}
