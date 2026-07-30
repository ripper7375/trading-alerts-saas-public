/**
 * SVC Token Guard (Session 4A-11, File 2/5)
 *
 * Mirrors money-service's own `CronSecretGuard` shape (Bearer secret,
 * exact-string compare, fail-closed on missing config OR mismatch) — the
 * only existing shared-secret-guard pattern in this codebase, reused rather
 * than inventing a new mechanism for the same problem. Activates F31
 * (`SVC_TOKEN`, descoped since Session 3-5) for the money-service ->
 * operation-service outbox delivery call (File 3/File 4).
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SvcTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const svcToken = process.env['SVC_TOKEN'];

    if (!svcToken) {
      throw new UnauthorizedException('Server configuration error');
    }

    if (authHeader !== `Bearer ${svcToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}
