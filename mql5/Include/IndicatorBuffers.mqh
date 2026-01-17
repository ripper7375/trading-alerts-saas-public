//+------------------------------------------------------------------+
//| IndicatorBuffers.mqh - Indicator buffer reading functions        |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Database helper functions                                         |
//+------------------------------------------------------------------+

// Create table if not exists
bool CreateTableIfNotExists(int db, string symbol)
{
    string sql = StringFormat(
        "CREATE TABLE IF NOT EXISTS %s ("
        "timestamp INTEGER PRIMARY KEY, "
        "open REAL, high REAL, low REAL, close REAL, "
        "fractals TEXT, "
        "horizontal_trendlines TEXT, "
        "diagonal_trendlines TEXT, "
        "momentum_candles TEXT, "
        "keltner_channels TEXT, "
        "tema REAL, hrma REAL, smma REAL, "
        "zigzag TEXT"
        ")",
        symbol
    );
    
    return DatabaseExecute(db, sql);
}

// Get row count for table
long GetTableRowCount(int db, string symbol)
{
    string sql = StringFormat("SELECT COUNT(*) FROM %s", symbol);
    int request = DatabasePrepare(db, sql);
    
    if(request == INVALID_HANDLE)
        return 0;
    
    long count = 0;
    if(DatabaseRead(request))
    {
        DatabaseColumnLong(request, 0, count);
    }
    
    DatabaseFinalize(request);
    return count;
}

// Cleanup old records (keep last N records)
void CleanupOldRecords(int db, string symbol, int keep_records)
{
    string sql = StringFormat(
        "DELETE FROM %s WHERE timestamp NOT IN "
        "(SELECT timestamp FROM %s ORDER BY timestamp DESC LIMIT %d)",
        symbol, symbol, keep_records
    );
    
    DatabaseExecute(db, sql);
}

//+------------------------------------------------------------------+
//| Indicator buffer reading functions                                |
//+------------------------------------------------------------------+

// Placeholder functions - return empty/null data for now
// These will need to be implemented based on actual indicator buffer layouts

string GetFractalsJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read fractal buffers and convert to JSON
    return "{\"fractals\":[]}";
}

string GetHorizontalLinesJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read horizontal line buffers and convert to JSON
    return "{\"lines\":[]}";
}

string GetDiagonalLinesJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read diagonal line buffers and convert to JSON
    return "{\"lines\":[]}";
}

string GetMomentumJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read momentum buffers and convert to JSON
    return "{\"candles\":[]}";
}

string GetKeltnerJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read Keltner buffers and convert to JSON
    return "{\"bands\":[]}";
}

double GetTEMA(int handle, int shift)
{
    if(handle == INVALID_HANDLE) return EMPTY_VALUE;
    
    double buffer[];
    if(CopyBuffer(handle, 0, shift, 1, buffer) > 0)
        return buffer[0];
    
    return EMPTY_VALUE;
}

double GetHRMA(int handle, int shift)
{
    if(handle == INVALID_HANDLE) return EMPTY_VALUE;
    
    double buffer[];
    if(CopyBuffer(handle, 1, shift, 1, buffer) > 0)
        return buffer[0];
    
    return EMPTY_VALUE;
}

double GetSMMA(int handle, int shift)
{
    if(handle == INVALID_HANDLE) return EMPTY_VALUE;
    
    double buffer[];
    if(CopyBuffer(handle, 2, shift, 1, buffer) > 0)
        return buffer[0];
    
    return EMPTY_VALUE;
}

string GetZigZagJSON(int handle, int count)
{
    if(handle == INVALID_HANDLE) return "{}";
    // TODO: Read ZigZag buffers and convert to JSON
    return "{\"zigzag\":[]}";
}
