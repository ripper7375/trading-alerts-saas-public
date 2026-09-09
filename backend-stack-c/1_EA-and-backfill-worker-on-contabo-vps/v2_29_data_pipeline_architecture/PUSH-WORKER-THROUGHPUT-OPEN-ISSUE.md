# Push Worker Throughput — OPEN ISSUE (unverified against the live VPS)

**Raised:** 2026-09-09, while answering "how many rows reach PostgreSQL, and how often?"
**Status:** **OPEN — arithmetic only. Not observed in production, not reproduced.**
**Severity if confirmed:** high — the newest bars (the ones alerts depend on) may reach
PostgreSQL late or not at all.
**Independent of** the 2026-09-09 calculation-split removal: this applies equally to the old
79-column architecture and was not introduced by that work.

> **Read this first.** Nothing below is a measurement. It is arithmetic from constants in the
> code plus two verified mechanisms. The whole point of §4 is to settle it with real numbers
> before anyone changes anything. It is entirely possible the real per-POST latency makes this a
> non-issue.

---

## 1. The two mechanisms this rests on (both verified in code)

**a. Every collection cycle re-queues every in-window bar.**
`promote_cycle()` writes all 3000 bars with `INSERT OR REPLACE INTO market_data (...)` and does
not list `synced_at` in the column list, so SQLite resets it to NULL. Verified directly:

```
before re-promote  synced_at = 999
after  re-promote  synced_at = None
```

This is **correct and intentional**: MT5 recalculates SSA, centroid regressions, ZigZag pivots and
the line indicators across the whole 3000-bar lookback on every tick, so any bar's values may have
changed and every bar genuinely does need re-pushing.

**b. The push worker POSTs one row per HTTP request.**
`backfill_worker_api_gateway_v5.py:191-199` — `for row in rows: session.post(...)`. The gateway
contract is one JSON object per bar, so this follows from the contract, not from an oversight.

Relevant constants:

```python
MAX_ROWS_PER_CYCLE = 500
ACTIVE_SLEEP_SEC   = 30     # backlog present
IDLE_SLEEP_SEC     = 300    # outbox empty
# selection: "... WHERE synced_at IS NULL ORDER BY timestamp ASC LIMIT ?"   <- OLDEST FIRST
```

## 2. The arithmetic

**Demand** — the rate at which rows become unsynced:

| Source                    | Cadence      | Rows re-queued             |
| ------------------------- | ------------ | -------------------------- |
| M5 cycle                  | every 5 min  | 3000                       |
| M15 cycle                 | every 15 min | 3000                       |
| **Per 15 min**            |              | 3×3000 + 3000 = **12,000** |
| **Sustained rate needed** |              | **~800 rows/min**          |

**Capacity** — one push cycle is (time to POST 500 rows) + 30s sleep:

| Per-POST round trip | 500 POSTs take | Cycle length | Throughput       |
| ------------------- | -------------- | ------------ | ---------------- |
| 20 ms               | 10 s           | 40 s         | **750 rows/min** |
| 40 ms               | 20 s           | 50 s         | **600 rows/min** |
| 60 ms               | 30 s           | 60 s         | **500 rows/min** |
| 100 ms              | 50 s           | 80 s         | **375 rows/min** |

To meet 800 rows/min the whole cycle must finish in ≤37.5s, i.e. ~7.5s for 500 sequential
Contabo→Railway round trips — about **15 ms each**. That is optimistic for cross-provider
internet round trips.

**If the deficit is real, the consequence is not a crash — it is starvation of the newest bars.**

## 3. Why it starves the newest bars specifically

The outbox is **bounded**: it can never exceed the ~6000 rows that exist in SQLite, so nothing
leaks and nothing is lost. The problem is _ordering_.

Selection is `ORDER BY timestamp ASC` — oldest first. Every 5 minutes all 3000 M5 rows reset to
NULL. So the worker restarts from the oldest bar each time and works forward. If it can only get
through ~2500 rows before the next reset, bars beyond that point — **the most recent ones** — are
never reached. They are the newest rows in the table, so they sort last.

