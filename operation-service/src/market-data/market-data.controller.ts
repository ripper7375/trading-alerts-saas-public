import {
  Controller,
  Get,
  HttpCode,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { channelQuerySchema, type Tier } from './market-data.schemas';
import { MarketDataService } from './market-data.service';
import type { ChannelQueryDto } from './dto/channel.dto';

/**
 * Market-data channel proxy — ports `app/api/market-data/channel/route.ts`
 * (125 lines) verbatim. Session 4B-12.
 *
 * L45 rule: `ZodValidationPipe` is applied at PARAMETER level only
 * (`@Query(new ZodValidationPipe(schema))`), matching Notifications'
 * established convention. This route has no `:id`/path param at all, so
 * L45's specific bug class doesn't apply here, but the parameter-level
 * convention is followed regardless for consistency with every other
 * ported controller.
 *
 * @module market-data/market-data.controller
 */
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @UseGuards(JwtAuthGuard)
  @Get('channel')
  @HttpCode(200)
  async getChannel(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(channelQuerySchema)) query: ChannelQueryDto
  ) {
    return this.marketDataService.getChannelData(
      request.user.tier as Tier,
      query.symbol,
      query.timeframe,
      query.variant,
      query.limit
    );
  }
}
