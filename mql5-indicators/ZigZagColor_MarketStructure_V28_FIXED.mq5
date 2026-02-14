//+------------------------------------------------------------------+
//|                                          ImprovedZigzagColor.mq5   |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.29"
#property description "Improved ZigZag Color Indicator - V29 (Lightweight - No Export)"
#property description "Removed: All export functionality, file operations, batch processing, and debug logging"

// Version 29 Changelog:
// - Removed ALL export functionality (button, Export* functions)
// - Removed batch processing (ProcessBatchFiles, ProcessAllBatchFiles)
// - Removed file data source functionality (FindOHLCDataFile, LoadPriceData, file processing)
// - Removed export-related input parameters (Data Export, Batch Processing, Data Source Settings)
// - Removed file mode buffers and globals
// - Removed ALL debug Print() statements except critical errors
// - Simplified to core indicator functionality only
// - Lightweight version focused on ZigZag, SMMA, EMA, and X Value display

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 10
#property indicator_plots   3
#property indicator_type1   DRAW_COLOR_ZIGZAG
#property indicator_width1  2
#property indicator_type2   DRAW_LINE  // SMMA line
#property indicator_color2  clrRed     // Default SMMA color
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2
#property indicator_type3   DRAW_LINE  // EMA line
#property indicator_color3  clrBlue    // Default EMA color
#property indicator_style3  STYLE_SOLID
#property indicator_width3  2

// input parameters
input group "ZigZag and Market Structure Settings"
input int    xInpDepth     = 12;     // Depth (minimum value: 2)
input int    xInpDeviation = 5;      // Deviation (in points)
input int    xInpBackstep  = 3;      // Back Step (minimum value: 1)
input color  xInpBullColor = clrDodgerBlue;  // Bullish ZigZag color
input color  xInpBearColor = clrRed;         // Bearish ZigZag color

// SMMA input parameters
input group "SMMA Settings"
input int                SMMA_Period = 39;              // SMMA Period
input int                SMMA_Shift = 0;                // SMMA Shift
input ENUM_APPLIED_PRICE SMMA_AppliedPrice = PRICE_CLOSE; // SMMA Applied price
input color              SMMA_Color = clrRed;           // SMMA Line color
input int                SMMA_Width = 2;                // SMMA Line width
input ENUM_LINE_STYLE    SMMA_Style = STYLE_SOLID;      // SMMA Line style

// EMA input parameters
input group "EMA Settings"
input int                EMA_Period = 26;                 // EMA period
input ENUM_APPLIED_PRICE EMA_AppliedPrice = PRICE_TYPICAL; // EMA Applied price
input color              EMA_Color = clrBlue;             // EMA Line color
input int                EMA_Width = 2;                   // EMA Line width
input ENUM_LINE_STYLE    EMA_Style = STYLE_SOLID;         // EMA Line style

// X Value Settings
input group "X Value Settings"
input int                InpXThreshold = 26;          // X threshold for trend determination
input ENUM_TIMEFRAMES    InpBaseTimeframe = PERIOD_CURRENT; // Base timeframe for X threshold
input int                InpConfirmationBars = 1;     // Number of bars for trend confirmation

// Indicator buffers
double xZigzagPeakBuffer[];    // Buffer for peaks
double xZigzagBottomBuffer[];  // Buffer for bottoms
double xColorBuffer[];         // Color index buffer
double xHighMapBuffer[];       // High points mapping
double xLowMapBuffer[];        // Low points mapping

// SMMA buffers
double SMMA_Buffer[];    // Main SMMA buffer
double SMMA_PriceBuffer[];   // Price buffer for SMMA calculations

// EMA buffers
double EMA_Buffer[];      // Main EMA buffer
double EMA_PriceBuffer[];  // Price buffer for EMA calculations

// X history buffer
double xHistoryBuffer[];

// Global variables
int    xExtRecalc = 3;        // Recalculation depth

// Global variables for X Value
int adjustedThreshold;
datetime lastCalculationTime = 0;
string confirmedTrend = "No Trend";
int confirmedX = 0;
datetime trendStartTime = 0;

// Trend direction label
string trendLabel = "TrendDirection";

