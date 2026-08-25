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
#include "..\\csv.mqh"
#include "..\\fileIO.mqh"
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
class CNewsCSVProvider: public CNewsBaseCache
  {
protected:

   string            m_csv_filename;
   bool              m_common_folder;
   bool              FromCSVLine(string &fields[], NewsStructure &out);

public:
                     CNewsCSVProvider(const string csv_filename, bool common=false, const string delimiter=",");
                    ~CNewsCSVProvider(void);

   static void       Export(NewsStructure &results[], const string filename, bool common_folder=false);
   void              Export(NewsStructure &results[]);
  };
//+------------------------------------------------------------------+
//| Constructs a CSV news provider by loading economic news records  |
//| from a CSV file into an in-memory cache.                         |
//|                                                                  |
//| Parameters:                                                      |
//|   csv_filename - Name of the CSV file containing the exported    |
//|                  news records.                                   |
//|   common       - If true, the CSV file is loaded from the        |
//|                  terminal's common files folder; otherwise it is |
//|                  loaded from the current terminal's Files        |
//|                  directory.                                      |
//|   delimiter    - Field separator used in the CSV file. The       |
//|                  default delimiter is a comma (",").             |
//|                                                                  |
//+------------------------------------------------------------------+
CNewsCSVProvider::CNewsCSVProvider(const string csv_filename, bool common=false, const string delimiter=","):
   m_csv_filename(csv_filename),
   m_common_folder(common)
  {
   CFile f = CFileIO::open(csv_filename, "r", CP_UTF8, common);
   CSVReader csv_reader(f, delimiter);

   NewsStructure news_st;

   int buff = 1000, read=0;
   bool header_skipped = false;

   ArrayResize(this.m_news_cache, buff);

   string line = "";
   string csv_row[];

//---

   while(csv_reader.readRow(csv_row))
     {
      if(!header_skipped)
        {
         header_skipped = true;
         continue;
        }

      //---

      if(!FromCSVLine(csv_row, news_st))
         continue;

      this.m_news_cache[read] = news_st;
      read++;

      //--- optimized array resizing

      if(read >= (int)this.m_news_cache.Size())
         ArrayResize(this.m_news_cache, this.m_news_cache.Size()+buff);
     }

   printf("%d news loaded from %s",read, csv_filename);
   f.close();
   
   ArrayResize(this.m_news_cache, read);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CNewsCSVProvider::~CNewsCSVProvider(void)
  {

  }
//+------------------------------------------------------------------+
//| Exports an array of news records to a CSV file.                  |
//|                                                                  |
//| Parameters:                                                      |
//|   results[]     - Array of news records to export.               |
//|   filename      - Name of the destination CSV file.              |
//|   common_folder - If true, the file is created in the terminal's |
//|                  common files folder; otherwise it is created in |
//|                  the current terminal's Files directory.         |
//|                                                                  |
//| Notes:                                                           |
//|   - The first row of the CSV contains the column headers.        |
//|   - Each NewsStructure is written as a single CSV record.        |
//|   - Records with an unexpected number of fields are skipped.     |
//+------------------------------------------------------------------+
void CNewsCSVProvider::Export(NewsStructure &results[], const string filename, bool common_folder=false)
  {
   CFile f = CFileIO::open(filename, "w", CP_UTF8, common_folder);

//---

   string csv_header = results[0].HeaderLine();

   string parsed_line[];
   ParseCSVLine(csv_header, parsed_line);

   uint header_size = parsed_line.Size();

   CSVWriter csv_writer(f);
   csv_writer.writeRow(parsed_line);

//---

   for(uint i=0; i<results.Size(); i++)
     {
      string row = results[i].ToCSVLine();
      ParseCSVLine(row, parsed_line);

      if(header_size != parsed_line.Size())
        {
         DebugBreak();
         continue;
        }
      csv_writer.writeRow(parsed_line);
     }

   f.close();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CNewsCSVProvider::Export(NewsStructure &results[])
 {
   CNewsCSVProvider::Export(results, this.m_csv_filename, m_common_folder);
 }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CNewsCSVProvider::FromCSVLine(string &fields[], NewsStructure &out)
  {
   int i=0;

//--- MqlCalendarCountry

   out.country_id              = (ulong)StringToInteger(fields[i++]);
   out.country_name            = fields[i++];
   out.country_code            = fields[i++];
   out.country_currency        = fields[i++];
   out.country_currency_symbol = fields[i++];
   out.url_name                = fields[i++];

//--- MqlCalendarEvent

   out.event_id = (ulong)StringToInteger(fields[i++]);
   out.event_type = ENUM_CALENDAR_EVENT_TYPE(fields[i++]);
   out.event_sector = ENUM_CALENDAR_EVENT_SECTOR(fields[i++]);
   out.event_frequency = ENUM_CALENDAR_EVENT_FREQUENCY(fields[i++]);
   out.event_time_mode = ENUM_CALENDAR_EVENT_TIMEMODE(fields[i++]);
   out.event_unit = ENUM_CALENDAR_EVENT_UNIT(fields[i++]);
   out.event_importance = ENUM_CALENDAR_EVENT_IMPORTANCE(fields[i++]);
   out.event_multiplier = ENUM_CALENDAR_EVENT_MULTIPLIER(fields[i++]);
   out.event_digits     = (uint)StringToInteger(fields[i++]);
   out.event_source_url = fields[i++];
   out.event_code       = fields[i++];
   out.event_name       = fields[i++];

//--- MqlCalendarValue

   out.value_id       = (ulong)StringToInteger(fields[i++]);
   out.value_time      = StringToTime(fields[i++]);
   out.value_period     = StringToTime(fields[i++]);
   out.value_revision   = (int)StringToInteger(fields[i++]);
   out.actual_value       = ScaledLongFromString(fields[i++]);
   out.prev_value         = ScaledLongFromString(fields[i++]);
   out.revised_prev_value = ScaledLongFromString(fields[i++]);
   out.forecast_value     = ScaledLongFromString(fields[i++]);
   out.value_impact_type = ENUM_CALENDAR_EVENT_IMPACT(fields[i++]);

   return true;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
