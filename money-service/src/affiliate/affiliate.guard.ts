/**
 * Affiliate Guard (Session 4A-6, File 2/3)
 *
 * Runs after JwtAuthGuard (which already populated request.user from the
 * verified NextAuth session token). Replicates lib/auth/session.ts's
 * requireAffiliate() isAffiliate check and the 403 body the 4 ported
 * affiliate-dashboard routes' catch blocks are documented (and intended)
 * to produce for a non-affiliate caller: `{ error: 'Forbidden', message:
 * 'Affiliate access required', code: 'AFFILIATE_REQUIRED' }`.
 *
 * Deviation note (see this order's Deviations section): in the SOURCE,
 * these 4 routes' own catch blocks check `error.message.includes(...)`
 * against AuthError's `.message`, but the distinguishing marker is only
 * ever set on `.code` — so neither the 401 nor 403 branch is actually
 * reachable there; every auth failure silently falls through to a generic
 * 500. That's a latent monolith bug with zero test coverage, not a
 * designed behavior — this guard implements the CORRECT/documented
 * contract each route's own JSDoc promises (`@returns 403 - Forbidden`),
 * not the unreachable dead code.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Injectable()
export class AffiliateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.isAffiliate) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Affiliate access required',
        code: 'AFFILIATE_REQUIRED',
      });
    }

    return true;
  }
}
