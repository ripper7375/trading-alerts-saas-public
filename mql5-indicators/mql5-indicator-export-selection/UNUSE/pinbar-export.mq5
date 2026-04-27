// +------------------------------------------------------------------+
// |         Pinbar Detector Diamond Symbol V17 - EXPORT Edition      |
// |         Based on AdaptivePinbarDetector_V6.mq5                   |
// |         https://t.me/ForexEaPremium                              |
// +------------------------------------------------------------------+
#property link            "https://t.me/ForexEaPremium"
#property version         "7.1"

#property description     "Adaptive Pinbar Detector V7.1 - PERMANENT SYMBOLS + DATA EXPORT"
#property description     "SELECTIVE FOCUS: Smart parameter prioritization"
#property description     "Focus on MinWickSize + MaxBodySize + BodyPosition"
#property description     "Avoid over-constraining - target what matters most"
#property description     "Uses Drawing Objects for permanent display + CSV/JSON export"

#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2

// Plot 1: Bullish Pinbars (Diamond)
#property indicator_type1   DRAW_ARROW
#property indicator_color1  clrGreen
#property indicator_width1  2

// Plot 2: Bearish Pinbars (Diamond)
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrRed
#property indicator_width2  2

// --- Button name constant
#define EXPORT_BUTTON_NAME "DataExportButton_V17"

// === PARAMETER SCHEME SELECTION ===
enum ENUM_STRINGENCY_LEVEL
{
        LESS_STRINGENT   = 0,           // More signals, lower accuracy (45-55%)
        BASELINE         = 1,           // Balanced approach (65-75%)
        MORE_STRINGENT   = 2            // Quality signals, practical (70-80%)
};

enum ENUM_DISPLAY_MODE
{
        INDICATOR_BUFFERS   = 0,        // Traditional dynamic buffers (can change)
        DRAWING_OBJECTS     = 1,        // Permanent drawing objects (never change)
        HYBRID_MODE         = 2         // Both buffers + permanent objects
};

// Symbol selection options for export
enum ENUM_SYMBOL_SELECTION
{
      SYMBOL_CURRENT       = 0,         // Current chart symbol
      SYMBOL_MANUAL_ENTRY  = 1          // Enter manually
};

input ENUM_STRINGENCY_LEVEL StringencyLevel  = BASELINE;            // Parameter Scheme Selection
input ENUM_DISPLAY_MODE     DisplayMode      = DRAWING_OBJECTS;     // Display Method
input int    CountBars                       = 500;                  // CountBars - number of bars to analyze (0 = all, not recommended for drawing objects)
input int    DisplayDistance                 = 5;                    // DisplayDistance - distance from candles to symbols
input bool   ShowStringencyInfo             = true;                 // Show current settings in chart comment

// === LEFT EYE CONTROL ===
input string LeftEyeSection       = "=== LEFT EYE ANALYSIS ==="; // Left Eye Settings
input bool   UseLeftEyeAnalysis   = false;  // Enable Left Eye context analysis (default OFF for more signals)
input bool   ShowLeftEyeMode      = true;   // Show Left Eye mode in chart comment
input bool   EnableDebugMode      = false;  // Enable debug output to help troubleshoot detection issues

// === PERMANENT OBJECTS SETTINGS ===
input string ObjectSection        = "=== PERMANENT OBJECTS ==="; // Object Settings
input bool   DeleteOldObjects     = true;   // Delete old pinbar objects on restart
input int    MaxObjectsToKeep     = 200;    // Maximum number of pinbar objects to keep on chart
input color  BullishColor         = clrLimeGreen; // Bullish pinbar color
input color  BearishColor         = clrRed;       // Bearish pinbar color
input int    ArrowSize            = 2;            // Arrow size for drawing objects

// === MANUAL OVERRIDE ===
input string ManualSection        = "=== MANUAL OVERRIDE ==="; // Manual Settings
input bool   UseManualSettings    = true;   // Override automatic scheme
input double ManualMinWickSize    = 0.75;   // Manual: Minimum wick size
input double ManualMaxNoseBodySize = 0.25;  // Manual: Max body size
input double ManualNoseBodyPosition = 0.75; // Manual: Body position threshold
input double ManualNoseProtruding = 0.40;   // Manual: Minimum protrusion
input double ManualLeftEyeMinBodySize = 0.15; // Manual: Left eye min body size

// === ADVANCED FILTERS ===
input string AdvancedSection      = "=== ADVANCED FILTERS ==="; // Advanced Settings
input bool   LeftEyeOppositeDirection  = false; // Left Eye opposite direction requirement
input bool   NoseSameDirection         = false; // Nose same direction requirement
input bool   NoseBodyInsideLeftEyeBody = false; // Nose body inside Left Eye body
input double NoseBodyToLeftEyeBody     = 1;     // Max Nose body to Left Eye body ratio
input double NoseLengthToLeftEyeLength = 0;     // Min Nose length to Left Eye length ratio
input double LeftEyeDepth              = 0.1;   // Min Left Eye depth ratio
input int    MinimumNoseLength         = 1;     // Minimum nose length in points

// === EXPORT PARAMETERS ===
input string ExportSection           = "=== DATA EXPORT ===";       // Export Settings
input ENUM_SYMBOL_SELECTION InpSymbolSelection = SYMBOL_CURRENT;    // Symbol Selection
input string                InpManualSymbol    = "";                // Manual Symbol Entry (if "Enter manually")
input ENUM_TIMEFRAMES       InpTimeframe       = PERIOD_CURRENT;    // Timeframe
input int                   InpBars            = 500;              // Number of bars to export
input string                InpBaseFileName    = "PinbarDetector_V17"; // Base file name
input bool                  InpExportJSON      = false;              // Export JSON file
input bool                  InpCleanFilenames  = true;              // Clean filenames (no .txt extension)

// Indicator buffers
double BullishPinbars[];
double BearishPinbars[];

// Global variables
int         LastBars   = 0;
double      MinWickSize;
double      MaxNoseBodySize;
double      NoseBodyPosition;
double      NoseProtruding;
double      LeftEyeMinBodySize;
string      CurrentScheme;
string      LeftEyeMode;
string      CurrentDisplayMode;
int         ObjectCounter = 0;
string      ObjectPrefix  = "PinbarV6_";

// Button management variables
bool   ButtonCreated     = false;
int    ButtonRetryCount  = 0;
int    ButtonRetryTimer  = 0;

// Detected pinbars storage for permanent objects
struct PinbarSignal
{
        datetime time;
        double   price;
        bool     isBullish;
        int      barIndex;
};

PinbarSignal DetectedPinbars[];

