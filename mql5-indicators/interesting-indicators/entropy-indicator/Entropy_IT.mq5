//+------------------------------------------------------------------+
//|                                                   Entropy IT.mq5 |
//|                        GIT under Copyright 2025, MetaQuotes Ltd. |
//|                     https://www.mql5.com/en/users/johnhlomohang/ |
//+------------------------------------------------------------------+
#property copyright "GIT under Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com/en/users/johnhlomohang/"
#property version   "1.00"
#property description "Market Entropy Indicator – Information Theory Visualization"
#property description "Multi-period signal generation using entropy relationships"
#property description "Features Histogram Compression/Decompression visualization"
#property indicator_separate_window
#property indicator_minimum -0.2
#property indicator_maximum 1.2
#property indicator_buffers 16
#property indicator_plots   10

//--- Entropy Histogram
#property indicator_label1 "Entropy"
#property indicator_type1 DRAW_COLOR_HISTOGRAM
#property indicator_color1 clrGreen,clrYellow,clrRed
#property indicator_width1 2

//--- Smoothed Entropy
#property indicator_label2 "Smoothed Entropy"
#property indicator_type2 DRAW_LINE
#property indicator_color2 clrWhite

//--- Entropy Momentum
#property indicator_label3 "Entropy Momentum"
#property indicator_type3 DRAW_LINE
#property indicator_color3 clrCyan

//--- Fast Entropy (short period)
#property indicator_label4 "Fast Entropy"
#property indicator_type4 DRAW_LINE
#property indicator_color4 clrLime

//--- Slow Entropy (long period)
#property indicator_label5 "Slow Entropy"
#property indicator_type5 DRAW_LINE
#property indicator_color5 clrOrange

//--- Entropy Divergence
#property indicator_label6 "Divergence"
#property indicator_type6 DRAW_LINE
#property indicator_color6 clrMagenta

//--- Compression/Decompression Indicator
#property indicator_label7 "Compress/Decompress"
#property indicator_type7 DRAW_COLOR_HISTOGRAM
#property indicator_color7 clrBlue,clrRed,clrGray
#property indicator_width7 2

//--- Flow Arrows (plot-based)
#property indicator_label8 "Entropy Flow"
#property indicator_type8 DRAW_COLOR_ARROW
#property indicator_color8 clrLime,clrOrange

//--- Shock Marker
#property indicator_label9 "Information Shock"
#property indicator_type9 DRAW_ARROW
#property indicator_color9 clrMagenta

//--- Regime Change Marker
#property indicator_label10 "Regime Shift"
#property indicator_type10 DRAW_ARROW
#property indicator_color10 clrWhite

//--- Inputs
input int      EntropyPeriod      = 50;          // Base entropy period
input int      SmoothingPeriod    = 10;          // Smoothing of entropy line
input int      MomentumPeriod     = 5;           // Momentum period
input int      FastEntropyPeriod  = 20;          // Fast entropy period for signals
input int      SlowEntropyPeriod  = 100;         // Slow entropy period for signals
input int      PriceStep          = 1;           // Minimum price change (points) to classify as move
input double   SignalThreshold    = 0.15;        // Threshold for signal generation
input bool     ShowSignals        = true;        // Draw buy/sell arrows on main chart
input int      SignalArrowOffset  = 15;          // Offset in points for arrow placement
input bool     UseDailyReset      = true;        // Reset entropy calculation daily
input double   CompressionZone    = 0.30;        // Entropy level considered compression zone
input double   DecompressionZone  = 0.50;        // Entropy level considered decompression zone
input int      CompressionBars    = 5;           // Bars to confirm compression/decompression
input int      MinSignalGap       = 10;          // Minimum bars between same signal types

//--- Buffers (for subwindow display)
double entropyBuffer[];
double entropyColors[];
double compressionIndicator[];
double compressionColors[];
double smoothBuffer[];
double momentumBuffer[];
double fastEntropyBuffer[];
double slowEntropyBuffer[];
double divergenceBuffer[];
double flowBuffer[];
double flowColors[];
double shockBuffer[];
double regimeShiftBuffer[];

