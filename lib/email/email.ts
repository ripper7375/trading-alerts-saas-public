/**
 * Email Service
 *
 * Send emails using Resend API with reusable templates.
 * Supports welcome emails, verification emails, password reset, and alerts.
 */

import { Resend } from 'resend';

// Lazy initialization to prevent build-time errors
let resendClient: Resend | null = null;

/**
 * Get Resend client instance (lazy initialization)
 */
function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Email configuration
 */
const EMAIL_CONFIG = {
  from: 'Trading Alerts <noreply@tradingalerts.com>',
  replyTo: 'support@tradingalerts.com',
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
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resend = getResendClient();

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

/**
 * Generate welcome email HTML
 *
 * @param name - User's name
 * @returns HTML string for welcome email
 */
export function getWelcomeEmail(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Trading Alerts</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Welcome to Trading Alerts, ${name}!</h1>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Your account has been created successfully. You're now ready to set up your first trading alert!
        </p>
        <h2 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">Get Started:</h2>
        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          <li>Set up your first alert to track price movements</li>
          <li>Add symbols to your watchlist for quick access</li>
          <li>Customize your notification preferences</li>
        </ul>
        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Go to Dashboard
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
 * Generate email verification HTML
 *
 * @param name - User's name
 * @param verificationUrl - URL to verify email
 * @returns HTML string for verification email
 */
export function getVerificationEmail(
  name: string,
  verificationUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Verify Your Email Address</h1>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, please click the button below to verify your email address and activate your account.
        </p>
        <a href="${verificationUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin: 16px 0;">
          Verify Email Address
        </a>
        <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
          If you didn't create an account with Trading Alerts, you can safely ignore this email.
        </p>
        <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">
          This link will expire in 24 hours.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate password reset email HTML
 *
 * @param name - User's name
 * @param resetUrl - URL to reset password
 * @returns HTML string for password reset email
 */
export function getPasswordResetEmail(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Reset Your Password</h1>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, we received a request to reset your password. Click the button below to create a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">
          This link will expire in 1 hour.
        </p>
      </div>
    </body>
    </html>
  `;
}

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
        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/dashboard/charts/${symbol}/${timeframe}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          View Chart
        </a>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const html = getWelcomeEmail(name);
  return sendEmail(to, 'Welcome to Trading Alerts!', html);
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const html = getVerificationEmail(name, verificationUrl);
  return sendEmail(to, 'Verify Your Email - Trading Alerts', html);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const html = getPasswordResetEmail(name, resetUrl);
  return sendEmail(to, 'Reset Your Password - Trading Alerts', html);
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
 * Generate subscription confirmation email HTML
 *
 * @param name - User's name
 * @param plan - Subscription plan ('FREE' or 'PRO')
 * @param billingPeriod - Billing period ('monthly' or 'yearly')
 * @returns HTML string for subscription confirmation email
 */
export function getSubscriptionConfirmationEmail(
  name: string,
  plan: 'FREE' | 'PRO',
  billingPeriod: 'monthly' | 'yearly'
): string {
  const pricing = {
    FREE: { monthly: '$0', yearly: '$0' },
    PRO: {
      monthly: '$29/month',
      yearly: '$290/year',
    },
  };

  const trialInfo =
    plan === 'PRO'
      ? '<p style="color: #22c55e; font-weight: 600;">7-Day Free Trial: Your card will not be charged until your trial ends.</p>'
      : '';

  const proFeatures = `
    <h3 style="color: #18181b; font-size: 16px; margin: 24px 0 12px 0;">What You Get with Pro:</h3>
    <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
      <li><strong>15 Symbols</strong> - All forex pairs, crypto (BTC, ETH), indices (US30, NDX100), and commodities (Gold, Silver)</li>
      <li><strong>9 Timeframes</strong> - From 5-minute to daily analysis (M5, M15, M30, H1, H2, H4, H8, H12, D1)</li>
      <li><strong>135 Chart Combinations</strong> - Full flexibility</li>
      <li><strong>20 Alerts</strong> - Never miss a trading opportunity</li>
      <li><strong>5 Watchlists</strong> with 50 items each</li>
      <li><strong>8 Technical Indicators</strong> - Including Keltner Channels, Momentum Candles, TEMA, HRMA, SMMA, ZigZag</li>
      <li><strong>300 API Requests/Hour</strong></li>
      <li><strong>Advanced Charts & Data Export</strong></li>
    </ul>
  `;

  const freeFeatures = `
    <h3 style="color: #18181b; font-size: 16px; margin: 24px 0 12px 0;">Your Free Plan Includes:</h3>
    <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
      <li><strong>5 Symbols</strong> - BTCUSD, EURUSD, USDJPY, US30, XAUUSD</li>
      <li><strong>3 Timeframes</strong> - H1, H4, D1</li>
      <li><strong>15 Chart Combinations</strong></li>
      <li><strong>5 Alerts</strong></li>
      <li><strong>1 Watchlist</strong> with 5 items</li>
      <li><strong>2 Basic Indicators</strong> - Fractals and Trendlines</li>
      <li><strong>60 API Requests/Hour</strong></li>
    </ul>
    <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
      <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/pricing" style="color: #2563eb; font-weight: 500;">Upgrade to Pro</a> for more features!
    </p>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Subscription Confirmed</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Subscription Confirmed!</h1>
        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, your <strong>${plan}</strong> subscription is now active.
        </p>

        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #18181b; margin: 0 0 12px 0; font-size: 16px;">Plan Details</h3>
          <p style="color: #52525b; margin: 4px 0;"><strong>Tier:</strong> ${plan}</p>
          <p style="color: #52525b; margin: 4px 0;"><strong>Billing:</strong> ${pricing[plan][billingPeriod]}</p>
          ${trialInfo}
        </div>

        ${plan === 'PRO' ? proFeatures : freeFeatures}

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Go to Dashboard
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
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  to: string,
  name: string,
  plan: 'FREE' | 'PRO',
  billingPeriod: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string }> {
  const html = getSubscriptionConfirmationEmail(name, plan, billingPeriod);
  return sendEmail(to, `${plan} Subscription Confirmed`, html);
}

/**
 * Generate trial reminder email HTML
 *
 * @param name - User's name
 * @param daysRemaining - Number of days remaining in trial
 * @returns HTML string for trial reminder email
 */
export function getTrialReminderEmail(
  name: string,
  daysRemaining: number
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
          After your trial ends, you'll be charged <strong>$29/month</strong> or <strong>$290/year</strong> depending on your selected plan.
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
  daysRemaining: number
): Promise<{ success: boolean; error?: string }> {
  const html = getTrialReminderEmail(name, daysRemaining);
  return sendEmail(to, `Pro Trial Ending in ${daysRemaining} Days`, html);
}

/**
 * Generate upgrade prompt email HTML
 *
 * @param name - User's name
 * @param reason - Reason for upgrade prompt
 * @returns HTML string for upgrade prompt email
 */
export function getUpgradePromptEmail(
  name: string,
  reason: 'alert_limit' | 'symbol_limit' | 'timeframe_limit' | 'indicator_limit'
): string {
  const reasons = {
    alert_limit: "You've reached your 5 alert limit",
    symbol_limit: "You're trying to access PRO-exclusive symbols",
    timeframe_limit: "You're trying to access PRO-exclusive timeframes",
    indicator_limit: "You're trying to access PRO-exclusive indicators",
  };

  const benefits = {
    alert_limit: '<li>Increase from <strong>5 to 20 alerts</strong></li>',
    symbol_limit:
      '<li>Access to <strong>all 15 symbols</strong> including ETHUSD, GBPUSD, XAGUSD, and more</li>',
    timeframe_limit:
      '<li>Access to <strong>all 9 timeframes</strong> including M5, M15, M30, H2, H8, H12</li>',
    indicator_limit:
      '<li>Access to <strong>all 8 indicators</strong> including Momentum Candles, Keltner Channels, TEMA, HRMA, SMMA, ZigZag</li>',
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
          <li><strong>135 chart combinations</strong> (15 symbols x 9 timeframes)</li>
          <li><strong>5 watchlists</strong> with 50 items each</li>
          <li><strong>300 API requests/hour</strong> (vs 60 on Free)</li>
          <li><strong>7-day free trial</strong> to test all features</li>
        </ul>

        <p style="color: #18181b; font-weight: 600; margin: 0 0 24px 0;">
          Only $29/month or save with $290/year
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
  reason: 'alert_limit' | 'symbol_limit' | 'timeframe_limit' | 'indicator_limit'
): Promise<{ success: boolean; error?: string }> {
  const html = getUpgradePromptEmail(name, reason);
  return sendEmail(to, 'Upgrade to Pro - 7-Day Free Trial', html);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY ALERT EMAILS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface NewDeviceLoginDetails {
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  timestamp: Date;
}

/**
 * Generate new device login alert email HTML
 */
export function getNewDeviceLoginEmail(
  name: string,
  details: NewDeviceLoginDetails
): string {
  const formattedTime = details.timestamp.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Device Login</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #92400e; margin: 0; font-size: 20px;">New Device Login Detected</h1>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, we noticed a login to your Trading Alerts account from a new device:
        </p>

        <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Device:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${details.device}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Browser:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${details.browser}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Operating System:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${details.os}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Location:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${details.location}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">IP Address:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${details.ipAddress}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Time:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${formattedTime}</td>
            </tr>
          </table>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If this was you:</strong> No action is needed. You can safely ignore this email.
        </p>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If this wasn't you:</strong> Someone may have access to your account. We recommend:
        </p>

        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          <li>Change your password immediately</li>
          <li>Review your active sessions and sign out unknown devices</li>
          <li>Enable two-factor authentication for added security</li>
        </ul>

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin-right: 8px;">
          Secure My Account
        </a>

        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          You're receiving this email because you have security alerts enabled.
          <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="color: #2563eb;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send new device login alert email
 */
export async function sendNewDeviceLoginEmail(
  to: string,
  name: string,
  details: NewDeviceLoginDetails
): Promise<{ success: boolean; error?: string }> {
  const html = getNewDeviceLoginEmail(name, details);
  return sendEmail(to, 'Security Alert: New Device Login Detected', html);
}

/**
 * Generate password changed alert email HTML
 */
export function getPasswordChangedEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date
): string {
  const formattedTime = timestamp.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Changed</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #dbeafe; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #1e40af; margin: 0; font-size: 20px;">Password Changed Successfully</h1>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, your Trading Alerts account password was changed.
        </p>

        <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Time:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Location:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${location}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">IP Address:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${ipAddress}</td>
            </tr>
          </table>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If you made this change:</strong> No action is needed. Your account is secure.
        </p>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If you didn't make this change:</strong> Your account may be compromised. Please:
        </p>

        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          <li>Reset your password immediately using the "Forgot Password" feature</li>
          <li>Review your account for any unauthorized changes</li>
          <li>Contact our support team if you need assistance</li>
        </ul>

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/forgot-password" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Reset Password
        </a>

        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          You're receiving this email because you have security alerts enabled.
          <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="color: #2563eb;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send password changed alert email
 */
export async function sendPasswordChangedEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string
): Promise<{ success: boolean; error?: string }> {
  const html = getPasswordChangedEmail(name, ipAddress, location, new Date());
  return sendEmail(to, 'Security Alert: Password Changed', html);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TWO-FACTOR AUTHENTICATION EMAILS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate 2FA enabled alert email HTML
 */
export function getTwoFactorEnabledEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date
): string {
  const formattedTime = timestamp.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Two-Factor Authentication Enabled</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #dcfce7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #166534; margin: 0; font-size: 20px;">Two-Factor Authentication Enabled</h1>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, two-factor authentication has been successfully enabled on your Trading Alerts account.
        </p>

        <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Time:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Location:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${location}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">IP Address:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${ipAddress}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #18181b; font-size: 16px; margin: 24px 0 12px 0;">Important Reminders:</h3>
        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          <li>Keep your backup codes in a safe place</li>
          <li>You'll need your authenticator app to sign in</li>
          <li>If you lose access to your authenticator, use a backup code</li>
        </ul>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If you didn't enable 2FA:</strong> Your account may be compromised. Please contact support immediately.
        </p>

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Manage Security Settings
        </a>

        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          You're receiving this email because you have security alerts enabled.
          <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="color: #2563eb;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send 2FA enabled alert email
 */
export async function sendTwoFactorEnabledEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string
): Promise<{ success: boolean; error?: string }> {
  const html = getTwoFactorEnabledEmail(name, ipAddress, location, new Date());
  return sendEmail(to, 'Security Alert: Two-Factor Authentication Enabled', html);
}

/**
 * Generate 2FA disabled alert email HTML
 */
export function getTwoFactorDisabledEmail(
  name: string,
  ipAddress: string,
  location: string,
  timestamp: Date
): string {
  const formattedTime = timestamp.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Two-Factor Authentication Disabled</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #92400e; margin: 0; font-size: 20px;">Two-Factor Authentication Disabled</h1>
        </div>

        <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${name}, two-factor authentication has been disabled on your Trading Alerts account.
        </p>

        <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Time:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Location:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${location}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">IP Address:</td>
              <td style="color: #18181b; font-weight: 600; padding: 8px 0; text-align: right;">${ipAddress}</td>
            </tr>
          </table>
        </div>

        <p style="color: #dc2626; line-height: 1.6; margin: 16px 0; font-weight: 500;">
          Your account is now less secure without two-factor authentication.
        </p>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If you disabled 2FA:</strong> We recommend re-enabling it for maximum security.
        </p>

        <p style="color: #52525b; line-height: 1.6; margin: 16px 0;">
          <strong>If you didn't disable 2FA:</strong> Your account may be compromised. Please:
        </p>

        <ul style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
          <li>Change your password immediately</li>
          <li>Re-enable two-factor authentication</li>
          <li>Review your account for unauthorized changes</li>
        </ul>

        <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Secure My Account
        </a>

        <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
          You're receiving this email because you have security alerts enabled.
          <a href="${process.env['NEXTAUTH_URL'] || 'http://localhost:3000'}/settings/security" style="color: #2563eb;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send 2FA disabled alert email
 */
export async function sendTwoFactorDisabledEmail(
  to: string,
  name: string,
  ipAddress: string,
  location: string
): Promise<{ success: boolean; error?: string }> {
  const html = getTwoFactorDisabledEmail(name, ipAddress, location, new Date());
  return sendEmail(to, 'Security Alert: Two-Factor Authentication Disabled', html);
}
