# Contabo Windows VPS Deployment Guide

**Part 6: Flask MT5 Service - Native Windows Deployment**

**Last Updated:** 2026-01-14
**Target Environment:** Contabo Windows VPS (Windows Server 2019/2022)

---

## Overview

This guide explains how to deploy the **Flask MT5 Service (Part 6)** natively on Contabo Windows VPS. The service must run on Windows because:

1. ✅ MetaTrader5 Python package requires Windows
2. ✅ Direct access to MT5 terminal processes (Windows COM API)
3. ✅ Better performance without virtualization overhead

**❌ Docker NOT supported** - MT5 integration requires native Windows deployment.

---

## Architecture

```
Contabo Windows VPS
├── MT5 Terminals (15x)          ← Windows native
│   ├── EURUSD-M5
│   ├── XAUUSD-H1
│   └── ... (custom indicators)
│
├── Flask MT5 Service            ← Python native (Port 5001)
│   ├── Python 3.9+
│   ├── Flask + SocketIO
│   ├── MetaTrader5 package
│   └── Runs as Windows Service (NSSM)
│
├── SQLite Database              ← For Part 20 sync
│   └── C:\MT5Data\trading_data.db
│
└── Windows Firewall             ← Port 5001 open
```

---

## Prerequisites

Before deployment, ensure you have:

### 1. Windows Server
- ✅ Windows Server 2019/2022 OR Windows 10/11
- ✅ Administrator access
- ✅ Minimum 4GB RAM, 2 CPU cores
- ✅ 20GB free disk space

