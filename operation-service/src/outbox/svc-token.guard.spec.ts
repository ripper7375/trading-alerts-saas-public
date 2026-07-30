/**
 * SVC Token Guard Tests (Session 4A-11, File 2/5)
 *
 * New code, no direct SOURCE — mirrors money-service's own
 * cron-secret.guard.spec.ts test shape (direct instantiation + a mock
 * ExecutionContext, no Nest app needed for a pure guard).
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { SvcTokenGuard } from './svc-token.guard';

function mockContext(authHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authHeader } }),
    }),
  } as unknown as ExecutionContext;
}

describe('SvcTokenGuard', () => {
  const guard = new SvcTokenGuard();
  const originalToken = process.env['SVC_TOKEN'];

  beforeEach(() => {
    process.env['SVC_TOKEN'] = 'test-svc-token';
  });

  afterAll(() => {
    process.env['SVC_TOKEN'] = originalToken;
  });

  it('throws 401 with no authorization header', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      UnauthorizedException
    );
  });

  it('throws 401 with the wrong token', () => {
    expect(() => guard.canActivate(mockContext('Bearer wrong-token'))).toThrow(
      UnauthorizedException
    );
  });

  it('throws a server-config error when SVC_TOKEN is unset', () => {
    delete process.env['SVC_TOKEN'];
    expect(() => guard.canActivate(mockContext('Bearer anything'))).toThrow(
      UnauthorizedException
    );
  });

  it('allows the correct Bearer <SVC_TOKEN>', () => {
    expect(guard.canActivate(mockContext('Bearer test-svc-token'))).toBe(true);
  });
});
