//+------------------------------------------------------------------+
//|                                              Auto Entropy IT.mq5 |
//|                             Git, Copyright 2025, MetaQuotes Ltd. |
//|                     https://www.mql5.com/en/users/johnhlomohang/ |
//+------------------------------------------------------------------+
#property copyright "Git, Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com/en/users/johnhlomohang/"
#property version   "1.00"
#property description "Based on Market Entropy Indicator"
#property description "Market Entropy EA – Information Theory Based Automated Trading"
#property description "Retains all indicator visualizations in separate window"
#property strict

#include <Trade/Trade.mqh>

//--- Indicator Inputs (original)
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

//--- EA Trading Inputs
input int      StopLoss           = 100;         // Stop Loss (points)
input int      TakeProfit         = 200;         // Take Profit (points)
input bool     ExtOnOppstTrd      = true;        // Close opposite and reverse on opposite signal
input ulong    MagicNumber        = 202503;      // EA Magic Number
input double   LotSize            = 0.1;         // Fixed lot size
input int      MaxRetries         = 3;           // Max retries for order execution
input int      RetryDelay         = 100;         // Delay between retries (ms)

//--- Internal calculation arrays
double entropyBuffer[];
double smoothBuffer[];
double momentumBuffer[];
double fastEntropyBuffer[];
double slowEntropyBuffer[];
double divergenceBuffer[];

//--- State arrays
int states[];                // 0=flat, 1=up, 2=down
int regime[];                // 0=trend, 1=transition, 2=chaotic
int compressionState[];      // -1=compressing, 0=neutral, 1=decompressing

//--- Daily tracking
datetime   currentDay;
int        dailyUp, dailyDown, dailyFlat, dailyBars;

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

//--- Current bar signal tracking
int        lastTradeBar;
bool       hasTradedThisBar;
double     lastTradePrice;

//--- Chart object prefix
string objPrefix;

