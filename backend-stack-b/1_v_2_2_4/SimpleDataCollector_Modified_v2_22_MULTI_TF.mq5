//+------------------------------------------------------------------+
//|                                   SimpleDataCollector_Modified.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.22"
#property strict

// Version 2.22 Changelog:
// - MULTI-TIMEFRAME: Automatically collects 9 timeframes from single chart
// - CIRCULAR BUFFER: Maintains max 10,000 bars per timeframe
// - AUTO-CLEANUP: Deletes oldest bars when limit reached
// - SMART TIMING: Updates each timeframe only when bar closes
// - Collects: M5, M15, M30, H1, H2, H4, H8, H12, D1

// Include SQLite3 library
#include <SQLite3\SQLite3Base.mqh>

// Input parameters
input string DatabasePath = "C:/Scripts/database/trading_data.db";  // SQLite database path
input string MonitorSymbol = "";  // Symbol to monitor (empty = current chart symbol)
input bool DropTableOnStart = true;  // Drop table on start (forces schema update)
input int MaxBarsPerTimeframe = 10000;  // Max bars to keep per timeframe
input bool EnableCircularBuffer = true;  // Replace oldest with newest when limit reached

// Indicator 1: TEMA_HRMA_SMA-SMMA parameters
input int InpMAPeriod = 2;              // SMA Period
input int InpSMMAPeriod = 36;           // SMMA Period
input int len_hrma = 18;                // HRMA Period
input int InpPeriodEMA = 9;             // TEMA Period
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_TYPICAL; // Applied price

// Indicator 2: Body Size Momentum parameters
input int InpZScoreLength = 432;        // Z-Score MA Length
input double InpThresholdZ1 = 1.5;     // First threshold (Large)
input double InpThresholdZ2 = 2.5;     // Second threshold (Extreme)
input int InpCandleWidth = 3;          // Candle Width (1-5)

// Indicator 3: Fractal Diagonal Line parameters
input int InpFractalBars = 35;         // Fractal Detection Bars
input int InpMinMixedTouches = 4;      // Min Mixed Touches
input int InpMinPeakTouches = 2;       // Min Peak Touches
input int InpMinBottomTouches = 2;     // Min Bottom Touches
input int InpMaxConsecutiveSameType = 2; // Max Consecutive Same Type
input double InpMinDiagonalLength = 80.0; // Min Diagonal Length
input double InpMinDiagonalAngle = 2.0;   // Min Diagonal Angle
input double InpMaxDiagonalAngle = 45.0;  // Max Diagonal Angle
input double InpTolerancePercent = 1.5;   // Tolerance Percent
input int InpLookbackBars = 400;          // Lookback Bars
input int InpExtensionBars = 100;         // Extension Bars

// Indicator 4: Fractal Horizontal Line parameters
input int InpFractalBars_Horiz = 35;      // Horizontal Fractal Bars
input int InpMinFractalTouch = 3;         // Min Fractal Touch
input int InpMinLineLength = 20;          // Min Line Length
input int InpMaxLineLength = 0;           // Max Line Length (0 = no limit)
input double InpMaxAngleDegrees = 60;     // Max Angle Degrees
input double InpTolerancePercent_Horiz = 1.5; // Tolerance Percent
input int InpLookbackBars_Horiz = 400;    // Lookback Bars
input int InpExtensionBars_Horiz = 100;   // Extension Bars

// Indicator 5: Heiken Ashi Body Size Classification parameters
input int InpZScoreLength_HA = 288;       // HA Z-Score MA Length
input double InpThresholdZ1_HA = 2.0;    // HA First threshold (Large)
input double InpThresholdZ2_HA = 3.0;    // HA Second threshold (Extreme)

