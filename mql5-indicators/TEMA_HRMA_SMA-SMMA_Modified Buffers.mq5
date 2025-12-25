//+------------------------------------------------------------------+
//|                              SMA-SMMA-HRMA-TEMA Indicator.mq5   |
//|                             Copyright 2000-2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2000-2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"

//--- indicator settings
#property indicator_chart_window
#property indicator_buffers 11
#property indicator_plots   4
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrNONE
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrBlue
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrMediumTurquoise
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrGray

//--- input parameters
input int                InpMAPeriod=2;              // SMA Period
input int                InpMAShift=0;               // SMA Shift
input ENUM_APPLIED_PRICE InpAppliedPrice=PRICE_TYPICAL; // Applied price
input color              InpSMAColor=clrNONE;         // SMA Line color
input int                InpSMAWidth=1;              // SMA Line width
input int                InpSMMAPeriod=36;           // SMMA Period
input int                InpSMMAShift=0;             // SMMA Shift
input color              InpSMMAColor=clrBlue;       // SMMA Line color
input int                InpSMMAWidth=2;             // SMMA Line width
input int                len_hrma=18;                // HRMA Period
input int                InpHRMAShift=0;             // HRMA Shift
input color              InpHRMAColor=clrMediumTurquoise; // HRMA Line color
input int                InpHRMAWidth=2;             // HRMA Line width
input int                InpPeriodEMA=9;             // TEMA Period
input int                InpTEMAShift=0;             // TEMA Shift
input color              InpTEMAColor=clrGray;   // TEMA Line color
input int                InpTEMAWidth=1;             // TEMA Line width

