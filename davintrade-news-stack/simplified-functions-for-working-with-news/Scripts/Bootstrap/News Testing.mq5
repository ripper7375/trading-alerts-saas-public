//+------------------------------------------------------------------+
//|                                                 News Testing.mq5 |
//|                                  Copyright 2026, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.00"
#property script_show_inputs

#include <Bootstrap\News\provider_builtin.mqh>
#include <Bootstrap\News\provider_sqlite.mqh>
#include <Bootstrap\News\provider_csv.mqh>
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
#define NEWS_DB_SRC "news.sqlite"
#define NEWS_CSV_SRC "news.csv"
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
input datetime START_TIME = D'01.01.2026';
//+------------------------------------------------------------------+
//| Script program START_TIME function                                    |
//+------------------------------------------------------------------+
void OnStart()
  {
   datetime now = TimeCurrent();
   
//--- Exporting news for the first time
   
   NewsStructure history[];
   int n = CNewsBuiltinProvider::Get(history, START_TIME, now, NULL);
   if(n > 0)
     {
       CNewsCSVProvider::Export(history, NEWS_CSV_SRC); //exporting to a CSV file
       CNewsSQLiteProvider::Export(history, NEWS_DB_SRC);
       
       Sleep(100);
     }
   
//---

   datetime start = now - 24 * 60 * 60; //One day prior
   string currency = "USD";

//--- Builtin news source

   CNewsCSVProvider csv_provider(NEWS_CSV_SRC);
   
   NewsStructure news[];
   int total_news = CNewsBuiltinProvider::Get(news, start, now, currency);
   if(total_news < 0)
      return;

   printf("<<<<<<<<< Builtin news source >>>>>>>>>>>");
   printf("Available news %d on %s from %s to %s", total_news, currency, TimeToString(start), TimeToString(now));
   for(int i = 0; i < total_news; i++)
     {
      NewsStructure n = news[i];
      printf("%s | %s | %s | %s | %s", TimeToString(n.value_time, TIME_DATE | TIME_SECONDS), EnumToString(n.event_importance), n.country_currency, n.country_name, n.event_name);
     }

   bool exists = CNewsBuiltinProvider::Exists(start, now, currency, CALENDAR_IMPORTANCE_HIGH);
   printf("High impact News exists on %s: %s", currency, exists ? "true" : "false");

   exists = CNewsBuiltinProvider::Exists(start, now, currency, CALENDAR_IMPORTANCE_MODERATE);
   printf("Moderate impact News exists on %s: %s", currency, exists ? "true" : "false");

//--- Relying on news from a CSV

   printf("<<<<<<<<< CSV news source >>>>>>>>>>>");
   total_news = csv_provider.Get(news, start, now, currency);

   printf("Available news %d on %s from %s to %s", total_news, currency, TimeToString(start), TimeToString(now));
   for(int i = 0; i < total_news; i++)
     {
      NewsStructure n = news[i];
      printf("%s | %s | %s | %s | %s", TimeToString(n.value_time, TIME_DATE | TIME_SECONDS), EnumToString(n.event_importance), n.country_currency, n.country_name, n.event_name);
     }

   exists = csv_provider.Exists(start, now, currency, CALENDAR_IMPORTANCE_HIGH);
   printf("High impact News exists on %s: %s", currency, exists ? "true" : "false");

   exists = csv_provider.Exists(start, now, currency, CALENDAR_IMPORTANCE_MODERATE);
   printf("Moderate impact News exists on %s: %s", currency, exists ? "true" : "false");

//--- Relying on news from a SQLITE3

   CNewsSQLiteProvider sql_provider(NEWS_DB_SRC, false);

   total_news = sql_provider.Get(news, start, now, currency);

   if(total_news > 0)
      sql_provider.Export(news); // exporting to a database

   printf("<<<<<<<<< SQLite news source >>>>>>>>>>>");
   printf("Available news %d on %s from %s to %s", total_news, currency, TimeToString(start), TimeToString(now));
   for(int i = 0; i < total_news; i++)
     {
      NewsStructure n = news[i];
      printf("%s | %s | %s | %s | %s", TimeToString(n.value_time, TIME_DATE | TIME_SECONDS), EnumToString(n.event_importance), n.country_currency, n.country_name, n.event_name);
     }

   exists = sql_provider.Exists(start, now, currency, CALENDAR_IMPORTANCE_HIGH);
   printf("High impact News exists on %s: %s", currency, exists ? "true" : "false");

   exists = sql_provider.Exists(start, now, currency, CALENDAR_IMPORTANCE_MODERATE);
   printf("Moderate impact News exists on %s: %s", currency, exists ? "true" : "false");
  }
//+------------------------------------------------------------------+
