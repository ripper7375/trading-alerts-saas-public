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
#include "provider_builtin.mqh"
#include "..\\sqlite3.mqh"
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
class CNewsSQLiteProvider
  {
protected:

   string            m_db_filename;
   CSqlite3          m_db;
   bool              m_common_folder;

   CNewsBaseCache    cache_layer;
   bool              m_cache_mode;

   struct CurrencyCache
     {
      string         currency;
      NewsStructure  news[];
     };

   CurrencyCache     m_currencies_cache[];

   static bool       bindNewsRow(int stmt, NewsStructure &n);
   static bool       createNewsTable(string table_name, CSqlite3 &db_obj);

   static string     CurrenyToTableName(const string currency)
     {
      if(currency == "ALL")
         return "ALL_";

      return currency;
     }

   int               SQLiteGet(NewsStructure &results[], datetime from, datetime to, string currency, string country_code=NULL);
   int               SQLiteGet(NewsStructure &results[], const string sql);
   bool              SQLiteExists(datetime from, datetime to, string currency, int importance=-1, string country_code=NULL);

   bool              SQLiteNext(NewsStructure &out, string currency, uint lookahead_seconds=900, string country_code=NULL);
   bool              SQLiteNext(NewsStructure &out, string currency, datetime from, uint lookahead_seconds=900, string country_code=NULL);

   bool              SQLitePrevious(NewsStructure &out, string currency, uint lookback_seconds=900, string country_code=NULL);
   bool              SQLitePrevious(NewsStructure &out, string currency, datetime from, uint lookback_seconds=900, string country_code=NULL);

   int               FindCache(const string currency);
   int               EnsureCurrencyLoaded(const string currency);

public:
                     CNewsSQLiteProvider(string db_filename, bool cache_mode, bool common=false);
                    ~CNewsSQLiteProvider(void);

   static void       Export(NewsStructure &results[], string filename, bool common_folder=false);
   void              Export(NewsStructure &results[], bool common_folder=false)
     {
      CNewsSQLiteProvider::Export(results, this.m_db_filename, common_folder);
     }
     
   void              Export(datetime from, datetime to, string currency, string country_code=NULL);

   int               Get(NewsStructure &results[], datetime from, datetime to, string currency, string country_code=NULL);
   bool              Exists(datetime from, datetime to, string currency, int importance=-1, string country_code=NULL)
     {
      if(m_cache_mode)
         return this.cache_layer.Exists(from, to, currency, importance, country_code);

      return this.SQLiteExists(from, to, currency, importance, country_code);
     }

   bool              Next(NewsStructure &out, string currency, uint lookahead_seconds=900, string country_code=NULL)
     {
      if(m_cache_mode)
         return this.cache_layer.Next(out, currency, lookahead_seconds, country_code);

      return this.SQLiteNext(out, currency, lookahead_seconds, country_code);
     }

   bool              Next(NewsStructure &out, string currency, datetime from, uint lookahead_seconds=900, string country_code=NULL)
     {
      if(m_cache_mode)
         return this.cache_layer.Next(out, currency, from, lookahead_seconds, country_code);

      return this.SQLiteNext(out, currency, from, lookahead_seconds, country_code);
     }

   bool              Previous(NewsStructure &out, string currency, uint lookback_seconds=900, string country_code=NULL)
     {
      if(m_cache_mode)
         return this.cache_layer.Next(out, currency, lookback_seconds, country_code);

      return this.SQLitePrevious(out, currency, lookback_seconds, country_code);
     }

   bool              Previous(NewsStructure &out, string currency, datetime from, uint lookback_seconds=900, string country_code=NULL)
     {
      if(m_cache_mode)
         return this.cache_layer.Next(out, currency, from, lookback_seconds, country_code);

      return this.SQLitePrevious(out, currency, from, lookback_seconds, country_code);
     }
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CNewsSQLiteProvider  ::CNewsSQLiteProvider(string db_filename, bool cache_mode, bool common=false):
   m_db_filename(db_filename),
   m_common_folder(common),
   m_cache_mode(cache_mode)
  {
//---

   m_db = CSqlite3();
   if(!m_db.connect(db_filename, common))
      printf("Failed to connect to %s. Error =  %d", db_filename, GetLastError());

//--- Cache mode selected

   m_cache_mode = cache_mode;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CNewsSQLiteProvider  ::~CNewsSQLiteProvider(void)
  {

  }
//+------------------------------------------------------------------+
//| Retrieves economic news records from the SQLite database within  |
//| the specified time range.                                        |
//|                                                                  |
//| Parameters:                                                      |
//|   results[]    - Output array receiving the matching news        |
//|                  records.                                        |
//|   from         - Start of the search period.                     |
//|   to           - End of the search period.                       |
//|   currency     - Currency whose table should be queried          |
//|                  (e.g. "USD").                                   |
//|   country_code - Optional country filter (ISO 3166-1 alpha-2,    |
//|                  e.g. "US"). NULL retrieves news for all         |
//|                  countries within the selected currency.         |
//|                                                                  |
//| Returns:                                                         |
//|   The number of news records retrieved. Returns 0 if no matching |
//|   records are found or if the query cannot be executed.          |
//|                                                                  |
//| Notes:                                                           |
//|   - News records are returned in ascending order of              |
//|     publication time.                                            |
//|   - The currency is internally mapped to its corresponding       |
//|     database table name before the query is executed.            |
//|   - The output array is automatically resized to fit the         |
//|     retrieved records.                                           |
//+------------------------------------------------------------------+
int CNewsSQLiteProvider  ::SQLiteGet(NewsStructure &results[],
                                     datetime from,
                                     datetime to,
                                     string currency,
                                     string country_code=NULL)
  {
   ArrayResize(results,0);

   if(m_db.get_handle()==INVALID_HANDLE)
     {
      printf("Invalid database handle. Error=%d",GetLastError());
      return 0;
     }

//---

   currency = CurrenyToTableName(currency);

//---

   string sql;
   if(country_code==NULL || country_code=="")
     {
      sql = StringFormat(
               "SELECT * FROM %s "
               "WHERE value_time>=? AND value_time<=? "
               "ORDER BY value_time ASC",
               currency);
     }
   else
     {
      sql = StringFormat(
               "SELECT * FROM %s "
               "WHERE value_time>=? AND value_time<=? "
               "AND country_code=? "
               "ORDER BY value_time ASC",
               currency);
     }

   int stmt = DatabasePrepare(m_db.get_handle(),sql);

   if(stmt==INVALID_HANDLE)
     {
      PrintFormat("Failed to prepare query. Error=%d",GetLastError());
      if(MQLInfoInteger(MQL_DEBUG))
         Print(sql);

      return 0;
     }

//---

   int p=0;
   DatabaseBind(stmt,p++,(long)from);
   DatabaseBind(stmt,p++,(long)to);

   if(country_code!=NULL && country_code!="")
      DatabaseBind(stmt,p++,country_code);

//---

   uint ARRAY_BUFF = 1000;
   ArrayResize(results, ARRAY_BUFF);

//---

   int count=0;
   while(DatabaseRead(stmt))
     {
      NewsStructure n;
      int c=0;

      long long_val;
      DatabaseColumnLong(stmt,c++,long_val);
      n.country_id = long_val;

      DatabaseColumnText(stmt,c++,n.country_name);
      DatabaseColumnText(stmt,c++,n.country_code);
      DatabaseColumnText(stmt,c++,n.country_currency);
      DatabaseColumnText(stmt,c++,n.country_currency_symbol);
      DatabaseColumnText(stmt,c++,n.url_name);

      DatabaseColumnLong(stmt,c++,long_val);
      n.event_id = long_val;

      string text;

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventTypeNames, EventTypeValues, n.event_type);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventSectorNames, EventSectorValues, n.event_sector);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventFrequencyNames, EventFrequencyValues, n.event_frequency);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventTimeModeNames, EventTimeModeValues, n.event_time_mode);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventUnitNames, EventUnitValues, n.event_unit);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventImportanceNames, EventImportanceValues, n.event_importance);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventMultiplierNames, EventMultiplierValues, n.event_multiplier);

      int int_val = 0;
      DatabaseColumnInteger(stmt,c++, int_val);
      n.event_digits = int_val;

      DatabaseColumnText(stmt,c++,n.event_source_url);
      DatabaseColumnText(stmt,c++,n.event_code);
      DatabaseColumnText(stmt,c++,n.event_name);

      DatabaseColumnLong(stmt,c++,long_val);
      n.value_id = long_val;

      DatabaseColumnLong(stmt,c++, long_val);
      n.value_time = (datetime)long_val;

      DatabaseColumnLong(stmt,c++, long_val);
      n.value_period = (datetime)long_val;

      DatabaseColumnInteger(stmt,c++,n.value_revision);

      DatabaseColumnLong(stmt,c++,n.actual_value);
      DatabaseColumnLong(stmt,c++,n.prev_value);
      DatabaseColumnLong(stmt,c++,n.revised_prev_value);
      DatabaseColumnLong(stmt,c++,n.forecast_value);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventImpactNames, EventImpactValues, n.value_impact_type);

      uint curr_size = results.Size();
      if(count>=(int)curr_size)
         ArrayResize(results, curr_size+ARRAY_BUFF);

      results[count++]=n;
     }

   ArrayResize(results, count); //Final resize
   DatabaseFinalize(stmt);
   return count;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CNewsSQLiteProvider  ::SQLiteGet(NewsStructure &results[], const string sql)
  {
   if(m_db.get_handle()==INVALID_HANDLE)
     {
      printf("Invalid database handle. Error=%d",GetLastError());
      return 0;
     }

   int stmt = DatabasePrepare(m_db.get_handle(),sql);

   if(stmt==INVALID_HANDLE)
     {
      PrintFormat("Failed to prepare query. Error=%d",GetLastError());
      if(MQLInfoInteger(MQL_DEBUG))
        {
         printf(sql);
         DebugBreak();
        }

      return 0;
     }

//---

   uint ARRAY_BUFF = 1000;
   ArrayResize(results, ARRAY_BUFF);

//---

   int count=0;
   while(DatabaseRead(stmt))
     {
      NewsStructure n;
      int c=0;

      long long_val;
      DatabaseColumnLong(stmt,c++,long_val);
      n.country_id = long_val;

      DatabaseColumnText(stmt,c++,n.country_name);
      DatabaseColumnText(stmt,c++,n.country_code);
      DatabaseColumnText(stmt,c++,n.country_currency);
      DatabaseColumnText(stmt,c++,n.country_currency_symbol);
      DatabaseColumnText(stmt,c++,n.url_name);

      DatabaseColumnLong(stmt,c++,long_val);
      n.event_id = long_val;

      string text;

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventTypeNames, EventTypeValues, n.event_type);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventSectorNames, EventSectorValues, n.event_sector);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventFrequencyNames, EventFrequencyValues, n.event_frequency);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventTimeModeNames, EventTimeModeValues, n.event_time_mode);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventUnitNames, EventUnitValues, n.event_unit);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventImportanceNames, EventImportanceValues, n.event_importance);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventMultiplierNames, EventMultiplierValues, n.event_multiplier);

      int int_val = 0;
      DatabaseColumnInteger(stmt,c++, int_val);
      n.event_digits = int_val;

      DatabaseColumnText(stmt,c++,n.event_source_url);
      DatabaseColumnText(stmt,c++,n.event_code);
      DatabaseColumnText(stmt,c++,n.event_name);

      DatabaseColumnLong(stmt,c++,long_val);
      n.value_id = long_val;

      DatabaseColumnLong(stmt,c++, long_val);
      n.value_time = (datetime)long_val;

      DatabaseColumnLong(stmt,c++, long_val);
      n.value_period = (datetime)long_val;

      DatabaseColumnInteger(stmt,c++,n.value_revision);

      DatabaseColumnLong(stmt,c++,n.actual_value);
      DatabaseColumnLong(stmt,c++,n.prev_value);
      DatabaseColumnLong(stmt,c++,n.revised_prev_value);
      DatabaseColumnLong(stmt,c++,n.forecast_value);

      DatabaseColumnText(stmt,c++,text);
      StringToEnum(text, EventImpactNames, EventImpactValues, n.value_impact_type);

      uint curr_size = results.Size();
      if(count>=(int)curr_size)
         ArrayResize(results, curr_size+ARRAY_BUFF);

      results[count++]=n;
     }

   ArrayResize(results, count); //Final resize
   DatabaseFinalize(stmt);
   return count;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CNewsSQLiteProvider::  Get(NewsStructure &results[],
                               datetime from,
                               datetime to,
                               string currency,
                               string country_code=NULL)
  {
   if(!m_cache_mode)
      return SQLiteGet(results, from, to, currency, country_code);

   int idx = EnsureCurrencyLoaded(currency);

   if(idx < 0)
      return 0;

   cache_layer.AssignCache(m_currencies_cache[idx].news);
   return cache_layer.Get(results, from, to, currency, country_code);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider  ::createNewsTable(string table_name, CSqlite3 &db_obj)
  {
//--- Table creation

   string sql = StringFormat(
                   "CREATE TABLE IF NOT EXISTS %s ("
                   "country_id INTEGER,"
                   "country_name TEXT,"
                   "country_code TEXT,"
                   "country_currency TEXT, "
                   "country_currency_symbol TEXT,"
                   "url_name TEXT, "
                   "event_id INTEGER,"
                   "event_type TEXT,"
                   "event_sector TEXT,"
                   "event_frequency TEXT,"
                   "event_time_mode TEXT,"
                   "event_unit TEXT,"
                   "event_importance TEXT, "
                   "event_multiplier TEXT,"
                   "event_digits INTEGER,"
                   "event_source_url TEXT,"
                   "event_code TEXT,"
                   "event_name TEXT,"
                   "value_id INTEGER,"
                   "value_time INTEGER,"
                   "value_period INTEGER,"
                   "value_revision INTEGER,"
                   "actual_value INTEGER,"
                   "prev_value INTEGER,"
                   "revised_prev_value INTEGER,"
                   "forecast_value INTEGER,"
                   "value_impact_type TEXT,"
                   "UNIQUE(value_id))", table_name);   // UNIQUE guards against duplicate inserts on repeated exports

   if(!db_obj.execute(sql).boolean)
     {
      printf("Failed to create table %s. Error = %d", table_name, GetLastError());
      return false;
     }

   return true;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider  ::bindNewsRow(int stmt, NewsStructure &n)
  {
   int p = 0;
   bool ok = true;

   ok &= DatabaseBind(stmt, p++, (long)n.country_id);
   ok &= DatabaseBind(stmt, p++, n.country_name);
   ok &= DatabaseBind(stmt, p++, n.country_code);
   ok &= DatabaseBind(stmt, p++, n.country_currency);
   ok &= DatabaseBind(stmt, p++, n.country_currency_symbol);
   ok &= DatabaseBind(stmt, p++, n.url_name);

   ok &= DatabaseBind(stmt, p++, (long)n.event_id);
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_type));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_sector));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_frequency));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_time_mode));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_unit));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_importance));
   ok &= DatabaseBind(stmt, p++, EnumToString(n.event_multiplier));
   ok &= DatabaseBind(stmt, p++, (long)n.event_digits);
   ok &= DatabaseBind(stmt, p++, n.event_source_url);
   ok &= DatabaseBind(stmt, p++, n.event_code);
   ok &= DatabaseBind(stmt, p++, n.event_name);

   ok &= DatabaseBind(stmt, p++, (long)n.value_id);
   ok &= DatabaseBind(stmt, p++, (long)n.value_time);
   ok &= DatabaseBind(stmt, p++, (long)n.value_period);
   ok &= DatabaseBind(stmt, p++, (long)n.value_revision);
   ok &= DatabaseBind(stmt, p++, n.actual_value);
   ok &= DatabaseBind(stmt, p++, n.prev_value);
   ok &= DatabaseBind(stmt, p++, n.revised_prev_value);
   ok &= DatabaseBind(stmt, p++, n.forecast_value);
   ok &= DatabaseBind(stmt, p++, EnumToString(n.value_impact_type));

   return ok;
  }
