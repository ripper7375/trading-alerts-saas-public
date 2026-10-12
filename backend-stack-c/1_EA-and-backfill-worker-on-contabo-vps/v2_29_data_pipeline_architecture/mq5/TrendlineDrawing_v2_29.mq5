//+------------------------------------------------------------------+
//|                                     TrendlineDrawing_v2_29.mq5   |
//|                    Copyright 2026, Backend Stack C Data Pipeline |
//|                                  https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, Backend Stack C Data Pipeline"
#property link        "https://www.yourwebsite.com"
#property version     "2.29"
#property description "Trendline Drawing 12-Slot Data Export (16th Indicator) - Stack C Data Pipeline v2.29"
#property indicator_chart_window
#property indicator_plots 0

//--- Constants
#define EXPORT_BUTTON_NAME "TrendlineExportButton"
#define MAX_TRENDLINES 12

//--- Enums
enum ENUM_SYMBOL_SELECTION {
   SYMBOL_CURRENT = 0,        // Current chart symbol
   SYMBOL_MANUAL_ENTRY = 1    // Enter manually
};

//--- Input parameters
input group "===== Trendline Scanning Settings ====="
input string               InpTrendLinePrefix       = "Trendline";         // Base text for trendline names (e.g. Trendline_TL1..TL12)
input bool                 InpExtendTrendlines     = true;                // Mathematical extrapolation beyond anchor points
input bool                 InpOnlyAfterStartTime   = true;                // Only output values at or after line start time

input group "===== Pipeline Export Settings ====="
input string               InpBaseFileName         = "Trendline_Drawing"; // Base file name (export prefix)
input int                  InpBars                 = 3000;                // Number of bars to export (matches OHLCV spine)
input bool                 InpAutoExport           = true;                // Automated export every minute at InpExportSecond
input int                  InpExportSecond         = 59;                  // Export trigger second (0-59)
input bool                 InpIncludeHeader        = true;                // Include TSV header row
input string               InpCloseColName         = "lt_close";          // Close column header name (default: lt_close)

input group "===== Symbol and Timeframe Settings ====="
input ENUM_SYMBOL_SELECTION InpSymbolSelection     = SYMBOL_CURRENT;      // Symbol Selection
input string               InpManualSymbol         = "";                  // Manual Symbol Entry (if "Enter manually")
input ENUM_TIMEFRAMES      InpTimeframe            = PERIOD_CURRENT;      // Timeframe
input bool                 InpForceTimeframe       = true;                // Force timeframe if validation fails
input bool                 InpTryBothSuffixVersions = true;               // Try both with/without .i suffix
input string               InpSymbolMapping        = "USDJPY=USDJPY.i;GBPUSD=GBPUSD.i"; // Symbol mappings (format: "name=actual;")

//--- Global state variables
string g_trendLineNames[MAX_TRENDLINES];
bool   g_trendLineExists[MAX_TRENDLINES];

//+------------------------------------------------------------------+
//| Generate clean filename with symbol and timeframe                |
//+------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe, string extension)
{
   // Clean up symbol name (remove broker suffixes like .i for filename)
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
   CreateExportButton();
   if(InpAutoExport) 
      EventSetTimer(1);
   
   // Initial trendline scan
   int detected = ScanAndMapTrendLines();
   PrintFormat("TrendlineDrawing_v2_29 initialized: %d trendlines mapped (TL1-TL12). AutoExport=%s @ :%02d",
               detected, (InpAutoExport ? "ON" : "OFF"), InpExportSecond);

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(InpAutoExport) 
      EventKillTimer();
      
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   Print("TrendlineDrawing_v2_29 deinitialized cleanly.");
}

//+------------------------------------------------------------------+
//| Timer event — automated export (v2.29 collection pipeline)       |
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
      if(ExportTrendlineData())
         Print("SUCCESS: [Auto Export] Trendline data exported successfully.");
      else
         Print("ERROR: [Auto Export] Failed to export Trendline data.");
   }
}

