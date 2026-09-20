//+------------------------------------------------------------------+
//|                          SupportAndResistantAutoCalibration_v2_29.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//| Description: Dynamic S/R Levels with Freedman-Diaconis IQR       |
//|              Auto-Calibration & Fixed Date Anchors (v2.29)       |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MetaQuotes Ltd."
#property link        "https://www.mql5.com"
#property version     "2.29"
#property description "Support & Resistance with Freedman-Diaconis IQR Auto-Calibration & Stack C Pipeline"
#property strict
#property indicator_chart_window

#property indicator_buffers 8
#property indicator_plots   8
#property indicator_label1  "sr_support_4"
#property indicator_label2  "sr_support_3"
#property indicator_label3  "sr_support_2"
#property indicator_label4  "sr_support_1"
#property indicator_label5  "sr_resistance_1"
#property indicator_label6  "sr_resistance_2"
#property indicator_label7  "sr_resistance_3"
#property indicator_label8  "sr_resistance_4"

//--- Export Button name constants
#define EXPORT_BUTTON_NAME   "SRAutoExportButton_v2_29"
#define BACKFILL_BUTTON_NAME "SRAutoBackfillButton_v2_29"
#define MAX_WINDOW_BARS      3000

//+------------------------------------------------------------------+
//| Window Calculation Mode                                          |
//+------------------------------------------------------------------+
enum ENUM_CALC_WINDOW_MODE
{
   CALC_WINDOW_FIXED_RANGE = 0,    // Fixed Window (Start Date -> End Date)
   CALC_WINDOW_FIXED_START = 1     // Fix Start Date -> End at Last Bar (Shift 0)
};

//+------------------------------------------------------------------+
//| Input parameters                                                 |
//+------------------------------------------------------------------+
input group "===== Window Period Settings ====="
input ENUM_CALC_WINDOW_MODE InpWindowMode     = CALC_WINDOW_FIXED_RANGE; // Window Calculation Mode
input datetime              InpStartDateTime  = D'2026.06.04 14:20';     // Window Start Date/Time
input datetime              InpEndDateTime    = D'2026.06.08 07:45';     // Window End Date/Time (Used if Fixed Window)

input group "===== Auto-Calibration Settings (Freedman-Diaconis IQR) ====="
input bool     InpAutoCalibrate      = true;   // Enable Auto-Calibration (IQR Rule)
input int      InpMinFractalTouches  = 1;      // Min Touches to Form Level (1=all, 2=multi-touch)

input group "===== Fallback Manual Settings (Used when AutoCalibrate=false) ====="
input ENUM_TIMEFRAMES SRTimeframe   = PERIOD_CURRENT; // Timeframe to Analyze
input double   AccuracyMultiplier    = 4.0;    // Manual Fallback Multiplier (eg: 1.0-4.0)
input int      ATRPeriod             = 162;    // Manual Fallback ATR Period
input int      SafeDistance          = 50;     // Safety Distance From Closest Level (points)
input int      MaxRange              = 0;      // Max Price Range (points) (0=No Limit)

input group "===== Draw Line Settings ====="
input bool            DrawLinesEnabled = true;                 // Draw Lines
input int             LineThickness    = 1;                    // Line Thickness (1-5)
input ENUM_LINE_STYLE ResistanceStyle  = STYLE_DASHDOTDOT;     // Resistance Line Style
input ENUM_LINE_STYLE SupportStyle     = STYLE_DASHDOTDOT;     // Support Line Style
input color           ResistanceColor  = clrRed;               // Resistance Color
input color           SupportColor     = clrGreen;             // Support Color
input bool            InpShowSlotTags  = true;                 // Show sr_1..sr_8 Slot Tags on Chart

input group "===== Stack C Pipeline & Export Settings ====="
input string InpExportFileName       = "SR_Levels";           // Export file prefix ({Prefix}_{Symbol}_{TF}.txt)
input bool   InpIncludeHeader        = true;                  // Include TSV header
input bool   InpAutoExport           = true;                  // Automated export every minute at InpExportSecond
input int    InpExportSecond         = 59;                    // Export trigger second (0-59)
input int    InpExportBars           = 3000;                  // Bars to export (matches 3000-bar pipeline depth)
input bool   InpEnableExportButton   = true;                  // Enable on-chart manual export button
input bool   InpEnableBackfillButton = true;                  // Enable on-chart backfill button
input int    InpBackfillBars         = 0;                     // Backfill depth in bars (0 = all loaded history)
input string IndicatorName           = "MQLTA-SR-Auto-v2_29";  // Object Prefix / Indicator Name

//+------------------------------------------------------------------+
//| Global variables                                                 |
//+------------------------------------------------------------------+
int    ATRHandle      = INVALID_HANDLE;
int    FractalsHandle = INVALID_HANDLE;
double BufferFractalsUp[];
double BufferFractalsDown[];
double BufferATR[];

// 8 indicator plot buffers
double BufferZero[];   // Support 4 (furthest below)
double BufferOne[];    // Support 3
double BufferTwo[];    // Support 2
double BufferThree[];  // Support 1 (closest below)
double BufferFour[];   // Resistance 1 (closest above)
double BufferFive[];   // Resistance 2
double BufferSix[];    // Resistance 3
double BufferSeven[];  // Resistance 4 (furthest above)

// Internal clustered levels
double ArrayLevels[];

// Distance & state tracking
int    DistanceFromSupport    = INT_MAX;
int    DistanceFromResistance = INT_MAX;
double LevelAbove             = 0;
double LevelBelow             = 0;
bool   Waiting                = false;

// Statistic capture for companion _Statistic.txt audit file
string g_stat_calc_mode       = "Freedman-Diaconis IQR (Auto-Calibrated)";
int    g_stat_window_bars     = 0;
long   g_stat_window_start_ts = 0;
long   g_stat_window_end_ts   = 0;
int    g_stat_fractals_n      = 0;
double g_stat_q25             = 0.0;
double g_stat_q75             = 0.0;
double g_stat_iqr             = 0.0;
double g_stat_opt_step        = 0.0;
int    g_stat_levels_count    = 0;
double g_stat_nearest_support = 0.0;
double g_stat_nearest_resist  = 0.0;
int    g_stat_dist_support    = INT_MAX;
int    g_stat_dist_resist     = INT_MAX;
double g_stat_highest_window  = 0.0;
double g_stat_lowest_window   = 0.0;

