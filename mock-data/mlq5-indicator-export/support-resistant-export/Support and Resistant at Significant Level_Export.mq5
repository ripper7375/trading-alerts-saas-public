//+------------------------------------------------------------------+
//|                       Support and Resistant at Significant Level |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright     "EarnForex.com - 2019-2023"
#property link          "https://www.earnforex.com/metatrader-indicators/support-resistance-lines/"
#property version       "1.03"
#property strict
#property indicator_chart_window

#property indicator_buffers 8
#property indicator_plots 8
#property indicator_label1 "BufferZero"
#property indicator_label2 "BufferOne"
#property indicator_label3 "BufferTwo"
#property indicator_label4 "BufferThree"
#property indicator_label5 "BufferFour"
#property indicator_label6 "BufferFive"
#property indicator_label7 "BufferSix"
#property indicator_label8 "BufferSeven"

//--- Export Button name constants
#define EXPORT_BUTTON_NAME "SRExportButton"
#define BATCH_EXPORT_BUTTON_NAME "SRBatchExportButton"

enum ENUM_CUSTOMTIMEFRAMES
  {
   CURRENT = PERIOD_CURRENT, // CURRENT PERIOD
   M1 = PERIOD_M1,          // M1
   M5 = PERIOD_M5,          // M5
   M15 = PERIOD_M15,        // M15
   M30 = PERIOD_M30,        // M30
   H1 = PERIOD_H1,          // H1
   H4 = PERIOD_H4,          // H4
   D1 = PERIOD_D1,          // D1
   W1 = PERIOD_W1,          // W1
   MN1 = PERIOD_MN1,        // MN1
  };

// Symbol selection options for export
enum ENUM_SYMBOL_SELECTION {
   SYMBOL_CURRENT = 0,        // Current chart symbol
   SYMBOL_MANUAL_ENTRY = 1    // Enter manually
};

// Core inputs
input group "Support and Resistant Levels Settings"
input ENUM_TIMEFRAMES SRTimeframe = PERIOD_CURRENT; // Timeframe to Analyze
input double AccuracyMultiplier = 3.0;             // Accuracy Multiplier (eg: 1.0-3.5)
input int ATRPeriod = 100;                         // ATR Period
input int SafeDistance = 50;                       // Safety Distance From Closest Level (points)
input int BarsToIgnore = 0;                        // Recent Candles to Ignore
input int MaxBarsExt = 1000;                       // Bars to Analyze
input int MaxRange = 0;                            // Max Price Range to Analyze (points) (0=No Limit)

input group "Draw Line Settings"
input bool DrawLinesEnabled = true;                // Draw Lines
input int LineThickness = 1;                       // Line Thickness (1-5)
input ENUM_LINE_STYLE ResistanceStyle = STYLE_DASHDOTDOT;  // Resistance Line Style
input ENUM_LINE_STYLE SupportStyle = STYLE_DASHDOTDOT;     // Support Line Style
input color ResistanceColor = clrRed;              // Resistance Color
input color SupportColor = clrGreen;               // Support Color

input group "Export Settings"
input bool InpEnableExport = false;                // Enable Export Features
input ENUM_SYMBOL_SELECTION InpSymbolSelection = SYMBOL_CURRENT;  // Symbol Selection for Export
input string InpManualSymbol = "";                 // Manual Symbol Entry (if "Enter manually")
input string InpBaseFileName = "SR_Levels";        // Base file name for export
input bool InpIncludeMetadata = true;              // Include metadata in export
input bool InpExportJSON = true;                   // Export JSON file
input bool InpCleanFilenames = true;               // Clean filenames (no .txt extension)
input bool InpEnableBatchExport = false;           // Enable batch export button
input string InpBatchSymbols = "EURUSD,USDJPY,GBPUSD"; // Symbols for batch export
input string InpBatchTimeframes = "M15,H1,H4";     // Timeframes for batch export
input bool InpContinueOnError = true;              // Continue batch on error

input string Comment_1 = "====================";    // Indicator Settings
input string IndicatorName = "MQLTA-SR";           // Indicator Name

// Global variables
int MaxBars = 0;
double Array[];
int CalculatedBars = 0;
double LevelAbove = 0;
double LevelBelow = 0;
int DistanceFromSupport = INT_MAX;
int DistanceFromResistance = INT_MAX;
bool Waiting = false;

