# Part 20: SQLite + Sync to PostgreSQL - Implementation Plan

**Document Type:** Implementation Plan
**Version:** 1.0.0
**Created:** 2026-01-03
**Supersedes:** Part 6 (Flask MT5 Service + Python MT5 API)
**Reference:** part-20-architecture-design.md

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Phase Dependencies](#phase-dependencies)
3. [Phase 1: Database Schema Setup](#phase-1-database-schema-setup)
4. [Phase 2: MQL5 Service Development](#phase-2-mql5-service-development)
5. [Phase 3: Sync Script Development](#phase-3-sync-script-development)
6. [Phase 4: Next.js API Routes](#phase-4-nextjs-api-routes)
7. [Phase 5: Redis Caching Layer](#phase-5-redis-caching-layer)
8. [Phase 6: Confluence Score System](#phase-6-confluence-score-system)
9. [Phase 7: Testing Framework](#phase-7-testing-framework)
10. [Phase 8: E2E Testing Migration](#phase-8-e2e-testing-migration)
11. [Phase 9: Deployment & Cutover](#phase-9-deployment--cutover)
12. [File Inventory](#file-inventory)
13. [Rollback Plan](#rollback-plan)

---

## 1. Implementation Overview

### 1.1 Total Scope

| Metric | Count |
|--------|-------|
| Total Phases | 9 |
| Total Files | ~45 files |
| MQL5 Files | 3 files |
| Python Files | 8 files |
| TypeScript Files | 25 files |
| SQL Files | 4 files |
| Config Files | 5 files |

### 1.2 Phase Summary

| Phase | Description | Files | Dependencies |
|-------|-------------|-------|--------------|
| 1 | Database Schema Setup | 4 | None |
| 2 | MQL5 Service Development | 3 | Phase 1 |
| 3 | Sync Script Development | 5 | Phases 1, 2 |
| 4 | Next.js API Routes | 8 | Phase 3 |
| 5 | Redis Caching Layer | 4 | Phase 4 |
| 6 | Confluence Score System | 6 | Phases 4, 5 |
| 7 | Testing Framework | 10 | Phases 1-6 |
| 8 | E2E Testing Migration | 3 | Phase 7 |
| 9 | Deployment & Cutover | 2 | All previous |

### 1.3 Context Window Management

Each phase is designed to stay within AI context limits:
- **Max files per phase:** 10
- **Max code per phase:** ~15,000 tokens
- **Clear phase boundaries:** Each phase produces testable output
- **Incremental progress:** Each phase builds on previous work

---

## 2. Phase Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                  PHASE DEPENDENCY GRAPH                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Database Schema                                   │
│     │                                                       │
│     ├──► Phase 2: MQL5 Service                             │
│     │       │                                               │
│     │       └──► Phase 3: Sync Script                      │
│     │               │                                       │
│     │               └──► Phase 4: API Routes               │
│     │                       │                               │
│     │                       ├──► Phase 5: Redis Caching    │
│     │                       │       │                       │
│     │                       └───────┴──► Phase 6: Confluence│
│     │                                       │               │
│     │                                       ▼               │
│     └────────────────────────────► Phase 7: Testing         │
│                                       │                     │
│                                       └──► Phase 8: E2E     │
│                                               │             │
│                                               └──► Phase 9  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Prerequisites Before Starting

1. **PostgreSQL Database:** Railway PostgreSQL instance created
2. **Redis Instance:** Railway Redis instance created
3. **Contabo VPS:** Windows VPS with 15 MT5 terminals running
4. **TimescaleDB Extension:** Installed on PostgreSQL
5. **MT5 Indicators:** All custom indicators compiled and attached to charts

---

## 3. Phase 1: Database Schema Setup

### 3.1 Objective

Create database schemas for SQLite (local) and PostgreSQL (cloud) with proper indexing and TimescaleDB hypertables.

### 3.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `sql/sqlite_schema.sql` | SQLite schema for 15 symbol tables |
| 2 | `sql/postgresql_schema.sql` | PostgreSQL schema for 135 tables |
| 3 | `sql/timescaledb_setup.sql` | TimescaleDB hypertables and policies |
| 4 | `sql/seed_data.sql` | Test data for development |

### 3.3 File 1: SQLite Schema

**File:** `sql/sqlite_schema.sql`

```sql
-- SQLite Schema for MT5 Data Collection
-- One table per symbol, 14 columns each

-- Template for all 15 symbol tables
-- Symbols: AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD,
--          NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD

CREATE TABLE IF NOT EXISTS AUDJPY (
    timestamp       INTEGER PRIMARY KEY,
    open            REAL NOT NULL,
    high            REAL NOT NULL,
    low             REAL NOT NULL,
    close           REAL NOT NULL,
    fractals        TEXT,
    horizontal_trendlines TEXT,
    diagonal_trendlines   TEXT,
    momentum_candles      TEXT,
    keltner_channels      TEXT,
    tema            REAL,
    hrma            REAL,
    smma            REAL,
    zigzag          TEXT
);

CREATE INDEX IF NOT EXISTS idx_audjpy_ts ON AUDJPY(timestamp);

-- Repeat for remaining 14 symbols...
CREATE TABLE IF NOT EXISTS AUDUSD (...);
CREATE TABLE IF NOT EXISTS BTCUSD (...);
-- ... (all 15 tables)
```

### 3.4 File 2: PostgreSQL Schema

**File:** `sql/postgresql_schema.sql`

```sql
-- PostgreSQL Schema for Trading Alerts SaaS
-- 135 tables: 15 symbols × 9 timeframes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Table naming convention: {symbol}_{timeframe}
-- All lowercase for PostgreSQL compatibility

-- AUDJPY tables (9 timeframes)
CREATE TABLE IF NOT EXISTS audjpy_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY,
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    fractals JSONB,
    horizontal_trendlines JSONB,
    diagonal_trendlines JSONB,
    momentum_candles JSONB,
    keltner_channels JSONB,
    tema DOUBLE PRECISION,
    hrma DOUBLE PRECISION,
    smma DOUBLE PRECISION,
    zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_m15 (...);
CREATE TABLE IF NOT EXISTS audjpy_m30 (...);
CREATE TABLE IF NOT EXISTS audjpy_h1 (...);
CREATE TABLE IF NOT EXISTS audjpy_h2 (...);
CREATE TABLE IF NOT EXISTS audjpy_h4 (...);
CREATE TABLE IF NOT EXISTS audjpy_h8 (...);
CREATE TABLE IF NOT EXISTS audjpy_h12 (...);
CREATE TABLE IF NOT EXISTS audjpy_d1 (...);

-- Repeat for all 15 symbols (135 tables total)
```

### 3.5 File 3: TimescaleDB Setup

**File:** `sql/timescaledb_setup.sql`

```sql
-- TimescaleDB Configuration
-- Run after postgresql_schema.sql

-- Convert tables to hypertables
SELECT create_hypertable('audjpy_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_m15', 'timestamp', if_not_exists => TRUE);
-- ... (all 135 tables)

-- Add retention policies (10,000 rows ≈ varying time depending on timeframe)
SELECT add_retention_policy('audjpy_m5', INTERVAL '35 days');
SELECT add_retention_policy('audjpy_m15', INTERVAL '105 days');
SELECT add_retention_policy('audjpy_m30', INTERVAL '210 days');
SELECT add_retention_policy('audjpy_h1', INTERVAL '417 days');
SELECT add_retention_policy('audjpy_h2', INTERVAL '834 days');
SELECT add_retention_policy('audjpy_h4', INTERVAL '1667 days');
SELECT add_retention_policy('audjpy_h8', INTERVAL '3333 days');
SELECT add_retention_policy('audjpy_h12', INTERVAL '5000 days');
SELECT add_retention_policy('audjpy_d1', INTERVAL '10000 days');

-- Add compression policies for older data
ALTER TABLE audjpy_m5 SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = ''
);
SELECT add_compression_policy('audjpy_m5', INTERVAL '7 days');
-- ... (all tables)

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audjpy_m5_ts_desc ON audjpy_m5(timestamp DESC);
-- ... (all tables)
```

### 3.6 Success Criteria

- [ ] SQLite database created with 15 tables
- [ ] PostgreSQL database created with 135 tables
- [ ] TimescaleDB hypertables configured
- [ ] Retention policies active
- [ ] Indexes created
- [ ] Test query returns expected schema

### 3.7 Commit Message

```
feat(db): add Part 20 database schemas for SQLite and PostgreSQL

- Add SQLite schema for 15 symbol tables (local MT5 data)
- Add PostgreSQL schema for 135 timeframe tables (cloud)
- Configure TimescaleDB hypertables and retention policies
- Add seed data for development testing
```

---

## 4. Phase 2: MQL5 Service Development

### 4.1 Objective

Create MQL5 Service that runs inside MT5 terminals, reads indicator buffers, and writes to SQLite every 30 seconds.

### 4.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `mql5/Services/DataCollector.mq5` | Main MQL5 Service |
| 2 | `mql5/Include/IndicatorBuffers.mqh` | Indicator buffer reading functions |
| 3 | `mql5/Include/SymbolUtils.mqh` | Symbol suffix handling utilities |

### 4.3 File 1: MQL5 Service

**File:** `mql5/Services/DataCollector.mq5`

```mql5
//+------------------------------------------------------------------+
//|                                              DataCollector.mq5    |
//|                        Trading Alerts SaaS - Part 20             |
//|                                                                   |
//| MQL5 Service for collecting indicator data and storing to SQLite |
//+------------------------------------------------------------------+
#property service
#property copyright "Trading Alerts SaaS"
#property version   "1.00"

#include <IndicatorBuffers.mqh>
#include <SymbolUtils.mqh>

input int    CollectionInterval = 30;    // Data collection interval (seconds)
input string DatabasePath = "C:\\MT5Data\\trading_data.db";

// Indicator handles
int h_fractal, h_hline, h_dline, h_momentum, h_keltner;
int h_tema, h_hrma, h_smma, h_zigzag;

//+------------------------------------------------------------------+
//| Service program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
    // Initialize database
    int db = DatabaseOpen(DatabasePath, DATABASE_OPEN_READWRITE | DATABASE_OPEN_CREATE);
    if(db == INVALID_HANDLE)
    {
        Print("Failed to open database: ", GetLastError());
        return;
    }

    // Create table if not exists
    string symbol = NormalizeSymbol(_Symbol);
    CreateTableIfNotExists(db, symbol);

    // Initialize indicator handles
    if(!InitializeIndicators())
    {
        Print("Failed to initialize indicators");
        DatabaseClose(db);
        return;
    }

    Print("DataCollector Service started for ", symbol);

    // Main collection loop
    while(!IsStopped())
    {
        CollectAndStoreData(db, symbol);
        Sleep(CollectionInterval * 1000);
    }

    // Cleanup
    ReleaseIndicators();
    DatabaseClose(db);
    Print("DataCollector Service stopped");
}

//+------------------------------------------------------------------+
//| Initialize all indicator handles                                  |
//+------------------------------------------------------------------+
bool InitializeIndicators()
{
    h_fractal = iCustom(_Symbol, PERIOD_CURRENT, "Fractal Horizontal Line_V5");
    h_hline = iCustom(_Symbol, PERIOD_CURRENT, "Fractal Horizontal Line_V5");
    h_dline = iCustom(_Symbol, PERIOD_CURRENT, "Fractal Diagonal Line_V4");
    h_momentum = iCustom(_Symbol, PERIOD_CURRENT, "Body Size Momentum Candle_V2");
    h_keltner = iCustom(_Symbol, PERIOD_CURRENT, "Keltner Channel_ATF_10 Bands");
    h_tema = iCustom(_Symbol, PERIOD_CURRENT, "TEMA_HRMA_SMA-SMMA_Modified Buffers");
    h_hrma = iCustom(_Symbol, PERIOD_CURRENT, "TEMA_HRMA_SMA-SMMA_Modified Buffers");
    h_smma = iCustom(_Symbol, PERIOD_CURRENT, "TEMA_HRMA_SMA-SMMA_Modified Buffers");
    h_zigzag = iCustom(_Symbol, PERIOD_CURRENT, "ZigZagColor & MarketStructure_JSON Export_V27_TXT Input");

    return (h_fractal != INVALID_HANDLE && h_hline != INVALID_HANDLE &&
            h_dline != INVALID_HANDLE && h_momentum != INVALID_HANDLE);
}

//+------------------------------------------------------------------+
//| Collect data and store to SQLite                                  |
//+------------------------------------------------------------------+
void CollectAndStoreData(int db, string symbol)
{
    MqlRates rates[];
    if(CopyRates(_Symbol, PERIOD_CURRENT, 0, 1, rates) < 1)
    {
        Print("Failed to copy rates");
        return;
    }

    // Read indicator buffers
    string fractals_json = GetFractalsJSON(h_fractal);
    string hlines_json = GetHorizontalLinesJSON(h_hline);
    string dlines_json = GetDiagonalLinesJSON(h_dline);
    string momentum_json = GetMomentumJSON(h_momentum);
    string keltner_json = GetKeltnerJSON(h_keltner);
    double tema_value = GetIndicatorValue(h_tema, 0);
    double hrma_value = GetIndicatorValue(h_hrma, 1);
    double smma_value = GetIndicatorValue(h_smma, 2);
    string zigzag_json = GetZigZagJSON(h_zigzag);

    // Insert into database
    string sql = StringFormat(
        "INSERT OR REPLACE INTO %s "
        "(timestamp, open, high, low, close, fractals, horizontal_trendlines, "
        "diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag) "
        "VALUES (%d, %f, %f, %f, %f, '%s', '%s', '%s', '%s', '%s', %f, %f, %f, '%s')",
        symbol, (int)rates[0].time,
        rates[0].open, rates[0].high, rates[0].low, rates[0].close,
        fractals_json, hlines_json, dlines_json, momentum_json, keltner_json,
        tema_value, hrma_value, smma_value, zigzag_json
    );

    if(!DatabaseExecute(db, sql))
    {
        Print("Database insert failed: ", GetLastError());
    }
}
```

### 4.4 File 2: Indicator Buffers Include

**File:** `mql5/Include/IndicatorBuffers.mqh`

```mql5
//+------------------------------------------------------------------+
//|                                           IndicatorBuffers.mqh    |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"

//+------------------------------------------------------------------+
//| Get single indicator value                                        |
//+------------------------------------------------------------------+
double GetIndicatorValue(int handle, int buffer_index)
{
    double buffer[];
    if(CopyBuffer(handle, buffer_index, 0, 1, buffer) < 1)
        return EMPTY_VALUE;
    return buffer[0];
}

//+------------------------------------------------------------------+
//| Get Fractals as JSON                                              |
//+------------------------------------------------------------------+
string GetFractalsJSON(int handle)
{
    double peaks[], bottoms[];
    CopyBuffer(handle, 0, 0, 100, peaks);    // Buffer 0: peaks
    CopyBuffer(handle, 1, 0, 100, bottoms);  // Buffer 1: bottoms

    string json = "{\"peaks\":[";
    // Build JSON array of non-empty peaks
    for(int i = 0; i < ArraySize(peaks); i++)
    {
        if(peaks[i] != EMPTY_VALUE)
        {
            json += StringFormat("{\"index\":%d,\"price\":%.5f},", i, peaks[i]);
        }
    }
    json = StringSubstr(json, 0, StringLen(json)-1) + "],\"bottoms\":[";
    // Build JSON array of non-empty bottoms
    for(int i = 0; i < ArraySize(bottoms); i++)
    {
        if(bottoms[i] != EMPTY_VALUE)
        {
            json += StringFormat("{\"index\":%d,\"price\":%.5f},", i, bottoms[i]);
        }
    }
    json = StringSubstr(json, 0, StringLen(json)-1) + "]}";
    return json;
}

// Additional functions for other indicators...
string GetHorizontalLinesJSON(int handle) { /* ... */ }
string GetDiagonalLinesJSON(int handle) { /* ... */ }
string GetMomentumJSON(int handle) { /* ... */ }
string GetKeltnerJSON(int handle) { /* ... */ }
string GetZigZagJSON(int handle) { /* ... */ }
```

### 4.5 File 3: Symbol Utilities

**File:** `mql5/Include/SymbolUtils.mqh`

```mql5
//+------------------------------------------------------------------+
//|                                                SymbolUtils.mqh    |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"

//+------------------------------------------------------------------+
//| Normalize symbol by removing broker-specific suffixes             |
//+------------------------------------------------------------------+
string NormalizeSymbol(string broker_symbol)
{
    string suffixes[] = {".i", ".pro", "m", ".raw", ".std", ".e", ".z"};
    string normalized = broker_symbol;

    for(int i = 0; i < ArraySize(suffixes); i++)
    {
        int pos = StringFind(normalized, suffixes[i]);
        if(pos > 0)
        {
            normalized = StringSubstr(normalized, 0, pos);
            break;
        }
    }

    // Convert to uppercase for consistency
    StringToUpper(normalized);
    return normalized;
}

//+------------------------------------------------------------------+
//| Check if symbol is in supported list                              |
//+------------------------------------------------------------------+
bool IsSymbolSupported(string symbol)
{
    string supported[] = {
        "AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
        "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
        "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"
    };

    string normalized = NormalizeSymbol(symbol);
    for(int i = 0; i < ArraySize(supported); i++)
    {
        if(supported[i] == normalized)
            return true;
    }
    return false;
}

//+------------------------------------------------------------------+
//| Create table if not exists                                        |
//+------------------------------------------------------------------+
bool CreateTableIfNotExists(int db, string symbol)
{
    string sql = StringFormat(
        "CREATE TABLE IF NOT EXISTS %s ("
        "timestamp INTEGER PRIMARY KEY, "
        "open REAL NOT NULL, "
        "high REAL NOT NULL, "
        "low REAL NOT NULL, "
        "close REAL NOT NULL, "
        "fractals TEXT, "
        "horizontal_trendlines TEXT, "
        "diagonal_trendlines TEXT, "
        "momentum_candles TEXT, "
        "keltner_channels TEXT, "
        "tema REAL, "
        "hrma REAL, "
        "smma REAL, "
        "zigzag TEXT"
        ")",
        symbol
    );
    return DatabaseExecute(db, sql);
}
```

### 4.6 Success Criteria

- [ ] MQL5 Service compiles without errors
- [ ] Service starts in MT5 terminal (Tools → Services)
- [ ] SQLite database created with correct schema
- [ ] Data written every 30 seconds
- [ ] All 13 indicator values captured correctly
- [ ] Symbol suffix stripped (EURUSD.i → EURUSD)

### 4.7 Commit Message

```
feat(mql5): add DataCollector service for MT5 indicator data

- Add MQL5 Service that runs continuously in MT5 terminal
- Read indicator buffers using CopyBuffer()
- Write to SQLite every 30 seconds
- Handle symbol suffix normalization
- Support all 13 indicators
```

---

## 5. Phase 3: Sync Script Development

### 5.1 Objective

Create Python sync script that transfers data from SQLite to PostgreSQL, filtering by timeframes.

### 5.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `sync/sync_to_postgresql.py` | Main sync script |
| 2 | `sync/timeframe_filter.py` | Timeframe filtering logic |
| 3 | `sync/db_connections.py` | Database connection management |
| 4 | `sync/config.py` | Configuration settings |
| 5 | `sync/requirements.txt` | Python dependencies |

### 5.3 File 1: Main Sync Script

**File:** `sync/sync_to_postgresql.py`

```python
#!/usr/bin/env python3
"""
SQLite to PostgreSQL Sync Script
Part 20 - Trading Alerts SaaS

Syncs indicator data from local SQLite to cloud PostgreSQL.
Filters data into appropriate timeframe tables.
"""

import sqlite3
import psycopg2
from psycopg2.extras import execute_batch
import logging
from datetime import datetime
from typing import List, Dict, Any

from config import SQLITE_PATH, POSTGRESQL_URI, SYMBOLS, TIMEFRAMES
from timeframe_filter import filter_by_timeframe
from db_connections import get_sqlite_connection, get_postgresql_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataSyncer:
    def __init__(self):
        self.last_sync_timestamps: Dict[str, int] = {}
        self.load_sync_state()

    def load_sync_state(self):
        """Load last sync timestamps from state file."""
        try:
            with open('sync_state.json', 'r') as f:
                import json
                self.last_sync_timestamps = json.load(f)
        except FileNotFoundError:
            self.last_sync_timestamps = {s: 0 for s in SYMBOLS}

    def save_sync_state(self):
        """Save sync state to file."""
        import json
        with open('sync_state.json', 'w') as f:
            json.dump(self.last_sync_timestamps, f)

    def sync_symbol(self, symbol: str):
        """Sync data for a single symbol."""
        logger.info(f"Syncing {symbol}...")

        sqlite_conn = get_sqlite_connection()
        pg_conn = get_postgresql_connection()

        try:
            # Get new data from SQLite
            cursor = sqlite_conn.cursor()
            last_ts = self.last_sync_timestamps.get(symbol, 0)

            cursor.execute(f"""
                SELECT * FROM {symbol}
                WHERE timestamp > ?
                ORDER BY timestamp ASC
            """, (last_ts,))

            rows = cursor.fetchall()
            if not rows:
                logger.info(f"No new data for {symbol}")
                return

            logger.info(f"Found {len(rows)} new rows for {symbol}")

            # Filter and insert into each timeframe table
            for timeframe in TIMEFRAMES:
                filtered_rows = filter_by_timeframe(rows, timeframe)
                if filtered_rows:
                    self.insert_to_postgresql(
                        pg_conn,
                        f"{symbol.lower()}_{timeframe.lower()}",
                        filtered_rows
                    )

            # Update last sync timestamp
            self.last_sync_timestamps[symbol] = rows[-1][0]  # timestamp column

        finally:
            sqlite_conn.close()
            pg_conn.close()

    def insert_to_postgresql(self, conn, table_name: str, rows: List[tuple]):
        """Insert rows into PostgreSQL table."""
        cursor = conn.cursor()

        # Convert Unix timestamp to PostgreSQL timestamp
        insert_sql = f"""
            INSERT INTO {table_name}
            (timestamp, open, high, low, close, fractals, horizontal_trendlines,
             diagonal_trendlines, momentum_candles, keltner_channels,
             tema, hrma, smma, zigzag)
            VALUES (to_timestamp(%s), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (timestamp) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                fractals = EXCLUDED.fractals,
                horizontal_trendlines = EXCLUDED.horizontal_trendlines,
                diagonal_trendlines = EXCLUDED.diagonal_trendlines,
                momentum_candles = EXCLUDED.momentum_candles,
                keltner_channels = EXCLUDED.keltner_channels,
                tema = EXCLUDED.tema,
                hrma = EXCLUDED.hrma,
                smma = EXCLUDED.smma,
                zigzag = EXCLUDED.zigzag
        """

        execute_batch(cursor, insert_sql, rows)
        conn.commit()
        logger.info(f"Inserted {len(rows)} rows into {table_name}")

    def run(self):
        """Run sync for all symbols."""
        for symbol in SYMBOLS:
            try:
                self.sync_symbol(symbol)
            except Exception as e:
                logger.error(f"Error syncing {symbol}: {e}")

        self.save_sync_state()
        logger.info("Sync completed")

if __name__ == "__main__":
    syncer = DataSyncer()
    syncer.run()
```

### 5.4 File 2: Timeframe Filter

**File:** `sync/timeframe_filter.py`

```python
"""
Timeframe Filtering Logic

Filters SQLite rows based on timestamp matching for each timeframe.
"""

from datetime import datetime
from typing import List, Tuple

TIMEFRAME_DIVISORS = {
    'M5': 5,      # Minutes divisible by 5
    'M15': 15,    # Minutes divisible by 15
    'M30': 30,    # Minutes divisible by 30
    'H1': 60,     # On the hour
    'H2': 120,    # Even hours
    'H4': 240,    # Hours divisible by 4
    'H8': 480,    # Hours divisible by 8
    'H12': 720,   # Hours divisible by 12
    'D1': 1440,   # Midnight only
}

def filter_by_timeframe(rows: List[tuple], timeframe: str) -> List[tuple]:
    """
    Filter rows to only include timestamps matching the timeframe.

    For M5: timestamps at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
    For H1: timestamps at :00:00 of each hour
    For D1: timestamps at 00:00:00 each day
    """
    divisor = TIMEFRAME_DIVISORS.get(timeframe)
    if divisor is None:
        return []

    filtered = []
    for row in rows:
        timestamp = row[0]  # First column is Unix timestamp
        dt = datetime.utcfromtimestamp(timestamp)

        # Calculate minutes since midnight
        minutes_since_midnight = dt.hour * 60 + dt.minute

        # Check if this timestamp matches the timeframe
        if timeframe == 'D1':
            # Daily: must be exactly midnight
            if dt.hour == 0 and dt.minute == 0:
                filtered.append(row)
        elif timeframe.startswith('H'):
            # Hourly timeframes: minute must be 0
            if dt.minute == 0 and minutes_since_midnight % divisor == 0:
                filtered.append(row)
        else:
            # Minute timeframes
            if dt.minute % divisor == 0:
                filtered.append(row)

    return filtered

def get_latest_timeframe_timestamp(timeframe: str) -> int:
    """Get the most recent valid timestamp for a timeframe."""
    now = datetime.utcnow()
    divisor = TIMEFRAME_DIVISORS.get(timeframe, 5)

    # Round down to nearest valid timestamp
    if timeframe == 'D1':
        aligned = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif timeframe.startswith('H'):
        hours = divisor // 60
        aligned_hour = (now.hour // hours) * hours
        aligned = now.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)
    else:
        aligned_minute = (now.minute // divisor) * divisor
        aligned = now.replace(minute=aligned_minute, second=0, microsecond=0)

    return int(aligned.timestamp())
```

### 5.5 File 3: Database Connections

**File:** `sync/db_connections.py`

```python
"""
Database Connection Management
"""

import sqlite3
import psycopg2
from psycopg2 import pool

from config import SQLITE_PATH, POSTGRESQL_URI

# Connection pool for PostgreSQL
pg_pool = None

def get_sqlite_connection() -> sqlite3.Connection:
    """Get SQLite connection."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_postgresql_connection():
    """Get PostgreSQL connection from pool."""
    global pg_pool
    if pg_pool is None:
        pg_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,  # min, max connections
            POSTGRESQL_URI
        )
    return pg_pool.getconn()

def return_postgresql_connection(conn):
    """Return connection to pool."""
    global pg_pool
    if pg_pool:
        pg_pool.putconn(conn)
```

### 5.6 Success Criteria

- [ ] Sync script runs without errors
- [ ] Data filtered correctly by timeframe
- [ ] PostgreSQL tables populated
- [ ] Sync state persisted between runs
- [ ] Handle network failures gracefully
- [ ] Logging shows sync progress

### 5.7 Commit Message

```
feat(sync): add SQLite to PostgreSQL sync script

- Create DataSyncer class for reliable data transfer
- Implement timeframe filtering for 9 timeframes
- Add database connection pooling
- Persist sync state between runs
- Handle errors gracefully with logging
```

---

## 6. Phase 4: Next.js API Routes

### 6.1 Objective

Create Next.js API routes to serve indicator data from PostgreSQL, replacing Flask endpoints.

### 6.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `app/api/indicators/[symbol]/[timeframe]/route.ts` | Main indicators endpoint |
| 2 | `app/api/indicators/health/route.ts` | Health check endpoint |
| 3 | `app/api/symbols/route.ts` | Available symbols endpoint |
| 4 | `app/api/timeframes/route.ts` | Available timeframes endpoint |
| 5 | `lib/db/postgresql.ts` | PostgreSQL client |
| 6 | `lib/db/queries.ts` | Database query functions |
| 7 | `lib/indicators/types.ts` | TypeScript types |
| 8 | `lib/tier/validation.ts` | Tier access validation |

### 6.3 File 1: Indicators Route

**File:** `app/api/indicators/[symbol]/[timeframe]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIndicatorData } from '@/lib/db/queries';
import { validateTierAccess } from '@/lib/tier/validation';
import { VALID_SYMBOLS, VALID_TIMEFRAMES } from '@/lib/constants';

interface RouteParams {
  params: {
    symbol: string;
    timeframe: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol, timeframe } = params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    // Validate symbol and timeframe
    if (!VALID_SYMBOLS.includes(upperSymbol)) {
      return NextResponse.json(
        { success: false, error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }

    if (!VALID_TIMEFRAMES.includes(upperTimeframe)) {
      return NextResponse.json(
        { success: false, error: `Invalid timeframe: ${timeframe}` },
        { status: 400 }
      );
    }

    // Get user session and tier
    const session = await getServerSession(authOptions);
    const userTier = session?.user?.tier || 'FREE';

    // Validate tier access
    const accessResult = validateTierAccess(upperSymbol, upperTimeframe, userTier);
    if (!accessResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: accessResult.message,
          tier: userTier,
          upgrade_required: true
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000);

    // Fetch data from PostgreSQL
    const data = await getIndicatorData(upperSymbol, upperTimeframe, limit);

    return NextResponse.json({
      success: true,
      data: {
        ohlc: data.ohlc,
        fractals: data.fractals,
        horizontal_trendlines: data.horizontal_trendlines,
        diagonal_trendlines: data.diagonal_trendlines,
        momentum_candles: data.momentum_candles,
        keltner_channels: data.keltner_channels,
        tema: data.tema,
        hrma: data.hrma,
        smma: data.smma,
        zigzag: data.zigzag,
        metadata: {
          symbol: upperSymbol,
          timeframe: upperTimeframe,
          tier: userTier,
          bars_returned: data.ohlc.length,
          pro_indicators_enabled: userTier === 'PRO'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching indicator data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 6.4 File 5: PostgreSQL Client

**File:** `lib/db/postgresql.ts`

```typescript
import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRESQL_URI,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function getPool() {
  return pool;
}
```

### 6.5 File 6: Database Queries

**File:** `lib/db/queries.ts`

```typescript
import { query } from './postgresql';
import { IndicatorData, OHLCBar } from '@/lib/indicators/types';

export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;

  const rows = await query<any>(`
    SELECT
      timestamp,
      open,
      high,
      low,
      close,
      fractals,
      horizontal_trendlines,
      diagonal_trendlines,
      momentum_candles,
      keltner_channels,
      tema,
      hrma,
      smma,
      zigzag
    FROM ${tableName}
    ORDER BY timestamp DESC
    LIMIT $1
  `, [limit]);

  // Transform rows to response format
  const ohlc: OHLCBar[] = rows.map(row => ({
    time: new Date(row.timestamp).getTime() / 1000,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: 0
  }));

  return {
    ohlc: ohlc.reverse(),
    fractals: rows[0]?.fractals || { peaks: [], bottoms: [] },
    horizontal_trendlines: rows[0]?.horizontal_trendlines || {},
    diagonal_trendlines: rows[0]?.diagonal_trendlines || {},
    momentum_candles: rows.map(r => r.momentum_candles).filter(Boolean).flat(),
    keltner_channels: rows[0]?.keltner_channels || {},
    tema: rows.map(r => r.tema),
    hrma: rows.map(r => r.hrma),
    smma: rows.map(r => r.smma),
    zigzag: rows[0]?.zigzag || { peaks: [], bottoms: [] }
  };
}
```

### 6.6 Success Criteria

- [ ] API routes respond correctly
- [ ] Tier validation works
- [ ] Data format matches Part 6 API
- [ ] Error handling comprehensive
- [ ] TypeScript types complete
- [ ] Frontend charts work with new API

### 6.7 Commit Message

```
feat(api): add Next.js API routes for indicator data

- Replace Flask endpoints with Next.js API routes
- Add PostgreSQL query layer
- Implement tier-based access control
- Match Part 6 API response format
- Add TypeScript types for indicators
```

---

## 7. Phase 5: Redis Caching Layer

### 7.1 Objective

Add Redis caching for rapid data retrieval, reducing PostgreSQL load.

### 7.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `lib/cache/redis.ts` | Redis client configuration |
| 2 | `lib/cache/indicator-cache.ts` | Indicator caching functions |
| 3 | `lib/cache/cache-invalidation.ts` | Cache invalidation logic |
| 4 | `lib/db/queries.ts` | Update with cache integration |

### 7.3 File 1: Redis Client

**File:** `lib/cache/redis.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const CACHE_TTL = 30; // 30 seconds to match sync interval

export async function get<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (data) {
    return JSON.parse(data) as T;
  }
  return null;
}

export async function set(key: string, value: any, ttl: number = CACHE_TTL): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
}

export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default redis;
```

### 7.4 File 2: Indicator Cache

**File:** `lib/cache/indicator-cache.ts`

```typescript
import { get, set, CACHE_TTL } from './redis';
import { getIndicatorData as fetchFromDb } from '@/lib/db/queries';
import { IndicatorData } from '@/lib/indicators/types';

function getCacheKey(symbol: string, timeframe: string): string {
  return `indicators:${symbol}:${timeframe}:latest`;
}

export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const cacheKey = getCacheKey(symbol, timeframe);

  // Try cache first
  const cached = await get<IndicatorData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const data = await fetchFromDb(symbol, timeframe, limit);

  // Cache the result
  await set(cacheKey, data, CACHE_TTL);

  return data;
}

export async function invalidateIndicatorCache(symbol: string, timeframe?: string): Promise<void> {
  if (timeframe) {
    await del(getCacheKey(symbol, timeframe));
  } else {
    // Invalidate all timeframes for symbol
    await invalidatePattern(`indicators:${symbol}:*`);
  }
}
```

### 7.5 Success Criteria

- [ ] Redis connection established
- [ ] Cache hit rate > 80%
- [ ] TTL = 30 seconds matches sync
- [ ] Cache invalidation works
- [ ] Fallback to DB on cache miss

### 7.6 Commit Message

```
feat(cache): add Redis caching layer for indicator data

- Configure Redis client with 30s TTL
- Add indicator caching functions
- Integrate cache with API routes
- Add cache invalidation on sync
```

---

## 8. Phase 6: Confluence Score System

### 8.1 Objective

Implement multi-timeframe confluence score calculation.

### 8.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `app/api/confluence/[symbol]/route.ts` | Confluence score endpoint |
| 2 | `lib/confluence/calculator.ts` | Score calculation logic |
| 3 | `lib/confluence/signals.ts` | Signal detection functions |
| 4 | `lib/confluence/types.ts` | TypeScript types |
| 5 | `lib/db/multi-timeframe-query.ts` | Query 117 indicators |
| 6 | `lib/cache/confluence-cache.ts` | Confluence caching |

### 8.3 File 1: Confluence API Route

**File:** `app/api/confluence/[symbol]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateConfluenceScore } from '@/lib/confluence/calculator';
import { getMultiTimeframeData } from '@/lib/db/multi-timeframe-query';
import { getCachedConfluence, cacheConfluence } from '@/lib/cache/confluence-cache';

interface RouteParams {
  params: { symbol: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { symbol } = params;
    const upperSymbol = symbol.toUpperCase();

    // PRO tier required for confluence
    const session = await getServerSession(authOptions);
    if (session?.user?.tier !== 'PRO') {
      return NextResponse.json(
        { success: false, error: 'PRO tier required for confluence analysis' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const timestamp = searchParams.get('timestamp') || new Date().toISOString();

    // Check cache
    const cached = await getCachedConfluence(upperSymbol, timestamp);
    if (cached) {
      return NextResponse.json({ success: true, ...cached });
    }

    // Get all 117 indicators (13 indicators × 9 timeframes)
    const multiTfData = await getMultiTimeframeData(upperSymbol, timestamp);

    // Calculate confluence score
    const confluenceResult = calculateConfluenceScore(multiTfData);

    // Cache result
    await cacheConfluence(upperSymbol, timestamp, confluenceResult);

    return NextResponse.json({
      success: true,
      symbol: upperSymbol,
      timestamp,
      ...confluenceResult
    });

  } catch (error) {
    console.error('Error calculating confluence:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 8.4 File 2: Confluence Calculator

**File:** `lib/confluence/calculator.ts`

```typescript
import { MultiTimeframeData, ConfluenceResult, TimeframeSignal } from './types';
import { detectSignals, getTrendDirection, getSignalStrength } from './signals';
import { TIMEFRAMES } from '@/lib/constants';

export function calculateConfluenceScore(data: MultiTimeframeData): ConfluenceResult {
  const breakdown: Record<string, TimeframeSignal> = {};
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let totalStrength = 0;

  for (const timeframe of TIMEFRAMES) {
    const tfData = data[timeframe];
    if (!tfData) continue;

    const signals = detectSignals(tfData);
    const trend = getTrendDirection(signals);
    const strength = getSignalStrength(signals);

    breakdown[timeframe] = {
      trend,
      strength,
      signals
    };

    if (trend === 'bullish') bullishCount++;
    else if (trend === 'bearish') bearishCount++;
    else neutralCount++;

    totalStrength += strength;
  }

  // Calculate confluence score (0-10 scale)
  const alignment = Math.abs(bullishCount - bearishCount) / TIMEFRAMES.length;
  const avgStrength = totalStrength / TIMEFRAMES.length;
  const confluenceScore = alignment * 5 + avgStrength * 5;

  return {
    confluence_score: Math.round(confluenceScore * 10) / 10,
    max_score: 10,
    signals: {
      bullish: bullishCount,
      bearish: bearishCount,
      neutral: neutralCount
    },
    breakdown,
    all_117_indicators: data
  };
}
```

### 8.5 Success Criteria

- [ ] Confluence endpoint returns 117 indicators
- [ ] Score calculated correctly (0-10)
- [ ] Breakdown by timeframe included
- [ ] PRO tier validation works
- [ ] Results cached properly

### 8.6 Commit Message

```
feat(confluence): add multi-timeframe confluence score system

- Add confluence score API endpoint
- Query 117 indicators across 9 timeframes
- Calculate alignment and strength scores
- Cache confluence results
```

---

## 9. Phase 7: Testing Framework

### 9.1 Objective

Implement comprehensive testing framework with unit, integration, and API tests.

### 9.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `__tests__/unit/timeframe-filter.test.ts` | Timeframe filter tests |
| 2 | `__tests__/unit/confluence-calculator.test.ts` | Confluence calc tests |
| 3 | `__tests__/unit/symbol-utils.test.ts` | Symbol normalization tests |
| 4 | `__tests__/integration/sync-pipeline.test.ts` | Sync integration tests |
| 5 | `__tests__/integration/cache-integration.test.ts` | Cache integration tests |
| 6 | `__tests__/api/indicators.test.ts` | Indicators API tests |
| 7 | `__tests__/api/confluence.test.ts` | Confluence API tests |
| 8 | `__tests__/api/health.test.ts` | Health endpoint tests |
| 9 | `jest.config.js` | Jest configuration |
| 10 | `__tests__/setup.ts` | Test setup file |

### 9.3 File 1: Timeframe Filter Tests

**File:** `__tests__/unit/timeframe-filter.test.ts`

```typescript
import { filterByTimeframe, TIMEFRAME_DIVISORS } from '@/sync/timeframe_filter';

describe('Timeframe Filter', () => {
  const mockRows = [
    { timestamp: 1704067200, open: 1.0, high: 1.1, low: 0.9, close: 1.05 }, // 00:00
    { timestamp: 1704067500, open: 1.05, high: 1.15, low: 0.95, close: 1.1 }, // 00:05
    { timestamp: 1704067800, open: 1.1, high: 1.2, low: 1.0, close: 1.15 }, // 00:10
    { timestamp: 1704068100, open: 1.15, high: 1.25, low: 1.05, close: 1.2 }, // 00:15
  ];

  test('M5 filter includes all rows on 5-minute boundaries', () => {
    const filtered = filterByTimeframe(mockRows, 'M5');
    expect(filtered.length).toBe(4);
  });

  test('M15 filter includes only 15-minute boundaries', () => {
    const filtered = filterByTimeframe(mockRows, 'M15');
    expect(filtered.length).toBe(2); // 00:00 and 00:15
  });

  test('H1 filter includes only hourly boundaries', () => {
    const filtered = filterByTimeframe(mockRows, 'H1');
    expect(filtered.length).toBe(1); // Only 00:00
  });

  test('D1 filter includes only midnight', () => {
    const filtered = filterByTimeframe(mockRows, 'D1');
    expect(filtered.length).toBe(1); // Only 00:00:00
  });
});
```

### 9.4 File 6: Indicators API Tests

**File:** `__tests__/api/indicators.test.ts`

```typescript
import { createMocks } from 'node-mocks-http';
import { GET } from '@/app/api/indicators/[symbol]/[timeframe]/route';

describe('Indicators API', () => {
  test('GET /api/indicators/EURUSD/H1 returns indicator data', async () => {
    const { req } = createMocks({
      method: 'GET',
    });

    const response = await GET(req as any, {
      params: { symbol: 'EURUSD', timeframe: 'H1' }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.ohlc).toBeDefined();
    expect(data.data.fractals).toBeDefined();
  });

  test('Invalid symbol returns 400', async () => {
    const { req } = createMocks({ method: 'GET' });

    const response = await GET(req as any, {
      params: { symbol: 'INVALID', timeframe: 'H1' }
    });

    expect(response.status).toBe(400);
  });

  test('FREE tier cannot access PRO symbol', async () => {
    // Mock FREE tier session
    const { req } = createMocks({ method: 'GET' });

    const response = await GET(req as any, {
      params: { symbol: 'AUDJPY', timeframe: 'H1' }
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.upgrade_required).toBe(true);
  });
});
```

### 9.5 Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All API tests pass
- [ ] Code coverage > 80%
- [ ] CI pipeline configured

### 9.6 Commit Message

```
test(part20): add comprehensive testing framework

- Add unit tests for timeframe filtering
- Add unit tests for confluence calculation
- Add integration tests for sync pipeline
- Add API tests for all endpoints
- Configure Jest with TypeScript
```

---

## 10. Phase 8: E2E Testing Migration

### 10.1 Objective

Migrate Part 6 E2E tests to Part 20 architecture.

### 10.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `e2e/critical-path.spec.ts` | Critical path E2E tests |
| 2 | `e2e/chart-rendering.spec.ts` | Chart rendering tests |
| 3 | `playwright.config.ts` | Playwright configuration |

### 10.3 Critical Path Test

**File:** `e2e/critical-path.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Part 20 Critical Path', () => {
  test('Complete data flow from SQLite to frontend', async ({ page }) => {
    // Step 1: Verify SQLite has recent data
    const sqliteResponse = await fetch('/api/health/sqlite');
    const sqliteHealth = await sqliteResponse.json();
    expect(sqliteHealth.lastUpdate).toBeGreaterThan(Date.now() - 60000);

    // Step 2: Verify PostgreSQL sync
    const pgResponse = await fetch('/api/health/postgresql');
    const pgHealth = await pgResponse.json();
    expect(pgHealth.tables).toBe(135);
    expect(pgHealth.connected).toBe(true);

    // Step 3: API returns correct data
    const indicatorResponse = await fetch('/api/indicators/EURUSD/H1');
    const indicatorData = await indicatorResponse.json();
    expect(indicatorData.success).toBe(true);
    expect(indicatorData.data.ohlc.length).toBeGreaterThan(0);

    // Step 4: Chart renders
    await page.goto('/dashboard/chart/EURUSD/H1');
    await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="candlestick"]')).toHaveCount({ minimum: 100 });

    // Step 5: Indicators display
    await expect(page.locator('[data-testid="fractal-marker"]')).toBeVisible();
    await expect(page.locator('[data-testid="trendline"]')).toBeVisible();
  });

  test('Confluence score calculation', async ({ page }) => {
    // PRO user login
    await page.goto('/login');
    await page.fill('[name="email"]', 'pro@test.com');
    await page.fill('[name="password"]', 'testpass');
    await page.click('[type="submit"]');

    // Navigate to confluence view
    await page.goto('/dashboard/confluence/EURUSD');

    // Verify 117 indicators loaded
    const confluenceResponse = await page.evaluate(async () => {
      const res = await fetch('/api/confluence/EURUSD');
      return res.json();
    });

    expect(confluenceResponse.success).toBe(true);
    expect(Object.keys(confluenceResponse.all_117_indicators)).toHaveLength(9);

    // Verify score displayed
    await expect(page.locator('[data-testid="confluence-score"]')).toBeVisible();
  });
});
```

### 10.4 Success Criteria

- [ ] Critical path test passes
- [ ] Chart rendering test passes
- [ ] Confluence test passes
- [ ] All Part 6 E2E tests migrated
- [ ] CI runs E2E tests

### 10.5 Commit Message

```
test(e2e): migrate Part 6 E2E tests to Part 20 architecture

- Add critical path E2E test
- Add chart rendering E2E test
- Configure Playwright
- Update CI for E2E testing
```

---

## 11. Phase 9: Deployment & Cutover

### 11.1 Objective

Deploy Part 20 and cutover from Part 6.

### 11.2 Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `scripts/deploy-part20.sh` | Deployment script |
| 2 | `scripts/rollback-to-part6.sh` | Rollback script |

### 11.3 Deployment Checklist

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKLIST                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pre-Deployment:                                            │
│  □ All tests passing in CI                                  │
│  □ PostgreSQL database migrated                             │
│  □ Redis instance configured                                │
│  □ MQL5 Services deployed to all 15 MT5 terminals          │
│  □ Sync script tested in staging                           │
│  □ API endpoints tested                                     │
│  □ Frontend tested with new API                            │
│                                                             │
│  Deployment:                                                │
│  □ Enable maintenance mode                                  │
│  □ Stop Part 6 Flask service                               │
│  □ Deploy Part 20 API routes                               │
│  □ Start sync script (cron every 30s)                      │
│  □ Verify data flowing                                      │
│  □ Run smoke tests                                          │
│  □ Disable maintenance mode                                 │
│                                                             │
│  Post-Deployment:                                           │
│  □ Monitor error rates                                      │
│  □ Verify chart accuracy                                    │
│  □ Check sync script logs                                   │
│  □ Confirm Redis cache hit rate                            │
│  □ Archive Part 6 code                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 Rollback Procedure

If critical issues occur:

1. Enable maintenance mode
2. Stop sync script
3. Restart Part 6 Flask service
4. Update API routes to proxy to Flask
5. Disable maintenance mode
6. Investigate issues

### 11.5 Success Criteria

- [ ] Zero downtime deployment
- [ ] All monitors green
- [ ] Chart accuracy verified
- [ ] Performance improved
- [ ] Part 6 archived

### 11.6 Commit Message

```
chore(deploy): Part 20 production deployment

- Deploy SQLite + Sync + PostgreSQL architecture
- Cutover from Part 6 Flask service
- Archive Part 6 code
```

---

## 12. File Inventory

### Complete File List (45 files)

| Phase | File Path | Type |
|-------|-----------|------|
| 1 | `sql/sqlite_schema.sql` | SQL |
| 1 | `sql/postgresql_schema.sql` | SQL |
| 1 | `sql/timescaledb_setup.sql` | SQL |
| 1 | `sql/seed_data.sql` | SQL |
| 2 | `mql5/Services/DataCollector.mq5` | MQL5 |
| 2 | `mql5/Include/IndicatorBuffers.mqh` | MQL5 |
| 2 | `mql5/Include/SymbolUtils.mqh` | MQL5 |
| 3 | `sync/sync_to_postgresql.py` | Python |
| 3 | `sync/timeframe_filter.py` | Python |
| 3 | `sync/db_connections.py` | Python |
| 3 | `sync/config.py` | Python |
| 3 | `sync/requirements.txt` | Config |
| 4 | `app/api/indicators/[symbol]/[timeframe]/route.ts` | TypeScript |
| 4 | `app/api/indicators/health/route.ts` | TypeScript |
| 4 | `app/api/symbols/route.ts` | TypeScript |
| 4 | `app/api/timeframes/route.ts` | TypeScript |
| 4 | `lib/db/postgresql.ts` | TypeScript |
| 4 | `lib/db/queries.ts` | TypeScript |
| 4 | `lib/indicators/types.ts` | TypeScript |
| 4 | `lib/tier/validation.ts` | TypeScript |
| 5 | `lib/cache/redis.ts` | TypeScript |
| 5 | `lib/cache/indicator-cache.ts` | TypeScript |
| 5 | `lib/cache/cache-invalidation.ts` | TypeScript |
| 6 | `app/api/confluence/[symbol]/route.ts` | TypeScript |
| 6 | `lib/confluence/calculator.ts` | TypeScript |
| 6 | `lib/confluence/signals.ts` | TypeScript |
| 6 | `lib/confluence/types.ts` | TypeScript |
| 6 | `lib/db/multi-timeframe-query.ts` | TypeScript |
| 6 | `lib/cache/confluence-cache.ts` | TypeScript |
| 7 | `__tests__/unit/timeframe-filter.test.ts` | TypeScript |
| 7 | `__tests__/unit/confluence-calculator.test.ts` | TypeScript |
| 7 | `__tests__/unit/symbol-utils.test.ts` | TypeScript |
| 7 | `__tests__/integration/sync-pipeline.test.ts` | TypeScript |
| 7 | `__tests__/integration/cache-integration.test.ts` | TypeScript |
| 7 | `__tests__/api/indicators.test.ts` | TypeScript |
| 7 | `__tests__/api/confluence.test.ts` | TypeScript |
| 7 | `__tests__/api/health.test.ts` | TypeScript |
| 7 | `jest.config.js` | Config |
| 7 | `__tests__/setup.ts` | TypeScript |
| 8 | `e2e/critical-path.spec.ts` | TypeScript |
| 8 | `e2e/chart-rendering.spec.ts` | TypeScript |
| 8 | `playwright.config.ts` | TypeScript |
| 9 | `scripts/deploy-part20.sh` | Shell |
| 9 | `scripts/rollback-to-part6.sh` | Shell |

---

## 13. Rollback Plan

### 13.1 Rollback Triggers

Initiate rollback if:
- Error rate > 5% for 10 minutes
- Data sync fails for 5 minutes
- Chart accuracy issues reported
- Database connection failures

### 13.2 Rollback Steps

```bash
#!/bin/bash
# scripts/rollback-to-part6.sh

echo "Starting rollback to Part 6..."

# 1. Stop sync script
sudo systemctl stop trading-sync

# 2. Enable maintenance mode
curl -X POST https://api.tradingalerts.com/admin/maintenance/enable

# 3. Restart Flask service
sudo systemctl start mt5-flask-service

# 4. Update API proxy
kubectl apply -f k8s/part6-api-config.yaml

# 5. Verify Flask health
curl http://localhost:5001/api/health

# 6. Disable maintenance mode
curl -X POST https://api.tradingalerts.com/admin/maintenance/disable

echo "Rollback complete. Part 6 Flask service is active."
```

---

**Document End**
