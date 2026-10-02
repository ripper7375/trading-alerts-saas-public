import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ActiveIndicatorService } from '../cycle/active-indicator/active-indicator.service';
import {
  CurrentCycleBody,
  buildCurrentCycleBody,
  resolutionSlot,
} from '../cycle/active-indicator/current-cycle';
import { MANIFEST_THRESHOLDS } from '../cycle/manifest-thresholds';
import { CycleReaderService } from '../cycle/read/cycle-reader.service';
import { isSlot } from '../cycle/slot';

/**
 * GET /api/v1/cycles/current: the newest READY cycle, what a reader may trust now,
 * and the active indicators in force at that cycle's slot (rules 6 and 7).
 *
 * The one read endpoint every consumer outside the gateway calls (the monolith's
 * channel route and chart overlay, the VPS renderer). It answers from the same
 * functions the sensor worker uses in process, so a consumer cannot see a
 * different setting than the sensors for the same slot. ADR decision (build step 2
 * part 5, option a): the monolith calls the gateway instead of re-implementing the
 * readers.
 *
 * Same API key as the other lanes. ThrottlerGuard is applied globally.
 */
@Controller('api/v1/cycles')
@UseGuards(ApiKeyGuard)
export class CyclesController {
  constructor(
    private readonly cycles: CycleReaderService,
    private readonly indicators: ActiveIndicatorService
  ) {}

  @Get('current')
  // The answer is only true for the moment it was given.
  @Header('Cache-Control', 'no-store')
  async current(@Query('slot') slotParam?: unknown): Promise<CurrentCycleBody> {
    const now = Math.floor(Date.now() / 1000);
    const requestedSlot = parseRequestedSlot(slotParam, now);
    const cycle = await this.cycles.getNewestReadyCycle();
    const { slot } = resolutionSlot(now, cycle, requestedSlot);
    const indicators = await this.indicators.resolveAll(slot);
    return buildCurrentCycleBody({ now, cycle, indicators, requestedSlot });
  }
}

/**
 * The optional `?slot=`: the slot the caller is working on. Strict, because a wrong
 * slot is a valid slot that quietly answers a different question: digits only, a
 * slot boundary, and not further ahead than a clock difference between the VPS and
 * this gateway can explain.
 */
export function parseRequestedSlot(value: unknown, now: number): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) {
    throw new BadRequestException([
      'slot must be a unix time in whole seconds',
    ]);
  }
  const slot = Number(value);
  if (!isSlot(slot)) {
    throw new BadRequestException(['slot must be on a 5-minute boundary']);
  }
  if (slot > now + MANIFEST_THRESHOLDS.futureSlotToleranceSec) {
    throw new BadRequestException([
      `slot ${slot} is more than ${MANIFEST_THRESHOLDS.futureSlotToleranceSec} s ahead of the gateway clock`,
    ]);
  }
  return slot;
}
