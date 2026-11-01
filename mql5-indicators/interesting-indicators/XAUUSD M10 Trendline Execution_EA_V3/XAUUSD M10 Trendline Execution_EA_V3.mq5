//+------------------------------------------------------------------+
//|                     XAUUSD_M10_KeltnerTrendline_EA.mq5           |
//|                                        Copyright 2025              |
//|              XAUUSD M10 ONLY - Trendline Touch Order Execution EA |
//|           WITH MAXIMUM EXPOSURE LIMIT & ONE SIDE TRADE POSITION   |
//|                FULLY COMPATIBLE WITH KELTNER TRENDLINE INDICATOR  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025"
#property version   "9.00"
#property strict

#include <Trade\Trade.mqh>

// Constants
#define EA_MAGIC_NUMBER 789456
#define MAX_TRENDLINES 6
#define MAX_LAYERS_PER_TL 5

// Enums (must be declared before input parameters)
enum ENUM_TRENDLINE_MODE
{
   MODE_DISABLED = 0,              // Disabled
   MODE_SELL = 1,           // Sell
   MODE_BUY = 2             // Buy
};

// One Side Trade Position enum
enum ENUM_ONE_SIDE_TRADE
{
   ONE_SIDE_DISABLED = 0,          // Disable (Both Buy and Sell allowed)
   ONE_SIDE_BUY_ONLY = 1,          // Buy Only - Uptrend
   ONE_SIDE_SELL_ONLY = 2          // Sell Only - Downtrend
};

// Signal processing
struct SignalData
{
   int trendline_id;  // CHANGED from band_id
   ENUM_TRENDLINE_MODE mode;
   double lot_size;
   double touch_price;
   datetime timestamp;
};

struct MultiLayerConfig
{
   double marketPercent;
   int numberOfLayers;
   double firstOffset;
   double layerSpacing;
};

struct PendingLimitOrder
{
   ulong ticket;
   int tlId;
   double size;
   datetime placedTime;
};

// Input parameters (after enum declarations)
input group "EA Settings"
input int      MaxRetries = 3;                 // Maximum order retry attempts
input int      RetryDelay = 1000;              // Delay between retries (ms)
input bool     DebugMode = false;              // Enable debug messages

input group "Risk Management"
input double   MaxExposureLimit = 0.05;        // Maximum Exposure Limit (lots)
input bool     EnableExposureLimit = true;     // Enable/Disable exposure limit checking

input group "Trading Direction Control"
input ENUM_ONE_SIDE_TRADE OneSideTradeMode = ONE_SIDE_DISABLED; // One Side Trade Position

input group "Reconnection Settings"
input int      ReconnectionCheckInterval = 5;  // Check for reconnection every N seconds
input bool     AutoRecoverAfterReconnection = true; // Auto-recover system after reconnection

input group "Multi-Layer Execution Settings"
input bool     EnableMultiLayer = true;                    // Enable multi-layer execution
input double   GlobalMarketPercent = 30.0;                 // Market order % (enter 30 for 30%, range: 0-100)
input int      GlobalNumberOfLayers = 3;                   // Number of limit order layers (1-5)
input double   GlobalFirstLayerOffset = 30.0;              // First layer offset (points from touch)
input double   GlobalLayerSpacing = 30.0;                  // Spacing between layers (points)
input bool     CountPendingInExposure = true;              // Count pending limits in exposure

input group "Per-Trendline Multi-Layer Override (0 = use global)"
input group "===== TL1 Specific Configuration ====="
input double   TL1_MarketPercent = 0;          // TL1: Market % (enter 30 for 30%, 0=global)
input int      TL1_NumberOfLayers = 0;         // TL1: Number of layers (0=global)
input double   TL1_FirstOffset = 0;            // TL1: First offset in points (0=global)
input double   TL1_LayerSpacing = 0;           // TL1: Layer spacing in points (0=global)

input group "===== TL2 Specific Configuration ====="
input double   TL2_MarketPercent = 0;          // TL2: Market % (enter 30 for 30%, 0=global)
input int      TL2_NumberOfLayers = 0;         // TL2: Number of layers (0=global)
input double   TL2_FirstOffset = 0;            // TL2: First offset in points (0=global)
input double   TL2_LayerSpacing = 0;           // TL2: Layer spacing in points (0=global)

input group "===== TL3 Specific Configuration ====="
input double   TL3_MarketPercent = 0;          // TL3: Market % (enter 30 for 30%, 0=global) 
input int      TL3_NumberOfLayers = 0;         // TL3: Number of layers (0=global)
input double   TL3_FirstOffset = 0;            // TL3: First offset in points (0=global)
input double   TL3_LayerSpacing = 0;           // TL3: Layer spacing in points (0=global)

input group "===== TL4 Specific Configuration ====="
input double   TL4_MarketPercent = 0;          // TL4: Market % (enter 30 for 30%, 0=global)
input int      TL4_NumberOfLayers = 0;         // TL4: Number of layers (0=global)
input double   TL4_FirstOffset = 0;            // TL4: First offset in points (0=global)
input double   TL4_LayerSpacing = 0;           // TL4: Layer spacing in points (0=global)

input group "===== TL5 Specific Configuration ====="
input double   TL5_MarketPercent = 0;          // TL5: Market % (enter 30 for 30%, 0=global) 
input int      TL5_NumberOfLayers = 0;         // TL5: Number of layers (0=global)
input double   TL5_FirstOffset = 0;            // TL5: First offset in points (0=global)
input double   TL5_LayerSpacing = 0;           // TL5: Layer spacing in points (0=global)

input group "===== TL6 Specific Configuration ====="
input double   TL6_MarketPercent = 0;          // TL6: Market % (enter 30 for 30%, 0=global)
input int      TL6_NumberOfLayers = 0;         // TL6: Number of layers (0=global)
input double   TL6_FirstOffset = 0;            // TL6: First offset in points (0=global)
input double   TL6_LayerSpacing = 0;           // TL6: Layer spacing in points (0=global)

// Global variables
CTrade trade;
long g_chart_id;
bool g_system_enabled = true;
bool g_trading_enabled = true;
string g_error_message = "";

// Add these new global variables for position tracking
double g_last_calculated_exposure = -1.0;    // Track last known exposure
int g_last_position_count = -1;              // Track position count changes
datetime g_last_position_check = 0;          // Force periodic refresh
bool g_force_display_update = false;         // Flag for immediate updates

//+------------------------------------------------------------------+
// Add these new global variables for total position tracking
//+------------------------------------------------------------------+
double g_last_total_exposure = -1.0;        // Track total exposure changes
int g_last_total_position_count = -1;       // Track total position count changes

//+------------------------------------------------------------------+
// ADD THESE NEW GLOBAL VARIABLES (after existing globals)
//+------------------------------------------------------------------+
bool g_emergency_stop_active = false;        // Emergency stop flag
string g_stop_button_name = "Keltner_EA_STOP";     // Stop button object name
string g_start_button_name = "Keltner_EA_START";   // Start button object name

// Signal management variables
datetime g_last_signal_time = 0;
int g_signal_cooldown_seconds = 30;

//+------------------------------------------------------------------+
// NEW: EA Heartbeat Communication Variables
//+------------------------------------------------------------------+
string g_ea_heartbeat_var = "";
datetime g_last_heartbeat_time = 0;

// Chart display configuration
int g_display_bottom_margin = 35;
int g_display_y_step = 24;
int g_display_font_size = 9;
int g_display_col1_x = 10;
int g_display_col2_x = 200;
int g_display_col3_x = 220;
string g_ea_object_prefix = "KeltnerTrendlineEA_Info_";

// Reconnection detection variables
bool g_connection_status = true;
datetime g_last_tick_time = 0;
datetime g_system_start_time = 0;
bool g_recovery_needed = false;
int g_reconnection_attempts = 0;

// Add these static variables for detection tracking
static int g_consecutive_detection_failures = 0;
static datetime g_last_successful_detection = 0;
static bool g_detection_recovery_mode = false;

// Multi-layer tracking
PendingLimitOrder g_pendingLimits[MAX_TRENDLINES * MAX_LAYERS_PER_TL];
int g_pendingLimitCount = 0;

// Pekali for price rounding
double g_Pekali = 1.0;

// Forward function declarations
void DebugPrint(string message);
void CreateInfoDisplay();
void UpdateInfoDisplay();
void CleanupInfoDisplay();
bool ValidateSymbolAndTimeframe();
bool ValidateIndicatorPresence();
bool ValidateSingleChartOperation();
bool ValidateOneSideTradePosition(ENUM_TRENDLINE_MODE mode);
bool ValidateExposureLimit(ENUM_TRENDLINE_MODE mode, double volume);
double GetTotalNetExposure();
double GetNetVolume();
double GetPendingLimitVolume();
void CheckForSignalsEnhanced();
bool ParseSignalData(string signalStr, SignalData &signal);
bool ExecuteMarketOrder(const SignalData &signal);
bool ExecuteMultiLayerOrder(const SignalData &signal);
bool PlaceBuyMarketOrder(double volume);
bool PlaceSellMarketOrder(double volume);
ulong PlaceBuyLimitOrderWithTicket(double volume, double price);
ulong PlaceSellLimitOrderWithTicket(double volume, double price);
void AddPendingLimit(ulong ticket, int tlId, double size);
MultiLayerConfig GetMultiLayerConfig(int tlId);
void DistributeLotSizes(double totalSize, int layers, double &sizes[]);
double RoundPriceForBuy(double price);
double RoundPriceForSell(double price);
void UpdatePekali();
void PrintPortfolioStatus();
bool CheckConnectionStatus();
bool RecoverSystemAfterReconnection();
void ClearStaleSignals();
void CreateEmergencyButtons();
void UpdateButtonVisibility();
void ActivateEmergencyStop();
void DeactivateEmergencyStop();
void InitializePositionTracking();

