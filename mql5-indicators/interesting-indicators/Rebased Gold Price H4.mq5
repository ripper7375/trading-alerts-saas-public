//+------------------------------------------------------------------+
//|                                        RebasedXAUUSD_Safe.mq5   |
//|                             Copyright 2024, Your Name           |
//|                                     https://www.yourwebsite.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Name"
#property link      "https://www.yourwebsite.com"
#property version   "1.00"
#property description "Rebased XAUUSD Indicator - Conflict-Free with USDX"

// Indicator settings
#property indicator_chart_window
#property indicator_buffers 6
#property indicator_plots   4
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrNONE
#property indicator_style1  STYLE_SOLID
#property indicator_width1  1
#property indicator_label1  "Rebased XAUUSD"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrNONE
#property indicator_style2  STYLE_SOLID
#property indicator_width2  1
#property indicator_label2  "Gold EMA"
#property indicator_type3   DRAW_LINE
#property indicator_color3  clrSaddleBrown
#property indicator_style3  STYLE_SOLID
#property indicator_width3  1
#property indicator_label3  "Gold SMMA"
#property indicator_type4   DRAW_LINE
#property indicator_color4  clrDarkGoldenrod
#property indicator_style4  STYLE_SOLID
#property indicator_width4  1
#property indicator_label4  "Gold HRMA"

// Input parameters - all prefixed with Gold_ to avoid conflicts
input group "Gold Rebasing Configuration"
input datetime Gold_InceptionDateTime = D'2023.12.31 01:00';    // Gold Inception Date/Time
input double   Gold_InceptionXAUUSD = 1823.79;                  // XAUUSD Price at Inception
input int      Gold_BaseIndexValue = 55;                      // Gold Base Index Value

input group "Gold Moving Average Settings"
input int      Gold_EMAPeriod = 36;                           // Gold EMA Period
input int      Gold_SMMAPeriod = 36;                          // Gold SMMA Period
input int      Gold_HRMAPeriod = 18;                          // Gold HRMA Period

input group "Gold Display Settings"
input bool     Gold_ShowLabels = true;                        // Show Gold Labels
input string   Gold_Symbol = "XAUUSD";                       // Gold Symbol

// Indicator buffers - all with unique Gold prefix
double Gold_RebasedBuffer[];      // Rebased XAUUSD values
double Gold_EMA_Buffer[];         // Gold EMA buffer
double Gold_SMMA_Buffer[];        // Gold SMMA buffer
double Gold_HRMA_Buffer[];        // Gold HRMA buffer
double Gold_RMA1_Buffer[];        // Gold HRMA calculation buffer 1
double Gold_RMA2_Buffer[];        // Gold HRMA calculation buffer 2

// Global variables - all with unique Gold_ prefix to avoid conflicts
double Gold_RebasingFactor;       // Factor to rebase gold prices
string Gold_LabelPrefix;          // Unique prefix for gold label objects
string Gold_InfoLabelName;       // Name for the gold info label object
int Gold_BottomPadding = 80;     // Padding from bottom (below USDX label)
int Gold_LeftPadding = 10;       // Padding from left of chart
datetime Gold_LastCalculatedTime = 0;  // Last calculation time
bool Gold_PreviousShowLabels = false;  // Track label visibility changes

