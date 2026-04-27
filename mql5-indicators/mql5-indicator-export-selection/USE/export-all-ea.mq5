//+------------------------------------------------------------------+
//|                                              export-all-ea.mq5   |
//|                        Export All Indicators EA                    |
//|                                                                    |
//| Expert Advisor that triggers export on all attached indicators    |
//| by broadcasting a custom chart event. Each indicator must listen  |
//| for CHARTEVENT_CUSTOM + 1000 with sparam == "EXPORT_ALL".        |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "1.00"
#property description "Click 'Export All' to trigger data export from all attached indicators simultaneously."

//--- Custom event ID shared with indicators
#define EA_EXPORT_ALL_EVENT_ID  (CHARTEVENT_CUSTOM + 1000)

//--- Button constants
#define EXPORT_ALL_BUTTON       "EA_ExportAllButton"
#define STATUS_LABEL            "EA_ExportStatusLabel"

//--- Input parameters
input int    InpButtonXDistance = 20;     // Button X distance (from right)
input int    InpButtonYDistance = 30;     // Button Y distance (from bottom)
input int    InpButtonWidth    = 180;    // Button width
input int    InpButtonHeight   = 45;     // Button height
input color  InpButtonColor    = C'220,60,60';  // Button background color
input color  InpButtonTextClr  = clrWhite;      // Button text color
input int    InpStatusDuration = 5;      // Status message duration (seconds)

//--- Global variables
datetime g_statusExpiry = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   CreateExportAllButton();
   CreateStatusLabel();

   EventSetMillisecondTimer(500);

   Print("Export All EA initialized. Click 'Export All' to export data from all attached indicators.");

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectDelete(0, EXPORT_ALL_BUTTON);
   ObjectDelete(0, STATUS_LABEL);
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   // Ensure button exists (may be removed by chart operations)
   if(ObjectFind(0, EXPORT_ALL_BUTTON) < 0)
      CreateExportAllButton();
}

//+------------------------------------------------------------------+
//| Timer function - clears status message after duration             |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(g_statusExpiry > 0 && TimeCurrent() >= g_statusExpiry)
   {
      ObjectSetString(0, STATUS_LABEL, OBJPROP_TEXT, "");
      g_statusExpiry = 0;
      ChartRedraw(0);
   }
}

//+------------------------------------------------------------------+
//| Chart event handler                                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == EXPORT_ALL_BUTTON)
      {
         Print("--- EXPORT ALL: Broadcasting export event to all indicators ---");

         // Show status
         SetStatus("Exporting all indicators...", clrYellow);

         // Broadcast custom event to all indicators on this chart
         EventChartCustom(0, EA_EXPORT_ALL_EVENT_ID - CHARTEVENT_CUSTOM, 0, 0, "EXPORT_ALL");

         // Update status after broadcast
         SetStatus("Export All triggered! Check Experts log.", C'0,200,80');

         Print("--- EXPORT ALL: Broadcast complete ---");

         // Reset button state
         ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_STATE, false);
         ChartRedraw(0);
      }
   }
}

//+------------------------------------------------------------------+
//| Create the Export All button                                      |
//+------------------------------------------------------------------+
void CreateExportAllButton()
{
   ObjectDelete(0, EXPORT_ALL_BUTTON);

   if(!ObjectCreate(0, EXPORT_ALL_BUTTON, OBJ_BUTTON, 0, 0, 0))
   {
      Print("ERROR: Failed to create Export All button");
      return;
   }

   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_XDISTANCE, InpButtonXDistance);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_YDISTANCE, InpButtonYDistance);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_XSIZE, InpButtonWidth);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_YSIZE, InpButtonHeight);
   ObjectSetString(0, EXPORT_ALL_BUTTON, OBJPROP_TEXT, "Export All");
   ObjectSetString(0, EXPORT_ALL_BUTTON, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_FONTSIZE, 12);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_COLOR, InpButtonTextClr);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_BGCOLOR, InpButtonColor);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_BORDER_COLOR, C'180,40,40');
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_STATE, false);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_ZORDER, 1000);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, EXPORT_ALL_BUTTON, OBJPROP_BACK, false);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Create status label below button                                  |
//+------------------------------------------------------------------+
void CreateStatusLabel()
{
   ObjectDelete(0, STATUS_LABEL);

   if(!ObjectCreate(0, STATUS_LABEL, OBJ_LABEL, 0, 0, 0))
      return;

   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_XDISTANCE, InpButtonXDistance);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_YDISTANCE, InpButtonYDistance + InpButtonHeight + 5);
   ObjectSetString(0, STATUS_LABEL, OBJPROP_TEXT, "");
   ObjectSetString(0, STATUS_LABEL, OBJPROP_FONT, "Arial");
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_HIDDEN, true);
}

//+------------------------------------------------------------------+
//| Set status message with auto-clear                                |
//+------------------------------------------------------------------+
void SetStatus(string text, color clr)
{
   ObjectSetString(0, STATUS_LABEL, OBJPROP_TEXT, text);
   ObjectSetInteger(0, STATUS_LABEL, OBJPROP_COLOR, clr);
   g_statusExpiry = TimeCurrent() + InpStatusDuration;
   ChartRedraw(0);
}
//+------------------------------------------------------------------+
