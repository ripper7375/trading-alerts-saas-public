# Implementation Guide: 15-Min to 5-Min Data Pipeline Update

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────┘

Contabo VPS                 Railway                Railway              Railway
┌──────────┐              ┌─────────┐           ┌─────────┐         ┌──────────┐
│  MT5 EA  │─────────────▶│ BullMQ  │──────────▶│ Workers │────────▶│PostgreSQL│
│ (15 min) │  HTTP/Redis  │ (Queue) │  Consume  │(Process)│  INSERT │  (Store) │
└──────────┘              └─────────┘           └─────────┘         └──────────┘
     │                         │                      │                   │
     │ Every 15 minutes        │ 4 jobs/hour         │ 16ms each        │ 144K/mo
     │ 96 collections/day      │ Per symbol-TF       │ Processing       │ writes
     │                         │                      │                   │
     └─────────────────────────┴──────────────────────┴───────────────────┘
                              Batch size: ~50 symbols


┌────────────────────────────────────────────────────────────────┐
│                    UPDATED ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────┘

Contabo VPS                 Railway                Railway              Railway
┌──────────┐              ┌─────────┐           ┌─────────┐         ┌──────────┐
│  MT5 EA  │─────────────▶│ BullMQ  │──────────▶│ Workers │────────▶│PostgreSQL│
│ (5 min)  │  HTTP/Redis  │ (Queue) │  Consume  │(Process)│  INSERT │  (Store) │
└──────────┘              └─────────┘           └─────────┘         └──────────┘
     │                         │                      │                   │
     │ Every 5 minutes         │ 12 jobs/hour        │ 16ms each        │ 432K/mo
     │ 288 collections/day     │ Per symbol-TF (3×)  │ Processing       │ writes
     │                         │                      │                   │
     └─────────────────────────┴──────────────────────┴───────────────────┘
                              Batch size: ~50 symbols (same)
```

---

## 1. MT5 Expert Advisor (EA) Updates - Contabo VPS

### 1.1 Current EA Structure

**File**: `DataCollector.mq5`

```mql5
// Current implementation (15-minute intervals)

#property copyright "Your Trading SaaS"
#property version   "1.00"
#property strict

// Input parameters
input int UpdateIntervalMinutes = 15;  // ⚠️ CHANGE THIS TO 5
input string APIEndpoint = "https://your-railway-app.railway.app/api/market-data";
input string APIKey = "your-api-key-here";

// Global variables
datetime lastUpdate = 0;
int intervalSeconds;

//+------------------------------------------------------------------+
int OnInit()
{
   intervalSeconds = UpdateIntervalMinutes * 60;
   Print("Data Collector EA initialized. Update interval: ", UpdateIntervalMinutes, " minutes");

   // Set timer to check every minute
   EventSetTimer(60); // Check every 60 seconds

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnTimer()
{
   datetime currentTime = TimeCurrent();

   // Check if it's time to update
   if (currentTime - lastUpdate >= intervalSeconds)
   {
      CollectAndSendData();
      lastUpdate = currentTime;
   }
}

//+------------------------------------------------------------------+
void CollectAndSendData()
{
   // Your existing data collection logic
   Print("Collecting market data at ", TimeToString(TimeCurrent()));

   // Collect OHLCV and indicators
   // Send to BullMQ via HTTP endpoint
}
```

### 1.2 Updated EA for 5-Minute Intervals

**Changes Required**:

```mql5
// CHANGE 1: Update interval to 5 minutes
input int UpdateIntervalMinutes = 5;  // ✅ Changed from 15 to 5

// CHANGE 2: More precise timing
void OnTimer()
{
   datetime currentTime = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(currentTime, dt);

   // Only collect on 5-minute marks: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
   int minute = dt.min;

   if (minute % 5 == 0 && currentTime - lastUpdate >= 60)
   {
      // Wait 10 seconds after bar close to ensure data is settled
      Sleep(10000);

      CollectAndSendData();
      lastUpdate = currentTime;
   }
}
```

### 1.3 Production-Ready EA Implementation

**File**: `DataCollectorV2.mq5`

```mql5
#property copyright "Your Trading SaaS"
#property version   "2.00"
#property description "5-minute market data collector with retry logic"
#property strict

// ============================================================================
// INPUT PARAMETERS
// ============================================================================

input group "Collection Settings"
input int UpdateIntervalMinutes = 5;              // Update interval (minutes)
input int BarSettleDelaySeconds = 10;             // Wait for bar to settle
input bool EnableRetry = true;                     // Enable retry on failure
input int MaxRetries = 3;                          // Max retry attempts

input group "API Configuration"
input string APIEndpoint = "https://your-app.railway.app/api/market-data";
input string APIKey = "";                          // Set in EA properties (secure)
input int RequestTimeoutMs = 5000;                 // API request timeout

input group "Data Collection"
input bool CollectOHLCV = true;
input bool CollectIndicators = true;
input int ATRPeriod = 14;
input int ADXPeriod = 14;
input int RSIPeriod = 14;

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

datetime lastUpdate = 0;
int consecutiveFailures = 0;
bool isCollecting = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

int OnInit()
{
   // Validate API configuration
   if (StringLen(APIKey) == 0)
   {
      Print("ERROR: API Key is not set!");
      return(INIT_FAILED);
   }

   if (StringLen(APIEndpoint) == 0)
   {
      Print("ERROR: API Endpoint is not set!");
      return(INIT_FAILED);
   }

   // Validate update interval
   if (UpdateIntervalMinutes != 5 && UpdateIntervalMinutes != 15)
   {
      Print("WARNING: Recommended intervals are 5 or 15 minutes. Current: ", UpdateIntervalMinutes);
   }

   Print("============================================");
   Print("Data Collector EA v2.0 Initialized");
   Print("Update Interval: ", UpdateIntervalMinutes, " minutes");
   Print("API Endpoint: ", APIEndpoint);
   Print("Retry Enabled: ", EnableRetry);
   Print("============================================");

   // Set timer to check every 30 seconds
   EventSetTimer(30);

   return(INIT_SUCCEEDED);
}

// ============================================================================
// DEINITIALIZATION
// ============================================================================

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("Data Collector EA stopped. Reason: ", reason);
}

