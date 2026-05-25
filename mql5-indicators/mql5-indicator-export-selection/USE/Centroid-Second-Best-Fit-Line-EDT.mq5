//+------------------------------------------------------------------+
//|                                SSA_Centroid_Regression_CFL.mq5   |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "3.922"
#property description "DavinTrade V3.92_2: 2nd Best Auto-Refined CFL + EDTs"
#property indicator_chart_window

// Total Buffers: 17 Plots + 1 Hidden Cluster + 14 Stats + 12 Centroids = 44 Buffers
#property indicator_buffers 44
#property indicator_plots   17

#include <Math/Alglib/alglib.mqh>

#define EXPORT_BUTTON_NAME "V392_2ExportButton"

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
input int                  InpSSAMathLookback = 3000; // Math Engine Lookback
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

input string            Sep5 = "===== CFL #2 Base & EDT Rules =====";
input int               InpRegCentroids = 12; // (3-12) Max Centroids to Evaluate (Comb. Masking)
input double            InpMinCFLSeparation = 0.1; // Minimum Price Separation (%) from CFL #1
input double            InpMinCFLSlopeSeparation = 5.0; // Minimum Slope Separation (%) from CFL #1
input int               InpCFLVisualLookback = 500; // Visual Drawing Limit
input color             InpCFLColor = clrDodgerBlue; // Color of 2nd Best CFL
input int               InpMaxEDTLines = 4;  // Maximum Total EDTs
input int               InpEDTMinTouches = 1; 
input double            InpMinLineSeparationPercent = 0.5; 
input color             InpEDTColor = clrTeal;
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.00;
input double            InpToleranceATRMultiplier = 1.0;
input int               InpATRPeriod = 12;

input string            Sep6 = "===== Export & Timer Settings =====";
input string            InpExportFileName = "DavinTrade_V392_2_CFL_EDT_Data";
input bool              InpAutoExport = true;
input int               InpExportSecond = 59; // Trigger at this second (0-59)

//--- INDICATOR BUFFERS ---
double ExtSSATrend[];      // 0
double ExtSSASignal[];     // 1
double ExtSSACross[];      // 2
double ExtUpper108[];      // 3
double ExtLower108[];      // 4
double ExtUpper119[];      // 5
double ExtLower119[];      // 6
double ExtCFL2[];          // 7 (Base Line #2)
double ExtEDT1[], ExtEDT2[], ExtEDT3[], ExtEDT4[], ExtEDT5[]; // 8-12
double ExtEDT6[], ExtEDT7[], ExtEDT8[], ExtEDT9[];            // 13-16

//--- HIDDEN BUFFERS FOR EA PIPELINE ---
double ExtCrossInCluster[]; // 17

// Structural Data
double ExtTimeframe[];      // 18
double ExtSlope[];          // 19
double ExtIntercept[];      // 20
double ExtAngle[];          // 21

// Model A: Crossings
double ExtRSquare_Cross[];  // 22
double ExtMSE_Cross[];      // 23
double ExtVarRatio_Cross[]; // 24
double ExtSkewness_Cross[]; // 25
double ExtKurtosis_Cross[]; // 26

// Model B: Close Price
double ExtRSquare_Close[];  // 27
double ExtMSE_Close[];      // 28
double ExtVarRatio_Close[]; // 29
double ExtSkewness_Close[]; // 30
double ExtKurtosis_Close[]; // 31

// EA Centroid Streaming
double ExtCen0[], ExtCen1[], ExtCen2[], ExtCen3[], ExtCen4[], ExtCen5[];
double ExtCen6[], ExtCen7[], ExtCen8[], ExtCen9[], ExtCen10[], ExtCen11[]; // 32-43

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

struct CFLCandidate {
   int      mask;
   double   m;
   double   c;
   double   r2_cross;
   int      leftmost;
   int      rightmost;
   int      centroids_used;
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
   
