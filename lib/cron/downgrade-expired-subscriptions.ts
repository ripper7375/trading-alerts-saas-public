/**
 * Downgrade Expired Subscriptions Cron Service
 *
 * Identifies expired dLocal subscriptions and downgrades users
 * to FREE tier. This cron runs daily.
 *
 * Key Rules:
 * - Only processes dLocal subscriptions (Stripe manages its own lifecycle)
 * - Sets user tier to FREE
 * - Sets subscription status to CANCELED (using enum value)
 * - Creates notification for user
 *
 * @module lib/cron/downgrade-expired-subscriptions
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * Result of downgrade expired subscriptions job
 */
export interface DowngradeExpiredResult {
  downgrades: Array<{
    userId: string;
    email: string;
    name: string | null;
    subscriptionId: string;
    expiredAt: Date;
  }>;
  processed: number;
  errors: string[];
}

/**
 * Options for the downgrade expired subscriptions job
 */
export interface DowngradeExpiredOptions {
  /** Dry run - don't update database (default: false) */
  dryRun?: boolean;
}

/**
 * Downgrade users with expired dLocal subscriptions
 *
 * @param options - Configuration options
 * @returns Result with downgrades performed and any errors
 */
export async function downgradeExpiredSubscriptions(
  options: DowngradeExpiredOptions = {}
): Promise<DowngradeExpiredResult> {
  const { dryRun = false } = options;

  const result: DowngradeExpiredResult = {
    downgrades: [],
    processed: 0,
    errors: [],
  };

  try {
    const now = new Date();

    logger.info('Checking for expired subscriptions', {
      currentTime: now.toISOString(),
      dryRun,
    });

    // Find expired dLocal subscriptions that are still active
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        // Only dLocal subscriptions - they have dLocalPaymentId set
        dLocalPaymentId: { not: null },
        expiresAt: {
          lt: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            tier: true,
          },
        },
      },
    });

    logger.info(`Found ${expiredSubscriptions.length} expired subscriptions`);
    result.processed = expiredSubscriptions.length;

    for (const subscription of expiredSubscriptions) {
      try {
        if (!subscription.expiresAt) {
          logger.warn('Skipping subscription - missing expiry date', {
            subscriptionId: subscription.id,
          });
          continue;
        }

        if (!dryRun) {
          // Downgrade user to FREE tier
          await prisma.user.update({
            where: { id: subscription.userId },
            data: { tier: 'FREE' },
          });

          // Mark subscription as expired/canceled
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'CANCELED' },
          });

          // Create notification for user
          await prisma.notification.create({
            data: {
              userId: subscription.userId,
              type: 'SUBSCRIPTION',
              title: 'Subscription Expired',
              body: 'Your PRO subscription has expired. You have been downgraded to the FREE tier. Renew anytime to regain PRO access.',
              priority: 'HIGH',
            },
          });
        }

        result.downgrades.push({
          userId: subscription.user.id,
          email: subscription.user.email,
          name: subscription.user.name,
          subscriptionId: subscription.id,
          expiredAt: subscription.expiresAt,
        });

        logger.info('User downgraded due to expired subscription', {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          expiredAt: subscription.expiresAt,
          dryRun,
        });
      } catch (error) {
        const errorMessage = `Failed to downgrade user ${subscription.userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.errors.push(errorMessage);
        logger.error('Error downgrading user', {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Downgrade expired subscriptions completed', {
      processed: result.processed,
      downgrades: result.downgrades.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to downgrade expired subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
