/**
 * Market Hours Validator
 *
 * Part 20 - Phase 04: Next.js API Routes
 * Utilities for validating market open/closed status.
 *
 * @module lib/market-hours/validator
 */

import type { MarketStatus, TradingHours } from '@/lib/indicators/types';

import {
  type DayOfWeek,
  getCurrentMT5ServerTime,
  getServerTimezoneString,
  getServerUTCOffset,
  getTradingHoursConfig,
  isDSTActive,
} from './trading-sessions';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Convert day of week number to DayOfWeek string
 */
function getDayOfWeek(dayNum: number): DayOfWeek {
  const days: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return days[dayNum % 7] as DayOfWeek;
}

/**
 * Parse time string (HH:MM:SS) to total seconds from midnight
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get total seconds from midnight for a Date
 */
function getSecondsFromMidnight(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET STATUS FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if the market is currently open for a symbol
 *
 * @param symbol - Trading symbol
 * @param timestamp - Optional timestamp to check (defaults to now)
 * @returns True if market is open
 *
 * @example
 * isMarketOpen('EURUSD'); // Check if forex is open now
 * isMarketOpen('BTCUSD'); // Always true (24/7)
 */
export function isMarketOpen(symbol: string, timestamp?: Date): boolean {
  const config = getTradingHoursConfig(symbol);

  if (!config) {
    // Unknown symbol - assume closed
    return false;
  }

  // 24/7 symbols are always open
  if (config.type === '24/7') {
    return true;
  }

  // Get current server time
  const serverTime = timestamp
    ? new Date(timestamp.getTime() + getServerUTCOffset() * 3600000)
    : getCurrentMT5ServerTime();

  // Check if current day is a trading day
  const currentDay = getDayOfWeek(serverTime.getDay());
  if (!config.days.includes(currentDay)) {
    return false;
  }

  // Check if current time is within trading hours
  const currentSeconds = getSecondsFromMidnight(serverTime);
  const openSeconds = parseTimeToSeconds(config.open);
  let closeSeconds = parseTimeToSeconds(config.close);

  // Handle "24:00:00" as end of day
  if (config.close === '24:00:00') {
    closeSeconds = 24 * 3600;
  }

  return currentSeconds >= openSeconds && currentSeconds < closeSeconds;
}

/**
 * Get market status string
 *
 * @param symbol - Trading symbol
 * @returns 'OPEN' or 'CLOSED'
 */
export function getMarketStatus(symbol: string): MarketStatus {
  return isMarketOpen(symbol) ? 'OPEN' : 'CLOSED';
}

/**
 * Get next market open time for a symbol
 *
 * @param symbol - Trading symbol
 * @returns Date of next market open, or null if 24/7
 */
export function getNextMarketOpen(symbol: string): Date | null {
  const config = getTradingHoursConfig(symbol);

  if (!config || config.type === '24/7') {
    return null;
  }

  // If market is currently open, return null (already open)
  if (isMarketOpen(symbol)) {
    return null;
  }

  const serverTime = getCurrentMT5ServerTime();
  const currentDay = serverTime.getDay();
  const currentSeconds = getSecondsFromMidnight(serverTime);
  const openSeconds = parseTimeToSeconds(config.open);

  // Check if market opens later today
  const todayDayOfWeek = getDayOfWeek(currentDay);
  if (
    config.days.includes(todayDayOfWeek) &&
    currentSeconds < openSeconds
  ) {
    const nextOpen = new Date(serverTime);
    const parts = config.open.split(':').map(Number);
    nextOpen.setHours(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0);
    return nextOpen;
  }

  // Find next trading day
  let daysToAdd = 1;
  while (daysToAdd <= 7) {
    const nextDayNum = (currentDay + daysToAdd) % 7;
    const nextDayOfWeek = getDayOfWeek(nextDayNum);

    if (config.days.includes(nextDayOfWeek)) {
      const nextOpen = new Date(serverTime);
      nextOpen.setDate(nextOpen.getDate() + daysToAdd);
      const parts = config.open.split(':').map(Number);
      nextOpen.setHours(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0);
      return nextOpen;
    }

    daysToAdd++;
  }

  return null;
}

/**
 * Get trading hours info for a symbol
 *
 * @param symbol - Trading symbol
 * @returns TradingHours object for API response
 */
export function getTradingHoursForSymbol(symbol: string): TradingHours {
  const config = getTradingHoursConfig(symbol);
  const timezone = getServerTimezoneString();

  if (!config) {
    return {
      open: '00:00:00',
      close: '23:59:59',
      timezone,
      days: [],
    };
  }

  return {
    open: config.open,
    close: config.close,
    timezone,
    days: config.days,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET STATUS METADATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Market status metadata for API responses
 */
export interface MarketStatusMetadata {
  market_status: MarketStatus;
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: 2 | 3;
}

/**
 * Get complete market status metadata for a symbol
 *
 * @param symbol - Trading symbol
 * @returns Complete market status metadata
 */
export function getMarketStatusMetadata(symbol: string): MarketStatusMetadata {
  const nextOpen = getNextMarketOpen(symbol);

  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: nextOpen ? nextOpen.toISOString() : null,
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BATCH OPERATIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get market status for multiple symbols
 *
 * @param symbols - Array of trading symbols
 * @returns Map of symbol to market status
 */
export function getMultipleMarketStatuses(
  symbols: string[]
): Record<string, MarketStatus> {
  const statuses: Record<string, MarketStatus> = {};

  for (const symbol of symbols) {
    statuses[symbol] = getMarketStatus(symbol);
  }

  return statuses;
}

/**
 * Filter symbols by market status
 *
 * @param symbols - Array of trading symbols
 * @param status - Desired market status
 * @returns Array of symbols matching the status
 */
export function filterSymbolsByMarketStatus(
  symbols: string[],
  status: MarketStatus
): string[] {
  return symbols.filter((symbol) => getMarketStatus(symbol) === status);
}

/**
 * Get currently open markets
 *
 * @param symbols - Array of trading symbols
 * @returns Array of symbols with open markets
 */
export function getOpenMarkets(symbols: string[]): string[] {
  return filterSymbolsByMarketStatus(symbols, 'OPEN');
}

/**
 * Get currently closed markets
 *
 * @param symbols - Array of trading symbols
 * @returns Array of symbols with closed markets
 */
export function getClosedMarkets(symbols: string[]): string[] {
  return filterSymbolsByMarketStatus(symbols, 'CLOSED');
}
