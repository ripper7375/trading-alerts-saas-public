import { GUARDS_METADATA } from '@nestjs/common/constants';

import { UsersController } from './users.controller';
import type { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1', email: 'a@b.com', tier: 'PRO', role: 'USER' },
    headers: {},
    ip: '1.2.3.4',
    ...overrides,
  } as never;
}

describe('UsersController', () => {
  function makeController(service: Partial<UsersService>) {
    return new UsersController(service as UsersService);
  }

  // The entire point of this session's CONFIRM correction: guards must be
  // method-level, and these 3 handlers specifically must carry NO guard at
  // all (SOURCE is unauthenticated for them) while every other handler
  // must carry JwtAuthGuard. A class-level @UseGuards would make every one
  // of these assertions pass/fail identically, which is exactly the bug
  // this test exists to prevent from regressing.
  describe('guard scoping', () => {
    const unauthenticatedHandlers = [
      'verify2FA',
      'confirmDeletion',
      'cancelDeletion',
    ] as const;

    const authenticatedHandlers = [
      'getProfile',
      'updateProfile',
      'getPreferences',
      'updatePreferences',
      'changePassword',
      'getSessions',
      'revokeAllSessions',
      'revokeSession',
      'getLoginHistory',
      'get2FAStatus',
      'setup2FA',
      'verifySetup2FA',
      'getBackupCodesStatus',
      'regenerateBackupCodes',
      'disable2FA',
      'requestDeletion',
    ] as const;

    it.each(unauthenticatedHandlers)(
      '%s carries no guard metadata',
      (handlerName) => {
        const guards = Reflect.getMetadata(
          GUARDS_METADATA,
          UsersController.prototype[handlerName]
        );
        expect(guards).toBeUndefined();
      }
    );

    it.each(authenticatedHandlers)(
      '%s is guarded by JwtAuthGuard',
      (handlerName) => {
        const guards = Reflect.getMetadata(
          GUARDS_METADATA,
          UsersController.prototype[handlerName]
        );
        expect(guards).toContain(JwtAuthGuard);
      }
    );

    it('has no class-level guard metadata', () => {
      const classGuards = Reflect.getMetadata(GUARDS_METADATA, UsersController);
      expect(classGuards).toBeUndefined();
    });
  });

  describe('delegation', () => {
    it('getProfile delegates with the caller id', async () => {
      const getProfile = jest.fn().mockResolvedValue({ user: {} });
      const controller = makeController({ getProfile });

      await controller.getProfile(mockRequest());
      expect(getProfile).toHaveBeenCalledWith('user-1', 'a@b.com');
    });

    it('updateProfile delegates with id + current email + dto', async () => {
      const updateProfile = jest.fn().mockResolvedValue({});
      const controller = makeController({ updateProfile });
      const dto = { name: 'New Name' } as never;

      await controller.updateProfile(mockRequest(), dto);
      expect(updateProfile).toHaveBeenCalledWith('user-1', 'a@b.com', dto);
    });

    it('changePassword forwards the caller ip as context', async () => {
      const changePassword = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ changePassword });
      const dto = { currentPassword: 'x', newPassword: 'Newpass1' } as never;

      await controller.changePassword(mockRequest({ ip: '9.9.9.9' }), dto);
      expect(changePassword).toHaveBeenCalledWith(
        'user-1',
        dto,
        { ipAddress: '9.9.9.9' },
        'a@b.com'
      );
    });

    it('revokeSession delegates with sessionId + caller id', async () => {
      const revokeSession = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ revokeSession });

      await controller.revokeSession(mockRequest(), 'session-1');
      expect(revokeSession).toHaveBeenCalledWith('session-1', 'user-1');
    });

    it('getLoginHistory clamps limit to 100 and defaults offset to 0', async () => {
      const getLoginHistory = jest.fn().mockResolvedValue({ history: [] });
      const controller = makeController({ getLoginHistory });

      await controller.getLoginHistory(mockRequest(), '500', undefined);
      expect(getLoginHistory).toHaveBeenCalledWith('user-1', 100, 0);
    });

    it('verify2FA delegates without touching request.user (route is unauthenticated)', async () => {
      const verify2FA = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ verify2FA });
      const dto = { code: '123456', token: 'tmp-token' } as never;

      await controller.verify2FA(dto);
      expect(verify2FA).toHaveBeenCalledWith('123456', 'tmp-token');
    });

    it('confirmDeletion delegates the token only', async () => {
      const confirmDeletion = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ confirmDeletion });

      await controller.confirmDeletion({ token: 'tok-1' } as never);
      expect(confirmDeletion).toHaveBeenCalledWith('tok-1');
    });

    it('cancelDeletion skips session resolution when a body token is given', async () => {
      const cancelDeletion = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ cancelDeletion });
      const req = { headers: {} } as never;

      await controller.cancelDeletion(req, { token: 'tok-1' } as never);
      expect(cancelDeletion).toHaveBeenCalledWith('tok-1', undefined);
    });

    it('cancelDeletion resolves undefined userId when no auth header and no token', async () => {
      const cancelDeletion = jest.fn().mockResolvedValue({ success: true });
      const controller = makeController({ cancelDeletion });
      const req = { headers: {} } as never;

      await controller.cancelDeletion(req, {} as never);
      expect(cancelDeletion).toHaveBeenCalledWith(undefined, undefined);
    });

    it('getSessions tracks the current session only when a Bearer token is present', async () => {
      const trackSession = jest.fn().mockResolvedValue(undefined);
      const getSessions = jest.fn().mockResolvedValue({ sessions: [] });
      const controller = makeController({ trackSession, getSessions });
      const req = mockRequest({
        headers: { authorization: 'Bearer raw-jwe', 'user-agent': 'UA' },
      });

      await controller.getSessions(req);
      expect(trackSession).toHaveBeenCalledWith(
        'user-1',
        'raw-jwe',
        'UA',
        '1.2.3.4'
      );
      expect(getSessions).toHaveBeenCalledWith('user-1', 'raw-jwe');
    });

    it('getSessions does not track when no Authorization header is present', async () => {
      const trackSession = jest.fn().mockResolvedValue(undefined);
      const getSessions = jest.fn().mockResolvedValue({ sessions: [] });
      const controller = makeController({ trackSession, getSessions });

      await controller.getSessions(mockRequest({ headers: {} }));
      expect(trackSession).not.toHaveBeenCalled();
      expect(getSessions).toHaveBeenCalledWith('user-1', undefined);
    });
  });
});
