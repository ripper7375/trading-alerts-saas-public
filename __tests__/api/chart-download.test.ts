/**
 * Chart Render Download API Route Tests
 *
 * Tests for GET /api/chart/download.
 *
 * Two things matter here. FREE -> 403: the renderer emits two variants
 * specifically so the M5-on-M15 overlay stays a PRO entitlement, and that is
 * worth nothing unless this route refuses a FREE caller. And the variant must
 * come from the caller's stored preference, so the file they download matches
 * the toggle state on their screen.
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

const mockGetM5OnM15Preference = jest.fn();
jest.mock('@/lib/preferences/server-preferences', () => ({
  __esModule: true,
  getM5OnM15Preference: (...args: unknown[]) =>
    mockGetM5OnM15Preference(...args),
}));

// Mocking r2.ts also keeps the AWS SDK out of this suite entirely — it ships
// ESM that Jest will not parse without loosening transformIgnorePatterns.
const mockGetSignedChartUrl = jest.fn();
jest.mock('@/lib/storage/r2', () => ({
  __esModule: true,
  getSignedChartUrl: (...args: unknown[]) => mockGetSignedChartUrl(...args),
}));

const PRO_SESSION = { user: { id: 'user-1', tier: 'PRO' } };

describe('GET /api/chart/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireChartDownload.mockResolvedValue(PRO_SESSION);
    mockGetM5OnM15Preference.mockResolvedValue(false);
    mockGetSignedChartUrl.mockResolvedValue(
      'https://r2.example.com/signed?sig=abc'
    );
  });

  it('returns 401 when the caller is not authenticated', async () => {
    mockRequireChartDownload.mockRejectedValue(
      new Error('UNAUTHORIZED: you must be logged in')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockGetSignedChartUrl).not.toHaveBeenCalled();
  });

  it('returns 403 for a FREE-tier caller and never mints a URL', async () => {
    mockRequireChartDownload.mockRejectedValue(
      new Error('PRO_REQUIRED: PRO subscription required')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('PRO subscription required');
    // The gate must short-circuit before any preference read or signing.
    expect(mockGetM5OnM15Preference).not.toHaveBeenCalled();
    expect(mockGetSignedChartUrl).not.toHaveBeenCalled();
  });

  it('serves the overlay variant when the toggle preference is on', async () => {
    mockGetM5OnM15Preference.mockResolvedValue(true);

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();

    expect(response.status).toBe(307);
    expect(mockGetM5OnM15Preference).toHaveBeenCalledWith('user-1');
    expect(mockGetSignedChartUrl).toHaveBeenCalledWith('overlay');
  });

  it('serves the standard variant when the toggle preference is off', async () => {
    mockGetM5OnM15Preference.mockResolvedValue(false);

    const { GET } = await import('@/app/api/chart/download/route');
    await GET();

    expect(mockGetSignedChartUrl).toHaveBeenCalledWith('standard');
  });

  it('redirects to the signed URL', async () => {
    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();

    expect(response.headers.get('location')).toBe(
      'https://r2.example.com/signed?sig=abc'
    );
  });

  it('returns 503 when R2 credentials are missing', async () => {
    mockGetSignedChartUrl.mockRejectedValue(
      new Error('R2_BUCKET is not set. The chart download requires...')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();
    const data = await response.json();

    // A misconfigured environment is not the caller's fault, and must not be
    // reported as a generic 500 that looks like a bug in the render pipeline.
    expect(response.status).toBe(503);
    expect(data.error).toContain('not configured');
  });
});
