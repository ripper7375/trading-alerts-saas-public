//+------------------------------------------------------------------+
//|                       Body Size Momentum Candle_V2_EXPORT.mq5    |
//|                             Copyright 2024, Your Name            |
//|                                     https://www.yourwebsite.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "Body Size Momentum Candle Indicator with Export Capability"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 7
#property indicator_plots   1
#property indicator_type1   DRAW_COLOR_CANDLES

//--- Button name constants
#define EXPORT_BUTTON_NAME "DataExportButton"
#define BATCH_EXPORT_BUTTON_NAME "BatchExportButton"

// Input parameters - Indicator Display
input int    InpZScoreLength  = 432;          // Z-Score MA Length
input double InpThresholdZ1   = 1.5;         // First threshold (Large)
input double InpThresholdZ2   = 2.5;         // Second threshold (Extreme)
input int    InpCandleWidth   = 3;           // Candle Width (1-5)
input color  InpColorUpNormal = clrNONE;    // Up Normal Color
input color  InpColorUpLarge  = clrLightGreen;  // Up Large Color (Light Green)
input color  InpColorUpExtreme = clrGreen;   // Up Extreme Color
input color  InpColorDownNormal = clrNONE;  // Down Normal Color
input color  InpColorDownLarge = clrHotPink;  // Down Large Color (Light Pink)
input color  InpColorDownExtreme = clrFireBrick;   // Down Extreme Color

// Input parameters - Export Settings
input string InpExportSeparator1 = "========== Export Settings =========="; // ===
input int    InpBars = 20000;                         // Number of bars to export
input string InpBaseFileName = "BodySizeCandle";      // Base file name
input bool   InpIncludeMetadata = false;              // Include metadata in TXT export
input bool   InpExportJSON = false;                   // Export JSON file
input bool   InpCleanFilenames = true;                // Clean filenames (no .txt extension)

// Input parameters - Batch Export
input string InpExportSeparator2 = "========== Batch Export =========="; // ===
input bool   InpEnableBatchExport = false;            // Enable batch export button
input string InpBatchSymbols = "BTCUSD,EURUSD,USDJPY"; // Symbols for batch export
input string InpBatchTimeframes = "M15,H1,H4";        // Timeframes for batch export
input bool   InpContinueOnError = true;               // Continue batch on error

// Indicator buffers
double OpenBuffer[];      // Open prices
double HighBuffer[];      // High prices
double LowBuffer[];       // Low prices
double CloseBuffer[];     // Close prices
double ColorBuffer[];     // Color index
double BodySizeBuffer[];  // Candle body sizes
double ZScoreBuffer[];    // Z-Score values

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

    // Set all buffers as timeseries (index 0 = newest bar)
    ArraySetAsSeries(OpenBuffer, true);
    ArraySetAsSeries(HighBuffer, true);
    ArraySetAsSeries(LowBuffer, true);
    ArraySetAsSeries(CloseBuffer, true);
    ArraySetAsSeries(ColorBuffer, true);
    ArraySetAsSeries(BodySizeBuffer, true);
    ArraySetAsSeries(ZScoreBuffer, true);

    // Set indicator properties
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

    // Set where drawing begins (skip first InpZScoreLength bars for accurate Z-Score)
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, InpZScoreLength);

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
    string short_name = StringFormat("Body Size Momentum (%d)", InpZScoreLength);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);

    // Set plot label for data window
    PlotIndexSetString(0, PLOT_LABEL, "BSM Open;BSM High;BSM Low;BSM Close");

    // Create export buttons
    CreateExportButton();
    if(InpEnableBatchExport)
        CreateBatchExportButton();

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
    // Set arrays as series (index 0 = newest bar)
    // This matches indicator buffer indexing
    ArraySetAsSeries(open, true);
    ArraySetAsSeries(high, true);
    ArraySetAsSeries(low, true);
    ArraySetAsSeries(close, true);

    // Check for minimum number of bars
    if(rates_total < InpZScoreLength)
        return 0;

    // Calculate start position for series arrays
    int limit;
    if(prev_calculated == 0)
        limit = rates_total - InpZScoreLength; // Start from oldest calculable bar
    else
        limit = rates_total - prev_calculated + 1; // Recalculate last bars

    // Calculate body sizes and statistics (from newest to oldest)
    for(int i = 0; i < limit && !IsStopped(); i++)
    {
        // Calculate body size (ABSOLUTE value - unsigned)
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

    return(rates_total);
}

