import { RedisService } from '../redis/redis.service';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    ttl: jest.Mock;
    scan: jest.Mock;
  };
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
      scan: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<RedisService>;
    service = new CacheService(redisService);
  });

  describe('get', () => {
    it('returns null when the key does not exist', async () => {
      mockClient.get.mockResolvedValue(null);

      expect(await service.get('missing')).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('money:cache:missing');
    });

    it('parses and returns the stored value', async () => {
      mockClient.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      expect(await service.get<{ a: number }>('key-1')).toEqual({ a: 1 });
      expect(mockClient.get).toHaveBeenCalledWith('money:cache:key-1');
    });
  });

  describe('set', () => {
    it('serializes the value with no TTL when ttlSeconds is omitted', async () => {
      await service.set('key-1', { a: 1 });

      expect(mockClient.set).toHaveBeenCalledWith(
        'money:cache:key-1',
        JSON.stringify({ a: 1 })
      );
    });

    it('serializes the value with EX when ttlSeconds is given', async () => {
      await service.set('key-1', { a: 1 }, 60);

      expect(mockClient.set).toHaveBeenCalledWith(
        'money:cache:key-1',
        JSON.stringify({ a: 1 }),
        'EX',
        60
      );
    });
  });

  describe('del', () => {
    it('deletes the prefixed key', async () => {
      await service.del('key-1');

      expect(mockClient.del).toHaveBeenCalledWith('money:cache:key-1');
    });
  });

  describe('ttl', () => {
    it('returns the remaining TTL for the prefixed key', async () => {
      mockClient.ttl.mockResolvedValue(42);

      expect(await service.ttl('key-1')).toBe(42);
      expect(mockClient.ttl).toHaveBeenCalledWith('money:cache:key-1');
    });
  });

  describe('flushPattern', () => {
    it('returns 0 without calling del when no keys match', async () => {
      mockClient.scan.mockResolvedValue(['0', []]);

      const deleted = await service.flushPattern('session:*');

      expect(deleted).toBe(0);
      expect(mockClient.del).not.toHaveBeenCalled();
      expect(mockClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'money:cache:session:*',
        'COUNT',
        100
      );
    });

    it('deletes every key found across a single scan batch', async () => {
      mockClient.scan.mockResolvedValue([
        '0',
        ['money:cache:session:a', 'money:cache:session:b'],
      ]);
      mockClient.del.mockResolvedValue(2);

      const deleted = await service.flushPattern('session:*');

      expect(deleted).toBe(2);
      expect(mockClient.del).toHaveBeenCalledWith(
        'money:cache:session:a',
        'money:cache:session:b'
      );
    });

    it('iterates until the cursor returns to 0 across multiple scan batches', async () => {
      mockClient.scan
        .mockResolvedValueOnce(['17', ['money:cache:session:a']])
        .mockResolvedValueOnce(['0', ['money:cache:session:b']]);
      mockClient.del.mockResolvedValue(2);

      const deleted = await service.flushPattern('session:*');

      expect(mockClient.scan).toHaveBeenCalledTimes(2);
      expect(deleted).toBe(2);
      expect(mockClient.del).toHaveBeenCalledWith(
        'money:cache:session:a',
        'money:cache:session:b'
      );
    });
  });
});
