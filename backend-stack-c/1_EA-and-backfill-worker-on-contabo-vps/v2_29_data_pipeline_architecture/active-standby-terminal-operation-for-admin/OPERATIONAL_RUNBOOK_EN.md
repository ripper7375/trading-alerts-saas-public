# Administrator Operational Runbook: MT5 Terminal Active / Hot-Standby Promotion & Failover

## MT5 Terminal Promotion Operational Runbook (English Edition)

**Reference Documents:**

- Architectural Design: [`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`](../ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md)
- Work Completion Manifest: [`active-standby-terminal-manifest-work-completion.md`](../active-standby-terminal-manifest-work-completion.md)
- Core Runbook: [`docs/runbooks/mt5-terminal-promote.md`](../../../../docs/runbooks/mt5-terminal-promote.md)
- Automated Promotion Tool: [`promote_terminal.bat`](./promote_terminal.bat)

---

## 1. Executive Summary & Architecture Overview

In the v6 market data pipeline, MetaTrader 5 (MT5) calculates EDT indicators whose anchors and parameters must be retuned as financial markets form new price centroids.

Historically, retuning directly on a single production terminal caused ~3,000 historical bars (approx. 2.2 weeks on M5) to be silently recomputed and overwritten in the database without prior verification or audit trails.

To eliminate unverified mutations and downtime, the system implements an **Active / Hot-Standby Architecture** across a **three-terminal topology**:

| Terminal       | Roles & Payloads                                                                                 | Alternates?                  | Standard Export Path  |
| :------------- | :----------------------------------------------------------------------------------------------- | :--------------------------- | :-------------------- |
| **Terminal A** | 26 EDT indicator attachments (13 M5 + 13 M15) + Economic Calendar exporter                       | **Yes (Active ↔ Standby)**  | `C:\MT5-A\MQL5\Files` |
| **Terminal B** | 26 EDT indicator attachments (13 M5 + 13 M15) + Economic Calendar exporter                       | **Yes (Active ↔ Standby)**  | `C:\MT5-B\MQL5\Files` |
| **Terminal S** | 8 × Lightweight OHLCV Exporters (EURUSD, USDJPY, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, XAUUSD) | **Never (Permanent Static)** | `C:\MT5-S\MQL5\Files` |

### Core Mechanical Principles:

1. **Single Point of Ingestion:** The ingestion daemon (`MT5Collector`) consumes files from a single directory configured via `--export-dir`.
2. **Promotion Mechanism:** Promoting the standby terminal consists solely of pointing `--export-dir` to the standby terminal's `MQL5\Files` folder and restarting `MT5Collector`.
3. **Decoupled Currency Index Engine:** The `DavinTradeCurrencyIndexEngine` service reads `CGI_EXPORT_DIR`, which points permanently at **Terminal S**. It is completely isolated and must never be altered during a promotion.
4. **Renderer Independence:** `MT5Renderer` reads directly from SQLite (`xauusd.db`), not the export directory, and operates without interruption during promotions.

---

## 2. Four Mandatory Preconditions

Never initiate a promotion without verifying all four preconditions:

1. **Hot Standby Verification:**
   - The standby terminal must be **actively running**, charts connected to broker live feeds, and indicators generating ticks. A closed or frozen terminal will trigger a stale directory rejection.
2. **Export Freshness:**
   - Verify that `.txt` exports inside the standby terminal's `MQL5\Files` directory have timestamps matching the current bar interval.
3. **Visual Confirmation:**
   - The administrator must visually inspect and validate indicator plots and anchor points directly on the standby terminal's MT5 charts. The database does not validate indicator aesthetics or mathematical validity.
4. **Active Terminal Integrity (Rollback Insurance):**
   - Ensure the currently active terminal is healthy. Immediately after promotion, this terminal becomes your sole rollback fallback. Never promote if the active terminal is already in a failed state.

---

## 3. Operational Workflow (Step-by-Step)

### Step 1: Access the Windows VPS

1. Launch **Remote Desktop Connection (`mstsc.exe`)** from your management workstation.
2. Connect to the VPS using your administrator credentials.

---

### Step 2: Retune Indicators on the Standby Terminal

1. Open the MetaTrader 5 instance of the **Standby Terminal** (e.g., if Terminal A is currently Active, open **Terminal B**).
2. Adjust the necessary indicator parameters and reposition anchors according to market conditions.
3. Verify that the indicator curves render cleanly and logically across both M5 and M15 charts.

---

### Step 3: Execute the Promotion via `promote_terminal.bat` (Recommended)

To eliminate manual syntax mistakes, use the automated promotion script:

