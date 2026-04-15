//+------------------------------------------------------------------+
//|                                     Equal-Distance-Trendline.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//|                    Modified: Added 1 Window Period Calculation   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.01"
#property description "Equal Distance Trendlines (EDT) based on S&R FL with Window Period"

#property indicator_chart_window
#property indicator_buffers 14
#property indicator_plots   14

//--- Enums
#define EXPORT_BUTTON_NAME "EDT_ExportButton"

enum ENUM_FRACTAL_BARS {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
};
enum ENUM_FRACTAL_BARS_119 {
   BARS_5 = 5, BARS_7 = 7, BARS_9 = 9, BARS_11 = 11,
   BARS_13 = 13, BARS_15_119 = 15, BARS_17_119 = 17, BARS_19_119 = 19
};
enum ENUM_SYMBOL_SIZE {
   SIZE_SMALL = 1, SIZE_NORMAL = 3, SIZE_LARGE = 5
};
enum ENUM_TOLERANCE_TYPE {
   TOLERANCE_ATR, TOLERANCE_PERCENT
};

//--- Input parameters
input string            Sep0 = "===== Window Period =====";
input int               InpStartBar = 1000;      // Starting bar of Window Period (Less recent)
input int               InpEndBar = 200;         // Ending bar of Window Period (More recent)
input int               InpMaxEDTLines = 4;      // Max EDTs to Draw (Max 9)

input string            Sep1 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;
input int               InpSymbolOffset = 0;
input string            Sep2 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS_119 InpFractalBars119 = BARS_13;
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;
input int               InpSymbolOffset119 = 0;
input string            Sep3 = "===== Base S&R FL & EDT Rules =====";
input int               InpMinTouches = 3;       // Minimum touches for Base & EDTs
input bool              InpRequireBothSides = true;// TRUE = Base Line must have Peak & Bottom
input double            InpMaxLineAngle = 3.0;   // Max Slope/Angle for Base Line
input double            InpMinLineSeparationPercent = 1.0; // Min % separation between channels
input color             InpBaseLineColor = clrBlue;// Color for Base S&R FL (Solid)
input color             InpEDTColor = clrRed;    // Color for EDTs (Dashed)

input string            Sep4 = "===== Tolerance Settings =====";
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.00;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;
input string            Sep5 = "===== Export Settings =====";
input string            InpExportFileName = "EDT_Lines";
input bool              InpIncludeHeader = true;

