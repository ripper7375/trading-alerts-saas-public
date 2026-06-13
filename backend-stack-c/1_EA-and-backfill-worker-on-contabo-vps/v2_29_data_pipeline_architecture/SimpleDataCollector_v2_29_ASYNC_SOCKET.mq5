//+------------------------------------------------------------------+
//|                          SimpleDataCollector_v2.29_ASYNC_SOCKET.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.29"
#property strict

// Version 2.29 Changelog (from v2.28):
// - ROLE IN v6 PIPELINE: the validated export-file pipeline (see
//   DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md §12) is the source of truth for
//   XAUUSD M5/M15. This EA's socket-push path is NOT part of that data flow; the
//   EA's production job is keeping the charts/indicators alive. The socket/SQLite
//   machinery below remains functional for any future return to the push path.
// - Indicator references renamed to the *_v2_29 compiled names.
// - INDICATOR SET REPLACED: the 12 legacy indicators (TEMA, HRMA, SMMA, Z-Score,
//   Fractal Diagonal/Horizontal, Heiken Ashi, Keltner, Sup/Res, ZigZag v28,
//   Dual TEMA, Pinbar) are replaced by the new export-selection set in
//   mql5-indicators/mql5-indicator-export-selection/USE/mq5:
//     1. 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent
//     2. 2EDT-Centroid-Regression-Cherry-Pick-A
//     3. 2EDT-Centroid-Regression-Cherry-Pick-B
//     4. 2EDT-Centroid-Regression-Most-Recent-Line-Extension
//     5. 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-A
//     6. 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-B
//     7. 2EDT-Fractal-Best-Fit-v5
//     8. Single-Best-Resistance-Line-v3
//     9. Single-Best-Support-Line-v3
//    10. ZigZag-Export-v43
//    11. ohlcv-export-lightweight   (no buffers - OHLCV is collected natively via CopyRates)
//    12. zscore-ohlc-candle-export
// - SCHEMA UPDATE (45 columns): SSA trend/signal/cross, fractal 108/119 markers,
//   6x centroid-regression (baseline/UOEDT/LOEDT), fractal best-fit lines,
//   single best resistance/support, zigzag peak/bottom/class, candle body z-score set.
// - SSA trend/signal/cross and fractal 108/119 markers are read once from the
//   Best-Fit variant handle (all 6 centroid variants compute them identically
//   from the same shared SSA / fractal default settings).
// - Relay JSON payload and SQLite fallback schema updated to match. The relay
//   gateway and backfill worker must be migrated to the new column set.
//
// Version 2.28-ASYNC-SOCKET (preserved architecture):
// - ARCHITECTURE SHIFT: Replaced synchronous blocking WebRequest with native MQL5 TCP Sockets.
// - PERFORMANCE: Achieves < 1ms execution time to prevent MT5 UI thread freezing.
// - Payloads are sent to a Local TCP Relay (e.g., Python background worker) on 127.0.0.1.
// - SocketTimeoutMs default 50ms (avoids spurious circuit-breaker trips under VPS load)
// - SocketSend requires the FULL payload to be written (partial send counted as failure)
// - MarkForBackfill opens backfill_queue.csv with FILE_SHARE_READ (no lost rows while worker reads it)

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
input uint   SocketTimeoutMs = 50;                 // Max blocking time per socket connection (50ms tolerates OS scheduler jitter; 5ms caused spurious circuit-breaker trips)
input string TerminalID = "terminal_001";          // Terminal identifier (terminal_001 to terminal_015)

input int MaxBarsPerTimeframe = 10000;             // Max bars per timeframe per symbol
input bool EnableCircularBuffer = true;            // Replace oldest bars when limit reached

// Timer & circuit breaker settings
input int DataCollectionIntervalSec = 300;         // Data collection interval in seconds (300 = 5 min)
input int CircuitBreakerThreshold = 10;            // Consecutive Socket failures before circuit opens
input int CircuitBreakerCooldownSec = 300;         // Seconds to wait before retrying Socket after circuit opens

// --- Centroid Regression: shared SSA engine settings (all 6 variants) ---
input int InpSSAMathLookback = 3000;               // SSA Math Engine Lookback (bars)
input int InpSSAWindow       = 30;                 // SSA Window
input int InpSSARank         = 6;                  // SSA Rank
input int InpSSASignalPeriod = 3;                  // SSA Signal Period

