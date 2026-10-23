/**
 * @jest-environment node
 */
/**
 * Sign-in must not depend on columns it does not use.
 *
 * A Prisma call on `User` with no `select` (and every create, update and upsert, which RETURN the
 * row) asks the database for every column of the generated client. On 2026-10-19 `User.deletedAt`
 * was deployed before its migration was applied, and the credentials sign-in, the OAuth callback and
 * the NextAuth adapter all failed with "The column User.deletedAt does not exist".
 *
 * Two kinds of evidence:
 *  1. A source guard: every `<x>.user.<call>(...)` in the sign-in files names its columns.
 *  2. Behaviour: the real `authOptions` run against a database that REJECTS any `User` call that
 *     does not name its columns, or that names a column the database does not have yet.
 */

import fs from 'fs';
import path from 'path';

import ts from 'typescript';

const ROOT = process.cwd();

const USER_METHODS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'update',
  'upsert',
  'delete',
]);

function sourceFilesUnder(relDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, relDir));
  return out;
}

interface UserCall {
  line: number;
  method: string;
  hasSelect: boolean;
  hasInclude: boolean;
}

/** Every `<anything>.user.<prisma method>(...)` in a source text. */
function userCalls(fileName: string, text: string): UserCall[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const calls: UserCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      USER_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'user'
    ) {
      const arg = node.arguments[0];
      const names =
        arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.map((p) => p.name?.getText(sf))
          : [];
      calls.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        method: node.expression.name.text,
        hasSelect: names.includes('select'),
        hasInclude: names.includes('include'),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return calls;
}

