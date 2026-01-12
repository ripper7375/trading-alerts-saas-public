//+------------------------------------------------------------------+
//|                                                   SQLite3Import.mqh |
//+------------------------------------------------------------------+

#include <MQH\Lib\WinApi\msvcrt\memcpy.mqh>
#include <MQH\Lib\WinApi\msvcrt\strlen.mqh>
#include <MQH\Lib\WinApi\msvcrt\strcpy.mqh>

#define PTR32              int
#define sqlite3_stmt_p32   PTR32
#define sqlite3_p32        PTR32
#define PTRPTR32           PTR32

#define PTR64              long
#define sqlite3_stmt_p64   PTR64
#define sqlite3_p64        PTR64
#define PTRPTR64           PTR64

#define SQLITE_STATIC      0

// data types
#define SQLITE_INTEGER  1
#define SQLITE_FLOAT    2
#define SQLITE_TEXT     3
#define SQLITE_BLOB     4
#define SQLITE_NULL     5

#import "sqlite3_32.dll"
int sqlite3_open(const uchar &filename[],sqlite3_p32 &paDb);
int sqlite3_close(sqlite3_p32 aDb);
int sqlite3_prepare(sqlite3_p32 aDb,const uchar &sql[],int nByte,sqlite3_stmt_p32 &pStmt,PTRPTR32 pzTail);
int sqlite3_exec(sqlite3_p32 aDb,const uchar &sql[],PTR32 acallback,PTR32 apvoid,PTRPTR32 errmsg);
int sqlite3_step(sqlite3_stmt_p32 apstmt);
int sqlite3_finalize(sqlite3_stmt_p32 apstmt);
int sqlite3_errcode(sqlite3_p32 db);
int sqlite3_extended_errcode(sqlite3_p32 db);
const PTR32 sqlite3_errmsg(sqlite3_p32 db);

int sqlite3_bind_null(sqlite3_stmt_p32 apstmt,int icol);
int sqlite3_bind_int(sqlite3_stmt_p32 apstmt,int icol,int a);
int sqlite3_bind_int64(sqlite3_stmt_p32 apstmt,int icol,long a);
int sqlite3_bind_double(sqlite3_stmt_p32 apstmt,int icol,double a);
int sqlite3_bind_text(sqlite3_stmt_p32 apstmt,int icol,uchar &a[],int len,PTRPTR32 destr);
int sqlite3_bind_blob(sqlite3_stmt_p32 apstmt,int icol,uchar &a[],int len,PTRPTR32 destr);

const PTR32 sqlite3_column_name(sqlite3_stmt_p32 apstmt,int icol);

int sqlite3_column_count(sqlite3_stmt_p32 apstmt);
int sqlite3_column_type(sqlite3_stmt_p32 apstmt,int acol);
int sqlite3_column_bytes(sqlite3_stmt_p32 apstmt,int acol);
int sqlite3_column_int(sqlite3_stmt_p32 apstmt,int acol);
long sqlite3_column_int64(sqlite3_stmt_p32 apstmt,int acol);
double sqlite3_column_double(sqlite3_stmt_p32 apstmt,int acol);
const PTR32 sqlite3_column_text(sqlite3_stmt_p32 apstmt,int acol);
const PTR32 sqlite3_column_blob(sqlite3_stmt_p32 apstmt,int acol);

#import "sqlite3_64.dll"
int sqlite3_open(const uchar &filename[],sqlite3_p64 &paDb);
int sqlite3_close(sqlite3_p64 aDb);
int sqlite3_prepare(sqlite3_p64 aDb,const uchar &sql[],int nByte,sqlite3_stmt_p64 &pStmt,PTRPTR64 pzTail);
int sqlite3_exec(sqlite3_p64 aDb,const uchar &sql[],PTR64 acallback,PTR64 avoid,PTRPTR64 errmsg);
int sqlite3_step(sqlite3_stmt_p64 apstmt);
int sqlite3_finalize(sqlite3_stmt_p64 apstmt);
int sqlite3_errcode(sqlite3_p64 db);
int sqlite3_extended_errcode(sqlite3_p64 db);
const PTR64 sqlite3_errmsg(sqlite3_p64 db);

