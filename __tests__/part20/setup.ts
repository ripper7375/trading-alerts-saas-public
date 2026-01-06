/**
 * Part 20 - Phase 07: Testing Framework Setup
 *
 * Test setup file with mocks, fixtures, and utilities for Part 20 testing.
 * Provides consistent mocking for Redis, PostgreSQL, and NextAuth sessions.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

import { jest, beforeEach, afterEach } from '@jest/globals';
import type { TimeframeData, MultiTimeframeData } from '@/lib/confluence/types';
import type { IndicatorData } from '@/lib/indicators/types';

// ============================================================================
// MOCK ENVIRONMENT VARIABLES
// ============================================================================

process.env.REDIS_URL = 'redis://localhost:6379';
process.env.POSTGRESQL_URI = 'postgresql://test:test@localhost:5432/test_trading';
process.env.NEXTAUTH_SECRET = 'test-secret-key';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.CRON_SECRET = 'test-cron-secret';

// ============================================================================
// REDIS MOCK
// ============================================================================

const mockRedisStore = new Map<string, string>();

export const mockRedis = {
  get: jest.fn(async (key: string) => {
    const value = mockRedisStore.get(key);
    return value ? JSON.parse(value) : null;
  }),
  set: jest.fn(
    async (key: string, value: unknown, _mode?: string, _ttl?: number) => {
      mockRedisStore.set(key, JSON.stringify(value));
      return 'OK';
    }
  ),
  del: jest.fn(async (key: string) => {
    const existed = mockRedisStore.has(key);
    mockRedisStore.delete(key);
    return existed ? 1 : 0;
  }),
  keys: jest.fn(async (pattern: string) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(mockRedisStore.keys()).filter((k) => regex.test(k));
  }),
  invalidatePattern: jest.fn(async (pattern: string) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;
    for (const key of mockRedisStore.keys()) {
      if (regex.test(key)) {
        mockRedisStore.delete(key);
        count++;
      }
    }
    return count;
  }),
  clear: () => mockRedisStore.clear(),
};

// Mock the redis module
jest.mock('@/lib/cache/redis', () => ({
  __esModule: true,
  get: mockRedis.get,
  set: mockRedis.set,
  del: mockRedis.del,
  keys: mockRedis.keys,
  invalidatePattern: mockRedis.invalidatePattern,
  default: mockRedis,
}));

// ============================================================================
// POSTGRESQL MOCK
// ============================================================================

export const mockQuery = jest.fn();

jest.mock('@/lib/db/postgresql', () => ({
  __esModule: true,
  query: mockQuery,
  getPool: jest.fn(() => ({
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

// ============================================================================
// NEXTAUTH SESSION MOCK
// ============================================================================

export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    tier: 'FREE' | 'PRO';
    role: string;
    isAffiliate: boolean;
  };
  expires: string;
}

let mockSessionData: MockSession | null = null;

export const mockGetServerSession = jest.fn(async () => mockSessionData);

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: mockGetServerSession,
}));

/**
 * Set mock session for tests
 */
export function setMockSession(session: MockSession | null): void {
  mockSessionData = session;
  mockGetServerSession.mockResolvedValue(session);
}

/**
 * Create a FREE tier session
 */
