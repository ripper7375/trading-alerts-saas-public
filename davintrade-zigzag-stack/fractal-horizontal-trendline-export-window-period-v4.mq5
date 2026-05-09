//+------------------------------------------------------------------+
//|                      Fractal S&R Multi-Point Trendlines          |
//|                   Copyright 2000-2025, MetaQuotes Ltd. |
//| Modified: 3 Window Periods Implemented & Export Updated          |
//+------------------------------------------------------------------+
#property copyright "Copyright 2000-2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "5.60"
#property description "Simplified: Top #1 Lines Only, 3 Window Periods Integrated"
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
#property indicator_color6  clrLimeGreen
#property indicator_color7  clrOrange
#property indicator_color8  clrMediumSeaGreen
#property indicator_color9  clrMagenta
#property indicator_color10 clrDeepSkyBlue

#property indicator_label1  "Fractal Up (108)"
#property indicator_label2  "Fractal Down (108)"
#property indicator_label3  "Fractal Up (119)"
#property indicator_label4  "Fractal Down (119)"
#property indicator_label5  "Peak Line #1 (W1)"
#property indicator_label6  "Bottom Line #1 (W1)"
#property indicator_label7  "Peak Line #1 (W2)"
#property indicator_label8  "Bottom Line #1 (W2)"
#property indicator_label9  "Peak Line #1 (W3)"
#property indicator_label10 "Bottom Line #1 (W3)"

#property indicator_width5  2
#property indicator_width6  2
#property indicator_width7  2
#property indicator_width8  2
#property indicator_width9  2
#property indicator_width10 2

//--- Input enums
#define EXPORT_BUTTON_NAME "FractalExportButton"

enum ENUM_FRACTAL_BARS
  {
   BARS_15 = 15, BARS_17 = 17, BARS_19 = 19, BARS_21 = 21,
   BARS_35 = 35, BARS_55 = 55, BARS_75 = 75, BARS_105 = 105, 
   BARS_135 = 135
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
   PRESET_MANUAL                = 0,  
   PRESET_ULTRA_PURE_STRUCTURE  = 1,  
   PRESET_PURE_STRUCTURE        = 2,  
   PRESET_STRUCTURE_BIASED      = 3,  
   PRESET_BALANCED              = 4,  
   PRESET_PROXIMITY_BIASED      = 5,  
   PRESET_PURE_PROXIMITY        = 6   
  };

//--- Input parameters
input string            SepWindow1 = "===== Window Period 1 =====";
input int               InpStartBar1 = 500; // W1 Starting Bar
input int               InpEndBar1 = 100;   // W1 Ending Bar (0 = Current)

input string            SepWindow2 = "===== Window Period 2 =====";
input int               InpStartBar2 = 750; // W2 Starting Bar
input int               InpEndBar2 = 350;   // W2 Ending Bar

input string            SepWindow3 = "===== Window Period 3 =====";
input int               InpStartBar3 = 1000;// W3 Starting Bar
input int               InpEndBar3 = 600;   // W3 Ending Bar

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
input int               InpMinFractalTouch = 4;
input int               InpMinLineLength = 20;
input int               InpMaxLineLength = 0;
input double            InpMaxAngleDegrees = 60;
input ENUM_TOLERANCE_TYPE InpToleranceType = TOLERANCE_PERCENT;
input double            InpTolerancePercent = 1.00;
input double            InpToleranceATRMultiplier = 1.5;
input int               InpATRPeriod = 12;
input int               InpExtensionBars = 3000;
input int               InpMaxPeakLines = 1;
input int               InpMaxBottomLines = 1;

input color             InpPeakLineColor1 = clrRed;
input color             InpBottomLineColor1 = clrLimeGreen;
input color             InpPeakLineColor2 = clrOrange;
input color             InpBottomLineColor2 = clrMediumSeaGreen;
input color             InpPeakLineColor3 = clrMagenta;
input color             InpBottomLineColor3 = clrDeepSkyBlue;

