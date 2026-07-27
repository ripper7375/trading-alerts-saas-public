/**
 * Stripe Subscription Controller (Session 4A-9, File 3/10)
 *
 * Ports app/api/subscription/cancel/route.ts. Idempotent by construction
 * (audited 4A-W4): re-running sets tier/status to the same terminal values
 * again, and a repeat Stripe cancel call is caught and logged rather than
 * failing the request.
 *
 * Deviation from SOURCE: the monolith calls `sendCancellationEmail`
 * directly. Per Davin's explicit sign-off (this session), money-service
 * has no email-sending capability and none is being added here -- instead
 * this follows the established dLocal (Slice 2, 4A-5) precedent: write
 * domain state synchronously in one transaction, and emit an OutboxEvent
 * (`SUBSCRIPTION_CANCELLED`) in the SAME transaction for operation-service
 * to eventually consume (Slice 5 / 4A-11-12) and send the email from.
 */

import {
  BadRequestException,
  Controller,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { StripeService } from './stripe.service';

@Controller('stripe/subscriptions')
@UseGuards(JwtAuthGuard)
export class StripeSubscriptionController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService
  ) {}

  @Post('cancel')
  async cancel(
    @Req() request: AuthenticatedRequest
  ): Promise<{ success: true; message: string; tier: 'FREE' }> {
    try {
      const userId = request.user.id;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException({
          error: 'User not found',
          message: 'User account not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const userSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (user.tier === 'FREE' || !userSubscription) {
        throw new BadRequestException({
          error: 'No subscription',
          message: "You don't have an active PRO subscription",
          code: 'NO_SUBSCRIPTION',
        });
      }

      if (userSubscription.stripeSubscriptionId) {
        try {
          await this.stripeService.cancelSubscription(
            userSubscription.stripeSubscriptionId
          );
          logger.info('[Cancel] Cancelled Stripe subscription', {
            stripeSubscriptionId: userSubscription.stripeSubscriptionId,
          });
        } catch (error) {
          logger.error('[Cancel] Error cancelling Stripe subscription', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue with local cancellation even if Stripe fails -- the
          // webhook will eventually sync the status.
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            tier: 'FREE',
            trialStatus: 'CANCELLED',
            trialCancelledAt: new Date(),
          },
        });

        await tx.subscription.update({
          where: { id: userSubscription.id },
          data: { status: 'CANCELED' },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: userId,
          eventType: 'SUBSCRIPTION_CANCELLED',
          payload: { tier: 'FREE', subscriptionId: userSubscription.id },
        });
      });

      logger.info('[Cancel] User cancelled subscription', { userId });

      return {
        success: true,
        message: 'Subscription cancelled successfully',
        tier: 'FREE',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[Cancel] Error cancelling subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Cancellation failed',
        message: 'Failed to cancel subscription. Please try again.',
        code: 'CANCEL_ERROR',
      });
    }
  }
}
