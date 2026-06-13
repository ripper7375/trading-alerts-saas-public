//+------------------------------------------------------------------+
//|                                          OHLCV_Download.mq5      |
//|                                    Copyright 2025, Your Name     |
//|                                      https://www.yourwebsite.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "2.00"
#property description "OHLCV Data Export - Streamlined TXT Only"
#property indicator_chart_window
#property indicator_plots 0

//--- Button name constant
#define EXPORT_BUTTON_NAME "DataExportButton"

// Symbol selection options
enum ENUM_SYMBOL_SELECTION {
   SYMBOL_CURRENT = 0,        // Current chart symbol
   SYMBOL_MANUAL_ENTRY = 1    // Enter manually
};

// Input parameters
input ENUM_SYMBOL_SELECTION InpSymbolSelection = SYMBOL_CURRENT;  // Symbol Selection
input string                InpManualSymbol = "";                 // Manual Symbol Entry (if "Enter manually")
input ENUM_TIMEFRAMES      InpTimeframe = PERIOD_CURRENT;         // Timeframe
input int                  InpBars = 3000;                        // Number of bars to export (matches centroid math lookback for the v6 CALCULATE stage)
input string               InpBaseFileName = "OHLCV";             // Base file name
input bool                 InpForceTimeframe = true;              // Force timeframe if validation fails
input bool                 InpIncludeMetadata = false;            // Include metadata in TXT export
input bool                 InpCleanFilenames = true;              // Clean filenames (no .txt extension)
input bool                 InpForceSymbolDownload = true;         // Force download symbol history
input bool                 InpTryBothSuffixVersions = true;       // Try both with/without .i suffix
input string               InpSymbolMapping = "USDJPY=USDJPY.i;GBPUSD=GBPUSD.i"; // Symbol mappings (format: "name=actual;")
input bool                 InpAutoExport = true;                  // Automated export every minute at InpExportSecond
input int                  InpExportSecond = 59;                  // Export trigger second (0-59)

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
      case PERIOD_D1:  tf_str = "D1"; break;
      case PERIOD_W1:  tf_str = "W1"; break;
      case PERIOD_MN1: tf_str = "MN1"; break;
      default: tf_str = EnumToString(timeframe); break;
   }
   
   // Build the filename: BaseName_Symbol_Timeframe.extension
   if(extension != "")
      return StringFormat("%s_%s_%s.%s", base_name, clean_symbol, tf_str, extension);
   else
      return StringFormat("%s_%s_%s", base_name, clean_symbol, tf_str);
}

//+------------------------------------------------------------------+
//| Convert timeframe enum to short string                           |
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
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   // Create manual export button on chart
   CreateExportButton();
   if(InpAutoExport) EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Timer event — automated export (v5 collection pipeline)          |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!InpAutoExport) return;

   MqlDateTime time_struct;
   TimeToStruct(TimeLocal(), time_struct);
   static int last_trigger_min = -1;
   if(time_struct.sec == InpExportSecond && time_struct.min != last_trigger_min)
   {
      last_trigger_min = time_struct.min;
      if(ExportPriceData())
         Print("SUCCESS: [Auto Export] OHLCV data exported");
      else
         Print("ERROR: [Auto Export] Failed to export OHLCV data.");
   }
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
         if(symbol == "") symbol = Symbol(); // Default to current if empty
         break;
         
      default:
         symbol = Symbol(); // Fallback to current
   }
   
   return symbol;
}

//+------------------------------------------------------------------+
//| Process symbol name with mapping support                         |
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
            
            if(StringCompare(map[0], baseSymbol, false) == 0)
            {
               Print("Using mapped symbol: '", baseSymbol, "' → '", map[1], "'");
               return map[1];
            }
         }
      }
   }
   
   return ProcessSymbolName(baseSymbol);
}

//+------------------------------------------------------------------+
//| Process symbol name based on type                                |
//+------------------------------------------------------------------+
string ProcessSymbolName(string symbol)
{
   if(StringFind(symbol, ".i") >= 0)
      return symbol;
      
   if(StringLen(symbol) == 6 && IsForexPair(symbol))
   {
      Print("Adding .i suffix to forex pair: ", symbol);
      return symbol + ".i";
   }
   
   return symbol;
}

