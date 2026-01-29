//+------------------------------------------------------------------+
//|                                   SimpleDataCollector_Modified.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.24"
#property strict

// Version 2.24 Changelog:
// - MULTI-SYMBOL: Collect 3-5 symbols per terminal
// - REDIS PRIMARY: Fast path via Upstash Redis queue
// - SQLITE FALLBACK: Safety net only when Redis fails (NOT parallel)
// - SYMBOL DETECTION: Auto-detect Eightcap suffixes (.i for forex)
// - SINGLE FILE PER SYMBOL: Separate SQLite database per symbol
// - BACKFILL TRACKING: Marks failed Redis publishes for recovery
// - STATISTICS: Real-time monitoring of success/failure rates
// - RESOURCE WARNINGS: Alerts if >10 symbols configured

// Include SQLite3 library
#include <SQLite3\SQLite3Base.mqh>

//+------------------------------------------------------------------+
//| Input parameters                                                  |
//+------------------------------------------------------------------+
input string SymbolsList = "BTCUSD,ETHUSD,XAUUSD";  // Symbols to collect (comma-separated)
input string DatabasePath = "C:/Scripts/database/";  // Database folder path
input string RedisURL = "https://your-redis.upstash.io";  // Upstash Redis URL
input string RedisToken = "YOUR_TOKEN_HERE";  // Upstash Redis token
input string RedisQueue = "market-data-sync";  // Redis queue name
input int MaxBarsPerTimeframe = 10000;  // Max bars per timeframe per symbol
input bool EnableCircularBuffer = true;  // Replace oldest bars when limit reached
input bool EnableRedis = true;  // Enable Redis publishing (disable for testing)

// Indicator parameters (same as v2.22)
input int InpMAPeriod = 2;
input int InpSMMAPeriod = 36;
input int len_hrma = 18;
input int InpPeriodEMA = 9;
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_TYPICAL;

input int InpZScoreLength = 432;
input double InpThresholdZ1 = 1.5;
input double InpThresholdZ2 = 2.5;
input int InpCandleWidth = 3;

input int InpFractalBars = 35;
input int InpMinMixedTouches = 4;
input int InpMinPeakTouches = 2;
input int InpMinBottomTouches = 2;
input int InpMaxConsecutiveSameType = 2;
input double InpMinDiagonalLength = 80.0;
input double InpMinDiagonalAngle = 2.0;
input double InpMaxDiagonalAngle = 45.0;
input double InpTolerancePercent = 1.5;
input int InpLookbackBars = 400;
input int InpExtensionBars = 100;

input int InpFractalBars_Horiz = 35;
input int InpMinFractalTouch = 3;
input int InpMinLineLength = 20;
input int InpMaxLineLength = 0;
input double InpMaxAngleDegrees = 60;
input double InpTolerancePercent_Horiz = 1.5;
input int InpLookbackBars_Horiz = 400;
input int InpExtensionBars_Horiz = 100;

input int InpZScoreLength_HA = 288;
input double InpThresholdZ1_HA = 2.0;
input double InpThresholdZ2_HA = 3.0;

input int InpKC_HRMAPeriod = 72;
input int InpKC_ATRPeriod = 162;
input double InpKC_ATRMult_UltraExtremeUpper = 4.00;
input double InpKC_ATRMult_ExtremeUpper = 3.00;
input double InpKC_ATRMult_UpperMost = 2.00;
input double InpKC_ATRMult_Upper = 1.00;
input double InpKC_ATRMult_Lower = 1.00;
input double InpKC_ATRMult_LowerMost = 2.00;
input double InpKC_ATRMult_ExtremeLower = 3.00;
input double InpKC_ATRMult_UltraExtremeLower = 4.00;

input double InpSR_AccuracyMultiplier = 5.0;
input int InpSR_ATRPeriod = 400;
input int InpSR_SafeDistance = 50;
input int InpSR_BarsToIgnore = 0;
input int InpSR_MaxBarsExt = 400;
input int InpSR_MaxRange = 0;

input int InpZZ_Depth = 12;
input int InpZZ_Deviation = 5;
input int InpZZ_Backstep = 3;
input int InpEMA_Period = 26;
input ENUM_APPLIED_PRICE InpEMA_AppliedPrice = PRICE_TYPICAL;

//+------------------------------------------------------------------+
//| Global structures and variables                                   |
//+------------------------------------------------------------------+

// Timeframes to collect
ENUM_TIMEFRAMES timeframes[] = {
   PERIOD_M5, PERIOD_M15, PERIOD_M30,
   PERIOD_H1, PERIOD_H2, PERIOD_H4,
   PERIOD_H8, PERIOD_H12, PERIOD_D1
};

// Structure for symbol information
struct SymbolInfo
{
   string inputName;      // Name from user input (e.g., "BTCUSD")
   string actualName;     // Actual name in broker (e.g., "BTCUSD.i")
   string sanitizedName;  // Sanitized for database (e.g., "btcusd")
};

SymbolInfo symbols[];
int symbolCount = 0;

// Structure to hold indicator handles for each symbol × timeframe
struct SymbolTimeframeIndicators
{
   string symbol;         // Actual broker symbol name
   string sanitizedName;  // Sanitized name for database
   ENUM_TIMEFRAMES timeframe;
   datetime lastBarTime;
   
