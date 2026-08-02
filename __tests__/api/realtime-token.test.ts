/**
 * Tests for GET /api/realtime/token (F8, Session 4B-17) — the server-side
 * bridge that hands the browser's realtime socket connection the same
 * session token getOperationServiceToken() already forwards for REST calls.
 */

const mockGetOperationServiceToken = jest.fn();
jest.mock('@/lib/operation-service/client', () => ({
  __esModule: true,
  getOperationServiceToken: () => mockGetOperationServiceToken(),
}));

describe('GET /api/realtime/token', () => {
  const originalEnv = process.env['OPERATION_SERVICE_URL'];

  afterEach(() => {
    jest.clearAllMocks();
    process.env['OPERATION_SERVICE_URL'] = originalEnv;
  });

  it('returns 401 when there is no session token', async () => {
    mockGetOperationServiceToken.mockResolvedValue(null);
    jest.resetModules();
    const { GET } = await import('@/app/api/realtime/token/route');

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Not authenticated' });
  });

  it('returns the token and OPERATION_SERVICE_URL when authenticated', async () => {
    process.env['OPERATION_SERVICE_URL'] = 'https://op-service.example.com';
    mockGetOperationServiceToken.mockResolvedValue('a-real-jwe');
    jest.resetModules();
    const { GET } = await import('@/app/api/realtime/token/route');

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      token: 'a-real-jwe',
      url: 'https://op-service.example.com',
    });
  });

  it('falls back to localhost:3001 when OPERATION_SERVICE_URL is unset', async () => {
    delete process.env['OPERATION_SERVICE_URL'];
    mockGetOperationServiceToken.mockResolvedValue('a-real-jwe');
    jest.resetModules();
    const { GET } = await import('@/app/api/realtime/token/route');

    const response = await GET();

    const body = await response.json();
    expect(body.url).toBe('http://localhost:3001');
  });
});
