# dLocal Payment Integration - Development Specification

## Project Overview

Build a unified payment checkout system integrating dLocal payment gateway alongside the existing Stripe integration. This enables SaaS subscription payments for customers in emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) who don't have international credit cards.

---

## 1. Core Requirements

### 1.1 Unified Checkout Page

- **Single checkout page** displaying both Stripe and dLocal payment methods
- All payment options visible in one place - no country-specific separate pages
- Dynamic rendering based on detected/selected country
- Seamless integration with existing Stripe checkout

### 1.2 Supported Countries & Currencies

| Country      | Code | Currency | Symbol | Example Amount |
| ------------ | ---- | -------- | ------ | -------------- |
| India        | IN   | INR      | ₹      | ₹4,200         |
| Nigeria      | NG   | NGN      | ₦      | ₦75,000        |
| Pakistan     | PK   | PKR      | Rs     | Rs14,000       |
| Vietnam      | VN   | VND      | ₫      | ₫1,200,000     |
| Indonesia    | ID   | IDR      | Rp     | Rp750,000      |
| Thailand     | TH   | THB      | ฿      | ฿1,750         |
| South Africa | ZA   | ZAR      | R      | R900           |
| Turkey       | TR   | TRY      | ₺      | ₺1,700         |

**Base Currency**: USD (all SaaS pricing in USD, converted to local currency for display)

---

## 2. Country Detection System

### 2.1 Detection Flow

```
1. Page Load → Attempt IP-based geolocation
2. Display detected country with confidence indicator
3. Provide manual country selector as override
4. Store user's country preference in localStorage
5. Use stored preference on subsequent visits
```

### 2.2 Implementation Requirements

**IP Geolocation API Options** (choose one):

- `ipapi.co` - Free tier: 30,000 requests/month
- `ip-api.com` - Free: 45 requests/minute
- `geojs.io` - Free, no rate limit

**Fallback Strategy**:

```javascript
async function detectCountry() {
  try {
    // 1. Check localStorage for saved preference
    const savedCountry = localStorage.getItem('user_country');
    if (savedCountry && SUPPORTED_COUNTRIES.includes(savedCountry)) {
      return savedCountry;
    }

    // 2. Try IP geolocation
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    if (SUPPORTED_COUNTRIES.includes(data.country_code)) {
      return data.country_code;
    }

    // 3. Fallback to browser language
    const browserLang = navigator.language; // e.g., 'en-IN', 'en-NG'
    const countryFromLang = browserLang.split('-')[1];
    if (SUPPORTED_COUNTRIES.includes(countryFromLang)) {
      return countryFromLang;
    }

    // 4. Default fallback
    return null; // Show country selector
  } catch (error) {
    console.error('Country detection failed:', error);
    return null; // Show country selector
  }
}
```

### 2.3 Country Selector UI Component

```jsx
// User sees detected country with option to change
┌─────────────────────────────────────────┐
│ 📍 Detected Location: 🇮🇳 India        │
│    Not correct? [Change Country ▼]     │
└─────────────────────────────────────────┘

// Dropdown shows all supported countries
┌─────────────────────────────────────────┐
│ Select your country:                    │
│ ○ 🇮🇳 India                             │
│ ○ 🇳🇬 Nigeria                           │
│ ○ 🇵🇰 Pakistan                          │
│ ○ 🇻🇳 Vietnam                           │
│ ○ 🇮🇩 Indonesia                         │
│ ○ 🇹🇭 Thailand                          │
│ ○ 🇿🇦 South Africa                      │
│ ○ 🇹🇷 Turkey                            │
└─────────────────────────────────────────┘
```

---

## 3. Dynamic Payment Method Loading

### 3.1 dLocal Payment Methods API

**Endpoint**: `GET https://api.dlocal.com/payment-methods?country={COUNTRY_CODE}`

**Request Headers**:

```javascript
{
  'X-Date': new Date().toISOString(),
  'X-Login': process.env.DLOCAL_API_LOGIN,
  'X-Trans-Key': process.env.DLOCAL_API_KEY,
  'X-Version': '2.1',
  'User-Agent': 'YourSaaS/1.0',
  'Authorization': generateHMACSignature() // See dLocal docs
}
```

**Expected Response Structure**:

```json
[
  {
    "id": "UP",
    "name": "UPI",
    "type": "BANK_TRANSFER",
    "flow": "REDIRECT",
    "logo": "https://static.dlocal.com/images/upi.png"
  },
  {
    "id": "PT",
    "name": "Paytm",
    "type": "WALLET",
    "flow": "REDIRECT"
  }
]
```

### 3.2 Payment Method Service Implementation

