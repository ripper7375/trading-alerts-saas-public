/**
 * Tests for the Next payout settings reader (DECISION-LOG F83, spec §5.1)
 *
 * Same cases as money-service's disbursement-settings.service.spec.ts:
 * defaults with no rows, DB values parsed, malformed / out-of-bounds values
 * fall back to defaults, env kill switch, DB error -> defaults.
 */

import {
  DISBURSEMENT_SETTING_KEY_LIST,
  getDisbursementSettings,
  getNextPayoutRunDate,
} from '@/lib/disbursement/settings';

const DEFAULTS = {
  enabled: true,
  envKillSwitch: false,
  effectiveEnabled: true,
  minimumPayoutUsd: 50,
  maxBatchSize: 100,
  commissionApprovalDays: 14,
};

describe('getDisbursementSettings', () => {
  const originalEnv = process.env['DISBURSEMENT_ENABLED'];
  const findMany = jest.fn();
  const prisma = { systemConfig: { findMany } } as never;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['DISBURSEMENT_ENABLED'];
    findMany.mockResolvedValue([]);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (originalEnv === undefined) delete process.env['DISBURSEMENT_ENABLED'];
    else process.env['DISBURSEMENT_ENABLED'] = originalEnv;
  });

  it('returns defaults equal to pre-F83 behaviour when no rows exist', async () => {
    await expect(getDisbursementSettings(prisma)).resolves.toEqual(DEFAULTS);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reads the four keys in one uncached query per call', async () => {
    await getDisbursementSettings(prisma);
    await getDisbursementSettings(prisma);

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledWith({
      where: { key: { in: DISBURSEMENT_SETTING_KEY_LIST } },
      select: { key: true, value: true },
    });
    expect(DISBURSEMENT_SETTING_KEY_LIST).toEqual([
      'disbursement_enabled',
      'disbursement_minimum_payout_usd',
      'disbursement_max_batch_size',
      'affiliate_commission_approval_days',
    ]);
  });

  it('parses stored DB values', async () => {
    findMany.mockResolvedValue([
      { key: 'disbursement_enabled', value: 'false' },
      { key: 'disbursement_minimum_payout_usd', value: '62.5' },
      { key: 'disbursement_max_batch_size', value: '40' },
      { key: 'affiliate_commission_approval_days', value: '21' },
    ]);

    await expect(getDisbursementSettings(prisma)).resolves.toEqual({
      enabled: false,
      envKillSwitch: false,
      effectiveEnabled: false,
      minimumPayoutUsd: 62.5,
      maxBatchSize: 40,
      commissionApprovalDays: 21,
    });
  });

  it.each([
    ['disbursement_enabled', 'maybe'],
    ['disbursement_minimum_payout_usd', 'NaN'],
    ['disbursement_minimum_payout_usd', '0.99'],
    ['disbursement_minimum_payout_usd', '99.999'],
    ['disbursement_max_batch_size', '501'],
    ['disbursement_max_batch_size', '2.5'],
    ['affiliate_commission_approval_days', '120'],
  ])(
    'falls back to the default and logs for malformed %s=%p',
    async (key, value) => {
      findMany.mockResolvedValue([{ key, value }]);

      await expect(getDisbursementSettings(prisma)).resolves.toEqual(DEFAULTS);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[disbursement-settings]'),
        { invalidKeys: [key] }
      );
    }
  );

  it('env DISBURSEMENT_ENABLED=false forces effectiveEnabled=false', async () => {
    process.env['DISBURSEMENT_ENABLED'] = 'false';

    await expect(getDisbursementSettings(prisma)).resolves.toMatchObject({
      enabled: true,
      envKillSwitch: true,
      effectiveEnabled: false,
    });
  });

  it('returns defaults and logs when the DB read fails (never throws)', async () => {
    findMany.mockRejectedValue(new Error('db unavailable'));

    await expect(getDisbursementSettings(prisma)).resolves.toEqual(DEFAULTS);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('read failed'),
      { error: 'db unavailable' }
    );
  });
});

describe('getNextPayoutRunDate (monthly, 1st 02:00 UTC — F84)', () => {
  it('returns the 1st of next month after this month has run', () => {
    expect(
      getNextPayoutRunDate(new Date('2026-09-23T12:00:00Z')).toISOString()
    ).toBe('2026-10-01T02:00:00.000Z');
  });

  it('returns today when it is the 1st before 02:00 UTC', () => {
    expect(
      getNextPayoutRunDate(new Date('2026-11-01T00:30:00Z')).toISOString()
    ).toBe('2026-11-01T02:00:00.000Z');
  });
});
