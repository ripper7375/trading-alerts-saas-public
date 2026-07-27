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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { logger } from '../common/logger.util';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PrismaService } from '../prisma/prisma.service';

import { convertUSDToLocal } from './currency-converter.service';
import { getPlanDuration, PRICING } from './dlocal.constants';
import type { DLocalCountry, DLocalCurrency } from './dlocal.types';
import {
  acquireCreatePaymentLock,
  createPayment,
} from './dlocal-payment.service';
import { isValidPaymentMethod } from './payment-methods.service';

const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
  currency: z.enum(['INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY']),
  discountCode: z.string().optional(),
});

@Controller('payments/dlocal')
@UseGuards(JwtAuthGuard)
export class DlocalPaymentController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('create')
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ): Promise<Record<string, unknown>> {
    try {
      const userId = request.user.id;

      const validationResult = createPaymentSchema.safeParse(body);
      if (!validationResult.success) {
        throw new BadRequestException({
          error: 'Validation error',
          details: validationResult.error.flatten().fieldErrors,
        });
      }

      const { country, paymentMethod, planType, currency, discountCode } =
        validationResult.data;

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

      if (user.tier === 'PRO' && userSubscription?.status === 'ACTIVE') {
        throw new ForbiddenException({
          error: 'You already have an active subscription',
        });
      }

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
        planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

      let discountAmount = 0;
      let normalizedDiscountCode: string | null = null;

      if (discountCode && planType === 'MONTHLY') {
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

      const { localAmount, exchangeRate } = await convertUSDToLocal(
        chargeUsd,
        currency as DLocalCurrency
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
