# Part 18: dLocal Payment Integration (Emerging Markets)

## Overview

**Part 18** adds dLocal payment processing alongside Stripe, enabling users from emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) to subscribe to PRO plans using local payment methods (UPI, Paytm, JazzCash, GoPay, etc.) without international credit cards.

**Why this exists:** Stripe requires international credit/debit cards. Many users in emerging markets don't have these cards, preventing them from accessing PRO features. dLocal bridges this gap by supporting local payment methods popular in each country.

---

## Key Business Rules (CRITICAL)

### dLocal vs Stripe Differences

| Feature               | Stripe                 | dLocal                             |
| --------------------- | ---------------------- | ---------------------------------- |
| Auto-Renewal          | ✅ Yes                 | ❌ NO - Manual renewal required    |
| Free Trial            | ✅ 7 days              | ❌ NO trial period                 |
| Plans                 | Monthly only           | **3-day** + Monthly                |
| Discount Codes        | ✅ All plans           | ❌ Monthly ONLY (not 3-day)        |
| Renewal Notifications | Stripe manages         | **We send** 3 days before expiry   |
| Expiry Handling       | Stripe auto-downgrades | **We downgrade** manually via cron |

**CRITICAL:** Never apply Stripe auto-renewal logic to dLocal subscriptions!

---

## Supported Countries & Payment Methods

### Countries (8 total)

```typescript
const DLOCAL_COUNTRIES = {
  IN: {
    name: 'India',
    currency: 'INR',
    methods: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  },
  NG: {
    name: 'Nigeria',
    currency: 'NGN',
    methods: ['Bank Transfer', 'USSD', 'Paystack', 'Verve'],
  },
  PK: { name: 'Pakistan', currency: 'PKR', methods: ['JazzCash', 'Easypaisa'] },
  VN: {
    name: 'Vietnam',
    currency: 'VND',
    methods: ['VNPay', 'MoMo', 'ZaloPay'],
  },
  ID: {
    name: 'Indonesia',
    currency: 'IDR',
    methods: ['GoPay', 'OVO', 'Dana', 'ShopeePay'],
  },
  TH: {
    name: 'Thailand',
    currency: 'THB',
    methods: ['TrueMoney', 'Rabbit LINE Pay', 'Thai QR'],
  },
  ZA: {
    name: 'South Africa',
    currency: 'ZAR',
    methods: ['Instant EFT', 'EFT'],
  },
  TR: {
    name: 'Turkey',
    currency: 'TRY',
    methods: ['Bank Transfer', 'Local Cards'],
  },
} as const;
```

### Pricing

```typescript
const DLOCAL_PRICING = {
  THREE_DAY: {
    usd: 1.99,
    duration: 3,
    discountAllowed: false, // ❌ NO discount codes
  },
  MONTHLY: {
    usd: 29.0,
    duration: 30,
    discountAllowed: true, // ✅ Discount codes allowed
  },
} as const;
```

---

## Files to Create (Total: ~45 files)

### 1. Database Schema (Prisma)

**File:** `prisma/schema.prisma` (UPDATE EXISTING)

```prisma
// ADD these fields to existing User model
model User {
  // ... existing fields ...

  // NEW: 3-day plan anti-abuse tracking
  hasUsedThreeDayPlan   Boolean   @default(false)
  threeDayPlanUsedAt    DateTime?

  // NEW: Fraud detection
  lastLoginIP           String?
  deviceFingerprint     String?

  // ... rest of existing fields ...
}

// ADD these fields to existing Subscription model
model Subscription {
  // ... existing fields ...

  // NEW: Payment provider field
  paymentProvider       PaymentProvider  @default(STRIPE)

  // NEW: dLocal-specific fields
  dlocalPaymentId       String?
  dlocalPaymentMethod   String?
  dlocalCountry         String?
  dlocalCurrency        String?

  // NEW: Plan type field
  planType              PlanType         @default(MONTHLY)

  // NEW: Amount tracking (local currency + USD)
  amount                Decimal
  amountUSD             Decimal
  currency              String

  // NEW: Manual renewal tracking
  expiresAt             DateTime?
  renewalReminderSent   Boolean          @default(false)

  // ... rest of existing fields ...
}

// NEW: Payment transaction log
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])

  // Provider info
  provider              PaymentProvider
  providerPaymentId     String
  providerStatus        String

  // Payment details
  amount                Decimal
  amountUSD             Decimal
  currency              String
  exchangeRate          Decimal?        // NEW: For audit trail
  country               String
  paymentMethod         String

  // Plan details
  planType              PlanType
  duration              Int

  // Discount details
  discountCode          String?
  discountAmount        Decimal?

  // Status
  status                PaymentStatus
  failureReason         String?

  // NEW: Anti-abuse tracking (for 3-day plan)
  paymentMethodHash     String?         // SHA256(email + payment_method_id)
  purchaseIP            String?
  deviceFingerprint     String?
  accountAgeAtPurchase  Int?            // Account age in hours

  // Timestamps
  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  failedAt              DateTime?

  // Metadata
  metadata              Json?

  @@index([userId])
  @@index([provider, providerPaymentId])
  @@index([status])
  @@index([planType])               // NEW: For 3-day plan queries
  @@index([paymentMethodHash])      // NEW: For abuse detection
}

// NEW: Fraud monitoring
model FraudAlert {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])

  // Alert details
  pattern               String   // 'MULTIPLE_ACCOUNTS_SAME_IP', 'SAME_PAYMENT_METHOD', etc.
  metadata              Json     // Stores detection details
  severity              String   // 'LOW' | 'MEDIUM' | 'HIGH'

  // Review tracking
  status                String   @default("PENDING_REVIEW")  // 'PENDING_REVIEW' | 'CONFIRMED' | 'FALSE_POSITIVE'
  reviewedAt            DateTime?
  reviewedBy            String?
  reviewNotes           String?

  // Timestamps
  createdAt             DateTime @default(now())

  @@index([userId])
  @@index([status])
  @@index([severity])
  @@index([createdAt])
}

// NEW: Enums
enum PaymentProvider {
  STRIPE
  DLOCAL
}

enum PlanType {
  THREE_DAY
  MONTHLY
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED     // NEW - for dLocal
  CANCELLED
  PAYMENT_FAILED
  PENDING     // NEW - awaiting payment
}
```

**Migration Command:**

```bash
npx prisma migrate dev --name add_dlocal_support
```

---

### 2. Type Definitions

**File:** `types/dlocal.ts` (NEW)

```typescript
export type DLocalCountry =
  | 'IN'
  | 'NG'
  | 'PK'
  | 'VN'
  | 'ID'
  | 'TH'
  | 'ZA'
  | 'TR';
export type DLocalCurrency =
  | 'INR'
  | 'NGN'
  | 'PKR'
  | 'VND'
  | 'IDR'
  | 'THB'
  | 'ZAR'
  | 'TRY';
export type PlanType = 'THREE_DAY' | 'MONTHLY';
export type PaymentProvider = 'STRIPE' | 'DLOCAL';
export type PaymentMethodType =
  | 'WALLET'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'USSD'
  | 'TICKET';
export type PaymentFlow = 'REDIRECT' | 'DIRECT';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  flow: PaymentFlow;
  provider: PaymentProvider;
  icon?: string;
  description?: string;
  processingTime?: string;
  recommended?: boolean;
  popular?: boolean;
}

export interface DLocalPaymentRequest {
  amount: number;
  currency: DLocalCurrency;
  country: DLocalCountry;
  payment_method_id: string;
  payer: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  order_id: string;
  description: string;
  notification_url: string;
  callback_url: string;
}

export interface DLocalPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';
  payment_method_id: string;
  payment_method_type: string;
  payment_method_flow: PaymentFlow;
  redirect_url?: string;
  qr_code?: string;
  created_date: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
}

export interface CurrencyConversion {
  amountUSD: number;
  amountLocal: number;
  currency: string;
  exchangeRate: number;
}
```

