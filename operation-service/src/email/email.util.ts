// Ported from lib/email/email.ts (Session 3-4, F29: Davin's decision to port
// the Resend email-sending logic directly into operation-service so the
// service is self-contained rather than calling back into the monolith).
// NEXTAUTH_URL is reused as-is (not renamed) for the same reason auth.service.ts
// reuses NEXTAUTH_SECRET verbatim: it's the one env var name every consumer of
// this module already expects.
//
// Every e-mail is written in the recipient's own language and date / time /
// number formats. The texts and the HTML builders live in `./i18n/`, a
// byte-for-byte mirror of the monolith's `lib/email/i18n/` (held by
// `__tests__/lib/email/i18n/mirror.test.ts`); this file only sends. A sender
// takes an optional trailing `locale`; without one it asks the registered
// resolver (`EmailLocaleService`: the recipient's saved Settings, then the
// forwarded request hint, then English), so no caller had to change. The three
// templates at the end that nothing calls (alert triggered, trial reminder,
// upgrade prompt) are still English only.

import { Resend } from 'resend';

import {
  buildAccountDeletionEmail,
  buildNewDeviceLoginEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildPayoutDetailsChangedEmail,
  buildSubscriptionConfirmationEmail,
  buildTwoFactorDisabledEmail,
  buildTwoFactorEnabledEmail,
  buildVerificationEmail,
  buildWelcomeEmail,
  DEFAULT_EMAIL_LOCALE,
  formatEmailUsd as formatUsdForLocale,
  type BuiltEmail,
  type EmailLocale,
  type NewDeviceDetails,
} from './i18n';
import { localeFor } from './recipient-locale';

/**
 * A USD amount for an email: "$29", "$29.50". Prices stay in USD, as charged;
 * the localized e-mails write them in the reader's number format instead.
 */
export function formatEmailUsd(amount: number): string {
  return formatUsdForLocale(amount, DEFAULT_EMAIL_LOCALE, 0);
}

async function sendBuilt(
  to: string,
  email: BuiltEmail
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(to, email.subject, email.html);
}

// Lazy initialization to prevent build-time errors
let resendClient: Resend | null = null;

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env['RESEND_API_KEY'];
}

/**
 * Get Resend client instance (lazy initialization)
 */
function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) {
    if (process.env['NODE_ENV'] === 'development') {
      console.warn(
        '[Email] RESEND_API_KEY not configured - emails will be simulated in development'
      );
    }
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Email configuration
 * Uses RESEND_FROM_EMAIL env var if set, otherwise defaults to Resend's test address
 */
const EMAIL_CONFIG = {
  from:
    process.env['RESEND_FROM_EMAIL'] ||
    'Trading Alerts <onboarding@resend.dev>',
  replyTo: process.env['RESEND_REPLY_TO'] || undefined,
} as const;

/**
 * Send an email
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @returns Promise resolving to send result
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}> {
  try {
    const resend = getResendClient();

    // In development without email service, simulate success
    if (!resend) {
      if (process.env['NODE_ENV'] === 'development') {
        console.log('[Email] Simulated email sent:');
        console.log(`  To: ${to}`);
        console.log(`  Subject: ${subject}`);
        console.log('  (Configure RESEND_API_KEY to send real emails)');
        return { success: true, messageId: 'simulated', simulated: true };
      }
      return { success: false, error: 'Email service not configured' };
    }

    const result = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject,
      html,
      reply_to: EMAIL_CONFIG.replyTo,
    });

    if (result.error) {
      console.error('Failed to send email:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCOUNT EMAILS (localized)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate welcome email HTML
 *
 * @param name - User's name
 * @param locale - Reader's language and formats (English when omitted)
 * @returns HTML string for welcome email
 */
export function getWelcomeEmail(
  name: string,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildWelcomeEmail(locale, { name }).html;
}

/**
 * Generate email verification HTML
 *
 * @param name - User's name
 * @param verificationUrl - URL to verify email
 * @param locale - Reader's language and formats (English when omitted)
 * @returns HTML string for verification email
 */
export function getVerificationEmail(
  name: string,
  verificationUrl: string,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildVerificationEmail(locale, { name, verificationUrl }).html;
}

/**
 * Generate password reset email HTML
 *
 * @param name - User's name
 * @param resetUrl - URL to reset password
 * @param locale - Reader's language and formats (English when omitted)
 * @returns HTML string for password reset email
 */
export function getPasswordResetEmail(
  name: string,
  resetUrl: string,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildPasswordResetEmail(locale, { name, resetUrl }).html;
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildWelcomeEmail(await localeFor(to, locale), { name })
  );
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  return sendBuilt(
    to,
    buildVerificationEmail(await localeFor(to, locale), {
      name,
      verificationUrl,
    })
  );
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  return sendBuilt(
    to,
    buildPasswordResetEmail(await localeFor(to, locale), { name, resetUrl })
  );
}

/**
 * Generate subscription confirmation email HTML
 *
 * @param name - User's name
 * @param plan - Subscription plan ('FREE' or 'PRO')
 * @param billingPeriod - Billing period ('monthly', 'yearly' or 'three_day')
 * @param priceUsd - PRO price per billing period, as charged (the admin's
 *   SystemConfig price at subscription time)
 * @param locale - Reader's language and formats (English when omitted)
 * @returns HTML string for subscription confirmation email
 */
