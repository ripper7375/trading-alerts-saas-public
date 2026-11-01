//+------------------------------------------------------------------+
//|                                    Objects Copier_Batch_V1.mq5   |
//|               Copies drawing objects from M15 & M5 sources to    |
//|               destination charts (E, F, or both)                 |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property link      ""
#property version   "1.01"
#property script_show_inputs

//--- 1. Chart IDs Input Group
input group "=== 1. Chart IDs (Set 0 to auto-list all open charts) ==="
input long ChartA_M15_Source_ID     = 0; // [A] M15 source ID
input long ChartB_M5_Source_ID      = 0; // [B] M5 source ID
input long ChartE_M15_Entry_ID      = 0; // [E] M15 destination-entry ID (0 = skip)
input long ChartF_M15_Close_ID      = 0; // [F] M15 destination-close ID (0 = skip)

//--- 2. Synchronization Settings
input group "=== 2. Synchronization Settings ==="
input bool CleanDestinationsFirst   = true;      // Clear objects on destination before copying?
input bool AddSourcePrefix          = true;      // Add Prefix to avoid object name conflicts?
input string Prefix_ChartA          = "A_";      // Prefix for M15 source objects
input string Prefix_ChartB          = "B_";      // Prefix for M5 source objects
input bool EnsureVisibleAllPeriods  = true;      // Ensure copied objects visible on all periods
input bool LabelChartRolesOnScreen  = true;      // Display role labels ([A], [B], [E], [F]) on chart screens

//--- 3. Object Filter Options
input group "=== 3. Object Filter Options ==="
input bool OnlyCopyUserDrawings     = true;      // Only copy user drawings (skip indicator-drawn lines)
input bool MakeSelectableOnDest     = true;      // Make all copied objects selectable (clickable & deletable)
input string IgnoreNameContains     = "";        // Ignore objects whose name contains this text (optional)
input bool CopyChannels             = true;      // Copy Equidistant Channels
input bool CopyRectangles           = true;      // Copy Rectangles
input bool CopyFibonacci            = true;      // Copy Fibonacci Tools
input bool CopyOtherObjects         = true;      // Copy Other Drawing Objects

