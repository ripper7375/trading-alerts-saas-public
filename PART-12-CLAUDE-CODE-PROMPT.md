# Part 12: E-commerce & Billing - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 12 (E-commerce & Billing) autonomously
**Files to Build:** 11 files
**Estimated Time:** 5 hours
**Current Status:** Parts 6-11 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 12: E-commerce & Billing** for the Trading Alerts SaaS V7 project. You will build 11 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**

1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the pricing page and billing endpoints after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status (Parts 6-11 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**

```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3. **Part 12 Requirements & Build Order**

```
docs/build-orders/part-12-ecommerce.md               # Build order for all 11 files
docs/implementation-guides/v5_part_l.md              # E-commerce business logic
```

### 4. **OpenAPI Specifications**

```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 5. **Seed Code References (CRITICAL - Use these patterns)**

```
seed-code/v0-components/pricing-page-component-v3/app/pricing/page.tsx        # Pricing page
seed-code/v0-components/settings-page-with-tabs-v3/app/settings/page.tsx      # Settings with billing tab
```

### 6. **Validation & Testing**

```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7. **Previous Work (for context and dependencies)**

```
docs/build-orders/part-02-database.md                # Subscription model (DEPENDENCY)
docs/build-orders/part-04-tier-system.md             # Tier validation (DEPENDENCY)
```

---

## PART 12 - FILES TO BUILD (In Order)

Build these 11 files in sequence:

### **File 1/11:** `app/(marketing)/pricing/page.tsx`

- Pricing page with FREE vs PRO comparison
- Affiliate code support (?ref=CODE query param)
- Dynamic discount calculation
- Detailed feature comparison table
- FAQ section
- **Reference Seed Code:** `seed-code/v0-components/pricing-page-component-v3/app/pricing/page.tsx`
- **Commit:** `feat(pricing): add pricing page for 2-tier system`

### **File 2/11:** `app/api/subscription/route.ts`

- **GET:** Get user's current subscription
- **POST:** Create PRO subscription (upgrade)
- Return subscription status, tier, next billing date
- **Commit:** `feat(api): add subscription management endpoints`

### **File 3/11:** `app/api/subscription/cancel/route.ts`

- **POST:** Cancel subscription (downgrade to FREE)
- Update user tier in database
- Cancel Stripe subscription
- Send cancellation email
- **Commit:** `feat(api): add subscription cancellation`

### **File 4/11:** `app/api/checkout/route.ts`

- **POST:** Create Stripe checkout session
- PRO upgrade only ($29/month)
- Return checkout URL
- Validate user is not already PRO
- **Commit:** `feat(api): add Stripe checkout endpoint`

### **File 5/11:** `app/api/invoices/route.ts`

- **GET:** List user invoices from Stripe
- Return: date, amount, status, PDF URL
- Pagination support
- **Commit:** `feat(api): add invoices endpoint`

### **File 6/11:** `app/api/webhooks/stripe/route.ts`

- **POST:** Stripe webhook handler
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- Verify webhook signature
- Update user tier based on events
- **Commit:** `feat(api): add Stripe webhook handler`

### **File 7/11:** `components/billing/subscription-card.tsx`

- Current subscription display
- Show tier badge (FREE/PRO)
- Next billing date
- Upgrade/Cancel buttons
- Payment method display (last 4 digits)
- **Commit:** `feat(billing): add subscription card component`

### **File 8/11:** `components/billing/invoice-list.tsx`

- Invoice history table
- Columns: Date, Description, Amount, Status, Download
- Download links to Stripe PDF
- Payment status badges
- **Commit:** `feat(billing): add invoice list component`

### **File 9/11:** `lib/stripe/stripe.ts`

- Stripe client initialization
- Helper functions for checkout, subscriptions
- Environment variable validation
- **Commit:** `feat(stripe): add Stripe client`

### **File 10/11:** `lib/stripe/webhook-handlers.ts`

- Handler for each webhook event type
- Update user tier on subscription change
- Create notification records
- Error handling and logging
- **Commit:** `feat(stripe): add webhook handlers for 2-tier system`

### **File 11/11:** `lib/email/subscription-emails.ts`

- Upgrade confirmation email template
- Cancellation confirmation email template
- Payment failed email template
- Payment receipt email template
- **Commit:** `feat(email): add subscription email templates`

---

## GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/ecommerce-billing-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 11 files complete:
git push -u origin claude/ecommerce-billing-{SESSION_ID}
```

### **Commit Message Format**

Use conventional commits:

```
feat(pricing): add pricing page for 2-tier system
feat(api): add subscription management endpoints
feat(stripe): add Stripe client
fix(billing): correct TypeScript type error in invoice list
```

### **Push Requirements**

- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**

```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

### **Validation Must Pass Before Committing**

- 0 TypeScript errors
- 0 ESLint errors (warnings OK if < 3)
- All files properly formatted
- No unused imports
- All functions have return types

---

## KEY REQUIREMENTS FOR PART 12

### **1. 2-Tier Pricing Model**

**FREE Tier:**

- Price: $0/month (no payment required)
- 5 symbols, 3 timeframes, 5 alerts
- Basic support

**PRO Tier:**

- Price: $29/month
- 15 symbols, 9 timeframes, 20 alerts
- Priority support
- All advanced features

### **2. Stripe Integration**

**Environment Variables Required:**

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

**Checkout Flow:**

1. User clicks "Upgrade to PRO"
2. System creates Stripe Checkout session
3. User redirected to Stripe-hosted checkout
4. User completes payment
5. Stripe sends webhook
6. System updates user tier to PRO
7. User redirected to dashboard with success message

### **3. Webhook Events**

**checkout.session.completed:**

- Extract userId from metadata
- Update user tier to PRO
- Create Subscription record
- Send upgrade confirmation email

**customer.subscription.deleted:**

- Update user tier to FREE
- Mark subscription as cancelled
- Send cancellation email

**invoice.payment_failed:**

- Send payment failure email
- Keep PRO access for 3 days grace period

### **4. TypeScript Compliance (CRITICAL)**

- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use Stripe types from `stripe` package
- Use Prisma-generated types where applicable

### **5. Security Requirements**

- Verify webhook signature ALWAYS
- Never store raw credit card data
- Use environment variables for secrets
- Validate user authentication on all endpoints

---

## TESTING REQUIREMENTS

After building all 11 files:

### **1. Start Development Server**

```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**

- [ ] Visit `http://localhost:3000/pricing`
- [ ] Verify pricing page loads without errors
- [ ] Check FREE vs PRO comparison displays correctly
- [ ] Add `?ref=CODE` to URL and verify discount shows
- [ ] Click "Start 7-Day Trial" button
- [ ] Verify Stripe checkout redirects (use test mode)
- [ ] Test with Stripe test card: 4242424242424242
- [ ] Verify webhook handler receives events
- [ ] Check user tier updates after payment
- [ ] Test subscription cancellation flow
- [ ] Verify invoices endpoint returns data

### **3. API Testing**

```bash
# GET subscription
curl http://localhost:3000/api/subscription

# POST checkout
curl -X POST http://localhost:3000/api/subscription \
  -H "Content-Type: application/json"

# GET invoices
curl http://localhost:3000/api/invoices

# POST cancel subscription
curl -X POST http://localhost:3000/api/subscription/cancel
```

### **4. Stripe Test Cards**

```
# Successful payment
4242 4242 4242 4242

# Card declined
4000 0000 0000 0341

# 3D Secure required
4000 0025 0000 3155
```

### **5. Console Checks**

- [ ] No console errors
- [ ] No React hydration warnings
- [ ] API calls return correct status codes

### **6. TypeScript Build**

```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Stripe Client Initialization**

```typescript
// lib/stripe/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    line_items: [
      {
        price: STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      tier: 'PRO',
    },
  });

  return session;
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return subscription;
}

