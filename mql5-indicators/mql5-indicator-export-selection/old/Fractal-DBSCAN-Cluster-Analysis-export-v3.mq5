//+------------------------------------------------------------------+
//|                                    Fractal-DBSCAN-Cluster-Analysis.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.41"
#property description "Fractal Clusters with Centroid Equilibrium Lines, Stars, and S/R Levels (DBSCAN) + Data Export"

#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   4

//--- Export Button name constants
#define EXPORT_BUTTON_NAME "ClusterExportBtn"
#define BACKFILL_BUTTON_NAME "ClusterBackfillBtn"

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
input int               InpLookbackBars = 1400;     // Rolling Lookback Period
input double            InpEpsilon      = 0.10;     // DBSCAN: Epsilon Search Radius (Normalized)
input int               InpMinPts       = 20;       // DBSCAN: Min Points per Cluster

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

input string            Sep4 = "===== Export Settings =====";
input bool              InpEnableExport = true;               // Enable Export Button
input bool              InpEnableBackfill = true;             // Enable Backfill Export Button
input int               InpBackfillBars = 500;                // Number of bars to backfill
input string            InpBaseFileName = "Cluster_Levels";   // Base file name for export

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
int    ExportRowNumber = 0; 

//--- Structures
struct FractalPoint {
   int      bar;
   datetime time;
   double   price;
   double   norm_x;
   double   norm_y;
};

// Export Structure
struct ClusterExportData {
   double centroid;
   double high;
   double low;
   double distance;
};

// Global array to store current closest clusters for manual export
ClusterExportData g_current_top3[];

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

   IndicatorSetString(INDICATOR_SHORTNAME, "Fractal Cluster Analysis (DBSCAN)");

   // Initialize export top3 array
   ArrayResize(g_current_top3, 3);
   for(int i=0; i<3; i++) { g_current_top3[i].centroid = 0; g_current_top3[i].high = 0; g_current_top3[i].low = 0; }

   if(InpEnableExport) {
      CreateExportButton();
      if(InpEnableBackfill) {
         CreateBackfillButton();
      }
   }

   // Initialize a 1-second timer for continuous refresh
   EventSetTimer(1);

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer(); // Clean up the timer
   
   ObjectsDeleteAll(0, "ClusterHull_");
   ObjectsDeleteAll(0, "ClusterCentroid_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_"); 
   ObjectsDeleteAll(0, "ClusterResist_");
   ObjectsDeleteAll(0, "ClusterSupport_"); 
   
   if(InpEnableExport) {
      ObjectDelete(0, EXPORT_BUTTON_NAME);
      if(InpEnableBackfill) {
         ObjectDelete(0, BACKFILL_BUTTON_NAME);
      }
   }
  }

//+------------------------------------------------------------------+
//| Continuous Refresh Timer                                         |
//+------------------------------------------------------------------+
void OnTimer()
  {
   MqlDateTime dt;
   TimeToStruct(TimeLocal(), dt); // Using local time guarantees firing regardless of tick volume
   static int last_update_min = -1;
   
   // Trigger exactly at the 59th second of the minute
   if(dt.sec == 59 && last_update_min != dt.min) {
      last_update_min = dt.min;
      
      int rates_total = iBars(Symbol(), Period());
      if(rates_total > 0) {
         int lookback = MathMin(InpLookbackBars, rates_total - 1);
         if(lookback >= MathMax(ExtMinBars, ExtMinBars119)) {
            
            datetime time_arr[];
            ArraySetAsSeries(time_arr, true);
            
            // Only need to copy up to lookback to process the clustering
            if(CopyTime(Symbol(), Period(), 0, lookback + 1, time_arr) > 0) {
               PerformClustering(rates_total, time_arr);
               ChartRedraw(0); // Force the chart to visually update immediately
            }
         }
      }
   }
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
//| UI and Export Helpers                                            |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe) {
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
   
   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");
   
   return StringFormat("%s_%s_%s.txt", base_name, clean_symbol, tf_str);
}

void CreateExportButton() {
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 220);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 70);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 200);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 50);
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Clusters");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
}

