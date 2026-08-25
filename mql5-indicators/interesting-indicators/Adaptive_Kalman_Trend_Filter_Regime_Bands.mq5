//+------------------------------------------------------------------+
//|                    Adaptive Kalman Trend Filter Regime Bands.mq5 |
//|                                          Copyright ADEDAYO GBADEBO|
//|                                     https://www.mql5.com/en/users|
//+------------------------------------------------------------------+
#property copyright "ADEDAYO GBADEBO"
#property link      "https://www.mql5.com/en/users"
#property version   "1.00"
#property description "Adaptive Kalman Trend Filter with Regime Bands"
#property description "A single-state Kalman filter whose process noise is"
#property description "scaled by Kaufman's Efficiency Ratio, producing a"
#property description "trend line that reacts faster in trending regimes"
#property description "and smooths harder in choppy ones, with volatility"
#property description "bands that widen and contract with the same regime read."

#property indicator_chart_window
#property indicator_buffers 5
#property indicator_plots   2

//--- Plot 1: Kalman trend line (color-coded by regime)
#property indicator_label1  "Kalman Line"
#property indicator_type1   DRAW_COLOR_LINE
#property indicator_color1  clrLimeGreen, clrRed, clrSilver
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

//--- Plot 2: Upper / Lower regime bands (two separate DRAW_LINE plots share the label group)
#property indicator_label2  "Upper Band;Lower Band"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrDimGray
#property indicator_style2  STYLE_DOT
#property indicator_width2  1

//--- Input parameters
input ENUM_APPLIED_PRICE InpPriceType         = PRICE_CLOSE; // Price source used by the filter
input double              InpBaseProcessNoise = 0.005;       // Base Kalman process noise (Q)
input double              InpMeasurementNoise = 0.80;        // Kalman measurement noise (R)
input double              InpMinQMultiplier   = 0.5;         // Minimum Q multiplier (ranging regime)
input double              InpMaxQMultiplier   = 5.0;         // Maximum Q multiplier (trending regime)
input int                 InpEfficiencyPeriod = 20;          // Lookback for Kaufman Efficiency Ratio
input int                 InpBandPeriod       = 20;          // Lookback for residual volatility
input double              InpBandMultiplier   = 1.5;         // Band width multiplier
input double              InpRegimeThreshold  = 0.40;        // Efficiency Ratio threshold: trend vs range

//--- Indicator buffers
double BufKalman[];      // 0 - Kalman trend line
double BufKalmanColor[]; // 1 - color index for BufKalman (0=up,1=down,2=range)
double BufUpper[];       // 2 - upper regime band
double BufLower[];       // 3 - lower regime band
double BufP[];           // 4 - Kalman error covariance (calculation only, not plotted)