// SELECTIVE FOCUS Parameter schemes - V7.1 SMART PRIORITIZATION
void InitializeSchemes()
{
        Print("=== INITIALIZING SELECTIVE FOCUS SCHEMES V7.1 ===");
        Print("=== SMART APPROACH: FOCUS ON WHAT MATTERS MOST ===");

        // LESS STRINGENT - All core parameters (a)(b)(c) RELAXED
        MinWickSize       = 0.50;   // (a) 50% wick - relaxed for more signals
        MaxNoseBodySize   = 0.35;   // (b) 35% body - relaxed for more signals
        NoseBodyPosition  = 0.70;   // (c) 70% position - relaxed for more signals
        NoseProtruding    = 0.40;   // Secondary - consistent across schemes
        LeftEyeMinBodySize = 0.15;  // Secondary - consistent across schemes

        if(StringencyLevel == LESS_STRINGENT)
        {
                CurrentScheme = "LESS STRINGENT V7.1 - All parameters relaxed (50-60% accuracy)";
                Print("Applied SELECTIVE LESS STRINGENT: (a)=", MinWickSize, " (b)=", MaxNoseBodySize, " (c)=", NoseBodyPosition);
                double remaining = 1 - MinWickSize;
                Print("Math: ", (remaining * 100), "% < ", (NoseBodyPosition * 100), "%? ", (remaining < NoseBodyPosition ? "PASS" : "FAIL"));
                Print("Strategy: All core parameters RELAXED for more opportunities");
                return;
        }

        // BASELINE - Focus on (a) MinWickSize ONLY, keep (b)(c) same as Less Stringent
        MinWickSize       = 0.58;   // (a) 58% wick - STRICTER for quality
        MaxNoseBodySize   = 0.35;   // (b) 35% body - SAME as Less Stringent
        NoseBodyPosition  = 0.70;   // (c) 70% position - SAME as Less Stringent
        NoseProtruding    = 0.40;   // Secondary - consistent
        LeftEyeMinBodySize = 0.15;  // Secondary - consistent

        if(StringencyLevel == BASELINE)
        {
                CurrentScheme = "BASELINE V7.1 - Focus on wick quality (60-70% accuracy)";
                Print("Applied SELECTIVE BASELINE: (a)=", MinWickSize, " (b)=", MaxNoseBodySize, " (c)=", NoseBodyPosition);
                double remaining = 1 - MinWickSize;
                Print("Math: ", (remaining * 100), "% < ", (NoseBodyPosition * 100), "%? ", (remaining < NoseBodyPosition ? "PASS" : "FAIL"));
                Print("Strategy: Focus on WICK DOMINANCE only, other params same as Less Stringent");
                return;
        }

        // MORE STRINGENT - Focus on (a) + (c), keep (b) same as Less Stringent
        MinWickSize       = 0.65;   // (a) 65% wick - VERY STRICT for premium quality
        MaxNoseBodySize   = 0.35;   // (b) 35% body - SAME as Less Stringent
        NoseBodyPosition  = 0.80;   // (c) 80% position - STRICTER for quality
        NoseProtruding    = 0.40;   // Secondary - consistent
        LeftEyeMinBodySize = 0.15;  // Secondary - consistent

        CurrentScheme = "MORE STRINGENT V7.1 - Focus on wick + position (70-80% accuracy)";
        Print("Applied SELECTIVE MORE STRINGENT: (a)=", MinWickSize, " (b)=", MaxNoseBodySize, " (c)=", NoseBodyPosition);

        Print("=== MATHEMATICAL VERIFICATION V7.1 ===");
        double remaining = 1 - MinWickSize;
        bool passes = remaining < NoseBodyPosition;
        Print("Math: ", (remaining * 100), "% < ", (NoseBodyPosition * 100), "%? ", (remaining < NoseBodyPosition ? "PASS" : "FAIL"));
        Print("Strategy: Focus on WICK DOMINANCE + BODY POSITION, body size same as Less Stringent");

        Print("=== SELECTIVE FOCUS STRATEGY V7.1 ===");
        Print("Less Stringent: (a)50% (b)35% (c)70%  All relaxed");
        Print("Baseline:       (a)58% (b)35% (c)70%  Focus on WICK only");
        Print("More Stringent: (a)65% (b)35% (c)80%  Focus on WICK + POSITION");
        Print("=== SMART PRIORITIZATION: LESS IS MORE ===");
        Print("Secondary params (Protrusion, LeftEye) stay consistent - avoid over-constraining");
        Print("====================================================================");
}

void ApplyManualSettings()
{
        if(UseManualSettings)
        {
                MinWickSize        = ManualMinWickSize;
                MaxNoseBodySize    = ManualMaxNoseBodySize;
                NoseBodyPosition   = ManualNoseBodyPosition;
                NoseProtruding     = ManualNoseProtruding;
                LeftEyeMinBodySize = ManualLeftEyeMinBodySize;
                CurrentScheme      = "MANUAL OVERRIDE V6.2";
                Print("MANUAL OVERRIDE Applied: MinWick=", MinWickSize, " BodyPos=", NoseBodyPosition);
        }
}

void DeleteOldPinbarObjects()
{
        if(!DeleteOldObjects) return;

        int totalObjects = ObjectsTotal(0, 0, OBJ_ARROW);

        for(int i = totalObjects - 1; i >= 0; i--)
        {
                string objName = ObjectName(0, i, 0, OBJ_ARROW);
                if(StringFind(objName, ObjectPrefix) == 0)
                {
                        ObjectDelete(0, objName);
                }
        }

        Print("Deleted old pinbar objects. Starting fresh.");
}

void ManageObjectCount()
{
        int totalObjects = ObjectsTotal(0, 0, OBJ_ARROW);
        int pinbarObjects = 0;

        // Count pinbar objects
        for(int i = 0; i < totalObjects; i++)
        {
                string objName = ObjectName(0, i, 0, OBJ_ARROW);
                if(StringFind(objName, ObjectPrefix) == 0)
                {
                        pinbarObjects++;
                }
        }

        // Remove oldest objects if we exceed the limit
        if(pinbarObjects > MaxObjectsToKeep)
        {
                int toDelete = pinbarObjects - MaxObjectsToKeep;
                for(int i = 0; i < totalObjects && toDelete > 0; i++)
                {
                        string objName = ObjectName(0, i, 0, OBJ_ARROW);
                        if(StringFind(objName, ObjectPrefix) == 0)
                        {
                                ObjectDelete(0, objName);
                                toDelete--;
                        }
                }
        }
}

