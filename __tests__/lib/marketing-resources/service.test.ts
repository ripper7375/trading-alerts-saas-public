/**
 * Marketing Resources Service Tests
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
    marketingAsset: {
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
  listAssetsForAdmin,
  createAsset,
  deleteAsset,
  listPublishedAssets,
  recordAssetEngagement,
} from '@/lib/marketing-resources/service';

describe('listAssetsForAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds a case-insensitive title search filter and returns aggregate stats', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue({ _sum: { downloadCount: 42 } });

    const result = await listAssetsForAdmin({
      search: 'Banner',
      page: 1,
      limit: 50,
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { title: { contains: 'Banner', mode: 'insensitive' } },
      })
    );
    expect(result.totalDownloads).toBe(42);
    expect(result.categoryCount).toBe(5);
  });

  it('defaults totalDownloads to 0 when there are no assets yet', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue({ _sum: { downloadCount: null } });

    const result = await listAssetsForAdmin({ page: 1, limit: 50 });

    expect(result.totalDownloads).toBe(0);
  });
});

describe('createAsset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws when a SWIPE_COPY asset has no copyText', async () => {
    await expect(
      createAsset({
        title: 'x',
        category: 'SWIPE_COPY',
        createdByUserId: 'admin-1',
      })
    ).rejects.toThrow('COPY_TEXT_REQUIRED');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('throws when a non-SWIPE_COPY asset has no file', async () => {
    await expect(
      createAsset({
        title: 'x',
        category: 'BRAND_LOGOS',
        createdByUserId: 'admin-1',
      })
    ).rejects.toThrow('FILE_REQUIRED');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a file-backed asset with fileUrl/fileSize and null copyText', async () => {
    mockCreate.mockResolvedValue({ id: 'asset-1' });

    await createAsset({
      title: 'Logo',
      category: 'BRAND_LOGOS',
      format: 'PNG',
      resolution: '512x512',
      fileUrl: 'https://blob/x.png',
      fileSize: 100,
      createdByUserId: 'admin-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileUrl: 'https://blob/x.png',
        fileSize: 100,
        copyText: null,
        status: 'ACTIVE',
      }),
    });
  });

  it('creates a SWIPE_COPY asset with copyText and null file fields', async () => {
    mockCreate.mockResolvedValue({ id: 'asset-2' });

    await createAsset({
      title: 'Swipe',
      category: 'SWIPE_COPY',
      copyText: 'hello',
      createdByUserId: 'admin-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: 'TXT',
        resolution: 'Text Copy',
        fileUrl: null,
        fileSize: null,
        copyText: 'hello',
      }),
    });
  });
});

describe('deleteAsset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when Prisma reports the record was not found (P2025)', async () => {
    mockDelete.mockRejectedValue({ code: 'P2025' });

    const result = await deleteAsset('missing');

    expect(result).toBeNull();
  });

  it('rethrows unexpected errors', async () => {
    mockDelete.mockRejectedValue(new Error('connection lost'));

    await expect(deleteAsset('asset-1')).rejects.toThrow('connection lost');
  });

  it('returns the deleted asset on success', async () => {
    mockDelete.mockResolvedValue({ id: 'asset-1' });

    const result = await deleteAsset('asset-1');

    expect(result).toEqual({ id: 'asset-1' });
  });
});

describe('listPublishedAssets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always scopes to ACTIVE status', async () => {
    mockFindMany.mockResolvedValue([]);

    await listPublishedAssets({});

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } })
    );
  });

  it('adds a category filter when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listPublishedAssets({ category: 'SWIPE_COPY' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', category: 'SWIPE_COPY' },
      })
    );
  });
});

describe('recordAssetEngagement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null for a non-existent asset', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await recordAssetEngagement('missing');

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns null for an asset that is not ACTIVE (no enumeration of DRAFT/ARCHIVED)', async () => {
    mockFindUnique.mockResolvedValue({ id: 'asset-1', status: 'DRAFT' });

    const result = await recordAssetEngagement('asset-1');

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('atomically increments downloadCount for an ACTIVE asset', async () => {
    mockFindUnique.mockResolvedValue({ id: 'asset-1', status: 'ACTIVE' });
    mockUpdate.mockResolvedValue({ id: 'asset-1', downloadCount: 6 });

    const result = await recordAssetEngagement('asset-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { downloadCount: { increment: 1 } },
    });
    expect(result?.downloadCount).toBe(6);
  });
});
