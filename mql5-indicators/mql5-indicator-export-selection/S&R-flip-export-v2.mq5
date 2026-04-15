//+------------------------------------------------------------------+
//|                                                S&R-FL-export.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.30"
#property description "Support & Resistance Flip Lines (S&R FL) with Export"

#property indicator_chart_window
#property indicator_buffers 14
#property indicator_plots   14

//--- Enums
#define EXPORT_BUTTON_NAME "S&R_FL_ExportButton"

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
input string            Sep0 = "===== Lookback Window =====";
input int               InpLookbackBars = 1000;    // Rolling Lookback Period
input int               InpMaxFlipLines = 4;       // Max S&R FLs to Draw/Export (Max 10)

input string            Sep1 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;
input int               InpSymbolOffset = 0;

input string            Sep2 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS_119 InpFractalBars119 = BARS_13;
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;
input int               InpSymbolOffset119 = 0;

input string            Sep3 = "===== S&R Flip Line Rules =====";
input int               InpMinTouches = 3;         // Minimum 108 touches (Peak + Bottom)
input bool              InpRequireBothSides = true;// TRUE = Must have at least 1 Peak & 1 Bottom touch
input double            InpMaxLineAngle = 3.0;     // Max Slope/Angle 
input double            InpMinLineSeparationPercent = 3.0; // Min % separation between lines at current bar
input color             InpFlipLineColor = clrBlue;// Color for Flip Lines

input string            Sep4 = "===== Tolerance Settings =====";
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 0.50; 
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;

input string            Sep5 = "===== Export Settings =====";
input string            InpExportFileName = "SR_FlipLines";
input bool              InpIncludeHeader = true;

//--- Indicator buffers (Combined maps into visuals to save buffers)
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];

//--- 10 Flip Line Buffers
double ExtFL1[], ExtFL2[], ExtFL3[], ExtFL4[], ExtFL5[];
double ExtFL6[], ExtFL7[], ExtFL8[], ExtFL9[], ExtFL10[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtSideBars119;
int    ExtMinBars119;
int    ExtATRHandle = INVALID_HANDLE;
datetime ExtLastBarTime = 0;

//--- Structures for Logic
struct FractalPoint {
   int    bar;
   double price;
   bool   is_peak;
};

struct FlipLine {
   int    bar_start;
   int    bar_end;
   double price_start;
   double price_end;
   int    touches;
   bool   has_peak;
   bool   has_bottom;
   double slope;
   double y_intercept;
   double angle_degrees;
   double score;
   int    touched_bars[];
};

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
  {
   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;
   ExtSideBars119 = (InpFractalBars119 - 1) / 2;
   ExtMinBars119 = InpFractalBars119;
   
   if(InpMaxFlipLines > 10) { Print("ERROR: InpMaxFlipLines clamped to 10."); }
   
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   // Bind Buffers
   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   
   SetIndexBuffer(4, ExtFL1, INDICATOR_DATA);
   SetIndexBuffer(5, ExtFL2, INDICATOR_DATA);
   SetIndexBuffer(6, ExtFL3, INDICATOR_DATA);
   SetIndexBuffer(7, ExtFL4, INDICATOR_DATA);
   SetIndexBuffer(8, ExtFL5, INDICATOR_DATA);
   SetIndexBuffer(9, ExtFL6, INDICATOR_DATA);
   SetIndexBuffer(10, ExtFL7, INDICATOR_DATA);
   SetIndexBuffer(11, ExtFL8, INDICATOR_DATA);
   SetIndexBuffer(12, ExtFL9, INDICATOR_DATA);
   SetIndexBuffer(13, ExtFL10, INDICATOR_DATA);

   ArraySetAsSeries(ExtUpperBuffer, true); ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true); ArraySetAsSeries(ExtLowerBuffer119, true);
   
   ArraySetAsSeries(ExtFL1, true); ArraySetAsSeries(ExtFL2, true);
   ArraySetAsSeries(ExtFL3, true); ArraySetAsSeries(ExtFL4, true);
   ArraySetAsSeries(ExtFL5, true); ArraySetAsSeries(ExtFL6, true);
   ArraySetAsSeries(ExtFL7, true); ArraySetAsSeries(ExtFL8, true);
   ArraySetAsSeries(ExtFL9, true); ArraySetAsSeries(ExtFL10, true);
   
   // EXPLICIT Plot Configuration for MT5 Rendering
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

   // Configure all 10 Line Plots explicitly
   for(int i = 4; i <= 13; i++) {
      PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_LINE);
      PlotIndexSetInteger(i, PLOT_LINE_STYLE, STYLE_SOLID);
      PlotIndexSetInteger(i, PLOT_LINE_WIDTH, 2);
      PlotIndexSetInteger(i, PLOT_LINE_COLOR, InpFlipLineColor);
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);
      PlotIndexSetString(i, PLOT_LABEL, "S&R FL #" + IntegerToString(i-3));
   }

   IndicatorSetString(INDICATOR_SHORTNAME, "S&R FL Model");
   CreateExportButton();
   
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
  }