// Buffer size tracking to avoid unnecessary resize checks
int g_LastBufferSize = 0;

// Enumeration for search mode
enum xEnSearchMode
  {
   xExtremum = 0,  // Searching for the first extremum
   xPeak = 1,      // Searching for the next peak
   xBottom = -1    // Searching for the next bottom
  };

//+------------------------------------------------------------------+
//|   Validation Functions                                           |
//+------------------------------------------------------------------+
bool xIsValidPrice(double price)
  {
   return price > 0;  // Simplified validation
  }

//+------------------------------------------------------------------+
//| Calculate SMMA using original methodology                        |
//+------------------------------------------------------------------+
void CalculateSMMA(int rates_total, int prev_calculated)
  {
   int i, start;

// First calculation or number of bars was changed
   if(prev_calculated == 0)
     {
      // Set start position
      start = SMMA_Period;

      // Set empty values for first bars
      for(i = 0; i < start - 1; i++)
         SMMA_Buffer[i] = 0.0;

      // Calculate first visible value
      double first_value = 0;
      for(i = 0; i < start; i++)
         first_value += SMMA_PriceBuffer[i];

      first_value /= SMMA_Period;
      SMMA_Buffer[start - 1] = first_value;
     }
   else
     {
      start = prev_calculated - 1;
     }

// Main calculation loop with original SMMA formula
   for(i = start; i < rates_total && !IsStopped(); i++)
     {
      SMMA_Buffer[i] = (SMMA_Buffer[i - 1] * (SMMA_Period - 1) + SMMA_PriceBuffer[i]) / SMMA_Period;
     }
  }

//+------------------------------------------------------------------+
//| Calculate EMA using the original methodology                     |
//+------------------------------------------------------------------+
void CalculateEMA(int rates_total, int start)
  {
   static bool first_calculation = true;
   double alpha = 2.0 / (EMA_Period + 1);

// Initialize first value if needed
   if(first_calculation && start == 0)
     {
      double sum = 0;
      // Calculate simple average for the first EMA value
      for(int i = 0; i < EMA_Period && i < rates_total; i++)
        {
         sum += EMA_PriceBuffer[i];
        }
      EMA_Buffer[0] = sum / EMA_Period;
      start = 1;
      first_calculation = false;
     }

// Make sure we don't access negative indices
   if(start < 1)
      start = 1;

// Calculate EMA using the original methodology
   for(int i = start; i < rates_total; i++)
     {
      if(i >= 1) // Additional safety check
        {
         EMA_Buffer[i] = (EMA_PriceBuffer[i] - EMA_Buffer[i-1]) * alpha + EMA_Buffer[i-1];
        }
     }
  }

//+------------------------------------------------------------------+
//| Get applied price based on enum                                  |
//+------------------------------------------------------------------+
double GetAppliedPrice(ENUM_APPLIED_PRICE applied_price, double open, double high, double low, double close)
  {
   switch(applied_price)
     {
      case PRICE_CLOSE:
         return close;
      case PRICE_OPEN:
         return open;
      case PRICE_HIGH:
         return high;
      case PRICE_LOW:
         return low;
      case PRICE_MEDIAN:
         return (high + low) / 2.0;
      case PRICE_TYPICAL:
         return (high + low + close) / 3.0;
      case PRICE_WEIGHTED:
         return (high + low + close + close) / 4.0;
      default:
         return close;
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
  {

// Validate input parameters
   if(xInpDepth < 2 || xInpBackstep < 1 || xInpDeviation < 0)
      return INIT_PARAMETERS_INCORRECT;

// Clear all buffers
   ArrayInitialize(xZigzagPeakBuffer, 0.0);
   ArrayInitialize(xZigzagBottomBuffer, 0.0);
   ArrayInitialize(xColorBuffer, 0.0);
   ArrayInitialize(xHighMapBuffer, 0.0);
   ArrayInitialize(xLowMapBuffer, 0.0);
   ArrayInitialize(SMMA_Buffer, 0.0);
   ArrayInitialize(EMA_Buffer, 0.0);
   ArrayInitialize(xHistoryBuffer, 0.0);

// Set indicator properties
   SetIndexBuffer(0, xZigzagPeakBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, xZigzagBottomBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, xColorBuffer, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(3, SMMA_Buffer, INDICATOR_DATA);
   SetIndexBuffer(4, EMA_Buffer, INDICATOR_DATA);
   SetIndexBuffer(5, xHighMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(6, xLowMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(7, SMMA_PriceBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(8, EMA_PriceBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(9, xHistoryBuffer, INDICATOR_CALCULATIONS);

// Set indicator digits and drawing properties
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 2);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 0, xInpBullColor);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 1, xInpBearColor);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

// Set SMMA indicator properties
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, SMMA_Color);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, SMMA_Width);
   PlotIndexSetInteger(1, PLOT_LINE_STYLE, SMMA_Style);
   PlotIndexSetInteger(1, PLOT_DRAW_BEGIN, SMMA_Period - 1);
   PlotIndexSetInteger(1, PLOT_SHIFT, SMMA_Shift);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, 0.0);

// Set EMA indicator properties
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, EMA_Color);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, EMA_Width);
   PlotIndexSetInteger(2, PLOT_LINE_STYLE, EMA_Style);
   PlotIndexSetInteger(2, PLOT_DRAW_BEGIN, EMA_Period - 1);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, 0.0);

