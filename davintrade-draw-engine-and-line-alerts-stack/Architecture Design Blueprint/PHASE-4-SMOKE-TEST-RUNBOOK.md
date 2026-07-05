# Phase 4 end-to-end smoke test — manual runbook

Verifies architecture doc §7 Phase 4's "Remaining work" item 5: draw a line, cross it
with live price, confirm delivery. Requires real infrastructure (Docker or the actual
Contabo VPS + a reachable Redis + Postgres) — none of which was available in the
environment this gap was closed in, so this was not run live; see "What was actually
verified" below for what was.

## Prerequisites

- Docker Desktop running (for local Postgres + Redis), **or** run directly against the
  real Contabo VPS + production `REDIS_URL`/`DATABASE_URL`.
- `mt5-service/venv` with `pip install -r requirements.txt` (now includes `redis==5.0.1`).
- Root `npm install` (already satisfied if `npm run worker:alerts` has been used before).

## Steps

```bash
# 1. Local infra
docker compose up -d postgres redis

# 2. Apply the Drawing/DrawingAlert migrations against it
npx prisma migrate deploy

# 3. Start the real alert worker
REDIS_URL=redis://localhost:6379 DATABASE_URL=<your local postgres> \
  npm run worker:alerts
# Expect: "[alert-worker] subscribed to prices:* and alerts:changed (queue: on)"

# 4. In the app (or directly via Prisma Studio), create:
#    - a Drawing: type HLINE, symbol XAUUSD, timeframe M5, anchors [{time:0, price: <X>}]
#    - an Alert: symbol XAUUSD, timeframe M5, alertType PRICE_TOUCH_LINE, isActive true
#    - a DrawingAlert linking them: targetLevel "line", direction "either"
#    Then publish `alerts:changed` (or restart the worker) so it reloads.

# 5. Start mt5-service pointed at the SAME REDIS_URL and let a live (or mocked, via
#    USE_MOCK_MT5=true per docker-compose.yml) MT5 feed cross price X on XAUUSD/M5.

# 6. Confirm:
#    - Worker log: "[alert-worker] ..." shows the watch evaluated
#    - New Notification row for the test user (type ALERT)
#    - Alert.triggerCount incremented, lastTriggered set
#    - (If the web process's startAlertDeliveryBridge is running) a Socket.IO push
#      and, if Resend is configured, an email
```

## What was actually verified (2026-07-05, gap-closing session)

Live cross-process testing wasn't possible in that environment: no Docker, no root
access to install a real `redis-server`, and the project's live Railway Postgres was
unreachable (TCP connects, but the Postgres protocol handshake fails — looks paused,
not a code issue). What *was* verified directly against source, with the actual code
(no reimplementation):

- `app/redis_pub.py`'s publish payload matches `lib/alert-engine/types.ts`'s
  `PriceEvent` exactly (field-by-field, mocked-Redis unit tests:
  `mt5-service/tests/test_redis_pub.py`, 3/3 passing).
- The existing `lib/alert-engine/{detect,evaluator,watches,notify-bridge}.test.ts`
  suite (23/23 passing, untouched by this change) already covers the DB-shaped
  logic (building an `AlertWatch` from a `Drawing`+`DrawingAlert` row, crossing
  detection, dispatch).
- A `fakeredis`-based TCP smoke test got as far as: Python publishes, `PUBLISH`
  is acknowledged with the correct subscriber count — but `fakeredis`'s TCP server
  does not actually deliver the message across a separate client connection, a
  known limitation of that tool, not of the code under test. This blocked getting a
  fully-live Python→Redis→Node round-trip in this environment; it should work
  against any real Redis (which is what production actually uses).

**Net: the wiring is code-complete and each side is unit-verified in isolation; the
live cross-process round trip described in this runbook is the one thing still worth
running once real infra (Docker, or the Contabo VPS itself) is reachable.**
