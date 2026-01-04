//+------------------------------------------------------------------+
//|                                              DataCollector.mq5   |
//|                        Trading Alerts SaaS - Part 20             |
//|                                                                   |
//| MQL5 Service for collecting indicator data and storing to SQLite |
//|                                                                   |
//| This service runs 24/7 without requiring a chart window.         |
//| It reads indicator buffers directly from MT5 using CopyBuffer()  |
//| and stores the data in SQLite every 30 seconds.                  |
//|                                                                   |
//| IMPORTANT: This is a SERVICE, not an Expert Advisor.             |
//| Start via: Tools -> Services -> Start                            |
//+------------------------------------------------------------------+
#property service
#property copyright "Trading Alerts SaaS"
#property version   "1.00"
#property description "Data collector service for Trading Alerts SaaS Part 20"

//+------------------------------------------------------------------+
//| Include files                                                     |
//+------------------------------------------------------------------+
#include <IndicatorBuffers.mqh>
#include <SymbolUtils.mqh>

//+------------------------------------------------------------------+
//| Input parameters                                                  |
//+------------------------------------------------------------------+
input int    CollectionInterval = 30;                                    // Data collection interval (seconds)
input string DatabasePath = "C:\\MT5Data\\trading_data.db";             // SQLite database path
input string SymbolToMonitor = "";                                       // Symbol to monitor (empty = use chart symbol)
input int    BufferSize = 100;                                           // Number of bars to read from indicators
input bool   EnableLogging = true;                                       // Enable detailed logging

//+------------------------------------------------------------------+
//| Global variables - Indicator handles                              |
//+------------------------------------------------------------------+
int g_h_fractal = INVALID_HANDLE;        // Fractal Horizontal Line_V5
int g_h_hline = INVALID_HANDLE;          // Horizontal lines (same indicator)
int g_h_dline = INVALID_HANDLE;          // Fractal Diagonal Line_V4
int g_h_momentum = INVALID_HANDLE;       // Body Size Momentum Candle_V2
int g_h_keltner = INVALID_HANDLE;        // Keltner Channel_ATF_10 Bands
int g_h_ma = INVALID_HANDLE;             // TEMA_HRMA_SMA-SMMA_Modified Buffers
int g_h_zigzag = INVALID_HANDLE;         // ZigZagColor & MarketStructure

//+------------------------------------------------------------------+
//| Global variables - Database                                       |
//+------------------------------------------------------------------+
int g_db = INVALID_HANDLE;               // SQLite database handle
string g_symbol = "";                     // Normalized symbol name
string g_raw_symbol = "";                 // Original broker symbol

//+------------------------------------------------------------------+
//| Service program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
    Print("========================================");
    Print("DataCollector Service Starting...");
    Print("========================================");

    //--- Determine which symbol to monitor
    if(SymbolToMonitor != "")
        g_raw_symbol = SymbolToMonitor;
    else
        g_raw_symbol = _Symbol;

    //--- Normalize the symbol name
    g_symbol = NormalizeSymbol(g_raw_symbol);

    //--- Validate symbol is supported
    if(!IsSymbolSupported(g_symbol))
    {
        Print("ERROR: Symbol ", g_symbol, " is not supported");
        Print("Supported symbols: AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD");
        return;
    }

    Print("Monitoring symbol: ", g_raw_symbol, " -> ", g_symbol);
    Print("Collection interval: ", CollectionInterval, " seconds");
    Print("Database path: ", DatabasePath);

    //--- Initialize database
    if(!InitializeDatabase())
    {
        Print("ERROR: Failed to initialize database");
        return;
    }

    //--- Initialize indicator handles
    if(!InitializeIndicators())
    {
        Print("ERROR: Failed to initialize indicators");
        CleanupAndExit();
        return;
    }

    Print("DataCollector Service started successfully");
    Print("----------------------------------------");

    //--- Main collection loop
    int cycle_count = 0;
    datetime last_collection = 0;

    while(!IsStopped())
    {
        //--- Get current UTC time
        datetime current_time = TimeGMT();

        //--- Check if it's time to collect data
        if(current_time - last_collection >= CollectionInterval)
        {
            cycle_count++;

            if(EnableLogging)
                Print("Collection cycle #", cycle_count, " at ", TimeToString(current_time, TIME_DATE|TIME_SECONDS), " UTC");

            //--- Collect and store data
            if(!CollectAndStoreData())
            {
                Print("WARNING: Data collection failed in cycle #", cycle_count);
            }
            else if(EnableLogging)
            {
                Print("Data stored successfully for ", g_symbol);
            }

            last_collection = current_time;

            //--- Periodic cleanup (every 1000 cycles)
            if(cycle_count % 1000 == 0)
            {
                CleanupOldRecords(g_db, g_symbol, 100000);
                Print("Performed periodic cleanup at cycle #", cycle_count);
            }
        }

        //--- Sleep for 1 second (check for stop signal more frequently)
        Sleep(1000);
    }

    //--- Service stopped
    CleanupAndExit();
    Print("========================================");
    Print("DataCollector Service stopped");
    Print("Total collection cycles: ", cycle_count);
    Print("========================================");
}

