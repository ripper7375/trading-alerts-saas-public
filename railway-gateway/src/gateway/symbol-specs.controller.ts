import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseArrayPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { SymbolSpecDto } from './dto/symbol-spec.dto';
import {
  SYMBOL_SPECS_JOB,
  SYMBOL_SPECS_QUEUE,
  symbolSpecJobId,
} from '../symbol-specs/symbol-specs.keys';

/**
 * Append-only broker symbol figures (ADR-066, STACK-D-ARCHITECTURE.md section
 * 6.9): contract size, volume limits, tick size, typical spread, swaps.
 *
 * A fourth stream, separate from the market data, statistics and economic
 * calendar controllers in every respect: its own route, queue, processor and
 * outbox on the sender, so a failure here can never affect price ingestion.
 * Contract: gateway_contract_symbol_specs.schema.json.
 *
 * The body is an ARRAY, like the economic calendar's, but a day normally yields
 * ONE element (plus one when a contract figure changes). One queue job per
 * element, so idempotency is per observation.
 *
 * Answers, and what the sender does with each:
 *   200  accepted, including a repeat of an observation already accepted (the
 *        sender retries until it is acknowledged, so a repeat is normal);
 *   400  a body the contract refuses: the sender quarantines it and never
 *        resends it, so this is reserved for a body that resending cannot fix;
 *   401  no or wrong API key; 429 throttled; 404 and 5xx: retried, never lost.
 *
 * ThrottlerGuard is applied globally via APP_GUARD in app.module.ts; only the
 * API-key check is local to this controller.
 */
@Controller('api/v1/symbol-specs')
@UseGuards(ApiKeyGuard)
export class SymbolSpecsController {
  private readonly logger = new Logger(SymbolSpecsController.name);

  constructor(@InjectQueue(SYMBOL_SPECS_QUEUE) private readonly queue: Queue) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async publishSpecs(
    // whitelist/forbidNonWhitelisted must be passed EXPLICITLY here.
    // ParseArrayPipe builds its own internal ValidationPipe and does NOT
    // inherit the global one configured in main.ts: without these, an unknown
    // field is silently accepted. (The same 200-instead-of-400 gap was found on
    // the indicator-statistics endpoint; it is covered by a test here too.)
    @Body(
      new ParseArrayPipe({
        items: SymbolSpecDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    items: SymbolSpecDto[]
  ) {
    const startTime = Date.now();
    const jobIds: string[] = [];

    for (const data of items) {
      // The same pair the table is unique on: a push retry re-delivers the same
      // key, a new observation of the symbol is a different one.
      const jobId = symbolSpecJobId(data.symbol, data.captured_at);
      const job = await this.queue.add(SYMBOL_SPECS_JOB, data, { jobId });
      jobIds.push(String(job.id));
    }

    this.logger.log(
      `Queued ${items.length} symbol spec(s) | Duration: ${Date.now() - startTime}ms`
    );

    return { queued: items.length, jobIds };
  }
}
