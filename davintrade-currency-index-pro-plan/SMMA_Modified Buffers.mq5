//+------------------------------------------------------------------+
//|                                          ImprovedSMMAIndicator.mq5 |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Improved Smoothed Moving Average (SMMA) Indicator"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   1

// SMMA properties
#property indicator_label1  "SMMA"
#property indicator_type1   DRAW_LINE
#property indicator_color1  Red
#property indicator_style1  STYLE_SOLID
#property indicator_width1  1

// Input parameters
input int                InpMAPeriod = 13;              // Period
input int                InpMAShift = 0;                // Shift
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_CLOSE; // Applied price

// Indicator buffers
double SMMABuffer[];    // Main SMMA buffer
double PriceBuffer[];   // Price buffer for calculations

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Indicator buffers mapping
    SetIndexBuffer(0, SMMABuffer, INDICATOR_DATA);
    SetIndexBuffer(1, PriceBuffer, INDICATOR_CALCULATIONS);
    
    // Initialize buffers
    ArrayInitialize(SMMABuffer, 0);
    ArrayInitialize(PriceBuffer, 0);
    
    // Set indicator properties
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits + 1);
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, InpMAPeriod - 1);
    PlotIndexSetInteger(0, PLOT_SHIFT, InpMAShift);
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
    
    // Set indicator name
    string short_name = StringFormat("SMMA(%d)", InpMAPeriod);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);
    PlotIndexSetString(0, PLOT_LABEL, short_name);
    
    return(INIT_SUCCEEDED);
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
    if(rates_total < InpMAPeriod) 
        return 0;
    
    // Calculate start position
    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;
    
    // Calculate price array
    for(int i = start; i < rates_total; i++)
    {
        PriceBuffer[i] = GetAppliedPrice(InpAppliedPrice, open[i], high[i], low[i], close[i]);
    }
    
    // Calculate SMMA
    CalculateSMMA(rates_total, prev_calculated);
    
    return(rates_total);
}

//+------------------------------------------------------------------+
//| Calculate SMMA using the original methodology                    |
//+------------------------------------------------------------------+
void CalculateSMMA(int rates_total, int prev_calculated)
{
    int i, start;
    
    // First calculation or number of bars was changed
    if(prev_calculated == 0)
    {
        // Set start position
        start = InpMAPeriod;
        
        // Set empty values for first bars
        for(i = 0; i < start - 1; i++)
            SMMABuffer[i] = 0.0;
        
        // Calculate first visible value
        double first_value = 0;
        for(i = 0; i < start; i++)
            first_value += PriceBuffer[i];
            
        first_value /= InpMAPeriod;
        SMMABuffer[start - 1] = first_value;
    }
    else
    {
        start = prev_calculated - 1;
    }
    
    // Main calculation loop with original SMMA formula
    for(i = start; i < rates_total && !IsStopped(); i++)
    {
        SMMABuffer[i] = (SMMABuffer[i - 1] * (InpMAPeriod - 1) + PriceBuffer[i]) / InpMAPeriod;
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
        default:            return close;
    }
}
//+------------------------------------------------------------------+