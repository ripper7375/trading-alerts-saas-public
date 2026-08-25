//+------------------------------------------------------------------+
//|                                                         base.mqh |
//|                                     Copyright 2026, Omega Joctan |
//|                 https://www.mql5.com/en/users/omegajoctan/seller |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Omega Joctan"
#property link      "https://www.mql5.com/en/users/omegajoctan/seller"
//+------------------------------------------------------------------+
//|            A custom news structure.                              |
//+------------------------------------------------------------------+
struct NewsStructure
  {
   //--- MqlCalendarCountry
   ulong                               country_id;                    // country ID (ISO 3166-1)
   string                              country_name;                  // country text name (in the current terminal encoding)
   string                              country_code;                  // country code name (ISO 3166-1 alpha-2)
   string                              country_currency;              // country currency code
   string                              country_currency_symbol;       // country currency symbol
   string                              url_name;                      // country name used in the mql5.com website URL

   //--- MqlCalendarEvent

   ulong                               event_id;                    // event ID
   ENUM_CALENDAR_EVENT_TYPE            event_type;                  // event type from the ENUM_CALENDAR_EVENT_TYPE enumeration
   ENUM_CALENDAR_EVENT_SECTOR          event_sector;                // sector an event is related to
   ENUM_CALENDAR_EVENT_FREQUENCY       event_frequency;             // event frequency
   ENUM_CALENDAR_EVENT_TIMEMODE        event_time_mode;             // event time mode
   ENUM_CALENDAR_EVENT_UNIT            event_unit;                  // economic indicator value's unit of measure
   ENUM_CALENDAR_EVENT_IMPORTANCE      event_importance;            // event importance
   ENUM_CALENDAR_EVENT_MULTIPLIER      event_multiplier;            // economic indicator value multiplier
   uint                                event_digits;                // number of decimal places
   string                              event_source_url;            // URL of a source where an event is published
   string                              event_code;                  // event code
   string                              event_name;                  // event text name in the terminal language (in the current terminal encoding)

   //--- MqlCalendarValue

   ulong                               value_id;              // value ID
   datetime                            value_time;            // event date and time
   datetime                            value_period;          // event reporting period
   int                                 value_revision;        // revision of the published indicator relative to the reporting period
   long                                actual_value;          // actual value multiplied by 10^6 or LONG_MIN if the value is not set
   long                                prev_value;            // previous value multiplied by 10^6 or LONG_MIN if the value is not set
   long                                revised_prev_value;    // revised previous value multiplied by 10^6 or LONG_MIN if the value is not set
   long                                forecast_value;        // forecast value multiplied by 10^6 or LONG_MIN if the value is not set
   ENUM_CALENDAR_EVENT_IMPACT          value_impact_type;     // potential impact on the currency rate

   //--- functions checking the values

   bool              HasActualValue(void) const   { return actual_value       != LONG_MIN; }
   bool              HasPreviousValue(void) const { return prev_value         != LONG_MIN; }
   bool              HasRevisedValue(void) const  { return revised_prev_value != LONG_MIN; }
   bool              HasForecastValue(void) const { return forecast_value     != LONG_MIN; }

   //--- functions receiving the values

   double            GetActualValue(void) const
     {
      return HasActualValue() ? actual_value / 1000000.0 : EMPTY_VALUE;
     }

   double            GetPreviousValue(void) const
     {
      return HasPreviousValue() ? prev_value / 1000000.0 : EMPTY_VALUE;
     }

   double            GetRevisedValue(void) const
     {
      return HasRevisedValue() ? revised_prev_value / 1000000.0 : EMPTY_VALUE;
     }

   double            GetForecastValue(void) const
     { return        HasForecastValue() ? forecast_value / 1000000.0 : EMPTY_VALUE; }

   //--- CSV helpers
   string            ArrayJoin(string &arr[], string delim)
     {
      string result = "";
      for(int i=0; i<ArraySize(arr); i++)
        {
         if(i>0)
            result += delim;
         result += arr[i];
        }
      return result;
     }

   string            EscapeCSV(string value, string delimiter)
     {
      if(StringFind(value, delimiter) >= 0 || StringFind(value, "\"") >= 0 || StringFind(value, "\n") >= 0)
        {
         StringReplace(value, "\"", "\"\""); // double up embedded quotes
         value = "\"" + value + "\"";
        }
      return value;
     }

   string            ToCSVLine(string delim=",")
     {
      string parts[];
      ArrayResize(parts, 29);
      int i=0;

      //--- MqlCalendarCountry

      parts[i++] = IntegerToString(country_id);
      parts[i++] = EscapeCSV(country_name, delim);
      parts[i++] = country_code;
      parts[i++] = country_currency;
      parts[i++] = country_currency_symbol;
      parts[i++] = url_name;

      //--- MqlCalendarEvent

      parts[i++] = IntegerToString(event_id);
      parts[i++] = (string)int(event_type);
      parts[i++] = (string)int(event_sector);
      parts[i++] = (string)int(event_frequency);
      parts[i++] = (string)int(event_time_mode);
      parts[i++] = (string)int(event_unit);
      parts[i++] = (string)int(event_importance);
      parts[i++] = (string)int(event_multiplier);
      parts[i++] = IntegerToString(event_digits);
      parts[i++] = EscapeCSV(event_source_url, delim);
      parts[i++] = event_code;
      parts[i++] = EscapeCSV(event_name, delim);

      //--- MqlCalendarValue

      parts[i++] = IntegerToString(value_id);
      parts[i++] = TimeToString(value_time, TIME_DATE|TIME_MINUTES);
      parts[i++] = TimeToString(value_period, TIME_DATE);
      parts[i++] = (string)value_revision;
      parts[i++] = HasActualValue()   ? DoubleToString(actual_value, event_digits)   : "";
      parts[i++] = HasPreviousValue() ? DoubleToString(prev_value, event_digits) : "";
      parts[i++] = HasRevisedValue()  ? DoubleToString(revised_prev_value, event_digits)  : "";
      parts[i++] = HasForecastValue() ? DoubleToString(forecast_value, event_digits) : "";
      parts[i++] = (string)int(value_impact_type);

      ArrayResize(parts, i);
      return ArrayJoin(parts, delim);
     }

   string            HeaderLine()
     {
      return "country_id,country_name,country_code,country_currency,country_currency_symbol,url_name,"
             "event_id,event_type,event_sector,event_frequency,event_time_mode,"
             "event_unit,event_importance,event_multiplier,event_digits,event_source_url,event_code,event_name,"
             "value_id,value_time,value_period,value_revision,"
             "actual_value,prev_value,revised_prev_value,forecast_value,value_impact_type";
     }

   //--- helpers for populating the structure

   void              CountryAssign(MqlCalendarCountry &country)
     {
      country_id = country.id;
      country_name = country.name;
      country_code = country.code;
      country_currency = country.currency;
      country_currency_symbol = country.currency_symbol;
      url_name = country.url_name;
     }

   void              EventAssign(MqlCalendarEvent &event)
     {
      event_id          = event.id;
      event_type         = event.type;
      event_sector       = event.sector;
      event_frequency    = event.frequency;
      event_time_mode    = event.time_mode;
      event_unit         = event.unit;
      event_importance   = event.importance;
      event_multiplier   = event.multiplier;
      event_digits       = event.digits;
      event_source_url   = event.source_url;
      event_code         = event.event_code;
      event_name         = event.name;
     }

   void              ValueAssign(MqlCalendarValue &value)
     {
      value_id           = value.id;
      value_time         = value.time;
      value_period       = value.period;
      value_revision     = value.revision;
      actual_value       = value.actual_value;
      prev_value         = value.prev_value;
      revised_prev_value = value.revised_prev_value;
      forecast_value     = value.forecast_value;
      value_impact_type  = value.impact_type;
     }
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
template<typename T>
bool StringToEnum(const string value,
                  const string &names[],
                  const T &values[],
                  T &result)
  {
   int total = ArraySize(names);

   for(int i = 0; i < total; i++)
     {
      if(names[i] == value)
        {
         result = values[i];
         return true;
        }
     }

   return false;
  }
//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_TYPE                                         |
//+------------------------------------------------------------------+
const string EventTypeNames[] =
  {
   "CALENDAR_TYPE_EVENT",
   "CALENDAR_TYPE_INDICATOR",
   "CALENDAR_TYPE_HOLIDAY"
  };

const ENUM_CALENDAR_EVENT_TYPE EventTypeValues[] =
  {
   CALENDAR_TYPE_EVENT,
   CALENDAR_TYPE_INDICATOR,
   CALENDAR_TYPE_HOLIDAY
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_FREQUENCY                                    |
//+------------------------------------------------------------------+
const string EventFrequencyNames[] =
  {
   "CALENDAR_FREQUENCY_NONE",
   "CALENDAR_FREQUENCY_WEEK",
   "CALENDAR_FREQUENCY_MONTH",
   "CALENDAR_FREQUENCY_QUARTER",
   "CALENDAR_FREQUENCY_YEAR",
   "CALENDAR_FREQUENCY_DAY"
  };

const ENUM_CALENDAR_EVENT_FREQUENCY EventFrequencyValues[] =
  {
   CALENDAR_FREQUENCY_NONE,
   CALENDAR_FREQUENCY_WEEK,
   CALENDAR_FREQUENCY_MONTH,
   CALENDAR_FREQUENCY_QUARTER,
   CALENDAR_FREQUENCY_YEAR,
   CALENDAR_FREQUENCY_DAY
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_SECTOR                                       |
//+------------------------------------------------------------------+
const string EventSectorNames[] =
  {
   "CALENDAR_SECTOR_NONE",
   "CALENDAR_SECTOR_MARKET",
   "CALENDAR_SECTOR_GDP",
   "CALENDAR_SECTOR_JOBS",
   "CALENDAR_SECTOR_PRICES",
   "CALENDAR_SECTOR_MONEY",
   "CALENDAR_SECTOR_TRADE",
   "CALENDAR_SECTOR_GOVERNMENT",
   "CALENDAR_SECTOR_BUSINESS",
   "CALENDAR_SECTOR_CONSUMER",
   "CALENDAR_SECTOR_HOUSING",
   "CALENDAR_SECTOR_TAXES",
   "CALENDAR_SECTOR_HOLIDAYS"
  };

const ENUM_CALENDAR_EVENT_SECTOR EventSectorValues[] =
  {
   CALENDAR_SECTOR_NONE,
   CALENDAR_SECTOR_MARKET,
   CALENDAR_SECTOR_GDP,
   CALENDAR_SECTOR_JOBS,
   CALENDAR_SECTOR_PRICES,
   CALENDAR_SECTOR_MONEY,
   CALENDAR_SECTOR_TRADE,
   CALENDAR_SECTOR_GOVERNMENT,
   CALENDAR_SECTOR_BUSINESS,
   CALENDAR_SECTOR_CONSUMER,
   CALENDAR_SECTOR_HOUSING,
   CALENDAR_SECTOR_TAXES,
   CALENDAR_SECTOR_HOLIDAYS
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_IMPORTANCE                                   |
//+------------------------------------------------------------------+
const string EventImportanceNames[] =
  {
   "CALENDAR_IMPORTANCE_NONE",
   "CALENDAR_IMPORTANCE_LOW",
   "CALENDAR_IMPORTANCE_MODERATE",
   "CALENDAR_IMPORTANCE_HIGH"
  };

const ENUM_CALENDAR_EVENT_IMPORTANCE EventImportanceValues[] =
  {
   CALENDAR_IMPORTANCE_NONE,
   CALENDAR_IMPORTANCE_LOW,
   CALENDAR_IMPORTANCE_MODERATE,
   CALENDAR_IMPORTANCE_HIGH
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_UNIT                                         |
//+------------------------------------------------------------------+
const string EventUnitNames[] =
  {
   "CALENDAR_UNIT_NONE",
   "CALENDAR_UNIT_PERCENT",
   "CALENDAR_UNIT_CURRENCY",
   "CALENDAR_UNIT_HOUR",
   "CALENDAR_UNIT_JOB",
   "CALENDAR_UNIT_RIG",
   "CALENDAR_UNIT_USD",
   "CALENDAR_UNIT_PEOPLE",
   "CALENDAR_UNIT_MORTGAGE",
   "CALENDAR_UNIT_VOTE",
   "CALENDAR_UNIT_BARREL",
   "CALENDAR_UNIT_CUBICFEET",
   "CALENDAR_UNIT_POSITION",
   "CALENDAR_UNIT_BUILDING"
  };

const ENUM_CALENDAR_EVENT_UNIT EventUnitValues[] =
  {
   CALENDAR_UNIT_NONE,
   CALENDAR_UNIT_PERCENT,
   CALENDAR_UNIT_CURRENCY,
   CALENDAR_UNIT_HOUR,
   CALENDAR_UNIT_JOB,
   CALENDAR_UNIT_RIG,
   CALENDAR_UNIT_USD,
   CALENDAR_UNIT_PEOPLE,
   CALENDAR_UNIT_MORTGAGE,
   CALENDAR_UNIT_VOTE,
   CALENDAR_UNIT_BARREL,
   CALENDAR_UNIT_CUBICFEET,
   CALENDAR_UNIT_POSITION,
   CALENDAR_UNIT_BUILDING
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_MULTIPLIER                                   |
//+------------------------------------------------------------------+
const string EventMultiplierNames[] =
  {
   "CALENDAR_MULTIPLIER_NONE",
   "CALENDAR_MULTIPLIER_THOUSANDS",
   "CALENDAR_MULTIPLIER_MILLIONS",
   "CALENDAR_MULTIPLIER_BILLIONS",
   "CALENDAR_MULTIPLIER_TRILLIONS"
  };

const ENUM_CALENDAR_EVENT_MULTIPLIER EventMultiplierValues[] =
  {
   CALENDAR_MULTIPLIER_NONE,
   CALENDAR_MULTIPLIER_THOUSANDS,
   CALENDAR_MULTIPLIER_MILLIONS,
   CALENDAR_MULTIPLIER_BILLIONS,
   CALENDAR_MULTIPLIER_TRILLIONS
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_IMPACT                                       |
//+------------------------------------------------------------------+
const string EventImpactNames[] =
  {
   "CALENDAR_IMPACT_NA",
   "CALENDAR_IMPACT_POSITIVE",
   "CALENDAR_IMPACT_NEGATIVE"
  };

const ENUM_CALENDAR_EVENT_IMPACT EventImpactValues[] =
  {
   CALENDAR_IMPACT_NA,
   CALENDAR_IMPACT_POSITIVE,
   CALENDAR_IMPACT_NEGATIVE
  };

//+------------------------------------------------------------------+
//| ENUM_CALENDAR_EVENT_TIMEMODE                                     |
//+------------------------------------------------------------------+
const string EventTimeModeNames[] =
  {
   "CALENDAR_TIMEMODE_DATETIME",
   "CALENDAR_TIMEMODE_DATE",
   "CALENDAR_TIMEMODE_NOTIME",
   "CALENDAR_TIMEMODE_TENTATIVE"
  };

const ENUM_CALENDAR_EVENT_TIMEMODE EventTimeModeValues[] =
  {
   CALENDAR_TIMEMODE_DATETIME,
   CALENDAR_TIMEMODE_DATE,
   CALENDAR_TIMEMODE_NOTIME,
   CALENDAR_TIMEMODE_TENTATIVE
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
long ScaledLongFromString(string s)
  {
   if(s == "")
      return LONG_MIN;
   return (long)MathRound(StringToDouble(s) * 1000000.0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
class CNewsBaseCache
  {
protected:
   NewsStructure     m_news_cache[];

public:
                     CNewsBaseCache();
                    ~CNewsBaseCache(void);

   void              AssignCache(NewsStructure &src[]);

   int               Get(NewsStructure &results[], datetime from, datetime to, string currency=NULL, string country_code=NULL);
   bool              Exists(datetime from, datetime to, string currency=NULL, int importance=-1, string country_code=NULL);

   bool              Next(NewsStructure &out, string currency, const uint lookahead_seconds=900, string country_code=NULL);
   bool              Next(NewsStructure &out, string currency, datetime from, const uint lookahead_seconds=900, string country_code=NULL);

   bool              Previous(NewsStructure &out, string currency, const uint lookback_seconds=900, string country_code=NULL);
   bool              Previous(NewsStructure &out, string currency, datetime from, const uint lookback_seconds=900, string country_code=NULL);
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CNewsBaseCache::CNewsBaseCache()
  {

  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CNewsBaseCache::~CNewsBaseCache(void)
  {

  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CNewsBaseCache::AssignCache(NewsStructure &src[])
  {
   uint size = src.Size();
   if(size==0)
     {
      printf("The src array is empty. All subsequent function calls are guaranteed to fail.");
      return;
     }

   ArrayResize(m_news_cache, size);
   for(uint i=0; i<size; i++)
      m_news_cache[i] = src[i];
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CNewsBaseCache::Get(NewsStructure &results[],
                        datetime from,
                        datetime to,
                        string currency=NULL,
                        string country_code=NULL)
  {
   ArrayResize(results,0);

   int count = 0;

   for(int i=0; i<ArraySize(m_news_cache); i++)
     {
      NewsStructure n = m_news_cache[i];

      if(n.value_time < from)
         continue;

      if(n.value_time > to)
         break;

      if(currency != NULL && currency != "" &&
         n.country_currency != currency)
         continue;

      if(country_code != NULL && country_code != "" &&
         n.country_code != country_code)
         continue;

      ArrayResize(results,count+1);
      results[count++] = n;
     }

   return count;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsBaseCache::Exists(datetime from,
                            datetime to,
                            string currency=NULL,
                            int importance=-1,
                            string country_code=NULL)
  {
   for(int i=0; i<ArraySize(m_news_cache); i++)
     {
      NewsStructure n = m_news_cache[i];

      if(n.value_time < from)
         continue;

      if(n.value_time > to)
         break;

      if(currency != NULL && currency != "" &&
         n.country_currency != currency)
         continue;

      if(country_code != NULL && country_code != "" &&
         n.country_code != country_code)
         continue;

      if(importance == -1)
         return true;

      if(n.event_importance ==
         (ENUM_CALENDAR_EVENT_IMPORTANCE)importance)
         return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsBaseCache::Next(NewsStructure &out,
                          string currency,
                          datetime from,
                          const uint lookahead_seconds=900,
                          string country_code=NULL)
  {
   datetime end = from + lookahead_seconds;

   for(int i=0; i<ArraySize(m_news_cache); i++)
     {
      NewsStructure n = m_news_cache[i];

      if(n.value_time < from)
         continue;

      if(n.value_time > end)
         break;

      if(currency != NULL && currency != "" &&
         n.country_currency != currency)
         continue;

      if(country_code != NULL && country_code != "" &&
         n.country_code != country_code)
         continue;

      out = n;
      return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsBaseCache::Next(NewsStructure &out,
                          string currency=NULL,
                          const uint lookahead_seconds=900,
                          string country_code=NULL)
  {
   return Next(out, currency, TimeCurrent(), lookahead_seconds, country_code);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsBaseCache::Previous(NewsStructure &out,
                              string currency,
                              datetime from,
                              const uint lookback_seconds,
                              string country_code=NULL)
  {
   datetime start = from - lookback_seconds;

   for(int i=ArraySize(m_news_cache)-1; i>=0; i--)
     {
      NewsStructure n = m_news_cache[i];

      if(n.value_time > from)
         continue;

      if(n.value_time < start)
         break;

      if(currency != NULL && currency != "" &&
         n.country_currency != currency)
         continue;

      if(country_code != NULL && country_code != "" &&
         n.country_code != country_code)
         continue;

      out = n;
      return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsBaseCache::Previous(NewsStructure &out,
                              string currency,
                              const uint lookback_seconds,
                              string country_code=NULL)
  {
   return Previous(out, currency, TimeCurrent(), lookback_seconds, country_code);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