//+------------------------------------------------------------------+
void CreateExportButton()
  {
    if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0)) return;

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 80);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export S&R FL Data");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME)
      {
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        ExportFlipLineData();
        ChartRedraw(0);
      }
  }

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
   double normalized_change = percent_change / bar_distance;
   return MathArctan(normalized_change) * 180.0 / M_PI;
  }

void ClearAllFLBuffers()
  {
   ArrayInitialize(ExtFL1, EMPTY_VALUE); ArrayInitialize(ExtFL2, EMPTY_VALUE);
   ArrayInitialize(ExtFL3, EMPTY_VALUE); ArrayInitialize(ExtFL4, EMPTY_VALUE);
   ArrayInitialize(ExtFL5, EMPTY_VALUE); ArrayInitialize(ExtFL6, EMPTY_VALUE);
   ArrayInitialize(ExtFL7, EMPTY_VALUE); ArrayInitialize(ExtFL8, EMPTY_VALUE);
   ArrayInitialize(ExtFL9, EMPTY_VALUE); ArrayInitialize(ExtFL10, EMPTY_VALUE);
  }

bool IsDuplicateLine(FlipLine &a, FlipLine &b)
  {
   int shared = 0;
   int size_a = ArraySize(a.touched_bars);
   int size_b = ArraySize(b.touched_bars);
   for(int i=0; i<size_a; i++) {
      for(int j=0; j<size_b; j++) {
         if(a.touched_bars[i] == b.touched_bars[j]) shared++;
      }
   }
   return (shared >= 2); 
  }

