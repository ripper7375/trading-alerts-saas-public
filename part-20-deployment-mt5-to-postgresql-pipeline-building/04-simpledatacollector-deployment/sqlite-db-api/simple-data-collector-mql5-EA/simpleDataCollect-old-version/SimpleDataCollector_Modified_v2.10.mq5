//+------------------------------------------------------------------+
//|                                   SimpleDataCollector_Modified.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.10"
#property strict

// Include SQLite3 library
#include <SQLite3\SQLite3Base.mqh>

// Input parameters
input int CollectionInterval = 30;  // Collection interval in seconds
input string DatabasePath = "C:/Scripts/database/trading_data.db";  // SQLite database path (relative to Files folder)
input string MonitorSymbol = "";  // Symbol to monitor (empty = current chart symbol)

// Indicator parameters (matching indicator defaults)
input int InpMAPeriod = 2;              // SMA Period
input int InpSMMAPeriod = 36;           // SMMA Period
input int len_hrma = 18;                // HRMA Period
input int InpPeriodEMA = 9;             // TEMA Period
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_TYPICAL; // Applied price

// Global variables
datetime lastCollectionTime = 0;
CSQLite3Base db;  // SQLite database object
string currentSymbol = "";     // Original symbol with suffix (e.g., "EURUSD.i")
string tableName = "";         // Sanitized table name (e.g., "eurusd")

// Indicator handle
int g_h_moving_averages = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| Sanitize symbol name for safe table naming                        |
//| Removes broker suffixes and special characters                    |
//+------------------------------------------------------------------+
string SanitizeSymbolName(string symbol)
{
   string sanitized = symbol;
   
   // Remove common broker suffixes
   StringReplace(sanitized, ".i", "");      // ICMarkets
   StringReplace(sanitized, ".a", "");      // Alpari
   StringReplace(sanitized, ".raw", "");    // Raw spread
   StringReplace(sanitized, ".pro", "");    // Pro account
   StringReplace(sanitized, ".ecn", "");    // ECN account
   StringReplace(sanitized, ".std", "");    // Standard account
   StringReplace(sanitized, ".m", "");      // Micro account
   StringReplace(sanitized, ".c", "");      // Cent account
   StringReplace(sanitized, ".", "");       // Remove any remaining dots
   
   // Replace special characters with underscores
   StringReplace(sanitized, "#", "_");
   StringReplace(sanitized, " ", "_");
   StringReplace(sanitized, "-", "_");
   
   // Convert to lowercase for consistency
   StringToLower(sanitized);
   
   return sanitized;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   // Determine which symbol to monitor
   if(MonitorSymbol == "")
      currentSymbol = _Symbol;  // Auto-detect from chart (includes suffix)
   else
      currentSymbol = MonitorSymbol;
   
   // Sanitize symbol name for database table
   tableName = SanitizeSymbolName(currentSymbol);
   
   Print("=================================================");
   Print("SimpleDataCollector_Modified Starting...");
   Print("Chart Symbol: ", _Symbol);                    // Show what chart this is
   Print("Monitor Symbol: ", currentSymbol);            // Show what we're collecting (with suffix)
   Print("Database Table: ", tableName);                // Show sanitized table name
   Print("Collection Interval: ", CollectionInterval, " seconds");
   Print("Database: ", DatabasePath);
   Print("Indicator: TEMA_HRMA_SMA-SMMA_Modified Buffers");
   Print("=================================================");
   
   // Initialize indicator (uses ORIGINAL symbol name with suffix)
   if(!InitializeIndicator())
   {
      Print("ERROR: Failed to initialize indicator");
      return INIT_FAILED;
   }
   
   Print("✓ Indicator loaded successfully for ", currentSymbol);
   
   // Connect to database
   int result = db.Connect(DatabasePath);
   
   if(result != SQLITE_OK)
   {
      Print("ERROR: Failed to connect to database: ", DatabasePath);
      Print("Error: ", db.ErrorMsg());
      return INIT_FAILED;
   }
   
   Print("✓ Database connected successfully");
   
   // Create table for this symbol
   if(!CreateSymbolTable())
   {
      Print("ERROR: Failed to create table for ", currentSymbol);
      return INIT_FAILED;
   }
   
   Print("✓ Table created/verified: ", tableName);
   Print("✓ SimpleDataCollector_Modified initialized successfully");
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Release indicator handle
   if(g_h_moving_averages != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_moving_averages);
      g_h_moving_averages = INVALID_HANDLE;
      Print("Indicator handle released");
   }
   
   db.Disconnect();
   Print("SimpleDataCollector_Modified stopped. Database disconnected.");
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check if it's time to collect data
   datetime currentTime = TimeCurrent();
   
   if(currentTime - lastCollectionTime >= CollectionInterval)
   {
      CollectAndStoreData();
      lastCollectionTime = currentTime;
   }
}

