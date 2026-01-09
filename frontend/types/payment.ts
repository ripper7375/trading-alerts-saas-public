/**
 * Payment Types
 *
 * This file serves as a placeholder for additional payment-related types.
 *
 * Primary payment types are defined in:
 * - types/dlocal.ts - dLocal payment integration types
 * - types/prisma-stubs.d.ts - Payment model from Prisma schema
 *
 * @see {@link ./dlocal.ts} for dLocal payment types
 * @see {@link ./prisma-stubs.d.ts} for Prisma Payment model
 */

// Re-export commonly used payment types from dlocal.ts for convenience
export type {
  PaymentProvider,
  PaymentStatus,
  PlanType,
  DLocalCountry,
  DLocalCurrency,
  DLocalPaymentRequest,
  DLocalPaymentResponse,
  PaymentStatusResponse,
} from './dlocal';