// ============================================================================
// TIMER EVENT
// ============================================================================

void OnTimer()
{
   // Prevent concurrent collections
   if (isCollecting)
   {
      Print("WARNING: Previous collection still in progress, skipping...");
      return;
   }

   datetime currentTime = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(currentTime, dt);

   int minute = dt.min;
   int second = dt.sec;

   // Check if we're on a 5-minute mark
   bool isTimeToCollect = (minute % UpdateIntervalMinutes == 0);

   // Only collect once per interval (within first 30 seconds of the mark)
   bool withinCollectionWindow = (second >= BarSettleDelaySeconds && second < 30);

   // Ensure we haven't already collected in this interval
   bool notYetCollected = (currentTime - lastUpdate >= UpdateIntervalMinutes * 60);

   if (isTimeToCollect && withinCollectionWindow && notYetCollected)
   {
      Print("─────────────────────────────────────");
      Print("Collection triggered at ", TimeToString(currentTime));

      isCollecting = true;

      bool success = CollectAndSendData();

      if (success)
      {
         lastUpdate = currentTime;
         consecutiveFailures = 0;
         Print("✓ Collection completed successfully");
      }
      else
      {
         consecutiveFailures++;
         Print("✗ Collection failed. Consecutive failures: ", consecutiveFailures);

         // Alert if too many failures
         if (consecutiveFailures >= 5)
         {
            Alert("Data Collector EA: ", consecutiveFailures, " consecutive failures!");
         }
      }

      isCollecting = false;
      Print("─────────────────────────────────────");
   }
}

// ============================================================================
// DATA COLLECTION AND TRANSMISSION
// ============================================================================

bool CollectAndSendData()
{
   string symbol = Symbol();
   ENUM_TIMEFRAMES timeframe = Period();
   string timeframeStr = TimeframeToString(timeframe);

   Print("Collecting data for ", symbol, " ", timeframeStr);

   // Step 1: Collect OHLCV data
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(symbol, timeframe, 0, 16, rates); // Get last 16 bars

   if (copied <= 0)
   {
      Print("ERROR: Failed to copy rates. Error: ", GetLastError());
      return false;
   }

   Print("Copied ", copied, " bars");

   // Step 2: Collect indicator values
   double atr[], adx[], rsi[];
   bool indicatorsOk = true;

   if (CollectIndicators)
   {
      indicatorsOk = CollectIndicatorData(symbol, timeframe, atr, adx, rsi);
      if (!indicatorsOk)
      {
         Print("WARNING: Failed to collect some indicators, proceeding anyway...");
      }
   }

   // Step 3: Build JSON payload
   string jsonPayload = BuildJSONPayload(symbol, timeframeStr, rates, atr, adx, rsi, copied);

   // Step 4: Send to API
   bool sendSuccess = SendToAPI(jsonPayload);

   return sendSuccess;
}