//--- Indicator buffers 
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];
//--- Line Buffers (1 Base Line + 9 EDTs)
double ExtBaseLine[];
double ExtEDT1[], ExtEDT2[], ExtEDT3[], ExtEDT4[], ExtEDT5[];
double ExtEDT6[], ExtEDT7[], ExtEDT8[], ExtEDT9[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtSideBars119;
int    ExtMinBars119;
int    ExtATRHandle = INVALID_HANDLE;
datetime ExtLastBarTime = 0;

//--- Structures
struct FractalPoint {
   int    bar;
   double price;
   bool   is_peak;
};

struct TrendLine {
   int    bar_start;
   int    bar_end;
   double price_start;
   double price_end;
   int    touches;
   double slope;
   double y_intercept;
   double angle_degrees;
   double score;
};

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;
   ExtSideBars119 = (InpFractalBars119 - 1) / 2;
   ExtMinBars119 = InpFractalBars119;
   
   if(InpMaxEDTLines > 9) { Print("ERROR: InpMaxEDTLines clamped to 9."); }
   
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   
   SetIndexBuffer(4, ExtBaseLine, INDICATOR_DATA);
   SetIndexBuffer(5, ExtEDT1, INDICATOR_DATA); SetIndexBuffer(6, ExtEDT2, INDICATOR_DATA);
   SetIndexBuffer(7, ExtEDT3, INDICATOR_DATA); SetIndexBuffer(8, ExtEDT4, INDICATOR_DATA);
   SetIndexBuffer(9, ExtEDT5, INDICATOR_DATA); SetIndexBuffer(10, ExtEDT6, INDICATOR_DATA);
   SetIndexBuffer(11, ExtEDT7, INDICATOR_DATA); SetIndexBuffer(12, ExtEDT8, INDICATOR_DATA);
   SetIndexBuffer(13, ExtEDT9, INDICATOR_DATA);

   ArraySetAsSeries(ExtUpperBuffer, true); ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true); ArraySetAsSeries(ExtLowerBuffer119, true);
   
   ArraySetAsSeries(ExtBaseLine, true);
   ArraySetAsSeries(ExtEDT1, true); ArraySetAsSeries(ExtEDT2, true);
   ArraySetAsSeries(ExtEDT3, true); ArraySetAsSeries(ExtEDT4, true);
   ArraySetAsSeries(ExtEDT5, true); ArraySetAsSeries(ExtEDT6, true);
   ArraySetAsSeries(ExtEDT7, true);
   ArraySetAsSeries(ExtEDT8, true);
   ArraySetAsSeries(ExtEDT9, true);
   
   // Fractal Plots
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(0, PLOT_ARROW, 108);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrRed);
   PlotIndexSetInteger(0, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetInteger(0, PLOT_ARROW_SHIFT, -InpSymbolOffset);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(1, PLOT_ARROW, 108);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetInteger(1, PLOT_ARROW_SHIFT, InpSymbolOffset);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE);
   PlotIndexSetInteger(2, PLOT_ARROW, 119);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrRed);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetInteger(2, PLOT_ARROW_SHIFT, -InpSymbolOffset119);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE);
   PlotIndexSetInteger(3, PLOT_ARROW, 119);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetInteger(3, PLOT_ARROW_SHIFT, InpSymbolOffset119);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   // Configure Base S&R FL Plot (Solid, Width 2)
   PlotIndexSetInteger(4, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(4, PLOT_LINE_STYLE, STYLE_SOLID);
   PlotIndexSetInteger(4, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpBaseLineColor);
   PlotIndexSetDouble(4, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetString(4, PLOT_LABEL, "Base S&R FL");

   // Configure EDT Plots (Dashed, Width 1 is REQUIRED for MT5 to show dash)
   for(int i = 5; i <= 13; i++) {
      PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_LINE);
      PlotIndexSetInteger(i, PLOT_LINE_STYLE, STYLE_DASH);
      PlotIndexSetInteger(i, PLOT_LINE_WIDTH, 1); 
      PlotIndexSetInteger(i, PLOT_LINE_COLOR, InpEDTColor);
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      PlotIndexSetString(i, PLOT_LABEL, "EDT #" + IntegerToString(i-4));
   }

   IndicatorSetString(INDICATOR_SHORTNAME, "EDT Model WP");
   CreateExportButton();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
  }

void CreateExportButton()
  {
    if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0)) return;

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 80);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export EDT Data");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME) {
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        ExportEDTData(); ChartRedraw(0);
    }
  }

//+------------------------------------------------------------------+
//| Math & Support Functions                                         |
//+------------------------------------------------------------------+
bool IsUpperFractal(const double &high[], int index, int side_bars)
  {
   double center_high = high[index];
   for(int i = 1; i <= side_bars; i++) if(center_high <= high[index - i]) return false;
   for(int i = 1; i <= side_bars; i++) if(center_high < high[index + i]) return false;
   return true;
  }

bool IsLowerFractal(const double &low[], int index, int side_bars)
  {
   double center_low = low[index];
   for(int i = 1; i <= side_bars; i++) if(center_low >= low[index - i]) return false;
   for(int i = 1; i <= side_bars; i++) if(center_low > low[index + i]) return false;
   return true;
  }

double CalculateTolerance(double reference_price)
  {
   if(InpToleranceType == TOLERANCE_ATR && ExtATRHandle != INVALID_HANDLE)
     {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0)
         return atr_array[0] * InpToleranceATRMultiplier;
     }
   return reference_price * (InpTolerancePercent / 100.0);
  }

double CalculateNormalizedAngle(double price_start, double price_end, int bar_distance)
  {
   if(bar_distance <= 0) return 0;
   double price_change = price_end - price_start;
   double price_mid = (price_start + price_end) / 2.0;
   if(price_mid <= 0) return 0;
   double percent_change = (price_change / price_mid) * 100.0;
   return MathArctan(percent_change / bar_distance) * 180.0 / M_PI;
  }

void ClearAllBuffers()
  {
   ArrayInitialize(ExtBaseLine, EMPTY_VALUE);
   ArrayInitialize(ExtEDT1, EMPTY_VALUE); ArrayInitialize(ExtEDT2, EMPTY_VALUE);
   ArrayInitialize(ExtEDT3, EMPTY_VALUE); ArrayInitialize(ExtEDT4, EMPTY_VALUE);
   ArrayInitialize(ExtEDT5, EMPTY_VALUE); ArrayInitialize(ExtEDT6, EMPTY_VALUE);
   ArrayInitialize(ExtEDT7, EMPTY_VALUE); ArrayInitialize(ExtEDT8, EMPTY_VALUE);
   ArrayInitialize(ExtEDT9, EMPTY_VALUE);
  }

