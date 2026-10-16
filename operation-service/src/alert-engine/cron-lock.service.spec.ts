import { CronLockService } from './cron-lock.service';

describe('CronLockService (alert engine, Remediation Tier 2 §6.9)', () => {
  let set: jest.Mock;
  let service: CronLockService;

  beforeEach(() => {
    set = jest.fn();
    service = new CronLockService({
      getClient: () => ({ set }),
    } as unknown as ConstructorParameters<typeof CronLockService>[0]);
  });

  it('claims "alerts:cron-lock:<job>" with SET ... PX <ttl> NX', async () => {
    set.mockResolvedValue('OK');

    await service.acquire('alert-checker', 55_000);

    expect(set).toHaveBeenCalledWith(
      'alerts:cron-lock:alert-checker',
      expect.any(String),
      'PX',
      55_000,
      'NX'
    );
  });

  it('wins when the key was free, loses when another worker holds it', async () => {
    set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(service.acquire('alert-checker', 55_000)).resolves.toBe(true);
    await expect(service.acquire('alert-checker', 55_000)).resolves.toBe(false);
  });

  it('lets exactly one of many concurrent workers win', async () => {
    let taken = false;
    set.mockImplementation(async () => {
      if (taken) return null;
      taken = true;
      return 'OK';
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.acquire('alert-checker', 55_000))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('fails OPEN when Redis is unreachable: a missed check costs a trader an alert', async () => {
    set.mockRejectedValue(new Error('redis down'));

    await expect(service.acquire('alert-checker', 55_000)).resolves.toBe(true);
  });
});
