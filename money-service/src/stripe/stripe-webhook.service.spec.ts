/**
 * Stripe Webhook Service Tests (Session 4A-9, File 4/10, File 9/10)
 */
import { Test } from '@nestjs/testing';
import type Stripe from 'stripe';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let conversionProcessorMock: {
    processAffiliateConversion: jest.Mock;
    reserveAffiliateCode: jest.Mock;
    creditAffiliateCommission: jest.Mock;
  };
  let outboxServiceMock: { recordInTransaction: jest.Mock };
  let stripeServiceMock: { retrieveCharge: jest.Mock };

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
      reserveAffiliateCode: jest.fn().mockResolvedValue({
        reserved: false,
        reason: 'CODE_NOT_FOUND',
      }),
      creditAffiliateCommission: jest.fn().mockResolvedValue({
        processed: false,
        reason: 'CODE_NOT_FOUND',
      }),
    };
    outboxServiceMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    stripeServiceMock = {
      retrieveCharge: jest.fn(),
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
        { provide: StripeService, useValue: stripeServiceMock },
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

    it('reserves an affiliate code (marks USED) but does NOT credit a commission yet (commission-timing fix)', async () => {
      conversionProcessorMock.reserveAffiliateCode.mockResolvedValue({
        reserved: true,
        affiliateCodeId: 'code-1',
      });

      await service.handleCheckoutCompleted({
        ...baseSession,
        metadata: { userId: 'user-1', affiliateCode: 'AFF10' },
      } as unknown as Stripe.Checkout.Session);

      expect(conversionProcessorMock.reserveAffiliateCode).toHaveBeenCalledWith(
        { code: 'AFF10', userId: 'user-1', subscriptionId: 'sub_123' }
      );
      expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ affiliateCodeId: 'code-1' }),
        })
      );
      // The whole point of the fix: no money has been collected yet (7-day
      // trial), so no commission is credited at this stage.
      expect(
        conversionProcessorMock.creditAffiliateCommission
      ).not.toHaveBeenCalled();
      expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({ eventType: 'COMMISSION_CREDITED' })
      );
    });

    it('clears a stale affiliateCodeId when re-subscribing without a code this time', async () => {
      await service.handleCheckoutCompleted(baseSession); // no affiliateCode in metadata

      expect(
        conversionProcessorMock.reserveAffiliateCode
      ).not.toHaveBeenCalled();
      expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ affiliateCodeId: null }),
          create: expect.objectContaining({ affiliateCodeId: null }),
        })
      );
    });

    it('does not fail the webhook if reserving the affiliate code throws', async () => {
      conversionProcessorMock.reserveAffiliateCode.mockRejectedValue(
        new Error('db blip')
      );

      await expect(
        service.handleCheckoutCompleted({
          ...baseSession,
          metadata: { userId: 'user-1', affiliateCode: 'AFF10' },
        } as unknown as Stripe.Checkout.Session)
      ).resolves.toBeUndefined();
      expect(prismaMock.subscription.upsert).toHaveBeenCalled();
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

    const baseInvoice = {
      id: 'inv_123',
      customer: 'cus_123',
      total: 2900,
      tax: 0,
      currency: 'usd',
      customer_address: { country: 'US' },
      customer_tax_ids: [],
      lines: { data: [{ tax_rates: [] }] },
      status_transitions: { paid_at: 1735689600 },
    };

    it('renews monthly and emits PAYMENT_SUCCEEDED for a $29 invoice', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
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
        ...baseInvoice,
        total: 29000,
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

    it('upserts the invoice tax breakdown keyed on stripeInvoiceId (davintrade-vat-stack)', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
        amount_paid: 2900,
      } as unknown as Stripe.Invoice);

      expect(prismaMock.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeInvoiceId: 'inv_123' },
          create: expect.objectContaining({
            userId: 'user-1',
            subscriptionId: 'sub-row-1',
            stripeInvoiceId: 'inv_123',
            stripeCustomerId: 'cus_123',
            amountTotal: 29,
            taxAmount: 0,
            taxRate: 0,
            currency: 'USD',
            taxCountry: 'US',
            reverseCharge: false,
          }),
        })
      );
    });

    it('marks reverseCharge for a validated EU VAT ID with 0% tax applied', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
        amount_paid: 2900,
        customer_address: { country: 'DE' },
        customer_tax_ids: [{ type: 'eu_vat', value: 'DE123456789' }],
      } as unknown as Stripe.Invoice);

      expect(prismaMock.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            taxCountry: 'DE',
            customerTaxId: 'DE123456789',
            reverseCharge: true,
          }),
        })
      );
    });

    describe('affiliate commission crediting (commission-timing fix)', () => {
      it('credits the commission and clears the pending attribution when a code was reserved', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
          stripeSubscriptionId: 'sub_123',
          affiliateCodeId: 'code-1',
        } as never);
        conversionProcessorMock.creditAffiliateCommission.mockResolvedValue({
          processed: true,
          commissionId: 'comm-1',
          commissionAmount: 5.8,
          affiliateUserId: 'affiliate-user-1',
          code: 'AFF10',
          totalEarnings: 123.45,
        });

        await service.handleInvoiceSucceeded({
          ...baseInvoice,
          amount_paid: 2900,
        } as unknown as Stripe.Invoice);

        expect(
          conversionProcessorMock.creditAffiliateCommission
        ).toHaveBeenCalledWith({
          affiliateCodeId: 'code-1',
          userId: 'user-1',
          subscriptionId: 'sub_123',
          grossRevenueUsd: 29,
        });
        expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
          prismaMock,
          expect.objectContaining({
            eventType: 'COMMISSION_CREDITED',
            // The affiliate who earned the commission, NOT the paying
            // subscriber ('user-1' above).
            aggregateId: 'affiliate-user-1',
            payload: expect.objectContaining({
              commissionId: 'comm-1',
              commissionAmount: 5.8,
              totalEarnings: 123.45,
              code: 'AFF10',
              provider: 'STRIPE',
            }),
          })
        );
        expect(prismaMock.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-row-1' },
          data: { affiliateCodeId: null },
        });
      });

      it('does not credit anything when the subscription has no pending affiliate attribution', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
        } as never); // no affiliateCodeId

        await service.handleInvoiceSucceeded({
          ...baseInvoice,
          amount_paid: 2900,
        } as unknown as Stripe.Invoice);

        expect(
          conversionProcessorMock.creditAffiliateCommission
        ).not.toHaveBeenCalled();
      });

      it('does not fail invoice processing if commission crediting throws', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
          affiliateCodeId: 'code-1',
        } as never);
        conversionProcessorMock.creditAffiliateCommission.mockRejectedValue(
          new Error('db blip')
        );

        await expect(
          service.handleInvoiceSucceeded({
            ...baseInvoice,
            amount_paid: 2900,
          } as unknown as Stripe.Invoice)
        ).resolves.toBeUndefined();
        // The subscription renewal itself must still have gone through.
        expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
          prismaMock,
          expect.objectContaining({ eventType: 'PAYMENT_SUCCEEDED' })
        );
      });
    });
  });

  describe('handleChargeRefunded / handleChargeDisputeCreated (commission clawback)', () => {
    const mockCommission = {
      id: 'commission-1',
      affiliateProfileId: 'aff-1',
      commissionAmount: 5.8,
      status: 'PENDING',
    };

    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
        stripeSubscriptionId: 'sub_123',
      } as never);
    });

    it('cancels a PENDING commission and reverses the affiliate profile stats on refund', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(
        mockCommission as never
      );

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          totalCodesUsed: { decrement: 1 },
          totalEarnings: { decrement: 5.8 },
          pendingCommissions: { decrement: 5.8 },
        },
      });
    });

    it('also cancels an APPROVED (not yet disbursed) commission', async () => {
      prismaMock.commission.findFirst.mockResolvedValue({
        ...mockCommission,
        status: 'APPROVED',
      } as never);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('does NOT touch an already-PAID commission -- flags it for manual recovery instead', async () => {
      prismaMock.commission.findFirst.mockResolvedValue({
        ...mockCommission,
        status: 'PAID',
      } as never);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    });

    it('is idempotent: no-ops on an already-CANCELLED commission', async () => {
      prismaMock.commission.findFirst.mockResolvedValue({
        ...mockCommission,
        status: 'CANCELLED',
      } as never);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).not.toHaveBeenCalled();
    });

    it('no-ops when the refund has no associated affiliate commission at all', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(null);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).not.toHaveBeenCalled();
    });

    it('no-ops when there is no customer id on the charge', async () => {
      await service.handleChargeRefunded({
        customer: null,
      } as unknown as Stripe.Charge);

      expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('does not throw if the database errors mid-clawback', async () => {
      prismaMock.commission.findFirst.mockRejectedValue(new Error('db blip'));

      await expect(
        service.handleChargeRefunded({
          customer: 'cus_123',
        } as unknown as Stripe.Charge)
      ).resolves.toBeUndefined();
    });

    it('resolves the charge from the dispute payload via StripeService, then applies the same clawback', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(
        mockCommission as never
      );
      stripeServiceMock.retrieveCharge.mockResolvedValue({
        customer: 'cus_123',
      });

      await service.handleChargeDisputeCreated({
        charge: 'ch_123',
      } as unknown as Stripe.Dispute);

      expect(stripeServiceMock.retrieveCharge).toHaveBeenCalledWith('ch_123');
      expect(prismaMock.commission.update).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('does not throw if resolving the disputed charge fails', async () => {
      stripeServiceMock.retrieveCharge.mockRejectedValue(
        new Error('stripe api down')
      );

      await expect(
        service.handleChargeDisputeCreated({
          charge: 'ch_123',
        } as unknown as Stripe.Dispute)
      ).resolves.toBeUndefined();
      expect(prismaMock.commission.findFirst).not.toHaveBeenCalled();
    });
  });
});
