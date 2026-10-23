/**
 * Commission Aggregator Service Tests (Session 4A-W6, File 5/8)
 *
 * No test file existed for this service before this session (verified live
 * — same `LESSONS-LEARNED.md` L27-class gap as `payment-orchestrator.service.ts`,
 * `LESSONS-ARCHIVE` note). Scoped to this session's own new method
 * (`getAllPayableAffiliatesForProvider`, design §6.2 step 1) rather than
 * backfilling full coverage of every pre-existing method.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { CommissionAggregatorService } from './commission-aggregator.service';
import { DisbursementSettingsService } from './disbursement-settings.service';

describe('CommissionAggregatorService.getAllPayableAffiliatesForProvider', () => {
  let service: CommissionAggregatorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    // No payout-setting rows -> the $50 default (DECISION-LOG F83)
    prismaMock.systemConfig.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommissionAggregatorService,
        DisbursementSettingsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(CommissionAggregatorService);
  });

  it('a non-WISE provider falls through to the existing getAllPayableAffiliates() behavior unmodified', async () => {
    prismaMock.commission.findMany.mockResolvedValue([]);

    await service.getAllPayableAffiliatesForProvider('MOCK');

    // getAllPayableAffiliates() includes affiliateProfile; the new WISE-only
    // path does not -- this proves the fallback took the OLD query shape.
    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { affiliateProfile: true },
      })
    );
    expect(prismaMock.affiliateWiseRecipient.findMany).not.toHaveBeenCalled();
  });

  it('WISE: zero ACTIVE recipients yields an empty result without querying commissions', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([]);

    const result = await service.getAllPayableAffiliatesForProvider('WISE');

    expect(result).toEqual([]);
    expect(prismaMock.commission.findMany).not.toHaveBeenCalled();
  });

  it('WISE: only aggregates commissions for affiliates with an ACTIVE Wise recipient, at or above the $50 minimum', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([
      { affiliateProfileId: 'aff-active' },
    ] as never);
    prismaMock.commission.findMany.mockResolvedValue([
      {
        id: 'comm-1',
        affiliateProfileId: 'aff-active',
        commissionAmount: 60,
        createdAt: new Date('2026-07-01'),
      },
    ] as never);

    const result = await service.getAllPayableAffiliatesForProvider('WISE');

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          affiliateProfileId: { in: ['aff-active'] },
          status: 'APPROVED',
        }),
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        affiliateId: 'aff-active',
        totalAmount: 60,
        canPayout: true,
      }),
    ]);
  });

  describe('72-hour hold on a new or changed Wise recipient (WS-9, CODE-06A)', () => {
    const NOW = new Date('2026-10-26T10:00:00.000Z');
    const HOUR = 60 * 60 * 1000;

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('asks only for ACTIVE recipients that are unchanged or changed at least 72 hours ago', async () => {
      prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([]);

      await service.getAllPayableAffiliatesForProvider('WISE');

      expect(prismaMock.affiliateWiseRecipient.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          OR: [
            { detailsChangedAt: null },
            { detailsChangedAt: { lte: new Date(NOW.getTime() - 72 * HOUR) } },
          ],
        },
        select: { affiliateProfileId: true },
      });
    });

    it('pays an affiliate whose recipient is unchanged or past the hold, and skips one still inside it', async () => {
      type Row = {
        affiliateProfileId: string;
        status: string;
        detailsChangedAt: Date | null;
      };
      const rows: Row[] = [
        {
          affiliateProfileId: 'aff-unchanged',
          status: 'ACTIVE',
          detailsChangedAt: null,
        },
        {
          affiliateProfileId: 'aff-72h',
          status: 'ACTIVE',
          detailsChangedAt: new Date(NOW.getTime() - 72 * HOUR),
        },
        {
          affiliateProfileId: 'aff-71h',
          status: 'ACTIVE',
          detailsChangedAt: new Date(NOW.getTime() - 71 * HOUR),
        },
        {
          affiliateProfileId: 'aff-just-now',
          status: 'ACTIVE',
          detailsChangedAt: NOW,
        },
        {
          affiliateProfileId: 'aff-invalid',
          status: 'INVALID',
          detailsChangedAt: null,
        },
      ];
      // A tiny evaluator for exactly the where-shape the service sends.
      prismaMock.affiliateWiseRecipient.findMany.mockImplementation(((args: {
        where: {
          status: string;
          OR: Array<{ detailsChangedAt: null | { lte: Date } }>;
        };
      }) =>
        Promise.resolve(
          rows
            .filter((row) => row.status === args.where.status)
            .filter((row) =>
              args.where.OR.some((clause) =>
                clause.detailsChangedAt === null
                  ? row.detailsChangedAt === null
                  : row.detailsChangedAt !== null &&
                    row.detailsChangedAt <= clause.detailsChangedAt.lte
              )
            )
            .map((row) => ({ affiliateProfileId: row.affiliateProfileId }))
        )) as never);
      prismaMock.commission.findMany.mockImplementation(((args: {
        where: { affiliateProfileId: { in: string[] } };
      }) =>
        Promise.resolve(
          ['aff-unchanged', 'aff-72h', 'aff-71h', 'aff-just-now', 'aff-invalid']
            .filter((id) => args.where.affiliateProfileId.in.includes(id))
            .map((id) => ({
              id: `comm-${id}`,
              affiliateProfileId: id,
              commissionAmount: 60,
              createdAt: new Date('2026-07-01'),
            }))
        )) as never);

      const result = await service.getAllPayableAffiliatesForProvider('WISE');

      expect(result.map((a) => a.affiliateId).sort()).toEqual([
        'aff-72h',
        'aff-unchanged',
      ]);
    });

    it('does not apply to the other providers', async () => {
      prismaMock.commission.findMany.mockResolvedValue([]);

      await service.getAllPayableAffiliatesForProvider('MOCK');

      expect(prismaMock.affiliateWiseRecipient.findMany).not.toHaveBeenCalled();
    });
  });

  describe('dynamic minimum payout (E4, DECISION-LOG F83)', () => {
    const minimumRow = (value: string) =>
      [
        {
          id: 'cfg-min',
          key: 'disbursement_minimum_payout_usd',
          value,
        },
      ] as never;

    it('WISE path: excludes a $60 balance when the admin minimum is $75', async () => {
      prismaMock.systemConfig.findMany.mockResolvedValue(minimumRow('75'));
      prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([
        { affiliateProfileId: 'aff-active' },
      ] as never);
      prismaMock.commission.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-active',
          commissionAmount: 60,
          createdAt: new Date('2026-07-01'),
        },
      ] as never);

      await expect(
        service.getAllPayableAffiliatesForProvider('WISE')
      ).resolves.toEqual([]);
    });

    it('generic path: includes a $40 balance when the admin minimum is $30', async () => {
      prismaMock.systemConfig.findMany.mockResolvedValue(minimumRow('30'));
      prismaMock.commission.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-1',
          commissionAmount: 40,
          createdAt: new Date('2026-07-01'),
        },
      ] as never);

      const result = await service.getAllPayableAffiliates();
      expect(result).toEqual([
        expect.objectContaining({ affiliateId: 'aff-1', canPayout: true }),
      ]);
    });

    it('getAggregatesByAffiliate reports the dynamic minimum in its reason', async () => {
      prismaMock.systemConfig.findMany.mockResolvedValue(minimumRow('75'));
      prismaMock.commission.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          commissionAmount: 60,
          createdAt: new Date('2026-07-01'),
        },
      ] as never);

      const result = await service.getAggregatesByAffiliate('aff-1');
      expect(result.canPayout).toBe(false);
      expect(result.reason).toBe('Below minimum payout of $75');
    });

    it('an explicit minimum argument wins and skips the settings read', async () => {
      prismaMock.commission.findMany.mockResolvedValue([]);

      await service.getAllPayableAffiliatesForProvider('MOCK', 60);

      expect(prismaMock.systemConfig.findMany).not.toHaveBeenCalled();
    });

    it('resolves the minimum once per public call on the WISE path', async () => {
      prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([]);

      await service.getAllPayableAffiliatesForProvider('WISE');

      expect(prismaMock.systemConfig.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