   // Indicator handles
   int h_moving_averages;
   int h_body_momentum;
   int h_fractal_diagonal;
   int h_fractal_horizontal;
   int h_heiken_ashi;
   int h_keltner_channel;
   int h_support_resistance;
   int h_zigzag;
};

SymbolTimeframeIndicators tfIndicators[];

// SQLite database connections (one per symbol)
struct SymbolDatabase
{
   string symbol;
   string sanitizedName;
   CSQLite3Base db;
   bool connected;
};

SymbolDatabase symbolDatabases[];

// Statistics tracking
struct CollectionStats
{
   int redisSuccessCount;
   int redisFailureCount;
   int sqliteBackupCount;
   datetime lastRedisFailure;
   datetime lastStatsDisplay;
   
   double GetRedisSuccessRate()
   {
      int total = redisSuccessCount + redisFailureCount;
      if(total == 0) return 100.0;
      return (double)redisSuccessCount / total * 100.0;
   }
   
   void Reset()
   {
      redisSuccessCount = 0;
      redisFailureCount = 0;
      sqliteBackupCount = 0;
   }
};

CollectionStats g_stats;

//+------------------------------------------------------------------+
//| Sanitize symbol name for database                                 |
//+------------------------------------------------------------------+
string SanitizeSymbolName(string symbol)
{
   string sanitized = symbol;
   
   // Remove broker suffixes
   StringReplace(sanitized, ".i", "");
   StringReplace(sanitized, ".a", "");
   StringReplace(sanitized, ".raw", "");
   StringReplace(sanitized, ".pro", "");
   StringReplace(sanitized, ".ecn", "");
   StringReplace(sanitized, ".std", "");
   StringReplace(sanitized, ".m", "");
   StringReplace(sanitized, ".c", "");
   StringReplace(sanitized, ".", "");
   StringReplace(sanitized, "#", "_");
   StringReplace(sanitized, " ", "_");
   StringReplace(sanitized, "-", "_");
   
   StringToLower(sanitized);
   
   return sanitized;
}

//+------------------------------------------------------------------+
//| Detect actual symbol name with broker-specific suffix             |
//+------------------------------------------------------------------+
string DetectBrokerSymbol(string baseSymbol)
{
   // Try variations with common broker suffixes
   string variations[];
   ArrayResize(variations, 10);
   
   variations[0] = baseSymbol;           // BTCUSD
   variations[1] = baseSymbol + ".i";    // BTCUSD.i (Eightcap forex)
   variations[2] = baseSymbol + ".a";    // BTCUSD.a (Alpari)
   variations[3] = baseSymbol + ".raw";  // BTCUSD.raw
   variations[4] = baseSymbol + ".pro";  // BTCUSD.pro
   variations[5] = baseSymbol + ".ecn";  // BTCUSD.ecn
   variations[6] = baseSymbol + ".m";    // BTCUSD.m
   variations[7] = baseSymbol + "#";     // BTCUSD# (some brokers)
   variations[8] = baseSymbol + "-";     // BTCUSD-
   variations[9] = StringSubstr(baseSymbol, 0, 6);  // Truncate to 6 chars
   
   // Try each variation
   for(int i = 0; i < ArraySize(variations); i++)
   {
      if(SymbolSelect(variations[i], true))
      {
         if(i > 0)
         {
            Print("✓ Symbol detected: ", baseSymbol, " → ", variations[i]);
         }
         return variations[i];
      }
   }
   
   // Not found
   return "";
}