For a trading-alerts product that is the wrong end to drop.

### The tension (why "just sort newest first" is not automatically right)

Oldest-first is not arbitrary — it protects the sync guarantee. The retention trigger only prunes
rows that are **already synced**:

```sql
DELETE FROM market_data
WHERE ... AND synced_at IS NOT NULL AND timestamp NOT IN (newest 3000)
```

A bar that scrolls out of MT5's 3000-bar window while still unsynced is never re-exported and
never pruned — it sits in SQLite forever until pushed. Oldest-first drains exactly those
stragglers first, which is why SQLite does not grow without bound. Flipping to newest-first would
fix freshness and could let those stragglers accumulate instead.

**Any fix must satisfy both:** newest bars arrive promptly **and** stragglers still drain.

## 4. How to settle it — do this before changing any code

On the VPS, over at least three consecutive 5-minute cycles during market hours:

**a. Does the outbox ever reach zero?**

```sql
-- run every ~30s
SELECT timeframe, COUNT(*) FROM market_data WHERE synced_at IS NULL GROUP BY timeframe;
```

Sawtooth that touches ~0 → no problem, stop here. Never dips near zero → deficit is real.

**b. What is the real per-cycle cost?**

```
findstr /C:"unsynced rows" C:\Scripts\logs\push_worker.log
```

Time between consecutive "pushing" lines gives the true cycle length; divide by rows pushed for
the real per-POST cost. **This single number decides everything** — it is the `T` in §2's table.

**c. Are the newest bars actually arriving?** Against Postgres:

```sql
SELECT timeframe, MAX(timestamp), NOW() FROM market_data_v6 GROUP BY timeframe;
```

Compare to the newest bar in SQLite. A persistent gap of more than a couple of bars is the
symptom that matters.

> **Context worth knowing:** on 2026-09-09 the live gateway's queue reported
> `{waiting:0, active:0, completed:0, failed:0}` across ~5 days of uptime, with
> `removeOnComplete: 100` retention — i.e. **nothing had been pushed at all in that window**. So
> this has most likely never been exercised at sustained production volume, which is why it has
> not been noticed. Expect to have to start the pipeline properly before §4 produces useful data.

## 5. Candidate fixes (ranked, if §4 confirms a deficit)

**1. Batch the POSTs — the real fix.** One HTTP request carrying N bars instead of N requests
collapses the dominant cost (per-request round trip). Needs a gateway-side change: a batch
endpoint, or accepting an array on the existing route. This changes the frozen data contract, so
it needs Davin's sign-off and a coordinated gateway + push-worker release. Everything else below
is a mitigation.

**2. Raise `MAX_ROWS_PER_CYCLE` and cut `ACTIVE_SLEEP_SEC`.** Trivial, no contract change. With a
backlog present, a 30s idle sleep is pure waste — dropping it to ~2s and raising the batch to
2000 roughly triples throughput on its own. Lowest risk, do this first regardless.

**3. Only re-queue bars whose values actually changed.** The deepest fix: most of the 3000 bars
are numerically identical cycle to cycle (MT5 recalculates the window, but old bars rarely move).
Comparing against the existing row and leaving `synced_at` intact when nothing changed could cut
demand by an order of magnitude. Costs a read-and-compare per bar in `promote_cycle()`, and needs
care over float equality.

**4. Two-tier ordering.** Push the newest ~200 bars first, then fall back to oldest-first for the
rest — satisfying both halves of §3's tension. Cheap, but a band-aid over the throughput deficit
rather than a cure.

## 6. Do not break these

- **The sync guarantee.** A row must never be pruned from SQLite before it is confirmed in
  Postgres. The retention trigger's `synced_at IS NOT NULL` condition is what enforces it.
- **Idempotency.** The gateway upserts on `(symbol, timeframe, timestamp)` — duplicate delivery is
  by design. Any batching change must preserve that.
- **The poison-row guard.** A 400 quarantines the row to `rejected_rows.jsonl` _and_ stamps
  `synced_at` so one bad row cannot block the outbox. Batching must not lose per-row 400 handling.
