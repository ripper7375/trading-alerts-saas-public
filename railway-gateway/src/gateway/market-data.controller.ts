import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { MarketDataDto } from './dto/market-data.dto';
import { ValidationService } from './validation.service';

export const MARKET_DATA_MAX_BATCH_SIZE = 500;

export interface MarketDataBatchItemResult {
  index: number;
  status: 'queued' | 'rejected' | 'conflict';
  jobId?: string;
  error?: string;
}

// Shared ValidationPipe configuration matching main.ts so each row in a batch
// receives identical whitelist/forbidNonWhitelisted/implicit-conversion checks
// without a single bad element aborting the rest of the batch.
const ROW_VALIDATION_PIPE_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
} as const;

function extractHttpErrorMessage(error: HttpException): string {
  const response = error.getResponse();
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const msg = (response as { message: unknown }).message;
    if (Array.isArray(msg)) {
      return msg.map(String).join('; ');
    }
    if (msg !== undefined && msg !== null) {
      return String(msg);
    }
  }
  return error.message;
}

// ThrottlerGuard is applied globally via APP_GUARD in app.module.ts (so its
// dependencies resolve regardless of which module a controller lives in);
// only the API-key check is local to this controller.
@Controller('api/v1/market-data')
@UseGuards(ApiKeyGuard)
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);
  private readonly rowValidationPipe = new ValidationPipe(
    ROW_VALIDATION_PIPE_OPTIONS
  );

  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly validationService: ValidationService
  ) {}

  private async enqueueValidatedRow(data: MarketDataDto) {
    await this.validationService.validate(data);
    // Idempotency key matches the schema's upsert key exactly.
    const jobId = `${data.symbol}_${data.timeframe}_${data.timestamp}`;
    return this.queue.add('process', data, { jobId });
  }

  @Post()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async publishMarketData(@Body() data: MarketDataDto) {
    const startTime = Date.now();

    try {
      const job = await this.enqueueValidatedRow(data);
      const duration = Date.now() - startTime;
      this.logger.log(
        `Queued: ${data.symbol} ${data.timeframe} @ ${data.timestamp} | Job ID: ${job.id} | Duration: ${duration}ms`
      );

      // The Push Worker uses this 200 to stamp market_data.synced_at locally.
      return {
        status: 'queued',
        jobId: job.id,
        processingTime: duration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue: ${data.symbol} ${data.timeframe} @ ${data.timestamp}`,
        (error as Error).stack
      );
      throw error;
    }
  }

  /**
   * Batch ingest of market_data rows with per-row validation and quarantine
   * reporting. One invalid row produces `status: 'rejected'` at its index
   * instead of failing valid neighbors, matching the Push Worker's single-row
   * 400 quarantine guarantee while collapsing ~386 round trips into a few calls.
   */
  @Post('batch')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async publishMarketDataBatch(@Body() body: unknown) {
    if (!Array.isArray(body)) {
      throw new BadRequestException(
        'Request body must be an array of market_data rows'
      );
    }
    if (body.length > MARKET_DATA_MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch size ${body.length} exceeds maximum of ${MARKET_DATA_MAX_BATCH_SIZE} rows`
      );
    }

    const startTime = Date.now();
    const results: MarketDataBatchItemResult[] = [];
    let queued = 0;
    let rejected = 0;
    let conflicts = 0;

    for (let index = 0; index < body.length; index++) {
      const rawItem = body[index];
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        rejected += 1;
        results.push({
          index,
          status: 'rejected',
          error: 'Each batch item must be a JSON object',
        });
        continue;
      }

      try {
        const dto = (await this.rowValidationPipe.transform(rawItem, {
          type: 'body',
          metatype: MarketDataDto,
        })) as MarketDataDto;
        const job = await this.enqueueValidatedRow(dto);
        queued += 1;
        results.push({
          index,
          status: 'queued',
          jobId: String(job.id),
        });
      } catch (error) {
        if (error instanceof ConflictException) {
          conflicts += 1;
          results.push({
            index,
            status: 'conflict',
            error: extractHttpErrorMessage(error),
          });
        } else if (error instanceof BadRequestException) {
          rejected += 1;
          results.push({
            index,
            status: 'rejected',
            error: extractHttpErrorMessage(error),
          });
        } else {
          throw error;
        }
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Batch market_data: total=${body.length} queued=${queued} rejected=${rejected} conflicts=${conflicts} | Duration: ${duration}ms`
    );

    return {
      queued,
      rejected,
      conflicts,
      processingTime: duration,
      results,
    };
  }
}
