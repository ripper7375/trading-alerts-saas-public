//+------------------------------------------------------------------+
//|                                                      SQLite3Base |
//+------------------------------------------------------------------+

#include "SQLite3Define.mqh"
#include "SQLite3Import.mqh"
//+------------------------------------------------------------------+
//| CSQLite3Base class                                               |
//+------------------------------------------------------------------+
class CSQLite3Base
  {
   sqlite3_p64       m_db;             // pointer to database file
   bool              m_bopened;        // flag "Is m_db handle valid"
   string            m_dbfile;         // path to database file

public:
                     CSQLite3Base();   // constructor
   virtual          ~CSQLite3Base();   // destructor


public:
   //--- connection to database 
   bool              IsConnected();
   int               Connect(string dbfile);
   void              Disconnect();
   int               Reconnect();
   //--- error message
   string            ErrorMsg();

public:
   //--- data functions
   bool              BindStatement(sqlite3_stmt_p64 stmt,int column,CSQLite3Cell &cell);
   bool              ReadStatement(sqlite3_stmt_p64 stmt,int column,CSQLite3Cell &cell);

public:
   //--- query functions
   int               Query(string query); // for ex.: INSERT INTO <table>(roll,name,cgpa) VALUES (4,'uuu',6.6)
   int               Query(CSQLite3Table &tbl,string query); // for ex.: SELECT * FROM <table> WHERE (a>100)
   int               QueryBind(CSQLite3Row &row,string query); // UPDATE <table> SET <row>=?, <row>=? WHERE (cond)
   int               Exec(string query);
   int               Transact(string &query[]);
   int               TransactBind(CSQLite3Table &tbl,string query);
  };
//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
CSQLite3Base::CSQLite3Base()
  {
   m_db=NULL;
   m_bopened=false;
  }
