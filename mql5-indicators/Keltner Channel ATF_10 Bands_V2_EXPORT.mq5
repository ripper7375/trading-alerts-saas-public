//+------------------------------------------------------------------+
//|                                Multi-Timeframe Keltner Channel  |
//|                             Copyright 2024, Your Name               |
//|                             Multi-Timeframe Keltner Channel         |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "5.02"
#property description "Multi-Timeframe Keltner Channel - 10-Band System with Data Export"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 18
#property indicator_plots   10

// Line properties
#property indicator_type1   DRAW_LINE
#property indicator_type2   DRAW_LINE
#property indicator_type3   DRAW_LINE
#property indicator_type4   DRAW_LINE
#property indicator_type5   DRAW_LINE
#property indicator_type6   DRAW_LINE
#property indicator_type7   DRAW_LINE
#property indicator_type8   DRAW_LINE
#property indicator_type9   DRAW_LINE
#property indicator_type10  DRAW_LINE

#property indicator_color1  clrOrchid          // Ultra Extreme Upper band
#property indicator_color2  clrOrchid        // Extreme Upper band
#property indicator_color3  clrOrchid        // UpperMost band
#property indicator_color4  clrOrchid        // Upper band
#property indicator_color5  clrOrangeRed        // Upper middle band
#property indicator_color6  clrOrangeRed        // Lower middle band
#property indicator_color7  clrOrchid        // Lower band
#property indicator_color8  clrOrchid        // LowerMost band
#property indicator_color9  clrOrchid        // Extreme Lower band
#property indicator_color10 clrOrchid          // Ultra Extreme Lower band

#property indicator_style1  STYLE_SOLID
#property indicator_style2  STYLE_SOLID
#property indicator_style3  STYLE_SOLID
#property indicator_style4  STYLE_SOLID
#property indicator_style5  STYLE_SOLID
#property indicator_style6  STYLE_SOLID
#property indicator_style7  STYLE_SOLID
#property indicator_style8  STYLE_SOLID
#property indicator_style9  STYLE_SOLID
#property indicator_style10 STYLE_SOLID

#property indicator_width1  2
#property indicator_width2  2
#property indicator_width3  2
#property indicator_width4  2
#property indicator_width5  3
#property indicator_width6  3
#property indicator_width7  2
#property indicator_width8  2
#property indicator_width9  2
#property indicator_width10 2

// Indicator labels
#property indicator_label1  "HTF Ultra Extreme Upper Band"
#property indicator_label2  "HTF Extreme Upper Band"
#property indicator_label3  "HTF UpperMost Band"
#property indicator_label4  "HTF Upper Band"
#property indicator_label5  "HTF Upper Middle"
#property indicator_label6  "HTF Lower Middle"
#property indicator_label7  "HTF Lower Band"
#property indicator_label8  "HTF LowerMost Band"
#property indicator_label9  "HTF Extreme Lower Band"
#property indicator_label10 "HTF Ultra Extreme Lower Band"

//--- Button name constants
#define EXPORT_BUTTON_NAME "KeltnerATF10BandsExportButton"

// Input parameters
input group "═══ Multi-Timeframe Keltner Settings ═══"
input ENUM_TIMEFRAMES AnalysisTimeframe = PERIOD_CURRENT;
input int    HRMAPeriod = 54;
input int    ATRPeriod = 162;

input group "═══ ATR Multipliers ═══"
input double ATRMultiplier_UltraExtremeUpper = 4.00;
input double ATRMultiplier_ExtremeUpper = 3.00;
input double ATRMultiplier_UpperMost = 2.00;
input double ATRMultiplier_Upper = 1.00;
input double ATRMultiplier_Lower = 1.00;
input double ATRMultiplier_LowerMost = 2.00;
input double ATRMultiplier_ExtremeLower = 3.00;
input double ATRMultiplier_UltraExtremeLower = 4.00;

