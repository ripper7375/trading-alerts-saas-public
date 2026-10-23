/**
 * Cron Secret Guard (Session 4A-2, File 5/6)
 *
 * Mirrors the `Bearer <CRON_SECRET>` check every one of the 8
 * `app/api/cron/<job>/route.ts` handlers duplicated inline (e.g.
 * `authHeader !== \`Bearer ${cronSecret}\``) — same check, same failure
 * mode (401), just centralized into one guard for the manual-trigger
 * controller instead of copy-pasted per route. The comparison is constant
 * time (CODE-04).
 */

import { createHash, timingSafeEqual } from 'crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * SHA-256 both strings, then `timingSafeEqual`: the two buffers always have the same length, so
 * neither the content nor the length of the secret shows in the time the comparison takes.
 */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  );
}

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const cronSecret = process.env['CRON_SECRET'];

    if (!cronSecret) {
      throw new UnauthorizedException('Server configuration error');
    }

    if (!safeEqual(authHeader ?? '', `Bearer ${cronSecret}`)) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}
