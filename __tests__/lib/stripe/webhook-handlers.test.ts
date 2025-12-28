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

jest.mock('@/lib/affiliate/commission-calculator', () => ({
  __esModule: true,
  calculateFullBreakdown: jest.fn().mockReturnValue({
    grossRevenue: 29,
    discountAmount: 0,
    netRevenue: 29,
    commissionAmount: 5.8,
  }),
}));

jest.mock('@/lib/affiliate/constants', () => ({
  __esModule: true,
  AFFILIATE_CONFIG: {
    BASE_PRICE_USD: 29,
  },
}));

import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoiceFailed,
  handleInvoiceSucceeded,
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
      user: { id: 'user-123', email: 'user@example.com', name: 'Test User' },
    };

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
      const dbSubNoName = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: 'user@example.com', name: null },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoName);
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
      const dbSubNoEmail = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: null, name: 'Test User' },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoEmail);
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
      user: { id: 'user-123', email: 'user@example.com', name: 'Test User' },
    };

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
      const dbSubNoName = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: 'user@example.com', name: null },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoName);
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
      const dbSubNoEmail = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: null, name: 'Test User' },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoEmail);
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
    } as unknown as Stripe.Invoice;

    const mockDbSubscription = {
      id: 'sub-db-123',
      userId: 'user-123',
      stripeCustomerId: 'cus_test_123',
      user: { id: 'user-123', email: 'user@example.com', name: 'Test User' },
    };

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
      const dbSubNoName = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: 'user@example.com', name: null },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoName);
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
      const dbSubNoEmail = {
        ...mockDbSubscription,
        user: { id: 'user-123', email: null, name: 'Test User' },
      };
      mockSubscriptionFindFirst.mockResolvedValue(dbSubNoEmail);
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
});
