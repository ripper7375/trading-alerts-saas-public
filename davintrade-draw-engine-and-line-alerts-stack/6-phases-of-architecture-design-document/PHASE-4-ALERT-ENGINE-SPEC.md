# Phase 4 — Server-Side Alert Engine Spec (BullMQ + Redis)

**Status:** Implementation-ready spec
**Last updated:** 2026-06-18
**Parent docs:** `docs/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` (§4 two-pipeline, §5 geometry),
`docs/PHASE-1-DRAWING-ENGINE-CLEANROOM-SPEC.md` (§6 `geometry/`, §7 serialization)
**Scope:** A headless service that watches live price and fires an alert when price crosses a
user-drawn line — even when the browser is closed.

---

## 1. What this engine does (one paragraph)

It joins the **two pipelines**: live **price** (from MT5 → Flask) and user **intent** (the
`Drawing` + `DrawingAlert` rows). On every price update it recomputes each watched line's value at
the current bar (using the **same pure `geometry/` module the chart uses**), detects a crossing,
applies tolerance/direction/cooldown/one-shot rules, and on a fire writes a `Notification`, pushes it
live over the existing Socket.IO server, and optionally emails via Resend. It never receives price
from the browser — price is authoritative from MT5.

---

## 2. Existing rails this plugs into (cited)

| Need                    | Existing component                                                                         | Path                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Price source            | Flask emits `ohlcv_update` per symbol/timeframe room                                       | `mt5-service/app/websocket.py:257`       |
| Price persistence       | Python sync → `MarketData` (Postgres)                                                      | `sync/`, `prisma/schema.prisma:932`      |
| Drawing geometry (pure) | `geometry/levelsForMark()` (Phase 1)                                                       | `components/charts/drawing/geometry/`    |
| Intent data             | `Drawing`, `DrawingAlert` (Phase 2/3), `Alert` (`isActive`,`lastTriggered`,`triggerCount`) | `prisma/schema.prisma:383`               |
| Notification record     | `Notification` (type `ALERT`, priority enum)                                               | `prisma/schema.prisma:666`, enums `:653` |
| Live push to browser    | `sendNotificationToUser(userId, msg)` → room `user:{id}`                                   | `lib/websocket/server.ts:171`            |
| Email                   | Resend + react-email templates                                                             | `emails/`                                |
| Cache / queue backbone  | Redis (`ioredis`, `redis`) already installed                                               | deps                                     |
| ORM                     | Prisma 6 / Postgres                                                                        | `lib/db/prisma.ts`                       |

**Net-new:** `bullmq` (worker/queue), a Redis **pub/sub price channel**, and a ~5-line Redis
publisher added to Flask. Nothing else.

---

## 3. Component architecture

```
                         (NEW ~5 lines, near ohlcv_update emit)
 Flask MT5 service ──publish──► Redis channel  prices:{symbol}:{timeframe}
   (mt5-service/app/websocket.py)                     │
                                                      ▼
 ┌───────────────────────── ALERT ENGINE (new Node service) ─────────────────────────┐
 │  ingest/PriceSubscriber.ts   ── subscribes Redis price channel(s)                  │
 │        │  PriceEvent { symbol, timeframe, time, open, high, low, close }           │
 │        ▼                                                                            │
 │  cache/ActiveAlerts.ts       ── in-memory map symbol|tf → AlertWatch[]             │
 │        │  (invalidated via Redis channel alerts:changed)                           │
 │        ▼                                                                            │
 │  eval/Evaluator.ts           ── per watch: level.valueAt(time) → crossing?         │
 │        │   uses geometry/levelsForMark()   (+ Redis side/cooldown state)           │
 │        ▼ (on fire)                                                                 │
 │  queue: BullMQ "alert-fire"  ── durable, retryable                                 │
 └───────────────────────────────────────────────────────────────────────────────────┘
                                                      │
 ┌──────────────── FIRE WORKER (BullMQ consumer) ─────▼───────────────────────────────┐
 │  1) Notification row (Prisma)  2) Alert.lastTriggered/triggerCount++               │
 │  3) sendNotificationToUser()   4) Resend email (if enabled)                        │
 │  5) chart marker payload (Phase 5)  6) oneShot → Alert.isActive=false             │
 └────────────────────────────────────────────────────────────────────────────────────┘
```

Two responsibilities, deliberately split:

- **Ingest + evaluate** = in-process, low-latency, pure math (cheap).
- **Fire/dispatch** = **BullMQ job** → durable, retried, isolated from the hot path.

---

## 4. Price fan-out design (Redis pub/sub)

