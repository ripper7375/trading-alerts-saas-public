//+------------------------------------------------------------------+
//|                           Z-Score_Heiken_Ashi_EXPORT.mq5         |
//|                             Copyright 2024, Your Name             |
//|                                     https://www.yourwebsite.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "Enhanced Heiken Ashi with Body Size Classification + Doji Detection + Data Export"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 9
#property indicator_plots   2

// Heiken Ashi properties
#property indicator_type1   DRAW_COLOR_CANDLES
#property indicator_label1  "Heiken Ashi;Heiken Ashi High;Heiken Ashi Low;Heiken Ashi Close"
#property indicator_width1  1

// Doji arrows properties
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrYellow
#property indicator_width2  3

// Input parameters for Heiken Ashi
input string HASection = "=== HEIKEN ASHI SETTINGS ==="; // Heiken Ashi Settings
input int    InpZScoreLength    = 288;                   // Z-Score MA Length
input double InpThresholdZ1_HA  = 2.0;                  // First threshold - Normal/Large boundary
input double InpThresholdZ2_HA  = 3.0;                  // Second threshold - Large/Extreme boundary
input color  InpColorUpNormal   = clrDeepSkyBlue;       // Up Normal Color
input color  InpColorUpLarge    = clrRoyalBlue;          // Up Large Color
input color  InpColorUpExtreme  = clrLime;               // Up Extreme Color
input color  InpColorDownNormal = clrOrange;             // Down Normal Color
input color  InpColorDownLarge  = clrOrangeRed;          // Down Large Color
input color  InpColorDownExtreme = clrFireBrick;         // Down Extreme Color

// Input parameters for Doji Detection
input string DojiSection = "=== DOJI DETECTION SETTINGS ==="; // Doji Settings
input bool   EnableDojiDetection = true;     // Enable Doji Detection
input double DojiMaxBodyRatio = 0.20;        // Maximum body ratio for Doji (20% of total range)
input double DojiMinUpperShadow = 0.35;      // Minimum upper shadow ratio (35% of total range)
input double DojiMinLowerShadow = 0.35;      // Minimum lower shadow ratio (35% of total range)
input double DojiMinTotalRange = 0.0001;     // Minimum total range in price units
input color  DojiColor = clrMagenta;         // Doji marker color
input int    DojiArrowCode = 167;            // Arrow symbol code (167 = square)
input int    DojiDistance = 0;               // Distance from candle in points

// Input parameters for Export
input string ExportSection = "=== DATA EXPORT SETTINGS ==="; // Export Settings
input int    InpMaxBarsExport   = 500;           // Max bars to export (0 = all available bars)
input color  InpButtonColor     = clrDodgerBlue;   // Export button color
input color  InpButtonTextColor = clrWhite;         // Export button text color
input int    InpButtonXSize     = 140;              // Export button width
input int    InpButtonYSize     = 30;               // Export button height
input int    InpButtonXPos      = 10;               // Export button X position
input int    InpButtonYPos      = 30;               // Export button Y position

// Indicator buffers
double HAOpenBuffer[];      // Heiken Ashi Open
double HAHighBuffer[];      // Heiken Ashi High
double HALowBuffer[];       // Heiken Ashi Low
double HACloseBuffer[];     // Heiken Ashi Close
double HAColorBuffer[];     // Color index buffer
double BodySizeBuffer[];    // Heiken Ashi body sizes
double ZScoreBuffer[];      // Z-Score values
double DojiBuffer[];        // Doji signals
double DojiCalcBuffer[];    // Calculation buffer for doji

// Enumeration for candle classifications
enum CANDLE_TYPE {
    TYPE_UP_NORMAL = 0,
    TYPE_UP_LARGE = 1,
    TYPE_UP_EXTREME = 2,
    TYPE_DOWN_NORMAL = 3,
    TYPE_DOWN_LARGE = 4,
    TYPE_DOWN_EXTREME = 5
};

