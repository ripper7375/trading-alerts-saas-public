//+------------------------------------------------------------------+
//|                              Dual_TEMA_High_Low_EXPORT.mq5       |
//|                             Copyright 2024, Your Name            |
//|                                     https://www.yourwebsite.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.01"
#property description "Dual TEMA Indicator - High & Low Price Lines with Data Export"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 8
#property indicator_plots   2

// TEMA High properties
#property indicator_label1  "TEMA High"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrLimeGreen
#property indicator_style1  STYLE_SOLID
#property indicator_width1  3

// TEMA Low properties
#property indicator_label2  "TEMA Low"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrFireBrick
#property indicator_style2  STYLE_SOLID
#property indicator_width2  3

//--- export button name constant
#define EXPORT_BUTTON_NAME "DualTEMAExportButton"

// Input parameters (original)
input int InpPeriodEMA = 9;  // EMA period
input int InpShift     = 0;  // Indicator's shift

// Input parameters (export)
input int    InpExportBars     = 20000;              // Number of bars to export
input string InpExportFileName = "Dual_TEMA_HL";     // Base export filename

// === INDICATOR_DATA buffers MUST come first (Plot 0 -> buf 0, Plot 1 -> buf 1) ===
double TEMAHighBuffer[];       // Buffer 0 - Plot 0
double TEMALowBuffer[];        // Buffer 1 - Plot 1

// === INDICATOR_CALCULATIONS buffers after ===
double EMAHigh[];              // Buffer 2
double EMAofEMAHigh[];         // Buffer 3
double EMAofEMAofEMAHigh[];    // Buffer 4
double EMALow[];               // Buffer 5
double EMAofEMALow[];          // Buffer 6
double EMAofEMAofEMALow[];     // Buffer 7

//--- global arrays to cache time and close from OnCalculate for export
//    Indexed oldest-first (same direction as indicator buffers):
//    index 0 = oldest bar,  index rates_total-1 = newest bar
datetime g_time[];
double   g_close[];
int      g_rates_total = 0;

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Data buffers first (mapped to plots)
    SetIndexBuffer(0, TEMAHighBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, TEMALowBuffer,  INDICATOR_DATA);

    // Calculation buffers after
    SetIndexBuffer(2, EMAHigh,              INDICATOR_CALCULATIONS);
    SetIndexBuffer(3, EMAofEMAHigh,         INDICATOR_CALCULATIONS);
    SetIndexBuffer(4, EMAofEMAofEMAHigh,    INDICATOR_CALCULATIONS);
    SetIndexBuffer(5, EMALow,               INDICATOR_CALCULATIONS);
    SetIndexBuffer(6, EMAofEMALow,          INDICATOR_CALCULATIONS);
    SetIndexBuffer(7, EMAofEMAofEMALow,     INDICATOR_CALCULATIONS);

    // Initialize all buffers
    ArrayInitialize(TEMAHighBuffer,      0);
    ArrayInitialize(TEMALowBuffer,       0);
    ArrayInitialize(EMAHigh,             0);
    ArrayInitialize(EMAofEMAHigh,        0);
    ArrayInitialize(EMAofEMAofEMAHigh,   0);
    ArrayInitialize(EMALow,              0);
    ArrayInitialize(EMAofEMALow,         0);
    ArrayInitialize(EMAofEMAofEMALow,    0);

    // Set indicator properties
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

    int drawBegin = 3 * InpPeriodEMA - 3;
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, drawBegin);
    PlotIndexSetInteger(0, PLOT_SHIFT, InpShift);
    PlotIndexSetInteger(1, PLOT_DRAW_BEGIN, drawBegin);
    PlotIndexSetInteger(1, PLOT_SHIFT, InpShift);

    // Set indicator name
    string short_name = StringFormat("TEMA Dual(%d)", InpPeriodEMA);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);
    PlotIndexSetString(0, PLOT_LABEL, "TEMA High");
    PlotIndexSetString(1, PLOT_LABEL, "TEMA Low");

    // Create export button
    CreateExportButton();

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    ObjectDelete(0, EXPORT_BUTTON_NAME);
    ChartRedraw(0);
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
    if(rates_total < 3 * InpPeriodEMA - 3)
        return 0;

    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;

    // Calculate both TEMA lines
    CalculateTEMA(rates_total, start, high, TEMAHighBuffer, EMAHigh, EMAofEMAHigh, EMAofEMAofEMAHigh);
    CalculateTEMA(rates_total, start, low,  TEMALowBuffer,  EMALow,  EMAofEMALow,  EMAofEMAofEMALow);

    //--- cache time[] and close[] for export (same oldest-first index as indicator buffers)
    if(ArraySize(g_time) < rates_total)
    {
        ArrayResize(g_time,  rates_total);
        ArrayResize(g_close, rates_total);
    }
    int copy_start = prev_calculated > 0 ? prev_calculated - 1 : 0;
    for(int j = copy_start; j < rates_total; j++)
    {
        g_time[j]  = time[j];
        g_close[j] = close[j];
    }
    g_rates_total = rates_total;

    return(rates_total);
}

//+------------------------------------------------------------------+
//| Chart event handler - handles export button click               |
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
            if(ExportData())
                Print("SUCCESS: Indicator data exported successfully");
            else
                Print("ERROR: Failed to export indicator data. See log for details.");

            //--- reset button state
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        }
    }
}

