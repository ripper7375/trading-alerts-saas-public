//+------------------------------------------------------------------+
//|                                          ImprovedZigzagColor.mq5 |
//|                                        Copyright 2024, Your Name |
//|                                      https://www.yourwebsite.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.42"
#property description "Improved ZigZag Color Indicator - V42 BASELINE"
#property description "Added Equal High/Low Toggle and Memory Optimization"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 5    
#property indicator_plots   1    

#property indicator_type1   DRAW_COLOR_ZIGZAG
#property indicator_width1  2

//--- Button name constant
#define EXPORT_BUTTON_NAME "ExportDataButton"

// input parameters
input group "ZigZag and Market Structure Settings"
input int    xInpDepth     = 12;             // Depth (minimum value: 2)
input int    xInpDeviation = 5;              // Deviation (in points)
input int    xInpBackstep  = 3;              // Back Step (minimum value: 1)
input color  xInpColorNormal = clrSilver;      // Normal ZigZag color
input color  xInpColorLarge = clrDodgerBlue;   // Large ZigZag color
input color  xInpColorExtreme = clrDarkViolet; // Extreme ZigZag color
input bool   xInpEnableEqual = false;         // Enable Equal High/Low Detection
input double xInpEqualThreshold = 0.50;      // Equal threshold (In % of 2-Prev Points)

// Additional input parameters for data source
input group "Data Source Settings"
enum ENUM_DATA_SOURCE
  {
   DATA_SOURCE_LIVE = 0,  // Live chart data
   DATA_SOURCE_FILE = 1   // Data from text file
  };
input ENUM_DATA_SOURCE  InpDataSource = DATA_SOURCE_LIVE;  // Data Source
input string            InpSourceFileName = "";            // Source file name (if using file data)
input string            InpPreferredSymbol = "";           // Override symbol (empty = chart symbol)
input string            InpPreferredTimeframe = "";        // Override timeframe (empty = chart)

// Z-Score Percent Change parameters
input group "Z-Score Percent Change Settings"
input int    InpZScoreLength  = 50;          // Z-Score Length (Number of ZigZag Segments)
input double InpThresholdZ1   = 1.41;        // First threshold (Large)
input double InpThresholdZ2   = 1.88;        // Second threshold (Extreme)

// Input parameters for export functionality
input group "Data Export Settings"
input string InpExportFileName = "MarketStructureAnalysis.txt"; // Export file name
input int    InpMaxBarsExport = 3000;                           // Max lookback bars for export (0 = all bars)

// Structure for storing valid zigzag points
struct xValidZigZagPoint
  {
   int               bar;
   double            price;
   double            close;            // Close price at the zigzag point
   bool              isPeak;
   bool              safeguardValid;
   bool              validationValid;
   datetime          timestamp;
  };

// Array to store collected points
xValidZigZagPoint xcollectedPoints[];

// Structure for price data from file
struct PriceDataPoint
  {
   int               index;
   datetime          time;
   double            open;
   double            high;
   double            low;
   double            close;
  };

// Arrays for file-based data
PriceDataPoint FileData[];

// Forward declarations 
string FindOHLCDataFile(); 
string FindOHLCDataFile(string targetSymbol, string targetTimeframe);

// Indicator buffers
double xZigzagPeakBuffer[];    // Buffer for peaks
double xZigzagBottomBuffer[];  // Buffer for bottoms
double xColorBuffer[];         // Color index buffer
double xHighMapBuffer[];       // High points mapping
double xLowMapBuffer[];        // Low points mapping

// File mode buffers (for file data)
double FileZigzagPeakBuffer[];
double FileZigzagBottomBuffer[];
double FileColorBuffer[];
double FileHighMapBuffer[];
double FileLowMapBuffer[];

// Global variables
int    xExtRecalc = 3;             // Recalculation depth
double xExtLastPeak = 0;           // Last peak price
double xExtLastBottom = 0;         // Last bottom price

// File mode globals
bool     g_UsingFileData = false;
string   g_FileSymbol = "";          
string   g_FileTimeframe = "";
int      g_FileDigitsPrecision = 5;  
double   g_FilePointSize = 0.00001;
int      g_FileDataSize = 0;         
bool     g_FileDataInitialized = false;

// Enumeration for search mode
enum xEnSearchMode
  {
   xExtremum = 0,  
   xPeak = 1,      
   xBottom = -1    
  };

//+------------------------------------------------------------------+
//|   Validation Functions                                           |
//+------------------------------------------------------------------+
bool xIsValidPrice(double price)
  {
   return price > 0;  
  }

//+------------------------------------------------------------------+
//| Create Export Button with improved styling                       |
//+------------------------------------------------------------------+
void CreateExportButton()
  {
   ObjectDelete(0, EXPORT_BUTTON_NAME);
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

   int button_width = 200;
   int button_height = 50;     
   int x_margin = 250;         
   int y_margin = 100;         

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Data");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);
  }