export async function getCustomerInvoices(
  customerId: string,
  limit: number = 12
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}
```

### **Pattern 2: Checkout API Route**

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createCheckoutSession } from '@/lib/stripe/stripe';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = session.user.tier || 'FREE';

    // Check if user is already PRO
    if (tier === 'PRO') {
      return NextResponse.json(
        {
          error: 'Already subscribed',
          message: 'You are already on the PRO tier',
          code: 'ALREADY_PRO',
        },
        { status: 400 }
      );
    }

    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard?upgrade=success`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/pricing?upgrade=cancelled`;

    const checkoutSession = await createCheckoutSession(
      session.user.id,
      session.user.email || '',
      successUrl,
      cancelUrl
    );

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

### **Pattern 3: Stripe Webhook Handler**

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe/stripe';
import {
  handleCheckoutCompleted,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  handleInvoiceFailed,
} from '@/lib/stripe/webhook-handlers';
import Stripe from 'stripe';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const headersList = headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
```

### **Pattern 4: Webhook Handlers**

```typescript
// lib/stripe/webhook-handlers.ts
import { prisma } from '@/lib/db/prisma';
import Stripe from 'stripe';
import {
  sendUpgradeEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
} from '@/lib/email/subscription-emails';

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Update user tier to PRO
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      tier: 'PRO',
    },
  });

  // Create subscription record
  await prisma.subscription.create({
    data: {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Send upgrade email
  if (user.email) {
    await sendUpgradeEmail(user.email, user.name || 'User');
  }

  console.log(`User ${userId} upgraded to PRO`);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  // Find user by subscription ID
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    include: { user: true },
  });

  if (!dbSubscription) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  // Update user tier to FREE
  await prisma.user.update({
    where: { id: dbSubscription.userId },
    data: { tier: 'FREE' },
  });

  // Update subscription status
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: { status: 'CANCELLED' },
  });

  // Send cancellation email
  if (dbSubscription.user.email) {
    await sendCancellationEmail(
      dbSubscription.user.email,
      dbSubscription.user.name || 'User'
    );
  }

  console.log(`User ${dbSubscription.userId} downgraded to FREE`);
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!dbSubscription) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  // Update subscription details
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // If subscription became inactive, downgrade user
  if (subscription.status !== 'active') {
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: { tier: 'FREE' },
    });
  }
}

export async function handleInvoiceFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  if (!invoice.customer) return;

  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
    include: { user: true },
  });

  if (!dbSubscription) {
    console.error('Subscription not found for customer:', invoice.customer);
    return;
  }

  // Send payment failed email
  if (dbSubscription.user.email) {
    await sendPaymentFailedEmail(
      dbSubscription.user.email,
      dbSubscription.user.name || 'User',
      'Payment method declined'
    );
  }

  console.log(`Payment failed for user ${dbSubscription.userId}`);
}
```

