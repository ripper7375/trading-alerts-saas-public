//+------------------------------------------------------------------+
//|                      Fractal S&R Multi-Point Trendlines V5.54   |
//|                             Copyright 2000-2025, MetaQuotes Ltd. |
//|              FIXED: Angle signs now reflect slope direction      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2000-2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "5.54"
#property description "Fixed: Negative angles for descending, positive for ascending"
#property indicator_chart_window
#property indicator_buffers 12
#property indicator_plots   10

#property indicator_type1   DRAW_ARROW
#property indicator_type2   DRAW_ARROW
#property indicator_type3   DRAW_ARROW
#property indicator_type4   DRAW_ARROW
#property indicator_type5   DRAW_LINE
#property indicator_type6   DRAW_LINE
#property indicator_type7   DRAW_LINE
#property indicator_type8   DRAW_LINE
#property indicator_type9   DRAW_LINE
#property indicator_type10  DRAW_LINE

#property indicator_color1  clrRed
#property indicator_color2  clrLimeGreen
#property indicator_color3  clrRed
#property indicator_color4  clrLimeGreen
#property indicator_color5  clrRed
#property indicator_color6  clrOrangeRed
#property indicator_color7  clrDarkOrange
#property indicator_color8  clrLimeGreen
#property indicator_color9  clrSpringGreen
#property indicator_color10 clrAqua

#property indicator_label1  "Fractal Up (108)"
#property indicator_label2  "Fractal Down (108)"
#property indicator_label3  "Fractal Up (119)"
#property indicator_label4  "Fractal Down (119)"
#property indicator_label5  "Peak Line #1"
#property indicator_label6  "Peak Line #2"
#property indicator_label7  "Peak Line #3"
#property indicator_label8  "Bottom Line #1"
#property indicator_label9  "Bottom Line #2"
#property indicator_label10 "Bottom Line #3"

#property indicator_width5  2
#property indicator_width6  2
#property indicator_width7  2
#property indicator_width8  2
#property indicator_width9  2
#property indicator_width10 2

//--- Input enums

//--- Button name constant
#define EXPORT_BUTTON_NAME "FractalExportButton"

enum ENUM_FRACTAL_BARS
  {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, BARS_135 = 135
  };

enum ENUM_FRACTAL_BARS_119
  {
   BARS_5 = 5, BARS_7 = 7, BARS_9 = 9, BARS_11 = 11,
   BARS_13 = 13, BARS_15_119 = 15, BARS_17_119 = 17, BARS_19_119 = 19
  };

enum ENUM_SYMBOL_SIZE
  {
   SIZE_SMALL = 1, SIZE_NORMAL = 3, SIZE_LARGE = 5
  };

enum ENUM_TOLERANCE_TYPE
  {
   TOLERANCE_ATR, TOLERANCE_PERCENT
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
input string            Sep1 = "===== Symbol 108 Settings =====";
input ENUM_FRACTAL_BARS InpFractalBars = BARS_35;
input ENUM_SYMBOL_SIZE  InpSymbolSize = SIZE_LARGE;
input int               InpSymbolOffset = 0;

input string            Sep2 = "===== Symbol 119 Settings =====";
input bool              InpShowSymbol119 = true;
input ENUM_FRACTAL_BARS_119 InpFractalBars119 = BARS_13;
input ENUM_SYMBOL_SIZE  InpSymbolSize119 = SIZE_NORMAL;
input int               InpSymbolOffset119 = 0;
input color             InpSymbol119PeakColor = clrRed;
input color             InpSymbol119BottomColor = clrLimeGreen;

input string            Sep3 = "===== Multi-Point Trendline Settings =====";
input bool              InpShowTrendlines = true;
input int               InpMinFractalTouch = 3;
input int               InpMinLineLength = 20;
input int               InpMaxLineLength = 0;
input double            InpMaxAngleDegrees = 60;
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.5;
input double            InpToleranceATRMultiplier = 1.5;
input int               InpATRPeriod = 12;
input int               InpLookbackBars = 500;
input int               InpExtensionBars = 100;
input int               InpMaxPeakLines = 3;
input int               InpMaxBottomLines = 3;
input color             InpPeakLineColor = clrRed;
input color             InpBottomLineColor = clrLimeGreen;

input string               Sep4              = "===== Scoring Weights =====";
input ENUM_SCORING_PRESET  InpScoringPreset  = PRESET_MANUAL;    // Scoring Preset
input int                  InpWeightFractals = 25;  // [Manual] Fractals touched weight
input int                  InpWeightSlope    = 15;  // [Manual] Slope (flatness) weight
input int                  InpWeightLength   = 10;  // [Manual] Line length weight
input int                  InpWeightProximity= 50;  // [Manual] Proximity to price weight

input string            Sep5 = "===== Alert Settings =====";
input bool              InpMasterAlertSwitch = false;
input bool              InpEnableAlerts = true;
input bool              InpShowChartComment = false;
input double            InpTolerancePercent_Alert = 0.05;
input bool              InpAlertOnce = true;
input bool              InpSendNotification = true;
input bool              InpPlaySound = true;
input string            InpAlertSound = "alert2.wav";
input int               InpAlertCooldownSeconds = 300;

input string            Sep6 = "===== Display Settings =====";
input bool              InpShowLabels = true;
input int               InpLabelFontSize = 9;
input int               InpLabelOffsetBars = 5;
input bool              InpEnableColorIntensity = true;
input double            InpMaxFadeDistance = 5.0;

input string            Sep7 = "===== Angle Filtering =====";
input bool              InpEnableAngleFilter = false;
input double            InpMinLineAngle = 0.5;
input double            InpMaxLineAngle = 45.0;

input string            Sep8 = "===== 🚀 Performance Optimization =====";
input bool              InpUseOptimizations = true;
input bool              InpUseCaching = true;
input bool              InpUseSlopeFilter = true;
input bool              InpUseEarlyExit = false;
input double            InpEarlyExitThreshold = 150.0;
input bool              InpUseSpatialIndex = false;
input int               InpSpatialGridSize = 20;
input string            Sep9 = "===== Export Settings =====";
input string            InpExportFileName = "FractalTrendlines";  // Export file name  
input bool              InpIncludeHeader = true;                  // Include header row
input int               InpExportBars = 500;                    // Number of bars to export



//--- Indicator buffers
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];
double ExtPeakLine1[];
double ExtPeakLine2[];
double ExtPeakLine3[];
double ExtBottomLine1[];
double ExtBottomLine2[];
double ExtBottomLine3[];
double ExtHighMapBuffer[];
double ExtLowMapBuffer[];

