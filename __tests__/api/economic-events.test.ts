/**
 * Economic events: read layer + API route.
 *
 * Two things are worth protecting here. The read layer must collapse an
 * append-only table to the NEWEST observation per release — without that,
 * a pre-publication row (forecast known, actual null) can surface after the
 * event has already happened. And the route must not refuse a user who has
 * just paid for PRO, which is what a JWT-only tier check does.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals. jest.mock
// factories are hoisted above imports, so an imported 'jest' binding is in TDZ
// when a factory runs and jest.fn() inside it yields nothing usable. The
// injected global works. Every other suite in this repo imports the same way.
import { describe, it, expect, beforeEach } from '@jest/globals';

// Factories must not reference out-of-scope variables, or babel-jest declines
// to hoist them -- the mock then registers AFTER the imports and the REAL
// Prisma client runs, which here meant a genuine TLS connection attempt. So
// each factory creates its own jest.fn() and the handle is taken afterwards.
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: { economicEvent: { findMany: jest.fn() } },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { getUpcomingHighImpactEvents } from '@/lib/economic-events/queries';
import { GET } from '@/app/api/market/economic-events/route';

const findMany = marketPrisma.economicEvent.findMany as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
// next-auth is already mocked globally in jest.setup.js; reuse that handle
// rather than registering a competing mock for the same module.
const getServerSessionMock = getServerSession as unknown as jest.Mock;

const NOW = new Date('2026-01-14T12:00:00Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    value_id: '1',
    event_id: '840010013',
    event_name: 'Non-Farm Employment Change',
    event_time: NOW_SEC + 3600,
    currency: 'USD',
    country_code: 'US',
    importance: 'HIGH',
    forecast_value: null,
    prev_value: 0.0,
    digits: 2,
    time_mode: 0,
    source_url: null,
    ...overrides,
  };
}

describe('getUpcomingHighImpactEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks the database to collapse to the newest observation per release', async () => {
    findMany.mockResolvedValue([]);
    await getUpcomingHighImpactEvents({ now: NOW });

    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    // Without distinct on value_id, a pre-publication row and its revision
    // both surface and the UI shows whichever came back first.
    expect(args['distinct']).toEqual(['value_id']);
    // The ordering is what makes distinct keep the NEWEST, not an arbitrary one.
    expect(args['orderBy']).toEqual([
      { value_id: 'asc' },
      { captured_at: 'desc' },
    ]);
  });

  it('only asks for HIGH-impact events inside the forward window', async () => {
    findMany.mockResolvedValue([]);
    await getUpcomingHighImpactEvents({ now: NOW, horizonDays: 7 });

    const where = (findMany.mock.calls[0]?.[0] as Record<string, unknown>)[
      'where'
    ] as Record<string, { gte: number; lte: number }> & Record<string, unknown>;

    expect(where['importance']).toBe('HIGH');
    expect(where['event_time']).toEqual({
      gte: NOW_SEC,
      lte: NOW_SEC + 7 * 86400,
    });
  });

  it('returns soonest first, regardless of the ordering distinct forced', async () => {
    findMany.mockResolvedValue([
      dbRow({ value_id: 'b', event_time: NOW_SEC + 7200, event_name: 'Later' }),
      dbRow({ value_id: 'a', event_time: NOW_SEC + 600, event_name: 'Sooner' }),
    ]);

    const events = await getUpcomingHighImpactEvents({ now: NOW });
    expect(events.map((e) => e.eventName)).toEqual(['Sooner', 'Later']);
  });

  it('keeps a missing forecast null and a real zero previous as 0', async () => {
    findMany.mockResolvedValue([dbRow()]);
    const [event] = await getUpcomingHighImpactEvents({ now: NOW });

    expect(event?.forecastValue).toBeNull();
    expect(event?.previousValue).toBe(0);
  });

  it('degrades to empty when the table does not exist yet', async () => {
    // The migration is applied separately from the deploy; an unbuilt lane
    // must render as "nothing scheduled", not as a broken panel.
    findMany.mockRejectedValue(
      new Error('relation "economic_events" does not exist')
    );
    await expect(getUpcomingHighImpactEvents({ now: NOW })).resolves.toEqual(
      []
    );
  });

  it('honours the limit', async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) =>
        dbRow({ value_id: String(i), event_time: NOW_SEC + i * 60 })
      )
    );
    const events = await getUpcomingHighImpactEvents({ now: NOW, limit: 3 });
    expect(events).toHaveLength(3);
  });
});

describe('GET /api/market/economic-events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([dbRow()]);
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('serves a PRO user whose token already says PRO', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    // The token sufficed, so no database round trip was needed.
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect((await res.json()).events).toHaveLength(1);
  });

  it('serves a user who JUST upgraded, whose token is still stale', async () => {
    // The whole reason this route re-checks the database instead of using
    // requirePro(): a JWT-only check refuses a feature the user has paid for.
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(findUniqueUser).toHaveBeenCalled();
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not cache across users', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('private');
  });
});