//+------------------------------------------------------------------+
void BuildFlipLines(const int rates_total, double current_close)
  {
   ClearAllFLBuffers();
   
   if(current_close <= 0) current_close = 1.0; // Failsafe against division by zero
   int lookback = MathMin(InpLookbackBars, rates_total - 1);
   if(lookback < ExtMinBars) return;

   // 1. Gather all 108 fractals inside the lookback window
   FractalPoint fractals[];
   for(int i = 0; i <= lookback; i++)
     {
      if(ExtUpperBuffer[i] != EMPTY_VALUE && ExtUpperBuffer[i] > 0)
        {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i; 
         fractals[sz].price = ExtUpperBuffer[i];
         fractals[sz].is_peak = true;
        }
      if(ExtLowerBuffer[i] != EMPTY_VALUE && ExtLowerBuffer[i] > 0)
        {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i;
         fractals[sz].price = ExtLowerBuffer[i];
         fractals[sz].is_peak = false;
        }
     }

   int f_count = ArraySize(fractals);
   if(f_count < InpMinTouches) return;

   // Sort fractals chronologically 
   for(int i = 0; i < f_count - 1; i++) {
      for(int j = i + 1; j < f_count; j++) {
         if(fractals[j].bar < fractals[i].bar) {
            FractalPoint tmp = fractals[i];
            fractals[i] = fractals[j];
            fractals[j] = tmp;
         }
      }
   }

   FlipLine candidates[];
   int cand_count = 0;

   // 2. Find Lines
   for(int i = 0; i < f_count - 1; i++)
     {
      for(int j = i + 1; j < f_count; j++)
        {
         int dist_bars = fractals[j].bar - fractals[i].bar;
         if(dist_bars < 10) continue; 

         double angle = CalculateNormalizedAngle(fractals[i].price, fractals[j].price, dist_bars);
         if(MathAbs(angle) > InpMaxLineAngle) continue; 

         double slope = (fractals[j].price - fractals[i].price) / (double)dist_bars;
         double y_intercept = fractals[i].price - slope * fractals[i].bar;
         
         bool has_peak = fractals[i].is_peak || fractals[j].is_peak;
         bool has_bottom = !fractals[i].is_peak || !fractals[j].is_peak;
         
         int touches = 2;
         int touched_indices[];
         ArrayResize(touched_indices, 2);
         touched_indices[0] = i; touched_indices[1] = j;

         for(int k = 0; k < f_count; k++)
           {
            if(k == i || k == j) continue;
            
            double expected_price = slope * fractals[k].bar + y_intercept;
            double diff = MathAbs(fractals[k].price - expected_price);
            double tol = CalculateTolerance(fractals[k].price);

            if(diff <= tol)
              {
               touches++;
               ArrayResize(touched_indices, touches);
               touched_indices[touches - 1] = k;
               if(fractals[k].is_peak) has_peak = true;
               else has_bottom = true;
              }
           }

         bool pass_flip_check = InpRequireBothSides ? (has_peak && has_bottom) : true;
         
         if(touches >= InpMinTouches && pass_flip_check)
           {
            ArrayResize(candidates, cand_count + 1);
            candidates[cand_count].bar_start = fractals[i].bar;
            candidates[cand_count].bar_end = fractals[j].bar; 
            candidates[cand_count].price_start = fractals[i].price;
            candidates[cand_count].price_end = fractals[j].price;
            candidates[cand_count].slope = slope;
            candidates[cand_count].y_intercept = y_intercept;
            candidates[cand_count].angle_degrees = angle;
            candidates[cand_count].touches = touches;
            candidates[cand_count].score = (touches * 10000.0) + (fractals[j].bar - fractals[i].bar);
            
            for(int x = 0; x < touches - 1; x++) {
               for(int y = x + 1; y < touches; y++) {
                  if(fractals[touched_indices[y]].bar < fractals[touched_indices[x]].bar) {
                     int tmp = touched_indices[x];
                     touched_indices[x] = touched_indices[y];
                     touched_indices[y] = tmp;
                  }
               }
            }
            
            ArrayResize(candidates[cand_count].touched_bars, touches);
            for(int t=0; t<touches; t++) candidates[cand_count].touched_bars[t] = fractals[touched_indices[t]].bar;
            
            cand_count++;
           }
        }
     }

   if(cand_count == 0) return;

   // Sort descending by score
   for(int i = 0; i < cand_count - 1; i++) {
      for(int j = i + 1; j < cand_count; j++) {
         if(candidates[j].score > candidates[i].score) {
            FlipLine tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;
         }
      }
   }

   FlipLine final_lines[];
   int final_count = 0;
   int max_allowed = MathMin(InpMaxFlipLines, 10);

   // 3. SPATIAL DEDUPLICATION & CLUSTERING FILTER
   for(int i = 0; i < cand_count && final_count < max_allowed; i++)
     {
      bool is_dup_or_close = false;
      
      // Calculate where candidate line is located at the absolute current bar
      double cand_price_now = candidates[i].slope * (rates_total - 1) + candidates[i].y_intercept;

      for(int f = 0; f < final_count; f++)
        {
         // Check 1: Shared Fractal Points (Hard Duplicate)
         if(IsDuplicateLine(candidates[i], final_lines[f])) {
            is_dup_or_close = true; break;
         }
         
         // Check 2: Minimum Distance Separation
         double final_price_now = final_lines[f].slope * (rates_total - 1) + final_lines[f].y_intercept;
         double distance_pct = MathAbs(cand_price_now - final_price_now) / current_close * 100.0;
         
         if(distance_pct < InpMinLineSeparationPercent) {
            is_dup_or_close = true; break; // Too close to an already accepted line, skip it.
         }
        }
        
      if(!is_dup_or_close)
        {
         ArrayResize(final_lines, final_count + 1);
         final_lines[final_count] = candidates[i];
         final_count++;
        }
     }

   // 4. Draw to Buffers
   for(int L = 0; L < final_count; L++)
     {
      double m = final_lines[L].slope;
      double c = final_lines[L].y_intercept;
      
      for(int i = 0; i <= lookback; i++)
        {
         int chrono_bar = rates_total - 1 - i;
         if(chrono_bar >= final_lines[L].touched_bars[0]) 
           {
            double val = m * chrono_bar + c;
            switch(L) {
               case 0: ExtFL1[i] = val; break; case 1: ExtFL2[i] = val; break;
               case 2: ExtFL3[i] = val; break; case 3: ExtFL4[i] = val; break;
               case 4: ExtFL5[i] = val; break; case 5: ExtFL6[i] = val; break;
               case 6: ExtFL7[i] = val; break; case 7: ExtFL8[i] = val; break;
               case 8: ExtFL9[i] = val; break; case 9: ExtFL10[i] = val; break;
            }
           }
        }
     }
  }

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
      ArrayInitialize(ExtUpperBuffer, EMPTY_VALUE);
      ArrayInitialize(ExtLowerBuffer, EMPTY_VALUE);
      ArrayInitialize(ExtUpperBuffer119, EMPTY_VALUE);
      ArrayInitialize(ExtLowerBuffer119, EMPTY_VALUE);
      ExtLastBarTime = time[0];
   }
   else if(time[0] != ExtLastBarTime) {
      new_bar = true;
      ExtLastBarTime = time[0];
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

   // Pass close[0] to the builder to establish % Separation metrics
   if(prev_calculated == 0 || new_bar) BuildFlipLines(rates_total, close[0]);

   ChartRedraw(0); 
   return(rates_total);
  }

