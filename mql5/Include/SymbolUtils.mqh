//+------------------------------------------------------------------+
//| SymbolUtils.mqh - Symbol validation with DEBUG logging          |
//+------------------------------------------------------------------+

string g_AllowedSymbols[] = {
    "AUDJPY.i", "AUDUSD.i", "EURUSD.i", "GBPJPY.i", "GBPUSD.i",
    "NZDUSD.i", "USDCAD.i", "USDCHF.i", "USDJPY.i",
    "BTCUSD", "ETHUSD", "NDX100", "US30", "XAGUSD", "XAUUSD"
};

//+------------------------------------------------------------------+
//| Flexible symbol validation - handles .i suffix automatically    |
//| Returns: true if symbol is supported, false otherwise           |
//+------------------------------------------------------------------+
bool IsSymbolSupported(const string symbol)
{
    Print("=== DEBUG IsSymbolSupported ===");
    Print("Input symbol: [", symbol, "]");
    Print("Symbol length: ", StringLen(symbol));
    
    // Try exact match first
    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        Print("Checking exact match: [", symbol, "] vs [", g_AllowedSymbols[i], "]");
        if(symbol == g_AllowedSymbols[i])
        {
            Print("✓ EXACT MATCH FOUND!");
            return true;
        }
    }
    
    Print("No exact match, trying with toggled suffix...");
    
    // Toggle .i suffix and try again
    string toggledSymbol = "";
    int symbolLen = StringLen(symbol);
    
    // Check if symbol ends with .i
    if(symbolLen > 2)
    {
        string lastTwo = StringSubstr(symbol, symbolLen - 2);
        Print("Last 2 characters: [", lastTwo, "]");
        
        if(lastTwo == ".i")
        {
            // Has .i - remove it
            toggledSymbol = StringSubstr(symbol, 0, symbolLen - 2);
            Print("Symbol has .i suffix, removing: [", toggledSymbol, "]");
        }
        else
        {
            // No .i - add it
            toggledSymbol = symbol + ".i";
            Print("Symbol has no .i suffix, adding: [", toggledSymbol, "]");
        }
    }
    else
    {
        toggledSymbol = symbol + ".i";
        Print("Symbol too short, adding .i: [", toggledSymbol, "]");
    }
    
    // Check with toggled suffix
    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        Print("Checking toggled match: [", toggledSymbol, "] vs [", g_AllowedSymbols[i], "]");
        if(toggledSymbol == g_AllowedSymbols[i])
        {
            Print("✓ TOGGLED MATCH FOUND!");
            return true;
        }
    }
    
    Print("✗ NO MATCH FOUND - Symbol not supported");
    return false;
}

//+------------------------------------------------------------------+
//| Get list of supported symbols as string for display             |
//+------------------------------------------------------------------+
string GetSupportedSymbolsList()
{
    string list = "";
    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        if(i > 0) list += ", ";
        list += g_AllowedSymbols[i];
    }
    return list;
}