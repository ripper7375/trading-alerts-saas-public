//+------------------------------------------------------------------+
//|                                                  ALGLIB_SSA.mq5 |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "1.10"
#property indicator_chart_window
#property indicator_buffers 5
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
#property indicator_color5  clrBlack // Matches user's screenshot preference
#property indicator_width5  2

//--- export button name constant
#define EXPORT_BUTTON_NAME "SSAExportButton"

//--- input parameters (SSA)
input string Sep0 = "===== SSA Settings =====";
input int    SSAWindow         = 30;       // SSA embedding window (must be < data length)
input int    SSARank           = 6;        // SSA components to keep (lower = smoother)
input int    SSASignalPeriod   = 3;        // EMA period for SSA signal line
input int    LookbackBars      = 500;      // Number of recent bars to process

//--- input parameters (Export)
input string Sep1 = "===== Export Settings =====";
input int    InpExportBars     = 500;      // Number of bars to export
input string InpExportFileName = "ALGLIB_SSA"; // Base export filename
input bool   InpAutoReload     = true;     // Auto-reload every minute (1s before end)
input int    InpReloadSecond   = 59;       // Second of the minute to trigger reload (0-59)

//--- input parameters (Clustering)
input string SepClust = "===== Crossing Clustering Settings =====";
input int    InpClusterCount   = 4;        // Number of Clusters (K)
input double InpOutlierDistanceMultiplier = 1.5; // Max Distance Multiplier
input color  InpClusterColor0  = clrDodgerBlue;
input color  InpClusterColor1  = clrLimeGreen;
input color  InpClusterColor2  = clrRed;
input color  InpClusterColor3  = clrGold;
input color  InpClusterColor4  = clrMagenta;
input color  InpClusterColor5  = clrAqua;

//--- auto-reload state
bool g_reloadFired = false;

