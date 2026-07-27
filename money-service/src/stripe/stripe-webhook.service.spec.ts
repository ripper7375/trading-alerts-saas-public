/**
 * Stripe Webhook Service Tests (Session 4A-9, File 4/10, File 9/10)
 */
import { Test } from '@nestjs/testing';
import type Stripe from 'stripe';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { StripeWebhookService } from './stripe-webhook.service';

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let conversionProcessorMock: { processAffiliateConversion: jest.Mock };
  let outboxServiceMock: { recordInTransaction: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    conversionProcessorMock = {
      processAffiliateConversion: jest.fn().mockResolvedValue({
        processed: false,
        reason: 'CODE_NOT_FOUND',
      }),
    };
    outboxServiceMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConversionProcessorService,
          useValue: conversionProcessorMock,
        },
        { provide: OutboxService, useValue: outboxServiceMock },
      ],
    }).compile();

    service = moduleRef.get(StripeWebhookService);
  });

  describe('handleCheckoutCompleted', () => {
    const baseSession = {
      metadata: { userId: 'user-1' },
      customer: 'cus_123',
      subscription: 'sub_123',
    } as unknown as Stripe.Checkout.Session;

    it('upgrades the user to PRO, upserts the subscription, and emits TIER_UPGRADED', async () => {
      await service.handleCheckoutCompleted(baseSession);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          tier: 'PRO',
          hasUsedFreeTrial: true,
          trialStatus: 'CONVERTED',
        }),
      });
      expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
            status: 'ACTIVE',
            amountUsd: 29,
            planType: 'MONTHLY',
          }),
        })
      );
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: 'TIER_UPGRADED',
          aggregateId: 'user-1',
        })
      );
    });

    it('does nothing if userId is missing from metadata', async () => {
      await service.handleCheckoutCompleted({
        metadata: {},
        customer: 'cus_123',
        subscription: 'sub_123',
      } as unknown as Stripe.Checkout.Session);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('credits an affiliate commission and emits COMMISSION_CREDITED when a code is present', async () => {
      conversionProcessorMock.processAffiliateConversion.mockResolvedValue({
        processed: true,
        commissionId: 'comm-1',
        commissionAmount: 5.8,
      });

      await service.handleCheckoutCompleted({
        ...baseSession,
        metadata: { userId: 'user-1', affiliateCode: 'AFF10' },
      } as unknown as Stripe.Checkout.Session);

      expect(
        conversionProcessorMock.processAffiliateConversion
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AFF10',
          userId: 'user-1',
          provider: 'STRIPE',
        })
      );
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({ eventType: 'COMMISSION_CREDITED' })
      );
    });

    it('does not fail the webhook if affiliate conversion processing throws', async () => {
      conversionProcessorMock.processAffiliateConversion.mockRejectedValue(
        new Error('db blip')
      );

      await expect(
        service.handleCheckoutCompleted({
          ...baseSession,
          metadata: { userId: 'user-1', affiliateCode: 'AFF10' },
        } as unknown as Stripe.Checkout.Session)
      ).resolves.toBeUndefined();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('downgrades the user to FREE when Stripe status is inactive', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleSubscriptionUpdated({
        id: 'sub_123',
        status: 'past_due',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-row-1' },
          data: expect.objectContaining({ status: 'PAST_DUE' }),
        })
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'FREE' },
      });
    });

    it('does not downgrade the user while trialing', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleSubscriptionUpdated({
        id: 'sub_123',
        status: 'trialing',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('is a no-op when the subscription is not found locally', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await service.handleSubscriptionUpdated({
        id: 'sub_unknown',
        status: 'active',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('downgrades the user, cancels the subscription, and emits SUBSCRIPTION_CANCELLED', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleSubscriptionDeleted({
        id: 'sub_123',
        cancel_at: null,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          tier: 'FREE',
          trialStatus: 'CANCELLED',
        }),
      });
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: { status: 'CANCELED' },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({ eventType: 'SUBSCRIPTION_CANCELLED' })
      );
    });
  });

  describe('handleInvoiceFailed', () => {
    it('marks the subscription PAST_DUE and emits PAYMENT_FAILED', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceFailed({
        customer: 'cus_123',
        last_finalization_error: { message: 'card_declined' },
      } as unknown as Stripe.Invoice);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: { status: 'PAST_DUE' },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: 'PAYMENT_FAILED',
          payload: expect.objectContaining({ failureReason: 'card_declined' }),
        })
      );
    });
  });

  describe('handleInvoiceSucceeded', () => {
    it('skips $0 invoices (trial period)', async () => {
      await service.handleInvoiceSucceeded({
        customer: 'cus_123',
        amount_paid: 0,
      } as unknown as Stripe.Invoice);

      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('renews monthly and emits PAYMENT_SUCCEEDED for a $29 invoice', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        customer: 'cus_123',
        amount_paid: 2900,
      } as unknown as Stripe.Invoice);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-row-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            planType: 'MONTHLY',
            amountUsd: 29,
          }),
        })
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'PRO' },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({ eventType: 'PAYMENT_SUCCEEDED' })
      );
    });

    it('renews yearly for a $290+ invoice', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        customer: 'cus_123',
        amount_paid: 29000,
      } as unknown as Stripe.Invoice);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planType: 'YEARLY',
            amountUsd: 290,
          }),
        })
      );
    });
  });
});