//+------------------------------------------------------------------+
//| Calculate Z-Score Percent Change Classification                  |
//+------------------------------------------------------------------+
int GetPercentChangeClassification(int currentIndex, int totalPoints, double currentPctChange, bool isUnconfirmed = false)
  {
   double sum = 0, sum2 = 0;
   int count = 0;
   int startIdx = isUnconfirmed ? 0 : currentIndex;

   // If it's the live unconfirmed segment, include it as the first data point
   if(isUnconfirmed)
     {
      double absPct = MathAbs(currentPctChange);
      sum += absPct;
      sum2 += absPct * absPct;
      count++;
     }
   
   // Loop backwards through confirmed segments for Z-Score calculation
   for(int j = 0; count < InpZScoreLength && (startIdx + j + 1) < totalPoints; j++)
     {
      double currP = xcollectedPoints[startIdx + j].price;
      double prevP = xcollectedPoints[startIdx + j + 1].price;
      
      if(prevP == 0) continue; // Safety check
      
      double pctChange = ((currP - prevP) / prevP) * 100.0;
      double absPct = MathAbs(pctChange);
      
      sum += absPct;
      sum2 += absPct * absPct;
      count++;
     }
   
   double mean = 0, stdDev = 0, zScore = 0;
   if(count > 0)
     {
      mean = sum / count;
      if(count > 1)
        {
         double variance = (sum2 - sum * mean) / (count - 1);
         if(variance > 0) stdDev = MathSqrt(variance);
        }
     }
   
   if(stdDev != 0)
      zScore = (MathAbs(currentPctChange) - mean) / stdDev;

   bool isBullish = currentPctChange >= 0;
   
   if(isBullish)
     {
      if(zScore >= InpThresholdZ2) return 2;
      else if(zScore >= InpThresholdZ1) return 1;
      else return 0;
     }
   else
     {
      if(zScore >= InpThresholdZ2) return 5;
      else if(zScore >= InpThresholdZ1) return 4;
      else return 3;
     }
  }

//+------------------------------------------------------------------+
//| Export Market Structure Analysis to all files                    |
//+------------------------------------------------------------------+
bool ExportMarketStructureData()
  {
   string symbolName = "";
   string timeframeName = "";

   if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
     {
      symbolName = g_FileSymbol;
      timeframeName = g_FileTimeframe;

      if(ArraySize(xcollectedPoints) == 0)
        {
         Print("ERROR: No zigzag points collected to export");
         return false;
        }
     }
   else
     {
      symbolName = Symbol();
      timeframeName = EnumToString(Period());

      if(StringFind(timeframeName, "PERIOD_") == 0)
         timeframeName = StringSubstr(timeframeName, 7);
     }

   string marketStructureTxtFile = "MarketStructureAnalysis_" + symbolName + "_" + timeframeName + ".txt";
   bool text_success = ExportMarketStructureToText(marketStructureTxtFile, symbolName, timeframeName);

   if(text_success)
      Print("Successfully exported Market Structure to: ", marketStructureTxtFile);
   else
      Print("ERROR: Failed to export Market Structure");

   return text_success;
  }