//--- indicator buffers
double ExtLineBuffer[];     // SMA buffer
double PriceBuffer[];       // Price buffer for calculations
double SMMABuffer[];        // SMMA buffer
double HRMABuffer[];        // HRMA buffer
double HRMACalcBuffer[];    // HRMA calculation buffer
double RMA1Buffer[];        // RMA1 buffer for HRMA
double RMA2Buffer[];        // RMA2 buffer for HRMA
double TEMABuffer[];        // Main TEMA buffer
double EMABuffer[];         // First EMA buffer
double EMAofEMABuffer[];    // EMA of EMA buffer
double EMAofEMAofEMABuffer[]; // Triple EMA buffer

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
void OnInit()
  {
//--- indicator buffers mapping
   SetIndexBuffer(0,ExtLineBuffer,INDICATOR_DATA);
   SetIndexBuffer(1,SMMABuffer,INDICATOR_DATA);
   SetIndexBuffer(2,HRMABuffer,INDICATOR_DATA);
   SetIndexBuffer(3,TEMABuffer,INDICATOR_DATA);
   SetIndexBuffer(4,PriceBuffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(5,HRMACalcBuffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(6,RMA1Buffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(7,RMA2Buffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(8,EMABuffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(9,EMAofEMABuffer,INDICATOR_CALCULATIONS);
   SetIndexBuffer(10,EMAofEMAofEMABuffer,INDICATOR_CALCULATIONS);

//--- initialize buffers
   ArrayInitialize(ExtLineBuffer,0);
   ArrayInitialize(SMMABuffer,0);
   ArrayInitialize(HRMABuffer,0);
   ArrayInitialize(TEMABuffer,0);
   ArrayInitialize(PriceBuffer,0);
   ArrayInitialize(HRMACalcBuffer,0);
   ArrayInitialize(RMA1Buffer,0);
   ArrayInitialize(RMA2Buffer,0);
   ArrayInitialize(EMABuffer,0);
   ArrayInitialize(EMAofEMABuffer,0);
   ArrayInitialize(EMAofEMAofEMABuffer,0);

//--- set accuracy
   IndicatorSetInteger(INDICATOR_DIGITS,_Digits+1);

//--- set first bar from what index will be drawn for SMA
   PlotIndexSetInteger(0,PLOT_DRAW_BEGIN,InpMAPeriod);
//--- line shifts when drawing for SMA
   PlotIndexSetInteger(0,PLOT_SHIFT,InpMAShift);
//--- set SMA line color and width
   PlotIndexSetInteger(0,PLOT_LINE_COLOR,InpSMAColor);
   PlotIndexSetInteger(0,PLOT_LINE_WIDTH,InpSMAWidth);

//--- set first bar from what index will be drawn for SMMA
   PlotIndexSetInteger(1,PLOT_DRAW_BEGIN,InpMAPeriod+InpSMMAPeriod-1);
//--- line shifts when drawing for SMMA
   PlotIndexSetInteger(1,PLOT_SHIFT,InpSMMAShift);
//--- set SMMA line color and width
   PlotIndexSetInteger(1,PLOT_LINE_COLOR,InpSMMAColor);
   PlotIndexSetInteger(1,PLOT_LINE_WIDTH,InpSMMAWidth);

//--- set first bar from what index will be drawn for HRMA
   PlotIndexSetInteger(2,PLOT_DRAW_BEGIN,len_hrma);
//--- line shifts when drawing for HRMA
   PlotIndexSetInteger(2,PLOT_SHIFT,InpHRMAShift);
//--- set HRMA line color and width
   PlotIndexSetInteger(2,PLOT_LINE_COLOR,InpHRMAColor);
   PlotIndexSetInteger(2,PLOT_LINE_WIDTH,InpHRMAWidth);

//--- set first bar from what index will be drawn for TEMA
   PlotIndexSetInteger(3,PLOT_DRAW_BEGIN,3*InpPeriodEMA-3);
//--- line shifts when drawing for TEMA
   PlotIndexSetInteger(3,PLOT_SHIFT,InpTEMAShift);
//--- set TEMA line color and width
   PlotIndexSetInteger(3,PLOT_LINE_COLOR,InpTEMAColor);
   PlotIndexSetInteger(3,PLOT_LINE_WIDTH,InpTEMAWidth);

//--- name for DataWindow
   IndicatorSetString(INDICATOR_SHORTNAME,"SMA-SMMA-HRMA-TEMA("+string(InpMAPeriod)+","+string(InpSMMAPeriod)+","+string(len_hrma)+","+string(InpPeriodEMA)+")");

//--- set drawing line empty value
   PlotIndexSetDouble(0,PLOT_EMPTY_VALUE,0.0);
   PlotIndexSetDouble(1,PLOT_EMPTY_VALUE,0.0);
   PlotIndexSetDouble(2,PLOT_EMPTY_VALUE,0.0);
   PlotIndexSetDouble(3,PLOT_EMPTY_VALUE,0.0);

//--- set labels
   PlotIndexSetString(0,PLOT_LABEL,"SMA("+string(InpMAPeriod)+")");
   PlotIndexSetString(1,PLOT_LABEL,"SMMA("+string(InpSMMAPeriod)+")");
   PlotIndexSetString(2,PLOT_LABEL,"HRMA("+string(len_hrma)+")");
   PlotIndexSetString(3,PLOT_LABEL,"TEMA("+string(InpPeriodEMA)+")");
  }

//+------------------------------------------------------------------+
//|  Moving Average                                                  |
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
   if(rates_total<InpMAPeriod+InpSMMAPeriod-1)
      return(0);

//--- first calculation or number of bars was changed
   if(prev_calculated==0)
     {
      ArrayInitialize(ExtLineBuffer,0);
      ArrayInitialize(SMMABuffer,0);
      ArrayInitialize(HRMABuffer,0);
      ArrayInitialize(TEMABuffer,0);
      PlotIndexSetInteger(0,PLOT_DRAW_BEGIN,InpMAPeriod-1);
      PlotIndexSetInteger(1,PLOT_DRAW_BEGIN,InpMAPeriod+InpSMMAPeriod-1);
      PlotIndexSetInteger(2,PLOT_DRAW_BEGIN,len_hrma-1);
      PlotIndexSetInteger(3,PLOT_DRAW_BEGIN,3*InpPeriodEMA-3);
     }

//--- calculate start position
   int start = prev_calculated > 0 ? prev_calculated - 1 : 0;

//--- calculate price array
   for(int i = start; i < rates_total; i++)
     {
      PriceBuffer[i] = GetAppliedPrice(InpAppliedPrice, open[i], high[i], low[i], close[i]);
      HRMACalcBuffer[i] = GetAppliedPrice(InpAppliedPrice, open[i], high[i], low[i], close[i]);
     }

//--- calculation SMA first
   CalculateSimpleMA(rates_total,prev_calculated);
//--- then calculate SMMA from SMA values
   CalculateSMMA(rates_total,prev_calculated);
//--- calculate HRMA
   CalculateHRMA(rates_total,start);
//--- calculate TEMA
   CalculateTEMA(rates_total,start);

//--- return value of prev_calculated for next call
   return(rates_total);
  }

//+------------------------------------------------------------------+
//|   simple moving average                                          |
//+------------------------------------------------------------------+
void CalculateSimpleMA(int rates_total,int prev_calculated)
  {
   int i,start;
//--- first calculation or number of bars was changed
   if(prev_calculated==0)
     {
      start=InpMAPeriod;
      //--- set empty value for first start bars
      for(i=0; i<start-1; i++)
         ExtLineBuffer[i]=0.0;
      //--- calculate first visible value
      double first_value=0;
      for(i=0; i<start; i++)
         first_value+=PriceBuffer[i];
      first_value/=InpMAPeriod;
      ExtLineBuffer[start-1]=first_value;
     }
   else
      start=prev_calculated-1;
//--- main loop
   for(i=start; i<rates_total && !IsStopped(); i++)
      ExtLineBuffer[i]=ExtLineBuffer[i-1]+(PriceBuffer[i]-PriceBuffer[i-InpMAPeriod])/InpMAPeriod;
  }

//+------------------------------------------------------------------+
//|   smoothed moving average calculated from SMA values            |
//+------------------------------------------------------------------+
void CalculateSMMA(int rates_total,int prev_calculated)
  {
   int i,start;
//--- first calculation or number of bars was changed
   if(prev_calculated==0)
     {
      start=InpMAPeriod+InpSMMAPeriod;
      //--- set empty value for first start bars
      for(i=0; i<start-1; i++)
         SMMABuffer[i]=0.0;
      //--- calculate first visible value
      double first_value=0;
      for(i=InpMAPeriod-1; i<start; i++)
         first_value+=ExtLineBuffer[i];
      first_value/=InpSMMAPeriod;
      SMMABuffer[start-1]=first_value;
     }
   else
      start=prev_calculated-1;
//--- main loop with SMMA formula using SMA values as input
   for(i=start; i<rates_total && !IsStopped(); i++)
      SMMABuffer[i]=(SMMABuffer[i-1]*(InpSMMAPeriod-1)+ExtLineBuffer[i])/InpSMMAPeriod;
  }

//+------------------------------------------------------------------+
//| Calculate HRMA using RMA approach                                |
//+------------------------------------------------------------------+
void CalculateHRMA(int rates_total, int start)
  {
   double alpha1 = 2.0 / (len_hrma / 2.0 + 1);
   double alpha2 = 2.0 / (len_hrma + 1);
   double alpha3 = 2.0 / (MathSqrt(len_hrma) + 1);

   for(int i = start; i < rates_total; i++)
     {
      if(i == 0)
        {
         RMA1Buffer[i] = HRMACalcBuffer[i];
         RMA2Buffer[i] = HRMACalcBuffer[i];
         HRMABuffer[i] = HRMACalcBuffer[i];
        }
      else
        {
         RMA1Buffer[i] = alpha1 * HRMACalcBuffer[i] + (1 - alpha1) * RMA1Buffer[i-1];
         RMA2Buffer[i] = alpha2 * HRMACalcBuffer[i] + (1 - alpha2) * RMA2Buffer[i-1];
         double hrmaValue = 2 * RMA1Buffer[i] - RMA2Buffer[i];
         HRMABuffer[i] = alpha3 * hrmaValue + (1 - alpha3) * HRMABuffer[i-1];
        }
     }
  }

//+------------------------------------------------------------------+
//| Calculate TEMA using the original methodology                    |
//+------------------------------------------------------------------+
void CalculateTEMA(int rates_total, int start)
  {
   double alpha = 2.0 / (InpPeriodEMA + 1);
   
   // Calculate first EMA
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      if(i == 0)
        {
         EMABuffer[i] = PriceBuffer[i];
        }
      else
        {
         EMABuffer[i] = alpha * PriceBuffer[i] + (1 - alpha) * EMABuffer[i - 1];
        }
     }
   
   // Calculate EMA of EMA
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      if(i < InpPeriodEMA - 1)
        {
         EMAofEMABuffer[i] = 0;
         continue;
        }
      
      if(i == InpPeriodEMA - 1)
        {
         EMAofEMABuffer[i] = EMABuffer[i];
        }
      else
        {
         EMAofEMABuffer[i] = alpha * EMABuffer[i] + (1 - alpha) * EMAofEMABuffer[i - 1];
        }
     }
   
   // Calculate EMA of EMA of EMA
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      if(i < 2 * InpPeriodEMA - 2)
        {
         EMAofEMAofEMABuffer[i] = 0;
         continue;
        }
      
      if(i == 2 * InpPeriodEMA - 2)
        {
         EMAofEMAofEMABuffer[i] = EMAofEMABuffer[i];
        }
      else
        {
         EMAofEMAofEMABuffer[i] = alpha * EMAofEMABuffer[i] + (1 - alpha) * EMAofEMAofEMABuffer[i - 1];
        }
     }
   
   // Calculate final TEMA value
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      if(i < 3 * InpPeriodEMA - 3)
        {
         TEMABuffer[i] = 0;
         continue;
        }
      
      TEMABuffer[i] = 3 * EMABuffer[i] - 3 * EMAofEMABuffer[i] + EMAofEMAofEMABuffer[i];
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