export function getSubscriptionConfirmationEmail(
  name: string,
  plan: 'FREE' | 'PRO',
  billingPeriod: 'monthly' | 'yearly' | 'three_day',
  priceUsd: number,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildSubscriptionConfirmationEmail(locale, {
    name,
    plan,
    billingPeriod,
    priceUsd,
  }).html;
}

/**
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  to: string,
  name: string,
  plan: 'FREE' | 'PRO',
  billingPeriod: 'monthly' | 'yearly' | 'three_day',
  priceUsd: number,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildSubscriptionConfirmationEmail(await localeFor(to, locale), {
      name,
      plan,
      billingPeriod,
      priceUsd,
    })
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY ALERT EMAILS (localized)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type NewDeviceLoginDetails = NewDeviceDetails;

/**
 * Generate new device login alert email HTML
 */
export function getNewDeviceLoginEmail(
  name: string,
  details: NewDeviceLoginDetails,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildNewDeviceLoginEmail(locale, { name, details }).html;
}

/**
 * Send new device login alert email
 */
export async function sendNewDeviceLoginEmail(
  to: string,
  name: string,
  details: NewDeviceLoginDetails,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildNewDeviceLoginEmail(await localeFor(to, locale), { name, details })
  );
}

/**
 * Generate password changed alert email HTML
 */
export function getPasswordChangedEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildPasswordChangedEmail(locale, {
    name,
    ipAddress,
    location,
    timestamp,
  }).html;
}

/**
 * Send password changed alert email
 */
export async function sendPasswordChangedEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildPasswordChangedEmail(await localeFor(to, locale), {
      name,
      ipAddress,
      location,
      timestamp: new Date(),
    })
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TWO-FACTOR AUTHENTICATION EMAILS (localized)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate 2FA enabled alert email HTML
 */
export function getTwoFactorEnabledEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildTwoFactorEnabledEmail(locale, {
    name,
    ipAddress,
    location,
    timestamp,
  }).html;
}

/**
 * Send 2FA enabled alert email
 */
export async function sendTwoFactorEnabledEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildTwoFactorEnabledEmail(await localeFor(to, locale), {
      name,
      ipAddress,
      location,
      timestamp: new Date(),
    })
  );
}

/**
 * Generate 2FA disabled alert email HTML
 */
export function getTwoFactorDisabledEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildTwoFactorDisabledEmail(locale, {
    name,
    ipAddress,
    location,
    timestamp,
  }).html;
}

/**
 * Send 2FA disabled alert email
 */
export async function sendTwoFactorDisabledEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildTwoFactorDisabledEmail(await localeFor(to, locale), {
      name,
      ipAddress,
      location,
      timestamp: new Date(),
    })
  );
}

/**
 * Send the payout-details notice (WS-9, CODE-06A): payout details were added or
 * changed on an affiliate account and payouts to them are on hold. The text
 * carries no bank detail; it only has the two moments and the hold length.
 */
