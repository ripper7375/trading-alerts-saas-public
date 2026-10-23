/**
 * ApiKeyGuard tests (CODE-04, WS-6).
 *
 * The guard authenticates the Push Worker / Relay with a Bearer key out of the comma-separated
 * `API_KEYS` variable. It had no spec at all. These tests hold two things:
 *
 * 1. its behaviour: a valid key, an invalid key, a missing header, a wrong scheme, several keys;
 * 2. that the keys are compared in constant time: SHA-256 digests of both strings (so the length of
 *    a key is not leaked and `timingSafeEqual` never sees buffers of different lengths) and EVERY
 *    configured key is compared, with no early exit on the first match.
 *
 * Timing cannot be measured in a unit test, so the comparison is observed through a wrapper
 * around `crypto.timingSafeEqual` that still calls the real function.
 */
import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

import { timingSafeEqual } from 'crypto';
import { ApiKeyGuard } from '../src/auth/api-key.guard';

const compare = timingSafeEqual as unknown as jest.Mock;

function mockContext(authHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authHeader } }),
    }),
  } as unknown as ExecutionContext;
}

function guardWith(apiKeys: string | undefined): ApiKeyGuard {
  const config = {
    get: (name: string) => (name === 'API_KEYS' ? apiKeys : undefined),
  } as unknown as ConfigService;
  return new ApiKeyGuard(config);
}

