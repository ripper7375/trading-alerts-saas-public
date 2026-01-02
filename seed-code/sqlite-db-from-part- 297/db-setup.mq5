//+------------------------------------------------------------------+
//|                                                     db-setup.mq5 |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property version   "1.00"
#property script_show_inputs
//--- input parameters
input string   InpDbFilename = "StatArb\\statarb-0.1.db"; // SQLite database filename
input string   InpSchemaFile = "StatArb\\statarb-0.1.sql"; // Database schema filename

//+------------------------------------------------------------------+
//| Script program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
  {
   ResetLastError();
//---
   if(!FileIsExist(InpSchemaFile))
     {
      Print("Schema file " + InpSchemaFile + " not found");
      return;
     }
//---
   string sql = ReadSchemaFile(InpSchemaFile);
//--- create and open the database in the MQL5/Files/StatArb folder
   int db_handle = DatabaseOpen(InpDbFilename, DATABASE_OPEN_CREATE);
   if(db_handle == INVALID_HANDLE)
     {
      Print("DB: ", InpDbFilename, " open failed with code ", GetLastError());
      return;
     }
   ResetLastError();
//--- create the tables
   if(!DatabaseExecute(db_handle, sql))
     {
      Print("DB: ", InpDbFilename, " create tables failed with code ", GetLastError());
      DatabaseClose(db_handle);
      return;
     }
   DatabaseClose(db_handle);
  }
//+------------------------------------------------------------------+
string ReadSchemaFile(const string fname)
  {
   ResetLastError();
//---
   string sql_schema;
//---

   int file_handle = FileOpen(fname, FILE_TXT | FILE_READ | FILE_ANSI);
   if(file_handle != INVALID_HANDLE)
     {
      PrintFormat("%s file is available for reading", fname);
      PrintFormat("File path: %s\\Files\\", TerminalInfoString(TERMINAL_DATA_PATH));
      //--- read data
      while(!FileIsEnding(file_handle))
        {
         string chunk = FileReadString(file_handle);
         StringAdd(sql_schema, "\n" + chunk);
        }
      //--- close the file
      FileClose(file_handle);
      PrintFormat("Data was read. %s file is closed", fname);
     }
   else
     {
      PrintFormat("Failed to open %s file, Error code = %d", fname, GetLastError());
     }
   Print("final string: " + sql_schema);
//--- This output is for debugging purposes. 
//--- It should be identical to the original schema file.
   ResetLastError();
   int out_handle = FileOpen("output.sql", FILE_TXT | FILE_WRITE | FILE_ANSI);
   if(out_handle != INVALID_HANDLE)
     {
      FileWrite(out_handle, sql_schema);
      FileClose(out_handle);
     }
   else
      Print("Operation FileOpen failed, error ", GetLastError());
//---
   return sql_schema;
  }
//+------------------------------------------------------------------+