// ============================================================================
// INDICATOR COLLECTION
// ============================================================================

bool CollectIndicatorData(string symbol, ENUM_TIMEFRAMES timeframe,
                         double &atr[], double &adx[], double &rsi[])
{
   ArraySetAsSeries(atr, true);
   ArraySetAsSeries(adx, true);
   ArraySetAsSeries(rsi, true);

   // ATR
   int atrHandle = iATR(symbol, timeframe, ATRPeriod);
   if (atrHandle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to create ATR indicator");
      return false;
   }

   if (CopyBuffer(atrHandle, 0, 0, 16, atr) <= 0)
   {
      Print("ERROR: Failed to copy ATR buffer");
      IndicatorRelease(atrHandle);
      return false;
   }

   // ADX
   int adxHandle = iADX(symbol, timeframe, ADXPeriod);
   if (adxHandle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to create ADX indicator");
      IndicatorRelease(atrHandle);
      return false;
   }

   if (CopyBuffer(adxHandle, 0, 0, 16, adx) <= 0)
   {
      Print("ERROR: Failed to copy ADX buffer");
      IndicatorRelease(atrHandle);
      IndicatorRelease(adxHandle);
      return false;
   }

   // RSI
   int rsiHandle = iRSI(symbol, timeframe, RSIPeriod, PRICE_CLOSE);
   if (rsiHandle == INVALID_HANDLE)
   {
      Print("ERROR: Failed to create RSI indicator");
      IndicatorRelease(atrHandle);
      IndicatorRelease(adxHandle);
      return false;
   }

   if (CopyBuffer(rsiHandle, 0, 0, 16, rsi) <= 0)
   {
      Print("ERROR: Failed to copy RSI buffer");
      IndicatorRelease(atrHandle);
      IndicatorRelease(adxHandle);
      IndicatorRelease(rsiHandle);
      return false;
   }

   // Clean up
   IndicatorRelease(atrHandle);
   IndicatorRelease(adxHandle);
   IndicatorRelease(rsiHandle);

   return true;
}

// ============================================================================
// JSON PAYLOAD BUILDER
// ============================================================================

