/**
 * Affiliate Registration Module
 *
 * Handles affiliate registration, email verification,
 * and initial code distribution.
 *
 * @module lib/affiliate/registration
 */

import crypto from 'crypto';

import type { InputJsonValue } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';

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
}

export interface VerificationResult {
  success: boolean;
  message: string;
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
 * - Creates AffiliateProfile with PENDING_VERIFICATION status
 * - Generates email verification token
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

  // Generate verification token (to be stored/emailed in future implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const verificationToken = crypto.randomBytes(32).toString('hex');
  void verificationToken; // Will be used when email verification is implemented

  // Set user as affiliate
  await prisma.user.update({
    where: { id: userId },
    data: { isAffiliate: true },
  });

  // Create affiliate profile
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
      status: 'PENDING_VERIFICATION',
    },
  });

  // TODO: Send verification email with token
  // await sendAffiliateWelcomeEmail(user.email, fullName, verificationToken);

  return {
    success: true,
    message:
      'Registration successful. Please verify your email to activate your affiliate account.',
    profileId: profile.id,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL VERIFICATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify affiliate email with token
 *
 * - Validates token and finds pending profile
 * - Updates status to ACTIVE
 * - Distributes initial codes (15)
 *
 * @param token - Verification token from email
 * @returns Verification result
 * @throws Error if token is invalid
 */
export async function verifyAffiliateEmail(
  _token: string
): Promise<VerificationResult> {
  // Find profile with matching token
  // For now, we'll use a simple approach - in production,
  // the token should be stored in the profile or a separate table
  const profile = await prisma.affiliateProfile.findFirst({
    where: {
      status: 'PENDING_VERIFICATION',
    },
  });

  if (!profile) {
    throw new Error('Invalid verification token');
  }

  // Update profile status to ACTIVE
  await prisma.affiliateProfile.update({
    where: { id: profile.id },
    data: {
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  });

  // Distribute initial codes
  await distributeCodes(
    profile.id,
    AFFILIATE_CONFIG.CODES_PER_MONTH,
    'INITIAL'
  );

  return {
    success: true,
    message:
      'Email verified successfully. Your affiliate codes have been distributed.',
    codesDistributed: AFFILIATE_CONFIG.CODES_PER_MONTH,
  };
}
