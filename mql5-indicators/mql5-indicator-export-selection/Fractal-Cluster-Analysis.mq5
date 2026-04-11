//+------------------------------------------------------------------+
//|                                     Fractal-Cluster-Analysis.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.00"
#property description "Fractal Cluster Analysis using ALGLIB K-Means & Convex Hull"

#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   4

#include <Math\Alglib\dataanalysis.mqh>

//--- Enums
enum ENUM_FRACTAL_BARS {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
};
enum ENUM_FRACTAL_BARS_119 {
   BARS_5 = 5, BARS_7 = 7, BARS_9 = 9, BARS_11 = 11,
   BARS_13 = 13, BARS_15_119 = 15, BARS_17_119 = 17, BARS_19_119 = 19
};
enum ENUM_SYMBOL_SIZE { SIZE_SMALL = 1, SIZE_NORMAL = 3, SIZE_LARGE = 5 };

//--- Input parameters
input string            Sep0 = "===== Clustering Settings =====";
input int               InpLookbackBars = 1000;    // Rolling Lookback Period
input int               InpClusterCount = 4;       // Number of Clusters (K)
input int               InpKMeansRestarts = 5;     // Math Restarts (higher = better fit)

input string            Sep1 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;

input string            Sep2 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS_119 InpFractalBars119 = BARS_13;
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;

input string            Sep3 = "===== Cluster Colors =====";
input color             InpClusterColor0 = clrDodgerBlue;
input color             InpClusterColor1 = clrLimeGreen;
input color             InpClusterColor2 = clrRed;
input color             InpClusterColor3 = clrGold;
input color             InpClusterColor4 = clrMagenta;
input color             InpClusterColor5 = clrAqua;

//--- Indicator buffers
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtSideBars119;
int    ExtMinBars119;
datetime ExtLastBarTime = 0;

//--- Structures
struct FractalPoint {
   int      bar;
   datetime time;
   double   price;
   double   norm_x;
   double   norm_y;
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
   
   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   
   ArraySetAsSeries(ExtUpperBuffer, true); ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true); ArraySetAsSeries(ExtLowerBuffer119, true);
   
   // Fractal Plots
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(0, PLOT_ARROW, 108);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrRed);
   PlotIndexSetInteger(0, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(1, PLOT_ARROW, 108);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE);
   PlotIndexSetInteger(2, PLOT_ARROW, 119);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrRed);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE);
   PlotIndexSetInteger(3, PLOT_ARROW, 119);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   IndicatorSetString(INDICATOR_SHORTNAME, "Fractal Cluster Analysis");
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, "ClusterHull_");
  }

//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
bool IsUpperFractal(const double &high[], int index, int side_bars) {
   double center_high = high[index];
   for(int i = 1; i <= side_bars; i++) if(center_high <= high[index - i]) return false;
   for(int i = 1; i <= side_bars; i++) if(center_high < high[index + i]) return false;
   return true;
}

bool IsLowerFractal(const double &low[], int index, int side_bars) {
   double center_low = low[index];
   for(int i = 1; i <= side_bars; i++) if(center_low >= low[index - i]) return false;
   for(int i = 1; i <= side_bars; i++) if(center_low > low[index + i]) return false;
   return true;
}

color GetClusterColor(int id) {
   switch(id % 6) {
      case 0: return InpClusterColor0;
      case 1: return InpClusterColor1;
      case 2: return InpClusterColor2;
      case 3: return InpClusterColor3;
      case 4: return InpClusterColor4;
      case 5: return InpClusterColor5;
   }
   return clrGray;
}

//+------------------------------------------------------------------+
//| Convex Hull Algorithm (Jarvis March / Gift Wrapping)             |
//+------------------------------------------------------------------+
// Cross product to find geometric orientation
double CrossProduct(FractalPoint &o, FractalPoint &a, FractalPoint &b) {
   return (a.norm_x - o.norm_x) * (b.norm_y - o.norm_y) - (a.norm_y - o.norm_y) * (b.norm_x - o.norm_x);
}

void GetConvexHull(FractalPoint &points[], FractalPoint &hull[]) {
   int n = ArraySize(points);
   if(n < 3) {
      ArrayCopy(hull, points);
      return;
   }
   
   int hull_count = 0;
   int l = 0; // Find the leftmost point
   for(int i = 1; i < n; i++) {
      if(points[i].norm_x < points[l].norm_x) l = i;
   }

   int p = l, q;
   do {
      ArrayResize(hull, hull_count + 1);
      hull[hull_count] = points[p];
      hull_count++;
      
      q = (p + 1) % n;
      for(int i = 0; i < n; i++) {
         if(CrossProduct(points[p], points[i], points[q]) > 0)
            q = i;
      }
      p = q;
   } while(p != l && !IsStopped());
}