//+------------------------------------------------------------------+
//| Create Emergency Stop/Start Buttons                             |
//+------------------------------------------------------------------+
void CreateEmergencyButtons()
{
   // Clean up existing buttons first
   ObjectDelete(0, g_stop_button_name);
   ObjectDelete(0, g_start_button_name);
   
   // STOP Button (Red)
   if(ObjectCreate(0, g_stop_button_name, OBJ_BUTTON, 0, 0, 0))
   {
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_YDISTANCE, 30);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_XSIZE, 100);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_YSIZE, 35);
      ObjectSetString(0, g_stop_button_name, OBJPROP_TEXT, "EA STOP");
      ObjectSetString(0, g_stop_button_name, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_FONTSIZE, 12);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_BGCOLOR, clrRed);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_BORDER_COLOR, clrDarkRed);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_STATE, false);
   }
   
   // START Button (Green) - Initially hidden
   if(ObjectCreate(0, g_start_button_name, OBJ_BUTTON, 0, 0, 0))
   {
      ObjectSetInteger(0, g_start_button_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_YDISTANCE, 30);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_XSIZE, 100);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_YSIZE, 35);
      ObjectSetString(0, g_start_button_name, OBJPROP_TEXT, "EA START");
      ObjectSetString(0, g_start_button_name, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, g_start_button_name, OBJPROP_FONTSIZE, 12);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_BGCOLOR, clrGreen);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_BORDER_COLOR, clrDarkGreen);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_STATE, false);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS); // Hidden initially
   }
   
   UpdateButtonVisibility();
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Update Button Visibility Based on Emergency Stop State          |
//+------------------------------------------------------------------+
void UpdateButtonVisibility()
{
   if(g_emergency_stop_active)
   {
      // Show START button, hide STOP button
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   }
   else
   {
      // Show STOP button, hide START button  
      ObjectSetInteger(0, g_stop_button_name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(0, g_start_button_name, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
   }
}

//+------------------------------------------------------------------+
//| Emergency Stop Function                                          |
//+------------------------------------------------------------------+
void ActivateEmergencyStop()
{
   g_emergency_stop_active = true;
   g_trading_enabled = false;  // Disable trading
   
   Print("========================================");
   Print("*** EMERGENCY EA STOP ACTIVATED ***");
   Print("*** ALL TRADING DISABLED ***");
   Print("*** Click 'EA START' button to resume ***");
   Print("========================================");
   
   Alert("EMERGENCY STOP: Keltner 10-Band EA has been stopped!");
   
   UpdateButtonVisibility();
   g_force_display_update = true;
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Emergency Start Function                                         |
//+------------------------------------------------------------------+
void DeactivateEmergencyStop()
{
   g_emergency_stop_active = false;
   g_trading_enabled = true;   // Re-enable trading
   
   Print("========================================");
   Print("*** EMERGENCY STOP DEACTIVATED ***");
   Print("*** TRADING RESUMED ***");
   Print("*** System Status: ACTIVE ***");
   Print("========================================");
   
   Alert("EA RESUMED: Keltner 10-Band EA is now active again!");
   
   UpdateButtonVisibility();
   g_force_display_update = true;
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Chart Event Handler (ADD THIS NEW FUNCTION)                     |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   // Handle button clicks
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == g_stop_button_name)
      {
         Print("STOP button clicked - Activating emergency stop...");
         ActivateEmergencyStop();
         ObjectSetInteger(0, g_stop_button_name, OBJPROP_STATE, false); // Reset button state
      }
      else if(sparam == g_start_button_name)
      {
         Print("START button clicked - Deactivating emergency stop...");
         DeactivateEmergencyStop();
         ObjectSetInteger(0, g_start_button_name, OBJPROP_STATE, false); // Reset button state
      }
   }
}

//+------------------------------------------------------------------+
//| Debug print function                                             |
//+------------------------------------------------------------------+
void DebugPrint(string message)
{
   if(DebugMode)
      Print("[KELTNER 10-BAND EA] ", message);
}

//+------------------------------------------------------------------+
//| MODIFIED: GetTotalNetExposure with NET calculation               |
//| (Rename from GetTotalExposure to reflect new logic)             |
//+------------------------------------------------------------------+
double GetTotalNetExposure()
{
   double buyVolume = 0.0;
   double sellVolume = 0.0;
   int totalPositionCount = 0;
   
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         if(symbol == _Symbol) // Count ALL positions on this symbol regardless of magic number
         {
            double volume = PositionGetDouble(POSITION_VOLUME);
            totalPositionCount++; // Count all positions
            
            // CRITICAL CHANGE: Separate buy and sell volumes for net calculation
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
               buyVolume += volume;
            else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
               sellVolume += volume;
         }
      }
   }
   
   // Calculate NET exposure (buy - sell)
   double netExposure = buyVolume - sellVolume;
   double absoluteNetExposure = MathAbs(netExposure);
   
   // CRITICAL: Detect changes in NET positions (not total volume)
   bool netChanged = false;
   
   if(g_last_total_exposure == -1.0) // First run
   {
      g_last_total_exposure = absoluteNetExposure;
      g_last_total_position_count = totalPositionCount;
      netChanged = true;
   }
   else if(totalPositionCount != g_last_total_position_count || 
           MathAbs(absoluteNetExposure - g_last_total_exposure) > 0.001)
   {
      Print("=== NET POSITION CHANGE DETECTED ===");
      Print("Total Position Count: ", g_last_total_position_count, " -> ", totalPositionCount);
      Print("Buy Volume: ", DoubleToString(buyVolume, 3), " | Sell Volume: ", DoubleToString(sellVolume, 3));
      Print("Net Exposure: ", DoubleToString(netExposure, 3), " | Absolute Net: ", DoubleToString(absoluteNetExposure, 3));
      Print("Previous Absolute Net: ", DoubleToString(g_last_total_exposure, 3));
      
      g_last_total_position_count = totalPositionCount;
      g_last_total_exposure = absoluteNetExposure;
      netChanged = true;
   }
   
   // Force display update when NET positions change
   if(netChanged)
   {
      g_force_display_update = true;
      Print("Display update triggered by net position change");
   }
   
   // Return ABSOLUTE net exposure for limit checking
   return absoluteNetExposure;
}

//+------------------------------------------------------------------+
//| Check connection status and detect reconnection                  |
//+------------------------------------------------------------------+
bool CheckConnectionStatus()
{
   bool terminal_connected = TerminalInfoInteger(TERMINAL_CONNECTED);
   bool account_trade_allowed = AccountInfoInteger(ACCOUNT_TRADE_ALLOWED);
   datetime current_time = TimeCurrent();
   
   bool recent_tick = (current_time - g_last_tick_time) < 60;
   bool current_status = terminal_connected && account_trade_allowed;
   
   // Detect reconnection
   if(!g_connection_status && current_status && recent_tick)
   {
      Print("=== RECONNECTION DETECTED ===");
      Print("System will attempt recovery...");
      g_recovery_needed = true;
      g_reconnection_attempts++;
   }
   else if(g_connection_status && !current_status)
   {
      Print("=== CONNECTION LOST ===");
   }
   
   g_connection_status = current_status;
   return current_status;
}

//+------------------------------------------------------------------+
//| Recover system after reconnection                                |
//+------------------------------------------------------------------+
bool RecoverSystemAfterReconnection()
{
   if(!AutoRecoverAfterReconnection)
   {
      Print("AUTO-RECOVERY: Disabled by settings");
      return false;
   }
   
   Print("=== SYSTEM RECOVERY START ===");
   Print("Reconnection Attempt: ", g_reconnection_attempts);
   
   // Re-initialize trade object
   trade.SetExpertMagicNumber(EA_MAGIC_NUMBER);
   
   // Update chart ID (may have changed)
   long old_chart_id = g_chart_id;
   g_chart_id = ChartID();
   
   if(old_chart_id != g_chart_id)
   {
      Print("Chart ID changed: ", old_chart_id, " -> ", g_chart_id);
      string old_var_name = "TrendLineSignal_" + IntegerToString(old_chart_id);
      if(GlobalVariableCheck(old_var_name))
      {
         GlobalVariableDel(old_var_name);
         Print("Cleaned up old global variable: ", old_var_name);
      }
   }
   
   // Re-validate system
   if(!ValidateSymbolAndTimeframe() || !ValidateIndicatorPresence() || !ValidateSingleChartOperation())
   {
      Print("RECOVERY FAILED: System validation failed");
      return false;
   }
   
   // Reset system state
   g_system_enabled = true;
   g_trading_enabled = true;
   g_error_message = "";
   
   EventKillTimer();
   EventSetTimer(1);
   
   Print("=== SYSTEM RECOVERY COMPLETE ===");
   Print("System Status: ACTIVE");
   g_recovery_needed = false;
   
   ClearStaleSignals();
   return true;
}

//+------------------------------------------------------------------+
//| Clear stale signals after reconnection                           |
//+------------------------------------------------------------------+
void ClearStaleSignals()
{
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   
   if(GlobalVariableCheck(varName))
   {
      double signalFlag = GlobalVariableGet(varName);
      if(signalFlag > 0)
      {
         datetime signal_time = (datetime)signalFlag;
         if(TimeCurrent() - signal_time > 120)
         {
            GlobalVariableSet(varName, 0);
            Print("Cleared stale signal from global variable");
         }
      }
   }
   
   string comment = ChartGetString(0, CHART_COMMENT);
   if(StringFind(comment, "SIGNAL: ") == 0)
   {
      Comment("");
      Print("Cleared stale signal from chart comment");
   }
}