describe('source guard: the sign-in files name the User columns they use', () => {
  const guarded = [
    ...sourceFilesUnder('lib/auth'),
    ...sourceFilesUnder('app/api/auth'),
    // The 2FA step of a login and the password change are authentication too.
    ...sourceFilesUnder('app/api/user/2fa'),
    path.join(ROOT, 'app/api/user/password/route.ts'),
    path.join(ROOT, 'lib/security/device-detection.ts'),
  ];

  it('covers the files it is meant to (not an empty glob)', () => {
    const names = guarded.map((f) =>
      path.relative(ROOT, f).replace(/\\/g, '/')
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'lib/auth/auth-options.ts',
        'lib/auth/session.ts',
        'app/api/auth/verify-email/route.ts',
        'app/api/auth/reset-password/route.ts',
        'app/api/user/2fa/verify/route.ts',
        'app/api/user/password/route.ts',
        'lib/security/device-detection.ts',
      ])
    );
  });

  it('finds the violation in a snippet that has one (the scanner is not blind)', () => {
    const bad = `
      await prisma.user.findUnique({ where: { email } });
      await prisma.user.update({ where: { id }, data: {} });
      await prisma.user.findUnique({ where: { email }, include: { accounts: true } });
      await tx.user.create({ data: {}, select: { id: true } });
    `;
    const calls = userCalls('bad.ts', bad);
    expect(calls.map((c) => [c.method, c.hasSelect, c.hasInclude])).toEqual([
      ['findUnique', false, false],
      ['update', false, false],
      ['findUnique', false, true],
      ['create', true, false],
    ]);
  });

  it('every User call in them has an explicit select and no include', () => {
    const violations: string[] = [];
    let seen = 0;
    for (const file of guarded) {
      for (const call of userCalls(file, fs.readFileSync(file, 'utf8'))) {
        seen += 1;
        const where = `${path.relative(ROOT, file).replace(/\\/g, '/')}:${call.line} user.${call.method}`;
        if (!call.hasSelect) violations.push(`${where}: no select`);
        if (call.hasInclude)
          violations.push(`${where}: include returns every column`);
      }
    }
    expect(seen).toBeGreaterThan(25); // the guard is looking at something
    expect(violations).toEqual([]);
  });

  it('auth-options overrides every adapter method that returns a user, and never asks an account for its whole user', () => {
    // Comments explain the rule and may quote what it forbids: read the code only.
    const text = fs
      .readFileSync(path.join(ROOT, 'lib/auth/auth-options.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
    for (const method of [
      'createUser',
      'getUser',
      'getUserByEmail',
      'getUserByAccount',
      'updateUser',
      'deleteUser',
      'getSessionAndUser',
    ]) {
      expect(text).toMatch(new RegExp(`\\n\\s+${method}: `));
    }
    expect(text).not.toMatch(/select:\s*\{\s*user:\s*true\s*\}/);
    expect(text).not.toMatch(/include:\s*\{\s*user:\s*true\s*\}/);
  });
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

// The strict database is built INSIDE the factory: `authOptions` builds its adapter when it is
// imported, which is before any `const` of this file would be initialised.
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

jest.mock('@/lib/db/prisma', () => {
  /** The column this database does not have yet. */
  const MISSING_COLUMN = 'deletedAt';
  const state = {
    row: null as unknown,
    calls: [] as Array<{ model: string; method: string; args: unknown }>,
  };
  const missing = (detail = ''): Error =>
    new Error(
      `The column User.${MISSING_COLUMN} does not exist in the current database.${detail}`
    );
  /** A `User` call fails like Postgres would if it asks for a column that is not there. */
  const strictUser = (method: string) =>
    jest.fn(async (args: Record<string, unknown> | undefined) => {
      state.calls.push({ model: 'user', method, args });
      const select = args?.['select'] as Record<string, unknown> | undefined;
      if (!select) throw missing(` (${method} had no select)`);
      if (MISSING_COLUMN in select) throw missing();
      return state.row;
    });
  /** A relation selected as a bare `user: true` would select every User column. */
  const strictRelation = (model: string, result: () => unknown) =>
    jest.fn(async (args: Record<string, unknown>) => {
      state.calls.push({ model, method: 'findUnique', args });
      const select = args['select'] as { user?: unknown } | undefined;
      if (!select || select.user === true) throw missing();
      return result();
    });
  return {
    __esModule: true,
    __state: state,
    __MISSING_COLUMN: MISSING_COLUMN,
    prisma: {
      user: {
        findUnique: strictUser('findUnique'),
        findFirst: strictUser('findFirst'),
        create: strictUser('create'),
        update: strictUser('update'),
        upsert: strictUser('upsert'),
        delete: strictUser('delete'),
      },
      account: {
        findUnique: strictRelation('account', () => ({ user: state.row })),
        create: jest.fn(async () => ({ id: 'acc-new' })),
      },
      session: {
        findUnique: strictRelation('session', () => ({
          id: 's1',
          sessionToken: 't',
          userId: 'user-1',
          expires: new Date(),
          user: state.row,
        })),
      },
    },
  };
});

import bcrypt from 'bcryptjs';

import { authOptions } from '@/lib/auth/auth-options';
import { clearUserActiveCache } from '@/lib/auth/user-active';
import * as prismaModule from '@/lib/db/prisma';

const { __state: state, __MISSING_COLUMN: MISSING_COLUMN } =
  prismaModule as unknown as {
    __state: {
      row: unknown;
      calls: Array<{ model: string; method: string; args: unknown }>;
    };
    __MISSING_COLUMN: string;
  };
const mockPrisma = prismaModule.prisma as unknown as {
  user: { findUnique: (a: unknown) => Promise<unknown> };
};

const dbUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  image: null,
  password: '', // set in beforeAll
  tier: 'FREE',
  role: 'USER',
  isAffiliate: false,
  isActive: true,
  emailVerified: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  accounts: [{ id: 'acc-1' }],
};

type Authorize = (c: { email: string; password: string }) => Promise<unknown>;

function credentialsAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as
    | { options: { authorize: Authorize } }
    | undefined;
  if (!provider) throw new Error('credentials provider missing');
  return provider.options.authorize;
}