//--- Signal buffers
double buySignalBuffer[];
double sellSignalBuffer[];

//--- Internal arrays
int states[];                // 0=flat, 1=up, 2=down
int regime[];                // 0=trend, 1=transition, 2=chaotic
int compressionState[];      // -1=compressing, 0=neutral, 1=decompressing

//--- Daily tracking
datetime   currentDay;
int        dailyUp, dailyDown, dailyFlat, dailyBars;
double     prevDailyEntropy;

//--- Multi-period tracking
double     prevFastEntropy, prevSlowEntropy;
double     prevMomentum;

//--- Compression tracking
double     compressionLevel[];
double     decompressionLevel[];

//--- Signal tracking to prevent duplicates
datetime   lastBuySignalTime;
datetime   lastSellSignalTime;
datetime   lastCompressionStartTime;
datetime   lastDecompressionStartTime;
int        lastBuyBar;
int        lastSellBar;
int        lastCompressionBar;
int        lastDecompressionBar;

//--- Chart object prefix
string objPrefix;

//+------------------------------------------------------------------+
//|  OnInit                                                          |
//+------------------------------------------------------------------+
int OnInit()
  {
   //--- Bind buffers
   SetIndexBuffer(0, entropyBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, entropyColors, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(2, smoothBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, momentumBuffer, INDICATOR_DATA);
   SetIndexBuffer(4, fastEntropyBuffer, INDICATOR_DATA);
   SetIndexBuffer(5, slowEntropyBuffer, INDICATOR_DATA);
   SetIndexBuffer(6, divergenceBuffer, INDICATOR_DATA);
   SetIndexBuffer(7, compressionIndicator, INDICATOR_DATA);
   SetIndexBuffer(8, compressionColors, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(9, flowBuffer, INDICATOR_DATA);
   SetIndexBuffer(10, flowColors, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(11, shockBuffer, INDICATOR_DATA);
   SetIndexBuffer(12, regimeShiftBuffer, INDICATOR_DATA);
   SetIndexBuffer(13, buySignalBuffer, INDICATOR_DATA);
   SetIndexBuffer(14, sellSignalBuffer, INDICATOR_DATA);

   //--- Set empty value for all plots
   for(int i = 0; i <= 14; i++)
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   //--- Arrow codes for plot-based markers
   PlotIndexSetInteger(8, PLOT_ARROW, 233);        // up/down arrows for flow
   PlotIndexSetInteger(9, PLOT_ARROW, 167);        // lightning
   PlotIndexSetInteger(10, PLOT_ARROW, 159);       // diamond

   //--- Prefix for chart objects
   objPrefix = "MktEntropy_" + IntegerToString(ChartID()) + "_";

   //--- Initialize tracking variables
   currentDay = 0;
   dailyUp = dailyDown = dailyFlat = dailyBars = 0;
   prevDailyEntropy = EMPTY_VALUE;
   prevFastEntropy = prevSlowEntropy = prevMomentum = EMPTY_VALUE;

   //--- Initialize signal tracking
   lastBuySignalTime = 0;
   lastSellSignalTime = 0;
   lastCompressionStartTime = 0;
   lastDecompressionStartTime = 0;
   lastBuyBar = -MinSignalGap;
   lastSellBar = -MinSignalGap;
   lastCompressionBar = -MinSignalGap;
   lastDecompressionBar = -MinSignalGap;

   //--- Initialize compression tracking arrays
   ArrayResize(compressionState, 1);
   ArrayResize(compressionLevel, 1);
   ArrayResize(decompressionLevel, 1);

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//|  OnDeinit                                                        |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, objPrefix);
  }

//+------------------------------------------------------------------+
//|  OnCalculate                                                     |
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
   if(rates_total < SlowEntropyPeriod)
      return 0;

   //--- Ensure arrays are large enough
   ArrayResize(states, rates_total);
   ArrayResize(regime, rates_total);
   ArrayResize(compressionState, rates_total);
   ArrayResize(compressionLevel, rates_total);
   ArrayResize(decompressionLevel, rates_total);

   int start = prev_calculated > 0 ? prev_calculated - 1 : 0;
   if(start < 0)
      start = 0;

   //--- Process bars
   for(int i = start; i < rates_total; i++)
     {
      UpdateDailyReset(i, time);
      ClassifyPriceMovement(i, close, time);
      CalculateAllEntropy(i);
      CalculateDivergenceAndMomentum(i);
      DetectCompression(i);

      if(ShowSignals)
        {
         DrawCompressionArrows(i, time, high, low);
         DrawTradingSignal(i, time, high, low);
        }

      UpdateMarkers(i);
      CalculateSmoothedEntropy(i);
     }

   UpdateRegimeLabel(time, rates_total);

   return rates_total;
  }

//+------------------------------------------------------------------+
//|  Update daily reset and manage signal timers                     |
//+------------------------------------------------------------------+
void UpdateDailyReset(int i, const datetime &time[])
  {
   if(!UseDailyReset)
      return;

   MqlDateTime dt;
   TimeToStruct(time[i], dt);
   datetime barDate = dt.year * 10000 + dt.mon * 100 + dt.day;

   if(barDate != currentDay)
     {
      currentDay = barDate;
      dailyUp = dailyDown = dailyFlat = dailyBars = 0;
      prevDailyEntropy = EMPTY_VALUE;

      if(ShowSignals)
        {
         ObjectsDeleteAll(0, objPrefix);
         ResetSignalTimers();
        }
     }
  }

//+------------------------------------------------------------------+
//|  Reset all signal timers                                         |
//+------------------------------------------------------------------+
void ResetSignalTimers()
  {
   lastBuySignalTime = 0;
   lastSellSignalTime = 0;
   lastCompressionStartTime = 0;
   lastDecompressionStartTime = 0;
   lastBuyBar = -MinSignalGap;
   lastSellBar = -MinSignalGap;
   lastCompressionBar = -MinSignalGap;
   lastDecompressionBar = -MinSignalGap;
  }

//+------------------------------------------------------------------+
//|  Classify price movement into states (up/down/flat)              |
//+------------------------------------------------------------------+
void ClassifyPriceMovement(int i, const double &close[], const datetime &time[])
  {
   if(i == 0)
     {
      states[i] = 0;
      return;
     }

   double change = close[i] - close[i-1];
   double threshold = PriceStep * _Point;

   if(change > threshold)
      states[i] = 1;   // up
   else
      if(change < -threshold)
         states[i] = 2;   // down
      else
         states[i] = 0;   // flat

   if(UseDailyReset && time[i] >= time[i-1])
     {
      if(states[i] == 1)
         dailyUp++;
      else
         if(states[i] == 2)
            dailyDown++;
         else
            dailyFlat++;
      dailyBars++;
     }
  }

//+------------------------------------------------------------------+
//|  Calculate entropy for a given period                            |
//+------------------------------------------------------------------+
double CalculateEntropy(int startIdx, int period, const int &statesArray[])
  {
   int up = 0, down = 0, flat = 0;
   for(int j = startIdx - period; j < startIdx; j++)
     {
      if(statesArray[j] == 1)
         up++;
      else
         if(statesArray[j] == 2)
            down++;
         else
            flat++;
     }

   double p_up = (double)up / period;
   double p_down = (double)down / period;
   double p_flat = (double)flat / period;

   double entropy = 0.0;
   if(p_up > 0)
      entropy -= p_up * MathLog(p_up) / M_LN2;
   if(p_down > 0)
      entropy -= p_down * MathLog(p_down) / M_LN2;
   if(p_flat > 0)
      entropy -= p_flat * MathLog(p_flat) / M_LN2;

   return entropy / (MathLog(3) / M_LN2);  // Normalized entropy
  }

//+------------------------------------------------------------------+
//|  Calculate fast, slow, and base entropy                          |
//+------------------------------------------------------------------+
void CalculateAllEntropy(int i)
  {
   //--- Fast entropy
   if(i >= FastEntropyPeriod)
      fastEntropyBuffer[i] = CalculateEntropy(i, FastEntropyPeriod, states);
   else
      fastEntropyBuffer[i] = EMPTY_VALUE;

   //--- Slow entropy
   if(i >= SlowEntropyPeriod)
      slowEntropyBuffer[i] = CalculateEntropy(i, SlowEntropyPeriod, states);
   else
      slowEntropyBuffer[i] = EMPTY_VALUE;

   //--- Base entropy
   if(i >= EntropyPeriod)
     {
      entropyBuffer[i] = CalculateEntropy(i, EntropyPeriod, states);
      ClassifyRegime(i);
     }
   else
     {
      entropyBuffer[i] = EMPTY_VALUE;
      regime[i] = -1;
     }
  }

//+------------------------------------------------------------------+
//|  Classify market regime based on entropy value                   |
//+------------------------------------------------------------------+
void ClassifyRegime(int i)
  {
   if(entropyBuffer[i] < 0.35)
     {
      entropyColors[i] = 0;
      regime[i] = 0;  // trend
     }
   else
      if(entropyBuffer[i] < 0.65)
        {
         entropyColors[i] = 1;
         regime[i] = 1;  // transition
        }
      else
        {
         entropyColors[i] = 2;
         regime[i] = 2;  // chaotic
        }
  }

//+------------------------------------------------------------------+
//|  Calculate divergence and momentum                               |
//+------------------------------------------------------------------+
void CalculateDivergenceAndMomentum(int i)
  {
   //--- Divergence (fast - slow)
   if(fastEntropyBuffer[i] != EMPTY_VALUE && slowEntropyBuffer[i] != EMPTY_VALUE)
      divergenceBuffer[i] = fastEntropyBuffer[i] - slowEntropyBuffer[i];
   else
      divergenceBuffer[i] = EMPTY_VALUE;

   //--- Momentum
   if(i >= EntropyPeriod + MomentumPeriod &&
      entropyBuffer[i] != EMPTY_VALUE &&
      entropyBuffer[i - MomentumPeriod] != EMPTY_VALUE)
      momentumBuffer[i] = entropyBuffer[i] - entropyBuffer[i - MomentumPeriod];
   else
      momentumBuffer[i] = EMPTY_VALUE;
  }

//+------------------------------------------------------------------+
//|  Detect compression/decompression states                         |
//+------------------------------------------------------------------+
void DetectCompression(int i)
  {
   if(entropyBuffer[i] == EMPTY_VALUE)
     {
      compressionIndicator[i] = EMPTY_VALUE;
      return;
     }

   //--- Track levels
   compressionLevel[i] = entropyBuffer[i];
   decompressionLevel[i] = entropyBuffer[i];

   //--- Find local minima for compression
   if(i >= CompressionBars)
     {
      compressionLevel[i] = entropyBuffer[i];
      for(int j = i - CompressionBars; j <= i; j++)
        {
         if(entropyBuffer[j] != EMPTY_VALUE && entropyBuffer[j] < compressionLevel[i])
            compressionLevel[i] = entropyBuffer[j];
        }
     }
   
   //--- Find local maxima for decompression
   if(i >= CompressionBars)
     {
      decompressionLevel[i] = entropyBuffer[i];
      for(int j = i - CompressionBars; j <= i; j++)
        {
         if(entropyBuffer[j] != EMPTY_VALUE && entropyBuffer[j] > decompressionLevel[i])
            decompressionLevel[i] = entropyBuffer[j];
        }
     }

   //--- Determine state
   compressionState[i] = 0;  // neutral

   if(i > 0 && entropyBuffer[i-1] != EMPTY_VALUE)
     {
      if(entropyBuffer[i] < entropyBuffer[i-1] && entropyBuffer[i] < CompressionZone)
         compressionState[i] = -1;  // compressing
      else
         if(entropyBuffer[i] > entropyBuffer[i-1] && entropyBuffer[i] > DecompressionZone)
            compressionState[i] = 1;   // decompressing
     }

   //--- Set indicator buffer and colors
   if(compressionState[i] == -1)
     {
      compressionIndicator[i] = entropyBuffer[i];
      compressionColors[i] = 0;  // Blue
     }
   else
      if(compressionState[i] == 1)
        {
         compressionIndicator[i] = entropyBuffer[i];
         compressionColors[i] = 1;  // Red
        }
      else
         if(compressionState[i] == 0 && entropyBuffer[i] < CompressionZone)
           {
            compressionIndicator[i] = entropyBuffer[i];
            compressionColors[i] = 2;  // Gray
           }
         else
           {
            compressionIndicator[i] = EMPTY_VALUE;
           }
  }

//+------------------------------------------------------------------+
//|  Draw compression/decompression circles                          |
//+------------------------------------------------------------------+
void DrawCompressionArrows(int i, const datetime &time[], const double &high[], const double &low[])
  {
   if(!ShowSignals || i == 0 || compressionState[i] == 0)
      return;

   //--- Compression start
   if(compressionState[i] == -1 && compressionState[i-1] != -1)
     {
      if(i - lastCompressionBar >= MinSignalGap &&
         (lastCompressionStartTime == 0 || time[i] - lastCompressionStartTime > MinSignalGap * PeriodSeconds()))
        {
         double arrowY = low[i] - SignalArrowOffset * _Point * 2;
         string objName = objPrefix + "compress_" + IntegerToString(i);

         ObjectDelete(0, objName);

         if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
           {
            ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 108);
            ObjectSetInteger(0, objName, OBJPROP_COLOR, clrBlue);
            ObjectSetInteger(0, objName, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, objName, OBJPROP_BACK, false);
            ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);

            lastCompressionStartTime = time[i];
            lastCompressionBar = i;
           }
        }
     }
   //--- Decompression start
   else
      if(compressionState[i] == 1 && compressionState[i-1] != 1)
        {
         if(i - lastDecompressionBar >= MinSignalGap &&
            (lastDecompressionStartTime == 0 || time[i] - lastDecompressionStartTime > MinSignalGap * PeriodSeconds()))
           {
            double arrowY = high[i] + SignalArrowOffset * _Point * 2;
            string objName = objPrefix + "decompress_" + IntegerToString(i);

            ObjectDelete(0, objName);

            if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
              {
               ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 108);
               ObjectSetInteger(0, objName, OBJPROP_COLOR, clrOrange);
               ObjectSetInteger(0, objName, OBJPROP_WIDTH, 2);
               ObjectSetInteger(0, objName, OBJPROP_BACK, false);
               ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
               ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);

               lastDecompressionStartTime = time[i];
               lastDecompressionBar = i;
              }
           }
        }
  }