//+------------------------------------------------------------------+
//| Enhanced signal processing with global cooldown                  |
//+------------------------------------------------------------------+
void CheckForSignalsEnhanced()
{
   // CRITICAL: Check emergency stop FIRST
   if(g_emergency_stop_active)
   {
      DebugPrint("Emergency stop active - skipping all signal processing");
      return;
   }
   
   if(!g_system_enabled || !g_trading_enabled)
      return;
      
   if(!g_connection_status)
   {
      DebugPrint("Skipping signal check - not connected");
      return;
   }
   
   // Check global signal cooldown to prevent simultaneous signals
   datetime current_time = TimeCurrent();
   if(current_time - g_last_signal_time < g_signal_cooldown_seconds)
   {
      static datetime last_cooldown_msg = 0;
      if(current_time - last_cooldown_msg >= 30) // Reduced from 10 to 30 seconds
      {
         last_cooldown_msg = current_time;
         int remaining = g_signal_cooldown_seconds - (int)(current_time - g_last_signal_time);
         DebugPrint("Global signal cooldown active - " + IntegerToString(remaining) + " seconds remaining");
      }
      return;
   }
   
   // Try multiple global variable name patterns
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   string varNames[3];
   varNames[0] = varName;
   varNames[1] = "TrendLineSignal_" + IntegerToString(ChartID());
   varNames[2] = "TrendLineSignal";
   
   bool signal_found = false;
   double signalFlag = 0;
   string active_var_name = "";
   
   for(int i = 0; i < 3; i++)
   {
      if(GlobalVariableCheck(varNames[i]))
      {
         double temp_flag = GlobalVariableGet(varNames[i]);
         if(temp_flag > 0)
         {
            signalFlag = temp_flag;
            active_var_name = varNames[i];
            signal_found = true;
            break;
         }
      }
   }
   
   if(!signal_found)
   {
      static datetime last_no_signal_debug = 0;
      if(current_time - last_no_signal_debug >= 60) // Reduced spam from 30 to 60 seconds
      {
         last_no_signal_debug = current_time;
         DebugPrint("No active signals found in global variables");
      }
      return;
   }
   
   Print("=== TRENDLINE SIGNAL FOUND ===");
   Print("Active Global Variable: ", active_var_name, " = ", signalFlag);
   
   // Get signal data from comment
   string comment = ChartGetString(0, CHART_COMMENT);
   Print("Chart Comment: '", comment, "'");
   
   if(StringFind(comment, "SIGNAL: ") != 0)
   {
      Print("ERROR: No valid signal found in comment");
      GlobalVariableSet(active_var_name, 0);
      return;
   }
   
   string signalData = StringSubstr(comment, 8);
   Print("Extracted Signal Data: '", signalData, "'");
   
   // Parse and execute signal
   SignalData signal;
   if(!ParseSignalData(signalData, signal))
   {
      Print("ERROR: Failed to parse signal data");
      GlobalVariableSet(active_var_name, 0);
      Comment("");
      return;
   }
   
   Print("=== PARSED SIGNAL ===");
   Print("TL ID: ", signal.trendline_id, " | Mode: ", signal.mode, " | Lot Size: ", signal.lot_size, " | Touch Price: ", signal.touch_price);
   
   // Set global cooldown BEFORE attempting execution to prevent race conditions
   g_last_signal_time = current_time;
   Print("Global signal cooldown activated for ", g_signal_cooldown_seconds, " seconds");
   
   bool success = ExecuteMarketOrder(signal);
   
   // Clear signal regardless of success
   GlobalVariableSet(active_var_name, 0);
   Comment("");
   
   Print("=== SIGNAL PROCESSING RESULT: ", success ? "SUCCESS" : "FAILED", " ===");
   PrintPortfolioStatus();
   
   // If execution failed, reduce cooldown time to allow quicker retry
   if(!success)
   {
      g_last_signal_time = current_time - (g_signal_cooldown_seconds - 10);
      Print("Execution failed - reduced cooldown to 10 seconds");
   }
}

//+------------------------------------------------------------------+
//| Validate XAUUSD and M10 constraints                              |
//+------------------------------------------------------------------+
bool ValidateSymbolAndTimeframe()
{
   if(Symbol() != "XAUUSD")
   {
      g_error_message = "ERROR: This EA works only with XAUUSD symbol. Current symbol: " + Symbol();
      return false;
   }
   
   if(Period() != PERIOD_M10)
   {
      g_error_message = "ERROR: This EA works only with M10 timeframe. Current timeframe: " + EnumToString(Period());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Enhanced ValidateIndicatorPresence with recovery logic          |
//+------------------------------------------------------------------+
bool ValidateIndicatorPresence()
{
   string marker_name = "KeltnerTrendlineIndicatorMarker";
   bool marker_found = false;
   datetime current_time = TimeCurrent();
   
   // Method 1: Direct ObjectFind (fastest)
   if(ObjectFind(0, marker_name) >= 0)
   {
      marker_found = true;
      DebugPrint("Indicator marker found via direct search");
   }
   
   // Method 2: Manual object enumeration (fallback)
   if(!marker_found)
   {
      int total_objects = ObjectsTotal(0, -1, -1);
      for(int i = 0; i < total_objects; i++)
      {
         string obj_name = ObjectName(0, i, -1, -1);
         if(obj_name == marker_name)
         {
            marker_found = true;
            DebugPrint("Indicator marker found via manual search at index " + IntegerToString(i));
            break;
         }
         
         // Also check for Keltner-related objects as secondary confirmation
         if(StringFind(obj_name, "Keltner") >= 0)
         {
            DebugPrint("Found Keltner-related object: " + obj_name);
         }
      }
   }
   
   // Method 3: Multi-chart search (comprehensive fallback)
   if(!marker_found)
   {
      long chart_id = ChartFirst();
      int charts_checked = 0;
      
      while(chart_id != -1 && charts_checked < 20) // Limit to prevent infinite loops
      {
         charts_checked++;
         if(ObjectFind(chart_id, marker_name) >= 0)
         {
            string chart_symbol = ChartSymbol(chart_id);
            ENUM_TIMEFRAMES chart_period = ChartPeriod(chart_id);
            
            DebugPrint("Found marker on chart: " + IntegerToString(chart_id) + 
                      " Symbol: " + chart_symbol + " Period: " + EnumToString(chart_period));
            
            if(chart_symbol == Symbol() && chart_period == Period())
            {
               marker_found = true;
               DebugPrint("Indicator marker found on matching chart: " + IntegerToString(chart_id));
               break;
            }
         }
         chart_id = ChartNext(chart_id);
      }
   }
   
   // Method 4: Alternative detection via signal activity
   if(!marker_found)
   {
      string comment = ChartGetString(0, CHART_COMMENT);
      if(StringFind(comment, "XAUUSD M10 Keltner") >= 0 || 
         StringFind(comment, "KB") >= 0 || 
         StringFind(comment, "Keltner") >= 0)
      {
         marker_found = true;
         DebugPrint("Indicator detected via signal activity in comment");
      }
   }
   
   // Handle detection results with recovery logic
   if(marker_found)
   {
      // Reset failure tracking on successful detection
      if(g_consecutive_detection_failures > 0)
      {
         Print("=== INDICATOR DETECTION RECOVERED ===");
         Print("Previous failures: ", g_consecutive_detection_failures);
         Print("System fully operational again");
      }
      
      g_consecutive_detection_failures = 0;
      g_last_successful_detection = current_time;
      g_detection_recovery_mode = false;
      
      return true;
   }
   else
   {
      // Handle detection failure with smart recovery
      g_consecutive_detection_failures++;
      
      // If we recently had successful detection, assume temporary reinitialization
      bool recently_detected = (g_last_successful_detection > 0 && 
                               (current_time - g_last_successful_detection) < 300); // 5 minutes
      
      if(recently_detected && g_consecutive_detection_failures < 20) // Allow 20 failures over ~10 minutes
      {
         if(!g_detection_recovery_mode)
         {
            g_detection_recovery_mode = true;
            Print("=== TEMPORARY DETECTION LOSS DETECTED ===");
            Print("Likely cause: Indicator parameter reconfiguration");
            Print("System will continue operating and retry detection");
         }
         
         // Print progress every 5 failures
         if(g_consecutive_detection_failures % 5 == 0)
         {
            Print("Detection retry attempt: ", g_consecutive_detection_failures, "/20");
            Print("Elapsed since last detection: ", (current_time - g_last_successful_detection), " seconds");
         }
         
         return true; // Keep system enabled during recovery period
      }
      
      // Only fail after sustained detection loss
      if(g_consecutive_detection_failures >= 20)
      {
         // Show error message only once every 2 minutes to avoid spam
         static datetime last_error_time = 0;
         if(current_time - last_error_time >= 120)
         {
            last_error_time = current_time;
            g_error_message = "ERROR: Sustained indicator detection failure. Please check if Keltner 10-Band Indicator is loaded.";
            Print(g_error_message);
         }
         return false;
      }
      
      return true; // Continue retrying during initial failure period
   }
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
      if(ObjectFind(chart_id, "KeltnerBandIndicatorMarker") >= 0)
      {
         chart_count++;
         if(chart_count > 1)
         {
            g_error_message = "ERROR: Keltner 10-Band Indicator detected on multiple charts. Please use only ONE chart with this system.";
            return false;
         }
      }
      chart_id = ChartNext(chart_id);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| FIXED: GetNetVolume - Remove automatic UpdateInfoDisplay call    |
//+------------------------------------------------------------------+
double GetNetVolume()
{
   double buyVolume = 0.0;
   double sellVolume = 0.0;
   int currentPositionCount = 0;
   
   // Force refresh of position data
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) 
      {
         DebugPrint("Warning: Invalid position ticket at index " + IntegerToString(i));
         continue;
      }
      
      // Force fresh position selection to avoid cached data
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         if(symbol == _Symbol)
         {
            double volume = PositionGetDouble(POSITION_VOLUME);
            long magic = PositionGetInteger(POSITION_MAGIC);
            
            if(magic == EA_MAGIC_NUMBER) // Only count EA positions for net calculation
            {
               currentPositionCount++;
               
               if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                  buyVolume += volume;
               else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
                  sellVolume += volume;
            }
         }
      }
   }
   
   double netVolume = buyVolume - sellVolume;
   double absoluteVolume = MathAbs(netVolume);
   
   // Detect position changes and SET FLAG for display update (don't call directly)
   if(currentPositionCount != g_last_position_count || 
      MathAbs(absoluteVolume - g_last_calculated_exposure) > 0.001)
   {
      Print("=== EA POSITION CHANGE DETECTED ===");
      Print("EA Position Count: ", g_last_position_count, " -> ", currentPositionCount);
      Print("EA Net Volume: ", DoubleToString(netVolume, 3));
      Print("EA Buy Volume: ", DoubleToString(buyVolume, 3), " | EA Sell Volume: ", DoubleToString(sellVolume, 3));
      
      g_last_position_count = currentPositionCount;
      g_force_display_update = true;  // FIXED: Just set flag, don't call function
      
      // REMOVED: UpdateInfoDisplay(); // This was causing infinite recursion!
   }
   
   g_last_position_check = TimeCurrent();
   
   DebugPrint("EA Net Volume: Buy=" + DoubleToString(buyVolume, 3) + 
             ", Sell=" + DoubleToString(sellVolume, 3) + 
             ", Net=" + DoubleToString(netVolume, 3) + 
             ", Positions=" + IntegerToString(currentPositionCount));
   
   return netVolume;
}

