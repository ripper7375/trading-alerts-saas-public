# Symbol Resolution for Broker-Specific Naming

**Last Updated:** 2026-01-14
**Part 6:** Flask MT5 Service
**Purpose:** Handle broker-specific symbol naming conventions

---

## Overview

Different MT5 brokers use different symbol naming conventions. For example:
- **Clean name:** `EURUSD`
- **Eightcap:** `EURUSD.i` (adds `.i` suffix to forex pairs)
- **Other brokers:** May use `-c`, `c`, `.a`, etc.

The **SymbolResolver** automatically detects and resolves clean symbol names to broker-specific names.

---

## Problem Statement

### Issue Encountered
During localhost deployment testing with Eightcap broker, the MT5 Python API could not detect symbols because:
- Application sends: `EURUSD`
- MT5 terminal expects: `EURUSD.i`

### Error Example
```python
# Without symbol resolution
rates = mt5.copy_rates_from_pos("EURUSD", mt5.TIMEFRAME_M5, 0, 1000)
# Result: None (symbol not found)
```

---

## Solution: Symbol Resolver

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Flask MT5 Service (Part 6)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Request arrives: symbol="EURUSD"                        │
│                                                             │
│  2. SymbolResolver.resolve("EURUSD")                        │
│     ├─ Check cache first                                    │
│     ├─ Try exact match: "EURUSD" ❌                         │
│     ├─ Try with .i suffix: "EURUSD.i" ✅                    │
│     └─ Cache result: "EURUSD" -> "EURUSD.i"                 │
│                                                             │
│  3. Use resolved symbol in MT5 API                          │
│     mt5.copy_rates_from_pos("EURUSD.i", ...)  ✅           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Based on MQL5 Methodology

The implementation is based on the MQL5 indicator:
```
mql5-indicators/symbol-name-detection/
  Symbol Information_Revised_8_Multi_Symbol_Code Base_Data Transform_Light Version_11.mq5
```

**Key MQL5 functions used as reference:**
- `IsAllowedSymbol()` (lines 80-101): Checks exact match + with/without suffix
- `StringFind(symbol, "EURUSD") == 0`: Checks if symbol starts with clean name
- `SymbolInfoDouble()` calls: Uses full broker-specific symbol name

---

## Implementation

### File Structure

```
mt5-service/
├── app/
│   ├── utils/
│   │   └── symbol_resolver.py       # Symbol resolution utility
│   └── services/
│       └── indicator_reader.py      # Integrates symbol resolver
└── tests/
    └── test_symbol_resolver.py      # Unit tests
```

### Usage

#### 1. Automatic Resolution in indicator_reader.py

```python
from app.utils.symbol_resolver import get_symbol_resolver

# Resolve symbol before MT5 API calls
resolver = get_symbol_resolver()
resolved_symbol = resolver.resolve("EURUSD")  # Returns "EURUSD.i" for Eightcap

# Use resolved symbol in MT5 API
rates = mt5.copy_rates_from_pos(resolved_symbol, mt5_timeframe, 0, bars)
```

#### 2. Standalone Usage

```python
from app.utils.symbol_resolver import resolve_symbol

# Quick single resolution
broker_symbol = resolve_symbol("EURUSD")  # Returns "EURUSD.i"
```

#### 3. Batch Resolution

```python
from app.utils.symbol_resolver import get_symbol_resolver

resolver = get_symbol_resolver()
symbols = ["EURUSD", "GBPUSD", "XAUUSD"]
resolved = resolver.resolve_batch(symbols)

# Result:
# {
#   "EURUSD": "EURUSD.i",
#   "GBPUSD": "GBPUSD.i",
#   "XAUUSD": "XAUUSD"
# }
```

---

## Resolution Strategy

The resolver follows this order:

### Step 1: Check Cache
```python
if symbol in cache:
    return cache[symbol]
```

### Step 2: Try Exact Match
```python
if symbol_exists("EURUSD"):
    return "EURUSD"
```