//+------------------------------------------------------------------+
//| Main EDT Algorithm with Window Period                            |
//+------------------------------------------------------------------+
void BuildEDTLines(const int rates_total, double current_close)
  {
   ClearAllBuffers();
   if(current_close <= 0) current_close = 1.0;
   
   // Bound the window
   int start_idx = MathMin(rates_total - 1, MathMax(InpStartBar, InpEndBar));
   int end_idx = MathMax(0, MathMin(InpStartBar, InpEndBar));

   if(start_idx - end_idx < ExtMinBars) return;

   // 1. Gather all 108 fractals strictly WITHIN the Window Period
   FractalPoint fractals[];
   for(int i = end_idx; i <= start_idx; i++) {
      if(ExtUpperBuffer[i] != EMPTY_VALUE && ExtUpperBuffer[i] > 0) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i; 
         fractals[sz].price = ExtUpperBuffer[i];
         fractals[sz].is_peak = true;
      }
      if(ExtLowerBuffer[i] != EMPTY_VALUE && ExtLowerBuffer[i] > 0) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i;
         fractals[sz].price = ExtLowerBuffer[i];
         fractals[sz].is_peak = false;
      }
   }

   int f_count = ArraySize(fractals);
   if(f_count < InpMinTouches) return;

   // 2. Find the Single Best Base S&R FL Line based on Window Period
   TrendLine base_candidates[];
   int cand_count = 0;
   
   for(int i = 0; i < f_count - 1; i++) {
      for(int j = i + 1; j < f_count; j++) {
         int dist_bars = MathAbs(fractals[j].bar - fractals[i].bar);
         if(dist_bars < 10) continue; 

         double angle = CalculateNormalizedAngle(fractals[i].price, fractals[j].price, dist_bars);
         if(MathAbs(angle) > InpMaxLineAngle) continue;

         double slope = (fractals[j].price - fractals[i].price) / (double)dist_bars;
         double y_intercept = fractals[i].price - slope * fractals[i].bar;

         bool has_peak = fractals[i].is_peak || fractals[j].is_peak;
         bool has_bottom = !fractals[i].is_peak || !fractals[j].is_peak;
         
         int touches = 2;
         for(int k = 0; k < f_count; k++) {
            if(k == i || k == j) continue;
            double expected_price = slope * fractals[k].bar + y_intercept;
            double diff = MathAbs(fractals[k].price - expected_price);

            if(diff <= CalculateTolerance(fractals[k].price)) {
               touches++;
               if(fractals[k].is_peak) has_peak = true; else has_bottom = true;
            }
         }

         bool pass_flip = InpRequireBothSides ? (has_peak && has_bottom) : true;
         if(touches >= InpMinTouches && pass_flip) {
            ArrayResize(base_candidates, cand_count + 1);
            base_candidates[cand_count].slope = slope;
            base_candidates[cand_count].y_intercept = y_intercept;
            base_candidates[cand_count].touches = touches;
            base_candidates[cand_count].bar_start = MathMin(fractals[i].bar, fractals[j].bar);
            base_candidates[cand_count].score = (touches * 10000.0) + dist_bars;
            cand_count++;
         }
      }
   }

   if(cand_count == 0) return; // No Base Line found

   // Find absolute best base line
   TrendLine BaseLine = base_candidates[0];
   for(int i = 1; i < cand_count; i++) {
      if(base_candidates[i].score > BaseLine.score) BaseLine = base_candidates[i];
   }

   // 3. Draw Base Line (Projected from Start Bar down to current price 0)
   double base_price_now = BaseLine.slope * (rates_total - 1) + BaseLine.y_intercept;
   for(int i = 0; i <= start_idx; i++) {
      int chrono_bar = rates_total - 1 - i;
      if(chrono_bar >= BaseLine.bar_start) {
         ExtBaseLine[i] = BaseLine.slope * chrono_bar + BaseLine.y_intercept;
      }
   }

   // 4. Calculate EDTs using Base Line Slope
   TrendLine edt_candidates[];
   int edt_count = 0;
   double base_slope = BaseLine.slope;

   // Treat every fractal in the window as a potential starting anchor
   for(int i = 0; i < f_count; i++) {
      double test_intercept = fractals[i].price - base_slope * fractals[i].bar;
      int touches = 0;
      int min_bar = INT_MAX;
      int max_bar = -1;

      for(int k = 0; k < f_count; k++) {
         double expected = base_slope * fractals[k].bar + test_intercept;
         if(MathAbs(fractals[k].price - expected) <= CalculateTolerance(fractals[k].price)) {
            touches++;
            if(fractals[k].bar < min_bar) min_bar = fractals[k].bar;
            if(fractals[k].bar > max_bar) max_bar = fractals[k].bar;
         }
      }

      // EDTs don't need Peak/Bottom combo check, just touches
      if(touches >= InpMinTouches) {
         ArrayResize(edt_candidates, edt_count + 1);
         edt_candidates[edt_count].slope = base_slope;
         edt_candidates[edt_count].y_intercept = test_intercept;
         edt_candidates[edt_count].touches = touches;
         edt_candidates[edt_count].bar_start = min_bar;
         edt_candidates[edt_count].score = (touches * 10000.0) + (max_bar - min_bar);
         edt_count++;
      }
   }

   if(edt_count == 0) return;

   // Sort EDTs by score descending
   for(int i = 0; i < edt_count - 1; i++) {
      for(int j = i + 1; j < edt_count; j++) {
         if(edt_candidates[j].score > edt_candidates[i].score) {
            TrendLine tmp = edt_candidates[i];
            edt_candidates[i] = edt_candidates[j];
            edt_candidates[j] = tmp;
         }
      }
   }

   // 5. Spatial Deduplication Filter for EDTs
   TrendLine final_edts[];
   int final_count = 0;
   int max_allowed = MathMin(InpMaxEDTLines, 9);

   for(int i = 0; i < edt_count && final_count < max_allowed; i++) {
      bool too_close = false;
      double cand_price_now = base_slope * (rates_total - 1) + edt_candidates[i].y_intercept;
      
      // Check distance against Base Line
      if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) {
         continue; // EDT is basically the Base Line, skip
      }

      // Check distance against already approved EDTs
      for(int f = 0; f < final_count; f++) {
         double approved_price = base_slope * (rates_total - 1) + final_edts[f].y_intercept;
         if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) {
            too_close = true;
            break;
         }
      }

      if(!too_close) {
         ArrayResize(final_edts, final_count + 1);
         final_edts[final_count] = edt_candidates[i];
         final_count++;
      }
   }

   // 6. Draw Final EDTs (Projected from Start Bar down to current price 0)
   for(int L = 0; L < final_count; L++) {
      double c = final_edts[L].y_intercept;
      for(int i = 0; i <= start_idx; i++) {
         int chrono_bar = rates_total - 1 - i;
         if(chrono_bar >= final_edts[L].bar_start) {
            double val = base_slope * chrono_bar + c;
            switch(L) {
               case 0: ExtEDT1[i] = val; break; case 1: ExtEDT2[i] = val; break;
               case 2: ExtEDT3[i] = val; break; case 3: ExtEDT4[i] = val; break;
               case 4: ExtEDT5[i] = val; break; case 5: ExtEDT6[i] = val; break;
               case 6: ExtEDT7[i] = val; break; case 7: ExtEDT8[i] = val; break;
               case 8: ExtEDT9[i] = val; break;
            }
         }
      }
   }
  }