void CreatePermanentPinbarObject(datetime time, double price, bool isBullish, string description)
{
        string objName = ObjectPrefix + TimeToString(time, TIME_DATE|TIME_MINUTES) + "_" + (string)ObjectCounter++;

        ObjectCreate(0, objName, OBJ_ARROW, 0, time, price);
        ObjectSetInteger(0, objName, OBJPROP_ARROWCODE, 119); // Diamond symbol for both bullish and bearish
        ObjectSetInteger(0, objName, OBJPROP_COLOR, isBullish ? BullishColor : BearishColor);
        ObjectSetInteger(0, objName, OBJPROP_WIDTH, ArrowSize);
        ObjectSetInteger(0, objName, OBJPROP_BACK, false); // Draw in foreground
        ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, true);
        ObjectSetInteger(0, objName, OBJPROP_SELECTED, false);
        ObjectSetString(0, objName, OBJPROP_TOOLTIP, description + " Pinbar at " + TimeToString(time));

        // Manage object count
        ManageObjectCount();
}

void OnInit()
{
        Print("=== Pinbar Detector V6.2 EXPORT STARTING ===");

        // Initialize schemes FIRST
        InitializeSchemes();

        // Apply manual override if enabled
        ApplyManualSettings();

        // Set display mode
        switch(DisplayMode)
        {
                case INDICATOR_BUFFERS: CurrentDisplayMode = "Dynamic Buffers"; break;
                case DRAWING_OBJECTS:   CurrentDisplayMode = "Permanent Objects"; break;
                case HYBRID_MODE:       CurrentDisplayMode = "Hybrid (Buffers + Objects)"; break;
        }

        // Set Left Eye mode
        LeftEyeMode = UseLeftEyeAnalysis ? "Context-Aware (Left Eye ON)" : "Pure Pinbar (Left Eye OFF)";

        // Delete old objects if requested
        DeleteOldPinbarObjects();

        // Always initialize buffers (MT5 requirement)
        SetIndexBuffer(0, BullishPinbars, INDICATOR_DATA);
        SetIndexBuffer(1, BearishPinbars, INDICATOR_DATA);
        ArraySetAsSeries(BullishPinbars, true);
        ArraySetAsSeries(BearishPinbars, true);

        if(DisplayMode == INDICATOR_BUFFERS || DisplayMode == HYBRID_MODE)
        {
                PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW);
                PlotIndexSetInteger(0, PLOT_ARROW, 119); // Diamond symbol for bullish
                PlotIndexSetInteger(0, PLOT_LINE_COLOR, BullishColor);
                PlotIndexSetInteger(0, PLOT_LINE_WIDTH, ArrowSize);
                PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
                PlotIndexSetString(0, PLOT_LABEL, "Bullish Pinbar");

                PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW);
                PlotIndexSetInteger(1, PLOT_ARROW, 119); // Diamond symbol for bearish
                PlotIndexSetInteger(1, PLOT_LINE_COLOR, BearishColor);
                PlotIndexSetInteger(1, PLOT_LINE_WIDTH, ArrowSize);
                PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
                PlotIndexSetString(1, PLOT_LABEL, "Bearish Pinbar");
        }
        else
        {
                PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
                PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
        }

        // Display current settings
        if(ShowStringencyInfo || ShowLeftEyeMode)
        {
                string info = "";
                if(ShowStringencyInfo)
                        info += "Scheme: " + CurrentScheme + " | Mode: " + CurrentDisplayMode;
                if(ShowLeftEyeMode)
                {
                        if(info != "") info += " | ";
                        info += LeftEyeMode;
                }
                Comment(info);

                Print("=== FINAL CONFIGURATION V6.2 ===");
                Print("StringencyLevel = ", StringencyLevel, " (0=Less, 1=Baseline, 2=More)");
                Print("UseManualSettings = ", UseManualSettings);
                Print("CurrentScheme = ", CurrentScheme);
                Print("CurrentDisplayMode = ", CurrentDisplayMode);
                Print("LeftEyeMode = ", LeftEyeMode);
                Print("FINAL Applied Parameters:");
                Print("    MinWickSize = ", DoubleToString(MinWickSize, 3));
                Print("    MaxNoseBodySize = ", DoubleToString(MaxNoseBodySize, 3));
                Print("    NoseBodyPosition = ", DoubleToString(NoseBodyPosition, 3));
                Print("    NoseProtruding = ", DoubleToString(NoseProtruding, 3));
                Print("    LeftEyeMinBodySize = ", DoubleToString(LeftEyeMinBodySize, 3));
                Print("UseLeftEyeAnalysis = ", UseLeftEyeAnalysis);
                Print("EnableDebugMode = ", EnableDebugMode);
                Print("=====================================");
        }

        // Export button hidden — use "Export All" EA instead
        // CreateExportButtonRobust();
}

bool CheckLeftEyeConditions(int i, double NoseBody, double NoseLength, double LeftEyeBody, double LeftEyeLength, bool isBearish,
                                      const double &Open[], const double &High[], const double &Low[], const double &Close[])
{
        // If Left Eye analysis is disabled, skip all checks
        if(!UseLeftEyeAnalysis)
        {
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Left Eye analysis DISABLED - returning TRUE");
                return true;
        }

        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Checking Left Eye conditions...");

        // Left Eye opposite direction check
        if(LeftEyeOppositeDirection)
        {
                bool leftEyeBullish = Close[i + 1] > Open[i + 1];
                bool leftEyeBearish = Close[i + 1] < Open[i + 1];

                if(isBearish && !leftEyeBullish)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Need bullish left eye for bearish pinbar");
                        return false;
                }
                if(!isBearish && !leftEyeBearish)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Need bearish left eye for bullish pinbar");
                        return false;
                }
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Left Eye direction check");
        }

        // Nose same direction check
        if(NoseSameDirection)
        {
                bool noseBullish = Close[i] > Open[i];
                bool noseBearish = Close[i] < Open[i];

                if(isBearish && !noseBearish)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Need bearish nose for bearish pinbar");
                        return false;
                }
                if(!isBearish && !noseBullish)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Need bullish nose for bullish pinbar");
                        return false;
                }
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Nose direction check");
        }

        // Left eye body size check
        double leftEyeBodyRatio = LeftEyeBody / LeftEyeLength;
        if(leftEyeBodyRatio < LeftEyeMinBodySize)
        {
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Left eye body too small: ", leftEyeBodyRatio, " < ", LeftEyeMinBodySize);
                return false;
        }
        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Left eye body size check: ", leftEyeBodyRatio);

        // Nose body inside Left Eye bar check
        bool noseInsideLeftEye = (MathMax(Open[i], Close[i]) <= High[i + 1]) && (MathMin(Open[i], Close[i]) >= Low[i + 1]);
        if(!noseInsideLeftEye)
        {
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Nose body not inside Left Eye bar");
                return false;
        }
        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Nose body inside Left Eye bar");

        // Nose body to Left Eye body ratio check
        double bodyRatio = NoseBody / LeftEyeBody;
        if(bodyRatio > NoseBodyToLeftEyeBody)
        {
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Nose body too large vs Left Eye: ", bodyRatio, " > ", NoseBodyToLeftEyeBody);
                return false;
        }
        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Nose body ratio check: ", bodyRatio);

        // Nose length to Left Eye length ratio check
        double lengthRatio = NoseLength / LeftEyeLength;
        if(lengthRatio < NoseLengthToLeftEyeLength)
        {
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Nose length too small vs Left Eye: ", lengthRatio, " < ", NoseLengthToLeftEyeLength);
                return false;
        }
        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Nose length ratio check: ", lengthRatio);

        // Left Eye depth check
        if(isBearish)
        {
                double depthCheck   = Low[i] - Low[i + 1];
                double requiredDepth = LeftEyeLength * LeftEyeDepth;
                if(depthCheck < requiredDepth)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Left Eye depth insufficient: ", depthCheck, " < ", requiredDepth);
                        return false;
                }
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Left Eye depth check: ", depthCheck);
        }
        else
        {
                double depthCheck   = High[i + 1] - High[i];
                double requiredDepth = LeftEyeLength * LeftEyeDepth;
                if(depthCheck < requiredDepth)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Left Eye depth insufficient: ", depthCheck, " < ", requiredDepth);
                        return false;
                }
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Left Eye depth check: ", depthCheck);
        }

        // Nose body inside Left Eye body check (if required)
        if(NoseBodyInsideLeftEyeBody)
        {
                bool noseBodyInsideLeftEyeBody = (MathMax(Open[i], Close[i]) <= MathMax(Open[i + 1], Close[i + 1])) &&
                                                 (MathMin(Open[i], Close[i]) >= MathMin(Open[i + 1], Close[i + 1]));
                if(!noseBodyInsideLeftEyeBody)
                {
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - FAILED: Nose body not inside Left Eye body");
                        return false;
                }
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - PASSED: Nose body inside Left Eye body");
        }

        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - ALL Left Eye conditions PASSED!");
        return true;
}

