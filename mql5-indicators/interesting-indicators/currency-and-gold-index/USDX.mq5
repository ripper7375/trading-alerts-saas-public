//+------------------------------------------------------------------+
//|                                           USDX_Indicator.mq5     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.01"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrDodgerBlue
#property indicator_label1  "USDX"

// Input parameters
input datetime InceptionDateTime = D'2023.01.02 14:00'; // Inception Date/Time
input double EUR_Weight = 0.142857;
input double JPY_Weight = 0.142857;
input double GBP_Weight = 0.142857;
input double AUD_Weight = 0.142857;
input double NZD_Weight = 0.142857;
input double CAD_Weight = 0.142857;
input double CHF_Weight = 0.142857;

// Inception exchange rates
input double EURUSD_Inception = 1.06785;
input double USDJPY_Inception = 130.938;
input double GBPUSD_Inception = 1.20591;
input double AUDUSD_Inception = 0.68146;
input double NZDUSD_Inception = 0.63450;
input double USDCAD_Inception = 1.35398;
input double USDCHF_Inception = 0.92203;

// Buffer
double USDXClose[];

// Global variables
double C_i;
string Symbols[7] = {"EURUSD.i", "USDJPY.i", "GBPUSD.i", "AUDUSD.i", "NZDUSD.i", "USDCAD.i", "USDCHF.i"};
double Weights[7];
bool SymbolAvailable[7];

// Function declarations
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
bool CheckSymbolAvailability(string &symbol);
double CalculateUSDX(double eur, double jpy, double gbp, double aud, double nzd, double cad, double chf);
void UpdateChartComment();

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, USDXClose, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);  // Start drawing from the first candle

   // Set indicator properties
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrDodgerBlue);
   IndicatorSetString(INDICATOR_SHORTNAME, "USDX Indicator");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   // Initialize weights
   Weights[0] = EUR_Weight;
   Weights[1] = JPY_Weight;
   Weights[2] = GBP_Weight;
   Weights[3] = AUD_Weight;
   Weights[4] = NZD_Weight;
   Weights[5] = CAD_Weight;
   Weights[6] = CHF_Weight;
   
   // Calculate C_i
   C_i = 100 / CalculateUSDX(EURUSD_Inception, USDJPY_Inception, GBPUSD_Inception, AUDUSD_Inception, NZDUSD_Inception, USDCAD_Inception, USDCHF_Inception);

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
      string warningMsg = "Warning: The following symbols are not available: " + unavailableSymbols + ". USDX calculation may be inaccurate.";
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
            Print("Error: No symbols available for USDX calculation at index ", i);
            USDXClose[i] = EMPTY_VALUE;
            continue;
        }
      
        // Calculate USDX close value
        USDXClose[i] = C_i * CalculateUSDX(rates[0], rates[1], rates[2], rates[3], rates[4], rates[5], rates[6]);
      
        // Check for valid value
        if(!MathIsValidNumber(USDXClose[i]) || USDXClose[i] <= 0)
        {
            Print("Invalid USDX value calculated for index ", i, ". Inputs: ", rates[0], ", ", rates[1], ", ", rates[2], ", ", rates[3], ", ", rates[4], ", ", rates[5], ", ", rates[6]);
            USDXClose[i] = EMPTY_VALUE;
        }
        else
        {
            // Update min and max values
            if(USDXClose[i] < min_value) min_value = USDXClose[i];
            if(USDXClose[i] > max_value) max_value = USDXClose[i];
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
//| Calculate USDX value                                             |
//+------------------------------------------------------------------+
double CalculateUSDX(double eur, double jpy, double gbp, double aud, double nzd, double cad, double chf)
{
    return MathPow(eur, -Weights[0]) * MathPow(jpy, Weights[1]) * MathPow(gbp, -Weights[2]) * 
           MathPow(aud, -Weights[3]) * MathPow(nzd, -Weights[4]) * MathPow(cad, Weights[5]) * 
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
   
   string commentText = "USDX Indicator\n";
   commentText += "Available: " + availableSymbols + "\n";
   if(StringLen(unavailableSymbols) > 0)
   {
      commentText += "Unavailable: " + unavailableSymbols + "\n";
      commentText += "USDX calculation may be inaccurate.";
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