//+------------------------------------------------------------------+
//|                       Heiken Ashi_Body Size Classification_Doji Detection_EXPORT.mq5 |
//|                             Copyright 2024, Your Name            |
//|                                     https://www.yourwebsite.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "Enhanced Heiken Ashi with Body Size Classification + Doji Detection + Export Capability"

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

//--- Button name constants
#define EXPORT_BUTTON_NAME "HADataExportButton"
#define BATCH_EXPORT_BUTTON_NAME "HABatchExportButton"

// Input parameters for Heiken Ashi
input int      InpZScoreLength    = 288;                    // Z-Score MA Length
input double   InpThresholdZ1     = 2.0;                    // First threshold (Large)
input double   InpThresholdZ2     = 3.0;                    // Second threshold (Extreme)
input color    InpColorUpNormal   = clrDeepSkyBlue;         // Up Normal Color
input color    InpColorUpLarge    = clrRoyalBlue;           // Up Large Color
input color    InpColorUpExtreme  = clrLime;                // Up Extreme Color
input color    InpColorDownNormal = clrOrange;              // Down Normal Color
input color    InpColorDownLarge  = clrOrangeRed;           // Down Large Color
input color    InpColorDownExtreme = clrFireBrick;          // Down Extreme Color

// Input parameters for Doji Detection
input string   DojiSection = "=== DOJI DETECTION SETTINGS ==="; // Doji Settings
input bool     EnableDojiDetection = true;                  // Enable Doji Detection
input double   DojiMaxBodyRatio = 0.20;                     // Maximum body ratio for Doji (20% of total range)
input double   DojiMinUpperShadow = 0.35;                   // Minimum upper shadow ratio (35% of total range)
input double   DojiMinLowerShadow = 0.35;                   // Minimum lower shadow ratio (35% of total range)
input double   DojiMinTotalRange = 0.0001;                  // Minimum total range in price units
input color    DojiColor = clrMagenta;                      // Doji marker color
input int      DojiArrowCode = 167;                         // Arrow symbol code (167 = square)
input int      DojiDistance = 0;                            // Distance from candle in points

// Input parameters - Export Settings
input string InpExportSeparator1 = "========== Export Settings =========="; // ===
input int    InpBars = 20000;                               // Number of bars to export
input string InpBaseFileName = "HeikenAshi_BodySize";       // Base file name
input bool   InpIncludeMetadata = false;                    // Include metadata in TXT export
input bool   InpExportJSON = false;                         // Export JSON file
input bool   InpCleanFilenames = true;                      // Clean filenames (no .txt extension)

// Input parameters - Batch Export
input string InpExportSeparator2 = "========== Batch Export =========="; // ===
input bool   InpEnableBatchExport = false;                  // Enable batch export button
input string InpBatchSymbols = "BTCUSD,EURUSD,USDJPY";      // Symbols for batch export
input string InpBatchTimeframes = "M15,H1,H4";              // Timeframes for batch export
input bool   InpContinueOnError = true;                     // Continue batch on error

// Indicator buffers
double HAOpenBuffer[];        // Heiken Ashi Open
double HAHighBuffer[];        // Heiken Ashi High
double HALowBuffer[];         // Heiken Ashi Low
double HACloseBuffer[];       // Heiken Ashi Close
double HAColorBuffer[];       // Color index buffer
double BodySizeBuffer[];      // Heiken Ashi body sizes
double ZScoreBuffer[];        // Z-Score values
double DojiBuffer[];          // Doji signals
double DojiCalcBuffer[];      // Calculation buffer for doji

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
    SetIndexBuffer(5, DojiBuffer, INDICATOR_DATA);                  // Plot 2: Doji arrows
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
    string short_name = StringFormat("Enhanced Heiken Ashi + Doji (%d)", InpZScoreLength);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);

    // Create export buttons
    CreateExportButton();
    if(InpEnableBatchExport)
        CreateBatchExportButton();

    Print("=== Enhanced Heiken Ashi with Doji Detection + Export Initialized ===");
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
    ObjectDelete(0, EXPORT_BUTTON_NAME);
    if(InpEnableBatchExport)
        ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);

    Print("Enhanced Heiken Ashi with Doji Detection + Export deinitialized");
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
    double stdDev = MathSqrt(MathMax(variance, 0));  // Ensure non-negative variance

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
        if(zScore >= InpThresholdZ2)
            HAColorBuffer[position] = TYPE_UP_EXTREME;
        else if(zScore >= InpThresholdZ1)
            HAColorBuffer[position] = TYPE_UP_LARGE;
        else
            HAColorBuffer[position] = TYPE_UP_NORMAL;
    }
    else
    {
        if(zScore >= InpThresholdZ2)
            HAColorBuffer[position] = TYPE_DOWN_EXTREME;
        else if(zScore >= InpThresholdZ1)
            HAColorBuffer[position] = TYPE_DOWN_LARGE;
        else
            HAColorBuffer[position] = TYPE_DOWN_NORMAL;
    }
}

