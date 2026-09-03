#!/usr/bin/env python3
"""
seed_local_xauusd_db.py — build a throwaway xauusd.db for the local
end-to-end harness (see ../test/local-e2e-harness.md).

Builds a fresh SQLite database from sqlite_schema_v6_xauusd.sql and inserts
one synthetic-but-schema-valid market_data row (unsynced), so the real
backfill_worker_api_gateway_v5.py has something real to push to a
locally-running Gateway.
"""
import argparse
import os
import sqlite3
import time
from pathlib import Path

SCHEMA_PATH = (
    Path(__file__).parent.parent.parent
    / "backend-stack-c"
    / "1_EA-and-backfill-worker-on-contabo-vps"
    / "v2_29_data_pipeline_architecture"
    / "sqlite_schema_v6_xauusd.sql"
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Path to the throwaway SQLite file")
    args = ap.parse_args()

    db_path = Path(args.db)
    if db_path.exists():
        os.remove(db_path)

    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    now = int(time.time())
    bar_ts = now - (now % 300)  # round down to the M5 bar grid

    conn.execute(
        "INSERT INTO collection_cycles "
        "(cycle_time, timeframe, attempt, status, sources_received, created_at, validated_at) "
        "VALUES (?, 'M5', 1, 'validated', 11, ?, ?)",
        (bar_ts, now, now),
    )
    cycle_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    conn.execute(
        """
        INSERT INTO market_data (
            timestamp, symbol, timeframe, open, high, low, close, volume,
            best_fit_a_horiz_high_map, best_fit_a_horiz_low_map, best_fit_a_ssa, best_fit_a_ema_ssa,
            best_fit_a_crossing, best_fit_a_base_fl, best_fit_a_uoedt, best_fit_a_loedt,
            body_direction, body_size, body_classification,
            cycle_id, collected_at, calculated_at, synced_at
        ) VALUES (
            ?, 'XAUUSD', 'M5', 2382.14, 2383.02, 2381.55, 2382.77, 214,
            2383.40, 2381.10, 2382.61, 2382.58,
            0, 2382.55, 2384.20, 2380.90,
            1, 0.42, 2,
            ?, ?, ?, NULL
        )
        """,
        (bar_ts, cycle_id, now, now),
    )
    conn.commit()
    conn.close()
    print(f"Seeded {db_path} with 1 unsynced XAUUSD/M5 row @ timestamp={bar_ts} (cycle_id={cycle_id})")


if __name__ == "__main__":
    main()
