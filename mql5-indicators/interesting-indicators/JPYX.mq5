//+------------------------------------------------------------------+
//|                                           JPYX_Indicator.mq5     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.01"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrDodgerBlue
#property indicator_label1  "JPYX"

// Input parameters
input datetime InceptionDateTime = D'2023.01.02 14:00'; // Inception Date/Time
input double USDJPY_Weight = 0.142857;
input double EURJPY_Weight = 0.142857;
input double GBPJPY_Weight = 0.142857;
input double AUDJPY_Weight = 0.142857;
input double NZDJPY_Weight = 0.142857;
input double CADJPY_Weight = 0.142857;
input double CHFJPY_Weight = 0.142857;

// Inception exchange rates
input double USDJPY_Inception = 130.938;
input double EURJPY_Inception = 139.838;
input double GBPJPY_Inception = 157.915;
input double AUDJPY_Inception = 89.054;
input double NZDJPY_Inception = 82.820;
input double CADJPY_Inception = 96.663;
input double CHFJPY_Inception = 141.843;

// Buffer
double JPYXClose[];

// Global variables
double C_i;
string Symbols[7] = {"USDJPY.i", "EURJPY.i", "GBPJPY.i", "AUDJPY.i", "NZDJPY.i", "CADJPY.i", 

"CHFJPY.i"};
double Weights[7];
bool SymbolAvailable[7];

// Function declarations
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
bool CheckSymbolAvailability(string &symbol);
double CalculateJPYX(double usd, double eur, double gbp, double aud, double nzd, double cad, double 

chf);
void UpdateChartComment();

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, JPYXClose, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);  // Start drawing from the first candle

   // Set indicator properties
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrDodgerBlue);
   IndicatorSetString(INDICATOR_SHORTNAME, "JPYX Indicator");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   // Initialize weights
   Weights[0] = USDJPY_Weight;
   Weights[1] = EURJPY_Weight;
   Weights[2] = GBPJPY_Weight;
   Weights[3] = AUDJPY_Weight;
   Weights[4] = NZDJPY_Weight;
   Weights[5] = CADJPY_Weight;
   Weights[6] = CHFJPY_Weight;
   
   // Calculate C_i
   C_i = 100 / CalculateJPYX(USDJPY_Inception, EURJPY_Inception, GBPJPY_Inception, AUDJPY_Inception, 

NZDJPY_Inception, CADJPY_Inception, CHFJPY_Inception);

   // Check symbol availability
   string availableSymbols = "", unavailableSymbols = "";
   for(int i = 0; i < 7; i++)
   {
      if(CheckSymbolAvailability(Symbols[i]))
      {
         SymbolAvailable[i] = true;
         if(StringLen(availableSymbols) > 0) availableSymbols += ", ";
         availableSymbols += Symbols[i];
      }
      else
      {
         SymbolAvailable[i] = false;
         if(StringLen(unavailableSymbols) > 0) unavailableSymbols += ", ";
         unavailableSymbols += Symbols[i];
      }
   }

   if(StringLen(unavailableSymbols) > 0)
   {
      string warningMsg = "Warning: The following symbols are not available: " + unavailableSymbols + 

". JPYX calculation may be inaccurate.";
      Comment(warningMsg);
      Print(warningMsg);
   }
   
   UpdateChartComment();
   return(INIT_SUCCEEDED);
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
    int limit = (prev_calculated > 0) ? prev_calculated - 1 : 0;
   
    double min_value = DBL_MAX;
    double max_value = DBL_MIN;
   
    for(int i = limit; i < rates_total; i++)
    {
        double rates[7];
        int availableSymbols = 0;
        double totalWeight = 0;
      
        for(int j = 0; j < 7; j++)
        {
            double closePrice = iClose(Symbols[j], PERIOD_CURRENT, rates_total - 1 - i);
            if(closePrice > 0 && MathIsValidNumber(closePrice))
            {
                rates[j] = closePrice;
                availableSymbols++;
                totalWeight += Weights[j];
            }
            else
            {
                rates[j] = 1.0; // Use 1.0 as a neutral value for missing symbols
            }
        }
      
        if(availableSymbols == 0)
        {
            Print("Error: No symbols available for JPYX calculation at index ", i);
            JPYXClose[i] = EMPTY_VALUE;
            continue;
        }
      
        // Calculate JPYX close value
        JPYXClose[i] = C_i * CalculateJPYX(rates[0], rates[1], rates[2], rates[3], rates[4], rates[5], 

rates[6]);
      
        // Check for valid value
        if(!MathIsValidNumber(JPYXClose[i]) || JPYXClose[i] <= 0)
        {
            Print("Invalid JPYX value calculated for index ", i, ". Inputs: ", rates[0], ", ", rates

[1], ", ", rates[2], ", ", rates[3], ", ", rates[4], ", ", rates[5], ", ", rates[6]);
            JPYXClose[i] = EMPTY_VALUE;
        }
        else
        {
            // Update min and max values
            if(JPYXClose[i] < min_value) min_value = JPYXClose[i];
            if(JPYXClose[i] > max_value) max_value = JPYXClose[i];
        }
    }
    
    // Set dynamic scale
    if(min_value != DBL_MAX && max_value != DBL_MIN)
    {
        double range = max_value - min_value;
        double padding = range * 0.1; // Add 10% padding
        IndicatorSetDouble(INDICATOR_MINIMUM, min_value - padding);
        IndicatorSetDouble(INDICATOR_MAXIMUM, max_value + padding);
    }

    return(rates_total);
}