// Export parameters
input group "═══ Data Export Settings ═══"
input ENUM_TIMEFRAMES      InpExportTimeframe = PERIOD_CURRENT;        // Timeframe for export
input int                  InpBars = 3000;                            // Number of bars to export
input string               InpBaseFileName = "KC_ATF_10Bands";        // Base file name
input bool                 InpIncludeMetadata = false;                 // Include metadata in TXT export
input bool                 InpExportJSON = true;                       // Export JSON file
input bool                 InpCleanFilenames = true;                   // Clean filenames (no .txt extension)

// Indicator buffers
double UltraExtremeUpperBandBuffer[];
double ExtremeUpperBandBuffer[];
double UpperMostBandBuffer[];
double UpperBandBuffer[];
double UpperMiddleBuffer[];
double LowerMiddleBuffer[];
double LowerBandBuffer[];
double LowerMostBandBuffer[];
double ExtremeLowerBandBuffer[];
double UltraExtremeLowerBandBuffer[];
double UpperHRMACalcBuffer[];
double LowerHRMACalcBuffer[];
double UpperRMA1Buffer[];
double UpperRMA2Buffer[];
double LowerRMA1Buffer[];
double LowerRMA2Buffer[];
double ReservedBuffer1[];
double ReservedBuffer2[];

// Higher timeframe indicator handle
int HTF_ATRHandle;

