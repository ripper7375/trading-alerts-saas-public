//+------------------------------------------------------------------+
//|                          Z-Score_OHLC_Candle_V2_EXPORT.mq5       |
//|                             Copyright 2024, Your Name             |
//|                                     https://www.yourwebsite.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "Z-Score OHLC Candle Indicator with Data Export"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 7
#property indicator_plots   1
#property indicator_type1   DRAW_COLOR_CANDLES

// Input parameters
input int    InpZScoreLength  = 432;           // Z-Score MA Length
input double InpThresholdZ1   = 1.5;           // First threshold (Large)
input double InpThresholdZ2   = 2.5;           // Second threshold (Extreme)
input int    InpCandleWidth   = 3;             // Candle Width (1-5)
input color  InpColorUpNormal = clrNONE;       // Up Normal Color
input color  InpColorUpLarge  = clrLightGreen; // Up Large Color (Light Green)
input color  InpColorUpExtreme = clrGreen;     // Up Extreme Color
input color  InpColorDownNormal = clrNONE;     // Down Normal Color
input color  InpColorDownLarge = clrHotPink;   // Down Large Color (Light Pink)
input color  InpColorDownExtreme = clrFireBrick; // Down Extreme Color

// Export settings
input int    InpMaxBarsExport = 500;         // Max Bars to Export (0 = all)
input color  InpBtnColor      = clrDodgerBlue; // Export Button Color
input color  InpBtnTextColor  = clrWhite;      // Export Button Text Color

// Indicator buffers
double OpenBuffer[];      // Open prices
double HighBuffer[];      // High prices
double LowBuffer[];       // Low prices
double CloseBuffer[];     // Close prices
double ColorBuffer[];     // Color index
double BodySizeBuffer[];  // Candle body sizes
double ZScoreBuffer[];    // Z-Score values

// Button name
#define BTN_EXPORT "btnExportData"

// Enumeration for candle classifications
enum CANDLE_TYPE {
    TYPE_UP_NORMAL = 0,
    TYPE_UP_LARGE = 1,
    TYPE_UP_EXTREME = 2,
    TYPE_DOWN_NORMAL = 3,
    TYPE_DOWN_LARGE = 4,
    TYPE_DOWN_EXTREME = 5
};

//+------------------------------------------------------------------+
//| Create export button on chart                                     |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   // Delete if already exists
   ObjectDelete(0, BTN_EXPORT);

   long chartWidth = ChartGetInteger(0, CHART_WIDTH_IN_PIXELS);

   int btnWidth  = 130;
   int btnHeight = 30;
   int btnX      = (int)(chartWidth - btnWidth - 15);
   int btnY      = 50;

   ObjectCreate(0, BTN_EXPORT, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_XDISTANCE, btnX);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_YDISTANCE, btnY);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_XSIZE, btnWidth);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_YSIZE, btnHeight);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, BTN_EXPORT, OBJPROP_TEXT, "Export Data");
   ObjectSetString(0, BTN_EXPORT, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_FONTSIZE, 10);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_COLOR, InpBtnTextColor);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_BGCOLOR, InpBtnColor);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_BORDER_COLOR, InpBtnColor);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_STATE, false);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, BTN_EXPORT, OBJPROP_ZORDER, 10);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Get timeframe string                                              |
