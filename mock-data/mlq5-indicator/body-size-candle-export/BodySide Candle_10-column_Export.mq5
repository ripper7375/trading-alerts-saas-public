//+------------------------------------------------------------------+
//|                                     OHLC_Download_10Column.mq5   |
//|                                      Copyright 2025, Your Name   |
//|                                       https://www.yourwebsite.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "OHLC Data Export with Z-Score and Integer Candle Classification (0-5)"
#property indicator_chart_window
#property indicator_plots 0

//--- Button name constants
#define EXPORT_BUTTON_NAME "DataExportButton"
#define BATCH_EXPORT_BUTTON_NAME "BatchExportButton"

// Symbol selection options
enum ENUM_SYMBOL_SELECTION {
   SYMBOL_CURRENT = 0,              // Current chart symbol
   SYMBOL_MANUAL_ENTRY = 1          // Enter manually
};

// Input parameters
input ENUM_SYMBOL_SELECTION InpSymbolSelection = SYMBOL_CURRENT;    // Symbol Selection
input string                InpManualSymbol = "";                   // Manual Symbol Entry (if "Enter manually")
input ENUM_TIMEFRAMES      InpTimeframe = PERIOD_CURRENT;           // Timeframe
input int                  InpBars = 20000;                         // Number of bars to export
input string               InpBaseFileName = "BodySizeCandle";      // Base file name
input bool                 InpForceTimeframe = true;                // Force timeframe if validation fails
input bool                 InpIncludeMetadata = false;              // Include metadata in TXT export
input bool                 InpExportJSON = false;                   // Export JSON file
input bool                 InpCleanFilenames = true;                // Clean filenames (no .txt extension)
input bool                 InpForceSymbolDownload = true;           // Force download symbol history
input bool                 InpContinueOnError = true;               // Continue batch on error
input bool                 InpTryBothSuffixVersions = true;         // Try both with/without .i suffix
input string               InpSymbolMapping = "USDJPY=USDJPY.i;GBPUSD=GBPUSD.i"; // Symbol mappings (format: "name=actual;")

// Body Size Candle parameters
input ENUM_TIMEFRAMES      InpBaseTimeFrame = PERIOD_H1;            // Base Time Frame for Body Size
input int                  InpZScoreLength = 52;                    // Z-Score MA Length
input double               InpThresholdZ1 = 1.5;                    // Threshold z1
input double               InpThresholdZ2 = 2.5;                    // Threshold z2

// Batch export parameters
input bool                 InpEnableBatchExport = false;            // Enable batch export button
input string               InpBatchSymbols = "BTCUSD,EURUSD,USDJPY"; // Symbols for batch export
input string               InpBatchTimeframes = "M15,H1,H4";        // Timeframes for batch export

// Global variables for Body Size calculation
int baseTimeframeMinutes;

//+------------------------------------------------------------------+
//| Generate clean filename with symbol and timeframe                |
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
//| Function to get integer candle classification (0-5)              |
//+------------------------------------------------------------------+
int GetCandleClassification(double zScore, bool isBullish)
{
   if(isBullish)  // Bullish candle
   {
      if(zScore >= InpThresholdZ2)
         return 2;  // TYPE_UP_EXTREME
      else if(zScore >= InpThresholdZ1)
         return 1;  // TYPE_UP_LARGE
      else
         return 0;  // TYPE_UP_NORMAL
   }
   else  // Bearish candle
   {
      if(zScore >= InpThresholdZ2)
         return 5;  // TYPE_DOWN_EXTREME
      else if(zScore >= InpThresholdZ1)
         return 4;  // TYPE_DOWN_LARGE
      else
         return 3;  // TYPE_DOWN_NORMAL
   }
}