//+------------------------------------------------------------------+
//| Validate one side trade position restriction                     |
//+------------------------------------------------------------------+
bool ValidateOneSideTradePosition(ENUM_TRENDLINE_MODE mode)
{
   if(OneSideTradeMode == ONE_SIDE_DISABLED)
   {
      DebugPrint("One Side Trade Position: DISABLED - All directions allowed");
      return true;
   }
   
   string modeStr = (mode == MODE_BUY) ? "BUY" : "SELL";
   string restrictionStr = (OneSideTradeMode == ONE_SIDE_BUY_ONLY) ? "BUY ONLY - Uptrend" : "SELL ONLY - Downtrend";
   
   bool isAllowed = false;
   
   switch(OneSideTradeMode)
   {
      case ONE_SIDE_BUY_ONLY:
         isAllowed = (mode == MODE_BUY);
         break;
      case ONE_SIDE_SELL_ONLY:
         isAllowed = (mode == MODE_SELL);
         break;
      default:
         isAllowed = true;
         break;
   }
   
   if(isAllowed)
   {
      Print("VALIDATION RESULT: APPROVED - Order direction (", modeStr, ") matches restriction (", restrictionStr, ")");
   }
   else
   {
      Print("VALIDATION RESULT: REJECTED - Order direction (", modeStr, ") conflicts with restriction (", restrictionStr, ")");
      string rejectionReason = (OneSideTradeMode == ONE_SIDE_BUY_ONLY && mode == MODE_SELL) ? 
                              "SELL orders blocked when 'Buy Only - Uptrend' is active" : 
                              "BUY orders blocked when 'Sell Only - Downtrend' is active";
      Alert("XAUUSD Keltner 10-Band EA: " + rejectionReason);
   }
   
   return isAllowed;
}

//+------------------------------------------------------------------+
//| ENHANCED: Two-Tier exposure validation logic                     |
//+------------------------------------------------------------------+
bool ValidateExposureLimit(ENUM_TRENDLINE_MODE mode, double volume)
{
   if(!EnableExposureLimit)
   {
      DebugPrint("Exposure limit checking is disabled");
      return true;
   }
   
   if(MaxExposureLimit <= 0)
   {
      DebugPrint("Invalid maximum exposure limit: " + DoubleToString(MaxExposureLimit, 2));
      return false;
   }
   
   Print("=== TWO-TIER NET EXPOSURE VALIDATION ===");
   Print("Max Limit: ", DoubleToString(MaxExposureLimit, 3), " | Request: ", DoubleToString(volume, 3), " lots (", (mode == MODE_BUY ? "BUY" : "SELL"), ")");
   
   // Calculate current NET exposure from ALL positions
   double buyVolume = 0.0;
   double sellVolume = 0.0;
   
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         if(symbol == _Symbol)
         {
            double pos_volume = PositionGetDouble(POSITION_VOLUME);
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
               buyVolume += pos_volume;
            else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
               sellVolume += pos_volume;
         }
      }
   }
   
   // Add pending limits if configured
   if(CountPendingInExposure)
   {
      double pendingVolume = GetPendingLimitVolume();
      Print("Pending limit orders: ", pendingVolume, " lots");
      
      // Add pending to both sides (conservative approach)
      buyVolume += pendingVolume / 2.0;
      sellVolume += pendingVolume / 2.0;
   }
   
   double currentNetExposure = buyVolume - sellVolume;
   double currentAbsoluteNetExposure = MathAbs(currentNetExposure);
   
   // Calculate new net exposure after proposed order
   double newNetExposure;
   if(mode == MODE_BUY)
      newNetExposure = currentNetExposure + volume;  // Add to net (more long)
   else
      newNetExposure = currentNetExposure - volume;  // Subtract from net (more short)
   
   double newAbsoluteNetExposure = MathAbs(newNetExposure);
   double safeLimit = MaxExposureLimit;
   
   // Enhanced logging for debugging
   Print("CURRENT NET EXPOSURE STATUS:");
   Print("  - Current Buy Volume: ", DoubleToString(buyVolume, 3), " lots");
   Print("  - Current Sell Volume: ", DoubleToString(sellVolume, 3), " lots");
   Print("  - Current Net Exposure: ", DoubleToString(currentNetExposure, 3), " lots");
   Print("  - Current Absolute Net: ", DoubleToString(currentAbsoluteNetExposure, 3), " lots");
   Print("  - Maximum Limit: ", DoubleToString(safeLimit, 3), " lots");
   Print("  - New Order: ", DoubleToString(volume, 3), " lots ", (mode == MODE_BUY ? "BUY" : "SELL"));
   Print("  - Resulting Net Exposure: ", DoubleToString(newNetExposure, 3), " lots");
   Print("  - Resulting Absolute Net: ", DoubleToString(newAbsoluteNetExposure, 3), " lots");
   
   // ***** TWO-TIER LOGIC IMPLEMENTATION *****
   
   bool withinLimit = false;
   string validationMode = "";
   
   if(currentAbsoluteNetExposure <= safeLimit)
   {
      // **TIER 1: NORMAL OPERATION** - Current exposure is within limit
      validationMode = "NORMAL OPERATION";
      withinLimit = (newAbsoluteNetExposure <= safeLimit);
      
      Print("=== TIER 1: NORMAL OPERATION ===");
      Print("Current exposure (", DoubleToString(currentAbsoluteNetExposure, 3), ") is within limit (", DoubleToString(safeLimit, 3), ")");
      Print("Applying standard validation: New exposure must be <= limit");
   }
   else
   {
      // **TIER 2: RECOVERY MODE** - Current exposure exceeds limit
      validationMode = "RECOVERY MODE";
      bool reducesExposure = (newAbsoluteNetExposure < currentAbsoluteNetExposure);
      
      Print("=== TIER 2: RECOVERY MODE ===");
      Print("Current exposure (", DoubleToString(currentAbsoluteNetExposure, 3), ") EXCEEDS limit (", DoubleToString(safeLimit, 3), ")");
      Print("Over-limit by: ", DoubleToString(currentAbsoluteNetExposure - safeLimit, 3), " lots");
      
      if(reducesExposure)
      {
         withinLimit = true; // Approve orders that reduce exposure
         Print("Order REDUCES exposure by: ", DoubleToString(currentAbsoluteNetExposure - newAbsoluteNetExposure, 3), " lots");
         Print("Recovery logic: APPROVED (moves toward limit)");
      }
      else
      {
         withinLimit = false; // Reject orders that increase exposure further
         Print("Order INCREASES exposure by: ", DoubleToString(newAbsoluteNetExposure - currentAbsoluteNetExposure, 3), " lots");
         Print("Recovery logic: REJECTED (moves away from limit)");
      }
   }
   
   // Show EA net position for reference
   double eaNetVolume = GetNetVolume();
   Print("  - EA Net Position: ", DoubleToString(eaNetVolume, 3), " lots");
   
   if(withinLimit)
   {
      Print("FINAL RESULT: APPROVED (", validationMode, ")");
      if(StringFind(validationMode, "NORMAL") >= 0)
      {
         Print("Remaining capacity after order: ", DoubleToString(safeLimit - newAbsoluteNetExposure, 3), " lots");
      }
      else
      {
         Print("Still over-limit after order, but moving in right direction");
         Print("Will be over-limit by: ", DoubleToString(newAbsoluteNetExposure - safeLimit, 3), " lots (reduced from ", DoubleToString(currentAbsoluteNetExposure - safeLimit, 3), ")");
      }
   }
   else
   {
      Print("FINAL RESULT: REJECTED (", validationMode, ")");
      
      if(StringFind(validationMode, "NORMAL") >= 0)
      {
         Print("Would exceed limit by: ", DoubleToString(newAbsoluteNetExposure - safeLimit, 3), " lots");
         Print("Available capacity: ", DoubleToString(safeLimit - currentAbsoluteNetExposure, 3), " lots");
      }
      else
      {
         Print("Would increase over-limit exposure from ", DoubleToString(currentAbsoluteNetExposure - safeLimit, 3), 
               " to ", DoubleToString(newAbsoluteNetExposure - safeLimit, 3), " lots");
      }
      
      Print("SUGGESTION:");
      if(StringFind(validationMode, "RECOVERY") >= 0)
      {
         Print("  - Try ", (mode == MODE_BUY ? "SELL" : "BUY"), " orders to reduce exposure");
         Print("  - Or close existing positions manually");
      }
      else
      {
         Print("  - Reduce order size or close positions to free capacity");
      }
      
      Alert("XAUUSD Keltner 10-Band EA: Order rejected - " + validationMode);
   }
   
   // Force display update after validation
   g_force_display_update = true;
   
   return withinLimit;
}

