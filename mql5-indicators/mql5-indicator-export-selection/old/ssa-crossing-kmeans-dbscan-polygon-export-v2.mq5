//+------------------------------------------------------------------+
//|                                                  ALGLIB_SSA.mq5 |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "1.40"
#property indicator_chart_window
#property indicator_buffers 6
#property indicator_plots   5

//--- include ALGLIB
#include <Math/Alglib/alglib.mqh>

//--- plot definitions
#property indicator_label1  "SSA Trend"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrMagenta
#property indicator_width1  2

#property indicator_label2  "SSA Signal (EMA)"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrBlue
#property indicator_width2  2
#property indicator_style2  STYLE_DASH

#property indicator_label3  "SSA Trend High"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrLime
#property indicator_width3  2

#property indicator_label4  "SSA Trend Low"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrRed
#property indicator_width4  2

#property indicator_label5  "SSA Crossing"
#property indicator_type5   DRAW_ARROW
#property indicator_color5  clrBlack 
#property indicator_width5  2

//--- export button name constant
#define EXPORT_BUTTON_NAME "SSAExportButton"

//--- Enums
enum ENUM_CLUSTERING_ALGO {
   ALGO_KMEANS = 0, // Modified K-Means (Dynamic K + Filter)
   ALGO_DBSCAN = 1  // DBSCAN (Density-Based Spatial)
};

//--- input parameters (SSA)
input string Sep0 = "===== SSA Settings =====";
input int    SSAWindow         = 30;
input int    SSARank           = 6;
input int    SSASignalPeriod   = 3;
input int    LookbackBars      = 3000;

//--- input parameters (Export)
input string Sep1 = "===== Export Settings =====";
input int    InpExportBars     = 3000;      
input string InpExportFileName = "ALGLIB_SSA";

//--- input parameters (Timer)
input string SepTimer = "===== Timer Settings =====";
input bool   InpAutoReload     = true;

//--- input parameters (Clustering)
input string               SepClust            = "===== Clustering Settings =====";
input ENUM_CLUSTERING_ALGO InpAlgo             = ALGO_DBSCAN;
input int                  InpMinPts           = 5;

input string               SepKMeans           = "--- Modified K-Means Params ---";
input int                  InpPointsPerCluster = 5;
input double               InpMaxAvgDistance   = 0.02;

input string               SepDBSCAN           = "--- DBSCAN Params ---";
input double               InpEpsilon          = 0.02;

input string               SepColors           = "--- Polygon Colors ---";
input color  InpClusterColor0  = clrDodgerBlue;
input color  InpClusterColor1  = clrLimeGreen;
input color  InpClusterColor2  = clrRed;
input color  InpClusterColor3  = clrGold;
input color  InpClusterColor4  = clrMagenta;
input color  InpClusterColor5  = clrAqua;

//--- indicator buffers
double ssaTrendBuffer[];
double ssaSignalBuffer[];
double ssaTrendHighBuffer[];
double ssaTrendLowBuffer[];
double ssaCrossBuffer[];
double ssaCrossInClusterBuffer[]; // Hidden buffer

//--- global cache for export & clustering
datetime g_time[];
double   g_close[];
double   g_high[];
double   g_low[];
int      g_rates_total = 0;
datetime ExtLastBarTime = 0;

//--- Structures for Clustering
struct ClusterPoint {
   int      bar;
   datetime time;
   double   price;
   double   norm_x;
   double   norm_y;
};

