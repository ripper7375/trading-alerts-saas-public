/**
 * POST /api/payments/dlocal/create
 *
 * Creates a new dLocal payment for subscription.
 *
 * Request Body:
 * - country: ISO 2-letter country code (required)
 * - paymentMethod: Payment method ID (required)
 * - planType: 'THREE_DAY' | 'MONTHLY' (required)
 * - currency: 3-letter currency code (required)
 * - discountCode: Optional discount code (only for MONTHLY)
 *
 * Response:
 * - 200: Payment created with redirect URL
 * - 400: Validation error
 * - 401: Unauthorized
 * - 403: Not allowed (already has subscription, etc.)
 */

import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/auth-options';
import {
  createPayment,
  acquireCreatePaymentLock,
} from '@/lib/dlocal/dlocal-payment.service';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { isValidPaymentMethod } from '@/lib/dlocal/payment-methods.service';
import { PRICING, getPlanDuration } from '@/lib/dlocal/constants';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { shouldUseMoneyServiceForDlocalWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';
import type { DLocalCountry, DLocalCurrency } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

// Input validation schema
const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR', 'AE']),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
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
  ]),
  discountCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Session 4A-10a: money-service's DlocalPaymentController (Session 4A-9
    // PORT) already re-implements this route in full, including its
    // acquireCreatePaymentLock idempotency guard -- forward the raw request
    // instead of running this logic twice.
    if (shouldUseMoneyServiceForDlocalWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/payments/dlocal/create'
      );
      return NextResponse.json(data);
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { country, paymentMethod, planType, currency, discountCode } =
      validationResult.data;

    // Validate payment method for country
    if (!isValidPaymentMethod(country as DLocalCountry, paymentMethod)) {
      return NextResponse.json(
        {
          error: 'Invalid payment method for this country',
          country,
          paymentMethod,
        },
        { status: 400 }
      );
    }

    // Check if user is already PRO
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // User no longer carries a `subscription` relation (Session 2-3 FK
    // audit) — look it up separately by userId.
    const userSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (user.tier === 'PRO' && userSubscription?.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 403 }
      );
    }

    // Check 3-day plan restriction
    if (planType === 'THREE_DAY' && user.hasUsedThreeDayPlan) {
      return NextResponse.json(
        {
          error:
            'You have already used the 3-day plan. Please choose the monthly plan.',
        },
        { status: 403 }
      );
    }

    // Discount codes only allowed on monthly plan
    if (discountCode && planType === 'THREE_DAY') {
      return NextResponse.json(
        { error: 'Discount codes are only valid for monthly plans' },
        { status: 400 }
      );
    }

    // Get USD pricing (gross, before discount)
    const usdAmount =
      planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

    // Validate affiliate/discount code and calculate the discount actually
    // applied to the charge (Part 17 integration).
    let discountAmount = 0;
    let normalizedDiscountCode: string | null = null;

    if (discountCode && planType === 'MONTHLY') {
      normalizedDiscountCode = discountCode.trim().toUpperCase();

      const affiliateCode = await prisma.affiliateCode.findFirst({
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
        return NextResponse.json(
          { error: 'Invalid or expired discount code' },
          { status: 400 }
        );
      }

      discountAmount =
        Math.round(usdAmount * affiliateCode.discountPercent) / 100;
    }

    // Amount the customer is actually charged (USD), after discount
    const chargeUsd = Math.round((usdAmount - discountAmount) * 100) / 100;

    // Convert the discounted amount to local currency
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

    // Idempotency guard (4A-8, CC-C audit fix): collapse a double-click or
    // client retry into a single dLocal charge attempt instead of creating
    // a second Payment row / initiating a second charge for the same plan.
    const acquiredLock = await acquireCreatePaymentLock(
      userId,
      planType,
      currency
    );
    if (!acquiredLock) {
      return NextResponse.json(
        {
          error: 'Duplicate request',
          message:
            'A payment request for this plan is already being processed. Please wait a moment before retrying.',
          code: 'DUPLICATE_PAYMENT_REQUEST',
        },
        { status: 409 }
      );
    }

    // Create payment record FIRST (before calling dLocal)
    const payment = await prisma.payment.create({
      data: {
        userId,
        provider: 'DLOCAL',
        // Unique placeholder, not '': providerPaymentId is @unique across
        // the WHOLE table (not per-user), so a bare '' would collide with
        // any other concurrent pending payment from a DIFFERENT user
        // (pre-existing bug, found while adding this guard -- fixed as
        // part of the same write path, see this order's Deviations).
        providerPaymentId: `pending-${randomUUID()}`, // Will be updated after dLocal response
        providerStatus: 'PENDING',
        amount: localAmount,
        amountUSD: usdAmount,
        currency,
        country,
        paymentMethod,
        planType,
        duration: getPlanDuration(planType),
        discountCode: normalizedDiscountCode,
        discountAmount: discountAmount,
        status: 'PENDING',
      },
    });

    logger.info('Payment record created', { paymentId: payment.id, userId });

    // Create payment with dLocal
    const dLocalPayment = await createPayment({
      userId,
      amount: chargeUsd,
      currency: currency as DLocalCurrency,
      country: country as DLocalCountry,
      paymentMethod,
      planType,
      discountCode: normalizedDiscountCode || undefined,
      email: session.user.email || undefined,
      name: session.user.name || undefined,
    });

    // Update payment with dLocal ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: dLocalPayment.paymentId,
      },
    });

    logger.info('dLocal payment created', {
      paymentId: dLocalPayment.paymentId,
      orderId: dLocalPayment.orderId,
      userId,
    });

    return NextResponse.json({
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
    });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    logger.error('Failed to create payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create payment',
      },
      { status: 500 }
    );
  }
}
