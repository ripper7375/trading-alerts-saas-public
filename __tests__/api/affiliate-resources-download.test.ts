/**
 * Affiliate Resource Download API Route Tests
 *
 * Tests for GET /api/affiliate/dashboard/resources/[id]/download.
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
    redirect: (url: string | URL, init?: { status?: number }) => ({
      status: init?.status || 307,
      headers: new Map([['location', url.toString()]]),
      json: async () => ({}),
    }),
  },
}));

const mockRequireAffiliate = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
}));

const mockRecordAssetEngagement = jest.fn();
jest.mock('@/lib/marketing-resources/service', () => ({
  __esModule: true,
  recordAssetEngagement: (...args: unknown[]) =>
    mockRecordAssetEngagement(...args),
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest() {
  return {
    url: 'http://localhost/api/affiliate/dashboard/resources/x/download',
  } as never;
}

describe('GET /api/affiliate/dashboard/resources/[id]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an affiliate', async () => {
    mockRequireAffiliate.mockRejectedValue(new Error('AFFILIATE_REQUIRED'));

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('asset-1'));

    expect(response.status).toBe(403);
    expect(mockRecordAssetEngagement).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent or unpublished asset', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue(null);

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Asset not found');
  });

  it('rejects a SWIPE_COPY asset (no downloadable file)', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue({
      id: 'asset-1',
      category: 'SWIPE_COPY',
      fileUrl: null,
    });

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('asset-1'));

    expect(response.status).toBe(400);
  });

  it('increments the counter and redirects to the real file URL', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue({
      id: 'asset-1',
      category: 'BRAND_LOGOS',
      fileUrl:
        'https://x.public.blob.vercel-storage.com/marketing-resources/logo.png',
    });

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('asset-1'));

    expect(mockRecordAssetEngagement).toHaveBeenCalledWith('asset-1');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://x.public.blob.vercel-storage.com/marketing-resources/logo.png'
    );
  });

  it('resolves a relative /public fileUrl (seeded assets) against the request origin', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue({
      id: 'asset-1',
      category: 'BRAND_LOGOS',
      fileUrl: '/marketing-icon.svg',
    });

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('asset-1'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/marketing-icon.svg'
    );
  });

  it('handles service errors', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockRejectedValue(new Error('DB error'));

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/download/route'
    );
    const response = await GET(makeRequest(), makeContext('asset-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to process download');
  });
});