//+------------------------------------------------------------------+
//| Export Market Structure Analysis to TEXT file                    |
//+------------------------------------------------------------------+
bool ExportMarketStructureToText(string filename, string symbol, string timeframe)
  {
   if(filename == "")
      filename = StringSubstr(InpExportFileName, 0, StringFind(InpExportFileName, ".")) + ".txt";

   // Using FILE_ANSI with CP_UTF8 creates a pure UTF-8 file without BOM
   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI, '\t', CP_UTF8);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open TEXT file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

   write_success &= FileWrite(file_handle,
                              "TimeStamp\tsymbol\ttimeframe\tclose\tType\tCurrentPoint\tPreviousPoint\tTwoPreviousPoint\t" +
                              "ThreePreviousPoint\tFourPreviousPoint\tFivePreviousPoint\t" +
                              "PriceChange\tPercentChange\tPercentChangeClassification\tBars\tCategory") > 0;

   int totalPoints = ArraySize(xcollectedPoints);
   if(totalPoints < 6)
     {
      FileClose(file_handle);
      return true; // Not enough points to structure
     }

   datetime gmt_offset = TimeCurrent() - TimeGMT();
   int currentChartBar = ArraySize(xZigzagPeakBuffer) - 1; // Used to calculate distance for lookback

   int startIndex = totalPoints - 6; // Default to oldest eligible index to print chronologically
   
   // If MaxBars is set, locate the oldest point that is within our max lookback limit
   if(InpMaxBarsExport > 0)
     {
      for(int i = 0; i <= totalPoints - 6; i++)
        {
         if((currentChartBar - xcollectedPoints[i].bar) > InpMaxBarsExport)
           {
            startIndex = i - 1;
            break;
           }
        }
     }

   if(startIndex < 0)
     {
      FileClose(file_handle);
      return true; // All points are older than lookback limit
     }

   // Iterate from the oldest point (startIndex) down to the newest confirmed point (0)
   for(int i = startIndex; i >= 0; i--)
     {
      double currentPrice   = xcollectedPoints[i].price;
      double prevPrice      = xcollectedPoints[i+1].price;
      double twoPrevPrice   = xcollectedPoints[i+2].price;
      double threePrevPrice = xcollectedPoints[i+3].price;
      double fourPrevPrice  = xcollectedPoints[i+4].price;
      double fivePrevPrice  = xcollectedPoints[i+5].price;

      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100;
      int barCount = xcollectedPoints[i].bar - xcollectedPoints[i+1].bar;
      int pctClass = GetPercentChangeClassification(i, totalPoints, percentChange, false);

      string firstStatus;
      if(xInpEnableEqual)
        {
         double upperThreshold = twoPrevPrice * (1 + (xInpEqualThreshold / 100));
         double lowerThreshold = twoPrevPrice * (1 - (xInpEqualThreshold / 100));
         
         if(currentPrice > upperThreshold)
            firstStatus = "Higher";
         else if(currentPrice < lowerThreshold)
            firstStatus = "Lower";
         else
            firstStatus = "Equal";
        }
      else
        {
         // Conventional Mode (Strict comparison)
         if(currentPrice >= twoPrevPrice)
            firstStatus = "Higher";
         else
            firstStatus = "Lower";
        }

      string lastStatus = (currentPrice > prevPrice) ? "High" : "Low";
      string category = "";

      if(firstStatus == "Higher" && lastStatus == "High") category = "HH";
      else if(firstStatus == "Lower" && lastStatus == "Low") category = "LL";
      else if(firstStatus == "Higher" && lastStatus == "Low") category = "HL";
      else if(firstStatus == "Lower" && lastStatus == "High") category = "LH";
      else if(firstStatus == "Equal" && lastStatus == "High") category = "EQH";
      else if(firstStatus == "Equal" && lastStatus == "Low") category = "EQL";

      // Convert local MT5 time to UNIX time 
      long unixTime = (long)(xcollectedPoints[i].timestamp - gmt_offset);

      string line = StringFormat("%d\t%s\t%s\t%.5f\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.2f\t%d\t%d\t%s",
                                 unixTime,
                                 symbol,
                                 timeframe,
                                 xcollectedPoints[i].close,
                                 xcollectedPoints[i].isPeak ? "Peak" : "Bottom",
                                 currentPrice,
                                 prevPrice,
                                 twoPrevPrice,
                                 threePrevPrice,
                                 fourPrevPrice,
                                 fivePrevPrice,
                                 priceChange,
                                 percentChange,
                                 pctClass,
                                 barCount,
                                 category
                                );

      write_success &= FileWrite(file_handle, line) > 0;
     }

   // --- UNCONFIRMED ZIGZAG ROW CALCULATION ---
   if(totalPoints >= 5)
     {
      double unconf_price = 0;
      double unconf_close = 0;
      long unconf_time = (long)TimeGMT(); // TimeStamp at the exact time data is exported
      int unconf_bars = 0;
      bool unconf_isPeak = !xcollectedPoints[0].isPeak;

      if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
        {
         int fileSize = ArraySize(FileData);
         int startBar = xcollectedPoints[0].bar;
         int endBar = fileSize - 1;
         unconf_bars = endBar - startBar;
         unconf_close = FileData[endBar].close;

         if(unconf_isPeak)
           {
            double hh = FileData[startBar].high;
            for(int j = startBar; j <= endBar; j++)
              {
               if(FileData[j].high > hh) hh = FileData[j].high;
              }
            unconf_price = hh;
           }
         else
           {
            double ll = FileData[startBar].low;
            for(int j = startBar; j <= endBar; j++)
              {
               if(FileData[j].low < ll) ll = FileData[j].low;
              }
            unconf_price = ll;
           }
        }
      else
        {
         ENUM_TIMEFRAMES currentPeriod = Period();
         int shiftLastConfirmed = iBarShift(Symbol(), currentPeriod, xcollectedPoints[0].timestamp);
         unconf_bars = shiftLastConfirmed;
         if(shiftLastConfirmed < 0) shiftLastConfirmed = 0;

         unconf_close = iClose(Symbol(), currentPeriod, 0);
         double highArr[], lowArr[];

         if(CopyHigh(Symbol(), currentPeriod, 0, shiftLastConfirmed + 1, highArr) > 0 &&
            CopyLow(Symbol(), currentPeriod, 0, shiftLastConfirmed + 1, lowArr) > 0)
           {
            if(unconf_isPeak)
              {
               unconf_price = highArr[ArrayMaximum(highArr)];
              }
            else
              {
               unconf_price = lowArr[ArrayMinimum(lowArr)];
              }
           }
        }

      double currentPrice   = unconf_price;
      double prevPrice      = xcollectedPoints[0].price;
      double twoPrevPrice   = xcollectedPoints[1].price;
      double threePrevPrice = xcollectedPoints[2].price;
      double fourPrevPrice  = xcollectedPoints[3].price;
      double fivePrevPrice  = xcollectedPoints[4].price;

      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100;
      int barCount = unconf_bars;

      int pctClass = GetPercentChangeClassification(0, totalPoints, percentChange, true);
      
      string firstStatus;
      if(xInpEnableEqual)
        {
         double upperThreshold = twoPrevPrice * (1 + (xInpEqualThreshold / 100));
         double lowerThreshold = twoPrevPrice * (1 - (xInpEqualThreshold / 100));
         
         if(currentPrice > upperThreshold)
            firstStatus = "Higher";
         else if(currentPrice < lowerThreshold)
            firstStatus = "Lower";
         else
            firstStatus = "Equal";
        }
      else
        {
         // Conventional Mode (Strict comparison)
         if(currentPrice >= twoPrevPrice)
            firstStatus = "Higher";
         else
            firstStatus = "Lower";
        }

      string lastStatus = (currentPrice > prevPrice) ? "High" : "Low";
      string category = "";

      if(firstStatus == "Higher" && lastStatus == "High") category = "HH";
      else if(firstStatus == "Lower" && lastStatus == "Low") category = "LL";
      else if(firstStatus == "Higher" && lastStatus == "Low") category = "HL";
      else if(firstStatus == "Lower" && lastStatus == "High") category = "LH";
      else if(firstStatus == "Equal" && lastStatus == "High") category = "EQH";
      else if(firstStatus == "Equal" && lastStatus == "Low") category = "EQL";

      string line = StringFormat("%d\t%s\t%s\t%.5f\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%.2f\t%d\t%d\t%s",
                                 unconf_time,
                                 symbol,
                                 timeframe,
                                 unconf_close,
                                 unconf_isPeak ? "Peak" : "Bottom",
                                 currentPrice,
                                 prevPrice,
                                 twoPrevPrice,
                                 threePrevPrice,
                                 fourPrevPrice,
                                 fivePrevPrice,
                                 priceChange,
                                 percentChange,
                                 pctClass,
                                 barCount,
                                 category
                                );

      write_success &= FileWrite(file_handle, line) > 0;
     }

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to TEXT file");
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Find OHLC data file based on global settings or parameters       |
//+------------------------------------------------------------------+
string FindOHLCDataFile()
  {
   string targetSymbol = (InpPreferredSymbol != "" ? InpPreferredSymbol : Symbol());
   string targetTimeframe = (InpPreferredTimeframe != "" ? InpPreferredTimeframe : EnumToString(Period()));
   return FindOHLCDataFile(targetSymbol, targetTimeframe);
  }

