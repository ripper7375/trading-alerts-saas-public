import { RedisService } from '../../redis/redis.service';
import { IdempotencyStore } from './idempotency.store';

describe('IdempotencyStore', () => {
  let store: IdempotencyStore;
  let mockClient: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockClient = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<RedisService>;
    store = new IdempotencyStore(redisService);
  });

  describe('claim', () => {
    it('returns true when the key was not previously set (SET NX succeeds)', async () => {
      mockClient.set.mockResolvedValue('OK');

      const claimed = await store.claim('key-1', 86400);

      expect(claimed).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'money:idempotency:key-1',
        '__IN_PROGRESS__',
        'EX',
        86400,
        'NX'
      );
    });

    it('returns false when the key already exists', async () => {
      mockClient.set.mockResolvedValue(null);

      const claimed = await store.claim('key-1', 86400);

      expect(claimed).toBe(false);
    });
  });

  describe('get', () => {
    it('returns null when the key has never been seen', async () => {
      mockClient.get.mockResolvedValue(null);

      expect(await store.get('key-1')).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('money:idempotency:key-1');
    });

    it("returns 'IN_PROGRESS' when the key is claimed but not yet resolved", async () => {
      mockClient.get.mockResolvedValue('__IN_PROGRESS__');

      expect(await store.get('key-1')).toBe('IN_PROGRESS');
    });

    it('returns the parsed record once a response has been cached', async () => {
      mockClient.get.mockResolvedValue(
        JSON.stringify({ statusCode: 201, body: { id: 'abc' } })
      );

      expect(await store.get('key-1')).toEqual({
        statusCode: 201,
        body: { id: 'abc' },
      });
    });
  });

  describe('save', () => {
    it('serializes and stores the record with the given TTL', async () => {
      mockClient.set.mockResolvedValue('OK');

      await store.save('key-1', { statusCode: 200, body: { ok: true } }, 86400);

      expect(mockClient.set).toHaveBeenCalledWith(
        'money:idempotency:key-1',
        JSON.stringify({ statusCode: 200, body: { ok: true } }),
        'EX',
        86400
      );
    });
  });

  describe('release', () => {
    it('deletes the key', async () => {
      mockClient.del.mockResolvedValue(1);

      await store.release('key-1');

      expect(mockClient.del).toHaveBeenCalledWith('money:idempotency:key-1');
    });
  });

  it('reuses the shared RedisService client rather than opening its own connection', async () => {
    mockClient.set.mockResolvedValue('OK');
    mockClient.get.mockResolvedValue(null);

    await store.claim('key-1', 86400);
    await store.get('key-2');

    expect(redisService.getClient).toHaveBeenCalled();
  });
});
