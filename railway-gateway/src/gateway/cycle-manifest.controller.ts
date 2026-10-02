import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { validateCycleManifest } from '../cycle/cycle-manifest.contract';
import { MANIFEST_THRESHOLDS } from '../cycle/manifest-thresholds';
import {
  CYCLE_MANIFEST_JOB,
  MARKET_DATA_QUEUE,
  manifestJobId,
} from '../worker/cycle-queues';
import { CycleManifestJobData } from '../worker/cycle-manifest.service';

/**
 * The cycle manifest (STACK-D-ARCHITECTURE.md section 1.4 item 2, ADR-009): ONE
 * object per 5-minute slot, sent by the push worker after the slot's newest bars.
 * Contract: gateway_contract_cycle_manifest.schema.json (copied into this package).
 *
 * This endpoint only validates and queues, like every other lane. The checking
 * (did the rows land?), the market_cycles write and the ready signal happen in
 * the queue, behind the row jobs; see CycleManifestService.
 *
 * Answers, and what the sender does with each:
 *   200  accepted, including a repeat of a manifest already accepted (the sender
 *        retries until it is acknowledged, so a repeat is normal and must not
 *        create a second row or a second job);
 *   400  the body does not match the contract: the sender quarantines the
 *        manifest and never resends it, so this is reserved for a body that
 *        resending cannot fix;
 *   401  no or wrong API key; 429 throttled; 5xx and 404: retried, never lost.
 *
 * ThrottlerGuard is applied globally via APP_GUARD in app.module.ts; only the
 * API-key check is local to this controller.
 */
@Controller('api/v1/cycle-manifest')
@UseGuards(ApiKeyGuard)
export class CycleManifestController {
  private readonly logger = new Logger(CycleManifestController.name);

  constructor(@InjectQueue(MARKET_DATA_QUEUE) private readonly queue: Queue) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // `unknown`, deliberately: the global ValidationPipe cannot validate a plain
  // object (it skips Object metatypes), and the contract is the single source of
  // truth for the shape, run through Ajv below rather than restated in decorators.
  async publishManifest(@Body() body: unknown) {
    const result = validateCycleManifest(body);
    if (!result.valid) {
      this.logger.warn(`Manifest rejected: ${result.errors.join('; ')}`);
      throw new BadRequestException(result.errors);
    }
    const { manifest } = result;

    const nowSec = Math.floor(Date.now() / 1000);
    if (manifest.slot > nowSec + MANIFEST_THRESHOLDS.futureSlotToleranceSec) {
      // Not a clock difference of a few seconds: a manifest for a slot that has
      // not happened. Nothing downstream can do anything sensible with it.
      throw new BadRequestException([
        `slot ${manifest.slot} is more than ${MANIFEST_THRESHOLDS.futureSlotToleranceSec} s ahead of the gateway clock`,
      ]);
    }

    // Idempotent on (symbol, slot): the same job id for a repeat, which Bull
    // ignores while the first is still known. The processor is idempotent too,
    // for the case where it is not.
    const data: CycleManifestJobData = { manifest, receivedAt: nowSec };
    const job = await this.queue.add(CYCLE_MANIFEST_JOB, data, {
      jobId: manifestJobId(manifest.symbol, manifest.slot),
    });

    this.logger.log(
      `Manifest queued: ${manifest.symbol} slot ${manifest.slot} | Job ID: ${String(job.id)}`
    );
    return {
      status: 'queued',
      slot: manifest.slot,
      jobId: String(job.id),
    };
  }
}
