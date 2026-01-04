//+------------------------------------------------------------------+
//|                                           IndicatorBuffers.mqh   |
//|                        Trading Alerts SaaS - Part 20             |
//|                                                                   |
//| Functions for reading indicator buffers and converting to JSON   |
//+------------------------------------------------------------------+
#property copyright "Trading Alerts SaaS"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| Constants for buffer reading                                      |
//+------------------------------------------------------------------+
#define DEFAULT_BUFFER_SIZE    100    // Default number of bars to read
#define MAX_BUFFER_SIZE        1000   // Maximum buffer size

//+------------------------------------------------------------------+
//| Get single indicator value from a specific buffer                 |
//|                                                                   |
//| Parameters:                                                       |
//|   handle       - Indicator handle from iCustom()                 |
//|   buffer_index - Which buffer to read (0, 1, 2, etc.)            |
//|   shift        - Bar shift (0 = current bar)                     |
//|                                                                   |
//| Returns:                                                          |
//|   The indicator value, or EMPTY_VALUE on error                   |
//+------------------------------------------------------------------+
double GetIndicatorValue(int handle, int buffer_index, int shift = 0)
{
    if(handle == INVALID_HANDLE)
        return EMPTY_VALUE;

    double buffer[];
    ArraySetAsSeries(buffer, true);

    if(CopyBuffer(handle, buffer_index, shift, 1, buffer) < 1)
        return EMPTY_VALUE;

    return buffer[0];
}

//+------------------------------------------------------------------+
//| Get array of indicator values from a buffer                       |
//+------------------------------------------------------------------+
bool GetIndicatorArray(int handle, int buffer_index, double &buffer[], int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return false;

    ArraySetAsSeries(buffer, true);
    int copied = CopyBuffer(handle, buffer_index, 0, count, buffer);

    return (copied > 0);
}

//+------------------------------------------------------------------+
//| Escape special characters for JSON string                         |
//+------------------------------------------------------------------+
string EscapeJsonString(string text)
{
    string result = text;
    StringReplace(result, "\\", "\\\\");
    StringReplace(result, "\"", "\\\"");
    StringReplace(result, "\n", "\\n");
    StringReplace(result, "\r", "\\r");
    StringReplace(result, "\t", "\\t");
    return result;
}

//+------------------------------------------------------------------+
//| Get Fractals as JSON                                              |
//|                                                                   |
//| Fractal Horizontal Line_V5 indicator buffers:                    |
//|   Buffer 0: Fractal peaks (up arrows)                            |
//|   Buffer 1: Fractal bottoms (down arrows)                        |
//|                                                                   |
//| Returns JSON: {"peaks":[{"index":n,"price":p},...],              |
//|                "bottoms":[{"index":n,"price":p},...]}            |
//+------------------------------------------------------------------+
string GetFractalsJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "{\"peaks\":[],\"bottoms\":[]}";

    double peaks[], bottoms[];
    ArraySetAsSeries(peaks, true);
    ArraySetAsSeries(bottoms, true);

    int peaks_copied = CopyBuffer(handle, 0, 0, count, peaks);
    int bottoms_copied = CopyBuffer(handle, 1, 0, count, bottoms);

    // Build peaks array
    string peaks_json = "";
    bool first_peak = true;
    for(int i = 0; i < peaks_copied; i++)
    {
        if(peaks[i] != EMPTY_VALUE && peaks[i] != 0)
        {
            if(!first_peak) peaks_json += ",";
            peaks_json += StringFormat("{\"index\":%d,\"price\":%.5f}", i, peaks[i]);
            first_peak = false;
        }
    }

    // Build bottoms array
    string bottoms_json = "";
    bool first_bottom = true;
    for(int i = 0; i < bottoms_copied; i++)
    {
        if(bottoms[i] != EMPTY_VALUE && bottoms[i] != 0)
        {
            if(!first_bottom) bottoms_json += ",";
            bottoms_json += StringFormat("{\"index\":%d,\"price\":%.5f}", i, bottoms[i]);
            first_bottom = false;
        }
    }

    return StringFormat("{\"peaks\":[%s],\"bottoms\":[%s]}", peaks_json, bottoms_json);
}