---

### 3. Constants & Configuration

**File:** `lib/dlocal/constants.ts` (NEW)

```typescript
import { DLocalCountry, DLocalCurrency } from '@/types/dlocal';

export const DLOCAL_SUPPORTED_COUNTRIES: Record<
  DLocalCountry,
  {
    name: string;
    currency: DLocalCurrency;
    locale: string;
  }
> = {
  IN: { name: 'India', currency: 'INR', locale: 'en-IN' },
  NG: { name: 'Nigeria', currency: 'NGN', locale: 'en-NG' },
  PK: { name: 'Pakistan', currency: 'PKR', locale: 'en-PK' },
  VN: { name: 'Vietnam', currency: 'VND', locale: 'vi-VN' },
  ID: { name: 'Indonesia', currency: 'IDR', locale: 'id-ID' },
  TH: { name: 'Thailand', currency: 'THB', locale: 'th-TH' },
  ZA: { name: 'South Africa', currency: 'ZAR', locale: 'en-ZA' },
  TR: { name: 'Turkey', currency: 'TRY', locale: 'tr-TR' },
} as const;

export const DLOCAL_PRICING = {
  THREE_DAY: {
    usd: 1.99,
    duration: 3,
    discountAllowed: false,
  },
  MONTHLY: {
    usd: 29.0,
    duration: 30,
    discountAllowed: true,
  },
} as const;

export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
  'USD-INR': 83,
  'USD-NGN': 1500,
  'USD-PKR': 278,
  'USD-VND': 24000,
  'USD-IDR': 15500,
  'USD-THB': 35,
  'USD-ZAR': 18,
  'USD-TRY': 34,
} as const;

export function isDLocalCountry(code: string): code is DLocalCountry {
  return code in DLOCAL_SUPPORTED_COUNTRIES;
}

export function canApplyDiscountCode(
  planType: PlanType,
  provider: PaymentProvider
): boolean {
  if (provider === 'STRIPE') return true;
  if (provider === 'DLOCAL' && planType === 'MONTHLY') return true;
  return false;
}
```

---

### 4. Services

#### 4.1 Currency Converter Service

**File:** `lib/dlocal/currency-converter.service.ts` (NEW)

