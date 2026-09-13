//+------------------------------------------------------------------+
//|                                           XAUX_Indicator.mq5     |
//|                                     Copyright 2026, Antigravity  |
//|                                     https://www.yourwebsite.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Antigravity"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrGold
#property indicator_label1  "XAUX"

//+------------------------------------------------------------------+
//| Input parameters                                                 |
//+------------------------------------------------------------------+
input datetime InceptionDateTime = D'2026.01.02 00:00'; // Inception Date/Time
input double XAUUSD_Weight = 0.20; // XAUUSD Weight
input double XAUEUR_Weight = 0.20; // XAUEUR Weight
input double XAUJPY_Weight = 0.20; // XAUJPY Weight
input double XAUGBP_Weight = 0.20; // XAUGBP Weight
input double XAUAUD_Weight = 0.20; // XAUAUD Weight

// Inception exchange rates
input double XAUUSD_Inception = 4348.18;  // Inception Rate: XAUUSD
input double XAUEUR_Inception = 3696.91;  // Inception Rate: XAUEUR
input double XAUJPY_Inception = 681037.0; // Inception Rate: XAUJPY
input double XAUGBP_Inception = 3223.65;  // Inception Rate: XAUGBP
input double XAUAUD_Inception = 4238.37;  // Inception Rate: XAUAUD

// Buffer
double XAUXClose[];

// Global variables
double C_i;
// 5 MT5 fetched symbols used for translation
string Symbols[5] = {"XAUUSD", "EURUSD", "USDJPY", "GBPUSD", "AUDUSD"};
double Weights[5];
bool   SymbolAvailable[5];

// Function declarations
bool   GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
bool   CheckSymbolAvailability(string &symbol);
double GetSymbolClose(const string symbol, const datetime barTime, const int defaultShift);
void   TranslateToGoldPairs(const double p_xauusd, const double p_eurusd, const double p_usdjpy, const double p_gbpusd, const double p_audusd,
                            double &xauusd, double &xaueur, double &xaujpy, double &xaugbp, double &xauaud);