//+------------------------------------------------------------------+
//| Generic TEMA calculation for any price source                    |
//+------------------------------------------------------------------+
void CalculateTEMA(int rates_total, int start,
                   const double &price[],
                   double &temaBuffer[],
                   double &ema1[],
                   double &ema2[],
                   double &ema3[])
{
    double alpha = 2.0 / (InpPeriodEMA + 1);

    // EMA of Price
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i == 0)
            ema1[i] = price[i];
        else
            ema1[i] = alpha * price[i] + (1 - alpha) * ema1[i - 1];
    }

    // EMA of EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < InpPeriodEMA - 1)
        {
            ema2[i] = 0;
            continue;
        }
        if(i == InpPeriodEMA - 1)
            ema2[i] = ema1[i];
        else
            ema2[i] = alpha * ema1[i] + (1 - alpha) * ema2[i - 1];
    }

    // EMA of EMA of EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < 2 * InpPeriodEMA - 2)
        {
            ema3[i] = 0;
            continue;
        }
        if(i == 2 * InpPeriodEMA - 2)
            ema3[i] = ema2[i];
        else
            ema3[i] = alpha * ema2[i] + (1 - alpha) * ema3[i - 1];
    }

    // Final TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < 3 * InpPeriodEMA - 3)
        {
            temaBuffer[i] = 0;
            continue;
        }
        temaBuffer[i] = 3 * ema1[i] - 3 * ema2[i] + ema3[i];
    }
}

//+------------------------------------------------------------------+
//| Create export button on chart                                    |
//+------------------------------------------------------------------+
void CreateExportButton()
{
    //--- delete existing button if present
    ObjectDelete(0, EXPORT_BUTTON_NAME);

    //--- create button object
    ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

    //--- button dimensions
    int button_width  = 200;
    int button_height = 50;
    int x_margin      = 250;
    int y_margin      = 100;

    //--- position at lower-right corner
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER,       CORNER_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE,    x_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE,    y_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE,        button_width);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE,        button_height);

    //--- text and font
    ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_TEXT,         "Export Data");
    ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_FONT,         "Arial Bold");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE,     11);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR,        clrWhite);

    //--- visual style
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR,      C'0,120,215');
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

    //--- button behaviour
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR,       ANCHOR_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN,       false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE,   false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER,       999);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE,        false);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK,         false);

    ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Convert ENUM_TIMEFRAMES to human-readable string                 |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES timeframe)
{
    switch(timeframe)
    {
        case PERIOD_M1:   return "M1";
        case PERIOD_M5:   return "M5";
        case PERIOD_M15:  return "M15";
        case PERIOD_M30:  return "M30";
        case PERIOD_H1:   return "H1";
        case PERIOD_H4:   return "H4";
        case PERIOD_D1:   return "D1";
        case PERIOD_W1:   return "W1";
        case PERIOD_MN1:  return "MN1";
        default:          return EnumToString(timeframe);
    }
}

//+------------------------------------------------------------------+
//| Export indicator data to tab-separated CSV file                  |
//| Format: No | TimeStamp | Symbol | Timeframe | Close |            |
//|         dual_tema_high | dual_tema_low                           |
//+------------------------------------------------------------------+
bool ExportData()
{
    string symbol = Symbol();
    string tf_str = TimeframeToString(Period());

    if(g_rates_total <= 0)
    {
        Print("ERROR: No bars available for export (indicator not yet calculated)");
        return false;
    }

    //--- determine how many bars to export, starting from the oldest available
    int bars_to_export = MathMin(InpExportBars, g_rates_total);
    //--- start_idx: oldest bar that will be exported
    //    g_time[], g_close[], TEMAHighBuffer[], TEMALowBuffer[] all share the same
    //    oldest-first indexing, so one index variable correctly addresses all of them.
    int start_idx = g_rates_total - bars_to_export;

    //--- build filename: BaseName_Symbol_Timeframe.csv
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0)
        clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

    string filename  = StringFormat("%s_%s_%s.csv", InpExportFileName, clean_symbol, tf_str);
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
    Print("Exporting to file: ", full_path);

    //--- open file for writing
    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(file_handle == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open file for writing. Error: ", GetLastError());
        return false;
    }

    bool write_success = true;

    //--- write header row
    write_success &= FileWrite(file_handle, "No\tTimeStamp\tSymbol\tTimeframe\tClose\tdual_tema_high\tdual_tema_low") > 0;

    //--- write data rows oldest-first
    //    idx directly addresses g_time[], g_close[], TEMAHighBuffer[], TEMALowBuffer[]
    //    since all share the same oldest=start_idx, newest=g_rates_total-1 direction.
    //    Warmup (empty) rows therefore appear at the top of the file (oldest bars) as expected.
    for(int i = 0; i < bars_to_export; i++)
    {
        int idx = start_idx + i;  // oldest exported bar at i=0, newest at i=bars_to_export-1

        //--- skip both 0.0 (explicit warmup sentinel) and EMPTY_VALUE (DBL_MAX, MT5's default
        //    pre-fill for indicator buffer slots not yet reached by CalculateTEMA)
        string tema_high_str = (TEMAHighBuffer[idx] != 0.0 && TEMAHighBuffer[idx] != EMPTY_VALUE
                                ? DoubleToString(TEMAHighBuffer[idx], _Digits) : "");
        string tema_low_str  = (TEMALowBuffer[idx]  != 0.0 && TEMALowBuffer[idx]  != EMPTY_VALUE
                                ? DoubleToString(TEMALowBuffer[idx],  _Digits) : "");

        string line = StringFormat("%d\t%s\t%s\t%s\t%s\t%s\t%s",
                                   i,
                                   TimeToString(g_time[idx],  TIME_DATE|TIME_MINUTES),
                                   symbol,
                                   tf_str,
                                   DoubleToString(g_close[idx], _Digits),
                                   tema_high_str,
                                   tema_low_str);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Some rows failed to write to file");
        return false;
    }

    Print("Data export complete: ", bars_to_export, " bars written to ", filename);
    return true;
}
//+------------------------------------------------------------------+