//+------------------------------------------------------------------+
//| Main Clustering Algorithm                                        |
//+------------------------------------------------------------------+
void PerformClustering(const int rates_total, const datetime &time[])
  {
   ObjectsDeleteAll(0, "ClusterHull_"); // Clear old polygons
   
   int lookback = MathMin(InpLookbackBars, rates_total - 1);
   if(lookback < MathMax(ExtMinBars, ExtMinBars119)) return;

   // 1. Gather all 108 & 119 fractals in the window
   FractalPoint fractals[];
   for(int i = 0; i <= lookback; i++) {
      int bar_idx = rates_total - 1 - i;
      if(ExtUpperBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtUpperBuffer[i];
      }
      if(ExtLowerBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtLowerBuffer[i];
      }
      if(InpShowSymbol119) {
         if(ExtUpperBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtUpperBuffer119[i];
         }
         if(ExtLowerBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtLowerBuffer119[i];
         }
      }
   }

   int f_count = ArraySize(fractals);
   if(f_count < InpClusterCount * 3) return; // Need enough points

   // 2. Normalize Data (Crucial for K-Means)
   double min_bar = 99999999, max_bar = -1;
   double min_price = 99999999, max_price = -1;
   
   for(int i = 0; i < f_count; i++) {
      if(fractals[i].bar < min_bar) min_bar = fractals[i].bar;
      if(fractals[i].bar > max_bar) max_bar = fractals[i].bar;
      if(fractals[i].price < min_price) min_price = fractals[i].price;
      if(fractals[i].price > max_price) max_price = fractals[i].price;
   }
   
   CMatrixDouble fractal_mat;
   fractal_mat.Resize(f_count, 2);
   
   for(int i = 0; i < f_count; i++) {
      fractals[i].norm_x = (fractals[i].bar - min_bar) / (max_bar - min_bar);
      fractals[i].norm_y = (fractals[i].price - min_price) / (max_price - min_price);
      fractal_mat.Set(i, 0, fractals[i].norm_x);
      fractal_mat.Set(i, 1, fractals[i].norm_y);
   }

   // 3. Execute ALGLIB K-Means
   int info;
   CMatrixDouble cluster_centers;
   int assignments[];
   CKMeans kmeans;
   
   kmeans.KMeansGenerate(fractal_mat, f_count, 2, InpClusterCount, InpKMeansRestarts, info, cluster_centers, assignments);
   
   if(info != 1) { Print("K-Means Error!"); return; }

   // 4. Group Fractals by Assigned Cluster
   for(int k = 0; k < InpClusterCount; k++) {
      FractalPoint cluster_points[];
      
      for(int i = 0; i < f_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points);
            ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = fractals[i];
         }
      }
      
      // 5. Calculate Convex Hull & Draw Bounding Polygon
      if(ArraySize(cluster_points) >= 3) {
         FractalPoint hull[];
         GetConvexHull(cluster_points, hull);
         
         int h_count = ArraySize(hull);
         color c_color = GetClusterColor(k);
         
         for(int h = 0; h < h_count; h++) {
            FractalPoint p1 = hull[h];
            FractalPoint p2 = hull[(h + 1) % h_count]; // Wrap around to first point
            
            string line_name = "ClusterHull_" + IntegerToString(k) + "_" + IntegerToString(h);
            ObjectCreate(0, line_name, OBJ_TREND, 0, p1.time, p1.price, p2.time, p2.price);
            ObjectSetInteger(0, line_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, line_name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, line_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, false);
            ObjectSetInteger(0, line_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
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
   ArraySetAsSeries(time, true); 

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

   // Calculate 108 Fractals
   int calc_limit_108 = limit + ExtSideBars;
   if(calc_limit_108 >= rates_total - ExtSideBars) calc_limit_108 = rates_total - ExtSideBars - 1;
   for(int i = calc_limit_108; i >= ExtSideBars && !IsStopped(); i--) {
      ExtUpperBuffer[i] = EMPTY_VALUE; ExtLowerBuffer[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars)) ExtUpperBuffer[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars))  ExtLowerBuffer[i] = low[i];
   }

   // Calculate 119 Fractals
   if(InpShowSymbol119) {
      int calc_limit_119 = limit + ExtSideBars119;
      if(calc_limit_119 >= rates_total - ExtSideBars119) calc_limit_119 = rates_total - ExtSideBars119 - 1;
      for(int i = calc_limit_119; i >= ExtSideBars119 && !IsStopped(); i--) {
         ExtUpperBuffer119[i] = EMPTY_VALUE; ExtLowerBuffer119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119))  ExtLowerBuffer119[i] = low[i];
      }
   }

   // Run Heavy Math ONLY on new bar formation to save CPU
   if(prev_calculated == 0 || new_bar) {
      PerformClustering(rates_total, time);
      ChartRedraw(0); 
   }

   return(rates_total);
  }
//+------------------------------------------------------------------+