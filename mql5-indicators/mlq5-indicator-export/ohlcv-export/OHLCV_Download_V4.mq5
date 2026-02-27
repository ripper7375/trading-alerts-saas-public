//+------------------------------------------------------------------+
//|                                          OHLCV_Download.mq5        |
//|                                    Copyright 2025, Your Name     |
//|                                       https://www.yourwebsite.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.03"
#property description "OHLCV Data Export with ZigZagColor Compatibility - Enhanced with Symbol Mapping and Volume"
#property indicator_chart_window
#property indicator_plots 0

//--- Button name constant
#define EXPORT_BUTTON_NAME "DataExportButton"
#define BATCH_EXPORT_BUTTON_NAME "BatchExportButton"

// Symbol selection options
enum ENUM_SYMBOL_SELECTION {
   SYMBOL_CURRENT = 0,        // Current chart symbol
   SYMBOL_MANUAL_ENTRY = 1    // Enter manually
};

// Input parameters
input ENUM_SYMBOL_SELECTION InpSymbolSelection = SYMBOL_CURRENT;  // Symbol Selection
input string                InpManualSymbol = "";                 // Manual Symbol Entry (if "Enter manually")
input ENUM_TIMEFRAMES      InpTimeframe = PERIOD_CURRENT;        // Timeframe
input int                  InpBars = 500;                       // Number of bars to export
input string               InpBaseFileName = "PriceData";        // Base file name
input bool                 InpForceTimeframe = true;            // Force timeframe if validation fails
input bool                 InpIncludeMetadata = false;           // Include metadata in TXT export
input bool                 InpExportJSON = false;                 // Export JSON file
input bool                 InpCleanFilenames = true;             // Clean filenames (no .txt extension)
input bool                 InpForceSymbolDownload = true;        // Force download symbol history
input bool                 InpContinueOnError = true;            // Continue batch on error
input bool                 InpTryBothSuffixVersions = true;      // Try both with/without .i suffix
input string               InpSymbolMapping = "USDJPY=USDJPY.i;GBPUSD=GBPUSD.i"; // Symbol mappings (format: "name=actual;")

// Batch export parameters
input bool                 InpEnableBatchExport = false;          // Enable batch export button
input string               InpBatchSymbols = "BTCUSD,EURUSD,USDJPY"; // Symbols for batch export
input string               InpBatchTimeframes = "M15,H1,H4";     // Timeframes for batch export