// Set indicator name
   string short_name = StringFormat("ZigZagColor(%d,%d,%d)", xInpDepth, xInpDeviation, xInpBackstep);
   IndicatorSetString(INDICATOR_SHORTNAME, short_name);
   PlotIndexSetString(0, PLOT_LABEL, short_name);

// Set SMMA name
   string smma_name = StringFormat("SMMA(%d)", SMMA_Period);
   PlotIndexSetString(1, PLOT_LABEL, smma_name);

// Set EMA name
   string ema_name = StringFormat("EMA(%d)", EMA_Period);
   PlotIndexSetString(2, PLOT_LABEL, ema_name);

// Calculate adjusted threshold
   adjustedThreshold = (int)MathRound(InpXThreshold * (PeriodSeconds(InpBaseTimeframe) / PeriodSeconds()));

// Create trend direction label
   ObjectCreate(0, trendLabel, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, trendLabel, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, trendLabel, OBJPROP_XDISTANCE, 150);
   ObjectSetInteger(0, trendLabel, OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, trendLabel, OBJPROP_FONTSIZE, 9);

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
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
// Only check buffers when size actually changes or on first run
   if(rates_total != g_LastBufferSize || prev_calculated == 0)
     {
      CheckAndResizeLiveDataBuffers(rates_total);
      g_LastBufferSize = rates_total;
     }

// Validate data
   if(rates_total < xInpDepth)
      return 0;

// Check for valid price data - only check the necessary range
   int checkStart = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int i = checkStart; i < rates_total && i < checkStart + xInpDepth * 2; i++)
     {
      if(high[i] <= 0 || low[i] <= 0 || !MathIsValidNumber(high[i]) || !MathIsValidNumber(low[i]))
        {
         return 0;
        }
     }

// Add basic safeguard checks
   if(!ValidateBuffers())
      return 0;

// Initialize variables
   int start = InitializeCalculation(rates_total, prev_calculated);
   if(start < 0)
      return 0;

// Calculate only for new bars or recalculation
   if(prev_calculated > 0)
     {
      // Process only the last 3 bars for updating
      start = MathMax(prev_calculated - 3, xInpDepth - 1);
     }

// Main calculation loop
   CalculateZigZag(rates_total, start, high, low, prev_calculated);

// Calculate SMMA price buffer
   for(int i = 0; i < rates_total; i++)
     {
      SMMA_PriceBuffer[i] = GetAppliedPrice(SMMA_AppliedPrice, open[i], high[i], low[i], close[i]);
     }

// Calculate SMMA
   CalculateSMMA(rates_total, prev_calculated);

// Calculate EMA price buffer
   for(int i = 0; i < rates_total; i++)
     {
      EMA_PriceBuffer[i] = GetAppliedPrice(EMA_AppliedPrice, open[i], high[i], low[i], close[i]);
     }

