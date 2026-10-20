// Ported from lib/email/subscription-emails.ts (Session 4A-11, Slice 5).
// 5 of the SOURCE's 8 functions are ported (signatures unchanged):
// cancellation, payment-failed, payment-receipt, subscription-canceled,
// affiliate-commission. Two are deliberately NOT ported:
// - getUpgradeEmailTemplate/sendUpgradeEmail: confirmed dead code in the
//   monolith itself (zero call sites anywhere in app/ or lib/) -- porting
//   dead code would just move the deadness, not preserve behavior.
// - getRenewalReminderEmailTemplate/sendRenewalReminderEmail: no
//   OutboxEvent eventType exists that would trigger it (a proactive
//   reminder-before-expiry email, not a reaction to a state-change event) --
//   out of Slice 5's own event-reaction scope.
//
// Each one is written in the recipient's own language and formats. The HTML
// comes from ./i18n (a byte-for-byte mirror of the monolith's
// lib/email/i18n/); a sender takes an optional trailing `locale` and, without
// one, asks the registered resolver (see ./recipient-locale). The outbox
// consumer calls these with no request in flight, so it reads what the
// recipient saved in Settings and falls back to English.

import { sendEmail } from './email.util';
import {
  buildAffiliateCommissionEmail,
  buildCancellationEmail,
  buildPaymentFailedEmail,
  buildPaymentReceiptEmail,
  buildSubscriptionCanceledEmail,
  DEFAULT_EMAIL_LOCALE,
  type BuiltEmail,
  type EmailLocale,
} from './i18n';
import { localeFor } from './recipient-locale';

type EmailTemplate = BuiltEmail;

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate cancellation confirmation email template
 *
 * @param name - User's display name
 * @param locale - Reader's language and formats (English when omitted)
 * @returns Email template with subject, HTML, and text content
 */
export function getCancellationEmailTemplate(
  name: string,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): EmailTemplate {
  return buildCancellationEmail(locale, { name });
}

/**
 * Generate payment failed email template
 *
 * @param name - User's display name
 * @param reason - Failure reason from Stripe
 * @param price - The subscriber's price per billing period (USD)
 * @param billingPeriod - 'monthly', 'yearly' or 'three_day'
 * @param locale - Reader's language and formats (English when omitted)
 * @returns Email template with subject, HTML, and text content
 */
export function getPaymentFailedEmailTemplate(
  name: string,
  reason: string,
  price: number,
  billingPeriod: 'monthly' | 'yearly' | 'three_day' = 'monthly',
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): EmailTemplate {
  return buildPaymentFailedEmail(locale, {
    name,
    reason,
    price,
    billingPeriod,
  });
}

/**
 * Generate payment receipt email template
 *
 * @param name - User's display name
 * @param amount - Payment amount in USD
 * @param nextBillingDate - Next billing date
 * @param invoiceUrl - Optional URL to Stripe invoice PDF
 * @param locale - Reader's language and formats (English when omitted)
 * @returns Email template with subject, HTML, and text content
 */
export function getPaymentReceiptEmailTemplate(
  name: string,
  amount: number,
  nextBillingDate: Date,
  invoiceUrl?: string,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): EmailTemplate {
  return buildPaymentReceiptEmail(locale, {
    name,
    amount,
    nextBillingDate,
    invoiceUrl,
  });
}

/**
 * Generate subscription canceled email template with access end date
 *
 * This is sent when a user cancels their PRO subscription but still has
 * access until the end of their billing period.
 *
 * @param name - User's display name
 * @param plan - Subscription plan ('FREE' | 'PRO')
 * @param cancelAt - Date when access will end
 * @param locale - Reader's language and formats (English when omitted)
 * @returns Email template with subject, HTML, and text content
 */
export function getSubscriptionCanceledEmailTemplate(
  name: string,
  plan: 'FREE' | 'PRO',
  cancelAt: Date,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE
): EmailTemplate {
  return buildSubscriptionCanceledEmail(locale, { name, plan, cancelAt });
}

