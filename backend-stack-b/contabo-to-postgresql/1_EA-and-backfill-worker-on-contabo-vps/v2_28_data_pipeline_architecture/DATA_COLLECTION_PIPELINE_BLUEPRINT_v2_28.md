# Data Collection Pipeline — Architecture Blueprint (v2.28/v2.29 Stack)

**Status:** Blueprint for the entire data-pipeline stack development — **transition in progress, see §12**
**Last Updated:** 2026-06-12
**Scope:** Full market-data pipeline on the Contabo VPS: MT5 chart indicators →
auto-exported files → collection/validation/promotion (SQLite v5) → API
Gateway push, plus the legacy EA socket-push path (§1–§11) kept as reference.

> **June 2026 transition note:** the indicator set has been replaced (12 new
> export-selection indicators) and a new **export-file collection & validation
> pipeline (v5)** is being built around them. §1–§11 document the socket-push
> stack (now at EA v2.29); **§12 documents the v5 pipeline: what has changed,
> what is built, what remains to be built, and the decisions taken.** Read §12
> first if you are joining the project now.

This document is the single source of truth for the six components of the
market-data pipeline. Each has a detailed reference section:

| #   | Component                                                                  | Role                                             | Status                                       | Reference   |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- | ----------- |
| 1   | `SimpleDataCollector_v2_28_ASYNC_SOCKET.mq5`                               | Data producer EA (v2.29, new indicator set)      | ✅ Updated; not part of v5 data flow (§12.7) | §4.1        |
| 2   | `backfill_worker_api_gateway_v4.py`                                        | SQLite → gateway recovery/push worker            | ⚠️ Needs v5 rework (§12.6)                   | §4.3        |
| 3   | `mt5_api_relay_for_v2_28.py`                                               | Local async upload relay (schema-agnostic)       | ✅ No change needed                          | §4.2        |
| 4   | `sqlite_schema_v5_xauusd.sql`                                              | v5 staging / validation / market-data schema     | ✅ Created, verified                         | §4.5, §12.3 |
| 5   | `export_collector_validator_v1.py`                                         | Ingest 12 export files → validate → promote      | ✅ Built, tested on mock data                | §4.6, §12   |
| 6   | `mql5-indicators/mql5-indicator-export-selection/USE/mq5/*.mq5` (12 files) | Export data producers (auto-export every minute) | ✅ Auto-export added to all 12               | §4.4, §12.2 |

---

## 1. Design Goals

1. **Never block the MT5 terminal.** All internet I/O is delegated to Python
   processes; the EA's only network operation is a sub-millisecond TCP write to
   `127.0.0.1`.
2. **Never lose a bar.** Every collected bar has three chances to reach the
   API Gateway: live relay upload → relay retry/spill queue → SQLite backup
   drained by the backfill worker.
3. **Degrade gracefully.** Each layer can fail independently without taking
   down the others; a circuit breaker prevents a dead relay from slowing the EA.
4. **Stay observable.** Every component logs hourly/per-cycle statistics and
   persists undeliverable data in inspectable form (JSONL files, SQLite).

---

## 2. System Architecture

