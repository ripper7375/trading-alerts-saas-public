/**
 * Stripe Subscription Controller (Session 4A-9, File 3/10)
 *
 * Ports app/api/subscription/cancel/route.ts, and since Manage Subscription S2
 * also app/api/subscription/resume/route.ts. Manage Subscription S3 adds the
 * billing-period endpoints (workflows W5a and W5b), ported from
 * app/api/subscription/change-plan/ (preview, switch, keep yearly), and makes
 * cancel release a plan-switch schedule first.
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
 * so the "canceled, access until" e-mail), `SUBSCRIPTION_RESUMED`,
 * `SUBSCRIPTION_UPGRADED` (monthly to yearly, with the amount charged) and
 * `SUBSCRIPTION_DOWNGRADE_SCHEDULED` (yearly to monthly at the renewal date).
 */

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { StripeService, isStripeCardError, proItemOf } from './stripe.service';
import {
  allowedActionsOf,
  effectivePendingPlan,
  parseCancellationReason,
  parseChangePlanBody,
  planTypeForInterval,
  providerOf,
  sameUsdPrice,
  scheduleIdOf,
  type SubscriptionAction,
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
  pendingPlanType: true,
  stripeScheduleId: true,
} as const;

/** The row fields the billing-period endpoints read (explicit select, F21). */
const PLAN_CHANGE_SELECT = {
  id: true,
  status: true,
  planType: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeCurrentPeriodEnd: true,
  dLocalPaymentId: true,
  cancelAtPeriodEnd: true,
  pendingPlanType: true,
  pendingPlanEffectiveAt: true,
  stripeScheduleId: true,
} as const;

const PARSE_MESSAGES = {
  INVALID_BILLING_PERIOD: 'Choose monthly or yearly billing',
  INVALID_PRORATION_DATE:
    'The quote is missing. Please review the amount again.',
  PRORATION_EXPIRED: 'The quote has expired. Please review the amount again.',
  INVALID_EXPECTED_PRICE: 'The price shown could not be read',
} as const;

/** What the billing-period endpoints need before they touch Stripe. */
interface PlanChangeContext {
  tier: 'FREE' | 'PRO';
  row: {
    id: string;
    status: string;
    planType: string | null;
    stripeSubscriptionId: string;
    pendingPlanType: string | null;
    stripeScheduleId: string | null;
  };
  /** Stripe's live subscription. */
  live: Stripe.Subscription;
  itemId: string;
  /** The switch to monthly that is really waiting, else null. */
  pending: ReturnType<typeof effectivePendingPlan>;
  /** The schedule attached to the live subscription, if any. */
  liveScheduleId: string | null;
  inTrial: boolean;
  allowed: SubscriptionAction[];
}

