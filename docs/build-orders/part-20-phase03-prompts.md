# Part 20 - Phase 03: Sync Script Development

**Purpose:** Create the Python sync script that transfers data from SQLite (local) to PostgreSQL (Railway cloud), filtering by timeframes.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 03 Prompt

```
# Part 20 - Phase 03: Sync Script Development

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-2 are complete.

This phase creates the Python sync script that transfers data from SQLite (local) to PostgreSQL (Railway cloud), filtering by timeframes.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 4.3 (Timeframe Categorization), Section 6.3 (Data Storage Rules)
- `part-20-implementation-plan.md` - Phase 3 details

## Prerequisites
- Phase 1 completed (SQL schemas exist)
- Phase 2 completed (MQL5 Service writing to SQLite)
- PostgreSQL database on Railway with TimescaleDB extension

## Your Task
Create the Python sync script and supporting modules.

## Files to Create

### 1. `sync/config.py`
Create configuration module:
```python
SQLITE_PATH = "C:\\MT5Data\\trading_data.db"  # Or from env var
POSTGRESQL_URI = os.getenv("POSTGRESQL_URI")  # Railway connection string

SYMBOLS = [
    "AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
    "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
    "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"
]

TIMEFRAMES = ["M5", "M15", "M30", "H1", "H2", "H4", "H8", "H12", "D1"]

SYNC_INTERVAL_SECONDS = 30
MAX_ROWS_PER_TABLE = 10000
```

### 2. `sync/timeframe_filter.py`
Create timeframe filtering logic:
- `TIMEFRAME_DIVISORS` dict mapping timeframe to minutes
- `filter_by_timeframe(rows, timeframe)` function:
  - M5: minutes divisible by 5 (00, 05, 10, ...)
  - M15: minutes divisible by 15 (00, 15, 30, 45)
  - M30: minutes divisible by 30 (00, 30)
  - H1: minute == 0 (on the hour)
  - H2: minute == 0 AND hour % 2 == 0
  - H4: minute == 0 AND hour % 4 == 0
  - H8: minute == 0 AND hour % 8 == 0
  - H12: minute == 0 AND hour % 12 == 0
  - D1: hour == 0 AND minute == 0 (midnight)
- `get_latest_timeframe_timestamp(timeframe)` - get most recent valid timestamp

### 3. `sync/db_connections.py`
Create database connection management:
- `get_sqlite_connection()` - returns sqlite3.Connection
- `get_postgresql_connection()` - returns connection from psycopg2 pool
- `return_postgresql_connection(conn)` - returns connection to pool
- Use connection pooling for PostgreSQL (SimpleConnectionPool)
- Handle connection errors gracefully

### 4. `sync/sync_to_postgresql.py`
Create main sync script with DataSyncer class:
- `__init__`: Initialize last_sync_timestamps dict, load from sync_state.json
- `load_sync_state()`: Load timestamps from JSON file
- `save_sync_state()`: Save timestamps to JSON file
- `sync_symbol(symbol)`: Main sync logic for one symbol
  - Query SQLite for rows > last_sync_timestamp
  - For each timeframe, filter rows and insert into PostgreSQL
  - Update last_sync_timestamp
- `insert_to_postgresql(conn, table_name, rows)`:
  - Use execute_batch for efficiency
  - Handle UPSERT with ON CONFLICT DO UPDATE
  - Convert Unix timestamp to PostgreSQL TIMESTAMPTZ
- `enforce_row_limit(conn, table_name)`:
  - Delete oldest rows if count > MAX_ROWS_PER_TABLE
- `run()`: Sync all symbols, save state, log completion
- Add `if __name__ == "__main__"` block

### 5. `sync/requirements.txt`
```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
```

## Important Notes
- Sync script runs via cron every 30 seconds on Contabo VPS
- Handle network failures gracefully (retry logic)
- Log all sync operations for debugging
- Dynamic indicators (fractals, trendlines) only store latest values - older = NULL
- Use batch inserts for performance

## Success Criteria
- [ ] All Python files pass syntax check
- [ ] Sync script connects to both SQLite and PostgreSQL
- [ ] Timeframe filtering correctly categorizes data
- [ ] Data appears in correct PostgreSQL tables
- [ ] Sync state persisted between runs
- [ ] Row limit enforced (max 10,000 per table)
- [ ] Errors logged but don't crash the script

## Testing Commands
```bash
# Test sync script manually
cd sync
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python sync_to_postgresql.py

# Verify data in PostgreSQL
psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
```

## Commit Instructions
After creating all files, commit with message:
```
feat(sync): add SQLite to PostgreSQL sync script

- Create DataSyncer class for reliable data transfer
- Implement timeframe filtering for 9 timeframes
- Add database connection pooling
- Persist sync state between runs
- Handle errors gracefully with logging
```
```

---

## Next Step

After Phase 03, proceed to `part-20-phase04-prompts.md` (Next.js API Routes).
