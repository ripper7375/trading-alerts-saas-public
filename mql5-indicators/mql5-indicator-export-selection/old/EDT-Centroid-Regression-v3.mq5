//+------------------------------------------------------------------+
//|                                        SSA_Centroid_Regression_EDT.mq5 |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "3.20"
#property description "Combines SSA Clustering Centroids with Linear Regression and Symmetrical EDT Snapping"
#property indicator_chart_window

// Total Buffers: 17 for Plots + 1 Hidden for Cluster Tracking = 18
#property indicator_buffers 18
#property indicator_plots   17

#include <Math/Alglib/alglib.mqh>

//--- Enums
enum ENUM_CLUSTERING_ALGO {
   ALGO_KMEANS = 0, // Modified K-Means
   ALGO_DBSCAN = 1  // DBSCAN
};

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

//--- INPUT PARAMETERS ---
input string               Sep0 = "===== SSA Settings =====";
input int                  SSAWindow         = 30;
input int                  SSARank           = 6;
input int                  SSASignalPeriod   = 3;
input int                  LookbackBars      = 3000;

input string               Sep1 = "===== Clustering Settings =====";
input ENUM_CLUSTERING_ALGO InpAlgo             = ALGO_DBSCAN;
input int                  InpMinPts           = 5;
input string               SepKM = "--- K-Means Only ---";
input int                  InpPointsPerCluster = 5;
input double               InpMaxAvgDistance   = 0.015;
input string               SepDB = "--- DBSCAN Only ---";
input double               InpEpsilon          = 0.015;

input string               SepColors           = "--- Polygon Colors ---";
input color  InpClusterColor0  = clrDodgerBlue;
input color  InpClusterColor1  = clrLimeGreen;
input color  InpClusterColor2  = clrRed;
input color  InpClusterColor3  = clrGold;
input color  InpClusterColor4  = clrMagenta;
input color  InpClusterColor5  = clrAqua;

input string            Sep3 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;
input int               InpSymbolOffset = 0;

input string            Sep4 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS_119 InpFractalBars119 = BARS_13;
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;
input int               InpSymbolOffset119 = 0;

input string            Sep5 = "===== EDT Rules & Tolerance =====";
input int               InpEDTLookbackBars = 500;
input int               InpMaxEDTLines = 4;
input int               InpMinTouches = 3;
input bool              InpRequireBothSides = true;
input double            InpMinLineSeparationPercent = 0.50;
input color             InpBaseLineColor = clrDarkOrange;
input color             InpEDTColor = clrDarkViolet;
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.00;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;

//--- INDICATOR BUFFERS ---
double ExtSSATrend[];      // 0
double ExtSSASignal[];     // 1
double ExtSSACross[];      // 2

double ExtUpper108[];      // 3
double ExtLower108[];      // 4
double ExtUpper119[];      // 5
double ExtLower119[];      // 6

double ExtBaseLine[];      // 7
double ExtEDT1[], ExtEDT2[], ExtEDT3[], ExtEDT4[], ExtEDT5[]; // 8-12
double ExtEDT6[], ExtEDT7[], ExtEDT8[], ExtEDT9[];            // 13-16

double ExtCrossInCluster[]; // 17 (Hidden)

//--- GLOBAL VARIABLES ---
datetime g_time[];
double   g_close[];
double   g_high[];
double   g_low[];
int      g_rates_total = 0;
datetime ExtLastBarTime = 0;

int      ExtSideBars;
int      ExtSideBars119;
int      ExtATRHandle = INVALID_HANDLE;

//--- STRUCTURES ---
struct ClusterPoint {
   int      bar;
   datetime time;
   double   price;
   double   norm_x;
   double   norm_y;
};

struct ClusterCentroidInfo {
   double   price;
   int      bar_index;
   datetime time;
   int      cluster_id;
};

struct FractalPoint {
   int      bar;
   double   price;
   bool     is_peak;
};

struct TrendLine {
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
   ExtSideBars = ((int)InpFractalBars - 1) / 2;
   ExtSideBars119 = ((int)InpFractalBars119 - 1) / 2;
   
