//+------------------------------------------------------------------+
//|                             Optimised-Single-Best-SR-FL-WP.mq5   |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//| Description: Single Best S&R FL with V4 Math Optimizations       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.10"
#property description "Optimized Single Highest-Conviction S&R FL"

#property indicator_chart_window
#property indicator_buffers 5
#property indicator_plots   5

//--- Enums
#define EXPORT_BUTTON_NAME "Speed_Line"

enum ENUM_FRACTAL_BARS {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
};
enum ENUM_FRACTAL_BARS_119 {
   BARS_5 = 5, BARS_7 = 7, BARS_9 = 9, BARS_11 = 11,
   BARS_13 = 13, BARS_15_119 = 15, BARS_17_119 = 17, BARS_19_119 = 19
};
enum ENUM_SYMBOL_SIZE { SIZE_SMALL = 1, SIZE_NORMAL = 3, SIZE_LARGE = 5 };
enum ENUM_TOLERANCE_TYPE { TOLERANCE_ATR, TOLERANCE_PERCENT };

//--- Input parameters
input string            Sep0 = "===== Window Period =====";
input datetime          InpStartDateTime = D'2026.06.05 19:15'; // Starting Date & Time
input datetime          InpEndDateTime   = D'2026.06.08 05:00'; // Ending Date & Time

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
input int               InpMinTouches = 3;       // Minimum touches (Base + Intersecting)
input bool              InpRequireBothSides = true; // TRUE = Must have Peak & Bottom touch
input double            InpMaxLineAngle = 3.0;   // Max Angle in Degrees
input color             InpBestFLColor = clrDarkBlue;// Color for Best FL

input string            Sep4 = "===== Tolerance Settings =====";
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 0.50;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;

input string            Sep5 = "===== Export Settings =====";
input string            InpExportFileName = "Single_Best_FL_Opt";
input bool              InpIncludeHeader = true;