//+------------------------------------------------------------------+
//| Get Horizontal Trendlines as JSON                                 |
//|                                                                   |
//| Fractal Horizontal Line_V5 indicator buffers for lines:          |
//|   Buffer 2: Peak line 1                                          |
//|   Buffer 3: Peak line 2                                          |
//|   Buffer 4: Peak line 3                                          |
//|   Buffer 5: Bottom line 1                                        |
//|   Buffer 6: Bottom line 2                                        |
//|   Buffer 7: Bottom line 3                                        |
//|                                                                   |
//| Returns JSON with 6 line arrays                                   |
//+------------------------------------------------------------------+
string GetHorizontalLinesJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "{\"peak_1\":[],\"peak_2\":[],\"peak_3\":[],\"bottom_1\":[],\"bottom_2\":[],\"bottom_3\":[]}";

    // Buffer indices for horizontal lines (adjust based on actual indicator)
    // These are typically after the fractal buffers
    int peak_buffers[] = {2, 3, 4};
    int bottom_buffers[] = {5, 6, 7};
    string peak_names[] = {"peak_1", "peak_2", "peak_3"};
    string bottom_names[] = {"bottom_1", "bottom_2", "bottom_3"};

    string json = "{";

    // Process peak lines
    for(int p = 0; p < 3; p++)
    {
        double buffer[];
        ArraySetAsSeries(buffer, true);
        int copied = CopyBuffer(handle, peak_buffers[p], 0, count, buffer);

        string line_json = "";
        bool first = true;
        for(int i = 0; i < copied; i++)
        {
            if(buffer[i] != EMPTY_VALUE && buffer[i] != 0)
            {
                if(!first) line_json += ",";
                line_json += StringFormat("{\"index\":%d,\"value\":%.5f}", i, buffer[i]);
                first = false;
            }
        }

        json += StringFormat("\"%s\":[%s]", peak_names[p], line_json);
        json += ",";
    }

    // Process bottom lines
    for(int b = 0; b < 3; b++)
    {
        double buffer[];
        ArraySetAsSeries(buffer, true);
        int copied = CopyBuffer(handle, bottom_buffers[b], 0, count, buffer);

        string line_json = "";
        bool first = true;
        for(int i = 0; i < copied; i++)
        {
            if(buffer[i] != EMPTY_VALUE && buffer[i] != 0)
            {
                if(!first) line_json += ",";
                line_json += StringFormat("{\"index\":%d,\"value\":%.5f}", i, buffer[i]);
                first = false;
            }
        }

        json += StringFormat("\"%s\":[%s]", bottom_names[b], line_json);
        if(b < 2) json += ",";
    }

    json += "}";
    return json;
}

//+------------------------------------------------------------------+
//| Get Diagonal Trendlines as JSON                                   |
//|                                                                   |
//| Fractal Diagonal Line_V4 indicator buffers:                       |
//|   Buffer 0: Ascending line 1                                     |
//|   Buffer 1: Ascending line 2                                     |
//|   Buffer 2: Ascending line 3                                     |
//|   Buffer 3: Descending line 1                                    |
//|   Buffer 4: Descending line 2                                    |
//|   Buffer 5: Descending line 3                                    |
//|                                                                   |
//| Returns JSON with 6 diagonal line arrays                          |
//+------------------------------------------------------------------+
string GetDiagonalLinesJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "{\"ascending_1\":[],\"ascending_2\":[],\"ascending_3\":[],\"descending_1\":[],\"descending_2\":[],\"descending_3\":[]}";

    string asc_names[] = {"ascending_1", "ascending_2", "ascending_3"};
    string desc_names[] = {"descending_1", "descending_2", "descending_3"};

    string json = "{";

    // Process ascending lines (buffers 0-2)
    for(int a = 0; a < 3; a++)
    {
        double buffer[];
        ArraySetAsSeries(buffer, true);
        int copied = CopyBuffer(handle, a, 0, count, buffer);

        string line_json = "";
        bool first = true;
        for(int i = 0; i < copied; i++)
        {
            if(buffer[i] != EMPTY_VALUE && buffer[i] != 0)
            {
                if(!first) line_json += ",";
                line_json += StringFormat("{\"index\":%d,\"value\":%.5f}", i, buffer[i]);
                first = false;
            }
        }

        json += StringFormat("\"%s\":[%s],", asc_names[a], line_json);
    }

    // Process descending lines (buffers 3-5)
    for(int d = 0; d < 3; d++)
    {
        double buffer[];
        ArraySetAsSeries(buffer, true);
        int copied = CopyBuffer(handle, d + 3, 0, count, buffer);

        string line_json = "";
        bool first = true;
        for(int i = 0; i < copied; i++)
        {
            if(buffer[i] != EMPTY_VALUE && buffer[i] != 0)
            {
                if(!first) line_json += ",";
                line_json += StringFormat("{\"index\":%d,\"value\":%.5f}", i, buffer[i]);
                first = false;
            }
        }

        json += StringFormat("\"%s\":[%s]", desc_names[d], line_json);
        if(d < 2) json += ",";
    }

    json += "}";
    return json;
}

