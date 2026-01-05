/**
 * Part 20 - Phase 04d: Trading Sessions Configuration
 *
 * Trading hours configuration for all 15 supported symbols.
 * Includes DST calculation for MT5 server time (GMT+2/GMT+3).
 *
 * @see docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml
 */

export interface SymbolTradingHours {
  type: 'crypto' | 'forex' | 'index' | 'metal';
  days: string[];
  open: string;
  close: string;
}

export const SYMBOL_TRADING_HOURS: Record<string, SymbolTradingHours> = {
  // Crypto 24/7
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
  // Forex
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
  // Indices
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
  // Metals
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

/**
 * Check if DST is active for US Eastern Time (MT5 server follows this)
 * DST starts: Second Sunday of March at 2:00 AM
 * DST ends: First Sunday of November at 2:00 AM
 */
export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();

  // Second Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const secondSundayMarch = new Date(
    Date.UTC(year, 2, 8 + ((7 - marchFirstDay) % 7))
  );

  // First Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSundayNov = new Date(
    Date.UTC(year, 10, 1 + ((7 - novFirstDay) % 7))
  );

  return date >= secondSundayMarch && date < firstSundayNov;
}

/**
 * Get the current MT5 server UTC offset
 * GMT+2 during standard time, GMT+3 during DST
 */
export function getServerUTCOffset(date: Date = new Date()): 2 | 3 {
  return isDSTActive(date) ? 3 : 2;
}

/**
 * Get the current MT5 server time
 */
export function getCurrentMT5ServerTime(): Date {
  const now = new Date();
  const offset = getServerUTCOffset(now);
  return new Date(now.getTime() + offset * 60 * 60 * 1000);
}
