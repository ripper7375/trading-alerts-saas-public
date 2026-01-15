//+------------------------------------------------------------------+
//|                                   SimpleDataCollector_Modified.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.19"
#property strict

// Version 2.19 Changelog:
// - Updated ZigZag indicator reference to V28 FIXED
// - Compatible with optimized buffer management in V28
// - No changes to data collection logic

// Include SQLite3 library
#include <SQLite3\SQLite3Base.mqh>

// Input parameters
input int CollectionInterval = 30;  // Collection interval in seconds
input string DatabasePath = "C:/Scripts/database/trading_data.db";  // SQLite database path (relative to Files folder)
input string MonitorSymbol = "";  // Symbol to monitor (empty = current chart symbol)

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
input int InpFractalBars_Horiz = 35;      // Horizontal Fractal Bars (108)
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
input ENUM_TIMEFRAMES InpKC_Timeframe = PERIOD_CURRENT;  // KC Analysis Timeframe
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
input ENUM_TIMEFRAMES InpSR_Timeframe = PERIOD_CURRENT;  // SR Analysis Timeframe
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
datetime lastCollectionTime = 0;
CSQLite3Base db;  // SQLite database object
string currentSymbol = "";     // Original symbol with suffix (e.g., "EURUSD.i")
string tableName = "";         // Sanitized table name (e.g., "eurusd")

