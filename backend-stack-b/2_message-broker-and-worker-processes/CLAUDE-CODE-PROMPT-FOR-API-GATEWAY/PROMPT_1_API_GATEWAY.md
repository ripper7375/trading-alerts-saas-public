# Prompt 1: NestJS API Gateway Implementation

## Context

I have uploaded two architecture documents:

1. `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md` - Complete API Gateway architecture with validation layers
2. `API_GATEWAY_OBSERVABILITY_GUIDE.md` - Observability implementation guide

I need you to build a **production-ready NestJS API Gateway** for a Trading Alerts SaaS platform that:

- Receives market data from 15 MT5 terminals (HTTP POST)
- Validates data through 8 layers before queuing
- Connects to Railway Redis (Bull Queue)
- Implements structured logging (Level 1 observability)
- Includes Prometheus metrics endpoints
- Handles 12,000 bars/day with 0.5% error rate target

## Requirements

### 1. Project Structure

Create a complete NestJS project with:

```
api-gateway/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── api-gateway/
│   │   ├── api-gateway.module.ts
│   │   ├── market-data.controller.ts
│   │   ├── validation.service.ts
│   │   ├── transformation.service.ts
│   │   ├── dto/
│   │   │   └── market-data.dto.ts
│   │   └── guards/
│   │       └── api-key.guard.ts
│   ├── monitoring/
│   │   ├── monitoring.module.ts
│   │   ├── metrics.service.ts
│   │   └── metrics.controller.ts
│   └── config/
│       ├── redis.config.ts
│       └── validation.ts
├── test/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### 2. Market Data DTO (57 Columns)

Based on the architecture document, create a complete DTO with:

- Basic OHLCV fields (timestamp, open, high, low, close, volume, symbol, timeframe)
- Moving averages (tema, hrma, smma, ema_26)
- Z-Score and classification
- Fractal diagonal indicators (6 fields)
- Fractal horizontal indicators (6 fields)
- Heikin Ashi (7 fields)
- Keltner Channel (10 fields)
- Support/Resistance (8 fields)
- ZigZag indicators (2 fields)

Use `class-validator` decorators for DTO validation.

### 3. ValidationService (8 Layers)

Implement **all 8 validation layers** from the architecture document:

**Layer 1: Symbol Validation**

- Whitelist: 15 supported symbols (btcusd, ethusd, xauusd, eurusd, gbpusd, usdjpy, usdchf, audusd, nzdusd, usdcad, eurjpy, gbpjpy, eurgbp, audjpy, euraud)

**Layer 2: OHLC Relationship Validation**

- high >= low
- high >= open, close
- low <= open, close
- All prices > 0

**Layer 3: Timestamp Validation**

- Not in future (tolerance: 5 minutes for clock skew)
- Not too old (max: 7 days)
- Reasonable format (after year 2000)

**Layer 4: Sentinel Value Detection**

- Detect error values: null, -999999, -9999, 999999, Infinity, NaN
- Check all 49 indicator fields

**Layer 5: Indicator Range Validation**

- Moving averages within ±50% of price
- Z-score between -10 and +10
- Keltner channels properly ordered
- Support/resistance levels follow rules

**Layer 6: Candle Proportion Validation**

- Range cannot be zero
- Detect flash crashes (body > 100x range)
- Spread validation (0.0001% - 20%)

**Layer 7: Volume Sanity Checks**

- Volume >= 0
- Volume < 100,000,000 (max threshold)

**Layer 8: Duplicate Detection**

- Check if job already in Bull Queue
- Use jobId: `{symbol}_{timeframe}_{timestamp}`

### 4. API Key Authentication

Implement API key authentication:

- Format: `mt5_terminal_{terminal_id}_{random}`
- Stored in environment variables
- Validated via guard
- Support for 15+ terminal keys

### 5. Bull Queue Integration

Configure Bull Queue with Railway Redis:

```typescript
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          tls: process.env.NODE_ENV === 'production' ? {} : undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'market-data-sync',
    }),
  ],
})
```

### 6. Controller Implementation

Create endpoint: `POST /api/v1/market-data`

Request headers:

- `Authorization: Bearer {API_KEY}`
- `X-Terminal-ID: terminal_001`
- `X-EA-Version: v2.24`

Response codes:

- 200: Success (data queued)
- 400: Validation error (with specific error message)
- 401/403: Authentication error
- 429: Rate limited

### 7. Structured Logging (Level 1)

Implement structured logging with context:

```typescript
{
  level: "error",
  timestamp: "2026-01-29T10:30:15.123Z",
  context: "ValidationService",
  message: "Validation failed",
  symbol: "btcusd",
  timeframe: "PERIOD_M5",
  terminalId: "terminal_001",
  errorType: "BadRequestException",
  errorMessage: "Invalid OHLC: high < low",
  validationLayer: "OHLC_RELATIONSHIPS"
}
```

### 8. Prometheus Metrics

Expose `/metrics` endpoint with:

- `api_requests_total` (counter)
- `api_validation_errors_total` (counter with labels)
- `api_request_duration_seconds` (histogram)
- `queue_jobs_waiting` (gauge)

### 9. Environment Configuration

Create `.env.example`:

```bash
# Server
PORT=3000
NODE_ENV=production

# Redis (Railway)
REDIS_HOST=your-redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# API Keys (one per terminal)
API_KEY_TERMINAL_001=mt5_terminal_001_xxx
API_KEY_TERMINAL_002=mt5_terminal_002_xxx
# ... up to 015

# Validation
VALIDATION_TIMEOUT_MS=5000
MAX_RATE_PER_MINUTE=200
```

### 10. Railway Deployment

Include:

- `railway.json` or `railway.toml` configuration
- Health check endpoint: `GET /health`
- Dockerfile (optional) or use Nixpacks
- Start script in package.json

## Deliverables

Please provide:

1. ✅ Complete NestJS project structure
2. ✅ All TypeScript files with full implementation
3. ✅ package.json with dependencies
4. ✅ .env.example with all variables
5. ✅ README.md with:
   - Setup instructions
   - Environment variable descriptions
   - API documentation
   - Testing commands
   - Railway deployment steps
6. ✅ Basic tests for validation service
7. ✅ Railway configuration file

## Success Criteria

The API Gateway should:

- ✅ Compile without TypeScript errors
- ✅ Validate all 8 layers correctly
- ✅ Return specific error messages for validation failures
- ✅ Successfully queue valid data to Bull
- ✅ Expose Prometheus metrics
- ✅ Log structured JSON for errors
- ✅ Handle 200+ requests/minute per terminal
- ✅ Deploy to Railway without issues

## Notes

- Reference the architecture document for complete validation logic
- Use the observability guide for logging patterns
- Focus on production readiness (error handling, logging, monitoring)
- Keep code clean and well-documented
- Follow NestJS best practices

Please implement this API Gateway with production-quality code.
