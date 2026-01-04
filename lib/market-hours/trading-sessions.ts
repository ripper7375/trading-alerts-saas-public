/**
 * Trading Sessions Configuration
 *
 * Part 20 - Phase 04: Next.js API Routes
 * Defines trading hours for all 15 supported symbols with DST handling.
 *
 * @module lib/market-hours/trading-sessions
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Trading session type
 */
export type SessionType = '24/7' | 'forex' | 'index' | 'metal';

/**
 * Day of week
 */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Trading hours configuration for a symbol
 */
export interface TradingHoursConfig {
  type: SessionType;
  days: DayOfWeek[];
  open: string; // HH:MM:SS format
  close: string; // HH:MM:SS format
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRADING HOURS BY SYMBOL
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All weekdays (Monday - Friday)
 */
const WEEKDAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

/**
 * All days (Monday - Sunday)
 */
const ALL_DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Trading hours configuration for all 15 symbols
 *
 * Times are in MT5 server time (GMT+2 / GMT+3 depending on DST)
 */
export const SYMBOL_TRADING_HOURS: Record<string, TradingHoursConfig> = {
  // ─────────────────────────────────────────────────────────
  // 24/7 Crypto (Trade continuously)
  // ─────────────────────────────────────────────────────────
  BTCUSD: {
    type: '24/7',
    days: ALL_DAYS,
    open: '00:00:00',
    close: '23:59:59',
  },
  ETHUSD: {
    type: '24/7',
    days: ALL_DAYS,
    open: '00:00:00',
    close: '23:59:59',
  },

  // ─────────────────────────────────────────────────────────
  // Forex Pairs (Mon-Fri, nearly 24 hours)
  // ─────────────────────────────────────────────────────────
  EURUSD: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  USDJPY: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  AUDJPY: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  AUDUSD: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  GBPJPY: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  GBPUSD: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  NZDUSD: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  USDCAD: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },
  USDCHF: {
    type: 'forex',
    days: WEEKDAYS,
    open: '00:04:00',
    close: '23:58:00',
  },

  // ─────────────────────────────────────────────────────────
  // Indices (Mon-Fri, specific hours)
  // ─────────────────────────────────────────────────────────
  US30: {
    type: 'index',
    days: WEEKDAYS,
    open: '01:00:00',
    close: '24:00:00', // Represents 00:00 next day
  },
  NDX100: {
    type: 'index',
    days: WEEKDAYS,
    open: '01:00:00',
    close: '24:00:00',
  },

  // ─────────────────────────────────────────────────────────
  // Metals (Mon-Fri, specific hours)
  // ─────────────────────────────────────────────────────────
  XAUUSD: {
    type: 'metal',
    days: WEEKDAYS,
    open: '01:01:00',
    close: '23:59:00',
  },
  XAGUSD: {
    type: 'metal',
    days: WEEKDAYS,
    open: '01:01:00',
    close: '23:59:00',
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DST (DAYLIGHT SAVING TIME) CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * DST transition dates
 *
 * MT5 server time changes between:
 * - Standard Time: GMT+2
 * - Daylight Saving Time: GMT+3
 *
 * Transitions:
 * - To DST (GMT+3): 2nd Sunday of March at 02:00 AM US local
 * - To Standard (GMT+2): 1st Sunday of November at 02:00 AM US local
 */

/**
 * Get the nth occurrence of a day in a month
 *
 * @param year - Full year
 * @param month - Month (0-11)
 * @param dayOfWeek - Day of week (0 = Sunday)
 * @param n - Which occurrence (1 = first, 2 = second, etc.)
 * @returns Date of nth occurrence
 */
function getNthDayOfMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  n: number
): Date {
  const date = new Date(year, month, 1);
  let count = 0;

  while (count < n) {
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === n) {
        return date;
      }
    }
    date.setDate(date.getDate() + 1);
  }

  return date;
}

/**
 * Get DST transition dates for a given year
 *
 * @param year - Full year
 * @returns Object with start and end DST dates
 */
export function getDSTTransitionDates(year: number): {
  dstStart: Date;
  dstEnd: Date;
} {
  // 2nd Sunday of March at 02:00 AM US Eastern (DST starts)
  const dstStart = getNthDayOfMonth(year, 2, 0, 2); // March, Sunday, 2nd
  dstStart.setHours(2, 0, 0, 0);

  // 1st Sunday of November at 02:00 AM US Eastern (DST ends)
  const dstEnd = getNthDayOfMonth(year, 10, 0, 1); // November, Sunday, 1st
  dstEnd.setHours(2, 0, 0, 0);

  return { dstStart, dstEnd };
}

/**
 * Check if DST is currently active
 *
 * @param date - Date to check (defaults to now)
 * @returns True if DST is active
 */
export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getFullYear();
  const { dstStart, dstEnd } = getDSTTransitionDates(year);

  // DST is active between start and end dates
  return date >= dstStart && date < dstEnd;
}

/**
 * Get current MT5 server UTC offset
 *
 * @returns 2 (GMT+2 standard) or 3 (GMT+3 DST)
 */
export function getServerUTCOffset(): 2 | 3 {
  return isDSTActive() ? 3 : 2;
}

/**
 * Get current MT5 server time
 *
 * @returns Date adjusted to MT5 server timezone
 */
export function getCurrentMT5ServerTime(): Date {
  const now = new Date();
  const offset = getServerUTCOffset();

  // Get UTC time and add server offset
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + offset * 3600000);
}

/**
 * Get timezone string for MT5 server
 *
 * @returns 'GMT+2' or 'GMT+3'
 */
export function getServerTimezoneString(): string {
  const offset = getServerUTCOffset();
  return `GMT+${offset}`;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER EXPORTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get trading hours config for a symbol
 *
 * @param symbol - Trading symbol
 * @returns Trading hours config or undefined if symbol not found
 */
export function getTradingHoursConfig(
  symbol: string
): TradingHoursConfig | undefined {
  return SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
}

/**
 * Get all supported symbols
 */
export function getAllSymbols(): string[] {
  return Object.keys(SYMBOL_TRADING_HOURS);
}

/**
 * Check if a symbol is 24/7 trading
 */
export function is24x7Symbol(symbol: string): boolean {
  const config = getTradingHoursConfig(symbol);
  return config?.type === '24/7';
}
