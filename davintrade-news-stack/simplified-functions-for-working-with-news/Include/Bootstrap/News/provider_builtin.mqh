//+------------------------------------------------------------------+
//|                                                         news.mqh |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
//+------------------------------------------------------------------+
//| defines                                                          |
//+------------------------------------------------------------------+
#include "base.mqh"
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
class CNewsBuiltinProvider
  {
public:
                     CNewsBuiltinProvider(void) {};
                    ~CNewsBuiltinProvider(void) {};

   static int        Get(NewsStructure &results[], datetime from, datetime to, string currency, string country_code=NULL);
   static bool       Exists(datetime from, datetime to, string currency, int importance=-1, string country_code=NULL);

   static bool       Next(NewsStructure &out, string currency, const uint lookahead_seconds=900, string country_code=NULL);
   static bool       Next(NewsStructure &out, string currency, datetime from, const uint lookahead_seconds=900, string country_code=NULL);

   static bool       Previous(NewsStructure &out, string currency, const uint lookback_seconds=900, string country_code=NULL);
   static bool       Previous(NewsStructure &out, string currency, datetime from, const uint lookback_seconds=900, string country_code=NULL);
  };
//+------------------------------------------------------------------+
//| Retrieves economic news from the built-in MetaTrader 5 Economic  |
//| Calendar within the specified time range.                        |
//|                                                                  |
//| Parameters:                                                      |
//|   from         - Start of the search period.                     |
//|   to           - End of the search period.                       |
//|   results[]    - Output array receiving the retrieved news.      |
//|   currency     - Currency filter (e.g. "USD"). NULL retrieves    |
//|                  news for all currencies.                        |
//|   country_code - Country filter (ISO 3166-1 alpha-2, e.g. "US"). |
//|                  NULL retrieves news for all countries.          |
//|                                                                  |
//| Returns:                                                         |
//|   Number of news records retrieved, or -1 if the request fails.  |
//+------------------------------------------------------------------+
int CNewsBuiltinProvider::Get(NewsStructure &results[], datetime from, datetime to, string currency, string country_code=NULL)
  {

   MqlCalendarValue values[];
   MqlCalendarEvent event;
   MqlCalendarCountry country;

   int total = CalendarValueHistory(values, from, to, country_code, currency);
   if(total<0)
     {
      printf("Failed to get news from %s to %s. Error = %d", TimeToString(from), TimeToString(to), GetLastError());
      return -1;
     }

   ArrayResize(results, total);

//---

   for(int i=0; i<total; i++)
     {
      MqlCalendarEvent event;
      CalendarEventById(values[i].event_id, event); //Here among all the news we select one after the other by its id https://www.mql5.com/en/docs/calendar/calendareventbyid

      MqlCalendarCountry country; //The couhtry where the currency pair originates
      CalendarCountryById(event.country_id, country); //https://www.mql5.com/en/docs/calendar/calendarcountrybyid

      //---

      results[i].CountryAssign(country);
      results[i].EventAssign(event);
      results[i].ValueAssign(values[i]);
     }

   return total;
  }
//+------------------------------------------------------------------+
//| Checks whether one or more economic news events exist within the |
//| specified time range. Optionally filters the results by event    |
//| importance, currency, and country.                               |
//|                                                                  |
//| Parameters:                                                      |
//|   from         - Start of the search period.                     |
//|   to           - End of the search period.                       |
//|   importance   - Event importance filter. Use -1 to match any    |
//|                  importance level.                               |
//|   currency     - Currency filter (e.g. "USD"). NULL searches     |
//|                  all currencies.                                 |
//|   country_code - Country filter (ISO 3166-1 alpha-2, e.g. "US"). |
//|                  NULL searches all countries.                    |
//|                                                                  |
//| Returns:                                                         |
//|   true if at least one matching event exists; otherwise false.   |
//+------------------------------------------------------------------+
bool CNewsBuiltinProvider::Exists(datetime from, datetime to, string currency, int importance=-1, string country_code=NULL)
  {
//---

   NewsStructure candidates[];
   int total = Get(candidates, from, to, currency, country_code);

   if(total <= 0)
      return false;

   if(importance==-1)
      return true;

// Check for the requested importance
   ENUM_CALENDAR_EVENT_IMPORTANCE imp = (ENUM_CALENDAR_EVENT_IMPORTANCE)importance;

   for(int i=0; i<total; i++)
     {
      if(candidates[i].event_importance == imp)
         return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//| Returns the next economic news event occurring after the current |
//| terminal time.                                                   |
//|                                                                  |
//| Parameters:                                                      |
//|   out               - Receives the next matching news event.     |
//|   lookahead_seconds - Maximum number of seconds to search ahead. |
//|                       Default is 900 seconds (15 minutes).       |
//|   currency          - Currency filter (e.g. "USD"). NULL         |
//|                       searches all currencies.                   |
//|   country_code      - Country filter (ISO 3166-1 alpha-2,        |
//|                       e.g. "US"). NULL searches all countries.   |
//|                                                                  |
//| Returns:                                                         |
//|   true if a matching news event is found; otherwise false.       |
//+------------------------------------------------------------------+
bool CNewsBuiltinProvider::Next(NewsStructure &out,
                                string currency,
                                const datetime from,
                                const uint lookahead_seconds=900,
                                string country_code=NULL)
  {
   datetime now = from;
   datetime max_time = now + lookahead_seconds;

//---

   NewsStructure candidates[];

   int total = Get(candidates, now+1, max_time, currency, country_code);
   if(total > 0)
     {
      out = candidates[0]; // ascending order — first is nearest
      return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
bool CNewsBuiltinProvider::Next(NewsStructure &out,
                                string currency=NULL,
                                const uint lookahead_seconds=900,
                                string country_code=NULL)
  {
   return Next(out, currency, TimeCurrent(),lookahead_seconds, country_code);
  }
//+------------------------------------------------------------------+
//| Returns the most recent economic news event before the specified |
//| time.                                                            |
//|                                                                  |
//| Parameters:                                                      |
//|   from             - The reference time to search backwards      |
//|                      from.                                       |
//|   out              - Receives the most recent matching news      |
//|                      event.                                      |
//|   lookback_seconds - Maximum number of seconds to search         |
//|                      backwards. Default is 900 seconds           |
//|                      (15 minutes).                               |
//|   currency         - Currency filter (e.g. "USD"). NULL          |
//|                      searches all currencies.                    |
//|   country_code     - Country filter (ISO 3166-1 alpha-2,         |
//|                      e.g. "US"). NULL searches all countries.    |
//|                                                                  |
//| Returns:                                                         |
//|   true if a matching news event is found; otherwise false.       |
//+------------------------------------------------------------------+
bool CNewsBuiltinProvider::Previous(NewsStructure &out,
                                    string currency,
                                    const datetime from,
                                    const uint lookback_seconds=900,
                                    string country_code=NULL)
  {
   datetime start = from - (datetime)lookback_seconds;

   NewsStructure candidates[];

   int total = Get(candidates, start, from - 1, currency, country_code);
   if(total <= 0)
      return false;

// Events are sorted in ascending order by time.
   out = candidates[total - 1];
   return true;
  }
//+------------------------------------------------------------------+
bool CNewsBuiltinProvider::Previous(NewsStructure &out,
                                    string currency, 
                                    const uint lookback_seconds=900, 
                                    string country_code=NULL)
  {
   return Previous(out, currency, TimeCurrent(), lookback_seconds, country_code);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
