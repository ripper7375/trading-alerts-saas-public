/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as publicGet } from '@/app/api/world-gold/route';
import { GET as cronGet } from '@/app/api/cron/world-gold/route';
import {
  captureWorldGoldCloses,
  getWorldGoldSnapshot,
} from '@/lib/world-gold/server';
jest.mock('@/lib/world-gold/server', () => ({
  getWorldGoldSnapshot: jest.fn(),
  captureWorldGoldCloses: jest.fn(),
}));
const mockSnapshot = getWorldGoldSnapshot as jest.MockedFunction<
  typeof getWorldGoldSnapshot
>;
const mockCapture = captureWorldGoldCloses as jest.MockedFunction<
  typeof captureWorldGoldCloses
>;
const originalSecret = process.env['CRON_SECRET'];
afterAll(() => {
  if (originalSecret === undefined) delete process.env['CRON_SECRET'];
  else process.env['CRON_SECRET'] = originalSecret;
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env['CRON_SECRET'] = 'world-gold-test-secret';
  mockCapture.mockResolvedValue({
    generatedAt: '2026-10-15T10:35:00Z',
    historyAvailable: true,
    stored: [],
    alreadyPresent: [],
    unavailable: [],
  });
});
const request = (authorization?: string) =>
  new NextRequest('http://localhost/api/cron/world-gold', {
    headers: authorization ? { authorization } : {},
  });
describe('World gold routes', () => {
  test('public API returns provider metadata and all market data without HTTP caching', async () => {
    const snapshot = {
      generatedAt: '2026-10-15T10:35:00Z',
      gold: null,
      fx: null,
      historyAvailable: false,
      markets: [],
    };
    mockSnapshot.mockResolvedValue(snapshot);
    const response = await publicGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  test.each([
    undefined,
    'Bearer wrong',
    'Basic world-gold-test-secret',
    'Bearer world-gold-test-secrex',
  ])(
    'cron refuses unauthorized header %s before doing any work',
    async (authorization) => {
      const response = await cronGet(request(authorization));
      expect(response.status).toBe(401);
      expect(mockCapture).not.toHaveBeenCalled();
    }
  );
  test('missing cron configuration fails closed', async () => {
    delete process.env['CRON_SECRET'];
    expect((await cronGet(request())).status).toBe(503);
    expect(mockCapture).not.toHaveBeenCalled();
  });
  test('configured scheduler captures independently of public requests', async () => {
    const response = await cronGet(request('Bearer world-gold-test-secret'));
    expect(response.status).toBe(200);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockSnapshot).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  test('unavailable migration/storage is an actionable scheduler failure', async () => {
    mockCapture.mockResolvedValue({
      generatedAt: '2026-10-15T10:35:00Z',
      historyAvailable: false,
      stored: [],
      alreadyPresent: [],
      unavailable: [],
    });
    expect(
      (await cronGet(request('Bearer world-gold-test-secret'))).status
    ).toBe(503);
  });
  test('unexpected capture errors reveal no server details', async () => {
    mockCapture.mockRejectedValue(new Error('private connection details'));
    const response = await cronGet(request('Bearer world-gold-test-secret'));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
});