```typescript
// services/payment-methods.service.ts

interface PaymentMethod {
  id: string;
  name: string;
  type: 'WALLET' | 'BANK_TRANSFER' | 'TICKET' | 'CARD' | 'USSD';
  flow: 'REDIRECT' | 'DIRECT';
  provider: 'dlocal' | 'stripe';
  icon?: string;
  description?: string;
  processing_time?: string;
  recommended?: boolean;
  popular?: boolean;
}

class PaymentMethodsService {
  private cache = new Map<string, PaymentMethod[]>();

  async getMethodsForCountry(country: string): Promise<PaymentMethod[]> {
    // Check cache first
    if (this.cache.has(country)) {
      return this.cache.get(country)!;
    }

    const methods: PaymentMethod[] = [];

    // 1. Fetch dLocal methods if country is supported
    if (DLOCAL_COUNTRIES.includes(country)) {
      const dlocalMethods = await this.fetchDLocalMethods(country);
      methods.push(...dlocalMethods);
    }

    // 2. Always add Stripe card option
    methods.push({
      id: 'card',
      name: 'Credit/Debit Card',
      type: 'CARD',
      flow: 'DIRECT',
      provider: 'stripe',
      icon: '💳',
      description: 'Visa, Mastercard, Amex',
      processing_time: 'Instant',
      recommended: !DLOCAL_COUNTRIES.includes(country), // Recommended for non-dLocal countries
    });

    // 3. Enrich with metadata
    const enrichedMethods = this.enrichWithMetadata(methods, country);

    // 4. Cache results
    this.cache.set(country, enrichedMethods);

    return enrichedMethods;
  }

  private async fetchDLocalMethods(country: string): Promise<PaymentMethod[]> {
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
        provider: 'dlocal',
      }));
    } catch (error) {
      console.error('Failed to fetch dLocal methods:', error);
      return []; // Graceful fallback - return empty array
    }
  }

  private enrichWithMetadata(
    methods: PaymentMethod[],
    country: string
  ): PaymentMethod[] {
    return methods.map((method) => {
      const metadata = PAYMENT_METHOD_METADATA[method.id] || {};
      return { ...method, ...metadata };
    });
  }
}
```

### 3.3 Payment Method Metadata Database

```typescript
// config/payment-methods-metadata.ts

export const PAYMENT_METHOD_METADATA: Record<string, Partial<PaymentMethod>> = {
  // India
  UP: {
    icon: '📲',
    name: 'UPI',
    description: 'Pay via GPay, PhonePe, Paytm',
    processing_time: 'Instant',
    recommended: true,
    popular: true,
  },
  PT: {
    icon: '💙',
    name: 'Paytm Wallet',
    description: 'Pay with Paytm balance',
    processing_time: 'Instant',
    popular: true,
  },
  PP: {
    icon: '💜',
    name: 'PhonePe',
    description: 'PhonePe wallet payment',
    processing_time: 'Instant',
  },
  NB: {
    icon: '🏦',
    name: 'Net Banking',
    description: 'Direct bank transfer',
    processing_time: 'Instant',
  },

  // Nigeria
  BT: {
    icon: '🏦',
    name: 'Bank Transfer',
    description: 'Direct bank transfer',
    processing_time: 'Same day',
    recommended: true,
    popular: true,
  },
  USSD: {
    icon: '📞',
    name: 'USSD Payment',
    description: 'Dial USSD code to pay',
    processing_time: 'Instant',
    popular: true,
  },
  PS: {
    icon: '💰',
    name: 'Paystack',
    description: 'Pay via Paystack',
    processing_time: 'Instant',
  },
  VE: {
    icon: '💳',
    name: 'Verve Card',
    description: 'Nigerian Verve cards',
    processing_time: 'Instant',
  },

  // Pakistan
  JC: {
    icon: '🎵',
    name: 'JazzCash',
    description: 'Mobile wallet payment',
    processing_time: 'Instant',
    recommended: true,
    popular: true,
  },
  EP: {
    icon: '💚',
    name: 'Easypaisa',
    description: 'Mobile wallet payment',
    processing_time: 'Instant',
    popular: true,
  },

  // Vietnam
  VM: {
    icon: '💙',
    name: 'VNPay',
    description: 'Vietnam e-wallet',
    processing_time: 'Instant',
    recommended: true,
    popular: true,
  },
  MM: {
    icon: '💗',
    name: 'MoMo',
    description: 'MoMo wallet payment',
    processing_time: 'Instant',
    popular: true,
  },
  ZP: {
    icon: '💙',
    name: 'ZaloPay',
    description: 'Zalo wallet payment',
    processing_time: 'Instant',
  },

  // Indonesia
  GO: {
    icon: '🟢',
    name: 'GoPay',
    description: 'Gojek wallet payment',
    processing_time: 'Instant',
    recommended: true,
    popular: true,
  },
  OV: {
    icon: '🟣',
    name: 'OVO',
    description: 'OVO wallet payment',
    processing_time: 'Instant',
    popular: true,
  },
  DN: {
    icon: '💙',
    name: 'Dana',
    description: 'Dana wallet payment',
    processing_time: 'Instant',
    popular: true,
  },
  SP: {
    icon: '🛍️',
    name: 'ShopeePay',
    description: 'Shopee wallet payment',
    processing_time: 'Instant',
  },

  // Thailand
  TM: {
    icon: '💰',
    name: 'TrueMoney',
    description: 'TrueMoney wallet',
    processing_time: 'Instant',
    recommended: true,
    popular: true,
  },
  RL: {
    icon: '🐰',
    name: 'Rabbit LINE Pay',
    description: 'Pay via LINE app',
    processing_time: 'Instant',
    popular: true,
  },
  TQ: {
    icon: '📱',
    name: 'Thai QR Payment',
    description: 'Scan QR with any Thai bank app',
    processing_time: 'Instant',
  },
  BC: {
    icon: '🏪',
    name: 'Big C',
    description: 'Pay cash at Big C stores',
    processing_time: '24-48 hours',
  },

  // South Africa
  EFT: {
    icon: '🏦',
    name: 'EFT',
    description: 'Electronic Funds Transfer',
    processing_time: '1-2 days',
    recommended: true,
  },
  IEF: {
    icon: '⚡',
    name: 'Instant EFT',
    description: 'Real-time bank transfer',
    processing_time: 'Instant',
    popular: true,
  },

  // Turkey
  TR_BT: {
    icon: '🏦',
    name: 'Bank Transfer',
    description: 'Turkish bank transfer',
    processing_time: 'Same day',
    recommended: true,
  },
  TR_CARD: {
    icon: '💳',
    name: 'Local Cards',
    description: 'Turkish debit/credit cards',
    processing_time: 'Instant',
  },

  // Universal
  CARD: {
    icon: '💳',
    name: 'Credit/Debit Card',
    description: 'Visa, Mastercard, Amex',
    processing_time: 'Instant',
  },
};
```

