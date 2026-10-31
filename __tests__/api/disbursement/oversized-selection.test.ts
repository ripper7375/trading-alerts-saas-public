/**
 * The admin payout routes refuse an oversized id list BEFORE it is parsed or looked up.
 * (zod 3 would otherwise parse every element first; see lib/validations/bounded.ts.)
 */
import { NextRequest } from 'next/server';

import { POST as payCommissions } from '@/app/api/admin/commissions/pay/route';
import { POST as previewBatch } from '@/app/api/disbursement/batches/preview/route';
import { MAX_PAYOUT_SELECTION } from '@/lib/disbursement/constants';

jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn().mockResolvedValue({
    user: { id: 'admin-123', role: 'ADMIN' },
  }),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    affiliateProfile: { findUnique: jest.fn() },
    commission: { findMany: jest.fn(), updateMany: jest.fn() },
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

describe('oversized id lists on the admin payout routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /api/admin/commissions/pay answers 400 for more than 5000 commission ids, with no lookup', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const response = await payCommissions(
      post('/api/admin/commissions/pay', {
        affiliateId: 'aff-1',
        paymentMethod: 'WISE',
        paymentReference: 'ref-1',
        commissionIds: ids(5001),
      })
    );
    expect(response.status).toBe(400);
    expect(prisma.affiliateProfile.findUnique).not.toHaveBeenCalled();
  });

  it('POST /api/disbursement/batches/preview answers 400 for an oversized affiliate selection, with no lookup', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const response = await previewBatch(
      post('/api/disbursement/batches/preview', {
        affiliateIds: ids(MAX_PAYOUT_SELECTION + 1),
      })
    );
    expect(response.status).toBe(400);
    expect(prisma.commission.findMany).not.toHaveBeenCalled();
  });
});
