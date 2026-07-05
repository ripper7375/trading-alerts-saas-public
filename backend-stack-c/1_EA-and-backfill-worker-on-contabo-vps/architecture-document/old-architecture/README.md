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