//+------------------------------------------------------------------+
bool ExportFlipLineData()
  {
    string symbol = _Symbol;
    ENUM_TIMEFRAMES timeframe = _Period;
    
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
    
    string tf_str = EnumToString(timeframe);
    StringReplace(tf_str, "PERIOD_", ""); // This removes the "PERIOD_" prefix
    string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(file_handle == INVALID_HANDLE) {
        Print("ERROR: Failed to open file for writing.");
        return false;
    }

    bool write_success = true;
    if(InpIncludeHeader) {
        string header = "timestamp\tsymbol\ttimeframe\tclose\tFL_1\tFL_2\tFL_3\tFL_4\tFL_5\tFL_6\tFL_7\tFL_8\tFL_9\tFL_10";
        write_success &= FileWrite(file_handle, header) > 0;
    }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    int export_limit = MathMin(InpLookbackBars, iBars(symbol, timeframe) - 1);

    for(int bar_idx = export_limit; bar_idx >= 0; bar_idx--)
      {
        string line = IntegerToString((long)(iTime(symbol, timeframe, bar_idx) - gmt_offset)) + "\t";
        line += symbol + "\t" + tf_str + "\t";
        line += DoubleToString(iClose(symbol, timeframe, bar_idx), _Digits) + "\t";
        
        line += (ExtFL1[bar_idx] == EMPTY_VALUE || ExtFL1[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL1[bar_idx], 5) + "\t";
        line += (ExtFL2[bar_idx] == EMPTY_VALUE || ExtFL2[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL2[bar_idx], 5) + "\t";
        line += (ExtFL3[bar_idx] == EMPTY_VALUE || ExtFL3[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL3[bar_idx], 5) + "\t";
        line += (ExtFL4[bar_idx] == EMPTY_VALUE || ExtFL4[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL4[bar_idx], 5) + "\t";
        line += (ExtFL5[bar_idx] == EMPTY_VALUE || ExtFL5[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL5[bar_idx], 5) + "\t";
        line += (ExtFL6[bar_idx] == EMPTY_VALUE || ExtFL6[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL6[bar_idx], 5) + "\t";
        line += (ExtFL7[bar_idx] == EMPTY_VALUE || ExtFL7[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL7[bar_idx], 5) + "\t";
        line += (ExtFL8[bar_idx] == EMPTY_VALUE || ExtFL8[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL8[bar_idx], 5) + "\t";
        line += (ExtFL9[bar_idx] == EMPTY_VALUE || ExtFL9[bar_idx] == 0) ? "\t" : DoubleToString(ExtFL9[bar_idx], 5) + "\t";
        line += (ExtFL10[bar_idx] == EMPTY_VALUE || ExtFL10[bar_idx] == 0) ? "" : DoubleToString(ExtFL10[bar_idx], 5);

        write_success &= FileWrite(file_handle, line) > 0;
      }

    FileClose(file_handle);
    if(write_success) Print("S&R FL data exported to: ", filename);
    return write_success;
  }
//+------------------------------------------------------------------+