//+------------------------------------------------------------------+
//| OnCalculate                                                      |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated,
                const datetime &time[], const double &open[], const double &high[],
                const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[])
  {
   int global_min_bars = MathMax(ExtMinBars, ExtMinBars119);
   if(rates_total < global_min_bars) return(0);

   ArraySetAsSeries(high, true); ArraySetAsSeries(low, true);
   ArraySetAsSeries(time, true); ArraySetAsSeries(close, true);

   bool new_bar = false;
   if(prev_calculated == 0) {
      ArrayInitialize(ExtUpperBuffer, EMPTY_VALUE); ArrayInitialize(ExtLowerBuffer, EMPTY_VALUE);
      ArrayInitialize(ExtUpperBuffer119, EMPTY_VALUE); ArrayInitialize(ExtLowerBuffer119, EMPTY_VALUE);
      ExtLastBarTime = time[0];
   }
   else if(time[0] != ExtLastBarTime) {
      new_bar = true; ExtLastBarTime = time[0];
   }

   int limit = rates_total - prev_calculated;
   if (limit <= 0) limit = 1;
   
   int calc_limit_108 = limit + ExtSideBars;
   if(calc_limit_108 >= rates_total - ExtSideBars) calc_limit_108 = rates_total - ExtSideBars - 1;
   
   for(int i = calc_limit_108; i >= ExtSideBars && !IsStopped(); i--) {
      ExtUpperBuffer[i] = EMPTY_VALUE;
      ExtLowerBuffer[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars)) ExtUpperBuffer[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars))  ExtLowerBuffer[i] = low[i];
   }

   if(InpShowSymbol119) {
      int calc_limit_119 = limit + ExtSideBars119;
      if(calc_limit_119 >= rates_total - ExtSideBars119) calc_limit_119 = rates_total - ExtSideBars119 - 1;
      
      for(int i = calc_limit_119; i >= ExtSideBars119 && !IsStopped(); i--) {
         ExtUpperBuffer119[i] = EMPTY_VALUE;
         ExtLowerBuffer119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119))  ExtLowerBuffer119[i] = low[i];
      }
   }

   if(prev_calculated == 0 || new_bar) BuildEDTLines(rates_total, close[0]);

   ChartRedraw(0); 
   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Export trendline data to file                                    |