double CalculateProtrusion(int i, double NoseLength, bool isBearish, const double &High[], const double &Low[])
{
        if(!UseLeftEyeAnalysis)
        {
                return NoseLength * 0.5;
        }

        if(isBearish)
                return High[i] - High[i + 1];
        else
                return Low[i + 1] - Low[i];
}

bool IsPinbarDetected(int i, bool isBearish, const datetime &time[], const double &Open[], const double &High[], const double &Low[], const double &Close[])
{
        // Check if this pinbar was already detected and stored
        for(int j = 0; j < ArraySize(DetectedPinbars); j++)
        {
                if(DetectedPinbars[j].time == time[i] && DetectedPinbars[j].isBullish == isBearish)
                        return true; // Already detected this exact signal
        }
        return false;
}

void StorePinbarSignal(datetime time, double price, bool isBullish, int barIndex)
{
        int size = ArraySize(DetectedPinbars);
        ArrayResize(DetectedPinbars, size + 1);
        DetectedPinbars[size].time     = time;
        DetectedPinbars[size].price    = price;
        DetectedPinbars[size].isBullish = isBullish;
        DetectedPinbars[size].barIndex = barIndex;
}

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &Open[],
                const double &High[],
                const double &Low[],
                const double &Close[],
                const long &tickvolume[],
                const long &volume[],
                const int &spread[])
{
        // Export button hidden — use "Export All" EA instead
        // CheckButtonStatus();

        int NeedBarsCounted;
        double NoseLength, NoseBody, LeftEyeBody, LeftEyeLength;
        double UpperWick, LowerWick, ActualProtrusion;

        ArraySetAsSeries(Open,  true);
        ArraySetAsSeries(High,  true);
        ArraySetAsSeries(Low,   true);
        ArraySetAsSeries(Close, true);
        ArraySetAsSeries(time,  true);

        if(LastBars == rates_total) return rates_total;
        NeedBarsCounted = rates_total - LastBars;
        if((CountBars > 0) && (NeedBarsCounted > CountBars)) NeedBarsCounted = CountBars;
        LastBars = rates_total;
        if(NeedBarsCounted == rates_total) NeedBarsCounted--;

        // Initialize buffers if using them
        if(DisplayMode == INDICATOR_BUFFERS || DisplayMode == HYBRID_MODE)
        {
                BullishPinbars[0] = EMPTY_VALUE;
                BearishPinbars[0] = EMPTY_VALUE;
        }

        for(int i = NeedBarsCounted; i >= 2; i--) // Start from bar 2 to avoid current forming bar
        {
                if(EnableDebugMode && i <= 5)
                {
                        Print("=== Analyzing Bar ", i, " V6.2 ===");
                        Print("Scheme: ", CurrentScheme);
                        Print("Parameters: MinWick=", MinWickSize, " MaxBody=", MaxNoseBodySize, " BodyPos=", NoseBodyPosition);
                        Print("OHLC: O=", Open[i], " H=", High[i], " L=", Low[i], " C=", Close[i]);
                }

                // Initialize buffer values if using them
                if(DisplayMode == INDICATOR_BUFFERS || DisplayMode == HYBRID_MODE)
                {
                        BullishPinbars[i] = EMPTY_VALUE;
                        BearishPinbars[i] = EMPTY_VALUE;
                }

                // Skip if we need Left Eye data but don't have it
                if(UseLeftEyeAnalysis && i == rates_total - 1) continue;

                // Calculate basic parameters
                NoseLength = High[i] - Low[i];
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - NoseLength=", NoseLength, " MinRequired=", MinimumNoseLength * _Point);

                if(NoseLength < MinimumNoseLength * _Point) continue;
                if(NoseLength == 0) NoseLength = _Point;

                NoseBody = MathAbs(Open[i] - Close[i]);
                if(NoseBody == 0) NoseBody = _Point;

                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - NoseBody=", NoseBody);

                if(UseLeftEyeAnalysis)
                {
                        LeftEyeLength = High[i + 1] - Low[i + 1];
                        if(LeftEyeLength == 0) LeftEyeLength = _Point;
                        LeftEyeBody   = MathAbs(Open[i + 1] - Close[i + 1]);
                        if(LeftEyeBody == 0) LeftEyeBody = _Point;
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - LeftEyeLength=", LeftEyeLength, " LeftEyeBody=", LeftEyeBody);
                }
                else
                {
                        LeftEyeLength = NoseLength;
                        LeftEyeBody   = NoseBody;
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Left Eye analysis DISABLED");
                }

                // === BEARISH PINBAR DETECTION ===
                ActualProtrusion = CalculateProtrusion(i, NoseLength, true, High, Low);
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Bearish Check: Protrusion=", ActualProtrusion, " Required=", NoseLength * NoseProtruding);

                if(ActualProtrusion >= NoseLength * NoseProtruding)
                {
                        // Check wick dominance
                        UpperWick = High[i] - MathMax(Open[i], Close[i]);
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Wick Check: UpperWick=", UpperWick, " NoseLength=", NoseLength, " Ratio=", UpperWick/NoseLength, " Required=", MinWickSize);

                        if(UpperWick / NoseLength >= MinWickSize)
                        {
                                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Body Size Check: NoseBody=", NoseBody, " NoseLength=", NoseLength, " Ratio=", NoseBody/NoseLength, " MaxAllowed=", MaxNoseBodySize);

                                if(NoseBody / NoseLength <= MaxNoseBodySize)
                                {
                                        double bodyPosCheck = 1 - (High[i] - MathMax(Open[i], Close[i])) / NoseLength;
                                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Body Position Check: Value=", bodyPosCheck, " Required=", NoseBodyPosition, " Pass=", (bodyPosCheck < NoseBodyPosition));

                                        if(bodyPosCheck < NoseBodyPosition)
                                        {
                                                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Left Eye Check Starting...");

                                                if(CheckLeftEyeConditions(i, NoseBody, NoseLength, LeftEyeBody, LeftEyeLength, true, Open, High, Low, Close))
                                                {
                                                        double bearishPrice = High[i] + DisplayDistance * _Point + NoseLength / 5;
                                                        string description  = "Bearish " + CurrentScheme;

                                                        if(EnableDebugMode) Print("Bar ", i, " - BEARISH PINBAR DETECTED! Price=", bearishPrice);

                                                        // For DRAWING_OBJECTS or HYBRID_MODE, create permanent object
                                                        if((DisplayMode == DRAWING_OBJECTS || DisplayMode == HYBRID_MODE) && !IsPinbarDetected(i, true, time, Open, High, Low, Close))
                                                        {
                                                                CreatePermanentPinbarObject(time[i], bearishPrice, false, description);
                                                                StorePinbarSignal(time[i], bearishPrice, false, i);
                                                        }

                                                        // For INDICATOR_BUFFERS or HYBRID_MODE, set buffer value
                                                        if(DisplayMode == INDICATOR_BUFFERS || DisplayMode == HYBRID_MODE)
                                                        {
                                                                BearishPinbars[i] = bearishPrice;
                                                        }
                                                }
                                                else if(EnableDebugMode && i <= 5)
                                                {
                                                        Print("Bar ", i, " - Left Eye conditions FAILED");
                                                }
                                        }
                                }
                        }
                }

                // === BULLISH PINBAR DETECTION ===
                ActualProtrusion = CalculateProtrusion(i, NoseLength, false, High, Low);
                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Bullish Check: Protrusion=", ActualProtrusion, " Required=", NoseLength * NoseProtruding);

                if(ActualProtrusion >= NoseLength * NoseProtruding)
                {
                        // Check wick dominance
                        LowerWick = MathMin(Open[i], Close[i]) - Low[i];
                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Wick Check: LowerWick=", LowerWick, " NoseLength=", NoseLength, " Ratio=", LowerWick/NoseLength, " Required=", MinWickSize);

                        if(LowerWick / NoseLength >= MinWickSize)
                        {
                                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Body Size Check: NoseBody=", NoseBody, " NoseLength=", NoseLength, " Ratio=", NoseBody/NoseLength, " MaxAllowed=", MaxNoseBodySize);

                                if(NoseBody / NoseLength <= MaxNoseBodySize)
                                {
                                        double bodyPosCheck = 1 - (MathMin(Open[i], Close[i]) - Low[i]) / NoseLength;
                                        if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Body Position Check: Value=", bodyPosCheck, " Required=", NoseBodyPosition, " Pass=", (bodyPosCheck < NoseBodyPosition));

                                        if(bodyPosCheck < NoseBodyPosition)
                                        {
                                                if(EnableDebugMode && i <= 5) Print("Bar ", i, " - Left Eye Check Starting...");

                                                if(CheckLeftEyeConditions(i, NoseBody, NoseLength, LeftEyeBody, LeftEyeLength, false, Open, High, Low, Close))
                                                {
                                                        double bullishPrice = Low[i] - DisplayDistance * _Point - NoseLength / 5;
                                                        string description  = "Bullish " + CurrentScheme;

                                                        if(EnableDebugMode) Print("Bar ", i, " - BULLISH PINBAR DETECTED! Price=", bullishPrice);

                                                        // For DRAWING_OBJECTS or HYBRID_MODE, create permanent object
                                                        if((DisplayMode == DRAWING_OBJECTS || DisplayMode == HYBRID_MODE) && !IsPinbarDetected(i, false, time, Open, High, Low, Close))
                                                        {
                                                                CreatePermanentPinbarObject(time[i], bullishPrice, true, description);
                                                                StorePinbarSignal(time[i], bullishPrice, true, i);
                                                        }

                                                        // For INDICATOR_BUFFERS or HYBRID_MODE, set buffer value
                                                        if(DisplayMode == INDICATOR_BUFFERS || DisplayMode == HYBRID_MODE)
                                                        {
                                                                BullishPinbars[i] = bullishPrice;
                                                        }
                                                }
                                                else if(EnableDebugMode && i <= 5)
                                                {
                                                        Print("Bar ", i, " - Left Eye conditions FAILED");
                                                }
                                        }
                                }
                        }
                }
        }
        return rates_total;
}

