/**
 * Admin Guard (Session 4A-6, File 2/3)
 *
 * Runs after JwtAuthGuard (which already populated request.user from the
 * verified NextAuth session token). Replicates lib/auth/session.ts's
 * requireAdmin() role check and its exact 403 response body — the same
 * body the 7 ported admin report/list/detail routes' AuthError catch
 * blocks produce (`{ error: error.message }` at `error.statusCode`).
 * requireAdmin()'s own 401 path (not authenticated at all) never reaches
 * here — JwtAuthGuard already rejects that case first.
 *
 * CODE-09: an ADMIN whose account has no two-factor authentication is
 * refused with 403 `ADMIN_2FA_REQUIRED`, like requireAdmin() in the monolith.
 * The flag comes from the same 30 s snapshot JwtAuthGuard just read
 * (user-active.util.ts), so it costs no extra query. Fails closed: only a flag
 * that is exactly true passes, and a state that cannot be read is refused.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { getSessionState } from '../auth/user-active.util';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_REQUIRED_BODY = {
  error: 'You must be an administrator to access this resource',
};

@Injectable()
export class AdminGuard implements CanActivate {
  // PrismaModule is @Global, so every module that uses this guard resolves it (as for JwtAuthGuard).
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException(ADMIN_REQUIRED_BODY);
    }

    const lookup = await getSessionState(this.prisma, request.user.id);
    if (lookup === 'error') {
      throw new ForbiddenException({
        error: 'Unable to verify administrator status',
        code: 'ADMIN_ERROR',
      });
    }
    if (lookup === 'missing') {
      throw new ForbiddenException(ADMIN_REQUIRED_BODY);
    }
    if (lookup.twoFactorEnabled !== true) {
      throw new ForbiddenException({
        error: 'Two-factor authentication is required for administrator access',
        code: 'ADMIN_2FA_REQUIRED',
      });
    }

    return true;
  }
}
