//+------------------------------------------------------------------+
//|                                          ImprovedZigzagColor.mq5   |
//|                             Copyright 2024, Your Name               |
//|                                     https://www.yourwebsite.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Improved ZigZag Color Indicator"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 10    // Increased from 9
#property indicator_plots   3     // Changed from 2 to 3
#property indicator_type1   DRAW_COLOR_ZIGZAG
#property indicator_width1  2
#property indicator_type2   DRAW_LINE  // SMMA line
#property indicator_color2  clrRed     // Default SMMA color
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2
#property indicator_type3   DRAW_LINE  // EMA line
#property indicator_color3  clrBlue    // Default EMA color
#property indicator_style3  STYLE_SOLID
#property indicator_width3  2

//--- Button name constant
#define EXPORT_BUTTON_NAME "ExportDataButton"

// input parameters
input group "ZigZag and Market Structure Settings"
input int    xInpDepth     = 12;     // Depth (minimum value: 2)
input int    xInpDeviation = 5;      // Deviation (in points)
input int    xInpBackstep  = 3;      // Back Step (minimum value: 1)
input color  xInpBullColor = clrDodgerBlue;  // Bullish ZigZag color
input color  xInpBearColor = clrRed;         // Bearish ZigZag color
input double xInpEqualThreshold = 0.50;  // Equal threshold (In % of 2-Prev Points)

// Additional input parameters for data source
input group "Data Source Settings"
enum ENUM_DATA_SOURCE
  {
   DATA_SOURCE_LIVE = 0,  // Live chart data
   DATA_SOURCE_FILE = 1   // Data from text file
  };
input ENUM_DATA_SOURCE  InpDataSource = DATA_SOURCE_LIVE;  // Data Source
input string            InpSourceFileName = "";           // Source file name (if using file data)
input string            InpPreferredSymbol = "";          // Override symbol (empty = chart symbol)
input string            InpPreferredTimeframe = "";       // Override timeframe (empty = chart)

// Input parameters for export functionality
input group "Data Export Settings"
input bool   xInpShowPrice = false;  // Show price labels
input bool   xInpDebugMode = true;   // Enable debug printing
input int    xBartoPrint   = 15000;    // Bar to Print in Debug Prints
input string    InpExportFileName = "MarketStructureAnalysis.json";  // Export file name

// Add batch processing parameters
input group "Batch Processing Settings"
input bool             InpEnableBatchMode = false;           // Enable batch processing
input string           InpBatchSymbols = "BTCUSD,EURUSD,USDJPY"; // Symbols for batch processing
input string           InpBatchTimeframes = "M15,H1,H4";     // Timeframes for batch processing

// SMMA input parameters
input group "SMMA Settings"
input int                SMMA_Period = 39;              // SMMA Period
input int                SMMA_Shift = 0;                // SMMA Shift
input ENUM_APPLIED_PRICE SMMA_AppliedPrice = PRICE_CLOSE; // SMMA Applied price
input color              SMMA_Color = clrRed;           // SMMA Line color
input int                SMMA_Width = 2;                // SMMA Line width
input ENUM_LINE_STYLE    SMMA_Style = STYLE_SOLID;      // SMMA Line style

// EMA input parameters
input group "EMA Settings"
input int                EMA_Period = 26;                 // EMA period
input ENUM_APPLIED_PRICE EMA_AppliedPrice = PRICE_TYPICAL; // EMA Applied price
input color              EMA_Color = clrBlue;             // EMA Line color
input int                EMA_Width = 2;                   // EMA Line width
input ENUM_LINE_STYLE    EMA_Style = STYLE_SOLID;         // EMA Line style

// X Value Settings
input group "X Value Settings"
input int                InpXThreshold = 26;          // X threshold for trend determination
input ENUM_TIMEFRAMES    InpBaseTimeframe = PERIOD_CURRENT; // Base timeframe for X threshold
input int                InpConfirmationBars = 1;     // Number of bars for trend confirmation

// Structure for storing valid zigzag points
struct xValidZigZagPoint
  {
   int               bar;
   double            price;
   bool              isPeak;
   bool              safeguardValid;
   bool              validationValid;
   datetime          timestamp;    // Add this new field for timestamp
   int               xValue;       // Add this field to store X value
   string            trend;        // Add this field to store trend
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

// Forward declarations - Place these here
string FindOHLCDataFile();  // No-parameter version for compatibility
string FindOHLCDataFile(string targetSymbol, string targetTimeframe); // Parameter version
bool ProcessSingleFile();  // No-parameter version using globals
bool ProcessSingleFile(string symbol, string timeframe); // Parameter version
bool ProcessAllBatchFiles();
bool ExportDataWithCustomName(string baseFileName);

// Indicator buffers
double xZigzagPeakBuffer[];    // Buffer for peaks
double xZigzagBottomBuffer[];  // Buffer for bottoms
double xColorBuffer[];         // Color index buffer
double xHighMapBuffer[];       // High points mapping
double xLowMapBuffer[];        // Low points mapping

// SMMA buffers
double SMMA_Buffer[];    // Main SMMA buffer
double SMMA_PriceBuffer[];   // Price buffer for SMMA calculations

// EMA buffers
double EMA_Buffer[];      // Main EMA buffer
double EMA_PriceBuffer[];  // Price buffer for EMA calculations

// Standard indicator buffers (for live data)
double ZigzagPeakBuffer[];
double ZigzagBottomBuffer[];
double ColorBuffer[];
double HighMapBuffer[];
double LowMapBuffer[];
double SMABuffer[];
double EMABuffer[];
double xHistoryBuffer[];

// File mode buffers (for file data)
double FileZigzagPeakBuffer[];
double FileZigzagBottomBuffer[];
double FileColorBuffer[];
double FileHighMapBuffer[];
double FileLowMapBuffer[];
double FileSMABuffer[];
double FileEMABuffer[];
double FilexHistoryBuffer[];

// Global variables
int    xExtRecalc = 3;        // Recalculation depth
double xExtLastPeak = 0;      // Last peak price
double xExtLastBottom = 0;    // Last bottom price

// File mode globals
bool     g_UsingFileData = false;
string   g_FileSymbol = "";        // Extracted symbol from filename
string   g_FileTimeframe = "";     // Extracted timeframe from filename
int      g_FileDigitsPrecision = 5;   // Default precision
double   g_FilePointSize = 0.00001;   // Default point size
int      g_FileDataSize = 0;       // Number of records in file data
bool     g_FileDataInitialized = false; // Flag for successful initialization

// Add these global variables at the top of your file
bool g_BatchModeActive = false;
int g_BatchSuccessCount = 0;
int g_BatchTotalCount = 0;
string g_CurrentBatchSymbol = "";    // Keep this for compatibility
string g_CurrentBatchTimeframe = ""; // Keep this for compatibility

// Global variables for X Value calculation in file mode
int g_FileAdjustedThreshold = 0;
datetime g_FileLastCalculationTime = 0;
string g_FileConfirmedTrend = "No Trend";
int g_FileConfirmedX = 0;
datetime g_FileTrendStartTime = 0;
int g_FileConfirmationBars = 0;

// Global variables for X Value
int adjustedThreshold;
datetime lastCalculationTime = 0;
int baseTimeframeMinutes;
string confirmedTrend = "No Trend";
int confirmedX = 0;
datetime trendStartTime = 0;

// Trend direction label
string trendLabel = "TrendDirection";

// Enumeration for search mode
enum xEnSearchMode
  {
   xExtremum = 0,  // Searching for the first extremum
   xPeak = 1,      // Searching for the next peak
   xBottom = -1    // Searching for the next bottom
  };


//+------------------------------------------------------------------+
//|   Validation Functions                                           |
//+------------------------------------------------------------------+
bool xIsValidPrice(double price)
  {
   return price > 0;  // Simplified validation
  }

//+------------------------------------------------------------------+
//| Create Export Button with improved styling                         |
//+------------------------------------------------------------------+
void CreateExportButton()
  {
// Delete existing button if it exists
   ObjectDelete(0, EXPORT_BUTTON_NAME);

// Create new button
   ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0);

// Button dimensions
   int button_width = 200;     // Keep wide button
   int button_height = 50;     // Keep tall button
   int x_margin = 250;          // Right margin (INCREASE TO MOVE BUTTON TO MORE LEFT)
   int y_margin = 100;         // Increased bottom margin to move button higher (DECREASE TO MOVE BUTTON TO LOWER)

// Position at right side, higher up from bottom
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, x_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, y_margin);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, button_height);

// Keep existing text and font properties
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Data");
   ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 11);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);

// Keep existing visual style
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, C'0,120,215');
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, C'0,100,190');

// Keep existing button behavior
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_LOWER);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 999);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
   ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);

// Create trend direction label - adjust X distance to move it more left
   ObjectCreate(0, trendLabel, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, trendLabel, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, trendLabel, OBJPROP_XDISTANCE, 600); // Increased from 350 to 600
   ObjectSetInteger(0, trendLabel, OBJPROP_YDISTANCE, 30);
   ObjectSetInteger(0, trendLabel, OBJPROP_FONTSIZE, 9);
  }

//+------------------------------------------------------------------+
//| Export Market Structure Analysis to all files                     |
//+------------------------------------------------------------------+
bool ExportMarketStructureData()
  {
// Display diagnostic info about the export operation
   Print("Starting export with data source: ",
         InpDataSource == DATA_SOURCE_FILE ? "File data" : "Live chart data");

// Variables for symbol and timeframe
   string symbolName = "";
   string timeframeName = "";

// Determine which symbol and timeframe to use for filenames
   if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
     {
      // Use file data symbols and timeframes
      symbolName = g_FileSymbol;
      timeframeName = g_FileTimeframe;

      Print("Exporting using file data source - Symbol: ", symbolName, ", Timeframe: ", timeframeName);

      if(ArraySize(xcollectedPoints) == 0)
        {
         Print("WARNING: No zigzag points collected from file to export");
         return false;
        }
     }
   else
     {
      // Use current chart symbol and timeframe
      symbolName = Symbol();
      timeframeName = EnumToString(Period());

      // Remove PERIOD_ prefix if present
      if(StringFind(timeframeName, "PERIOD_") == 0)
         timeframeName = StringSubstr(timeframeName, 7);

      Print("Exporting using live chart data - Symbol: ", symbolName, ", Timeframe: ", timeframeName);
     }

// Create base filenames with explicit naming for each file type
   string marketStructureJsonFile = "MarketStructureAnalysis_" + symbolName + "_" + timeframeName + ".json";
   string marketStructureTxtFile = "MarketStructureAnalysis_" + symbolName + "_" + timeframeName + ".txt";
   string bottomJsonFile = "Bottom_" + symbolName + "_" + timeframeName + ".json";
   string peakJsonFile = "Peak_" + symbolName + "_" + timeframeName + ".json";
   string bottomTxtFile = "Bottom_" + symbolName + "_" + timeframeName + ".txt";
   string peakTxtFile = "Peak_" + symbolName + "_" + timeframeName + ".txt";

// Log the filenames we're using
   Print("Using these export filenames:");
   Print(" - Market Structure JSON: ", marketStructureJsonFile);
   Print(" - Market Structure TXT: ", marketStructureTxtFile);
   Print(" - Bottom Points JSON: ", bottomJsonFile);
   Print(" - Peak Points JSON: ", peakJsonFile);
   Print(" - Bottom Points TXT: ", bottomTxtFile);
   Print(" - Peak Points TXT: ", peakTxtFile);

// Export to all formats using explicit filenames (no prefixes in function calls)
   bool json_success = ExportMarketStructureToJSON(marketStructureJsonFile);
   bool text_success = ExportMarketStructureToText(marketStructureTxtFile);
   bool bottom_json_success = ExportBottomPointsToJSON(bottomJsonFile);
   bool peak_json_success = ExportPeakPointsToJSON(peakJsonFile);
   bool bottom_text_success = ExportBottomPointsToText(bottomTxtFile);
   bool peak_text_success = ExportPeakPointsToText(peakTxtFile);

// Summarize export results
   Print("Export results:");
   Print("- Market Structure to JSON: ", json_success ? "Success" : "Failed");
   Print("- Market Structure to TEXT: ", text_success ? "Success" : "Failed");
   Print("- Bottom Points to JSON: ", bottom_json_success ? "Success" : "Failed");
   Print("- Bottom Points to TEXT: ", bottom_text_success ? "Success" : "Failed");
   Print("- Peak Points to JSON: ", peak_json_success ? "Success" : "Failed");
   Print("- Peak Points to TEXT: ", peak_text_success ? "Success" : "Failed");

   return json_success && text_success && bottom_json_success &&
          peak_json_success && bottom_text_success && peak_text_success;
  }