//+------------------------------------------------------------------+
//| Script program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
   // Check validity of each specified Chart ID
   bool isValidA = IsChartValid(ChartA_M15_Source_ID);
   bool isValidB = IsChartValid(ChartB_M5_Source_ID);
   bool isValidE = IsChartValid(ChartE_M15_Entry_ID);
   bool isValidF = IsChartValid(ChartF_M15_Close_ID);

   // Check if any explicitly entered ID is invalid (>0 but not an open chart)
   bool hasInvalidChart = false;
   if(ChartA_M15_Source_ID > 0 && !isValidA) { Print(">>> Error: Source Chart [A] ID (", ChartA_M15_Source_ID, ") is invalid or chart is closed."); hasInvalidChart = true; }
   if(ChartB_M5_Source_ID > 0 && !isValidB)  { Print(">>> Error: Source Chart [B] ID (", ChartB_M5_Source_ID, ") is invalid or chart is closed."); hasInvalidChart = true; }
   if(ChartE_M15_Entry_ID > 0 && !isValidE)  { Print(">>> Error: Destination Chart [E] ID (", ChartE_M15_Entry_ID, ") is invalid or chart is closed."); hasInvalidChart = true; }
   if(ChartF_M15_Close_ID > 0 && !isValidF)  { Print(">>> Error: Destination Chart [F] ID (", ChartF_M15_Close_ID, ") is invalid or chart is closed."); hasInvalidChart = true; }

   bool hasSource      = (isValidA || isValidB);
   bool hasDestination = (isValidE || isValidF);

   // If all IDs are 0, this is the auto-discovery mode
   bool isAutoDiscoverMode = (ChartA_M15_Source_ID == 0 && ChartB_M5_Source_ID == 0 && 
                              ChartE_M15_Entry_ID == 0 && ChartF_M15_Close_ID == 0);

   if(isAutoDiscoverMode || hasInvalidChart || !hasSource || !hasDestination)
   {
      Print("====================================================================");
      if(isAutoDiscoverMode)
      {
         Print(">>> [Objects Copier Batch] Chart ID Auto-Discovery Mode <<<");
      }
      else
      {
         Print(">>> [Objects Copier Batch] MISSING OR INVALID CHART IDs! <<<");
         if(!hasSource)
            Print("- At least one Source chart ([A] or [B]) must be specified and valid.");
         if(!hasDestination)
            Print("- At least one Destination chart ([E] or [F]) must be specified and valid.");
      }
      Print("Displaying Chart IDs directly on each chart screen and in log below:");
      Print("--------------------------------------------------------------------");
      PrintAndTagOpenCharts();
      Print("====================================================================");

      string alertMsg;
      if(isAutoDiscoverMode)
      {
         alertMsg = "Chart IDs Auto-Discovery:\nLook at the top-left corner of each chart on your screen to see its Chart ID,\nor check the 'Experts' tab in Toolbox.";
      }
      else
      {
         alertMsg = "Chart IDs incomplete or invalid!\n";
         if(!hasSource)      alertMsg += "- At least one Source ([A] or [B]) required.\n";
         if(!hasDestination) alertMsg += "- At least one Destination ([E] or [F]) required.\n";
         if(hasInvalidChart) alertMsg += "- One or more entered Chart IDs could not be found.\n";
         alertMsg += "Check chart top-left corners or 'Experts' tab for IDs.";
      }
      Alert(alertMsg);
      return;
   }

   // Label assigned roles on screen if enabled
   if(LabelChartRolesOnScreen)
   {
      if(isValidA) TagChartRole(ChartA_M15_Source_ID, "[A] M15 source");
      if(isValidB) TagChartRole(ChartB_M5_Source_ID,  "[B] M5 source");
      if(isValidE) TagChartRole(ChartE_M15_Entry_ID,  "[E] M15 destination-entry");
      if(isValidF) TagChartRole(ChartF_M15_Close_ID,  "[F] M15 destination-close");
   }

   Print("====================================================================");
   Print("[Objects Copier Batch] Starting batch synchronization...");
   if(isValidA) Print("Source A (M15 source)           : ID ", ChartA_M15_Source_ID, " (", ChartSymbol(ChartA_M15_Source_ID), " ", EnumToString(ChartPeriod(ChartA_M15_Source_ID)), ")");
   if(isValidB) Print("Source B (M5 source)            : ID ", ChartB_M5_Source_ID, " (", ChartSymbol(ChartB_M5_Source_ID), " ", EnumToString(ChartPeriod(ChartB_M5_Source_ID)), ")");
   if(isValidE) Print("Dest E   (M15 destination-entry): ID ", ChartE_M15_Entry_ID, " (", ChartSymbol(ChartE_M15_Entry_ID), " ", EnumToString(ChartPeriod(ChartE_M15_Entry_ID)), ")");
   if(isValidF) Print("Dest F   (M15 destination-close): ID ", ChartF_M15_Close_ID, " (", ChartSymbol(ChartF_M15_Close_ID), " ", EnumToString(ChartPeriod(ChartF_M15_Close_ID)), ")");

   // Step 1: Clean Destination Charts if requested
   if(CleanDestinationsFirst)
   {
      if(isValidE)
      {
         int delE = DeleteAllDrawingObjects(ChartE_M15_Entry_ID);
         Print("Cleared existing objects -> Chart E (Entry): ", delE, " objects");
      }
      if(isValidF)
      {
         int delF = DeleteAllDrawingObjects(ChartF_M15_Close_ID);
         Print("Cleared existing objects -> Chart F (Close): ", delF, " objects");
      }
   }

   string prefixA = AddSourcePrefix ? Prefix_ChartA : "";
   string prefixB = AddSourcePrefix ? Prefix_ChartB : "";

   // Step 2: Copy to Chart E (M15 destination-entry) if valid
   if(isValidE)
   {
      int copiedA_to_E = isValidA ? CopyDrawingObjects(ChartA_M15_Source_ID, ChartE_M15_Entry_ID, prefixA) : 0;
      int copiedB_to_E = isValidB ? CopyDrawingObjects(ChartB_M5_Source_ID, ChartE_M15_Entry_ID, prefixB) : 0;
      ChartRedraw(ChartE_M15_Entry_ID);
      Print(">> Synced to Chart E (Entry): ", copiedA_to_E, " from [A] + ", copiedB_to_E, " from [B] = Total ", (copiedA_to_E + copiedB_to_E));
   }

   // Step 3: Copy to Chart F (M15 destination-close) if valid
   if(isValidF)
   {
      int copiedA_to_F = isValidA ? CopyDrawingObjects(ChartA_M15_Source_ID, ChartF_M15_Close_ID, prefixA) : 0;
      int copiedB_to_F = isValidB ? CopyDrawingObjects(ChartB_M5_Source_ID, ChartF_M15_Close_ID, prefixB) : 0;
      ChartRedraw(ChartF_M15_Close_ID);
      Print(">> Synced to Chart F (Close): ", copiedA_to_F, " from [A] + ", copiedB_to_F, " from [B] = Total ", (copiedA_to_F + copiedB_to_F));
   }

   Print("[Objects Copier Batch] Sync completed successfully!");
   Print("====================================================================");
}

