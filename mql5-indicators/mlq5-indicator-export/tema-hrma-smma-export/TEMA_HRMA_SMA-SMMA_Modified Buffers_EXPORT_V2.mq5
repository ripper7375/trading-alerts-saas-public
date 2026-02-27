//+------------------------------------------------------------------+
//|         SMA-SMMA-HRMA-TEMA Indicator with Data Export.mq5       |
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

//--- button name constant
#define EXPORT_BUTTON_NAME "TEMAExportButton"

//--- input parameters (original)
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
input color              InpTEMAColor=clrGray;       // TEMA Line color
input int                InpTEMAWidth=1;             // TEMA Line width

//--- input parameters (export)
input int                InpExportBars=500;        // Number of bars to export
input string             InpExportFileName="TEMA_HRMA_SMMA"; // Base export filename

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

//--- global arrays to cache time and close from OnCalculate for export
//    Indexed oldest-first (same direction as indicator buffers):
//    index 0 = oldest bar,  index rates_total-1 = newest bar
datetime g_time[];
double   g_close[];
int      g_rates_total = 0;

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

//--- create export button
   CreateExportButton();
  }

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ChartRedraw(0);
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

//--- cache time[] and close[] for export (same oldest-first index as indicator buffers)
   if(ArraySize(g_time) < rates_total)
     {
      ArrayResize(g_time,  rates_total);
      ArrayResize(g_close, rates_total);
     }
   int copy_start = prev_calculated > 0 ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++)
     {
      g_time[j]  = time[j];
      g_close[j] = close[j];
     }
   g_rates_total = rates_total;

//--- return value of prev_calculated for next call
   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Chart event handler - handles export button click               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
   if(id == CHARTEVENT_OBJECT_CLICK)
     {
      if(sparam == EXPORT_BUTTON_NAME)
        {
         if(ExportData())
            Print("SUCCESS: Indicator data exported successfully");
         else
            Print("ERROR: Failed to export indicator data. See log for details.");

         //--- reset button state
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        }
     }
  }

//+------------------------------------------------------------------+
//| Create export button on chart                                    |
//+------------------------------------------------------------------+
void CreateExportButton()
  {
//--- delete existing button if present
   ObjectDelete(0, EXPORT_BUTTON_NAME);

//--- create button object
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

//--- button dimensions
   int button_width  = 200;
   int button_height = 50;
   int x_margin      = 250;
   int y_margin      = 100;

//--- position at lower-right corner
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER,     CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE,  x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE,  y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE,      button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE,      button_height);

//--- text and font
   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_TEXT,       "Export Data");
   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_FONT,       "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE,   11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR,      clrWhite);

//--- visual style
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR,    C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

//--- button behaviour
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR,     ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN,     false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER,     999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE,      false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK,       false);

   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| Convert ENUM_TIMEFRAMES to human-readable string                 |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES timeframe)
  {
   switch(timeframe)
     {
      case PERIOD_M1:   return "M1";
      case PERIOD_M5:   return "M5";
      case PERIOD_M15:  return "M15";
      case PERIOD_M30:  return "M30";
      case PERIOD_H1:   return "H1";
      case PERIOD_H4:   return "H4";
      case PERIOD_D1:   return "D1";
      case PERIOD_W1:   return "W1";
      case PERIOD_MN1:  return "MN1";
      default:          return EnumToString(timeframe);
     }
  }

//+------------------------------------------------------------------+
//| Export indicator data to tab-separated text file                 |
//| Format: timestamp | symbol | timeframe | close | tema | hrma | smma |
//+------------------------------------------------------------------+
bool ExportData()
  {
   string symbol = Symbol();
   string tf_str = TimeframeToString(Period());

   if(g_rates_total <= 0)
     {
      Print("ERROR: No bars available for export (indicator not yet calculated)");
      return false;
     }

   //--- determine how many bars to export, starting from the oldest available
   int bars_to_export = MathMin(InpExportBars, g_rates_total);
   //--- start_idx: oldest bar that will be exported
   //    g_time[], g_close[], and all indicator buffers share the same oldest-first
   //    indexing, so one index variable correctly addresses all of them.
   int start_idx = g_rates_total - bars_to_export;

   //--- build filename: BaseName_Symbol_Timeframe.csv
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string filename  = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting to file: ", full_path);

   //--- open file for writing
   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open file for writing. Error: ", GetLastError());
      return false;
     }

   bool write_success = true;

   //--- write header row
   write_success &= FileWrite(file_handle, "timestamp\tsymbol\ttimeframe\tclose\ttema\thrma\tsmma") > 0;

   //--- compute UTC offset once before the loop
   datetime gmt_offset = TimeCurrent() - TimeGMT();

   //--- write data rows oldest-first
   //    idx directly addresses g_time[], g_close[], TEMABuffer[], HRMABuffer[], SMMABuffer[]
   //    since all share the same oldest=start_idx, newest=g_rates_total-1 direction.
   //    Warmup (empty) rows therefore appear at the top of the file (oldest bars) as expected.
   for(int i = 0; i < bars_to_export; i++)
     {
      int idx = start_idx + i;  // oldest exported bar at i=0, newest at i=bars_to_export-1

      //--- skip both 0.0 (explicit warmup sentinel) and EMPTY_VALUE (DBL_MAX, MT5's default
      //    pre-fill for indicator buffer slots not yet reached by the MA calculations)
      string tema_str = (TEMABuffer[idx] != 0.0 && TEMABuffer[idx] != EMPTY_VALUE
                         ? DoubleToString(TEMABuffer[idx], _Digits) : "");
      string hrma_str = (HRMABuffer[idx] != 0.0 && HRMABuffer[idx] != EMPTY_VALUE
                         ? DoubleToString(HRMABuffer[idx], _Digits) : "");
      string smma_str = (SMMABuffer[idx] != 0.0 && SMMABuffer[idx] != EMPTY_VALUE
                         ? DoubleToString(SMMABuffer[idx], _Digits) : "");

      string line = StringFormat("%I64d\t%s\t%s\t%s\t%s\t%s\t%s",
                                 (long)(g_time[idx] - gmt_offset),
                                 symbol,
                                 tf_str,
                                 DoubleToString(g_close[idx], _Digits),
                                 tema_str,
                                 hrma_str,
                                 smma_str);

      write_success &= FileWrite(file_handle, line) > 0;
     }

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Some rows failed to write to file");
      return false;
     }

   Print("Data export complete: ", bars_to_export, " bars written to ", filename);
   return true;
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