// Global variables for export button
string g_buttonName = "btnExportHA";

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Indicator buffers mapping
    SetIndexBuffer(0, HAOpenBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, HAHighBuffer, INDICATOR_DATA);
    SetIndexBuffer(2, HALowBuffer, INDICATOR_DATA);
    SetIndexBuffer(3, HACloseBuffer, INDICATOR_DATA);
    SetIndexBuffer(4, HAColorBuffer, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(5, DojiBuffer, INDICATOR_DATA);          // Plot 2: Doji arrows
    SetIndexBuffer(6, BodySizeBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(7, ZScoreBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(8, DojiCalcBuffer, INDICATOR_CALCULATIONS);

    // Initialize buffers
    ArrayInitialize(HAOpenBuffer, 0);
    ArrayInitialize(HAHighBuffer, 0);
    ArrayInitialize(HALowBuffer, 0);
    ArrayInitialize(HACloseBuffer, 0);
    ArrayInitialize(HAColorBuffer, 0);
    ArrayInitialize(BodySizeBuffer, 0);
    ArrayInitialize(ZScoreBuffer, 0);
    ArrayInitialize(DojiBuffer, EMPTY_VALUE);
    ArrayInitialize(DojiCalcBuffer, 0);

    // Set indicator properties
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
    PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

    // Set up colors for Heiken Ashi
    PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 6);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_NORMAL, InpColorUpNormal);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_LARGE, InpColorUpLarge);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_UP_EXTREME, InpColorUpExtreme);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_NORMAL, InpColorDownNormal);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_LARGE, InpColorDownLarge);
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, TYPE_DOWN_EXTREME, InpColorDownExtreme);

    // Set up Doji arrows (Plot index 1)
    PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW);
    PlotIndexSetInteger(1, PLOT_ARROW, DojiArrowCode);
    PlotIndexSetInteger(1, PLOT_LINE_COLOR, DojiColor);
    PlotIndexSetInteger(1, PLOT_LINE_WIDTH, 3);
    PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
    PlotIndexSetString(1, PLOT_LABEL, "Doji Patterns");

    // Set indicator name and labels
    string short_name = StringFormat("Z-Score HA Export (%d)", InpZScoreLength);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);

    // Create export button on chart
    CreateExportButton();

    Print("=== Z-Score Heiken Ashi EXPORT Initialized ===");
    Print("Z-Score Thresholds: Z1=", InpThresholdZ1_HA, " Z2=", InpThresholdZ2_HA);
    Print("Doji Detection: ", EnableDojiDetection ? "ENABLED" : "DISABLED");
    if(EnableDojiDetection)
    {
        Print("Doji Parameters:");
        Print("  Max Body Ratio: ", DojiMaxBodyRatio * 100, "%");
        Print("  Min Upper Shadow: ", DojiMinUpperShadow * 100, "%");
        Print("  Min Lower Shadow: ", DojiMinLowerShadow * 100, "%");
        Print("  Min Total Range: ", DojiMinTotalRange);
    }

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Delete export button
    ObjectDelete(0, g_buttonName);
    ChartRedraw(0);

    Print("Z-Score Heiken Ashi EXPORT deinitialized");
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
    if(rates_total < InpZScoreLength + 1)
        return 0;

    // Calculate start position
    int start;
    if(prev_calculated == 0)
    {
        // Initialize first bar
        InitializeFirstBar(open[0], high[0], low[0], close[0]);
        start = 1;
    }
    else
    {
        start = prev_calculated - 1;
    }

    // Calculate Heiken Ashi values
    CalculateHeikenAshi(rates_total, start, open, high, low, close);

    // Calculate body size classification for bars with enough history
    if(rates_total >= InpZScoreLength + 1)
    {
        int classification_start = MathMax(start, InpZScoreLength);
        CalculateBodySizeClassification(rates_total, classification_start);
    }

    // Detect Doji patterns if enabled
    if(EnableDojiDetection)
    {
        int doji_start = MathMax(start, 1);
        DetectDojiPatterns(rates_total, doji_start);
    }

    return(rates_total);
}

//+------------------------------------------------------------------+
//| ChartEvent handler for button clicks                             |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
    if(id == CHARTEVENT_OBJECT_CLICK)
    {
        if(sparam == g_buttonName)
        {
            // Reset button state (unpress it)
            ObjectSetInteger(0, g_buttonName, OBJPROP_STATE, false);
            ChartRedraw(0);

            // Perform data export
            ExportData();
        }
    }
}

