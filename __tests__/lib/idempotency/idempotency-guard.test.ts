import {
  acquireIdempotencyLock,
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
} from '@/lib/idempotency/idempotency-guard';

const mockSet = jest.fn();

jest.mock('@/lib/redis/client', () => ({
  getRedisClient: () => ({
    set: mockSet,
  }),
}));

describe('acquireIdempotencyLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acquires the lock on first attempt (SET NX succeeds)', async () => {
    mockSet.mockResolvedValue('OK');

    const acquired = await acquireIdempotencyLock('key-1');

    expect(acquired).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      'key-1',
      '1',
      'EX',
      DEFAULT_IDEMPOTENCY_TTL_SECONDS,
      'NX'
    );
  });

  it('reports a duplicate when the key already exists (SET NX returns null)', async () => {
    mockSet.mockResolvedValue(null);

    const acquired = await acquireIdempotencyLock('key-1');

    expect(acquired).toBe(false);
  });

  it('honors a custom TTL', async () => {
    mockSet.mockResolvedValue('OK');

    await acquireIdempotencyLock('key-2', 60);

    expect(mockSet).toHaveBeenCalledWith('key-2', '1', 'EX', 60, 'NX');
  });

  it('fails open (treats as non-duplicate) when Redis errors', async () => {
    mockSet.mockRejectedValue(new Error('ECONNREFUSED'));

    const acquired = await acquireIdempotencyLock('key-3');

    expect(acquired).toBe(true);
  });
});
