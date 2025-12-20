/**
 * 3-Day Plan Validator Service
 *
 * Handles validation and anti-abuse logic for the 3-day plan:
 * - Ensures 3-day plan can only be purchased ONCE per account (lifetime)
 * - Validates user doesn't have active subscription
 * - Marks 3-day plan as used after successful purchase
 *
 * @module lib/dlocal/three-day-validator.service
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * Result of 3-day plan eligibility check
 */
export interface ThreeDayPlanEligibilityResult {
  canPurchase: boolean;
  reason?: string;
  details?: {
    hasUsedThreeDayPlan: boolean;
    hasActiveSubscription: boolean;
  };
}

/**
 * Check if a user can purchase the 3-day plan
 *
 * Rules:
 * 1. User must not have already used the 3-day plan (lifetime limit)
 * 2. User must not have an active subscription (any provider)
 *
 * @param userId - User's database ID
 * @returns Eligibility result with reason if not eligible
 */
export async function canPurchaseThreeDayPlan(
  userId: string
): Promise<ThreeDayPlanEligibilityResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      logger.error('User not found for 3-day plan validation', { userId });
      return {
        canPurchase: false,
        reason: 'User not found',
      };
    }

    // Check if user has already used 3-day plan
    if (user.hasUsedThreeDayPlan) {
      logger.info('User already used 3-day plan', {
        userId,
        usedAt: user.threeDayPlanUsedAt,
      });
      return {
        canPurchase: false,
        reason: 'You have already used the 3-day plan. This offer is available only once per account.',
        details: {
          hasUsedThreeDayPlan: true,
          hasActiveSubscription: false,
        },
      };
    }

    // Check if user has an active subscription
    const hasActiveSubscription =
      user.subscription !== null &&
      user.subscription.status === 'ACTIVE' &&
      (user.subscription.expiresAt === null ||
        user.subscription.expiresAt > new Date());

    if (hasActiveSubscription) {
      logger.info('User has active subscription, cannot purchase 3-day plan', {
        userId,
        subscriptionId: user.subscription?.id,
      });
      return {
        canPurchase: false,
        reason: 'You already have an active subscription. The 3-day plan is only available for users without an active subscription.',
        details: {
          hasUsedThreeDayPlan: false,
          hasActiveSubscription: true,
        },
      };
    }

    logger.info('User eligible for 3-day plan', { userId });
    return {
      canPurchase: true,
      details: {
        hasUsedThreeDayPlan: false,
        hasActiveSubscription: false,
      },
    };
  } catch (error) {
    logger.error('Error checking 3-day plan eligibility', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Mark the 3-day plan as used for a user
 *
 * Called after successful payment to prevent reuse.
 *
 * @param userId - User's database ID
 */
export async function markThreeDayPlanUsed(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasUsedThreeDayPlan: true,
        threeDayPlanUsedAt: new Date(),
      },
    });

    logger.info('Marked 3-day plan as used', { userId });
  } catch (error) {
    logger.error('Error marking 3-day plan as used', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Validate that user can purchase a specific plan type
 *
 * This is a unified validation function that handles both 3-day and monthly plans.
 *
 * @param userId - User's database ID
 * @param planType - Type of plan to validate
 * @returns Eligibility result with reason if not eligible
 */
export async function validatePlanPurchase(
  userId: string,
  planType: 'THREE_DAY' | 'MONTHLY'
): Promise<ThreeDayPlanEligibilityResult> {
  if (planType === 'THREE_DAY') {
    return canPurchaseThreeDayPlan(userId);
  }

  // For monthly plan, just check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      canPurchase: false,
      reason: 'User not found',
    };
  }

  return { canPurchase: true };
}
