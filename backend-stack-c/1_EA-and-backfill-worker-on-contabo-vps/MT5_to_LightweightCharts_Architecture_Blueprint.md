# MT5 → TradingView Lightweight Charts — Architecture Design Document

**Status:** Development blueprint, pre-implementation. Written for engineering review (including automated review by Claude Code) before any of the two new components it specifies — the mtf-panels Read API and the revised Railway Gateway — are built.

**Companion deck:** `MT5_to_LightweightCharts_Workflow.pptx` (7 slides — Title, End-to-End Workflow, Contabo VPS Internal Stack, Two Independent Outbound Paths, Railway Gateway Internal Stack, Vercel Internal Stack & Connection, Technology Stack). This document is the prose/spec expansion of that deck, section-aligned to it.

**Companion document:** `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md` is the authoritative build specification for the Railway Gateway referenced throughout this document (§8, §12). It was originally written against an earlier, different system (15 symbols, 5 MT5 terminals on EA v2.24, a 57-column generic OHLC+indicator schema, an Upstash→Railway migration) and has since been revised in full to match this pipeline's actual v6/79-field contract — its DTO, validation rules, deployment guide, and design rationale now describe the Gateway this document builds toward, not the earlier one. The two documents are scoped to not overlap: this document covers the full MT5→Vercel workflow and treats the Gateway as one component in it (§8 points here rather than re-specifying it); the companion document covers the Gateway in the depth an implementer building it actually needs.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Host Topology](#3-host-topology)
4. [Contabo VPS — Process Inventory](#4-contabo-vps--process-inventory)
5. [xauusd.db — Data Model & Retention](#5-xauusddb--data-model--retention)
6. [Path A — Sync/Ingest Pipeline](#6-path-a--syncingest-pipeline)
7. [Path B — Chart Read Pipeline](#7-path-b--chart-read-pipeline)
8. [Railway Gateway — Build Specification](#8-railway-gateway--build-specification)
9. [mtf-panels Read API — Build Specification](#9-mtf-panels-read-api--build-specification)
10. [Vercel Frontend — Build Specification](#10-vercel-frontend--build-specification)
11. [Connection Contracts — Summary Table](#11-connection-contracts--summary-table)
12. [Corrections to Earlier Design Drafts](#12-corrections-to-earlier-design-drafts)
13. [Open Decisions — For Engineering Review](#13-open-decisions--for-engineering-review)
14. [Phased Build Plan](#14-phased-build-plan)
15. [Appendix A — market_data Schema Reference](#appendix-a--market_data-schema-reference)
16. [Appendix B — Glossary](#appendix-b--glossary)

---

## 1. Executive Summary

This system takes XAUUSD price and indicator data from MetaTrader 5 charts and makes it available two ways: as a validated historical record consumed by other backend products (via a Railway-hosted API gateway), and as a live, interactive chart in a web browser (via TradingView Lightweight Charts on Vercel). Both paths start from the same 12 MQL5 indicators and the same local SQLite database, but they are architecturally independent from that point on — a fact this document treats as a first-class design property, not an incidental detail, because it was the source of a real misunderstanding during design review (see §7.4).

Everything upstream of the network — MT5 itself, the collection/validation/calculation pipeline, and the local database — already exists and is not part of this document's build scope; it is described here (§4–§6) because the two new components depend on understanding it correctly. The two things this document specifies for construction are: a small read-only HTTP API on the Contabo VPS (§9), and a revision of the previously-drafted Railway Gateway design to match the pipeline's actual current data contract (§8). The Vercel frontend (§10) is sketched at the level needed to validate the API contracts; its internal implementation is intentionally left to whoever builds it, informed by this document's contracts rather than dictated by it.

## 2. Design Principles

**One writer, many readers.** `xauusd.db` (SQLite, WAL mode) has exactly one process that writes to `market_data`: the Collector. Every other process — Push Worker, the new mtf-panels API, and the existing `mtf_render` ops tool — only ever `SELECT`s from it. This is why they can safely coexist on one host without a connection-pooling layer: SQLite's WAL mode supports concurrent readers alongside a single writer without contention, provided nothing else attempts to write.

**Two paths, not one pipeline.** The system has two distinct outbound data paths from that single source, and they do not compose — Path A does not feed Path B, and Path B does not depend on Path A being healthy or even running. This must be preserved in any future refactor. If a future engineer's instinct is to route the chart's data through the Gateway "since it's already there," that instinct should be checked against §7.4 before acting on it.

**No store beyond what the source can refresh.** SQLite retention is capped at 3000 bars per (symbol, timeframe) — the same lookback MT5 itself uses for its indicator math (`InpBars` / `InpSSAMathLookback`, both 3000). Data older than that is either a permanently-frozen last-known value (if already synced to the Gateway) or exempt from pruning (if not yet synced) — never silently regenerated, never treated as a live analytical dataset. See §5.2.

**Postgres is deliberately absent from this data's path.** Several derived columns (ZigZag, fractal, trendline/centroid channel fields) are recomputed over a rolling window on every indicator export, not appended immutably. Treating them as a stable, appendable timeseries in a relational store would silently misrepresent what "historical" means for those columns. This is why the mtf-panels API reads SQLite directly rather than through a Postgres mirror — see §9 and §12.

**Reuse code, not just patterns, where the code is already tested.** `mtf_render/data_source.py`'s `build_panels()` function is deliberately I/O-free and already covered by `test_mtf_render.py`. The mtf-panels API (§9) wraps this function unchanged rather than reimplementing its variant/channel-overlay logic in a second language or a second codebase.

## 3. Host Topology

Three hosting boundaries, three trust levels:

**Contabo VPS (Windows).** The only host that touches MT5 or the local SQLite file. Historically an outbound-only machine (it calls Railway; nothing calls it). This document adds one narrow inbound exception for the mtf-panels API (§9.4) — that exception should be scoped as tightly as the rest of this document's security posture assumes, since this machine also runs live trading infrastructure.

**Railway Cloud.** Hosts the NestJS Gateway, its internal Redis/Bull queue, and whatever downstream store or product consumes validated `market_data` rows for purposes outside this document's scope (the Gateway pre-dates this specific chart-visualization effort and was originally scoped for a broader "Trading Alerts SaaS" product — see the schema's own `$id`, `https://trading-alerts-saas/v6/...`). This document treats that downstream product as an opaque consumer: the Gateway's job is to accept and correctly acknowledge validated rows, not to know or care what happens after. Concretely, the Gateway exists to give that consumer — an alerts engine, an analytics store, whatever it turns out to be — a durable, validated copy of `market_data`, delivered over HTTP with idempotent upsert semantics; that is a different job from rendering the chart, which is why Path B (below) does not route through it.

**Vercel.** Hosts the Next.js application and its bundled TradingView Lightweight Charts frontend. Talks to exactly one thing outside itself: the mtf-panels API on the Contabo VPS, over HTTPS, through a tunnel.

```
┌───────────────────────────── CONTABO VPS (Windows) ─────────────────────────────┐
│                                                                                    │
│  MT5 Terminal ──► Collector+CalcStack ──► xauusd.db ──┬──► Push Worker ───────────┼──► Railway Gateway
│  (12 indicators)   (validate/calc/promote)  (SQLite)   │        + Relay            │      (NestJS)
│                                                         │                          │         │
│                                                         ├──► mtf-panels API ───────┼─────────┼──► Vercel
│                                                         │      (NEW, FastAPI)      │         │    (Next.js +
│                                                         │                          │         │     Lightweight
│                                                         └──► mtf_render (ops)      │         │     Charts)
│                                                              (unchanged, PNG)      │         │
└────────────────────────────────────────────────────────────────────────────────────┘         │
                                                                                       Gateway's own
                                                                                       downstream consumers
                                                                                       (out of scope here)
```

## 4. Contabo VPS — Process Inventory

Six processes on one Windows host. Five already exist; one (mtf-panels API) is new and specified in §9.

| #   | Process                    | Runs as                                  | Technology                                                              | Reads                                        | Writes / Serves                                    |
| --- | -------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| 1   | MT5 Terminal               | `terminal64.exe`, always-on GUI/headless | MQL5, 12 indicators on XAUUSD M5+M15                                    | Live price feed                              | `.txt` export files, full rewrite every 60s        |
| 2   | MT5Collector               | NSSM service                             | `export_collector_validator_v2.py` + 4 calc modules (in-process import) | `.txt` export files                          | `xauusd.db` (staging tables, then `market_data`)   |
| 3   | MT5PushWorker              | NSSM service                             | `backfill_worker_api_gateway_v5.py`                                     | `xauusd.db` (`WHERE synced_at IS NULL`)      | HTTPS POST → Railway Gateway                       |
| 4   | MT5Relay (optional/legacy) | NSSM service                             | `mt5_api_relay_for_v2_29.py`                                            | Legacy EA's socket feed (iCustom/CopyBuffer) | HTTPS POST → Railway Gateway (same endpoint as #3) |
| 5   | mtf-panels API (**new**)   | NSSM service (proposed)                  | Python, FastAPI, wraps `mtf_render.data_source`                         | `xauusd.db` (`SELECT` only)                  | HTTPS GET, inbound, → Vercel (via tunnel)          |
| 6   | mtf_render                 | CLI / Task Scheduler, on demand          | Python + matplotlib                                                     | `xauusd.db` (`SELECT` only)                  | Local PNG files, no network                        |

Every process except #5 already runs today (#1–#4, #6 are documented in `install_services.bat` and the existing pipeline; #5 does not exist yet in that file and needs to be added when built). Nothing above requires a second SQLite connection pool or lock-coordination layer between processes — WAL mode's single-writer/many-reader model already covers this, provided the discipline in §2 ("one writer") is not violated by a future change.

## 5. xauusd.db — Data Model & Retention

### 5.1 Schema summary

`sqlite_schema_v6_xauusd.sql` defines: `collection_cycles` (cycle bookkeeping), `validation_failures` (per-cycle rejection detail), eleven `raw_*` staging tables (one per admin-layer export source, keyed by `cycle_id`), two validation views (`v_validation_keys`, `v_validation_keys_zigzag`), and the single downstream-facing table, `market_data` — 79 columns: OHLCV, six centroid-regression variants (each with admin-layer fields from MQL5 plus calculated `base_fl`/`uoedt`/`loedt` lines), fractal/support/resistance fields, z-score body fields, ZigZag pivot + calculated metrics, and provenance (`cycle_id`, `collected_at`, `calculated_at`, `synced_at`). Full column reference: Appendix A.

### 5.2 Retention policy

`market_data` is capped at 3000 rows per `(symbol, timeframe)` — matching `InpBars=3000` (OHLCV export depth) and `InpSSAMathLookback=3000` (every centroid variant's math window) on the MQL5 side. MT5 itself never re-exports a bar once it scrolls out of that window, so rows beyond it are a frozen last-known snapshot with zero prospect of correction — retaining them indefinitely has no analytical value and no verification path.

Enforcement is a schema-level trigger, not application logic, so it applies regardless of which process writes (`trg_market_data_prune`, `AFTER INSERT ON market_data`): it deletes rows outside the top-3000-by-timestamp window for that `(symbol, timeframe)`, but **only** rows where `synced_at IS NOT NULL`. A row that has not yet been pushed to the Gateway is exempt at any age — the sync guarantee always wins over the retention window. This was verified by direct test (4000 synced inserts settle at exactly 3000 rows; an unsynced row from far outside the window survives regardless of age).

`PRAGMA auto_vacuum = INCREMENTAL` is set (must run before `journal_mode=WAL` and before any table exists — reordering these two pragmas is not cosmetic; verified by direct test that placing `journal_mode=WAL` first silently locks `auto_vacuum` to `NONE`). This lets an operator reclaim disk space via periodic `PRAGMA incremental_vacuum;` — the trigger only bounds row count, not file size on disk. On the already-existing `xauusd.db` (if one predates this schema revision), converting to incremental-vacuum mode requires one manual `VACUUM;` during a maintenance window, since `auto_vacuum` is otherwise a no-op on a database that already has tables.

## 6. Path A — Sync/Ingest Pipeline

Push Worker (and, when running, the legacy Relay) reads validated, unsynced `market_data` rows and POSTs them to the Railway Gateway at `https://<railway-app>/api/v1/market-data`. This path's job is to give some other backend system — an alerts engine, an analytics store, or any other consumer of the Gateway's queue — a durable, validated copy of `market_data`, delivered over HTTP with idempotent upsert semantics (`(symbol, timeframe, timestamp)` as the upsert key). That downstream product is not specified here and this path does not depend on it existing. Its contract (request shape, idempotency key, response codes) is defined by `gateway_contract_market_data.schema.json` and detailed in §8.

This path's only interaction with retention (§5.2) is that it is what sets `synced_at`, which is what makes a row eligible for pruning once it also falls outside the 3000-bar window. Beyond that, nothing about this path is consulted by, or consults, Path B.

## 7. Path B — Chart Read Pipeline

### 7.1 What the chart actually needs

The frontend's job is to reproduce, interactively, what `mtf_render`'s matplotlib output already renders as a static PNG: three panels — Panel A (M5 candles + the M5-computed equal-distance channel), Panels B and C (M15 candles, overlaid with that _same_ M5 channel object, aligned by real timestamp rather than bar index so the M5 lines land correctly against M15 bars). "Channel" means three price lines — `uoedt` (upper), `base_fl` (base), `loedt` (lower) — for whichever of the six centroid variants is selected.

### 7.2 Why this is a new read, not an extension of Path A

Path A's Gateway validates and stores confirmed historical rows for another product's use. The chart doesn't need "another product's storage" — it needs the same rolling 3000-bar window `mtf_render` already reads, refreshed at the same cadence the data actually changes (once per validated 5- or 15-minute cycle). Building a second store for this would duplicate data that already lives, correctly, in `xauusd.db`.

### 7.3 The actual connection

```
Vercel (Next.js server)  --HTTPS GET, via tunnel + API key-->  mtf-panels API (Contabo VPS)  --local SELECT-->  xauusd.db
```

One hop out of the VPS, one hop into it. No Railway, Redis, Bull, or Gateway process is part of this path in any way.

### 7.4 The misreading this section exists to prevent

An earlier draft of the workflow diagram, read left-to-right, was misinterpreted as implying that the Railway Gateway sits between the VPS and Vercel — i.e., that `matplotlib`/`mtf_render`'s output, or the Push Worker's sync path, somehow "passes through" Railway on its way to the chart frontend. It does not, and no revision of this system should make it do so without deliberately re-deriving the reasoning in §2 and §12 about why Postgres and the Gateway are absent from this specific path. If a future requirement needs the chart to show data validated by the Gateway's own downstream product specifically (as opposed to `xauusd.db`'s own validated `market_data`), that is a new, distinct requirement — not a natural extension of the current one — and should be scoped as such.

## 8. Railway Gateway — Build Specification

The full build specification for the box labeled "Railway Gateway — Internal Stack" on slide 5 of the companion deck now lives in `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md` (module structure, DTO generated from `gateway_contract_market_data.schema.json`, validation layers, idempotency and response contract, deployment/rollout sequence, design rationale, and monitoring — its §§1–9). That document has been revised to match this pipeline's actual v6/79-field contract, so this section does not restate its content; it points to it and states only the two facts this document's other sections (§6, §7.4, §11, §13) depend on.

### 8.1 What to build, and where the spec is

Build against `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md` directly — its §2 (component specifications), §4 (API specifications), and §7 (deployment guide) are the actionable instructions. Do not re-derive a DTO or validation rules from this document; `gateway_contract_market_data.schema.json` is the single source of truth for the payload shape, and the companion document's §2.1 already explains how the DTO should be generated or kept in lockstep with it.

### 8.2 Idempotency and response contract (summary)

Restated here only because §6 and §11 of this document reference it; the exhaustive version, with rationale, is the companion document's §4.1 and §8:

- Upsert key: `(symbol, timeframe, timestamp)`. Duplicate delivery is expected (the Push Worker retries) and must never create a second row.
- `200`/`201` → accepted/upserted; the Push Worker stamps `market_data.synced_at` on this response.
- `400` → validation failure; the Push Worker quarantines the row to `rejected_rows.jsonl` and still stamps `synced_at` (a poison-row guard against infinite retry), replayed later via `replay_quarantine.py`.
- `401`/`403` → the Push Worker halts entirely, requiring operator intervention.
- `429` → the Push Worker honors `Retry-After`.
- `5xx` → the Push Worker retries with backoff.

### 8.3 What this Gateway is not

It is not part of the chart's data path (§7.4). It does not need to know about `mtf-panels`, Lightweight Charts, or Vercel. Its downstream (the Bull queue consumer and whatever it writes to) is out of scope for both this document and the companion document — whoever owns that product should specify it separately (companion document §1.3).

## 9. mtf-panels Read API — Build Specification

This is the one component in this document with no prior draft to reconcile against — it must be built from scratch, but its core logic must not be rewritten from scratch.

### 9.1 Endpoint

```
GET /api/v1/mtf-panels?variant={variant}&limit={limit}
```

- `variant` — one of `best_fit`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`. Default `best_fit`.
- `limit` — most-recent N bars per timeframe. Default `200`. **Hard cap at 3000** (§5.2) — requesting more returns the same 3000 rows with nulls beyond that depth, since nothing upstream populates further back.

### 9.2 Response shape

Mirrors `mtf_render.data_source.load_market_data()`'s return value exactly — this is deliberate, not incidental:

```json
{
  "variant": "best_fit",
  "A": { "timeframe": "M5",  "candles": [{"timestamp":...,"open":...,"high":...,"low":...,"close":...,"volume":...}, ...],
         "channel": {"variant": "best_fit", "frame": [{"timestamp":...,"uoedt":...,"base_fl":...,"loedt":...}, ...]} },
  "B": { "timeframe": "M15", "candles": [...], "channel": { /* SAME object as A's channel */ } },
  "C": { "timeframe": "M15", "candles": [...], "channel": { /* SAME object as A's channel, again */ } }
}
```

### 9.3 Implementation approach

A thin FastAPI process that imports `mtf_render.data_source` unchanged and calls `build_panels()` (or `load_market_data()` directly) against the same `xauusd.db` path `mtf_render` and the Collector already use. No adapter swap is needed — this reads the same SQLite file, not a mirror — which is the whole reason this approach was chosen over the alternative considered during design (porting the variant/channel-overlay SQL into the NestJS Gateway against a Postgres mirror): that alternative would have required maintaining the same business rule ("the channel is always M5, overlaid on M15 by time, never recomputed") in two languages, and would have required a Postgres mirror this document already rules out (§2, §12).

### 9.4 Exposure and security

This is the one new inbound path into a machine that has historically only made outbound calls. It should be: read-only (no route does anything but `SELECT`), narrowly scoped (this one endpoint only, not a general database proxy), and fronted by something like a Cloudflare Tunnel or a reverse proxy requiring an API key — not a directly opened firewall port on a machine also running live MT5 terminals. The Vercel side should call this through a Next.js server-side API route (§10.2) rather than from the browser directly, so the tunnel URL and API key never reach client-side JavaScript.

### 9.5 Data-freshness expectations

`market_data` updates once per validated cycle — under a minute past bar-close in the normal case, degrading to a few minutes only when a cycle is rejected and retries (§6, and the collector's own retry logic: ≤3 attempts × 65s). Polling this endpoint every 30–60 seconds from the frontend is sufficient; there is no need for push/WebSocket delivery given this cadence, though nothing here precludes adding it later if a future requirement calls for it.

## 10. Vercel Frontend — Build Specification

This section specifies the contract the frontend must satisfy, not its internal implementation — deliberately, since implementation choices here (state management, styling, exact polling library) don't affect the rest of this document and shouldn't be over-specified in a document meant to survive engineering revision.

### 10.1 Rendering requirement

Three TradingView Lightweight Charts instances (or three panes of one chart, if the frontend team prefers), matching `mtf_render`'s panel layout: each with one candlestick series from `candles`, plus three line series (`uoedt`, `base_fl`, `loedt`) from `channel.frame`. Panels B and C both plot the _same_ channel object as Panel A — this is a real invariant, not a rendering choice, and it should stay pinned to whatever the API returns rather than be recomputed client-side.

### 10.2 Server-side proxy

A Next.js API route (e.g. `/api/mtf-panels`) that forwards to the VPS's `mtf-panels` endpoint, holding the tunnel URL and API key as server-only environment variables. The browser calls this Next.js route, never the VPS endpoint directly.

### 10.3 Variant selection and refresh

A variant selector (6 options, §9.1) that re-issues the fetch with the new `variant` param. Polling interval 30–60s (§9.5) is sufficient given the data's actual update cadence; this should not be tuned lower under the assumption that faster polling yields fresher data — it will not, since the underlying `market_data` row doesn't change faster than that regardless of how often it's requested.

## 11. Connection Contracts — Summary Table

| From                    | To                 | Protocol                    | Payload / Contract                         | Direction relative to VPS       |
| ----------------------- | ------------------ | --------------------------- | ------------------------------------------ | ------------------------------- |
| MT5 indicators          | Local `.txt` files | Filesystem write            | Tab-separated, UTC unix timestamps         | n/a (local)                     |
| Collector               | `xauusd.db`        | Filesystem/SQLite           | Staging tables → `market_data`             | n/a (local)                     |
| Push Worker + Relay     | Railway Gateway    | HTTPS POST                  | `gateway_contract_market_data.schema.json` | Outbound                        |
| mtf-panels API          | `xauusd.db`        | Filesystem/SQLite           | `SELECT` only                              | n/a (local)                     |
| Vercel (Next.js server) | mtf-panels API     | HTTPS GET, tunnel + API key | §9.2 JSON panel shape                      | **Inbound** (the one exception) |
| mtf_render              | `xauusd.db`        | Filesystem/SQLite           | `SELECT` only                              | n/a (local)                     |

## 12. Corrections to Earlier Design Drafts

`ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md` originally needed an itemized reusable-vs-must-rebuild split here, because it still described the earlier 15-symbol/57-column/Upstash-migration system. That document has since been revised in place to match this pipeline's actual contract — its own §1.2 ("What changed from the earlier draft and why") and §8 ("Design Rationale") now carry that history directly, so restating the split here would just be a second, driftable copy of the same information. §8 of this document points to the revised version rather than to a diff against its old self.

What remains here are corrections to this conversation's own earlier drafts of the _workflow_ (not the Gateway document specifically):

An earlier description of this architecture characterized the legacy EA/socket path as necessary to "keep the indicators alive." This is incorrect and was corrected during design review: each of the 12 indicators is itself an MT5 indicator (`#property indicator_chart_window`) with its own `OnInit()`→`EventSetTimer(1)` and `OnTimer()` export logic — attaching it to a chart is sufficient for it to auto-export every minute with zero EA involvement, verified directly against the indicator source. The legacy EA/socket path is retained for two different, legitimate reasons (historical continuity with the pre-v6 design; future low-latency optionality) — not for keeping anything running.

A separate earlier draft proposed mirroring `market_data` into Postgres for durable, queryable storage; this was reversed once it was established that ZigZag/fractal/trendline fields recompute over a rolling window rather than append immutably, making a relational "historical" mirror of those specific columns misleading regardless of how convenient it would otherwise be. This is also why the revised Gateway document's downstream store is out of scope (§8.3) rather than specified as Postgres — see its §1.3 and §8.

## 13. Open Decisions — For Engineering Review

This section exists because this document is meant to be re-examined, not rubber-stamped. Items here are genuine judgment calls, not gaps in research:

- **mtf-panels API framework.** FastAPI is assumed (§9.3) for its low ceremony and because the reused `data_source.py` is already plain Python. Flask or a bare WSGI app would work equally well; the choice doesn't affect any contract in this document.
- **Tunnel technology (§9.4).** Cloudflare Tunnel is suggested as an example, not a requirement. Any reverse proxy with API-key auth and no other open inbound ports satisfies the actual requirement.
- **Whether `mtf_render` should also move to an NSSM service.** Currently CLI/Task-Scheduler-based per existing practice; nothing in this document requires changing that, but consolidating all six VPS processes under NSSM would simplify `install_services.bat` maintenance.
- **Whether the Gateway's downstream (Bull consumer's target) should be specified at all in this repo.** This document treats it as out of scope (§8.3) because it belongs to a different product; if that product is actually being built alongside this effort, it deserves its own document rather than inheriting assumptions from this one.
- **Retention window for `rejected_rows.jsonl` and quarantine replay cadence** — not specified anywhere in the source pipeline as of this writing; worth deciding explicitly rather than defaulting into unbounded growth, the same way §5.2 was decided for `market_data`.

## 14. Phased Build Plan

1. **mtf-panels API (Contabo VPS).** Build and test locally against the existing `xauusd.db` before any network exposure — validate the response shape (§9.2) matches `mtf_render`'s panels exactly for at least one variant, using the same fixture (`mtf_render/fixture.py`) the existing test suite already relies on.
2. **Inbound exposure (Contabo VPS).** Add the tunnel/reverse proxy (§9.4) and API key; confirm the VPS's other five processes are unaffected (they should be — this is an additive change, not a modification of any existing process).
3. **Railway Gateway build.** Follow `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md`'s §7 deployment sequence directly (§8.1 of this document points to it); verify against `gateway_contract_market_data.schema.json` directly, ideally with contract tests generated from that schema file rather than hand-written fixtures that can drift from it.
4. **Vercel frontend.** Build against the mtf-panels API contract (§9.2) using a mocked/fixture response before wiring up the real tunnel — this decouples frontend and VPS-exposure work.
5. **Integration.** Confirm both paths independently (§7.4) — Path A's Gateway ingestion and Path B's chart rendering should be verifiable in isolation, with neither path's test suite depending on the other being deployed.

---

## Appendix A — market_data Schema Reference

See `sqlite_schema_v6_xauusd.sql` and `gateway_contract_market_data.schema.json` for the authoritative field list (79 columns). Column families: OHLCV (5 cols); six centroid variants × 8 cols each (`horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa`, `crossing` — admin/MQL5; `base_fl`, `uoedt`, `loedt` — calculated); fractal/support/resistance (5 cols, calculated); z-score body (3 cols, calculated); ZigZag (2 admin + 9 calculated cols); provenance (`cycle_id`, `collected_at`, `calculated_at`, `synced_at`).

## Appendix B — Glossary

- **Admin layer** — fields whose values come directly from MQL5 (as opposed to being computed by the Python calc stack).
- **Calculated** — fields computed by the Python CALCULATE stage from admin-layer inputs.
- **Channel** — the three-line equal-distance regression overlay (`uoedt`/`base_fl`/`loedt`) for one centroid variant.
- **Cycle** — one collection attempt for one `(timeframe, cycle_time)` slot; may be retried up to 3 times.
- **Path A / Path B** — this document's names for the sync/ingest pipeline (§6) and the chart read pipeline (§7), respectively; not names used anywhere in the source code.
- **Synced** — a `market_data` row whose `synced_at` is non-null, meaning the Gateway has acknowledged it.
- **Variant** — one of six centroid-regression parameter presets (`best_fit`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`).
