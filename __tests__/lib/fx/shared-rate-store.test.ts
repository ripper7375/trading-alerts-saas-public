/** @jest-environment node */
jest.unmock('@/lib/fx/shared-rate-store');
const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('@/lib/redis/client', () => ({
  getRedisClient: () => ({ get: mockGet, set: mockSet }),
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }));

import { CURRENCY_USD_RATES } from '@/lib/country-config';
import { FX_FAILURE_RETRY_MS } from '@/lib/fx/rate-contract';
import {
  FX_USD_RATES_REDIS_KEY,
  parseSharedUsdRates,
  readSharedUsdRates,
  writeSharedUsdRates,
  type SharedUsdRates,
} from '@/lib/fx/shared-rate-store';

const initialNow = Date.parse('2026-10-13T10:00:00Z');
const originalRedis = process.env['REDIS_URL'];
const record = (): SharedUsdRates => ({
  schemaVersion: 2,
  rates: { ...CURRENCY_USD_RATES },
  provider: 'currencybeacon',
  rateUpdatedAt: '2026-10-13T09:55:00.000Z',
  fetchedAt: '2026-10-13T10:00:00.000Z',
  expiresAt: '2026-10-13T11:00:00.000Z',
});
beforeEach(() => {
  jest.useFakeTimers({ now: initialNow });
  jest.clearAllMocks();
  mockGet.mockReset().mockResolvedValue(null);
  mockSet.mockReset().mockResolvedValue('OK');
  process.env['REDIS_URL'] = 'redis://test';
});
afterEach(() => {
  jest.useRealTimers();
  if (originalRedis === undefined) delete process.env['REDIS_URL'];
  else process.env['REDIS_URL'] = originalRedis;
});

it('reads a complete valid v2 table under only the versioned key', async () => {
  mockGet.mockResolvedValue(JSON.stringify(record()));
  expect(await readSharedUsdRates()).toEqual(record());
  expect(mockGet).toHaveBeenCalledWith('fx:usd_rates:v2');
});

it('preserves provider source time and the shorter primary-failure expiry when publishing', async () => {
  const table = {
    ...record(),
    provider: 'frankfurter' as const,
    rateUpdatedAt: '2026-10-12T00:00:00.000Z',
    expiresAt: new Date(initialNow + FX_FAILURE_RETRY_MS).toISOString(),
  };
  await writeSharedUsdRates(table);
  expect(mockSet).toHaveBeenCalledWith(
    FX_USD_RATES_REDIS_KEY,
    expect.any(String),
    'EX',
    900
  );
  expect(JSON.parse(mockSet.mock.calls[0]?.[1] as string)).toEqual(table);
});

it('accepts a retained record beyond its first hour while limiting its new Redis lifetime', async () => {
  const table = {
    ...record(),
    fetchedAt: '2026-10-13T08:00:00.000Z',
    rateUpdatedAt: '2026-10-13T08:00:00.000Z',
    expiresAt: '2026-10-13T10:15:00.000Z',
  };
  expect(parseSharedUsdRates(JSON.stringify(table))).toEqual(table);
  await writeSharedUsdRates(table);
  expect(mockSet.mock.calls[0]?.[3]).toBe(900);
  expect(JSON.parse(mockSet.mock.calls[0]?.[1] as string)).toEqual(table);
});

it('bounds renewed snapshots by both original fetch and CurrencyBeacon publication ages', () => {
  const table = {
    ...record(),
    fetchedAt: '2026-10-13T02:01:00.000Z',
    rateUpdatedAt: '2026-10-13T02:01:00.000Z',
    expiresAt: '2026-10-13T10:01:00.000Z',
  };
  expect(parseSharedUsdRates(JSON.stringify(table))).toEqual(table);
  expect(
    parseSharedUsdRates(
      JSON.stringify({ ...table, expiresAt: '2026-10-13T10:01:00.001Z' })
    )
  ).toBeNull();
  expect(
    parseSharedUsdRates(
      JSON.stringify({
        ...table,
        fetchedAt: '2026-10-13T02:30:00.000Z',
        expiresAt: '2026-10-13T10:20:00.000Z',
      })
    )
  ).toBeNull();
  expect(
    parseSharedUsdRates(
      JSON.stringify({
        ...table,
        provider: 'frankfurter',
        fetchedAt: '2026-10-13T01:59:59.999Z',
        rateUpdatedAt: '2026-10-12T00:00:00.000Z',
      })
    )
  ).toBeNull();
});

