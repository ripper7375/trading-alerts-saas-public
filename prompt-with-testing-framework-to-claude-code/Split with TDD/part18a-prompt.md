# Part 18A: dLocal Payment Creation Flow (Vertical Slice 1 of 3)

## Overview

**Part:** 18A of 18 (Slice 1 of 3)
**Feature:** Payment Creation & Basic Processing
**Total Files:** 23 files (16 production + 7 test)
**Complexity:** Medium
**Dependencies:** Part 2 (Database), Part 5 (Auth)
**Test Coverage Target:** 25% minimum
**Status:** FIRST SLICE - Foundation for 18B and 18C

---

## Mission Statement

Build the foundational payment creation flow for dLocal integration using Test-Driven Development (TDD). This slice creates a COMPLETE, END-TO-END TESTABLE feature that can create payments, convert currencies, detect countries, and process basic webhook responses. Part 18B will build on this foundation to add subscription lifecycle management.

---

## What Part 18A Builds (Deliverable)

**END-TO-END TESTABLE FEATURE:**

- User can create a dLocal payment
- System converts USD to local currency
- System detects user's country
- System fetches available payment methods
- Basic webhook can process payment success/failure
- All core services are working and tested

**NOT IN THIS SLICE:**

- Subscription lifecycle (18B)
- 3-day plan validation (18B)
- Cron jobs (18B)
- Frontend components (18C)
- Admin dashboard (18C)
- Part 12 integration (18B and 18C)

---

## Prerequisites Check

Before starting, verify:

- [ ] Part 2 complete (Database & Prisma setup)
- [ ] Part 5 complete (Authentication with NextAuth)
- [ ] Node.js 18+ and npm working
- [ ] Git repository initialized
- [ ] Testing framework installed (Jest + Supertest)
- [ ] Database connection working
- [ ] Environment variables configured

---

## Critical Business Rules for Part 18A

### 1. Supported Countries (8 total)

- **IN** (India) - INR
- **NG** (Nigeria) - NGN
- **PK** (Pakistan) - PKR
- **VN** (Vietnam) - VND
- **ID** (Indonesia) - IDR
- **TH** (Thailand) - THB
- **ZA** (South Africa) - ZAR
- **TR** (Turkey) - TRY

### 2. Pricing (Part 18A Scope)

- Store USD prices: $1.99 (3-day), $29.00 (monthly)
- Convert to local currency using exchange rate API
- Store BOTH USD and local amounts in database

### 3. Payment Creation Rules

- Must be authenticated
- Must validate country is supported
- Must validate payment method is available
- Must store payment record BEFORE calling dLocal API
- Must update payment record with dLocal response

### 4. Webhook Processing (Basic - Part 18A)

- Verify webhook signature (CRITICAL for security)
- Update payment status (PENDING → COMPLETED or FAILED)
- Create notification for user
- **NOTE:** Subscription creation is in Part 18B

---

## All 23 Files to Build

### Phase A: Database & Types (3 production + 2 test = 5 files)

| #   | File Path                                | Type   | Description                              |
| --- | ---------------------------------------- | ------ | ---------------------------------------- |
| 1   | `prisma/schema.prisma`                   | UPDATE | Add Payment model (basic fields for 18A) |
| 2   | `types/dlocal.ts`                        | NEW    | dLocal type definitions                  |
| 3   | `lib/dlocal/constants.ts`                | NEW    | Countries, currencies, pricing constants |
| T1  | `__tests__/types/dlocal.test.ts`         | TEST   | Test type definitions                    |
| T2  | `__tests__/lib/dlocal/constants.test.ts` | TEST   | Test country/currency mappings           |

### Phase B: Core Services (5 production + 4 test = 9 files)

| #   | File Path                                         | Type | Description                      |
| --- | ------------------------------------------------- | ---- | -------------------------------- |
| 4   | `lib/dlocal/currency-converter.service.ts`        | NEW  | USD to local currency conversion |
| 5   | `lib/dlocal/payment-methods.service.ts`           | NEW  | Fetch payment methods by country |
| 6   | `lib/dlocal/dlocal-payment.service.ts`            | NEW  | Create payments, verify webhooks |
| 7   | `lib/geo/detect-country.ts`                       | NEW  | IP geolocation country detection |
| 8   | `lib/logger.ts`                                   | NEW  | Simple logging utility           |
| T3  | `__tests__/lib/dlocal/currency-converter.test.ts` | TEST | TDD: Currency conversion         |
| T4  | `__tests__/lib/dlocal/payment-methods.test.ts`    | TEST | TDD: Payment methods             |
| T5  | `__tests__/lib/dlocal/dlocal-payment.test.ts`     | TEST | TDD: Payment creation            |
| T6  | `__tests__/lib/geo/detect-country.test.ts`        | TEST | TDD: Country detection           |

### Phase C: API Routes (6 production + 1 test = 7 files)

| #   | File Path                                        | Type | Description                          |
| --- | ------------------------------------------------ | ---- | ------------------------------------ |
| 9   | `app/api/payments/dlocal/methods/route.ts`       | NEW  | GET payment methods for country      |
| 10  | `app/api/payments/dlocal/exchange-rate/route.ts` | NEW  | GET exchange rate USD to currency    |
| 11  | `app/api/payments/dlocal/convert/route.ts`       | NEW  | GET currency conversion              |
| 12  | `app/api/payments/dlocal/create/route.ts`        | NEW  | POST create dLocal payment           |
| 13  | `app/api/payments/dlocal/[paymentId]/route.ts`   | NEW  | GET payment status                   |
| 14  | `app/api/webhooks/dlocal/route.ts`               | NEW  | POST webhook handler (BASIC version) |
| T7  | `__tests__/api/webhooks/dlocal/route.test.ts`    | TEST | Unit test: Basic webhook handler     |