//+------------------------------------------------------------------+
//| Parse and validate symbols from input string                      |
//+------------------------------------------------------------------+
bool ParseAndValidateSymbols()
{
   string temp = SymbolsList;
   StringReplace(temp, " ", "");  // Remove spaces
   
   if(StringLen(temp) == 0)
   {
      Print("ERROR: No symbols specified in SymbolsList");
      return false;
   }
   
   // Count symbols
   int count = 1;
   for(int i = 0; i < StringLen(temp); i++)
      if(StringGetCharacter(temp, i) == ',')
         count++;
   
   // Warning for too many symbols
   if(count > 10)
   {
      Alert("⚠️ WARNING: ", count, " symbols detected!");
      Alert("Recommended maximum: 10 symbols per terminal");
      Alert("This may cause performance issues");
      
      int response = MessageBox(
         StringFormat("You're collecting %d symbols. This may cause high resource usage. Continue?", count),
         "High Symbol Count Warning",
         MB_YESNO | MB_ICONWARNING
      );
      
      if(response == IDNO)
      {
         Print("User cancelled initialization due to high symbol count");
         return false;
      }
   }
   else if(count > 5)
   {
      Print("⚠️ Notice: ", count, " symbols - moderate resource usage expected");
   }
   else
   {
      Print("✓ ", count, " symbols - optimal resource usage");
   }
   
   ArrayResize(symbols, count);
   
   // Parse and detect symbols
   int start = 0;
   int idx = 0;
   
   Print("=== Symbol Detection ===");
   
   for(int i = 0; i <= StringLen(temp); i++)
   {
      if(i == StringLen(temp) || StringGetCharacter(temp, i) == ',')
      {
         string inputSymbol = StringSubstr(temp, start, i - start);
         
         // Detect actual broker symbol
         string actualSymbol = DetectBrokerSymbol(inputSymbol);
         
         if(actualSymbol == "")
         {
            Print("ERROR: Symbol not found: ", inputSymbol);
            Print("Tried variations: ", inputSymbol, ", ", inputSymbol, ".i, ", 
                  inputSymbol, ".a, etc.");
            return false;
         }
         
         // Store symbol info
         symbols[idx].inputName = inputSymbol;
         symbols[idx].actualName = actualSymbol;
         symbols[idx].sanitizedName = SanitizeSymbolName(inputSymbol);
         
         Print("✓ [", idx+1, "] ", inputSymbol, 
               (inputSymbol != actualSymbol ? " → " + actualSymbol : ""),
               " (db: ", symbols[idx].sanitizedName, ")");
         
         idx++;
         start = i + 1;
      }
   }
   
   symbolCount = count;
   Print("========================");
   
   return true;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=================================================");
   Print("SimpleDataCollector_Modified V2.24 PRODUCTION");
   Print("=================================================");
   
   // Parse and validate symbols
   if(!ParseAndValidateSymbols())
   {
      Print("ERROR: Symbol validation failed");
      return INIT_FAILED;
   }
   
   Print("Configuration:");
   Print("  Symbols: ", symbolCount);
   Print("  Timeframes: 9 (M5→D1)");
   Print("  Max bars per TF: ", MaxBarsPerTimeframe);
   Print("  Circular buffer: ", (EnableCircularBuffer ? "ENABLED" : "DISABLED"));
   Print("  Redis: ", (EnableRedis ? "ENABLED" : "DISABLED (SQLite only)"));
   Print("  Database path: ", DatabasePath);
   
   int totalStreams = symbolCount * ArraySize(timeframes);
   int totalIndicators = totalStreams * 8;
   
   Print("Resource usage:");
   Print("  Data streams: ", totalStreams);
   Print("  Indicator handles: ", totalIndicators);
   Print("  Estimated RAM: ~", symbolCount * 200, " MB");
   
   // Initialize all symbol × timeframe indicators
   if(!InitializeAllIndicators())
   {
      Print("ERROR: Failed to initialize indicators");
      return INIT_FAILED;
   }
   
   Print("✓ All indicators loaded successfully");
   
   // Initialize SQLite databases (one per symbol)
   if(!InitializeDatabases())
   {
      Print("ERROR: Failed to initialize databases");
      return INIT_FAILED;
   }
   
   Print("✓ All databases connected successfully");
   
   // Check Redis connectivity (if enabled)
   if(EnableRedis)
   {
      if(TestRedisConnection())
      {
         Print("✓ Redis connection verified");
      }
      else
      {
         Print("⚠️ WARNING: Redis connection failed - will use SQLite backup only");
      }
   }
   
   // Initial data collection
   Print("Starting initial data collection...");
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      CollectSlotData(i, true);  // true = initial collection
   }
   
   Print("=================================================");
   Print("✓ SimpleDataCollector V2.24 initialized successfully");
   Print("  Monitoring ", symbolCount, " symbols × 9 timeframes");
   Print("  Total: ", totalStreams, " data streams");
   Print("=================================================");
   
   // Reset statistics
   g_stats.Reset();
   g_stats.lastStatsDisplay = TimeCurrent();
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("=== Shutting down V2.24 ===");
   
   // Print final statistics
   PrintStatistics(true);
   
   // Release all indicator handles
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      if(tfIndicators[i].h_moving_averages != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_moving_averages);
      if(tfIndicators[i].h_body_momentum != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_body_momentum);
      if(tfIndicators[i].h_fractal_diagonal != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_fractal_diagonal);
      if(tfIndicators[i].h_fractal_horizontal != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_fractal_horizontal);
      if(tfIndicators[i].h_heiken_ashi != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_heiken_ashi);
      if(tfIndicators[i].h_keltner_channel != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_keltner_channel);
      if(tfIndicators[i].h_support_resistance != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_support_resistance);
      if(tfIndicators[i].h_zigzag != INVALID_HANDLE)
         IndicatorRelease(tfIndicators[i].h_zigzag);
   }
   
   // Disconnect all databases
   for(int i = 0; i < ArraySize(symbolDatabases); i++)
   {
      if(symbolDatabases[i].connected)
      {
         symbolDatabases[i].db.Disconnect();
         Print("✓ Database disconnected: ", symbolDatabases[i].sanitizedName);
      }
   }
   
   Print("SimpleDataCollector V2.24 stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check each symbol × timeframe for new bars
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      datetime currentBarTime = iTime(
         tfIndicators[i].symbol,
         tfIndicators[i].timeframe,
         0
      );
      
      // If bar time changed, collect data
      if(currentBarTime != tfIndicators[i].lastBarTime)
      {
         tfIndicators[i].lastBarTime = currentBarTime;
         CollectSlotData(i, false);  // false = ongoing collection
      }
   }
   
   // Print statistics every hour
   PrintStatistics(false);
}