**Producer (Flask, net-new):** beside the existing `socketio.emit('ohlcv_update', ...)` at
`mt5-service/app/websocket.py:257`, also publish to Redis (Python `redis` client):

```python
# channel: prices:{symbol}:{timeframe}   payload: JSON bar
redis_client.publish(f"prices:{symbol}:{timeframe}", json.dumps({
    "symbol": symbol, "timeframe": timeframe, "time": bar_time,
    "open": o, "high": h, "low": l, "close": c, "final": is_closed_bar
}))
```

**Consumer (Node):** `PriceSubscriber` subscribes with `psubscribe prices:*` (or per active
symbol/tf). Payload → `PriceEvent`.

```ts
interface PriceEvent {
  symbol: string;
  timeframe: string;
  time: number; // bar timestamp (unix s)
  open: number;
  high: number;
  low: number;
  close: number;
  final: boolean; // closed bar vs forming
}
```

**Alternative (no Flask change):** Node worker connects to Flask as a `socket.io-client`, subscribes
to active rooms, consumes `ohlcv_update`. Simpler to ship, but couples the worker to the socket
transport and complicates room management. **Redis pub/sub is the recommended path.**

---

## 5. The evaluation algorithm

### 5.1 The watch object (built from intent + geometry)

```ts
interface AlertWatch {
  alertId: string;
  drawingId: string;
  userId: string;
  symbol: string;
  timeframe: string;
  level: AlertLevel; // from geometry/levelsForMark() + targetLevel filter
  direction: 'cross_up' | 'cross_down' | 'either';
  tolerance: number; // price units; 0 = pure cross
  cooldownSec: number;
  oneShot: boolean;
}
```

### 5.2 Per price event (pseudocode)

```ts
function onPriceEvent(ev: PriceEvent) {
  const watches = activeAlerts.get(`${ev.symbol}|${ev.timeframe}`) ?? [];
  for (const w of watches) {
    const lvl = w.level.valueAt(ev.time);
    if (lvl === null) continue; // segment out of range, etc.

    const prev = getPrevPrice(w); // Redis: last close seen for this watch
    const curr = ev.close;

    const crossed = detectCross(
      prev,
      curr,
      ev.low,
      ev.high,
      lvl,
      w.tolerance,
      w.direction
    );
    setPrevPrice(w, curr); // Redis SET (survives restart)

    if (!crossed) continue;
    if (await onCooldown(w)) continue; // Redis EXISTS alert:cd:{id}:{lvl}
    if (await alreadyFiredOneShot(w)) continue;

    await setCooldown(w); // SETEX cooldownSec (skip if 0)
    await fireQueue.add('alert-fire', buildFireJob(w, ev, lvl));
  }
}
```

### 5.3 Cross detection (default semantics)

```ts
function detectCross(prev, curr, low, high, lvl, tol, dir): boolean {
  const band = tol; // 0 ⇒ exact line
  // (a) close-to-close crossing (handles direction)
  const up = prev < lvl - band && curr >= lvl - band;
  const down = prev > lvl + band && curr <= lvl + band;
  // (b) intrabar touch on forming/closed bar (catches spikes)
  const touched = low <= lvl + band && high >= lvl - band;
  const dirOk =
    dir === 'either' ||
    (dir === 'cross_up' && up) ||
    (dir === 'cross_down' && down);
  return (up || down || touched) && (dir === 'either' ? true : dirOk);
}
```

- **Why both:** close-to-close gives clean directional crosses; the intrabar `low/high` test catches
  fast wicks the close would miss (the gap your MQL5 tolerance-band had). Tunable per deployment.
- **Cadence:** evaluate every event by default; set `EVAL_ON_FINAL_BAR_ONLY=true` to act only on
  `ev.final` (fewer false touches, MT5-bar-aligned). (Architecture §11.4.)

---

## 6. State & idempotency (Redis keys)

| Key                              | Type    | Purpose                                            | TTL              |
| -------------------------------- | ------- | -------------------------------------------------- | ---------------- |
| `alert:prev:{alertId}:{levelId}` | string  | last close seen (cross across events/restarts)     | rolling, e.g. 7d |
| `alert:cd:{alertId}:{levelId}`   | string  | cooldown lock                                      | `cooldownSec`    |
| `alert:fired:{alertId}`          | string  | one-shot guard (belt-and-suspenders to DB)         | until reset      |
| channel `alerts:changed`         | pub/sub | API publishes on alert/drawing CRUD → cache reload | —                |

Idempotency: the `prev`/`cooldown` keys make re-delivery of the same price event a no-op, and the
fire job carries a deterministic `jobId` (`${alertId}:${ev.time}:${levelId}`) so BullMQ dedups
duplicate fires.