//+------------------------------------------------------------------+
bool ExportEDTData()
  {
    string symbol = _Symbol; ENUM_TIMEFRAMES timeframe = _Period;
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
    
    string tf_str = EnumToString(timeframe);
    StringReplace(tf_str, "PERIOD_", ""); // Removes the prefix
    string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(file_handle == INVALID_HANDLE) { Print("ERROR: Failed to open file for writing."); return false; }

    bool write_success = true;
    if(InpIncludeHeader) {
        string header = "timestamp\tsymbol\ttimeframe\tclose\tBase_FL\tEDT_1\tEDT_2\tEDT_3\tEDT_4\tEDT_5\tEDT_6\tEDT_7\tEDT_8\tEDT_9";
        write_success &= FileWrite(file_handle, header) > 0;
    }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    
    // Updated export limit to align with Window Period Start
    int export_limit = MathMin(InpStartBar, iBars(symbol, timeframe) - 1);

    for(int bar_idx = export_limit; bar_idx >= 0; bar_idx--) {
        string line = IntegerToString((long)(iTime(symbol, timeframe, bar_idx) - gmt_offset)) + "\t";
        line += symbol + "\t" + tf_str + "\t" + DoubleToString(iClose(symbol, timeframe, bar_idx), _Digits) + "\t";
        line += (ExtBaseLine[bar_idx] == EMPTY_VALUE || ExtBaseLine[bar_idx] == 0) ? "\t" : DoubleToString(ExtBaseLine[bar_idx], 5) + "\t";
        line += (ExtEDT1[bar_idx] == EMPTY_VALUE || ExtEDT1[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT1[bar_idx], 5) + "\t";
        line += (ExtEDT2[bar_idx] == EMPTY_VALUE || ExtEDT2[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT2[bar_idx], 5) + "\t";
        line += (ExtEDT3[bar_idx] == EMPTY_VALUE || ExtEDT3[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT3[bar_idx], 5) + "\t";
        line += (ExtEDT4[bar_idx] == EMPTY_VALUE || ExtEDT4[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT4[bar_idx], 5) + "\t";
        line += (ExtEDT5[bar_idx] == EMPTY_VALUE || ExtEDT5[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT5[bar_idx], 5) + "\t";
        line += (ExtEDT6[bar_idx] == EMPTY_VALUE || ExtEDT6[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT6[bar_idx], 5) + "\t";
        line += (ExtEDT7[bar_idx] == EMPTY_VALUE || ExtEDT7[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT7[bar_idx], 5) + "\t";
        line += (ExtEDT8[bar_idx] == EMPTY_VALUE || ExtEDT8[bar_idx] == 0) ? "\t" : DoubleToString(ExtEDT8[bar_idx], 5) + "\t";
        line += (ExtEDT9[bar_idx] == EMPTY_VALUE || ExtEDT9[bar_idx] == 0) ? "" : DoubleToString(ExtEDT9[bar_idx], 5);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);
    if(write_success) Print("EDT data exported to: ", filename);
    return write_success;
  }
//+------------------------------------------------------------------+