/**
 * Auth Validation Tests
 *
 * Tests for authentication validation schemas.
 */

import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from '@/lib/validations/auth';

describe('Auth Validation Schemas', () => {
  describe('signupSchema', () => {
    it('should validate valid signup data', () => {
      const valid = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalid = {
        email: 'invalid-email',
        password: 'SecurePass123',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should reject password without uppercase', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'securepass123',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'SECUREPASS123',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'SecurePassword',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'Pass1',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject name shorter than 2 characters', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'J',
      };

      const result = signupSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should trim and lowercase email', () => {
      const input = {
        email: '  TEST@Example.COM  ',
        password: 'SecurePass123!',
        name: 'John Doe',
      };

      const result = signupSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const valid = {
        email: 'test@example.com',
        password: 'anypassword',
      };

      const result = loginSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should accept any non-empty password (no strength requirements)', () => {
      const valid = {
        email: 'test@example.com',
        password: 'a',
      };

      const result = loginSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const invalid = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should default rememberMe to false', () => {
      const input = {
        email: 'test@example.com',
        password: 'password',
      };

      const result = loginSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rememberMe).toBe(false);
      }
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const valid = { email: 'test@example.com' };

      const result = forgotPasswordSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalid = { email: 'not-an-email' };

      const result = forgotPasswordSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate valid reset data', () => {
      const valid = {
        token: 'abc123',
        password: 'NewSecure123!',
        confirmPassword: 'NewSecure123!',
      };

      const result = resetPasswordSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalid = {
        token: 'abc123',
        password: 'NewSecure123!',
        confirmPassword: 'DifferentPass123!',
      };

      const result = resetPasswordSchema.safeParse(invalid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Passwords do not match');
      }
    });

    it('should reject weak password', () => {
      const invalid = {
        token: 'abc123',
        password: 'weak',
        confirmPassword: 'weak',
      };

      const result = resetPasswordSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate valid change password data', () => {
      const valid = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewSecure456!',
        confirmNewPassword: 'NewSecure456!',
      };

      const result = changePasswordSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject if new password matches current', () => {
      const invalid = {
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123',
        confirmNewPassword: 'SamePass123',
      };

      const result = changePasswordSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject mismatched new passwords', () => {
      const invalid = {
        currentPassword: 'OldPass123',
        newPassword: 'NewSecure456',
        confirmNewPassword: 'DifferentPass789',
      };

      const result = changePasswordSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });

  describe('verifyEmailSchema', () => {
    it('should validate valid token', () => {
      const valid = { token: 'verification-token-123' };

      const result = verifyEmailSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const invalid = { token: '' };

      const result = verifyEmailSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });
});