//+------------------------------------------------------------------+
//| Detect Doji patterns in Heiken Ashi candles                      |
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
        }
        else
        {
            DojiCalcBuffer[i] = 0.0;
        }
    }
}

//+------------------------------------------------------------------+
//| ChartEvent function - handles button clicks                      |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                 const long &lparam,
                 const double &dparam,
                 const string &sparam)
{
    if(id == CHARTEVENT_OBJECT_CLICK)
    {
        if(sparam == EXPORT_BUTTON_NAME)
        {
            Print("Heiken Ashi Export button clicked");
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

            if(ExportHeikenAshiData())
                Print("Heiken Ashi Export completed successfully!");
            else
                Print("Heiken Ashi Export failed!");
        }

        if(InpEnableBatchExport && sparam == BATCH_EXPORT_BUTTON_NAME)
        {
            Print("Heiken Ashi Batch Export button clicked");
            ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

            if(BatchExportHeikenAshiData())
                Print("Heiken Ashi Batch Export completed!");
            else
                Print("Heiken Ashi Batch Export failed!");
        }
    }
}

//+------------------------------------------------------------------+
//| Create Export Button                                             |
//+------------------------------------------------------------------+
void CreateExportButton()
{
    ObjectDelete(0, EXPORT_BUTTON_NAME);
    ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

    int button_width = 200;
    int button_height = 50;
    int x_margin = 250;
    int y_margin = 100;

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export HA Data");
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
//| Create Batch Export Button                                       |
//+------------------------------------------------------------------+
void CreateBatchExportButton()
{
    ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);
    ObjectCreate(0, BATCH_EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

    int button_width = 200;
    int button_height = 50;
    int x_margin = 250;
    int y_margin = 160;

    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

    ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Batch Export HA");
    ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,180,100');
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,150,80');

    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
    ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
//| Generate clean filename                                          |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe, string extension)
{
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0)
        clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

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

    string file_extension = extension;
    if(InpCleanFilenames && extension == "txt")
        file_extension = "";

    if(file_extension != "")
        return StringFormat("%s_%s_%s.%s", base_name, clean_symbol, tf_str, file_extension);
    else
        return StringFormat("%s_%s_%s", base_name, clean_symbol, tf_str);
}

//+------------------------------------------------------------------+
//| Get candle direction string                                      |
//+------------------------------------------------------------------+
string GetCandleDirection(int classification)
{
    // Classifications 0, 1, 2 = bullish
    // Classifications 3, 4, 5 = bearish
    return (classification <= 2) ? "bullish" : "bearish";
}

//+------------------------------------------------------------------+
//| Sanitize double value - replace NaN/Infinity with 0              |
//+------------------------------------------------------------------+
double SanitizeDouble(double value)
{
    // Check for NaN (NaN != NaN is always true)
    if(value != value)
        return 0.0;

    // Check for Infinity
    if(value > DBL_MAX || value < -DBL_MAX)
        return 0.0;

    // Check for values that would cause formatting issues
    if(MathAbs(value) > 1e15)
        return 0.0;

    return value;
}

//+------------------------------------------------------------------+
//| Export Heiken Ashi data to TXT (11 columns)                      |
//+------------------------------------------------------------------+
bool ExportHeikenAshiData()
{
    string symbol = Symbol();
    ENUM_TIMEFRAMES timeframe = Period();

    Print("====== Starting Heiken Ashi Export ======");
    Print("Symbol: ", symbol);
    Print("Timeframe: ", EnumToString(timeframe));

    // Check available bars
    int rates_total = Bars(symbol, timeframe);
    if(rates_total < InpZScoreLength)
    {
        Print("ERROR: Not enough bars. Need at least ", InpZScoreLength, ", have ", rates_total);
        return false;
    }

    // Determine export count (cannot exceed calculated buffer size)
    int calculated_bars = ArraySize(HAOpenBuffer);
    int bars_to_export = MathMin(InpBars, MathMin(rates_total, calculated_bars));
    Print("Exporting ", bars_to_export, " bars (calculated: ", calculated_bars, ", available: ", rates_total, ")");

    // Copy time data
    // NOTE: Do NOT use ArraySetAsSeries - keep normal indexing (0 = oldest)
    // This matches the indicator buffer indexing where HAOpenBuffer[0] = oldest bar
    datetime time[];
    double close[];

    if(CopyTime(symbol, timeframe, 0, bars_to_export, time) <= 0)
    {
        Print("ERROR: Failed to copy time data");
        return false;
    }

    if(CopyClose(symbol, timeframe, 0, bars_to_export, close) <= 0)
    {
        Print("ERROR: Failed to copy close data");
        return false;
    }

    // Verify array sizes match
    if(ArraySize(time) != bars_to_export)
    {
        Print("ERROR: Time array size mismatch. Expected: ", bars_to_export, ", Got: ", ArraySize(time));
        return false;
    }

    if(ArraySize(close) != bars_to_export)
    {
        Print("ERROR: Close array size mismatch. Expected: ", bars_to_export, ", Got: ", ArraySize(close));
        return false;
    }

    // Generate filename
    string txt_filename = GenerateFilename(InpBaseFileName, symbol, timeframe, "txt");
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + txt_filename;
    Print("Exporting to: ", full_path);

    // Open file for writing
    int file_handle = FileOpen(txt_filename, FILE_WRITE|FILE_TXT);
    if(file_handle == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open file for writing. Error: ", GetLastError());
        return false;
    }

    bool write_success = true;

    // Write metadata if requested
    if(InpIncludeMetadata)
    {
        write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
        write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
        write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
        write_success &= FileWrite(file_handle, "Number of Bars: " + IntegerToString(bars_to_export)) > 0;
        write_success &= FileWrite(file_handle, "Z-Score Length: " + IntegerToString(InpZScoreLength)) > 0;
        write_success &= FileWrite(file_handle, "") > 0;
    }

    // Write header - 12 columns for Heiken Ashi (added Close column)
    write_success &= FileWrite(file_handle, "No\tTimeStamp\tSymbol\tTimeframe\tClose\tha_open\tha_high\tha_low\tha_close\tha_classification\tha_body_size\tha_body_zscore") > 0;

    // Write data rows (using Heiken Ashi buffers)
    // NOTE: Normal array indexing where i=0 is the OLDEST bar, i=bars_to_export-1 is the NEWEST bar
    // Bars 0 to InpZScoreLength-1 will have ha_body_zscore=0 and ha_classification=0 or 3 (no Z-Score calculated yet)
    for(int i = 0; i < bars_to_export; i++)
    {
        // Bounds checking to prevent accessing invalid buffer positions
        if(i >= ArraySize(HAOpenBuffer) || i >= ArraySize(time))
        {
            Print("WARNING: Skipping bar ", i, " - buffer size exceeded");
            continue;
        }

        // Get Heiken Ashi classification
        int classification = (int)HAColorBuffer[i];

        // Sanitize all double values to prevent NaN/Infinity corruption
        double ha_open_clean = SanitizeDouble(HAOpenBuffer[i]);
        double ha_high_clean = SanitizeDouble(HAHighBuffer[i]);
        double ha_low_clean = SanitizeDouble(HALowBuffer[i]);
        double ha_close_clean = SanitizeDouble(HACloseBuffer[i]);
        double body_size_clean = SanitizeDouble(BodySizeBuffer[i]);
        double zscore_clean = SanitizeDouble(ZScoreBuffer[i]);

        // Debug: Log any sanitized values for first 10 bars
        if(i < 10 && (ha_open_clean != HAOpenBuffer[i] || ha_high_clean != HAHighBuffer[i] ||
                      ha_low_clean != HALowBuffer[i] || ha_close_clean != HACloseBuffer[i] ||
                      body_size_clean != BodySizeBuffer[i] || zscore_clean != ZScoreBuffer[i]))
        {
            Print("WARNING: Sanitized invalid values at bar ", i);
            Print("  Original: open=", HAOpenBuffer[i], " high=", HAHighBuffer[i],
                  " low=", HALowBuffer[i], " close=", HACloseBuffer[i],
                  " body=", BodySizeBuffer[i], " zscore=", ZScoreBuffer[i]);
        }

        string line = StringFormat("%d\t%s\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%d\t%.5f\t%.5f",
                                   i,
                                   TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                                   symbol,
                                   EnumToString(timeframe),
                                   close[i],
                                   ha_open_clean,
                                   ha_high_clean,
                                   ha_low_clean,
                                   ha_close_clean,
                                   classification,
                                   body_size_clean,
                                   zscore_clean);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write some data to file");
        return false;
    }

    Print("Successfully exported ", bars_to_export, " bars to: ", txt_filename);
    Print("====== Heiken Ashi Export Complete ======");

    // Export JSON if requested
    if(InpExportJSON)
    {
        string json_filename = GenerateFilename(InpBaseFileName, symbol, timeframe, "json");
        return ExportToJson(symbol, timeframe, json_filename, time, close, bars_to_export);
    }

    return true;
}

//+------------------------------------------------------------------+
//| Export to JSON format (12 columns for Heiken Ashi)               |
//+------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[],
                 const double &close[],
                 const int bars_count)
{
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
    Print("Exporting Heiken Ashi to JSON: ", full_path);

    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
    if(file_handle == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open JSON file. Error: ", GetLastError());
        return false;
    }

    bool write_success = true;

    write_success &= FileWrite(file_handle, "{") > 0;
    write_success &= FileWrite(file_handle, "    \"symbol\": \"", symbol, "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"zScoreLength\": ", InpZScoreLength, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"bars\": ", bars_count, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"data\": [") > 0;

    // Write Heiken Ashi data
    // NOTE: Normal array indexing where i=0 is the OLDEST bar
    for(int i = 0; i < bars_count; i++)
    {
        // Bounds checking
        if(i >= ArraySize(HAOpenBuffer) || i >= ArraySize(time))
        {
            Print("WARNING: Skipping JSON bar ", i, " - buffer size exceeded");
            continue;
        }

        if(i > 0)
            FileWrite(file_handle, "        ,");

        int classification = (int)HAColorBuffer[i];

        // Sanitize all double values to prevent NaN/Infinity corruption in JSON
        double ha_open_clean = SanitizeDouble(HAOpenBuffer[i]);
        double ha_high_clean = SanitizeDouble(HAHighBuffer[i]);
        double ha_low_clean = SanitizeDouble(HALowBuffer[i]);
        double ha_close_clean = SanitizeDouble(HACloseBuffer[i]);
        double body_size_clean = SanitizeDouble(BodySizeBuffer[i]);
        double zscore_clean = SanitizeDouble(ZScoreBuffer[i]);

        write_success &= FileWrite(file_handle, "        {") > 0;
        write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
        write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"symbol\": \"", symbol, "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"close\": ", DoubleToString(close[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_open\": ", DoubleToString(ha_open_clean, 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_high\": ", DoubleToString(ha_high_clean, 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_low\": ", DoubleToString(ha_low_clean, 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_close\": ", DoubleToString(ha_close_clean, 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_classification\": ", classification, ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_body_size\": ", DoubleToString(body_size_clean, 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"ha_body_zscore\": ", DoubleToString(zscore_clean, 5)) > 0;
        write_success &= FileWrite(file_handle, "        }") > 0;
    }

    write_success &= FileWrite(file_handle, "    ]") > 0;
    write_success &= FileWrite(file_handle, "}") > 0;

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write JSON data");
        return false;
    }

    Print("Successfully exported Heiken Ashi JSON: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Batch export Heiken Ashi data                                    |
//+------------------------------------------------------------------+
bool BatchExportHeikenAshiData()
{
    Print("====== Starting Heiken Ashi Batch Export ======");
    Print("NOTE: Batch export will use current chart's calculated data");
    Print("For best results, ensure chart has all required symbols loaded");

    // Parse symbols
    string symbols[];
    int symbol_count = StringSplit(InpBatchSymbols, ',', symbols);

    // Parse timeframes
    string tf_strings[];
    int tf_count = StringSplit(InpBatchTimeframes, ',', tf_strings);

    ENUM_TIMEFRAMES timeframes[];
    ArrayResize(timeframes, tf_count);

    for(int i = 0; i < tf_count; i++)
    {
        string tf = tf_strings[i];
        StringTrimLeft(tf);
        StringTrimRight(tf);

        if(tf == "M1") timeframes[i] = PERIOD_M1;
        else if(tf == "M5") timeframes[i] = PERIOD_M5;
        else if(tf == "M15") timeframes[i] = PERIOD_M15;
        else if(tf == "M30") timeframes[i] = PERIOD_M30;
        else if(tf == "H1") timeframes[i] = PERIOD_H1;
        else if(tf == "H4") timeframes[i] = PERIOD_H4;
        else if(tf == "D1" || tf == "D") timeframes[i] = PERIOD_D1;
        else if(tf == "W1" || tf == "W") timeframes[i] = PERIOD_W1;
        else if(tf == "MN1" || tf == "MN") timeframes[i] = PERIOD_MN1;
        else timeframes[i] = PERIOD_H1;
    }

    Print("WARNING: Batch export is limited - can only export current chart symbol/timeframe");
    Print("For multi-symbol export, manually switch charts and click Export button");

    // For now, just export current chart
    bool result = ExportHeikenAshiData();

    Print("====== Heiken Ashi Batch Export Complete ======");
    return result;
}
//+------------------------------------------------------------------+
