//+------------------------------------------------------------------+
//|                                   EconomicCalendarExport_v2_29.mq5 |
//|                                                                    |
//|  Exports MT5's built-in Economic Calendar to a tab-separated .txt  |
//|  for the v6 collector, on the same terminal that runs the 13       |
//|  export indicators. No vendor, no API key, no new cost.            |
//|                                                                    |
//|  WHY AN EA AND NOT A SCRIPT: this has to run unattended every few  |
//|  minutes. Attach to ONE chart (any symbol -- the calendar is       |
//|  global, not symbol-scoped). It draws nothing, trades nothing, and |
//|  touches no chart objects.                                         |
//|                                                                    |
//|  WHY A .txt AND NOT DIRECT SQLITE: in the v6 flow the Python       |
//|  collector is the ONLY writer of xauusd.db. MQL5 can write SQLite  |
//|  (the legacy EA's WriteSQLiteBackup did, and the vendor library's  |
//|  provider_sqlite.mqh does), but a second writer against the same   |
//|  file buys lock contention and "database is locked" failures for   |
//|  nothing. Export files are the source of truth -- blueprint section 3.3.  |
//|                                                                    |
//|  THIS EXPORTER IS DELIBERATELY DUMB. It writes a full SNAPSHOT of  |
//|  the window every cycle and makes no attempt to detect changes or  |
//|  avoid duplicates. Deciding whether a row is new -- the            |
//|  append-only logic -- belongs in the collector, where it is        |
//|  testable in Python. Do not add change detection here.             |
//+------------------------------------------------------------------+
#property copyright "DavinTrade"
#property version   "1.00"
#property description "Exports the MT5 built-in Economic Calendar for the v6 collector."
#property strict

//--- inputs
input int    InpIntervalSec    = 900;                    // Export interval (seconds); 900 = 15 min
input int    InpLookbackDays   = 2;                      // Days back (lets published 'actual' values land)
input int    InpLookaheadDays  = 14;                     // Days forward (countdown + LLM context)
input string InpCurrencyFilter = "";                     // Currency filter, "" = ALL (recommended)
input string InpOutFile        = "EconomicCalendar.txt"; // Output file in MQL5\Files\

//--- the exact column order the collector parses by NAME (order is cosmetic,
//--- names are the contract). Matches gateway_contract_economic_events.schema.json
//--- minus terminal_id, which the push worker adds.
const string COLUMNS =
   "value_id\tcaptured_at\tevent_id\tevent_time\tevent_period\trevision\t"
   "country_code\tcurrency\tevent_name\timportance\t"
   "event_type\tsector\tfrequency\ttime_mode\tunit\tmultiplier\tdigits\t"
   "event_code\tsource_url\t"
   "actual_value\tforecast_value\tprev_value\trevised_prev_value\timpact_type";

//+------------------------------------------------------------------+
//| Hour-rounded server->GMT offset.                                  |
//|                                                                   |
//| Identical to what the 13 fixed export indicators now compute.      |
//| MqlCalendarValue.time is SERVER time, so without this every event  |
//| would be stamped hours wrong. Deliberately NOT built from          |
//| TimeCurrent(): that returns the last TICK time, not a clock, and   |
//| using it is exactly the bug that mis-stamped every pipeline row    |
//| for two years. Recomputed each cycle because broker offsets change |
//| with DST -- never cache or hardcode this.                          |
//+------------------------------------------------------------------+
long ServerToUtcOffset()
  {
   long raw = (long)TimeTradeServer() - (long)TimeGMT();
   return (long)MathRound(raw / 3600.0) * 3600;
  }

//+------------------------------------------------------------------+
//| Importance enum -> the contract's string form                     |
//+------------------------------------------------------------------+
string ImportanceToString(const ENUM_CALENDAR_EVENT_IMPORTANCE imp)
  {
   switch(imp)
     {
      case CALENDAR_IMPORTANCE_NONE:
         return "NONE";
      case CALENDAR_IMPORTANCE_LOW:
         return "LOW";
      case CALENDAR_IMPORTANCE_MODERATE:
         return "MODERATE";
      case CALENDAR_IMPORTANCE_HIGH:
         return "HIGH";
     }
   return "NONE";
  }

