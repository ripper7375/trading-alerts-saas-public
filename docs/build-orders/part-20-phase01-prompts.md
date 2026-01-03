# Part 20 - Phase 01: Database Schema Setup

**Purpose:** Create the database schemas for both SQLite (local MT5 machine) and PostgreSQL (Railway cloud).

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 01 Prompt

```
# Part 20 - Phase 01: Database Schema Setup

## Context
I'm implementing Part 20 of Trading Alerts SaaS, which replaces Part 6 (Flask MT5 Service + Python MT5 API) with a new architecture: MQL5 Service → SQLite → Sync → PostgreSQL.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 6 (Data Model)
- `part-20-implementation-plan.md` - Phase 1 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Schema references

## Your Task
Create the database schemas for both SQLite (local MT5 machine) and PostgreSQL (Railway cloud).

## Files to Create

### 1. `sql/sqlite_schema.sql`
Create SQLite schema with:
- 15 tables (one per symbol): AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD
- 14 columns per table:
  - `timestamp` INTEGER PRIMARY KEY (Unix timestamp)
  - `open`, `high`, `low`, `close` REAL NOT NULL
  - `fractals` TEXT (JSON)
  - `horizontal_trendlines` TEXT (JSON)
  - `diagonal_trendlines` TEXT (JSON)
  - `momentum_candles` TEXT (JSON)
  - `keltner_channels` TEXT (JSON)
  - `tema`, `hrma`, `smma` REAL
  - `zigzag` TEXT (JSON)
- Create index on timestamp for each table

### 2. `sql/postgresql_schema.sql`
Create PostgreSQL schema with:
- 135 tables (15 symbols × 9 timeframes)
- Table naming: `{symbol}_{timeframe}` all lowercase (e.g., `eurusd_m5`, `eurusd_h1`)
- Timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
- Same 14 columns but use:
  - `timestamp` TIMESTAMPTZ PRIMARY KEY
  - `DOUBLE PRECISION` instead of REAL
  - `JSONB` instead of TEXT for JSON columns
- Include `CREATE EXTENSION IF NOT EXISTS timescaledb;`

### 3. `sql/timescaledb_setup.sql`
Create TimescaleDB configuration:
- Convert all 135 tables to hypertables using `create_hypertable()`
- Add retention policies (calculate based on 10,000 rows per timeframe):
  - M5: ~35 days, M15: ~105 days, M30: ~210 days
  - H1: ~417 days, H2: ~834 days, H4: ~1667 days
  - H8: ~3333 days, H12: ~5000 days, D1: ~10000 days
- Add compression policies (compress after 7 days)
- Create descending timestamp indexes

### 4. `sql/seed_data.sql`
Create test seed data:
- Insert 100 sample rows for EURUSD in SQLite format
- Include realistic OHLC values for EURUSD (around 1.0850)
- Include sample JSON for fractals, trendlines, and indicators
- Add comments explaining the data structure

## Success Criteria
- [ ] All SQL files are syntactically valid
- [ ] SQLite schema creates 15 tables with correct columns
- [ ] PostgreSQL schema creates 135 tables with correct naming
- [ ] TimescaleDB hypertables configured correctly
- [ ] Seed data insertable without errors

## Commit Instructions
After creating all files, commit with message:
```
feat(db): add Part 20 database schemas for SQLite and PostgreSQL

- Add SQLite schema for 15 symbol tables (local MT5 data)
- Add PostgreSQL schema for 135 timeframe tables (cloud)
- Configure TimescaleDB hypertables and retention policies
- Add seed data for development testing
```
```

---

## Next Step

After Phase 01, proceed to `part-20-phase02-prompts.md` (MQL5 Service Development).
