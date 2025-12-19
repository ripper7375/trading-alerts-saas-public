/**
 * Affiliate Types
 *
 * Type definitions for the affiliate system.
 * These types mirror the Prisma schema models.
 *
 * @module lib/affiliate/types
 */

import type { Decimal } from '@prisma/client/runtime/library';
import type { JsonValue } from '@prisma/client/runtime/library';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENUMS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AffiliateStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE';

export type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

export type DistributionReason = 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODELS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AffiliateProfile {
  id: string;
  userId: string;

  // Affiliate Info
  fullName: string;
  country: string;

  // Social Media (optional)
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;

  // Payment Preferences
  paymentMethod: string;
  paymentDetails: JsonValue;

  // Stats
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: Decimal | number;
  pendingCommissions: Decimal | number;
  paidCommissions: Decimal | number;

  // Status
  status: AffiliateStatus;
  verifiedAt: Date | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateCode {
  id: string;
  code: string;

  // Ownership
  affiliateProfileId: string;

  // Configuration
  discountPercent: number;
  commissionPercent: number;

  // Lifecycle
  status: CodeStatus;
  distributedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  cancelledAt: Date | null;
  distributionReason: DistributionReason;

  // Usage tracking
  usedBy: string | null;
  subscriptionId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface Commission {
  id: string;

  // Ownership
  affiliateProfileId: string;
  affiliateCodeId: string;

  // Transaction
  userId: string;
  subscriptionId: string | null;

  // Amounts
  grossRevenue: Decimal | number;
  discountAmount: Decimal | number;
  netRevenue: Decimal | number;
  commissionAmount: Decimal | number;
  commissionPercent: number;

  // Status
  status: CommissionStatus;
  earnedAt: Date;
  approvedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}
