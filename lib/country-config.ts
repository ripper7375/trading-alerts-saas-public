export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  language: string;
  currency: string;
  symbol: string;
  timezone: string;
  dateFormat: 'DMY' | 'MDY' | 'YMD';
  timeFormat: '12h' | '24h';
  exchangeRate: number;
}

export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
  gb: {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    language: 'en-GB',
    currency: 'GBP',
    symbol: '£',
    timezone: 'Europe/London',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 0.78,
  },
  in: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    language: 'hi',
    currency: 'INR',
    symbol: '₹',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DMY',
    timeFormat: '12h',
    exchangeRate: 83.5,
  },
  ng: {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    language: 'en-US',
    currency: 'NGN',
    symbol: '₦',
    timezone: 'Africa/Lagos',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 1500,
  },
  pk: {
    code: 'PK',
    name: 'Pakistan',
    flag: '🇵🇰',
    language: 'ur',
    currency: 'PKR',
    symbol: 'Rs',
    timezone: 'Asia/Karachi',
    dateFormat: 'DMY',
    timeFormat: '12h',
    exchangeRate: 278,
  },
  vn: {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    language: 'vi',
    currency: 'VND',
    symbol: '₫',
    timezone: 'Asia/Ho_Chi_Minh',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 25400,
  },
  id: {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    language: 'id',
    currency: 'IDR',
    symbol: 'Rp',
    timezone: 'Asia/Jakarta',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 15800,
  },
  th: {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    language: 'th',
    currency: 'THB',
    symbol: '฿',
    timezone: 'Asia/Bangkok',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 35.0,
  },
  za: {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    language: 'en-US',
    currency: 'ZAR',
    symbol: 'R',
    timezone: 'Africa/Johannesburg',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 18.5,
  },
  tr: {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    language: 'tr',
    currency: 'TRY',
    symbol: '₺',
    timezone: 'Europe/Istanbul',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 32.5,
  },
  us: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    language: 'en-US',
    currency: 'USD',
    symbol: '$',
    timezone: 'America/New_York',
    dateFormat: 'MDY',
    timeFormat: '12h',
    exchangeRate: 1.0,
  },
  eu: {
    code: 'EU',
    name: 'Eurozone',
    flag: '🇪🇺',
    language: 'de',
    currency: 'EUR',
    symbol: '€',
    timezone: 'Europe/Berlin',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 0.92,
  },
  jp: {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    language: 'ja',
    currency: 'JPY',
    symbol: '¥',
    timezone: 'Asia/Tokyo',
    dateFormat: 'YMD',
    timeFormat: '24h',
    exchangeRate: 155,
  },
  ae: {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    language: 'ar',
    currency: 'AED',
    symbol: 'AED',
    timezone: 'Asia/Dubai',
    dateFormat: 'DMY',
    timeFormat: '12h',
    exchangeRate: 3.67,
  },
  fr: {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    language: 'fr',
    currency: 'EUR',
    symbol: '€',
    timezone: 'Europe/Paris',
    dateFormat: 'DMY',
    timeFormat: '24h',
    exchangeRate: 0.92,
  },
  kr: {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    language: 'ko',
    currency: 'KRW',
    symbol: '₩',
    timezone: 'Asia/Seoul',
    dateFormat: 'YMD',
    timeFormat: '24h',
    exchangeRate: 1350,
  },
};

export const DEFAULT_COUNTRY: CountryConfig = SUPPORTED_COUNTRIES['gb']!;

export function getCountryByCode(code?: string): CountryConfig {
  if (!code) return DEFAULT_COUNTRY;
  const lower = code.toLowerCase();
  return SUPPORTED_COUNTRIES[lower] || DEFAULT_COUNTRY;
}

/**
 * Units of `currency` per 1 USD. Keyed by currency, never by country: a user
 * can pick a display currency that differs from their country (Thai language
 * with GBP), and converting with the country's rate would print a baht amount
 * behind a pound sign. Countries sharing a currency (EU and FR, both EUR)
 * carry the same rate. Only currencies of a supported country are listed, so
 * every rate comes from a country config rather than a guess.
 */
export const CURRENCY_USD_RATES: Record<string, number> = Object.fromEntries(
  Object.values(SUPPORTED_COUNTRIES).map((c) => [c.currency, c.exchangeRate])
);

/** Whether `currency` can be displayed (it has a conversion rate). */
export function isSupportedCurrency(currency?: string | null): boolean {
  return !!currency && currency.toUpperCase() in CURRENCY_USD_RATES;
}

/** Rate for a display currency; an unknown code gets no conversion (1.0). */
export function exchangeRateForCurrency(currency?: string): number {
  if (!currency) return 1.0;
  return CURRENCY_USD_RATES[currency.toUpperCase()] ?? 1.0;
}

/**
 * Converts a USD amount into the display currency and formats it. The rate
 * is derived from `currency` itself, so the figure and the symbol can never
 * disagree. A currency with no rate (one saved before it was withdrawn, such
 * as CNY) is shown as unconverted USD rather than as a USD figure behind a
 * foreign symbol. Framework-agnostic (no React/browser APIs) so it can run in
 * both `lib/context/locale-context.tsx`'s client `formatCurrency()` and Server
 * Components that resolve preferences via `getServerLocalePreferences()`.
 */
export function formatCurrencyAmount(
  amountInUSD: number,
  { currency, language }: { currency: string; language?: string }
): string {
  const displayCurrency = isSupportedCurrency(currency || 'GBP')
    ? (currency || 'GBP').toUpperCase()
    : 'USD';
  try {
    const convertedAmount =
      amountInUSD * exchangeRateForCurrency(displayCurrency);
    return new Intl.NumberFormat(language || 'en-GB', {
      style: 'currency',
      currency: displayCurrency,
      maximumFractionDigits: convertedAmount >= 1000 ? 0 : 2,
    }).format(convertedAmount);
  } catch {
    return `USD ${amountInUSD.toFixed(2)}`;
  }
}