//+------------------------------------------------------------------+
//| Calculate body sizes, z-scores and determine candle classifications |
//+------------------------------------------------------------------+
void CalculateBodySizeCandles(const datetime &time[],
                              const double &open[],
                              const double &close[],
                              const int bars_count,
                              double &zScores[],
                              int &classifications[])
{
   ArrayResize(zScores, bars_count);
   ArrayResize(classifications, bars_count);

   // Calculate body sizes for all bars
   double bodySizes[];
   ArrayResize(bodySizes, bars_count);

   for(int i = 0; i < bars_count; i++)
   {
      bodySizes[i] = MathAbs(close[i] - open[i]);
   }

   // Minimum bars needed for meaningful calculation (at least 10)
   int minBarsForCalc = 10;

   // Calculate z-scores and determine candle classifications
   for(int i = 0; i < bars_count; i++)
   {
      // Default to 0.0 z-score and normal classification
      zScores[i] = 0.0;
      bool isBullish = close[i] >= open[i];
      classifications[i] = isBullish ? 0 : 3;  // TYPE_UP_NORMAL or TYPE_DOWN_NORMAL

      // Calculate available lookback (minimum of i or InpZScoreLength)
      int lookback = MathMin(i, InpZScoreLength);

      // Skip if not enough historical data for meaningful calculation
      if(lookback < minBarsForCalc)
         continue;

      // Z-Score calculation - use all available bars in lookback window
      double sum = 0, sum2 = 0;
      int validBars = 0;

      for(int j = 0; j <= lookback; j++)
      {
         // Include all bars in the lookback window
         // Note: Removed base timeframe alignment check for simplicity and accuracy
         sum += bodySizes[i-j];
         sum2 += bodySizes[i-j] * bodySizes[i-j];
         validBars++;
      }

      if(validBars > 1)  // Need at least 2 bars for variance calculation
      {
         double mean = sum / validBars;
         double variance = (sum2 - sum * mean) / (validBars - 1);
         double stdDev = MathSqrt(variance);

         // Calculate Z-Score for current candle
         zScores[i] = stdDev != 0 ? (bodySizes[i] - mean) / stdDev : 0;

         // Determine candle classification (0-5)
         classifications[i] = GetCandleClassification(zScores[i], isBullish);
      }
   }
}

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   // Calculate base timeframe in minutes
   baseTimeframeMinutes = PeriodSeconds(InpBaseTimeFrame) / 60;

   CreateExportButton();

   if(InpEnableBatchExport)
      CreateBatchExportButton();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Create Export Button with proper styling                         |
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
//| Create Batch Export Button                                       |
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
   int y_margin = 160;          // Position below the first button

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
//| Get error description                                            |
//+------------------------------------------------------------------+
string ErrorDescription(int error_code)
{
   switch(error_code)
   {
      case 4401: return "Requested history not found";
      case 4066: return "Requested history not found or timeout";
      case 4014: return "System is busy";
      case 4073: return "Cannot open file";
      case 5040: return "Invalid symbol";
      case 4002: return "Wrong parameter in the function";
      default: return "Error code " + IntegerToString(error_code);
   }
}

//+------------------------------------------------------------------+
//| Get selected symbol                                              |
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
         if(symbol == "") symbol = Symbol();  // Default to current if empty
         break;

      default:
         symbol = Symbol();  // Fallback to current
   }

   return symbol;
}

//+------------------------------------------------------------------+
//| Detect broker-specific symbol name                               |
//+------------------------------------------------------------------+
string DetectBrokerSymbol(string base_symbol)
{
   // Try exact match first
   if(SymbolSelect(base_symbol, true))
      return base_symbol;

   // Try common suffixes
   string suffixes[] = {".i", ".a", ".raw", ".pro", ".ecn", ".m", "", "m", "f"};

   for(int i = 0; i < ArraySize(suffixes); i++)
   {
      string test_symbol = base_symbol + suffixes[i];
      if(SymbolSelect(test_symbol, true))
         return test_symbol;
   }

   return "";
}

//+------------------------------------------------------------------+
//| Force download symbol history                                    |
//+------------------------------------------------------------------+
bool ForceDownloadSymbolHistory(string symbol, ENUM_TIMEFRAMES timeframe, int bars_needed)
{
   if(!InpForceSymbolDownload)
      return true;

   Print("Forcing download of ", bars_needed, " bars for ", symbol, " @ ", EnumToString(timeframe));

   // Create temporary array for time data
   datetime time_array[];

   // Request data download using position-based CopyTime
   int copied = CopyTime(symbol, timeframe, 0, bars_needed, time_array);

   if(copied <= 0)
   {
      Print("WARNING: Failed to download history. Error: ", GetLastError());
      return false;
   }

   Print("Successfully downloaded ", copied, " bars");
   return true;
}

