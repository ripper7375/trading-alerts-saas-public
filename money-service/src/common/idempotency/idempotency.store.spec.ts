import { IdempotencyStore } from './idempotency.store';

const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: mockSet,
    get: mockGet,
    del: mockDel,
  }));
});

describe('IdempotencyStore', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new IdempotencyStore();
  });

  describe('claim', () => {
    it('returns true when the key was not previously set (SET NX succeeds)', async () => {
      mockSet.mockResolvedValue('OK');

      const claimed = await store.claim('key-1', 86400);

      expect(claimed).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        'key-1',
        '__IN_PROGRESS__',
        'EX',
        86400,
        'NX'
      );
    });

    it('returns false when the key already exists', async () => {
      mockSet.mockResolvedValue(null);

      const claimed = await store.claim('key-1', 86400);

      expect(claimed).toBe(false);
    });
  });

  describe('get', () => {
    it('returns null when the key has never been seen', async () => {
      mockGet.mockResolvedValue(null);

      expect(await store.get('key-1')).toBeNull();
    });

    it("returns 'IN_PROGRESS' when the key is claimed but not yet resolved", async () => {
      mockGet.mockResolvedValue('__IN_PROGRESS__');

      expect(await store.get('key-1')).toBe('IN_PROGRESS');
    });

    it('returns the parsed record once a response has been cached', async () => {
      mockGet.mockResolvedValue(
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
      mockSet.mockResolvedValue('OK');

      await store.save('key-1', { statusCode: 200, body: { ok: true } }, 86400);

      expect(mockSet).toHaveBeenCalledWith(
        'key-1',
        JSON.stringify({ statusCode: 200, body: { ok: true } }),
        'EX',
        86400
      );
    });
  });

  describe('release', () => {
    it('deletes the key', async () => {
      mockDel.mockResolvedValue(1);

      await store.release('key-1');

      expect(mockDel).toHaveBeenCalledWith('key-1');
    });
  });

  it('reuses the same underlying Redis client instance across calls', async () => {
    mockSet.mockResolvedValue('OK');
    mockGet.mockResolvedValue(null);

    await store.claim('key-1', 86400);
    await store.get('key-2');

    const RedisMock = jest.requireMock('ioredis') as jest.Mock;
    expect(RedisMock).toHaveBeenCalledTimes(1);
  });
});