//+------------------------------------------------------------------+
//| Add batch processing function                                    |
//+------------------------------------------------------------------+
bool ProcessBatchFiles()
  {
   Print("Starting batch processing...");
   g_BatchModeActive = true;

// Parse symbol list
   string symbols[];
   StringSplit(InpBatchSymbols, ',', symbols);

// Parse timeframe list
   string timeframes[];
   StringSplit(InpBatchTimeframes, ',', timeframes);

   if(ArraySize(symbols) == 0 || ArraySize(timeframes) == 0)
     {
      Print("ERROR: Empty symbol or timeframe list for batch processing");
      g_BatchModeActive = false;
      return false;
     }

   Print("Processing ", ArraySize(symbols), " symbols with ", ArraySize(timeframes), " timeframes");

   int success_count = 0;
   int total_combinations = ArraySize(symbols) * ArraySize(timeframes);

// Process each symbol-timeframe combination
   for(int s = 0; s < ArraySize(symbols); s++)
     {
      string symbol = symbols[s];
      StringTrimLeft(symbol);
      StringTrimRight(symbol);

      for(int t = 0; t < ArraySize(timeframes); t++)
        {
         // Set current batch values
         g_CurrentBatchSymbol = symbol;
         g_CurrentBatchTimeframe = timeframes[t];

         Print("Processing ", s*ArraySize(timeframes) + t + 1, "/", total_combinations,
               ": Symbol='", g_CurrentBatchSymbol, "', Timeframe=", g_CurrentBatchTimeframe);

         // Process this file
         bool success = ProcessSingleFile();

         if(success)
           {
            success_count++;

            // Export data with correct filename pattern
            string export_base = "ZigZag_" + g_CurrentBatchSymbol + "_" + g_CurrentBatchTimeframe;
            bool export_success = ExportDataWithCustomName(export_base);

            if(!export_success)
              {
               Print("WARNING: Failed to export data for ", g_CurrentBatchSymbol, "_", g_CurrentBatchTimeframe);
              }
           }
         else
           {
            Print("WARNING: Failed to process ", g_CurrentBatchSymbol, "_", g_CurrentBatchTimeframe);
           }
        }
     }

   g_BatchModeActive = false;
   Print("Batch processing completed: ", success_count, "/", total_combinations, " successful");
   return success_count > 0;
  }

//+------------------------------------------------------------------+
//| Process single file using global settings                         |
//+------------------------------------------------------------------+
bool ProcessSingleFile()
  {
   Print("Processing file for Symbol=", g_CurrentBatchSymbol, ", Timeframe=", g_CurrentBatchTimeframe);
   Print("X Value threshold settings: Base=", InpXThreshold,
         ", File-adjusted=", g_FileAdjustedThreshold);

// Find the appropriate file
   string filename = FindOHLCDataFile();
   if(filename == "")
     {
      Print("ERROR: Source file not found");
      return false;
     }

// Load the data from file
   bool loadSuccess = LoadPriceData(filename);
   if(!loadSuccess)
     {
      Print("ERROR: Failed to load data from file: ", filename);
      return false;
     }

   Print("Successfully loaded data from ", filename);

// Process ZigZag data
   CalculateFileZigZag();
   CalculateXValuesFromFile(); // Make sure this is called before collecting points
   CollectFileZigZagPoints();

   return true;
  }

//+------------------------------------------------------------------+
//| Process single file with explicit parameters                      |
//+------------------------------------------------------------------+
bool ProcessSingleFile(string symbol, string timeframe)
  {
// Set globals and use the no-parameter version
   g_CurrentBatchSymbol = symbol;
   g_CurrentBatchTimeframe = timeframe;
   return ProcessSingleFile();
  }

//+------------------------------------------------------------------+
//| Export all data with custom filename                              |
//+------------------------------------------------------------------+
bool ExportDataWithCustomName(string baseName)
  {
// Create filenames
   string jsonFile = baseName + ".json";
   string txtFile = baseName;  // No extension for txt files

// Export market structure data
   bool msJson = ExportMarketStructureToJSON(jsonFile);
   bool msTxt = ExportMarketStructureToText(txtFile);

// Export bottom points
   string bottomJson = "Bottom_" + baseName + ".json";
   string bottomTxt = "Bottom_" + baseName;
   bool btJson = ExportBottomPointsToJSON(bottomJson);
   bool btTxt = ExportBottomPointsToText(bottomTxt);

// Export peak points
   string peakJson = "Peak_" + baseName + ".json";
   string peakTxt = "Peak_" + baseName;
   bool pkJson = ExportPeakPointsToJSON(peakJson);
   bool pkTxt = ExportPeakPointsToText(peakTxt);

   Print("Export results for ", baseName, ":");
   Print("- Market Structure to JSON: ", msJson ? "Success" : "Failed");
   Print("- Market Structure to TEXT: ", msTxt ? "Success" : "Failed");
   Print("- Bottom Points to JSON: ", btJson ? "Success" : "Failed");
   Print("- Bottom Points to TEXT: ", btTxt ? "Success" : "Failed");
   Print("- Peak Points to JSON: ", pkJson ? "Success" : "Failed");
   Print("- Peak Points to TEXT: ", pkTxt ? "Success" : "Failed");

   return msJson && msTxt && btJson && btTxt && pkJson && pkTxt;
  }

//+------------------------------------------------------------------+
//| Execute batch processing on multiple files                        |
//+------------------------------------------------------------------+
bool ProcessAllBatchFiles()
  {
   if(!InpEnableBatchMode)
     {
      Print("Batch mode is not enabled. Please enable it in settings.");
      return false;
     }

   Print("Starting batch processing...");
   g_BatchModeActive = true;

// Parse symbol list
   string symbols[];
   StringSplit(InpBatchSymbols, ',', symbols);

// Parse timeframe list
   string timeframes[];
   StringSplit(InpBatchTimeframes, ',', timeframes);

   g_BatchSuccessCount = 0;
   g_BatchTotalCount = ArraySize(symbols) * ArraySize(timeframes);

   Print("Will process ", g_BatchTotalCount, " combinations");

// Process each combination
   for(int s = 0; s < ArraySize(symbols); s++)
     {
      string symbol = symbols[s];
      StringTrimLeft(symbol);
      StringTrimRight(symbol);

      for(int t = 0; t < ArraySize(timeframes); t++)
        {
         g_CurrentBatchSymbol = symbol;
         g_CurrentBatchTimeframe = timeframes[t];

         Print("Processing ", (s * ArraySize(timeframes) + t + 1), "/", g_BatchTotalCount,
               ": Symbol='", g_CurrentBatchSymbol, "', Timeframe=", g_CurrentBatchTimeframe);

         bool success = ProcessSingleFile();
         if(success)
           {
            g_BatchSuccessCount++;

            // Export data with correct filename pattern
            string export_base = "ZigZag_" + g_CurrentBatchSymbol + "_" + g_CurrentBatchTimeframe;
            bool export_success = ExportDataWithCustomName(export_base);

            if(!export_success)
              {
               Print("WARNING: Failed to export data for ", g_CurrentBatchSymbol, "_", g_CurrentBatchTimeframe);
              }
           }
         else
           {
            Print("WARNING: Failed to process ", g_CurrentBatchSymbol, "_", g_CurrentBatchTimeframe);
           }
        }
     }

   g_BatchModeActive = false;

   Print("Batch processing completed: ", g_BatchSuccessCount, "/", g_BatchTotalCount, " successful");
   return g_BatchSuccessCount > 0;
  }

