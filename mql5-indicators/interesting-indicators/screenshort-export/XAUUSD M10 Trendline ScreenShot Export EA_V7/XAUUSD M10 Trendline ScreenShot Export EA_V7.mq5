//+------------------------------------------------------------------+
//|                     XAUUSD_M10_TrendLine_Screenshot_EA.mq5       |
//|                                        Copyright 2025              |
//|           XAUUSD M10 ONLY - Trend Line Screenshot Capture EA      |
//|               MODIFIED FROM TRADE EXECUTION TO SCREENSHOT         |
//|                     FIXED VERSION - RECONNECTION SUPPORT          |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025"
#property version   "1.01"
#property strict

// Constants
#define EA_MAGIC_NUMBER 789456
#define MAX_TREND_LINES 4

// Enums (simplified to match indicator)
enum ENUM_TRENDLINE_MODE
{
   MODE_DISABLED = 0,              // Disabled
   MODE_ENABLED = 1                // Enabled
};

// Input parameters (modified for screenshot functionality)
input group "EA Settings"
input bool     DebugMode = true;               // Enable debug messages

input group "Screenshot Settings"
input int      ScreenshotWidth = 1920;         // Screenshot width in pixels
input int      ScreenshotHeight = 1080;        // Screenshot height in pixels
input string   FilenamePrefix = "TrendlineSignal"; // Filename prefix for screenshots
input bool     IncludeTimestamp = true;        // Include timestamp in filename
input bool     IncludePriceInFilename = true;  // Include touch price in filename
input bool     ShowPopupAlerts = true;         // Show popup alerts when screenshot is captured

input group "Signal Tracking"
input int      SignalCooldownSeconds = 300;    // Cooldown between screenshots (seconds)
input bool     SaveSignalLog = true;           // Save signal details to log file

input group "Reconnection Settings"
input int      ReconnectionCheckInterval = 5;  // Check for reconnection every N seconds
input bool     AutoRecoverAfterReconnection = true; // Auto-recover system after reconnection

// Global variables
long g_chart_id;
bool g_system_enabled = true;
bool g_screenshot_enabled = true;
string g_error_message = "";

// Screenshot tracking
datetime g_last_screenshot_time[MAX_TREND_LINES];
int g_screenshot_count = 0;
string g_last_screenshot_filename = "";

// Last signal tracking for display
double g_last_signal_price = 0.0;
datetime g_last_signal_time = 0;

// Chart display configuration
int g_display_start_x = 10;
int g_display_bottom_margin = 35;
int g_display_y_step = 24;
int g_display_font_size = 9;
int g_display_col1_x = 10;
int g_display_col2_x = 200;
int g_display_col3_x = 220;

// Object name prefix for easy identification and cleanup
string g_ea_object_prefix = "TrendLineScreenshotEA_Info_";

// Reconnection detection variables
bool g_connection_status = true;
datetime g_last_tick_time = 0;
datetime g_system_start_time = 0;
bool g_recovery_needed = false;
int g_reconnection_attempts = 0;

// Signal processing
struct SignalData
{
   int trend_line_id;
   ENUM_TRENDLINE_MODE mode;
   double touch_price;
   datetime timestamp;
   string signal_type; // "BUY" or "SELL"
};

//+------------------------------------------------------------------+
//| Debug print function                                             |
//+------------------------------------------------------------------+
void DebugPrint(string message)
{
   if(DebugMode)
      Print("[TRENDLINE SCREENSHOT EA] ", message);
}

