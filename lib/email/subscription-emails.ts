/**
 * Subscription Email Templates
 *
 * Email templates for subscription lifecycle events:
 * - Upgrade confirmation
 * - Cancellation confirmation
 * - Payment failed notification
 * - Payment receipt
 * - Subscription canceled with access end date
 *
 * @module lib/email/subscription-emails
 */

import { sendEmail } from './email';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const APP_NAME = 'Trading Alerts';
const APP_URL = process.env['NEXTAUTH_URL'] || 'https://tradingalerts.com';
const SUPPORT_EMAIL = 'support@tradingalerts.com';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL TEMPLATES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate cancellation confirmation email template
 *
 * @param name - User's display name
 * @returns Email template with subject, HTML, and text content
 */
export function getCancellationEmailTemplate(name: string): EmailTemplate {
  return {
    subject: 'Your PRO subscription has been cancelled',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f3f4f6; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #374151; margin: 0; font-size: 28px;">Subscription Cancelled</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">Your ${APP_NAME} PRO subscription has been cancelled.</p>

    <p style="font-size: 16px;">You now have FREE tier access:</p>

    <ul style="font-size: 16px; padding-left: 20px;">
      <li style="margin-bottom: 10px;">XAUUSD (Gold) on M5 and M15</li>
      <li style="margin-bottom: 10px;">Full market data and indicator overlays</li>
      <li style="margin-bottom: 10px;">No price alerts (PRO feature)</li>
    </ul>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
      <p style="margin: 0; font-size: 14px;">
        <strong>Changed your mind?</strong><br>
        You can upgrade again anytime to regain access to all PRO features.
      </p>
    </div>

    <p style="font-size: 16px;">
      <a href="${APP_URL}/pricing" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Pricing</a>
    </p>

    <p style="font-size: 16px;">Thank you for trying PRO!</p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Subscription Cancelled

Hi ${name},

Your ${APP_NAME} PRO subscription has been cancelled.

You now have FREE tier access:
- XAUUSD (Gold) on M5 and M15
- Full market data and indicator overlays
- No price alerts (PRO feature)

Changed your mind? You can upgrade again anytime: ${APP_URL}/pricing

Thank you for trying PRO!

The ${APP_NAME} Team
${APP_URL}`,
  };
}

/**
 * Generate payment failed email template
 *
 * @param name - User's display name
 * @param reason - Failure reason from Stripe
 * @param monthlyPrice - Monthly subscription price (from SystemConfig, default 29)
 * @returns Email template with subject, HTML, and text content
 */
export function getPaymentFailedEmailTemplate(
  name: string,
  reason: string,
  monthlyPrice: number = 29
): EmailTemplate {
  return {
    subject: 'Payment Failed - Action Required',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef2f2; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #dc2626; margin: 0; font-size: 28px;">Payment Failed</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">We couldn't process your payment for ${APP_NAME} PRO ($${monthlyPrice}/month).</p>

    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;">
        <strong>Reason:</strong> ${reason}
      </p>
    </div>

    <p style="font-size: 16px;"><strong>Please update your payment method within 3 days</strong> to keep your PRO access.</p>

    <p style="font-size: 16px;">
      <a href="${APP_URL}/settings?tab=billing" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Update Payment Method</a>
    </p>

    <p style="font-size: 16px;">If not resolved, your account will be downgraded to the FREE tier.</p>

    <p style="font-size: 14px; color: #666;">
      Need help? Reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb;">${SUPPORT_EMAIL}</a>
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Payment Failed

Hi ${name},

We couldn't process your payment for ${APP_NAME} PRO ($${monthlyPrice}/month).

Reason: ${reason}

Please update your payment method within 3 days to keep your PRO access:
${APP_URL}/settings?tab=billing

If not resolved, your account will be downgraded to the FREE tier.

Need help? Contact us at ${SUPPORT_EMAIL}

The ${APP_NAME} Team
${APP_URL}`,
  };
}

/**
 * Generate payment receipt email template
 *
 * @param name - User's display name
 * @param amount - Payment amount in USD
 * @param nextBillingDate - Next billing date
 * @param invoiceUrl - Optional URL to Stripe invoice PDF
 * @returns Email template with subject, HTML, and text content
 */
export function getPaymentReceiptEmailTemplate(
  name: string,
  amount: number,
  nextBillingDate: Date,
  invoiceUrl?: string
): EmailTemplate {
  const formattedDate = nextBillingDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    subject: `Payment Receipt - ${APP_NAME} PRO`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Payment Successful</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">Your payment was successful!</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Description</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${APP_NAME} PRO - Monthly</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Amount</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Date</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${today}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">Next billing date</td>
          <td style="padding: 10px 0; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    ${
      invoiceUrl
        ? `
    <p style="font-size: 16px;">
      <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Download Invoice</a>
    </p>
    `
        : ''
    }

    <p style="font-size: 16px;">Thank you for being a PRO member!</p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Payment Receipt

Hi ${name},

Your payment was successful!

Description: ${APP_NAME} PRO - Monthly
Amount: $${amount.toFixed(2)}
Date: ${today}
Next billing date: ${formattedDate}

${invoiceUrl ? `Download invoice: ${invoiceUrl}` : ''}

Thank you for being a PRO member!

The ${APP_NAME} Team
${APP_URL}`,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL SENDING FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send cancellation confirmation email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @returns Email result with success status
 */
export async function sendCancellationEmail(
  email: string,
  name: string
): Promise<EmailResult> {
  const template = getCancellationEmailTemplate(name);

  console.log(`[Email] Sending cancellation email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

/**
 * Send payment failed notification email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param reason - Failure reason
 * @returns Email result with success status
 */