// Indicator handles
int g_h_moving_averages = INVALID_HANDLE;
int g_h_body_momentum = INVALID_HANDLE;
int g_h_fractal_diagonal = INVALID_HANDLE;
int g_h_fractal_horizontal = INVALID_HANDLE;
int g_h_heiken_ashi = INVALID_HANDLE;
int g_h_keltner_channel = INVALID_HANDLE;
int g_h_support_resistance = INVALID_HANDLE;
int g_h_zigzag = INVALID_HANDLE;

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
   Print("Indicators: TEMA_HRMA + Body Momentum + Fractal Diagonal + Fractal Horizontal + Heiken Ashi + Keltner Channel + Support/Resistance + ZigZag");
   Print("=================================================");
   
   // Initialize indicators (uses ORIGINAL symbol name with suffix)
   if(!InitializeIndicators())
   {
      Print("ERROR: Failed to initialize indicators");
      return INIT_FAILED;
   }
   
   Print("✓ Indicators loaded successfully for ", currentSymbol);
   
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
   // Release indicator handles
   if(g_h_moving_averages != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_moving_averages);
      g_h_moving_averages = INVALID_HANDLE;
      Print("TEMA_HRMA_SMA-SMMA indicator handle released");
   }
   
   if(g_h_body_momentum != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_body_momentum);
      g_h_body_momentum = INVALID_HANDLE;
      Print("Body Size Momentum indicator handle released");
   }
   
   if(g_h_fractal_diagonal != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_fractal_diagonal);
      g_h_fractal_diagonal = INVALID_HANDLE;
      Print("Fractal Diagonal Line indicator handle released");
   }
   
   if(g_h_fractal_horizontal != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_fractal_horizontal);
      g_h_fractal_horizontal = INVALID_HANDLE;
      Print("Fractal Horizontal Line indicator handle released");
   }
   
   if(g_h_heiken_ashi != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_heiken_ashi);
      g_h_heiken_ashi = INVALID_HANDLE;
      Print("Heiken Ashi indicator handle released");
   }
   
   if(g_h_keltner_channel != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_keltner_channel);
      g_h_keltner_channel = INVALID_HANDLE;
      Print("Keltner Channel indicator handle released");
   }
   
   if(g_h_support_resistance != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_support_resistance);
      g_h_support_resistance = INVALID_HANDLE;
      Print("Support/Resistance indicator handle released");
   }
   
   if(g_h_zigzag != INVALID_HANDLE)
   {
      IndicatorRelease(g_h_zigzag);
      g_h_zigzag = INVALID_HANDLE;
      Print("ZigZag indicator handle released");
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
//| Initialize indicators                                              |
//+------------------------------------------------------------------+
bool InitializeIndicators()
{
   Print("Initializing indicators for ", currentSymbol, "...");
   
   // 1. Load TEMA_HRMA_SMA-SMMA indicator
   Print("Loading TEMA_HRMA_SMA-SMMA indicator...");
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
      Print("ERROR: Failed to load TEMA_HRMA_SMA-SMMA indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ TEMA_HRMA_SMA-SMMA indicator loaded");
   
   // 2. Load Body Size Momentum indicator
   Print("Loading Body Size Momentum indicator...");
   g_h_body_momentum = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Body Size Momentum Candle_V2",
      InpZScoreLength,    // Z-Score MA Length
      InpThresholdZ1,     // First threshold
      InpThresholdZ2,     // Second threshold
      InpCandleWidth,     // Candle Width
      clrNONE,           // Up Normal Color
      clrLightGreen,     // Up Large Color
      clrGreen,          // Up Extreme Color
      clrNONE,           // Down Normal Color
      clrHotPink,        // Down Large Color
      clrFireBrick       // Down Extreme Color
   );
   
   if(g_h_body_momentum == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Body Size Momentum indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Body Size Momentum indicator loaded");
   
   // 3. Load Fractal Diagonal Line indicator
   Print("Loading Fractal Diagonal Line indicator...");
   g_h_fractal_diagonal = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Fractal_Diagonal_Line_V4",
      "===== Fractal Detection (108 bars) =====",
      InpFractalBars,          // Fractal Bars
      "===== Diagonal Line Rules =====",
      InpMinMixedTouches,      // Min Mixed Touches
      InpMinPeakTouches,       // Min Peak Touches
      InpMinBottomTouches,     // Min Bottom Touches
      InpMaxConsecutiveSameType, // Max Consecutive Same Type
      InpMinDiagonalLength,    // Min Diagonal Length
      InpMinDiagonalAngle,     // Min Diagonal Angle
      InpMaxDiagonalAngle,     // Max Diagonal Angle
      "===== Tolerance Settings =====",
      1,                       // Tolerance Type (TOLERANCE_PERCENT)
      InpTolerancePercent,     // Tolerance Percent
      1.5,                     // Tolerance ATR Multiplier
      14,                      // ATR Period
      "===== Display Settings =====",
      InpLookbackBars,         // Lookback Bars
      InpExtensionBars,        // Extension Bars
      3,                       // Max Ascending Lines
      3,                       // Max Descending Lines
      clrDodgerBlue,          // Ascending Line Color
      clrOrangeRed,           // Descending Line Color
      "===== Labels =====",
      false,                   // Show Labels (disabled for data collection)
      9,                       // Label Font Size
      5,                       // Label Offset Bars
      "===== Scoring Weights =====",
      25,                      // Weight Fractals
      15,                      // Weight Slope
      10,                      // Weight Length
      50,                      // Weight Proximity
      20,                      // Weight Alternation
      "===== Performance Optimization =====",
      true,                    // Use Optimizations
      true,                    // Use Caching
      true,                    // Use Slope Filter
      false,                   // Use Early Exit
      150.0,                   // Early Exit Threshold
      false,                   // Use Spatial Index
      20                       // Spatial Grid Size
   );
   
   if(g_h_fractal_diagonal == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Fractal Diagonal Line indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Fractal Diagonal Line indicator loaded");
   
   // 4. Load Fractal Horizontal Line indicator
   Print("Loading Fractal Horizontal Line indicator...");
   g_h_fractal_horizontal = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Fractal_Horizontal_Line_V5",
      "===== Symbol 108 Settings =====",
      InpFractalBars_Horiz,    // Fractal Bars
      5,                       // Symbol Size (LARGE)
      0,                       // Symbol Offset
      "===== Symbol 119 Settings =====",
      true,                    // Show Symbol 119
      13,                      // Fractal Bars 119
      3,                       // Symbol Size 119
      0,                       // Symbol Offset 119
      clrRed,                  // Symbol 119 Peak Color
      clrLimeGreen,            // Symbol 119 Bottom Color
      "===== Multi-Point Trendline Settings =====",
      true,                    // Show Trendlines
      InpMinFractalTouch,      // Min Fractal Touch
      InpMinLineLength,        // Min Line Length
      InpMaxLineLength,        // Max Line Length
      InpMaxAngleDegrees,      // Max Angle Degrees
      1,                       // Tolerance Type (TOLERANCE_PERCENT)
      InpTolerancePercent_Horiz, // Tolerance Percent
      1.5,                     // Tolerance ATR Multiplier
      14,                      // ATR Period
      InpLookbackBars_Horiz,   // Lookback Bars
      InpExtensionBars_Horiz,  // Extension Bars
      3,                       // Max Peak Lines
      3,                       // Max Bottom Lines
      clrRed,                  // Peak Line Color
      clrLimeGreen,            // Bottom Line Color
      "===== Scoring Weights =====",
      25,                      // Weight Fractals
      15,                      // Weight Slope
      10,                      // Weight Length
      50,                      // Weight Proximity
      "===== Alert Settings =====",
      false,                   // Master Alert Switch (disabled)
      true,                    // Enable Alerts
      true,                    // Show Chart Comment
      0.05,                    // Tolerance Percent Alert
      true,                    // Alert Once
      true,                    // Send Notification
      true,                    // Play Sound
      "alert2.wav",            // Alert Sound
      300,                     // Alert Cooldown Seconds
      "===== Display Settings =====",
      false,                   // Show Labels (disabled)
      9,                       // Label Font Size
      5,                       // Label Offset Bars
      true,                    // Enable Color Intensity
      5.0,                     // Max Fade Distance
      "===== Angle Filtering =====",
      false,                   // Enable Angle Filter
      0.5,                     // Min Line Angle
      45.0,                    // Max Line Angle
      "===== Performance Optimization =====",
      true,                    // Use Optimizations
      true,                    // Use Caching
      true,                    // Use Slope Filter
      false,                   // Use Early Exit
      150.0,                   // Early Exit Threshold
      false,                   // Use Spatial Index
      20                       // Spatial Grid Size
   );
   
   if(g_h_fractal_horizontal == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Fractal Horizontal Line indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Fractal Horizontal Line indicator loaded");
   
   // 5. Load Heiken Ashi Body Size Classification indicator
   Print("Loading Heiken Ashi indicator...");
   g_h_heiken_ashi = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Heiken_Ashi_Body_Size_Classification_Doji_Detection",
      InpZScoreLength_HA,      // Z-Score MA Length
      InpThresholdZ1_HA,       // First threshold
      InpThresholdZ2_HA,       // Second threshold
      clrDeepSkyBlue,         // Up Normal Color
      clrRoyalBlue,           // Up Large Color
      clrLime,                // Up Extreme Color
      clrOrange,              // Down Normal Color
      clrOrangeRed,           // Down Large Color
      clrFireBrick,           // Down Extreme Color
      "=== DOJI DETECTION SETTINGS ===",
      false,                  // Enable Doji Detection (disabled)
      0.20,                   // Doji Max Body Ratio
      0.35,                   // Doji Min Upper Shadow
      0.35,                   // Doji Min Lower Shadow
      0.0001,                 // Doji Min Total Range
      clrMagenta,             // Doji Color
      167,                    // Doji Arrow Code
      0                       // Doji Distance
   );
   
   if(g_h_heiken_ashi == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Heiken Ashi indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Heiken Ashi indicator loaded");
   
   // 6. Load Keltner Channel indicator
   Print("Loading Keltner Channel indicator...");
   g_h_keltner_channel = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Keltner_Channel_ATF_10_Bands_V2",
      "═══ Multi-Timeframe Keltner Settings ═══",
      InpKC_Timeframe,                    // Analysis Timeframe
      InpKC_HRMAPeriod,                   // HRMA Period
      InpKC_ATRPeriod,                    // ATR Period
      "═══ ATR Multipliers ═══",
      InpKC_ATRMult_UltraExtremeUpper,   // Ultra Extreme Upper Multiplier
      InpKC_ATRMult_ExtremeUpper,        // Extreme Upper Multiplier
      InpKC_ATRMult_UpperMost,           // UpperMost Multiplier
      InpKC_ATRMult_Upper,               // Upper Multiplier
      InpKC_ATRMult_Lower,               // Lower Multiplier
      InpKC_ATRMult_LowerMost,           // LowerMost Multiplier
      InpKC_ATRMult_ExtremeLower,        // Extreme Lower Multiplier
      InpKC_ATRMult_UltraExtremeLower    // Ultra Extreme Lower Multiplier
   );
   
   if(g_h_keltner_channel == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Keltner Channel indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Keltner Channel indicator loaded");
   
   // 7. Load Support and Resistance indicator
   Print("Loading Support and Resistance indicator...");
   g_h_support_resistance = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "Support_and_Resistant_at_Significant_Level",
      "Support and Resistant Levels Settings",
      InpSR_Timeframe,           // Timeframe to Analyze
      InpSR_AccuracyMultiplier,  // Accuracy Multiplier
      InpSR_ATRPeriod,           // ATR Period
      InpSR_SafeDistance,        // Safety Distance (points)
      InpSR_BarsToIgnore,        // Recent Bars to Ignore
      InpSR_MaxBarsExt,          // Bars to Analyze
      InpSR_MaxRange,            // Max Price Range (points)
      "Draw Line Settings",
      false,                     // Draw Lines (disabled for data collection)
      1,                         // Line Thickness
      STYLE_DASHDOTDOT,         // Resistance Style
      STYLE_DASHDOTDOT,         // Support Style
      clrRed,                   // Resistance Color
      clrGreen,                 // Support Color
      "====================",
      "MQLTA-SR"                // Indicator Name
   );
   
   if(g_h_support_resistance == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load Support/Resistance indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ Support/Resistance indicator loaded");
   
   // 8. Load ZigZag Color indicator
   Print("Loading ZigZag Color indicator...");
   g_h_zigzag = iCustom(
      currentSymbol,
      PERIOD_CURRENT,
      "ZigZagColor___MarketStructure_JSON_Export_V28_FIXED",
      "ZigZag and Market Structure Settings",
      InpZZ_Depth,           // Depth
      InpZZ_Deviation,       // Deviation
      InpZZ_Backstep,        // Backstep
      clrDodgerBlue,         // Bullish Color (not used)
      clrRed,                // Bearish Color (not used)
      0.50,                  // Equal Threshold
      "Data Source Settings",
      0,                     // Data Source (LIVE)
      "",                    // Source File Name
      "",                    // Preferred Symbol
      "",                    // Preferred Timeframe
      "Data Export Settings",
      false,                 // Show Price Labels
      false,                 // Debug Mode (disabled)
      15000,                 // Bar to Print
      "MarketStructureAnalysis.json", // Export File Name
      "Batch Processing Settings",
      false,                 // Enable Batch Mode
      "BTCUSD,EURUSD,USDJPY", // Batch Symbols
      "M15,H1,H4",           // Batch Timeframes
      "SMMA Settings",
      39,                    // SMMA Period (not used - we use EMA)
      0,                     // SMMA Shift
      PRICE_CLOSE,           // SMMA Applied Price
      clrRed,                // SMMA Color
      2,                     // SMMA Width
      STYLE_SOLID,           // SMMA Style
      "EMA Settings",
      InpEMA_Period,         // EMA Period
      InpEMA_AppliedPrice,   // EMA Applied Price
      clrBlue,               // EMA Color
      2,                     // EMA Width
      STYLE_SOLID,           // EMA Style
      "X Value Settings",
      26,                    // X Threshold
      PERIOD_CURRENT,        // Base Timeframe
      1                      // Confirmation Bars
   );
   
   if(g_h_zigzag == INVALID_HANDLE)
   {
      Print("ERROR: Failed to load ZigZag Color indicator for ", currentSymbol);
      Print("Error code: ", GetLastError());
      return false;
   }
   Print("✓ ZigZag Color indicator loaded");
   
   // Wait for indicators to calculate
   Print("Waiting for indicators to initialize (3 seconds)...");
   Sleep(3000);
   
   // Verify indicators are ready
   int bars1 = BarsCalculated(g_h_moving_averages);
   int bars2 = BarsCalculated(g_h_body_momentum);
   int bars3 = BarsCalculated(g_h_fractal_diagonal);
   int bars4 = BarsCalculated(g_h_fractal_horizontal);
   int bars5 = BarsCalculated(g_h_heiken_ashi);
   int bars6 = BarsCalculated(g_h_keltner_channel);
   int bars7 = BarsCalculated(g_h_support_resistance);
   int bars8 = BarsCalculated(g_h_zigzag);
   
   if(bars1 <= 0 || bars2 <= 0 || bars3 <= 0 || bars4 <= 0 || bars5 <= 0 || bars6 <= 0 || bars7 <= 0 || bars8 <= 0)
   {
      Print("WARNING: One or more indicators not ready yet");
      Print("TEMA_HRMA_SMA-SMMA bars: ", bars1);
      Print("Body Size Momentum bars: ", bars2);
      Print("Fractal Diagonal Line bars: ", bars3);
      Print("Fractal Horizontal Line bars: ", bars4);
      Print("Heiken Ashi bars: ", bars5);
      Print("Keltner Channel bars: ", bars6);
      Print("Support/Resistance bars: ", bars7);
      Print("ZigZag Color bars: ", bars8);
   }
   else
   {
      Print("✓ All indicators ready");
      Print("TEMA_HRMA_SMA-SMMA bars: ", bars1);
      Print("Body Size Momentum bars: ", bars2);
      Print("Fractal Diagonal Line bars: ", bars3);
      Print("Fractal Horizontal Line bars: ", bars4);
      Print("Heiken Ashi bars: ", bars5);
      Print("Keltner Channel bars: ", bars6);
      Print("Support/Resistance bars: ", bars7);
      Print("ZigZag Color bars: ", bars8);
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
      "tema REAL, "                              // TEMA indicator value
      "hrma REAL, "                              // HRMA indicator value
      "smma REAL, "                              // SMMA indicator value
      "[Z-Score of body size] REAL, "           // Body Size Z-Score
      "[Candle classification] INTEGER, "        // Candle Classification
      "diag_asc_line_1 REAL, "                  // Diagonal Ascending Line #1
      "diag_asc_line_2 REAL, "                  // Diagonal Ascending Line #2
      "diag_asc_line_3 REAL, "                  // Diagonal Ascending Line #3
      "diag_desc_line_1 REAL, "                 // Diagonal Descending Line #1
      "diag_desc_line_2 REAL, "                 // Diagonal Descending Line #2
      "diag_desc_line_3 REAL, "                 // Diagonal Descending Line #3
      "diag_high_map REAL, "                    // Diagonal High Map
      "diag_low_map REAL, "                     // Diagonal Low Map
      "horiz_peak_line_1 REAL, "                // Horizontal Peak Line #1
      "horiz_peak_line_2 REAL, "                // Horizontal Peak Line #2
      "horiz_peak_line_3 REAL, "                // Horizontal Peak Line #3
      "horiz_bottom_line_1 REAL, "              // Horizontal Bottom Line #1
      "horiz_bottom_line_2 REAL, "              // Horizontal Bottom Line #2
      "horiz_bottom_line_3 REAL, "              // Horizontal Bottom Line #3
      "horiz_high_map REAL, "                   // Horizontal High Map
      "horiz_low_map REAL, "                    // Horizontal Low Map
      "ha_open REAL, "                          // Heiken Ashi Open
      "ha_high REAL, "                          // Heiken Ashi High
      "ha_low REAL, "                           // Heiken Ashi Low
      "ha_close REAL, "                         // Heiken Ashi Close
      "ha_classification INTEGER, "              // HA Body Size Classification
      "ha_body_size REAL, "                     // HA Body Size
      "ha_body_zscore REAL, "                   // HA Body Z-Score
      "kc_ultra_extreme_upper REAL, "           // Keltner Ultra Extreme Upper
      "kc_extreme_upper REAL, "                 // Keltner Extreme Upper
      "kc_uppermost REAL, "                     // Keltner UpperMost
      "kc_upper REAL, "                         // Keltner Upper
      "kc_upper_middle REAL, "                  // Keltner Upper Middle
      "kc_lower_middle REAL, "                  // Keltner Lower Middle
      "kc_lower REAL, "                         // Keltner Lower
      "kc_lowermost REAL, "                     // Keltner LowerMost
      "kc_extreme_lower REAL, "                 // Keltner Extreme Lower
      "kc_ultra_extreme_lower REAL, "           // Keltner Ultra Extreme Lower
      "sr_support_4 REAL, "                     // S/R Support #4 (furthest)
      "sr_support_3 REAL, "                     // S/R Support #3
      "sr_support_2 REAL, "                     // S/R Support #2
      "sr_support_1 REAL, "                     // S/R Support #1 (closest)
      "sr_resistance_1 REAL, "                  // S/R Resistance #1 (closest)
      "sr_resistance_2 REAL, "                  // S/R Resistance #2
      "sr_resistance_3 REAL, "                  // S/R Resistance #3
      "sr_resistance_4 REAL, "                  // S/R Resistance #4 (furthest)
      "zigzag_peak REAL, "                      // ZigZag Peak (Buffer 0)
      "zigzag_bottom REAL, "                    // ZigZag Bottom (Buffer 1)
      "ema_26 REAL, "                           // EMA(26) (Buffer 4)
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
      
      // Get the last 500 candles
      // IMPORTANT: Use currentSymbol (with suffix) to get correct MT5 data
      int copied = CopyRates(currentSymbol, timeframes[i], 0, 500, rates);
      
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
   
   // Indicator 1: TEMA_HRMA_SMA-SMMA
   double tema_value = GetIndicatorValue(g_h_moving_averages, 3, shift);  // Buffer 3 = TEMA
   double hrma_value = GetIndicatorValue(g_h_moving_averages, 2, shift);  // Buffer 2 = HRMA
   double smma_value = GetIndicatorValue(g_h_moving_averages, 1, shift);  // Buffer 1 = SMMA
   
   // Indicator 2: Body Size Momentum
   double zscore_value = GetIndicatorValue(g_h_body_momentum, 6, shift);      // Buffer 6 = Z-Score
   double classification_value = GetIndicatorValue(g_h_body_momentum, 4, shift); // Buffer 4 = Classification
   
   // Indicator 3: Fractal Diagonal Line
   double diag_asc_1 = GetIndicatorValue(g_h_fractal_diagonal, 0, shift);   // Buffer 0 = Ascending #1
   double diag_asc_2 = GetIndicatorValue(g_h_fractal_diagonal, 1, shift);   // Buffer 1 = Ascending #2
   double diag_asc_3 = GetIndicatorValue(g_h_fractal_diagonal, 2, shift);   // Buffer 2 = Ascending #3
   double diag_desc_1 = GetIndicatorValue(g_h_fractal_diagonal, 3, shift);  // Buffer 3 = Descending #1
   double diag_desc_2 = GetIndicatorValue(g_h_fractal_diagonal, 4, shift);  // Buffer 4 = Descending #2
   double diag_desc_3 = GetIndicatorValue(g_h_fractal_diagonal, 5, shift);  // Buffer 5 = Descending #3
   double diag_high = GetIndicatorValue(g_h_fractal_diagonal, 6, shift);    // Buffer 6 = High Map
   double diag_low = GetIndicatorValue(g_h_fractal_diagonal, 7, shift);     // Buffer 7 = Low Map
   
   // Indicator 4: Fractal Horizontal Line
   double horiz_peak_1 = GetIndicatorValue(g_h_fractal_horizontal, 4, shift);   // Buffer 4 = Peak Line #1
   double horiz_peak_2 = GetIndicatorValue(g_h_fractal_horizontal, 5, shift);   // Buffer 5 = Peak Line #2
   double horiz_peak_3 = GetIndicatorValue(g_h_fractal_horizontal, 6, shift);   // Buffer 6 = Peak Line #3
   double horiz_bottom_1 = GetIndicatorValue(g_h_fractal_horizontal, 7, shift); // Buffer 7 = Bottom Line #1
   double horiz_bottom_2 = GetIndicatorValue(g_h_fractal_horizontal, 8, shift); // Buffer 8 = Bottom Line #2
   double horiz_bottom_3 = GetIndicatorValue(g_h_fractal_horizontal, 9, shift); // Buffer 9 = Bottom Line #3
   double horiz_high = GetIndicatorValue(g_h_fractal_horizontal, 10, shift);    // Buffer 10 = High Map
   double horiz_low = GetIndicatorValue(g_h_fractal_horizontal, 11, shift);     // Buffer 11 = Low Map
   
   // Indicator 5: Heiken Ashi Body Size Classification
   double ha_open = GetIndicatorValue(g_h_heiken_ashi, 0, shift);         // Buffer 0 = HA Open
   double ha_high = GetIndicatorValue(g_h_heiken_ashi, 1, shift);         // Buffer 1 = HA High
   double ha_low = GetIndicatorValue(g_h_heiken_ashi, 2, shift);          // Buffer 2 = HA Low
   double ha_close = GetIndicatorValue(g_h_heiken_ashi, 3, shift);        // Buffer 3 = HA Close
   double ha_class = GetIndicatorValue(g_h_heiken_ashi, 4, shift);        // Buffer 4 = HA Classification
   double ha_body_size = GetIndicatorValue(g_h_heiken_ashi, 6, shift);    // Buffer 6 = HA Body Size
   double ha_zscore = GetIndicatorValue(g_h_heiken_ashi, 7, shift);       // Buffer 7 = HA Z-Score
   
   // Indicator 6: Keltner Channel
   double kc_ultra_extreme_upper = GetIndicatorValue(g_h_keltner_channel, 0, shift);  // Buffer 0
   double kc_extreme_upper = GetIndicatorValue(g_h_keltner_channel, 1, shift);        // Buffer 1
   double kc_uppermost = GetIndicatorValue(g_h_keltner_channel, 2, shift);            // Buffer 2
   double kc_upper = GetIndicatorValue(g_h_keltner_channel, 3, shift);                // Buffer 3
   double kc_upper_middle = GetIndicatorValue(g_h_keltner_channel, 4, shift);         // Buffer 4
   double kc_lower_middle = GetIndicatorValue(g_h_keltner_channel, 5, shift);         // Buffer 5
   double kc_lower = GetIndicatorValue(g_h_keltner_channel, 6, shift);                // Buffer 6
   double kc_lowermost = GetIndicatorValue(g_h_keltner_channel, 7, shift);            // Buffer 7
   double kc_extreme_lower = GetIndicatorValue(g_h_keltner_channel, 8, shift);        // Buffer 8
   double kc_ultra_extreme_lower = GetIndicatorValue(g_h_keltner_channel, 9, shift);  // Buffer 9
   
   // Indicator 7: Support and Resistance
   double sr_support_4 = GetIndicatorValue(g_h_support_resistance, 0, shift);      // Buffer 0
   double sr_support_3 = GetIndicatorValue(g_h_support_resistance, 1, shift);      // Buffer 1
   double sr_support_2 = GetIndicatorValue(g_h_support_resistance, 2, shift);      // Buffer 2
   double sr_support_1 = GetIndicatorValue(g_h_support_resistance, 3, shift);      // Buffer 3
   double sr_resistance_1 = GetIndicatorValue(g_h_support_resistance, 4, shift);   // Buffer 4
   double sr_resistance_2 = GetIndicatorValue(g_h_support_resistance, 5, shift);   // Buffer 5
   double sr_resistance_3 = GetIndicatorValue(g_h_support_resistance, 6, shift);   // Buffer 6
   double sr_resistance_4 = GetIndicatorValue(g_h_support_resistance, 7, shift);   // Buffer 7
   
   // Indicator 8: ZigZag Color
   double zigzag_peak = GetIndicatorValue(g_h_zigzag, 0, shift);    // Buffer 0 = ZigZag Peak
   double zigzag_bottom = GetIndicatorValue(g_h_zigzag, 1, shift);  // Buffer 1 = ZigZag Bottom
   double ema_26 = GetIndicatorValue(g_h_zigzag, 4, shift);         // Buffer 4 = EMA(26)
   
   // Convert EMPTY_VALUE to NULL for SQL
   string tema_str = (tema_value != EMPTY_VALUE && tema_value != 0.0) ? DoubleToString(tema_value, 5) : "NULL";
   string hrma_str = (hrma_value != EMPTY_VALUE && hrma_value != 0.0) ? DoubleToString(hrma_value, 5) : "NULL";
   string smma_str = (smma_value != EMPTY_VALUE && smma_value != 0.0) ? DoubleToString(smma_value, 5) : "NULL";
   string zscore_str = (zscore_value != EMPTY_VALUE) ? DoubleToString(zscore_value, 5) : "NULL";
   string classification_str = (classification_value != EMPTY_VALUE) ? IntegerToString((int)classification_value) : "NULL";
   
   // Convert diagonal line values (0.0 means no line, so keep as NULL)
   string diag_asc_1_str = (diag_asc_1 != EMPTY_VALUE && diag_asc_1 != 0.0) ? DoubleToString(diag_asc_1, 5) : "NULL";
   string diag_asc_2_str = (diag_asc_2 != EMPTY_VALUE && diag_asc_2 != 0.0) ? DoubleToString(diag_asc_2, 5) : "NULL";
   string diag_asc_3_str = (diag_asc_3 != EMPTY_VALUE && diag_asc_3 != 0.0) ? DoubleToString(diag_asc_3, 5) : "NULL";
   string diag_desc_1_str = (diag_desc_1 != EMPTY_VALUE && diag_desc_1 != 0.0) ? DoubleToString(diag_desc_1, 5) : "NULL";
   string diag_desc_2_str = (diag_desc_2 != EMPTY_VALUE && diag_desc_2 != 0.0) ? DoubleToString(diag_desc_2, 5) : "NULL";
   string diag_desc_3_str = (diag_desc_3 != EMPTY_VALUE && diag_desc_3 != 0.0) ? DoubleToString(diag_desc_3, 5) : "NULL";
   string diag_high_str = (diag_high != EMPTY_VALUE && diag_high != 0.0) ? DoubleToString(diag_high, 5) : "NULL";
   string diag_low_str = (diag_low != EMPTY_VALUE && diag_low != 0.0) ? DoubleToString(diag_low, 5) : "NULL";
   
   // Convert horizontal line values (0.0 means no line, so keep as NULL)
   string horiz_peak_1_str = (horiz_peak_1 != EMPTY_VALUE && horiz_peak_1 != 0.0) ? DoubleToString(horiz_peak_1, 5) : "NULL";
   string horiz_peak_2_str = (horiz_peak_2 != EMPTY_VALUE && horiz_peak_2 != 0.0) ? DoubleToString(horiz_peak_2, 5) : "NULL";
   string horiz_peak_3_str = (horiz_peak_3 != EMPTY_VALUE && horiz_peak_3 != 0.0) ? DoubleToString(horiz_peak_3, 5) : "NULL";
   string horiz_bottom_1_str = (horiz_bottom_1 != EMPTY_VALUE && horiz_bottom_1 != 0.0) ? DoubleToString(horiz_bottom_1, 5) : "NULL";
   string horiz_bottom_2_str = (horiz_bottom_2 != EMPTY_VALUE && horiz_bottom_2 != 0.0) ? DoubleToString(horiz_bottom_2, 5) : "NULL";
   string horiz_bottom_3_str = (horiz_bottom_3 != EMPTY_VALUE && horiz_bottom_3 != 0.0) ? DoubleToString(horiz_bottom_3, 5) : "NULL";
   string horiz_high_str = (horiz_high != EMPTY_VALUE && horiz_high != 0.0) ? DoubleToString(horiz_high, 5) : "NULL";
   string horiz_low_str = (horiz_low != EMPTY_VALUE && horiz_low != 0.0) ? DoubleToString(horiz_low, 5) : "NULL";
   
   // Convert Heiken Ashi values
   string ha_open_str = (ha_open != EMPTY_VALUE) ? DoubleToString(ha_open, 5) : "NULL";
   string ha_high_str = (ha_high != EMPTY_VALUE) ? DoubleToString(ha_high, 5) : "NULL";
   string ha_low_str = (ha_low != EMPTY_VALUE) ? DoubleToString(ha_low, 5) : "NULL";
   string ha_close_str = (ha_close != EMPTY_VALUE) ? DoubleToString(ha_close, 5) : "NULL";
   string ha_class_str = (ha_class != EMPTY_VALUE) ? IntegerToString((int)ha_class) : "NULL";
   string ha_body_size_str = (ha_body_size != EMPTY_VALUE) ? DoubleToString(ha_body_size, 5) : "NULL";
   string ha_zscore_str = (ha_zscore != EMPTY_VALUE) ? DoubleToString(ha_zscore, 5) : "NULL";
   
   // Convert Keltner Channel values
   string kc_ultra_extreme_upper_str = (kc_ultra_extreme_upper != EMPTY_VALUE) ? DoubleToString(kc_ultra_extreme_upper, 5) : "NULL";
   string kc_extreme_upper_str = (kc_extreme_upper != EMPTY_VALUE) ? DoubleToString(kc_extreme_upper, 5) : "NULL";
   string kc_uppermost_str = (kc_uppermost != EMPTY_VALUE) ? DoubleToString(kc_uppermost, 5) : "NULL";
   string kc_upper_str = (kc_upper != EMPTY_VALUE) ? DoubleToString(kc_upper, 5) : "NULL";
   string kc_upper_middle_str = (kc_upper_middle != EMPTY_VALUE) ? DoubleToString(kc_upper_middle, 5) : "NULL";
   string kc_lower_middle_str = (kc_lower_middle != EMPTY_VALUE) ? DoubleToString(kc_lower_middle, 5) : "NULL";
   string kc_lower_str = (kc_lower != EMPTY_VALUE) ? DoubleToString(kc_lower, 5) : "NULL";
   string kc_lowermost_str = (kc_lowermost != EMPTY_VALUE) ? DoubleToString(kc_lowermost, 5) : "NULL";
   string kc_extreme_lower_str = (kc_extreme_lower != EMPTY_VALUE) ? DoubleToString(kc_extreme_lower, 5) : "NULL";
   string kc_ultra_extreme_lower_str = (kc_ultra_extreme_lower != EMPTY_VALUE) ? DoubleToString(kc_ultra_extreme_lower, 5) : "NULL";
   
   // Convert Support/Resistance values (0.0 means no level, so keep as NULL)
   string sr_support_4_str = (sr_support_4 != EMPTY_VALUE && sr_support_4 != 0.0) ? DoubleToString(sr_support_4, 5) : "NULL";
   string sr_support_3_str = (sr_support_3 != EMPTY_VALUE && sr_support_3 != 0.0) ? DoubleToString(sr_support_3, 5) : "NULL";
   string sr_support_2_str = (sr_support_2 != EMPTY_VALUE && sr_support_2 != 0.0) ? DoubleToString(sr_support_2, 5) : "NULL";
   string sr_support_1_str = (sr_support_1 != EMPTY_VALUE && sr_support_1 != 0.0) ? DoubleToString(sr_support_1, 5) : "NULL";
   string sr_resistance_1_str = (sr_resistance_1 != EMPTY_VALUE && sr_resistance_1 != 0.0) ? DoubleToString(sr_resistance_1, 5) : "NULL";
   string sr_resistance_2_str = (sr_resistance_2 != EMPTY_VALUE && sr_resistance_2 != 0.0) ? DoubleToString(sr_resistance_2, 5) : "NULL";
   string sr_resistance_3_str = (sr_resistance_3 != EMPTY_VALUE && sr_resistance_3 != 0.0) ? DoubleToString(sr_resistance_3, 5) : "NULL";
   string sr_resistance_4_str = (sr_resistance_4 != EMPTY_VALUE && sr_resistance_4 != 0.0) ? DoubleToString(sr_resistance_4, 5) : "NULL";
   
   // Convert ZigZag values (0.0 means no peak/bottom at this bar)
   string zigzag_peak_str = (zigzag_peak != EMPTY_VALUE && zigzag_peak != 0.0) ? DoubleToString(zigzag_peak, 5) : "NULL";
   string zigzag_bottom_str = (zigzag_bottom != EMPTY_VALUE && zigzag_bottom != 0.0) ? DoubleToString(zigzag_bottom, 5) : "NULL";
   string ema_26_str = (ema_26 != EMPTY_VALUE) ? DoubleToString(ema_26, 5) : "NULL";
   
   // Build INSERT statement using sanitized table name
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
      zscore_str,
      classification_str,
      diag_asc_1_str,
      diag_asc_2_str,
      diag_asc_3_str,
      diag_desc_1_str,
      diag_desc_2_str,
      diag_desc_3_str,
      diag_high_str,
      diag_low_str,
      horiz_peak_1_str,
      horiz_peak_2_str,
      horiz_peak_3_str,
      horiz_bottom_1_str,
      horiz_bottom_2_str,
      horiz_bottom_3_str,
      horiz_high_str,
      horiz_low_str,
      ha_open_str,
      ha_high_str,
      ha_low_str,
      ha_close_str,
      ha_class_str,
      ha_body_size_str,
      ha_zscore_str,
      kc_ultra_extreme_upper_str,
      kc_extreme_upper_str,
      kc_uppermost_str,
      kc_upper_str,
      kc_upper_middle_str,
      kc_lower_middle_str,
      kc_lower_str,
      kc_lowermost_str,
      kc_extreme_lower_str,
      kc_ultra_extreme_lower_str,
      sr_support_4_str,
      sr_support_3_str,
      sr_support_2_str,
      sr_support_1_str,
      sr_resistance_1_str,
      sr_resistance_2_str,
      sr_resistance_3_str,
      sr_resistance_4_str,
      zigzag_peak_str,
      zigzag_bottom_str,
      ema_26_str,
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
double GetIndicatorValue(int indicator_handle, int buffer_index, int shift)
{
   if(indicator_handle == INVALID_HANDLE)
      return EMPTY_VALUE;
   
   double buffer[];
   ArraySetAsSeries(buffer, true);
   
   // Copy single value from indicator buffer
   if(CopyBuffer(indicator_handle, buffer_index, shift, 1, buffer) > 0)
   {
      return buffer[0];
   }
   
   return EMPTY_VALUE;
}
//+------------------------------------------------------------------+
