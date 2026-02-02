### **backfill_worker_api_gateway.py is:**

1. **Failure Recovery Agent**
   - Finds data that failed to send to API Gateway
   - Retries sending until successful

2. **SQLite Cleanup Service**
   - Goal: Keep SQLite EMPTY
   - Method: Successfully POST data, then DELETE from SQLite

3. **Second-Chance Uploader**
   - First chance: MQ5 EA tries API Gateway
   - Second chance: backfill_worker retries later

4. **Self-Healing Mechanism**
   - No manual intervention needed
   - Automatically recovers from temporary failures

## 💡 **The Lifecycle of a Failed Data Point**

```
┌─────────────────────────────────────────────────┐
│ 1. Data Collection (MQ5 EA)                    │
│    Timestamp: 2025-02-02 10:00:00              │
│    BTCUSD M5: Open=95000, Close=95100, etc.    │
└─────────────────────────────────────────────────┘
                    ↓
        Try POST to API Gateway
                    ↓
              ❌ FAILED
         (Railway is down)
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Fallback (MQ5 EA)                           │
│    INSERT INTO btcusd.db                        │
│    (timestamp=2025-02-02 10:00:00, ...)        │
└─────────────────────────────────────────────────┘
                    ↓
        Data sits in SQLite
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Discovery (backfill_worker - 5 min later)   │
│    "Found 1 bar in btcusd.db"                  │
└─────────────────────────────────────────────────┘
                    ↓
        Retry POST to API Gateway
                    ↓
              ✅ SUCCESS
         (Railway is back up)
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Cleanup (backfill_worker)                   │
│    DELETE FROM btcusd.db                        │
│    WHERE timestamp=2025-02-02 10:00:00         │
└─────────────────────────────────────────────────┘
                    ↓
         SQLite is EMPTY again
              (Healthy state!)
```