export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  reason: string
): Promise<EmailResult> {
  const template = getPaymentFailedEmailTemplate(name, reason);

  console.log(`[Email] Sending payment failed email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

/**
 * Send payment receipt email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param amount - Payment amount in USD
 * @param nextBillingDate - Next billing date
 * @param invoiceUrl - Optional URL to Stripe invoice PDF
 * @returns Email result with success status
 */
export async function sendPaymentReceiptEmail(
  email: string,
  name: string,
  amount: number,
  nextBillingDate: Date,
  invoiceUrl?: string
): Promise<EmailResult> {
  const template = getPaymentReceiptEmailTemplate(
    name,
    amount,
    nextBillingDate,
    invoiceUrl
  );

  console.log(`[Email] Sending payment receipt to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIPTION CANCELED EMAIL (Phase 5)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate subscription canceled email template with access end date
 *
 * This is sent when a user cancels their PRO subscription but still has
 * access until the end of their billing period.
 *
 * @param name - User's display name
 * @param plan - Subscription plan ('FREE' | 'PRO')
 * @param cancelAt - Date when access will end
 * @returns Email template with subject, HTML, and text content
 */
export function getSubscriptionCanceledEmailTemplate(
  name: string,
  plan: 'FREE' | 'PRO',
  cancelAt: Date
): EmailTemplate {
  const formattedDate = cancelAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    subject: 'Subscription Canceled - Trading Alerts',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Canceled</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #cc0000; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Canceled</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">Your <strong>${plan}</strong> subscription has been canceled.</p>

    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-size: 14px;">
        <strong>Access Until:</strong> ${formattedDate}<br>
        You'll continue to have ${plan} access until ${formattedDate}.
      </p>
    </div>

    <p style="font-size: 16px;">After that, your account will revert to the <strong>Free</strong> plan with:</p>

    <ul style="font-size: 16px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">XAUUSD (Gold) on M5 and M15</li>
      <li style="margin-bottom: 8px;">Full market data and indicator overlays</li>
      <li style="margin-bottom: 8px;">No price alerts (PRO feature)</li>
    </ul>

    <p style="font-size: 16px;">
      Changed your mind? <a href="${APP_URL}/settings/billing" style="color: #0066cc; font-weight: 600;">Reactivate your subscription</a>
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb;">${SUPPORT_EMAIL}</a><br><br>
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Subscription Canceled

Hi ${name},

Your ${plan} subscription has been canceled.

Access Until: ${formattedDate}
You'll continue to have ${plan} access until ${formattedDate}.

After that, your account will revert to the Free plan with:
- XAUUSD (Gold) on M5 and M15
- Full market data and indicator overlays
- No price alerts (PRO feature)

Changed your mind? Reactivate: ${APP_URL}/settings/billing

Need help? ${SUPPORT_EMAIL}

The ${APP_NAME} Team
${APP_URL}`,
  };
}

/**
 * Send subscription canceled email with access end date
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param plan - Subscription plan ('FREE' | 'PRO')
 * @param cancelAt - Date when access will end
 * @returns Email result with success status
 */
export async function sendSubscriptionCanceledEmail(
  email: string,
  name: string,
  plan: 'FREE' | 'PRO',
  cancelAt: Date
): Promise<EmailResult> {
  const template = getSubscriptionCanceledEmailTemplate(name, plan, cancelAt);

  console.log(`[Email] Sending subscription canceled email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE COMMISSION EMAIL (Phase 5)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate affiliate commission earned email template
 *
 * Sent when an affiliate code is used and commission is earned.
 *
 * @param name - Affiliate's display name
 * @param code - Affiliate code that was used
 * @param commissionAmount - Commission earned in USD
 * @param totalEarnings - Total earnings to date in USD
 * @returns Email template with subject, HTML, and text content
 */
export function getAffiliateCommissionEmailTemplate(
  name: string,
  code: string,
  commissionAmount: number,
  totalEarnings: number
): EmailTemplate {
  return {
    subject: `Commission Earned! $${commissionAmount.toFixed(2)} - ${APP_NAME}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commission Earned</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Commission Earned!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">Great news! Your affiliate code was just used and you've earned a commission.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Code Used</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${code}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #666;">Commission Earned</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #22c55e;">+$${commissionAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">Total Earnings</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600;">$${totalEarnings.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #666;">
      <strong>Commission Rate:</strong> 20% of subscription revenue
    </p>

    <p style="font-size: 16px;">
      <a href="${APP_URL}/affiliate/dashboard" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Dashboard</a>
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Commission Earned!

Hi ${name},

Great news! Your affiliate code was just used and you've earned a commission.

Code Used: ${code}
Commission Earned: +$${commissionAmount.toFixed(2)}
Total Earnings: $${totalEarnings.toFixed(2)}

Commission Rate: 20% of subscription revenue

View your dashboard: ${APP_URL}/affiliate/dashboard

The ${APP_NAME} Team
${APP_URL}`,
  };
}

/**
 * Send affiliate commission earned email
 *
 * @param email - Recipient email address
 * @param name - Affiliate's display name
 * @param code - Affiliate code that was used
 * @param commissionAmount - Commission earned in USD
 * @param totalEarnings - Total earnings to date in USD
 * @returns Email result with success status
 */
export async function sendAffiliateCommissionEmail(
  email: string,
  name: string,
  code: string,
  commissionAmount: number,
  totalEarnings: number
): Promise<EmailResult> {
  const template = getAffiliateCommissionEmailTemplate(
    name,
    code,
    commissionAmount,
    totalEarnings
  );

  console.log(`[Email] Sending affiliate commission email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}
