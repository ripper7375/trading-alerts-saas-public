#!/usr/bin/env python3
"""
MT5 Data Backfill Worker - API Gateway Version
Recovers data from SQLite backups and syncs to API Gateway
Runs continuously, checking every 5 minutes
"""

import sqlite3
import requests
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION - API Gateway (UPDATED)
# ============================================================
API_GATEWAY_URL = 'https://your-api.railway.app'
API_KEY = 'your_api_key_here'
TERMINAL_ID = 'backfill_worker'

DATABASE_DIR = Path('C:/Scripts/database')
SYMBOLS = [
    'btcusd', 'ethusd', 'xauusd',      # Terminal 1
    'eurusd', 'gbpusd', 'usdjpy',      # Terminal 2
    'xagusd', 'wtiusd', 'audusd',      # Terminal 3
    'nzdusd', 'usdcad', 'us30',        # Terminal 4
    'spx500', 'nas100', 'bnbusd'       # Terminal 5
]


def get_all_columns(cursor, table_name: str) -> List[str]:
    """Get all column names from table"""
    cursor.execute(f"PRAGMA table_info([{table_name}])")
    return [row[1] for row in cursor.fetchall()]


def row_to_dict(cursor, row, columns: List[str]) -> Dict:
    """Convert SQLite row to dictionary"""
    data = {}
    for idx, col in enumerate(columns):
        value = row[idx]
        # Handle NULL values
        if value is None:
            data[col] = None
        else:
            data[col] = value
    return data


