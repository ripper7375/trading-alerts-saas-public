import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    currencyGoldIndex: { findMany: jest.fn() },
    dailyVolatilityCorridor: { findFirst: jest.fn() },
  },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userCurrencyIndexPreference: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { GET } from '@/app/api/market/currency-index-pro/screener/route';

const findManyCgi = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const findFirstCorridor = marketPrisma.dailyVolatilityCorridor
  .findFirst as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const findUniquePreference = prisma.userCurrencyIndexPreference
  .findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
const getServerSessionMock = getServerSession as unknown as jest.Mock;

describe('GET /api/market/currency-index-pro/screener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyCgi.mockResolvedValue([]);
    findFirstCorridor.mockResolvedValue(null);
    findUniquePreference.mockResolvedValue(null); // no saved prefs -> defaults
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('serves a PRO user and returns all 4 sections', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spreadDelta).toBeDefined();
    expect(body.dashboardTableM5).toEqual([]);
    expect(body.analysisTableM15).toEqual([]);
    expect(body.top5Trades).toHaveLength(5);
  });

  it('403s a genuine FREE user without ever querying market data', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('serves a user whose token is stale but the DB confirms PRO', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('does not cache across users', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('private');
  });

  it('never returns a spread status/score computed from a missing index (degrades every currency to NEUTRAL/no-signal)', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    const body = await res.json();
    expect(body.spreadDelta.spreadPct).toBe(0);
    expect(body.spreadDelta.status).toBe('LOW');
  });

  it('keeps the M5 dashboard and M15 analysis tables on genuinely different bars from the same raw data (spec V3: Dual Timeframe Integrity)', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const SESSION_OPEN = 1_800_000_000;
    const ALL_INDEX_NAMES = [
      'USDX',
      'EURX',
      'GBPX',
      'JPYX',
      'AUDX',
      'CADX',
      'CHFX',
      'NZDX',
    ];

    // First call: the "latest bar per index" distinct query.
    findManyCgi.mockResolvedValueOnce(
      ALL_INDEX_NAMES.map((index_name) => ({
        index_name,
        session_open_bar_time: SESSION_OPEN,
      }))
    );

    // Second call: every bar since each index's own session open. EUR gets 4
    // M5 bars spanning past one full M15 window -- offsets 0/300/600/900.
    // Offset 600 is the M15-boundary close ((600) % 900 === 600); offset 900
    // starts a NEW M15 window and is NOT a boundary bar itself, but IS the
    // latest raw M5 bar. If the dashboard and analysis tables read the same
    // bar, this test fails.
    findManyCgi.mockResolvedValueOnce([
      {
        index_name: 'EURX',
        bar_time: SESSION_OPEN,
        value: 100.1,
        change_pct: 0.1,
      },
      {
        index_name: 'EURX',
        bar_time: SESSION_OPEN + 300,
        value: 100.2,
        change_pct: 0.2,
      },
      {
        index_name: 'EURX',
        bar_time: SESSION_OPEN + 600,
        value: 100.3,
        change_pct: 0.3,
      },
      {
        index_name: 'EURX',
        bar_time: SESSION_OPEN + 900,
        value: 100.4,
        change_pct: 0.4,
      },
      ...ALL_INDEX_NAMES.filter((n) => n !== 'EURX').map((index_name) => ({
        index_name,
        bar_time: SESSION_OPEN,
        value: 100.0,
        change_pct: 0.0,
      })),
    ]);

    const res = await GET();
    const body = await res.json();

    const dashboardEur = body.dashboardTableM5.find(
      (r: { currency: string }) => r.currency === 'EUR'
    );
    const analysisEur = body.analysisTableM15.find(
      (r: { currency: string }) => r.currency === 'EUR'
    );

    // Dashboard (M5): the latest raw bar, offset 900, change_pct 0.4.
    expect(dashboardEur.changePct).toBeCloseTo(0.4, 10);
    // Analysis (M15): only the offset-600 M15-boundary bar qualifies --
    // offset 900 is excluded by sampleM15Bars (900 % 900 === 0, not 600).
    expect(analysisEur.currentPct).toBeCloseTo(0.3, 10);
  });
});