//+------------------------------------------------------------------+
//| Initialize all indicators for all symbols × timeframes            |
//+------------------------------------------------------------------+
bool InitializeAllIndicators()
{
   int totalSlots = symbolCount * ArraySize(timeframes);
   ArrayResize(tfIndicators, totalSlots);
   
   Print("Initializing ", totalSlots, " indicator slots...");
   
   int slotIndex = 0;
   
   for(int s = 0; s < symbolCount; s++)
   {
      for(int t = 0; t < ArraySize(timeframes); t++)
      {
         tfIndicators[slotIndex].symbol = symbols[s].actualName;
         tfIndicators[slotIndex].sanitizedName = symbols[s].sanitizedName;
         tfIndicators[slotIndex].timeframe = timeframes[t];
         tfIndicators[slotIndex].lastBarTime = 0;
         
         if(!InitializeSlotIndicators(slotIndex))
         {
            Print("ERROR: Failed to initialize ", 
                  symbols[s].actualName, " ", 
                  EnumToString(timeframes[t]));
            return false;
         }
         
         slotIndex++;
      }
      
      Print("✓ ", symbols[s].actualName, ": All timeframes initialized");
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Initialize indicators for specific slot                           |
//+------------------------------------------------------------------+
bool InitializeSlotIndicators(int slotIndex)
{
   string sym = tfIndicators[slotIndex].symbol;
   ENUM_TIMEFRAMES tf = tfIndicators[slotIndex].timeframe;
   
   // 1. TEMA_HRMA_SMA-SMMA
   tfIndicators[slotIndex].h_moving_averages = iCustom(
      sym, tf, "TEMA_HRMA_SMA-SMMA_Modified Buffers",
      InpMAPeriod, 0, InpAppliedPrice, clrNONE, 1,
      InpSMMAPeriod, 0, clrBlue, 2,
      len_hrma, 0, clrMediumTurquoise, 2,
      InpPeriodEMA, 0, clrGray, 1
   );
   if(tfIndicators[slotIndex].h_moving_averages == INVALID_HANDLE) return false;
   
   // 2. Body Size Momentum
   tfIndicators[slotIndex].h_body_momentum = iCustom(
      sym, tf, "Body Size Momentum Candle_V2",
      InpZScoreLength, InpThresholdZ1, InpThresholdZ2, InpCandleWidth,
      clrNONE, clrLightGreen, clrGreen, clrNONE, clrHotPink, clrFireBrick
   );
   if(tfIndicators[slotIndex].h_body_momentum == INVALID_HANDLE) return false;
   
   // 3. Fractal Diagonal Line
   tfIndicators[slotIndex].h_fractal_diagonal = iCustom(
      sym, tf, "Fractal Diagonal Line_V4",
      "===== Fractal Detection (108 bars) =====", InpFractalBars,
      "===== Diagonal Line Rules =====",
      InpMinMixedTouches, InpMinPeakTouches, InpMinBottomTouches, InpMaxConsecutiveSameType,
      InpMinDiagonalLength, InpMinDiagonalAngle, InpMaxDiagonalAngle,
      "===== Tolerance Settings =====", 1, InpTolerancePercent, 1.5, 14,
      "===== Display Settings =====",
      InpLookbackBars, InpExtensionBars, 3, 3, clrDodgerBlue, clrOrangeRed,
      "===== Labels =====", false, 9, 5,
      "===== Scoring Weights =====", 25, 15, 10, 50, 20,
      "===== Performance Optimization =====",
      true, true, true, false, 150.0, false, 20
   );
   if(tfIndicators[slotIndex].h_fractal_diagonal == INVALID_HANDLE) return false;
   
   // 4. Fractal Horizontal Line
   tfIndicators[slotIndex].h_fractal_horizontal = iCustom(
      sym, tf, "Fractal Horizontal Line_V5",
      "===== Symbol 108 Settings =====", InpFractalBars_Horiz, 5, 0,
      "===== Symbol 119 Settings =====", true, 13, 3, 0, clrRed, clrLimeGreen,
      "===== Multi-Point Trendline Settings =====", true,
      InpMinFractalTouch, InpMinLineLength, InpMaxLineLength, InpMaxAngleDegrees,
      1, InpTolerancePercent_Horiz, 1.5, 14,
      InpLookbackBars_Horiz, InpExtensionBars_Horiz, 3, 3, clrRed, clrLimeGreen,
      "===== Scoring Weights =====", 25, 15, 10, 50,
      "===== Alert Settings =====", false, true, true, 0.05, true, true, true, "alert2.wav", 300,
      "===== Display Settings =====", false, 9, 5, clrRed, clrLimeGreen
   );
   if(tfIndicators[slotIndex].h_fractal_horizontal == INVALID_HANDLE) return false;
   
   // 5. Heiken Ashi
   tfIndicators[slotIndex].h_heiken_ashi = iCustom(
      sym, tf, "Heiken Ashi Body Size Classification_V4",
      InpZScoreLength_HA, InpThresholdZ1_HA, InpThresholdZ2_HA,
      clrLightGray, clrLightGreen, clrGreen, clrLightGray, clrHotPink, clrFireBrick
   );
   if(tfIndicators[slotIndex].h_heiken_ashi == INVALID_HANDLE) return false;
   
   // 6. Keltner Channel
   tfIndicators[slotIndex].h_keltner_channel = iCustom(
      sym, tf, "Keltner Channels Indicator_V2_MODIFIED",
      InpKC_HRMAPeriod, InpKC_ATRPeriod,
      InpKC_ATRMult_UltraExtremeUpper, InpKC_ATRMult_ExtremeUpper,
      InpKC_ATRMult_UpperMost, InpKC_ATRMult_Upper,
      InpKC_ATRMult_Lower, InpKC_ATRMult_LowerMost,
      InpKC_ATRMult_ExtremeLower, InpKC_ATRMult_UltraExtremeLower,
      clrMagenta, clrOrangeRed, clrGold, clrDodgerBlue,
      clrDodgerBlue, clrGold, clrOrangeRed, clrMagenta, 1, 2
   );
   if(tfIndicators[slotIndex].h_keltner_channel == INVALID_HANDLE) return false;
   
   // 7. Support/Resistance
   tfIndicators[slotIndex].h_support_resistance = iCustom(
      sym, tf, "Sup_Res_MorePlotBuffer_V2",
      InpSR_AccuracyMultiplier, InpSR_ATRPeriod, InpSR_SafeDistance,
      InpSR_BarsToIgnore, InpSR_MaxBarsExt, InpSR_MaxRange,
      clrRed, clrLime, STYLE_SOLID, 1, false
   );
   if(tfIndicators[slotIndex].h_support_resistance == INVALID_HANDLE) return false;
   
   // 8. ZigZag Color
   tfIndicators[slotIndex].h_zigzag = iCustom(
      sym, tf, "ZigZagColor__MarketStructure_Export__V28_FIXED",
      "Input Parameters Settings", InpZZ_Depth, InpZZ_Deviation, InpZZ_Backstep,
      clrDodgerBlue, clrRed, 0.50,
      "Data Source Settings", 0, "", "", "",
      "Data Export Settings", false, false, 15000, "MarketStructureAnalysis.json",
      "Batch Processing Settings", false, "BTCUSD,EURUSD,USDJPY", "M15,H1,H4",
      "SMMA Settings", 39, 0, PRICE_CLOSE, clrRed, 2, STYLE_SOLID,
      "EMA Settings", InpEMA_Period, InpEMA_AppliedPrice, clrBlue, 2, STYLE_SOLID,
      "X Value Settings", 26, PERIOD_CURRENT, 1
   );
   if(tfIndicators[slotIndex].h_zigzag == INVALID_HANDLE) return false;
   
   return true;
}

//+------------------------------------------------------------------+
//| Initialize SQLite databases (one per symbol)                      |
//+------------------------------------------------------------------+
bool InitializeDatabases()
{
   ArrayResize(symbolDatabases, symbolCount);
   
   Print("Initializing databases for ", symbolCount, " symbols...");
   
   for(int i = 0; i < symbolCount; i++)
   {
      symbolDatabases[i].symbol = symbols[i].actualName;
      symbolDatabases[i].sanitizedName = symbols[i].sanitizedName;
      symbolDatabases[i].connected = false;
      
      // Database file path
      string dbPath = DatabasePath + symbolDatabases[i].sanitizedName + ".db";
      
      // Connect to database
      int result = symbolDatabases[i].db.Connect(dbPath);
      
      if(result != SQLITE_OK)
      {
         Print("ERROR: Failed to connect to database: ", dbPath);
         Print("Error: ", symbolDatabases[i].db.ErrorMsg());
         return false;
      }
      
      symbolDatabases[i].connected = true;
      
      // Create table
      if(!CreateSymbolTable(i))
      {
         Print("ERROR: Failed to create table for ", symbolDatabases[i].sanitizedName);
         return false;
      }
      
      Print("✓ Database ready: ", symbolDatabases[i].sanitizedName, ".db");
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Create table for symbol                                           |
//+------------------------------------------------------------------+
bool CreateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;
   
   string createTableSQL = StringFormat(
      "CREATE TABLE IF NOT EXISTS [%s] ("
      "timestamp INTEGER, "
      "open REAL NOT NULL, "
      "high REAL NOT NULL, "
      "low REAL NOT NULL, "
      "close REAL NOT NULL, "
      "volume INTEGER, "
      "timeframe TEXT, "
      "tema REAL, "
      "hrma REAL, "
      "smma REAL, "
      "[Z-Score of body size] REAL, "
      "[Candle classification] INTEGER, "
      "diag_asc_line_1 REAL, "
      "diag_asc_line_2 REAL, "
      "diag_asc_line_3 REAL, "
      "diag_desc_line_1 REAL, "
      "diag_desc_line_2 REAL, "
      "diag_desc_line_3 REAL, "
      "diag_high_map REAL, "
      "diag_low_map REAL, "
      "horiz_peak_line_1 REAL, "
      "horiz_peak_line_2 REAL, "
      "horiz_peak_line_3 REAL, "
      "horiz_bottom_line_1 REAL, "
      "horiz_bottom_line_2 REAL, "
      "horiz_bottom_line_3 REAL, "
      "horiz_high_map REAL, "
      "horiz_low_map REAL, "
      "ha_open REAL, "
      "ha_high REAL, "
      "ha_low REAL, "
      "ha_close REAL, "
      "ha_classification INTEGER, "
      "ha_body_size REAL, "
      "ha_body_zscore REAL, "
      "kc_ultra_extreme_upper REAL, "
      "kc_extreme_upper REAL, "
      "kc_uppermost REAL, "
      "kc_upper REAL, "
      "kc_upper_middle REAL, "
      "kc_lower_middle REAL, "
      "kc_lower REAL, "
      "kc_lowermost REAL, "
      "kc_extreme_lower REAL, "
      "kc_ultra_extreme_lower REAL, "
      "sr_support_4 REAL, "
      "sr_support_3 REAL, "
      "sr_support_2 REAL, "
      "sr_support_1 REAL, "
      "sr_resistance_1 REAL, "
      "sr_resistance_2 REAL, "
      "sr_resistance_3 REAL, "
      "sr_resistance_4 REAL, "
      "zigzag_peak REAL, "
      "zigzag_bottom REAL, "
      "ema_26 REAL, "
      "collected_at INTEGER, "
      "PRIMARY KEY (timestamp, timeframe)"
      ")",
      tableName
   );
   
   int result = symbolDatabases[dbIndex].db.Exec(createTableSQL);
   
   if(result != SQLITE_OK)
   {
      Print("ERROR: Failed to create table");
      Print("Error: ", symbolDatabases[dbIndex].db.ErrorMsg());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Test Redis connection                                              |
//+------------------------------------------------------------------+
bool TestRedisConnection()
{
   string url = RedisURL + "/ping";
   string headers = "Authorization: Bearer " + RedisToken + "\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   int httpCode = WebRequest(
      "GET",
      url,
      headers,
      5000,  // 5 second timeout
      postData,
      resultData,
      resultHeaders
   );
   
   return (httpCode == 200);
}

//+------------------------------------------------------------------+
//| Collect data for specific slot                                    |
//+------------------------------------------------------------------+
void CollectSlotData(int slotIndex, bool isInitial)
{
   string sym = tfIndicators[slotIndex].symbol;
   ENUM_TIMEFRAMES tf = tfIndicators[slotIndex].timeframe;
   string tfName = EnumToString(tf);
   
   if(isInitial)
   {
      // Initial collection: get historical bars
      int barsToCollect = Bars(sym, tf);
      
      if(barsToCollect > MaxBarsPerTimeframe)
      {
         barsToCollect = MaxBarsPerTimeframe;
      }
      
      int insertedCount = 0;
      for(int i = barsToCollect - 1; i >= 0; i--)
      {
         if(InsertCandle(slotIndex, i))
            insertedCount++;
      }
      
      // Enforce limit after initial collection
      if(EnableCircularBuffer)
      {
         EnforceBarLimit(slotIndex);
      }
   }
   else
   {
      // Ongoing: insert current bar
      if(InsertCandle(slotIndex, 0))
      {
         if(EnableCircularBuffer)
         {
            EnforceBarLimit(slotIndex);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Insert candle with Redis primary + SQLite fallback                |
//+------------------------------------------------------------------+
bool InsertCandle(int slotIndex, int shift)
{
   string sym = tfIndicators[slotIndex].symbol;
   string sanitizedName = tfIndicators[slotIndex].sanitizedName;
   ENUM_TIMEFRAMES tf = tfIndicators[slotIndex].timeframe;
   
   // Get OHLC data
   MqlRates rate[];
   ArraySetAsSeries(rate, true);
   
   if(CopyRates(sym, tf, shift, 1, rate) != 1)
      return false;
   
   // Get all indicator values (same as v2.22)
   double tema = GetIndicatorValue(tfIndicators[slotIndex].h_moving_averages, 0, shift);
   double hrma = GetIndicatorValue(tfIndicators[slotIndex].h_moving_averages, 1, shift);
   double smma = GetIndicatorValue(tfIndicators[slotIndex].h_moving_averages, 2, shift);
   
   double zscore = GetIndicatorValue(tfIndicators[slotIndex].h_body_momentum, 0, shift);
   double classification = GetIndicatorValue(tfIndicators[slotIndex].h_body_momentum, 1, shift);
   
   double diag_asc_1 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 0, shift);
   double diag_asc_2 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 1, shift);
   double diag_asc_3 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 2, shift);
   double diag_desc_1 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 3, shift);
   double diag_desc_2 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 4, shift);
   double diag_desc_3 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 5, shift);
   double diag_high = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 6, shift);
   double diag_low = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_diagonal, 7, shift);
   
   double horiz_peak_1 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 0, shift);
   double horiz_peak_2 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 1, shift);
   double horiz_peak_3 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 2, shift);
   double horiz_bottom_1 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 3, shift);
   double horiz_bottom_2 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 4, shift);
   double horiz_bottom_3 = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 5, shift);
   double horiz_high = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 6, shift);
   double horiz_low = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_horizontal, 7, shift);
   
   double ha_open = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 0, shift);
   double ha_high = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 1, shift);
   double ha_low = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 2, shift);
   double ha_close = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 3, shift);
   double ha_class = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 4, shift);
   double ha_body_size = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 5, shift);
   double ha_zscore = GetIndicatorValue(tfIndicators[slotIndex].h_heiken_ashi, 6, shift);
   
   double kc_ultra_extreme_upper = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 0, shift);
   double kc_extreme_upper = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 1, shift);
   double kc_uppermost = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 2, shift);
   double kc_upper = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 3, shift);
   double kc_upper_middle = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 4, shift);
   double kc_lower_middle = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 5, shift);
   double kc_lower = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 6, shift);
   double kc_lowermost = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 7, shift);
   double kc_extreme_lower = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 8, shift);
   double kc_ultra_extreme_lower = GetIndicatorValue(tfIndicators[slotIndex].h_keltner_channel, 9, shift);
   
   double sr_support_4 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 0, shift);
   double sr_support_3 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 1, shift);
   double sr_support_2 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 2, shift);
   double sr_support_1 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 3, shift);
   double sr_resistance_1 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 4, shift);
   double sr_resistance_2 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 5, shift);
   double sr_resistance_3 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 6, shift);
   double sr_resistance_4 = GetIndicatorValue(tfIndicators[slotIndex].h_support_resistance, 7, shift);
   
   double zigzag_peak = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 0, shift);
   double zigzag_bottom = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 1, shift);
   double ema_26 = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 4, shift);
   
   // ============================================================
   // PRIMARY PATH: Try Redis first (if enabled)
   // ============================================================
   if(EnableRedis)
   {
      bool redisSuccess = PublishToRedis(sanitizedName, tf, rate[0], 
                                         tema, hrma, smma, zscore, classification);
      
      if(redisSuccess)
      {
         // ✅ Success! Data in queue, done
         g_stats.redisSuccessCount++;
         return true;
      }
      
      // ❌ Redis failed, will fall through to SQLite backup
      g_stats.redisFailureCount++;
      g_stats.lastRedisFailure = TimeCurrent();
   }
   
   // ============================================================
   // FALLBACK PATH: SQLite backup (only runs if Redis failed)
   // ============================================================
   
   // Find database for this symbol
   int dbIndex = -1;
   for(int i = 0; i < ArraySize(symbolDatabases); i++)
   {
      if(symbolDatabases[i].sanitizedName == sanitizedName)
      {
         dbIndex = i;
         break;
      }
   }
   
   if(dbIndex < 0)
   {
      Print("ERROR: Database not found for ", sanitizedName);
      return false;
   }
   
   bool sqliteSuccess = WriteSQLiteBackup(dbIndex, tf, rate[0], 
                                          tema, hrma, smma, zscore, classification);
   
   if(sqliteSuccess)
   {
      g_stats.sqliteBackupCount++;
      MarkForBackfill(sanitizedName, tf, rate[0].time);
      return true;
   }
   
   // ❌ Both paths failed
   Print("❌ CRITICAL: Both Redis AND SQLite failed for ", sanitizedName, " ", EnumToString(tf));
   return false;
}