// Indicator 6: Keltner Channel parameters
input int InpKC_HRMAPeriod = 72;                         // KC HRMA Period
input int InpKC_ATRPeriod = 162;                         // KC ATR Period
input double InpKC_ATRMult_UltraExtremeUpper = 4.00;    // KC Ultra Extreme Upper Multiplier
input double InpKC_ATRMult_ExtremeUpper = 3.00;         // KC Extreme Upper Multiplier
input double InpKC_ATRMult_UpperMost = 2.00;            // KC UpperMost Multiplier
input double InpKC_ATRMult_Upper = 1.00;                // KC Upper Multiplier
input double InpKC_ATRMult_Lower = 1.00;                // KC Lower Multiplier
input double InpKC_ATRMult_LowerMost = 2.00;            // KC LowerMost Multiplier
input double InpKC_ATRMult_ExtremeLower = 3.00;         // KC Extreme Lower Multiplier
input double InpKC_ATRMult_UltraExtremeLower = 4.00;    // KC Ultra Extreme Lower Multiplier

// Indicator 7: Support and Resistance parameters
input double InpSR_AccuracyMultiplier = 5.0;             // SR Accuracy Multiplier
input int InpSR_ATRPeriod = 400;                         // SR ATR Period
input int InpSR_SafeDistance = 50;                       // SR Safety Distance (points)
input int InpSR_BarsToIgnore = 0;                        // SR Recent Bars to Ignore
input int InpSR_MaxBarsExt = 400;                        // SR Bars to Analyze
input int InpSR_MaxRange = 0;                            // SR Max Price Range (points)

// Indicator 8: ZigZag Color parameters
input int InpZZ_Depth = 12;                              // ZigZag Depth
input int InpZZ_Deviation = 5;                           // ZigZag Deviation (points)
input int InpZZ_Backstep = 3;                            // ZigZag Backstep
input int InpEMA_Period = 26;                            // EMA Period
input ENUM_APPLIED_PRICE InpEMA_AppliedPrice = PRICE_TYPICAL; // EMA Applied Price

// Global variables
CSQLite3Base db;  // SQLite database object
string currentSymbol = "";     // Original symbol with suffix (e.g., "EURUSD.i")
string tableName = "";         // Sanitized table name (e.g., "eurusd")

// Timeframes to collect
ENUM_TIMEFRAMES timeframes[] = {
   PERIOD_M5,   // 5 minutes
   PERIOD_M15,  // 15 minutes
   PERIOD_M30,  // 30 minutes
   PERIOD_H1,   // 1 hour
   PERIOD_H2,   // 2 hours
   PERIOD_H4,   // 4 hours
   PERIOD_H8,   // 8 hours
   PERIOD_H12,  // 12 hours
   PERIOD_D1    // 1 day
};

// Structure to hold indicator handles for each timeframe
struct TimeframeIndicators
{
   ENUM_TIMEFRAMES timeframe;
   int h_moving_averages;
   int h_body_momentum;
   int h_fractal_diagonal;
   int h_fractal_horizontal;
   int h_heiken_ashi;
   int h_keltner_channel;
   int h_support_resistance;
   int h_zigzag;
   datetime lastBarTime;  // Track last bar time for this timeframe
};

TimeframeIndicators tfIndicators[];