input string            Sep4              = "===== Scoring Weights =====";
input ENUM_SCORING_PRESET  InpScoringPreset  = PRESET_ULTRA_PURE_STRUCTURE;
input int               InpWeightFractals = 25;
input int               InpWeightSlope    = 15;
input int               InpWeightLength   = 10;
input int               InpWeightProximity= 50;

input string            Sep5 = "===== Display Settings =====";
input bool              InpShowLabels = false;
input int               InpLabelFontSize = 9;
input int               InpLabelOffsetBars = 5;
input bool              InpEnableColorIntensity = true;
input double            InpMaxFadeDistance = 5.0;

input string            Sep6 = "===== Angle Filtering =====";
input bool              InpEnableAngleFilter = false;
input double            InpMinLineAngle = 0.5;
input double            InpMaxLineAngle = 45.0;

input string            Sep7 = "===== Performance Optimization =====";
input bool              InpUseOptimizations = true;
input bool              InpUseCaching = true;
input bool              InpUseSlopeFilter = true;
input bool              InpUseEarlyExit = false;
input double            InpEarlyExitThreshold = 150.0;
input bool              InpUseSpatialIndex = true;
input int               InpSpatialGridSize = 20;

input string            Sep8 = "===== Export Settings =====";
input string            InpExportFileName = "FractalTrendlines";
input bool              InpIncludeHeader = true;

//--- Indicator buffers
double ExtUpperBuffer[];
double ExtLowerBuffer[];
double ExtUpperBuffer119[];
double ExtLowerBuffer119[];

double ExtPeakLine1[];
double ExtBottomLine1[];
double ExtPeakLine2[];
double ExtBottomLine2[];
double ExtPeakLine3[];
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
//--- Effective scoring weights 
int    ExtWeightFractals  = 25;
int    ExtWeightSlope     = 15;
int    ExtWeightLength    = 10;
int    ExtWeightProximity = 50;

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
   double            angle_degrees;
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
   
   bool IsValid(double &high_map[], double &low_map[], int current_rates)
   {
      if(!m_enabled) return false;
      if(!m_valid) return false;
      
      if(ArraySize(m_high_map_snapshot) != current_rates) return false;
      if(ArraySize(m_low_map_snapshot) != current_rates) return false;
      for(int i = 0; i < current_rates; i++)
      {
         if(high_map[i] != m_high_map_snapshot[i]) return false;
         if(low_map[i] != m_low_map_snapshot[i]) return false;
      }
      
      return true;
   }
   
   void Store(FractalLine &lines[], double &high_map[], double &low_map[], int current_rates)
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
      
      ArrayResize(m_high_map_snapshot, current_rates);
      ArrayResize(m_low_map_snapshot, current_rates);
      ArrayCopy(m_high_map_snapshot, high_map, 0, 0, current_rates);
      ArrayCopy(m_low_map_snapshot, low_map, 0, 0, current_rates);
      
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
CLineCache     g_line_cache_peak[3];
CLineCache     g_line_cache_bottom[3];