//+------------------------------------------------------------------+
//|  Check buy signal conditions                                     |
//+------------------------------------------------------------------+
bool IsBuySignal(int i)
  {
   bool buyCondition1 = (fastEntropyBuffer[i] > slowEntropyBuffer[i] &&
                         fastEntropyBuffer[i-1] <= slowEntropyBuffer[i-1]);

   bool buyCondition2 = (entropyBuffer[i] < 0.65);

   bool buyCondition3 = (momentumBuffer[i] > 0 && momentumBuffer[i] > momentumBuffer[i-1]);

   bool buyCondition4 = (divergenceBuffer[i] > -SignalThreshold);

   bool buyCondition5 = (regime[i] != 2);

   bool buyCondition6 = (compressionState[i] == 1 &&
                         entropyBuffer[i] > 0.25 && entropyBuffer[i] < 0.45);

   bool buyCondition7 = (compressionState[i-1] == -1 && compressionState[i] != -1 &&
                         momentumBuffer[i] > 0);

   return ((buyCondition1 && buyCondition2 && buyCondition3 && buyCondition4) ||
           buyCondition6 || buyCondition7);
  }

//+------------------------------------------------------------------+
//|  Check sell signal conditions                                    |
//+------------------------------------------------------------------+
bool IsSellSignal(int i)
  {
   bool sellCondition1 = (fastEntropyBuffer[i] < slowEntropyBuffer[i] &&
                          fastEntropyBuffer[i-1] >= slowEntropyBuffer[i-1]);

   bool sellCondition2 = (entropyBuffer[i] > 0.55);

   bool sellCondition3 = (momentumBuffer[i] < 0 && momentumBuffer[i] < momentumBuffer[i-1]);

   bool sellCondition4 = (divergenceBuffer[i] < SignalThreshold);

   bool sellCondition5 = (regime[i] == 2 && regime[i-1] != 2);

   bool sellCondition6 = (divergenceBuffer[i] < -SignalThreshold &&
                          MathAbs(divergenceBuffer[i]) > MathAbs(divergenceBuffer[i-1]));

   bool sellCondition7 = (compressionState[i-1] == 1 && compressionState[i] != 1 &&
                          momentumBuffer[i] < 0);

   return ((sellCondition1 && sellCondition2 && sellCondition3) ||
           sellCondition5 || sellCondition6 || sellCondition7);
  }

