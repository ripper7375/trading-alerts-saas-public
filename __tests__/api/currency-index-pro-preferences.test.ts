import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userCurrencyIndexPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import {
  GET,
  PUT,
} from '@/app/api/market/currency-index-pro/preferences/route';

const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const findUniquePreference = prisma.userCurrencyIndexPreference
  .findUnique as unknown as jest.Mock;
const upsertPreference = prisma.userCurrencyIndexPreference
  .upsert as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
const getServerSessionMock = getServerSession as unknown as jest.Mock;

function putRequest(body: unknown): NextRequest {
  return new NextRequest(
    'http://localhost/api/market/currency-index-pro/preferences',
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

describe('GET /api/market/currency-index-pro/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns defaults for a PRO user with no saved row yet', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);
    findUniquePreference.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.preferences).toEqual({
      lookbackDays: 20,
      useAutoZones: true,
      customObPct: null,
      customOsPct: null,
      hrmaPeriod: 36,
      smmaPeriod: 13,
      preferredTf: 'M15',
    });
  });

  it('returns a saved row when one exists', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);
    findUniquePreference.mockResolvedValue({
      lookbackDays: 10,
      useAutoZones: false,
      customObPct: 0.9,
      customOsPct: -0.9,
      hrmaPeriod: 50,
      smmaPeriod: 20,
      preferredTf: 'M5',
    });

    const res = await GET();
    const body = await res.json();
    expect(body.preferences.lookbackDays).toBe(10);
    expect(body.preferences.preferredTf).toBe('M5');
  });
});

describe('PUT /api/market/currency-index-pro/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUniquePreference.mockResolvedValue(null);
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await PUT(putRequest({ hrmaPeriod: 50 }));
    expect(res.status).toBe(401);
    expect(upsertPreference).not.toHaveBeenCalled();
  });

  it('400s an out-of-range value rather than silently clamping it', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    // spec: lookback is one of {5,10,20,30,60} -- 15 is not a valid option.
    const res = await PUT(putRequest({ lookbackDays: 15 }));
    expect(res.status).toBe(400);
    expect(upsertPreference).not.toHaveBeenCalled();
  });

  it("400s a customObPct outside the spec's +0.30..+2.00 slider range", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await PUT(putRequest({ customObPct: 5.0 }));
    expect(res.status).toBe(400);
  });

  it('merges a partial update with existing preferences before upserting', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);
    findUniquePreference.mockResolvedValue({
      lookbackDays: 20,
      useAutoZones: true,
      customObPct: null,
      customOsPct: null,
      hrmaPeriod: 36,
      smmaPeriod: 13,
      preferredTf: 'M15',
    });
    upsertPreference.mockResolvedValue({
      lookbackDays: 20,
      useAutoZones: true,
      customObPct: null,
      customOsPct: null,
      hrmaPeriod: 50,
      smmaPeriod: 13,
      preferredTf: 'M15',
    });

    const res = await PUT(putRequest({ hrmaPeriod: 50 }));
    expect(res.status).toBe(200);

    const upsertArgs = upsertPreference.mock.calls[0]?.[0];
    expect(upsertArgs.update).toMatchObject({
      hrmaPeriod: 50,
      smmaPeriod: 13, // untouched fields carried through from the existing row
      lookbackDays: 20,
    });
  });
});
