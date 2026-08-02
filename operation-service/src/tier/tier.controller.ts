import {
  Controller,
  Get,
  HttpCode,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { tierSymbolParamSchema, type Tier } from './tier.schemas';
import { TierService } from './tier.service';

/**
 * Ports `app/api/tier/{symbols,check/[symbol],combinations}/route.ts`
 * (387 lines total) verbatim. Session 4B-10.
 *
 * None of these 3 routes enforce tier gating (V8: FREE and PRO get
 * identical symbol/timeframe access) — `JwtAuthGuard` alone matches
 * SOURCE's own `getServerSession(authOptions)` + `session?.user?.id`
 * check. The reusable `TierGuard`/`@RequireTier()` built alongside this
 * controller (`../auth/tier.guard.ts`) is new infrastructure for FUTURE
 * tier-gated endpoints, not used by any handler here.
 *
 * @module tier/tier.controller
 */
@Controller('tier')
export class TierController {
  constructor(private readonly tierService: TierService) {}

  @UseGuards(JwtAuthGuard)
  @Get('symbols')
  @HttpCode(200)
  getSymbols(@Req() request: AuthenticatedRequest) {
    return this.tierService.getSymbols(request.user.tier as Tier);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:symbol')
  @HttpCode(200)
  checkSymbolAccess(
    @Req() request: AuthenticatedRequest,
    @Param('symbol', new ZodValidationPipe(tierSymbolParamSchema))
    symbol: string
  ) {
    return this.tierService.checkSymbolAccess(
      request.user.tier as Tier,
      symbol
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('combinations')
  @HttpCode(200)
  getCombinations(@Req() request: AuthenticatedRequest) {
    return this.tierService.getCombinations(request.user.tier as Tier);
  }
}
