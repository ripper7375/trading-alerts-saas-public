//+------------------------------------------------------------------+
//|                                     SymbolSpecsExport_v2_29.mq5   |
//|                                                                    |
//|  Exports the BROKER'S figures for one symbol (contract size,       |
//|  volume limits, tick size, typical spread, swaps) to a             |
//|  tab-separated .txt for the v6 collector, on the same terminal     |
//|  that runs the export indicators. STACK-D-ARCHITECTURE.md 6.9,     |
//|  ADR-066. No vendor, no API key, no new cost.                      |
//|                                                                    |
//|  WHY AN EA AND NOT A SCRIPT: the figures are refreshed unattended, |
//|  and the typical spread needs samples over time. Attach to ONE     |
//|  chart of the symbol (any timeframe). It draws nothing, trades     |
//|  nothing, and touches no chart objects.                            |
//|                                                                    |
//|  WHY A .txt AND NOT DIRECT SQLITE: in the v6 flow the Python       |
//|  collector is the ONLY writer of xauusd.db (see                    |
//|  EconomicCalendarExport_v2_29.mq5 for the full reasoning).         |
//|                                                                    |
//|  THIS EXPORTER IS DELIBERATELY DUMB. It writes the CURRENT figures |
//|  every time and makes no attempt to detect changes. Deciding       |
//|  whether the figures are new (a row on change, and one a day)      |
//|  belongs in the collector, where it is testable in Python.         |
//|                                                                    |
//|  Output: SymbolSpecs_<InpSymbol>.txt in MQL5\Files\, a header line |
//|  and ONE data row:                                                 |
//|    captured_at symbol contract_size volume_min volume_step        |
//|    volume_max tick_size typical_spread swap_long swap_short        |
//|    point digits swap_mode                                          |
//|  The collector parses by column NAME; the names are the contract   |
//|  (gateway_contract_symbol_specs.schema.json, minus terminal_id,    |
//|  which the collector adds from the terminal's folder).             |
//+------------------------------------------------------------------+
#property copyright "DavinTrade"
#property version   "1.00"
#property description "Exports the broker's symbol figures for the v6 collector."
#property strict

//--- inputs
input string InpSymbol         = "XAUUSD"; // Name the pipeline stores the figures under; the chart symbol must start with it (a broker suffix is fine)
input int    InpSampleSec      = 60;       // Spread sampling interval (seconds)
input int    InpExportSec      = 300;      // File refresh interval (seconds)
input int    InpWindowSamples  = 1440;     // Spread samples kept for the median (1440 x 60 s = 24 h)
input int    InpMinSamples     = 30;       // Samples needed before the first export (a median of one is not typical)
input int    InpMaxQuoteAgeSec = 120;      // A sample is taken only while the last quote is no older than this

//--- the exact column order the collector parses by NAME (order is cosmetic,
//--- names are the contract).
const string COLUMNS =
   "captured_at\tsymbol\tcontract_size\tvolume_min\tvolume_step\tvolume_max\t"
   "tick_size\ttypical_spread\tswap_long\tswap_short\tpoint\tdigits\tswap_mode";

//--- state
double g_samples[];            // ring of SYMBOL_SPREAD samples, in points
int    g_count = 0;            // samples held (0..InpWindowSamples)
int    g_next  = 0;            // ring write position
int    g_ticksSinceExport = 0; // timer ticks since the file was last written
string g_outFile = "";

//+------------------------------------------------------------------+
//| Hour-rounded server->GMT offset.                                  |
//|                                                                   |
//| Identical to EconomicCalendarExport_v2_29 and the 13 fixed export  |
//| indicators. captured_at is UTC, and TimeCurrent() is NOT UTC: it   |
//| is the LAST TICK's broker server time, so it is hours off and      |
//| stalls on a quiet market. TimeTradeServer() keeps running without  |
//| ticks. Recomputed each export because broker offsets change with   |
//| DST -- never cache or hardcode this.                              |
//+------------------------------------------------------------------+
long ServerToUtcOffset()
  {
   long raw = (long)TimeTradeServer() - (long)TimeGMT();
   return (long)MathRound(raw / 3600.0) * 3600;
  }

//+------------------------------------------------------------------+
//| A real figure as text, 8 decimals (the most MT5 prints).           |
//+------------------------------------------------------------------+
string Num(const double value)
  {
   return DoubleToString(value, 8);
  }

