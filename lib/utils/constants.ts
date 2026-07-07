/**
 * Application Constants
 *
 * Centralized configuration for timeframes, symbols, tier limits,
 * and other application-wide constants.
 */

import type { Tier } from '@/lib/tier-config';
export type { Tier };

/**
 * All supported timeframes (V8: M5 and M15 only, both tiers)
 */
export const TIMEFRAMES = ['M5', 'M15'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * All supported symbols (V8: XAUUSD only, both tiers)
 */
export const SYMBOLS = ['XAUUSD'] as const;
export type Symbol = (typeof SYMBOLS)[number];

/**
 * @deprecated V8: both tiers share the same symbol list. Use SYMBOLS.
 */
export const FREE_SYMBOLS = SYMBOLS;
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];

/**
 * Symbol display names
 */
export const SYMBOL_NAMES: Record<Symbol, string> = {
  XAUUSD: 'Gold (XAU/USD)',
};

/**
 * Timeframe display names
 */
export const TIMEFRAME_NAMES: Record<Timeframe, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
};

/**
 * Tier types
 */
export const TIERS = ['FREE', 'PRO'] as const satisfies readonly Tier[];

/**
 * Tier limits configuration
 */
export const TIER_LIMITS = {
  FREE: {
    symbols: SYMBOLS as readonly string[],
    timeframes: TIMEFRAMES as readonly string[],
    maxAlerts: 0, // Alerts are a PRO feature
    rateLimit: 60, // requests per hour (matches lib/tier-config.ts)
    features: {
      emailAlerts: false, // No alerts on FREE tier
      pushNotifications: false,
      multiTimeframe: false,
      drawingLineAlerts: false,
      exportData: false,
      prioritySupport: false,
      advancedCharts: false,
    },
  },
  PRO: {
    symbols: SYMBOLS as readonly string[],
    timeframes: TIMEFRAMES as readonly string[],
    maxAlerts: 100,
    rateLimit: 300, // requests per hour (matches lib/tier-config.ts)
    features: {
      emailAlerts: true,
      pushNotifications: true,
      multiTimeframe: true,
      drawingLineAlerts: true,
      exportData: true,
      prioritySupport: true,
      advancedCharts: true,
    },
  },
} as const;

/**
 * Pricing configuration (in USD)
 * PRO monthly price is configurable via NEXT_PUBLIC_PRO_PRICE_MONTHLY.
 */
export const PRICING = {
  FREE: {
    monthly: 0,
    yearly: 0,
    name: 'Free',
    description: 'For casual traders',
  },
  PRO: {
    monthly: Number(process.env['NEXT_PUBLIC_PRO_PRICE_MONTHLY'] ?? '29'),
    yearly: Number(process.env['NEXT_PUBLIC_PRO_PRICE_YEARLY'] ?? '290'),
    name: 'Pro',
    description: 'For serious traders',
  },
} as const;

/**
 * Alert condition types
 */
export const ALERT_CONDITIONS = [
  'price_above',
  'price_below',
  'price_equals',
  'price_crosses_above',
  'price_crosses_below',
] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

/**
 * Alert condition display names
 */
export const ALERT_CONDITION_NAMES: Record<AlertCondition, string> = {
  price_above: 'Price Above',
  price_below: 'Price Below',
  price_equals: 'Price Equals',
  price_crosses_above: 'Price Crosses Above',
  price_crosses_below: 'Price Crosses Below',
};

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = [
  'alert_triggered',
  'price_update',
  'system',
  'account',
  'subscription',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Theme options
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Chart types
 */
export const CHART_TYPES = ['candlestick', 'line', 'bar'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/**
 * Date format options
 */
export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayWithTime: 'MMM d, yyyy h:mm a',
  api: 'yyyy-MM-dd',
  apiWithTime: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

/**
 * API rate limit windows (in seconds)
 */
export const RATE_LIMIT_WINDOWS = {
  minute: 60,
  hour: 3600,
  day: 86400,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  price: 60, // 1 minute
  indicators: 300, // 5 minutes
  userSession: 3600, // 1 hour
  staticData: 86400, // 24 hours
} as const;

/**
 * WebSocket event types
 */
export const WS_EVENTS = {
  PRICE_UPDATE: 'price_update',
  ALERT_TRIGGERED: 'alert_triggered',
  CONNECTION_STATUS: 'connection_status',
  ERROR: 'error',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Environment variables (for reference)
 * Part 20: Updated to reflect PostgreSQL/Redis architecture
 */
export const ENV_VARS = {
  required: [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'REDIS_URL',
    'POSTGRESQL_URI',
  ],
  optional: [
    'RESEND_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ADMIN_API_KEY',
    'SENTRY_DSN',
  ],
} as const;

/**
 * Get tier limits for a given tier
 */
export function getTierLimits(tier: Tier): (typeof TIER_LIMITS)[Tier] {
  return TIER_LIMITS[tier];
}

/**
 * Check if a symbol is available for a tier
 */
export function isSymbolAvailableForTier(symbol: string, tier: Tier): boolean {
  return TIER_LIMITS[tier].symbols.includes(symbol);
}

/**
 * Get all symbols available for a tier
 */
export function getSymbolsForTier(tier: Tier): readonly string[] {
  return TIER_LIMITS[tier].symbols;
}

/**
 * Get symbol display name
 */
export function getSymbolName(symbol: Symbol): string {
  return SYMBOL_NAMES[symbol];
}

/**
 * Get timeframe display name
 */
export function getTimeframeName(timeframe: Timeframe): string {
  return TIMEFRAME_NAMES[timeframe];
}
