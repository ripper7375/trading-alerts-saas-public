//+------------------------------------------------------------------+
//|                      Fractal S&R Diagonal Lines V1.03            |
//|                             Copyright 2000-2025, MetaQuotes Ltd. |
//|              FIXED: Angle signs now reflect slope direction      |
//|              Companion to Fractal S&R Horizontal V5.54           |
//|              ZERO CONFLICTS - Safe to use together               |
//+------------------------------------------------------------------+
#property copyright "Copyright 2000-2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.03"
#property description "Fixed: Negative angles for descending, positive for ascending"
#property description "Use with V5.54 for complete support/resistance system"
#property description "ZERO CONFLICTS - Safe to use together"
#property indicator_chart_window
#property indicator_buffers 8
#property indicator_plots   6

#property indicator_type1   DRAW_LINE
#property indicator_type2   DRAW_LINE
#property indicator_type3   DRAW_LINE
#property indicator_type4   DRAW_LINE
#property indicator_type5   DRAW_LINE
#property indicator_type6   DRAW_LINE

#property indicator_color1  clrDodgerBlue
#property indicator_color2  clrDodgerBlue
#property indicator_color3  clrDodgerBlue
#property indicator_color4  clrOrangeRed
#property indicator_color5  clrOrangeRed
#property indicator_color6  clrOrangeRed

#property indicator_width1  2
#property indicator_width2  2
#property indicator_width3  2
#property indicator_width4  2
#property indicator_width5  2
#property indicator_width6  2

#property indicator_label1  "Diagonal Ascending #1"
#property indicator_label2  "Diagonal Ascending #2"
#property indicator_label3  "Diagonal Ascending #3"
#property indicator_label4  "Diagonal Descending #1"
#property indicator_label5  "Diagonal Descending #2"
#property indicator_label6  "Diagonal Descending #3"

//--- Input enums
enum ENUM_FRACTAL_BARS
  {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
  };

//--- Button name constant
#define EXPORT_BUTTON_NAME "DiagonalExportButton"


enum ENUM_TOLERANCE_TYPE
  {
   TOLERANCE_ATR, TOLERANCE_PERCENT
  };

enum ENUM_LINE_DIRECTION
  {
   DIRECTION_ASCENDING = 1,
   DIRECTION_DESCENDING = -1
  };

enum ENUM_SCORING_PRESET
  {
   PRESET_MANUAL           = 0,  // Manual (use weights below)
   PRESET_PURE_STRUCTURE   = 1,  // Preset 1 - Pure Structure  (Swing / D1)
   PRESET_STRUCTURE_BIASED = 2,  // Preset 2 - Structure-Biased (H1 / XAUUSD)
   PRESET_BALANCED         = 3,  // Preset 3 - Balanced (General)
   PRESET_PROXIMITY_BIASED = 4,  // Preset 4 - Proximity-Biased (M5/M10 Scalp)
   PRESET_PURE_PROXIMITY   = 5   // Preset 5 - Pure Proximity (M1 Scalp)
  };

//--- Input parameters
input string            Sep1 = "===== Fractal Detection (108 bars) =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;

input string            Sep2 = "===== Diagonal Line Rules =====";
input int               InpMinMixedTouches = 4;
input int               InpMinPeakTouches = 2;
input int               InpMinBottomTouches = 2;
input int               InpMaxConsecutiveSameType = 2;
input int               InpMinDiagonalLength = 80.0;
input double            InpMinDiagonalAngle = 2.0;
input double            InpMaxDiagonalAngle = 45.0;

input string            Sep3 = "===== Tolerance Settings =====";
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.5;
input double            InpToleranceATRMultiplier = 1.5;
input int               InpATRPeriod = 12;

input string            Sep4 = "===== Display Settings =====";
input int               InpLookbackBars = 500;
input int               InpExtensionBars = 100;
input int               InpMaxAscendingLines = 3;
input int               InpMaxDescendingLines = 3;
input color             InpAscendingLineColor = clrDodgerBlue;
input color             InpDescendingLineColor = clrOrangeRed;

input string            Sep5 = "===== Labels =====";
input bool              InpShowLabels = true;
input int               InpLabelFontSize = 9;
input int               InpLabelOffsetBars = 5;

input string               Sep6                 = "===== Scoring Weights =====";
input ENUM_SCORING_PRESET  InpScoringPreset     = PRESET_MANUAL;  // Scoring Preset
input int                  InpWeightFractals    = 25;  // [Manual] Fractals touched weight
input int                  InpWeightSlope       = 15;  // [Manual] Slope quality weight
input int                  InpWeightLength      = 10;  // [Manual] Line length weight
input int                  InpWeightProximity   = 50;  // [Manual] Proximity to price weight
input int                  InpWeightAlternation = 20;  // [Manual] Peak/Bottom alternation weight

input string            Sep7 = "===== 🚀 Performance Optimization =====";
input bool              InpUseOptimizations = true;
input bool              InpUseCaching = true;
input bool              InpUseSlopeFilter = true;
input bool              InpUseEarlyExit = false;
input double            InpEarlyExitThreshold = 150.0;
input bool              InpUseSpatialIndex = false;
input int               InpSpatialGridSize = 20;
input string            Sep8 = "===== Export Settings =====";
input string            InpExportFileName = "FractalDiagonals";
input bool              InpIncludeHeader = true;
input int               InpExportBars = 500;