//--- Trading objects
CTrade      trade;
int         m_prevCalculated;
int         m_barsCount;
bool        m_firstTick;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   //--- Prefix for chart objects
   objPrefix = "MktEntropyEA_" + IntegerToString(ChartID()) + "_";

   //--- Initialize tracking variables
   currentDay = 0;
   dailyUp = dailyDown = dailyFlat = dailyBars = 0;

   //--- Initialize signal tracking
   lastBuySignalTime = 0;
   lastSellSignalTime = 0;
   lastCompressionStartTime = 0;
   lastDecompressionStartTime = 0;
   lastBuyBar = -MinSignalGap;
   lastSellBar = -MinSignalGap;
   lastCompressionBar = -MinSignalGap;
   lastDecompressionBar = -MinSignalGap;
   lastTradeBar = -1;
   hasTradedThisBar = false;
   lastTradePrice = 0;

   //--- Trading initialization
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFilling(ORDER_FILLING_FOK);
   
   m_prevCalculated = 0;
   m_barsCount = 0;
   m_firstTick = true;

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, objPrefix);
  }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   //--- Update calculations
   int rates_total = Bars(_Symbol, _Period);
   if(rates_total < SlowEntropyPeriod)
      return;

   //--- Check if we're on a new bar
   static int lastBarsCount = 0;
   if(rates_total != lastBarsCount)
     {
      lastBarsCount = rates_total;
      hasTradedThisBar = false;
     }

   //--- Resize all calculation arrays
   ArrayResize(entropyBuffer, rates_total);
   ArrayResize(smoothBuffer, rates_total);
   ArrayResize(momentumBuffer, rates_total);
   ArrayResize(fastEntropyBuffer, rates_total);
   ArrayResize(slowEntropyBuffer, rates_total);
   ArrayResize(divergenceBuffer, rates_total);
   ArrayResize(states, rates_total);
   ArrayResize(regime, rates_total);
   ArrayResize(compressionState, rates_total);
   ArrayResize(compressionLevel, rates_total);
   ArrayResize(decompressionLevel, rates_total);

   //--- Determine starting point for calculation
   int start = m_prevCalculated;
   if(m_firstTick)
     {
      start = 0;
      m_firstTick = false;
     }
   else
     {
      if(rates_total > m_prevCalculated)
         start = MathMax(0, m_prevCalculated - 3);
      else
         start = MathMax(0, rates_total - 3);
     }

   //--- Copy price data arrays
   datetime time[];
   double open[], high[], low[], close[];
   
   if(CopyTime(_Symbol, _Period, 0, rates_total, time) < rates_total) return;
   if(CopyOpen(_Symbol, _Period, 0, rates_total, open) < rates_total) return;
   if(CopyHigh(_Symbol, _Period, 0, rates_total, high) < rates_total) return;
   if(CopyLow(_Symbol, _Period, 0, rates_total, low) < rates_total) return;
   if(CopyClose(_Symbol, _Period, 0, rates_total, close) < rates_total) return;

   //--- Process bars
   for(int i = start; i < rates_total; i++)
     {
      UpdateDailyReset(i, time);
      ClassifyPriceMovement(i, close, time);
      CalculateAllEntropy(i);
      CalculateDivergenceAndMomentum(i);
      DetectCompression(i);
     }

   m_prevCalculated = rates_total;
   m_barsCount = rates_total;

   //--- Check current bar for signals
   int currentBar = rates_total - 1;
   
   if(!hasTradedThisBar && currentBar >= SlowEntropyPeriod)
     {
      if(fastEntropyBuffer[currentBar] != EMPTY_VALUE && 
         slowEntropyBuffer[currentBar] != EMPTY_VALUE &&
         entropyBuffer[currentBar] != EMPTY_VALUE && 
         momentumBuffer[currentBar] != EMPTY_VALUE)
        {
         bool buySig = IsBuySignal(currentBar);
         bool sellSig = IsSellSignal(currentBar);
         
         //--- Draw arrows first
         if(ShowSignals)
           {
            DrawCompressionArrows(currentBar, time, high, low);
            DrawTradingSignal(currentBar, time, high, low);
           }
         
         //--- Check for trades
         if(buySig || sellSig)
           {
            Print("=== Signal Detected ===");
            
            //--- Check existing position
            bool hasBuy = false, hasSell = false;
            ulong ticketBuy = 0, ticketSell = 0;
            
            for(int i = PositionsTotal() - 1; i >= 0; i--)
              {
               ulong ticket = PositionGetTicket(i);
               if(PositionSelectByTicket(ticket))
                 {
                  if(PositionGetInteger(POSITION_MAGIC) == MagicNumber && 
                     PositionGetString(POSITION_SYMBOL) == _Symbol)
                    {
                     if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                       {
                        hasBuy = true;
                        ticketBuy = ticket;
                       }
                     else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
                       {
                        hasSell = true;
                        ticketSell = ticket;
                       }
                    }
                 }
              }
            
            Print("Current Position - Has Buy: ", hasBuy, " | Has Sell: ", hasSell);
            
            //--- Execute trades
            if(!hasBuy && !hasSell)
              {
               if(buySig && (currentBar - lastBuyBar >= MinSignalGap))
                 {
                  Print(">>> Executing BUY trade <<<");
                  ExecuteTrade(ORDER_TYPE_BUY);
                  lastBuyBar = currentBar;
                  hasTradedThisBar = true;
                 }
               else if(sellSig && (currentBar - lastSellBar >= MinSignalGap))
                 {
                  Print(">>> Executing SELL trade <<<");
                  ExecuteTrade(ORDER_TYPE_SELL);
                  lastSellBar = currentBar;
                  hasTradedThisBar = true;
                 }
              }
            else if(ExtOnOppstTrd)
              {
               if(hasBuy && sellSig)
                 {
                  Print(">>> Reversing: Close BUY, Open SELL <<<");
                  if(PositionSelectByTicket(ticketBuy))
                    {
                     if(trade.PositionClose(ticketBuy))
                       {
                        Sleep(RetryDelay);
                        ExecuteTrade(ORDER_TYPE_SELL);
                        lastSellBar = currentBar;
                        hasTradedThisBar = true;
                       }
                    }
                 }
               else if(hasSell && buySig)
                 {
                  Print(">>> Reversing: Close SELL, Open BUY <<<");
                  if(PositionSelectByTicket(ticketSell))
                    {
                     if(trade.PositionClose(ticketSell))
                       {
                        Sleep(RetryDelay);
                        ExecuteTrade(ORDER_TYPE_BUY);
                        lastBuyBar = currentBar;
                        hasTradedThisBar = true;
                       }
                    }
                 }
              }
            
            Print("========================");
           }
        }
     }
   
   //--- Update label
   UpdateRegimeLabel(time, rates_total);
  }