double CalculateXAUX(double xauusd, double xaueur, double xaujpy, double xaugbp, double xauaud);
void   UpdateChartComment();

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, XAUXClose, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);  // Start drawing from the first candle

   // Set indicator properties
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrGold);
   IndicatorSetString(INDICATOR_SHORTNAME, "XAUX Indicator");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   
   // Initialize weights (Equal weight 0.20 for each of the 5 assets)
   Weights[0] = XAUUSD_Weight;
   Weights[1] = XAUEUR_Weight;
   Weights[2] = XAUJPY_Weight;
   Weights[3] = XAUGBP_Weight;
   Weights[4] = XAUAUD_Weight;
   
   // Calculate normalization constant C_i to set index = 100.00 at inception
   double baseVal = CalculateXAUX(XAUUSD_Inception, XAUEUR_Inception, XAUJPY_Inception, XAUGBP_Inception, XAUAUD_Inception);
   if(baseVal > 0)
      C_i = 100.0 / baseVal;
   else
      C_i = 1.0;

   // Check availability for all 5 MT5 fetched symbols
   string availableSymbols = "", unavailableSymbols = "";
   for(int i = 0; i < 5; i++)
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
      string warningMsg = "Warning: The following symbols are not available: " + unavailableSymbols + ". XAUX calculation may be inaccurate.";
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
        double fetched_rates[5];
        int availableCount = 0;
        int defaultShift = rates_total - 1 - i;
      
        // Step 1: Fetch real prices from MT5 for XAUUSD, EURUSD, USDJPY, GBPUSD, AUDUSD
        for(int j = 0; j < 5; j++)
        {
            double closePrice = GetSymbolClose(Symbols[j], time[i], defaultShift);
            if(closePrice > 0 && MathIsValidNumber(closePrice))
            {
                fetched_rates[j] = closePrice;
                availableCount++;
            }
            else
            {
                fetched_rates[j] = 0.0;
            }
        }
      
        // If XAUUSD (fetched_rates[0]) is missing or invalid, index cannot be calculated
        if(fetched_rates[0] <= 0 || !MathIsValidNumber(fetched_rates[0]))
        {
            XAUXClose[i] = EMPTY_VALUE;
            continue;
        }
      
        // Step 2: Translate fetched MT5 prices into the 5 Gold basket assets
        // (XAUUSD, XAUEUR, XAUJPY, XAUGBP, XAUAUD)
        double xau_usd = 0.0, xau_eur = 0.0, xau_jpy = 0.0, xau_gbp = 0.0, xau_aud = 0.0;
        TranslateToGoldPairs(fetched_rates[0], fetched_rates[1], fetched_rates[2], fetched_rates[3], fetched_rates[4],
                             xau_usd, xau_eur, xau_jpy, xau_gbp, xau_aud);
      
        // Step 3: Calculate XAUX (Gold Index)
        XAUXClose[i] = C_i * CalculateXAUX(xau_usd, xau_eur, xau_jpy, xau_gbp, xau_aud);
      
        // Check for valid value
        if(!MathIsValidNumber(XAUXClose[i]) || XAUXClose[i] <= 0)
        {
            Print("Invalid XAUX value calculated for index ", i,
                  ". Translated: XAUUSD=", xau_usd, ", XAUEUR=", xau_eur,
                  ", XAUJPY=", xau_jpy, ", XAUGBP=", xau_gbp, ", XAUAUD=", xau_aud);
            XAUXClose[i] = EMPTY_VALUE;
        }
        else
        {
            // Update min and max values
            if(XAUXClose[i] < min_value) min_value = XAUXClose[i];
            if(XAUXClose[i] > max_value) max_value = XAUXClose[i];
        }
    }
    
    // Set dynamic scale
    if(min_value != DBL_MAX && max_value != DBL_MIN)
    {
        double range = max_value - min_value;
        if(range > 0)
        {
            double padding = range * 0.1; // Add 10% padding
            IndicatorSetDouble(INDICATOR_MINIMUM, min_value - padding);
            IndicatorSetDouble(INDICATOR_MAXIMUM, max_value + padding);
        }
    }

    return(rates_total);
}

//+------------------------------------------------------------------+
//| Helper to fetch close price with time synchronization            |
//+------------------------------------------------------------------+
double GetSymbolClose(const string symbol, const datetime barTime, const int defaultShift)
{
    // Try exact bar matching by timestamp
    int shift = iBarShift(symbol, PERIOD_CURRENT, barTime, false);
    if(shift < 0)
    {
        // Try nearest preceding bar
        shift = iBarShift(symbol, PERIOD_CURRENT, barTime, true);
    }
    if(shift < 0)
    {
        // Fallback to direct shift
        shift = defaultShift;
    }
    
    return iClose(symbol, PERIOD_CURRENT, shift);
}

//+------------------------------------------------------------------+
//| Translate MT5 prices into Gold basket assets                     |
//| Inputs:  XAUUSD, EURUSD, USDJPY, GBPUSD, AUDUSD                  |
//| Outputs: XAUUSD, XAUEUR, XAUJPY, XAUGBP, XAUAUD                  |
//+------------------------------------------------------------------+
void TranslateToGoldPairs(const double p_xauusd,
                          const double p_eurusd,
                          const double p_usdjpy,
                          const double p_gbpusd,
                          const double p_audusd,
                          double &xauusd,
                          double &xaueur,
                          double &xaujpy,
                          double &xaugbp,
                          double &xauaud)
{
    // 1. XAUUSD: Gold in USD (direct price)
    xauusd = p_xauusd;
    
    // 2. XAUEUR: Gold in EUR = XAUUSD / EURUSD
    if(p_eurusd > 0 && MathIsValidNumber(p_eurusd))
        xaueur = p_xauusd / p_eurusd;
    else
        xaueur = XAUEUR_Inception;
        
    // 3. XAUJPY: Gold in JPY = XAUUSD * USDJPY
    if(p_usdjpy > 0 && MathIsValidNumber(p_usdjpy))
        xaujpy = p_xauusd * p_usdjpy;
    else
        xaujpy = XAUJPY_Inception;
        
    // 4. XAUGBP: Gold in GBP = XAUUSD / GBPUSD
    if(p_gbpusd > 0 && MathIsValidNumber(p_gbpusd))
        xaugbp = p_xauusd / p_gbpusd;
    else
        xaugbp = XAUGBP_Inception;
        
    // 5. XAUAUD: Gold in AUD = XAUUSD / AUDUSD
    if(p_audusd > 0 && MathIsValidNumber(p_audusd))
        xauaud = p_xauusd / p_audusd;
    else
        xauaud = XAUAUD_Inception;
}