//+------------------------------------------------------------------+
//| Get Momentum Candles as JSON array                                |
//|                                                                   |
//| Body Size Momentum Candle_V2 indicator buffers:                   |
//|   Buffer 0: Momentum type (1=UP_LARGE, 2=UP_EXTREME,             |
//|                           4=DOWN_LARGE, 5=DOWN_EXTREME)          |
//|   Buffer 1: Z-score value                                        |
//|                                                                   |
//| Returns JSON: [{"index":n,"type":t,"zscore":z},...]              |
//+------------------------------------------------------------------+
string GetMomentumJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "[]";

    double types[], zscores[];
    ArraySetAsSeries(types, true);
    ArraySetAsSeries(zscores, true);

    int types_copied = CopyBuffer(handle, 0, 0, count, types);
    int zscores_copied = CopyBuffer(handle, 1, 0, count, zscores);

    int max_count = MathMin(types_copied, zscores_copied);

    string json = "";
    bool first = true;

    for(int i = 0; i < max_count; i++)
    {
        // Only include bars with valid momentum signals
        // Type values: 1=UP_LARGE, 2=UP_EXTREME, 4=DOWN_LARGE, 5=DOWN_EXTREME
        if(types[i] != EMPTY_VALUE && types[i] != 0)
        {
            int type_val = (int)types[i];
            // Validate type is one of the expected values
            if(type_val == 1 || type_val == 2 || type_val == 4 || type_val == 5)
            {
                if(!first) json += ",";

                double zscore_val = (zscores_copied > i && zscores[i] != EMPTY_VALUE) ? zscores[i] : 0.0;
                json += StringFormat("{\"index\":%d,\"type\":%d,\"zscore\":%.4f}", i, type_val, zscore_val);
                first = false;
            }
        }
    }

    return "[" + json + "]";
}

//+------------------------------------------------------------------+
//| Get Keltner Channels as JSON                                      |
//|                                                                   |
//| Keltner Channel_ATF_10 Bands indicator has 10 bands:             |
//|   Buffer 0: Ultra Extreme Upper                                  |
//|   Buffer 1: Extreme Upper                                        |
//|   Buffer 2: Upper Most                                           |
//|   Buffer 3: Upper                                                |
//|   Buffer 4: Upper Middle                                         |
//|   Buffer 5: Lower Middle                                         |
//|   Buffer 6: Lower                                                |
//|   Buffer 7: Lower Most                                           |
//|   Buffer 8: Extreme Lower                                        |
//|   Buffer 9: Ultra Extreme Lower                                  |
//|                                                                   |
//| Returns JSON with all 10 band arrays                              |
//+------------------------------------------------------------------+
string GetKeltnerJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "{\"ultra_extreme_upper\":[],\"extreme_upper\":[],\"upper_most\":[],\"upper\":[],\"upper_middle\":[],\"lower_middle\":[],\"lower\":[],\"lower_most\":[],\"extreme_lower\":[],\"ultra_extreme_lower\":[]}";

    string band_names[] = {
        "ultra_extreme_upper",
        "extreme_upper",
        "upper_most",
        "upper",
        "upper_middle",
        "lower_middle",
        "lower",
        "lower_most",
        "extreme_lower",
        "ultra_extreme_lower"
    };

    string json = "{";

    for(int b = 0; b < 10; b++)
    {
        double buffer[];
        ArraySetAsSeries(buffer, true);
        int copied = CopyBuffer(handle, b, 0, count, buffer);

        // For Keltner channels, we want to store the values at each index
        // even if they're the same (it's a continuous band)
        string band_json = "";
        bool first = true;

        // Only include every Nth value to reduce data size, or store current value
        // For real-time, we typically just need the current value
        for(int i = 0; i < copied; i++)
        {
            if(buffer[i] != EMPTY_VALUE)
            {
                if(!first) band_json += ",";
                band_json += StringFormat("%.5f", buffer[i]);
                first = false;
            }
            else
            {
                if(!first) band_json += ",";
                band_json += "null";
                first = false;
            }
        }

        json += StringFormat("\"%s\":[%s]", band_names[b], band_json);
        if(b < 9) json += ",";
    }

    json += "}";
    return json;
}