//+------------------------------------------------------------------+
//| Helper function to get the correct symbol format                 |
//+------------------------------------------------------------------+
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol)
{
    if(SymbolSelect(baseSymbol, true))
    {
        correctSymbol = baseSymbol;
        return true;
    }
    string symbolWithSuffix = baseSymbol + ".i";
    if(SymbolSelect(symbolWithSuffix, true))
    {
        correctSymbol = symbolWithSuffix;
        return true;
    }
    return false;
}

//+------------------------------------------------------------------+
//| Check symbol availability                                        |
//+------------------------------------------------------------------+
bool CheckSymbolAvailability(string &symbol)
{
    string correctSymbol;
    if(GetCorrectSymbol(symbol, correctSymbol))
    {
        symbol = correctSymbol;
        return true;
    }
    return false;
}

//+------------------------------------------------------------------+
//| Calculate JPYX value                                             |
//+------------------------------------------------------------------+
double CalculateJPYX(double usd, double eur, double gbp, double aud, double nzd, double cad, double 

chf)
{
    return MathPow(usd, -Weights[0]) * MathPow(eur, -Weights[1]) * MathPow(gbp, -Weights[2]) * 

MathPow(aud, -Weights[3]) * MathPow(nzd, -Weights[4]) * MathPow(cad, -Weights[5]) * MathPow(chf, -

Weights[6]);
}

//+------------------------------------------------------------------+
//| Update chart comment                                             |
//+------------------------------------------------------------------+
void UpdateChartComment()
{
   string availableSymbols = "";
   string unavailableSymbols = "";
   
   for(int i = 0; i < 7; i++)
   {
      if(SymbolAvailable[i])
      {
         if(StringLen(availableSymbols) > 0) availableSymbols += ", ";
         availableSymbols += Symbols[i];
      }
      else
      {
         if(StringLen(unavailableSymbols) > 0) unavailableSymbols += ", ";
         unavailableSymbols += Symbols[i];
      }
   }
   
   string commentText = "JPYX Indicator\n";
   commentText += "Available: " + availableSymbols + "\n";
   if(StringLen(unavailableSymbols) > 0)
   {
      commentText += "Unavailable: " + unavailableSymbols + "\n";
      commentText += "JPYX calculation may be inaccurate.";
   }
   
   Comment(commentText);
}

//+------------------------------------------------------------------+
//| Deinitialization function                                        |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
    Comment(""); // Clear the comment
}