// Gold price cache - separate from USDX cache
struct Gold_PriceCache_Struct
{
    datetime time;
    double   price;
    bool     valid;
};
Gold_PriceCache_Struct Gold_PriceCache[500]; // Gold-specific cache

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
    // Generate unique prefix for gold labels - completely different from USDX
    Gold_LabelPrefix = "REBASED_GOLD_" + IntegerToString(GetTickCount64()) + "_" + IntegerToString(MathRand());
    Gold_InfoLabelName = Gold_LabelPrefix + "_GoldInfo";
    
    // Check if we're on H4 timeframe
    if(Period() != PERIOD_H4)
    {
        Print("Error: Rebased XAUUSD Indicator must be applied to H4 timeframe");
        return INIT_FAILED;
    }
    
    // Validate inputs
    if(Gold_InceptionXAUUSD <= 0)
    {
        Print("Error: Gold Inception XAUUSD price must be positive");
        return INIT_FAILED;
    }
    
    if(Gold_BaseIndexValue <= 0)
    {
        Print("Error: Gold Base Index Value must be positive");
        return INIT_FAILED;
    }
    
    // Calculate rebasing factor
    Gold_RebasingFactor = double(Gold_BaseIndexValue) / Gold_InceptionXAUUSD;
    Print("Gold Rebasing Factor calculated: ", Gold_RebasingFactor, " (", Gold_BaseIndexValue, "/", Gold_InceptionXAUUSD, ")");
    
    // Check if gold symbol is available
    if(!SymbolSelect(Gold_Symbol, true))
    {
        Print("Warning: Gold symbol ", Gold_Symbol, " not available");
        return INIT_FAILED;
    }
    
    // Initialize indicator buffers
    if(!Gold_InitializeBuffers())
        return INIT_FAILED;
    
    // Initialize gold price cache
    Gold_InitializeCache();
    
    // Create info label
    Gold_CreateInfoLabel();
    
    // Initialize state variables
    Gold_LastCalculatedTime = 0;
    Gold_PreviousShowLabels = Gold_ShowLabels;
    
    Print("Rebased XAUUSD Indicator initialized successfully - No conflicts with USDX");
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Initialize gold price cache                                      |
//+------------------------------------------------------------------+
void Gold_InitializeCache()
{
    for(int i = 0; i < 500; i++)
    {
        Gold_PriceCache[i].valid = false;
        Gold_PriceCache[i].time = 0;
        Gold_PriceCache[i].price = 0.0;
    }
}

//+------------------------------------------------------------------+
//| Get cached or fresh gold price                                   |
//+------------------------------------------------------------------+
double Gold_GetCachedPrice(int position)
{
    datetime bar_time = iTime(Symbol(), PERIOD_H4, position);
    
    // Check cache first
    for(int i = 0; i < 500; i++)
    {
        if(Gold_PriceCache[i].valid && Gold_PriceCache[i].time == bar_time)
        {
            return Gold_PriceCache[i].price; // Cache hit
        }
    }
    
    // Cache miss - get fresh price
    double price = iClose(Gold_Symbol, PERIOD_H4, position);
    
    // Cache the price if valid
    if(price > 0 && MathIsValidNumber(price))
    {
        // Find an empty or oldest cache slot
        int slot_to_use = 0;
        datetime oldest_time = INT_MAX;
        
        for(int i = 0; i < 500; i++)
        {
            if(!Gold_PriceCache[i].valid)
            {
                slot_to_use = i;
                break;
            }
            
            if(Gold_PriceCache[i].time < oldest_time)
            {
                oldest_time = Gold_PriceCache[i].time;
                slot_to_use = i;
            }
        }
        
        // Store in cache
        Gold_PriceCache[slot_to_use].time = bar_time;
        Gold_PriceCache[slot_to_use].price = price;
        Gold_PriceCache[slot_to_use].valid = true;
    }
    
    return price;
}