//+------------------------------------------------------------------+
//| Check connection status and detect reconnection                  |
//+------------------------------------------------------------------+
bool CheckConnectionStatus()
{
   bool terminal_connected = TerminalInfoInteger(TERMINAL_CONNECTED);
   datetime current_time = TimeCurrent();
   
   // Check if we have recent tick data
   bool recent_tick = (current_time - g_last_tick_time) < 60; // Within last minute
   
   bool current_status = terminal_connected;
   
   // Detect reconnection
   if(!g_connection_status && current_status && recent_tick)
   {
      Print("=== RECONNECTION DETECTED ===");
      Print("Terminal Connected: ", terminal_connected ? "YES" : "NO");
      Print("Recent Tick Available: ", recent_tick ? "YES" : "NO");
      Print("System will attempt recovery...");
      g_recovery_needed = true;
      g_reconnection_attempts++;
   }
   else if(g_connection_status && !current_status)
   {
      Print("=== CONNECTION LOST ===");
      Print("Terminal Connected: ", terminal_connected ? "YES" : "NO");
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
   
   // Update chart ID (may have changed)
   long old_chart_id = g_chart_id;
   g_chart_id = ChartID();
   
   if(old_chart_id != g_chart_id)
   {
      Print("Chart ID changed: ", old_chart_id, " -> ", g_chart_id);
      
      // Clean up old global variables
      string old_var_name = "TrendLineSignal_" + IntegerToString(old_chart_id);
      if(GlobalVariableCheck(old_var_name))
      {
         GlobalVariableDel(old_var_name);
         Print("Cleaned up old global variable: ", old_var_name);
      }
   }
   
   // Re-validate system
   if(!ValidateSymbolAndTimeframe())
   {
      Print("RECOVERY FAILED: Symbol/Timeframe validation failed");
      return false;
   }
   
   if(!ValidateIndicatorPresence())
   {
      Print("RECOVERY FAILED: Indicator not found - will retry");
      return false;
   }
   
   if(!ValidateSingleChartOperation())
   {
      Print("RECOVERY FAILED: Multiple chart validation failed");
      return false;
   }
   
   // Reset system state
   g_system_enabled = true;
   g_screenshot_enabled = true;
   g_error_message = "";
   
   // Restart timer
   EventKillTimer();
   EventSetTimer(30);
   
   Print("=== SYSTEM RECOVERY COMPLETE ===");
   Print("New Chart ID: ", g_chart_id);
   Print("System Status: ACTIVE");
   g_recovery_needed = false;
   
   // Clear any stale signals
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
         // Check if signal is too old (more than 2 minutes)
         datetime signal_time = (datetime)signalFlag;
         if(TimeCurrent() - signal_time > 120)
         {
            GlobalVariableSet(varName, 0);
            Print("Cleared stale signal from global variable");
         }
      }
   }
   
   // Clear comment if it contains old signals
   string comment = ChartGetString(0, CHART_COMMENT);
   if(StringFind(comment, "SIGNAL: ") == 0)
   {
      Comment("");
      Print("Cleared stale signal from chart comment");
   }
}

//+------------------------------------------------------------------+
//| Enhanced signal checking with multiple fallback methods          |
//+------------------------------------------------------------------+
void CheckForSignalsEnhanced()
{
   if(!g_system_enabled || !g_screenshot_enabled)
      return;
      
   if(!g_connection_status)
   {
      DebugPrint("Skipping signal check - not connected");
      return;
   }
   
   // Try multiple global variable name patterns (in case chart ID changed)
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   string varNames[3];
   varNames[0] = varName; // Current chart ID
   varNames[1] = "TrendLineSignal_" + IntegerToString(ChartID()); // Fresh chart ID
   varNames[2] = "TrendLineSignal"; // Generic fallback
   
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
      // Only print debug message occasionally
      static datetime last_no_signal_debug = 0;
      if(TimeCurrent() - last_no_signal_debug >= 30)
      {
         last_no_signal_debug = TimeCurrent();
         DebugPrint("No active signals found in global variables");
      }
      return;
   }
   
   Print("=== SIGNAL FOUND ===");
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
   
   Print("=== PARSED SIGNAL DATA ===");
   Print("TL ID: ", signal.trend_line_id);
   Print("Mode: ", signal.mode);
   Print("Touch Price: ", signal.touch_price);
   Print("Timestamp: ", signal.timestamp);
   Print("Signal Type: ", signal.signal_type);
   
   bool success = TakeScreenshotOnSignal(signal);
   
   // Clear signal regardless of success
   GlobalVariableSet(active_var_name, 0);
   Comment("");
   
   Print("=== SIGNAL PROCESSING RESULT: ", success ? "SUCCESS" : "FAILED", " ===");
   PrintSystemStatus();
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
//| Check for indicator presence with retry logic                    |
//+------------------------------------------------------------------+
bool ValidateIndicatorPresence()
{
   if(ObjectFind(0, "TrendLineIndicatorMarker") < 0)
   {
      g_error_message = "ERROR: TrendLine Indicator not found on this chart. Please load the indicator first.";
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
            g_error_message = "ERROR: Indicator detected on multiple charts. Please use only ONE chart with this system.";
            return false;
         }
      }
      chart_id = ChartNext(chart_id);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Check cooldown period for screenshots                            |
