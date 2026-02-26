# API Gateway Observability Guide

## Validation Monitoring & Error Analysis for Trading Alerts SaaS

---

## Executive Summary

This document provides a comprehensive guide to implementing observability for the API Gateway validation layer in the Trading Alerts SaaS platform. The API Gateway's rigorous 8-layer validation produces rich, actionable error data that requires proper monitoring to:

1. **Detect EA bugs immediately** (within minutes vs days)
2. **Identify problematic terminals** (which of 15 terminals has issues)
3. **Track error trends** (is data quality improving?)
4. **Provide feedback to EA developers** (what to fix)
5. **Measure validation effectiveness** (5% → 0.5% error reduction)

**Key Insight:** The API Gateway validation isn't just a filter—it's a **quality feedback system** that tells you exactly what's wrong with your data collection layer.

---

## Table of Contents

1. [Why Observability for Validation?](#1-why-observability-for-validation)
2. [Observability Levels](#2-observability-levels)
3. [Level 1: Basic Logging](#3-level-1-basic-logging)
4. [Level 2: Metrics Dashboard](#4-level-2-metrics-dashboard)
5. [Level 3: Full Observability Stack](#5-level-3-full-observability-stack)
6. [Error Analysis Patterns](#6-error-analysis-patterns)
7. [Alert Configuration](#7-alert-configuration)
8. [Feedback Loop to EA](#8-feedback-loop-to-ea)
9. [Dashboard Examples](#9-dashboard-examples)
10. [Troubleshooting Workflows](#10-troubleshooting-workflows)
11. [ROI & Cost Analysis](#11-roi--cost-analysis)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Why Observability for Validation?

### The Problem Without Observability

```
MT5 EA has bug → Invalid data sent → API Gateway rejects → ???

Questions you CAN'T answer:
- How many errors per day?
- Which terminals have issues?
- What types of errors are most common?
- Is the error rate increasing?
- Which indicators are failing?
- When did the problem start?
```

### The Solution With Observability

```
MT5 EA has bug → Invalid data sent → API Gateway rejects → Logged & Tracked

Questions you CAN answer:
- Error rate: 0.5% (60 errors/12,000 bars)
- Problematic terminal: terminal_001 (75% of errors)
- Top error: "Invalid OHLC: high < low" (35 occurrences)
- Trend: Error spike started at 10:05 AM today
- Root cause: TEMA indicator on PERIOD_M5
- Action: Fix TEMA calculation, redeploy EA
```

### What Makes API Gateway Validation Special

**Traditional logging (worker failures):**

```json
{
  "level": "error",
  "message": "Job failed",
  "jobId": "12345",
  "error": "DatabaseError: constraint violation"
}
```

❌ Not actionable - what caused the constraint violation?

**API Gateway validation logging:**

```json
{
  "level": "error",
  "message": "Validation failed",
  "symbol": "btcusd",
  "timeframe": "PERIOD_M5",
  "terminalId": "terminal_001",
  "errorType": "BadRequestException",
  "errorMessage": "Invalid OHLC: high (43240.5) cannot be less than low (43250.0)",
  "validationLayer": "OHLC_RELATIONSHIPS",
  "timestamp": "2026-01-29T10:30:15.123Z"
}
```

✅ Highly actionable - exactly what's wrong and where

---

## 2. Observability Levels

### Overview

| Level                          | Cost      | Setup Time | Value     | When to Use                 |
| ------------------------------ | --------- | ---------- | --------- | --------------------------- |
| **Level 1: Basic Logging**     | $0        | 5 minutes  | High      | Start here (everyone)       |
| **Level 2: Metrics Dashboard** | $0        | 2 hours    | Very High | After 1 month (recommended) |
| **Level 3: Full Stack**        | $15-50/mo | 1 day      | Maximum   | 50+ terminals or 24/7 ops   |

### Level Comparison

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Basic Logging                                       │
├─────────────────────────────────────────────────────────────┤
│ ✅ See individual errors                                     │
│ ✅ Search logs by pattern                                    │
│ ⚠️  Manual counting                                          │
│ ⚠️  No trending                                              │
│ ❌ No alerts                                                 │
│                                                              │
│ Use case: MVP, initial debugging                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Level 2: Metrics Dashboard                                   │
├─────────────────────────────────────────────────────────────┤
│ ✅ See individual errors                                     │
│ ✅ Automatic counting                                        │
│ ✅ Visual trending                                           │
│ ✅ Error rate graphs                                         │
│ ✅ Basic alerts (manual setup)                               │
│ ✅ Historical comparison                                     │
│                                                              │
│ Use case: Production, ongoing monitoring                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Level 3: Full Observability Stack                            │
├─────────────────────────────────────────────────────────────┤
│ ✅ Everything from Level 2                                   │
│ ✅ Automatic anomaly detection                               │
│ ✅ Intelligent alerting (Slack, PagerDuty)                   │
│ ✅ Error grouping & trending                                 │
│ ✅ Distributed tracing                                       │
│ ✅ Team collaboration features                               │
│                                                              │
│ Use case: Enterprise, large teams, 24/7 operations          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Level 1: Basic Logging

### Implementation

#### Step 1: Add Structured Logging to ValidationService

```typescript
// src/api-gateway/validation.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  async validate(data: MarketDataDto, metadata?: any): Promise<void> {
    const context = {
      symbol: data.symbol,
      timeframe: data.timeframe,
      timestamp: data.timestamp,
      terminalId: metadata?.terminalId || 'unknown',
      eaVersion: metadata?.eaVersion || 'unknown',
    };

    try {
      // Run all validations
      this.validateSymbol(data.symbol);
      this.validateOHLC(data);
      this.validateTimestamp(data.timestamp);
      this.validateIndicatorValues(data);
      this.validateIndicatorRanges(data);
      this.validateCandleProportions(data);
      this.validateVolume(data);
      await this.checkDuplicates(data);

      // ✅ Log successful validation (optional, can be verbose)
      // this.logger.debug('Validation passed', context);
    } catch (error) {
      // ❌ Log validation failure with full context
      this.logger.error('Validation failed', {
        ...context,
        errorType: error.constructor.name,
        errorMessage: error.message,
        validationLayer: this.identifyValidationLayer(error.message),
        stackTrace: error.stack,
      });

      throw error;
    }
  }

  private identifyValidationLayer(errorMessage: string): string {
    if (errorMessage.includes('Invalid OHLC')) return 'OHLC_RELATIONSHIPS';
    if (errorMessage.includes('Timestamp')) return 'TIMESTAMP_VALIDATION';
    if (errorMessage.includes('sentinel')) return 'SENTINEL_DETECTION';
    if (errorMessage.includes('range')) return 'INDICATOR_RANGES';
    if (errorMessage.includes('candle')) return 'CANDLE_PROPORTIONS';
    if (errorMessage.includes('Volume')) return 'VOLUME_SANITY';
    if (errorMessage.includes('duplicate')) return 'DUPLICATE_DETECTION';
    if (errorMessage.includes('symbol')) return 'SYMBOL_VALIDATION';
    return 'UNKNOWN';
  }
}
```

#### Step 2: Add Logging to Controller

```typescript
// src/api-gateway/market-data.controller.ts
import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';

@Controller('api/v1/market-data')
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly validationService: ValidationService
  ) {}

  @Post()
  async publishMarketData(
    @Body() data: MarketDataDto,
    @Headers('x-terminal-id') terminalId?: string,
    @Headers('x-ea-version') eaVersion?: string
  ) {
    const startTime = Date.now();

    try {
      // Validate
      await this.validationService.validate(data, { terminalId, eaVersion });

      // Add to queue
      const job = await this.queue.add('process', data);

      const duration = Date.now() - startTime;

      // ✅ Log success
      this.logger.log('Request successful', {
        symbol: data.symbol,
        timeframe: data.timeframe,
        terminalId,
        jobId: job.id,
        duration,
      });

      return {
        status: 'queued',
        jobId: job.id,
        processingTime: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // ❌ Log failure (validation already logged, this is controller level)
      this.logger.warn('Request rejected', {
        symbol: data.symbol,
        timeframe: data.timeframe,
        terminalId,
        statusCode: error.status || 500,
        duration,
      });

      throw error;
    }
  }
}
```

#### Step 3: Configure NestJS Logger

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log'] // Production: less verbose
        : ['error', 'warn', 'log', 'debug', 'verbose'], // Development: more verbose
  });

  await app.listen(3000);
}

bootstrap();
```

### Using Basic Logging

#### View Logs in Railway

```bash
# Real-time logs
railway logs --service api-gateway --follow

# Search for validation errors
railway logs --service api-gateway --filter "Validation failed"

# Search for specific error type
railway logs --filter "Invalid OHLC"

# Search for specific terminal
railway logs --filter "terminal_001"

# Last 1000 lines
railway logs --service api-gateway --tail 1000
```

#### Download Logs for Analysis

```bash
# Download last 24 hours
railway logs --service api-gateway --since 24h > logs_24h.txt

# Analyze with grep
grep "Validation failed" logs_24h.txt | wc -l  # Count errors
grep "Invalid OHLC" logs_24h.txt | wc -l      # Count OHLC errors
grep "terminal_001" logs_24h.txt | wc -l      # Count terminal_001 errors
```

#### Parse Logs with jq

If logs are JSON formatted:

```bash
# Count errors by type
railway logs --json | jq -r '.errorMessage' | sort | uniq -c | sort -rn

# Count errors by terminal
railway logs --json | jq -r '.terminalId' | sort | uniq -c | sort -rn

# Extract error timeline
railway logs --json | jq -r '[.timestamp, .terminalId, .errorMessage] | @csv'
```

### Example Log Output

```json
{
  "level": "error",
  "timestamp": "2026-01-29T10:30:15.123Z",
  "context": "ValidationService",
  "message": "Validation failed",
  "symbol": "btcusd",
  "timeframe": "PERIOD_M5",
  "timestamp": 1706524815,
  "terminalId": "terminal_001",
  "eaVersion": "v2.24",
  "errorType": "BadRequestException",
  "errorMessage": "Invalid OHLC: high (43240.5) cannot be less than low (43250.0)",
  "validationLayer": "OHLC_RELATIONSHIPS"
}
```

### Daily Analysis Checklist

**Every morning (5 minutes):**

1. Check error count:

   ```bash
   railway logs --since 24h --filter "Validation failed" | wc -l
   ```

2. Check top error types:

   ```bash
   railway logs --since 24h --filter "Validation failed" | \
     grep -o '"errorMessage":"[^"]*"' | sort | uniq -c | sort -rn | head -5
   ```

3. Check problematic terminals:

   ```bash
   railway logs --since 24h --filter "Validation failed" | \
     grep -o '"terminalId":"[^"]*"' | sort | uniq -c | sort -rn | head -5
   ```

4. If error spike detected → investigate specific errors

---

## 4. Level 2: Metrics Dashboard

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ API Gateway (NestJS)                                         │
│ └─ Exposes /metrics endpoint (Prometheus format)            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Prometheus (Railway)                                         │
│ └─ Scrapes /metrics every 15 seconds                        │
│ └─ Stores time-series data                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Grafana (Railway)                                            │
│ └─ Queries Prometheus                                       │
│ └─ Visualizes metrics in dashboards                         │
│ └─ Sends alerts                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

#### Step 1: Install Prometheus Client

```bash
npm install prom-client
```

#### Step 2: Create Metrics Service

```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  // Request counter
  public readonly requestsTotal = new Counter({
    name: 'api_requests_total',
    help: 'Total API requests',
    labelNames: ['method', 'endpoint', 'status'],
  });

  // Validation error counter
  public readonly validationErrorsTotal = new Counter({
    name: 'api_validation_errors_total',
    help: 'Total validation errors',
    labelNames: ['error_type', 'validation_layer', 'symbol', 'terminal_id'],
  });

  // Request duration histogram
  public readonly requestDuration = new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request duration in seconds',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  // Queue size gauge
  public readonly queueSize = new Gauge({
    name: 'queue_jobs_waiting',
    help: 'Number of jobs waiting in queue',
    labelNames: ['queue_name'],
  });

  // Error rate gauge (rolling 1-minute window)
  public readonly errorRate = new Gauge({
    name: 'api_validation_error_rate',
    help: 'Validation error rate (errors per minute)',
    labelNames: ['terminal_id'],
  });

  // Success rate gauge
  public readonly successRate = new Gauge({
    name: 'api_validation_success_rate',
    help: 'Validation success rate (percentage)',
    labelNames: ['terminal_id'],
  });

  getMetrics(): string {
    return register.metrics();
  }
}
```

#### Step 3: Add Metrics to Validation Service

```typescript
// src/api-gateway/validation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly metricsService: MetricsService) {}

  async validate(data: MarketDataDto, metadata?: any): Promise<void> {
    const context = {
      symbol: data.symbol,
      timeframe: data.timeframe,
      terminalId: metadata?.terminalId || 'unknown',
      eaVersion: metadata?.eaVersion || 'unknown',
    };

    try {
      // Run validations...
      this.validateSymbol(data.symbol);
      this.validateOHLC(data);
      // ... other validations
    } catch (error) {
      // Increment error counter with labels
      this.metricsService.validationErrorsTotal.inc({
        error_type: this.normalizeErrorType(error.message),
        validation_layer: this.identifyValidationLayer(error.message),
        symbol: data.symbol,
        terminal_id: context.terminalId,
      });

      // Log error
      this.logger.error('Validation failed', {
        ...context,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  private normalizeErrorType(errorMessage: string): string {
    if (errorMessage.includes('Invalid OHLC')) return 'invalid_ohlc';
    if (errorMessage.includes('Timestamp')) return 'timestamp_error';
    if (errorMessage.includes('sentinel')) return 'sentinel_value';
    if (errorMessage.includes('range')) return 'out_of_range';
    if (errorMessage.includes('candle')) return 'invalid_proportions';
    if (errorMessage.includes('Volume')) return 'volume_error';
    if (errorMessage.includes('duplicate')) return 'duplicate_job';
    if (errorMessage.includes('symbol')) return 'invalid_symbol';
    return 'unknown_error';
  }
}
```

#### Step 4: Add Metrics to Controller

```typescript
// src/api-gateway/market-data.controller.ts
import { Controller, Post, Body, Headers } from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';

@Controller('api/v1/market-data')
export class MarketDataController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly validationService: ValidationService,
    @InjectQueue('market-data-sync') private readonly queue: Queue
  ) {}

  @Post()
  async publishMarketData(
    @Body() data: MarketDataDto,
    @Headers('x-terminal-id') terminalId?: string
  ) {
    const startTime = Date.now();

    try {
      // Validate & queue
      await this.validationService.validate(data, { terminalId });
      const job = await this.queue.add('process', data);

      const duration = (Date.now() - startTime) / 1000;

      // Record metrics
      this.metricsService.requestsTotal.inc({
        method: 'POST',
        endpoint: '/api/v1/market-data',
        status: '200',
      });

      this.metricsService.requestDuration.observe(
        { method: 'POST', endpoint: '/api/v1/market-data', status: '200' },
        duration
      );

      return { status: 'queued', jobId: job.id };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      // Record error metrics
      this.metricsService.requestsTotal.inc({
        method: 'POST',
        endpoint: '/api/v1/market-data',
        status: error.status || '500',
      });

      this.metricsService.requestDuration.observe(
        {
          method: 'POST',
          endpoint: '/api/v1/market-data',
          status: error.status || '500',
        },
        duration
      );

      throw error;
    }
  }
}
```

#### Step 5: Expose Metrics Endpoint

```typescript
// src/monitoring/metrics.controller.ts
import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  getMetrics(): string {
    return this.metricsService.getMetrics();
  }
}
```

#### Step 6: Add Queue Metrics Background Job

```typescript
// src/monitoring/queue-metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Interval } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);

  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly metricsService: MetricsService
  ) {}

  @Interval(5000) // Every 5 seconds
  async updateQueueMetrics() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);

      this.metricsService.queueSize.set(
        { queue_name: 'market-data-sync' },
        waiting
      );
    } catch (error) {
      this.logger.error('Failed to update queue metrics', error);
    }
  }
}
```

### Prometheus Configuration

#### Railway Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway.railway.internal:3000']
    metrics_path: '/metrics'
```

Deploy Prometheus to Railway:

```bash
# Using Railway CLI
railway add prometheus

# Set environment variables
railway env set PROMETHEUS_CONFIG_PATH=/etc/prometheus/prometheus.yml
```

### Grafana Dashboards

#### Dashboard 1: Validation Overview

**JSON configuration:**

```json
{
  "dashboard": {
    "title": "API Gateway - Validation Overview",
    "panels": [
      {
        "title": "Error Rate (last 24h)",
        "targets": [
          {
            "expr": "rate(api_validation_errors_total[5m]) * 60",
            "legendFormat": "Errors/min"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Total Errors by Type",
        "targets": [
          {
            "expr": "sum by (error_type) (api_validation_errors_total)",
            "legendFormat": "{{error_type}}"
          }
        ],
        "type": "piechart"
      },
      {
        "title": "Errors by Terminal",
        "targets": [
          {
            "expr": "sum by (terminal_id) (api_validation_errors_total)",
            "legendFormat": "{{terminal_id}}"
          }
        ],
        "type": "bar"
      },
      {
        "title": "Validation Layers Triggered",
        "targets": [
          {
            "expr": "sum by (validation_layer) (api_validation_errors_total)",
            "legendFormat": "{{validation_layer}}"
          }
        ],
        "type": "piechart"
      }
    ]
  }
}
```

#### Dashboard 2: Performance Metrics

```json
{
  "dashboard": {
    "title": "API Gateway - Performance",
    "panels": [
      {
        "title": "Request Duration (p50, p95, p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, api_request_duration_seconds_bucket)",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, api_request_duration_seconds_bucket)",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, api_request_duration_seconds_bucket)",
            "legendFormat": "p99"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Requests per Second",
        "targets": [
          {
            "expr": "rate(api_requests_total[1m])",
            "legendFormat": "req/sec"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Size",
        "targets": [
          {
            "expr": "queue_jobs_waiting",
            "legendFormat": "Waiting jobs"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

#### Dashboard 3: Terminal Health

```json
{
  "dashboard": {
    "title": "Terminal Health Monitor",
    "panels": [
      {
        "title": "Error Rate by Terminal",
        "targets": [
          {
            "expr": "rate(api_validation_errors_total[5m]) * 60 by (terminal_id)",
            "legendFormat": "{{terminal_id}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Success Rate by Terminal",
        "targets": [
          {
            "expr": "(rate(api_requests_total{status='200'}[5m]) / rate(api_requests_total[5m])) * 100 by (terminal_id)",
            "legendFormat": "{{terminal_id}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Terminal Status Table",
        "targets": [
          {
            "expr": "api_validation_errors_total",
            "format": "table"
          }
        ],
        "type": "table"
      }
    ]
  }
}
```

### Accessing Grafana

```bash
# Railway deployment
railway add grafana

# Access Grafana UI
railway open grafana

# Default credentials
username: admin
password: admin (change on first login)

# Add Prometheus data source
URL: http://prometheus.railway.internal:9090
```

---

## 5. Level 3: Full Observability Stack

### Services Overview

| Service              | Purpose                   | Cost        | Integration                |
| -------------------- | ------------------------- | ----------- | -------------------------- |
| **Sentry**           | Error tracking & grouping | $0-26/mo    | npm install @sentry/node   |
| **Datadog**          | APM & infrastructure      | $15/host/mo | npm install dd-trace       |
| **New Relic**        | Full-stack observability  | $25-99/mo   | npm install newrelic       |
| **LogDNA/LogRocket** | Log aggregation           | $3-50/mo    | npm install @logdna/logger |

### Sentry Implementation (Recommended for Level 3)

#### Step 1: Install Sentry

```bash
npm install @sentry/node @sentry/tracing
```

#### Step 2: Configure Sentry

```typescript
// src/main.ts
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [new ProfilingIntegration()],
    beforeSend(event, hint) {
      // Filter out expected validation errors from alerting
      if (event.exception?.values?.[0]?.type === 'BadRequestException') {
        event.level = 'info'; // Downgrade to info (still tracked, not alerted)
      }
      return event;
    },
  });

  const app = await NestFactory.create(AppModule);

  // Add Sentry error handler
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  app.use(Sentry.Handlers.errorHandler());

  await app.listen(3000);
}

bootstrap();
```

#### Step 3: Add Sentry to Validation Service

```typescript
// src/api-gateway/validation.service.ts
import * as Sentry from '@sentry/node';

@Injectable()
export class ValidationService {
  async validate(data: MarketDataDto, metadata?: any): Promise<void> {
    try {
      // Run validations...
    } catch (error) {
      // Send to Sentry with context
      Sentry.withScope((scope) => {
        scope.setContext('validation', {
          symbol: data.symbol,
          timeframe: data.timeframe,
          terminalId: metadata?.terminalId,
          eaVersion: metadata?.eaVersion,
        });
        scope.setTag('error_type', this.normalizeErrorType(error.message));
        scope.setTag(
          'validation_layer',
          this.identifyValidationLayer(error.message)
        );
        scope.setLevel('info'); // Validation errors are expected, not critical

        Sentry.captureException(error);
      });

      throw error;
    }
  }
}
```

#### Step 4: Configure Sentry Alerts

In Sentry dashboard:

1. **Alert Rule 1: High Error Rate**
   - Condition: Error count > 50 in 5 minutes
   - Action: Send to Slack #alerts channel

2. **Alert Rule 2: New Error Type**
   - Condition: First occurrence of error type
   - Action: Send to Slack #engineering channel

3. **Alert Rule 3: Terminal Issues**
   - Condition: Errors from single terminal_id > 30 in 5 minutes
   - Action: Send to Slack with terminal_id

### Datadog Implementation

```bash
npm install dd-trace
```

```typescript
// src/main.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'api-gateway',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  logInjection: true,
  analytics: true,
});

// Rest of application...
```

---

## 6. Error Analysis Patterns

### Common Error Patterns

#### Pattern 1: OHLC Inversion Spike

**Symptoms:**

```
10:05 AM: 5 errors "Invalid OHLC: high < low"
10:10 AM: 12 errors "Invalid OHLC: high < low"
10:15 AM: 25 errors "Invalid OHLC: high < low"
All from terminal_001, only PERIOD_M5
```

**Root Cause:**

- Indicator calculation error on M5 timeframe
- Recent EA update introduced bug
- TEMA calculation flipping high/low

**Action:**

1. Check terminal_001 logs for indicator errors
2. Review recent EA code changes
3. Fix TEMA calculation
4. Redeploy EA to terminal_001
5. Monitor for error drop

#### Pattern 2: Timestamp Drift

**Symptoms:**

```
All day: Periodic "Timestamp in future" errors
Only from terminal_003
Errors occur every ~2 hours
```

**Root Cause:**

- Clock skew on VPS
- NTP sync failing
- Time zone misconfiguration

**Action:**

1. SSH to Contabo VPS
2. Check system time: `date`
3. Check NTP status: `timedatectl status`
4. Force sync: `sudo ntpdate -s time.nist.gov`
5. Enable NTP: `sudo timedatectl set-ntp true`

#### Pattern 3: Sentinel Value Flood

**Symptoms:**

```
09:00 AM: Market open
09:01 AM: 50 errors "sentinel value detected"
All affecting TEMA, HRMA, SMMA fields
All symbols affected
```

**Root Cause:**

- Insufficient data at market open
- Indicators require 26+ bars to calculate
- EA sending incomplete indicators

**Action:**

1. Update EA: Skip sending bars until indicators ready
2. Or: Mark indicators as optional in DTO
3. Or: Gateway accepts null for first 30 bars after open

#### Pattern 4: Volume Spike False Positive

**Symptoms:**

```
Rare: "Volume exceeds maximum" errors
Only on major news events
All symbols simultaneously
```

**Root Cause:**

- Legitimate high volume (not corruption)
- Maximum threshold too low
- News-driven volatility

**Action:**

1. Review volume threshold (currently 100M)
2. Consider dynamic threshold based on symbol
3. Or: Increase threshold to 500M
4. Or: Disable volume max check (keep min check)

### Error Correlation Analysis

#### Cross-Reference Errors

**Question:** Are OHLC errors correlated with specific symbols?

```promql
# Grafana query
sum by (symbol) (api_validation_errors_total{error_type="invalid_ohlc"})
```

**Result:**

```
btcusd: 35 errors
ethusd: 5 errors
xauusd: 0 errors
→ Issue specific to BTCUSD calculation
```

#### Time-Based Patterns

**Question:** Do errors spike at specific times?

```promql
# Grafana query
rate(api_validation_errors_total[1h]) by (hour)
```

**Result:**

```
Hour 09: 30 errors/min (market open)
Hour 13: 5 errors/min (normal)
Hour 16: 15 errors/min (NY close)
→ Errors spike at market events
```

---

## 7. Alert Configuration

### Alert Levels

| Level        | Condition                | Response Time       | Action           |
| ------------ | ------------------------ | ------------------- | ---------------- |
| **Info**     | Single validation error  | N/A                 | Log only         |
| **Warning**  | 10 errors in 5 minutes   | Check within 1 hour | Investigate      |
| **Error**    | 50 errors in 5 minutes   | Check within 15 min | Active debugging |
| **Critical** | 100+ errors in 5 minutes | Immediate           | Emergency fix    |

### Grafana Alerts

#### Alert 1: High Error Rate

```yaml
name: High Validation Error Rate
condition: rate(api_validation_errors_total[5m]) > 10
for: 5m
severity: warning
annotations:
  summary: 'Validation error rate is high'
  description: '{{ $value }} errors/min for 5 minutes'
notifications:
  - slack: #alerts
```

#### Alert 2: Terminal Down

```yaml
name: Terminal Not Sending Data
condition: rate(api_requests_total[10m]) by (terminal_id) == 0
for: 10m
severity: error
annotations:
  summary: 'Terminal {{ $labels.terminal_id }} appears down'
  description: 'No requests received in 10 minutes'
notifications:
  - slack: #operations
```

#### Alert 3: Queue Backup

```yaml
name: Queue Backlog Detected
condition: queue_jobs_waiting > 500
for: 5m
severity: warning
annotations:
  summary: 'Queue has {{ $value }} jobs waiting'
  description: 'Workers may be overwhelmed or down'
notifications:
  - slack: #engineering
```

#### Alert 4: Validation Layer Failure

```yaml
name: Specific Validation Layer Failing
condition: rate(api_validation_errors_total{validation_layer="OHLC_RELATIONSHIPS"}[5m]) > 5
for: 5m
severity: error
annotations:
  summary: 'OHLC validation failing frequently'
  description: 'Check indicator calculations'
notifications:
  - slack: #engineering
  - pagerduty: engineering-oncall
```

### Slack Integration

```typescript
// src/monitoring/slack.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;

  async sendAlert(
    message: string,
    level: 'info' | 'warning' | 'error' | 'critical'
  ) {
    const colors = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000',
      critical: '#990000',
    };

    const payload = {
      attachments: [
        {
          color: colors[level],
          title: `[${level.toUpperCase()}] API Gateway Alert`,
          text: message,
          footer: 'Trading Alerts SaaS',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      await axios.post(this.webhookUrl, payload);
    } catch (error) {
      this.logger.error('Failed to send Slack alert', error);
    }
  }

  async sendValidationSummary(stats: any) {
    const message = `
*Daily Validation Summary*
Total Requests: ${stats.totalRequests}
Errors: ${stats.totalErrors} (${stats.errorRate}%)
Top Error Type: ${stats.topErrorType}
Problematic Terminal: ${stats.worstTerminal}
    `;

    await this.sendAlert(message, 'info');
  }
}
```

### PagerDuty Integration

```typescript
// src/monitoring/pagerduty.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PagerDutyService {
  private readonly logger = new Logger(PagerDutyService.name);
  private readonly integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;

  async triggerIncident(summary: string, details: any) {
    const payload = {
      routing_key: this.integrationKey,
      event_action: 'trigger',
      payload: {
        summary: summary,
        severity: 'error',
        source: 'api-gateway',
        custom_details: details,
      },
    };

    try {
      await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
    } catch (error) {
      this.logger.error('Failed to trigger PagerDuty incident', error);
    }
  }
}
```

---

## 8. Feedback Loop to EA

### Automatic Feedback Mechanisms

#### Mechanism 1: Error Response Headers

```typescript
// src/api-gateway/market-data.controller.ts
@Post()
async publishMarketData(@Body() data: MarketDataDto, @Res() res: Response) {
  try {
    await this.validationService.validate(data);
    await this.queue.add('process', data);

    return res.status(200).json({ status: 'queued' });

  } catch (error) {
    // Return structured error with guidance
    return res.status(400).json({
      status: 'rejected',
      error: {
        code: this.getErrorCode(error),
        message: error.message,
        layer: this.identifyValidationLayer(error.message),
        suggestion: this.getSuggestion(error)
      }
    });
  }
}