// Global variables
int DrawBeginIndex;
string AnalysisTimeframeText = "";

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    AnalysisTimeframeText = EnumToString(AnalysisTimeframe);

    if(HRMAPeriod < 10)
    {
        Print("Error: HRMA Period must be >= 10");
        return INIT_PARAMETERS_INCORRECT;
    }

    if(ATRPeriod < 3)
    {
        Print("Error: ATR Period must be >= 3");
        return INIT_PARAMETERS_INCORRECT;
    }

    // Map indicator buffers
    SetIndexBuffer(0, UltraExtremeUpperBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, ExtremeUpperBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(2, UpperMostBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(3, UpperBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(4, UpperMiddleBuffer, INDICATOR_DATA);
    SetIndexBuffer(5, LowerMiddleBuffer, INDICATOR_DATA);
    SetIndexBuffer(6, LowerBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(7, LowerMostBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(8, ExtremeLowerBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(9, UltraExtremeLowerBandBuffer, INDICATOR_DATA);
    SetIndexBuffer(10, UpperHRMACalcBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(11, LowerHRMACalcBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(12, UpperRMA1Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(13, UpperRMA2Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(14, LowerRMA1Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(15, LowerRMA2Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(16, ReservedBuffer1, INDICATOR_CALCULATIONS);
    SetIndexBuffer(17, ReservedBuffer2, INDICATOR_CALCULATIONS);

    // Initialize buffers
    ArrayInitialize(UltraExtremeUpperBandBuffer, 0);
    ArrayInitialize(ExtremeUpperBandBuffer, 0);
    ArrayInitialize(UpperMostBandBuffer, 0);
    ArrayInitialize(UpperBandBuffer, 0);
    ArrayInitialize(UpperMiddleBuffer, 0);
    ArrayInitialize(LowerMiddleBuffer, 0);
    ArrayInitialize(LowerBandBuffer, 0);
    ArrayInitialize(LowerMostBandBuffer, 0);
    ArrayInitialize(ExtremeLowerBandBuffer, 0);
    ArrayInitialize(UltraExtremeLowerBandBuffer, 0);
    ArrayInitialize(UpperHRMACalcBuffer, 0);
    ArrayInitialize(LowerHRMACalcBuffer, 0);
    ArrayInitialize(UpperRMA1Buffer, 0);
    ArrayInitialize(UpperRMA2Buffer, 0);
    ArrayInitialize(LowerRMA1Buffer, 0);
    ArrayInitialize(LowerRMA2Buffer, 0);
    ArrayInitialize(ReservedBuffer1, 0);
    ArrayInitialize(ReservedBuffer2, 0);

    // Create higher timeframe ATR indicator
    HTF_ATRHandle = iATR(_Symbol, AnalysisTimeframe, ATRPeriod);
    if(HTF_ATRHandle == INVALID_HANDLE)
    {
        Print("Error: Failed to create ATR handle for timeframe ", AnalysisTimeframeText);
        return INIT_FAILED;
    }

    DrawBeginIndex = MathMax(HRMAPeriod, ATRPeriod) + 1;

    // Set plot properties
    for(int i = 0; i < 10; i++)
    {
        PlotIndexSetInteger(i, PLOT_DRAW_BEGIN, DrawBeginIndex);
        PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, 0.0);
    }

    string indicatorName = StringFormat("Multi-TF Keltner 10-Band Export (%s)", AnalysisTimeframeText);
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
    IndicatorSetString(INDICATOR_SHORTNAME, indicatorName);

    // Create export button
    CreateExportButton();

    Print("Multi-Timeframe 10-Band Keltner Channel with Export initialized - Analysis TF: ", AnalysisTimeframeText);

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Create Export Button                                             |
//+------------------------------------------------------------------+
void CreateExportButton()
{
    // Delete existing button if it exists
    ObjectDelete(0, EXPORT_BUTTON_NAME);

    // Create new button
    ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

    // Button dimensions
    int button_width = 250;
    int button_height = 50;
    int x_margin = 280;
    int y_margin = 100;

    // Position at right side
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

    // Text and font properties
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export KC 10-Band Data");
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
//| Generate filename with symbol and timeframe                      |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe, string extension)
{
    // Clean up symbol name
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

    // For clean filenames, optionally omit the .txt extension
    string file_extension = extension;
    if(InpCleanFilenames && extension == "txt")
        file_extension = "";

    // Build the filename
    if(file_extension != "")
        return StringFormat("%s_%s_%s.%s", base_name, clean_symbol, tf_str, file_extension);
    else
        return StringFormat("%s_%s_%s", base_name, clean_symbol, tf_str);
}

//+------------------------------------------------------------------+
//| Get timeframe string for data column                             |
//+------------------------------------------------------------------+
string GetTimeframeString(ENUM_TIMEFRAMES timeframe)
{
    switch(timeframe)
    {
        case PERIOD_M1:  return "M1";
        case PERIOD_M5:  return "M5";
        case PERIOD_M15: return "M15";
        case PERIOD_M30: return "M30";
        case PERIOD_H1:  return "H1";
        case PERIOD_H4:  return "H4";
        case PERIOD_D1:  return "D";
        case PERIOD_W1:  return "W";
        case PERIOD_MN1: return "MN";
        default: return EnumToString(timeframe);
    }
}

//+------------------------------------------------------------------+
//| Calculate HRMA                                                   |
//+------------------------------------------------------------------+
void CalculateHRMA(int rates_total, int start, const double &price[], double &hrma[], double &rma1[], double &rma2[])
{
    double alpha1 = 2.0 / (HRMAPeriod / 2.0 + 1);
    double alpha2 = 2.0 / (HRMAPeriod + 1);
    double alpha3 = 2.0 / (MathSqrt(HRMAPeriod) + 1);

    for(int i = start; i < rates_total; i++)
    {
        if(i == 0)
        {
            rma1[i] = price[i];
            rma2[i] = price[i];
            hrma[i] = price[i];
        }
        else
        {
            rma1[i] = alpha1 * price[i] + (1 - alpha1) * rma1[i-1];
            rma2[i] = alpha2 * price[i] + (1 - alpha2) * rma2[i-1];
            double hrmaValue = 2 * rma1[i] - rma2[i];
            hrma[i] = alpha3 * hrmaValue + (1 - alpha3) * hrma[i-1];
        }
    }
}

//+------------------------------------------------------------------+
//| Get price for band                                              |
//+------------------------------------------------------------------+
double GetPriceForBand(bool isUpperBand, double high, double low)
{
    return isUpperBand ? high : low;
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
    if(rates_total < DrawBeginIndex)
        return 0;

    int availableBars = iBars(_Symbol, AnalysisTimeframe);
    if(availableBars < MathMax(HRMAPeriod, ATRPeriod))
    {
        return prev_calculated;
    }

    // Validate ATR handle
    if(HTF_ATRHandle == INVALID_HANDLE)
    {
        HTF_ATRHandle = iATR(_Symbol, AnalysisTimeframe, ATRPeriod);
        if(HTF_ATRHandle == INVALID_HANDLE)
            return prev_calculated;
    }

    // Determine start position - key fix for corruption after reload
    int start;
    if(prev_calculated == 0)
    {
        start = 0;
    }
    else
    {
        // Always recalculate last few bars to maintain continuity
        // This prevents corruption after MT5 disconnect/reload
        start = MathMax(0, prev_calculated - HRMAPeriod);
    }

    // Calculate HRMA price arrays from higher timeframe
    for(int i = start; i < rates_total; i++)
    {
        int htf_bar_shift = iBarShift(_Symbol, AnalysisTimeframe, time[i], true);

        if(htf_bar_shift >= 0)
        {
            double htf_high = iHigh(_Symbol, AnalysisTimeframe, htf_bar_shift);
            double htf_low = iLow(_Symbol, AnalysisTimeframe, htf_bar_shift);

            if(htf_high > 0 && htf_low > 0)
            {
                UpperHRMACalcBuffer[i] = GetPriceForBand(true, htf_high, htf_low);
                LowerHRMACalcBuffer[i] = GetPriceForBand(false, htf_high, htf_low);
            }
            else if(i > 0)
            {
                UpperHRMACalcBuffer[i] = UpperHRMACalcBuffer[i-1];
                LowerHRMACalcBuffer[i] = LowerHRMACalcBuffer[i-1];
            }
        }
        else if(i > 0)
        {
            UpperHRMACalcBuffer[i] = UpperHRMACalcBuffer[i-1];
            LowerHRMACalcBuffer[i] = LowerHRMACalcBuffer[i-1];
        }
    }

    // Calculate HRMA for middle bands
    CalculateHRMA(rates_total, start, UpperHRMACalcBuffer, UpperMiddleBuffer, UpperRMA1Buffer, UpperRMA2Buffer);
    CalculateHRMA(rates_total, start, LowerHRMACalcBuffer, LowerMiddleBuffer, LowerRMA1Buffer, LowerRMA2Buffer);

    // Fill initial bars with zero
    if(prev_calculated == 0)
    {
        for(int i = 0; i < DrawBeginIndex; i++)
        {
            UltraExtremeUpperBandBuffer[i] = 0;
            ExtremeUpperBandBuffer[i] = 0;
            UpperMostBandBuffer[i] = 0;
            UpperBandBuffer[i] = 0;
            UpperMiddleBuffer[i] = 0;
            LowerMiddleBuffer[i] = 0;
            LowerBandBuffer[i] = 0;
            LowerMostBandBuffer[i] = 0;
            ExtremeLowerBandBuffer[i] = 0;
            UltraExtremeLowerBandBuffer[i] = 0;
        }
    }

    // Calculate all bands
    int calc_start = MathMax(DrawBeginIndex, start);
    for(int i = calc_start; i < rates_total && !IsStopped(); i++)
    {
        int htf_bar_shift = iBarShift(_Symbol, AnalysisTimeframe, time[i], true);

        if(htf_bar_shift >= 0)
        {
            double htf_atr[];
            ArraySetAsSeries(htf_atr, true);

            int copied = CopyBuffer(HTF_ATRHandle, 0, htf_bar_shift, 1, htf_atr);

            if(copied > 0 && htf_atr[0] > 0)
            {
                // Calculate all 10 bands
                UltraExtremeUpperBandBuffer[i] = UpperMiddleBuffer[i] + ATRMultiplier_UltraExtremeUpper * htf_atr[0];
                ExtremeUpperBandBuffer[i] = UpperMiddleBuffer[i] + ATRMultiplier_ExtremeUpper * htf_atr[0];
                UpperMostBandBuffer[i] = UpperMiddleBuffer[i] + ATRMultiplier_UpperMost * htf_atr[0];
                UpperBandBuffer[i] = UpperMiddleBuffer[i] + ATRMultiplier_Upper * htf_atr[0];
                LowerBandBuffer[i] = LowerMiddleBuffer[i] - ATRMultiplier_Lower * htf_atr[0];
                LowerMostBandBuffer[i] = LowerMiddleBuffer[i] - ATRMultiplier_LowerMost * htf_atr[0];
                ExtremeLowerBandBuffer[i] = LowerMiddleBuffer[i] - ATRMultiplier_ExtremeLower * htf_atr[0];
                UltraExtremeLowerBandBuffer[i] = LowerMiddleBuffer[i] - ATRMultiplier_UltraExtremeLower * htf_atr[0];
            }
            else if(i > DrawBeginIndex)
            {
                // Use previous values if ATR not available
                UltraExtremeUpperBandBuffer[i] = UltraExtremeUpperBandBuffer[i-1];
                ExtremeUpperBandBuffer[i] = ExtremeUpperBandBuffer[i-1];
                UpperMostBandBuffer[i] = UpperMostBandBuffer[i-1];
                UpperBandBuffer[i] = UpperBandBuffer[i-1];
                LowerBandBuffer[i] = LowerBandBuffer[i-1];
                LowerMostBandBuffer[i] = LowerMostBandBuffer[i-1];
                ExtremeLowerBandBuffer[i] = ExtremeLowerBandBuffer[i-1];
                UltraExtremeLowerBandBuffer[i] = UltraExtremeLowerBandBuffer[i-1];
            }
        }
        else if(i > DrawBeginIndex)
        {
            // Use previous values if bar shift fails
            UltraExtremeUpperBandBuffer[i] = UltraExtremeUpperBandBuffer[i-1];
            ExtremeUpperBandBuffer[i] = ExtremeUpperBandBuffer[i-1];
            UpperMostBandBuffer[i] = UpperMostBandBuffer[i-1];
            UpperBandBuffer[i] = UpperBandBuffer[i-1];
            LowerBandBuffer[i] = LowerBandBuffer[i-1];
            LowerMostBandBuffer[i] = LowerMostBandBuffer[i-1];
            ExtremeLowerBandBuffer[i] = ExtremeLowerBandBuffer[i-1];
            UltraExtremeLowerBandBuffer[i] = UltraExtremeLowerBandBuffer[i-1];
        }
    }

    return rates_total;
}

//+------------------------------------------------------------------+
//| ChartEvent function to handle button clicks                      |
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
            if(ExportKeltnerData())
                Print("SUCCESS: Keltner Channel 10-Band data exported successfully");
            else
                Print("ERROR: Failed to export Keltner Channel 10-Band data. See above for details.");

            // Reset button state
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        }
    }
}

//+------------------------------------------------------------------+
//| Export Keltner Channel 10-Band data                              |
//+------------------------------------------------------------------+
bool ExportKeltnerData()
{
    string symbol = Symbol();

    // Determine which timeframe to use
    ENUM_TIMEFRAMES timeframe = InpExportTimeframe;
    if(timeframe == PERIOD_CURRENT)
        timeframe = Period();

    // Determine how many bars to export
    int bars_to_export = InpBars;
    if(bars_to_export <= 0)
        bars_to_export = 1000;

    // Check available bars
    ResetLastError();
    int max_bars = iBars(symbol, timeframe);
    int error = GetLastError();

    if(max_bars <= 0)
    {
        Print("ERROR: No bars available for symbol '", symbol, "' with timeframe ",
              EnumToString(timeframe), ". Error: ", error);
        return false;
    }

    if(bars_to_export > max_bars)
    {
        bars_to_export = max_bars;
        Print("Reduced requested bars to maximum available: ", bars_to_export);
    }

    // Generate filenames
    string txt_filename = GenerateFilename(InpBaseFileName, symbol, timeframe, "txt");
    string json_filename = GenerateFilename(InpBaseFileName, symbol, timeframe, "json");

    Print("Exporting ", bars_to_export, " bars of Keltner Channel 10-Band data for ", symbol, " @ ", EnumToString(timeframe));

    // Get the data
    datetime time[];
    ArraySetAsSeries(time, true);

    // Copy time data
    ResetLastError();
    int time_copied = CopyTime(symbol, timeframe, 0, bars_to_export, time);
    error = GetLastError();

    if(time_copied != bars_to_export)
    {
        Print("ERROR: Failed copying time data. Requested: ", bars_to_export,
              ", Got: ", time_copied, ", Error: ", error);
        return false;
    }

    // Export the data to both formats
    bool txt_success = ExportToTxt(symbol, timeframe, txt_filename, time, bars_to_export);

    bool json_success = true;
    if(InpExportJSON)
        json_success = ExportToJson(symbol, timeframe, json_filename, time, bars_to_export);

    return txt_success && (InpExportJSON ? json_success : true);
}

//+------------------------------------------------------------------+
//| Export Keltner 10-Band data to TXT file                          |
//+------------------------------------------------------------------+
bool ExportToTxt(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[],
                 const int bars_count)
{
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
    Print("Exporting to TXT file: ", full_path);

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
    int error = GetLastError();

    if(file_handle == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open TXT file for writing. Error: ", error);
        return false;
    }

    bool write_success = true;

    string tf_str = GetTimeframeString(timeframe);

    // Write metadata header if requested
    if(InpIncludeMetadata)
    {
        write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
        write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
        write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
        write_success &= FileWrite(file_handle, "Number of Bars: " + IntegerToString(bars_count)) > 0;
        write_success &= FileWrite(file_handle, "HRMA Period: " + IntegerToString(HRMAPeriod)) > 0;
        write_success &= FileWrite(file_handle, "ATR Period: " + IntegerToString(ATRPeriod)) > 0;
        write_success &= FileWrite(file_handle, "ATR Multipliers: UltraExtremeUpper=" + DoubleToString(ATRMultiplier_UltraExtremeUpper, 2) +
                          " ExtremeUpper=" + DoubleToString(ATRMultiplier_ExtremeUpper, 2) +
                          " UpperMost=" + DoubleToString(ATRMultiplier_UpperMost, 2) +
                          " Upper=" + DoubleToString(ATRMultiplier_Upper, 2) +
                          " Lower=" + DoubleToString(ATRMultiplier_Lower, 2) +
                          " LowerMost=" + DoubleToString(ATRMultiplier_LowerMost, 2) +
                          " ExtremeLower=" + DoubleToString(ATRMultiplier_ExtremeLower, 2) +
                          " UltraExtremeLower=" + DoubleToString(ATRMultiplier_UltraExtremeLower, 2)) > 0;
        write_success &= FileWrite(file_handle, "") > 0;  // Empty line
    }

    // Write 14-column data header
    write_success &= FileWrite(file_handle, "No\tTimeStamp\tSymbol\tTimeframe\tkc_ultra_extreme_upper\tkc_extreme_upper\tkc_uppermost\tkc_upper\tkc_upper_middle\tkc_lower_middle\tkc_lower\tkc_lowermost\tkc_extreme_lower\tkc_ultra_extreme_lower") > 0;

    // Get current chart data size to properly index buffers
    int chart_bars = iBars(symbol, timeframe);

    // Write data rows in series order (newest first)
    for(int i = 0; i < bars_count; i++)
    {
        // Convert series index to buffer index
        int buffer_index = chart_bars - 1 - i;

        // Ensure we don't go out of bounds
        if(buffer_index < 0 || buffer_index >= ArraySize(UltraExtremeUpperBandBuffer))
            continue;

        string line = StringFormat("%d\t%s\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f",
                                  i,
                                  TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                                  symbol,
                                  tf_str,
                                  UltraExtremeUpperBandBuffer[buffer_index],
                                  ExtremeUpperBandBuffer[buffer_index],
                                  UpperMostBandBuffer[buffer_index],
                                  UpperBandBuffer[buffer_index],
                                  UpperMiddleBuffer[buffer_index],
                                  LowerMiddleBuffer[buffer_index],
                                  LowerBandBuffer[buffer_index],
                                  LowerMostBandBuffer[buffer_index],
                                  ExtremeLowerBandBuffer[buffer_index],
                                  UltraExtremeLowerBandBuffer[buffer_index]);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write some data to TXT file");
        return false;
    }

    Print("Keltner Channel 10-Band data successfully exported to TXT file: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Export Keltner 10-Band data to JSON file                         |
//+------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                  const ENUM_TIMEFRAMES timeframe,
                  const string filename,
                  const datetime &time[],
                  const int bars_count)
{
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
    Print("Exporting to JSON file: ", full_path);

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
    int error = GetLastError();

    if(file_handle == INVALID_HANDLE)
    {
        Print("ERROR: Failed to open JSON file for writing. Error: ", error);
        return false;
    }

    bool write_success = true;

    string tf_str = GetTimeframeString(timeframe);

    // Write JSON header
    write_success &= FileWrite(file_handle, "{") > 0;
    write_success &= FileWrite(file_handle, "    \"symbol\": \"", symbol, "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"bars\": ", bars_count, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"hrmaPeriod\": ", HRMAPeriod, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"atrPeriod\": ", ATRPeriod, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"atrMultipliers\": {") > 0;
    write_success &= FileWrite(file_handle, "        \"ultraExtremeUpper\": ", DoubleToString(ATRMultiplier_UltraExtremeUpper, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"extremeUpper\": ", DoubleToString(ATRMultiplier_ExtremeUpper, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"upperMost\": ", DoubleToString(ATRMultiplier_UpperMost, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"upper\": ", DoubleToString(ATRMultiplier_Upper, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"lower\": ", DoubleToString(ATRMultiplier_Lower, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"lowerMost\": ", DoubleToString(ATRMultiplier_LowerMost, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"extremeLower\": ", DoubleToString(ATRMultiplier_ExtremeLower, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "        \"ultraExtremeLower\": ", DoubleToString(ATRMultiplier_UltraExtremeLower, 2)) > 0;
    write_success &= FileWrite(file_handle, "    },") > 0;
    write_success &= FileWrite(file_handle, "    \"data\": [") > 0;

    // Get current chart data size to properly index buffers
    int chart_bars = iBars(symbol, timeframe);

    // Write data rows in series order (newest first)
    for(int i = 0; i < bars_count; i++)
    {
        // Convert series index to buffer index
        int buffer_index = chart_bars - 1 - i;

        // Ensure we don't go out of bounds
        if(buffer_index < 0 || buffer_index >= ArraySize(UltraExtremeUpperBandBuffer))
            continue;

        if(i > 0)
            FileWrite(file_handle, "        ,");

        write_success &= FileWrite(file_handle, "        {") > 0;
        write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
        write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"symbol\": \"", symbol, "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"timeframe\": \"", tf_str, "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_ultra_extreme_upper\": ", DoubleToString(UltraExtremeUpperBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_extreme_upper\": ", DoubleToString(ExtremeUpperBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_uppermost\": ", DoubleToString(UpperMostBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_upper\": ", DoubleToString(UpperBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_upper_middle\": ", DoubleToString(UpperMiddleBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_lower_middle\": ", DoubleToString(LowerMiddleBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_lower\": ", DoubleToString(LowerBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_lowermost\": ", DoubleToString(LowerMostBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_extreme_lower\": ", DoubleToString(ExtremeLowerBandBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"kc_ultra_extreme_lower\": ", DoubleToString(UltraExtremeLowerBandBuffer[buffer_index], 5)) > 0;
        write_success &= FileWrite(file_handle, "        }") > 0;
    }

    // Close JSON structure
    write_success &= FileWrite(file_handle, "    ]") > 0;
    write_success &= FileWrite(file_handle, "}") > 0;

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write some data to JSON file");
        return false;
    }

    Print("Keltner Channel 10-Band data successfully exported to JSON file: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Deinitialization                                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    if(HTF_ATRHandle != INVALID_HANDLE)
        IndicatorRelease(HTF_ATRHandle);

    // Delete export button
    ObjectDelete(0, EXPORT_BUTTON_NAME);

    ChartRedraw();
    Comment("");
}
//+------------------------------------------------------------------+