//+------------------------------------------------------------------+
bool IsScreenshotCooldownExpired(int trendline_index)
{
   if(trendline_index < 0 || trendline_index >= MAX_TREND_LINES)
      return false;
      
   if(g_last_screenshot_time[trendline_index] == 0)
      return true;
   
   datetime current_time = TimeCurrent();
   int elapsed_seconds = (int)(current_time - g_last_screenshot_time[trendline_index]);
   
   return (elapsed_seconds >= SignalCooldownSeconds);
}

//+------------------------------------------------------------------+
//| Generate screenshot filename with Symbol instead of signal type  |
//+------------------------------------------------------------------+
string GenerateScreenshotFilename(const SignalData &signal)
{
   string filename = FilenamePrefix;
   
   // Add Symbol
   filename += "_" + _Symbol;
   
   // Add trend line info
   filename += "_TL" + IntegerToString(signal.trend_line_id);
   
   // Add price if enabled
   if(IncludePriceInFilename)
   {
      filename += "_" + DoubleToString(signal.touch_price, 2);
   }
   
   // Add timestamp if enabled
   if(IncludeTimestamp)
   {
      string timestamp = TimeToString(signal.timestamp, TIME_DATE|TIME_MINUTES|TIME_SECONDS);
      StringReplace(timestamp, ":", "-");
      StringReplace(timestamp, " ", "_");
      StringReplace(timestamp, ".", "-");
      filename += "_" + timestamp;
   }
   
   filename += ".png";
   
   // Clean filename of invalid characters
   StringReplace(filename, ":", "-");
   StringReplace(filename, "*", "-");
   StringReplace(filename, "?", "-");
   StringReplace(filename, "\"", "-");
   StringReplace(filename, "<", "-");
   StringReplace(filename, ">", "-");
   StringReplace(filename, "|", "-");
   
   return filename;
}

//+------------------------------------------------------------------+
//| Save signal details to log file                                  |
//+------------------------------------------------------------------+
void SaveSignalToLog(const SignalData &signal, string filename, bool success)
{
   if(!SaveSignalLog)
      return;
      
   string log_filename = "TrendlineSignals_" + TimeToString(TimeCurrent(), TIME_DATE) + ".log";
   StringReplace(log_filename, ".", "-");
   
   int file_handle = FileOpen(log_filename, FILE_WRITE|FILE_READ|FILE_TXT);
   if(file_handle != INVALID_HANDLE)
   {
      FileSeek(file_handle, 0, SEEK_END); // Go to end of file
      
      // SIMPLIFIED LOG FORMAT (removed signal type since it's no longer sent)
      string log_entry = StringFormat("%s,TL%d,%.5f,%s,%s\n",
                                      TimeToString(signal.timestamp, TIME_DATE|TIME_MINUTES|TIME_SECONDS),
                                      signal.trend_line_id,
                                      signal.touch_price,
                                      filename,
                                      success ? "SUCCESS" : "FAILED");
      
      FileWriteString(file_handle, log_entry);
      FileClose(file_handle);
      
      Print("Signal logged to: ", log_filename);
   }
   else
   {
      Print("ERROR: Could not open log file: ", log_filename);
   }
}

