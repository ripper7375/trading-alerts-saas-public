# Staging Health Monitor - Phase 4 Version (PowerShell)
# Purpose: Quick health check for staging environment after Phase 4 completion
# Usage: .\monitor-staging-phase4.ps1

# Configuration
$STAGING_URL = "https://trading-alerts-saas-public-go8p.vercel.app"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Staging Health Monitor - Phase 4" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Health check
Write-Host "1. Health Check:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$STAGING_URL/api/health" -Method Get -TimeoutSec 10
    if ($health.status -eq "ok") {
        Write-Host "   ✅ Status: $($health.status)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Status: $($health.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ FAILED - Cannot reach health endpoint" -ForegroundColor Red
}

# PostgreSQL check
Write-Host ""
Write-Host "2. PostgreSQL Connection:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$STAGING_URL/api/health" -Method Get -TimeoutSec 10
    if ($health.components.postgresql.connected -eq $true) {
        Write-Host "   ✅ Connected" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Disconnected" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️ WARNING - Cannot retrieve PostgreSQL status" -ForegroundColor Yellow
}

# Redis check
Write-Host ""
Write-Host "3. Redis Connection:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$STAGING_URL/api/health" -Method Get -TimeoutSec 10
    if ($health.components.redis.connected -eq $true) {
        Write-Host "   ✅ Connected" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Disconnected" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️ WARNING - Cannot retrieve Redis status" -ForegroundColor Yellow
}

# Data availability check
Write-Host ""
Write-Host "4. Sample Data Check:" -ForegroundColor Yellow

# Test EURUSD H1
try {
    $result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/EURUSD/H1" -Method Get -TimeoutSec 10
    if ($result.success -eq $true) {
        Write-Host "   ✅ EURUSD H1 data available" -ForegroundColor Green
    } else {
        Write-Host "   ❌ EURUSD H1 data NOT available" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ EURUSD H1 endpoint error" -ForegroundColor Red
}

# Test BTCUSD H1
try {
    $result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/BTCUSD/H1" -Method Get -TimeoutSec 10
    if ($result.success -eq $true) {
        Write-Host "   ✅ BTCUSD H1 data available" -ForegroundColor Green
    } else {
        Write-Host "   ❌ BTCUSD H1 data NOT available" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ BTCUSD H1 endpoint error" -ForegroundColor Red
}

# Test USDJPY H1
try {
    $result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/USDJPY/H1" -Method Get -TimeoutSec 10
    if ($result.success -eq $true) {
        Write-Host "   ✅ USDJPY H1 data available" -ForegroundColor Green
    } else {
        Write-Host "   ❌ USDJPY H1 data NOT available" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ USDJPY H1 endpoint error" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Monitoring Complete" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
