//+------------------------------------------------------------------+
//|                                        db-update-statarb-0.1.mq5 |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property service
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.00"
//+------------------------------------------------------------------+
//| SQLite Market Data Update Service                                |
//|                                                                  |
//| This service updates the integrated SQLite database with the     |
//| latest market data for specified symbols and timeframes.         |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//|   Inputs                                                         |
//+------------------------------------------------------------------+
input string   InpDbPath      = "StatArb\\statarb-0.1.db";  // Database filename
input int      InpUpdateFreq  = 1;     // Update frequency in minutes
input int      InpMaxRetries  = 3;     // Max retries
input bool     InpShowLogs    = true; // Enable logging
//+------------------------------------------------------------------+
//|   Global vars                                                    |
//+------------------------------------------------------------------+
string symbols[] = {"EURUSD", "GBPUSD", "USDJPY"};
ENUM_TIMEFRAMES timeframes[] = {PERIOD_M5};
// Database handle
int dbHandle = INVALID_HANDLE;

//+------------------------------------------------------------------+
//|   Log a message to the Experts log                               |
//+------------------------------------------------------------------+
void LogMessage(string message)
  {
   if(InpShowLogs)
      Print(message);
  }

//+------------------------------------------------------------------+
//| Initialize database connection                                   |
//+------------------------------------------------------------------+
bool InitializeDatabase()
  {
   ResetLastError();
// Open database (creates if it doesn't exist)
   dbHandle = DatabaseOpen(InpDbPath, DATABASE_OPEN_READWRITE | DATABASE_OPEN_CREATE);
   if(dbHandle == INVALID_HANDLE)
     {
      LogMessage(StringFormat("Failed to open database: %d", GetLastError()));
      return false;
     }
// Enable foreign key constraints
   if(!DatabaseExecute(dbHandle, "PRAGMA foreign_keys = ON"))
     {
      LogMessage(StringFormat("Failed to enable foreign keys: %d", GetLastError()));
      return false;
     }
   LogMessage("Database initialized successfully");
   return true;
  }

//+------------------------------------------------------------------+
//| Get symbol ID from database or insert new symbol                 |
//+------------------------------------------------------------------+
long GetOrInsertSymbol(string ticker)
  {
   ResetLastError();
// Check if symbol exists
   int stmt = DatabasePrepare(dbHandle, "SELECT symbol_id FROM symbol WHERE ticker = ?");
   if(stmt == INVALID_HANDLE)
     {
      LogMessage(StringFormat("Failed to prepare symbol query: %d", GetLastError()));
      return -1;
     }
   if(!DatabaseBind(stmt, 0, ticker))
     {
      LogMessage(StringFormat("Failed to bind ticker parameter: %d", GetLastError()));
      DatabaseFinalize(stmt);
      return -1;
     }
   if(DatabaseRead(stmt))
     {
      int symbol_id = -1;
      DatabaseColumnInteger(stmt, 0, symbol_id);
      DatabaseFinalize(stmt);
      return symbol_id;
     }
   DatabaseFinalize(stmt);
// Symbol doesn't exist, insert it
   string exchange = "UNKNOWN";//SymbolInfoString(ticker, SYMBOL_EXCHANGE);
   string assetType = "UNKNOWN";//SymbolInfoString(ticker, SYMBOL_BASIS);
   string sector = "UNKNOWN";    // Not available directly in MQL5
   string industry = "UNKNOWN";  // Not available directly in MQL5
   string currency = "UNKNOWN";//SymbolInfoString(ticker, SYMBOL_CURRENCY_PROFIT);
   string req = StringFormat(
                   "INSERT INTO symbol(ticker, exchange, asset_type, sector, industry, currency)"
                   " VALUES( '%s', '%s', '%s', '%s', '%s', '%s')",
                   ticker, exchange, assetType, sector, industry, currency);
   if(!DatabaseExecute(dbHandle, req))
     {
      LogMessage(StringFormat("Failed to insert symbol: %d", GetLastError()));
      DatabaseFinalize(stmt);
      return -1;
     }
   DatabaseFinalize(stmt);
// Get the inserted symbol_id
   stmt = DatabasePrepare(dbHandle, "SELECT last_insert_rowid()");
   if(stmt == INVALID_HANDLE || !DatabaseRead(stmt))
     {
      LogMessage(StringFormat("Failed to get last insert ID: %d", GetLastError()));
      if(stmt != INVALID_HANDLE)
         DatabaseFinalize(stmt);
      return -1;
     }
   int symbol_id = -1;
   DatabaseColumnInteger(stmt, 0, symbol_id);
   DatabaseFinalize(stmt);
   LogMessage(StringFormat("Inserted new symbol: %s (ID: %d)", ticker, symbol_id));
   return symbol_id;
  }