//+------------------------------------------------------------------+
//| Publish to Redis (Primary path)                                   |
//+------------------------------------------------------------------+
bool PublishToRedis(string symbol, ENUM_TIMEFRAMES tf, MqlRates &rate,
                    double tema, double hrma, double smma, 
                    double zscore, double classification)
{
   // Build JSON payload (abbreviated - include all 57 columns in production)
   string payload = StringFormat(
      "{"
      "\"symbol\":\"%s\","
      "\"timeframe\":\"%s\","
      "\"timestamp\":%d,"
      "\"open\":%.5f,"
      "\"high\":%.5f,"
      "\"low\":%.5f,"
      "\"close\":%.5f,"
      "\"volume\":%d,"
      "\"tema\":%.5f,"
      "\"hrma\":%.5f,"
      "\"smma\":%.5f,"
      "\"zscore\":%.5f,"
      "\"classification\":%d"
      "}",
      symbol,
      EnumToString(tf),
      (long)rate.time,
      rate.open,
      rate.high,
      rate.low,
      rate.close,
      (long)rate.tick_volume,
      (tema != EMPTY_VALUE ? tema : 0),
      (hrma != EMPTY_VALUE ? hrma : 0),
      (smma != EMPTY_VALUE ? smma : 0),
      (zscore != EMPTY_VALUE ? zscore : 0),
      (int)(classification != EMPTY_VALUE ? classification : 0)
   );
   
   // HTTP POST to Upstash Redis
   string url = RedisURL + "/lpush/" + RedisQueue;
   string headers = "Authorization: Bearer " + RedisToken + "\r\nContent-Type: application/json\r\n";
   
   char postData[];
   char resultData[];
   string resultHeaders;
   
   ArrayResize(postData, StringToCharArray(payload, postData, 0, WHOLE_ARRAY) - 1);
   
   int httpCode = WebRequest(
      "POST",
      url,
      headers,
      2000,  // 2 second timeout (fail fast)
      postData,
      resultData,
      resultHeaders
   );
   
   return (httpCode == 200);
}