describe('ApiKeyGuard', () => {
  const KEY_A = 'push_worker_v5_AAAAAAAAAAAA';
  const KEY_B = 'mt5_relay_v2_29_BBBBBBBBBBBB';
  const KEY_C = 'renderer_CCCCCCCCCCCC';

  beforeEach(() => {
    compare.mockClear();
  });

  describe('behaviour', () => {
    it('accepts a valid key', () => {
      const guard = guardWith(KEY_A);
      expect(guard.canActivate(mockContext(`Bearer ${KEY_A}`))).toBe(true);
    });

    it('accepts any of several configured keys, whatever their position', () => {
      const guard = guardWith(`${KEY_A},${KEY_B},${KEY_C}`);
      for (const key of [KEY_A, KEY_B, KEY_C]) {
        expect(guard.canActivate(mockContext(`Bearer ${key}`))).toBe(true);
      }
    });

    it('ignores spaces around the configured keys and empty entries', () => {
      const guard = guardWith(` ${KEY_A} , ,${KEY_B},`);
      expect(guard.canActivate(mockContext(`Bearer ${KEY_A}`))).toBe(true);
      expect(guard.canActivate(mockContext(`Bearer ${KEY_B}`))).toBe(true);
    });

    it('rejects an invalid key', () => {
      const guard = guardWith(`${KEY_A},${KEY_B}`);
      expect(() => guard.canActivate(mockContext('Bearer not-a-key'))).toThrow(
        new UnauthorizedException('Invalid API key')
      );
    });

    it('rejects a missing authorization header', () => {
      const guard = guardWith(KEY_A);
      expect(() => guard.canActivate(mockContext(undefined))).toThrow(
        new UnauthorizedException('Missing authorization header')
      );
    });

    it('rejects a wrong scheme, even with a valid key', () => {
      const guard = guardWith(KEY_A);
      expect(() => guard.canActivate(mockContext(`Basic ${KEY_A}`))).toThrow(
        new UnauthorizedException('Invalid authorization type')
      );
      expect(() => guard.canActivate(mockContext(`bearer ${KEY_A}`))).toThrow(
        new UnauthorizedException('Invalid authorization type')
      );
    });

    it('rejects "Bearer" with no token', () => {
      const guard = guardWith(KEY_A);
      expect(() => guard.canActivate(mockContext('Bearer'))).toThrow(
        new UnauthorizedException('Invalid authorization type')
      );
      expect(() => guard.canActivate(mockContext('Bearer '))).toThrow(
        new UnauthorizedException('Invalid authorization type')
      );
    });

    it('rejects every token when API_KEYS is unset or empty', () => {
      for (const configured of [undefined, '', ' , ,']) {
        const guard = guardWith(configured);
        expect(() => guard.canActivate(mockContext(`Bearer ${KEY_A}`))).toThrow(
          UnauthorizedException
        );
      }
    });

    it.each([
      ['a prefix of the key', KEY_A.slice(0, -1)],
      ['the key with one more character', `${KEY_A}x`],
      [
        'a key of the same length with one character changed',
        `${KEY_A.slice(0, -1)}Z`,
      ],
      ['a much longer token', 'x'.repeat(4096)],
      ['a one-character token', 'x'],
    ])('rejects %s with a 401, never an unexpected error', (_label, token) => {
      const guard = guardWith(KEY_A);
      expect(() => guard.canActivate(mockContext(`Bearer ${token}`))).toThrow(
        UnauthorizedException
      );
    });
  });

  describe('constant-time comparison', () => {
    it('compares with crypto.timingSafeEqual on two buffers of the same length, whatever the lengths of the strings', () => {
      const guard = guardWith(KEY_A);

      expect(() => guard.canActivate(mockContext('Bearer x'))).toThrow(
        UnauthorizedException
      );

      expect(compare).toHaveBeenCalledTimes(1);
      const [left, right] = compare.mock.calls[0] as [Buffer, Buffer];
      expect(Buffer.isBuffer(left)).toBe(true);
      expect(Buffer.isBuffer(right)).toBe(true);
      expect(left.length).toBe(32);
      expect(right.length).toBe(32);
    });

    it('does not compare the raw strings: the buffers are digests, not the key or the token', () => {
      const guard = guardWith(KEY_A);
      guard.canActivate(mockContext(`Bearer ${KEY_A}`));

      const [left, right] = compare.mock.calls[0] as [Buffer, Buffer];
      expect(left.equals(Buffer.from(KEY_A))).toBe(false);
      expect(right.equals(Buffer.from(KEY_A))).toBe(false);
    });

    it('compares against EVERY configured key, even when the first one matches', () => {
      const guard = guardWith(`${KEY_A},${KEY_B},${KEY_C}`);

      expect(guard.canActivate(mockContext(`Bearer ${KEY_A}`))).toBe(true);

      expect(compare).toHaveBeenCalledTimes(3);
    });

    it('compares against every configured key when none matches', () => {
      const guard = guardWith(`${KEY_A},${KEY_B},${KEY_C}`);

      expect(() => guard.canActivate(mockContext('Bearer nope'))).toThrow(
        UnauthorizedException
      );

      expect(compare).toHaveBeenCalledTimes(3);
    });

    it('still accepts the right key when it is the last of several', () => {
      const guard = guardWith(`${KEY_A},${KEY_B},${KEY_C}`);
      expect(guard.canActivate(mockContext(`Bearer ${KEY_C}`))).toBe(true);
    });

    it('compares nothing when the header is missing or malformed (nothing to compare)', () => {
      const guard = guardWith(KEY_A);
      for (const header of [undefined, 'Basic abc', 'Bearer']) {
        expect(() => guard.canActivate(mockContext(header))).toThrow(
          UnauthorizedException
        );
      }
      expect(compare).not.toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    const spies: jest.SpyInstance[] = [];

    function spyOnLogger(): () => string {
      for (const level of [
        'log',
        'debug',
        'verbose',
        'warn',
        'error',
      ] as const) {
        spies.push(jest.spyOn(Logger.prototype, level).mockImplementation());
      }
      return () =>
        spies
          .flatMap((spy) => spy.mock.calls as unknown[][])
          .map((args) => args.map((a) => String(a)).join(' '))
          .join('\n');
    }

    afterEach(() => {
      while (spies.length) spies.pop()?.mockRestore();
    });

    it('names the caller by its prefix and never prints the key', () => {
      const logged = spyOnLogger();
      const guard = guardWith(`${KEY_A},${KEY_B},${KEY_C}`);

      guard.canActivate(mockContext(`Bearer ${KEY_A}`));
      guard.canActivate(mockContext(`Bearer ${KEY_C}`));

      const output = logged();
      expect(output).toContain('push_worker_');
      expect(output).toContain('renderer_');
      expect(output).not.toContain('AAAAAAAAAAAA');
      expect(output).not.toContain('CCCCCCCCCCCC');
      expect(output).not.toContain(KEY_A);
      expect(output).not.toContain(KEY_C);
    });

    it('calls a caller whose key has no known prefix "unknown", not by any part of its key', () => {
      const logged = spyOnLogger();
      const guard = guardWith('freshly-issued-SECRETSECRET');

      guard.canActivate(mockContext('Bearer freshly-issued-SECRETSECRET'));

      const output = logged();
      expect(output).toContain('unknown');
      expect(output).not.toContain('freshly');
      expect(output).not.toContain('SECRETSECRET');
    });

    it('prints nothing of a rejected token', () => {
      const logged = spyOnLogger();
      const guard = guardWith(KEY_A);

      expect(() =>
        guard.canActivate(mockContext('Bearer attacker-guess-1234'))
      ).toThrow(UnauthorizedException);

      expect(logged()).not.toContain('attacker-guess-1234');
    });
  });
});