//+------------------------------------------------------------------+
//| Sanitize symbol name for safe table naming                        |
//+------------------------------------------------------------------+
string SanitizeSymbolName(string symbol)
{
   string sanitized = symbol;
   
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
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   if(MonitorSymbol == "")
      currentSymbol = _Symbol;
   else
      currentSymbol = MonitorSymbol;
   
   tableName = SanitizeSymbolName(currentSymbol);
   
   Print("=================================================");
   Print("SimpleDataCollector_Modified V2.22 Starting...");
   Print("Chart Symbol: ", _Symbol);
   Print("Monitor Symbol: ", currentSymbol);
   Print("Database Table: ", tableName);
   Print("Max Bars Per Timeframe: ", MaxBarsPerTimeframe);
   Print("Circular Buffer: ", (EnableCircularBuffer ? "ENABLED (oldest replaced)" : "DISABLED"));
   Print("Database: ", DatabasePath);
   Print("Timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1");
   Print("=================================================");
   
   // Initialize indicators for all timeframes
   if(!InitializeAllTimeframes())
   {
      Print("ERROR: Failed to initialize indicators");
      return INIT_FAILED;
   }
   
   Print("✓ All timeframe indicators loaded successfully");
   
   // Connect to database
   int result = db.Connect(DatabasePath);
   
   if(result != SQLITE_OK)
   {
      Print("ERROR: Failed to connect to database: ", DatabasePath);
      Print("Error: ", db.ErrorMsg());
      return INIT_FAILED;
   }
   
   Print("✓ Database connected successfully");
   
   // Drop table if requested
   if(DropTableOnStart)
   {
      if(!DropSymbolTable())
      {
         Print("WARNING: Failed to drop table (may not exist)");
      }
      else
      {
         Print("✓ Table dropped: ", tableName);
      }
   }
   
   // Create table
   if(!CreateSymbolTable())
   {
      Print("ERROR: Failed to create table");
      return INIT_FAILED;
   }
   
   Print("✓ Table created/verified: ", tableName);
   
   // Do initial data collection for all timeframes
   Print("Starting initial data collection for all timeframes...");
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      CollectTimeframeData(i, true);  // true = initial collection
   }
   
   Print("✓ SimpleDataCollector_Modified initialized successfully");
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
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
   
   db.Disconnect();
   Print("SimpleDataCollector_Modified stopped. Database disconnected.");
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check each timeframe to see if a new bar has formed
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      datetime currentBarTime = iTime(currentSymbol, tfIndicators[i].timeframe, 0);
      
      // If bar time changed, collect data for this timeframe
      if(currentBarTime != tfIndicators[i].lastBarTime)
      {
         tfIndicators[i].lastBarTime = currentBarTime;
         CollectTimeframeData(i, false);  // false = ongoing collection
      }
   }
}