---

## 7. Active-alert cache & invalidation

- On boot: load all `DrawingAlert` join `Alert(isActive=true)` join `Drawing`, build `AlertWatch[]`
  grouped by `symbol|timeframe` via `geometry/levelsForMark()` filtered to `targetLevel`.
- Keep in memory; **invalidate** when the Phase 2/3 API publishes `alerts:changed` (with the changed
  `alertId`/`symbol`) → reload that group (or full reload if small).
- Rebuild watches when a `Drawing.anchors` edit changes geometry (same channel).

---

## 8. Fire job (BullMQ consumer)

```ts
// queue name: "alert-fire";  connection: ioredis (REDIS_URL)
worker.process('alert-fire', async (job) => {
  const {
    alertId,
    userId,
    symbol,
    timeframe,
    levelId,
    levelPrice,
    touchPrice,
    time,
    oneShot,
  } = job.data;

  await prisma.$transaction([
    prisma.notification.create({
      data: {
        userId,
        type: 'ALERT',
        priority: 'HIGH',
        title: `${symbol} ${timeframe} alert`,
        body: `Price ${touchPrice} touched ${levelId} @ ${levelPrice}`,
        link: `/charts/${symbol}/${timeframe}`,
      },
    }),
    prisma.alert.update({
      where: { id: alertId },
      data: {
        lastTriggered: new Date(),
        triggerCount: { increment: 1 },
        ...(oneShot ? { isActive: false } : {}),
      },
    }),
  ]);

  sendNotificationToUser(userId, {
    type: 'ALERT',
    symbol,
    timeframe,
    levelId,
    levelPrice,
    touchPrice,
    time,
  });
  if (emailEnabled(userId))
    await sendAlertEmail(userId, { symbol, timeframe, levelId, levelPrice });
  // Phase 5: also push a chart-marker payload (PriceEvent mark) to the user room.
});
```

- Retries: BullMQ `attempts: 5`, exponential backoff; failures → dead-letter (failed set) + log.
- `oneShot` disables the alert in DB **and** sets `alert:fired:*` so an in-flight duplicate can't
  re-fire.

---

## 9. Concurrency, ordering, scaling