1. Navigate to:
   `D:\SaaS Project\trading-alerts-saas-public\backend-stack-c\1_EA-and-backfill-worker-on-contabo-vps\v2_29_data_pipeline_architecture\active-standby-terminal-operation-for-admin\`
2. Right-click **`promote_terminal.bat`** and select **"Run as administrator"**.
3. The interactive console will detect and display the current state:

   ```text
   ============================================================================
           MT5 COLLECTOR ACTIVE / HOT-STANDBY PROMOTION TOOL (v2.29)
   ============================================================================

   [Current Service Status]
     - Currently Active Terminal : [ Terminal A ]
     - Active Ingestion Path     : C:\MT5-A\MQL5\Files

   ============================================================================
   Select Action:
     [1] Switch ingestion to Terminal A (C:\MT5-A\MQL5\Files)
     [2] Switch ingestion to Terminal B (C:\MT5-B\MQL5\Files)
     [3] View recent collector logs (View Recent Logs)
     [0] Exit
   ============================================================================
   * Recommended: Currently on Terminal A --> Select [2] to promote Terminal B
   ```

4. Enter **`2`** (or target terminal) and press **Enter**.
5. The script automatically executes an automated **Pre-flight Check**:
   - Confirms destination directory existence.
   - Inspects file timestamps to ensure exports are fresh (<15 minutes old).
6. When prompted:
   `Do you want to proceed with the switch? (Type Y to confirm / N to cancel):`
   Type **`Y`** and press **Enter**.
7. The script automatically:
   - Sets NSSM `AppParameters` with all required arguments.
   - Restarts `MT5Collector`.
   - Displays the trailing 25 lines of `collector.log`.

---

### Alternative: Manual CLI Promotion (Fallback)

If the batch script is unavailable, execute the commands manually in an elevated PowerShell session:

1. Inspect current parameters:
   ```powershell
   nssm get MT5Collector AppParameters
   ```
2. Update parameters wholesale (every argument must be included):
   ```powershell
   nssm set MT5Collector AppParameters "C:\Scripts\collector\export_collector_validator_v2.py --export-dir C:\MT5-B\MQL5\Files --db C:\Scripts\database\xauusd.db --timeframes M5,M15"
   ```
3. Restart the service:
   ```powershell
   nssm restart MT5Collector
   ```

> [!CAUTION]
> **Never execute `install_services.bat` to apply a switch.** Batch installation files overwrite environment variables (`AppEnvironmentExtra`), replacing real production credentials with placeholder defaults and breaking push worker ingestion.

---

## 4. Verification & Ingestion Dynamics

### Verification via Collector Logs

Monitor `C:\Scripts\logs\collector.log`:

1. **Startup Signature:**
   Confirm the ingestion directory has shifted to the new terminal:
   ```text
   Export collector v2 (v6 pipeline) — db=... exports=C:\MT5-B\MQL5\Files tfs=M5,M15
   ```
2. **Cycle Execution (Within 5 Minutes):**
   Verify the subsequent cycle passes validation and successfully promotes:
   ```text
   📥 Cycle 2026-09-13 06:40:00 (M5) -> validation clean -> promoted
   ```

### User-Facing Behavior (Progressive Repaint)

- **Zero Downtime:** Client connections and API gateways experience no outage.
- **History Replay Window:** Re-anchoring triggers a full recalculation of ~6,000 rows across M5/M15 windows. `promote_cycle` sets `synced_at = NULL`.
- **Sync Speed:** The Push Worker drains rows at ~500 rows per 30-second cycle, completing full history synchronization in **5–6 minutes**.
- **Left-to-Right Redraw:** Rows are ingested oldest-first. The user's chart repaints progressively from historical bars toward the newest live bar at the right edge.

---

## 5. The Standby Discipline Rule

> [!IMPORTANT]
> **Do not modify or shut down the demoted terminal immediately after promotion!**

- When Terminal B is promoted to Active, **Terminal A instantly becomes the Hot Standby**.
- Terminal A represents your **only immediate rollback mechanism**.
- Allow Terminal A to continue running untouched for at least **15–30 minutes** until Terminal B's production stability is definitively verified.
- Only after full verification is Terminal A released for subsequent retuning cycles.

```text
  [Terminal A: Active]   --> Admin tunes Terminal B
                                |
                              Promote
                                v
  [Terminal B: Active]   --> Terminal A frozen as rollback insurance
                                |
                              Verified stable in production
                                v
  [Terminal A: Released] --> Available as next tuning sandbox
```

---

## 6. Emergency Rollback Procedure

If anomalous indicator calculations or ingestion rejections occur:

1. Launch **`promote_terminal.bat`** (Run as Administrator).
2. The tool detects Terminal B as Active and prompts to switch back to Terminal A.
3. Select **`1`**, verify the pre-flight check, and type **`Y`**.
4. `MT5Collector` will immediately point back to `C:\MT5-A\MQL5\Files` and restart.
5. Ingestion resumes cleanly from Terminal A's exports, restoring previous values within ~5–6 minutes.

---

## 7. Common Gotchas & Troubleshooting

### Issue 1: Stale Export Directory Warning in Logs

```text
newest bar <ts> is <n>s behind cycle slot <ts> (max 600s) — stale export directory
⛔ Cycle slot <ts> (M5) gave up after 3 attempts
```

- **Cause:** The standby terminal was closed, frozen, or disconnected from the trade server (Cold Standby).
- **Remedy:** Roll back to the previous terminal immediately. Investigate the MT5 terminal window, confirm broker connectivity, and ensure the EA/Indicator exports are firing every minute.

### Issue 2: Currency & Gold Index Widget Disappears

- **Cause:** `CGI_EXPORT_DIR` was mistakenly altered to point to Terminal A or B.
- **Remedy:** Ensure `DavinTradeCurrencyIndexEngine` points strictly and permanently to Terminal S (`C:\MT5-S\MQL5\Files`).

### Issue 3: Economic Calendar Stops Ingesting

- **Cause:** `EconomicCalendarExport_v2_29.mq5` was omitted from one of the alternating terminals.
- **Remedy:** Attach the calendar exporter EA to both Terminal A and Terminal B. It carries zero tunable parameters and operates identically on both.