//+------------------------------------------------------------------+
//| Initialize indicator                                              |
//+------------------------------------------------------------------+
bool InitializeIndicator()
{
   Print("Initializing TEMA_HRMA_SMA-SMMA indicator for ", currentSymbol, "...");
   
   // Load indicator with parameters
   // IMPORTANT: Use currentSymbol (with suffix) for MT5 to find correct data
   g_h_moving_averages = iCustom(
      currentSymbol,      // Use original symbol name (e.g., "EURUSD.i")
      PERIOD_CURRENT, 
      "TEMA_HRMA_SMA-SMMA_Modified Buffers",
      InpMAPeriod,        // SMA Period
      0,                  // SMA Shift
      InpAppliedPrice,    // Applied price
      clrNONE,           // SMA Color (not used)
      1,                  // SMA Width
      InpSMMAPeriod,      // SMMA Period
      0,                  // SMMA Shift
      clrBlue,           // SMMA Color (not used)
      2,                  // SMMA Width
      len_hrma,           // HRMA Period
      0,                  // HRMA Shift
      clrMediumTurquoise, // HRMA Color (not used)
      2,                  // HRMA Width
      InpPeriodEMA,       // TEMA Period
      0,                  // TEMA Shift
      clrGray,           // TEMA Color (not used)
      1                   // TEMA Width
   );
   
   if(g_h_moving_averages == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   
   // Wait for indicator to calculate
   Print("Waiting for indicator to initialize (3 seconds)...");
   Sleep(3000);
   
   // Verify indicator is ready
   int bars_calculated = BarsCalculated(g_h_moving_averages);
   if(bars_calculated <= 0)
   {
      Print("WARNING: Indicator not ready yet. Bars calculated: ", bars_calculated);
   }
   else
   {
      Print("Indicator ready. Bars calculated: ", bars_calculated);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Create table for symbol                                           |
//+------------------------------------------------------------------+
bool CreateSymbolTable()
{
   // Use sanitized table name (without suffix)
   string createTableSQL = StringFormat(
      "CREATE TABLE IF NOT EXISTS [%s] ("  // Brackets handle any remaining special chars
      "timestamp INTEGER, "
      "open REAL NOT NULL, "
      "high REAL NOT NULL, "
      "low REAL NOT NULL, "
      "close REAL NOT NULL, "
      "volume INTEGER, "
      "timeframe TEXT, "
      "tema REAL, "           // TEMA indicator value
      "hrma REAL, "           // HRMA indicator value
      "smma REAL, "           // SMMA indicator value
      "collected_at INTEGER, "
      "PRIMARY KEY (timestamp, timeframe)"
      ")",
      tableName
   );
   
   int result = db.Exec(createTableSQL);
   
   if(result != SQLITE_OK)
   {
      Print("ERROR: Failed to create table");
      Print("SQL: ", createTableSQL);
      Print("Error: ", db.ErrorMsg());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Collect and store OHLC data + indicators                          |
//+------------------------------------------------------------------+
void CollectAndStoreData()
{
   Print("--- Collecting data at ", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), " ---");
   
   // Define timeframes
   ENUM_TIMEFRAMES timeframes[] = {
      PERIOD_M5, PERIOD_M15, PERIOD_M30, 
      PERIOD_H1, PERIOD_H2, PERIOD_H4, 
      PERIOD_H8, PERIOD_H12, PERIOD_D1
   };
   
   string timeframeNames[] = {
      "M5", "M15", "M30", 
      "H1", "H2", "H4", 
      "H8", "H12", "D1"
   };
   
   int totalInserted = 0;
   int totalSkipped = 0;
   
   // Begin transaction for better performance
   db.Exec("BEGIN TRANSACTION");
   
   // Collect data for each timeframe
   for(int i = 0; i < ArraySize(timeframes); i++)
   {
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      
      // Get the last 250 candles
      // IMPORTANT: Use currentSymbol (with suffix) to get correct MT5 data
      int copied = CopyRates(currentSymbol, timeframes[i], 0, 250, rates);
      
      if(copied > 0)
      {
         int inserted = 0;
         
         // Insert each candle
         for(int j = 0; j < copied; j++)
         {
            if(InsertCandleWithIndicators(rates[j], timeframeNames[i], timeframes[i], j))
               inserted++;
         }
         
         totalInserted += inserted;
         
         if(inserted > 0)
            Print("✓ ", currentSymbol, " ", timeframeNames[i], ": Inserted ", inserted, "/", copied, " candles");
         else
            totalSkipped += copied;
      }
      else
      {
         Print("⚠ Failed to copy rates for ", currentSymbol, " ", timeframeNames[i]);
      }
   }
   
   // Commit transaction
   db.Exec("COMMIT");
   
   Print("--- Collection complete. Inserted: ", totalInserted, ", Skipped: ", totalSkipped, " ---");
}

//+------------------------------------------------------------------+
//| Insert candle with indicator values into database                 |
//+------------------------------------------------------------------+
bool InsertCandleWithIndicators(MqlRates &rate, string timeframe, ENUM_TIMEFRAMES period, int shift)
{
   datetime collectedAt = TimeCurrent();
   
   // Read indicator values for this bar
   // Note: Indicator calculates based on chart timeframe
   double tema_value = GetIndicatorValue(3, shift);  // Buffer 3 = TEMA
   double hrma_value = GetIndicatorValue(2, shift);  // Buffer 2 = HRMA
   double smma_value = GetIndicatorValue(1, shift);  // Buffer 1 = SMMA
   
   // Convert EMPTY_VALUE to NULL for SQL
   string tema_str = (tema_value != EMPTY_VALUE && tema_value != 0.0) ? DoubleToString(tema_value, 5) : "NULL";
   string hrma_str = (hrma_value != EMPTY_VALUE && hrma_value != 0.0) ? DoubleToString(hrma_value, 5) : "NULL";
   string smma_str = (smma_value != EMPTY_VALUE && smma_value != 0.0) ? DoubleToString(smma_value, 5) : "NULL";
   
   // Build INSERT statement using sanitized table name
   string insertSQL = StringFormat(
      "INSERT OR REPLACE INTO [%s] "
      "(timestamp, open, high, low, close, volume, timeframe, tema, hrma, smma, collected_at) "
      "VALUES (%d, %.5f, %.5f, %.5f, %.5f, %d, '%s', %s, %s, %s, %d)",
      tableName,          // Use sanitized table name (e.g., "eurusd")
      (long)rate.time,
      rate.open,
      rate.high,
      rate.low,
      rate.close,
      (long)rate.tick_volume,
      timeframe,
      tema_str,
      hrma_str,
      smma_str,
      (long)collectedAt
   );
   
   int result = db.Exec(insertSQL);
   
   if(result != SQLITE_OK && result != SQLITE_DONE)
   {
      // Only print first error to avoid log spam
      static bool errorLogged = false;
      if(!errorLogged)
      {
         Print("ERROR: Failed to insert candle");
         Print("Error: ", db.ErrorMsg());
         errorLogged = true;
      }
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Get indicator value from buffer                                   |
//+------------------------------------------------------------------+
double GetIndicatorValue(int buffer_index, int shift)
{
   if(g_h_moving_averages == INVALID_HANDLE)
      return EMPTY_VALUE;
   
   double buffer[];
   ArraySetAsSeries(buffer, true);
   
   // Copy single value from indicator buffer
   if(CopyBuffer(g_h_moving_averages, buffer_index, shift, 1, buffer) > 0)
   {
      return buffer[0];
   }
   
   return EMPTY_VALUE;
}
//+------------------------------------------------------------------+
