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
const mockGetChartStamp = jest.fn();
jest.mock('@/lib/storage/r2', () => ({
  __esModule: true,
  getSignedChartUrl: (...args: unknown[]) => mockGetSignedChartUrl(...args),
  getChartStamp: (...args: unknown[]) => mockGetChartStamp(...args),
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
    mockGetChartStamp.mockResolvedValue(null);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    mockRequireChartDownload.mockRejectedValue(
      new Error('UNAUTHORIZED: you must be logged in')
    );

    const { GET } = await import('@/app/api/chart/download/route');
    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockGetSignedChartUrl).not.toHaveBeenCalled();
    expect(mockGetChartStamp).not.toHaveBeenCalled();
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
    expect(mockGetChartStamp).not.toHaveBeenCalled();
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

  describe('the chart stamp (rule 8, ADR-014)', () => {
    const SLOT = 1789764900;
    const stamp = {
      slot: SLOT,
      lastClosedBar: SLOT - 300,
      overlay: 'best_fit_a',
      variant: 'overlay' as const,
      renderedAt: SLOT + 70,
      overlayM15: 'non_b',
      overlaySource: 'setting' as const,
    };
    type Redirect = { status: number; headers: Map<string, string> };
    const stampHeaderNames = (response: Redirect) =>
      [...response.headers.keys()].filter((k) => k.startsWith('X-Chart'));

    it('puts the stamp on the redirect as X-Chart-* headers', async () => {
      mockGetM5OnM15Preference.mockResolvedValue(true);
      mockGetChartStamp.mockResolvedValue(stamp);

      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;

      expect(response.status).toBe(307);
      expect(response.headers.get('X-Chart-Slot')).toBe(String(SLOT));
      expect(response.headers.get('X-Chart-Last-Closed-Bar')).toBe(
        String(SLOT - 300)
      );
      expect(response.headers.get('X-Chart-Overlay')).toBe('best_fit_a');
      expect(response.headers.get('X-Chart-Variant')).toBe('overlay');
      expect(response.headers.get('X-Chart-Rendered-At')).toBe(
        String(SLOT + 70)
      );
      expect(response.headers.get('X-Chart-Overlay-M15')).toBe('non_b');
      expect(response.headers.get('X-Chart-Overlay-Source')).toBe('setting');
    });

    it('still redirects to the signed URL, whatever the stamp says', async () => {
      mockGetChartStamp.mockResolvedValue({
        ...stamp,
        slot: SLOT - 86400,
        lastClosedBar: SLOT - 86700,
      });
      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;
      // an image from another day is served, labelled: the stamp informs, it never gates
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://r2.example.com/signed?sig=abc'
      );
    });

    it('reads the stamp of the variant it is serving', async () => {
      mockGetM5OnM15Preference.mockResolvedValue(true);
      const { GET } = await import('@/app/api/chart/download/route');
      await GET();
      expect(mockGetChartStamp).toHaveBeenLastCalledWith('overlay');

      mockGetM5OnM15Preference.mockResolvedValue(false);
      await GET();
      expect(mockGetChartStamp).toHaveBeenLastCalledWith('standard');
      expect(mockGetSignedChartUrl).toHaveBeenLastCalledWith('standard');
    });

    it('serves an image that has no stamp (from before stamping) exactly as before: no X-Chart headers', async () => {
      mockGetChartStamp.mockResolvedValue(null);
      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://r2.example.com/signed?sig=abc'
      );
      expect(stampHeaderNames(response)).toEqual([]);
    });

    it('leaves out the optional headers an image does not have', async () => {
      mockGetChartStamp.mockResolvedValue({
        slot: SLOT,
        lastClosedBar: SLOT - 300,
        overlay: 'best_fit_a',
        variant: 'standard',
      });
      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;
      expect(stampHeaderNames(response).sort()).toEqual([
        'X-Chart-Last-Closed-Bar',
        'X-Chart-Overlay',
        'X-Chart-Slot',
        'X-Chart-Variant',
      ]);
    });

    it('a stamp that cannot be read costs the headers and nothing else: the download is still served', async () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockGetChartStamp.mockRejectedValue(new Error('R2 HEAD timed out'));

      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://r2.example.com/signed?sig=abc'
      );
      expect(stampHeaderNames(response)).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('could not read the chart stamp'),
        expect.any(Error)
      );
      warn.mockRestore();
    });

    it('signs first and reads the stamp after, so a missing R2 configuration is still the signing call’s 503', async () => {
      mockGetSignedChartUrl.mockRejectedValue(
        new Error('R2_BUCKET is not set. The chart download requires...')
      );
      const { GET } = await import('@/app/api/chart/download/route');
      const failed = await GET();
      expect(failed.status).toBe(503);
      expect(mockGetChartStamp).not.toHaveBeenCalled();

      mockGetSignedChartUrl.mockResolvedValue(
        'https://r2.example.com/signed?sig=abc'
      );
      await GET();
      expect(mockGetSignedChartUrl.mock.invocationCallOrder[1]).toBeLessThan(
        mockGetChartStamp.mock.invocationCallOrder[0]
      );
    });

    it('an unexpected signing failure is still a 500, with no stamp read', async () => {
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockGetSignedChartUrl.mockRejectedValue(
        new Error('something else broke')
      );
      const { GET } = await import('@/app/api/chart/download/route');
      const response = await GET();
      expect(response.status).toBe(500);
      expect(mockGetChartStamp).not.toHaveBeenCalled();
      error.mockRestore();
    });

    it('exposes nothing but the stamp: the headers are the stamp’s fields and the redirect location', async () => {
      mockGetChartStamp.mockResolvedValue(stamp);
      const { GET } = await import('@/app/api/chart/download/route');
      const response = (await GET()) as unknown as Redirect;
      expect([...response.headers.keys()].sort()).toEqual([
        'X-Chart-Last-Closed-Bar',
        'X-Chart-Overlay',
        'X-Chart-Overlay-M15',
        'X-Chart-Overlay-Source',
        'X-Chart-Rendered-At',
        'X-Chart-Slot',
        'X-Chart-Variant',
        'location',
      ]);
    });
  });
});
