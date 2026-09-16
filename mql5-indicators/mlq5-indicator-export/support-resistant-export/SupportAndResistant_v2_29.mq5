//+------------------------------------------------------------------+
//|                                    SupportAndResistant_v2_29.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//| Description: Dynamic S/R Levels with Fixed Date Anchors (v2.29)  |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, MetaQuotes Ltd."
#property link        "https://www.mql5.com"
#property version     "2.29"
#property description "Support & Resistance at Significant Levels with Fixed Date Anchors & Stack C Auto-Export"
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
#define EXPORT_BUTTON_NAME   "SRExportButton_v2_29"
#define BACKFILL_BUTTON_NAME "SRBackfillButton_v2_29"

//+------------------------------------------------------------------+
//| Input parameters                                                 |
//+------------------------------------------------------------------+
input group "===== Window Period (Fixed Anchors) ====="
input datetime InpStartDateTime = D'2026.06.04 14:20'; // Window Start Date/Time
input datetime InpEndDateTime   = D'2026.06.08 07:45'; // Window End Date/Time

input group "===== Support & Resistance Calculation Settings ====="
input ENUM_TIMEFRAMES SRTimeframe = PERIOD_CURRENT;    // Timeframe to Analyze
input double AccuracyMultiplier   = 4.0;               // Accuracy Multiplier (eg: 1.0-4.0)
input int    ATRPeriod            = 162;               // ATR Period
input int    SafeDistance         = 50;                // Safety Distance From Closest Level (points)
input int    MaxRange             = 0;                 // Max Price Range to Analyze (points) (0=No Limit)

input group "===== Draw Line Settings ====="
input bool            DrawLinesEnabled = true;                 // Draw Lines
input int             LineThickness    = 1;                    // Line Thickness (1-5)
input ENUM_LINE_STYLE ResistanceStyle  = STYLE_DASHDOTDOT;     // Resistance Line Style
input ENUM_LINE_STYLE SupportStyle     = STYLE_DASHDOTDOT;     // Support Line Style
input color           ResistanceColor  = clrRed;               // Resistance Color
input color           SupportColor     = clrGreen;             // Support Color

input group "===== Stack C Pipeline & Export Settings ====="
input string InpExportFileName       = "SR_Levels";           // Export file prefix ({Prefix}_{Symbol}_{TF}.txt)
input bool   InpIncludeHeader        = true;                  // Include TSV header
input bool   InpAutoExport           = true;                  // Automated export every minute at InpExportSecond
input int    InpExportSecond         = 59;                    // Export trigger second (0-59)
input int    InpExportBars           = 3000;                  // Bars to export (matches 3000-bar pipeline depth)
input bool   InpEnableExportButton   = true;                  // Enable on-chart manual export button
input bool   InpEnableBackfillButton = true;                  // Enable on-chart backfill button
input string IndicatorName           = "MQLTA-SR-v2_29";      // Object Prefix / Indicator Name

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
int    g_stat_window_bars     = 0;
long   g_stat_window_start_ts = 0;
long   g_stat_window_end_ts   = 0;
int    g_stat_levels_count    = 0;
double g_stat_nearest_support = 0.0;
double g_stat_nearest_resist  = 0.0;
int    g_stat_dist_support    = INT_MAX;
int    g_stat_dist_resist     = INT_MAX;
double g_stat_highest_window  = 0.0;
double g_stat_lowest_window   = 0.0;
double g_stat_atr_step        = 0.0;

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
//| Generate standardized export filename                            |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe)
{
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");

   return StringFormat("%s_%s_%s.txt", base_name, clean_symbol, tf_str);
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

   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export SR Levels");
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

   ObjectSetString(0, BACKFILL_BUTTON_NAME, OBJPROP_TEXT, "Backfill Export");
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

   FileWriteString(fh, "[SUPPORT-RESISTANCE - PARAMETERS]\r\n");
   FileWriteString(fh, "Window Start TS (UTC): " + IntegerToString(g_stat_window_start_ts) + "\r\n");
   FileWriteString(fh, "Window End TS (UTC): "   + IntegerToString(g_stat_window_end_ts) + "\r\n");
   FileWriteString(fh, "Window Bars: "            + IntegerToString(g_stat_window_bars) + "\r\n");
   FileWriteString(fh, "Accuracy Multiplier: "    + DoubleToString(AccuracyMultiplier, 2) + "\r\n");
   FileWriteString(fh, "ATR Period: "             + IntegerToString(ATRPeriod) + "\r\n");
   FileWriteString(fh, "ATR Step: "               + DoubleToString(g_stat_atr_step, _Digits) + "\r\n");
   FileWriteString(fh, "Highest High: "           + DoubleToString(g_stat_highest_window, _Digits) + "\r\n");
   FileWriteString(fh, "Lowest Low: "             + DoubleToString(g_stat_lowest_window, _Digits) + "\r\n");
   FileWriteString(fh, "\r\n");

   FileWriteString(fh, "[SUPPORT-RESISTANCE - RESOLVED LEVELS]\r\n");
   FileWriteString(fh, "Total Levels: "           + IntegerToString(g_stat_levels_count) + "\r\n");
   FileWriteString(fh, "Nearest Resistance: "     + (g_stat_nearest_resist > 0 ? DoubleToString(g_stat_nearest_resist, _Digits) : "") + "\r\n");
   FileWriteString(fh, "Nearest Support: "        + (g_stat_nearest_support > 0 ? DoubleToString(g_stat_nearest_support, _Digits) : "") + "\r\n");
   FileWriteString(fh, "Distance to Resistance: " + (g_stat_dist_resist != INT_MAX ? IntegerToString(g_stat_dist_resist) : "") + "\r\n");
   FileWriteString(fh, "Distance to Support: "    + (g_stat_dist_support != INT_MAX ? IntegerToString(g_stat_dist_support) : "") + "\r\n");

   FileClose(fh);
}