//+------------------------------------------------------------------+
//| Export Market Structure Analysis to JSON                         |
//+------------------------------------------------------------------+
bool ExportMarketStructureToJSON(string filename = "")
  {
// Use the passed filename or default to input parameter
   if(filename == "")
      filename = InpExportFileName;

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export market structure analysis to: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// Write JSON header
   write_success &= FileWrite(file_handle, "{") > 0;
   write_success &= FileWrite(file_handle, "    \"timestamp\": \"", TimeToString(TimeCurrent()), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"symbol\": \"", Symbol(), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"timeframe\": \"", EnumToString(Period()), "\",") > 0;
   write_success &= FileWrite(file_handle, "    \"marketStructureAnalysis\": [") > 0;

// Write market structure data
   int totalPoints = ArraySize(xcollectedPoints);
   for(int i = 0; i < totalPoints - 2; i++)
     {
      if(i > 0)
         FileWrite(file_handle, "        ,");

      double currentPrice = xcollectedPoints[i].price;
      double prevPrice = xcollectedPoints[i+1].price;
      double twoPrevPrice = xcollectedPoints[i+2].price;

      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100;
      int barCount = xcollectedPoints[i].bar - xcollectedPoints[i+1].bar;
      int barsWithDir = xcollectedPoints[i].isPeak ? barCount : -barCount;
      double pointsPerBar = barCount != 0 ? priceChange/barCount : 0;

      // Calculate market structure category
      double upperThreshold = twoPrevPrice * (1 + (xInpEqualThreshold / 100));
      double lowerThreshold = twoPrevPrice * (1 - (xInpEqualThreshold / 100));

      string firstStatus;
      if(currentPrice > upperThreshold)
         firstStatus = "Higher";
      else
         if(currentPrice < lowerThreshold)
            firstStatus = "Lower";
         else
            firstStatus = "Equal";

      string lastStatus = (currentPrice > prevPrice) ? "High" : "Low";

      string category;
      if(firstStatus == "Higher" && lastStatus == "High")
         category = "HH";
      else
         if(firstStatus == "Lower" && lastStatus == "Low")
            category = "LL";
         else
            if(firstStatus == "Higher" && lastStatus == "Low")
               category = "HL";
            else
               if(firstStatus == "Lower" && lastStatus == "High")
                  category = "LH";
               else
                  if(firstStatus == "Equal" && lastStatus == "High")
                     category = "EQH";
                  else
                     if(firstStatus == "Equal" && lastStatus == "Low")
                        category = "EQL";

      write_success &= FileWrite(file_handle, "        {") > 0;
      write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES), "\",") > 0;
      write_success &= FileWrite(file_handle, "            \"barIndex\": ", xcollectedPoints[i].bar, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"type\": \"", xcollectedPoints[i].isPeak ? "Peak" : "Bottom", "\",") > 0;
      write_success &= FileWrite(file_handle, "            \"currentPoint\": ", DoubleToString(currentPrice, 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"previousPoint\": ", DoubleToString(prevPrice, 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"twoPreviousPoint\": ", DoubleToString(twoPrevPrice, 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"priceChange\": ", DoubleToString(priceChange, 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"percentChange\": ", DoubleToString(percentChange, 2), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"bars\": ", barCount, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"barsWithDir\": ", barsWithDir, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"pointsPerBar\": ", DoubleToString(pointsPerBar, 5), ",") > 0;
      write_success &= FileWrite(file_handle, "            \"category\": \"", category, "\",") > 0;  // Added category field
      write_success &= FileWrite(file_handle, "            \"xValue\": ", xcollectedPoints[i].xValue, ",") > 0;
      write_success &= FileWrite(file_handle, "            \"trend\": \"", xcollectedPoints[i].trend, "\"") > 0;
      write_success &= FileWrite(file_handle, "        }") > 0;
     }

// Close JSON structure
   write_success &= FileWrite(file_handle, "    ]") > 0;
   write_success &= FileWrite(file_handle, "}") > 0;

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Export Market Structure Analysis to TEXT file                      |
//+------------------------------------------------------------------+
bool ExportMarketStructureToText(string filename = "")
  {
// Use the passed filename or default to input parameter
   if(filename == "")
      filename = StringSubstr(InpExportFileName, 0, StringFind(InpExportFileName, ".")) + ".txt";

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export market structure analysis to TEXT: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open TEXT file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// FIXED: Headers already include X Value and Trend
   write_success &= FileWrite(file_handle,
                              "No\tTimeStamp\tBarIndex\tType\tCurrentPoint\tPreviousPoint\tTwoPreviousPoint\t" +
                              "PriceChange\tPercentChange\tBars\tBarsWithDir\tPointsPerBar\tCategory\tX Value\tTrend") > 0;

// Write market structure data
   int totalPoints = ArraySize(xcollectedPoints);
   for(int i = 0; i < totalPoints - 2; i++)
     {
      double currentPrice = xcollectedPoints[i].price;
      double prevPrice = xcollectedPoints[i+1].price;
      double twoPrevPrice = xcollectedPoints[i+2].price;

      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100;
      int barCount = xcollectedPoints[i].bar - xcollectedPoints[i+1].bar;
      int barsWithDir = xcollectedPoints[i].isPeak ? barCount : -barCount;
      double pointsPerBar = barCount != 0 ? priceChange/barCount : 0;

      // Calculate market structure category as before
      double upperThreshold = twoPrevPrice * (1 + (xInpEqualThreshold / 100));
      double lowerThreshold = twoPrevPrice * (1 - (xInpEqualThreshold / 100));

      string firstStatus;
      if(currentPrice > upperThreshold)
         firstStatus = "Higher";
      else
         if(currentPrice < lowerThreshold)
            firstStatus = "Lower";
         else
            firstStatus = "Equal";

      string lastStatus = (currentPrice > prevPrice) ? "High" : "Low";

      string category;
      if(firstStatus == "Higher" && lastStatus == "High")
         category = "HH";
      else
         if(firstStatus == "Lower" && lastStatus == "Low")
            category = "LL";
         else
            if(firstStatus == "Higher" && lastStatus == "Low")
               category = "HL";
            else
               if(firstStatus == "Lower" && lastStatus == "High")
                  category = "LH";
               else
                  if(firstStatus == "Equal" && lastStatus == "High")
                     category = "EQH";
                  else
                     if(firstStatus == "Equal" && lastStatus == "Low")
                        category = "EQL";

      // Use stored X value and trend
      string line = StringFormat("%d\t%s\t%d\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.2f\t%d\t%d\t%.5f\t%s\t%d\t%s",
                                 i,
                                 TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES),
                                 xcollectedPoints[i].bar,
                                 xcollectedPoints[i].isPeak ? "Peak" : "Bottom",
                                 currentPrice,
                                 prevPrice,
                                 twoPrevPrice,
                                 priceChange,
                                 percentChange,
                                 barCount,
                                 barsWithDir,
                                 pointsPerBar,
                                 category,
                                 xcollectedPoints[i].xValue,
                                 xcollectedPoints[i].trend
                                );

      write_success &= FileWrite(file_handle, line) > 0;
     }

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to TEXT file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Export Bottom Points to JSON                                       |
//+------------------------------------------------------------------+
bool ExportBottomPointsToJSON(string filename = "")
  {
// Use the passed filename or default
   if(filename == "")
      filename = "Bottom_" + InpExportFileName;

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export bottom points to: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open bottom points file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// Write JSON header
   write_success &= FileWrite(file_handle, "{") > 0;
   write_success &= FileWrite(file_handle, "    \"bottomPoints\": [") > 0;

// Write bottom points data
   int totalPoints = ArraySize(xcollectedPoints);
   bool first_point = true;

   for(int i = 0; i < totalPoints; i++)
     {
      if(!xcollectedPoints[i].isPeak) // Only process bottom points
        {
         if(!first_point)
            FileWrite(file_handle, "        ,");
         first_point = false;

         write_success &= FileWrite(file_handle, "        {") > 0;
         write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES), "\",") > 0;
         write_success &= FileWrite(file_handle, "            \"barIndex\": ", xcollectedPoints[i].bar, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"type\": \"Bottom\",") > 0;
         write_success &= FileWrite(file_handle, "            \"currentPoint\": ", DoubleToString(xcollectedPoints[i].price, 2), ",") > 0;
         write_success &= FileWrite(file_handle, "            \"xValue\": ", xcollectedPoints[i].xValue, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"trend\": \"", xcollectedPoints[i].trend, "\"") > 0;
         write_success &= FileWrite(file_handle, "        }") > 0;
        }
     }

// Close JSON structure
   write_success &= FileWrite(file_handle, "    ]") > 0;
   write_success &= FileWrite(file_handle, "}") > 0;

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to bottom points file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Export Peak Points to JSON                                         |
//+------------------------------------------------------------------+
bool ExportPeakPointsToJSON(string filename = "")
  {
// Use the passed filename or default
   if(filename == "")
      filename = "Peak_" + InpExportFileName;

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export peak points to: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open peak points file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// Write JSON header
   write_success &= FileWrite(file_handle, "{") > 0;
   write_success &= FileWrite(file_handle, "    \"peakPoints\": [") > 0;

// Write peak points data
   int totalPoints = ArraySize(xcollectedPoints);
   bool first_point = true;

   for(int i = 0; i < totalPoints; i++)
     {
      if(xcollectedPoints[i].isPeak) // Only process peak points
        {
         if(!first_point)
            FileWrite(file_handle, "        ,");
         first_point = false;

         write_success &= FileWrite(file_handle, "        {") > 0;
         write_success &= FileWrite(file_handle, "            \"no\": ", i, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"timestamp\": \"", TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES), "\",") > 0;
         write_success &= FileWrite(file_handle, "            \"barIndex\": ", xcollectedPoints[i].bar, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"type\": \"Peak\",") > 0;
         write_success &= FileWrite(file_handle, "            \"currentPoint\": ", DoubleToString(xcollectedPoints[i].price, 2), ",") > 0;
         write_success &= FileWrite(file_handle, "            \"xValue\": ", xcollectedPoints[i].xValue, ",") > 0;
         write_success &= FileWrite(file_handle, "            \"trend\": \"", xcollectedPoints[i].trend, "\"") > 0;
         write_success &= FileWrite(file_handle, "        }") > 0;
        }
     }

// Close JSON structure
   write_success &= FileWrite(file_handle, "    ]") > 0;
   write_success &= FileWrite(file_handle, "}") > 0;

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to peak points file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Export Bottom Points to TEXT file                                  |
//+------------------------------------------------------------------+
bool ExportBottomPointsToText(string filename = "")
  {
// Use the passed filename or default
   if(filename == "")
      filename = "Bottom_" + StringSubstr(InpExportFileName, 0, StringFind(InpExportFileName, ".")) + ".txt";

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export bottom points to TEXT: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open bottom points TEXT file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// Write header
   write_success &= FileWrite(file_handle,
                              "No\tTimeStamp\tBarIndex\tType\tCurrentPoint\tX Value\tTrend") > 0;

// Write bottom points data
   int totalPoints = ArraySize(xcollectedPoints);
   int pointCount = 0;

   for(int i = 0; i < totalPoints; i++)
     {
      if(!xcollectedPoints[i].isPeak) // Only process bottom points
        {
         string line = StringFormat("%d\t%s\t%d\t%s\t%.2f\t%d\t%s",
                                    pointCount,
                                    TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES),
                                    xcollectedPoints[i].bar,
                                    "Bottom",
                                    xcollectedPoints[i].price,
                                    xcollectedPoints[i].xValue,
                                    xcollectedPoints[i].trend
                                   );

         write_success &= FileWrite(file_handle, line) > 0;
         pointCount++;
        }
     }

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to bottom points TEXT file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Export Peak Points to TEXT file                                    |
//+------------------------------------------------------------------+
bool ExportPeakPointsToText(string filename = "")
  {
// Use the passed filename or default
   if(filename == "")
      filename = "Peak_" + StringSubstr(InpExportFileName, 0, StringFind(InpExportFileName, ".")) + ".txt";

   string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("Attempting to export peak points to TEXT: ", full_path);

   int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
   if(file_handle == INVALID_HANDLE)
     {
      Print("ERROR: Failed to open peak points TEXT file for writing. Error code: ", GetLastError());
      return false;
     }

   bool write_success = true;

// Write header
   write_success &= FileWrite(file_handle,
                              "No\tTimeStamp\tBarIndex\tType\tCurrentPoint\tX Value\tTrend") > 0;

// Write peak points data
   int totalPoints = ArraySize(xcollectedPoints);
   int pointCount = 0;

   for(int i = 0; i < totalPoints; i++)
     {
      if(xcollectedPoints[i].isPeak) // Only process peak points
        {
         string line = StringFormat("%d\t%s\t%d\t%s\t%.2f\t%d\t%s",
                                    pointCount,
                                    TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES),
                                    xcollectedPoints[i].bar,
                                    "Peak",
                                    xcollectedPoints[i].price,
                                    xcollectedPoints[i].xValue,
                                    xcollectedPoints[i].trend
                                   );

         write_success &= FileWrite(file_handle, line) > 0;
         pointCount++;
        }
     }

   FileClose(file_handle);

   if(!write_success)
     {
      Print("ERROR: Failed to write some data to peak points TEXT file");
      return false;
     }

   Print("Successfully exported to: ", filename);
   return true;
  }

//+------------------------------------------------------------------+
//| Calculate SMA and EMA from file data                            |
//+------------------------------------------------------------------+
void CalculateSMAandEMAFromFile()
  {
   int fileSize = ArraySize(FileData);
   int smaPeriod = SMMA_Period;
   int emaPeriod = EMA_Period;

// Calculate SMA
   for(int i = smaPeriod-1; i < fileSize; i++)
     {
      double sum = 0;
      for(int j = 0; j < smaPeriod; j++)
        {
         sum += FileData[i-j].close;
        }
      FileSMABuffer[i] = sum / smaPeriod;
     }

// Calculate EMA
// First EMA value is SMA
   double sum = 0;
   for(int i = 0; i < emaPeriod; i++)
     {
      sum += FileData[i].close;
     }
   FileEMABuffer[emaPeriod-1] = sum / emaPeriod;

// Calculate rest of EMA values
   double alpha = 2.0 / (emaPeriod + 1);
   for(int i = emaPeriod; i < fileSize; i++)
     {
      FileEMABuffer[i] = alpha * FileData[i].close + (1 - alpha) * FileEMABuffer[i-1];
     }

   Print("File SMA and EMA calculated");
  }

//+------------------------------------------------------------------+
//| Calculate X Values from file data                                |
//+------------------------------------------------------------------+
void CalculateXValuesFromFile()
  {
   int fileSize = ArraySize(FileData);

// Initialize counters and state variables
   int lastState = 0;
   int x = 0;
   datetime lastBarTime = 0;

   Print("Calculating X values from file data...");
   Print("File adjusted threshold: ", g_FileAdjustedThreshold,
         ", Confirmation bars: ", g_FileConfirmationBars);

// Calculate X values
   for(int i = 0; i < fileSize; i++)
     {
      // Determine state based on EMA/SMA crossover
      int currentState = (i >= SMMA_Period && i >= EMA_Period) ?
                         (FileEMABuffer[i] > FileSMABuffer[i] ? 1 : -1) : 0;

      // New bar logic
      if(FileData[i].time > lastBarTime)
        {
         lastBarTime = FileData[i].time;

         if(currentState != lastState && lastState != 0)
           {
            // Reset X on state change
            x = 0;
            g_FileTrendStartTime = FileData[i].time;
           }
         else
            if(currentState != 0)
              {
               // Increment X if state is consistent
               x++;
              }
        }

      // Store X value
      FilexHistoryBuffer[i] = x;

      // Determine trend with proper confirmation
      string currentTrend = "No Trend";
      if(x > g_FileAdjustedThreshold)
        {
         currentTrend = (currentState > 0) ? "Uptrend" : "Downtrend";

         // Apply time-based confirmation
         if(FileData[i].time >= g_FileTrendStartTime +
            (PeriodSeconds(InpBaseTimeframe) * g_FileConfirmationBars))
           {
            g_FileConfirmedTrend = currentTrend;
            g_FileConfirmedX = x;
           }
        }
      else
        {
         // Reset trend when X drops below threshold/2
         if(g_FileConfirmedTrend != "No Trend" && x <= g_FileAdjustedThreshold / 2)
           {
            g_FileConfirmedTrend = "No Trend";
            g_FileConfirmedX = 0;
           }
        }

      // Store last state for next iteration
      lastState = currentState;
     }

   Print("File X values calculated. Last confirmed trend: ", g_FileConfirmedTrend);
  }

//+------------------------------------------------------------------+
//| Calculate SMMA using the original methodology                    |
//+------------------------------------------------------------------+
void CalculateSMMA(int rates_total, int prev_calculated)
  {
   int i, start;

// First calculation or number of bars was changed
   if(prev_calculated == 0)
     {
      // Set start position
      start = SMMA_Period;

      // Set empty values for first bars
      for(i = 0; i < start - 1; i++)
         SMMA_Buffer[i] = 0.0;

      // Calculate first visible value
      double first_value = 0;
      for(i = 0; i < start; i++)
         first_value += SMMA_PriceBuffer[i];

      first_value /= SMMA_Period;
      SMMA_Buffer[start - 1] = first_value;
     }
   else
     {
      start = prev_calculated - 1;
     }

// Main calculation loop with original SMMA formula
   for(i = start; i < rates_total && !IsStopped(); i++)
     {
      SMMA_Buffer[i] = (SMMA_Buffer[i - 1] * (SMMA_Period - 1) + SMMA_PriceBuffer[i]) / SMMA_Period;
     }
  }

//+------------------------------------------------------------------+
//| Calculate EMA using the original methodology                     |
//+------------------------------------------------------------------+
void CalculateEMA(int rates_total, int start)
  {
   static bool first_calculation = true;
   double alpha = 2.0 / (EMA_Period + 1);

// Initialize first value if needed
   if(first_calculation && start == 0)
     {
      double sum = 0;
      // Calculate simple average for the first EMA value
      for(int i = 0; i < EMA_Period && i < rates_total; i++)
        {
         sum += EMA_PriceBuffer[i];
        }
      EMA_Buffer[0] = sum / EMA_Period;
      start = 1;
      first_calculation = false;
     }

// Make sure we don't access negative indices
   if(start < 1)
      start = 1;

// Calculate EMA using the original methodology
   for(int i = start; i < rates_total; i++)
     {
      if(i >= 1) // Additional safety check
        {
         EMA_Buffer[i] = (EMA_PriceBuffer[i] - EMA_Buffer[i-1]) * alpha + EMA_Buffer[i-1];
        }
     }
  }

//+------------------------------------------------------------------+
//| Get applied price based on enum                                  |
//+------------------------------------------------------------------+
double GetAppliedPrice(ENUM_APPLIED_PRICE applied_price, double open, double high, double low, double close)
  {
   switch(applied_price)
     {
      case PRICE_CLOSE:
         return close;
      case PRICE_OPEN:
         return open;
      case PRICE_HIGH:
         return high;
      case PRICE_LOW:
         return low;
      case PRICE_MEDIAN:
         return (high + low) / 2.0;
      case PRICE_TYPICAL:
         return (high + low + close) / 3.0;
      case PRICE_WEIGHTED:
         return (high + low + close + close) / 4.0;
      default:
         return close;
     }
  }


//+------------------------------------------------------------------+
//| Find OHLC data file based on global settings or parameters        |
//+------------------------------------------------------------------+
string FindOHLCDataFile()
  {
// Use globals to determine target symbol and timeframe
   string targetSymbol = g_BatchModeActive ? g_CurrentBatchSymbol :
                         (InpPreferredSymbol != "" ? InpPreferredSymbol : Symbol());

   string targetTimeframe = g_BatchModeActive ? g_CurrentBatchTimeframe :
                            (InpPreferredTimeframe != "" ? InpPreferredTimeframe : EnumToString(Period()));

   return FindOHLCDataFile(targetSymbol, targetTimeframe);
  }

//+------------------------------------------------------------------+
//| Find OHLC data file with explicit parameters                      |
//+------------------------------------------------------------------+
string FindOHLCDataFile(string targetSymbol, string targetTimeframe)
  {
   string filePath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\";
   Print("Looking for file in: ", filePath);

// Normalize timeframe (remove PERIOD_ prefix if present)
   if(StringFind(targetTimeframe, "PERIOD_") == 0)
     {
      targetTimeframe = StringSubstr(targetTimeframe, 7);
     }

// Format exact filename to search for
   string exactFilename = "PriceData_" + targetSymbol + "_" + targetTimeframe;
   string filenameWithExt = exactFilename + ".txt";

   Print("Trying to find: ", exactFilename, " or ", filenameWithExt);

// First try without extension
   int handle = FileOpen(exactFilename, FILE_READ|FILE_TXT);
   if(handle != INVALID_HANDLE)
     {
      FileClose(handle);
      Print("Found file: ", exactFilename);
      return exactFilename;
     }

// Then try with .txt extension
   handle = FileOpen(filenameWithExt, FILE_READ|FILE_TXT);
   if(handle != INVALID_HANDLE)
     {
      FileClose(handle);
      Print("Found file: ", filenameWithExt);
      return filenameWithExt;
     }

   Print("ERROR: Could not find file for ", targetSymbol, " @ ", targetTimeframe);
   return "";
  }

//+------------------------------------------------------------------+
//| Extract symbol and timeframe from filename                       |
//+------------------------------------------------------------------+
bool ExtractSymbolAndTimeframe(string fileName)
  {
// Expected format: PriceData_SYMBOL_TIMEFRAME.txt or .json

// First, remove file extension
   int dotPos = StringFind(fileName, ".");
   if(dotPos > 0)
     {
      fileName = StringSubstr(fileName, 0, dotPos);
     }

// Split by underscore
   string parts[];
   int count = StringSplit(fileName, '_', parts);

   if(count < 3)
     {
      Print("ERROR: Filename format not recognized: ", fileName);
      return false;
     }

// Extract parts (assuming PriceData_SYMBOL_TIMEFRAME format)
   g_FileSymbol = parts[1];
   g_FileTimeframe = parts[2];

   Print("Extracted Symbol: ", g_FileSymbol, ", Timeframe: ", g_FileTimeframe);

// Set precision based on symbol type
   if(StringFind(g_FileSymbol, "JPY") >= 0)
     {
      g_FileDigitsPrecision = 3;
      g_FilePointSize = 0.001;
     }
   else
      if(StringFind(g_FileSymbol, "BTC") >= 0 || StringFind(g_FileSymbol, "XBT") >= 0)
        {
         g_FileDigitsPrecision = 2;
         g_FilePointSize = 0.01;
        }
      else
         if(StringFind(g_FileSymbol, "ETH") >= 0 || StringFind(g_FileSymbol, "XRP") >= 0)
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
   string filePath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + fileName;
   Print("Loading price data from: ", filePath);

// Extract symbol and timeframe from filename
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

// Read header information (skip metadata lines)
   string line = "";
   bool headerFound = false;

// Skip initial metadata lines
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

// Count data lines
   int lineCount = 0;
   long filePos = FileTell(fileHandle);

   while(!FileIsEnding(fileHandle))
     {
      line = FileReadString(fileHandle);
      if(StringLen(line) > 0)
        {
         lineCount++;
        }
     }

// Reset file position to start of data
   FileSeek(fileHandle, filePos, SEEK_SET);

// Allocate arrays
   ArrayResize(FileData, lineCount);
   g_FileDataSize = lineCount;
   Print("Found ", lineCount, " price data records");

// Read data lines
   for(int i = 0; i < lineCount && !FileIsEnding(fileHandle); i++)
     {
      line = FileReadString(fileHandle);

      string parts[];
      int count = StringSplit(line, '\t', parts);

      if(count < 6)
        {
         Print("WARNING: Invalid data line: ", line);
         continue;
        }

      // Parse data into structure
      FileData[i].index = (int)StringToInteger(parts[0]);
      FileData[i].time = StringToTime(parts[1]);
      FileData[i].open = StringToDouble(parts[2]);
      FileData[i].high = StringToDouble(parts[3]);
      FileData[i].low = StringToDouble(parts[4]);
      FileData[i].close = StringToDouble(parts[5]);

      // Debug output for the first few records
      if(i < 3)
        {
         Print("Loaded record ", i, ": Time=", TimeToString(FileData[i].time),
               ", High=", FileData[i].high, ", Low=", FileData[i].low);
        }
     }

   FileClose(fileHandle);
   Print("Successfully loaded ", ArraySize(FileData), " price data records");

   return true;
  }

//+------------------------------------------------------------------+
//| Initialize data from file                                        |
//+------------------------------------------------------------------+
bool InitializeFromFile()
  {
// Find source file
   string sourceFile = FindOHLCDataFile();
   if(sourceFile == "")
     {
      Print("ERROR: No source file found");
      return false;
     }

// Load price data
   if(!LoadPriceData(sourceFile))
     {
      Print("ERROR: Failed to load price data from file");
      return false;
     }

// Allocate memory for file mode buffers based on loaded data size
   int dataSize = ArraySize(FileData);

   ArrayResize(FileZigzagPeakBuffer, dataSize);
   ArrayResize(FileZigzagBottomBuffer, dataSize);
   ArrayResize(FileColorBuffer, dataSize);
   ArrayResize(FileHighMapBuffer, dataSize);
   ArrayResize(FileLowMapBuffer, dataSize);
   ArrayResize(FileSMABuffer, dataSize);
   ArrayResize(FileEMABuffer, dataSize);
   ArrayResize(FilexHistoryBuffer, dataSize);

// Initialize file buffers with zeros
   ArrayInitialize(FileZigzagPeakBuffer, 0.0);
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   ArrayInitialize(FileSMABuffer, 0.0);
   ArrayInitialize(FileEMABuffer, 0.0);
   ArrayInitialize(FilexHistoryBuffer, 0.0);

   Print("File data buffers initialized with size: ", dataSize);

// Calculate file-specific adjusted threshold
   int baseMinutes = PeriodSeconds(InpBaseTimeframe) / 60;
   int currentMinutes = 0;

// Determine timeframe in minutes from file timeframe string
   if(g_FileTimeframe == "M1")
      currentMinutes = 1;
   else
      if(g_FileTimeframe == "M5")
         currentMinutes = 5;
      else
         if(g_FileTimeframe == "M15")
            currentMinutes = 15;
         else
            if(g_FileTimeframe == "M30")
               currentMinutes = 30;
            else
               if(g_FileTimeframe == "H1")
                  currentMinutes = 60;
               else
                  if(g_FileTimeframe == "H4")
                     currentMinutes = 240;
                  else
                     if(g_FileTimeframe == "D1")
                        currentMinutes = 1440;
                     else
                        currentMinutes = 60; // Default

// Calculate adjusted threshold with proper protection against division by zero
   g_FileAdjustedThreshold = (currentMinutes > 0) ?
                             (int)MathRound(InpXThreshold * (baseMinutes / (double)currentMinutes)) :
                             InpXThreshold;

// Also calculate confirmation bars adjusted for timeframe
   g_FileConfirmationBars = (currentMinutes > 0) ?
                            (int)MathRound(InpConfirmationBars * (baseMinutes / (double)currentMinutes)) :
                            InpConfirmationBars;

   Print("File mode threshold calculation: Base timeframe minutes=", baseMinutes,
         ", Current timeframe minutes=", currentMinutes,
         ", Adjusted threshold=", g_FileAdjustedThreshold,
         ", Adjusted confirmation bars=", g_FileConfirmationBars);

   return true;
  }

//+------------------------------------------------------------------+
//| Custom indicator initialization function                           |
//+------------------------------------------------------------------+
int OnInit()
  {

// Validate input parameters
   if(xInpDepth < 2 || xInpBackstep < 1 || xInpDeviation < 0)
      return INIT_PARAMETERS_INCORRECT;

// Validate Equal threshold input
   if(xInpEqualThreshold <= 0 || xInpEqualThreshold > 1.00)
     {
      Print("Equal threshold must be between 0.00% and 1.00%");
      return INIT_PARAMETERS_INCORRECT;
     }

// Clear all buffers
   ArrayInitialize(xZigzagPeakBuffer, 0.0);
   ArrayInitialize(xZigzagBottomBuffer, 0.0);
   ArrayInitialize(xColorBuffer, 0.0);
   ArrayInitialize(xHighMapBuffer, 0.0);
   ArrayInitialize(xLowMapBuffer, 0.0);
   ArrayInitialize(SMABuffer, 0.0);
   ArrayInitialize(EMABuffer, 0.0);
   ArrayInitialize(xHistoryBuffer, 0.0);

// Set indicator properties
   SetIndexBuffer(0, xZigzagPeakBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, xZigzagBottomBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, xColorBuffer, INDICATOR_COLOR_INDEX);
   SetIndexBuffer(3, SMMA_Buffer, INDICATOR_DATA);
   SetIndexBuffer(4, EMA_Buffer, INDICATOR_DATA);
   SetIndexBuffer(5, xHighMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(6, xLowMapBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(7, SMMA_PriceBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(8, EMA_PriceBuffer, INDICATOR_CALCULATIONS);
   SetIndexBuffer(9, xHistoryBuffer, INDICATOR_CALCULATIONS); // Changed to xHistoryBuffer

// Set indicator digits and drawing properties
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 2);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 0, xInpBullColor);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, 1, xInpBearColor);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

// Set SMMA indicator properties
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, SMMA_Color);
   PlotIndexSetInteger(1, PLOT_LINE_WIDTH, SMMA_Width);
   PlotIndexSetInteger(1, PLOT_LINE_STYLE, SMMA_Style);
   PlotIndexSetInteger(1, PLOT_DRAW_BEGIN, SMMA_Period - 1);
   PlotIndexSetInteger(1, PLOT_SHIFT, SMMA_Shift);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, 0.0);

