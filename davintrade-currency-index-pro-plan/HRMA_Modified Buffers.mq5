//+------------------------------------------------------------------+
//|                                         SimplifiedHRMAIndicator.mq5 |
//|                             Copyright 2024, Your Name             |
//|                                     https://www.yourwebsite.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Simplified HRMA Indicator"
#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   1

// HRMA properties
#property indicator_label1  "HRMA"
#property indicator_type1   DRAW_LINE
#property indicator_color1  Blue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

// Input parameters
input int                len_hrma = 36;               // HRMA period (36 periods Equivalent to 18 periods in Normal HRMA)
input ENUM_APPLIED_PRICE InpAppliedPrice = PRICE_TYPICAL; // Applied price
input bool               use_ohlc4 = false;           // Use OHLC4 for HRMA calculations

// Indicator buffers
double HRMABuffer[];
double HRMACalcBuffer[];
double RMA1Buffer[];
double RMA2Buffer[];

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Indicator buffers mapping
    SetIndexBuffer(0, HRMABuffer, INDICATOR_DATA);
    SetIndexBuffer(1, HRMACalcBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(2, RMA1Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(3, RMA2Buffer, INDICATOR_CALCULATIONS);

    // Initialize buffers
    ArrayInitialize(HRMABuffer, 0);
    ArrayInitialize(HRMACalcBuffer, 0);
    ArrayInitialize(RMA1Buffer, 0);
    ArrayInitialize(RMA2Buffer, 0);

    // Set indicator digits
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

    // Set indicator short name
    string short_name = StringFormat("HRMA(%d)", len_hrma);
    IndicatorSetString(INDICATOR_SHORTNAME, short_name);

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
    if(rates_total < len_hrma) return 0;

    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;

    // Calculate price array for HRMA
    for(int i = start; i < rates_total; i++)
    {
        if(use_ohlc4)
        {
            HRMACalcBuffer[i] = (open[i] + high[i] + low[i] + close[i]) / 4.0;
        }
        else
        {
            HRMACalcBuffer[i] = GetAppliedPrice(InpAppliedPrice, open[i], high[i], low[i], close[i]);
        }
    }

    // Calculate HRMA
    CalculateHRMA(rates_total, start, HRMACalcBuffer, HRMABuffer);

    return(rates_total);
}

//+------------------------------------------------------------------+
//| Calculate HRMA using RMA approach                                |
//+------------------------------------------------------------------+
void CalculateHRMA(int rates_total, int start, const double &price[], double &hrma[])
{
    double alpha1 = 2.0 / (len_hrma / 2.0 + 1);
    double alpha2 = 2.0 / (len_hrma + 1);
    double alpha3 = 2.0 / (MathSqrt(len_hrma) + 1);

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