private getSuggestion(error: any): string {
  const message = error.message;

  if (message.includes('Invalid OHLC')) {
    return 'Check indicator calculations. OHLC values may be swapped or corrupted.';
  }
  if (message.includes('Timestamp in future')) {
    return 'Sync NTP on VPS. Run: sudo ntpdate -s time.nist.gov';
  }
  if (message.includes('sentinel value')) {
    return 'Indicator calculation failed. Ensure sufficient bars for calculation.';
  }
  if (message.includes('duplicate')) {
    return 'This bar was already queued. Check for duplicate POST requests.';
  }

  return 'Review validation error message for details.';
}
```

#### Mechanism 2: Health Check Endpoint for EA

```typescript
// src/api-gateway/health.controller.ts
@Controller('api/v1/health')
export class HealthController {
  @Get(':terminalId')
  async getTerminalHealth(@Param('terminalId') terminalId: string) {
    // Get error stats for this terminal
    const last24h = await this.getErrorStats(terminalId, 24);

    return {
      terminalId,
      status: last24h.errorRate < 1 ? 'healthy' : 'degraded',
      stats: {
        totalRequests: last24h.totalRequests,
        errors: last24h.errors,
        errorRate: last24h.errorRate,
        topErrorType: last24h.topErrorType,
        recommendation: this.getRecommendation(last24h),
      },
    };
  }

