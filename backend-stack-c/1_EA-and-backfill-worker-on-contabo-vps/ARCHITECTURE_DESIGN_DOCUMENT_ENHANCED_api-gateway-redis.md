# Railway Gateway — API Gateway Architecture & Build Guide (XAUUSD v6 Pipeline)

## Executive Summary

This document specifies the Railway-hosted NestJS API Gateway that receives validated XAUUSD `market_data` rows from the v6 data pipeline's Push Worker (and, optionally, its legacy Relay), and forwards them to whatever downstream product consumes them beyond this pipeline's scope. It is a revision of an earlier draft that was written against a different, since-superseded design (15 symbols, 5 MT5 terminals on EA v2.24, a Direct-Redis-vs-API-Gateway comparison, and an Upstash→Railway migration). That comparison is resolved — the Gateway pattern is what this pipeline already sends to — so this revision describes the chosen design directly rather than re-litigating the choice, and corrects every component spec to match the pipeline's actual current contract (`gateway_contract_market_data.schema.json`, 79 fields, single symbol XAUUSD, M5/M15 only).

**Complementary document:** `MT5_to_LightweightCharts_Architecture_Blueprint.md` — that document covers the whole system (MT5 → Collector → SQLite → the two independent outbound paths); this document is the detailed build spec for one box on its diagram: "Railway Gateway — Internal Stack" (companion deck, slide 5). Where the two overlap (§6/§8 of the blueprint), this document is the authoritative source for Gateway-specific detail; the blueprint remains authoritative for how the Gateway fits into the larger system and for confirming what the Gateway is _not_ connected to (it does not feed the chart-visualization path — see the blueprint's §7.4).

**Architecture in one line:** MT5 Terminal (Contabo VPS) → Collector/Calc Stack → `xauusd.db` → Push Worker (+ optional Relay) → HTTPS POST → **this Gateway** (NestJS, Railway) → internal Bull/Redis queue → the Gateway's own downstream consumer (out of scope here).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Detailed Component Specifications](#2-detailed-component-specifications)
3. [Data Flow & Processing](#3-data-flow--processing)
4. [API Specifications](#4-api-specifications)
5. [Security & Authentication](#5-security--authentication)
6. [On Performance, Throughput, and Cost](#6-on-performance-throughput-and-cost)
7. [Deployment & Rollout Guide](#7-deployment--rollout-guide)
8. [Design Rationale](#8-design-rationale)
9. [Implementation Examples](#9-implementation-examples)

---

## 1. Architecture Overview

### 1.1 Topology

```
┌─────────────────────────────────────────────────────────────┐
│ CONTABO VPS (Windows — one host, one xauusd.db)               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ MT5 Terminal — 12 MQL5 indicators, XAUUSD M5+M15         │ │
│ │ Collector + Calc Stack — validate/calculate/promote      │ │
│ │ xauusd.db (SQLite) — market_data, 79 fields              │ │
│ │ Push Worker — reads unsynced rows                        │ │
│ │ Relay (optional/legacy) — reads EA socket feed            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                          ↓                                    │
│         (1) HTTPS POST /api/v1/market-data                   │
│         Endpoint: https://<railway-app>.railway.app           │
│         Auth: Bearer {API_KEY}                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ THIS GATEWAY — RAILWAY (NestJS)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Ingest Layer                                              │ │
│ │ ├── ApiKeyGuard                                           │ │
│ │ ├── ThrottlerGuard (rate limiting)                        │ │
│ │ ├── DTO validation vs gateway_contract_market_data schema  │ │
│ │ └── Idempotent upsert key: (symbol, timeframe, timestamp) │ │
│ └─────────────────────────────────────────────────────────┘ │
│                          ↓                                    │
│              (2) Add to Bull Queue (internal Redis)           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ RAILWAY REDIS (internal, this Gateway's own)                  │
│ ├── Queue: "market-data-sync"                                 │
│ └── Rate limiting                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ THIS GATEWAY'S DOWNSTREAM CONSUMER — out of scope here         │
│ Whatever product this Gateway serves beyond the XAUUSD         │
│ pipeline; not specified in this document (§2.4).               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 What changed from the earlier draft, and why

An earlier draft of this document evaluated "Direct Redis Access" against "API Gateway" as two competing options for a 15-symbol, 5-terminal system. Neither of those conditions describes this pipeline: there is one symbol (XAUUSD), one Contabo VPS, and the sender was never a direct Redis client — it was always going to be an HTTPS POST from a Python Push Worker to this Gateway's own HTTP endpoint. The comparison and its decision framework are therefore not live questions for this system; they're removed from this revision rather than kept as a resolved-but-irrelevant artifact. What's kept, because it's independent of that framing, is everything about how _this_ Gateway is actually built: the NestJS module structure, the auth/rate-limiting guards, the queue pattern, and the response contract — all in §2 onward.

### 1.3 Scope boundary

This document specifies the ingest layer only: accepting a POST from the Push Worker/Relay, validating its shape against the pipeline's real contract, upserting idempotently, and acknowledging with the correct status code so the sender's own retry/quarantine logic (already built — `rejected_rows.jsonl` + `replay_quarantine.py`, described in the companion blueprint's §6 and §8.3) works correctly. What happens to a row after it's queued — which downstream product consumes it, what store it lands in — belongs to that product's own specification, not this one. §2.4 states this explicitly as a scope boundary, not an oversight.

---

## 2. Detailed Component Specifications

### 2.1 Gateway Ingest Service (NestJS)

#### Module Structure

```typescript
// src/gateway/gateway.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { MarketDataController } from './market-data.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [
    // Rate limiting with Redis backend
    ThrottlerModule.forRoot({
      storage: new ThrottlerStorageRedisService({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: 4, // Dedicated DB for rate limiting
      }),
      ttl: 60,
      limit: 100, // generous relative to actual volume — see §2.1
    }),

    // Bull Queue connection
    BullModule.registerQueue({
      name: 'market-data-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [MarketDataController],
  providers: [ValidationService],
})
export class GatewayModule {}
```

#### Controller Implementation

Note: `terminal_id` is a **body field** (required by `gateway_contract_market_data.schema.json`), not an HTTP header — the prior draft's `X-Terminal-ID`/`X-EA-Version` headers assumed a fleet of MT5 terminals identifying themselves per-request; this pipeline's sender identifies itself in the payload instead (`terminal_id: "push_worker_v5"`), and there is no EA-version concept in the current contract.

```typescript
// src/gateway/market-data.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { MarketDataDto } from './dto/market-data.dto';
import { ValidationService } from './validation.service';

@Controller('api/v1/market-data')
@UseGuards(ApiKeyGuard, ThrottlerGuard)
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly validationService: ValidationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60) // generous relative to actual volume: 2 timeframes, ~1 POST per 5-15 min in steady state
  async publishMarketData(@Body() data: MarketDataDto) {
    const startTime = Date.now();

    try {
      // 1. Validate shape against the pipeline's real contract
      await this.validationService.validate(data);

      // 2. Add to queue — idempotency key matches the schema's upsert key exactly
      const job = await this.queue.add('process', data, {
        jobId: `${data.symbol}_${data.timeframe}_${data.timestamp}`,
      });

      // 3. Log metrics
      const duration = Date.now() - startTime;
      this.logger.log(
        `Queued: ${data.symbol} ${data.timeframe} @ ${data.timestamp} | ` +
          `Job ID: ${job.id} | Duration: ${duration}ms`
      );

      // 4. Return response — the Push Worker uses this to decide synced_at (see §3.2)
      return {
        status: 'queued',
        jobId: job.id,
        processingTime: duration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue: ${data.symbol} ${data.timeframe} @ ${data.timestamp}`,
        error.stack
      );
      throw error;
    }
  }
}
```

There is no per-timeframe priority queue here (the prior draft's `calculatePriority`, spanning M1 through MN1, doesn't apply — this contract only ever sees M5 or M15, and at a cadence low enough that priority ordering between them has no measurable effect). If a future requirement introduces enough throughput or additional timeframes to matter, reintroduce it deliberately rather than by default.

#### Data Transfer Object (DTO)

```typescript
// src/api-gateway/dto/market-data.dto.ts
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

enum Timeframe {
  M5 = 'M5',
  M15 = 'M15',
}

enum ZigzagPointType {
  Peak = 'Peak',
  Bottom = 'Bottom',
}

enum ZigzagCategory {
  HH = 'HH',
  HL = 'HL',
  LH = 'LH',
  LL = 'LL',
  EQH = 'EQH',
  EQL = 'EQL',
}

// One centroid-regression variant's field group — repeated verbatim for all
// six variants (best_fit, cherry_a, cherry_b, most_recent, non_a, non_b).
// horiz_high_map/horiz_low_map/ssa/ema_ssa/crossing come from MQL5 (admin
// layer); base_fl/uoedt/loedt are Python-calculated. All nullable — null
// means "inactive on this bar," never coerced to 0 (§2.2 below).
class CentroidVariantDto {
  @IsNumber() @IsOptional() horiz_high_map?: number | null;
  @IsNumber() @IsOptional() horiz_low_map?: number | null;
  @IsNumber() @IsOptional() ssa?: number | null;
  @IsNumber() @IsOptional() ema_ssa?: number | null;
  @IsIn([0, 1, null]) @IsOptional() crossing?: number | null;
  @IsNumber() @IsOptional() base_fl?: number | null;
  @IsNumber() @IsOptional() uoedt?: number | null;
  @IsNumber() @IsOptional() loedt?: number | null;
}

export class MarketDataDto {
  @IsString()
  terminal_id: string; // e.g. "push_worker_v5" — body field, not a header (see note above)

  @IsNumber()
  @Min(1000000000) // Year 2001
  @Max(2147483647) // Unix timestamp limit
  timestamp: number; // ADJUSTED bar timestamp (UTC unix sec, rounded to the bar grid)

  @IsIn(['XAUUSD'])
  symbol: string;

  @IsEnum(Timeframe)
  timeframe: Timeframe;

  @IsNumber() open: number;
  @IsNumber() high: number;
  @IsNumber() low: number;
  @IsNumber() close: number;
  @IsNumber() volume: number;

  // Six centroid variants — field-for-field identical group, so this is
  // shown once (CentroidVariantDto above); the real DTO embeds one instance
  // per variant with the appropriate key prefix (best_fit_*, cherry_a_*, etc.)
  // via a validator that iterates VARIANT_NAMES rather than 48 repeated
  // properties — see gateway_contract_market_data.schema.json for the
  // authoritative flat field list.

  // Fractal + single best lines (calculated, nullable)
  @IsNumber() @IsOptional() fractal_best_fl?: number | null;
  @IsNumber() @IsOptional() fractal_uoedt?: number | null;
  @IsNumber() @IsOptional() fractal_loedt?: number | null;
  @IsNumber() @IsOptional() best_resistance?: number | null;
  @IsNumber() @IsOptional() best_support?: number | null;

  // Z-score body (calculated, nullable)
  @IsIn([-1, 0, 1, null]) @IsOptional() body_direction?: number | null;
  @IsNumber() @IsOptional() body_size?: number | null; // |z-score|, export convention
  @IsInt() @Min(0) @Max(5) @IsOptional() body_classification?: number | null;

  // ZigZag — pivot fields are admin layer (null on non-pivot bars); metrics calculated
  @IsEnum(ZigzagPointType)
  @IsOptional()
  zigzag_point_type?: ZigzagPointType | null;
  @IsNumber() @IsOptional() zigzag_current_point?: number | null;
  @IsNumber() @IsOptional() zigzag_price_change?: number | null;
  @IsNumber() @IsOptional() zigzag_pct_change?: number | null;
  @IsInt() @IsOptional() zigzag_pct_change_class?: number | null;
  @IsInt() @IsOptional() zigzag_bars?: number | null;
  @IsInt() @IsOptional() zigzag_bars_class?: number | null;
  @IsNumber() @IsOptional() zigzag_price_per_bar?: number | null;
  @IsInt() @IsOptional() zigzag_price_per_bar_class?: number | null;
  @IsNumber() @IsOptional() zigzag_slope?: number | null;
  @IsEnum(ZigzagCategory) @IsOptional() zigzag_category?: ZigzagCategory | null;

  // Provenance — informational, not authoritative for anything the Gateway decides
  @IsInt() @IsOptional() cycle_id?: number | null;
  @IsInt() @IsOptional() collected_at?: number | null;
  @IsInt() @IsOptional() calculated_at?: number | null;
}
```

The full, field-by-field-flat DTO (all 79 properties, six variant groups expanded) should be generated from `gateway_contract_market_data.schema.json` directly — e.g. via `json-schema-to-typescript` plus `class-validator-jsonschema`, or an equivalent codegen step — rather than hand-maintained. The schema file is the authoritative source; a hand-written DTO drifting from it silently is exactly the failure mode that made the _previous_ version of this document (validating `tema`/`hrma`/`kc_*`) stale in the first place.

#### Validation Service

```typescript
// src/gateway/validation.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MarketDataDto } from './dto/market-data.dto';

@Injectable()
export class ValidationService {
  constructor(@InjectQueue('market-data-sync') private readonly queue: Queue) {}

  async validate(data: MarketDataDto): Promise<void> {
    // Layer 1: Symbol/timeframe validation
    this.validateSymbol(data.symbol);

    // Layer 2: OHLC relationship validation
    this.validateOHLC(data);

    // Layer 3: Timestamp validation
    this.validateTimestamp(data.timestamp);

    // Layer 4: Derived-field nullability & enum conformance
    // (replaces the prior draft's sentinel-value + numeric-range layers,
    // which checked fields — tema, hrma, kc_*, sr_* — that do not exist in
    // this contract; see §2.2 for why this layer looks different)
    this.validateDerivedFieldConformance(data);

    // Layer 5: Candle proportion validation
    this.validateCandleProportions(data);

    // Layer 6: Volume sanity check
    this.validateVolume(data);

    // Layer 7: Duplicate detection
    await this.checkDuplicates(data);
  }

  private validateSymbol(symbol: string): void {
    if (symbol !== 'XAUUSD') {
      throw new BadRequestException(
        `Unsupported symbol: ${symbol}. This gateway currently accepts XAUUSD only.`
      );
    }
  }

  private validateOHLC(data: MarketDataDto): void {
    // Rule 1: High must be >= Low
    if (data.high < data.low) {
      throw new BadRequestException(
        `Invalid OHLC: high (${data.high}) cannot be less than low (${data.low})`
      );
    }

    // Rule 2: High must be >= Open and Close
    if (data.high < data.open) {
      throw new BadRequestException(
        `Invalid OHLC: high (${data.high}) cannot be less than open (${data.open})`
      );
    }

    if (data.high < data.close) {
      throw new BadRequestException(
        `Invalid OHLC: high (${data.high}) cannot be less than close (${data.close})`
      );
    }

    // Rule 3: Low must be <= Open and Close
    if (data.low > data.open) {
      throw new BadRequestException(
        `Invalid OHLC: low (${data.low}) cannot be greater than open (${data.open})`
      );
    }

    if (data.low > data.close) {
      throw new BadRequestException(
        `Invalid OHLC: low (${data.low}) cannot be greater than close (${data.close})`
      );
    }

    // Rule 4: All prices must be positive
    if (data.open <= 0 || data.high <= 0 || data.low <= 0 || data.close <= 0) {
      throw new BadRequestException('All OHLC prices must be positive');
    }
  }

  private validateTimestamp(timestamp: number): void {
    const now = Date.now() / 1000;
    const maxAge = 86400 * 7; // 7 days
    const futureTolerance = 300; // 5 minutes

    // Rule 1: Not too far in future (clock skew tolerance)
    if (timestamp > now + futureTolerance) {
      const diff = Math.floor(timestamp - now);
      throw new BadRequestException(
        `Timestamp is ${diff} seconds in the future (max: ${futureTolerance}s). ` +
          `Check MT5 terminal clock sync.`
      );
    }

    // Rule 2: Not too old (use backfill endpoint for historical data)
    if (timestamp < now - maxAge) {
      const daysOld = Math.floor((now - timestamp) / 86400);
      throw new BadRequestException(
        `Timestamp is ${daysOld} days old (max: 7 days). ` +
          `Use backfill endpoint for historical data.`
      );
    }

    // Rule 3: Reasonable timestamp format (after year 2000)
    if (timestamp < 946684800) {
      // Jan 1, 2000
      throw new BadRequestException(
        'Timestamp appears to be in wrong format or before year 2000'
      );
    }
  }

  private validateDerivedFieldConformance(data: MarketDataDto): void {
    // This pipeline's derived fields are deliberately nullable — "null" means
    // "this indicator/metric is inactive on this bar," a real and expected
    // state, never a sentinel to detect. There is therefore no sentinel-value
    // scan here (unlike the prior draft): a well-formed row with 60 of its 70
    // derived fields null is not suspicious, it's normal (see
    // gateway_contract_market_data.schema.json's own description field).
    //
    // What IS worth checking here: that populated (non-null) fields conform
    // to the contract's actual constraints — its enums and its declared
    // integer/number types. class-validator's @IsEnum/@IsIn/@IsInt decorators
    // on the DTO (above) already enforce most of this at the framework level;
    // this method exists for the handful of cross-field constraints the DTO
    // can't express alone.

    // crossing flags (one per centroid variant) are 0/1/null by contract —
    // enforced per-field via @IsIn in the DTO; no cross-field check needed.

    // body_classification is documented as 0-5; enforced via @Min/@Max in the DTO.

    // zigzag_point_type gates zigzag_current_point: a pivot type without a
    // pivot price (or vice versa) indicates a partially-populated row.
    const hasPivotType =
      data.zigzag_point_type !== undefined && data.zigzag_point_type !== null;
    const hasPivotPoint =
      data.zigzag_current_point !== undefined &&
      data.zigzag_current_point !== null;
    if (hasPivotType !== hasPivotPoint) {
      throw new BadRequestException(
        'zigzag_point_type and zigzag_current_point must both be present or both be null — got one without the other.'
      );
    }

    // Deliberately NOT reimplemented here (see the doc's §1.2/§2.1 notes):
    // numeric plausibility ranges for the centroid/ZigZag/fractal fields
    // (analogous to the prior draft's "MA within 50% of price" or "Z-score
    // within ±10" checks). This pipeline's own collector already performs
    // cross-source validation (key agreement, ZigZag-as-subset, completeness)
    // before a row ever reaches this Gateway — see the companion blueprint's
    // §6 — so re-deriving plausibility bounds here would duplicate a check
    // this pipeline already does more rigorously upstream, without the
    // benefit of comparing against a second independently-timed source the
    // way the collector can. If this Gateway later serves senders that skip
    // that upstream validation, revisit this decision explicitly rather than
    // assuming the omission still holds.
  }

  private validateCandleProportions(data: MarketDataDto): void {
    const range = data.high - data.low;
    const body = Math.abs(data.close - data.open);

    // Rule 1: Range cannot be zero
    if (range === 0) {
      throw new BadRequestException(
        'Invalid candle: high equals low (zero range). Possible data freeze.'
      );
    }

    // Rule 2: Detect flash crashes (body > 100x range is impossible)
    if (body > range * 100) {
      throw new BadRequestException(
        `Invalid candle proportions: body (${body.toFixed(5)}) exceeds ` +
          `range (${range.toFixed(5)}) by 100x. Possible flash crash or data corruption.`
      );
    }

    // Rule 3: Detect impossibly small spreads (data error)
    const avgPrice = (data.high + data.low) / 2;
    const spreadPercent = (range / avgPrice) * 100;

    if (spreadPercent < 0.0001) {
      throw new BadRequestException(
        `Spread too small: ${spreadPercent.toFixed(6)}% of price. ` +
          `Possible data precision error.`
      );
    }

    // Rule 4: Detect impossibly large spreads (>20% in one bar = suspicious)
    if (spreadPercent > 20) {
      throw new BadRequestException(
        `Spread too large: ${spreadPercent.toFixed(2)}% of price in one bar. ` +
          `Possible gap or data error.`
      );
    }

    // Rule 5: Body should not be larger than range
    if (body > range) {
      throw new BadRequestException(
        `Invalid candle: body (${body.toFixed(5)}) cannot exceed ` +
          `range (${range.toFixed(5)})`
      );
    }
  }

  private validateVolume(data: MarketDataDto): void {
    // Rule 1: Volume cannot be negative
    if (data.volume < 0) {
      throw new BadRequestException(
        `Volume cannot be negative: ${data.volume}`
      );
    }

    // Rule 2: Volume cannot be zero for liquid markets (optional, symbol-dependent)
    // Commented out as zero volume can be valid for some timeframes
    // if (data.volume === 0) {
    //   throw new BadRequestException('Volume cannot be zero');
    // }

    // Rule 3: Detect suspiciously high volume (data corruption)
    const MAX_VOLUME = 100000000; // 100M per bar
    if (data.volume > MAX_VOLUME) {
      throw new BadRequestException(
        `Volume exceeds maximum threshold: ${data.volume} ` +
          `(max: ${MAX_VOLUME}). Possible data corruption.`
      );
    }

    // Rule 4: Detect impossible volume patterns (optional advanced check)
    // For future: could compare with historical average for the symbol/timeframe
  }

  private async checkDuplicates(data: MarketDataDto): Promise<void> {
    // Build unique job ID
    const jobId = `${data.symbol}_${data.timeframe}_${data.timestamp}`;

    try {
      // Check if job already exists
      const existingJob = await this.queue.getJob(jobId);

      if (existingJob) {
        const state = await existingJob.getState();

        // If job is waiting or active, reject duplicate
        if (state === 'waiting' || state === 'active') {
          throw new ConflictException(
            `Job already queued: ${jobId} (state: ${state})`
          );
        }

        // If job completed recently, warn but allow (could be backfill)
        if (state === 'completed') {
          const finishedAt = existingJob.finishedOn;
          const now = Date.now();

          if (finishedAt && now - finishedAt < 60000) {
            // Less than 1 minute ago
            throw new ConflictException(
              `Job recently completed: ${jobId} (${Math.floor((now - finishedAt) / 1000)}s ago)`
            );
          }
        }
      }
    } catch (error) {
      // If ConflictException, rethrow
      if (error instanceof ConflictException) {
        throw error;
      }

      // Other errors (Redis connection issues) should not block ingestion
      // Log error but allow request to proceed
      console.warn(`Duplicate check failed for ${jobId}:`, error.message);
    }
  }
}
```

#### What each validation layer actually accomplishes

The prior draft's per-layer "error reduction" percentages and the cost-benefit arithmetic beneath them (540 failed jobs/day, 12,000 bars/day, 405x time saved) were computed against a 15-symbol, high-throughput scenario and would be fabricated if restated for this pipeline — at 2 timeframes and one validated cycle every 5–15 minutes, there is no comparable empirical error-rate baseline to cite, and inventing one would be worse than omitting it. What's worth keeping is the qualitative purpose of each layer:

- **Symbol/timeframe validation** — catches a misconfigured sender before it reaches the queue at all.
- **OHLC relationship validation** — catches transmission corruption or a broken calculation, independent of which fields are involved; this check is about internal consistency of the four price fields, not about the pipeline's own multi-source cross-validation (which already happened upstream, in the collector).
- **Timestamp validation** — rejects clock-skew and stale-data cases before they pollute the queue.
- **Derived-field conformance** — confirms the payload matches this contract's actual nullable/enum shape, rather than assuming the shape of a different, older contract.
- **Candle proportion validation** — catches zero-range or flash-crash-shaped bars, a check that's about OHLCV internal sanity and applies regardless of which schema version is in use.
- **Volume sanity** — same rationale, unchanged from the prior draft.
- **Duplicate detection** — prevents the same bar from being queued twice, which matters here specifically because retries are expected by design (§3.2's idempotency contract), not a rare edge case.

This Gateway's validation is deliberately narrower in scope than the pipeline's own collector-side validation (cross-source key agreement, ZigZag-as-subset, completeness — see the companion blueprint's §6): the Gateway confirms the payload it received is well-formed and matches the contract; it does not re-derive market-data correctness, because the sender already did that more rigorously upstream, against sources this Gateway never sees.

There is no `TransformationService` in this revision. The prior draft's version added a `metadata` object and a `computed` object to the payload before queuing — but `gateway_contract_market_data.schema.json` declares `"additionalProperties": false`, meaning any field beyond the schema's own 79 is a contract violation, not an enrichment. If per-request provenance (received-at time, sender identity beyond `terminal_id`) is needed downstream, it belongs in request _logging_, not in the payload that gets queued and eventually upserted.

#### API Key Authentication Guard

```typescript
// src/auth/api-key.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization type');
    }

    const validApiKeys = this.configService.get<string>('API_KEYS').split(',');

    if (!validApiKeys.includes(token)) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Add API key info to request for logging
    request.apiKeyId = this.getApiKeyId(token);

    return true;
  }

  private getApiKeyId(token: string): string {
    // Extract identifier from API key (e.g., terminal ID)
    // Format: "mt5_terminal_123_abc123..."
    const parts = token.split('_');
    return parts.length >= 3 ? parts.slice(0, 3).join('_') : 'unknown';
  }
}
```

### 2.2 Railway Redis Configuration

```typescript
// src/config/redis.config.ts
import { RedisModuleOptions } from '@liaoliaots/nestjs-redis';

export const redisConfig: RedisModuleOptions = {
  config: [
    {
      namespace: 'default',
      host: process.env.REDIS_HOST || 'redis.railway.internal',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0, // Default / Caching
    },
    {
      namespace: 'queue',
      host: process.env.REDIS_HOST || 'redis.railway.internal',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1, // Bull Queue
    },
    {
      namespace: 'session',
      host: process.env.REDIS_HOST || 'redis.railway.internal',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 3, // Sessions
    },
    {
      namespace: 'ratelimit',
      host: process.env.REDIS_HOST || 'redis.railway.internal',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 4, // Rate Limiting
    },
  ],
};
```

---

## 3. Data Flow & Processing

### 3.1 Request Flow

```
Step 1: Push Worker (or Relay) sends HTTPS POST
────────────────────────────────────────────────────────────────
POST /api/v1/market-data HTTP/1.1
Host: <railway-app>.railway.app
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "terminal_id": "push_worker_v5",
  "timestamp": 1751500800,
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "open": 2382.14, "high": 2383.02, "low": 2381.55, "close": 2382.77, "volume": 214,
  "best_fit_horiz_high_map": 2383.40, "best_fit_horiz_low_map": 2381.10,
  "best_fit_ssa": 2382.61, "best_fit_ema_ssa": 2382.58, "best_fit_crossing": 0,
  "best_fit_base_fl": 2382.55, "best_fit_uoedt": 2384.20, "best_fit_loedt": 2380.90,
  "cherry_a_horiz_high_map": null, "cherry_a_ssa": null, "...": "(remaining 5 variants, mostly null if inactive)",
  "fractal_best_fl": null, "best_resistance": 2385.00, "best_support": 2379.50,
  "body_direction": 1, "body_size": 0.42, "body_classification": 2,
  "zigzag_point_type": null, "zigzag_current_point": null,
  "cycle_id": 88123, "collected_at": 1751500805, "calculated_at": 1751500805
}


Step 2: Gateway validates
────────────────────────────────────────────────────────────────
✓ API Key authentication (ApiKeyGuard)
✓ Rate limit check (ThrottlerGuard)
✓ DTO validation (class-validator, against the 79-field contract)
✓ Business logic validation (ValidationService — §2.1)
  - Symbol/timeframe match contract
  - OHLC relationships valid
  - Timestamp within range
  - Derived-field nullability/enum conformance


Step 3: Add to Bull Queue (Railway Redis)
────────────────────────────────────────────────────────────────
await queue.add('process', data, {
  jobId: 'XAUUSD_M5_1751500800',   // matches the contract's idempotency key exactly
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});


Step 4: Return response to the sender
────────────────────────────────────────────────────────────────
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "queued",
  "jobId": "XAUUSD_M5_1751500800",
  "processingTime": 3
}

The Push Worker uses this 200 to stamp market_data.synced_at locally (§3.2 of
the companion blueprint) — this response is part of the contract, not just a
courtesy.


Step 5: Bull Queue Consumer drains to this Gateway's own downstream
────────────────────────────────────────────────────────────────
Out of scope for this document (§1.3) — whatever product owns this
consumer should specify its own storage/processing here.
```

### 3.2 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Error Type: Invalid Data                                     │
├─────────────────────────────────────────────────────────────┤
│ Location: Gateway (ValidationService)                        │
│ Action:                                                       │
│   1. Reject immediately with 400 Bad Request                 │
│   2. Return detailed error message                            │
│   3. Log validation failure                                  │
│   4. Does NOT reach queue                                    │
│                                                               │
│ Response:                                                     │
│   { "statusCode": 400, "message": "Invalid OHLC: high < low", "error": "Bad Request" } │
│                                                               │
│ Sender action (already built — see companion blueprint §8.3): │
│   Push Worker quarantines the row to rejected_rows.jsonl AND  │
│   still stamps synced_at (poison-row guard against infinite   │
│   retry); replayed later via replay_quarantine.py once fixed. │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Error Type: Rate Limit Exceeded                              │
├─────────────────────────────────────────────────────────────┤
│ Location: Gateway (ThrottlerGuard)                            │
│ Action: reject 429, Retry-After header                        │
│ Sender action: honor Retry-After (already built into the       │
│   Push Worker's retry logic)                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Error Type: Auth Failure                                      │
├─────────────────────────────────────────────────────────────┤
│ Location: Gateway (ApiKeyGuard)                                │
│ Action: reject 401/403                                         │
│ Sender action: halt entirely — this needs an operator, not a  │
│   retry loop (an expired/rotated key won't fix itself)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Error Type: Gateway Down / 5xx / Timeout                       │
├─────────────────────────────────────────────────────────────┤
│ Location: Push Worker → Gateway connection                    │
│ Sender action: retry with backoff (already built into the      │
│   Push Worker). No SQLite-fallback-on-the-sending-side is      │
│   needed here — market_data itself already IS that durable     │
│   local store (§5.2 of the companion blueprint): unsynced rows │
│   simply remain unsynced and are retried on the worker's own    │
│   normal cadence until this Gateway is reachable again.         │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 On performance claims

The prior draft included a latency/throughput comparison table here (Direct Redis vs. API Gateway, with specific millisecond and percentage figures). Those figures were estimates for a 15-symbol, ~500-1000-jobs/second scenario and have no valid restatement for this pipeline's actual load — one POST every 5-15 minutes per timeframe, two timeframes. At that volume, gateway-side validation overhead (single-digit milliseconds) is immaterial next to the 60-second collection cadence it sits inside, and asserting a specific number here would be fabricating precision this system doesn't need and hasn't measured. If performance ever becomes a real question — e.g. if this Gateway's sender population grows well beyond the current single VPS — measure it against production traffic at that point rather than trusting a number carried over from a different system.

---

## 4. API Specifications

### 4.1 Endpoint: Publish Market Data

**POST** `/api/v1/market-data`

#### Request Headers

```
Authorization: Bearer {API_KEY}        [Required]
Content-Type: application/json         [Required]
```

`terminal_id` (sender identity) travels in the request **body**, per `gateway_contract_market_data.schema.json` — not as a header. There is no EA-version header in this contract.

#### Request Body

Full 79-field example (values illustrative). Reference: `gateway_contract_market_data.schema.json`.

```json
{
  "terminal_id": "push_worker_v5",
  "timestamp": 1751500800,
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "open": 2382.14,
  "high": 2383.02,
  "low": 2381.55,
  "close": 2382.77,
  "volume": 214,

  "best_fit_horiz_high_map": 2383.4,
  "best_fit_horiz_low_map": 2381.1,
  "best_fit_ssa": 2382.61,
  "best_fit_ema_ssa": 2382.58,
  "best_fit_crossing": 0,
  "best_fit_base_fl": 2382.55,
  "best_fit_uoedt": 2384.2,
  "best_fit_loedt": 2380.9,

  "cherry_a_horiz_high_map": null,
  "cherry_a_horiz_low_map": null,
  "cherry_a_ssa": null,
  "cherry_a_ema_ssa": null,
  "cherry_a_crossing": null,
  "cherry_a_base_fl": null,
  "cherry_a_uoedt": null,
  "cherry_a_loedt": null,

  "cherry_b_horiz_high_map": null,
  "cherry_b_horiz_low_map": null,
  "cherry_b_ssa": null,
  "cherry_b_ema_ssa": null,
  "cherry_b_crossing": null,
  "cherry_b_base_fl": null,
  "cherry_b_uoedt": null,
  "cherry_b_loedt": null,

  "most_recent_horiz_high_map": null,
  "most_recent_horiz_low_map": null,
  "most_recent_ssa": null,
  "most_recent_ema_ssa": null,
  "most_recent_crossing": null,
  "most_recent_base_fl": null,
  "most_recent_uoedt": null,
  "most_recent_loedt": null,

  "non_a_horiz_high_map": null,
  "non_a_horiz_low_map": null,
  "non_a_ssa": null,
  "non_a_ema_ssa": null,
  "non_a_crossing": null,
  "non_a_base_fl": null,
  "non_a_uoedt": null,
  "non_a_loedt": null,

  "non_b_horiz_high_map": null,
  "non_b_horiz_low_map": null,
  "non_b_ssa": null,
  "non_b_ema_ssa": null,
  "non_b_crossing": null,
  "non_b_base_fl": null,
  "non_b_uoedt": null,
  "non_b_loedt": null,

  "fractal_best_fl": null,
  "fractal_uoedt": null,
  "fractal_loedt": null,
  "best_resistance": 2385.0,
  "best_support": 2379.5,

  "body_direction": 1,
  "body_size": 0.42,
  "body_classification": 2,

  "zigzag_point_type": null,
  "zigzag_current_point": null,
  "zigzag_price_change": null,
  "zigzag_pct_change": null,
  "zigzag_pct_change_class": null,
  "zigzag_bars": null,
  "zigzag_bars_class": null,
  "zigzag_price_per_bar": null,
  "zigzag_price_per_bar_class": null,
  "zigzag_slope": null,
  "zigzag_category": null,

  "cycle_id": 88123,
  "collected_at": 1751500805,
  "calculated_at": 1751500805
}
```

#### Response (200 OK)

```json
{
  "status": "queued",
  "jobId": "XAUUSD_M5_1751500800",
  "processingTime": 3
}
```

#### Error Responses

**400 Bad Request** — Invalid data

```json
{
  "statusCode": 400,
  "message": "Invalid OHLC: high cannot be less than low",
  "error": "Bad Request"
}
```

**401 Unauthorized** — Missing or invalid API key

```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "error": "Unauthorized"
}
```

**429 Too Many Requests** — Rate limit exceeded

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 60 seconds",
  "error": "Too Many Requests"
}
```

**5xx** — Transient failure; sender retries with backoff (no fixed `retryAfter` contract beyond honoring `Retry-After` where present).

### 4.2 Endpoint: Health Check

**GET** `/api/v1/health`

#### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-07-04T10:30:00Z",
  "services": {
    "redis": { "status": "up", "latency": 1 },
    "queue": {
      "status": "up",
      "waiting": 2,
      "active": 0,
      "completed": 8391,
      "failed": 0
    }
  },
  "uptime": 86400
}
```

Note the removed `database` check from the prior draft: this Gateway's own downstream store is out of scope for this document (§1.3) — if the product that owns that downstream wants a combined health check, it should add its own check here, not inherit one assumed by this document.

### 4.3 Endpoint: Queue Stats

**GET** `/api/v1/queue/stats`

#### Response (200 OK)

```json
{
  "queue": "market-data-sync",
  "jobs": {
    "waiting": 2,
    "active": 0,
    "completed": 8391,
    "failed": 0,
    "delayed": 0,
    "paused": 0
  }
}
```

The prior draft's `throughput`/`latency` blocks here (`lastMinute: 847`, percentile latencies) assumed a high-volume, multi-symbol system; at this pipeline's actual cadence (at most a handful of jobs per 5-15 minutes), per-minute/per-hour throughput counters would mostly read zero and aren't worth the added state to compute — job counts by state (above) are sufficient to tell whether the queue is healthy.

---

## 5. Security & Authentication

### 5.1 API Key Management

#### Key Format

This pipeline has at most two senders — the Push Worker and, optionally, the legacy Relay — both running from the single Contabo VPS, not a fleet of per-terminal keys. The key format still identifies the sender, just with a much smaller namespace than the prior draft's per-terminal scheme:

```
{sender}_{random_hash}

Examples:
push_worker_v5_a7b3c9d2e5f1g8h4i6j7k9l0m1n3o5p7
mt5_relay_v2_29_b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6
```

#### Key Storage (Environment Variables)

```bash
# Railway Environment Variables
API_KEYS=push_worker_v5_abc...,mt5_relay_v2_29_def...
```

#### Key Rotation Strategy

1. **Generate new keys on a fixed schedule** (quarterly is a reasonable default, not a hard requirement at this sender count)
2. **Maintain 2 active keys per sender** during rotation (old + new)
3. **Grace period**: enough for one full deploy cycle of the Push Worker/Relay to pick up the new key
4. **Revocation**: immediate via environment variable update

### 5.2 Rate Limiting Strategy

#### Tiered Rate Limits

```typescript
// Per API Key
const rateLimits = {
  tier1: { requests: 60, window: 60 }, // 1 req/sec
  tier2: { requests: 100, window: 60 }, // 1.67 req/sec
  tier3: { requests: 200, window: 60 }, // 3.33 req/sec
};

// Per IP (additional layer)
const ipRateLimit = { requests: 300, window: 60 };
```

#### Implementation

```typescript
// src/config/throttler.config.ts
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';

export const throttlerConfig: ThrottlerModuleOptions = {
  storage: new ThrottlerStorageRedisService({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: 4,
  }),
  throttlers: [
    {
      name: 'default',
      ttl: 60,
      limit: 100, // Base: 100 req/min
    },
    {
      name: 'strict',
      ttl: 60,
      limit: 60, // Strict: 60 req/min
    },
  ],
};
```

### 5.3 Request Validation Layers

```
Layer 1: Infrastructure (Railway)
─────────────────────────────────
- DDoS protection
- SSL/TLS termination
- IP allowlist/blocklist

Layer 2: NestJS Middleware
─────────────────────────────────
- CORS configuration
- Request size limits (1MB max)
- Content-Type validation
- Helmet.js security headers

Layer 3: Guards
─────────────────────────────────
- ApiKeyGuard (authentication)
- ThrottlerGuard (rate limiting)
- RolesGuard (future: per-terminal permissions)

Layer 4: Pipes & DTO
─────────────────────────────────
- class-validator (DTO validation)
- class-transformer (data transformation)
- Custom validation pipes

Layer 5: Business Logic
─────────────────────────────────
- ValidationService (domain rules)
- TransformationService (data enrichment)
```

### 5.4 Monitoring & Alerting

#### Metrics to Track

```typescript
// Prometheus metrics
import { Counter, Histogram, Gauge } from 'prom-client';

// Request metrics
const requestCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'endpoint', 'status'],
});

// Latency metrics
const requestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration',
  labelNames: ['method', 'endpoint'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Queue metrics
const queueSize = new Gauge({
  name: 'queue_jobs_waiting',
  help: 'Jobs waiting in queue',
});

// Error metrics
const errorCounter = new Counter({
  name: 'api_errors_total',
  help: 'Total API errors',
  labelNames: ['type', 'code'],
});
```

#### Alerts Configuration

```yaml
# alerts.yml (Prometheus AlertManager)
groups:
  - name: api_gateway
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value }} errors/sec'

      # API Gateway down
      - alert: APIGatewayDown
        expr: up{job="api-gateway"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'API Gateway is down'

      # Queue backup
      - alert: QueueBacklog
        expr: queue_jobs_waiting > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Queue backlog detected'
          description: '{{ $value }} jobs waiting'

      # High latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, api_request_duration_seconds) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High API latency (p95 > 100ms)'
```

---

## 6. On performance, throughput, and cost

The prior draft included dedicated Performance Analysis and Cost Analysis sections here — latency breakdowns, throughput comparisons, resource-usage tables, and monthly cost projections, all computed for a 15-symbol system processing roughly 500-1000 jobs/second. None of those figures have a valid restatement for this pipeline: at two timeframes and one validated cycle every 5-15 minutes, the actual load is several orders of magnitude below what those tables assumed, and Railway's own hobby-tier pricing for a single low-traffic NestJS service plus a small Redis instance is a matter of checking Railway's current pricing page at build time, not something worth projecting speculatively here months in advance.

If performance or cost ever becomes a real question for this Gateway — for instance, if its sender population grows beyond the current single VPS, or if its downstream product's own scale drives requirements back onto this ingest layer — measure against real production traffic at that point. A number carried over from a different system's assumptions is worse than no number at all, because it looks authoritative without being true.

---

## 7. Deployment & Rollout Guide

This replaces the prior draft's Migration Guide. There is no migration here — no existing Upstash/Direct-Redis system to move traffic off of, no fleet of terminals to cut over in phases. This is a first-time build and deploy of a new service. The phases below reflect that: build → deploy to a non-production environment → point one real sender at it → verify → go live.

### 7.1 Phase 1: Build

```bash
# New Railway project, or a new service within an existing one
railway init

npm install @nestjs/bull @nestjs/throttler @nestjs/config class-validator class-transformer

nest g module gateway
nest g controller gateway/market-data
nest g service gateway/validation
```

Generate (or hand-write, kept in lockstep) the DTO from `gateway_contract_market_data.schema.json` — see §2.1's note on codegen. Implement `ValidationService` and `MarketDataController` per §2.1-§2.2. Add `ApiKeyGuard` per §5.1.

### 7.2 Phase 2: Deploy to staging

```bash
railway add redis
railway env set REDIS_HOST=redis.railway.internal
railway env set REDIS_PORT=6379
railway env set API_KEYS=push_worker_v5_<generated>,mt5_relay_v2_29_<generated>

railway up --environment staging
```

### 7.3 Phase 3: Point one real sender at it

Configure the Push Worker's `API_GATEWAY_URL` (currently `https://your-api.railway.app` in `backfill_worker_api_gateway_v5.py`) to the staging URL, and run it against a small time window first rather than the full unsynced backlog — confirm a handful of real rows round-trip correctly (200 response, correct `jobId`, no validation errors against real data) before pointing it at the full backlog.

### 7.4 Phase 4: Verify

```
✓ Push Worker successfully posts and receives 200 for real rows
✓ Gateway logs show no unexpected 400s (a 400 on well-formed real data means
  the DTO has drifted from gateway_contract_market_data.schema.json — fix
  the DTO, don't work around it)
✓ Idempotent upsert confirmed: re-POSTing the same row does not create a
  duplicate on the downstream side
✓ 401/403, 429, and 5xx paths each manually exercised at least once
✓ Health check and queue-stats endpoints respond correctly
```

### 7.5 Phase 5: Go live

Point the Push Worker's production `API_GATEWAY_URL` at the production Railway deployment; if the Relay is in use, do the same for `mt5_api_relay_for_v2_29.py`'s `RAILWAY_URL`. No traffic-splitting or gradual-percentage rollout is needed at this sender count — there are at most two senders, and each can be switched over independently and verified individually.

### 7.6 Rollback

If the Gateway needs to come down for any reason after go-live, no explicit rollback procedure is required on the pipeline side: the Push Worker's normal behavior (§3.2 of this document, §6/§8.3 of the companion blueprint) already treats "Gateway unreachable" as an ordinary transient failure — unsynced rows simply accumulate in `xauusd.db` until the Gateway is reachable again. There is no separate fallback system to fail over to and nothing to revert.

---

## 8. Design Rationale

The prior draft's Decision Framework scored "Direct Redis" against "API Gateway" across weighted factors, aimed at helping a team decide which to build. That decision doesn't need making here — the sender was always going to POST HTTP to this Gateway's own endpoint (§1.2), not to a Redis instance directly, so there was never a live choice between the two for this system. Rather than keep a scoring exercise for an alternative that was never actually on the table, this section states directly why the design looks the way it does — which is the useful part of the original framework, without the artifact of comparing against something that isn't a real option.

**Why validate before queuing, rather than at the downstream consumer.** A malformed row is cheaper to reject at the door than to discover after it's been queued, retried three times, and finally failed. This matters more here than it would in a system without retries built in: the Push Worker's own retry/quarantine logic (companion blueprint §8.3) depends on getting an honest, immediate answer from this Gateway about whether a row was accepted.

**Why idempotent upsert on `(symbol, timeframe, timestamp)`**, rather than treating duplicate delivery as an error. The Push Worker retries deliberately and by design (network failures, timeouts) — duplicate delivery is the expected case, not an edge case, so the Gateway's contract has to make re-sending the same row safe rather than something the sender has to avoid.

**Why a queue between ingest and the downstream consumer**, rather than writing synchronously in the request handler. This decouples the Gateway's own availability from its downstream's — if the downstream store is briefly unavailable, the Gateway can still accept and acknowledge rows, and the queue absorbs the gap. This also happens to be the one piece of this design genuinely inherited from the prior draft's reasoning, and it still holds regardless of what schema flows through it.

**Why this document treats the Gateway's own downstream as out of scope (§1.3)**, rather than specifying a store. This pipeline's job ends at "the Gateway accepted and will deliver this row" — what "deliver" means concretely (which product, which store, TypeORM vs. something else) is a decision that belongs to whoever owns that consumer, and this document shouldn't make it on their behalf, especially since the prior draft's answer to that question (a 15-table, per-symbol Postgres schema) was itself specific to a system this pipeline isn't.

---

## 9. Implementation Examples

### 9.1 Complete Gateway Setup

```typescript
// ===================================================================
// FILE: src/main.ts
// ===================================================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  // Performance
  app.use(compression());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Gateway running on port ${port}`);
  logger.log(`📊 Environment: ${process.env.NODE_ENV}`);
}

bootstrap();

// ===================================================================
// FILE: src/app.module.ts
// ===================================================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { GatewayModule } from './gateway/gateway.module';
import { WorkerModule } from './worker/worker.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),

    // Redis (all connections)
    RedisModule.forRoot({
      config: [
        {
          namespace: 'default',
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          db: 0,
        },
        {
          namespace: 'queue',
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          db: 1,
        },
      ],
    }),

    // Bull Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        db: 1,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),

    // Downstream store — shown here only as an illustrative placeholder.
    // What this actually is belongs to whoever owns the Gateway's own
    // downstream product (§1.3); TypeORM/Postgres is one plausible choice,
    // not a requirement of this document.
    // TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, ... }),

    // Feature modules
    GatewayModule,
    WorkerModule,
    HealthModule,
  ],
})
export class AppModule {}

// ===================================================================
// FILE: railway.toml
// ===================================================================
[build];
builder = 'nixpacks'[[services]];
name = 'gateway';
command = 'npm run start:prod'[services.environment];
NODE_ENV = 'production';
PORT = '3000'[[services]];
name = 'worker';
command = 'npm run start:worker'[services.environment];
NODE_ENV = 'production'[[services]];
name = 'redis';
type = 'redis';
plan = 'hobby';
```

One worker service is sufficient at this pipeline's actual volume — the prior draft's two-worker setup assumed throughput this system doesn't have. Add more only if the Gateway's own downstream product's needs (out of scope here) require it.

### 9.2 Complete Worker Setup

The prior draft's worker batched up to 50 bars before writing, which made sense at its assumed throughput (hundreds of jobs/second across 15 symbols) and makes no sense here — at this pipeline's actual cadence (one job per timeframe every 5-15 minutes), a batch of 50 would sit unflushed for hours, which defeats the purpose of a queue consumer entirely. The corrected version processes and writes each job as it arrives instead:

```typescript
// ===================================================================
// FILE: src/worker/worker.module.ts
// ===================================================================
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataProcessor } from './market-data.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'market-data-sync',
    }),
  ],
  providers: [MarketDataProcessor],
})
export class WorkerModule {}

// ===================================================================
// FILE: src/worker/market-data.processor.ts
// ===================================================================
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('market-data-sync')
export class MarketDataProcessor {
  private readonly logger = new Logger(MarketDataProcessor.name);

  // Concurrency of 1 is deliberate, not an oversight: at this volume there
  // is no throughput reason to process jobs in parallel, and doing so only
  // adds a class of ordering bugs (e.g. an M15 row processed before the M5
  // row it depends on for a shared computation) that a single worker avoids
  // by construction.
  @Process({ concurrency: 1 })
  async process(job: Job) {
    // Hand off to whatever this Gateway's own downstream product actually
    // is (§1.3) — a single-row upsert, not a batch flush. What that
    // hand-off looks like (a repository call, a second queue, an external
    // API) is that product's decision, not this pipeline's.
    return { success: true };
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing: ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Completed: ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Failed: ${job.id} after ${job.attemptsMade} attempts`,
      error
    );
  }
}
```

### 9.3 Complete Monitoring Setup

The `checkDatabase`/`InjectDataSource` portion below is illustrative of the pattern only — whether there's a database to check at all depends on what the Gateway's own downstream product turns out to be (§1.3, §8). Drop it if there isn't one; the `redis`/`queue` checks are the ones this document actually specifies.

```typescript
// ===================================================================
// FILE: src/health/health.controller.ts
// ===================================================================
import { Controller, Get } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  @Get()
  async check() {
    const [redisHealth, queueHealth, dbHealth] = await Promise.all([
      this.checkRedis(),
      this.checkQueue(),
      this.checkDatabase(),
    ]);

    const isHealthy =
      redisHealth.status === 'up' &&
      queueHealth.status === 'up' &&
      dbHealth.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth,
        queue: queueHealth,
        database: dbHealth,
      },
      uptime: process.uptime(),
    };
  }

  private async checkRedis() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'up',
        latency,
        memory: await this.redis.info('memory'),
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkQueue() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);

      return {
        status: 'up',
        waiting,
        active,
        completed,
        failed,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - start;

      return {
        status: 'up',
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }
}
```

---

## Appendix A: Environment Variables Reference

```bash
# ===================================================================
# Railway Environment Variables - Gateway Service
# ===================================================================

# Server
NODE_ENV=production
PORT=3000

# Redis Connection
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=generated_by_railway

# Downstream store connection — only if the Gateway's own downstream
# product (§1.3) actually has one; not assumed by this document.
# DATABASE_URL=postgresql://...

# Authentication — one key per sender (Push Worker, optionally Relay); see §5.1
API_KEYS=push_worker_v5_abc...,mt5_relay_v2_29_def...

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info

# CORS — only relevant if this Gateway is ever called from a browser;
# it isn't, today (its only callers are the Push Worker and Relay, both
# server-side) — included here as a placeholder, not a requirement.
# ALLOWED_ORIGINS=

# ===================================================================
# Railway Environment Variables - Worker Service
# ===================================================================

NODE_ENV=production

# Redis Connection (same as Gateway)
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=generated_by_railway

# Monitoring (same as Gateway)
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
```

---

## Appendix B: API Key Generation Script

```typescript
// scripts/generate-api-key.ts
import * as crypto from 'crypto';

interface ApiKeyOptions {
  sender: string; // e.g. "push_worker_v5", "mt5_relay_v2_29"
  length?: number;
}

function generateApiKey(options: ApiKeyOptions): string {
  const { sender, length = 32 } = options;
  const randomBytes = crypto.randomBytes(length);
  const hash = randomBytes.toString('hex');
  return `${sender}_${hash}`;
}

// Usage — this pipeline has at most two senders, not a fleet
const apiKeys = [
  generateApiKey({ sender: 'push_worker_v5' }),
  generateApiKey({ sender: 'mt5_relay_v2_29' }),
];

console.log('Generated API Keys:\n');
apiKeys.forEach((key) => console.log(key));

console.log('\n\nAdd to Railway Environment Variables:');
console.log(`API_KEYS=${apiKeys.join(',')}`);
```

---

## Document Metadata

- **Version:** 2.0 (revision of the original 1.0 draft)
- **Status:** Development blueprint — build spec for the Gateway component of the v6 XAUUSD pipeline
- **Complementary document:** `MT5_to_LightweightCharts_Architecture_Blueprint.md`
- **Prior version:** Written against a different, superseded design (15 symbols, 5 MT5 terminals, EA v2.24, a Direct-Redis-vs-API-Gateway comparison); this revision replaces that scope entirely rather than layering corrections on top of it.

---

## Conclusion

This document specifies one component — the Railway Gateway's ingest layer — of the v6 XAUUSD pipeline described in full in `MT5_to_LightweightCharts_Architecture_Blueprint.md`. It is deliberately narrow in scope (§1.3): it covers how a validated `market_data` row gets from the Push Worker/Relay into this Gateway, correctly and idempotently, and explicitly does not cover what happens to that row afterward, since that belongs to whichever product consumes this Gateway's output. The design choices that survived from the original draft (module structure, guards, queue pattern, idempotency contract, monitoring) did so because they don't depend on the schema or scale assumptions that made the rest of that draft stale — see §8 for why each one holds regardless.

---

**END OF DOCUMENT**
