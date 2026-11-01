//+------------------------------------------------------------------+
//|                          XAUUSD_M10_TrendLine_Indicator.mq5      |
//|                                        Copyright 2025              |
//|           XAUUSD M10 ONLY - Trend Line Touch Detection System     |
//|                     TIMER-BASED VERSION (1 second)               |
//|                SIMPLIFIED SIGNALS FOR SCREENSHOT EA               |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025"
#property version   "3.04"
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0

// Constants
#define MAX_TREND_LINES 4           
#define MIN_BARS_FOR_SLOPE 5        

// Enums
enum ENUM_TRENDLINE_MODE
{
   MODE_DISABLED = 0,              // Disabled
   MODE_ENABLED = 1                // Enabled
};

//--- Input parameters
input group "System Settings"
input string TrendLinePrefix = "Trendline";   // Base text for trend line names
input bool   UseEnhancedNaming = true;        // Use specific TL1, TL2, TL3, TL4 naming

input group "TrendLine 1 Configuration"
input ENUM_TRENDLINE_MODE TL1_Mode = MODE_DISABLED;     // TL1: Screenshot Mode
input double TL1_TouchTolerance = 50.0;                 // TL1: Touch Tolerance (points)
input int TL1_CooldownPeriod = 5;                       // TL1: Cooldown Period (minutes)

input group "TrendLine 2 Configuration"
input ENUM_TRENDLINE_MODE TL2_Mode = MODE_DISABLED;     // TL2: Screenshot Mode
input double TL2_TouchTolerance = 50.0;                 // TL2: Touch Tolerance (points)
input int TL2_CooldownPeriod = 5;                       // TL2: Cooldown Period (minutes)

input group "TrendLine 3 Configuration"
input ENUM_TRENDLINE_MODE TL3_Mode = MODE_DISABLED;     // TL3: Screenshot Mode
input double TL3_TouchTolerance = 50.0;                 // TL3: Touch Tolerance (points)
input int TL3_CooldownPeriod = 5;                       // TL3: Cooldown Period (minutes)

input group "TrendLine 4 Configuration"
input ENUM_TRENDLINE_MODE TL4_Mode = MODE_DISABLED;     // TL4: Screenshot Mode
input double TL4_TouchTolerance = 50.0;                 // TL4: Touch Tolerance (points)
input int TL4_CooldownPeriod = 5;                       // TL4: Cooldown Period (minutes)

// Debug flag
bool DEBUG_MODE = true; // Enabled for testing

//--- Chart identification
long g_chart_id = 0;

//--- System state variables (always enabled - no automatic stopping)
bool g_system_enabled = true;
string g_error_message = "";

//--- Global variables for trend lines
string g_trendLineNames[MAX_TREND_LINES];         
bool g_trendLineExists[MAX_TREND_LINES];          
bool g_trendLineValid[MAX_TREND_LINES];           
datetime g_lastTouchTime[MAX_TREND_LINES];        

// Configuration arrays (simplified - removed lot sizes)
ENUM_TRENDLINE_MODE g_trendLineModes[MAX_TREND_LINES];
double g_touchTolerances[MAX_TREND_LINES];
int g_cooldownPeriods[MAX_TREND_LINES];

//--- Control button variables
string g_button_name = "TrendLineSystemButton";

//+------------------------------------------------------------------+
//| Debug print function                                             |
//+------------------------------------------------------------------+
void DebugPrint(string message)
{
   if(DEBUG_MODE)
      Print("[TRENDLINE] ", message);
}