//+------------------------------------------------------------------+
//| Convert MQL5 timeframe to SQLite format                          |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES tf)
  {
   switch(tf)
     {
      case PERIOD_M1:
         return "M1";
      case PERIOD_M2:
         return "M2";
      case PERIOD_M3:
         return "M3";
      case PERIOD_M4:
         return "M4";
      case PERIOD_M5:
         return "M5";
      case PERIOD_M6:
         return "M6";
      case PERIOD_M10:
         return "M10";
      case PERIOD_M12:
         return "M12";
      case PERIOD_M15:
         return "M15";
      case PERIOD_M20:
         return "M20";
      case PERIOD_M30:
         return "M30";
      case PERIOD_H1:
         return "H1";
      case PERIOD_H2:
         return "H2";
      case PERIOD_H3:
         return "H3";
      case PERIOD_H4:
         return "H4";
      case PERIOD_H6:
         return "H6";
      case PERIOD_H8:
         return "H8";
      case PERIOD_H12:
         return "H12";
      case PERIOD_D1:
         return "D1";
      case PERIOD_W1:
         return "W1";
      case PERIOD_MN1:
         return "MN1";
      default:
         return "";
     }
  }

//+------------------------------------------------------------------+
//| Check if market data exists for given timestamp and timeframe     |
//+------------------------------------------------------------------+
bool MarketDataExists(long symbol_id, datetime tstamp, string timeframe)
  {
   ResetLastError();
   int stmt = DatabasePrepare(dbHandle, "SELECT 1 FROM market_data WHERE symbol_id = ? AND tstamp = ? AND timeframe = ? LIMIT 1");
   if(stmt == INVALID_HANDLE)
     {
      LogMessage(StringFormat("Failed to prepare market data existence check: %d", GetLastError()));
      return false;
     }
   if(!DatabaseBind(stmt, 0, symbol_id) ||
      !DatabaseBind(stmt, 1, (long)tstamp) ||
      !DatabaseBind(stmt, 2, timeframe))
     {
      LogMessage(StringFormat("Failed to bind parameters for existence check: %d", GetLastError()));
      DatabaseFinalize(stmt);
      return false;
     }
   bool exists = DatabaseRead(stmt);
   DatabaseFinalize(stmt);
   return exists;
  }

