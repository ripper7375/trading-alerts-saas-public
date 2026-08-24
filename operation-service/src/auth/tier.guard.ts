import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Tier } from '@trading-alerts/types/tier';

import type { AuthenticatedRequest } from './jwt-auth.guard';

export const REQUIRE_TIER_KEY = 'requireTier';

/**
 * Marks a handler (or controller) as requiring at least the given tier.
 * Must be paired with `@UseGuards(JwtAuthGuard, TierGuard)` — `TierGuard`
 * reads `request.user.tier`, populated by `JwtAuthGuard`, and assumes it
 * already ran. Session 4B-10: new reusable infrastructure, built alongside
 * the (tier-independent) TierController but not used by any of its 3
 * handlers — for future tier-gated endpoints in other domains.
 */
export const RequireTier = (tier: Tier): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_TIER_KEY, tier);

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<Tier | undefined>(
      REQUIRE_TIER_KEY,
      [context.getHandler(), context.getClass()]
    );

    // No @RequireTier() on this handler/controller: nothing to enforce.
    if (!requiredTier || requiredTier === 'FREE') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.tier !== requiredTier) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: `This feature requires a ${requiredTier} subscription.`,
        reason: 'TIER_PRO_REQUIRED',
      });
    }

    return true;
  }
}