//+------------------------------------------------------------------+
//| Export Support & Resistance Levels (Stack C Pipeline TSV)        |
//+------------------------------------------------------------------+
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

   string filename = GenerateFilename(InpExportFileName, clean_symbol, timeframe);

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

   int available_bars = iBars(symbol, timeframe);
   int export_limit   = MathMin(InpExportBars, available_bars - 1);
   if(export_limit < 0) export_limit = 0;

   // 3. Export rows from oldest bar down to bar 0 (live bar)
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

      // Unresolved levels export as empty string "" -> staged as NULL
      string support_1_str = (sr_support_1 <= 0.0) ? "" : DoubleToString(sr_support_1, 2);
      string support_2_str = (sr_support_2 <= 0.0) ? "" : DoubleToString(sr_support_2, 2);
      string support_3_str = (sr_support_3 <= 0.0) ? "" : DoubleToString(sr_support_3, 2);
      string support_4_str = (sr_support_4 <= 0.0) ? "" : DoubleToString(sr_support_4, 2);

      string resist_1_str  = (sr_resistance_1 <= 0.0) ? "" : DoubleToString(sr_resistance_1, 2);
      string resist_2_str  = (sr_resistance_2 <= 0.0) ? "" : DoubleToString(sr_resistance_2, 2);
      string resist_3_str  = (sr_resistance_3 <= 0.0) ? "" : DoubleToString(sr_resistance_3, 2);
      string resist_4_str  = (sr_resistance_4 <= 0.0) ? "" : DoubleToString(sr_resistance_4, 2);

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

   // Write companion audit statistic file
   WriteSRStatFile(clean_symbol, tf_str);

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
   // (levels are cleanly displayed via OBJ_HLINE objects)
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
//| Clean horizontal lines                                           |
//+------------------------------------------------------------------+
void CleanLines()
{
   ObjectsDeleteAll(0, IndicatorName + "-HLINE-");
}

//+------------------------------------------------------------------+
//| Draw horizontal lines on chart                                   |
//+------------------------------------------------------------------+
void DrawLines(double currentClose)
{
   CleanLines();

   for(int i = 0; i < ArraySize(ArrayLevels); i++)
   {
      if(IsValidSRLevel(ArrayLevels[i]))
      {
         int LineNumber = int(ArrayLevels[i] / _Point);
         string LineName = IndicatorName + "-HLINE-" + IntegerToString(LineNumber);

         bool isResistance = (ArrayLevels[i] > currentClose);
         color Color       = isResistance ? ResistanceColor : SupportColor;
         ENUM_LINE_STYLE Style = isResistance ? ResistanceStyle : SupportStyle;

         ObjectCreate(0, LineName, OBJ_HLINE, 0, 0, ArrayLevels[i]);
         ObjectSetInteger(0, LineName, OBJPROP_COLOR, Color);
         ObjectSetInteger(0, LineName, OBJPROP_STYLE, Style);
         ObjectSetInteger(0, LineName, OBJPROP_WIDTH, LineThickness);
         ObjectSetInteger(0, LineName, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, LineName, OBJPROP_RAY_RIGHT, true);
      }
   }
}

