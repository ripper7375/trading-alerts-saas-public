import {
  CanActivate,
  CustomDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';

import { RedisService } from '../redis/redis.service';

import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * The fresh step-up in front of every call that moves payout money or changes where payout
 * money goes (CODE-06B).
 *
 * The monolith mints the token (`lib/auth/two-factor-token.ts`, `signPayoutStepUp`) after a
 * current TOTP code (an admin approving or executing a batch) or the current password plus a
 * TOTP code when 2FA is on (an affiliate adding or removing a Wise recipient, decision D9-4). It
 * lives 120 seconds, is meant for one audience, names the caller as its subject and opens ONE
 * call: this guard spends its `jti` in Redis. Both sides assert the same literals in a test
 * (`step-up.guard.spec.ts` here, `payout-step-up-token.test.ts` there).
 *
 * Put it AFTER the role guards and name the audience with `@RequireStepUp(...)`:
 *
 *   @UseGuards(AffiliateGuard, StepUpGuard)
 *   @RequireStepUp(PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT)
 *
 * The token travels in the `X-Payout-Step-Up` header (not the body: the idempotency interceptor
 * hashes the body, and a one-time value in it would make every retry a different request).
 *
 * Refusals are 403 `PAYOUT_STEP_UP_REQUIRED` whatever is wrong with the token, so a caller
 * learns nothing about HOW it failed. A token is spent when it passes, even if the call itself
 * then fails (a paused payout, a bad body): the caller steps up again. Redis down is a 503, the
 * call does not go ahead (fail closed, as the 2FA sign-in steps do).
 */

export const PAYOUT_STEP_UP_PURPOSE = 'payout_stepup';
export const PAYOUT_STEP_UP_ISSUER = 'davintrade-2fa';
export const PAYOUT_STEP_UP_AUDIENCE_APPROVAL = 'money-service:payout-approval';
export const PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT =
  'money-service:wise-recipient';
export const PAYOUT_STEP_UP_HEADER = 'x-payout-step-up';
/** A token lives at most this long; one minted with a longer life is refused. */
export const PAYOUT_STEP_UP_MAX_LIFETIME_SECONDS = 120;
/** A spent token stays marked past its own lifetime and any clock skew. */
export const PAYOUT_STEP_UP_USED_TTL_SECONDS = 300;
/** Seconds of clock difference between the minting side and this one that are forgiven. */
const CLOCK_TOLERANCE_SECONDS = 10;

export const STEP_UP_REQUIRED_CODE = 'PAYOUT_STEP_UP_REQUIRED';
export const STEP_UP_UNAVAILABLE_CODE = 'PAYOUT_STEP_UP_UNAVAILABLE';
export const STEP_UP_AUDIENCE_METADATA = 'payoutStepUpAudience';

export const payoutStepUpKeys = {
  used: (jti: string): string => `payout-stepup:used:${jti}`,
} as const;

/** Names the audience the decorated handler (or controller) needs a step-up token for. */
export const RequireStepUp = (audience: string): CustomDecorator<string> =>
  SetMetadata(STEP_UP_AUDIENCE_METADATA, audience);

function refused(): ForbiddenException {
  return new ForbiddenException({
    error: 'A fresh identity check is required for this action',
    code: STEP_UP_REQUIRED_CODE,
  });
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: 'The identity check is temporarily unavailable. Please try again.',
    code: STEP_UP_UNAVAILABLE_CODE,
  });
}

@Injectable()
export class StepUpGuard implements CanActivate {
  // RedisModule is @Global, so every module that uses this guard resolves RedisService.
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // A route that carries the guard but no audience is a coding mistake: never open.
    const audience = this.reflector.getAllAndOverride<string | undefined>(
      STEP_UP_AUDIENCE_METADATA,
      [context.getHandler(), context.getClass()]
    );
    if (!audience) throw refused();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const callerId = request.user?.id;
    if (!callerId) throw refused();

    const header = request.headers?.[PAYOUT_STEP_UP_HEADER];
    const token = typeof header === 'string' ? header.trim() : '';
    if (!token) throw refused();

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) throw unavailable();

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ['HS256'],
        issuer: PAYOUT_STEP_UP_ISSUER,
        audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }));
    } catch {
      throw refused();
    }

    const { purpose } = payload as { purpose?: unknown };
    const { sub, jti, exp, iat } = payload;
    if (
      purpose !== PAYOUT_STEP_UP_PURPOSE ||
      typeof sub !== 'string' ||
      sub !== callerId ||
      typeof jti !== 'string' ||
      jti === '' ||
      typeof exp !== 'number' ||
      typeof iat !== 'number' ||
      exp - iat > PAYOUT_STEP_UP_MAX_LIFETIME_SECONDS
    ) {
      throw refused();
    }

    // The token opens one call: the first caller of this jti wins, every later one is refused.
    let firstUse: boolean;
    try {
      firstUse =
        (await this.redis
          .getClient()
          .set(
            payoutStepUpKeys.used(jti),
            '1',
            'EX',
            PAYOUT_STEP_UP_USED_TTL_SECONDS,
            'NX'
          )) === 'OK';
    } catch (error) {
      console.error(
        '[StepUpGuard] Redis unavailable:',
        error instanceof Error ? error.message : String(error)
      );
      throw unavailable();
    }
    if (!firstUse) throw refused();

    return true;
  }
}
