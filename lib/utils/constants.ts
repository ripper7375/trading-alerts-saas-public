/**
 * Application Constants
 *
 * Centralized configuration for timeframes, symbols, tier limits,
 * and other application-wide constants.
 */

/**
 * All supported timeframes (7 total)
 */
export const TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * All supported symbols (10 total for PRO)
 */
export const SYMBOLS = [
  'XAUUSD', // Gold
  'EURUSD', // Euro/USD
  'GBPUSD', // Pound/USD
  'USDJPY', // USD/Yen
  'AUDUSD', // Aussie/USD
  'BTCUSD', // Bitcoin/USD
  'ETHUSD', // Ethereum/USD
  'XAGUSD', // Silver
  'NDX100', // Nasdaq 100
  'US30', // Dow Jones
] as const;
export type Symbol = (typeof SYMBOLS)[number];

/**
 * FREE tier symbols (1 only)
 */
export const FREE_SYMBOLS = ['XAUUSD'] as const;
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];

/**
 * Symbol display names
 */
export const SYMBOL_NAMES: Record<Symbol, string> = {
  XAUUSD: 'Gold (XAU/USD)',
  EURUSD: 'Euro/US Dollar',
  GBPUSD: 'British Pound/US Dollar',
  USDJPY: 'US Dollar/Japanese Yen',
  AUDUSD: 'Australian Dollar/US Dollar',
  BTCUSD: 'Bitcoin/US Dollar',
  ETHUSD: 'Ethereum/US Dollar',
  XAGUSD: 'Silver (XAG/USD)',
  NDX100: 'Nasdaq 100 Index',
  US30: 'Dow Jones Industrial Average',
};

/**
 * Timeframe display names
 */
export const TIMEFRAME_NAMES: Record<Timeframe, string> = {
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  D1: 'Daily',
};

/**
 * Tier types
 */
export const TIERS = ['FREE', 'PRO'] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Tier limits configuration
 */
export const TIER_LIMITS = {
  FREE: {
    symbols: FREE_SYMBOLS as readonly string[],
    timeframes: TIMEFRAMES as readonly string[],
    maxAlerts: 5,
    maxWatchlists: 3,
    maxWatchlistItems: 5,
    rateLimit: 100, // requests per hour
    features: {
      emailAlerts: true,
      pushNotifications: false,
      exportData: false,
      prioritySupport: false,
      advancedCharts: false,
    },
  },
  PRO: {
    symbols: SYMBOLS as readonly string[],
    timeframes: TIMEFRAMES as readonly string[],
    maxAlerts: 20,
    maxWatchlists: 10,
    maxWatchlistItems: 50,
    rateLimit: 1000, // requests per hour
    features: {
      emailAlerts: true,
      pushNotifications: true,
      exportData: true,
      prioritySupport: true,
      advancedCharts: true,
    },
  },
} as const;

/**
 * Pricing configuration (in USD)
 */
export const PRICING = {
  FREE: {
    monthly: 0,
    yearly: 0,
    name: 'Free',
    description: 'For casual traders',
  },
  PRO: {
    monthly: 29,
    yearly: 290, // ~$24/month billed annually
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
 */
export const ENV_VARS = {
  required: [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'REDIS_URL',
  ],
  optional: [
    'RESEND_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'MT5_API_URL',
    'MT5_API_KEY',
    'SENTRY_DSN',
  ],
} as const;

/**
 * Get tier limits for a given tier
 */
export function getTierLimits(tier: Tier): typeof TIER_LIMITS[Tier] {
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