   if(InpMaxEDTLines > 8) Print("WARNING: InpMaxEDTLines capped at 8 due to Strict Buffer assignment.");
   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);
   
   SetIndexBuffer(0, ExtSSATrend, INDICATOR_DATA);
   SetIndexBuffer(1, ExtSSASignal, INDICATOR_DATA);
   SetIndexBuffer(2, ExtSSACross, INDICATOR_DATA);
   SetIndexBuffer(3, ExtUpper108, INDICATOR_DATA);
   SetIndexBuffer(4, ExtLower108, INDICATOR_DATA);
   SetIndexBuffer(5, ExtUpper119, INDICATOR_DATA);
   SetIndexBuffer(6, ExtLower119, INDICATOR_DATA);
   SetIndexBuffer(7, ExtCFL2, INDICATOR_DATA); 
   SetIndexBuffer(8, ExtEDT1, INDICATOR_DATA); SetIndexBuffer(9, ExtEDT2, INDICATOR_DATA);
   SetIndexBuffer(10, ExtEDT3, INDICATOR_DATA); SetIndexBuffer(11, ExtEDT4, INDICATOR_DATA);
   SetIndexBuffer(12, ExtEDT5, INDICATOR_DATA); SetIndexBuffer(13, ExtEDT6, INDICATOR_DATA);
   SetIndexBuffer(14, ExtEDT7, INDICATOR_DATA); SetIndexBuffer(15, ExtEDT8, INDICATOR_DATA);
   SetIndexBuffer(16, ExtEDT9, INDICATOR_DATA);
   SetIndexBuffer(17, ExtCrossInCluster, INDICATOR_CALCULATIONS);
   
   SetIndexBuffer(18, ExtTimeframe, INDICATOR_DATA);
   SetIndexBuffer(19, ExtSlope, INDICATOR_DATA);
   SetIndexBuffer(20, ExtIntercept, INDICATOR_DATA);
   SetIndexBuffer(21, ExtAngle, INDICATOR_DATA);
   SetIndexBuffer(22, ExtRSquare_Cross, INDICATOR_DATA);
   SetIndexBuffer(23, ExtMSE_Cross, INDICATOR_DATA);
   SetIndexBuffer(24, ExtVarRatio_Cross, INDICATOR_DATA);
   SetIndexBuffer(25, ExtSkewness_Cross, INDICATOR_DATA);
   SetIndexBuffer(26, ExtKurtosis_Cross, INDICATOR_DATA);
   SetIndexBuffer(27, ExtRSquare_Close, INDICATOR_DATA);
   SetIndexBuffer(28, ExtMSE_Close, INDICATOR_DATA);
   SetIndexBuffer(29, ExtVarRatio_Close, INDICATOR_DATA);
   SetIndexBuffer(30, ExtSkewness_Close, INDICATOR_DATA);
   SetIndexBuffer(31, ExtKurtosis_Close, INDICATOR_DATA);

   SetIndexBuffer(32, ExtCen0, INDICATOR_DATA); SetIndexBuffer(33, ExtCen1, INDICATOR_DATA);
   SetIndexBuffer(34, ExtCen2, INDICATOR_DATA); SetIndexBuffer(35, ExtCen3, INDICATOR_DATA);
   SetIndexBuffer(36, ExtCen4, INDICATOR_DATA); SetIndexBuffer(37, ExtCen5, INDICATOR_DATA);
   SetIndexBuffer(38, ExtCen6, INDICATOR_DATA); SetIndexBuffer(39, ExtCen7, INDICATOR_DATA);
   SetIndexBuffer(40, ExtCen8, INDICATOR_DATA); SetIndexBuffer(41, ExtCen9, INDICATOR_DATA);
   SetIndexBuffer(42, ExtCen10, INDICATOR_DATA); SetIndexBuffer(43, ExtCen11, INDICATOR_DATA);

   for(int i = 18; i <= 43; i++) PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrMagenta); PlotIndexSetInteger(0, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrBlue); PlotIndexSetInteger(1, PLOT_LINE_STYLE, STYLE_DASH); PlotIndexSetInteger(1, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(2, PLOT_ARROW, 171); PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrBlack); PlotIndexSetInteger(2, PLOT_LINE_WIDTH, 2);
   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(3, PLOT_ARROW, 108); PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize); PlotIndexSetInteger(3, PLOT_ARROW_SHIFT, -InpSymbolOffset);
   PlotIndexSetInteger(4, PLOT_DRAW_TYPE, DRAW_ARROW); PlotIndexSetInteger(4, PLOT_ARROW, 108); PlotIndexSetInteger(4, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(4, PLOT_LINE_WIDTH, (int)InpSymbolSize); PlotIndexSetInteger(4, PLOT_ARROW_SHIFT, InpSymbolOffset);
   PlotIndexSetInteger(5, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(5, PLOT_ARROW, 119); PlotIndexSetInteger(5, PLOT_LINE_COLOR, clrRed); PlotIndexSetInteger(5, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(5, PLOT_ARROW_SHIFT, -InpSymbolOffset119);
   PlotIndexSetInteger(6, PLOT_DRAW_TYPE, InpShowSymbol119 ? DRAW_ARROW : DRAW_NONE); PlotIndexSetInteger(6, PLOT_ARROW, 119); PlotIndexSetInteger(6, PLOT_LINE_COLOR, clrLimeGreen); PlotIndexSetInteger(6, PLOT_LINE_WIDTH, (int)InpSymbolSize119); PlotIndexSetInteger(6, PLOT_ARROW_SHIFT, InpSymbolOffset119);
   
   PlotIndexSetInteger(7, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(7, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(7, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpCFLColor); PlotIndexSetString(7, PLOT_LABEL, "CFL #2 Base Line");
   
   for(int i = 8; i <= 16; i++) {
      PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_LINE); PlotIndexSetInteger(i, PLOT_LINE_STYLE, STYLE_SOLID); PlotIndexSetInteger(i, PLOT_LINE_WIDTH, 2); PlotIndexSetInteger(i, PLOT_LINE_COLOR, InpEDTColor);
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE); PlotIndexSetString(i, PLOT_LABEL, "CFL2 EDT #" + IntegerToString(i-7));
   }
   
   for(int i=0; i<17; i++) PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   
   IndicatorSetString(INDICATOR_SHORTNAME, "DavinTrade SSA CFL EDT V3.92_2");
   CreateExportButton();
   
   if(InpAutoExport) EventSetTimer(1);
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(ExtATRHandle != INVALID_HANDLE) IndicatorRelease(ExtATRHandle);
   ObjectsDeleteAll(0, "ClusterHull_V2_");
   ObjectsDeleteAll(0, "ClusterCentroidStar_V2_");
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   Comment(""); 
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
           PerformClusteringAndCFL(g_rates_total, g_time, g_close);
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
      case PERIOD_M1:  return "M1"; case PERIOD_M2:  return "M2"; case PERIOD_M3:  return "M3";
      case PERIOD_M4:  return "M4"; case PERIOD_M5:  return "M5"; case PERIOD_M6:  return "M6";
      case PERIOD_M10: return "M10"; case PERIOD_M12: return "M12"; case PERIOD_M15: return "M15";
      case PERIOD_M20: return "M20"; case PERIOD_M30: return "M30"; case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2"; case PERIOD_H3:  return "H3"; case PERIOD_H4:  return "H4";
      case PERIOD_H6:  return "H6"; case PERIOD_H8:  return "H8"; case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1"; case PERIOD_W1:  return "W1"; case PERIOD_MN1: return "MN1";
      default: { string s = EnumToString(timeframe); StringReplace(s, "PERIOD_", ""); return s; }
   }
}

void CreateExportButton()
{
   if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0) ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 70); // Shifted down so buttons don't overlap
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 160);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export V3.92_2 Data");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrTeal);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ChartRedraw(0);
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME) {
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      PerformClusteringAndCFL(g_rates_total, g_time, g_close); 
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
//| Core: Clustering -> Combinatorics -> 2nd Best CFL -> EDTs        |
//+------------------------------------------------------------------+
void PerformClusteringAndCFL(const int rates_total, const datetime &time[], const double &close_arr[])
{
   ObjectsDeleteAll(0, "ClusterHull_V2_"); 
   ObjectsDeleteAll(0, "ClusterCentroidStar_V2_");
   ArrayInitialize(ExtCrossInCluster, 0.0);
   ArrayInitialize(ExtCFL2, EMPTY_VALUE);
   ArrayInitialize(g_cen_prices, 0.0);
   
   int startIdx = (rates_total > InpSSAMathLookback) ? rates_total - InpSSAMathLookback : 0;
   
   ClusterPoint points[];
   for(int i = startIdx; i < rates_total; i++) {
      if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
         int sz = ArraySize(points); ArrayResize(points, sz + 1);
         points[sz].bar = i; points[sz].time = time[i]; points[sz].price = ExtSSACross[i];
      }
   }

   int p_count = ArraySize(points);
   if(p_count < InpMinPts) {
      Comment("--- DavinTrade V3.92_2 (CFL#2+EDT) ---\nAwaiting more data: Points < MinPts");
      return;
   }

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
   } else if (InpAlgo == ALGO_DBSCAN) {
      total_clusters = RunDBSCAN(points, p_count, InpEpsilon, InpMinPts, assignments);
   }
   
   for(int i = 0; i < p_count; i++) { if(assignments[i] != -1) ExtCrossInCluster[points[i].bar] = 1.0; }
   
   ClusterCentroidInfo centroids[]; int centroid_count = 0;

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
            string line_name = "ClusterHull_V2_" + IntegerToString(k) + "_" + IntegerToString(h); // Namespaced for V2
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
         
         string star_name = "ClusterCentroidStar_V2_" + IntegerToString(k); // Namespaced for V2
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

   for(int i = 0; i < centroid_count - 1; i++) {
      for(int j = 0; j < centroid_count - i - 1; j++) {
         if(centroids[j].bar_index < centroids[j+1].bar_index) {
            ClusterCentroidInfo temp = centroids[j];
            centroids[j] = centroids[j+1];
            centroids[j+1] = temp;
         }
      }
   }

   if(centroid_count < 3) {
      Comment(StringFormat("--- DavinTrade V3.92_2 (CFL#2+EDT) ---\nAwaiting more data: Found %d / 3 Centroids needed.", centroid_count));
      return; 
   }

   int n_reg = (int)MathMin(InpRegCentroids, centroid_count);
   if(n_reg > 12) n_reg = 12;

   for(int c = 0; c < n_reg; c++) {
       g_cen_prices[c] = centroids[c].price;
   }

   // PRE-CALCULATE LEFTMOST & RIGHTMOST FOR EACH VALID CLUSTER
   int cl_left[12]; ArrayInitialize(cl_left, rates_total);
   int cl_right[12]; ArrayInitialize(cl_right, -1);
   
   for(int c=0; c<n_reg; c++) {
      int cid = centroids[c].cluster_id;
      for(int p=0; p<p_count; p++) {
         if(assignments[p] == cid) {
            if(points[p].bar < cl_left[c]) cl_left[c] = points[p].bar;
            if(points[p].bar > cl_right[c]) cl_right[c] = points[p].bar;
         }
      }
   }

   CFLCandidate candidates[];
   int total_combos = 1 << n_reg;

   for(int mask = 1; mask < total_combos; mask++) {
       int bits = 0;
       for(int b=0; b<n_reg; b++) { if((mask & (1<<b)) != 0) bits++; }
       if(bits < 3) continue;

       double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
       int leftmost_bar = rates_total, rightmost_bar = -1;
       
       for(int b=0; b<n_reg; b++) {
           if((mask & (1<<b)) != 0) {
               double cx = centroids[b].bar_index;
               double cy = centroids[b].price;
               sumX += cx; sumY += cy; sumXY += cx * cy; sumX2 += cx * cx;
               
               if(cl_left[b] < leftmost_bar) leftmost_bar = cl_left[b];
               if(cl_right[b] > rightmost_bar) rightmost_bar = cl_right[b];
           }
       }

       if(leftmost_bar >= rightmost_bar) continue;

       double D = bits * sumX2 - sumX * sumX;
       double cand_m = 0, cand_c = 0;
       if(D != 0) {
           cand_m = (bits * sumXY - sumX * sumY) / D;
           cand_c = (sumY - cand_m * sumX) / bits;
       } else { continue; }

       int start_idx_p = -1, end_idx_p = -1;
       for(int p=0; p<p_count; p++) {
           if(points[p].bar >= leftmost_bar && start_idx_p == -1) start_idx_p = p;
           if(points[p].bar <= rightmost_bar) end_idx_p = p;
       }
       if(start_idx_p == -1 || end_idx_p == -1) continue;

       int n_crossings = 0;
       double sum_crossings = 0;
       for(int p = start_idx_p; p <= end_idx_p; p++) {
           sum_crossings += points[p].price;
           n_crossings++;
       }
       if(n_crossings < 3) continue;

       double mean_cross = sum_crossings / n_crossings;
       double res_sq = 0, tot_sq = 0;
       for(int p = start_idx_p; p <= end_idx_p; p++) {
           double pred_y = cand_m * points[p].bar + cand_c;
           res_sq += MathPow(points[p].price - pred_y, 2);
           tot_sq += MathPow(points[p].price - mean_cross, 2);
       }
       
       double r2 = (tot_sq != 0) ? 1.0 - (res_sq / tot_sq) : 0.0;
       
       // Keep ALL valid combinations for sorting
       int sz = ArraySize(candidates);
       ArrayResize(candidates, sz + 1);
       candidates[sz].mask = mask;
       candidates[sz].m = cand_m;
       candidates[sz].c = cand_c;
       candidates[sz].r2_cross = r2;
       candidates[sz].leftmost = leftmost_bar;
       candidates[sz].rightmost = rightmost_bar;
       candidates[sz].centroids_used = bits;
   }

   // Sort candidates by R-Square (Highest to Lowest)
   int cand_count = ArraySize(candidates);
   for(int i = 0; i < cand_count - 1; i++) {
       for(int j = 0; j < cand_count - i - 1; j++) {
           if(candidates[j].r2_cross < candidates[j+1].r2_cross) {
               CFLCandidate temp = candidates[j];
               candidates[j] = candidates[j+1];
               candidates[j+1] = temp;
           }
       }
   }

   // Extract Unique CFLs (Separation Logic)
   CFLCandidate final_cfls[];
   int unique_count = 0;
   double current_close = close_arr[rates_total - 1];

   for(int i = 0; i < cand_count && unique_count < 2; i++) {
       bool is_unique = true;
       double cand_price_now = candidates[i].m * (rates_total - 1) + candidates[i].c;

       for(int u = 0; u < unique_count; u++) {
           double accepted_price_now = final_cfls[u].m * (rates_total - 1) + final_cfls[u].c;
           double diff_pct = MathAbs(cand_price_now - accepted_price_now) / current_close * 100.0;
           double diff_slope_pct = MathAbs(candidates[i].m - final_cfls[u].m) / MathMax(MathAbs(final_cfls[u].m), 0.0001) * 100.0;

           if(diff_pct < InpMinCFLSeparation && diff_slope_pct < InpMinCFLSlopeSeparation) {
               is_unique = false; break;
           }
       }
       if(is_unique) {
           ArrayResize(final_cfls, unique_count + 1);
           final_cfls[unique_count] = candidates[i];
           unique_count++;
       }
   }

   bool cfl_found = (unique_count >= 2); // MUST have at least 2 unique lines to use CFL_2
   CFLCandidate target_cfl = {}; // The "= {}" initializes it with zeros to clear the warning

   double mse_cross = 0, r2_cross = 0, skew_cross = 0, kurt_cross = 0, var_cross = 1.0;
   double mse_close = 0, r2_close = 0, skew_close = 0, kurt_close = 0, var_close = 1.0;
   double current_angle = 0.0;
   double current_intercept_anchored = 0.0; 
   int n_crossings_eval = 0;
   int n_close_bars = 0;
   int leftmost_eval = rates_total, rightmost_eval = -1;
   double base_m = 0, base_c = 0;

   if(cfl_found) {
       target_cfl = final_cfls[1]; // EXPLICITLY Select CFL_2 (Index 1)
       
       base_m = target_cfl.m;
       base_c = target_cfl.c;
       leftmost_eval = target_cfl.leftmost;
       rightmost_eval = target_cfl.rightmost;
       
       current_intercept_anchored = base_m * (rates_total - 1) + base_c; 
       n_close_bars = (rightmost_eval - leftmost_eval) + 1;
       
       double sum_crossings = 0, sum_close = 0;
       for(int i = leftmost_eval; i <= rightmost_eval; i++) {
          if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) { sum_crossings += ExtSSACross[i]; n_crossings_eval++; }
          sum_close += close_arr[i];
       }
      
       double mean_cross = (n_crossings_eval > 0) ? (sum_crossings / n_crossings_eval) : 0.0;
       double mean_close_price = (n_close_bars > 0) ? (sum_close / n_close_bars) : current_intercept_anchored;
       double slope_pct_per_bar = (base_m / mean_close_price) * 100.0;
       current_angle = MathArctan(slope_pct_per_bar * 100.0) * 180.0 / M_PI; 

       if(n_crossings_eval >= 3 && n_close_bars >= 3) {
          double res_cross[]; ArrayResize(res_cross, n_crossings_eval);
          double res_close[]; ArrayResize(res_close, n_close_bars);
          
          int rx = 0; double sum_e_cross = 0;
          int rc = 0; double sum_e_close = 0;
          
          // Calculate Residuals (Errors) first
          for(int i = leftmost_eval; i <= rightmost_eval; i++) {
              double pred_y = base_m * i + base_c;
              if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
                 res_cross[rx] = ExtSSACross[i] - pred_y; sum_e_cross += res_cross[rx]; rx++;
              }
              res_close[rc] = close_arr[i] - pred_y; sum_e_close += res_close[rc]; rc++;
          }
          
          // Calculate Means of the Errors
          double mean_e_cross = sum_e_cross / n_crossings_eval, mean_e_close = sum_e_close / n_close_bars;
          
          double m2_x = 0, var_x = 0, m3_x = 0, m4_x = 0, tot_sq_x = 0;
          double m2_c = 0, var_c = 0, m3_c = 0, m4_c = 0, tot_sq_c = 0;
          
          int rx_idx = 0;
          for(int i = leftmost_eval; i <= rightmost_eval; i++) {
              // --- MODEL A: CROSSINGS ---
              if(ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) {
                  double actual_val = ExtSSACross[i]; 
                  double err = res_cross[rx_idx];                  
                  double dev = err - mean_e_cross;            
                  
                  m2_x += MathPow(err, 2);                    
                  var_x += MathPow(dev, 2); m3_x += MathPow(dev, 3); m4_x += MathPow(dev, 4);
                  tot_sq_x += MathPow(actual_val - mean_cross, 2); 
                  rx_idx++;
              }
              
              // --- MODEL B: CLOSE PRICE ---
              double actual_close = close_arr[i];
              int rc_idx = i - leftmost_eval;
              double err_c = res_close[rc_idx];
              double dev_c = err_c - mean_e_close;
              
              m2_c += MathPow(err_c, 2);                    
              var_c += MathPow(dev_c, 2); m3_c += MathPow(dev_c, 3); m4_c += MathPow(dev_c, 4);
              tot_sq_c += MathPow(actual_close - mean_close_price, 2); 
          }
          
          m2_x /= n_crossings_eval; var_x /= n_crossings_eval; m3_x /= n_crossings_eval; m4_x /= n_crossings_eval;
          mse_cross = m2_x; 
          if(tot_sq_x != 0) r2_cross = 1.0 - ((m2_x * n_crossings_eval) / tot_sq_x);
          if(var_x > 0) { skew_cross = m3_x / MathPow(var_x, 1.5); kurt_cross = m4_x / MathPow(var_x, 2.0); }
          
          m2_c /= n_close_bars; var_c /= n_close_bars; m3_c /= n_close_bars; m4_c /= n_close_bars;
          mse_close = m2_c; 
          if(tot_sq_c != 0) r2_close = 1.0 - ((m2_c * n_close_bars) / tot_sq_c);
          if(var_c > 0) { skew_close = m3_c / MathPow(var_c, 1.5); kurt_close = m4_c / MathPow(var_c, 2.0); }

          int half_x = n_crossings_eval / 2;
          if(half_x > 1) {
              double mt1=0, mt2=0, vt1=0, vt2=0;
              for(int i=0; i<half_x; i++) mt1 += res_cross[i]; for(int i=half_x; i<n_crossings_eval; i++) mt2 += res_cross[i];
              mt1 /= half_x; mt2 /= (n_crossings_eval - half_x);
              for(int i=0; i<half_x; i++) vt1 += MathPow(res_cross[i] - mt1, 2); for(int i=half_x; i<n_crossings_eval; i++) vt2 += MathPow(res_cross[i] - mt2, 2);
              vt1 /= (half_x - 1); vt2 /= (n_crossings_eval - half_x - 1);
              if(vt1 > 0) var_cross = vt2 / vt1;
          }
          
          int half_c = n_close_bars / 2;
          if(half_c > 1) {
              double mt1=0, mt2=0, vt1=0, vt2=0;
              for(int i=0; i<half_c; i++) mt1 += res_close[i]; for(int i=half_c; i<n_close_bars; i++) mt2 += res_close[i];
              mt1 /= half_c; mt2 /= (n_close_bars - half_c);
              for(int i=0; i<half_c; i++) vt1 += MathPow(res_close[i] - mt1, 2); for(int i=half_c; i<n_close_bars; i++) vt2 += MathPow(res_close[i] - mt2, 2);
              vt1 /= (half_c - 1); vt2 /= (n_close_bars - half_c - 1);
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

   int distance_to_leftmost = (cfl_found) ? (rates_total - leftmost_eval) : 0;
   int active_visual_lookback = InpCFLVisualLookback;
   string override_msg = "";
   
   if(active_visual_lookback < distance_to_leftmost) {
       active_visual_lookback = distance_to_leftmost;
       override_msg = " (Auto-Overridden to fit Centroids)";
   }
   
   g_stat_centroids = (cfl_found) ? target_cfl.centroids_used : 0;
   g_stat_math_window = InpSSAMathLookback;
   g_stat_visual_window = active_visual_lookback;
   g_stat_obs_window = n_close_bars;
   g_stat_n_crossings = n_crossings_eval;
   g_stat_n_close = n_close_bars;
   g_stat_leftmost_bar = leftmost_eval;

   int drawStartIdx = rates_total - active_visual_lookback;
   if(drawStartIdx < 0) drawStartIdx = 0;

   if(cfl_found) {
       double m = target_cfl.m;
       double c = target_cfl.c;
       for(int i = drawStartIdx; i < rates_total; i++) {
           ExtCFL2[i] = m * i + c;
       }
       
       FractalPoint fractals[];
       // FIX 1: Strictly bound fractal collection to the evaluated CFL #2 window
       for(int i = leftmost_eval; i <= rightmost_eval; i++) {
          if(ExtUpper108[i] != EMPTY_VALUE && ExtUpper108[i] > 0) {
             int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
             fractals[sz].bar = i; fractals[sz].price = ExtUpper108[i]; fractals[sz].is_peak = true;
          }
          if(ExtLower108[i] != EMPTY_VALUE && ExtLower108[i] > 0) {
             int sz = ArraySize(fractals); ArrayResize(fractals, sz + 1);
             fractals[sz].bar = i; fractals[sz].price = ExtLower108[i]; fractals[sz].is_peak = false;
          }
       }
       BuildSymmetricalEDTs(base_m, base_c, fractals, rates_total, close_arr[rates_total-1], drawStartIdx);
   }
   
   if(cfl_found) {
      string comment_text = StringFormat(
          "--- DavinTrade V3.92_2 (CFL #2 + EDT) ---\n" +
          "Centroids used in CFL #2: %d\n" +
          "Math Search Window: %d Bars\n" +
          "Visual CFL Window: %d Bars%s\n" +
          "Observation Window: %d Bars (Index %d to %d)\n" +
          "Total 171 Crossings (n): %d\n" +
          "Timeframe (Sec): %d\n" +
          "CFL #2 Raw Slope (b): %.5f\n" +
          "CFL #2 Angle: %.2f°  |  Anchored Y-Int: %.5f\n" +
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
          g_stat_centroids,
          InpSSAMathLookback,
          active_visual_lookback, override_msg,
          n_close_bars, leftmost_eval, rightmost_eval,
          n_crossings_eval,
          PeriodSeconds(_Period),
          base_m,
          current_angle, current_intercept_anchored,
          n_crossings_eval, n_close_bars,
          r2_cross, r2_close,
          mse_cross, mse_close,
          var_cross, var_close,
          skew_cross, skew_close,
          kurt_cross, kurt_close
      );
      Comment(comment_text);
   } else {
      Comment("--- DavinTrade V3.92_2 (CFL #2 + EDT) ---\nAwaiting more data: 2nd Unique CFL not found.");
   }
}