//+------------------------------------------------------------------+
//| Initialize indicators for all timeframes                          |
//+------------------------------------------------------------------+
bool InitializeAllTimeframes()
{
   int tfCount = ArraySize(timeframes);
   ArrayResize(tfIndicators, tfCount);
   
   for(int i = 0; i < tfCount; i++)
   {
      tfIndicators[i].timeframe = timeframes[i];
      tfIndicators[i].lastBarTime = 0;
      
      Print("Initializing indicators for ", EnumToString(timeframes[i]), "...");
      
      if(!InitializeTimeframeIndicators(i))
      {
         Print("ERROR: Failed to initialize ", EnumToString(timeframes[i]));
         return false;
      }
      
      Print("✓ ", EnumToString(timeframes[i]), " indicators loaded");
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Initialize indicators for specific timeframe                      |
//+------------------------------------------------------------------+
bool InitializeTimeframeIndicators(int tfIndex)
{
   ENUM_TIMEFRAMES tf = tfIndicators[tfIndex].timeframe;
   
   // 1. TEMA_HRMA_SMA-SMMA
   tfIndicators[tfIndex].h_moving_averages = iCustom(
      currentSymbol, tf, 
      "TEMA_HRMA_SMA-SMMA_Modified Buffers",
      InpMAPeriod, 0, InpAppliedPrice, clrNONE, 1,
      InpSMMAPeriod, 0, clrBlue, 2,
      len_hrma, 0, clrMediumTurquoise, 2,
      InpPeriodEMA, 0, clrGray, 1
   );
   if(tfIndicators[tfIndex].h_moving_averages == INVALID_HANDLE) return false;
   
   // 2. Body Size Momentum
   tfIndicators[tfIndex].h_body_momentum = iCustom(
      currentSymbol, tf,
      "Body Size Momentum Candle_V2",
      InpZScoreLength, InpThresholdZ1, InpThresholdZ2, InpCandleWidth,
      clrNONE, clrLightGreen, clrGreen, clrNONE, clrHotPink, clrFireBrick
   );
   if(tfIndicators[tfIndex].h_body_momentum == INVALID_HANDLE) return false;
   
   // 3. Fractal Diagonal Line
   tfIndicators[tfIndex].h_fractal_diagonal = iCustom(
      currentSymbol, tf,
      "Fractal Diagonal Line_V4",
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
   if(tfIndicators[tfIndex].h_fractal_diagonal == INVALID_HANDLE) return false;
   
   // 4. Fractal Horizontal Line
   tfIndicators[tfIndex].h_fractal_horizontal = iCustom(
      currentSymbol, tf,
      "Fractal Horizontal Line_V5",
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
   if(tfIndicators[tfIndex].h_fractal_horizontal == INVALID_HANDLE) return false;
   
   // 5. Heiken Ashi
   tfIndicators[tfIndex].h_heiken_ashi = iCustom(
      currentSymbol, tf,
      "Heiken Ashi Body Size Classification_V4",
      InpZScoreLength_HA, InpThresholdZ1_HA, InpThresholdZ2_HA,
      clrLightGray, clrLightGreen, clrGreen, clrLightGray, clrHotPink, clrFireBrick
   );
   if(tfIndicators[tfIndex].h_heiken_ashi == INVALID_HANDLE) return false;
   
   // 6. Keltner Channel
   tfIndicators[tfIndex].h_keltner_channel = iCustom(
      currentSymbol, tf,
      "Keltner Channels Indicator_V2_MODIFIED",
      InpKC_HRMAPeriod, InpKC_ATRPeriod,
      InpKC_ATRMult_UltraExtremeUpper, InpKC_ATRMult_ExtremeUpper,
      InpKC_ATRMult_UpperMost, InpKC_ATRMult_Upper,
      InpKC_ATRMult_Lower, InpKC_ATRMult_LowerMost,
      InpKC_ATRMult_ExtremeLower, InpKC_ATRMult_UltraExtremeLower,
      clrMagenta, clrOrangeRed, clrGold, clrDodgerBlue,
      clrDodgerBlue, clrGold, clrOrangeRed, clrMagenta, 1, 2
   );
   if(tfIndicators[tfIndex].h_keltner_channel == INVALID_HANDLE) return false;
   
   // 7. Support/Resistance
   tfIndicators[tfIndex].h_support_resistance = iCustom(
      currentSymbol, tf,
      "Sup_Res_MorePlotBuffer_V2",
      InpSR_AccuracyMultiplier, InpSR_ATRPeriod, InpSR_SafeDistance,
      InpSR_BarsToIgnore, InpSR_MaxBarsExt, InpSR_MaxRange,
      clrRed, clrLime, STYLE_SOLID, 1, false
   );
   if(tfIndicators[tfIndex].h_support_resistance == INVALID_HANDLE) return false;
   
   // 8. ZigZag Color
   tfIndicators[tfIndex].h_zigzag = iCustom(
      currentSymbol, tf,
      "ZigZagColor__MarketStructure_Export__V28_FIXED",
      "Input Parameters Settings", InpZZ_Depth, InpZZ_Deviation, InpZZ_Backstep,
      clrDodgerBlue, clrRed, 0.50,
      "Data Source Settings", 0, "", "", "",
      "Data Export Settings", false, false, 15000, "MarketStructureAnalysis.json",
      "Batch Processing Settings", false, "BTCUSD,EURUSD,USDJPY", "M15,H1,H4",
      "SMMA Settings", 39, 0, PRICE_CLOSE, clrRed, 2, STYLE_SOLID,
      "EMA Settings", InpEMA_Period, InpEMA_AppliedPrice, clrBlue, 2, STYLE_SOLID,
      "X Value Settings", 26, PERIOD_CURRENT, 1
   );
   if(tfIndicators[tfIndex].h_zigzag == INVALID_HANDLE) return false;
   
   return true;
}

//+------------------------------------------------------------------+
//| Collect data for specific timeframe                               |
//+------------------------------------------------------------------+
void CollectTimeframeData(int tfIndex, bool isInitialCollection)
{
   ENUM_TIMEFRAMES tf = tfIndicators[tfIndex].timeframe;
   string tfName = EnumToString(tf);
   
   int barsToCollect;
   
   if(isInitialCollection)
   {
      // Initial collection: get historical bars
      barsToCollect = Bars(currentSymbol, tf);
      
      if(barsToCollect > MaxBarsPerTimeframe)
      {
         Print(tfName, ": Limiting initial collection to ", MaxBarsPerTimeframe, " bars");
         barsToCollect = MaxBarsPerTimeframe;
      }
      
      Print(tfName, ": Starting initial collection of ", barsToCollect, " bars...");
      
      int insertedCount = 0;
      for(int i = barsToCollect - 1; i >= 0; i--)
      {
         if(InsertCandle(tfIndex, i))
            insertedCount++;
      }
      
      Print(tfName, ": Initial collection complete. Inserted: ", insertedCount, " bars");
      
      // After initial collection, enforce bar limit if circular buffer enabled
      if(EnableCircularBuffer)
      {
         EnforceBarLimit(tf, tfName);
      }
   }
   else
   {
      // Ongoing: just insert current bar (bar 0)
      if(InsertCandle(tfIndex, 0))
      {
         Print(tfName, ": Updated bar at ", TimeToString(iTime(currentSymbol, tf, 0), TIME_DATE|TIME_MINUTES));
         
         // Enforce bar limit
         if(EnableCircularBuffer)
         {
            EnforceBarLimit(tf, tfName);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Enforce maximum bars per timeframe (circular buffer)              |
//+------------------------------------------------------------------+
void EnforceBarLimit(ENUM_TIMEFRAMES tf, string tfName)
{
   // Count current bars for this timeframe
   string countSQL = StringFormat(
      "SELECT COUNT(*) FROM [%s] WHERE timeframe='%s'",
      tableName, EnumToString(tf)
   );
   
   int result = db.Query(countSQL);
   
   if(result != SQLITE_OK)
      return;
   
   int currentCount = (int)StringToInteger(db.GetFieldValue(0));
   db.FreeResult();
   
   // If over limit, delete oldest bars
   if(currentCount > MaxBarsPerTimeframe)
   {
      int excessBars = currentCount - MaxBarsPerTimeframe;
      
      string deleteSQL = StringFormat(
         "DELETE FROM [%s] WHERE timeframe='%s' AND timestamp IN "
         "(SELECT timestamp FROM [%s] WHERE timeframe='%s' ORDER BY timestamp ASC LIMIT %d)",
         tableName, EnumToString(tf), tableName, EnumToString(tf), excessBars
      );
      
      result = db.Exec(deleteSQL);
      
      if(result == SQLITE_OK || result == SQLITE_DONE)
      {
         Print(tfName, ": Deleted ", excessBars, " oldest bars (maintaining limit of ", MaxBarsPerTimeframe, ")");
      }
   }
}

//+------------------------------------------------------------------+
//| Drop table                                                         |
//+------------------------------------------------------------------+
bool DropSymbolTable()
{
   string dropTableSQL = StringFormat("DROP TABLE IF EXISTS [%s]", tableName);
   int result = db.Exec(dropTableSQL);
   return (result == SQLITE_OK || result == SQLITE_DONE);
}

//+------------------------------------------------------------------+
//| Create table                                                       |
//+------------------------------------------------------------------+
bool CreateSymbolTable()
{
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
   
   int result = db.Exec(createTableSQL);
   
   if(result != SQLITE_OK)
   {
      Print("ERROR: Failed to create table");
      Print("Error: ", db.ErrorMsg());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Insert candle data                                                 |
//+------------------------------------------------------------------+
bool InsertCandle(int tfIndex, int shift)
{
   ENUM_TIMEFRAMES tf = tfIndicators[tfIndex].timeframe;
   
   // Get OHLC data
   MqlRates rate[];
   ArraySetAsSeries(rate, true);
   
   if(CopyRates(currentSymbol, tf, shift, 1, rate) != 1)
      return false;
   
   string timeframe = EnumToString(tf);
   datetime collectedAt = TimeCurrent();
   
   // Get all indicator values
   double tema = GetIndicatorValue(tfIndicators[tfIndex].h_moving_averages, 0, shift);
   double hrma = GetIndicatorValue(tfIndicators[tfIndex].h_moving_averages, 1, shift);
   double smma = GetIndicatorValue(tfIndicators[tfIndex].h_moving_averages, 2, shift);
   
   double zscore = GetIndicatorValue(tfIndicators[tfIndex].h_body_momentum, 0, shift);
   double classification = GetIndicatorValue(tfIndicators[tfIndex].h_body_momentum, 1, shift);
   
   double diag_asc_1 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 0, shift);
   double diag_asc_2 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 1, shift);
   double diag_asc_3 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 2, shift);
   double diag_desc_1 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 3, shift);
   double diag_desc_2 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 4, shift);
   double diag_desc_3 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 5, shift);
   double diag_high = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 6, shift);
   double diag_low = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_diagonal, 7, shift);
   
   double horiz_peak_1 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 0, shift);
   double horiz_peak_2 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 1, shift);
   double horiz_peak_3 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 2, shift);
   double horiz_bottom_1 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 3, shift);
   double horiz_bottom_2 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 4, shift);
   double horiz_bottom_3 = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 5, shift);
   double horiz_high = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 6, shift);
   double horiz_low = GetIndicatorValue(tfIndicators[tfIndex].h_fractal_horizontal, 7, shift);
   
   double ha_open = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 0, shift);
   double ha_high = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 1, shift);
   double ha_low = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 2, shift);
   double ha_close = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 3, shift);
   double ha_class = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 4, shift);
   double ha_body_size = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 5, shift);
   double ha_zscore = GetIndicatorValue(tfIndicators[tfIndex].h_heiken_ashi, 6, shift);
   
   double kc_ultra_extreme_upper = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 0, shift);
   double kc_extreme_upper = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 1, shift);
   double kc_uppermost = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 2, shift);
   double kc_upper = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 3, shift);
   double kc_upper_middle = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 4, shift);
   double kc_lower_middle = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 5, shift);
   double kc_lower = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 6, shift);
   double kc_lowermost = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 7, shift);
   double kc_extreme_lower = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 8, shift);
   double kc_ultra_extreme_lower = GetIndicatorValue(tfIndicators[tfIndex].h_keltner_channel, 9, shift);
   
   double sr_support_4 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 0, shift);
   double sr_support_3 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 1, shift);
   double sr_support_2 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 2, shift);
   double sr_support_1 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 3, shift);
   double sr_resistance_1 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 4, shift);
   double sr_resistance_2 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 5, shift);
   double sr_resistance_3 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 6, shift);
   double sr_resistance_4 = GetIndicatorValue(tfIndicators[tfIndex].h_support_resistance, 7, shift);
   
   double zigzag_peak = GetIndicatorValue(tfIndicators[tfIndex].h_zigzag, 0, shift);
   double zigzag_bottom = GetIndicatorValue(tfIndicators[tfIndex].h_zigzag, 1, shift);
   double ema_26 = GetIndicatorValue(tfIndicators[tfIndex].h_zigzag, 4, shift);
   
   // Build INSERT statement with all 57 columns
   string insertSQL = StringFormat(
      "INSERT OR REPLACE INTO [%s] "
      "(timestamp, open, high, low, close, volume, timeframe, "
      "tema, hrma, smma, [Z-Score of body size], [Candle classification], "
      "diag_asc_line_1, diag_asc_line_2, diag_asc_line_3, "
      "diag_desc_line_1, diag_desc_line_2, diag_desc_line_3, "
      "diag_high_map, diag_low_map, "
      "horiz_peak_line_1, horiz_peak_line_2, horiz_peak_line_3, "
      "horiz_bottom_line_1, horiz_bottom_line_2, horiz_bottom_line_3, "
      "horiz_high_map, horiz_low_map, "
      "ha_open, ha_high, ha_low, ha_close, ha_classification, ha_body_size, ha_body_zscore, "
      "kc_ultra_extreme_upper, kc_extreme_upper, kc_uppermost, kc_upper, kc_upper_middle, "
      "kc_lower_middle, kc_lower, kc_lowermost, kc_extreme_lower, kc_ultra_extreme_lower, "
      "sr_support_4, sr_support_3, sr_support_2, sr_support_1, "
      "sr_resistance_1, sr_resistance_2, sr_resistance_3, sr_resistance_4, "
      "zigzag_peak, zigzag_bottom, ema_26, "
      "collected_at) "
      "VALUES (%d, %.5f, %.5f, %.5f, %.5f, %d, '%s', "
      "%s, %s, %s, %s, %s, "
      "%s, %s, %s, %s, %s, %s, %s, %s, "
      "%s, %s, %s, %s, %s, %s, %s, %s, "
      "%s, %s, %s, %s, %s, %s, %s, "
      "%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
      "%s, %s, %s, %s, %s, %s, %s, %s, "
      "%s, %s, %s, %d)",
      tableName,
      (long)rate[0].time, rate[0].open, rate[0].high, rate[0].low, rate[0].close,
      (long)rate[0].tick_volume, timeframe,
      (tema != EMPTY_VALUE) ? DoubleToString(tema, 5) : "NULL",
      (hrma != EMPTY_VALUE) ? DoubleToString(hrma, 5) : "NULL",
      (smma != EMPTY_VALUE) ? DoubleToString(smma, 5) : "NULL",
      (zscore != EMPTY_VALUE) ? DoubleToString(zscore, 5) : "NULL",
      (classification != EMPTY_VALUE) ? IntegerToString((int)classification) : "NULL",
      (diag_asc_1 != EMPTY_VALUE && diag_asc_1 != 0.0) ? DoubleToString(diag_asc_1, 5) : "NULL",
      (diag_asc_2 != EMPTY_VALUE && diag_asc_2 != 0.0) ? DoubleToString(diag_asc_2, 5) : "NULL",
      (diag_asc_3 != EMPTY_VALUE && diag_asc_3 != 0.0) ? DoubleToString(diag_asc_3, 5) : "NULL",
      (diag_desc_1 != EMPTY_VALUE && diag_desc_1 != 0.0) ? DoubleToString(diag_desc_1, 5) : "NULL",
      (diag_desc_2 != EMPTY_VALUE && diag_desc_2 != 0.0) ? DoubleToString(diag_desc_2, 5) : "NULL",
      (diag_desc_3 != EMPTY_VALUE && diag_desc_3 != 0.0) ? DoubleToString(diag_desc_3, 5) : "NULL",
      (diag_high != EMPTY_VALUE && diag_high != 0.0) ? DoubleToString(diag_high, 5) : "NULL",
      (diag_low != EMPTY_VALUE && diag_low != 0.0) ? DoubleToString(diag_low, 5) : "NULL",
      (horiz_peak_1 != EMPTY_VALUE && horiz_peak_1 != 0.0) ? DoubleToString(horiz_peak_1, 5) : "NULL",
      (horiz_peak_2 != EMPTY_VALUE && horiz_peak_2 != 0.0) ? DoubleToString(horiz_peak_2, 5) : "NULL",
      (horiz_peak_3 != EMPTY_VALUE && horiz_peak_3 != 0.0) ? DoubleToString(horiz_peak_3, 5) : "NULL",
      (horiz_bottom_1 != EMPTY_VALUE && horiz_bottom_1 != 0.0) ? DoubleToString(horiz_bottom_1, 5) : "NULL",
      (horiz_bottom_2 != EMPTY_VALUE && horiz_bottom_2 != 0.0) ? DoubleToString(horiz_bottom_2, 5) : "NULL",
      (horiz_bottom_3 != EMPTY_VALUE && horiz_bottom_3 != 0.0) ? DoubleToString(horiz_bottom_3, 5) : "NULL",
      (horiz_high != EMPTY_VALUE && horiz_high != 0.0) ? DoubleToString(horiz_high, 5) : "NULL",
      (horiz_low != EMPTY_VALUE && horiz_low != 0.0) ? DoubleToString(horiz_low, 5) : "NULL",
      (ha_open != EMPTY_VALUE) ? DoubleToString(ha_open, 5) : "NULL",
      (ha_high != EMPTY_VALUE) ? DoubleToString(ha_high, 5) : "NULL",
      (ha_low != EMPTY_VALUE) ? DoubleToString(ha_low, 5) : "NULL",
      (ha_close != EMPTY_VALUE) ? DoubleToString(ha_close, 5) : "NULL",
      (ha_class != EMPTY_VALUE) ? IntegerToString((int)ha_class) : "NULL",
      (ha_body_size != EMPTY_VALUE) ? DoubleToString(ha_body_size, 5) : "NULL",
      (ha_zscore != EMPTY_VALUE) ? DoubleToString(ha_zscore, 5) : "NULL",
      (kc_ultra_extreme_upper != EMPTY_VALUE) ? DoubleToString(kc_ultra_extreme_upper, 5) : "NULL",
      (kc_extreme_upper != EMPTY_VALUE) ? DoubleToString(kc_extreme_upper, 5) : "NULL",
      (kc_uppermost != EMPTY_VALUE) ? DoubleToString(kc_uppermost, 5) : "NULL",
      (kc_upper != EMPTY_VALUE) ? DoubleToString(kc_upper, 5) : "NULL",
      (kc_upper_middle != EMPTY_VALUE) ? DoubleToString(kc_upper_middle, 5) : "NULL",
      (kc_lower_middle != EMPTY_VALUE) ? DoubleToString(kc_lower_middle, 5) : "NULL",
      (kc_lower != EMPTY_VALUE) ? DoubleToString(kc_lower, 5) : "NULL",
      (kc_lowermost != EMPTY_VALUE) ? DoubleToString(kc_lowermost, 5) : "NULL",
      (kc_extreme_lower != EMPTY_VALUE) ? DoubleToString(kc_extreme_lower, 5) : "NULL",
      (kc_ultra_extreme_lower != EMPTY_VALUE) ? DoubleToString(kc_ultra_extreme_lower, 5) : "NULL",
      (sr_support_4 != EMPTY_VALUE && sr_support_4 != 0.0) ? DoubleToString(sr_support_4, 5) : "NULL",
      (sr_support_3 != EMPTY_VALUE && sr_support_3 != 0.0) ? DoubleToString(sr_support_3, 5) : "NULL",
      (sr_support_2 != EMPTY_VALUE && sr_support_2 != 0.0) ? DoubleToString(sr_support_2, 5) : "NULL",
      (sr_support_1 != EMPTY_VALUE && sr_support_1 != 0.0) ? DoubleToString(sr_support_1, 5) : "NULL",
      (sr_resistance_1 != EMPTY_VALUE && sr_resistance_1 != 0.0) ? DoubleToString(sr_resistance_1, 5) : "NULL",
      (sr_resistance_2 != EMPTY_VALUE && sr_resistance_2 != 0.0) ? DoubleToString(sr_resistance_2, 5) : "NULL",
      (sr_resistance_3 != EMPTY_VALUE && sr_resistance_3 != 0.0) ? DoubleToString(sr_resistance_3, 5) : "NULL",
      (sr_resistance_4 != EMPTY_VALUE && sr_resistance_4 != 0.0) ? DoubleToString(sr_resistance_4, 5) : "NULL",
      (zigzag_peak != EMPTY_VALUE && zigzag_peak != 0.0) ? DoubleToString(zigzag_peak, 5) : "NULL",
      (zigzag_bottom != EMPTY_VALUE && zigzag_bottom != 0.0) ? DoubleToString(zigzag_bottom, 5) : "NULL",
      (ema_26 != EMPTY_VALUE) ? DoubleToString(ema_26, 5) : "NULL",
      (long)collectedAt
   );
   
   int result = db.Exec(insertSQL);
   
   return (result == SQLITE_OK || result == SQLITE_DONE);
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