//--- Indicator buffers 
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];
double ExtBestFL[];

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
   double slope;
   double y_intercept;
   int    touches;
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
   
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   SetIndexBuffer(4, ExtBestFL, INDICATOR_DATA);

   ArraySetAsSeries(ExtUpperBuffer, true); ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true); ArraySetAsSeries(ExtLowerBuffer119, true);
   ArraySetAsSeries(ExtBestFL, true);
   
   // Fractal Plots
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(0, PLOT_ARROW, 108);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(0, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(1, PLOT_ARROW, 108);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(1, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(2, PLOT_ARROW, 119);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(2, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(3, PLOT_ARROW, 119);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   // Best FL Plot
   PlotIndexSetInteger(4, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(4, PLOT_LINE_STYLE, STYLE_SOLID);
   PlotIndexSetInteger(4, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpBestFLColor);
   PlotIndexSetDouble(4, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetString(4, PLOT_LABEL, "Best S&R FL");

   IndicatorSetString(INDICATOR_SHORTNAME, "Opt Single Best S&R FL");
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
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 240);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Speed Line");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
    if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL") {
        if(ExportSingleFLData()) Print("SUCCESS: [Export All] Single FL exported");
        else Print("ERROR: [Export All] Failed to export Single FL.");
        return;
    }

    if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME) {
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
        ExportSingleFLData();
        ChartRedraw(0);
    }
  }

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

// OPTIMIZATION: Tolerance calculation now accepts a pre-fetched ATR to avoid API calls inside the loop
double CalculateToleranceFast(double reference_price, double prefetched_atr)
  {
   if(InpToleranceType == TOLERANCE_ATR && prefetched_atr > 0) {
       return prefetched_atr * InpToleranceATRMultiplier;
   }
   return reference_price * (InpTolerancePercent / 100.0);
  }

//+------------------------------------------------------------------+
//| Core Logic: Find the Single Best S&R FL                          |
//+------------------------------------------------------------------+
void BuildBestFlipLine(const int rates_total)
  {
   ArrayInitialize(ExtBestFL, EMPTY_VALUE);
   
   // Convert chosen datetimes to exact bar indices. 
   // 'false' tells the function to pick the nearest available bar if the exact time falls on a weekend/gap.
   int idx1 = iBarShift(_Symbol, _Period, InpStartDateTime, false);
   int idx2 = iBarShift(_Symbol, _Period, InpEndDateTime, false);
   
   // Failsafe in case dates exceed loaded chart history
   if(idx1 < 0) idx1 = rates_total - 1;
   if(idx2 < 0) idx2 = 0;
   
   // In MQL5, older prices have larger index numbers. 
   // start_idx gets the older bar (larger index), end_idx gets the newer bar (smaller index).
   int start_idx = MathMin(rates_total - 1, MathMax(idx1, idx2));
   int end_idx   = MathMax(0, MathMin(idx1, idx2));   
   if(start_idx - end_idx < ExtMinBars) return;

   FractalPoint fractals[];
   for(int i = end_idx; i <= start_idx; i++) {
      if(ExtUpperBuffer[i] != EMPTY_VALUE && ExtUpperBuffer[i] > 0) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i; 
         fractals[sz].price = ExtUpperBuffer[i];
         fractals[sz].is_peak = true;
      }
      if(ExtLowerBuffer[i] != EMPTY_VALUE && ExtLowerBuffer[i] > 0) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
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

   // --- OPTIMIZATION BLOCK ---
   
   // 1. Pre-fetch ATR once per cycle
   double current_atr = 0;
   if(InpToleranceType == TOLERANCE_ATR && ExtATRHandle != INVALID_HANDLE) {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0) {
         current_atr = atr_array[0];
      }
   }

   // 2. Pre-calculate max slope tangent (Eliminates MathArctan in loop)
   double max_allowed_slope = 0;
   if(InpMaxLineAngle > 0 && InpMaxLineAngle < 90.0) {
      max_allowed_slope = MathTan(InpMaxLineAngle * M_PI / 180.0); 
   }

   // 3. O(1) Memory Tracking structure
   TrendLine BestLine;
   BestLine.score = -1.0; 

   // --- MAIN LOOP ---

   for(int i = 0; i < f_count - 1; i++) {
      for(int j = i + 1; j < f_count; j++) {
         int dist_bars = fractals[j].bar - fractals[i].bar;
         if(dist_bars < 10) continue; 

         // Calculate slope
         double slope = (fractals[j].price - fractals[i].price) / (double)dist_bars;
         
         // FAST ANGLE FILTER: Compare normalized slope directly
         double price_mid = (fractals[i].price + fractals[j].price) / 2.0;
         double percent_change = ((fractals[j].price - fractals[i].price) / price_mid) * 100.0;
         double normalized_slope = percent_change / dist_bars;
         
         if(max_allowed_slope > 0 && MathAbs(normalized_slope) > max_allowed_slope) {
             continue; // Exit early without heavy trigonometry
         }

         double y_intercept = fractals[i].price - slope * fractals[i].bar;
         
         bool has_peak = fractals[i].is_peak || fractals[j].is_peak;
         bool has_bottom = !fractals[i].is_peak || !fractals[j].is_peak;
         int touches = 2;

         for(int k = 0; k < f_count; k++) {
            if(k == i || k == j) continue;
            
            // Boundary optimization: skip points outside the line segment if needed (optional, omitted for pure extrapolation)
            double expected_price = slope * fractals[k].bar + y_intercept;
            double diff = MathAbs(fractals[k].price - expected_price);
            
            // FAST TOLERANCE: Pass pre-fetched ATR
            if(diff <= CalculateToleranceFast(fractals[k].price, current_atr)) {
               touches++;
               if(fractals[k].is_peak) has_peak = true; else has_bottom = true;
            }
         }

         bool pass_flip_check = InpRequireBothSides ? (has_peak && has_bottom) : true;
         
         if(touches >= InpMinTouches && pass_flip_check) {
            double current_score = (touches * 10000.0) + dist_bars;
            
            // Overwrite the reigning champion line instantly
            if(current_score > BestLine.score) {
               BestLine.slope = slope;
               BestLine.y_intercept = y_intercept;
               BestLine.bar_start = fractals[i].bar;
               BestLine.touches = touches;
               BestLine.score = current_score;
            }
         }
      }
   }

   // 4. Draw the Single Best Line
   if(BestLine.score > 0) {
      for(int i = 0; i <= start_idx; i++) {
         int chrono_bar = rates_total - 1 - i;
         if(chrono_bar >= BestLine.bar_start) {
            ExtBestFL[i] = BestLine.slope * chrono_bar + BestLine.y_intercept;
         }
      }
   }
  }

