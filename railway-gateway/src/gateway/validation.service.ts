import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MarketDataDto } from './dto/market-data.dto';

/**
 * Validation layers per the build doc's §2.1. Deliberately narrower than the
 * pipeline's own collector-side validation (cross-source key agreement,
 * ZigZag-as-subset, completeness) — that already happened upstream, against
 * sources this Gateway never sees. This confirms the payload is well-formed
 * and matches the contract; it does not re-derive market-data correctness.
 */
@Injectable()
export class ValidationService {
  constructor(@InjectQueue('market-data-sync') private readonly queue: Queue) {}

  async validate(data: MarketDataDto): Promise<void> {
    this.validateSymbol(data.symbol);
    this.validateOHLC(data);
    this.validateTimestamp(data.timestamp);
    this.validateDerivedFieldConformance(data);
    this.validateCandleProportions(data);
    this.validateVolume(data);
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
    if (data.high < data.low) {
      throw new BadRequestException(
        `Invalid OHLC: high (${data.high}) cannot be less than low (${data.low})`
      );
    }
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
    if (data.open <= 0 || data.high <= 0 || data.low <= 0 || data.close <= 0) {
      throw new BadRequestException('All OHLC prices must be positive');
    }
  }

  private validateTimestamp(timestamp: number): void {
    const now = Date.now() / 1000;
    const maxAge = 86400 * 7; // 7 days
    const futureTolerance = 300; // 5 minutes

    if (timestamp > now + futureTolerance) {
      const diff = Math.floor(timestamp - now);
      throw new BadRequestException(
        `Timestamp is ${diff} seconds in the future (max: ${futureTolerance}s). Check MT5 terminal clock sync.`
      );
    }
    if (timestamp < now - maxAge) {
      const daysOld = Math.floor((now - timestamp) / 86400);
      throw new BadRequestException(
        `Timestamp is ${daysOld} days old (max: 7 days). Use backfill endpoint for historical data.`
      );
    }
    if (timestamp < 946684800) {
      throw new BadRequestException('Timestamp appears to be in wrong format or before year 2000');
    }
  }

  private validateDerivedFieldConformance(data: MarketDataDto): void {
    // Most fields are checked by the generated DTO's own decorators
    // (@IsIn/@IsInt/@IsNumber). The one cross-field constraint the DTO can't
    // express alone: a pivot type without a pivot price (or vice versa)
    // indicates a partially-populated row.
    const hasPivotType = data.zigzag_point_type !== undefined && data.zigzag_point_type !== null;
    const hasPivotPoint =
      data.zigzag_current_point !== undefined && data.zigzag_current_point !== null;
    if (hasPivotType !== hasPivotPoint) {
      throw new BadRequestException(
        'zigzag_point_type and zigzag_current_point must both be present or both be null — got one without the other.'
      );
    }
  }

  private validateCandleProportions(data: MarketDataDto): void {
    const range = data.high - data.low;
    const body = Math.abs(data.close - data.open);

    if (range === 0) {
      throw new BadRequestException(
        'Invalid candle: high equals low (zero range). Possible data freeze.'
      );
    }
    if (body > range * 100) {
      throw new BadRequestException(
        `Invalid candle proportions: body (${body.toFixed(5)}) exceeds range (${range.toFixed(5)}) by 100x. Possible flash crash or data corruption.`
      );
    }

    const avgPrice = (data.high + data.low) / 2;
    const spreadPercent = (range / avgPrice) * 100;
    if (spreadPercent < 0.0001) {
      throw new BadRequestException(
        `Spread too small: ${spreadPercent.toFixed(6)}% of price. Possible data precision error.`
      );
    }
    if (spreadPercent > 20) {
      throw new BadRequestException(
        `Spread too large: ${spreadPercent.toFixed(2)}% of price in one bar. Possible gap or data error.`
      );
    }
    if (body > range) {
      throw new BadRequestException(
        `Invalid candle: body (${body.toFixed(5)}) cannot exceed range (${range.toFixed(5)})`
      );
    }
  }

  private validateVolume(data: MarketDataDto): void {
    if (data.volume < 0) {
      throw new BadRequestException(`Volume cannot be negative: ${data.volume}`);
    }
    const MAX_VOLUME = 100_000_000;
    if (data.volume > MAX_VOLUME) {
      throw new BadRequestException(
        `Volume exceeds maximum threshold: ${data.volume} (max: ${MAX_VOLUME}). Possible data corruption.`
      );
    }
  }

  private async checkDuplicates(data: MarketDataDto): Promise<void> {
    const jobId = `${data.symbol}_${data.timeframe}_${data.timestamp}`;
    try {
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'waiting' || state === 'active') {
          throw new ConflictException(`Job already queued: ${jobId} (state: ${state})`);
        }
        if (state === 'completed') {
          const finishedAt = existingJob.finishedOn;
          const now = Date.now();
          if (finishedAt && now - finishedAt < 60_000) {
            throw new ConflictException(
              `Job recently completed: ${jobId} (${Math.floor((now - finishedAt) / 1000)}s ago)`
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // Redis/connection errors should not block ingestion — log and proceed.
      console.warn(`Duplicate check failed for ${jobId}:`, (error as Error).message);
    }
  }
}