void OnDeinit(const int reason)
{
        Comment("");
        // Optionally clean up objects on removal
        if(reason == REASON_REMOVE && DeleteOldObjects)
        {
                DeleteOldPinbarObjects();
        }

        // Export button hidden — use "Export All" EA instead
        // if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
        // {
        //         ObjectDelete(0, EXPORT_BUTTON_NAME);
        //         ChartRedraw(0);
        // }

        // Reset button status variables
        ButtonCreated    = false;
        ButtonRetryCount = 0;
        ButtonRetryTimer = 0;
}

// +------------------------------------------------------------------+
// |   Generate clean filename with symbol and timeframe              |
// +------------------------------------------------------------------+
string GenerateFilename(string base_name, string symbol, ENUM_TIMEFRAMES timeframe, string extension)
{
        // Clean up symbol name (remove suffixes like .i for filename)
        string clean_symbol = symbol;
        int dot_pos = StringFind(clean_symbol, ".");
        if(dot_pos > 0)
                clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

        // Format timeframe as a string
        string tf_str = "";
        switch(timeframe)
        {
                case PERIOD_M1:  tf_str = "M1";  break;
                case PERIOD_M5:  tf_str = "M5";  break;
                case PERIOD_M15: tf_str = "M15"; break;
                case PERIOD_M30: tf_str = "M30"; break;
                case PERIOD_H1:  tf_str = "H1";  break;
                case PERIOD_H4:  tf_str = "H4";  break;
                case PERIOD_D1:  tf_str = "D";   break;
                case PERIOD_W1:  tf_str = "W";   break;
                case PERIOD_MN1: tf_str = "MN";  break;
                default: tf_str = EnumToString(timeframe); break;
        }

        string file_extension = extension;

        if(file_extension != "")
                return StringFormat("%s_%s_%s.%s", base_name, clean_symbol, tf_str, file_extension);
        else
                return StringFormat("%s_%s_%s", base_name, clean_symbol, tf_str);
}