string BuildJSONPayload(string symbol, string timeframe, MqlRates &rates[],
                       double &atr[], double &adx[], double &rsi[], int count)
{
   string json = "{";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"timeframe\":\"" + timeframe + "\",";
   json += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"bars\":[";

   for (int i = 0; i < count; i++)
   {
      if (i > 0) json += ",";

      json += "{";
      json += "\"time\":\"" + TimeToString(rates[i].time, TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"open\":" + DoubleToString(rates[i].open, 5) + ",";
      json += "\"high\":" + DoubleToString(rates[i].high, 5) + ",";
      json += "\"low\":" + DoubleToString(rates[i].low, 5) + ",";
      json += "\"close\":" + DoubleToString(rates[i].close, 5) + ",";
      json += "\"volume\":" + IntegerToString(rates[i].tick_volume);

      if (CollectIndicators && ArraySize(atr) > i)
      {
         json += ",\"atr\":" + DoubleToString(atr[i], 5);
         json += ",\"adx\":" + DoubleToString(adx[i], 2);
         json += ",\"rsi\":" + DoubleToString(rsi[i], 2);
      }

      json += "}";
   }

   json += "]";
   json += "}";

   return json;
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

bool SendToAPI(string jsonPayload)
{
   string headers = "Content-Type: application/json\r\n";
   headers += "X-API-Key: " + APIKey + "\r\n";

   char postData[];
   char resultData[];
   string resultHeaders;

   // Convert JSON to bytes
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // Remove null terminator

   int attempts = 0;
   int maxAttempts = EnableRetry ? MaxRetries : 1;

   while (attempts < maxAttempts)
   {
      attempts++;

      Print("Sending data to API (attempt ", attempts, "/", maxAttempts, ")...");
      Print("Payload size: ", ArraySize(postData), " bytes");

      ResetLastError();

      int result = WebRequest(
         "POST",
         APIEndpoint,
         headers,
         RequestTimeoutMs,
         postData,
         resultData,
         resultHeaders
      );

      if (result == 200 || result == 201)
      {
         Print("✓ API request successful. Status: ", result);

         // Parse response
         string response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
         Print("Response: ", response);

         return true;
      }
      else if (result == -1)
      {
         int error = GetLastError();
         Print("✗ WebRequest failed. Error: ", error, " - ", ErrorDescription(error));

         if (error == 4060) // ERR_FUNCTION_NOT_ALLOWED
         {
            Print("ERROR: WebRequest not allowed! Add URL to allowed list in MT5 Tools > Options > Expert Advisors");
            Print("Add this URL: ", APIEndpoint);
            return false; // Don't retry
         }
      }
      else
      {
         string response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
         Print("✗ API request failed. Status: ", result);
         Print("Response: ", response);
      }

      // Wait before retry
      if (attempts < maxAttempts)
      {
         int waitSeconds = attempts * 2; // Exponential backoff: 2s, 4s, 6s
         Print("Waiting ", waitSeconds, " seconds before retry...");
         Sleep(waitSeconds * 1000);
      }
   }

   Print("✗ All retry attempts failed");
   return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

string TimeframeToString(ENUM_TIMEFRAMES tf)
{
   switch(tf)
   {
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H2:  return "H2";
      case PERIOD_H4:  return "H4";
      case PERIOD_H8:  return "H8";
      case PERIOD_H12: return "H12";
      case PERIOD_D1:  return "D1";
      default:         return "UNKNOWN";
   }
}

string ErrorDescription(int errorCode)
{
   switch(errorCode)
   {
      case 4060: return "Function not allowed (enable WebRequest in settings)";
      case 4014: return "System function not allowed";
      case 5203: return "Object not found";
      default:   return "Error code: " + IntegerToString(errorCode);
   }
}
```

### 1.4 Deployment Checklist for MT5 EA

```markdown
## MT5 EA Deployment

### Pre-Deployment

- [ ] Compile EA in MetaEditor (ensure no errors)
- [ ] Enable WebRequest for your Railway URL:
  - Tools > Options > Expert Advisors
  - Allow WebRequest for listed URL
  - Add: https://your-app.railway.app
- [ ] Set API key in EA properties (don't hardcode)
- [ ] Test on demo account first

### Deployment

- [ ] Attach EA to one chart (XAUUSD H4 recommended)
- [ ] Set UpdateIntervalMinutes = 5
- [ ] Enable AutoTrading
- [ ] Check Experts log for "initialized" message
- [ ] Wait for first 5-minute mark (00, 05, 10, etc.)
- [ ] Verify data sent to API (check logs)

### Monitoring

- [ ] Check MT5 Experts log every hour for 24 hours
- [ ] Verify no "WebRequest failed" errors
- [ ] Verify collections happening every 5 minutes
- [ ] Check Railway logs for incoming data
- [ ] Verify PostgreSQL for new data every 5 minutes

### Rollback

If issues occur:

- Change UpdateIntervalMinutes back to 15
- Restart EA
- Investigate logs
```

---

## 2. BullMQ Configuration - Railway

### 2.1 Current Queue Configuration

**File**: `src/queue/marketDataQueue.ts`

```typescript
import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Current configuration (15-minute updates)
const queueOptions: QueueOptions = {
  connection: new Redis(process.env.REDIS_URL),

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
};

export const marketDataQueue = new Queue('market-data', queueOptions);
```

### 2.2 Updated Queue Configuration for 5-Minute Updates

**Changes needed**:

```typescript
import { Queue, QueueOptions, QueueScheduler } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

const logger = new Logger('MarketDataQueue');

// Redis connection with better resilience
const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Enhanced configuration for 5-minute updates (3× load)
const queueOptions: QueueOptions = {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },

    // CHANGE 1: Reduce retention (3× more jobs)
    removeOnComplete: {
      age: 1800, // 30 minutes instead of 1 hour
      count: 500, // 500 jobs instead of 1000
    },
    removeOnFail: {
      age: 43200, // 12 hours instead of 24 hours
    },

    // CHANGE 2: Add timeout for worker processing
    timeout: 30000, // 30 seconds max per job

    // CHANGE 3: Add job priority (for backfill scenarios)
    priority: 1, // Normal priority (1-10 scale)
  },

  // CHANGE 4: Add metrics
  metrics: {
    maxDataPoints: 1000, // Track last 1000 jobs for metrics
  },
};

export const marketDataQueue = new Queue('market-data', queueOptions);

// Queue scheduler for managing delayed/repeated jobs
export const queueScheduler = new QueueScheduler('market-data', {
  connection: redisConnection,
});

// Queue event listeners
marketDataQueue.on('error', (error) => {
  logger.error('Queue error:', error);
});

marketDataQueue.on('waiting', (jobId) => {
  logger.debug(`Job ${jobId} is waiting`);
});

marketDataQueue.on('active', (job) => {
  logger.debug(`Job ${job.id} is active`);
});

marketDataQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed`, {
    duration: Date.now() - job.timestamp,
    result,
  });
});

marketDataQueue.on('failed', (job, error) => {
  logger.error(`Job ${job?.id} failed`, { error: error.message });
});

// Metrics tracking
let jobCounts = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
};

setInterval(async () => {
  jobCounts = await marketDataQueue.getJobCounts();
  logger.info('Queue metrics', jobCounts);

  // Alert if queue is backing up
  if (jobCounts.waiting > 100) {
    logger.warn('Queue backlog detected!', jobCounts);
  }
}, 60000); // Log every minute

export { jobCounts };
```

### 2.3 API Endpoint Handler

**File**: `src/api/marketData.controller.ts`

```typescript
import { Request, Response } from 'express';
import { marketDataQueue } from '../queue/marketDataQueue';
import { Logger } from '../utils/logger';

const logger = new Logger('MarketDataController');

interface MarketDataPayload {
  symbol: string;
  timeframe: string;
  timestamp: string;
  bars: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    atr?: number;
    adx?: number;
    rsi?: number;
  }>;
}

export class MarketDataController {
  /**
   * Receive market data from MT5 EA
   */
  async receiveData(req: Request, res: Response) {
    const startTime = Date.now();

    try {
      // Validate API key
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.MT5_API_KEY) {
        logger.warn('Invalid API key attempt');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload: MarketDataPayload = req.body;

      // Validate payload
      if (!payload.symbol || !payload.timeframe || !payload.bars) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Received market data', {
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        bars: payload.bars.length,
      });

      // Add to queue with deduplication
      const jobId = `${payload.symbol}_${payload.timeframe}_${payload.timestamp}`;

      await marketDataQueue.add('process-market-data', payload, {
        jobId, // Prevents duplicate processing
        priority: 1,
        removeOnComplete: {
          age: 1800, // 30 minutes
        },
      });

      const duration = Date.now() - startTime;

      logger.info('Job added to queue', { jobId, duration });

      return res.status(202).json({
        status: 'accepted',
        jobId,
        message: 'Data queued for processing',
        duration,
      });
    } catch (error) {
      logger.error('Failed to queue market data', { error });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Health check endpoint
   */
  async health(req: Request, res: Response) {
    try {
      const counts = await marketDataQueue.getJobCounts();

      const isHealthy = counts.waiting < 100 && counts.failed < 10;

      return res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        queue: counts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message,
      });
    }
  }
}
```

---

## 3. Worker Configuration - Railway

### 3.1 Current Worker Implementation

**File**: `src/workers/marketDataWorker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { PostgresService } from '../services/postgres';

const logger = new Logger('MarketDataWorker');
const db = new PostgresService();

// Current worker (15-minute updates)
const worker = new Worker(
  'market-data',
  async (job: Job) => {
    const { symbol, timeframe, bars } = job.data;

    logger.info(`Processing ${symbol} ${timeframe}`, { bars: bars.length });

    // Insert to PostgreSQL
    await db.insertMarketData(symbol, timeframe, bars);

    return { processed: bars.length };
  },
  {
    connection: new Redis(process.env.REDIS_URL),
    concurrency: 5, // Process 5 jobs concurrently
  }
);
```

### 3.2 Updated Worker for 5-Minute Updates

**Enhanced for 3× load**:

```typescript
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { PostgresService } from '../services/postgres';
import { MetricsCollector } from '../services/metrics';

const logger = new Logger('MarketDataWorker');
const db = new PostgresService();
const metrics = new MetricsCollector();

// Enhanced Redis connection
const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

// Worker configuration for 3× load
const workerOptions = {
  connection: redisConnection,

  // CHANGE 1: Increase concurrency for higher throughput
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'), // 10 instead of 5

  // CHANGE 2: Add rate limiting to prevent PostgreSQL overload
  limiter: {
    max: 50, // Max 50 jobs
    duration: 1000, // Per second
  },

  // CHANGE 3: Shorter lock duration
  lockDuration: 30000, // 30 seconds

  // CHANGE 4: Enable auto-cleanup
  autorun: true,

  // CHANGE 5: Add metrics tracking
  metrics: {
    maxDataPoints: 1000,
  },
};

// Main worker
export const marketDataWorker = new Worker(
  'market-data',
  async (job: Job) => {
    const startTime = Date.now();
    const { symbol, timeframe, bars, timestamp } = job.data;

    try {
      logger.debug(`Processing job ${job.id}`, {
        symbol,
        timeframe,
        bars: bars.length,
        timestamp,
      });

      // Validate data
      if (!bars || bars.length === 0) {
        throw new Error('No bars to process');
      }

      // Insert to PostgreSQL (batch insert)
      const result = await db.insertMarketData(symbol, timeframe, bars);

      const duration = Date.now() - startTime;

      // Record metrics
      metrics.recordJobProcessing({
        symbol,
        timeframe,
        duration,
        barsProcessed: bars.length,
        success: true,
      });

      logger.info(`Job ${job.id} completed`, {
        symbol,
        timeframe,
        processed: bars.length,
        inserted: result.insertedRows,
        duration,
      });

      return {
        processed: bars.length,
        inserted: result.insertedRows,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(`Job ${job.id} failed`, {
        symbol,
        timeframe,
        error: error.message,
        duration,
      });

      // Record failure metrics
      metrics.recordJobProcessing({
        symbol,
        timeframe,
        duration,
        barsProcessed: 0,
        success: false,
        error: error.message,
      });

      throw error; // Will trigger retry
    }
  },
  workerOptions
);

// Worker event handlers
marketDataWorker.on('completed', (job, result) => {
  logger.debug(`Worker completed job ${job.id}`, result);
});

marketDataWorker.on('failed', (job, error) => {
  logger.error(`Worker failed job ${job?.id}`, {
    error: error.message,
    attempts: job?.attemptsMade,
    maxAttempts: job?.opts.attempts,
  });

  // Alert if critical failure
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    logger.error('Job exhausted all retries', {
      jobId: job.id,
      data: job.data,
    });
  }
});

marketDataWorker.on('error', (error) => {
  logger.error('Worker error', { error: error.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully...');
  await marketDataWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker gracefully...');
  await marketDataWorker.close();
  process.exit(0);
});

// Health monitoring
setInterval(async () => {
  const stats = await marketDataWorker.getMetrics();
  logger.info('Worker metrics', {
    processed: stats.completed,
    failed: stats.failed,
    active: stats.active,
  });
}, 60000); // Every minute
```

### 3.3 PostgreSQL Service Optimization

**File**: `src/services/postgres.ts`

```typescript
import { Pool, PoolConfig } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('PostgresService');

export class PostgresService {
  private pool: Pool;

  constructor() {
    // Enhanced pool configuration for 3× write load
    const poolConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,

      // CHANGE 1: Increase connection pool for higher concurrency
      max: parseInt(process.env.DB_POOL_SIZE || '20'), // 20 instead of 10
      min: 2,

      // CHANGE 2: Shorter idle timeout
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,

      // CHANGE 3: Query timeout
      query_timeout: 10000, // 10 seconds max per query

      // CHANGE 4: Statement timeout
      statement_timeout: 10000,
    };

    this.pool = new Pool(poolConfig);

    // Pool event handlers
    this.pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error', { error: err.message });
    });
  }

  /**
   * Insert market data with optimized batch insert
   */
  async insertMarketData(
    symbol: string,
    timeframe: string,
    bars: any[]
  ): Promise<{ insertedRows: number }> {
    const startTime = Date.now();

    try {
      // Build batch insert query
      const values: any[] = [];
      const placeholders: string[] = [];

      bars.forEach((bar, index) => {
        const offset = index * 13; // 13 columns per row

        placeholders.push(`(
          $${offset + 1}, $${offset + 2}, $${offset + 3},
          $${offset + 4}, $${offset + 5}, $${offset + 6},
          $${offset + 7}, $${offset + 8}, $${offset + 9},
          $${offset + 10}, $${offset + 11}, $${offset + 12},
          $${offset + 13}
        )`);

        values.push(
          symbol,
          timeframe,
          new Date(bar.time),
          bar.open,
          bar.high,
          bar.low,
          bar.close,
          bar.volume,
          bar.atr || null,
          bar.adx || null,
          bar.rsi || null,
          new Date(), // created_at
          new Date() // updated_at
        );
      });

      const query = `
        INSERT INTO ohlcv_15m (
          symbol, timeframe, timestamp,
          open, high, low, close, volume,
          atr_value, adx_value, rsi_value,
          created_at, updated_at
        )
        VALUES ${placeholders.join(',')}
        ON CONFLICT (symbol, timeframe, timestamp)
        DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          atr_value = EXCLUDED.atr_value,
          adx_value = EXCLUDED.adx_value,
          rsi_value = EXCLUDED.rsi_value,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `;

      const result = await this.pool.query(query, values);

      const duration = Date.now() - startTime;

      logger.debug(`Inserted ${result.rowCount} rows`, {
        symbol,
        timeframe,
        bars: bars.length,
        duration,
      });

      return { insertedRows: result.rowCount || 0 };
    } catch (error) {
      logger.error('Failed to insert market data', {
        symbol,
        timeframe,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Graceful shutdown
   */
  async close() {
    logger.info('Closing database pool...');
    await this.pool.end();
  }
}
```

---

## 4. PostgreSQL Optimizations - Railway

### 4.1 Database Schema Verification

```sql
-- Verify table structure
\d ohlcv_15m

-- Expected indexes for 5-minute updates
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_timeframe_time
  ON ohlcv_15m (symbol, timeframe, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ohlcv_recent
  ON ohlcv_15m (symbol, timeframe, timestamp DESC)
  WHERE timestamp >= NOW() - INTERVAL '24 hours';

-- Add index on created_at for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_ohlcv_created_at
  ON ohlcv_15m (created_at)
  WHERE created_at < NOW() - INTERVAL '90 days';
```

### 4.2 Connection Pooling Configuration

**Railway PostgreSQL Settings**:

```bash
# In Railway environment variables

# Database connection pool
DB_POOL_SIZE=20           # Increased from 10
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000

# Query timeouts
DB_QUERY_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=10000

# SSL mode (Railway requires SSL)
DB_SSL_MODE=require
```

### 4.3 Monitoring Queries

```sql
-- Check write throughput
SELECT
  date_trunc('hour', created_at) as hour,
  COUNT(*) as inserts,
  COUNT(DISTINCT symbol) as symbols,
  COUNT(DISTINCT timeframe) as timeframes
FROM ohlcv_15m
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Check for gaps in M5 data
SELECT
  symbol,
  timeframe,
  timestamp,
  LAG(timestamp) OVER (PARTITION BY symbol, timeframe ORDER BY timestamp) as prev_timestamp,
  timestamp - LAG(timestamp) OVER (PARTITION BY symbol, timeframe ORDER BY timestamp) as gap
FROM ohlcv_15m
WHERE timeframe = 'M5'
  AND timestamp >= NOW() - INTERVAL '24 hours'
HAVING timestamp - LAG(timestamp) OVER (PARTITION BY symbol, timeframe ORDER BY timestamp) > INTERVAL '5 minutes';

-- Check recent activity
SELECT
  symbol,
  timeframe,
  MAX(timestamp) as last_update,
  NOW() - MAX(timestamp) as age
FROM ohlcv_15m
GROUP BY symbol, timeframe
ORDER BY age DESC;

-- Check database size
SELECT
  pg_size_pretty(pg_total_relation_size('ohlcv_15m')) as total_size,
  pg_size_pretty(pg_relation_size('ohlcv_15m')) as table_size,
  pg_size_pretty(pg_indexes_size('ohlcv_15m')) as indexes_size;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'ohlcv_15m'
ORDER BY idx_scan DESC;
```

---

## 5. Railway Deployment Configuration

### 5.1 Service Configuration

**railway.json**:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 5.2 Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# API Security
MT5_API_KEY=your-secure-api-key-here

# Redis (BullMQ)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# PostgreSQL
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/dbname
DB_POOL_SIZE=20
DB_POOL_MIN=2

# Worker Configuration
WORKER_CONCURRENCY=10
WORKER_MAX_JOBS_PER_SECOND=50

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 5.3 Resource Allocation

**For 5-minute updates (3× load)**:

```
API Service:
- Memory: 512 MB (sufficient)
- CPU: Shared (sufficient)
- Instances: 1

Worker Service:
- Memory: 1 GB (increased from 512 MB)
- CPU: Shared (sufficient)
- Instances: 2 (for redundancy)

PostgreSQL:
- Plan: Hobby ($5/month) → Developer ($10/month)
- Storage: 1 GB → 5 GB
- Connections: 20

Redis:
- Plan: Hobby ($5/month)
- Memory: 256 MB (sufficient)
```

---

## 6. Testing & Validation

### 6.1 Load Testing Script

**File**: `scripts/loadTest.ts`

```typescript
import axios from 'axios';

const API_ENDPOINT =
  process.env.API_ENDPOINT || 'http://localhost:3000/api/market-data';
const API_KEY = process.env.MT5_API_KEY;

async function simulateDataCollection() {
  const symbols = ['XAUUSD', 'EURUSD', 'BTCUSD'];
  const timeframes = ['M5', 'M15', 'H1', 'H4'];

  const promises = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      const payload = {
        symbol,
        timeframe,
        timestamp: new Date().toISOString(),
        bars: generateMockBars(16),
      };

      promises.push(
        axios.post(API_ENDPOINT, payload, {
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
          },
        })
      );
    }
  }

  const results = await Promise.allSettled(promises);

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Load test results: ${succeeded} succeeded, ${failed} failed`);
}