describe('behaviour: sign-in against a database that lacks a column the code knows about', () => {
  beforeAll(async () => {
    dbUser.password = await bcrypt.hash('correct-password', 4);
  });

  beforeEach(() => {
    state.calls.length = 0;
    state.row = dbUser;
    clearUserActiveCache();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('the strict database really rejects a call with no select (the test can fail)', async () => {
    await expect(
      (
        mockPrisma.user.findUnique as unknown as (
          a: unknown
        ) => Promise<unknown>
      )({
        where: { email: 'x' },
      })
    ).rejects.toThrow(/User\.deletedAt does not exist/);
  });

  it('credentials sign-in works', async () => {
    await expect(
      credentialsAuthorize()({
        email: 'alice@example.com',
        password: 'correct-password',
      })
    ).resolves.toMatchObject({ id: 'user-1', email: 'alice@example.com' });
  });

  it('credentials sign-in still answers a wrong password and a deactivated account correctly', async () => {
    await expect(
      credentialsAuthorize()({
        email: 'alice@example.com',
        password: 'wrong',
      })
    ).rejects.toThrow('INVALID_CREDENTIALS');

    state.row = { ...dbUser, isActive: false };
    await expect(
      credentialsAuthorize()({
        email: 'alice@example.com',
        password: 'correct-password',
      })
    ).rejects.toThrow('ACCOUNT_DEACTIVATED');
  });

  describe('the NextAuth adapter (the OAuth callback)', () => {
    const adapter = authOptions.adapter!;

    it('getUserByEmail, getUser and getUserByAccount return the user', async () => {
      await expect(
        adapter.getUserByEmail!('alice@example.com')
      ).resolves.toMatchObject({
        id: 'user-1',
        email: 'alice@example.com',
      });
      await expect(adapter.getUser!('user-1')).resolves.toMatchObject({
        id: 'user-1',
      });
      await expect(
        adapter.getUserByAccount!({
          provider: 'google',
          providerAccountId: 'g-1',
        })
      ).resolves.toMatchObject({ id: 'user-1' });
    });

    it('createUser, updateUser and deleteUser return the user', async () => {
      await expect(
        adapter.createUser!({
          email: 'new@example.com',
          emailVerified: null,
          name: 'New',
          image: null,
        } as never)
      ).resolves.toMatchObject({ id: 'user-1' });
      await expect(
        adapter.updateUser!({ id: 'user-1', name: 'Renamed' } as never)
      ).resolves.toMatchObject({ id: 'user-1' });
      await expect(adapter.deleteUser!('user-1')).resolves.toMatchObject({
        id: 'user-1',
      });
    });

    it('getSessionAndUser returns the user without selecting the whole relation', async () => {
      await expect(adapter.getSessionAndUser!('t')).resolves.toMatchObject({
        user: { id: 'user-1' },
        session: { sessionToken: 't' },
      });
    });

    it('returns null, not an error, for a user that does not exist', async () => {
      state.row = null;
      await expect(
        adapter.getUserByEmail!('nobody@example.com')
      ).resolves.toBeNull();
    });
  });

  describe('the OAuth signIn callback', () => {
    const signIn = (): Promise<unknown> =>
      authOptions.callbacks!.signIn!({
        user: { id: 'user-1', email: 'alice@example.com', image: null },
        account: {
          provider: 'google',
          providerAccountId: 'g-1',
          type: 'oauth',
        },
        // Google sends `email_verified`; without it the callback refuses the sign-in (CODE-05).
        profile: { email_verified: true },
      } as never);

    it('lets an existing, active user through', async () => {
      await expect(signIn()).resolves.toBe(true);
    });

    it('verifies the e-mail of an OAuth user who has linked accounts but is unverified', async () => {
      state.row = { ...dbUser, emailVerified: null };

      await expect(signIn()).resolves.toBe(true);

      const writes = state.calls.filter(
        (c) => c.model === 'user' && c.method === 'update'
      );
      expect(writes).toHaveLength(1);
      expect(writes[0]!.args).toMatchObject({ select: { id: true } });
    });

    it('still sends a deactivated account back to /login', async () => {
      state.row = { ...dbUser, isActive: false };

      await expect(signIn()).resolves.toBe('/login?error=ACCOUNT_DEACTIVATED');
    });
  });

  it('names no column the database lacks, on any User call made while signing in', async () => {
    await credentialsAuthorize()({
      email: 'alice@example.com',
      password: 'correct-password',
    });
    await authOptions.adapter!.getUserByEmail!('alice@example.com');
    await authOptions.callbacks!.signIn!({
      user: { id: 'user-1', email: 'alice@example.com', image: null },
      account: { provider: 'google', providerAccountId: 'g-1', type: 'oauth' },
      profile: { email_verified: true },
    } as never);

    const userCalls = state.calls.filter((c) => c.model === 'user');
    expect(userCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of userCalls) {
      const select = (call.args as { select?: Record<string, unknown> }).select;
      expect(select).toBeDefined();
      expect(Object.keys(select!)).not.toContain(MISSING_COLUMN);
    }
  });
});
