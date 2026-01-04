//+------------------------------------------------------------------+
//|                                                SymbolUtils.mqh   |
//|                        Trading Alerts SaaS - Part 20             |
//|                                                                   |
//| Symbol normalization and utility functions for MQL5 Service      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| List of supported trading symbols                                 |
//+------------------------------------------------------------------+
const string SUPPORTED_SYMBOLS[] = {
    "AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
    "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
    "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"
};

//+------------------------------------------------------------------+
//| Known broker-specific suffixes to strip                           |
//+------------------------------------------------------------------+
const string BROKER_SUFFIXES[] = {".i", ".pro", ".raw", ".std", ".e", ".z", ".ecn", ".c", "m", "."};

//+------------------------------------------------------------------+
//| Normalize symbol by removing broker-specific suffixes             |
//|                                                                   |
//| Different brokers use different symbol names:                     |
//|   - EURUSD.i    (Interactive Brokers style)                      |
//|   - EURUSDm    (micro lot suffix)                                 |
//|   - EURUSD.pro (pro account suffix)                              |
//|   - EURUSD.raw (raw spread suffix)                               |
//|                                                                   |
//| This function normalizes all to: EURUSD                          |
//+------------------------------------------------------------------+
string NormalizeSymbol(string broker_symbol)
{
    string normalized = broker_symbol;

    // Try to match and remove each known suffix
    for(int i = 0; i < ArraySize(BROKER_SUFFIXES); i++)
    {
        string suffix = BROKER_SUFFIXES[i];
        int suffix_len = StringLen(suffix);
        int symbol_len = StringLen(normalized);

        // Check if symbol ends with this suffix
        if(symbol_len > suffix_len)
        {
            string ending = StringSubstr(normalized, symbol_len - suffix_len, suffix_len);
            if(StringCompare(ending, suffix, false) == 0)
            {
                // Remove the suffix
                normalized = StringSubstr(normalized, 0, symbol_len - suffix_len);
                break;
            }
        }
    }

    // Special case: some brokers use suffixes at specific positions
    // Check for known base symbols and extract them
    for(int i = 0; i < ArraySize(SUPPORTED_SYMBOLS); i++)
    {
        int base_len = StringLen(SUPPORTED_SYMBOLS[i]);
        if(StringLen(normalized) >= base_len)
        {
            string base_part = StringSubstr(normalized, 0, base_len);
            if(StringCompare(base_part, SUPPORTED_SYMBOLS[i], false) == 0)
            {
                normalized = SUPPORTED_SYMBOLS[i];
                break;
            }
        }
    }

    // Convert to uppercase for consistency
    StringToUpper(normalized);

    return normalized;
}

//+------------------------------------------------------------------+
//| Check if symbol is in the supported symbols list                  |
//|                                                                   |
//| Returns true if the normalized symbol is one of the 15 supported |
//| trading symbols for the Trading Alerts SaaS platform.            |
//+------------------------------------------------------------------+
bool IsSymbolSupported(string symbol)
{
    string normalized = NormalizeSymbol(symbol);

    for(int i = 0; i < ArraySize(SUPPORTED_SYMBOLS); i++)
    {
        if(StringCompare(SUPPORTED_SYMBOLS[i], normalized, false) == 0)
            return true;
    }

    return false;
}

//+------------------------------------------------------------------+
//| Get the normalized symbol name for the current chart              |
//+------------------------------------------------------------------+
string GetNormalizedCurrentSymbol()
{
    return NormalizeSymbol(_Symbol);
}

//+------------------------------------------------------------------+
//| Create SQLite table for a symbol if it doesn't exist              |
//|                                                                   |
//| Schema matches the architecture design:                           |
//| - timestamp: INTEGER PRIMARY KEY (Unix timestamp UTC)             |
//| - open, high, low, close: REAL (OHLC prices)                     |
//| - fractals: TEXT (JSON with peaks/bottoms)                       |
//| - horizontal_trendlines: TEXT (JSON with 6 line arrays)          |
//| - diagonal_trendlines: TEXT (JSON with 6 line arrays)            |
//| - momentum_candles: TEXT (JSON array)                            |
//| - keltner_channels: TEXT (JSON with 10 band arrays)              |
//| - tema, hrma, smma: REAL (moving average values)                 |
//| - zigzag: TEXT (JSON with peaks/bottoms)                         |
//+------------------------------------------------------------------+
bool CreateTableIfNotExists(int db, string symbol)
{
    if(db == INVALID_HANDLE)
    {
        Print("CreateTableIfNotExists: Invalid database handle");
        return false;
    }

    // Normalize the symbol name for table name
    string table_name = NormalizeSymbol(symbol);

    // Build CREATE TABLE SQL statement
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
        table_name
    );

    if(!DatabaseExecute(db, sql))
    {
        Print("Failed to create table ", table_name, ": ", GetLastError());
        return false;
    }

    // Create index on timestamp for efficient queries
    string index_sql = StringFormat(
        "CREATE INDEX IF NOT EXISTS idx_%s_timestamp ON %s(timestamp)",
        table_name, table_name
    );

    if(!DatabaseExecute(db, index_sql))
    {
        Print("Failed to create index for ", table_name, ": ", GetLastError());
        // Continue anyway - table was created successfully
    }

    Print("Table ", table_name, " ready");
    return true;
}

//+------------------------------------------------------------------+
//| Get count of records in a symbol's table                          |
//+------------------------------------------------------------------+
long GetTableRowCount(int db, string symbol)
{
    if(db == INVALID_HANDLE)
        return -1;

    string table_name = NormalizeSymbol(symbol);
    string sql = StringFormat("SELECT COUNT(*) FROM %s", table_name);

    int request = DatabasePrepare(db, sql);
    if(request == INVALID_HANDLE)
        return -1;

    long count = 0;
    if(DatabaseRead(request))
    {
        DatabaseColumnLong(request, 0, count);
    }

    DatabaseFinalize(request);
    return count;
}

//+------------------------------------------------------------------+
//| Get the latest timestamp in a symbol's table                      |
//+------------------------------------------------------------------+
datetime GetLatestTimestamp(int db, string symbol)
{
    if(db == INVALID_HANDLE)
        return 0;

    string table_name = NormalizeSymbol(symbol);
    string sql = StringFormat("SELECT MAX(timestamp) FROM %s", table_name);

    int request = DatabasePrepare(db, sql);
    if(request == INVALID_HANDLE)
        return 0;

    long timestamp = 0;
    if(DatabaseRead(request))
    {
        DatabaseColumnLong(request, 0, timestamp);
    }

    DatabaseFinalize(request);
    return (datetime)timestamp;
}

//+------------------------------------------------------------------+
//| Cleanup old records to maintain table size limit                  |
//| Keeps only the most recent 'max_records' entries                  |
//+------------------------------------------------------------------+
bool CleanupOldRecords(int db, string symbol, int max_records = 100000)
{
    if(db == INVALID_HANDLE)
        return false;

    string table_name = NormalizeSymbol(symbol);

    // Delete records older than the Nth most recent
    string sql = StringFormat(
        "DELETE FROM %s WHERE timestamp < ("
        "SELECT timestamp FROM %s ORDER BY timestamp DESC LIMIT 1 OFFSET %d"
        ")",
        table_name, table_name, max_records - 1
    );

    if(!DatabaseExecute(db, sql))
    {
        int error = GetLastError();
        // Error 5126 is "no such row" which is fine if table is small
        if(error != 5126)
        {
            Print("Failed to cleanup old records for ", table_name, ": ", error);
            return false;
        }
    }

    return true;
}

//+------------------------------------------------------------------+
