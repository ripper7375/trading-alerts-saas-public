/**
 * Part 20 - Phase 04d: Market Hours Validator
 *
 * Market status utilities for checking if markets are open/closed.
 * Uses TradingHours type from Phase 04a.
 *
 * @see docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml
 */

import type { TradingHours } from '@/lib/indicators/types';

import {
  SYMBOL_TRADING_HOURS,
  isDSTActive,
  getServerUTCOffset,
} from './trading-sessions';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Convert time string (HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Check if the market is currently open for a symbol
 */
export function isMarketOpen(
  symbol: string,
  timestamp: Date = new Date()
): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return false;

  // Crypto is 24/7
  if (config.type === 'crypto') return true;

  // Convert to MT5 server time
  const offset = getServerUTCOffset(timestamp);
  const serverTime = new Date(timestamp.getTime() + offset * 60 * 60 * 1000);
  const dayIndex = serverTime.getUTCDay();
  const dayName = DAY_NAMES[dayIndex];

  // Check if today is a trading day
  if (!dayName || !config.days.includes(dayName)) return false;

  // Check if current time is within trading hours
  const currentMinutes =
    serverTime.getUTCHours() * 60 + serverTime.getUTCMinutes();
  const openMinutes = timeToMinutes(config.open);
  let closeMinutes = timeToMinutes(config.close);

  // Handle "24:00:00" close time
  if (closeMinutes === 0 && config.close.startsWith('24')) {
    closeMinutes = 24 * 60;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get market status as OPEN or CLOSED
 */
export function getMarketStatus(symbol: string): 'OPEN' | 'CLOSED' {
  return isMarketOpen(symbol) ? 'OPEN' : 'CLOSED';
}

/**
 * Get trading hours configuration for a symbol
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
 */
export function getMarketMetadata(symbol: string) {
  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: null as string | null,
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}