// Forward declarations
void CleanLines();
void CleanChart();
void InitializeHandles();
void CalculateLevels(ENUM_TIMEFRAMES calc_tf, int start_idx, int end_idx, int window_bars);
void FillBuffers(double currentClose);
void DrawLines(double currentClose);
double CalculateLevelAbove(double currentClose);
double CalculateLevelBelow(double currentClose);
void DisplayDistanceComments();
bool ExportSRData(bool is_backfill = false);
void WriteSRStatFile(string clean_symbol, string tf_str);
double CalculatePercentile(const double &sorted_array[], double percentile);

//+------------------------------------------------------------------+
//| Validate S/R level value - filter out invalid/corrupted values   |
//+------------------------------------------------------------------+
bool IsValidSRLevel(double value)
{
   if(value == EMPTY_VALUE)
      return false;
   if(value <= 0)
      return false;
   if(value < 0.0001 || value > 1000000.0)
      return false;
   if(!MathIsValidNumber(value))
      return false;

   return true;
}

//+------------------------------------------------------------------+
//| Format a price for export                                        |
//+------------------------------------------------------------------+
// Every price this indicator emits -- the sr_1..sr_8 slots in the TSV and the
// resolved-level block of the statistic file -- goes through here, so the
// precision is decided in exactly one place.
//
// This was hardcoded to 2 decimals while `close` on the same row used _Digits.
// Identical on XAUUSD (_Digits == 2) and therefore invisible, but on a 5-digit
// FX symbol it silently truncated every level to 2dp -- for EURUSD that rounds
// 1.08435 to 1.08, which is not a level, it is a different price entirely.
// An unresolved slot stays an empty string, which the collector stages as NULL;
// see PRICE_LEVEL_COLUMNS in export_collector_validator_v2.py, which would
// otherwise read a 0.0 sentinel as a real $0.00 price level.
string SRPriceToString(double value)
{
   return IsValidSRLevel(value) ? DoubleToString(value, _Digits) : "";
}

//+------------------------------------------------------------------+
//| Calculate percentile from a sorted array of doubles              |
//+------------------------------------------------------------------+
double CalculatePercentile(const double &sorted_array[], double percentile)
{
   int n = ArraySize(sorted_array);
   if(n == 0) return 0.0;
   if(n == 1) return sorted_array[0];
   if(percentile <= 0.0) return sorted_array[0];
   if(percentile >= 100.0) return sorted_array[n - 1];

   double rank = (percentile / 100.0) * (n - 1);
   int low_idx = (int)MathFloor(rank);
   int high_idx = (int)MathCeil(rank);
   double weight = rank - low_idx;

   if(high_idx >= n) high_idx = n - 1;
   return sorted_array[low_idx] * (1.0 - weight) + sorted_array[high_idx] * weight;
}

//+------------------------------------------------------------------+
//| Generate standardized export filename                            |
//+------------------------------------------------------------------+
// `suffix` is appended before the extension. The pipeline export passes "" and
// keeps the exact `{Prefix}_{Symbol}_{TF}.txt` name the collector globs for;
// the backfill export passes "_Backfill" so it lands beside it under a name the
// collector does not match, and therefore cannot disturb a live cycle.
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe,
                        string suffix = "")
{
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");

   return StringFormat("%s_%s_%s%s.txt", base_name, clean_symbol, tf_str, suffix);
}

//+------------------------------------------------------------------+
//| Create Manual Export Button                                      |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
      ObjectDelete(0, EXPORT_BUTTON_NAME);

   if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
      return;

   int button_width  = 180;
   int button_height = 35;
   int x_margin      = 200;
   int y_margin      = 55;

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Auto-SR Export");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 10);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
}

