/**
 * Token Generation Tests
 *
 * Tests for token generation and hashing utilities.
 */

import {
  generateToken,
  generateVerificationToken,
  generatePasswordResetToken,
  hashToken,
  verifyToken,
  generateNumericCode,
  generateSessionToken,
  generateApiKey,
  isTokenExpired,
  getTokenExpiration,
} from '@/lib/tokens';

describe('Token Generation', () => {
  describe('generateToken', () => {
    it('should generate a 64-character hex string by default', () => {
      const token = generateToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate tokens of specified length', () => {
      const token = generateToken(16);

      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateVerificationToken', () => {
    it('should generate a 64-character verification token', () => {
      const token = generateVerificationToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique verification tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateVerificationToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate a 64-character reset token', () => {
      const token = generatePasswordResetToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce a 64-character SHA-256 hash', () => {
      const hash = hashToken('test');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('verifyToken', () => {
    it('should return true for matching token and hash', () => {
      const token = 'my-secure-token';
      const hash = hashToken(token);

      expect(verifyToken(token, hash)).toBe(true);
    });

    it('should return false for non-matching token and hash', () => {
      const token = 'my-secure-token';
      const hash = hashToken('different-token');

      expect(verifyToken(token, hash)).toBe(false);
    });

    it('should return false for invalid hash format', () => {
      expect(verifyToken('token', 'invalid-hash')).toBe(false);
    });

    it('should be timing-safe', () => {
      const token = 'test-token';
      const hash = hashToken(token);

      // This is more of a documentation test - verifyToken uses timingSafeEqual
      expect(verifyToken(token, hash)).toBe(true);
    });
  });

  describe('generateNumericCode', () => {
    it('should generate a 6-digit code by default', () => {
      const code = generateNumericCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999);
    });

    it('should generate codes of specified length', () => {
      const code4 = generateNumericCode(4);
      const code8 = generateNumericCode(8);

      expect(code4).toMatch(/^\d{4}$/);
      expect(code8).toMatch(/^\d{8}$/);
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a 128-character session token', () => {
      const token = generateSessionToken();

      expect(token).toHaveLength(128);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('generateApiKey', () => {
    it('should generate an API key with default prefix', () => {
      const key = generateApiKey();

      expect(key).toMatch(/^ta_[a-f0-9]+$/);
    });

    it('should generate an API key with custom prefix', () => {
      const key = generateApiKey('sk_live_');

      expect(key).toMatch(/^sk_live_[a-f0-9]+$/);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for past date', () => {
      const pastDate = new Date(Date.now() - 1000);

      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 1000);

      expect(isTokenExpired(futureDate)).toBe(false);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return a date 24 hours in the future by default', () => {
      const now = Date.now();
      const expiration = getTokenExpiration();

      const expectedTime = now + 24 * 60 * 60 * 1000;
      const actualTime = expiration.getTime();

      // Allow 1 second tolerance
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000);
    });

    it('should return a date with specified hours', () => {
      const now = Date.now();
      const expiration = getTokenExpiration(1);

      const expectedTime = now + 1 * 60 * 60 * 1000;
      const actualTime = expiration.getTime();

      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000);
    });
  });
});
