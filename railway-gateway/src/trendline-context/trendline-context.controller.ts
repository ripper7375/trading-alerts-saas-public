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
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { TrendlinePolicySessionDto } from './dto/trendline-policy-session.dto';
import {
  TRENDLINE_POLICY_JOB,
  TRENDLINE_POLICY_QUEUE,
  trendlinePolicyJobId,
} from './trendline-context.keys';

/**
 * Layer 1 (policy) ingestion: one analyst "Publish" click, forwarded by the
 * VPS uploader from a TrendlineScreenshotAndLabelExport_v2_29.mq5 sidecar.
 * TRENDLINE-CONTEXT-BLUEPRINT.md has the full contract.
 *
 * Exists only when TrendlineContextModule.register() turns it on
 * (TRENDLINE_CONTEXT_ENABLED=true); otherwise this route does not exist at
 * all (404), the same off-means-gone discipline SensorsModule uses.
 *
 * The body is the WHOLE session (the analyst's lines plus the overview
 * note) in one POST, not one line at a time: a Publish is one atomic unit,
 * and the processor writes it as one Prisma transaction so a partial
 * session (some lines written, some not) can never be read back.
 *
 * Answers: 200 accepted (including a repeat of a session already accepted
 * -- the uploader may retry, so a repeat is normal); 400 a body the
 * contract refuses; 401 no or wrong API key; 429 throttled.
 */
@Controller('api/v1/trendline-context')
@UseGuards(ApiKeyGuard)
export class TrendlineContextController {
  private readonly logger = new Logger(TrendlineContextController.name);

  constructor(
    @InjectQueue(TRENDLINE_POLICY_QUEUE) private readonly queue: Queue
  ) {}

  @Post('policy')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async publishPolicy(@Body() data: TrendlinePolicySessionDto) {
    const startTime = Date.now();
    const jobId = trendlinePolicyJobId(data.symbol, data.published_at);
    const job = await this.queue.add(TRENDLINE_POLICY_JOB, data, { jobId });

    this.logger.log(
      `Queued trendline policy session ${data.symbol}@${data.published_at} ` +
        `(${data.lines.length} line(s)) | jobId=${job.id} | Duration: ${Date.now() - startTime}ms`
    );

    return { queued: 1, lineCount: data.lines.length, jobId: String(job.id) };
  }
}
