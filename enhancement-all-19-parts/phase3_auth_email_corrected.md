# Phase 3: Authentication & Email

**Sequential Execution Plan: Phase 3 of 6**
**Total Tasks**: 8
**Estimated Duration**: 6-8 hours
**Priority**: 🟢 FEATURE - Complete auth system with email integration

---

## 🎯 Task 3.1: Setup Resend Email Integration

**Priority**: HIGHEST | **Time**: 1 hour

#### Email Templates with CORRECT Pricing

```typescript
// In lib/email.ts

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verificationUrl: string;
}) {
  const html = `
    <h1>Welcome to Trading Alerts SaaS!</h1>
    <p>Hi ${params.name},</p>
    <p>Thank you for signing up. Please verify your email address.</p>
    <a href="${params.verificationUrl}">Verify Email</a>
    <p>This link expires in 24 hours.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: 'Verify your email address',
    html,
  });
}

/**
 * ✅ Subscription confirmation with CORRECT pricing
 */
export async function sendSubscriptionConfirmationEmail(params: {
  to: string;
  name: string;
  plan: 'FREE' | 'PRO'; // ✅ Only 2 tiers
  billingPeriod: 'monthly' | 'yearly';
}) {
  const { to, name, plan, billingPeriod } = params;

  // ✅ CORRECT pricing
  const pricing = {
    FREE: { monthly: '$0', yearly: '$0' },
    PRO: {
      monthly: '$29/month', // ✅ $29/month
      yearly: '$290/year', // ✅ $290/year (save $58)
    },
  };

  // ✅ 7-day trial for PRO
  const trialInfo =
    plan === 'PRO'
      ? '<p><strong>7-Day Free Trial:</strong> Your card will not be charged until your trial ends.</p>'
      : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Subscription Confirmed!</h1>
        <p>Hi ${name},</p>
        <p>Your <strong>${plan}</strong> subscription is now active.</p>
        
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
          <h3>Plan Details</h3>
          <p><strong>Tier:</strong> ${plan}</p>
          <p><strong>Billing:</strong> ${pricing[plan][billingPeriod]}</p>
          ${trialInfo}
        </div>

        ${
          plan === 'PRO'
            ? `
          <h3>What You Get with Pro:</h3>
          <ul>
            <li><strong>15 Symbols</strong> - All forex pairs, crypto (BTC, ETH), indices (US30, NDX100), and commodities (Gold, Silver)</li>
            <li><strong>9 Timeframes</strong> - From 5-minute to daily analysis (M5, M15, M30, H1, H2, H4, H8, H12, D1)</li>
            <li><strong>135 Chart Combinations</strong> - Full flexibility</li>
            <li><strong>20 Alerts</strong> - Never miss a trading opportunity</li>
            <li><strong>5 Watchlists</strong> with 50 items each</li>
            <li><strong>8 Technical Indicators</strong> - Including Keltner Channels, Momentum Candles, TEMA, HRMA, SMMA, ZigZag</li>
            <li><strong>300 API Requests/Hour</strong></li>
            <li><strong>Advanced Charts & Data Export</strong></li>
          </ul>
        `
            : `
          <h3>Your Free Plan Includes:</h3>
          <ul>
            <li><strong>5 Symbols</strong> - BTCUSD, EURUSD, USDJPY, US30, XAUUSD</li>
            <li><strong>3 Timeframes</strong> - H1, H4, D1</li>
            <li><strong>15 Chart Combinations</strong></li>
            <li><strong>5 Alerts</strong></li>
            <li><strong>1 Watchlist</strong> with 5 items</li>
            <li><strong>2 Basic Indicators</strong> - Fractals and Trendlines</li>
            <li><strong>60 API Requests/Hour</strong></li>
          </ul>
          <p><a href="${process.env.NEXTAUTH_URL}/pricing">Upgrade to Pro</a> for more features!</p>
        `
        }

        <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display: inline-block; padding: 12px 30px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `${plan} Subscription Confirmed`,
    html,
  });
}

/**
 * ✅ Trial reminder email (PRO only, 7 days)
 */
export async function sendTrialReminderEmail(params: {
  to: string;
  name: string;
  daysRemaining: number;
}) {
  const html = `
    <h1>Your Pro Trial is Ending Soon</h1>
    <p>Hi ${params.name},</p>
    <p>Your <strong>7-day Pro trial</strong> ends in ${params.daysRemaining} days.</p>
    <p>After your trial ends, you'll be charged <strong>$29/month</strong> or <strong>$290/year</strong> depending on your selected plan.</p>
    <p>You can cancel anytime before the trial ends to avoid charges.</p>
    <a href="${process.env.NEXTAUTH_URL}/settings/billing">Manage Subscription</a>
  `;

  return sendEmail({
    to: params.to,
    subject: `Pro Trial Ending in ${params.daysRemaining} Days`,
    html,
  });
}

/**
 * ✅ Upgrade suggestion email
 */
export async function sendUpgradePromptEmail(params: {
  to: string;
  name: string;
  reason:
    | 'alert_limit'
    | 'symbol_limit'
    | 'timeframe_limit'
    | 'indicator_limit';
}) {
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

  const html = `
    <h1>Upgrade to Pro</h1>
    <p>Hi ${params.name},</p>
    <p>${reasons[params.reason]}. Upgrade to <strong>Pro</strong> for more!</p>
    
    <h3>Pro Plan Benefits:</h3>
    <ul>
      ${benefits[params.reason]}
      <li><strong>135 chart combinations</strong> (15 symbols × 9 timeframes)</li>
      <li><strong>5 watchlists</strong> with 50 items each</li>
      <li><strong>300 API requests/hour</strong> (vs 60 on Free)</li>
      <li><strong>7-day free trial</strong> to test all features</li>
    </ul>

    <p><strong>Only $29/month</strong> or save with <strong>$290/year</strong></p>
    
    <a href="${process.env.NEXTAUTH_URL}/pricing" style="display: inline-block; padding: 12px 30px; background: #00cc66; color: white; text-decoration: none; border-radius: 5px;">
      Start 7-Day Free Trial
    </a>
  `;

  return sendEmail({
    to: params.to,
    subject: 'Upgrade to Pro - 7-Day Free Trial',
    html,
  });
}
```

---

## 🎯 Task 3.2: Implement Email Verification

_(Implementation remains same as original, no tier-specific corrections needed)_

---

## 🎯 Task 3.3: Implement Password Reset Flow

_(Implementation remains same as original, no tier-specific corrections needed)_

---

## 🎯 Task 3.4-3.8: Additional Auth Features

**Task 3.4**: Real Session Tracking API
**Task 3.5**: Migrate Auth Forms to shadcn/ui
**Task 3.6**: Add Password Special Character Requirement
**Task 3.7**: Create Auth Integration Tests
**Task 3.8**: Update Auth Documentation

_(Implementations remain same as original)_

---

## ✅ Phase 3 Completion Checklist

### Email Templates ✅

- [ ] Verification email working
- [ ] Subscription confirmation mentions:
  - ✅ FREE: 5 symbols, 3 timeframes, 15 combinations
  - ✅ PRO: 15 symbols, 9 timeframes, 135 combinations
  - ✅ Pricing: $29/month or $290/year
  - ✅ 7-day trial for PRO
- [ ] Trial reminder (7 days)
- [ ] Upgrade prompt with correct limits
- [ ] No mention of BASIC tier

### Auth Flow ✅

- [ ] Email verification working
- [ ] Password reset functional
- [ ] Session tracking active
- [ ] shadcn/ui forms migrated

---
