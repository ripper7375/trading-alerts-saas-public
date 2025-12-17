/**
 * Authentication Validation Schemas
 *
 * Zod schemas for authentication-related inputs:
 * signup, login, password reset, email verification.
 */

import { z } from 'zod';

/**
 * Password validation rules
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Simple password schema (for login - less strict)
 */
const simplePasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(128, 'Password must not exceed 128 characters');

/**
 * Email validation schema
 * Note: trim() and toLowerCase() must come BEFORE email validation
 * so that input like '  TEST@Example.COM  ' passes validation
 */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .min(5, 'Email is required')
  .max(254, 'Email must not exceed 254 characters');

/**
 * Name validation schema
 */
const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .trim();

/**
 * Signup schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Change password schema (for authenticated users)
 */
export const changePasswordSchema = z
  .object({
    currentPassword: simplePasswordSchema,
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

/**
 * Email verification schema
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Resend verification email schema
 */
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
