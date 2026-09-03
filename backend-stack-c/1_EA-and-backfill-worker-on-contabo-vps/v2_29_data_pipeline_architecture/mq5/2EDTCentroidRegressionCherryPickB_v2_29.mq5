//+------------------------------------------------------------------+
//|                             SSA_Centroid_Regression_EDT_B.mq5    |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "3.896_1"
#property description "DavinTrade V3.896_1_B: Cherry-Pick Centroid Exclusion"
#property indicator_chart_window

// Total Buffers: 10 Plots + 1 Hidden Cluster + 14 Stats + 12 Centroids = 37 Buffers
#property indicator_buffers 37
#property indicator_plots   10

#include <Math/Alglib/alglib.mqh>

// CHANGED: Unique button name to prevent clicks triggering both indicators
#define EXPORT_BUTTON_NAME "V3896_1_B_ExportButton" 

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
input string               Sep0 = "===== Main & SSA Settings =====";
input int                  InpSSAMathLookback = 3000;
input int                  SSAWindow         = 30;
input int                  SSARank           = 6;
input int                  SSASignalPeriod   = 3;
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
input bool              InpShowComments = false;
input int               InpRegCentroids = 6;
// Centroids IN USE
input string            InpExcludedCentroids = "";
// Excluded centroids (e.g. "1,3,5")
input int               InpEDTVisualLookback = 500;
input bool              InpExtendLinesToCurrent = true;
input int               LOEDTInpEDTMinTouches = 2;
input int               UOEDTInpEDTMinTouches = 2;
input color             InpBaseLineColor = clrTurquoise;
input color             InpEDTColor = clrBlue;
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 0.25;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;
input string            Sep6 = "===== Export & Timer Settings =====";
// CHANGED: Default file name to avoid overwrite collision
input string            InpExportFileName = "Cherry-Pick-B"; 
input bool              InpAutoExport = true;
input int               InpExportSecond = 59;
//--- INDICATOR BUFFERS ---
double ExtSSATrend[];      // 0
double ExtSSASignal[];     // 1
double ExtSSACross[];      // 2
double ExtUpper108[];      // 3
double ExtLower108[];      // 4
double ExtUpper119[];      // 5
double ExtLower119[];      // 6
double ExtBaseLine[];      // 7
double ExtUOEDT[];         // 8
double ExtLOEDT[];         // 9

//--- HIDDEN BUFFERS FOR EA PIPELINE ---
double ExtCrossInCluster[]; // 10

// Structural Data
double ExtTimeframe[];      // 11
double ExtSlope[];          // 12
double ExtIntercept[];      // 13
double ExtAngle[];          // 14

// Model A: Crossings
double ExtRSquare_Cross[];  // 15
double ExtMSE_Cross[];      // 16
double ExtVarRatio_Cross[]; // 17
double ExtSkewness_Cross[]; // 18
double ExtKurtosis_Cross[]; // 19

// Model B: Close Price
double ExtRSquare_Close[];  // 20
double ExtMSE_Close[];      // 21
double ExtVarRatio_Close[]; // 22
double ExtSkewness_Close[]; // 23
double ExtKurtosis_Close[]; // 24

// EA Centroid Streaming
double ExtCen0[], ExtCen1[], ExtCen2[], ExtCen3[], ExtCen4[], ExtCen5[];
double ExtCen6[], ExtCen7[], ExtCen8[], ExtCen9[], ExtCen10[], ExtCen11[]; // 25-36

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

