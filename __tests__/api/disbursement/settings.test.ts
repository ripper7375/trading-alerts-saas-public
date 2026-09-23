/**
 * Tests for GET/PATCH /api/disbursement/settings (DECISION-LOG F83, spec §7)
 */

import { NextRequest } from 'next/server';

import { GET, PATCH } from '@/app/api/disbursement/settings/route';
import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => {
  const client = {
    systemConfig: { findMany: jest.fn(), upsert: jest.fn() },
    systemConfigHistory: { findMany: jest.fn(), create: jest.fn() },
    disbursementAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { prisma: client };
});

const db = prisma as unknown as {
  systemConfig: { findMany: jest.Mock; upsert: jest.Mock };
  systemConfigHistory: { findMany: jest.Mock; create: jest.Mock };
  disbursementAuditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

const ADMIN = { user: { id: 'admin-1', email: 'admin@davintrade.app' } };
const V1 = new Date('2026-09-20T10:00:00.000Z');
const V2 = new Date('2026-09-23T10:00:00.000Z');

function patchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/disbursement/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function getRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/disbursement/settings');
}

describe('/api/disbursement/settings', () => {
  const originalEnv = process.env['DISBURSEMENT_ENABLED'];

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['DISBURSEMENT_ENABLED'];
    (requireAdmin as jest.Mock).mockResolvedValue(ADMIN);
    db.systemConfig.findMany.mockResolvedValue([]);
    db.systemConfigHistory.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation(
      async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
    );
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env['DISBURSEMENT_ENABLED'];
    else process.env['DISBURSEMENT_ENABLED'] = originalEnv;
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
      );
      const response = await GET(getRequest());
      expect(response.status).toBe(401);
    });

    it('returns 403 for a non-admin', async () => {
      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Admin required', 'ADMIN_REQUIRED', 403)
      );
      const response = await GET(getRequest());
      expect(response.status).toBe(403);
    });

    it('returns defaults, bounds, provider, schedule and a null version when no rows exist', async () => {
      const response = await GET(getRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.settings.enabled).toMatchObject({
        value: true,
        default: true,
        source: 'default',
        updatedBy: null,
        updatedAt: null,
      });
      expect(body.settings.minimumPayoutUsd).toMatchObject({
        value: 50,
        default: 50,
        min: 1,
        max: 10000,
        source: 'default',
      });
      expect(body.settings.maxBatchSize).toMatchObject({
        value: 100,
        min: 1,
        max: 500,
      });
      expect(body.settings.commissionApprovalDays).toMatchObject({
        value: 14,
        min: 0,
        max: 90,
      });
      expect(body.effective).toEqual({ enabled: true, envKillSwitch: false });
      expect(body.provider).toMatchObject({
        source: 'env',
        envVar: 'DISBURSEMENT_PROVIDER',
      });
      expect(body.provider.available).toContain('MOCK');
      expect(body.schedule).toMatchObject({ cronExpression: '0 2 1 * *' });
      expect(body.schedule.nextRunAt).toMatch(/T02:00:00\.000Z$/);
      expect(body.recentChanges).toEqual([]);
      expect(body.version).toBeNull();
    });

    it('reports database values with provenance and the max updatedAt as version', async () => {
      db.systemConfig.findMany.mockResolvedValue([
        {
          key: 'disbursement_minimum_payout_usd',
          value: '75',
          updatedBy: 'admin-9',
          updatedAt: V1,
        },
        {
          key: 'disbursement_enabled',
          value: 'false',
          updatedBy: 'admin-9',
          updatedAt: V2,
        },
      ]);

      const body = await (await GET(getRequest())).json();

      expect(body.settings.minimumPayoutUsd).toMatchObject({
        value: 75,
        source: 'database',
        updatedBy: 'admin-9',
        updatedAt: V1.toISOString(),
      });
      expect(body.effective).toEqual({ enabled: false, envKillSwitch: false });
      expect(body.version).toBe(V2.toISOString());
    });

    it('shows the env kill switch', async () => {
      process.env['DISBURSEMENT_ENABLED'] = 'false';
      const body = await (await GET(getRequest())).json();
      expect(body.effective).toEqual({ enabled: false, envKillSwitch: true });
    });
  });

  describe('PATCH', () => {
    it('returns 401/403 from requireAdmin', async () => {
      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Admin required', 'ADMIN_REQUIRED', 403)
      );
      const response = await PATCH(
        patchRequest({
          enabled: false,
          reason: 'pause it',
          expectedVersion: null,
        })
      );
      expect(response.status).toBe(403);
    });

    it.each([
      [{ minimumPayoutUsd: 0.5 }],
      [{ minimumPayoutUsd: 10000.01 }],
      [{ minimumPayoutUsd: 50.123 }],
      [{ maxBatchSize: 0 }],
      [{ maxBatchSize: 501 }],
      [{ maxBatchSize: 2.5 }],
      [{ commissionApprovalDays: -1 }],
      [{ commissionApprovalDays: 91 }],
    ])('rejects out-of-bounds %p with 400', async (field) => {
      const response = await PATCH(
        patchRequest({
          ...field,
          reason: 'valid reason',
          expectedVersion: null,
        })
      );
      expect(response.status).toBe(400);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('requires a reason of at least 5 characters', async () => {
      const response = await PATCH(
        patchRequest({
          maxBatchSize: 50,
          reason: ' no ',
          expectedVersion: null,
        })
      );
      expect(response.status).toBe(400);
      const missing = await PATCH(
        patchRequest({ maxBatchSize: 50, expectedVersion: null })
      );
      expect(missing.status).toBe(400);
    });

    it('requires at least one setting', async () => {
      const response = await PATCH(
        patchRequest({ reason: 'nothing to do', expectedVersion: null })
      );
      expect(response.status).toBe(400);
    });

    it('returns 409 SETTINGS_STALE when expectedVersion differs', async () => {
      db.systemConfig.findMany.mockResolvedValue([
        {
          key: 'disbursement_max_batch_size',
          value: '80',
          updatedBy: 'admin-2',
          updatedAt: V2,
        },
      ]);

      const response = await PATCH(
        patchRequest({
          maxBatchSize: 50,
          reason: 'lower batch size',
          expectedVersion: V1.toISOString(),
        })
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'SETTINGS_STALE' });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('a no-op returns changes: [] and writes nothing', async () => {
      const response = await PATCH(
        patchRequest({
          minimumPayoutUsd: 50,
          enabled: true,
          reason: 'no change really',
          expectedVersion: null,
        })
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ changes: [] });
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    });

    it('writes upsert + history per changed key and one audit row inside $transaction', async () => {
      db.systemConfig.findMany
        .mockResolvedValueOnce([
          {
            key: 'disbursement_max_batch_size',
            value: '80',
            updatedBy: 'admin-2',
            updatedAt: V1,
          },
        ])
        .mockResolvedValueOnce([
          {
            key: 'disbursement_max_batch_size',
            value: '40',
            updatedBy: 'admin-1',
            updatedAt: V2,
          },
          {
            key: 'disbursement_minimum_payout_usd',
            value: '60',
            updatedBy: 'admin-1',
            updatedAt: V2,
          },
        ]);

      const response = await PATCH(
        patchRequest({
          minimumPayoutUsd: 60,
          maxBatchSize: 40,
          commissionApprovalDays: 14,
          reason: 'raise minimum, smaller batches',
          expectedVersion: V1.toISOString(),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(body.changes).toEqual([
        { setting: 'minimumPayoutUsd', oldValue: '50', newValue: '60' },
        { setting: 'maxBatchSize', oldValue: '80', newValue: '40' },
      ]);
      expect(body.version).toBe(V2.toISOString());

      expect(db.systemConfig.upsert).toHaveBeenCalledTimes(2);
      expect(db.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'disbursement_minimum_payout_usd' },
        create: expect.objectContaining({
          key: 'disbursement_minimum_payout_usd',
          value: '60',
          valueType: 'number',
          category: 'disbursement',
          updatedBy: 'admin-1',
        }),
        update: { value: '60', updatedBy: 'admin-1' },
      });
      expect(db.systemConfigHistory.create).toHaveBeenCalledWith({
        data: {
          configKey: 'disbursement_max_batch_size',
          oldValue: '80',
          newValue: '40',
          changedBy: 'admin@davintrade.app',
          reason: 'raise minimum, smaller batches',
        },
      });
      expect(db.disbursementAuditLog.create).toHaveBeenCalledTimes(1);
      expect(db.disbursementAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'config.settings_updated',
          status: 'INFO',
          actor: 'admin-1',
        }),
      });
    });

    it('pausing writes action config.disbursements_paused with WARNING', async () => {
      await PATCH(
        patchRequest({
          enabled: false,
          reason: 'bank holiday freeze',
          expectedVersion: null,
        })
      );

      expect(db.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'disbursement_enabled' },
          create: expect.objectContaining({
            value: 'false',
            valueType: 'boolean',
          }),
        })
      );
      expect(db.disbursementAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'config.disbursements_paused',
          status: 'WARNING',
        }),
      });
    });

    it('resuming writes action config.disbursements_resumed', async () => {
      db.systemConfig.findMany.mockResolvedValue([
        {
          key: 'disbursement_enabled',
          value: 'false',
          updatedBy: 'admin-2',
          updatedAt: V1,
        },
      ]);

      await PATCH(
        patchRequest({
          enabled: true,
          reason: 'freeze over',
          expectedVersion: V1.toISOString(),
        })
      );

      expect(db.disbursementAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'config.disbursements_resumed',
          status: 'INFO',
        }),
      });
    });

    it('rejects unknown fields (strict body), e.g. an attempt to set the provider', async () => {
      const response = await PATCH(
        patchRequest({
          provider: 'WISE',
          maxBatchSize: 50,
          reason: 'switch provider',
          expectedVersion: null,
        })
      );
      expect(response.status).toBe(400);
    });

    it('returns 500 with a generic message on an unexpected error', async () => {
      db.$transaction.mockRejectedValueOnce(new Error('deadlock'));
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const response = await PATCH(
        patchRequest({
          maxBatchSize: 50,
          reason: 'smaller',
          expectedVersion: null,
        })
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Failed to update payout settings',
      });
      errorSpy.mockRestore();
    });
  });
});
