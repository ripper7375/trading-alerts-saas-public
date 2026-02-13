//+------------------------------------------------------------------+
//|                       Support and Resistant at Significant Level |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright     "EarnForex.com - 2019-2023"
#property link          "https://www.earnforex.com/metatrader-indicators/support-resistance-lines/"
#property version       "1.04"
#property strict
#property indicator_chart_window

#property indicator_buffers 8
#property indicator_plots 8
#property indicator_label1 "BufferZero"
#property indicator_label2 "BufferOne"
#property indicator_label3 "BufferTwo"
#property indicator_label4 "BufferThree"
#property indicator_label5 "BufferFour"
#property indicator_label6 "BufferFive"
#property indicator_label7 "BufferSix"
#property indicator_label8 "BufferSeven"

//--- Export Button name constant
#define EXPORT_BUTTON_NAME "SRExportButton"

enum ENUM_CUSTOMTIMEFRAMES
  {
   CURRENT = PERIOD_CURRENT, // CURRENT PERIOD
   M1 = PERIOD_M1,          // M1
   M5 = PERIOD_M5,          // M5
   M15 = PERIOD_M15,        // M15
   M30 = PERIOD_M30,        // M30
   H1 = PERIOD_H1,          // H1
   H4 = PERIOD_H4,          // H4
   D1 = PERIOD_D1,          // D1
   W1 = PERIOD_W1,          // W1
   MN1 = PERIOD_MN1,        // MN1
  };

// Core inputs
input group "Support and Resistant Levels Settings"
input ENUM_TIMEFRAMES SRTimeframe = PERIOD_CURRENT; // Timeframe to Analyze
input double AccuracyMultiplier = 3.0;             // Accuracy Multiplier (eg: 1.0-3.5)
input int ATRPeriod = 100;                         // ATR Period
input int SafeDistance = 50;                       // Safety Distance From Closest Level (points)
input int BarsToIgnore = 0;                        // Recent Candles to Ignore
input int MaxBarsExt = 1000;                       // Bars to Analyze
input int MaxRange = 0;                            // Max Price Range to Analyze (points) (0=No Limit)

input group "Draw Line Settings"
input bool DrawLinesEnabled = true;                // Draw Lines
input int LineThickness = 1;                       // Line Thickness (1-5)
input ENUM_LINE_STYLE ResistanceStyle = STYLE_DASHDOTDOT;  // Resistance Line Style
input ENUM_LINE_STYLE SupportStyle = STYLE_DASHDOTDOT;     // Support Line Style
input color ResistanceColor = clrRed;              // Resistance Color
input color SupportColor = clrGreen;               // Support Color

input group "Export Settings"
input bool InpEnableExport = false;                // Enable Export Button
input string InpBaseFileName = "SR_Levels";        // Base file name for export

input string Comment_1 = "====================";    // Indicator Settings
input string IndicatorName = "MQLTA-SR";           // Indicator Name

// Global variables
int MaxBars = 0;
double Array[];
int CalculatedBars = 0;
double LevelAbove = 0;
double LevelBelow = 0;
int DistanceFromSupport = INT_MAX;
int DistanceFromResistance = INT_MAX;
bool Waiting = false;

int ATRHandle, FractalsHandle;
double BufferFractalsUp[], BufferFractalsDown[];
double BufferATR[];

double BufferZero[];
double BufferOne[];
double BufferTwo[];
double BufferThree[];
double BufferFour[];
double BufferFive[];
double BufferSix[];
double BufferSeven[];

void CleanLines();  // Forward declaration

//+------------------------------------------------------------------+
//| Export Functions - Simplified version                            |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe)
{
   // Clean up symbol name (remove suffixes like .i for filename)
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   // Format timeframe as a string
   string tf_str = "";

   switch(timeframe)
   {
      case PERIOD_M1:  tf_str = "M1"; break;
      case PERIOD_M5:  tf_str = "M5"; break;
      case PERIOD_M15: tf_str = "M15"; break;
      case PERIOD_M30: tf_str = "M30"; break;
      case PERIOD_H1:  tf_str = "H1"; break;
      case PERIOD_H4:  tf_str = "H4"; break;
      case PERIOD_D1:  tf_str = "D"; break;
      case PERIOD_W1:  tf_str = "W"; break;
      case PERIOD_MN1: tf_str = "MN"; break;
      default: tf_str = EnumToString(timeframe); break;
   }

   // Build the filename: BaseName_Symbol_Timeframe.txt
   return StringFormat("%s_%s_%s.txt", base_name, clean_symbol, tf_str);
}