// Excluded indices parsed from string
int      g_excluded_indices[];
// Export state globals
int g_stat_centroids = 0;
int g_stat_math_window = 0;
int g_stat_visual_window = 0;
int g_stat_obs_window = 0;
int g_stat_n_crossings = 0;
int g_stat_n_close = 0;
int g_stat_leftmost_bar = 0;
double g_cen_prices[12];
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

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   ExtSideBars = ((int)InpFractalBars - 1) / 2;
   ExtSideBars119 = ((int)InpFractalBars119 - 1) / 2;
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);
   
   ParseExclusions(); // Parse string to array on init
   
   SetIndexBuffer(0, ExtSSATrend, INDICATOR_DATA);
   SetIndexBuffer(1, ExtSSASignal, INDICATOR_DATA);
   SetIndexBuffer(2, ExtSSACross, INDICATOR_DATA);
   SetIndexBuffer(3, ExtUpper108, INDICATOR_DATA);
   SetIndexBuffer(4, ExtLower108, INDICATOR_DATA);
   SetIndexBuffer(5, ExtUpper119, INDICATOR_DATA);
   SetIndexBuffer(6, ExtLower119, INDICATOR_DATA);
   SetIndexBuffer(7, ExtBaseLine, INDICATOR_DATA);
   SetIndexBuffer(8, ExtUOEDT, INDICATOR_DATA); 
   SetIndexBuffer(9, ExtLOEDT, INDICATOR_DATA);
   
   SetIndexBuffer(10, ExtCrossInCluster, INDICATOR_CALCULATIONS);
   SetIndexBuffer(11, ExtTimeframe, INDICATOR_DATA);
   SetIndexBuffer(12, ExtSlope, INDICATOR_DATA);
   SetIndexBuffer(13, ExtIntercept, INDICATOR_DATA);
   SetIndexBuffer(14, ExtAngle, INDICATOR_DATA);
   SetIndexBuffer(15, ExtRSquare_Cross, INDICATOR_DATA);
   SetIndexBuffer(16, ExtMSE_Cross, INDICATOR_DATA);
   SetIndexBuffer(17, ExtVarRatio_Cross, INDICATOR_DATA);
   SetIndexBuffer(18, ExtSkewness_Cross, INDICATOR_DATA);
   SetIndexBuffer(19, ExtKurtosis_Cross, INDICATOR_DATA);
   SetIndexBuffer(20, ExtRSquare_Close, INDICATOR_DATA);
   SetIndexBuffer(21, ExtMSE_Close, INDICATOR_DATA);
   SetIndexBuffer(22, ExtVarRatio_Close, INDICATOR_DATA);
   SetIndexBuffer(23, ExtSkewness_Close, INDICATOR_DATA);
   SetIndexBuffer(24, ExtKurtosis_Close, INDICATOR_DATA);
   SetIndexBuffer(25, ExtCen0, INDICATOR_DATA); SetIndexBuffer(26, ExtCen1, INDICATOR_DATA);
   SetIndexBuffer(27, ExtCen2, INDICATOR_DATA); SetIndexBuffer(28, ExtCen3, INDICATOR_DATA);
   SetIndexBuffer(29, ExtCen4, INDICATOR_DATA); SetIndexBuffer(30, ExtCen5, INDICATOR_DATA);
   SetIndexBuffer(31, ExtCen6, INDICATOR_DATA); SetIndexBuffer(32, ExtCen7, INDICATOR_DATA);
   SetIndexBuffer(33, ExtCen8, INDICATOR_DATA); SetIndexBuffer(34, ExtCen9, INDICATOR_DATA);
   SetIndexBuffer(35, ExtCen10, INDICATOR_DATA); SetIndexBuffer(36, ExtCen11, INDICATOR_DATA);
   for(int i = 11; i <= 36; i++) PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrMagenta); PlotIndexSetInteger(0, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrBlue); PlotIndexSetInteger(1, PLOT_LINE_STYLE, STYLE_DASH); PlotIndexSetInteger(1, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(2, PLOT_ARROW, 171);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrBlack); PlotIndexSetInteger(2, PLOT_LINE_WIDTH, 2);
   
   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(3, PLOT_ARROW, 108);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetInteger(3, PLOT_ARROW_SHIFT, -InpSymbolOffset);
   
   PlotIndexSetInteger(4, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(4, PLOT_ARROW, 108); PlotIndexSetInteger(4, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(4, PLOT_LINE_WIDTH, (int)InpSymbolSize); PlotIndexSetInteger(4, PLOT_ARROW_SHIFT, InpSymbolOffset);
   PlotIndexSetInteger(5, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(5, PLOT_ARROW, 119); PlotIndexSetInteger(5, PLOT_LINE_COLOR, clrRed);
   PlotIndexSetInteger(5, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(5, PLOT_ARROW_SHIFT, -InpSymbolOffset119);
   PlotIndexSetInteger(6, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(6, PLOT_ARROW, 119); PlotIndexSetInteger(6, PLOT_LINE_COLOR, clrLimeGreen);
   PlotIndexSetInteger(6, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(6, PLOT_ARROW_SHIFT, InpSymbolOffset119);
   PlotIndexSetInteger(7, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(7, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(7, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpBaseLineColor);
   PlotIndexSetString(7, PLOT_LABEL, "Regression Base Line");
   
   PlotIndexSetInteger(8, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(8, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(8, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(8, PLOT_LINE_COLOR, InpEDTColor);
   PlotIndexSetString(8, PLOT_LABEL, "Upper Outermost EDT");
   
   PlotIndexSetInteger(9, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(9, PLOT_LINE_STYLE, STYLE_SOLID);
   PlotIndexSetInteger(9, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(9, PLOT_LINE_COLOR, InpEDTColor);
   PlotIndexSetString(9, PLOT_LABEL, "Lower Outermost EDT");
   
   for(int i=0; i<10; i++) PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   
   // CHANGED: Shortname to differentiate instances
   IndicatorSetString(INDICATOR_SHORTNAME, "DavinTrade SSA EDT V3.896_1_B");
   CreateExportButton();
   
   if(InpAutoExport) EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

void ParseExclusions()
{
   ArrayResize(g_excluded_indices, 0);
   if(StringLen(InpExcludedCentroids) == 0) return;
   string sep = ",";
   ushort u_sep = StringGetCharacter(sep, 0);
   string result[];
   int count = StringSplit(InpExcludedCentroids, u_sep, result);
   for(int i=0; i<count; i++) {
      StringTrimLeft(result[i]); 
      StringTrimRight(result[i]);
      int val = (int)StringToInteger(result[i]);
      if(val > 0) {
         int sz = ArraySize(g_excluded_indices);
         ArrayResize(g_excluded_indices, sz + 1);
         // CRITICAL: Convert human 1-based indexing (e.g. "1") 
         // into programmatic 0-based indexing (e.g. 0) for the math loops
         g_excluded_indices[sz] = val - 1;
      }
   }
}

void OnDeinit(const int reason)
{
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   
   // CHANGED: Deleting unique objects for this instance
   ObjectsDeleteAll(0, "ClusterHull_V896_1_B_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_V896_1_B_");
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   if(InpShowComments) Comment("");
   if(InpAutoExport) EventKillTimer();
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Timer Event for Manual Data Safety                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!InpAutoExport) return;
   MqlDateTime time_struct;
   TimeToStruct(TimeLocal(), time_struct);
   static int last_trigger_min = -1;
   if(time_struct.sec == InpExportSecond && time_struct.min != last_trigger_min) {
       last_trigger_min = time_struct.min;
       if(g_rates_total > 0) {
           PerformClusteringAndEDT(g_rates_total, g_time, g_close);
           ChartRedraw(0);
           ExportData(true);
       }
   }
}

//+------------------------------------------------------------------+
//| Helpers                                                          |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES timeframe)
{
   switch(timeframe) {
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
      default: { string s = EnumToString(timeframe); StringReplace(s, "PERIOD_", ""); return s;
      }
   }
}

void CreateExportButton()
{
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
   
   // Note: You may want to modify this Y distance physically on the chart or here in code 
   // (e.g. 140) if it overlaps with the 'A' version button!
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 140); 
   
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 160);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "ChrPic-B"); // Visual update
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ChartRedraw(0);
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME) {
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      PerformClusteringAndEDT(g_rates_total, g_time, g_close); 
      ExportData(false);
      ChartRedraw(0);
   }
}

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
      case 0: return InpClusterColor0;
      case 1: return InpClusterColor1;
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
   if(n < 3) { ArrayCopy(hull, points); return;
   }
   int hull_count = 0; int l = 0;
   for(int i = 1; i < n; i++) if(points[i].norm_x < points[l].norm_x) l = i;

   int p = l, q;
   int safety_net = 0;
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
   double centers_x[]; ArrayResize(centers_x, K);
   double centers_y[]; ArrayResize(centers_y, K);

   for(int k=0; k<K; k++) {
      int rand_idx = k * (f_count / K);
      if(rand_idx >= f_count) rand_idx = f_count - 1;
      centers_x[k] = data[rand_idx].norm_x; centers_y[k] = data[rand_idx].norm_y;
   }

   bool changed = true; int iterations = 0;
   while(changed && iterations < 100 && !IsStopped()) {
      changed = false; iterations++;
      for(int i=0; i<f_count; i++) {
         double min_dist = 99999999;
         int best_k = 0;
         for(int k=0; k<K; k++) {
            double dist = MathSqrt(MathPow(data[i].norm_x - centers_x[k], 2) + MathPow(data[i].norm_y - centers_y[k], 2));
            if(dist < min_dist) { min_dist = dist; best_k = k;
            }
         }
         if(assignments[i] != best_k) { assignments[i] = best_k;
         changed = true; }
      }

      int counts[]; ArrayResize(counts, K);
      ArrayInitialize(counts, 0);
      double sum_x[]; ArrayResize(sum_x, K); ArrayInitialize(sum_x, 0.0);
      double sum_y[]; ArrayResize(sum_y, K); ArrayInitialize(sum_y, 0.0);
      for(int i=0; i<f_count; i++) {
         int k = assignments[i]; sum_x[k] += data[i].norm_x;
         sum_y[k] += data[i].norm_y; counts[k]++;
      }
      for(int k=0; k<K; k++) {
         if(counts[k] > 0) { centers_x[k] = sum_x[k] / counts[k];
         centers_y[k] = sum_y[k] / counts[k]; }
      }
   }
}

void RegionQuery(const ClusterPoint &data[], int p_idx, double eps, int &neighbors[]) {
   ArrayResize(neighbors, 0);
   for(int i=0; i<ArraySize(data); i++) {
      double dist = MathSqrt(MathPow(data[p_idx].norm_x - data[i].norm_x, 2) + MathPow(data[p_idx].norm_y - data[i].norm_y, 2));
      if(dist <= eps) {
         int sz = ArraySize(neighbors); ArrayResize(neighbors, sz+1);
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
         visited[n_idx] = true; int n_neighbors[]; RegionQuery(data, n_idx, eps, n_neighbors);
         if(ArraySize(n_neighbors) >= min_pts) {
            for(int k=0; k<ArraySize(n_neighbors); k++) {
               int candidate = n_neighbors[k];
               bool exists = false;
               for(int j=0; j<ArraySize(neighbors); j++) { if(neighbors[j] == candidate) { exists = true; break;
               } }
               if(!exists) { int sz = ArraySize(neighbors);
               ArrayResize(neighbors, sz+1); neighbors[sz] = candidate; }
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
      visited[i] = true;
      int neighbors[]; RegionQuery(data, i, eps, neighbors);
      if(ArraySize(neighbors) >= min_pts) {
         ExpandCluster(data, i, neighbors, cluster_id, eps, min_pts, visited, assignments);
         cluster_id++;
      }
   }
   return cluster_id; 
}


//+------------------------------------------------------------------+
//| Core: Clustering -> Cherry-Pick Math -> Dual Pipeline Math -> EDT|
//+------------------------------------------------------------------+
void PerformClusteringAndEDT(const int rates_total, const datetime &time[], const double &close_arr[])
{
   // CHANGED: Deleting unique objects for this instance
   ObjectsDeleteAll(0, "ClusterHull_V896_1_B_"); 
   ObjectsDeleteAll(0, "ClusterCentroidStar_V896_1_B_");
   ArrayInitialize(ExtCrossInCluster, 0.0);
   ArrayInitialize(ExtBaseLine, EMPTY_VALUE);
   ArrayInitialize(g_cen_prices, 0.0);
   
   int startIdx = (rates_total > InpSSAMathLookback) ? rates_total - InpSSAMathLookback : 0;
   
   ClusterPoint points[];
   for(int i = startIdx; i < rates_total; i++) {
      if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
         int sz = ArraySize(points);
         ArrayResize(points, sz + 1);
         points[sz].bar = i; points[sz].time = time[i]; points[sz].price = ExtSSACross[i];
      }
   }

   int p_count = ArraySize(points);
   if(p_count < InpMinPts) {
      if(InpShowComments) Comment("--- DavinTrade V3.896_1_B ---\nAwaiting more data: Points < MinPts");
      return;
   }

   double min_bar = 99999999, max_bar = -1, min_price = 99999999, max_price = -1;
   for(int i = 0; i < p_count; i++) {
      if(points[i].bar < min_bar) min_bar = points[i].bar;
      if(points[i].bar > max_bar) max_bar = points[i].bar;
      if(points[i].price < min_price) min_price = points[i].price; if(points[i].price > max_price) max_price = points[i].price;
   }
   if(max_bar == min_bar) max_bar += 1; if(max_price == min_price) max_price += 0.00001;
   for(int i = 0; i < p_count; i++) {
      points[i].norm_x = (points[i].bar - min_bar) / (max_bar - min_bar);
      points[i].norm_y = (points[i].price - min_price) / (max_price - min_price);
   }

   int assignments[]; int total_clusters = 0;
   if(InpAlgo == ALGO_KMEANS) {
      total_clusters = (int)MathMax(2, p_count / InpPointsPerCluster);
      CustomKMeans(points, p_count, total_clusters, assignments);
      for(int k=0; k<total_clusters; k++) {
         double sum_x=0, sum_y=0; int pt_count=0;
         for(int i=0; i<p_count; i++) { if(assignments[i] == k) { sum_x += points[i].norm_x; sum_y += points[i].norm_y; pt_count++;
         } }
         if(pt_count < InpMinPts) { for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
         continue; }
         
         double center_x = sum_x / pt_count, center_y = sum_y / pt_count, total_dist = 0.0;
         for(int i=0; i<p_count; i++) { if(assignments[i] == k) total_dist += MathSqrt(MathPow(points[i].norm_x - center_x, 2) + MathPow(points[i].norm_y - center_y, 2));
         }
         if((total_dist / pt_count) > InpMaxAvgDistance) { for(int i=0; i<p_count; i++) if(assignments[i] == k) assignments[i] = -1;
         }
      }
   } else if (InpAlgo == ALGO_DBSCAN) {
      total_clusters = RunDBSCAN(points, p_count, InpEpsilon, InpMinPts, assignments);
   }
   
   for(int i = 0; i < p_count; i++) { if(assignments[i] != -1) ExtCrossInCluster[points[i].bar] = 1.0;
   }
   
   ClusterCentroidInfo centroids[]; int centroid_count = 0;
   for(int k = 0; k < total_clusters; k++) {
      ClusterPoint cluster_points[];
      double sum_x = 0, sum_y = 0;
      for(int i = 0; i < p_count; i++) {
         if(assignments[i] == k) {
            int sz = ArraySize(cluster_points);
            ArrayResize(cluster_points, sz + 1);
            cluster_points[sz] = points[i]; sum_x += points[i].norm_x; sum_y += points[i].norm_y;
         }
      }
      
      int filtered_count = ArraySize(cluster_points);
      if(filtered_count >= 3) { 
         ClusterPoint hull[]; GetConvexHull(cluster_points, hull);
         int h_count = ArraySize(hull); color c_color = GetClusterColor(k);
         
         for(int h = 0; h < h_count; h++) {
            ClusterPoint p1 = hull[h], p2 = hull[(h + 1) % h_count];
            // CHANGED: Unique prefix
            string line_name = "ClusterHull_V896_1_B_" + IntegerToString(k) + "_" + IntegerToString(h);
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
         
         // CHANGED: Unique prefix
         string star_name = "ClusterCentroidStar_V896_1_B_" + IntegerToString(k);
         ObjectCreate(0, star_name, OBJ_TEXT, 0, centroid_time, real_centroid_price);
         ObjectSetString(0, star_name, OBJPROP_FONT, "Wingdings");
         ObjectSetString(0, star_name, OBJPROP_TEXT, ShortToString(108));
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

   // Sort centroids from newest to oldest
   for(int i = 0; i < centroid_count - 1; i++) {
      for(int j = 0; j < centroid_count - i - 1; j++) {
         if(centroids[j].bar_index < centroids[j+1].bar_index) {
            ClusterCentroidInfo temp = centroids[j];
            centroids[j] = centroids[j+1];
            centroids[j+1] = temp;
         }
      }
   }

   // --- CHERRY-PICK LOGIC START ---
   int user_target_reg = (int)MathMax(3, MathMin(InpRegCentroids, 12));
   int valid_centroid_indices[]; 
   int valid_count = 0;
   int chrono_idx = 0;
   // Keep pulling centroids until we hit the user's requested number 
   // (skipping any that exist in the excluded string array)
   while(valid_count < user_target_reg && chrono_idx < centroid_count) {
       bool is_excluded = false;
       for(int e = 0; e < ArraySize(g_excluded_indices); e++) {
           if(g_excluded_indices[e] == chrono_idx) { is_excluded = true;
           break; }
       }
       
       if(!is_excluded) {
           int sz = ArraySize(valid_centroid_indices);
           ArrayResize(valid_centroid_indices, sz + 1);
           valid_centroid_indices[sz] = chrono_idx;
           valid_count++;
       }
       chrono_idx++;
   }
   
   // Failsafe: Did we find enough valid centroids after skipping the excluded ones?
   if (valid_count < user_target_reg) {
       if(InpShowComments) Comment(StringFormat("--- DavinTrade V3.896_1_B ---\nMath Aborted: Not enough valid centroids (%d found, %d needed) after exclusions.", valid_count, user_target_reg));
       return; 
   }

   // Feed the array for exporting.
   // Notice we iterate through ALL chronological indices up to the furthest one we touched.
   // By only assigning the valid ones, the excluded spots inherently remain 0.0 (blank in output).
   for(int c = 0; c < MathMin(12, chrono_idx); c++) {
       bool is_excluded = false;
       for(int e = 0; e < ArraySize(g_excluded_indices); e++) {
           if(g_excluded_indices[e] == c) { is_excluded = true;
           break; }
       }
       if(!is_excluded) {
           g_cen_prices[c] = centroids[c].price;
       }
   }

   // Math Calculation utilizing only our valid cherry-picked centroids
   double meanX = 0, meanY = 0;
   for(int i = 0; i < valid_count; i++) {
      meanX += centroids[valid_centroid_indices[i]].bar_index;
      meanY += centroids[valid_centroid_indices[i]].price;
   }
   meanX /= valid_count;
   meanY /= valid_count;
   
   double num = 0, den = 0;
   for(int i = 0; i < valid_count; i++) {
      double dx = centroids[valid_centroid_indices[i]].bar_index - meanX;
      double dy = centroids[valid_centroid_indices[i]].price - meanY;
      num += dx * dy;
      den += dx * dx;
   }

   double base_m = 0, base_c = 0;
   if(den != 0) {
      base_m = num / den;
      base_c = meanY - base_m * meanX;
   } else {
      base_m = 0;
      base_c = meanY; 
   }
   // --- CHERRY-PICK LOGIC END ---

   int leftmost_bar = rates_total;
   int rightmost_bar = -1;
   
   // Bind observation window to the outermost used clusters
   int oldest_cluster_id = centroids[valid_centroid_indices[valid_count - 1]].cluster_id;
   int newest_cluster_id = centroids[valid_centroid_indices[0]].cluster_id;
   for(int i = 0; i < p_count; i++) {
      if(assignments[i] == oldest_cluster_id && points[i].bar < leftmost_bar) leftmost_bar = points[i].bar;
      if(assignments[i] == newest_cluster_id && points[i].bar > rightmost_bar) rightmost_bar = points[i].bar;
   }
   
   double mse_cross = 0, r2_cross = 0, skew_cross = 0, kurt_cross = 0, var_cross = 1.0;
   double mse_close = 0, r2_close = 0, skew_close = 0, kurt_close = 0, var_close = 1.0;
   double current_angle = 0.0;
   double current_intercept_anchored = base_m * (rates_total - 1) + base_c; 
   
   int n_crossings = 0;
   int n_close_bars = (rightmost_bar - leftmost_bar) + 1;
   
   if(leftmost_bar <= rightmost_bar && leftmost_bar != rates_total) {
      double sum_crossings = 0;
      double sum_close = 0;
      for(int i = leftmost_bar; i <= rightmost_bar; i++) {
          if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
             sum_crossings += ExtSSACross[i];
             n_crossings++;
          }
          sum_close += close_arr[i];
      }
      
      double mean_cross = (n_crossings > 0) ?
      (sum_crossings / n_crossings) : 0.0;
      double mean_close_price = (n_close_bars > 0) ? (sum_close / n_close_bars) : current_intercept_anchored;
      double slope_pct_per_bar = (base_m / mean_close_price) * 100.0;
      current_angle = MathArctan(slope_pct_per_bar * 100.0) * 180.0 / M_PI;
      if(n_crossings >= 3 && n_close_bars >= 3) {
          double res_cross[];
          ArrayResize(res_cross, n_crossings);
          double res_close[]; ArrayResize(res_close, n_close_bars);
          
          int rx = 0; double sum_e_cross = 0;
          int rc = 0;
          double sum_e_close = 0;
          
          for(int i = leftmost_bar; i <= rightmost_bar; i++) {
              double pred_y = base_m * i + base_c;
              if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
                 res_cross[rx] = ExtSSACross[i] - pred_y;
                 sum_e_cross += res_cross[rx]; rx++;
              }
              res_close[rc] = close_arr[i] - pred_y;
              sum_e_close += res_close[rc]; rc++;
          }
          
          double mean_e_cross = sum_e_cross / n_crossings;
          double mean_e_close = sum_e_close / n_close_bars;
          
          double m2_x = 0, var_x = 0, m3_x = 0, m4_x = 0, tot_sq_x = 0;
          double m2_c = 0, var_c = 0, m3_c = 0, m4_c = 0, tot_sq_c = 0;
          
          int rx_idx = 0;
          for(int i = leftmost_bar; i <= rightmost_bar; i++) {
              if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
                  double actual_val = ExtSSACross[i];
                  double err = res_cross[rx_idx];                  
                  double dev = err - mean_e_cross;            
                  
                  m2_x += MathPow(err, 2);                    
                  var_x += MathPow(dev, 2);
                  m3_x += MathPow(dev, 3); m4_x += MathPow(dev, 4);
                  tot_sq_x += MathPow(actual_val - mean_cross, 2); 
                  rx_idx++;
              }
              double actual_close = close_arr[i];
              int rc_idx = i - leftmost_bar;
              double err_c = res_close[rc_idx];
              double dev_c = err_c - mean_e_close;
              
              m2_c += MathPow(err_c, 2);
              var_c += MathPow(dev_c, 2); m3_c += MathPow(dev_c, 3); m4_c += MathPow(dev_c, 4);
              tot_sq_c += MathPow(actual_close - mean_close_price, 2);
          }
          
          m2_x /= n_crossings;
          var_x /= n_crossings; m3_x /= n_crossings; m4_x /= n_crossings;
          mse_cross = m2_x;
          if(tot_sq_x != 0) r2_cross = 1.0 - ((m2_x * n_crossings) / tot_sq_x);
          if(var_x > 0) { skew_cross = m3_x / MathPow(var_x, 1.5); kurt_cross = m4_x / MathPow(var_x, 2.0);
          }
          
          m2_c /= n_close_bars;
          var_c /= n_close_bars; m3_c /= n_close_bars; m4_c /= n_close_bars;
          mse_close = m2_c;
          if(tot_sq_c != 0) r2_close = 1.0 - ((m2_c * n_close_bars) / tot_sq_c);
          if(var_c > 0) { skew_close = m3_c / MathPow(var_c, 1.5); kurt_close = m4_c / MathPow(var_c, 2.0);
          }

          int half_x = n_crossings / 2;
          if(half_x > 1) {
              double mt1=0, mt2=0, vt1=0, vt2=0;
              for(int i=0; i<half_x; i++) mt1 += res_cross[i];
              for(int i=half_x; i<n_crossings; i++) mt2 += res_cross[i];
              mt1 /= half_x;
              mt2 /= (n_crossings - half_x);
              for(int i=0; i<half_x; i++) vt1 += MathPow(res_cross[i] - mt1, 2);
              for(int i=half_x; i<n_crossings; i++) vt2 += MathPow(res_cross[i] - mt2, 2);
              vt1 /= (half_x - 1);
              vt2 /= (n_crossings - half_x - 1);
              if(vt1 > 0) var_cross = vt2 / vt1;
          }
          
          int half_c = n_close_bars / 2;
          if(half_c > 1) {
              double mt1=0, mt2=0, vt1=0, vt2=0;
              for(int i=0; i<half_c; i++) mt1 += res_close[i];
              for(int i=half_c; i<n_close_bars; i++) mt2 += res_close[i];
              mt1 /= half_c;
              mt2 /= (n_close_bars - half_c);
              for(int i=0; i<half_c; i++) vt1 += MathPow(res_close[i] - mt1, 2);
              for(int i=half_c; i<n_close_bars; i++) vt2 += MathPow(res_close[i] - mt2, 2);
              vt1 /= (half_c - 1);
              vt2 /= (n_close_bars - half_c - 1);
              if(vt1 > 0) var_close = vt2 / vt1;
          }
      }
   }
   
   int current_bar_idx = rates_total - 1;
   ExtTimeframe[current_bar_idx] = PeriodSeconds(_Period);
   ExtSlope[current_bar_idx]     = base_m;
   ExtIntercept[current_bar_idx] = current_intercept_anchored; 
   ExtAngle[current_bar_idx]     = current_angle;
   ExtRSquare_Cross[current_bar_idx]  = r2_cross;
   ExtMSE_Cross[current_bar_idx]      = mse_cross;
   ExtVarRatio_Cross[current_bar_idx] = var_cross;
   ExtSkewness_Cross[current_bar_idx] = skew_cross;
   ExtKurtosis_Cross[current_bar_idx] = kurt_cross;
   
   ExtRSquare_Close[current_bar_idx]  = r2_close;
   ExtMSE_Close[current_bar_idx]      = mse_close;
   ExtVarRatio_Close[current_bar_idx] = var_close;
   ExtSkewness_Close[current_bar_idx] = skew_close;
   ExtKurtosis_Close[current_bar_idx] = kurt_close;

   ExtCen0[current_bar_idx] = g_cen_prices[0]; ExtCen1[current_bar_idx] = g_cen_prices[1];
   ExtCen2[current_bar_idx] = g_cen_prices[2]; ExtCen3[current_bar_idx] = g_cen_prices[3];
   ExtCen4[current_bar_idx] = g_cen_prices[4]; ExtCen5[current_bar_idx] = g_cen_prices[5];
   ExtCen6[current_bar_idx] = g_cen_prices[6]; ExtCen7[current_bar_idx] = g_cen_prices[7];
   ExtCen8[current_bar_idx] = g_cen_prices[8]; ExtCen9[current_bar_idx] = g_cen_prices[9];
   ExtCen10[current_bar_idx] = g_cen_prices[10]; ExtCen11[current_bar_idx] = g_cen_prices[11];

   int distance_to_leftmost = rates_total - leftmost_bar;
   int active_visual_lookback = InpEDTVisualLookback;
   string override_msg = "";
   if(active_visual_lookback < distance_to_leftmost) {
       active_visual_lookback = distance_to_leftmost;
       override_msg = " (Auto-Overridden to fit Centroids)";
   }
   
   g_stat_centroids = valid_count;
   g_stat_math_window = InpSSAMathLookback;
   g_stat_visual_window = active_visual_lookback;
   g_stat_obs_window = n_close_bars;
   g_stat_n_crossings = n_crossings;
   g_stat_n_close = n_close_bars;
   g_stat_leftmost_bar = leftmost_bar;

   int drawStartIdx = rates_total - active_visual_lookback;
   if(drawStartIdx < 0) drawStartIdx = 0;

   int drawEndIdx = rightmost_bar;
   if(drawEndIdx < drawStartIdx || drawEndIdx >= rates_total) drawEndIdx = rates_total - 1;
   int actualDrawEndIdx = InpExtendLinesToCurrent ?
   (rates_total - 1) : drawEndIdx;

   for(int i = drawStartIdx; i <= actualDrawEndIdx; i++) {
      ExtBaseLine[i] = base_m * i + base_c;
   }
   
   if(InpShowComments) {
      // CHANGED: Header for Version B
      string comment_text = StringFormat(
          "--- DavinTrade V3.896_1_B A/B Statistical Pipeline ---\n" +
          "Regression Centroids (Box B): %d (Exclusions: %s)\n" +
          "Math Search Window: %d Bars\n" +
          "Visual EDT Window: %d Bars%s\n" +
          "Observation Window (Box B): %d Bars (Index %d to %d)\n" +
          "Total 171 Crossings (n): %d\n" +
          "Timeframe (Sec): %d\n" +
          "Raw Slope (b): %.5f\n" +
          "Regression Angle: %.2f°  |  Anchored Y-Int: %.5f\n" +
          "=================================================\n" +
          "            [MODEL A]         [MODEL B]\n" +
          "METRIC      (CROSSINGS)       (CLOSE PRICE)\n" +
          "-------------------------------------------------\n" +
          "Sample (n) : %-16d %d\n" +
          "R-Square   : %-16.4f %.4f\n" +
          "MSE        : %-16.4f %.4f\n" +
          "Var Ratio  : %-16.2f %.2f\n" +
          "Skewness   : %-16.2f %.2f\n" +
          "Kurtosis   : %-16.2f %.2f",
          valid_count, (StringLen(InpExcludedCentroids)>0 ?
          InpExcludedCentroids : "None"),
          InpSSAMathLookback,
          active_visual_lookback, override_msg,
          n_close_bars, leftmost_bar, rightmost_bar,
          n_crossings,
          PeriodSeconds(_Period),
          base_m,
          current_angle, current_intercept_anchored,
          n_crossings, n_close_bars,
          r2_cross, r2_close,
          mse_cross, mse_close,
          var_cross, var_close,
          skew_cross, skew_close,
          kurt_cross, kurt_close
      );
      Comment(comment_text);
   }

   FractalPoint fractals[];
   for(int i = leftmost_bar; i <= rightmost_bar; i++) {
      if(ExtUpper108[i] != EMPTY_VALUE && ExtUpper108[i] > 0) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = i; fractals[sz].price = ExtUpper108[i]; fractals[sz].is_peak = true;
      }
      if(ExtLower108[i] != EMPTY_VALUE && ExtLower108[i] > 0) {
         int sz = ArraySize(fractals);
         ArrayResize(fractals, sz + 1);
         fractals[sz].bar = i; fractals[sz].price = ExtLower108[i]; fractals[sz].is_peak = false;
      }
   }

   BuildSymmetricalEDTs(base_m, base_c, fractals, rates_total, close_arr[rates_total-1], drawStartIdx, actualDrawEndIdx);
}

//+------------------------------------------------------------------+
//| Symmetrical EDT Snapping Logic (Outermost Search ONLY)           |
//+------------------------------------------------------------------+
void BuildSymmetricalEDTs(double base_m, double base_c, const FractalPoint &fractals[], int rates_total, double current_close, int drawStartIdx, int drawEndIdx)
{
   ArrayInitialize(ExtUOEDT, EMPTY_VALUE);
   ArrayInitialize(ExtLOEDT, EMPTY_VALUE);

   int f_count = ArraySize(fractals);
   if(f_count == 0) return;

   double current_atr = 0;
   if(InpToleranceType == TOLERANCE_ATR && ExtATRHandle != INVALID_HANDLE) {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0) current_atr = atr_array[0];
   }

   double max_above_intercept = -99999999.0;
   double min_below_intercept = 99999999.0;
   bool found_above = false;
   bool found_below = false;
   for(int i = 0; i < f_count; i++) {
      double test_intercept = fractals[i].price - base_m * fractals[i].bar;
      int touches = 0;

      for(int k = 0; k < f_count; k++) {
         double expected = base_m * fractals[k].bar + test_intercept;
         if(MathAbs(fractals[k].price - expected) <= CalculateToleranceFast(fractals[k].price, current_atr)) {
            touches++;
         }
      }

      if(test_intercept > base_c) {
          if(touches >= UOEDTInpEDTMinTouches) {
              if(test_intercept > max_above_intercept) {
                  max_above_intercept = test_intercept;
                  found_above = true;
              }
          }
      } else if (test_intercept < base_c) {
          if(touches >= LOEDTInpEDTMinTouches) {
              if(test_intercept < min_below_intercept) {
                  min_below_intercept = test_intercept;
                  found_below = true;
              }
          }
      }
   }

   if(found_above) {
       for(int k = drawStartIdx; k <= drawEndIdx; k++) {
           ExtUOEDT[k] = base_m * k + max_above_intercept;
       }
   }
   if(found_below) {
       for(int k = drawStartIdx; k <= drawEndIdx; k++) {
           ExtLOEDT[k] = base_m * k + min_below_intercept;
       }
   }
}

bool ExportData(bool silent = false)
{
   if(g_rates_total <= 0) return false;
   string symbol = _Symbol;
   string tf_str = TimeframeToString(_Period);
   
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
   
   // =========================================================
   // 1) EXPORT STATISTIC DATA FILE
   // =========================================================
   string stat_filename = StringFormat("%s_%s_%s_Statistic.txt", InpExportFileName, clean_symbol, tf_str);
   int fh_stat = FileOpen(stat_filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh_stat == INVALID_HANDLE) { 
      if(!silent) Print("ERROR: Failed to open statistics file for writing.");
      return false; 
   }
   
   int live_idx = g_rates_total - 1;
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   FileWrite(fh_stat, "Regression Centroids (Box B): " + IntegerToString(g_stat_centroids));
   FileWrite(fh_stat, "Excluded Centroids: " + (StringLen(InpExcludedCentroids) > 0 ? InpExcludedCentroids : "None"));
   FileWrite(fh_stat, "Math Search Window (Bars): " + IntegerToString(g_stat_math_window));
   FileWrite(fh_stat, "Visual EDT Window (Bars): " + IntegerToString(g_stat_visual_window));
   FileWrite(fh_stat, "Observation Window (Box B Bars): " + IntegerToString(g_stat_obs_window));
   FileWrite(fh_stat, "Total 171 Crossings (n): " + IntegerToString(g_stat_n_crossings));
   FileWrite(fh_stat, "Timeframe (Sec): " + IntegerToString((int)ExtTimeframe[live_idx]));
   FileWrite(fh_stat, "Raw Slope (b): " + DoubleToString(ExtSlope[live_idx], 5));
   FileWrite(fh_stat, "Regression Angle: " + DoubleToString(ExtAngle[live_idx], 2));
   FileWrite(fh_stat, "Anchored Y-Int: " + DoubleToString(ExtIntercept[live_idx], 5));
   FileWrite(fh_stat, "");
   
   FileWrite(fh_stat, "[MODEL A; CROSSINGS]");
   FileWrite(fh_stat, "Sample (n): " + IntegerToString(g_stat_n_crossings));
   FileWrite(fh_stat, "R-Square: " + DoubleToString(ExtRSquare_Cross[live_idx], 4));
   FileWrite(fh_stat, "MSE: " + DoubleToString(ExtMSE_Cross[live_idx], 4));
   FileWrite(fh_stat, "Var Ratio: " + DoubleToString(ExtVarRatio_Cross[live_idx], 2));
   FileWrite(fh_stat, "Skewness: " + DoubleToString(ExtSkewness_Cross[live_idx], 2));
   FileWrite(fh_stat, "Kurtosis: " + DoubleToString(ExtKurtosis_Cross[live_idx], 2));
   FileWrite(fh_stat, "");
   
   FileWrite(fh_stat, "[MODEL B; CLOSE PRICE]");
   FileWrite(fh_stat, "Sample (n): " + IntegerToString(g_stat_n_close));
   FileWrite(fh_stat, "R-Square: " + DoubleToString(ExtRSquare_Close[live_idx], 4));
   FileWrite(fh_stat, "MSE: " + DoubleToString(ExtMSE_Close[live_idx], 4));
   FileWrite(fh_stat, "Var Ratio: " + DoubleToString(ExtVarRatio_Close[live_idx], 2));
   FileWrite(fh_stat, "Skewness: " + DoubleToString(ExtSkewness_Close[live_idx], 2));
   FileWrite(fh_stat, "Kurtosis: " + DoubleToString(ExtKurtosis_Close[live_idx], 2));
   FileWrite(fh_stat, "");
   
   FileClose(fh_stat);

   // =========================================================
   // 2) EXPORT TIMESERIES DATA FILE
   // =========================================================
   string data_filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
   int fh_data = FileOpen(data_filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh_data == INVALID_HANDLE) { 
      if(!silent) Print("ERROR: Failed to open data file for writing.");
      return false; 
   }

   // CHANGED: Export Header (Renamed Cherry_A... to Cherry_B...)
   FileWrite(fh_data, "Cherry_B_timestamp\tCherry_B_symbol\tCherry_B_timeframe\tCherry_B_close\tCherry_B_Base_FL\tCherry_B_UOEDT\tCherry_B_LOEDT\tCherry_B_horiz_high_map\tCherry_B_horiz_low_map\tCherry_B_ssa\tCherry_B_ema_ssa\tCherry_B_crossing");
   
   int max_lookback = MathMax(InpSSAMathLookback, g_rates_total - g_stat_leftmost_bar);
   int start_idx = g_rates_total - max_lookback;
   if(start_idx < 0) start_idx = 0;
   for(int i = start_idx; i < g_rates_total; i++) {
      string line = IntegerToString((long)(g_time[i] - gmt_offset)) + "\t";
      line += symbol + "\t" + tf_str + "\t";
      line += DoubleToString(g_close[i], _Digits) + "\t";
      // Data bounds handling (Tabs print empty if out of bounds)
      line += (ExtBaseLine[i] == EMPTY_VALUE) ?
      "\t" : DoubleToString(ExtBaseLine[i], 5) + "\t";
      line += (ExtUOEDT[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtUOEDT[i], 5) + "\t";
      line += (ExtLOEDT[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtLOEDT[i], 5) + "\t";
      
      line += (ExtUpper108[i] == EMPTY_VALUE) ?
      "\t" : DoubleToString(ExtUpper108[i], 5) + "\t";
      line += (ExtLower108[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtLower108[i], 5) + "\t";
      line += (ExtSSATrend[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtSSATrend[i], 8) + "\t";
      line += (ExtSSASignal[i] == EMPTY_VALUE) ?
      "\t" : DoubleToString(ExtSSASignal[i], 8) + "\t";
      line += (ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) ? "1" : "0";
      FileWrite(fh_data, line);
   }
   
   FileClose(fh_data);
   
   if(!silent) Print("Export complete to: ", stat_filename, " and ", data_filename);
   return true;
}

//+------------------------------------------------------------------+
//| Main Calculation loop                                            |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[], const double &open[], const double &high[], const double &low[], const double &close[], const long &tick_volume[], const long &volume[], const int &spread[])
{
   if(rates_total < MathMax((int)InpFractalBars, SSAWindow) * 2) return(0);
   ArraySetAsSeries(time, false); ArraySetAsSeries(close, false); ArraySetAsSeries(high, false); ArraySetAsSeries(low, false);

   bool new_bar = false;
   if(prev_calculated == 0) ExtLastBarTime = time[rates_total - 1];
   else if (time[rates_total - 1] != ExtLastBarTime) { new_bar = true; ExtLastBarTime = time[rates_total - 1];
   }

   int new_bars_start = prev_calculated;
   if(prev_calculated == 0) new_bars_start = 0;
   for(int j = new_bars_start; j < rates_total; j++) {
       ExtBaseLine[j] = EMPTY_VALUE;
       ExtUOEDT[j] = EMPTY_VALUE; 
       ExtLOEDT[j] = EMPTY_VALUE; 
       
       ExtTimeframe[j] = EMPTY_VALUE; ExtSlope[j] = EMPTY_VALUE; ExtIntercept[j] = EMPTY_VALUE;
       ExtAngle[j] = EMPTY_VALUE;
       ExtRSquare_Cross[j] = EMPTY_VALUE; ExtMSE_Cross[j] = EMPTY_VALUE; ExtVarRatio_Cross[j] = EMPTY_VALUE;
       ExtSkewness_Cross[j] = EMPTY_VALUE; ExtKurtosis_Cross[j] = EMPTY_VALUE;
       ExtRSquare_Close[j] = EMPTY_VALUE;
       ExtMSE_Close[j] = EMPTY_VALUE; ExtVarRatio_Close[j] = EMPTY_VALUE;
       ExtSkewness_Close[j] = EMPTY_VALUE; ExtKurtosis_Close[j] = EMPTY_VALUE;
       
       ExtCen0[j] = EMPTY_VALUE; ExtCen1[j] = EMPTY_VALUE;
       ExtCen2[j] = EMPTY_VALUE; ExtCen3[j] = EMPTY_VALUE;
       ExtCen4[j] = EMPTY_VALUE; ExtCen5[j] = EMPTY_VALUE; ExtCen6[j] = EMPTY_VALUE; ExtCen7[j] = EMPTY_VALUE;
       ExtCen8[j] = EMPTY_VALUE; ExtCen9[j] = EMPTY_VALUE; ExtCen10[j] = EMPTY_VALUE; ExtCen11[j] = EMPTY_VALUE;
   }

   if(ArraySize(g_time) < rates_total) {
      ArrayResize(g_time, rates_total); ArrayResize(g_close, rates_total); ArrayResize(g_high, rates_total); ArrayResize(g_low, rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++) {
      g_time[j] = time[j]; g_close[j] = close[j];
      g_high[j] = high[j]; g_low[j] = low[j];
   }
   g_rates_total = rates_total;

   int startIdx = (rates_total > InpSSAMathLookback) ?
   rates_total - InpSSAMathLookback : 0;
   int len = rates_total - startIdx;
   if(prev_calculated == 0) {
      for(int i = 0; i < startIdx; i++) { ExtSSATrend[i] = EMPTY_VALUE;
      ExtSSASignal[i] = EMPTY_VALUE; ExtSSACross[i] = EMPTY_VALUE; }
   }

   vector<double> vecClose(len);
   for(int i = 0; i < len; i++) vecClose[i] = close[startIdx + i];

   CSSAModel ssaClose; CAlglib::SSACreate(ssaClose); CRowDouble closeRow(vecClose); 
   CAlglib::SSAAddSequence(ssaClose, closeRow);
   CAlglib::SSASetAlgoTopKRealtime(ssaClose, SSARank); CAlglib::SSASetWindow(ssaClose, SSAWindow);

   CRowDouble trend, noise;
   double alpha = 2.0 / (SSASignalPeriod + 1.0);
   if(prev_calculated == 0) {
      CAlglib::SSAAnalyzeLast(ssaClose, len, trend, noise);
      if(trend.Size() == len) {
         for(int i = 0; i < len; i++) ExtSSATrend[startIdx + i] = trend[i];
         ExtSSASignal[startIdx] = trend[0]; ExtSSACross[startIdx] = EMPTY_VALUE;
         for(int i = 1; i < len; i++) {
            int idx = startIdx + i;
            ExtSSASignal[idx] = alpha * trend[i] + (1.0 - alpha) * ExtSSASignal[idx - 1];
            bool crossUp = (ExtSSATrend[idx] > ExtSSASignal[idx]) && (ExtSSATrend[idx - 1] <= ExtSSASignal[idx - 1]);
            bool crossDown = (ExtSSATrend[idx] < ExtSSASignal[idx]) && (ExtSSATrend[idx - 1] >= ExtSSASignal[idx - 1]);
            if(crossUp || crossDown) ExtSSACross[idx] = ExtSSATrend[idx];
            else ExtSSACross[idx] = EMPTY_VALUE;
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

   int f_start = MathMax(ExtSideBars, prev_calculated - 1);
   for(int i = f_start; i < rates_total; i++) {
      ExtUpper108[i] = EMPTY_VALUE; ExtLower108[i] = EMPTY_VALUE;
      if(IsUpperFractal(high, i, ExtSideBars, rates_total)) ExtUpper108[i] = high[i];
      if(IsLowerFractal(low, i, ExtSideBars, rates_total))  ExtLower108[i] = low[i];
   }

   if(InpShowSymbol119) {
      int f_start_119 = MathMax(ExtSideBars119, prev_calculated - 1);
      for(int i = f_start_119; i < rates_total; i++) {
         ExtUpper119[i] = EMPTY_VALUE;
         ExtLower119[i] = EMPTY_VALUE;
         if(IsUpperFractal(high, i, ExtSideBars119, rates_total)) ExtUpper119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119, rates_total))  ExtLower119[i] = low[i];
      }
   }

   static datetime last_math_time = 0;
   bool math_update_due = false;
   if(prev_calculated == 0) {
       math_update_due = true;
       last_math_time = TimeLocal();
   } else if (new_bar) {
       math_update_due = true;
       last_math_time = TimeLocal();
   } else if (TimeLocal() - last_math_time >= 59) {
       math_update_due = true;
       last_math_time = TimeLocal();
   }

   if(math_update_due) { 
      PerformClusteringAndEDT(rates_total, time, close); 
      ChartRedraw(0);
   }

   return(rates_total);
}