//--- Global variables
int    ExtSideBars;
int    ExtMinBars;
int    ExtSideBars119;
int    ExtMinBars119;
int    ExtATRHandle = INVALID_HANDLE;

int    ExtLastRatesTotal = 0;
datetime ExtLastBarTime = 0;

//--- Effective scoring weights (resolved from preset or manual inputs)
int    ExtWeightFractals  = 25;
int    ExtWeightSlope     = 15;
int    ExtWeightLength    = 10;
int    ExtWeightProximity = 50;

datetime ExtLastAlertTime = 0;
string   ExtLastAlertCondition = "";
datetime ExtCondition1LastAlert = 0;
datetime ExtCondition2LastAlert = 0;
datetime ExtCondition3LastAlert = 0;
datetime ExtCondition4LastAlert = 0;

//--- Structure for trendline data
struct FractalLine
  {
   int               bar_start;
   int               bar_end;
   double            price_start;
   double            price_end;
   int               fractals_touched;
   int               touched_bars[];
   int               length_bars;
   double            slope;
   double            angle_degrees;     // SIGNED angle
   double            score;
   double            line_price_at_current;
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
//| OPTIMIZATION 3: LINE CACHE                                       |
//+------------------------------------------------------------------+
class CLineCache
{
private:
   int       m_line_bar_start[];
   int       m_line_bar_end[];
   double    m_line_price_start[];
   double    m_line_price_end[];
   int       m_line_fractals_touched[];
   int       m_line_length_bars[];
   double    m_line_slope[];
   double    m_line_angle_degrees[];
   double    m_line_score[];
   double    m_line_price_at_current[];
   
   double    m_high_map_snapshot[];
   double    m_low_map_snapshot[];
   datetime  m_cache_time;
   bool      m_valid;
   bool      m_enabled;
   
public:
   CLineCache() : m_valid(false), m_enabled(true) {}
   
   void SetEnabled(bool enabled) { m_enabled = enabled; }
   void Invalidate()              { m_valid = false; }  // Force re-score on next run
   
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
   
   void Store(FractalLine &lines[], double &high_map[], double &low_map[], int lookback)
   {
      if(!m_enabled) return;
      
      int line_count = ArraySize(lines);
      
      ArrayResize(m_line_bar_start, line_count);
      ArrayResize(m_line_bar_end, line_count);
      ArrayResize(m_line_price_start, line_count);
      ArrayResize(m_line_price_end, line_count);
      ArrayResize(m_line_fractals_touched, line_count);
      ArrayResize(m_line_length_bars, line_count);
      ArrayResize(m_line_slope, line_count);
      ArrayResize(m_line_angle_degrees, line_count);
      ArrayResize(m_line_score, line_count);
      ArrayResize(m_line_price_at_current, line_count);
      
      for(int i = 0; i < line_count; i++)
      {
         m_line_bar_start[i] = lines[i].bar_start;
         m_line_bar_end[i] = lines[i].bar_end;
         m_line_price_start[i] = lines[i].price_start;
         m_line_price_end[i] = lines[i].price_end;
         m_line_fractals_touched[i] = lines[i].fractals_touched;
         m_line_length_bars[i] = lines[i].length_bars;
         m_line_slope[i] = lines[i].slope;
         m_line_angle_degrees[i] = lines[i].angle_degrees;
         m_line_score[i] = lines[i].score;
         m_line_price_at_current[i] = lines[i].line_price_at_current;
      }
      
      ArrayResize(m_high_map_snapshot, lookback);
      ArrayResize(m_low_map_snapshot, lookback);
      ArrayCopy(m_high_map_snapshot, high_map, 0, 0, lookback);
      ArrayCopy(m_low_map_snapshot, low_map, 0, 0, lookback);
      
      m_cache_time = TimeCurrent();
      m_valid = true;
   }
   
   void Retrieve(FractalLine &lines[])
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
         lines[i].fractals_touched = m_line_fractals_touched[i];
         lines[i].length_bars = m_line_length_bars[i];
         lines[i].slope = m_line_slope[i];
         lines[i].angle_degrees = m_line_angle_degrees[i];
         lines[i].score = m_line_score[i];
         lines[i].line_price_at_current = m_line_price_at_current[i];
         
         ArrayResize(lines[i].touched_bars, 0);
      }
   }
   
};

