/**
 * Admin Marketing Resources API Route Tests
 *
 * Tests for GET/POST /api/admin/resources.
 */

// Mock NextResponse
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock auth/session
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

// Mock the service + storage layers
const mockListAssetsForAdmin = jest.fn();
const mockCreateAsset = jest.fn();
jest.mock('@/lib/marketing-resources/service', () => ({
  __esModule: true,
  listAssetsForAdmin: (...args: unknown[]) => mockListAssetsForAdmin(...args),
  createAsset: (...args: unknown[]) => mockCreateAsset(...args),
}));

const mockUploadAssetFile = jest.fn();
jest.mock('@/lib/marketing-resources/storage', () => ({
  __esModule: true,
  uploadAssetFile: (...args: unknown[]) => mockUploadAssetFile(...args),
}));

function makeGetRequest(url: string) {
  const parsed = new URL(url);
  return {
    nextUrl: { searchParams: parsed.searchParams },
  } as never;
}

// jsdom's FormData silently stringifies File values on `.set()` (a
// jsdom-only limitation — Next.js Route Handlers run on real Node/Web APIs
// in production, where File survives FormData unchanged). This stand-in
// keeps real File instances intact for `formData.get('file') instanceof
// File` checks in the route under test.
class FakeFormData {
  private fields = new Map<string, FormDataEntryValue>();
  set(key: string, value: FormDataEntryValue): void {
    this.fields.set(key, value);
  }
  get(key: string): FormDataEntryValue | null {
    return this.fields.get(key) ?? null;
  }
}

function makePostRequest(formData: FakeFormData) {
  return { formData: async () => formData } as never;
}

describe('GET /api/admin/resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401/403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { GET } = await import('@/app/api/admin/resources/route');
    const response = await GET(
      makeGetRequest('http://localhost/api/admin/resources')
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You must be an administrator');
  });

  it('lists assets with parsed query filters', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockListAssetsForAdmin.mockResolvedValue({
      assets: [],
      total: 0,
      page: 1,
      limit: 50,
      totalDownloads: 0,
      categoryCount: 5,
    });

    const { GET } = await import('@/app/api/admin/resources/route');
    const response = await GET(
      makeGetRequest(
        'http://localhost/api/admin/resources?search=logo&category=BRAND_LOGOS'
      )
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockListAssetsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'logo', category: 'BRAND_LOGOS' })
    );
    expect(data.categoryCount).toBe(5);
  });

  it('rejects an invalid category filter', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const { GET } = await import('@/app/api/admin/resources/route');
    const response = await GET(
      makeGetRequest('http://localhost/api/admin/resources?category=NOT_REAL')
    );

    expect(response.status).toBe(400);
    expect(mockListAssetsForAdmin).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(new FakeFormData()));

    expect(response.status).toBe(403);
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('rejects a non-SWIPE_COPY asset with no file attached', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const form = new FakeFormData();
    form.set('title', 'New Banner');
    form.set('category', 'AD_BANNERS');

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('A file is required for this asset category');
    expect(mockUploadAssetFile).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('rejects a file whose MIME type is not in the accepted allowlist', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const form = new FakeFormData();
    form.set('title', 'Suspicious Upload');
    form.set('category', 'AD_BANNERS');
    form.set(
      'file',
      new File(['<html></html>'], 'not-a-banner.html', {
        type: 'text/html',
      })
    );

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unsupported file type "text/html"');
    expect(data.error).toContain('PNG');
    expect(data.error).toContain('MP4');
    expect(mockUploadAssetFile).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('accepts an MP4 upload (part of the allowlist)', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUploadAssetFile.mockResolvedValue({
      url: 'https://example.public.blob.vercel-storage.com/marketing-resources/promo-abc123.mp4',
      size: 4_000_000,
    });
    mockCreateAsset.mockResolvedValue({ id: 'asset-3', title: 'Promo Clip' });

    const form = new FakeFormData();
    form.set('title', 'Promo Clip');
    form.set('category', 'AD_BANNERS');
    form.set('format', 'MP4');
    form.set(
      'file',
      new File(['fake-video-bytes'], 'promo.mp4', { type: 'video/mp4' })
    );

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));

    expect(mockUploadAssetFile).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it('uploads the file and creates a file-backed asset', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUploadAssetFile.mockResolvedValue({
      url: 'https://example.public.blob.vercel-storage.com/marketing-resources/banner-abc123.png',
      size: 12345,
    });
    mockCreateAsset.mockResolvedValue({ id: 'asset-1', title: 'New Banner' });

    const form = new FakeFormData();
    form.set('title', 'New Banner');
    form.set('category', 'AD_BANNERS');
    form.set('format', 'PNG');
    form.set(
      'file',
      new File(['fake-bytes'], 'banner.png', { type: 'image/png' })
    );

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));
    const data = await response.json();

    expect(mockUploadAssetFile).toHaveBeenCalledTimes(1);
    expect(mockCreateAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Banner',
        category: 'AD_BANNERS',
        fileUrl: expect.stringContaining('blob.vercel-storage.com'),
        fileSize: 12345,
        createdByUserId: 'admin-1',
      })
    );
    expect(response.status).toBe(201);
    expect(data.asset.id).toBe('asset-1');
  });

  it('creates a SWIPE_COPY asset with copyText and no file upload', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockCreateAsset.mockResolvedValue({ id: 'asset-2', title: 'New Swipe' });

    const form = new FakeFormData();
    form.set('title', 'New Swipe');
    form.set('category', 'SWIPE_COPY');
    form.set('copyText', 'Check out DavinTrade AI!');

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));

    expect(mockUploadAssetFile).not.toHaveBeenCalled();
    expect(mockCreateAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'SWIPE_COPY',
        copyText: 'Check out DavinTrade AI!',
        fileUrl: undefined,
      })
    );
    expect(response.status).toBe(201);
  });

  it('rejects a SWIPE_COPY asset with no copyText', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const form = new FakeFormData();
    form.set('title', 'Empty Swipe');
    form.set('category', 'SWIPE_COPY');

    const { POST } = await import('@/app/api/admin/resources/route');
    const response = await POST(makePostRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('copyText is required for SWIPE_COPY assets');
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });
});
