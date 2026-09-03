//+------------------------------------------------------------------+
//|                          SimpleDataCollector_v2.29_ASYNC_SOCKET.mq5|
//|                                      Trading Alerts SaaS V7      |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "2.29.1"
#property strict

// Version 2.29.1 Changelog (from v2.29):
// - SCHEMA FIX: v2.29 below still read/stored the OLD v2.28 45-column schema
//   (bestfit_baseline/UOEDT/LOEDT etc., computed by MQL5). The CURRENT v6
//   architecture only has MQL5 own the "admin layer" per centroid variant
//   (horiz_high_map, horiz_low_map, ssa, ema_ssa, crossing); Python
//   (centroid_regression.py) computes base_fl/uoedt/loedt separately. This
//   file's SQLite schema, JSON payload, and buffer reads are now aligned with
//   gateway_contract_market_data.schema.json / sqlite_schema_v6_xauusd.sql
//   (87 market_data fields, since the 2026-09-03 best_fit_a/best_fit_b
//   split). Fields that require the Python calc stack
//   (centroid base_fl/uoedt/loedt, fractal/resistance/support lines, zigzag
//   segment metrics, z-score candle classification) are sent as NULL — never
//   fabricated from the old computed buffers. See InsertCandle() and the
//   CentroidFields helpers below for the corrected buffer map.
// - Still legacy/optional: this socket-push path is NOT wired into the v6
//   production data flow (see note below). This fix only makes it internally
//   consistent with the current schema in case it is ever revived.
//
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
//     1a. 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent-A (Primary Instance)
//     1b. 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent-B (Secondary Instance)
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
//   (13 indicators total since the 2026-09-03 best_fit_a/best_fit_b split —
//   items 1a/1b run in isolated coexistence on the same chart, each with its
//   own object namespace/export button, per the mq5 files themselves.)
// - SSA trend/signal/cross and fractal 108 markers are read once from the
//   Best-Fit-A variant handle (all 7 centroid variants compute them
//   identically from the same shared SSA / fractal default settings).
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

// --- Centroid Regression: shared SSA engine settings (all 7 variants) ---
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

// v6 admin-layer fields shared by all 7 centroid-regression variants.
// Buffer layout (identical across all 7 *_v2_29 centroid indicators):
//   0=SSA Trend(ssa), 1=SSA Signal(ema_ssa), 2=SSA Cross(crossing),
//   3=Upper108(horiz_high_map), 4=Lower108(horiz_low_map),
//   5=Upper119, 6=Lower119 (not part of the v6 admin-layer contract - unused),
//   7=BaseLine, 8=UOEDT, 9=LOEDT (OLD v2.28 MQL5-computed lines - Python owns
//   base_fl/uoedt/loedt in v6; never read here).
struct CentroidFields
{
   double horiz_high_map;
   double horiz_low_map;
   double ssa;
   double ema_ssa;
   int    crossing;        // always 0/1 (never null - "no crossing" is a real value)
};