def backfill_symbol(symbol: str) -> int:
    """
    Backfill data from SQLite to API Gateway for one symbol
    Returns number of bars backfilled
    """
    db_path = DATABASE_DIR / f"{symbol}.db"
    
    if not db_path.exists():
        return 0
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute(f"""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='{symbol}'
        """)
        
        if not cursor.fetchone():
            conn.close()
            return 0
        
        # Get column names
        columns = get_all_columns(cursor, symbol)
        
        # Get all rows (these are bars that failed API Gateway publish)
        cursor.execute(f"SELECT * FROM [{symbol}] ORDER BY timestamp DESC LIMIT 1000")
        rows = cursor.fetchall()
        
        if not rows:
            conn.close()
            return 0
        
        logger.info(f"📋 {symbol}: Found {len(rows)} bars to backfill")
        
        backfilled = 0
        validation_errors = 0
        
        for row in rows:
            # Convert row to dictionary
            data = row_to_dict(cursor, row, columns)
            
            # Add symbol field (sanitized name)
            data['symbol'] = symbol
            
            # Prepare headers for API Gateway
            headers = {
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json',
                'X-Terminal-ID': TERMINAL_ID,
                'X-EA-Version': 'backfill_worker.py'
            }
            
            try:
                # POST to API Gateway
                response = requests.post(
                    f'{API_GATEWAY_URL}/api/v1/market-data',
                    json=data,
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code == 200:
                    # ✅ Success - delete from SQLite
                    cursor.execute(f"""
                        DELETE FROM [{symbol}] 
                        WHERE timestamp = ? AND timeframe = ?
                    """, (data['timestamp'], data['timeframe']))
                    
                    conn.commit()
                    backfilled += 1
                    
                elif response.status_code == 429:
                    # ⚠️ Rate limited - stop and retry later
                    logger.warning(f"⚠️ Rate limited by API Gateway for {symbol}")
                    break  # Stop this symbol, wait for next cycle
                    
                elif response.status_code == 400:
                    # ❌ Validation error - log and delete bad data
                    error_detail = response.json()
                    logger.error(f"❌ Validation failed for {symbol}: {error_detail.get('message', 'Unknown error')}")
                    
                    # Delete bad data (it will never pass validation)
                    cursor.execute(f"""
                        DELETE FROM [{symbol}] 
                        WHERE timestamp = ? AND timeframe = ?
                    """, (data['timestamp'], data['timeframe']))
                    conn.commit()
                    validation_errors += 1
                    
                elif response.status_code == 401 or response.status_code == 403:
                    # ❌ Authentication error - critical, stop immediately
                    logger.error(f"❌ CRITICAL: Authentication failed (check API_KEY)")
                    conn.close()
                    return backfilled
                    
                else:
                    # ❌ Other error - log and retry later
                    logger.error(f"❌ API Gateway error for {symbol}: HTTP {response.status_code}")
                    break  # Stop this symbol, try next
                    
            except requests.Timeout:
                logger.error(f"❌ Timeout connecting to API Gateway for {symbol}")
                break  # Stop this symbol, try next
                
            except requests.ConnectionError as e:
                logger.error(f"❌ Network error for {symbol}: {e}")
                break  # Stop this symbol, try next
                
            except Exception as e:
                logger.error(f"❌ Unexpected error processing bar: {e}")
                continue  # Skip this bar, try next
        
        conn.close()
        
        if backfilled > 0:
            logger.info(f"✅ {symbol}: Backfilled {backfilled} bars")
        
        if validation_errors > 0:
            logger.warning(f"⚠️ {symbol}: Removed {validation_errors} bars with validation errors")
        
        return backfilled
        
    except Exception as e:
        logger.error(f"❌ Error processing {symbol}: {e}")
        return 0


def check_api_health():
    """Check API Gateway health"""
    try:
        response = requests.get(
            f'{API_GATEWAY_URL}/api/v1/health',
            timeout=5
        )
        
        if response.status_code == 200:
            health = response.json()
            logger.info(f"📊 API Gateway Status: {health.get('status', 'unknown')}")
            
            # Log queue stats if available
            if 'services' in health and 'queue' in health['services']:
                queue = health['services']['queue']
                logger.info(f"   Queue: {queue.get('waiting', 0)} waiting, {queue.get('active', 0)} active")
            
            return True
        else:
            logger.warning(f"⚠️ API Gateway health check failed: HTTP {response.status_code}")
            return False
            
    except requests.Timeout:
        logger.error("❌ Timeout checking API Gateway health")
        return False
        
    except requests.ConnectionError:
        logger.error("❌ Cannot connect to API Gateway")
        return False
        
    except Exception as e:
        logger.error(f"❌ Failed to check API health: {e}")
        return False


def get_sqlite_stats():
    """Get statistics on SQLite backup usage"""
    total_bars = 0
    symbols_with_data = []
    
    for symbol in SYMBOLS:
        db_path = DATABASE_DIR / f"{symbol}.db"
        
        if not db_path.exists():
            continue
        
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            cursor.execute(f"""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='{symbol}'
            """)
            
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM [{symbol}]")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    total_bars += count
                    symbols_with_data.append(f"{symbol}:{count}")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Error reading {symbol}: {e}")
            continue
    
    return total_bars, symbols_with_data


def main():
    """Main backfill worker loop"""
    logger.info("🚀 Starting MT5 Data Backfill Worker (API Gateway Version)")
    logger.info(f"   Database directory: {DATABASE_DIR}")
    logger.info(f"   Monitoring {len(SYMBOLS)} symbols")
    logger.info(f"   API Gateway: {API_GATEWAY_URL}")
    logger.info(f"   Terminal ID: {TERMINAL_ID}")
    logger.info("=" * 60)
    
    # Verify configuration
    if 'your-api.railway.app' in API_GATEWAY_URL:
        logger.error("❌ ERROR: Please configure API_GATEWAY_URL")
        logger.error("   Example: https://your-api.railway.app")
        return
    
    if 'your_api_key' in API_KEY or len(API_KEY) < 20:
        logger.error("❌ ERROR: Please configure API_KEY")
        logger.error("   Format: mt5_terminal_xxx_xxxxxxxxxx")
        return
    
    # Initial health check
    logger.info("Checking API Gateway health...")
    if not check_api_health():
        logger.warning("⚠️ API Gateway health check failed, but continuing...")
    
    iteration = 0
    consecutive_failures = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"\n--- Iteration #{iteration} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
            
            # Check SQLite backup status
            total_bars, symbols_with_data = get_sqlite_stats()
            
            if total_bars == 0:
                logger.info("✅ No backfill needed - all data synced to API Gateway")
                
                # Periodic health check when idle
                if iteration % 12 == 0:  # Every 12th iteration (1 hour if 5min sleep)
                    check_api_health()
                
                consecutive_failures = 0
                
            else:
                logger.warning(f"⚠️ Found {total_bars} bars in SQLite backups")
                logger.info(f"   Symbols: {', '.join(symbols_with_data)}")
                
                # Backfill each symbol
                total_backfilled = 0
                
                for symbol in SYMBOLS:
                    count = backfill_symbol(symbol)
                    total_backfilled += count
                    
                    if count > 0:
                        # Small delay between symbols to avoid rate limiting
                        time.sleep(0.5)
                
                if total_backfilled > 0:
                    logger.info(f"✅ Total backfilled: {total_backfilled} bars")
                    consecutive_failures = 0
                else:
                    # No progress made
                    consecutive_failures += 1
                    logger.warning(f"⚠️ No progress made (attempt {consecutive_failures})")
                    
                    if consecutive_failures >= 5:
                        logger.error("❌ Multiple consecutive failures - check API Gateway connectivity")
                        check_api_health()
                        consecutive_failures = 0  # Reset after health check
            
            # Sleep interval based on whether work was done
            if total_bars > 0:
                # Had work, check again soon
                logger.info("Sleeping 60 seconds (quick check after backfill)...")
                time.sleep(60)
            else:
                # No work, normal interval
                logger.info("Sleeping 300 seconds (5 minutes)...")
                time.sleep(300)
            
        except KeyboardInterrupt:
            logger.info("\n👋 Shutting down backfill worker...")
            break
            
        except Exception as e:
            logger.error(f"❌ Worker error: {e}")
            logger.info("Sleeping 60 seconds before retry...")
            time.sleep(60)


if __name__ == "__main__":
    main()
