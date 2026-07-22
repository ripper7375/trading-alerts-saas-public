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
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException({
        error: 'You must be an administrator to access this resource',
      });
    }

    return true;
  }
}
