//+------------------------------------------------------------------+
//|                             Optimised-Single-Best-SR-FL-PEAKS.mq5|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.20"
#property description "Optimized Peak-to-Peak Resistance Line (Short Term)"

#property indicator_chart_window
#property indicator_buffers 3
#property indicator_plots   3

//--- Enums
#define EXPORT_BUTTON_NAME "Resist"

enum ENUM_FRACTAL_BARS {
   BARS_5 = 5,   BARS_7 = 7,   BARS_9 = 9,   BARS_11 = 11, BARS_13 = 13,
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21, BARS_35 = 35, 
   BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
};
enum ENUM_SYMBOL_SIZE { SIZE_SMALL = 1, SIZE_NORMAL = 3, SIZE_LARGE = 5 };
enum ENUM_TOLERANCE_TYPE { TOLERANCE_ATR, TOLERANCE_PERCENT };

//--- Input parameters
input string            Sep0 = "===== Window Period =====";
input datetime          InpStartDateTime = D'2026.06.05 19:15';
input datetime          InpEndDateTime   = D'2026.06.08 05:00';

input string            SepExt = "===== Line Extension =====";
input bool              InpExtendToCurrent = true;       // Extend line to current bar
input ENUM_LINE_STYLE   InpExtensionStyle  = STYLE_DASH; // Style for the extended portion

input string            Sep1 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_13; // Tightened for short-term 
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;

input string            Sep2 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS InpFractalBars119 = BARS_7; // Tightened for micro-structure
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;

input string            Sep3 = "===== Resistance Line Rules =====";
input int               InpMinTouches = 2; // Dropped to 2 for wedges
input double            InpMaxLineAngle = 3.0;
input color             InpBestFLColor = clrDarkRed;

input string            Sep4 = "===== Tolerance Settings =====";
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 0.50;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;

input string            Sep5 = "===== Export Settings =====";
input string            InpExportFileName = "Resistance_Line";
input bool              InpIncludeHeader = true;

//--- Indicator buffers 
double ExtUpperBuffer[];
double ExtUpperBuffer119[];
double ExtBestFL[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtSideBars119;
int    ExtMinBars119;
int    ExtATRHandle = INVALID_HANDLE;
datetime ExtLastBarTime = 0;

//--- Simplified Structures
struct FractalPoint {
   int    bar;
   double price;
};

struct TrendLine {
   int    bar_start;
   double slope;
   double y_intercept;
   int    touches;
   double score;
};

//+------------------------------------------------------------------+
int OnInit()
  {
   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;
   ExtSideBars119 = (InpFractalBars119 - 1) / 2;
   ExtMinBars119 = InpFractalBars119;
   
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(2, ExtBestFL, INDICATOR_DATA);

   ArraySetAsSeries(ExtUpperBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true); 
   ArraySetAsSeries(ExtBestFL, true);
   
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(0, PLOT_ARROW, 108);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(0, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(1, PLOT_ARROW, 119);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(1, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   // Changed to DRAW_NONE so the buffer doesn't auto-scale the chart
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_NONE);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   IndicatorSetString(INDICATOR_SHORTNAME, "Opt Peak-to-Peak FL");
   CreateExportButton();
   
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectDelete(0, "ShortTerm_Resist_Line");
   ObjectDelete(0, "ShortTerm_Resist_Line_Ext"); // Clean up extension trendline
  }

void CreateExportButton()
  {
    if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0)) return;
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 270);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Fractal_Peak");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkRed);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
    if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL") {
        ExportSingleFLData();
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

double CalculateToleranceFast(double reference_price, double prefetched_atr)
  {
   if(InpToleranceType == TOLERANCE_ATR && prefetched_atr > 0) return prefetched_atr * InpToleranceATRMultiplier;
   return reference_price * (InpTolerancePercent / 100.0);
  }