int sqlite3_bind_null(sqlite3_stmt_p64 apstmt,int icol);
int sqlite3_bind_int(sqlite3_stmt_p64 apstmt,int icol,int a);
int sqlite3_bind_int64(sqlite3_stmt_p64 apstmt,int icol,long a);
int sqlite3_bind_double(sqlite3_stmt_p64 apstmt,int icol,double a);
int sqlite3_bind_text(sqlite3_stmt_p64 apstmt,int icol,uchar &a[],int len,PTRPTR64 destr);
int sqlite3_bind_blob(sqlite3_stmt_p64 apstmt,int icol,uchar &a[],int len,PTRPTR64 destr);

const PTR64 sqlite3_column_name(sqlite3_stmt_p64 apstmt,int icol);

int sqlite3_column_count(sqlite3_stmt_p64 apstmt);
int sqlite3_column_type(sqlite3_stmt_p64 apstmt,int acol);
int sqlite3_column_bytes(sqlite3_stmt_p64 apstmt,int acol);
int sqlite3_column_int(sqlite3_stmt_p64 apstmt,int acol);
long sqlite3_column_int64(sqlite3_stmt_p64 apstmt,int acol);
double sqlite3_column_double(sqlite3_stmt_p64 apstmt,int acol);
const PTR64 sqlite3_column_text(sqlite3_stmt_p64 apstmt,int acol);
const PTR64 sqlite3_column_blob(sqlite3_stmt_p64 apstmt,int acol);
#import

int sqlite3_open(const uchar &filename[],sqlite3_p64 &ppDb) { if(_IsX64) return(sqlite3_64::sqlite3_open(filename,ppDb)); else { sqlite3_p32 pdb=NULL; int r=sqlite3_32::sqlite3_open(filename,pdb); ppDb=pdb; return(r); } }
int sqlite3_close(PTR64 pDb) { if(_IsX64) return(sqlite3_64::sqlite3_close(pDb)); else return(sqlite3_32::sqlite3_close((PTR32)pDb)); };
int sqlite3_exec(sqlite3_p64 aDb,const uchar &sql[],PTR64 acallback,PTR64 avoid,PTRPTR64 errmsg) { if(_IsX64) return(sqlite3_64::sqlite3_exec(aDb,sql,acallback,avoid,errmsg)); else return(sqlite3_32::sqlite3_exec((sqlite3_p32)aDb,sql,(PTR32)acallback,(PTR32)avoid,(PTRPTR32)errmsg)); }
int sqlite3_prepare(sqlite3_p64 aDb,const uchar &sql[],int nByte,sqlite3_stmt_p64 &pStmt,PTRPTR64 pzTail) { if(_IsX64) return(sqlite3_64::sqlite3_prepare(aDb,sql,nByte,pStmt,pzTail)); else { sqlite3_stmt_p32 pstmt=NULL; int r=sqlite3_32::sqlite3_prepare(aDb,sql,nByte,pstmt,pzTail); pStmt=pstmt; return(r); } }
int sqlite3_step(sqlite3_stmt_p64 apstmt) { if(_IsX64) return(sqlite3_64::sqlite3_step(apstmt)); else return(sqlite3_32::sqlite3_step((sqlite3_stmt_p32)apstmt)); }
int sqlite3_finalize(sqlite3_stmt_p64 apstmt) { if(_IsX64) return(sqlite3_64::sqlite3_finalize(apstmt)); else return(sqlite3_32::sqlite3_finalize((sqlite3_stmt_p32)apstmt)); }

int sqlite3_errcode(sqlite3_p64 db) { if(_IsX64) return(sqlite3_64::sqlite3_errcode(db)); else return(sqlite3_32::sqlite3_errcode((sqlite3_stmt_p32)db)); }
int sqlite3_extended_errcode(sqlite3_p64 db) { if(_IsX64) return(sqlite3_64::sqlite3_extended_errcode(db)); else return(sqlite3_32::sqlite3_extended_errcode((sqlite3_stmt_p32)db)); }
const PTR64 sqlite3_errmsg(sqlite3_p64 db) { if(_IsX64) return(sqlite3_64::sqlite3_errmsg(db)); else return(sqlite3_32::sqlite3_errmsg((sqlite3_stmt_p32)db)); }