//+------------------------------------------------------------------+
//| Create export button on chart                                    |
//+------------------------------------------------------------------+
void CreateExportButton()
{
    // Delete if already exists
    ObjectDelete(0, g_buttonName);

    // Create button object
    if(!ObjectCreate(0, g_buttonName, OBJ_BUTTON, 0, 0, 0))
    {
        Print("Failed to create export button: ", GetLastError());
        return;
    }

    // Set button properties
    ObjectSetInteger(0, g_buttonName, OBJPROP_XDISTANCE, InpButtonXPos);
    ObjectSetInteger(0, g_buttonName, OBJPROP_YDISTANCE, InpButtonYPos);
    ObjectSetInteger(0, g_buttonName, OBJPROP_XSIZE, InpButtonXSize);
    ObjectSetInteger(0, g_buttonName, OBJPROP_YSIZE, InpButtonYSize);
    ObjectSetInteger(0, g_buttonName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetString(0, g_buttonName, OBJPROP_TEXT, "Export HA Data");
    ObjectSetString(0, g_buttonName, OBJPROP_FONT, "Arial Bold");
    ObjectSetInteger(0, g_buttonName, OBJPROP_FONTSIZE, 10);
    ObjectSetInteger(0, g_buttonName, OBJPROP_COLOR, InpButtonTextColor);
    ObjectSetInteger(0, g_buttonName, OBJPROP_BGCOLOR, InpButtonColor);
    ObjectSetInteger(0, g_buttonName, OBJPROP_BORDER_COLOR, clrNONE);
    ObjectSetInteger(0, g_buttonName, OBJPROP_STATE, false);
    ObjectSetInteger(0, g_buttonName, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, g_buttonName, OBJPROP_HIDDEN, true);
    ObjectSetInteger(0, g_buttonName, OBJPROP_ZORDER, 100);

    ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Export data to text file in Files folder                          |
//+------------------------------------------------------------------+
void ExportData()
{
    // Get total bars on chart
    int totalBars = Bars(_Symbol, _Period);
    if(totalBars <= InpZScoreLength)
    {
        Alert("Not enough bars to export. Need at least ", InpZScoreLength + 1, " bars.");
        return;
    }

    // Copy close prices (actual chart close, not HA close)
    double closePrice[];
    if(CopyClose(_Symbol, _Period, 0, totalBars, closePrice) <= 0)
    {
        Alert("Failed to copy close prices: ", GetLastError());
        return;
    }

    // Build file name: Symbol_Timeframe_HA_Export_YYYYMMDD_HHMMSS.txt
    string tfStr = GetTFStr((ENUM_TIMEFRAMES)_Period);
    string timestamp = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS);
    StringReplace(timestamp, ":", "");
    StringReplace(timestamp, ".", "");
    StringReplace(timestamp, " ", "_");

    string fileName = _Symbol + "_" + tfStr + "_HA_Export_" + timestamp + ".txt";

    // Open file for writing in the Files folder
    int fileHandle = FileOpen(fileName, FILE_WRITE | FILE_TXT | FILE_ANSI, '\t');
    if(fileHandle == INVALID_HANDLE)
    {
        Alert("Failed to open file for writing: ", GetLastError());
        return;
    }

    // Write header
    string header = "timestamp\tsymbol\ttimeframe\tclose\tha_open\tha_high\tha_low\tha_close\tha_color\tha_body_size\tha_body_zscore\tha_trend";
    FileWrite(fileHandle, header);

    // Determine export start index (only bars with valid Z-Score)
    int exportStart = InpZScoreLength;

    // Apply max bars limit if configured (export most recent N bars)
    if(InpMaxBarsExport > 0)
    {
        int earliestAllowed = totalBars - InpMaxBarsExport;
        if(earliestAllowed > exportStart)
            exportStart = earliestAllowed;
    }

    // Compute GMT offset so all timestamps are written as UTC Unix seconds
    datetime gmt_offset = TimeCurrent() - TimeGMT();

    // Variables for ha_trend consecutive-streak tracking (oldest bar first)
    int streak = 0;
    int prev_color = 0;

    for(int i = exportStart; i < totalBars && !IsStopped(); i++)
    {
        // Convert buffer index to time-series index for iTime
        int tsIdx = totalBars - 1 - i;

        // UTC Unix timestamp (integer seconds)
        long unix_ts = (long)(iTime(Symbol(), Period(), tsIdx) - gmt_offset);

        // Get classification as integer (0-5)
        int classification = (int)HAColorBuffer[i];

        // Convert to ha_color: 1 = bullish (0-2), -1 = bearish (3-5)
        int ha_color_val = (classification <= 2) ? 1 : -1;

        // Compute ha_trend streak
        int ha_dir = ha_color_val;
        if(prev_color == 0 || ha_dir != prev_color)
            streak = ha_dir;       // reset: +1 first bullish, -1 first bearish
        else
            streak += ha_dir;      // extend: +1 each bullish, -1 each bearish
        prev_color = ha_dir;

        // Format the data line (12 columns, tab-delimited)
        string dataLine = IntegerToString(unix_ts) + "\t" +
                      _Symbol + "\t" +
                      tfStr + "\t" +
                      DoubleToString(closePrice[i], _Digits) + "\t" +
                      DoubleToString(HAOpenBuffer[i], _Digits) + "\t" +
                      DoubleToString(HAHighBuffer[i], _Digits) + "\t" +
                      DoubleToString(HALowBuffer[i], _Digits) + "\t" +
                      DoubleToString(HACloseBuffer[i], _Digits) + "\t" +
                      IntegerToString(ha_color_val) + "\t" +
                      DoubleToString(BodySizeBuffer[i], _Digits) + "\t" +
                      DoubleToString(ZScoreBuffer[i], 5) + "\t" +
                      IntegerToString(streak);

        FileWrite(fileHandle, dataLine);
    }

    // Close file
    FileClose(fileHandle);

    // Notify user
    int exportedBars = totalBars - exportStart;
    string msg = "Export complete!\n" +
                 "File: " + fileName + "\n" +
                 "Rows: " + IntegerToString(exportedBars) + "\n" +
                 "Location: MQL5\\Files\\" + fileName;
    Alert(msg);
    Print("=== Data Export Complete ===");
    Print("File: ", fileName);
    Print("Total rows exported: ", exportedBars);
    Print("Z-Score Thresholds: Z1=", InpThresholdZ1_HA, " Z2=", InpThresholdZ2_HA);
}

//+------------------------------------------------------------------+
//| Convert timeframe enum to short data string (M5, H1, …)         |
//+------------------------------------------------------------------+
string GetTFStr(ENUM_TIMEFRAMES tf)
{
    switch(tf)
    {
        case PERIOD_M1:  return "M1";
        case PERIOD_M5:  return "M5";
        case PERIOD_M15: return "M15";
        case PERIOD_M30: return "M30";
        case PERIOD_H1:  return "H1";
        case PERIOD_H4:  return "H4";
        case PERIOD_D1:  return "D1";
        default: return EnumToString(tf);
    }
}

//+------------------------------------------------------------------+
//| Convert timeframe enum to string                                 |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES tf)
{
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
//| Initialize first bar values                                      |
//+------------------------------------------------------------------+
void InitializeFirstBar(double open, double high, double low, double close)
{
    HAOpenBuffer[0] = open;
    HAHighBuffer[0] = high;
    HALowBuffer[0] = low;
    HACloseBuffer[0] = close;
    BodySizeBuffer[0] = MathAbs(close - open);
    HAColorBuffer[0] = (close > open) ? TYPE_UP_NORMAL : TYPE_DOWN_NORMAL;
    DojiBuffer[0] = EMPTY_VALUE;
}

//+------------------------------------------------------------------+
//| Calculate Heiken Ashi values                                     |
//+------------------------------------------------------------------+
void CalculateHeikenAshi(int rates_total, int start,
                        const double &open[],
                        const double &high[],
                        const double &low[],
                        const double &close[])
{
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Calculate Heiken Ashi values
        double ha_open = (HAOpenBuffer[i-1] + HACloseBuffer[i-1]) / 2.0;
        double ha_close = (open[i] + high[i] + low[i] + close[i]) / 4.0;

        // Calculate high and low
        double ha_high = MathMax(high[i], MathMax(ha_open, ha_close));
        double ha_low = MathMin(low[i], MathMin(ha_open, ha_close));

        // Store calculated values
        HAOpenBuffer[i] = ha_open;
        HAHighBuffer[i] = ha_high;
        HALowBuffer[i] = ha_low;
        HACloseBuffer[i] = ha_close;

        // Calculate body size for Heiken Ashi candle
        BodySizeBuffer[i] = MathAbs(ha_close - ha_open);

        // Set default color (will be updated by classification if enough history)
        HAColorBuffer[i] = (ha_close > ha_open) ? TYPE_UP_NORMAL : TYPE_DOWN_NORMAL;

        // Initialize Doji buffer
        DojiBuffer[i] = EMPTY_VALUE;
    }
}

//+------------------------------------------------------------------+
//| Calculate body size classification                               |
//+------------------------------------------------------------------+
void CalculateBodySizeClassification(const int rates_total, const int start)
{
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Calculate Z-Score
        CalculateZScore(i);

        // Classify and color the candle
        ClassifyCandle(i);
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
    double stdDev = MathSqrt(MathMax(variance, 0)); // Ensure non-negative variance

    // Calculate Z-Score
    ZScoreBuffer[position] = (stdDev > 0) ? (BodySizeBuffer[position] - mean) / stdDev : 0;
}

//+------------------------------------------------------------------+
//| Classify and color the candle                                    |
//+------------------------------------------------------------------+
void ClassifyCandle(const int position)
{
    bool isBullish = HACloseBuffer[position] >= HAOpenBuffer[position];
    double zScore = ZScoreBuffer[position];

    if(isBullish)
    {
        if(zScore >= InpThresholdZ2_HA)
            HAColorBuffer[position] = TYPE_UP_EXTREME;
        else if(zScore >= InpThresholdZ1_HA)
            HAColorBuffer[position] = TYPE_UP_LARGE;
        else
            HAColorBuffer[position] = TYPE_UP_NORMAL;
    }
    else
    {
        if(zScore >= InpThresholdZ2_HA)
            HAColorBuffer[position] = TYPE_DOWN_EXTREME;
        else if(zScore >= InpThresholdZ1_HA)
            HAColorBuffer[position] = TYPE_DOWN_LARGE;
        else
            HAColorBuffer[position] = TYPE_DOWN_NORMAL;
    }
}

//+------------------------------------------------------------------+
//| Detect Doji patterns in Heiken Ashi candles                     |
//+------------------------------------------------------------------+
void DetectDojiPatterns(const int rates_total, const int start)
{
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Reset doji buffer
        DojiBuffer[i] = EMPTY_VALUE;

        // Get Heiken Ashi OHLC values
        double ha_open = HAOpenBuffer[i];
        double ha_high = HAHighBuffer[i];
        double ha_low = HALowBuffer[i];
        double ha_close = HACloseBuffer[i];

        // Calculate ranges and ratios
        double total_range = ha_high - ha_low;

        // Skip if range is too small
        if(total_range < DojiMinTotalRange)
            continue;

        double body_size = MathAbs(ha_close - ha_open);
        double upper_shadow = ha_high - MathMax(ha_open, ha_close);
        double lower_shadow = MathMin(ha_open, ha_close) - ha_low;

        // Calculate ratios
        double body_ratio = body_size / total_range;
        double upper_shadow_ratio = upper_shadow / total_range;
        double lower_shadow_ratio = lower_shadow / total_range;

        // Check Doji conditions
        bool is_doji = (body_ratio <= DojiMaxBodyRatio) &&
                       (upper_shadow_ratio >= DojiMinUpperShadow) &&
                       (lower_shadow_ratio >= DojiMinLowerShadow);

        if(is_doji)
        {
            // Position the arrow at the middle of the candle with offset
            double arrow_price = ha_low + (total_range / 2.0) + (DojiDistance * _Point);
            DojiBuffer[i] = arrow_price;

            // Store calculation result for debugging
            DojiCalcBuffer[i] = 1.0;

            // Print debug information for recent bars
            if(i >= rates_total - 10)
            {
                Print("Doji detected at bar ", i, ":");
                Print("  Total Range: ", DoubleToString(total_range, _Digits));
                Print("  Body Ratio: ", DoubleToString(body_ratio * 100, 2), "% (max: ", DoubleToString(DojiMaxBodyRatio * 100, 2), "%)");
                Print("  Upper Shadow: ", DoubleToString(upper_shadow_ratio * 100, 2), "% (min: ", DoubleToString(DojiMinUpperShadow * 100, 2), "%)");
                Print("  Lower Shadow: ", DoubleToString(lower_shadow_ratio * 100, 2), "% (min: ", DoubleToString(DojiMinLowerShadow * 100, 2), "%)");
            }
        }
        else
        {
            DojiCalcBuffer[i] = 0.0;
        }
    }
}
//+------------------------------------------------------------------+