//+------------------------------------------------------------------+
//| A calendar value, or EMPTY for "not published".                   |
//|                                                                   |
//| !! LONG_MIN means the figure does not exist, and an empty field is |
//| how this pipeline spells NULL. A real 0.0 reading is DATA -- it    |
//| must never be conflated with absence. For forecasts, absence is    |
//| the common case: rate decisions, votes and speeches carry no       |
//| numeric forecast at all.                                          |
//+------------------------------------------------------------------+
string ValueOrEmpty(const long raw, const uint digits)
  {
   if(raw == LONG_MIN)
      return "";
   return DoubleToString(raw / 1000000.0, (int)digits);
  }

//+------------------------------------------------------------------+
//| Make a free-text field safe for a tab-separated line.             |
//|                                                                   |
//| Unlike the 13 numeric exporters, this one emits free text:        |
//| event_name and source_url come from upstream and can contain a    |
//| tab or a newline, either of which would silently shift every      |
//| later column on that row. Collapse them to spaces.                |
//+------------------------------------------------------------------+
string Sanitize(string value)
  {
   StringReplace(value, "\t", " ");
   StringReplace(value, "\r", " ");
   StringReplace(value, "\n", " ");
   return value;
  }

//+------------------------------------------------------------------+
//| Write `content` as genuine UTF-8 bytes.                           |
//|                                                                   |
//| !! NOT FileWriteString with FILE_ANSI, which the 13 numeric        |
//| exporters use. FILE_ANSI writes the system codepage; the Python    |
//| collector opens every export with encoding='utf-8'. That works for |
//| the others only because their content is pure ASCII. Event names   |
//| are free text and can be non-ASCII ("Banco de Mexico"), and a      |
//| single CP1252 byte would raise UnicodeDecodeError and reject the   |
//| WHOLE file -- a failure that would first appear weeks in, on one   |
//| unlucky event. So: encode to UTF-8 explicitly and write binary.    |
//|                                                                   |
//| Written to a temp file and renamed, so the collector can never     |
//| read a half-written snapshot.                                     |
//+------------------------------------------------------------------+
bool WriteUtf8Atomic(const string filename, const string content)
  {
   string tmp = filename + ".tmp";

   uchar bytes[];
   int total = StringToCharArray(content, bytes, 0, WHOLE_ARRAY, CP_UTF8);
   if(total <= 0)
     {
      Print("EconomicCalendarExport: UTF-8 conversion failed.");
      return false;
     }
   // StringToCharArray appends a terminating NUL; it must not reach the file.
   int count = total - 1;

   int fh = FileOpen(tmp, FILE_WRITE | FILE_BIN);
   if(fh == INVALID_HANDLE)
     {
      Print("EconomicCalendarExport: cannot open ", tmp, " err=", GetLastError());
      return false;
     }

   uint written = FileWriteArray(fh, bytes, 0, count);
   FileClose(fh);

   if(written != (uint)count)
     {
      Print("EconomicCalendarExport: short write (", written, "/", count, ")");
      FileDelete(tmp);
      return false;
     }

   if(!FileMove(tmp, 0, filename, FILE_REWRITE))
     {
      Print("EconomicCalendarExport: rename failed err=", GetLastError());
      FileDelete(tmp);
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| One export cycle                                                  |
//+------------------------------------------------------------------+
void ExportCalendar()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
     {
      Print("EconomicCalendarExport: terminal not connected, skipping cycle.");
      return;
     }

   long     offset    = ServerToUtcOffset();
   datetime nowServer = TimeTradeServer();
   long     capturedAt = (long)nowServer - offset;   // UTC

   datetime from = (datetime)((long)nowServer - (long)InpLookbackDays  * 86400);
   datetime to   = (datetime)((long)nowServer + (long)InpLookaheadDays * 86400);

   string currency = (StringLen(InpCurrencyFilter) > 0) ? InpCurrencyFilter : NULL;

   MqlCalendarValue values[];
   ResetLastError();
   int total = CalendarValueHistory(values, from, to, NULL, currency);

   if(total < 0)
     {
      Print("EconomicCalendarExport: CalendarValueHistory failed err=", GetLastError(),
            " -- leaving the previous export in place.");
      return;
     }

   // A reachable-but-empty calendar is suspicious over a two-week window, but
   // it is not a reason to destroy a good previous snapshot.
   if(total == 0)
     {
      Print("EconomicCalendarExport: 0 events in window; previous export left intact.");
      return;
     }

   string body = "";
   int written = 0, skipped = 0;

   for(int i = 0; i < total; i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(values[i].event_id, ev))
        {
         skipped++;
         continue;
        }

      MqlCalendarCountry co;
      if(!CalendarCountryById(ev.country_id, co))
        {
         skipped++;
         continue;
        }

      long eventTimeUtc  = (long)values[i].time - offset;
      long eventPeriodUtc = (values[i].period > 0) ? ((long)values[i].period - offset) : 0;

      string row =
         IntegerToString((long)values[i].id)      + "\t" +
         IntegerToString(capturedAt)              + "\t" +
         IntegerToString((long)values[i].event_id) + "\t" +
         IntegerToString(eventTimeUtc)            + "\t" +
         (values[i].period > 0 ? IntegerToString(eventPeriodUtc) : "") + "\t" +
         IntegerToString(values[i].revision)      + "\t" +
         Sanitize(co.code)                        + "\t" +
         Sanitize(co.currency)                    + "\t" +
         Sanitize(ev.name)                        + "\t" +
         ImportanceToString(ev.importance)        + "\t" +
         IntegerToString((int)ev.type)            + "\t" +
         IntegerToString((int)ev.sector)          + "\t" +
         IntegerToString((int)ev.frequency)       + "\t" +
         IntegerToString((int)ev.time_mode)       + "\t" +
         IntegerToString((int)ev.unit)            + "\t" +
         IntegerToString((int)ev.multiplier)      + "\t" +
         IntegerToString((int)ev.digits)          + "\t" +
         Sanitize(ev.event_code)                  + "\t" +
         Sanitize(ev.source_url)                  + "\t" +
         ValueOrEmpty(values[i].actual_value,       ev.digits) + "\t" +
         ValueOrEmpty(values[i].forecast_value,     ev.digits) + "\t" +
         ValueOrEmpty(values[i].prev_value,         ev.digits) + "\t" +
         ValueOrEmpty(values[i].revised_prev_value, ev.digits) + "\t" +
         IntegerToString((int)values[i].impact_type);

      body += row + "\r\n";
      written++;
     }

   if(written == 0)
     {
      Print("EconomicCalendarExport: every event failed id resolution; export left intact.");
      return;
     }

   if(WriteUtf8Atomic(InpOutFile, COLUMNS + "\r\n" + body))
      PrintFormat("EconomicCalendarExport: %d events written (%d unresolved), captured_at=%I64d, offset=%dh",
                  written, skipped, capturedAt, (int)(offset / 3600));
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(InpIntervalSec < 60)
     {
      Print("EconomicCalendarExport: InpIntervalSec must be >= 60.");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(!EventSetTimer(InpIntervalSec))
     {
      Print("EconomicCalendarExport: EventSetTimer failed err=", GetLastError());
      return INIT_FAILED;
     }

   PrintFormat("EconomicCalendarExport: started, every %ds, window -%dd/+%dd, out=%s",
               InpIntervalSec, InpLookbackDays, InpLookaheadDays, InpOutFile);

   ExportCalendar();   // don't make the collector wait a full interval for the first file
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
   ExportCalendar();
  }

//+------------------------------------------------------------------+
//| Required for an EA, deliberately empty -- this one never trades.  |
//+------------------------------------------------------------------+
void OnTick()
  {
  }
//+------------------------------------------------------------------+