// --- 2EDT Fractal Best Fit v5: fixed window anchors ---
input datetime InpFBF_StartDateTime = D'2026.06.04 14:20'; // Fractal Best Fit window start
input datetime InpFBF_EndDateTime   = D'2026.06.08 07:45'; // Fractal Best Fit window end

// --- Single Best Resistance/Support Line v3: window period ---
input datetime InpSBL_StartDateTime = D'2026.06.05 19:15'; // Best line window start
input datetime InpSBL_EndDateTime   = D'2026.06.08 05:00'; // Best line window end
input bool     InpSBL_ExtendToCurrent = true;              // Extend best line to current bar

// --- ZigZag Export v43 ---
input int InpZZ_Depth     = 12;                    // ZigZag Depth (minimum value: 2)
input int InpZZ_Deviation = 5;                     // ZigZag Deviation (in points)
input int InpZZ_Backstep  = 3;                     // ZigZag Back Step (minimum value: 1)

// --- Z-Score OHLC Candle Export ---
input int    InpZScoreLength = 432;                // Z-Score MA Length
input double InpThresholdZ1  = 1.5;                // First threshold (Large)
input double InpThresholdZ2  = 2.5;                // Second threshold (Extreme)
input int    InpCandleWidth  = 3;                  // Candle Width (1-5)

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
// All 6 centroid-regression variants share the same buffer layout:
//   0=SSA Trend, 1=SSA Signal, 2=SSA Cross, 3=Upper108, 4=Lower108,
//   5=Upper119, 6=Lower119, 7=BaseLine, 8=UOEDT, 9=LOEDT
struct TimeframeIndicators
{
   int h_cr_bestfit;        // 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent
   int h_cr_cherry_a;       // 2EDT-Centroid-Regression-Cherry-Pick-A
   int h_cr_cherry_b;       // 2EDT-Centroid-Regression-Cherry-Pick-B
   int h_cr_mostrecent;     // 2EDT-Centroid-Regression-Most-Recent-Line-Extension
   int h_cr_nonrecent_a;    // 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-A
   int h_cr_nonrecent_b;    // 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-B
   int h_fractal_bestfit;   // 2EDT-Fractal-Best-Fit-v5 (4=BestFL, 5=UOEDT, 6=LOEDT)
   int h_best_resistance;   // Single-Best-Resistance-Line-v3 (buffer 2 = ExtBestFL)
   int h_best_support;      // Single-Best-Support-Line-v3 (buffer 2 = ExtBestFL)
   int h_zigzag;            // ZigZag-Export-v43 (0=peak, 1=bottom, 2=color class)
   int h_zscore_candle;     // zscore-ohlc-candle-export (4=class, 5=body size, 6=z-score)
   // ohlcv-export-lightweight has no indicator buffers; OHLCV comes from CopyRates
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
   Print("SimpleDataCollector v2.29-ASYNC-SOCKET");
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
   // Note: the 6 centroid-regression variants run an SSA engine over
   // InpSSAMathLookback bars per symbol/timeframe slot - this is CPU-heavy.
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
      if(tfIndicators[i].h_cr_bestfit != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_bestfit);
      if(tfIndicators[i].h_cr_cherry_a != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_cherry_a);
      if(tfIndicators[i].h_cr_cherry_b != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_cherry_b);
      if(tfIndicators[i].h_cr_mostrecent != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_mostrecent);
      if(tfIndicators[i].h_cr_nonrecent_a != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_nonrecent_a);
      if(tfIndicators[i].h_cr_nonrecent_b != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_nonrecent_b);
      if(tfIndicators[i].h_fractal_bestfit != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_fractal_bestfit);
      if(tfIndicators[i].h_best_resistance != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_best_resistance);
      if(tfIndicators[i].h_best_support != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_best_support);
      if(tfIndicators[i].h_zigzag != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_zigzag);
      if(tfIndicators[i].h_zscore_candle != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_zscore_candle);
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
//| iCustom calls pass only the leading parameters that the EA       |
//| controls; all remaining indicator inputs use their defaults.     |
//+------------------------------------------------------------------+
bool InitializeIndicatorsForSlot(int slotIndex, string sym, ENUM_TIMEFRAMES tf)
{
   // 1. Centroid Regression — Best Fit (Non-Most-Recent)
   //    Also supplies the shared SSA trend/signal/cross and fractal 108/119 markers
   tfIndicators[slotIndex].h_cr_bestfit = iCustom(
      sym, tf, "2EDTCentroidRegressionBestFitNonMostRecent_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_bestfit == INVALID_HANDLE) return false;

   // 2. Centroid Regression — Cherry Pick A
   tfIndicators[slotIndex].h_cr_cherry_a = iCustom(
      sym, tf, "2EDTCentroidRegressionCherryPickA_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_cherry_a == INVALID_HANDLE) return false;

   // 3. Centroid Regression — Cherry Pick B
   tfIndicators[slotIndex].h_cr_cherry_b = iCustom(
      sym, tf, "2EDTCentroidRegressionCherryPickB_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_cherry_b == INVALID_HANDLE) return false;

   // 4. Centroid Regression — Most Recent Line Extension
   tfIndicators[slotIndex].h_cr_mostrecent = iCustom(
      sym, tf, "2EDTCentroidRegressionMostRecentLineExtension_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_mostrecent == INVALID_HANDLE) return false;

   // 5. Centroid Regression — Non-Most-Recent Line Extension A
   tfIndicators[slotIndex].h_cr_nonrecent_a = iCustom(
      sym, tf, "2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_nonrecent_a == INVALID_HANDLE) return false;

   // 6. Centroid Regression — Non-Most-Recent Line Extension B
   tfIndicators[slotIndex].h_cr_nonrecent_b = iCustom(
      sym, tf, "2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_nonrecent_b == INVALID_HANDLE) return false;

   // 7. 2EDT Fractal Best Fit v5 (fixed window anchors)
   tfIndicators[slotIndex].h_fractal_bestfit = iCustom(
      sym, tf, "2EDTFractalBestFitv5_v2_29",
      "===== Window Period (Fixed Anchors) =====",
      InpFBF_StartDateTime, InpFBF_EndDateTime
   );
   if(tfIndicators[slotIndex].h_fractal_bestfit == INVALID_HANDLE) return false;

   // 8. Single Best Resistance Line v3
   tfIndicators[slotIndex].h_best_resistance = iCustom(
      sym, tf, "SingleBestResistanceLinev3_v2_29",
      "===== Window Period =====",
      InpSBL_StartDateTime, InpSBL_EndDateTime,
      "===== Line Extension =====",
      InpSBL_ExtendToCurrent
   );
   if(tfIndicators[slotIndex].h_best_resistance == INVALID_HANDLE) return false;

   // 9. Single Best Support Line v3
   tfIndicators[slotIndex].h_best_support = iCustom(
      sym, tf, "SingleBestSupportLinev3_v2_29",
      "===== Window Period =====",
      InpSBL_StartDateTime, InpSBL_EndDateTime,
      "===== Line Extension =====",
      InpSBL_ExtendToCurrent
   );
   if(tfIndicators[slotIndex].h_best_support == INVALID_HANDLE) return false;

   // 10. ZigZag Export v43
   tfIndicators[slotIndex].h_zigzag = iCustom(
      sym, tf, "ZigZagExportv43_v2_29",
      InpZZ_Depth, InpZZ_Deviation, InpZZ_Backstep
   );
   if(tfIndicators[slotIndex].h_zigzag == INVALID_HANDLE) return false;

   // 11. Z-Score OHLC Candle Export
   tfIndicators[slotIndex].h_zscore_candle = iCustom(
      sym, tf, "zscoreohlccandleexport_v2_29",
      InpZScoreLength, InpThresholdZ1, InpThresholdZ2, InpCandleWidth
   );
   if(tfIndicators[slotIndex].h_zscore_candle == INVALID_HANDLE) return false;

   // 12. ohlcv-export-lightweight: no indicator buffers (indicator_plots 0).
   //     OHLCV is already collected natively via CopyRates, so no handle is created.

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

      // Migrate existing databases to add v2.29 columns if missing
      MigrateSymbolTable(i);

      Print("✓ Database ready: ", symbolDatabases[i].sanitizedName, ".db");
   }

   return true;
}

//+------------------------------------------------------------------+
//| Create table for symbol (v2.29 schema, 45 columns)               |
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
      "ssa_trend REAL, "
      "ssa_signal REAL, "
      "ssa_cross INTEGER, "
      "fractal_upper_108 REAL, "
      "fractal_lower_108 REAL, "
      "fractal_upper_119 REAL, "
      "fractal_lower_119 REAL, "
      "bestfit_baseline REAL, "
      "bestfit_uoedt REAL, "
      "bestfit_loedt REAL, "
      "cherry_a_baseline REAL, "
      "cherry_a_uoedt REAL, "
      "cherry_a_loedt REAL, "
      "cherry_b_baseline REAL, "
      "cherry_b_uoedt REAL, "
      "cherry_b_loedt REAL, "
      "mostrecent_baseline REAL, "
      "mostrecent_uoedt REAL, "
      "mostrecent_loedt REAL, "
      "nonrecent_a_baseline REAL, "
      "nonrecent_a_uoedt REAL, "
      "nonrecent_a_loedt REAL, "
      "nonrecent_b_baseline REAL, "
      "nonrecent_b_uoedt REAL, "
      "nonrecent_b_loedt REAL, "
      "fbf_best_fl REAL, "
      "fbf_uoedt REAL, "
      "fbf_loedt REAL, "
      "best_resistance REAL, "
      "best_support REAL, "
      "zigzag_peak REAL, "
      "zigzag_bottom REAL, "
      "zigzag_class INTEGER, "
      "body_size REAL, "
      "body_zscore REAL, "
      "candle_classification INTEGER, "
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
//| Migrate existing table to add v2.29 columns if missing           |
//| (ALTER TABLE fails silently when a column already exists)        |
//+------------------------------------------------------------------+
void MigrateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string newColumns[] = {
      "ssa_trend REAL", "ssa_signal REAL", "ssa_cross INTEGER",
      "fractal_upper_108 REAL", "fractal_lower_108 REAL",
      "fractal_upper_119 REAL", "fractal_lower_119 REAL",
      "bestfit_baseline REAL", "bestfit_uoedt REAL", "bestfit_loedt REAL",
      "cherry_a_baseline REAL", "cherry_a_uoedt REAL", "cherry_a_loedt REAL",
      "cherry_b_baseline REAL", "cherry_b_uoedt REAL", "cherry_b_loedt REAL",
      "mostrecent_baseline REAL", "mostrecent_uoedt REAL", "mostrecent_loedt REAL",
      "nonrecent_a_baseline REAL", "nonrecent_a_uoedt REAL", "nonrecent_a_loedt REAL",
      "nonrecent_b_baseline REAL", "nonrecent_b_uoedt REAL", "nonrecent_b_loedt REAL",
      "fbf_best_fl REAL", "fbf_uoedt REAL", "fbf_loedt REAL",
      "best_resistance REAL", "best_support REAL",
      "zigzag_peak REAL", "zigzag_bottom REAL", "zigzag_class INTEGER",
      "body_size REAL", "body_zscore REAL", "candle_classification INTEGER"
   };

   for(int i = 0; i < ArraySize(newColumns); i++)
   {
      string alterSQL = StringFormat(
         "ALTER TABLE [%s] ADD COLUMN %s", tableName, newColumns[i]
      );
      symbolDatabases[dbIndex].db.Exec(alterSQL);
   }

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

   // --- Shared SSA + fractal markers (identical in all 6 centroid variants;
   //     read once from the Best-Fit handle) ---
   double ssa_trend  = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 0, shift);
   double ssa_signal = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 1, shift);
   double ssa_cross_raw = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 2, shift);
   int ssa_cross = (ssa_cross_raw != EMPTY_VALUE && ssa_cross_raw != 0.0) ? 1 : 0;

   double fractal_upper_108 = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 3, shift);
   double fractal_lower_108 = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 4, shift);
   double fractal_upper_119 = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 5, shift);
   double fractal_lower_119 = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 6, shift);

   // --- Centroid regression variants: BaseLine(7), UOEDT(8), LOEDT(9) ---
   double bestfit_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 7, shift);
   double bestfit_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 8, shift);
   double bestfit_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_bestfit, 9, shift);

   double cherry_a_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_a, 7, shift);
   double cherry_a_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_a, 8, shift);
   double cherry_a_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_a, 9, shift);

   double cherry_b_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_b, 7, shift);
   double cherry_b_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_b, 8, shift);
   double cherry_b_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_cherry_b, 9, shift);

   double mostrecent_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_mostrecent, 7, shift);
   double mostrecent_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_mostrecent, 8, shift);
   double mostrecent_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_mostrecent, 9, shift);

   double nonrecent_a_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_a, 7, shift);
   double nonrecent_a_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_a, 8, shift);
   double nonrecent_a_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_a, 9, shift);

   double nonrecent_b_baseline = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_b, 7, shift);
   double nonrecent_b_uoedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_b, 8, shift);
   double nonrecent_b_loedt    = GetIndicatorValue(tfIndicators[slotIndex].h_cr_nonrecent_b, 9, shift);

   // --- 2EDT Fractal Best Fit v5: BestFL(4), UOEDT(5), LOEDT(6) ---
   double fbf_best_fl = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_bestfit, 4, shift);
   double fbf_uoedt   = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_bestfit, 5, shift);
   double fbf_loedt   = GetIndicatorValue(tfIndicators[slotIndex].h_fractal_bestfit, 6, shift);

   // --- Single Best Resistance/Support Line v3: ExtBestFL(2) ---
   double best_resistance = GetIndicatorValue(tfIndicators[slotIndex].h_best_resistance, 2, shift);
   double best_support    = GetIndicatorValue(tfIndicators[slotIndex].h_best_support, 2, shift);

   // --- ZigZag Export v43: peak(0), bottom(1), classification color index(2) ---
   double zigzag_peak   = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 0, shift);
   double zigzag_bottom = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 1, shift);
   double zz_class_raw  = GetIndicatorValue(tfIndicators[slotIndex].h_zigzag, 2, shift);
   int zigzag_class = (int)(zz_class_raw != EMPTY_VALUE ? zz_class_raw : 0);

   // --- Z-Score OHLC Candle: class(4), body size(5), z-score(6) ---
   double candle_class_raw = GetIndicatorValue(tfIndicators[slotIndex].h_zscore_candle, 4, shift);
   int candle_classification = (int)(candle_class_raw != EMPTY_VALUE ? candle_class_raw : 0);
   double body_size   = GetIndicatorValue(tfIndicators[slotIndex].h_zscore_candle, 5, shift);
   double body_zscore = GetIndicatorValue(tfIndicators[slotIndex].h_zscore_candle, 6, shift);

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
            ssa_trend, ssa_signal, ssa_cross,
            fractal_upper_108, fractal_lower_108, fractal_upper_119, fractal_lower_119,
            bestfit_baseline, bestfit_uoedt, bestfit_loedt,
            cherry_a_baseline, cherry_a_uoedt, cherry_a_loedt,
            cherry_b_baseline, cherry_b_uoedt, cherry_b_loedt,
            mostrecent_baseline, mostrecent_uoedt, mostrecent_loedt,
            nonrecent_a_baseline, nonrecent_a_uoedt, nonrecent_a_loedt,
            nonrecent_b_baseline, nonrecent_b_uoedt, nonrecent_b_loedt,
            fbf_best_fl, fbf_uoedt, fbf_loedt,
            best_resistance, best_support,
            zigzag_peak, zigzag_bottom, zigzag_class,
            body_size, body_zscore, candle_classification
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
      ssa_trend, ssa_signal, ssa_cross,
      fractal_upper_108, fractal_lower_108, fractal_upper_119, fractal_lower_119,
      bestfit_baseline, bestfit_uoedt, bestfit_loedt,
      cherry_a_baseline, cherry_a_uoedt, cherry_a_loedt,
      cherry_b_baseline, cherry_b_uoedt, cherry_b_loedt,
      mostrecent_baseline, mostrecent_uoedt, mostrecent_loedt,
      nonrecent_a_baseline, nonrecent_a_uoedt, nonrecent_a_loedt,
      nonrecent_b_baseline, nonrecent_b_uoedt, nonrecent_b_loedt,
      fbf_best_fl, fbf_uoedt, fbf_loedt,
      best_resistance, best_support,
      zigzag_peak, zigzag_bottom, zigzag_class,
      body_size, body_zscore, candle_classification
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
//| Publish to Async TCP Socket Relay (v2.29 schema)                 |
//+------------------------------------------------------------------+
bool PublishToLocalRelay(string symbol, ENUM_TIMEFRAMES tf, MqlRates &rate,
                        double ssa_trend, double ssa_signal, int ssa_cross,
                        double fractal_upper_108, double fractal_lower_108,
                        double fractal_upper_119, double fractal_lower_119,
                        double bestfit_baseline, double bestfit_uoedt, double bestfit_loedt,
                        double cherry_a_baseline, double cherry_a_uoedt, double cherry_a_loedt,
                        double cherry_b_baseline, double cherry_b_uoedt, double cherry_b_loedt,
                        double mostrecent_baseline, double mostrecent_uoedt, double mostrecent_loedt,
                        double nonrecent_a_baseline, double nonrecent_a_uoedt, double nonrecent_a_loedt,
                        double nonrecent_b_baseline, double nonrecent_b_uoedt, double nonrecent_b_loedt,
                        double fbf_best_fl, double fbf_uoedt, double fbf_loedt,
                        double best_resistance, double best_support,
                        double zigzag_peak, double zigzag_bottom, int zigzag_class,
                        double body_size, double body_zscore, int candle_classification)
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
      "\"ssa_trend\":%.5f,"
      "\"ssa_signal\":%.5f,"
      "\"ssa_cross\":%d,"
      "\"fractal_upper_108\":%.5f,"
      "\"fractal_lower_108\":%.5f,"
      "\"fractal_upper_119\":%.5f,"
      "\"fractal_lower_119\":%.5f,"
      "\"bestfit_baseline\":%.5f,"
      "\"bestfit_uoedt\":%.5f,"
      "\"bestfit_loedt\":%.5f,"
      "\"cherry_a_baseline\":%.5f,"
      "\"cherry_a_uoedt\":%.5f,"
      "\"cherry_a_loedt\":%.5f,"
      "\"cherry_b_baseline\":%.5f,"
      "\"cherry_b_uoedt\":%.5f,"
      "\"cherry_b_loedt\":%.5f,"
      "\"mostrecent_baseline\":%.5f,"
      "\"mostrecent_uoedt\":%.5f,"
      "\"mostrecent_loedt\":%.5f,"
      "\"nonrecent_a_baseline\":%.5f,"
      "\"nonrecent_a_uoedt\":%.5f,"
      "\"nonrecent_a_loedt\":%.5f,"
      "\"nonrecent_b_baseline\":%.5f,"
      "\"nonrecent_b_uoedt\":%.5f,"
      "\"nonrecent_b_loedt\":%.5f,"
      "\"fbf_best_fl\":%.5f,"
      "\"fbf_uoedt\":%.5f,"
      "\"fbf_loedt\":%.5f,"
      "\"best_resistance\":%.5f,"
      "\"best_support\":%.5f,"
      "\"zigzag_peak\":%.5f,"
      "\"zigzag_bottom\":%.5f,"
      "\"zigzag_class\":%d,"
      "\"body_size\":%.5f,"
      "\"body_zscore\":%.5f,"
      "\"candle_classification\":%d,"
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
      (ssa_trend != EMPTY_VALUE ? ssa_trend : 0),
      (ssa_signal != EMPTY_VALUE ? ssa_signal : 0),
      ssa_cross,
      (fractal_upper_108 != EMPTY_VALUE ? fractal_upper_108 : 0),
      (fractal_lower_108 != EMPTY_VALUE ? fractal_lower_108 : 0),
      (fractal_upper_119 != EMPTY_VALUE ? fractal_upper_119 : 0),
      (fractal_lower_119 != EMPTY_VALUE ? fractal_lower_119 : 0),
      (bestfit_baseline != EMPTY_VALUE ? bestfit_baseline : 0),
      (bestfit_uoedt != EMPTY_VALUE ? bestfit_uoedt : 0),
      (bestfit_loedt != EMPTY_VALUE ? bestfit_loedt : 0),
      (cherry_a_baseline != EMPTY_VALUE ? cherry_a_baseline : 0),
      (cherry_a_uoedt != EMPTY_VALUE ? cherry_a_uoedt : 0),
      (cherry_a_loedt != EMPTY_VALUE ? cherry_a_loedt : 0),
      (cherry_b_baseline != EMPTY_VALUE ? cherry_b_baseline : 0),
      (cherry_b_uoedt != EMPTY_VALUE ? cherry_b_uoedt : 0),
      (cherry_b_loedt != EMPTY_VALUE ? cherry_b_loedt : 0),
      (mostrecent_baseline != EMPTY_VALUE ? mostrecent_baseline : 0),
      (mostrecent_uoedt != EMPTY_VALUE ? mostrecent_uoedt : 0),
      (mostrecent_loedt != EMPTY_VALUE ? mostrecent_loedt : 0),
      (nonrecent_a_baseline != EMPTY_VALUE ? nonrecent_a_baseline : 0),
      (nonrecent_a_uoedt != EMPTY_VALUE ? nonrecent_a_uoedt : 0),
      (nonrecent_a_loedt != EMPTY_VALUE ? nonrecent_a_loedt : 0),
      (nonrecent_b_baseline != EMPTY_VALUE ? nonrecent_b_baseline : 0),
      (nonrecent_b_uoedt != EMPTY_VALUE ? nonrecent_b_uoedt : 0),
      (nonrecent_b_loedt != EMPTY_VALUE ? nonrecent_b_loedt : 0),
      (fbf_best_fl != EMPTY_VALUE ? fbf_best_fl : 0),
      (fbf_uoedt != EMPTY_VALUE ? fbf_uoedt : 0),
      (fbf_loedt != EMPTY_VALUE ? fbf_loedt : 0),
      (best_resistance != EMPTY_VALUE ? best_resistance : 0),
      (best_support != EMPTY_VALUE ? best_support : 0),
      (zigzag_peak != EMPTY_VALUE ? zigzag_peak : 0),
      (zigzag_bottom != EMPTY_VALUE ? zigzag_bottom : 0),
      zigzag_class,
      (body_size != EMPTY_VALUE ? body_size : 0),
      (body_zscore != EMPTY_VALUE ? body_zscore : 0),
      candle_classification,
      (long)TimeCurrent()
   );

   // --- NATIVE MQL5 SOCKET IMPLEMENTATION ---
   int socket = SocketCreate();

   if(socket != INVALID_HANDLE)
   {
      // Attempt connection to the local relay with extreme timeout
      if(SocketConnect(socket, LocalRelayIP, LocalRelayPort, SocketTimeoutMs))
      {
         uchar payload_data[];
         StringToCharArray(payload, payload_data);

         // Fire and forget transmission. -1 removes null terminator
         int bytesToSend = ArraySize(payload_data) - 1;
         int sent = SocketSend(socket, payload_data, bytesToSend);

         SocketClose(socket);
         // Partial send = truncated JSON at the relay, so require all bytes written
         return (sent == bytesToSend);
      }

      SocketClose(socket);
   }

   return false;
}

