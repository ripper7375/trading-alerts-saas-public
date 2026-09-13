//+------------------------------------------------------------------+
//|                                           XAUX_H1_Open.mq5       |
//|                             Copyright 2026, Antigravity          |
//|                                     https://www.yourwebsite.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Antigravity"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Gold Index (XAUX) Open Indicator with H1 Optimization"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 1
#property indicator_plots   1
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrGray
#property indicator_style1  STYLE_DASHDOT
#property indicator_width1  1
#property indicator_label1  "XAUX"

// Currency pair structure
struct CurrencyPair {
    string symbol;
    double weight;
    double inception_rate;
    bool available;
    bool inverse;
};

// Input parameters
input group "Display Settings"
input bool   ShowLabels = true;          // Show Symbol Labels

// XAUX Configuration
input group "Index Configuration"
input datetime InceptionDateTime = D'2026.01.02 00:00';    // Inception Date/Time
input int      BaseIndexValue = 100;                       // Base of Index (Integer 50-150)

// Currency Weights
input group "Currency Weights"
input double XAUUSD_Weight = 0.20;   // XAUUSD Weight
input double XAUEUR_Weight = 0.20;   // XAUEUR Weight
input double XAUJPY_Weight = 0.20;   // XAUJPY Weight
input double XAUGBP_Weight = 0.20;   // XAUGBP Weight
input double XAUAUD_Weight = 0.20;   // XAUAUD Weight

// Inception Rates (Open)
input group "Inception Rates"
input double XAUUSD_Inception = 4333.33;  // XAUUSD Inception Rate
input double XAUEUR_Inception = 3687.90;  // XAUEUR Inception Rate
input double XAUJPY_Inception = 679183.0; // XAUJPY Inception Rate
input double XAUGBP_Inception = 3215.60;  // XAUGBP Inception Rate
input double XAUAUD_Inception = 6491.51;  // XAUAUD Inception Rate

// Indicator buffer
double XAUXBuffer[];

// Global variables
double C_i;  // Constant multiplier
CurrencyPair Pairs[];
bool PreviousShowLabels = false;  // To track label visibility changes
string LabelPrefix;               // Unique prefix for label objects
string CommentText = "";          // Store comment text

// H1 optimization variables
datetime lastH1BarTime = 0;
datetime lastCalculatedTime = 0;

// Function declarations
bool InitializeBuffer();
bool InitializePairs();
CurrencyPair CreatePair(string symbol_base, double weight, double inception, bool is_inverse);
bool CalculateConstantMultiplier();
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol);
void ValidateSymbols();
void UpdateDisplay();
double CalculateXAUX(int position);
datetime GetH1BarTime(datetime time);

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Generate unique prefix for labels
    LabelPrefix = "XAUX_OPEN_" + IntegerToString(GetTickCount64());
    
    // Initialize indicator buffer
    if(!InitializeBuffer())
        return INIT_FAILED;
        
    // Initialize currency pairs
    if(!InitializePairs())
        return INIT_FAILED;
        
    // Calculate constant multiplier
    if(!CalculateConstantMultiplier())
        return INIT_FAILED;
        
    // Check symbol availability and update status
    ValidateSymbols();
    
    // Initialize label visibility state
    PreviousShowLabels = ShowLabels;
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Initialize indicator buffer                                      |
//+------------------------------------------------------------------+
bool InitializeBuffer()
{
    SetIndexBuffer(0, XAUXBuffer, INDICATOR_DATA);
    
    // Set indicator properties
    IndicatorSetString(INDICATOR_SHORTNAME, "XAUX Index Open");
    IndicatorSetInteger(INDICATOR_DIGITS, 2);
    
    // Set plot properties
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);
    
    return true;
}

//+------------------------------------------------------------------+
//| Initialize currency pairs array                                  |
//+------------------------------------------------------------------+
bool InitializePairs()
{
    if(!ArrayResize(Pairs, 5))
    {
        Print("Failed to resize Pairs array");
        return false;
    }
    
    // Pairs array holds the 5 MT5 fetched symbols mapped to the 5 basket components
    Pairs[0] = CreatePair("XAUUSD", XAUUSD_Weight, XAUUSD_Inception, false); // Direct
    Pairs[1] = CreatePair("EURUSD", XAUEUR_Weight, XAUEUR_Inception, true);  // Inverse (XAUEUR = XAUUSD / EURUSD)
    Pairs[2] = CreatePair("USDJPY", XAUJPY_Weight, XAUJPY_Inception, false); // Direct  (XAUJPY = XAUUSD * USDJPY)
    Pairs[3] = CreatePair("GBPUSD", XAUGBP_Weight, XAUGBP_Inception, true);  // Inverse (XAUGBP = XAUUSD / GBPUSD)
    Pairs[4] = CreatePair("AUDUSD", XAUAUD_Weight, XAUAUD_Inception, true);  // Inverse (XAUAUD = XAUUSD / AUDUSD)
    
    return true;
}