//+------------------------------------------------------------------+
//| Create export button                                             |
//+------------------------------------------------------------------+
void CreateExportButton()
  {
    if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
        ObjectDelete(0, EXPORT_BUTTON_NAME);
        
    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
      {
        Print("ERROR: Failed to create export button. Code: ", GetLastError());
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
      case PRESET_ULTRA_PURE_STRUCTURE: ExtWeightFractals=45; ExtWeightSlope=20; ExtWeightLength=30; ExtWeightProximity=5;  break;
      case PRESET_PURE_STRUCTURE:       ExtWeightFractals=45; ExtWeightSlope=15; ExtWeightLength=30; ExtWeightProximity=10; break;
      case PRESET_STRUCTURE_BIASED:     ExtWeightFractals=35; ExtWeightSlope=15; ExtWeightLength=25; ExtWeightProximity=25; break;
      case PRESET_BALANCED:             ExtWeightFractals=30; ExtWeightSlope=10; ExtWeightLength=20; ExtWeightProximity=40; break;
      case PRESET_PROXIMITY_BIASED:     ExtWeightFractals=20; ExtWeightSlope=5;  ExtWeightLength=10; ExtWeightProximity=65; break;
      case PRESET_PURE_PROXIMITY:       ExtWeightFractals=10; ExtWeightSlope=5;  ExtWeightLength=5;  ExtWeightProximity=80; break;
      default: 
         ExtWeightFractals=InpWeightFractals; ExtWeightSlope=InpWeightSlope;
         ExtWeightLength=InpWeightLength;     ExtWeightProximity=InpWeightProximity; break;
     }

   //--- Invalidate caches
   for(int i=0; i<3; i++) {
       g_line_cache_peak[i].Invalidate();
       g_line_cache_bottom[i].Invalidate();
   }

   ExtSideBars = (InpFractalBars - 1) / 2;
   ExtMinBars = InpFractalBars;
   ExtSideBars119 = (InpFractalBars119 - 1) / 2;
   ExtMinBars119 = InpFractalBars119;
   
   if(InpATRPeriod < 1) { Print("ERROR: InpATRPeriod must be >= 1"); return INIT_PARAMETERS_INCORRECT; }
   if(InpTolerancePercent <= 0) { Print("ERROR: InpTolerancePercent must be > 0"); return INIT_PARAMETERS_INCORRECT; }
   if(InpToleranceATRMultiplier <= 0) { Print("ERROR: InpToleranceATRMultiplier must be > 0"); return INIT_PARAMETERS_INCORRECT; }
   
   if(InpEnableAngleFilter)
     {
      if(InpMinLineAngle < 0 || InpMaxLineAngle > 90) { Print("ERROR: Angle range must be between 0° and 90°"); return INIT_PARAMETERS_INCORRECT; }
      if(InpMinLineAngle >= InpMaxLineAngle) { Print("ERROR: InpMinLineAngle must be less than InpMaxLineAngle"); return INIT_PARAMETERS_INCORRECT; }
     }

   ExtATRHandle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);

   SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);
   SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);
   SetIndexBuffer(4, ExtPeakLine1, INDICATOR_DATA);
   SetIndexBuffer(5, ExtBottomLine1, INDICATOR_DATA);
   SetIndexBuffer(6, ExtPeakLine2, INDICATOR_DATA);
   SetIndexBuffer(7, ExtBottomLine2, INDICATOR_DATA);
   SetIndexBuffer(8, ExtPeakLine3, INDICATOR_DATA);
   SetIndexBuffer(9, ExtBottomLine3, INDICATOR_DATA);
   SetIndexBuffer(10, ExtHighMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(11, ExtLowMapBuffer, INDICATOR_CALCULATIONS);

   ArraySetAsSeries(ExtUpperBuffer, true);
   ArraySetAsSeries(ExtLowerBuffer, true);
   ArraySetAsSeries(ExtUpperBuffer119, true);
   ArraySetAsSeries(ExtLowerBuffer119, true);
   ArraySetAsSeries(ExtPeakLine1, true);
   ArraySetAsSeries(ExtBottomLine1, true);
   ArraySetAsSeries(ExtPeakLine2, true);
   ArraySetAsSeries(ExtBottomLine2, true);
   ArraySetAsSeries(ExtPeakLine3, true);
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
      
   PlotIndexSetInteger(4, PLOT_LINE_COLOR, InpPeakLineColor1);
   PlotIndexSetInteger(5, PLOT_LINE_COLOR, InpBottomLineColor1);
   PlotIndexSetInteger(6, PLOT_LINE_COLOR, InpPeakLineColor2);
   PlotIndexSetInteger(7, PLOT_LINE_COLOR, InpBottomLineColor2);
   PlotIndexSetInteger(8, PLOT_LINE_COLOR, InpPeakLineColor3);
   PlotIndexSetInteger(9, PLOT_LINE_COLOR, InpBottomLineColor3);
   
   if(!InpShowTrendlines)
     {
      for(int i = 4; i <= 9; i++)
         PlotIndexSetInteger(i, PLOT_DRAW_TYPE, DRAW_NONE);
     }

   string pattern_name = IntegerToString(InpFractalBars) + "-bar";
   IndicatorSetString(INDICATOR_SHORTNAME, "Fractal SR (3 Windows)");

   Print("=== Fractal SR V5.60 (3 Window Periods) ===");
   Print("  Symbol 108: ", pattern_name, " (", ExtSideBars, " bars each side)");
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(ExtATRHandle != INVALID_HANDLE)
      IndicatorRelease(ExtATRHandle);

   DeleteAllLabels();
   Comment("");
  }