//+------------------------------------------------------------------+
//| Initialize SQLite database                                        |
//+------------------------------------------------------------------+
bool InitializeDatabase()
{
    //--- Open or create database
    g_db = DatabaseOpen(DatabasePath, DATABASE_OPEN_READWRITE | DATABASE_OPEN_CREATE | DATABASE_OPEN_COMMON);

    if(g_db == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open database: ", DatabasePath);
        Print("Error code: ", GetLastError());
        return false;
    }

    Print("Database opened successfully");

    //--- Create table for the symbol if it doesn't exist
    if(!CreateTableIfNotExists(g_db, g_symbol))
    {
        Print("ERROR: Failed to create table for ", g_symbol);
        return false;
    }

    //--- Log current row count
    long row_count = GetTableRowCount(g_db, g_symbol);
    Print("Table ", g_symbol, " has ", row_count, " existing rows");

    return true;
}

//+------------------------------------------------------------------+
//| Initialize all indicator handles                                  |
//+------------------------------------------------------------------+
bool InitializeIndicators()
{
    Print("Initializing indicators for ", g_raw_symbol, "...");

    //--- Fractal Horizontal Line_V5 (provides fractals and horizontal lines)
    g_h_fractal = iCustom(g_raw_symbol, PERIOD_CURRENT, "Fractal Horizontal Line_V5");
    if(g_h_fractal == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load Fractal Horizontal Line_V5 indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: Fractal Horizontal Line_V5");
    }

    //--- Use same handle for horizontal lines
    g_h_hline = g_h_fractal;

    //--- Fractal Diagonal Line_V4
    g_h_dline = iCustom(g_raw_symbol, PERIOD_CURRENT, "Fractal Diagonal Line_V4");
    if(g_h_dline == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load Fractal Diagonal Line_V4 indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: Fractal Diagonal Line_V4");
    }

    //--- Body Size Momentum Candle_V2
    g_h_momentum = iCustom(g_raw_symbol, PERIOD_CURRENT, "Body Size Momentum Candle_V2");
    if(g_h_momentum == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load Body Size Momentum Candle_V2 indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: Body Size Momentum Candle_V2");
    }

    //--- Keltner Channel_ATF_10 Bands
    g_h_keltner = iCustom(g_raw_symbol, PERIOD_CURRENT, "Keltner Channel_ATF_10 Bands");
    if(g_h_keltner == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load Keltner Channel_ATF_10 Bands indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: Keltner Channel_ATF_10 Bands");
    }

    //--- TEMA_HRMA_SMA-SMMA_Modified Buffers
    g_h_ma = iCustom(g_raw_symbol, PERIOD_CURRENT, "TEMA_HRMA_SMA-SMMA_Modified Buffers");
    if(g_h_ma == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load TEMA_HRMA_SMA-SMMA_Modified Buffers indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: TEMA_HRMA_SMA-SMMA_Modified Buffers");
    }

    //--- ZigZagColor & MarketStructure_JSON Export_V27_TXT Input
    g_h_zigzag = iCustom(g_raw_symbol, PERIOD_CURRENT, "ZigZagColor & MarketStructure_JSON Export_V27_TXT Input");
    if(g_h_zigzag == INVALID_HANDLE)
    {
        Print("WARNING: Failed to load ZigZag indicator");
        Print("Error: ", GetLastError());
    }
    else
    {
        Print("Loaded: ZigZagColor & MarketStructure");
    }

    //--- Check if at least some indicators loaded
    int loaded_count = 0;
    if(g_h_fractal != INVALID_HANDLE) loaded_count++;
    if(g_h_dline != INVALID_HANDLE) loaded_count++;
    if(g_h_momentum != INVALID_HANDLE) loaded_count++;
    if(g_h_keltner != INVALID_HANDLE) loaded_count++;
    if(g_h_ma != INVALID_HANDLE) loaded_count++;
    if(g_h_zigzag != INVALID_HANDLE) loaded_count++;

    Print("Successfully loaded ", loaded_count, "/6 indicators");

    //--- Require at least the fractal indicator for basic operation
    if(g_h_fractal == INVALID_HANDLE)
    {
        Print("ERROR: Fractal indicator is required but failed to load");
        return false;
    }

    return true;
}