//+------------------------------------------------------------------+
//|  Draw buy/sell arrows                                            |
//+------------------------------------------------------------------+
void DrawTradingSignal(int i, const datetime &time[], const double &high[], const double &low[])
  {
   if(!ShowSignals || i < SlowEntropyPeriod ||
      fastEntropyBuffer[i] == EMPTY_VALUE || slowEntropyBuffer[i] == EMPTY_VALUE ||
      entropyBuffer[i] == EMPTY_VALUE || momentumBuffer[i] == EMPTY_VALUE)
      return;

   //--- Buy signal
   if(IsBuySignal(i))
     {
      if(i - lastBuyBar >= MinSignalGap &&
         (lastBuySignalTime == 0 || time[i] - lastBuySignalTime > MinSignalGap * PeriodSeconds()))
        {
         double arrowY = low[i] - SignalArrowOffset * _Point;
         string objName = objPrefix + "buy_" + IntegerToString(i);

         ObjectDelete(0, objName);

         if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
           {
            ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 233);
            ObjectSetInteger(0, objName, OBJPROP_COLOR, clrGreen);
            ObjectSetInteger(0, objName, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, objName, OBJPROP_BACK, false);
            ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);

            buySignalBuffer[i] = low[i] - SignalArrowOffset * _Point;
            lastBuySignalTime = time[i];
            lastBuyBar = i;
           }
        }
     }

   //--- Sell signal
   if(IsSellSignal(i))
     {
      if(i - lastSellBar >= MinSignalGap &&
         (lastSellSignalTime == 0 || time[i] - lastSellSignalTime > MinSignalGap * PeriodSeconds()))
        {
         double arrowY = high[i] + SignalArrowOffset * _Point;
         string objName = objPrefix + "sell_" + IntegerToString(i);

         ObjectDelete(0, objName);

         if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
           {
            ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 234);
            ObjectSetInteger(0, objName, OBJPROP_COLOR, clrRed);
            ObjectSetInteger(0, objName, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, objName, OBJPROP_ANCHOR, ANCHOR_BOTTOM);
            ObjectSetInteger(0, objName, OBJPROP_BACK, false);
            ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);

            sellSignalBuffer[i] = high[i] + SignalArrowOffset * _Point;
            lastSellSignalTime = time[i];
            lastSellBar = i;
           }
        }
     }
  }