void CreateBackfillButton() {
   ObjectDelete(0, BACKFILL_BUTTON_NAME);
   ObjectCreate(0, BACKFILL_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_XDISTANCE, 220);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_YDISTANCE, 10);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_XSIZE, 200);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_YSIZE, 50);
   ObjectSetString(0, BACKFILL_BUTTON_NAME, OBJPROP_TEXT, "Backfill Clusters");
   ObjectSetString(0, BACKFILL_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,150,80');
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,120,60');
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_ZORDER, 999);
}

//+------------------------------------------------------------------+
//| DBSCAN Algorithm                                                 |
//+------------------------------------------------------------------+
void RegionQuery(const FractalPoint &data[], int p_idx, double eps, int &neighbors[]) {
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

void ExpandCluster(const FractalPoint &data[], int p_idx, int &neighbors[], int cluster_id, double eps, int min_pts, bool &visited[], int &assignments[]) {
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

int RunDBSCAN(const FractalPoint &data[], int p_count, double eps, int min_pts, int &assignments[]) {
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
//| Get Clusters Data logic (used for both drawing and backfilling)  |
//+------------------------------------------------------------------+
void GetClustersForShift(int shift, const int rates_total, double current_close, ClusterExportData &top3[]) {
   ArrayResize(top3, 3);
   for(int i=0; i<3; i++) { top3[i].centroid = 0; top3[i].high = 0; top3[i].low = 0; top3[i].distance = 999999; }

   int lookback = MathMin(InpLookbackBars, rates_total - 1 - shift);
   if(lookback < MathMax(ExtMinBars, ExtMinBars119)) return;

   // Gather Fractals based on specific shift
   FractalPoint fractals[];
   for(int i = shift; i <= shift + lookback && i < rates_total; i++) {
      int bar_idx = rates_total - 1 - i;
      if(ExtUpperBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].price = ExtUpperBuffer[i];
      }
      if(ExtLowerBuffer[i] != EMPTY_VALUE) {
         int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
         fractals[sz].bar = bar_idx; fractals[sz].price = ExtLowerBuffer[i];
      }
      if(InpShowSymbol119) {
         if(ExtUpperBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].price = ExtUpperBuffer119[i];
         }
         if(ExtLowerBuffer119[i] != EMPTY_VALUE) {
            int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
            fractals[sz].bar = bar_idx; fractals[sz].price = ExtLowerBuffer119[i];
         }
      }
   }

   int f_count = ArraySize(fractals);
   if(f_count < InpMinPts) return;

   // Normalize
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

   // Run DBSCAN
   int assignments[];
   int total_clusters = RunDBSCAN(fractals, f_count, InpEpsilon, InpMinPts, assignments);

   ClusterExportData all_clusters[];
   for(int k = 0; k < total_clusters; k++) {
      FractalPoint cluster_points[];
      double filtered_sum_y = 0;
      
      for(int i = 0; i < f_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points);
            ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = fractals[i];
            filtered_sum_y += fractals[i].norm_y;
         }
      }
      
      int filtered_count = ArraySize(cluster_points);
      if(filtered_count >= 3) {
         FractalPoint hull[];
         GetConvexHull(cluster_points, hull);
         
         double final_center_y = filtered_sum_y / filtered_count;
         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         
         double highest_price = -99999999;
         double lowest_price = 99999999;
         
         for(int h = 0; h < ArraySize(hull); h++) {
            if(hull[h].price > highest_price) highest_price = hull[h].price;
            if(hull[h].price < lowest_price) lowest_price = hull[h].price;
         }
         
         int sz = ArraySize(all_clusters);
         ArrayResize(all_clusters, sz+1);
         all_clusters[sz].centroid = real_centroid_price;
         all_clusters[sz].high = highest_price;
         all_clusters[sz].low = lowest_price;
         all_clusters[sz].distance = MathAbs(real_centroid_price - current_close);
      }
   }

   // Sort clusters by distance to current price
   int c_count = ArraySize(all_clusters);
   for(int i=0; i<c_count-1; i++) {
      for(int j=0; j<c_count-i-1; j++) {
         if(all_clusters[j].distance > all_clusters[j+1].distance) {
            ClusterExportData temp = all_clusters[j];
            all_clusters[j] = all_clusters[j+1];
            all_clusters[j+1] = temp;
         }
      }
   }

   // Extract Top 3
   int limit = MathMin(3, c_count);
   for(int i=0; i<limit; i++) {
      top3[i] = all_clusters[i];
   }
}