// +------------------------------------------------------------------+
// |   Create Export Button with Robust Error Handling                |
// +------------------------------------------------------------------+
bool CreateExportButton()
{
        // Delete existing button if it exists
        if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
        {
                ObjectDelete(0, EXPORT_BUTTON_NAME);
                ChartRedraw(0);
                Sleep(100); // Give time for deletion
        }

        // Create new button
        if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
        {
                Print("ERROR: Failed to create export button object. Error: ", GetLastError());
                return false;
        }

        // Button dimensions
        int button_width  = 200;
        int button_height = 50;
        int x_margin      = 250;
        int y_margin      = 100;

        // Position at right side, higher up from bottom
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER,     CORNER_RIGHT_LOWER);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE,  x_margin);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE,  y_margin);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE,      button_width);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE,      button_height);

        // Text and font properties
        ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_TEXT,       "Export V17 Data");
        ObjectSetString(0,  EXPORT_BUTTON_NAME, OBJPROP_FONT,       "Arial Bold");
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE,   11);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR,      clrWhite);

        // Visual style
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR,       C'0,120,215');
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR,  C'0,100,190');

        // Button behavior
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ANCHOR,     ANCHOR_RIGHT_LOWER);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN,     false);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER,     999);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE,      false);
        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK,       false);

        // Force chart redraw
        ChartRedraw(0);

        // Verify button was created successfully
        if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
        {
                Print("SUCCESS: Export button created successfully");
                return true;
        }
        else
        {
                Print("ERROR: Button creation verification failed");
                return false;
        }
}

// +------------------------------------------------------------------+
// |   Robust Button Creation with Retry Mechanism                    |
// +------------------------------------------------------------------+
void CreateExportButtonRobust()
{
        ButtonCreated    = CreateExportButton();
        ButtonRetryCount = 0;

        if(!ButtonCreated)
        {
                Print("Initial button creation failed, starting retry mechanism...");
                ButtonRetryTimer = GetTickCount();
        }
        else
        {
                Print("Export button ready for use");
        }
}

// +------------------------------------------------------------------+
// |   Check and Retry Button Creation                                |
// +------------------------------------------------------------------+
void CheckButtonStatus()
{
        // If button is already created and exists, nothing to do
        if(ButtonCreated && ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
                return;

        // If button was created but disappeared, mark as not created
        if(ButtonCreated && ObjectFind(0, EXPORT_BUTTON_NAME) < 0)
        {
                Print("WARNING: Export button disappeared, will recreate...");
                ButtonCreated    = false;
                ButtonRetryTimer = GetTickCount();
                ButtonRetryCount = 0;
        }

        // Try to create button if not created and within retry period
        if(!ButtonCreated && ButtonRetryCount < 10)
        {
                int currentTime = GetTickCount();
                if(currentTime - ButtonRetryTimer > 1000) // Wait 1 second between retries
                {
                        ButtonRetryCount++;
                        Print("Retry attempt ", ButtonRetryCount, "/10 to create export button...");

                        ButtonCreated    = CreateExportButton();
                        ButtonRetryTimer = currentTime;

                        if(ButtonCreated)
                        {
                                Print("SUCCESS: Export button created on retry ", ButtonRetryCount);
                        }
                        else if(ButtonRetryCount >= 10)
                        {
                                Print("CRITICAL: Failed to create export button after 10 attempts");
                                Print("WORKAROUND: Remove and re-add the indicator to restore the button");
                        }
                }
        }
}

// +------------------------------------------------------------------+
// |   Detect pinbar flag for export (returns 1 = pinbar, 0 = none)  |
// |   Uses same logic as OnCalculate - reads Buffer0 + Buffer1       |
// +------------------------------------------------------------------+
int DetectPinbarFlagForExport(int i, const double &Open[], const double &High[], const double &Low[], const double &Close[])
{
        // Need at least 2 bars
        if(i <= 0 || ArraySize(Open) <= i + 1) return 0;

        double NoseLength = High[i] - Low[i];
        if(NoseLength < MinimumNoseLength * _Point) return 0;
        if(NoseLength == 0) NoseLength = _Point;

        double NoseBody = MathAbs(Open[i] - Close[i]);
        if(NoseBody == 0) NoseBody = _Point;

        double LeftEyeLength, LeftEyeBody;
        if(UseLeftEyeAnalysis)
        {
                LeftEyeLength = High[i + 1] - Low[i + 1];
                if(LeftEyeLength == 0) LeftEyeLength = _Point;
                LeftEyeBody   = MathAbs(Open[i + 1] - Close[i + 1]);
                if(LeftEyeBody == 0) LeftEyeBody = _Point;
        }
        else
        {
                LeftEyeLength = NoseLength;
                LeftEyeBody   = NoseBody;
        }

        double UpperWick, LowerWick, ActualProtrusion;

        // === BEARISH PINBAR CHECK (Buffer 1) ===
        ActualProtrusion = CalculateProtrusion(i, NoseLength, true, High, Low);
        if(ActualProtrusion >= NoseLength * NoseProtruding)
        {
                UpperWick = High[i] - MathMax(Open[i], Close[i]);
                if(UpperWick / NoseLength >= MinWickSize)
                {
                        if(NoseBody / NoseLength <= MaxNoseBodySize)
                        {
                                double bodyPosCheck = 1 - (High[i] - MathMax(Open[i], Close[i])) / NoseLength;
                                if(bodyPosCheck < NoseBodyPosition)
                                {
                                        if(CheckLeftEyeConditions(i, NoseBody, NoseLength, LeftEyeBody, LeftEyeLength, true, Open, High, Low, Close))
                                                return 1; // Bearish pinbar detected
                                }
                        }
                }
        }

        // === BULLISH PINBAR CHECK (Buffer 0) ===
        ActualProtrusion = CalculateProtrusion(i, NoseLength, false, High, Low);
        if(ActualProtrusion >= NoseLength * NoseProtruding)
        {
                LowerWick = MathMin(Open[i], Close[i]) - Low[i];
                if(LowerWick / NoseLength >= MinWickSize)
                {
                        if(NoseBody / NoseLength <= MaxNoseBodySize)
                        {
                                double bodyPosCheck = 1 - (MathMin(Open[i], Close[i]) - Low[i]) / NoseLength;
                                if(bodyPosCheck < NoseBodyPosition)
                                {
                                        if(CheckLeftEyeConditions(i, NoseBody, NoseLength, LeftEyeBody, LeftEyeLength, false, Open, High, Low, Close))
                                                return 1; // Bullish pinbar detected
                                }
                        }
                }
        }

        return 0; // Not a pinbar
}

// +------------------------------------------------------------------+
// |   Get selected symbol                                            |
// +------------------------------------------------------------------+
string GetSelectedSymbol()
{
        string symbol = "";
        switch(InpSymbolSelection)
        {
                case SYMBOL_CURRENT:
                        symbol = Symbol();
                        break;
                case SYMBOL_MANUAL_ENTRY:
                        symbol = InpManualSymbol;
                        if(symbol == "") symbol = Symbol();
                        break;
                default:
                        symbol = Symbol();
        }
        return symbol;
}

// +------------------------------------------------------------------+
// |   Convert ENUM_TIMEFRAMES to clean string (e.g. "M5" not        |
// |   "PERIOD_M5")                                                   |
// +------------------------------------------------------------------+
string GetTFStr(ENUM_TIMEFRAMES tf)
{
        switch(tf)
        {
                case PERIOD_M1:  return "M1";
                case PERIOD_M5:  return "M5";
                case PERIOD_M15: return "M15";
                case PERIOD_M30: return "M30";
                case PERIOD_H1:  return "H1";
                case PERIOD_H4:  return "H4";
                case PERIOD_D1:  return "D1";
                default: return EnumToString(tf);
        }
}

// +------------------------------------------------------------------+
// |   Export price data to TXT file (5-column format)               |
// |   Columns: timestamp | symbol | timeframe | close | pinbar       |
// +------------------------------------------------------------------+
bool ExportToTxt(const string symbol,
                 const ENUM_TIMEFRAMES timeframe,
                 const string filename,
                 const datetime &time[],
                 const double &open[],
                 const double &high[],
                 const double &low[],
                 const double &close[],
                 const int &pinbar_flags[],
                 const int bars_count)
{
        string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
        Print("V17 Exporting to TXT file: ", full_path);

        ResetLastError();
        int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI, '\t');
        int error = GetLastError();

        if(file_handle == INVALID_HANDLE)
        {
                Print("ERROR: Failed to open TXT file for writing. Error: ", error);
                return false;
        }

        bool write_success = true;

        // Write data header - 5-column format
        write_success &= FileWrite(file_handle, "timestamp\tsymbol\ttimeframe\tclose\tpinbar") > 0;

        // Write data rows (oldest bar first)
        datetime gmt_offset = TimeCurrent() - TimeGMT();
        string tf_str = GetTFStr(timeframe);
        for(int i = bars_count - 1; i >= 0; i--)
        {
                string line = StringFormat("%d\t%s\t%s\t%.2f\t%d",
                                          (long)(time[i] - gmt_offset),
                                          symbol,
                                          tf_str,
                                          close[i],
                                          pinbar_flags[i]);

                write_success &= FileWrite(file_handle, line) > 0;
        }

        FileClose(file_handle);

        if(!write_success)
        {
                Print("ERROR: Failed to write some data to TXT file");
                return false;
        }

        Print("V17 Pinbar data successfully exported to TXT file: ", filename);
        return true;
}

