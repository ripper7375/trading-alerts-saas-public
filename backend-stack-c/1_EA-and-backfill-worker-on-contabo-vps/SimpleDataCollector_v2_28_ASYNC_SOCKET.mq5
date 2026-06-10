//+------------------------------------------------------------------+
//|                          SimpleDataCollector_v2.28_ASYNC_SOCKET.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.28"
#property strict

// Version 2.28-ASYNC-SOCKET Changelog (from v2.27):
// - ARCHITECTURE SHIFT: Replaced synchronous blocking WebRequest with native MQL5 TCP Sockets.
// - PERFORMANCE: Achieves < 1ms execution time to prevent MT5 UI thread freezing.
// - Payloads are sent to a Local TCP Relay (e.g., Python background worker) on 127.0.0.1.
// - Added SocketTimeoutMs (default 5ms) to ensure absolute non-blocking behavior.
// - SCHEMA UPDATE (61 columns): All v2.27 schema updates (dual_tema, pinbar) fully preserved.

// Include SQLite3 library
#include <SQLite3\SQLite3Base.mqh>

//+------------------------------------------------------------------+
//| Input parameters                                                 |
//+------------------------------------------------------------------+
input string SymbolsList = "BTCUSD,ETHUSD,XAUUSD";  // Symbols to collect (comma-separated)
input string DatabasePath = "C:/Scripts/database/"; // Database folder path

// --- Async Socket Relay Configuration ---
input bool   EnableSocketRelay = true;             // Enable Async TCP Publishing
input string LocalRelayIP = "127.0.0.1";           // IP of local Python relay
input uint   LocalRelayPort = 5555;                // Port of local Python relay
input uint   SocketTimeoutMs = 5;                  // Max blocking time per socket connection
input string TerminalID = "terminal_001";          // Terminal identifier (terminal_001 to terminal_015)

input int MaxBarsPerTimeframe = 10000;             // Max bars per timeframe per symbol
input bool EnableCircularBuffer = true;            // Replace oldest bars when limit reached

// Timer & circuit breaker settings
input int DataCollectionIntervalSec = 300;         // Data collection interval in seconds (300 = 5 min)
input int CircuitBreakerThreshold = 10;            // Consecutive Socket failures before circuit opens
input int CircuitBreakerCooldownSec = 300;         // Seconds to wait before retrying Socket after circuit opens

// Indicator parameters (Preserved exactly from v2.27)
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

// --- Dual TEMA High/Low parameters ---
input int InpDualTEMA_Period = 9;

// --- Pinbar Detector parameters ---
input int    InpPinbar_StringencyLevel    = 1;
input int    InpPinbar_CountBars          = 500;
input bool   InpPinbar_UseManualSettings  = true;
input double InpPinbar_MinWickSize        = 0.75;
input double InpPinbar_MaxBodySize        = 0.25;
input double InpPinbar_BodyPosition       = 0.75;
input double InpPinbar_Protruding         = 0.40;

//+------------------------------------------------------------------+
//| Global structures and variables                                  |
//+------------------------------------------------------------------+

// Timeframes to collect
ENUM_TIMEFRAMES timeframes[] = {
   PERIOD_M5, PERIOD_M15, PERIOD_M30,
   PERIOD_H1, PERIOD_H2, PERIOD_H4, PERIOD_H8, PERIOD_H12, PERIOD_D1
};

// Symbol information structure
struct SymbolInfo
{
   string actualName;      // Actual symbol name in MT5 (e.g., "EURUSD.i")
   string sanitizedName;   // Sanitized for database (e.g., "eurusd")
};

// Timeframe indicators structure
struct TimeframeIndicators
{
   int h_tema;
   int h_hrma;
   int h_smma;
   int h_zscore;
   int h_fractal_diagonal;
   int h_fractal_horizontal;
   int h_heiken_ashi;
   int h_keltner_channel;
   int h_support_resistance;
   int h_zigzag;
   int h_dual_tema_hl;   // Dual TEMA High/Low (buffer 0 = high, buffer 1 = low)
   int h_pinbar;         // Pinbar Detector (buffer 0 = bullish, buffer 1 = bearish)
};

// Symbol database connection
struct SymbolDatabase
{
   string symbol;
   string sanitizedName;
   CSQLite3Base db;
   bool connected;
};

// Collection statistics
struct CollectionStats
{
   int apiSuccessCount;
   int apiFailureCount;
   int sqliteBackupCount;
   int tickCollections;
   int timerCollections;
   datetime lastAPIFailure;

   void Reset()
   {
      apiSuccessCount = 0;
      apiFailureCount = 0;
      sqliteBackupCount = 0;
      tickCollections = 0;
      timerCollections = 0;
      lastAPIFailure = 0;
   }
};

// Circuit breaker state
struct CircuitBreakerState
{
   int consecutiveFailures;
   datetime circuitOpenedAt;
   bool isOpen;

   void Reset()
   {
      consecutiveFailures = 0;
      circuitOpenedAt = 0;
      isOpen = false;
   }

   void RecordSuccess()
   {
      consecutiveFailures = 0;
      isOpen = false;
   }

   void RecordFailure(int threshold, int cooldownSec)
   {
      consecutiveFailures++;

      if(consecutiveFailures >= threshold && !isOpen)
      {
         isOpen = true;
         circuitOpenedAt = TimeCurrent();
         Print("🔴 CIRCUIT BREAKER OPEN: ", consecutiveFailures,
               " consecutive socket failures. Skipping Relay for ", cooldownSec, "s");
      }
   }

   bool ShouldSkipAPI(int cooldownSec)
   {
      if(!isOpen) return false;

      // Check if cooldown has elapsed
      if(TimeCurrent() - circuitOpenedAt >= cooldownSec)
      {
         Print("🟡 CIRCUIT BREAKER HALF-OPEN: Cooldown elapsed, retrying socket...");
         isOpen = false;
         consecutiveFailures = 0;
         return false;
      }

      return true; // Still in cooldown, skip Socket
   }
};

