//+------------------------------------------------------------------+
//|                                         tradeAnalyticsBridge.mq5 |
//|          Copyright 2026, MetaQuotes Ltd. Developer is Chacha Ian |
//|                          https://www.mql5.com/en/users/chachaian |
//+------------------------------------------------------------------+

#property copyright "Copyright 2026, MetaQuotes Ltd. Developer is Chacha Ian"
#property link      "https://www.mql5.com/en/users/chachaian"
#property version   "1.00"
input string apiEndpointUrl = "http://127.0.0.1:5000/api/v1/trades";
ulong processedDeals[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   return(INIT_SUCCEEDED);
  }
  
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
//--- Notify why the program stopped running
   Print("Program terminated! Reason code: ", reason);
  }
  
//+------------------------------------------------------------------+
//| TradeTransaction function                                        |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
  {
//--- If position closed
   if(IsClosedTradeDeal(trans))
     {
      ulong deal = trans.deal;
      if(IsDealAlreadyProcessed(deal))
         return;
      //--- Mark as processed
      ArrayResize(processedDeals, ArraySize(processedDeals) + 1);
      processedDeals[ArraySize(processedDeals) - 1] = deal;
      ProcessClosedTrade(trans);
     }
  }
  
//+------------------------------------------------------------------+
//| Returns true if this transaction is a closed trade deal          |
//+------------------------------------------------------------------+
bool IsClosedTradeDeal(const MqlTradeTransaction &trans)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
     {
      return false;
     }
   if(trans.deal == 0)
     {
      return false;
     }
   if(!HistoryDealSelect(trans.deal))
     {
      return false;
     }
   long deal_entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   return (deal_entry == DEAL_ENTRY_OUT || deal_entry == DEAL_ENTRY_OUT_BY);
  }
  
//+------------------------------------------------------------------+
//| Convert deal reason to readable text                             |
//+------------------------------------------------------------------+
string DealReasonToString(const ENUM_DEAL_REASON reason)
  {
   switch(reason)
     {
      case DEAL_REASON_CLIENT:
         return "CLIENT";
      case DEAL_REASON_MOBILE:
         return "MOBILE";
      case DEAL_REASON_WEB:
         return "WEB";
      case DEAL_REASON_EXPERT:
         return "EXPERT";
      case DEAL_REASON_SL:
         return "STOP_LOSS";
      case DEAL_REASON_TP:
         return "TAKE_PROFIT";
      case DEAL_REASON_SO:
         return "STOP_OUT";
      case DEAL_REASON_ROLLOVER:
         return "ROLLOVER";
      case DEAL_REASON_VMARGIN:
         return "VMARGIN";
      case DEAL_REASON_SPLIT:
         return "SPLIT";
      default:
         return "UNKNOWN";
     }
  }
  
//+------------------------------------------------------------------+
//| Convert deal type to BUY / SELL                                  |
//+------------------------------------------------------------------+
string DealTypeToPositionType(const ENUM_DEAL_TYPE deal_type)
  {
   switch(deal_type)
     {
      case DEAL_TYPE_BUY:
         return "BUY";
      case DEAL_TYPE_SELL:
         return "SELL";
      default:
         return "UNKNOWN";
     }
  }
  
//+------------------------------------------------------------------+
//| Find the opening deal ticket for a given position                |
//+------------------------------------------------------------------+
ulong FindOpeningDealTicket(const ulong position_ticket)
  {
   if(position_ticket == 0)
     {
      return 0;
     }
   if(!HistorySelectByPosition(position_ticket))
     {
      return 0;
     }
   int total_deals = HistoryDealsTotal();
   for(int i = 0; i < total_deals; i++)
     {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0)
        {
         continue;
        }
      long entry_type = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);

      if(entry_type == DEAL_ENTRY_IN || entry_type == DEAL_ENTRY_INOUT)
        {
         return deal_ticket;
        }
     }
   return 0;
  }
  
//+------------------------------------------------------------------+
//| Build JSON string from trade data                                |
//+------------------------------------------------------------------+
string BuildTradeJson(
   string symbol,
   long order_ticket,
   long deal_ticket,
   long position_ticket,
   string position_type,
   string position_reason,
   double lot_size,
   double entry_price,
   double stop_loss,
   double take_profit,
   double profit,
   datetime open_time,
   datetime close_time,
   long magic_number
)
  {
   string json = "{";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"order_ticket\":" + IntegerToString(order_ticket) + ",";
   json += "\"deal_ticket\":" + IntegerToString(deal_ticket) + ",";
   json += "\"position_ticket\":" + IntegerToString(position_ticket) + ",";
   json += "\"position_type\":\"" + position_type + "\",";
   json += "\"position_reason\":\"" + position_reason + "\",";
   json += "\"lot_size\":" + DoubleToString(lot_size, 2) + ",";
   json += "\"entry_price\":" + DoubleToString(entry_price, _Digits) + ",";
   json += "\"stop_loss\":" + DoubleToString(stop_loss, _Digits) + ",";
   json += "\"take_profit\":" + DoubleToString(take_profit, _Digits) + ",";
   json += "\"profit\":" + DoubleToString(profit, 2) + ",";
   json += "\"open_time\":\"" + TimeToString(open_time, TIME_DATE | TIME_SECONDS) + "\",";
   json += "\"close_time\":\"" + TimeToString(close_time, TIME_DATE | TIME_SECONDS) + "\",";
   json += "\"magic_number\":" + IntegerToString(magic_number);

   json += "}";

   return json;
  }
  
