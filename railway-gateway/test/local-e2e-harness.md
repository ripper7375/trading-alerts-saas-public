# Local end-to-end harness (SQLite → Push Worker → Gateway → Postgres)

This proves the full Deliverable-3 loop for real (real SQLite file, real Python
process, real NestJS process, real Postgres/Redis) without needing the actual
Railway/Contabo infrastructure, which is out of reach from this environment.

## Prerequisites

1. Docker Desktop running (`docker ps` should not error).
2. Python 3.11 with `pip install requests` (for the Push Worker).
3. Node 18+, and `npm install` run in this `railway-gateway/` directory.

## Steps

```bash
# 1. Start local Postgres + Redis
cd railway-gateway
docker compose up -d

# 2. Push the market_data_v6 table (root app owns this migration)
cd ..
DATABASE_URL=postgresql://postgres:password@localhost:5432/trading_alerts npx prisma migrate deploy

# 3. Generate the Gateway's own Prisma client (generate-only, never migrate — see prisma/schema.prisma)
cd railway-gateway
cp .env.example .env   # then edit DATABASE_URL/REDIS_URL if needed
npx prisma generate
npm run build
API_KEYS=push_worker_v5_localtest npm run start:prod
# leave this running in its own terminal

# 4. In another terminal: build a throwaway xauusd.db and insert one synthetic row
python scripts/seed_local_xauusd_db.py --db /tmp/xauusd_test.db

# 5. Run the real Push Worker against the locally-running Gateway
cd "../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture"
API_GATEWAY_URL=http://localhost:3000 \
BACKFILL_API_KEY=push_worker_v5_localtest \
python -c "
import backfill_worker_api_gateway_v5 as w
w.DB_PATH = __import__('pathlib').Path('/tmp/xauusd_test.db')
w.main()
"
# Ctrl+C after it logs '✅ Pushed 1 rows' (or watch push_worker.log)
```

## What to check

- **synced_at stamped**: `sqlite3 /tmp/xauusd_test.db "SELECT timestamp, timeframe, synced_at FROM market_data"` — `synced_at` should be non-null.
- **Row landed in Postgres**: `npx prisma studio` (root app) or
  `psql postgresql://postgres:password@localhost:5432/trading_alerts -c "SELECT symbol, timeframe, timestamp, close FROM market_data_v6;"`
- **Idempotency**: re-run step 5 with the same row unchanged. Row count in
  `market_data_v6` for that `(symbol, timeframe, timestamp)` must stay at 1.
- **400**: POST a payload with `high < low` via curl; expect
  `{"statusCode":400, "message": "Invalid OHLC: ..."}`.
- **401/403**: POST with `Authorization: Bearer wrong_key`; expect 401.
- **429**: loop >100 requests in 60s against `/api/v1/market-data`; expect a
  429 with a `Retry-After`-style message once the limit is hit.
- **5xx**: stop the `redis` container mid-request (`docker compose stop redis`)
  and POST again; expect a 5xx (queue.add() rejecting) rather than a hang.

## Cleanup

```bash
docker compose down -v
rm /tmp/xauusd_test.db
```
