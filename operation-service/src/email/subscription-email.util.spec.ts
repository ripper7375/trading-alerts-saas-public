// Parity suite for subscription-email.util.ts (Session 4A-11, Slice 5). No
// SOURCE spec exists at lib/email -- this is the safety net for the ported
// templates/senders (LESSONS-LEARNED.md L28: don't assume a parity oracle
// exists just because an order's prose sounds confident).

import { sendEmail } from './email.util';
import {
  getAffiliateCommissionEmailTemplate,
  getCancellationEmailTemplate,
  getPaymentFailedEmailTemplate,
  getPaymentReceiptEmailTemplate,
  getSubscriptionCanceledEmailTemplate,
  sendAffiliateCommissionEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from './subscription-email.util';

jest.mock('./email.util', () => ({
  sendEmail: jest.fn(),
}));

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('subscription-email.util', () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_123' });
  });

  describe('getCancellationEmailTemplate', () => {
    it('renders the cancellation subject and body', () => {
      const template = getCancellationEmailTemplate('Ada');
      expect(template.subject).toBe('Your PRO subscription has been cancelled');
      expect(template.html).toContain('Hi Ada,');
      expect(template.html).toContain('FREE tier access');
      expect(template.text).toContain('Hi Ada,');
    });
  });

  describe('sendCancellationEmail', () => {
    it('sends with the template subject and html', async () => {
      const result = await sendCancellationEmail('ada@example.com', 'Ada');
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Your PRO subscription has been cancelled',
        expect.stringContaining('Subscription Cancelled')
      );
      expect(result).toEqual({ success: true, messageId: 'msg_123' });
    });
  });

  describe('getPaymentFailedEmailTemplate', () => {
    it('renders the reason and default monthly price', () => {
      const template = getPaymentFailedEmailTemplate('Ada', 'Card declined');
      expect(template.subject).toBe('Payment Failed - Action Required');
      expect(template.html).toContain('Card declined');
      expect(template.html).toContain('$29/month');
      expect(template.text).toContain('Reason: Card declined');
    });

    it('honors a custom monthly price', () => {
      const template = getPaymentFailedEmailTemplate(
        'Ada',
        'Insufficient funds',
        49
      );
      expect(template.html).toContain('$49/month');
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends with the template subject and html', async () => {
      await sendPaymentFailedEmail('ada@example.com', 'Ada', 'Card declined');
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Payment Failed - Action Required',
        expect.stringContaining('Card declined')
      );
    });
  });

  describe('getPaymentReceiptEmailTemplate', () => {
    it('renders amount and next billing date, with invoice link when provided', () => {
      const nextBillingDate = new Date('2026-09-01T00:00:00Z');
      const template = getPaymentReceiptEmailTemplate(
        'Ada',
        29,
        nextBillingDate,
        'https://invoice.example.com/123'
      );
      expect(template.subject).toBe('Payment Receipt - Trading Alerts PRO');
      expect(template.html).toContain('$29.00');
      expect(template.html).toContain('September 1, 2026');
      expect(template.html).toContain('https://invoice.example.com/123');
    });

    it('omits the invoice link when not provided', () => {
      const template = getPaymentReceiptEmailTemplate(
        'Ada',
        29,
        new Date('2026-09-01T00:00:00Z')
      );
      expect(template.html).not.toContain('Download Invoice');
    });
  });

  describe('sendPaymentReceiptEmail', () => {
    it('sends with the template subject and html', async () => {
      await sendPaymentReceiptEmail(
        'ada@example.com',
        'Ada',
        29,
        new Date('2026-09-01T00:00:00Z')
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Payment Receipt - Trading Alerts PRO',
        expect.stringContaining('$29.00')
      );
    });
  });

  describe('getSubscriptionCanceledEmailTemplate', () => {
    it('renders the plan and access-until date', () => {
      const cancelAt = new Date('2026-08-15T00:00:00Z');
      const template = getSubscriptionCanceledEmailTemplate(
        'Ada',
        'PRO',
        cancelAt
      );
      expect(template.subject).toBe('Subscription Canceled - Trading Alerts');
      expect(template.html).toContain('PRO');
      expect(template.html).toContain('August 15, 2026');
    });
  });

  describe('sendSubscriptionCanceledEmail', () => {
    it('sends with the template subject and html', async () => {
      await sendSubscriptionCanceledEmail(
        'ada@example.com',
        'Ada',
        'PRO',
        new Date('2026-08-15T00:00:00Z')
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Subscription Canceled - Trading Alerts',
        expect.stringContaining('August 15, 2026')
      );
    });
  });

  describe('getAffiliateCommissionEmailTemplate', () => {
    it('renders code, commission, and total earnings', () => {
      const template = getAffiliateCommissionEmailTemplate(
        'Ada',
        'ADA20',
        10.5,
        105.75
      );
      expect(template.subject).toBe(
        'Commission Earned! $10.50 - Trading Alerts'
      );
      expect(template.html).toContain('ADA20');
      expect(template.html).toContain('+$10.50');
      expect(template.html).toContain('$105.75');
    });
  });

  describe('sendAffiliateCommissionEmail', () => {
    it('sends with the template subject and html', async () => {
      await sendAffiliateCommissionEmail(
        'ada@example.com',
        'Ada',
        'ADA20',
        10.5,
        105.75
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Commission Earned! $10.50 - Trading Alerts',
        expect.stringContaining('ADA20')
      );
    });
  });
});