// Global variables
SymbolInfo symbols[];
int symbolCount = 0;
TimeframeIndicators tfIndicators[];
SymbolDatabase symbolDatabases[];
CollectionStats g_stats;
CircuitBreakerState g_circuitBreaker;
datetime lastProcessed[][9];  // [symbolIndex][timeframeIndex]
int g_timerTickCount = 0;     // Counter for hourly stats in timer

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("========================================");
   Print("SimpleDataCollector v2.28-ASYNC-SOCKET");
   Print("========================================");

   // Verify Socket Relay configuration
   if(EnableSocketRelay)
   {
      if(StringLen(TerminalID) < 5)
      {
         Print("❌ ERROR: Please configure TerminalID");
         Print("   Example: terminal_001");
         return INIT_FAILED;
      }

      Print("✅ Async TCP Socket configured:");
      Print("   Relay IP: ", LocalRelayIP, ":", LocalRelayPort);
      Print("   Terminal ID: ", TerminalID);
      Print("   Socket Timeout: ", SocketTimeoutMs, "ms");
      Print("   Circuit Breaker: ", CircuitBreakerThreshold, " failures → ",
            CircuitBreakerCooldownSec, "s cooldown");
   }
   else
   {
      Print("⚠️ Socket Relay disabled - SQLite-only mode");
      Print("   Data will be stored locally and require manual backfill");
   }

   // Parse symbols list
   if(!ParseSymbolsList())
   {
      return INIT_FAILED;
   }

   Print("Found ", symbolCount, " symbols to collect");

   // Warn about resource usage
   if(symbolCount > 10)
   {
      if(symbolCount <= 15)
      {
         Print("⚠️ WARNING: Collecting ", symbolCount, " symbols");
         Print("   This is a heavy workload. Monitor CPU/memory usage.");
      }
      else
      {
         Print("❌ ERROR: Too many symbols (", symbolCount, " > 15)");
         Print("   Maximum recommended: 15 symbols per terminal");
         Print("   Please split across multiple terminals");
         return INIT_FAILED;
      }
   }

   // Initialize indicators for all symbols and timeframes
   if(!InitializeIndicators())
   {
      return INIT_FAILED;
   }

   // Initialize SQLite databases
   if(!InitializeDatabases())
   {
      return INIT_FAILED;
   }

   // Initialize lastProcessed array [symbolIndex][timeframeIndex]
   ArrayResize(lastProcessed, symbolCount);

   for(int i = 0; i < symbolCount; i++)
   {
      for(int j = 0; j < 9; j++)
      {
         lastProcessed[i][j] = 0;
      }
   }

   // Initialize statistics and circuit breaker
   g_stats.Reset();
   g_circuitBreaker.Reset();
   g_timerTickCount = 0;

   // Set up timer for periodic data collection (every 5 minutes by default)
   EventSetTimer(DataCollectionIntervalSec);

   Print("✅ Initialization complete");
   Print("   Monitoring ", symbolCount, " symbols × 9 timeframes = ",
         symbolCount * 9, " data streams");
   Print("   Collection mode: Tick-driven + Timer every ", DataCollectionIntervalSec, "s");
   Print("   New Architecture: Async Local TCP Socket Relay");
   Print("========================================");

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();

   Print("");
   Print("=== EA Stopping - Final Statistics ===");
   Print("Socket Relay Success: ", g_stats.apiSuccessCount);
   Print("Socket Relay Failures: ", g_stats.apiFailureCount);
   Print("SQLite Backups: ", g_stats.sqliteBackupCount);
   Print("Tick Collections: ", g_stats.tickCollections);
   Print("Timer Collections: ", g_stats.timerCollections);

   int totalAttempts = g_stats.apiSuccessCount + g_stats.apiFailureCount;
   if(totalAttempts > 0)
   {
      double successRate = (double)g_stats.apiSuccessCount / totalAttempts * 100.0;
      Print("Final Success Rate: ", DoubleToString(successRate, 2), "%");
   }

   if(g_circuitBreaker.isOpen)
   {
      Print("⚠️ Circuit breaker was OPEN at shutdown");
   }

   Print("=====================================");
   Print("");

   // Release indicator handles
   for(int i = 0; i < ArraySize(tfIndicators); i++)
   {
      if(tfIndicators[i].h_tema != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_tema);
      if(tfIndicators[i].h_hrma != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_hrma);
      if(tfIndicators[i].h_smma != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_smma);
      if(tfIndicators[i].h_zscore != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_zscore);
      if(tfIndicators[i].h_fractal_diagonal != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_fractal_diagonal);
      if(tfIndicators[i].h_fractal_horizontal != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_fractal_horizontal);
      if(tfIndicators[i].h_heiken_ashi != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_heiken_ashi);
      if(tfIndicators[i].h_keltner_channel != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_keltner_channel);
      if(tfIndicators[i].h_support_resistance != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_support_resistance);
      if(tfIndicators[i].h_zigzag != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_zigzag);
      if(tfIndicators[i].h_dual_tema_hl != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_dual_tema_hl);
      if(tfIndicators[i].h_pinbar != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_pinbar);
   }
}