//--- indicator buffers
double ssaTrendBuffer[];
double ssaSignalBuffer[];
double ssaTrendHighBuffer[];
double ssaTrendLowBuffer[];
double ssaCrossBuffer[];

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

   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(4, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   
   // Set Arrow Code for crossing (171 is the star symbol)
   PlotIndexSetInteger(4, PLOT_ARROW, 171);

   IndicatorSetString(INDICATOR_SHORTNAME, "SSA Trend & Signal + Clusters");

   // Export button hidden — use "Export All" EA instead
   // CreateExportButton();
   
   if(InpAutoReload)
      EventSetMillisecondTimer(500); 

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Deinitialization                                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(InpAutoReload)
      EventKillTimer();
      
   ObjectsDeleteAll(0, "ClusterHull_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Timer handler — auto-reload at InpReloadSecond of every minute   |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!InpAutoReload)
      return;

   MqlDateTime dt;
   TimeCurrent(dt);
   int sec = dt.sec;
   if(sec == InpReloadSecond && !g_reloadFired)
   {
      g_reloadFired = true;
      Print("AUTO-RELOAD: Triggering full recalculation at second ", sec);
      ChartSetSymbolPeriod(0, Symbol(), Period());
   }
   else if(sec != InpReloadSecond)
   {
      g_reloadFired = false;
   }
}

//+------------------------------------------------------------------+
//| Clustering Helper Functions                                      |
//+------------------------------------------------------------------+
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

void CustomKMeans(const ClusterPoint &data[], int f_count, int K, int &assignments[], double &centers_x[], double &centers_y[]) {
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
   while(changed && iterations < 100 && !IsStopped()) {
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
//| Main Clustering Sequence (Triggered after SSA Calculate)         |
//+------------------------------------------------------------------+
void PerformClustering(const int rates_total, const datetime &time[])
{
   ObjectsDeleteAll(0, "ClusterHull_"); 
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   
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
   if(p_count < InpClusterCount * 3) return; // Need enough points for valid polygons

   // 2. Normalize Data
   double min_bar = 99999999, max_bar = -1;
   double min_price = 99999999, max_price = -1;
   
   for(int i = 0; i < p_count; i++) {
      if(points[i].bar < min_bar) min_bar = points[i].bar;
      if(points[i].bar > max_bar) max_bar = points[i].bar;
      if(points[i].price < min_price) min_price = points[i].price;
      if(points[i].price > max_price) max_price = points[i].price;
   }
   
   // Prevent division by zero if all points are on same axis
   if(max_bar == min_bar) max_bar += 1;
   if(max_price == min_price) max_price += 0.00001;
   
   for(int i = 0; i < p_count; i++) {
      points[i].norm_x = (points[i].bar - min_bar) / (max_bar - min_bar);
      points[i].norm_y = (points[i].price - min_price) / (max_price - min_price);
   }

   // 3. Execute Custom K-Means
   double cluster_centers_x[];
   double cluster_centers_y[];
   int assignments[];
   CustomKMeans(points, p_count, InpClusterCount, assignments, cluster_centers_x, cluster_centers_y);
   
   // 4. Outlier Rejection & Grouping
   for(int k = 0; k < InpClusterCount; k++) {
      ClusterPoint cluster_points[];
      double center_x = cluster_centers_x[k];
      double center_y = cluster_centers_y[k];
      
      // Calculate average distance
      double total_dist = 0.0;
      int pt_count = 0;
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            double dist = MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2));
            total_dist += dist;
            pt_count++;
         }
      }
      
      if(pt_count == 0) continue;
      double avg_dist = total_dist / pt_count;
      double max_allowed_dist = avg_dist * InpOutlierDistanceMultiplier;
      
      // Filter Outliers
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            double dist = MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2));
            if(dist <= max_allowed_dist) { 
               int sz = ArraySize(cluster_points);
               ArrayResize(cluster_points, sz + 1);
               cluster_points[sz] = points[i];
            }
         }
      }
      
      // 5. Draw Bounding Polygon and S/R Lines
      if(ArraySize(cluster_points) >= 3) {
         ClusterPoint hull[];
         GetConvexHull(cluster_points, hull);
         
         int h_count = ArraySize(hull);
         color c_color = GetClusterColor(k);
         
         // Recalculate centroid based ONLY on filtered points
         double filtered_sum_x = 0;
         double filtered_sum_y = 0;
         int filtered_count = ArraySize(cluster_points);
         
         for(int i = 0; i < filtered_count; i++) {
            filtered_sum_x += cluster_points[i].norm_x;
            filtered_sum_y += cluster_points[i].norm_y;
         }
         
         double final_center_x = filtered_sum_x / filtered_count;
         double final_center_y = filtered_sum_y / filtered_count;

         // Draw Polygon
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
         
         // 6. De-normalize Centroid & Draw Equilibrium Star
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);
         
         int time_index = real_centroid_bar;
         if(time_index < 0) time_index = 0;
         if(time_index >= rates_total) time_index = rates_total - 1;
         
         datetime centroid_time = time[time_index];
         
         // Centroid Object (Using symbol 108 to distinguish from the standard crossing 171 star)
         string star_name = "ClusterCentroidStar_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings");
         ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(108)); 
         ObjectSetInteger(0, star_name, OBJPROP_FONTSIZE, 16);
         ObjectSetInteger(0, star_name, OBJPROP_ANCHOR, ANCHOR_CENTER);
         ObjectSetInteger(0, star_name, OBJPROP_COLOR, c_color);
         ObjectSetInteger(0, star_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, star_name, OBJPROP_SELECTABLE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Main calculation                                                 |
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
   bool new_bar = false;
   if(prev_calculated == 0) {
      ExtLastBarTime = time[rates_total - 1];
   } else if (time[rates_total - 1] != ExtLastBarTime) {
      new_bar = true;
      ExtLastBarTime = time[rates_total - 1];
   }

   //--- Cache data for export
   if(ArraySize(g_time) < rates_total)
   {
      ArrayResize(g_time,  rates_total);
      ArrayResize(g_close, rates_total);
      ArrayResize(g_high,  rates_total);
      ArrayResize(g_low,   rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++)
   {
      g_time[j]  = time[j];
      g_close[j] = close[j];
      g_high[j]  = high[j];
      g_low[j]   = low[j];
   }
   g_rates_total = rates_total;
   
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   int len      = rates_total - startIdx;
   
   if(len < SSAWindow)
   {
      for(int i = startIdx; i < rates_total; i++)
      {
         ssaTrendBuffer[i]     = EMPTY_VALUE;
         ssaSignalBuffer[i]    = EMPTY_VALUE;
         ssaTrendHighBuffer[i] = EMPTY_VALUE;
         ssaTrendLowBuffer[i]  = EMPTY_VALUE;
         ssaCrossBuffer[i]     = EMPTY_VALUE;
      }
      return(rates_total);
   }

   if(prev_calculated == 0)
   {
      for(int i = 0; i < startIdx; i++)
      {
         ssaTrendBuffer[i]     = EMPTY_VALUE;
         ssaSignalBuffer[i]    = EMPTY_VALUE;
         ssaTrendHighBuffer[i] = EMPTY_VALUE;
         ssaTrendLowBuffer[i]  = EMPTY_VALUE;
         ssaCrossBuffer[i]     = EMPTY_VALUE;
      }
   }

   vector<double> vecClose(len);
   vector<double> vecHigh(len);
   vector<double> vecLow(len);
   for(int i = 0; i < len; i++)
   {
      vecClose[i] = close[startIdx + i];
      vecHigh[i]  = high[startIdx + i];
      vecLow[i]   = low[startIdx + i];
   }

   CSSAModel ssaClose;
   CAlglib::SSACreate(ssaClose);
   CRowDouble closeRow(vecClose);
   CAlglib::SSAAddSequence(ssaClose, closeRow);
   CAlglib::SSASetAlgoTopKRealtime(ssaClose, SSARank);
   CAlglib::SSASetWindow(ssaClose, SSAWindow);

   CSSAModel ssaHigh;
   CAlglib::SSACreate(ssaHigh);
   CRowDouble highRow(vecHigh);
   CAlglib::SSAAddSequence(ssaHigh, highRow);
   CAlglib::SSASetAlgoTopKRealtime(ssaHigh, SSARank);
   CAlglib::SSASetWindow(ssaHigh, SSAWindow);

   CSSAModel ssaLow;
   CAlglib::SSACreate(ssaLow);
   CRowDouble lowRow(vecLow);
   CAlglib::SSAAddSequence(ssaLow, lowRow);
   CAlglib::SSASetAlgoTopKRealtime(ssaLow, SSARank);
   CAlglib::SSASetWindow(ssaLow, SSAWindow);

   CRowDouble trend, noise, trendHigh, noiseHigh, trendLow, noiseLow;
   double alpha = 2.0 / (SSASignalPeriod + 1.0);

   if(prev_calculated == 0)
   {
      CAlglib::SSAAnalyzeLast(ssaClose, len, trend, noise);
      CAlglib::SSAAnalyzeLast(ssaHigh,  len, trendHigh, noiseHigh);
      CAlglib::SSAAnalyzeLast(ssaLow,   len, trendLow, noiseLow);

      if(trend.Size() == len)
      {
         vector<double> vecTrend = trend.ToVector();
         for(int i = 0; i < len; i++)
            ssaTrendBuffer[startIdx + i] = vecTrend[i];
         
         ssaSignalBuffer[startIdx] = vecTrend[0];
         ssaCrossBuffer[startIdx]  = EMPTY_VALUE;

         for(int i = 1; i < len; i++)
         {
            int idx = startIdx + i;
            ssaSignalBuffer[idx] = alpha * vecTrend[i] + (1.0 - alpha) * ssaSignalBuffer[idx - 1];
            
            bool crossUp   = (ssaTrendBuffer[idx] > ssaSignalBuffer[idx]) && (ssaTrendBuffer[idx - 1] <= ssaSignalBuffer[idx - 1]);
            bool crossDown = (ssaTrendBuffer[idx] < ssaSignalBuffer[idx]) && (ssaTrendBuffer[idx - 1] >= ssaSignalBuffer[idx - 1]);
            
            if(crossUp || crossDown)
               ssaCrossBuffer[idx] = ssaTrendBuffer[idx];
            else
               ssaCrossBuffer[idx] = EMPTY_VALUE;
         }
      }
      else
      {
         for(int i = 0; i < len; i++) {
            ssaTrendBuffer[startIdx + i]  = EMPTY_VALUE;
            ssaSignalBuffer[startIdx + i] = EMPTY_VALUE;
            ssaCrossBuffer[startIdx + i]  = EMPTY_VALUE;
         }
      }

      if(trendHigh.Size() == len) {
         vector<double> vecTrendH = trendHigh.ToVector();
         for(int i = 0; i < len; i++) ssaTrendHighBuffer[startIdx + i] = vecTrendH[i];
      }
      else {
         for(int i = 0; i < len; i++) ssaTrendHighBuffer[startIdx + i] = EMPTY_VALUE;
      }

      if(trendLow.Size() == len) {
         vector<double> vecTrendL = trendLow.ToVector();
         for(int i = 0; i < len; i++) ssaTrendLowBuffer[startIdx + i] = vecTrendL[i];
      }
      else {
         for(int i = 0; i < len; i++) ssaTrendLowBuffer[startIdx + i] = EMPTY_VALUE;
      }
   }
   else
   {
      CAlglib::SSAAnalyzeLast(ssaClose, 1, trend, noise);
      CAlglib::SSAAnalyzeLast(ssaHigh,  1, trendHigh, noiseHigh);
      CAlglib::SSAAnalyzeLast(ssaLow,   1, trendLow, noiseLow);

      int last = rates_total - 1;
      int prev = last - 1;
      
      if(trend.Size() == 1)
      {
         ssaTrendBuffer[last]  = trend[0];
         ssaSignalBuffer[last] = alpha * ssaTrendBuffer[last] + (1.0 - alpha) * ssaSignalBuffer[prev];
         
         if(ssaTrendBuffer[prev] != EMPTY_VALUE && ssaSignalBuffer[prev] != EMPTY_VALUE)
         {
            bool crossUp   = (ssaTrendBuffer[last] > ssaSignalBuffer[last]) && (ssaTrendBuffer[prev] <= ssaSignalBuffer[prev]);
            bool crossDown = (ssaTrendBuffer[last] < ssaSignalBuffer[last]) && (ssaTrendBuffer[prev] >= ssaSignalBuffer[prev]);
            
            if(crossUp || crossDown) ssaCrossBuffer[last] = ssaTrendBuffer[last];
            else ssaCrossBuffer[last] = EMPTY_VALUE;
         }
         else {
            ssaCrossBuffer[last] = EMPTY_VALUE;
         }
      }

      if(trendHigh.Size() == 1) ssaTrendHighBuffer[last] = trendHigh[0];
      if(trendLow.Size() == 1) ssaTrendLowBuffer[last] = trendLow[0];
   }

   // Trigger Clustering rendering on new bars or full initial calculation
   if(prev_calculated == 0 || new_bar) {
      PerformClustering(rates_total, time);
      ChartRedraw(0);
   }

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
      case PERIOD_M1:  return "M1"; case PERIOD_M2:  return "M2"; case PERIOD_M3:  return "M3";
      case PERIOD_M4:  return "M4"; case PERIOD_M5:  return "M5"; case PERIOD_M6:  return "M6";
      case PERIOD_M10: return "M10"; case PERIOD_M12: return "M12"; case PERIOD_M15: return "M15";
      case PERIOD_M20: return "M20"; case PERIOD_M30: return "M30"; case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2"; case PERIOD_H3:  return "H3"; case PERIOD_H4:  return "H4";
      case PERIOD_H6:  return "H6"; case PERIOD_H8:  return "H8"; case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1"; case PERIOD_W1:  return "W1"; case PERIOD_MN1: return "MN1";
      default:
      {
         string s = EnumToString(timeframe);
         StringReplace(s, "PERIOD_", "");
         return s;
      }
   }
}

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
   ok &= FileWrite(fh, "timestamp\tsymbol\ttimeframe\tclose\tssa\tema_ssa\tssa_high\tssa_low\tSSA Crossing") > 0;
   
   for(int i = 0; i < bars_to_export; i++)
   {
      int idx = start_idx + i;
      
      string ssa_str = (ssaTrendBuffer[idx] != EMPTY_VALUE && ssaTrendBuffer[idx] != 0.0) ? DoubleToString(ssaTrendBuffer[idx], _Digits + 3) : "";
      string ema_ssa_str = (ssaSignalBuffer[idx] != EMPTY_VALUE && ssaSignalBuffer[idx] != 0.0) ? DoubleToString(ssaSignalBuffer[idx], _Digits + 3) : "";
      string ssa_high_str = (ssaTrendHighBuffer[idx] != EMPTY_VALUE && ssaTrendHighBuffer[idx] != 0.0) ? DoubleToString(ssaTrendHighBuffer[idx], _Digits + 3) : "";
      string ssa_low_str = (ssaTrendLowBuffer[idx] != EMPTY_VALUE && ssaTrendLowBuffer[idx] != 0.0) ? DoubleToString(ssaTrendLowBuffer[idx], _Digits + 3) : "";
                           
      string ssa_cross_str = "0"; 
      if(ssaTrendBuffer[idx] != EMPTY_VALUE && ssaTrendBuffer[idx] != 0.0) {
         ssa_cross_str = (ssaCrossBuffer[idx] != EMPTY_VALUE && ssaCrossBuffer[idx] != 0.0) ? "1" : "0";
      }

      string line = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s",
                                 (long)(g_time[idx] - gmt_offset), symbol, tf_str,
                                 DoubleToString(g_close[idx], _Digits), ssa_str, ema_ssa_str,
                                 ssa_high_str, ssa_low_str, ssa_cross_str);
                                 
      ok &= FileWrite(fh, line) > 0;
   }

   FileClose(fh);
   if(ok) Print("Export complete: ", bars_to_export, " bars written to ", filename);
   return ok;
}
//+------------------------------------------------------------------+