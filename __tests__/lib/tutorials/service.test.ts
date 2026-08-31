/**
 * Academy Tutorials Service Tests
 */

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockAggregate = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    tutorialVideo: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import {
  listTutorialsForAdmin,
  createTutorial,
  updateTutorial,
  deleteTutorial,
  listPublishedTutorials,
  getPublishedTutorialById,
  getRelatedTutorials,
} from '@/lib/tutorials/service';

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VALID_ID = 'dQw4w9WgXcQ';

describe('listTutorialsForAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds a case-insensitive title search filter, orders featured-first, and returns aggregate stats', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue({ _sum: { viewCount: 42 } });

    const result = await listTutorialsForAdmin({
      search: 'Order Book',
      page: 1,
      limit: 50,
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { title: { contains: 'Order Book', mode: 'insensitive' } },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      })
    );
    expect(result.totalViews).toBe(42);
    expect(result.categoryCount).toBe(5);
  });

  it('defaults totalViews to 0 when there are no tutorials yet', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue({ _sum: { viewCount: null } });

    const result = await listTutorialsForAdmin({ page: 1, limit: 50 });

    expect(result.totalViews).toBe(0);
  });
});

describe('createTutorial', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws when the YouTube URL cannot be parsed', async () => {
    await expect(
      createTutorial({
        title: 'x',
        description: 'y',
        youtubeUrl: 'https://vimeo.com/123',
        category: 'GETTING_STARTED',
        featured: false,
        createdByUserId: 'admin-1',
      })
    ).rejects.toThrow('INVALID_YOUTUBE_URL');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('parses the video ID and always forces status ACTIVE', async () => {
    mockCreate.mockResolvedValue({ id: 'tut-1' });

    await createTutorial({
      title: 'Reading the Order Book',
      description: 'Order-book depth and liquidity sweeps.',
      youtubeUrl: VALID_URL,
      category: 'TRADING_STRATEGIES',
      featured: true,
      createdByUserId: 'admin-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        youtubeUrl: VALID_URL,
        youtubeVideoId: VALID_ID,
        category: 'TRADING_STRATEGIES',
        featured: true,
        status: 'ACTIVE',
        createdByUserId: 'admin-1',
      }),
    });
  });
});

describe('updateTutorial', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when Prisma reports the record was not found (P2025)', async () => {
    mockUpdate.mockRejectedValue({ code: 'P2025' });

    const result = await updateTutorial('missing', { status: 'ARCHIVED' });

    expect(result).toBeNull();
  });

  it('rethrows unexpected errors', async () => {
    mockUpdate.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateTutorial('tut-1', { status: 'ARCHIVED' })
    ).rejects.toThrow('connection lost');
  });

  it('patches only the fields provided, without touching youtubeVideoId', async () => {
    mockUpdate.mockResolvedValue({ id: 'tut-1', status: 'ARCHIVED' });

    await updateTutorial('tut-1', { status: 'ARCHIVED' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'tut-1' },
      data: { status: 'ARCHIVED' },
    });
  });

  it('re-parses youtubeVideoId when youtubeUrl is part of the patch', async () => {
    mockUpdate.mockResolvedValue({ id: 'tut-1' });

    await updateTutorial('tut-1', { youtubeUrl: VALID_URL });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'tut-1' },
      data: { youtubeUrl: VALID_URL, youtubeVideoId: VALID_ID },
    });
  });

  it('throws INVALID_YOUTUBE_URL when the patched URL cannot be parsed', async () => {
    await expect(
      updateTutorial('tut-1', { youtubeUrl: 'https://vimeo.com/123' })
    ).rejects.toThrow('INVALID_YOUTUBE_URL');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('deleteTutorial', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when Prisma reports the record was not found (P2025)', async () => {
    mockDelete.mockRejectedValue({ code: 'P2025' });

    const result = await deleteTutorial('missing');

    expect(result).toBeNull();
  });

  it('rethrows unexpected errors', async () => {
    mockDelete.mockRejectedValue(new Error('connection lost'));

    await expect(deleteTutorial('tut-1')).rejects.toThrow('connection lost');
  });

  it('returns the deleted tutorial on success', async () => {
    mockDelete.mockResolvedValue({ id: 'tut-1' });

    const result = await deleteTutorial('tut-1');

    expect(result).toEqual({ id: 'tut-1' });
  });
});

describe('listPublishedTutorials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always scopes to ACTIVE status and orders featured-first', async () => {
    mockFindMany.mockResolvedValue([]);

    await listPublishedTutorials({});

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      })
    );
  });

  it('adds a category filter when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listPublishedTutorials({ category: 'RISK_MANAGEMENT' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', category: 'RISK_MANAGEMENT' },
      })
    );
  });
});

describe('getPublishedTutorialById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null for a non-existent tutorial', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getPublishedTutorialById('missing');

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns null for a tutorial that is not ACTIVE (DRAFT/ARCHIVED never publicly reachable)', async () => {
    mockFindUnique.mockResolvedValue({ id: 'tut-1', status: 'DRAFT' });

    const result = await getPublishedTutorialById('tut-1');

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('atomically increments viewCount for an ACTIVE tutorial', async () => {
    mockFindUnique.mockResolvedValue({ id: 'tut-1', status: 'ACTIVE' });
    mockUpdate.mockResolvedValue({ id: 'tut-1', viewCount: 6 });

    const result = await getPublishedTutorialById('tut-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'tut-1' },
      data: { viewCount: { increment: 1 } },
    });
    expect(result?.viewCount).toBe(6);
  });
});

describe('getRelatedTutorials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scopes to ACTIVE status, the same category, and excludes the current tutorial', async () => {
    mockFindMany.mockResolvedValue([]);

    await getRelatedTutorials('MARKET_ANALYSIS', 'tut-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          category: 'MARKET_ANALYSIS',
          id: { not: 'tut-1' },
        },
        take: 3,
      })
    );
  });

  it('respects a custom limit', async () => {
    mockFindMany.mockResolvedValue([]);

    await getRelatedTutorials('MARKET_ANALYSIS', 'tut-1', 5);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});