//+------------------------------------------------------------------+
string GetTimeframeString()
{
   ENUM_TIMEFRAMES tf = Period();
   switch(tf)
   {
      case PERIOD_M1:  return "PERIOD_M1";
      case PERIOD_M2:  return "PERIOD_M2";
      case PERIOD_M3:  return "PERIOD_M3";
      case PERIOD_M4:  return "PERIOD_M4";
      case PERIOD_M5:  return "PERIOD_M5";
      case PERIOD_M6:  return "PERIOD_M6";
      case PERIOD_M10: return "PERIOD_M10";
      case PERIOD_M12: return "PERIOD_M12";
      case PERIOD_M15: return "PERIOD_M15";
      case PERIOD_M20: return "PERIOD_M20";
      case PERIOD_M30: return "PERIOD_M30";
      case PERIOD_H1:  return "PERIOD_H1";
      case PERIOD_H2:  return "PERIOD_H2";
      case PERIOD_H3:  return "PERIOD_H3";
      case PERIOD_H4:  return "PERIOD_H4";
      case PERIOD_H6:  return "PERIOD_H6";
      case PERIOD_H8:  return "PERIOD_H8";
      case PERIOD_H12: return "PERIOD_H12";
      case PERIOD_D1:  return "PERIOD_D1";
      case PERIOD_W1:  return "PERIOD_W1";
      case PERIOD_MN1: return "PERIOD_MN1";
      default:         return "PERIOD_UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Get timeframe short string for filename                           |
//+------------------------------------------------------------------+
string GetTimeframeShort()
{
   ENUM_TIMEFRAMES tf = Period();
   switch(tf)
   {
      case PERIOD_M1:  return "M1";
      case PERIOD_M2:  return "M2";
      case PERIOD_M3:  return "M3";
      case PERIOD_M4:  return "M4";
      case PERIOD_M5:  return "M5";
      case PERIOD_M6:  return "M6";
      case PERIOD_M10: return "M10";
      case PERIOD_M12: return "M12";
      case PERIOD_M15: return "M15";
      case PERIOD_M20: return "M20";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2";
      case PERIOD_H3:  return "H3";
      case PERIOD_H4:  return "H4";
      case PERIOD_H6:  return "H6";
      case PERIOD_H8:  return "H8";
      case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1";
      case PERIOD_W1:  return "W1";
      case PERIOD_MN1: return "MN1";
      default:         return "UNK";
   }
}

//+------------------------------------------------------------------+
//| Export data to text file                                         |
//+------------------------------------------------------------------+
void ExportData()
{
   int totalBars = Bars(_Symbol, Period());
   if(totalBars < InpZScoreLength)
   {
      // Changed from Alert() to Print() for silence
      Print("Not enough bars to export. Need at least ", InpZScoreLength, " bars.");
      return;
   }

   // Build filename: ZScore_SYMBOL_TIMEFRAME.txt
   string clean_symbol = _Symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
      
   string filename = "ZScore_" + clean_symbol + "_" + GetTimeframeShort() + ".txt";
   
   int fileHandle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI, '\t');
   
   if(fileHandle == INVALID_HANDLE)
   {
      // Changed from Alert() to Print() for silence
      Print("Failed to open file for writing: ", filename, " Error: ", GetLastError());
      return;
   }

   // UPDATED: New column headers with "z-score_" prefixes
   FileWrite(fileHandle,
      "z-score_timestamp", "z-score_symbol", "z-score_timeframe",
      "z-score_close", "z-score_open", "z-score_high", "z-score_low",
      "body_direction", "body_size", "body_classification");
      
   // FIX 2: Use GetTimeframeShort() to produce "M5" style value (not "PERIOD_M5")
   string tfString = GetTimeframeShort();
   
   // Determine export range in shift terms (shift 0 = newest, maxShift = oldest valid)
   int maxShift = totalBars - 1 - InpZScoreLength;
   
   // Apply max bars limit
   if(InpMaxBarsExport > 0 && maxShift + 1 > InpMaxBarsExport)
      maxShift = InpMaxBarsExport - 1;
      
   // FIX 3: Compute broker-to-UTC offset once before the loop
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   
   // FIX 5: Loop oldest first (i = bar shift; bars-1 = oldest, 0 = newest)
   int bars = maxShift + 1;
   
   int rowNo = 0;
   for(int i = bars-1; i >= 0; i--)
   {
      int bufIdx = totalBars - 1 - i;
      
      // Skip bars where buffers have no data
      if(OpenBuffer[bufIdx] == 0 && HighBuffer[bufIdx] == 0 && LowBuffer[bufIdx] == 0 && CloseBuffer[bufIdx] == 0)
         continue;
         
      // FIX 4: body_direction as integer (1 = bullish, -1 = bearish, 0 = doji)
      int dir = (CloseBuffer[bufIdx] > OpenBuffer[bufIdx]) ?
      1 : (CloseBuffer[bufIdx] < OpenBuffer[bufIdx]) ? -1 : 0;

      // Z-Score (absolute value)
      double zScore = MathAbs(ZScoreBuffer[bufIdx]);
      
      // Candle classification (integer 0-5)
      int classification = (int)ColorBuffer[bufIdx];
      
      // FIX 3: UTC Unix integer timestamp
      long ts = (long)(iTime(Symbol(), Period(), i) - gmt_offset);
      
      // FIX 1: No row counter written; FIX 2: column order matches new header
      FileWrite(fileHandle,
         IntegerToString(ts),
         _Symbol,
         tfString,
         DoubleToString(CloseBuffer[bufIdx], _Digits),
         DoubleToString(OpenBuffer[bufIdx], _Digits),
         DoubleToString(HighBuffer[bufIdx], _Digits),
         DoubleToString(LowBuffer[bufIdx], _Digits),
         IntegerToString(dir),
         DoubleToString(zScore, 5),
         IntegerToString(classification));

      rowNo++;
   }

   FileClose(fileHandle);
   string fullPath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   
   // UPDATED: Changed from Alert() to Print() to remove the pop-up and sound effect
   Print("Data exported successfully! Rows: ", rowNo, " | File: ", filename);
}

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   // Validate input parameters
   if(InpCandleWidth < 1 || InpCandleWidth > 5)
   {
      Print("Error: Candle width must be between 1 and 5. Using default value 3.");
   }

   // Indicator buffers mapping
   SetIndexBuffer(0, OpenBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, HighBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, LowBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, CloseBuffer, INDICATOR_DATA);
   SetIndexBuffer(4, ColorBuffer, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(5, BodySizeBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(6, ZScoreBuffer, INDICATOR_CALCULATIONS);

   // Initialize buffers
   ArrayInitialize(OpenBuffer, 0);
   ArrayInitialize(HighBuffer, 0);
   ArrayInitialize(LowBuffer, 0);
   ArrayInitialize(CloseBuffer, 0);
   ArrayInitialize(ColorBuffer, 0);
   ArrayInitialize(BodySizeBuffer, 0);
   ArrayInitialize(ZScoreBuffer, 0);

   // Set indicator properties
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

   // Set candle thickness
   int candleWidth = (InpCandleWidth >= 1 && InpCandleWidth <= 5) ? InpCandleWidth : 3;
   PlotIndexSetInteger(0, PLOT_LINE_WIDTH, candleWidth);

   // Set up colors
   PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 6);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_NORMAL, InpColorUpNormal);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_LARGE, InpColorUpLarge);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_EXTREME, InpColorUpExtreme);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_NORMAL, InpColorDownNormal);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_LARGE, InpColorDownLarge);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_EXTREME, InpColorDownExtreme);

   // Set indicator name
   string short_name = StringFormat("Z-Score OHLC Candle (%d) [EXPORT]", InpZScoreLength);
   IndicatorSetString(INDICATOR_SHORTNAME, short_name);

   // Enable chart events for button click
   ChartSetInteger(0, CHART_EVENT_OBJECT_CREATE, true);
   
   // --- ADD THIS LINE TO CREATE THE BUTTON ---
   CreateExportButton();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                        |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Remove export button from chart
   ObjectDelete(0, BTN_EXPORT);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Chart event handler                                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   //--- Handle "Export All" custom event from EA
   if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
   {
      ExportData();
      Print("SUCCESS: [Export All] Z-Score OHLC data exported successfully");
      return;
   }

   // Handle button click
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == BTN_EXPORT)
      {
         // Reset button state (un-press it)
         ObjectSetInteger(0, BTN_EXPORT, OBJPROP_STATE, false);
         ChartRedraw(0);

         // Perform data export
         ExportData();
      }
   }

   // Reposition button on chart resize
   if(id == CHARTEVENT_CHART_CHANGE)
   {
      long chartWidth = ChartGetInteger(0, CHART_WIDTH_IN_PIXELS);
      int btnWidth = 130;
      int btnX = (int)(chartWidth - btnWidth - 15);
      ObjectSetInteger(0, BTN_EXPORT, OBJPROP_XDISTANCE, btnX);
      ChartRedraw(0);
   }
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
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
   // Check for minimum number of bars
   if(rates_total < InpZScoreLength)
      return 0;

   // Calculate start position
   int start;
   if(prev_calculated == 0)
      start = InpZScoreLength;
   else
      start = prev_calculated - 1;

   // Calculate body sizes and statistics
   CalculateBodySizeStats(rates_total, start, open, high, low, close);

   return(rates_total);
}