//+------------------------------------------------------------------+
//| Create Manual Backfill Button                                    |
//+------------------------------------------------------------------+
void CreateBackfillButton()
{
   if(ObjectFind(0, BACKFILL_BUTTON_NAME) >= 0)
      ObjectDelete(0, BACKFILL_BUTTON_NAME);

   if(!ObjectCreate(0, BACKFILL_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
      return;

   int button_width  = 180;
   int button_height = 35;
   int x_margin      = 200;
   int y_margin      = 15;

   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   ObjectSetString(0, BACKFILL_BUTTON_NAME, OBJPROP_TEXT, "Auto-SR Backfill");
   ObjectSetString(0, BACKFILL_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_FONTSIZE, 10);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,150,80');
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,120,60');
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_STATE, false);
}

//+------------------------------------------------------------------+
//| Companion Statistic File Export (Stack C Audit / Capture)       |
//+------------------------------------------------------------------+
void WriteSRStatFile(string clean_symbol, string tf_str)
{
   string filename = StringFormat("%s_%s_%s_Statistic.txt", InpExportFileName, clean_symbol, tf_str);
   ResetLastError();
   int fh = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      Print("WARNING: Failed to open SR stat file: ", filename);
      return;
   }

   FileWriteString(fh, "[SUPPORT-RESISTANCE AUTO-CALIBRATION - PARAMETERS]\r\n");
   FileWriteString(fh, "Calculation Mode: "       + g_stat_calc_mode + "\r\n");
   string win_mode_stat = (InpWindowMode == CALC_WINDOW_FIXED_START) ? "Fix Start -> Last Bar" : "Fixed Window";
   FileWriteString(fh, "Window Mode: "            + win_mode_stat + "\r\n");
   FileWriteString(fh, "Window Start TS (UTC): " + IntegerToString(g_stat_window_start_ts) + "\r\n");
   FileWriteString(fh, "Window End TS (UTC): "   + IntegerToString(g_stat_window_end_ts) + "\r\n");
   // Two clean fields rather than "67 (Max Cap: 3000)": a trailing
   // parenthetical makes the collector's int coercion return None, which
   // would silently void this field for every row.
   FileWriteString(fh, "Window Bars: "            + IntegerToString(g_stat_window_bars) + "\r\n");
   FileWriteString(fh, "Max Window Bars: "        + IntegerToString(MAX_WINDOW_BARS) + "\r\n");
   FileWriteString(fh, "Timeframe (Sec): "        + IntegerToString(PeriodSeconds(_Period)) + "\r\n");
   FileWriteString(fh, "Fractals Sample (N): "   + IntegerToString(g_stat_fractals_n) + "\r\n");
   FileWriteString(fh, "Q25 (25th percentile): "  + DoubleToString(g_stat_q25, _Digits) + "\r\n");
   FileWriteString(fh, "Q75 (75th percentile): "  + DoubleToString(g_stat_q75, _Digits) + "\r\n");
   FileWriteString(fh, "IQR: "                    + DoubleToString(g_stat_iqr, _Digits) + "\r\n");
   FileWriteString(fh, "Optimal Step: "           + DoubleToString(g_stat_opt_step, _Digits) + "\r\n");
   FileWriteString(fh, "Min Touches Filter: "     + IntegerToString(InpMinFractalTouches) + "\r\n");
   FileWriteString(fh, "Highest High: "           + DoubleToString(g_stat_highest_window, _Digits) + "\r\n");
   FileWriteString(fh, "Lowest Low: "             + DoubleToString(g_stat_lowest_window, _Digits) + "\r\n");
   // Price context. These levels are only interpretable relative to where
   // price actually is, and nothing in this file recorded that; Window Range
   // is the scale Optimal Step has to be read against.
   FileWriteString(fh, "Window Range: "           + DoubleToString(g_stat_highest_window - g_stat_lowest_window, _Digits) + "\r\n");
   double sr_live_close = iClose(_Symbol, _Period, 0);
   FileWriteString(fh, "Live Close: "             + (sr_live_close > 0.0 ? DoubleToString(sr_live_close, _Digits) : "") + "\r\n");
   FileWriteString(fh, "\r\n");

   FileWriteString(fh, "[SUPPORT-RESISTANCE AUTO-CALIBRATION - RESOLVED LEVELS]\r\n");
   FileWriteString(fh, "Total Macro Clusters: "  + IntegerToString(g_stat_levels_count) + "\r\n");
   FileWriteString(fh, "Pipeline 1:1 Slots: 8 (sr_1..sr_8)\r\n");
   // "NULL" rather than an empty value, deliberately: this block is a human
   // audit record, and an unresolved slot is a real and common outcome (in a
   // real capture sr_8 was populated on only 86 of 501 bars). The collector
   // does not read these eight lines -- it reads the sr_* columns from the TSV
   // -- so the spelling here is a readability choice, not a contract.
   FileWriteString(fh, "sr_1 (Support 1): "       + (IsValidSRLevel(BufferThree[0]) ? SRPriceToString(BufferThree[0]) : "NULL") + "\r\n");
   FileWriteString(fh, "sr_2 (Support 2): "       + (IsValidSRLevel(BufferTwo[0])   ? SRPriceToString(BufferTwo[0])   : "NULL") + "\r\n");
   FileWriteString(fh, "sr_3 (Support 3): "       + (IsValidSRLevel(BufferOne[0])   ? SRPriceToString(BufferOne[0])   : "NULL") + "\r\n");
   FileWriteString(fh, "sr_4 (Support 4): "       + (IsValidSRLevel(BufferZero[0])  ? SRPriceToString(BufferZero[0])  : "NULL") + "\r\n");
   FileWriteString(fh, "sr_5 (Resistance 1): "    + (IsValidSRLevel(BufferFour[0])  ? SRPriceToString(BufferFour[0])  : "NULL") + "\r\n");
   FileWriteString(fh, "sr_6 (Resistance 2): "    + (IsValidSRLevel(BufferFive[0])  ? SRPriceToString(BufferFive[0])  : "NULL") + "\r\n");
   FileWriteString(fh, "sr_7 (Resistance 3): "    + (IsValidSRLevel(BufferSix[0])   ? SRPriceToString(BufferSix[0])   : "NULL") + "\r\n");
   FileWriteString(fh, "sr_8 (Resistance 4): "    + (IsValidSRLevel(BufferSeven[0]) ? SRPriceToString(BufferSeven[0]) : "NULL") + "\r\n");
   FileWriteString(fh, "Nearest Resistance: "     + (g_stat_nearest_resist > 0 ? DoubleToString(g_stat_nearest_resist, _Digits) : "") + "\r\n");
   FileWriteString(fh, "Nearest Support: "        + (g_stat_nearest_support > 0 ? DoubleToString(g_stat_nearest_support, _Digits) : "") + "\r\n");
   FileWriteString(fh, "Distance to Resistance: " + (g_stat_dist_resist != INT_MAX ? IntegerToString(g_stat_dist_resist) : "") + "\r\n");
   FileWriteString(fh, "Distance to Support: "    + (g_stat_dist_support != INT_MAX ? IntegerToString(g_stat_dist_support) : "") + "\r\n");

   FileClose(fh);
}