//+------------------------------------------------------------------+
//| Global optimization objects                                      |
//+------------------------------------------------------------------+
CSlopeFilter   g_slope_filter;
CSpatialGrid   g_spatial_grid;
CLineCache     g_line_cache_peak;
CLineCache     g_line_cache_bottom;

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
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Trendlines");
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
      case PRESET_PURE_STRUCTURE:    // Fractals:45 Slope:15 Length:30 Proximity:10
         ExtWeightFractals=45; ExtWeightSlope=15; ExtWeightLength=30; ExtWeightProximity=10; break;
      case PRESET_STRUCTURE_BIASED:  // Fractals:35 Slope:15 Length:25 Proximity:25
         ExtWeightFractals=35; ExtWeightSlope=15; ExtWeightLength=25; ExtWeightProximity=25; break;
      case PRESET_BALANCED:          // Fractals:30 Slope:10 Length:20 Proximity:40
         ExtWeightFractals=30; ExtWeightSlope=10; ExtWeightLength=20; ExtWeightProximity=40; break;
      case PRESET_PROXIMITY_BIASED:  // Fractals:20 Slope:5  Length:10 Proximity:65
         ExtWeightFractals=20; ExtWeightSlope=5;  ExtWeightLength=10; ExtWeightProximity=65; break;
      case PRESET_PURE_PROXIMITY:    // Fractals:10 Slope:5  Length:5  Proximity:80
         ExtWeightFractals=10; ExtWeightSlope=5;  ExtWeightLength=5;  ExtWeightProximity=80; break;
      default: // PRESET_MANUAL
         ExtWeightFractals=InpWeightFractals; ExtWeightSlope=InpWeightSlope;
         ExtWeightLength=InpWeightLength;     ExtWeightProximity=InpWeightProximity; break;
     }

   //--- Invalidate line cache so lines are re-scored with new weights
   g_line_cache_peak.Invalidate();
   g_line_cache_bottom.Invalidate();

   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;
   ExtSideBars119 = (InpFractalBars119 - 1) / 2;
   ExtMinBars119 = InpFractalBars119;

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

   if(InpEnableAngleFilter)
     {
      if(InpMinLineAngle < 0 || InpMaxLineAngle > 90)
        {
         Print("ERROR: Angle range must be between 0° and 90°");
         return INIT_PARAMETERS_INCORRECT;
        }
      if(InpMinLineAngle >= InpMaxLineAngle)
        {
         Print("ERROR: InpMinLineAngle must be less than InpMaxLineAngle");
         return INIT_PARAMETERS_INCORRECT;
        }
     }

   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   SetIndexBuffer(4, ExtPeakLine1, INDICATOR_DATA);
   SetIndexBuffer(5, ExtPeakLine2, INDICATOR_DATA);
   SetIndexBuffer(6, ExtPeakLine3, INDICATOR_DATA);
   SetIndexBuffer(7, ExtBottomLine1, INDICATOR_DATA);
   SetIndexBuffer(8, ExtBottomLine2, INDICATOR_DATA);
   SetIndexBuffer(9, ExtBottomLine3, INDICATOR_DATA);
   SetIndexBuffer(10, ExtHighMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(11, ExtLowMapBuffer, INDICATOR_CALCULATIONS);

   ArraySetAsSeries(ExtUpperBuffer, true);
   ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true);
   ArraySetAsSeries(ExtLowerBuffer119, true);
   ArraySetAsSeries(ExtPeakLine1, true);
   ArraySetAsSeries(ExtPeakLine2, true);
   ArraySetAsSeries(ExtPeakLine3, true);
   ArraySetAsSeries(ExtBottomLine1, true);
   ArraySetAsSeries(ExtBottomLine2, true);
   ArraySetAsSeries(ExtBottomLine3, true);
   ArraySetAsSeries(ExtHighMapBuffer, true);
   ArraySetAsSeries(ExtLowMapBuffer, true);

   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

   PlotIndexSetInteger(0, PLOT_ARROW, 108);
   PlotIndexSetInteger(0, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetInteger(0, PLOT_ARROW_SHIFT, -InpSymbolOffset);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(1, PLOT_ARROW, 108);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, (int)InpSymbolSize);
   PlotIndexSetInteger(1, PLOT_ARROW_SHIFT, InpSymbolOffset);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(2, PLOT_ARROW, 119);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, InpSymbol119PeakColor);
   PlotIndexSetInteger(2, PLOT_ARROW_SHIFT, -InpSymbolOffset119);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(3, PLOT_ARROW, 119);
   PlotIndexSetInteger(3, PLOT_LINE_WIDTH, (int)InpSymbolSize119);
   PlotIndexSetInteger(3, PLOT_LINE_COLOR, InpSymbol119BottomColor);
   PlotIndexSetInteger(3, PLOT_ARROW_SHIFT, InpSymbolOffset119);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   if(!InpShowSymbol119)
     {
      PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_NONE);
      PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_NONE);
     }

   for(int i = 4; i <= 9; i++)
      PlotIndexSetDouble(i, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpPeakLineColor);
   PlotIndexSetInteger(5, PLOT_LINE_COLOR, InpPeakLineColor);
   PlotIndexSetInteger(6, PLOT_LINE_COLOR, InpPeakLineColor);
   PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpBottomLineColor);
   PlotIndexSetInteger(8, PLOT_LINE_COLOR, InpBottomLineColor);
   PlotIndexSetInteger(9, PLOT_LINE_COLOR, InpBottomLineColor);

   if(!InpShowTrendlines)
     {
      for(int i = 4; i <= 9; i++)
         PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_NONE);
     }

   string pattern_name = IntegerToString(InpFractalBars) + "-bar";
   IndicatorSetString(INDICATOR_SHORTNAME, "Fractal SR (V5.54)");

   Print("=== Fractal SR V5.54 ===");
   Print("  FIXED: Angle signs now show slope direction");
   Print("  Positive = Ascending, Negative = Descending");
   Print("  Symbol 108: ", pattern_name, " (", ExtSideBars, " bars each side)");

   CreateExportButton();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE)
      IndicatorRelease(ExtATRHandle);

   DeleteAllLabels();
   Comment("");
   ObjectDelete(0, EXPORT_BUTTON_NAME);
  }
//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
    //--- Handle "Export All" custom event from EA
    if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
      {
        if(ExportTrendlineData())
           Print("SUCCESS: [Export All] Fractal trendline data exported successfully");
        else
           Print("ERROR: [Export All] Failed to export fractal trendline data.");
        return;
      }

    if(id == CHARTEVENT_OBJECT_CLICK)
      {
        if(sparam == EXPORT_BUTTON_NAME)
          {
            ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
            ExportTrendlineData();
            ChartRedraw(0);
          }
      }
  }

