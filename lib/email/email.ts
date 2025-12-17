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
      replyTo: EMAIL_CONFIG.replyTo,
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
  const html = getAlertTriggeredEmail(name, symbol, timeframe, condition, currentPrice);
  return sendEmail(to, `Alert Triggered: ${symbol} ${timeframe}`, html);
}