//+------------------------------------------------------------------+
//| Check if a chart ID is currently valid                           |
//+------------------------------------------------------------------+
bool IsChartValid(long chartId)
{
   if(chartId <= 0)
      return false;
      
   string sym = ChartSymbol(chartId);
   return (sym != "" && sym != NULL);
}

//+------------------------------------------------------------------+
//| Print open charts and show their IDs directly on chart screens   |
//+------------------------------------------------------------------+
void PrintAndTagOpenCharts()
{
   long chart = ChartFirst();
   int count = 0;
   
   while(chart >= 0)
   {
      count++;
      string sym = ChartSymbol(chart);
      string tf  = EnumToString(ChartPeriod(chart));
      
      // 1. Print to Experts log
      Print(StringFormat("#%d | Chart ID: %I64d | Symbol: %-10s | Timeframe: %s", 
            count, chart, sym, tf));
            
      // 2. Put visual text comment on the top-left of each chart screen
      string commentText = StringFormat(">>> Chart ID: %I64d <<<\nSymbol: %s | TF: %s\n(Check Script Inputs to assign this Chart ID)", 
                                        chart, sym, tf);
      ChartSetString(chart, CHART_COMMENT, commentText);
      ChartRedraw(chart);
      
      chart = ChartNext(chart);
   }
   
   if(count == 0)
   {
      Print("No open charts found.");
   }
}

//+------------------------------------------------------------------+
//| Tag a chart screen with its assigned role name                   |
//+------------------------------------------------------------------+
void TagChartRole(long chart, string roleName)
{
   if(chart <= 0) return;
   string currentComment = StringFormat("=== %s ===\nChart ID: %I64d | %s %s", 
                                        roleName, chart, ChartSymbol(chart), EnumToString(ChartPeriod(chart)));
   ChartSetString(chart, CHART_COMMENT, currentComment);
   ChartRedraw(chart);
}

