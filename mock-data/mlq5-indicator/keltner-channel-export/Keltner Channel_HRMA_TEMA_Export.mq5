//+------------------------------------------------------------------+
//|                                   HRMA_KeltnerTEMA_Export.mq5    |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.02"
#property description "HRMA-based Keltner Channel with TEMA Calculator and Export Functionality"

// No visualization - this is a non-plotting indicator
#property indicator_chart_window
#property indicator_buffers 9
#property indicator_plots   0

//--- Button name constants
#define EXPORT_BUTTON_NAME "KeltnerTEMAExportButton"

// Input parameters for Keltner Channel calculation
input int    InpHRMAPeriod = 36;       // HRMA Period
input int    InpATRPeriod = 84;        // ATR Period
input double InpATRFactor = 2.5;       // ATR Multiplier
input int    InpTEMAPeriod = 9;       // TEMA Period
input int    InpShift = 0;             // Bar Shift (0 = no shift, 1 = 1-bar shift, etc.)
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_TYPICAL; // Applied price for HRMA
input ENUM_APPLIED_PRICE InpTEMAAppliedPrice = PRICE_TYPICAL; // TEMA Applied price
input bool   use_ohlc4 = false;        // Use OHLC4 for HRMA calculations

// Export parameters
input ENUM_TIMEFRAMES      InpTimeframe = PERIOD_CURRENT;        // Timeframe for export
input int                  InpBars = 3000;                      // Number of bars to export
input string               InpBaseFileName = "HRMA_Keltner_TEMA"; // Base file name
input bool                 InpIncludeMetadata = false;           // Include metadata in TXT export
input bool                 InpExportJSON = true;                 // Export JSON file
input bool                 InpCleanFilenames = true;             // Clean filenames (no .txt extension)

// Indicator buffers for calculation
double UpperBuffer[];
double MiddleBuffer[];
double LowerBuffer[];
double TEMABuffer[];
double HRMACalcBuffer[];
double RMA1Buffer[];
double RMA2Buffer[];
double TEMAEMABuffer[];
double TEMAEMAofEMABuffer[];

// Indicator handles
int ATRHandle;

// Global variables
int DrawBeginIndex;
int TEMADrawBeginIndex;

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Validate input parameters
    if(!ValidateInputs())
        return INIT_PARAMETERS_INCORRECT;
        
    // Initialize buffers
    if(!InitializeBuffers())
        return INIT_FAILED;
        
    // Create indicators
    if(!CreateIndicators())
        return INIT_FAILED;
    
    // Create export button
    CreateExportButton();
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Validate input parameters                                        |
//+------------------------------------------------------------------+
bool ValidateInputs()
{
    if(InpHRMAPeriod < 10)
    {
        PrintFormat("Incorrect value for input variable InpHRMAPeriod=%d. Indicator will use value=%d for calculations.",
                    InpHRMAPeriod, 20);
        return false;
    }
    
    if(InpATRPeriod < 3)
    {
        PrintFormat("Incorrect value for input variable InpATRPeriod=%d. Indicator will use value=%d for calculations.",
                    InpATRPeriod, 10);
        return false;
    }
    
    if(InpATRFactor < 1.0)
    {
        PrintFormat("Incorrect value for input variable InpATRFactor=%f. Indicator will use value=%f for calculations.",
                    InpATRFactor, 2.0);
        return false;
    }
    
    if(InpTEMAPeriod < 3)
    {
        PrintFormat("Incorrect value for input variable InpTEMAPeriod=%d. Indicator will use value=%d for calculations.",
                    InpTEMAPeriod, 10);
        return false;
    }
    
    if(InpShift < 0)
    {
        PrintFormat("Incorrect value for input variable InpShift=%d. Indicator will use value=%d for calculations.",
                    InpShift, 1);
        return false;
    }
    
    return true;
}

