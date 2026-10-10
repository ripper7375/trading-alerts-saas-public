/**
 * @jest-environment node
 */

/**
 * The keyed hash of a user id (build step 5, part 5; decision D12). The key in
 * these tests is made up; none of them reads a real one.
 */

import { createHmac } from 'crypto';

import {
  AUDIT_KEY_ENV,
  AUDIT_KEY_VERSION_ENV,
  AuditKeyError,
  MIN_AUDIT_KEY_LENGTH,
  TEST_AUDIT_HMAC_KEY,
  hashUserId,
  resolveAuditKey,
  verifyUserHash,
} from '@/lib/engine4/store/user-hash';
import type { AuditKey } from '@/lib/engine4/store/user-hash';

const KEY_A = 'a'.repeat(40);
const KEY_B = 'b'.repeat(40);

const keyOf = (key: string, version = 1): AuditKey => ({
  key,
  version,
  source: 'ENV',
});

function failure(env: Record<string, string | undefined>): AuditKeyError {
  try {
    resolveAuditKey(env);
  } catch (error) {
    if (error instanceof AuditKeyError) return error;
    throw error;
  }
  throw new Error('expected resolveAuditKey to throw');
}

describe('hashUserId', () => {
  test('is HMAC-SHA-256: the RFC 4231 test case 2 vector', () => {
    // key "Jefe", data "what do ya want for nothing?" (RFC 4231, section 4.3)
    const { hash } = hashUserId('what do ya want for nothing?', keyOf('Jefe'));
    expect(hash).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    );
  });

  test('is the HMAC of the id as UTF-8 bytes, nothing added', () => {
    const id = 'clx0user-é-世界';
    expect(hashUserId(id, keyOf(KEY_A)).hash).toBe(
      createHmac('sha256', KEY_A).update(Buffer.from(id, 'utf8')).digest('hex')
    );
  });

  test('is 64 lowercase hex characters and carries the key version', () => {
    const result = hashUserId('user-1', keyOf(KEY_A, 7));
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.keyVersion).toBe(7);
  });

  test('is stable for one key and one user', () => {
    expect(hashUserId('user-1', keyOf(KEY_A))).toEqual(
      hashUserId('user-1', keyOf(KEY_A))
    );
  });

  test('differs for another key', () => {
    expect(hashUserId('user-1', keyOf(KEY_A)).hash).not.toBe(
      hashUserId('user-1', keyOf(KEY_B)).hash
    );
  });

  test('differs for another user', () => {
    expect(hashUserId('user-1', keyOf(KEY_A)).hash).not.toBe(
      hashUserId('user-2', keyOf(KEY_A)).hash
    );
  });

  test('does not depend on the key version number, only on the key text', () => {
    expect(hashUserId('user-1', keyOf(KEY_A, 1)).hash).toBe(
      hashUserId('user-1', keyOf(KEY_A, 2)).hash
    );
  });

  test.each(['', undefined, null, 5])('refuses %p as a user id', (id) => {
    expect(() => hashUserId(id as unknown as string, keyOf(KEY_A))).toThrow(
      TypeError
    );
  });
});

describe('verifyUserHash', () => {
  const stored = hashUserId('user-1', keyOf(KEY_A, 3));

  test('MATCH for the same user, key and version', () => {
    expect(verifyUserHash('user-1', stored, keyOf(KEY_A, 3))).toBe('MATCH');
  });

  test('MISMATCH for another user', () => {
    expect(verifyUserHash('user-2', stored, keyOf(KEY_A, 3))).toBe('MISMATCH');
  });

  test('MISMATCH for another key of the SAME version', () => {
    expect(verifyUserHash('user-1', stored, keyOf(KEY_B, 3))).toBe('MISMATCH');
  });

  test('OTHER_KEY_VERSION, not a guess, when the key is not the row’s own', () => {
    expect(verifyUserHash('user-1', stored, keyOf(KEY_A, 4))).toBe(
      'OTHER_KEY_VERSION'
    );
    expect(verifyUserHash('user-2', stored, keyOf(KEY_B, 4))).toBe(
      'OTHER_KEY_VERSION'
    );
  });

  test('MISMATCH for a hash of the wrong length or case', () => {
    expect(
      verifyUserHash('user-1', { ...stored, hash: 'abc' }, keyOf(KEY_A, 3))
    ).toBe('MISMATCH');
    expect(
      verifyUserHash(
        'user-1',
        { ...stored, hash: stored.hash.toUpperCase() },
        keyOf(KEY_A, 3)
      )
    ).toBe('MISMATCH');
  });

  test('D12: after a rotation each old hash is recognised with its own key only', () => {
    const v1 = hashUserId('user-1', keyOf(KEY_A, 1));
    const v2 = hashUserId('user-1', keyOf(KEY_B, 2));
    expect(v1.hash).not.toBe(v2.hash);
    expect(verifyUserHash('user-1', v1, keyOf(KEY_A, 1))).toBe('MATCH');
    expect(verifyUserHash('user-1', v2, keyOf(KEY_B, 2))).toBe('MATCH');
    expect(verifyUserHash('user-1', v1, keyOf(KEY_B, 2))).toBe(
      'OTHER_KEY_VERSION'
    );
  });
});

