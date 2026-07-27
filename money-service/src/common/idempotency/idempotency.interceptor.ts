/**
 * Idempotency Interceptor (Session 4A-8, Step 1)
 *
 * Reusable NestJS interceptor: on any route decorated with
 * `@UseInterceptors(IdempotencyInterceptor)`, a request carrying an
 * `Idempotency-Key` header is deduped for 24h -- a retried request with the
 * same key returns the ORIGINAL response instead of re-executing the
 * handler. Requests without the header pass through unchanged (fail open
 * by design: this interceptor augments write routes, it never requires
 * callers to adopt it).
 *
 * Not yet attached to any controller -- money-service has no write routes
 * of its own yet (Stripe/dLocal write paths stay on monolith Next.js
 * routes until 4A-9's cutover). Built now, ready to attach then.
 */

import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { logger } from '../logger.util';

import { IDEMPOTENCY_TTL_SECONDS, IdempotencyStore } from './idempotency.store';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: IdempotencyStore) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as
      | string
      | undefined;

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}`;

    let existing: Awaited<ReturnType<IdempotencyStore['get']>>;
    try {
      existing = await this.store.get(cacheKey);
    } catch (error) {
      logger.error('Idempotency cache read failed, proceeding uncached', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next.handle();
    }

    if (existing === 'IN_PROGRESS') {
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed'
      );
    }

    if (existing) {
      const response = context.switchToHttp().getResponse<Response>();
      response.status(existing.statusCode);
      return of(existing.body);
    }

    let claimed: boolean;
    try {
      claimed = await this.store.claim(cacheKey, IDEMPOTENCY_TTL_SECONDS);
    } catch (error) {
      logger.error('Idempotency claim failed, proceeding uncached', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return next.handle();
    }

    if (!claimed) {
      // Lost the race to a concurrent request carrying the same key.
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed'
      );
    }

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = response.statusCode || 200;
          this.store
            .save(cacheKey, { statusCode, body }, IDEMPOTENCY_TTL_SECONDS)
            .catch((error: unknown) => {
              logger.error('Idempotency cache write failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            });
        },
        error: () => {
          // Never cache a failure -- release the claim so a genuine retry
          // after a real error isn't stuck behind a stale in-progress lock.
          this.store.release(cacheKey).catch((error: unknown) => {
            logger.error('Idempotency claim release failed', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        },
      })
    );
  }
}