//+------------------------------------------------------------------+
//| Export Support & Resistance Levels (Stack C Pipeline TSV)        |
//+------------------------------------------------------------------+
// `is_backfill` selects between two genuinely different exports. It used to be
// accepted and never read, which made the on-chart "Backfill" button a
// relabelled "Export" -- it printed "Starting backfill export for N historical
// bars..." and then wrote the same file with the same depth.
//
//   false (auto timer / EXPORT_ALL broadcast / manual Export button)
//       THE PIPELINE EXPORT. `{Prefix}_{Symbol}_{TF}.txt`, exactly
//       InpExportBars rows, and it refreshes the companion statistic file.
//       This is what the collector globs for every cycle; unchanged.
//
//   true (manual Backfill button only)
//       AN OPERATOR ARTEFACT. The deepest history MT5 has loaded (capped by
//       InpBackfillBars, 0 = all), written to `{...}_{TF}_Backfill.txt`.
//
// Why backfill must NOT write the pipeline file: promote_cycle() merges every
// source onto the OHLCV spine, and OHLCV exports 3000 bars with no backfill
// button of its own. Bars older than the spine are therefore dropped on
// promotion -- so writing deeper history into the pipeline file would cost
// staging I/O, be discarded, and then be overwritten by the next :59 auto
// export. Deeper history is only meaningful outside the pipeline, which is why
// it gets its own filename.
//
// The statistic file is likewise not rewritten on backfill: it is a snapshot of
// the CURRENT calibration, it is now ingested into indicator_statistics, and a
// manual click landing on the collector's :05 read would be a torn read of a
// live lane for no gain.
bool ExportSRData(bool is_backfill = false)
{
   string symbol = _Symbol;
   ENUM_TIMEFRAMES timeframe = (SRTimeframe == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : SRTimeframe;

   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");

   string filename = GenerateFilename(InpExportFileName, clean_symbol, timeframe,
                                      is_backfill ? "_Backfill" : "");

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open TXT file for writing: ", filename, " (Error: ", GetLastError(), ")");
      return false;
   }

   // 1. TSV Header (strictly conforming to Stack C schema)
   if(InpIncludeHeader)
   {
      string header = "timestamp\tsymbol\ttimeframe\tclose\tsr_1\tsr_2\tsr_3\tsr_4\tsr_5\tsr_6\tsr_7\tsr_8\r\n";
      FileWriteString(file_handle, header);
   }

   // 2. Broker->UTC offset (Stack C §7.1 Blueprint fix: rounded to the hour)
   long _srv_off = (long)TimeTradeServer() - (long)TimeGMT();
   datetime gmt_offset = (datetime)((long)MathRound(_srv_off / 3600.0) * 3600);

   // 3. Export depth.
   //
   // `export_limit` is the OLDEST shift written and the loop below is inclusive
   // at both ends, so the row count is export_limit + 1. It read
   // MathMin(InpExportBars, available_bars - 1), i.e. 3001 rows for a nominal
   // 3000 -- one bar deeper than every other producer. Confirmed against a real
   // capture: SR_Levels_XAUUSD_M15.txt carried 3001 data rows against OHLCV's
   // 3000, reaching exactly one M15 bar further back.
   //
   // That extra row was harmless (promote_cycle() joins on the OHLCV spine, so
   // a bar the spine does not have is never promoted, and validate_cycle()
   // skips any timestamp carried by fewer than two sources) but it was also
   // pure waste, and an unexplained off-by-one in a lane where a missing bar
   // rejects the whole cycle is worth removing rather than leaving to be
   // rediscovered. Now exactly InpExportBars rows, matching the OHLCV spine and
   // the seven centroid producers.
   //
   // Shift 0 -- the still-forming bar -- is deliberately INCLUDED. It is not an
   // off-by-one: validate_cycle()'s completeness check takes the spine's newest
   // bar and requires every per-bar source to carry it, so dropping shift 0
   // here would reject every cycle. See HISTORICAL-VALUES-LOOK-AHEAD-BIAS
   // section 4 for what that newest row therefore is.
   int available_bars = iBars(symbol, timeframe);
   int requested_bars = is_backfill
                        ? (InpBackfillBars > 0 ? InpBackfillBars : available_bars)
                        : InpExportBars;
   int export_limit   = MathMin(requested_bars - 1, available_bars - 1);
   if(export_limit < 0) export_limit = 0;

   // 4. Export rows from oldest bar down to bar 0 (live bar)
   for(int shift = export_limit; shift >= 0; shift--)
   {
      datetime bar_time = iTime(symbol, timeframe, shift);
      double   bar_close = iClose(symbol, timeframe, shift);
      long     unix_ts   = (long)(bar_time - gmt_offset);

      // Evaluate levels relative to THIS bar's close price
      double sr_support_1 = 0, sr_support_2 = 0, sr_support_3 = 0, sr_support_4 = 0;
      double sr_resistance_1 = 0, sr_resistance_2 = 0, sr_resistance_3 = 0, sr_resistance_4 = 0;

      // Resistance levels (above bar_close)
      int r_count = 0;
      for(int i = 0; i < ArraySize(ArrayLevels) && r_count < 4; i++)
      {
         if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] > bar_close)
         {
            switch(r_count)
            {
               case 0: sr_resistance_1 = ArrayLevels[i]; break;
               case 1: sr_resistance_2 = ArrayLevels[i]; break;
               case 2: sr_resistance_3 = ArrayLevels[i]; break;
               case 3: sr_resistance_4 = ArrayLevels[i]; break;
            }
            r_count++;
         }
      }

      // Support levels (below bar_close - reverse order for closest first)
      int s_count = 0;
      for(int i = ArraySize(ArrayLevels) - 1; i >= 0 && s_count < 4; i--)
      {
         if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] < bar_close)
         {
            switch(s_count)
            {
               case 0: sr_support_1 = ArrayLevels[i]; break;
               case 1: sr_support_2 = ArrayLevels[i]; break;
               case 2: sr_support_3 = ArrayLevels[i]; break;
               case 3: sr_support_4 = ArrayLevels[i]; break;
            }
            s_count++;
         }
      }

      // Unresolved levels export as empty string "" -> staged as NULL.
      // SRPriceToString() applies both that rule and _Digits precision.
      string support_1_str = SRPriceToString(sr_support_1);
      string support_2_str = SRPriceToString(sr_support_2);
      string support_3_str = SRPriceToString(sr_support_3);
      string support_4_str = SRPriceToString(sr_support_4);

      string resist_1_str  = SRPriceToString(sr_resistance_1);
      string resist_2_str  = SRPriceToString(sr_resistance_2);
      string resist_3_str  = SRPriceToString(sr_resistance_3);
      string resist_4_str  = SRPriceToString(sr_resistance_4);

      string data_row = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\r\n",
                                     unix_ts,
                                     symbol,
                                     tf_str,
                                     DoubleToString(bar_close, _Digits),
                                     support_1_str,
                                     support_2_str,
                                     support_3_str,
                                     support_4_str,
                                     resist_1_str,
                                     resist_2_str,
                                     resist_3_str,
                                     resist_4_str);

      FileWriteString(file_handle, data_row);
   }

   FileClose(file_handle);

   // Write companion audit statistic file. Pipeline exports only -- see the
   // header comment: the statistic file is the CURRENT calibration snapshot and
   // is ingested into indicator_statistics, so a backfill click must not
   // rewrite it underneath a live collector read.
   if(!is_backfill)
      WriteSRStatFile(clean_symbol, tf_str);

   // Only the manual backfill reports its depth. The pipeline export runs every
   // minute on every attached chart and its callers already log success; a
   // second line per minute per chart is noise in the Experts log.
   if(is_backfill)
      Print(StringFormat("Backfill export: %d rows -> %s", export_limit + 1, filename));

   return true;
}

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   IndicatorSetString(INDICATOR_SHORTNAME, IndicatorName);

   CleanChart();
   InitializeHandles();

   SetIndexBuffer(0, BufferZero, INDICATOR_DATA);
   SetIndexBuffer(1, BufferOne, INDICATOR_DATA);
   SetIndexBuffer(2, BufferTwo, INDICATOR_DATA);
   SetIndexBuffer(3, BufferThree, INDICATOR_DATA);
   SetIndexBuffer(4, BufferFour, INDICATOR_DATA);
   SetIndexBuffer(5, BufferFive, INDICATOR_DATA);
   SetIndexBuffer(6, BufferSix, INDICATOR_DATA);
   SetIndexBuffer(7, BufferSeven, INDICATOR_DATA);

   ArraySetAsSeries(BufferZero, true);
   ArraySetAsSeries(BufferOne, true);
   ArraySetAsSeries(BufferTwo, true);
   ArraySetAsSeries(BufferThree, true);
   ArraySetAsSeries(BufferFour, true);
   ArraySetAsSeries(BufferFive, true);
   ArraySetAsSeries(BufferSix, true);
   ArraySetAsSeries(BufferSeven, true);

   // Set buffer plot styles to DRAW_NONE so chart price scaling is undisturbed
   for(int p = 0; p < 8; p++)
   {
      PlotIndexSetInteger(p, PLOT_DRAW_TYPE, DRAW_NONE);
      PlotIndexSetDouble(p, PLOT_EMPTY_VALUE, 0.0);
   }

   if(InpEnableExportButton)
      CreateExportButton();

   if(InpEnableBackfillButton)
      CreateBackfillButton();

   // Stack C 1-second auto-export timer
   if(InpAutoExport)
      EventSetTimer(1);

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Clean up chart objects                                           |
//+------------------------------------------------------------------+
void CleanChart()
{
   ObjectsDeleteAll(0, IndicatorName);
}