//+------------------------------------------------------------------+
//| Generate clean filename with symbol and timeframe                 |
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
   
   // For compatibility with ZigZagColor, we can optionally omit the .txt extension
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
//| Convert timeframe enum to short string                            |
//+------------------------------------------------------------------+
string GetTFStr(ENUM_TIMEFRAMES tf)
  {
   switch(tf)
     {
      case PERIOD_M1:  return "M1";
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H4:  return "H4";
      case PERIOD_D1:  return "D1";
      default: return EnumToString(tf);
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator initialization function                          |
//+------------------------------------------------------------------+
int OnInit()
{
   CreateExportButton();
   
   if(InpEnableBatchExport)
      CreateBatchExportButton();
      
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Create Export Button with proper styling                          |
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
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Data");
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
   ObjectSetString(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Batch Export");
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
//| Get selected symbol                                               |
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
//| Process symbol name with mapping support                          |
//+------------------------------------------------------------------+
string GetMappedSymbol(string baseSymbol)
{
   // First check if we have an explicit mapping for this symbol
   if(InpSymbolMapping != "")
   {
      string mappings[];
      StringSplit(InpSymbolMapping, ';', mappings);
      
      for(int i = 0; i < ArraySize(mappings); i++)
      {
         string map[];
         if(StringSplit(mappings[i], '=', map) == 2)
         {
            StringTrimRight(map[0]);
            StringTrimLeft(map[0]);
            StringTrimRight(map[1]);
            StringTrimLeft(map[1]);
            
            if(StringCompare(map[0], baseSymbol, false) == 0)  // Case-insensitive comparison
            {
               Print("Using mapped symbol: '", baseSymbol, "' → '", map[1], "'");
               return map[1];
            }
         }
      }
   }
   
   // No mapping found, use standard processing
   return ProcessSymbolName(baseSymbol);
}

//+------------------------------------------------------------------+
//| Process symbol name based on type (original version preserved)    |
//+------------------------------------------------------------------+
string ProcessSymbolName(string symbol)
{
   // If symbol already has a .i suffix, keep it as is
   if(StringFind(symbol, ".i") >= 0)
      return symbol;
      
   // Check if it's a standard forex pair (6 letters, currency pair format)
   // Forex pairs like EURUSD, USDJPY, GBPCHF need .i suffix
   if(StringLen(symbol) == 6 && IsForexPair(symbol))
   {
      Print("Adding .i suffix to forex pair: ", symbol);
      return symbol + ".i";
   }
   
   // For non-forex symbols (metals, indices, etc.), use as is
   return symbol;
}

//+------------------------------------------------------------------+
//| Try symbol with both variants                                     |
//+------------------------------------------------------------------+
bool TrySymbolVariants(string baseSymbol, ENUM_TIMEFRAMES timeframe, string &workingSymbol)
{
   string symbolVariants[2];
   int variantCount = 1;
   
   // First check for explicit mapping
   symbolVariants[0] = GetMappedSymbol(baseSymbol);
   
   // If the processed name is different and we're set to try both, add the original version
   // But only if it's not an explicit mapping (to avoid overriding explicit mappings)
   string processedSymbol = ProcessSymbolName(baseSymbol);
   if(InpTryBothSuffixVersions && symbolVariants[0] == processedSymbol && symbolVariants[0] != baseSymbol) {
      symbolVariants[1] = baseSymbol;
      variantCount = 2;
   }
   // If original doesn't have .i but we should try both, add the .i version
   else if(InpTryBothSuffixVersions && StringFind(baseSymbol, ".i") < 0 && StringLen(baseSymbol) == 6 && IsForexPair(baseSymbol)) {
      symbolVariants[1] = baseSymbol + ".i";
      variantCount = 2;
   }
   
   // Try each variant
   for(int i = 0; i < variantCount; i++) {
      // First, try to select the symbol in Market Watch
      if(SymbolSelect(symbolVariants[i], true)) {
         // Force symbol data download if needed
         if(InpForceSymbolDownload) {
            Print("Forcing symbol data download for: ", symbolVariants[i]);
            // This line causes MT5 to download history data
            int unused = iBars(symbolVariants[i], timeframe);
         }
         
         // Check if timeframe is available
         datetime test_time[1];
         ResetLastError();
         if(CopyTime(symbolVariants[i], timeframe, 0, 1, test_time) > 0) {
            workingSymbol = symbolVariants[i];
            Print("Successfully validated symbol: ", workingSymbol, " for timeframe ", EnumToString(timeframe));
            return true;
         }
         else {
            int error = GetLastError();
            Print("Timeframe check failed for variant ", i+1, ": ", symbolVariants[i], ", Error: ", error);
         }
      }
      else {
         Print("Failed to select symbol: ", symbolVariants[i]);
      }
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Check if a symbol is a standard forex pair                        |
//+------------------------------------------------------------------+
bool IsForexPair(string symbol)
{
   // Common forex currency codes
   string currencies[] = {"USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"};
   
   // Check if the symbol is 6 characters and both parts are valid currencies
   if(StringLen(symbol) == 6)
   {
      string first = StringSubstr(symbol, 0, 3);
      string second = StringSubstr(symbol, 3, 3);
      
      bool first_is_currency = false;
      bool second_is_currency = false;
      
      // Check if both parts are in the currency list
      for(int i = 0; i < ArraySize(currencies); i++)
      {
         if(first == currencies[i])
            first_is_currency = true;
         if(second == currencies[i])
            second_is_currency = true;
      }
      
      return first_is_currency && second_is_currency;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Check if a timeframe is available for a symbol - Simplified       |
//+------------------------------------------------------------------+
bool IsTimeframeAvailable(string symbol, ENUM_TIMEFRAMES timeframe)
{
   Print("Checking if timeframe ", EnumToString(timeframe), " is available for symbol '", symbol, "'");
   
   // Force selection of the symbol
   if(!SymbolSelect(symbol, true))
   {
      Print("ERROR: Could not select symbol '", symbol, "' in Market Watch");
      return false;
   }
   
   // If we want to force download symbol data
   if(InpForceSymbolDownload)
   {
      Print("Forcing symbol data download for: ", symbol);
      // This line causes MT5 to download history data
      int bars = iBars(symbol, timeframe);
   }
   
   // Try direct copy - the only check we do now, we don't look for alternatives
   datetime test_time[1];
   ResetLastError();
   if(CopyTime(symbol, timeframe, 0, 1, test_time) > 0)
   {
      Print("Timeframe ", EnumToString(timeframe), " is directly available");
      return true;
   }
   
   int error = GetLastError();
   Print("Timeframe check failed with error: ", error);
   
   // If forcing timeframe, ignore validation failure
   if(InpForceTimeframe)
   {
      Print("Forcing use of timeframe ", EnumToString(timeframe), " despite validation failure");
      return true;
   }
   
   // Return false - we won't suggest alternatives anymore
   return false;
}

//+------------------------------------------------------------------+
//| Convert timeframe string to ENUM_TIMEFRAMES                       |
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
//| ChartEvent function to handle button clicks                       |
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
         if(ExportPriceData())
            Print("SUCCESS: Price data exported successfully");
         else
            Print("ERROR: Failed to export price data. See above for details.");

         // Reset button state
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
      else if(sparam == BATCH_EXPORT_BUTTON_NAME)
      {
         if(BatchExportPriceData())
            Print("SUCCESS: Batch export completed successfully");
         else
            Print("WARNING: Batch export completed with some errors. See above for details.");
            
         // Reset button state
         ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Execute batch export for multiple symbols and timeframes          |
//+------------------------------------------------------------------+
bool BatchExportPriceData()
{
   Print("Starting batch export process...");
   
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
               
         if(ExportPriceDataForSymbol(symbol, timeframes[t]))
            success_count++;
         else if(!InpContinueOnError)
         {
            Print("ERROR: Failed on symbol='", symbol, "', timeframe=", EnumToString(timeframes[t]), 
                  ". Stopping batch process as InpContinueOnError=false");
            return false;
         }
      }
   }
   
   Print("Batch export completed: ", success_count, "/", total_combinations, " successful");
   
   // Consider batch successful if we're continuing on error and at least one export succeeded
   return success_count == total_combinations || (InpContinueOnError && success_count > 0);
}

//+------------------------------------------------------------------+
//| Export price data for a specific symbol and timeframe             |
//+------------------------------------------------------------------+
bool ExportPriceDataForSymbol(string requested_symbol, ENUM_TIMEFRAMES timeframe)
{
   Print("Requested symbol: '", requested_symbol, "'");
   
   // Try both symbol variants if needed
   string working_symbol = "";
   if(!TrySymbolVariants(requested_symbol, timeframe, working_symbol))
   {
      Print("ERROR: No valid symbol/timeframe combination found for '", requested_symbol, 
            "' at ", EnumToString(timeframe));
      return false;
   }
   
   Print("Using symbol: '", working_symbol, "' with timeframe: ", EnumToString(timeframe));
      
   // Determine how many bars to export
   int bars_to_export = InpBars;
   if(bars_to_export <= 0)
      bars_to_export = 1000;
      
   // Check available bars
   ResetLastError();
   int max_bars = iBars(working_symbol, timeframe);
   int error = GetLastError();
   
   if(max_bars <= 0)
   {
      Print("ERROR: No bars available for symbol '", working_symbol, "' with timeframe ", 
            EnumToString(timeframe), ". Error: ", error);
      return false;
   }
   
   if(bars_to_export > max_bars)
   {
      bars_to_export = max_bars;
      Print("Reduced requested bars to maximum available: ", bars_to_export);
   }
   
   // Generate filenames - use clean symbol name without suffix
   string clean_symbol = working_symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);
      
   string txt_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "txt");
   string json_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "json");
      
   Print("Exporting ", bars_to_export, " bars of ", working_symbol, " @ ", EnumToString(timeframe));
   Print("Files: ", txt_filename, " and ", json_filename);
   
   // Get the data
   datetime time[];
   double open[], high[], low[], close[];
   long   volume[];
   
   ArraySetAsSeries(time, true);
   ArraySetAsSeries(open, true);
   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);
   ArraySetAsSeries(close,  true);
   ArraySetAsSeries(volume, true);
   
   // Copy data with multiple attempts if needed
   bool data_copied = false;
   
   for(int attempts = 0; attempts < 5; attempts++)
   {
      if(attempts > 0)
      {
         Print("Retry attempt ", attempts, " for '", working_symbol, "'");
         Sleep(200 * attempts);
      }
      
      // Copy time data
      ResetLastError();
      int time_copied = CopyTime(working_symbol, timeframe, 0, bars_to_export, time);
      error = GetLastError();
      
      if(time_copied != bars_to_export)
      {
         Print("Failed copying time data. Requested: ", bars_to_export, 
               ", Got: ", time_copied, ", Error: ", error);
         continue;
      }
      
      // Copy price data
      ResetLastError();
      int open_copied = CopyOpen(working_symbol, timeframe, 0, bars_to_export, open);
      if(open_copied != bars_to_export) continue;
      
      ResetLastError();
      int high_copied = CopyHigh(working_symbol, timeframe, 0, bars_to_export, high);
      if(high_copied != bars_to_export) continue;
      
      ResetLastError();
      int low_copied = CopyLow(working_symbol, timeframe, 0, bars_to_export, low);
      if(low_copied != bars_to_export) continue;
      
      ResetLastError();
      int close_copied = CopyClose(working_symbol, timeframe, 0, bars_to_export, close);
      if(close_copied != bars_to_export) continue;
      
      ResetLastError();
      int volume_copied = CopyTickVolume(working_symbol, timeframe, 0, bars_to_export, volume);
      if(volume_copied != bars_to_export) continue;
      
      // All data copied successfully
      data_copied = true;
      Print("Successfully copied all data on attempt ", attempts+1);
      break;
   }
   
   if(!data_copied)
   {
      Print("CRITICAL: Failed to copy data after multiple attempts");
      return false;
   }
   
   // Export the data to both formats
   bool txt_success = ExportToTxt(working_symbol, timeframe, txt_filename, time, open, high, low, close, volume, bars_to_export);
   
   bool json_success = true;
   if(InpExportJSON)
      json_success = ExportToJson(working_symbol, timeframe, json_filename, time, open, high, low, close, volume, bars_to_export);
   
   return txt_success && (InpExportJSON ? json_success : true);
}

//+------------------------------------------------------------------+
//| Export all price data to both formats                             |
//+------------------------------------------------------------------+
bool ExportPriceData()
{
   // Get selected symbol
   string requested_symbol = GetSelectedSymbol();
   
   // Determine which timeframe to use
   ENUM_TIMEFRAMES timeframe = InpTimeframe;
   if(timeframe == PERIOD_CURRENT)
      timeframe = Period();
   
   return ExportPriceDataForSymbol(requested_symbol, timeframe);
}

//+------------------------------------------------------------------+
//| Export price data to TXT file                                     |
//+------------------------------------------------------------------+
bool ExportToTxt(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[], 
                 const double &open[],
                 const double &high[],
                 const double &low[],
                 const double &close[],
                 const long   &volume[],
                 const int bars_count)
{
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting to TXT file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   int error = GetLastError();
   
   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open TXT file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;
   
   // Write metadata header if requested
   if(InpIncludeMetadata)
   {
      write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
      write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
      write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
      write_success &= FileWrite(file_handle, "Number of Bars: " + IntegerToString(bars_count)) > 0;
      write_success &= FileWrite(file_handle, "") > 0;  // Empty line for readability
   }
   
   // Write data header
   write_success &= FileWrite(file_handle, "timestamp\tsymbol\ttimeframe\tclose\topen\thigh\tlow\tvolume") > 0;

   // Write data rows
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   for(int i = bars_count-1; i >= 0; i--)
   {
      string line = StringFormat("%I64d\t%s\t%s\t%.2f\t%.2f\t%.2f\t%.2f\t%d",
                              (long)(time[i] - gmt_offset),
                              symbol,
                              GetTFStr(timeframe),
                              close[i],
                              open[i],
                              high[i],
                              low[i],
                              volume[i]);
                              
      write_success &= FileWrite(file_handle, line) > 0;
   }

   FileClose(file_handle);

   if(!write_success)
   {
      Print("ERROR: Failed to write some data to TXT file");
      return false;
   }

   Print("Price data successfully exported to TXT file: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Export price data to JSON file                                    |
//+------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[], 
                 const double &open[],
                 const double &high[],
                 const double &low[],
                 const double &close[],
                 const long   &volume[],
                 const int bars_count)
{
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting to JSON file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   int error = GetLastError();
   
   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open JSON file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;
   
   // Write JSON header
   write_success &= FileWrite(file_handle, "{") > 0;
   write_success &= FileWrite(file_handle, "    \"symbol\": \"", symbol, "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"bars\": ", bars_count, ",") > 0;
   write_success &= FileWrite(file_handle, "    \"data\": [") > 0;
   
   // Write data rows
   for(int i = 0; i < bars_count; i++)
   {
      if(i > 0)
         FileWrite(file_handle, "        ,");
         
      write_success &= FileWrite(file_handle, "        {") > 0;
      write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
         write_success &= FileWrite(file_handle, "            \"symbol\": \"", symbol, "\",") > 0;
         write_success &= FileWrite(file_handle, "            \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
      write_success &= FileWrite(file_handle, "            \"open\": ", DoubleToString(open[i], 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"high\": ", DoubleToString(high[i], 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"low\": ", DoubleToString(low[i], 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"close\": ", DoubleToString(close[i], 5), ",") > 0;
         write_success &= FileWrite(file_handle, "            \"volume\": ", volume[i]) > 0;
      write_success &= FileWrite(file_handle, "        }") > 0;
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

   Print("Price data successfully exported to JSON file: ", filename);
   return true;
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                        |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Delete export button
   ObjectDelete(0, EXPORT_BUTTON_NAME);

   // Always attempt to delete batch export button
   ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);

   // Force chart redraw to visually remove deleted objects
   ChartRedraw(0);
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
   // This is a non-plotting indicator that only exports data
   // No calculations needed in this function
   return(rates_total);
}
//+------------------------------------------------------------------+