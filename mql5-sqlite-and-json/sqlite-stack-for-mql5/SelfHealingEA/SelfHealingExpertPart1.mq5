//+------------------------------------------------------------------+
//|                                            SelfHealingExpert.mq5 |
//|          Copyright 2026, MetaQuotes Ltd. Developer is Chacha Ian |
//|                          https://www.mql5.com/en/users/chachaian |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, MetaQuotes Ltd. Developer is Chacha Ian"
#property link      "https://www.mql5.com/en/users/chachaian"
#property version   "1.00"
#include <Trade\Trade.mqh>
//+------------------------------------------------------------------+
//| Database configuration                                           |
//+------------------------------------------------------------------+
#define DATABASE_FILE_NAME "self_healing_trade_manager.sqlite"
//+------------------------------------------------------------------+
//| Enumeration: Defines the direction of the test trade.            |
//+------------------------------------------------------------------+
enum ENUM_TEST_TRADE_DIRECTION
  {
   TEST_TRADE_BUY,   // Open a BUY position
   TEST_TRADE_SELL   // Open a SELL position
  };
//+------------------------------------------------------------------+
//| Enumeration: Defines the current operational state of the EA.    |
//+------------------------------------------------------------------+
enum ENUM_EA_STATE
  {
   EA_STATE_STARTING,
   EA_STATE_RECOVERING,
   EA_STATE_RUNNING,
   EA_STATE_SAFE_MODE,
   EA_STATE_ERROR
  };
//+------------------------------------------------------------------+
//| User Input Parameters                                            |
//+------------------------------------------------------------------+
input long   InpMagicNumber     = 20260509;
input int    InpTimerSeconds    = 5;
input double InpVirtualSLPoints = 500;
input double InpVirtualTPPoints = 1000;
input double InpLots            = 0.01;
input bool   InpAllowTestTrade  = true;
input bool   InpOpenTestTradeOnStartup = true;
input ENUM_TEST_TRADE_DIRECTION InpTestTradeDirection = TEST_TRADE_BUY;
input bool   InpUseBreakeven           = true;
input double InpBreakevenTriggerPoints = 300;
input double InpBreakevenLockPoints    = 20;
input bool   InpUseTrailingStop        = true;
input double InpTrailStartPoints       = 500;
input double InpTrailStepPoints        = 100;
input double InpTrailDistancePoints    = 300;
//+------------------------------------------------------------------+
//| Structure: Stores the persistent operational state and risk      |
//| parameters of an active trade for recovery after a system crash. |
//+------------------------------------------------------------------+
struct STradeState
  {
   ulong             ticket;
   string            symbol;
   long              magic;
   int               direction;
   double            volume;
   double            entryPrice;
   double            virtualSL;
   double            virtualTP;
   double            lastTrailPrice;
   bool              breakevenActivated;
   bool              trailingActivated;
   datetime          openTime;
   datetime          lastHeartbeat;
   datetime          lastUpdateTime;
  };
//+------------------------------------------------------------------+
//| Global variables: Maintain the EA's runtime state, active trade  |
//| information, and SQLite database connection during execution.    |
//+------------------------------------------------------------------+
ENUM_EA_STATE g_eaState       = EA_STATE_STARTING; // Current operational state of the Expert Advisor.
STradeState   g_tradeState;                        // Active trade's virtual management and recovery state.
bool          g_hasTradeState = false;             // Indicates whether a valid trade state is currently loaded.
int           g_database      = INVALID_HANDLE;    // Active SQLite database connection handle.
CTrade        g_trade;                             // Trading object used to send test orders.
//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
//--- Create a connection to the SQLite database
   if(!OpenDatabase())
     {
      g_eaState = EA_STATE_ERROR;
      return(INIT_FAILED);
     }
//--- Create the database table or make sure that it exists
   if(!EnsureDatabaseTables())
     {
      CloseDatabase();
      g_eaState = EA_STATE_ERROR;
      return(INIT_FAILED);
     }