//+------------------------------------------------------------------+
//| Initialize indicator buffers - Gold specific                     |
//+------------------------------------------------------------------+
bool Gold_InitializeBuffers()
{
    // Set indicator name and digits
    IndicatorSetString(INDICATOR_SHORTNAME, "Rebased XAUUSD (Base=" + IntegerToString(Gold_BaseIndexValue) + ")");
    IndicatorSetInteger(INDICATOR_DIGITS, 2);
    
    // Initialize main buffers
    SetIndexBuffer(0, Gold_RebasedBuffer, INDICATOR_DATA);
    SetIndexBuffer(1, Gold_EMA_Buffer, INDICATOR_DATA);
    SetIndexBuffer(2, Gold_SMMA_Buffer, INDICATOR_DATA);
    SetIndexBuffer(3, Gold_HRMA_Buffer, INDICATOR_DATA);
    
    // Initialize calculation buffers
    SetIndexBuffer(4, Gold_RMA1_Buffer, INDICATOR_CALCULATIONS);
    SetIndexBuffer(5, Gold_RMA2_Buffer, INDICATOR_CALCULATIONS);
    
    // Set buffer properties
    PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_LINE);
    PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_LINE);
    PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_LINE);
    PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_LINE);
    
    // Set buffer colors - distinct from USDX colors
    PlotIndexSetInteger(0, PLOT_LINE_COLOR, clrNONE);
    PlotIndexSetInteger(1, PLOT_LINE_COLOR, clrNONE);
    PlotIndexSetInteger(2, PLOT_LINE_COLOR, clrSaddleBrown);
    PlotIndexSetInteger(3, PLOT_LINE_COLOR, clrDarkGoldenrod);
    
    // Set buffer styles and widths
    PlotIndexSetInteger(0, PLOT_LINE_STYLE, STYLE_SOLID);
    PlotIndexSetInteger(1, PLOT_LINE_STYLE, STYLE_SOLID);
    PlotIndexSetInteger(2, PLOT_LINE_STYLE, STYLE_SOLID);
    PlotIndexSetInteger(3, PLOT_LINE_STYLE, STYLE_SOLID);
    
    PlotIndexSetInteger(0, PLOT_LINE_WIDTH, 2);
    PlotIndexSetInteger(1, PLOT_LINE_WIDTH, 1);
    PlotIndexSetInteger(2, PLOT_LINE_WIDTH, 1);
    PlotIndexSetInteger(3, PLOT_LINE_WIDTH, 1);
    
    // Set empty values
    PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
    PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
    PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
    PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);
    
    // Set buffer labels
    PlotIndexSetString(0, PLOT_LABEL, "Rebased XAUUSD");
    PlotIndexSetString(1, PLOT_LABEL, "Gold EMA");
    PlotIndexSetString(2, PLOT_LABEL, "Gold SMMA");
    PlotIndexSetString(3, PLOT_LABEL, "Gold HRMA");
    
    // Set drawing begin for moving averages
    PlotIndexSetInteger(0, PLOT_DRAW_BEGIN, 0);
    PlotIndexSetInteger(1, PLOT_DRAW_BEGIN, Gold_EMAPeriod);
    PlotIndexSetInteger(2, PLOT_DRAW_BEGIN, Gold_SMMAPeriod);
    PlotIndexSetInteger(3, PLOT_DRAW_BEGIN, Gold_HRMAPeriod);
    
    return true;
}

//+------------------------------------------------------------------+
//| Create info label - Gold specific                               |
//+------------------------------------------------------------------+
void Gold_CreateInfoLabel()
{
    // Create the info label with unique name
    if(ObjectCreate(0, Gold_InfoLabelName, OBJ_LABEL, 0, 0, 0))
    {
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_CORNER, CORNER_LEFT_LOWER);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_XDISTANCE, Gold_LeftPadding);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_YDISTANCE, Gold_BottomPadding);
        ObjectSetString(0, Gold_InfoLabelName, OBJPROP_FONT, "Arial");
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_FONTSIZE, 9);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_COLOR, clrDarkGoldenrod);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_BACK, false);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_SELECTABLE, false);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_SELECTED, false);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_HIDDEN, false);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_ZORDER, 998); // Different from USDX z-order
    }
}

