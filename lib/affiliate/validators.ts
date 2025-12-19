/**
 * Affiliate System Validators
 *
 * Zod schemas and validation utilities for affiliate operations.
 *
 * @module lib/affiliate/validators
 */

import { z } from 'zod';

import { AFFILIATE_CONFIG, CODE_GENERATION } from './constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE REGISTRATION SCHEMA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Schema for affiliate registration request
 */
export const affiliateRegistrationSchema = z.object({
  /** Full legal name of affiliate */
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),

  /** ISO 3166-1 alpha-2 country code */
  country: z
    .string()
    .length(2, 'Country code must be exactly 2 characters')
    .toUpperCase(),

  /** Payment method for receiving commissions */
  paymentMethod: z.enum(AFFILIATE_CONFIG.PAYMENT_METHODS, {
    errorMap: () => ({
      message: `Payment method must be one of: ${AFFILIATE_CONFIG.PAYMENT_METHODS.join(', ')}`,
    }),
  }),

  /** Payment details specific to chosen method */
  paymentDetails: z
    .record(z.unknown())
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Payment details are required',
    }),

  /** Must accept terms and conditions */
  terms: z
    .boolean()
    .refine((val) => val === true, 'You must accept the terms and conditions'),

  /** Optional social media URLs */
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  youtubeUrl: z.string().url().optional().or(z.literal('')),
  tiktokUrl: z.string().url().optional().or(z.literal('')),
});

export type AffiliateRegistrationInput = z.infer<
  typeof affiliateRegistrationSchema
>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE CODE VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate affiliate code format
 *
 * @param code - Code string to validate
 * @returns true if code matches expected format
 *
 * @example
 * ```typescript
 * validateAffiliateCode('ABC12345'); // true
 * validateAffiliateCode('abc12345'); // false (lowercase)
 * validateAffiliateCode('ABC123');   // false (too short)
 * ```
 */
export function validateAffiliateCode(code: string): boolean {
  const pattern = new RegExp(`^[A-Z0-9]{${CODE_GENERATION.CODE_LENGTH}}$`);
  return pattern.test(code);
}

/**
 * Schema for affiliate code parameter
 */
export const affiliateCodeSchema = z
  .string()
  .length(
    CODE_GENERATION.CODE_LENGTH,
    `Code must be ${CODE_GENERATION.CODE_LENGTH} characters`
  )
  .regex(/^[A-Z0-9]+$/, 'Code must contain only uppercase letters and numbers')
  .transform((val) => val.toUpperCase());

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT DETAILS SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Schema for bank transfer payment details
 */
export const bankTransferDetailsSchema = z.object({
  accountName: z.string().min(2).max(100),
  bankName: z.string().min(2).max(100),
  accountNumber: z.string().min(5).max(34),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
});

/**
 * Schema for PayPal payment details
 */
export const paypalDetailsSchema = z.object({
  email: z.string().email('Invalid PayPal email'),
});

/**
 * Schema for cryptocurrency payment details
 */
export const cryptoDetailsSchema = z.object({
  walletAddress: z.string().min(26).max(64),
  network: z.enum(['USDT_TRC20', 'USDT_ERC20', 'BTC', 'ETH']),
});

/**
 * Schema for Wise payment details
 */
export const wiseDetailsSchema = z.object({
  email: z.string().email('Invalid Wise email'),
  accountId: z.string().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFILE UPDATE SCHEMA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Schema for updating affiliate profile
 */
export const affiliateProfileUpdateSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  facebookUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  youtubeUrl: z.string().url().optional().nullable(),
  tiktokUrl: z.string().url().optional().nullable(),
});

export type AffiliateProfileUpdateInput = z.infer<
  typeof affiliateProfileUpdateSchema
>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT METHOD UPDATE SCHEMA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Schema for updating payment method
 */
export const paymentMethodUpdateSchema = z.object({
  paymentMethod: z.enum(AFFILIATE_CONFIG.PAYMENT_METHODS),
  paymentDetails: z.record(z.unknown()),
});

export type PaymentMethodUpdateInput = z.infer<
  typeof paymentMethodUpdateSchema
>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY PARAMETER SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Schema for pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Schema for codes list query parameters
 */
export const codesListQuerySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED']).optional(),
});

/**
 * Schema for commission report query parameters
 */
export const commissionReportQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