```
┌─────────────────────────────── Windows VPS (Contabo) ───────────────────────────────┐
│                                                                                      │
│  ┌─────────────────────┐   PRIMARY PATH (per completed bar)                          │
│  │ MT5 Terminal        │   TCP 127.0.0.1:5555, <1ms, fire-and-forget                 │
│  │  EA v2.28           │ ────────────────────────────────┐                           │
│  │  (per terminal,     │                                 ▼                           │
│  │   3 symbols × 9 TF) │   ┌──────────────────────────────────────────┐              │
│  │                     │   │ mt5_api_relay_for_v2_28.py               │              │
│  │  Circuit breaker:   │   │  asyncio TCP server                      │              │
│  │  10 fails → open    │   │  bounded queue (10,000)                  │  HTTPS POST  │
│  │  300s cooldown      │   │  4 upload workers                        │ ───────────► │ ──► Railway
│  └──────────┬──────────┘   │  5 retries, exp. backoff 2s→16s          │  (async)     │     API Gateway
│             │              │  spill: relay_spill_queue.jsonl          │              │     /api/v1/market-data
│             │ FALLBACK     │  replay spill every 60s                  │              │
│             │ (relay down/ └──────────────────────────────────────────┘              │
│             │  circuit open/                                                         │
│             │  send failed)                                                          │
│             ▼                                                                        │
│  ┌─────────────────────┐   RECOVERY PATH (continuous scan)                           │
│  │ SQLite backups      │   ┌──────────────────────────────────────────┐              │
│  │ C:/Scripts/database │   │ backfill_worker_api_gateway_v4.py        │  HTTPS POST  │
│  │  {symbol}.db        │ ◄─┤  scans every 5 min (30s when active)     │ ───────────► │ ──► Railway
│  │  61-col table/symbol│   │  drains ≤500 bars/symbol/cycle           │              │     API Gateway
│  │  PK(timestamp,tf)   │   │  deletes rows after confirmed 200/201    │              │
│  └─────────────────────┘   │  400 → quarantine rejected_rows.jsonl    │              │
│                            └──────────────────────────────────────────┘              │
│                                                                                      │
│  Audit only: backfill_queue.csv (written when BOTH paths fail; no consumer — §9.1)   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Data flow summary

1. **Collection trigger.** The EA detects completed bars two ways: `OnTick`
   (event-driven) and `OnTimer` every `DataCollectionIntervalSec` (default
   300s — a safety sweep for low-tick periods). Both share per-symbol/per-TF
   `lastProcessed[][]` dedup state, so a bar is processed exactly once.
2. **Primary path.** The bar (61 fields + `terminal_id`) is serialized to JSON,
   terminated with `\n`, and written to the relay over a fresh TCP connection.
   The EA requires the **entire** payload to be accepted by the socket
   (partial send = failure) and then closes the connection immediately.
3. **Relay.** Reads until EOF, enqueues the payload, and uploads to Railway
   asynchronously with retries. Undeliverable payloads spill to disk and are
   replayed every 60 seconds; permanent 4xx rejections (except 429) are logged
   and dropped.
4. **Fallback.** If the socket path fails (or the circuit breaker is open),
   the EA writes the bar to the per-symbol SQLite database instead.
5. **Recovery.** The backfill worker continuously drains SQLite rows to the
   gateway, deleting each row only after a confirmed 200/201. Gateway-rejected
   rows (400) are quarantined to `rejected_rows.jsonl` rather than destroyed.

### 2.2 Why a local relay instead of WebRequest (the v2.27 → v2.28 shift)

v2.27 called `WebRequest()` directly from the EA with a 3-second timeout.
`WebRequest` is synchronous on the EA thread, so WAN latency stalled the
terminal — multiplied across 3 symbols × 9 timeframes per sweep. v2.28 moves
all WAN I/O into the asyncio relay; the EA's blocking ceiling is the 50ms
socket connect timeout, and in practice localhost connects complete in
microseconds. The trade-off — losing per-message HTTP feedback in the EA —
is compensated by the relay's retry queue and the SQLite fallback.

---

## 3. Data Contract

### 3.1 Wire protocol (EA → Relay)

- Transport: TCP, `127.0.0.1:5555` (configurable via EA inputs).
- One payload per connection. The EA connects, sends, and closes.
- Framing: payload is UTF-8 JSON terminated by `\n`; the relay reads to EOF,
  so connection close is the authoritative frame boundary and the `\n` is
  belt-and-braces.
- No response is sent by the relay (fire-and-forget). "Success" at the EA
  means _all bytes were written to the local socket_, nothing more.

### 3.2 JSON payload (Relay → Gateway, and Worker → Gateway)

Field set = the SQLite columns (§3.3) **plus** `terminal_id`. With EA v2.29
this is **45 fields** (was 61 in v2.28) — the gateway's validation schema must
be migrated before EA v2.29 goes live:

- Live path: `terminal_id` = EA input (e.g. `"terminal_001"`).
- Backfill path: `terminal_id` = `"backfill_worker"`.

HTTP headers sent to the gateway (both Python components):

```
Authorization: Bearer <API_KEY>
Content-Type: application/json
X-Terminal-ID: <terminal id>
X-EA-Version: v2.28-ASYNC | backfill_worker_v4.py
```

> **Gateway requirement:** treat body `terminal_id` as authoritative, header
> as informational. Both senders now provide the body field, so the gateway
> MAY require it.

### 3.3 SQLite schema — EA fallback store (one DB per symbol, one table per symbol)

Path: `C:/Scripts/database/{sanitized_symbol}.db`, table `[{sanitized_symbol}]`,
WAL mode, `PRIMARY KEY (timestamp, timeframe)`.

**EA v2.29 — 45 columns**, in order: `timestamp` (epoch sec), `symbol`, `open`,
`high`, `low`, `close`, `volume`, `timeframe` (e.g. `"PERIOD_H1"`),
`ssa_trend`, `ssa_signal`, `ssa_cross`, 4 fractal-marker columns
(`fractal_upper_108`, `fractal_lower_108`, `fractal_upper_119`,
`fractal_lower_119`), 6 centroid-regression variants × 3 columns each
(`{variant}_baseline`, `{variant}_uoedt`, `{variant}_loedt` for `bestfit`,
`cherry_a`, `cherry_b`, `mostrecent`, `nonrecent_a`, `nonrecent_b`),
`fbf_best_fl`, `fbf_uoedt`, `fbf_loedt`, `best_resistance`, `best_support`,
`zigzag_peak`, `zigzag_bottom`, `zigzag_class`, `body_size`, `body_zscore`,
`candle_classification`, `collected_at` (epoch sec).

(EA v2.28's legacy 61-column layout — tema/hrma/smma/Heiken-Ashi/Keltner/
Sup-Res/Dual-TEMA/Pinbar — is retired with the old indicator set.)

Numeric indicator fields use `0` to encode "no value" (`EMPTY_VALUE` is
translated by the EA before serialization). **Note:** the v5 pipeline (§12)
deliberately uses `NULL` instead — the two stores have different semantics.

Timeframes collected by the EA: M5, M15, M30, H1, H2, H4, H8, H12, D1 (9 per
symbol). Production scope for the v5 pipeline is XAUUSD, M5/M15 only (§12.1).

### 3.4 Gateway response semantics (required behavior)

| Status                    | Relay behavior                           | Backfill worker behavior                                  |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| 200/201                   | Done                                     | Delete row from SQLite (batched, 50/txn)                  |
| 429                       | Retry with backoff (counts as transient) | Stop symbol, honor `Retry-After`, backoff cycle           |
| 400 / other 4xx (not 429) | Log body, drop (permanent)               | Quarantine row → `rejected_rows.jsonl`, remove from table |
| 401/403                   | Drop + log (relay)                       | **Stop everything** (critical config error)               |
| 5xx / timeout / network   | Retry ×5, then spill to disk             | Stop symbol this cycle, exponential backoff               |

> **Gateway requirement — idempotency:** the gateway MUST upsert / enforce a
> unique constraint on `(symbol, timeframe, timestamp)`. Duplicate delivery is
> possible by design (relay retry after an ambiguous failure; worker re-send
> when a POST succeeded but the SQLite delete failed). See §9.2.

---

## 4. Component Reference

### 4.1 EA — `SimpleDataCollector_v2_28_ASYNC_SOCKET.mq5` (internal version 2.29)

**Indicator set (v2.29):** the EA loads 11 iCustom handles per symbol/timeframe
slot — 6 centroid-regression variants (Best-Fit, Cherry-Pick A/B, Most-Recent,
Non-Most-Recent A/B; SSA trend/signal/cross and fractal 108/119 markers are
read once from the Best-Fit handle), 2EDT-Fractal-Best-Fit-v5,
Single-Best-Resistance/Support-Line-v3, ZigZag-Export-v43, and
zscore-ohlc-candle-export. `ohlcv-export-lightweight` has no indicator buffers,
so OHLCV stays native via `CopyRates`. New indicator inputs: shared SSA engine
settings, window-anchor datetimes for the windowed indicators (defaults go
stale — set per deployment), ZigZag depth/deviation/backstep, and candle
z-score length/thresholds. iCustom calls pass leading parameters only; all
remaining indicator inputs use their compiled defaults.

> ⚠️ **CPU load:** each centroid-regression handle runs an SSA engine over
> `InpSSAMathLookback` (3000) bars — 6 variants × 9 timeframes = 54 heavy
> handles per symbol. Monitor VPS CPU; reduce lookback or timeframes if needed.

**Key infrastructure inputs** (per-terminal):

| Input                                     | Default                  | Notes                                                                         |
| ----------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `SymbolsList`                             | `"BTCUSD,ETHUSD,XAUUSD"` | Comma-separated; broker suffixes auto-detected                                |
| `DatabasePath`                            | `C:/Scripts/database/`   | Shared with backfill worker — must match                                      |
| `EnableSocketRelay`                       | `true`                   | `false` = SQLite-only mode                                                    |
| `LocalRelayIP` / `LocalRelayPort`         | `127.0.0.1` / `5555`     | Must match relay config                                                       |
| `SocketTimeoutMs`                         | `50`                     | Max EA blocking per send. Do **not** lower below ~50ms (§10, hardening notes) |
| `TerminalID`                              | `terminal_001`           | Unique per terminal: `terminal_001` … `terminal_015`                          |
| `DataCollectionIntervalSec`               | `300`                    | Timer sweep period                                                            |
| `CircuitBreakerThreshold` / `CooldownSec` | `10` / `300`             | Consecutive socket failures → skip relay, write SQLite directly               |

**Behavior notes:**

- Circuit breaker: after 10 consecutive socket failures the EA stops attempting
  the relay for 300s and writes straight to SQLite (avoids 50ms × N stalls when
  the relay is down). Half-open retry after cooldown.
- Hourly statistics are printed to the Experts log and **reset each hour**
  (success/failure counts, SQLite backups, circuit state).
- `MarkForBackfill()` appends to `backfill_queue.csv` only when **both** the
  socket and SQLite writes fail. This file is an audit log — see §9.1.
- The two `possible loss of data ('long'→'int')` compiler warnings come from
  the bundled `SQLite3Import.mqh` library and are expected/benign.

### 4.2 Relay — `mt5_api_relay_for_v2_28.py`

| Constant                             | Default                   | Meaning                                                                         |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------- |
| `LOCAL_PORT`                         | `5555`                    | Listen port (binds `127.0.0.1` only — keep it that way; the socket has no auth) |
| `WORKER_COUNT`                       | `4`                       | Concurrent uploads to Railway                                                   |
| `QUEUE_MAX_SIZE`                     | `10000`                   | In-memory buffer; overflow goes straight to the spill file                      |
| `MAX_RETRIES` / `RETRY_BACKOFF_BASE` | `5` / `2`                 | Per-payload retries: waits 2s, 4s, 8s, 16s                                      |
| `SPILL_FILE`                         | `relay_spill_queue.jsonl` | Survives restarts; replayed every `SPILL_REPLAY_INTERVAL` (60s)                 |
| `RAILWAY_URL` / `API_KEY`            | placeholders              | **Must be configured before deploy**                                            |

**Behavior notes:**

- All 15 symbols' EAs (all 5 terminals) share **one** relay instance.
- Malformed JSON from the EA is logged and dropped (cannot be recovered).
- Permanent 4xx rejections are _not_ spilled — by design, to prevent a
  poison-message loop. The gateway's error body is logged (first 300 chars).
- Throughput envelope: steady-state load is trivial (15 symbols × 9 TFs ≈ one
  bar/symbol/TF per period; worst-case bursts at bar boundaries are tens of
  payloads, far below 4 workers × HTTP capacity).

### 4.3 Backfill worker — `backfill_worker_api_gateway_v4.py`

| Constant                              | Default                                       | Meaning                                         |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `API_KEY`                             | env `BACKFILL_API_KEY` (fallback placeholder) | Prefer the env var; don't commit real keys      |
| `SYMBOLS`                             | 15 symbols                                    | Must cover every symbol any terminal collects   |
| `IDLE_SLEEP_SEC` / `ACTIVE_SLEEP_SEC` | `300` / `30`                                  | Scan cadence (idle vs. backlog present)         |
| `MAX_BARS_PER_SYMBOL`                 | `500`                                         | Per cycle; drain rate ≈ 8 bars/s overall (§9.3) |
| `REJECTED_ROWS_FILE`                  | `C:/Scripts/database/rejected_rows.jsonl`     | Dead-letter for 400-rejected rows               |

**Behavior notes:**

- Reads columns dynamically (`PRAGMA table_info`), so it is backward-compatible
  with v2.26 (60-col) and v2.27+ (61-col) databases.
- Deletes a row **only after** a confirmed 200/201, in batches of 50 per
  transaction. Rows are processed oldest-first.
- One worker instance serves all terminals (it scans by symbol, not terminal).
- Exponential backoff (30s → 300s) on no-progress cycles; HTTP session is
  recreated after 10 consecutive failed cycles.
- **v5 rework pending (§12.6):** in the v5 pipeline this worker's job becomes
  pushing `market_data` rows `WHERE synced_at IS NULL` and stamping
  `synced_at` on 200/201 — never deleting (the v4 delete-after-POST pattern
  applies only to the legacy EA-fallback databases).

### 4.4 Export indicators — `mql5-indicators/mql5-indicator-export-selection/USE/mq5/` (12 files)

**Role:** the data producers of the v5 pipeline (§12). One full set is
attached to the XAUUSD M5 chart and one to the XAUUSD M15 chart; each
indicator auto-exports `{Prefix}_{SYMBOL}_{TF}.txt` (tab-separated, UTC unix
timestamps) into the terminal's `MQL5/Files` folder, where the collector
(§4.6) reads them.

| Indicator file                                                  | Export prefix       |
| --------------------------------------------------------------- | ------------------- |
| `2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent.mq5`         | `Centriod_Best_Fit` |
| `2EDT-Centroid-Regression-Cherry-Pick-A.mq5`                    | `Cherry-Pick-A`     |
| `2EDT-Centroid-Regression-Cherry-Pick-B.mq5`                    | `Cherry-Pick-B`     |
| `2EDT-Centroid-Regression-Most-Recent-Line-Extension.mq5`       | `Most-Recent`       |
| `2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-A.mq5` | `Non-Recent-A`      |
| `2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-B.mq5` | `Non-Recent-B`      |
| `2EDT-Fractal-Best-Fit-v5.mq5`                                  | `Fractal_EDT`       |
| `Single-Best-Resistance-Line-v3.mq5`                            | `Resistance_Line`   |
| `Single-Best-Support-Line-v3.mq5`                               | `Support_Line`      |
| `ZigZag-Export-v43.mq5`                                         | `ZigZag`            |
| `ohlcv-export-lightweight.mq5`                                  | `OHLCV`             |
| `zscore-ohlc-candle-export.mq5`                                 | `ZScore`            |

**Auto-export inputs (identical in all 12):**

| Input             | Default | Meaning                                                                                                                                         |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `InpAutoExport`   | `true`  | 1-second `EventSetTimer` loop; export fires once per minute                                                                                     |
| `InpExportSecond` | `59`    | Wall-clock second (local time) at which the per-minute export triggers — keep identical across all 12 so the files are written in near-lockstep |

**Behavior notes:**

- Column layout of every export: the 4 validation keys (`timestamp`,
  `symbol`, `timeframe`, `close`) followed by indicator-specific columns —
  full map in §12.2; reference samples in
  `mock-data-from-indicators/time_series_data/`.
- The export **buttons and manual export remain** in every indicator: they are
  for human review only (checking export format and correctness against the
  chart display), not part of the automated pipeline. All 12 also answer the
  `CHARTEVENT_CUSTOM + 1000` / `"EXPORT_ALL"` broadcast for scripted bulk
  export.
- ⚠️ The windowed indicators (`2EDT-Fractal-Best-Fit-v5`, both Single-Best
  lines) have fixed `InpStartDateTime`/`InpEndDateTime` anchors that go stale
  in continuous operation — re-anchor per analysis window (§12.6 item 6).
- The 6 centroid variants each run an SSA engine over `InpSSAMathLookback`
  (3000) bars — chart-attached on two charts this is moderate; avoid loading
  them on additional charts unnecessarily.

### 4.5 v5 SQLite schema — `sqlite_schema_v5_xauusd.sql`

**Role:** defines `xauusd.db`, the staging + validation + serving store of the
v5 pipeline. Idempotent (`CREATE … IF NOT EXISTS` throughout) — the collector
applies it on every start, so deploying schema changes = ship the file.

| Object                             | Purpose                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collection_cycles`                | One row per 5-min slot/timeframe/attempt; `collecting → validating → validated \| rejected`                                                                             |
| `raw_*` (12 tables)                | Per-source staging, mirrors each export's columns; leads with the validation keys (`cycle_id`, `timestamp_raw`, `timestamp_adj`, `symbol`, `timeframe`, `close`)        |
| `v_validation_keys` (+ `…_zigzag`) | UNION view of validation keys for the cross-source mismatch query                                                                                                       |
| `validation_failures`              | Per-mismatch forensic log (field + per-source values as JSON)                                                                                                           |
| `market_data`                      | Validated wide table downstream consumes; PK `(timestamp_adj, timeframe)`; `synced_at` outbox column (NULL = not yet pushed to gateway; rows are marked, never deleted) |

