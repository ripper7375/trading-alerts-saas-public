/**
 * @jest-environment node
 */
/**
 * A session that names no account must never exist.
 *
 * Observed on 2026-11-28: the database lacked a column the sign-in lookup selects, and the sign-in
 * produced a session with no `id`, `tier` or `role`, so a PRO account was shown as FREE.
 *
 * So the `jwt` callback fails closed twice:
 *  - at sign-in, a lookup that throws, or an outcome without an account id, refuses the sign-in;
 *  - on every later read, a token without a non-empty string `id` is refused, which NextAuth turns
 *    into "no session" and a cleared cookie.
 */

const mockUserFindUnique = jest.fn();
const mockSessionCreate = jest.fn();
const mockSessionFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    userSession: {
      create: (...a: unknown[]) => mockSessionCreate(...a),
      findUnique: (...a: unknown[]) => mockSessionFindUnique(...a),
    },
  },
}));

// jest.config.js maps `next-auth` and every `next-auth/*` import to ONE stub.
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

jest.mock('next/headers', () => ({
  __esModule: true,
  headers: async () => new Map<string, string>(),
  cookies: jest.fn(),
}));

import { authOptions } from '@/lib/auth/auth-options';
import { clearUserActiveCache } from '@/lib/auth/user-active';

/** The token NextAuth builds before the callback runs at sign-in. */
const defaultToken = (): Record<string, unknown> => ({
  name: 'Pro Test User',
  email: 'pro@example.com',
  sub: 'user-1',
});

const signingIn = {
  id: 'user-1',
  email: 'pro@example.com',
  name: 'Pro Test User',
  tier: 'PRO',
  role: 'USER',
  isAffiliate: false,
};

const signInRow = (): Record<string, unknown> => ({
  id: 'user-1',
  email: 'pro@example.com',
  name: 'Pro Test User',
  image: null,
  tier: 'PRO',
  role: 'USER',
  isAffiliate: false,
  sessionVersion: 0,
});

async function runJwt(args: {
  token: Record<string, unknown>;
  user?: Record<string, unknown>;
  trigger?: 'signIn' | 'signUp' | 'update';
}): Promise<Record<string, unknown>> {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error('jwt callback missing');
  return (await callback(args as never)) as never;
}

let errorLog: jest.SpyInstance;

beforeEach(() => {
  mockUserFindUnique.mockReset().mockResolvedValue(signInRow());
  mockSessionCreate.mockReset().mockResolvedValue({ id: 'sess-1' });
  mockSessionFindUnique.mockReset().mockResolvedValue(null);
  clearUserActiveCache();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('at sign-in', () => {
  const missingColumn = new Error(
    'The column `User.sessionVersion` does not exist in the current database.'
  );

  it.each(['signIn', 'signUp'] as const)(
    'refuses a %s whose account lookup throws, instead of minting a token without an id',
    async (trigger) => {
      mockUserFindUnique.mockRejectedValue(missingColumn);

      await expect(
        runJwt({ token: defaultToken(), user: signingIn, trigger })
      ).rejects.toThrow('SIGN_IN_FAILED');
    }
  );

  it('writes no device session for a refused sign-in', async () => {
    mockUserFindUnique.mockRejectedValue(missingColumn);

    await runJwt({ token: defaultToken(), user: signingIn }).catch(
      () => undefined
    );

    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('says in the server log why it refused', async () => {
    mockUserFindUnique.mockRejectedValue(missingColumn);

    await runJwt({ token: defaultToken(), user: signingIn }).catch(
      () => undefined
    );

    expect(errorLog).toHaveBeenCalledWith(
      '[JWT] Sign-in refused:',
      missingColumn.message
    );
  });

  it.each([
    ['no id column', { id: undefined }],
    ['an empty id', { id: '' }],
  ])('refuses a sign-in whose account row has %s', async (_label, change) => {
    mockUserFindUnique.mockResolvedValue({ ...signInRow(), ...change });

    await expect(
      runJwt({ token: defaultToken(), user: signingIn })
    ).rejects.toThrow('SIGN_IN_FAILED');
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('refuses a sign-in with no row and no id on the user object either', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      runJwt({
        token: defaultToken(),
        user: { ...signingIn, id: '' },
      })
    ).rejects.toThrow('SIGN_IN_FAILED');
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('still signs in an account the lookup finds', async () => {
    await expect(
      runJwt({ token: defaultToken(), user: signingIn })
    ).resolves.toMatchObject({ id: 'user-1', tier: 'PRO', sid: 'sess-1' });
  });

  it('still falls back to the user object when there is no row (dev test accounts)', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      runJwt({ token: defaultToken(), user: signingIn })
    ).resolves.toMatchObject({ id: 'user-1', tier: 'PRO' });
  });
});

describe('on a later session read', () => {
  it.each([
    ['no id at all', {}],
    ['an undefined id', { id: undefined }],
    ['an empty id', { id: '' }],
    ['a number for an id', { id: 7 }],
    ['claims that look privileged', { tier: 'PRO', role: 'ADMIN' }],
  ])('refuses a token with %s (SESSION_REVOKED)', async (_label, extra) => {
    await expect(
      runJwt({ token: { ...defaultToken(), ...extra } })
    ).rejects.toThrow('SESSION_REVOKED');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('refuses such a token on a session update too', async () => {
    await expect(
      runJwt({ token: defaultToken(), trigger: 'update' })
    ).rejects.toThrow('SESSION_REVOKED');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('keeps a live session when the refresh of a session update fails', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('connection timeout'));

    await expect(
      runJwt({
        token: { ...defaultToken(), id: 'user-1', tier: 'PRO' },
        trigger: 'update',
      })
    ).resolves.toMatchObject({ id: 'user-1', tier: 'PRO' });
  });
});