//+------------------------------------------------------------------+
//| One SYMBOL_SPREAD sample, in points -- only while quotes are live. |
//|                                                                   |
//| On a closed market (weekend, holiday) or a stalled feed the        |
//| terminal keeps reporting the LAST spread, and sampling it would    |
//| fill the window with a figure nobody traded at. A stale quote      |
//| therefore gives no sample. SYMBOL_TIME and TimeTradeServer() are   |
//| both server time, so their difference is a real age.               |
//+------------------------------------------------------------------+
void SampleSpread()
  {
   long lastQuote = 0;
   long spread    = 0;
   if(!SymbolInfoInteger(_Symbol, SYMBOL_TIME, lastQuote))
      return;
   if(!SymbolInfoInteger(_Symbol, SYMBOL_SPREAD, spread))
      return;

   long age = (long)TimeTradeServer() - lastQuote;
   if(age > InpMaxQuoteAgeSec)
      return;
   if(spread < 0)
      return;

   g_samples[g_next] = (double)spread;
   g_next = (g_next + 1) % InpWindowSamples;
   if(g_count < InpWindowSamples)
      g_count++;
  }

//+------------------------------------------------------------------+
//| Median of the samples held (the ring is filled from index 0, so    |
//| indexes 0..g_count-1 are always the valid ones, full or not).      |
//+------------------------------------------------------------------+
double MedianSpread()
  {
   double tmp[];
   if(ArrayResize(tmp, g_count) != g_count)
      return -1.0;
   for(int i = 0; i < g_count; i++)
      tmp[i] = g_samples[i];
   ArraySort(tmp);

   int mid = g_count / 2;
   if(g_count % 2 == 1)
      return tmp[mid];
   return (tmp[mid - 1] + tmp[mid]) / 2.0;
  }

