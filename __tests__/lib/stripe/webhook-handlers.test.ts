/**
 * Unit Tests: Stripe Webhook Handlers
 * Tests all webhook event handlers in lib/stripe/webhook-handlers.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type Stripe from 'stripe';

// Mock Prisma
const mockUserUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockSubscriptionFindFirst = jest.fn();
const mockSubscriptionUpdate = jest.fn();
const mockSubscriptionUpsert = jest.fn();
const mockInvoiceUpsert = jest.fn();
const mockAffiliateCodeFindUnique = jest.fn();
const mockAffiliateCodeUpdate = jest.fn();
const mockCommissionFindFirst = jest.fn();
const mockCommissionCreate = jest.fn();
const mockCommissionUpdate = jest.fn();
const mockAffiliateProfileUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    subscription: {
      findFirst: (...args: unknown[]) => mockSubscriptionFindFirst(...args),
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
    },
    invoice: {
      upsert: (...args: unknown[]) => mockInvoiceUpsert(...args),
    },
    affiliateCode: {
      findUnique: (...args: unknown[]) => mockAffiliateCodeFindUnique(...args),
      update: (...args: unknown[]) => mockAffiliateCodeUpdate(...args),
    },
    commission: {
      findFirst: (...args: unknown[]) => mockCommissionFindFirst(...args),
      create: (...args: unknown[]) => mockCommissionCreate(...args),
      update: (...args: unknown[]) => mockCommissionUpdate(...args),
    },
    affiliateProfile: {
      update: (...args: unknown[]) => mockAffiliateProfileUpdate(...args),
    },
  },
}));

// Mock email functions
const mockSendSubscriptionConfirmationEmail = jest.fn();
const mockSendSubscriptionCanceledEmail = jest.fn();
const mockSendPaymentFailedEmail = jest.fn();
const mockSendPaymentReceiptEmail = jest.fn();

jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionCanceledEmail: (...args: unknown[]) =>
    mockSendSubscriptionCanceledEmail(...args),
  sendPaymentFailedEmail: (...args: unknown[]) =>
    mockSendPaymentFailedEmail(...args),
  sendPaymentReceiptEmail: (...args: unknown[]) =>
    mockSendPaymentReceiptEmail(...args),
  sendAffiliateCommissionEmail: jest.fn(),
}));

jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendSubscriptionConfirmationEmail: (...args: unknown[]) =>
    mockSendSubscriptionConfirmationEmail(...args),
}));

const mockCalculateFullBreakdown = jest.fn().mockReturnValue({
  grossRevenue: 29,
  discountAmount: 0,
  netRevenue: 29,
  commissionAmount: 5.8,
});

jest.mock('@/lib/affiliate/commission-calculator', () => ({
  __esModule: true,
  calculateFullBreakdown: (...args: unknown[]) =>
    mockCalculateFullBreakdown(...args),
}));

const mockChargesRetrieve = jest.fn();

jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  getStripeClient: () => ({
    charges: { retrieve: (...args: unknown[]) => mockChargesRetrieve(...args) },
  }),
}));

import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoiceFailed,
  handleInvoiceSucceeded,
  handleChargeRefunded,
  handleChargeDisputeCreated,
} from '@/lib/stripe/webhook-handlers';

describe('Stripe Webhook Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCheckoutCompleted', () => {
    const mockSession = {
      id: 'cs_test_123',
      metadata: { userId: 'user-123' },
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
    } as unknown as Stripe.Checkout.Session;

    it('should upgrade user to PRO and create subscription', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      };
      mockUserUpdate.mockResolvedValue(mockUser);
      mockSubscriptionUpsert.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionConfirmationEmail.mockResolvedValue(undefined);

      await handleCheckoutCompleted(mockSession);

      // Verify user was upgraded to PRO
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          tier: 'PRO',
          hasUsedFreeTrial: true,
          trialStatus: 'CONVERTED',
        }),
      });

      // Verify subscription was created
      expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
          create: expect.objectContaining({
            userId: 'user-123',
            stripeCustomerId: 'cus_test_123',
            stripeSubscriptionId: 'sub_test_123',
            status: 'ACTIVE',
            amountUsd: 29,
          }),
        })
      );

      // Verify subscription confirmation email was sent
      expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        'PRO',
        'monthly'
      );
    });

    it('should return early if no userId in metadata', async () => {
      const sessionNoUser = {
        ...mockSession,
        metadata: {},
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(sessionNoUser);

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    });

    it('should return early if no customer ID', async () => {
      const sessionNoCustomer = {
        ...mockSession,
        customer: null,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(sessionNoCustomer);

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    });

    it('should return early if no subscription ID', async () => {
      const sessionNoSub = {
        ...mockSession,
        subscription: null,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(sessionNoSub);

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    });

    it('should use fallback name if user has no name', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: null,
      };
      mockUserUpdate.mockResolvedValue(mockUser);
      mockSubscriptionUpsert.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionConfirmationEmail.mockResolvedValue(undefined);

      await handleCheckoutCompleted(mockSession);

      expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'User',
        'PRO',
        'monthly'
      );
    });

    it('should skip email if user has no email', async () => {
      const mockUser = {
        id: 'user-123',
        email: null,
        name: 'Test User',
      };
      mockUserUpdate.mockResolvedValue(mockUser);
      mockSubscriptionUpsert.mockResolvedValue({ id: 'sub-db-123' });

      await handleCheckoutCompleted(mockSession);

      expect(mockSendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockUserUpdate.mockRejectedValue(new Error('Database error'));

      await expect(handleCheckoutCompleted(mockSession)).rejects.toThrow(
        'Database error'
      );
    });

    describe('affiliate code reservation (commission-timing fix)', () => {
      const sessionWithCode = {
        ...mockSession,
        metadata: { userId: 'user-123', affiliateCode: 'AFF10' },
      } as unknown as Stripe.Checkout.Session;

      beforeEach(() => {
        mockUserUpdate.mockResolvedValue({
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        });
        mockSubscriptionUpsert.mockResolvedValue({ id: 'sub-db-123' });
      });

      it('reserves an active code (marks USED) but does NOT create a commission yet', async () => {
        mockAffiliateCodeFindUnique.mockResolvedValue({
          id: 'code-1',
          code: 'AFF10',
          status: 'ACTIVE',
        });

        await handleCheckoutCompleted(sessionWithCode);

        expect(mockAffiliateCodeUpdate).toHaveBeenCalledWith({
          where: { id: 'code-1' },
          data: {
            status: 'USED',
            usedAt: expect.any(Date),
            usedBy: 'user-123',
            subscriptionId: 'sub_test_123',
          },
        });
        expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ affiliateCodeId: 'code-1' }),
            create: expect.objectContaining({ affiliateCodeId: 'code-1' }),
          })
        );
        // The whole point of the fix: no money has been collected yet
        // (7-day trial), so no commission is paid at this stage.
        expect(mockCommissionCreate).not.toHaveBeenCalled();
        expect(mockAffiliateProfileUpdate).not.toHaveBeenCalled();
      });

      it('does not reserve an unknown code, and clears affiliateCodeId to null', async () => {
        mockAffiliateCodeFindUnique.mockResolvedValue(null);

        await handleCheckoutCompleted(sessionWithCode);

        expect(mockAffiliateCodeUpdate).not.toHaveBeenCalled();
        expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ affiliateCodeId: null }),
            create: expect.objectContaining({ affiliateCodeId: null }),
          })
        );
      });

      it('does not reserve an already-used/inactive code', async () => {
        mockAffiliateCodeFindUnique.mockResolvedValue({
          id: 'code-1',
          code: 'AFF10',
          status: 'USED',
        });

        await handleCheckoutCompleted(sessionWithCode);

        expect(mockAffiliateCodeUpdate).not.toHaveBeenCalled();
        expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ affiliateCodeId: null }),
          })
        );
      });

      it('clears a stale affiliateCodeId when re-subscribing without a code this time', async () => {
        // No affiliateCode in metadata at all -- mockSession, not
        // sessionWithCode -- must still explicitly null out affiliateCodeId
        // so a prior abandoned attempt's attribution can't leak into this
        // signup and wrongly credit the old affiliate later.
        await handleCheckoutCompleted(mockSession);

        expect(mockAffiliateCodeFindUnique).not.toHaveBeenCalled();
        expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ affiliateCodeId: null }),
            create: expect.objectContaining({ affiliateCodeId: null }),
          })
        );
      });

      it('does not fail checkout if reserving the code throws', async () => {
        mockAffiliateCodeFindUnique.mockRejectedValue(new Error('db blip'));

        await expect(
          handleCheckoutCompleted(sessionWithCode)
        ).resolves.toBeUndefined();
        expect(mockSubscriptionUpsert).toHaveBeenCalled();
      });
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const mockSubscription = {
      id: 'sub_test_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
    } as unknown as Stripe.Subscription;

    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeSubscriptionId: 'sub_test_123',
      user: { id: 'user-123', email: 'user@example.com', name: 'Test User' },
    };

    it('should update subscription status to ACTIVE', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });

      await handleSubscriptionUpdated(mockSubscription);

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      });

      // Should not downgrade for active status
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('should handle trialing status', async () => {
      const trialingSubscription = {
        ...mockSubscription,
        status: 'trialing',
      } as unknown as Stripe.Subscription;

      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });

      await handleSubscriptionUpdated(trialingSubscription);

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: expect.objectContaining({
          status: 'TRIALING',
        }),
      });

      // Should not downgrade for trialing status
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('should downgrade user when subscription becomes inactive', async () => {
      const canceledSubscription = {
        ...mockSubscription,
        status: 'canceled',
      } as unknown as Stripe.Subscription;

      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123', tier: 'FREE' });

      await handleSubscriptionUpdated(canceledSubscription);

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { tier: 'FREE' },
      });
    });

    it('should handle past_due status', async () => {
      const pastDueSubscription = {
        ...mockSubscription,
        status: 'past_due',
      } as unknown as Stripe.Subscription;

      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });

      await handleSubscriptionUpdated(pastDueSubscription);

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: expect.objectContaining({
          status: 'PAST_DUE',
        }),
      });

      // Should downgrade for past_due
      expect(mockUserUpdate).toHaveBeenCalled();
    });

    it('should return early if subscription not found', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      await handleSubscriptionUpdated(mockSubscription);

      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockRejectedValue(new Error('Database error'));

      await expect(handleSubscriptionUpdated(mockSubscription)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    const mockSubscription = {
      id: 'sub_test_123',
      status: 'canceled',
    } as unknown as Stripe.Subscription;

    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeSubscriptionId: 'sub_test_123',
    };

    // Subscription no longer carries a `user` relation (Session 2-3 FK
    // audit) — the handler looks it up separately via prisma.user.findUnique.
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
    });

    it('should downgrade user to FREE and send cancellation email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionCanceledEmail.mockResolvedValue(undefined);

      await handleSubscriptionDeleted(mockSubscription);

      // Verify user was downgraded
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          tier: 'FREE',
          trialStatus: 'CANCELLED',
        }),
      });

      // Verify subscription was marked as cancelled
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: { status: 'CANCELED' },
      });

      // Verify subscription canceled email was sent with access end date
      expect(mockSendSubscriptionCanceledEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        'PRO',
        expect.any(Date)
      );
    });

    it('should use fallback name if user has no name', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: null,
      });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionCanceledEmail.mockResolvedValue(undefined);

      await handleSubscriptionDeleted(mockSubscription);

      expect(mockSendSubscriptionCanceledEmail).toHaveBeenCalledWith(
        'user@example.com',
        'User',
        'PRO',
        expect.any(Date)
      );
    });

    it('should skip email if user has no email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({ email: null, name: 'Test User' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });

      await handleSubscriptionDeleted(mockSubscription);

      expect(mockSendSubscriptionCanceledEmail).not.toHaveBeenCalled();
    });

    it('should return early if subscription not found', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      await handleSubscriptionDeleted(mockSubscription);

      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserUpdate.mockRejectedValue(new Error('Database error'));

      await expect(handleSubscriptionDeleted(mockSubscription)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('handleInvoiceFailed', () => {
    const mockInvoice = {
      id: 'inv_test_123',
      customer: 'cus_test_123',
      last_finalization_error: {
        message: 'Card declined',
      },
    } as unknown as Stripe.Invoice;

    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123',
    };

    // Subscription no longer carries a `user` relation (Session 2-3 FK
    // audit) — the handler looks it up separately via prisma.user.findUnique.
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
    });

    it('should update status to PAST_DUE and send failure email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendPaymentFailedEmail.mockResolvedValue(undefined);

      await handleInvoiceFailed(mockInvoice);

      // Verify subscription was marked as past due
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: { status: 'PAST_DUE' },
      });

      // Verify failure email was sent
      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        'Card declined'
      );
    });

    it('should use default failure message if none provided', async () => {
      const invoiceNoError = {
        ...mockInvoice,
        last_finalization_error: null,
      } as unknown as Stripe.Invoice;

      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendPaymentFailedEmail.mockResolvedValue(undefined);

      await handleInvoiceFailed(invoiceNoError);

      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        'Payment method declined'
      );
    });

    it('should use fallback name if user has no name', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: null,
      });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendPaymentFailedEmail.mockResolvedValue(undefined);

      await handleInvoiceFailed(mockInvoice);

      expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
        'user@example.com',
        'User',
        'Card declined'
      );
    });

    it('should skip email if user has no email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({ email: null, name: 'Test User' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });

      await handleInvoiceFailed(mockInvoice);

      expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it('should return early if no customer ID', async () => {
      const invoiceNoCustomer = {
        ...mockInvoice,
        customer: null,
      } as unknown as Stripe.Invoice;

      await handleInvoiceFailed(invoiceNoCustomer);

      expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
    });

    it('should return early if subscription not found', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      await handleInvoiceFailed(mockInvoice);

      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockRejectedValue(new Error('Database error'));

      await expect(handleInvoiceFailed(mockInvoice)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('handleInvoiceSucceeded', () => {
    const mockInvoice = {
      id: 'inv_test_123',
      customer: 'cus_test_123',
      amount_paid: 2900, // $29.00 in cents
      invoice_pdf: 'https://stripe.com/invoice.pdf',
      hosted_invoice_url: 'https://invoice.stripe.com/i/inv_test_123',
      total: 2900,
      tax: 0,
      currency: 'usd',
      customer_address: { country: 'US' },
      customer_tax_ids: [],
      lines: { data: [{ tax_rates: [] }] },
      status_transitions: { paid_at: 1735689600 },
    } as unknown as Stripe.Invoice;

    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123',
    };

    // Subscription no longer carries a `user` relation (Session 2-3 FK
    // audit) — the handler looks it up separately via prisma.user.findUnique.
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      mockInvoiceUpsert.mockResolvedValue({ id: 'invoice-db-123' });
    });

    it('should update subscription and send receipt email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSendPaymentReceiptEmail.mockResolvedValue(undefined);

      await handleInvoiceSucceeded(mockInvoice);

      // Verify subscription was updated
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-db-123' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          renewalReminderSent: false,
        }),
      });

      // Verify user tier was ensured PRO
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { tier: 'PRO' },
      });

      // Verify receipt email was sent
      expect(mockSendPaymentReceiptEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        29, // Amount in dollars
        expect.any(Date),
        'https://stripe.com/invoice.pdf'
      );
    });

    it('should upsert the invoice tax breakdown keyed on stripeInvoiceId (davintrade-vat-stack)', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSendPaymentReceiptEmail.mockResolvedValue(undefined);

      await handleInvoiceSucceeded(mockInvoice);

      expect(mockInvoiceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeInvoiceId: 'inv_test_123' },
          create: expect.objectContaining({
            userId: 'user-123',
            subscriptionId: 'sub-db-123',
            stripeInvoiceId: 'inv_test_123',
            stripeCustomerId: 'cus_test_123',
            amountTotal: 29,
            taxAmount: 0,
            taxRate: 0,
            currency: 'USD',
            taxCountry: 'US',
            customerTaxId: null,
            reverseCharge: false,
            invoicePdf: 'https://stripe.com/invoice.pdf',
            hostedInvoiceUrl: 'https://invoice.stripe.com/i/inv_test_123',
          }),
        })
      );
    });

    it('should mark reverseCharge when a validated EU VAT ID applied 0% tax', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });

      const b2bInvoice = {
        ...mockInvoice,
        customer_address: { country: 'DE' },
        customer_tax_ids: [{ type: 'eu_vat', value: 'DE123456789' }],
      } as unknown as Stripe.Invoice;

      await handleInvoiceSucceeded(b2bInvoice);

      expect(mockInvoiceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            taxCountry: 'DE',
            customerTaxId: 'DE123456789',
            taxRate: 0,
            reverseCharge: true,
          }),
        })
      );
    });

    it('should compute the effective tax rate and country for an EU B2C invoice', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });

      const euB2cInvoice = {
        ...mockInvoice,
        tax: 551, // 19% German VAT on $29.00 (~$5.51)
        customer_address: { country: 'DE' },
        lines: { data: [{ tax_rates: [{ percentage: 19 }] }] },
      } as unknown as Stripe.Invoice;

      await handleInvoiceSucceeded(euB2cInvoice);

      expect(mockInvoiceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            taxAmount: 5.51,
            taxRate: 0.19,
            taxCountry: 'DE',
            reverseCharge: false,
          }),
        })
      );
    });

    it('should default taxCountry to UNKNOWN when no customer address is present', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });

      const noAddressInvoice = {
        ...mockInvoice,
        customer_address: null,
      } as unknown as Stripe.Invoice;

      await handleInvoiceSucceeded(noAddressInvoice);

      expect(mockInvoiceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ taxCountry: 'UNKNOWN' }),
        })
      );
    });

    describe('affiliate commission crediting (commission-timing fix)', () => {
      const dbSubscriptionWithCode = {
        ...mockDbSubscription,
        affiliateCodeId: 'code-1',
      };

      beforeEach(() => {
        mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
        mockUserUpdate.mockResolvedValue({ id: 'user-123' });
        mockSendPaymentReceiptEmail.mockResolvedValue(undefined);
        mockAffiliateCodeFindUnique.mockResolvedValue({
          id: 'code-1',
          code: 'AFF10',
          affiliateProfileId: 'aff-1',
          discountPercent: 20,
          commissionPercent: 20,
        });
        mockCommissionFindFirst.mockResolvedValue(null);
        mockCommissionCreate.mockResolvedValue({ id: 'commission-1' });
        mockAffiliateProfileUpdate.mockResolvedValue({
          userId: 'affiliate-user-1',
          totalEarnings: 5.8,
        });
      });

      it('credits the commission and clears the pending attribution when a code was reserved', async () => {
        mockSubscriptionFindFirst.mockResolvedValue(dbSubscriptionWithCode);

        await handleInvoiceSucceeded(mockInvoice);

        expect(mockCommissionCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            affiliateProfileId: 'aff-1',
            affiliateCodeId: 'code-1',
            userId: 'user-123',
            subscriptionId: 'sub_test_123',
            status: 'PENDING',
          }),
        });
        // Cleared so a later renewal never re-triggers this same code's payout.
        expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
          where: { id: 'sub-db-123' },
          data: { affiliateCodeId: null },
        });
        expect(mockAffiliateProfileUpdate).toHaveBeenCalledWith({
          where: { id: 'aff-1' },
          data: {
            totalCodesUsed: { increment: 1 },
            totalEarnings: { increment: 5.8 },
            pendingCommissions: { increment: 5.8 },
          },
        });
      });

      it('uses the actual invoice amount as gross revenue, not a static base price', async () => {
        mockSubscriptionFindFirst.mockResolvedValue(dbSubscriptionWithCode);

        await handleInvoiceSucceeded(mockInvoice);

        // mockInvoice.amount_paid is 2900 cents = $29.00
        expect(mockCalculateFullBreakdown).toHaveBeenCalledWith(29, 20, 20);
      });

      it('does not credit anything when the subscription has no pending affiliate attribution', async () => {
        mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription); // no affiliateCodeId

        await handleInvoiceSucceeded(mockInvoice);

        expect(mockAffiliateCodeFindUnique).not.toHaveBeenCalled();
        expect(mockCommissionCreate).not.toHaveBeenCalled();
      });

      it('is idempotent: skips creating a duplicate commission on a redelivered webhook', async () => {
        mockSubscriptionFindFirst.mockResolvedValue(dbSubscriptionWithCode);
        mockCommissionFindFirst.mockResolvedValue({ id: 'commission-already' });

        await handleInvoiceSucceeded(mockInvoice);

        expect(mockCommissionCreate).not.toHaveBeenCalled();
        expect(mockAffiliateProfileUpdate).not.toHaveBeenCalled();
      });

      it('does not fail invoice processing if commission crediting throws', async () => {
        mockSubscriptionFindFirst.mockResolvedValue(dbSubscriptionWithCode);
        mockAffiliateCodeFindUnique.mockRejectedValue(new Error('db blip'));

        await expect(
          handleInvoiceSucceeded(mockInvoice)
        ).resolves.toBeUndefined();
        // The subscription renewal itself must still have gone through.
        expect(mockSendPaymentReceiptEmail).toHaveBeenCalled();
      });
    });

    it('should skip $0 invoices (trial period)', async () => {
      const trialInvoice = {
        ...mockInvoice,
        amount_paid: 0,
      } as unknown as Stripe.Invoice;

      await handleInvoiceSucceeded(trialInvoice);

      expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('should handle invoice without PDF link', async () => {
      const invoiceNoPdf = {
        ...mockInvoice,
        invoice_pdf: null,
      } as unknown as Stripe.Invoice;

      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSendPaymentReceiptEmail.mockResolvedValue(undefined);

      await handleInvoiceSucceeded(invoiceNoPdf);

      expect(mockSendPaymentReceiptEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        29,
        expect.any(Date),
        undefined
      );
    });

    it('should use fallback name if user has no name', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({
        email: 'user@example.com',
        name: null,
      });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });
      mockSendPaymentReceiptEmail.mockResolvedValue(undefined);

      await handleInvoiceSucceeded(mockInvoice);

      expect(mockSendPaymentReceiptEmail).toHaveBeenCalledWith(
        'user@example.com',
        'User',
        29,
        expect.any(Date),
        'https://stripe.com/invoice.pdf'
      );
    });

    it('should skip email if user has no email', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserFindUnique.mockResolvedValue({ email: null, name: 'Test User' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockUserUpdate.mockResolvedValue({ id: 'user-123' });

      await handleInvoiceSucceeded(mockInvoice);

      expect(mockSendPaymentReceiptEmail).not.toHaveBeenCalled();
    });

    it('should return early if no customer ID', async () => {
      const invoiceNoCustomer = {
        ...mockInvoice,
        customer: null,
      } as unknown as Stripe.Invoice;

      await handleInvoiceSucceeded(invoiceNoCustomer);

      expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
    });

    it('should return early if subscription not found', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      await handleInvoiceSucceeded(mockInvoice);

      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockSubscriptionUpdate.mockRejectedValue(new Error('Database error'));

      await expect(handleInvoiceSucceeded(mockInvoice)).rejects.toThrow(
        'Database error'
      );
    });

    it('should handle invoices with amount_paid as undefined', async () => {
      const invoiceNoAmount = {
        ...mockInvoice,
        amount_paid: undefined,
      } as unknown as Stripe.Invoice;

      // undefined || 0 === 0, so it should skip as trial
      await handleInvoiceSucceeded(invoiceNoAmount);

      expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('handleChargeRefunded / handleChargeDisputeCreated (commission clawback)', () => {
    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeSubscriptionId: 'sub_test_123',
    };
    const mockCommission = {
      id: 'commission-1',
      affiliateProfileId: 'aff-1',
      commissionAmount: 5.8,
      status: 'PENDING',
    };

    beforeEach(() => {
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockCommissionUpdate.mockResolvedValue({});
      mockAffiliateProfileUpdate.mockResolvedValue({});
    });

    it('cancels a PENDING commission and reverses the affiliate profile stats on refund', async () => {
      mockCommissionFindFirst.mockResolvedValue(mockCommission);

      await handleChargeRefunded({
        customer: 'cus_test_123',
      } as unknown as Stripe.Charge);

      expect(mockCommissionUpdate).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
      expect(mockAffiliateProfileUpdate).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          totalCodesUsed: { decrement: 1 },
          totalEarnings: { decrement: 5.8 },
          pendingCommissions: { decrement: 5.8 },
        },
      });
    });

    it('also cancels an APPROVED (not yet disbursed) commission', async () => {
      mockCommissionFindFirst.mockResolvedValue({
        ...mockCommission,
        status: 'APPROVED',
      });

      await handleChargeRefunded({
        customer: 'cus_test_123',
      } as unknown as Stripe.Charge);

      expect(mockCommissionUpdate).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('does NOT touch an already-PAID commission -- flags it for manual recovery instead', async () => {
      mockCommissionFindFirst.mockResolvedValue({
        ...mockCommission,
        status: 'PAID',
      });

      await handleChargeRefunded({
        customer: 'cus_test_123',
      } as unknown as Stripe.Charge);

      expect(mockCommissionUpdate).not.toHaveBeenCalled();
      expect(mockAffiliateProfileUpdate).not.toHaveBeenCalled();
    });

    it('is idempotent: no-ops on an already-CANCELLED commission', async () => {
      mockCommissionFindFirst.mockResolvedValue({
        ...mockCommission,
        status: 'CANCELLED',
      });

      await handleChargeRefunded({
        customer: 'cus_test_123',
      } as unknown as Stripe.Charge);

      expect(mockCommissionUpdate).not.toHaveBeenCalled();
    });

    it('no-ops when the refund has no associated affiliate commission at all', async () => {
      mockCommissionFindFirst.mockResolvedValue(null);

      await handleChargeRefunded({
        customer: 'cus_test_123',
      } as unknown as Stripe.Charge);

      expect(mockCommissionUpdate).not.toHaveBeenCalled();
    });

    it('no-ops when there is no customer id on the charge', async () => {
      await handleChargeRefunded({
        customer: null,
      } as unknown as Stripe.Charge);

      expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
    });

    it('no-ops when no subscription is found for the customer', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      await handleChargeRefunded({
        customer: 'cus_unknown',
      } as unknown as Stripe.Charge);

      expect(mockCommissionFindFirst).not.toHaveBeenCalled();
    });

    it('does not throw if the database errors mid-clawback', async () => {
      mockCommissionFindFirst.mockRejectedValue(new Error('db blip'));

      await expect(
        handleChargeRefunded({
          customer: 'cus_test_123',
        } as unknown as Stripe.Charge)
      ).resolves.toBeUndefined();
    });

    it('resolves the charge from the dispute payload, then applies the same clawback', async () => {
      mockCommissionFindFirst.mockResolvedValue(mockCommission);
      mockChargesRetrieve.mockResolvedValue({ customer: 'cus_test_123' });

      await handleChargeDisputeCreated({
        charge: 'ch_test_123',
      } as unknown as Stripe.Dispute);

      expect(mockChargesRetrieve).toHaveBeenCalledWith('ch_test_123');
      expect(mockCommissionUpdate).toHaveBeenCalledWith({
        where: { id: 'commission-1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('does not throw if resolving the disputed charge fails', async () => {
      mockChargesRetrieve.mockRejectedValue(new Error('stripe api down'));

      await expect(
        handleChargeDisputeCreated({
          charge: 'ch_test_123',
        } as unknown as Stripe.Dispute)
      ).resolves.toBeUndefined();
      expect(mockCommissionFindFirst).not.toHaveBeenCalled();
    });
  });
});