// Calculate EMA
   int ema_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   CalculateEMA(rates_total, ema_start);

// Calculate Historical X Values and Trend Direction
   CalculateHistoricalXValues(rates_total, prev_calculated, time);

   return rates_total;
  }

//+------------------------------------------------------------------+
//| Calculate Historical X Values and Trend Direction                |
//+------------------------------------------------------------------+
void CalculateHistoricalXValues(const int rates_total, const int prev_calculated, const datetime &time[])
  {
   static int last_state = 0;
   static int x = 0;
   static datetime last_bar_time = 0;

// Determine starting point for calculation
   int start = 0;
   if(prev_calculated > 0)
     {
      start = MathMax(0, prev_calculated - 50);

      // Recover previous state if available
      if(start > 0)
        {
         for(int i = start - 1; i >= 0; i--)
           {
            if(xHistoryBuffer[i] > 0)
              {
               x = (int)xHistoryBuffer[i];
               last_state = EMA_Buffer[i] > SMMA_Buffer[i] ? 1 : -1;
               last_bar_time = time[i];
               break;
              }
           }
        }
     }

// Calculate X values for each bar
   for(int i = start; i < rates_total; i++)
     {
      int current_state = EMA_Buffer[i] > SMMA_Buffer[i] ? 1 : -1;

      // Check for new bar or state change
      if(time[i] > last_bar_time)
        {
         last_bar_time = time[i];

         if(current_state != last_state)
           {
            x = 0;
            trendStartTime = time[i];
           }
         else
           {
            x++;
           }
        }

      // Store X value for this bar
      xHistoryBuffer[i] = x;
      last_state = current_state;

      // Determine trend direction with time-based confirmation
      string currentTrend;
      if(x > adjustedThreshold)
        {
         if(current_state > 0)
            currentTrend = "Uptrend";
         else
            currentTrend = "Downtrend";

         // Check if the trend has persisted for the required number of bars
         if(time[i] >= trendStartTime + PeriodSeconds(InpBaseTimeframe) * InpConfirmationBars)
           {
            confirmedTrend = currentTrend;
            confirmedX = x;
           }
        }
      else
        {
         currentTrend = "No Trend";
         if(confirmedTrend != "No Trend" && x <= adjustedThreshold / 2)
           {
            confirmedTrend = "No Trend";
            confirmedX = 0;
           }
        }

      // Update trend direction label for the most recent bar
      if(i == rates_total - 1)
        {
         string labelText = StringFormat("Confirmed Trend: %s\nX = %d\nThreshold: %d", confirmedTrend, confirmedX, adjustedThreshold);
         ObjectSetString(0, trendLabel, OBJPROP_TEXT, labelText);
         color labelColor = confirmedTrend == "Uptrend" ? clrGreen : (confirmedTrend == "Downtrend" ? clrRed : clrGray);
         ObjectSetInteger(0, trendLabel, OBJPROP_COLOR, labelColor);
        }
     }
  }

//+------------------------------------------------------------------+
//| Initialize calculation parameters                                |
//+------------------------------------------------------------------+
int InitializeCalculation(const int rates_total, const int prev_calculated)
  {
   static bool buffers_initialized = false;

   if(prev_calculated == 0)
     {
      // Initialize buffers only on first calculation
      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);
      ArrayInitialize(xHistoryBuffer, 0.0);
      buffers_initialized = true;
      return xInpDepth - 1;
     }

// Preserve last known good values
   if(!buffers_initialized)
     {
      // Store last known good values
      double lastPeak = 0, lastBottom = 0;
      int lastPeakPos = -1, lastBottomPos = -1;

      for(int i = rates_total - 1; i >= 0; i--)
        {
         if(xZigzagPeakBuffer[i] != 0)
           {
            lastPeak = xZigzagPeakBuffer[i];
            lastPeakPos = i;
            break;
           }
        }

      for(int i = rates_total - 1; i >= 0; i--)
        {
         if(xZigzagBottomBuffer[i] != 0)
           {
            lastBottom = xZigzagBottomBuffer[i];
            lastBottomPos = i;
            break;
           }
        }

      // Initialize buffers while preserving last values
      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);

      // Restore last known good values
      if(lastPeakPos >= 0)
         xZigzagPeakBuffer[lastPeakPos] = lastPeak;
      if(lastBottomPos >= 0)
         xZigzagBottomBuffer[lastBottomPos] = lastBottom;

      buffers_initialized = true;
     }

   return prev_calculated - 1;
  }