//+------------------------------------------------------------------+
//| Initialize handles                                               |
//+------------------------------------------------------------------+
void InitializeHandles()
{
   ENUM_TIMEFRAMES calc_tf = (SRTimeframe == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : SRTimeframe;
   ATRHandle      = iATR(_Symbol, calc_tf, ATRPeriod);
   FractalsHandle = iFractals(_Symbol, calc_tf);

   ArraySetAsSeries(BufferFractalsUp, true);
   ArraySetAsSeries(BufferFractalsDown, true);
   ArraySetAsSeries(BufferATR, true);
}

//+------------------------------------------------------------------+
//| Clean horizontal lines and tags                                  |
//+------------------------------------------------------------------+
void CleanLines()
{
   ObjectsDeleteAll(0, IndicatorName + "-HLINE-");
   ObjectsDeleteAll(0, IndicatorName + "-TAG-");
}

//+------------------------------------------------------------------+
//| Draw horizontal lines on chart (Strict 1:1 with exported sr_1..8)|
//+------------------------------------------------------------------+
void DrawLines(double currentClose)
{
   CleanLines();

   // Strict 1:1 mapping: only draw the up to 8 exported levels
   // Buffers are filled by FillBuffers(currentClose):
   // Supports:   sr_1=BufferThree[0], sr_2=BufferTwo[0], sr_3=BufferOne[0], sr_4=BufferZero[0]
   // Resistances: sr_5=BufferFour[0], sr_6=BufferFive[0], sr_7=BufferSix[0], sr_8=BufferSeven[0]

   double levels[8];
   string names[8] = {"sr_1", "sr_2", "sr_3", "sr_4", "sr_5", "sr_6", "sr_7", "sr_8"};
   bool   is_res[8] = {false, false, false, false, true, true, true, true};

   levels[0] = BufferThree[0]; // Support 1 (closest below)
   levels[1] = BufferTwo[0];   // Support 2
   levels[2] = BufferOne[0];   // Support 3
   levels[3] = BufferZero[0];  // Support 4 (furthest below)
   levels[4] = BufferFour[0];  // Resistance 1 (closest above)
   levels[5] = BufferFive[0];  // Resistance 2
   levels[6] = BufferSix[0];   // Resistance 3
   levels[7] = BufferSeven[0]; // Resistance 4 (furthest above)

   datetime tag_time = iTime(_Symbol, _Period, 0) + PeriodSeconds() * 3;

   for(int k = 0; k < 8; k++)
   {
      double lvl = levels[k];
      if(!IsValidSRLevel(lvl))
         continue;

      string line_name = IndicatorName + "-HLINE-" + names[k];
      string tag_name  = IndicatorName + "-TAG-" + names[k];

      color col        = is_res[k] ? ResistanceColor : SupportColor;
      ENUM_LINE_STYLE st = is_res[k] ? ResistanceStyle : SupportStyle;

      // 1. Horizontal Line (Ray to right, strictly matching pipeline slot)
      ObjectCreate(0, line_name, OBJ_HLINE, 0, 0, lvl);
      ObjectSetInteger(0, line_name, OBJPROP_COLOR, col);
      ObjectSetInteger(0, line_name, OBJPROP_STYLE, st);
      ObjectSetInteger(0, line_name, OBJPROP_WIDTH, LineThickness);
      ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, true);
      ObjectSetString(0, line_name, OBJPROP_TEXT, StringFormat("[%s] %s", names[k], DoubleToString(lvl, _Digits)));
      ObjectSetString(0, line_name, OBJPROP_TOOLTIP, StringFormat("Pipeline Slot: %s | Price: %s", names[k], DoubleToString(lvl, _Digits)));

      // 2. On-Chart Slot Tag (rendered next to live price candle)
      if(InpShowSlotTags)
      {
         ObjectCreate(0, tag_name, OBJ_TEXT, 0, tag_time, lvl);
         ObjectSetString(0, tag_name, OBJPROP_TEXT, StringFormat("  %s (%s)", names[k], DoubleToString(lvl, _Digits)));
         ObjectSetString(0, tag_name, OBJPROP_FONT, "Arial Bold");
         ObjectSetInteger(0, tag_name, OBJPROP_FONTSIZE, 9);
         ObjectSetInteger(0, tag_name, OBJPROP_COLOR, col);
         ObjectSetInteger(0, tag_name, OBJPROP_ANCHOR, ANCHOR_LEFT);
         ObjectSetInteger(0, tag_name, OBJPROP_SELECTABLE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Display distance HUD comments                                    |
//+------------------------------------------------------------------+
void DisplayDistanceComments()
{
   string commentText = "Support & Resistance Auto-Calibration (v2.29) HUD:\n";
   commentText += "Mode: " + g_stat_calc_mode + "\n";
   string win_mode_str = (InpWindowMode == CALC_WINDOW_FIXED_START) ? "Fix Start -> Last Bar" : "Fixed Window";
   commentText += StringFormat("Window: %s (%d bars, Max: %d)\n", win_mode_str, g_stat_window_bars, MAX_WINDOW_BARS);
   commentText += "Pipeline 1:1 Alignment: Strict (Max 8 Slots: sr_1..sr_8)\n";

   if(DistanceFromResistance != INT_MAX)
      commentText += "Distance to Resistance (sr_5): " + IntegerToString(DistanceFromResistance) + " points (" + DoubleToString(LevelAbove, _Digits) + ")\n";
   else
      commentText += "No resistance level (sr_5) found\n";

   if(DistanceFromSupport != INT_MAX)
      commentText += "Distance to Support (sr_1): " + IntegerToString(DistanceFromSupport) + " points (" + DoubleToString(LevelBelow, _Digits) + ")\n";
   else
      commentText += "No support level (sr_1) found\n";

   int act_sup = 0, act_res = 0;
   if(IsValidSRLevel(BufferThree[0])) act_sup++;
   if(IsValidSRLevel(BufferTwo[0]))   act_sup++;
   if(IsValidSRLevel(BufferOne[0]))   act_sup++;
   if(IsValidSRLevel(BufferZero[0]))  act_sup++;
   if(IsValidSRLevel(BufferFour[0]))  act_res++;
   if(IsValidSRLevel(BufferFive[0]))  act_res++;
   if(IsValidSRLevel(BufferSix[0]))   act_res++;
   if(IsValidSRLevel(BufferSeven[0])) act_res++;

   commentText += StringFormat("Exported Active Slots: %d Supports (sr_1-sr_%d) | %d Resistances (sr_5-sr_%d)",
                               act_sup, act_sup > 0 ? act_sup : 0,
                               act_res, act_res > 0 ? (4 + act_res) : 0);

   Comment(commentText);
}

//+------------------------------------------------------------------+
//| Calculate Nearest Level Above Current Price                      |
//+------------------------------------------------------------------+
double CalculateLevelAbove(double currentClose)
{
   double Level = 0;
   for(int i = 0; i < ArraySize(ArrayLevels); i++)
   {
      if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] >= currentClose)
      {
         Level = NormalizeDouble(ArrayLevels[i], _Digits);
         break;
      }
   }
   return Level;
}

//+------------------------------------------------------------------+
//| Calculate Nearest Level Below Current Price                      |
//+------------------------------------------------------------------+
double CalculateLevelBelow(double currentClose)
{
   double Level = 0;
   for(int i = ArraySize(ArrayLevels) - 1; i >= 0; i--)
   {
      if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] <= currentClose)
      {
         Level = NormalizeDouble(ArrayLevels[i], _Digits);
         break;
      }
   }
   return Level;
}

