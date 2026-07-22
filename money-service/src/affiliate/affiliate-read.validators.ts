/**
 * Affiliate Read-API Validators (Session 4A-6, File 2/3)
 *
 * Ported from lib/affiliate/validators.ts — read-relevant subset only.
 * The source file also has affiliateRegistrationSchema,
 * affiliateCodeSchema/validateAffiliateCode, the 4 payment-details schemas,
 * affiliateProfileUpdateSchema, and paymentMethodUpdateSchema — all support
 * WRITE operations (registration, profile/payment-method updates), which
 * are explicitly out of scope for this Read APIs slice (mapped to Slice 4
 * per this order's own Context & Boundaries). Only the 2 query-param
 * schemas the 12 ported GET routes actually use are here, plus their
 * shared pagination base.
 */

import { z } from 'zod';

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
