/**
 * @jest-environment node
 */
/**
 * CODE-02C (WS-12): `DELETE /api/user/sessions/[id]` ("log out this device").
 *
 * The route hands the id to `revokeSession` (which ends the device for real: the `jwt` callback
 * refuses its `sid`, see `__tests__/lib/auth/session-revocation.test.ts`) and, when the request is
 * forwarded to operation-service, forgets this instance's cached answer for that device.
 */

import { NextRequest } from 'next/server';

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockRevokeSession = jest.fn();
jest.mock('@/lib/auth/session-tracker', () => ({
  __esModule: true,
  revokeSession: (...a: unknown[]) => mockRevokeSession(...a),
}));

const mockForgetDeviceSession = jest.fn();
jest.mock('@/lib/auth/user-active', () => ({
  __esModule: true,
  forgetDeviceSession: (...a: unknown[]) => mockForgetDeviceSession(...a),
}));

const mockUseOperationService = jest.fn(() => false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUserSessions: () => mockUseOperationService(),
}));
const mockForward = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationService: (...a: unknown[]) => mockForward(...a),
  OperationServiceError: class OperationServiceError extends Error {},
}));

import { DELETE } from '@/app/api/user/sessions/[id]/route';

function call(id: string): Promise<Response> {
  return DELETE(
    new NextRequest(`http://localhost/api/user/sessions/${id}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  mockRevokeSession.mockResolvedValue(true);
  mockUseOperationService.mockReturnValue(false);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DELETE /api/user/sessions/[id]', () => {
  it('is 401 without a session and revokes nothing', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await call('sess-1');

    expect(res.status).toBe(401);
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it('revokes the named device of the signed-in user (revokeSession forgets the cached answer itself)', async () => {
    const res = await call('sess-1');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    expect(mockRevokeSession).toHaveBeenCalledWith('sess-1', 'user-1');
  });

  it('is 404 when the device is not the caller’s or already gone', async () => {
    mockRevokeSession.mockResolvedValue(false);

    const res = await call('sess-9');

    expect(res.status).toBe(404);
  });

  it('is 500 when the revocation itself fails, never a success', async () => {
    mockRevokeSession.mockRejectedValue(new Error('connection reset'));

    const res = await call('sess-1');

    expect(res.status).toBe(500);
  });

  describe('with the operation-service flag on', () => {
    beforeEach(() => {
      mockUseOperationService.mockReturnValue(true);
    });

    it('forwards the request, does not revoke locally, and forgets the cached answer after a success', async () => {
      mockForward.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const res = await call('sess-1');

      expect(res.status).toBe(200);
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        '/user/sessions/sess-1'
      );
      expect(mockRevokeSession).not.toHaveBeenCalled();
      expect(mockForgetDeviceSession).toHaveBeenCalledWith('sess-1');
    });

    it('forgets nothing when operation-service refused the revocation', async () => {
      mockForward.mockResolvedValue({
        status: 404,
        body: { error: 'Session not found or already revoked' },
      });

      const res = await call('sess-1');

      expect(res.status).toBe(404);
      expect(mockForgetDeviceSession).not.toHaveBeenCalled();
    });
  });
});