describe('resolveAuditKey', () => {
  test('uses the key and the version from the environment', () => {
    expect(
      resolveAuditKey({
        [AUDIT_KEY_ENV]: KEY_A,
        [AUDIT_KEY_VERSION_ENV]: '4',
        NODE_ENV: 'production',
      })
    ).toEqual({ key: KEY_A, version: 4, source: 'ENV' });
  });

  test('the version defaults to 1, also when it is empty', () => {
    expect(resolveAuditKey({ [AUDIT_KEY_ENV]: KEY_A }).version).toBe(1);
    expect(
      resolveAuditKey({ [AUDIT_KEY_ENV]: KEY_A, [AUDIT_KEY_VERSION_ENV]: '' })
        .version
    ).toBe(1);
  });

  test('a key is at least 32 characters', () => {
    expect(MIN_AUDIT_KEY_LENGTH).toBe(32);
    expect(failure({ [AUDIT_KEY_ENV]: 'k'.repeat(31) }).code).toBe('TOO_SHORT');
    expect(resolveAuditKey({ [AUDIT_KEY_ENV]: 'k'.repeat(32) }).source).toBe(
      'ENV'
    );
  });

  test.each([
    ['production', undefined],
    ['production', ''],
    ['development', undefined],
    [undefined, undefined],
    ['staging', ''],
  ])(
    'NODE_ENV %p with no key (%p): MISSING, never a fallback',
    (nodeEnv, key) => {
      const error = failure({ NODE_ENV: nodeEnv, [AUDIT_KEY_ENV]: key });
      expect(error.code).toBe('MISSING');
      expect(error.message).not.toContain(TEST_AUDIT_HMAC_KEY);
    }
  );

  test('the public test key is used only when NODE_ENV is "test" and no key is set', () => {
    expect(resolveAuditKey({ NODE_ENV: 'test' })).toEqual({
      key: TEST_AUDIT_HMAC_KEY,
      version: 1,
      source: 'TEST',
    });
    expect(
      resolveAuditKey({ NODE_ENV: 'test', [AUDIT_KEY_ENV]: '' }).source
    ).toBe('TEST');
  });

  test('a key that IS set wins over the test fallback, even under NODE_ENV "test"', () => {
    expect(
      resolveAuditKey({ NODE_ENV: 'test', [AUDIT_KEY_ENV]: KEY_A })
    ).toEqual({ key: KEY_A, version: 1, source: 'ENV' });
  });

  test('the test key is long enough for the rule that guards the real one', () => {
    expect(TEST_AUDIT_HMAC_KEY.length).toBeGreaterThanOrEqual(
      MIN_AUDIT_KEY_LENGTH
    );
  });

  test.each([
    '0',
    '-1',
    '01',
    '1.5',
    '1e3',
    'two',
    ' 2',
    '1000000000',
    '99999999999',
  ])('refuses the version %p', (version) => {
    expect(
      failure({ [AUDIT_KEY_ENV]: KEY_A, [AUDIT_KEY_VERSION_ENV]: version }).code
    ).toBe('BAD_VERSION');
  });

  test('refuses a bad version for the test key too', () => {
    expect(
      failure({ NODE_ENV: 'test', [AUDIT_KEY_VERSION_ENV]: '0' }).code
    ).toBe('BAD_VERSION');
  });

  test.each(['1', '9', '10', '999999999'])(
    'accepts the version %p',
    (version) => {
      expect(
        resolveAuditKey({
          [AUDIT_KEY_ENV]: KEY_A,
          [AUDIT_KEY_VERSION_ENV]: version,
        }).version
      ).toBe(Number(version));
    }
  );

  test('the largest version fits the 32-bit INTEGER column', () => {
    expect(
      resolveAuditKey({
        [AUDIT_KEY_ENV]: KEY_A,
        [AUDIT_KEY_VERSION_ENV]: '999999999',
      }).version
    ).toBeLessThanOrEqual(2147483647);
  });

  test('the error never carries the key', () => {
    const error = failure({ [AUDIT_KEY_ENV]: 'short-secret-value' });
    expect(error.message).not.toContain('short-secret-value');
  });
});

describe('the names Davin provisions in Vercel', () => {
  test('are exactly these two variables, spelled out here on purpose', () => {
    expect(AUDIT_KEY_ENV).toBe('ENGINE4_AUDIT_HMAC_KEY');
    expect(AUDIT_KEY_VERSION_ENV).toBe('ENGINE4_AUDIT_HMAC_KEY_VERSION');
    expect(
      resolveAuditKey({
        ENGINE4_AUDIT_HMAC_KEY: KEY_A,
        ENGINE4_AUDIT_HMAC_KEY_VERSION: '3',
      })
    ).toEqual({ key: KEY_A, version: 3, source: 'ENV' });
  });

  test('every refusal says which variable and what is wrong, and is an AuditKeyError', () => {
    const missing = failure({ NODE_ENV: 'production' });
    expect(missing.name).toBe('AuditKeyError');
    expect(missing.message).toContain('ENGINE4_AUDIT_HMAC_KEY');
    const short = failure({ ENGINE4_AUDIT_HMAC_KEY: 'k'.repeat(10) });
    expect(short.message).toContain('ENGINE4_AUDIT_HMAC_KEY');
    expect(short.message).toContain('32');
    const version = failure({
      ENGINE4_AUDIT_HMAC_KEY: KEY_A,
      ENGINE4_AUDIT_HMAC_KEY_VERSION: '0',
    });
    expect(version.message).toContain('ENGINE4_AUDIT_HMAC_KEY_VERSION');
    expect(version.message).toContain('1 to 999999999');
  });

  test('a user id that is not a non-empty string says so', () => {
    expect(() => hashUserId('', keyOf(KEY_A))).toThrow(
      new TypeError('a user id is a non-empty string')
    );
  });
});