//+------------------------------------------------------------------+
//| Display distance HUD comments                                    |
//+------------------------------------------------------------------+
void DisplayDistanceComments()
{
   string commentText = "Support & Resistance (v2.29) Distance HUD:\n";

   if(DistanceFromResistance != INT_MAX)
      commentText += "Distance to Resistance: " + IntegerToString(DistanceFromResistance) + " points\n";
   else
      commentText += "No resistance level found\n";

   if(DistanceFromSupport != INT_MAX)
      commentText += "Distance to Support: " + IntegerToString(DistanceFromSupport) + " points";
   else
      commentText += "No support level found";

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
//| Calculate Support & Resistance Levels inside Fixed Window        |
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

   // Reference ATR for step calculation: ATR at end_idx if available, else BufferATR[0]
   double atr_ref = 0;
   if(end_idx < ArraySize(BufferATR) && BufferATR[end_idx] > 0)
      atr_ref = BufferATR[end_idx];
   else if(ArraySize(BufferATR) > 0 && BufferATR[0] > 0)
      atr_ref = BufferATR[0];

   if(atr_ref <= 0)
   {
      Print("Not enough historical ATR data.");
      return;
   }

   double Step = NormalizeDouble(atr_ref * AccuracyMultiplier, _Digits);
   if(Step <= 0) Step = _Point * 10;
   g_stat_atr_step = Step;

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

      // Strictly scan fractals within the fixed window [end_idx, start_idx]
      for(int j = end_idx; j <= start_idx; j++)
      {
         double Fractal = 0;
         if(j < ArraySize(BufferFractalsUp) && BufferFractalsUp[j] != EMPTY_VALUE && BufferFractalsUp[j] > 0)
            Fractal = BufferFractalsUp[j];
         else if(j < ArraySize(BufferFractalsDown) && BufferFractalsDown[j] != EMPTY_VALUE && BufferFractalsDown[j] > 0)
            Fractal = BufferFractalsDown[j];

         if(Fractal >= StartRange && Fractal <= EndRange)
         {
            BarCount++;
            TotalPrice += Fractal;
         }
      }

      if(BarCount > 0)
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
   if (prev_calculated > 0 && rates_total == prev_calculated)
      return rates_total;

   ArraySetAsSeries(close, true);
   ArraySetAsSeries(time, true);

   ENUM_TIMEFRAMES calc_tf = (SRTimeframe == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : SRTimeframe;
   int total_bars = iBars(_Symbol, calc_tf);
   if(total_bars <= 10)
   {
      Print("Not enough historical data on ", EnumToString(calc_tf));
      return 0;
   }

   // Resolve date anchors to bar shifts
   int idx1 = iBarShift(_Symbol, calc_tf, InpStartDateTime, false);
   int idx2 = iBarShift(_Symbol, calc_tf, InpEndDateTime, false);

   if(idx1 < 0) idx1 = total_bars - 1;
   if(idx2 < 0) idx2 = 0;

   int start_idx   = MathMin(total_bars - 1, MathMax(idx1, idx2)); // Older bar (higher index)
   int end_idx     = MathMax(0, MathMin(idx1, idx2));              // Newer bar (lower index)
   int window_bars = start_idx - end_idx + 1;

   if(window_bars < 5)
   {
      Print("Window range too small (bars: ", window_bars, "). Check InpStartDateTime and InpEndDateTime.");
      return 0;
   }

   int bars_needed = MathMax(start_idx + 1, InpExportBars);
   if(bars_needed > total_bars) bars_needed = total_bars;

   // Copy buffer data
   if (CopyBuffer(FractalsHandle, 0, 0, bars_needed, BufferFractalsUp) <= 0 ||
       CopyBuffer(FractalsHandle, 1, 0, bars_needed, BufferFractalsDown) <= 0 ||
       CopyBuffer(ATRHandle, 0, 0, bars_needed, BufferATR) <= 0)
   {
      if(!Waiting)
      {
         Print("Waiting for indicator data to load...");
         Waiting = true;
      }
      return prev_calculated;
   }

   if(Waiting)
   {
      Print("Indicator data loaded successfully.");
      Waiting = false;
   }

   static datetime lastCalculationTime = 0;
   static double   lastClose = 0;

   bool needsRecalculation = false;
   if (prev_calculated == 0)
      needsRecalculation = true;
   else if (lastCalculationTime != time[0])
      needsRecalculation = true;
   else if (MathAbs(lastClose - close[0]) > Point())
      needsRecalculation = true;

   if (needsRecalculation)
   {
      CalculateLevels(calc_tf, start_idx, end_idx, window_bars);
      lastCalculationTime = time[0];
      lastClose = close[0];
   }

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

   // Draw lines only when levels change
   static double prevLevelAbove = 0;
   static double prevLevelBelow = 0;

   if (prevLevelAbove != LevelAbove || prevLevelBelow != LevelBelow)
   {
      if (DrawLinesEnabled)
      {
         DrawLines(close[0]);
         prevLevelAbove = LevelAbove;
         prevLevelBelow = LevelBelow;
      }
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
         Print("Starting backfill export for ", InpExportBars, " historical bars...");
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