//+------------------------------------------------------------------+
//| Calculate XAUX geometric basket value                            |
//+------------------------------------------------------------------+
double CalculateXAUX(double xauusd, double xaueur, double xaujpy, double xaugbp, double xauaud)
{
    return MathPow(xauusd, Weights[0]) * 
           MathPow(xaueur, Weights[1]) * 
           MathPow(xaujpy, Weights[2]) * 
           MathPow(xaugbp, Weights[3]) * 
           MathPow(xauaud, Weights[4]);
}

//+------------------------------------------------------------------+
//| Helper function to get the correct symbol format on broker       |
//+------------------------------------------------------------------+
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol)
{
    // 1. Try base symbol directly
    if(SymbolSelect(baseSymbol, true))
    {
        correctSymbol = baseSymbol;
        return true;
    }
    
    // 2. Try with .i suffix (reference pattern)
    string symbolWithSuffix = baseSymbol + ".i";
    if(SymbolSelect(symbolWithSuffix, true))
    {
        correctSymbol = symbolWithSuffix;
        return true;
    }
    
    // 3. Try removing .i if present
    if(StringFind(baseSymbol, ".i") >= 0)
    {
        string stripped = baseSymbol;
        StringReplace(stripped, ".i", "");
        if(SymbolSelect(stripped, true))
        {
            correctSymbol = stripped;
            return true;
        }
    }
    
    // 4. Try current chart symbol suffix (e.g. .raw, .pro, m)
    string chartSym = _Symbol;
    int dotPos = StringFind(chartSym, ".");
    if(dotPos >= 0)
    {
        string suffix = StringSubstr(chartSym, dotPos);
        string symWithChartSuffix = baseSymbol + suffix;
        if(SymbolSelect(symWithChartSuffix, true))
        {
            correctSymbol = symWithChartSuffix;
            return true;
        }
    }
    
    // 5. If searching for XAUUSD, also check GOLD variants
    if(baseSymbol == "XAUUSD")
    {
        if(SymbolSelect("GOLD", true))
        {
            correctSymbol = "GOLD";
            return true;
        }
        if(SymbolSelect("GOLD.i", true))
        {
            correctSymbol = "GOLD.i";
            return true;
        }
    }
    
    // 6. Search all available symbols in Market Watch / Symbols
    int totalSymbols = SymbolsTotal(false);
    for(int i = 0; i < totalSymbols; i++)
    {
        string symName = SymbolName(i, false);
        if(StringFind(symName, baseSymbol) >= 0)
        {
            if(SymbolSelect(symName, true))
            {
                correctSymbol = symName;
                return true;
            }
        }
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
//| Update chart comment                                             |
//+------------------------------------------------------------------+
void UpdateChartComment()
{
   string availableSymbols = "";
   string unavailableSymbols = "";
   
   for(int i = 0; i < 5; i++)
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
   
   string commentText = "=== XAUX Indicator (Gold Index) ===\n";
   commentText += "Inception: 2026.01.02 00:00 (Base 100.00)\n";
   commentText += "Basket: XAUUSD, XAUEUR, XAUJPY, XAUGBP, XAUAUD (Equal Weight 20% each)\n";
   commentText += "MT5 Fetched: " + availableSymbols + "\n";
   if(StringLen(unavailableSymbols) > 0)
   {
      commentText += "Unavailable: " + unavailableSymbols + "\n";
      commentText += "XAUX calculation may be inaccurate.";
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
//+------------------------------------------------------------------+
