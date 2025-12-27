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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/auth-options';
import { createPayment } from '@/lib/dlocal/dlocal-payment.service';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { isValidPaymentMethod } from '@/lib/dlocal/payment-methods.service';
import { PRICING, getPlanDuration } from '@/lib/dlocal/constants';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { DLocalCountry, DLocalCurrency } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

// Input validation schema
const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
  currency: z.enum(['INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY']),
  discountCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.tier === 'PRO' && user.subscription?.status === 'ACTIVE') {
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

    // Get USD pricing
    const usdAmount =
      planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

    // Convert to local currency
    const { localAmount, exchangeRate } = await convertUSDToLocal(
      usdAmount,
      currency as DLocalCurrency
    );

    // Calculate discount amount (full discount validation would be in Part 18B)
    const discountAmount = 0;

    logger.info('Creating payment', {
      userId,
      country,
      paymentMethod,
      planType,
      usdAmount,
      localAmount,
    });

    // Create payment record FIRST (before calling dLocal)
    const payment = await prisma.payment.create({
      data: {
        userId,
        provider: 'DLOCAL',
        providerPaymentId: '', // Will be updated after dLocal response
        providerStatus: 'PENDING',
        amount: localAmount,
        amountUSD: usdAmount,
        currency,
        country,
        paymentMethod,
        planType,
        duration: getPlanDuration(planType),
        discountCode: discountCode || null,
        discountAmount: discountAmount,
        status: 'PENDING',
      },
    });

    logger.info('Payment record created', { paymentId: payment.id, userId });

    // Create payment with dLocal
    const dLocalPayment = await createPayment({
      userId,
      amount: usdAmount,
      currency: currency as DLocalCurrency,
      country: country as DLocalCountry,
      paymentMethod,
      planType,
      discountCode,
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