//--- Structure for Top Centroids Logic
struct ClusterCentroidInfo {
   double   price;
   int      bar_index;
   datetime time;
   int      cluster_id;
};

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, ssaTrendBuffer,     INDICATOR_DATA);
   SetIndexBuffer(1, ssaSignalBuffer,    INDICATOR_DATA);
   SetIndexBuffer(2, ssaTrendHighBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, ssaTrendLowBuffer,  INDICATOR_DATA);
   SetIndexBuffer(4, ssaCrossBuffer,     INDICATOR_DATA);
   SetIndexBuffer(5, ssaCrossInClusterBuffer, INDICATOR_CALCULATIONS); // Hidden

   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(4, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetInteger(4, PLOT_ARROW, 171); 

   IndicatorSetString(INDICATOR_SHORTNAME, "SSA Clusters & Export");
   
   CreateExportButton(); // --- ADDED: Create the export button on startup ---
   
   if(InpAutoReload) EventSetTimer(1); // Fired every second to check for exact 59th second

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(InpAutoReload) EventKillTimer();
   
   ObjectDelete(0, EXPORT_BUTTON_NAME); // --- ADDED: Clean up the button when removing the indicator ---
   
   ObjectsDeleteAll(0, "ClusterHull_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   ObjectsDeleteAll(0, "ClusterCentroidRay_");
   ChartRedraw(0);
}

void OnTimer()
{
   if(!InpAutoReload) return;

   MqlDateTime dt;
   TimeToStruct(TimeLocal(), dt); // Local time ensures tick independence
   static int last_update_min = -1;

   // Fire exactly on the 59th second of every minute
   if(dt.sec == 59 && last_update_min != dt.min)
   {
      last_update_min = dt.min;
      
      // Force manual clustering and redraw outside of OnCalculate cycles
      if(g_rates_total > 0 && ArraySize(g_time) > 0) 
      {
         PerformClustering(g_rates_total, g_time);
         ChartRedraw(0);
      }
   }
}

//+------------------------------------------------------------------+
//| Core Math & Convex Hull Helpers                                  |
//+------------------------------------------------------------------+
color GetClusterColor(int id) {
   switch(id % 6) {
      case 0: return InpClusterColor0;
      case 1: return InpClusterColor1;
      case 2: return InpClusterColor2; case 3: return InpClusterColor3;
      case 4: return InpClusterColor4; case 5: return InpClusterColor5;
   }
   return clrGray;
}

double HullCrossProduct(const ClusterPoint &o, const ClusterPoint &a, const ClusterPoint &b) {
   return (a.norm_x - o.norm_x) * (b.norm_y - o.norm_y) - (a.norm_y - o.norm_y) * (b.norm_x - o.norm_x);
}

void GetConvexHull(const ClusterPoint &points[], ClusterPoint &hull[]) {
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
//| ALGORITHM 1: Modified K-Means                                    |
//+------------------------------------------------------------------+
void CustomKMeans(const ClusterPoint &data[], int f_count, int K, int &assignments[]) {
   ArrayResize(assignments, f_count);
   double centers_x[]; ArrayResize(centers_x, K);
   double centers_y[]; ArrayResize(centers_y, K);

   for(int k=0; k<K; k++) {
      int rand_idx = k * (f_count / K);
      if(rand_idx >= f_count) rand_idx = f_count - 1;
      if(rand_idx < 0) rand_idx = 0;
      centers_x[k] = data[rand_idx].norm_x;
      centers_y[k] = data[rand_idx].norm_y;
   }

   bool changed = true;
   int iterations = 0;
   while(changed && iterations < 100 && !IsStopped()) {
      changed = false;
      iterations++;
      for(int i=0; i<f_count; i++) {
         double min_dist = 99999999;
         int best_k = 0;
         for(int k=0; k<K; k++) {
            double dist = MathSqrt(MathPow(data[i].norm_x - centers_x[k], 2) + MathPow(data[i].norm_y - centers_y[k], 2));
            if(dist < min_dist) { min_dist = dist; best_k = k; }
         }
         if(assignments[i] != best_k) { assignments[i] = best_k; changed = true; }
      }

      int counts[]; ArrayResize(counts, K);
      ArrayInitialize(counts, 0);
      double sum_x[]; ArrayResize(sum_x, K); ArrayInitialize(sum_x, 0.0);
      double sum_y[]; ArrayResize(sum_y, K); ArrayInitialize(sum_y, 0.0);
      for(int i=0; i<f_count; i++) {
         int k = assignments[i];
         sum_x[k] += data[i].norm_x;
         sum_y[k] += data[i].norm_y;
         counts[k]++;
      }

      for(int k=0; k<K; k++) {
         if(counts[k] > 0) { centers_x[k] = sum_x[k] / counts[k]; centers_y[k] = sum_y[k] / counts[k]; }
      }
   }
}

//+------------------------------------------------------------------+
//| ALGORITHM 2: DBSCAN                                              |
//+------------------------------------------------------------------+
void RegionQuery(const ClusterPoint &data[], int p_idx, double eps, int &neighbors[]) {
   ArrayResize(neighbors, 0);
   for(int i=0; i<ArraySize(data); i++) {
      double dist = MathSqrt(MathPow(data[p_idx].norm_x - data[i].norm_x, 2) + MathPow(data[p_idx].norm_y - data[i].norm_y, 2));
      if(dist <= eps) {
         int sz = ArraySize(neighbors);
         ArrayResize(neighbors, sz+1);
         neighbors[sz] = i;
      }
   }
}

void ExpandCluster(const ClusterPoint &data[], int p_idx, int &neighbors[], int cluster_id, double eps, int min_pts, bool &visited[], int &assignments[]) {
   assignments[p_idx] = cluster_id;
   int i = 0;
   while(i < ArraySize(neighbors) && !IsStopped()) {
      int n_idx = neighbors[i];
      if(!visited[n_idx]) {
         visited[n_idx] = true;
         int n_neighbors[];
         RegionQuery(data, n_idx, eps, n_neighbors);
         if(ArraySize(n_neighbors) >= min_pts) {
            for(int k=0; k<ArraySize(n_neighbors); k++) {
               int candidate = n_neighbors[k];
               bool exists = false;
               for(int j=0; j<ArraySize(neighbors); j++) {
                  if(neighbors[j] == candidate) { exists = true; break; }
               }
               if(!exists) {
                  int sz = ArraySize(neighbors);
                  ArrayResize(neighbors, sz+1);
                  neighbors[sz] = candidate;
               }
            }
         }
      }
      if(assignments[n_idx] == -1) assignments[n_idx] = cluster_id;
      i++;
   }
}

int RunDBSCAN(const ClusterPoint &data[], int p_count, double eps, int min_pts, int &assignments[]) {
   ArrayResize(assignments, p_count);
   ArrayInitialize(assignments, -1);

   bool visited[];
   ArrayResize(visited, p_count);
   ArrayInitialize(visited, false);

   int cluster_id = 0;
   for(int i = 0; i < p_count; i++) {
      if(visited[i]) continue;
      visited[i] = true;
      int neighbors[];
      RegionQuery(data, i, eps, neighbors);

      if(ArraySize(neighbors) >= min_pts) {
         ExpandCluster(data, i, neighbors, cluster_id, eps, min_pts, visited, assignments);
         cluster_id++;
      }
   }
   return cluster_id; 
}

//+------------------------------------------------------------------+
//| Main Clustering Sequence                                         |
//+------------------------------------------------------------------+
void PerformClustering(const int rates_total, const datetime &time[])
{
   ObjectsDeleteAll(0, "ClusterHull_"); 
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   ObjectsDeleteAll(0, "ClusterCentroidRay_"); // Clear rays
   ArrayInitialize(ssaCrossInClusterBuffer, 0.0);
   
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;

   // 1. Gather Crossing Points
   ClusterPoint points[];
   for(int i = startIdx; i < rates_total; i++) {
      if(ssaCrossBuffer[i] != EMPTY_VALUE && ssaCrossBuffer[i] != 0.0) {
         int sz = ArraySize(points);
         ArrayResize(points, sz + 1);
         points[sz].bar = i; 
         points[sz].time = time[i]; 
         points[sz].price = ssaCrossBuffer[i];
      }
   }

   int p_count = ArraySize(points);
   if(p_count < InpMinPts) return;
   
   // 2. Normalize Data
   double min_bar = 99999999, max_bar = -1;
   double min_price = 99999999, max_price = -1;
   for(int i = 0; i < p_count; i++) {
      if(points[i].bar < min_bar) min_bar = points[i].bar;
      if(points[i].bar > max_bar) max_bar = points[i].bar;
      if(points[i].price < min_price) min_price = points[i].price;
      if(points[i].price > max_price) max_price = points[i].price;
   }
   
   if(max_bar == min_bar) max_bar += 1;
   if(max_price == min_price) max_price += 0.00001;
   for(int i = 0; i < p_count; i++) {
      points[i].norm_x = (points[i].bar - min_bar) / (max_bar - min_bar);
      points[i].norm_y = (points[i].price - min_price) / (max_price - min_price);
   }

   // 3. Execute Selected Algorithm
   int assignments[];
   int total_clusters = 0;
   
   if(InpAlgo == ALGO_KMEANS) 
   {
      total_clusters = (int)MathMax(2, p_count / InpPointsPerCluster);
      CustomKMeans(points, p_count, total_clusters, assignments);
      
      for(int k=0; k<total_clusters; k++) {
         double sum_x=0, sum_y=0;
         int pt_count=0;
         for(int i=0; i<p_count; i++) {
            if(assignments[i] == k) { sum_x += points[i].norm_x; sum_y += points[i].norm_y; pt_count++; }
         }
         
         if(pt_count < InpMinPts) {
            for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
            continue;
         }
         
         double center_x = sum_x / pt_count;
         double center_y = sum_y / pt_count;
         double total_dist = 0.0;
         for(int i=0; i<p_count; i++) {
            if(assignments[i] == k) {
               total_dist += MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2));
            }
         }
         
         double avg_dist = total_dist / pt_count;
         if(avg_dist > InpMaxAvgDistance) {
             for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
         }
      }
   } 
   else if (InpAlgo == ALGO_DBSCAN) 
   {
      total_clusters = RunDBSCAN(points, p_count, InpEpsilon, InpMinPts, assignments);
   }
   
   for(int i = 0; i < p_count; i++) {
      if(assignments[i] != -1) ssaCrossInClusterBuffer[points[i].bar] = 1.0;
   }
   
   ClusterCentroidInfo centroids[];
   int centroid_count = 0;

   // 4. Draw Convex Hulls and Capture Centroids
   for(int k = 0; k < total_clusters; k++) {
      ClusterPoint cluster_points[];
      double sum_x = 0, sum_y = 0;
      
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points);
            ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = points[i];
            sum_x += points[i].norm_x;
            sum_y += points[i].norm_y;
         }
      }
      
      int filtered_count = ArraySize(cluster_points);
      if(filtered_count >= 3) { 
         ClusterPoint hull[];
         GetConvexHull(cluster_points, hull);
         int h_count = ArraySize(hull);
         color c_color = GetClusterColor(k);
         
         for(int h = 0; h < h_count; h++) {
            ClusterPoint p1 = hull[h];
            ClusterPoint p2 = hull[(h + 1) % h_count]; 

            string line_name = "ClusterHull_" + IntegerToString(k) + "_" + IntegerToString(h);
            ObjectCreate(0, line_name, OBJ_TREND, 0, p1.time, p1.price, p2.time, p2.price);
            ObjectSetInteger(0, line_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, line_name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, line_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, false);
            ObjectSetInteger(0, line_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
         }
         
         double final_center_x = sum_x / filtered_count;
         double final_center_y = sum_y / filtered_count;
         
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);
         
         int time_index = real_centroid_bar;
         if(time_index < 0) time_index = 0;
         if(time_index >= rates_total) time_index = rates_total - 1;
         
         datetime centroid_time = time[time_index];
         
         string star_name = "ClusterCentroidStar_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings");
         ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(108));
         ObjectSetInteger(0, star_name, OBJPROP_FONTSIZE, 10);
         ObjectSetInteger(0, star_name, OBJPROP_ANCHOR, ANCHOR_CENTER);
         ObjectSetInteger(0, star_name, OBJPROP_COLOR, c_color);
         ObjectSetInteger(0, star_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, star_name, OBJPROP_SELECTABLE, false);

         // Log Centroid for Top 10 processing
         ArrayResize(centroids, centroid_count + 1);
         centroids[centroid_count].price = real_centroid_price;
         centroids[centroid_count].bar_index = real_centroid_bar;
         centroids[centroid_count].time = centroid_time;
         centroids[centroid_count].cluster_id = k;
         centroid_count++;
      }
   }

   // 5. Sort Centroids Descending to find 10 Most Recent
   for(int i = 0; i < centroid_count - 1; i++) {
      for(int j = 0; j < centroid_count - i - 1; j++) {
         if(centroids[j].bar_index < centroids[j+1].bar_index) {
            ClusterCentroidInfo temp = centroids[j];
            centroids[j] = centroids[j+1];
            centroids[j+1] = temp;
         }
      }
   }

   // 6. Draw Ray Lines for Top 10
   int ray_limit = MathMin(10, centroid_count);
   for(int i = 0; i < ray_limit; i++) {
      int c_id = centroids[i].cluster_id;
      color c_color = GetClusterColor(c_id);
      
      string ray_name = "ClusterCentroidRay_" + IntegerToString(c_id);
      ObjectCreate(0, ray_name, OBJ_TREND, 0, centroids[i].time, centroids[i].price, time[rates_total-1], centroids[i].price);
      ObjectSetInteger(0, ray_name, OBJPROP_COLOR, c_color);
      ObjectSetInteger(0, ray_name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, ray_name, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, ray_name, OBJPROP_RAY_RIGHT, true);
      ObjectSetInteger(0, ray_name, OBJPROP_BACK, false);
      ObjectSetInteger(0, ray_name, OBJPROP_SELECTABLE, false);
   }
}