// Set EMA indicator properties
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(2, PLOT_LINE_COLOR, EMA_Color);
   PlotIndexSetInteger(2, PLOT_LINE_WIDTH, EMA_Width);
   PlotIndexSetInteger(2, PLOT_LINE_STYLE, EMA_Style);
   PlotIndexSetInteger(2, PLOT_DRAW_BEGIN, EMA_Period - 1);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, 0.0);

// Set indicator name
   string short_name = StringFormat("ZigZagColor(%d,%d,%d)", xInpDepth, xInpDeviation, xInpBackstep);
   IndicatorSetString(INDICATOR_SHORTNAME, short_name);
   PlotIndexSetString(0, PLOT_LABEL, short_name);

// Set SMMA name
   string smma_name = StringFormat("SMMA(%d)", SMMA_Period);
   PlotIndexSetString(1, PLOT_LABEL, smma_name);

// Set EMA name
   string ema_name = StringFormat("EMA(%d)", EMA_Period);
   PlotIndexSetString(2, PLOT_LABEL, ema_name);

// Calculate adjusted threshold
   adjustedThreshold = (int)MathRound(InpXThreshold * (PeriodSeconds(InpBaseTimeframe) / PeriodSeconds()));
   Print("Adjusted X threshold for current timeframe: ", adjustedThreshold);

