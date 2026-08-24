import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Tier } from '@trading-alerts/types/tier';

import type { AuthenticatedRequest, RequestUser } from './jwt-auth.guard';
import { RequireTier, TierGuard } from './tier.guard';

class DummyController {
  @RequireTier('PRO')
  proOnlyHandler() {
    return undefined;
  }

  noRequirementHandler() {
    return undefined;
  }
}

function contextFor(handler: () => void, user?: RequestUser): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = user ? { user } : {};
  return {
    getHandler: () => handler,
    getClass: () => DummyController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeUser(tier: Tier): RequestUser {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    tier,
    role: 'USER',
    isAffiliate: false,
  };
}

describe('TierGuard', () => {
  const guard = new TierGuard(new Reflector());
  const dummy = new DummyController();

  it('allows a handler with no @RequireTier metadata regardless of user tier', () => {
    const context = contextFor(dummy.noRequirementHandler, makeUser('FREE'));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a PRO user through a @RequireTier(PRO) handler', () => {
    const context = contextFor(dummy.proOnlyHandler, makeUser('PRO'));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a FREE user on a @RequireTier(PRO) handler with ForbiddenException', () => {
    const context = contextFor(dummy.proOnlyHandler, makeUser('FREE'));
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a request with no user at all on a @RequireTier(PRO) handler', () => {
    const context = contextFor(dummy.proOnlyHandler, undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