export async function sendPayoutDetailsChangedEmail(
  to: string,
  name: string,
  input: { changedAt: Date; holdUntil: Date; holdHours: number },
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildPayoutDetailsChangedEmail(await localeFor(to, locale), {
      name,
      changedAt: input.changedAt,
      holdUntil: input.holdUntil,
      holdHours: input.holdHours,
    })
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCOUNT DELETION EMAILS (localized)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate the account-deletion confirmation email HTML.
 *
 * Every interpolated value is HTML-escaped: the links carry a one-time token
 * and the name is user-controlled. The expiry is shown in the reader's
 * timezone and formats (UTC and a long English date when none is known).
 */
export function getAccountDeletionEmail(
  name: string,
  confirmationUrl: string,
  cancelUrl: string,
  expiresAt: Date,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): string {
  return buildAccountDeletionEmail(locale, {
    name,
    confirmationUrl,
    cancelUrl,
    expiresAt,
  }).html;
}

/**
 * Send the account-deletion confirmation email (confirm and cancel links).
 */
export async function sendAccountDeletionEmail(
  to: string,
  name: string | null,
  confirmationUrl: string,
  cancelUrl: string,
  expiresAt: Date,
  locale?: EmailLocale
): Promise<{ success: boolean; error?: string }> {
  return sendBuilt(
    to,
    buildAccountDeletionEmail(await localeFor(to, locale), {
      name,
      confirmationUrl,
      cancelUrl,
      expiresAt,
    })
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOT SENT BY ANYTHING YET (English only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Alert triggered, trial reminder and upgrade prompt have no caller. Move them
// onto the localized builders (./i18n/) when one is wired up.

/**
 * Generate alert triggered email HTML
 *
 * @param name - User's name
 * @param symbol - Trading symbol (e.g., XAUUSD)
 * @param timeframe - Chart timeframe (e.g., H1)
 * @param condition - Alert condition that was triggered
 * @param currentPrice - Current price when triggered
 * @returns HTML string for alert notification email
 */
export function getAlertTriggeredEmail(
  name: string,
  symbol: string,
  timeframe: string,
  condition: string,
  currentPrice: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alert Triggered</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #92400e; margin: 0; font-size: 20px;">Alert Triggered!</h1>
        </div>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, your trading alert has been triggered:
        </p>
        <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Symbol:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${symbol}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Timeframe:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${timeframe}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Condition:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${condition}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Current Price:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">$${currentPrice.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/charts/${symbol}/${timeframe}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          View Chart
        </a>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send alert triggered email
 */
export async function sendAlertEmail(
  to: string,
  name: string,
  symbol: string,
  timeframe: string,
  condition: string,
  currentPrice: number
): Promise<{ success: boolean; error?: string }> {
  const html = getAlertTriggeredEmail(
    name,
    symbol,
    timeframe,
    condition,
    currentPrice
  );
  return sendEmail(to, `Alert Triggered: ${symbol} ${timeframe}`, html);
}

/**
 * Generate trial reminder email HTML
 *
 * @param name - User's name
 * @param daysRemaining - Number of days remaining in trial
 * @param monthlyPriceUsd - PRO monthly price (SystemConfig getBasePriceUsd())
 * @returns HTML string for trial reminder email
 */
export function getTrialReminderEmail(
  name: string,
  daysRemaining: number,
  monthlyPriceUsd: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Pro Trial is Ending Soon</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #92400e; margin: 0; font-size: 20px;">Your Pro Trial is Ending Soon</h1>
        </div>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, your <strong>7-day Pro trial</strong> ends in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong>.
        </p>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          After your trial ends, you'll be charged <strong>${formatEmailUsd(monthlyPriceUsd)}/month</strong>.
        </p>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px 0;">
          You can cancel anytime before the trial ends to avoid charges.
        </p>
        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/billing" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Manage Subscription
        </a>
        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          If you have any questions, reply to this email or visit our help center.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send trial reminder email
 */
export async function sendTrialReminderEmail(
  to: string,
  name: string,
  daysRemaining: number,
  monthlyPriceUsd: number
): Promise<{ success: boolean; error?: string }> {
  const html = getTrialReminderEmail(name, daysRemaining, monthlyPriceUsd);
  return sendEmail(to, `Pro Trial Ending in ${daysRemaining} Days`, html);
}

/**
 * Generate upgrade prompt email HTML
 *
 * @param name - User's name
 * @param reason - Reason for upgrade prompt
 * @param monthlyPriceUsd - PRO monthly price (SystemConfig getBasePriceUsd())
 * @returns HTML string for upgrade prompt email
 */
export function getUpgradePromptEmail(
  name: string,
  reason:
    | 'alert_limit'
    | 'symbol_limit'
    | 'timeframe_limit'
    | 'indicator_limit',
  monthlyPriceUsd: number
): string {
  const reasons = {
    alert_limit: 'Price alerts are a Pro feature',
    symbol_limit: "You're trying to access Pro-exclusive features",
    timeframe_limit: "You're trying to access Pro-exclusive features",
    indicator_limit: "You're trying to access Pro-exclusive features",
  };

  const benefits = {
    alert_limit:
      '<li>Create up to <strong>100 price alerts</strong> on XAUUSD M5/M15</li>',
    symbol_limit:
      '<li><strong>Drawing engine line alerts</strong> - get alerted when price touches your drawn lines</li>',
    timeframe_limit:
      '<li><strong>Multi-timeframe visualization</strong> - overlay M5 structure on M15 charts</li>',
    indicator_limit:
      '<li><strong>Full alert & notification system</strong> for XAUUSD M5/M15</li>',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Upgrade to Pro</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Upgrade to Pro</h1>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, ${reasons[reason]}. Upgrade to <strong>Pro</strong> for more!
        </p>

        <h3 style="color: #18181b; font-size: 16px; margin: 24px 0 12px 0;">Pro Plan Benefits:</h3>
        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          ${benefits[reason]}
          <li><strong>100 price alerts</strong> plus drawing-engine line alerts</li>
          <li><strong>Multi-timeframe visualization</strong> for XAUUSD M5/M15</li>
          <li><strong>300 API requests/hour</strong> (vs 60 on Free)</li>
          <li><strong>7-day free trial</strong> to test all features</li>
        </ul>

        <p style="color: #18181b; font-weight: 600; margin: 0 0 24px 0;">
          Only ${formatEmailUsd(monthlyPriceUsd)}/month
        </p>

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/pricing" style="display: inline-block; background: #22c55e; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Start 7-Day Free Trial
        </a>

        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          If you have any questions, reply to this email or visit our help center.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send upgrade prompt email
 */
export async function sendUpgradePromptEmail(
  to: string,
  name: string,
  reason:
    | 'alert_limit'
    | 'symbol_limit'
    | 'timeframe_limit'
    | 'indicator_limit',
  monthlyPriceUsd: number
): Promise<{ success: boolean; error?: string }> {
  const html = getUpgradePromptEmail(name, reason, monthlyPriceUsd);
  return sendEmail(to, 'Upgrade to Pro - 7-Day Free Trial', html);
}
