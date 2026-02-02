Complete File Inventory on Contabo VPS

1. MT5 Platform Files (5 Terminals)
   C:/Program Files/MetaTrader 5/
   ├─ terminal.exe (MT5 Terminal 1)
   ├─ terminal.exe (MT5 Terminal 2)
   ├─ ... (Terminals 3-5)

2. MQL5 EA Files (Expert Advisors)
   C:/Users/[User]/AppData/Roaming/MetaQuotes/Terminal/[TERMINAL_ID]/MQL5/Experts/
   ├─ SimpleDataCollector_v2_24_API_GATEWAY.mq5 ← Source code
   └─ SimpleDataCollector_v2_24_API_GATEWAY.ex5 ← Compiled executable

Important:
.mq5 = Source code (human-readable)
.ex5 = Compiled binary (what MT5 actually runs)
Each of 5 terminals needs this EA attached

3. MQL5 Indicator Files (Many!)
   C:/Users/[User]/AppData/Roaming/MetaQuotes/Terminal/[TERMINAL_ID]/MQL5/Indicators/
   ├─ TEMA.mq5 / TEMA.ex5
   ├─ HRMA.mq5 / HRMA.ex5
   ├─ SMMA.mq5 / SMMA.ex5
   ├─ ZScore_BodySize.mq5 / ZScore_BodySize.ex5
   ├─ Fractal_Diagonal_Lines.mq5 / Fractal_Diagonal_Lines.ex5
   ├─ Fractal_Horizontal_Lines.mq5 / Fractal_Horizontal_Lines.ex5
   ├─ Heiken_Ashi_ZScore.mq5 / Heiken_Ashi_ZScore.ex5
   ├─ Keltner_Channel.mq5 / Keltner_Channel.ex5
   ├─ Support_Resistance.mq5 / Support_Resistance.ex5
   └─ ZigZag_EMA.mq5 / ZigZag_EMA.ex5
   Based on lines 118-127 in the EA, you need at least 10 custom indicators.

4. MQL5 Library Files (SQLite)
   C:/Users/[User]/AppData/Roaming/MetaQuotes/Terminal/[TERMINAL_ID]/MQL5/Include/SQLite3/
   ├─ SQLite3Base.mqh ← Header file (line 20 includes this)
   └─ sqlite3.dll ← SQLite library
   From line 20:
   mql5#include <SQLite3\SQLite3Base.mqh>

```

---

### **5. Python Files**
```

C:/Scripts/
└─ backfill_worker_api_gateway.py ← Plain Python script (no framework)
Dependencies needed:
powershellpip install requests

```

---

### **6. SQLite Database Files (Written by MQ5 EA)**
```

C:/Scripts/database/
├─ btcusd.db ← Terminal 1 symbols
├─ ethusd.db
├─ xauusd.db
├─ eurusd.db ← Terminal 2 symbols
├─ gbpusd.db
├─ usdjpy.db
├─ xagusd.db ← Terminal 3 symbols
├─ wtiusd.db
├─ audusd.db
├─ nzdusd.db ← Terminal 4 symbols
├─ usdcad.db
├─ us30.db
├─ spx500.db ← Terminal 5 symbols
├─ nas100.db
└─ bnbusd.db

```

**Total: 15 .db files** (one per symbol)

---

### **7. Python Runtime**
```

C:/Python/
├─ python.exe ← Python interpreter (3.11+ recommended)
└─ Lib/site-packages/
└─ requests/ ← Only external dependency

```

---

## 📊 **File Organization Summary**

| Category | Location | Files | Purpose |
|----------|----------|-------|---------|
| **MT5 Platform** | `C:/Program Files/MetaTrader 5/` | 5 terminals | Run MT5 instances |
| **EA (Compiled)** | `MQL5/Experts/` | `.ex5` files | Collect data, POST to API |
| **Indicators (Compiled)** | `MQL5/Indicators/` | ~10 `.ex5` files | Calculate indicator values |
| **MQL5 Source** | `MQL5/Experts/` | `.mq5` files | Source code (optional) |
| **SQLite Library** | `MQL5/Include/SQLite3/` | `.mqh` + `.dll` | Enable SQLite in MQL5 |
| **Python Script** | `C:/Scripts/` | `.py` file | Retry failed API POSTs |
| **SQLite DBs** | `C:/Scripts/database/` | 15 `.db` files | Temporary failure queue |
| **Python Runtime** | `C:/Python/` | Interpreter | Run Python script |

---

## 🔧 **Important Compilation Notes**

### **You Need to COMPILE .mq5 → .ex5**

In MetaEditor:
```

1. Open .mq5 file
2. Press F7 (or click "Compile")
3. .ex5 file is generated
4. MT5 can now RUN the .ex5 file
   Why?

.mq5 = Human-readable source
.ex5 = Machine-executable binary
MT5 terminals run .ex5, not .mq5

🎯 Minimal File Checklist (What You MUST Have)
For each of 5 MT5 terminals, you need:

MT5 Terminal installed
SimpleDataCollector EA (.ex5)
10+ custom indicators (.ex5 each)
SQLite library (.mqh + .dll)

For Python backfill worker, you need:

Python installed (3.11+)
requests library installed
backfill_worker_api_gateway.py
C:/Scripts/database/ folder created

For SQLite databases, you need:

C:/Scripts/database/ folder exists
MQ5 EA has write permissions
Python script has read/write permissions

🚨 Common Deployment Mistakes to Avoid

❌ Mistake✅ CorrectOnly copied .mq5 filesMust compile to .ex5Missing indicator filesNeed all 10+ indicators compiledMissing SQLite libraryEA will fail to write to SQLitePython not installedbackfill_worker won't runWrong database pathEA writes to C:/Scripts/database/Missing requests librarypip install requests required

🎯 Final Answer to Your Question

Files on Contabo VPS:

✅ MQL5 EA file (both .mq5 source + .ex5 compiled)
✅ MQL5 indicator files (~10 indicators, both .mq5 + .ex5)
✅ Plain Python file (backfill_worker_api_gateway.py)
✅ SQLite database files (C:/Scripts/database/\*.db, 15 files)
➕ SQLite library for MQL5 (.mqh + .dll)
➕ Python runtime (Python interpreter + requests library)
➕ 5 MT5 Terminal installations (the platform itself)

Key insight: You listed the "business logic" files correctly, but don't forget the runtime dependencies (Python interpreter, MT5 platform, compiled executables, libraries)!