   if(InpMaxEDTLines > 9) Print("ERROR: InpMaxEDTLines clamped to 9.");
   
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   // Buffer Mapping
   SetIndexBuffer(0, ExtSSATrend, INDICATOR_DATA);
   SetIndexBuffer(1, ExtSSASignal, INDICATOR_DATA);
   SetIndexBuffer(2, ExtSSACross, INDICATOR_DATA);
   
   SetIndexBuffer(3, ExtUpper108, INDICATOR_DATA);
   SetIndexBuffer(4, ExtLower108, INDICATOR_DATA);
   SetIndexBuffer(5, ExtUpper119, INDICATOR_DATA);
   SetIndexBuffer(6, ExtLower119, INDICATOR_DATA);
   
   SetIndexBuffer(7, ExtBaseLine, INDICATOR_DATA);
   SetIndexBuffer(8, ExtEDT1, INDICATOR_DATA); SetIndexBuffer(9, ExtEDT2, INDICATOR_DATA);
   SetIndexBuffer(10, ExtEDT3, INDICATOR_DATA); SetIndexBuffer(11, ExtEDT4, INDICATOR_DATA);
   SetIndexBuffer(12, ExtEDT5, INDICATOR_DATA); SetIndexBuffer(13, ExtEDT6, INDICATOR_DATA);
   SetIndexBuffer(14, ExtEDT7, INDICATOR_DATA); SetIndexBuffer(15, ExtEDT8, INDICATOR_DATA);
   SetIndexBuffer(16, ExtEDT9, INDICATOR_DATA);
   
   SetIndexBuffer(17, ExtCrossInCluster, INDICATOR_CALCULATIONS);

