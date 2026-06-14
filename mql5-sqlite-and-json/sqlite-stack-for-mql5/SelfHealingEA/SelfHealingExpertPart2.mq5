
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
//--- set initial EA state
   g_eaState = EA_STATE_STARTING;

//--- create a connection to the SQLite database
   if(!OpenDatabase())
     {
      g_eaState = EA_STATE_ERROR;
      return(INIT_FAILED);
     }

//--- create the database table or make sure that it exists
   if(!EnsureDatabaseTables())
     {
      CloseDatabase();
      g_eaState = EA_STATE_ERROR;
      return(INIT_FAILED);
     }

//--- create timer
   EventSetTimer(InpTimerSeconds);

//--- enter recovery mode
   g_eaState = EA_STATE_RECOVERING;

//--- restore saved trade state if a managed position exists
   if(!RecoverTradeState())
     {
      Print("The EA entered Safe Mode because recovery was incomplete.");
      return(INIT_SUCCEEDED);
     }

//--- enter normal runtime state
   g_eaState = EA_STATE_RUNNING;

//--- remember whether recovery restored an active trade state
   bool recoveredTradeExists = g_hasTradeState;
   
//--- validate recovered virtual exits immediately
   CheckVirtualExits();
   
//--- open a test trade only when no recovered trade existed
   if(InpOpenTestTradeOnStartup && !g_hasTradeState && !recoveredTradeExists)
      OpenTestTrade();
      
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
//--- manage active virtual protection on every price tick
   ManageActiveTrade();
  }
//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
//--- manage active virtual protection at fixed intervals
   ManageActiveTrade();
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
//| Finds one open position managed by this Expert Advisor.          |
//+------------------------------------------------------------------+
bool FindManagedPosition(ulong &ticket)
  {
//--- initialize output ticket
   ticket = 0;
//--- scan all currently open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      //--- retrieve broker position ticket
      ulong positionTicket = PositionGetTicket(i);
      //--- skip invalid positions
      if(positionTicket == 0)
         continue;
      //--- retrieve broker position properties
      string positionSymbol = PositionGetString(POSITION_SYMBOL);
      long   positionMagic  = PositionGetInteger(POSITION_MAGIC);
      //--- ignore positions from different symbols
      if(positionSymbol != _Symbol)
         continue;
      //--- ignore positions belonging to other systems
      if(positionMagic != InpMagicNumber)
         continue;
      //--- managed position found successfully
      ticket = positionTicket;

      return(true);
     }
//--- no managed position found
   return(false);
  }
//+------------------------------------------------------------------+
//| Builds the initial virtual protection state for an open position.|
//+------------------------------------------------------------------+
void BuildInitialTradeState(const ulong ticket, STradeState &state)
  {
//--- validate broker position existence
   if(!PositionSelectByTicket(ticket))
     {
      //--- broker position unavailable
      PrintFormat("Cannot build trade state. Position not found. Ticket: %I64u", ticket);
      return;
     }
//--- retrieve broker position properties
   state.ticket              = ticket;
   state.symbol              = PositionGetString(POSITION_SYMBOL);
   state.magic               = PositionGetInteger(POSITION_MAGIC);
   state.direction           = (int)PositionGetInteger(POSITION_TYPE);
   state.volume              = PositionGetDouble(POSITION_VOLUME);
   state.entryPrice          = PositionGetDouble(POSITION_PRICE_OPEN);
   state.lastTrailPrice      = state.entryPrice;
   state.breakevenActivated  = false;
   state.trailingActivated   = false;
   state.openTime            = (datetime)PositionGetInteger(POSITION_TIME);
   state.lastHeartbeat       = TimeCurrent();
   state.lastUpdateTime      = TimeCurrent();
//--- construct BUY virtual protection
   if(state.direction == POSITION_TYPE_BUY)
     {
      state.virtualSL = state.entryPrice - (InpVirtualSLPoints * _Point);
      state.virtualTP = state.entryPrice + (InpVirtualTPPoints * _Point);
     }
//--- construct SELL virtual protection
   else if(state.direction == POSITION_TYPE_SELL)
     {
      state.virtualSL = state.entryPrice + (InpVirtualSLPoints * _Point);
      state.virtualTP = state.entryPrice - (InpVirtualTPPoints * _Point);
     }
  }
