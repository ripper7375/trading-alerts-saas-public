//+------------------------------------------------------------------+
//|                                                  ALGLIB_SSA.mq5 |
//|                                    Copyright 2026, Clemence Benjamin|
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2

//--- include ALGLIB
#include <Math/Alglib/alglib.mqh>

//--- plot definitions
#property indicator_label1  "SSA Trend"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrMagenta
#property indicator_width1  2

#property indicator_label2  "SSA Signal (EMA)"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrBlue
#property indicator_width2  2
#property indicator_style2  STYLE_DASH

//--- export button name constant
#define EXPORT_BUTTON_NAME "SSAExportButton"

//--- input parameters
input int    SSAWindow         = 30;          // SSA embedding window (must be < data length)
input int    SSARank           = 6;           // SSA components to keep (lower = smoother)
input int    SSASignalPeriod   = 3;           // EMA period for SSA signal line
input int    LookbackBars      = 500;         // Number of recent bars to process
input int    InpExportBars     = 500;         // Number of bars to export
input string InpExportFileName = "ALGLIB_SSA"; // Base export filename

//--- indicator buffers
double ssaTrendBuffer[];
double ssaSignalBuffer[];

//--- global cache for export (oldest-first, same index as indicator buffers)
datetime g_time[];
double   g_close[];
int      g_rates_total = 0;

//+------------------------------------------------------------------+
//| Initialization                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, ssaTrendBuffer,  INDICATOR_DATA);
   SetIndexBuffer(1, ssaSignalBuffer, INDICATOR_DATA);

   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   IndicatorSetString(INDICATOR_SHORTNAME, "SSA Trend & Signal");

   CreateExportButton();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Deinitialization                                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Main calculation                                                 |
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
   //--- Cache time[] and close[] for export — always update, same as reference pattern
   if(ArraySize(g_time) < rates_total)
   {
      ArrayResize(g_time,  rates_total);
      ArrayResize(g_close, rates_total);
   }
   int copy_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int j = copy_start; j < rates_total; j++)
   {
      g_time[j]  = time[j];
      g_close[j] = close[j];
   }
   g_rates_total = rates_total;

   //--- Determine the lookback window
   int startIdx = (rates_total > LookbackBars) ? rates_total - LookbackBars : 0;
   int len      = rates_total - startIdx;

   //--- Need enough bars for SSA
   if(len < SSAWindow)
   {
      for(int i = startIdx; i < rates_total; i++)
      {
         ssaTrendBuffer[i]  = EMPTY_VALUE;
         ssaSignalBuffer[i] = EMPTY_VALUE;
      }
      return(rates_total);
   }

   //--- Fill bars before the lookback window with EMPTY_VALUE (once only)
   if(prev_calculated == 0)
   {
      for(int i = 0; i < startIdx; i++)
      {
         ssaTrendBuffer[i]  = EMPTY_VALUE;
         ssaSignalBuffer[i] = EMPTY_VALUE;
      }
   }

   //--- Load close prices for the full lookback window
   vector<double> vecClose(len);
   for(int i = 0; i < len; i++)
      vecClose[i] = close[startIdx + i];

   //--- Build SSA model (always trained on full lookback data)
   CSSAModel ssa;
   CAlglib::SSACreate(ssa);
   CRowDouble priceRow(vecClose);
   CAlglib::SSAAddSequence(ssa, priceRow);
   CAlglib::SSASetAlgoTopKRealtime(ssa, SSARank);
   CAlglib::SSASetWindow(ssa, SSAWindow);
   CRowDouble trend, noise;

   double alpha = 2.0 / (SSASignalPeriod + 1.0);

   if(prev_calculated == 0)
   {
      //---------------------------------------------------------------
      // FIRST LOAD — mirrors reference pattern: write ALL bars once.
      // SSAAnalyzeLast(ssa, len, ...) decomposes the full window.
      // Every bar is written here and NEVER touched again after this.
      //---------------------------------------------------------------
      CAlglib::SSAAnalyzeLast(ssa, len, trend, noise);

      if(trend.Size() == len)
      {
         vector<double> vecTrend = trend.ToVector();
         for(int i = 0; i < len; i++)
            ssaTrendBuffer[startIdx + i] = vecTrend[i];

         //--- Seed EMA signal incrementally from oldest bar forward
         ssaSignalBuffer[startIdx] = vecTrend[0];
         for(int i = 1; i < len; i++)
            ssaSignalBuffer[startIdx + i] = alpha * vecTrend[i]
                                          + (1.0 - alpha) * ssaSignalBuffer[startIdx + i - 1];
      }
      else
      {
         for(int i = 0; i < len; i++)
         {
            ssaTrendBuffer[startIdx + i]  = EMPTY_VALUE;
            ssaSignalBuffer[startIdx + i] = EMPTY_VALUE;
         }
      }
   }
   else
   {
      //---------------------------------------------------------------
      // INCREMENTAL UPDATE — mirrors reference pattern:
      // Only the LAST bar is written; ALL historical bars are frozen.
      //
      // Key: SSAAnalyzeLast(ssa, 1, ...) returns only the newest bar's
      // trend value.  Historical bars (startIdx .. rates_total-2) are
      // NEVER overwritten, so buffer values are stable and always match
      // what the chart tooltip shows — fixing Issues 2 & 3.
      //
      // Same-bar ticks are handled implicitly: MT5 only calls us when
      // prev_calculated < rates_total (new bar) because we return
      // rates_total each time; same-bar ticks get prev_calculated ==
      // rates_total and MT5 skips re-calling for indicator buffers.
      //---------------------------------------------------------------
      CAlglib::SSAAnalyzeLast(ssa, 1, trend, noise);

      if(trend.Size() == 1)
      {
         int last = rates_total - 1;
         ssaTrendBuffer[last]  = trend[0];

         //--- Incremental EMA on the new bar only — exactly like reference TEMA
         ssaSignalBuffer[last] = alpha * ssaTrendBuffer[last]
                               + (1.0 - alpha) * ssaSignalBuffer[last - 1];
      }
   }

   return(rates_total);
}