   // Plot Definitions: SSA
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrMagenta); PlotIndexSetInteger(0, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrBlue); PlotIndexSetInteger(1, PLOT_LINE_STYLE, STYLE_DASH); PlotIndexSetInteger(1, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(2, PLOT_ARROW, 171); PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrBlack); PlotIndexSetInteger(2, PLOT_LINE_WIDTH, 2);

   // Plot Definitions: Fractals
   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(3, PLOT_ARROW, 108); PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize); PlotIndexSetInteger(3, PLOT_ARROW_SHIFT, -InpSymbolOffset);
   PlotIndexSetInteger(4, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(4, PLOT_ARROW, 108); PlotIndexSetInteger(4, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(4, PLOT_LINE_WIDTH, (int)InpSymbolSize); PlotIndexSetInteger(4, PLOT_ARROW_SHIFT, InpSymbolOffset);
   PlotIndexSetInteger(5, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(5, PLOT_ARROW, 119); PlotIndexSetInteger(5, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(5, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(5, PLOT_ARROW_SHIFT, -InpSymbolOffset119);
   PlotIndexSetInteger(6, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(6, PLOT_ARROW, 119); PlotIndexSetInteger(6, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(6, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(6, PLOT_ARROW_SHIFT, InpSymbolOffset119);

   // Plot Definitions: Regression Base Line & EDT
   PlotIndexSetInteger(7, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(7, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(7, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpBaseLineColor); PlotIndexSetString(7, PLOT_LABEL, "Regression Base Line");
   
   for(int i = 8; i <= 16; i++) {
      PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(i, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(i, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(i, PLOT_LINE_COLOR, InpEDTColor);
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE); PlotIndexSetString(i, PLOT_LABEL, "EDT #" + IntegerToString(i-7));
   }

   for(int i=0; i<17; i++) PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   
   IndicatorSetString(INDICATOR_SHORTNAME, "SSA Regression EDT (Symmetrical)");
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   ObjectsDeleteAll(0, "ClusterHull_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   ChartRedraw(0);
}


//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
bool IsUpperFractal(const double &h[], int index, int side_bars, int rates_total) {
   if(index < side_bars || index >= rates_total - side_bars) return false;
   double center = h[index];
   for(int i = 1; i <= side_bars; i++) {
      if(center <= h[index - i]) return false;
      if(center < h[index + i]) return false;
   }
   return true;
}

bool IsLowerFractal(const double &l[], int index, int side_bars, int rates_total) {
   if(index < side_bars || index >= rates_total - side_bars) return false;
   double center = l[index];
   for(int i = 1; i <= side_bars; i++) {
      if(center >= l[index - i]) return false;
      if(center > l[index + i]) return false;
   }
   return true;
}

double CalculateToleranceFast(double reference_price, double current_atr) {
   if(InpToleranceType == TOLERANCE_ATR && current_atr > 0) {
       return current_atr * InpToleranceATRMultiplier;
   }
   return reference_price * (InpTolerancePercent / 100.0);
}

color GetClusterColor(int id) {
   switch(id % 6) {
      case 0: return InpClusterColor0; case 1: return InpClusterColor1;
      case 2: return InpClusterColor2; case 3: return InpClusterColor3;
      case 4: return InpClusterColor4; case 5: return InpClusterColor5;
   }
   return clrGray;
}


//+------------------------------------------------------------------+
//| Math: Convex Hull & Clustering Algorithms                        |
//+------------------------------------------------------------------+
double HullCrossProduct(const ClusterPoint &o, const ClusterPoint &a, const ClusterPoint &b) {
   return (a.norm_x - o.norm_x) * (b.norm_y - o.norm_y) - (a.norm_y - o.norm_y) * (b.norm_x - o.norm_x);
}

void GetConvexHull(const ClusterPoint &points[], ClusterPoint &hull[]) {
   int n = ArraySize(points);
   if(n < 3) { ArrayCopy(hull, points); return; }
   
   int hull_count = 0; int l = 0;
   for(int i = 1; i < n; i++) if(points[i].norm_x < points[l].norm_x) l = i;

   int p = l, q; int safety_net = 0;
   do {
      ArrayResize(hull, hull_count + 1); hull[hull_count] = points[p]; hull_count++;
      q = (p + 1) % n;
      for(int i = 0; i < n; i++) {
         if(HullCrossProduct(points[p], points[i], points[q]) > 0) q = i;
      }
      p = q; safety_net++;
   } while(p != l && safety_net < n + 5 && !IsStopped());
}

void CustomKMeans(const ClusterPoint &data[], int f_count, int K, int &assignments[]) {
   ArrayResize(assignments, f_count);
   double centers_x[]; ArrayResize(centers_x, K); double centers_y[]; ArrayResize(centers_y, K);

   for(int k=0; k<K; k++) {
      int rand_idx = k * (f_count / K);
      if(rand_idx >= f_count) rand_idx = f_count - 1;
      centers_x[k] = data[rand_idx].norm_x; centers_y[k] = data[rand_idx].norm_y;
   }

   bool changed = true; int iterations = 0;
   while(changed && iterations < 100 && !IsStopped()) {
      changed = false; iterations++;
      for(int i=0; i<f_count; i++) {
         double min_dist = 99999999; int best_k = 0;
         for(int k=0; k<K; k++) {
            double dist = MathSqrt(MathPow(data[i].norm_x - centers_x[k], 2) + MathPow(data[i].norm_y - centers_y[k], 2));
            if(dist < min_dist) { min_dist = dist; best_k = k; }
         }
         if(assignments[i] != best_k) { assignments[i] = best_k; changed = true; }
      }

      int counts[]; ArrayResize(counts, K); ArrayInitialize(counts, 0);
      double sum_x[]; ArrayResize(sum_x, K); ArrayInitialize(sum_x, 0.0);
      double sum_y[]; ArrayResize(sum_y, K); ArrayInitialize(sum_y, 0.0);
      for(int i=0; i<f_count; i++) {
         int k = assignments[i]; sum_x[k] += data[i].norm_x; sum_y[k] += data[i].norm_y; counts[k]++;
      }
      for(int k=0; k<K; k++) {
         if(counts[k] > 0) { centers_x[k] = sum_x[k] / counts[k]; centers_y[k] = sum_y[k] / counts[k]; }
      }
   }
}

void RegionQuery(const ClusterPoint &data[], int p_idx, double eps, int &neighbors[]) {
   ArrayResize(neighbors, 0);
   for(int i=0; i<ArraySize(data); i++) {
      double dist = MathSqrt(MathPow(data[p_idx].norm_x - data[i].norm_x, 2) + MathPow(data[p_idx].norm_y - data[i].norm_y, 2));
      if(dist <= eps) {
         int sz = ArraySize(neighbors); ArrayResize(neighbors, sz+1); neighbors[sz] = i;
      }
   }
}

void ExpandCluster(const ClusterPoint &data[], int p_idx, int &neighbors[], int cluster_id, double eps, int min_pts, bool &visited[], int &assignments[]) {
   assignments[p_idx] = cluster_id;
   int i = 0;
   while(i < ArraySize(neighbors) && !IsStopped()) {
      int n_idx = neighbors[i];
      if(!visited[n_idx]) {
         visited[n_idx] = true; int n_neighbors[]; RegionQuery(data, n_idx, eps, n_neighbors);
         if(ArraySize(n_neighbors) >= min_pts) {
            for(int k=0; k<ArraySize(n_neighbors); k++) {
               int candidate = n_neighbors[k]; bool exists = false;
               for(int j=0; j<ArraySize(neighbors); j++) { if(neighbors[j] == candidate) { exists = true; break; } }
               if(!exists) { int sz = ArraySize(neighbors); ArrayResize(neighbors, sz+1); neighbors[sz] = candidate; }
            }
         }
      }
      if(assignments[n_idx] == -1) assignments[n_idx] = cluster_id;
      i++;
   }
}

int RunDBSCAN(const ClusterPoint &data[], int p_count, double eps, int min_pts, int &assignments[]) {
   ArrayResize(assignments, p_count); ArrayInitialize(assignments, -1);
   bool visited[]; ArrayResize(visited, p_count); ArrayInitialize(visited, false);

   int cluster_id = 0;
   for(int i = 0; i < p_count; i++) {
      if(visited[i]) continue;
      visited[i] = true; int neighbors[]; RegionQuery(data, i, eps, neighbors);
      if(ArraySize(neighbors) >= min_pts) {
         ExpandCluster(data, i, neighbors, cluster_id, eps, min_pts, visited, assignments);
         cluster_id++;
      }
   }
   return cluster_id; 
}


//+------------------------------------------------------------------+
//| Core: Clustering -> Regression -> EDT Integration                |
//+------------------------------------------------------------------+
void PerformClusteringAndEDT(const int rates_total, const datetime &time[], const double &close_arr[])
{
   ObjectsDeleteAll(0, "ClusterHull_"); 
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   ArrayInitialize(ExtCrossInCluster, 0.0);
   
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   
   // 1. Gather Crossing Points
   ClusterPoint points[];
   for(int i = startIdx; i < rates_total; i++) {
      if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
         int sz = ArraySize(points); ArrayResize(points, sz + 1);
         points[sz].bar = i; points[sz].time = time[i]; points[sz].price = ExtSSACross[i];
      }
   }

   int p_count = ArraySize(points);
   if(p_count < InpMinPts) return;

   // 2. Normalize Data
   double min_bar = 99999999, max_bar = -1, min_price = 99999999, max_price = -1;
   for(int i = 0; i < p_count; i++) {
      if(points[i].bar < min_bar) min_bar = points[i].bar; if(points[i].bar > max_bar) max_bar = points[i].bar;
      if(points[i].price < min_price) min_price = points[i].price; if(points[i].price > max_price) max_price = points[i].price;
   }
   if(max_bar == min_bar) max_bar += 1; if(max_price == min_price) max_price += 0.00001;
   
   for(int i = 0; i < p_count; i++) {
      points[i].norm_x = (points[i].bar - min_bar) / (max_bar - min_bar);
      points[i].norm_y = (points[i].price - min_price) / (max_price - min_price);
   }

   // 3. Cluster Data
   int assignments[]; int total_clusters = 0;
   if(InpAlgo == ALGO_KMEANS) {
      total_clusters = (int)MathMax(2, p_count / InpPointsPerCluster);
      CustomKMeans(points, p_count, total_clusters, assignments);
      
      for(int k=0; k<total_clusters; k++) {
         double sum_x=0, sum_y=0; int pt_count=0;
         for(int i=0; i<p_count; i++) { if(assignments[i] == k) { sum_x += points[i].norm_x; sum_y += points[i].norm_y; pt_count++; } }
         if(pt_count < InpMinPts) { for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1; continue; }
         
         double center_x = sum_x / pt_count, center_y = sum_y / pt_count, total_dist = 0.0;
         for(int i=0; i<p_count; i++) { if(assignments[i] == k) total_dist += MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2)); }
         if((total_dist / pt_count) > InpMaxAvgDistance) { for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1; }
      }
   } 
   else if (InpAlgo == ALGO_DBSCAN) {
      total_clusters = RunDBSCAN(points, p_count, InpEpsilon, InpMinPts, assignments);
   }
   
   for(int i = 0; i < p_count; i++) { if(assignments[i] != -1) ExtCrossInCluster[points[i].bar] = 1.0; }
   
   ClusterCentroidInfo centroids[]; int centroid_count = 0;

   // 4. Draw Convex Hulls & Capture Centroids
   for(int k = 0; k < total_clusters; k++) {
      ClusterPoint cluster_points[]; double sum_x = 0, sum_y = 0;
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points); ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = points[i]; sum_x += points[i].norm_x; sum_y += points[i].norm_y;
         }
      }
      
      int filtered_count = ArraySize(cluster_points);
      if(filtered_count >= 3) { 
         ClusterPoint hull[]; GetConvexHull(cluster_points, hull);
         int h_count = ArraySize(hull); color c_color = GetClusterColor(k);
         
         for(int h = 0; h < h_count; h++) {
            ClusterPoint p1 = hull[h], p2 = hull[(h + 1) % h_count]; 
            string line_name = "ClusterHull_" + IntegerToString(k) + "_" + IntegerToString(h);
            ObjectCreate(0, line_name, OBJ_TREND, 0, p1.time, p1.price, p2.time, p2.price);
            ObjectSetInteger(0, line_name, OBJPROP_COLOR, c_color); ObjectSetInteger(0, line_name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, false); ObjectSetInteger(0, line_name, OBJPROP_BACK, true); ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
         }
         
         double final_center_x = sum_x / filtered_count, final_center_y = sum_y / filtered_count;
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);
         
         int time_index = real_centroid_bar;
         if(time_index < 0) time_index = 0; if(time_index >= rates_total) time_index = rates_total - 1;
         datetime centroid_time = time[time_index];
         
         string star_name = "ClusterCentroidStar_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings"); ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(108));
         ObjectSetInteger(0, star_name, OBJPROP_FONTSIZE, 10); ObjectSetInteger(0, star_name, OBJPROP_ANCHOR, ANCHOR_CENTER);
         ObjectSetInteger(0, star_name, OBJPROP_COLOR, c_color); ObjectSetInteger(0, star_name, OBJPROP_SELECTABLE, false);

         ArrayResize(centroids, centroid_count + 1);
         centroids[centroid_count].price = real_centroid_price;
         centroids[centroid_count].bar_index = real_centroid_bar;
         centroids[centroid_count].time = centroid_time;
         centroids[centroid_count].cluster_id = k;
         centroid_count++;
      }
   }

   // 5. Sort Centroids Descending (Newest First)
   for(int i = 0; i < centroid_count - 1; i++) {
      for(int j = 0; j < centroid_count - i - 1; j++) {
         if(centroids[j].bar_index < centroids[j+1].bar_index) {
            ClusterCentroidInfo temp = centroids[j];
            centroids[j] = centroids[j+1];
            centroids[j+1] = temp;
         }
      }
   }

   // 6. Regression Line based on 3 Most Recent Centroids
   ArrayInitialize(ExtBaseLine, EMPTY_VALUE);
   if(centroid_count < 3) return; 

   double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
   int n_reg = 3; 
   for(int i = 0; i < n_reg; i++) {
      double cx = centroids[i].bar_index;
      double cy = centroids[i].price;
      sumX += cx; sumY += cy; sumXY += cx * cy; sumX2 += cx * cx;
   }

   double D = n_reg * sumX2 - sumX * sumX;
   double base_m = 0, base_c = 0;

   if(D != 0) {
      base_m = (n_reg * sumXY - sumX * sumY) / D;
      base_c = (sumY - base_m * sumX) / n_reg;
   } else {
      base_m = 0; base_c = centroids[0].price; // Vertical fallback
   }

   // Draw Base Regression Line over the entire SSA domain
   for(int i = startIdx; i < rates_total; i++) {
      ExtBaseLine[i] = base_m * i + base_c;
   }

   // 7. Extract Fractals & Build EDTs (Constrained to NEW Lookback Period)
   int edtStartIdx = rates_total - InpEDTLookbackBars;
   if(edtStartIdx < 0) edtStartIdx = 0;

   FractalPoint fractals[];
   for(int i = edtStartIdx; i < rates_total; i++) {
      if(ExtUpper108[i] != EMPTY_VALUE && ExtUpper108[i] > 0) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = i; fractals[sz].price = ExtUpper108[i]; fractals[sz].is_peak = true;
      }
      if(ExtLower108[i] != EMPTY_VALUE && ExtLower108[i] > 0) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = i; fractals[sz].price = ExtLower108[i]; fractals[sz].is_peak = false;
      }
   }

   BuildSymmetricalEDTs(base_m, base_c, fractals, rates_total, close_arr[rates_total-1], edtStartIdx);
}

