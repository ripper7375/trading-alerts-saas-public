# Data Collection Pipeline — Architecture Blueprint (v2.28 Stack)

**Status:** Baseline reference for development team
**Last Updated:** 2026-06-10
**Scope:** MT5 → Local Relay → API Gateway data collection pipeline on the Contabo VPS

This document is the single source of truth for the three components of the
market-data collection pipeline:

| #   | File                                         | Role                          | Runtime                             |
| --- | -------------------------------------------- | ----------------------------- | ----------------------------------- |
| 1   | `SimpleDataCollector_v2_28_ASYNC_SOCKET.mq5` | Data producer (EA)            | MetaTrader 5 terminal (Windows VPS) |
| 2   | `mt5_api_relay_for_v2_28.py`                 | Local async upload relay      | Python 3.8+, same VPS as MT5        |
| 3   | `backfill_worker_api_gateway_v4.py`          | SQLite-backup recovery worker | Python 3.8+, same VPS               |

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

Field set = the 61 SQLite columns (§3.3) **plus** `terminal_id`:

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

### 3.3 SQLite schema (one DB per symbol, one table per symbol)

Path: `C:/Scripts/database/{sanitized_symbol}.db`, table `[{sanitized_symbol}]`,
WAL mode, `PRIMARY KEY (timestamp, timeframe)`.

61 columns, in order: `timestamp` (epoch sec), `symbol`, `open`, `high`, `low`,
`close`, `volume`, `timeframe` (e.g. `"PERIOD_H1"`), `tema`, `hrma`, `smma`,
`Z-Score of body size`, `Candle classification`, 8 diagonal-fractal columns,
8 horizontal-fractal columns, 7 Heiken-Ashi columns, 10 Keltner-channel
columns, 8 support/resistance columns, `zigzag_peak`, `zigzag_bottom`, `ema`,
`dual_tema_high`, `dual_tema_low`, `pinbar`, `collected_at` (epoch sec).

Numeric indicator fields use `0` to encode "no value" (`EMPTY_VALUE` is
translated by the EA before serialization).

Timeframes collected: M5, M15, M30, H1, H2, H4, H8, H12, D1 (9 per symbol).

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

### 4.1 EA — `SimpleDataCollector_v2_28_ASYNC_SOCKET.mq5`

**Key inputs** (per-terminal; 5 terminals × 3 symbols = 15 symbols total):

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

## Appendix A — Component Version Matrix

| Component                 | Version                             | Compatible peers                                      |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| EA v2.28 (this baseline)  | 61-col schema, socket transport     | Relay v2.28; worker v4                                |
| EA v2.27                  | 61-col schema, WebRequest transport | Worker v4 (no relay)                                  |
| EA v2.26 and older        | 60-col schema                       | Worker v4 (dynamic columns) — archived, do not deploy |
| Worker v4 (this baseline) | Reads v2.26+ schemas                | Any EA above                                          |

The `.ex5` binaries and older `.mq5`/worker versions in this directory are
retained for history only; **the three files named at the top of this document
are the deployment set.**
