//+------------------------------------------------------------------+
//|                                                  ALGLIB_SSA.mq5 |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2

//--- include ALGLIB
#include <Math/Alglib/alglib.mqh>

//--- plot definitions
#property indicator_label1  "SSA Trend"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrMagenta
#property indicator_width1  2

#property indicator_label2  "SSA Signal (EMA)"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrBlue
#property indicator_width2  2
#property indicator_style2  STYLE_DASH

//--- input parameters
input int    SSAWindow     = 30;   // SSA embedding window (must be < data length)
input int    SSARank       = 6;    // SSA components to keep (lower = smoother)
input int    SSASignalPeriod = 3;  // EMA period for SSA signal line
input int    LookbackBars  = 500;  // Number of recent bars to process

//--- indicator buffers
double ssaTrendBuffer[];
double ssaSignalBuffer[];

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, ssaTrendBuffer,  INDICATOR_DATA);
   SetIndexBuffer(1, ssaSignalBuffer, INDICATOR_DATA);

   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   IndicatorSetString(INDICATOR_SHORTNAME, "SSA Trend & Signal");

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Main calculation                                                 |
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
   //--- Determine the lookback window
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   int len      = rates_total - startIdx;

   //--- Need enough bars for SSA
   if(len < SSAWindow)
   {
      for(int i = startIdx; i < rates_total; i++)
      {
         ssaTrendBuffer[i]  = EMPTY_VALUE;
         ssaSignalBuffer[i] = EMPTY_VALUE;
      }
      return(rates_total);
   }

   //--- Fill bars before the lookback window with EMPTY_VALUE
   for(int i = 0; i < startIdx; i++)
   {
      ssaTrendBuffer[i]  = EMPTY_VALUE;
      ssaSignalBuffer[i] = EMPTY_VALUE;
   }

   //--- Load close prices into a vector
   vector<double> vecClose(len);
   for(int i = 0; i < len; i++)
      vecClose[i] = close[startIdx + i];

   //--- SSA Trend
   CSSAModel ssa;
   CAlglib::SSACreate(ssa);
   CRowDouble priceRow(vecClose);
   CAlglib::SSAAddSequence(ssa, priceRow);
   CAlglib::SSASetAlgoTopKRealtime(ssa, SSARank);
   CAlglib::SSASetWindow(ssa, SSAWindow);
   CRowDouble trend, noise;
   CAlglib::SSAAnalyzeLast(ssa, len, trend, noise);

   if(trend.Size() == len)
   {
      vector<double> vecTrend = trend.ToVector();
      for(int i = 0; i < len; i++)
         ssaTrendBuffer[startIdx + i] = vecTrend[i];

      //--- EMA signal line on SSA Trend
      double alpha = 2.0 / (SSASignalPeriod + 1.0);
      ssaSignalBuffer[startIdx] = vecTrend[0];
      for(int i = 1; i < len; i++)
         ssaSignalBuffer[startIdx + i] = alpha * vecTrend[i] + (1.0 - alpha) * ssaSignalBuffer[startIdx + i - 1];
   }
   else
   {
      for(int i = 0; i < len; i++)
      {
         ssaTrendBuffer[startIdx + i]  = EMPTY_VALUE;
         ssaSignalBuffer[startIdx + i] = EMPTY_VALUE;
      }
   }

   return(rates_total);
}
//+------------------------------------------------------------------+