//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   //--- Handle "Export All" custom broadcast event from EA
   if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
   {
      if(ExportTrendlineData())
         Print("SUCCESS: [Export All Broadcast] Trendline data exported successfully.");
      else
         Print("ERROR: [Export All Broadcast] Failed to export Trendline data.");
      return;
   }

   //--- Handle manual button click event
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME)
   {
      if(ExportTrendlineData())
         Print("SUCCESS: [Manual Export] Trendline data exported successfully.");
      else
         Print("ERROR: [Manual Export] Failed to export Trendline data. Check journal.");
         
      // Reset button state
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   }
}

//+------------------------------------------------------------------+
//| Standard indicator iteration function                            |
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
//| Create Export Button on chart                                    |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);

   if(ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
   {
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 70);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 120);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
      ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export TL");
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkSlateGray);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, clrSilver);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 9);
      ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, true);
   }
}

//+------------------------------------------------------------------+
//| Scan and map trendlines Trendline_TL1..TL12 with duplicate check |
//+------------------------------------------------------------------+
int ScanAndMapTrendLines()
{
   for(int k = 0; k < MAX_TRENDLINES; k++)
   {
      g_trendLineNames[k] = "";
      g_trendLineExists[k] = false;
   }

   int total = ObjectsTotal(0, -1, OBJ_TREND);
   int tlCounts[MAX_TRENDLINES];
   string tlFirstFound[MAX_TRENDLINES];
   string tlAllFound[MAX_TRENDLINES];

   for(int k = 0; k < MAX_TRENDLINES; k++)
   {
      tlCounts[k] = 0;
      tlFirstFound[k] = "";
      tlAllFound[k] = "";
   }

   for(int i = 0; i < total; i++)
   {
      string name = ObjectName(0, i, -1, OBJ_TREND);

      for(int k = 0; k < MAX_TRENDLINES; k++)
      {
         string target = InpTrendLinePrefix + "_TL" + IntegerToString(k + 1);
         if(StringFind(name, target) != -1)
         {
            tlCounts[k]++;
            if(tlCounts[k] == 1)
            {
               tlFirstFound[k] = name;
               tlAllFound[k] = name;
            }
            else
            {
               tlAllFound[k] += ", " + name;
            }
            break;
         }
      }
   }

   bool hasDuplicates = false;
   string errMsg = "";

   for(int k = 0; k < MAX_TRENDLINES; k++)
   {
      if(tlCounts[k] > 1)
      {
         hasDuplicates = true;
         string slot = "TL" + IntegerToString(k + 1);
         errMsg += StringFormat("ERROR: Multiple %s trendlines found (%d): %s\n", slot, tlCounts[k], tlAllFound[k]);
      }
      else if(tlCounts[k] == 1)
      {
         g_trendLineNames[k] = tlFirstFound[k];
         g_trendLineExists[k] = true;
      }
   }

   if(hasDuplicates)
   {
      Print("========================================");
      Print("TRENDLINE DRAWING DUPLICATE ERROR:");
      Print(errMsg);
      Print("Please ensure only ONE trendline per TL1..TL12 slot exists on chart.");
      Print("========================================");
      Comment("TrendlineDrawing ERROR:\n" + errMsg);
      return -1;
   }

   int count = 0;
   for(int k = 0; k < MAX_TRENDLINES; k++)
   {
      if(g_trendLineExists[k]) count++;
   }

   return count;
}