//+------------------------------------------------------------------+
//| Enhanced Order Placement (KEEP - Proven retry logic)            |
//+------------------------------------------------------------------+
bool PlaceBuyMarketOrder(double volume)
{
   for(int attempt = 0; attempt < MaxRetries; attempt++)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      
      ResetLastError();
      bool order_result = trade.Buy(volume, _Symbol);
      int error_code = GetLastError();
      
      if(order_result)
      {
         Print("SUCCESS: Buy order placed - Ticket: ", trade.ResultOrder(), " | Price: ", trade.ResultPrice(), " | Volume: ", volume);
         return true;
      }
      else
      {
         Print("FAILED: Buy order attempt ", attempt + 1, "/", MaxRetries, " | Error: ", error_code, " | ", trade.ResultRetcodeDescription());
         if(attempt < MaxRetries - 1)
            Sleep(RetryDelay);
      }
   }
   
   Print("CRITICAL: All buy order attempts failed");
   return false;
}

//+------------------------------------------------------------------+
//| Enhanced Sell Order Placement (KEEP - Proven retry logic)       |
//+------------------------------------------------------------------+
bool PlaceSellMarketOrder(double volume)
{
   for(int attempt = 0; attempt < MaxRetries; attempt++)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      
      ResetLastError();
      bool order_result = trade.Sell(volume, _Symbol);
      int error_code = GetLastError();
      
      if(order_result)
      {
         Print("SUCCESS: Sell order placed - Ticket: ", trade.ResultOrder(), " | Price: ", trade.ResultPrice(), " | Volume: ", volume);
         return true;
      }
      else
      {
         Print("FAILED: Sell order attempt ", attempt + 1, "/", MaxRetries, " | Error: ", error_code, " | ", trade.ResultRetcodeDescription());
         if(attempt < MaxRetries - 1)
            Sleep(RetryDelay);
      }
   }
   
   Print("CRITICAL: All sell order attempts failed");
   return false;
}