@Controller('stripe/subscriptions')
@UseGuards(JwtAuthGuard)
export class StripeSubscriptionController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
    private readonly affiliateConfig: AffiliateConfigService
  ) {}

  /**
   * Manage Subscription S3: user, row, Stripe's live subscription and what the
   * user may do, before anything is changed. Stripe's answer wins where it
   * differs from the row: the plan billed now is the live item's interval, and a
   * switch to monthly is pending only while a schedule is still attached and the
   * subscription still bills yearly. Mirrors lib/stripe/plan-change-context.ts.
   */
  private async loadPlanChangeContext(
    userId: string
  ): Promise<PlanChangeContext> {
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

    const row = await this.prisma.subscription.findUnique({
      where: { userId },
      select: PLAN_CHANGE_SELECT,
    });

    if (user.tier === 'FREE' || !row) {
      throw new BadRequestException({
        error: 'No subscription',
        message: "You don't have an active PRO subscription",
        code: 'NO_SUBSCRIPTION',
      });
    }

    const provider = providerOf(row);
    // A dLocal plan is prepaid: the period is chosen again when it is renewed.
    if (provider === 'DLOCAL') {
      throw new BadRequestException({
        error: 'Nothing to change',
        message:
          'Your plan is prepaid. You choose the billing period each time you renew it.',
        code: 'DLOCAL_NO_CHANGE',
      });
    }
    if (provider !== 'STRIPE' || !row.stripeSubscriptionId) {
      throw new BadRequestException({
        error: 'No card subscription',
        message: 'You do not have a card subscription to change',
        code: 'NO_STRIPE_SUBSCRIPTION',
      });
    }

    const live = await this.stripeService.getSubscription(
      row.stripeSubscriptionId
    );
    const item = proItemOf(live);
    if (!item) {
      throw new BadRequestException({
        error: 'Unsupported subscription',
        message:
          'This subscription cannot be changed online. Please contact support.',
        code: 'UNSUPPORTED_SUBSCRIPTION',
      });
    }

    const livePlanType = planTypeForInterval(item.interval);
    const liveScheduleId = scheduleIdOf(live.schedule);
    const pending = effectivePendingPlan(row, {
      hasSchedule: liveScheduleId !== null,
      interval: item.interval,
    });
    const inTrial = live.status === 'trialing';
    // The row can still say ACTIVE for a while after checkout, until the first
    // webhook of the trial arrives; Stripe's word decides.
    const status = row.status === 'ACTIVE' && inTrial ? 'TRIALING' : row.status;

    const allowed = allowedActionsOf({
      tier: user.tier,
      status,
      provider,
      openInvoiceUrl: null,
      cancelAtPeriodEnd:
        typeof live.cancel_at_period_end === 'boolean'
          ? live.cancel_at_period_end
          : row.cancelAtPeriodEnd,
      currentPeriodEnd:
        typeof live.current_period_end === 'number'
          ? new Date(live.current_period_end * 1000)
          : row.stripeCurrentPeriodEnd,
      planType: livePlanType ?? row.planType,
      pendingPlanType: pending?.planType ?? null,
    });

    return {
      tier: user.tier,
      row: { ...row, stripeSubscriptionId: row.stripeSubscriptionId },
      live,
      itemId: item.id,
      pending,
      liveScheduleId,
      inTrial,
      allowed,
    };
  }

  /** The configured PRO Price; its absence makes a plan change unavailable. */
  private requireProPriceConfigured(): void {
    if (!this.configService.get<string>('STRIPE_PRO_PRICE_ID')) {
      logger.error('[PlanChange] STRIPE_PRO_PRICE_ID is not set');
      throw new ServiceUnavailableException({
        error: 'Configuration error',
        message: 'Changing your plan is temporarily unavailable.',
        code: 'PLAN_CHANGE_UNAVAILABLE',
      });
    }
  }

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

      // A schedule managing the subscription (a scheduled switch to monthly,
      // W5b, or the finished phase 2 of one) makes Stripe refuse
      // `cancel_at_period_end`, and cancelling makes the switch pointless:
      // release it first (W3) and drop the pending fields at once, so a failure
      // below cannot leave a switch the row remembers and Stripe no longer has.
      // Stripe's own subscription is read too, because a schedule the row does
      // not know about blocks the cancel the same way.
      try {
        const live = await this.stripeService.getSubscription(
          userSubscription.stripeSubscriptionId
        );
        const scheduleId =
          scheduleIdOf(live.schedule) ?? userSubscription.stripeScheduleId;
        if (scheduleId) {
          await this.stripeService.releaseSubscriptionSchedule(scheduleId);
        }
        if (scheduleId || userSubscription.pendingPlanType) {
          await this.prisma.subscription.update({
            where: { id: userSubscription.id },
            data: {
              pendingPlanType: null,
              pendingPlanEffectiveAt: null,
              stripeScheduleId: null,
            },
          });
        }
      } catch (error) {
        logger.error('[Cancel] Error releasing the plan-switch schedule', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new InternalServerErrorException({
          error: 'Cancellation failed',
          message: 'Failed to cancel subscription. Please try again.',
          code: 'CANCEL_ERROR',
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
  /**
   * Manage Subscription S3, workflow W5a: the quote for the upgrade from
   * monthly to yearly. Stripe's preview of the invoice that switching the PRO
   * item to the yearly SystemConfig price (D3) would create right now; nothing is
   * created or charged. Reads only: no outbox event, no idempotency cache.
   */
  @Get('change-plan/preview')
  async previewChangePlan(
    @Req() request: AuthenticatedRequest,
    @Query('billingPeriod') billingPeriod?: string
  ): Promise<{
    amountDueNowUsd: number;
    prorationDate: number;
    renewsOn: string | null;
    yearlyPriceUsd: number;
    creditUsd: number;
    taxUsd: number;
    inTrial: boolean;
  }> {
    try {
      if (billingPeriod !== 'yearly') {
        throw new BadRequestException({
          error: 'Invalid billing period',
          message: 'Only a switch to yearly billing has a quote',
          code: 'INVALID_BILLING_PERIOD',
        });
      }

      this.requireProPriceConfigured();
      const ctx = await this.loadPlanChangeContext(request.user.id);

      if (!ctx.allowed.includes('upgrade_to_yearly')) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'You cannot switch to yearly billing right now',
          code: 'ACTION_NOT_ALLOWED',
        });
      }

      const yearlyPriceUsd = await this.affiliateConfig.getAnnualPriceUsd();
      const yearlyLineItem = await this.stripeService.proLineItemFor(
        yearlyPriceUsd,
        'yearly'
      );
      const customerId =
        typeof ctx.live.customer === 'string'
          ? ctx.live.customer
          : ctx.live.customer.id;
      const prorationDate = Math.floor(Date.now() / 1000);

      const preview = await this.stripeService.previewYearlyUpgrade({
        customerId,
        subscription: ctx.live,
        itemId: ctx.itemId,
        yearlyLineItem,
        prorationDate,
      });

      return {
        amountDueNowUsd: preview.amountDueNowUsd,
        prorationDate,
        renewsOn: preview.renewsOn?.toISOString() ?? null,
        yearlyPriceUsd,
        creditUsd: preview.creditUsd,
        taxUsd: preview.taxUsd,
        inTrial: preview.inTrial,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[PlanChange] Error building the upgrade quote', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Preview failed',
        message: 'We could not calculate the charge. Please try again.',
        code: 'PREVIEW_ERROR',
      });
    }
  }

  /**
   * Manage Subscription S3, workflows W5a and W5b, decisions D2 and D3.
   *
   * - `{ billingPeriod: 'yearly', prorationDate }`: monthly to yearly NOW, with
   *   proration (`always_invoice`) at the quote's date, so the charge equals the
   *   amount shown. `error_if_incomplete` (E2): a declined card or a 3-D Secure
   *   request makes Stripe refuse the change, so the user stays monthly and is
   *   not charged. In a free trial (E3) the price changes now and nothing is
   *   charged until the trial ends.
   * - `{ billingPeriod: 'monthly' }`: yearly to monthly at the renewal date,
   *   through a Stripe Subscription Schedule; no refund, no prorated credit.
   */
  @Post('change-plan')
  @UseInterceptors(IdempotencyInterceptor)
  async changePlan(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ): Promise<Record<string, unknown>> {
    try {
      const userId = request.user.id;

      const parsed = parseChangePlanBody(body);
      if (!parsed.ok) {
        throw new BadRequestException({
          error: 'Invalid request',
          message: PARSE_MESSAGES[parsed.code],
          code: parsed.code,
        });
      }

      this.requireProPriceConfigured();
      const ctx = await this.loadPlanChangeContext(userId);

      //━━ W5a: monthly to yearly, now ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (parsed.billingPeriod === 'yearly') {
        if (!ctx.allowed.includes('upgrade_to_yearly')) {
          throw new BadRequestException({
            error: 'Not allowed',
            message: 'You cannot switch to yearly billing right now',
            code: 'ACTION_NOT_ALLOWED',
          });
        }

        const yearlyPriceUsd = await this.affiliateConfig.getAnnualPriceUsd();
        if (
          parsed.expectedYearlyPriceUsd !== null &&
          !sameUsdPrice(parsed.expectedYearlyPriceUsd, yearlyPriceUsd)
        ) {
          throw new ConflictException({
            error: 'Price changed',
            message:
              'The yearly price has changed. Please review the new amount.',
            code: 'PRICE_CHANGED',
            currentYearlyPriceUsd: yearlyPriceUsd,
          });
        }

        const yearlyLineItem = await this.stripeService.proLineItemFor(
          yearlyPriceUsd,
          'yearly'
        );

        // A schedule left attached (the finished phase 2 of an earlier switch)
        // would keep managing the subscription: release it before changing it.
        if (ctx.liveScheduleId) {
          await this.stripeService.releaseSubscriptionSchedule(
            ctx.liveScheduleId
          );
        }

        let updated: Stripe.Subscription;
        try {
          updated = await this.stripeService.upgradeToYearlyNow({
            subscriptionId: ctx.row.stripeSubscriptionId,
            itemId: ctx.itemId,
            yearlyLineItem,
            prorationDate: parsed.prorationDate,
            // One quote, one charge: a retry replays the same Stripe answer. A
            // new quote has a new date, so a new key.
            idempotencyKey: `change-plan:${ctx.row.stripeSubscriptionId}:yearly:${parsed.prorationDate}`,
          });
        } catch (error) {
          if (isStripeCardError(error)) {
            // E2: Stripe refused the change; the subscription is still monthly
            // and nothing was charged.
            logger.warn('[PlanChange] The upgrade charge was refused', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new HttpException(
              {
                error: 'Payment failed',
                message:
                  'Your card was not charged and you are still on the monthly plan. Update your card or try another one.',
                code: 'PAYMENT_FAILED',
              },
              402
            );
          }
          throw error;
        }

        const periodEnd = new Date(updated.current_period_end * 1000);
        const invoice =
          updated.latest_invoice && typeof updated.latest_invoice === 'object'
            ? updated.latest_invoice
            : null;
        const amountChargedUsd = invoice ? (invoice.amount_paid ?? 0) / 100 : 0;

        // The invoice webhook records YEARLY at the yearly price for a paid
        // switch, but a trial switch invoices $0 (which that handler skips), so
        // the row is written here for both. The webhook writes the same values.
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
              where: { id: ctx.row.id },
              data: {
                planType: 'YEARLY',
                amountUsd: yearlyPriceUsd,
                stripeCurrentPeriodEnd: periodEnd,
                expiresAt: periodEnd,
                pendingPlanType: null,
                pendingPlanEffectiveAt: null,
                stripeScheduleId: null,
              },
            });

            await this.outboxService.recordInTransaction(tx, {
              aggregateType: 'User',
              aggregateId: userId,
              eventType: 'SUBSCRIPTION_UPGRADED',
              payload: {
                tier: ctx.tier,
                subscriptionId: ctx.row.id,
                provider: 'STRIPE',
                amountChargedUsd,
                yearlyPriceUsd,
                nextBillingDate: periodEnd.toISOString(),
                inTrial: ctx.inTrial,
              },
            });
          });
        } catch (dbError) {
          // Stripe has switched and charged: do not tell the user it failed.
          // The webhooks bring the row in line.
          logger.error(
            '[PlanChange] The switch was made in Stripe but the row was not updated',
            {
              error:
                dbError instanceof Error ? dbError.message : 'Unknown error',
            }
          );
        }

        logger.info('[PlanChange] User switched to yearly billing', {
          userId,
          amountChargedUsd,
        });

        return {
          success: true,
          message: ctx.inTrial
            ? 'Your plan is now yearly. Nothing is charged until your free trial ends.'
            : 'Your plan is now yearly.',
          billingPeriod: 'yearly',
          amountChargedUsd,
          renewsOn: periodEnd.toISOString(),
          inTrial: ctx.inTrial,
        };
      }

      //━━ W5b: yearly to monthly, at the renewal ━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (ctx.pending) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'A switch to monthly billing is already scheduled',
          code: 'ALREADY_PENDING',
        });
      }
      if (!ctx.allowed.includes('switch_to_monthly')) {
        throw new BadRequestException({
          error: 'Not allowed',
          message: 'You cannot switch to monthly billing right now',
          code: 'ACTION_NOT_ALLOWED',
        });
      }

      const monthlyPriceUsd = await this.affiliateConfig.getBasePriceUsd();
      if (
        parsed.expectedMonthlyPriceUsd !== null &&
        !sameUsdPrice(parsed.expectedMonthlyPriceUsd, monthlyPriceUsd)
      ) {
        throw new ConflictException({
          error: 'Price changed',
          message:
            'The monthly price has changed. Please review the new amount.',
          code: 'PRICE_CHANGED',
          currentMonthlyPriceUsd: monthlyPriceUsd,
        });
      }

      const monthlyLineItem = await this.stripeService.proLineItemFor(
        monthlyPriceUsd,
        'monthly'
      );

      // A schedule attached while the row says nothing is pending is a
      // leftover or an orphan: it would clash with the new one.
      if (ctx.liveScheduleId) {
        await this.stripeService.releaseSubscriptionSchedule(
          ctx.liveScheduleId
        );
      }

      const schedule = await this.stripeService.scheduleSwitchToMonthly({
        subscriptionId: ctx.row.stripeSubscriptionId,
        monthlyLineItem,
      });
      const effectiveAt = new Date(ctx.live.current_period_end * 1000);

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: ctx.row.id },
            data: {
              pendingPlanType: 'MONTHLY',
              pendingPlanEffectiveAt: effectiveAt,
              stripeScheduleId: schedule.id,
            },
          });

          await this.outboxService.recordInTransaction(tx, {
            aggregateType: 'User',
            aggregateId: userId,
            eventType: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
            payload: {
              tier: ctx.tier,
              subscriptionId: ctx.row.id,
              provider: 'STRIPE',
              effectiveAt: effectiveAt.toISOString(),
              monthlyPriceUsd,
            },
          });
        });
      } catch (dbError) {
        // A schedule the row does not know about would switch the plan with no
        // sign of it on the page: take it back and let the user retry.
        try {
          await this.stripeService.releaseSubscriptionSchedule(schedule.id);
        } catch (releaseError) {
          logger.error(
            '[PlanChange] Could not take back the schedule after a failed write',
            {
              error:
                releaseError instanceof Error
                  ? releaseError.message
                  : 'Unknown error',
            }
          );
        }
        throw dbError;
      }

      logger.info('[PlanChange] User scheduled a switch to monthly billing', {
        userId,
        effectiveAt: effectiveAt.toISOString(),
      });

      return {
        success: true,
        message:
          'Your plan will switch to monthly billing at your renewal date.',
        billingPeriod: 'monthly',
        effectiveAt: effectiveAt.toISOString(),
        monthlyPriceUsd,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[PlanChange] Error changing the plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Plan change failed',
        message:
          'We could not change your plan. Nothing was charged. Please try again.',
        code: 'CHANGE_PLAN_ERROR',
      });
    }
  }

  /**
   * Manage Subscription S3, workflow W5b undo ("Keep yearly"): releases the
   * schedule and clears the pending fields. Anything pending, in the row or in
   * Stripe, is cleaned up; it charges nothing and is safe to repeat.
   */
  @Delete('change-plan')
  @UseInterceptors(IdempotencyInterceptor)
  async keepYearly(@Req() request: AuthenticatedRequest): Promise<{
    success: true;
    message: string;
    billingPeriod: 'yearly';
  }> {
    try {
      const userId = request.user.id;
      const ctx = await this.loadPlanChangeContext(userId);

      const scheduleId = ctx.liveScheduleId ?? ctx.row.stripeScheduleId;
      if (!ctx.row.pendingPlanType && !scheduleId) {
        throw new BadRequestException({
          error: 'Nothing to undo',
          message: 'No switch to monthly billing is scheduled',
          code: 'NOT_PENDING',
        });
      }

      if (scheduleId) {
        await this.stripeService.releaseSubscriptionSchedule(scheduleId);
      }

      await this.prisma.subscription.update({
        where: { id: ctx.row.id },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      });

      logger.info('[PlanChange] User kept yearly billing', { userId });

      return {
        success: true,
        message: 'Your plan stays yearly.',
        billingPeriod: 'yearly',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      logger.error('[PlanChange] Error withdrawing the switch', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error: 'Keep yearly failed',
        message: 'We could not keep your yearly plan. Please try again.',
        code: 'KEEP_YEARLY_ERROR',
      });
    }
  }
}