void BuildBestFlipLine(const int rates_total)
  {
   ArrayInitialize(ExtBestFL, EMPTY_VALUE);
   int idx1 = iBarShift(_Symbol, _Period, InpStartDateTime, false);
   int idx2 = iBarShift(_Symbol, _Period, InpEndDateTime, false);
   if(idx1 < 0) idx1 = rates_total - 1;
   if(idx2 < 0) idx2 = 0;
   int start_idx = MathMin(rates_total - 1, MathMax(idx1, idx2));
   int end_idx   = MathMax(0, MathMin(idx1, idx2));
   if(start_idx - end_idx < ExtMinBars) return;

   FractalPoint fractals[];
   for(int i = end_idx; i <= start_idx; i++) {
      if(ExtUpperBuffer[i] != EMPTY_VALUE && ExtUpperBuffer[i] > 0) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = rates_total - 1 - i; 
         fractals[sz].price = ExtUpperBuffer[i];
      }
   }

   int f_count = ArraySize(fractals);
   if(f_count < InpMinTouches) return;
   for(int i = 0; i < f_count - 1; i++) {
      for(int j = i + 1; j < f_count; j++) {
         if(fractals[j].bar < fractals[i].bar) {
            FractalPoint tmp = fractals[i];
            fractals[i] = fractals[j];
            fractals[j] = tmp;
         }
      }
   }

   double current_atr = 0;
   if(InpToleranceType == TOLERANCE_ATR && ExtATRHandle != INVALID_HANDLE) {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0) current_atr = atr_array[0];
   }

   double max_allowed_slope = 0;
   if(InpMaxLineAngle > 0 && InpMaxLineAngle < 90.0) {
      max_allowed_slope = MathTan(InpMaxLineAngle * M_PI / 180.0);
   }

   TrendLine BestLine;
   BestLine.score = -1.0;

   for(int i = 0; i < f_count - 1; i++) {
      for(int j = i + 1; j < f_count; j++) {
         int dist_bars = fractals[j].bar - fractals[i].bar;
         if(dist_bars < 10) continue; 

         double slope = (fractals[j].price - fractals[i].price) / (double)dist_bars;
         double price_mid = (fractals[i].price + fractals[j].price) / 2.0;
         double percent_change = ((fractals[j].price - fractals[i].price) / price_mid) * 100.0;
         double normalized_slope = percent_change / dist_bars;
         if(max_allowed_slope > 0 && MathAbs(normalized_slope) > max_allowed_slope) continue;

         double y_intercept = fractals[i].price - slope * fractals[i].bar;
         int touches = 2;
         for(int k = 0; k < f_count; k++) {
            if(k == i || k == j) continue;
            double expected_price = slope * fractals[k].bar + y_intercept;
            double diff = MathAbs(fractals[k].price - expected_price);
            
            if(diff <= CalculateToleranceFast(fractals[k].price, current_atr)) touches++;
         }

         if(touches >= InpMinTouches) {
            double current_score = (touches * 10000.0) + dist_bars;
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

   if(BestLine.score > 0) {
      int draw_end_idx = InpExtendToCurrent ? 0 : end_idx;

      // 1. Populate the buffer dynamically to include the extension for accurate exports
      for(int i = draw_end_idx; i <= start_idx; i++) {
         int chrono_bar = rates_total - 1 - i;
         if(chrono_bar >= BestLine.bar_start) {
             ExtBestFL[i] = BestLine.slope * chrono_bar + BestLine.y_intercept;
         }
      }
      
      // 2. Render main Graphical Object
      datetime time_start = iTime(_Symbol, _Period, start_idx);
      double   price_start = BestLine.slope * (rates_total - 1 - start_idx) + BestLine.y_intercept;
      
      datetime time_end = iTime(_Symbol, _Period, end_idx);
      double   price_end = BestLine.slope * (rates_total - 1 - end_idx) + BestLine.y_intercept;

      string obj_name = "ShortTerm_Resist_Line";
      ObjectDelete(0, obj_name);
      ObjectCreate(0, obj_name, OBJ_TREND, 0, time_start, price_start, time_end, price_end);
      ObjectSetInteger(0, obj_name, OBJPROP_COLOR, InpBestFLColor);
      ObjectSetInteger(0, obj_name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, obj_name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, obj_name, OBJPROP_RAY_RIGHT, false);

      // 3. Render extension Graphical Object
      string obj_ext_name = "ShortTerm_Resist_Line_Ext";
      ObjectDelete(0, obj_ext_name);
      if(InpExtendToCurrent && end_idx > 0) {
         datetime time_ext = iTime(_Symbol, _Period, 0);
         double   price_ext = BestLine.slope * (rates_total - 1 - 0) + BestLine.y_intercept;
         ObjectCreate(0, obj_ext_name, OBJ_TREND, 0, time_end, price_end, time_ext, price_ext);
         ObjectSetInteger(0, obj_ext_name, OBJPROP_COLOR, InpBestFLColor);
         ObjectSetInteger(0, obj_ext_name, OBJPROP_WIDTH, 2);
         ObjectSetInteger(0, obj_ext_name, OBJPROP_STYLE, InpExtensionStyle);
         ObjectSetInteger(0, obj_ext_name, OBJPROP_RAY_RIGHT, false);
      }
   }
  }

int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[],
                const double &open[], const double &high[], const double &low[], const double &close[],
                const long &tick_volume[], const long &volume[], const int &spread[])
  {
   int global_min_bars = MathMax(ExtMinBars, ExtMinBars119);
   if(rates_total < global_min_bars) return(0);

   ArraySetAsSeries(high, true); ArraySetAsSeries(time, true); ArraySetAsSeries(close, true);

   bool new_bar = false;
   if(prev_calculated == 0) {
      ArrayInitialize(ExtUpperBuffer, EMPTY_VALUE); ArrayInitialize(ExtUpperBuffer119, EMPTY_VALUE);
      ExtLastBarTime = time[0];
   }
   else if(time[0] != ExtLastBarTime) { new_bar = true; ExtLastBarTime = time[0];
   }

   int limit = rates_total - prev_calculated; if (limit <= 0) limit = 1;
   int calc_limit_108 = limit + ExtSideBars;
   
   if(calc_limit_108 >= rates_total - ExtSideBars) calc_limit_108 = rates_total - ExtSideBars - 1;
   for(int i = calc_limit_108; i >= ExtSideBars && !IsStopped(); i--) {
      ExtUpperBuffer[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars)) ExtUpperBuffer[i] = high[i];
   }

   if(InpShowSymbol119) {
      int calc_limit_119 = limit + ExtSideBars119;
      if(calc_limit_119 >= rates_total - ExtSideBars119) calc_limit_119 = rates_total - ExtSideBars119 - 1;
      for(int i = calc_limit_119; i >= ExtSideBars119 && !IsStopped(); i--) {
         ExtUpperBuffer119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
      }
   }

   if(prev_calculated == 0 || new_bar) BuildBestFlipLine(rates_total);
   ChartRedraw(0); 
   return(rates_total);
  }