//+------------------------------------------------------------------+
//| Find OHLC data file with explicit parameters                     |
//+------------------------------------------------------------------+
string FindOHLCDataFile(string targetSymbol, string targetTimeframe)
  {
   if(StringFind(targetTimeframe, "PERIOD_") == 0)
     {
      targetTimeframe = StringSubstr(targetTimeframe, 7);
     }

   string exactFilename = "PriceData_" + targetSymbol + "_" + targetTimeframe;
   string filenameWithExt = exactFilename + ".txt";

   int handle = FileOpen(exactFilename, FILE_READ|FILE_TXT);
   if(handle != INVALID_HANDLE)
     {
      FileClose(handle);
      return exactFilename;
     }

   handle = FileOpen(filenameWithExt, FILE_READ|FILE_TXT);
   if(handle != INVALID_HANDLE)
     {
      FileClose(handle);
      return filenameWithExt;
     }

   return "";
  }

//+------------------------------------------------------------------+
//| Extract symbol and timeframe from filename                       |
//+------------------------------------------------------------------+
bool ExtractSymbolAndTimeframe(string fileName)
  {
   int dotPos = StringFind(fileName, ".");
   if(dotPos > 0)
     {
      fileName = StringSubstr(fileName, 0, dotPos);
     }

   string parts[];
   int count = StringSplit(fileName, '_', parts);

   if(count < 3)
     {
      Print("ERROR: Filename format not recognized: ", fileName);
      return false;
     }

   g_FileSymbol = parts[1];
   g_FileTimeframe = parts[2];

   if(StringFind(g_FileSymbol, "JPY") >= 0)
     {
      g_FileDigitsPrecision = 3;
      g_FilePointSize = 0.001;
     }
   else if(StringFind(g_FileSymbol, "BTC") >= 0 || StringFind(g_FileSymbol, "XBT") >= 0)
     {
      g_FileDigitsPrecision = 2;
      g_FilePointSize = 0.01;
     }
   else if(StringFind(g_FileSymbol, "ETH") >= 0 || StringFind(g_FileSymbol, "XRP") >= 0)
     {
      g_FileDigitsPrecision = 5;
      g_FilePointSize = 0.00001;
     }
   else
     {
      g_FileDigitsPrecision = 5;
      g_FilePointSize = 0.00001;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Load price data from TXT file                                    |
//+------------------------------------------------------------------+
bool LoadPriceData(string fileName)
  {
   if(!ExtractSymbolAndTimeframe(fileName))
     {
      return false;
     }

   int fileHandle = FileOpen(fileName, FILE_READ|FILE_TXT);
   if(fileHandle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open file: ", fileName, " Error: ", GetLastError());
      return false;
     }

   string line = "";
   bool headerFound = false;

   while(!FileIsEnding(fileHandle))
     {
      line = FileReadString(fileHandle);
      if(StringFind(line, "No\tTimeStamp\tOpen\tHigh\tLow\tClose") >= 0)
        {
         headerFound = true;
         break;
        }
     }

   if(!headerFound)
     {
      Print("ERROR: Header line not found in file");
      FileClose(fileHandle);
      return false;
     }

   int lineCount = 0;
   ulong filePos = FileTell(fileHandle);

   while(!FileIsEnding(fileHandle))
     {
      line = FileReadString(fileHandle);
      if(StringLen(line) > 0)
        {
         lineCount++;
        }
     }

   FileSeek(fileHandle, filePos, SEEK_SET);

   ArrayResize(FileData, lineCount);
   g_FileDataSize = lineCount;

   for(int i = 0; i < lineCount && !FileIsEnding(fileHandle); i++)
     {
      line = FileReadString(fileHandle);
      string parts[];
      int count = StringSplit(line, '\t', parts);

      if(count < 6)
        {
         continue;
        }

      FileData[i].index = (int)StringToInteger(parts[0]);
      FileData[i].time = StringToTime(parts[1]);
      FileData[i].open = StringToDouble(parts[2]);
      FileData[i].high = StringToDouble(parts[3]);
      FileData[i].low = StringToDouble(parts[4]);
      FileData[i].close = StringToDouble(parts[5]);
     }

   FileClose(fileHandle);
   return true;
  }

//+------------------------------------------------------------------+
//| Initialize data from file                                        |
//+------------------------------------------------------------------+
bool InitializeFromFile()
  {
   string sourceFile = FindOHLCDataFile();
   if(sourceFile == "")
     {
      Print("ERROR: No source file found");
      return false;
     }

   if(!LoadPriceData(sourceFile))
     {
      Print("ERROR: Failed to load price data from file");
      return false;
     }

   int dataSize = ArraySize(FileData);
   
   ArrayResize(FileZigzagPeakBuffer, dataSize);
   ArrayResize(FileZigzagBottomBuffer, dataSize);
   ArrayResize(FileColorBuffer, dataSize);
   ArrayResize(FileHighMapBuffer, dataSize);
   ArrayResize(FileLowMapBuffer, dataSize);

   ArrayInitialize(FileZigzagPeakBuffer, 0.0);
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);

   return true;
  }

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(xInpDepth < 2 || xInpBackstep < 1 || xInpDeviation < 0)
      return INIT_PARAMETERS_INCORRECT;

   if(xInpEqualThreshold <= 0 || xInpEqualThreshold > 1.00)
     {
      Print("ERROR: Equal threshold must be between 0.00% and 1.00%");
      return INIT_PARAMETERS_INCORRECT;
     }

   ArrayInitialize(xZigzagPeakBuffer, 0.0);
   ArrayInitialize(xZigzagBottomBuffer, 0.0);
   ArrayInitialize(xColorBuffer, 0.0);
   ArrayInitialize(xHighMapBuffer, 0.0);
   ArrayInitialize(xLowMapBuffer, 0.0);

   SetIndexBuffer(0, xZigzagPeakBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, xZigzagBottomBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, xColorBuffer, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(3, xHighMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(4, xLowMapBuffer, INDICATOR_CALCULATIONS);

   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

   // Apply 3-color map for Normal, Large, and Extreme classification
   PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 3);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 0, xInpColorNormal);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 1, xInpColorLarge);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 2, xInpColorExtreme);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

   string short_name = StringFormat("ZigZagColor(%d,%d,%d)", xInpDepth, xInpDeviation, xInpBackstep);
   IndicatorSetString(INDICATOR_SHORTNAME, short_name);
   PlotIndexSetString(0, PLOT_LABEL, short_name);

   CreateExportButton();

   if(InpDataSource == DATA_SOURCE_FILE)
     {
      if(InitializeFromFile())
        {
         g_FileDataInitialized = true;
        }
      else
        {
         Print("WARNING: Failed to initialize file data, falling back to live data");
        }
     }

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| OnChartEvent handles UI interactions                             |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME)
     {
      if(ExportMarketStructureData())
         Print("Data exported successfully to TEXT file");
      else
         Print("Failed to export data");

      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   // Note: CheckAndResizeLiveDataBuffers removed in v1.41 for terminal stability
   
   if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
     {
      if(prev_calculated == 0)
        {
         CalculateFileZigZag();
         CollectFileZigZagPoints();
         UpdateZigZagColors();
         return rates_total;
        }
     }

   if(rates_total < xInpDepth)
      return 0;

   int checkStart = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   
   for(int i = checkStart; i < rates_total && i < checkStart + xInpDepth * 2; i++)
     {
      if(high[i] <= 0 || low[i] <= 0 || !MathIsValidNumber(high[i]) || !MathIsValidNumber(low[i]))
        {
         return 0;
        }
     }

   if(!ValidateBuffers())
      return 0;

   int start = InitializeCalculation(rates_total, prev_calculated);
   if(start < 0)
      return 0;

   if(prev_calculated > 0)
     {
      start = MathMax(prev_calculated - 3, xInpDepth - 1);
     }

   CalculateZigZag(rates_total, start, high, low, prev_calculated);

   // Quietly collect Valid points with Close prices appended
   CollectValidPoints(time, close);

   // Update Chart ZigZag Colors based on Z-Score classification
   UpdateZigZagColors();
   
   return rates_total;
  }

