# Rollback to Part 6 (Emergency Only)

**Status:** ⚠️ **EMERGENCY ONLY**
**Last Updated:** 2026-01-14
**Target Environment:** Contabo Windows VPS
**Deployment Method:** Windows Native (NOT Docker)

---

> ⚠️ **EMERGENCY PROCEDURE**: Only use this guide if Part 20 has critical issues that cannot be fixed quickly.

---

## When to Use This Rollback

This rollback should be executed if any of the following occur:

- **Error rate > 5%** for 10+ minutes
- **Data sync failing** for 5+ minutes
- **Chart accuracy issues** affecting trading decisions
- **Database connection failures** not resolving within SLA

---

## Prerequisites

Before rollback, verify:

- [ ] Part 6 code exists in `archive/part6-flask-mt5/`
- [ ] MT5 terminals still running with indicators
- [ ] Python 3.9+ installed on Contabo Windows VPS
- [ ] PowerShell access to Contabo Windows VPS
- [ ] ❌ **Do NOT use Docker** - Part 6 requires native Windows deployment

---

## Quick Rollback (Recommended)

### Option 1: Use Windows Setup Scripts (Fastest)

```powershell
# On Contabo Windows VPS
cd C:\trading-alerts\mt5-service\deploy

# Run automated setup
.\windows-setup.ps1

# Install as Windows Service
.\windows-install-service.ps1
```

### Option 2: Manual Rollback (If scripts fail)

Follow the manual steps below.

---

## Manual Rollback Steps

### Step 1: Enable Maintenance Mode

```powershell
# From any machine with API access
curl -X POST https://your-app.com/api/admin/maintenance/enable `
  -H "X-Admin-API-Key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json"
```

---

### Step 2: Stop Part 20 Sync Script

```powershell
# On Contabo Windows VPS
cd C:\Scripts\sync_package

# Stop sync service (if running as service)
Stop-Service SyncService -ErrorAction SilentlyContinue

# Or kill Python process
Get-Process python | Where-Object {$_.Path -like "*sync*"} | Stop-Process -Force
```

---

### Step 3: Check Data Freshness

```powershell
# Check when PostgreSQL was last updated
psql $env:POSTGRESQL_URI -c "SELECT MAX(timestamp) FROM eurusd_m5"
```

**Note:** Users may see stale data after rollback. Document the gap duration.

---

### Step 4: Restore Part 6 Flask Service

```powershell
# Navigate to trading alerts directory
cd C:\trading-alerts

# Check if mt5-service already exists (from previous restoration)
if (Test-Path "mt5-service") {
    Write-Host "✅ mt5-service already exists"
} else {
    # Restore from git (recommended)
    Write-Host "Restoring mt5-service from git..."
    git pull origin main

    # Or copy from archive if needed
    # Copy-Item -Path "archive\part6-flask-mt5\mt5-service" -Destination "." -Recurse
}

Write-Host "✅ Part 6 code available"
```

---

### Step 5: Configure Environment Variables

```powershell
# Navigate to mt5-service
cd C:\trading-alerts\mt5-service

# Copy .env.example if .env doesn't exist
if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  IMPORTANT: Edit .env with your MT5 credentials"
    notepad .env
    Read-Host "Press Enter after saving .env file"
}

# Verify critical variables are set
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "MT5_LOGIN=") {
    Write-Host "❌ ERROR: MT5_LOGIN not set in .env"
    exit 1
}
```

**Required variables in `.env`:**

```env
# Flask Configuration
FLASK_ENV=production
FLASK_PORT=5001

# MT5 Credentials (REQUIRED)
MT5_LOGIN=your_mt5_login_number
MT5_PASSWORD=your_mt5_password
MT5_SERVER=YourBroker-Live

# API Keys
MT5_API_KEY=your_api_key_here
MT5_ADMIN_API_KEY=your_admin_key_here

# WebSocket URL
NEXT_PUBLIC_MT5_WS_URL=ws://your-contabo-ip:5001

# CORS Origins
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

---

### Step 6: Set Up Python Virtual Environment

```powershell
# Create venv if it doesn't exist
if (!(Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv venv
}

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Install MetaTrader5 (Windows only)
pip install MetaTrader5

Write-Host "✅ Python environment ready"
```

---

### Step 7: Test Flask Service

```powershell
# Test Flask service manually first
Write-Host "Testing Flask service..."
Write-Host "Press Ctrl+C to stop after verifying it works"

python run.py

# After Ctrl+C, verify it worked:
# - Should see: "🚀 Starting Flask MT5 Service on port 5001"
# - Should see: "✅ WebSocket server enabled"
# - No errors in output
```

**Test from another PowerShell window:**

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:5001/api/system/health"

# Expected response:
# StatusCode: 200
# Content: {"status":"ok","terminals":15,...}
```

---

### Step 8: Install as Windows Service

```powershell
# Install service using NSSM
cd C:\trading-alerts\mt5-service\deploy

# Run service installation script
.\windows-install-service.ps1

# Verify service is running
Get-Service MT5FlaskService

# Should show:
# Status   Name               DisplayName
# ------   ----               -----------
# Running  MT5FlaskService    Flask MT5 Service
```

---

### Step 9: Update Next.js Application

**Enable Part 6 in production environment:**

**Vercel:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Set `USE_FLASK_MT5=true`
3. Set `NEXT_PUBLIC_MT5_WS_URL=ws://your-contabo-ip:5001`
4. Redeploy

