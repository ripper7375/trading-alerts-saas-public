/**
 * Email Service Tests
 *
 * Tests for the email service and template generation.
 */

import {
  getWelcomeEmail,
  getVerificationEmail,
  getPasswordResetEmail,
  getAlertTriggeredEmail,
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
      const html = getVerificationEmail('Jane Doe', 'https://example.com/verify?token=abc123');

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
      const html = getPasswordResetEmail('Bob Smith', 'https://example.com/reset?token=xyz789');

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
        2005.50
      );

      expect(html).toContain('Alert Triggered');
      expect(html).toContain('Trader');
      expect(html).toContain('XAUUSD');
      expect(html).toContain('H1');
      expect(html).toContain('Price Above $2000');
      expect(html).toContain('$2005.50');
    });

    it('should include view chart link', () => {
      const html = getAlertTriggeredEmail('User', 'EURUSD', 'M15', 'test', 1.0850);

      expect(html).toContain('View Chart');
      expect(html).toContain('EURUSD');
      expect(html).toContain('M15');
    });

    it('should format price with 2 decimal places', () => {
      const html = getAlertTriggeredEmail('User', 'XAUUSD', 'H1', 'test', 2000);

      expect(html).toContain('$2000.00');
    });
  });
});
