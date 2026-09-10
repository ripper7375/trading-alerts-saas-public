//+------------------------------------------------------------------+
//|                                           CHFX_Indicator.mq5     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.01"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrDodgerBlue
#property indicator_label1  "CHFX"

// Input parameters
input datetime InceptionDateTime = D'2023.01.02 14:00'; // Inception Date/Time
input double USDCHF_Weight = 0.142857;
input double EURCHF_Weight = 0.142857;
input double CHFJPY_Weight = 0.142857;
input double GBPCHF_Weight = 0.142857;
input double AUDCHF_Weight = 0.142857;
input double NZDCHF_Weight = 0.142857;
input double CADCHF_Weight = 0.142857;

// Inception exchange rates
input double USDCHF_Inception = 0.92203;
input double EURCHF_Inception = 0.98490;
input double CHFJPY_Inception = 141.843;
input double GBPCHF_Inception = 1.11217;
input double AUDCHF_Inception = 0.62710;
input double NZDCHF_Inception = 0.58332;
input double CADCHF_Inception = 0.68007;

// Buffer
double CHFXClose[];

// Global variables
double C_i;
string Symbols[7] = {"USDCHF.i", "EURCHF.i", "CHFJPY.i", "GBPCHF.i", "AUDCHF.i", "NZDCHF.i", "CADCHF.i"};
double Weights[7];
bool SymbolAvailable[7];

// Function declarations
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
bool CheckSymbolAvailability(string &symbol);
double CalculateCHFX(double usd, double eur, double jpy, double gbp, double aud, double nzd, double cad);
void UpdateChartComment();

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, CHFXClose, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);  // Start drawing from the first candle

   // Set indicator properties
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrDodgerBlue);
   IndicatorSetString(INDICATOR_SHORTNAME, "CHFX Indicator");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   // Initialize weights
   Weights[0] = USDCHF_Weight;
   Weights[1] = EURCHF_Weight;
   Weights[2] = CHFJPY_Weight;
   Weights[3] = GBPCHF_Weight;
   Weights[4] = AUDCHF_Weight;
   Weights[5] = NZDCHF_Weight;
   Weights[6] = CADCHF_Weight;
   
   // Calculate C_i
   C_i = 100 / CalculateCHFX(USDCHF_Inception, EURCHF_Inception, CHFJPY_Inception, GBPCHF_Inception, AUDCHF_Inception, NZDCHF_Inception, CADCHF_Inception);

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
      string warningMsg = "Warning: The following symbols are not available: " + unavailableSymbols + ". CHFX calculation may be inaccurate.";
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
            Print("Error: No symbols available for CHFX calculation at index ", i);
            CHFXClose[i] = EMPTY_VALUE;
            continue;
        }
      
        // Calculate CHFX close value
        CHFXClose[i] = C_i * CalculateCHFX(rates[0], rates[1], rates[2], rates[3], rates[4], rates[5], rates[6]);
      
        // Check for valid value
        if(!MathIsValidNumber(CHFXClose[i]) || CHFXClose[i] <= 0)
        {
            Print("Invalid CHFX value calculated for index ", i, ". Inputs: ", rates[0], ", ", rates[1], ", ", rates[2], ", ", rates[3], ", ", rates[4], ", ", rates[5], ", ", rates[6]);
            CHFXClose[i] = EMPTY_VALUE;
        }
        else
        {
            // Update min and max values
            if(CHFXClose[i] < min_value) min_value = CHFXClose[i];
            if(CHFXClose[i] > max_value) max_value = CHFXClose[i];
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
//| Calculate CHFX value                                             |
//+------------------------------------------------------------------+
double CalculateCHFX(double usd, double eur, double jpy, double gbp, double aud, double nzd, double cad)
{
    return MathPow(1/usd, Weights[0]) * MathPow(1/eur, Weights[1]) * MathPow(jpy, Weights[2]) * 
           MathPow(1/gbp, Weights[3]) * MathPow(1/aud, Weights[4]) * MathPow(1/nzd, Weights[5]) * 
           MathPow(1/cad, Weights[6]);
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
   
   string commentText = "CHFX Indicator\n";
   commentText += "Available: " + availableSymbols + "\n";
   if(StringLen(unavailableSymbols) > 0)
   {
      commentText += "Unavailable: " + unavailableSymbols + "\n";
      commentText += "CHFX calculation may be inaccurate.";
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