int sqlite3_bind_null(sqlite3_stmt_p64 apstmt,int icol) { if(_IsX64) return(sqlite3_64::sqlite3_bind_null(apstmt,icol)); else return(sqlite3_32::sqlite3_bind_null((sqlite3_stmt_p32)apstmt,icol)); }
int sqlite3_bind_int(sqlite3_stmt_p64 apstmt,int icol,int a) { if(_IsX64) return(sqlite3_64::sqlite3_bind_int(apstmt,icol,a)); else return(sqlite3_32::sqlite3_bind_int((sqlite3_stmt_p32)apstmt,icol,a)); }
int sqlite3_bind_int64(sqlite3_stmt_p64 apstmt,int icol,long a) { if(_IsX64) return(sqlite3_64::sqlite3_bind_int64(apstmt,icol,a)); else return(sqlite3_32::sqlite3_bind_int64((sqlite3_stmt_p32)apstmt,icol,a)); }
int sqlite3_bind_double(sqlite3_stmt_p64 apstmt,int icol,double a) { if(_IsX64) return(sqlite3_64::sqlite3_bind_double(apstmt,icol,a)); else return(sqlite3_32::sqlite3_bind_double((sqlite3_stmt_p32)apstmt,icol,a)); }
int sqlite3_bind_text(sqlite3_stmt_p64 apstmt,int icol,uchar &a[],int len,PTRPTR64 destr) { if(_IsX64) return(sqlite3_64::sqlite3_bind_text(apstmt,icol,a,len,destr)); else return(sqlite3_32::sqlite3_bind_text((sqlite3_stmt_p32)apstmt,icol,a,len,(PTRPTR32)destr)); }
int sqlite3_bind_blob(sqlite3_stmt_p64 apstmt,int icol,uchar &a[],int len,PTRPTR64 destr) { if(_IsX64) return(sqlite3_64::sqlite3_bind_blob(apstmt,icol,a,len,destr)); else return(sqlite3_32::sqlite3_bind_blob((sqlite3_stmt_p32)apstmt,icol,a,len,(PTRPTR32)destr)); }

const PTR64 sqlite3_column_name(sqlite3_stmt_p64 apstmt,int icol) { if(_IsX64) return(sqlite3_64::sqlite3_column_name(apstmt,icol)); else return(sqlite3_32::sqlite3_column_name((sqlite3_stmt_p32)apstmt,icol)); }
int sqlite3_column_count(sqlite3_stmt_p64 apstmt) { if(_IsX64) return(sqlite3_64::sqlite3_column_count(apstmt)); else { sqlite3_stmt_p32 pstmt=(sqlite3_stmt_p32)apstmt; int r=sqlite3_32::sqlite3_column_count(pstmt); apstmt=pstmt; return(r); } }
int sqlite3_column_type(sqlite3_stmt_p64 apstmt,int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_type(apstmt,acol)); else return(sqlite3_32::sqlite3_column_type((sqlite3_stmt_p32)apstmt,acol)); }
int sqlite3_column_bytes(sqlite3_stmt_p64 apstmt,int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_bytes(apstmt,acol)); else return(sqlite3_32::sqlite3_column_bytes((sqlite3_stmt_p32)apstmt,acol)); }
int sqlite3_column_int(sqlite3_stmt_p64 apstmt,int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_int(apstmt,acol)); else return(sqlite3_32::sqlite3_column_int((sqlite3_stmt_p32)apstmt,acol)); }
long sqlite3_column_int64(sqlite3_stmt_p64 apstmt,int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_int64(apstmt,acol)); else return(sqlite3_32::sqlite3_column_int64((sqlite3_stmt_p32)apstmt,acol)); }
double sqlite3_column_double(sqlite3_stmt_p64 apstmt,int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_double(apstmt,acol)); else return(sqlite3_32::sqlite3_column_double((sqlite3_stmt_p32)apstmt,acol)); }
const PTR64 sqlite3_column_text(sqlite3_stmt_p64 apstmt, int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_text(apstmt, acol)); else return(sqlite3_32::sqlite3_column_text((sqlite3_stmt_p32)apstmt, acol)); }
const PTR64 sqlite3_column_blob(sqlite3_stmt_p64 apstmt, int acol) { if(_IsX64) return(sqlite3_64::sqlite3_column_blob(apstmt, acol)); else return(sqlite3_32::sqlite3_column_blob((sqlite3_stmt_p32)apstmt, acol)); }

#define SQLITE_OK           0   /* Successful result */
/* beginning-of-error-codes */
#define SQLITE_ERROR        1   /* SQL error or missing database */
#define SQLITE_ROW        100   /* sqlite3_step() has another row ready */
#define SQLITE_DONE       101   /* sqlite3_step() has finished executing */
//+------------------------------------------------------------------+