//+------------------------------------------------------------------+
//| Write to SQLite backup (Fallback only)                            |
//+------------------------------------------------------------------+
bool WriteSQLiteBackup(int dbIndex, ENUM_TIMEFRAMES tf, MqlRates &rate,
                       double tema, double hrma, double smma,
                       double zscore, double classification)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;
   
   // Build INSERT statement (abbreviated - include all 57 columns)
   string insertSQL = StringFormat(
      "INSERT OR REPLACE INTO [%s] "
      "(timestamp, open, high, low, close, volume, timeframe, "
      "tema, hrma, smma, [Z-Score of body size], [Candle classification], collected_at) "
      "VALUES (%d, %.5f, %.5f, %.5f, %.5f, %d, '%s', %.5f, %.5f, %.5f, %.5f, %d, %d)",
      tableName,
      (long)rate.time,
      rate.open,
      rate.high,
      rate.low,
      rate.close,
      (long)rate.tick_volume,
      EnumToString(tf),
      (tema != EMPTY_VALUE ? tema : 0),
      (hrma != EMPTY_VALUE ? hrma : 0),
      (smma != EMPTY_VALUE ? smma : 0),
      (zscore != EMPTY_VALUE ? zscore : 0),
      (int)(classification != EMPTY_VALUE ? classification : 0),
      (long)TimeCurrent()
   );
   
   int result = symbolDatabases[dbIndex].db.Exec(insertSQL);
   
   return (result == SQLITE_OK || result == SQLITE_DONE);
}

