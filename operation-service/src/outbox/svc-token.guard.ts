/**
 * SVC Token Guard (Session 4A-11, File 2/5)
 *
 * Mirrors money-service's own `CronSecretGuard` shape (Bearer secret,
 * constant-time compare, fail-closed on missing config OR mismatch) — the
 * only existing shared-secret-guard pattern in this codebase, reused rather
 * than inventing a new mechanism for the same problem. Activates F31
 * (`SVC_TOKEN`, descoped since Session 3-5) for the money-service ->
 * operation-service outbox delivery call (File 3/File 4).
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
 * neither the content nor the length of the secret shows in the time the comparison takes (CODE-04).
 */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  );
}

@Injectable()
export class SvcTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const svcToken = process.env['SVC_TOKEN'];

    if (!svcToken) {
      throw new UnauthorizedException('Server configuration error');
    }

    if (!safeEqual(authHeader ?? '', `Bearer ${svcToken}`)) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}