//--- Indicator buffers
double DiagAscLine1[];
double DiagAscLine2[];
double DiagAscLine3[];
double DiagDescLine1[];
double DiagDescLine2[];
double DiagDescLine3[];
double DiagHighMap[];
double DiagLowMap[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtATRHandle = INVALID_HANDLE;
int    ExtLastRatesTotal = 0;
//--- Effective scoring weights (resolved from preset or manual inputs)
int    ExtWeightFractals    = 25;
int    ExtWeightSlope       = 15;
int    ExtWeightLength      = 10;
int    ExtWeightProximity   = 50;
int    ExtWeightAlternation = 20;

datetime ExtLastBarTime = 0;

//--- Structure for diagonal lines
struct DiagonalLine
  {
   int               bar_start;
   int               bar_end;
   double            price_start;
   double            price_end;
   double            slope;
   double            angle_degrees;     // SIGNED angle

   int               fractals_touched;
   int               peaks_touched;
   int               bottoms_touched;
   int               touched_bars[];
   bool              touched_types[];

   int               length_bars;
   double            score;
   double            line_price_at_current;
   int               line_direction;
   bool              is_support;
  };
  
//+------------------------------------------------------------------+
//| OPTIMIZATION 1: SLOPE FILTER CLASS                               |
//+------------------------------------------------------------------+
class CSlopeFilter
{
private:
   double   m_min_slope;
   double   m_max_slope;
   double   m_atr;
   bool     m_enabled;
   
public:
   CSlopeFilter() : m_enabled(false), m_atr(0), m_min_slope(0), m_max_slope(0) {}
   
   void Init(double min_angle, double max_angle, double atr, bool enabled)
   {
      m_enabled = enabled;
      m_atr = atr;
      
      if(m_enabled && m_atr > 0)
      {
         m_min_slope = MathTan(min_angle * M_PI / 180.0);
         m_max_slope = MathTan(max_angle * M_PI / 180.0);
      }
   }
   
   bool IsEnabled() { return m_enabled; }
   
   bool IsValidSlope(int bar1, double price1, int bar2, double price2)
   {
      if(!m_enabled || m_atr == 0) return true;
      
      if(bar2 <= bar1) return false;
      
      int bar_distance = bar2 - bar1;
      double price_diff = price2 - price1;
      
      double slope = MathAbs(price_diff / (bar_distance * m_atr));
      
      return (slope >= m_min_slope && slope <= m_max_slope);
   }
};

//+------------------------------------------------------------------+
//| OPTIMIZATION 2: SPATIAL GRID                                     |
//+------------------------------------------------------------------+
class CSpatialGrid
{
private:
   int       m_grid_indices[];
   int       m_grid_counts[];
   int       m_grid_size;
   double    m_price_min;
   double    m_price_max;
   double    m_price_range;
   int       m_bars_total;
   bool      m_enabled;
   int       m_max_per_cell;
   
   int GetCellIndex(int grid_x, int grid_y)
   {
      return grid_y * m_grid_size + grid_x;
   }
   
public:
   CSpatialGrid() : m_enabled(false), m_grid_size(20), m_max_per_cell(50) {}
   
   void Init(int bars_total, double price_min, double price_max, int grid_size, bool enabled)
   {
      m_enabled = enabled;
      if(!m_enabled) return;
      
      m_bars_total = bars_total;
      m_price_min = price_min;
      m_price_max = price_max;
      m_price_range = price_max - price_min;
      m_grid_size = grid_size;
      
      if(m_price_range <= 0) 
      {
         m_enabled = false;
         return;
      }
      
      int total_cells = m_grid_size * m_grid_size;
      ArrayResize(m_grid_counts, total_cells);
      ArrayResize(m_grid_indices, total_cells * m_max_per_cell);
      ArrayInitialize(m_grid_counts, 0);
   }
   
   bool IsEnabled() { return m_enabled; }
   
   void Clear()
   {
      if(!m_enabled) return;
      ArrayInitialize(m_grid_counts, 0);
   }
   
   void AddFractal(int fractal_index, int bar, double price)
   {
      if(!m_enabled) return;
      
      int grid_x = (int)((double)bar / m_bars_total * m_grid_size);
      int grid_y = (int)((price - m_price_min) / m_price_range * m_grid_size);
      
      if(grid_x < 0 || grid_x >= m_grid_size) return;
      if(grid_y < 0 || grid_y >= m_grid_size) return;
      
      int cell_idx = GetCellIndex(grid_x, grid_y);
      int count = m_grid_counts[cell_idx];
      
      if(count >= m_max_per_cell) return;
      
      m_grid_indices[cell_idx * m_max_per_cell + count] = fractal_index;
      m_grid_counts[cell_idx]++;
   }
   
   void GetCandidatesNearLine(int bar1, double price1, int bar2, double price2,
                              int &candidates[])
   {
      ArrayResize(candidates, 0);
      
      if(!m_enabled) return;
      
      int grid_x1 = (int)((double)bar1 / m_bars_total * m_grid_size);
      int grid_x2 = (int)((double)bar2 / m_bars_total * m_grid_size);
      int grid_y1 = (int)((price1 - m_price_min) / m_price_range * m_grid_size);
      int grid_y2 = (int)((price2 - m_price_min) / m_price_range * m_grid_size);
      
      int x_min = MathMax(0, MathMin(grid_x1, grid_x2) - 1);
      int x_max = MathMin(m_grid_size - 1, MathMax(grid_x1, grid_x2) + 1);
      int y_min = MathMax(0, MathMin(grid_y1, grid_y2) - 1);
      int y_max = MathMin(m_grid_size - 1, MathMax(grid_y1, grid_y2) + 1);
      
      int candidate_count = 0;
      
      for(int x = x_min; x <= x_max; x++)
      {
         for(int y = y_min; y <= y_max; y++)
         {
            int cell_idx = GetCellIndex(x, y);
            int count = m_grid_counts[cell_idx];
            
            for(int i = 0; i < count; i++)
            {
               int fractal_idx = m_grid_indices[cell_idx * m_max_per_cell + i];
               ArrayResize(candidates, candidate_count + 1);
               candidates[candidate_count] = fractal_idx;
               candidate_count++;
            }
         }
      }
   }
};

//+------------------------------------------------------------------+
//| OPTIMIZATION 3: DIAGONAL LINE CACHE                              |
//+------------------------------------------------------------------+
class CDiagonalLineCache
{
private:
   int       m_line_bar_start[];
   int       m_line_bar_end[];
   double    m_line_price_start[];
   double    m_line_price_end[];
   double    m_line_slope[];
   double    m_line_angle_degrees[];
   int       m_line_fractals_touched[];
   int       m_line_peaks_touched[];
   int       m_line_bottoms_touched[];
   int       m_line_length_bars[];
   double    m_line_score[];
   double    m_line_price_at_current[];
   int       m_line_direction[];
   bool      m_line_is_support[];
   
   double    m_high_map_snapshot[];
   double    m_low_map_snapshot[];
   datetime  m_cache_time;
   bool      m_valid;
   bool      m_enabled;
   
public:
   CDiagonalLineCache() : m_valid(false), m_enabled(true) {}
   
   void SetEnabled(bool enabled) { m_enabled = enabled; }
   
   bool IsValid(double &high_map[], double &low_map[], int lookback)
   {
      if(!m_enabled) return false;
      if(!m_valid) return false;
      
      if(ArraySize(m_high_map_snapshot) != lookback) return false;
      if(ArraySize(m_low_map_snapshot) != lookback) return false;
      
      for(int i = 0; i < lookback; i++)
      {
         if(high_map[i] != m_high_map_snapshot[i]) return false;
         if(low_map[i] != m_low_map_snapshot[i]) return false;
      }
      
      return true;
   }
   
   void Store(DiagonalLine &lines[], double &high_map[], double &low_map[], int lookback)
   {
      if(!m_enabled) return;
      
      int line_count = ArraySize(lines);
      
      ArrayResize(m_line_bar_start, line_count);
      ArrayResize(m_line_bar_end, line_count);
      ArrayResize(m_line_price_start, line_count);
      ArrayResize(m_line_price_end, line_count);
      ArrayResize(m_line_slope, line_count);
      ArrayResize(m_line_angle_degrees, line_count);
      ArrayResize(m_line_fractals_touched, line_count);
      ArrayResize(m_line_peaks_touched, line_count);
      ArrayResize(m_line_bottoms_touched, line_count);
      ArrayResize(m_line_length_bars, line_count);
      ArrayResize(m_line_score, line_count);
      ArrayResize(m_line_price_at_current, line_count);
      ArrayResize(m_line_direction, line_count);
      ArrayResize(m_line_is_support, line_count);
      
      for(int i = 0; i < line_count; i++)
      {
         m_line_bar_start[i] = lines[i].bar_start;
         m_line_bar_end[i] = lines[i].bar_end;
         m_line_price_start[i] = lines[i].price_start;
         m_line_price_end[i] = lines[i].price_end;
         m_line_slope[i] = lines[i].slope;
         m_line_angle_degrees[i] = lines[i].angle_degrees;
         m_line_fractals_touched[i] = lines[i].fractals_touched;
         m_line_peaks_touched[i] = lines[i].peaks_touched;
         m_line_bottoms_touched[i] = lines[i].bottoms_touched;
         m_line_length_bars[i] = lines[i].length_bars;
         m_line_score[i] = lines[i].score;
         m_line_price_at_current[i] = lines[i].line_price_at_current;
         m_line_direction[i] = lines[i].line_direction;
         m_line_is_support[i] = lines[i].is_support;
      }
      
      ArrayResize(m_high_map_snapshot, lookback);
      ArrayResize(m_low_map_snapshot, lookback);
      ArrayCopy(m_high_map_snapshot, high_map, 0, 0, lookback);
      ArrayCopy(m_low_map_snapshot, low_map, 0, 0, lookback);
      
      m_cache_time = TimeCurrent();
      m_valid = true;
   }
   
   void Retrieve(DiagonalLine &lines[])
   {
      if(!m_enabled || !m_valid) return;
      
      int line_count = ArraySize(m_line_bar_start);
      ArrayResize(lines, line_count);
      
      for(int i = 0; i < line_count; i++)
      {
         lines[i].bar_start = m_line_bar_start[i];
         lines[i].bar_end = m_line_bar_end[i];
         lines[i].price_start = m_line_price_start[i];
         lines[i].price_end = m_line_price_end[i];
         lines[i].slope = m_line_slope[i];
         lines[i].angle_degrees = m_line_angle_degrees[i];
         lines[i].fractals_touched = m_line_fractals_touched[i];
         lines[i].peaks_touched = m_line_peaks_touched[i];
         lines[i].bottoms_touched = m_line_bottoms_touched[i];
         lines[i].length_bars = m_line_length_bars[i];
         lines[i].score = m_line_score[i];
         lines[i].line_price_at_current = m_line_price_at_current[i];
         lines[i].line_direction = m_line_direction[i];
         lines[i].is_support = m_line_is_support[i];
         
         ArrayResize(lines[i].touched_bars, 0);
         ArrayResize(lines[i].touched_types, 0);
      }
   }
   
   void Invalidate()
   {
      m_valid = false;
   }
};

//+------------------------------------------------------------------+
//| Global optimization objects                                      |
//+------------------------------------------------------------------+
CSlopeFilter          g_diag_slope_filter;
CSpatialGrid          g_diag_spatial_grid_peak;
CSpatialGrid          g_diag_spatial_grid_bottom;
CDiagonalLineCache    g_diag_line_cache;

//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| Create export button                                             |
//+------------------------------------------------------------------+
void CreateExportButton()
  {
    if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
        ObjectDelete(0, EXPORT_BUTTON_NAME);

    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
      {
        Print("Failed to create export button");
        return;
      }

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 80);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 180);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Diagonal Lines");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, clrBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 10);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
    
    ChartRedraw(0);
  }