// Timeframe indicators structure
// All 7 centroid-regression variants share the same buffer layout (see
// CentroidFields comment above).
struct TimeframeIndicators
{
   int h_cr_bestfit_a;      // 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent-A (Primary Instance)
   int h_cr_bestfit_b;      // 2EDT-Centroid-Regression-Best-Fit-Non-Most-Recent-B (Secondary Instance) - new 2026-09-03
   int h_cr_cherry_a;       // 2EDT-Centroid-Regression-Cherry-Pick-A
   int h_cr_cherry_b;       // 2EDT-Centroid-Regression-Cherry-Pick-B
   int h_cr_mostrecent;     // 2EDT-Centroid-Regression-Most-Recent-Line-Extension
   int h_cr_nonrecent_a;    // 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-A
   int h_cr_nonrecent_b;    // 2EDT-Centroid-Regression-Non-Most-Recent-Line-Extension-B
   int h_fractal_bestfit;   // 2EDT-Fractal-Best-Fit-v5 - buffers 4/5/6 (BestFL/UOEDT/LOEDT) are the
                             // OLD MQL5-computed lines; v6's fractal_best_fl/uoedt/loedt are Python-
                             // calculated (fractal_lines.py), so this handle's buffers are never read
                             // for market_data fields. Kept attached only so the indicator itself
                             // keeps computing/exporting on the chart.
   int h_best_resistance;   // Single-Best-Resistance-Line-v3 - buffer 2 (ExtBestFL) is the OLD
                             // MQL5-computed line; v6's best_resistance is Python-calculated. Same
                             // "kept attached, never read" rationale as h_fractal_bestfit.
   int h_best_support;      // Single-Best-Support-Line-v3 - same rationale as h_best_resistance.
   int h_zigzag;            // ZigZag-Export-v43 (0=peak price, 1=bottom price) - only the pivot
                             // type/price are admin-layer in v6 (zigzag_point_type/current_point).
                             // The 9 derived metrics (price/pct change, bars, slope, category, ...)
                             // are Python-calculated (zigzag_metrics.py) and never read here.
   int h_zscore_candle;     // zscore-ohlc-candle-export - v6's body_direction/body_size/
                             // body_classification are all Python-calculated (zscore_candle.py) from
                             // OHLC; this handle's buffers are never read for market_data fields.
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
   Print("SimpleDataCollector v2.29.1-ASYNC-SOCKET");
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
   // Note: the 7 centroid-regression variants run an SSA engine over
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
      if(tfIndicators[i].h_cr_bestfit_a != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_bestfit_a);
      if(tfIndicators[i].h_cr_bestfit_b != INVALID_HANDLE) IndicatorRelease(tfIndicators[i].h_cr_bestfit_b);
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
//| Detect broker-specific symbol name                                |
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
//| Convert an ENUM_TIMEFRAMES to the short string form used by the  |
//| gateway_contract_market_data.schema.json "timeframe" enum        |
//| (e.g. PERIOD_M5 -> "M5"), matching the *_v2_29 export indicators.|
//+------------------------------------------------------------------+
string TimeframeToShortString(ENUM_TIMEFRAMES tf)
{
   string s = EnumToString(tf);
   StringReplace(s, "PERIOD_", "");
   return s;
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
   // 1a. Centroid Regression — Best Fit (Non-Most-Recent) — Primary Instance A
   //     Also supplies the shared SSA trend/signal/cross and fractal 108 markers
   tfIndicators[slotIndex].h_cr_bestfit_a = iCustom(
      sym, tf, "2EDTCentroidRegressionBestFitNonMostRecentA_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_bestfit_a == INVALID_HANDLE) return false;

   // 1b. Centroid Regression — Best Fit (Non-Most-Recent) — Secondary Instance B
   //     New 2026-09-03 (isolated coexistence split of the former single
   //     best_fit indicator; exclude_recent_centroids=3 vs A's 0).
   tfIndicators[slotIndex].h_cr_bestfit_b = iCustom(
      sym, tf, "2EDTCentroidRegressionBestFitNonMostRecentB_v2_29",
      "===== Main & SSA Settings =====",
      InpSSAMathLookback, InpSSAWindow, InpSSARank, InpSSASignalPeriod
   );
   if(tfIndicators[slotIndex].h_cr_bestfit_b == INVALID_HANDLE) return false;

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

      // Migrate existing databases to add v6-aligned columns if missing
      MigrateSymbolTable(i);

      Print("✓ Database ready: ", symbolDatabases[i].sanitizedName, ".db");
   }

   return true;
}

//+------------------------------------------------------------------+
//| Create table for symbol.                                         |
//| Column set and names mirror gateway_contract_market_data.schema  |
//| .json 1:1 (87 fields) so a row here is schema-compatible with    |
//| market_data if this push path is ever reactivated. terminal_id   |
//| is added on top since the gateway contract requires it on POST   |
//| but the server-side market_data table does not persist it.       |
//+------------------------------------------------------------------+
bool CreateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string createTableSQL = StringFormat(
      "CREATE TABLE IF NOT EXISTS [%s] ("
      "timestamp INTEGER NOT NULL, "
      "symbol TEXT NOT NULL, "
      "timeframe TEXT NOT NULL, "
      "terminal_id TEXT, "
      "open REAL NOT NULL, "
      "high REAL NOT NULL, "
      "low REAL NOT NULL, "
      "close REAL NOT NULL, "
      "volume INTEGER NOT NULL, "
      "best_fit_a_horiz_high_map REAL, best_fit_a_horiz_low_map REAL, best_fit_a_ssa REAL, "
      "best_fit_a_ema_ssa REAL, best_fit_a_crossing INTEGER, "
      "best_fit_a_base_fl REAL, best_fit_a_uoedt REAL, best_fit_a_loedt REAL, "
      "best_fit_b_horiz_high_map REAL, best_fit_b_horiz_low_map REAL, best_fit_b_ssa REAL, "
      "best_fit_b_ema_ssa REAL, best_fit_b_crossing INTEGER, "
      "best_fit_b_base_fl REAL, best_fit_b_uoedt REAL, best_fit_b_loedt REAL, "
      "cherry_a_horiz_high_map REAL, cherry_a_horiz_low_map REAL, cherry_a_ssa REAL, "
      "cherry_a_ema_ssa REAL, cherry_a_crossing INTEGER, "
      "cherry_a_base_fl REAL, cherry_a_uoedt REAL, cherry_a_loedt REAL, "
      "cherry_b_horiz_high_map REAL, cherry_b_horiz_low_map REAL, cherry_b_ssa REAL, "
      "cherry_b_ema_ssa REAL, cherry_b_crossing INTEGER, "
      "cherry_b_base_fl REAL, cherry_b_uoedt REAL, cherry_b_loedt REAL, "
      "most_recent_horiz_high_map REAL, most_recent_horiz_low_map REAL, most_recent_ssa REAL, "
      "most_recent_ema_ssa REAL, most_recent_crossing INTEGER, "
      "most_recent_base_fl REAL, most_recent_uoedt REAL, most_recent_loedt REAL, "
      "non_a_horiz_high_map REAL, non_a_horiz_low_map REAL, non_a_ssa REAL, "
      "non_a_ema_ssa REAL, non_a_crossing INTEGER, "
      "non_a_base_fl REAL, non_a_uoedt REAL, non_a_loedt REAL, "
      "non_b_horiz_high_map REAL, non_b_horiz_low_map REAL, non_b_ssa REAL, "
      "non_b_ema_ssa REAL, non_b_crossing INTEGER, "
      "non_b_base_fl REAL, non_b_uoedt REAL, non_b_loedt REAL, "
      "fractal_best_fl REAL, fractal_uoedt REAL, fractal_loedt REAL, "
      "best_resistance REAL, best_support REAL, "
      "body_direction INTEGER, body_size REAL, body_classification INTEGER, "
      "zigzag_point_type TEXT, zigzag_current_point REAL, "
      "zigzag_price_change REAL, zigzag_pct_change REAL, zigzag_pct_change_class INTEGER, "
      "zigzag_bars INTEGER, zigzag_bars_class INTEGER, "
      "zigzag_price_per_bar REAL, zigzag_price_per_bar_class INTEGER, "
      "zigzag_slope REAL, zigzag_category TEXT, "
      "cycle_id INTEGER, collected_at INTEGER, calculated_at INTEGER, "
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
//| Migrate existing table to add v6-aligned columns if missing      |
//| (ALTER TABLE fails silently when a column already exists)        |
//+------------------------------------------------------------------+
void MigrateSymbolTable(int dbIndex)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string newColumns[] = {
      "terminal_id TEXT",
      "best_fit_a_horiz_high_map REAL", "best_fit_a_horiz_low_map REAL", "best_fit_a_ssa REAL",
      "best_fit_a_ema_ssa REAL", "best_fit_a_crossing INTEGER",
      "best_fit_a_base_fl REAL", "best_fit_a_uoedt REAL", "best_fit_a_loedt REAL",
      "best_fit_b_horiz_high_map REAL", "best_fit_b_horiz_low_map REAL", "best_fit_b_ssa REAL",
      "best_fit_b_ema_ssa REAL", "best_fit_b_crossing INTEGER",
      "best_fit_b_base_fl REAL", "best_fit_b_uoedt REAL", "best_fit_b_loedt REAL",
      "cherry_a_horiz_high_map REAL", "cherry_a_horiz_low_map REAL", "cherry_a_ssa REAL",
      "cherry_a_ema_ssa REAL", "cherry_a_crossing INTEGER",
      "cherry_a_base_fl REAL", "cherry_a_uoedt REAL", "cherry_a_loedt REAL",
      "cherry_b_horiz_high_map REAL", "cherry_b_horiz_low_map REAL", "cherry_b_ssa REAL",
      "cherry_b_ema_ssa REAL", "cherry_b_crossing INTEGER",
      "cherry_b_base_fl REAL", "cherry_b_uoedt REAL", "cherry_b_loedt REAL",
      "most_recent_horiz_high_map REAL", "most_recent_horiz_low_map REAL", "most_recent_ssa REAL",
      "most_recent_ema_ssa REAL", "most_recent_crossing INTEGER",
      "most_recent_base_fl REAL", "most_recent_uoedt REAL", "most_recent_loedt REAL",
      "non_a_horiz_high_map REAL", "non_a_horiz_low_map REAL", "non_a_ssa REAL",
      "non_a_ema_ssa REAL", "non_a_crossing INTEGER",
      "non_a_base_fl REAL", "non_a_uoedt REAL", "non_a_loedt REAL",
      "non_b_horiz_high_map REAL", "non_b_horiz_low_map REAL", "non_b_ssa REAL",
      "non_b_ema_ssa REAL", "non_b_crossing INTEGER",
      "non_b_base_fl REAL", "non_b_uoedt REAL", "non_b_loedt REAL",
      "fractal_best_fl REAL", "fractal_uoedt REAL", "fractal_loedt REAL",
      "best_resistance REAL", "best_support REAL",
      "body_direction INTEGER", "body_size REAL", "body_classification INTEGER",
      "zigzag_point_type TEXT", "zigzag_current_point REAL",
      "zigzag_price_change REAL", "zigzag_pct_change REAL", "zigzag_pct_change_class INTEGER",
      "zigzag_bars INTEGER", "zigzag_bars_class INTEGER",
      "zigzag_price_per_bar REAL", "zigzag_price_per_bar_class INTEGER",
      "zigzag_slope REAL", "zigzag_category TEXT",
      "cycle_id INTEGER", "collected_at INTEGER", "calculated_at INTEGER"
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
//| Read the v6 admin-layer fields for one centroid-regression       |
//| variant handle: horiz_high_map(3), horiz_low_map(4), ssa(0),     |
//| ema_ssa(1), crossing(2, collapsed to 0/1). Buffers 5/6 (119) and |
//| 7/8/9 (OLD computed BaseLine/UOEDT/LOEDT) are intentionally not  |
//| read - Python owns base_fl/uoedt/loedt in v6.                    |
//+------------------------------------------------------------------+
CentroidFields GetCentroidFields(int handle, int shift)
{
   CentroidFields f;
   f.ssa            = GetIndicatorValue(handle, 0, shift);
   f.ema_ssa        = GetIndicatorValue(handle, 1, shift);
   double crossRaw  = GetIndicatorValue(handle, 2, shift);
   f.crossing       = (crossRaw != EMPTY_VALUE && crossRaw != 0.0) ? 1 : 0;
   f.horiz_high_map = GetIndicatorValue(handle, 3, shift);
   f.horiz_low_map  = GetIndicatorValue(handle, 4, shift);
   return f;
}

//+------------------------------------------------------------------+
//| Read the v6 admin-layer zigzag pivot (buffer 0=peak price,       |
//| buffer 1=bottom price; both use 0.0 as "no pivot on this bar").  |
//| point_type is "" and current_point is EMPTY_VALUE when this bar  |
//| is not a pivot - both serialize to null downstream.              |
//+------------------------------------------------------------------+
void GetZigZagAdmin(int handle, int shift, string &pointType, double &currentPoint)
{
   double peak   = GetIndicatorValue(handle, 0, shift);
   double bottom = GetIndicatorValue(handle, 1, shift);

   if(peak != EMPTY_VALUE && peak != 0.0)
   {
      pointType = "Peak";
      currentPoint = peak;
   }
   else if(bottom != EMPTY_VALUE && bottom != 0.0)
   {
      pointType = "Bottom";
      currentPoint = bottom;
   }
   else
   {
      pointType = "";
      currentPoint = EMPTY_VALUE;
   }
}

//+------------------------------------------------------------------+
//| JSON/SQL null-safe formatting helpers                            |
//| (gateway_contract_market_data.schema.json: "empty export fields  |
//| are stored as NULL, not 0")                                      |
//+------------------------------------------------------------------+
string DoubleOrNull(double v)
{
   return (v == EMPTY_VALUE) ? "null" : DoubleToString(v, 5);
}

string StrOrNull(string v)
{
   return (v == "") ? "null" : ("\"" + v + "\"");
}

string SqlNumOrNull(double v)
{
   return (v == EMPTY_VALUE) ? "NULL" : DoubleToString(v, 5);
}

string SqlStrOrNull(string v)
{
   return (v == "") ? "NULL" : ("'" + v + "'");
}

//+------------------------------------------------------------------+
//| One centroid variant's admin fields as a JSON fragment (no       |
//| surrounding braces). base_fl/uoedt/loedt are always null - they  |
//| are Python-calculated (centroid_regression.py), never MQL5.      |
//+------------------------------------------------------------------+
string CentroidToJson(string prefix, CentroidFields &c)
{
   return StringFormat(
      "\"%s_horiz_high_map\":%s,\"%s_horiz_low_map\":%s,\"%s_ssa\":%s,\"%s_ema_ssa\":%s,\"%s_crossing\":%d,"
      "\"%s_base_fl\":null,\"%s_uoedt\":null,\"%s_loedt\":null",
      prefix, DoubleOrNull(c.horiz_high_map),
      prefix, DoubleOrNull(c.horiz_low_map),
      prefix, DoubleOrNull(c.ssa),
      prefix, DoubleOrNull(c.ema_ssa),
      prefix, c.crossing,
      prefix, prefix, prefix
   );
}

//+------------------------------------------------------------------+
//| One centroid variant's admin fields as SQL VALUES fragment, in   |
//| the same column order as CreateSymbolTable's *_horiz_high_map .. |
//| *_loedt block.                                                   |
//+------------------------------------------------------------------+
string CentroidToSqlValues(CentroidFields &c)
{
   return SqlNumOrNull(c.horiz_high_map) + "," + SqlNumOrNull(c.horiz_low_map) + "," +
          SqlNumOrNull(c.ssa) + "," + SqlNumOrNull(c.ema_ssa) + "," +
          IntegerToString(c.crossing) + ",NULL,NULL,NULL";
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

   // --- Centroid-regression admin layer (horiz_high_map/horiz_low_map/ssa/
   //     ema_ssa/crossing) per variant. base_fl/uoedt/loedt are Python-only
   //     and always sent as null (see CentroidToJson/CentroidToSqlValues). ---
   CentroidFields best_fit_a  = GetCentroidFields(tfIndicators[slotIndex].h_cr_bestfit_a, shift);
   CentroidFields best_fit_b  = GetCentroidFields(tfIndicators[slotIndex].h_cr_bestfit_b, shift);
   CentroidFields cherry_a    = GetCentroidFields(tfIndicators[slotIndex].h_cr_cherry_a, shift);
   CentroidFields cherry_b    = GetCentroidFields(tfIndicators[slotIndex].h_cr_cherry_b, shift);
   CentroidFields most_recent = GetCentroidFields(tfIndicators[slotIndex].h_cr_mostrecent, shift);
   CentroidFields non_a       = GetCentroidFields(tfIndicators[slotIndex].h_cr_nonrecent_a, shift);
   CentroidFields non_b       = GetCentroidFields(tfIndicators[slotIndex].h_cr_nonrecent_b, shift);

   // --- ZigZag admin layer: pivot type/price only. ---
   string zigzag_point_type;
   double zigzag_current_point;
   GetZigZagAdmin(tfIndicators[slotIndex].h_zigzag, shift, zigzag_point_type, zigzag_current_point);

   // NOTE: h_fractal_bestfit, h_best_resistance, h_best_support, and
   // h_zscore_candle stay attached (see TimeframeIndicators comments) but are
   // deliberately never read here. Every field they could supply
   // (fractal_best_fl/uoedt/loedt, best_resistance, best_support,
   // body_direction/body_size/body_classification) is Python-only in v6 -
   // computed by fractal_lines.py / zscore_candle.py from OHLC, not by MQL5.
   // Reading their old buffers would silently push wrong numbers under
   // right-sounding column names, so PublishToLocalRelay/WriteSQLiteBackup
   // send those fields as NULL instead.

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
            best_fit_a, best_fit_b, cherry_a, cherry_b, most_recent, non_a, non_b,
            zigzag_point_type, zigzag_current_point
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
      dbIndex, sanitizedName, tf, rate[0],
      best_fit_a, best_fit_b, cherry_a, cherry_b, most_recent, non_a, non_b,
      zigzag_point_type, zigzag_current_point
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
//| Publish to Async TCP Socket Relay.                                |
//| JSON field set/names match gateway_contract_market_data.schema   |
//| .json exactly (additionalProperties:false - 87 fields, no more,  |
//| no less). Python-only fields are emitted as JSON null, never 0.  |
//+------------------------------------------------------------------+
bool PublishToLocalRelay(string symbol, ENUM_TIMEFRAMES tf, MqlRates &rate,
                          CentroidFields &best_fit_a, CentroidFields &best_fit_b, CentroidFields &cherry_a, CentroidFields &cherry_b,
                          CentroidFields &most_recent, CentroidFields &non_a, CentroidFields &non_b,
                          string zigzag_point_type, double zigzag_current_point)
{
   string payload = "{";

   payload += "\"terminal_id\":\"" + TerminalID + "\",";
   payload += "\"timestamp\":" + IntegerToString((long)rate.time) + ",";
   payload += "\"symbol\":\"" + symbol + "\",";
   payload += "\"timeframe\":\"" + TimeframeToShortString(tf) + "\",";
   payload += "\"open\":" + DoubleToString(rate.open, 5) + ",";
   payload += "\"high\":" + DoubleToString(rate.high, 5) + ",";
   payload += "\"low\":" + DoubleToString(rate.low, 5) + ",";
   payload += "\"close\":" + DoubleToString(rate.close, 5) + ",";
   payload += "\"volume\":" + IntegerToString((long)rate.tick_volume) + ",";

   payload += CentroidToJson("best_fit_a", best_fit_a) + ",";
   payload += CentroidToJson("best_fit_b", best_fit_b) + ",";
   payload += CentroidToJson("cherry_a", cherry_a) + ",";
   payload += CentroidToJson("cherry_b", cherry_b) + ",";
   payload += CentroidToJson("most_recent", most_recent) + ",";
   payload += CentroidToJson("non_a", non_a) + ",";
   payload += CentroidToJson("non_b", non_b) + ",";

   // Fractal/resistance/support/body classification — Python-only in v6.
   payload += "\"fractal_best_fl\":null,\"fractal_uoedt\":null,\"fractal_loedt\":null,";
   payload += "\"best_resistance\":null,\"best_support\":null,";
   payload += "\"body_direction\":null,\"body_size\":null,\"body_classification\":null,";

   // ZigZag: pivot type/price are admin (MQL5); the 9 segment metrics are Python-only.
   payload += "\"zigzag_point_type\":" + StrOrNull(zigzag_point_type) + ",";
   payload += "\"zigzag_current_point\":" + DoubleOrNull(zigzag_current_point) + ",";
   payload += "\"zigzag_price_change\":null,\"zigzag_pct_change\":null,\"zigzag_pct_change_class\":null,";
   payload += "\"zigzag_bars\":null,\"zigzag_bars_class\":null,\"zigzag_price_per_bar\":null,";
   payload += "\"zigzag_price_per_bar_class\":null,\"zigzag_slope\":null,\"zigzag_category\":null,";

   // Provenance: cycle_id/calculated_at belong to the export-file pipeline's
   // COLLECT/CALCULATE stages, which this direct-push EA bypasses entirely.
   // collected_at is this push's own timestamp (this EA's closest analog).
   payload += "\"cycle_id\":null,";
   payload += "\"collected_at\":" + IntegerToString((long)TimeCurrent()) + ",";
   payload += "\"calculated_at\":null";

   payload += "}\n";  // CRITICAL: The \n delimiter allows Python to readline()

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
//| Write to SQLite backup (Fallback only).                          |
//| Column set/order matches CreateSymbolTable, which mirrors        |
//| gateway_contract_market_data.schema.json. Python-only fields are |
//| written as SQL NULL, never 0 (sqlite_schema_v6_xauusd.sql:       |
//| "Empty export fields are stored as NULL, not 0").                |
//+------------------------------------------------------------------+
bool WriteSQLiteBackup(int dbIndex, string symbol, ENUM_TIMEFRAMES tf, MqlRates &rate,
                        CentroidFields &best_fit_a, CentroidFields &best_fit_b, CentroidFields &cherry_a, CentroidFields &cherry_b,
                        CentroidFields &most_recent, CentroidFields &non_a, CentroidFields &non_b,
                        string zigzag_point_type, double zigzag_current_point)
{
   string tableName = symbolDatabases[dbIndex].sanitizedName;

   string columns =
      "timestamp, symbol, timeframe, terminal_id, open, high, low, close, volume, "
      "best_fit_a_horiz_high_map, best_fit_a_horiz_low_map, best_fit_a_ssa, best_fit_a_ema_ssa, best_fit_a_crossing, "
      "best_fit_a_base_fl, best_fit_a_uoedt, best_fit_a_loedt, "
      "best_fit_b_horiz_high_map, best_fit_b_horiz_low_map, best_fit_b_ssa, best_fit_b_ema_ssa, best_fit_b_crossing, "
      "best_fit_b_base_fl, best_fit_b_uoedt, best_fit_b_loedt, "
      "cherry_a_horiz_high_map, cherry_a_horiz_low_map, cherry_a_ssa, cherry_a_ema_ssa, cherry_a_crossing, "
      "cherry_a_base_fl, cherry_a_uoedt, cherry_a_loedt, "
      "cherry_b_horiz_high_map, cherry_b_horiz_low_map, cherry_b_ssa, cherry_b_ema_ssa, cherry_b_crossing, "
      "cherry_b_base_fl, cherry_b_uoedt, cherry_b_loedt, "
      "most_recent_horiz_high_map, most_recent_horiz_low_map, most_recent_ssa, most_recent_ema_ssa, most_recent_crossing, "
      "most_recent_base_fl, most_recent_uoedt, most_recent_loedt, "
      "non_a_horiz_high_map, non_a_horiz_low_map, non_a_ssa, non_a_ema_ssa, non_a_crossing, "
      "non_a_base_fl, non_a_uoedt, non_a_loedt, "
      "non_b_horiz_high_map, non_b_horiz_low_map, non_b_ssa, non_b_ema_ssa, non_b_crossing, "
      "non_b_base_fl, non_b_uoedt, non_b_loedt, "
      "fractal_best_fl, fractal_uoedt, fractal_loedt, "
      "best_resistance, best_support, "
      "body_direction, body_size, body_classification, "
      "zigzag_point_type, zigzag_current_point, zigzag_price_change, zigzag_pct_change, zigzag_pct_change_class, "
      "zigzag_bars, zigzag_bars_class, zigzag_price_per_bar, zigzag_price_per_bar_class, zigzag_slope, zigzag_category, "
      "cycle_id, collected_at, calculated_at";

   string values =
      IntegerToString((long)rate.time) + ",'" + symbol + "','" + TimeframeToShortString(tf) + "','" + TerminalID + "'," +
      DoubleToString(rate.open, 5) + "," + DoubleToString(rate.high, 5) + "," +
      DoubleToString(rate.low, 5) + "," + DoubleToString(rate.close, 5) + "," +
      IntegerToString((long)rate.tick_volume) + "," +
      CentroidToSqlValues(best_fit_a) + "," +
      CentroidToSqlValues(best_fit_b) + "," +
      CentroidToSqlValues(cherry_a) + "," +
      CentroidToSqlValues(cherry_b) + "," +
      CentroidToSqlValues(most_recent) + "," +
      CentroidToSqlValues(non_a) + "," +
      CentroidToSqlValues(non_b) + "," +
      "NULL,NULL,NULL," +                              // fractal_best_fl/uoedt/loedt — Python-only
      "NULL,NULL," +                                   // best_resistance/best_support — Python-only
      "NULL,NULL,NULL," +                              // body_direction/body_size/body_classification — Python-only
      SqlStrOrNull(zigzag_point_type) + "," + SqlNumOrNull(zigzag_current_point) + "," +
      "NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL," + // zigzag_price_change .. zigzag_category — Python-only
      "NULL," +                                        // cycle_id — COLLECT-stage provenance, not applicable
      IntegerToString((long)TimeCurrent()) + "," +      // collected_at — this push's own timestamp
      "NULL";                                           // calculated_at — CALCULATE-stage provenance, not applicable

   string insertSQL = StringFormat("INSERT OR REPLACE INTO [%s] (%s) VALUES (%s)", tableName, columns, values);

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
