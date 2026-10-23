/**
 * Cron Secret Guard Tests (Session 4A-2, File 6/6)
 *
 * New code, no direct SOURCE — formalizes the throwaway check done during
 * File 5/6's own port. Mirrors jwt-auth.guard.spec.ts's existing
 * money-service convention (direct instantiation + a mock
 * ExecutionContext, no Nest app needed for a pure guard).
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// CODE-04: the secret must be compared in constant time. Timing cannot be measured in a unit test,
// so `crypto.timingSafeEqual` is wrapped (it still runs) and the comparison is observed through it.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

import { timingSafeEqual } from 'crypto';

import { CronSecretGuard } from './cron-secret.guard';

const compare = timingSafeEqual as unknown as jest.Mock;

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

  describe('constant-time comparison (CODE-04)', () => {
    beforeEach(() => {
      compare.mockClear();
    });

    it.each([
      ['a secret of the same length', 'Bearer test-cron-secreX'],
      ['a prefix of the right header', 'Bearer test-cron-secre'],
      ['the right header with one more character', 'Bearer test-cron-secret '],
      ['a much longer header', `Bearer ${'x'.repeat(4096)}`],
      ['the right secret with the wrong scheme', 'Basic test-cron-secret'],
      ['the right secret with no scheme', 'test-cron-secret'],
      ['an empty header', ''],
    ])('rejects %s with a 401, never an unexpected error', (_label, header) => {
      expect(() => guard.canActivate(mockContext(header))).toThrow(
        UnauthorizedException
      );
    });

    it('compares with crypto.timingSafeEqual on two buffers of the same length, whatever the lengths of the strings', () => {
      expect(() => guard.canActivate(mockContext('Bearer x'))).toThrow(
        UnauthorizedException
      );

      expect(compare).toHaveBeenCalledTimes(1);
      const [left, right] = compare.mock.calls[0] as [Buffer, Buffer];
      expect(left.length).toBe(32);
      expect(right.length).toBe(32);
    });

    it('compares digests, not the header or the secret themselves', () => {
      guard.canActivate(mockContext('Bearer test-cron-secret'));

      const [left, right] = compare.mock.calls[0] as [Buffer, Buffer];
      expect(left.equals(Buffer.from('Bearer test-cron-secret'))).toBe(false);
      expect(right.equals(Buffer.from('Bearer test-cron-secret'))).toBe(false);
    });

    it('still compares when the header is missing (the same work for every request)', () => {
      expect(() => guard.canActivate(mockContext(undefined))).toThrow(
        UnauthorizedException
      );

      expect(compare).toHaveBeenCalledTimes(1);
    });

    it('fails closed on a missing CRON_SECRET before comparing anything', () => {
      delete process.env['CRON_SECRET'];

      expect(() => guard.canActivate(mockContext('Bearer undefined'))).toThrow(
        UnauthorizedException
      );
      expect(compare).not.toHaveBeenCalled();
    });
  });
});