//+------------------------------------------------------------------+
//| Custom indicator initialization function                        |
//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0, BufKalman,      INDICATOR_DATA);
   SetIndexBuffer(1, BufKalmanColor, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(2, BufUpper,       INDICATOR_DATA);
   SetIndexBuffer(3, BufLower,       INDICATOR_DATA);
   SetIndexBuffer(4, BufP,           INDICATOR_CALCULATIONS);

   ArraySetAsSeries(BufKalman,      false);
   ArraySetAsSeries(BufKalmanColor, false);
   ArraySetAsSeries(BufUpper,       false);
   ArraySetAsSeries(BufLower,       false);
   ArraySetAsSeries(BufP,           false);

   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, InpEfficiencyPeriod);
   PlotIndexSetInteger(1, PLOT_DRAW_BEGIN, InpEfficiencyPeriod);

   PlotIndexSetString(0, PLOT_LABEL, "Kalman Line");
   PlotIndexSetString(1, PLOT_LABEL, "Upper Band;Lower Band");

   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   IndicatorSetString(INDICATOR_SHORTNAME,
      StringFormat("Adaptive Kalman Trend Filter (%d,%d)", InpEfficiencyPeriod, InpBandPeriod));

   if(InpEfficiencyPeriod < 2 || InpBandPeriod < 2)
     {
      Print("Adaptive Kalman Trend Filter: periods must be >= 2");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(InpMaxQMultiplier <= InpMinQMultiplier)
     {
      Print("Adaptive Kalman Trend Filter: InpMaxQMultiplier must exceed InpMinQMultiplier");
      return(INIT_PARAMETERS_INCORRECT);
     }

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Kaufman-style Efficiency Ratio over a lookback window            |
//+------------------------------------------------------------------+
double EfficiencyRatio(const double &price[], const int i, const int period)
  {
   if(i < period)
      return(0.0);

   double directional = MathAbs(price[i] - price[i - period]);
   double volatility   = 0.0;

   for(int k = i - period + 1; k <= i; k++)
      volatility += MathAbs(price[k] - price[k - 1]);

   if(volatility <= 0.0)
      return(0.0);

   double er = directional / volatility;
   if(er > 1.0) er = 1.0;
   if(er < 0.0) er = 0.0;
   return(er);
  }

//+------------------------------------------------------------------+
//| Rolling standard deviation of (price - KalmanLine) residuals     |
//+------------------------------------------------------------------+
double ResidualStdDev(const double &price[], const double &kalman[], const int i, const int period)
  {
   if(i < period)
      return(0.0);

   double sum = 0.0, sumSq = 0.0;
   int n = period;

   for(int k = i - period + 1; k <= i; k++)
     {
      double r = price[k] - kalman[k];
      sum   += r;
      sumSq += r * r;
     }

   double mean     = sum / n;
   double variance = (sumSq / n) - (mean * mean);
   if(variance < 0.0)
      variance = 0.0;

   return(MathSqrt(variance));
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
//+------------------------------------------------------------------+
int OnCalculate(const int        rates_total,
                 const int       prev_calculated,
                 const datetime &time[],
                 const double   &open[],
                 const double   &high[],
                 const double   &low[],
                 const double   &close[],
                 const long     &tick_volume[],
                 const long     &volume[],
                 const int      &spread[])
  {
   if(rates_total < 2)
      return(0);

   double price[];
   ArrayResize(price, rates_total);
   for(int p = 0; p < rates_total; p++)
      price[p] = GetAppliedPrice(InpPriceType, p, open, high, low, close);

   int start;
   if(prev_calculated == 0)
     {
      start              = 1;
      BufKalman[0]      = price[0];
      BufKalmanColor[0] = 2.0;
      BufUpper[0]       = price[0];
      BufLower[0]       = price[0];
      BufP[0]           = 1.0;
     }
   else
      start = prev_calculated - 1;

   for(int i = start; i < rates_total; i++)
     {
      double er = EfficiencyRatio(price, i, InpEfficiencyPeriod);

      double adaptiveQ = InpBaseProcessNoise *
                          (InpMinQMultiplier + (InpMaxQMultiplier - InpMinQMultiplier) * er);

      double pPrev = BufP[i - 1];
      double pPred = pPrev + adaptiveQ;
      double kGain = pPred / (pPred + InpMeasurementNoise);

      double levelPrev = BufKalman[i - 1];
      double level      = levelPrev + kGain * (price[i] - levelPrev);

      BufKalman[i] = level;
      BufP[i]      = (1.0 - kGain) * pPred;

      double residStd  = ResidualStdDev(price, BufKalman, i, InpBandPeriod);
      double bandWidth = InpBandMultiplier * residStd * (1.0 + (1.0 - er));

      BufUpper[i] = level + bandWidth;
      BufLower[i] = level - bandWidth;

      if(er >= InpRegimeThreshold)
         BufKalmanColor[i] = (level > levelPrev) ? 0.0 : 1.0; // 0=up trend, 1=down trend
      else
         BufKalmanColor[i] = 2.0; // ranging regime
     }

   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Applied price helper                                             |
//+------------------------------------------------------------------+
double GetAppliedPrice(const ENUM_APPLIED_PRICE type, const int i,
                        const double &open[], const double &high[],
                        const double &low[],  const double &close[])
  {
   switch(type)
     {
      case PRICE_OPEN:     return(open[i]);
      case PRICE_HIGH:     return(high[i]);
      case PRICE_LOW:      return(low[i]);
      case PRICE_MEDIAN:   return((high[i] + low[i]) / 2.0);
      case PRICE_TYPICAL:  return((high[i] + low[i] + close[i]) / 3.0);
      case PRICE_WEIGHTED: return((high[i] + low[i] + 2.0 * close[i]) / 4.0);
      default:             return(close[i]);
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   Comment("");
  }
//+------------------------------------------------------------------+