//+------------------------------------------------------------------+
//| Initialize indicator buffers                                     |
//+------------------------------------------------------------------+
bool InitializeBuffers()
{
    // Map indicator buffers (no plotting)
    SetIndexBuffer(0, UpperBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(1, MiddleBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(2, LowerBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(3, TEMABuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(4, HRMACalcBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(5, RMA1Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(6, RMA2Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(7, TEMAEMABuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(8, TEMAEMAofEMABuffer, INDICATOR_CALCULATIONS);
    
    // Initialize buffers
    ArrayInitialize(UpperBuffer, 0);
    ArrayInitialize(MiddleBuffer, 0);
    ArrayInitialize(LowerBuffer, 0);
    ArrayInitialize(TEMABuffer, 0);
    ArrayInitialize(HRMACalcBuffer, 0);
    ArrayInitialize(RMA1Buffer, 0);
    ArrayInitialize(RMA2Buffer, 0);
    ArrayInitialize(TEMAEMABuffer, 0);
    ArrayInitialize(TEMAEMAofEMABuffer, 0);
    
    // Calculate draw begin indices
    DrawBeginIndex = MathMax(InpHRMAPeriod, InpATRPeriod) + 1;
    TEMADrawBeginIndex = 3 * InpTEMAPeriod - 3;
    
    // Set indicator digits and name
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
    IndicatorSetString(INDICATOR_SHORTNAME, "HRMA Keltner Channel + TEMA Export");
    
    return true;
}

//+------------------------------------------------------------------+
//| Create required indicators                                       |
//+------------------------------------------------------------------+
bool CreateIndicators()
{
    // Create ATR indicator
    ATRHandle = iATR(NULL, 0, InpATRPeriod);
    
    return (ATRHandle != INVALID_HANDLE);
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
    int button_width = 220;     
    int button_height = 50;    
    int x_margin = 250;       
    int y_margin = 100;      

    // Position at right side
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

    // Text and font properties
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Keltner+TEMA Data");
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
//| Calculate HRMA using RMA approach                                |
//+------------------------------------------------------------------+
void CalculateHRMA(int rates_total, int start, const double &price[], double &hrma[])
{
    double alpha1 = 2.0 / (InpHRMAPeriod / 2.0 + 1);
    double alpha2 = 2.0 / (InpHRMAPeriod + 1);
    double alpha3 = 2.0 / (MathSqrt(InpHRMAPeriod) + 1);

    for(int i = start; i < rates_total; i++)
    {
        if(i == 0)
        {
            RMA1Buffer[i] = price[i];
            RMA2Buffer[i] = price[i];
            hrma[i] = price[i];
        }
        else
        {
            RMA1Buffer[i] = alpha1 * price[i] + (1 - alpha1) * RMA1Buffer[i-1];
            RMA2Buffer[i] = alpha2 * price[i] + (1 - alpha2) * RMA2Buffer[i-1];
            double hrmaValue = 2 * RMA1Buffer[i] - RMA2Buffer[i];
            hrma[i] = alpha3 * hrmaValue + (1 - alpha3) * hrma[i-1];
        }
    }
}

//+------------------------------------------------------------------+
//| Calculate TEMA using simplified approach                         |
//+------------------------------------------------------------------+
void CalculateTEMA(int rates_total, int start, const double &price[])
{
    double alpha = 2.0 / (InpTEMAPeriod + 1);
    double TEMAEMAofEMAofEMABuffer[];
    ArrayResize(TEMAEMAofEMAofEMABuffer, rates_total);
    ArrayInitialize(TEMAEMAofEMAofEMABuffer, 0);
    
    // Calculate first EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i == 0)
        {
            TEMAEMABuffer[i] = price[i];
        }
        else
        {
            TEMAEMABuffer[i] = alpha * price[i] + (1 - alpha) * TEMAEMABuffer[i - 1];
        }
    }
    
    // Calculate EMA of EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < InpTEMAPeriod - 1)
        {
            TEMAEMAofEMABuffer[i] = 0;
            continue;
        }
        
        if(i == InpTEMAPeriod - 1)
        {
            TEMAEMAofEMABuffer[i] = TEMAEMABuffer[i];
        }
        else
        {
            TEMAEMAofEMABuffer[i] = alpha * TEMAEMABuffer[i] + (1 - alpha) * TEMAEMAofEMABuffer[i - 1];
        }
    }
    
    // Calculate EMA of EMA of EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < 2 * InpTEMAPeriod - 2)
        {
            TEMAEMAofEMAofEMABuffer[i] = 0;
            continue;
        }
        
        if(i == 2 * InpTEMAPeriod - 2)
        {
            TEMAEMAofEMAofEMABuffer[i] = TEMAEMAofEMABuffer[i];
        }
        else
        {
            TEMAEMAofEMAofEMABuffer[i] = alpha * TEMAEMAofEMABuffer[i] + (1 - alpha) * TEMAEMAofEMAofEMABuffer[i - 1];
        }
    }
    
    // Calculate final TEMA value
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(i < 3 * InpTEMAPeriod - 3)
        {
            TEMABuffer[i] = 0;
            continue;
        }
        
        TEMABuffer[i] = 3 * TEMAEMABuffer[i] - 3 * TEMAEMAofEMABuffer[i] + TEMAEMAofEMAofEMABuffer[i];
    }
}

//+------------------------------------------------------------------+
//| Get applied price based on enum                                  |
//+------------------------------------------------------------------+
double GetAppliedPrice(ENUM_APPLIED_PRICE applied_price, double open, double high, double low, double close)
{
    switch(applied_price)
    {
        case PRICE_CLOSE:    return close;
        case PRICE_OPEN:     return open;
        case PRICE_HIGH:     return high;
        case PRICE_LOW:      return low;
        case PRICE_MEDIAN:   return (high + low) / 2.0;
        case PRICE_TYPICAL:  return (high + low + close) / 3.0;
        case PRICE_WEIGHTED: return (high + low + close + close) / 4.0;
        default:             return close;
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
    int min_bars_required = MathMax(DrawBeginIndex, TEMADrawBeginIndex);
    if(rates_total < min_bars_required)
        return 0;
        
    // Calculate price arrays for HRMA and TEMA
    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;
    
    // Prepare price arrays
    double tema_price_array[];
    ArrayResize(tema_price_array, rates_total);
    
    for(int i = start; i < rates_total; i++)
    {
        // HRMA price calculation
        if(use_ohlc4)
        {
            HRMACalcBuffer[i] = (open[i] + high[i] + low[i] + close[i]) / 4.0;
        }
        else
        {
            HRMACalcBuffer[i] = GetAppliedPrice(InpAppliedPrice, open[i], high[i], low[i], close[i]);
        }
        
        // TEMA price calculation
        tema_price_array[i] = GetAppliedPrice(InpTEMAAppliedPrice, open[i], high[i], low[i], close[i]);
    }
    
    // Calculate HRMA for middle line
    CalculateHRMA(rates_total, start, HRMACalcBuffer, MiddleBuffer);
    
    // Calculate TEMA
    CalculateTEMA(rates_total, start, tema_price_array);
        
    // If this is the first calculation
    if(prev_calculated == 0)
    {
        // Fill initial bars with empty values
        for(int i = 0; i < DrawBeginIndex; i++)
        {
            UpperBuffer[i] = 0;
            MiddleBuffer[i] = 0;
            LowerBuffer[i] = 0;
        }
        
        for(int i = 0; i < TEMADrawBeginIndex; i++)
        {
            TEMABuffer[i] = 0;
        }
        
        // Get ATR values
        double atr[];
        if(CopyBuffer(ATRHandle, 0, 0, rates_total, atr) < 0)
            return 0;
            
        for(int i = DrawBeginIndex; i < rates_total; i++)
        {
            UpperBuffer[i] = MiddleBuffer[i] + InpATRFactor * atr[i];
            LowerBuffer[i] = MiddleBuffer[i] - InpATRFactor * atr[i];
        }
        
        return rates_total;
    }
    
    // Calculate only new values for Keltner Channel
    start = prev_calculated - 2;
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Get ATR values using reverse index
        int reverse_index = rates_total - i;
        
        double atr[];
        if(CopyBuffer(ATRHandle, 0, reverse_index, 1, atr) < 0)
            return prev_calculated;
            
        // Calculate Keltner Channel bands
        UpperBuffer[i] = MiddleBuffer[i] + InpATRFactor * atr[0];
        LowerBuffer[i] = MiddleBuffer[i] - InpATRFactor * atr[0];
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
                Print("SUCCESS: Keltner Channel + TEMA data exported successfully");
            else
                Print("ERROR: Failed to export Keltner Channel + TEMA data. See above for details.");

            // Reset button state
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        }
    }
}

//+------------------------------------------------------------------+
//| Export Keltner Channel + TEMA data                               |
//+------------------------------------------------------------------+
bool ExportKeltnerData()
{
    string symbol = Symbol();
    
    // Determine which timeframe to use
    ENUM_TIMEFRAMES timeframe = InpTimeframe;
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
    
    Print("Exporting ", bars_to_export, " bars of Keltner Channel + TEMA data for ", symbol, " @ ", EnumToString(timeframe));
    
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
//| Export Keltner + TEMA data to TXT file                           |
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
    
    // Write metadata header if requested
    if(InpIncludeMetadata)
    {
        write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
        write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
        write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
        write_success &= FileWrite(file_handle, "Number of Bars: " + IntegerToString(bars_count)) > 0;
        write_success &= FileWrite(file_handle, "HRMA Period: " + IntegerToString(InpHRMAPeriod)) > 0;
        write_success &= FileWrite(file_handle, "ATR Period: " + IntegerToString(InpATRPeriod)) > 0;
        write_success &= FileWrite(file_handle, "ATR Factor: " + DoubleToString(InpATRFactor, 2)) > 0;
        write_success &= FileWrite(file_handle, "TEMA Period: " + IntegerToString(InpTEMAPeriod)) > 0;
        write_success &= FileWrite(file_handle, "") > 0;  // Empty line
    }
    
    // Write data header with TEMA column
    write_success &= FileWrite(file_handle, "No\tTimeStamp\tUpper Band\tMiddle Band\tLower Band\tTEMA") > 0;
    
    // Get current chart data size to properly index buffers
    int chart_bars = iBars(symbol, timeframe);
    
    // Write data rows in series order (newest first)
    // Time array is in series order, but buffer arrays are normal order
    for(int i = 0; i < bars_count; i++)
    {
        // Find the correct buffer index for this time
        // Since time array is series (newest first) and buffers are normal order (oldest first)
        int buffer_index = chart_bars - 1 - i;  // Convert series index to buffer index
        
        // Ensure we don't go out of bounds
        if(buffer_index < 0 || buffer_index >= ArraySize(UpperBuffer))
            continue;
            
        string line = StringFormat("%d\t%s\t%.5f\t%.5f\t%.5f\t%.5f",
                                  i,
                                  TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                                  UpperBuffer[buffer_index],
                                  MiddleBuffer[buffer_index],
                                  LowerBuffer[buffer_index],
                                  TEMABuffer[buffer_index]);
        
        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);

    if(!write_success)
    {
        Print("ERROR: Failed to write some data to TXT file");
        return false;
    }

    Print("Keltner Channel + TEMA data successfully exported to TXT file: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Export Keltner + TEMA data to JSON file                          |
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
    
    // Write JSON header with TEMA period
    write_success &= FileWrite(file_handle, "{") > 0;
    write_success &= FileWrite(file_handle, "    \"symbol\": \"", symbol, "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
    write_success &= FileWrite(file_handle, "    \"bars\": ", bars_count, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"hrmaPeriod\": ", InpHRMAPeriod, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"atrPeriod\": ", InpATRPeriod, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"atrFactor\": ", DoubleToString(InpATRFactor, 2), ",") > 0;
    write_success &= FileWrite(file_handle, "    \"temaPeriod\": ", InpTEMAPeriod, ",") > 0;
    write_success &= FileWrite(file_handle, "    \"data\": [") > 0;
    
    // Get current chart data size to properly index buffers
    int chart_bars = iBars(symbol, timeframe);
    
    // Write data rows in series order (newest first)
    // Time array is in series order, but buffer arrays are normal order
    for(int i = 0; i < bars_count; i++)
    {
        // Find the correct buffer index for this time
        // Since time array is series (newest first) and buffers are normal order (oldest first)
        int buffer_index = chart_bars - 1 - i;  // Convert series index to buffer index
        
        // Ensure we don't go out of bounds
        if(buffer_index < 0 || buffer_index >= ArraySize(UpperBuffer))
            continue;
        
        if(i > 0)
            FileWrite(file_handle, "        ,");
            
        write_success &= FileWrite(file_handle, "        {") > 0;
        write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
        write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
        write_success &= FileWrite(file_handle, "            \"upperBand\": ", DoubleToString(UpperBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"middleBand\": ", DoubleToString(MiddleBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"lowerBand\": ", DoubleToString(LowerBuffer[buffer_index], 5), ",") > 0;
        write_success &= FileWrite(file_handle, "            \"tema\": ", DoubleToString(TEMABuffer[buffer_index], 5)) > 0;
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

    Print("Keltner Channel + TEMA data successfully exported to JSON file: ", filename);
    return true;
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    if(ATRHandle != INVALID_HANDLE)
        IndicatorRelease(ATRHandle);
        
    // Delete export button
    ObjectDelete(0, EXPORT_BUTTON_NAME);
}
//+------------------------------------------------------------------+