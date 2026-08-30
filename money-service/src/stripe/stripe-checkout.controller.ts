/**
 * Stripe Checkout Controller (Session 4A-9, File 2/10)
 *
 * Ports app/api/checkout/route.ts. JwtAuthGuard's 401 replaces
 * getServerSession's own unauthenticated branch. The SOURCE's separate
 * "email required" 400 branch is dropped -- JwtAuthGuard's own contract
 * already requires `email` on any authenticated token
 * (jwt-auth.guard.ts: `if (!claims.id || !claims.email) throw
 * UnauthorizedException`), so that branch can no longer be reached here.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PrismaService } from '../prisma/prisma.service';

import { StripeService } from './stripe.service';

interface CheckoutRequestBody {
  affiliateCode?: string;
}

@Controller('stripe/checkout')
@UseGuards(JwtAuthGuard)
export class StripeCheckoutController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async createCheckout(
    @Req() request: AuthenticatedRequest,
    @Body() body: CheckoutRequestBody | undefined
  ): Promise<{ sessionId: string | undefined; url: string | null }> {
    try {
      const { id: userId, email, tier } = request.user;

      if (tier === 'PRO') {
        throw new BadRequestException({
          error: 'Already subscribed',
          message: 'You are already on the PRO tier',
          code: 'ALREADY_PRO',
        });
      }

      const affiliateCode = body?.affiliateCode;

      // Reuse an existing Stripe customer (e.g. re-subscribing after a
      // prior cancellation) so checkout can attach `customer_update` --
      // mirrors app/api/checkout/route.ts (davintrade-vat-stack). Also
      // doubles as the "has this account ever subscribed before" check
      // below (Subscription.userId is unique).
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: { stripeCustomerId: true },
      });

      // Recurring-commission follow-up: the one-time welcome discount (and
      // the commission it unlocks for the referring affiliate) is a
      // first-time benefit only -- mirrors app/api/checkout/route.ts.
      if (affiliateCode && existingSubscription) {
        throw new BadRequestException({
          error: 'Not eligible',
          message:
            'Affiliate discount codes only apply to your first subscription',
          code: 'AFFILIATE_CODE_FIRST_TIME_ONLY',
        });
      }

      let discountPercent = 0;
      let normalizedAffiliateCode: string | undefined;

      if (affiliateCode) {
        normalizedAffiliateCode = String(affiliateCode).trim().toUpperCase();

        const codeRecord = await this.prisma.affiliateCode.findFirst({
          where: {
            code: normalizedAffiliateCode,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
          include: {
            affiliateProfile: { select: { status: true } },
          },
        });

        if (!codeRecord || codeRecord.affiliateProfile?.status !== 'ACTIVE') {
          throw new BadRequestException({
            error: 'Invalid code',
            message: 'This affiliate code is invalid or expired',
            code: 'INVALID_AFFILIATE_CODE',
          });
        }

        discountPercent = codeRecord.discountPercent;
      }

      const baseUrl =
        this.configService.get<string>('NEXTAUTH_URL') ??
        'http://localhost:3000';
      const successUrl = `${baseUrl}/upgrade/success?upgrade=success`;
      const cancelUrl = `${baseUrl}/pricing?upgrade=cancelled`;

      const idempotencyKey = this.stripeService.buildCheckoutIdempotencyKey(
        userId,
        normalizedAffiliateCode
      );

      const checkoutSession = await this.stripeService.createCheckoutSession(
        userId,
        email,
        successUrl,
        cancelUrl,
        normalizedAffiliateCode,
        discountPercent,
        idempotencyKey,
        existingSubscription?.stripeCustomerId || undefined
      );

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      console.error('[Checkout] Error creating checkout session:', error);

      if (
        error instanceof Error &&
        error.message.includes('STRIPE_PRO_PRICE_ID')
      ) {
        throw new InternalServerErrorException({
          error: 'Configuration error',
          message: 'Stripe is not properly configured',
          code: 'STRIPE_CONFIG_ERROR',
        });
      }

      throw new InternalServerErrorException({
        error: 'Checkout failed',
        message: 'Failed to create checkout session. Please try again.',
        code: 'CHECKOUT_ERROR',
      });
    }
  }
}