//+------------------------------------------------------------------+
//| Collect data from indicators and store to SQLite                  |
//+------------------------------------------------------------------+
bool CollectAndStoreData()
{
    //--- Get OHLC data
    MqlRates rates[];
    ArraySetAsSeries(rates, true);

    if(CopyRates(g_raw_symbol, PERIOD_CURRENT, 0, 1, rates) < 1)
    {
        Print("ERROR: Failed to copy rates for ", g_raw_symbol);
        return false;
    }

    //--- CRITICAL: Use UTC time for timestamp (TimeGMT instead of TimeCurrent)
    //--- This avoids timezone/DST confusion between MT5 server time and databases
    long unix_timestamp = (long)TimeGMT();

    //--- Read indicator buffers and convert to JSON
    string fractals_json = GetFractalsJSON(g_h_fractal, BufferSize);
    string hlines_json = GetHorizontalLinesJSON(g_h_hline, BufferSize);
    string dlines_json = GetDiagonalLinesJSON(g_h_dline, BufferSize);
    string momentum_json = GetMomentumJSON(g_h_momentum, BufferSize);
    string keltner_json = GetKeltnerJSON(g_h_keltner, BufferSize);

    //--- Get moving average values (single values for current bar)
    double tema_value = GetTEMA(g_h_ma, 0);
    double hrma_value = GetHRMA(g_h_ma, 0);
    double smma_value = GetSMMA(g_h_ma, 0);

    string zigzag_json = GetZigZagJSON(g_h_zigzag, BufferSize);

    //--- Handle EMPTY_VALUE for moving averages
    string tema_str = (tema_value != EMPTY_VALUE) ? DoubleToString(tema_value, 5) : "NULL";
    string hrma_str = (hrma_value != EMPTY_VALUE) ? DoubleToString(hrma_value, 5) : "NULL";
    string smma_str = (smma_value != EMPTY_VALUE) ? DoubleToString(smma_value, 5) : "NULL";

    //--- Escape single quotes in JSON strings for SQL
    StringReplace(fractals_json, "'", "''");
    StringReplace(hlines_json, "'", "''");
    StringReplace(dlines_json, "'", "''");
    StringReplace(momentum_json, "'", "''");
    StringReplace(keltner_json, "'", "''");
    StringReplace(zigzag_json, "'", "''");

    //--- Build INSERT OR REPLACE SQL statement
    string sql = StringFormat(
        "INSERT OR REPLACE INTO %s "
        "(timestamp, open, high, low, close, fractals, horizontal_trendlines, "
        "diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag) "
        "VALUES (%I64d, %.5f, %.5f, %.5f, %.5f, '%s', '%s', '%s', '%s', '%s', %s, %s, %s, '%s')",
        g_symbol,
        unix_timestamp,
        rates[0].open, rates[0].high, rates[0].low, rates[0].close,
        fractals_json, hlines_json, dlines_json, momentum_json, keltner_json,
        tema_str, hrma_str, smma_str,
        zigzag_json
    );

    //--- Execute SQL
    if(!DatabaseExecute(g_db, sql))
    {
        Print("ERROR: Database insert failed");
        Print("Error code: ", GetLastError());
        if(EnableLogging)
        {
            Print("SQL (truncated): ", StringSubstr(sql, 0, 500));
        }
        return false;
    }

    return true;
}

//+------------------------------------------------------------------+
//| Release indicator handles                                         |
//+------------------------------------------------------------------+
void ReleaseIndicators()
{
    Print("Releasing indicator handles...");

    if(g_h_fractal != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_fractal);
        g_h_fractal = INVALID_HANDLE;
    }

    // g_h_hline shares handle with g_h_fractal, no need to release separately

    if(g_h_dline != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_dline);
        g_h_dline = INVALID_HANDLE;
    }

    if(g_h_momentum != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_momentum);
        g_h_momentum = INVALID_HANDLE;
    }

    if(g_h_keltner != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_keltner);
        g_h_keltner = INVALID_HANDLE;
    }

    if(g_h_ma != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_ma);
        g_h_ma = INVALID_HANDLE;
    }

    if(g_h_zigzag != INVALID_HANDLE)
    {
        IndicatorRelease(g_h_zigzag);
        g_h_zigzag = INVALID_HANDLE;
    }

    Print("Indicator handles released");
}

//+------------------------------------------------------------------+
//| Cleanup and exit                                                  |
//+------------------------------------------------------------------+
void CleanupAndExit()
{
    //--- Release indicators
    ReleaseIndicators();

    //--- Close database
    if(g_db != INVALID_HANDLE)
    {
        DatabaseClose(g_db);
        g_db = INVALID_HANDLE;
        Print("Database closed");
    }
}

//+------------------------------------------------------------------+