//+------------------------------------------------------------------+
//| Export price data to TXT file (10 columns)                       |
//+------------------------------------------------------------------+
bool ExportToTxt(const string symbol,
                const ENUM_TIMEFRAMES timeframe,
                const string filename,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const int bars_count)
{
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting to TXT file: ", full_path);

   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   int error = GetLastError();

   if(file_handle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to open TXT file for writing. Error: ", error);
      return false;
   }

   bool write_success = true;

   // Calculate z-scores and classifications
   double zScores[];
   int classifications[];
   CalculateBodySizeCandles(time, open, close, bars_count, zScores, classifications);

   // Write metadata header if requested
   if(InpIncludeMetadata)
   {
      write_success &= FileWrite(file_handle, "Symbol: " + symbol) > 0;
      write_success &= FileWrite(file_handle, "Timeframe: " + EnumToString(timeframe)) > 0;
      write_success &= FileWrite(file_handle, "Export Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) > 0;
      write_success &= FileWrite(file_handle, "Number of Bars: " + IntegerToString(bars_count)) > 0;
      write_success &= FileWrite(file_handle, "") > 0;  // Empty line for readability
   }

   // Write data header - 10 columns
   write_success &= FileWrite(file_handle, "No\tTimeStamp\tSymbol\tTimeframe\tOpen\tHigh\tLow\tClose\tZ-Score of body size\tCandle classification") > 0;

   // Write data rows
   for(int i = 0; i < bars_count; i++)
   {
      string line = StringFormat("%d\t%s\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%d",
                                i,
                                TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                                symbol,
                                EnumToString(timeframe),
                                open[i],
                                high[i],
                                low[i],
                                close[i],
                                zScores[i],
                                classifications[i]);

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
//| Export price data to JSON file (10 columns)                      |
//+------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                const ENUM_TIMEFRAMES timeframe,
                const string filename,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
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

   // Calculate z-scores and classifications
   double zScores[];
   int classifications[];
   CalculateBodySizeCandles(time, open, close, bars_count, zScores, classifications);

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
      write_success &= FileWrite(file_handle, "            \"zScore\": ", DoubleToString(zScores[i], 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"classification\": ", classifications[i]) > 0;
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
//| Export price data for a specific symbol and timeframe            |
//+------------------------------------------------------------------+
bool ExportPriceDataForSymbol(string requested_symbol, ENUM_TIMEFRAMES timeframe)
{
   Print("====== Starting Export ======");
   Print("Requested Symbol: ", requested_symbol);
   Print("Timeframe: ", EnumToString(timeframe));
   Print("Bars to export: ", InpBars);

   // Resolve PERIOD_CURRENT to actual timeframe
   ENUM_TIMEFRAMES working_timeframe = timeframe;
   if(timeframe == PERIOD_CURRENT || timeframe == 0)
   {
      working_timeframe = Period();
      Print("Resolved PERIOD_CURRENT to: ", EnumToString(working_timeframe));
   }

   // Detect actual broker symbol name
   string working_symbol = DetectBrokerSymbol(requested_symbol);

   if(working_symbol == "")
   {
      Print("ERROR: Symbol not found: ", requested_symbol);
      return false;
   }

   Print("Working Symbol: ", working_symbol);

   // Ensure symbol is selected in Market Watch
   if(!SymbolSelect(working_symbol, true))
   {
      Print("WARNING: Failed to select symbol in Market Watch");
   }

   // Check if symbol data is available
   int bars_available = Bars(working_symbol, working_timeframe);
   Print("Bars available: ", bars_available);

   if(bars_available <= 0)
   {
      Print("ERROR: No bars available for ", working_symbol, " @ ", EnumToString(working_timeframe));
      Print("Please ensure the symbol has historical data loaded.");
      Print("Try opening a chart with this symbol and timeframe first.");
      return false;
   }

   // Force download history if enabled
   if(!ForceDownloadSymbolHistory(working_symbol, working_timeframe, InpBars))
   {
      Print("WARNING: Failed to download additional history, continuing with available data...");
   }

   // Prepare arrays
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   // Copy data - use minimum of requested and available
   int bars_to_copy = MathMin(InpBars, bars_available);
   Print("Attempting to copy ", bars_to_copy, " bars...");

   // Copy data
   int bars_copied = CopyRates(working_symbol, working_timeframe, 0, bars_to_copy, rates);

   if(bars_copied <= 0)
   {
      int error_code = GetLastError();
      Print("ERROR: Failed to copy rates. Error: ", error_code);
      Print("Error description: ", ErrorDescription(error_code));
      return false;
   }

   int bars_to_export = bars_copied;
   Print("Successfully copied ", bars_to_export, " bars of ", working_symbol, " @ ", EnumToString(working_timeframe));

   // Extract data into separate arrays
   datetime time[];
   double open[], high[], low[], close[];

   ArrayResize(time, bars_to_export);
   ArrayResize(open, bars_to_export);
   ArrayResize(high, bars_to_export);
   ArrayResize(low, bars_to_export);
   ArrayResize(close, bars_to_export);

   for(int i = 0; i < bars_to_export; i++)
   {
      time[i] = rates[i].time;
      open[i] = rates[i].open;
      high[i] = rates[i].high;
      low[i] = rates[i].low;
      close[i] = rates[i].close;
   }

   // Generate filenames
   string txt_filename = GenerateFilename(InpBaseFileName, working_symbol, working_timeframe, "txt");
   string json_filename = GenerateFilename(InpBaseFileName, working_symbol, working_timeframe, "json");

   // Export the data to both formats
   bool txt_success = ExportToTxt(working_symbol, working_timeframe, txt_filename, time, open, high, low, close, bars_to_export);
   bool json_success = true;

   if(InpExportJSON)
      json_success = ExportToJson(working_symbol, working_timeframe, json_filename, time, open, high, low, close, bars_to_export);

   Print("====== Export Complete ======");
   return txt_success && (InpExportJSON ? json_success : true);
}

//+------------------------------------------------------------------+
//| Export all price data to both formats                            |
//+------------------------------------------------------------------+
bool ExportPriceData()
{
   string requested_symbol = GetSelectedSymbol();
   ENUM_TIMEFRAMES timeframe = InpTimeframe;

   return ExportPriceDataForSymbol(requested_symbol, timeframe);
}

//+------------------------------------------------------------------+
//| Batch export price data                                          |
//+------------------------------------------------------------------+
bool BatchExportPriceData()
{
   Print("====== Starting Batch Export ======");

   // Parse symbols
   string symbols[];
   int symbol_count = StringSplit(InpBatchSymbols, ',', symbols);

   // Parse timeframes
   string tf_strings[];
   int tf_count = StringSplit(InpBatchTimeframes, ',', tf_strings);

   ENUM_TIMEFRAMES timeframes[];
   ArrayResize(timeframes, tf_count);

   for(int i = 0; i < tf_count; i++)
   {
      string tf = tf_strings[i];
      StringTrimLeft(tf);
      StringTrimRight(tf);

      if(tf == "M1") timeframes[i] = PERIOD_M1;
      else if(tf == "M5") timeframes[i] = PERIOD_M5;
      else if(tf == "M15") timeframes[i] = PERIOD_M15;
      else if(tf == "M30") timeframes[i] = PERIOD_M30;
      else if(tf == "H1") timeframes[i] = PERIOD_H1;
      else if(tf == "H4") timeframes[i] = PERIOD_H4;
      else if(tf == "D1" || tf == "D") timeframes[i] = PERIOD_D1;
      else if(tf == "W1" || tf == "W") timeframes[i] = PERIOD_W1;
      else if(tf == "MN1" || tf == "MN") timeframes[i] = PERIOD_MN1;
      else timeframes[i] = PERIOD_H1;  // Default
   }

   int success_count = 0;
   int total_exports = symbol_count * tf_count;

   for(int s = 0; s < symbol_count; s++)
   {
      string symbol = symbols[s];
      StringTrimLeft(symbol);
      StringTrimRight(symbol);

      for(int t = 0; t < tf_count; t++)
      {
         if(ExportPriceDataForSymbol(symbol, timeframes[t]))
            success_count++;
         else if(!InpContinueOnError)
         {
            Print("ERROR: Batch export stopped due to error");
            break;
         }
      }
   }

   Print("====== Batch Export Complete ======");
   Print("Success: ", success_count, "/", total_exports, " exports");

   return (success_count > 0);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   if(InpEnableBatchExport)
      ObjectDelete(0, BATCH_EXPORT_BUTTON_NAME);
}

//+------------------------------------------------------------------+
//| Custom indicator calculation function (not used)                 |
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
   return rates_total;
}

//+------------------------------------------------------------------+
//| ChartEvent function - handles button clicks                      |
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
         Print("Export button clicked");
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

         if(ExportPriceData())
            Print("Export completed successfully!");
         else
            Print("Export failed!");
      }

      if(InpEnableBatchExport && sparam == BATCH_EXPORT_BUTTON_NAME)
      {
         Print("Batch Export button clicked");
         ObjectSetInteger(0, BATCH_EXPORT_BUTTON_NAME, OBJPROP_STATE, false);

         if(BatchExportPriceData())
            Print("Batch Export completed!");
         else
            Print("Batch Export failed!");
      }
   }
}
//+------------------------------------------------------------------+
