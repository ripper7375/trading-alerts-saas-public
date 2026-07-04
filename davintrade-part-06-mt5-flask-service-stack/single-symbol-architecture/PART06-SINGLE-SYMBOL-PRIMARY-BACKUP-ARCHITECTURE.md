# Part 06 Architecture Design Document — Single-Symbol Primary/Backup (XAUUSD)

**Last Updated:** 2026-07-03
**Status:** 🟡 PROPOSED (design approved, implementation not started)
**Scope:** Single symbol (XAUUSD, used as the reference case — the design generalizes to any small, fixed symbol set)
**Modifies:** `mt5-service/` (existing monolithic Flask process) — additive change, not a rewrite
**Does not touch:** The EA-based historical/indicator pipeline, Part 07, or the frontend
**Source diagrams:** `docs/files-completion-list/Part06-Single-Symbol-Primary-Backup.pptx`
**Related specs:** `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` (v6.0.0), `docs/architecture/PART06-DEDICATED-WORKER-VPS-ARCHITECTURE.md`

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Background: Why a Single-Symbol Variant](#2-background-why-a-single-symbol-variant)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Component Specification](#5-component-specification)
6. [Data Contracts](#6-data-contracts)
7. [Failover State Machine](#7-failover-state-machine)
8. [Deployment Plan](#8-deployment-plan)
9. [Repository Structure](#9-repository-structure)
10. [Migration Plan](#10-migration-plan)
11. [Observability & Monitoring](#11-observability--monitoring)
12. [Security Considerations](#12-security-considerations)
13. [Testing & Validation Checklist](#13-testing--validation-checklist)
14. [When You'd Need More](#14-when-youd-need-more)
15. [Appendix A: Reference Documents](#15-appendix-a-reference-documents)
16. [Appendix B: Environment Variables Reference](#16-appendix-b-environment-variables-reference)

---

## 1. Purpose & Scope

This document specifies a **right-sized** architecture for Part 06 when the product scope is a single symbol (or a small, fixed number) — using XAUUSD as the reference case. It is written to be handed to an implementation agent (Claude Code) as a build reference.

Unlike `docs/architecture/PART06-DEDICATED-WORKER-VPS-ARCHITECTURE.md`, this document does **not** decompose Part 06 into separate ingestion/serving tiers. It keeps the existing monolithic Flask process, and adds exactly one capability: **automatic failover between a primary and a backup MT5 terminal for the same symbol**, inside the same process.

**In scope:**

- Extending the existing `MT5ConnectionPool` / `MT5Connection` design in `mt5-service/` to support a primary + backup credential pair per symbol
- A failover state machine: health checks, failure threshold, automatic switch to backup, optional recovery back to primary
- No change to the REST/WebSocket contract Part 07 and the browser already depend on

**Out of scope:**

- Multi-symbol decomposition (Redis, a separate worker VPS, a NestJS Gateway) — see [Section 14](#14-when-youd-need-more) for when that becomes necessary
- The EA-based historical/indicator pipeline
- Any change to tier logic, symbol/timeframe validation, or the frontend

---

## 2. Background: Why a Single-Symbol Variant

The multi-symbol monolithic design (`mt5-service/` today, 15 terminals in one Python interpreter) carries a specific risk: the `MetaTrader5` Python package is built for one terminal per process, so 15 sessions sharing one interpreter can interfere with each other, and one crash takes all 15 symbols down together. That risk is what motivated the dedicated-worker-VPS redesign in the companion document.

**That risk does not exist at one symbol.** With a single MT5 session, there is nothing for it to collide with, and no multi-symbol blast radius to contain. The monolithic Flask process is therefore not a compromise for a single-symbol product — it is the right-sized architecture, provided the one thing that _is_ still worth protecting against is addressed: **that one session dropping.** That's a redundancy problem, not a decomposition problem, and it's solved by adding a backup terminal the same process can fail over to — not by adopting Redis, a second VPS, or a separate Gateway service.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- **G1 — Continuity of service.** If the primary MT5 terminal's session drops (broker disconnect, terminal crash, network blip), the service automatically switches to a backup terminal for the same symbol without manual intervention.
- **G2 — Zero contract change.** Part 07 and the browser see the exact same REST endpoints and Socket.IO events as today.
- **G3 — Minimal operational footprint.** One VPS, one process — no new infrastructure (no Redis, no second VPS, no additional service to deploy or monitor).
- **G4 — Observability of failover state.** Admins can see which session (primary/backup) is currently active and how many times a failover has occurred, via the existing admin endpoints.

### 3.2 Non-Goals

- This document does not attempt to protect against the entire VPS or process dying (hardware failure, VPS provider outage) — that would require a second, fully duplicated deployment (active/standby monolith on two VPS), which is a heavier pattern than what's specified here. If that level of protection is needed, it's a follow-on decision, not part of this design.
- This document does not change tier rules, symbol/timeframe validation, or add support for additional symbols. If a second symbol is added, revisit [Section 14](#14-when-youd-need-more).

---

## 4. Proposed Architecture

### 4.1 Diagram

```
┌───────────────────────────────┐
│  MT5 Terminal — Primary        │  (broker login A, active by default)
└───────────────┬─────────────────┘
                │ solid = active connection
                ▼
┌────────────────────────────────────────────┐
│  Single Flask Process                        │
│  ├─ Connection manager                        │
│  │   • holds primary + backup sessions         │
│  │   • health check on a timer                 │
│  │   • auto-switch after N consecutive failures │
│  ├─ REST API (unchanged)                        │
│  └─ Socket.IO server (unchanged)                │
└───────────────┬──────────────────────────────┘
                ▲
                │ dashed = standby connection
┌───────────────┴─────────────────┐
│  MT5 Terminal — Backup            │  (broker login B, standby, same symbol)
└──────────────────────────────────┘
                │
                ▼
      Part 07 (tier check)  +  Browser (chart, unchanged)
```

### 4.2 What Changes vs. What Doesn't

|                    | Today                                                         | Proposed                                             |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| MT5 sessions       | 1 session (or 15, if multi-symbol code path is still present) | 2 sessions for the same symbol: primary + backup     |
| Failover           | None — a dropped session requires manual restart              | Automatic switch to backup after N failed reconnects |
| Process/VPS count  | 1 process, 1 VPS                                              | **Unchanged** — still 1 process, 1 VPS               |
| REST/WS contract   | As per OpenAPI v6.0.0                                         | **Unchanged**                                        |
| New infrastructure | —                                                             | **None** (no Redis, no second VPS, no NestJS)        |

---

## 5. Component Specification

There is only one component in this design — the existing Flask process — extended with a failover-aware connection manager.

### 5.1 Failover Connection Manager

**New file:** `mt5-service/app/services/mt5_failover_manager.py`

Wraps two `MT5Connection` instances (reusing the existing class from `app/services/mt5_connection_pool.py` unchanged):

```python
class MT5FailoverManager:
    """Manages a primary + backup MT5Connection pair for a single symbol."""

    def __init__(self, config: dict):
        self.symbol = config["symbol"]
        self.primary = MT5Connection(config["primary"])
        self.backup = MT5Connection(config["backup"])
        self.active = "primary"          # "primary" | "backup"
        self.consecutive_failures = 0
        self.failover_count = 0
        self.failover_threshold = int(os.getenv("FAILOVER_THRESHOLD", 3))

    def get_active_connection(self) -> MT5Connection:
        return self.primary if self.active == "primary" else self.backup

    def health_check(self) -> None:
        active_conn = self.get_active_connection()
        if active_conn.check_connection():
            self.consecutive_failures = 0
            return
        self.consecutive_failures += 1
        logger.warning(
            f"{self.symbol}: active session ({self.active}) failed health "
            f"check {self.consecutive_failures}/{self.failover_threshold}"
        )
        if self.consecutive_failures >= self.failover_threshold:
            self._failover()

    def _failover(self) -> None:
        target = "backup" if self.active == "primary" else "primary"
        target_conn = self.backup if target == "backup" else self.primary
        if not target_conn.connected:
            target_conn.connect()
        if target_conn.connected:
            logger.error(
                f"{self.symbol}: switching from {self.active} to {target} "
                f"after {self.consecutive_failures} consecutive failures"
            )
            self.active = target
            self.consecutive_failures = 0
            self.failover_count += 1
        else:
            logger.error(
                f"{self.symbol}: failover to {target} failed — {target} "
                f"session could not connect either"
            )

    def recover_to_primary(self) -> bool:
        """Manually (or automatically) switch back to primary once healthy."""
        if self.active == "primary":
            return True
        if self.primary.check_connection() or self.primary.connect():
            self.active = "primary"
            logger.info(f"{self.symbol}: recovered to primary session")
            return True
        return False

    def get_status(self) -> dict:
        return {
            "symbol": self.symbol,
            "active_session": self.active,
            "failover_count": self.failover_count,
            "primary": self.primary.get_admin_status(),
            "backup": self.backup.get_admin_status(),
        }
```

This class deliberately reuses `MT5Connection.connect()`, `.check_connection()`, `.reconnect()`, `.get_status()`, and `.get_admin_status()` as-is — no changes to that class are required.

### 5.2 Integration Points

- **`app/services/indicator_reader.py`** (and the WebSocket background loop in `app/websocket.py`): replace any direct reference to a single `MT5Connection` with `failover_manager.get_active_connection()`, so every `copy_rates_from_pos()` call automatically uses whichever session is currently active.
- **`app/services/health_monitor.py`**: extend the periodic health-check loop to call `failover_manager.health_check()` on its existing timer (`HEALTH_CHECK_INTERVAL`), rather than checking a single connection.
- **`app/__init__.py`**: initialize one `MT5FailoverManager` per configured symbol at startup (for the single-symbol case, exactly one), instead of the current `MT5ConnectionPool` with 15 entries.

---

## 6. Data Contracts

### 6.1 REST & WebSocket (unchanged)

Every endpoint and event defined in `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` v6.0.0 is preserved exactly:

- `GET /api/health`, `GET /api/symbols`, `GET /api/timeframes`
- `GET /api/indicators/{symbol}/{timeframe}` → `OHLCVDataResponse`
- WebSocket `subscribe` / `initial_data` / `ohlcv_update`
- Admin endpoints under `/api/admin/terminals/*`

**One semantic note, not a schema change:** the existing `OHLCVMetadata.terminal_id` field should be populated with whichever terminal ID is currently active (`MT5_PRIMARY` or `MT5_BACKUP`), so a support engineer looking at a response can immediately tell which session served it.

### 6.2 Configuration Shape

**File:** `mt5-service/config/mt5_terminals.json` (replaces the 15-entry `terminals` array with a single primary/backup pair per symbol)

```json
{
  "symbol": "XAUUSD",
  "primary": {
    "id": "MT5_PRIMARY",
    "server": "${MT5_SERVER}",
    "login": "${MT5_LOGIN_PRIMARY}",
    "password": "${MT5_PASSWORD_PRIMARY}"
  },
  "backup": {
    "id": "MT5_BACKUP",
    "server": "${MT5_BACKUP_SERVER}",
    "login": "${MT5_LOGIN_BACKUP}",
    "password": "${MT5_PASSWORD_BACKUP}"
  }
}
```

This keeps the same `${VAR_NAME}` environment-variable resolution pattern already implemented in `MT5Connection._resolve_env_var()` — no changes needed there.

### 6.3 Admin Endpoint Behavior

- `GET /api/admin/terminals/health` → returns both `primary` and `backup` entries (via `MT5FailoverManager.get_status()`) instead of 15 terminal entries, using the existing `AdminHealthResponse` / `AdminTerminalStatus` schemas
- `POST /api/admin/terminals/{terminal_id}/restart` → `terminal_id` is now `MT5_PRIMARY` or `MT5_BACKUP`; restarts that specific session without forcing a failover
- `POST /api/admin/terminals/restart-all` → restarts both sessions; if the currently-active one fails to reconnect, the failover manager should trigger `_failover()` immediately afterward rather than waiting for the next health-check cycle

---

## 7. Failover State Machine

### 7.1 Sequence

1. **Normal operation** — Flask connects to the Primary MT5 terminal (XAUUSD) and serves REST + Socket.IO as usual.
2. **Health check runs** — the connection manager pings the primary session on a timer (`HEALTH_CHECK_INTERVAL`), reusing the existing reconnect logic already in `MT5Connection`.
3. **Primary fails N times** — after `FAILOVER_THRESHOLD` consecutive failed reconnects (default: 3), the primary session is marked down.
4. **Auto-switch to backup** — the manager connects to the Backup terminal (same symbol, separate broker login) and resumes `copy_rates_from_pos()` from there.
5. **Clients keep working** — REST and Socket.IO contracts don't change; there's a brief data gap bounded by the health-check interval, then live updates resume.
6. **Recovery (optional)** — once Primary is healthy again, an admin can call a recovery endpoint (or an automatic policy can detect and revert) to switch back.

### 7.2 State Diagram

```
        ┌─────────────┐   N consecutive failures    ┌─────────────┐
        │   PRIMARY    │ ───────────────────────────▶│   BACKUP    │
        │   (active)   │                              │  (active)   │
        └─────────────┘◀─────────────────────────────└─────────────┘
                          recover_to_primary()
                          (manual or auto-detect)
```

### 7.3 Configuration Parameters

| Parameter                 | Default | Description                                                                                  |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `FAILOVER_THRESHOLD`      | 3       | Consecutive failed health checks before switching                                            |
| `HEALTH_CHECK_INTERVAL`   | 60s     | Matches existing `mt5-service` default                                                       |
| `AUTO_RECOVER_TO_PRIMARY` | false   | If true, automatically switch back once primary passes a health check while backup is active |

---

## 8. Deployment Plan

1. No new VPS required — deploy on the existing Part 06 VPS
2. Add backup broker credentials to the environment (see [Appendix B](#16-appendix-b-environment-variables-reference))
3. Update `config/mt5_terminals.json` to the primary/backup shape ([Section 6.2](#62-configuration-shape))
4. Deploy the updated `mt5-service/` build containing `MT5FailoverManager`
5. Verify via `GET /api/admin/terminals/health` that both `primary` and `backup` show as connected, and `active_session` is `primary`

No changes are required on Railway, Part 07, or the frontend.

---

## 9. Repository Structure

```
mt5-service/
├── app/
│   ├── services/
│   │   ├── mt5_connection_pool.py     # UNCHANGED — MT5Connection class reused as-is
│   │   ├── mt5_failover_manager.py    # NEW — primary/backup wrapper (Section 5.1)
│   │   ├── health_monitor.py          # MODIFIED — calls failover_manager.health_check()
│   │   └── indicator_reader.py        # MODIFIED — uses get_active_connection()
│   ├── websocket.py                   # MODIFIED — uses get_active_connection()
│   └── routes/
│       └── admin.py                   # MODIFIED — status/restart routes use failover manager
├── config/
│   └── mt5_terminals.json             # MODIFIED — primary/backup shape (Section 6.2)
└── tests/
    └── test_failover_manager.py        # NEW
```

---

## 10. Migration Plan

This is an **additive change**, not a decomposition — no phased cutover across services is required. Recommended rollout:

1. **Behind a flag.** Ship `MT5FailoverManager` gated by `MT5_FAILOVER_ENABLED=true|false` (default `false`), so it can be deployed without immediately changing behavior.
2. **Configure backup credentials** in a staging environment and flip the flag on there first.
3. **Simulate a primary failure** in staging (see [Section 13](#13-testing--validation-checklist)) and confirm failover + recovery both work as expected.
4. **Enable in production** once staging validation passes.
5. **Remove the flag** once the team is confident, folding failover into the default code path.

---

## 11. Observability & Monitoring

- Log every health-check failure, every failover, and every recovery with the existing `colorlog`-based structured format
- Expose `active_session` and `failover_count` via `GET /api/admin/terminals/health` (already specified in [Section 6.3](#63-admin-endpoint-behavior))
- Recommended alert: notify (email/Slack/whatever the team already uses for ops alerts) whenever a failover occurs — a failover succeeding silently still means the primary broker connection has a problem worth investigating

---

## 12. Security Considerations

- Backup broker credentials are stored as environment variables only, following the same `${VAR_NAME}` pattern already used for primary credentials — never committed to the repository
- No new network exposure — the backup terminal connection is outbound-only from the same VPS, identical in risk profile to the existing primary connection
- Admin endpoints continue to require `X-Admin-API-Key`, unchanged

---

## 13. Testing & Validation Checklist

- [ ] `MT5FailoverManager.health_check()` correctly increments `consecutive_failures` on a failed check and resets it on a successful one
- [ ] Failover triggers exactly at `FAILOVER_THRESHOLD` consecutive failures, not before or after
- [ ] `get_active_connection()` returns the backup connection immediately after a failover, and all subsequent OHLCV reads use it
- [ ] REST responses during and after a failover still match the existing `OHLCVDataResponse` schema, with `terminal_id` correctly reflecting the active session
- [ ] WebSocket clients see no dropped connection during a failover — only a bounded data gap
- [ ] `recover_to_primary()` correctly switches back and resets state when called (manually or via `AUTO_RECOVER_TO_PRIMARY`)
- [ ] `GET /api/admin/terminals/health` reports both sessions' status and the correct `active_session` value at every stage of the sequence in [Section 7.1](#71-sequence)
- [ ] Restarting the backup terminal via `POST /api/admin/terminals/{terminal_id}/restart` does not affect the active (primary) session
- [ ] No behavior change when `MT5_FAILOVER_ENABLED=false` (safe rollout flag works as expected)

---

## 14. When You'd Need More

| This design fits when...                                   | Move to the decomposed pipeline when...                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| One symbol (or a small, fixed number)                      | You add symbol #2, #3... and blast-radius risk returns                      |
| You're protecting against one terminal/session dropping    | The serving layer needs to scale independently of MT5 ingestion             |
| Traffic is modest enough for one process to serve directly | Terminal count grows enough that per-symbol failover alone isn't sufficient |
| Ops overhead should stay minimal — one VPS, one process    | — see `docs/architecture/PART06-DEDICATED-WORKER-VPS-ARCHITECTURE.md`       |

Redundancy and decomposition solve different problems: primary/backup (this document) protects one symbol's connection; the dedicated-worker-VPS pipeline (companion document) isolates many symbols from each other. Choose based on symbol count, not on how important the one symbol is.

---

## 15. Appendix A: Reference Documents

- `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` — authoritative REST/WS contract (v6.0.0), unchanged by this design
- `docs/files-completion-list/Part06-Single-Symbol-Primary-Backup.pptx` — source diagrams for this document
- `docs/architecture/PART06-DEDICATED-WORKER-VPS-ARCHITECTURE.md` — the decomposed multi-symbol alternative, for when this design's scope is exceeded
- `mt5-service/app/services/mt5_connection_pool.py` — existing `MT5Connection` class, reused unchanged by this design
- `docs/files-completion-list/files-inventory/part-06-files-completion.md` — current `mt5-service/` file inventory

---

## 16. Appendix B: Environment Variables Reference

| Variable                                     | Purpose                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `MT5_SERVER`                                 | Primary broker server address (existing variable, reused)                    |
| `MT5_LOGIN_PRIMARY` / `MT5_PASSWORD_PRIMARY` | Primary session credentials                                                  |
| `MT5_BACKUP_SERVER`                          | Backup broker server address (may differ from primary)                       |
| `MT5_LOGIN_BACKUP` / `MT5_PASSWORD_BACKUP`   | Backup session credentials                                                   |
| `FAILOVER_THRESHOLD`                         | Consecutive failed health checks before switching (default: `3`)             |
| `HEALTH_CHECK_INTERVAL`                      | Seconds between health checks (existing variable, default: `60`)             |
| `AUTO_RECOVER_TO_PRIMARY`                    | `true`/`false` — auto-switch back to primary once healthy (default: `false`) |
| `MT5_FAILOVER_ENABLED`                       | `true`/`false` — rollout flag for this feature (default: `false`)            |