int OnInit()
  {
   //--- Resolve scoring preset
   switch(InpScoringPreset)
     {
      case PRESET_PURE_STRUCTURE:    // F:45 S:15 L:30 P:10 A:25
         ExtWeightFractals=45; ExtWeightSlope=15; ExtWeightLength=30; ExtWeightProximity=10; ExtWeightAlternation=25; break;
      case PRESET_STRUCTURE_BIASED:  // F:35 S:15 L:25 P:25 A:20
         ExtWeightFractals=35; ExtWeightSlope=15; ExtWeightLength=25; ExtWeightProximity=25; ExtWeightAlternation=20; break;
      case PRESET_BALANCED:          // F:30 S:10 L:20 P:40 A:20
         ExtWeightFractals=30; ExtWeightSlope=10; ExtWeightLength=20; ExtWeightProximity=40; ExtWeightAlternation=20; break;
      case PRESET_PROXIMITY_BIASED:  // F:20 S:5  L:10 P:65 A:10
         ExtWeightFractals=20; ExtWeightSlope=5;  ExtWeightLength=10; ExtWeightProximity=65; ExtWeightAlternation=10; break;
      case PRESET_PURE_PROXIMITY:    // F:10 S:5  L:5  P:80 A:5
         ExtWeightFractals=10; ExtWeightSlope=5;  ExtWeightLength=5;  ExtWeightProximity=80; ExtWeightAlternation=5;  break;
      default: // PRESET_MANUAL
         ExtWeightFractals=InpWeightFractals;       ExtWeightSlope=InpWeightSlope;
         ExtWeightLength=InpWeightLength;           ExtWeightProximity=InpWeightProximity;
         ExtWeightAlternation=InpWeightAlternation; break;
     }

   //--- Invalidate cache so lines are re-scored with new weights
   g_diag_line_cache.Invalidate();

   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;

   if(InpATRPeriod < 1)
     {
      Print("ERROR: InpATRPeriod must be >= 1");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(InpTolerancePercent <= 0)
     {
      Print("ERROR: InpTolerancePercent must be > 0");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(InpToleranceATRMultiplier <= 0)
     {
      Print("ERROR: InpToleranceATRMultiplier must be > 0");
      return INIT_PARAMETERS_INCORRECT;
     }

   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   if(InpMinPeakTouches < 1 || InpMinBottomTouches < 1)
     {
      Print("ERROR: InpMinPeakTouches and InpMinBottomTouches must be >= 1");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(InpMinPeakTouches + InpMinBottomTouches > InpMinMixedTouches)
     {
      Print("ERROR: InpMinPeakTouches + InpMinBottomTouches cannot exceed InpMinMixedTouches");
      return INIT_PARAMETERS_INCORRECT;
     }

   SetIndexBuffer(0, DiagAscLine1, INDICATOR_DATA);
   SetIndexBuffer(1, DiagAscLine2, INDICATOR_DATA);
   SetIndexBuffer(2, DiagAscLine3, INDICATOR_DATA);
   SetIndexBuffer(3, DiagDescLine1, INDICATOR_DATA);
   SetIndexBuffer(4, DiagDescLine2, INDICATOR_DATA);
   SetIndexBuffer(5, DiagDescLine3, INDICATOR_DATA);
   SetIndexBuffer(6, DiagHighMap, INDICATOR_CALCULATIONS);
   SetIndexBuffer(7, DiagLowMap, INDICATOR_CALCULATIONS);

   ArraySetAsSeries(DiagAscLine1, true);
   ArraySetAsSeries(DiagAscLine2, true);
   ArraySetAsSeries(DiagAscLine3, true);
   ArraySetAsSeries(DiagDescLine1, true);
   ArraySetAsSeries(DiagDescLine2, true);
   ArraySetAsSeries(DiagDescLine3, true);
   ArraySetAsSeries(DiagHighMap, true);
   ArraySetAsSeries(DiagLowMap, true);

   ArrayInitialize(DiagAscLine1, EMPTY_VALUE);
   ArrayInitialize(DiagAscLine2, EMPTY_VALUE);
   ArrayInitialize(DiagAscLine3, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine1, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine2, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine3, EMPTY_VALUE);
   ArrayInitialize(DiagHighMap, 0.0);
   ArrayInitialize(DiagLowMap, 0.0);

   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

   for(int i = 0; i <= 5; i++)
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(0, PLOT_LINE_COLOR, InpAscendingLineColor);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, InpAscendingLineColor);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, InpAscendingLineColor);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, InpDescendingLineColor);
   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpDescendingLineColor);
   PlotIndexSetInteger(5, PLOT_LINE_COLOR, InpDescendingLineColor);

   IndicatorSetString(INDICATOR_SHORTNAME, "Fractal Diagonal (V1.03)");

   Print("=== Fractal SR Diagonal V1.03 ===");
   Print("  FIXED: Angle signs now show slope direction");
   Print("  Positive = Ascending, Negative = Descending");
   Print("  Fractal: ", InpFractalBars, "-bar (", ExtSideBars, " bars each side)");
   Print("  Min touches: ", InpMinMixedTouches, " (", InpMinPeakTouches, "P + ", InpMinBottomTouches, "B)");

   CreateExportButton();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE)
      IndicatorRelease(ExtATRHandle);

   DeleteAllLabels();
   ObjectDelete(0, EXPORT_BUTTON_NAME);

   // Force chart redraw to ensure objects are removed
   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
    if(id == CHARTEVENT_OBJECT_CLICK)
      {
        if(sparam == EXPORT_BUTTON_NAME)
          {
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
            ExportDiagonalData();
            ChartRedraw(0);
          }
      }
  }

