//+------------------------------------------------------------------+
//|                                    CopyLinesWithSync.mq5         |
//+------------------------------------------------------------------+
#property script_show_inputs

input bool CleanDestinationFirst = true; // Clear all objects on destination first?
input long TargetChartID = 0; // Target Chart ID (0 = auto find)

void OnStart()
{
   long sourceChart = ChartID();
   long targetChart = TargetChartID;
   
   // Auto-find target chart if needed
   if(targetChart == 0)
   {
      // Search ALL charts to find another matching one
      targetChart = FindOtherMatchingChart(sourceChart, Symbol(), Period());
   }
   
   if(targetChart < 0)
   {
      Print("ERROR: No other ", Symbol(), " ", EnumToString(Period()), " chart found!");
      Print("Please open another ", Symbol(), " ", EnumToString(Period()), " chart or specify Chart ID manually");
      return;
   }
   
   Print("Syncing from Chart ID: ", sourceChart, " to Chart ID: ", targetChart);
   
   // Clean destination if requested
   if(CleanDestinationFirst)
   {
      int deleted = DeleteAllLineObjects(targetChart);
      Print("Cleared ", deleted, " existing line objects from destination");
   }
   
   // Copy all line objects
   int copied = CopyLineObjects(sourceChart, targetChart);
   
   ChartRedraw(targetChart);
   Print("Successfully copied ", copied, " line objects!");
   Print("Sync complete!");
}

// Find any other chart that matches symbol and period (excluding source chart)
long FindOtherMatchingChart(long excludeChart, string symbol, ENUM_TIMEFRAMES period)
{
   long chart = ChartFirst();
   
   while(chart >= 0)
   {
      // Skip the source chart itself
      if(chart != excludeChart && 
         ChartSymbol(chart) == symbol && 
         ChartPeriod(chart) == period)
      {
         return chart; // Found it!
      }
      
      chart = ChartNext(chart);
   }
   
   return -1; // Not found
}

int DeleteAllLineObjects(long chart)
{
   int deleted = 0;
   int total = ObjectsTotal(chart);
   
   // Loop backwards to avoid index issues when deleting
   for(int i = total - 1; i >= 0; i--)
   {
      string objName = ObjectName(chart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(chart, objName, OBJPROP_TYPE);
      
      if(objType == OBJ_TREND || objType == OBJ_HLINE || 
         objType == OBJ_VLINE)
      {
         if(ObjectDelete(chart, objName))
            deleted++;
      }
   }
   
   return deleted;
}

int CopyLineObjects(long srcChart, long dstChart)
{
   int total = ObjectsTotal(srcChart);
   int copied = 0;
   
   for(int i = 0; i < total; i++)
   {
      string objName = ObjectName(srcChart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(srcChart, objName, OBJPROP_TYPE);
      
      if(objType == OBJ_TREND || objType == OBJ_HLINE || 
         objType == OBJ_VLINE)
      {
         // Use same name for true sync
         string newName = objName;
         ObjectDelete(dstChart, newName);
         
         if(ObjectCreate(dstChart, newName, objType, 0, 0, 0))
         {
            // Copy all properties
            ObjectSetInteger(dstChart, newName, OBJPROP_COLOR, 
                           ObjectGetInteger(srcChart, objName, OBJPROP_COLOR));
            ObjectSetInteger(dstChart, newName, OBJPROP_STYLE, 
                           ObjectGetInteger(srcChart, objName, OBJPROP_STYLE));
            ObjectSetInteger(dstChart, newName, OBJPROP_WIDTH, 
                           ObjectGetInteger(srcChart, objName, OBJPROP_WIDTH));
            ObjectSetInteger(dstChart, newName, OBJPROP_BACK, 
                           ObjectGetInteger(srcChart, objName, OBJPROP_BACK));
            ObjectSetInteger(dstChart, newName, OBJPROP_SELECTABLE,
                           ObjectGetInteger(srcChart, objName, OBJPROP_SELECTABLE));
            ObjectSetInteger(dstChart, newName, OBJPROP_SELECTED,
                           ObjectGetInteger(srcChart, objName, OBJPROP_SELECTED));
            ObjectSetInteger(dstChart, newName, OBJPROP_RAY_RIGHT, 
                           ObjectGetInteger(srcChart, objName, OBJPROP_RAY_RIGHT));
            ObjectSetInteger(dstChart, newName, OBJPROP_RAY_LEFT,
                           ObjectGetInteger(srcChart, objName, OBJPROP_RAY_LEFT));
            
            // Copy coordinates
            datetime time1 = (datetime)ObjectGetInteger(srcChart, objName, OBJPROP_TIME, 0);
            double price1 = ObjectGetDouble(srcChart, objName, OBJPROP_PRICE, 0);
            datetime time2 = (datetime)ObjectGetInteger(srcChart, objName, OBJPROP_TIME, 1);
            double price2 = ObjectGetDouble(srcChart, objName, OBJPROP_PRICE, 1);
            
            ObjectSetInteger(dstChart, newName, OBJPROP_TIME, 0, time1);
            ObjectSetDouble(dstChart, newName, OBJPROP_PRICE, 0, price1);
            ObjectSetInteger(dstChart, newName, OBJPROP_TIME, 1, time2);
            ObjectSetDouble(dstChart, newName, OBJPROP_PRICE, 1, price2);
            
            // Copy text/description
            string desc = ObjectGetString(srcChart, objName, OBJPROP_TEXT);
            if(desc != "")
               ObjectSetString(dstChart, newName, OBJPROP_TEXT, desc);
            
            copied++;
         }
      }
   }
   
   return copied;
}