#!/usr/bin/env python3
"""
Trading Database Validator - validate_sqlite.py
Comprehensive validation tool for SimpleDataCollector database
Validates OHLCV data and indicator values with detailed reporting
"""

import sqlite3
import sys
import argparse
from datetime import datetime, timedelta
from collections import defaultdict

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def colored(text, color):
    """Return colored text for terminal"""
    return f"{color}{text}{Colors.RESET}"

def print_header(text):
    """Print section header"""
    print("\n" + "=" * 80)
    print(colored(text, Colors.BOLD + Colors.CYAN))
    print("=" * 80)

def print_pass(text):
    """Print pass message"""
    print(colored(f"✓ {text}", Colors.GREEN))

def print_fail(text):
    """Print fail message"""
    print(colored(f"✗ {text}", Colors.RED))

def print_warn(text):
    """Print warning message"""
    print(colored(f"⚠ {text}", Colors.YELLOW))

def print_info(text):
    """Print info message"""
    print(colored(f"ℹ {text}", Colors.BLUE))


class DatabaseValidator:
    """Validates trading database structure and data quality"""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        self.cursor = None
        self.schema = {}
        self.issues = []
        self.warnings = []
        self.success = []
        
    def connect(self):
        """Connect to database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.cursor = self.conn.cursor()
            return True
        except sqlite3.Error as e:
            print_fail(f"Failed to connect to database: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
    
    def get_tables(self):
        """Get list of tables in database"""
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        return [row[0] for row in self.cursor.fetchall()]
    
    def get_table_schema(self, table_name):
        """Get schema for a specific table"""
        self.cursor.execute(f"PRAGMA table_info({table_name})")
        columns = {}
        for row in self.cursor.fetchall():
            col_id, col_name, col_type, not_null, default_val, pk = row
            columns[col_name] = {
                'type': col_type,
                'not_null': not_null,
                'primary_key': pk
            }
        return columns
    
    def detect_schema(self):
        """Auto-detect database schema"""
        print_header("DETECTING DATABASE SCHEMA")
        
        tables = self.get_tables()
        if not tables:
            print_fail("No tables found in database!")
            return False
        
        print_info(f"Found {len(tables)} table(s): {', '.join(tables)}")
        
        for table in tables:
            self.schema[table] = self.get_table_schema(table)
            
            # Identify column types
            base_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'timeframe', 'collected_at']
            indicator_columns = [col for col in self.schema[table].keys() if col not in base_columns]
            
            print_info(f"\n  Table: {table}")
            print(f"    Base columns: {len(base_columns)}")
            print(f"    Indicator columns: {len(indicator_columns)}")
            
            if indicator_columns:
                print(f"    Indicators: {', '.join(indicator_columns)}")
        
        return True
    
    def validate_table_structure(self, table_name):
        """Validate table has required base columns"""
        required_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'timeframe', 'collected_at']
        
        missing = []
        for col in required_columns:
            if col not in self.schema[table_name]:
                missing.append(col)
        
        if missing:
            self.issues.append(f"Table {table_name}: Missing required columns: {', '.join(missing)}")
            return False
        else:
            self.success.append(f"Table {table_name}: All required columns present")
            return True
    
    def validate_data_completeness(self, table_name, quick_mode=False):
        """Validate data completeness for a table"""
        
        # Get record counts per timeframe
        self.cursor.execute(f"""
            SELECT 
                timeframe,
                COUNT(*) as count,
                datetime(MIN(timestamp), 'unixepoch') as earliest,
                datetime(MAX(timestamp), 'unixepoch') as latest,
                datetime(MAX(collected_at), 'unixepoch') as last_collected
            FROM {table_name}
            GROUP BY timeframe
        """)
        
        timeframe_stats = self.cursor.fetchall()
        
        if not timeframe_stats:
            self.issues.append(f"Table {table_name}: No data found!")
            return False
        
        print(f"\n  {'Timeframe':<10} {'Records':<10} {'Status':<15} {'Last Collection':<20}")
        print(f"  {'-'*10} {'-'*10} {'-'*15} {'-'*20}")
        
        expected_timeframes = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']
        found_timeframes = [row[0] for row in timeframe_stats]
        
        all_ok = True
        for row in timeframe_stats:
            tf, count, earliest, latest, last_coll = row
            
            # Check if data is recent (within last 5 minutes)
            last_collection_dt = datetime.strptime(last_coll, '%Y-%m-%d %H:%M:%S')
            now = datetime.now()
            age_minutes = (now - last_collection_dt).total_seconds() / 60
            
            if age_minutes < 5:
                status = colored("✓ Current", Colors.GREEN)
            elif age_minutes < 60:
                status = colored("⚠ Stale", Colors.YELLOW)
                self.warnings.append(f"{table_name} {tf}: Data is {age_minutes:.0f} minutes old")
                all_ok = False
            else:
                status = colored("✗ Old", Colors.RED)
                self.issues.append(f"{table_name} {tf}: Data is {age_minutes:.0f} minutes old")
                all_ok = False
            
            print(f"  {tf:<10} {count:<10} {status:<24} {last_coll:<20}")
        
        # Check for missing timeframes
        missing_tfs = [tf for tf in expected_timeframes if tf not in found_timeframes]
        if missing_tfs:
            self.warnings.append(f"Table {table_name}: Missing timeframes: {', '.join(missing_tfs)}")
            print_warn(f"  Missing timeframes: {', '.join(missing_tfs)}")
            all_ok = False
        
        return all_ok
    
    def validate_indicator_values(self, table_name, indicator_columns):
        """Validate indicator column values"""
        
        if not indicator_columns:
            print_info(f"  No indicator columns to validate")
            return True
        
        print(f"\n  {'Indicator':<30} {'NULL Count':<12} {'Valid %':<10} {'Status'}")
        print(f"  {'-'*30} {'-'*12} {'-'*10} {'-'*15}")
        
        all_ok = True
        
        # Get total record count
        self.cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        total_records = self.cursor.fetchone()[0]
        
        for col in indicator_columns:
            # Count NULL values
            self.cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {col} IS NULL")
            null_count = self.cursor.fetchone()[0]
            
            # Count zero values (might indicate failed indicator)
            self.cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {col} = 0")
            zero_count = self.cursor.fetchone()[0]
            
            valid_count = total_records - null_count
            valid_pct = (valid_count / total_records * 100) if total_records > 0 else 0
            
            # Determine status
            if null_count == 0 and zero_count < (total_records * 0.1):  # Allow up to 10% zeros
                status = colored("✓ Pass", Colors.GREEN)
                self.success.append(f"{table_name} {col}: All values valid")
            elif null_count < (total_records * 0.05):  # Less than 5% NULL
                status = colored("⚠ Warning", Colors.YELLOW)
                self.warnings.append(f"{table_name} {col}: {null_count} NULL values ({100-valid_pct:.1f}%)")
                all_ok = False
            else:
                status = colored("✗ Fail", Colors.RED)
                self.issues.append(f"{table_name} {col}: {null_count} NULL values ({100-valid_pct:.1f}%)")
                all_ok = False
            
            print(f"  {col:<30} {null_count:<12} {valid_pct:>5.1f}%    {status}")
            
            # Show zero count as info if significant
            if zero_count > (total_records * 0.1):
                print_warn(f"    Note: {zero_count} zero values ({zero_count/total_records*100:.1f}%)")
        
        return all_ok
    
    def validate_ohlcv_ranges(self, table_name):
        """Validate OHLCV data ranges are reasonable"""
        
        # Get min/max values for OHLCV
        self.cursor.execute(f"""
            SELECT 
                MIN(open) as min_open, MAX(open) as max_open,
                MIN(high) as min_high, MAX(high) as max_high,
                MIN(low) as min_low, MAX(low) as max_low,
                MIN(close) as min_close, MAX(close) as max_close,
                MIN(volume) as min_volume, MAX(volume) as max_volume
            FROM {table_name}
        """)
        
        row = self.cursor.fetchone()
        if not row:
            return True
        
        min_o, max_o, min_h, max_h, min_l, max_l, min_c, max_c, min_v, max_v = row
        
        issues_found = False
        
        # Check for invalid values (negative, zero, or NULL)
        if min_o <= 0 or min_h <= 0 or min_l <= 0 or min_c <= 0:
            self.issues.append(f"{table_name}: Invalid OHLC values (≤ 0) detected")
            print_fail(f"  Invalid OHLC values detected (min: O={min_o}, H={min_h}, L={min_l}, C={min_c})")
            issues_found = True
        
        # Check High >= Low relationship
        self.cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE high < low")
        invalid_hl = self.cursor.fetchone()[0]
        if invalid_hl > 0:
            self.issues.append(f"{table_name}: {invalid_hl} records where High < Low")
            print_fail(f"  {invalid_hl} records where High < Low (invalid!)")
            issues_found = True
        
        # Check Open/Close within High/Low range
        self.cursor.execute(f"""
            SELECT COUNT(*) FROM {table_name} 
            WHERE open > high OR open < low OR close > high OR close < low
        """)
        invalid_oc = self.cursor.fetchone()[0]
        if invalid_oc > 0:
            self.issues.append(f"{table_name}: {invalid_oc} records where Open/Close outside High/Low range")
            print_fail(f"  {invalid_oc} records where Open/Close outside High/Low range")
            issues_found = True
        
        if not issues_found:
            self.success.append(f"{table_name}: All OHLCV values are valid")
            print_pass(f"  OHLCV ranges valid (Price range: {min_l:.2f} - {max_h:.2f})")
        
        return not issues_found
    
    def validate_full(self, specific_table=None, specific_indicator=None):
        """Run full validation"""
        
        print_header(f"VALIDATING DATABASE: {self.db_path}")
        print(f"Validation started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        tables = self.get_tables() if not specific_table else [specific_table]
        
        if not tables:
            print_fail("No tables to validate!")
            return False
        
        # Validate each table
        for table in tables:
            print_header(f"TABLE: {table.upper()}")
            
            # 1. Structure validation
            print("\n1. Structure Validation:")
            self.validate_table_structure(table)
            
            # 2. Data completeness
            print("\n2. Data Completeness:")
            self.validate_data_completeness(table)
            
            # 3. OHLCV ranges
            print("\n3. OHLCV Data Quality:")
            self.validate_ohlcv_ranges(table)
            
            # 4. Indicator validation
            base_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'timeframe', 'collected_at']
            indicator_columns = [col for col in self.schema[table].keys() if col not in base_columns]
            
            # Filter by specific indicator if requested
            if specific_indicator:
                indicator_columns = [col for col in indicator_columns if specific_indicator.lower() in col.lower()]
            
            if indicator_columns:
                print("\n4. Indicator Values:")
                self.validate_indicator_values(table, indicator_columns)
            
            # Get record count
            self.cursor.execute(f"SELECT COUNT(*) FROM {table}")
            record_count = self.cursor.fetchone()[0]
            print_info(f"\nTotal records: {record_count:,}")
        
        return True
    
    def validate_quick(self, specific_table=None):
        """Quick validation - show only problems"""
        
        print_header(f"QUICK VALIDATION: {self.db_path}")
        
        tables = self.get_tables() if not specific_table else [specific_table]
        
        for table in tables:
            # Check data freshness
            self.cursor.execute(f"""
                SELECT 
                    datetime(MAX(collected_at), 'unixepoch') as last_collected
                FROM {table}
            """)
            
            result = self.cursor.fetchone()
            if result and result[0]:
                last_collected = datetime.strptime(result[0], '%Y-%m-%d %H:%M:%S')
                age_minutes = (datetime.now() - last_collected).total_seconds() / 60
                
                if age_minutes < 5:
                    print_pass(f"{table}: Data is current ({age_minutes:.1f} minutes old)")
                elif age_minutes < 60:
                    print_warn(f"{table}: Data is stale ({age_minutes:.0f} minutes old)")
                else:
                    print_fail(f"{table}: Data is old ({age_minutes:.0f} minutes old)")
            
            # Check for NULL indicators
            base_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'timeframe', 'collected_at']
            indicator_columns = [col for col in self.schema[table].keys() if col not in base_columns]
            
            if indicator_columns:
                self.cursor.execute(f"SELECT COUNT(*) FROM {table}")
                total = self.cursor.fetchone()[0]
                
                for col in indicator_columns:
                    self.cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NULL")
                    null_count = self.cursor.fetchone()[0]
                    
                    if null_count > 0:
                        pct = (null_count / total * 100) if total > 0 else 0
                        if pct > 5:
                            print_fail(f"{table}.{col}: {null_count} NULL values ({pct:.1f}%)")
                        else:
                            print_warn(f"{table}.{col}: {null_count} NULL values ({pct:.1f}%)")
        
        return True
    
    def print_summary(self):
        """Print validation summary"""
        
        print_header("VALIDATION SUMMARY")
        
        total_checks = len(self.success) + len(self.warnings) + len(self.issues)
        
        print(f"\nTotal checks: {total_checks}")
        print_pass(f"Passed: {len(self.success)}")
        print_warn(f"Warnings: {len(self.warnings)}")
        print_fail(f"Failed: {len(self.issues)}")
        
        if self.issues:
            print_header("CRITICAL ISSUES")
            for issue in self.issues:
                print_fail(issue)
        
        if self.warnings:
            print_header("WARNINGS")
            for warning in self.warnings:
                print_warn(warning)
        
        # Overall status
        print()
        if not self.issues:
            if not self.warnings:
                print_pass("✓ DATABASE VALIDATION PASSED - NO ISSUES FOUND")
            else:
                print_warn("⚠ DATABASE VALIDATION PASSED WITH WARNINGS")
        else:
            print_fail("✗ DATABASE VALIDATION FAILED - ISSUES FOUND")
        
        print()


def main():
    """Main function"""
    
    parser = argparse.ArgumentParser(
        description='Validate Trading Database',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate_sqlite.py --quick                    # Quick check
  python validate_sqlite.py --full                     # Full validation
  python validate_sqlite.py --symbol BTCUSD            # Check specific symbol
  python validate_sqlite.py --indicator fractal        # Check specific indicator
  python validate_sqlite.py --db "C:\\path\\to\\db.db" # Custom database path
        """
    )
    
    parser.add_argument('--db', default=r'C:\Scripts\database\trading_data.db',
                       help='Path to database file')
    parser.add_argument('--quick', action='store_true',
                       help='Quick validation (show only problems)')
    parser.add_argument('--full', action='store_true',
                       help='Full validation (detailed report)')
    parser.add_argument('--symbol', type=str,
                       help='Validate specific symbol table')
    parser.add_argument('--indicator', type=str,
                       help='Validate specific indicator')
    
    args = parser.parse_args()
    
    # Default to quick mode if nothing specified
    if not args.quick and not args.full:
        args.quick = True
    
    # Create validator
    validator = DatabaseValidator(args.db)
    
    # Connect to database
    if not validator.connect():
        return 1
    
    # Detect schema
    if not validator.detect_schema():
        validator.close()
        return 1
    
    # Run validation
    try:
        if args.quick:
            validator.validate_quick(args.symbol)
        else:
            validator.validate_full(args.symbol, args.indicator)
        
        # Print summary
        validator.print_summary()
        
    except Exception as e:
        print_fail(f"Validation error: {e}")
        return 1
    finally:
        validator.close()
    
    # Return exit code based on issues found
    return 1 if validator.issues else 0


if __name__ == "__main__":
    sys.exit(main())