//+------------------------------------------------------------------+
//|  Execute Trade                                                   |
//+------------------------------------------------------------------+
void ExecuteTrade(ENUM_ORDER_TYPE tradeType)
  {
   double price = (tradeType == ORDER_TYPE_BUY) ?
                  SymbolInfoDouble(_Symbol, SYMBOL_ASK) :
                  SymbolInfoDouble(_Symbol, SYMBOL_BID);

   //--- Calculate stop loss
   double sl = (tradeType == ORDER_TYPE_BUY) ?
               price - StopLoss * _Point :
               price + StopLoss * _Point;
   
   //--- Calculate take profit
   double tp = (tradeType == ORDER_TYPE_BUY) ?
               price + TakeProfit * _Point :
               price - TakeProfit * _Point;

   //--- Normalize prices
   price = NormalizeDouble(price, _Digits);
   if(StopLoss > 0) sl = NormalizeDouble(sl, _Digits);
   if(TakeProfit > 0) tp = NormalizeDouble(tp, _Digits);

   //--- Use fixed lot size
   double volume = LotSize;

   //--- Execute trade with retries
   string comment = StringFormat("Entropy_%s", (tradeType == ORDER_TYPE_BUY) ? "BUY" : "SELL");
   bool success = false;
   
   for(int retry = 0; retry < MaxRetries; retry++)
     {
      success = trade.PositionOpen(_Symbol, tradeType, volume, price, 
                                   (StopLoss > 0) ? sl : 0, 
                                   (TakeProfit > 0) ? tp : 0, 
                                   comment);

      if(success)
        {
         lastTradePrice = price;
         Print(StringFormat("Trade Opened: %s | Price: %.5f | SL: %.5f | TP: %.5f | Lots: %.2f",
                           (tradeType == ORDER_TYPE_BUY) ? "BUY" : "SELL", 
                           price, 
                           (StopLoss > 0) ? sl : 0, 
                           (TakeProfit > 0) ? tp : 0, 
                           volume));
         break;
        }
      else
        {
         Print(StringFormat("Trade failed (attempt %d/%d): %s", 
                           retry+1, MaxRetries, trade.ResultRetcodeDescription()));
         if(retry < MaxRetries - 1)
           {
            Sleep(RetryDelay);
            // Refresh price for retry
            price = (tradeType == ORDER_TYPE_BUY) ?
                    SymbolInfoDouble(_Symbol, SYMBOL_ASK) :
                    SymbolInfoDouble(_Symbol, SYMBOL_BID);
            price = NormalizeDouble(price, _Digits);
            if(StopLoss > 0)
               sl = (tradeType == ORDER_TYPE_BUY) ? price - StopLoss * _Point : price + StopLoss * _Point;
            if(TakeProfit > 0)
               tp = (tradeType == ORDER_TYPE_BUY) ? price + TakeProfit * _Point : price - TakeProfit * _Point;
           }
        }
     }
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
   lastTradeBar = -1;
   hasTradedThisBar = false;
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
      if(j >= 0)
        {
         if(statesArray[j] == 1)
            up++;
         else
            if(statesArray[j] == 2)
               down++;
            else
               flat++;
        }
     }

   int total = up + down + flat;
   if(total == 0) return 0;

   double p_up = (double)up / total;
   double p_down = (double)down / total;
   double p_flat = (double)flat / total;

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
      regime[i] = 0;  // trend
   else
      if(entropyBuffer[i] < 0.65)
         regime[i] = 1;  // transition
      else
         regime[i] = 2;  // chaotic
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
      return;

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
//|  Check buy signal conditions - RELAXED VERSION                   |
//+------------------------------------------------------------------+
bool IsBuySignal(int i)
  {
   if(i < 1) return false;
   
   //--- Crossover condition (primary)
   bool crossUp = (fastEntropyBuffer[i] > slowEntropyBuffer[i] &&
                   fastEntropyBuffer[i-1] <= slowEntropyBuffer[i-1]);
   
   //--- Entropy not too chaotic
   bool entropyOk = (entropyBuffer[i] < 0.70);  // Relaxed from 0.65
   
   //--- Positive momentum
   bool momentumOk = (momentumBuffer[i] > 0);
   
   //--- Divergence not too negative
   bool divergenceOk = (divergenceBuffer[i] > -SignalThreshold * 1.5);  // Relaxed
   
   //--- Compression breakout
   bool compressionBreakout = (compressionState[i] == 1 &&
                               entropyBuffer[i] > 0.20 && entropyBuffer[i] < 0.50);  // Relaxed range
   
   //--- Decompression end
   bool decompressionEnd = (compressionState[i-1] == -1 && compressionState[i] != -1 &&
                            momentumBuffer[i] > 0);
   
   //--- Simplified signal logic
   bool signal = crossUp || compressionBreakout || decompressionEnd;
   
   //--- Additional confirmation (optional)
   if(crossUp)
      signal = signal && entropyOk;  // Only require entropy check for crossovers
   
   return signal;
  }

