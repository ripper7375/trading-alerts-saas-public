//+------------------------------------------------------------------+
//|                                                    SQLite3Define |
//+------------------------------------------------------------------+
#include <MQH\Ctrl\ByteImg.mqh>
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
enum enCellType
  {
   CT_UNDEF,
   CT_NULL,
   CT_INT,
   CT_INT64,
   CT_DBL,
   CT_TEXT,
   CT_BLOB,
   CT_LAST
  };
//+------------------------------------------------------------------+
//| CSQLite3Cell class                                               |
//+------------------------------------------------------------------+
class CSQLite3Cell
  {

public:
   enCellType        type;
   CByteImg          buf;

public:
                     CSQLite3Cell();
                     CSQLite3Cell(const CSQLite3Cell &a);
                     CSQLite3Cell(int a);
                     CSQLite3Cell(long a);
                     CSQLite3Cell(double a);
                     CSQLite3Cell(string a);
                     CSQLite3Cell(uchar &a[]);

                    ~CSQLite3Cell() { Clear(); }
   //---
   void operator=(const CSQLite3Cell &a) { Copy(a); }

public:
   void              Clear();
   bool              Copy(const CSQLite3Cell &a);

   //--- Set
   void              Set(enCellType ct);
   void              Set(int a);
   void              Set(long a);
   void              Set(double a);
   void              Set(string a);
   void              Set(uchar &a[]);

   //--- Get
   int               GetInt();
   long              GetInt64();
   double            GetDouble();
   string            GetString();
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell()
  {
   Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(const CSQLite3Cell &a)
  {
   Copy(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(int a)
  {
   Set(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(long a)
  {
   Set(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(double a)
  {
   Set(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(string a)
  {
   Set(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Cell::CSQLite3Cell(uchar &a[])
  {
   Set(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Clear()
  {
   type=CT_UNDEF;
   buf.Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Cell::Copy(const CSQLite3Cell &a)
  {
   type=a.type;
   buf.Copy(a.buf);
   return(true);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(enCellType ct)
  {
   type=ct;
   buf.Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(int a)
  {
   type=CT_INT;
   buf.AssignInt(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(long a)
  {
   type=CT_INT64;
   buf.AssignInt64(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(double a)
  {
   type=CT_DBL;
   buf.AssignDouble(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(string a)
  {
   type=CT_TEXT;
   buf.AssignString(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Cell::Set(uchar &a[])
  {
   type=CT_BLOB;
   buf.AssignArray(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int CSQLite3Cell::GetInt()
  {
   if(type==CT_INT) return(buf.ViewInt());
   if(type==CT_INT64) return((int)buf.ViewInt64());
   if(type==CT_DBL) return((int)buf.ViewDouble());
   if(type==CT_TEXT) return((int)StringToInteger(buf.ViewString()));
   return(0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
long CSQLite3Cell::GetInt64()
  {
   if(type==CT_INT) return(buf.ViewInt());
   if(type==CT_INT64) return(buf.ViewInt64());
   if(type==CT_DBL) return((long)buf.ViewDouble());
   if(type==CT_TEXT) return(StringToInteger(buf.ViewString()));
   return(0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double CSQLite3Cell::GetDouble()
  {
   if(type==CT_INT) return((double)buf.ViewInt());
   if(type==CT_INT64) return((double)buf.ViewInt64());
   if(type==CT_DBL) return(buf.ViewDouble());
   if(type==CT_TEXT) return(StringToDouble(buf.ViewString()));
   return(0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string CSQLite3Cell::GetString()
  {
   if(type==CT_INT) return(IntegerToString(buf.ViewInt()));
   if(type==CT_INT64) return(IntegerToString(buf.ViewInt64()));
   if(type==CT_DBL) return(DoubleToString(buf.ViewDouble()));
   if(type==CT_TEXT) return(buf.ViewString());
   return("");
  }
//+------------------------------------------------------------------+
//| CSQLite3Row class                                                |
//+------------------------------------------------------------------+
class CSQLite3Row
  {

public:
   CSQLite3Cell      m_data[];

public:
                     CSQLite3Row();
                     CSQLite3Row(const CSQLite3Row &a);
                    ~CSQLite3Row();
   //---
   void operator=(const CSQLite3Row &a) { Copy(a); }

public:
   void              Clear();
   bool              Copy(const CSQLite3Row &a);

public:
   void              Add(const CSQLite3Cell &a);
   void              Add(enCellType atype);
   void              Add(int a);
   void              Add(long a);
   void              Add(double a);
   void              Add(string a);
   void              Add(uchar &a[]);

   string            BindStr();
   bool              Cell(int icol,CSQLite3Cell &acell);
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Row::CSQLite3Row()
  {
   Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Row::CSQLite3Row(const CSQLite3Row &a)
  {
   Copy(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Row::~CSQLite3Row()
  {
   Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Clear()
  {
   ArrayResize(m_data,0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Row::Copy(const CSQLite3Row &a)
  {
   ArrayResize(m_data,ArraySize(a.m_data));
   for(int i=ArraySize(m_data)-1; i>=0; i--)
      m_data[i].Copy(a.m_data[i]);
   return(true);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(const CSQLite3Cell &a)
  {
   int sz=ArraySize(m_data);
   ArrayResize(m_data,sz+1);
   m_data[sz].Copy(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(enCellType atype)
  {
   CSQLite3Cell c;
   c.type=atype;
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(int a)
  {
   CSQLite3Cell c(a);
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(long a)
  {
   CSQLite3Cell c(a);
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(double a)
  {
   CSQLite3Cell c(a);
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(string a)
  {
   CSQLite3Cell c(a);
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Row::Add(uchar &a[])
  {
   CSQLite3Cell c(a);
   Add(c);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string CSQLite3Row::BindStr()
  {
   string str="";
   for(int i=ArraySize(m_data)-1; i>0; i--)
      str+="?, ";
   str+="?";
   return(str);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Row::Cell(int icol,CSQLite3Cell &acell)
  {
   acell.Clear();
   if(ArraySize(m_data)<=icol)
      return(false);
   acell.Copy(m_data[icol]);
   return(true);
  }
//+------------------------------------------------------------------+
//| CSQLite3Table class                                              |
//+------------------------------------------------------------------+
class CSQLite3Table
  {

public:
   string            m_colname[]; // column name
   CSQLite3Row       m_data[]; // database rows

public:
                     CSQLite3Table();
                     CSQLite3Table(const CSQLite3Table &a);
                    ~CSQLite3Table();
   //---
   void operator=(const CSQLite3Table &a) { Copy(a); }

public:
   void              Clear();
   bool              Copy(const CSQLite3Table &a);

public:
   void              Add(const CSQLite3Row &a);
   CSQLite3Row      *Row(int irow);
   bool              Cell(int irow,int icol,CSQLite3Cell &acell);

   void              ColumnName(int icol,string aname);
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Table::CSQLite3Table()
  {
   Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Table::CSQLite3Table(const CSQLite3Table &a)
  {
   Copy(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Table::~CSQLite3Table()
  {
   Clear();
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Table::Clear()
  {
   ArrayResize(m_colname,0);
   ArrayResize(m_data,0);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Table::Copy(const CSQLite3Table &a)
  {
   ArrayCopy(m_colname,a.m_colname);
   int n=ArraySize(a.m_data); if (ArrayResize(m_data, n)!=n) return false;
   for (int i=0; i<n; ++i) m_data[i]=a.m_data[i];
   return(true);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Table::Add(const CSQLite3Row &a)
  {
   int sz=ArraySize(m_data);
   ArrayResize(m_data,sz+1);
   m_data[sz].Copy(a);
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
CSQLite3Row *CSQLite3Table::Row(int irow)
  {
   if(ArraySize(m_data)<=irow)
      return(NULL);
   return(GetPointer(m_data[irow]));
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool CSQLite3Table::Cell(int irow,int icol,CSQLite3Cell &acell)
  {
   acell.Clear();
   if(ArraySize(m_data)<=irow)
      return(false);
   return(m_data[irow].Cell(icol,acell));
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CSQLite3Table::ColumnName(int icol,string aname)
  {
   int sz=ArraySize(m_colname);
   if(sz<=icol)
      ArrayResize(m_colname,icol+1);
   m_colname[icol]=aname;
  }
//+------------------------------------------------------------------+