//+------------------------------------------------------------------+
//| Exports an array of news records to an SQLite database.          |
//|                                                                  |
//| Parameters:                                                      |
//|   results[]     - Array of news records to export.               |
//|   filename      - Name of the SQLite database file. If the file  |
//|                   does not exist, it is created automatically.   |
//|   common_folder - If true, the database is created in the        |
//|                   terminal's common files folder; otherwise it   |
//|                   is created in the current terminal's Files     |
//|                   directory.                                     |
//|                                                                  |
//+------------------------------------------------------------------+
void CNewsSQLiteProvider  ::Export(NewsStructure &results[], string filename, bool common_folder=false)
  {
   int total = ArraySize(results);
   if(total == 0)
     {
      printf("Export: nothing to export, results[] is empty");
      return;
     }

   CSqlite3 db(false);
   if(!db.connect(filename, common_folder))
      return;

//--- collect distinct currencies present in results[]

   string currencies[];
   for(int i=0; i<total; i++)
     {
      string cur = results[i].country_currency;
      bool found = false;
      for(int c=0; c<ArraySize(currencies); c++)
         if(currencies[c] == cur)
           {
            found = true;
            break;
           }

      if(!found)
        {
         int n = ArraySize(currencies);
         ArrayResize(currencies, n+1);
         currencies[n] = cur;
        }
     }

//---

   if(!db.begin())
     {
      printf("Failed to begin transaction. Error = %d", GetLastError());
      db.close();
      return;
     }

   string insert_cols =
      "country_id,"
      "country_name,"
      "country_code,"
      "country_currency,"
      "country_currency_symbol,"
      "url_name,"
      "event_id,"
      "event_type,"
      "event_sector,"
      "event_frequency,"
      "event_time_mode,"
      "event_unit,"
      "event_importance,"
      "event_multiplier,"
      "event_digits,"
      "event_source_url,"
      "event_code,"
      "event_name,"
      "value_id,"
      "value_time,"
      "value_period,"
      "value_revision,"
      "actual_value,"
      "prev_value,"
      "revised_prev_value,"
      "forecast_value,"
      "value_impact_type";

   string placeholders = "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?"; // 27 placeholders

   for(int c=0; c<ArraySize(currencies); c++)
     {
      string cur   = currencies[c];
      cur = CurrenyToTableName(cur);

      //--- Builtin economic calendar

      if(!createNewsTable(cur, db))  //--- Create a table for each currency
         continue;

      //---

      string insert_sql = StringFormat("INSERT OR IGNORE INTO %s (%s) VALUES (%s)",cur, insert_cols, placeholders);

      int stmt = DatabasePrepare(db.get_handle(), insert_sql);
      if(stmt == INVALID_HANDLE)
        {
         printf("Failed to prepare insert for %s. Error = %d", cur, GetLastError());
         db.rollback();
         db.close();
         return;
        }

      for(int i=0; i<total; i++)
        {
         if(results[i].country_currency != cur)
            continue;

         if(!bindNewsRow(stmt, results[i]))
           {
            printf("Bind failed for %s row, event_id=%I64u. Error = %d",
                   cur, results[i].event_id, GetLastError());
            continue;
           }

         DatabaseRead(stmt);   // executes the bound insert
         DatabaseReset(stmt);  // clears bindings for the next row's reuse of this statement
        }

      DatabaseFinalize(stmt);
     }

   if(!db.commit())
      DebugBreak();
   db.close();

   printf("Exported %d news records across %d currency tables to %s", total, ArraySize(currencies), filename);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CNewsSQLiteProvider  ::Export(datetime from, datetime to, string currency, string country_code=NULL)
  {
   NewsStructure news_found[];
   int f = CNewsBuiltinProvider::Get(news_found, from, to, currency, country_code);
//---
   if(f>0)
      this.Export(news_found, m_db_filename, m_common_folder);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider   ::SQLiteExists(datetime from, datetime to, string currency, int importance, string country_code=NULL)
  {
   NewsStructure candidates[];
   int total = SQLiteGet(candidates, from, to, currency, country_code);

   if(total <= 0)
      return false;

   if(importance==-1)
      return true;

//--- Check for the requested importance

   ENUM_CALENDAR_EVENT_IMPORTANCE imp = (ENUM_CALENDAR_EVENT_IMPORTANCE)importance;

   for(int i=0; i<total; i++)
     {
      if(candidates[i].event_importance == imp)
         return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider::SQLiteNext(NewsStructure &out,
                                     string currency,
                                     datetime from,
                                     uint lookahead_seconds=900,
                                     string country_code=NULL)
  {
   datetime max_time = from + lookahead_seconds;

//---

   NewsStructure obtained[];
   if(this.SQLiteGet(obtained, from, max_time, currency, country_code)>0)
     {
      out = obtained[0];
      return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider::SQLiteNext(NewsStructure &out,
                                     string currency,
                                     uint lookahead_second,
                                     string country_code=NULL)
  {
   datetime now = TimeCurrent();
   return this.SQLiteNext(out, currency, now, lookahead_second, country_code);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider::SQLitePrevious(NewsStructure &out,
      string currency,
      datetime from,
      uint lookback_seconds=900,
      string country_code=NULL)
  {
   datetime now = from;
   datetime earliest = now - lookback_seconds;

//---

   NewsStructure news_found[];
   int f = this.SQLiteGet(news_found, earliest, now, currency, country_code);
   if(f>0)
     {
      out = news_found[f-1];
      return true;
     }

   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsSQLiteProvider::SQLitePrevious(NewsStructure &out,
      string currency,
      uint lookback_seconds,
      string country_code=NULL)
  {
   datetime now = TimeCurrent();
   return this.SQLitePrevious(out, currency, now, lookback_seconds, country_code);
  }
//+------------------------------------------------------------------+
//| Returns the index of a cached currency.                          |
//+------------------------------------------------------------------+
int CNewsSQLiteProvider::FindCache(const string currency)
  {
   for(int i=0; i<ArraySize(m_currencies_cache); i++)
     {
      if(m_currencies_cache[i].currency == currency)
         return i;
     }

   return -1;
  }
//+------------------------------------------------------------------+
//| Ensures that a currency is loaded into memory.                   |
//+------------------------------------------------------------------+
int CNewsSQLiteProvider::EnsureCurrencyLoaded(const string currency)
  {
   int idx = FindCache(currency);

   if(idx >= 0)
      return idx;

//--- create a new cache entry

   idx = ArraySize(m_currencies_cache);
   ArrayResize(m_currencies_cache, idx + 1);

   m_currencies_cache[idx].currency = currency;
   string table = CurrenyToTableName(currency);

   string sql = StringFormat("SELECT * FROM %s ORDER BY value_time ASC", table);

   if(SQLiteGet(m_currencies_cache[idx].news, sql) <= 0)
     {
      PrintFormat("Failed to load currency '%s' into cache.", currency);
      ArrayResize(m_currencies_cache, idx);

      return -1;
     }

   return idx;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