---

## 4. Currency Conversion & Pricing Display

### 4.1 Exchange Rate API

**Endpoint**: `GET https://api.dlocal.com/exchange-rates?from=USD&to={CURRENCY}`

**Implementation**:

```typescript
// services/currency-converter.service.ts

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
}

class CurrencyConverterService {
  private cache = new Map<string, { rate: number; expires: number }>();
  private CACHE_DURATION = 3600000; // 1 hour in milliseconds

  async convertUSDToLocal(
    amountUSD: number,
    targetCurrency: string
  ): Promise<{ amount: number; rate: number }> {
    const rate = await this.getExchangeRate('USD', targetCurrency);
    const convertedAmount = Math.round(amountUSD * rate);

    return {
      amount: convertedAmount,
      rate: rate,
    };
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    const cacheKey = `${from}-${to}`;
    const cached = this.cache.get(cacheKey);

    // Return cached rate if still valid
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

      // Cache the rate
      this.cache.set(cacheKey, {
        rate: data.rate,
        expires: Date.now() + this.CACHE_DURATION,
      });

      return data.rate;
    } catch (error) {
      console.error('Exchange rate fetch failed:', error);

      // Fallback to approximate rates if API fails
      return this.getFallbackRate(from, to);
    }
  }

  private getFallbackRate(from: string, to: string): number {
    // Approximate rates (update periodically)
    const FALLBACK_RATES: Record<string, number> = {
      'USD-INR': 83,
      'USD-NGN': 1500,
      'USD-PKR': 278,
      'USD-VND': 24000,
      'USD-IDR': 15500,
      'USD-THB': 35,
      'USD-ZAR': 18,
      'USD-TRY': 34,
    };

    return FALLBACK_RATES[`${from}-${to}`] || 1;
  }

  formatCurrency(amount: number, currency: string, locale?: string): string {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
```

### 4.2 Pricing Display Component

```tsx
// components/PriceDisplay.tsx

interface PriceDisplayProps {
  baseAmountUSD: number;
  country: string;
  currency: string;
}

function PriceDisplay({ baseAmountUSD, country, currency }: PriceDisplayProps) {
  const [localAmount, setLocalAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function convertPrice() {
      setLoading(true);
      const converter = new CurrencyConverterService();
      const { amount } = await converter.convertUSDToLocal(
        baseAmountUSD,
        currency
      );
      setLocalAmount(amount);
      setLoading(false);
    }

    convertPrice();
  }, [baseAmountUSD, currency]);

  if (loading) {
    return <div className="price-skeleton">Loading price...</div>;
  }

  return (
    <div className="price-display">
      <div className="local-price">
        {new Intl.NumberFormat(getLocale(country), {
          style: 'currency',
          currency: currency,
        }).format(localAmount!)}
        <span className="frequency">/month</span>
      </div>
      <div className="usd-equivalent">Approximately ${baseAmountUSD} USD</div>
    </div>
  );
}

// Helper function
function getLocale(country: string): string {
  const localeMap: Record<string, string> = {
    IN: 'en-IN',
    NG: 'en-NG',
    PK: 'en-PK',
    VN: 'vi-VN',
    ID: 'id-ID',
    TH: 'th-TH',
    ZA: 'en-ZA',
    TR: 'tr-TR',
  };
  return localeMap[country] || 'en-US';
}
```

---

## 5. Unified Checkout Page Implementation

### 5.1 Main Checkout Component Structure

