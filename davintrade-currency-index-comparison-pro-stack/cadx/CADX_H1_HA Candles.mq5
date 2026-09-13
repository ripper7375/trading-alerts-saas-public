//+------------------------------------------------------------------+
//|                                              CADX_H1_OHLC_Candles.mq5|
//|                             Copyright 2024                           |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 5
#property indicator_plots   1
#property indicator_type1   DRAW_COLOR_CANDLES
#property indicator_color1  clrDodgerBlue, clrPink
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2
#property indicator_label1  "CADX HA"

input group "Index Label Settings"
input bool ShowCurrencyIndexLabel = true;   // Show Currency Index Label
input color LabelColor = clrBlue;           // Label Color
input int LabelFontSize = 10;               // Label Font Size
input int LabelRightOffset = 20;            // Label Position (1-50 bars to the right)

string currencyIndexLabel = "";  // Label object name
string indexName = "";          // To store the 4-char index name

// Buffers
double HAOpenBuffer[];
double HAHighBuffer[];
double HALowBuffer[];
double HACloseBuffer[];
double HAColorBuffer[];

// Handles for indicators
int handle_open = INVALID_HANDLE;
int handle_high = INVALID_HANDLE;
int handle_low = INVALID_HANDLE;
int handle_close = INVALID_HANDLE;

string GetIndicatorName()
{
    string fileName = __FILE__;  // Get full path of current file
    string shortName = StringSubstr(fileName, StringFind(fileName, "\\", -1) + 1);  // Get filename only
    return StringSubstr(shortName, 0, 4);  // Return first 4 characters (e.g. AUDX, CHFX, CADX)
}