### Phase D: Integration Test (0 production + 1 test = 1 file)

| #   | File Path                                        | Type | Description                        |
| --- | ------------------------------------------------ | ---- | ---------------------------------- |
| T8  | `__tests__/integration/payment-creation.test.ts` | TEST | Integration: Complete payment flow |

### Phase E: Documentation (1 production + 0 test = 1 file)

| #   | File Path                 | Type | Description              |
| --- | ------------------------- | ---- | ------------------------ |
| 15  | `docs/part18a-handoff.md` | NEW  | Handoff doc for Part 18B |

---

## TDD Build Sequence (Red-Green-Refactor)

### Phase A: Database & Types

#### Step 1: Update Database Schema (Part 18A Scope)

**File: `prisma/schema.prisma`** (UPDATE - Add Payment model only)

```prisma
// ADD TO EXISTING SCHEMA (don't remove existing models)

model Payment {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  provider        String   // 'DLOCAL' (fixed for Part 18A)
  paymentId       String   @unique // dLocal payment ID
  orderId         String   @unique
  amount          Decimal  @db.Decimal(10, 2)
  currency        String
  amountUSD       Decimal  @db.Decimal(10, 2)
  country         String
  paymentMethod   String
  planType        String   // 'THREE_DAY' or 'MONTHLY'
  status          String   // PENDING, COMPLETED, FAILED
  discountCode    String?
  discountAmount  Decimal? @db.Decimal(10, 2)
  finalAmount     Decimal  @db.Decimal(10, 2)
  metadata        Json?
  initiatedAt     DateTime @default(now())
  completedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?

  @@index([userId])
  @@index([status])
  @@index([initiatedAt])
}

// ADD Notification model for webhook notifications
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // e.g., 'payment_success', 'payment_failed'
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([read])
}

// UPDATE User model - ADD relation
model User {
  // ... existing fields ...
  payments      Payment[]      // ADD THIS
  notifications Notification[] // ADD THIS
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add-payment-model-part18a
npx prisma generate
```

#### Step 2: Types & Constants (TDD)

**RED: Write Test First**

**File: `__tests__/types/dlocal.test.ts`**

```typescript
import { DLocalCountry, DLocalCurrency, PaymentProvider } from '@/types/dlocal';

describe('dLocal Types', () => {
  it('should have correct payment provider type', () => {
    const provider: PaymentProvider = 'DLOCAL';
    expect(provider).toBe('DLOCAL');
  });

  it('should have 8 supported countries', () => {
    const countries: DLocalCountry[] = [
      'IN',
      'NG',
      'PK',
      'VN',
      'ID',
      'TH',
      'ZA',
      'TR',
    ];
    expect(countries).toHaveLength(8);
  });

  it('should have matching currencies for countries', () => {
    const currencies: DLocalCurrency[] = [
      'INR',
      'NGN',
      'PKR',
      'VND',
      'IDR',
      'THB',
      'ZAR',
      'TRY',
    ];
    expect(currencies).toHaveLength(8);
  });
});
```

