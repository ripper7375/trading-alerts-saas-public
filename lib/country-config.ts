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
};

export const DEFAULT_COUNTRY: CountryConfig = SUPPORTED_COUNTRIES['gb']!;

export function getCountryByCode(code?: string): CountryConfig {
  if (!code) return DEFAULT_COUNTRY;
  const lower = code.toLowerCase();
  return SUPPORTED_COUNTRIES[lower] || DEFAULT_COUNTRY;
}
