//+------------------------------------------------------------------+
//|                                           GBPX_Indicator.mq5     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.01"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrDodgerBlue
#property indicator_label1  "GBPX"

// Input parameters
input datetime InceptionDateTime = D'2023.01.02 14:00'; // Inception Date/Time
input double GBPUSD_Weight = 0.142857;
input double EURGBP_Weight = 0.142857;
input double GBPJPY_Weight = 0.142857;
input double GBPAUD_Weight = 0.142857;
input double GBPNZD_Weight = 0.142857;
input double GBPCAD_Weight = 0.142857;
input double GBPCHF_Weight = 0.142857;

// Inception exchange rates
input double GBPUSD_Inception = 1.20591;
input double EURGBP_Inception = 0.88510;
input double GBPJPY_Inception = 157.915;
input double GBPAUD_Inception = 1.77111;
input double GBPNZD_Inception = 1.90416;
input double GBPCAD_Inception = 1.63568;
input double GBPCHF_Inception = 1.11217;

// Buffer
double GBPXClose[];

// Global variables
double C_i;
string Symbols[7] = {"GBPUSD.i", "EURGBP.i", "GBPJPY.i", "GBPAUD.i", "GBPNZD.i", "GBPCAD.i", "GBPCHF.i"};
double Weights[7];
bool SymbolAvailable[7];

// Function declarations
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
bool CheckSymbolAvailability(string &symbol);
double CalculateGBPX(double usd, double eur, double jpy, double aud, double nzd, double cad, double chf);
void UpdateChartComment();

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, GBPXClose, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);  // Start drawing from the first candle

   // Set indicator properties
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrDodgerBlue);
   IndicatorSetString(INDICATOR_SHORTNAME, "GBPX Indicator");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   // Initialize weights
   Weights[0] = GBPUSD_Weight;
   Weights[1] = EURGBP_Weight;
   Weights[2] = GBPJPY_Weight;
   Weights[3] = GBPAUD_Weight;
   Weights[4] = GBPNZD_Weight;
   Weights[5] = GBPCAD_Weight;
   Weights[6] = GBPCHF_Weight;
   
   // Calculate C_i
   C_i = 100 / CalculateGBPX(GBPUSD_Inception, EURGBP_Inception, GBPJPY_Inception, GBPAUD_Inception, GBPNZD_Inception, GBPCAD_Inception, GBPCHF_Inception);

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
      string warningMsg = "Warning: The following symbols are not available: " + unavailableSymbols + ". GBPX calculation may be inaccurate.";
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
            Print("Error: No symbols available for GBPX calculation at index ", i);
            GBPXClose[i] = EMPTY_VALUE;
            continue;
        }
      
        // Calculate GBPX close value
        GBPXClose[i] = C_i * CalculateGBPX(rates[0], rates[1], rates[2], rates[3], rates[4], rates[5], rates[6]);
      
        // Check for valid value
        if(!MathIsValidNumber(GBPXClose[i]) || GBPXClose[i] <= 0)
        {
            Print("Invalid GBPX value calculated for index ", i, ". Inputs: ", rates[0], ", ", rates[1], ", ", rates[2], ", ", rates[3], ", ", rates[4], ", ", rates[5], ", ", rates[6]);
            GBPXClose[i] = EMPTY_VALUE;
        }
        else
        {
            // Update min and max values
            if(GBPXClose[i] < min_value) min_value = GBPXClose[i];
            if(GBPXClose[i] > max_value) max_value = GBPXClose[i];
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
//| Calculate GBPX value                                             |
//+------------------------------------------------------------------+
double CalculateGBPX(double usd, double eur, double jpy, double aud, double nzd, double cad, double chf)
{
    return MathPow(usd, Weights[0]) * MathPow(1/eur, Weights[1]) * MathPow(jpy, Weights[2]) * 
           MathPow(aud, Weights[3]) * MathPow(nzd, Weights[4]) * MathPow(cad, Weights[5]) * 
           MathPow(chf, Weights[6]);
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
   
   string commentText = "GBPX Indicator\n";
   commentText += "Available: " + availableSymbols + "\n";
   if(StringLen(unavailableSymbols) > 0)
   {
      commentText += "Unavailable: " + unavailableSymbols + "\n";
      commentText += "GBPX calculation may be inaccurate.";
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