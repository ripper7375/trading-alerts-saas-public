//+------------------------------------------------------------------+
//|                                              TEMA_Dual_HighLow.mq5 |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.01"
#property description "Dual TEMA Indicator - High & Low Price Lines"

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

// Input parameters
input int InpPeriodEMA = 9;  // EMA period
input int InpShift     = 0;   // Indicator's shift

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

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Data buffers first (mapped to plots)
    SetIndexBuffer(0, TEMAHighBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, TEMALowBuffer,  INDICATOR_DATA);

    // Calculation buffers after
    SetIndexBuffer(2, EMAHigh, INDICATOR_CALCULATIONS);
    SetIndexBuffer(3, EMAofEMAHigh, INDICATOR_CALCULATIONS);
    SetIndexBuffer(4, EMAofEMAofEMAHigh, INDICATOR_CALCULATIONS);
    SetIndexBuffer(5, EMALow, INDICATOR_CALCULATIONS);
    SetIndexBuffer(6, EMAofEMALow, INDICATOR_CALCULATIONS);
    SetIndexBuffer(7, EMAofEMAofEMALow, INDICATOR_CALCULATIONS);

    // Initialize all buffers
    ArrayInitialize(TEMAHighBuffer, 0);
    ArrayInitialize(TEMALowBuffer, 0);
    ArrayInitialize(EMAHigh, 0);
    ArrayInitialize(EMAofEMAHigh, 0);
    ArrayInitialize(EMAofEMAofEMAHigh, 0);
    ArrayInitialize(EMALow, 0);
    ArrayInitialize(EMAofEMALow, 0);
    ArrayInitialize(EMAofEMAofEMALow, 0);

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
    if(rates_total < 3 * InpPeriodEMA - 3)
        return 0;

    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;

    // Calculate both TEMA lines
    CalculateTEMA(rates_total, start, high, TEMAHighBuffer, EMAHigh, EMAofEMAHigh, EMAofEMAofEMAHigh);
    CalculateTEMA(rates_total, start, low,  TEMALowBuffer,  EMALow,  EMAofEMALow,  EMAofEMAofEMALow);

    return(rates_total);
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