//+------------------------------------------------------------------+
//| Calculate S/R with Freedman-Diaconis Auto-Calibration            |
//+------------------------------------------------------------------+
void CalculateLevels(ENUM_TIMEFRAMES calc_tf, int start_idx, int end_idx, int window_bars)
{
   int high_shift = iHighest(_Symbol, calc_tf, MODE_HIGH, window_bars, end_idx);
   int low_shift  = iLowest(_Symbol, calc_tf, MODE_LOW, window_bars, end_idx);

   if(high_shift < 0 || low_shift < 0)
   {
      Print("ERROR: Failed to retrieve high/low shifts in window.");
      return;
   }

   double Highest = iHigh(_Symbol, calc_tf, high_shift);
   double Lowest  = iLow(_Symbol, calc_tf, low_shift);

   g_stat_highest_window = Highest;
   g_stat_lowest_window  = Lowest;
   g_stat_window_bars    = window_bars;

   // Broker->UTC offset for stats
   long _srv_off = (long)TimeTradeServer() - (long)TimeGMT();
   datetime gmt_offset = (datetime)((long)MathRound(_srv_off / 3600.0) * 3600);

   datetime t_start = iTime(_Symbol, calc_tf, start_idx);
   datetime t_end   = iTime(_Symbol, calc_tf, end_idx);
   g_stat_window_start_ts = (long)(t_start - gmt_offset);
   g_stat_window_end_ts   = (long)(t_end - gmt_offset);

   // 1. Extract all fractals formed inside the window [end_idx, start_idx]
   double fractals[];
   for(int j = end_idx; j <= start_idx; j++)
   {
      if(j < ArraySize(BufferFractalsUp) && BufferFractalsUp[j] != EMPTY_VALUE && BufferFractalsUp[j] > 0)
      {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz] = BufferFractalsUp[j];
      }
      if(j < ArraySize(BufferFractalsDown) && BufferFractalsDown[j] != EMPTY_VALUE && BufferFractalsDown[j] > 0)
      {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz] = BufferFractalsDown[j];
      }
   }

   int N = ArraySize(fractals);
   g_stat_fractals_n = N;

   double Step = 0.0;

   // 2. Derive Step Size: Freedman-Diaconis IQR rule or Manual Fallback
   if(InpAutoCalibrate && N >= 4)
   {
      ArraySort(fractals);
      double q25 = CalculatePercentile(fractals, 25.0);
      double q75 = CalculatePercentile(fractals, 75.0);
      double iqr = q75 - q25;

      g_stat_q25 = q25;
      g_stat_q75 = q75;
      g_stat_iqr = iqr;

      if(iqr > _Point)
      {
         // Freedman-Diaconis optimal bin width formula
         Step = 2.0 * iqr / MathPow((double)N, 1.0 / 3.0);
         g_stat_calc_mode = "Freedman-Diaconis IQR (Auto-Calibrated)";
      }
      else
      {
         Step = (Highest - Lowest) / 5.0;
         g_stat_calc_mode = "Auto-Calibrated (Fallback: Range/5)";
      }
   }
   else if(InpAutoCalibrate && N > 0 && N < 4)
   {
      Step = (Highest - Lowest) / 4.0;
      g_stat_calc_mode = "Auto-Calibrated (Fallback: Range/4)";
   }
   else
   {
      // Manual fallback using ATR and Multiplier
      double atr_ref = 0;
      if(end_idx < ArraySize(BufferATR) && BufferATR[end_idx] > 0)
         atr_ref = BufferATR[end_idx];
      else if(ArraySize(BufferATR) > 0 && BufferATR[0] > 0)
         atr_ref = BufferATR[0];

      if(atr_ref <= 0) atr_ref = _Point * 20;
      Step = atr_ref * AccuracyMultiplier;
      g_stat_calc_mode = "Manual ATR (Fallback)";
   }

   Step = NormalizeDouble(Step, _Digits);
   if(Step <= 0) Step = _Point * 10;
   g_stat_opt_step = Step;

   // 3. Partition into Bins and Cluster
   int Steps = (int)MathCeil((Highest - Lowest) / Step) + 1;
   if(Steps <= 0 || Steps > 10000)
   {
      Print("Invalid steps count: ", Steps);
      return;
   }

   ArrayResize(ArrayLevels, Steps);
   ArrayInitialize(ArrayLevels, 0);

   int valid_levels = 0;
   for(int i = 0; i < Steps; i++)
   {
      double StartRange = Lowest + Step * i;
      double EndRange   = Lowest + Step * (i + 1);
      int BarCount = 0;
      double TotalPrice = 0;

      for(int k = 0; k < N; k++)
      {
         if(fractals[k] >= StartRange && fractals[k] <= EndRange)
         {
            BarCount++;
            TotalPrice += fractals[k];
         }
      }

      // Filter by Min Touches (default: 1)
      if(BarCount >= InpMinFractalTouches)
      {
         ArrayLevels[i] = NormalizeDouble(TotalPrice / BarCount, _Digits);
         valid_levels++;
      }
   }
   g_stat_levels_count = valid_levels;
}