```tsx
// pages/checkout.tsx or app/checkout/page.tsx

import { useState, useEffect } from 'react';
import { CountrySelector } from '@/components/CountrySelector';
import { PriceDisplay } from '@/components/PriceDisplay';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { StripeCardForm } from '@/components/StripeCardForm';
import { PaymentButton } from '@/components/PaymentButton';

export default function CheckoutPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<
    'stripe' | 'dlocal' | null
  >(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Base price in USD
  const BASE_PRICE_USD = 50;

  // Detect country on mount
  useEffect(() => {
    async function initialize() {
      const detectedCountry = await detectCountry();
      setCountry(detectedCountry);

      if (detectedCountry) {
        const currencyInfo = COUNTRY_CURRENCY_MAP[detectedCountry];
        setCurrency(currencyInfo.currency);
      }
    }

    initialize();
  }, []);

  // Load payment methods when country changes
  useEffect(() => {
    async function loadPaymentMethods() {
      if (!country) return;

      setLoading(true);
      const service = new PaymentMethodsService();
      const methods = await service.getMethodsForCountry(country);
      setPaymentMethods(methods);

      // Auto-select recommended method
      const recommended = methods.find((m) => m.recommended);
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
      return processStripePayment();
    } else if (selectedProvider === 'dlocal') {
      return processDLocalPayment();
    }
  };

  return (
    <div className="checkout-page">
      {/* Header */}
      <div className="checkout-header">
        <h1>Subscribe to Pro Plan</h1>
      </div>

      {/* Country Selection */}
      <CountrySelector
        selectedCountry={country}
        onCountryChange={(newCountry) => {
          setCountry(newCountry);
          setCurrency(COUNTRY_CURRENCY_MAP[newCountry].currency);
        }}
      />

      {/* Price Display */}
      {country && (
        <PriceDisplay
          baseAmountUSD={BASE_PRICE_USD}
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

      {/* Stripe Card Form (only shown when card selected) */}
      {selectedProvider === 'stripe' && <StripeCardForm />}

      {/* Payment Button */}
      <PaymentButton
        provider={selectedProvider}
        methodId={selectedMethod}
        amount={BASE_PRICE_USD}
        currency={currency}
        country={country}
        onClick={handlePayment}
      />
    </div>
  );
}
```

### 5.2 Payment Method Selector Component

```tsx
// components/PaymentMethodSelector.tsx

interface PaymentMethodSelectorProps {
  methods: PaymentMethod[];
  selectedProvider: 'stripe' | 'dlocal' | null;
  selectedMethod: string | null;
  onSelect: (provider: 'stripe' | 'dlocal', methodId: string) => void;
}

export function PaymentMethodSelector({
  methods,
  selectedProvider,
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  // Group methods by category
  const grouped = groupPaymentMethods(methods);

  return (
    <div className="payment-methods">
      <h2>Select Payment Method</h2>

      {/* Recommended Methods */}
      {grouped.recommended.length > 0 && (
        <MethodGroup title="⭐ Recommended" methods={grouped.recommended}>
          {grouped.recommended.map((method) => (
            <PaymentMethodOption
              key={`${method.provider}-${method.id}`}
              method={method}
              selected={
                selectedProvider === method.provider &&
                selectedMethod === method.id
              }
              onSelect={() => onSelect(method.provider, method.id)}
            />
          ))}
        </MethodGroup>
      )}

      {/* Digital Wallets */}
      {grouped.wallets.length > 0 && (
        <MethodGroup title="💰 Digital Wallets" methods={grouped.wallets}>
          {grouped.wallets.map((method) => (
            <PaymentMethodOption
              key={`${method.provider}-${method.id}`}
              method={method}
              selected={
                selectedProvider === method.provider &&
                selectedMethod === method.id
              }
              onSelect={() => onSelect(method.provider, method.id)}
            />
          ))}
        </MethodGroup>
      )}

      {/* Bank Transfers */}
      {grouped.bankTransfers.length > 0 && (
        <MethodGroup title="🏦 Bank Transfers" methods={grouped.bankTransfers}>
          {grouped.bankTransfers.map((method) => (
            <PaymentMethodOption
              key={`${method.provider}-${method.id}`}
              method={method}
              selected={
                selectedProvider === method.provider &&
                selectedMethod === method.id
              }
              onSelect={() => onSelect(method.provider, method.id)}
            />
          ))}
        </MethodGroup>
      )}

      {/* Cards */}
      {grouped.cards.length > 0 && (
        <MethodGroup title="💳 Cards" methods={grouped.cards}>
          {grouped.cards.map((method) => (
            <PaymentMethodOption
              key={`${method.provider}-${method.id}`}
              method={method}
              selected={
                selectedProvider === method.provider &&
                selectedMethod === method.id
              }
              onSelect={() => onSelect(method.provider, method.id)}
            />
          ))}
        </MethodGroup>
      )}
    </div>
  );
}

// Individual payment method option
function PaymentMethodOption({ method, selected, onSelect }: any) {
  return (
    <div
      className={`payment-option ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="option-left">
        <span className="icon">{method.icon}</span>
        <div className="info">
          <div className="name">{method.name}</div>
          <div className="description">{method.description}</div>
        </div>
      </div>

      <div className="option-right">
        <span className="processing-time">{method.processing_time}</span>
        <span className="provider-badge">
          via {method.provider === 'stripe' ? 'Stripe' : 'dLocal'}
        </span>
        {selected && <span className="checkmark">✓</span>}
      </div>
    </div>
  );
}