//+------------------------------------------------------------------+
//|  Update flow arrows, shock, and regime shift markers             |
//+------------------------------------------------------------------+
void UpdateMarkers(int i)
  {
   //--- Flow arrows
   if(i > 0 && entropyBuffer[i] != EMPTY_VALUE && entropyBuffer[i-1] != EMPTY_VALUE)
     {
      double delta = entropyBuffer[i] - entropyBuffer[i-1];
      if(delta > 0.03)
        {
         flowBuffer[i] = 1.05;
         flowColors[i] = 0;
        }
      else
         if(delta < -0.03)
           {
            flowBuffer[i] = -0.05;
            flowColors[i] = 1;
           }
         else
            flowBuffer[i] = EMPTY_VALUE;
     }

   //--- Information shock
   if(i > 0 && entropyBuffer[i] != EMPTY_VALUE && entropyBuffer[i-1] != EMPTY_VALUE)
     {
      if(entropyBuffer[i] > entropyBuffer[i-1] * 1.25)
         shockBuffer[i] = 1.1;
      else
         shockBuffer[i] = EMPTY_VALUE;
     }

   //--- Regime shifts
   if(i > 0 && regime[i] != -1 && regime[i-1] != -1 && regime[i] != regime[i-1])
      regimeShiftBuffer[i] = 0.9;
   else
      regimeShiftBuffer[i] = EMPTY_VALUE;
  }