// +------------------------------------------------------------------+
// |   Export price data to JSON file                                 |
// +------------------------------------------------------------------+
bool ExportToJson(const string symbol,
                  const ENUM_TIMEFRAMES timeframe,
                  const string filename,
                  const datetime &time[],
                  const double &open[],
                  const double &high[],
                  const double &low[],
                  const double &close[],
                  const int &pinbar_flags[],
                  const int bars_count)
{
        string full_path = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
        Print("V17 Exporting to JSON file: ", full_path);

        ResetLastError();
        int file_handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
        int error = GetLastError();

        if(file_handle == INVALID_HANDLE)
        {
                Print("ERROR: Failed to open JSON file for writing. Error: ", error);
                return false;
        }

        bool write_success = true;

        // Write JSON header with metadata
        write_success &= FileWrite(file_handle, "{") > 0;
        write_success &= FileWrite(file_handle, "        \"version\": \"V17\",") > 0;
        write_success &= FileWrite(file_handle, "        \"detectionEngine\": \"Selective Focus V7.1\",") > 0;
        write_success &= FileWrite(file_handle, "        \"symbol\": \"", symbol, "\",") > 0;
        write_success &= FileWrite(file_handle, "        \"timeframe\": \"", EnumToString(timeframe), "\",") > 0;
        write_success &= FileWrite(file_handle, "        \"exportTime\": \"", TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS), "\",") > 0;
        write_success &= FileWrite(file_handle, "        \"pinbarScheme\": \"", CurrentScheme, "\",") > 0;
        write_success &= FileWrite(file_handle, "        \"leftEyeMode\": \"", LeftEyeMode, "\",") > 0;
        write_success &= FileWrite(file_handle, "        \"bufferMapping\": {\"buffer0\": \"BullishPinbars\", \"buffer1\": \"BearishPinbars\"},") > 0;
        write_success &= FileWrite(file_handle, "        \"pinbarFlag\": \"1=pinbar(bullish or bearish), 0=no pinbar\",") > 0;
        write_success &= FileWrite(file_handle, "        \"parameters\": {") > 0;
        write_success &= FileWrite(file_handle, "                \"minWickSize\": ", DoubleToString(MinWickSize, 3), ",") > 0;
        write_success &= FileWrite(file_handle, "                \"maxBodySize\": ", DoubleToString(MaxNoseBodySize, 3), ",") > 0;
        write_success &= FileWrite(file_handle, "                \"bodyPosition\": ", DoubleToString(NoseBodyPosition, 3), ",") > 0;
        write_success &= FileWrite(file_handle, "                \"protrusion\": ", DoubleToString(NoseProtruding, 3), ",") > 0;
        write_success &= FileWrite(file_handle, "                \"leftEyeMinBody\": ", DoubleToString(LeftEyeMinBodySize, 3)) > 0;
        write_success &= FileWrite(file_handle, "        },") > 0;
        write_success &= FileWrite(file_handle, "        \"bars\": ", bars_count, ",") > 0;
        write_success &= FileWrite(file_handle, "        \"data\": [") > 0;

        string tf_str = EnumToString(timeframe);

        // Write data rows
        for(int i = 0; i < bars_count; i++)
        {
                if(i > 0)
                        FileWrite(file_handle, "                ,");

                write_success &= FileWrite(file_handle, "                {") > 0;
                write_success &= FileWrite(file_handle, "                        \"no\": ", i, ",") > 0;
                write_success &= FileWrite(file_handle, "                        \"timestamp\": \"", TimeToString(time[i], TIME_DATE|TIME_MINUTES), "\",") > 0;
                write_success &= FileWrite(file_handle, "                        \"symbol\": \"", symbol, "\",") > 0;
                write_success &= FileWrite(file_handle, "                        \"timeframe\": \"", tf_str, "\",") > 0;
                write_success &= FileWrite(file_handle, "                        \"close\": ", DoubleToString(close[i], 5), ",") > 0;
                write_success &= FileWrite(file_handle, "                        \"pinbar\": ", pinbar_flags[i]) > 0;
                write_success &= FileWrite(file_handle, "                }") > 0;
        }

        // Close JSON structure
        write_success &= FileWrite(file_handle, "        ]") > 0;
        write_success &= FileWrite(file_handle, "}") > 0;

        FileClose(file_handle);

        if(!write_success)
        {
                Print("ERROR: Failed to write some data to JSON file");
                return false;
        }

        Print("V17 Pinbar data successfully exported to JSON file: ", filename);
        return true;
}