//+------------------------------------------------------------------+
//| Parse signal data from comment - KELTNER 10-BAND FORMAT         |
//+------------------------------------------------------------------+
bool ParseSignalData(string signalStr, SignalData &signal)
{
   string parts[];
   int count = StringSplit(signalStr, '|', parts);
   
   if(count != 5)
   {
      DebugPrint("Invalid signal format: " + signalStr);
      return false;
   }
   
   if(StringSubstr(parts[0], 0, 2) != "TL")
{
   DebugPrint("Invalid trendline ID: " + parts[0]);
   return false;
}

string tlNumStr = StringSubstr(parts[0], 2);
signal.trendline_id = (int)StringToInteger(tlNumStr);

if(signal.trendline_id < 1 || signal.trendline_id > MAX_TRENDLINES)
{
   DebugPrint(StringFormat("Trendline ID out of range: %d", signal.trendline_id));
   return false;
}
   
   string mode = parts[1];
   if(mode == "Sell")
      signal.mode = MODE_SELL;
   else if(mode == "Buy")
      signal.mode = MODE_BUY;
   else
   {
      DebugPrint("Unknown mode: " + mode);
      return false;
   }
   
   signal.lot_size = StringToDouble(parts[2]);
   signal.touch_price = StringToDouble(parts[3]);
   signal.timestamp = (datetime)StringToInteger(parts[4]);
   
   if(signal.lot_size <= 0 || signal.touch_price <= 0)
   {
      DebugPrint("Invalid signal values detected");
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| MODIFIED: Execute market order - calls multi-layer logic         |
//+------------------------------------------------------------------+
bool ExecuteMarketOrder(const SignalData &signal)
{
   Print("=== ORDER EXECUTION START ===");
   
   if(!g_trading_enabled || !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return false;
   
   if(!ValidateOneSideTradePosition(signal.mode))
      return false;
   
   if(!ValidateExposureLimit(signal.mode, signal.lot_size))
      return false;
   
   bool result = ExecuteMultiLayerOrder(signal);
   
   if(result)
   {
      Sleep(500);
      g_force_display_update = true;
      UpdateInfoDisplay();
   }
   
   return result;
}

//+------------------------------------------------------------------+
//| MODIFIED: Print portfolio status using NET exposure              |
//+------------------------------------------------------------------+
void PrintPortfolioStatus()
{
   double netExposure = GetTotalNetExposure();
   double eaNet = GetNetVolume();
   double remainingCapacity = MaxExposureLimit - netExposure;
   string eaDirection = (eaNet > 0) ? "NET LONG" : (eaNet < 0) ? "NET SHORT" : "FLAT";
   
   Print("=== PORTFOLIO STATUS ===");
   Print("NET Exposure: ", DoubleToString(netExposure, 3), " lots | Limit: ", DoubleToString(MaxExposureLimit, 3), " | Available: ", DoubleToString(remainingCapacity, 3));
   Print("EA Net Position: ", DoubleToString(MathAbs(eaNet), 3), " lots ", eaDirection);
   
   UpdateInfoDisplay();
}

//+------------------------------------------------------------------+
//| Create 12-object table display (KEEP - Working display system)  |
//+------------------------------------------------------------------+
void CreateInfoDisplay()
{
   CleanupInfoDisplay();
   
   string labels[] = {"Limit", "Exposure", "Available", "Restriction"};
   string spacers[] = {":", ":", ":", ":"};
   
   for(int i = 0; i < ArraySize(labels); i++)
   {
      int y_from_bottom = g_display_bottom_margin + ((ArraySize(labels) - 1 - i) * g_display_y_step);
      
      // Column 1: Label objects
      string label_name = g_ea_object_prefix + "Label_" + IntegerToString(i);
      if(ObjectCreate(0, label_name, OBJ_LABEL, 0, 0, 0))
      {
         ObjectSetInteger(0, label_name, OBJPROP_CORNER, CORNER_LEFT_LOWER);
         ObjectSetInteger(0, label_name, OBJPROP_XDISTANCE, g_display_col1_x);
         ObjectSetInteger(0, label_name, OBJPROP_YDISTANCE, y_from_bottom);
         ObjectSetString(0, label_name, OBJPROP_TEXT, labels[i]);
         ObjectSetString(0, label_name, OBJPROP_FONT, "Consolas");
         ObjectSetInteger(0, label_name, OBJPROP_FONTSIZE, g_display_font_size);
         ObjectSetInteger(0, label_name, OBJPROP_COLOR, clrBlack);
         ObjectSetInteger(0, label_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, label_name, OBJPROP_HIDDEN, true);
      }
      
      // Column 2: Spacer objects
      string spacer_name = g_ea_object_prefix + "Spacer_" + IntegerToString(i);
      if(ObjectCreate(0, spacer_name, OBJ_LABEL, 0, 0, 0))
      {
         ObjectSetInteger(0, spacer_name, OBJPROP_CORNER, CORNER_LEFT_LOWER);
         ObjectSetInteger(0, spacer_name, OBJPROP_XDISTANCE, g_display_col2_x);
         ObjectSetInteger(0, spacer_name, OBJPROP_YDISTANCE, y_from_bottom);
         ObjectSetString(0, spacer_name, OBJPROP_TEXT, spacers[i]);
         ObjectSetString(0, spacer_name, OBJPROP_FONT, "Consolas");
         ObjectSetInteger(0, spacer_name, OBJPROP_FONTSIZE, g_display_font_size);
         ObjectSetInteger(0, spacer_name, OBJPROP_COLOR, clrBlack);
         ObjectSetInteger(0, spacer_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, spacer_name, OBJPROP_HIDDEN, true);
      }
      
      // Column 3: Value objects
      string value_name = g_ea_object_prefix + "Value_" + IntegerToString(i);
      if(ObjectCreate(0, value_name, OBJ_LABEL, 0, 0, 0))
      {
         ObjectSetInteger(0, value_name, OBJPROP_CORNER, CORNER_LEFT_LOWER);
         ObjectSetInteger(0, value_name, OBJPROP_XDISTANCE, g_display_col3_x);
         ObjectSetInteger(0, value_name, OBJPROP_YDISTANCE, y_from_bottom);
         ObjectSetString(0, value_name, OBJPROP_TEXT, "Loading...");
         ObjectSetString(0, value_name, OBJPROP_FONT, "Consolas");
         ObjectSetInteger(0, value_name, OBJPROP_FONTSIZE, g_display_font_size);
         ObjectSetInteger(0, value_name, OBJPROP_COLOR, clrBlue);
         ObjectSetInteger(0, value_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, value_name, OBJPROP_HIDDEN, true);
      }
   }
   
   ChartRedraw(0);
   DebugPrint("Information display created successfully");
}

//+------------------------------------------------------------------+
//| MODIFIED: UpdateInfoDisplay using NET exposure                   |
//+------------------------------------------------------------------+
void UpdateInfoDisplay()
{
   // Check if display exists, create if needed
   string test_object = g_ea_object_prefix + "Label_0";
   if(ObjectFind(0, test_object) < 0)
   {
      CreateInfoDisplay();
      Sleep(500); // Allow creation time
      return;
   }
   
   // Get NET exposure (ALL positions) - CRITICAL CHANGE
   double netExposure = GetTotalNetExposure();
   
   // Calculate EA net volume directly here to avoid recursion
   double eaNetBuy = 0.0, eaNetSell = 0.0;
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         if(symbol == _Symbol)
         {
            long magic = PositionGetInteger(POSITION_MAGIC);
            if(magic == EA_MAGIC_NUMBER)
            {
               double volume = PositionGetDouble(POSITION_VOLUME);
               if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                  eaNetBuy += volume;
               else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
                  eaNetSell += volume;
            }
         }
      }
   }
   
   double eaNet = eaNetBuy - eaNetSell;
   
   // Prepare display values
   string display_values[4];
   
   // Format exposure limit
   display_values[0] = (EnableExposureLimit && MaxExposureLimit > 0) ? 
                      DoubleToString(MaxExposureLimit, 3) : "No Limit";
   
   // Format NET exposure (ALL positions) - CRITICAL CHANGE
   display_values[1] = DoubleToString(netExposure, 3);
   
   // Calculate available exposure based on NET exposure
   if(EnableExposureLimit && MaxExposureLimit > 0)
   {
      double available = MaxExposureLimit - netExposure;
      display_values[2] = DoubleToString(MathMax(available, 0), 3);
   }
   else
   {
      display_values[2] = "Unlimited";
   }
   
   // Show emergency stop status or restriction
   if(g_emergency_stop_active)
   {
      display_values[3] = "EMERGENCY STOP";
   }
   else
   {
      switch(OneSideTradeMode)
      {
         case ONE_SIDE_BUY_ONLY: display_values[3] = "Buy Only"; break;
         case ONE_SIDE_SELL_ONLY: display_values[3] = "Sell Only"; break;
         default: display_values[3] = "No Restriction"; break;
      }
   }
   
   // Update each value object
   bool updateSuccess = true;
   for(int i = 0; i < 4; i++)
   {
      string value_name = g_ea_object_prefix + "Value_" + IntegerToString(i);
      if(ObjectFind(0, value_name) >= 0)
      {
         if(!ObjectSetString(0, value_name, OBJPROP_TEXT, display_values[i]))
         {
            Print("ERROR: Failed to update display object: ", value_name);
            updateSuccess = false;
         }
         
         // Set colors based on content
         color text_color = clrBlue;
         if(i == 0 && display_values[i] == "No Limit") text_color = clrOrange;
         if(i == 2 && display_values[i] == "Unlimited") text_color = clrGreen;
         if(i == 3 && display_values[i] == "EMERGENCY STOP") text_color = clrRed;
         else if(i == 3 && display_values[i] != "No Restriction") text_color = clrRed;
         
         ObjectSetInteger(0, value_name, OBJPROP_COLOR, text_color);
      }
      else
      {
         Print("WARNING: Display object not found: ", value_name);
         updateSuccess = false;
      }
   }
   
   // Force chart redraw
   ChartRedraw(0);
   
   // Log update for debugging
   if(g_force_display_update || !updateSuccess)
   {
      Print("=== DISPLAY UPDATE ===");
      Print("Limit: ", display_values[0], " | Net Exposure: ", display_values[1], 
            " | Available: ", display_values[2], " | Status: ", display_values[3]);
      Print("EA Net Position: ", DoubleToString(eaNet, 3), " lots");
      Print("Emergency Stop: ", g_emergency_stop_active ? "ACTIVE" : "INACTIVE");
      Print("Update Success: ", updateSuccess ? "YES" : "NO");
      g_force_display_update = false;
   }
}

//+------------------------------------------------------------------+
//| Clean up EA display objects (KEEP - Proven cleanup system)      |
//+------------------------------------------------------------------+
void CleanupInfoDisplay()
{
   // Method 1: Delete specific EA objects by name pattern
   for(int i = 0; i < 10; i++)
   {
      ObjectDelete(0, g_ea_object_prefix + "Label_" + IntegerToString(i));
      ObjectDelete(0, g_ea_object_prefix + "Spacer_" + IntegerToString(i));
      ObjectDelete(0, g_ea_object_prefix + "Value_" + IntegerToString(i));
   }
   
   // Method 2: Clean any remaining EA objects
   int total_objects = ObjectsTotal(0, -1, -1);
   for(int i = total_objects - 1; i >= 0; i--)
   {
      string obj_name = ObjectName(0, i, -1, -1);
      if(StringFind(obj_name, g_ea_object_prefix) == 0)
         ObjectDelete(0, obj_name);
   }
   
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Update Pekali based on symbol digits                             |
//+------------------------------------------------------------------+
void UpdatePekali()
{
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   switch(digits)
   {
      case 2: g_Pekali = 100; break;
      case 3: g_Pekali = 1000; break;
      case 4: g_Pekali = 10000; break;
      case 5: g_Pekali = 100000; break;
      default: g_Pekali = 1;
   }
}

//+------------------------------------------------------------------+
//| Get multi-layer configuration for trendline                      |
//+------------------------------------------------------------------+
MultiLayerConfig GetMultiLayerConfig(int tlId)
{
   MultiLayerConfig config;
   
   config.marketPercent = GlobalMarketPercent;
   config.numberOfLayers = GlobalNumberOfLayers;
   config.firstOffset = GlobalFirstLayerOffset;
   config.layerSpacing = GlobalLayerSpacing;
   
   switch(tlId)
   {
      case 1:
         if(TL1_MarketPercent > 0) config.marketPercent = TL1_MarketPercent;
         if(TL1_NumberOfLayers > 0) config.numberOfLayers = TL1_NumberOfLayers;
         if(TL1_FirstOffset > 0) config.firstOffset = TL1_FirstOffset;
         if(TL1_LayerSpacing > 0) config.layerSpacing = TL1_LayerSpacing;
         break;
      case 2:
         if(TL2_MarketPercent > 0) config.marketPercent = TL2_MarketPercent;
         if(TL2_NumberOfLayers > 0) config.numberOfLayers = TL2_NumberOfLayers;
         if(TL2_FirstOffset > 0) config.firstOffset = TL2_FirstOffset;
         if(TL2_LayerSpacing > 0) config.layerSpacing = TL2_LayerSpacing;
         break;
      case 3:
         if(TL3_MarketPercent > 0) config.marketPercent = TL3_MarketPercent;
         if(TL3_NumberOfLayers > 0) config.numberOfLayers = TL3_NumberOfLayers;
         if(TL3_FirstOffset > 0) config.firstOffset = TL3_FirstOffset;
         if(TL3_LayerSpacing > 0) config.layerSpacing = TL3_LayerSpacing;
         break;
      case 4:
         if(TL4_MarketPercent > 0) config.marketPercent = TL4_MarketPercent;
         if(TL4_NumberOfLayers > 0) config.numberOfLayers = TL4_NumberOfLayers;
         if(TL4_FirstOffset > 0) config.firstOffset = TL4_FirstOffset;
         if(TL4_LayerSpacing > 0) config.layerSpacing = TL4_LayerSpacing;
         break;
      case 5:
         if(TL5_MarketPercent > 0) config.marketPercent = TL5_MarketPercent;
         if(TL5_NumberOfLayers > 0) config.numberOfLayers = TL5_NumberOfLayers;
         if(TL5_FirstOffset > 0) config.firstOffset = TL5_FirstOffset;
         if(TL5_LayerSpacing > 0) config.layerSpacing = TL5_LayerSpacing;
         break;
      case 6:
         if(TL6_MarketPercent > 0) config.marketPercent = TL6_MarketPercent;
         if(TL6_NumberOfLayers > 0) config.numberOfLayers = TL6_NumberOfLayers;
         if(TL6_FirstOffset > 0) config.firstOffset = TL6_FirstOffset;
         if(TL6_LayerSpacing > 0) config.layerSpacing = TL6_LayerSpacing;
         break;
   }
   
   config.marketPercent = MathMax(0, MathMin(100, config.marketPercent));
   config.numberOfLayers = MathMax(1, MathMin(MAX_LAYERS_PER_TL, config.numberOfLayers));
   config.firstOffset = MathMax(0, config.firstOffset);
   config.layerSpacing = MathMax(0, config.layerSpacing);
   
   return config;
}

//+------------------------------------------------------------------+
//| Distribute lot size across layers with proper rounding           |
//+------------------------------------------------------------------+
void DistributeLotSizes(double totalSize, int layers, double &sizes[])
{
   ArrayResize(sizes, layers);
   
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   
   double rawSizePerLayer = totalSize / layers;
   double baseSizePerLayer = MathFloor(rawSizePerLayer / lotStep) * lotStep;
   
   double totalAllocated = baseSizePerLayer * layers;
   double remainder = totalSize - totalAllocated;
   
   for(int i = 0; i < layers; i++)
   {
      sizes[i] = baseSizePerLayer;
   }
   
   int layer = 0;
   while(remainder >= lotStep && layer < layers)
   {
      sizes[layer] += lotStep;
      remainder -= lotStep;
      layer++;
   }
   
   for(int i = 0; i < layers; i++)
   {
      if(sizes[i] < minLot)
         sizes[i] = 0;
   }
}

//+------------------------------------------------------------------+
//| Round price for buy limit (round down)                           |
//+------------------------------------------------------------------+
double RoundPriceForBuy(double price)
{
   return MathFloor(price * g_Pekali) / g_Pekali;
}

//+------------------------------------------------------------------+
//| Round price for sell limit (round up)                            |
//+------------------------------------------------------------------+
double RoundPriceForSell(double price)
{
   return MathCeil(price * g_Pekali) / g_Pekali;
}

//+------------------------------------------------------------------+
//| Add pending limit to tracking                                    |
//+------------------------------------------------------------------+
void AddPendingLimit(ulong ticket, int tlId, double size)
{
   if(g_pendingLimitCount < ArraySize(g_pendingLimits))
   {
      g_pendingLimits[g_pendingLimitCount].ticket = ticket;
      g_pendingLimits[g_pendingLimitCount].tlId = tlId;
      g_pendingLimits[g_pendingLimitCount].size = size;
      g_pendingLimits[g_pendingLimitCount].placedTime = TimeCurrent();
      g_pendingLimitCount++;
   }
}

//+------------------------------------------------------------------+
//| Get total pending limit volume                                   |
//+------------------------------------------------------------------+
double GetPendingLimitVolume()
{
   double totalPending = 0;
   
   for(int i = g_pendingLimitCount - 1; i >= 0; i--)
   {
      if(OrderSelect(g_pendingLimits[i].ticket))
      {
         if(OrderGetInteger(ORDER_STATE) == ORDER_STATE_FILLED ||
            OrderGetInteger(ORDER_STATE) == ORDER_STATE_CANCELED)
         {
            for(int j = i; j < g_pendingLimitCount - 1; j++)
            {
               g_pendingLimits[j] = g_pendingLimits[j + 1];
            }
            g_pendingLimitCount--;
         }
         else
         {
            totalPending += g_pendingLimits[i].size;
         }
      }
   }
   
   return totalPending;
}

//+------------------------------------------------------------------+
//| Place Buy Limit with ticket return                               |
//+------------------------------------------------------------------+
ulong PlaceBuyLimitOrderWithTicket(double volume, double price)
{
   for(int attempt = 0; attempt < MaxRetries; attempt++)
   {
      ResetLastError();
      if(trade.BuyLimit(volume, price, _Symbol))
      {
         return trade.ResultOrder();
      }
      else
      {
         Print("Buy limit attempt ", attempt + 1, " failed. Error: ", GetLastError());
         if(attempt < MaxRetries - 1)
            Sleep(RetryDelay);
      }
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Place Sell Limit with ticket return                              |
//+------------------------------------------------------------------+
ulong PlaceSellLimitOrderWithTicket(double volume, double price)
{
   for(int attempt = 0; attempt < MaxRetries; attempt++)
   {
      ResetLastError();
      if(trade.SellLimit(volume, price, _Symbol))
      {
         return trade.ResultOrder();
      }
      else
      {
         Print("Sell limit attempt ", attempt + 1, " failed. Error: ", GetLastError());
         if(attempt < MaxRetries - 1)
            Sleep(RetryDelay);
      }
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Execute multi-layer order                                        |
//+------------------------------------------------------------------+
bool ExecuteMultiLayerOrder(const SignalData &signal)
{
   Print("=== MULTI-LAYER EXECUTION START ===");
   Print("TL", signal.trendline_id, " | Total: ", signal.lot_size, " | Touch: ", signal.touch_price);
   
   if(!EnableMultiLayer)
   {
      Print("Multi-layer disabled - market only");
      if(signal.mode == MODE_BUY)
         return PlaceBuyMarketOrder(signal.lot_size);
      else if(signal.mode == MODE_SELL)
         return PlaceSellMarketOrder(signal.lot_size);
      return false;
   }
   
   MultiLayerConfig config = GetMultiLayerConfig(signal.trendline_id);
   
   Print("Config: Market=", config.marketPercent, "% Layers=", config.numberOfLayers, 
         " Offset=", config.firstOffset, " Spacing=", config.layerSpacing);
   
   double marketSize = signal.lot_size * (config.marketPercent / 100.0);
   double totalLimitSize = signal.lot_size - marketSize;
   
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   marketSize = MathFloor(marketSize / lotStep) * lotStep;
   if(marketSize < minLot) marketSize = 0;
   
   totalLimitSize = signal.lot_size - marketSize;
   
   Print("Market: ", marketSize, " | Limits: ", totalLimitSize);
   
   double layerSizes[];
   DistributeLotSizes(totalLimitSize, config.numberOfLayers, layerSizes);
   
   Print("Distribution:");
   for(int i = 0; i < config.numberOfLayers; i++)
      Print("  Layer ", i+1, ": ", layerSizes[i]);
   
   bool success = true;
   
   if(marketSize > 0)
   {
      bool marketResult = false;
      if(signal.mode == MODE_BUY)
         marketResult = PlaceBuyMarketOrder(marketSize);
      else if(signal.mode == MODE_SELL)
         marketResult = PlaceSellMarketOrder(marketSize);
      
      if(!marketResult)
      {
         Print("WARNING: Market order failed");
         success = false;
      }
   }
   
   for(int i = 0; i < config.numberOfLayers; i++)
   {
      if(layerSizes[i] < minLot)
      {
         Print("Skip layer ", i+1, " - too small");
         continue;
      }
      
      double offset = config.firstOffset + (config.layerSpacing * i);
      double limitPrice;
      
      if(signal.mode == MODE_BUY)
      {
         limitPrice = signal.touch_price - (offset * Point());
         limitPrice = RoundPriceForBuy(limitPrice);
         
         Print("Buy Limit ", i+1, ": ", layerSizes[i], " @ ", limitPrice);
         
         ulong ticket = PlaceBuyLimitOrderWithTicket(layerSizes[i], limitPrice);
         if(ticket > 0)
            AddPendingLimit(ticket, signal.trendline_id, layerSizes[i]);
         else
            success = false;
      }
      else if(signal.mode == MODE_SELL)
      {
         limitPrice = signal.touch_price + (offset * Point());
         limitPrice = RoundPriceForSell(limitPrice);
         
         Print("Sell Limit ", i+1, ": ", layerSizes[i], " @ ", limitPrice);
         
         ulong ticket = PlaceSellLimitOrderWithTicket(layerSizes[i], limitPrice);
         if(ticket > 0)
            AddPendingLimit(ticket, signal.trendline_id, layerSizes[i]);
         else
            success = false;
      }
   }
   
   Print("=== MULTI-LAYER COMPLETE: ", success ? "SUCCESS" : "PARTIAL ===");
   return success;
}

//+------------------------------------------------------------------+
//| Enhanced OnInit with robust initialization and retry logic      |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("========================================");
   Print("XAUUSD M10 KELTNER TRENDLINE EA STARTING");
   Print("VERSION 9.10 - WITH HEARTBEAT COMMUNICATION");
   Print("========================================");
   
   g_chart_id = ChartID();
   
   // NEW: Initialize EA heartbeat
   g_ea_heartbeat_var = "EA_Heartbeat_" + IntegerToString(g_chart_id);
   
   // NEW: Clear any pending signals from previous session
   string signalVar = "TrendLineSignal_" + IntegerToString(g_chart_id);
   if(GlobalVariableCheck(signalVar))
   {
      GlobalVariableSet(signalVar, 0);
      Print("Cleared any pending signals from previous session");
   }
   Comment("");
   
   // NEW: Set initial heartbeat
   GlobalVariableSet(g_ea_heartbeat_var, (double)TimeCurrent());
   Print("EA Heartbeat system initialized: ", g_ea_heartbeat_var);
   
   UpdatePekali();
   
   Print("Multi-Layer Configuration:");
   Print("  Enabled: ", EnableMultiLayer ? "YES" : "NO");
   Print("  Global Market%: ", GlobalMarketPercent);
   Print("  Global Layers: ", GlobalNumberOfLayers);
   Print("  First Offset: ", GlobalFirstLayerOffset);
   Print("  Layer Spacing: ", GlobalLayerSpacing);
   Print("  Count Pending: ", CountPendingInExposure ? "YES" : "NO");
   
   // Validate market percent values are reasonable
   if(GlobalMarketPercent > 0 && GlobalMarketPercent < 1)
   {
      Print("WARNING: GlobalMarketPercent = ", GlobalMarketPercent);
      Print("Did you mean ", GlobalMarketPercent * 100, "%? Enter ", GlobalMarketPercent * 100, " instead of ", GlobalMarketPercent);
      Alert("WARNING: GlobalMarketPercent seems too small. Enter 30 for 30%, not 0.3");
   }
   
   // Check per-TL overrides
   double tlPercents[] = {TL1_MarketPercent, TL2_MarketPercent, TL3_MarketPercent, 
                          TL4_MarketPercent, TL5_MarketPercent, TL6_MarketPercent};
   for(int i = 0; i < 6; i++)
   {
      if(tlPercents[i] > 0 && tlPercents[i] < 1)
      {
         Print("WARNING: TL", i+1, "_MarketPercent = ", tlPercents[i]);
         Print("Enter ", tlPercents[i] * 100, " for ", tlPercents[i] * 100, "%, not ", tlPercents[i]);
         Alert("WARNING: TL" + IntegerToString(i+1) + "_MarketPercent seems too small");
      }
   }
   
   g_system_enabled = true;
   g_trading_enabled = true;
   g_system_start_time = TimeCurrent();
   g_last_tick_time = TimeCurrent();
   g_recovery_needed = false;
   g_reconnection_attempts = 0;
   
   // Reset detection tracking variables
   g_consecutive_detection_failures = 0;
   g_last_successful_detection = 0;
   g_detection_recovery_mode = false;
   
   Print("Chart ID: ", g_chart_id);
   Print("Symbol: ", Symbol());
   Print("Timeframe: ", EnumToString(Period()));
   
   if(EnableExposureLimit && MaxExposureLimit <= 0)
   {
      Alert("ERROR: Invalid Maximum Exposure Limit. Must be greater than 0.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   trade.SetExpertMagicNumber(EA_MAGIC_NUMBER);
   
   if(!ValidateSymbolAndTimeframe())
   {
      Alert(g_error_message);
      return(INIT_FAILED);
   }
   
   // Enhanced indicator detection with multiple retry attempts
   Print("=== STARTING ENHANCED INDICATOR DETECTION ===");
   
   bool indicator_detected = false;
   
   // Phase 1: Immediate detection attempt
   Sleep(1000); // Initial stabilization delay
   if(ValidateIndicatorPresence())
   {
      indicator_detected = true;
      Print("*** PHASE 1: Indicator detected immediately ***");
   }
   
   // Phase 2: Retry with progressive delays
   if(!indicator_detected)
   {
      Print("Phase 1 failed - Starting Phase 2 retry sequence");
      for(int retry = 1; retry <= 5; retry++)
      {
         Print("Detection retry ", retry, "/5");
         Sleep(2000 * retry); // Progressive delay: 2s, 4s, 6s, 8s, 10s
         
         if(ValidateIndicatorPresence())
         {
            indicator_detected = true;
            Print("*** PHASE 2: Indicator detected on retry ", retry, " ***");
            break;
         }
      }
   }
   
   // Phase 3: Final comprehensive check
   if(!indicator_detected)
   {
      Print("Phase 2 failed - Starting Phase 3 comprehensive check");
      Sleep(3000);
      
      // Force a more thorough object enumeration
      int total_objects = ObjectsTotal(0, -1, -1);
      Print("Total objects on chart: ", total_objects);
      
      for(int i = 0; i < total_objects; i++)
      {
         string obj_name = ObjectName(0, i, -1, -1);
         if(StringFind(obj_name, "Keltner") >= 0)
         {
            Print("Found potential indicator object: ", obj_name);
         }
      }
      
      if(ValidateIndicatorPresence())
      {
         indicator_detected = true;
         Print("*** PHASE 3: Indicator detected via comprehensive check ***");
      }
   }
   
   // Handle detection results
   if(indicator_detected)
   {
      Print("*** INDICATOR DETECTION: SUCCESS ***");
      g_system_enabled = true;
   }
   else
   {
      Print("*** INDICATOR DETECTION: FAILED ***");
      Print("*** EA will continue running in RECOVERY MODE ***");
      Print("*** System will automatically activate when indicator is detected ***");
      g_system_enabled = false; // Start disabled but allow recovery
   }
   
   if(!ValidateSingleChartOperation())
   {
      Alert("ERROR: Multiple Keltner indicators detected on different charts");
      return(INIT_FAILED);
   }
   
   // Initialize position tracking system
   if(g_last_calculated_exposure == -1.0) // Check if variables exist from previous fix
   {
      g_last_calculated_exposure = 0.0;
      g_last_position_count = 0;
      g_last_position_check = TimeCurrent();
      g_force_display_update = true;
   }
   
   EventSetTimer(1);
   CreateInfoDisplay();
   CreateEmergencyButtons();  // ADD THIS LINE
   UpdateInfoDisplay();
   
   Print("EA initialization completed successfully");
   Print("   System Status: ", g_system_enabled ? "ACTIVE" : "RECOVERY MODE");
   Print("   Exposure Limit: ", EnableExposureLimit ? DoubleToString(MaxExposureLimit, 3) + " lots" : "DISABLED");
   
   string oneSideInfo = "DISABLED";
   if(OneSideTradeMode == ONE_SIDE_BUY_ONLY) oneSideInfo = "BUY ONLY - Uptrend";
   else if(OneSideTradeMode == ONE_SIDE_SELL_ONLY) oneSideInfo = "SELL ONLY - Downtrend";
   Print("   One Side Trading: ", oneSideInfo);
   Print("   Auto Recovery: ", AutoRecoverAfterReconnection ? "ENABLED" : "DISABLED");
   Print("========================================");
   
   PrintPortfolioStatus();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Enhanced OnInit with position tracking initialization            |
//+------------------------------------------------------------------+
// Add this to the end of your OnInit() function:
void InitializePositionTracking()
{
   Print("=== INITIALIZING POSITION TRACKING ===");
   
   // Reset tracking variables
   g_last_calculated_exposure = -1.0;
   g_last_position_count = -1;
   g_last_position_check = TimeCurrent();
   g_force_display_update = true;
   
   // Force initial position calculation
   double initialExposure = MathAbs(GetNetVolume());
   Print("Initial position exposure: ", DoubleToString(initialExposure, 3), " lots");
   
   // Initialize display
   CreateInfoDisplay();
   UpdateInfoDisplay();
   
   Print("Position tracking system initialized successfully");
}

//+------------------------------------------------------------------+
//| Modified OnDeinit - Clean up buttons                            |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("XAUUSD M10 Keltner Trendline EA stopping");
   
   // **NEW: Clear heartbeat to signal EA shutdown**
   if(g_ea_heartbeat_var != "")
   {
      GlobalVariableSet(g_ea_heartbeat_var, 0);
      Sleep(100);
      GlobalVariableDel(g_ea_heartbeat_var);
      Print("EA heartbeat cleared - signaling shutdown to indicator");
   }
   
   // **NEW: Clear any pending signals**
   string signalVar = "TrendLineSignal_" + IntegerToString(g_chart_id);
   if(GlobalVariableCheck(signalVar))
   {
      GlobalVariableSet(signalVar, 0);
      Print("Cleared pending signals on EA shutdown");
   }
   Comment("");
   
   EventKillTimer();
   CleanupInfoDisplay();
   
   // Clean up emergency buttons
   ObjectDelete(0, g_stop_button_name);
   ObjectDelete(0, g_start_button_name);
   
   // Clean up global variables
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   GlobalVariableDel(varName);
   
   Comment("");
   ChartRedraw(0);
   
   PrintPortfolioStatus();
   Print("EA deinitialization complete");
}

//+------------------------------------------------------------------+
//| Modified OnTick - Add Emergency Stop Check                      |
//+------------------------------------------------------------------+
void OnTick()
{
   g_last_tick_time = TimeCurrent();
   
   // CRITICAL: Check emergency stop FIRST
   if(g_emergency_stop_active)
      return;
   
   if(!g_system_enabled || !g_trading_enabled)
      return;
   
   CheckForSignalsEnhanced();
}

//+------------------------------------------------------------------+
//| Updated OnTimer with more frequent total exposure checks         |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int timer_count = 0;
   timer_count++;
   
   // **NEW: BROADCAST EA HEARTBEAT EVERY SECOND**
   if(!g_emergency_stop_active && g_system_enabled && g_trading_enabled)
   {
      GlobalVariableSet(g_ea_heartbeat_var, (double)TimeCurrent());
      g_last_heartbeat_time = TimeCurrent();
   }
   else
   {
      // EA stopped/disabled - set heartbeat to 0
      GlobalVariableSet(g_ea_heartbeat_var, 0);
      
      // **NEW: Clear pending signals when EA stopped**
      if(g_emergency_stop_active || !g_trading_enabled)
      {
         string signalVar = "TrendLineSignal_" + IntegerToString(g_chart_id);
         if(GlobalVariableCheck(signalVar))
         {
            double signalFlag = GlobalVariableGet(signalVar);
            if(signalFlag > 0)
            {
               GlobalVariableSet(signalVar, 0);
               Comment("");
               Print("Signal cleared - EA not available (Emergency Stop: ", 
                     g_emergency_stop_active ? "YES" : "NO", 
                     ", Trading: ", g_trading_enabled ? "ENABLED" : "DISABLED", ")");
            }
         }
      }
   }
   
   // CRITICAL: Handle display updates first (prevents stack overflow)
   if(g_force_display_update)
   {
      UpdateInfoDisplay();
   }
   
   // Check connection status regularly
   if(timer_count % ReconnectionCheckInterval == 0)
   {
      CheckConnectionStatus();
      
      if(g_recovery_needed && g_connection_status)
      {
         RecoverSystemAfterReconnection();
      }
   }
   
   // CRITICAL: Aggressive indicator re-detection when system is disabled
   if(!g_system_enabled)
   {
      // Check every 10 seconds when disabled (aggressive recovery)
      if(timer_count % 10 == 0)
      {
         DebugPrint("System disabled - attempting indicator re-detection");
         
         if(ValidateIndicatorPresence())
         {
            g_system_enabled = true;
            Print("========================================");
            Print("*** AUTOMATIC RECOVERY SUCCESSFUL ***");
            Print("*** INDICATOR RE-DETECTED - SYSTEM ACTIVATED ***");
            Print("*** Ready to process signals again ***");
            Print("========================================");
            
            // Force display update to show system is active
            g_force_display_update = true;
            UpdateInfoDisplay();
         }
      }
   }
   else
   {
      // Normal validation when system is enabled (less frequent to avoid interference)
      if(timer_count % 120 == 0 && g_connection_status) // Every 4 minutes
      {
         if(!ValidateIndicatorPresence())
         {
            Print("=== INDICATOR DETECTION LOST ===");
            Print("System temporarily disabled - will retry automatically");
            g_system_enabled = false;
         }
      }
   }
   
   // Single chart operation validation (less frequent)
   if(timer_count % 180 == 0) // Every 6 minutes
   {
      if(!ValidateSingleChartOperation())
      {
         g_system_enabled = false;
         Alert("ERROR: Multiple chart validation failed");
      }
   }
   
   // ENHANCED: Check for position changes every 5 seconds (more responsive)
   if(timer_count % 5 == 0)  // Every 5 seconds instead of 30
   {
      datetime current_time = TimeCurrent();
      DebugPrint("=== QUICK POSITION CHECK ===");
      
      // This will trigger display updates if positions changed
      double currentTotalExposure = GetTotalNetExposure();
      double currentEANet = GetNetVolume();
      
      DebugPrint("Quick check - Total: " + DoubleToString(currentTotalExposure, 3) + 
                " | EA Net: " + DoubleToString(currentEANet, 3));
   }
   
   // CRITICAL: Detailed position verification every 30 seconds
   if(timer_count % 30 == 0)
   {
      datetime current_time = TimeCurrent();
      if(current_time - g_last_position_check >= 30)
      {
         DebugPrint("=== DETAILED POSITION VERIFICATION ===");
         double currentTotalExposure = GetTotalNetExposure();
         double currentEANet = GetNetVolume();
         DebugPrint("Detailed check - Total exposure: " + DoubleToString(currentTotalExposure, 3) + " lots");
         DebugPrint("Detailed check - EA net: " + DoubleToString(currentEANet, 3) + " lots");
         
         // Force display update as safety measure
         g_force_display_update = true;
      }
   }
   
   // Status update every 4 minutes (reduced frequency)
   if(timer_count % 120 == 0)
   {
      if(g_system_enabled && g_trading_enabled && g_connection_status)
      {
         int open_positions = 0;
         for(int i = 0; i < PositionsTotal(); i++)
         {
            ulong ticket = PositionGetTicket(i);
            if(PositionSelectByTicket(ticket))
            {
               if(PositionGetString(POSITION_SYMBOL) == _Symbol && 
                  PositionGetInteger(POSITION_MAGIC) == EA_MAGIC_NUMBER)
                  open_positions++;
            }
         }
         
         double currentNet = GetNetVolume();
         DebugPrint("Status: ACTIVE | Positions: " + IntegerToString(open_positions) + 
                   " | Net: " + DoubleToString(currentNet, 3) + " lots | Reconnects: " + IntegerToString(g_reconnection_attempts));
      }
      else if(!g_system_enabled)
      {
         DebugPrint("Status: RECOVERY MODE - Searching for indicator");
      }
      else
      {
         string reason = "";
         if(!g_connection_status) reason = "DISCONNECTED";
         else if(!g_trading_enabled) reason = "TRADING_DISABLED";
         else reason = "UNKNOWN";
         
         DebugPrint("Status: INACTIVE - " + reason);
      }
   }
   
   // Additional safety: Force display update every 2 minutes if no recent updates
   if(timer_count % 120 == 0)  // Every 4 minutes (same as status update)
   {
      g_force_display_update = true;
   }
}