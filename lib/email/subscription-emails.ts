/**
 * Subscription Email Templates
 *
 * Email templates for subscription lifecycle events:
 * - Upgrade confirmation
 * - Cancellation confirmation
 * - Payment failed notification
 * - Payment receipt
 *
 * @module lib/email/subscription-emails
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
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
 * Generate upgrade confirmation email template
 *
 * @param name - User's display name
 * @param nextBillingDate - Optional next billing date
 * @returns Email template with subject, HTML, and text content
 */
export function getUpgradeEmailTemplate(
  name: string,
  nextBillingDate?: Date
): EmailTemplate {
  const formattedDate = nextBillingDate
    ? nextBillingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'after your 7-day trial ends';

  return {
    subject: `Welcome to ${APP_NAME} PRO!`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${APP_NAME} PRO!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${APP_NAME} PRO!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi ${name},</p>

    <p style="font-size: 16px;">Your account has been successfully upgraded. You now have access to:</p>

    <ul style="font-size: 16px; padding-left: 20px;">
      <li style="margin-bottom: 10px;"><strong>15 trading symbols</strong> - All major pairs + crypto + indices</li>
      <li style="margin-bottom: 10px;"><strong>9 timeframes</strong> - From M5 to D1</li>
      <li style="margin-bottom: 10px;"><strong>20 price alerts</strong></li>
      <li style="margin-bottom: 10px;"><strong>50 watchlist items</strong></li>
      <li style="margin-bottom: 10px;"><strong>Priority support</strong></li>
    </ul>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
      <p style="margin: 0; font-size: 14px; color: #666;">
        <strong>Your subscription:</strong> $29/month<br>
        <strong>Next billing date:</strong> ${formattedDate}
      </p>
    </div>

    <p style="font-size: 16px;">
      <a href="${APP_URL}/settings?tab=billing" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Manage Subscription</a>
    </p>

    <p style="font-size: 16px;">Happy trading!</p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      The ${APP_NAME} Team<br>
      <a href="${APP_URL}" style="color: #2563eb;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`,
    text: `Welcome to ${APP_NAME} PRO!

Hi ${name},

Your account has been successfully upgraded. You now have access to:
- 15 trading symbols - All major pairs + crypto + indices
- 9 timeframes - From M5 to D1
- 20 price alerts
- 50 watchlist items
- Priority support

Your subscription: $29/month
Next billing date: ${formattedDate}

Manage your subscription: ${APP_URL}/settings?tab=billing

Happy trading!

The ${APP_NAME} Team
${APP_URL}`,
  };
}

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
      <li style="margin-bottom: 10px;">5 trading symbols</li>
      <li style="margin-bottom: 10px;">3 timeframes (H1, H4, D1)</li>
      <li style="margin-bottom: 10px;">5 price alerts</li>
      <li style="margin-bottom: 10px;">5 watchlist items</li>
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
- 5 trading symbols
- 3 timeframes (H1, H4, D1)
- 5 price alerts
- 5 watchlist items

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
 * @returns Email template with subject, HTML, and text content
 */
export function getPaymentFailedEmailTemplate(
  name: string,
  reason: string
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

    <p style="font-size: 16px;">We couldn't process your payment for ${APP_NAME} PRO ($29/month).</p>

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

We couldn't process your payment for ${APP_NAME} PRO ($29/month).

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
 * Send upgrade confirmation email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param nextBillingDate - Optional next billing date
 */
export async function sendUpgradeEmail(
  email: string,
  name: string,
  nextBillingDate?: Date
): Promise<void> {
  const template = getUpgradeEmailTemplate(name, nextBillingDate);

  // TODO: Implement actual email sending with provider (SendGrid, Resend, etc.)
  console.log(`[Email] Sending upgrade email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);

  // Placeholder for email sending logic
  // await sendEmail({ to: email, ...template });
}

/**
 * Send cancellation confirmation email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 */
export async function sendCancellationEmail(
  email: string,
  name: string
): Promise<void> {
  const template = getCancellationEmailTemplate(name);

  // TODO: Implement actual email sending with provider
  console.log(`[Email] Sending cancellation email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);

  // Placeholder for email sending logic
  // await sendEmail({ to: email, ...template });
}

/**
 * Send payment failed notification email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param reason - Failure reason
 */
export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  reason: string
): Promise<void> {
  const template = getPaymentFailedEmailTemplate(name, reason);

  // TODO: Implement actual email sending with provider
  console.log(`[Email] Sending payment failed email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);

  // Placeholder for email sending logic
  // await sendEmail({ to: email, ...template });
}

/**
 * Send payment receipt email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param amount - Payment amount in USD
 * @param nextBillingDate - Next billing date
 * @param invoiceUrl - Optional URL to Stripe invoice PDF
 */
export async function sendPaymentReceiptEmail(
  email: string,
  name: string,
  amount: number,
  nextBillingDate: Date,
  invoiceUrl?: string
): Promise<void> {
  const template = getPaymentReceiptEmailTemplate(
    name,
    amount,
    nextBillingDate,
    invoiceUrl
  );

  // TODO: Implement actual email sending with provider
  console.log(`[Email] Sending payment receipt to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);

  // Placeholder for email sending logic
  // await sendEmail({ to: email, ...template });
}