export function createFreeSession(): MockSession {
  return {
    user: {
      id: 'test-user-free',
      email: 'free@test.com',
      name: 'Free User',
      tier: 'FREE',
      role: 'USER',
      isAffiliate: false,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Create a PRO tier session
 */
export function createProSession(): MockSession {
  return {
    user: {
      id: 'test-user-pro',
      email: 'pro@test.com',
      name: 'Pro User',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: false,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

/**
 * Create mock OHLC data for testing
 */
export function createMockOHLC(count: number = 100): IndicatorData['ohlc'] {
  const baseTime = Math.floor(Date.now() / 1000) - count * 3600;
  return Array.from({ length: count }, (_, i) => ({
    time: baseTime + i * 3600,
    open: 1.0 + Math.random() * 0.01,
    high: 1.01 + Math.random() * 0.01,
    low: 0.99 + Math.random() * 0.01,
    close: 1.0 + Math.random() * 0.01,
  }));
}

/**
 * Create mock indicator data for testing
 */
export function createMockIndicatorData(
  overrides: Partial<IndicatorData> = {}
): IndicatorData {
  return {
    ohlc: createMockOHLC(100),
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: { support: [], resistance: [] },
    diagonal_trendlines: { support: [], resistance: [] },
    momentum_candles: [],
    keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
    tema: Array(100).fill(1.0),
    hrma: Array(100).fill(1.0),
    smma: Array(100).fill(1.0),
    zigzag: { points: [] },
    ...overrides,
  };
}

/**
 * Create mock timeframe data for confluence testing
 */
export function createMockTimeframeData(
  overrides: Partial<TimeframeData> = {}
): TimeframeData {
  return {
    ohlc: {
      time: Math.floor(Date.now() / 1000),
      open: 1.08,
      high: 1.085,
      low: 1.075,
      close: 1.082,
    },
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: null,
    diagonal_trendlines: null,
    momentum_candles: [],
    keltner_channels: {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [1.09],
      upper_middle: [1.085],
      lower_middle: [1.075],
      lower: [1.07],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: 1.08,
    hrma: 1.079,
    smma: 1.081,
    zigzag: {
      peaks: [
        { index: 10, price: 1.09, time: Date.now() - 10000 },
        { index: 20, price: 1.085, time: Date.now() - 20000 },
      ],
      bottoms: [
        { index: 15, price: 1.07, time: Date.now() - 15000 },
        { index: 25, price: 1.072, time: Date.now() - 25000 },
      ],
    },
    ...overrides,
  };
}

/**
 * Create mock multi-timeframe data for confluence testing
 */
export function createMockMultiTimeframeData(
  overrides: Partial<MultiTimeframeData> = {}
): MultiTimeframeData {
  return {
    M5: createMockTimeframeData(),
    M15: createMockTimeframeData(),
    M30: createMockTimeframeData(),
    H1: createMockTimeframeData(),
    H2: createMockTimeframeData(),
    H4: createMockTimeframeData(),
    H8: createMockTimeframeData(),
    H12: createMockTimeframeData(),
    D1: createMockTimeframeData(),
    ...overrides,
  };
}

/**
 * Create database row data for testing
 */
export function createMockDbRow(timestamp: number = Date.now()) {
  return {
    timestamp: new Date(timestamp),
    open: 1.08,
    high: 1.085,
    low: 1.075,
    close: 1.082,
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: { support: [], resistance: [] },
    diagonal_trendlines: { support: [], resistance: [] },
    momentum_candles: [],
    keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
    tema: 1.08,
    hrma: 1.079,
    smma: 1.081,
    zigzag: { points: [] },
  };
}

// ============================================================================
// TIMEFRAME FILTER TEST DATA
// ============================================================================

/**
 * Create mock SQLite rows for timeframe filtering tests
 */
export function createTimeframeTestRows() {
  // Create rows at specific timestamps for testing different timeframes
  const baseDate = new Date('2026-01-06T00:00:00Z');
  const rows = [];

  // Generate rows every 5 minutes for 2 hours
  for (let i = 0; i < 24; i++) {
    const timestamp = Math.floor(baseDate.getTime() / 1000) + i * 5 * 60;
    rows.push({
      timestamp,
      open: 1.0 + i * 0.001,
      high: 1.01 + i * 0.001,
      low: 0.99 + i * 0.001,
      close: 1.005 + i * 0.001,
      fractals: null,
      horizontal_trendlines: null,
      diagonal_trendlines: null,
      momentum_candles: null,
      keltner_channels: null,
      tema: 1.0,
      hrma: 1.0,
      smma: 1.0,
      zigzag: null,
    });
  }

  return rows;
}

// ============================================================================
// SETUP / TEARDOWN HELPERS
// ============================================================================

/**
 * Reset all mocks before each test
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  mockRedis.clear();
  mockSessionData = null;
  mockQuery.mockReset();
}

/**
 * Setup before each test
 */
beforeEach(() => {
  resetAllMocks();
});

/**
 * Cleanup after each test
 */
afterEach(() => {
  jest.restoreAllMocks();
});
