# Market Hours Utilities - Standalone Implementation

## Context

This creates market hours validation utilities for the Trading Alerts SaaS platform. These utilities are **schema-independent** and work with both the old and new database architectures.

**Purpose:**

- Determine if a symbol's market is currently open/closed
- Provide trading hours information for UI display
- Handle DST (Daylight Saving Time) for MT5 server time
- Support alert systems that respect market hours

**Integration Points:**

- NestJS API responses (market metadata)
- Worker services (data validation)
- Alert system (market hours filtering)
- Frontend (market status badges)

---

## Your Task

Create 2 files for market hours handling in the shared library folder.

---

## Files to Create

### 1. `lib/market-hours/trading-sessions.ts`

**Purpose:** Trading hours configuration for all 15 symbols

```typescript
/**
 * Trading hours configuration for symbols
 * Supports crypto (24/7), forex, indices, and metals
 */

export interface SymbolTradingHours {
  type: 'crypto' | 'forex' | 'index' | 'metal';
  days: string[]; // Day names: 'monday', 'tuesday', etc.
  open: string; // HH:MM:SS format
  close: string; // HH:MM:SS format
}

export const SYMBOL_TRADING_HOURS: Record<string, SymbolTradingHours> = {
  // ============================================
  // CRYPTO - 24/7 Trading
  // ============================================
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

  // ============================================
  // FOREX - Monday 00:04 to Friday 23:58 GMT+3
  // ============================================
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

  // ============================================
  // INDICES - Monday 01:00 to Saturday 00:00 GMT+3
  // ============================================
  US30: {
    type: 'index',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:00:00',
    close: '24:00:00', // Midnight (end of Friday)
  },
  NDX100: {
    type: 'index',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    open: '01:00:00',
    close: '24:00:00',
  },

  // ============================================
  // METALS - Monday 01:01 to Friday 23:59 GMT+3
  // ============================================
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
 * Determine if DST (Daylight Saving Time) is currently active in USA
 * DST Rules (USA):
 * - Starts: Second Sunday of March at 2:00 AM
 * - Ends: First Sunday of November at 2:00 AM
 *
 * @param date - Date to check (defaults to now)
 * @returns true if DST is active, false otherwise
 */
export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();

  // Calculate second Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1)); // Month 2 = March
  const marchFirstDay = marchFirst.getUTCDay();
  const daysUntilSunday = (7 - marchFirstDay) % 7;
  const secondSundayMarch = new Date(Date.UTC(year, 2, 8 + daysUntilSunday));

  // Calculate first Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1)); // Month 10 = November
  const novFirstDay = novFirst.getUTCDay();
  const daysUntilNovSunday = (7 - novFirstDay) % 7;
  const firstSundayNov = new Date(Date.UTC(year, 10, 1 + daysUntilNovSunday));

  // DST is active between second Sunday of March and first Sunday of November
  return date >= secondSundayMarch && date < firstSundayNov;
}

/**
 * Get the MT5 server UTC offset based on DST status
 * EightCap MT5 server time is GMT+2 (winter) or GMT+3 (summer/DST)
 *
 * @param date - Date to check (defaults to now)
 * @returns UTC offset in hours (2 or 3)
 */
export function getServerUTCOffset(date: Date = new Date()): 2 | 3 {
  return isDSTActive(date) ? 3 : 2;
}

/**
 * Get current MT5 server time (adjusted for DST)
 *
 * @returns Current MT5 server time as Date object
 */
export function getCurrentMT5ServerTime(): Date {
  const now = new Date();
  const offsetHours = getServerUTCOffset(now);
  return new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
}

/**
 * Get all available symbols
 */
export function getAllSymbols(): string[] {
  return Object.keys(SYMBOL_TRADING_HOURS);
}

/**
 * Check if a symbol exists in configuration
 */
export function isValidSymbol(symbol: string): boolean {
  return symbol.toUpperCase() in SYMBOL_TRADING_HOURS;
}
```

---

### 2. `lib/market-hours/validator.ts`

**Purpose:** Market hours validation and status utilities