//+------------------------------------------------------------------+
//| Validate XAUUSD and M10 constraints                              |
//+------------------------------------------------------------------+
bool ValidateSymbolAndTimeframe()
{
   if(Symbol() != "XAUUSD")
   {
      g_error_message = "ERROR: This indicator works only with XAUUSD symbol. Current symbol: " + Symbol();
      return false;
   }
   
   if(Period() != PERIOD_M10)
   {
      g_error_message = "ERROR: This indicator works only with M10 timeframe. Current timeframe: " + EnumToString(Period());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Check for multiple chart operation                               |
//+------------------------------------------------------------------+
bool ValidateSingleChartOperation()
{
   int chart_count = 0;
   long chart_id = ChartFirst();
   
   while(chart_id != -1)
   {
      if(ObjectFind(chart_id, "TrendLineIndicatorMarker") >= 0)
      {
         chart_count++;
         if(chart_count > 1)
         {
            g_error_message = "ERROR: Indicator detected on multiple charts. Please use only ONE chart with this indicator.";
            return false;
         }
      }
      chart_id = ChartNext(chart_id);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Initialize trend line configuration arrays (simplified)          |
//+------------------------------------------------------------------+
void InitializeTrendLineConfig()
{
   g_trendLineModes[0] = TL1_Mode;
   g_trendLineModes[1] = TL2_Mode;
   g_trendLineModes[2] = TL3_Mode;
   g_trendLineModes[3] = TL4_Mode;
   
   g_touchTolerances[0] = TL1_TouchTolerance;
   g_touchTolerances[1] = TL2_TouchTolerance;
   g_touchTolerances[2] = TL3_TouchTolerance;
   g_touchTolerances[3] = TL4_TouchTolerance;
   
   g_cooldownPeriods[0] = TL1_CooldownPeriod;
   g_cooldownPeriods[1] = TL2_CooldownPeriod;
   g_cooldownPeriods[2] = TL3_CooldownPeriod;
   g_cooldownPeriods[3] = TL4_CooldownPeriod;
   
   // Initialize cooldown tracking
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      g_lastTouchTime[i] = 0;
   }
}

//+------------------------------------------------------------------+
//| Initialize all trend line arrays                                 |
//+------------------------------------------------------------------+
void InitializeTrendLineArrays()
{
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      g_trendLineNames[i] = "";
      g_trendLineExists[i] = false;
      g_trendLineValid[i] = false;
   }
}

//+------------------------------------------------------------------+
//| Get TL index from trend line name (Enhanced Naming)              |
//+------------------------------------------------------------------+
int GetTLIndexFromName(string trendLineName)
{
   if(!UseEnhancedNaming)
      return -1; // Use old method
   
   // Check for specific TL assignments
   if(StringFind(trendLineName, TrendLinePrefix + "_TL1") != -1)
      return 0; // TL1
   else if(StringFind(trendLineName, TrendLinePrefix + "_TL2") != -1)
      return 1; // TL2
   else if(StringFind(trendLineName, TrendLinePrefix + "_TL3") != -1)
      return 2; // TL3
   else if(StringFind(trendLineName, TrendLinePrefix + "_TL4") != -1)
      return 3; // TL4
   
   return -1; // Not a specifically assigned trend line
}

//+------------------------------------------------------------------+
//| Count and filter Trend Lines on the chart                        |
//+------------------------------------------------------------------+
int CountAndFilterTrendLines()
{
   InitializeTrendLineArrays();
   
   int count = 0;
   int total = ObjectsTotal(0, -1, OBJ_TREND);
   
   DebugPrint(StringFormat("Found %d total trend line objects on chart", total));
   
   if(UseEnhancedNaming)
   {
      // Enhanced naming: Look for specifically named trend lines
      for(int i = 0; i < total; i++)
      {
         string name = ObjectName(0, i, -1, OBJ_TREND);
         int tlIndex = GetTLIndexFromName(name);
         
         if(tlIndex >= 0)
         {
            if(g_trendLineExists[tlIndex])
            {
               g_error_message = StringFormat("ERROR: Multiple trend lines found for TL%d. Please ensure only one trend line per TL assignment.", tlIndex + 1);
               return -1;
            }
            
            g_trendLineNames[tlIndex] = name;
            g_trendLineExists[tlIndex] = true;
            count++;
            DebugPrint(StringFormat("Assigned trend line '%s' to TL%d", name, tlIndex + 1));
         }
      }
      
      // Also check for fallback generic names if specific assignments not found
      int generic_count = 0;
      for(int i = 0; i < total; i++)
      {
         string name = ObjectName(0, i, -1, OBJ_TREND);
         
         // Check if it's a generic trend line (contains prefix but not specific TL assignment)
         if(StringFind(name, TrendLinePrefix) != -1 && GetTLIndexFromName(name) < 0)
         {
            // Find first available slot
            for(int j = 0; j < MAX_TREND_LINES; j++)
            {
               if(!g_trendLineExists[j] && generic_count < MAX_TREND_LINES - count)
               {
                  g_trendLineNames[j] = name;
                  g_trendLineExists[j] = true;
                  generic_count++;
                  count++;
                  DebugPrint(StringFormat("Assigned generic trend line '%s' to TL%d (fallback)", name, j + 1));
                  break;
               }
            }
         }
      }
   }
   else
   {
      // Original method: Assign in discovery order
      for(int i = 0; i < total && count < MAX_TREND_LINES; i++)
      {
         string name = ObjectName(0, i, -1, OBJ_TREND);
         
         if(StringFind(name, TrendLinePrefix) != -1)
         {
            g_trendLineNames[count] = name;
            g_trendLineExists[count] = true;
            DebugPrint(StringFormat("Added trend line #%d: %s", count+1, name));
            count++;
         }
      }
   }
   
   return count;
}

//+------------------------------------------------------------------+
//| Analyze and validate trend lines                                 |
//+------------------------------------------------------------------+
bool AnalyzeTrendLines()
{
   int validCount = 0;
   
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      if(!g_trendLineExists[i]) continue;
      
      string name = g_trendLineNames[i];
      
      datetime time1 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 0);
      datetime time2 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 1);
      double price1 = ObjectGetDouble(0, name, OBJPROP_PRICE, 0);
      double price2 = ObjectGetDouble(0, name, OBJPROP_PRICE, 1);
      
      if(time1 == 0 || time2 == 0 || !MathIsValidNumber(price1) || !MathIsValidNumber(price2))
      {
         DebugPrint(StringFormat("Trend line #%d (%s): Invalid point data detected", i+1, name));
         g_trendLineValid[i] = false;
         continue;
      }
      
      int start_bar = iBarShift(Symbol(), PERIOD_M10, MathMin(time1, time2));
      int end_bar = iBarShift(Symbol(), PERIOD_M10, MathMax(time1, time2));
      int barCount = MathAbs(start_bar - end_bar);
      
      if(barCount < MIN_BARS_FOR_SLOPE)
      {
         g_trendLineValid[i] = false;
         Print("Warning: Trend line '", name, "' spans only ", barCount, " bars. Minimum ", MIN_BARS_FOR_SLOPE, " bars required.");
         continue;
      }
      
      g_trendLineValid[i] = true;
      validCount++;
      
      DebugPrint(StringFormat("Trend line #%d (%s): Valid - %d bars span", i+1, name, barCount));
   }
   
   return (validCount > 0);
}