//+------------------------------------------------------------------+
//| Get ZigZag as JSON                                                |
//|                                                                   |
//| ZigZagColor & MarketStructure_JSON Export indicator:              |
//|   Buffer 0: ZigZag peaks (swing highs)                           |
//|   Buffer 1: ZigZag bottoms (swing lows)                          |
//|                                                                   |
//| Returns JSON: {"peaks":[{"index":n,"price":p},...],              |
//|                "bottoms":[{"index":n,"price":p},...]}            |
//+------------------------------------------------------------------+
string GetZigZagJSON(int handle, int count = DEFAULT_BUFFER_SIZE)
{
    if(handle == INVALID_HANDLE)
        return "{\"peaks\":[],\"bottoms\":[]}";

    double peaks[], bottoms[];
    ArraySetAsSeries(peaks, true);
    ArraySetAsSeries(bottoms, true);

    int peaks_copied = CopyBuffer(handle, 0, 0, count, peaks);
    int bottoms_copied = CopyBuffer(handle, 1, 0, count, bottoms);

    // Build peaks array
    string peaks_json = "";
    bool first_peak = true;
    for(int i = 0; i < peaks_copied; i++)
    {
        if(peaks[i] != EMPTY_VALUE && peaks[i] != 0)
        {
            if(!first_peak) peaks_json += ",";
            peaks_json += StringFormat("{\"index\":%d,\"price\":%.5f}", i, peaks[i]);
            first_peak = false;
        }
    }

    // Build bottoms array
    string bottoms_json = "";
    bool first_bottom = true;
    for(int i = 0; i < bottoms_copied; i++)
    {
        if(bottoms[i] != EMPTY_VALUE && bottoms[i] != 0)
        {
            if(!first_bottom) bottoms_json += ",";
            bottoms_json += StringFormat("{\"index\":%d,\"price\":%.5f}", i, bottoms[i]);
            first_bottom = false;
        }
    }

    return StringFormat("{\"peaks\":[%s],\"bottoms\":[%s]}", peaks_json, bottoms_json);
}

//+------------------------------------------------------------------+
//| Get TEMA/HRMA/SMMA values as separate function                    |
//|                                                                   |
//| TEMA_HRMA_SMA-SMMA_Modified Buffers indicator:                   |
//|   Buffer 0: TEMA (Triple Exponential Moving Average)             |
//|   Buffer 1: HRMA (Hull-like Responsive Moving Average)           |
//|   Buffer 2: SMMA (Smoothed Moving Average)                       |
//|                                                                   |
//| Use GetIndicatorValue(handle, buffer_index) for single values    |
//+------------------------------------------------------------------+
double GetTEMA(int handle, int shift = 0)
{
    return GetIndicatorValue(handle, 0, shift);
}

double GetHRMA(int handle, int shift = 0)
{
    return GetIndicatorValue(handle, 1, shift);
}

double GetSMMA(int handle, int shift = 0)
{
    return GetIndicatorValue(handle, 2, shift);
}

//+------------------------------------------------------------------+
//| Validate JSON string - basic check                                |
//+------------------------------------------------------------------+
bool IsValidJSON(string json)
{
    if(StringLen(json) < 2)
        return false;

    string first = StringSubstr(json, 0, 1);
    string last = StringSubstr(json, StringLen(json) - 1, 1);

    // Check for object or array
    if((first == "{" && last == "}") || (first == "[" && last == "]"))
        return true;

    return false;
}

//+------------------------------------------------------------------+