//+------------------------------------------------------------------+
//| Create currency pair structure                                   |
//+------------------------------------------------------------------+
CurrencyPair CreatePair(string symbol_base, double weight, double inception, bool is_inverse)
{
    CurrencyPair pair;
    pair.symbol = symbol_base;
    pair.weight = weight;
    pair.inception_rate = inception;
    pair.available = false;
    pair.inverse = is_inverse;
    return pair;
}

//+------------------------------------------------------------------+
//| Calculate constant multiplier                                    |
//+------------------------------------------------------------------+
bool CalculateConstantMultiplier()
{
    // Input validation for BaseIndexValue - must be integer between 50 and 150
    if(BaseIndexValue < 50 || BaseIndexValue > 150 || double(BaseIndexValue) != MathFloor(double(BaseIndexValue)))
    {
        Print("Error: Base Index Value must be an integer between 50 and 150");
        return false;
    }
    
    double inception_value = 1.0;
    
    for(int i = 0; i < ArraySize(Pairs); i++)
    {
        double rate = Pairs[i].inception_rate;
        if(rate <= 0)
        {
            Print("Error: Invalid inception rate for pair ", i);
            return false;
        }
        
        inception_value *= MathPow(rate, Pairs[i].weight);
    }
    
    if(inception_value <= 0)
    {
        Print("Error: Invalid inception value calculated");
        return false;
    }
    
    C_i = double(BaseIndexValue) / inception_value;
    return true;
}

//+------------------------------------------------------------------+
//| Helper function to get correct broker symbol                     |
//+------------------------------------------------------------------+
bool GetCorrectSymbol(const string baseSymbol, string &correctSymbol)
{
    // 1. Try base symbol directly
    if(SymbolSelect(baseSymbol, true))
    {
        correctSymbol = baseSymbol;
        return true;
    }
    // 2. Try with .i suffix (seed code pattern)
    string symbolWithSuffix = baseSymbol + ".i";
    if(SymbolSelect(symbolWithSuffix, true))
    {
        correctSymbol = symbolWithSuffix;
        return true;
    }
    // 3. Try current chart symbol suffix (e.g. .raw, .pro, m)
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
    // 4. If looking for XAUUSD, try GOLD alias
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
    // 5. Search Market Watch / Symbols total
    int total = SymbolsTotal(false);
    for(int i = 0; i < total; i++)
    {
        string sym = SymbolName(i, false);
        if(StringFind(sym, baseSymbol) >= 0)
        {
            if(SymbolSelect(sym, true))
            {
                correctSymbol = sym;
                return true;
            }
        }
    }
    return false;
}

//+------------------------------------------------------------------+
//| Validate symbol availability                                     |
//+------------------------------------------------------------------+
void ValidateSymbols()
{
    string available = "", unavailable = "";
    
    for(int i = 0; i < ArraySize(Pairs); i++)
    {
        string resolvedSymbol = "";
        if(GetCorrectSymbol(Pairs[i].symbol, resolvedSymbol))
        {
            Pairs[i].symbol = resolvedSymbol;
            Pairs[i].available = true;
            if(StringLen(available) > 0) available += ", ";
            available += Pairs[i].symbol;
        }
        else
        {
            Pairs[i].available = false;
            if(StringLen(unavailable) > 0) unavailable += ", ";
            unavailable += Pairs[i].symbol;
        }
    }
    
    // Prepare comment text
    CommentText = "=== XAUX Open Indicator ===\n";
    CommentText += "Basket: XAUUSD, XAUEUR, XAUJPY, XAUGBP, XAUAUD (20% each)\n";
    CommentText += "Available: " + available;
    if(StringLen(unavailable) > 0)
    {
        CommentText += "\nUnavailable: " + unavailable + "\nXAUX calculation may be inaccurate.";
    }
    
    // Update display
    UpdateDisplay();
}

//+------------------------------------------------------------------+
//| Update display of labels and comments                            |
//+------------------------------------------------------------------+
void UpdateDisplay()
{
    if(ShowLabels)
    {
        Comment(CommentText);
    }
    else
    {
        Comment("");  // Clear the comment if labels are disabled
    }
    
    // Track changes in label visibility
    if(ShowLabels != PreviousShowLabels)
    {
        PreviousShowLabels = ShowLabels;
        ChartRedraw();  // Redraw chart when visibility changes
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
    // Update display on each calculation
    UpdateDisplay();
    
    // Get current H1 bar time
    datetime currentH1Time = GetH1BarTime(TimeCurrent());
    
    // Check if we need to calculate
    if(currentH1Time <= lastCalculatedTime && prev_calculated > 0)
    {
        // No new H1 bar, return without recalculating
        return rates_total;
    }
    
    // Calculate start position
    int start;
    if(prev_calculated == 0)
    {
        // First calculation, process all bars
        start = 0;
        lastCalculatedTime = 0;
    }
    else
    {
        // Only process bars since the last H1 update
        start = prev_calculated - 1;
    }
    
    double min_value = DBL_MAX;
    double max_value = DBL_MIN;
    
    // Main calculation loop
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Get H1 bar time for current position
        datetime barH1Time = GetH1BarTime(time[i]);
        
        // If this bar's H1 time is already calculated and not the latest, skip
        if(barH1Time < lastCalculatedTime && i != rates_total - 1)
        {
            continue;
        }
        
        XAUXBuffer[i] = CalculateXAUX(rates_total - 1 - i);
        
        // Update min/max values for dynamic scale
        if(XAUXBuffer[i] != EMPTY_VALUE && XAUXBuffer[i] != 0.0)
        {
            min_value = MathMin(min_value, XAUXBuffer[i]);
            max_value = MathMax(max_value, XAUXBuffer[i]);
        }
    }
    
    // Update last calculated time
    lastCalculatedTime = currentH1Time;
    
    return rates_total;
}