//+------------------------------------------------------------------+
//| Export diagonal line data to file                                |
//+------------------------------------------------------------------+
bool ExportDiagonalData()
  {
    string symbol = _Symbol;
    ENUM_TIMEFRAMES timeframe = _Period;
    
    string clean_symbol = symbol;
    int dot_pos = StringFind(clean_symbol, ".");
    if(dot_pos > 0)
        clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

    string tf_str = "";
    switch(timeframe)
      {
        case PERIOD_M1:  tf_str = "M1"; break;
        case PERIOD_M5:  tf_str = "M5"; break;
        case PERIOD_M15: tf_str = "M15"; break;
        case PERIOD_M30: tf_str = "M30"; break;
        case PERIOD_H1:  tf_str = "H1"; break;
        case PERIOD_H4:  tf_str = "H4"; break;
        case PERIOD_D1:  tf_str = "D"; break;
        case PERIOD_W1:  tf_str = "W"; break;
        case PERIOD_MN1: tf_str = "MN"; break;
        default: tf_str = EnumToString(timeframe); break;
      }

    string filename = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
    
    Print("Exporting diagonal line data to: ", filename);

    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);

    if(file_handle == INVALID_HANDLE)
      {
        Print("ERROR: Failed to open file for writing");
        return false;
      }

    datetime time_array[];
    int copied = CopyTime(_Symbol, _Period, 0, InpExportBars, time_array);
    if(copied <= 0)
      {
        Print("ERROR: Failed to copy time data");
        FileClose(file_handle);
        return false;
      }

    double close_array[];
    int close_copied = CopyClose(_Symbol, _Period, 0, InpExportBars, close_array);

    if(InpIncludeHeader)
      {
        FileWrite(file_handle, "timestamp\tsymbol\ttimeframe\tclose\tdiag_asc_line_1\tdiag_asc_line_2\tdiag_asc_line_3\tdiag_desc_line_1\tdiag_desc_line_2\tdiag_desc_line_3\tdiag_high_map\tdiag_low_map");
      }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    for(int row = 0; row < copied && row < InpExportBars; row++)
      {
        // Reverse index for indicator buffers (series indexed, 0=newest)
        // while time_array is normal indexed (0=oldest)
        int buf_idx = copied - 1 - row;

        string line = IntegerToString((long)(time_array[row] - gmt_offset)) + "\t";
        line += symbol + "\t";
        line += tf_str + "\t";

        if(row < close_copied)
            line += DoubleToString(close_array[row], _Digits) + "\t";
        else
            line += "\t";

        string asc1 = (DiagAscLine1[buf_idx] == 0.0 || DiagAscLine1[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagAscLine1[buf_idx], 2);
        line += asc1 + "\t";

        string asc2 = (DiagAscLine2[buf_idx] == 0.0 || DiagAscLine2[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagAscLine2[buf_idx], 2);
        line += asc2 + "\t";

        string asc3 = (DiagAscLine3[buf_idx] == 0.0 || DiagAscLine3[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagAscLine3[buf_idx], 2);
        line += asc3 + "\t";

        string desc1 = (DiagDescLine1[buf_idx] == 0.0 || DiagDescLine1[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagDescLine1[buf_idx], 2);
        line += desc1 + "\t";

        string desc2 = (DiagDescLine2[buf_idx] == 0.0 || DiagDescLine2[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagDescLine2[buf_idx], 2);
        line += desc2 + "\t";

        string desc3 = (DiagDescLine3[buf_idx] == 0.0 || DiagDescLine3[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(DiagDescLine3[buf_idx], 2);
        line += desc3 + "\t";

        if(DiagHighMap[buf_idx] != EMPTY_VALUE && DiagHighMap[buf_idx] != 0.0)
            line += DoubleToString(DiagHighMap[buf_idx], _Digits) + "\t";
        else
            line += "0\t";

        if(DiagLowMap[buf_idx] != EMPTY_VALUE && DiagLowMap[buf_idx] != 0.0)
            line += DoubleToString(DiagLowMap[buf_idx], _Digits);
        else
            line += "0";

        FileWrite(file_handle, line);
      }

    FileClose(file_handle);
    Print("Diagonal line data successfully exported to: ", filename);
    Alert("Export successful! File: ", filename);
    
    return true;
  }

//+------------------------------------------------------------------+
void DeleteAllLabels()
  {
   // Delete all objects with FSD_ prefix (more robust approach)
   int total_objects = ObjectsTotal(0, 0, -1);  // Get ALL object types
   for(int i = total_objects - 1; i >= 0; i--)
     {
      string obj_name = ObjectName(0, i, 0, -1);  // Get name of any object type
      if(StringFind(obj_name, "FSD_") >= 0)
         ObjectDelete(0, obj_name);
     }
  }

//+------------------------------------------------------------------+
void DrawLineLabel(string label_id, double price, datetime time_point,
                   string text, color clr, int font_size)
  {
   string obj_name = "FSD_" + label_id;

   if(ObjectFind(0, obj_name) >= 0)
      ObjectDelete(0, obj_name);

   ObjectCreate(0, obj_name, OBJ_TEXT, 0, time_point, price);
   ObjectSetString(0, obj_name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, obj_name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, obj_name, OBJPROP_FONTSIZE, font_size);
   ObjectSetInteger(0, obj_name, OBJPROP_ANCHOR, ANCHOR_LEFT);
   ObjectSetInteger(0, obj_name, OBJPROP_BACK, false);
   ObjectSetInteger(0, obj_name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, obj_name, OBJPROP_HIDDEN, true);
  }

//+------------------------------------------------------------------+
bool IsUpperFractal(const double &high[], int index, int side_bars)
  {
   double center_high = high[index];

   for(int i = 1; i <= side_bars; i++)
      if(center_high <= high[index - i])
         return false;

   for(int i = 1; i <= side_bars; i++)
      if(center_high < high[index + i])
         return false;

   return true;
  }

//+------------------------------------------------------------------+
bool IsLowerFractal(const double &low[], int index, int side_bars)
  {
   double center_low = low[index];

   for(int i = 1; i <= side_bars; i++)
      if(center_low >= low[index - i])
         return false;

   for(int i = 1; i <= side_bars; i++)
      if(center_low > low[index + i])
         return false;

   return true;
  }

//+------------------------------------------------------------------+
double CalculateTolerance(double reference_price)
  {
   if(InpToleranceType == TOLERANCE_ATR)
     {
      if(ExtATRHandle != INVALID_HANDLE)
        {
         double atr_array[1];
         if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0)
            return atr_array[0] * InpToleranceATRMultiplier;
        }
      return reference_price * 0.001;
     }
   else
     {
      return reference_price * (InpTolerancePercent / 100.0);
     }
  }
  
//+------------------------------------------------------------------+
//| Calculate ATR-normalized angle - RETURNS SIGNED VALUE            |
//+------------------------------------------------------------------+
double CalculateNormalizedAngle(double price_start, double price_end, int bar_distance)
{
   if(bar_distance <= 0) return 0;
   
   double price_change = price_end - price_start;  // This preserves sign!
   
   double atr = 0;
   if(ExtATRHandle != INVALID_HANDLE)
   {
      double atr_array[1];
      if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0)
         atr = atr_array[0];
   }
   
   double angle = 0;
   
   if(atr > 0)
   {
      double normalized_change = price_change / (atr * bar_distance);
      angle = MathArctan(normalized_change) * 180.0 / M_PI;  // Preserves sign
   }
   else
   {
      double price_mid = (price_start + price_end) / 2.0;
      if(price_mid > 0)
      {
         double percent_change = (price_change / price_mid) * 100.0;  // Preserves sign
         double normalized_change = percent_change / bar_distance;
         angle = MathArctan(normalized_change) * 180.0 / M_PI;  // Preserves sign
      }
   }
   
   return angle;  // Return SIGNED angle
}

//+------------------------------------------------------------------+
void ClearAllDiagonalBuffers()
  {
   ArrayInitialize(DiagAscLine1, EMPTY_VALUE);
   ArrayInitialize(DiagAscLine2, EMPTY_VALUE);
   ArrayInitialize(DiagAscLine3, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine1, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine2, EMPTY_VALUE);
   ArrayInitialize(DiagDescLine3, EMPTY_VALUE);
  }

//+------------------------------------------------------------------+
bool ValidateAlternatingPattern(bool &touched_types[], int touch_count)
  {
   if(touch_count < 2)
      return false;

   int max_consecutive = 1;
   int current_consecutive = 1;

   for(int i = 1; i < touch_count; i++)
     {
      if(touched_types[i] == touched_types[i-1])
        {
         current_consecutive++;
         if(current_consecutive > max_consecutive)
            max_consecutive = current_consecutive;
        }
      else
        {
         current_consecutive = 1;
        }
     }

   if(max_consecutive > InpMaxConsecutiveSameType)
      return false;

   bool has_peak = false;
   bool has_bottom = false;

   for(int i = 0; i < touch_count; i++)
     {
      if(touched_types[i])
         has_peak = true;
      else
         has_bottom = true;
     }

   return (has_peak && has_bottom);
  }

//+------------------------------------------------------------------+
//| OPTIMIZED: Find diagonal lines - PRESERVES ANGLE SIGN            |
//+------------------------------------------------------------------+
void FindDiagonalLinesOptimized(int &peak_bars[], double &peak_prices[], int peak_count,
                                int &bottom_bars[], double &bottom_prices[], int bottom_count,
                                DiagonalLine &lines[])
{
   ArrayResize(lines, 0);

   if(peak_count < 1 || bottom_count < 1)
      return;

   int total_fractals = peak_count + bottom_count;
   if(total_fractals < InpMinMixedTouches)
      return;

   int line_count = 0;
   int high_quality_found = 0;
   int target_lines = InpMaxAscendingLines + InpMaxDescendingLines;
   
   if(InpUseSpatialIndex && g_diag_spatial_grid_peak.IsEnabled())
   {
      g_diag_spatial_grid_peak.Clear();
      g_diag_spatial_grid_bottom.Clear();
      
      double price_min = peak_prices[0];
      double price_max = peak_prices[0];
      
      for(int i = 0; i < peak_count; i++)
      {
         if(peak_prices[i] < price_min) price_min = peak_prices[i];
         if(peak_prices[i] > price_max) price_max = peak_prices[i];
      }
      for(int i = 0; i < bottom_count; i++)
      {
         if(bottom_prices[i] < price_min) price_min = bottom_prices[i];
         if(bottom_prices[i] > price_max) price_max = bottom_prices[i];
      }
      
      int max_bars = MathMax(peak_bars[peak_count-1], bottom_bars[bottom_count-1]);
      
      g_diag_spatial_grid_peak.Init(max_bars, price_min, price_max, InpSpatialGridSize, true);
      g_diag_spatial_grid_bottom.Init(max_bars, price_min, price_max, InpSpatialGridSize, true);
      
      for(int i = 0; i < peak_count; i++)
         g_diag_spatial_grid_peak.AddFractal(i, peak_bars[i], peak_prices[i]);
      
      for(int i = 0; i < bottom_count; i++)
         g_diag_spatial_grid_bottom.AddFractal(i, bottom_bars[i], bottom_prices[i]);
   }

//=================================================================
// CASE 1: Peak → Bottom (Descending Resistance)
//=================================================================
   for(int p1 = 0; p1 < peak_count; p1++)
   {
      if(InpUseEarlyExit && high_quality_found >= target_lines)
         break;
      
      for(int b1 = 0; b1 < bottom_count; b1++)
      {
         int bar_start = peak_bars[p1];
         int bar_end = bottom_bars[b1];
         double price_start = peak_prices[p1];
         double price_end = bottom_prices[b1];

         if(bar_end <= bar_start)
            continue;

         int distance_bars = bar_end - bar_start;
         if(distance_bars < InpMinDiagonalLength)
            continue;

         double slope = (price_end - price_start) / (double)distance_bars;

         if(slope >= 0)
            continue;
         
         if(InpUseSlopeFilter && g_diag_slope_filter.IsEnabled())
         {
            if(!g_diag_slope_filter.IsValidSlope(bar_start, price_start, bar_end, price_end))
               continue;
         }

         // Calculate SIGNED angle
         double angle = CalculateNormalizedAngle(price_start, price_end, distance_bars);
         double abs_angle = MathAbs(angle);  // Use absolute value ONLY for filtering

         if(abs_angle < InpMinDiagonalAngle || abs_angle > InpMaxDiagonalAngle)
            continue;

         double y_intercept = price_start - slope * bar_start;

         int touched_count = 0;
         int touched_indices[];
         bool touched_types_array[];
         int peak_touches = 0;
         int bottom_touches = 0;
         
         int peak_candidates[];
         if(InpUseSpatialIndex && g_diag_spatial_grid_peak.IsEnabled())
         {
            g_diag_spatial_grid_peak.GetCandidatesNearLine(bar_start, price_start, bar_end, price_end, peak_candidates);
         }
         else
         {
            ArrayResize(peak_candidates, peak_count);
            for(int i = 0; i < peak_count; i++)
               peak_candidates[i] = i;
         }
         
         for(int pc = 0; pc < ArraySize(peak_candidates); pc++)
         {
            int p = peak_candidates[pc];
            if(peak_bars[p] < bar_start || peak_bars[p] > bar_end)
               continue;

            double expected_price = slope * peak_bars[p] + y_intercept;
            double price_diff = MathAbs(peak_prices[p] - expected_price);
            double tolerance = CalculateTolerance(peak_prices[p]);

            if(price_diff <= tolerance)
            {
               ArrayResize(touched_indices, touched_count + 1);
               ArrayResize(touched_types_array, touched_count + 1);
               touched_indices[touched_count] = peak_bars[p];
               touched_types_array[touched_count] = true;
               touched_count++;
               peak_touches++;
            }
         }

         int bottom_candidates[];
         if(InpUseSpatialIndex && g_diag_spatial_grid_bottom.IsEnabled())
         {
            g_diag_spatial_grid_bottom.GetCandidatesNearLine(bar_start, price_start, bar_end, price_end, bottom_candidates);
         }
         else
         {
            ArrayResize(bottom_candidates, bottom_count);
            for(int i = 0; i < bottom_count; i++)
               bottom_candidates[i] = i;
         }
         
         for(int bc = 0; bc < ArraySize(bottom_candidates); bc++)
         {
            int b = bottom_candidates[bc];
            if(bottom_bars[b] < bar_start || bottom_bars[b] > bar_end)
               continue;

            double expected_price = slope * bottom_bars[b] + y_intercept;
            double price_diff = MathAbs(bottom_prices[b] - expected_price);
            double tolerance = CalculateTolerance(bottom_prices[b]);

            if(price_diff <= tolerance)
            {
               ArrayResize(touched_indices, touched_count + 1);
               ArrayResize(touched_types_array, touched_count + 1);
               touched_indices[touched_count] = bottom_bars[b];
               touched_types_array[touched_count] = false;
               touched_count++;
               bottom_touches++;
            }
         }

         if(touched_count < InpMinMixedTouches)
            continue;

         if(peak_touches < InpMinPeakTouches || bottom_touches < InpMinBottomTouches)
            continue;

         if(!ValidateAlternatingPattern(touched_types_array, touched_count))
            continue;

         ArrayResize(lines, line_count + 1);
         lines[line_count].bar_start = bar_start;
         lines[line_count].bar_end = bar_end;
         lines[line_count].price_start = price_start;
         lines[line_count].price_end = price_end;
         lines[line_count].slope = slope;
         lines[line_count].angle_degrees = angle;  // Store SIGNED angle
         lines[line_count].fractals_touched = touched_count;
         lines[line_count].peaks_touched = peak_touches;
         lines[line_count].bottoms_touched = bottom_touches;
         lines[line_count].length_bars = distance_bars;

         ArrayResize(lines[line_count].touched_bars, touched_count);
         ArrayResize(lines[line_count].touched_types, touched_count);
         ArrayCopy(lines[line_count].touched_bars, touched_indices);
         ArrayCopy(lines[line_count].touched_types, touched_types_array);

         lines[line_count].line_direction = DIRECTION_DESCENDING;
         lines[line_count].is_support = false;

         line_count++;
         
         if(InpUseEarlyExit)
         {
            double quick_score = touched_count * ExtWeightFractals;
            if(quick_score >= InpEarlyExitThreshold)
            {
               high_quality_found++;
               if(high_quality_found >= target_lines)
                  break;
            }
         }
      }
   }

//=================================================================
// CASE 2: Bottom → Peak (Ascending Support)
//=================================================================
   for(int b1 = 0; b1 < bottom_count; b1++)
   {
      if(InpUseEarlyExit && high_quality_found >= target_lines)
         break;
      
      for(int p1 = 0; p1 < peak_count; p1++)
      {
         int bar_start = bottom_bars[b1];
         int bar_end = peak_bars[p1];
         double price_start = bottom_prices[b1];
         double price_end = peak_prices[p1];

         if(bar_end <= bar_start)
            continue;

         int distance_bars = bar_end - bar_start;
         if(distance_bars < InpMinDiagonalLength)
            continue;

         double slope = (price_end - price_start) / (double)distance_bars;

         if(slope <= 0)
            continue;
         
         if(InpUseSlopeFilter && g_diag_slope_filter.IsEnabled())
         {
            if(!g_diag_slope_filter.IsValidSlope(bar_start, price_start, bar_end, price_end))
               continue;
         }

         // Calculate SIGNED angle
         double angle = CalculateNormalizedAngle(price_start, price_end, distance_bars);
         double abs_angle = MathAbs(angle);  // Use absolute value ONLY for filtering

         if(abs_angle < InpMinDiagonalAngle || abs_angle > InpMaxDiagonalAngle)
            continue;

         double y_intercept = price_start - slope * bar_start;

         int touched_count = 0;
         int touched_indices[];
         bool touched_types_array[];
         int peak_touches = 0;
         int bottom_touches = 0;
         
         int peak_candidates[];
         if(InpUseSpatialIndex && g_diag_spatial_grid_peak.IsEnabled())
         {
            g_diag_spatial_grid_peak.GetCandidatesNearLine(bar_start, price_start, bar_end, price_end, peak_candidates);
         }
         else
         {
            ArrayResize(peak_candidates, peak_count);
            for(int i = 0; i < peak_count; i++)
               peak_candidates[i] = i;
         }

         for(int pc = 0; pc < ArraySize(peak_candidates); pc++)
         {
            int p = peak_candidates[pc];
            if(peak_bars[p] < bar_start || peak_bars[p] > bar_end)
               continue;

            double expected_price = slope * peak_bars[p] + y_intercept;
            double price_diff = MathAbs(peak_prices[p] - expected_price);
            double tolerance = CalculateTolerance(peak_prices[p]);

            if(price_diff <= tolerance)
            {
               ArrayResize(touched_indices, touched_count + 1);
               ArrayResize(touched_types_array, touched_count + 1);
               touched_indices[touched_count] = peak_bars[p];
               touched_types_array[touched_count] = true;
               touched_count++;
               peak_touches++;
            }
         }

         int bottom_candidates[];
         if(InpUseSpatialIndex && g_diag_spatial_grid_bottom.IsEnabled())
         {
            g_diag_spatial_grid_bottom.GetCandidatesNearLine(bar_start, price_start, bar_end, price_end, bottom_candidates);
         }
         else
         {
            ArrayResize(bottom_candidates, bottom_count);
            for(int i = 0; i < bottom_count; i++)
               bottom_candidates[i] = i;
         }

         for(int bc = 0; bc < ArraySize(bottom_candidates); bc++)
         {
            int b = bottom_candidates[bc];
            if(bottom_bars[b] < bar_start || bottom_bars[b] > bar_end)
               continue;

            double expected_price = slope * bottom_bars[b] + y_intercept;
            double price_diff = MathAbs(bottom_prices[b] - expected_price);
            double tolerance = CalculateTolerance(bottom_prices[b]);

            if(price_diff <= tolerance)
            {
               ArrayResize(touched_indices, touched_count + 1);
               ArrayResize(touched_types_array, touched_count + 1);
               touched_indices[touched_count] = bottom_bars[b];
               touched_types_array[touched_count] = false;
               touched_count++;
               bottom_touches++;
            }
         }

         if(touched_count < InpMinMixedTouches)
            continue;

         if(peak_touches < InpMinPeakTouches || bottom_touches < InpMinBottomTouches)
            continue;

         if(!ValidateAlternatingPattern(touched_types_array, touched_count))
            continue;

         ArrayResize(lines, line_count + 1);
         lines[line_count].bar_start = bar_start;
         lines[line_count].bar_end = bar_end;
         lines[line_count].price_start = price_start;
         lines[line_count].price_end = price_end;
         lines[line_count].slope = slope;
         lines[line_count].angle_degrees = angle;  // Store SIGNED angle
         lines[line_count].fractals_touched = touched_count;
         lines[line_count].peaks_touched = peak_touches;
         lines[line_count].bottoms_touched = bottom_touches;
         lines[line_count].length_bars = distance_bars;

         ArrayResize(lines[line_count].touched_bars, touched_count);
         ArrayResize(lines[line_count].touched_types, touched_count);
         ArrayCopy(lines[line_count].touched_bars, touched_indices);
         ArrayCopy(lines[line_count].touched_types, touched_types_array);

         lines[line_count].line_direction = DIRECTION_ASCENDING;
         lines[line_count].is_support = true;

         line_count++;
         
         if(InpUseEarlyExit)
         {
            double quick_score = touched_count * ExtWeightFractals;
            if(quick_score >= InpEarlyExitThreshold)
            {
               high_quality_found++;
               if(high_quality_found >= target_lines)
                  break;
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
double CalculateAlternatingQuality(DiagonalLine &line)
  {
   if(line.fractals_touched < 2)
      return 0.0;

   int alternations = 0;
   for(int i = 1; i < line.fractals_touched; i++)
     {
      if(line.touched_types[i] != line.touched_types[i-1])
         alternations++;
     }

   double quality = (double)alternations / (line.fractals_touched - 1);
   return quality;
  }

//+------------------------------------------------------------------+
void ScoreDiagonalLines(DiagonalLine &lines[], int rates_total, double current_price)
  {
   for(int i = 0; i < ArraySize(lines); i++)
     {
      double slope = lines[i].slope;
      double y_intercept = lines[i].price_start - slope * lines[i].bar_start;

      double line_price_now = slope * (rates_total - 1) + y_intercept;
      double price_diff_percent = MathAbs(current_price - line_price_now) / current_price * 100.0;

      double score = 0;

      score += lines[i].fractals_touched * ExtWeightFractals;

      double alternating_bonus = CalculateAlternatingQuality(lines[i]);
      score += alternating_bonus * ExtWeightAlternation;

      double abs_angle = MathAbs(lines[i].angle_degrees);
      double slope_score = 0;
      if(abs_angle >= 30 && abs_angle <= 60)
         slope_score = 1.0;
      else
         if(abs_angle >= 20 && abs_angle < 30)
            slope_score = 0.8;
         else
            if(abs_angle > 60 && abs_angle <= 75)
               slope_score = 0.8;
            else
               slope_score = 0.5;

      score += slope_score * ExtWeightSlope;

      double length_ratio = (double)lines[i].length_bars / (double)InpLookbackBars;
      if(length_ratio > 1.0)
         length_ratio = 1.0;
      score += length_ratio * ExtWeightLength;

      double proximity_score = 0;
      if(price_diff_percent <= 0.05)
         proximity_score = ExtWeightProximity;
      else
         if(price_diff_percent <= 0.1)
            proximity_score = ExtWeightProximity * 0.93;
         else
            if(price_diff_percent <= 0.25)
               proximity_score = ExtWeightProximity * 0.80;
            else
               if(price_diff_percent <= 0.5)
                  proximity_score = ExtWeightProximity * 0.60;
               else
                  if(price_diff_percent <= 1.0)
                     proximity_score = ExtWeightProximity * 0.40;
                  else
                     if(price_diff_percent <= 2.0)
                        proximity_score = ExtWeightProximity * 0.20;

      score += proximity_score;

      lines[i].score = score;
      lines[i].line_price_at_current = line_price_now;
     }
  }

//+------------------------------------------------------------------+
void FilterTopDiagonalLines(DiagonalLine &lines[], int max_ascending, int max_descending)
  {
   DiagonalLine ascending_lines[];
   DiagonalLine descending_lines[];

   for(int i = 0; i < ArraySize(lines); i++)
     {
      if(lines[i].line_direction == DIRECTION_ASCENDING)
        {
         int size = ArraySize(ascending_lines);
         ArrayResize(ascending_lines, size + 1);
         ascending_lines[size] = lines[i];
        }
      else
        {
         int size = ArraySize(descending_lines);
         ArrayResize(descending_lines, size + 1);
         descending_lines[size] = lines[i];
        }
     }

   for(int i = 0; i < ArraySize(ascending_lines) - 1; i++)
     {
      for(int j = i + 1; j < ArraySize(ascending_lines); j++)
        {
         if(ascending_lines[j].score > ascending_lines[i].score)
           {
            DiagonalLine temp = ascending_lines[i];
            ascending_lines[i] = ascending_lines[j];
            ascending_lines[j] = temp;
           }
        }
     }

   for(int i = 0; i < ArraySize(descending_lines) - 1; i++)
     {
      for(int j = i + 1; j < ArraySize(descending_lines); j++)
        {
         if(descending_lines[j].score > descending_lines[i].score)
           {
            DiagonalLine temp = descending_lines[i];
            descending_lines[i] = descending_lines[j];
            descending_lines[j] = temp;
           }
        }
     }

   if(ArraySize(ascending_lines) > max_ascending)
      ArrayResize(ascending_lines, max_ascending);

   if(ArraySize(descending_lines) > max_descending)
      ArrayResize(descending_lines, max_descending);

   ArrayResize(lines, 0);
   for(int i = 0; i < ArraySize(ascending_lines); i++)
     {
      int size = ArraySize(lines);
      ArrayResize(lines, size + 1);
      lines[size] = ascending_lines[i];
     }
   for(int i = 0; i < ArraySize(descending_lines); i++)
     {
      int size = ArraySize(lines);
      ArrayResize(lines, size + 1);
      lines[size] = descending_lines[i];
     }
  }

//+------------------------------------------------------------------+
void DrawDiagonalLine(double &buffer[], DiagonalLine &line, int rates_total)
  {
   double slope = line.slope;
   double y_intercept = line.price_start - slope * line.bar_start;

   int start_bar = line.bar_start;
   int end_bar = line.bar_end;

   if(InpExtensionBars > 0)
      end_bar = rates_total - 1;

   for(int i = 0; i < rates_total; i++)
     {
      int bar_number = rates_total - 1 - i;

      if(bar_number >= start_bar && bar_number <= end_bar)
        {
         double line_price = slope * bar_number + y_intercept;

         if(line_price > 0 && line_price < 1000000)
            buffer[i] = line_price;
         else
            buffer[i] = EMPTY_VALUE;
        }
     }
  }

//+------------------------------------------------------------------+
//| Draw label with SIGNED angle                                     |
//+------------------------------------------------------------------+
void DrawDiagonalLineLabel(string label_id, DiagonalLine &line, color clr)
  {
   string text = StringFormat("%s: %d touches (%dP+%dB), %d bars, %.1f°",
                              label_id,
                              line.fractals_touched,
                              line.peaks_touched,
                              line.bottoms_touched,
                              line.length_bars,
                              line.angle_degrees);  // Display SIGNED angle

   datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
   DrawLineLabel(label_id, line.line_price_at_current, label_time, text, clr, InpLabelFontSize);
  }

//+------------------------------------------------------------------+
void BuildDiagonalLines(const int rates_total)
{
   ClearAllDiagonalBuffers();
   DeleteAllLabels();

   double current_price = iClose(_Symbol, PERIOD_CURRENT, 0);

   int lookback_limit = rates_total;
   if(InpLookbackBars > 0)
      lookback_limit = MathMin(InpLookbackBars, rates_total);
   
   if(InpUseOptimizations)
   {
      if(InpUseSlopeFilter)
      {
         double atr = 0;
         if(ExtATRHandle != INVALID_HANDLE)
         {
            double atr_array[1];
            if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0)
               atr = atr_array[0];
         }
         g_diag_slope_filter.Init(InpMinDiagonalAngle, InpMaxDiagonalAngle, atr, true);
      }
      else
      {
         g_diag_slope_filter.Init(0, 0, 0, false);
      }
      
      g_diag_line_cache.SetEnabled(InpUseCaching);
   }
   
   DiagonalLine diagonal_lines[];
   
   bool use_cache = InpUseOptimizations && InpUseCaching && 
                    g_diag_line_cache.IsValid(DiagHighMap, DiagLowMap, lookback_limit);
   
   if(use_cache)
   {
      g_diag_line_cache.Retrieve(diagonal_lines);
   }
   else
   {
      int peak_bars[];
      double peak_prices[];
      ArrayResize(peak_bars, 0);
      ArrayResize(peak_prices, 0);

      for(int i = 0; i < lookback_limit; i++)
      {
         if(DiagHighMap[i] > 0)
         {
            int size = ArraySize(peak_bars);
            ArrayResize(peak_bars, size + 1);
            ArrayResize(peak_prices, size + 1);
            peak_bars[size] = rates_total - 1 - i;
            peak_prices[size] = DiagHighMap[i];
         }
      }

      if(ArraySize(peak_bars) > 1)
      {
         for(int i = 0; i < ArraySize(peak_bars) - 1; i++)
         {
            for(int j = i + 1; j < ArraySize(peak_bars); j++)
            {
               if(peak_bars[j] < peak_bars[i])
               {
                  int temp_bar = peak_bars[i];
                  peak_bars[i] = peak_bars[j];
                  peak_bars[j] = temp_bar;

                  double temp_price = peak_prices[i];
                  peak_prices[i] = peak_prices[j];
                  peak_prices[j] = temp_price;
               }
            }
         }
      }

      int bottom_bars[];
      double bottom_prices[];
      ArrayResize(bottom_bars, 0);
      ArrayResize(bottom_prices, 0);

      for(int i = 0; i < lookback_limit; i++)
      {
         if(DiagLowMap[i] > 0)
         {
            int size = ArraySize(bottom_bars);
            ArrayResize(bottom_bars, size + 1);
            ArrayResize(bottom_prices, size + 1);
            bottom_bars[size] = rates_total - 1 - i;
            bottom_prices[size] = DiagLowMap[i];
         }
      }

      if(ArraySize(bottom_bars) > 1)
      {
         for(int i = 0; i < ArraySize(bottom_bars) - 1; i++)
         {
            for(int j = i + 1; j < ArraySize(bottom_bars); j++)
            {
               if(bottom_bars[j] < bottom_bars[i])
               {
                  int temp_bar = bottom_bars[i];
                  bottom_bars[i] = bottom_bars[j];
                  bottom_bars[j] = temp_bar;

                  double temp_price = bottom_prices[i];
                  bottom_prices[i] = bottom_prices[j];
                  bottom_prices[j] = temp_price;
               }
            }
         }
      }

      if(ArraySize(peak_bars) >= 1 && ArraySize(bottom_bars) >= 1)
      {
         FindDiagonalLinesOptimized(peak_bars, peak_prices, ArraySize(peak_bars),
                                   bottom_bars, bottom_prices, ArraySize(bottom_bars),
                                   diagonal_lines);

         if(ArraySize(diagonal_lines) > 0)
         {
            ScoreDiagonalLines(diagonal_lines, rates_total, current_price);
            FilterTopDiagonalLines(diagonal_lines, InpMaxAscendingLines, InpMaxDescendingLines);
         }
         
         if(InpUseOptimizations && InpUseCaching)
            g_diag_line_cache.Store(diagonal_lines, DiagHighMap, DiagLowMap, lookback_limit);
      }
   }
   
   if(ArraySize(diagonal_lines) > 0)
   {
      int asc_count = 0;
      for(int i = 0; i < ArraySize(diagonal_lines); i++)
      {
         if(diagonal_lines[i].line_direction == DIRECTION_ASCENDING && asc_count < 3)
         {
            if(asc_count == 0)
            {
               DrawDiagonalLine(DiagAscLine1, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("B-P1", diagonal_lines[i], InpAscendingLineColor);
            }
            else if(asc_count == 1)
            {
               DrawDiagonalLine(DiagAscLine2, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("B-P2", diagonal_lines[i], InpAscendingLineColor);
            }
            else if(asc_count == 2)
            {
               DrawDiagonalLine(DiagAscLine3, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("B-P3", diagonal_lines[i], InpAscendingLineColor);
            }
            asc_count++;
         }
      }

      int desc_count = 0;
      for(int i = 0; i < ArraySize(diagonal_lines); i++)
      {
         if(diagonal_lines[i].line_direction == DIRECTION_DESCENDING && desc_count < 3)
         {
            if(desc_count == 0)
            {
               DrawDiagonalLine(DiagDescLine1, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("P-B1", diagonal_lines[i], InpDescendingLineColor);
            }
            else if(desc_count == 1)
            {
               DrawDiagonalLine(DiagDescLine2, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("P-B2", diagonal_lines[i], InpDescendingLineColor);
            }
            else if(desc_count == 2)
            {
               DrawDiagonalLine(DiagDescLine3, diagonal_lines[i], rates_total);
               if(InpShowLabels)
                  DrawDiagonalLineLabel("P-B3", diagonal_lines[i], InpDescendingLineColor);
            }
            desc_count++;
         }
      }
   }
}

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
   if(rates_total < ExtMinBars)
      return(0);

   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);
   ArraySetAsSeries(time, true);

   int start_calc;
   bool first_run = false;
   bool new_bar = false;

   if(prev_calculated < ExtMinBars + 2)
     {
      start_calc = 0;
      first_run = true;

      ArrayInitialize(DiagHighMap, 0.0);
      ArrayInitialize(DiagLowMap, 0.0);
      ClearAllDiagonalBuffers();

      ExtLastRatesTotal = rates_total;
      ExtLastBarTime = time[0];
     }
   else
     {
      if(rates_total > ExtLastRatesTotal || time[0] != ExtLastBarTime)
        {
         new_bar = true;
         ExtLastRatesTotal = rates_total;
         ExtLastBarTime = time[0];
        }

      start_calc = rates_total - prev_calculated + ExtSideBars + 1;
      if(start_calc < 0)
         start_calc = 0;
     }

   int start_pos = MathMax(ExtSideBars, start_calc);
   int end_pos = rates_total - ExtSideBars - 1;

   bool fractals_changed = false;

   for(int i = start_pos; i < end_pos && !IsStopped(); i++)
     {
      double old_high = DiagHighMap[i];
      double old_low = DiagLowMap[i];

      DiagHighMap[i] = 0.0;
      DiagLowMap[i] = 0.0;

      if(IsUpperFractal(high, i, ExtSideBars))
        {
         DiagHighMap[i] = high[i];
         if(old_high != high[i])
            fractals_changed = true;
        }

      if(IsLowerFractal(low, i, ExtSideBars))
        {
         DiagLowMap[i] = low[i];
         if(old_low != low[i])
            fractals_changed = true;
        }
     }

   if(first_run || new_bar || fractals_changed)
   {
      BuildDiagonalLines(rates_total);
   }

   return(rates_total);
}
//+------------------------------------------------------------------+