```typescript
import {
  DLocalCurrency,
  ExchangeRate,
  CurrencyConversion,
} from '@/types/dlocal';
import { FALLBACK_EXCHANGE_RATES } from './constants';

class CurrencyConverterService {
  private cache = new Map<string, { rate: number; expires: number }>();
  private CACHE_DURATION = 3600000; // 1 hour

  async convertUSDToLocal(
    amountUSD: number,
    targetCurrency: DLocalCurrency
  ): Promise<CurrencyConversion> {
    const rate = await this.getExchangeRate('USD', targetCurrency);
    const amountLocal = Math.round(amountUSD * rate);

    return {
      amountUSD,
      amountLocal,
      currency: targetCurrency,
      exchangeRate: rate,
    };
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    const cacheKey = `${from}-${to}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expires) {
      return cached.rate;
    }

    try {
      const response = await fetch(
        `${process.env.DLOCAL_API_URL}/exchange-rates?from=${from}&to=${to}`,
        {
          headers: this.getDLocalHeaders(),
        }
      );

      const data: ExchangeRate = await response.json();

      this.cache.set(cacheKey, {
        rate: data.rate,
        expires: Date.now() + this.CACHE_DURATION,
      });

      return data.rate;
    } catch (error) {
      console.error('Exchange rate fetch failed:', error);
      return this.getFallbackRate(from, to);
    }
  }

  private getFallbackRate(from: string, to: string): number {
    return FALLBACK_EXCHANGE_RATES[`${from}-${to}`] || 1;
  }

  private getDLocalHeaders() {
    return {
      'X-Date': new Date().toISOString(),
      'X-Login': process.env.DLOCAL_API_LOGIN!,
      'X-Trans-Key': process.env.DLOCAL_API_KEY!,
      'X-Version': '2.1',
    };
  }

  formatCurrency(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

export const currencyConverter = new CurrencyConverterService();
```

#### 4.2 Payment Methods Service

**File:** `lib/dlocal/payment-methods.service.ts` (NEW)

```typescript
import { PaymentMethod, DLocalCountry } from '@/types/dlocal';
import { DLOCAL_SUPPORTED_COUNTRIES, isDLocalCountry } from './constants';

class PaymentMethodsService {
  private cache = new Map<string, PaymentMethod[]>();

  async getMethodsForCountry(country: string): Promise<PaymentMethod[]> {
    if (this.cache.has(country)) {
      return this.cache.get(country)!;
    }

    const methods: PaymentMethod[] = [];

    try {
      // Fetch dLocal methods if country is supported
      if (isDLocalCountry(country)) {
        const dlocalMethods = await this.fetchDLocalMethods(country);
        methods.push(...dlocalMethods);
      }
    } catch (error) {
      console.error('dLocal API failed, falling back to Stripe:', error);
    }

    // Always add Stripe card option as fallback
    methods.push({
      id: 'card',
      name: 'Credit/Debit Card',
      type: 'CARD',
      flow: 'DIRECT',
      provider: 'stripe',
      icon: '💳',
      description: 'Visa, Mastercard, Amex',
      processingTime: 'Instant',
      recommended: !isDLocalCountry(country),
    });

    this.cache.set(country, methods);
    return methods;
  }

  private async fetchDLocalMethods(
    country: DLocalCountry
  ): Promise<PaymentMethod[]> {
    try {
      const response = await fetch(
        `${process.env.DLOCAL_API_URL}/payment-methods?country=${country}`,
        {
          headers: this.getDLocalHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`dLocal API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((method: any) => ({
        ...method,
        provider: 'dlocal' as const,
      }));
    } catch (error) {
      console.error('Failed to fetch dLocal methods:', error);
      return [];
    }
  }

  private getDLocalHeaders() {
    return {
      'X-Date': new Date().toISOString(),
      'X-Login': process.env.DLOCAL_API_LOGIN!,
      'X-Trans-Key': process.env.DLOCAL_API_KEY!,
      'X-Version': '2.1',
    };
  }
}

export const paymentMethodsService = new PaymentMethodsService();
```

#### 4.3 dLocal Payment Service

**File:** `lib/dlocal/dlocal-payment.service.ts` (NEW)

```typescript
import crypto from 'crypto';
import { DLocalPaymentRequest, DLocalPaymentResponse } from '@/types/dlocal';

class DLocalPaymentService {
  async createPayment(
    request: DLocalPaymentRequest
  ): Promise<DLocalPaymentResponse> {
    try {
      const response = await fetch(`${process.env.DLOCAL_API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Date': new Date().toISOString(),
          'X-Login': process.env.DLOCAL_API_LOGIN!,
          'X-Trans-Key': process.env.DLOCAL_API_KEY!,
          'X-Version': '2.1',
          Authorization: this.generateSignature(request),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`dLocal payment failed: ${error.message}`);
      }

      const data: DLocalPaymentResponse = await response.json();
      return data;
    } catch (error) {
      console.error('dLocal payment creation failed:', error);
      throw error;
    }
  }

  private generateSignature(request: any): string {
    const payload = JSON.stringify(request);
    const signature = crypto
      .createHmac('sha256', process.env.DLOCAL_API_SECRET!)
      .update(payload)
      .digest('hex');

    return `V2-HMAC-SHA256, Signature: ${signature}`;
  }

  verifyWebhookSignature(body: any, signature: string | null): boolean {
    if (!signature) return false;

    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

export const dlocalPaymentService = new DLocalPaymentService();
```

#### 4.4 Three-Day Plan Validator Service (ANTI-ABUSE)

**File:** `lib/dlocal/three-day-validator.service.ts` (NEW)

```typescript
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

interface ThreeDayValidationResult {
  allowed: boolean;
  reason?: string;
  usedAt?: Date;
}

interface AbuseCheckResult {
  isAbuse: boolean;
  pattern?: string;
  metadata?: Record<string, any>;
}

class ThreeDayValidatorService {
  /**
   * PRIMARY DEFENSE: Check if user has already used 3-day plan
   */
  async canPurchaseThreeDayPlan(
    userId: string
  ): Promise<ThreeDayValidationResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasUsedThreeDayPlan: true,
        threeDayPlanUsedAt: true,
      },
    });

    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    if (user.hasUsedThreeDayPlan) {
      return {
        allowed: false,
        reason:
          '3-day plan is a one-time introductory offer. Please select monthly plan.',
        usedAt: user.threeDayPlanUsedAt || undefined,
      };
    }

    return { allowed: true };
  }

  /**
   * SECONDARY DEFENSE: Detect multi-account abuse via payment method
   */
  async detectMultiAccountAbuse(
    email: string,
    paymentMethodId: string
  ): Promise<AbuseCheckResult> {
    const hash = this.createPaymentMethodHash(email, paymentMethodId);

    const existingPurchase = await prisma.payment.findFirst({
      where: {
        planType: 'THREE_DAY',
        paymentMethodHash: hash,
        status: 'COMPLETED',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (existingPurchase && existingPurchase.user.email !== email) {
      return {
        isAbuse: true,
        pattern: 'SAME_PAYMENT_METHOD_DIFFERENT_EMAIL',
        metadata: {
          previousEmail: existingPurchase.user.email,
          previousPurchaseDate: existingPurchase.completedAt,
        },
      };
    }

    return { isAbuse: false };
  }

  /**
   * TERTIARY DEFENSE: Detect suspicious patterns
   */
  async detectSuspiciousPatterns(
    userId: string,
    purchaseIP: string,
    deviceFingerprint?: string
  ): Promise<AbuseCheckResult[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        email: true,
      },
    });

    if (!user) {
      return [];
    }

    const patterns: AbuseCheckResult[] = [];

    // Pattern 1: Account created very recently (< 1 hour)
    const accountAge = Date.now() - user.createdAt.getTime();
    const accountAgeHours = accountAge / (1000 * 60 * 60);

    if (accountAgeHours < 1) {
      patterns.push({
        isAbuse: true,
        pattern: 'FRESH_ACCOUNT_PURCHASE',
        metadata: {
          accountAgeMinutes: Math.floor(accountAge / (1000 * 60)),
          email: user.email,
        },
      });
    }

    // Pattern 2: Multiple 3-day purchases from same IP within 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPurchasesFromIP = await prisma.payment.count({
      where: {
        planType: 'THREE_DAY',
        purchaseIP: purchaseIP,
        status: 'COMPLETED',
        completedAt: {
          gte: thirtyDaysAgo,
        },
        userId: {
          not: userId,
        },
      },
    });

    if (recentPurchasesFromIP >= 2) {
      patterns.push({
        isAbuse: true,
        pattern: 'MULTIPLE_ACCOUNTS_SAME_IP',
        metadata: {
          ip: purchaseIP,
          count: recentPurchasesFromIP + 1,
          window: '30 days',
        },
      });
    }

    // Pattern 3: Same device fingerprint (if provided)
    if (deviceFingerprint) {
      const sameDevicePurchases = await prisma.payment.count({
        where: {
          planType: 'THREE_DAY',
          deviceFingerprint: deviceFingerprint,
          status: 'COMPLETED',
          completedAt: {
            gte: thirtyDaysAgo,
          },
          userId: {
            not: userId,
          },
        },
      });

      if (sameDevicePurchases >= 2) {
        patterns.push({
          isAbuse: true,
          pattern: 'MULTIPLE_ACCOUNTS_SAME_DEVICE',
          metadata: {
            deviceFingerprint,
            count: sameDevicePurchases + 1,
            window: '30 days',
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Log fraud alert for manual review
   */
  async logFraudAlert(
    userId: string,
    pattern: string,
    metadata: Record<string, any>,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<void> {
    await prisma.fraudAlert.create({
      data: {
        userId,
        pattern,
        metadata,
        severity,
        status: 'PENDING_REVIEW',
      },
    });

    // Send email notification for HIGH severity
    if (severity === 'HIGH') {
      await this.notifyAdminOfFraud(userId, pattern, metadata);
    }
  }

  /**
   * Mark user as having used 3-day plan
   */
  async markThreeDayPlanUsed(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasUsedThreeDayPlan: true,
        threeDayPlanUsedAt: new Date(),
      },
    });
  }

  /**
   * Create hash for payment method tracking
   */
  createPaymentMethodHash(email: string, paymentMethodId: string): string {
    return createHash('sha256')
      .update(`${email}:${paymentMethodId}`)
      .digest('hex');
  }

  /**
   * Get account age at time of purchase
   */
  async getAccountAge(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) return 0;

    const ageMs = Date.now() - user.createdAt.getTime();
    return Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Send admin notification for high-severity fraud
   */
  private async notifyAdminOfFraud(
    userId: string,
    pattern: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // TODO: Implement email notification to admin
    console.error('HIGH SEVERITY FRAUD ALERT:', {
      userId,
      pattern,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}

export const threeDayValidator = new ThreeDayValidatorService();
```

---

### 5. API Routes

#### 5.1 Get Payment Methods

**File:** `app/api/payments/dlocal/methods/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { paymentMethodsService } from '@/lib/dlocal/payment-methods.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country');

    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    const methods = await paymentMethodsService.getMethodsForCountry(country);

    return NextResponse.json(methods);
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}
```

#### 5.2 Get Exchange Rate

**File:** `app/api/payments/dlocal/exchange-rate/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { currencyConverter } from '@/lib/dlocal/currency-converter.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const to = searchParams.get('to');

    if (!to) {
      return NextResponse.json(
        { error: 'Currency parameter is required' },
        { status: 400 }
      );
    }

    const rate = await currencyConverter.getExchangeRate('USD', to);

    return NextResponse.json({
      from: 'USD',
      to: to,
      rate: rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
```

#### 5.3 Convert Currency

**File:** `app/api/payments/dlocal/convert/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { currencyConverter } from '@/lib/dlocal/currency-converter.service';
import { DLocalCurrency } from '@/types/dlocal';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const amount = parseFloat(searchParams.get('amount') || '0');
    const currency = searchParams.get('currency') as DLocalCurrency;

    if (!amount || !currency) {
      return NextResponse.json(
        { error: 'Amount and currency parameters are required' },
        { status: 400 }
      );
    }

    const conversion = await currencyConverter.convertUSDToLocal(
      amount,
      currency
    );

    return NextResponse.json(conversion);
  } catch (error) {
    console.error('Currency conversion failed:', error);
    return NextResponse.json(
      { error: 'Currency conversion failed' },
      { status: 500 }
    );
  }
}
```

#### 5.4 Create dLocal Payment

**File:** `app/api/payments/dlocal/create/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { dlocalPaymentService } from '@/lib/dlocal/dlocal-payment.service';
import { canApplyDiscountCode } from '@/lib/dlocal/constants';
import { z } from 'zod';

const createPaymentSchema = z.object({
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
  paymentMethodId: z.string(),
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']),
  currency: z.enum(['INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY']),
  amount: z.number().positive(),
  amountUSD: z.number().positive(),
  discountCode: z.string().optional(),
  payer: z.object({
    name: z.string(),
    email: z.string().email(),
    document: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = createPaymentSchema.parse(body);

    // 3. Validate 3-day plan eligibility (using anti-abuse validator)
    if (validated.planType === 'THREE_DAY') {
      const { threeDayValidator } = await import(
        '@/lib/dlocal/three-day-validator.service'
      );
      const validation = await threeDayValidator.canPurchaseThreeDayPlan(
        session.user.id
      );

      if (!validation.allowed) {
        return NextResponse.json(
          {
            error: validation.reason,
            code: 'THREE_DAY_PLAN_NOT_ALLOWED',
            usedAt: validation.usedAt,
          },
          { status: 403 }
        );
      }
    }

    // Monthly plans ALLOW early renewal (no restriction on active subscription)
    // System will extend expiry date in webhook handler

    // 4. Validate discount code
    if (validated.discountCode) {
      if (!canApplyDiscountCode(validated.planType, 'DLOCAL')) {
        return NextResponse.json(
          { error: 'Discount codes are not available for 3-day plans' },
          { status: 400 }
        );
      }

      // Validate discount code (implement this function)
      const discountValidation = await validateDiscountCode(
        validated.discountCode
      );
      if (!discountValidation.valid) {
        return NextResponse.json(
          { error: discountValidation.reason },
          { status: 400 }
        );
      }
    }

    // 5. Create payment in dLocal
    const orderId = `SUB-${session.user.id}-${Date.now()}`;
    const paymentRequest = {
      amount: validated.amount,
      currency: validated.currency,
      country: validated.country,
      payment_method_id: validated.paymentMethodId,
      payer: validated.payer,
      order_id: orderId,
      description: `Trading Alerts PRO - ${validated.planType}`,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/dlocal`,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
    };

    const dlocalPayment =
      await dlocalPaymentService.createPayment(paymentRequest);

    // 6. Create Payment record in database
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        provider: 'DLOCAL',
        providerPaymentId: dlocalPayment.id,
        providerStatus: dlocalPayment.status,
        amount: validated.amount,
        amountUSD: validated.amountUSD,
        currency: validated.currency,
        country: validated.country,
        paymentMethod: validated.paymentMethodId,
        planType: validated.planType,
        duration: validated.planType === 'THREE_DAY' ? 3 : 30,
        discountCode: validated.discountCode,
        status: 'PENDING',
        metadata: {
          orderId,
          dlocalPaymentId: dlocalPayment.id,
        },
      },
    });

    // 7. Return payment response
    return NextResponse.json(
      {
        id: dlocalPayment.id,
        status: dlocalPayment.status,
        amount: dlocalPayment.amount,
        currency: dlocalPayment.currency,
        redirectUrl: dlocalPayment.redirect_url,
        paymentMethodFlow: dlocalPayment.payment_method_flow,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('dLocal payment creation failed:', error);
    return NextResponse.json(
      { error: 'Payment creation failed' },
      { status: 500 }
    );
  }
}
```

#### 5.5 dLocal Webhook

**File:** `app/api/webhooks/dlocal/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { dlocalPaymentService } from '@/lib/dlocal/dlocal-payment.service';
import { addDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = request.headers.get('x-signature');
    const body = await request.json();

    if (!dlocalPaymentService.verifyWebhookSignature(body, signature)) {
      console.error('Invalid dLocal webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Find payment record
    const payment = await prisma.payment.findFirst({
      where: {
        providerPaymentId: body.id,
        provider: 'DLOCAL',
      },
      include: { user: true },
    });

    if (!payment) {
      console.error('Payment not found:', body.id);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // 3. Process based on status
    if (body.status === 'PAID') {
      await handlePaymentSuccess(payment, body);
    } else if (body.status === 'REJECTED') {
      await handlePaymentFailure(payment, body);
    } else if (body.status === 'CANCELLED') {
      await handlePaymentCancellation(payment);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(payment: any, webhookData: any) {
  // Check for existing active subscription (for early renewal calculation)
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: payment.userId },
  });

  let expiryDate: Date;
  const now = new Date();

  // EARLY RENEWAL LOGIC: Extend from current expiry if still active
  if (
    existingSubscription &&
    existingSubscription.expiresAt &&
    existingSubscription.expiresAt > now
  ) {
    // User has active subscription - extend from current expiry
    // Example: 10 days remaining + 30 days new = 40 days total
    expiryDate = addDays(existingSubscription.expiresAt, payment.duration);
  } else {
    // No active subscription or expired - start from now
    expiryDate = addDays(now, payment.duration);
  }

  await prisma.$transaction([
    // Update payment record
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        providerStatus: 'PAID',
      },
    }),

    // Create or update subscription
    prisma.subscription.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        paymentProvider: 'DLOCAL',
        dlocalPaymentId: payment.providerPaymentId,
        dlocalPaymentMethod: payment.paymentMethod,
        dlocalCountry: payment.country,
        dlocalCurrency: payment.currency,
        status: 'ACTIVE',
        tier: 'PRO',
        planType: payment.planType,
        currentPeriodStart: now,
        currentPeriodEnd: expiryDate,
        expiresAt: expiryDate,
        amount: payment.amount,
        amountUSD: payment.amountUSD,
        currency: payment.currency,
        discountCode: payment.discountCode,
      },
      update: {
        paymentProvider: 'DLOCAL',
        dlocalPaymentId: payment.providerPaymentId,
        status: 'ACTIVE',
        tier: 'PRO',
        expiresAt: expiryDate, // Extended date (early renewal support)
        renewalReminderSent: false, // Reset reminder flag
      },
    }),

    // Upgrade user tier
    prisma.user.update({
      where: { id: payment.userId },
      data: {
        tier: 'PRO',
        // Mark 3-day plan as used if this was a 3-day purchase
        ...(payment.planType === 'THREE_DAY' && {
          hasUsedThreeDayPlan: true,
          threeDayPlanUsedAt: now,
        }),
      },
    }),
  ]);

  // Send confirmation email with new expiry date
  await sendPaymentConfirmationEmail(payment.user, payment, expiryDate);
}

async function handlePaymentFailure(payment: any, webhookData: any) {
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: webhookData.failure_reason,
      providerStatus: 'REJECTED',
    },
  });

  // Send failure email
  await sendPaymentFailureEmail(payment.user, payment);
}

async function handlePaymentCancellation(payment: any) {
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'CANCELLED',
      providerStatus: 'CANCELLED',
    },
  });
}
```

---

### 6. Cron Jobs (Renewal & Expiry)

#### 6.1 Check Expiring Subscriptions

**File:** `lib/cron/check-expiring-subscriptions.ts` (NEW)

```typescript
import { prisma } from '@/lib/db/prisma';
import { addDays } from 'date-fns';
import { sendRenewalReminderEmail } from '@/lib/emails/send-renewal-reminder';

export async function checkExpiringSubscriptions() {
  // Find subscriptions expiring in 3 days
  const expiringIn3Days = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: {
        gte: new Date(),
        lte: addDays(new Date(), 3),
      },
      renewalReminderSent: false,
    },
    include: { user: true },
  });

  for (const subscription of expiringIn3Days) {
    // Send renewal reminder email
    await sendRenewalReminderEmail({
      to: subscription.user.email,
      name: subscription.user.name,
      expiryDate: subscription.expiresAt!,
      planType: subscription.planType,
      renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/checkout?renew=${subscription.id}`,
    });

    // Mark reminder sent
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { renewalReminderSent: true },
    });

    console.log(`Sent renewal reminder to user ${subscription.userId}`);
  }

  return { notificationsSent: expiringIn3Days.length };
}
```

#### 6.2 Downgrade Expired Subscriptions

**File:** `lib/cron/downgrade-expired-subscriptions.ts` (NEW)

```typescript
import { prisma } from '@/lib/db/prisma';
import { sendSubscriptionExpiredEmail } from '@/lib/emails/send-expired-notification';

export async function downgradeExpiredSubscriptions() {
  // Find expired subscriptions
  const expired = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: {
        lte: new Date(),
      },
    },
    include: { user: true },
  });

  for (const subscription of expired) {
    // Downgrade user to FREE tier
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'EXPIRED',
          tier: 'FREE',
        },
      }),
      prisma.user.update({
        where: { id: subscription.userId },
        data: { tier: 'FREE' },
      }),
    ]);

    // Send expiry notification
    await sendSubscriptionExpiredEmail({
      to: subscription.user.email,
      name: subscription.user.name,
      renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
    });

    console.log(`Downgraded user ${subscription.userId} to FREE tier`);
  }

  return { usersDowngraded: expired.length };
}
```

#### 6.3 Cron API Routes

**File:** `app/api/cron/check-expiring-subscriptions/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await checkExpiringSubscriptions();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**File:** `app/api/cron/downgrade-expired-subscriptions/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await downgradeExpiredSubscriptions();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

#### 6.4 Vercel Cron Configuration

**File:** `vercel.json` (UPDATE EXISTING)

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

### 7. Frontend Components

#### 7.1 Unified Checkout Page

**File:** `app/checkout/page.tsx` (UPDATE EXISTING OR CREATE NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { CountrySelector } from '@/components/payments/CountrySelector';
import { PlanSelector } from '@/components/payments/PlanSelector';
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector';
import { DiscountCodeInput } from '@/components/payments/DiscountCodeInput';
import { PriceDisplay } from '@/components/payments/PriceDisplay';
import { PaymentButton } from '@/components/payments/PaymentButton';
import { detectUserCountry } from '@/lib/geo/detect-country';
import { canApplyDiscountCode } from '@/lib/dlocal/constants';
import type { PaymentMethod, PlanType, PaymentProvider } from '@/types/dlocal';

export default function CheckoutPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('MONTHLY');
  const [loading, setLoading] = useState(true);

  // Detect country on mount
  useEffect(() => {
    async function initialize() {
      const detectedCountry = await detectUserCountry();
      setCountry(detectedCountry);

      if (detectedCountry) {
        const countryInfo = DLOCAL_SUPPORTED_COUNTRIES[detectedCountry];
        if (countryInfo) {
          setCurrency(countryInfo.currency);
        }
      }
    }

    initialize();
  }, []);

  // Load payment methods when country changes
  useEffect(() => {
    async function loadPaymentMethods() {
      if (!country) return;

      setLoading(true);
      const response = await fetch(`/api/payments/dlocal/methods?country=${country}`);
      const methods = await response.json();
      setPaymentMethods(methods);

      // Auto-select recommended method
      const recommended = methods.find((m: PaymentMethod) => m.recommended);
      if (recommended) {
        setSelectedProvider(recommended.provider);
        setSelectedMethod(recommended.id);
      }

      setLoading(false);
    }

    loadPaymentMethods();
  }, [country]);

  const handlePayment = async () => {
    if (selectedProvider === 'stripe') {
      // Redirect to Stripe checkout
      window.location.href = '/api/payments/stripe/checkout';
    } else if (selectedProvider === 'dlocal') {
      // Create dLocal payment
      const response = await fetch('/api/payments/dlocal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: selectedPlan,
          paymentMethodId: selectedMethod,
          country,
          currency,
          // ... other fields
        })
      });

      const payment = await response.json();
      if (payment.redirectUrl) {
        window.location.href = payment.redirectUrl;
      }
    }
  };

  return (
    <div className="checkout-page">
      <h1>Subscribe to PRO Plan</h1>

      {/* Country Selection */}
      <CountrySelector
        selectedCountry={country}
        onCountryChange={setCountry}
      />

      {/* Plan Selection - Show 3-day only for dLocal */}
      <PlanSelector
        provider={selectedProvider}
        selectedPlan={selectedPlan}
        onChange={setSelectedPlan}
      />

      {/* Price Display */}
      {country && (
        <PriceDisplay
          planType={selectedPlan}
          country={country}
          currency={currency}
        />
      )}

      {/* Payment Methods */}
      {loading ? (
        <PaymentMethodsSkeleton />
      ) : (
        <PaymentMethodSelector
          methods={paymentMethods}
          selectedProvider={selectedProvider}
          selectedMethod={selectedMethod}
          onSelect={(provider, methodId) => {
            setSelectedProvider(provider);
            setSelectedMethod(methodId);
          }}
        />
      )}

      {/* Discount Code Input - Hide for 3-day plan */}
      {canApplyDiscountCode(selectedPlan, selectedProvider || 'STRIPE') && (
        <DiscountCodeInput planType={selectedPlan} />
      )}

      {/* Payment Button */}
      <PaymentButton
        provider={selectedProvider}
        methodId={selectedMethod}
        onClick={handlePayment}
      />
    </div>
  );
}
```

