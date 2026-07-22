import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { AffiliateGuard } from './affiliate.guard';

function contextWithUser(
  user?: Partial<AuthenticatedRequest['user']>
): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = { user: user as never };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AffiliateGuard', () => {
  it('allows a request whose user has isAffiliate: true', () => {
    const guard = new AffiliateGuard();
    expect(guard.canActivate(contextWithUser({ isAffiliate: true }))).toBe(
      true
    );
  });

  it('rejects a non-affiliate user with the documented 403 body', () => {
    const guard = new AffiliateGuard();
    try {
      guard.canActivate(contextWithUser({ isAffiliate: false }));
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        error: 'Forbidden',
        message: 'Affiliate access required',
        code: 'AFFILIATE_REQUIRED',
      });
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('rejects when request.user is undefined', () => {
    const guard = new AffiliateGuard();
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException
    );
  });
});