//+------------------------------------------------------------------+
//| Get trendline price value at a specific bar timestamp            |
//+------------------------------------------------------------------+
double GetTrendLinePriceAtTime(string trendName, datetime barTime)
{
   if(trendName == "" || barTime == 0)
      return EMPTY_VALUE;

   datetime t1 = (datetime)ObjectGetInteger(0, trendName, OBJPROP_TIME, 0);
   datetime t2 = (datetime)ObjectGetInteger(0, trendName, OBJPROP_TIME, 1);
   datetime lineStartTime = MathMin(t1, t2);

   // If configured to only output after start time, suppress bars before origin
   if(InpOnlyAfterStartTime && lineStartTime > 0 && barTime < lineStartTime)
      return EMPTY_VALUE;

   // 1. Try native MetaTrader 5 ObjectGetValueByTime
   double val = ObjectGetValueByTime(0, trendName, barTime);
   if(val != EMPTY_VALUE && MathIsValidNumber(val) && val > 0)
      return val;

   // 2. Mathematical interpolation & extrapolation fallback
   if(InpExtendTrendlines)
   {
      double p1 = ObjectGetDouble(0, trendName, OBJPROP_PRICE, 0);
      double p2 = ObjectGetDouble(0, trendName, OBJPROP_PRICE, 1);

      if(t1 != 0 && t2 != 0 && t1 != t2 && MathIsValidNumber(p1) && MathIsValidNumber(p2))
      {
         double slope = (p2 - p1) / (double)(t2 - t1);
         double calc_price = p1 + slope * (double)(barTime - t1);
         if(MathIsValidNumber(calc_price) && calc_price > 0)
            return calc_price;
      }
   }

   return EMPTY_VALUE;
}

//+------------------------------------------------------------------+
//| Resolve Symbol variants (e.g. .i suffix)                         |
//+------------------------------------------------------------------+
bool TrySymbolVariants(string requested_symbol, ENUM_TIMEFRAMES timeframe, string &working_symbol)
{
   string mapped_symbol = requested_symbol;
   if(InpSymbolMapping != "")
   {
      string pairs[];
      int num_pairs = StringSplit(InpSymbolMapping, ';', pairs);
      for(int i = 0; i < num_pairs; i++)
      {
         string parts[];
         if(StringSplit(pairs[i], '=', parts) == 2)
         {
            if(parts[0] == requested_symbol)
            {
               mapped_symbol = parts[1];
               break;
            }
         }
      }
   }
   
   if(SymbolSelect(mapped_symbol, true))
   {
      working_symbol = mapped_symbol;
      return true;
   }
   
   if(InpTryBothSuffixVersions)
   {
      string alt_symbol = "";
      if(StringFind(requested_symbol, ".i") > 0)
         alt_symbol = StringSubstr(requested_symbol, 0, StringFind(requested_symbol, ".i"));
      else
         alt_symbol = requested_symbol + ".i";
         
      if(SymbolSelect(alt_symbol, true))
      {
         working_symbol = alt_symbol;
         return true;
      }
   }
   
   working_symbol = requested_symbol;
   return SymbolSelect(working_symbol, true);
}

//+------------------------------------------------------------------+
//| Export trendline data (Main Entry Point)                         |
//+------------------------------------------------------------------+
bool ExportTrendlineData()
{
   string requested_symbol = (InpSymbolSelection == SYMBOL_CURRENT) ? _Symbol : InpManualSymbol;
   if(requested_symbol == "") 
      requested_symbol = _Symbol;

   ENUM_TIMEFRAMES timeframe = (InpTimeframe == PERIOD_CURRENT) ? (ENUM_TIMEFRAMES)_Period : InpTimeframe;
   return ExportTrendlineDataForSymbol(requested_symbol, timeframe);
}

//+------------------------------------------------------------------+
//| Export trendline data for a specific symbol and timeframe        |
//+------------------------------------------------------------------+
bool ExportTrendlineDataForSymbol(string requested_symbol, ENUM_TIMEFRAMES timeframe)
{
   string working_symbol = "";
   if(!TrySymbolVariants(requested_symbol, timeframe, working_symbol))
   {
      Print("ERROR: Symbol selection failed for '", requested_symbol, "'");
      return false;
   }

   string clean_symbol = working_symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string txt_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "txt");

   // Scan chart trendlines
   int detected = ScanAndMapTrendLines();
   if(detected < 0)
   {
      Print("ABORT: Trendline scan encountered duplicate configuration error.");
      return false;
   }

   // Fetch price data arrays
   int bars_to_export = InpBars;
   datetime time[];
   double close[];

   ArraySetAsSeries(time, true);
   ArraySetAsSeries(close, true);

   bool data_copied = false;
   for(int attempts = 0; attempts < 5; attempts++)
   {
      if(attempts > 0)
      {
         PrintFormat("Retry attempt %d copying bars for '%s'...", attempts, working_symbol);
         Sleep(200 * attempts);
      }

      ResetLastError();
      if(CopyTime(working_symbol, timeframe, 0, bars_to_export, time) != bars_to_export) 
         continue;

      ResetLastError();
      if(CopyClose(working_symbol, timeframe, 0, bars_to_export, close) != bars_to_export) 
         continue;

      data_copied = true;
      break;
   }

   if(!data_copied)
   {
      Print("CRITICAL: Failed to copy historical bar data after multiple attempts.");
      return false;
   }

   // Export to TXT (TSV) format
   return ExportToTxt(working_symbol, clean_symbol, timeframe, txt_filename, time, close, bars_to_export);
}