//+------------------------------------------------------------------+
//| Fill indicator plot buffers with closest 4 supports & resistances|
//+------------------------------------------------------------------+
void FillBuffers(double currentClose)
{
   BufferZero[0]  = 0;
   BufferOne[0]   = 0;
   BufferTwo[0]   = 0;
   BufferThree[0] = 0;
   BufferFour[0]  = 0;
   BufferFive[0]  = 0;
   BufferSix[0]   = 0;
   BufferSeven[0] = 0;

   // Fill resistance levels (above current close)
   int j = 0;
   for(int i = 0; i < ArraySize(ArrayLevels); i++)
   {
      if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] > currentClose)
      {
         switch(j)
         {
            case 0: BufferFour[0]  = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 1: BufferFive[0]  = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 2: BufferSix[0]   = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 3: BufferSeven[0] = NormalizeDouble(ArrayLevels[i], _Digits); break;
         }
         j++;
         if(j == 4) break;
      }
   }

   // Fill support levels (below current close - reverse order for closest first)
   j = 0;
   for(int i = ArraySize(ArrayLevels) - 1; i >= 0; i--)
   {
      if(IsValidSRLevel(ArrayLevels[i]) && ArrayLevels[i] < currentClose)
      {
         switch(j)
         {
            case 0: BufferThree[0] = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 1: BufferTwo[0]   = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 2: BufferOne[0]   = NormalizeDouble(ArrayLevels[i], _Digits); break;
            case 3: BufferZero[0]  = NormalizeDouble(ArrayLevels[i], _Digits); break;
         }
         j++;
         if(j == 4) break;
      }
   }
}

//+------------------------------------------------------------------+
//| Calculation iteration                                            |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   // THE INTRA-BAR GATE.
   //
   // This used to open with:
   //
   //     if (prev_calculated > 0 && rates_total == prev_calculated)
   //        return rates_total;
   //
   // `rates_total` only differs from `prev_calculated` when a NEW BAR opens, so
   // that returned on every tick inside a forming bar and the whole body below
   // ran at most once per bar. Three consequences, all live:
   //
   //   * FillBuffers() never re-slotted sr_1..sr_8 as price crossed a level, so
   //     the eight buffers and the on-chart slot tags were a bar stale.
   //   * LevelAbove / LevelBelow / the two point distances -- and therefore the
   //     g_stat_* fields the statistic file publishes -- were a bar stale.
   //   * The `MathAbs(lastClose - close[0]) > Point()` branch of
   //     needsRecalculation below was unreachable: by the time control got
   //     here a new bar had opened, so the `lastCalculationTime != time[0]`
   //     branch had already fired. Dead code guarding dead code.
   //
   // The gate is now applied where the cost actually is rather than across the
   // whole function. Two paths:
   //
   //   EXPENSIVE (first run / new bar only): CopyBuffer of up to InpExportBars
   //     fractal + ATR values, and CalculateLevels()'s Freedman-Diaconis
   //     clustering. This is what the early return existed to protect and it
   //     still is protected.
   //
   //   CHEAP (every tick): re-slot the levels already resolved in ArrayLevels
   //     against the live close. All of it is a linear scan of ArrayLevels,
   //     which holds the macro clusters -- tens of entries, not thousands.
   //
   // Note the expensive path is not merely an optimisation: re-clustering
   // intra-bar would be WRONG. ArrayLevels is built from iFractals, and a
   // fractal needs confirmed bars on both sides, so the forming bar can never
   // be one. The level SET genuinely cannot change within a bar; only which
   // levels sit above and below the live close can, and that is exactly what
   // the cheap path recomputes.
   //
   // File exports are unaffected and keep their bar-close guarantee: they are
   // driven by OnTimer() at InpExportSecond and by the EXPORT_ALL broadcast,
   // never from here.
   ArraySetAsSeries(close, true);
   ArraySetAsSeries(time, true);

   bool first_run = (prev_calculated == 0);
   bool new_bar   = (rates_total != prev_calculated);

   ENUM_TIMEFRAMES calc_tf = (SRTimeframe == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : SRTimeframe;
   int total_bars = iBars(_Symbol, calc_tf);
   if(total_bars <= 10)
   {
      Print("Not enough historical data on ", EnumToString(calc_tf));
      return 0;
   }

   // ================================================================
   // EXPENSIVE PATH -- first run, or a new bar has opened
   // ================================================================
   // `lastCalculationTime != time[0]` is kept alongside `new_bar` rather than
   // folded into it: MT5 can call OnCalculate with prev_calculated == rates_total
   // after a history refresh or a symbol-data reload, where the bar array has
   // genuinely changed underneath us but the counts have not. It is one datetime
   // comparison, so carrying both costs nothing and closes that case.
   static datetime lastCalculationTime = 0;

   if(first_run || new_bar || lastCalculationTime != time[0])
   {
      // Resolve date anchors to bar shifts based on selected InpWindowMode
      int idx1 = iBarShift(_Symbol, calc_tf, InpStartDateTime, false);
      int idx2 = 0; // Default to current/last bar (shift 0) for CALC_WINDOW_FIXED_START

      if(InpWindowMode == CALC_WINDOW_FIXED_RANGE)
      {
         idx2 = iBarShift(_Symbol, calc_tf, InpEndDateTime, false);
      }

      if(idx1 < 0) idx1 = total_bars - 1;
      if(idx2 < 0) idx2 = 0;

      int start_idx = MathMin(total_bars - 1, MathMax(idx1, idx2)); // Older bar (higher index)
      int end_idx   = MathMax(0, MathMin(idx1, idx2));              // Newer bar (lower index)

      // Cap calculation window to at most MAX_WINDOW_BARS (3000 bars) for both modes
      if((start_idx - end_idx + 1) > MAX_WINDOW_BARS)
      {
         start_idx = end_idx + MAX_WINDOW_BARS - 1;
      }

      int window_bars = start_idx - end_idx + 1;

      if(window_bars < 5)
      {
         Print("Window range too small (bars: ", window_bars, "). Check date settings.");
         return 0;
      }

      int bars_needed = MathMax(start_idx + 1, InpExportBars);
      if(bars_needed > total_bars) bars_needed = total_bars;

      // Copy buffer data. This is the cost the old blanket early return was
      // really protecting -- up to InpExportBars values, three times over.
      if (CopyBuffer(FractalsHandle, 0, 0, bars_needed, BufferFractalsUp) <= 0 ||
          CopyBuffer(FractalsHandle, 1, 0, bars_needed, BufferFractalsDown) <= 0 ||
          CopyBuffer(ATRHandle, 0, 0, bars_needed, BufferATR) <= 0)
      {
         if(!Waiting)
         {
            Print("Waiting for indicator data to load...");
            Waiting = true;
         }
         // Returning prev_calculated (not 0) asks MT5 to call again on the next
         // tick without discarding what is already calculated. lastCalculationTime
         // is deliberately NOT advanced, so the retry re-enters this block.
         return prev_calculated;
      }

      if(Waiting)
      {
         Print("Indicator data loaded successfully.");
         Waiting = false;
      }

      CalculateLevels(calc_tf, start_idx, end_idx, window_bars);
      lastCalculationTime = time[0];
   }

   // ================================================================
   // CHEAP PATH -- every tick, including inside a forming bar
   // ================================================================
   // Nothing below rebuilds ArrayLevels; it re-reads the levels already resolved
   // above against the live close. That is precisely the intra-bar behaviour the
   // old early return suppressed: as price crosses a level, the slot assignment
   // (which level is sr_1 vs sr_5) changes even though the level set does not.

   // Update buffers with closest levels
   FillBuffers(close[0]);

   // Calculate nearest levels and distances
   LevelAbove = CalculateLevelAbove(close[0]);
   LevelBelow = CalculateLevelBelow(close[0]);

   if (LevelAbove > 0)
      DistanceFromResistance = int((LevelAbove - close[0]) / _Point);
   else
      DistanceFromResistance = INT_MAX;

   if (LevelBelow > 0)
      DistanceFromSupport = int((close[0] - LevelBelow) / _Point);
   else
      DistanceFromSupport = INT_MAX;

   g_stat_nearest_resist  = LevelAbove;
   g_stat_nearest_support = LevelBelow;
   g_stat_dist_resist     = DistanceFromResistance;
   g_stat_dist_support    = DistanceFromSupport;

   DisplayDistanceComments();

   // THE CROSSING CHECK.
   //
   // A change in the active pair (LevelAbove, LevelBelow) between two ticks of
   // the same bar means exactly one thing: price crossed a level. The level set
   // is fixed within a bar (see the intra-bar gate note above), so the pair can
   // only change because the live close moved past one of them.
   //
   // This condition already existed, but it was unreachable intra-bar behind the
   // old early return, so it only ever fired on `prevTagBarTime != time[0]` --
   // i.e. it was a new-bar redraw, never a crossing detector. It is one now.
   static double   prevLevelAbove = 0;
   static double   prevLevelBelow = 0;
   static datetime prevTagBarTime = 0;

   bool level_pair_changed = (prevLevelAbove != LevelAbove || prevLevelBelow != LevelBelow);
   bool new_tag_bar        = (prevTagBarTime != time[0]);

   if (level_pair_changed || new_tag_bar)
   {
      // A crossing WITHIN a bar is the event; on a new bar the pair routinely
      // changes for uninteresting reasons, so it is not reported as one.
      if (level_pair_changed && !new_tag_bar && !first_run)
      {
         Print(StringFormat(
            "S&R crossing at %s: close=%s  sr_5(above)=%s  sr_1(below)=%s",
            TimeToString(time[0], TIME_DATE | TIME_MINUTES),
            DoubleToString(close[0], _Digits),
            LevelAbove > 0 ? DoubleToString(LevelAbove, _Digits) : "none",
            LevelBelow > 0 ? DoubleToString(LevelBelow, _Digits) : "none"));
      }

      if (DrawLinesEnabled)
         DrawLines(close[0]);

      // Advanced unconditionally, outside the DrawLinesEnabled branch. They
      // track observed state, not drawn state -- left inside, a chart with
      // drawing off would re-evaluate and re-log the same crossing on every
      // subsequent tick.
      prevLevelAbove = LevelAbove;
      prevLevelBelow = LevelBelow;
      prevTagBarTime = time[0];
   }

   return rates_total;
}