int ATRHandle, FractalsHandle;
double BufferFractalsUp[], BufferFractalsDown[];
double BufferATR[];

double BufferZero[];
double BufferOne[];
double BufferTwo[];
double BufferThree[];
double BufferFour[];
double BufferFive[];
double BufferSix[];
double BufferSeven[];

void CleanLines();  // Forward declaration

//+------------------------------------------------------------------+
//| Export Functions - Added from OHLC Download                     |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe, string extension)
{
   // Clean up symbol name (remove suffixes like .i for filename)
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
      
   // Format timeframe as a string
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
   
   // For compatibility, we can optionally omit the .txt extension
   string file_extension = extension;
   if(InpCleanFilenames && extension == "txt")
      file_extension = "";
   
   // Build the filename: BaseName_Symbol_Timeframe.extension
   if(file_extension != "")
      return StringFormat("%s_%s_%s.%s", base_name, clean_symbol, tf_str, file_extension);
   else
      return StringFormat("%s_%s_%s", base_name, clean_symbol, tf_str);
}

//+------------------------------------------------------------------+
//| Get selected symbol for export                                   |
//+------------------------------------------------------------------+
string GetSelectedSymbol()
{
   string symbol = "";
   
   switch(InpSymbolSelection)
   {
      case SYMBOL_CURRENT:
         symbol = Symbol();
         break;
         
      case SYMBOL_MANUAL_ENTRY:
         symbol = InpManualSymbol;
         if(symbol == "") symbol = Symbol(); // Default to current if empty
         break;
         
      default:
         symbol = Symbol(); // Fallback to current
   }
   
   return symbol;
}

//+------------------------------------------------------------------+
//| Convert timeframe string to ENUM_TIMEFRAMES                      |
//+------------------------------------------------------------------+
ENUM_TIMEFRAMES StringToTimeframe(string tf_str)
{
   if(tf_str == "M1") return PERIOD_M1;
   if(tf_str == "M5") return PERIOD_M5;
   if(tf_str == "M15") return PERIOD_M15;
   if(tf_str == "M30") return PERIOD_M30;
   if(tf_str == "H1") return PERIOD_H1;
   if(tf_str == "H4") return PERIOD_H4;
   if(tf_str == "D" || tf_str == "D1") return PERIOD_D1;
   if(tf_str == "W" || tf_str == "W1") return PERIOD_W1;
   if(tf_str == "MN" || tf_str == "MN1") return PERIOD_MN1;
   
   // Default to current timeframe if not recognized
   Print("WARNING: Unrecognized timeframe string: ", tf_str, " - using current timeframe");
   return Period();
}