//+------------------------------------------------------------------+
//| Chart event handler — export button click                        |
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
         if(ExportData())
            Print("SUCCESS: SSA indicator data exported successfully");
         else
            Print("ERROR: Failed to export SSA indicator data. See log for details.");

         //--- reset button state
         ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Create export button on chart                                    |
//+------------------------------------------------------------------+
void CreateExportButton()
{
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

   int button_width  = 200;
   int button_height = 50;
   int x_margin      = 250;
   int y_margin      = 100;

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER,       CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE,    x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE,    y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE,        button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE,        button_height);

   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_TEXT,         "Export SSA Data");
   ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_FONT,         "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE,     11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR,        clrWhite);

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR,      C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR,       ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN,       false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE,   false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER,       999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE,        false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK,         false);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Convert ENUM_TIMEFRAMES to readable string                       |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES timeframe)
{
   switch(timeframe)
   {
      case PERIOD_M1:  return "M1";
      case PERIOD_M2:  return "M2";
      case PERIOD_M3:  return "M3";
      case PERIOD_M4:  return "M4";
      case PERIOD_M5:  return "M5";
      case PERIOD_M6:  return "M6";
      case PERIOD_M10: return "M10";
      case PERIOD_M12: return "M12";
      case PERIOD_M15: return "M15";
      case PERIOD_M20: return "M20";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2";
      case PERIOD_H3:  return "H3";
      case PERIOD_H4:  return "H4";
      case PERIOD_H6:  return "H6";
      case PERIOD_H8:  return "H8";
      case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1";
      case PERIOD_W1:  return "W1";
      case PERIOD_MN1: return "MN1";
      default:
      {
         //--- Fix Issue 1: EnumToString returns "PERIOD_Xxx" — strip the prefix
         string s = EnumToString(timeframe);
         StringReplace(s, "PERIOD_", "");
         return s;
      }
   }
}

//+------------------------------------------------------------------+
//| Export indicator data to tab-delimited .txt file                 |
//| Columns : timestamp  symbol  timeframe  close  ssa  ema_ssa      |
//| Order   : ascending (oldest bar first, newest bar last)          |
//| Encoding: UTF-8, No BOM  (FILE_ANSI in MQL5)                     |
//| UNIX ts : broker time adjusted to UTC via gmt_offset             |
//+------------------------------------------------------------------+
bool ExportData()
{
   string symbol = Symbol();
   string tf_str = TimeframeToString(Period());

   if(g_rates_total <= 0)
   {
      Print("ERROR: No bars available for export (indicator not yet calculated)");
      return false;
   }

   //--- determine export range
   int bars_to_export = MathMin(InpExportBars, g_rates_total);
   int start_idx      = g_rates_total - bars_to_export;  // oldest exported bar index

   //--- build filename: BaseName_Symbol_Timeframe.txt
   string clean_symbol = symbol;
   int dot_pos = StringFind(clean_symbol, ".");
   if(dot_pos > 0)
      clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

   string filename  = StringFormat("%s_%s_%s.txt", InpExportFileName, clean_symbol, tf_str);
   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Exporting to: ", full_path);

   //--- open file: FILE_ANSI = UTF-8 no BOM in MQL5
   ResetLastError();
   int fh = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      Print("ERROR: Cannot open file for writing. Error code: ", GetLastError());
      return false;
   }

   bool ok = true;

   //--- broker-to-UTC offset in seconds
   datetime gmt_offset = TimeCurrent() - TimeGMT();

   //--- header row
   ok &= FileWrite(fh, "timestamp\tsymbol\ttimeframe\tclose\tssa\tema_ssa") > 0;

   //--- data rows: i=0 is oldest exported bar, i=bars_to_export-1 is newest
   for(int i = 0; i < bars_to_export; i++)
   {
      int idx = start_idx + i;

      //--- SSA Trend value — blank for warmup bars not yet computed
      //    Use _Digits+3 precision to match chart tooltip display (fixes Issue 2)
      string ssa_str = (ssaTrendBuffer[idx] != EMPTY_VALUE && ssaTrendBuffer[idx] != 0.0)
                       ? DoubleToString(ssaTrendBuffer[idx], _Digits + 3) : "";

      //--- SSA Signal / EMA value — blank for warmup bars not yet computed
      //    Use _Digits+3 precision to match chart tooltip display (fixes Issue 3)
      string ema_ssa_str = (ssaSignalBuffer[idx] != EMPTY_VALUE && ssaSignalBuffer[idx] != 0.0)
                           ? DoubleToString(ssaSignalBuffer[idx], _Digits + 3) : "";

      string line = StringFormat("%lld\t%s\t%s\t%s\t%s\t%s",
                                 (long)(g_time[idx] - gmt_offset),  // UNIX UTC timestamp
                                 symbol,
                                 tf_str,
                                 DoubleToString(g_close[idx], _Digits),
                                 ssa_str,
                                 ema_ssa_str);

      ok &= FileWrite(fh, line) > 0;
   }

   FileClose(fh);

   if(!ok)
   {
      Print("ERROR: One or more rows failed to write");
      return false;
   }

   Print("Export complete: ", bars_to_export, " bars written to ", filename);
   return true;
}
//+------------------------------------------------------------------+