//+------------------------------------------------------------------+
//| Opens one test position without broker-side SL or TP levels.     |
//+------------------------------------------------------------------+
bool OpenTestTrade()
  {
//--- validate test trade permissions
   if(!InpAllowTestTrade)
      return(false);
//--- validate EA runtime state
   if(g_eaState != EA_STATE_RUNNING)
      return(false);
//--- prevent multiple managed positions
   ulong existingTicket = 0;
   if(FindManagedPosition(existingTicket))
     {
      //--- managed position already exists
      PrintFormat("Test trade was not opened. Managed position already exists. Ticket: %I64u",
                  existingTicket);
      return(false);
     }
//--- configure Expert Advisor magic number
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   bool result = false;
//--- open BUY test trade
   if(InpTestTradeDirection == TEST_TRADE_BUY)
      result = g_trade.Buy(InpLots,
                           _Symbol,
                           0.0,
                           0.0,
                           0.0,
                           "Self-healing EA test BUY");
//--- open SELL test trade
   else
      result = g_trade.Sell(InpLots,
                            _Symbol,
                            0.0,
                            0.0,
                            0.0,
                            "Self-healing EA test SELL");
//--- validate trade execution result
   if(!result)
     {
      //--- print broker execution failure
      PrintFormat("Failed to open test trade. Retcode: %d",
                  g_trade.ResultRetcode());
      return(false);
     }
//--- print successful trade execution
   PrintFormat("Test trade opened successfully. Order ticket: %I64u",
               g_trade.ResultOrder());
   ulong positionTicket = 0;
//--- locate managed broker position
   if(FindManagedPosition(positionTicket))
     {
      //--- construct runtime recovery state
      BuildInitialTradeState(positionTicket, g_tradeState);
      //--- activate runtime recovery tracking
      g_hasTradeState = true;
      //--- save initial recovery state into SQLite
      if(!SaveTradeState(g_tradeState))
         Print("Test trade was opened, but its initial state could not be saved.");
      else
         PrintFormat("Initial trade state saved successfully. Position ticket: %I64u",
                     positionTicket);
     }
   return(true);
  }
