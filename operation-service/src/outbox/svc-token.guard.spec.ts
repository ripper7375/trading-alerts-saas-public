/**
 * SVC Token Guard Tests (Session 4A-11, File 2/5)
 *
 * New code, no direct SOURCE — mirrors money-service's own
 * cron-secret.guard.spec.ts test shape (direct instantiation + a mock
 * ExecutionContext, no Nest app needed for a pure guard).
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// CODE-04: the token must be compared in constant time. Timing cannot be measured in a unit test,
// so `crypto.timingSafeEqual` is wrapped (it still runs) and the comparison is observed through it.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

import { timingSafeEqual } from 'crypto';

import { SvcTokenGuard } from './svc-token.guard';

const compare = timingSafeEqual as unknown as jest.Mock;

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

  describe('constant-time comparison (CODE-04)', () => {
    beforeEach(() => {
      compare.mockClear();
    });

    it.each([
      ['a token of the same length', 'Bearer test-svc-tokeX'],
      ['a prefix of the right header', 'Bearer test-svc-toke'],
      ['the right header with one more character', 'Bearer test-svc-token '],
      ['a much longer header', `Bearer ${'x'.repeat(4096)}`],
      ['the right token with the wrong scheme', 'Basic test-svc-token'],
      ['the right token with no scheme', 'test-svc-token'],
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
      guard.canActivate(mockContext('Bearer test-svc-token'));

      const [left, right] = compare.mock.calls[0] as [Buffer, Buffer];
      expect(left.equals(Buffer.from('Bearer test-svc-token'))).toBe(false);
      expect(right.equals(Buffer.from('Bearer test-svc-token'))).toBe(false);
    });

    it('still compares when the header is missing (the same work for every request)', () => {
      expect(() => guard.canActivate(mockContext(undefined))).toThrow(
        UnauthorizedException
      );

      expect(compare).toHaveBeenCalledTimes(1);
    });

    it('fails closed on a missing SVC_TOKEN before comparing anything', () => {
      delete process.env['SVC_TOKEN'];

      expect(() => guard.canActivate(mockContext('Bearer undefined'))).toThrow(
        UnauthorizedException
      );
      expect(compare).not.toHaveBeenCalled();
    });
  });
});
