/**
 * Chart Render Download API Route Tests
 *
 * Tests for GET /api/chart/download.
 *
 * The case that matters most is FREE -> 403: the renderer emits two variants
 * specifically so the M5-on-M15 overlay stays a PRO entitlement, and that is
 * worth nothing unless this route actually refuses a FREE caller.
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

const mockRequireChartDownload = jest.fn();
jest.mock('@/lib/auth/permissions', () => ({
  __esModule: true,
  requireChartDownload: () => mockRequireChartDownload(),
}));

// Mocked so the route's error mapping can be driven directly. Mocking r2.ts
// also keeps the AWS SDK out of this suite entirely -- it ships ESM that Jest
// will not parse without loosening the shared transformIgnorePatterns.
const mockGetSignedChartUrl = jest.fn();
jest.mock('@/lib/storage/r2', () => ({
  __esModule: true,
  getSignedChartUrl: (...args: unknown[]) => mockGetSignedChartUrl(...args),
}));

// Real behaviour, not a stub: variant coercion is part of what is under test.
jest.mock('@/lib/storage/chart-keys', () => {
  const VARIANTS = ['overlay', 'standard'];
  return {
    __esModule: true,
    parseChartVariant: (value: string | null) =>
      VARIANTS.includes(value as string) ? value : 'overlay',
  };
});

function makeRequest(variant?: string) {
  const url = new URL('http://localhost/api/chart/download');
  if (variant !== undefined) {
    url.searchParams.set('variant', variant);
  }
  return { nextUrl: url } as never;
}

describe('GET /api/chart/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSignedChartUrl.mockResolvedValue(
      'https://r2.example.com/signed?sig=abc'
    );
  });

  it('returns 401 when the caller is not authenticated', async () => {
    mockRequireChartDownload.mockRejectedValue(
      new Error('UNAUTHORIZED: you must be logged in')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockGetSignedChartUrl).not.toHaveBeenCalled();
  });

  it('returns 403 for a FREE-tier caller and never mints a URL', async () => {
    mockRequireChartDownload.mockRejectedValue(
      new Error('PRO_REQUIRED: PRO subscription required')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('PRO subscription required');
    // The gate must short-circuit before any signing happens.
    expect(mockGetSignedChartUrl).not.toHaveBeenCalled();
  });

  it('redirects a PRO caller to the signed URL', async () => {
    mockRequireChartDownload.mockResolvedValue(undefined);

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://r2.example.com/signed?sig=abc'
    );
    expect(mockGetSignedChartUrl).toHaveBeenCalledWith('overlay');
  });

  it('honours ?variant=standard', async () => {
    mockRequireChartDownload.mockResolvedValue(undefined);

    const { GET } = await import('@/app/api/chart/download/route');
    await GET(makeRequest('standard'));

    expect(mockGetSignedChartUrl).toHaveBeenCalledWith('standard');
  });

  it('falls back to overlay for an unknown variant rather than erroring', async () => {
    mockRequireChartDownload.mockResolvedValue(undefined);

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET(makeRequest('garbage'));

    expect(response.status).toBe(307);
    expect(mockGetSignedChartUrl).toHaveBeenCalledWith('overlay');
  });

  it('returns 503 when R2 credentials are missing', async () => {
    mockRequireChartDownload.mockResolvedValue(undefined);
    mockGetSignedChartUrl.mockRejectedValue(
      new Error('R2_BUCKET is not set. The chart download requires...')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    // A misconfigured environment is not the caller's fault, and must not be
    // reported as a generic 500 that looks like a bug in the render pipeline.
    expect(response.status).toBe(503);
    expect(data.error).toContain('not configured');
  });
});