// Initialize base timeframe
   baseTimeframeMinutes = PeriodSeconds(InpBaseTimeframe) / 60;

// Create trend direction label
   ObjectCreate(0, trendLabel, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, trendLabel, OBJPROP_CORNER, CORNER_RIGHT_LOWER);
   ObjectSetInteger(0, trendLabel, OBJPROP_XDISTANCE, 150);
   ObjectSetInteger(0, trendLabel, OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, trendLabel, OBJPROP_FONTSIZE, 9);

   CreateExportButton();

// Initialize from file data if needed
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

// Add batch mode initialization
   if(InpEnableBatchMode)
     {
      Print("Batch mode enabled - will process multiple files when 'Export Data' button is clicked");
      // We don't automatically process here, just wait for button click
     }

// Log threshold calculation for live data
   Print("Live data threshold calculation: Base minutes=", baseTimeframeMinutes,
         ", Chart minutes=", PeriodSeconds()/60,
         ", Adjusted threshold=", adjustedThreshold);

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Modified OnChartEvent to handle batch processing                  |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
// Check if it's a button click event
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == EXPORT_BUTTON_NAME)
     {
      // Handle button click differently based on batch mode
      if(InpEnableBatchMode)
        {
         Print("Batch mode enabled - processing all configured files...");
         ProcessAllBatchFiles();
        }
      else
        {
         // Normal single file export with current settings
         if(ExportMarketStructureData())
            Print("Data exported successfully to both JSON and TEXT files");
         else
            Print("Failed to export data");
        }

      // Reset button state
      ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
     }
  }

//+------------------------------------------------------------------+
//| Calculate X and Trend Direction with Time-based Confirmation     |
//+------------------------------------------------------------------+
void CalculateHistoricalXValues(const int rates_total, const int prev_calculated, const datetime &time[])
  {

// Add threshold debug info
   if(prev_calculated == 0 || TimeLocal() - lastCalculationTime > 3600) // Once per hour
     {
      Print("Live data X calculation with threshold=", adjustedThreshold,
            ", Base timeframe=", EnumToString(InpBaseTimeframe),
            ", Current timeframe=", EnumToString(Period()));
      lastCalculationTime = TimeLocal();
     }

   static int last_state = 0;
   static int x = 0;
   static datetime last_bar_time = 0;

// Determine starting point for calculation
   int start = 0;
   if(prev_calculated > 0)
     {
      start = MathMax(0, prev_calculated - 50);

      // Recover previous state if available
      if(start > 0)
        {
         for(int i = start - 1; i >= 0; i--)
           {
            if(xHistoryBuffer[i] > 0)
              {
               x = (int)xHistoryBuffer[i];
               last_state = EMA_Buffer[i] > SMMA_Buffer[i] ? 1 : -1;
               last_bar_time = time[i];
               break;
              }
           }
        }
     }

// Calculate X values for each bar
   for(int i = start; i < rates_total; i++)
     {
      int current_state = EMA_Buffer[i] > SMMA_Buffer[i] ? 1 : -1;

      // Check for new bar or state change
      if(time[i] > last_bar_time)
        {
         last_bar_time = time[i];

         if(current_state != last_state)
           {
            x = 0;
            trendStartTime = time[i];
           }
         else
           {
            x++;
           }
        }

      // Store X value for this bar
      xHistoryBuffer[i] = x;
      last_state = current_state;

      // Determine trend direction with time-based confirmation
      string currentTrend;
      if(x > adjustedThreshold)
        {
         if(current_state > 0)
            currentTrend = "Uptrend";
         else
            currentTrend = "Downtrend";

         // Check if the trend has persisted for the required number of bars
         if(time[i] >= trendStartTime + PeriodSeconds(InpBaseTimeframe) * InpConfirmationBars)
           {
            confirmedTrend = currentTrend;
            confirmedX = x;
           }
        }
      else
        {
         currentTrend = "No Trend";
         if(confirmedTrend != "No Trend" && x <= adjustedThreshold / 2)
           {
            confirmedTrend = "No Trend";
            confirmedX = 0;
           }
        }

      // Update trend direction label for the most recent bar
      if(i == rates_total - 1)
        {
         string labelText = StringFormat("Confirmed Trend: %s\nX = %d\nThreshold: %d", confirmedTrend, confirmedX, adjustedThreshold);
         ObjectSetString(0, trendLabel, OBJPROP_TEXT, labelText);
         color labelColor = confirmedTrend == "Uptrend" ? clrGreen : (confirmedTrend == "Downtrend" ? clrRed : clrGray);
         ObjectSetInteger(0, trendLabel, OBJPROP_COLOR, labelColor);
        }
     }
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                                |
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
// Explicitly check and resize live data buffers at the beginning
   CheckAndResizeLiveDataBuffers(rates_total);

// File Data Mode
   if(InpDataSource == DATA_SOURCE_FILE && g_FileDataInitialized)
     {
      if(prev_calculated == 0)
        {
         // Simply call our unified calculation function
         CalculateFileZigZag();

         // After calculating ZigZag points, collect them
         CollectFileZigZagPoints();

         return rates_total;
        }
     }

// Validate data
   if(rates_total < xInpDepth)
      return 0;

// Check for valid price data - only check the necessary range
   int checkStart = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   for(int i = checkStart; i < rates_total && i < checkStart + xInpDepth * 2; i++)
     {
      if(high[i] <= 0 || low[i] <= 0 || !MathIsValidNumber(high[i]) || !MathIsValidNumber(low[i]))
        {
         Print("Price validation: High=", high[i], " Low=", low[i], " at bar ", i);
         return 0;
        }
     }

// Add basic safeguard checks
   if(!ValidateBuffers())
      return 0;

// Initialize variables
   int start = InitializeCalculation(rates_total, prev_calculated);
   if(start < 0)
      return 0;

// Calculate only for new bars or recalculation
   if(prev_calculated > 0)
     {
      // Process only the last 3 bars for updating
      start = MathMax(prev_calculated - 3, xInpDepth - 1);
     }

// Main calculation loop
   CalculateZigZag(rates_total, start, high, low, prev_calculated);

// Calculate SMMA price buffer
   for(int i = 0; i < rates_total; i++)
     {
      SMMA_PriceBuffer[i] = GetAppliedPrice(SMMA_AppliedPrice, open[i], high[i], low[i], close[i]);
     }

// Calculate SMMA
   CalculateSMMA(rates_total, prev_calculated);

// Calculate EMA price buffer
   for(int i = 0; i < rates_total; i++)
     {
      EMA_PriceBuffer[i] = GetAppliedPrice(EMA_AppliedPrice, open[i], high[i], low[i], close[i]);
     }

// Calculate EMA
   int ema_start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   CalculateEMA(rates_total, ema_start);

// Calculate Historical X Values and Trend Direction
   CalculateHistoricalXValues(rates_total, prev_calculated, time);

// Update price labels less frequently
   static datetime last_update = 0;
   if(xInpShowPrice && (TimeLocal() - last_update > 1))  // Update every second
     {
      UpdatePriceLabels(rates_total, time);
      last_update = TimeLocal();
     }

// Add debug print at the end
   static datetime last_debug_print = 0;
   if(xInpDebugMode && TimeLocal() - last_debug_print > 1500)  // Print every 15 minute
     {
      DebugPrintBuffers();
      DebugPrintSafeguardChecks();  // Add new debug output
      DebugPrintValidationSteps();  // New validation steps check
      CollectValidPoints(time);  // Pass time array to collection process
      DebugPrintSegmentAnalysis();  // Add the new segment analysis
      CalculateMarketStructure();  // Add this new function
      last_debug_print = TimeLocal();
     }

   return rates_total;
  }

//+------------------------------------------------------------------+
//| Map file data to indicator buffers                               |
//+------------------------------------------------------------------+
void MapFileDataToBuffers(const int rates_total, const datetime &chart_time[])
  {
// Use the unified data buffers
   ArrayInitialize(FileZigzagPeakBuffer, 0.0);  // Use file buffers, not live buffers!
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);

// Just call our unified function instead
   CalculateFileZigZag();

   Print("File data mapped to buffers using unified algorithm");
  }