//+------------------------------------------------------------------+
//| Write `content` as UTF-8 bytes, to a temp file and renamed, so the |
//| collector can never read a half-written snapshot. Same function as |
//| EconomicCalendarExport_v2_29 (the content here is plain ASCII).    |
//+------------------------------------------------------------------+
bool WriteUtf8Atomic(const string filename, const string content)
  {
   string tmp = filename + ".tmp";

   uchar bytes[];
   int total = StringToCharArray(content, bytes, 0, WHOLE_ARRAY, CP_UTF8);
   if(total <= 0)
     {
      Print("SymbolSpecsExport: UTF-8 conversion failed.");
      return false;
     }
   // StringToCharArray appends a terminating NUL; it must not reach the file.
   int count = total - 1;

   int fh = FileOpen(tmp, FILE_WRITE | FILE_BIN);
   if(fh == INVALID_HANDLE)
     {
      Print("SymbolSpecsExport: cannot open ", tmp, " err=", GetLastError());
      return false;
     }

   uint written = FileWriteArray(fh, bytes, 0, count);
   FileClose(fh);

   if(written != (uint)count)
     {
      Print("SymbolSpecsExport: short write (", written, "/", count, ")");
      FileDelete(tmp);
      return false;
     }

   if(!FileMove(tmp, 0, filename, FILE_REWRITE))
     {
      Print("SymbolSpecsExport: rename failed err=", GetLastError());
      FileDelete(tmp);
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| One export: read the figures, check them, write the file.          |
//|                                                                   |
//| Anything doubtful LEAVES THE PREVIOUS FILE IN PLACE. A figure that |
//| cannot be read, is not a number, or makes no sense (a contract     |
//| size of 0) must never reach Engine 4: a lot is sized from these,   |
//| and "missing" is not "zero".                                       |
//+------------------------------------------------------------------+
void ExportSpecs()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
     {
      Print("SymbolSpecsExport: terminal not connected, skipping cycle.");
      return;
     }

   if(g_count < InpMinSamples)
     {
      PrintFormat("SymbolSpecsExport: warming up, %d of %d spread samples (quotes must be live); nothing written.",
                  g_count, InpMinSamples);
      return;
     }

   double contractSize = 0.0, volumeMin = 0.0, volumeStep = 0.0, volumeMax = 0.0;
   double tickSize = 0.0, swapLong = 0.0, swapShort = 0.0, point = 0.0;
   long   digits = 0, swapMode = 0;

   ResetLastError();
   if(!SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE, contractSize) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN, volumeMin) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP, volumeStep) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX, volumeMax) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE, tickSize) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_SWAP_LONG, swapLong) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_SWAP_SHORT, swapShort) ||
      !SymbolInfoDouble(_Symbol, SYMBOL_POINT, point) ||
      !SymbolInfoInteger(_Symbol, SYMBOL_DIGITS, digits) ||
      !SymbolInfoInteger(_Symbol, SYMBOL_SWAP_MODE, swapMode))
     {
      Print("SymbolSpecsExport: a symbol property could not be read, err=", GetLastError(),
            " -- leaving the previous export in place.");
      return;
     }

   if(!MathIsValidNumber(contractSize) || !MathIsValidNumber(volumeMin) ||
      !MathIsValidNumber(volumeStep) || !MathIsValidNumber(volumeMax) ||
      !MathIsValidNumber(tickSize) || !MathIsValidNumber(swapLong) ||
      !MathIsValidNumber(swapShort) || !MathIsValidNumber(point))
     {
      Print("SymbolSpecsExport: a symbol property is not a valid number -- leaving the previous export in place.");
      return;
     }

   if(contractSize <= 0.0 || volumeMin <= 0.0 || volumeStep <= 0.0 || volumeMax < volumeMin ||
      tickSize <= 0.0 || point <= 0.0 || digits < 0 || swapMode < 0)
     {
      PrintFormat("SymbolSpecsExport: implausible figures (contract %s, volume %s..%s step %s, tick %s, point %s, digits %I64d, swap mode %I64d) -- leaving the previous export in place.",
                  Num(contractSize), Num(volumeMin), Num(volumeMax), Num(volumeStep),
                  Num(tickSize), Num(point), digits, swapMode);
      return;
     }

   double typicalSpread = MedianSpread();
   if(typicalSpread < 0.0)
     {
      Print("SymbolSpecsExport: could not compute the median spread -- leaving the previous export in place.");
      return;
     }

   long offset     = ServerToUtcOffset();
   long capturedAt = (long)TimeTradeServer() - offset;   // UTC

   string row =
      IntegerToString(capturedAt)  + "\t" +
      InpSymbol                    + "\t" +
      Num(contractSize)            + "\t" +
      Num(volumeMin)               + "\t" +
      Num(volumeStep)              + "\t" +
      Num(volumeMax)               + "\t" +
      Num(tickSize)                + "\t" +
      Num(typicalSpread)           + "\t" +
      Num(swapLong)                + "\t" +
      Num(swapShort)               + "\t" +
      Num(point)                   + "\t" +
      IntegerToString(digits)      + "\t" +
      IntegerToString(swapMode);

   if(WriteUtf8Atomic(g_outFile, COLUMNS + "\r\n" + row + "\r\n"))
      PrintFormat("SymbolSpecsExport: %s written, captured_at=%I64d, contract %s, volume %s..%s step %s, typical spread %s points (%d samples), offset=%dh",
                  g_outFile, capturedAt, Num(contractSize), Num(volumeMin), Num(volumeMax),
                  Num(volumeStep), Num(typicalSpread), g_count, (int)(offset / 3600));
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringLen(InpSymbol) == 0)
     {
      Print("SymbolSpecsExport: InpSymbol must not be empty.");
      return INIT_PARAMETERS_INCORRECT;
     }
   // The chart's symbol is what is read. Figures read from the wrong chart
   // (EURUSD, with a contract size of 100000) would be stored under this name
   // and used to size a gold lot, so refuse rather than export.
   if(StringFind(_Symbol, InpSymbol) != 0)
     {
      Print("SymbolSpecsExport: this chart is ", _Symbol, ", not ", InpSymbol,
            ". Attach the exporter to a ", InpSymbol, " chart.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpSampleSec < 10 || InpExportSec < InpSampleSec || InpWindowSamples < 1 ||
      InpMinSamples < 1 || InpMinSamples > InpWindowSamples || InpMaxQuoteAgeSec < 1)
     {
      Print("SymbolSpecsExport: invalid inputs (InpSampleSec >= 10, InpExportSec >= InpSampleSec, ",
            "1 <= InpMinSamples <= InpWindowSamples, InpMaxQuoteAgeSec >= 1).");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(ArrayResize(g_samples, InpWindowSamples) != InpWindowSamples)
     {
      Print("SymbolSpecsExport: cannot allocate the sample window.");
      return INIT_FAILED;
     }
   g_count = 0;
   g_next  = 0;
   g_ticksSinceExport = 0;
   g_outFile = "SymbolSpecs_" + InpSymbol + ".txt";

   if(!EventSetTimer(InpSampleSec))
     {
      Print("SymbolSpecsExport: EventSetTimer failed err=", GetLastError());
      return INIT_FAILED;
     }

   PrintFormat("SymbolSpecsExport: started on %s (stored as %s), sampling every %ds, writing %s every %ds",
               _Symbol, InpSymbol, InpSampleSec, g_outFile, InpExportSec);

   SampleSpread();
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   SampleSpread();
   g_ticksSinceExport++;
   if((long)g_ticksSinceExport * InpSampleSec >= InpExportSec)
     {
      g_ticksSinceExport = 0;
      ExportSpecs();
     }
  }

//+------------------------------------------------------------------+
//| Required for an EA, deliberately empty -- this one never trades.  |
//+------------------------------------------------------------------+
void OnTick()
  {
  }
//+------------------------------------------------------------------+