//+------------------------------------------------------------------+
//| Insert market data into database                                 |
//+------------------------------------------------------------------+
bool InsertMarketData(long symbol_id, string timeframe, MqlRates &rates)
  {
   ResetLastError();
   string req = StringFormat(
                   "INSERT INTO market_data ("
                   "tstamp, timeframe, price_open, price_high, price_low, price_close, "
                   "tick_volume, real_volume, spread, symbol_id) "
                   "VALUES(%d, '%s', %G, %G, %G, %G, %d, %d, %d, %d)",
                   rates.time, timeframe, rates.open, rates.high, rates.low, rates.close,
                   rates.tick_volume, rates.real_volume, rates.spread, symbol_id);
   if(!DatabaseExecute(dbHandle, req))
     {
      LogMessage(StringFormat("Failed to insert market data: %d", GetLastError()));
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Update market data for a single symbol and timeframe              |
//+------------------------------------------------------------------+
bool UpdateSymbolTimeframeData(string symbol, ENUM_TIMEFRAMES timeframe)
  {
   ResetLastError();
// Get symbol ID (insert if doesn't exist)
   long symbol_id = GetOrInsertSymbol(symbol);
   if(symbol_id == -1)
     {
      LogMessage(StringFormat("Failed to get symbol ID for %s", symbol));
      return false;
     }
   string tfString = TimeframeToString(timeframe);
   if(tfString == "")
     {
      LogMessage(StringFormat("Unsupported timeframe for symbol %s", symbol));
      return false;
     }
// Get the latest closed bar
   MqlRates rates[];
   if(CopyRates(symbol, timeframe, 1, 1, rates) != 1)
     {
      LogMessage(StringFormat("Failed to get rates for %s %s: %d", symbol, tfString, GetLastError()));
      return false;
     }
// Check if this data point already exists
   if(MarketDataExists(symbol_id, rates[0].time, tfString))
     {
      LogMessage(StringFormat("Data already exists for %s %s at %s",
                              symbol, tfString, TimeToString(rates[0].time)));
      return true;
     }
// Start transaction
   if(!DatabaseTransactionBegin(dbHandle))
     {
      LogMessage(StringFormat("Failed to start transaction: %d", GetLastError()));
      return false;
     }
// Insert the new data
   if(!InsertMarketData(symbol_id, tfString, rates[0]))
     {
      DatabaseTransactionRollback(dbHandle);
      return false;
     }
// Commit transaction
   if(!DatabaseTransactionCommit(dbHandle))
     {
      LogMessage(StringFormat("Failed to commit transaction: %d", GetLastError()));
      return false;
     }
   LogMessage(StringFormat("Successfully updated %s %s data for %s",
                           symbol, tfString, TimeToString(rates[0].time)));
   return true;
  }

//+------------------------------------------------------------------+
//| Main service function                                            |
//| Parameters:                                                      |
//|   symbols    - Array of symbol names to update                   |
//|   timeframes - Array of timeframes to update                     |
//|   InpMaxRetries - Maximum number of retries for failed operations    |
//+------------------------------------------------------------------+
void OnStart()
  {
   do
     {
      printf("Updating db: %s", InpDbPath);
      UpdateMarketData(symbols, timeframes, InpMaxRetries);
      Sleep(1000 * 60 * InpUpdateFreq); // 60 secs
     }
   while(!IsStopped());
  }

//+------------------------------------------------------------------+
//| Update market data for multiple symbols and timeframes           |
//+------------------------------------------------------------------+
bool UpdateMarketData(string &symbols_array[], ENUM_TIMEFRAMES &time_frames[], int max_retries = 3)
  {
// Initialize database
   if(!InitializeDatabase())
     {
      LogMessage("Failed to initialize database");
      return false;
     }
   bool allSuccess = true;
// Process each symbol
   for(int i = 0; i < ArraySize(symbols_array); i++)
     {
      string symbol = symbols_array[i];
      // Process each timeframe
      for(int j = 0; j < ArraySize(time_frames); j++)
        {
         ENUM_TIMEFRAMES timeframe = time_frames[j];
         int retryCount = 0;
         bool success = false;
         // Retry logic
         while(retryCount < max_retries && !success)
           {
            success = UpdateSymbolTimeframeData(symbol, timeframe);
            if(!success)
              {
               retryCount++;
               Sleep(1000); // Wait before retry
              }
           }
         if(!success)
           {
            LogMessage(StringFormat("Failed to update %s %s after %d retries",
                                    symbol, TimeframeToString(timeframe), max_retries));
            allSuccess = false;
           }
        }
     }
   DatabaseClose(dbHandle);
   return allSuccess;
  }
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