//+------------------------------------------------------------------+
//| Check and resize live data buffers (OPTIMIZED)                   |
//+------------------------------------------------------------------+
bool CheckAndResizeLiveDataBuffers(const int rates_total)
  {
   bool resized = false;
   int buffer_size = rates_total + 500;  // Pre-allocate extra space to reduce frequent resizes

// Check and resize ZigZag peak buffer
   if(ArraySize(xZigzagPeakBuffer) < rates_total)
     {
      ArrayResize(xZigzagPeakBuffer, buffer_size);
      resized = true;
     }

// Check and resize ZigZag bottom buffer
   if(ArraySize(xZigzagBottomBuffer) < rates_total)
     {
      ArrayResize(xZigzagBottomBuffer, buffer_size);
      resized = true;
     }

// Check and resize color buffer
   if(ArraySize(xColorBuffer) < rates_total)
     {
      ArrayResize(xColorBuffer, buffer_size);
      resized = true;
     }

// Check and resize high map buffer
   if(ArraySize(xHighMapBuffer) < rates_total)
     {
      ArrayResize(xHighMapBuffer, buffer_size);
      resized = true;
     }

// Check and resize low map buffer
   if(ArraySize(xLowMapBuffer) < rates_total)
     {
      ArrayResize(xLowMapBuffer, buffer_size);
      resized = true;
     }

// Check and resize SMMA buffer
   if(ArraySize(SMMA_Buffer) < rates_total)
     {
      ArrayResize(SMMA_Buffer, buffer_size);
      resized = true;
     }

// Check and resize EMA buffer
   if(ArraySize(EMA_Buffer) < rates_total)
     {
      ArrayResize(EMA_Buffer, buffer_size);
      resized = true;
     }

// Check and resize SMMA price buffer
   if(ArraySize(SMMA_PriceBuffer) < rates_total)
     {
      ArrayResize(SMMA_PriceBuffer, buffer_size);
      resized = true;
     }

// Check and resize EMA price buffer
   if(ArraySize(EMA_PriceBuffer) < rates_total)
     {
      ArrayResize(EMA_PriceBuffer, buffer_size);
      resized = true;
     }

// Check and resize X history buffer
   if(ArraySize(xHistoryBuffer) < rates_total)
     {
      ArrayResize(xHistoryBuffer, buffer_size);
      resized = true;
     }

   return resized;
  }

//+------------------------------------------------------------------+
//| Main ZigZag calculation                                          |
//+------------------------------------------------------------------+
void CalculateZigZag(const int rates_total, int start,
                     const double &high[], const double &low[],
                     const int prev_calculated)
  {
   int extreme_search = xExtremum;
   double last_high = 0, last_low = 0;
   int last_high_pos = 0, last_low_pos = 0;

// Find last known extremes if restarting calculation
   if(start > xInpDepth)
     {
      for(int i = start - 1; i >= start - xInpDepth && i >= 0; i--)
        {
         if(xZigzagPeakBuffer[i] != 0)
           {
            last_high = xZigzagPeakBuffer[i];
            last_high_pos = i;
            extreme_search = xBottom;
            break;
           }
         if(xZigzagBottomBuffer[i] != 0)
           {
            last_low = xZigzagBottomBuffer[i];
            last_low_pos = i;
            extreme_search = xPeak;
            break;
           }
        }
     }

// Main calculation loop
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      // Calculate high/low maps
      CalculateHighLowMaps(i, high, low);

      // Find extremes
      if(!FindExtremes(i, extreme_search, last_high, last_low,
                       last_high_pos, last_low_pos, high, low))
         break;
     }
  }

