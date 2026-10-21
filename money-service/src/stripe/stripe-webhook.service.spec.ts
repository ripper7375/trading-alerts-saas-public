/**
 * Stripe Webhook Service Tests (Session 4A-9, File 4/10, File 9/10)
 */
import { Test } from '@nestjs/testing';
import type Stripe from 'stripe';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { OutboxService } from '../outbox/outbox.service';
import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
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
          provide: AffiliateConfigService,
          useValue: {
            getBasePriceUsd: jest.fn().mockResolvedValue(35),
            getThreeDayPriceUsd: jest.fn().mockResolvedValue(2.49),
            getCodesPerMonth: jest.fn().mockResolvedValue(12),
            getAnnualPriceUsd: jest.fn().mockResolvedValue(350),
          },
        },
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

    it('starts a re-subscribing user clean: the row of an earlier cancellation is not scheduled to end (S2)', async () => {
      await service.handleCheckoutCompleted(baseSession);

      // The update branch is what a returning user hits (Subscription.userId is
      // unique); the create branch gets the column defaults.
      const { update, create } =
        prismaMock.subscription.upsert.mock.calls[0]![0]!;
      expect(update).toMatchObject({
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        cancellationReason: null,
      });
      expect(create).not.toHaveProperty('cancelAtPeriodEnd');
    });

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
            amountUsd: 35, // the SystemConfig PRO price, as charged
            planType: 'MONTHLY',
          }),
        })
      );
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: 'TIER_UPGRADED',
          aggregateId: 'user-1',
          payload: {
            tier: 'PRO',
            provider: 'STRIPE',
            billingPeriod: 'monthly',
            priceUsd: 35,
          },
        })
      );
    });

    it('carries the yearly SystemConfig price in the TIER_UPGRADED payload for a yearly checkout', async () => {
      await service.handleCheckoutCompleted({
        ...baseSession,
        metadata: { userId: 'user-1', billingPeriod: 'yearly' },
      } as unknown as Stripe.Checkout.Session);

      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: 'TIER_UPGRADED',
          payload: expect.objectContaining({
            billingPeriod: 'yearly',
            priceUsd: 350,
          }),
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
    it('downgrades the user to FREE when Stripe status is unpaid', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleSubscriptionUpdated({
        id: 'sub_123',
        status: 'unpaid',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-row-1' },
          data: expect.objectContaining({ status: 'UNPAID' }),
        })
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'FREE' },
      });
    });

    // Manage Subscription S2, defect B9: cancel_at_period_end follows Stripe.
    describe('cancel_at_period_end (B9)', () => {
      const row = { id: 'sub-row-1', userId: 'user-1' } as never;

      it('stores the scheduled cancellation and leaves the request details the cancel route wrote', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue(row);

        await service.handleSubscriptionUpdated({
          id: 'sub_123',
          status: 'active',
          current_period_end: 1234567890,
          cancel_at_period_end: true,
        } as unknown as Stripe.Subscription);

        const { data } = prismaMock.subscription.update.mock.calls[0]![0]!;
        expect(data).toMatchObject({ cancelAtPeriodEnd: true });
        expect(data).not.toHaveProperty('cancelRequestedAt');
        expect(data).not.toHaveProperty('cancellationReason');
        // A scheduled cancellation is still PRO until Stripe ends it.
        expect(prismaMock.user.update).not.toHaveBeenCalled();
      });

      it('clears the flag and the details of the earlier request when Stripe says it is off', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue(row);

        await service.handleSubscriptionUpdated({
          id: 'sub_123',
          status: 'active',
          current_period_end: 1234567890,
          cancel_at_period_end: false,
        } as unknown as Stripe.Subscription);

        expect(prismaMock.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-row-1' },
          data: expect.objectContaining({
            cancelAtPeriodEnd: false,
            cancelRequestedAt: null,
            cancellationReason: null,
          }),
        });
      });

      it('reads a missing field as off, never as scheduled', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue(row);

        await service.handleSubscriptionUpdated({
          id: 'sub_123',
          status: 'active',
          current_period_end: 1234567890,
        } as unknown as Stripe.Subscription);

        expect(
          prismaMock.subscription.update.mock.calls[0]![0]!.data
        ).toMatchObject({ cancelAtPeriodEnd: false });
      });

      it('writes the flag in the same transaction as the tier, and still downgrades a subscription Stripe has ended', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue(row);

        await service.handleSubscriptionUpdated({
          id: 'sub_123',
          status: 'canceled',
          current_period_end: 1234567890,
          cancel_at_period_end: true,
        } as unknown as Stripe.Subscription);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { tier: 'FREE' },
        });
      });
    });

    it('keeps the user on PRO while the subscription is past_due (B1: Stripe retry window)', async () => {
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
      // The grace period: no tier write at all, so PRO stays.
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    // The tier rule of the Manage Subscription plan §5, driven through the
    // real handler. The same table runs against the monolith's handler in
    // __tests__/lib/stripe/webhook-handlers.test.ts.
    it.each([
      ['active', 'ACTIVE', false],
      ['trialing', 'TRIALING', false],
      ['past_due', 'PAST_DUE', false],
      ['unpaid', 'UNPAID', true],
      ['canceled', 'CANCELED', true],
      ['incomplete', 'INACTIVE', true],
      ['incomplete_expired', 'INACTIVE', true],
      ['paused', 'INACTIVE', true],
    ])(
      'status %s is stored as %s and removes PRO: %s',
      async (stripeStatus, dbStatus, removesPro) => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
        } as never);

        await service.handleSubscriptionUpdated({
          id: 'sub_123',
          status: stripeStatus,
          current_period_end: 1234567890,
        } as unknown as Stripe.Subscription);

        expect(prismaMock.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: dbStatus }),
          })
        );
        if (removesPro) {
          expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { tier: 'FREE' },
          });
        } else {
          expect(prismaMock.user.update).not.toHaveBeenCalled();
        }
      }
    );

    it('never grants PRO from a subscription.updated event (invoice.payment_succeeded does)', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleSubscriptionUpdated({
        id: 'sub_123',
        status: 'active',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
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

    describe('atomic write (Remediation Tier 2 §6.4, 4A-13 audit item b)', () => {
      // `unpaid` is a status that removes PRO, so it has a tier write to make
      // atomic (a `past_due` event writes none, see above).
      const unpaid = {
        id: 'sub_123',
        status: 'unpaid',
        current_period_end: 1234567890,
      } as unknown as Stripe.Subscription;

      beforeEach(() => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
        } as never);
      });

      it('writes the subscription and the user tier inside ONE transaction', async () => {
        await service.handleSubscriptionUpdated(unpaid);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      });

      it('writes the subscription first and the downgrade second, in that transaction', async () => {
        await service.handleSubscriptionUpdated(unpaid);

        const subscriptionWrite = prismaMock.subscription.update.mock
          .invocationCallOrder[0] as number;
        const userWrite = prismaMock.user.update.mock
          .invocationCallOrder[0] as number;
        expect(subscriptionWrite).toBeLessThan(userWrite);
      });

      it('rolls the subscription change back, and rethrows, when the tier downgrade fails', async () => {
        prismaMock.user.update.mockRejectedValue(new Error('db blip'));
        // a real transaction rolls back every statement when the callback throws
        let rolledBack = false;
        prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
          try {
            return await (cb as (tx: unknown) => unknown)(prismaMock);
          } catch (error) {
            rolledBack = true;
            throw error;
          }
        });

        await expect(service.handleSubscriptionUpdated(unpaid)).rejects.toThrow(
          'db blip'
        );

        expect(rolledBack).toBe(true);
      });

      it('does not open a transaction at all when the subscription is unknown', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue(null);

        await service.handleSubscriptionUpdated(unpaid);

        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
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
      // Recurring-commission follow-up: affiliateCodeId explicitly cleared
      // so no further renewal can credit commission after cancellation.
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: { status: 'CANCELED', affiliateCodeId: null },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({ eventType: 'SUBSCRIPTION_CANCELLED' })
      );
    });
  });

  describe('handleInvoiceFailed', () => {
    const failedInvoice = {
      customer: 'cus_123',
      last_finalization_error: { message: 'card_declined' },
    } as unknown as Stripe.Invoice;

    it("marks the subscription PAST_DUE and emits PAYMENT_FAILED with the subscriber's own price and period", async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
        planType: 'MONTHLY',
        amountUsd: 29,
      } as never);

      await service.handleInvoiceFailed(failedInvoice);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: { status: 'PAST_DUE' },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: 'PAYMENT_FAILED',
          payload: {
            provider: 'STRIPE',
            failureReason: 'card_declined',
            billingPeriod: 'monthly',
            priceUsd: 29,
          },
        })
      );
    });

    it('reports a yearly subscriber as yearly, at the amount stored on the subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
        planType: 'YEARLY',
        amountUsd: 290,
      } as never);

      await service.handleInvoiceFailed(failedInvoice);

      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          payload: expect.objectContaining({
            billingPeriod: 'yearly',
            priceUsd: 290,
          }),
        })
      );
    });

    it('falls back to the SystemConfig price of the plan when the subscription has no amount', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
        planType: 'YEARLY',
        amountUsd: 0,
      } as never);

      await service.handleInvoiceFailed(failedInvoice);

      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          payload: expect.objectContaining({
            billingPeriod: 'yearly',
            priceUsd: 350,
          }),
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

    /** An invoice line carrying its Stripe Price (amount in cents). */
    const priceLine = (unitAmount: number, interval: 'month' | 'year') => ({
      data: [
        {
          tax_rates: [],
          price: {
            currency: 'usd',
            unit_amount: unitAmount,
            recurring: { interval },
          },
        },
      ],
    });

    it('renews monthly and emits PAYMENT_SUCCEEDED for a $29 invoice', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
        amount_paid: 2900,
        lines: priceLine(2900, 'month'),
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

    it('keeps a high monthly price monthly (once "paid >= $280 means yearly")', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
        total: 30000,
        amount_paid: 30000,
        lines: priceLine(30000, 'month'),
      } as unknown as Stripe.Invoice);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planType: 'MONTHLY',
            amountUsd: 300,
          }),
        })
      );
    });

    it('renews yearly when the invoice line bills per year', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
      } as never);

      await service.handleInvoiceSucceeded({
        ...baseInvoice,
        total: 29000,
        amount_paid: 29000,
        lines: priceLine(29000, 'year'),
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

    describe('affiliate commission crediting (commission-timing fix + recurring-commission follow-up)', () => {
      it('credits the commission but leaves the attribution in place when the cap has not been reached', async () => {
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
          capReached: false,
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
          stripeInvoiceId: 'inv_123',
          interval: 'month',
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
        // NOT cleared -- the cap hasn't been reached, so the next renewal
        // must still see affiliateCodeId to keep crediting.
        expect(prismaMock.subscription.update).not.toHaveBeenCalledWith({
          where: { id: 'sub-row-1' },
          data: { affiliateCodeId: null },
        });
      });

      it('passes the annual interval so the cap is 2 annual invoices (24 months)', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
          stripeSubscriptionId: 'sub_123',
          affiliateCodeId: 'code-1',
        } as never);

        await service.handleInvoiceSucceeded({
          ...baseInvoice,
          amount_paid: 29000,
          lines: priceLine(29000, 'year'),
        } as unknown as Stripe.Invoice);

        expect(
          conversionProcessorMock.creditAffiliateCommission
        ).toHaveBeenCalledWith(
          expect.objectContaining({ grossRevenueUsd: 290, interval: 'year' })
        );
      });

      it('clears the attribution once creditAffiliateCommission reports capReached', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
          stripeSubscriptionId: 'sub_123',
          affiliateCodeId: 'code-1',
        } as never);
        conversionProcessorMock.creditAffiliateCommission.mockResolvedValue({
          processed: true,
          commissionId: 'comm-24',
          commissionAmount: 5.8,
          affiliateUserId: 'affiliate-user-1',
          code: 'AFF10',
          totalEarnings: 200,
          capReached: true,
        });

        await service.handleInvoiceSucceeded({
          ...baseInvoice,
          amount_paid: 2900,
        } as unknown as Stripe.Invoice);

        expect(prismaMock.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-row-1' },
          data: { affiliateCodeId: null },
        });
      });

      it('clears the attribution when not processed but capReached (cap already hit on a prior cycle)', async () => {
        prismaMock.subscription.findFirst.mockResolvedValue({
          id: 'sub-row-1',
          userId: 'user-1',
          stripeSubscriptionId: 'sub_123',
          affiliateCodeId: 'code-1',
        } as never);
        conversionProcessorMock.creditAffiliateCommission.mockResolvedValue({
          processed: false,
          reason: 'CAP_REACHED',
          capReached: true,
        });

        await service.handleInvoiceSucceeded({
          ...baseInvoice,
          amount_paid: 2900,
        } as unknown as Stripe.Invoice);

        expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalledWith(
          prismaMock,
          expect.objectContaining({ eventType: 'COMMISSION_CREDITED' })
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
      affiliateCodeId: 'code-1',
      userId: 'user-1',
      subscriptionId: 'sub_123',
      grossRevenue: 29,
      discountAmount: 5.8,
      netRevenue: 23.2,
      commissionAmount: 5.8,
      status: 'PENDING',
    };

    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'sub-row-1',
        userId: 'user-1',
        stripeSubscriptionId: 'sub_123',
      } as never);
      // Tier 2 §6.1: the cancel is a conditional update; count 1 = this delivery won it.
      prismaMock.commission.updateMany.mockResolvedValue({ count: 1 });
    });

    const cancelWhere = {
      id: 'commission-1',
      status: { in: ['PENDING', 'APPROVED'] },
    };

    it('cancels a PENDING commission and reverses the affiliate profile stats on refund', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(
        mockCommission as never
      );

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.updateMany).toHaveBeenCalledWith({
        where: cancelWhere,
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

    it('recurring-commission follow-up: targets the exact commission cycle tied to the refunded invoice', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(
        mockCommission as never
      );

      await service.handleChargeRefunded({
        customer: 'cus_123',
        invoice: 'inv_5',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.findFirst).toHaveBeenCalledWith({
        where: { subscriptionId: 'sub_123', stripeInvoiceId: 'inv_5' },
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

      expect(prismaMock.commission.updateMany).toHaveBeenCalledWith({
        where: cancelWhere,
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('does NOT flip an already-PAID commission -- instead creates a negative clawback row netted against the next payout', async () => {
      prismaMock.commission.findFirst.mockResolvedValue({
        ...mockCommission,
        status: 'PAID',
      } as never);
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-clawback-1',
      } as never);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      // The original PAID row is never touched -- money already left, so
      // it can't be silently flipped back.
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.commission.updateMany).not.toHaveBeenCalled();

      // Instead, a new negative-amount row is created, referencing the
      // original via clawbackOfCommissionId, immediately APPROVED (a
      // correction, not a new earning -- no trial-safety hold needed).
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: {
          affiliateProfileId: 'aff-1',
          affiliateCodeId: 'code-1',
          userId: 'user-1',
          subscriptionId: 'sub_123',
          grossRevenue: -29,
          discountAmount: -5.8,
          netRevenue: -23.2,
          commissionAmount: -5.8,
          status: 'APPROVED',
          approvedAt: expect.any(Date),
          clawbackOfCommissionId: 'commission-1',
        },
      });

      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          totalEarnings: { decrement: 5.8 },
          pendingCommissions: { decrement: 5.8 },
        },
      });
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
      expect(prismaMock.commission.updateMany).not.toHaveBeenCalled();
    });

    it('no-ops when the refund has no associated affiliate commission at all', async () => {
      prismaMock.commission.findFirst.mockResolvedValue(null);

      await service.handleChargeRefunded({
        customer: 'cus_123',
      } as unknown as Stripe.Charge);

      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.commission.updateMany).not.toHaveBeenCalled();
    });

    describe('redelivery and dual delivery (Remediation Tier 2 §6.1)', () => {
      it('reverses the affiliate counters only once when a second delivery finds the commission already cancelled', async () => {
        prismaMock.commission.findFirst.mockResolvedValue(
          mockCommission as never
        );
        // The other delivery already changed the row: this one's conditional update matches nothing.
        prismaMock.commission.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.handleChargeRefunded({
            customer: 'cus_123',
          } as unknown as Stripe.Charge)
        ).resolves.toBeUndefined();

        expect(prismaMock.commission.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
      });

      it('cancels and reverses inside ONE transaction, so a failed reversal rolls the cancellation back', async () => {
        prismaMock.commission.findFirst.mockResolvedValue(
          mockCommission as never
        );
        prismaMock.affiliateProfile.update.mockRejectedValue(
          new Error('db blip')
        );
        // A real transaction rolls the first statement back when the callback throws.
        let rolledBack = false;
        prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
          try {
            return await (cb as (tx: unknown) => unknown)(prismaMock);
          } catch (error) {
            rolledBack = true;
            throw error;
          }
        });

        await service.handleChargeRefunded({
          customer: 'cus_123',
        } as unknown as Stripe.Charge);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.commission.updateMany).toHaveBeenCalledTimes(1);
        expect(rolledBack).toBe(true);
      });

      it('writes no second clawback row, and deducts nothing again, when the clawback already exists (unique violation)', async () => {
        prismaMock.commission.findFirst.mockResolvedValue({
          ...mockCommission,
          status: 'PAID',
        } as never);
        prismaMock.commission.create.mockRejectedValue(
          Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          })
        );

        await expect(
          service.handleChargeRefunded({
            customer: 'cus_123',
          } as unknown as Stripe.Charge)
        ).resolves.toBeUndefined();

        expect(prismaMock.commission.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
      });

      it('still swallows any other database error while writing the clawback, and deducts nothing', async () => {
        prismaMock.commission.findFirst.mockResolvedValue({
          ...mockCommission,
          status: 'PAID',
        } as never);
        prismaMock.commission.create.mockRejectedValue(new Error('db blip'));

        await expect(
          service.handleChargeRefunded({
            customer: 'cus_123',
          } as unknown as Stripe.Charge)
        ).resolves.toBeUndefined();
        expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
      });
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
      expect(prismaMock.commission.updateMany).toHaveBeenCalledWith({
        where: cancelWhere,
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
