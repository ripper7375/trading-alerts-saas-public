# MT5 Installation & Configuration Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Download MT5](#download-mt5)
4. [Single Instance Installation](#single-instance-installation)
5. [Multiple Instance Setup](#multiple-instance-setup)
6. [Account Configuration](#account-configuration)
7. [Symbol Configuration](#symbol-configuration)
8. [Timeframe Configuration](#timeframe-configuration)
9. [Terminal Settings](#terminal-settings)
10. [Verification](#verification)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers installing and configuring 15 MT5 terminal instances on Contabo VPS, each monitoring a specific trading symbol.

**Symbols to Monitor (15 total):**
| Forex | Crypto | Indices | Commodities |
|-------|--------|---------|-------------|
| AUDJPY | BTCUSD | NDX100 | XAGUSD |
| AUDUSD | ETHUSD | US30 | XAUUSD |
| EURUSD | | | |
| GBPJPY | | | |
| GBPUSD | | | |
| NZDUSD | | | |
| USDCAD | | | |
| USDCHF | | | |
| USDJPY | | | |

**Timeframes to Collect (9 total):**
- M5, M15, M30, H1, H2, H4, H8, H12, D1

---

## Prerequisites

Before starting MT5 installation:

- [ ] Contabo VPS setup complete (see [VPS Setup Guide](./01-contabo-vps-setup-guide.md))
- [ ] Windows Server accessible via RDP
- [ ] MT5 broker account credentials ready:
  - Login number
  - Password
  - Server name
- [ ] Internet connection verified

---

## Download MT5

### Option 1: Download from Broker

Most brokers provide their branded MT5 installer:

1. Log in to your broker's client portal
2. Navigate to "Trading Platforms" or "Downloads"
3. Download MT5 for Windows (64-bit)

**Common Broker Download Pages:**
- IC Markets: Client Portal → Downloads
- Pepperstone: Client Portal → Platforms
- Exness: Personal Area → Platforms
- XM: Members Area → Platforms

### Option 2: Download from MetaQuotes

If broker doesn't provide branded version:

1. Go to https://www.metatrader5.com/en/download
2. Click "Download MetaTrader 5 for Windows"
3. Save the installer

### Option 3: Direct Download Link

```powershell
# Download MT5 directly using PowerShell
$url = "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
$output = "C:\Users\Administrator\Downloads\mt5setup.exe"
Invoke-WebRequest -Uri $url -OutFile $output
```

---

## Single Instance Installation

### Step 1: Run Installer

```powershell
# Navigate to downloads
cd C:\Users\Administrator\Downloads

# Run installer
.\mt5setup.exe
```

### Step 2: Installation Wizard

1. **License Agreement:** Read and accept
2. **Installation Path:**
   - Default: `C:\Program Files\MetaTrader 5`
   - For first instance, use default path
3. **Click "Next"** through remaining steps
4. **Finish:** Uncheck "Launch MT5" (we'll configure first)

### Step 3: Initial Launch

1. Launch MT5 from desktop shortcut
2. **Server Selection:**
   - Search for your broker's server
   - Or manually enter server address
3. **Skip demo account creation** (we'll use real account)

---

## Multiple Instance Setup

For 15 symbols, we need 15 separate MT5 installations.

### Method 1: Portable Mode (Recommended)

MT5 supports portable mode where data is stored in the installation folder:

```powershell
# Create directory for MT5 instances
New-Item -ItemType Directory -Force -Path "C:\MT5Terminals"

# Copy base installation for each symbol
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $destPath = "C:\MT5Terminals\MT5_$symbol"

    # Copy MT5 installation
    Copy-Item -Path "C:\Program Files\MetaTrader 5" -Destination $destPath -Recurse

    # Create portable mode flag file
    New-Item -ItemType File -Path "$destPath\portable" -Force

    Write-Host "Created MT5 instance for $symbol at $destPath"
}
```

### Method 2: Separate Installations

Run the installer multiple times with different paths:

```powershell
# Install to custom paths
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $installPath = "C:\MT5Terminals\MT5_$symbol"

    # Silent install to custom path
    Start-Process -FilePath "mt5setup.exe" -ArgumentList "/auto", "/S", "/D=$installPath" -Wait

    Write-Host "Installed MT5 for $symbol"
}
```

### Creating Desktop Shortcuts

```powershell
# Create shortcuts for each MT5 instance
$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $shortcut = $WshShell.CreateShortcut("$Desktop\MT5_$symbol.lnk")
    $shortcut.TargetPath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"
    $shortcut.WorkingDirectory = "C:\MT5Terminals\MT5_$symbol"
    $shortcut.Description = "MT5 Terminal for $symbol"
    $shortcut.Save()

    Write-Host "Created shortcut for MT5_$symbol"
}
```

---

## Account Configuration

### Step 1: Launch Each MT5 Instance

For each MT5 instance:

1. Double-click the desktop shortcut (e.g., `MT5_EURUSD`)
2. Wait for initial startup

### Step 2: Log In to Trading Account

1. **File** → **Login to Trade Account** (or press `Ctrl+L`)
2. Enter credentials:
   - **Login:** Your MT5 account number
   - **Password:** Your MT5 password
   - **Server:** Select your broker's server

3. Check **"Save password"** for automatic reconnection
4. Click **OK**

### Step 3: Verify Connection

Check bottom right of MT5 window:
- **Green bar:** Connected, data flowing
- **Red bar:** Disconnected, check credentials/network

### Automated Login Script

Create a script to launch all terminals:

```powershell
# File: C:\Scripts\start_all_mt5.ps1

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

Write-Host "Starting all MT5 terminals..." -ForegroundColor Cyan

foreach ($symbol in $symbols) {
    $exePath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"

    if (Test-Path $exePath) {
        Start-Process -FilePath $exePath
        Write-Host "Started MT5_$symbol" -ForegroundColor Green
        Start-Sleep -Seconds 2  # Stagger startups to reduce CPU spike
    } else {
        Write-Host "MT5_$symbol not found at $exePath" -ForegroundColor Red
    }
}

Write-Host "All terminals started." -ForegroundColor Cyan
```

---

## Symbol Configuration

### Step 1: Open Market Watch

In each MT5 instance:
1. **View** → **Market Watch** (or press `Ctrl+M`)

### Step 2: Add Required Symbol

1. Right-click in Market Watch window
2. Select **Symbols** (or press `Ctrl+U`)
3. Find your symbol:
   - Search in the search box
   - Or navigate through broker's symbol categories
4. Select the symbol and click **Show**
5. Click **OK**

### Step 3: Verify Symbol Names

**⚠️ Important:** Symbol names vary by broker!

| Standard | Possible Broker Names |
|----------|----------------------|
| EURUSD | EURUSD, EURUSDm, EURUSD., EURUSD+ |
| BTCUSD | BTCUSD, BTCUSDm, BITCOIN, BTC/USD |
| XAUUSD | XAUUSD, GOLD, GOLDm, XAU/USD |
| NDX100 | NDX100, NAS100, USTEC, NASDAQ |
| US30 | US30, DJ30, DOWJONES, US30Cash |

**Find your broker's symbol names:**
```
In Market Watch → Right-click → Symbols → Browse all available
```

### Step 4: Configure Chart for Symbol

1. **File** → **New Chart** (or press `Ctrl+N`)
2. Select your symbol
3. Set initial timeframe to M5 (data collector will read all timeframes)

### Per-Instance Symbol Assignment

| Instance | Symbol | Broker Symbol (verify) |
|----------|--------|------------------------|
| MT5_AUDJPY | AUDJPY | [Your broker's name] |
| MT5_AUDUSD | AUDUSD | [Your broker's name] |
| MT5_BTCUSD | BTCUSD | [Your broker's name] |
| MT5_ETHUSD | ETHUSD | [Your broker's name] |
| MT5_EURUSD | EURUSD | [Your broker's name] |
| MT5_GBPJPY | GBPJPY | [Your broker's name] |
| MT5_GBPUSD | GBPUSD | [Your broker's name] |
| MT5_NDX100 | NDX100 | [Your broker's name] |
| MT5_NZDUSD | NZDUSD | [Your broker's name] |
| MT5_US30 | US30 | [Your broker's name] |
| MT5_USDCAD | USDCAD | [Your broker's name] |
| MT5_USDCHF | USDCHF | [Your broker's name] |
| MT5_USDJPY | USDJPY | [Your broker's name] |
| MT5_XAGUSD | XAGUSD | [Your broker's name] |
| MT5_XAUUSD | XAUUSD | [Your broker's name] |

---

## Timeframe Configuration

### Required Timeframes

DataCollector.mq5 will collect data for these timeframes:

| Timeframe | MT5 Constant | Period |
|-----------|--------------|--------|
| M5 | PERIOD_M5 | 5 minutes |
| M15 | PERIOD_M15 | 15 minutes |
| M30 | PERIOD_M30 | 30 minutes |
| H1 | PERIOD_H1 | 1 hour |
| H2 | PERIOD_H2 | 2 hours |
| H4 | PERIOD_H4 | 4 hours |
| H8 | PERIOD_H8 | 8 hours |
| H12 | PERIOD_H12 | 12 hours |
| D1 | PERIOD_D1 | 1 day |

### Load Historical Data

For each symbol, download historical data:

1. Open chart for the symbol
2. **Tools** → **History Center** (or press `F2`)
3. Navigate to your symbol
4. For each timeframe:
   - Select timeframe
   - Click **Download**
   - Wait for download to complete

**Alternative Method - Direct Download:**
1. Open chart
2. Scroll back in time (drag left)
3. MT5 will automatically download historical data
4. Repeat for each timeframe

### Verify Data Availability

```mql5
// In MetaEditor or script, verify data:
int bars_m5  = iBars("EURUSD", PERIOD_M5);
int bars_h1  = iBars("EURUSD", PERIOD_H1);
int bars_d1  = iBars("EURUSD", PERIOD_D1);

Print("M5 bars: ", bars_m5);
Print("H1 bars: ", bars_h1);
Print("D1 bars: ", bars_d1);
```

---

## Terminal Settings

### Enable Algorithmic Trading

Required for DataCollector.mq5 service:

1. **Tools** → **Options** (or press `Ctrl+O`)
2. Go to **Expert Advisors** tab
3. Enable these settings:
   - [x] **Allow algorithmic trading**
   - [x] **Allow DLL imports** (required for SQLite)
   - [x] **Allow WebRequest for listed URL** (if needed)
4. Click **OK**

### Configure Auto-Startup

Make MT5 start automatically on Windows boot:

```powershell
# Create startup entries for all MT5 instances
$StartupFolder = [Environment]::GetFolderPath("Startup")
$WshShell = New-Object -ComObject WScript.Shell

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $shortcut = $WshShell.CreateShortcut("$StartupFolder\MT5_$symbol.lnk")
    $shortcut.TargetPath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"
    $shortcut.WorkingDirectory = "C:\MT5Terminals\MT5_$symbol"
    $shortcut.Save()
}

Write-Host "Startup shortcuts created"
```

### Disable Automatic Updates

Prevent MT5 from updating during trading hours:

1. **Tools** → **Options** → **Server** tab
2. Uncheck **Enable news**
3. **Note:** MT5 updates cannot be fully disabled, but run during off-hours

### Memory Optimization

Reduce memory usage when running 15 instances:

1. **Tools** → **Options** → **Charts** tab
2. Set **Max bars in chart:** 5000 (default is 65000)
3. **Tools** → **Options** → **Expert Advisors** tab
4. Disable visual testing if not needed

---

## Verification

### Checklist for Each MT5 Instance

Run this verification for each of the 15 instances:

```
MT5_EURUSD Verification:
- [ ] Terminal launches without errors
- [ ] Account logged in (green connection bar)
- [ ] Correct symbol in Market Watch
- [ ] Chart displays live data
- [ ] Historical data loaded (scroll back)
- [ ] Algorithmic trading enabled
- [ ] DLL imports allowed
```

### Verification Script

```powershell
# File: C:\Scripts\verify_mt5.ps1

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

Write-Host "MT5 Installation Verification" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$allPassed = $true

foreach ($symbol in $symbols) {
    $exePath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"
    $configPath = "C:\MT5Terminals\MT5_$symbol\config"

    if (Test-Path $exePath) {
        Write-Host "[PASS] MT5_$symbol - Executable found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] MT5_$symbol - Executable NOT found" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "`nAll MT5 installations verified!" -ForegroundColor Green
} else {
    Write-Host "`nSome installations failed verification" -ForegroundColor Red
}
```

### Check Running Instances

```powershell
# Count running MT5 processes
$mt5Processes = Get-Process | Where-Object {$_.ProcessName -eq "terminal64"}
Write-Host "MT5 instances running: $($mt5Processes.Count)"

# List all MT5 processes with memory usage
$mt5Processes | Format-Table ProcessName, Id, @{Label="Memory(MB)";Expression={[math]::Round($_.WorkingSet64/1MB,2)}}
```

---

## Troubleshooting

### Issue 1: Cannot Connect to Broker Server

**Symptoms:** Red bar in bottom right, "No connection"

**Solutions:**
1. Verify internet connection:
   ```powershell
   Test-NetConnection -ComputerName google.com -Port 443
   ```
2. Check broker server status (broker's website)
3. Verify credentials are correct
4. Try different server from dropdown
5. Check Windows Firewall allows MT5:
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*MetaTrader*"}
   ```

### Issue 2: Symbol Not Available

**Symptoms:** Symbol not in Market Watch or grayed out

**Solutions:**
1. Check if broker provides this symbol
2. Symbol might have different name:
   - BTCUSD might be BTCUSDm or BITCOIN
   - Check broker's symbol list
3. Check account type supports the symbol:
   - Some accounts are forex-only
   - Crypto/indices might require different account

### Issue 3: Historical Data Not Loading

**Symptoms:** Chart shows limited history

**Solutions:**
1. **Tools** → **History Center** → Download manually
2. Check **Tools** → **Options** → **Charts** → **Max bars in history**
3. Verify broker provides historical data for this symbol
4. Some brokers limit history for certain instruments

### Issue 4: High Memory Usage

**Symptoms:** VPS slows down, MT5 crashes

**Solutions:**
1. Reduce max bars in chart (Tools → Options → Charts)
2. Close unused charts/windows
3. Disable news (Tools → Options → Server)
4. Restart MT5 instances periodically
5. Consider upgrading VPS RAM

### Issue 5: MT5 Crashes on Startup

**Symptoms:** Terminal closes immediately after launch

**Solutions:**
1. Delete configuration folder:
   ```powershell
   # For portable mode
   Remove-Item "C:\MT5Terminals\MT5_EURUSD\config" -Recurse
   ```
2. Reinstall the specific instance
3. Check Windows Event Viewer for crash logs
4. Update graphics drivers (even for VPS)

### Issue 6: DLL Import Errors

**Symptoms:** DataCollector fails with DLL error

**Solutions:**
1. Verify "Allow DLL imports" is enabled
2. Check SQLite DLL is in correct location
3. Run MT5 as Administrator (first time)
4. Check Windows Defender isn't blocking

---

## Quick Reference

### MT5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+L` | Login to account |
| `Ctrl+M` | Market Watch |
| `Ctrl+N` | New Chart |
| `Ctrl+O` | Options |
| `Ctrl+U` | Symbols |
| `F2` | History Center |
| `F7` | Expert Advisor settings |

### MT5 Instance Paths

```
C:\MT5Terminals\MT5_AUDJPY\terminal64.exe
C:\MT5Terminals\MT5_AUDUSD\terminal64.exe
C:\MT5Terminals\MT5_BTCUSD\terminal64.exe
... (15 total)
```

### Expected Resource Usage

| Resource | Per Instance | Total (15 instances) |
|----------|--------------|---------------------|
| RAM | ~500MB - 1GB | ~7.5GB - 15GB |
| CPU | ~2-5% | ~30-75% (peak) |
| Disk | ~200MB | ~3GB |

---

## Next Steps

After completing MT5 installation:

1. ➡️ **[Indicator Installation Guide](./03-indicator-installation-guide.md)** - Install custom indicators
2. ➡️ **[DataCollector Deployment Guide](./04-datacollector-deployment-guide.md)** - Deploy MQL5 service

---

## Checklist

Before proceeding to indicator installation:

- [ ] All 15 MT5 instances installed in `C:\MT5Terminals\`
- [ ] Each instance logged in to trading account
- [ ] Each instance has correct symbol in Market Watch
- [ ] Algorithmic trading enabled in all instances
- [ ] DLL imports allowed in all instances
- [ ] Historical data downloaded for all symbols
- [ ] Desktop shortcuts created for quick access
- [ ] Startup shortcuts created for auto-launch
- [ ] Verification script passes for all instances

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