//+------------------------------------------------------------------+
//| Send JSON trade data to backend                                  |
//+------------------------------------------------------------------+
bool SendTradeToServer(const string json_payload)
  {
   string url = apiEndpointUrl;
   string headers = "Content-Type: application/json\r\n";

   char data[];
   StringToCharArray(json_payload, data, 0, StringLen(json_payload));

   char result[];
   string result_headers;

   ResetLastError();

   int response = WebRequest(
                     "POST",
                     url,
                     headers,
                     5000,
                     data,
                     result,
                     result_headers
                  );

   if(response == -1)
     {
      Print("WebRequest failed. Error: ", GetLastError());
      return false;
     }

   Print("Server response code: ", response);
   Print("Server response body: ", CharArrayToString(result));

   return (response == 200 || response == 201);
  }
  
//+------------------------------------------------------------------+
//| Extract, build JSON and send trade                               |
//+------------------------------------------------------------------+
void ProcessClosedTrade(const MqlTradeTransaction &trans)
  {
   ulong close_deal_ticket = trans.deal;

   if(close_deal_ticket == 0)
      return;
   if(!HistoryDealSelect(close_deal_ticket))
      return;
// --- close-side
   string   symbol          = HistoryDealGetString(close_deal_ticket, DEAL_SYMBOL);
   long     order_ticket    = HistoryDealGetInteger(close_deal_ticket, DEAL_ORDER);
   long     deal_ticket     = (long)close_deal_ticket;
   long     position_ticket = HistoryDealGetInteger(close_deal_ticket, DEAL_POSITION_ID);
   long     deal_type       = HistoryDealGetInteger(close_deal_ticket, DEAL_TYPE);
   long     deal_reason     = HistoryDealGetInteger(close_deal_ticket, DEAL_REASON);
   double   lot_size        = HistoryDealGetDouble(close_deal_ticket, DEAL_VOLUME);
   double   close_price     = HistoryDealGetDouble(close_deal_ticket, DEAL_PRICE);
   double   stop_loss       = HistoryDealGetDouble(close_deal_ticket, DEAL_SL);
   double   take_profit     = HistoryDealGetDouble(close_deal_ticket, DEAL_TP);
   double   profit          = HistoryDealGetDouble(close_deal_ticket, DEAL_PROFIT);
   long     magic_number    = HistoryDealGetInteger(close_deal_ticket, DEAL_MAGIC);
   datetime close_time      = (datetime)HistoryDealGetInteger(close_deal_ticket, DEAL_TIME);

// --- opening side
   ulong open_deal_ticket = FindOpeningDealTicket((ulong)position_ticket);
   double entry_price = 0.0;
   datetime open_time = 0;
   if(open_deal_ticket != 0 && HistoryDealSelect(open_deal_ticket))
     {
      entry_price = HistoryDealGetDouble(open_deal_ticket, DEAL_PRICE);
      open_time   = (datetime)HistoryDealGetInteger(open_deal_ticket, DEAL_TIME);
     }
// --- enums
   string position_type   = DealTypeToPositionType((ENUM_DEAL_TYPE)deal_type);
   string position_reason = DealReasonToString((ENUM_DEAL_REASON)deal_reason);
// --- build JSON
   string json = BuildTradeJson(
                    symbol,
                    order_ticket,
                    deal_ticket,
                    position_ticket,
                    position_type,
                    position_reason,
                    lot_size,
                    entry_price,
                    stop_loss,
                    take_profit,
                    profit,
                    open_time,
                    close_time,
                    magic_number
                 );

   Print("JSON Payload: ", json);
// --- send
   SendTradeToServer(json);
  }
  
//+------------------------------------------------------------------+
//| Checks whether the specified deal ticket has already             |     
//| been processed                                                   |
//+------------------------------------------------------------------+
bool IsDealAlreadyProcessed(ulong deal)
  {
   for(int i = 0; i < ArraySize(processedDeals); i++)
     {
      if(processedDeals[i] == deal)
         return true;
     }
   return false;
  }
  
//+------------------------------------------------------------------+