//+------------------------------------------------------------------+
//| Calculate body sizes and their statistics                        |
//+------------------------------------------------------------------+
void CalculateBodySizeStats(const int rates_total,
                           const int start,
                           const double &open[],
                           const double &high[],
                           const double &low[],
                           const double &close[])
{
   for(int i = start; i < rates_total && !IsStopped(); i++)
   {
      // Calculate body size
      BodySizeBuffer[i] = MathAbs(close[i] - open[i]);

      // Calculate Z-Score statistics
      CalculateZScore(i);

      // Classify and color the candle
      ClassifyCandle(i, open[i], close[i]);

      // Set candle values
      OpenBuffer[i] = open[i];
      HighBuffer[i] = high[i];
      LowBuffer[i] = low[i];
      CloseBuffer[i] = close[i];
   }
}

//+------------------------------------------------------------------+
//| Calculate Z-Score for current position                           |
//+------------------------------------------------------------------+
void CalculateZScore(const int position)
{
   double sum = 0, sum2 = 0;

   // Calculate sums for mean and standard deviation
   for(int j = 0; j < InpZScoreLength; j++)
   {
      double value = BodySizeBuffer[position - j];
      sum += value;
      sum2 += value * value;
   }

   // Calculate mean and standard deviation
   double mean = sum / InpZScoreLength;
   double variance = (sum2 - sum * mean) / (InpZScoreLength - 1);
   double stdDev = MathSqrt(variance);

   // Calculate Z-Score
   ZScoreBuffer[position] = (stdDev != 0) ? (BodySizeBuffer[position] - mean) / stdDev : 0;
}

//+------------------------------------------------------------------+
//| Classify and color the candle                                    |
//+------------------------------------------------------------------+
void ClassifyCandle(const int position, const double open, const double close)
{
   bool isBullish = close >= open;
   double zScore = ZScoreBuffer[position];

   if(isBullish)
   {
      if(zScore >= InpThresholdZ2)
         ColorBuffer[position] = TYPE_UP_EXTREME;
      else if(zScore >= InpThresholdZ1)
         ColorBuffer[position] = TYPE_UP_LARGE;
      else
         ColorBuffer[position] = TYPE_UP_NORMAL;
   }
   else
   {
      if(zScore >= InpThresholdZ2)
         ColorBuffer[position] = TYPE_DOWN_EXTREME;
      else if(zScore >= InpThresholdZ1)
         ColorBuffer[position] = TYPE_DOWN_LARGE;
      else
         ColorBuffer[position] = TYPE_DOWN_NORMAL;
   }
}
//+------------------------------------------------------------------+