//+------------------------------------------------------------------+
//| Create Export Button                                              |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   // Delete existing button if it exists
   ObjectDelete(0, EXPORT_BUTTON_NAME);

   // Create new button
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

   // Button dimensions
   int button_width = 200;
   int button_height = 50;
   int x_margin = 250;
   int y_margin = 100;

   // Position at right side, higher up from bottom
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   // Text and font properties
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export SR Levels");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   // Visual style
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

   // Button behavior
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
//| Export Support and Resistance Levels to TXT file                 |
//+------------------------------------------------------------------+
bool ExportSRToTxt()
{
   // Use current chart symbol and timeframe
   string symbol = Symbol();
   ENUM_TIMEFRAMES timeframe = SRTimeframe;
   if(timeframe == PERIOD_CURRENT)
      timeframe = Period();

   // Generate filename
   string filename = GenerateFilename(InpBaseFileName, symbol, timeframe);
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;

   Print("Exporting SR levels to TXT file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   int error = GetLastError();

   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open TXT file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;
   double currentClose = iClose(symbol, PERIOD_CURRENT, 0);

   // Write simple header (no metadata)
   write_success &= FileWrite(file_handle, "Level_Type\tLevel_Price\tDistance_Points\tLevel_Number") > 0;

   // Count and export all levels
   int level_count = 0;

   // Export support levels (below current price) - from closest to furthest
   for(int i = ArraySize(Array) - 1; i >= 0; i--)
   {
      if(Array[i] > 0 && Array[i] < currentClose)
      {
         level_count++;
         int distance = int((currentClose - Array[i]) / Point());
         string line = StringFormat("SUPPORT\t%.5f\t%d\t%d",
                                   Array[i],
                                   distance,
                                   level_count);
         write_success &= FileWrite(file_handle, line) > 0;
      }
   }

   // Export resistance levels (above current price) - from closest to furthest
   for(int i = 0; i < ArraySize(Array); i++)
   {
      if(Array[i] > currentClose)
      {
         level_count++;
         int distance = int((Array[i] - currentClose) / Point());
         string line = StringFormat("RESISTANCE\t%.5f\t%d\t%d",
                                   Array[i],
                                   distance,
                                   level_count);
         write_success &= FileWrite(file_handle, line) > 0;
      }
   }

   FileClose(file_handle);

   if(!write_success)
   {
      Print("ERROR: Failed to write some data to TXT file");
      return false;
   }

   Print("Support and Resistance levels successfully exported to TXT file: ", filename);
   Print("Total levels exported: ", level_count);
   return true;
}

//+------------------------------------------------------------------+
//| Handle chart events for export button                            |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   // Check if it's a button click event
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == EXPORT_BUTTON_NAME)
      {
         if(ExportSRToTxt())
            Print("SUCCESS: Support and Resistance levels exported successfully");
         else
            Print("ERROR: Failed to export SR levels. See above for details.");

         // Reset button state
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| ORIGINAL SUPPORT AND RESISTANCE CODE BELOW - UNCHANGED           |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//|                                                                  |
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

   // Create export button if enabled
   if(InpEnableExport)
   {
      CreateExportButton();
   }

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CleanChart()
  {
   ObjectsDeleteAll(0, IndicatorName);
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void InitializeHandles()
  {
   ATRHandle = iATR(NULL, SRTimeframe, ATRPeriod);
   FractalsHandle = iFractals(NULL, SRTimeframe);
   ArraySetAsSeries(BufferFractalsUp, true);
   ArraySetAsSeries(BufferFractalsDown, true);
   ArraySetAsSeries(BufferATR, true);
  }

//+------------------------------------------------------------------+
//|                                                                  |
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
    // Avoid recalculation if nothing has changed
    if (prev_calculated > 0 && rates_total == prev_calculated)
        return rates_total;

    ArraySetAsSeries(close, true);  // Ensure arrays are set as series
    ArraySetAsSeries(time, true);

    MaxBars = MaxBarsExt;
    if (iBars(Symbol(), SRTimeframe) < MaxBars + BarsToIgnore)
    {
        MaxBars = iBars(Symbol(), SRTimeframe) - BarsToIgnore;
        if (MaxBars <= 0)
        {
            Print("Not enough historical data. Please load more candles.");
            return 0;
        }
    }

    // Buffer copying with error checking
    if (CopyBuffer(FractalsHandle, 0, 0, MaxBars, BufferFractalsUp) <= 0 ||
        CopyBuffer(FractalsHandle, 1, 0, MaxBars, BufferFractalsDown) <= 0 ||
        CopyBuffer(ATRHandle, 0, 0, MaxBars, BufferATR) <= 0)
    {
        if (!Waiting)
        {
            Print("Waiting for indicator data to load...");
            Waiting = true;
        }
        return prev_calculated;
    }

    if (Waiting)
    {
        Print("Indicator data loaded successfully.");
        Waiting = false;
    }

    // Static variables to track changes
    static datetime lastCalculationTime = 0;
    static double lastClose = 0;

    bool needsRecalculation = false;

    // Check if we need to recalculate
    if (prev_calculated == 0)  // First calculation
        needsRecalculation = true;
    else if (lastCalculationTime != time[0])  // New bar
        needsRecalculation = true;
    else if (MathAbs(lastClose - close[0]) > Point())  // Significant price change
        needsRecalculation = true;

    if (needsRecalculation)
    {
        CalculateLevels();
        lastCalculationTime = time[0];
        lastClose = close[0];
        CalculatedBars = rates_total;
    }

    // Calculate levels and distances
    LevelAbove = CalculateLevelAbove();
    LevelBelow = CalculateLevelBelow();

    if (LevelAbove > 0)
        DistanceFromResistance = int((LevelAbove - close[0]) / Point());
    else
        DistanceFromResistance = INT_MAX;

    if (LevelBelow > 0)
        DistanceFromSupport = int((close[0] - LevelBelow) / Point());
    else
        DistanceFromSupport = INT_MAX;

    // Update buffers and display
    FillBuffers();
    DisplayDistanceComments();

    // Draw lines only when levels change
    static double prevLevelAbove = 0;
    static double prevLevelBelow = 0;

    if (prevLevelAbove != LevelAbove || prevLevelBelow != LevelBelow)
    {
        if (DrawLinesEnabled)
        {
            DrawLines();
            prevLevelAbove = LevelAbove;
            prevLevelBelow = LevelBelow;
        }
    }

    return rates_total;
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void DisplayDistanceComments()
  {
   string commentText = "Support/Resistance Lines Distance Info:\n";

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
//|                                                                  |
//+------------------------------------------------------------------+
void CalculateLevels()
{
    double Highest = iHigh(NULL, SRTimeframe, iHighest(NULL, SRTimeframe, MODE_HIGH, MaxBars, 0));
    double Lowest = iLow(NULL, SRTimeframe, iLowest(NULL, SRTimeframe, MODE_LOW, MaxBars, 0));
    double Step = NormalizeDouble(BufferATR[0] * AccuracyMultiplier, Digits());

    if(Step == 0)
    {
        Print("Not enough historical data, please load more candles.");
        return;
    }

    int Steps = (int)MathCeil((Highest - Lowest) / Step) + 1;
    ArrayResize(Array, Steps);
    ArrayInitialize(Array, 0);

    for(int i = 0; i < ArraySize(Array); i++)
    {
        double StartRange = Lowest + Step * i;
        double EndRange = Lowest + Step * (i + 1);
        int BarCount = 0;
        double TotalPrice = 0;

        for(int j = BarsToIgnore; j < MaxBars + BarsToIgnore; j++)
        {
            double Fractal = 0;
            if(BufferFractalsUp[j - BarsToIgnore] != EMPTY_VALUE)
                Fractal = BufferFractalsUp[j - BarsToIgnore];
            else if(BufferFractalsDown[j - BarsToIgnore] != EMPTY_VALUE)
                Fractal = BufferFractalsDown[j - BarsToIgnore];

            if(Fractal >= StartRange && Fractal <= EndRange)
            {
                BarCount++;
                TotalPrice += Fractal;
            }
        }

        if(BarCount > 0)
        {
            Array[i] = NormalizeDouble(TotalPrice / BarCount, Digits());
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void FillBuffers()
{
    // Initialize buffers
    BufferZero[0] = 0;
    BufferOne[0] = 0;
    BufferTwo[0] = 0;
    BufferThree[0] = 0;
    BufferFour[0] = 0;
    BufferFive[0] = 0;
    BufferSix[0] = 0;
    BufferSeven[0] = 0;

    double currentClose = iClose(Symbol(), PERIOD_CURRENT, 0);

    // Fill resistance levels (above current price)
    int j = 0;
    for(int i = 0; i < ArraySize(Array); i++)
    {
        if(Array[i] > currentClose)
        {
            switch(j)
            {
                case 0: BufferFour[0] = NormalizeDouble(Array[i], Digits()); break;
                case 1: BufferFive[0] = NormalizeDouble(Array[i], Digits()); break;
                case 2: BufferSix[0] = NormalizeDouble(Array[i], Digits()); break;
                case 3: BufferSeven[0] = NormalizeDouble(Array[i], Digits()); break;
            }
            j++;
            if(j == 4) break;
        }
    }

    // Fill support levels (below current price)
    j = 0;
    for(int i = ArraySize(Array) - 1; i >= 0; i--)
    {
        if(Array[i] > 0 && Array[i] < currentClose)
        {
            switch(j)
            {
                case 0: BufferThree[0] = NormalizeDouble(Array[i], Digits()); break;
                case 1: BufferTwo[0] = NormalizeDouble(Array[i], Digits()); break;
                case 2: BufferOne[0] = NormalizeDouble(Array[i], Digits()); break;
                case 3: BufferZero[0] = NormalizeDouble(Array[i], Digits()); break;
            }
            j++;
            if(j == 4) break;
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CleanLines()
  {
   ObjectsDeleteAll(0, IndicatorName + "-HLINE-");
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void DrawLines()
{
    CleanLines();
    double currentClose = iClose(Symbol(), PERIOD_CURRENT, 0);

    for(int i = 0; i < ArraySize(Array); i++)
    {
        if(Array[i] > 0)
        {
            int LineNumber = int(Array[i] / Point());
            string LineName = IndicatorName + "-HLINE-" + IntegerToString(LineNumber);

            bool isResistance = (Array[i] > currentClose);
            color Color = isResistance ? ResistanceColor : SupportColor;
            ENUM_LINE_STYLE Style = isResistance ? ResistanceStyle : SupportStyle;

            ObjectCreate(0, LineName, OBJ_HLINE, 0, 0, Array[i]);
            ObjectSetInteger(0, LineName, OBJPROP_COLOR, Color);
            ObjectSetInteger(0, LineName, OBJPROP_STYLE, Style);
            ObjectSetInteger(0, LineName, OBJPROP_WIDTH, LineThickness);
            ObjectSetInteger(0, LineName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, LineName, OBJPROP_RAY_RIGHT, true);
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double CalculateLevelAbove()
  {
   double Level = 0;
   for(int i = 0; i < ArraySize(Array); i++)
     {
      if(Array[i] >= iClose(Symbol(), PERIOD_CURRENT, 0))
        {
         Level = NormalizeDouble(Array[i], Digits());
         break;
        }
     }
   return Level;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double CalculateLevelBelow()
  {
   double Level = 0;
   for(int i = ArraySize(Array) - 1; i >= 0; i--)
     {
      if((Array[i] > 0) && (Array[i] <= iClose(Symbol(), PERIOD_CURRENT, 0)))
        {
         Level = NormalizeDouble(Array[i], Digits());
         break;
        }
     }
   return Level;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   CleanChart();
   Comment("");  // Clear comments

   // Delete export button if it exists
   if(InpEnableExport)
   {
      ObjectDelete(0, EXPORT_BUTTON_NAME);
   }
  }