//+------------------------------------------------------------------+
//| Calculate XAUX Open value for a specific position                |
//+------------------------------------------------------------------+
double CalculateXAUX(int position)
{
    static double lastHourValue = EMPTY_VALUE;
    static datetime lastHourTime = 0;
    
    // Ensure primary Gold symbol is available
    if(!Pairs[0].available)
        return EMPTY_VALUE;
        
    // 1. Fetch real Open prices from MT5 for XAUUSD, EURUSD, USDJPY, GBPUSD, AUDUSD
    double p_xauusd = iOpen(Pairs[0].symbol, PERIOD_H1, position);
    double p_eurusd = Pairs[1].available ? iOpen(Pairs[1].symbol, PERIOD_H1, position) : 0.0;
    double p_usdjpy = Pairs[2].available ? iOpen(Pairs[2].symbol, PERIOD_H1, position) : 0.0;
    double p_gbpusd = Pairs[3].available ? iOpen(Pairs[3].symbol, PERIOD_H1, position) : 0.0;
    double p_audusd = Pairs[4].available ? iOpen(Pairs[4].symbol, PERIOD_H1, position) : 0.0;
    
    if(p_xauusd <= 0 || !MathIsValidNumber(p_xauusd))
        return EMPTY_VALUE;
        
    // 2. Translate fetched Open prices into the 5 Gold basket assets
    double xauusd = p_xauusd;
    double xaueur = (p_eurusd > 0 && MathIsValidNumber(p_eurusd)) ? (p_xauusd / p_eurusd) : Pairs[1].inception_rate;
    double xaujpy = (p_usdjpy > 0 && MathIsValidNumber(p_usdjpy)) ? (p_xauusd * p_usdjpy) : Pairs[2].inception_rate;
    double xaugbp = (p_gbpusd > 0 && MathIsValidNumber(p_gbpusd)) ? (p_xauusd / p_gbpusd) : Pairs[3].inception_rate;
    double xauaud = (p_audusd > 0 && MathIsValidNumber(p_audusd)) ? (p_xauusd / p_audusd) : Pairs[4].inception_rate;
    
    // 3. Geometric weighted product
    double xaux_value = MathPow(xauusd, Pairs[0].weight) *
                        MathPow(xaueur, Pairs[1].weight) *
                        MathPow(xaujpy, Pairs[2].weight) *
                        MathPow(xaugbp, Pairs[3].weight) *
                        MathPow(xauaud, Pairs[4].weight);
                        
    xaux_value *= C_i;
    
    if(!MathIsValidNumber(xaux_value) || xaux_value <= 0)
        return EMPTY_VALUE;

    datetime currentTime = TimeCurrent();
    datetime currentHourTime = GetH1BarTime(currentTime);
    
    if(currentHourTime > lastHourTime)
    {
        if(lastHourValue != EMPTY_VALUE)
        {
            double percentChange = MathAbs((xaux_value - lastHourValue)/lastHourValue) * 100.0;
            
            if(percentChange > 3.0)
            {
                Print("XAUX Open value exceeded ±3% threshold. Current: ", xaux_value, 
                      " Last: ", lastHourValue, 
                      " Change: ", percentChange, 
                      "%. Reloading indicator...");
                
                ChartSetSymbolPeriod(0, Symbol(), PERIOD_H1);
                Sleep(1000);
                
                bool switchSuccess = false;
                for(int attempt = 0; attempt < 3; attempt++)
                {
                    ChartSetSymbolPeriod(0, Symbol(), PERIOD_H1);
                    Sleep(500);
                    
                    if(Period() == PERIOD_H1)
                    {
                        switchSuccess = true;
                        break;
                    }
                }
                
                if(!switchSuccess)
                {
                    Print("Warning: Failed to switch back to H1 timeframe after reload");
                }
                
                return EMPTY_VALUE;
            }
        }
        
        lastHourValue = xaux_value;
        lastHourTime = currentHourTime;
    }
    
    return xaux_value;
}

//+------------------------------------------------------------------+
//| Get H1 bar time for given timestamp                              |
//+------------------------------------------------------------------+
datetime GetH1BarTime(datetime time)
{
    MqlDateTime dt;
    TimeToStruct(time, dt);
    dt.min = 0;
    dt.sec = 0;
    return StructToTime(dt);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Comment("");  // Clear chart comment
    ObjectsDeleteAll(0, LabelPrefix);  // Clean up any created objects
    ChartRedraw();
}
//+------------------------------------------------------------------+
