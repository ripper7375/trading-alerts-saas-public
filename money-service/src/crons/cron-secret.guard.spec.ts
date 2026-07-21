/**
 * Cron Secret Guard Tests (Session 4A-2, File 6/6)
 *
 * New code, no direct SOURCE — formalizes the throwaway check done during
 * File 5/6's own port. Mirrors jwt-auth.guard.spec.ts's existing
 * money-service convention (direct instantiation + a mock
 * ExecutionContext, no Nest app needed for a pure guard).
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { CronSecretGuard } from './cron-secret.guard';

function mockContext(authHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authHeader } }),
    }),
  } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  const guard = new CronSecretGuard();
  const originalSecret = process.env['CRON_SECRET'];

  beforeEach(() => {
    process.env['CRON_SECRET'] = 'test-cron-secret';
  });

  afterAll(() => {
    process.env['CRON_SECRET'] = originalSecret;
  });

  it('throws 401 with no authorization header', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      UnauthorizedException
    );
  });

  it('throws 401 with the wrong secret', () => {
    expect(() => guard.canActivate(mockContext('Bearer wrong-secret'))).toThrow(
      UnauthorizedException
    );
  });

  it('throws a server-config error when CRON_SECRET is unset', () => {
    delete process.env['CRON_SECRET'];
    expect(() => guard.canActivate(mockContext('Bearer anything'))).toThrow(
      UnauthorizedException
    );
  });

  it('allows the correct Bearer <CRON_SECRET>', () => {
    expect(guard.canActivate(mockContext('Bearer test-cron-secret'))).toBe(
      true
    );
  });
});
