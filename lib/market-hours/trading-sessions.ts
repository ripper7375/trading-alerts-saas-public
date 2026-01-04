/**
 * Trading Sessions Configuration
 *
 * Part 20 SQLite + PostgreSQL Architecture
 *
 * Defines trading hours for all 15 symbols based on MT5 server time.
 * MT5 server time switches between GMT+2 (standard) and GMT+3 (DST).
 *
 * DST Transitions (US-based for MT5 server):
 * - Standard Time: 1st Sunday of November at 02:00 AM US local
 * - Daylight Saving: 2nd Sunday of March at 02:00 AM US local
 *
 * @module lib/market-hours/trading-sessions
 */

// ============================================
// TYPES
// ============================================

/**
 * Trading hours configuration for a symbol
 */
export interface SymbolTradingHours {
  type: 'crypto' | 'forex' | 'index' | 'metal';
  days: string[];
  open: string; // HH:MM:SS format in MT5 server time
  close: string; // HH:MM:SS format in MT5 server time
}

// ============================================
// TRADING HOURS BY SYMBOL
// ============================================

/**
 * Trading hours configuration for all 15 symbols
 *
 * Symbol Types:
 * - Crypto: 24/7 trading
 * - Forex: Mon-Fri, 00:04 - 23:58
 * - Indices: Mon-Fri, 01:00 - 24:00
 * - Metals: Mon-Fri, 01:01 - 23:59
 */
export const SYMBOL_TRADING_HOURS: Record<string, SymbolTradingHours> = {
  // 24/7 Crypto
  BTCUSD: {
    type: 'crypto',
    days: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
    open: '00:00:00',
    close: '23:59:59',
  },
  ETHUSD: {
    type: 'crypto',
    days: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
    open: '00:00:00',
    close: '23:59:59',
  },

  // Forex (Mon-Fri, 00:04-23:58)
  EURUSD: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  USDJPY: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  AUDJPY: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  AUDUSD: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  GBPJPY: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  GBPUSD: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  NZDUSD: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  USDCAD: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },
  USDCHF: {
    type: 'forex',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '00:04:00',
    close: '23:58:00',
  },

  // Indices (Mon-Fri, 01:00-24:00)
  US30: {
    type: 'index',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:00:00',
    close: '24:00:00',
  },
  NDX100: {
    type: 'index',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:00:00',
    close: '24:00:00',
  },

  // Metals (Mon-Fri, 01:01-23:59)
  XAUUSD: {
    type: 'metal',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:01:00',
    close: '23:59:00',
  },
  XAGUSD: {
    type: 'metal',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:01:00',
    close: '23:59:00',
  },
};

// ============================================
// DST CALCULATION FUNCTIONS
// ============================================

/**
 * Check if Daylight Saving Time is active for MT5 server
 *
 * DST is active from 2nd Sunday of March to 1st Sunday of November.
 * During DST, MT5 server is GMT+3. During standard time, it's GMT+2.
 *
 * @param date - Date to check (defaults to current time)
 * @returns true if DST is active
 */
export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();

  // Find 2nd Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1)); // March 1st
  const marchFirstDay = marchFirst.getUTCDay();
  // Days until first Sunday + 7 more days for second Sunday
  const daysToSecondSunday = ((7 - marchFirstDay) % 7) + 7;
  const secondSundayMarch = new Date(
    Date.UTC(year, 2, 1 + daysToSecondSunday, 2, 0, 0)
  ); // 02:00 AM

  // Find 1st Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1)); // November 1st
  const novFirstDay = novFirst.getUTCDay();
  // Days until first Sunday
  const daysToFirstSunday = (7 - novFirstDay) % 7;
  const firstSundayNov = new Date(
    Date.UTC(year, 10, 1 + daysToFirstSunday, 2, 0, 0)
  ); // 02:00 AM

  // DST is active between March and November transitions
  return date >= secondSundayMarch && date < firstSundayNov;
}

/**
 * Get the current MT5 server UTC offset
 *
 * @param date - Date to check (defaults to current time)
 * @returns 2 for GMT+2 (standard) or 3 for GMT+3 (DST)
 */
export function getServerUTCOffset(date: Date = new Date()): 2 | 3 {
  return isDSTActive(date) ? 3 : 2;
}

// ============================================
// TIME CONVERSION FUNCTIONS
// ============================================

/**
 * Get the current MT5 server time
 *
 * @returns Date object representing current MT5 server time
 */
export function getCurrentMT5ServerTime(): Date {
  const now = new Date();
  const offset = getServerUTCOffset(now);
  return new Date(now.getTime() + offset * 60 * 60 * 1000);
}

/**
 * Convert Unix timestamp to MT5 server time
 *
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns Date object in MT5 server time
 */
export function unixToMT5ServerTime(unixTimestamp: number): Date {
  const date = new Date(unixTimestamp * 1000);
  const offset = getServerUTCOffset(date);
  return new Date(date.getTime() + offset * 60 * 60 * 1000);
}

/**
 * Convert MT5 server time to Unix timestamp
 *
 * @param mt5Date - Date in MT5 server time
 * @returns Unix timestamp in seconds
 */
export function mt5ServerTimeToUnix(mt5Date: Date): number {
  const offset = getServerUTCOffset(mt5Date);
  const utcDate = new Date(mt5Date.getTime() - offset * 60 * 60 * 1000);
  return Math.floor(utcDate.getTime() / 1000);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the symbol type (crypto, forex, index, metal)
 *
 * @param symbol - Trading symbol
 * @returns Symbol type or null if symbol not found
 */
export function getSymbolType(
  symbol: string
): 'crypto' | 'forex' | 'index' | 'metal' | null {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  return config?.type || null;
}

/**
 * Check if a symbol trades on weekends
 *
 * @param symbol - Trading symbol
 * @returns true if symbol trades on weekends (i.e., is crypto)
 */
export function tradesOnWeekends(symbol: string): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return false;
  return config.days.includes('saturday') || config.days.includes('sunday');
}