//+------------------------------------------------------------------+
//| Get trend line value at specific time                            |
//+------------------------------------------------------------------+
double GetTrendLineValueAtTime(string trendName, datetime time)
{
   if(trendName == "" || time == 0)
      return EMPTY_VALUE;
   
   double value = ObjectGetValueByTime(0, trendName, time);
   
   if(MathIsValidNumber(value))
      return value;
      
   return EMPTY_VALUE;
}

//+------------------------------------------------------------------+
//| Check if price touches trend line within tolerance               |
//+------------------------------------------------------------------+
bool IsPriceTouchingTrendLine(int trendLineIndex, double price)
{
   if(trendLineIndex < 0 || trendLineIndex >= MAX_TREND_LINES || !g_trendLineExists[trendLineIndex] || !g_trendLineValid[trendLineIndex])
      return false;
   
   datetime currentTime = TimeCurrent();
   double trendLineValue = GetTrendLineValueAtTime(g_trendLineNames[trendLineIndex], currentTime);
   
   if(trendLineValue == EMPTY_VALUE)
      return false;
   
   // Convert points to price tolerance: points * Point()
   double tolerance = g_touchTolerances[trendLineIndex] * Point();
   double difference = MathAbs(price - trendLineValue);
   
   return (difference <= tolerance);
}

//+------------------------------------------------------------------+
//| Check cooldown period (MODIFIED: Convert minutes to seconds)     |
//+------------------------------------------------------------------+
bool IsCooldownExpired(int trendLineIndex)
{
   if(g_lastTouchTime[trendLineIndex] == 0) return true;
   
   datetime currentTime = TimeCurrent();
   int elapsedSeconds = (int)(currentTime - g_lastTouchTime[trendLineIndex]);
   
   // Convert cooldown period from minutes to seconds for comparison
   int cooldownSeconds = g_cooldownPeriods[trendLineIndex] * 60;
   
   return (elapsedSeconds >= cooldownSeconds);
}

