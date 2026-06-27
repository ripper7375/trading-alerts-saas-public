# Scaling: BullMQ fire durability + Socket.IO Redis adapter

Two hardening additions on top of Phase 4/5.

## 1. BullMQ — durable, retryable fires

The alert worker now enqueues each detected fire to a BullMQ queue
(`alert-fire`) instead of dispatching inline. A BullMQ worker runs the
dispatcher (Notification + Alert update + cross-process publish) with retries.

- **Durability:** a transient DB/Redis failure no longer drops an alert — the
  job retries (5 attempts, exponential backoff).
- **Dedup:** deterministic `jobId = alertId:time:levelId` ignores duplicate
  fires for the same alert/level/bar.
- **Fallback:** set `ALERT_USE_QUEUE=false` to dispatch inline (no queue).

Files: `lib/alert-engine/queue.ts` (new), `lib/alert-engine/worker.ts` (wires
the queue + fire worker, with fallback + clean shutdown).

### Env

| Var                      | Meaning                                    | Default |
| ------------------------ | ------------------------------------------ | ------- |
| `ALERT_USE_QUEUE`        | `false` to bypass BullMQ (inline dispatch) | on      |
| `ALERT_FIRE_CONCURRENCY` | BullMQ worker concurrency                  | `10`    |

## 2. Socket.IO Redis adapter — multi-node delivery

`initWebSocketServer` now attaches `@socket.io/redis-adapter` when `REDIS_URL`
is set, so `io.to('user:<id>').emit(...)` reaches the user's socket regardless
of which web instance holds it. Without it, room emits only reach sockets on the
same node — fine for single-instance, required for horizontal scaling.

File: `lib/websocket/server.ts` (auto-attaches on `REDIS_URL`; logs + continues
if attach fails).

## Install (new dependencies)

```bash
pnpm add bullmq @socket.io/redis-adapter
# then commit the updated package.json AND pnpm-lock.yaml
```

- `bullmq` ^5
- `@socket.io/redis-adapter` ^8 (compatible with socket.io ^4)

CI type-checks against the real package types (no Prisma-style stub needed), so
the lockfile must include both before CI runs.

## Not verified here

The queue and adapter are **type-checked** but not runtime-verified in this
environment (no Redis). The pure evaluation/detection core remains fully
unit-tested; queue/adapter wiring is integration glue to validate in staging.