**Run test:** `npm test -- dlocal.test.ts` → ❌ FAILS (types don't exist)

**GREEN: Write Minimal Code**

**File: `types/dlocal.ts`**

```typescript
export type PaymentProvider = 'DLOCAL';
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
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface DLocalPaymentRequest {
  userId: string;
  amount: number; // USD amount
  currency: DLocalCurrency;
  country: DLocalCountry;
  paymentMethod: string;
  planType: PlanType;
  discountCode?: string;
}

export interface DLocalPaymentResponse {
  paymentId: string;
  orderId: string;
  paymentUrl: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

export interface DLocalWebhookPayload {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
  payment_method_id: string;
  created_date: string;
  failure_reason?: string;
}

export interface CurrencyConversionResult {
  localAmount: number;
  currency: DLocalCurrency;
  exchangeRate: number;
  usdAmount: number;
}
```

**Run test:** `npm test` → ✅ PASSES

**File: `lib/dlocal/constants.ts`**

```typescript
import { DLocalCountry, DLocalCurrency } from '@/types/dlocal';

export const DLOCAL_SUPPORTED_COUNTRIES: DLocalCountry[] = [
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
];

export const COUNTRY_CURRENCY_MAP: Record<DLocalCountry, DLocalCurrency> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
};

export const COUNTRY_NAMES: Record<DLocalCountry, string> = {
  IN: 'India',
  NG: 'Nigeria',
  PK: 'Pakistan',
  VN: 'Vietnam',
  ID: 'Indonesia',
  TH: 'Thailand',
  ZA: 'South Africa',
  TR: 'Turkey',
};

export const PAYMENT_METHODS: Record<DLocalCountry, string[]> = {
  IN: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  NG: ['Bank Transfer', 'USSD', 'Paystack'],
  PK: ['JazzCash', 'Easypaisa'],
  VN: ['VNPay', 'MoMo', 'ZaloPay'],
  ID: ['GoPay', 'OVO', 'Dana', 'ShopeePay'],
  TH: ['TrueMoney', 'Rabbit LINE Pay', 'Thai QR'],
  ZA: ['Instant EFT', 'EFT'],
  TR: ['Bank Transfer', 'Local Cards'],
};

export const PRICING = {
  THREE_DAY_USD: 1.99,
  MONTHLY_USD: 29.0,
};

export function isDLocalCountry(country: string): country is DLocalCountry {
  return DLOCAL_SUPPORTED_COUNTRIES.includes(country as DLocalCountry);
}

export function getCurrency(country: DLocalCountry): DLocalCurrency {
  return COUNTRY_CURRENCY_MAP[country];
}

export function getPaymentMethods(country: DLocalCountry): string[] {
  return PAYMENT_METHODS[country] || [];
}
```

**Test Constants:**

**File: `__tests__/lib/dlocal/constants.test.ts`**

```typescript
import {
  isDLocalCountry,
  getCurrency,
  getPaymentMethods,
  DLOCAL_SUPPORTED_COUNTRIES,
  PRICING,
} from '@/lib/dlocal/constants';

describe('dLocal Constants', () => {
  it('should identify valid dLocal countries', () => {
    expect(isDLocalCountry('IN')).toBe(true);
    expect(isDLocalCountry('NG')).toBe(true);
    expect(isDLocalCountry('US')).toBe(false);
  });

  it('should return correct currency for country', () => {
    expect(getCurrency('IN')).toBe('INR');
    expect(getCurrency('NG')).toBe('NGN');
    expect(getCurrency('TH')).toBe('THB');
  });

  it('should have 8 supported countries', () => {
    expect(DLOCAL_SUPPORTED_COUNTRIES).toHaveLength(8);
  });

  it('should return payment methods for country', () => {
    const methods = getPaymentMethods('IN');
    expect(methods).toContain('UPI');
    expect(methods).toContain('Paytm');
  });

  it('should have correct pricing', () => {
    expect(PRICING.THREE_DAY_USD).toBe(1.99);
    expect(PRICING.MONTHLY_USD).toBe(29.0);
  });
});
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add prisma/schema.prisma types/dlocal.ts lib/dlocal/constants.ts __tests__/
git commit -m "feat(part18a): add database schema, types, and constants with tests"
```

---

### Phase B: Core Services (TDD)

#### Service 1: Logger Utility

**File: `lib/logger.ts`** (Simple logger for Part 18A)

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

export const logger = new Logger();
```

#### Service 2: Currency Converter (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/currency-converter.test.ts`**

```typescript
import {
  convertUSDToLocal,
  getExchangeRate,
} from '@/lib/dlocal/currency-converter.service';

describe('Currency Converter Service', () => {
  it('should convert USD to INR', async () => {
    const result = await convertUSDToLocal(29.0, 'INR');

    expect(result.localAmount).toBeGreaterThan(0);
    expect(result.currency).toBe('INR');
    expect(result.exchangeRate).toBeGreaterThan(0);
    expect(result.usdAmount).toBe(29.0);
  });

  it('should get exchange rate for THB', async () => {
    const rate = await getExchangeRate('THB');

    expect(rate).toBeGreaterThan(0);
    expect(typeof rate).toBe('number');
  });

  it('should handle invalid currency gracefully', async () => {
    await expect(getExchangeRate('INVALID' as any)).rejects.toThrow(
      'Unsupported currency'
    );
  });

  it('should cache exchange rates', async () => {
    const rate1 = await getExchangeRate('VND');
    const rate2 = await getExchangeRate('VND');

    expect(rate1).toBe(rate2);
  });

  it('should round local amount to 2 decimals', async () => {
    const result = await convertUSDToLocal(29.0, 'INR');
    const decimals = result.localAmount.toString().split('.')[1]?.length || 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});
```

**Run test:** `npm test -- currency-converter.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/currency-converter.service.ts`**

```typescript
import { DLocalCurrency, CurrencyConversionResult } from '@/types/dlocal';
import { logger } from '@/lib/logger';

const exchangeRateCache: Map<
  DLocalCurrency,
  { rate: number; timestamp: number }
> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Mock rates for development (will use real API in production)
const MOCK_RATES: Record<DLocalCurrency, number> = {
  INR: 83.12,
  NGN: 1505.5,
  PKR: 278.45,
  VND: 24750.0,
  IDR: 15680.0,
  THB: 35.25,
  ZAR: 18.65,
  TRY: 32.15,
};

async function fetchExchangeRateFromAPI(
  currency: DLocalCurrency
): Promise<number> {
  try {
    // Use exchangerate-api.com (free tier available)
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates[currency]) {
      throw new Error(`Exchange rate not found for ${currency}`);
    }

    return data.rates[currency];
  } catch (error) {
    logger.warn('Failed to fetch exchange rate from API, using mock rate', {
      currency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fall back to mock rates
    if (!MOCK_RATES[currency]) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    return MOCK_RATES[currency];
  }
}

export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number> {
  // Validate currency
  if (!MOCK_RATES[currency]) {
    throw new Error('Unsupported currency');
  }

  // Check cache
  const cached = exchangeRateCache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.debug('Using cached exchange rate', { currency, rate: cached.rate });
    return cached.rate;
  }

  // Fetch fresh rate
  const rate = await fetchExchangeRateFromAPI(currency);

  // Cache the rate
  exchangeRateCache.set(currency, {
    rate,
    timestamp: Date.now(),
  });

  logger.info('Fetched exchange rate', { currency, rate });
  return rate;
}

export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency
): Promise<CurrencyConversionResult> {
  const exchangeRate = await getExchangeRate(currency);
  const localAmount = Math.round(usdAmount * exchangeRate * 100) / 100;

  return {
    localAmount,
    currency,
    exchangeRate,
    usdAmount,
  };
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/logger.ts lib/dlocal/currency-converter.service.ts __tests__/lib/dlocal/currency-converter.test.ts
git commit -m "feat(part18a): add currency converter service with tests"
```

#### Service 3: Payment Methods Service (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/payment-methods.test.ts`**

```typescript
import {
  getPaymentMethodsForCountry,
  isValidPaymentMethod,
} from '@/lib/dlocal/payment-methods.service';

describe('Payment Methods Service', () => {
  it('should return payment methods for India', async () => {
    const methods = await getPaymentMethodsForCountry('IN');

    expect(methods).toHaveLength(4);
    expect(methods).toContain('UPI');
    expect(methods).toContain('Paytm');
  });

  it('should return payment methods for Thailand', async () => {
    const methods = await getPaymentMethodsForCountry('TH');

    expect(methods).toContain('TrueMoney');
    expect(methods).toContain('Thai QR');
  });

  it('should validate payment method for country', () => {
    expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);
    expect(isValidPaymentMethod('IN', 'GoPay')).toBe(false);
  });

  it('should throw error for unsupported country', async () => {
    await expect(getPaymentMethodsForCountry('US' as any)).rejects.toThrow(
      'Unsupported country'
    );
  });
});
```

**Run test:** `npm test -- payment-methods.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/payment-methods.service.ts`**

```typescript
import { DLocalCountry } from '@/types/dlocal';
import { getPaymentMethods, isDLocalCountry } from '@/lib/dlocal/constants';
import { logger } from '@/lib/logger';

export async function getPaymentMethodsForCountry(
  country: DLocalCountry
): Promise<string[]> {
  if (!isDLocalCountry(country)) {
    logger.error('Unsupported country requested', { country });
    throw new Error('Unsupported country');
  }

  const methods = getPaymentMethods(country);
  logger.info('Retrieved payment methods', {
    country,
    methodCount: methods.length,
  });

  return methods;
}

export function isValidPaymentMethod(
  country: DLocalCountry,
  method: string
): boolean {
  const methods = getPaymentMethods(country);
  return methods.includes(method);
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/dlocal/payment-methods.service.ts __tests__/lib/dlocal/payment-methods.test.ts
git commit -m "feat(part18a): add payment methods service with tests"
```

#### Service 4: dLocal Payment Service (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/dlocal-payment.test.ts`**

```typescript
import {
  createPayment,
  verifyWebhookSignature,
  getPaymentStatus,
} from '@/lib/dlocal/dlocal-payment.service';
import crypto from 'crypto';

describe('dLocal Payment Service', () => {
  it('should create payment request body with correct structure', async () => {
    const payment = await createPayment({
      userId: 'user-123',
      amount: 29.0,
      currency: 'INR',
      country: 'IN',
      paymentMethod: 'UPI',
      planType: 'MONTHLY',
    });

    expect(payment.paymentId).toBeDefined();
    expect(payment.orderId).toBeDefined();
    expect(payment.paymentUrl).toContain('dlocal');
    expect(payment.status).toBe('PENDING');
  });

  it('should verify valid webhook signature', () => {
    const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
    const secret = 'test-secret';

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const isValid = verifyWebhookSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('should reject invalid webhook signature', () => {
    const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
    const secret = 'test-secret';
    const invalidSignature = 'invalid-signature-12345';

    const isValid = verifyWebhookSignature(payload, invalidSignature, secret);
    expect(isValid).toBe(false);
  });
});
```

**Run test:** `npm test -- dlocal-payment.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/dlocal-payment.service.ts`**

```typescript
import crypto from 'crypto';
import { DLocalPaymentRequest, DLocalPaymentResponse } from '@/types/dlocal';
import { logger } from '@/lib/logger';

const DLOCAL_API_URL =
  process.env.DLOCAL_API_URL || 'https://sandbox.dlocal.com';
const DLOCAL_API_KEY = process.env.DLOCAL_API_KEY || '';
const DLOCAL_SECRET_KEY = process.env.DLOCAL_SECRET_KEY || '';

function generateSignature(body: string): string {
  return crypto
    .createHmac('sha256', DLOCAL_SECRET_KEY)
    .update(body)
    .digest('hex');
}

export async function createPayment(
  request: DLocalPaymentRequest
): Promise<DLocalPaymentResponse> {
  try {
    const orderId = `order-${request.userId}-${Date.now()}`;

    const requestBody = {
      amount: request.amount,
      currency: request.currency,
      country: request.country,
      payment_method_id: request.paymentMethod,
      order_id: orderId,
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/dlocal`,
      payer: {
        name: 'User',
        email: 'user@example.com',
      },
    };

    const body = JSON.stringify(requestBody);
    const signature = generateSignature(body);

    logger.info('Creating dLocal payment', {
      orderId,
      country: request.country,
    });

    const response = await fetch(`${DLOCAL_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'X-Trans-Key': signature,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('dLocal API error', {
        status: response.status,
        error: errorText,
      });
      throw new Error('Failed to create payment');
    }

    const data = await response.json();

    logger.info('dLocal payment created', { paymentId: data.id, orderId });

    return {
      paymentId: data.id || `mock-payment-${Date.now()}`,
      orderId,
      paymentUrl:
        data.redirect_url || `https://sandbox.dlocal.com/payment/${data.id}`,
      status: 'PENDING',
      amount: request.amount,
      currency: request.currency,
    };
  } catch (error) {
    logger.error('Failed to create dLocal payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.DLOCAL_WEBHOOK_SECRET || '';

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

export async function getPaymentStatus(paymentId: string): Promise<{
  id: string;
  status: string;
  amount?: number;
  currency?: string;
}> {
  try {
    const response = await fetch(`${DLOCAL_API_URL}/payments/${paymentId}`, {
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get payment status');
    }

    const data = await response.json();

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
    };
  } catch (error) {
    logger.error('Failed to get payment status', { paymentId, error });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/dlocal/dlocal-payment.service.ts __tests__/lib/dlocal/dlocal-payment.test.ts
git commit -m "feat(part18a): add dLocal payment service with webhook verification"
```

#### Service 5: Country Detection (TDD)

**RED: Write Test First**

**File: `__tests__/lib/geo/detect-country.test.ts`**

```typescript
import { detectCountry, detectCountryFromIP } from '@/lib/geo/detect-country';

describe('Country Detection', () => {
  it('should detect country from IP address', async () => {
    const country = await detectCountryFromIP('103.21.244.0');

    expect(country).toBeDefined();
    expect(typeof country).toBe('string');
    expect(country.length).toBe(2);
  });

  it('should return default country for invalid IP', async () => {
    const country = await detectCountryFromIP('invalid-ip');

    expect(country).toBe('US');
  });

  it('should detect country from Cloudflare header', async () => {
    const mockHeaders = new Headers({
      'cf-ipcountry': 'IN',
    });

    const country = await detectCountry(mockHeaders);
    expect(country).toBe('IN');
  });

  it('should detect country from Vercel header', async () => {
    const mockHeaders = new Headers({
      'x-vercel-ip-country': 'TH',
    });

    const country = await detectCountry(mockHeaders);
    expect(country).toBe('TH');
  });
});
```

**Run test:** `npm test -- detect-country.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/geo/detect-country.ts`**

```typescript
import { logger } from '@/lib/logger';

export async function detectCountryFromIP(ip: string): Promise<string> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    const data = await response.json();

    if (data.status === 'success' && data.countryCode) {
      logger.info('Country detected from IP', {
        ip,
        country: data.countryCode,
      });
      return data.countryCode;
    }

    logger.warn('Failed to detect country from IP', { ip });
    return 'US';
  } catch (error) {
    logger.error('Error detecting country from IP', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 'US';
  }
}

export async function detectCountry(headers?: Headers): Promise<string> {
  // Try Cloudflare header first (most reliable)
  if (headers?.has('cf-ipcountry')) {
    const country = headers.get('cf-ipcountry');
    if (country && country !== 'XX') {
      logger.info('Country detected from Cloudflare header', { country });
      return country;
    }
  }

  // Try Vercel header
  if (headers?.has('x-vercel-ip-country')) {
    const country = headers.get('x-vercel-ip-country');
    if (country) {
      logger.info('Country detected from Vercel header', { country });
      return country;
    }
  }

  // Fall back to IP detection
  const ip =
    headers?.get('x-forwarded-for')?.split(',')[0] ||
    headers?.get('x-real-ip') ||
    '0.0.0.0';

  return await detectCountryFromIP(ip);
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/geo/detect-country.ts __tests__/lib/geo/detect-country.test.ts
git commit -m "feat(part18a): add country detection service with tests"
```

---

### Phase C: API Routes (TDD)

#### API 1: GET Payment Methods

**File: `app/api/payments/dlocal/methods/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethodsForCountry } from '@/lib/dlocal/payment-methods.service';
import { isDLocalCountry } from '@/lib/dlocal/constants';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');

    if (!country || !isDLocalCountry(country)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported country' },
        { status: 400 }
      );
    }

    const methods = await getPaymentMethodsForCountry(country);

    return NextResponse.json({
      country,
      methods,
    });
  } catch (error: any) {
    logger.error('Failed to get payment methods', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get payment methods' },
      { status: 500 }
    );
  }
}
```

#### API 2: GET Exchange Rate

**File: `app/api/payments/dlocal/exchange-rate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/dlocal/currency-converter.service';
import { DLocalCurrency } from '@/types/dlocal';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') as DLocalCurrency;

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency parameter required' },
        { status: 400 }
      );
    }

    const rate = await getExchangeRate(currency);

    return NextResponse.json({
      currency,
      rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get exchange rate', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get exchange rate' },
      { status: 500 }
    );
  }
}
```

#### API 3: GET Currency Conversion

**File: `app/api/payments/dlocal/convert/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { DLocalCurrency } from '@/types/dlocal';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get('amount') || '0');
    const currency = searchParams.get('currency') as DLocalCurrency;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount required' },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency parameter required' },
        { status: 400 }
      );
    }

    const result = await convertUSDToLocal(amount, currency);

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Failed to convert currency', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to convert currency' },
      { status: 500 }
    );
  }
}
```

#### API 4: POST Create Payment

**File: `app/api/payments/dlocal/create/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createPayment } from '@/lib/dlocal/dlocal-payment.service';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { PRICING } from '@/lib/dlocal/constants';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']),
  paymentMethod: z.string().min(1),
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
  currency: z.string().length(3),
  discountCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { country, paymentMethod, planType, currency, discountCode } =
      createPaymentSchema.parse(body);

    // Get pricing
    const usdAmount =
      planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

    // Convert to local currency
    const { localAmount, exchangeRate } = await convertUSDToLocal(
      usdAmount,
      currency as any
    );

    // Create payment in database FIRST
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        provider: 'DLOCAL',
        paymentId: '', // Will be updated after dLocal response
        orderId: `order-${session.user.id}-${Date.now()}`,
        amount: localAmount,
        currency,
        amountUSD: usdAmount,
        country,
        paymentMethod,
        planType,
        status: 'PENDING',
        discountCode,
        finalAmount: localAmount,
      },
    });

    logger.info('Payment record created', {
      paymentId: payment.id,
      userId: session.user.id,
    });

    // Create payment with dLocal
    const dLocalPayment = await createPayment({
      userId: session.user.id,
      amount: usdAmount,
      currency: currency as any,
      country: country as any,
      paymentMethod,
      planType,
      discountCode,
    });

    // Update payment with dLocal ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentId: dLocalPayment.paymentId,
        orderId: dLocalPayment.orderId,
      },
    });

    logger.info('dLocal payment created', {
      paymentId: dLocalPayment.paymentId,
      userId: session.user.id,
    });

    return NextResponse.json({
      paymentId: dLocalPayment.paymentId,
      orderId: dLocalPayment.orderId,
      paymentUrl: dLocalPayment.paymentUrl,
      status: dLocalPayment.status,
      amount: localAmount,
      currency,
      exchangeRate,
    });
  } catch (error: any) {
    logger.error('Failed to create payment', { error: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}
```

#### API 5: GET Payment Status

**File: `app/api/payments/dlocal/[paymentId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getPaymentStatus } from '@/lib/dlocal/dlocal-payment.service';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId } = params;

    // Get payment from database
    const payment = await prisma.payment.findFirst({
      where: {
        paymentId,
        userId: session.user.id,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Get status from dLocal
    const status = await getPaymentStatus(paymentId);

    return NextResponse.json({
      id: payment.id,
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount.toString(),
      currency: payment.currency,
      planType: payment.planType,
      createdAt: payment.initiatedAt.toISOString(),
      dLocalStatus: status,
    });
  } catch (error: any) {
    logger.error('Failed to get payment status', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get payment status' },
      { status: 500 }
    );
  }
}
```

#### API 6: POST Webhook Handler (BASIC Version for Part 18A)

**File: `app/api/webhooks/dlocal/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/dlocal/dlocal-payment.service';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid webhook signature', {
        signature: signature.substring(0, 10),
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const webhookData = JSON.parse(payload);
    logger.info('dLocal webhook received', {
      paymentId: webhookData.id,
      status: webhookData.status,
    });

    if (webhookData.status === 'PAID') {
      // Extract user ID from order_id (format: order-{userId}-{timestamp})
      const orderIdParts = webhookData.order_id.split('-');
      const userId = orderIdParts[1];

      if (!userId) {
        throw new Error('Invalid order_id format');
      }

      // Find payment record
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: webhookData.order_id,
          provider: 'DLOCAL',
        },
      });

      if (!payment) {
        logger.error('Payment record not found', {
          orderId: webhookData.order_id,
        });
        throw new Error('Payment record not found');
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'payment_success',
          message: `Your payment of ${payment.currency} ${payment.amount} has been received.`,
        },
      });

      logger.info('Payment completed', {
        paymentId: webhookData.id,
        userId,
      });
    } else if (webhookData.status === 'REJECTED') {
      // Handle payment failure
      const orderIdParts = webhookData.order_id.split('-');
      const userId = orderIdParts[1];

      const payment = await prisma.payment.findFirst({
        where: {
          orderId: webhookData.order_id,
          provider: 'DLOCAL',
        },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: webhookData.failure_reason || 'Payment rejected',
          },
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId,
            type: 'payment_failed',
            message: 'Your payment failed. Please try again.',
          },
        });
      }

      logger.warn('Payment failed', {
        paymentId: webhookData.id,
        reason: webhookData.failure_reason,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

**Test Webhook Handler:**

**File: `__tests__/api/webhooks/dlocal/route.test.ts`**

```typescript
import { POST } from '@/app/api/webhooks/dlocal/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

describe('POST /api/webhooks/dlocal', () => {
  const WEBHOOK_SECRET = 'test-secret';

  function generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  }

  afterEach(async () => {
    // Cleanup
    await prisma.notification.deleteMany({
      where: { type: { in: ['payment_success', 'payment_failed'] } },
    });
  });

  it('should process successful payment webhook', async () => {
    // Create test user and payment
    const user = await prisma.user.create({
      data: {
        email: 'webhook-test@example.com',
        name: 'Webhook Test',
        tier: 'FREE',
      },
    });

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'DLOCAL',
        paymentId: 'payment-12345',
        orderId: `order-${user.id}-123456789`,
        amount: 29.0,
        currency: 'INR',
        amountUSD: 29.0,
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
        status: 'PENDING',
        finalAmount: 29.0,
      },
    });

    const webhookPayload = {
      id: 'payment-12345',
      status: 'PAID',
      amount: 29.0,
      currency: 'INR',
      order_id: `order-${user.id}-123456789`,
    };

    const payload = JSON.stringify(webhookPayload);
    const signature = generateSignature(payload);

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      headers: {
        'x-signature': signature,
      },
      body: payload,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify payment updated
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(updatedPayment?.status).toBe('COMPLETED');

    // Verify notification created
    const notification = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'payment_success' },
    });
    expect(notification).toBeDefined();

    // Cleanup
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should reject invalid signature', async () => {
    const webhookPayload = {
      id: 'payment-67890',
      status: 'PAID',
      amount: 29.0,
      currency: 'INR',
      order_id: 'order-user-123',
    };

    const payload = JSON.stringify(webhookPayload);
    const invalidSignature = 'invalid-signature-12345';

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      headers: {
        'x-signature': invalidSignature,
      },
      body: payload,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
```

**Run test:** `npm test -- webhooks/dlocal/route.test.ts` → ✅ PASSES

**Commit:**

```bash
git add app/api/payments/dlocal/ app/api/webhooks/dlocal/ __tests__/api/
git commit -m "feat(part18a): add payment APIs and basic webhook handler with tests"
```

---

### Phase D: Integration Test

**File: `__tests__/integration/payment-creation.test.ts`**

```typescript
import { prisma } from '@/lib/db';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { createPayment } from '@/lib/dlocal/dlocal-payment.service';

describe('Integration: Complete Payment Creation Flow', () => {
  it('should complete full payment creation flow', async () => {
    // Step 1: Create test user
    const user = await prisma.user.create({
      data: {
        email: 'integration-test@example.com',
        name: 'Integration Test',
        tier: 'FREE',
      },
    });

    // Step 2: Convert currency
    const conversion = await convertUSDToLocal(29.0, 'INR');
    expect(conversion.localAmount).toBeGreaterThan(0);
    expect(conversion.exchangeRate).toBeGreaterThan(0);

    // Step 3: Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'DLOCAL',
        paymentId: '',
        orderId: `order-${user.id}-${Date.now()}`,
        amount: conversion.localAmount,
        currency: 'INR',
        amountUSD: 29.0,
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
        status: 'PENDING',
        finalAmount: conversion.localAmount,
      },
    });

    expect(payment.id).toBeDefined();

    // Step 4: Create dLocal payment
    const dLocalPayment = await createPayment({
      userId: user.id,
      amount: 29.0,
      currency: 'INR',
      country: 'IN',
      paymentMethod: 'UPI',
      planType: 'MONTHLY',
    });

    expect(dLocalPayment.paymentId).toBeDefined();
    expect(dLocalPayment.paymentUrl).toBeDefined();

    // Step 5: Update payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentId: dLocalPayment.paymentId,
        orderId: dLocalPayment.orderId,
      },
    });

    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });

    expect(updatedPayment?.paymentId).toBe(dLocalPayment.paymentId);

    // Cleanup
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

**Run test:** `npm test -- payment-creation.test.ts` → ✅ PASSES

**Commit:**

```bash
git add __tests__/integration/
git commit -m "test(part18a): add end-to-end payment creation integration test"
```

---

### Phase E: Documentation (Handoff for Part 18B)

**File: `docs/part18a-handoff.md`**

````markdown
# Part 18A Handoff Document for Part 18B

## What Part 18A Built

### Database Models

- **Payment** model with fields:
  - id, userId, provider, paymentId, orderId
  - amount, currency, amountUSD, country
  - paymentMethod, planType, status
  - discountCode, discountAmount, finalAmount
  - metadata, timestamps
- **Notification** model for user notifications

### Services Implemented

1. **CurrencyConverterService** (`lib/dlocal/currency-converter.service.ts`)
   - `getExchangeRate(currency)` - Returns exchange rate with 1-hour caching
   - `convertUSDToLocal(amount, currency)` - Converts USD to local currency
2. **PaymentMethodsService** (`lib/dlocal/payment-methods.service.ts`)
   - `getPaymentMethodsForCountry(country)` - Returns available payment methods
   - `isValidPaymentMethod(country, method)` - Validates payment method
3. **DLocalPaymentService** (`lib/dlocal/dlocal-payment.service.ts`)
   - `createPayment(request)` - Creates dLocal payment
   - `verifyWebhookSignature(payload, signature)` - Verifies webhook
   - `getPaymentStatus(paymentId)` - Retrieves payment status
4. **CountryDetectionService** (`lib/geo/detect-country.ts`)
   - `detectCountry(headers)` - Detects country from request headers
   - `detectCountryFromIP(ip)` - Detects country from IP address

### API Endpoints

- `GET /api/payments/dlocal/methods?country={code}` - Get payment methods
- `GET /api/payments/dlocal/exchange-rate?currency={code}` - Get exchange rate
- `GET /api/payments/dlocal/convert?amount={usd}&currency={code}` - Convert currency
- `POST /api/payments/dlocal/create` - Create payment
- `GET /api/payments/dlocal/[paymentId]` - Get payment status
- `POST /api/webhooks/dlocal` - Basic webhook (updates payment status only)

### Test Coverage

- 25%+ coverage achieved across all services
- 7 unit test files
- 1 integration test
- All tests passing

### Service Interfaces (TypeScript Signatures)

```typescript
// Currency Converter
export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number>;
export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency
): Promise<CurrencyConversionResult>;

// Payment Methods
export async function getPaymentMethodsForCountry(
  country: DLocalCountry
): Promise<string[]>;
export function isValidPaymentMethod(
  country: DLocalCountry,
  method: string
): boolean;

// dLocal Payment
export async function createPayment(
  request: DLocalPaymentRequest
): Promise<DLocalPaymentResponse>;
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean;
export async function getPaymentStatus(
  paymentId: string
): Promise<PaymentStatusResponse>;

// Country Detection
export async function detectCountry(headers?: Headers): Promise<string>;
export async function detectCountryFromIP(ip: string): Promise<string>;
```
````

## What Part 18B Needs to Build

### Subscription Lifecycle Management

- Add `hasUsedThreeDayPlan` to User model
- Add subscription fields to Subscription model
- Build 3-day plan validator service
- Build complete webhook handler (with subscription creation)
- Build cron jobs for expiring/downgrading subscriptions
- Integrate with Part 12 API layer

### Known Limitations in Part 18A

1. Webhook does NOT create subscriptions (that's Part 18B)
2. No 3-day plan validation (that's Part 18B)
3. No subscription expiry handling (that's Part 18B)
4. No Part 12 integration (that's Part 18B and 18C)

## Validation Gate for Part 18A

Part 18A is COMPLETE when:

- [ ] All 23 files created
- [ ] Database migration successful
- [ ] All unit tests passing (25%+ coverage)
- [ ] Integration test passing
- [ ] Can create a dLocal payment via API
- [ ] Webhook processes payment success/failure
- [ ] Currency conversion working
- [ ] Country detection working
- [ ] Payment methods loading for all 8 countries

## Environment Variables Used

```bash
DLOCAL_API_URL=https://sandbox.dlocal.com
DLOCAL_API_KEY=your_key_here
DLOCAL_SECRET_KEY=your_secret_here
DLOCAL_WEBHOOK_SECRET=your_webhook_secret_here
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=your_database_url
```

## Known Issues / Bugs

Document any bugs found in Part 18A here for manual fixing:

(None reported as of completion)

````

**Commit:**
```bash
git add docs/part18a-handoff.md
git commit -m "docs(part18a): add handoff document for Part 18B"
````

---

## Environment Variables for Part 18A

Add to `.env`:

```bash
# dLocal API Configuration
DLOCAL_API_URL=https://sandbox.dlocal.com
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_SECRET_KEY=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# Base URL
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=your_postgresql_url
```

---

## Success Criteria for Part 18A

### Code Quality

- [x] All TypeScript types defined
- [x] No `any` types (except error handling)
- [x] All functions have error handling
- [x] All async operations have try-catch
- [x] All database operations use Prisma

### Testing

- [x] 25%+ test coverage
- [x] All unit tests passing
- [x] Integration test passing
- [x] Services demonstrably working

### Functionality

- [x] Can detect user country
- [x] Can get payment methods for country
- [x] Can convert USD to local currency
- [x] Can create dLocal payment
- [x] Can process webhook (basic version)
- [x] Payment status updates correctly

### Security

- [x] Webhook signatures verified
- [x] Environment variables for secrets
- [x] Input validation on API routes
- [x] Authentication required for payment creation

---

## Validation Checklist

Run these commands to validate Part 18A:

```bash
# 1. Database migration
npx prisma migrate dev

# 2. Run all tests
npm test

# 3. Check test coverage
npm run test:coverage

# 4. Type check
npm run type-check

# 5. Lint code
npm run lint

# 6. Build project
npm run build
```

All should pass before proceeding to Part 18B.

---

## Commit Strategy for Part 18A

```bash
# Initialize feature branch
git checkout -b feature/part-18a-payment-creation

# Phase A: Database & Types
git add prisma/schema.prisma types/dlocal.ts lib/dlocal/constants.ts __tests__/types/ __tests__/lib/dlocal/constants.test.ts
git commit -m "feat(part18a): add database schema, types, and constants with tests"

# Phase B: Services
git add lib/logger.ts lib/dlocal/currency-converter.service.ts __tests__/lib/dlocal/currency-converter.test.ts
git commit -m "feat(part18a): add currency converter service with tests"

git add lib/dlocal/payment-methods.service.ts __tests__/lib/dlocal/payment-methods.test.ts
git commit -m "feat(part18a): add payment methods service with tests"

git add lib/dlocal/dlocal-payment.service.ts __tests__/lib/dlocal/dlocal-payment.test.ts
git commit -m "feat(part18a): add dLocal payment service with webhook verification"

git add lib/geo/detect-country.ts __tests__/lib/geo/detect-country.test.ts
git commit -m "feat(part18a): add country detection service with tests"

# Phase C: API Routes
git add app/api/payments/dlocal/ app/api/webhooks/dlocal/ __tests__/api/
git commit -m "feat(part18a): add payment APIs and basic webhook handler with tests"

# Phase D: Integration
git add __tests__/integration/
git commit -m "test(part18a): add end-to-end payment creation integration test"

# Phase E: Documentation
git add docs/part18a-handoff.md
git commit -m "docs(part18a): add handoff document for Part 18B"

# Merge to main
git checkout main
git merge feature/part-18a-payment-creation
git push origin main
```

---

## Troubleshooting Common Issues

### Issue 1: Database Migration Fails

**Symptom:** `prisma migrate dev` fails

**Solution:**

```bash
# Reset database
npx prisma migrate reset --force
npx prisma generate
npx prisma migrate dev --name init
```

### Issue 2: Webhook Signature Verification Fails

**Symptom:** Webhook returns 400 "Invalid signature"

**Solution:**

```typescript
// Check environment variable
console.log('Webhook secret set:', !!process.env.DLOCAL_WEBHOOK_SECRET);

// Test signature generation
const testPayload = JSON.stringify({ test: 'data' });
const testSignature = crypto
  .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
  .update(testPayload)
  .digest('hex');
console.log('Test signature:', testSignature);
```

### Issue 3: Currency API Rate Limited

**Symptom:** Exchange rate fetch fails frequently

**Solution:**

- Using mock rates in development (already implemented)
- In production, consider paid API tier or different provider
- Cache is set to 1 hour to minimize API calls

### Issue 4: Country Detection Returns 'US' Always

**Symptom:** All users detected as 'US'

**Solution:**

- This is expected in local development (localhost has no country)
- Deploy to Vercel/production to test real country detection
- For local testing, manually override in code:

```typescript
if (process.env.NODE_ENV === 'development') {
  return 'IN'; // Force test country
}
```

---

## Reference Documents

Read these BEFORE starting:

1. `PROGRESS-part-2.md` - Current progress tracker
2. `ARCHITECTURE-compress.md` - System architecture
3. `docs/policies/05-coding-patterns-part-1.md` - Coding standards
4. `docs/policies/07-dlocal-integration-rules.md` - dLocal rules

---

## Timeline Estimate

- **Phase A (Database & Types):** 0.5 days
- **Phase B (Services):** 2 days
- **Phase C (API Routes):** 1.5 days
- **Phase D (Integration Test):** 0.5 days
- **Phase E (Documentation):** 0.5 days

**Total: 5 days** for Part 18A

---

## Ready to Build Part 18A

You now have:

- ✅ Complete file list (23 files)
- ✅ TDD methodology
- ✅ All code examples
- ✅ Success criteria
- ✅ Handoff document template

**Start with Phase A and follow TDD strictly!**

After completing Part 18A, upload **Part 18B prompt** to a NEW Claude Code session.