it.each([
  ['legacy schema', { schemaVersion: 1 }],
  ['missing version', { schemaVersion: undefined }],
  ['unknown provider', { provider: 'unknown' }],
  ['fixed provider', { provider: 'fixed', rateUpdatedAt: null }],
  ['missing source date', { rateUpdatedAt: undefined }],
  ['invalid source date', { rateUpdatedAt: '2026-02-30T10:00:00Z' }],
  ['expired source', { rateUpdatedAt: '2026-10-13T01:59:59Z' }],
  ['future source', { rateUpdatedAt: '2026-10-13T10:05:01Z' }],
  ['expired', { expiresAt: '2026-10-13T10:00:00Z' }],
  ['too-long TTL', { expiresAt: '2026-10-13T11:00:01Z' }],
  ['future fetch', { fetchedAt: '2026-10-13T10:05:01Z' }],
  [
    'source after retrieval',
    { fetchedAt: '2026-10-13T09:30:00Z', expiresAt: '2026-10-13T10:30:00Z' },
  ],
  [
    'expiry before fetch',
    { fetchedAt: '2026-10-13T10:01:00Z', expiresAt: '2026-10-13T10:00:30Z' },
  ],
  ['missing fetch', { fetchedAt: undefined }],
  ['partial rates', { rates: { USD: 1, GBP: 0.8 } }],
  ['nonidentity USD', { rates: { ...CURRENCY_USD_RATES, USD: 2 } }],
  ['infinite rate', { rates: { ...CURRENCY_USD_RATES, GBP: Infinity } }],
])('treats %s as a miss and refuses publication', async (_label, change) => {
  const data = { ...record(), ...change };
  expect(parseSharedUsdRates(JSON.stringify(data))).toBeNull();
  await writeSharedUsdRates(data as SharedUsdRates);
  expect(mockSet).not.toHaveBeenCalled();
});

it('accepts a seven-day daily source, rejects an older one, and rejects a future expiry despite clock skew', () => {
  expect(
    parseSharedUsdRates(
      JSON.stringify({
        ...record(),
        provider: 'frankfurter',
        rateUpdatedAt: '2026-10-06T10:00:00Z',
      })
    )
  ).not.toBeNull();
  expect(
    parseSharedUsdRates(
      JSON.stringify({
        ...record(),
        provider: 'frankfurter',
        rateUpdatedAt: '2026-10-06T09:59:59Z',
      })
    )
  ).toBeNull();
  expect(
    parseSharedUsdRates(
      JSON.stringify({
        ...record(),
        fetchedAt: '2026-10-13T10:01:00Z',
        expiresAt: '2026-10-13T11:01:00Z',
      })
    )
  ).toBeNull();
});

it('ignores malformed JSON and primitive values', () => {
  for (const raw of [null, '', 'invalid', 'null', '42', '[]'])
    expect(parseSharedUsdRates(raw)).toBeNull();
});

it('without Redis configuration does not construct a client', async () => {
  delete process.env['REDIS_URL'];
  expect(await readSharedUsdRates()).toBeNull();
  await writeSharedUsdRates(record());
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
});

it('bounds a stalled Redis read and write to 500 milliseconds', async () => {
  mockGet.mockImplementation(() => new Promise(() => {}));
  const read = readSharedUsdRates();
  await jest.advanceTimersByTimeAsync(500);
  expect(await read).toBeNull();
  mockSet.mockImplementation(() => new Promise(() => {}));
  const write = writeSharedUsdRates(record());
  await jest.advanceTimersByTimeAsync(500);
  await expect(write).resolves.toBeUndefined();
});

it('degrades safely on Redis failures without logging raw errors', async () => {
  mockGet.mockRejectedValue(new Error('redis://username:secret@private'));
  mockSet.mockRejectedValue(new Error('write refused'));
  expect(await readSharedUsdRates()).toBeNull();
  await expect(writeSharedUsdRates(record())).resolves.toBeUndefined();
});