Constraints: `symbol = 'XAUUSD'` and `timeframe IN ('M5','M15')` are enforced
by CHECK; empty export fields are stored as `NULL` (never `0`). Full design
rationale in §12.3.

### 4.6 Export collector + validator — `export_collector_validator_v1.py`

**Role:** the v5 pipeline engine — runs **collect → adjust → validate →
promote** for every 5-minute cycle (M15 cycles only on 15-minute boundaries).

| Constant                 | Default                         | Meaning                                                            |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------ |
| `CLOSE_TOLERANCE`        | `0.01`                          | Close-spread tolerance (one XAUUSD point); do not widen past ~0.05 |
| `MAX_ATTEMPTS_PER_CYCLE` | `3`                             | Reject → re-request attempts per cycle slot                        |
| `RETRY_WAIT_SEC`         | `65`                            | Wait for the next per-minute auto-export before re-reading         |
| `CYCLE_INTERVAL_SEC`     | `300`                           | Collection cadence; fires at :05 past each boundary                |
| `DEFAULT_EXPORT_DIR`     | terminal `MQL5/Files`           | Where the 12 export files are read from — **must be configured**   |
| `DEFAULT_DB_PATH`        | `C:/Scripts/database/xauusd.db` | v5 database (schema auto-applied)                                  |