//+------------------------------------------------------------------+
//| Map file data to indicator buffers                               |
//+------------------------------------------------------------------+
void MapFileDataToBuffers(const int rates_total, const datetime &chart_time[])
  {
   ArrayInitialize(FileZigzagPeakBuffer, 0.0);
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);

   CalculateFileZigZag();
  }

//+------------------------------------------------------------------+
//| Unified high/low map calculation for both data sources           |
//+------------------------------------------------------------------+
void UnifiedCalculateHighLowMaps(const int index,
                                 const double &high[], const double &low[],
                                 const int depth,
                                 double &highMapBuffer[], double &lowMapBuffer[])
  {
   int highSize = ArraySize(high);
   int lowSize = ArraySize(low);
   int highMapBufferSize = ArraySize(highMapBuffer);
   int lowMapBufferSize = ArraySize(lowMapBuffer);

   if(index < 0 || index >= highSize || index >= lowSize ||
      index >= highMapBufferSize || index >= lowMapBufferSize)
     {
      Print("ERROR: ARRAY BOUNDS ERROR in UnifiedCalculateHighLowMaps");
      return;
     }

   double highVal = UnifiedHighest(high, depth, index);
   if(high[index] == highVal)
     {
      highMapBuffer[index] = high[index];
     }
   else
     {
      highMapBuffer[index] = 0.0;
     }

   double lowVal = UnifiedLowest(low, depth, index);
   if(low[index] == lowVal)
     {
      lowMapBuffer[index] = low[index];
     }
   else
     {
      lowMapBuffer[index] = 0.0;
     }
  }

// Unified Highest function that works with any array
double UnifiedHighest(const double &array[], int count, int start)
  {
   int arraySize = ArraySize(array);
   if(start < 0 || start >= arraySize)
     {
      return 0.0;
     }

   if(start < count - 1)
      count = start + 1;
      
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res < array[i])
         res = array[i];
         
   return res;
  }

// Unified Lowest function that works with any array
double UnifiedLowest(const double &array[], int count, int start)
  {
   if(start < count - 1)
      count = start + 1;
      
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res > array[i])
         res = array[i];
         
   return res;
  }