**Railway (if using):**
1. Go to Railway dashboard → Your project → Variables
2. Set `USE_FLASK_MT5=true`
3. Redeploy

---

### Step 10: Disable Maintenance Mode

```powershell
# Disable maintenance mode
curl -X POST https://your-app.com/api/admin/maintenance/disable `
  -H "X-Admin-API-Key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json"

Write-Host "✅ Rollback complete!"
```

---

## Post-Rollback Monitoring

After completing the rollback:

### Immediate Checks (0-15 minutes)

```powershell
# 1. Check Flask service status
Get-Service MT5FlaskService

# 2. Check Flask logs
Get-Content C:\trading-alerts\mt5-service\logs\flask-stderr.log -Tail 50

# 3. Test WebSocket connection
# (Use browser console with Socket.IO client)

# 4. Verify MT5 terminal connections
Invoke-RestMethod "http://localhost:5001/api/system/health" | ConvertTo-Json
```

### Extended Monitoring (2 hours)

1. **Monitor for 2 hours** - Watch error rates, response times
2. **Check MT5 connections** - Verify all 15 terminals are connected
3. **Verify chart accuracy** - Compare charts with MT5 terminal
4. **Review alerts** - Check that price alerts are functioning
5. **Monitor WebSocket connections** - Check active subscriptions

---

## Data Freshness Considerations

After rollback, there will be a data gap:

- **Part 20 PostgreSQL** has data up to rollback time
- **Part 6 Flask** provides real-time data from MT5
- **Gap** = Duration Part 20 was active

### Recommendations:

- ✅ Display "Connecting to real-time data..." message
- ✅ WebSocket will provide fresh data immediately
- ✅ No historical data gap for live trading
- ⚠️ Historical analysis may have gap during Part 20 period

---

## Troubleshooting

### Service Won't Start

```powershell
# Check logs
Get-Content C:\trading-alerts\mt5-service\logs\flask-stderr.log -Tail 100

# Common issues:
# 1. Port 5001 already in use
Get-NetTCPConnection -LocalPort 5001

# 2. MT5 terminals not accessible
# Ensure MT5 terminals are logged in and running

# 3. Python import errors
.\venv\Scripts\python.exe -c "import MetaTrader5; print('OK')"
```

### WebSocket Not Connecting

```powershell
# Check firewall
Get-NetFirewallRule -DisplayName "*Flask*"

# Add firewall rule if needed
New-NetFirewallRule -DisplayName "Flask MT5 Service" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol TCP `
                    -LocalPort 5001

# Test WebSocket
# Use browser console with io() from socket.io-client
```

### MT5 Terminals Not Connected

```powershell
# Check MT5 service health
Invoke-RestMethod "http://localhost:5001/api/system/health"

# Should show:
# {
#   "status": "ok",
#   "terminals": 15,
#   "connected": true
# }

# If terminals = 0:
# 1. Ensure MT5 terminals are running
# 2. Verify MT5 credentials in .env
# 3. Check MT5 terminal logs
```

---

## Post-Incident Actions

After stabilizing:

1. **Document the issue**
   - What caused the need for rollback?
   - Error logs and stack traces
   - Timeline of events

2. **Create fix plan**
   - How will the Part 20 issue be resolved?
   - What tests will prevent recurrence?

3. **Test in staging**
   - Reproduce the Part 20 issue
   - Verify fix works before re-deploying

4. **Schedule re-migration**
   - Plan new migration window
   - Communicate to stakeholders

5. **Update documentation**
   - Add lessons learned
   - Update troubleshooting guides

---

## Related Documentation

**Primary Documentation:**
- ✅ **[Contabo Windows Deployment Guide](../deployment/contabo-windows-setup.md)** ← SINGLE SOURCE OF TRUTH
- **[Dual-System Architecture](../architecture/PART6-PART20-DUAL-SYSTEM.md)** - How Part 6 & Part 20 work together

**Architecture:**
- Part 20 Architecture: `docs/sqlite-and-mt5service/part-20-architecture-design.md`
- Part 6 Archive: `archive/part6-flask-mt5/README.md`

**Scripts:**
- Windows Setup: `mt5-service/deploy/windows-setup.ps1`
- Service Install: `mt5-service/deploy/windows-install-service.ps1`

---

## Important Notes

### ❌ DO NOT USE DOCKER

**Docker is NOT suitable for Part 6 production deployment because:**

1. ❌ MT5 terminals run on Windows (cannot access from Linux containers)
2. ❌ MetaTrader5 Python package requires Windows COM API
3. ❌ Docker adds unnecessary virtualization overhead
4. ✅ Native Windows deployment = Direct MT5 access

**Docker is only for local development on Linux/Mac.**

### ✅ Use Windows Native Deployment

**For production on Contabo Windows VPS:**
- ✅ Run Flask service natively on Windows
- ✅ Use Python virtual environment
- ✅ Install as Windows Service (NSSM)
- ✅ Configure Windows Firewall
- ✅ Follow [Contabo Windows Setup Guide](../deployment/contabo-windows-setup.md)

---

**Last Updated:** 2026-01-14
**Maintained By:** Development Team
**Review Schedule:** After each rollback incident