//+------------------------------------------------------------------+
//| OnCalculate                                                      |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],
                const double &open[], const double &high[], const double &low[], const double &close[],
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

   int limit = rates_total - prev_calculated; if (limit <= 0) limit = 1;
   
   int calc_limit_108 = limit + ExtSideBars;
   if(calc_limit_108 >= rates_total - ExtSideBars) calc_limit_108 = rates_total - ExtSideBars - 1;
   for(int i = calc_limit_108; i >= ExtSideBars && !IsStopped(); i--) {
      ExtUpperBuffer[i] = EMPTY_VALUE; ExtLowerBuffer[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars)) ExtUpperBuffer[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars))  ExtLowerBuffer[i] = low[i];
   }

   if(InpShowSymbol119) {
      int calc_limit_119 = limit + ExtSideBars119;
      if(calc_limit_119 >= rates_total - ExtSideBars119) calc_limit_119 = rates_total - ExtSideBars119 - 1;
      for(int i = calc_limit_119; i >= ExtSideBars119 && !IsStopped(); i--) {
         ExtUpperBuffer119[i] = EMPTY_VALUE; ExtLowerBuffer119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119))  ExtLowerBuffer119[i] = low[i];
      }
   }

   if(prev_calculated == 0 || new_bar) BuildBestFlipLine(rates_total);
   ChartRedraw(0); 
   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Export Single FL Data                                            |
//+------------------------------------------------------------------+
bool ExportSingleFLData()
  {
    string symbol = _Symbol;
    ENUM_TIMEFRAMES timeframe = _Period;
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
    
    string tf_str = EnumToString(timeframe);
    StringReplace(tf_str, "PERIOD_", "");
    string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(file_handle == INVALID_HANDLE) {
        Print("ERROR: Failed to open file for writing."); return false;
    }

    bool write_success = true;
    if(InpIncludeHeader) {
        string header = "timestamp\tsymbol\ttimeframe\tclose\tBest_FL";
        write_success &= FileWrite(file_handle, header) > 0;
    }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    int export_start_idx = iBarShift(symbol, timeframe, InpStartDateTime, false);
    int export_end_idx   = iBarShift(symbol, timeframe, InpEndDateTime, false);
    
    // Find the oldest bar index between the two dates
    int max_idx = MathMax(export_start_idx, export_end_idx);
    if(max_idx < 0) max_idx = iBars(symbol, timeframe) - 1;
    
    int export_limit = MathMin(max_idx, iBars(symbol, timeframe) - 1);

    for(int bar_idx = export_limit; bar_idx >= 0; bar_idx--) {
        string line = IntegerToString((long)(iTime(symbol, timeframe, bar_idx) - gmt_offset)) + "\t";
        line += symbol + "\t" + tf_str + "\t";
        line += DoubleToString(iClose(symbol, timeframe, bar_idx), _Digits) + "\t";
        
        line += (ExtBestFL[bar_idx] == EMPTY_VALUE || ExtBestFL[bar_idx] == 0) ? "" : DoubleToString(ExtBestFL[bar_idx], 5);

        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);
    if(write_success) Print("Single Best FL data exported to: ", filename);
    return write_success;
  }
//+------------------------------------------------------------------+