//+------------------------------------------------------------------+
//| Calculate ZigZag Using File Data                                 |
//+------------------------------------------------------------------+
void CalculateFileZigZag()
  {
   int fileSize = ArraySize(FileData);

   if(ArraySize(FileZigzagPeakBuffer) < fileSize)
      ArrayResize(FileZigzagPeakBuffer, fileSize);
      
   if(ArraySize(FileZigzagBottomBuffer) < fileSize)
      ArrayResize(FileZigzagBottomBuffer, fileSize);

   if(ArraySize(FileHighMapBuffer) < fileSize)
      ArrayResize(FileHighMapBuffer, fileSize);
      
   if(ArraySize(FileLowMapBuffer) < fileSize)
      ArrayResize(FileLowMapBuffer, fileSize);

   if(ArraySize(FileColorBuffer) < fileSize)
      ArrayResize(FileColorBuffer, fileSize);

   double highValues[], lowValues[];
   ArrayResize(highValues, fileSize);
   ArrayResize(lowValues, fileSize);

   for(int i = 0; i < fileSize; i++)  
     {
      highValues[i] = FileData[i].high;
      lowValues[i] = FileData[i].low;
     }

   ArrayInitialize(FileZigzagPeakBuffer, 0.0);
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);

   int extreme_search = xExtremum;
   double last_high = 0, last_low = 0;
   int last_high_pos = 0, last_low_pos = 0;

   for(int i = xInpDepth-1; i < fileSize; i++)  
     {
      double highVal = Highest(highValues, xInpDepth, i);
      if(highValues[i] == highVal)
        {
         FileHighMapBuffer[i] = highValues[i];
        }

      double lowVal = Lowest(lowValues, xInpDepth, i);
      if(lowValues[i] == lowVal)
        {
         FileLowMapBuffer[i] = lowValues[i];
        }
     }

   for(int i = xInpDepth-1; i < fileSize; i++)  
     {
      switch(extreme_search)
        {
         case xExtremum:  
            if(last_low == 0 && last_high == 0)
              {
               if(FileHighMapBuffer[i] != 0)
                  {
                  last_high = highValues[i];
                  last_high_pos = i;
                  extreme_search = xBottom;  
                  FileZigzagPeakBuffer[i] = last_high;
                  FileColorBuffer[i] = 0;
                  }
               else if(FileLowMapBuffer[i] != 0)
                 {
                  last_low = lowValues[i];
                  last_low_pos = i;
                  extreme_search = xPeak;  
                  FileZigzagBottomBuffer[i] = last_low;
                  FileColorBuffer[i] = 0;
                 }
              }
            break;
            
         case xPeak:  
            if(FileHighMapBuffer[i] != 0)  
              {
               last_high = highValues[i];
               last_high_pos = i;
               FileZigzagPeakBuffer[i] = last_high;
               FileColorBuffer[i] = 0;
               extreme_search = xBottom;
              }
            else if(FileLowMapBuffer[i] != 0 && lowValues[i] < last_low) 
              {
               FileZigzagBottomBuffer[last_low_pos] = 0.0;
               last_low = lowValues[i];
               last_low_pos = i;
               FileZigzagBottomBuffer[i] = last_low;  
               FileColorBuffer[i] = 0;
              }
            break;
            
         case xBottom:  
            if(FileLowMapBuffer[i] != 0)  
              {
               last_low = lowValues[i];
               last_low_pos = i;
               FileZigzagBottomBuffer[i] = last_low;
               FileColorBuffer[i] = 0;
               extreme_search = xPeak;
              }
            else if(FileHighMapBuffer[i] != 0 && highValues[i] > last_high)  
              {
               FileZigzagPeakBuffer[last_high_pos] = 0.0;
               last_high = highValues[i];
               last_high_pos = i;
               FileZigzagPeakBuffer[i] = last_high;  
               FileColorBuffer[i] = 0;
              }
            break;
        }
     }
  }

//+------------------------------------------------------------------+
//| Initialize calculation variables                                 |
//+------------------------------------------------------------------+
int InitializeCalculation(const int rates_total, const int prev_calculated)
  {
   static bool buffers_initialized = false;
   
   if(prev_calculated == 0)
     {
      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);

      buffers_initialized = true;
      return xInpDepth - 1;
     }

   if(!buffers_initialized)
     {
      double lastPeak = 0, lastBottom = 0;
      int lastPeakPos = -1, lastBottomPos = -1;

      for(int i = rates_total - 1; i >= 0; i--)
        {
         if(xZigzagPeakBuffer[i] != 0)
           {
            lastPeak = xZigzagPeakBuffer[i];
            lastPeakPos = i;
            break;
           }
        }

      for(int i = rates_total - 1; i >= 0; i--)
        {
         if(xZigzagBottomBuffer[i] != 0)
           {
            lastBottom = xZigzagBottomBuffer[i];
            lastBottomPos = i;
            break;
           }
        }

      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);

      if(lastPeakPos >= 0) xZigzagPeakBuffer[lastPeakPos] = lastPeak;
      if(lastBottomPos >= 0) xZigzagBottomBuffer[lastBottomPos] = lastBottom;
      
      buffers_initialized = true;
     }

   return prev_calculated - 1;
  }

//+------------------------------------------------------------------+
//| Calculate ZigZag values                                          |
//+------------------------------------------------------------------+
void CalculateZigZag(const int rates_total, int start,
                     const double &high[], const double &low[],
                     const int prev_calculated)
  {
   int extreme_search = xExtremum;
   double last_high = 0, last_low = 0;
   int last_high_pos = 0, last_low_pos = 0;
   
   if(start > xInpDepth)
     {
      for(int i = start - 1; i >= start - xInpDepth && i >= 0; i--)
        {
         if(xZigzagPeakBuffer[i] != 0)
           {
            last_high = xZigzagPeakBuffer[i];
            last_high_pos = i;
            extreme_search = xBottom;
            break;
           }
         if(xZigzagBottomBuffer[i] != 0)
           {
            last_low = xZigzagBottomBuffer[i];
            last_low_pos = i;
            extreme_search = xPeak;
            break;
           }
        }
     }

   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      CalculateHighLowMaps(i, high, low);
      if(!FindExtremes(i, extreme_search, last_high, last_low,
                       last_high_pos, last_low_pos, high, low))
         break;
     }
  }