//+------------------------------------------------------------------+
//| Unified high/low map calculation for both data sources           |
//+------------------------------------------------------------------+
void UnifiedCalculateHighLowMaps(const int index,
                                 const double &high[], const double &low[],
                                 const int depth,
                                 double &highMapBuffer[], double &lowMapBuffer[])
  {

// BOUNDARY CHECKING - Add this at the start of the function
   int highSize = ArraySize(high);
   int lowSize = ArraySize(low);
   int highMapBufferSize = ArraySize(highMapBuffer);
   int lowMapBufferSize = ArraySize(lowMapBuffer);

// Check if the index is valid for all arrays
   if(index < 0 || index >= highSize || index >= lowSize ||
      index >= highMapBufferSize || index >= lowMapBufferSize)
     {

      // Log detailed error info
      Print("ARRAY BOUNDS ERROR in UnifiedCalculateHighLowMaps:");
      Print("  Attempted to access index: ", index);
      Print("  high[] size: ", highSize);
      Print("  low[] size: ", lowSize);
      Print("  highMapBuffer[] size: ", highMapBufferSize);
      Print("  lowMapBuffer[] size: ", lowMapBufferSize);

      // Exit function without causing crash
      return;
     }

// Calculate high map using the SAME algorithm as live data
   double highVal = UnifiedHighest(high, depth, index);
   if(high[index] == highVal)
     {
      highMapBuffer[index] = high[index];
     }
   else
     {
      highMapBuffer[index] = 0.0;
     }

// Calculate low map using the SAME algorithm as live data
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

// BOUNDARY CHECK
   int arraySize = ArraySize(array);
   if(start < 0 || start >= arraySize)
     {
      Print("Error in UnifiedHighest: Index ", start, " out of bounds (array size: ", arraySize, ")");
      return 0.0; // Return safe default
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
//| Compare ZigZag calculations between live and file modes           |
//+------------------------------------------------------------------+
void CompareZigZagCalculations(const double &highValues[], const double &lowValues[], int dataSize)
  {
// Temporary buffers for comparison
   double tempZigzagPeakBuffer[];
   double tempZigzagBottomBuffer[];
   double tempColorBuffer[];
   double tempHighMapBuffer[];
   double tempLowMapBuffer[];

// Resize temp buffers
   ArrayResize(tempZigzagPeakBuffer, dataSize);
   ArrayResize(tempZigzagBottomBuffer, dataSize);
   ArrayResize(tempColorBuffer, dataSize);
   ArrayResize(tempHighMapBuffer, dataSize);
   ArrayResize(tempLowMapBuffer, dataSize);

// Initialize temp buffers
   ArrayInitialize(tempZigzagPeakBuffer, 0.0);
   ArrayInitialize(tempZigzagBottomBuffer, 0.0);
   ArrayInitialize(tempColorBuffer, 0.0);
   ArrayInitialize(tempHighMapBuffer, 0.0);
   ArrayInitialize(tempLowMapBuffer, 0.0);

   Print("=== Starting ZigZag Calculation Comparison ===");

// First use live mode calculation on file data
   Print("Running live calculation method on file data...");

// Variables needed for live algorithm
   int extreme_search_live = xExtremum;
   double last_high_live = 0, last_low_live = 0;
   int last_high_pos_live = 0, last_low_pos_live = 0;

// Run live mode algorithm
   for(int i = xInpDepth-1; i < dataSize; i++)
     {
      // Calculate high/low maps using live method
      double highVal = Highest(highValues, xInpDepth, i);
      if(highValues[i] == highVal)
        {
         tempHighMapBuffer[i] = highValues[i];
        }

      double lowVal = Lowest(lowValues, xInpDepth, i);
      if(lowValues[i] == lowVal)
        {
         tempLowMapBuffer[i] = lowValues[i];
        }

      // Use FindExtremes logic from live mode
      switch(extreme_search_live)
        {
         case xExtremum:  // Initial search for any extremum
            if(last_low_live == 0 && last_high_live == 0)
              {
               if(tempHighMapBuffer[i] != 0)
                 {
                  last_high_live = highValues[i];
                  last_high_pos_live = i;
                  extreme_search_live = xBottom;  // Look for a bottom next
                  tempZigzagPeakBuffer[i] = last_high_live;
                  tempColorBuffer[i] = 0;
                 }
               else
                  if(tempLowMapBuffer[i] != 0)
                    {
                     last_low_live = lowValues[i];
                     last_low_pos_live = i;
                     extreme_search_live = xPeak;  // Look for a peak next
                     tempZigzagBottomBuffer[i] = last_low_live;
                     tempColorBuffer[i] = 1;
                    }
              }
            break;

         case xPeak:  // Looking for peak
            if(tempHighMapBuffer[i] != 0)  // Found a potential peak
              {
               last_high_live = highValues[i];
               last_high_pos_live = i;
               tempZigzagPeakBuffer[i] = last_high_live;
               tempColorBuffer[i] = 0;
               extreme_search_live = xBottom;  // Switch to looking for bottom
              }
            else
               if(tempLowMapBuffer[i] != 0 && lowValues[i] < last_low_live)  // Found a lower bottom
                 {
                  tempZigzagBottomBuffer[last_low_pos_live] = 0.0;  // Remove old bottom
                  last_low_live = lowValues[i];
                  last_low_pos_live = i;
                  tempZigzagBottomBuffer[i] = last_low_live;  // Mark new bottom
                  tempColorBuffer[i] = 1;
                 }
            break;

         case xBottom:  // Looking for bottom
            if(tempLowMapBuffer[i] != 0)  // Found a potential bottom
              {
               last_low_live = lowValues[i];
               last_low_pos_live = i;
               tempZigzagBottomBuffer[i] = last_low_live;
               tempColorBuffer[i] = 1;
               extreme_search_live = xPeak;  // Switch to looking for peak
              }
            else
               if(tempHighMapBuffer[i] != 0 && highValues[i] > last_high_live)  // Found a higher peak
                 {
                  tempZigzagPeakBuffer[last_high_pos_live] = 0.0;  // Remove old peak
                  last_high_live = highValues[i];
                  last_high_pos_live = i;
                  tempZigzagPeakBuffer[i] = last_high_live;  // Mark new peak
                  tempColorBuffer[i] = 0;
                 }
            break;
        }
     }


// Now compare with file mode output
   Print("Comparing with file mode calculation...");
   int diffCount = 0;

   for(int i = 0; i < dataSize; i++)
     {
      // Check peak differences
      if(tempZigzagPeakBuffer[i] != FileZigzagPeakBuffer[i])
        {
         Print("DIFFERENCE at bar ", i, ": Peak - Live method: ", tempZigzagPeakBuffer[i],
               ", File method: ", FileZigzagPeakBuffer[i]);
         diffCount++;
        }

      // Check bottom differences
      if(tempZigzagBottomBuffer[i] != FileZigzagBottomBuffer[i])
        {
         Print("DIFFERENCE at bar ", i, ": Bottom - Live method: ", tempZigzagBottomBuffer[i],
               ", File method: ", FileZigzagBottomBuffer[i]);
         diffCount++;
        }

      // Compare high/low maps too for debugging
      if(tempHighMapBuffer[i] != FileHighMapBuffer[i])
        {
         Print("MAP DIFFERENCE at bar ", i, ": High map - Live method: ", tempHighMapBuffer[i],
               ", File method: ", FileHighMapBuffer[i]);
        }

      if(tempLowMapBuffer[i] != FileLowMapBuffer[i])
        {
         Print("MAP DIFFERENCE at bar ", i, ": Low map - Live method: ", tempLowMapBuffer[i],
               ", File method: ", FileLowMapBuffer[i]);
        }
     }

   Print("Comparison completed. Found ", diffCount, " differences in ZigZag points.");
   Print("=== End ZigZag Calculation Comparison ===");
  }


//+------------------------------------------------------------------+
//| Calculate ZigZag Using File Data                                 |
//+------------------------------------------------------------------+
void CalculateFileZigZag()
  {
   Print("Calculating zigzag points from file data using unified algorithm...");
   int fileSize = ArraySize(FileData);

// EXPLICITLY CHECK AND RESIZE ALL BUFFERS BEFORE USE
   Print("Resizing buffer arrays to accommodate ", fileSize, " elements");

// Resize all buffer arrays to match file size
   if(ArraySize(FileZigzagPeakBuffer) < fileSize)
     {
      ArrayResize(FileZigzagPeakBuffer, fileSize);
      Print("Resized FileZigzagPeakBuffer to ", ArraySize(FileZigzagPeakBuffer));
     }

   if(ArraySize(FileZigzagBottomBuffer) < fileSize)
     {
      ArrayResize(FileZigzagBottomBuffer, fileSize);
      Print("Resized FileZigzagBottomBuffer to ", ArraySize(FileZigzagBottomBuffer));
     }

   if(ArraySize(FileHighMapBuffer) < fileSize)
     {
      ArrayResize(FileHighMapBuffer, fileSize);
      Print("Resized FileHighMapBuffer to ", ArraySize(FileHighMapBuffer));
     }

   if(ArraySize(FileLowMapBuffer) < fileSize)
     {
      ArrayResize(FileLowMapBuffer, fileSize);
      Print("Resized FileLowMapBuffer to ", ArraySize(FileLowMapBuffer));
     }

   if(ArraySize(FileColorBuffer) < fileSize)
     {
      ArrayResize(FileColorBuffer, fileSize);
      Print("Resized FileColorBuffer to ", ArraySize(FileColorBuffer));
     }

   if(ArraySize(FileSMABuffer) < fileSize)
     {
      ArrayResize(FileSMABuffer, fileSize);
      Print("Resized FileSMABuffer to ", ArraySize(FileSMABuffer));
     }

   if(ArraySize(FileEMABuffer) < fileSize)
     {
      ArrayResize(FileEMABuffer, fileSize);
      Print("Resized FileEMABuffer to ", ArraySize(FileEMABuffer));
     }

   if(ArraySize(FilexHistoryBuffer) < fileSize)
     {
      ArrayResize(FilexHistoryBuffer, fileSize);
      Print("Resized FilexHistoryBuffer to ", ArraySize(FilexHistoryBuffer));
     }

// Create arrays for high/low values
   double highValues[], lowValues[];
   ArrayResize(highValues, fileSize);
   ArrayResize(lowValues, fileSize);

// CHANGE #1: Extract ALL high/low values, not just from xInpDepth-1
   for(int i = 0; i < fileSize; i++)  // <-- Changed to start from 0
     {
      highValues[i] = FileData[i].high;
      lowValues[i] = FileData[i].low;
     }

// Reset file buffers
   ArrayInitialize(FileZigzagPeakBuffer, 0.0);
   ArrayInitialize(FileZigzagBottomBuffer, 0.0);
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);
   ArrayInitialize(FileColorBuffer, 0.0);

// Find extremes using the same algorithm as live data
   int extreme_search = xExtremum;
   double last_high = 0, last_low = 0;
   int last_high_pos = 0, last_low_pos = 0;

// CHANGE #2: Calculate high/low maps using live mode's exact functions
   for(int i = xInpDepth-1; i < fileSize; i++)  // <-- Start from xInpDepth-1
     {
      // Use Highest/Lowest directly instead of UnifiedCalculateHighLowMaps
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

// CHANGE #3: Find extremes also starting from xInpDepth-1
   for(int i = xInpDepth-1; i < fileSize; i++)  // <-- Start from xInpDepth-1
     {

      switch(extreme_search)
        {
         case xExtremum:  // Initial search for any extremum
            if(last_low == 0 && last_high == 0)
              {
               if(FileHighMapBuffer[i] != 0)
                 {
                  last_high = highValues[i];
                  last_high_pos = i;
                  extreme_search = xBottom;  // Look for a bottom next
                  FileZigzagPeakBuffer[i] = last_high;
                  FileColorBuffer[i] = 0;
                 }
               else
                  if(FileLowMapBuffer[i] != 0)
                    {
                     last_low = lowValues[i];
                     last_low_pos = i;
                     extreme_search = xPeak;  // Look for a peak next
                     FileZigzagBottomBuffer[i] = last_low;
                     FileColorBuffer[i] = 1;
                    }
              }
            break;

         case xPeak:  // Looking for peak
            if(FileHighMapBuffer[i] != 0)  // Found a potential peak
              {
               last_high = highValues[i];
               last_high_pos = i;
               FileZigzagPeakBuffer[i] = last_high;
               FileColorBuffer[i] = 0;
               extreme_search = xBottom;  // Switch to looking for bottom
              }
            else
               if(FileLowMapBuffer[i] != 0 && lowValues[i] < last_low)  // Found a lower bottom
                 {
                  FileZigzagBottomBuffer[last_low_pos] = 0.0;  // Remove old bottom
                  last_low = lowValues[i];
                  last_low_pos = i;
                  FileZigzagBottomBuffer[i] = last_low;  // Mark new bottom
                  FileColorBuffer[i] = 1;
                 }
            break;

         case xBottom:  // Looking for bottom
            if(FileLowMapBuffer[i] != 0)  // Found a potential bottom
              {
               last_low = lowValues[i];
               last_low_pos = i;
               FileZigzagBottomBuffer[i] = last_low;
               FileColorBuffer[i] = 1;
               extreme_search = xPeak;  // Switch to looking for peak
              }
            else
               if(FileHighMapBuffer[i] != 0 && highValues[i] > last_high)  // Found a higher peak
                 {
                  FileZigzagPeakBuffer[last_high_pos] = 0.0;  // Remove old peak
                  last_high = highValues[i];
                  last_high_pos = i;
                  FileZigzagPeakBuffer[i] = last_high;  // Mark new peak
                  FileColorBuffer[i] = 0;
                 }
            break;
        }
     }

// Calculate additional indicators
   CalculateSMAandEMAFromFile();
   CalculateXValuesFromFile();

   Print("File ZigZag calculation completed using unified algorithm");

   if(xInpDebugMode)
     {
      double highValues[], lowValues[];
      ArrayResize(highValues, fileSize);
      ArrayResize(lowValues, fileSize);
      for(int i = 0; i < fileSize; i++)
        {
         highValues[i] = FileData[i].high;
         lowValues[i] = FileData[i].low;
        }
      CompareZigZagCalculations(highValues, lowValues, fileSize);
     }
  }

//+------------------------------------------------------------------+
//| Initialize calculation variables                                   |
//+------------------------------------------------------------------+
int InitializeCalculation(const int rates_total, const int prev_calculated)
  {
   static bool buffers_initialized = false;

   if(prev_calculated == 0)
     {
      // Initialize buffers only on first calculation
      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);
      ArrayInitialize(xHistoryBuffer, 0.0); // Initialize X history buffer
      buffers_initialized = true;
      return xInpDepth - 1;
     }

// Preserve last known good values
   if(!buffers_initialized)
     {
      // Store last known good values
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

      // Initialize buffers while preserving last values
      ArrayInitialize(xZigzagPeakBuffer, 0.0);
      ArrayInitialize(xZigzagBottomBuffer, 0.0);
      ArrayInitialize(xHighMapBuffer, 0.0);
      ArrayInitialize(xLowMapBuffer, 0.0);
      ArrayInitialize(xColorBuffer, 0.0);

      // Restore last known good values
      if(lastPeakPos >= 0)
         xZigzagPeakBuffer[lastPeakPos] = lastPeak;
      if(lastBottomPos >= 0)
         xZigzagBottomBuffer[lastBottomPos] = lastBottom;

      buffers_initialized = true;
     }

   return prev_calculated - 1;
  }


//+------------------------------------------------------------------+
//| Check and resize live data buffers                               |
//+------------------------------------------------------------------+
void CheckAndResizeLiveDataBuffers(const int rates_total)
  {
   Print("Explicitly checking and resizing all LIVE DATA buffers before use");
   Print("Resizing buffer arrays to accommodate ", rates_total, " elements");

// Check and resize ZigZag peak buffer
   if(ArraySize(xZigzagPeakBuffer) < rates_total)
     {
      ArrayResize(xZigzagPeakBuffer, rates_total);
      Print("Resized xZigzagPeakBuffer to ", ArraySize(xZigzagPeakBuffer));
     }

// Check and resize ZigZag bottom buffer
   if(ArraySize(xZigzagBottomBuffer) < rates_total)
     {
      ArrayResize(xZigzagBottomBuffer, rates_total);
      Print("Resized xZigzagBottomBuffer to ", ArraySize(xZigzagBottomBuffer));
     }

// Check and resize color buffer
   if(ArraySize(xColorBuffer) < rates_total)
     {
      ArrayResize(xColorBuffer, rates_total);
      Print("Resized xColorBuffer to ", ArraySize(xColorBuffer));
     }

// Check and resize high map buffer
   if(ArraySize(xHighMapBuffer) < rates_total)
     {
      ArrayResize(xHighMapBuffer, rates_total);
      Print("Resized xHighMapBuffer to ", ArraySize(xHighMapBuffer));
     }

// Check and resize low map buffer
   if(ArraySize(xLowMapBuffer) < rates_total)
     {
      ArrayResize(xLowMapBuffer, rates_total);
      Print("Resized xLowMapBuffer to ", ArraySize(xLowMapBuffer));
     }

// Check and resize SMMA buffer
   if(ArraySize(SMMA_Buffer) < rates_total)
     {
      ArrayResize(SMMA_Buffer, rates_total);
      Print("Resized SMMA_Buffer to ", ArraySize(SMMA_Buffer));
     }

// Check and resize EMA buffer
   if(ArraySize(EMA_Buffer) < rates_total)
     {
      ArrayResize(EMA_Buffer, rates_total);
      Print("Resized EMA_Buffer to ", ArraySize(EMA_Buffer));
     }

// Check and resize SMMA price buffer
   if(ArraySize(SMMA_PriceBuffer) < rates_total)
     {
      ArrayResize(SMMA_PriceBuffer, rates_total);
      Print("Resized SMMA_PriceBuffer to ", ArraySize(SMMA_PriceBuffer));
     }

// Check and resize EMA price buffer
   if(ArraySize(EMA_PriceBuffer) < rates_total)
     {
      ArrayResize(EMA_PriceBuffer, rates_total);
      Print("Resized EMA_PriceBuffer to ", ArraySize(EMA_PriceBuffer));
     }

// Check and resize X history buffer
   if(ArraySize(xHistoryBuffer) < rates_total)
     {
      ArrayResize(xHistoryBuffer, rates_total);
      Print("Resized xHistoryBuffer to ", ArraySize(xHistoryBuffer));
     }
  }

//+------------------------------------------------------------------+
//| Calculate ZigZag values                                           |
//+------------------------------------------------------------------+
void CalculateZigZag(const int rates_total, int start,
                     const double &high[], const double &low[],
                     const int prev_calculated)
  {
   int extreme_search = xExtremum;
   double last_high = 0, last_low = 0;
   int last_high_pos = 0, last_low_pos = 0;

// Find last known extremes if restarting calculation
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

// Main calculation loop
   for(int i = start; i < rates_total && !IsStopped(); i++)
     {
      // Calculate high/low maps
      CalculateHighLowMaps(i, high, low);

      // Find extremes
      if(!FindExtremes(i, extreme_search, last_high, last_low,
                       last_high_pos, last_low_pos, high, low))
         break;
     }
  }


//+------------------------------------------------------------------+
//| Find and process extreme points                                    |
//+------------------------------------------------------------------+
bool FindExtremes(const int i, int &extreme_search, double &last_high, double &last_low,
                  int &last_high_pos, int &last_low_pos, const double &high[], const double &low[])
  {
   switch(extreme_search)
     {
      case xExtremum:  // Initial search for any extremum
         if(last_low == 0 && last_high == 0)
           {
            if(xHighMapBuffer[i] != 0)
              {
               last_high = high[i];
               last_high_pos = i;
               extreme_search = xBottom;  // Look for a bottom next
               xZigzagPeakBuffer[i] = last_high;
               xColorBuffer[i] = 0;
              }
            else
               if(xLowMapBuffer[i] != 0)
                 {
                  last_low = low[i];
                  last_low_pos = i;
                  extreme_search = xPeak;  // Look for a peak next
                  xZigzagBottomBuffer[i] = last_low;
                  xColorBuffer[i] = 1;
                 }
           }
         break;

      case xPeak:  // Looking for peak
         if(xHighMapBuffer[i] != 0)  // Found a potential peak
           {
            last_high = high[i];
            last_high_pos = i;
            xZigzagPeakBuffer[i] = last_high;
            xColorBuffer[i] = 0;
            extreme_search = xBottom;  // Switch to looking for bottom
           }
         else
            if(xLowMapBuffer[i] != 0 && low[i] < last_low)  // Found a lower bottom
              {
               xZigzagBottomBuffer[last_low_pos] = 0.0;  // Remove old bottom
               last_low = low[i];
               last_low_pos = i;
               xZigzagBottomBuffer[i] = last_low;  // Mark new bottom
               xColorBuffer[i] = 1;
              }
         break;

      case xBottom:  // Looking for bottom
         if(xLowMapBuffer[i] != 0)  // Found a potential bottom
           {
            last_low = low[i];
            last_low_pos = i;
            xZigzagBottomBuffer[i] = last_low;
            xColorBuffer[i] = 1;
            extreme_search = xPeak;  // Switch to looking for peak
           }
         else
            if(xHighMapBuffer[i] != 0 && high[i] > last_high)  // Found a higher peak
              {
               xZigzagPeakBuffer[last_high_pos] = 0.0;  // Remove old peak
               last_high = high[i];
               last_high_pos = i;
               xZigzagPeakBuffer[i] = last_high;  // Mark new peak
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

// Extract high/low values from file data
   for(int i = 0; i < fileSize; i++)
     {
      highValues[i] = FileData[i].high;
      lowValues[i] = FileData[i].low;
     }

// Initialize map buffers to zero
   ArrayInitialize(FileHighMapBuffer, 0.0);
   ArrayInitialize(FileLowMapBuffer, 0.0);

// Use IDENTICAL approach as live mode - starting from xInpDepth-1
   for(int i = xInpDepth-1; i < fileSize; i++)
     {
      // Calculate high map - IDENTICAL to live mode
      double highVal = Highest(highValues, xInpDepth, i);
      if(highValues[i] == highVal)
        {
         FileHighMapBuffer[i] = highValues[i];
        }
      // No need for else as we already initialized to 0.0

      // Calculate low map - IDENTICAL to live mode
      double lowVal = Lowest(lowValues, xInpDepth, i);
      if(lowValues[i] == lowVal)
        {
         FileLowMapBuffer[i] = lowValues[i];
        }

     }

   Print("File high/low maps calculated using standard algorithm");
  }

//+------------------------------------------------------------------+
//| Calculate High and Low map values                                 |
//+------------------------------------------------------------------+
void CalculateHighLowMaps(const int shift,
                          const double &high[], const double &low[])
  {
// Calculate high map
   double highVal = Highest(high, xInpDepth, shift);
   if(high[shift] == highVal)
     {
      xHighMapBuffer[shift] = high[shift];
     }
   else
     {
      xHighMapBuffer[shift] = 0.0;
     }

// Calculate low map
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

// Check for minimum distance between points
   double minDistance = xInpDeviation * _Point * 2;

   for(int i = pos - 1; i >= MathMax(0, pos - xInpDepth); i--)
     {
      if(xZigzagPeakBuffer[i] != 0 || xZigzagBottomBuffer[i] != 0)
        {
         double prevPrice = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         if(MathAbs(price - prevPrice) < minDistance)
            return false;
         break;
        }
     }

   return true;
  }


//+------------------------------------------------------------------+
//| Update price labels for visualization                             |
//+------------------------------------------------------------------+
void UpdatePriceLabels(const int rates_total, const datetime &time[])
  {
   for(int i = 0; i < rates_total; i++)
     {
      if(xZigzagPeakBuffer[i] != 0)
         xCreatePriceLabel("Peak_" + string(i), xZigzagPeakBuffer[i], time[i], true);
      if(xZigzagBottomBuffer[i] != 0)
         xCreatePriceLabel("Bottom_" + string(i), xZigzagBottomBuffer[i], time[i], false);
     }
  }

//+------------------------------------------------------------------+
//| Create or update price label object                               |
//+------------------------------------------------------------------+
void xCreatePriceLabel(const string name, const double price,
                         const datetime time, const bool isPeak)
  {
   string fullName = "x" + name;  // Add prefix to object name

// Check if object exists
   if(ObjectFind(0, name) >= 0)
     {
      // Update existing object position and text
      if(ObjectGetInteger(0, name, OBJPROP_TIME) != time ||
         ObjectGetDouble(0, name, OBJPROP_PRICE) != price)
        {
         ObjectSetInteger(0, name, OBJPROP_TIME, time);
         ObjectSetDouble(0, name, OBJPROP_PRICE, price);
         ObjectSetString(0, name, OBJPROP_TEXT, DoubleToString(price, _Digits));
        }
     }
   else
     {
      // Create new object only if it doesn't exist
      ObjectCreate(0, name, OBJ_TEXT, 0, time, price);
      ObjectSetString(0, name, OBJPROP_TEXT, DoubleToString(price, _Digits));
      ObjectSetInteger(0, name, OBJPROP_COLOR, isPeak ? xInpBullColor : xInpBearColor);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
     }
  }

//+------------------------------------------------------------------+
//| Get highest value for range                                       |
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
//| Get lowest value for range                                        |
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
//|                                                                  |
//+------------------------------------------------------------------+
bool ValidateBuffers()
  {
// Basic buffer validation
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
//| Helper function to determine trend at a specific bar             |
//+------------------------------------------------------------------+
string GetTrendAtBar(int bar)
  {
   if(bar < 0 || bar >= ArraySize(EMA_Buffer) || bar >= ArraySize(SMMA_Buffer))
      return "Unknown";

   return DetermineTrend(EMA_Buffer[bar], SMMA_Buffer[bar],
                         xHistoryBuffer[bar], adjustedThreshold);
  }


//+------------------------------------------------------------------+
//| Helper Function for Consistent Trend Determination               |
//+------------------------------------------------------------------+
string DetermineTrend(double ema, double smma, double xValue, double threshold)
  {
   if(xValue <= threshold)
      return "No Trend";

   if(ema > smma)
      return "Uptrend";
   else
      return "Downtrend";
  }

//+------------------------------------------------------------------+
//| Process file data and collect zigzag points                      |
//+------------------------------------------------------------------+
bool CollectFileZigZagPoints()
  {
   Print("Collecting zigzag points from file data...");
   Print("Using file-adjusted threshold: ", g_FileAdjustedThreshold,
         " for trend determination");

// Reset existing collection array
   ArrayResize(xcollectedPoints, 0);

   int fileSize = ArraySize(FileData);
   int pointsCollected = 0;

// First pass: collect all zigzag points
   for(int i = 0; i < fileSize; i++)
     {
      // Process peaks
      if(FileZigzagPeakBuffer[i] != 0.0)
        {
         int newSize = ArraySize(xcollectedPoints) + 1;
         ArrayResize(xcollectedPoints, newSize);

         xcollectedPoints[newSize-1].bar = i;
         xcollectedPoints[newSize-1].price = FileZigzagPeakBuffer[i];
         xcollectedPoints[newSize-1].isPeak = true;
         xcollectedPoints[newSize-1].safeguardValid = true;
         xcollectedPoints[newSize-1].validationValid = true;
         xcollectedPoints[newSize-1].timestamp = FileData[i].time;
         xcollectedPoints[newSize-1].xValue = (int)FilexHistoryBuffer[i];

         // FIXED: Determine trend using file-adjusted threshold
         string trend = "No Trend";
         if(i >= SMMA_Period && i >= EMA_Period)
           {
            bool isAboveThreshold = FilexHistoryBuffer[i] > g_FileAdjustedThreshold;
            if(FileEMABuffer[i] > FileSMABuffer[i])
              {
               trend = isAboveThreshold ? "Uptrend" : "No Trend";
              }
            else
              {
               trend = isAboveThreshold ? "Downtrend" : "No Trend";
              }
           }
         xcollectedPoints[newSize-1].trend = trend;

         pointsCollected++;
        }

      // Process bottoms
      if(FileZigzagBottomBuffer[i] != 0.0)
        {
         int newSize = ArraySize(xcollectedPoints) + 1;
         ArrayResize(xcollectedPoints, newSize);

         xcollectedPoints[newSize-1].bar = i;
         xcollectedPoints[newSize-1].price = FileZigzagBottomBuffer[i];
         xcollectedPoints[newSize-1].isPeak = false;
         xcollectedPoints[newSize-1].safeguardValid = true;
         xcollectedPoints[newSize-1].validationValid = true;
         xcollectedPoints[newSize-1].timestamp = FileData[i].time;
         xcollectedPoints[newSize-1].xValue = (int)FilexHistoryBuffer[i];

         // FIXED: Determine trend using file-adjusted threshold
         string trend = "No Trend";
         if(i >= SMMA_Period && i >= EMA_Period)
           {
            bool isAboveThreshold = FilexHistoryBuffer[i] > g_FileAdjustedThreshold;
            if(FileEMABuffer[i] > FileSMABuffer[i])
              {
               trend = isAboveThreshold ? "Uptrend" : "No Trend";
              }
            else
              {
               trend = isAboveThreshold ? "Downtrend" : "No Trend";
              }
           }
         xcollectedPoints[newSize-1].trend = trend;

         pointsCollected++;
        }
     }

   Print("Collected ", pointsCollected, " zigzag points from file data");
   return pointsCollected > 0;
  }

//+------------------------------------------------------------------+
//| Collect and validate zigzag points                                |
//+------------------------------------------------------------------+
void CollectValidPoints(const datetime &time[])
  {
   Print("=== Point Collection Process ===");
   Print("Bar | TimeStamp | Price | Type | Validation Status");
   Print("----------------------------------------");

// Initialize collection array
   ArrayResize(xcollectedPoints, 0);

   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = MathMax(0, start_pos - xBartoPrint + 1);

// Keep track of points for validation
   int pointCount = 0;
   int lastValidIndex = -1;

// First pass: collect all potential points
   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         pointCount++;
         lastValidIndex = i;
        }
     }

// Second pass: only collect if we have enough subsequent points
   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         double price = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         bool isPeak = (xZigzagPeakBuffer[i] != 0);

         // Keep original validations
         bool safeguardValid = ValidateSafeguards(i, price);
         bool validationStepsValid = ValidateSteps(i, price, isPeak);

         // Only add points that pass all validations AND have at least 2 earlier points available
         if(safeguardValid && validationStepsValid && i > lastValidIndex - 2)
           {
            int newSize = ArraySize(xcollectedPoints) + 1;
            ArrayResize(xcollectedPoints, newSize);

            xcollectedPoints[newSize-1].bar = i;
            xcollectedPoints[newSize-1].price = price;
            xcollectedPoints[newSize-1].isPeak = isPeak;
            xcollectedPoints[newSize-1].safeguardValid = true;
            xcollectedPoints[newSize-1].validationValid = true;
            xcollectedPoints[newSize-1].timestamp = time[i]; // Store timestamp

            // Store historical X value and trend
            xcollectedPoints[newSize-1].xValue = (int)xHistoryBuffer[i];
            xcollectedPoints[newSize-1].trend = GetTrendAtBar(i);

            Print(StringFormat("%4d | %s | %10.5f | %6s | Valid",
                               i,
                               TimeToString(time[i], TIME_DATE|TIME_MINUTES), // Add timestamp to print
                               price,
                               isPeak ? "Peak" : "Bottom"));
           }
         else
           {
            string reason = "";
            if(!safeguardValid)
               reason += "Failed Safeguard ";
            if(!validationStepsValid)
               reason += "Failed Validation Steps ";
            if(i <= lastValidIndex - 2)
               reason += "Insufficient Subsequent Points";

            Print(StringFormat("%4d | %s | %10.5f | %6s | Invalid (%s)",
                               i,
                               TimeToString(time[i], TIME_DATE|TIME_MINUTES), // Add timestamp to print
                               price,
                               isPeak ? "Peak" : "Bottom",
                               reason));
           }
        }
     }

   Print(StringFormat("Total points collected: %d (with all validations)", ArraySize(xcollectedPoints)));
   Print("=== End Collection Process ===\n");
  }