//+------------------------------------------------------------------+
//| Update display - Gold specific                                   |
//+------------------------------------------------------------------+
void Gold_UpdateDisplay()
{
    // Always recreate the label to ensure visibility
    ObjectDelete(0, Gold_InfoLabelName);
    ObjectCreate(0, Gold_InfoLabelName, OBJ_LABEL, 0, 0, 0);
    
    // Reconfigure basic properties
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_CORNER, CORNER_LEFT_LOWER);
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_XDISTANCE, Gold_LeftPadding);
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_YDISTANCE, Gold_BottomPadding);
    ObjectSetString(0, Gold_InfoLabelName, OBJPROP_FONT, "Arial");
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_FONTSIZE, 9);
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_COLOR, clrDarkGoldenrod);
    ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_ZORDER, 998);
    
    if(Gold_ShowLabels)
    {
        double currentGoldPrice = Gold_GetCachedPrice(0);
        double rebasedCurrentPrice = currentGoldPrice * Gold_RebasingFactor;
        
        string displayText = StringFormat("Rebased XAUUSD: %.2f | Raw Gold: %.2f | Factor: %.6f", 
                                        rebasedCurrentPrice, currentGoldPrice, Gold_RebasingFactor);
        
        ObjectSetString(0, Gold_InfoLabelName, OBJPROP_TEXT, displayText);
        ObjectSetInteger(0, Gold_InfoLabelName, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
    }
    else
    {
        ObjectSetString(0, Gold_InfoLabelName, OBJPROP_TEXT, "");
    }
    
    ChartRedraw();
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
    // Calculate start position
    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;
    
    // Main calculation loop
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        // Get gold price for current bar using cached approach
        double goldPrice = Gold_GetCachedPrice(rates_total - 1 - i);
        
        if(goldPrice > 0 && MathIsValidNumber(goldPrice))
        {
            // Calculate rebased value
            Gold_RebasedBuffer[i] = goldPrice * Gold_RebasingFactor;
        }
        else
        {
            Gold_RebasedBuffer[i] = EMPTY_VALUE;
        }
    }
    
    // Calculate moving averages using Gold-specific functions
    Gold_CalculateEMA(rates_total, start);
    Gold_CalculateSMMA(rates_total, prev_calculated);
    Gold_CalculateHRMA(rates_total, prev_calculated);
    
    // Update display
    Gold_UpdateDisplay();
    
    return rates_total;
}

//+------------------------------------------------------------------+
//| Calculate EMA values - Gold specific function                    |
//+------------------------------------------------------------------+
void Gold_CalculateEMA(int rates_total, int start)
{
    double alpha = 2.0 / (Gold_EMAPeriod + 1);
    
    // Initialize first value if it's the first calculation
    if(start == 0 && Gold_RebasedBuffer[0] != EMPTY_VALUE)
    {
        Gold_EMA_Buffer[0] = Gold_RebasedBuffer[0];
        start = 1;
    }
    
    // Calculate EMA
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(Gold_RebasedBuffer[i] != EMPTY_VALUE && i > 0 && Gold_EMA_Buffer[i-1] != EMPTY_VALUE)
        {
            Gold_EMA_Buffer[i] = (Gold_RebasedBuffer[i] - Gold_EMA_Buffer[i-1]) * alpha + Gold_EMA_Buffer[i-1];
        }
        else if(Gold_RebasedBuffer[i] != EMPTY_VALUE)
        {
            Gold_EMA_Buffer[i] = Gold_RebasedBuffer[i];
        }
        else
        {
            Gold_EMA_Buffer[i] = EMPTY_VALUE;
        }
    }
}