//+------------------------------------------------------------------+
//| Find and process extreme points                                  |
//+------------------------------------------------------------------+
bool FindExtremes(const int i, int &extreme_search, double &last_high, double &last_low,
                  int &last_high_pos, int &last_low_pos, const double &high[], const double &low[])
  {
   switch(extreme_search)
     {
      case xExtremum:  
         if(last_low == 0 && last_high == 0)
           {
            if(xHighMapBuffer[i] != 0)
               {
               last_high = high[i];
               last_high_pos = i;
               extreme_search = xBottom;  
               xZigzagPeakBuffer[i] = last_high;
               xColorBuffer[i] = 0;
               }
            else if(xLowMapBuffer[i] != 0)
                 {
                  last_low = low[i];
                  last_low_pos = i;
                  extreme_search = xPeak;  
                  xZigzagBottomBuffer[i] = last_low;
                  xColorBuffer[i] = 0;
                 }
           }
         break;
         
      case xPeak:  
         if(xHighMapBuffer[i] != 0)  
           {
            last_high = high[i];
            last_high_pos = i;
            xZigzagPeakBuffer[i] = last_high;
            xColorBuffer[i] = 0;
            extreme_search = xBottom;
           }
         else if(xLowMapBuffer[i] != 0 && low[i] < last_low) 
              {
               xZigzagBottomBuffer[last_low_pos] = 0.0;
               last_low = low[i];
               last_low_pos = i;
               xZigzagBottomBuffer[i] = last_low;  
               xColorBuffer[i] = 0;
              }
         break;
         
      case xBottom:  
         if(xLowMapBuffer[i] != 0)  
           {
            last_low = low[i];
            last_low_pos = i;
            xZigzagBottomBuffer[i] = last_low;
            xColorBuffer[i] = 0;
            extreme_search = xPeak;
           }
         else if(xHighMapBuffer[i] != 0 && high[i] > last_high)  
              {
               xZigzagPeakBuffer[last_high_pos] = 0.0;
               last_high = high[i];
               last_high_pos = i;
               xZigzagPeakBuffer[i] = last_high;  
               xColorBuffer[i] = 0;
              }
         break;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Calculate high/low maps from file data                           |
//+------------------------------------------------------------------+
void CalculateFileHighLowMaps()
  {
   int fileSize = ArraySize(FileData);
   double highValues[], lowValues[];
   ArrayResize(highValues, fileSize);
   ArrayResize(lowValues, fileSize);
   
   for(int i = 0; i < fileSize; i++)
     {
      highValues[i] = FileData[i].high;
      lowValues[i] = FileData[i].low;
     }

   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   
   for(int i = xInpDepth-1; i < fileSize; i++)
     {
      double highVal = Highest(highValues, xInpDepth, i);
      if(highValues[i] == highVal)
        {
         FileHighMapBuffer[i] = highValues[i];
        }

      double lowVal = Lowest(lowValues, xInpDepth, i);
      if(lowValues[i] == lowVal)
        {
         FileLowMapBuffer[i] = lowValues[i];
        }
     }
  }

//+------------------------------------------------------------------+
//| Calculate High and Low map values                                |
//+------------------------------------------------------------------+
void CalculateHighLowMaps(const int shift,
                          const double &high[], const double &low[])
  {
   double highVal = Highest(high, xInpDepth, shift);
   if(high[shift] == highVal)
     {
      xHighMapBuffer[shift] = high[shift];
     }
   else
     {
      xHighMapBuffer[shift] = 0.0;
     }

   double lowVal = Lowest(low, xInpDepth, shift);
   if(low[shift] == lowVal)
     {
      xLowMapBuffer[shift] = low[shift];
     }
   else
     {
      xLowMapBuffer[shift] = 0.0;
     }
  }

//+------------------------------------------------------------------+
//| helper function to validate zigzag points                        |
//+------------------------------------------------------------------+
bool ValidateZigZagPoint(const int pos, const double price, const bool isPeak)
  {
   if(!xIsValidPrice(price))
      return false;
      
   double minDistance = xInpDeviation * _Point * 2;
   for(int i = pos - 1; i >= MathMax(0, pos - xInpDepth); i--)
     {
      if(xZigzagPeakBuffer[i] != 0 || xZigzagBottomBuffer[i] != 0)
        {
         double prevPrice = (xZigzagPeakBuffer[i] != 0) ?
                            xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         if(MathAbs(price - prevPrice) < minDistance)
            return false;
         break;
        }
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Get highest value for range                                      |
//+------------------------------------------------------------------+
double Highest(const double &array[], int count, int start)
  {
   if(start < count - 1)
      count = start + 1;
      
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res < array[i])
         res = array[i];
         
   return res;
  }

//+------------------------------------------------------------------+
//| Get lowest value for range                                       |
//+------------------------------------------------------------------+
double Lowest(const double &array[], int count, int start)
  {
   if(start < count - 1)
      count = start + 1;
      
   double res = array[start];

   for(int i = start - 1; i > start - count && i >= 0; i--)
      if(res > array[i])
         res = array[i];
         
   return res;
  }

//+------------------------------------------------------------------+
//| Basic buffer validation                                          |
//+------------------------------------------------------------------+
bool ValidateBuffers()
  {
   if(ArraySize(xZigzagPeakBuffer) < xInpDepth)
      return false;
   if(ArraySize(xZigzagBottomBuffer) < xInpDepth)
      return false;
   if(ArraySize(xHighMapBuffer) < xInpDepth)
      return false;
   if(ArraySize(xLowMapBuffer) < xInpDepth)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
//| Process file data and collect zigzag points                      |
//+------------------------------------------------------------------+
bool CollectFileZigZagPoints()
  {
   ArrayResize(xcollectedPoints, 0);

   int fileSize = ArraySize(FileData);
   int pointsCollected = 0;
   
   // Parse downwards from Newest to Oldest to match live chart array structure
   for(int i = fileSize - 1; i >= 0; i--)
     {
      if(FileZigzagPeakBuffer[i] != 0.0)
        {
         int newSize = ArraySize(xcollectedPoints) + 1;
         ArrayResize(xcollectedPoints, newSize);

         xcollectedPoints[newSize-1].bar = i;
         xcollectedPoints[newSize-1].price = FileZigzagPeakBuffer[i];
         xcollectedPoints[newSize-1].close = FileData[i].close; 
         xcollectedPoints[newSize-1].isPeak = true;
         xcollectedPoints[newSize-1].safeguardValid = true;
         xcollectedPoints[newSize-1].validationValid = true;
         xcollectedPoints[newSize-1].timestamp = FileData[i].time;

         pointsCollected++;
        }

      if(FileZigzagBottomBuffer[i] != 0.0)
        {
         int newSize = ArraySize(xcollectedPoints) + 1;
         ArrayResize(xcollectedPoints, newSize);

         xcollectedPoints[newSize-1].bar = i;
         xcollectedPoints[newSize-1].price = FileZigzagBottomBuffer[i];
         xcollectedPoints[newSize-1].close = FileData[i].close;
         xcollectedPoints[newSize-1].isPeak = false;
         xcollectedPoints[newSize-1].safeguardValid = true;
         xcollectedPoints[newSize-1].validationValid = true;
         xcollectedPoints[newSize-1].timestamp = FileData[i].time;

         pointsCollected++;
        }
     }

   return pointsCollected > 0;
  }

//+------------------------------------------------------------------+
//| Collect and validate zigzag points                               |
//+------------------------------------------------------------------+
void CollectValidPoints(const datetime &time[], const double &close[])
  {
   ArrayResize(xcollectedPoints, 0);
   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = 0; 

   int lastValidIndex = -1;

   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         lastValidIndex = i;
        }
     }

   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         double price = (xZigzagPeakBuffer[i] != 0) ?
                        xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         bool isPeak = (xZigzagPeakBuffer[i] != 0);

         bool safeguardValid = ValidateSafeguards(i, price);
         bool validationStepsValid = ValidateSteps(i, price, isPeak);
         
         if(safeguardValid && validationStepsValid && i > lastValidIndex - 2)
           {
            int newSize = ArraySize(xcollectedPoints) + 1;
            ArrayResize(xcollectedPoints, newSize);

            xcollectedPoints[newSize-1].bar = i;
            xcollectedPoints[newSize-1].price = price;
            xcollectedPoints[newSize-1].close = close[i];
            xcollectedPoints[newSize-1].isPeak = isPeak;
            xcollectedPoints[newSize-1].safeguardValid = true;
            xcollectedPoints[newSize-1].validationValid = true;
            xcollectedPoints[newSize-1].timestamp = time[i];
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| Validate point against safeguard checks                          |
//+------------------------------------------------------------------+
bool ValidateSafeguards(const int bar, const double price)
  {
   if(xHighMapBuffer[bar] == 0 && xLowMapBuffer[bar] == 0)
      return false;
      
   return true;
  }

//+------------------------------------------------------------------+
//| Validate point against 4-step validation                         |
//+------------------------------------------------------------------+
bool ValidateSteps(const int bar, const double price, const bool isPeak)
  {
   bool bufferValid = (xHighMapBuffer[bar] != 0 || xLowMapBuffer[bar] != 0);
   if(!bufferValid)
      return false;

   bool modeValid = true;
   if(!modeValid)
      return false;
      
   bool distanceValid = true;
   if(!distanceValid)
      return false;

   bool statusValid = true;
   if(!statusValid)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
//| Update Chart ZigZag Colors based on Z-Score classification       |
//+------------------------------------------------------------------+
void UpdateZigZagColors()
  {
   int totalPoints = ArraySize(xcollectedPoints);
   if(totalPoints < 2) return;
   
   // Start from second oldest down to newest, mapping currentPctChange
   for(int i = totalPoints - 2; i >= 0; i--)
     {
      double currentPrice = xcollectedPoints[i].price;
      double prevPrice = xcollectedPoints[i+1].price;
      
      if(prevPrice == 0) continue;

      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100.0;

      // Classify this segment
      int pctClass = GetPercentChangeClassification(i, totalPoints, percentChange, false);
      
      // Assign buffer color index based on class
      int colorIndex = 0; // Normal (0 or 3)
      if(pctClass == 1 || pctClass == 4) colorIndex = 1; // Large (1 or 4)
      else if(pctClass == 2 || pctClass == 5) colorIndex = 2; // Extreme (2 or 5)

      int barIndex = xcollectedPoints[i].bar;
      
      // Assign the respective color to the plot buffer at the newest point of the segment
      if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
        {
         if(barIndex >= 0 && barIndex < ArraySize(FileColorBuffer))
            FileColorBuffer[barIndex] = colorIndex;
         if(barIndex >= 0 && barIndex < ArraySize(xColorBuffer))
            xColorBuffer[barIndex] = colorIndex;
        }
      else
        {
         if(barIndex >= 0 && barIndex < ArraySize(xColorBuffer))
            xColorBuffer[barIndex] = colorIndex;
        }
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(g_FileDataInitialized)
     {
      ArrayFree(FileData);
      ArrayFree(FileZigzagPeakBuffer);
      ArrayFree(FileZigzagBottomBuffer);
      ArrayFree(FileColorBuffer);
      ArrayFree(FileHighMapBuffer);
      ArrayFree(FileLowMapBuffer);
     }

   ObjectDelete(0, EXPORT_BUTTON_NAME);
  }
//+------------------------------------------------------------------+