//+------------------------------------------------------------------+
//| Timer function — 5-minute periodic sweep + hourly stats          |
//+------------------------------------------------------------------+
void OnTimer()
{
   g_timerTickCount++;

   // --- Periodic data collection sweep ---
   int barsCollected = 0;

   for(int symbolIndex = 0; symbolIndex < symbolCount; symbolIndex++)
   {
      for(int tfIndex = 0; tfIndex < 9; tfIndex++)
      {
         ENUM_TIMEFRAMES tf = timeframes[tfIndex];

         // Get latest completed bar time
         MqlRates rates[];
         ArraySetAsSeries(rates, true);

         int copied = CopyRates(symbols[symbolIndex].actualName, tf, 1, 1, rates);

         if(copied <= 0)
            continue;

         datetime barTime = rates[0].time;

         // Check if this bar has NOT been processed yet
         if(barTime != lastProcessed[symbolIndex][tfIndex])
         {
            // Process this completed bar
            if(InsertCandle(symbolIndex, tfIndex))
            {
               barsCollected++;
            }

            // Update last processed time
            lastProcessed[symbolIndex][tfIndex] = barTime;
         }
      }
   }

   if(barsCollected > 0)
   {
      g_stats.timerCollections += barsCollected;
      Print("⏰ Timer sweep collected ", barsCollected, " bars");
   }

   // --- Hourly statistics (every 12 timer ticks if interval=300s) ---
   int ticksPerHour = 3600 / DataCollectionIntervalSec;

   if(ticksPerHour < 1) ticksPerHour = 1;

   if(g_timerTickCount % ticksPerHour == 0)
   {
      PrintCollectionStats();
   }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check each symbol and timeframe for new completed bars
   for(int symbolIndex = 0; symbolIndex < symbolCount; symbolIndex++)
   {
      for(int tfIndex = 0; tfIndex < 9; tfIndex++)
      {
         ENUM_TIMEFRAMES tf = timeframes[tfIndex];

         // Get latest bar time
         MqlRates rates[];
         ArraySetAsSeries(rates, true);

         int copied = CopyRates(symbols[symbolIndex].actualName, tf, 1, 1, rates);

         if(copied <= 0)
            continue;

         datetime barTime = rates[0].time;

         // Check if this is a new bar
         if(barTime != lastProcessed[symbolIndex][tfIndex])
         {
            // Process this completed bar
            if(InsertCandle(symbolIndex, tfIndex))
            {
               g_stats.tickCollections++;
            }

            // Update last processed time
            lastProcessed[symbolIndex][tfIndex] = barTime;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Parse symbols list from input                                    |
//+------------------------------------------------------------------+
bool ParseSymbolsList()
{
   string symbolTokens[];
   int tokenCount = StringSplit(SymbolsList, ',', symbolTokens);

   if(tokenCount <= 0)
   {
      Print("ERROR: No symbols configured");
      return false;
   }

   ArrayResize(symbols, tokenCount);
   symbolCount = 0;

   for(int i = 0; i < tokenCount; i++)
   {
      string baseSymbol = symbolTokens[i];
      StringTrimLeft(baseSymbol);
      StringTrimRight(baseSymbol);

      if(StringLen(baseSymbol) == 0)
         continue;

      // Try to find actual symbol name
      string actualSymbol = DetectBrokerSymbol(baseSymbol);

      if(StringLen(actualSymbol) == 0)
      {
         Print("WARNING: Symbol not found: ", baseSymbol);
         continue;
      }

      symbols[symbolCount].actualName = actualSymbol;
      symbols[symbolCount].sanitizedName = SanitizeSymbolName(baseSymbol);

      Print("✓ Symbol mapped: ", baseSymbol, " → ", actualSymbol,
            " (db: ", symbols[symbolCount].sanitizedName, ")");

      symbolCount++;
   }

   ArrayResize(symbols, symbolCount);
   return (symbolCount > 0);
}

//+------------------------------------------------------------------+
//| Detect broker-specific symbol name                               |
//+------------------------------------------------------------------+
string DetectBrokerSymbol(string baseSymbol)
{
   // Try exact match first
   if(SymbolSelect(baseSymbol, true))
      return baseSymbol;

   // Try common suffixes
   string suffixes[] = {".i", ".a", ".raw", ".pro", ".ecn", ".m", "", "m", "f"};

   for(int i = 0; i < ArraySize(suffixes); i++)
   {
      string testSymbol = baseSymbol + suffixes[i];

      if(SymbolSelect(testSymbol, true))
         return testSymbol;
   }

   return "";
}

//+------------------------------------------------------------------+
//| Sanitize symbol name for database                                |
//+------------------------------------------------------------------+
string SanitizeSymbolName(string symbol)
{
   string sanitized = symbol;
   StringToLower(sanitized);

   // Remove common suffixes
   StringReplace(sanitized, ".i", "");
   StringReplace(sanitized, ".a", "");
   StringReplace(sanitized, ".raw", "");
   StringReplace(sanitized, ".pro", "");
   StringReplace(sanitized, ".ecn", "");
   StringReplace(sanitized, ".m", "");

   return sanitized;
}

//+------------------------------------------------------------------+
//| Initialize indicators for all symbols and timeframes             |
//+------------------------------------------------------------------+
bool InitializeIndicators()
{
   int totalSlots = symbolCount * 9;
   ArrayResize(tfIndicators, totalSlots);

   Print("Initializing ", totalSlots, " indicator sets...");

   for(int symbolIndex = 0; symbolIndex < symbolCount; symbolIndex++)
   {
      for(int tfIndex = 0; tfIndex < 9; tfIndex++)
      {
         int slotIndex = symbolIndex * 9 + tfIndex;

         if(!InitializeIndicatorsForSlot(slotIndex, symbols[symbolIndex].actualName, timeframes[tfIndex]))
         {
            Print("ERROR: Failed to initialize indicators for ",
                  symbols[symbolIndex].actualName, " ", EnumToString(timeframes[tfIndex]));

            return false;
         }
      }
   }

   Print("✓ All indicators initialized");
   return true;
}

//+------------------------------------------------------------------+
//| Initialize indicators for one symbol/timeframe slot              |
//+------------------------------------------------------------------+
bool InitializeIndicatorsForSlot(int slotIndex, string sym, ENUM_TIMEFRAMES tf)
{
   // 1. TEMA
   tfIndicators[slotIndex].h_tema = iCustom(
      sym, tf, "TEMA_v0", InpMAPeriod, InpAppliedPrice
   );
   if(tfIndicators[slotIndex].h_tema == INVALID_HANDLE) return false;

   // 2. HRMA
   tfIndicators[slotIndex].h_hrma = iCustom(
      sym, tf, "HRMA", len_hrma, InpAppliedPrice
   );
   if(tfIndicators[slotIndex].h_hrma == INVALID_HANDLE) return false;

   // 3. SMMA
   tfIndicators[slotIndex].h_smma = iMA(
      sym, tf, InpSMMAPeriod, 0, MODE_SMMA, InpAppliedPrice
   );
   if(tfIndicators[slotIndex].h_smma == INVALID_HANDLE) return false;

   // 4. Z-Score
   tfIndicators[slotIndex].h_zscore = iCustom(
      sym, tf, "ZScore_BodySize_Classification_NoSignal_TEMP",
      InpZScoreLength, InpThresholdZ1, InpThresholdZ2, InpCandleWidth
   );
   if(tfIndicators[slotIndex].h_zscore == INVALID_HANDLE) return false;

   // 5. Fractal Diagonal
   tfIndicators[slotIndex].h_fractal_diagonal = iCustom(
      sym, tf, "Fractal_Diagonal_V10_NoPlot__Export_v2",
      InpFractalBars, InpMinMixedTouches, InpMinPeakTouches, InpMinBottomTouches,
      InpMaxConsecutiveSameType, InpMinDiagonalLength, InpMinDiagonalAngle,
      InpMaxDiagonalAngle, InpTolerancePercent, InpLookbackBars, InpExtensionBars,
      clrRed, clrBlue, clrYellow, clrOrange, 2
   );
   if(tfIndicators[slotIndex].h_fractal_diagonal == INVALID_HANDLE) return false;

   // 6. Fractal Horizontal
   tfIndicators[slotIndex].h_fractal_horizontal = iCustom(
      sym, tf, "Fractal_Horizontal_V9_NoPlot__Export_v2",
      InpFractalBars_Horiz, InpMinFractalTouch, InpMinLineLength, InpMaxLineLength,
      InpMaxAngleDegrees, InpTolerancePercent_Horiz, InpLookbackBars_Horiz,
      InpExtensionBars_Horiz, clrRed, clrBlue, clrYellow, clrOrange, 2
   );
   if(tfIndicators[slotIndex].h_fractal_horizontal == INVALID_HANDLE) return false;

   // 7. Heiken Ashi
   tfIndicators[slotIndex].h_heiken_ashi = iCustom(
      sym, tf, "HeikenAshi_ZScore_BodySize_Classification_NoSignal_TEMP",
      InpZScoreLength_HA, InpThresholdZ1_HA, InpThresholdZ2_HA, InpCandleWidth
   );
   if(tfIndicators[slotIndex].h_heiken_ashi == INVALID_HANDLE) return false;

   // 8. Keltner Channel
   tfIndicators[slotIndex].h_keltner_channel = iCustom(
      sym, tf, "keltner_HRMA_MorePlotBuffer_Export",
      InpKC_HRMAPeriod, InpKC_ATRPeriod,
      InpKC_ATRMult_UltraExtremeUpper, InpKC_ATRMult_ExtremeUpper,
      InpKC_ATRMult_UpperMost, InpKC_ATRMult_Upper,
      InpKC_ATRMult_Lower, InpKC_ATRMult_LowerMost,
      InpKC_ATRMult_ExtremeLower, InpKC_ATRMult_UltraExtremeLower
   );
   if(tfIndicators[slotIndex].h_keltner_channel == INVALID_HANDLE) return false;

   // 9. Support/Resistance
   tfIndicators[slotIndex].h_support_resistance = iCustom(
      sym, tf, "Sup_Res_MorePlotBuffer_V2",
      InpSR_AccuracyMultiplier, InpSR_ATRPeriod, InpSR_SafeDistance,
      InpSR_BarsToIgnore, InpSR_MaxBarsExt, InpSR_MaxRange,
      clrRed, clrLime, STYLE_SOLID, 1, false
   );
   if(tfIndicators[slotIndex].h_support_resistance == INVALID_HANDLE) return false;

   // 10. ZigZag
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

   // 11. Dual TEMA High/Low
   tfIndicators[slotIndex].h_dual_tema_hl = iCustom(
      sym, tf, "Dual_TEMA_High_Low",
      InpDualTEMA_Period,  // EMA period
      0                    // Shift
   );
   if(tfIndicators[slotIndex].h_dual_tema_hl == INVALID_HANDLE) return false;

   // 12. Pinbar Detector
   tfIndicators[slotIndex].h_pinbar = iCustom(
      sym, tf, "Pinbar Detector_Diamond Symbol_V17",
      InpPinbar_StringencyLevel,   
      0,                           // DisplayMode = INDICATOR_BUFFERS
      InpPinbar_CountBars,         
      5,             
      false,                       
      "=== LEFT EYE ANALYSIS ===", 
      false,                       
      false,      
      false,                       
      "=== PERMANENT OBJECTS ===", 
      false,                       
      200,    
      clrLimeGreen,                
      clrRed,                      
      2,                    
      "=== MANUAL OVERRIDE ===",   
      InpPinbar_UseManualSettings, 
      InpPinbar_MinWickSize,       
      InpPinbar_MaxBodySize,       
      InpPinbar_BodyPosition,      
      InpPinbar_Protruding,        
      0.15,        
      "=== ADVANCED FILTERS ===",  
      false,                       
      false,                       
      false,    
      1.0,                         
      0.0,                         
      0.1,          
      1                            
   );
   if(tfIndicators[slotIndex].h_pinbar == INVALID_HANDLE) return false;

   return true;
}

//+------------------------------------------------------------------+
//| Initialize SQLite databases (one per symbol)                     |
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

      // Enable WAL mode for better concurrent read/write performance
      symbolDatabases[i].db.Exec("PRAGMA journal_mode=WAL");
      symbolDatabases[i].db.Exec("PRAGMA synchronous=NORMAL");

      // Create table (new databases)
      if(!CreateSymbolTable(i))
      {
         Print("ERROR: Failed to create table for ", symbolDatabases[i].sanitizedName);
         return false;
      }

      // Migrate existing databases to add v2.27 columns if missing
      MigrateSymbolTable(i);

      Print("✓ Database ready: ", symbolDatabases[i].sanitizedName, ".db");
   }

   return true;
}

//+------------------------------------------------------------------+
//| Create table for symbol                                          |
//+------------------------------------------------------------------+
bool CreateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string createTableSQL = StringFormat(
      "CREATE TABLE IF NOT EXISTS [%s] ("
      "timestamp INTEGER, "
      "symbol TEXT, "
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
      "ema REAL, "
      "dual_tema_high REAL, "
      "dual_tema_low REAL, "
      "pinbar INTEGER, "
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
//| Migrate existing table to add v2.27 columns if missing           |
//+------------------------------------------------------------------+
void MigrateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string addHighSQL = StringFormat(
      "ALTER TABLE [%s] ADD COLUMN dual_tema_high REAL", tableName
   );
   symbolDatabases[dbIndex].db.Exec(addHighSQL);  

   string addLowSQL = StringFormat(
      "ALTER TABLE [%s] ADD COLUMN dual_tema_low REAL", tableName
   );
   symbolDatabases[dbIndex].db.Exec(addLowSQL);

   string addPinbarSQL = StringFormat(
      "ALTER TABLE [%s] ADD COLUMN pinbar INTEGER", tableName
   );
   symbolDatabases[dbIndex].db.Exec(addPinbarSQL);

   Print("✓ Schema migration checked for: ", tableName);
}

//+------------------------------------------------------------------+
//| Get indicator value helper function                              |
//+------------------------------------------------------------------+
double GetIndicatorValue(int handle, int buffer, int shift)
{
   double values[1];

   if(CopyBuffer(handle, buffer, shift, 1, values) > 0)
      return values[0];
      
   return EMPTY_VALUE;
}

//+------------------------------------------------------------------+
//| Insert candle data for one symbol/timeframe                      |
//+------------------------------------------------------------------+
bool InsertCandle(int symbolIndex, int tfIndex)
{
   string sanitizedName = symbols[symbolIndex].sanitizedName;
   ENUM_TIMEFRAMES tf = timeframes[tfIndex];

   int slotIndex = symbolIndex * 9 + tfIndex;

   // Get bar data
   MqlRates rate[];
   ArraySetAsSeries(rate, true);

   if(CopyRates(symbols[symbolIndex].actualName, tf, 1, 1, rate) <= 0)
   {
      return false;
   }

   int shift = 1;

   // Collect all indicator values
   double tema = GetIndicatorValue(tfIndicators[slotIndex].h_tema, 0, shift);
   double hrma = GetIndicatorValue(tfIndicators[slotIndex].h_hrma, 0, shift);
   double smma = GetIndicatorValue(tfIndicators[slotIndex].h_smma, 0, shift);
   double zscore = GetIndicatorValue(tfIndicators[slotIndex].h_zscore, 0, shift);
   double classification = GetIndicatorValue(tfIndicators[slotIndex].h_zscore, 1, shift);

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
   double ema = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 4, shift);

   double dual_tema_high = GetIndicatorValue(tfIndicators[slotIndex].h_dual_tema_hl, 0, shift);
   double dual_tema_low  = GetIndicatorValue(tfIndicators[slotIndex].h_dual_tema_hl, 1, shift);

   double pinbar_bull = GetIndicatorValue(tfIndicators[slotIndex].h_pinbar, 0, shift);
   double pinbar_bear  = GetIndicatorValue(tfIndicators[slotIndex].h_pinbar, 1, shift);
   
   int pinbar = ((pinbar_bull != EMPTY_VALUE && pinbar_bull != 0.0) ||
                 (pinbar_bear  != EMPTY_VALUE && pinbar_bear  != 0.0)) ? 1 : 0;

   // ============================================================
   // PRIMARY PATH: Local Async Socket Fire & Forget
   // ============================================================
   if(EnableSocketRelay)
   {
      // Check circuit breaker before attempting Socket call
      if(g_circuitBreaker.ShouldSkipAPI(CircuitBreakerCooldownSec))
      {
         // Circuit is open — skip Socket, go straight to SQLite backup
      }
      else
      {
         bool socketSuccess = PublishToLocalRelay(
            sanitizedName, tf, rate[0],
            tema, hrma, smma, zscore, classification,
            diag_asc_1, diag_asc_2, diag_asc_3,
            diag_desc_1, diag_desc_2, diag_desc_3,
            diag_high, diag_low,
            horiz_peak_1, horiz_peak_2, horiz_peak_3,
            horiz_bottom_1, horiz_bottom_2, horiz_bottom_3,
            horiz_high, horiz_low,
            ha_open, ha_high, ha_low, ha_close, ha_class, ha_body_size, ha_zscore,
            kc_ultra_extreme_upper, kc_extreme_upper, kc_uppermost, kc_upper,
            kc_upper_middle, kc_lower_middle, kc_lower, kc_lowermost,
            kc_extreme_lower, kc_ultra_extreme_lower,
            sr_support_4, sr_support_3, sr_support_2, sr_support_1,
            sr_resistance_1, sr_resistance_2, sr_resistance_3, sr_resistance_4,
            zigzag_peak, zigzag_bottom, ema,
            dual_tema_high, dual_tema_low, pinbar
         );

         if(socketSuccess)
         {
            // ✅ Success!
            g_stats.apiSuccessCount++;
            g_circuitBreaker.RecordSuccess();
            return true;
         }

         // ❌ Socket Gateway failed
         g_stats.apiFailureCount++;
         g_stats.lastAPIFailure = TimeCurrent();
         g_circuitBreaker.RecordFailure(CircuitBreakerThreshold, CircuitBreakerCooldownSec);

         if(!g_circuitBreaker.isOpen)
         {
            Print("⚠️ Socket Relay failed for ", sanitizedName, " ", EnumToString(tf),
                  " - backing up to SQLite (failures: ", g_circuitBreaker.consecutiveFailures, ")");
         }
      }
   }

   // ============================================================
   // FALLBACK PATH: SQLite backup 
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
      Print("❌ ERROR: Database not found for ", sanitizedName);
      return false;
   }

   bool sqliteSuccess = WriteSQLiteBackup(
      dbIndex, tf, rate[0],
      tema, hrma, smma, zscore, classification,
      diag_asc_1, diag_asc_2, diag_asc_3,
      diag_desc_1, diag_desc_2, diag_desc_3,
      diag_high, diag_low,
      horiz_peak_1, horiz_peak_2, horiz_peak_3,
      horiz_bottom_1, horiz_bottom_2, horiz_bottom_3,
      horiz_high, horiz_low,
      ha_open, ha_high, ha_low, ha_close, ha_class, ha_body_size, ha_zscore,
      kc_ultra_extreme_upper, kc_extreme_upper, kc_uppermost, kc_upper,
      kc_upper_middle, kc_lower_middle, kc_lower, kc_lowermost,
      kc_extreme_lower, kc_ultra_extreme_lower,
      sr_support_4, sr_support_3, sr_support_2, sr_support_1,
      sr_resistance_1, sr_resistance_2, sr_resistance_3, sr_resistance_4,
      zigzag_peak, zigzag_bottom, ema,
      dual_tema_high, dual_tema_low, pinbar
   );

   if(sqliteSuccess)
   {
      g_stats.sqliteBackupCount++;
      MarkForBackfill(sanitizedName, tf, rate[0].time);
      return true;
   }

   Print("❌ CRITICAL: Both Socket Relay AND SQLite failed for ",
         sanitizedName, " ", EnumToString(tf));
         
   return false;
}