//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
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
    if(InpIncludeHeader)
      {
        string header = "timestamp\tsymbol\ttimeframe\tclose\thoriz_peak_line_1_w1\thoriz_bottom_line_1_w1\thoriz_peak_line_1_w2\thoriz_bottom_line_1_w2\thoriz_peak_line_1_w3\thoriz_bottom_line_1_w3\thoriz_high_map\thoriz_low_map";
        write_success &= FileWrite(file_handle, header) > 0;
      }

    datetime gmt_offset = TimeCurrent() - TimeGMT();
    
    int start_bar = 0;
    
    // Automatically find the furthest window out to export sufficient history
    int max_start = (int)MathMax((double)InpStartBar1, MathMax((double)InpStartBar2, (double)InpStartBar3));
    int max_end = (int)MathMax((double)InpEndBar1, MathMax((double)InpEndBar2, (double)InpEndBar3));
    int end_bar = (int)MathMax((double)max_start, (double)max_end);
    
    int total_bars = iBars(symbol, timeframe);
    if(end_bar >= total_bars) end_bar = total_bars - 1;
    
    int exported_count = 0;
    for(int bar_idx = end_bar; bar_idx >= start_bar; bar_idx--)
      {
        string line = IntegerToString((long)(iTime(symbol, timeframe, bar_idx) - gmt_offset)) + "\t";
        line += symbol + "\t";
        line += tf_str + "\t";
        line += DoubleToString(iClose(symbol, timeframe, bar_idx), _Digits) + "\t";
        
        string p1 = (ExtPeakLine1[bar_idx] == 0.0 || ExtPeakLine1[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine1[bar_idx], 2);
        line += p1 + "\t";
        string b1 = (ExtBottomLine1[bar_idx] == 0.0 || ExtBottomLine1[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine1[bar_idx], 2);
        line += b1 + "\t";
        
        string p2 = (ExtPeakLine2[bar_idx] == 0.0 || ExtPeakLine2[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine2[bar_idx], 2);
        line += p2 + "\t";
        string b2 = (ExtBottomLine2[bar_idx] == 0.0 || ExtBottomLine2[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine2[bar_idx], 2);
        line += b2 + "\t";
        
        string p3 = (ExtPeakLine3[bar_idx] == 0.0 || ExtPeakLine3[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtPeakLine3[bar_idx], 2);
        line += p3 + "\t";
        string b3 = (ExtBottomLine3[bar_idx] == 0.0 || ExtBottomLine3[bar_idx] == EMPTY_VALUE) ? "" : DoubleToString(ExtBottomLine3[bar_idx], 2);
        line += b3 + "\t";
        
        string hmap = (ExtHighMapBuffer[bar_idx] == 0.0) ? "" : DoubleToString(ExtHighMapBuffer[bar_idx], 2);
        line += hmap + "\t";
        string lmap = (ExtLowMapBuffer[bar_idx] == 0.0) ? "" : DoubleToString(ExtLowMapBuffer[bar_idx], 2);
        line += lmap;

        write_success &= FileWrite(file_handle, line) > 0;
        exported_count++;
      }

    FileClose(file_handle);

    if(!write_success)
      {
        Print("ERROR: Failed to write some data to file");
        return false;
      }

    Print("Fractal trendline data successfully exported to: ", filename);
    Print("Total rows exported: ", exported_count);
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
   else if(distance_pct > InpMaxFadeDistance * 0.8)
      intensity = 0.5;
   else if(distance_pct > InpMaxFadeDistance * 0.6)
      intensity = 0.7;
   else if(distance_pct > InpMaxFadeDistance * 0.4)
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
      if(center_high <= high[index - i]) return false;
   for(int i = 1; i <= side_bars; i++)
      if(center_high < high[index + i]) return false;
   return true;
  }

//+------------------------------------------------------------------+
bool IsLowerFractal(const double &low[], int index, int side_bars)
  {
   double center_low = low[index];
   for(int i = 1; i <= side_bars; i++)
      if(center_low >= low[index - i]) return false;
   for(int i = 1; i <= side_bars; i++)
      if(center_low > low[index + i]) return false;
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
double CalculateNormalizedAngle(double price_start, double price_end, int bar_distance)
{
   if(bar_distance <= 0) return 0;
   
   double price_change = price_end - price_start;
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
      angle = MathArctan(normalized_change) * 180.0 / M_PI;
   }
   else
   {
      double price_mid = (price_start + price_end) / 2.0;
      if(price_mid > 0)
      {
         double percent_change = (price_change / price_mid) * 100.0;
         double normalized_change = percent_change / bar_distance;
         angle = MathArctan(normalized_change) * 180.0 / M_PI;
      }
   }
   
   return angle;
}

//+------------------------------------------------------------------+
void ClearAllTrendlineBuffers()
  {
   ArrayInitialize(ExtPeakLine1, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine1, EMPTY_VALUE);
   ArrayInitialize(ExtPeakLine2, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine2, EMPTY_VALUE);
   ArrayInitialize(ExtPeakLine3, EMPTY_VALUE);
   ArrayInitialize(ExtBottomLine3, EMPTY_VALUE);
  }

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
         if(distance_bars < InpMinLineLength) continue;
         if(InpMaxLineLength > 0 && distance_bars > InpMaxLineLength) continue;
         
         double slope = (fractal_prices[j] - fractal_prices[i]) / (double)distance_bars;
         double y_intercept = fractal_prices[i] - slope * fractal_bars[i];
         double angle = CalculateNormalizedAngle(fractal_prices[i], fractal_prices[j], distance_bars);
         double abs_angle = MathAbs(angle);
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
                                                 fractal_bars[j], fractal_prices[j], candidates);
            
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
         lines[line_count].angle_degrees = angle;
         
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
void ScoreLines(FractalLine &lines[], int rates_total, double current_price, int window_start, int window_end)
  {
   double window_size = MathAbs((double)(window_start - window_end));
   if(window_size <= 0) window_size = 1.0; 

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
      double length_ratio = (double)lines[i].length_bars / window_size;
      if(length_ratio > 1.0) length_ratio = 1.0;
      score += length_ratio * ExtWeightLength;
      double proximity_score = 0;
      if(price_diff_percent <= 0.05) proximity_score = ExtWeightProximity;
      else if(price_diff_percent <= 0.1) proximity_score = ExtWeightProximity * 0.93;
      else if(price_diff_percent <= 0.25) proximity_score = ExtWeightProximity * 0.80;
      else if(price_diff_percent <= 0.5) proximity_score = ExtWeightProximity * 0.60;
      else if(price_diff_percent <= 1.0) proximity_score = ExtWeightProximity * 0.40;
      else if(price_diff_percent <= 2.0) proximity_score = ExtWeightProximity * 0.20;
      score += proximity_score;

      lines[i].score = score;
      lines[i].line_price_at_current = line_price_now;
     }
  }

//+------------------------------------------------------------------+
void FilterTopLines(FractalLine &lines[], int max_lines)
  {
   int size = ArraySize(lines);
   if(size == 0) return;

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

   int start_bar_chrono = line.bar_start;
   int end_bar_chrono = line.bar_end;
   if(InpExtensionBars > 0)
     {
      end_bar_chrono = line.bar_end + InpExtensionBars;
      if(end_bar_chrono >= rates_total)
         end_bar_chrono = rates_total - 1;
     }
      
   for(int i = 0; i < rates_total; i++)
     {
      int bar_number_chrono = rates_total - 1 - i;
      if(bar_number_chrono >= start_bar_chrono && bar_number_chrono <= end_bar_chrono)
         buffer[i] = slope * bar_number_chrono + y_intercept;
      else
         buffer[i] = EMPTY_VALUE;
     }
  }

//+------------------------------------------------------------------+
//| Refactored Helper Function: Process a single window calculation  |
//+------------------------------------------------------------------+
void ProcessWindow(int window_idx, int inp_start, int inp_end, 
                   double &peak_buffer[], double &bottom_buffer[], 
                   color peak_color, color bottom_color, string label_suffix,
                   const int rates_total, double current_price)
{
   //=================================================================
   // PEAK LINES
   //=================================================================
   FractalLine peak_lines[];
   bool use_cache_peak = InpUseOptimizations && InpUseCaching && 
                         g_line_cache_peak[window_idx].IsValid(ExtHighMapBuffer, ExtLowMapBuffer, rates_total);
   if(use_cache_peak)
   {
      g_line_cache_peak[window_idx].Retrieve(peak_lines);
   }
   else
   {
      int peak_bars[];
      double peak_prices[];
      ArrayResize(peak_bars, 0);
      ArrayResize(peak_prices, 0);
      
      int start_idx = MathMax(0, MathMin(inp_start, inp_end));
      int end_idx = MathMin(rates_total - 1, MathMax(inp_start, inp_end));
      
      for(int i = start_idx; i <= end_idx; i++)
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
            ScoreLines(peak_lines, rates_total, current_price, inp_start, inp_end);
            FilterTopLines(peak_lines, InpMaxPeakLines);
         }
         
         if(InpUseOptimizations && InpUseCaching)
            g_line_cache_peak[window_idx].Store(peak_lines, ExtHighMapBuffer, ExtLowMapBuffer, rates_total);
      }
   }
   
   if(ArraySize(peak_lines) >= 1)
   {
      DrawTrendline(peak_buffer, peak_lines[0], rates_total);
      
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(peak_lines[0].line_price_at_current, current_price, peak_color);
         PlotIndexSetInteger(4 + (window_idx * 2), PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("P-P%s: %d touches, %d bars, %.1f°",
                                         label_suffix, peak_lines[0].fractals_touched,
                                         peak_lines[0].length_bars, peak_lines[0].angle_degrees);
         DrawLineLabel("P_P" + label_suffix, peak_lines[0].line_price_at_current, label_time, label_text, peak_color, InpLabelFontSize);
      }
   }
   
   //=================================================================
   // BOTTOM LINES
   //=================================================================
   FractalLine bottom_lines[];
   bool use_cache_bottom = InpUseOptimizations && InpUseCaching && 
                           g_line_cache_bottom[window_idx].IsValid(ExtHighMapBuffer, ExtLowMapBuffer, rates_total);
   if(use_cache_bottom)
   {
      g_line_cache_bottom[window_idx].Retrieve(bottom_lines);
   }
   else
   {
      int bottom_bars[];
      double bottom_prices[];
      ArrayResize(bottom_bars, 0);
      ArrayResize(bottom_prices, 0);
      
      int start_idx = MathMax(0, MathMin(inp_start, inp_end));
      int end_idx = MathMin(rates_total - 1, MathMax(inp_start, inp_end));
      
      for(int i = start_idx; i <= end_idx; i++)
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
            ScoreLines(bottom_lines, rates_total, current_price, inp_start, inp_end);
            FilterTopLines(bottom_lines, InpMaxBottomLines);
         }
         
         if(InpUseOptimizations && InpUseCaching)
            g_line_cache_bottom[window_idx].Store(bottom_lines, ExtHighMapBuffer, ExtLowMapBuffer, rates_total);
      }
   }
   
   if(ArraySize(bottom_lines) >= 1)
   {
      DrawTrendline(bottom_buffer, bottom_lines[0], rates_total);
      
      if(InpEnableColorIntensity)
      {
         color line_color = CalculateAdaptiveColor(bottom_lines[0].line_price_at_current, current_price, bottom_color);
         PlotIndexSetInteger(5 + (window_idx * 2), PLOT_LINE_COLOR, line_color);
      }
      if(InpShowLabels)
      {
         datetime label_time = iTime(_Symbol, PERIOD_CURRENT, InpLabelOffsetBars);
         string label_text = StringFormat("B-B%s: %d touches, %d bars, %.1f°",
                                         label_suffix, bottom_lines[0].fractals_touched,
                                         bottom_lines[0].length_bars, bottom_lines[0].angle_degrees);
         DrawLineLabel("B_B" + label_suffix, bottom_lines[0].line_price_at_current, label_time, label_text, bottom_color, InpLabelFontSize);
      }
   }
}

