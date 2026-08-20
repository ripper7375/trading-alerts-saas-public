/**
 * Admin Marketing Resource Detail API Route Tests
 *
 * Tests for DELETE /api/admin/resources/[id].
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

jest.mock('@/lib/auth/errors', () => {
  class AuthError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code = 'AUTH_ERROR', statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { __esModule: true, AuthError };
});

const mockDeleteAsset = jest.fn();
jest.mock('@/lib/marketing-resources/service', () => ({
  __esModule: true,
  deleteAsset: (...args: unknown[]) => mockDeleteAsset(...args),
}));

const mockDeleteAssetFile = jest.fn();
jest.mock('@/lib/marketing-resources/storage', () => ({
  __esModule: true,
  deleteAssetFile: (...args: unknown[]) => mockDeleteAssetFile(...args),
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/admin/resources/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { DELETE } = await import('@/app/api/admin/resources/[id]/route');
    const response = await DELETE({} as never, makeContext('asset-1'));

    expect(response.status).toBe(403);
    expect(mockDeleteAsset).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent asset', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteAsset.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/resources/[id]/route');
    const response = await DELETE({} as never, makeContext('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Asset not found');
    expect(mockDeleteAssetFile).not.toHaveBeenCalled();
  });

  it('deletes a file-backed asset and its blob', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteAsset.mockResolvedValue({
      id: 'asset-1',
      fileUrl:
        'https://x.public.blob.vercel-storage.com/marketing-resources/a.png',
    });

    const { DELETE } = await import('@/app/api/admin/resources/[id]/route');
    const response = await DELETE({} as never, makeContext('asset-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, id: 'asset-1' });
    expect(mockDeleteAssetFile).toHaveBeenCalledWith(
      'https://x.public.blob.vercel-storage.com/marketing-resources/a.png'
    );
  });

  it('deletes a SWIPE_COPY asset without touching storage', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteAsset.mockResolvedValue({ id: 'asset-2', fileUrl: null });

    const { DELETE } = await import('@/app/api/admin/resources/[id]/route');
    await DELETE({} as never, makeContext('asset-2'));

    expect(mockDeleteAssetFile).not.toHaveBeenCalled();
  });

  it('handles database errors', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteAsset.mockRejectedValue(new Error('DB error'));

    const { DELETE } = await import('@/app/api/admin/resources/[id]/route');
    const response = await DELETE({} as never, makeContext('asset-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete marketing asset');
  });
});