//+------------------------------------------------------------------+
//| Main calculation                                                 |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[], const double &open[], const double &high[], const double &low[], const double &close[], const long &tick_volume[], const long &volume[], const int &spread[])
{
   bool new_bar = false;
   if(prev_calculated == 0) ExtLastBarTime = time[rates_total - 1];
   else if (time[rates_total - 1] != ExtLastBarTime) { new_bar = true;
   ExtLastBarTime = time[rates_total - 1]; }

   if(ArraySize(g_time) < rates_total) {
      ArrayResize(g_time, rates_total);
      ArrayResize(g_close, rates_total); ArrayResize(g_high, rates_total); ArrayResize(g_low, rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++) {
      g_time[j] = time[j];
      g_close[j] = close[j]; g_high[j] = high[j]; g_low[j] = low[j];
   }
   g_rates_total = rates_total;
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   int len = rates_total - startIdx;
   if(len < SSAWindow) {
      for(int i = startIdx; i < rates_total; i++) {
         ssaTrendBuffer[i] = EMPTY_VALUE;
         ssaSignalBuffer[i] = EMPTY_VALUE; ssaTrendHighBuffer[i] = EMPTY_VALUE; ssaTrendLowBuffer[i] = EMPTY_VALUE; ssaCrossBuffer[i] = EMPTY_VALUE;
      }
      return(rates_total);
   }

   if(prev_calculated == 0) {
      for(int i = 0; i < startIdx; i++) {
         ssaTrendBuffer[i] = EMPTY_VALUE;
         ssaSignalBuffer[i] = EMPTY_VALUE; ssaTrendHighBuffer[i] = EMPTY_VALUE; ssaTrendLowBuffer[i] = EMPTY_VALUE; ssaCrossBuffer[i] = EMPTY_VALUE;
      }
   }

   vector<double> vecClose(len);
   vector<double> vecHigh(len); vector<double> vecLow(len);
   for(int i = 0; i < len; i++) {
      vecClose[i] = close[startIdx + i];
      vecHigh[i] = high[startIdx + i]; vecLow[i] = low[startIdx + i];
   }

   CSSAModel ssaClose; CAlglib::SSACreate(ssaClose); CRowDouble closeRow(vecClose); CAlglib::SSAAddSequence(ssaClose, closeRow);
   CAlglib::SSASetAlgoTopKRealtime(ssaClose, SSARank); CAlglib::SSASetWindow(ssaClose, SSAWindow);
   CSSAModel ssaHigh; CAlglib::SSACreate(ssaHigh); CRowDouble highRow(vecHigh); CAlglib::SSAAddSequence(ssaHigh, highRow); CAlglib::SSASetAlgoTopKRealtime(ssaHigh, SSARank); CAlglib::SSASetWindow(ssaHigh, SSAWindow);
   CSSAModel ssaLow; CAlglib::SSACreate(ssaLow); CRowDouble lowRow(vecLow);
   CAlglib::SSAAddSequence(ssaLow, lowRow); CAlglib::SSASetAlgoTopKRealtime(ssaLow, SSARank); CAlglib::SSASetWindow(ssaLow, SSAWindow);

   CRowDouble trend, noise, trendHigh, noiseHigh, trendLow, noiseLow;
   double alpha = 2.0 / (SSASignalPeriod + 1.0);

   if(prev_calculated == 0) {
      CAlglib::SSAAnalyzeLast(ssaClose, len, trend, noise);
      CAlglib::SSAAnalyzeLast(ssaHigh, len, trendHigh, noiseHigh); CAlglib::SSAAnalyzeLast(ssaLow, len, trendLow, noiseLow);

      if(trend.Size() == len) {
         vector<double> vecTrend = trend.ToVector();
         for(int i = 0; i < len; i++) ssaTrendBuffer[startIdx + i] = vecTrend[i];
         
         ssaSignalBuffer[startIdx] = vecTrend[0]; ssaCrossBuffer[startIdx] = EMPTY_VALUE;
         for(int i = 1; i < len; i++) {
            int idx = startIdx + i;
            ssaSignalBuffer[idx] = alpha * vecTrend[i] + (1.0 - alpha) * ssaSignalBuffer[idx - 1];
            bool crossUp = (ssaTrendBuffer[idx] > ssaSignalBuffer[idx]) && (ssaTrendBuffer[idx - 1] <= ssaSignalBuffer[idx - 1]);
            bool crossDown = (ssaTrendBuffer[idx] < ssaSignalBuffer[idx]) && (ssaTrendBuffer[idx - 1] >= ssaSignalBuffer[idx - 1]);
            if(crossUp || crossDown) ssaCrossBuffer[idx] = ssaTrendBuffer[idx];
            else ssaCrossBuffer[idx] = EMPTY_VALUE;
         }
      } else {
         for(int i = 0; i < len; i++) { ssaTrendBuffer[startIdx + i] = EMPTY_VALUE;
         ssaSignalBuffer[startIdx + i] = EMPTY_VALUE; ssaCrossBuffer[startIdx + i] = EMPTY_VALUE;
         }
      }

      if(trendHigh.Size() == len) { vector<double> vecTrendH = trendHigh.ToVector();
         for(int i = 0; i < len; i++) ssaTrendHighBuffer[startIdx + i] = vecTrendH[i];
      }
      else { for(int i = 0; i < len; i++) ssaTrendHighBuffer[startIdx + i] = EMPTY_VALUE;
      }

      if(trendLow.Size() == len) { vector<double> vecTrendL = trendLow.ToVector();
         for(int i = 0; i < len; i++) ssaTrendLowBuffer[startIdx + i] = vecTrendL[i];
      }
      else { for(int i = 0; i < len; i++) ssaTrendLowBuffer[startIdx + i] = EMPTY_VALUE;
      }
   } else {
      CAlglib::SSAAnalyzeLast(ssaClose, 1, trend, noise); CAlglib::SSAAnalyzeLast(ssaHigh, 1, trendHigh, noiseHigh);
      CAlglib::SSAAnalyzeLast(ssaLow, 1, trendLow, noiseLow);

      int last = rates_total - 1; int prev = last - 1;
      if(trend.Size() == 1) {
         ssaTrendBuffer[last] = trend[0];
         ssaSignalBuffer[last] = alpha * ssaTrendBuffer[last] + (1.0 - alpha) * ssaSignalBuffer[prev];
         if(ssaTrendBuffer[prev] != EMPTY_VALUE && ssaSignalBuffer[prev] != EMPTY_VALUE) {
            bool crossUp = (ssaTrendBuffer[last] > ssaSignalBuffer[last]) && (ssaTrendBuffer[prev] <= ssaSignalBuffer[prev]);
            bool crossDown = (ssaTrendBuffer[last] < ssaSignalBuffer[last]) && (ssaTrendBuffer[prev] >= ssaSignalBuffer[prev]);
            if(crossUp || crossDown) ssaCrossBuffer[last] = ssaTrendBuffer[last];
            else ssaCrossBuffer[last] = EMPTY_VALUE;
         } else { ssaCrossBuffer[last] = EMPTY_VALUE; }
      }

      if(trendHigh.Size() == 1) ssaTrendHighBuffer[last] = trendHigh[0];
      if(trendLow.Size() == 1) ssaTrendLowBuffer[last] = trendLow[0];
   }

   if(prev_calculated == 0 || new_bar) { PerformClustering(rates_total, time); ChartRedraw(0); }
   return(rates_total);
}

//+------------------------------------------------------------------+
//| Chart event handler & Export functions                           |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL") {
      if(ExportData()) Print("SUCCESS: [Export All] SSA data exported successfully");
      else Print("ERROR: [Export All] Failed to export SSA data.");
      return;
   }

   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME) {
      if(ExportData()) Print("SUCCESS: SSA indicator data exported successfully");
      else Print("ERROR: Failed to export SSA indicator data. See log for details.");
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   }
}

