# Phase 5: Billing & Integrations

**Sequential Execution Plan: Phase 5 of 6**
**Total Tasks**: 7
**Estimated Duration**: 6-8 hours
**Priority**: 🟢 FEATURE - Payment processing and notifications

---

## 🎯 Task 5.1: Stripe Webhook Email Integration

**Priority**: HIGH | **Time**: 2 hours

#### Email Templates with CORRECT Pricing & Features

```typescript
// In lib/email.ts

export async function sendSubscriptionConfirmationEmail(params: {
  to: string;
  name: string;
  plan: 'FREE' | 'PRO'; // ✅ Only 2 tiers
  amount: number;
  billingPeriod: 'monthly' | 'yearly';
}) {
  const { to, name, plan, amount, billingPeriod } = params;

  // ✅ CORRECT pricing display
  const priceDisplay =
    plan === 'PRO'
      ? billingPeriod === 'monthly'
        ? '$29/month'
        : '$290/year (save $58!)'
      : 'Free Forever';

  // ✅ CORRECT tier features
  const features =
    plan === 'PRO'
      ? `
    <h3>Your Pro Plan Includes:</h3>
    <ul style="line-height: 1.8;">
      <li><strong>15 Symbols</strong> - All forex majors & crosses, crypto (BTCUSD, ETHUSD), indices (US30, NDX100), commodities (Gold, Silver)</li>
      <li><strong>9 Timeframes</strong> - M5, M15, M30, H1, H2, H4, H8, H12, D1</li>
      <li><strong>135 Chart Combinations</strong> - Maximum flexibility (15 × 9)</li>
      <li><strong>20 Trading Alerts</strong> - Set more price alerts and notifications</li>
      <li><strong>5 Watchlists</strong> - Organize up to 50 symbols per watchlist</li>
      <li><strong>8 Technical Indicators</strong>:
        <ul>
          <li>Basic: Fractals, Trendlines</li>
          <li>Pro: Momentum Candles, Keltner Channels, TEMA, HRMA, SMMA, ZigZag</li>
        </ul>
      </li>
      <li><strong>300 API Requests/Hour</strong> - 5x more than Free tier</li>
      <li><strong>Advanced Features</strong> - Data export, priority support</li>
    </ul>
    ${billingPeriod === 'monthly' ? '<p><em>Consider switching to yearly billing to save $58!</em></p>' : ''}
  `
      : `
    <h3>Your Free Plan Includes:</h3>
    <ul style="line-height: 1.8;">
      <li><strong>5 Symbols</strong> - BTCUSD, EURUSD, USDJPY, US30, XAUUSD</li>
      <li><strong>3 Timeframes</strong> - H1, H4, D1</li>
      <li><strong>15 Chart Combinations</strong> - Good for getting started (5 × 3)</li>
      <li><strong>5 Trading Alerts</strong> - Essential price notifications</li>
      <li><strong>1 Watchlist</strong> - Track up to 5 symbols</li>
      <li><strong>2 Basic Indicators</strong> - Fractals and Trendlines</li>
      <li><strong>60 API Requests/Hour</strong> - Perfect for personal use</li>
    </ul>
    <p><strong>Ready for more?</strong> <a href="${process.env.NEXTAUTH_URL}/pricing">Upgrade to Pro</a> for 15 symbols, 9 timeframes, and 8 indicators. Start with a 7-day free trial!</p>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { padding: 30px; background: #f9f9f9; }
          .price-box { background: white; padding: 20px; border-left: 4px solid #0066cc; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          ul { padding-left: 20px; }
          li { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your <strong>${plan}</strong> subscription is now active.</p>
            
            <div class="price-box">
              <p style="margin: 0;"><strong>Plan:</strong> ${plan}</p>
              <p style="margin: 5px 0;"><strong>Price:</strong> ${priceDisplay}</p>
              ${plan === 'PRO' ? '<p style="margin: 5px 0;"><strong>Trial:</strong> 7-day free trial included</p>' : ''}
            </div>

            ${features}
            
            <p style="margin-top: 30px;">Thank you for choosing Trading Alerts SaaS!</p>
            <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Go to Dashboard</a>
          </div>
        </div>
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
 * ✅ Payment receipt with correct pricing
 */
export async function sendPaymentReceiptEmail(params: {
  to: string;
  name: string;
  amount: number;
  invoiceUrl: string;
  plan: 'FREE' | 'PRO';
  billingPeriod: 'monthly' | 'yearly';
}) {
  const { to, name, amount, invoiceUrl, plan, billingPeriod } = params;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0066cc;">Payment Received</h1>
          <p>Hi ${name},</p>
          <p>Thank you for your payment!</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Plan:</strong> ${plan}</p>
            <p><strong>Billing Period:</strong> ${billingPeriod === 'monthly' ? 'Monthly ($29)' : 'Yearly ($290)'}</p>
            <p><strong>Amount:</strong> $${(amount / 100).toFixed(2)}</p>
            <p><strong>Status:</strong> Paid</p>
          </div>

          <p><a href="${invoiceUrl}" style="color: #0066cc;">View Invoice</a></p>
          
          <p>Your ${plan} plan is active and ready to use.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Payment Receipt - Trading Alerts SaaS',
    html,
  });
}

/**
 * ✅ Subscription canceled email
 */
export async function sendSubscriptionCanceledEmail(params: {
  to: string;
  name: string;
  plan: 'FREE' | 'PRO';
  cancelAt: Date;
}) {
  const { to, name, plan, cancelAt } = params;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #cc0000;">Subscription Canceled</h1>
          <p>Hi ${name},</p>
          <p>Your <strong>${plan}</strong> subscription has been canceled.</p>
          
          <div style="background: #fff3cd; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p><strong>Access Until:</strong> ${new Date(cancelAt).toLocaleDateString()}</p>
            <p>You'll continue to have ${plan} access until ${new Date(cancelAt).toLocaleDateString()}.</p>
          </div>

          <p>After that, your account will revert to the <strong>Free</strong> plan with:</p>
          <ul>
            <li>5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)</li>
            <li>3 timeframes (H1, H4, D1)</li>
            <li>5 alerts</li>
            <li>2 basic indicators</li>
          </ul>

          <p>Changed your mind? <a href="${process.env.NEXTAUTH_URL}/settings/billing" style="color: #0066cc;">Reactivate your subscription</a></p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Subscription Canceled',
    html,
  });
}
```

---

## 🎯 Task 5.2: Apply to Stripe Webhooks

```typescript
// In app/api/webhooks/stripe/route.ts

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);

      // ✅ Determine plan and billing period
      const priceId = subscription.items.data[0].price.id;
      const plan =
        subscription.status === 'trialing' ||
        subscription.items.data[0].price.unit_amount > 0
          ? 'PRO'
          : 'FREE';
      const billingPeriod =
        subscription.items.data[0].price.recurring?.interval === 'year'
          ? 'yearly'
          : 'monthly';

      await sendSubscriptionConfirmationEmail({
        to: customer.email,
        name: customer.name || 'User',
        plan,
        amount: subscription.items.data[0].price.unit_amount,
        billingPeriod,
      });
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      const invoiceCustomer = await stripe.customers.retrieve(invoice.customer);

      // ✅ Only send receipt for successful payments > $0
      if (invoice.amount_paid > 0) {
        const invoiceSub = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        const invoicePlan = invoice.amount_paid >= 2900 ? 'PRO' : 'FREE';
        const invoiceBillingPeriod =
          invoice.amount_paid === 29000 ? 'yearly' : 'monthly';

        await sendPaymentReceiptEmail({
          to: invoiceCustomer.email,
          name: invoiceCustomer.name || 'User',
          amount: invoice.amount_paid,
          invoiceUrl: invoice.hosted_invoice_url,
          plan: invoicePlan,
          billingPeriod: invoiceBillingPeriod,
        });
      }
      break;

    case 'customer.subscription.deleted':
      const canceledSub = event.data.object;
      const canceledCustomer = await stripe.customers.retrieve(
        canceledSub.customer
      );

      await sendSubscriptionCanceledEmail({
        to: canceledCustomer.email,
        name: canceledCustomer.name || 'User',
        plan: 'PRO', // Only PRO can be canceled
        cancelAt: new Date(canceledSub.cancel_at * 1000),
      });
      break;
  }

  return NextResponse.json({ received: true });
}
```

---

## 🎯 Task 5.3-5.7: Additional Tasks

**Task 5.3**: Affiliate Commission Emails (20% commission)
**Task 5.4**: Cron Job for Pending Disbursements
**Task 5.5**: Admin Disbursement Features
**Task 5.6**: Subscription Renewal Reminder (before billing)
**Task 5.7**: Failed Payment Email

_(Implementations similar to original, with correct pricing)_

---

## ✅ Phase 5 Completion Checklist

### Email System ✅

- [ ] Subscription confirmation with:
  - ✅ FREE: 5 symbols, 3 timeframes, 2 indicators
  - ✅ PRO: 15 symbols, 9 timeframes, 8 indicators
  - ✅ Pricing: $29/month or $290/year
  - ✅ 7-day trial mentioned
- [ ] Payment receipts sent
- [ ] Cancellation emails sent
- [ ] Only FREE and PRO tiers mentioned

### Integrations ✅

- [ ] Stripe webhooks working
- [ ] Affiliate commissions (20%)
- [ ] Cron jobs scheduled
- [ ] Admin features complete

---
