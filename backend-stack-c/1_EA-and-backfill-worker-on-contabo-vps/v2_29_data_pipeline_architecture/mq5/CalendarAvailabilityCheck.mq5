//+------------------------------------------------------------------+
//|                                    CalendarAvailabilityCheck.mq5 |
//|                                                                  |
//|  STEP ZERO - go/no-go probe for the Market Session & High Impact  |
//|  News/Event Countdown feature.                                    |
//|                                                                  |
//|  QUESTION THIS ANSWERS:                                          |
//|    Does MT5's built-in Economic Calendar API return usable data   |
//|    on THIS terminal, with THIS broker, right now?                 |
//|                                                                  |
//|    If YES -> the news lane can be sourced from the terminal that  |
//|              already runs the 13 export indicators. No vendor,    |
//|              no API key, no new cost.                             |
//|    If NO  -> fall back to a server-side calendar API polled by    |
//|              operation-service's existing cron registry.          |
//|                                                                  |
//|  HOW TO RUN:                                                     |
//|    1. Copy to  <TerminalDataFolder>\MQL5\Scripts\                 |
//|    2. Compile in MetaEditor (F7).                                 |
//|    3. Drag onto ANY open chart. Accept the inputs dialog.          |
//|    4. Read the "Experts" tab, and/or send back the report file     |
//|       written to  <TerminalDataFolder>\MQL5\Files\                 |
//|                                                                  |
//|  SAFETY: read-only. Places no orders, touches no chart objects,   |
//|  writes nothing except its own report .txt. Safe to run on the    |
//|  live Contabo terminal while the pipeline is running.             |
//|                                                                  |
//|  Uses ONLY native MQL5 calendar calls - deliberately does NOT     |
//|  include davintrade-news-stack/ so that a failure is unambiguous  |
//|  (API unavailable, not a library bug), and so this can be run     |
//|  before the library's licensing question is settled.              |
//+------------------------------------------------------------------+
#property copyright "DavinTrade"
#property version   "1.00"
#property script_show_inputs
#property description "Step Zero probe: is the MT5 built-in Economic Calendar usable on this terminal?"

//--- inputs
input int    InpLookaheadDays = 7;     // Days to look FORWARD (countdown needs future events)
input int    InpLookbackDays  = 1;     // Days to look BACK (proves 'actual' values land)
input string InpCurrency      = "USD"; // Currency filter to test (XAUUSD is USD-driven)
input int    InpSampleRows    = 12;    // How many upcoming events to print as a sample
input bool   InpWriteReport   = true;  // Also write the report to MQL5\Files\

//--- report buffer (printed to Experts tab AND written to file)
string g_report[];
int    g_lines = 0;

//--- ASCII ONLY in every output string below. FILE_ANSI mangles non-ASCII
//--- (this stack already hit that with an em-dash in a statistic header).

//+------------------------------------------------------------------+
//| Print a line and retain it for the report file                   |
//+------------------------------------------------------------------+
void Say(const string line)
  {
   Print(line);
   if(g_lines >= ArraySize(g_report))
      ArrayResize(g_report, g_lines + 128);
   g_report[g_lines++] = line;
  }

//+------------------------------------------------------------------+
//| Human-readable importance                                        |
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
   return "UNKNOWN_" + IntegerToString((int)imp);
  }

//+------------------------------------------------------------------+
//| Calendar values are stored x10^6, with LONG_MIN meaning 'unset'. |
//| The distinction matters: a real 0.0 forecast is NOT missing data.|
//+------------------------------------------------------------------+
string CalValue(const long raw, const uint digits)
  {
   if(raw == LONG_MIN)
      return "n/a";
   return DoubleToString(raw / 1000000.0, (int)digits);
  }

//+------------------------------------------------------------------+
//| Seconds -> "Xd HH:MM:SS" (this is the countdown the UI shows)    |
//+------------------------------------------------------------------+
string Duration(const long seconds)
  {
   if(seconds < 0)
      return "-" + Duration(-seconds);

   long d = seconds / 86400;
   long h = (seconds % 86400) / 3600;
   long m = (seconds % 3600) / 60;
   long s = seconds % 60;

   if(d > 0)
      return StringFormat("%dd %02d:%02d:%02d", (int)d, (int)h, (int)m, (int)s);
   return StringFormat("%02d:%02d:%02d", (int)h, (int)m, (int)s);
  }