//+------------------------------------------------------------------+
//| Validate point against safeguard checks                           |
//+------------------------------------------------------------------+
bool ValidateSafeguards(const int bar, const double price)
  {
   if(xHighMapBuffer[bar] == 0 && xLowMapBuffer[bar] == 0)
      return false;
// Add other safeguard checks as needed
   return true;
  }

//+------------------------------------------------------------------+
//| Validate point against 4-step validation                          |
//+------------------------------------------------------------------+
bool ValidateSteps(const int bar, const double price, const bool isPeak)
  {
// Step 1: Buffer check
   bool bufferValid = (xHighMapBuffer[bar] != 0 || xLowMapBuffer[bar] != 0);
   if(!bufferValid)
      return false;

// Step 2: Mode check
   bool modeValid = true;  // Implement mode validation
   if(!modeValid)
      return false;

// Step 3: Distance check
   bool distanceValid = true;  // Implement distance validation
   if(!distanceValid)
      return false;

// Step 4: Status check
   bool statusValid = true;  // Implement status validation
   if(!statusValid)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
//|  Calculation of Market Structure                                 |
//+------------------------------------------------------------------+
void CalculateMarketStructure()
  {
   Print("\n=== Market Structure Analysis ===");
   Print("No. | TimeStamp | Bar Index | Type | Current Point | Previous Point | 2 Previous Point | Price Change | % Pr. Change | Bars | Bars with Dir | Points/Bar | Category | X Value | Trend");
   Print("-------------------------------------------------------------------------------------------------------------------");

   int totalPoints = ArraySize(xcollectedPoints);
   if(totalPoints < 3)
     {
      Print("Not enough points for market structure calculation");
      return;
     }

// Remove 100 point limit but ensure enough points for calculation
   int maxPoints = totalPoints - 2;  // Ensure we have 2 more points available

   for(int i = 0; i < maxPoints; i++)
     {
      // Validate array bounds before accessing points
      if(i + 2 >= totalPoints)
        {
         Print(StringFormat("Skipping point %d: Insufficient subsequent points", i));
         continue;
        }

      double currentPrice = xcollectedPoints[i].price;
      double prevPrice = xcollectedPoints[i+1].price;
      double twoPrevPrice = xcollectedPoints[i+2].price;

      // Validate prices before calculation
      if(!xIsValidPrice(currentPrice) || !xIsValidPrice(prevPrice) || !xIsValidPrice(twoPrevPrice))
        {
         Print(StringFormat("Invalid price data at point %d", i));
         continue;
        }

      // Original calculation logic remains the same
      double priceChange = currentPrice - prevPrice;
      double percentChange = (priceChange / prevPrice) * 100;
      int barCount = xcollectedPoints[i].bar - xcollectedPoints[i+1].bar;

      // Calculate bars with direction
      int barsWithDir = barCount;
      if(xcollectedPoints[i].isPeak == false) // If it's a bottom point
        {
         barsWithDir = -barCount; // Make it negative for bottom points
        }

      double pointsPerBar = barCount != 0 ? priceChange/barCount : 0;

      // Original threshold calculations
      double upperThreshold = twoPrevPrice * (1 + (xInpEqualThreshold / 100));
      double lowerThreshold = twoPrevPrice * (1 - (xInpEqualThreshold / 100));

      // Market structure determination with validation
      string firstStatus;
      if(currentPrice > upperThreshold)
         firstStatus = "Higher";
      else
         if(currentPrice < lowerThreshold)
            firstStatus = "Lower";
         else
            firstStatus = "Equal";

      string lastStatus = (currentPrice > prevPrice) ? "High" : "Low";

      string marketStructure;
      if(firstStatus == "Higher" && lastStatus == "High")
         marketStructure = "HH";
      else
         if(firstStatus == "Lower" && lastStatus == "Low")
            marketStructure = "LL";
         else
            if(firstStatus == "Higher" && lastStatus == "Low")
               marketStructure = "HL";
            else
               if(firstStatus == "Lower" && lastStatus == "High")
                  marketStructure = "LH";
               else
                  if(firstStatus == "Equal" && lastStatus == "High")
                     marketStructure = "EQH";
                  else
                     if(firstStatus == "Equal" && lastStatus == "Low")
                        marketStructure = "EQL";

      Print(StringFormat(
               "%2d | %s | %4d | %s | %10.5f | %10.5f | %10.5f | %10.5f | %6.2f%% | %3d | %3d | %10.5f | %s | %d | %s",
               i,
               TimeToString(xcollectedPoints[i].timestamp, TIME_DATE|TIME_MINUTES),
               xcollectedPoints[i].bar,
               xcollectedPoints[i].isPeak ? "Peak" : "Bottom",
               currentPrice,
               prevPrice,
               twoPrevPrice,
               priceChange,
               percentChange,
               barCount,
               barsWithDir,
               pointsPerBar,
               marketStructure,
               xcollectedPoints[i].xValue,
               xcollectedPoints[i].trend
            ));
     }
   Print("=== End Market Structure Analysis ===\n");
  }

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                         |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
// Original cleanup code
   if(xInpShowPrice)
     {
      string name;
      for(int i = ObjectsTotal(0, 0, OBJ_TEXT) - 1; i >= 0; i--)
        {
         name = ObjectName(0, i, 0, OBJ_TEXT);
         if(StringFind(name, "Peak_") >= 0 || StringFind(name, "Bottom_") >= 0)
            ObjectDelete(0, name);
        }
     }

// Free file mode buffers if they were allocated
   if(g_FileDataInitialized)
     {
      ArrayFree(FileData);
      ArrayFree(FileZigzagPeakBuffer);
      ArrayFree(FileZigzagBottomBuffer);
      ArrayFree(FileColorBuffer);
      ArrayFree(FileHighMapBuffer);
      ArrayFree(FileLowMapBuffer);
      ArrayFree(FileSMABuffer);
      ArrayFree(FileEMABuffer);
      ArrayFree(FilexHistoryBuffer);
     }

// Delete export button
   ObjectDelete(0, EXPORT_BUTTON_NAME);

// Delete trend direction label
   ObjectDelete(0, trendLabel);
  }