//+------------------------------------------------------------------+
//| Main Clustering Sequence (Current Bar & Drawing)                 |
//+------------------------------------------------------------------+
void PerformClustering(const int rates_total, const datetime &time[])
  {
   ObjectsDeleteAll(0, "ClusterHull_"); 
   ObjectsDeleteAll(0, "ClusterCentroid_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_");
   ObjectsDeleteAll(0, "ClusterResist_");
   ObjectsDeleteAll(0, "ClusterSupport_");

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
   if(f_count < InpMinPts) return;

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

   // 3. Execute DBSCAN
   int assignments[];
   int total_clusters = RunDBSCAN(fractals, f_count, InpEpsilon, InpMinPts, assignments);

   double current_close = iClose(Symbol(), PERIOD_CURRENT, 0);
   ClusterExportData current_state_clusters[];

   // 4. Draw Bounding Polygon, Centroid Line, and S/R Lines
   for(int k = 0; k < total_clusters; k++) {
      FractalPoint cluster_points[];
      double filtered_sum_x = 0;
      double filtered_sum_y = 0;
      
      for(int i = 0; i < f_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points);
            ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = fractals[i];
            filtered_sum_x += fractals[i].norm_x;
            filtered_sum_y += fractals[i].norm_y;
         }
      }
      
      int filtered_count = ArraySize(cluster_points);
      if(filtered_count >= 3) {
         FractalPoint hull[];
         GetConvexHull(cluster_points, hull);
         
         int h_count = ArraySize(hull);
         color c_color = GetClusterColor(k);
         
         double final_center_x = filtered_sum_x / filtered_count;
         double final_center_y = filtered_sum_y / filtered_count;
         
         double highest_price = -99999999;
         double lowest_price = 99999999;
         datetime highest_time = 0;
         datetime lowest_time = 0;
         
         for(int h = 0; h < h_count; h++) {
            FractalPoint p1 = hull[h];
            FractalPoint p2 = hull[(h + 1) % h_count]; 
            
            if(p1.price > highest_price) { highest_price = p1.price; highest_time = p1.time; }
            if(p1.price < lowest_price) { lowest_price = p1.price; lowest_time = p1.time; }

            string line_name = "ClusterHull_" + IntegerToString(k) + "_" + IntegerToString(h);
            ObjectCreate(0, line_name, OBJ_TREND, 0, p1.time, p1.price, p2.time, p2.price);
            ObjectSetInteger(0, line_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, line_name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, line_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, line_name, OBJPROP_RAY_RIGHT, false);
            ObjectSetInteger(0, line_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, line_name, OBJPROP_SELECTABLE, false);
         }
         
         if(highest_time != 0) {
            string resist_name = "ClusterResist_" + IntegerToString(k);
            ObjectCreate(0, resist_name, OBJ_TREND, 0, highest_time, highest_price, time[0], highest_price);
            ObjectSetInteger(0, resist_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, resist_name, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, resist_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, resist_name, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, resist_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, resist_name, OBJPROP_SELECTABLE, false);
         }

         if(lowest_time != 0) {
            string support_name = "ClusterSupport_" + IntegerToString(k);
            ObjectCreate(0, support_name, OBJ_TREND, 0, lowest_time, lowest_price, time[0], lowest_price);
            ObjectSetInteger(0, support_name, OBJPROP_COLOR, c_color);
            ObjectSetInteger(0, support_name, OBJPROP_WIDTH, 1);
            ObjectSetInteger(0, support_name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, support_name, OBJPROP_RAY_RIGHT, true);
            ObjectSetInteger(0, support_name, OBJPROP_BACK, true);
            ObjectSetInteger(0, support_name, OBJPROP_SELECTABLE, false);
         }

         double real_centroid_price = final_center_y * (max_price - min_price) + min_price;
         int real_centroid_bar = (int)MathRound(final_center_x * (max_bar - min_bar) + min_bar);
         
         int time_index = rates_total - 1 - real_centroid_bar;
         if(time_index < 0) time_index = 0;
         // Ensure time_index stays within the valid bounds of the dynamically passed time array
         if(time_index >= ArraySize(time)) time_index = ArraySize(time) - 1; 
         
         datetime centroid_time = time[time_index];

         string cent_name = "ClusterCentroid_" + IntegerToString(k);
         ObjectCreate(0, cent_name, OBJ_TREND, 0, centroid_time, real_centroid_price, time[0], real_centroid_price);
         ObjectSetInteger(0, cent_name, OBJPROP_COLOR, c_color);
         ObjectSetInteger(0, cent_name, OBJPROP_WIDTH, 1);
         ObjectSetInteger(0, cent_name, OBJPROP_STYLE, STYLE_DASH);
         ObjectSetInteger(0, cent_name, OBJPROP_RAY_RIGHT, true);
         ObjectSetInteger(0, cent_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, cent_name, OBJPROP_SELECTABLE, false);

         string star_name = "ClusterCentroidStar_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings");
         ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(171));
         ObjectSetInteger(0, star_name, OBJPROP_FONTSIZE, 14);
         ObjectSetInteger(0, star_name, OBJPROP_ANCHOR, ANCHOR_CENTER);
         ObjectSetInteger(0, star_name, OBJPROP_COLOR, c_color);
         ObjectSetInteger(0, star_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, star_name, OBJPROP_SELECTABLE, false);

         // Add to current export data collection
         int sz = ArraySize(current_state_clusters);
         ArrayResize(current_state_clusters, sz+1);
         current_state_clusters[sz].centroid = real_centroid_price;
         current_state_clusters[sz].high = highest_price;
         current_state_clusters[sz].low = lowest_price;
         current_state_clusters[sz].distance = MathAbs(real_centroid_price - current_close);
      }
   }

   // 5. Sort to find top 3 clusters for export
   int c_count = ArraySize(current_state_clusters);
   for(int i=0; i<c_count-1; i++) {
      for(int j=0; j<c_count-i-1; j++) {
         if(current_state_clusters[j].distance > current_state_clusters[j+1].distance) {
            ClusterExportData temp = current_state_clusters[j];
            current_state_clusters[j] = current_state_clusters[j+1];
            current_state_clusters[j+1] = temp;
         }
      }
   }
   
   for(int i=0; i<3; i++) {
      if(i < c_count) {
         g_current_top3[i] = current_state_clusters[i];
      } else {
         g_current_top3[i].centroid = 0; g_current_top3[i].high = 0; g_current_top3[i].low = 0; g_current_top3[i].distance = 999999;
      }
   }
  }

