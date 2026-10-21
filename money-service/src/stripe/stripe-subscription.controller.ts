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
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { StripeService } from './stripe.service';
import { allowedActionsOf, providerOf } from './subscription-actions';

@Controller('stripe/subscriptions')
@UseGuards(JwtAuthGuard)
export class StripeSubscriptionController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Manage Subscription S1, workflow W1. Ports
   * app/api/subscription/payment-method-session/route.ts: a Billing Portal
   * session that opens only the card form. Writes nothing and charges
   * nothing, so it has no outbox event; and no idempotency cache, because a
   * portal URL expires within minutes and a cached one would be a dead link.
   */
  @Post('payment-method-session')
  async createPaymentMethodSession(
    @Req() request: AuthenticatedRequest
  ): Promise<{ url: string }> {
    try {
      const userId = request.user.id;

      // Refused before anything is created. No localhost fallback (Tier 2
      // §6.5): a missing NEXTAUTH_URL would send the user back to localhost.
      const configurationId = this.configService.get<string>(
        'STRIPE_PORTAL_CONFIGURATION_ID'
      );
      const baseUrl = this.configService.get<string>('NEXTAUTH_URL');
      if (!configurationId || !baseUrl) {
        logger.error(
          '[CardUpdate] STRIPE_PORTAL_CONFIGURATION_ID or NEXTAUTH_URL is not set; refusing to open the portal'
        );
        throw new ServiceUnavailableException({
          error: 'Configuration error',
          message:
            'Card updates are temporarily unavailable. Please try again later.',
          code: 'PORTAL_NOT_CONFIGURED',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });

      if (!user) {
        throw new NotFoundException({
          error: 'User not found',
          message: 'User account not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          dLocalPaymentId: true,
        },
      });

      if (!subscription?.stripeCustomerId) {
        throw new BadRequestException({
          error: 'No card on file',
          message: 'You do not have a card subscription to update',
          code: 'NO_STRIPE_SUBSCRIPTION',
        });
      }

      const allowed = allowedActionsOf({
        tier: user.tier,
        status: subscription.status,
        provider: providerOf(subscription),
        openInvoiceUrl: null,
      });
      if (!allowed.includes('update_card')) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'You cannot update your card for this subscription',
          code: 'ACTION_NOT_ALLOWED',
        });
      }

      const portal = await this.stripeService.createPaymentMethodUpdateSession(
        subscription.stripeCustomerId,
        configurationId,
        `${baseUrl}/settings/billing`,
        `${baseUrl}/settings/billing?done=card`
      );

      return { url: portal.url };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[CardUpdate] Error creating the portal session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Card update failed',
        message: 'Failed to open the card update page. Please try again.',
        code: 'PORTAL_SESSION_ERROR',
      });
    }
  }

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