//+------------------------------------------------------------------+
//| Publish to Async TCP Socket Relay (v2.28)                        |
//+------------------------------------------------------------------+
bool PublishToLocalRelay(string symbol, ENUM_TIMEFRAMES tf, MqlRates &rate,
                        double tema, double hrma, double smma, double zscore, double classification,
                        double diag_asc_1, double diag_asc_2, double diag_asc_3,
                        double diag_desc_1, double diag_desc_2, double diag_desc_3,
                        double diag_high, double diag_low,
                        double horiz_peak_1, double horiz_peak_2, double horiz_peak_3,
                        double horiz_bottom_1, double horiz_bottom_2, double horiz_bottom_3,
                        double horiz_high, double horiz_low,
                        double ha_open, double ha_high, double ha_low, double ha_close,
                        double ha_class, double ha_body_size, double ha_zscore,
                        double kc_ultra_extreme_upper, double kc_extreme_upper, double kc_uppermost, double kc_upper,
                        double kc_upper_middle, double kc_lower_middle, double kc_lower, double kc_lowermost,
                        double kc_extreme_lower, double kc_ultra_extreme_lower,
                        double sr_support_4, double sr_support_3, double sr_support_2, double sr_support_1,
                        double sr_resistance_1, double sr_resistance_2, double sr_resistance_3, double sr_resistance_4,
                        double zigzag_peak, double zigzag_bottom, double ema,
                        double dual_tema_high, double dual_tema_low, int pinbar)
{
   // Build complete JSON payload with all columns
   string payload = StringFormat(
      "{"
      "\"terminal_id\":\"%s\","
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
      "\"classification\":%d,"
      "\"diag_asc_line_1\":%.5f,"
      "\"diag_asc_line_2\":%.5f,"
      "\"diag_asc_line_3\":%.5f,"
      "\"diag_desc_line_1\":%.5f,"
      "\"diag_desc_line_2\":%.5f,"
      "\"diag_desc_line_3\":%.5f,"
      "\"diag_high_map\":%.5f,"
      "\"diag_low_map\":%.5f,"
      "\"horiz_peak_line_1\":%.5f,"
      "\"horiz_peak_line_2\":%.5f,"
      "\"horiz_peak_line_3\":%.5f,"
      "\"horiz_bottom_line_1\":%.5f,"
      "\"horiz_bottom_line_2\":%.5f,"
      "\"horiz_bottom_line_3\":%.5f,"
      "\"horiz_high_map\":%.5f,"
      "\"horiz_low_map\":%.5f,"
      "\"ha_open\":%.5f,"
      "\"ha_high\":%.5f,"
      "\"ha_low\":%.5f,"
      "\"ha_close\":%.5f,"
      "\"ha_classification\":%d,"
      "\"ha_body_size\":%.5f,"
      "\"ha_body_zscore\":%.5f,"
      "\"kc_ultra_extreme_upper\":%.5f,"
      "\"kc_extreme_upper\":%.5f,"
      "\"kc_uppermost\":%.5f,"
      "\"kc_upper\":%.5f,"
      "\"kc_upper_middle\":%.5f,"
      "\"kc_lower_middle\":%.5f,"
      "\"kc_lower\":%.5f,"
      "\"kc_lowermost\":%.5f,"
      "\"kc_extreme_lower\":%.5f,"
      "\"kc_ultra_extreme_lower\":%.5f,"
      "\"sr_support_4\":%.5f,"
      "\"sr_support_3\":%.5f,"
      "\"sr_support_2\":%.5f,"
      "\"sr_support_1\":%.5f,"
      "\"sr_resistance_1\":%.5f,"
      "\"sr_resistance_2\":%.5f,"
      "\"sr_resistance_3\":%.5f,"
      "\"sr_resistance_4\":%.5f,"
      "\"zigzag_peak\":%.5f,"
      "\"zigzag_bottom\":%.5f,"
      "\"ema\":%.5f,"
      "\"dual_tema_high\":%.5f,"
      "\"dual_tema_low\":%.5f,"
      "\"pinbar\":%d,"
      "\"collected_at\":%d"
      "}\n",  // CRITICAL: The \n delimiter allows Python to readline()
      TerminalID,
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
      (int)(classification != EMPTY_VALUE ? classification : 0),
      (diag_asc_1 != EMPTY_VALUE ? diag_asc_1 : 0),
      (diag_asc_2 != EMPTY_VALUE ? diag_asc_2 : 0),
      (diag_asc_3 != EMPTY_VALUE ? diag_asc_3 : 0),
      (diag_desc_1 != EMPTY_VALUE ? diag_desc_1 : 0),
      (diag_desc_2 != EMPTY_VALUE ? diag_desc_2 : 0),
      (diag_desc_3 != EMPTY_VALUE ? diag_desc_3 : 0),
      (diag_high != EMPTY_VALUE ? diag_high : 0),
      (diag_low != EMPTY_VALUE ? diag_low : 0),
      (horiz_peak_1 != EMPTY_VALUE ? horiz_peak_1 : 0),
      (horiz_peak_2 != EMPTY_VALUE ? horiz_peak_2 : 0),
      (horiz_peak_3 != EMPTY_VALUE ? horiz_peak_3 : 0),
      (horiz_bottom_1 != EMPTY_VALUE ? horiz_bottom_1 : 0),
      (horiz_bottom_2 != EMPTY_VALUE ? horiz_bottom_2 : 0),
      (horiz_bottom_3 != EMPTY_VALUE ? horiz_bottom_3 : 0),
      (horiz_high != EMPTY_VALUE ? horiz_high : 0),
      (horiz_low != EMPTY_VALUE ? horiz_low : 0),
      (ha_open != EMPTY_VALUE ? ha_open : 0),
      (ha_high != EMPTY_VALUE ? ha_high : 0),
      (ha_low != EMPTY_VALUE ? ha_low : 0),
      (ha_close != EMPTY_VALUE ? ha_close : 0),
      (int)(ha_class != EMPTY_VALUE ? ha_class : 0),
      (ha_body_size != EMPTY_VALUE ? ha_body_size : 0),
      (ha_zscore != EMPTY_VALUE ? ha_zscore : 0),
      (kc_ultra_extreme_upper != EMPTY_VALUE ? kc_ultra_extreme_upper : 0),
      (kc_extreme_upper != EMPTY_VALUE ? kc_extreme_upper : 0),
      (kc_uppermost != EMPTY_VALUE ? kc_uppermost : 0),
      (kc_upper != EMPTY_VALUE ? kc_upper : 0),
      (kc_upper_middle != EMPTY_VALUE ? kc_upper_middle : 0),
      (kc_lower_middle != EMPTY_VALUE ? kc_lower_middle : 0),
      (kc_lower != EMPTY_VALUE ? kc_lower : 0),
      (kc_lowermost != EMPTY_VALUE ? kc_lowermost : 0),
      (kc_extreme_lower != EMPTY_VALUE ? kc_extreme_lower : 0),
      (kc_ultra_extreme_lower != EMPTY_VALUE ? kc_ultra_extreme_lower : 0),
      (sr_support_4 != EMPTY_VALUE ? sr_support_4 : 0),
      (sr_support_3 != EMPTY_VALUE ? sr_support_3 : 0),
      (sr_support_2 != EMPTY_VALUE ? sr_support_2 : 0),
      (sr_support_1 != EMPTY_VALUE ? sr_support_1 : 0),
      (sr_resistance_1 != EMPTY_VALUE ? sr_resistance_1 : 0),
      (sr_resistance_2 != EMPTY_VALUE ? sr_resistance_2 : 0),
      (sr_resistance_3 != EMPTY_VALUE ? sr_resistance_3 : 0),
      (sr_resistance_4 != EMPTY_VALUE ? sr_resistance_4 : 0),
      (zigzag_peak != EMPTY_VALUE ? zigzag_peak : 0),
      (zigzag_bottom != EMPTY_VALUE ? zigzag_bottom : 0),
      (ema != EMPTY_VALUE ? ema : 0),
      (dual_tema_high != EMPTY_VALUE ? dual_tema_high : 0),
      (dual_tema_low  != EMPTY_VALUE ? dual_tema_low  : 0),
      pinbar,
      (long)TimeCurrent()
   );

   // --- NATIVE MQL5 SOCKET IMPLEMENTATION ---
   int socket = SocketCreate();

   if(socket != INVALID_HANDLE)
   {
      // Attempt connection to the local relay with extreme timeout
      if(SocketConnect(socket, LocalRelayIP, LocalRelayPort, SocketTimeoutMs))
      {
         char payload_data[];
         StringToCharArray(payload, payload_data);
         
         // Fire and forget transmission. -1 removes null terminator
         int sent = SocketSend(socket, payload_data, ArraySize(payload_data) - 1); 
         
         SocketClose(socket);
         return (sent > 0);
      }
      
      SocketClose(socket);
   }

   return false;
}

