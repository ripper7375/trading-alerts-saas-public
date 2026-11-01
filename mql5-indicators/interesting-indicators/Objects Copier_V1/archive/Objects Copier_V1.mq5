//+------------------------------------------------------------------+
//|                                    CopyLinesWithSync.mq5         |
//+------------------------------------------------------------------+
#property script_show_inputs

input bool CleanDestinationFirst = true; // Clear all objects on destination first?
input long TargetChartID = 0; // Target Chart ID (0 = auto find)
input bool CopyChannels = true; // Copy Equidistant Channels
input bool CopyRectangles = true; // Copy Rectangles
input bool CopyFibonacci = true; // Copy Fibonacci Tools
input bool CopyOtherObjects = true; // Copy Other Drawing Objects

void OnStart()
{
   long sourceChart = ChartID();
   long targetChart = TargetChartID;
   
   // Auto-find target chart if needed
   if(targetChart == 0)
   {
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
      int deleted = DeleteAllDrawingObjects(targetChart);
      Print("Cleared ", deleted, " existing drawing objects from destination");
   }
   
   // Copy all drawing objects
   int copied = CopyDrawingObjects(sourceChart, targetChart);
   
   ChartRedraw(targetChart);
   Print("Successfully copied ", copied, " drawing objects!");
   Print("Sync complete!");
}

long FindOtherMatchingChart(long excludeChart, string symbol, ENUM_TIMEFRAMES period)
{
   long chart = ChartFirst();
   
   while(chart >= 0)
   {
      if(chart != excludeChart && 
         ChartSymbol(chart) == symbol && 
         ChartPeriod(chart) == period)
      {
         return chart;
      }
      
      chart = ChartNext(chart);
   }
   
   return -1;
}

int DeleteAllDrawingObjects(long chart)
{
   int deleted = 0;
   int total = ObjectsTotal(chart);
   
   for(int i = total - 1; i >= 0; i--)
   {
      string objName = ObjectName(chart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(chart, objName, OBJPROP_TYPE);
      
      if(ShouldCopyObjectType(objType))
      {
         if(ObjectDelete(chart, objName))
            deleted++;
      }
   }
   
   return deleted;
}

bool ShouldCopyObjectType(ENUM_OBJECT objType)
{
   // Always copy lines
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

int CopyDrawingObjects(long srcChart, long dstChart)
{
   int total = ObjectsTotal(srcChart);
   int copied = 0;
   
   for(int i = 0; i < total; i++)
   {
      string objName = ObjectName(srcChart, i);
      ENUM_OBJECT objType = (ENUM_OBJECT)ObjectGetInteger(srcChart, objName, OBJPROP_TYPE);
      
      if(ShouldCopyObjectType(objType))
      {
         string newName = objName;
         ObjectDelete(dstChart, newName);
         
         if(ObjectCreate(dstChart, newName, objType, 0, 0, 0))
         {
            CopyObjectProperties(srcChart, objName, dstChart, newName, objType);
            copied++;
         }
      }
   }
   
   return copied;
}

void CopyObjectProperties(long srcChart, string srcName, long dstChart, string dstName, ENUM_OBJECT objType)
{
   // Copy common properties
   ObjectSetInteger(dstChart, dstName, OBJPROP_COLOR, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_COLOR));
   ObjectSetInteger(dstChart, dstName, OBJPROP_STYLE, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_STYLE));
   ObjectSetInteger(dstChart, dstName, OBJPROP_WIDTH, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_WIDTH));
   ObjectSetInteger(dstChart, dstName, OBJPROP_BACK, 
                   ObjectGetInteger(srcChart, srcName, OBJPROP_BACK));
   ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTABLE,
                   ObjectGetInteger(srcChart, srcName, OBJPROP_SELECTABLE));
   ObjectSetInteger(dstChart, dstName, OBJPROP_SELECTED,
                   ObjectGetInteger(srcChart, srcName, OBJPROP_SELECTED));
   
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
   
   // Copy coordinates - determine how many anchor points based on object type
   int anchorPoints = GetAnchorPointsCount(objType);
   
   for(int j = 0; j < anchorPoints; j++)
   {
      datetime time = (datetime)ObjectGetInteger(srcChart, srcName, OBJPROP_TIME, j);
      double price = ObjectGetDouble(srcChart, srcName, OBJPROP_PRICE, j);
      
      ObjectSetInteger(dstChart, dstName, OBJPROP_TIME, j, time);
      ObjectSetDouble(dstChart, dstName, OBJPROP_PRICE, j, price);
   }
   
   // Copy text description
   string desc = ObjectGetString(srcChart, srcName, OBJPROP_TEXT);
   if(desc != "")
      ObjectSetString(dstChart, dstName, OBJPROP_TEXT, desc);
}

int GetAnchorPointsCount(ENUM_OBJECT objType)
{
   switch(objType)
   {
      case OBJ_VLINE:
         return 1;
      
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
      case OBJ_GANNLINE:
      case OBJ_GANNFAN:
      case OBJ_GANNGRID:
         return 3;
      
      case OBJ_EXPANSION:
      case OBJ_PITCHFORK:
         return 3;
      
      default:
         return 2;
   }
}