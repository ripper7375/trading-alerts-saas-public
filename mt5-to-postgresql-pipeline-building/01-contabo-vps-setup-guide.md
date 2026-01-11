# Contabo VPS Setup Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Contabo Account Registration](#contabo-account-registration)
3. [VPS Plan Selection](#vps-plan-selection)
4. [VPS Access Setup](#vps-access-setup)
5. [Initial Windows Configuration](#initial-windows-configuration)
6. [Required Software Installation](#required-software-installation)
7. [Directory Structure Setup](#directory-structure-setup)
8. [Firewall Configuration](#firewall-configuration)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers setting up a Contabo Windows VPS to run:

- 15 MT5 terminal instances (one per trading symbol)
- DataCollector.mq5 service (MQL5 data collector)
- SQLite to PostgreSQL sync script

**Architecture Position:**

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTABO VPS (This Guide)                  │
├─────────────────────────────────────────────────────────────┤
│  MT5 Terminals (×15) → DataCollector.mq5 → SQLite Buffer   │
│                                    ↓                         │
│               Sync Script (Python) → PostgreSQL (Railway)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Contabo Account Registration

### Step 1: Navigate to Contabo

**URL:** https://contabo.com

### Step 2: Create Account

1. Click **"My Account"** in the top navigation
2. Select **"Register"**
3. Fill in registration form:
   - Email address (use business email if available)
   - Password (strong, 12+ characters)
   - Name and contact information
4. Verify email address
5. Complete any verification steps (may require ID verification)

### Step 3: Payment Setup

**Accepted Payment Methods:**

- Credit/Debit Card (Visa, Mastercard)
- PayPal
- Bank Transfer (SEPA for EU)

**Billing Options:**

- Monthly billing
- Annual billing (discount available)

---

## VPS Plan Selection

### Recommended Plans

| Plan      | vCPU  | RAM       | SSD        | Price/Month | Recommendation  |
| --------- | ----- | --------- | ---------- | ----------- | --------------- |
| VPS S     | 4     | 8 GB      | 50 GB      | ~€5.99      | Minimum viable  |
| **VPS M** | **6** | **16 GB** | **100 GB** | **~€10.99** | **Recommended** |
| VPS L     | 8     | 30 GB     | 200 GB     | ~€16.99     | For scaling     |

### Why VPS M is Recommended

- **16 GB RAM:** Each MT5 instance uses ~500MB-1GB RAM
  - 15 MT5 instances × 1GB = ~15GB
  - Plus OS and sync script overhead
- **6 vCPU:** MT5 is CPU-intensive for indicator calculations
- **100 GB SSD:** Sufficient for SQLite buffer and MT5 data

### VPS Configuration Options

When ordering, select:

1. **Operating System:** Windows Server 2019 or 2022
   - ⚠️ **Important:** Select Windows (not Linux)
   - Windows Server license is included (~€7-10/month additional)

2. **Location:** Choose based on your broker's servers
   - EU (Germany) - Best for European brokers
   - US (New York) - Best for US brokers
   - Asia - Best for Asian brokers

3. **Additional Storage:** Not required initially
   - Can be added later if needed

### Total Expected Monthly Cost

| Component              | Cost              |
| ---------------------- | ----------------- |
| VPS M (base)           | ~€10.99           |
| Windows Server License | ~€7.00            |
| **Total**              | **~€17.99/month** |

---

## VPS Access Setup

### Step 1: Receive Credentials

After ordering, you'll receive (usually within 24 hours):

- **IP Address:** e.g., `173.212.xxx.xxx`
- **Username:** `Administrator`
- **Password:** (temporary, change immediately)
- **RDP Port:** 3389 (default)

### Step 2: Connect via Remote Desktop (Windows)

**From Windows 10/11:**

1. Press `Win + R` to open Run dialog
2. Type `mstsc` and press Enter
3. In Remote Desktop Connection:
   - **Computer:** Enter your VPS IP address
   - **Username:** `Administrator`
4. Click **Connect**
5. Enter password when prompted
6. Accept certificate warning (first connection only)

**Connection Settings (Recommended):**

```
Display:       1920×1080 or higher
Local Resources:
  - Enable clipboard sharing
  - Enable local drives (for file transfer)
Experience:    LAN (for best performance)
```

### Step 3: Connect via Remote Desktop (Mac)

1. Download **Microsoft Remote Desktop** from App Store
2. Click **+** → **Add PC**
3. Enter:
   - **PC name:** Your VPS IP address
   - **User account:** Add account → `Administrator`
4. Double-click to connect

### Step 4: First Login Tasks

1. **Change Administrator Password:**

   ```
   Press Ctrl+Alt+End (not Ctrl+Alt+Del in RDP)
   Select "Change a password"
   Create strong password (save in password manager)
   ```

2. **Set Timezone:**
   - Right-click clock → Adjust date/time
   - Set to UTC for consistency with trading data

3. **Disable Auto-Updates (Optional):**
   - To prevent unexpected reboots during trading hours
   - Run `gpedit.msc`
   - Navigate: Computer Config → Admin Templates → Windows Components → Windows Update
   - Configure "Configure Automatic Updates" → Disabled or "Notify for download"

---

## Initial Windows Configuration

### Windows Server Manager Initial Setup

After first login, Server Manager opens automatically:

1. **Configure Local Server:**
   - Click "Local Server" in left panel
   - Set "IE Enhanced Security Configuration" to **Off** (for Admin and Users)
   - Verify Remote Desktop is **Enabled**

2. **Windows Firewall:**
   - Keep enabled (configure later)
   - Note: RDP port 3389 is open by default

### System Updates (Initial)

Run Windows Update to get security patches:

```powershell
# Open PowerShell as Administrator
# Check for updates
Get-WindowsUpdate

# Or use Settings
# Settings → Update & Security → Check for updates
```

**⚠️ Note:** After initial updates, consider disabling auto-updates to prevent disruption during trading hours.

### Performance Optimization

**Disable Unnecessary Services:**

```powershell
# Open PowerShell as Administrator

# Disable Windows Search (not needed on VPS)
Stop-Service WSearch
Set-Service WSearch -StartupType Disabled

# Disable Print Spooler (not needed)
Stop-Service Spooler
Set-Service Spooler -StartupType Disabled

# Disable Windows Defender real-time (optional, reduces CPU)
# Only if you trust all software you install
Set-MpPreference -DisableRealtimeMonitoring $true
```

**Virtual Memory Settings:**

1. Right-click This PC → Properties → Advanced system settings
2. Performance → Settings → Advanced → Virtual memory → Change
3. Uncheck "Automatically manage"
4. Set custom size:
   - Initial: 8192 MB
   - Maximum: 16384 MB
5. Click Set → OK (requires restart)

---

## Required Software Installation

### Step 1: Python 3.8+ Installation

**Download:**

1. Go to https://www.python.org/downloads/windows/
2. Download Python 3.11.x (64-bit installer)
3. **Important:** Check "Add Python to PATH" during installation
4. Choose "Customize installation" → Select all optional features
5. Install for all users

**Verify Installation:**

```powershell
python --version
# Expected: Python 3.11.x

pip --version
# Expected: pip 23.x from ...
```

### Step 2: Git Installation (Optional but Recommended)

**Download:**

1. Go to https://git-scm.com/download/win
2. Download 64-bit Git for Windows
3. Install with default settings

**Verify:**

```powershell
git --version
# Expected: git version 2.x.x
```

### Step 3: Text Editor

**Option A: Notepad++ (Recommended)**

1. Download from https://notepad-plus-plus.org/downloads/
2. Install with default settings

**Option B: VS Code**

1. Download from https://code.visualstudio.com/
2. Install with default settings
3. Recommended extensions: Python, SQLite Viewer

### Step 4: Database Tools

**SQLite CLI:**

1. Download from https://sqlite.org/download.html
2. Download "sqlite-tools-win32-x86-xxxx.zip"
3. Extract to `C:\Tools\sqlite`
4. Add to PATH:
   ```powershell
   [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Tools\sqlite", "Machine")
   ```

**DB Browser for SQLite (GUI, Optional):**

1. Download from https://sqlitebrowser.org/dl/
2. Install with default settings

### Step 5: PostgreSQL Client Tools (Optional)

```powershell
# Download from EnterpriseDB
# https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

# Or use pip
pip install pgcli
```

---

## Directory Structure Setup

### Create Required Directories

```powershell
# Open PowerShell as Administrator

# Create MT5 data directory
New-Item -ItemType Directory -Force -Path "C:\MT5Data"

# Create scripts directory
New-Item -ItemType Directory -Force -Path "C:\Scripts"
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package"
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package\logs"

# Create MT5 installations directory (optional, MT5 creates its own)
New-Item -ItemType Directory -Force -Path "C:\MT5Terminals"

# Create backup directory
New-Item -ItemType Directory -Force -Path "C:\Backups"

# Create logs directory
New-Item -ItemType Directory -Force -Path "C:\Logs"
```

### Expected Final Structure

```
C:\
├── MT5Data\
│   └── trading_data.db          # SQLite database (created by DataCollector)
│
├── Scripts\
│   └── sync_package\
│       ├── __init__.py
│       ├── config.py
│       ├── db_connections.py
│       ├── sync_to_postgresql.py
│       ├── timeframe_filter.py
│       ├── requirements.txt
│       ├── .env                  # Environment variables
│       ├── sync_state.json       # Sync state tracking
│       ├── sync.log              # Sync logs
│       └── logs\                 # Additional logs
│
├── Program Files\
│   └── MetaTrader 5\
│       ├── MT5_EURUSD\           # Instance 1
│       ├── MT5_BTCUSD\           # Instance 2
│       └── ... (15 instances)
│
├── Backups\
│   └── sqlite_backup_YYYYMMDD.db
│
└── Logs\
    └── system_logs\
```

### Set Directory Permissions

```powershell
# Ensure Python scripts can write to directories
icacls "C:\MT5Data" /grant "Everyone:(OI)(CI)F"
icacls "C:\Scripts" /grant "Everyone:(OI)(CI)F"
icacls "C:\Logs" /grant "Everyone:(OI)(CI)F"
```

---

## Firewall Configuration

### Required Outbound Connections

The VPS needs to connect to:

| Destination        | Port     | Protocol | Purpose            |
| ------------------ | -------- | -------- | ------------------ |
| Railway PostgreSQL | 55082    | TCP      | Database sync      |
| Railway Redis      | 47725    | TCP      | Caching (optional) |
| MT5 Broker Server  | 443/1950 | TCP      | MT5 data feed      |

### Configure Windows Firewall

```powershell
# Open PowerShell as Administrator

# Allow Python outbound (sync script)
New-NetFirewallRule -DisplayName "Python Outbound" `
    -Direction Outbound `
    -Program "C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" `
    -Action Allow

# Allow MT5 outbound (all instances)
New-NetFirewallRule -DisplayName "MT5 Outbound" `
    -Direction Outbound `
    -Program "C:\Program Files\MetaTrader 5\terminal64.exe" `
    -Action Allow

# Verify rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Outbound*"}
```

### Test Connectivity

```powershell
# Test PostgreSQL connectivity
Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082

# Test Redis connectivity
Test-NetConnection -ComputerName switchyard.proxy.rlwy.net -Port 47725

# Expected output:
# TcpTestSucceeded : True
```

---

## Security Best Practices

### 1. Change RDP Port (Recommended)

Default RDP port (3389) is heavily targeted by bots.

```powershell
# Change RDP port to custom port (e.g., 33389)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'PortNumber' -Value 33389

# Add firewall rule for new port
New-NetFirewallRule -DisplayName "RDP Custom Port" `
    -Direction Inbound `
    -LocalPort 33389 `
    -Protocol TCP `
    -Action Allow

# Restart RDP service
Restart-Service TermService -Force
```

**⚠️ Note:** After changing port, connect with: `IP:33389`

### 2. Enable Account Lockout

```powershell
# Configure account lockout policy
net accounts /lockoutthreshold:5 /lockoutduration:30 /lockoutwindow:30
```

### 3. Create Service Account

Create a dedicated account for running sync scripts:

```powershell
# Create local user for sync service
$password = ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force
New-LocalUser -Name "SyncService" -Password $password -Description "Trading Alerts Sync Service Account"

# Add to appropriate groups
Add-LocalGroupMember -Group "Users" -Member "SyncService"
```

### 4. Environment Variable Security

Store sensitive credentials in environment variables, not in code:

```powershell
# Set environment variables at system level
[Environment]::SetEnvironmentVariable("POSTGRESQL_URI", "postgresql://...", "Machine")
[Environment]::SetEnvironmentVariable("REDIS_URL", "redis://...", "Machine")
```

### 5. Enable Windows Event Logging

```powershell
# Enable audit logging for security events
auditpol /set /category:"Logon/Logoff" /success:enable /failure:enable
auditpol /set /category:"Account Logon" /success:enable /failure:enable
```

---

## Troubleshooting

### Issue 1: Cannot Connect via RDP

**Symptoms:** Connection refused or timeout

**Solutions:**

1. Verify VPS is running in Contabo control panel
2. Check IP address is correct
3. Verify firewall allows RDP:
   ```powershell
   # From another machine
   Test-NetConnection -ComputerName YOUR_VPS_IP -Port 3389
   ```
4. Check Windows Firewall on VPS (via Contabo console)
5. Contact Contabo support if issue persists

### Issue 2: Python Not Found in PATH

**Symptoms:** `'python' is not recognized as an internal or external command`

**Solution:**

```powershell
# Add Python to PATH manually
$pythonPath = "C:\Users\Administrator\AppData\Local\Programs\Python\Python311"
$scriptsPath = "$pythonPath\Scripts"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$pythonPath;$scriptsPath", "Machine")

# Restart PowerShell to apply
```

### Issue 3: Cannot Connect to Railway PostgreSQL

**Symptoms:** Connection timeout or refused

**Solutions:**

1. Verify Railway service is running
2. Check firewall allows outbound on port 55082:
   ```powershell
   Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082
   ```
3. Verify connection string is correct
4. Check Railway for IP allowlist settings

### Issue 4: Disk Space Running Low

**Symptoms:** Sync script fails, MT5 crashes

**Solutions:**

1. Check disk space:
   ```powershell
   Get-PSDrive C
   ```
2. Clean up temp files:
   ```powershell
   Remove-Item -Path "$env:TEMP\*" -Recurse -Force
   Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force
   ```
3. Compress old log files
4. Consider upgrading storage in Contabo

### Issue 5: VPS Performance Degradation

**Symptoms:** Slow response, high CPU/memory usage

**Solutions:**

1. Check resource usage:
   ```powershell
   Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
   Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10
   ```
2. Restart problematic MT5 instances
3. Check for Windows updates running in background
4. Review sync script logs for errors

---

## Quick Reference Commands

```powershell
# System Information
systeminfo | findstr /B /C:"OS Name" /C:"Total Physical Memory"

# Disk Space
Get-PSDrive C

# Running Processes
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10

# Network Connections
netstat -an | findstr ESTABLISHED

# Service Status
Get-Service | Where-Object {$_.Status -eq "Running"}

# Event Logs (last 10 errors)
Get-EventLog -LogName System -EntryType Error -Newest 10

# Restart VPS (if needed)
Restart-Computer -Force
```

---

## Next Steps

After completing VPS setup:

1. ➡️ **[MT5 Installation Guide](./02-mt5-installation-guide.md)** - Install 15 MT5 instances
2. ➡️ **[Indicator Installation Guide](./03-indicator-installation-guide.md)** - Install custom indicators
3. ➡️ **[DataCollector Deployment Guide](./04-datacollector-deployment-guide.md)** - Deploy MQL5 service

---

## Checklist

Before proceeding to MT5 installation:

- [ ] Contabo account created and verified
- [ ] VPS M (or appropriate plan) ordered with Windows Server
- [ ] VPS credentials received
- [ ] RDP connection tested and working
- [ ] Administrator password changed
- [ ] Python 3.8+ installed and verified
- [ ] Directory structure created
- [ ] Firewall configured for outbound connections
- [ ] Railway connectivity tested
- [ ] Security best practices implemented

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