### **Pattern 5: Subscription Card Component**

```typescript
// components/billing/subscription-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface SubscriptionCardProps {
  subscription?: {
    status: string;
    currentPeriodEnd: string;
    paymentMethod?: {
      brand: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
    };
  };
  onUpgrade: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SubscriptionCard({
  subscription,
  onUpgrade,
  onCancel,
  isLoading = false,
}: SubscriptionCardProps) {
  const { tier } = useAuth();
  const isPro = tier === 'PRO';

  const tierConfig = {
    FREE: {
      label: 'FREE',
      color: 'bg-gray-100 text-gray-800',
      price: '$0/month',
    },
    PRO: {
      label: 'PRO',
      color: 'bg-blue-100 text-blue-800',
      price: '$29/month',
    },
  };

  const config = tierConfig[tier];

  return (
    <Card className={isPro ? 'border-2 border-blue-500' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Current Subscription</CardTitle>
          <Badge className={config.color}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Price</p>
          <p className="text-3xl font-bold">{config.price}</p>
        </div>

        {/* Features */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Includes</p>
          <ul className="space-y-1 text-sm">
            <li>{tier === 'FREE' ? '5 symbols' : '15 symbols'}</li>
            <li>{tier === 'FREE' ? '3 timeframes' : '9 timeframes'}</li>
            <li>{tier === 'FREE' ? '5 alerts' : '20 alerts'}</li>
          </ul>
        </div>

        {/* Billing Info (PRO only) */}
        {isPro && subscription && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Next billing:{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>

            {subscription.paymentMethod && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span>
                  {subscription.paymentMethod.brand} ending in{' '}
                  {subscription.paymentMethod.last4}
                </span>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {!isPro ? (
            <Button
              onClick={onUpgrade}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Upgrade to PRO
            </Button>
          ) : (
            <>
              <Button variant="outline" className="flex-1">
                Update Payment Method
              </Button>
              <Button
                variant="destructive"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel Subscription
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### **Pattern 6: Invoice List Component**

```typescript
// components/billing/invoice-list.tsx
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

