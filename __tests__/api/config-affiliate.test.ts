/**
 * Tests for the public GET /api/config/affiliate (SystemConfig path)
 *
 * Spec §8A.2 / DECISION-LOG F83: the response gains `minimumPayoutUsd` and
 * ONLY that payout setting — pause switch, batch size, approval window and
 * provider are operational and must never reach this unauthenticated
 * endpoint. The existing 5 fields and the 5-minute cache are unchanged.
 */

import { NextRequest } from 'next/server';

import { GET } from '@/app/api/config/affiliate/route';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { systemConfig: { findMany: jest.fn() } },
}));

const findMany = (
  prisma as unknown as { systemConfig: { findMany: jest.Mock } }
).systemConfig.findMany;

type Row = { key: string; value: string; updatedAt?: Date };

/** Route the two findMany calls (affiliate keys, payout keys) by `where.key.in`. */
function seed(rows: Row[]): void {
  findMany.mockImplementation(
    async (args: { where: { key: { in: string[] } } }) =>
      rows
        .filter((r) => args.where.key.in.includes(r.key))
        .map((r) => ({ updatedAt: new Date('2026-09-01'), ...r }))
  );
}

async function getBody(): Promise<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}> {
  const response = await GET(
    new NextRequest('http://localhost:3000/api/config/affiliate')
  );
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json()) as Record<string, unknown>,
  };
}

describe('GET /api/config/affiliate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seed([]);
  });

  it('returns minimumPayoutUsd = 50 by default alongside the existing 5 fields', async () => {
    const { status, body } = await getBody();

    expect(status).toBe(200);
    expect(body).toMatchObject({
      discountPercent: 20,
      commissionPercent: 20,
      codesPerMonth: 15,
      regularPrice: 29,
      threeDayPrice: 1.99,
      minimumPayoutUsd: 50,
    });
    expect(typeof body['lastUpdated']).toBe('string');
  });

  it('returns the DB minimum when set, and the existing fields are unchanged', async () => {
    seed([
      { key: 'disbursement_minimum_payout_usd', value: '75' },
      { key: 'affiliate_commission_percent', value: '25' },
    ]);

    const { body } = await getBody();

    expect(body['minimumPayoutUsd']).toBe(75);
    expect(body['commissionPercent']).toBe(25);
    expect(body['discountPercent']).toBe(20);
  });

  it('never exposes the other payout settings or the provider', async () => {
    seed([
      { key: 'disbursement_enabled', value: 'false' },
      { key: 'disbursement_max_batch_size', value: '10' },
      { key: 'affiliate_commission_approval_days', value: '30' },
    ]);

    const { body } = await getBody();

    expect(Object.keys(body).sort()).toEqual(
      [
        'codesPerMonth',
        'commissionPercent',
        'discountPercent',
        'lastUpdated',
        'minimumPayoutUsd',
        'regularPrice',
        'threeDayPrice',
      ].sort()
    );
    const text = JSON.stringify(body);
    for (const forbidden of [
      'enabled',
      'maxBatchSize',
      'batch',
      'commissionApprovalDays',
      'approval',
      'provider',
      'envKillSwitch',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('keeps the public 5-minute cache header', async () => {
    const { headers } = await getBody();
    expect(headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=60'
    );
  });

  it('falls back to all defaults (minimum 50) when the DB fails', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { status, body } = await getBody();

    expect(status).toBe(200);
    expect(body['minimumPayoutUsd']).toBe(50);
    expect(body['commissionPercent']).toBe(20);
    errorSpy.mockRestore();
  });
});