//+------------------------------------------------------------------+
//| Create Export Button                                              |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   // Delete existing button if it exists
   ObjectDelete(0, EXPORT_BUTTON_NAME);

   // Create new button
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

   // Button dimensions
   int button_width = 200;     
   int button_height = 50;    
   int x_margin = 250;       
   int y_margin = 100;      

   // Position at right side, higher up from bottom
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   // Text and font properties
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export SR Levels");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   // Visual style
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

   // Button behavior
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
//| Create Batch Export Button                                        |
//+------------------------------------------------------------------+
void CreateBatchExportButton()
{
   // Delete existing button if it exists
   ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);

   // Create new button
   ObjectCreate(0, BATCH_EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

   // Button dimensions
   int button_width = 200;     
   int button_height = 50;    
   int x_margin = 250;       
   int y_margin = 160;      // Position below the first button

   // Position at right side
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   // Text and font properties
   ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Batch Export SR");
   ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   // Visual style
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,180,100');
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,150,80');

   // Button behavior
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
//| Export Support and Resistance Levels to TXT file                 |
//+------------------------------------------------------------------+
bool ExportSRToTxt(const string symbol,
                   const ENUM_TIMEFRAMES timeframe,
                   const string filename)
{
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting SR levels to TXT file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   int error = GetLastError();
   
   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open TXT file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;
   double currentClose = iClose(symbol, PERIOD_CURRENT, 0);
   
   // Write metadata header if requested
   if(InpIncludeMetadata)
   {
      write_success &= FileWrite(file_handle, "Support and Resistance Levels Export") > 0;
      write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
      write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
      write_success &= FileWrite(file_handle, "Analysis Timeframe: " + EnumToString(SRTimeframe)) > 0;
      write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
      write_success &= FileWrite(file_handle, "Current Price: " + DoubleToString(currentClose, Digits())) > 0;
      write_success &= FileWrite(file_handle, "ATR Period: " + IntegerToString(ATRPeriod)) > 0;
      write_success &= FileWrite(file_handle, "Accuracy Multiplier: " + DoubleToString(AccuracyMultiplier, 2)) > 0;
      write_success &= FileWrite(file_handle, "Bars Analyzed: " + IntegerToString(MaxBars)) > 0;
      if(DistanceFromSupport != INT_MAX)
         write_success &= FileWrite(file_handle, "Distance to Support: " + IntegerToString(DistanceFromSupport) + " points") > 0;
      if(DistanceFromResistance != INT_MAX)
         write_success &= FileWrite(file_handle, "Distance to Resistance: " + IntegerToString(DistanceFromResistance) + " points") > 0;
      write_success &= FileWrite(file_handle, "") > 0;  // Empty line for readability
   }
   
   // Write data header
   write_success &= FileWrite(file_handle, "Level_Type\tLevel_Price\tDistance_Points\tLevel_Number") > 0;
   
   // Count and export all levels
   int level_count = 0;
   
   // Export support levels (below current price) - from closest to furthest
   for(int i = ArraySize(Array) - 1; i >= 0; i--)
   {
      if(Array[i] > 0 && Array[i] < currentClose)
      {
         level_count++;
         int distance = int((currentClose - Array[i]) / Point());
         string line = StringFormat("SUPPORT\t%.5f\t%d\t%d",
                                   Array[i],
                                   distance,
                                   level_count);
         write_success &= FileWrite(file_handle, line) > 0;
      }
   }
   
   // Export resistance levels (above current price) - from closest to furthest
   for(int i = 0; i < ArraySize(Array); i++)
   {
      if(Array[i] > currentClose)
      {
         level_count++;
         int distance = int((Array[i] - currentClose) / Point());
         string line = StringFormat("RESISTANCE\t%.5f\t%d\t%d",
                                   Array[i],
                                   distance,
                                   level_count);
         write_success &= FileWrite(file_handle, line) > 0;
      }
   }

   FileClose(file_handle);

   if(!write_success)
   {
      Print("ERROR: Failed to write some data to TXT file");
      return false;
   }

   Print("Support and Resistance levels successfully exported to TXT file: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Export Support and Resistance Levels to JSON file                |
//+------------------------------------------------------------------+
bool ExportSRToJson(const string symbol,
                    const ENUM_TIMEFRAMES timeframe,
                    const string filename)
{
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting SR levels to JSON file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   int error = GetLastError();
   
   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open JSON file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;
   double currentClose = iClose(symbol, PERIOD_CURRENT, 0);
   
   // Write JSON header
   write_success &= FileWrite(file_handle, "{") > 0;
   write_success &= FileWrite(file_handle, "    \"exportType\": \"SupportResistanceLevels\",") > 0;
   write_success &= FileWrite(file_handle, "    \"symbol\": \"", symbol, "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"analysisTimeframe\": \"", EnumToString(SRTimeframe), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"currentPrice\": ", DoubleToString(currentClose, Digits()), ",") > 0;
   write_success &= FileWrite(file_handle, "    \"atrPeriod\": ", ATRPeriod, ",") > 0;
   write_success &= FileWrite(file_handle, "    \"accuracyMultiplier\": ", DoubleToString(AccuracyMultiplier, 2), ",") > 0;
   write_success &= FileWrite(file_handle, "    \"barsAnalyzed\": ", MaxBars, ",") > 0;
   
   if(DistanceFromSupport != INT_MAX)
      write_success &= FileWrite(file_handle, "    \"distanceToSupport\": ", DistanceFromSupport, ",") > 0;
   else
      write_success &= FileWrite(file_handle, "    \"distanceToSupport\": null,") > 0;
      
   if(DistanceFromResistance != INT_MAX)
      write_success &= FileWrite(file_handle, "    \"distanceToResistance\": ", DistanceFromResistance, ",") > 0;
   else
      write_success &= FileWrite(file_handle, "    \"distanceToResistance\": null,") > 0;
   
   write_success &= FileWrite(file_handle, "    \"supportLevels\": [") > 0;
   
   // Export support levels
   bool first_support = true;
   for(int i = ArraySize(Array) - 1; i >= 0; i--)
   {
      if(Array[i] > 0 && Array[i] < currentClose)
      {
         if(!first_support)
            write_success &= FileWrite(file_handle, "        ,") > 0;
         else
            first_support = false;
            
         int distance = int((currentClose - Array[i]) / Point());
         write_success &= FileWrite(file_handle, "        {") > 0;
         write_success &= FileWrite(file_handle, "            \"price\": ", DoubleToString(Array[i], Digits()), ",") > 0;
         write_success &= FileWrite(file_handle, "            \"distancePoints\": ", distance) > 0;
         write_success &= FileWrite(file_handle, "        }") > 0;
      }
   }
   
   write_success &= FileWrite(file_handle, "    ],") > 0;
   write_success &= FileWrite(file_handle, "    \"resistanceLevels\": [") > 0;
   
   // Export resistance levels
   bool first_resistance = true;
   for(int i = 0; i < ArraySize(Array); i++)
   {
      if(Array[i] > currentClose)
      {
         if(!first_resistance)
            write_success &= FileWrite(file_handle, "        ,") > 0;
         else
            first_resistance = false;
            
         int distance = int((Array[i] - currentClose) / Point());
         write_success &= FileWrite(file_handle, "        {") > 0;
         write_success &= FileWrite(file_handle, "            \"price\": ", DoubleToString(Array[i], Digits()), ",") > 0;
         write_success &= FileWrite(file_handle, "            \"distancePoints\": ", distance) > 0;
         write_success &= FileWrite(file_handle, "        }") > 0;
      }
   }
   
   // Close JSON structure
   write_success &= FileWrite(file_handle, "    ]") > 0;
   write_success &= FileWrite(file_handle, "}") > 0;

   FileClose(file_handle);

   if(!write_success)
   {
      Print("ERROR: Failed to write some data to JSON file");
      return false;
   }

   Print("Support and Resistance levels successfully exported to JSON file: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Export Support and Resistance Levels for specific symbol/timeframe |
//+------------------------------------------------------------------+
bool ExportSRLevelsForSymbol(string requested_symbol, ENUM_TIMEFRAMES timeframe)
{
   Print("Exporting SR levels for symbol: '", requested_symbol, "' timeframe: ", EnumToString(timeframe));
   
   // Force symbol selection if needed
   if(!SymbolSelect(requested_symbol, true))
   {
      Print("ERROR: Could not select symbol '", requested_symbol, "' in Market Watch");
      return false;
   }
   
   // Generate filenames using clean symbol name
   string clean_symbol = requested_symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
      
   string txt_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "txt");
   string json_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "json");
   
   Print("Exporting SR levels for ", requested_symbol, " @ ", EnumToString(timeframe));
   Print("Files: ", txt_filename, " and ", json_filename);
   
   // Export to both formats
   bool txt_success = ExportSRToTxt(requested_symbol, timeframe, txt_filename);
   
   bool json_success = true;
   if(InpExportJSON)
      json_success = ExportSRToJson(requested_symbol, timeframe, json_filename);
   
   return txt_success && (InpExportJSON ? json_success : true);
}

//+------------------------------------------------------------------+
//| Export current Support and Resistance Levels                     |
//+------------------------------------------------------------------+
bool ExportSRLevels()
{
   // Get selected symbol
   string requested_symbol = GetSelectedSymbol();
   
   // Use the SR analysis timeframe for export
   ENUM_TIMEFRAMES timeframe = SRTimeframe;
   if(timeframe == PERIOD_CURRENT)
      timeframe = Period();
   
   return ExportSRLevelsForSymbol(requested_symbol, timeframe);
}

//+------------------------------------------------------------------+
//| Execute batch export for multiple symbols and timeframes          |
//+------------------------------------------------------------------+
bool BatchExportSRLevels()
{
   Print("Starting batch export process for SR levels...");
   
   // Parse symbol list
   string symbols[];
   StringSplit(InpBatchSymbols, ',', symbols);
   
   // Parse timeframe list
   string timeframes_str[];
   StringSplit(InpBatchTimeframes, ',', timeframes_str);
   
   if(ArraySize(symbols) == 0 || ArraySize(timeframes_str) == 0)
   {
      Print("ERROR: Empty symbol or timeframe list for batch export");
      return false;
   }
   
   Print("Processing ", ArraySize(symbols), " symbols with ", ArraySize(timeframes_str), " timeframes");
   
   // Convert timeframe strings to ENUM_TIMEFRAMES
   ENUM_TIMEFRAMES timeframes[];
   ArrayResize(timeframes, ArraySize(timeframes_str));
   
   for(int i = 0; i < ArraySize(timeframes_str); i++)
   {
      StringTrimLeft(timeframes_str[i]);
      StringTrimRight(timeframes_str[i]);
      timeframes[i] = StringToTimeframe(timeframes_str[i]);
   }
   
   // Process each symbol-timeframe combination
   int success_count = 0;
   int total_combinations = ArraySize(symbols) * ArraySize(timeframes);
   
   for(int s = 0; s < ArraySize(symbols); s++)
   {
      string symbol = symbols[s];
      StringTrimLeft(symbol);
      StringTrimRight(symbol);
      
      for(int t = 0; t < ArraySize(timeframes); t++)
      {
         Print("Processing ", s*ArraySize(timeframes) + t + 1, "/", total_combinations, 
               ": Symbol='", symbol, "', Timeframe=", EnumToString(timeframes[t]));
               
         if(ExportSRLevelsForSymbol(symbol, timeframes[t]))
            success_count++;
         else if(!InpContinueOnError)
         {
            Print("ERROR: Failed on symbol='", symbol, "', timeframe=", EnumToString(timeframes[t]), 
                  ". Stopping batch process as InpContinueOnError=false");
            return false;
         }
      }
   }
   
   Print("Batch SR export completed: ", success_count, "/", total_combinations, " successful");
   
   return success_count == total_combinations || (InpContinueOnError && success_count > 0);
}

//+------------------------------------------------------------------+
//| Handle chart events for export buttons                            |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   // Check if it's a button click event
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == EXPORT_BUTTON_NAME)
      {
         if(ExportSRLevels())
            Print("SUCCESS: Support and Resistance levels exported successfully");
         else
            Print("ERROR: Failed to export SR levels. See above for details.");

         // Reset button state
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
      else if(sparam == BATCH_EXPORT_BUTTON_NAME)
      {
         if(BatchExportSRLevels())
            Print("SUCCESS: Batch SR export completed successfully");
         else
            Print("WARNING: Batch SR export completed with some errors. See above for details.");
            
         // Reset button state
         ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| ORIGINAL SUPPORT AND RESISTANCE CODE BELOW - UNCHANGED           |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, IndicatorName);

   CleanChart();
   InitializeHandles();

   SetIndexBuffer(0, BufferZero, INDICATOR_DATA);
   SetIndexBuffer(1, BufferOne, INDICATOR_DATA);
   SetIndexBuffer(2, BufferTwo, INDICATOR_DATA);
   SetIndexBuffer(3, BufferThree, INDICATOR_DATA);
   SetIndexBuffer(4, BufferFour, INDICATOR_DATA);
   SetIndexBuffer(5, BufferFive, INDICATOR_DATA);
   SetIndexBuffer(6, BufferSix, INDICATOR_DATA);
   SetIndexBuffer(7, BufferSeven, INDICATOR_DATA);

   ArraySetAsSeries(BufferZero, true);
   ArraySetAsSeries(BufferOne, true);
   ArraySetAsSeries(BufferTwo, true);
   ArraySetAsSeries(BufferThree, true);
   ArraySetAsSeries(BufferFour, true);
   ArraySetAsSeries(BufferFive, true);
   ArraySetAsSeries(BufferSix, true);
   ArraySetAsSeries(BufferSeven, true);

   // Create export buttons if enabled
   if(InpEnableExport)
   {
      CreateExportButton();
      
      if(InpEnableBatchExport)
         CreateBatchExportButton();
   }

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CleanChart()
  {
   ObjectsDeleteAll(0, IndicatorName);
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void InitializeHandles()
  {
   ATRHandle = iATR(NULL, SRTimeframe, ATRPeriod);
   FractalsHandle = iFractals(NULL, SRTimeframe);
   ArraySetAsSeries(BufferFractalsUp, true);
   ArraySetAsSeries(BufferFractalsDown, true);
   ArraySetAsSeries(BufferATR, true);
  }

//+------------------------------------------------------------------+
//|                                                                  |
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
    // Avoid recalculation if nothing has changed
    if (prev_calculated > 0 && rates_total == prev_calculated) 
        return rates_total;

    ArraySetAsSeries(close, true);  // Ensure arrays are set as series
    ArraySetAsSeries(time, true);
    
    MaxBars = MaxBarsExt;
    if (iBars(Symbol(), SRTimeframe) < MaxBars + BarsToIgnore)
    {
        MaxBars = iBars(Symbol(), SRTimeframe) - BarsToIgnore;
        if (MaxBars <= 0) 
        {
            Print("Not enough historical data. Please load more candles.");
            return 0;
        }
    }
    
    // Buffer copying with error checking
    if (CopyBuffer(FractalsHandle, 0, 0, MaxBars, BufferFractalsUp) <= 0 ||
        CopyBuffer(FractalsHandle, 1, 0, MaxBars, BufferFractalsDown) <= 0 ||
        CopyBuffer(ATRHandle, 0, 0, MaxBars, BufferATR) <= 0)
    {
        if (!Waiting)
        {
            Print("Waiting for indicator data to load...");
            Waiting = true;
        }
        return prev_calculated;
    }
    
    if (Waiting)
    {
        Print("Indicator data loaded successfully.");
        Waiting = false;
    }

    // Static variables to track changes
    static datetime lastCalculationTime = 0;
    static double lastClose = 0;
    
    bool needsRecalculation = false;
    
    // Check if we need to recalculate
    if (prev_calculated == 0)  // First calculation
        needsRecalculation = true;
    else if (lastCalculationTime != time[0])  // New bar
        needsRecalculation = true;
    else if (MathAbs(lastClose - close[0]) > Point())  // Significant price change
        needsRecalculation = true;
        
    if (needsRecalculation)
    {
        CalculateLevels();
        lastCalculationTime = time[0];
        lastClose = close[0];
        CalculatedBars = rates_total;
    }
    
    // Calculate levels and distances
    LevelAbove = CalculateLevelAbove();
    LevelBelow = CalculateLevelBelow();
    
    if (LevelAbove > 0) 
        DistanceFromResistance = int((LevelAbove - close[0]) / Point());
    else 
        DistanceFromResistance = INT_MAX;
    
    if (LevelBelow > 0) 
        DistanceFromSupport = int((close[0] - LevelBelow) / Point());
    else 
        DistanceFromSupport = INT_MAX;

    // Update buffers and display
    FillBuffers();
    DisplayDistanceComments();
    
    // Draw lines only when levels change
    static double prevLevelAbove = 0;
    static double prevLevelBelow = 0;
    
    if (prevLevelAbove != LevelAbove || prevLevelBelow != LevelBelow)
    {
        if (DrawLinesEnabled) 
        {
            DrawLines();
            prevLevelAbove = LevelAbove;
            prevLevelBelow = LevelBelow;
        }
    }
    
    return rates_total;
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void DisplayDistanceComments()
  {
   string commentText = "Support/Resistance Lines Distance Info:\n";

   if(DistanceFromResistance != INT_MAX)
      commentText += "Distance to Resistance: " + IntegerToString(DistanceFromResistance) + " points\n";
   else
      commentText += "No resistance level found\n";

   if(DistanceFromSupport != INT_MAX)
      commentText += "Distance to Support: " + IntegerToString(DistanceFromSupport) + " points";
   else
      commentText += "No support level found";

   Comment(commentText);
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CalculateLevels()
{
    double Highest = iHigh(NULL, SRTimeframe, iHighest(NULL, SRTimeframe, MODE_HIGH, MaxBars, 0));
    double Lowest = iLow(NULL, SRTimeframe, iLowest(NULL, SRTimeframe, MODE_LOW, MaxBars, 0));
    double Step = NormalizeDouble(BufferATR[0] * AccuracyMultiplier, Digits());

    if(Step == 0)
    {
        Print("Not enough historical data, please load more candles.");
        return;
    }

    int Steps = (int)MathCeil((Highest - Lowest) / Step) + 1;
    ArrayResize(Array, Steps);
    ArrayInitialize(Array, 0);

    for(int i = 0; i < ArraySize(Array); i++)
    {
        double StartRange = Lowest + Step * i;
        double EndRange = Lowest + Step * (i + 1);
        int BarCount = 0;
        double TotalPrice = 0;

        for(int j = BarsToIgnore; j < MaxBars + BarsToIgnore; j++)
        {
            double Fractal = 0;
            if(BufferFractalsUp[j - BarsToIgnore] != EMPTY_VALUE) 
                Fractal = BufferFractalsUp[j - BarsToIgnore];
            else if(BufferFractalsDown[j - BarsToIgnore] != EMPTY_VALUE) 
                Fractal = BufferFractalsDown[j - BarsToIgnore];

            if(Fractal >= StartRange && Fractal <= EndRange)
            {
                BarCount++;
                TotalPrice += Fractal;
            }
        }
        
        if(BarCount > 0) 
        {
            Array[i] = NormalizeDouble(TotalPrice / BarCount, Digits());
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void FillBuffers()
{
    // Initialize buffers
    BufferZero[0] = 0;
    BufferOne[0] = 0;
    BufferTwo[0] = 0;
    BufferThree[0] = 0;
    BufferFour[0] = 0;
    BufferFive[0] = 0;
    BufferSix[0] = 0;
    BufferSeven[0] = 0;

    double currentClose = iClose(Symbol(), PERIOD_CURRENT, 0);

    // Fill resistance levels (above current price)
    int j = 0;
    for(int i = 0; i < ArraySize(Array); i++)
    {
        if(Array[i] > currentClose)
        {
            switch(j)
            {
                case 0: BufferFour[0] = NormalizeDouble(Array[i], Digits()); break;
                case 1: BufferFive[0] = NormalizeDouble(Array[i], Digits()); break;
                case 2: BufferSix[0] = NormalizeDouble(Array[i], Digits()); break;
                case 3: BufferSeven[0] = NormalizeDouble(Array[i], Digits()); break;
            }
            j++;
            if(j == 4) break;
        }
    }

    // Fill support levels (below current price)
    j = 0;
    for(int i = ArraySize(Array) - 1; i >= 0; i--)
    {
        if(Array[i] > 0 && Array[i] < currentClose)
        {
            switch(j)
            {
                case 0: BufferThree[0] = NormalizeDouble(Array[i], Digits()); break;
                case 1: BufferTwo[0] = NormalizeDouble(Array[i], Digits()); break;
                case 2: BufferOne[0] = NormalizeDouble(Array[i], Digits()); break;
                case 3: BufferZero[0] = NormalizeDouble(Array[i], Digits()); break;
            }
            j++;
            if(j == 4) break;
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CleanLines()
  {
   ObjectsDeleteAll(0, IndicatorName + "-HLINE-");
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void DrawLines()
{
    CleanLines();  
    double currentClose = iClose(Symbol(), PERIOD_CURRENT, 0);

    for(int i = 0; i < ArraySize(Array); i++)
    {
        if(Array[i] > 0)
        {
            int LineNumber = int(Array[i] / Point());
            string LineName = IndicatorName + "-HLINE-" + IntegerToString(LineNumber);
            
            bool isResistance = (Array[i] > currentClose);
            color Color = isResistance ? ResistanceColor : SupportColor;
            ENUM_LINE_STYLE Style = isResistance ? ResistanceStyle : SupportStyle;
            
            ObjectCreate(0, LineName, OBJ_HLINE, 0, 0, Array[i]);
            ObjectSetInteger(0, LineName, OBJPROP_COLOR, Color);
            ObjectSetInteger(0, LineName, OBJPROP_STYLE, Style);
            ObjectSetInteger(0, LineName, OBJPROP_WIDTH, LineThickness);
            ObjectSetInteger(0, LineName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, LineName, OBJPROP_RAY_RIGHT, true);
        }
    }
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double CalculateLevelAbove()
  {
   double Level = 0;
   for(int i = 0; i < ArraySize(Array); i++)
     {
      if(Array[i] >= iClose(Symbol(), PERIOD_CURRENT, 0))
        {
         Level = NormalizeDouble(Array[i], Digits());
         break;
        }
     }
   return Level;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double CalculateLevelBelow()
  {
   double Level = 0;
   for(int i = ArraySize(Array) - 1; i >= 0; i--)
     {
      if((Array[i] > 0) && (Array[i] <= iClose(Symbol(), PERIOD_CURRENT, 0)))
        {
         Level = NormalizeDouble(Array[i], Digits());
         break;
        }
     }
   return Level;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   CleanChart();
   Comment("");  // Clear comments
   
   // Delete export buttons if they exist
   if(InpEnableExport)
   {
      ObjectDelete(0, EXPORT_BUTTON_NAME);
      
      if(InpEnableBatchExport)
         ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);
   }
  }