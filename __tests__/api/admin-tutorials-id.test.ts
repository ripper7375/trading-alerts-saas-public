/**
 * Admin Academy Tutorial Detail API Route Tests
 *
 * Tests for PATCH/DELETE /api/admin/tutorials/[id].
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

const mockUpdateTutorial = jest.fn();
const mockDeleteTutorial = jest.fn();
jest.mock('@/lib/tutorials/service', () => ({
  __esModule: true,
  updateTutorial: (...args: unknown[]) => mockUpdateTutorial(...args),
  deleteTutorial: (...args: unknown[]) => mockDeleteTutorial(...args),
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePatchRequest(body: unknown) {
  return { json: async () => body } as never;
}

describe('PATCH /api/admin/tutorials/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({ status: 'ARCHIVED' }),
      makeContext('tut-1')
    );

    expect(response.status).toBe(403);
    expect(mockUpdateTutorial).not.toHaveBeenCalled();
  });

  it('rejects an invalid status value', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({ status: 'PUBLISHED' }),
      makeContext('tut-1')
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTutorial).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent tutorial', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUpdateTutorial.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({ status: 'ARCHIVED' }),
      makeContext('missing')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tutorial not found');
  });

  it('returns 400 when the service reports an unparseable YouTube URL (defensive: schema already rejects malformed URLs, this covers service/schema drift)', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUpdateTutorial.mockRejectedValue(new Error('INVALID_YOUTUBE_URL'));

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
      makeContext('tut-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Must be a valid YouTube video URL');
  });

  it('updates a tutorial and returns it', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUpdateTutorial.mockResolvedValue({ id: 'tut-1', status: 'ARCHIVED' });

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({ status: 'ARCHIVED' }),
      makeContext('tut-1')
    );
    const data = await response.json();

    expect(mockUpdateTutorial).toHaveBeenCalledWith(
      'tut-1',
      expect.objectContaining({ status: 'ARCHIVED' })
    );
    expect(response.status).toBe(200);
    expect(data.tutorial.status).toBe('ARCHIVED');
  });

  it('handles database errors', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockUpdateTutorial.mockRejectedValue(new Error('DB error'));

    const { PATCH } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await PATCH(
      makePatchRequest({ status: 'ARCHIVED' }),
      makeContext('tut-1')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update tutorial');
  });
});

describe('DELETE /api/admin/tutorials/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const { DELETE } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await DELETE({} as never, makeContext('tut-1'));

    expect(response.status).toBe(403);
    expect(mockDeleteTutorial).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent tutorial', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteTutorial.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await DELETE({} as never, makeContext('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tutorial not found');
  });

  it('deletes a tutorial on success', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteTutorial.mockResolvedValue({ id: 'tut-1' });

    const { DELETE } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await DELETE({} as never, makeContext('tut-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, id: 'tut-1' });
  });

  it('handles database errors', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mockDeleteTutorial.mockRejectedValue(new Error('DB error'));

    const { DELETE } = await import('@/app/api/admin/tutorials/[id]/route');
    const response = await DELETE({} as never, makeContext('tut-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete tutorial');
  });
});
