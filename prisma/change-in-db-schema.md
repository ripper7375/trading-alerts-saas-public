OLD ARCHITECTURE :


Concretely, in Postgres today you'll have two independent tables:

MarketData — the old 63-column schema, unchanged, still there for whatever (if anything) still reads/writes it.

market_data_v6 — the new table, only written to by the Railway Gateway's queue consumer and only read by alert-checker.ts for XAUUSD.

They don't share rows, don't share a foreign key, and nothing in this work drops, renames, or migrates data out of the old table. That was deliberate — per the plan we discussed, the old model represents a different indicator methodology (TEMA/Keltner/Heiken-Ashi/etc.) that the v6 pipeline doesn't produce and isn't meant to replace; MarketDataV6 exists purely as the new pipeline's own downstream store.

===============================================

CURRENT ARCHITECTURE :


Old EA v2.27 schema fully decommissioned (Option A + archive note):

Dropped the old 63-column MarketData Prisma model from prisma/schema.prisma + a new DROP TABLE migration (20260705010000_drop_market_data).

Cleaned up every reference: lib/db/seed.ts, lib/db/prisma.ts, types/prisma-stubs.d.ts (removed the stale MarketData interface/delegate), and the two test files that asserted prisma.marketData existed (__tests__/lib/db/prisma.test.ts, __tests__/lib/db/seed.test.ts).

Archive note added: backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/architecture-document/old-architecture/README.md — documents that EA v2.25–v2.27 and their Postgres schema are superseded by the v6 pipeline, with the explicit caveat that stopping any actual live EA process on a VPS is outside what I can do from here.

Verified clean: 87/87 tests pass in the touched files; full root type-check shows the exact same 32 pre-existing errors as before (all in the untouched prototype subproject + one unrelated Stripe file) — zero new errors, and zero remaining references to MarketData/prisma-stubs/schema.prisma in the error list.

Left untouched, as discussed: frontend/'s independent Prisma schema (982 vs 1264 lines — a genuinely different file, not a mirror) and lib/tier/constants.ts/types/indicator.ts (the live tier-gating system) — dropping those was explicitly the "full cleanup" option you correctly flagged as too risky.


# Decommissioned — old-architecture

**Status: decommissioned 2026-07-05.**

Everything in this folder (`SimpleDataCollector_v2_25/v2_26/v2_27_API_GATEWAY.mq5/.ex5`,
`backfill_worker_api_gateway_v2.py`, `backfill_worker_api_gateway_v3.py`) belongs to the
pre-v6 EA lineage — the tema/hrma/smma, Keltner Channel, Heiken Ashi, 8-level
support/resistance, zigzag_high/low, pinbar, and fractal diagonal/horizontal
indicator set (EA v2.25–v2.27).

It has been superseded by the v6 pipeline in
[`../../v2_29_data_pipeline_architecture/`](../../v2_29_data_pipeline_architecture/)
(12 MQL5 indicators, XAUUSD M5+M15, `market_data`'s 79-field
centroid-regression/EDT-channel/ZigZag-category schema, feeding
`backfill_worker_api_gateway_v5.py` → the Railway Gateway). See
[`gateway_contract_market_data.schema.json`](../../v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json)
for the current contract.

The matching Postgres side — the old 63-column `MarketData` Prisma model
(`tema`/`hrma`/`smma`/`kc_*`/`sr_*`/`ha_*`/`zigzag_high`/`zigzag_low`/`pinbar`/etc.)
— was dropped from the live Next.js app's schema in migration
`20260705010000_drop_market_data`; it was never read or written by any live
`app/api` route. `MarketDataV6` (added in `20260705000000_add_market_data_v6`)
is its replacement's downstream store, not a data migration of it — no rows
carry forward.

**What this note does *not* cover:** an actual running EA v2.27 process on a
live MT5 terminal, if one still exists on a Contabo VPS. Stopping that is an
operator action outside this repository's reach — this note only records
that the repo-side design has moved on.