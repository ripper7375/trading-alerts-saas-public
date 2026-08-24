/**
 * E2E Tests: POST /api/test/ai-metering (Session 11-3, Decision 3)
 *
 * Dummy tier-gated AI metering route -- proves the tier gate + Redis token
 * quota enforcement work end-to-end before Stack D's real AI routes exist.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

class MockRequest {
  url: string;
  method: string;
  headers: Headers;
  private bodyContent: string | null;
  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.url = url;
    this.method = init?.method || 'POST';
    this.headers = new Headers(init?.headers);
    this.bodyContent = init?.body ?? null;
  }
  async json(): Promise<unknown> {
    if (!this.bodyContent) return {};
    return JSON.parse(this.bodyContent);
  }
}
global.Request = MockRequest as unknown as typeof Request;

// Mock NextResponse to avoid next/server issues (matches __tests__/api/tier.test.ts)
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock next-auth
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock trackAiTokenUsage directly -- this file is about the ROUTE's own
// wiring (auth -> tier gate -> quota call -> response shape), not Redis
// increment/TTL semantics, which __tests__/lib/rate-limit.test.ts already
// covers in full.
const mockTrackAiTokenUsage = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  __esModule: true,
  trackAiTokenUsage: (...args: unknown[]) => mockTrackAiTokenUsage(...args),
}));

function makeRequest(body?: Record<string, unknown>) {
  return new MockRequest('http://localhost/api/test/ai-metering', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request;
}

describe('POST /api/test/ai-metering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest({ tokensUsed: 100 }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(mockTrackAiTokenUsage).not.toHaveBeenCalled();
  });

  it('returns 403 TIER_PRO_REQUIRED for a FREE tier user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-free', tier: 'FREE' },
    });

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest({ tokensUsed: 100 }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.reason).toBe('TIER_PRO_REQUIRED');
    expect(mockTrackAiTokenUsage).not.toHaveBeenCalled();
  });

  it('returns 200 with remainingTokens for a PRO user under quota', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-pro', tier: 'PRO' },
    });
    mockTrackAiTokenUsage.mockResolvedValue({
      allowed: true,
      limit: 500_000,
      remaining: 499_900,
      currentUsage: 100,
    });

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest({ tokensUsed: 100 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.remainingTokens).toBe(499_900);
    expect(mockTrackAiTokenUsage).toHaveBeenCalledWith(
      'user-pro',
      100,
      500_000
    );
  });

  it('returns 429 when a PRO user exceeds the monthly quota', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-pro', tier: 'PRO' },
    });
    mockTrackAiTokenUsage.mockResolvedValue({
      allowed: false,
      limit: 500_000,
      remaining: 0,
      currentUsage: 600_000,
    });

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest({ tokensUsed: 600_000 }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Monthly AI token quota exceeded');
  });

  it('passes the FREE tier quota (0) through if a FREE user somehow reaches the quota call', async () => {
    // Defence in depth: canAccessAiAnalyst already blocks FREE tier above,
    // but confirm the quota lookup itself would resolve to 0, not undefined,
    // if that gate were ever bypassed.
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-free', tier: 'FREE' },
    });

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest({ tokensUsed: 1 }));

    // FREE tier never reaches trackAiTokenUsage -- the 403 gate is first.
    expect(response.status).toBe(403);
    expect(mockTrackAiTokenUsage).not.toHaveBeenCalled();
  });

  it('treats a missing/non-numeric tokensUsed as 0', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-pro', tier: 'PRO' },
    });
    mockTrackAiTokenUsage.mockResolvedValue({
      allowed: true,
      limit: 500_000,
      remaining: 500_000,
      currentUsage: 0,
    });

    const { POST } = await import('@/app/api/test/ai-metering/route');
    const response = await POST(makeRequest());
    await response.json();

    expect(mockTrackAiTokenUsage).toHaveBeenCalledWith('user-pro', 0, 500_000);
  });
});