//+------------------------------------------------------------------+
//| SIMPLIFIED: Send signal to EA function (removed lot size/mode)   |
//+------------------------------------------------------------------+
void SendSignalToEA(int trendLineIndex, double touchPrice)
{
   Print("========================================");
   Print("!!!!! SIGNAL GENERATION DETECTED !!!!!");
   Print("!!!!! PAUSING FOR 3 SECONDS !!!!!");
   Print("========================================");
   Sleep(3000); // 3-second pause to capture in Experts tab
   
   Print("=== SIGNAL GENERATION START ===");
   Print("TrendLine Index: ", trendLineIndex);
   Print("Touch Price: ", touchPrice);
   
   if(trendLineIndex < 0 || trendLineIndex >= MAX_TREND_LINES) 
   {
      Print("ERROR: Invalid trend line index");
      return;
   }
   
   if(g_trendLineModes[trendLineIndex] == MODE_DISABLED)
   {
      Print("ERROR: TL", trendLineIndex + 1, " is disabled");
      return;
   }
   
   // SIMPLIFIED SIGNAL FORMAT: TL{ID}|{Price}|{Timestamp}
   string signal = StringFormat("TL%d|%.5f|%d",
                               trendLineIndex + 1,
                               touchPrice,
                               (int)TimeCurrent());
   
   Print("Generated Simplified Signal String: ", signal);
   Sleep(1000); // 1-second pause
   
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   Print("Global Variable Name: ", varName);
   
   // Set global variable
   bool gv_result = GlobalVariableSet(varName, 1);
   Print("Global Variable Set Result: ", gv_result ? "SUCCESS" : "FAILED");
   Sleep(1000); // 1-second pause
   
   // Clear any existing comments first
   Comment("");
   Sleep(500);
   
   // Set the signal comment
   string signalComment = "SIGNAL: " + signal;
   Comment(signalComment);
   Print("Comment Set Successfully: ", signalComment);
   
   g_lastTouchTime[trendLineIndex] = TimeCurrent();
   
   Sleep(2000); // 2-second pause to see final result
   Print("=== SIGNAL GENERATION COMPLETE ===");
   Print("Check chart comment and EA processing...");
   Print("========================================");
}

//+------------------------------------------------------------------+
//| CORRECTED: Monitor trend line touches (restored proper timing)   |
//+------------------------------------------------------------------+
void MonitorTrendLineTouches()
{
   // Get current tick data
   double bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
   double ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
   
   if(bid == 0 || ask == 0) return;
   
   // DEBUG: Print current prices every 10 seconds (RESTORED from 30)
   static datetime last_price_debug = 0;
   if(TimeCurrent() - last_price_debug >= 10)
   {
      last_price_debug = TimeCurrent();
      Print("=== PRICE DEBUG ===");
      Print("Current BID: ", bid, " | ASK: ", ask);
   }
   
   // Check each enabled trend line for touches
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      if(!g_trendLineExists[i] || !g_trendLineValid[i] || g_trendLineModes[i] == MODE_DISABLED)
         continue;
      
      if(!IsCooldownExpired(i))
      {
         // Print cooldown message every 10 seconds (RESTORED from 30)
         static datetime last_cooldown_debug[MAX_TREND_LINES];
         if(TimeCurrent() - last_cooldown_debug[i] >= 10)
         {
            last_cooldown_debug[i] = TimeCurrent();
            int remainingSeconds = (g_cooldownPeriods[i] * 60) - (int)(TimeCurrent() - g_lastTouchTime[i]);
            int remainingMinutes = remainingSeconds / 60;
            Print("DEBUG TL", i+1, ": Cooldown active - ", remainingMinutes, " minutes remaining");
         }
         continue;
      }
      
      // DEBUG: Calculate trend line value and distance
      datetime currentTime = TimeCurrent();
      double trendLineValue = GetTrendLineValueAtTime(g_trendLineNames[i], currentTime);
      double tolerance = g_touchTolerances[i] * Point();
      
      // Print detailed touch analysis every 5 seconds (RESTORED from 15)
      static datetime last_touch_debug[MAX_TREND_LINES];
      if(TimeCurrent() - last_touch_debug[i] >= 5)
      {
         last_touch_debug[i] = TimeCurrent();
         Print("=== TL", i+1, " TOUCH ANALYSIS ===");
         Print("Trend Line Value: ", trendLineValue);
         Print("Tolerance: ", tolerance, " (", g_touchTolerances[i], " points)");
         Print("Mode: ENABLED (Screenshot on Touch)");
         Print("Cooldown: ", g_cooldownPeriods[i], " minutes");
         
         double bid_distance = MathAbs(bid - trendLineValue);
         double ask_distance = MathAbs(ask - trendLineValue);
         Print("BID Distance: ", bid_distance, " | Within tolerance: ", (bid_distance <= tolerance) ? "YES" : "NO");
         Print("ASK Distance: ", ask_distance, " | Within tolerance: ", (ask_distance <= tolerance) ? "YES" : "NO");
      }
      
      bool touched = false;
      double touchPrice = 0;
      
      // Check both BID and ASK prices for touches (simplified approach)
      bool bid_touched = IsPriceTouchingTrendLine(i, bid);
      bool ask_touched = IsPriceTouchingTrendLine(i, ask);
      
      if(bid_touched)
      {
         touched = true;
         touchPrice = bid;
         Print("*** TL", i+1, " TOUCH DETECTED at BID: ", touchPrice, " ***");
         Print("*** INITIATING SIGNAL GENERATION ***");
      }
      else if(ask_touched)
      {
         touched = true;
         touchPrice = ask;
         Print("*** TL", i+1, " TOUCH DETECTED at ASK: ", touchPrice, " ***");
         Print("*** INITIATING SIGNAL GENERATION ***");
      }
      
      if(touched)
      {
         Print("=== SENDING SIGNAL FOR TL", i+1, " ===");
         SendSignalToEA(i, touchPrice);
      }
   }
}