//+------------------------------------------------------------------+
//| Delete all matching drawing objects from a chart                 |
//+------------------------------------------------------------------+
int DeleteAllDrawingObjects(long chart)
{
   if(chart <= 0)
      return 0;

   int deleted = 0;
   int total = ObjectsTotal(chart);
   
   for(int i = total - 1; i >= 0; i--)
   {
      string objName = ObjectName(chart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(chart, objName, OBJPROP_TYPE);
      
      if(IsAllowedObjectType(objType))
      {
         if(ObjectDelete(chart, objName))
            deleted++;
      }
   }
   
   return deleted;
}

//+------------------------------------------------------------------+
//| Check if object type is allowed by user settings                 |
//+------------------------------------------------------------------+
bool IsAllowedObjectType(ENUM_OBJECT objType)
{
   // Always copy standard lines
   if(objType == OBJ_TREND || objType == OBJ_HLINE || objType == OBJ_VLINE)
      return true;
   
   // Channels
   if(CopyChannels && objType == OBJ_CHANNEL)
      return true;
   
   // Rectangles
   if(CopyRectangles && objType == OBJ_RECTANGLE)
      return true;
   
   // Fibonacci tools
   if(CopyFibonacci && (objType == OBJ_FIBO || objType == OBJ_FIBOTIMES || 
                        objType == OBJ_FIBOARC || objType == OBJ_FIBOFAN || 
                        objType == OBJ_FIBOCHANNEL || objType == OBJ_EXPANSION))
      return true;
   
   // Other drawing objects
   if(CopyOtherObjects && (objType == OBJ_TRIANGLE || objType == OBJ_ELLIPSE || 
                           objType == OBJ_ARROWED_LINE || objType == OBJ_CYCLES ||
                           objType == OBJ_GANNLINE || objType == OBJ_GANNFAN || 
                           objType == OBJ_GANNGRID || objType == OBJ_PITCHFORK ||
                           objType == OBJ_STDDEVCHANNEL || objType == OBJ_REGRESSION))
      return true;
   
   return false;
}

//+------------------------------------------------------------------+
//| Filter which objects should be copied from source                |
//+------------------------------------------------------------------+
bool ShouldCopyObject(long chart, string objName)
{
   ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(chart, objName, OBJPROP_TYPE);
   
   // 1. Check object type
   if(!IsAllowedObjectType(objType))
      return false;
      
   // 2. Check if name contains ignore keyword
   if(IgnoreNameContains != "" && StringFind(objName, IgnoreNameContains) >= 0)
   {
      Print("-> Skipped object (Matches Ignore Keyword): ", objName);
      return false;
   }
      
   // 3. Filter out indicator objects if OnlyCopyUserDrawings is enabled
   if(OnlyCopyUserDrawings)
   {
      bool isSelectable = (bool)ObjectGetInteger(chart, objName, OBJPROP_SELECTABLE);
      if(!isSelectable)
      {
         Print("-> Skipped indicator object (Unselectable): ", objName, " [Type: ", EnumToString(objType), "]");
         return false; // Skip indicator objects that are locked / unselectable
      }
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Copy drawing objects from source to destination chart            |
//+------------------------------------------------------------------+
int CopyDrawingObjects(long srcChart, long dstChart, string prefix)
{
   if(srcChart <= 0 || dstChart <= 0)
      return 0;

   int total = ObjectsTotal(srcChart);
   int copied = 0;
   
   for(int i = 0; i < total; i++)
   {
      string srcName = ObjectName(srcChart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(srcChart, srcName, OBJPROP_TYPE);
      
      if(ShouldCopyObject(srcChart, srcName))
      {
         string dstName = (prefix != "") ? (prefix + srcName) : srcName;
         
         // Delete target object first if it already exists
         ObjectDelete(dstChart, dstName);
         
         if(ObjectCreate(dstChart, dstName, objType, 0, 0, 0))
         {
            CopyObjectProperties(srcChart, srcName, dstChart, dstName, objType);
            copied++;
         }
      }
   }
   
   return copied;
}

//+------------------------------------------------------------------+
//| Copy all properties and anchor points of an object               |
//+------------------------------------------------------------------+
void CopyObjectProperties(long srcChart, string srcName, long dstChart, string dstName, ENUM_OBJECT objType)
{
   // Copy appearance properties
   ObjectSetInteger(dstChart, dstName, OBJPROP_COLOR, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_COLOR));
   ObjectSetInteger(dstChart, dstName, OBJPROP_STYLE, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_STYLE));
   ObjectSetInteger(dstChart, dstName, OBJPROP_WIDTH, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_WIDTH));
   ObjectSetInteger(dstChart, dstName, OBJPROP_BACK, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_BACK));
                   
   // Selectable & Hidden properties
   if(MakeSelectableOnDest)
   {
      // Force selectable so the user can easily click, move, and press Delete on chart
      ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTED, false);
      ObjectSetInteger(dstChart, dstName, OBJPROP_HIDDEN, false);
   }
   else
   {
      ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTABLE,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_SELECTABLE));
      ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTED,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_SELECTED));
      ObjectSetInteger(dstChart, dstName, OBJPROP_HIDDEN,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_HIDDEN));
   }
   
   // Visibility on timeframes
   if(EnsureVisibleAllPeriods)
   {
      ObjectSetInteger(dstChart, dstName, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   }
   else
   {
      ObjectSetInteger(dstChart, dstName, OBJPROP_TIMEFRAMES,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_TIMEFRAMES));
   }
   
   // Copy ray properties (for trend lines and channels)
   if(objType == OBJ_TREND || objType == OBJ_CHANNEL)
   {
      ObjectSetInteger(dstChart, dstName, OBJPROP_RAY_RIGHT, 
                      ObjectGetInteger(srcChart, srcName, OBJPROP_RAY_RIGHT));
      ObjectSetInteger(dstChart, dstName, OBJPROP_RAY_LEFT,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_RAY_LEFT));
   }
   
   // Copy fill property (for rectangles, triangles, ellipses, channels)
   if(objType == OBJ_RECTANGLE || objType == OBJ_TRIANGLE || 
      objType == OBJ_ELLIPSE || objType == OBJ_CHANNEL)
   {
      ObjectSetInteger(dstChart, dstName, OBJPROP_FILL,
                      ObjectGetInteger(srcChart, srcName, OBJPROP_FILL));
   }
   
   // Copy Fibonacci levels
   if(objType == OBJ_FIBO || objType == OBJ_FIBOTIMES || objType == OBJ_FIBOARC || 
      objType == OBJ_FIBOFAN || objType == OBJ_FIBOCHANNEL || objType == OBJ_EXPANSION)
   {
      int levels = (int)ObjectGetInteger(srcChart, srcName, OBJPROP_LEVELS);
      ObjectSetInteger(dstChart, dstName, OBJPROP_LEVELS, levels);
      
      for(int j = 0; j < levels; j++)
      {
         double value = ObjectGetDouble(srcChart, srcName, OBJPROP_LEVELVALUE, j);
         string desc = ObjectGetString(srcChart, srcName, OBJPROP_LEVELTEXT, j);
         color clr = (color)ObjectGetInteger(srcChart, srcName, OBJPROP_LEVELCOLOR, j);
         ENUM_LINE_STYLE style = (ENUM_LINE_STYLE)ObjectGetInteger(srcChart, srcName, OBJPROP_LEVELSTYLE, j);
         int width = (int)ObjectGetInteger(srcChart, srcName, OBJPROP_LEVELWIDTH, j);
         
         ObjectSetDouble(dstChart, dstName, OBJPROP_LEVELVALUE, j, value);
         ObjectSetString(dstChart, dstName, OBJPROP_LEVELTEXT, j, desc);
         ObjectSetInteger(dstChart, dstName, OBJPROP_LEVELCOLOR, j, clr);
         ObjectSetInteger(dstChart, dstName, OBJPROP_LEVELSTYLE, j, style);
         ObjectSetInteger(dstChart, dstName, OBJPROP_LEVELWIDTH, j, width);
      }
   }
   
   // Copy coordinates - anchor points
   int anchorPoints = GetAnchorPointsCount(objType);
   for(int j = 0; j < anchorPoints; j++)
   {
      datetime time = (datetime)ObjectGetInteger(srcChart, srcName, OBJPROP_TIME, j);
      double price = ObjectGetDouble(srcChart, srcName, OBJPROP_PRICE, j);
      
      ObjectSetInteger(dstChart, dstName, OBJPROP_TIME, j, time);
      ObjectSetDouble(dstChart, dstName, OBJPROP_PRICE, j, price);
   }
   
   // Copy text description & tooltip
   string desc = ObjectGetString(srcChart, srcName, OBJPROP_TEXT);
   if(desc != "")
      ObjectSetString(dstChart, dstName, OBJPROP_TEXT, desc);
      
   string tooltip = ObjectGetString(srcChart, srcName, OBJPROP_TOOLTIP);
   if(tooltip != "")
      ObjectSetString(dstChart, dstName, OBJPROP_TOOLTIP, tooltip);
}

//+------------------------------------------------------------------+
//| Get required anchor points count by object type                  |
//+------------------------------------------------------------------+
int GetAnchorPointsCount(ENUM_OBJECT objType)
{
   switch(objType)
   {
      case OBJ_VLINE:
      case OBJ_HLINE:
         return 1;
      
      case OBJ_TREND:
      case OBJ_ARROWED_LINE:
      case OBJ_CYCLES:
         return 2;
      
      case OBJ_CHANNEL:
      case OBJ_STDDEVCHANNEL:
      case OBJ_REGRESSION:
      case OBJ_RECTANGLE:
      case OBJ_TRIANGLE:
      case OBJ_ELLIPSE:
      case OBJ_FIBO:
      case OBJ_FIBOTIMES:
      case OBJ_FIBOARC:
      case OBJ_FIBOFAN:
      case OBJ_FIBOCHANNEL:
      case OBJ_EXPANSION:
      case OBJ_GANNLINE:
      case OBJ_GANNFAN:
      case OBJ_GANNGRID:
      case OBJ_PITCHFORK:
         return 3;
      
      default:
         return 2;
   }
}
//+------------------------------------------------------------------+
