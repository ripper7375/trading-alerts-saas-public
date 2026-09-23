/**
 * Disbursement Settings Service Tests (DECISION-LOG F83)
 *
 * Same cases as the Next twin's __tests__/lib/disbursement/settings.test.ts:
 * defaults with no rows, DB values parsed, malformed / out-of-bounds values
 * fall back to defaults, env kill switch, DB error -> defaults, plus the
 * pause guard and the monthly schedule helper.
 */
import { ConflictException } from '@nestjs/common';

import { logger } from '../common/logger.util';
import type { PrismaService } from '../prisma/prisma.service';

import {
  DISBURSEMENT_SETTING_DEFINITIONS,
  getNextPayoutRunDate,
  parseDisbursementSettingValue,
} from './disbursement-settings.constants';
import { DisbursementSettingsService } from './disbursement-settings.service';

describe('DisbursementSettingsService', () => {
  const originalEnv = process.env['DISBURSEMENT_ENABLED'];
  let findMany: jest.Mock;
  let service: DisbursementSettingsService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env['DISBURSEMENT_ENABLED'];
    findMany = jest.fn().mockResolvedValue([]);
    service = new DisbursementSettingsService({
      systemConfig: { findMany },
    } as unknown as PrismaService);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (originalEnv === undefined) delete process.env['DISBURSEMENT_ENABLED'];
    else process.env['DISBURSEMENT_ENABLED'] = originalEnv;
  });

  it('returns today-equivalent defaults when no rows exist', async () => {
    await expect(service.get()).resolves.toEqual({
      enabled: true,
      envKillSwitch: false,
      effectiveEnabled: true,
      minimumPayoutUsd: 50,
      maxBatchSize: 100,
      commissionApprovalDays: 14,
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reads all four keys in one uncached findMany per call', async () => {
    await service.get();
    await service.get();

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        key: {
          in: [
            'disbursement_enabled',
            'disbursement_minimum_payout_usd',
            'disbursement_max_batch_size',
            'affiliate_commission_approval_days',
          ],
        },
      },
      select: { key: true, value: true },
    });
  });

  it('parses stored DB values', async () => {
    findMany.mockResolvedValue([
      { key: 'disbursement_enabled', value: 'false' },
      { key: 'disbursement_minimum_payout_usd', value: '75.5' },
      { key: 'disbursement_max_batch_size', value: '25' },
      { key: 'affiliate_commission_approval_days', value: '0' },
    ]);

    await expect(service.get()).resolves.toEqual({
      enabled: false,
      envKillSwitch: false,
      effectiveEnabled: false,
      minimumPayoutUsd: 75.5,
      maxBatchSize: 25,
      commissionApprovalDays: 0,
    });
  });

  it.each([
    ['disbursement_enabled', 'yes'],
    ['disbursement_minimum_payout_usd', 'abc'],
    ['disbursement_minimum_payout_usd', '0.5'],
    ['disbursement_minimum_payout_usd', '10000.01'],
    ['disbursement_minimum_payout_usd', '50.123'],
    ['disbursement_max_batch_size', '0'],
    ['disbursement_max_batch_size', '501'],
    ['disbursement_max_batch_size', '12.5'],
    ['affiliate_commission_approval_days', '-1'],
    ['affiliate_commission_approval_days', '91'],
    ['affiliate_commission_approval_days', ''],
  ])(
    'falls back to the default and logs for malformed %s=%p',
    async (key, value) => {
      findMany.mockResolvedValue([{ key, value }]);

      const settings = await service.get();

      expect(settings).toEqual({
        enabled: true,
        envKillSwitch: false,
        effectiveEnabled: true,
        minimumPayoutUsd: 50,
        maxBatchSize: 100,
        commissionApprovalDays: 14,
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[disbursement-settings]'),
        { invalidKeys: [key] }
      );
    }
  );

  it('env DISBURSEMENT_ENABLED=false forces effectiveEnabled=false regardless of the DB', async () => {
    process.env['DISBURSEMENT_ENABLED'] = 'false';
    findMany.mockResolvedValue([
      { key: 'disbursement_enabled', value: 'true' },
    ]);

    await expect(service.get()).resolves.toMatchObject({
      enabled: true,
      envKillSwitch: true,
      effectiveEnabled: false,
    });
  });

  it('only the exact string "false" trips the env kill switch', async () => {
    process.env['DISBURSEMENT_ENABLED'] = 'true';
    await expect(service.get()).resolves.toMatchObject({
      envKillSwitch: false,
      effectiveEnabled: true,
    });
  });

  it('returns defaults and logs when the DB read fails (never throws)', async () => {
    findMany.mockRejectedValue(new Error('connection refused'));

    await expect(service.get()).resolves.toMatchObject({
      minimumPayoutUsd: 50,
      maxBatchSize: 100,
      commissionApprovalDays: 14,
      effectiveEnabled: true,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('read failed'),
      { error: 'connection refused' }
    );
  });

  describe('assertPayoutsNotPaused', () => {
    it('resolves while payouts are active', async () => {
      await expect(service.assertPayoutsNotPaused()).resolves.toBeUndefined();
    });

    it('throws 409 DISBURSEMENTS_PAUSED when paused in the DB', async () => {
      findMany.mockResolvedValue([
        { key: 'disbursement_enabled', value: 'false' },
      ]);

      const error = await service.assertPayoutsNotPaused().catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        error: 'Disbursements are paused',
        code: 'DISBURSEMENTS_PAUSED',
      });
    });
  });

  describe('parseDisbursementSettingValue', () => {
    it('accepts the bounds themselves', () => {
      const min = DISBURSEMENT_SETTING_DEFINITIONS.minimumPayoutUsd;
      expect(parseDisbursementSettingValue('minimumPayoutUsd', '1')).toBe(
        min.min
      );
      expect(parseDisbursementSettingValue('minimumPayoutUsd', '10000')).toBe(
        min.max
      );
      expect(
        parseDisbursementSettingValue('commissionApprovalDays', '90')
      ).toBe(90);
    });

    it('accepts booleans case-insensitively with surrounding whitespace', () => {
      expect(parseDisbursementSettingValue('enabled', ' FALSE ')).toBe(false);
      expect(parseDisbursementSettingValue('enabled', 'True')).toBe(true);
    });
  });

  describe('getNextPayoutRunDate (0 2 1 * *, UTC)', () => {
    it('is the 1st of next month when this month has already run', () => {
      expect(
        getNextPayoutRunDate(new Date('2026-09-23T10:00:00Z')).toISOString()
      ).toBe('2026-10-01T02:00:00.000Z');
    });

    it('is later today when it is the 1st before 02:00 UTC', () => {
      expect(
        getNextPayoutRunDate(new Date('2026-10-01T01:59:59Z')).toISOString()
      ).toBe('2026-10-01T02:00:00.000Z');
    });

    it('rolls over the year', () => {
      expect(
        getNextPayoutRunDate(new Date('2026-12-01T02:00:00Z')).toISOString()
      ).toBe('2027-01-01T02:00:00.000Z');
    });
  });
});