//+------------------------------------------------------------------+
//| Custom indicator initialization function                           |
//+------------------------------------------------------------------+
int OnInit()
{
    // Map indicator buffers
    SetIndexBuffer(0, HAOpenBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, HAHighBuffer, INDICATOR_DATA);
    SetIndexBuffer(2, HALowBuffer, INDICATOR_DATA);
    SetIndexBuffer(3, HACloseBuffer, INDICATOR_DATA);
    SetIndexBuffer(4, HAColorBuffer, INDICATOR_COLOR_INDEX);
    
    // Set plotting properties
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);
    
    // Set indicator digits
    IndicatorSetInteger(INDICATOR_DIGITS, 2);
    
    // Set indicator shortname
    IndicatorSetString(INDICATOR_SHORTNAME, "CADX H1 Heiken Ashi");
    
    // Get indicator handles
    handle_open = iCustom(Symbol(), Period(), "CADX_H1_Open", false, false);
    handle_high = iCustom(Symbol(), Period(), "CADX_H1_High", false, false);
    handle_low = iCustom(Symbol(), Period(), "CADX_H1_Low", false, false);
    handle_close = iCustom(Symbol(), Period(), "CADX_H1_Close", false, false);
    
    if(handle_open == INVALID_HANDLE || handle_high == INVALID_HANDLE || 
       handle_low == INVALID_HANDLE || handle_close == INVALID_HANDLE)
    {
        Print("Error: Failed to get indicator handles!");
        Print("Open Handle: ", handle_open);
        Print("High Handle: ", handle_high);
        Print("Low Handle: ", handle_low);
        Print("Close Handle: ", handle_close);
        return(INIT_FAILED);
    }
    
    // Get index name from filename
    indexName = GetIndicatorName();  // Will return AUDX, CHFX, etc.

    // And in OnInit(), add validation:
    if(LabelRightOffset < 1 || LabelRightOffset > 50)
    {
    Print("Error: Label Right Offset must be between 1 and 50 bars");
    return INIT_PARAMETERS_INCORRECT;
    }
    
    // Initialize label
    if(ShowCurrencyIndexLabel)
    {
        currencyIndexLabel = indexName + "_Label";
        ObjectCreate(0, currencyIndexLabel, OBJ_TEXT, 0, 0, 0);
        ObjectSetInteger(0, currencyIndexLabel, OBJPROP_COLOR, LabelColor);
        ObjectSetInteger(0, currencyIndexLabel, OBJPROP_FONTSIZE, LabelFontSize);
        ObjectSetString(0, currencyIndexLabel, OBJPROP_FONT, "Arial");
        ObjectSetInteger(0, currencyIndexLabel, OBJPROP_SELECTABLE, false);
        ObjectSetInteger(0, currencyIndexLabel, OBJPROP_HIDDEN, true);
    }
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function                                |
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
    if(rates_total < 1) return 0;
    
    // Calculate start position
    int start = prev_calculated == 0 ? 0 : prev_calculated - 1;
    
    // Arrays to store indicator values
    double open_values[], high_values[], low_values[], close_values[];
    ArraySetAsSeries(open_values, true);
    ArraySetAsSeries(high_values, true);
    ArraySetAsSeries(low_values, true);
    ArraySetAsSeries(close_values, true);
    
    // Copy data from indicators
    if(CopyBuffer(handle_open, 0, 0, rates_total, open_values) <= 0 ||
       CopyBuffer(handle_high, 0, 0, rates_total, high_values) <= 0 ||
       CopyBuffer(handle_low, 0, 0, rates_total, low_values) <= 0 ||
       CopyBuffer(handle_close, 0, 0, rates_total, close_values) <= 0)
    {
        Print("Failed to copy indicator buffers");
        return 0;
    }
    
    // Calculate Heiken Ashi values
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        int idx = rates_total - 1 - i;
        
        // Get regular OHLC values
        double open_price = open_values[idx];
        double high_price = high_values[idx];
        double low_price = low_values[idx];
        double close_price = close_values[idx];
        
        // Check for invalid values
        if(open_price == EMPTY_VALUE || high_price == EMPTY_VALUE || 
           low_price == EMPTY_VALUE || close_price == EMPTY_VALUE)
        {
            HAOpenBuffer[i] = EMPTY_VALUE;
            HAHighBuffer[i] = EMPTY_VALUE;
            HALowBuffer[i] = EMPTY_VALUE;
            HACloseBuffer[i] = EMPTY_VALUE;
            HAColorBuffer[i] = 0;
            continue;
        }
        
        // Calculate Heiken Ashi values
        double ha_close = (open_price + high_price + low_price + close_price) / 4;
        double ha_open = (i == 0) ? open_price : (HAOpenBuffer[i-1] + HACloseBuffer[i-1]) / 2;
        double ha_high = MathMax(high_price, MathMax(ha_open, ha_close));
        double ha_low = MathMin(low_price, MathMin(ha_open, ha_close));
        
        // Store Heiken Ashi values
        HAOpenBuffer[i] = ha_open;
        HAHighBuffer[i] = ha_high;
        HALowBuffer[i] = ha_low;
        HACloseBuffer[i] = ha_close;
        
        // Set color (0 for bullish - DodgerBlue, 1 for bearish - Pink)
        HAColorBuffer[i] = (ha_close >= ha_open) ? 0 : 1;
    }
    
    // In OnCalculate() - Modify label positioning using the offset
    if(ShowCurrencyIndexLabel && rates_total > 0)
    {
        double open_values[];
        ArraySetAsSeries(open_values, true);
        
        // Get the latest open value
        if(CopyBuffer(handle_open, 0, 0, 1, open_values) > 0)
        {
            // Position with user-defined offset
            datetime currentTime = iTime(_Symbol, PERIOD_H4, 0);
            datetime labelTime = currentTime + (PeriodSeconds(PERIOD_H4) * LabelRightOffset);  // User configurable offset
            double openPrice = open_values[0];
            
            // Update label position and text
            ObjectSetString(0, currencyIndexLabel, OBJPROP_TEXT, indexName);
            ObjectSetInteger(0, currencyIndexLabel, OBJPROP_TIME, labelTime);
            ObjectSetDouble(0, currencyIndexLabel, OBJPROP_PRICE, openPrice);
        }
    }
    
    return(rates_total);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Clean up currency index label
    if(currencyIndexLabel != "")
        ObjectDelete(0, currencyIndexLabel);

    // Clean up existing handles and objects
    if(handle_open != INVALID_HANDLE) IndicatorRelease(handle_open);
    if(handle_high != INVALID_HANDLE) IndicatorRelease(handle_high);
    if(handle_low != INVALID_HANDLE) IndicatorRelease(handle_low);
    if(handle_close != INVALID_HANDLE) IndicatorRelease(handle_close);
    
    Comment("");  // Clear chart comment
    ChartRedraw();
}