void CreateExportButton()
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER,       CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE,    250);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE,    100);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE,        200);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE,        50);
   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_TEXT,         "Export SSA Data");
   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_FONT,         "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE,     11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR,        clrWhite);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR,      C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR,       ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN,       false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE,   false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER,       999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE,        false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK,         false);
   ChartRedraw(0);
}

string TimeframeToString(ENUM_TIMEFRAMES timeframe)
{
   switch(timeframe)
   {
      case PERIOD_M1:  return "M1";
      case PERIOD_M2:  return "M2"; case PERIOD_M3:  return "M3";
      case PERIOD_M4:  return "M4"; case PERIOD_M5:  return "M5";
      case PERIOD_M6:  return "M6";
      case PERIOD_M10: return "M10"; case PERIOD_M12: return "M12"; case PERIOD_M15: return "M15";
      case PERIOD_M20: return "M20"; case PERIOD_M30: return "M30"; case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2";
      case PERIOD_H3:  return "H3"; case PERIOD_H4:  return "H4";
      case PERIOD_H6:  return "H6"; case PERIOD_H8:  return "H8";
      case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1"; case PERIOD_W1:  return "W1"; case PERIOD_MN1: return "MN1";
      default:
      {
         string s = EnumToString(timeframe);
         StringReplace(s, "PERIOD_", "");
         return s;
      }
   }
}