- **v1 (recommended start):** single ingest process. Evaluation is synchronous per event, so
  per-`(alertId,levelId)` ordering is naturally preserved. Fire jobs run concurrently (order of
  delivery between _different_ alerts doesn't matter).
- **Scale-out path:** replace pub/sub with **Redis Streams + consumer groups**, partitioned by
  `symbol`, so each symbol is owned by exactly one consumer (preserves per-alert ordering) while
  symbols spread across workers. Fire workers scale independently (BullMQ `concurrency`).
- **Realtime push scale-out:** add `@socket.io/redis-adapter` to `lib/websocket/server.ts` so
  `sendNotificationToUser` reaches the user regardless of which node holds their socket.

---

## 10. Failure modes & recovery (lessons from the MQL5 system)

| Failure                           | Handling                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Worker restart                    | `prev`/`cooldown` state in Redis (not memory) → resume without double-fire                      |
| Feed disconnect / reconnect       | Flask publisher resumes; on gap, next event re-seeds `prev`; optional "stale feed" health alert |
| Market gap / weekend              | Cross still valid on reopen; cooldown prevents storm; `EVAL_ON_FINAL_BAR_ONLY` reduces noise    |
| Drawing deleted/edited mid-flight | `alerts:changed` invalidation rebuilds/removes the watch                                        |
| Clock/timestamp from forming bar  | Use `ev.time` (bar timestamp) for `valueAt`, not wall clock                                     |
| Duplicate price events            | Deterministic `jobId` + Redis idempotency keys → no double-fire                                 |
| DB write fails in fire job        | BullMQ retry; Notification+Alert update in one `$transaction` (atomic)                          |

---

## 11. Tiering, limits, abuse control (Phase 6 hook)

- Max **active alerts per user** enforced at create-time (Phase 3 API) by `Subscription` tier
  (`lib/auth/permissions.ts`, re: `00-tier-specifications`).
- Per-user fire rate cap + global per-symbol throttle (Redis counter) to prevent notification storms.
- Cooldown default per tool type (e.g. 60s) mirroring the MQL5 per-trendline cooldown.

---

## 12. Configuration (env)

| Var                           | Meaning                                 | Default    |
| ----------------------------- | --------------------------------------- | ---------- |
| `REDIS_URL`                   | shared Redis (pub/sub + BullMQ + state) | —          |
| `DATABASE_URL`                | shared Postgres (Prisma)                | —          |
| `ALERT_PRICE_CHANNEL_PATTERN` | `prices:*`                              | `prices:*` |
| `EVAL_ON_FINAL_BAR_ONLY`      | act only on closed bars                 | `false`    |
| `ALERT_FIRE_CONCURRENCY`      | BullMQ worker concurrency               | `10`       |
| `ALERT_EMAIL_ENABLED`         | global email toggle                     | `true`     |
| `ALERT_DEFAULT_COOLDOWN_SEC`  | fallback cooldown                       | `60`       |

---

## 13. Technology stack (existing vs net-new)

| Concern                  | Existing                                           | Net-new                                              |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------- |
| Price transport          | Flask flask-socketio (`ohlcv_update`)              | Flask **Redis publisher** (~5 lines, Python `redis`) |
| Fan-out to worker        | Redis (`ioredis`)                                  | **pub/sub channel** `prices:{symbol}:{tf}`           |
| Queue / worker           | Redis (`ioredis`)                                  | **`bullmq`** (alert-fire queue + worker)             |
| State / cooldown / dedup | Redis                                              | key schema (§6)                                      |
| Evaluation math          | `geometry/` (Phase 1)                              | `Evaluator` + `detectCross`                          |
| Persistence              | Prisma 6 / Postgres                                | `Drawing`/`DrawingAlert` (Phase 2/3)                 |
| Live delivery            | `lib/websocket/server.ts` `sendNotificationToUser` | reuse; opt `@socket.io/redis-adapter`                |
| Email                    | Resend + react-email                               | `sendAlertEmail` template                            |

> **Python/Celery alternative:** the worker _could_ be Celery + Redis co-located with Flask. Rejected
> as default because it would access Prisma-owned tables from Python via raw SQL and re-implement the
> TS `geometry/` module — losing the single-source-of-truth guarantee. Node/BullMQ keeps geometry and
> ORM shared. (Architecture §11.2.)

---

## 14. Deployment

- New **long-running Node service** "alert-engine" (ingest+eval+fire). Deploy as its own
  Railway service / Docker container (`docker-compose.yml` present). **Not** on Vercel/serverless
  (needs a persistent subscriber). Shares `DATABASE_URL` + `REDIS_URL`.
- Flask change ships with the existing `mt5-service` deploy.
- Health endpoint + readiness (Redis & DB ping); structured logs; restart policy `always`.

---

## 15. Observability

- Structured logs per stage: event received, watch evaluated, cross detected, job enqueued, fired.
- Metrics: events/sec, eval latency, fires/min, queue depth, failed jobs, feed-staleness gauge.
- Dead-letter inspection for failed fire jobs; alert on queue backlog / feed silence.

---

## 16. Testing plan

- **Unit (Jest):** `detectCross` truth table (up/down/either, tolerance, intrabar wick); cooldown &
  one-shot gating with a mocked Redis; `AlertWatch` build from `levelsForMark()`.
- **Integration:** publish synthetic `PriceEvent`s to Redis → assert exactly-one fire job with
  correct payload; restart mid-stream → no double-fire (idempotency).
- **Contract:** the same `geometry/` inputs produce identical level prices on client and worker
  (shared-module test).
- **E2E (Playwright + worker up):** draw line → set alert → drive price across it → notification
  appears in UI.
- Gate: `npm run validate` green.

---

## 17. Definition of done

1. Flask publishes bars to Redis; Node ingest receives `PriceEvent`s for all active symbols/tf.
2. Active alerts cached and invalidated on CRUD via `alerts:changed`.
3. Crossing/touch detection with tolerance, direction, cooldown, one-shot — correct and idempotent
   across restarts.
4. Fire path writes `Notification` + updates `Alert`, pushes via `sendNotificationToUser`, emails via
   Resend; one-shot disables the alert.
5. Client and server compute identical line values (shared `geometry/`).
6. Runs as a standalone, restart-safe service with health/metrics; `npm run validate` passes; no
   `any`/copyleft code.

---

## 18. Decisions resolved here (from architecture §11)

- §11.1 price source → **Redis pub/sub from Flask** (publisher added).
- §11.2 worker language → **Node + BullMQ** (shares Prisma + `geometry/`).
- §11.4 cadence → every event by default, `EVAL_ON_FINAL_BAR_ONLY` opt-in.
- §11.5 realtime scale-out → `@socket.io/redis-adapter` when multi-node (deferred to Phase 5).
- Remaining open: §11.3 line extent (ray vs segment) — comes from per-alert `extend*` flags set in
  Phase 3 UI; the evaluator already honors `valueAt → null` outside range.