//+------------------------------------------------------------------+
void BuildMultiPointTrendlines(const int rates_total)
{
   ClearAllTrendlineBuffers();
   DeleteAllLabels();
   
   double current_price = iClose(_Symbol, PERIOD_CURRENT, 0);
   if(InpUseOptimizations)
   {
      if(InpUseSlopeFilter && InpEnableAngleFilter)
      {
         double atr = 0;
         if(ExtATRHandle != INVALID_HANDLE)
         {
            double atr_array[1];
            if(CopyBuffer(ExtATRHandle, 0, 0, 1, atr_array) > 0) atr = atr_array[0];
         }
         g_slope_filter.Init(InpMinLineAngle, InpMaxLineAngle, atr, true);
      }
      else
      {
         g_slope_filter.Init(0, 0, 0, false);
      }
   }
   
   // Process all 3 windows using the helper function
   ProcessWindow(0, InpStartBar1, InpEndBar1, ExtPeakLine1, ExtBottomLine1, InpPeakLineColor1, InpBottomLineColor1, "1_W1", rates_total, current_price);
   ProcessWindow(1, InpStartBar2, InpEndBar2, ExtPeakLine2, ExtBottomLine2, InpPeakLineColor2, InpBottomLineColor2, "1_W2", rates_total, current_price);
   ProcessWindow(2, InpStartBar3, InpEndBar3, ExtPeakLine3, ExtBottomLine3, InpPeakLineColor3, InpBottomLineColor3, "1_W3", rates_total, current_price);
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
   if(rates_total < global_min_bars) return(0);

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
      if(start_calc < 0) start_calc = 0;
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
         if(old_upper != high[i]) fractals_changed = true;
        }

      if(IsLowerFractal(low, i, ExtSideBars))
        {
         ExtLowerBuffer[i] = low[i];
         ExtLowMapBuffer[i] = low[i];
         if(old_lower != low[i]) fractals_changed = true;
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

         if(IsUpperFractal(high, i, ExtSideBars119)) ExtUpperBuffer119[i] = high[i];
         if(IsLowerFractal(low, i, ExtSideBars119)) ExtLowerBuffer119[i] = low[i];
        }
     }

   if(InpShowTrendlines)
   {
      if(first_run || new_bar || fractals_changed)
      {
         BuildMultiPointTrendlines(rates_total);
      }
   }

   return(rates_total);
  }
//+------------------------------------------------------------------+