### Step 3: Try Common Suffixes
```python
suffixes = ['.i', '-c', 'c', '.a', '_i', '.m', '-m', '.raw', '-raw']
for suffix in suffixes:
    test_symbol = "EURUSD" + suffix  # e.g., "EURUSD.i"
    if symbol_exists(test_symbol):
        return test_symbol
```

### Step 4: Try Removing Suffix
```python
if "EURUSD.i".endswith('.i'):
    base = "EURUSD"
    if symbol_exists(base):
        return base
```

### Step 5: Try Suffix Replacement
```python
# If EURUSD-c doesn't exist, try EURUSD.i
for old_suffix in suffixes:
    for new_suffix in suffixes:
        test_symbol = "EURUSD" + new_suffix
        if symbol_exists(test_symbol):
            return test_symbol
```

### Step 6: Return Original
```python
# Symbol not found in any variation
return "EURUSD"  # Return original and log warning
```

---

## Broker-Specific Examples

### Eightcap Broker

| Clean Symbol | Eightcap Symbol | Notes |
|-------------|-----------------|-------|
| `EURUSD` | `EURUSD.i` | Forex pairs have `.i` suffix |
| `GBPUSD` | `GBPUSD.i` | Forex pairs have `.i` suffix |
| `USDJPY` | `USDJPY.i` | Forex pairs have `.i` suffix |
| `XAUUSD` | `XAUUSD` | Metals: NO suffix |
| `XAGUSD` | `XAGUSD` | Metals: NO suffix |
| `BTCUSD` | `BTCUSD` | Crypto: NO suffix |
| `ETHUSD` | `ETHUSD` | Crypto: NO suffix |

### Other Brokers

| Broker | Naming Pattern | Example |
|--------|---------------|---------|
| ICMarkets | `-c` suffix | `EURUSD-c` |
| Pepperstone | No suffix | `EURUSD` |
| XM | `.` suffix | `EURUSD.` |
| FTMO | `.a` suffix | `EURUSD.a` |

---

## Performance Optimization

### Caching
The resolver caches all successful resolutions:

```python
# First call: Looks up in MT5 terminal
resolved = resolver.resolve("EURUSD")  # Takes ~10-50ms

# Subsequent calls: Returns from cache
resolved = resolver.resolve("EURUSD")  # Takes ~0.1ms
```

### Cache Statistics
```python
stats = resolver.get_cache_stats()
# {
#   'cached_symbols': 15,
#   'available_symbols': 150
# }
```

### Clear Cache
```python
resolver.clear_cache()  # Clear if terminal symbols change
```

---

## Testing

### Run Unit Tests
```bash
cd mt5-service
pytest tests/test_symbol_resolver.py -v
```

### Test Coverage
- ✅ Exact match resolution
- ✅ Suffix addition (`.i`, `-c`, etc.)
- ✅ Suffix removal
- ✅ Suffix replacement
- ✅ Caching behavior
- ✅ Batch resolution
- ✅ Eightcap-specific scenarios
- ✅ MT5 not available scenarios

---

## Troubleshooting

### Issue 1: Symbol Still Not Found

**Symptom:**
```
Symbol 'EURUSD' not found in any variation. Returning original name.
```

**Solution:**
1. Check MT5 terminal is running
2. Verify symbol is added to Market Watch
3. Check broker's exact symbol naming:
   ```python
   import MetaTrader5 as mt5
   mt5.initialize()
   symbols = mt5.symbols_get()
   for s in symbols:
       if "EURUSD" in s.name:
           print(s.name)  # See exact broker naming
   ```

### Issue 2: Wrong Symbol Resolved

**Symptom:**
```
Symbol 'EURUSD' resolved to 'EURUSD.i' but should be 'EURUSD-c'
```

**Solution:**
Update suffix priority in `BROKER_SUFFIXES` list:
```python
# In symbol_resolver.py
BROKER_SUFFIXES = [
    '-c',      # Move this to first priority
    '.i',      # Lower priority
    # ...
]
```

### Issue 3: Cache Contains Stale Data

**Symptom:**
Symbol was renamed in MT5 terminal but resolver returns old name

**Solution:**
Clear cache:
```python
from app.utils.symbol_resolver import get_symbol_resolver

resolver = get_symbol_resolver()
resolver.clear_cache()
```

