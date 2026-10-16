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
 * Attached to the Stripe checkout, dLocal create-payment, admin and
 * disbursement-batch write routes.
 *
 * Remediation Tier 2 §6.8 -- three changes:
 *  - The key is scoped by USER. It was METHOD:URL:key, so two users sending the
 *    same Idempotency-Key to the same route shared one cache entry, and the second
 *    got the first's response (a checkout URL or payment link) without running.
 *  - A replay must carry the same BODY. The response is stored with a SHA-256 of
 *    the body it answered; the same key with a different body is refused (422)
 *    instead of silently returning an answer to a different request.
 *  - An in-flight claim lasts 60 s, not 24 h, so a crashed request does not block
 *    its key for a day.
 */

import { createHash } from 'crypto';

import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { logger } from '../logger.util';

import {
  IDEMPOTENCY_CLAIM_LEASE_SECONDS,
  IDEMPOTENCY_TTL_SECONDS,
  IdempotencyStore,
} from './idempotency.store';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** JSON with object keys in sorted order, so `{a,b}` and `{b,a}` hash alike. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(body ?? null))
    .digest('hex');
}

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

    // JwtAuthGuard runs first on every route this is attached to, so the user is
    // known. 'anonymous' only keeps a route without a guard working.
    const userId =
      (request as Request & { user?: { id?: string } }).user?.id ?? 'anonymous';
    const cacheKey = `${userId}:${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}`;
    const bodyHash = hashBody(request.body);

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
      if (existing.bodyHash !== undefined && existing.bodyHash !== bodyHash) {
        // Same user, same route, same key, different request. Replaying the cached
        // answer would tell the caller something that is not true of this request.
        throw new UnprocessableEntityException(
          'This Idempotency-Key was already used with a different request body'
        );
      }
      const response = context.switchToHttp().getResponse<Response>();
      response.status(existing.statusCode);
      return of(existing.body);
    }

    let claimed: boolean;
    try {
      claimed = await this.store.claim(
        cacheKey,
        IDEMPOTENCY_CLAIM_LEASE_SECONDS
      );
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
            .save(
              cacheKey,
              { statusCode, body, bodyHash },
              IDEMPOTENCY_TTL_SECONDS
            )
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
