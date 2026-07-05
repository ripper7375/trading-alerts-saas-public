# Railway Gateway — v6 XAUUSD Pipeline

NestJS ingest layer for `backend-stack-c`'s v6 XAUUSD data pipeline. Receives
validated `market_data` rows from the Push Worker (and, optionally, the
legacy Relay), validates them against
[`gateway_contract_market_data.schema.json`](../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json),
and idempotently upserts them into `market_data_v6` — a new table, additive
to the root Next.js app's Postgres database, that the alert engine
(`lib/jobs/alert-checker.ts`) reads for XAUUSD.

Full build spec:
[`ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md`](../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md).

## Local development

```bash
npm install
docker compose up -d          # local Postgres + Redis
cp .env.example .env          # edit DATABASE_URL to point at the root app's DB
npx prisma generate           # typed client only — see prisma/schema.prisma's note
npm run start:dev
```

## Regenerating the DTO

The 79-field `MarketDataDto` (`src/gateway/dto/market-data.dto.ts`) is
generated, not hand-maintained:

```bash
npm run generate:dto
```

Re-run this whenever `gateway_contract_market_data.schema.json` changes.
`test/dto-contract.spec.ts` fails CI if the two drift apart.

## Tests

```bash
npm test           # unit + contract specs (Prisma/Bull mocked, no live DB)
npm run test:e2e   # supertest against the real Nest app (Prisma/Bull mocked)
```

See [`test/local-e2e-harness.md`](test/local-e2e-harness.md) for the
real-process (SQLite → Push Worker → this Gateway → Postgres) verification
that isn't part of the Jest suite.

## Deployment (doc §7)

1. **Build**: this directory.
2. **Staging**: `railway up --environment staging` after `railway add redis`
   and setting `API_KEYS`/`DATABASE_URL`.
3. **Point one real sender**: set the Push Worker's `API_GATEWAY_URL` to the
   staging URL and run it against a small time window first.
4. **Verify**: doc §7.4 checklist — 200s for real rows, no unexpected 400s,
   idempotent re-POST, 401/403/429/5xx each manually exercised once.
5. **Go live**: point `API_GATEWAY_URL` (and the Relay's `RAILWAY_URL`, if in
   use) at the production deployment.

Steps 2–5 require a real Railway project and are **not something this repo
change can execute on its own** — they're an operator runbook.