```typescript
import {
  SYMBOL_TRADING_HOURS,
  isDSTActive,
  getServerUTCOffset,
} from './trading-sessions';

/**
 * Trading hours information
 */
export interface TradingHours {
  open: string; // HH:MM:SS
  close: string; // HH:MM:SS
  timezone: string; // e.g. "GMT+3"
  days: string[]; // Day names
}

/**
 * Market metadata response
 */
export interface MarketMetadata {
  market_status: 'OPEN' | 'CLOSED';
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: number;
}

/**
 * Day names indexed by JavaScript's getDay() (0 = Sunday)
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

/**
 * Convert time string (HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if market is currently open for a given symbol
 *
 * @param symbol - Symbol name (e.g., 'BTCUSD', 'EURUSD')
 * @param timestamp - Timestamp to check (defaults to now)
 * @returns true if market is open, false otherwise
 *
 * @example
 * isMarketOpen('BTCUSD') // true (crypto is 24/7)
 * isMarketOpen('EURUSD') // depends on current time
 */
export function isMarketOpen(
  symbol: string,
  timestamp: Date = new Date()
): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];

  // Unknown symbol = assume closed
  if (!config) {
    return false;
  }

  // Crypto is always open (24/7)
  if (config.type === 'crypto') {
    return true;
  }

  // Convert timestamp to MT5 server time (GMT+2 or GMT+3)
  const offsetHours = getServerUTCOffset(timestamp);
  const serverTime = new Date(
    timestamp.getTime() + offsetHours * 60 * 60 * 1000
  );

  // Get current day name
  const dayName = DAY_NAMES[serverTime.getUTCDay()];

  // Check if today is a trading day
  if (!config.days.includes(dayName)) {
    return false;
  }

  // Convert current time to minutes since midnight
  const currentMinutes =
    serverTime.getUTCHours() * 60 + serverTime.getUTCMinutes();

  // Convert open/close times to minutes
  const openMinutes = timeToMinutes(config.open);
  let closeMinutes = timeToMinutes(config.close);

  // Handle 24:00:00 (midnight) as end of day
  if (closeMinutes === 0 && config.close.startsWith('24')) {
    closeMinutes = 24 * 60;
  }

  // Check if current time is within trading hours
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get market status ('OPEN' or 'CLOSED')
 *
 * @param symbol - Symbol name
 * @param timestamp - Timestamp to check (defaults to now)
 * @returns 'OPEN' or 'CLOSED'
 */
export function getMarketStatus(
  symbol: string,
  timestamp: Date = new Date()
): 'OPEN' | 'CLOSED' {
  return isMarketOpen(symbol, timestamp) ? 'OPEN' : 'CLOSED';
}

/**
 * Get trading hours information for a symbol
 *
 * @param symbol - Symbol name
 * @returns Trading hours object
 */
export function getTradingHoursForSymbol(symbol: string): TradingHours {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  const offset = getServerUTCOffset();

  // Default to 24/7 if symbol not found
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
 * Calculate next market open time
 * (Simplified - returns null for now, can be enhanced later)
 */
function calculateNextMarketOpen(symbol: string): string | null {
  // TODO: Implement proper calculation
  // For now, return null
  return null;
}

/**
 * Get complete market metadata for a symbol
 * Useful for API responses
 *
 * @param symbol - Symbol name
 * @returns Market metadata object
 *
 * @example
 * const metadata = getMarketMetadata('EURUSD');
 * // {
 * //   market_status: 'OPEN',
 * //   trading_hours: { open: '00:04:00', close: '23:58:00', ... },
 * //   next_market_open: null,
 * //   dst_active: true,
 * //   server_utc_offset: 3
 * // }
 */
export function getMarketMetadata(symbol: string): MarketMetadata {
  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: calculateNextMarketOpen(symbol),
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}

/**
 * Filter symbols by market status
 *
 * @param symbols - Array of symbol names
 * @param status - Desired status ('OPEN' or 'CLOSED')
 * @returns Filtered array of symbols
 *
 * @example
 * const openMarkets = filterSymbolsByStatus(['BTCUSD', 'EURUSD', 'XAUUSD'], 'OPEN');
 */
export function filterSymbolsByStatus(
  symbols: string[],
  status: 'OPEN' | 'CLOSED'
): string[] {
  return symbols.filter((symbol) => getMarketStatus(symbol) === status);
}
```

---

### 3. `lib/market-hours/index.ts`

**Purpose:** Module exports

```typescript
// Re-export everything
export * from './trading-sessions';
export * from './validator';
```

---

## Integration Examples

### **Example 1: NestJS API Response**

```typescript
// apps/api-gateway/src/market-data/market-data.controller.ts

import { Controller, Get, Param, Query } from '@nestjs/common';
import { getMarketMetadata } from '@/lib/market-hours';

@Controller('api/v1/market-data')
export class MarketDataController {
  @Get(':symbol/:timeframe/latest')
  async getLatestBars(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @Query('limit') limit: number = 100
  ) {
    const bars = await this.service.getLatestBars(symbol, timeframe, limit);
    const marketInfo = getMarketMetadata(symbol);

    return {
      symbol,
      timeframe,
      ...marketInfo, // Include market status & trading hours
      data: bars,
    };
  }
}
```