//--- create timer
   EventSetTimer(InpTimerSeconds);
//--- Sets the EA to RUNNING state
   g_eaState = EA_STATE_RUNNING;
   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
//--- Close the database connection
   CloseDatabase();
//--- destroy timer
   EventKillTimer();
  }
//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
//---
  }
//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
//---
  }
//+------------------------------------------------------------------+
//| Opens the SQLite database used for persistent trade state.       |
//+------------------------------------------------------------------+
bool OpenDatabase()
  {
//--- open or create the SQLite database file
   g_database = DatabaseOpen(DATABASE_FILE_NAME,
                             DATABASE_OPEN_READWRITE |
                             DATABASE_OPEN_CREATE);

//--- validate database handle
   if(g_database == INVALID_HANDLE)
     {
      //--- print database initialization error
      PrintFormat("Failed to open database. Error: %d", GetLastError());

      return(false);
     }
//--- database opened successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Ensures that all required SQLite tables exist.                   |
//+------------------------------------------------------------------+
bool EnsureDatabaseTables()
  {
//--- validate database connection
   if(g_database == INVALID_HANDLE)
     {
      //--- database is not available
      Print("Cannot ensure database tables because the database is not open.");

      return(false);
     }

//--- SQL query used to create the trade state table
   string query =
      "CREATE TABLE IF NOT EXISTS trade_states ("
      "ticket INTEGER PRIMARY KEY,"
      "symbol TEXT,"
      "magic INTEGER,"
      "direction INTEGER,"
      "volume REAL,"
      "entry_price REAL,"
      "virtual_sl REAL,"
      "virtual_tp REAL,"
      "last_trail_price REAL,"
      "breakeven_activated INTEGER,"
      "trailing_activated INTEGER,"
      "open_time INTEGER,"
      "last_heartbeat INTEGER,"
      "last_update_time INTEGER,"
      "state TEXT"
      ");";

//--- execute table creation query
   if(!DatabaseExecute(g_database, query))
     {
      //--- print SQL execution error
      PrintFormat("Failed to ensure database tables. Error: %d", GetLastError());

      return(false);
     }

//--- required database tables verified successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Closes the active SQLite database connection.                    |
//+------------------------------------------------------------------+
void CloseDatabase()
  {
//--- validate database handle
   if(g_database == INVALID_HANDLE)
      return;

//--- close SQLite database connection
   DatabaseClose(g_database);

//--- reset database handle
   g_database = INVALID_HANDLE;
  }
//+------------------------------------------------------------------+
//| Saves or updates the active trade state in the SQLite database.  |
//+------------------------------------------------------------------+
bool SaveTradeState(const STradeState &state)
  {
//--- validate database connection
   if(g_database == INVALID_HANDLE)
     {
      //--- database connection unavailable
      Print("Cannot save trade state because the database is not open.");

      return(false);
     }

//--- prepare SQL query used to save the trade state
   string query = StringFormat(
                     "INSERT OR REPLACE INTO trade_states "
                     "(ticket,symbol,magic,direction,volume,entry_price,virtual_sl,virtual_tp,"
                     "last_trail_price,breakeven_activated,trailing_activated,open_time,"
                     "last_heartbeat,last_update_time,state) "
                     "VALUES (%I64u,'%s',%I64d,%d,%.8f,%.8f,%.8f,%.8f,%.8f,%d,%d,%I64d,%I64d,%I64d,'ACTIVE');",
                     state.ticket,
                     state.symbol,
                     state.magic,
                     state.direction,
                     state.volume,
                     state.entryPrice,
                     state.virtualSL,
                     state.virtualTP,
                     state.lastTrailPrice,
                     state.breakevenActivated ? 1 : 0,
                     state.trailingActivated ? 1 : 0,
                     (long)state.openTime,
                     (long)state.lastHeartbeat,
                     (long)state.lastUpdateTime
                  );

//--- execute SQL save query
   if(!DatabaseExecute(g_database, query))
     {
      //--- print SQL execution error
      PrintFormat("Failed to save trade state. Error: %d", GetLastError());

      return(false);
     }

//--- trade state saved successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Checks whether a trade state record exists for a ticket.         |
//+------------------------------------------------------------------+
bool TradeStateExists(const ulong ticket)
  {
//--- validate database connection
   if(g_database == INVALID_HANDLE)
      return(false);
//--- prepare SQL query used to search for the trade ticket
   string query =
      StringFormat("SELECT ticket FROM trade_states WHERE ticket=%I64u;",
                   ticket);
//--- prepare SQLite query request
   int request = DatabasePrepare(g_database, query);
//--- validate SQLite request handle
   if(request == INVALID_HANDLE)
     {
      //--- print SQLite preparation error
      PrintFormat("Failed to prepare trade state existence query. Error: %d",
                  GetLastError());
      return(false);
     }
//--- read SQLite query result
   bool exists = DatabaseRead(request);
//--- release SQLite request resources
   DatabaseFinalize(request);
//--- return query result
   return(exists);
  }
//+------------------------------------------------------------------+
//| Loads a saved trade state from the SQLite database by ticket.    |
//+------------------------------------------------------------------+
bool LoadTradeState(const ulong ticket, STradeState &state)
  {
//--- validate database connection
   if(g_database == INVALID_HANDLE)
     {
      //--- database connection unavailable
      Print("Cannot load trade state because the database is not open.");

      return(false);
     }
//--- prepare SQL query used to load the saved trade state
   string query = StringFormat(
                     "SELECT ticket,symbol,magic,direction,volume,entry_price,virtual_sl,virtual_tp,"
                     "last_trail_price,breakeven_activated,trailing_activated,open_time,"
                     "last_heartbeat,last_update_time "
                     "FROM trade_states WHERE ticket=%I64u AND state='ACTIVE';",
                     ticket
                  );
//--- prepare SQLite query request
   int request = DatabasePrepare(g_database, query);
//--- validate SQLite request handle
   if(request == INVALID_HANDLE)
     {
      //--- print SQLite preparation error
      PrintFormat("Failed to prepare load trade state query. Error: %d",
                  GetLastError());
      return(false);
     }
//--- validate query result
   if(!DatabaseRead(request))
     {
      //--- release SQLite request resources
      DatabaseFinalize(request);
      return(false);
     }
//--- temporary database values
   long ticketValue;
   long magicValue;
   long openTimeValue;
   long heartbeatValue;
   long updateTimeValue;
   int  breakevenValue;
   int  trailingValue;
//--- read database column values
   DatabaseColumnLong(request, 0, ticketValue);
   DatabaseColumnText(request, 1, state.symbol);
   DatabaseColumnLong(request, 2, magicValue);
   DatabaseColumnInteger(request, 3, state.direction);
   DatabaseColumnDouble(request, 4, state.volume);
   DatabaseColumnDouble(request, 5, state.entryPrice);
   DatabaseColumnDouble(request, 6, state.virtualSL);
   DatabaseColumnDouble(request, 7, state.virtualTP);
   DatabaseColumnDouble(request, 8, state.lastTrailPrice);
   DatabaseColumnInteger(request, 9, breakevenValue);
   DatabaseColumnInteger(request, 10, trailingValue);
   DatabaseColumnLong(request, 11, openTimeValue);
   DatabaseColumnLong(request, 12, heartbeatValue);
   DatabaseColumnLong(request, 13, updateTimeValue);
//--- rebuild runtime trade state
   state.ticket              = (ulong)ticketValue;
   state.magic               = magicValue;
   state.breakevenActivated  = (breakevenValue > 0);
   state.trailingActivated   = (trailingValue > 0);
   state.openTime            = (datetime)openTimeValue;
   state.lastHeartbeat       = (datetime)heartbeatValue;
   state.lastUpdateTime      = (datetime)updateTimeValue;
//--- release SQLite request resources
   DatabaseFinalize(request);
//--- trade state restored successfully
   return(true);
  }
//+------------------------------------------------------------------+
