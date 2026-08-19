/**
 * Affiliate Registration Module
 *
 * Handles affiliate registration and initial code distribution.
 *
 * Registration requires an authenticated DavinTrade account, and every
 * account is already email/social-verified before it can reach this flow
 * (see lib/auth/auth-options.ts) — so there is no separate affiliate email
 * re-verification step. Registering activates the affiliate profile
 * immediately and distributes the first month's codes right away.
 *
 * @module lib/affiliate/registration
 */

import type { Prisma } from '.prisma/non-market-client';

type InputJsonValue = Prisma.InputJsonValue;

import { prisma } from '@/lib/db/prisma';
import { sendAffiliateWelcomeEmail } from '@/lib/email/email';

import { AFFILIATE_CONFIG, type PaymentMethod } from './constants';
import { distributeCodes } from './code-generator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RegisterAffiliateInput {
  userId: string;
  fullName: string;
  country: string;
  paymentMethod: PaymentMethod;
  paymentDetails: Record<string, unknown>;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
}

export interface RegistrationResult {
  success: boolean;
  message: string;
  profileId?: string;
  codesDistributed?: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTRATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Register a user as an affiliate
 *
 * - Validates user exists and is not already an affiliate
 * - Sets user.isAffiliate = true
 * - Creates AffiliateProfile as ACTIVE immediately — the account itself is
 *   already email/social-verified before it can reach this flow, so there is
 *   nothing left to re-verify here
 * - Distributes the first month's codes and sends a welcome email
 *
 * @param input - Registration data
 * @returns Registration result with success status
 * @throws Error if user not found or already registered
 */
export async function registerAffiliate(
  input: RegisterAffiliateInput
): Promise<RegistrationResult> {
  const {
    userId,
    fullName,
    country,
    paymentMethod,
    paymentDetails,
    facebookUrl,
    instagramUrl,
    twitterUrl,
    youtubeUrl,
    tiktokUrl,
  } = input;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if already an affiliate
  if (user.isAffiliate) {
    throw new Error('Already registered as affiliate');
  }

  // Set user as affiliate
  await prisma.user.update({
    where: { id: userId },
    data: { isAffiliate: true },
  });

  // Create affiliate profile, active immediately
  const profile = await prisma.affiliateProfile.create({
    data: {
      userId,
      fullName,
      country: country.toUpperCase(),
      paymentMethod,
      paymentDetails: paymentDetails as InputJsonValue,
      facebookUrl: facebookUrl || null,
      instagramUrl: instagramUrl || null,
      twitterUrl: twitterUrl || null,
      youtubeUrl: youtubeUrl || null,
      tiktokUrl: tiktokUrl || null,
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  });

  // Distribute the first month's codes
  await distributeCodes(
    profile.id,
    AFFILIATE_CONFIG.CODES_PER_MONTH,
    'INITIAL'
  );

  // Best-effort welcome email — registration has already succeeded, so a
  // delivery failure here shouldn't fail the request
  if (user.email) {
    try {
      await sendAffiliateWelcomeEmail(
        user.email,
        fullName,
        AFFILIATE_CONFIG.CODES_PER_MONTH
      );
    } catch (error) {
      console.error('[Affiliate Register] Welcome email failed:', error);
    }
  }

  return {
    success: true,
    message:
      'Registration successful. Your affiliate account is active and your first codes are ready.',
    profileId: profile.id,
    codesDistributed: AFFILIATE_CONFIG.CODES_PER_MONTH,
  };
}