//+------------------------------------------------------------------+
//| Export Logic (Single Bar)                                        |
//+------------------------------------------------------------------+
bool ExportClusterToTxt() {
   string symbol = Symbol();
   ENUM_TIMEFRAMES timeframe = Period();
   string filename = GenerateFilename(InpBaseFileName, symbol, timeframe);
   
   bool file_exists = FileIsExist(filename);
   ResetLastError();
   int file_handle;

   if(file_exists) {
      file_handle = FileOpen(filename, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
      if(file_handle != INVALID_HANDLE) FileSeek(file_handle, 0, SEEK_END);
   } else {
      file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
      ExportRowNumber = 0;
   }

   if(file_handle == INVALID_HANDLE) {
      Print("ERROR: Failed to open TXT file for writing.");
      return false;
   }

   if(!file_exists) {
      string header = "timestamp\tsymbol\ttimeframe\tclose\t";
      header += "centroid_1\tcentroid_2\tcentroid_3\t";
      header += "high_1\thigh_2\thigh_3\t";
      header += "low_1\tlow_2\tlow_3\r\n";
      FileWriteString(file_handle, header);
   }

   ExportRowNumber++;
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   datetime current_time = iTime(symbol, timeframe, 0);
   long unix_ts = (long)(current_time - gmt_offset);
   double currentClose = iClose(symbol, timeframe, 0);
   
   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");

   string c1 = (g_current_top3[0].centroid == 0) ? "" : DoubleToString(g_current_top3[0].centroid, Digits());
   string c2 = (g_current_top3[1].centroid == 0) ? "" : DoubleToString(g_current_top3[1].centroid, Digits());
   string c3 = (g_current_top3[2].centroid == 0) ? "" : DoubleToString(g_current_top3[2].centroid, Digits());

   string h1 = (g_current_top3[0].high == 0) ? "" : DoubleToString(g_current_top3[0].high, Digits());
   string h2 = (g_current_top3[1].high == 0) ? "" : DoubleToString(g_current_top3[1].high, Digits());
   string h3 = (g_current_top3[2].high == 0) ? "" : DoubleToString(g_current_top3[2].high, Digits());

   string l1 = (g_current_top3[0].low == 0) ? "" : DoubleToString(g_current_top3[0].low, Digits());
   string l2 = (g_current_top3[1].low == 0) ? "" : DoubleToString(g_current_top3[1].low, Digits());
   string l3 = (g_current_top3[2].low == 0) ? "" : DoubleToString(g_current_top3[2].low, Digits());

   string data_row = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\r\n",
                                   unix_ts, symbol, tf_str, DoubleToString(currentClose, Digits()),
                                   c1, c2, c3, h1, h2, h3, l1, l2, l3);
                                   
   FileWriteString(file_handle, data_row);
   FileClose(file_handle);

   Print("Clusters successfully exported to TXT file: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Export Logic (Backfill Multiple Bars)                            |
//+------------------------------------------------------------------+
bool BackfillExportCluster() {
   string symbol = Symbol();
   ENUM_TIMEFRAMES timeframe = Period();
   string filename = GenerateFilename(InpBaseFileName, symbol, timeframe);
   
   Print("Starting backfill export for ", InpBackfillBars, " bars...");
   FileDelete(filename);
   
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file_handle == INVALID_HANDLE) {
      Print("ERROR: Failed to create TXT file for backfill.");
      return false;
   }

   string header = "timestamp\tsymbol\ttimeframe\tclose\t";
   header += "centroid_1\tcentroid_2\tcentroid_3\t";
   header += "high_1\thigh_2\thigh_3\t";
   header += "low_1\tlow_2\tlow_3\r\n";
   FileWriteString(file_handle, header);

   string tf_str = EnumToString(timeframe);
   StringReplace(tf_str, "PERIOD_", "");

   int available_bars = iBars(symbol, timeframe);
   int bars_to_export = MathMin(InpBackfillBars, available_bars - 1);
   
   int exported_count = 0;
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   int rates_total = available_bars;

   for(int shift = bars_to_export; shift >= 1; shift--) {
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      if(CopyRates(symbol, timeframe, shift, 1, rates) <= 0) continue;

      datetime bar_time = rates[0].time;
      double bar_close = rates[0].close;
      long unix_ts = (long)(bar_time - gmt_offset);

      ClusterExportData top3[];
      GetClustersForShift(shift, rates_total, bar_close, top3);

      string c1 = (top3[0].centroid == 0) ? "" : DoubleToString(top3[0].centroid, Digits());
      string c2 = (top3[1].centroid == 0) ? "" : DoubleToString(top3[1].centroid, Digits());
      string c3 = (top3[2].centroid == 0) ? "" : DoubleToString(top3[2].centroid, Digits());

      string h1 = (top3[0].high == 0) ? "" : DoubleToString(top3[0].high, Digits());
      string h2 = (top3[1].high == 0) ? "" : DoubleToString(top3[1].high, Digits());
      string h3 = (top3[2].high == 0) ? "" : DoubleToString(top3[2].high, Digits());

      string l1 = (top3[0].low == 0) ? "" : DoubleToString(top3[0].low, Digits());
      string l2 = (top3[1].low == 0) ? "" : DoubleToString(top3[1].low, Digits());
      string l3 = (top3[2].low == 0) ? "" : DoubleToString(top3[2].low, Digits());

      string data_row = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\r\n",
                                      unix_ts, symbol, tf_str, DoubleToString(bar_close, Digits()),
                                      c1, c2, c3, h1, h2, h3, l1, l2, l3);
                                      
      FileWriteString(file_handle, data_row);
      exported_count++;
      
      if(exported_count % 100 == 0) Print("Backfill progress: ", exported_count, "/", bars_to_export);
   }

   FileClose(file_handle);
   ExportRowNumber = exported_count;
   Print("Backfill export completed successfully! File: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Chart Event Handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
   if(id == CHARTEVENT_OBJECT_CLICK) {
      if(sparam == EXPORT_BUTTON_NAME) {
         if(ExportClusterToTxt()) Print("SUCCESS: Clusters exported successfully.");
         else Print("ERROR: Failed to export clusters.");
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
      else if(sparam == BACKFILL_BUTTON_NAME) {
         Print("Starting backfill export... This may take a few moments.");
         if(BackfillExportCluster()) Print("SUCCESS: Backfill export completed.");
         else Print("ERROR: Failed to backfill export.");
         ObjectSetInteger(0, BACKFILL_BUTTON_NAME, OBJPROP_STATE, false);
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