---

### 8. Admin Dashboard Pages (Fraud Monitoring)

**Integration Point:** Part 14 - General Admin Dashboard (`/admin/*`)

These pages allow administrators to monitor and review fraud alerts generated by the 3-day plan anti-abuse system.

---

#### 8.1 Fraud Alerts List Page

**File:** `app/(dashboard)/admin/fraud-alerts/page.tsx` (NEW)

**Purpose:** Display all fraud alerts with filtering and sorting capabilities

```typescript
'use client';

import { useState, useEffect } from 'react';
import { FraudAlertCard } from '@/components/admin/FraudAlertCard';
import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { FraudAlert } from '@prisma/client';

interface FraudAlertWithUser extends FraudAlert {
  user: {
    email: string;
    name: string | null;
  };
}

export default function FraudAlertsPage() {
  const [alerts, setAlerts] = useState<FraudAlertWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: 'PENDING_REVIEW',  // 'ALL' | 'PENDING_REVIEW' | 'CONFIRMED' | 'FALSE_POSITIVE'
    severity: 'ALL',            // 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'
    pattern: 'ALL'              // 'ALL' | 'MULTIPLE_ACCOUNTS_SAME_IP' | etc.
  });

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  async function loadAlerts() {
    setLoading(true);
    const params = new URLSearchParams({
      status: filter.status,
      severity: filter.severity,
      pattern: filter.pattern
    });

    const response = await fetch(`/api/admin/fraud-alerts?${params}`);
    const data = await response.json();
    setAlerts(data.alerts);
    setLoading(false);
  }

  return (
    <div className="fraud-alerts-page">
      <div className="page-header">
        <h1>Fraud Alerts</h1>
        <p className="text-muted-foreground">
          Monitor and review suspicious 3-day plan purchase attempts
        </p>
      </div>

      {/* Statistics Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Pending Review</h3>
          <p className="stat-number">{alerts.filter(a => a.status === 'PENDING_REVIEW').length}</p>
        </div>
        <div className="stat-card">
          <h3>High Severity</h3>
          <p className="stat-number text-red-600">
            {alerts.filter(a => a.severity === 'HIGH' && a.status === 'PENDING_REVIEW').length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Confirmed Fraud</h3>
          <p className="stat-number">{alerts.filter(a => a.status === 'CONFIRMED').length}</p>
        </div>
        <div className="stat-card">
          <h3>False Positives</h3>
          <p className="stat-number">{alerts.filter(a => a.status === 'FALSE_POSITIVE').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <Select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="FALSE_POSITIVE">False Positive</option>
          <option value="ALL">All</option>
        </Select>

        <Select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
        >
          <option value="ALL">All Severities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>

        <Select
          value={filter.pattern}
          onChange={(e) => setFilter({ ...filter, pattern: e.target.value })}
        >
          <option value="ALL">All Patterns</option>
          <option value="SAME_PAYMENT_METHOD_DIFFERENT_EMAIL">Same Payment Method</option>
          <option value="MULTIPLE_ACCOUNTS_SAME_IP">Same IP</option>
          <option value="MULTIPLE_ACCOUNTS_SAME_DEVICE">Same Device</option>
          <option value="FRESH_ACCOUNT_PURCHASE">Fresh Account</option>
        </Select>
      </div>

      {/* Alerts List */}
      <div className="alerts-list">
        {loading ? (
          <div>Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <p>No fraud alerts found</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <FraudAlertCard
              key={alert.id}
              alert={alert}
              onReview={(id, decision, notes) => handleReview(id, decision, notes)}
            />
          ))
        )}
      </div>
    </div>
  );

  async function handleReview(
    alertId: string,
    decision: 'CONFIRMED' | 'FALSE_POSITIVE',
    notes: string
  ) {
    await fetch(`/api/admin/fraud-alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes })
    });

    // Reload alerts
    loadAlerts();
  }
}
```

---

#### 8.2 Fraud Alert Detail Page

**File:** `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` (NEW)

**Purpose:** Detailed view of a single fraud alert with full context and review actions

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { FraudAlert, User, Payment } from '@prisma/client';

interface FraudAlertDetails extends FraudAlert {
  user: User;
  relatedPayments: Payment[];
}

export default function FraudAlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [alert, setAlert] = useState<FraudAlertDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlertDetails();
  }, [params.id]);

  async function loadAlertDetails() {
    const response = await fetch(`/api/admin/fraud-alerts/${params.id}`);
    const data = await response.json();
    setAlert(data.alert);
    setReviewNotes(data.alert.reviewNotes || '');
    setLoading(false);
  }

  async function handleReview(decision: 'CONFIRMED' | 'FALSE_POSITIVE') {
    await fetch(`/api/admin/fraud-alerts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        notes: reviewNotes
      })
    });

    router.push('/admin/fraud-alerts');
  }

  if (loading || !alert) {
    return <div>Loading...</div>;
  }

  const metadata = alert.metadata as Record<string, any>;

  return (
    <div className="fraud-alert-detail">
      <div className="page-header">
        <h1>Fraud Alert Details</h1>
        <FraudPatternBadge pattern={alert.pattern} severity={alert.severity} />
      </div>

      {/* Alert Information */}
      <div className="alert-info">
        <div className="info-section">
          <h2>Alert Information</h2>
          <dl>
            <dt>Alert ID:</dt>
            <dd>{alert.id}</dd>

            <dt>Created:</dt>
            <dd>{new Date(alert.createdAt).toLocaleString()}</dd>

            <dt>Pattern:</dt>
            <dd>{alert.pattern.replace(/_/g, ' ')}</dd>

            <dt>Severity:</dt>
            <dd className={`severity-${alert.severity.toLowerCase()}`}>{alert.severity}</dd>

            <dt>Status:</dt>
            <dd>{alert.status}</dd>
          </dl>
        </div>

        {/* User Information */}
        <div className="info-section">
          <h2>User Information</h2>
          <dl>
            <dt>User ID:</dt>
            <dd>{alert.user.id}</dd>

            <dt>Email:</dt>
            <dd>{alert.user.email}</dd>

            <dt>Name:</dt>
            <dd>{alert.user.name || 'N/A'}</dd>

            <dt>Account Created:</dt>
            <dd>{new Date(alert.user.createdAt).toLocaleString()}</dd>

            <dt>Has Used 3-Day Plan:</dt>
            <dd>{alert.user.hasUsedThreeDayPlan ? 'Yes' : 'No'}</dd>
          </dl>
        </div>

        {/* Detection Metadata */}
        <div className="info-section">
          <h2>Detection Details</h2>
          <pre className="metadata-json">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>

        {/* Related Payments */}
        <div className="info-section">
          <h2>Related Payments</h2>
          {alert.relatedPayments.length === 0 ? (
            <p>No related payments found</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {alert.relatedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.initiatedAt).toLocaleDateString()}</td>
                    <td>{payment.planType}</td>
                    <td>${payment.amountUSD}</td>
                    <td>{payment.status}</td>
                    <td>{payment.purchaseIP || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Section */}
      {alert.status === 'PENDING_REVIEW' && (
        <div className="review-section">
          <h2>Review This Alert</h2>

          <Textarea
            placeholder="Add review notes (optional)"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={4}
          />

          <div className="review-actions">
            <Button
              variant="destructive"
              onClick={() => handleReview('CONFIRMED')}
            >
              Confirm as Fraud
            </Button>

            <Button
              variant="outline"
              onClick={() => handleReview('FALSE_POSITIVE')}
            >
              Mark as False Positive
            </Button>

            <Button
              variant="ghost"
              onClick={() => router.push('/admin/fraud-alerts')}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Review History */}
      {alert.reviewedAt && (
        <div className="review-history">
          <h2>Review History</h2>
          <dl>
            <dt>Reviewed By:</dt>
            <dd>{alert.reviewedBy || 'Unknown'}</dd>

            <dt>Reviewed At:</dt>
            <dd>{new Date(alert.reviewedAt).toLocaleString()}</dd>

            <dt>Decision:</dt>
            <dd>{alert.status}</dd>

            <dt>Notes:</dt>
            <dd>{alert.reviewNotes || 'No notes'}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
```

---

#### 8.3 Fraud Alerts Widget (Admin Dashboard)

**File:** `app/(dashboard)/admin/page.tsx` (UPDATE - Add widget)

**Purpose:** Show fraud alert summary on main admin dashboard

```typescript
// Add this widget to the existing admin dashboard

import { FraudAlertsWidget } from '@/components/admin/FraudAlertsWidget';

export default async function AdminDashboardPage() {
  // ... existing code ...

  return (
    <div className="admin-dashboard">
      {/* ... existing widgets ... */}

      {/* NEW: Fraud Alerts Widget */}
      <FraudAlertsWidget />

      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

**Component:** `components/admin/FraudAlertsWidget.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { FraudPatternBadge } from './FraudPatternBadge';

interface FraudAlertSummary {
  id: string;
  pattern: string;
  severity: string;
  createdAt: string;
  user: {
    email: string;
  };
}

export function FraudAlertsWidget() {
  const [recentAlerts, setRecentAlerts] = useState<FraudAlertSummary[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    high: 0,
    total: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const response = await fetch('/api/admin/fraud-alerts?limit=5&status=PENDING_REVIEW');
    const data = await response.json();
    setRecentAlerts(data.alerts);
    setStats(data.stats);
  }

  return (
    <Card className="fraud-alerts-widget">
      <div className="widget-header">
        <h3>Fraud Alerts</h3>
        <Link href="/admin/fraud-alerts">
          View All →
        </Link>
      </div>

      <div className="widget-stats">
        <div className="stat">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{stats.pending}</span>
        </div>
        <div className="stat">
          <span className="stat-label">High Priority</span>
          <span className="stat-value text-red-600">{stats.high}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total (30d)</span>
          <span className="stat-value">{stats.total}</span>
        </div>
      </div>

      <div className="widget-content">
        {recentAlerts.length === 0 ? (
          <p className="empty-state">No pending fraud alerts</p>
        ) : (
          <ul className="alert-list">
            {recentAlerts.map((alert) => (
              <li key={alert.id}>
                <Link href={`/admin/fraud-alerts/${alert.id}`}>
                  <div className="alert-item">
                    <FraudPatternBadge pattern={alert.pattern} severity={alert.severity} />
                    <span className="alert-email">{alert.user.email}</span>
                    <span className="alert-time">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
```

---

#### 8.4 Admin API Routes for Fraud Alerts

**File:** `app/api/admin/fraud-alerts/route.ts` (NEW)

**Purpose:** API endpoint to list fraud alerts with filtering

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check admin auth
    const session = await getServerSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_REVIEW';
    const severity = searchParams.get('severity');
    const pattern = searchParams.get('pattern');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status !== 'ALL') {
      where.status = status;
    }
    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }
    if (pattern && pattern !== 'ALL') {
      where.pattern = pattern;
    }

    // Fetch alerts
    const alerts = await prisma.fraudAlert.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            hasUsedThreeDayPlan: true,
          },
        },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    // Get stats
    const stats = {
      pending: await prisma.fraudAlert.count({
        where: { status: 'PENDING_REVIEW' },
      }),
      high: await prisma.fraudAlert.count({
        where: { status: 'PENDING_REVIEW', severity: 'HIGH' },
      }),
      total: await prisma.fraudAlert.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    };

    return NextResponse.json({
      alerts,
      stats,
      pagination: {
        limit,
        offset,
        total: await prisma.fraudAlert.count({ where }),
      },
    });
  } catch (error) {
    console.error('Fraud alerts fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    );
  }
}
```

**File:** `app/api/admin/fraud-alerts/[id]/route.ts` (NEW)

**Purpose:** API endpoint for fraud alert detail and review

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin auth
    const session = await getServerSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alert = await prisma.fraudAlert.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        // Fetch related payments for context
        user: {
          include: {
            payments: {
              where: {
                planType: 'THREE_DAY',
                createdAt: {
                  gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Last 60 days
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Fraud alert fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alert' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin auth
    const session = await getServerSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { decision, notes } = await req.json();

    // Update alert
    const alert = await prisma.fraudAlert.update({
      where: { id: params.id },
      data: {
        status: decision,
        reviewedAt: new Date(),
        reviewedBy: session.user.email,
        reviewNotes: notes,
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Fraud alert review failed:', error);
    return NextResponse.json(
      { error: 'Failed to review fraud alert' },
      { status: 500 }
    );
  }
}
```

---

#### 8.5 Reusable Components

**File:** `components/admin/FraudAlertCard.tsx` (NEW)

```typescript
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudPatternBadge } from './FraudPatternBadge';
import Link from 'next/link';

interface FraudAlertCardProps {
  alert: any;
  onReview?: (id: string, decision: string, notes: string) => void;
}

export function FraudAlertCard({ alert, onReview }: FraudAlertCardProps) {
  const metadata = alert.metadata as Record<string, any>;

  return (
    <Card className="fraud-alert-card">
      <div className="card-header">
        <FraudPatternBadge pattern={alert.pattern} severity={alert.severity} />
        <span className="alert-date">
          {new Date(alert.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="card-body">
        <p><strong>User:</strong> {alert.user.email}</p>
        <p><strong>Pattern:</strong> {alert.pattern.replace(/_/g, ' ')}</p>

        {metadata && (
          <div className="metadata-summary">
            {Object.entries(metadata).slice(0, 3).map(([key, value]) => (
              <p key={key}>
                <strong>{key}:</strong> {String(value)}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card-footer">
        <Link href={`/admin/fraud-alerts/${alert.id}`}>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </Link>

        {alert.status === 'PENDING_REVIEW' && onReview && (
          <div className="quick-actions">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onReview(alert.id, 'CONFIRMED', '')}
            >
              Confirm Fraud
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReview(alert.id, 'FALSE_POSITIVE', '')}
            >
              False Positive
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
```

**File:** `components/admin/FraudPatternBadge.tsx` (NEW)

```typescript
interface FraudPatternBadgeProps {
  pattern: string;
  severity: string;
}

export function FraudPatternBadge({ pattern, severity }: FraudPatternBadgeProps) {
  const severityColors = {
    HIGH: 'bg-red-100 text-red-800 border-red-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  const patternLabels: Record<string, string> = {
    SAME_PAYMENT_METHOD_DIFFERENT_EMAIL: 'Same Payment Method',
    MULTIPLE_ACCOUNTS_SAME_IP: 'Same IP',
    MULTIPLE_ACCOUNTS_SAME_DEVICE: 'Same Device',
    FRESH_ACCOUNT_PURCHASE: 'Fresh Account'
  };

  return (
    <div className="flex gap-2">
      <span className={`badge ${severityColors[severity as keyof typeof severityColors]}`}>
        {severity}
      </span>
      <span className="badge bg-gray-100 text-gray-800">
        {patternLabels[pattern] || pattern}
      </span>
    </div>
  );
}
```

---

### 9. Environment Variables

**File:** `.env.example` (UPDATE)

```bash
# Existing Stripe variables...

# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# dLocal Pricing (USD)
DLOCAL_3DAY_PRICE_USD=1.99
DLOCAL_MONTHLY_PRICE_USD=29.00

# Feature Flags
ENABLE_DLOCAL_PAYMENTS=true
ENABLE_3DAY_PLAN=true

# Cron Job Secret
CRON_SECRET=your_cron_secret_here
```

---

## File Structure Summary

```
trading-alerts-saas/
├── prisma/
│   └── schema.prisma (UPDATED - add dLocal fields)
├── types/
│   └── dlocal.ts (NEW)
├── lib/
│   ├── dlocal/
│   │   ├── constants.ts (NEW)
│   │   ├── currency-converter.service.ts (NEW)
│   │   ├── payment-methods.service.ts (NEW)
│   │   └── dlocal-payment.service.ts (NEW)
│   ├── cron/
│   │   ├── check-expiring-subscriptions.ts (NEW)
│   │   └── downgrade-expired-subscriptions.ts (NEW)
│   └── geo/
│       └── detect-country.ts (NEW)
├── app/
│   ├── api/
│   │   ├── payments/
│   │   │   └── dlocal/
│   │   │       ├── methods/route.ts (NEW)
│   │   │       ├── exchange-rate/route.ts (NEW)
│   │   │       ├── convert/route.ts (NEW)
│   │   │       ├── create/route.ts (NEW)
│   │   │       ├── validate-discount/route.ts (NEW)
│   │   │       └── [paymentId]/route.ts (NEW)
│   │   ├── webhooks/
│   │   │   └── dlocal/route.ts (NEW)
│   │   └── cron/
│   │       ├── check-expiring-subscriptions/route.ts (NEW)
│   │       └── downgrade-expired-subscriptions/route.ts (NEW)
│   └── checkout/
│       └── page.tsx (UPDATED)
├── components/
│   └── payments/
│       ├── CountrySelector.tsx (NEW)
│       ├── PlanSelector.tsx (NEW)
│       ├── PaymentMethodSelector.tsx (NEW)
│       ├── PriceDisplay.tsx (NEW)
│       ├── DiscountCodeInput.tsx (NEW)
│       └── PaymentButton.tsx (NEW)
├── docs/
│   ├── policies/
│   │   └── 07-dlocal-integration-rules.md (NEW)
│   └── dlocal-openapi-endpoints.yaml (NEW)
└── vercel.json (UPDATED - add cron jobs)
```

---

## Implementation Order (Recommended)

### Week 1: Database & Backend Services (30 hours)

1. ✅ Update Prisma schema (User, Subscription, Payment, FraudAlert models)
2. ✅ Create database migration (`npx prisma migrate dev --name add_dlocal_support`)
3. ✅ Create type definitions (`types/dlocal.ts`)
4. ✅ Create constants file (`lib/dlocal/constants.ts`)
5. ✅ Create currency converter service (`lib/dlocal/currency-converter.service.ts`)
6. ✅ Create payment methods service (`lib/dlocal/payment-methods.service.ts`)
7. ✅ Create dLocal payment service (`lib/dlocal/dlocal-payment.service.ts`)
8. ✅ **Create 3-day plan validator service** (`lib/dlocal/three-day-validator.service.ts`)

### Week 2: API Routes (30 hours)

1. ✅ Create payment methods API route (`/api/payments/dlocal/methods`)
2. ✅ Create exchange rate API route (`/api/payments/dlocal/exchange-rate`)
3. ✅ Create convert currency API route (`/api/payments/dlocal/convert`)
4. ✅ **Create payment API with anti-abuse validation** (`/api/payments/dlocal/create`)
5. ✅ Create dLocal webhook route (`/api/webhooks/dlocal`)
6. ✅ Create validate discount API route (`/api/payments/dlocal/validate-discount`)
7. ✅ **Create fraud alerts API route** (`/api/admin/fraud-alerts`)
8. ✅ **Create fraud review API route** (`/api/admin/fraud-alerts/[id]`)

### Week 3: Cron Jobs, Email Notifications & Admin Dashboard (30 hours)

1. ✅ Create expiring subscriptions checker (cron service)
2. ✅ Create expired subscriptions downgrader (cron service)
3. ✅ Create cron API routes (`/api/cron/dlocal-expiring`, `/api/cron/dlocal-expired`)
4. ✅ Update vercel.json with cron schedules
5. ✅ Create email templates (renewal reminder, expired notice)
6. ✅ Implement email sending logic
7. ✅ **Create fraud alerts admin page** (`/admin/fraud-alerts/page.tsx`)
8. ✅ **Create fraud alert detail page** (`/admin/fraud-alerts/[id]/page.tsx`)
9. ✅ **Create payment fraud dashboard widget** (add to `/admin/page.tsx`)

### Week 4: Frontend Components & Testing (30 hours)

1. ✅ Create country detection utility
2. ✅ Create CountrySelector component
3. ✅ Create PlanSelector component (with 3-day plan eligibility check)
4. ✅ Create PaymentMethodSelector component
5. ✅ Create PriceDisplay component (Stripe USD only, dLocal with conversion)
6. ✅ Create DiscountCodeInput component (conditional rendering)
7. ✅ Update checkout page (unified checkout with validation)
8. ✅ **Create FraudAlertCard component** (for admin dashboard)
9. ✅ **Create FraudPatternBadge component** (visual indicators)
10. ✅ Test complete payment flow
11. ✅ Test webhook handling
12. ✅ Test cron jobs
13. ✅ **Test 3-day plan anti-abuse system**

---

## Testing Checklist

### Unit Tests

- [ ] Currency conversion (USD to local currencies)
- [ ] Discount code validation
- [ ] Payment methods fetching
- [ ] Webhook signature verification
- [ ] Expiry date calculations

### Integration Tests

- [ ] Complete payment flow (mock dLocal API)
- [ ] Webhook handling
- [ ] Subscription creation
- [ ] User tier upgrade
- [ ] Cron job execution

### End-to-End Tests

- [ ] User selects India → Sees UPI, Paytm
- [ ] User selects 3-day plan → Discount input hidden
- [ ] User selects monthly plan → Discount input shown
- [ ] User completes payment → Upgraded to PRO
- [ ] Subscription expires → User downgraded to FREE
- [ ] Renewal reminder sent 3 days before expiry

---

## Aider Commands for Building Part 18

```bash
# Start Aider with Part 18 requirements
py -3.11 -m aider --model anthropic/MiniMax-M2

# Command 1: Database Schema
> Build database schema updates from docs/implementation-guides/v5_part_r.md.
> Update prisma/schema.prisma with dLocal fields.
> Create migration.

# Command 2: Type Definitions & Constants
> Create types/dlocal.ts with all TypeScript types.
> Create lib/dlocal/constants.ts with country/currency mappings.

# Command 3: Services
> Create lib/dlocal/currency-converter.service.ts
> Create lib/dlocal/payment-methods.service.ts
> Create lib/dlocal/dlocal-payment.service.ts

# Command 4: API Routes
> Create all API routes in app/api/payments/dlocal/
> Create webhook route in app/api/webhooks/dlocal/

# Command 5: Cron Jobs
> Create cron job functions in lib/cron/
> Create cron API routes in app/api/cron/
> Update vercel.json with cron schedules

# Command 6: Frontend Components
> Create all payment components in components/payments/
> Update app/checkout/page.tsx for unified checkout

# After each file, Claude Code will validate automatically
# Fix any issues before moving to next file
```

---

## Success Criteria

### Functional Requirements

- ✅ Single checkout page shows both Stripe and dLocal options
- ✅ Country detection works with manual override
- ✅ Payment methods load dynamically for each country
- ✅ Prices display in local currency with USD equivalent
- ✅ 3-day plan exclusive to dLocal
- ✅ Discount codes work on monthly plans only (not 3-day)
- ✅ Payment processing works for all 8 countries
- ✅ Webhooks handle payment success/failure correctly
- ✅ Renewal reminders sent 3 days before expiry
- ✅ Expired subscriptions downgraded to FREE automatically

### Non-Functional Requirements

- ✅ Page loads in < 3 seconds
- ✅ Payment method selection updates UI instantly
- ✅ Mobile responsive on all screen sizes
- ✅ Accessible (WCAG 2.1 AA)
- ✅ Error messages clear and actionable
- ✅ Graceful fallbacks when dLocal API fails
- ✅ Webhook signatures verified before processing
- ✅ All secrets server-side only

---

**Total Estimated Time:** 120 hours (4 weeks × 30 hours/week)

**Part 18 File Count:** ~45 files (types, services, API routes, components, cron jobs, emails)

**Dependencies:** Parts 1-17 complete (especially Part 12: E-commerce & Billing)

---

**NOTE:** This implementation maintains full compatibility with existing Stripe infrastructure while adding dLocal as an alternative payment provider for emerging markets.