//+------------------------------------------------------------------+
//|  Calculate smoothed entropy                                      |
//+------------------------------------------------------------------+
void CalculateSmoothedEntropy(int i)
  {
   if(i < SmoothingPeriod)
     {
      smoothBuffer[i] = EMPTY_VALUE;
      return;
     }

   double sum = 0.0;
   int cnt = 0;
   for(int j = i - SmoothingPeriod + 1; j <= i; j++)
     {
      if(entropyBuffer[j] != EMPTY_VALUE)
        {
         sum += entropyBuffer[j];
         cnt++;
        }
     }
   smoothBuffer[i] = (cnt > 0) ? sum / cnt : EMPTY_VALUE;
  }

//+------------------------------------------------------------------+
//|  Update regime label                                             |
//+------------------------------------------------------------------+
void UpdateRegimeLabel(const datetime &time[], int rates_total)
  {
   string labelText = "";
   color labelColor = clrNONE;
   double lastEntropy = entropyBuffer[rates_total-1];
   double lastFast = fastEntropyBuffer[rates_total-1];
   double lastSlow = slowEntropyBuffer[rates_total-1];
   double lastDiv = divergenceBuffer[rates_total-1];
   int lastCompress = (rates_total-1 >= 0) ? compressionState[rates_total-1] : 0;

   if(lastEntropy != EMPTY_VALUE)
     {
      if(lastEntropy < 0.35)
         labelText = "TREND MODE  (" + DoubleToString(lastEntropy, 2) + ")";
      else
         if(lastEntropy < 0.65)
            labelText = "TRANSITION MODE  (" + DoubleToString(lastEntropy, 2) + ")";
         else
            labelText = "CHAOTIC MODE  (" + DoubleToString(lastEntropy, 2) + ")";

      if(lastCompress == -1)
         labelText += " | COMPRESSING";
      else
         if(lastCompress == 1)
            labelText += " | DECOMPRESSING";

      if(lastDiv != EMPTY_VALUE)
        {
         labelText += " | Div: " + DoubleToString(lastDiv, 2);
         if(lastFast != EMPTY_VALUE && lastSlow != EMPTY_VALUE)
           {
            if(lastFast > lastSlow)
               labelText += " (Bull)";
            else
               labelText += " (Bear)";
           }
        }

      labelColor = (lastEntropy < 0.35) ? clrGreen : (lastEntropy < 0.65) ? clrYellow : clrRed;
     }
   else
     {
      labelText = "MODE: WAITING FOR DATA";
      labelColor = clrGray;
     }

   ObjectCreate(0, objPrefix + "regimeLabel", OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_XDISTANCE, 10);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_YDISTANCE, 10);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_CORNER, 0);
   ObjectSetString(0, objPrefix + "regimeLabel", OBJPROP_TEXT, labelText);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_COLOR, labelColor);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, objPrefix + "regimeLabel", OBJPROP_BACK, false);
  }
//+------------------------------------------------------------------+