//+------------------------------------------------------------------+
//| Find and process extreme points                                    |
//+------------------------------------------------------------------+
bool FindExtremes(const int i, int &extreme_search, double &last_high, double &last_low,
                  int &last_high_pos, int &last_low_pos, const double &high[], const double &low[])
  {
   switch(extreme_search)
     {
      case xExtremum:  // Initial search for any extremum
         if(last_low == 0 && last_high == 0)
           {
            if(xHighMapBuffer[i] != 0)
              {
               last_high = high[i];
               last_high_pos = i;
               extreme_search = xBottom;  // Look for a bottom next
               xZigzagPeakBuffer[i] = last_high;
               xColorBuffer[i] = 0;
              }
            else
               if(xLowMapBuffer[i] != 0)
                 {
                  last_low = low[i];
                  last_low_pos = i;
                  extreme_search = xPeak;  // Look for a peak next
                  xZigzagBottomBuffer[i] = last_low;
                  xColorBuffer[i] = 1;
                 }
           }
         break;

      case xPeak:  // Looking for peak
         if(xHighMapBuffer[i] != 0)  // Found a potential peak
           {
            last_high = high[i];
            last_high_pos = i;
            xZigzagPeakBuffer[i] = last_high;
            xColorBuffer[i] = 0;
            extreme_search = xBottom;  // Switch to looking for bottom
           }
         else
            if(xLowMapBuffer[i] != 0 && low[i] < last_low)  // Found a lower bottom
              {
               xZigzagBottomBuffer[last_low_pos] = 0.0;  // Remove old bottom
               last_low = low[i];
               last_low_pos = i;
               xZigzagBottomBuffer[i] = last_low;  // Mark new bottom
               xColorBuffer[i] = 1;
              }
         break;

      case xBottom:  // Looking for bottom
         if(xLowMapBuffer[i] != 0)  // Found a potential bottom
           {
            last_low = low[i];
            last_low_pos = i;
            xZigzagBottomBuffer[i] = last_low;
            xColorBuffer[i] = 1;
            extreme_search = xPeak;  // Switch to looking for peak
           }
         else
            if(xHighMapBuffer[i] != 0 && high[i] > last_high)  // Found a higher peak
              {
               xZigzagPeakBuffer[last_high_pos] = 0.0;  // Remove old peak
               last_high = high[i];
               last_high_pos = i;
               xZigzagPeakBuffer[i] = last_high;  // Mark new peak
               xColorBuffer[i] = 0;
              }
         break;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Calculate high/low maps for given shift                          |
//+------------------------------------------------------------------+
void CalculateHighLowMaps(const int shift,
                          const double &high[], const double &low[])
  {
// Calculate high map
   double highVal = Highest(high, xInpDepth, shift);
   if(high[shift] == highVal)
     {
      xHighMapBuffer[shift] = high[shift];
     }
   else
     {
      xHighMapBuffer[shift] = 0.0;
     }

// Calculate low map
   double lowVal = Lowest(low, xInpDepth, shift);
   if(low[shift] == lowVal)
     {
      xLowMapBuffer[shift] = low[shift];
     }
   else
     {
      xLowMapBuffer[shift] = 0.0;
     }
  }

//+------------------------------------------------------------------+
//| Get highest value for range                                       |
//+------------------------------------------------------------------+
double Highest(const double &array[], int count, int start)
  {
   if(start < count - 1)
      count = start + 1;
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res < array[i])
         res = array[i];

   return res;
  }

//+------------------------------------------------------------------+
//| Get lowest value for range                                        |
//+------------------------------------------------------------------+
double Lowest(const double &array[], int count, int start)
  {
   if(start < count - 1)
      count = start + 1;
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res > array[i])
         res = array[i];

   return res;
  }

//+------------------------------------------------------------------+
//| Validate buffers have minimum required size                      |
//+------------------------------------------------------------------+
bool ValidateBuffers()
  {
// Basic buffer validation
   if(ArraySize(xZigzagPeakBuffer) < xInpDepth)
      return false;
   if(ArraySize(xZigzagBottomBuffer) < xInpDepth)
      return false;
   if(ArraySize(xHighMapBuffer) < xInpDepth)
      return false;
   if(ArraySize(xLowMapBuffer) < xInpDepth)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
// Delete trend direction label
   ObjectDelete(0, trendLabel);
  }
//+------------------------------------------------------------------+