/**
 * Generate affiliate commission earned email template
 *
 * Sent when an affiliate code is used and commission is earned.
 *
 * @param name - Affiliate's display name
 * @param code - Affiliate code that was used
 * @param commissionAmount - Commission earned in USD
 * @param totalEarnings - Total earnings to date in USD
 * @param locale - Reader's language and formats (English when omitted)
 * @param commissionPercent - The configured commission rate. The "Commission
 *   Rate" line is left out when it is not known (the outbox event does not
 *   carry it): it used to be a fixed 20% that could disagree with the setting.
 * @returns Email template with subject, HTML, and text content
 */
export function getAffiliateCommissionEmailTemplate(
  name: string,
  code: string,
  commissionAmount: number,
  totalEarnings: number,
  locale: EmailLocale = DEFAULT_EMAIL_LOCALE,
  commissionPercent?: number
): EmailTemplate {
  return buildAffiliateCommissionEmail(locale, {
    name,
    code,
    commissionAmount,
    totalEarnings,
    commissionPercent,
  });
}

/**
 * Send cancellation confirmation email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param locale - Reader's language and formats (the recipient's own by default)
 * @returns Email result with success status
 */
export async function sendCancellationEmail(
  email: string,
  name: string,
  locale?: EmailLocale
): Promise<EmailResult> {
  const template = getCancellationEmailTemplate(
    name,
    await localeFor(email, locale)
  );

  console.log(`[Email] Sending cancellation email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

/**
 * Send payment failed notification email
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param reason - Failure reason
 * @param price - The subscriber's own price per billing period (USD)
 * @param billingPeriod - The subscriber's billing period
 * @param locale - Reader's language and formats (the recipient's own by default)
 * @returns Email result with success status
 */
export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  reason: string,
  price: number,
  billingPeriod: 'monthly' | 'yearly' | 'three_day' = 'monthly',
  locale?: EmailLocale
): Promise<EmailResult> {
  const template = getPaymentFailedEmailTemplate(
    name,
    reason,
    price,
    billingPeriod,
    await localeFor(email, locale)
  );

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
 * @param locale - Reader's language and formats (the recipient's own by default)
 * @returns Email result with success status
 */
export async function sendPaymentReceiptEmail(
  email: string,
  name: string,
  amount: number,
  nextBillingDate: Date,
  invoiceUrl?: string,
  locale?: EmailLocale
): Promise<EmailResult> {
  const template = getPaymentReceiptEmailTemplate(
    name,
    amount,
    nextBillingDate,
    invoiceUrl,
    await localeFor(email, locale)
  );

  console.log(`[Email] Sending payment receipt to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

/**
 * Send subscription canceled email with access end date
 *
 * @param email - Recipient email address
 * @param name - User's display name
 * @param plan - Subscription plan ('FREE' | 'PRO')
 * @param cancelAt - Date when access will end
 * @param locale - Reader's language and formats (the recipient's own by default)
 * @returns Email result with success status
 */
export async function sendSubscriptionCanceledEmail(
  email: string,
  name: string,
  plan: 'FREE' | 'PRO',
  cancelAt: Date,
  locale?: EmailLocale
): Promise<EmailResult> {
  const template = getSubscriptionCanceledEmailTemplate(
    name,
    plan,
    cancelAt,
    await localeFor(email, locale)
  );

  console.log(`[Email] Sending subscription canceled email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}

/**
 * Send affiliate commission earned email
 *
 * @param email - Recipient email address
 * @param name - Affiliate's display name
 * @param code - Affiliate code that was used
 * @param commissionAmount - Commission earned in USD
 * @param totalEarnings - Total earnings to date in USD
 * @param locale - Reader's language and formats (the recipient's own by default)
 * @param commissionPercent - The configured commission rate, when known
 * @returns Email result with success status
 */
export async function sendAffiliateCommissionEmail(
  email: string,
  name: string,
  code: string,
  commissionAmount: number,
  totalEarnings: number,
  locale?: EmailLocale,
  commissionPercent?: number
): Promise<EmailResult> {
  const template = getAffiliateCommissionEmailTemplate(
    name,
    code,
    commissionAmount,
    totalEarnings,
    await localeFor(email, locale),
    commissionPercent
  );

  console.log(`[Email] Sending affiliate commission email to ${email}`);

  return sendEmail(email, template.subject, template.html);
}