//+------------------------------------------------------------------+
//| Export trendline data to file                                    |
//+------------------------------------------------------------------+
bool ExportTrendlineData()
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
    string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;

    Print("Exporting fractal trendline data to: ", full_path);

    ResetLastError();
    int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
    int error = GetLastError();

    if(file_handle == INVALID_HANDLE)
      {
        Print("ERROR: Failed to open file for writing. Error: ", error);
        return false;
      }

    bool write_success = true;
    
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
        string header = "timestamp\tsymbol\ttimeframe\tclose\thoriz_peak_line_1\thoriz_peak_line_2\thoriz_peak_line_3\thoriz_bottom_line_1\thoriz_bottom_line_2\thoriz_bottom_line_3\thoriz_high_map\thoriz_low_map";
        write_success &= FileWrite(file_handle, header) > 0;
      }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    for(int row = 0; row < copied && row < InpExportBars; row++)
      {
        // Reverse index for indicator buffers (series indexed, 0=newest)
        // while time_array is normal indexed (0=oldest)
        int buf_idx = copied - 1 - row;

        string line = IntegerToString((long)(iTime(Symbol(), Period(), buf_idx) - gmt_offset)) + "\t";
        line += symbol + "\t";
        line += tf_str + "\t";

        if(row < close_copied)
            line += DoubleToString(close_array[row], _Digits) + "\t";
        else
            line += "\t";

        string peak1 = (ExtPeakLine1[buf_idx] == 0.0 || ExtPeakLine1[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine1[buf_idx], 2);
        line += peak1 + "\t";

        string peak2 = (ExtPeakLine2[buf_idx] == 0.0 || ExtPeakLine2[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine2[buf_idx], 2);
        line += peak2 + "\t";

        string peak3 = (ExtPeakLine3[buf_idx] == 0.0 || ExtPeakLine3[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine3[buf_idx], 2);
        line += peak3 + "\t";

        string bottom1 = (ExtBottomLine1[buf_idx] == 0.0 || ExtBottomLine1[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine1[buf_idx], 2);
        line += bottom1 + "\t";

        string bottom2 = (ExtBottomLine2[buf_idx] == 0.0 || ExtBottomLine2[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine2[buf_idx], 2);
        line += bottom2 + "\t";

        string bottom3 = (ExtBottomLine3[buf_idx] == 0.0 || ExtBottomLine3[buf_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine3[buf_idx], 2);
        line += bottom3 + "\t";

        string hmap = (ExtHighMapBuffer[buf_idx] == 0.0) ? "" : DoubleToString(ExtHighMapBuffer[buf_idx], 2);
        line += hmap + "\t";

        string lmap = (ExtLowMapBuffer[buf_idx] == 0.0) ? "" : DoubleToString(ExtLowMapBuffer[buf_idx], 2);
        line += lmap;

        write_success &= FileWrite(file_handle, line) > 0;
      }

    FileClose(file_handle);

    if(!write_success)
      {
        Print("ERROR: Failed to write some data to file");
        return false;
      }

    Print("Fractal trendline data successfully exported to: ", filename);
    Print("Total rows exported: ", copied);
    Alert("Export successful! File: ", filename);
    
    return true;
  }



//+------------------------------------------------------------------+
void DeleteAllLabels()
  {
   for(int i = ObjectsTotal(0, 0, OBJ_TEXT) - 1; i >= 0; i--)
     {
      string obj_name = ObjectName(0, i, 0, OBJ_TEXT);
      if(StringFind(obj_name, "FSR_Label_") >= 0)
         ObjectDelete(0, obj_name);
     }
  }

//+------------------------------------------------------------------+
color CalculateAdaptiveColor(double line_price, double current_price, color base_color)
  {
   if(!InpEnableColorIntensity)
      return base_color;

   double distance_pct = MathAbs(current_price - line_price) / current_price * 100.0;

   double intensity = 1.0;
   if(distance_pct > InpMaxFadeDistance)
      intensity = 0.3;
   else
      if(distance_pct > InpMaxFadeDistance * 0.8)
         intensity = 0.5;
      else
         if(distance_pct > InpMaxFadeDistance * 0.6)
            intensity = 0.7;
         else
            if(distance_pct > InpMaxFadeDistance * 0.4)
               intensity = 0.85;

   int r = (base_color & 0xFF);
   int g = ((base_color >> 8) & 0xFF);
   int b = ((base_color >> 16) & 0xFF);

   r = (int)(r * intensity + 128 * (1.0 - intensity));
   g = (int)(g * intensity + 128 * (1.0 - intensity));
   b = (int)(b * intensity + 128 * (1.0 - intensity));

   return (color)((b << 16) | (g << 8) | r);
  }

//+------------------------------------------------------------------+
void DrawLineLabel(string label_id, double price, datetime time_point,
                   string text, color clr, int font_size)
  {
   string obj_name = "FSR_Label_" + label_id;

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
   
   double price_change = price_end - price_start;  // Preserves sign!
   
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
void ClearAllTrendlineBuffers()
  {
   ArrayInitialize(ExtPeakLine1, EMPTY_VALUE);
   ArrayInitialize(ExtPeakLine2, EMPTY_VALUE);
   ArrayInitialize(ExtPeakLine3, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine1, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine2, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine3, EMPTY_VALUE);
  }

//+------------------------------------------------------------------+
//| Find multi-point lines - PRESERVES ANGLE SIGN                    |
//+------------------------------------------------------------------+
void FindMultiPointLinesOptimized(int &fractal_bars[], double &fractal_prices[],
                                   int fractal_count, FractalLine &lines[],
                                   bool is_peak_lines)
{
   ArrayResize(lines, 0);
   if(fractal_count < InpMinFractalTouch) return;
   
   int line_count = 0;
   int target_lines = is_peak_lines ? InpMaxPeakLines : InpMaxBottomLines;
   int high_quality_found = 0;
   
   if(InpUseSpatialIndex && g_spatial_grid.IsEnabled())
   {
      g_spatial_grid.Clear();
      double price_min = fractal_prices[0];
      double price_max = fractal_prices[0];
      for(int i = 1; i < fractal_count; i++)
      {
         if(fractal_prices[i] < price_min) price_min = fractal_prices[i];
         if(fractal_prices[i] > price_max) price_max = fractal_prices[i];
      }
      g_spatial_grid.Init(fractal_bars[fractal_count-1], price_min, price_max, 
                          InpSpatialGridSize, true);
      
      for(int i = 0; i < fractal_count; i++)
         g_spatial_grid.AddFractal(i, fractal_bars[i], fractal_prices[i]);
   }
   
   for(int i = 0; i < fractal_count - 1; i++)
   {
      if(InpUseEarlyExit && high_quality_found >= target_lines)
         break;
      
      for(int j = i + 1; j < fractal_count; j++)
      {
         if(InpUseSlopeFilter && g_slope_filter.IsEnabled())
         {
            if(!g_slope_filter.IsValidSlope(fractal_bars[i], fractal_prices[i],
                                           fractal_bars[j], fractal_prices[j]))
               continue;
         }
         
         int distance_bars = fractal_bars[j] - fractal_bars[i];
         if(distance_bars < InpMinLineLength)
            continue;
         if(InpMaxLineLength > 0 && distance_bars > InpMaxLineLength)
            continue;
         
         double slope = (fractal_prices[j] - fractal_prices[i]) / (double)distance_bars;
         double y_intercept = fractal_prices[i] - slope * fractal_bars[i];
         
         // Calculate SIGNED angle
         double angle = CalculateNormalizedAngle(fractal_prices[i], fractal_prices[j], distance_bars);
         double abs_angle = MathAbs(angle);  // Use absolute value ONLY for filtering
         
         if(InpEnableAngleFilter)
         {
            if(abs_angle < InpMinLineAngle || abs_angle > InpMaxLineAngle)
               continue;
         }
         
         int touched_count = 2;
         int touched_indices[];
         ArrayResize(touched_indices, 2);
         touched_indices[0] = i;
         touched_indices[1] = j;
         
         if(InpUseSpatialIndex && g_spatial_grid.IsEnabled())
         {
            int candidates[];
            g_spatial_grid.GetCandidatesNearLine(fractal_bars[i], fractal_prices[i],
                                                 fractal_bars[j], fractal_prices[j],
                                                 candidates);
            
            for(int c = 0; c < ArraySize(candidates); c++)
            {
               int k = candidates[c];
               if(k == i || k == j) continue;
               if(fractal_bars[k] < fractal_bars[i] || fractal_bars[k] > fractal_bars[j])
                  continue;
               
               double expected_price = slope * fractal_bars[k] + y_intercept;
               double price_diff = MathAbs(fractal_prices[k] - expected_price);
               double tolerance = CalculateTolerance(fractal_prices[k]);
               
               if(price_diff <= tolerance)
               {
                  touched_count++;
                  ArrayResize(touched_indices, touched_count);
                  touched_indices[touched_count - 1] = k;
               }
            }
         }
         else
         {
            for(int k = 0; k < fractal_count; k++)
            {
               if(k == i || k == j) continue;
               if(fractal_bars[k] < fractal_bars[i] || fractal_bars[k] > fractal_bars[j])
                  continue;
               
               double expected_price = slope * fractal_bars[k] + y_intercept;
               double price_diff = MathAbs(fractal_prices[k] - expected_price);
               double tolerance = CalculateTolerance(fractal_prices[k]);
               
               if(price_diff <= tolerance)
               {
                  touched_count++;
                  ArrayResize(touched_indices, touched_count);
                  touched_indices[touched_count - 1] = k;
               }
            }
         }
         
         if(touched_count < InpMinFractalTouch)
            continue;
         
         ArrayResize(lines, line_count + 1);
         lines[line_count].bar_start = fractal_bars[i];
         lines[line_count].bar_end = fractal_bars[j];
         lines[line_count].price_start = fractal_prices[i];
         lines[line_count].price_end = fractal_prices[j];
         lines[line_count].fractals_touched = touched_count;
         lines[line_count].length_bars = distance_bars;
         lines[line_count].slope = slope;
         lines[line_count].angle_degrees = angle;  // Store SIGNED angle
         
         ArrayResize(lines[line_count].touched_bars, touched_count);
         for(int t = 0; t < touched_count; t++)
            lines[line_count].touched_bars[t] = fractal_bars[touched_indices[t]];
         
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
void ScoreLines(FractalLine &lines[], int rates_total, double current_price)
  {
   for(int i = 0; i < ArraySize(lines); i++)
     {
      double slope = lines[i].slope;
      double y_intercept = lines[i].price_start - slope * lines[i].bar_start;

      double line_price_now = slope * (rates_total - 1) + y_intercept;
      double price_diff_percent = MathAbs(current_price - line_price_now) / current_price * 100.0;

      double score = 0;

      score += lines[i].fractals_touched * ExtWeightFractals;

      double abs_angle = MathAbs(lines[i].angle_degrees);
      double slope_score = (90.0 - abs_angle) / 90.0;
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
void FilterTopLines(FractalLine &lines[], int max_lines)
  {
   int size = ArraySize(lines);
   if(size == 0)
      return;

   for(int i = 0; i < size - 1; i++)
     {
      for(int j = i + 1; j < size; j++)
        {
         if(lines[j].score > lines[i].score)
           {
            FractalLine temp = lines[i];
            lines[i] = lines[j];
            lines[j] = temp;
           }
        }
     }

   if(size > max_lines)
      ArrayResize(lines, max_lines);
  }

//+------------------------------------------------------------------+
void DrawTrendline(double &buffer[], FractalLine &line, int rates_total)
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
         buffer[i] = slope * bar_number + y_intercept;
      else
         buffer[i] = EMPTY_VALUE;
     }
  }

//+------------------------------------------------------------------+
//| Build trendlines with SIGNED angles                              |
//+------------------------------------------------------------------+
void BuildMultiPointTrendlines(const int rates_total)
{
   ClearAllTrendlineBuffers();
   DeleteAllLabels();
   
   double current_price = iClose(_Symbol, PERIOD_CURRENT, 0);
   int lookback_limit = InpLookbackBars > 0 ? MathMin(InpLookbackBars, rates_total) : rates_total;
   
   if(InpUseOptimizations)
   {
      if(InpUseSlopeFilter && InpEnableAngleFilter)
      {
         double atr = 0;
         if(ExtATRHandle != INVALID_HANDLE)
         {
            double atr_array[1];
            if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0)
               atr = atr_array[0];
         }
         g_slope_filter.Init(InpMinLineAngle, InpMaxLineAngle, atr, true);
      }
      else
      {
         g_slope_filter.Init(0, 0, 0, false);
      }
      
      g_line_cache_peak.SetEnabled(InpUseCaching);
      g_line_cache_bottom.SetEnabled(InpUseCaching);
   }
   
   //=================================================================
   // PEAK LINES
   //=================================================================
   FractalLine peak_lines[];
   
   bool use_cache = InpUseOptimizations && InpUseCaching && 
                    g_line_cache_peak.IsValid(ExtHighMapBuffer, ExtLowMapBuffer, lookback_limit);
   
   if(use_cache)
   {
      g_line_cache_peak.Retrieve(peak_lines);
   }
   else
   {
      int peak_bars[];
      double peak_prices[];
      ArrayResize(peak_bars, 0);
      ArrayResize(peak_prices, 0);
      
      for(int i = 0; i < lookback_limit; i++)
      {
         if(ExtHighMapBuffer[i] > 0)
         {
            int size = ArraySize(peak_bars);
            ArrayResize(peak_bars, size + 1);
            ArrayResize(peak_prices, size + 1);
            peak_bars[size] = rates_total - 1 - i;
            peak_prices[size] = ExtHighMapBuffer[i];
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
      
      if(ArraySize(peak_bars) >= InpMinFractalTouch)
      {
         FindMultiPointLinesOptimized(peak_bars, peak_prices, ArraySize(peak_bars), peak_lines, true);
         
         if(ArraySize(peak_lines) > 0)
         {
            ScoreLines(peak_lines, rates_total, current_price);
            FilterTopLines(peak_lines, InpMaxPeakLines);
         }
         
         if(InpUseOptimizations && InpUseCaching)
            g_line_cache_peak.Store(peak_lines, ExtHighMapBuffer, ExtLowMapBuffer, lookback_limit);
      }
   }
   
   // Draw peak lines with SIGNED angles
   if(ArraySize(peak_lines) >= 1)
   {
      DrawTrendline(ExtPeakLine1, peak_lines[0], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(peak_lines[0].line_price_at_current,
                                                   current_price, InpPeakLineColor);
         PlotIndexSetInteger(4, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("P-P1: %d touches, %d bars, %.1f°",
                                         peak_lines[0].fractals_touched,
                                         peak_lines[0].length_bars,
                                         peak_lines[0].angle_degrees);  // SIGNED angle
         DrawLineLabel("P_P1", peak_lines[0].line_price_at_current,
                      label_time, label_text, InpPeakLineColor, InpLabelFontSize);
      }
   }
   
   if(ArraySize(peak_lines) >= 2)
   {
      DrawTrendline(ExtPeakLine2, peak_lines[1], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(peak_lines[1].line_price_at_current,
                                                   current_price, InpPeakLineColor);
         PlotIndexSetInteger(5, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("P-P2: %d touches, %d bars, %.1f°",
                                         peak_lines[1].fractals_touched,
                                         peak_lines[1].length_bars,
                                         peak_lines[1].angle_degrees);  // SIGNED angle
         DrawLineLabel("P_P2", peak_lines[1].line_price_at_current,
                      label_time, label_text, InpPeakLineColor, InpLabelFontSize);
      }
   }
   
   if(ArraySize(peak_lines) >= 3)
   {
      DrawTrendline(ExtPeakLine3, peak_lines[2], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(peak_lines[2].line_price_at_current,
                                                   current_price, InpPeakLineColor);
         PlotIndexSetInteger(6, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("P-P3: %d touches, %d bars, %.1f°",
                                         peak_lines[2].fractals_touched,
                                         peak_lines[2].length_bars,
                                         peak_lines[2].angle_degrees);  // SIGNED angle
         DrawLineLabel("P_P3", peak_lines[2].line_price_at_current,
                      label_time, label_text, InpPeakLineColor, InpLabelFontSize);
      }
   }
   
   //=================================================================
   // BOTTOM LINES
   //=================================================================
   FractalLine bottom_lines[];
   
   use_cache = InpUseOptimizations && InpUseCaching && 
               g_line_cache_bottom.IsValid(ExtHighMapBuffer, ExtLowMapBuffer, lookback_limit);
   
   if(use_cache)
   {
      g_line_cache_bottom.Retrieve(bottom_lines);
   }
   else
   {
      int bottom_bars[];
      double bottom_prices[];
      ArrayResize(bottom_bars, 0);
      ArrayResize(bottom_prices, 0);
      
      for(int i = 0; i < lookback_limit; i++)
      {
         if(ExtLowMapBuffer[i] > 0)
         {
            int size = ArraySize(bottom_bars);
            ArrayResize(bottom_bars, size + 1);
            ArrayResize(bottom_prices, size + 1);
            bottom_bars[size] = rates_total - 1 - i;
            bottom_prices[size] = ExtLowMapBuffer[i];
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
      
      if(ArraySize(bottom_bars) >= InpMinFractalTouch)
      {
         FindMultiPointLinesOptimized(bottom_bars, bottom_prices, ArraySize(bottom_bars), bottom_lines, false);
         
         if(ArraySize(bottom_lines) > 0)
         {
            ScoreLines(bottom_lines, rates_total, current_price);
            FilterTopLines(bottom_lines, InpMaxBottomLines);
         }
         
         if(InpUseOptimizations && InpUseCaching)
            g_line_cache_bottom.Store(bottom_lines, ExtHighMapBuffer, ExtLowMapBuffer, lookback_limit);
      }
   }
   
   // Draw bottom lines with SIGNED angles
   if(ArraySize(bottom_lines) >= 1)
   {
      DrawTrendline(ExtBottomLine1, bottom_lines[0], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(bottom_lines[0].line_price_at_current,
                                                   current_price, InpBottomLineColor);
         PlotIndexSetInteger(7, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("B-B1: %d touches, %d bars, %.1f°",
                                         bottom_lines[0].fractals_touched,
                                         bottom_lines[0].length_bars,
                                         bottom_lines[0].angle_degrees);  // SIGNED angle
         DrawLineLabel("B_B1", bottom_lines[0].line_price_at_current,
                      label_time, label_text, InpBottomLineColor, InpLabelFontSize);
      }
   }
   
   if(ArraySize(bottom_lines) >= 2)
   {
      DrawTrendline(ExtBottomLine2, bottom_lines[1], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(bottom_lines[1].line_price_at_current,
                                                   current_price, InpBottomLineColor);
         PlotIndexSetInteger(8, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("B-B2: %d touches, %d bars, %.1f°",
                                         bottom_lines[1].fractals_touched,
                                         bottom_lines[1].length_bars,
                                         bottom_lines[1].angle_degrees);  // SIGNED angle
         DrawLineLabel("B_B2", bottom_lines[1].line_price_at_current,
                      label_time, label_text, InpBottomLineColor, InpLabelFontSize);
      }
   }
   
   if(ArraySize(bottom_lines) >= 3)
   {
      DrawTrendline(ExtBottomLine3, bottom_lines[2], rates_total);
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(bottom_lines[2].line_price_at_current,
                                                   current_price, InpBottomLineColor);
         PlotIndexSetInteger(9, PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("B-B3: %d touches, %d bars, %.1f°",
                                         bottom_lines[2].fractals_touched,
                                         bottom_lines[2].length_bars,
                                         bottom_lines[2].angle_degrees);  // SIGNED angle
         DrawLineLabel("B_B3", bottom_lines[2].line_price_at_current,
                      label_time, label_text, InpBottomLineColor, InpLabelFontSize);
      }
   }
}

//+------------------------------------------------------------------+
bool IsPriceNear(double current_price, double reference_price, double tolerance_percent)
  {
   if(reference_price == 0 || reference_price == EMPTY_VALUE)
      return false;

   double tolerance = reference_price * (tolerance_percent / 100.0);
   return (MathAbs(current_price - reference_price) <= tolerance);
  }

//+------------------------------------------------------------------+
//| Find 108 Fractals with proper validation                         |
//+------------------------------------------------------------------+
void Find108Fractals(const int rates_total,
                     double &most_recent_peak, double &second_recent_peak,
                     double &most_recent_bottom, double &second_recent_bottom)
  {
   most_recent_peak = 0;
   second_recent_peak = 0;
   most_recent_bottom = 0;
   second_recent_bottom = 0;

   int peak_count = 0;
   int bottom_count = 0;

   for(int i = 0; i < rates_total && !IsStopped(); i++)
     {
      // Validate peak value
      if(peak_count < 2)
        {
         if(ExtUpperBuffer[i] != EMPTY_VALUE)
           {
            if(ExtUpperBuffer[i] > 0)
              {
               // Check if value is reasonable (not corrupted)
               if(ExtUpperBuffer[i] < 1000000)  // Simple sanity check
                 {
                  if(peak_count == 0)
                     most_recent_peak = ExtUpperBuffer[i];
                  else if(peak_count == 1)
                     second_recent_peak = ExtUpperBuffer[i];
                  peak_count++;
                 }
              }
           }
        }

      // Validate bottom value
      if(bottom_count < 2)
        {
         if(ExtLowerBuffer[i] != EMPTY_VALUE)
           {
            if(ExtLowerBuffer[i] > 0)
              {
               // Check if value is reasonable (not corrupted)
               if(ExtLowerBuffer[i] < 1000000)  // Simple sanity check
                 {
                  if(bottom_count == 0)
                     most_recent_bottom = ExtLowerBuffer[i];
                  else if(bottom_count == 1)
                     second_recent_bottom = ExtLowerBuffer[i];
                  bottom_count++;
                 }
              }
           }
        }

      if(peak_count >= 2 && bottom_count >= 2)
         break;
     }
  }

//+------------------------------------------------------------------+
//| Find 119 Fractals with proper validation                         |
//+------------------------------------------------------------------+
void Find119Fractals(const int rates_total,
                     double &most_recent_peak, double &second_recent_peak,
                     double &most_recent_bottom, double &second_recent_bottom)
  {
   most_recent_peak = 0;
   second_recent_peak = 0;
   most_recent_bottom = 0;
   second_recent_bottom = 0;

   int peak_count = 0;
   int bottom_count = 0;

   for(int i = 0; i < rates_total && !IsStopped(); i++)
     {
      // Validate peak value
      if(peak_count < 2)
        {
         if(ExtUpperBuffer119[i] != EMPTY_VALUE)
           {
            if(ExtUpperBuffer119[i] > 0)
              {
               // Check if value is reasonable (not corrupted)
               if(ExtUpperBuffer119[i] < 1000000)  // Simple sanity check
                 {
                  if(peak_count == 0)
                     most_recent_peak = ExtUpperBuffer119[i];
                  else if(peak_count == 1)
                     second_recent_peak = ExtUpperBuffer119[i];
                  peak_count++;
                 }
              }
           }
        }

      // Validate bottom value
      if(bottom_count < 2)
        {
         if(ExtLowerBuffer119[i] != EMPTY_VALUE)
           {
            if(ExtLowerBuffer119[i] > 0)
              {
               // Check if value is reasonable (not corrupted)
               if(ExtLowerBuffer119[i] < 1000000)  // Simple sanity check
                 {
                  if(bottom_count == 0)
                     most_recent_bottom = ExtLowerBuffer119[i];
                  else if(bottom_count == 1)
                     second_recent_bottom = ExtLowerBuffer119[i];
                  bottom_count++;
                 }
              }
           }
        }

      if(peak_count >= 2 && bottom_count >= 2)
         break;
     }
  }

//+------------------------------------------------------------------+
bool IsPriceNearTrendline(double current_price, int current_bar,
                          double tolerance_percent, string &matched_lines)
  {
   matched_lines = "";
   bool found = false;

   if(ExtPeakLine1[current_bar] != EMPTY_VALUE && ExtPeakLine1[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtPeakLine1[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "P-P1";
         found = true;
        }
     }

   if(ExtPeakLine2[current_bar] != EMPTY_VALUE && ExtPeakLine2[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtPeakLine2[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "P-P2";
         found = true;
        }
     }

   if(ExtPeakLine3[current_bar] != EMPTY_VALUE && ExtPeakLine3[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtPeakLine3[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "P-P3";
         found = true;
        }
     }

   if(ExtBottomLine1[current_bar] != EMPTY_VALUE && ExtBottomLine1[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtBottomLine1[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "B-B1";
         found = true;
        }
     }

   if(ExtBottomLine2[current_bar] != EMPTY_VALUE && ExtBottomLine2[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtBottomLine2[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "B-B2";
         found = true;
        }
     }

   if(ExtBottomLine3[current_bar] != EMPTY_VALUE && ExtBottomLine3[current_bar] > 0)
     {
      if(IsPriceNear(current_price, ExtBottomLine3[current_bar], tolerance_percent))
        {
         if(found)
            matched_lines += ", ";
         matched_lines += "B-B3";
         found = true;
        }
     }

   return found;
  }

//+------------------------------------------------------------------+
void CheckProximityAndAlert(const int rates_total)
  {
   if(!InpEnableAlerts || !InpShowSymbol119)
      return;

   int current_bar = 0;
   double current_price = iClose(_Symbol, PERIOD_CURRENT, 0);
   datetime current_time = TimeCurrent();

   double most_recent_peak_108, second_recent_peak_108;
   double most_recent_bottom_108, second_recent_bottom_108;
   Find108Fractals(rates_total, most_recent_peak_108, second_recent_peak_108,
                   most_recent_bottom_108, second_recent_bottom_108);

   double most_recent_peak, second_recent_peak;
   double most_recent_bottom, second_recent_bottom;
   Find119Fractals(rates_total, most_recent_peak, second_recent_peak,
                   most_recent_bottom, second_recent_bottom);

   string status_message = "=== Fractal Support/Resistance Monitor V5.54 ===\n";
   status_message += "Master Alert Switch: " + (InpMasterAlertSwitch ? "ON" : "OFF") + "\n";
   status_message += "Current Price: " + DoubleToString(current_price, _Digits) + "\n";
   status_message += "Tolerance: ±" + DoubleToString(InpTolerancePercent_Alert, 2) + "%\n\n";

   status_message += "--- 108 Fractals (Trendline Base) ---\n";
   if(most_recent_peak_108 > 0)
      status_message += "Most Recent Peak: " + DoubleToString(most_recent_peak_108, _Digits) + "\n";
   if(most_recent_bottom_108 > 0)
      status_message += "Most Recent Bottom: " + DoubleToString(most_recent_bottom_108, _Digits) + "\n";

   status_message += "\n--- 119 Fractals (Alert Trigger) ---\n";
   if(most_recent_peak > 0)
      status_message += "Most Recent Peak: " + DoubleToString(most_recent_peak, _Digits) + "\n";
   if(most_recent_bottom > 0)
      status_message += "Most Recent Bottom: " + DoubleToString(most_recent_bottom, _Digits) + "\n";

   bool alert_triggered = false;
   string alert_message = "";
   string matched_trendlines = "";
   int condition_number = 0;

   if(most_recent_peak > 0 && IsPriceNear(current_price, most_recent_peak, InpTolerancePercent_Alert))
     {
      if(IsPriceNearTrendline(current_price, current_bar, InpTolerancePercent_Alert, matched_trendlines))
        {
         condition_number = 1;
         alert_message = _Symbol + " - Price near MOST RECENT PEAK + Trendline\n";
         alert_message += "Price: " + DoubleToString(current_price, _Digits) + "\n";
         alert_message += "Peak: " + DoubleToString(most_recent_peak, _Digits) + "\n";
         alert_message += "Trendlines: " + matched_trendlines;

         if(InpAlertCooldownSeconds == 0 ||
            (current_time - ExtCondition1LastAlert) >= InpAlertCooldownSeconds)
           {
            alert_triggered = true;
           }
        }
     }

   if(!alert_triggered && second_recent_peak > 0 && IsPriceNear(current_price, second_recent_peak, InpTolerancePercent_Alert))
     {
      if(IsPriceNearTrendline(current_price, current_bar, InpTolerancePercent_Alert, matched_trendlines))
        {
         condition_number = 2;
         alert_message = _Symbol + " - Price near 2ND RECENT PEAK + Trendline\n";
         alert_message += "Price: " + DoubleToString(current_price, _Digits) + "\n";
         alert_message += "2nd Peak: " + DoubleToString(second_recent_peak, _Digits) + "\n";
         alert_message += "Trendlines: " + matched_trendlines;

         if(InpAlertCooldownSeconds == 0 ||
            (current_time - ExtCondition2LastAlert) >= InpAlertCooldownSeconds)
           {
            alert_triggered = true;
           }
        }
     }

   if(!alert_triggered && most_recent_bottom > 0 && IsPriceNear(current_price, most_recent_bottom, InpTolerancePercent_Alert))
     {
      if(IsPriceNearTrendline(current_price, current_bar, InpTolerancePercent_Alert, matched_trendlines))
        {
         condition_number = 3;
         alert_message = _Symbol + " - Price near MOST RECENT BOTTOM + Trendline\n";
         alert_message += "Price: " + DoubleToString(current_price, _Digits) + "\n";
         alert_message += "Bottom: " + DoubleToString(most_recent_bottom, _Digits) + "\n";
         alert_message += "Trendlines: " + matched_trendlines;

         if(InpAlertCooldownSeconds == 0 ||
            (current_time - ExtCondition3LastAlert) >= InpAlertCooldownSeconds)
           {
            alert_triggered = true;
           }
        }
     }

   if(!alert_triggered && second_recent_bottom > 0 && IsPriceNear(current_price, second_recent_bottom, InpTolerancePercent_Alert))
     {
      if(IsPriceNearTrendline(current_price, current_bar, InpTolerancePercent_Alert, matched_trendlines))
        {
         condition_number = 4;
         alert_message = _Symbol + " - Price near 2ND RECENT BOTTOM + Trendline\n";
         alert_message += "Price: " + DoubleToString(current_price, _Digits) + "\n";
         alert_message += "2nd Bottom: " + DoubleToString(second_recent_bottom, _Digits) + "\n";
         alert_message += "Trendlines: " + matched_trendlines;

         if(InpAlertCooldownSeconds == 0 ||
            (current_time - ExtCondition4LastAlert) >= InpAlertCooldownSeconds)
           {
            alert_triggered = true;
           }
        }
     }

   status_message += "\n--- Alert Status ---\n";
   if(condition_number > 0)
     {
      status_message += "🔔 CONDITION DETECTED\n";
      status_message += "Matched Trendlines: " + matched_trendlines + "\n";

      if(alert_triggered && InpMasterAlertSwitch)
         status_message += "✅ Alert SENT\n";
      else
         if(alert_triggered && !InpMasterAlertSwitch)
            status_message += "🔇 Alert BLOCKED (Master Switch OFF)\n";
     }
   else
     {
      status_message += "No proximity conditions detected.\n";
     }

   if(InpShowChartComment)
      Comment(status_message);

   if(alert_triggered && InpMasterAlertSwitch)
     {
      if(condition_number == 1)
         ExtCondition1LastAlert = current_time;
      else
         if(condition_number == 2)
            ExtCondition2LastAlert = current_time;
         else
            if(condition_number == 3)
               ExtCondition3LastAlert = current_time;
            else
               if(condition_number == 4)
                  ExtCondition4LastAlert = current_time;

      Alert(alert_message);

      if(InpPlaySound && InpAlertSound != "")
         PlaySound(InpAlertSound);

      if(InpSendNotification)
         SendNotification(alert_message);
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
   int global_min_bars = MathMax(ExtMinBars, ExtMinBars119);
   if(rates_total < global_min_bars)
      return(0);

   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);
   ArraySetAsSeries(time, true);

   int start_calc;
   bool first_run = false;
   bool new_bar = false;

   if(prev_calculated < global_min_bars + 2)
     {
      start_calc = 0;
      first_run = true;

      ArrayInitialize(ExtUpperBuffer, EMPTY_VALUE);
      ArrayInitialize(ExtLowerBuffer, EMPTY_VALUE);
      ArrayInitialize(ExtUpperBuffer119, EMPTY_VALUE);
      ArrayInitialize(ExtLowerBuffer119, EMPTY_VALUE);
      ClearAllTrendlineBuffers();
      ArrayInitialize(ExtHighMapBuffer, 0.0);
      ArrayInitialize(ExtLowMapBuffer, 0.0);

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

      int max_side_bars = MathMax(ExtSideBars, ExtSideBars119);
      start_calc = rates_total - prev_calculated + max_side_bars + 1;
      if(start_calc < 0)
         start_calc = 0;
     }

   int start_108 = MathMax(ExtSideBars, start_calc);
   int end_108 = rates_total - ExtSideBars - 1;

   bool fractals_changed = false;

   for(int i = start_108; i < end_108 && !IsStopped(); i++)
     {
      double old_upper = ExtUpperBuffer[i];
      double old_lower = ExtLowerBuffer[i];

      ExtUpperBuffer[i] = EMPTY_VALUE;
      ExtLowerBuffer[i] = EMPTY_VALUE;
      ExtHighMapBuffer[i] = 0.0;
      ExtLowMapBuffer[i] = 0.0;

      if(IsUpperFractal(high, i, ExtSideBars))
        {
         ExtUpperBuffer[i] = high[i];
         ExtHighMapBuffer[i] = high[i];
         if(old_upper != high[i])
            fractals_changed = true;
        }

      if(IsLowerFractal(low, i, ExtSideBars))
        {
         ExtLowerBuffer[i] = low[i];
         ExtLowMapBuffer[i] = low[i];
         if(old_lower != low[i])
            fractals_changed = true;
        }
     }

   if(InpShowSymbol119)
     {
      int start_119 = MathMax(ExtSideBars119, start_calc);
      int end_119 = rates_total - ExtSideBars119 - 1;

      for(int i = start_119; i < end_119 && !IsStopped(); i++)
        {
         ExtUpperBuffer119[i] = EMPTY_VALUE;
         ExtLowerBuffer119[i] = EMPTY_VALUE;

         if(IsUpperFractal(high, i, ExtSideBars119))
            ExtUpperBuffer119[i] = high[i];

         if(IsLowerFractal(low, i, ExtSideBars119))
            ExtLowerBuffer119[i] = low[i];
        }
     }

   if(InpShowTrendlines)
   {
      if(first_run || new_bar || fractals_changed)
      {
         BuildMultiPointTrendlines(rates_total);
      }
   }

   CheckProximityAndAlert(rates_total);

   return(rates_total);
  }
//+------------------------------------------------------------------+