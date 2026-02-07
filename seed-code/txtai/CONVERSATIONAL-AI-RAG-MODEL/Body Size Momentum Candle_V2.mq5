//+------------------------------------------------------------------+
//|                              ImprovedBodySizeMomentumIndicator.mq5 |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Improved Body Size Momentum Candle Indicator"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 7
#property indicator_plots   1
#property indicator_type1   DRAW_COLOR_CANDLES

// Input parameters
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
        // Note: We can't modify input parameters, so we'll use a local variable
    }
    
    // Indicator buffers mapping
    SetIndexBuffer(0, OpenBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, HighBuffer, INDICATOR_DATA);
    SetIndexBuffer(2, LowBuffer, INDICATOR_DATA);
    SetIndexBuffer(3, CloseBuffer, INDICATOR_DATA);
    SetIndexBuffer(4, ColorBuffer, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(5, BodySizeBuffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(6, ZScoreBuffer, INDICATOR_CALCULATIONS);
    
    // Initialize buffers
    ArrayInitialize(OpenBuffer, 0);
    ArrayInitialize(HighBuffer, 0);
    ArrayInitialize(LowBuffer, 0);
    ArrayInitialize(CloseBuffer, 0);
    ArrayInitialize(ColorBuffer, 0);
    ArrayInitialize(BodySizeBuffer, 0);
    ArrayInitialize(ZScoreBuffer, 0);
    
    // Set indicator properties
    IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
    
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
    if(rates_total < InpZScoreLength)
        return 0;
    
    // Calculate start position
    int start;
    if(prev_calculated == 0)
        start = InpZScoreLength;
    else
        start = prev_calculated - 1;
    
    // Calculate body sizes and statistics
    CalculateBodySizeStats(rates_total, start, open, high, low, close);
    
    return(rates_total);
}

//+------------------------------------------------------------------+
//| Calculate body sizes and their statistics                        |
//+------------------------------------------------------------------+
void CalculateBodySizeStats(const int rates_total,
                           const int start,
                           const double &open[],
                           const double &high[],
                           const double &low[],
                           const double &close[])
{
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Calculate body size
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
    double stdDev = MathSqrt(variance);
    
    // Calculate Z-Score
    ZScoreBuffer[position] = (stdDev != 0) ? (BodySizeBuffer[position] - mean) / stdDev : 0;
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