//+------------------------------------------------------------------+
//| Try symbol with both variants                                    |
//+------------------------------------------------------------------+
bool TrySymbolVariants(string baseSymbol, ENUM_TIMEFRAMES timeframe, string &workingSymbol)
{
   string symbolVariants[2];
   int variantCount = 1;
   
   symbolVariants[0] = GetMappedSymbol(baseSymbol);
   
   string processedSymbol = ProcessSymbolName(baseSymbol);
   if(InpTryBothSuffixVersions && symbolVariants[0] == processedSymbol && symbolVariants[0] != baseSymbol) {
      symbolVariants[1] = baseSymbol;
      variantCount = 2;
   }
   else if(InpTryBothSuffixVersions && StringFind(baseSymbol, ".i") < 0 && StringLen(baseSymbol) == 6 && IsForexPair(baseSymbol)) {
      symbolVariants[1] = baseSymbol + ".i";
      variantCount = 2;
   }
   
   for(int i = 0; i < variantCount; i++) {
      if(SymbolSelect(symbolVariants[i], true)) {
         if(InpForceSymbolDownload) {
            Print("Forcing symbol data download for: ", symbolVariants[i]);
            int unused = iBars(symbolVariants[i], timeframe);
         }
         
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
//| Check if a symbol is a standard forex pair                       |
//+------------------------------------------------------------------+
bool IsForexPair(string symbol)
{
   string currencies[] = {"USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"};
   
   if(StringLen(symbol) == 6)
   {
      string first = StringSubstr(symbol, 0, 3);
      string second = StringSubstr(symbol, 3, 3);
      
      bool first_is_currency = false;
      bool second_is_currency = false;
      
      for(int i = 0; i < ArraySize(currencies); i++)
      {
         if(first == currencies[i]) first_is_currency = true;
         if(second == currencies[i]) second_is_currency = true;
      }
      
      return first_is_currency && second_is_currency;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| ChartEvent function to handle button clicks                      |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   //--- Handle "Export All" custom event from EA
   if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
   {
      if(ExportPriceData())
         Print("SUCCESS: [Export All] OHLCV data exported successfully");
      else
         Print("ERROR: [Export All] Failed to export OHLCV data.");
      return;
   }

   // Check if it's a button click event
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME)
   {
      if(ExportPriceData())
         Print("SUCCESS: Price data exported successfully");
      else
         Print("ERROR: Failed to export price data. See journal for details.");
         
      // Reset button state
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   }
}

//+------------------------------------------------------------------+
//| Export price data for a specific symbol and timeframe            |
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
   
   Print("Exporting ", bars_to_export, " bars of ", working_symbol, " @ ", EnumToString(timeframe));
   Print("File: ", txt_filename);
   
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
      
      ResetLastError();
      if(CopyTime(working_symbol, timeframe, 0, bars_to_export, time) != bars_to_export) continue;
      
      ResetLastError();
      if(CopyOpen(working_symbol, timeframe, 0, bars_to_export, open) != bars_to_export) continue;
      
      ResetLastError();
      if(CopyHigh(working_symbol, timeframe, 0, bars_to_export, high) != bars_to_export) continue;
      
      ResetLastError();
      if(CopyLow(working_symbol, timeframe, 0, bars_to_export, low) != bars_to_export) continue;
      
      ResetLastError();
      if(CopyClose(working_symbol, timeframe, 0, bars_to_export, close) != bars_to_export) continue;
      
      ResetLastError();
      if(CopyTickVolume(working_symbol, timeframe, 0, bars_to_export, volume) != bars_to_export) continue;
      
      // All data copied successfully
      data_copied = true;
      break;
   }
   
   if(!data_copied)
   {
      Print("CRITICAL: Failed to copy data after multiple attempts");
      return false;
   }
   
   // Export the data to TXT format
   return ExportToTxt(working_symbol, timeframe, txt_filename, time, open, high, low, close, volume, bars_to_export);
}

//+------------------------------------------------------------------+
//| Export all price data (Entry Point)                              |
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
//| Export price data to TXT file                                    |
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
      write_success &= FileWrite(file_handle, "") > 0; // Empty line
   }
   
   // --- UPDATED: Write data header with ohlcv_ prefixes ---
   write_success &= FileWrite(file_handle, "ohlcv_timestamp\tohlcv_symbol\tohlcv_timeframe\tohlcv_close\tohlcv_open\tohlcv_high\tohlcv_low\tohlcv_volume") > 0;
   
   // Write data rows
   datetime gmt_offset = TimeCurrent() - TimeGMT();
   for(int i = bars_count-1; i >= 0; i--)
   {
      string line = StringFormat("%I64d\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%d",
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
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   if(InpAutoExport) EventKillTimer();
   ChartRedraw(0);
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
   return(rates_total);
}
//+------------------------------------------------------------------+