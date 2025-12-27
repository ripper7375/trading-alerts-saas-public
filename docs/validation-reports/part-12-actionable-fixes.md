# Part 12 - Actionable Fixes Document

**Generated:** 2025-12-26
**Part:** 12 - E-commerce & Billing
**Status:** READY (Minor enhancements pending)

---

## Quick Reference

| Priority         | Count | Action Required |
| ---------------- | ----- | --------------- |
| 🔴 Blockers      | 0     | None            |
| 🟡 Warnings      | 0     | None            |
| 🟢 Enhancements  | 2     | Optional        |
| ℹ️ Informational | 2     | No action       |

---

## 🟢 Enhancement #1: Implement Email Sending

### Description

Email templates exist but actual sending is placeholder code (TODO comments).

### Affected Files

- `lib/email/subscription-emails.ts`

### Current State

```typescript
// Lines 407-413
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
```

### Ready-to-Use Fix Prompt

````
Implement email sending for subscription emails using Resend.

Files to modify:
- lib/email/subscription-emails.ts

Requirements:
1. Use the Resend client from lib/email/resend.ts (if exists) or create one
2. Implement actual email sending for:
   - sendUpgradeEmail
   - sendCancellationEmail
   - sendPaymentFailedEmail
   - sendPaymentReceiptEmail
3. Use the existing email templates (getUpgradeEmailTemplate, etc.)
4. Add error handling with try-catch
5. Log success/failure for monitoring
6. Use environment variable RESEND_API_KEY

Example implementation:
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendUpgradeEmail(
  email: string,
  name: string,
  nextBillingDate?: Date
): Promise<void> {
  const template = getUpgradeEmailTemplate(name, nextBillingDate);

  try {
    await resend.emails.send({
      from: 'Trading Alerts <noreply@tradingalerts.com>',
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    console.log(`[Email] Upgrade email sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send upgrade email:', error);
    // Don't throw - email failure shouldn't break the flow
  }
}
````

### Priority

🟢 Low - Core functionality works, emails are logged

### When to Fix

When email provider (Resend) is configured and API key is available.

---

## 🟢 Enhancement #2: Affiliate Commission Notification Email

### Description

When an affiliate code is used, the affiliate should receive a notification email about their earned commission.

### Affected Files

- `lib/stripe/webhook-handlers.ts`

### Current State

```typescript
// Lines 514-515
// TODO: Send commission notification email to affiliate
// await sendCodeUsedEmail(affiliateCode.affiliateProfile, code, breakdown.commissionAmount);
```

### Ready-to-Use Fix Prompt

````
Add affiliate commission notification email.

Files to modify:
- lib/stripe/webhook-handlers.ts
- lib/email/subscription-emails.ts (add new template)

Requirements:
1. Create new email template: getCodeUsedEmailTemplate()
2. Create new sending function: sendCodeUsedEmail()
3. Call sendCodeUsedEmail in processAffiliateCommission()
4. Email should include:
   - Affiliate name
   - Code that was used
   - Commission amount earned
   - Link to affiliate dashboard

Email template example:
Subject: "Code Used! You Earned $X.XX Commission"
Body:
- Congratulations message
- Code used: [CODE]
- Commission earned: $X.XX
- Total pending: $Y.YY
- Link to dashboard

Implementation location:
In processAffiliateCommission() around line 514:
```typescript
// Send commission notification email to affiliate
if (affiliateCode.affiliateProfile?.email) {
  try {
    await sendCodeUsedEmail(
      affiliateCode.affiliateProfile.email,
      affiliateCode.affiliateProfile.fullName || 'Affiliate',
      code,
      breakdown.commissionAmount
    );
  } catch (emailError) {
    console.error('[Webhook] Error sending commission email:', emailError);
  }
}
````

### Priority

🟢 Low - Affiliate system works, just missing notification

### When to Fix

When email system is implemented (depends on Enhancement #1).

---

## ℹ️ Informational Notes

### Note #1: Multi-Provider Payment Support

The implementation supports both Stripe and dLocal payment providers. This is an **enhancement** beyond the original OpenAPI specification.

**Evidence:**

- `app/api/subscription/route.ts`: Lines 152-156 detect provider
- `app/api/invoices/route.ts`: Lines 93-118 combine both providers
- `components/billing/subscription-card.tsx`: Lines 224-256 show dLocal-specific UI

**Action:** None required - this is a feature, not a bug.

### Note #2: Lazy Stripe Client Initialization

The Stripe client uses lazy initialization pattern to prevent build-time errors.

**Evidence:**

- `lib/stripe/stripe.ts`: Lines 20-45

**Action:** None required - this is intentional good practice.

---

## Pre-Localhost Checklist

Before testing Part 12 locally, ensure:

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npm run db:generate

# 3. Set environment variables
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_PRO_PRICE_ID="price_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export DATABASE_URL="postgresql://..."

# 4. Start development server
npm run dev

# 5. Test endpoints
# - GET http://localhost:3000/api/subscription (needs auth)
# - POST http://localhost:3000/api/checkout (needs auth)
# - GET http://localhost:3000/api/invoices (needs auth)
```

---

## Testing Commands

### Stripe Webhook Testing

```bash
# Install Stripe CLI
# Then forward webhooks to localhost:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### API Testing with curl

```bash
# Validate affiliate code (public endpoint)
curl -X POST http://localhost:3000/api/checkout/validate-code \
  -H "Content-Type: application/json" \
  -d '{"code": "TESTCODE"}'

# Expected response for invalid code:
# {"valid":false,"error":"Invalid code","message":"This affiliate code does not exist","code":"CODE_NOT_FOUND"}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-26

---

_End of Actionable Fixes Document_