//+------------------------------------------------------------------+
//| Recovers the active trade state from SQLite after EA restart.    |
//+------------------------------------------------------------------+
bool RecoverTradeState()
  {
//--- initialize managed position ticket
   ulong ticket = 0;
//--- check whether a managed broker position exists
   if(!FindManagedPosition(ticket))
     {
      //--- no active position requires recovery
      Print("Recovery completed. No managed open position was found.");
      g_hasTradeState = false;
      return(true);
     }
//--- load saved trade state for the managed position
   if(!LoadTradeState(ticket, g_tradeState))
     {
      //--- saved state is missing while broker position exists
      PrintFormat("Recovery failed. Managed position exists, but no active saved state was found. Ticket: %I64u",
                  ticket);
      g_hasTradeState = false;
      g_eaState       = EA_STATE_SAFE_MODE;
      return(false);
     }
//--- activate recovered runtime trade state
   g_hasTradeState = true;
//--- print restored protection levels
   PrintFormat("Recovery completed. Trade state restored. Ticket: %I64u",
               g_tradeState.ticket);
   PrintFormat("Recovered virtual SL: %.5f | Recovered virtual TP: %.5f",
               g_tradeState.virtualSL,
               g_tradeState.virtualTP);
//--- recovery completed successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Marks a saved trade state as closed in the SQLite database.      |
//+------------------------------------------------------------------+
bool MarkTradeClosed(const ulong ticket)
  {
//--- validate database connection
   if(g_database == INVALID_HANDLE)
      return(false);
//--- prepare SQL query used to close the saved trade state
   string query = StringFormat(
                     "UPDATE trade_states SET state='CLOSED',last_update_time=%I64d "
                     "WHERE ticket=%I64u;",
                     (long)TimeCurrent(),
                     ticket
                  );
//--- execute SQL update query
   if(!DatabaseExecute(g_database, query))
     {
      //--- print SQL execution error
      PrintFormat("Failed to mark trade as closed. Error: %d", GetLastError());
      return(false);
     }
//--- trade state marked as closed successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Closes the active managed position and records the close reason. |
//+------------------------------------------------------------------+
bool CloseManagedPosition(const string reason)
  {
//--- validate active runtime trade state
   if(!g_hasTradeState)
      return(false);
//--- validate broker position existence
   if(!PositionSelectByTicket(g_tradeState.ticket))
     {
      //--- broker position unavailable
      PrintFormat("Cannot close managed position. Position not found. Ticket: %I64u",
                  g_tradeState.ticket);
      return(false);
     }
//--- close broker position
   if(!g_trade.PositionClose(g_tradeState.ticket))
     {
      //--- print broker close failure
      PrintFormat("Failed to close managed position. Reason: %s. Retcode: %d",
                  reason,
                  g_trade.ResultRetcode());

      return(false);
     }
//--- print successful broker close
   PrintFormat("Managed position closed. Ticket: %I64u. Reason: %s",
               g_tradeState.ticket,
               reason);
//--- mark saved recovery state as closed
   MarkTradeClosed(g_tradeState.ticket);
//--- deactivate runtime trade tracking
   g_hasTradeState = false;
//--- managed position closed successfully
   return(true);
  }
//+------------------------------------------------------------------+
//| Checks whether the active position has crossed virtual exits.    |
//+------------------------------------------------------------------+
void CheckVirtualExits()
  {
//--- validate active runtime trade state
   if(!g_hasTradeState)
      return;
//--- allow checks only during recovery or normal runtime
   if(g_eaState != EA_STATE_RUNNING && g_eaState != EA_STATE_RECOVERING)
      return;
//--- validate broker position existence
   if(!PositionSelectByTicket(g_tradeState.ticket))
     {
      //--- broker position unavailable
      PrintFormat("Virtual exit check skipped. Position not found. Ticket: %I64u",
                  g_tradeState.ticket);
      g_hasTradeState = false;
      return;
     }
//--- retrieve current market prices
   double bid = SymbolInfoDouble(g_tradeState.symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(g_tradeState.symbol, SYMBOL_ASK);
//--- validate BUY virtual exits
   if(g_tradeState.direction == POSITION_TYPE_BUY)
     {
      if(bid <= g_tradeState.virtualSL)
        {
         CloseManagedPosition("Recovered virtual stop loss crossed");
         return;
        }
      if(bid >= g_tradeState.virtualTP)
        {
         CloseManagedPosition("Recovered virtual take profit crossed");
         return;
        }
     }
//--- validate SELL virtual exits
   if(g_tradeState.direction == POSITION_TYPE_SELL)
     {
      if(ask >= g_tradeState.virtualSL)
        {
         CloseManagedPosition("Recovered virtual stop loss crossed");
         return;
        }
      if(ask <= g_tradeState.virtualTP)
        {
         CloseManagedPosition("Recovered virtual take profit crossed");
         return;
        }
     }
  }
//+------------------------------------------------------------------+
//| Manages the active trade using the saved virtual protection state.|
//+------------------------------------------------------------------+
void ManageActiveTrade()
  {
//--- allow management only during normal runtime
   if(g_eaState != EA_STATE_RUNNING)
      return;
//--- validate active runtime trade state
   if(!g_hasTradeState)
      return;
//--- validate broker position existence
   if(!PositionSelectByTicket(g_tradeState.ticket))
     {
      //--- broker position no longer exists
      PrintFormat("Managed position no longer exists. Ticket: %I64u",
                  g_tradeState.ticket);
      MarkTradeClosed(g_tradeState.ticket);
      g_hasTradeState = false;
      return;
     }
//--- check virtual stop-loss and take-profit levels
   CheckVirtualExits();
//--- stop if virtual exit closed the position
   if(!g_hasTradeState)
      return;
//--- update latest runtime modification time
   g_tradeState.lastUpdateTime = TimeCurrent();
//--- save latest active trade state
   SaveTradeState(g_tradeState);
  }
//+------------------------------------------------------------------+
