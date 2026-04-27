//+------------------------------------------------------------------+
//|                                     Fractal-Cluster-Analysis.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.37"
#property description "Fractal Clusters with Centroid Stars & Forward S/R Rays (Conflict-Free)"

#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   4

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
input string            Sep_Base = "===== General Settings =====";
input string            InpObjPrefix = "FCA_Rays_"; // Chart Object Prefix (Prevents conflicts)

input string            Sep0 = "===== Clustering Settings =====";
input int               InpLookbackBars = 1000;
// Rolling Lookback Period
input int               InpClusterCount = 4;
// Number of Clusters (K)
input double            InpOutlierDistanceMultiplier = 1.5;
// Max Distance Multiplier

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

   IndicatorSetString(INDICATOR_SHORTNAME, "FCA Rays (" + InpObjPrefix + ")");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
  {
   // Only delete objects created by THIS instance, using the prefix
   ObjectsDeleteAll(0, InpObjPrefix);
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
//| Standalone Custom K-Means Algorithm                              |
//+------------------------------------------------------------------+
void CustomKMeans(const FractalPoint &data[], int f_count, int K, int &assignments[], double &centers_x[], double &centers_y[]) {
   ArrayResize(assignments, f_count);
   ArrayResize(centers_x, K);
   ArrayResize(centers_y, K);

   // 1. Time-Series Deterministic Initialization
   for(int k=0; k<K; k++) {
      int rand_idx = k * (f_count / K);
      if(rand_idx >= f_count) rand_idx = f_count - 1;
      if(rand_idx < 0) rand_idx = 0;
      centers_x[k] = data[rand_idx].norm_x;
      centers_y[k] = data[rand_idx].norm_y;
   }

   bool changed = true;
   int iterations = 0;
   // 2. Lloyd's Algorithm Iteration
   while(changed && iterations < 100) {
      changed = false;
      iterations++;

      // Assign to nearest centroid
      for(int i=0; i<f_count; i++) {
         double min_dist = 99999999;
         int best_k = 0;
         for(int k=0; k<K; k++) {
            double dist = MathSqrt(MathPow(data[i].norm_x - centers_x[k], 2) + MathPow(data[i].norm_y - centers_y[k], 2));
            if(dist < min_dist) {
               min_dist = dist;
               best_k = k;
            }
         }
         if(assignments[i] != best_k) {
            assignments[i] = best_k;
            changed = true;
         }
      }

      // Update centroids
      int counts[];
      ArrayResize(counts, K); ArrayInitialize(counts, 0);
      double sum_x[]; ArrayResize(sum_x, K); ArrayInitialize(sum_x, 0.0);
      double sum_y[]; ArrayResize(sum_y, K); ArrayInitialize(sum_y, 0.0);
      for(int i=0; i<f_count; i++) {
         int k = assignments[i];
         sum_x[k] += data[i].norm_x;
         sum_y[k] += data[i].norm_y;
         counts[k]++;
      }

      for(int k=0; k<K; k++) {
         if(counts[k] > 0) {
            centers_x[k] = sum_x[k] / counts[k];
            centers_y[k] = sum_y[k] / counts[k];
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Convex Hull Algorithm                                            |
//+------------------------------------------------------------------+
double HullCrossProduct(const FractalPoint &o, const FractalPoint &a, const FractalPoint &b) {
   return (a.norm_x - o.norm_x) * (b.norm_y - o.norm_y) - (a.norm_y - o.norm_y) * (b.norm_x - o.norm_x);
}

void GetConvexHull(const FractalPoint &points[], FractalPoint &hull[]) {
   int n = ArraySize(points);
   if(n < 3) { ArrayCopy(hull, points); return; }
   
   int hull_count = 0;
   int l = 0;
   for(int i = 1; i < n; i++) if(points[i].norm_x < points[l].norm_x) l = i;

   int p = l, q;
   int safety_net = 0;
   do {
      ArrayResize(hull, hull_count + 1);
      hull[hull_count] = points[p];
      hull_count++;
      q = (p + 1) % n;
      for(int i = 0; i < n; i++) {
         if(HullCrossProduct(points[p], points[i], points[q]) > 0) q = i;
      }
      p = q;
      safety_net++;
   } while(p != l && safety_net < n + 5 && !IsStopped());
}

//+------------------------------------------------------------------+
//| Main Clustering Sequence                                         |
//+------------------------------------------------------------------+
void PerformClustering(const int rates_total, const datetime &time[])
  {
   // Clean up only objects that belong to this instance using the prefix
   ObjectsDeleteAll(0, InpObjPrefix); 

   int lookback = MathMin(InpLookbackBars, rates_total - 1);
   if(lookback < MathMax(ExtMinBars, ExtMinBars119)) return;

   // 1. Gather Fractals
   FractalPoint fractals[];
   for(int i = 0; i <= lookback; i++) {
      int bar_idx = rates_total - 1 - i;
      if(ExtUpperBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtUpperBuffer[i];
      }
      if(ExtLowerBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtLowerBuffer[i];
      }
      if(InpShowSymbol119) {
         if(ExtUpperBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals);
            ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtUpperBuffer119[i];
         }
         if(ExtLowerBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals);
            ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].time = time[i]; fractals[sz].price = ExtLowerBuffer119[i];
         }
      }
   }

   int f_count = ArraySize(fractals);
   if(f_count < InpClusterCount * 3) return;

   // 2. Normalize Data
   double min_bar = 99999999, max_bar = -1;
   double min_price = 99999999, max_price = -1;
   
   for(int i = 0; i < f_count; i++) {
      if(fractals[i].bar < min_bar) min_bar = fractals[i].bar;
      if(fractals[i].bar > max_bar) max_bar = fractals[i].bar;
      if(fractals[i].price < min_price) min_price = fractals[i].price;
      if(fractals[i].price > max_price) max_price = fractals[i].price;
   }
   
   for(int i = 0; i < f_count; i++) {
      fractals[i].norm_x = (fractals[i].bar - min_bar) / (max_bar - min_bar);
      fractals[i].norm_y = (fractals[i].price - min_price) / (max_price - min_price);
   }

   // 3. Execute Custom K-Means
   double cluster_centers_x[];
   double cluster_centers_y[];
   int assignments[];
   CustomKMeans(fractals, f_count, InpClusterCount, assignments, cluster_centers_x, cluster_centers_y);

   // 4. Outlier Rejection & Grouping
   for(int k = 0; k < InpClusterCount; k++) {
      FractalPoint cluster_points[];
      double center_x = cluster_centers_x[k];
      double center_y = cluster_centers_y[k];
      
      // Calculate average distance
      double total_dist = 0.0;
      int pt_count = 0;
      for(int i = 0; i < f_count; i++) {
         if(assignments[i] == k) {
            double dist = MathSqrt(MathPow(fractals[i].norm_x - center_x, 2) + MathPow(fractals[i].norm_y - center_y, 2));
            total_dist += dist;
            pt_count++;
         }
      }
      
      if(pt_count == 0) continue;
      double avg_dist = total_dist / pt_count;
      double max_allowed_dist = avg_dist * InpOutlierDistanceMultiplier;

      // Filter Outliers
      for(int i = 0; i < f_count; i++) {
         if(assignments[i] == k) {
            double dist = MathSqrt(MathPow(fractals[i].norm_x - center_x, 2) + MathPow(fractals[i].norm_y - center_y, 2));
            if(dist <= max_allowed_dist) { 
               int sz = ArraySize(cluster_points);
               ArrayResize(cluster_points, sz + 1);
               cluster_points[sz] = fractals[i];
            }
         }
      }
      
      // 5. Draw Bounding Polygon and S/R Rays
      if(ArraySize(cluster_points) >= 3) {
         FractalPoint hull[];
         GetConvexHull(cluster_points, hull);
         
         int h_count = ArraySize(hull);
         color c_color = GetClusterColor(k);
         
         double filtered_sum_x = 0;
         double filtered_sum_y = 0;
         int filtered_count = ArraySize(cluster_points);
         
         for(int i = 0; i < filtered_count; i++) {
            filtered_sum_x += cluster_points[i].norm_x;
            filtered_sum_y += cluster_points[i].norm_y;
         }
         
         double final_center_x = filtered_sum_x / filtered_count;
         double final_center_y = filtered_sum_y / filtered_count;

         // Find Longest and Second Longest Sides
         int longest_idx = -1;
         int second_longest_idx = -1;
         double max_len = -1.0;
         double second_max_len = -1.0;

         for(int h = 0; h < h_count; h++) {
            FractalPoint p1 = hull[h];
            FractalPoint p2 = hull[(h + 1) % h_count]; 
            // Calculate Euclidean distance in normalized space
            double len = MathSqrt(MathPow(p1.norm_x - p2.norm_x, 2) + MathPow(p1.norm_y - p2.norm_y, 2));
            
            if(len > max_len) {
                second_max_len = max_len;
                second_longest_idx = longest_idx;
                max_len = len;
                longest_idx = h;
            } else if(len > second_max_len) {
                second_max_len = len;
                second_longest_idx = h;
            }
         }

         // Draw Polygon Segments
         for(int h = 0; h < h_count; h++) {
            FractalPoint p1 = hull[h];
            FractalPoint p2 = hull[(h + 1) % h_count]; 

            // Using Dynamic Prefix
            string line_name = InpObjPrefix + "Hull_" + IntegerToString(k) + "_" + IntegerToString(h);
            ObjectCreate(0, line_name, OBJ_TREND, 0, p1.time, p1.price, p2.time, p2.price);
            ObjectSetInteger(0, line_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, line_name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, line_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, false); // Keep borders bounded
            ObjectSetInteger(0, line_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
         }
         
         // Draw Rays for Longest Sides (Ensuring Left-to-Right drawing order)
         if(longest_idx != -1) {
            FractalPoint p1 = hull[longest_idx];
            FractalPoint p2 = hull[(longest_idx + 1) % h_count];
            
            datetime t1 = p1.time; double pr1 = p1.price;
            datetime t2 = p2.time; double pr2 = p2.price;
            
            if(t1 > t2) {
               t1 = p2.time; pr1 = p2.price;
               t2 = p1.time; pr2 = p1.price;
            }

            // Using Dynamic Prefix
            string ray_name1 = InpObjPrefix + "Ray_" + IntegerToString(k) + "_1";
            ObjectCreate(0, ray_name1, OBJ_TREND, 0, t1, pr1, t2, pr2);
            ObjectSetInteger(0, ray_name1, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, ray_name1, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, ray_name1, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, ray_name1, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, ray_name1, OBJPROP_BACK, true);
            ObjectSetInteger(0, ray_name1, OBJPROP_SELECTABLE, false);
         }

         if(second_longest_idx != -1) {
            FractalPoint p1 = hull[second_longest_idx];
            FractalPoint p2 = hull[(second_longest_idx + 1) % h_count];
            
            datetime t1 = p1.time; double pr1 = p1.price;
            datetime t2 = p2.time; double pr2 = p2.price;
            
            if(t1 > t2) {
               t1 = p2.time; pr1 = p2.price;
               t2 = p1.time; pr2 = p1.price;
            }

            // Using Dynamic Prefix
            string ray_name2 = InpObjPrefix + "Ray_" + IntegerToString(k) + "_2";
            ObjectCreate(0, ray_name2, OBJ_TREND, 0, t1, pr1, t2, pr2);
            ObjectSetInteger(0, ray_name2, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, ray_name2, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, ray_name2, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, ray_name2, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, ray_name2, OBJPROP_BACK, true);
            ObjectSetInteger(0, ray_name2, OBJPROP_SELECTABLE, false);
         }
         
         // 6. De-normalize UPDATED Centroid & Draw Equilibrium Star
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);
         
         int time_index = rates_total - 1 - real_centroid_bar;
         if(time_index < 0) time_index = 0;
         if(time_index >= rates_total) time_index = rates_total - 1;
         
         datetime centroid_time = time[time_index];

         // Centroid Star Using Dynamic Prefix
         string star_name = InpObjPrefix + "Star_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings");
         ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(171));
         
         ObjectSetInteger(0, star_name, OBJPROP_FONTSIZE, 14);
         ObjectSetInteger(0, star_name, OBJPROP_ANCHOR, ANCHOR_CENTER);
         ObjectSetInteger(0, star_name, OBJPROP_COLOR, c_color);
         ObjectSetInteger(0, star_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, star_name, OBJPROP_SELECTABLE, false);
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

   bool fractals_changed = false;

   int calc_limit_108 = limit + ExtSideBars;
   if(calc_limit_108 >= rates_total - ExtSideBars) calc_limit_108 = rates_total - ExtSideBars - 1;

   for(int i = calc_limit_108; i >= ExtSideBars && !IsStopped(); i--) {
      double old_upper = ExtUpperBuffer[i];
      double old_lower = ExtLowerBuffer[i];
      
      ExtUpperBuffer[i] = EMPTY_VALUE;
      ExtLowerBuffer[i] = EMPTY_VALUE;
      
      if(IsUpperFractal(high, i, ExtSideBars)) ExtUpperBuffer[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars))  ExtLowerBuffer[i] = low[i];
      
      if(old_upper != ExtUpperBuffer[i] || old_lower != ExtLowerBuffer[i]) {
         fractals_changed = true;
      }
   }

   if(InpShowSymbol119) {
      int calc_limit_119 = limit + ExtSideBars119;
      if(calc_limit_119 >= rates_total - ExtSideBars119) calc_limit_119 = rates_total - ExtSideBars119 - 1;

      for(int i = calc_limit_119; i >= ExtSideBars119 && !IsStopped(); i--) {
         double old_upper = ExtUpperBuffer119[i];
         double old_lower = ExtLowerBuffer119[i];
         
         ExtUpperBuffer119[i] = EMPTY_VALUE;
         ExtLowerBuffer119[i] = EMPTY_VALUE;
         
         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119))  ExtLowerBuffer119[i] = low[i];
         
         if(old_upper != ExtUpperBuffer119[i] || old_lower != ExtLowerBuffer119[i]) {
             fractals_changed = true;
         }
      }
   }

   if(prev_calculated == 0 || new_bar || fractals_changed) {
      PerformClustering(rates_total, time);
      ChartRedraw(0);
   }

   return(rates_total);
  }
//+------------------------------------------------------------------+