### 2. Python 3.9+
- ✅ Download from [python.org](https://www.python.org/downloads/windows/)
- ✅ During installation: **Check "Add Python to PATH"**
- ✅ Verify: `python --version` (should show 3.9+)

### 3. MT5 Terminals
- ✅ MetaTrader 5 installed
- ✅ All terminals configured with broker credentials
- ✅ Custom indicators installed in each terminal
- ✅ Terminals logged in and connected

### 4. Network Access
- ✅ Static IP or domain name
- ✅ Port 5001 accessible from Next.js frontend

---

## Quick Start (Automated Setup)

### Step 1: Download Repository

```powershell
# Clone repository to C:\trading-alerts
cd C:\
git clone https://github.com/your-org/trading-alerts-saas-public.git trading-alerts
cd trading-alerts\mt5-service
```

### Step 2: Run Automated Setup

```powershell
# Run PowerShell as Administrator
cd C:\trading-alerts\mt5-service\deploy

# Execute setup script
.\windows-setup.ps1
```

**The script will:**
- ✅ Verify Python and MT5 installation
- ✅ Create installation directory structure
- ✅ Set up Python virtual environment
- ✅ Install dependencies (Flask, SocketIO, MetaTrader5)
- ✅ Create .env configuration file
- ✅ Configure Windows Firewall (port 5001)
- ✅ Test installation

### Step 3: Configure Environment Variables

```powershell
# Edit .env file
notepad C:\trading-alerts\mt5-service\.env
```

**Required settings:**

```env
# Flask Configuration
FLASK_ENV=production
FLASK_PORT=5001

# MT5 Credentials (REQUIRED)
MT5_LOGIN=your_mt5_login_number
MT5_PASSWORD=your_mt5_password
MT5_SERVER=YourBroker-Live

# API Keys
MT5_API_KEY=generate_with_openssl_rand_hex_32
MT5_ADMIN_API_KEY=generate_with_openssl_rand_hex_32

# CORS Origins (Allow Next.js frontend)
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app

# Optional: Database connections
DATABASE_URL=postgresql://user:pass@host:5432/trading_alerts
REDIS_URL=redis://localhost:6379
```

**Generate API keys:**

```powershell
# Use Python to generate random keys
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4: Test Manual Start

```powershell
cd C:\trading-alerts\mt5-service

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Test Flask service
python run.py
```

**Expected output:**

```
🚀 Starting Flask MT5 Service on port 5001
📊 Debug mode: False
🔗 Health check: http://localhost:5001/api/health
🔌 WebSocket: ws://localhost:5001/socket.io
✅ WebSocket server enabled
 * Running on http://0.0.0.0:5001
```

**Test from browser:**

```
http://localhost:5001/api/health
```

**Expected response:**

```json
{
  "status": "ok",
  "terminals": 15,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

### Step 5: Install as Windows Service

```powershell
# Stop manual test (Ctrl+C)

# Install as Windows Service using NSSM
cd C:\trading-alerts\mt5-service\deploy
.\windows-install-service.ps1
```

**The script will:**
- ✅ Download NSSM (Non-Sucking Service Manager)
- ✅ Install Flask service as Windows Service
- ✅ Configure auto-start on boot
- ✅ Set up log rotation
- ✅ Start the service

### Step 6: Verify Service

```powershell
# Check service status
Get-Service MT5FlaskService

# Should show:
# Status   Name               DisplayName
# ------   ----               -----------
# Running  MT5FlaskService    Flask MT5 Service
```

**View logs:**

```powershell
# View error log
Get-Content C:\trading-alerts\mt5-service\logs\flask-stderr.log -Tail 50

# View output log
Get-Content C:\trading-alerts\mt5-service\logs\flask-stdout.log -Tail 50
```

---

## Manual Setup (Step-by-Step)

If automated setup fails, follow manual steps:

### 1. Create Directory Structure

```powershell
New-Item -ItemType Directory -Path "C:\trading-alerts\mt5-service" -Force
cd C:\trading-alerts\mt5-service

# Create subdirectories
New-Item -ItemType Directory -Path "logs" -Force
New-Item -ItemType Directory -Path "config" -Force
New-Item -ItemType Directory -Path "data" -Force
```

### 2. Create Virtual Environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install Dependencies

```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install Flask and dependencies
pip install Flask==3.0.0
pip install Flask-CORS==4.0.0
pip install flask-socketio==5.3.5
pip install python-socketio==5.10.0
pip install eventlet==0.33.3

# Install data processing
pip install pandas>=2.0.0
pip install numpy>=1.24.0

# Install MetaTrader5 (Windows only)
pip install MetaTrader5

# Install other dependencies
pip install psycopg2-binary==2.9.9
pip install requests==2.31.0
pip install python-dotenv==1.0.0
pip install pydantic==2.5.0
pip install colorlog==6.8.0
pip install gunicorn==21.2.0
pip install gevent==23.9.1
```

### 4. Copy Service Files

Copy all files from repository `mt5-service/` folder to `C:\trading-alerts\mt5-service\`.

### 5. Configure Windows Firewall

```powershell
# Add firewall rule for port 5001
New-NetFirewallRule -DisplayName "Flask MT5 Service" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol TCP `
                    -LocalPort 5001
```

### 6. Install NSSM

Download NSSM from [nssm.cc](https://nssm.cc/download) and extract `nssm.exe` to `C:\trading-alerts\mt5-service\`.

### 7. Install Windows Service

```powershell
# Install service
.\nssm.exe install MT5FlaskService "C:\trading-alerts\mt5-service\venv\Scripts\python.exe" "C:\trading-alerts\mt5-service\run.py"

# Configure service
.\nssm.exe set MT5FlaskService AppDirectory "C:\trading-alerts\mt5-service"
.\nssm.exe set MT5FlaskService DisplayName "Flask MT5 Service"
.\nssm.exe set MT5FlaskService Description "MT5 real-time indicator service with WebSocket support"
.\nssm.exe set MT5FlaskService Start SERVICE_AUTO_START

# Configure logging
.\nssm.exe set MT5FlaskService AppStdout "C:\trading-alerts\mt5-service\logs\flask-stdout.log"
.\nssm.exe set MT5FlaskService AppStderr "C:\trading-alerts\mt5-service\logs\flask-stderr.log"

# Start service
.\nssm.exe start MT5FlaskService
```

---

## Service Management

### Common Commands

```powershell
# Check service status
Get-Service MT5FlaskService

# Start service
Start-Service MT5FlaskService

# Stop service
Stop-Service MT5FlaskService

# Restart service
Restart-Service MT5FlaskService

# View logs
Get-Content C:\trading-alerts\mt5-service\logs\flask-stderr.log -Tail 50 -Wait
```

### Using NSSM

```powershell
cd C:\trading-alerts\mt5-service

# Check service status
.\nssm.exe status MT5FlaskService

# Edit service configuration
.\nssm.exe edit MT5FlaskService

# Remove service
.\nssm.exe remove MT5FlaskService confirm
```

---

## Testing WebSocket Connection

### From PowerShell

```powershell
# Test HTTP endpoint
Invoke-WebRequest -Uri "http://localhost:5001/api/health"

# Test WebSocket (using wscat if installed)
npm install -g wscat
wscat -c "ws://localhost:5001/socket.io/?EIO=4&transport=websocket"
```

### From Next.js Frontend

```typescript
// Test WebSocket connection
const socket = io('ws://contabo-ip:5001', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Flask MT5 Service');

  // Subscribe to EURUSD M5
  socket.emit('subscribe', {
    symbol: 'EURUSD',
    timeframe: 'M5'
  });
});

socket.on('indicator_update', (data) => {
  console.log('Received indicator update:', data);
});
```

---

## Troubleshooting

### Service Won't Start

**Check logs:**

```powershell
Get-Content C:\trading-alerts\mt5-service\logs\flask-stderr.log -Tail 100
```

**Common issues:**

1. **Python not found**
   ```
   Solution: Verify Python path in NSSM service configuration
   ```

2. **MT5 terminals not accessible**
   ```
   Solution: Ensure MT5 terminals are logged in and running
   ```

3. **Port 5001 already in use**
   ```
   Solution: Check what's using port 5001
   Get-NetTCPConnection -LocalPort 5001
   ```

4. **Import error: MetaTrader5**
   ```
   Solution: Reinstall MetaTrader5 package
   .\venv\Scripts\pip.exe install MetaTrader5 --force-reinstall
   ```

### WebSocket Not Connecting

**Check firewall:**

```powershell
# List firewall rules
Get-NetFirewallRule -DisplayName "*Flask*"

# Test port accessibility
Test-NetConnection -ComputerName localhost -Port 5001
```

**Check WebSocket endpoint:**

```powershell
# Should return WebSocket upgrade headers
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:5001/socket.io/
```

### High CPU Usage

**Monitor service:**

```powershell
# Check process
Get-Process | Where-Object { $_.ProcessName -like "*python*" }

# Check service performance
Get-Counter '\Process(python)\% Processor Time'
```

**Optimize:**
- Reduce polling frequency in websocket.py
- Increase update interval in background loop
- Limit number of MT5 terminals

---

## Security Considerations

### 1. Firewall Configuration

```powershell
# Restrict access to specific IP (Next.js frontend)
$frontendIP = "your-vercel-ip"
New-NetFirewallRule -DisplayName "Flask MT5 - Restricted" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol TCP `
                    -LocalPort 5001 `
                    -RemoteAddress $frontendIP
```

### 2. API Key Authentication

Ensure `.env` has strong API keys:

```env
MT5_API_KEY=<64-character-hex-string>
MT5_ADMIN_API_KEY=<64-character-hex-string>
```

### 3. CORS Configuration

Limit CORS to your frontend domain:

```env
CORS_ORIGINS=https://your-app.vercel.app
```

### 4. HTTPS/WSS

For production, use HTTPS/WSS:
- Set up reverse proxy (Nginx, IIS)
- Configure SSL certificate
- Update frontend to use `wss://` instead of `ws://`

---

## Monitoring

### Health Checks

```powershell
# Automated health check script
$url = "http://localhost:5001/api/health"
$response = Invoke-RestMethod -Uri $url

if ($response.status -eq "ok") {
    Write-Host "✅ Service is healthy - Terminals: $($response.terminals)"
} else {
    Write-Host "❌ Service is unhealthy"
    Restart-Service MT5FlaskService
}
```

### Log Rotation

NSSM handles log rotation automatically (configured for 10MB, 5 files).

Manual rotation:

```powershell
# Rotate logs if needed
Move-Item C:\trading-alerts\mt5-service\logs\flask-stderr.log `
          C:\trading-alerts\mt5-service\logs\flask-stderr.log.old -Force
Restart-Service MT5FlaskService
```

---

## Backup & Recovery

### Backup

```powershell
# Backup configuration
Copy-Item C:\trading-alerts\mt5-service\.env `
          C:\Backups\mt5-service\.env.$(Get-Date -Format 'yyyyMMdd')

# Backup entire service
Compress-Archive -Path C:\trading-alerts\mt5-service\* `
                 -DestinationPath C:\Backups\mt5-service-$(Get-Date -Format 'yyyyMMdd').zip
```

### Recovery

```powershell
# Restore from backup
Expand-Archive -Path C:\Backups\mt5-service-20260114.zip `
               -DestinationPath C:\trading-alerts\mt5-service -Force

# Restart service
Restart-Service MT5FlaskService
```

---

## Upgrading

### Update Flask Service

```powershell
# Stop service
Stop-Service MT5FlaskService

# Activate venv
cd C:\trading-alerts\mt5-service
.\venv\Scripts\Activate.ps1

# Pull latest code
git pull origin main

# Update dependencies
pip install -r requirements.txt --upgrade

# Restart service
Start-Service MT5FlaskService
```

---

## Related Documentation

- [Part 6 + Part 20 Dual-System Architecture](../architecture/PART6-PART20-DUAL-SYSTEM.md)
- [WebSocket Implementation Guide](../architecture/websocket-implementation.md)
- [MT5 Terminal Configuration](../flask-multi-mt5-implementation.md)

---

**Last Updated:** 2026-01-14
**Maintained By:** Development Team