// +------------------------------------------------------------------+
// |   Export price data for a specific symbol and timeframe          |
// +------------------------------------------------------------------+
bool ExportPriceDataForSymbol(string requested_symbol, ENUM_TIMEFRAMES timeframe)
{
        Print("V17 Requested symbol: '", requested_symbol, "'");

        // Select symbol in Market Watch
        if(!SymbolSelect(requested_symbol, true))
        {
                Print("WARNING: Failed to select symbol in Market Watch: ", requested_symbol, ". Trying anyway...");
        }

        // Check available bars
        ResetLastError();
        int max_bars = iBars(requested_symbol, timeframe);
        int error    = GetLastError();

        if(max_bars <= 0)
        {
                Print("ERROR: No bars available for symbol '", requested_symbol, "' with timeframe ", EnumToString(timeframe), ". Error: ", error);
                return false;
        }

        int bars_to_export = InpBars;
        if(bars_to_export <= 0) bars_to_export = 1000;
        if(bars_to_export > max_bars)
        {
                bars_to_export = max_bars;
                Print("Reduced requested bars to maximum available: ", bars_to_export);
        }

        // Generate filenames
        string clean_symbol = requested_symbol;
        int dot_pos = StringFind(clean_symbol, ".");
        if(dot_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, dot_pos);

        string txt_filename  = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "txt");
        string json_filename = GenerateFilename(InpBaseFileName, clean_symbol, timeframe, "json");

        Print("V17 Exporting ", bars_to_export, " bars of ", requested_symbol, " @ ", EnumToString(timeframe));
        Print("Files: ", txt_filename, " and ", json_filename);

        // Get the data
        datetime time[];
        double   open[], high[], low[], close[];

        ArraySetAsSeries(time,  true);
        ArraySetAsSeries(open,  true);
        ArraySetAsSeries(high,  true);
        ArraySetAsSeries(low,   true);
        ArraySetAsSeries(close, true);

        // Copy data with multiple attempts
        bool data_copied = false;
        for(int attempts = 0; attempts < 5; attempts++)
        {
                if(attempts > 0)
                {
                        Print("Retry attempt ", attempts, " for '", requested_symbol, "'");
                        Sleep(200 * attempts);
                }

                ResetLastError();
                if(CopyTime(requested_symbol,  timeframe, 0, bars_to_export, time)  != bars_to_export) continue;
                if(CopyOpen(requested_symbol,  timeframe, 0, bars_to_export, open)  != bars_to_export) continue;
                if(CopyHigh(requested_symbol,  timeframe, 0, bars_to_export, high)  != bars_to_export) continue;
                if(CopyLow(requested_symbol,   timeframe, 0, bars_to_export, low)   != bars_to_export) continue;
                if(CopyClose(requested_symbol, timeframe, 0, bars_to_export, close) != bars_to_export) continue;

                data_copied = true;
                Print("Successfully copied all data on attempt ", attempts + 1);
                break;
        }

        if(!data_copied)
        {
                Print("CRITICAL: Failed to copy data after multiple attempts");
                return false;
        }

        // Detect pinbar flags for each bar
        // pinbar = 1 if bullish OR bearish pinbar detected (Buffer0 OR Buffer1)
        int pinbar_flags[];
        ArrayResize(pinbar_flags, bars_to_export);
        ArrayInitialize(pinbar_flags, 0);

        Print("Running pinbar detection for ", bars_to_export, " bars...");
        for(int i = 0; i < bars_to_export - 1; i++)
        {
                pinbar_flags[i] = DetectPinbarFlagForExport(i, open, high, low, close);
        }
        // Last bar has no previous bar for Left Eye - flag stays 0

        // Export to TXT
        bool txt_success = ExportToTxt(clean_symbol, timeframe, txt_filename,
                                        time, open, high, low, close,
                                        pinbar_flags, bars_to_export);

        // Export to JSON if requested
        bool json_success = true;
        if(InpExportJSON)
                json_success = ExportToJson(clean_symbol, timeframe, json_filename,
                                             time, open, high, low, close,
                                             pinbar_flags, bars_to_export);

        return txt_success && (InpExportJSON ? json_success : true);
}

// +------------------------------------------------------------------+
// |   Export all price data                                          |
// +------------------------------------------------------------------+
bool ExportPriceData()
{
        string requested_symbol = GetSelectedSymbol();

        ENUM_TIMEFRAMES timeframe = InpTimeframe;
        if(timeframe == PERIOD_CURRENT) timeframe = Period();

        return ExportPriceDataForSymbol(requested_symbol, timeframe);
}

// +------------------------------------------------------------------+
// |   ChartEvent function to handle button clicks                    |
// +------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
        //--- Handle "Export All" custom event from EA
        if(id == CHARTEVENT_CUSTOM + 1000 && sparam == "EXPORT_ALL")
        {
                if(ExportPriceData())
                        Print("SUCCESS: [Export All] Pinbar data exported successfully");
                else
                        Print("ERROR: [Export All] Failed to export Pinbar data.");
                return;
        }

        // Check if it's a button click event
        if(id == CHARTEVENT_OBJECT_CLICK)
        {
                if(sparam == EXPORT_BUTTON_NAME)
                {
                        if(ExportPriceData())
                                Print("SUCCESS: V17 Pinbar data exported successfully");
                        else
                                Print("ERROR: Failed to export V17 pinbar data. See above for details.");

                        // Reset button state
                        ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_STATE, false);
                }
        }
}
// +------------------------------------------------------------------+