//+------------------------------------------------------------------+
//| Mark bar for backfill                                              |
//+------------------------------------------------------------------+
void MarkForBackfill(string symbol, ENUM_TIMEFRAMES tf, datetime timestamp)
{
   string backfillFile = DatabasePath + "backfill_queue.csv";
   int handle = FileOpen(backfillFile, FILE_WRITE|FILE_READ|FILE_TXT|FILE_ANSI, ',');
   
   if(handle != INVALID_HANDLE)
   {
      FileSeek(handle, 0, SEEK_END);
      FileWriteString(handle, 
         StringFormat("%s,%s,%d\n", symbol, EnumToString(tf), (long)timestamp)
      );
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Enforce bar limit (circular buffer)                               |
//+------------------------------------------------------------------+
void EnforceBarLimit(int slotIndex)
{
   if(!EnableCircularBuffer)
      return;
   
   string sanitizedName = tfIndicators[slotIndex].sanitizedName;
   ENUM_TIMEFRAMES tf = tfIndicators[slotIndex].timeframe;
   
   // Find database
   int dbIndex = -1;
   for(int i = 0; i < ArraySize(symbolDatabases); i++)
   {
      if(symbolDatabases[i].sanitizedName == sanitizedName)
      {
         dbIndex = i;
         break;
      }
   }
   
   if(dbIndex < 0) return;
   
   // Count bars for this timeframe
   string countSQL = StringFormat(
      "SELECT COUNT(*) FROM [%s] WHERE timeframe='%s'",
      sanitizedName, EnumToString(tf)
   );
   
   
   CSQLite3Table countTable;
   int result = symbolDatabases[dbIndex].db.Query(countTable, countSQL);
   
   if(result != SQLITE_DONE)
      return;
   
   int currentCount = 0;
   if(ArraySize(countTable.m_data) > 0)
   {
      CSQLite3Cell cell;
      if(countTable.Cell(0, 0, cell))
      {
         currentCount = cell.GetInt();
      }
   }
   // Delete oldest if over limit
   if(currentCount > MaxBarsPerTimeframe)
   {
      int excessBars = currentCount - MaxBarsPerTimeframe;
      
      string deleteSQL = StringFormat(
         "DELETE FROM [%s] WHERE timeframe='%s' AND timestamp IN "
         "(SELECT timestamp FROM [%s] WHERE timeframe='%s' ORDER BY timestamp ASC LIMIT %d)",
         sanitizedName, EnumToString(tf), sanitizedName, EnumToString(tf), excessBars
      );
      
      symbolDatabases[dbIndex].db.Exec(deleteSQL);
   }
}

//+------------------------------------------------------------------+
//| Print statistics                                                   |
//+------------------------------------------------------------------+
void PrintStatistics(bool force)
{
   datetime currentTime = TimeCurrent();
   
   // Print every hour or on force
   if(!force && (currentTime - g_stats.lastStatsDisplay < 3600))
      return;
   
   g_stats.lastStatsDisplay = currentTime;
   
   Print("=== Collection Statistics ===");
   Print("Redis Success: ", g_stats.redisSuccessCount);
   Print("Redis Failures: ", g_stats.redisFailureCount);
   Print("SQLite Backups: ", g_stats.sqliteBackupCount);
   Print("Redis Success Rate: ", DoubleToString(g_stats.GetRedisSuccessRate(), 2), "%");
   
   if(g_stats.lastRedisFailure > 0)
   {
      Print("Last Redis Failure: ", TimeToString(g_stats.lastRedisFailure, TIME_DATE|TIME_MINUTES));
   }
   
   Print("============================");
   
   if(!force)
   {
      g_stats.Reset();  // Reset hourly counters
   }
}

//+------------------------------------------------------------------+
//| Get indicator value from buffer                                   |
//+------------------------------------------------------------------+
double GetIndicatorValue(int indicator_handle, int buffer_index, int shift)
{
   if(indicator_handle == INVALID_HANDLE)
      return EMPTY_VALUE;
   
   double buffer[];
   ArraySetAsSeries(buffer, true);
   
   if(CopyBuffer(indicator_handle, buffer_index, shift, 1, buffer) > 0)
      return buffer[0];
   
   return EMPTY_VALUE;
}
//+------------------------------------------------------------------+
