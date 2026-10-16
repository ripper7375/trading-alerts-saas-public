import { CRON_LOCK_TTL_MS, CronLockService } from './cron-lock.service';

describe('CronLockService (Remediation Tier 2 §6.9)', () => {
  let set: jest.Mock;
  let service: CronLockService;

  beforeEach(() => {
    set = jest.fn();
    service = new CronLockService({
      getClient: () => ({ set }),
    } as unknown as ConstructorParameters<typeof CronLockService>[0]);
  });

  it('claims "money:cron-lock:<job>" with SET ... PX <ttl> NX', async () => {
    set.mockResolvedValue('OK');

    await service.acquire('process-pending-disbursements');

    expect(set).toHaveBeenCalledWith(
      'money:cron-lock:process-pending-disbursements',
      expect.any(String),
      'PX',
      CRON_LOCK_TTL_MS,
      'NX'
    );
  });

  it('wins when the key was free (Redis answers OK)', async () => {
    set.mockResolvedValue('OK');

    await expect(service.acquire('job')).resolves.toBe(true);
  });

  it('loses when another instance holds it (Redis answers null)', async () => {
    set.mockResolvedValue(null);

    await expect(service.acquire('job')).resolves.toBe(false);
  });

  it('gives each job its own lock: one job running does not block another', async () => {
    const held = new Set<string>();
    set.mockImplementation(async (key: string) => {
      if (held.has(key)) return null;
      held.add(key);
      return 'OK';
    });

    expect(await service.acquire('expire-codes')).toBe(true);
    expect(await service.acquire('expire-codes')).toBe(false);
    expect(await service.acquire('daily-maintenance')).toBe(true);
  });

  it('lets exactly one of many concurrent instances win', async () => {
    let taken = false;
    set.mockImplementation(async () => {
      if (taken) return null;
      taken = true;
      return 'OK';
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.acquire('job'))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('holds the lock for 10 minutes by default and honours a different ttl', async () => {
    set.mockResolvedValue('OK');

    await service.acquire('job');
    await service.acquire('job', 5_000);

    expect(CRON_LOCK_TTL_MS).toBe(10 * 60 * 1000);
    expect(set.mock.calls[0]?.[3]).toBe(600_000);
    expect(set.mock.calls[1]?.[3]).toBe(5_000);
  });

  it('fails OPEN when Redis is unreachable: the job runs rather than never running', async () => {
    set.mockRejectedValue(new Error('redis down'));

    await expect(service.acquire('job')).resolves.toBe(true);
  });
});