//+------------------------------------------------------------------+
//| Get Top 10 Centroids logic (used for accurate backfilling)       |
//+------------------------------------------------------------------+
void GetTop10CentroidsForShift(int shift, const int rates_total, const datetime &time_arr[], double &out_cen[])
{
   ArrayResize(out_cen, 10);
   ArrayInitialize(out_cen, 0.0);

   int end_idx = rates_total - 1 - shift;
   int start_idx = (end_idx > LookbackBars) ? end_idx - LookbackBars : 0;

   ClusterPoint points[];
   for(int i = start_idx; i <= end_idx; i++) {
      if(ssaCrossBuffer[i] != EMPTY_VALUE && ssaCrossBuffer[i] != 0.0) {
         int sz = ArraySize(points);
         ArrayResize(points, sz + 1);
         points[sz].bar = i;
         points[sz].time = time_arr[i];
         points[sz].price = ssaCrossBuffer[i];
      }
   }

   int p_count = ArraySize(points);
   if(p_count < InpMinPts) return;

   // Normalize
   double min_bar = 99999999, max_bar = -1;
   double min_price = 99999999, max_price = -1;
   for(int i = 0; i < p_count; i++) {
      if(points[i].bar < min_bar) min_bar = points[i].bar;
      if(points[i].bar > max_bar) max_bar = points[i].bar;
      if(points[i].price < min_price) min_price = points[i].price;
      if(points[i].price > max_price) max_price = points[i].price;
   }
   if(max_bar == min_bar) max_bar += 1;
   if(max_price == min_price) max_price += 0.00001;

   for(int i = 0; i < p_count; i++) {
      points[i].norm_x = (points[i].bar - min_bar) / (max_bar - min_bar);
      points[i].norm_y = (points[i].price - min_price) / (max_price - min_price);
   }

   int assignments[];
   int total_clusters = 0;

   if(InpAlgo == ALGO_KMEANS) {
      total_clusters = (int)MathMax(2, p_count / InpPointsPerCluster);
      CustomKMeans(points, p_count, total_clusters, assignments);
      
      for(int k=0; k<total_clusters; k++) {
         double sum_x=0, sum_y=0; int pt_count=0;
         for(int i=0; i<p_count; i++) {
            if(assignments[i] == k) { sum_x += points[i].norm_x; sum_y += points[i].norm_y; pt_count++; }
         }
         if(pt_count < InpMinPts) {
            for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
            continue;
         }
         double center_x = sum_x / pt_count; double center_y = sum_y / pt_count;
         double total_dist = 0.0;
         for(int i=0; i<p_count; i++) {
            if(assignments[i] == k) total_dist += MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2));
         }
         if((total_dist / pt_count) > InpMaxAvgDistance) {
            for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
         }
      }
   } else if (InpAlgo == ALGO_DBSCAN) {
      total_clusters = RunDBSCAN(points, p_count, InpEpsilon, InpMinPts, assignments);
   }

   ClusterCentroidInfo temp_centroids[];
   int temp_count = 0;
   
   for(int k = 0; k < total_clusters; k++) {
      double sum_x = 0, sum_y = 0;
      int pt_count = 0;
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            sum_x += points[i].norm_x;
            sum_y += points[i].norm_y;
            pt_count++;
         }
      }
      if(pt_count >= 3) {
         double final_center_x = sum_x / pt_count;
         double final_center_y = sum_y / pt_count;
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);

         ArrayResize(temp_centroids, temp_count + 1);
         temp_centroids[temp_count].price = real_centroid_price;
         temp_centroids[temp_count].bar_index = real_centroid_bar;
         temp_count++;
      }
   }

   // Sort descending by bar_index (Most recent = index 0)
   for(int i = 0; i < temp_count - 1; i++) {
      for(int j = 0; j < temp_count - i - 1; j++) {
         if(temp_centroids[j].bar_index < temp_centroids[j+1].bar_index) {
            ClusterCentroidInfo swp = temp_centroids[j];
            temp_centroids[j] = temp_centroids[j+1];
            temp_centroids[j+1] = swp;
         }
      }
   }

   int limit = MathMin(10, temp_count);
   for(int i = 0; i < limit; i++) {
      out_cen[i] = temp_centroids[i].price;
   }
}