//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
CSQLite3Base::~CSQLite3Base()
  {
   Disconnect();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Base::IsConnected()
  {
   return(m_bopened && m_db);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Connect(string dbfile)
  {
   if(IsConnected())
      return(SQLITE_OK);
   m_dbfile=dbfile;
   return(Reconnect());
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Base::Disconnect()
  {
   if(IsConnected())
      ::sqlite3_close(m_db);
   m_db=NULL;
   m_bopened=false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Reconnect()
  {
   Disconnect();
   uchar file[];
   StringToCharArray(m_dbfile,file);
   int res=::sqlite3_open(file,m_db);
   m_bopened=(res==SQLITE_OK && m_db);
   return(res);
  }
//+------------------------------------------------------------------+
//| Error message                                                    |
//+------------------------------------------------------------------+
string CSQLite3Base::ErrorMsg()
  {
   PTR64 pstr=::sqlite3_errmsg(m_db);  // get message string
   int len=::strlen(pstr);             // length of string
   uchar str[];
   ArrayResize(str,len+1);            // prepare buffer
   ::strcpy(str,pstr);                // read string to buffer
   return(CharArrayToString(str));    // return string
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Base::BindStatement(sqlite3_stmt_p64 stmt,int column,CSQLite3Cell &cell)
  {
   if(!stmt || column<0)
      return(false);
   int bytes=cell.buf.Len();
   enCellType type=cell.type;
//---
   if(type==CT_INT)        return(::sqlite3_bind_int(stmt, column+1, cell.buf.ViewInt())==SQLITE_OK);
   else if(type==CT_INT64) return(::sqlite3_bind_int64(stmt, column+1, cell.buf.ViewInt64())==SQLITE_OK);
   else if(type==CT_DBL)   return(::sqlite3_bind_double(stmt, column+1, cell.buf.ViewDouble())==SQLITE_OK);
   else if(type==CT_TEXT)  return(::sqlite3_bind_text(stmt, column+1, cell.buf.m_data, cell.buf.Len(), SQLITE_STATIC)==SQLITE_OK);
   else if(type==CT_BLOB)  return(::sqlite3_bind_blob(stmt, column+1, cell.buf.m_data, cell.buf.Len(), SQLITE_STATIC)==SQLITE_OK);
   else if(type==CT_NULL)  return(::sqlite3_bind_null(stmt, column+1)==SQLITE_OK);
   else                    return(::sqlite3_bind_null(stmt, column+1)==SQLITE_OK);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Base::ReadStatement(sqlite3_stmt_p64 stmt,int column,CSQLite3Cell &cell)
  {
   cell.Clear();
   if(!stmt || column<0)
      return(false);
   int bytes=::sqlite3_column_bytes(stmt,column);
   int type=::sqlite3_column_type(stmt,column);
//---
   if(type==SQLITE_NULL)
      cell.type=CT_NULL;
   else if(type==SQLITE_INTEGER)
     {
      if(bytes<5)
         cell.Set(::sqlite3_column_int(stmt,column));
      else
         cell.Set(::sqlite3_column_int64(stmt,column));
     }
   else if(type==SQLITE_FLOAT)
      cell.Set(::sqlite3_column_double(stmt,column));
   else if(type==SQLITE_TEXT || type==SQLITE_BLOB)
     {
      uchar dst[];
      ArrayResize(dst,bytes);
      PTR64 ptr=0;
      if(type==SQLITE_TEXT)
         ptr=::sqlite3_column_text(stmt,column);
      else
         ptr=::sqlite3_column_blob(stmt,column);
      ::memcpy(dst,ptr,bytes);
      if(type==SQLITE_TEXT)
         cell.Set(CharArrayToString(dst));
      else
         cell.Set(dst);
     }
   return(true);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Query(string query)
  {
//--- check connection
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
//--- check query string
   if(StringLen(query)<=0)
      return(SQLITE_DONE);
   sqlite3_stmt_p64 stmt=0; // variable for pointer
//--- get pointer
   PTR64 pstmt=::memcpy(stmt,stmt,0);
   uchar str[];
   StringToCharArray(query,str);
//--- prepare statement and check result
   int res=::sqlite3_prepare(m_db,str,-1,pstmt,NULL);
   if(res!=SQLITE_OK)
      return(res);
//--- execute
   res=::sqlite3_step(pstmt);
//--- clean
   ::sqlite3_finalize(pstmt);
//--- return result
   return(res);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Exec(string query)
  {
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
   if(StringLen(query)<=0)
      return(SQLITE_DONE);
   uchar str[];
   StringToCharArray(query,str);
   int res=::sqlite3_exec(m_db,str,NULL,NULL,NULL);
   return(res);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Query(CSQLite3Table &tbl,string query)
  {
   tbl.Clear();
//--- check connection
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
//--- check query string
   if(StringLen(query)<=0)
      return(SQLITE_DONE);
//---
   sqlite3_stmt_p64 stmt=NULL;
   PTR64 pstmt=::memcpy(stmt,stmt,0);
   uchar str[]; StringToCharArray(query,str);
   int res=::sqlite3_prepare(m_db, str, -1, pstmt, NULL); if(res!=SQLITE_OK) return(res);
   int cols=::sqlite3_column_count(pstmt); // get column count
   bool b=true;
   while(::sqlite3_step(pstmt)==SQLITE_ROW) // in loop get row data
     {
      CSQLite3Row row; // row for table
      for(int i=0; i<cols; i++) // add cells to row
        {
         CSQLite3Cell cell;
         if(ReadStatement(pstmt,i,cell)) row.Add(cell); else { b=false; break; }
        }
      tbl.Add(row); // add row to table
      if(!b) break; // if error enabled
     }
// get column name
   for(int i=0; i<cols; i++)
     {
      PTR64 pstr=::sqlite3_column_name(pstmt,i); if(!pstr) { tbl.ColumnName(i,""); continue; }
      int len=::strlen(pstr);
      ArrayResize(str,len+1);
      ::strcpy(str,pstr);
      tbl.ColumnName(i,CharArrayToString(str));
     }
   ::sqlite3_finalize(stmt); // clean
   return(b?SQLITE_DONE:res); // return result code
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::QueryBind(CSQLite3Row &row,string query) // UPDATE <table> SET <row>=?, <row2>=?  WHERE (cond)
  {
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
//---
   if(StringLen(query)<=0 || ArraySize(row.m_data)<=0)
      return(SQLITE_DONE);
//---
   sqlite3_stmt_p64 stmt=NULL;
   PTR64 pstmt=::memcpy(stmt,stmt,0);
   uchar str[];
   StringToCharArray(query,str);
   int res=::sqlite3_prepare(m_db, str, -1, pstmt, NULL);
   if(res!=SQLITE_OK)
      return(res);
//---
   bool b=true;
   for(int i=0; i<ArraySize(row.m_data); i++)
     {
      if(!BindStatement(pstmt,i,row.m_data[i]))
        {
         b=false;
         break;
        }
     }
   if(b)
      res=::sqlite3_step(pstmt); // executed
   ::sqlite3_finalize(pstmt);    // clean
   return(b?res:SQLITE_ERROR);   // result
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::Transact(string &query[])
  {
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
   if(ArraySize(query)<=0)
      return(SQLITE_DONE);

   int res=Exec("BEGIN");
//--- create transaction
   if(res!=SQLITE_OK)
      return(res);
   for(int i=0; i<ArraySize(query); i++)
     {
      res=Exec(query[i]);
      if(res!=SQLITE_DONE)
        {
         Exec("ROLLBACK");
         return(res);
        }
     }
   Exec("COMMIT");
   return(SQLITE_DONE);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Base::TransactBind(CSQLite3Table &tbl,string query)
  {
   if(!IsConnected())
      if(!Reconnect())
         return(SQLITE_ERROR);
   if(StringLen(query)<=0 || ArraySize(tbl.m_data)<=0)
      return(SQLITE_DONE);

   int res=Exec("BEGIN");
//--- create transaction
   if(res!=SQLITE_OK)
      return(res);
   for(int i=0; i<ArraySize(tbl.m_data); i++)
     {
      res=QueryBind(tbl.m_data[i],query);
      if(res!=SQLITE_DONE)
        {
         Exec("ROLLBACK");
         return(res);
        }
     }
   Exec("COMMIT");
   return(SQLITE_DONE);
  }
//+------------------------------------------------------------------+
