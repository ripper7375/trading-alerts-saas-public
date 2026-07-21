/**
 * Subscription Cron Service
 *
 * Ported from lib/cron/check-expiring-subscriptions.ts and
 * lib/cron/downgrade-expired-subscriptions.ts (Session 4A-2, File 2/6).
 * Query logic and status-mutation logic are byte-identical to source;
 * only the Prisma client access (module singleton -> injected
 * PrismaService) changed, per the order's port steps.
 *
 * @module crons/subscription.service
 */

import { Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class SubscriptionCronService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check for expiring dLocal subscriptions and mark them for reminders
   *
   * Identifies dLocal subscriptions expiring in 3 days and marks them for
   * renewal reminders. Only checks dLocal subscriptions (Stripe
   * auto-renews). Sends reminder 3 days before expiry. Marks reminder as
   * sent to prevent duplicates.
   *
   * @param options - Configuration options
   * @returns Result with reminders to send and any errors
   */
  async checkExpiringSubscriptions(
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
      const targetDate = new Date(
        now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000
      );
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
      const expiringSubscriptionRows = await this.prisma.subscription.findMany({
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
      });

      // Subscription no longer carries a `user` relation (Session 2-3 FK
      // audit) — batch-fetch contact users separately by userId.
      const expiringUsers = await this.prisma.user.findMany({
        where: { id: { in: expiringSubscriptionRows.map((s) => s.userId) } },
        select: { id: true, email: true, name: true },
      });
      const expiringUserById = new Map(expiringUsers.map((u) => [u.id, u]));
      const expiringSubscriptions = expiringSubscriptionRows.map((sub) => ({
        ...sub,
        user: expiringUserById.get(sub.userId),
      }));

      logger.info(
        `Found ${expiringSubscriptions.length} expiring subscriptions`
      );
      result.processed = expiringSubscriptions.length;

      for (const subscription of expiringSubscriptions) {
        try {
          if (
            !subscription.user ||
            !subscription.user.email ||
            !subscription.expiresAt
          ) {
            logger.warn(
              'Skipping subscription - missing user, email or expiry',
              {
                subscriptionId: subscription.id,
              }
            );
            continue;
          }

          // Mark reminder as sent (unless dry run)
          if (!dryRun) {
            await this.prisma.subscription.update({
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

  /**
   * Downgrade users with expired dLocal subscriptions
   *
   * Identifies expired dLocal subscriptions and downgrades users to FREE
   * tier. Only processes dLocal subscriptions (Stripe manages its own
   * lifecycle). Sets user tier to FREE, subscription status to CANCELED,
   * and creates a notification for the user.
   *
   * @param options - Configuration options
   * @returns Result with downgrades performed and any errors
   */
  async downgradeExpiredSubscriptions(
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
      const expiredSubscriptionRows = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          // Only dLocal subscriptions - they have dLocalPaymentId set
          dLocalPaymentId: { not: null },
          expiresAt: {
            lt: now,
          },
        },
      });

      // Subscription no longer carries a `user` relation (Session 2-3 FK
      // audit) — batch-fetch contact users separately by userId.
      const expiredUsers = await this.prisma.user.findMany({
        where: { id: { in: expiredSubscriptionRows.map((s) => s.userId) } },
        select: { id: true, email: true, name: true, tier: true },
      });
      const expiredUserById = new Map(expiredUsers.map((u) => [u.id, u]));
      const expiredSubscriptions = expiredSubscriptionRows.map((sub) => ({
        ...sub,
        user: expiredUserById.get(sub.userId),
      }));

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
            await this.prisma.user.update({
              where: { id: subscription.userId },
              data: { tier: 'FREE' },
            });

            // Mark subscription as expired/canceled
            await this.prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'CANCELED' },
            });

            // Create notification for user
            await this.prisma.notification.create({
              data: {
                userId: subscription.userId,
                type: 'SUBSCRIPTION',
                title: 'Subscription Expired',
                body: 'Your PRO subscription has expired. You have been downgraded to the FREE tier. Renew anytime to regain PRO access.',
                priority: 'HIGH',
              },
            });
          }

          if (subscription.user) {
            result.downgrades.push({
              userId: subscription.user.id,
              email: subscription.user.email,
              name: subscription.user.name,
              subscriptionId: subscription.id,
              expiredAt: subscription.expiresAt,
            });
          }

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
}