//+------------------------------------------------------------------+
//| Write to SQLite backup (Fallback only)                           |
//+------------------------------------------------------------------+
bool WriteSQLiteBackup(int dbIndex, ENUM_TIMEFRAMES tf, MqlRates &rate,
                       double ssa_trend, double ssa_signal, int ssa_cross,
                       double fractal_upper_108, double fractal_lower_108,
                       double fractal_upper_119, double fractal_lower_119,
                       double bestfit_baseline, double bestfit_uoedt, double bestfit_loedt,
                       double cherry_a_baseline, double cherry_a_uoedt, double cherry_a_loedt,
                       double cherry_b_baseline, double cherry_b_uoedt, double cherry_b_loedt,
                       double mostrecent_baseline, double mostrecent_uoedt, double mostrecent_loedt,
                       double nonrecent_a_baseline, double nonrecent_a_uoedt, double nonrecent_a_loedt,
                       double nonrecent_b_baseline, double nonrecent_b_uoedt, double nonrecent_b_loedt,
                       double fbf_best_fl, double fbf_uoedt, double fbf_loedt,
                       double best_resistance, double best_support,
                       double zigzag_peak, double zigzag_bottom, int zigzag_class,
                       double body_size, double body_zscore, int candle_classification)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   // Build complete INSERT statement with all columns
   string insertSQL = StringFormat(
      "INSERT OR REPLACE INTO [%s] "
      "(timestamp, symbol, open, high, low, close, volume, timeframe, "
      "ssa_trend, ssa_signal, ssa_cross, "
      "fractal_upper_108, fractal_lower_108, fractal_upper_119, fractal_lower_119, "
      "bestfit_baseline, bestfit_uoedt, bestfit_loedt, "
      "cherry_a_baseline, cherry_a_uoedt, cherry_a_loedt, "
      "cherry_b_baseline, cherry_b_uoedt, cherry_b_loedt, "
      "mostrecent_baseline, mostrecent_uoedt, mostrecent_loedt, "
      "nonrecent_a_baseline, nonrecent_a_uoedt, nonrecent_a_loedt, "
      "nonrecent_b_baseline, nonrecent_b_uoedt, nonrecent_b_loedt, "
      "fbf_best_fl, fbf_uoedt, fbf_loedt, "
      "best_resistance, best_support, "
      "zigzag_peak, zigzag_bottom, zigzag_class, "
      "body_size, body_zscore, candle_classification, collected_at) "
      "VALUES (%d, '%s', %.5f, %.5f, %.5f, %.5f, %d, '%s', "
      "%.5f, %.5f, %d, "
      "%.5f, %.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, %.5f, "
      "%.5f, %.5f, "
      "%.5f, %.5f, %d, "
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
      (ssa_trend != EMPTY_VALUE ? ssa_trend : 0),
      (ssa_signal != EMPTY_VALUE ? ssa_signal : 0),
      ssa_cross,
      (fractal_upper_108 != EMPTY_VALUE ? fractal_upper_108 : 0),
      (fractal_lower_108 != EMPTY_VALUE ? fractal_lower_108 : 0),
      (fractal_upper_119 != EMPTY_VALUE ? fractal_upper_119 : 0),
      (fractal_lower_119 != EMPTY_VALUE ? fractal_lower_119 : 0),
      (bestfit_baseline != EMPTY_VALUE ? bestfit_baseline : 0),
      (bestfit_uoedt != EMPTY_VALUE ? bestfit_uoedt : 0),
      (bestfit_loedt != EMPTY_VALUE ? bestfit_loedt : 0),
      (cherry_a_baseline != EMPTY_VALUE ? cherry_a_baseline : 0),
      (cherry_a_uoedt != EMPTY_VALUE ? cherry_a_uoedt : 0),
      (cherry_a_loedt != EMPTY_VALUE ? cherry_a_loedt : 0),
      (cherry_b_baseline != EMPTY_VALUE ? cherry_b_baseline : 0),
      (cherry_b_uoedt != EMPTY_VALUE ? cherry_b_uoedt : 0),
      (cherry_b_loedt != EMPTY_VALUE ? cherry_b_loedt : 0),
      (mostrecent_baseline != EMPTY_VALUE ? mostrecent_baseline : 0),
      (mostrecent_uoedt != EMPTY_VALUE ? mostrecent_uoedt : 0),
      (mostrecent_loedt != EMPTY_VALUE ? mostrecent_loedt : 0),
      (nonrecent_a_baseline != EMPTY_VALUE ? nonrecent_a_baseline : 0),
      (nonrecent_a_uoedt != EMPTY_VALUE ? nonrecent_a_uoedt : 0),
      (nonrecent_a_loedt != EMPTY_VALUE ? nonrecent_a_loedt : 0),
      (nonrecent_b_baseline != EMPTY_VALUE ? nonrecent_b_baseline : 0),
      (nonrecent_b_uoedt != EMPTY_VALUE ? nonrecent_b_uoedt : 0),
      (nonrecent_b_loedt != EMPTY_VALUE ? nonrecent_b_loedt : 0),
      (fbf_best_fl != EMPTY_VALUE ? fbf_best_fl : 0),
      (fbf_uoedt != EMPTY_VALUE ? fbf_uoedt : 0),
      (fbf_loedt != EMPTY_VALUE ? fbf_loedt : 0),
      (best_resistance != EMPTY_VALUE ? best_resistance : 0),
      (best_support != EMPTY_VALUE ? best_support : 0),
      (zigzag_peak != EMPTY_VALUE ? zigzag_peak : 0),
      (zigzag_bottom != EMPTY_VALUE ? zigzag_bottom : 0),
      zigzag_class,
      (body_size != EMPTY_VALUE ? body_size : 0),
      (body_zscore != EMPTY_VALUE ? body_zscore : 0),
      candle_classification,
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

   // FILE_SHARE_READ so the append still succeeds while the backfill worker reads the queue
   int handle = FileOpen(csvPath, FILE_READ|FILE_WRITE|FILE_SHARE_READ|FILE_CSV|FILE_ANSI, ',');

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
