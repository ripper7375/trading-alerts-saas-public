/**
 * dLocal Payment Controller (Session 4A-9, File 6/10)
 *
 * Ports app/api/payments/dlocal/create/route.ts. JwtAuthGuard's 401
 * replaces getServerSession's own unauthenticated branch. Depends on two
 * additional SOURCE files the order's own list omitted --
 * currency-converter.service.ts and payment-methods.service.ts -- both
 * ported alongside this file (same class of gap as File 4/10's missing
 * webhook-handlers.ts).
 */

import crypto from 'crypto';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { allowedActionsOf, providerOf } from '../stripe/subscription-actions';

import { convertUSDToLocal } from './currency-converter.service';
import { getPlanDuration } from './dlocal.constants';
import type { DLocalCountry, DLocalCurrency } from './dlocal.types';
import {
  acquireCreatePaymentLock,
  createPayment,
  getMissingDLocalConfig,
} from './dlocal-payment.service';
import { isValidPaymentMethod } from './payment-methods.service';

const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR', 'AE', 'BR']),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  planType: z.enum(['THREE_DAY', 'MONTHLY', 'YEARLY']),
  currency: z.enum([
    'INR',
    'NGN',
    'PKR',
    'VND',
    'IDR',
    'THB',
    'ZAR',
    'TRY',
    'AED',
    'BRL',
  ]),
  discountCode: z.string().optional(),
  // Manage Subscription S4 (W6): an active dLocal subscriber paying for another
  // period before the current one ends. Only a request; the server decides.
  renew: z.boolean().optional(),
});