//+------------------------------------------------------------------+
//| Export Logic with exact 14 columns requested                     |
//+------------------------------------------------------------------+
bool ExportData()
{
   if(g_rates_total <= 0) return false;

   string symbol = Symbol();
   string tf_str = TimeframeToString(Period());
   int bars_to_export = MathMin(InpExportBars, g_rates_total);
   int start_idx      = g_rates_total - bars_to_export;

   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
   string filename  = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
   
   ResetLastError();
   int fh = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE) return false;

   bool ok = true;
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   
   // --- UPDATED EXPORT HEADER ---
   ok &= FileWrite(fh, "timestamp\tsymbol\ttimeframe\tclose\tCEN_0\tCEN_1\tCEN_2\tCEN_3\tCEN_4\tCEN_5\tCEN_6\tCEN_7\tCEN_8\tCEN_9") > 0;
   
   Print("Starting data export for ", bars_to_export, " bars...");

   for(int i = 0; i < bars_to_export; i++)
   {
      int idx = start_idx + i;
      int shift = g_rates_total - 1 - idx; 

      double top10[10];
      GetTop10CentroidsForShift(shift, g_rates_total, g_time, top10);

      string cen_str[10];
      for(int c=0; c<10; c++) {
         cen_str[c] = (top10[c] != 0.0) ? DoubleToString(top10[c], _Digits + 3) : "";
      }

      string line = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s",
                                 (long)(g_time[idx] - gmt_offset), symbol, tf_str,
                                 DoubleToString(g_close[idx], _Digits),
                                 cen_str[0], cen_str[1], cen_str[2], cen_str[3], cen_str[4], 
                                 cen_str[5], cen_str[6], cen_str[7], cen_str[8], cen_str[9]);
      ok &= FileWrite(fh, line) > 0;
      
      if(i % 100 == 0 && i > 0) Print("Export progress: ", i, "/", bars_to_export);
   }

   FileClose(fh);
   if(ok) Print("Export complete: ", bars_to_export, " bars written to ", filename);
   return ok;
}
//+------------------------------------------------------------------+