CLI: `--export-dir`, `--db`, `--timeframes M5,M15`, `--once` (single cycle),
`--no-completeness` and `--no-market-hours` (mock/testing only).

**Behavior notes:**

- **Market-hours gate** (embedded Python port of the XAUUSD hours: Mon–Fri
  01:01–23:59 server time, GMT+2/+3 by US DST, converted to UTC). A closed
  market skips the cycle without burning re-request attempts — this is the
  §12.4 stop condition.
- **Validation:** symbol/timeframe equality + close tolerance on every bar
  shared by ≥2 per-bar sources; zigzag pivots validated as a subset against
  the OHLCV spine; strict completeness requires the latest OHLCV bar in all
  11 per-bar sources. Any failure rejects the whole cycle: failures are
  logged to `validation_failures`, staged rows purged, audit row kept,
  re-request scheduled (`attempt + 1`).
- **Promotion:** validated bars merge onto the OHLCV per-bar spine
  (LEFT-JOIN semantics — zigzag and absent indicator values stay `NULL`) via
  `INSERT OR REPLACE` into `market_data`.
- **Mock mode** (regression check, runs against the repo's mock data):
  `python3 export_collector_validator_v1.py --export-dir mock-data-from-indicators/time_series_data --db /tmp/test.db --timeframes M5 --once --no-market-hours --no-completeness`
- Deploy as a third NSSM service (`MT5Collector`), same pattern as §6.3/§6.4.

---

## 5. Failure Modes & Recovery Matrix

| Failure                          | Detected by                                       | Immediate effect                                                               | Data outcome                                                                             |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Railway down / slow              | Relay POST failures                               | Retries ×5 → spill to `relay_spill_queue.jsonl`; replayed every 60s            | **No loss**; delivery delayed                                                            |
| Relay process dead               | EA `SocketConnect` fails → circuit opens after 10 | EA writes SQLite directly                                                      | **No loss**; backfill worker drains once gateway reachable                               |
| Relay queue full (10k)           | `QueueFull` in relay                              | New payloads spill directly to disk                                            | **No loss**                                                                              |
| Both relay AND SQLite write fail | EA                                                | Bar logged to `backfill_queue.csv` only                                        | **Loss** (audit record only — §9.1). Requires VPS-level disk failure; rare               |
| Gateway rejects payload (400)    | Relay (live) / worker (backfill)                  | Relay: logged + dropped. Worker: quarantined to `rejected_rows.jsonl`          | Live-path rejects: log only. Backfill rejects: recoverable from JSONL                    |
| Bad API key (401/403)            | Both Python components                            | Relay drops; worker halts                                                      | Operator action required — alert on this log line                                        |
| MT5 terminal restart             | —                                                 | EA reinitializes; `lastProcessed` resets                                       | Possible re-send of last completed bar → dedup at gateway (§9.2)                         |
| Relay restart                    | —                                                 | In-memory queue lost **only if** payloads were mid-flight; spill file survives | Small window: payloads accepted but not yet POSTed or spilled are lost. Mitigation: §9.4 |
| VPS reboot                       | —                                                 | All components restart via service manager (§6)                                | SQLite + spill files persist; **no loss** if services auto-start                         |

---

## 6. Deployment Guide

### 6.1 Directory layout (Windows VPS)

```
C:/Scripts/
├── database/                 # Shared by EA + backfill worker
│   ├── btcusd.db … bnbusd.db
│   ├── backfill_queue.csv    # audit log (EA-written)
│   └── rejected_rows.jsonl   # dead-letter (worker-written)
├── logs/
│   └── backfill_worker.log   # rotating, 10MB × 5
├── relay/
│   ├── mt5_api_relay_for_v2_28.py
│   └── relay_spill_queue.jsonl
└── backfill/
    └── backfill_worker_api_gateway_v4.py
```

### 6.2 MT5 / EA setup (repeat per terminal)

1. Copy the `.mq5` (and `SQLite3Import.mqh` dependency) into the terminal's
   `MQL5/Experts/` tree; compile in MetaEditor. Expect **0 errors, 2 warnings**
   (the warnings are from the SQLite include — benign).
2. **Tools → Options → Expert Advisors:** enable _Allow WebRequest for listed
   URL_ and add `127.0.0.1` to the URL list. MQL5's socket functions are
   gated by this same allowlist — without it, `SocketConnect` fails silently
   and everything falls back to SQLite.
3. Attach the EA to one chart per terminal. Set `SymbolsList` for that
   terminal's 3 symbols and a unique `TerminalID`.
4. Verify the Experts log shows `✅ Async TCP Socket configured` and, after the
   first bars, no circuit-breaker messages.

### 6.3 Relay setup

1. Python 3.8+; `pip install aiohttp`.
2. Edit `RAILWAY_URL` and `API_KEY` constants (or refactor to env vars —
   recommended follow-up, §11).
3. Install as an auto-restarting service (NSSM shown; Task Scheduler also fine):

```bat
nssm install MT5Relay "C:\Python311\python.exe" "C:\Scripts\relay\mt5_api_relay_for_v2_28.py"
nssm set MT5Relay AppDirectory "C:\Scripts\relay"
nssm set MT5Relay AppStdout "C:\Scripts\logs\relay.log"
nssm set MT5Relay AppStderr "C:\Scripts\logs\relay.err.log"
nssm set MT5Relay AppExit Default Restart
nssm start MT5Relay
```

4. Smoke test before attaching EAs:
   `python -c "import socket;s=socket.create_connection(('127.0.0.1',5555));s.sendall(b'{\"test\":1}\n');s.close()"`
   — relay log should show a permanent-rejection or retry attempt (proves
   listen + parse + upload path).

### 6.4 Backfill worker setup

1. `pip install requests`.
2. `setx BACKFILL_API_KEY "mt5_terminal_xxx_…"` (or set it in the NSSM service
   environment); edit `API_GATEWAY_URL`.
3. Install as a second NSSM service (`MT5Backfill`), same pattern as above.
4. Startup log must show the gateway health check and the configured
   quarantine path.

### 6.5 Boot-order independence

No strict ordering is required: if EAs start before the relay, the circuit
breaker routes bars to SQLite and the backfill worker recovers them. Still,
the recommended order is relay → backfill worker → MT5 terminals.

---

## 7. Gateway-Side Contract (for the backend team)

The pipeline assumes the API Gateway provides:

1. `POST /api/v1/market-data` — accepts the §3.2 payload; returns 200/201 on
   success; 400 with a JSON `message` field on validation failure; 429 with
   `Retry-After` when rate-limiting; 5xx only for genuinely transient faults.
2. **Idempotent ingestion** keyed on `(symbol, timeframe, timestamp)` —
   duplicates MUST NOT create double rows (§9.2).
3. `terminal_id` accepted in the body from both `terminal_xxx` and
   `backfill_worker` senders.
4. `GET /api/v1/health` — 200 with optional `{status, services.queue}` JSON
   (the worker logs queue depth when present).
5. Rate limits sized for: steady trickle from the relay + worker bursts of
   ≤500 bars/symbol at ~20 req/s worst case during backfill drains.

---

## 8. Monitoring & Operations Runbook

**Healthy-state signals:**

- EA hourly stats: `Socket Relay Success Rate` ≈ 100%, circuit `CLOSED`,
  `SQLite Backups: 0`.
- Relay log: silent except startup line (failures are the only thing logged).
- Worker log: `✅ No backfill needed` every 5 minutes.
- `relay_spill_queue.jsonl` and `rejected_rows.jsonl` absent or empty.

**Alert-worthy signals (in escalating severity):**

| Signal                                                       | Meaning                                     | Action                                                                        |
| ------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Worker repeatedly finds bars in SQLite                       | Relay down or EA circuit open               | Check `MT5Relay` service; check EA Experts log                                |
| `relay_spill_queue.jsonl` growing                            | Railway unreachable/erroring for >5 retries | Check Railway status; spill replays automatically after recovery              |
| `rejected_rows.jsonl` growing                                | Gateway rejecting backfill payloads         | Read `gateway_error` fields in the file; fix gateway or data; replay manually |
| `Railway rejected payload permanently` in relay log          | Live-path 400s                              | Same as above — but note live-path rejects are **not** quarantined            |
| `CRITICAL: Authentication failed` (either component)         | Key rotated/revoked                         | Rotate `API_KEY` / `BACKFILL_API_KEY`                                         |
| `❌ CRITICAL: Both Socket Relay AND SQLite failed` in EA log | Disk/permission failure on VPS              | Immediate investigation; bars are being lost                                  |

**Routine checks:** weekly — confirm both NSSM services are `RUNNING`, eyeball
the two JSONL files, confirm SQLite DBs are near-empty.

---

## 9. Known Issues, Gaps & Accepted Trade-offs

These are explicitly accepted in the current design; do not "discover" them as
bugs during implementation.

1. **`backfill_queue.csv` has no consumer.** The EA writes it when both
   delivery paths fail, but nothing replays it — and nothing _can_, fully: the
   CSV holds only `symbol,timeframe,timestamp` while the indicator values
   exist only inside MT5 at collection time. Treat it as an audit log of
   catastrophic-failure events. (A future EA-side retry from this CSV is the
   only complete fix — §11.)
2. **Duplicate delivery is possible; dedup is the gateway's job.** Sources:
   relay retry after an ambiguous failure (request processed, response lost);
   worker re-send when POST succeeded but the SQLite delete failed; EA restart
   edge cases. The SQLite PK `(timestamp, timeframe)` already dedupes the
   fallback store per symbol; the gateway must do the same (§7.2).
3. **Backfill drain rate is ~8 bars/s** (sequential single-bar POSTs plus
   pacing delays). A multi-day outage backlog takes hours to drain. Acceptable
   for current volumes; a bulk-ingest endpoint is the upgrade path (§11).
4. **Relay restart can drop in-flight payloads.** Payloads sit in the
   in-memory queue between socket accept and POST/spill; a hard kill in that
   window loses them. The window is seconds wide under normal load. Mitigation
   if needed: spill-on-receive (write-ahead) before enqueueing.
5. **Live-path 400 rejections are logged but not quarantined** (relay drops
   them; only the backfill path has a dead-letter file). If gateway-side
   validation bugs become a recurring problem, add a relay-side dead-letter
   mirror of `quarantine_row`.
6. **No auth on the local socket.** Anything on the VPS can write to
   `127.0.0.1:5555`. Accepted: single-tenant VPS; the relay must never bind a
   public interface.
7. **Secrets in source.** Relay still has `API_KEY` as a constant (worker now
   reads `BACKFILL_API_KEY` from env). Migrate the relay to env vars before
   the repo audience widens.
8. **One relay is a single point of failure for the live path** — by design,
   since SQLite + backfill fully cover its downtime. Do not add a second relay
   instance on the same port.
9. **`SocketTimeoutMs` floor.** The default was deliberately raised 5ms → 50ms;
   values below ~50ms cause spurious circuit-breaker trips from Windows
   scheduler jitter under load. Don't tune it back down.

---

## 10. Hardening Changes Applied to This Baseline (June 2026)

For reviewers comparing against older copies of these files:

| Component | Change                                                                              | Reason                                                      |
| --------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| EA        | `uchar payload_data[]` (was `char`)                                                 | MQL5 `SocketSend` requires `uchar` — compile error fix      |
| EA        | `SocketTimeoutMs` default 5 → 50ms                                                  | Spurious circuit-breaker trips                              |
| EA        | Full-payload send check (`sent == bytesToSend`)                                     | Partial send previously counted as success → truncated JSON |
| EA        | `FILE_SHARE_READ` on `backfill_queue.csv`                                           | Append silently failed while another process read the file  |
| Relay     | Bounded queue + 4 workers + retries + disk spill + 60s replay (was fire-and-forget) | Railway outages previously lost data                        |
| Relay     | Read-to-EOF (was `read(8192)`)                                                      | Partial TCP reads produced broken JSON                      |
| Relay     | Permanent 4xx (≠429) not retried                                                    | Poison-message loop prevention                              |
| Worker    | `terminal_id` added to JSON body                                                    | Payload-shape parity with v2.28 relay                       |
| Worker    | 400 → quarantine to `rejected_rows.jsonl` (was permanent delete)                    | Gateway-side bugs could destroy last-resort backups         |
| Worker    | `API_KEY` via `BACKFILL_API_KEY` env var                                            | Secret hygiene                                              |

---

## 11. Future Enhancements (deliberately out of scope for v2.28)

Ordered by expected value:

1. **Bulk-ingest endpoint + batched backfill** — collapse the worker's
   per-bar POSTs into arrays of ≤100 bars; ~10–50× faster outage recovery.
2. **Relay env-var config + shared config file** — single source for URL/key
   across relay and worker.
3. **Relay write-ahead spill** — persist payloads on receipt to close the
   restart window (§9.4).
4. **Quarantine replay tool** — small script to re-POST `rejected_rows.jsonl`
   entries after a gateway fix.
5. **EA-side retry of `backfill_queue.csv`** — the only complete fix for §9.1.
6. **Relay ACK byte** — only if "port open but process wedged" is ever
   observed in production; otherwise not worth the protocol complexity.
7. **Metrics endpoint** — expose relay queue depth / spill size for scraping
   instead of log-based monitoring.

---

## 12. v5 Export-Collection & Validation Pipeline (June 2026 — in progress)

This section documents the indicator-set replacement and the new
export-file-based collection pipeline designed around it. It is the current
direction of development; §1–§11 above describe the socket-push stack that
remains deployed in the meantime.

### 12.0 v5 data flow (end-to-end)

```
┌────────────────────────────── Windows VPS (Contabo) ──────────────────────────────┐
│                                                                                    │
│  MT5 terminal — XAUUSD M5 chart + XAUUSD M15 chart                                 │
│  ┌──────────────────────────────┐  auto-export every minute at second :59         │
│  │ 12 export indicators (§4.4)  │ ────────────────► MQL5/Files/                    │
│  │  6× Centroid Regression      │                    {Prefix}_XAUUSD_{TF}.txt      │
│  │  Fractal Best Fit v5         │                    (12 files × 2 timeframes)     │
│  │  Single Best Resist/Support  │                          │                       │
│  │  ZigZag v43 / OHLCV / ZScore │                          ▼                       │
│  └──────────────────────────────┘   ┌────────────────────────────────────────┐    │
│                                     │ export_collector_validator_v1.py (§4.6)│    │
│   every 5 min at :05, market-hours  │  COLLECT  → raw_* staging              │    │
│   gated; M15 on 15-min boundaries   │  ADJUST   → timestamp_adj rounding     │    │
│                                     │  VALIDATE → keys match across sources  │    │
│                                     │             (close ±0.01, zigzag subset)│   │
│                                     │  PROMOTE  → market_data   ── reject? ──┼──► │
│                                     └──────────────────┬─────────────────────┘ re-│
│                                                        │            request (≤3)  │
│                                                        ▼                          │
│                                     xauusd.db (schema §4.5)                       │
│                                     market_data (validated, synced_at outbox)     │
│                                                        │                          │
│                                                        ▼                          │
│                                     ┌─────────────────────────────────────────┐   │
│                                     │ backfill worker v5 (§4.3 — rework       │   │   HTTPS POST
│                                     │ pending): push WHERE synced_at IS NULL, │ ──┼─────────────► Railway
│                                     │ stamp synced_at on 200/201              │   │               API Gateway
│                                     └─────────────────────────────────────────┘   │
│                                                                                    │
│  (Legacy socket-push path — EA → relay → gateway, §2 — not part of v5 data flow)   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 12.1 Scope decisions

| Decision            | Value                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symbol              | **XAUUSD only**                                                                                                                                                                                                                       |
| Timeframes          | **M5 and M15 only**                                                                                                                                                                                                                   |
| Collection cadence  | Every 5 minutes                                                                                                                                                                                                                       |
| Validation rule     | First 4 columns of every export (`timestamp`, `symbol`, `timeframe`, `close`) must agree across all sources per cycle; any mismatch rejects the **whole** cycle and triggers a re-request                                             |
| Close comparison    | Numeric, with tolerance band `CLOSE_TOLERANCE = 0.01` (one XAUUSD point). Do not widen beyond ~0.05 or mid-bar/wrong-bar errors get masked. Empirical: 33/33 overlapping bars in the mock data matched exactly                        |
| Timestamp handling  | `timestamp_raw` stored as exported (sources differ by seconds); `timestamp_adj` = rounded to nearest 5-min (M5) / 15-min (M15) boundary, filled by the rounding step **before validation** (`round(ts/300)*300`, `round(ts/900)*900`) |
| Empty export fields | Stored as `NULL`, never `0` ("no line exists" ≠ price 0). Gateway fields must be nullable; consumers must not `COALESCE` price levels to 0                                                                                            |

### 12.2 New indicator set (12 export sources)

Source of truth: `mql5-indicators/mql5-indicator-export-selection/USE/mq5/`.
Export format reference (headers + sample rows):
`mock-data-from-indicators/time_series_data/*_XAUUSD_M5.txt`.

| #   | Indicator                                         | Export file prefix  | Payload columns beyond the 4 keys                                                                                                             |
| --- | ------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent | `Centriod_Best_Fit` | Base_FL, UOEDT, LOEDT, horiz high/low map, ssa, ema_ssa, crossing                                                                             |
| 2–6 | Cherry-Pick-A/B, Most-Recent, Non-Recent-A/B      | per file            | same 8-column layout, **per-variant values** (SSA outputs differ slightly between variants — expected MT5 calculation behavior, not an error) |
| 7   | 2EDT-Fractal-Best-Fit-v5                          | `Fractal_EDT`       | Best_FL, UOEDT, LOEDT                                                                                                                         |
| 8   | Single-Best-Resistance-Line-v3                    | `Resistance_Line`   | Best_Resistance                                                                                                                               |
| 9   | Single-Best-Support-Line-v3                       | `Support_Line`      | Best_Support                                                                                                                                  |
| 10  | ZigZag-Export-v43                                 | `ZigZag`            | Type, point, price/% change + classes, bars, slope, category — **pivot events, not per-bar rows**                                             |
| 11  | ohlcv-export-lightweight                          | `OHLCV`             | open, high, low, volume (per-bar spine of the pipeline)                                                                                       |
| 12  | zscore-ohlc-candle-export                         | `ZScore`            | open/high/low, body_direction, body_size, body_classification                                                                                 |

**ZigZag special rule:** zigzag cannot satisfy "a row per bar." Validate it as
a subset check — every pivot's `(timestamp_adj, symbol, timeframe, close)`
must match the OHLCV bar at that `timestamp_adj`; absence of pivots on other
bars is normal. At promote time zigzag columns LEFT-JOIN onto the per-bar
spine and are `NULL` on non-pivot bars — no separate alignment stack needed.

### 12.3 v5 SQLite schema — `sqlite_schema_v5_xauusd.sql`

Database `xauusd.db`. Pipeline: **collect → adjust → validate → promote.**

- `collection_cycles` — one row per 5-min slot/timeframe/attempt; status
  `collecting → validating → validated | rejected`; rejected cycles keep their
  audit row but cascade-delete their staged rows; re-request = new row with
  `attempt + 1`.
- 12 `raw_*` staging tables — mirror each export's exact columns; every table
  leads with the shared validation keys (`cycle_id`, `timestamp_raw`,
  `timestamp_adj`, `symbol`, `timeframe`, `close`). CHECK constraints enforce
  XAUUSD and M5/M15.
- `v_validation_keys` view — UNIONs the keys of the 11 per-bar sources for the
  cross-source GROUP BY mismatch query (zigzag exposed separately via
  `v_validation_keys_zigzag`).
- `validation_failures` — per-mismatch forensic log (field + per-source values).
- `market_data` — the single validated wide table (77 columns) downstream
  consumes, keyed `(timestamp_adj, timeframe)`, with `cycle_id` provenance.

Verified: the full script executes cleanly against SQLite.

### 12.4 Market-hours integration (XAUUSD)

Reference: `backend-stack-b/contabo-to-postgresql/3_market-hours/MARKET_HOURS_UPDATED_PROMPT.md`
(XAUUSD: Mon–Fri 01:01–23:59 **server time**, GMT+2 winter / GMT+3 summer, US
DST rules — EightCap). Known concerns to handle in the collector:

1. The utilities are TypeScript; the collector needs a small Python port of
   `isDSTActive`/`isMarketOpen` for XAUUSD (~30 lines). Two copies must be
   kept in sync.
2. **Timezone basis:** market hours are server time; export timestamps are
   already UTC (indicators subtract `gmt_offset`). Convert when gating —
   Monday 01:01 server = Sunday 23:01 UTC (winter) / 22:01 UTC (summer).
3. **Market-closed stop condition:** the reject→re-request loop must
   distinguish "validation mismatch" (re-request) from "no new bar because the
   market is closed" (sleep until next open) — otherwise it loops forever
   nightly/weekends, and on holidays (no holiday calendar exists yet).
4. Friday's last M15 bar opens 23:45 and the weekend gap means the next bar is
   ~49h later — "is this bar new?" logic must tolerate that.
5. Doc drift (non-blocking, platform-wide): its 15-symbol list disagrees with
   the worker's `SYMBOLS` (`NDX100` vs `nas100`; missing `wtiusd`/`spx500`/
   `bnbusd`); `calculateNextMarketOpen()` is a stub.

### 12.5 Component status after the June 2026 changes

| Component                                                         | Status | Notes                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EA (`SimpleDataCollector…mq5`, v2.29)                             | ✅     | New indicator handles, 45-col socket payload + fallback schema. Defaults still 3 symbols × 9 TFs — narrow to XAUUSD M5/M15 when the architecture decision (§12.7) lands                                                                                                                                                                                |
| Relay (`mt5_api_relay_for_v2_28.py`)                              | ✅     | Schema-agnostic (forwards JSON as-is; only reads `terminal_id`). No functional change needed                                                                                                                                                                                                                                                           |
| v5 schema (`sqlite_schema_v5_xauusd.sql`)                         | ✅     | Staging/validation/promote design + `synced_at` outbox column on `market_data`; executes cleanly                                                                                                                                                                                                                                                       |
| Indicator auto-export (all 12 `.mq5`)                             | ✅     | Centroid variants had `InpAutoExport`/`InpExportSecond` timers; the same pattern was added to Fractal-Best-Fit-v5, both Single-Best lines, ZigZag-Export-v43, ohlcv-export-lightweight and zscore-ohlc-candle-export. Default `InpAutoExport=true` in all 12; buttons/manual export retained for human review of format & correctness vs chart display |
| Export collector / validator (`export_collector_validator_v1.py`) | ✅     | Collect→adjust→validate→promote implemented incl. market-hours gate (Python port), ±0.01 close tolerance, zigzag subset rule, empty→NULL, bounded reject→re-request. Verified on mock data: strict mode correctly rejects stale exports; promote path fills `market_data` with NULL-correct LEFT-JOIN semantics                                        |
| Backfill worker (`…api_gateway_v4.py`)                            | ⚠️     | **Needs v5 rework** — push `market_data` rows where `synced_at IS NULL` to the gateway and stamp `synced_at` on 200/201 (no more delete-after-POST)                                                                                                                                                                                                    |
| Gateway schema                                                    | ❌     | Must be migrated to the new column set (nullable indicator fields) before v5 data flows                                                                                                                                                                                                                                                                |

### 12.6 Remaining work (build list)

~~1. Export collector + validator~~ — **done**: `export_collector_validator_v1.py`
(collect → adjust → validate → promote, with market-hours gating, close
tolerance, zigzag subset rule, bounded re-requests; tested on mock data).
~~2. Export trigger mechanism~~ — **done**: all 12 indicators now auto-export
via the `InpAutoExport`/`InpExportSecond` 1-second timer pattern (default
on, trigger at second :59 each minute; collector reads at :05 past each
5-minute boundary). Buttons and the `EXPORT_ALL` custom event are retained
for human review of export format/correctness against the chart.
~~3. Market-hours Python port~~ — **done**: embedded in the collector
(`is_market_open_xauusd`, US-DST server-offset conversion to UTC).

Still open:

4. **Backfill worker v5** (rework of `backfill_worker_api_gateway_v4.py`) —
   push `market_data` rows `WHERE synced_at IS NULL` to the gateway and stamp
   `synced_at` on 200/201 (the schema and partial index already exist). The
   v4 delete-after-POST pattern must not be used on `market_data`.
5. **Gateway migration** — new nullable column set + idempotent upsert keyed
   `(symbol, timeframe, timestamp)` (unchanged requirement).
6. **Production soak checks** — windowed indicators (Fractal-Best-Fit, both
   Single-Best lines) have fixed `InpStart/EndDateTime` anchors that go stale;
   operations must re-anchor them per analysis window, or the indicators need
   a follow-up change to make the window roll automatically.

### 12.7 Architecture decision — RESOLVED: export files are the source of truth

The cross-source validation only makes sense on the export-file path: the
EA's socket path reads all indicator buffers from one chart at one moment, so
its `timestamp/symbol/timeframe/close` are identical by construction — there
is nothing to cross-validate. **Decision (June 2026): option (a)** — the
validated export pipeline (collect → validate → promote → push) is the source
of truth for XAUUSD M5/M15. The EA's remaining role on the XAUUSD terminal is
keeping the charts/indicators alive; its socket/SQLite machinery and the relay
stay documented (§1–§11) for any future return to the push path, but are not
part of the v5 data flow.

---

## Appendix A — Component Version Matrix

| Component                                 | Version                                             | Compatible peers                                                                                             |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| EA v2.29 (current source)                 | 45-col schema (new indicator set), socket transport | Relay v2.28 (agnostic); worker v4 (dynamic columns) — **gateway must migrate to the 45-col field set first** |
| EA v2.28                                  | 61-col schema, socket transport                     | Relay v2.28; worker v4                                                                                       |
| EA v2.27                                  | 61-col schema, WebRequest transport                 | Worker v4 (no relay)                                                                                         |
| EA v2.26 and older                        | 60-col schema                                       | Worker v4 (dynamic columns) — archived, do not deploy                                                        |
| Worker v4 (this baseline)                 | Reads any column set dynamically                    | Any EA above; **does not implement the v5 pipeline (§12)**                                                   |
| v5 schema (`sqlite_schema_v5_xauusd.sql`) | Staging + validation + `market_data`                | Export collector/validator + worker v5 (both to be built — §12.6)                                            |

The `.ex5` binaries and older `.mq5`/worker versions in this directory are
retained for history only; **the files named at the top of this document
are the deployment set.**