// Helper function to group methods
function groupPaymentMethods(methods: PaymentMethod[]) {
  return {
    recommended: methods.filter((m) => m.recommended),
    wallets: methods.filter((m) => m.type === 'WALLET' && !m.recommended),
    bankTransfers: methods.filter(
      (m) => (m.type === 'BANK_TRANSFER' || m.type === 'USSD') && !m.recommended
    ),
    cards: methods.filter((m) => m.type === 'CARD' && !m.recommended),
    other: methods.filter((m) => m.type === 'TICKET' && !m.recommended),
  };
}
```

---

## 6. Payment Processing Implementation

### 6.1 dLocal Payment Processing

```typescript
// services/dlocal-payment.service.ts

interface DLocalPaymentRequest {
  amount: number;
  currency: string;
  country: string;
  payment_method_id: string;
  payer: {
    name: string;
    email: string;
    document?: string; // Tax ID (required for some countries)
    phone?: string;
    address?: {
      country: string;
      state: string;
      city: string;
      zip_code: string;
      street: string;
      number: string;
    };
  };
  order_id: string;
  description: string;
  notification_url: string;
  callback_url: string;
}

interface DLocalPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';
  payment_method_id: string;
  payment_method_type: string;
  payment_method_flow: 'REDIRECT' | 'DIRECT';
  redirect_url?: string;
  created_date: string;
}

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
    // HMAC-SHA256 signature generation
    // See dLocal documentation for exact implementation
    const crypto = require('crypto');

    const payload = JSON.stringify(request);
    const signature = crypto
      .createHmac('sha256', process.env.DLOCAL_API_SECRET!)
      .update(payload)
      .digest('hex');

    return `V2-HMAC-SHA256, Signature: ${signature}`;
  }
}
```

### 6.2 Frontend Payment Flow

```typescript
// Frontend payment processing logic

async function processDLocalPayment() {
  try {
    setProcessing(true);

    // Convert USD to local currency
    const converter = new CurrencyConverterService();
    const { amount: localAmount } = await converter.convertUSDToLocal(
      BASE_PRICE_USD,
      currency
    );

    // Create payment via backend API
    const response = await fetch('/api/payments/dlocal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: localAmount,
        currency: currency,
        country: country,
        payment_method_id: selectedMethod,
        payer: {
          name: userName,
          email: userEmail,
          document: userTaxId, // If available
        },
        order_id: `SUB-${userId}-${Date.now()}`,
        callback_url: `${window.location.origin}/payment/success`,
      }),
    });

    const payment = await response.json();

    // Handle different payment flows
    if (payment.payment_method_flow === 'REDIRECT') {
      // Redirect user to payment provider (TrueMoney, UPI, etc.)
      window.location.href = payment.redirect_url;
    } else if (payment.payment_method_flow === 'DIRECT') {
      // Show QR code or payment instructions
      displayPaymentInstructions(payment);
    }
  } catch (error) {
    console.error('Payment failed:', error);
    showErrorNotification('Payment failed. Please try again.');
  } finally {
    setProcessing(false);
  }
}
```

---

## 7. Backend API Endpoints

### 7.1 Payment Methods Endpoint

```typescript
// app/api/payment-methods/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethodsService } from '@/services/payment-methods.service';

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

    const service = new PaymentMethodsService();
    const methods = await service.getMethodsForCountry(country);

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

### 7.2 Create dLocal Payment Endpoint

```typescript
// app/api/payments/dlocal/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { DLocalPaymentService } from '@/services/dlocal-payment.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (
      !body.amount ||
      !body.currency ||
      !body.country ||
      !body.payment_method_id
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create payment
    const service = new DLocalPaymentService();
    const payment = await service.createPayment({
      amount: body.amount,
      currency: body.currency,
      country: body.country,
      payment_method_id: body.payment_method_id,
      payer: body.payer,
      order_id: body.order_id,
      description: 'SaaS Subscription',
      notification_url: `${process.env.API_URL}/api/webhooks/dlocal`,
      callback_url: body.callback_url,
    });

    // Store payment in database
    await savePaymentToDatabase({
      provider: 'dlocal',
      provider_payment_id: payment.id,
      user_id: body.user_id,
      amount: payment.amount,
      currency: payment.currency,
      country: body.country,
      status: payment.status,
      payment_method: body.payment_method_id,
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error('dLocal payment creation failed:', error);
    return NextResponse.json(
      { error: 'Payment creation failed' },
      { status: 500 }
    );
  }
}
```

### 7.3 Exchange Rate Endpoint

