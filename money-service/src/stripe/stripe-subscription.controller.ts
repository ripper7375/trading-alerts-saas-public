/**
 * Stripe Subscription Controller (Session 4A-9, File 3/10)
 *
 * Ports app/api/subscription/cancel/route.ts, and since Manage Subscription S2
 * also app/api/subscription/resume/route.ts.
 *
 * Cancel (workflow W3, decision D1) no longer ends the subscription at once: it
 * asks Stripe to cancel at the end of the paid period, so the user keeps PRO
 * until then and can resume (W4). The existing `customer.subscription.deleted`
 * webhook downgrades to FREE when the period actually ends. Stripe is called
 * first; if it refuses, nothing is recorded and the request can be retried
 * (the old immediate cancel recorded the cancellation even when Stripe failed).
 * Both calls are idempotent: Stripe returns the subscription unchanged when the
 * flag already has the requested value, and the row write sets fixed values.
 *
 * Deviation from SOURCE: the monolith calls the e-mail senders directly.
 * Per Davin's explicit sign-off (4A-9), money-service has no email-sending
 * capability and none is being added here -- instead this follows the
 * established dLocal (Slice 2, 4A-5) precedent: write domain state
 * synchronously in one transaction, and emit an OutboxEvent in the SAME
 * transaction for operation-service to eventually consume (Slice 5 /
 * 4A-11-12) and send the email from: `SUBSCRIPTION_CANCELLED` (with `cancelAt`,
 * so the "canceled, access until" e-mail) and `SUBSCRIPTION_RESUMED`.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { StripeService } from './stripe.service';
import {
  allowedActionsOf,
  parseCancellationReason,
  providerOf,
} from './subscription-actions';

/**
 * Explicit select (F21): a full-row read breaks the moment a column is added
 * and the code is deployed before its migration.
 */
const SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  stripeSubscriptionId: true,
  stripeCurrentPeriodEnd: true,
  dLocalPaymentId: true,
  expiresAt: true,
  cancelAtPeriodEnd: true,
} as const;

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

  /**
   * Manage Subscription S2, workflow W3: schedule the cancellation at the end
   * of the paid period. A dLocal plan is prepaid and has no cancel (D8).
   */
  @Post('cancel')
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ): Promise<{
    success: true;
    message: string;
    tier: 'FREE' | 'PRO';
    cancelAtPeriodEnd: true;
    cancelAt: string;
  }> {
    try {
      const userId = request.user.id;

      const parsed = parseCancellationReason(body);
      if (!parsed.ok) {
        throw new BadRequestException({
          error: 'Invalid reason',
          message: 'The reason must be text of at most 500 characters',
          code: 'INVALID_REASON',
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

      const userSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
      });

      if (user.tier === 'FREE' || !userSubscription) {
        throw new BadRequestException({
          error: 'No subscription',
          message: "You don't have an active PRO subscription",
          code: 'NO_SUBSCRIPTION',
        });
      }

      const provider = providerOf(userSubscription);

      // D8: a dLocal plan is prepaid, does not renew by itself and simply ends
      // at `expiresAt`, so there is nothing to cancel (and no days to forfeit).
      if (provider === 'DLOCAL') {
        throw new BadRequestException({
          error: 'Nothing to cancel',
          message:
            'Your plan is prepaid and ends on its expiry date. It does not renew automatically.',
          code: 'DLOCAL_NO_CANCEL',
          expiresAt: userSubscription.expiresAt?.toISOString() ?? null,
        });
      }

      if (provider !== 'STRIPE' || !userSubscription.stripeSubscriptionId) {
        throw new BadRequestException({
          error: 'No card subscription',
          message: 'You do not have a card subscription to cancel',
          code: 'NO_STRIPE_SUBSCRIPTION',
        });
      }

      if (userSubscription.cancelAtPeriodEnd) {
        throw new BadRequestException({
          error: 'Already scheduled',
          message: 'Your cancellation is already scheduled',
          code: 'ALREADY_SCHEDULED',
        });
      }

      // The server refuses what the page would not have offered (plan §6): a
      // failed payment has to be resolved first.
      const allowed = allowedActionsOf({
        tier: user.tier,
        status: userSubscription.status,
        provider,
        openInvoiceUrl: null,
        cancelAtPeriodEnd: userSubscription.cancelAtPeriodEnd,
        currentPeriodEnd: userSubscription.stripeCurrentPeriodEnd,
      });
      if (!allowed.includes('cancel')) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'You cannot cancel this subscription right now',
          code: 'ACTION_NOT_ALLOWED',
        });
      }

      // Stripe first: if it refuses, nothing is recorded and the user can try
      // again.
      let cancelAt: Date;
      try {
        const updated = await this.stripeService.setCancelAtPeriodEnd(
          userSubscription.stripeSubscriptionId,
          true
        );
        cancelAt = new Date(
          (updated.cancel_at ?? updated.current_period_end) * 1000
        );
        logger.info('[Cancel] Scheduled the Stripe cancellation', {
          stripeSubscriptionId: userSubscription.stripeSubscriptionId,
          cancelAt: cancelAt.toISOString(),
        });
      } catch (error) {
        logger.error('[Cancel] Error scheduling the Stripe cancellation', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new InternalServerErrorException({
          error: 'Cancellation failed',
          message: 'Failed to cancel subscription. Please try again.',
          code: 'CANCEL_ERROR',
        });
      }

      // The user keeps PRO (tier and status unchanged); the webhook downgrades
      // when Stripe ends the subscription. If this transaction fails the flag
      // is already set in Stripe, the webhook syncs it, and a retry is allowed.
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: userSubscription.id },
          data: {
            cancelAtPeriodEnd: true,
            cancelRequestedAt: new Date(),
            cancellationReason: parsed.reason,
          },
        });

        // `cancelAt` makes operation-service send the "canceled, you keep PRO
        // until <date>" e-mail.
        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: userId,
          eventType: 'SUBSCRIPTION_CANCELLED',
          payload: {
            tier: user.tier,
            subscriptionId: userSubscription.id,
            provider: 'STRIPE',
            cancelAt: cancelAt.toISOString(),
            scheduled: true,
          },
        });
      });

      logger.info('[Cancel] User scheduled their cancellation', { userId });

      return {
        success: true,
        message:
          'Your subscription will end at the close of the current period',
        tier: user.tier,
        cancelAtPeriodEnd: true,
        cancelAt: cancelAt.toISOString(),
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

  /**
   * Manage Subscription S2, workflow W4: undo a scheduled cancellation, only
   * while the subscription is CANCEL_SCHEDULED and before the period ends.
   */
  @Post('resume')
  @UseInterceptors(IdempotencyInterceptor)
  async resume(@Req() request: AuthenticatedRequest): Promise<{
    success: true;
    message: string;
    tier: 'FREE' | 'PRO';
    cancelAtPeriodEnd: false;
    renewsAt: string;
  }> {
    try {
      const userId = request.user.id;

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

      const userSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
      });

      if (user.tier === 'FREE' || !userSubscription) {
        throw new BadRequestException({
          error: 'No subscription',
          message: "You don't have an active PRO subscription",
          code: 'NO_SUBSCRIPTION',
        });
      }

      const provider = providerOf(userSubscription);
      if (provider !== 'STRIPE' || !userSubscription.stripeSubscriptionId) {
        throw new BadRequestException({
          error: 'No card subscription',
          message: 'You do not have a card subscription to resume',
          code: 'NO_STRIPE_SUBSCRIPTION',
        });
      }

      if (!userSubscription.cancelAtPeriodEnd) {
        throw new BadRequestException({
          error: 'Not scheduled',
          message: 'Your subscription is not scheduled to end',
          code: 'NOT_SCHEDULED',
        });
      }

      const periodEnd = userSubscription.stripeCurrentPeriodEnd;
      if (periodEnd && periodEnd.getTime() <= Date.now()) {
        throw new BadRequestException({
          error: 'Period ended',
          message:
            'Your subscription period has ended. Subscribe again from the pricing page.',
          code: 'PERIOD_ENDED',
        });
      }

      const allowed = allowedActionsOf({
        tier: user.tier,
        status: userSubscription.status,
        provider,
        openInvoiceUrl: null,
        cancelAtPeriodEnd: userSubscription.cancelAtPeriodEnd,
        currentPeriodEnd: periodEnd,
      });
      if (!allowed.includes('resume')) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'You cannot resume this subscription right now',
          code: 'ACTION_NOT_ALLOWED',
        });
      }

      // Stripe first: if it refuses (for example the subscription has just
      // ended), nothing is recorded.
      let renewsAt: Date;
      try {
        const updated = await this.stripeService.setCancelAtPeriodEnd(
          userSubscription.stripeSubscriptionId,
          false
        );
        renewsAt = new Date(updated.current_period_end * 1000);
      } catch (error) {
        logger.error('[Resume] Error resuming the Stripe subscription', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new InternalServerErrorException({
          error: 'Resume failed',
          message: 'Failed to resume your subscription. Please try again.',
          code: 'RESUME_ERROR',
        });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: userSubscription.id },
          data: {
            cancelAtPeriodEnd: false,
            cancelRequestedAt: null,
            cancellationReason: null,
          },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: userId,
          eventType: 'SUBSCRIPTION_RESUMED',
          payload: {
            tier: user.tier,
            subscriptionId: userSubscription.id,
            provider: 'STRIPE',
            renewsAt: renewsAt.toISOString(),
          },
        });
      });

      logger.info('[Resume] User resumed their subscription', { userId });

      return {
        success: true,
        message: 'Your subscription will continue',
        tier: user.tier,
        cancelAtPeriodEnd: false,
        renewsAt: renewsAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[Resume] Error resuming subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Resume failed',
        message: 'Failed to resume your subscription. Please try again.',
        code: 'RESUME_ERROR',
      });
    }
  }
}