bool ExportSingleFLData()
  {
    string symbol = _Symbol;
    ENUM_TIMEFRAMES timeframe = _Period;
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
    
    string tf_str = EnumToString(timeframe); StringReplace(tf_str, "PERIOD_", "");
    string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(file_handle == INVALID_HANDLE) { Print("ERROR: Failed to open file for writing."); return false;
    }

    bool write_success = true;
    if(InpIncludeHeader) {
        string header = "Resistance_timestamp\tResistance_symbol\tResistance_timeframe\tResistance_close\tBest_Resistance";
        write_success &= FileWrite(file_handle, header) > 0;
    }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    int export_start_idx = iBarShift(symbol, timeframe, InpStartDateTime, false);
    int export_end_idx   = iBarShift(symbol, timeframe, InpEndDateTime, false);
    int max_idx = MathMax(export_start_idx, export_end_idx);
    if(max_idx < 0) max_idx = iBars(symbol, timeframe) - 1;
    
    int export_limit = MathMin(max_idx, iBars(symbol, timeframe) - 1);
    for(int bar_idx = export_limit; bar_idx >= 0; bar_idx--) {
        string line = IntegerToString((long)(iTime(symbol, timeframe, bar_idx) - gmt_offset)) + "\t";
        line += symbol + "\t" + tf_str + "\t" + DoubleToString(iClose(symbol, timeframe, bar_idx), _Digits) + "\t";
        line += (ExtBestFL[bar_idx] == EMPTY_VALUE || ExtBestFL[bar_idx] == 0) ? "" : DoubleToString(ExtBestFL[bar_idx], 5);
        write_success &= FileWrite(file_handle, line) > 0;
    }

    FileClose(file_handle);
    if(write_success) Print("Peaks data exported to: ", filename);
    return write_success;
  }
//+------------------------------------------------------------------+