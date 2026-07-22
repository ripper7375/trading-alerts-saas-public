import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { AdminGuard } from './admin.guard';

function contextWithUser(
  user?: Partial<AuthenticatedRequest['user']>
): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = { user: user as never };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('allows a request whose user has role ADMIN', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextWithUser({ role: 'ADMIN' }))).toBe(true);
  });

  it('rejects a non-admin user with the exact source 403 body', () => {
    const guard = new AdminGuard();
    try {
      guard.canActivate(contextWithUser({ role: 'USER' }));
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        error: 'You must be an administrator to access this resource',
      });
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('rejects when request.user is undefined', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException
    );
  });
});