```typescript
// app/api/exchange-rate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CurrencyConverterService } from '@/services/currency-converter.service';

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

    const service = new CurrencyConverterService();
    const rate = await service.getExchangeRate('USD', to);

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

### 7.4 dLocal Webhook Endpoint

```typescript
// app/api/webhooks/dlocal/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature
    const signature = request.headers.get('x-signature');
    const isValid = verifyDLocalSignature(body, signature);

    if (!isValid) {
      console.error('Invalid dLocal webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Process webhook based on status
    if (body.status === 'PAID') {
      await handlePaymentSuccess(body);
    } else if (body.status === 'REJECTED') {
      await handlePaymentFailure(body);
    } else if (body.status === 'CANCELLED') {
      await handlePaymentCancellation(body);
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

function verifyDLocalSignature(body: any, signature: string | null): boolean {
  if (!signature) return false;

  const payload = JSON.stringify(body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

async function handlePaymentSuccess(payment: any) {
  // Update subscription status to active
  await updateSubscriptionStatus(payment.order_id, 'active');

  // Send confirmation email
  await sendPaymentConfirmationEmail(payment);

  // Log successful payment
  console.log('Payment successful:', payment.id);
}

async function handlePaymentFailure(payment: any) {
  // Update subscription status
  await updateSubscriptionStatus(payment.order_id, 'payment_failed');

  // Notify user
  await sendPaymentFailureEmail(payment);
}

async function handlePaymentCancellation(payment: any) {
  // Update subscription status
  await updateSubscriptionStatus(payment.order_id, 'cancelled');
}
```

---

## 8. Environment Variables

```env
# .env.local

# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# Stripe Configuration (existing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:3000
```

---

## 9. Database Schema

```sql
-- subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Payment provider
  payment_provider VARCHAR(20) NOT NULL, -- 'stripe' or 'dlocal'

  -- Stripe fields
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  -- dLocal fields
  dlocal_payment_id VARCHAR(255),
  dlocal_payment_method VARCHAR(50),

  -- Common fields
  status VARCHAR(20) NOT NULL, -- 'active', 'cancelled', 'past_due', 'payment_failed'
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  country VARCHAR(2) NOT NULL,

  -- Billing cycle
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_provider (payment_provider),
  INDEX idx_status (status)
);

-- payments table (transaction log)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Provider info
  provider VARCHAR(20) NOT NULL, -- 'stripe' or 'dlocal'
  provider_payment_id VARCHAR(255) NOT NULL,
  provider_status VARCHAR(50),

  -- Payment details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  country VARCHAR(2) NOT NULL,
  payment_method VARCHAR(50),

  -- Status
  status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'

  -- Timestamps
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_subscription (subscription_id),
  INDEX idx_user (user_id),
  INDEX idx_provider (provider, provider_payment_id),
  INDEX idx_status (status)
);
```

---

## 10. Error Handling & Edge Cases

### 10.1 Error Scenarios to Handle

```typescript
// Error handling patterns

// 1. Country detection fails
if (!detectedCountry) {
  // Show country selector immediately
  // Don't block the user
  return <CountrySelector required />;
}

// 2. dLocal API is down
try {
  const methods = await dlocal.getPaymentMethods(country);
} catch (error) {
  // Fallback to Stripe only
  console.error('dLocal unavailable, falling back to Stripe');
  return [stripeCardMethod];
}

// 3. Exchange rate fetch fails
try {
  const rate = await getExchangeRate('USD', currency);
} catch (error) {
  // Use fallback approximate rate
  const rate = FALLBACK_RATES[`USD-${currency}`];
  console.warn('Using fallback exchange rate:', rate);
}

// 4. Payment creation fails
try {
  const payment = await createDLocalPayment(data);
} catch (error) {
  // Show error to user with retry option
  showNotification({
    type: 'error',
    message: 'Payment failed. Please try again or use a different method.',
    action: 'Retry'
  });
}

// 5. User document/tax ID missing (required for some countries)
if (REQUIRES_DOCUMENT.includes(country) && !userDocument) {
  // Show form to collect tax ID
  return <TaxIdForm country={country} onSubmit={handleTaxIdSubmit} />;
}
```

### 10.2 Graceful Degradation

```typescript
// Fallback strategies

const PaymentMethodFallback = {
  // If dLocal fails, show Stripe
  primary: 'dlocal',
  fallback: 'stripe',

  // If both fail, show error with contact info
  ultimate: 'contact_support',
};

async function getPaymentMethods(country: string) {
  try {
    // Try dLocal first for supported countries
    if (DLOCAL_COUNTRIES.includes(country)) {
      const dlocalMethods = await fetchDLocalMethods(country);
      if (dlocalMethods.length > 0) {
        return [...dlocalMethods, stripeCardMethod];
      }
    }

    // Fallback to Stripe only
    return [stripeCardMethod];
  } catch (error) {
    console.error('All payment providers failed:', error);

    // Last resort: show contact form
    return [];
  }
}
```

---

## 11. Testing Strategy

### 11.1 Mock Data for Development

```typescript
// config/mock-data.ts

export const MOCK_PAYMENT_METHODS: Record<string, PaymentMethod[]> = {
  IN: [
    {
      id: 'UP',
      name: 'UPI',
      type: 'BANK_TRANSFER',
      provider: 'dlocal',
      icon: '📲',
      recommended: true,
    },
    {
      id: 'PT',
      name: 'Paytm',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💙',
      popular: true,
    },
    {
      id: 'PP',
      name: 'PhonePe',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💜',
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  NG: [
    {
      id: 'BT',
      name: 'Bank Transfer',
      type: 'BANK_TRANSFER',
      provider: 'dlocal',
      icon: '🏦',
      recommended: true,
    },
    {
      id: 'USSD',
      name: 'USSD Payment',
      type: 'USSD',
      provider: 'dlocal',
      icon: '📞',
      popular: true,
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  PK: [
    {
      id: 'JC',
      name: 'JazzCash',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '🎵',
      recommended: true,
    },
    {
      id: 'EP',
      name: 'Easypaisa',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💚',
      popular: true,
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  VN: [
    {
      id: 'VM',
      name: 'VNPay',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💙',
      recommended: true,
    },
    {
      id: 'MM',
      name: 'MoMo',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💗',
      popular: true,
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  ID: [
    {
      id: 'GO',
      name: 'GoPay',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '🟢',
      recommended: true,
    },
    {
      id: 'OV',
      name: 'OVO',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '🟣',
      popular: true,
    },
    { id: 'DN', name: 'Dana', type: 'WALLET', provider: 'dlocal', icon: '💙' },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  TH: [
    {
      id: 'TM',
      name: 'TrueMoney',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '💰',
      recommended: true,
    },
    {
      id: 'RL',
      name: 'Rabbit LINE Pay',
      type: 'WALLET',
      provider: 'dlocal',
      icon: '🐰',
      popular: true,
    },
    {
      id: 'TQ',
      name: 'Thai QR',
      type: 'TICKET',
      provider: 'dlocal',
      icon: '📱',
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  ZA: [
    {
      id: 'IEF',
      name: 'Instant EFT',
      type: 'BANK_TRANSFER',
      provider: 'dlocal',
      icon: '⚡',
      recommended: true,
    },
    {
      id: 'EFT',
      name: 'EFT',
      type: 'BANK_TRANSFER',
      provider: 'dlocal',
      icon: '🏦',
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
  TR: [
    {
      id: 'TR_BT',
      name: 'Bank Transfer',
      type: 'BANK_TRANSFER',
      provider: 'dlocal',
      icon: '🏦',
      recommended: true,
    },
    {
      id: 'CARD',
      name: 'Credit/Debit Card',
      type: 'CARD',
      provider: 'stripe',
      icon: '💳',
    },
  ],
};

// Use in development
const methods =
  process.env.NODE_ENV === 'development'
    ? MOCK_PAYMENT_METHODS[country]
    : await fetchRealPaymentMethods(country);
```

### 11.2 Test Cases

```typescript
// Test scenarios to implement

describe('Unified Checkout', () => {
  test('detects country from IP', async () => {
    const country = await detectCountry();
    expect(SUPPORTED_COUNTRIES).toContain(country);
  });

  test('allows manual country selection', () => {
    render(<CountrySelector />);
    fireEvent.click(screen.getByText('Change Country'));
    fireEvent.click(screen.getByText('🇮🇳 India'));
    expect(screen.getByText('India')).toBeInTheDocument();
  });

  test('loads payment methods for selected country', async () => {
    const methods = await getPaymentMethods('IN');
    expect(methods).toContainEqual(
      expect.objectContaining({ id: 'UP', name: 'UPI' })
    );
  });

  test('converts USD to local currency', async () => {
    const { amount } = await convertUSDToLocal(50, 'INR');
    expect(amount).toBeGreaterThan(4000);
  });

  test('auto-selects recommended payment method', () => {
    const methods = MOCK_PAYMENT_METHODS['IN'];
    const recommended = methods.find(m => m.recommended);
    expect(recommended?.id).toBe('UP');
  });

  test('processes dLocal payment', async () => {
    const payment = await processDLocalPayment({
      amount: 4200,
      currency: 'INR',
      country: 'IN',
      payment_method_id: 'UP'
    });
    expect(payment.status).toBe('PENDING');
    expect(payment.redirect_url).toBeTruthy();
  });

  test('falls back to Stripe when dLocal unavailable', async () => {
    // Mock dLocal API failure
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));

    const methods = await getPaymentMethods('IN');
    expect(methods).toHaveLength(1);
    expect(methods[0].provider).toBe('stripe');
  });
});
```

---

## 12. UI/UX Requirements

### 12.1 Responsive Design

```css
/* Mobile-first responsive design */

/* Mobile (< 640px) */
.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-option {
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-option.selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

/* Tablet (640px - 1024px) */
@media (min-width: 640px) {
  .payment-methods {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

/* Desktop (> 1024px) */
@media (min-width: 1024px) {
  .checkout-page {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

### 12.2 Loading States

```tsx
// Skeleton loader for payment methods
function PaymentMethodsSkeleton() {
  return (
    <div className="payment-methods-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-option">
          <div className="skeleton-icon" />
          <div className="skeleton-text">
            <div className="skeleton-title" />
            <div className="skeleton-description" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 12.3 Accessibility

```tsx
// Accessible payment option
<button
  role="radio"
  aria-checked={selected}
  aria-label={`Pay with ${method.name}. ${method.description}. Processing time: ${method.processing_time}`}
  onClick={onSelect}
  className={`payment-option ${selected ? 'selected' : ''}`}
>
  {/* Content */}
</button>
```

---

## 13. Documentation Requirements

### 13.1 README Section

Add to project README:

````markdown
## Payment Integration

This project supports payments through:

- **Stripe**: For credit/debit card payments globally
- **dLocal**: For local payment methods in 8 emerging markets

### Supported Countries

- 🇮🇳 India - UPI, Paytm, PhonePe, Net Banking
- 🇳🇬 Nigeria - Bank Transfer, USSD, Paystack
- 🇵🇰 Pakistan - JazzCash, Easypaisa
- 🇻🇳 Vietnam - VNPay, MoMo, ZaloPay
- 🇮🇩 Indonesia - GoPay, OVO, Dana, ShopeePay
- 🇹🇭 Thailand - TrueMoney, Rabbit LINE Pay, Thai QR
- 🇿🇦 South Africa - Instant EFT, EFT
- 🇹🇷 Turkey - Bank Transfer, Local Cards

### Setup

1. Get dLocal API credentials from https://dlocal.com
2. Add environment variables:
   ```env
   DLOCAL_API_LOGIN=your_login
   DLOCAL_API_KEY=your_key
   DLOCAL_API_SECRET=your_secret
   ```
````

3. Configure webhook endpoint at dLocal dashboard:
   ```
   https://yourdomain.com/api/webhooks/dlocal
   ```

### Testing

Use mock data in development:

```bash
npm run dev
```

Payment methods will load from mock data when API credentials are not provided.

````

### 13.2 Code Comments

```typescript
/**
 * Detects user's country using IP geolocation
 * Falls back to manual selection if detection fails
 *
 * @returns {Promise<string|null>} Country code (e.g., 'IN', 'NG') or null
 */
async function detectCountry(): Promise<string | null> {
  // Implementation
}

/**
 * Fetches available payment methods for a country
 * Combines dLocal methods with Stripe card option
 *
 * @param country - Two-letter country code
 * @returns {Promise<PaymentMethod[]>} Array of payment methods
 */
async function getPaymentMethods(country: string): Promise<PaymentMethod[]> {
  // Implementation
}
````

---

## 14. Priority & Milestones

### Phase 1: Core Infrastructure (Week 1)

- ✅ Country detection system
- ✅ Currency conversion service
- ✅ Payment methods API integration
- ✅ Basic checkout UI

### Phase 2: Payment Processing (Week 2)

- ✅ dLocal payment creation
- ✅ Webhook handling
- ✅ Database schema
- ✅ Error handling

### Phase 3: Polish & Testing (Week 3)

- ✅ Responsive design
- ✅ Loading states
- ✅ Error messages
- ✅ Testing with mock data

### Phase 4: Production Ready (Week 4)

- ✅ Real API integration
- ✅ Security audit
- ✅ Performance optimization
- ✅ Documentation

---

## 15. Success Criteria

### Functional Requirements

- ✅ Single checkout page displays both Stripe and dLocal options
- ✅ Country detection works with manual override
- ✅ Payment methods load dynamically from dLocal API
- ✅ Prices display in local currency with USD equivalent
- ✅ Payment processing works for all 8 countries
- ✅ Webhooks handle payment status updates
- ✅ Existing Stripe integration remains functional

### Non-Functional Requirements

- ✅ Page loads in < 3 seconds
- ✅ Payment method selection updates UI instantly
- ✅ Mobile responsive on all screen sizes
- ✅ Accessible (WCAG 2.1 AA compliant)
- ✅ Error messages are clear and actionable
- ✅ Graceful fallbacks when APIs fail

---

## 16. Questions & Clarifications

**Before starting development, please confirm:**

1. Do you have dLocal API credentials (or should I use mock data)?
2. What is your base SaaS pricing in USD?
3. Should we collect tax ID/document number from users?
4. Do you want to support recurring payments immediately or start with one-time?
5. Any specific UI/branding guidelines to follow?
6. Which framework/stack are you using? (Next.js, React, etc.)

---

## Notes

- Keep existing Stripe integration untouched
- Test with mock data first before real API integration
- Implement proper error handling at every step
- Log all payment attempts for debugging
- Security: Never expose API secrets to frontend
- Performance: Cache payment methods and exchange rates
- UX: Always show loading states during async operations

---

**Start with the checkout page UI using mock data, then integrate real APIs once the structure is solid.**