//+------------------------------------------------------------------+
//| Debug function to print buffer values                             |
//+------------------------------------------------------------------+
void DebugPrintBuffers()
  {
   int bars_to_print = xBartoPrint;  // This should already handle 100+ points
   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = MathMax(0, start_pos - bars_to_print + 1);

   Print("=== Debug Buffer Values ===");
   Print("Bar | Peak Buffer | Bottom Buffer | High Map | Low Map");
   Print("------------------------------------------------");

   for(int i = start_pos; i >= end_pos; i--)
     {
      string output = StringFormat("%3d | %10.5f | %12.5f | %8.5f | %8.5f",
                                   i,
                                   xZigzagPeakBuffer[i],
                                   xZigzagBottomBuffer[i],
                                   xHighMapBuffer[i],
                                   xLowMapBuffer[i]);
      Print(output);
     }
   Print("=== End Debug Print ===");
  }

//+------------------------------------------------------------------+
//| Debug Prints to Track Safeguard checks                           |
//+------------------------------------------------------------------+
void DebugPrintSafeguardChecks()
  {
   Print("=== Safeguard Validation Checks ===");
   Print("Bar | Price | Pass 1 | Buffer Status | Persistence");
   Print("------------------------------------------------");

   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = MathMax(0, start_pos - xBartoPrint + 1);

   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         double price = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         bool pass1 = true;  // Keep original validation
         bool bufferOK = (xHighMapBuffer[i] != 0 || xLowMapBuffer[i] != 0);
         bool persistent = true;  // Keep original persistence check

         Print(StringFormat("%4d | %10.5f | %5s | %5s | %5s",
                            i,
                            price,
                            pass1 ? "Yes" : "No",
                            bufferOK ? "Yes" : "No",
                            persistent ? "Yes" : "No"));
        }
     }
   Print("=== End Safeguard Checks ===\n");
  }

//+------------------------------------------------------------------+
//| Debug Prints to track these 4 validation steps                   |
//+------------------------------------------------------------------+
void DebugPrintValidationSteps()
  {
   Print("=== Four Steps Validation Checks ===");
   Print("Bar | Price | Buffer | Mode | Distance | Status");
   Print("------------------------------------------------");

   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = MathMax(0, start_pos - xBartoPrint + 1);

   xEnSearchMode currentMode = xExtremum;

   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         double price = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];

         // Keep original validation logic
         bool bufferOK = (xHighMapBuffer[i] != 0 || xLowMapBuffer[i] != 0);
         bool modeOK = true;
         bool distanceOK = true;
         bool statusOK = true;

         Print(StringFormat("%4d | %10.5f | %5s | %5s | %5s | %5s",
                            i,
                            price,
                            bufferOK ? "Pass" : "Fail",
                            modeOK ? "Pass" : "Fail",
                            distanceOK ? "Pass" : "Fail",
                            statusOK ? "Pass" : "Fail"));
        }
     }
   Print("=== End Validation Steps ===\n");
  }

//+------------------------------------------------------------------+
//| Debug Prints for ZigZag Segment Analysis                          |
//+------------------------------------------------------------------+
void DebugPrintSegmentAnalysis()
  {
   Print("\n=== ZigZag Segment Analysis ===");

   int start_pos = ArraySize(xZigzagPeakBuffer) - 1;
   int end_pos = MathMax(0, start_pos - xBartoPrint + 1);

   int lastValidBar = -1;
   double lastValidPrice = 0;

   for(int i = start_pos; i >= end_pos; i--)
     {
      if(xZigzagPeakBuffer[i] != 0.0 || xZigzagBottomBuffer[i] != 0.0)
        {
         if(lastValidBar == -1)
           {
            lastValidBar = i;
            lastValidPrice = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
            continue;
           }

         double currentPrice = (xZigzagPeakBuffer[i] != 0) ? xZigzagPeakBuffer[i] : xZigzagBottomBuffer[i];
         int barDistance = lastValidBar - i;

         // Keep original calculation logic
         double priceChange = lastValidPrice - currentPrice;
         double pointsPerBar = barDistance != 0 ? priceChange/barDistance : 0;

         Print(StringFormat("Segment %d->%d: Price change: %.5f, Bars: %d, Points/Bar: %.5f",
                            i, lastValidBar,
                            priceChange,
                            barDistance,
                            pointsPerBar));

         lastValidBar = i;
         lastValidPrice = currentPrice;
        }
     }
   Print("=== End Segment Analysis ===\n");
  }
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
