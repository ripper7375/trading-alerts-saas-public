import { AuthController } from './auth.controller';
import { AuthenticatedRequest } from './jwt-auth.guard';

describe('AuthController#me', () => {
  it('returns exactly the id/email/tier/role/isAffiliate claim shape JwtAuthGuard attaches', () => {
    // authService is never touched by /me — it reads only request.user,
    // attached upstream by JwtAuthGuard (order's explicit "done when" bar:
    // same claim shape as Session 3-1's guard).
    const controller = new AuthController(undefined as never);
    const request = {
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: true,
      },
    } as AuthenticatedRequest;

    const result = controller.me(request);

    expect(result).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: true,
    });
    expect(Object.keys(result)).toEqual([
      'id',
      'email',
      'tier',
      'role',
      'isAffiliate',
    ]);
  });
});
