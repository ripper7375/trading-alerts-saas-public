import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ActiveIndicatorService } from '../cycle/active-indicator/active-indicator.service';
import { isTimeframe } from '../cycle/slot';
import { SetActiveIndicatorDto } from './dto/active-indicator.dto';

/**
 * The write path of the active-indicator setting (rule 6, ADR-010): an append-only,
 * audited setting per timeframe, effective from a named future slot.
 *
 * Called by the monolith's admin route, which has already checked that the caller
 * is an administrator and passes who it is in `setBy`; this endpoint trusts the
 * service key and records what it is told. The rules that do not depend on who
 * asks (a future slot on a boundary, not a week ahead, a real source) are the
 * service's and are enforced here for every caller.
 *
 * Same API key as the other lanes (see the part 6 hand-off on whether writes
 * should get a key of their own). ThrottlerGuard is applied globally.
 */
@Controller('api/v1/active-indicator')
@UseGuards(ApiKeyGuard)
export class ActiveIndicatorController {
  private readonly logger = new Logger(ActiveIndicatorController.name);

  constructor(private readonly indicators: ActiveIndicatorService) {}

  /** The audit trail (newest effective slot first) and the earliest slot a new setting may name. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Query('timeframe') timeframe?: string,
    @Query('limit') limit?: string
  ) {
    if (timeframe !== undefined && !isTimeframe(timeframe)) {
      throw new BadRequestException(['timeframe must be M5 or M15']);
    }
    const now = Math.floor(Date.now() / 1000);
    const settings = await this.indicators.listSettings({
      timeframe,
      limit: limit === undefined ? undefined : Number(limit),
    });
    return {
      now,
      earliestSettableSlot: await this.indicators.earliestSettableSlot(now),
      settings,
    };
  }

  @Post()
  async set(@Body() body: SetActiveIndicatorDto) {
    const result = await this.indicators.setActiveIndicator({
      timeframe: body.timeframe,
      source: body.source,
      effectiveSlot: body.effectiveSlot,
      setBy: body.setBy,
      reason: body.reason ?? null,
    });
    if (result.status === 'REFUSED') {
      this.logger.warn(
        `Active indicator change refused (${result.reason}): ${result.detail}`
      );
      throw new BadRequestException({
        status: 'REFUSED',
        reason: result.reason,
        detail: result.detail,
      });
    }
    return result;
  }
}