### **Example 2: Worker Validation**

```typescript
// apps/worker/src/processors/market-data.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { isMarketOpen } from '@/lib/market-hours';

@Processor('market-data-sync')
export class MarketDataProcessor {
  @Process()
  async processMarketData(job: Job) {
    const { symbol } = job.data;

    // Log warning if data received when market closed
    if (!isMarketOpen(symbol)) {
      this.logger.warn(
        `Received data for ${symbol} but market is currently closed`
      );
    }

    // Continue processing regardless...
    await this.batchService.insertBatch([job.data]);
  }
}
```

### **Example 3: Alert System**

```typescript
// apps/api-gateway/src/alerts/alerts.service.ts

import { isMarketOpen } from '@/lib/market-hours';

export class AlertsService {
  async checkAndTriggerAlerts() {
    const pendingAlerts = await this.findPendingAlerts();

    for (const alert of pendingAlerts) {
      // Only trigger alerts when market is open
      if (isMarketOpen(alert.symbol)) {
        await this.triggerAlert(alert);
      } else {
        this.logger.debug(`Skipping alert for ${alert.symbol} - market closed`);
      }
    }
  }
}
```

### **Example 4: Frontend API Call**

```typescript
// Frontend: app/hooks/useMarketData.ts

const response = await fetch('/api/v1/market-data/eurusd/h1/latest');
const data = await response.json();

// Response includes market metadata:
console.log(data.market_status); // 'OPEN' or 'CLOSED'
console.log(data.trading_hours); // { open: '00:04:00', close: '23:58:00', ... }
console.log(data.dst_active); // true/false
```

---

## Testing Strategy

### **Unit Tests**

```typescript
// lib/market-hours/__tests__/validator.test.ts

import { isMarketOpen, getMarketStatus, isDSTActive } from '../validator';

describe('Market Hours Validator', () => {
  describe('Crypto (24/7)', () => {
    it('BTCUSD is always open', () => {
      expect(isMarketOpen('BTCUSD')).toBe(true);
      expect(getMarketStatus('BTCUSD')).toBe('OPEN');
    });
  });

  describe('Forex (weekdays only)', () => {
    it('detects forex market hours correctly', () => {
      // Mock a Monday at 10:00 GMT+3
      const monday10am = new Date('2026-01-19T07:00:00Z'); // 10:00 GMT+3
      expect(isMarketOpen('EURUSD', monday10am)).toBe(true);

      // Mock a Saturday
      const saturday = new Date('2026-01-24T10:00:00Z');
      expect(isMarketOpen('EURUSD', saturday)).toBe(false);
    });
  });

  describe('DST Calculation', () => {
    it('detects DST correctly', () => {
      const summer = new Date('2026-07-15T12:00:00Z'); // July (DST)
      const winter = new Date('2026-01-15T12:00:00Z'); // January (no DST)

      expect(isDSTActive(summer)).toBe(true);
      expect(isDSTActive(winter)).toBe(false);
    });
  });
});
```

---

## Success Criteria

After implementation:

- [ ] `lib/market-hours/trading-sessions.ts` created
- [ ] `lib/market-hours/validator.ts` created
- [ ] `lib/market-hours/index.ts` created
- [ ] All files compile without errors (`npx tsc --noEmit`)
- [ ] Unit tests pass (if created)
- [ ] Can import and use in NestJS services
- [ ] Can import and use in frontend (if needed)

---

## Important Notes

### **1. Schema Independence**

Market hours utilities are **completely independent** of database schema:

- Work with 14-column JSON schema ✅
- Work with 57-column flat schema ✅
- Pure business logic with no DB queries

### **2. Timezone Handling**

MT5 server time is **always GMT+2 or GMT+3** (depending on DST):

- Winter: GMT+2
- Summer (DST): GMT+3

This is EightCap broker-specific. Adjust if using different broker.

### **3. Future Enhancements**

Possible improvements:

- Calculate exact "next market open" time
- Support for holiday closures
- Support for different broker timezones
- Market open countdown timer

---

## Commit Message

```bash
git add lib/market-hours/
git commit -m "feat(market-hours): add trading hours validation utilities

- Add trading sessions config for all 15 symbols
- Add DST calculation for MT5 server time
- Add isMarketOpen and getMarketMetadata utilities
- Add market status validation for alerts
- Schema-independent implementation"
```

---

## Questions?

This implementation is **standalone** and can be completed at any time:

- ✅ Before Part 20 backend (types are self-contained)
- ✅ After Part 20 backend (integrate with existing services)
- ✅ In parallel with other work (no dependencies)

The core functionality remains the same regardless of when it's implemented! 🚀