//+------------------------------------------------------------------+
//| Symmetrical EDT Snapping Logic (Top & Bottom Arrays)             |
//+------------------------------------------------------------------+
void BuildSymmetricalEDTs(double base_m, double base_c, const FractalPoint &fractals[], int rates_total, double current_close, int edtStartIdx)
{
   ArrayInitialize(ExtEDT1, EMPTY_VALUE); ArrayInitialize(ExtEDT2, EMPTY_VALUE); ArrayInitialize(ExtEDT3, EMPTY_VALUE);
   ArrayInitialize(ExtEDT4, EMPTY_VALUE); ArrayInitialize(ExtEDT5, EMPTY_VALUE); ArrayInitialize(ExtEDT6, EMPTY_VALUE);
   ArrayInitialize(ExtEDT7, EMPTY_VALUE); ArrayInitialize(ExtEDT8, EMPTY_VALUE); ArrayInitialize(ExtEDT9, EMPTY_VALUE);

   int f_count = ArraySize(fractals);
   if(f_count == 0) return;

   double current_atr = 0;
   if(InpToleranceType == TOLERANCE_ATR && ExtATRHandle != INVALID_HANDLE) {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0) current_atr = atr_array[0];
   }

   TrendLine cand_above[]; int count_above = 0;
   TrendLine cand_below[]; int count_below = 0;
   
   for(int i = 0; i < f_count; i++) {
      double test_intercept = fractals[i].price - base_m * fractals[i].bar;
      int touches = 0;
      bool has_peak = false, has_bottom = false;

      for(int k = 0; k < f_count; k++) {
         double expected = base_m * fractals[k].bar + test_intercept;
         if(MathAbs(fractals[k].price - expected) <= CalculateToleranceFast(fractals[k].price, current_atr)) {
            touches++;
            if(fractals[k].is_peak) has_peak = true; else has_bottom = true;
         }
      }

      bool pass_flip = InpRequireBothSides ? (has_peak && has_bottom) : true;
      
      if(touches >= InpMinTouches && pass_flip) {
         TrendLine tl;
         tl.slope = base_m;
         tl.y_intercept = test_intercept;
         tl.touches = touches;
         tl.score = touches * 10000.0; 
         
         // Split candidates spatially
         if(test_intercept > base_c) {
             ArrayResize(cand_above, count_above + 1);
             cand_above[count_above] = tl;
             count_above++;
         } else if (test_intercept < base_c) {
             ArrayResize(cand_below, count_below + 1);
             cand_below[count_below] = tl;
             count_below++;
         }
      }
   }

   // Sort Candidates Descending by Score
   for(int i = 0; i < count_above - 1; i++) {
      for(int j = i + 1; j < count_above; j++) {
         if(cand_above[j].score > cand_above[i].score) {
            TrendLine tmp = cand_above[i]; cand_above[i] = cand_above[j]; cand_above[j] = tmp;
         }
      }
   }
   for(int i = 0; i < count_below - 1; i++) {
      for(int j = i + 1; j < count_below; j++) {
         if(cand_below[j].score > cand_below[i].score) {
            TrendLine tmp = cand_below[i]; cand_below[i] = cand_below[j]; cand_below[j] = tmp;
         }
      }
   }

   // Determine Symmetrical Allocation
   int max_allowed = MathMin(InpMaxEDTLines, 9);
   int max_per_side = max_allowed / 2;
   int remainder = max_allowed % 2; 
   
   int extra_above = 0, extra_below = 0;
   if(remainder > 0) {
       double max_score_above = (count_above > 0) ? cand_above[0].score : -1;
       double max_score_below = (count_below > 0) ? cand_below[0].score : -1;
       if(max_score_above >= max_score_below) extra_above = 1;
       else extra_below = 1;
   }

   int target_above = max_per_side + extra_above;
   int target_below = max_per_side + extra_below;

   TrendLine final_edts[]; int final_count = 0;
   double base_price_now = base_m * (rates_total - 1) + base_c;

   // Process Above Candidates
   int picked_above = 0;
   for(int i = 0; i < count_above && picked_above < target_above; i++) {
      bool too_close = false;
      double cand_price_now = base_m * (rates_total - 1) + cand_above[i].y_intercept;
      if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
      
      for(int f = 0; f < final_count; f++) {
         double approved_price = base_m * (rates_total - 1) + final_edts[f].y_intercept;
         if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
      }
      if(!too_close) { ArrayResize(final_edts, final_count + 1); final_edts[final_count] = cand_above[i]; final_count++; picked_above++; }
   }

   // Process Below Candidates
   int picked_below = 0;
   for(int i = 0; i < count_below && picked_below < target_below; i++) {
      bool too_close = false;
      double cand_price_now = base_m * (rates_total - 1) + cand_below[i].y_intercept;
      if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
      
      for(int f = 0; f < final_count; f++) {
         double approved_price = base_m * (rates_total - 1) + final_edts[f].y_intercept;
         if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
      }
      if(!too_close) { ArrayResize(final_edts, final_count + 1); final_edts[final_count] = cand_below[i]; final_count++; picked_below++; }
   }

   // Failsafe: If one side couldn't fulfill its quota, allow the other side to fill the empty slots
   if (final_count < max_allowed) {
       int remaining = max_allowed - final_count;
       // Try adding leftover valid lines from Above
       for(int i = 0; i < count_above && remaining > 0; i++) {
          bool already_picked = false;
          for(int f=0; f<final_count; f++) { if (final_edts[f].y_intercept == cand_above[i].y_intercept) { already_picked = true; break; } }
          if (already_picked) continue;

          bool too_close = false;
          double cand_price_now = base_m * (rates_total - 1) + cand_above[i].y_intercept;
          if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
          for(int f = 0; f < final_count; f++) {
             double approved_price = base_m * (rates_total - 1) + final_edts[f].y_intercept;
             if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
          }
          if(!too_close) { ArrayResize(final_edts, final_count + 1); final_edts[final_count] = cand_above[i]; final_count++; remaining--; }
       }
       // Try adding leftover valid lines from Below
       for(int i = 0; i < count_below && remaining > 0; i++) {
          bool already_picked = false;
          for(int f=0; f<final_count; f++) { if (final_edts[f].y_intercept == cand_below[i].y_intercept) { already_picked = true; break; } }
          if (already_picked) continue;

          bool too_close = false;
          double cand_price_now = base_m * (rates_total - 1) + cand_below[i].y_intercept;
          if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
          for(int f = 0; f < final_count; f++) {
             double approved_price = base_m * (rates_total - 1) + final_edts[f].y_intercept;
             if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
          }
          if(!too_close) { ArrayResize(final_edts, final_count + 1); final_edts[final_count] = cand_below[i]; final_count++; remaining--; }
       }
   }

   // Draw finalized EDTs (Only within the Lookback Window)
   for(int L = 0; L < final_count; L++) {
      double c = final_edts[L].y_intercept;
      for(int i = edtStartIdx; i < rates_total; i++) {
         double val = base_m * i + c;
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

//+------------------------------------------------------------------+
//| Main Calculation loop                                            |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[], const double &open[], const double &high[], const double &low[], const double &close[], const long &tick_volume[], const long &volume[], const int &spread[])
{
   if(rates_total < MathMax((int)InpFractalBars, SSAWindow) * 2) return(0);
   
   // Enforce strict Non-Series indexing (0 is oldest, rates_total-1 is newest)
   ArraySetAsSeries(time, false); ArraySetAsSeries(close, false); ArraySetAsSeries(high, false); ArraySetAsSeries(low, false);

   bool new_bar = false;
   if(prev_calculated == 0) ExtLastBarTime = time[rates_total - 1];
   else if (time[rates_total - 1] != ExtLastBarTime) { new_bar = true; ExtLastBarTime = time[rates_total - 1]; }

   // Global array maintenance
   if(ArraySize(g_time) < rates_total) {
      ArrayResize(g_time, rates_total); ArrayResize(g_close, rates_total); ArrayResize(g_high, rates_total); ArrayResize(g_low, rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++) {
      g_time[j] = time[j]; g_close[j] = close[j]; g_high[j] = high[j]; g_low[j] = low[j];
   }
   g_rates_total = rates_total;

   // SSA Processing
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   int len = rates_total - startIdx;
   
   if(prev_calculated == 0) {
      for(int i = 0; i < startIdx; i++) { ExtSSATrend[i] = EMPTY_VALUE; ExtSSASignal[i] = EMPTY_VALUE; ExtSSACross[i] = EMPTY_VALUE; }
   }

   vector<double> vecClose(len);
   for(int i = 0; i < len; i++) vecClose[i] = close[startIdx + i];

   CSSAModel ssaClose; CAlglib::SSACreate(ssaClose); CRowDouble closeRow(vecClose); 
   CAlglib::SSAAddSequence(ssaClose, closeRow); CAlglib::SSASetAlgoTopKRealtime(ssaClose, SSARank); CAlglib::SSASetWindow(ssaClose, SSAWindow);

   CRowDouble trend, noise;
   double alpha = 2.0 / (SSASignalPeriod + 1.0);

   if(prev_calculated == 0) {
      CAlglib::SSAAnalyzeLast(ssaClose, len, trend, noise);
      if(trend.Size() == len) {
         vector<double> vecTrend = trend.ToVector();
         for(int i = 0; i < len; i++) ExtSSATrend[startIdx + i] = vecTrend[i];
         
         ExtSSASignal[startIdx] = vecTrend[0]; ExtSSACross[startIdx] = EMPTY_VALUE;
         for(int i = 1; i < len; i++) {
            int idx = startIdx + i;
            ExtSSASignal[idx] = alpha * vecTrend[i] + (1.0 - alpha) * ExtSSASignal[idx - 1];
            bool crossUp = (ExtSSATrend[idx] > ExtSSASignal[idx]) && (ExtSSATrend[idx - 1] <= ExtSSASignal[idx - 1]);
            bool crossDown = (ExtSSATrend[idx] < ExtSSASignal[idx]) && (ExtSSATrend[idx - 1] >= ExtSSASignal[idx - 1]);
            if(crossUp || crossDown) ExtSSACross[idx] = ExtSSATrend[idx]; else ExtSSACross[idx] = EMPTY_VALUE;
         }
      }
   } else {
      CAlglib::SSAAnalyzeLast(ssaClose, 1, trend, noise);
      int last = rates_total - 1; int prev = last - 1;
      if(trend.Size() == 1) {
         ExtSSATrend[last] = trend[0];
         ExtSSASignal[last] = alpha * ExtSSATrend[last] + (1.0 - alpha) * ExtSSASignal[prev];
         if(ExtSSATrend[prev] != EMPTY_VALUE && ExtSSASignal[prev] != EMPTY_VALUE) {
            bool crossUp = (ExtSSATrend[last] > ExtSSASignal[last]) && (ExtSSATrend[prev] <= ExtSSASignal[prev]);
            bool crossDown = (ExtSSATrend[last] < ExtSSASignal[last]) && (ExtSSATrend[prev] >= ExtSSASignal[prev]);
            if(crossUp || crossDown) ExtSSACross[last] = ExtSSATrend[last]; else ExtSSACross[last] = EMPTY_VALUE;
         } else ExtSSACross[last] = EMPTY_VALUE;
      }
   }

   // Fractals Processing
   int f_start = MathMax(ExtSideBars, prev_calculated - 1);
   for(int i = f_start; i < rates_total; i++) {
      ExtUpper108[i] = EMPTY_VALUE; ExtLower108[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars, rates_total)) ExtUpper108[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars, rates_total))  ExtLower108[i] = low[i];
   }

   if(InpShowSymbol119) {
      int f_start_119 = MathMax(ExtSideBars119, prev_calculated - 1);
      for(int i = f_start_119; i < rates_total; i++) {
         ExtUpper119[i] = EMPTY_VALUE; ExtLower119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119, rates_total)) ExtUpper119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119, rates_total))  ExtLower119[i] = low[i];
      }
   }

   // Clustering -> Regression -> EDT
   if(prev_calculated == 0 || new_bar) { 
      PerformClusteringAndEDT(rates_total, time, close); 
      ChartRedraw(0); 
   }

   return(rates_total);
}