//+------------------------------------------------------------------+
//|                                              News Testing EA.mq5 |
//|                                     Copyright 2026, Omega Joctan |
//|                 https://www.mql5.com/en/users/omegajoctan/seller |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Omega Joctan"
#property link      "https://www.mql5.com/en/users/omegajoctan/seller"
#property version   "1.00"

#define NEWS_DB "news.sqlite"
#define NEWS_CSV "news.csv"
#define is_tester bool(MQLInfoInteger(MQL_TESTER))

//#property tester_file NEWS_CSV
#property tester_file NEWS_DB
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
#include <Bootstrap\News\provider_builtin.mqh>
#include <Bootstrap\News\provider_sqlite.mqh>
#include <Bootstrap\News\provider_csv.mqh>

//CNewsBuiltinProvider b_news;
CNewsSQLiteProvider sql_news(NEWS_DB, is_tester);
//CNewsCSVProvider csv_news(NEWS_CSV);
//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
//---
   ObjectsDeleteAll(0);
//---
   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
//---
   ObjectsDeleteAll(0);
  }
//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
//---
    
    NewsStructure n;
    
    //bool n_found = csv_news.Next(n);
    bool n_found = sql_news.Next(n, "USD");
    
    if (n_found)
      {
         string info = StringFormat("%s | %s | %s | %s | %s", 
                              TimeToString(n.value_time, TIME_DATE|TIME_SECONDS), 
                              EnumToString(n.event_importance), 
                              n.country_currency, 
                              n.country_name, 
                              n.event_name);
            
         DisplayLabel("time", TimeToString(n.value_time, TIME_DATE|TIME_SECONDS), 20);
         DisplayLabel("importance", EnumToString(n.event_importance),40);
         DisplayLabel("currency", n.country_currency, 70);
         DisplayLabel("c name", n.country_name, 100);
         DisplayLabel("event name", n.event_name, 130);
      }
    else
      {
       Comment("");
      }
  }
//+------------------------------------------------------------------+
//| Displays or updates a text label on the chart.                   |
//+------------------------------------------------------------------+
void DisplayLabel(const string name,
                  const string text,
                  const int y=20,
                  const int x=10,
                  const color clr=clrOrange,
                  const int font_size=15,
                  const string font="Arial")
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
      ObjectSetString(0, name, OBJPROP_FONT, font);
   }

   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ChartRedraw();
}
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