//+------------------------------------------------------------------+
//| Take screenshot on signal detection                              |
//+------------------------------------------------------------------+
bool TakeScreenshotOnSignal(const SignalData &signal)
{
   Print("=== SCREENSHOT CAPTURE START ===");
   
   if(!g_screenshot_enabled)
   {
      Print("ERROR: Screenshot capture disabled in EA");
      return false;
   }
   
   // Check cooldown period
   if(!IsScreenshotCooldownExpired(signal.trend_line_id - 1)) // Convert to 0-based index
   {
      int remaining_seconds = SignalCooldownSeconds - (int)(TimeCurrent() - g_last_screenshot_time[signal.trend_line_id - 1]);
      Print("SCREENSHOT SKIPPED: Cooldown active for TL", signal.trend_line_id, " (", remaining_seconds, " seconds remaining)");
      return false;
   }
   
   // Generate filename
   string filename = GenerateScreenshotFilename(signal);
   Print("Generated filename: ", filename);
   
   // Validate screenshot parameters
   if(ScreenshotWidth <= 0 || ScreenshotHeight <= 0)
   {
      Print("ERROR: Invalid screenshot dimensions: ", ScreenshotWidth, "x", ScreenshotHeight);
      return false;
   }
   
   Print("Taking screenshot with dimensions: ", ScreenshotWidth, "x", ScreenshotHeight);
   Print("Chart Symbol: ", ChartSymbol(g_chart_id));
   Print("Chart Timeframe: ", EnumToString(ChartPeriod(g_chart_id)));
   
   // Update signal tracking for display BEFORE taking screenshot
   g_last_signal_price = signal.touch_price;
   g_last_signal_time = signal.timestamp;
   
   // Update display BEFORE taking screenshot so it shows current signal data
   UpdateInfoDisplay();
   
   // Give display a moment to refresh before screenshot
   Sleep(100);
   
   // Take the screenshot
   ResetLastError();
   bool screenshot_result = ChartScreenShot(g_chart_id, filename, ScreenshotWidth, ScreenshotHeight);
   int error_code = GetLastError();
   
   Print("Screenshot Result: ", screenshot_result ? "SUCCESS" : "FAILED");
   if(error_code != 0)
      Print("Error Code: ", error_code);
   
   if(screenshot_result)
   {
      // Update tracking variables
      g_last_screenshot_time[signal.trend_line_id - 1] = TimeCurrent();
      g_screenshot_count++;
      g_last_screenshot_filename = filename;
      
      Print("SUCCESS: Screenshot saved as: ", filename);
      Print("Total screenshots taken: ", g_screenshot_count);
      
      // Show popup alert notification if enabled
      if(ShowPopupAlerts)
      {
         // SIMPLIFIED ALERT FORMAT (removed signal type since it's no longer sent)
         string alert_message = StringFormat("SCREENSHOT EXPORTED!\n\nFile: %s\nSymbol: %s\nTrendline: TL%d\nPrice: %.2f\nTime: %s\n\nTotal Screenshots: %d",
                                           filename,
                                           _Symbol,
                                           signal.trend_line_id,
                                           signal.touch_price,
                                           TimeToString(signal.timestamp, TIME_DATE|TIME_MINUTES|TIME_SECONDS),
                                           g_screenshot_count);
         Alert(alert_message);
      }
      else
      {
         // Still log to console for reference even when popup is disabled
         Print("POPUP ALERT DISABLED - Screenshot exported silently: ", filename);
      }
      
      // Save to log
      SaveSignalToLog(signal, filename, true);
      
      return true;
   }
   else
   {
      Print("FAILED: Screenshot capture failed");
      SaveSignalToLog(signal, filename, false);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Parse signal data from comment                                   |
//+------------------------------------------------------------------+
bool ParseSignalData(string signalStr, SignalData &signal)
{
   string parts[];
   int count = StringSplit(signalStr, '|', parts);
   
   // NEW SIMPLIFIED FORMAT: TL{ID}|{Price}|{Timestamp} (3 parts instead of 5)
   if(count != 3)
   {
      DebugPrint("Invalid simplified signal format: " + signalStr + " (expected 3 parts, got " + IntegerToString(count) + ")");
      return false;
   }
   
   if(StringSubstr(parts[0], 0, 2) != "TL")
   {
      DebugPrint("Invalid trend line ID: " + parts[0]);
      return false;
   }
   signal.trend_line_id = (int)StringToInteger(StringSubstr(parts[0], 2, 1));
   
   if(signal.trend_line_id < 1 || signal.trend_line_id > MAX_TREND_LINES)
   {
      DebugPrint(StringFormat("Trend line ID out of range: %d", signal.trend_line_id));
      return false;
   }
   
   // For simplified format, we set default values since mode/type no longer sent
   signal.mode = MODE_ENABLED; // Default mode (not actually used for screenshots)
   signal.signal_type = "TOUCH"; // Generic signal type
   
   signal.touch_price = StringToDouble(parts[1]);  // parts[1] is now price
   signal.timestamp = (datetime)StringToInteger(parts[2]); // parts[2] is now timestamp
   
   if(signal.touch_price <= 0)
   {
      DebugPrint("Invalid signal values detected");
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Print current system status for monitoring                       |
//+------------------------------------------------------------------+
void PrintSystemStatus()
{
   Print("=== CURRENT SYSTEM STATUS ===");
   Print("Symbol: ", _Symbol);
   Print("Screenshot Enabled: ", g_screenshot_enabled ? "YES" : "NO");
   Print("Screenshot Dimensions: ", ScreenshotWidth, "x", ScreenshotHeight);
   Print("Cooldown Period: ", SignalCooldownSeconds, " seconds");
   Print("Total Screenshots: ", g_screenshot_count);
   if(g_last_screenshot_filename != "")
      Print("Last Screenshot: ", g_last_screenshot_filename);
   Print("Connection Status: ", g_connection_status ? "CONNECTED" : "DISCONNECTED");
   Print("Reconnection Attempts: ", g_reconnection_attempts);
   Print("=== END SYSTEM STATUS ===");
   UpdateInfoDisplay();
}

//+------------------------------------------------------------------+
//| Create information display (modified for screenshot info)        |
//+------------------------------------------------------------------+
void CreateInfoDisplay()
{
   Print("Creating EA information display - Trading signal monitoring...");
   
   // First clean up any existing objects
   CleanupInfoDisplay();
   
   // Table data for trading signal monitoring
   string labels[] = {
      "Symbol",
      "Timeframe", 
      "Price Level",
      "Time"
   };
   
   string spacers[] = {
      ":",
      ":",
      ":",
      ":"
   };
   
   // Create 12 objects total (3 columns x 4 rows)
   for(int i = 0; i < ArraySize(labels); i++)
   {
      // Calculate Y position from bottom
      int y_from_bottom = g_display_bottom_margin + ((ArraySize(labels) - 1 - i) * g_display_y_step);
      
      // Column 1: Label objects (left)
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
         ObjectSetInteger(0, label_name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
         ObjectSetInteger(0, label_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, label_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, label_name, OBJPROP_HIDDEN, true);
      }
      
      // Column 2: Spacer objects (middle)
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
         ObjectSetInteger(0, spacer_name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
         ObjectSetInteger(0, spacer_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, spacer_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, spacer_name, OBJPROP_HIDDEN, true);
      }
      
      // Column 3: Value objects (right)
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
         ObjectSetInteger(0, value_name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
         ObjectSetInteger(0, value_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, value_name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, value_name, OBJPROP_HIDDEN, true);
      }
   }
   
   ChartRedraw(0);
   Print("EA trading signal monitoring display created successfully");
}

//+------------------------------------------------------------------+
//| Update information display with current data                     |
//+------------------------------------------------------------------+
void UpdateInfoDisplay()
{
   // Check if display exists, if not create it
   string test_object = g_ea_object_prefix + "Label_0";
   if(ObjectFind(0, test_object) < 0)
   {
      CreateInfoDisplay();
      return;
   }
   
   // Prepare display values
   string display_values[4];
   
   // Current Symbol
   display_values[0] = _Symbol;
   
   // Current Timeframe
   ENUM_TIMEFRAMES current_period = _Period;
   string timeframe_str = "";
   switch(current_period)
   {
      case PERIOD_M1:  timeframe_str = "M1"; break;
      case PERIOD_M5:  timeframe_str = "M5"; break;
      case PERIOD_M10: timeframe_str = "M10"; break;
      case PERIOD_M15: timeframe_str = "M15"; break;
      case PERIOD_M30: timeframe_str = "M30"; break;
      case PERIOD_H1:  timeframe_str = "H1"; break;
      case PERIOD_H4:  timeframe_str = "H4"; break;
      case PERIOD_D1:  timeframe_str = "D1"; break;
      case PERIOD_W1:  timeframe_str = "W1"; break;
      case PERIOD_MN1: timeframe_str = "MN1"; break;
      default: timeframe_str = EnumToString(current_period);
   }
   display_values[1] = timeframe_str;
   
   // Price Level (last signal price)
   if(g_last_signal_price > 0)
   {
      display_values[2] = DoubleToString(g_last_signal_price, 2);
   }
   else
   {
      display_values[2] = "No signal";
   }
   
   // Time (last signal timestamp)
   if(g_last_signal_time > 0)
   {
      display_values[3] = TimeToString(g_last_signal_time, TIME_DATE|TIME_MINUTES);
   }
   else
   {
      display_values[3] = "No signal";
   }
   
   // Update each value object
   for(int i = 0; i < 4; i++)
   {
      string value_name = g_ea_object_prefix + "Value_" + IntegerToString(i);
      if(ObjectFind(0, value_name) >= 0)
      {
         ObjectSetString(0, value_name, OBJPROP_TEXT, display_values[i]);
         
         // Set colors based on content
         color text_color = clrBlue;
         if(i == 0) text_color = clrDarkBlue;     // Symbol - dark blue
         if(i == 1) text_color = clrDarkBlue;     // Timeframe - dark blue
         if(i == 2) // Price Level
         {
            if(display_values[i] != "No signal") 
               text_color = clrGreen;  // Green if we have a price
            else 
               text_color = clrGray;   // Gray if no signal
         }
         if(i == 3) // Time
         {
            if(display_values[i] != "No signal") 
               text_color = clrDarkGreen;  // Dark green if we have a time
            else 
               text_color = clrGray;       // Gray if no signal
         }
         
         ObjectSetInteger(0, value_name, OBJPROP_COLOR, text_color);
      }
   }
   
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Clean up display objects                                         |
//+------------------------------------------------------------------+
void CleanupInfoDisplay()
{
   Print("=== EA OBJECT CLEANUP START ===");
   
   int deleted_count = 0;
   for(int i = 0; i < 10; i++)
   {
      string label_name = g_ea_object_prefix + "Label_" + IntegerToString(i);
      string spacer_name = g_ea_object_prefix + "Spacer_" + IntegerToString(i);
      string value_name = g_ea_object_prefix + "Value_" + IntegerToString(i);
      
      if(ObjectDelete(0, label_name)) deleted_count++;
      if(ObjectDelete(0, spacer_name)) deleted_count++;
      if(ObjectDelete(0, value_name)) deleted_count++;
   }
   
   ChartRedraw(0);
   Print("Total EA objects deleted: ", deleted_count);
   Print("=== EA OBJECT CLEANUP END ===");
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("========================================");
   Print("XAUUSD M10 TRENDLINE SCREENSHOT EA STARTING");
   Print("VERSION 1.01 - MODIFIED FOR SCREENSHOT CAPTURE");
   Print("========================================");
   
   g_chart_id = ChartID();
   g_system_enabled = true;
   g_screenshot_enabled = true;
   g_system_start_time = TimeCurrent();
   g_last_tick_time = TimeCurrent();
   g_recovery_needed = false;
   g_reconnection_attempts = 0;
   g_screenshot_count = 0;
   g_last_screenshot_filename = "";
   
   // Initialize signal tracking for display
   g_last_signal_price = 0.0;
   g_last_signal_time = 0;
   
   // Initialize screenshot tracking arrays
   for(int i = 0; i < MAX_TREND_LINES; i++)
   {
      g_last_screenshot_time[i] = 0;
   }
   
   // Validate screenshot parameters
   if(ScreenshotWidth <= 0 || ScreenshotHeight <= 0)
   {
      Alert("ERROR: Invalid screenshot dimensions. Width and Height must be greater than 0.");
      Print("ERROR: Invalid screenshot dimensions: ", ScreenshotWidth, "x", ScreenshotHeight);
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   if(SignalCooldownSeconds < 0)
   {
      Alert("ERROR: Invalid cooldown period. Must be 0 or greater.");
      Print("ERROR: Invalid cooldown period: ", SignalCooldownSeconds);
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   if(!ValidateSymbolAndTimeframe())
   {
      Alert(g_error_message);
      Print(g_error_message);
      return(INIT_FAILED);
   }
   
   if(!ValidateIndicatorPresence())
   {
      Alert(g_error_message);
      Print(g_error_message);
      return(INIT_FAILED);
   }
   
   if(!ValidateSingleChartOperation())
   {
      Alert(g_error_message);
      Print(g_error_message);
      return(INIT_FAILED);
   }
   
   EventSetTimer(30);
   
   Print("EA initialized successfully");
   Print("   Symbol: XAUUSD, Timeframe: M10");
   Print("   Chart ID: ", g_chart_id);
   Print("   Mode: Screenshot capture on trend line touch");
   Print("   Screenshot Dimensions: ", ScreenshotWidth, "x", ScreenshotHeight);
   Print("   Cooldown Period: ", SignalCooldownSeconds, " seconds");
   Print("   Filename Prefix: ", FilenamePrefix);
   Print("   Include Timestamp: ", IncludeTimestamp ? "YES" : "NO");
   Print("   Include Price: ", IncludePriceInFilename ? "YES" : "NO");
   Print("   Show Popup Alerts: ", ShowPopupAlerts ? "ENABLED" : "DISABLED");
   Print("   Save Log: ", SaveSignalLog ? "YES" : "NO");
   Print("   Auto Recovery: ", AutoRecoverAfterReconnection ? "ENABLED" : "DISABLED");
   Print("   Ready to capture screenshots on indicator signals");
   Print("========================================");
   
   PrintSystemStatus();
   CreateInfoDisplay();
   UpdateInfoDisplay();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("========================================");
   Print("XAUUSD M10 TRENDLINE SCREENSHOT EA STOPPING");
   Print("Deinitalization Reason: ", reason);
   Print("========================================");
   
   EventKillTimer();
   
   // Cleanup display objects
   CleanupInfoDisplay();
   
   // Clean up global variables
   string varName = "TrendLineSignal_" + IntegerToString(g_chart_id);
   GlobalVariableDel(varName);
   
   // Print final statistics
   Print("FINAL STATISTICS:");
   Print("  Total Screenshots Captured: ", g_screenshot_count);
   Print("  Reconnection Attempts: ", g_reconnection_attempts);
   if(g_last_screenshot_filename != "")
      Print("  Last Screenshot: ", g_last_screenshot_filename);
   
   Comment("");
   ChartRedraw();
   
   Print("========================================");
   Print("SCREENSHOT EA DEINITIALIZATION COMPLETE");
   Print("========================================");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   g_last_tick_time = TimeCurrent();
   
   if(!g_system_enabled || !g_screenshot_enabled)
      return;
   
   CheckForSignalsEnhanced();
}

//+------------------------------------------------------------------+
//| Timer function with reconnection management                      |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int timer_count = 0;
   timer_count++;
   
   // Check connection status regularly
   if(timer_count % ReconnectionCheckInterval == 0)
   {
      CheckConnectionStatus();
      
      // Attempt recovery if needed
      if(g_recovery_needed && g_connection_status)
      {
         bool recovery_success = RecoverSystemAfterReconnection();
         if(!recovery_success)
         {
            DebugPrint("Recovery attempt failed, will retry...");
         }
      }
   }
   
   // System validation
   if(timer_count % 1 == 0 && g_connection_status)
   {
      if(!ValidateIndicatorPresence())
      {
         if(g_system_enabled)
         {
            g_system_enabled = false;
            Alert(g_error_message);
            Print(g_error_message);
         }
         return;
      }
      else if(!g_system_enabled)
      {
         g_system_enabled = true;
         Print("Indicator detected again - system re-enabled");
      }
      
      if(!ValidateSingleChartOperation())
      {
         g_system_enabled = false;
         Alert(g_error_message);
         Print(g_error_message);
         return;
      }
   }
   
   // Status update every 2 minutes
   if(timer_count % 4 == 0)
   {
      UpdateInfoDisplay();
      if(g_system_enabled && g_screenshot_enabled && g_connection_status)
      {
         string status_msg = StringFormat("Status: ACTIVE | Screenshots: %d | Cooldown: %d sec | Reconnects: %d", 
                                         g_screenshot_count, SignalCooldownSeconds, g_reconnection_attempts);
         DebugPrint(status_msg);
      }
      else
      {
         string reason = "";
         if(!g_connection_status) reason = "DISCONNECTED";
         else if(!g_system_enabled) reason = "SYSTEM_DISABLED";
         else if(!g_screenshot_enabled) reason = "SCREENSHOT_DISABLED";
         else reason = "UNKNOWN";
         
         DebugPrint("Status: INACTIVE - " + reason);
      }
   }
}