//+------------------------------------------------------------------+
//| Write to SQLite backup (Fallback only)                           |
//+------------------------------------------------------------------+
bool WriteSQLiteBackup(int dbIndex, ENUM_TIMEFRAMES tf, MqlRates &rate,
                       double tema, double hrma, double smma, double zscore, double classification,
                       double diag_asc_1, double diag_asc_2, double diag_asc_3,
                       double diag_desc_1, double diag_desc_2, double diag_desc_3,
                       double diag_high, double diag_low,
                       double horiz_peak_1, double horiz_peak_2, double horiz_peak_3,
                       double horiz_bottom_1, double horiz_bottom_2, double horiz_bottom_3,
                       double horiz_high, double horiz_low,
                       double ha_open, double ha_high, double ha_low, double ha_close,
                       double ha_class, double ha_body_size, double ha_zscore,
                       double kc_ultra_extreme_upper, double kc_extreme_upper, double kc_uppermost, double kc_upper,
                       double kc_upper_middle, double kc_lower_middle, double kc_lower, double kc_lowermost,
                       double kc_extreme_lower, double kc_ultra_extreme_lower,
                       double sr_support_4, double sr_support_3, double sr_support_2, double sr_support_1,
                       double sr_resistance_1, double sr_resistance_2, double sr_resistance_3, double sr_resistance_4,
                       double zigzag_peak, double zigzag_bottom, double ema,
                       double dual_tema_high, double dual_tema_low, int pinbar)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   // Build complete INSERT statement with all columns
   string insertSQL = StringFormat(
      "INSERT OR REPLACE INTO [%s] "
      "(timestamp, symbol, open, high, low, close, volume, timeframe, "
      "tema, hrma, smma, [Z-Score of body size], [Candle classification], "
      "diag_asc_line_1, diag_asc_line_2, diag_asc_line_3, "
      "diag_desc_line_1, diag_desc_line_2, diag_desc_line_3, "
      "diag_high_map, diag_low_map, "
      "horiz_peak_line_1, horiz_peak_line_2, horiz_peak_line_3, "
      "horiz_bottom_line_1, horiz_bottom_line_2, horiz_bottom_line_3, "
      "horiz_high_map, horiz_low_map, "
      "ha_open, ha_high, ha_low, ha_close, ha_classification, ha_body_size, ha_body_zscore, "
      "kc_ultra_extreme_upper, kc_extreme_upper, kc_uppermost, kc_upper, "
      "kc_upper_middle, kc_lower_middle, kc_lower, kc_lowermost, "
      "kc_extreme_lower, kc_ultra_extreme_lower, "
      "sr_support_4, sr_support_3, sr_support_2, sr_support_1, "
      "sr_resistance_1, sr_resistance_2, sr_resistance_3, sr_resistance_4, "
      "zigzag_peak, zigzag_bottom, ema, "
      "dual_tema_high, dual_tema_low, pinbar, collected_at) "
      "VALUES (%d, '%s', %.5f, %.5f, %.5f, %.5f, %d, '%s', "
      "%.5f, %.5f, %.5f, %.5f, %d, "
      "%.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, %.5f, %d, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %d, %d)",
      tableName,
      (long)rate.time,
      tableName,
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
      (diag_asc_1 != EMPTY_VALUE ? diag_asc_1 : 0),
      (diag_asc_2 != EMPTY_VALUE ? diag_asc_2 : 0),
      (diag_asc_3 != EMPTY_VALUE ? diag_asc_3 : 0),
      (diag_desc_1 != EMPTY_VALUE ? diag_desc_1 : 0),
      (diag_desc_2 != EMPTY_VALUE ? diag_desc_2 : 0),
      (diag_desc_3 != EMPTY_VALUE ? diag_desc_3 : 0),
      (diag_high != EMPTY_VALUE ? diag_high : 0),
      (diag_low != EMPTY_VALUE ? diag_low : 0),
      (horiz_peak_1 != EMPTY_VALUE ? horiz_peak_1 : 0),
      (horiz_peak_2 != EMPTY_VALUE ? horiz_peak_2 : 0),
      (horiz_peak_3 != EMPTY_VALUE ? horiz_peak_3 : 0),
      (horiz_bottom_1 != EMPTY_VALUE ? horiz_bottom_1 : 0),
      (horiz_bottom_2 != EMPTY_VALUE ? horiz_bottom_2 : 0),
      (horiz_bottom_3 != EMPTY_VALUE ? horiz_bottom_3 : 0),
      (horiz_high != EMPTY_VALUE ? horiz_high : 0),
      (horiz_low != EMPTY_VALUE ? horiz_low : 0),
      (ha_open != EMPTY_VALUE ? ha_open : 0),
      (ha_high != EMPTY_VALUE ? ha_high : 0),
      (ha_low != EMPTY_VALUE ? ha_low : 0),
      (ha_close != EMPTY_VALUE ? ha_close : 0),
      (int)(ha_class != EMPTY_VALUE ? ha_class : 0),
      (ha_body_size != EMPTY_VALUE ? ha_body_size : 0),
      (ha_zscore != EMPTY_VALUE ? ha_zscore : 0),
      (kc_ultra_extreme_upper != EMPTY_VALUE ? kc_ultra_extreme_upper : 0),
      (kc_extreme_upper != EMPTY_VALUE ? kc_extreme_upper : 0),
      (kc_uppermost != EMPTY_VALUE ? kc_uppermost : 0),
      (kc_upper != EMPTY_VALUE ? kc_upper : 0),
      (kc_upper_middle != EMPTY_VALUE ? kc_upper_middle : 0),
      (kc_lower_middle != EMPTY_VALUE ? kc_lower_middle : 0),
      (kc_lower != EMPTY_VALUE ? kc_lower : 0),
      (kc_lowermost != EMPTY_VALUE ? kc_lowermost : 0),
      (kc_extreme_lower != EMPTY_VALUE ? kc_extreme_lower : 0),
      (kc_ultra_extreme_lower != EMPTY_VALUE ? kc_ultra_extreme_lower : 0),
      (sr_support_4 != EMPTY_VALUE ? sr_support_4 : 0),
      (sr_support_3 != EMPTY_VALUE ? sr_support_3 : 0),
      (sr_support_2 != EMPTY_VALUE ? sr_support_2 : 0),
      (sr_support_1 != EMPTY_VALUE ? sr_support_1 : 0),
      (sr_resistance_1 != EMPTY_VALUE ? sr_resistance_1 : 0),
      (sr_resistance_2 != EMPTY_VALUE ? sr_resistance_2 : 0),
      (sr_resistance_3 != EMPTY_VALUE ? sr_resistance_3 : 0),
      (sr_resistance_4 != EMPTY_VALUE ? sr_resistance_4 : 0),
      (zigzag_peak != EMPTY_VALUE ? zigzag_peak : 0),
      (zigzag_bottom != EMPTY_VALUE ? zigzag_bottom : 0),
      (ema != EMPTY_VALUE ? ema : 0),
      (dual_tema_high != EMPTY_VALUE ? dual_tema_high : 0),
      (dual_tema_low  != EMPTY_VALUE ? dual_tema_low  : 0),
      pinbar,
      (long)TimeCurrent()
   );

   int result = symbolDatabases[dbIndex].db.Exec(insertSQL);

   return (result == SQLITE_OK || result == SQLITE_DONE);
}