@Controller('payments/dlocal')
@UseGuards(JwtAuthGuard)
export class DlocalPaymentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliateConfig: AffiliateConfigService,
    private readonly redis: RedisService
  ) {}

  @Post('create')
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ): Promise<Record<string, unknown>> {
    // Set once the PENDING Payment row exists, so the catch below can close it.
    let pendingPaymentId: string | null = null;

    try {
      // Remediation Tier 2 §6.5: refuse before any Payment row or lock exists.
      // Without the dLocal key (or NEXTAUTH_URL, which builds the webhook URL)
      // no real payment can complete; the service used to answer with a mock
      // PENDING payment and a fake link instead. The detail goes to the log
      // only: the caller learns that payments are unavailable, not why.
      const missingConfig = getMissingDLocalConfig();
      if (missingConfig.length > 0) {
        logger.error('dLocal payments are not configured; refusing checkout', {
          missing: missingConfig,
        });
        throw new ServiceUnavailableException({
          error: 'Payments are temporarily unavailable',
          message:
            'Payments are temporarily unavailable. Please try again later.',
          code: 'PAYMENTS_NOT_CONFIGURED',
        });
      }

      const userId = request.user.id;

      const validationResult = createPaymentSchema.safeParse(body);
      if (!validationResult.success) {
        throw new BadRequestException({
          error: 'Validation error',
          details: validationResult.error.flatten().fieldErrors,
        });
      }

      const {
        country,
        paymentMethod,
        planType,
        currency,
        discountCode: requestedDiscountCode,
        renew,
      } = validationResult.data;

      if (!isValidPaymentMethod(country as DLocalCountry, paymentMethod)) {
        throw new BadRequestException({
          error: 'Invalid payment method for this country',
          country,
          paymentMethod,
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException({ error: 'User not found' });
      }

      const userSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      // An active PRO subscriber cannot start a second subscription. The one
      // exception (S4, W6) is a dLocal subscriber who renews early: the server
      // reads their subscription and offers `renew_now` only for a live dLocal
      // plan, so the request's `renew` flag alone proves nothing.
      let renewing = false;
      if (user.tier === 'PRO' && userSubscription?.status === 'ACTIVE') {
        renewing =
          renew === true &&
          allowedActionsOf({
            tier: user.tier,
            status: userSubscription.status,
            provider: providerOf(userSubscription),
            openInvoiceUrl: null,
          }).includes('renew_now');
        if (!renewing) {
          throw new ForbiddenException({
            error: 'You already have an active subscription',
          });
        }
      }
      // No affiliate discount on a renewal (the code was used at the first
      // purchase).
      const discountCode = renewing ? undefined : requestedDiscountCode;

      if (planType === 'THREE_DAY' && user.hasUsedThreeDayPlan) {
        throw new ForbiddenException({
          error:
            'You have already used the 3-day plan. Please choose the monthly plan.',
        });
      }

      if (discountCode && planType === 'THREE_DAY') {
        throw new BadRequestException({
          error: 'Discount codes are only valid for monthly plans',
        });
      }

      const usdAmount =
        planType === 'THREE_DAY'
          ? await this.affiliateConfig.getThreeDayPriceUsd()
          : planType === 'YEARLY'
            ? await this.affiliateConfig.getAnnualPriceUsd()
            : await this.affiliateConfig.getBasePriceUsd();

      let discountAmount = 0;
      let normalizedDiscountCode: string | null = null;

      if (discountCode && planType !== 'THREE_DAY') {
        normalizedDiscountCode = discountCode.trim().toUpperCase();

        const affiliateCode = await this.prisma.affiliateCode.findFirst({
          where: {
            code: normalizedDiscountCode,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
          include: {
            affiliateProfile: { select: { status: true } },
          },
        });

        if (
          !affiliateCode ||
          affiliateCode.affiliateProfile?.status !== 'ACTIVE'
        ) {
          throw new BadRequestException({
            error: 'Invalid or expired discount code',
          });
        }

        discountAmount =
          Math.round(usdAmount * affiliateCode.discountPercent) / 100;
      }

      const chargeUsd = Math.round((usdAmount - discountAmount) * 100) / 100;

      // Rate from the USD table shared with the Next app through Redis, so
      // the charge matches the local price the checkout page showed
      const { localAmount, exchangeRate } = await convertUSDToLocal(
        chargeUsd,
        currency as DLocalCurrency,
        this.redis.getClient()
      );

      logger.info('Creating payment', {
        userId,
        country,
        paymentMethod,
        planType,
        usdAmount,
        localAmount,
      });

      const acquiredLock = await acquireCreatePaymentLock(
        userId,
        planType,
        currency
      );
      if (!acquiredLock) {
        throw new ConflictException({
          error: 'Duplicate request',
          message:
            'A payment request for this plan is already being processed. Please wait a moment before retrying.',
          code: 'DUPLICATE_PAYMENT_REQUEST',
        });
      }

      const payment = await this.prisma.payment.create({
        data: {
          userId,
          provider: 'DLOCAL',
          providerPaymentId: `pending-${crypto.randomUUID()}`,
          providerStatus: 'PENDING',
          amount: localAmount,
          amountUSD: usdAmount,
          currency,
          country,
          paymentMethod,
          planType,
          duration: getPlanDuration(planType),
          discountCode: normalizedDiscountCode,
          discountAmount,
          status: 'PENDING',
        },
      });

      pendingPaymentId = payment.id;

      logger.info('Payment record created', { paymentId: payment.id, userId });

      const dLocalPayment = await createPayment({
        userId,
        amount: chargeUsd,
        currency: currency as DLocalCurrency,
        country: country as DLocalCountry,
        paymentMethod,
        planType,
        discountCode: normalizedDiscountCode || undefined,
        email: user.email || undefined,
        name: user.name || undefined,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: dLocalPayment.paymentId },
      });

      logger.info('dLocal payment created', {
        paymentId: dLocalPayment.paymentId,
        orderId: dLocalPayment.orderId,
        userId,
      });

      return {
        paymentId: dLocalPayment.paymentId,
        orderId: dLocalPayment.orderId,
        paymentUrl: dLocalPayment.paymentUrl,
        status: dLocalPayment.status,
        amount: {
          local: localAmount,
          usd: usdAmount,
          currency,
        },
        exchangeRate,
        planType,
        planDuration: getPlanDuration(planType),
      };
    } catch (error) {
      // A rejected or failed attempt must not linger as PENDING. Done before
      // the HttpException early return so every failure after the row exists
      // is covered. A failure here must never hide the original error.
      if (pendingPaymentId) {
        try {
          await this.prisma.payment.update({
            where: { id: pendingPaymentId },
            data: { status: 'FAILED' },
          });
        } catch (updateError) {
          logger.error('Failed to mark payment FAILED', {
            paymentId: pendingPaymentId,
            error:
              updateError instanceof Error
                ? updateError.message
                : 'Unknown error',
          });
        }
      }

      if (error instanceof HttpException) throw error;

      logger.error('Failed to create payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new InternalServerErrorException({
        error:
          error instanceof Error ? error.message : 'Failed to create payment',
      });
    }
  }
}
