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
  getPlanSwitchScheduledEmailTemplate,
  getSubscriptionCanceledEmailTemplate,
  getSubscriptionResumedEmailTemplate,
  getSubscriptionUpgradedEmailTemplate,
  sendAffiliateCommissionEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendPlanSwitchScheduledEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
  sendSubscriptionUpgradedEmail,
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
    it('renders the reason and the price it is given, monthly unless told otherwise', () => {
      const template = getPaymentFailedEmailTemplate(
        'Ada',
        'Card declined',
        35
      );
      expect(template.subject).toBe('Payment Failed - Action Required');
      expect(template.html).toContain('Card declined');
      expect(template.html).toContain('$35/month');
      expect(template.html).not.toContain('$29');
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

    it('prints a yearly subscriber price per year', () => {
      const template = getPaymentFailedEmailTemplate(
        'Ada',
        'Card declined',
        350,
        'yearly'
      );
      expect(template.html).toContain('$350/year');
      expect(template.html).not.toContain('/month');
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends with the template subject, html and the price it is given', async () => {
      await sendPaymentFailedEmail(
        'ada@example.com',
        'Ada',
        'Card declined',
        35
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Payment Failed - Action Required',
        expect.stringContaining('$35/month')
      );
    });

    it('passes the billing period through', async () => {
      await sendPaymentFailedEmail(
        'ada@example.com',
        'Ada',
        'Card declined',
        350,
        'yearly'
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Payment Failed - Action Required',
        expect.stringContaining('$350/year')
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

  describe('getSubscriptionResumedEmailTemplate (S2, W4)', () => {
    it('says the subscription continues, names the renewal date and links to billing', () => {
      const template = getSubscriptionResumedEmailTemplate(
        'Ada',
        'PRO',
        new Date('2026-11-21T00:00:00Z')
      );
      expect(template.subject).toBe(
        'Your PRO subscription will continue - Trading Alerts'
      );
      expect(template.html).toContain('Subscription Resumed');
      expect(template.html).toContain('November 21, 2026');
      expect(template.html).toContain('/settings/billing');
    });

    it('is written in the language it is given', () => {
      const template = getSubscriptionResumedEmailTemplate(
        'Ada',
        'PRO',
        new Date('2026-11-21T00:00:00Z'),
        { language: 'de' }
      );
      expect(template.subject).toBe(
        'Ihr Abonnement PRO läuft weiter - Trading Alerts'
      );
      expect(template.html).toContain('Abonnement fortgesetzt');
      expect(template.html).not.toContain('Subscription Resumed');
    });
  });

  describe('sendSubscriptionResumedEmail (S2, W4)', () => {
    it('sends with the template subject and html', async () => {
      await sendSubscriptionResumedEmail(
        'ada@example.com',
        'Ada',
        'PRO',
        new Date('2026-11-21T00:00:00Z'),
        { language: 'en-US' }
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Your PRO subscription will continue - Trading Alerts',
        expect.stringContaining('November 21, 2026')
      );
    });
  });

  describe('getSubscriptionUpgradedEmailTemplate (S3, W5a)', () => {
    const when = new Date('2027-10-31T03:15:00Z');

    it('names what was charged, the yearly price and the next billing date, and links to billing', () => {
      const template = getSubscriptionUpgradedEmailTemplate(
        'Ada',
        'PRO',
        270.35,
        290,
        when,
        false
      );
      expect(template.subject).toBe(
        'You are now on yearly billing - Trading Alerts'
      );
      expect(template.html).toContain('Switched to Yearly Billing');
      expect(template.html).toContain('$270.35');
      expect(template.html).toContain('$290.00');
      expect(template.html).toContain('October 31, 2027');
      expect(template.html).toContain('/settings/billing');
    });

    it('during the free trial says nothing was charged and names the first charge', () => {
      const template = getSubscriptionUpgradedEmailTemplate(
        'Ada',
        'PRO',
        0,
        290,
        when,
        true
      );
      expect(template.html).toContain('$0.00');
      expect(template.html).toContain('First charge:');
      expect(template.html).not.toContain('Next billing date');
    });

    it('is written in the language it is given', () => {
      const template = getSubscriptionUpgradedEmailTemplate(
        'Ada',
        'PRO',
        270.35,
        290,
        when,
        false,
        { language: 'de' }
      );
      expect(template.subject).toBe(
        'Sie zahlen jetzt jährlich - Trading Alerts'
      );
      expect(template.html).not.toContain('Switched to Yearly Billing');
    });
  });

  describe('sendSubscriptionUpgradedEmail (S3, W5a)', () => {
    it('sends with the template subject and html', async () => {
      await sendSubscriptionUpgradedEmail(
        'ada@example.com',
        'Ada',
        'PRO',
        270.35,
        290,
        new Date('2027-10-31T03:15:00Z'),
        false,
        { language: 'en-US' }
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'You are now on yearly billing - Trading Alerts',
        expect.stringContaining('$270.35')
      );
    });
  });

  describe('getPlanSwitchScheduledEmailTemplate (S3, W5b)', () => {
    const when = new Date('2027-10-31T03:15:00Z');

    it('names the switch date and the monthly price, says nothing is charged or refunded, and links to billing', () => {
      const template = getPlanSwitchScheduledEmailTemplate(
        'Ada',
        'PRO',
        when,
        29
      );
      expect(template.subject).toBe(
        'Your switch to monthly billing is scheduled - Trading Alerts'
      );
      expect(template.html).toContain('Switch to Monthly Billing Scheduled');
      expect(template.html).toContain('October 31, 2027');
      expect(template.html).toContain('$29.00');
      expect(template.html).toContain('Nothing is charged or refunded now');
      expect(template.html).toContain('/settings/billing');
    });

    it('is written in the language it is given', () => {
      const template = getPlanSwitchScheduledEmailTemplate(
        'Ada',
        'PRO',
        when,
        29,
        { language: 'es' }
      );
      expect(template.subject).toBe(
        'Tu cambio a facturación mensual está programado - Trading Alerts'
      );
      expect(template.html).not.toContain(
        'Switch to Monthly Billing Scheduled'
      );
    });
  });

  describe('sendPlanSwitchScheduledEmail (S3, W5b)', () => {
    it('sends with the template subject and html', async () => {
      await sendPlanSwitchScheduledEmail(
        'ada@example.com',
        'Ada',
        'PRO',
        new Date('2027-10-31T03:15:00Z'),
        29,
        { language: 'en-US' }
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Your switch to monthly billing is scheduled - Trading Alerts',
        expect.stringContaining('October 31, 2027')
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