  private getRecommendation(stats: any): string {
    if (stats.errorRate > 5) {
      return 'High error rate detected. Check EA logs immediately.';
    }
    if (stats.topErrorType === 'invalid_ohlc') {
      return 'OHLC validation failing. Review indicator calculations.';
    }
    if (stats.topErrorType === 'timestamp_error') {
      return 'Timestamp issues. Sync NTP on VPS.';
    }
    return 'Terminal operating normally.';
  }
}
```

#### Mechanism 3: Daily Summary Email

```typescript
// src/monitoring/summary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from './mail.service';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly mailService: MailService) {}

  @Cron('0 9 * * *') // Every day at 9 AM
  async sendDailySummary() {
    const yesterday = await this.getStats(24);

    const html = `
      <h2>API Gateway Daily Summary</h2>
      <p>Period: Last 24 hours</p>
      
      <h3>Overview</h3>
      <ul>
        <li>Total Requests: ${yesterday.totalRequests.toLocaleString()}</li>
        <li>Errors: ${yesterday.totalErrors.toLocaleString()} (${yesterday.errorRate.toFixed(2)}%)</li>
        <li>Success Rate: ${(100 - yesterday.errorRate).toFixed(2)}%</li>
      </ul>
      
      <h3>Top Error Types</h3>
      <ol>
        ${yesterday.topErrors
          .map((e) => `<li>${e.type}: ${e.count} occurrences</li>`)
          .join('')}
      </ol>
      
      <h3>Terminal Health</h3>
      <table border="1">
        <tr><th>Terminal</th><th>Requests</th><th>Errors</th><th>Rate</th><th>Status</th></tr>
        ${yesterday.terminals
          .map(
            (t) => `
          <tr>
            <td>${t.id}</td>
            <td>${t.requests}</td>
            <td>${t.errors}</td>
            <td>${t.errorRate.toFixed(2)}%</td>
            <td style="color: ${t.errorRate < 1 ? 'green' : 'red'}">
              ${t.errorRate < 1 ? '✓ Healthy' : '⚠ Needs attention'}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
      
      <h3>Recommendations</h3>
      <ul>
        ${yesterday.recommendations.map((r) => `<li>${r}</li>`).join('')}
      </ul>
    `;

    await this.mailService.send({
      to: process.env.ADMIN_EMAIL,
      subject: `API Gateway Daily Summary - ${yesterday.errorRate.toFixed(2)}% error rate`,
      html,
    });
  }
}
```

---

## 9. Dashboard Examples

### Dashboard 1: Real-Time Validation Monitor

**Description:** Live view of validation status

**Panels:**

1. **Current Error Rate** (Gauge)
   - Target: < 1%
   - Warning: > 2%
   - Critical: > 5%

2. **Errors in Last Hour** (Time Series)
   - Line graph showing error count per minute
   - Colored by severity

3. **Active Terminals** (Table)
   - Terminal ID | Last Seen | Error Rate | Status
   - Sort by error rate descending

4. **Top Error Messages** (Bar Chart)
   - Top 10 error messages in last hour
   - Click to filter logs

**Use Case:** Operations dashboard for monitoring current system health

### Dashboard 2: Terminal Performance Comparison

**Description:** Compare health across all terminals

**Panels:**

1. **Success Rate by Terminal** (Bar Chart)
   - Horizontal bars showing % success
   - Target line at 99.5%

2. **Error Count by Terminal** (Heatmap)
   - Rows: Terminals
   - Columns: Hours of day
   - Color: Error count

3. **Terminal Timeline** (Gantt Chart)
   - Show periods of high errors
   - Show downtime periods

4. **Error Type Distribution by Terminal** (Stacked Bar)
   - Each terminal shows breakdown of error types

**Use Case:** Identify which terminals need maintenance

### Dashboard 3: Error Deep Dive

**Description:** Detailed analysis of validation errors

**Panels:**

1. **Error Funnel** (Funnel Chart)
   - Total Requests → Validation Errors → By Layer → By Type

2. **OHLC Errors Over Time** (Time Series)
   - Track specific error type trends

3. **Correlation Matrix** (Heatmap)
   - Rows: Error types
   - Columns: Symbols
   - Show which errors affect which symbols

4. **Error Clustering** (Scatter Plot)
   - X-axis: Hour of day
   - Y-axis: Error rate
   - Size: Impact (requests affected)

**Use Case:** Root cause analysis for persistent errors

### Dashboard 4: SLA & Reliability

**Description:** Track service level objectives

**Panels:**

1. **SLA Compliance** (Gauge)
   - Target: 99.5% uptime
   - Current: 99.8%

2. **MTTR (Mean Time To Resolution)** (Stat)
   - Average time from error spike to resolution
   - Trend: Improving / Stable / Degrading

3. **Error Budget** (Progress Bar)
   - Allowed errors this month vs used
   - 0.5% budget = 60 errors/day = 1,800/month

4. **Reliability Timeline** (Calendar Heatmap)
   - Each day colored by error rate
   - Green: < 0.5%, Yellow: 0.5-2%, Red: > 2%

**Use Case:** Executive reporting and SLA tracking

---

## 10. Troubleshooting Workflows

### Workflow 1: High Error Rate Alert

```
┌─────────────────────────────────────────────────────────────┐
│ ALERT: Error rate > 5% for 5 minutes                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Check Grafana Dashboard                             │
│ - Open "Validation Overview" dashboard                      │
│ - Identify: Which error type? Which terminal?               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Check Recent Logs                                   │
│ - railway logs --filter "Validation failed" --tail 50       │
│ - Look for patterns in error messages                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Identify Root Cause                                 │
│                                                              │
│ If "Invalid OHLC" errors:                                   │
│   → Check indicator calculations                            │
│   → Review recent EA code changes                           │
│                                                              │
│ If "Timestamp" errors:                                      │
│   → Check VPS time sync                                     │
│   → SSH to VPS: timedatectl status                          │
│                                                              │
│ If "Sentinel value" errors:                                 │
│   → Check if market just opened                             │
│   → Verify indicator warmup period                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Apply Fix                                           │
│ - Fix EA code OR                                            │
│ - Sync NTP OR                                               │
│ - Adjust validation rules                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Verify Resolution                                   │
│ - Monitor dashboard for 30 minutes                          │
│ - Error rate should drop to < 0.5%                          │
│ - Document in incident log                                  │
└─────────────────────────────────────────────────────────────┘
```

### Workflow 2: Single Terminal Issues

```
┌─────────────────────────────────────────────────────────────┐
│ OBSERVATION: terminal_001 has 75% of all errors             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Filter Logs by Terminal                             │
│ railway logs --filter "terminal_001" --tail 100             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Check Terminal-Specific Patterns                    │
│ - Are all 3 symbols affected?                               │
│ - Are all 9 timeframes affected?                            │
│ - Is there a time pattern?                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Compare with Healthy Terminal                       │
│ - Filter logs for terminal_002 (healthy)                    │
│ - Compare error rates and types                             │
│ - Identify what's different                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Remote Investigation                                │
│ - SSH to Contabo VPS                                        │
│ - Check terminal_001 MT5 logs                               │
│ - Check system resources (CPU, memory)                      │
│ - Check disk space                                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Isolate & Fix                                       │
│ - Restart MT5 terminal_001                                  │
│ - Update EA if needed                                       │
│ - Monitor for improvement                                   │
│                                                              │
│ If issue persists → Consider terminal replacement           │
└─────────────────────────────────────────────────────────────┘
```

### Workflow 3: New Error Type Appears

```
┌─────────────────────────────────────────────────────────────┐
│ ALERT: New error type detected (never seen before)          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Examine Error Details                               │
│ - Read full error message                                   │
│ - Check which validation layer triggered                    │
│ - Note symbol, timeframe, terminal                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Determine if Legitimate                             │
│                                                              │
│ Is this catching real data errors?                          │
│   → Good! Validation working as intended                    │
│   → Document in error catalog                               │
│                                                              │
│ Is this rejecting valid data?                               │
│   → Bad! Validation too strict                              │
│   → Need to adjust validation rules                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Check for Recent Changes                            │
│ - Was validation logic recently updated?                    │
│ - Was EA recently updated?                                  │
│ - Did market conditions change?                             │
│ - New symbol added?                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Take Action                                         │
│                                                              │
│ If catching real errors:                                    │
│   → Fix EA to not send bad data                             │
│                                                              │
│ If validation too strict:                                   │
│   → Relax validation rules                                  │
│   → Deploy updated ValidationService                        │
│                                                              │
│ If edge case:                                               │
│   → Add specific handling for this case                     │
│   → Document exception                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. ROI & Cost Analysis

### Cost Breakdown

#### Level 1: Basic Logging

| Item               | Cost                     | Benefit               |
| ------------------ | ------------------------ | --------------------- |
| **Implementation** | 5 minutes developer time | Free error tracking   |
| **Storage**        | $0 (Railway included)    | Searchable logs       |
| **Maintenance**    | 5 min/day log review     | Early error detection |
| **Total**          | **$0/month**             | **Immediate ROI**     |

#### Level 2: Metrics Dashboard

| Item               | Cost                         | Benefit             |
| ------------------ | ---------------------------- | ------------------- |
| **Implementation** | 2 hours developer time       | Visual dashboards   |
| **Prometheus**     | $0 (Railway, 256MB)          | Time-series storage |
| **Grafana**        | $0 (Railway, 256MB)          | Custom dashboards   |
| **Maintenance**    | 30 min/week dashboard review | Trend analysis      |
| **Total**          | **$0/month**                 | **High ROI**        |

#### Level 3: Full Stack

| Item               | Cost                  | Benefit             |
| ------------------ | --------------------- | ------------------- |
| **Implementation** | 1 day developer time  | Enterprise features |
| **Sentry**         | $26/month (Team plan) | Error grouping      |
| **Datadog**        | $15/host/month        | Full APM            |
| **PagerDuty**      | $21/user/month        | On-call rotation    |
| **Maintenance**    | 2 hours/week          | Automatic alerts    |
| **Total**          | **$62/month**         | **Medium ROI**      |

### ROI Calculation

#### Scenario: OHLC Bug Discovery

**Without Observability:**

```
Day 1: Bug introduced
Day 7: Developer checks failed queue → discovers
Day 8: Fix deployed
Total: 7 days of bad data (4,200 failed jobs)

Cost:
- 7 days of investigation time: 2 hours/day × $100/hour = $1,400
- Manual cleanup of failed jobs: 4 hours × $100/hour = $400
- Total: $1,800
```

**With Basic Logging (Level 1):**

```
Day 1: Bug introduced
Day 1: Developer checks morning logs → discovers
Day 1: Fix deployed within 3 hours
Total: 3 hours of bad data (18 failed jobs)

Cost:
- Investigation time: 0.5 hours × $100/hour = $50
- No cleanup needed
- Total: $50

Savings: $1,750
```

**With Metrics Dashboard (Level 2):**

```
Day 1: Bug introduced at 10:00 AM
Day 1: Alert triggered at 10:15 AM
Day 1: Fix deployed at 10:45 AM
Total: 45 minutes of bad data (6 failed jobs)

Cost:
- Investigation time: 0.25 hours × $100/hour = $25
- No cleanup needed
- Total: $25

Savings: $1,775
```

**With Full Stack (Level 3):**

```
Day 1: Bug introduced at 10:00 AM
Day 1: Automatic alert to Slack at 10:05 AM
Day 1: Fix deployed at 10:20 AM
Total: 20 minutes of bad data (3 failed jobs)

Cost:
- Investigation time: 0.1 hours × $100/hour = $10
- Service cost: $62/month ÷ 30 days = $2/day
- Total: $12

Savings: $1,788
```

### Annual ROI

Assuming 1 major bug per month:

| Level       | Monthly Cost | Bug Detection Savings | Net Annual Savings           |
| ----------- | ------------ | --------------------- | ---------------------------- |
| **Level 1** | $0           | $1,750 × 12 = $21,000 | **$21,000**                  |
| **Level 2** | $0           | $1,775 × 12 = $21,300 | **$21,300**                  |
| **Level 3** | $62          | $1,788 × 12 = $21,456 | $21,456 - $744 = **$20,712** |

**Conclusion:** Even Level 3 with its monthly cost has excellent ROI due to faster bug detection.

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Get basic observability working

**Tasks:**

- [ ] Add structured logging to ValidationService
- [ ] Add structured logging to Controller
- [ ] Configure NestJS logger levels
- [ ] Test log output in Railway
- [ ] Create manual log analysis script

**Time Required:** 4 hours

**Outcome:** Can see and search validation errors

### Phase 2: Metrics (Week 2-3)

**Goal:** Set up automated metrics collection

**Tasks:**

- [ ] Install prom-client package
- [ ] Create MetricsService
- [ ] Add metrics to ValidationService
- [ ] Add metrics to Controller
- [ ] Expose /metrics endpoint
- [ ] Deploy Prometheus to Railway
- [ ] Configure Prometheus scraping

**Time Required:** 8 hours

**Outcome:** Metrics are being collected

### Phase 3: Dashboards (Week 4)

**Goal:** Visualize metrics in Grafana

**Tasks:**

- [ ] Deploy Grafana to Railway
- [ ] Add Prometheus data source
- [ ] Create "Validation Overview" dashboard
- [ ] Create "Terminal Health" dashboard
- [ ] Create "Performance Metrics" dashboard
- [ ] Share dashboards with team

**Time Required:** 6 hours

**Outcome:** Visual dashboards available

### Phase 4: Alerts (Week 5-6)

**Goal:** Get notified of issues automatically

**Tasks:**

- [ ] Configure Slack webhook
- [ ] Create SlackService
- [ ] Set up Grafana alerts
- [ ] Test alert delivery
- [ ] Create on-call rotation (if needed)
- [ ] Document alert response procedures

**Time Required:** 4 hours

**Outcome:** Automatic alerting working

### Phase 5: Feedback Loop (Week 7-8)

**Goal:** Use observability data to improve EA

**Tasks:**

- [ ] Analyze 1 month of error data
- [ ] Identify top 3 error sources
- [ ] Fix EA bugs causing errors
- [ ] Update validation rules if needed
- [ ] Create terminal health check endpoint
- [ ] Set up daily summary email

**Time Required:** 8 hours

**Outcome:** Continuous improvement process

### Phase 6: Advanced Features (Month 3+)

**Goal:** Enterprise-grade observability

**Tasks:**

- [ ] Evaluate Sentry/Datadog/New Relic
- [ ] Implement chosen platform
- [ ] Set up distributed tracing
- [ ] Create SLA dashboard
- [ ] Implement anomaly detection
- [ ] Set up incident management workflow

**Time Required:** 16 hours

**Outcome:** Production-grade observability

---

## Appendix A: Metric Definitions

### Request Metrics

- **api_requests_total**: Total number of API requests
  - Labels: method, endpoint, status
  - Type: Counter

- **api_request_duration_seconds**: Request processing time
  - Labels: method, endpoint, status
  - Type: Histogram
  - Buckets: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 5s

### Validation Metrics

- **api_validation_errors_total**: Total validation errors
  - Labels: error_type, validation_layer, symbol, terminal_id
  - Type: Counter

- **api_validation_error_rate**: Errors per minute
  - Labels: terminal_id
  - Type: Gauge

- **api_validation_success_rate**: Success percentage
  - Labels: terminal_id
  - Type: Gauge

### Queue Metrics

- **queue_jobs_waiting**: Jobs waiting in queue
  - Labels: queue_name
  - Type: Gauge

- **queue_jobs_active**: Jobs currently being processed
  - Labels: queue_name
  - Type: Gauge

- **queue_jobs_completed**: Total completed jobs
  - Labels: queue_name
  - Type: Counter

- **queue_jobs_failed**: Total failed jobs
  - Labels: queue_name
  - Type: Counter

---

## Appendix B: Log Format Examples

### Successful Request Log

```json
{
  "level": "log",
  "timestamp": "2026-01-29T10:30:15.123Z",
  "context": "MarketDataController",
  "message": "Request successful",
  "symbol": "btcusd",
  "timeframe": "PERIOD_M5",
  "terminalId": "terminal_001",
  "jobId": "btcusd_PERIOD_M5_1706524815",
  "duration": 3
}
```

### Validation Error Log

```json
{
  "level": "error",
  "timestamp": "2026-01-29T10:30:15.123Z",
  "context": "ValidationService",
  "message": "Validation failed",
  "symbol": "btcusd",
  "timeframe": "PERIOD_M5",
  "timestamp": 1706524815,
  "terminalId": "terminal_001",
  "eaVersion": "v2.24",
  "errorType": "BadRequestException",
  "errorMessage": "Invalid OHLC: high (43240.5) cannot be less than low (43250.0)",
  "validationLayer": "OHLC_RELATIONSHIPS",
  "stackTrace": "BadRequestException: Invalid OHLC...\n    at ValidationService.validateOHLC..."
}
```

### Queue Metrics Log

```json
{
  "level": "log",
  "timestamp": "2026-01-29T10:30:15.123Z",
  "context": "QueueMetricsService",
  "message": "Queue metrics updated",
  "queueName": "market-data-sync",
  "waiting": 125,
  "active": 5,
  "completed": 15234,
  "failed": 12
}
```

---

## Appendix C: Useful Queries

### Prometheus Queries

```promql
# Error rate (last 5 minutes)
rate(api_validation_errors_total[5m]) * 60

# Success rate percentage
(rate(api_requests_total{status="200"}[5m]) / rate(api_requests_total[5m])) * 100

# Top error types
topk(5, sum by (error_type) (api_validation_errors_total))

# Errors by terminal
sum by (terminal_id) (api_validation_errors_total)

# 95th percentile latency
histogram_quantile(0.95, api_request_duration_seconds_bucket)

# Queue depth trend
avg_over_time(queue_jobs_waiting[1h])
```

### Grafana Variable Queries

```promql
# Terminal list (for dropdown)
label_values(api_validation_errors_total, terminal_id)

# Symbol list (for dropdown)
label_values(api_validation_errors_total, symbol)

# Error type list (for dropdown)
label_values(api_validation_errors_total, error_type)

# Time range selector
$__auto_interval_timeFilter
```

---

## Conclusion

Observability is **essential** for the API Gateway validation layer. The validation produces rich, structured error data that:

1. **Tells you exactly what's wrong** (not just "job failed")
2. **Identifies the source** (which terminal, which symbol)
3. **Provides actionable feedback** (what to fix in EA)
4. **Enables continuous improvement** (track error trends)

**Start simple** with basic logging (Level 1), **upgrade to metrics** (Level 2) after 1 month, and **consider full stack** (Level 3) only if you have 50+ terminals or need 24/7 automatic alerts.

The validation itself makes observability 10x more valuable because errors are:

- ✅ Caught immediately (not days later)
- ✅ Categorized clearly (by layer and type)
- ✅ Attributed correctly (to terminal and symbol)
- ✅ Actionable (with specific error messages)

**ROI is immediate**: Even basic logging saves thousands of dollars per year by detecting bugs within hours instead of days.

---

**Document Version:** 1.0  
**Date:** 2026-01-29  
**Author:** Trading Alerts SaaS Engineering Team  
**Status:** Production Guide

---

**END OF OBSERVABILITY GUIDE**
