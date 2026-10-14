/**
 * @jest-environment node
 */

import { createHmac } from 'crypto';

import * as engine4 from '@/lib/engine4/store/user-hash';
import {
  AUDIT_KEY_ENV,
  AUDIT_KEY_VERSION_ENV,
  AuditKeyError,
  hashTraceUser,
  resolveAuditKey,
  verifyUserHash,
} from '@/lib/platform/traces/hash';
import type { AuditKey } from '@/lib/platform/traces/hash';

const KEY_A: AuditKey = { key: 'a'.repeat(48), version: 1, source: 'ENV' };
const KEY_B: AuditKey = { key: 'b'.repeat(48), version: 2, source: 'ENV' };

describe('the keyed hash of the user id in request_traces (decision D5)', () => {
  it('is the Engine 4 helper itself, so one rule covers both audit tables', () => {
    expect(resolveAuditKey).toBe(engine4.resolveAuditKey);
    expect(verifyUserHash).toBe(engine4.verifyUserHash);
    expect(AuditKeyError).toBe(engine4.AuditKeyError);
    expect(AUDIT_KEY_ENV).toBe('ENGINE4_AUDIT_HMAC_KEY');
    expect(AUDIT_KEY_VERSION_ENV).toBe('ENGINE4_AUDIT_HMAC_KEY_VERSION');
  });

  it('is HMAC-SHA-256 of the id under the key, in hex, with the key version', () => {
    const expected = createHmac('sha256', KEY_A.key)
      .update('cm0user1', 'utf8')
      .digest('hex');
    expect(hashTraceUser('cm0user1', KEY_A)).toEqual({
      hash: expected,
      keyVersion: 1,
    });
    expect(hashTraceUser('cm0user1', KEY_A).hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the same hash Engine 4 writes for the same user, and a different one per key and per user', () => {
    expect(hashTraceUser('cm0user1', KEY_A)).toEqual(
      engine4.hashUserId('cm0user1', KEY_A)
    );
    expect(hashTraceUser('cm0user1', KEY_A).hash).not.toBe(
      hashTraceUser('cm0user2', KEY_A).hash
    );
    expect(hashTraceUser('cm0user1', KEY_A).hash).not.toBe(
      hashTraceUser('cm0user1', KEY_B).hash
    );
    expect(hashTraceUser('cm0user1', KEY_B).keyVersion).toBe(2);
  });

  it('is recognised with the key of its own version only', () => {
    const stored = hashTraceUser('cm0user1', KEY_A);
    expect(verifyUserHash('cm0user1', stored, KEY_A)).toBe('MATCH');
    expect(verifyUserHash('cm0user2', stored, KEY_A)).toBe('MISMATCH');
    expect(verifyUserHash('cm0user1', stored, KEY_B)).toBe('OTHER_KEY_VERSION');
  });

  it('refuses an empty or non-string id', () => {
    expect(() => hashTraceUser('', KEY_A)).toThrow(TypeError);
    expect(() => hashTraceUser(undefined as unknown as string, KEY_A)).toThrow(
      TypeError
    );
  });

  it('uses the environment key by default: the public test key in a test, never outside one', () => {
    // NODE_ENV is "test" under Jest: the default key is the public test key, and it says so
    const viaDefault = hashTraceUser('cm0user1');
    const key = resolveAuditKey();
    expect(key.source).toBe('TEST');
    expect(viaDefault).toEqual(hashTraceUser('cm0user1', key));
    // outside a test a missing key is an error, not a quiet fallback
    expect(() => resolveAuditKey({ NODE_ENV: 'production' })).toThrow(
      AuditKeyError
    );
    expect(() =>
      resolveAuditKey({ NODE_ENV: 'production', [AUDIT_KEY_ENV]: 'short' })
    ).toThrow(AuditKeyError);
    expect(
      resolveAuditKey({
        NODE_ENV: 'production',
        [AUDIT_KEY_ENV]: 'k'.repeat(40),
      }).source
    ).toBe('ENV');
  });
});