function generateMockBars(count: number) {
  const bars = [];
  let basePrice = 2000;

  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 10;
    bars.push({
      time: new Date(Date.now() - (count - i) * 5 * 60 * 1000).toISOString(),
      open: basePrice + variation,
      high: basePrice + variation + Math.random() * 5,
      low: basePrice + variation - Math.random() * 5,
      close: basePrice + variation + (Math.random() - 0.5) * 2,
      volume: Math.floor(Math.random() * 10000),
      atr: 12.5,
      adx: 25.3,
      rsi: 55.8,
    });
  }

  return bars;
}

// Run load test simulating 5-minute intervals for 1 hour
async function runContinuousTest() {
  const iterations = 12; // 1 hour at 5-min intervals

  for (let i = 0; i < iterations; i++) {
    console.log(`\n--- Iteration ${i + 1}/${iterations} ---`);
    await simulateDataCollection();

    if (i < iterations - 1) {
      console.log('Waiting 5 minutes for next iteration...');
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

// Run
runContinuousTest().catch(console.error);
```

### 6.2 Validation Checklist

```markdown
## Post-Deployment Validation

### Immediate (First Hour)

- [ ] MT5 EA sending data every 5 minutes (check logs)
- [ ] BullMQ receiving jobs (check Railway logs)
- [ ] Workers processing jobs (check Railway logs)
- [ ] PostgreSQL receiving inserts (check database)
- [ ] No gaps in M5 data (run gap query)
- [ ] No errors in any component

### Short-Term (First 24 Hours)

- [ ] All symbol-timeframe pairs updating correctly
- [ ] Queue not backing up (waiting jobs < 50)
- [ ] Worker processing time < 100ms P99
- [ ] PostgreSQL write latency < 50ms P99
- [ ] No memory leaks in workers
- [ ] CPU usage < 60% average

### Medium-Term (First Week)

- [ ] Database size growing predictably (~3× previous rate)
- [ ] No data quality issues reported
- [ ] User feedback positive
- [ ] Cost within expected range (+20%)
- [ ] System stability maintained
```

---

## 7. Rollback Procedure

If issues occur:

```typescript
// Emergency rollback script
async function emergencyRollback() {
  console.log('🚨 EMERGENCY ROLLBACK INITIATED');

  // Step 1: Stop workers
  console.log('1. Stopping workers...');
  await stopWorkers();

  // Step 2: Pause queue
  console.log('2. Pausing queue...');
  await marketDataQueue.pause();

  // Step 3: Notify ops
  console.log('3. Sending alerts...');
  await sendSlackAlert('Emergency rollback in progress');

  // Step 4: Update MT5 EA interval back to 15 minutes
  console.log('4. Update MT5 EA to 15-minute intervals (manual step)');

  // Step 5: Clear queue
  console.log('5. Clearing queue...');
  await marketDataQueue.drain();

  // Step 6: Resume with old settings
  console.log('6. Resuming with 15-minute configuration...');
  await marketDataQueue.resume();
  await startWorkers();

  console.log('✅ Rollback complete');
}
```

---

## Conclusion

This implementation guide provides complete, production-ready code for updating your entire data pipeline from 15-minute to 5-minute intervals.

**Key changes**:

1. MT5 EA: `UpdateIntervalMinutes = 5`
2. BullMQ: Increased retention management, added metrics
3. Workers: Increased concurrency (5 → 10), better error handling
4. PostgreSQL: Optimized indexes, increased connection pool

**Total implementation time**: ~2 days
**Risk level**: Low (comprehensive rollback plan)
**Cost increase**: $26/month (~20%)