//+------------------------------------------------------------------+
//| Calculate Z-Score for current position                           |
//+------------------------------------------------------------------+
void CalculateZScore(const int position)
{
    double sum = 0, sum2 = 0;

    // Calculate sums for mean and standard deviation
    // For series arrays: position 0 = newest, so lookback is position + j
    for(int j = 0; j < InpZScoreLength; j++)
    {
        double value = BodySizeBuffer[position + j];
        sum += value;
        sum2 += value * value;
    }

    // Calculate mean and standard deviation
    double mean = sum / InpZScoreLength;
    double variance = (sum2 - sum * mean) / (InpZScoreLength - 1);
    double stdDev = MathSqrt(variance);

    // Calculate Z-Score (unsigned - always positive using MathAbs)
    ZScoreBuffer[position] = (stdDev != 0) ? MathAbs(BodySizeBuffer[position] - mean) / stdDev : 0;
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
            Print("Export button clicked");
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

            if(ExportPriceData())
                Print("Export completed successfully!");
            else
                Print("Export failed!");
        }

        if(InpEnableBatchExport && sparam == BATCH_EXPORT_BUTTON_NAME)
        {
            Print("Batch Export button clicked");
            ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

            if(BatchExportPriceData())
                Print("Batch Export completed!");
            else
                Print("Batch Export failed!");
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

    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Data");
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

    ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Batch Export");
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
//| Export current chart data to TXT (11 columns)                    |
//+------------------------------------------------------------------+
bool ExportPriceData()
{
    string symbol = Symbol();
    ENUM_TIMEFRAMES timeframe = Period();

    Print("====== Starting Export ======");
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
    int calculated_bars = ArraySize(OpenBuffer);
    int bars_to_export = MathMin(InpBars, MathMin(rates_total, calculated_bars));
    Print("Exporting ", bars_to_export, " bars (calculated: ", calculated_bars, ", available: ", rates_total, ")");

    // Copy time data
    datetime time[];
    ArraySetAsSeries(time, true);

    if(CopyTime(symbol, timeframe, 0, bars_to_export, time) <= 0)
    {
        Print("ERROR: Failed to copy time data");
        return false;
    }

    // Note: Indicator buffers (OpenBuffer, HighBuffer, etc.) are already available
    // They are set as series (newest first) by the indicator system
    // We can directly access them for export

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

    // Write header - 11 columns
    write_success &= FileWrite(file_handle, "No\tTimeStamp\tSymbol\tTimeframe\tOpen\tHigh\tLow\tClose\tCandle direction\tZ-Score of body size\tCandle classification") > 0;

    // Write data rows (using indicator buffers directly)
    for(int i = 0; i < bars_to_export; i++)
    {
        // Indicator buffers are series arrays (index 0 = newest)
        int classification = (int)ColorBuffer[i];
        string direction = GetCandleDirection(classification);

        string line = StringFormat("%d\t%s\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%s\t%.5f\t%d",
                                   i,
                                   TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                                   symbol,
                                   EnumToString(timeframe),
                                   OpenBuffer[i],
                                   HighBuffer[i],
                                   LowBuffer[i],
                                   CloseBuffer[i],
                                   direction,
                                   ZScoreBuffer[i],
                                   classification);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write some data to file");
        return false;
    }

    Print("Successfully exported ", bars_to_export, " bars to: ", txt_filename);
    Print("====== Export Complete ======");

    // Export JSON if requested
    if(InpExportJSON)
    {
        string json_filename = GenerateFilename(InpBaseFileName, symbol, timeframe, "json");
        return ExportToJson(symbol, timeframe, json_filename, time, bars_to_export);
    }

    return true;
}

//+------------------------------------------------------------------+
//| Export to JSON format (11 columns)                               |
//+------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[],
                 const int bars_count)
{
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
    Print("Exporting to JSON: ", full_path);

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

    // Use indicator buffers directly (they are series arrays - index 0 = newest)
    for(int i = 0; i < bars_count; i++)
    {
        if(i > 0)
            FileWrite(file_handle, "        ,");

        int classification = (int)ColorBuffer[i];
        string direction = GetCandleDirection(classification);

        write_success &= FileWrite(file_handle, "        {") > 0;
        write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
        write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"symbol\": \"", symbol, "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"open\": ", DoubleToString(OpenBuffer[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"high\": ", DoubleToString(HighBuffer[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"low\": ", DoubleToString(LowBuffer[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"close\": ", DoubleToString(CloseBuffer[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"direction\": \"", direction, "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"zScore\": ", DoubleToString(ZScoreBuffer[i], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"classification\": ", classification) > 0;
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

    Print("Successfully exported JSON: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Batch export price data                                          |
//+------------------------------------------------------------------+
bool BatchExportPriceData()
{
    Print("====== Starting Batch Export ======");
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
    bool result = ExportPriceData();

    Print("====== Batch Export Complete ======");
    return result;
}
//+------------------------------------------------------------------+
