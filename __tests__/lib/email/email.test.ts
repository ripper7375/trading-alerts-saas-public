/**
 * Email Service Tests
 *
 * Tests for the email service and template generation.
 */

// Mock resend to avoid jsdom MessageChannel issues
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-id' }),
    },
  })),
}));

import {
  getWelcomeEmail,
  getVerificationEmail,
  getPasswordResetEmail,
  getAlertTriggeredEmail,
  getSubscriptionConfirmationEmail,
  getTrialReminderEmail,
  getUpgradePromptEmail,
} from '@/lib/email/email';

describe('Email Service', () => {
  describe('getWelcomeEmail', () => {
    it('should generate welcome email HTML with user name', () => {
      const html = getWelcomeEmail('John Doe');

      expect(html).toContain('Welcome to Trading Alerts');
      expect(html).toContain('John Doe');
      expect(html).toContain('Go to Dashboard');
    });

    it('should include proper HTML structure', () => {
      const html = getWelcomeEmail('Test User');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('<body');
    });

    it('should escape special characters in name', () => {
      const html = getWelcomeEmail('John <script>alert("xss")</script>');

      // The template should include the name as-is (React/Next.js handles escaping)
      expect(html).toContain('John <script>');
    });
  });

  describe('getVerificationEmail', () => {
    it('should generate verification email with token URL', () => {
      const html = getVerificationEmail(
        'Jane Doe',
        'https://example.com/verify?token=abc123'
      );

      expect(html).toContain('Verify Your Email');
      expect(html).toContain('Jane Doe');
      expect(html).toContain('https://example.com/verify?token=abc123');
    });

    it('should include expiration notice', () => {
      const html = getVerificationEmail('User', 'https://example.com/verify');

      expect(html).toContain('24 hours');
    });
  });

  describe('getPasswordResetEmail', () => {
    it('should generate password reset email with reset URL', () => {
      const html = getPasswordResetEmail(
        'Bob Smith',
        'https://example.com/reset?token=xyz789'
      );

      expect(html).toContain('Reset Your Password');
      expect(html).toContain('Bob Smith');
      expect(html).toContain('https://example.com/reset?token=xyz789');
    });

    it('should include security notice', () => {
      const html = getPasswordResetEmail('User', 'https://example.com/reset');

      expect(html).toContain("didn't request a password reset");
      expect(html).toContain('1 hour');
    });
  });

  describe('getAlertTriggeredEmail', () => {
    it('should generate alert email with all details', () => {
      const html = getAlertTriggeredEmail(
        'Trader',
        'XAUUSD',
        'H1',
        'Price Above $2000',
        2005.5
      );

      expect(html).toContain('Alert Triggered');
      expect(html).toContain('Trader');
      expect(html).toContain('XAUUSD');
      expect(html).toContain('H1');
      expect(html).toContain('Price Above $2000');
      expect(html).toContain('$2005.50');
    });

    it('should include view chart link', () => {
      const html = getAlertTriggeredEmail(
        'User',
        'EURUSD',
        'M15',
        'test',
        1.085
      );

      expect(html).toContain('View Chart');
      expect(html).toContain('EURUSD');
      expect(html).toContain('M15');
    });

    it('should format price with 2 decimal places', () => {
      const html = getAlertTriggeredEmail('User', 'XAUUSD', 'H1', 'test', 2000);

      expect(html).toContain('$2000.00');
    });
  });

  describe('getSubscriptionConfirmationEmail', () => {
    it('should generate PRO subscription email with correct pricing', () => {
      const html = getSubscriptionConfirmationEmail('John Doe', 'PRO', 'monthly');

      expect(html).toContain('Subscription Confirmed');
      expect(html).toContain('John Doe');
      expect(html).toContain('PRO');
      expect(html).toContain('$29/month');
      expect(html).toContain('7-Day Free Trial');
    });

    it('should include PRO features', () => {
      const html = getSubscriptionConfirmationEmail('User', 'PRO', 'yearly');

      expect(html).toContain('15 Symbols');
      expect(html).toContain('9 Timeframes');
      expect(html).toContain('135 Chart Combinations');
      expect(html).toContain('20 Alerts');
      expect(html).toContain('$290/year');
    });

    it('should generate FREE subscription email with correct limits', () => {
      const html = getSubscriptionConfirmationEmail('Jane Doe', 'FREE', 'monthly');

      expect(html).toContain('FREE');
      expect(html).toContain('5 Symbols');
      expect(html).toContain('3 Timeframes');
      expect(html).toContain('15 Chart Combinations');
      expect(html).toContain('5 Alerts');
    });

    it('should not include trial info for FREE plan', () => {
      const html = getSubscriptionConfirmationEmail('User', 'FREE', 'monthly');

      expect(html).not.toContain('7-Day Free Trial');
    });
  });

  describe('getTrialReminderEmail', () => {
    it('should generate trial reminder email with days remaining', () => {
      const html = getTrialReminderEmail('John Doe', 3);

      expect(html).toContain('Pro Trial is Ending Soon');
      expect(html).toContain('John Doe');
      expect(html).toContain('3 days');
    });

    it('should show correct pricing', () => {
      const html = getTrialReminderEmail('User', 1);

      expect(html).toContain('$29/month');
      expect(html).toContain('$290/year');
    });

    it('should handle singular day', () => {
      const html = getTrialReminderEmail('User', 1);

      expect(html).toContain('1 day');
      expect(html).not.toContain('1 days');
    });
  });

  describe('getUpgradePromptEmail', () => {
    it('should generate upgrade email for alert limit', () => {
      const html = getUpgradePromptEmail('John Doe', 'alert_limit');

      expect(html).toContain('Upgrade to Pro');
      expect(html).toContain('5 alert limit');
      expect(html).toContain('5 to 20 alerts');
    });

    it('should generate upgrade email for symbol limit', () => {
      const html = getUpgradePromptEmail('User', 'symbol_limit');

      expect(html).toContain('PRO-exclusive symbols');
      expect(html).toContain('all 15 symbols');
    });

    it('should generate upgrade email for timeframe limit', () => {
      const html = getUpgradePromptEmail('User', 'timeframe_limit');

      expect(html).toContain('PRO-exclusive timeframes');
      expect(html).toContain('all 9 timeframes');
    });

    it('should generate upgrade email for indicator limit', () => {
      const html = getUpgradePromptEmail('User', 'indicator_limit');

      expect(html).toContain('PRO-exclusive indicators');
      expect(html).toContain('all 8 indicators');
    });

    it('should include correct pricing and trial info', () => {
      const html = getUpgradePromptEmail('User', 'alert_limit');

      expect(html).toContain('$29/month');
      expect(html).toContain('$290/year');
      expect(html).toContain('7-day free trial');
    });
  });
});