---

## Integration Points

The SymbolResolver is integrated at these points:

### 1. indicator_reader.py
```python
def fetch_indicator_data(connection, symbol, timeframe, bars):
    # Resolve symbol
    resolver = get_symbol_resolver()
    resolved_symbol = resolver.resolve(symbol)

    # Use resolved symbol
    rates = mt5.copy_rates_from_pos(resolved_symbol, mt5_timeframe, 0, bars)
```

### 2. PRO Indicators
```python
def fetch_pro_indicators(connection, symbol, timeframe, bars):
    # Resolve symbol
    resolver = get_symbol_resolver()
    resolved_symbol = resolver.resolve(symbol)

    # Use resolved symbol in all indicator fetches
    handle = mt5.iCustom(resolved_symbol, timeframe, indicator_name)
```

### 3. WebSocket (Future)
```python
def send_initial_data(symbol, timeframe, room):
    resolver = get_symbol_resolver()
    resolved_symbol = resolver.resolve(symbol)

    data = fetch_indicator_data(connection, resolved_symbol, timeframe)
```

---

## Best Practices

### 1. Always Resolve Before MT5 API Calls
```python
# ❌ BAD: Use symbol directly
rates = mt5.copy_rates_from_pos(symbol, ...)

# ✅ GOOD: Resolve first
resolved = resolver.resolve(symbol)
rates = mt5.copy_rates_from_pos(resolved, ...)
```

### 2. Log Resolution Changes
```python
if resolved_symbol != symbol:
    logger.info(f"Symbol '{symbol}' resolved to '{resolved_symbol}'")
```

### 3. Use Global Singleton
```python
# ✅ GOOD: Use singleton
from app.utils.symbol_resolver import get_symbol_resolver
resolver = get_symbol_resolver()

# ❌ BAD: Create new instances
resolver = SymbolResolver()  # Don't do this
```

### 4. Clear Cache on Reconnect
```python
def reconnect_mt5_terminal():
    # After reconnecting MT5
    resolver = get_symbol_resolver()
    resolver.clear_cache()  # Reload symbols
```

---

## Future Enhancements

### 1. Broker Detection
Auto-detect broker and use appropriate suffix pattern:
```python
broker = detect_broker()  # "Eightcap", "ICMarkets", etc.
suffix = BROKER_SUFFIX_MAP[broker]  # '.i', '-c', etc.
```

### 2. Configuration File
Store broker-specific mappings in config:
```json
{
  "broker": "Eightcap",
  "symbol_mappings": {
    "EURUSD": "EURUSD.i",
    "GBPUSD": "GBPUSD.i",
    "XAUUSD": "XAUUSD"
  }
}
```

### 3. Symbol Info Caching
Cache symbol properties (contract size, tick value, etc.):
```python
resolver.get_symbol_info("EURUSD")  # Returns cached SymbolInfo
```

---

## References

### MQL5 Source
- **File:** `mql5-indicators/symbol-name-detection/Symbol Information_Revised_8_Multi_Symbol_Code Base_Data Transform_Light Version_11.mq5`
- **Key Functions:**
  - `IsAllowedSymbol()` (lines 80-101)
  - `GetUSDConversionFactor()` (lines 339-434)
  - `StringFind(symbol, "EURUSD") == 0` pattern

### Python Implementation
- **File:** `mt5-service/app/utils/symbol_resolver.py`
- **Integration:** `mt5-service/app/services/indicator_reader.py`
- **Tests:** `mt5-service/tests/test_symbol_resolver.py`

---

## Conclusion

The SymbolResolver provides **automatic, transparent handling** of broker-specific symbol naming conventions. Once integrated:

✅ Clean symbols work with any broker
✅ No manual symbol mapping needed
✅ Cached for performance
✅ Tested with Eightcap and extensible to other brokers

**Result:** The Flask MT5 Service (Part 6) now works seamlessly with brokers that use custom symbol naming conventions!

---

**Last Updated:** 2026-01-14
**Status:** ✅ IMPLEMENTED
**Testing:** Eightcap broker (`.i` suffix)