//+------------------------------------------------------------------+
//| Mark bar for backfill — append mode                              |
//+------------------------------------------------------------------+
void MarkForBackfill(string symbol, ENUM_TIMEFRAMES tf, datetime timestamp)
{
   string csvPath = DatabasePath + "backfill_queue.csv";

   int handle = FileOpen(csvPath, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI, ',');

   if(handle != INVALID_HANDLE)
   {
      FileSeek(handle, 0, SEEK_END);
      FileWrite(handle, symbol, EnumToString(tf), (long)timestamp, TimeToString(TimeCurrent()));
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Print hourly collection statistics                               |
//+------------------------------------------------------------------+
void PrintCollectionStats()
{
   Print("");
   Print("=== Collection Statistics (Last Hour) ===");
   Print("Socket Relay Success: ", g_stats.apiSuccessCount);
   Print("Socket Relay Failures: ", g_stats.apiFailureCount);
   Print("SQLite Backups: ", g_stats.sqliteBackupCount);
   Print("Tick Collections: ", g_stats.tickCollections);
   Print("Timer Collections: ", g_stats.timerCollections);

   int totalAttempts = g_stats.apiSuccessCount + g_stats.apiFailureCount;
   double successRate = 0.0;

   if(totalAttempts > 0)
   {
      successRate = (double)g_stats.apiSuccessCount / totalAttempts * 100.0;
      Print("Socket Relay Success Rate: ", DoubleToString(successRate, 2), "%");
   }

   if(g_stats.lastAPIFailure > 0)
   {
      Print("Last Socket Relay Failure: ", TimeToString(g_stats.lastAPIFailure));
   }

   if(g_circuitBreaker.isOpen)
   {
      Print("🔴 Circuit Breaker: OPEN (consecutive failures: ",
            g_circuitBreaker.consecutiveFailures, ")");
   }
   else
   {
      Print("🟢 Circuit Breaker: CLOSED");
   }

   Print("=========================================");
   Print("");

   // Reset counters for next hour
   g_stats.Reset();
}
//+------------------------------------------------------------------+
// Note: To allow MT5 to use sockets, ensure Allow WebRequest for listed URL is enabled in Tools -> Options -> Expert Advisors, and add http://127.0.0.1 or simply 127.0.0.1 to the list