//+------------------------------------------------------------------+
//| Symmetrical EDT Snapping Logic (Re-Integrated from V3.89)        |
//+------------------------------------------------------------------+
void BuildSymmetricalEDTs(double base_m, double base_c, const FractalPoint &fractals[], int rates_total, double current_close, int drawStartIdx)
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

      for(int k = 0; k < f_count; k++) {
         double expected = base_m * fractals[k].bar + test_intercept;
         if(MathAbs(fractals[k].price - expected) <= CalculateToleranceFast(fractals[k].price, current_atr)) {
            touches++;
         }
      }

      if(touches >= InpEDTMinTouches) {
         TrendLine tl;
         tl.slope = base_m;
         tl.y_intercept = test_intercept;
         tl.touches = touches;
         // FIX 2: Penalize lines that are too far from the baseline intercept
         tl.score = (touches * 10000.0) - MathAbs(test_intercept - base_c); 
         
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

   int max_allowed = (int)MathMin(InpMaxEDTLines, 8);
   int max_per_side = max_allowed / 2;
   int remainder = max_allowed % 2; 
   
   int extra_above = 0, extra_below = 0;
   if(remainder > 0) {
       double max_score_above = (count_above > 0) ? cand_above[0].score : -1;
       double max_score_below = (count_below > 0) ? cand_below[0].score : -1;
       if(max_score_above >= max_score_below) extra_above = 1;
       else extra_below = 1;
   }

   int target_above = (int)MathMin(4, max_per_side + extra_above);
   int target_below = (int)MathMin(4, max_per_side + extra_below);

   double base_price_now = base_m * (rates_total - 1) + base_c;
   
   TrendLine final_edts_above[]; int picked_above = 0;
   for(int i = 0; i < count_above && picked_above < target_above; i++) {
      bool too_close = false;
      double cand_price_now = base_m * (rates_total - 1) + cand_above[i].y_intercept;
      if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
      
      for(int f = 0; f < picked_above; f++) {
         double approved_price = base_m * (rates_total - 1) + final_edts_above[f].y_intercept;
         if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
      }
      
      if(!too_close) {
         double c = cand_above[i].y_intercept;
         for(int k = drawStartIdx; k < rates_total; k++) {
             double val = base_m * k + c;
             if(picked_above == 0) ExtEDT1[k] = val;
             else if(picked_above == 1) ExtEDT2[k] = val;
             else if(picked_above == 2) ExtEDT3[k] = val;
             else if(picked_above == 3) ExtEDT4[k] = val;
         }
         ArrayResize(final_edts_above, picked_above + 1);
         final_edts_above[picked_above] = cand_above[i];
         picked_above++;
      }
   }

   TrendLine final_edts_below[]; int picked_below = 0;
   for(int i = 0; i < count_below && picked_below < target_below; i++) {
      bool too_close = false;
      double cand_price_now = base_m * (rates_total - 1) + cand_below[i].y_intercept;
      if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
      
      for(int f = 0; f < picked_below; f++) {
         double approved_price = base_m * (rates_total - 1) + final_edts_below[f].y_intercept;
         if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
      }
      
      if(!too_close) {
         double c = cand_below[i].y_intercept;
         for(int k = drawStartIdx; k < rates_total; k++) {
             double val = base_m * k + c;
             if(picked_below == 0) ExtEDT5[k] = val;
             else if(picked_below == 1) ExtEDT6[k] = val;
             else if(picked_below == 2) ExtEDT7[k] = val;
             else if(picked_below == 3) ExtEDT8[k] = val;
         }
         ArrayResize(final_edts_below, picked_below + 1);
         final_edts_below[picked_below] = cand_below[i];
         picked_below++;
      }
   }

   if (picked_above + picked_below < max_allowed) {
       int remaining = max_allowed - (picked_above + picked_below);
       
       for(int i = 0; i < count_above && remaining > 0 && picked_above < 4; i++) {
          bool already_picked = false;
          for(int f=0; f<picked_above; f++) { if (final_edts_above[f].y_intercept == cand_above[i].y_intercept) { already_picked = true; break; } }
          if (already_picked) continue;

          bool too_close = false;
          double cand_price_now = base_m * (rates_total - 1) + cand_above[i].y_intercept;
          if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
          for(int f = 0; f < picked_above; f++) {
             double approved_price = base_m * (rates_total - 1) + final_edts_above[f].y_intercept;
             if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
          }
          if(!too_close) { 
              double c = cand_above[i].y_intercept;
              for(int k = drawStartIdx; k < rates_total; k++) {
                 double val = base_m * k + c;
                 if(picked_above == 0) ExtEDT1[k] = val;
                 else if(picked_above == 1) ExtEDT2[k] = val;
                 else if(picked_above == 2) ExtEDT3[k] = val;
                 else if(picked_above == 3) ExtEDT4[k] = val;
              }
              ArrayResize(final_edts_above, picked_above + 1); 
              final_edts_above[picked_above] = cand_above[i]; 
              picked_above++; remaining--; 
          }
       }
       for(int i = 0; i < count_below && remaining > 0 && picked_below < 4; i++) {
          bool already_picked = false;
          for(int f=0; f<picked_below; f++) { if (final_edts_below[f].y_intercept == cand_below[i].y_intercept) { already_picked = true; break; } }
          if (already_picked) continue;

          bool too_close = false;
          double cand_price_now = base_m * (rates_total - 1) + cand_below[i].y_intercept;
          if(MathAbs(cand_price_now - base_price_now) / current_close * 100.0 < InpMinLineSeparationPercent) continue;
          for(int f = 0; f < picked_below; f++) {
             double approved_price = base_m * (rates_total - 1) + final_edts_below[f].y_intercept;
             if(MathAbs(cand_price_now - approved_price) / current_close * 100.0 < InpMinLineSeparationPercent) { too_close = true; break; }
          }
          if(!too_close) { 
              double c = cand_below[i].y_intercept;
              for(int k = drawStartIdx; k < rates_total; k++) {
                 double val = base_m * k + c;
                 if(picked_below == 0) ExtEDT5[k] = val;
                 else if(picked_below == 1) ExtEDT6[k] = val;
                 else if(picked_below == 2) ExtEDT7[k] = val;
                 else if(picked_below == 3) ExtEDT8[k] = val;
              }
              ArrayResize(final_edts_below, picked_below + 1); 
              final_edts_below[picked_below] = cand_below[i]; 
              picked_below++; remaining--; 
          }
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
   
   string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
   int fh = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE) { 
      if(!silent) Print("ERROR: Failed to open file for writing."); 
      return false; 
   }
   
   int live_idx = g_rates_total - 1;
   datetime gmt_offset = TimeCurrent() - TimeGMT();

   FileWrite(fh, "Regression Centroids (CFL #2): " + IntegerToString(g_stat_centroids));
   FileWrite(fh, "Math Search Window (Bars): " + IntegerToString(g_stat_math_window));
   FileWrite(fh, "Visual CFL/EDT Window (Bars): " + IntegerToString(g_stat_visual_window));
   FileWrite(fh, "Observation Window (Bars): " + IntegerToString(g_stat_obs_window));
   FileWrite(fh, "Total 171 Crossings (n): " + IntegerToString(g_stat_n_crossings));
   FileWrite(fh, "Timeframe (Sec): " + IntegerToString((int)ExtTimeframe[live_idx]));
   FileWrite(fh, "Raw Slope (b): " + DoubleToString(ExtSlope[live_idx], 5));
   FileWrite(fh, "Regression Angle: " + DoubleToString(ExtAngle[live_idx], 2));
   FileWrite(fh, "Anchored Y-Int: " + DoubleToString(ExtIntercept[live_idx], 5));
   FileWrite(fh, "");
   
   FileWrite(fh, "[MODEL A; CROSSINGS]");
   FileWrite(fh, "Sample (n): " + IntegerToString(g_stat_n_crossings));
   FileWrite(fh, "R-Square: " + DoubleToString(ExtRSquare_Cross[live_idx], 4));
   FileWrite(fh, "MSE: " + DoubleToString(ExtMSE_Cross[live_idx], 4));
   FileWrite(fh, "Var Ratio: " + DoubleToString(ExtVarRatio_Cross[live_idx], 2));
   FileWrite(fh, "Skewness: " + DoubleToString(ExtSkewness_Cross[live_idx], 2));
   FileWrite(fh, "Kurtosis: " + DoubleToString(ExtKurtosis_Cross[live_idx], 2));
   FileWrite(fh, "");
   
   FileWrite(fh, "[MODEL B; CLOSE PRICE]");
   FileWrite(fh, "Sample (n): " + IntegerToString(g_stat_n_close));
   FileWrite(fh, "R-Square: " + DoubleToString(ExtRSquare_Close[live_idx], 4));
   FileWrite(fh, "MSE: " + DoubleToString(ExtMSE_Close[live_idx], 4));
   FileWrite(fh, "Var Ratio: " + DoubleToString(ExtVarRatio_Close[live_idx], 2));
   FileWrite(fh, "Skewness: " + DoubleToString(ExtSkewness_Close[live_idx], 2));
   FileWrite(fh, "Kurtosis: " + DoubleToString(ExtKurtosis_Close[live_idx], 2));
   FileWrite(fh, "");

   FileWrite(fh, "timestamp\tsymbol\ttimeframe\tclose\tCEN_0\tCEN_1\tCEN_2\tCEN_3\tCEN_4\tCEN_5\tCEN_6\tCEN_7\tCEN_8\tCEN_9\tCEN_10\tCEN_11\tCFL_2\tEDT_1\tEDT_2\tEDT_3\tEDT_4\tEDT_5\tEDT_6\tEDT_7\tEDT_8\thoriz_high_map\thoriz_low_map\tssa\tema_ssa\tcrossing");

   int max_lookback = MathMax(InpSSAMathLookback, g_rates_total - g_stat_leftmost_bar);
   int start_idx = g_rates_total - max_lookback;
   if(start_idx < 0) start_idx = 0;
   
   for(int i = start_idx; i < g_rates_total; i++) {
      string line = IntegerToString((long)(g_time[i] - gmt_offset)) + "\t";
      line += symbol + "\t" + tf_str + "\t";
      line += DoubleToString(g_close[i], _Digits) + "\t";
      
      for(int c=0; c<12; c++) {
         if(g_cen_prices[c] != 0.0) line += DoubleToString(g_cen_prices[c], 5) + "\t";
         else line += "\t";
      }
      
      line += (ExtCFL2[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtCFL2[i], 5) + "\t";
      
      line += (ExtEDT1[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT1[i], 5) + "\t";
      line += (ExtEDT2[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT2[i], 5) + "\t";
      line += (ExtEDT3[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT3[i], 5) + "\t";
      line += (ExtEDT4[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT4[i], 5) + "\t";
      line += (ExtEDT5[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT5[i], 5) + "\t";
      line += (ExtEDT6[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT6[i], 5) + "\t";
      line += (ExtEDT7[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT7[i], 5) + "\t";
      line += (ExtEDT8[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtEDT8[i], 5) + "\t";
      
      line += (ExtUpper108[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtUpper108[i], 5) + "\t";
      line += (ExtLower108[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtLower108[i], 5) + "\t";
      
      line += (ExtSSATrend[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtSSATrend[i], _Digits+3) + "\t";
      line += (ExtSSASignal[i] == EMPTY_VALUE) ? "\t" : DoubleToString(ExtSSASignal[i], _Digits+3) + "\t";
      
      line += (ExtSSACross[i] != EMPTY_VALUE && ExtSSACross[i] != 0.0) ? "1" : "0";
      
      FileWrite(fh, line);
   }
   
   FileClose(fh);
   if(!silent) Print("Export complete to: ", filename);
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
   else if (time[rates_total - 1] != ExtLastBarTime) { new_bar = true; ExtLastBarTime = time[rates_total - 1]; }

   int new_bars_start = prev_calculated;
   if(prev_calculated == 0) new_bars_start = 0;
   
   for(int j = new_bars_start; j < rates_total; j++) {
       ExtCFL2[j] = EMPTY_VALUE; 
       ExtEDT1[j] = EMPTY_VALUE; ExtEDT2[j] = EMPTY_VALUE; ExtEDT3[j] = EMPTY_VALUE; ExtEDT4[j] = EMPTY_VALUE;
       ExtEDT5[j] = EMPTY_VALUE; ExtEDT6[j] = EMPTY_VALUE; ExtEDT7[j] = EMPTY_VALUE; ExtEDT8[j] = EMPTY_VALUE; ExtEDT9[j] = EMPTY_VALUE;
       
       ExtTimeframe[j] = EMPTY_VALUE; ExtSlope[j] = EMPTY_VALUE; ExtIntercept[j] = EMPTY_VALUE; ExtAngle[j] = EMPTY_VALUE;
       ExtRSquare_Cross[j] = EMPTY_VALUE; ExtMSE_Cross[j] = EMPTY_VALUE; ExtVarRatio_Cross[j] = EMPTY_VALUE;
       ExtSkewness_Cross[j] = EMPTY_VALUE; ExtKurtosis_Cross[j] = EMPTY_VALUE;
       ExtRSquare_Close[j] = EMPTY_VALUE; ExtMSE_Close[j] = EMPTY_VALUE; ExtVarRatio_Close[j] = EMPTY_VALUE;
       ExtSkewness_Close[j] = EMPTY_VALUE; ExtKurtosis_Close[j] = EMPTY_VALUE;
       
       ExtCen0[j] = EMPTY_VALUE; ExtCen1[j] = EMPTY_VALUE; ExtCen2[j] = EMPTY_VALUE; ExtCen3[j] = EMPTY_VALUE;
       ExtCen4[j] = EMPTY_VALUE; ExtCen5[j] = EMPTY_VALUE; ExtCen6[j] = EMPTY_VALUE; ExtCen7[j] = EMPTY_VALUE;
       ExtCen8[j] = EMPTY_VALUE; ExtCen9[j] = EMPTY_VALUE; ExtCen10[j] = EMPTY_VALUE; ExtCen11[j] = EMPTY_VALUE;
   }

   if(ArraySize(g_time) < rates_total) {
      ArrayResize(g_time, rates_total); ArrayResize(g_close, rates_total); ArrayResize(g_high, rates_total); ArrayResize(g_low, rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++) {
      g_time[j] = time[j]; g_close[j] = close[j]; g_high[j] = high[j]; g_low[j] = low[j];
   }
   g_rates_total = rates_total;

   int startIdx = (rates_total > InpSSAMathLookback) ? rates_total - InpSSAMathLookback : 0;
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
      PerformClusteringAndCFL(rates_total, time, close); 
      ChartRedraw(0); 
   }

   return(rates_total);
}