//+------------------------------------------------------------------+
//| Timer event — automated export (Stack C pipeline loop)           |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!InpAutoExport) return;

   MqlDateTime time_struct;
   TimeToStruct(TimeLocal(), time_struct);
   static int last_trigger_min = -1;

   if(time_struct.sec == InpExportSecond && time_struct.min != last_trigger_min)
   {
      last_trigger_min = time_struct.min;
      if(ExportSRData())
         Print("SUCCESS: [Auto Export] Support and Resistance data exported");
      else
         Print("ERROR: [Auto Export] Failed to export SR data.");
   }
}

//+------------------------------------------------------------------+
//| Chart events: Button click and EXPORT_ALL broadcast              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   // Stack C Centralized broadcast trigger from EA
   if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
   {
      if(ExportSRData())
         Print("SUCCESS: [Export All] Support and Resistance exported");
      else
         Print("ERROR: [Export All] Failed to export SR levels.");
      return;
   }

   // On-chart Button clicks
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == EXPORT_BUTTON_NAME)
      {
         if(ExportSRData())
            Print("SUCCESS: [Manual Export] Support and Resistance levels exported successfully");
         else
            Print("ERROR: [Manual Export] Failed to export SR levels.");

         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
         ChartRedraw(0);
      }
      else if(sparam == BACKFILL_BUTTON_NAME)
      {
         // Reports the depth actually used, not InpExportBars. The old message
         // named the pipeline depth while the call did the same thing as
         // Export, so it described neither what it was about to do nor what it
         // had done.
         Print("Starting backfill export (",
               InpBackfillBars > 0 ? IntegerToString(InpBackfillBars)
                                   : "all loaded",
               " bars) to a separate _Backfill file - the pipeline export is untouched...");
         if(ExportSRData(true))
            Print("SUCCESS: [Backfill Export] Completed successfully!");
         else
            Print("ERROR: [Backfill Export] Failed to backfill export.");

         ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_STATE, false);
         ChartRedraw(0);
      }
   }
}

//+------------------------------------------------------------------+
//| Deinitialization                                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(InpAutoExport)
      EventKillTimer();

   CleanChart();
   Comment("");

   if(ATRHandle != INVALID_HANDLE)
   {
      IndicatorRelease(ATRHandle);
      ATRHandle = INVALID_HANDLE;
   }
   if(FractalsHandle != INVALID_HANDLE)
   {
      IndicatorRelease(FractalsHandle);
      FractalsHandle = INVALID_HANDLE;
   }

   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
      ObjectDelete(0, EXPORT_BUTTON_NAME);
   if(ObjectFind(0, BACKFILL_BUTTON_NAME) >= 0)
      ObjectDelete(0, BACKFILL_BUTTON_NAME);
}
//+------------------------------------------------------------------+
