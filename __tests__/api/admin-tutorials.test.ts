/**
 * Admin Academy Tutorials API Route Tests
 *
 * Tests for GET/POST /api/admin/tutorials.
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

const mockListTutorialsForAdmin = jest.fn();
const mockCreateTutorial = jest.fn();
jest.mock('@/lib/tutorials/service', () => ({
  __esModule: true,
  listTutorialsForAdmin: (...args: unknown[]) =>
    mockListTutorialsForAdmin(...args),
  createTutorial: (...args: unknown[]) => mockCreateTutorial(...args),
}));

function makeGetRequest(url: string) {
  const parsed = new URL(url);
  return {
    nextUrl: { searchParams: parsed.searchParams },
  } as never;
}

function makePostRequest(body: unknown) {
  return { json: async () => body } as never;
}

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('GET /api/admin/tutorials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401/403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { GET } = await import('@/app/api/admin/tutorials/route');
    const response = await GET(
      makeGetRequest('http://localhost/api/admin/tutorials')
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You must be an administrator');
  });

  it('lists tutorials with parsed query filters', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockListTutorialsForAdmin.mockResolvedValue({
      tutorials: [],
      total: 0,
      page: 1,
      limit: 50,
      totalViews: 0,
      categoryCount: 5,
    });

    const { GET } = await import('@/app/api/admin/tutorials/route');
    const response = await GET(
      makeGetRequest(
        'http://localhost/api/admin/tutorials?search=risk&category=RISK_MANAGEMENT'
      )
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockListTutorialsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'risk',
        category: 'RISK_MANAGEMENT',
      })
    );
    expect(data.categoryCount).toBe(5);
  });

  it('rejects an invalid category filter', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const { GET } = await import('@/app/api/admin/tutorials/route');
    const response = await GET(
      makeGetRequest('http://localhost/api/admin/tutorials?category=NOT_REAL')
    );

    expect(response.status).toBe(400);
    expect(mockListTutorialsForAdmin).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/tutorials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { POST } = await import('@/app/api/admin/tutorials/route');
    const response = await POST(makePostRequest({}));

    expect(response.status).toBe(403);
    expect(mockCreateTutorial).not.toHaveBeenCalled();
  });

  it('rejects an invalid JSON body', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const { POST } = await import('@/app/api/admin/tutorials/route');
    const response = await POST({
      json: async () => {
        throw new Error('bad json');
      },
    } as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON body');
    expect(mockCreateTutorial).not.toHaveBeenCalled();
  });

  it('rejects a non-YouTube URL', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const { POST } = await import('@/app/api/admin/tutorials/route');
    const response = await POST(
      makePostRequest({
        title: 'Bad Video',
        description: 'x',
        youtubeUrl: 'https://vimeo.com/123',
        category: 'GETTING_STARTED',
      })
    );

    expect(response.status).toBe(400);
    expect(mockCreateTutorial).not.toHaveBeenCalled();
  });

  it('creates a tutorial and forces createdByUserId from the session', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockCreateTutorial.mockResolvedValue({
      id: 'tut-1',
      title: 'Reading the Order Book',
    });

    const { POST } = await import('@/app/api/admin/tutorials/route');
    const response = await POST(
      makePostRequest({
        title: 'Reading the Order Book',
        description: 'Order-book depth and liquidity sweeps.',
        youtubeUrl: VALID_URL,
        category: 'TRADING_STRATEGIES',
      })
    );
    const data = await response.json();

    expect(mockCreateTutorial).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reading the Order Book',
        youtubeUrl: VALID_URL,
        category: 'TRADING_STRATEGIES',
        createdByUserId: 'admin-1',
      })
    );
    expect(response.status).toBe(201);
    expect(data.tutorial.id).toBe('tut-1');
  });

  it('handles database errors', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockCreateTutorial.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/admin/tutorials/route');
    const response = await POST(
      makePostRequest({
        title: 'x',
        description: 'y',
        youtubeUrl: VALID_URL,
        category: 'GETTING_STARTED',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to publish tutorial');
  });
});