//+------------------------------------------------------------------+
//|  Check sell signal conditions - RELAXED VERSION                  |
//+------------------------------------------------------------------+
bool IsSellSignal(int i)
  {
   if(i < 1) return false;
   
   //--- Crossover condition (primary)
   bool crossDown = (fastEntropyBuffer[i] < slowEntropyBuffer[i] &&
                     fastEntropyBuffer[i-1] >= slowEntropyBuffer[i-1]);
   
   //--- Entropy elevated
   bool entropyOk = (entropyBuffer[i] > 0.50);  // Relaxed from 0.55
   
   //--- Negative momentum
   bool momentumOk = (momentumBuffer[i] < 0);
   
   //--- Divergence negative
   bool divergenceOk = (divergenceBuffer[i] < SignalThreshold);
   
   //--- Chaotic regime entry
   bool chaoticEntry = (regime[i] == 2 && regime[i-1] != 2);
   
   //--- Strong negative divergence
   bool strongDivergence = (divergenceBuffer[i] < -SignalThreshold &&
                            MathAbs(divergenceBuffer[i]) > MathAbs(divergenceBuffer[i-1]));
   
   //--- Compression end (sell)
   bool compressionEnd = (compressionState[i-1] == 1 && compressionState[i] != 1 &&
                          momentumBuffer[i] < 0);
   
   //--- Simplified signal logic
   bool signal = crossDown || chaoticEntry || strongDivergence || compressionEnd;
   
   //--- Additional confirmation (optional)
   if(crossDown)
      signal = signal && entropyOk;  // Only require entropy check for crossovers
   
   return signal;
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

   bool buySig = IsBuySignal(i);
   bool sellSig = IsSellSignal(i);

   //--- Buy signal arrow
   if(buySig)
     {
      if(i - lastBuyBar >= MinSignalGap &&
         (lastBuySignalTime == 0 || time[i] - lastBuySignalTime > MinSignalGap * PeriodSeconds()))
        {
         double arrowY = low[i] - SignalArrowOffset * _Point;
         string objName = objPrefix + "buy_" + IntegerToString(i) + "_" + IntegerToString((int)time[i]);

         ObjectDelete(0, objName);

         if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
           {
            ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 217);
            ObjectSetInteger(0, objName, OBJPROP_COLOR, clrLime);
            ObjectSetInteger(0, objName, OBJPROP_WIDTH, 3);
            ObjectSetInteger(0, objName, OBJPROP_BACK, false);
            ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);
            ObjectSetInteger(0, objName, OBJPROP_ANCHOR, ANCHOR_TOP);

            lastBuySignalTime = time[i];
           }
        }
     }

   //--- Sell signal arrow
   if(sellSig)
     {
      if(i - lastSellBar >= MinSignalGap &&
         (lastSellSignalTime == 0 || time[i] - lastSellSignalTime > MinSignalGap * PeriodSeconds()))
        {
         double arrowY = high[i] + SignalArrowOffset * _Point;
         string objName = objPrefix + "sell_" + IntegerToString(i) + "_" + IntegerToString((int)time[i]);

         ObjectDelete(0, objName);

         if(ObjectCreate(0, objName, OBJ_ARROW, 0, time[i], arrowY))
           {
            ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 218);
            ObjectSetInteger(0, objName, OBJPROP_COLOR, clrRed);
            ObjectSetInteger(0, objName, OBJPROP_WIDTH, 3);
            ObjectSetInteger(0, objName, OBJPROP_ANCHOR, ANCHOR_BOTTOM);
            ObjectSetInteger(0, objName, OBJPROP_BACK, false);
            ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, objName, OBJPROP_HIDDEN, true);

            lastSellSignalTime = time[i];
           }
        }
     }
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