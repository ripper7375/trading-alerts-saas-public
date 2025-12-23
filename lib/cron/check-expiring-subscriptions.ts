/**
 * Check Expiring Subscriptions Cron Service
 *
 * Identifies dLocal subscriptions expiring in 3 days and marks
 * them for renewal reminders. This cron runs daily.
 *
 * Key Rules:
 * - Only checks dLocal subscriptions (Stripe auto-renews)
 * - Sends reminder 3 days before expiry
 * - Marks reminder as sent to prevent duplicates
 *
 * @module lib/cron/check-expiring-subscriptions
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * Result of check expiring subscriptions job
 */
export interface CheckExpiringResult {
  reminders: Array<{
    userId: string;
    email: string;
    name: string | null;
    expiresAt: Date;
    subscriptionId: string;
    planType: string | null;
  }>;
  processed: number;
  errors: string[];
}

/**
 * Options for the check expiring subscriptions job
 */
export interface CheckExpiringOptions {
  /** Days before expiry to send reminder (default: 3) */
  daysBeforeExpiry?: number;
  /** Dry run - don't update database (default: false) */
  dryRun?: boolean;
}

/**
 * Check for expiring dLocal subscriptions and mark them for reminders
 *
 * @param options - Configuration options
 * @returns Result with reminders to send and any errors
 */
export async function checkExpiringSubscriptions(
  options: CheckExpiringOptions = {}
): Promise<CheckExpiringResult> {
  const { daysBeforeExpiry = 3, dryRun = false } = options;

  const result: CheckExpiringResult = {
    reminders: [],
    processed: 0,
    errors: [],
  };

  try {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);
    const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000); // 12 hours before target
    const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000); // 12 hours after target

    logger.info('Checking for expiring subscriptions', {
      targetDate: targetDate.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      dryRun,
    });

    // Find dLocal subscriptions expiring within the window
    // that haven't had a reminder sent yet
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        renewalReminderSent: false,
        // Only dLocal subscriptions - they have dLocalPaymentId set
        dLocalPaymentId: { not: null },
        expiresAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Found ${expiringSubscriptions.length} expiring subscriptions`);
    result.processed = expiringSubscriptions.length;

    for (const subscription of expiringSubscriptions) {
      try {
        if (!subscription.user || !subscription.user.email || !subscription.expiresAt) {
          logger.warn('Skipping subscription - missing user, email or expiry', {
            subscriptionId: subscription.id,
          });
          continue;
        }

        // Mark reminder as sent (unless dry run)
        if (!dryRun) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { renewalReminderSent: true },
          });
        }

        // Add to reminders list for email sending
        result.reminders.push({
          userId: subscription.user.id,
          email: subscription.user.email,
          name: subscription.user.name,
          expiresAt: subscription.expiresAt,
          subscriptionId: subscription.id,
          planType: subscription.planType,
        });

        logger.info('Renewal reminder marked for sending', {
          userId: subscription.user.id,
          subscriptionId: subscription.id,
          expiresAt: subscription.expiresAt,
          dryRun,
        });
      } catch (error) {
        const errorMessage = `Failed to process subscription ${subscription.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.errors.push(errorMessage);
        logger.error('Error processing subscription', {
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Check expiring subscriptions completed', {
      processed: result.processed,
      remindersSent: result.reminders.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to check expiring subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