//+------------------------------------------------------------------+
//| Export data to TSV text file (Stack C Data Pipeline Standard)    |
//+------------------------------------------------------------------+
bool ExportToTxt(const string symbol,
                 const string clean_symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[],
                 const double &close[],
                 const int bars_count)
{
   ResetLastError();
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file_handle == INVALID_HANDLE)
   {
      PrintFormat("ERROR: Failed to open TXT file for writing: %s (Error: %d)", filename, GetLastError());
      return false;
   }

   bool write_success = true;

   // 1. TSV Header: 16 columns matching Stack C contract (4 keys + 12 TL slots)
   if(InpIncludeHeader)
   {
      string header = StringFormat("tl_timestamp\ttl_symbol\ttl_timeframe\t%s\ttl_1\ttl_2\ttl_3\ttl_4\ttl_5\ttl_6\ttl_7\ttl_8\ttl_9\ttl_10\ttl_11\ttl_12", InpCloseColName);
      write_success &= (FileWrite(file_handle, header) > 0);
   }

   // 2. Broker->UTC offset (Stack C §7.1 Blueprint fix: rounded to the hour)
   long _srv_off = (long)TimeTradeServer() - (long)TimeGMT();
   datetime gmt_offset = (datetime)((long)MathRound(_srv_off / 3600.0) * 3600);

   string tf_str = GetTFStr(timeframe);
   string tl_str[MAX_TRENDLINES];

   // 3. Write data rows in chronological order: oldest bar down to bar 0 (current)
   for(int i = bars_count - 1; i >= 0; i--)
   {
      datetime bar_time = time[i];
      long unix_ts = (long)(bar_time - gmt_offset);

      // Evaluate trendline slots TL1..TL12
      for(int k = 0; k < MAX_TRENDLINES; k++)
      {
         if(g_trendLineExists[k])
         {
            double price = GetTrendLinePriceAtTime(g_trendLineNames[k], bar_time);
            if(price != EMPTY_VALUE && MathIsValidNumber(price) && price > 0)
               tl_str[k] = DoubleToString(price, _Digits);
            else
               tl_str[k] = ""; // Empty string -> staged as NULL
         }
         else
         {
            tl_str[k] = ""; // Slot not drawn -> staged as NULL
         }
      }

      // Format 16 columns (4 keys + 12 TL slots)
      string line = StringFormat("%I64d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s",
                                 unix_ts,
                                 clean_symbol,
                                 tf_str,
                                 DoubleToString(close[i], _Digits),
                                 tl_str[0],
                                 tl_str[1],
                                 tl_str[2],
                                 tl_str[3],
                                 tl_str[4],
                                 tl_str[5],
                                 tl_str[6],
                                 tl_str[7],
                                 tl_str[8],
                                 tl_str[9],
                                 tl_str[10],
                                 tl_str[11]);

      write_success &= (FileWrite(file_handle, line) > 0);
   }

   FileClose(file_handle);

   if(!write_success)
   {
      Print("ERROR: Failed while writing rows to TXT file.");
      return false;
   }

   PrintFormat("Trendline data successfully exported to: %s (%d bars)", filename, bars_count);
   return true;
}
//+------------------------------------------------------------------+
