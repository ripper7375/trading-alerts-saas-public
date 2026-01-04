/**
 * Market Hours Validator
 *
 * Part 20 SQLite + PostgreSQL Architecture
 *
 * Provides functions to check market status and calculate next open times.
 * Uses MT5 server time (GMT+2 or GMT+3 depending on DST).
 *
 * @module lib/market-hours/validator
 */

import type { TradingHours } from '@/lib/indicators/types';
import {
  SYMBOL_TRADING_HOURS,
  isDSTActive,
  getServerUTCOffset,
  getCurrentMT5ServerTime,
} from './trading-sessions';

// ============================================
// CONSTANTS
// ============================================

/**
 * Day names in order (Sunday = 0)
 */
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse time string (HH:MM:SS) to components
 */
function parseTime(timeStr: string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const parts = timeStr.split(':').map(Number);
  return {
    hours: parts[0] || 0,
    minutes: parts[1] || 0,
    seconds: parts[2] || 0,
  };
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

// ============================================
// MARKET STATUS FUNCTIONS
// ============================================

/**
 * Check if market is currently open for a symbol
 *
 * @param symbol - Trading symbol to check
 * @param timestamp - Timestamp to check (defaults to now)
 * @returns true if market is open
 *
 * @example
 * ```typescript
 * isMarketOpen('BTCUSD');  // Always true (24/7 crypto)
 * isMarketOpen('EURUSD');  // Depends on current day/time
 * ```
 */
export function isMarketOpen(
  symbol: string,
  timestamp: Date = new Date()
): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return false;

  // Crypto is always open
  if (config.type === 'crypto') return true;

  // Get MT5 server time
  const offset = getServerUTCOffset(timestamp);
  const serverTime = new Date(timestamp.getTime() + offset * 60 * 60 * 1000);

  const dayIndex = serverTime.getUTCDay();
  const dayName = DAY_NAMES[dayIndex];

  // Check if today is a trading day (dayName is always defined for valid day index)
  if (!dayName || !config.days.includes(dayName)) return false;

  // Check if within trading hours
  const currentMinutes =
    serverTime.getUTCHours() * 60 + serverTime.getUTCMinutes();
  const openMinutes = timeToMinutes(config.open);
  let closeMinutes = timeToMinutes(config.close);

  // Handle "24:00:00" as end of day (1440 minutes)
  if (closeMinutes === 0 && config.close.startsWith('24')) {
    closeMinutes = 24 * 60;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get market status as a string
 *
 * @param symbol - Trading symbol
 * @returns 'OPEN' or 'CLOSED'
 */
export function getMarketStatus(symbol: string): 'OPEN' | 'CLOSED' {
  return isMarketOpen(symbol) ? 'OPEN' : 'CLOSED';
}

// ============================================
// NEXT MARKET OPEN FUNCTIONS
// ============================================

/**
 * Calculate the next market open time for a symbol
 *
 * @param symbol - Trading symbol
 * @returns Date of next market open in UTC, or null if market is open/crypto
 *
 * @example
 * ```typescript
 * getNextMarketOpen('BTCUSD');  // null (always open)
 * getNextMarketOpen('EURUSD');  // Next trading session open time
 * ```
 */
export function getNextMarketOpen(symbol: string): Date | null {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return null;

  // Crypto never closes
  if (config.type === 'crypto') return null;

  const now = new Date();
  const offset = getServerUTCOffset(now);
  const serverTime = getCurrentMT5ServerTime();

  // If market is open, return null
  if (isMarketOpen(symbol)) return null;

  // Find next trading day
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const checkDate = new Date(serverTime);
    checkDate.setUTCDate(checkDate.getUTCDate() + daysAhead);

    const dayName = DAY_NAMES[checkDate.getUTCDay()];

    if (dayName && config.days.includes(dayName)) {
      const { hours, minutes, seconds } = parseTime(config.open);
      checkDate.setUTCHours(hours, minutes, seconds, 0);

      // If same day, check if open time is in the future
      if (daysAhead === 0 && checkDate <= serverTime) {
        continue;
      }

      // Convert back to UTC
      const utcTime = new Date(checkDate.getTime() - offset * 60 * 60 * 1000);
      return utcTime;
    }
  }

  return null;
}

/**
 * Get next market close time for a symbol
 *
 * @param symbol - Trading symbol
 * @returns Date of next market close in UTC, or null if market is closed/crypto
 */
export function getNextMarketClose(symbol: string): Date | null {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return null;

  // Crypto never closes
  if (config.type === 'crypto') return null;

  // If market is closed, return null
  if (!isMarketOpen(symbol)) return null;

  const now = new Date();
  const offset = getServerUTCOffset(now);
  const serverTime = getCurrentMT5ServerTime();

  // Get today's close time
  const { hours, minutes, seconds } = parseTime(config.close);
  const closeTime = new Date(serverTime);

  // Handle "24:00:00" as midnight of next day
  if (config.close.startsWith('24')) {
    closeTime.setUTCDate(closeTime.getUTCDate() + 1);
    closeTime.setUTCHours(0, 0, 0, 0);
  } else {
    closeTime.setUTCHours(hours, minutes, seconds, 0);
  }

  // Convert back to UTC
  return new Date(closeTime.getTime() - offset * 60 * 60 * 1000);
}

// ============================================
// TRADING HOURS INFO FUNCTIONS
// ============================================

/**
 * Get trading hours configuration for a symbol
 *
 * @param symbol - Trading symbol
 * @returns TradingHours object with open, close, timezone, and days
 */
export function getTradingHoursForSymbol(symbol: string): TradingHours {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  const offset = getServerUTCOffset();

  if (!config) {
    return {
      open: '00:00:00',
      close: '23:59:59',
      timezone: `GMT+${offset}`,
      days: [],
    };
  }

  return {
    open: config.open,
    close: config.close,
    timezone: `GMT+${offset}`,
    days: config.days,
  };
}

/**
 * Get complete market metadata for API response
 *
 * @param symbol - Trading symbol
 * @returns Market status metadata object
 */
export function getMarketMetadata(symbol: string): {
  market_status: 'OPEN' | 'CLOSED';
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: 2 | 3;
} {
  const nextOpen = getNextMarketOpen(symbol);

  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: nextOpen ? nextOpen.toISOString() : null,
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}

// ============================================
// TIME UNTIL FUNCTIONS
// ============================================

/**
 * Get time until market opens in milliseconds
 *
 * @param symbol - Trading symbol
 * @returns Milliseconds until open, or 0 if open, or null if crypto
 */
export function getTimeUntilOpen(symbol: string): number | null {
  if (isMarketOpen(symbol)) return 0;

  const nextOpen = getNextMarketOpen(symbol);
  if (!nextOpen) return null;

  return nextOpen.getTime() - Date.now();
}

/**
 * Get time until market closes in milliseconds
 *
 * @param symbol - Trading symbol
 * @returns Milliseconds until close, or null if closed or crypto
 */
export function getTimeUntilClose(symbol: string): number | null {
  if (!isMarketOpen(symbol)) return null;

  const nextClose = getNextMarketClose(symbol);
  if (!nextClose) return null;

  return nextClose.getTime() - Date.now();
}

/**
 * Format duration in human-readable form
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable string like "2h 30m"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