export function InvoiceList({ invoices, isLoading = false }: InvoiceListProps) {
  const statusConfig = {
    paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
    open: { label: 'Open', color: 'bg-yellow-100 text-yellow-800' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No invoices yet. Your billing history will appear here after your first payment.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                {new Date(invoice.date).toLocaleDateString()}
              </TableCell>
              <TableCell>{invoice.description}</TableCell>
              <TableCell className="font-semibold">
                ${invoice.amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge className={statusConfig[invoice.status].color}>
                  {statusConfig[invoice.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a
                    href={invoice.invoicePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### **Pattern 7: Subscription Emails**

```typescript
// lib/email/subscription-emails.ts

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function getUpgradeEmailTemplate(name: string): EmailTemplate {
  return {
    subject: 'Welcome to Trading Alerts PRO!',
    html: `
      <h1>Welcome to Trading Alerts PRO!</h1>
      <p>Hi ${name},</p>
      <p>Your account has been successfully upgraded. You now have access to:</p>
      <ul>
        <li>15 trading symbols</li>
        <li>9 timeframes</li>
        <li>20 price alerts</li>
        <li>Priority support</li>
      </ul>
      <p>Your subscription: $29/month</p>
      <p>Happy trading!</p>
      <p>Trading Alerts Team</p>
    `,
    text: `Welcome to Trading Alerts PRO!

Hi ${name},

Your account has been successfully upgraded. You now have access to:
- 15 trading symbols
- 9 timeframes
- 20 price alerts
- Priority support

Your subscription: $29/month

Happy trading!
Trading Alerts Team`,
  };
}

export function getCancellationEmailTemplate(name: string): EmailTemplate {
  return {
    subject: 'Your PRO subscription has been cancelled',
    html: `
      <h1>Subscription Cancelled</h1>
      <p>Hi ${name},</p>
      <p>Your Trading Alerts PRO subscription has been cancelled.</p>
      <p>You now have FREE tier access:</p>
      <ul>
        <li>5 trading symbols</li>
        <li>3 timeframes</li>
        <li>5 price alerts</li>
      </ul>
      <p>You can upgrade again anytime at <a href="${process.env.NEXTAUTH_URL}/pricing">${process.env.NEXTAUTH_URL}/pricing</a></p>
      <p>Thank you for trying PRO!</p>
      <p>Trading Alerts Team</p>
    `,
    text: `Subscription Cancelled

Hi ${name},

Your Trading Alerts PRO subscription has been cancelled.

You now have FREE tier access:
- 5 trading symbols
- 3 timeframes
- 5 price alerts

You can upgrade again anytime at ${process.env.NEXTAUTH_URL}/pricing

Thank you for trying PRO!
Trading Alerts Team`,
  };
}

export function getPaymentFailedEmailTemplate(
  name: string,
  reason: string
): EmailTemplate {
  return {
    subject: 'Payment Failed - Action Required',
    html: `
      <h1>Payment Failed</h1>
      <p>Hi ${name},</p>
      <p>We couldn't process your payment for Trading Alerts PRO ($29/month).</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please update your payment method within 3 days to keep your PRO access:</p>
      <p><a href="${process.env.NEXTAUTH_URL}/settings?tab=billing">Update Payment Method</a></p>
      <p>If not resolved, your account will be downgraded to FREE tier.</p>
      <p>Need help? Reply to this email.</p>
      <p>Trading Alerts Team</p>
    `,
    text: `Payment Failed

Hi ${name},

We couldn't process your payment for Trading Alerts PRO ($29/month).

Reason: ${reason}

Please update your payment method within 3 days to keep your PRO access:
${process.env.NEXTAUTH_URL}/settings?tab=billing

If not resolved, your account will be downgraded to FREE tier.

Need help? Reply to this email.

Trading Alerts Team`,
  };
}

export function getPaymentReceiptEmailTemplate(
  name: string,
  amount: number,
  nextBillingDate: Date
): EmailTemplate {
  return {
    subject: 'Payment Receipt - Trading Alerts PRO',
    html: `
      <h1>Payment Receipt</h1>
      <p>Hi ${name},</p>
      <p>Your payment was successful!</p>
      <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Next billing date:</strong> ${nextBillingDate.toLocaleDateString()}</p>
      <p>Thank you for being a PRO member!</p>
      <p>Trading Alerts Team</p>
    `,
    text: `Payment Receipt

Hi ${name},

Your payment was successful!

Amount: $${amount.toFixed(2)}
Date: ${new Date().toLocaleDateString()}
Next billing date: ${nextBillingDate.toLocaleDateString()}

Thank you for being a PRO member!

Trading Alerts Team`,
  };
}

// Email sending functions (use your email provider)
export async function sendUpgradeEmail(
  email: string,
  name: string
): Promise<void> {
  const template = getUpgradeEmailTemplate(name);
  // TODO: Implement actual email sending with your provider (SendGrid, Resend, etc.)
  console.log(`[Email] Sending upgrade email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);
}

export async function sendCancellationEmail(
  email: string,
  name: string
): Promise<void> {
  const template = getCancellationEmailTemplate(name);
  console.log(`[Email] Sending cancellation email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);
}

export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  reason: string
): Promise<void> {
  const template = getPaymentFailedEmailTemplate(name, reason);
  console.log(`[Email] Sending payment failed email to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);
}

export async function sendPaymentReceiptEmail(
  email: string,
  name: string,
  amount: number,
  nextBillingDate: Date
): Promise<void> {
  const template = getPaymentReceiptEmailTemplate(
    name,
    amount,
    nextBillingDate
  );
  console.log(`[Email] Sending payment receipt to ${email}`);
  console.log(`[Email] Subject: ${template.subject}`);
}
```

---

## CRITICAL RULES

### **DO:**

- Read ALL policy files before writing code
- Use Stripe SDK properly with TypeScript types
- Verify webhook signatures ALWAYS
- Handle all webhook event types
- Use environment variables for secrets
- Implement proper error handling
- Validate user authentication on all endpoints
- Reference seed code for component patterns
- Validate after each file
- Commit each file individually
- Use shadcn/ui components consistently
- Test thoroughly before pushing

### **DON'T:**

- Skip reading policy files
- Use `any` types
- Store raw credit card data
- Skip webhook signature verification
- Hardcode secrets or API keys
- Skip ownership validation in API routes
- Commit multiple files at once (commit one-by-one)
- Push without validation passing
- Push to main branch directly (use feature branch)
- Skip testing

---

## SUCCESS CRITERIA

Part 12 is complete when:

- All 11 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Pricing page loads at `/pricing` without errors
- Stripe checkout flow works (test mode)
- Webhook handler processes events correctly
- User tier updates on subscription changes
- Invoices endpoint returns data
- Subscription card displays correctly
- Cancel subscription works
- Email templates are complete
- All API endpoints work (GET, POST)
- All manual tests pass
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/11: app/(marketing)/pricing/page.tsx
3. Build File 2/11: app/api/subscription/route.ts
4. Build File 3/11: app/api/subscription/cancel/route.ts
5. Build File 4/11: app/api/checkout/route.ts
6. Build File 5/11: app/api/invoices/route.ts
7. Build File 6/11: app/api/webhooks/stripe/route.ts
8. Build File 7/11: components/billing/subscription-card.tsx
9. Build File 8/11: components/billing/invoice-list.tsx
10. Build File 9/11: lib/stripe/stripe.ts
11. Build File 10/11: lib/stripe/webhook-handlers.ts
12. Build File 11/11: lib/email/subscription-emails.ts
13. Run full validation suite
14. Test pricing and billing manually
15. Push to feature branch
16. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-12-ecommerce.md` - Understand Part 12
   - `docs/implementation-guides/v5_part_l.md` - E-commerce business logic
   - Seed code files for component patterns

2. **Then, create your git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/ecommerce-billing-{SESSION_ID}
   ```

3. **Start building File 1/11:**
   - Read the build order for File 1
   - Reference seed code
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(pricing): add pricing page for 2-tier system"`

4. **Repeat for Files 2-11**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements (can't determine correct approach)
- Missing dependencies or seed code
- Validation errors you can't resolve
- Database schema questions
- Stripe integration questions
- Webhook signature verification issues
- Environment variable configuration issues

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 12 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**
