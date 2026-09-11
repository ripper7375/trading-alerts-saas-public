# Windows MT5 + Pipeline Restoration Runbook (Vultr Snapshot)

**Snapshot Name:** `windows-mt5-r2-news-backup`  
**OS Version:** Windows Server 2022 Standard x64  
**Primary Location:** Singapore (or broker-adjacent region)  
**Minimum Hardware:** 2 vCPU / 4 GB RAM (Cloud Compute)

---

## 1. Overview & Preserved Components

When deploying a new server from the `windows-mt5-r2-news-backup` snapshot, the following components and configurations are **100% pre-installed and ready to run**:

- **MetaTrader 5 Terminal:**
  - Located at `C:\MT5\terminal64.exe`.
  - Data Directory: `C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\E23367DD11DBEB0EF97D08185EAB7295\`.
  - Directory Junction: `C:\MT5\MQL5\Files` ⮂ `...\MQL5\Files`.
  - All **13 Custom Indicators** compiled natively into `.ex5` binaries in `MQL5\Indicators`.
  - **`EconomicCalendarExport_v2_29.ex5`** EA compiled and ready.
  - Startup Shortcut: Auto-launches MT5 on Administrator logon.
- **Python Runtime & Pipeline Scripts (`C:\Scripts`):**
  - Python 3.11 (`C:\Python311`).
  - Collector: `C:\Scripts\collector\export_collector_validator_v2.py`.
  - Push Worker: `C:\Scripts\backfill\backfill_worker_api_gateway_v5.py`.
  - Chart Renderer: `C:\Scripts\renderer\mtf_render_upload_worker.py`.
  - SQLite Database: `C:\Scripts\database\xauusd.db`.
- **NSSM Windows Services (Auto-Start):**
  - `MT5Collector`
  - `MT5PushWorker`
  - `MT5Renderer`

---

## 2. Step-by-Step Restoration Procedure

### Step 2.1: Deploy Server in Vultr

1. Log in to [Vultr Dashboard](https://my.vultr.com/).
2. Click **Deploy +** → **Deploy New Server**.
3. Select **Cloud Compute - Shared CPU** (or Dedicated/High Performance).
4. **Server Location:** Choose **Singapore** (lowest latency to broker demo/live servers).
5. **Server Image:**
   - Click the **Snapshots** tab.
   - Select **`windows-mt5-r2-news-backup`**.
6. **Server Size:**
   - Select **2 vCPU / 4 GB RAM** (e.g. ~$24–$28/mo, billed hourly at ~$0.036–$0.04/hr).
7. Click **Deploy Now**.
8. Wait ~3–5 minutes for Vultr to restore the disk image and boot Windows.

---

### Step 2.2: Connect via Remote Desktop (RDP)

1. In the Vultr instance details page, note the **New IP Address**.
2. Open **Remote Desktop Connection** (`mstsc.exe`) on your local machine.
3. Enter the new IP address.
4. Log in with:
   - **Username:** `Administrator`
   - **Password:** The same Windows Administrator password configured before snapshot.

---

### Step 2.3: Verify MT5 Terminal & Broker Feed

1. Upon login, MT5 will start automatically from the Startup shortcut.
2. Check the **bottom-right corner** of MT5:
   - Verify active data connection (green/blue signal bars and transfer rate, e.g. `250/15 kb`).
   - If not connected: Click **File → Login to Trade Account** and enter your credentials.
3. Verify **Algo Trading** on the top toolbar is **Green** (enabled).
4. Open the required charts:
   - Open **`XAUUSD, M15`** and confirm **`EconomicCalendarExport_v2_29`** EA is attached (smiley face active in top-right corner).
   - Open **`XAUUSD, M5`** and attach the 1–2 indicators needed for current market conditions.

---

### Step 2.4: Verify Background Windows Services

Open **PowerShell as Administrator** and check the service status:

```powershell
Get-Service -Name MT5* | Format-Table Name, Status, StartType -AutoSize
```

**Expected Output:**

```text
Name          Status  StartType
----          ------  ---------
MT5Collector  Running Automatic
MT5PushWorker Running Automatic
MT5Renderer   Running Automatic
```

_If any service is stopped, run:_

```powershell
Start-Service MT5Collector, MT5PushWorker, MT5Renderer
```

---

## 3. Quick Health Verification (PowerShell)

Run this diagnostic script in PowerShell on the VPS to verify the pipeline:

```powershell
# 1. Verify live indicator and calendar exports
Write-Host "`n=== RECENT EXPORT FILES ===" -ForegroundColor Cyan
Get-ChildItem "C:\MT5\MQL5\Files\*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name, LastWriteTime, Length | Format-Table -AutoSize

# 2. Check Push Worker activity
Write-Host "`n=== PUSH WORKER LOG (TAIL) ===" -ForegroundColor Cyan
Get-Content "C:\Scripts\backfill\backfill_worker.log" -Tail 10 -ErrorAction SilentlyContinue

# 3. Check MT5 Memory and CPU
Write-Host "`n=== MT5 PROCESS HEALTH ===" -ForegroundColor Cyan
Get-Process terminal64 | Select-Object ProcessName, @{Name="RAM (MB)"; Expression={[math]::round($_.WorkingSet64 / 1MB, 2)}}, CPU
```

### Health Criteria:

- `EconomicCalendar.txt` updates every 15 minutes (~90 KB).
- Attached indicators update their `{Name}_XAUUSD_{TF}.txt` files every minute at second `:59`.
- Push worker logs indicate regular drains with 200/201 HTTP status codes.
- `https://davintrade.app/terminal` renders active Tokyo session clock and upcoming high-impact news countdown.

---

## 4. Teardown Reminder (Cost Control)

When testing or trading sessions conclude:

1. Ensure outbox is drained:
   ```powershell
   & C:\Python311\python.exe -c "import sqlite3; conn = sqlite3.connect('C:/Scripts/database/xauusd.db'); print('Unsynced market rows:', conn.execute('SELECT count(*) FROM market_data WHERE synced_at IS NULL').fetchone()[0]); print('Unsynced events:', conn.execute('SELECT count(*) FROM economic_events WHERE synced_at IS NULL').fetchone()[0]); conn.close()"
   ```
2. In Vultr Dashboard, take a new snapshot if you made code or configuration changes.
3. Once snapshot is **Complete**, destroy the instance to stop hourly billing.