//+------------------------------------------------------------------+
//| Calculate SMMA values - Gold specific function                   |
//+------------------------------------------------------------------+
void Gold_CalculateSMMA(int rates_total, int prev_calculated)
{
    // Check for minimum number of bars
    if(rates_total < Gold_SMMAPeriod)
        return;
    
    int start;
    
    // First calculation
    if(prev_calculated == 0)
    {
        start = Gold_SMMAPeriod;
        
        // Set empty values for first bars
        for(int i = 0; i < start - 1; i++)
            Gold_SMMA_Buffer[i] = EMPTY_VALUE;
        
        // Calculate first visible value
        double first_value = 0;
        int count = 0;
        for(int i = 0; i < start; i++)
        {
            if(Gold_RebasedBuffer[i] != EMPTY_VALUE)
            {
                first_value += Gold_RebasedBuffer[i];
                count++;
            }
        }
        
        if(count > 0)
        {
            first_value /= count;
            Gold_SMMA_Buffer[start - 1] = first_value;
        }
        else
        {
            Gold_SMMA_Buffer[start - 1] = EMPTY_VALUE;
        }
    }
    else
    {
        start = prev_calculated - 1;
    }
    
    // Main calculation loop
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(Gold_RebasedBuffer[i] != EMPTY_VALUE && i > 0 && Gold_SMMA_Buffer[i-1] != EMPTY_VALUE)
        {
            Gold_SMMA_Buffer[i] = (Gold_SMMA_Buffer[i - 1] * (Gold_SMMAPeriod - 1) + Gold_RebasedBuffer[i]) / Gold_SMMAPeriod;
        }
        else
        {
            Gold_SMMA_Buffer[i] = EMPTY_VALUE;
        }
    }
}

//+------------------------------------------------------------------+
//| Calculate HRMA values - Gold specific function                   |
//+------------------------------------------------------------------+
void Gold_CalculateHRMA(int rates_total, int prev_calculated)
{
    // Check for minimum number of bars
    if(rates_total < Gold_HRMAPeriod)
        return;
    
    int start = prev_calculated > 0 ? prev_calculated - 1 : 0;
    
    // Calculate HRMA using RMA approach
    double alpha1 = 2.0 / (Gold_HRMAPeriod / 2.0 + 1);
    double alpha2 = 2.0 / (Gold_HRMAPeriod + 1);
    double alpha3 = 2.0 / (MathSqrt(Gold_HRMAPeriod) + 1);
    
    for(int i = start; i < rates_total && !IsStopped(); i++)
    {
        if(Gold_RebasedBuffer[i] == EMPTY_VALUE)
        {
            Gold_HRMA_Buffer[i] = EMPTY_VALUE;
            continue;
        }
        
        if(i == 0)
        {
            Gold_RMA1_Buffer[i] = Gold_RebasedBuffer[i];
            Gold_RMA2_Buffer[i] = Gold_RebasedBuffer[i];
            Gold_HRMA_Buffer[i] = Gold_RebasedBuffer[i];
        }
        else if(i > 0 && Gold_RMA1_Buffer[i-1] != EMPTY_VALUE && Gold_RMA2_Buffer[i-1] != EMPTY_VALUE && Gold_HRMA_Buffer[i-1] != EMPTY_VALUE)
        {
            // Calculate first RMA
            Gold_RMA1_Buffer[i] = alpha1 * Gold_RebasedBuffer[i] + (1 - alpha1) * Gold_RMA1_Buffer[i-1];
            
            // Calculate second RMA
            Gold_RMA2_Buffer[i] = alpha2 * Gold_RebasedBuffer[i] + (1 - alpha2) * Gold_RMA2_Buffer[i-1];
            
            // Calculate HRMA
            double hrmaValue = 2 * Gold_RMA1_Buffer[i] - Gold_RMA2_Buffer[i];
            Gold_HRMA_Buffer[i] = alpha3 * hrmaValue + (1 - alpha3) * Gold_HRMA_Buffer[i-1];
        }
        else
        {
            Gold_RMA1_Buffer[i] = Gold_RebasedBuffer[i];
            Gold_RMA2_Buffer[i] = Gold_RebasedBuffer[i];
            Gold_HRMA_Buffer[i] = Gold_RebasedBuffer[i];
        }
    }
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Delete the info label
    ObjectDelete(0, Gold_InfoLabelName);
    
    // Clean up any other created objects with Gold prefix
    ObjectsDeleteAll(0, Gold_LabelPrefix);
    
    Print("Rebased XAUUSD Indicator deinitialized - All Gold objects cleaned up");
    
    ChartRedraw();
}
//+------------------------------------------------------------------+