//+------------------------------------------------------------------+
//| Pad/trim a string to a fixed width so the sample table lines up  |
//+------------------------------------------------------------------+
string Fit(const string src, const int width)
  {
   string s = src;
   if(StringLen(s) > width)
      return StringSubstr(s, 0, width);
   while(StringLen(s) < width)
      s += " ";
   return s;
  }

//+------------------------------------------------------------------+
//| Write the accumulated report to MQL5\Files\                      |
//+------------------------------------------------------------------+
void WriteReport(void)
  {
   if(!InpWriteReport)
      return;

   string fname = "calendar_availability_report.txt";
   int fh = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE)
     {
      Print("Could not write report file. Error = ", GetLastError(),
            " (the Experts-tab output above is complete on its own.)");
      return;
     }

   for(int i = 0; i < g_lines; i++)
      FileWrite(fh, g_report[i]);

   FileClose(fh);
   Print("Report written to MQL5\\Files\\", fname, " - send this file back.");
  }

//+------------------------------------------------------------------+
//| Script entry point                                               |
//+------------------------------------------------------------------+
void OnStart()
  {
   ArrayResize(g_report, 256);

   Say("==================================================================");
   Say(" STEP ZERO - MT5 BUILT-IN ECONOMIC CALENDAR AVAILABILITY CHECK");
   Say("==================================================================");
   Say("Terminal : " + TerminalInfoString(TERMINAL_NAME)
       + " (build " + IntegerToString(TerminalInfoInteger(TERMINAL_BUILD)) + ")");
   Say("Broker   : " + AccountInfoString(ACCOUNT_COMPANY));
   Say("Server   : " + AccountInfoString(ACCOUNT_SERVER));
   Say("Chart    : " + _Symbol);
   Say("Connected: " + (TerminalInfoInteger(TERMINAL_CONNECTED) ? "YES" : "NO  <-- calendar needs a live connection"));
   Say("");

   //=================================================================
   // SECTION 1 - CLOCK REFERENCE
   //
   // Highest-value part of this probe. This stack shipped a two-year
   // timestamp bug because an offset was ASSUMED rather than measured
   // (gmt_offset was built from TimeCurrent(), the last TICK time, not
   // a clock). Do not repeat that for calendar times: measure which
   // clock MqlCalendarValue.time is expressed in, empirically.
   //=================================================================
   datetime t_current = TimeCurrent();
   datetime t_gmt     = TimeGMT();
   datetime t_server  = TimeTradeServer();
   datetime t_local   = TimeLocal();

   // Same computation the fixed export indicators now use, so the number
   // below is directly comparable to what the pipeline stamps on bars.
   long   srv_off_raw     = (long)t_server - (long)t_gmt;
   double srv_off_hrs     = srv_off_raw / 3600.0;
   long   srv_off_rounded = (long)MathRound(srv_off_hrs) * 3600;

   Say("------------------------------------------------------------------");
   Say(" 1. CLOCK REFERENCE (needed to place events on the right second)");
   Say("------------------------------------------------------------------");
   Say("TimeGMT()         = " + TimeToString(t_gmt,     TIME_DATE | TIME_SECONDS));
   Say("TimeTradeServer() = " + TimeToString(t_server,  TIME_DATE | TIME_SECONDS));
   Say("TimeCurrent()     = " + TimeToString(t_current, TIME_DATE | TIME_SECONDS)
       + "   (last TICK time - NOT a clock, do not build offsets from this)");
   Say("TimeLocal()       = " + TimeToString(t_local,   TIME_DATE | TIME_SECONDS));
   Say("");
   Say("Server-vs-GMT offset : " + DoubleToString(srv_off_hrs, 4) + " h"
       + "  -> rounded " + IntegerToString((int)(srv_off_rounded / 3600)) + " h"
       + "  (matches the pipeline's own hour-rounding)");
   Say("Tick lag (Current-Server) : " + IntegerToString((int)((long)t_current - (long)t_server)) + " s"
       + "   (this is exactly what the old gmt_offset bug leaked into every row)");
   Say("");

   //=================================================================
   // SECTION 2 - THE GO/NO-GO PROBE
   //=================================================================
   datetime from = (datetime)((long)t_server - (long)InpLookbackDays  * 86400);
   datetime to   = (datetime)((long)t_server + (long)InpLookaheadDays * 86400);

   Say("------------------------------------------------------------------");
   Say(" 2. CALENDAR REACHABILITY (the go/no-go)");
   Say("------------------------------------------------------------------");
   Say("Window: " + TimeToString(from, TIME_DATE | TIME_MINUTES)
       + "  ->  " + TimeToString(to, TIME_DATE | TIME_MINUTES)
       + "   (" + IntegerToString(InpLookbackDays + InpLookaheadDays) + " days, server time)");

   MqlCalendarValue all[];
   ResetLastError();
   int total_all = CalendarValueHistory(all, from, to, NULL, NULL);
   int err_all   = GetLastError();

   Say("CalendarValueHistory(all currencies) -> " + IntegerToString(total_all)
       + " rows, GetLastError() = " + IntegerToString(err_all));

   if(total_all < 0)
     {
      Say("");
      Say("*** VERDICT: BLOCKED ***");
      Say("The calendar API FAILED on this terminal (negative return).");
      Say("Common causes: terminal not connected; the broker's server does");
      Say("not serve MetaQuotes calendar data; calendar disabled in this");
      Say("terminal's settings.");
      Say("");
      Say("ACTION: do NOT build the MT5-sourced news lane. Use the fallback");
      Say("(server-side calendar API polled by operation-service cron).");
      Say("Send back the GetLastError() number above.");
      Say("==================================================================");
      WriteReport();
      return;
     }

   if(total_all == 0)
     {
      Say("");
      Say("*** VERDICT: INCONCLUSIVE - reachable but EMPTY ***");
      Say("The API answered without error but returned zero events for a "
          + IntegerToString(InpLookbackDays + InpLookaheadDays) + "-day window.");
      Say("A real calendar is never empty over 7 days. This usually means the");
      Say("calendar is reachable but not populated on this terminal yet.");
      Say("");
      Say("ACTION: leave the terminal connected for a few minutes, open");
      Say("Toolbox -> Calendar once to force a sync, then re-run this script.");
      Say("If it is still 0, treat as BLOCKED and use the fallback.");
      Say("==================================================================");
      WriteReport();
      return;
     }

   //=================================================================
   // SECTION 3 - CURRENCY FILTERING (server-side or client-side?)
   //=================================================================
   Say("");
   Say("------------------------------------------------------------------");
   Say(" 3. CURRENCY FILTER (can we narrow at the source?)");
   Say("------------------------------------------------------------------");

   MqlCalendarValue cur[];
   ResetLastError();
   int total_cur = CalendarValueHistory(cur, from, to, NULL, InpCurrency);
   int err_cur   = GetLastError();

   Say("CalendarValueHistory(currency=" + InpCurrency + ") -> "
       + IntegerToString(total_cur) + " rows, GetLastError() = " + IntegerToString(err_cur));

   if(total_cur > 0 && total_cur < total_all)
      Say("Server-side currency filtering WORKS - the collector can narrow at source.");
   else
      if(total_cur == total_all)
         Say("NOTE: filtered count == unfiltered count. Filter may be ignored; filter client-side.");
      else
         Say("NOTE: currency filter returned nothing usable. Filter client-side instead.");

   //--- choose the working set for the countdown test
   bool use_filtered = (total_cur > 0);
   int  work_total   = use_filtered ? total_cur : total_all;
   Say("Countdown test will use the "
       + (use_filtered ? (InpCurrency + "-filtered") : "unfiltered")
       + " set (" + IntegerToString(work_total) + " rows).");

   //=================================================================
   // SECTION 4 - EVENT/COUNTRY RESOLUTION + IMPORTANCE CENSUS
   //
   // MqlCalendarValue does NOT carry importance or a name. Those live on
   // MqlCalendarEvent, resolved by id. If CalendarEventById fails, the
   // whole feature fails - so test it explicitly rather than assuming.
   //=================================================================
   Say("");
   Say("------------------------------------------------------------------");
   Say(" 4. EVENT RESOLUTION + IMPORTANCE CENSUS (over all currencies)");
   Say("------------------------------------------------------------------");

   int n_all        = ArraySize(all);
   int resolve_ok   = 0, resolve_fail = 0;
   int country_ok   = 0, country_fail = 0;
   int c_none = 0, c_low = 0, c_mod = 0, c_high = 0;

   for(int i = 0; i < n_all; i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(all[i].event_id, ev))
        {
         resolve_fail++;
         continue;
        }
      resolve_ok++;

      switch(ev.importance)
        {
         case CALENDAR_IMPORTANCE_NONE:
            c_none++;
            break;
         case CALENDAR_IMPORTANCE_LOW:
            c_low++;
            break;
         case CALENDAR_IMPORTANCE_MODERATE:
            c_mod++;
            break;
         case CALENDAR_IMPORTANCE_HIGH:
            c_high++;
            break;
        }

      MqlCalendarCountry co;
      if(CalendarCountryById(ev.country_id, co))
         country_ok++;
      else
         country_fail++;
     }

   Say("CalendarEventById   : " + IntegerToString(resolve_ok) + " ok / "
       + IntegerToString(resolve_fail) + " failed");
   Say("CalendarCountryById : " + IntegerToString(country_ok) + " ok / "
       + IntegerToString(country_fail) + " failed");
   Say("");
   Say("Importance census over " + IntegerToString(n_all) + " events:");
   Say("   HIGH     = " + IntegerToString(c_high) + "   <-- the countdown only cares about these");
   Say("   MODERATE = " + IntegerToString(c_mod));
   Say("   LOW      = " + IntegerToString(c_low));
   Say("   NONE     = " + IntegerToString(c_none));

   //=================================================================
   // SECTION 5 - THE COUNTDOWN PRIMITIVE
   //
   // Produces the exact number the UI panel would render. Scans for the
   // minimum future timestamp rather than assuming the array is sorted -
   // ordering is not documented as guaranteed.
   //=================================================================
   Say("");
   Say("------------------------------------------------------------------");
   Say(" 5. COUNTDOWN PRIMITIVE (the 05:19:08 in the mockup)");
   Say("------------------------------------------------------------------");

   int      best_idx    = -1;
   datetime best_time   = 0;
   string   best_name   = "";
   string   best_ccy    = "";
   long     best_fc     = LONG_MIN;
   long     best_prev   = LONG_MIN;
   uint     best_digits = 0;

   for(int i = 0; i < work_total; i++)
     {
      datetime vt = use_filtered ? cur[i].time : all[i].time;
      if(vt <= t_server)
         continue;
      if(best_idx >= 0 && vt >= best_time)
         continue;

      ulong evid = use_filtered ? cur[i].event_id : all[i].event_id;
      MqlCalendarEvent ev;
      if(!CalendarEventById(evid, ev))
         continue;
      if(ev.importance != CALENDAR_IMPORTANCE_HIGH)
         continue;

      MqlCalendarCountry co;
      string ccy = CalendarCountryById(ev.country_id, co) ? co.currency : "?";

      best_idx    = i;
      best_time   = vt;
      best_name   = ev.name;
      best_ccy    = ccy;
      best_digits = ev.digits;
      best_fc     = use_filtered ? cur[i].forecast_value : all[i].forecast_value;
      best_prev   = use_filtered ? cur[i].prev_value     : all[i].prev_value;
     }

   if(best_idx < 0)
     {
      Say("No upcoming HIGH-impact event found in the next "
          + IntegerToString(InpLookaheadDays) + " days for this set.");
      Say("Not necessarily a failure (a quiet week is possible), but re-run");
      Say("with a wider InpLookaheadDays before trusting it.");
     }
   else
     {
      long secs = (long)best_time - (long)t_server;
      Say("NEXT HIGH-IMPACT EVENT:");
      Say("   Name      : " + best_name);
      Say("   Currency  : " + best_ccy);
      Say("   At        : " + TimeToString(best_time, TIME_DATE | TIME_SECONDS) + " (server time)");
      Say("   Forecast  : " + CalValue(best_fc,   best_digits));
      Say("   Previous  : " + CalValue(best_prev, best_digits));
      Say("   COUNTDOWN : " + Duration(secs) + "   <-- this is the UI number");
     }

   //=================================================================
   // SECTION 6 - DATA QUALITY: forecast coverage, and do actuals land?
   //=================================================================
   Say("");
   Say("------------------------------------------------------------------");
   Say(" 6. DATA QUALITY (drives how useful the LLM warning can be)");
   Say("------------------------------------------------------------------");

   int fut_high = 0, fut_high_with_fc = 0;
   int past_high = 0, past_high_with_actual = 0;

   for(int i = 0; i < n_all; i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(all[i].event_id, ev))
         continue;
      if(ev.importance != CALENDAR_IMPORTANCE_HIGH)
         continue;

      if(all[i].time > t_server)
        {
         fut_high++;
         if(all[i].forecast_value != LONG_MIN)
            fut_high_with_fc++;
        }
      else
        {
         past_high++;
         if(all[i].actual_value != LONG_MIN)
            past_high_with_actual++;
        }
     }

   Say("Upcoming HIGH events        : " + IntegerToString(fut_high));
   Say("  ...carrying a forecast    : " + IntegerToString(fut_high_with_fc)
       + "   (forecast is what makes a pre-event warning worth reading)");
   Say("Past HIGH events in window  : " + IntegerToString(past_high));
   Say("  ...carrying an actual     : " + IntegerToString(past_high_with_actual)
       + "   (proves values land after release -> the row must be UPSERT, not append-only)");

   //=================================================================
   // SECTION 7 - VOLUME (sizes the table and the sync cadence)
   //=================================================================
   int    span_days = InpLookbackDays + InpLookaheadDays;
   double per_day   = (span_days > 0) ? (double)n_all / (double)span_days : 0.0;

   Say("");
   Say("------------------------------------------------------------------");
   Say(" 7. VOLUME (sizes the table + sync cadence)");
   Say("------------------------------------------------------------------");
   Say("Events in window : " + IntegerToString(n_all)
       + " over " + IntegerToString(span_days) + " days");
   Say("Approx per day   : " + DoubleToString(per_day, 1));
   Say("Approx per year  : " + IntegerToString((int)(per_day * 365))
       + "   (compare: market_data is ~1M rows/yr - news is a rounding error)");

   //=================================================================
   // SECTION 8 - SAMPLE OF UPCOMING EVENTS (eyeball coverage quality)
   //=================================================================
   Say("");
   Say("------------------------------------------------------------------");
   Say(" 8. NEXT " + IntegerToString(InpSampleRows) + " UPCOMING EVENTS (any importance, all currencies)");
   Say("------------------------------------------------------------------");
   Say(Fit("WHEN (server)", 20) + Fit("CCY", 5) + Fit("IMPORTANCE", 11)
       + Fit("FORECAST", 12) + "EVENT");

   bool used[];
   ArrayResize(used, n_all);
   ArrayInitialize(used, false);

   for(int pick = 0; pick < InpSampleRows; pick++)
     {
      int      sel   = -1;
      datetime sel_t = 0;

      for(int i = 0; i < n_all; i++)
        {
         if(used[i] || all[i].time <= t_server)
            continue;
         if(sel < 0 || all[i].time < sel_t)
           {
            sel   = i;
            sel_t = all[i].time;
           }
        }

      if(sel < 0)
         break;
      used[sel] = true;

      MqlCalendarEvent ev;
      if(!CalendarEventById(all[sel].event_id, ev))
         continue;

      MqlCalendarCountry co;
      string ccy = CalendarCountryById(ev.country_id, co) ? co.currency : "?";

      Say(Fit(TimeToString(sel_t, TIME_DATE | TIME_MINUTES), 20)
          + Fit(ccy, 5)
          + Fit(ImportanceToString(ev.importance), 11)
          + Fit(CalValue(all[sel].forecast_value, ev.digits), 12)
          + ev.name);
     }

   //=================================================================
   // SECTION 9 - VERDICT
   //=================================================================
   bool pass_resolution = (resolve_ok > 0 && resolve_fail == 0);
   bool pass_high       = (c_high > 0);
   bool pass_countdown  = (best_idx >= 0);

   Say("");
   Say("==================================================================");
   Say(" VERDICT");
   Say("==================================================================");
   Say("Calendar reachable        : YES (" + IntegerToString(total_all) + " events)");
   Say("Event/country resolution  : " + (pass_resolution ? "PASS" : "CHECK - some lookups failed"));
   Say("HIGH-impact events present: " + (pass_high ? "PASS" : "FAIL - none found"));
   Say("Countdown computable      : " + (pass_countdown ? "PASS" : "CHECK - no future HIGH event in window"));
   Say("");

   if(pass_resolution && pass_high && pass_countdown)
     {
      Say("*** GO - build the MT5-sourced news lane. ***");
      Say("The terminal that already runs the 13 indicators can also serve");
      Say("the calendar. No vendor, no API key, no new cost.");
     }
   else
      if(pass_high)
        {
         Say("*** QUALIFIED GO - usable, with a caveat above. ***");
         Say("Re-run with a larger InpLookaheadDays before deciding.");
        }
      else
        {
         Say("*** NO-GO on HIGH-impact data. ***");
         Say("Calendar answers but carries no HIGH-impact events - it cannot");
         Say("drive the countdown. Use the server-side calendar API fallback.");
        }

   Say("");
   Say("Send back: this whole output, and note the Section 1 offset - the");
   Say("collector must convert calendar times the same way the bar exports do.");
   Say("==================================================================");

   WriteReport();
  }
//+------------------------------------------------------------------+