//+------------------------------------------------------------------+
//| Create detection marker for EA                                   |
//+------------------------------------------------------------------+
void CreateDetectionMarker()
{
   string marker_name = "TrendLineIndicatorMarker";
   
   ObjectDelete(0, marker_name);
   
   ObjectCreate(0, marker_name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, marker_name, OBJPROP_XDISTANCE, -100);
   ObjectSetInteger(0, marker_name, OBJPROP_YDISTANCE, -100);
   ObjectSetInteger(0, marker_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, marker_name, OBJPROP_TEXT, "TrendLine Indicator");
   ObjectSetInteger(0, marker_name, OBJPROP_COLOR, clrNONE);
   ObjectSetInteger(0, marker_name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, marker_name, OBJPROP_SELECTABLE, false);
   
   DebugPrint("Detection marker created");
}

//+------------------------------------------------------------------+
//| Create manual restart control button (repositioned)              |
//+------------------------------------------------------------------+
void CreateControlButton()
{
   DebugPrint("Creating manual restart control button...");
   
   // Clean up existing objects
   ObjectDelete(0, g_button_name + "_BG");
   ObjectDelete(0, g_button_name + "_TEXT");
   ObjectDelete(0, g_button_name);
   
   // Create single button object
   if(ObjectCreate(0, g_button_name, OBJ_BUTTON, 0, 0, 0))
   {
      // Button dimensions
      int button_width = 180;
      int button_height = 30;
      int x_margin = 20;
      int y_margin = 80;  // MOVED DOWN to avoid comment overlap
      
      // Position from top-left corner
      ObjectSetInteger(0, g_button_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, g_button_name, OBJPROP_XDISTANCE, x_margin);
      ObjectSetInteger(0, g_button_name, OBJPROP_YDISTANCE, y_margin);
      ObjectSetInteger(0, g_button_name, OBJPROP_XSIZE, button_width);
      ObjectSetInteger(0, g_button_name, OBJPROP_YSIZE, button_height);
      
      // Text properties
      ObjectSetString(0, g_button_name, OBJPROP_TEXT, "MANUAL RESTART");
      ObjectSetString(0, g_button_name, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, g_button_name, OBJPROP_FONTSIZE, 9);  // Slightly smaller
      ObjectSetInteger(0, g_button_name, OBJPROP_COLOR, clrWhite);
      
      // Visual style
      ObjectSetInteger(0, g_button_name, OBJPROP_BGCOLOR, clrDarkGreen);
      ObjectSetInteger(0, g_button_name, OBJPROP_BORDER_COLOR, clrBlack);
      
      // Button behavior
      ObjectSetInteger(0, g_button_name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
      ObjectSetInteger(0, g_button_name, OBJPROP_HIDDEN, false);
      ObjectSetInteger(0, g_button_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, g_button_name, OBJPROP_ZORDER, 999);
      ObjectSetInteger(0, g_button_name, OBJPROP_STATE, false);
      ObjectSetInteger(0, g_button_name, OBJPROP_BACK, false);
      
      DebugPrint("Button repositioned to avoid comment overlap");
   }
   
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| UpdateButtonText function (unchanged)                            |
//+------------------------------------------------------------------+
void UpdateButtonText()
{
   if(ObjectFind(0, g_button_name) >= 0)
   {
      int enabled_count = 0;
      for(int i = 0; i < MAX_TREND_LINES; i++)
      {
         if(g_trendLineExists[i] && g_trendLineValid[i] && g_trendLineModes[i] != MODE_DISABLED)
            enabled_count++;
      }
      
      string button_text = StringFormat("SYSTEM ACTIVE (%d)", enabled_count);
      ObjectSetString(0, g_button_name, OBJPROP_TEXT, button_text);
   }
   
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Manual restart system - updates ALL coordinates                  |
//+------------------------------------------------------------------+
bool ManualRestartSystem()
{
   Print("========================================");
   Print("MANUAL RESTART TRIGGERED");
   Print("Updating ALL trend line coordinates...");
   Print("========================================");
   
   // Clear all existing data completely
   InitializeTrendLineArrays();
   InitializeTrendLineConfig();
   
   // Reset cooldowns
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      g_lastTouchTime[i] = 0;
   }
   
   // Re-scan ALL trend lines from current chart state
   int trendLineCount = CountAndFilterTrendLines();
   if(trendLineCount < 0)
   {
      Print("RESTART FAILED: " + g_error_message);
      Alert("RESTART FAILED: " + g_error_message);
      Comment(g_error_message);
      return false;
   }
   
   // Re-validate ALL trend lines
   bool has_valid_lines = false;
   if(trendLineCount > 0)
   {
      has_valid_lines = AnalyzeTrendLines();
   }
   
   Print("MANUAL RESTART COMPLETED SUCCESSFULLY");
   Print("   Trend lines found: ", trendLineCount);
   Print("   Valid trend lines: ", has_valid_lines ? "YES" : "NO");
   
   // Show current configuration
   int enabled_count = 0;
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      if(g_trendLineExists[i] && g_trendLineValid[i] && g_trendLineModes[i] != MODE_DISABLED)
      {
         enabled_count++;
         string modeStr = "";
         switch(g_trendLineModes[i])
         {
            case MODE_ENABLED: modeStr = "Enabled"; break;
            default: modeStr = "Unknown"; break;
         }
         Print("   TL", i+1, ": ", g_trendLineNames[i], " - ", modeStr, " (", g_cooldownPeriods[i], " min cooldown)");
      }
   }
   
   Print("   Active screenshot lines: ", enabled_count);
   Print("========================================");
   
   Comment("");
   UpdateButtonText();
   
   return true;
}

//+------------------------------------------------------------------+
//| Chart event handler for manual restart button                    |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == g_button_name)  // Now checking for the single button object
      {
         DebugPrint("Manual restart button clicked");
         
         bool restart_success = ManualRestartSystem();
         
         if(restart_success)
         {
            Alert("System manually restarted successfully! All coordinates updated.");
         }
         else
         {
            Alert("Manual restart failed. Check trend lines and try again.");
         }
         
         // Reset button state
         ObjectSetInteger(0, g_button_name, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Custom indicator initialization function                          |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("========================================");
   Print("XAUUSD M10 TRENDLINE INDICATOR STARTING");
   Print("Version 3.04 - Simplified Enable/Disable Mode for Screenshots");
   Print("========================================");
   
   g_chart_id = ChartID();
   g_system_enabled = true; // Always enabled
   g_error_message = "";
   
   if(!ValidateSymbolAndTimeframe())
   {
      Alert(g_error_message);
      Print(g_error_message);
      Comment(g_error_message);
      return(INIT_FAILED);
   }
   
   if(!ValidateSingleChartOperation())
   {
      Alert(g_error_message);
      Print(g_error_message);
      Comment(g_error_message);
      return(INIT_FAILED);
   }
   
   InitializeTrendLineConfig();
   
   int trendLineCount = CountAndFilterTrendLines();
   if(trendLineCount < 0)
   {
      Alert(g_error_message);
      Print(g_error_message);
      Comment(g_error_message);
      return(INIT_FAILED);
   }
   
   if(trendLineCount > 0)
   {
      AnalyzeTrendLines();
   }
   
   CreateDetectionMarker();
   CreateControlButton();
   EventSetTimer(1); // 1-second timer for monitoring
   
   Print("Indicator initialized successfully");
   Print("   Symbol: XAUUSD, Timeframe: M10");
   Print("   Trend lines detected: ", trendLineCount);
   Print("   Enhanced Naming: ", UseEnhancedNaming ? "ENABLED" : "DISABLED");
   Print("   Mode: Timer-based monitoring (1 second)");
   Print("   Signal Format: SIMPLIFIED for Screenshot EA");
   Print("   Cooldown periods: Now in MINUTES");
   Print("   Click green button after moving trend lines");
   Print("   System ready for touch detection");
   
   if(UseEnhancedNaming)
   {
      Print("NAMING CONVENTION:");
      Print("   TL1: Name must contain '" + TrendLinePrefix + "_TL1'");
      Print("   TL2: Name must contain '" + TrendLinePrefix + "_TL2'");
      Print("   TL3: Name must contain '" + TrendLinePrefix + "_TL3'"); 
      Print("   TL4: Name must contain '" + TrendLinePrefix + "_TL4'");
      Print("   Example: 'Trendline_TL1_Support'");
   }
   
   Print("SIMPLIFIED SIGNAL FORMAT: TL{ID}|{Price}|{Timestamp}");
   Print("   Example: TL2|3695.15|1758078561");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| CORRECTED: Timer function (more frequent debug, cleaner comments)|
//+------------------------------------------------------------------+
void OnTimer()
{
   // Reduce timer spam but not too much - print every 30 seconds instead of 60
   static int timer_count = 0;
   timer_count++;
   
   if(timer_count % 30 == 0)
      Print("INDICATOR TIMER: ", TimeCurrent(), " (", timer_count, " seconds elapsed)");
   
   // Main monitoring function - called every 1 second
   MonitorTrendLineTouches();
   
   // Update button display
   UpdateButtonText();
   
   // Clean comment management - only show signal comments
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   bool hasActiveSignal = false;
   
   if(GlobalVariableCheck(varName))
   {
      double signalFlag = GlobalVariableGet(varName);
      if(signalFlag > 0)
         hasActiveSignal = true;
   }
   
   // Only update comment if no active signal (preserve signal comments)
   if(!hasActiveSignal)
   {
      int enabled_count = 0;
      for(int i = 0; i < MAX_TREND_LINES; i++)
      {
         if(g_trendLineExists[i] && g_trendLineValid[i] && g_trendLineModes[i] != MODE_DISABLED)
            enabled_count++;
      }
      
      // Only update system status comment every 10 seconds to reduce flickering (RESTORED from 30)
      if(timer_count % 10 == 0)
      {
         Comment("\n\nXAUUSD M10 TrendLine System: ACTIVE (" + IntegerToString(enabled_count) + " lines enabled)");
      }
   }
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function                               |
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
   return(rates_total);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   DebugPrint(StringFormat("Indicator deinitialization (reason: %d)", reason));
   
   EventKillTimer();
   
   // Clean up all objects
   ObjectDelete(0, "TrendLineIndicatorMarker");
   ObjectDelete(0, g_button_name);
   
   // Also clean up any old-style objects that might exist
   ObjectDelete(0, g_button_name + "_BG");
   ObjectDelete(0, g_button_name + "_TEXT");
   
   // Clean up global variables
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   GlobalVariableDel(varName);
   GlobalVariableDel(varName + "_Data");
   
   Comment("");
   ChartRedraw();
   
   Print("XAUUSD M10 TrendLine Indicator stopped");
}