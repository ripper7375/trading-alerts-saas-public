/**
 * @jest-environment node
 */
/**
 * OAuth account linking (CODE-05) and log hygiene (CODE-14).
 *
 * CODE-05: an OAuth sign-in whose e-mail address already belongs to another account is linked to that
 * account only when the provider has verified the address. Google does (it sends `email_verified`),
 * so Google keeps NextAuth's e-mail linking and the `signIn` callback refuses a Google profile
 * without `email_verified === true`. X and LinkedIn do not vouch for the address in the way this app
 * needs, so NextAuth must refuse to link them by e-mail (`OAuthAccountNotLinked`).
 *
 * CODE-14: no log line of the sign-in code prints an e-mail address or a token.
 *
 * Two notes on the harness. The project maps every `next-auth/*` import to one stub
 * (`__mocks__/next-auth.js`, see jest.config.js), so the provider factories are replaced below by the
 * real ones from `node_modules`, chosen by the client id the test sets. And the linking tests run
 * NextAuth's own `callbackHandler` with the provider the real `parseProviders` builds from
 * `authOptions.providers`, so what is proved is what NextAuth does with the shipped configuration,
 * not what the configuration says about itself.
 */

import fs from 'fs';
import path from 'path';

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserCreate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
    },
    account: { findUnique: jest.fn() },
  },
}));

// `next-auth/providers/*` all resolve to one stub, and Jest keys a mock by the resolved file, so this
// one factory stands for the credentials, Google, X and LinkedIn providers alike. The real factories
// are picked by the client id (each provider is configured below with its own).
jest.mock('next-auth/providers/credentials', () => {
  const dir = '../../../node_modules/next-auth/providers/';
  const real = {
    'google-client-id': jest.requireActual(`${dir}google`).default,
    'twitter-client-id': jest.requireActual(`${dir}twitter`).default,
    'linkedin-client-id': jest.requireActual(`${dir}linkedin`).default,
  } as Record<string, (options: unknown) => unknown>;
  return {
    __esModule: true,
    default: (options: { id?: string; clientId?: string }) => {
      const factory = options.clientId ? real[options.clientId] : undefined;
      return factory ? factory(options) : { id: options.id, options };
    },
  };
});

type SignInCallback = (params: {
  user: Record<string, unknown>;
  account: Record<string, unknown> | null;
  profile?: Record<string, unknown>;
}) => Promise<unknown>;

type AuthOptionsModule = typeof import('@/lib/auth/auth-options');

const OAUTH_ENV: Record<string, string> = {
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  TWITTER_CLIENT_ID: 'twitter-client-id',
  TWITTER_CLIENT_SECRET: 'twitter-secret',
  LINKEDIN_CLIENT_ID: 'linkedin-client-id',
  LINKEDIN_CLIENT_SECRET: 'linkedin-secret',
};

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

/** The module reads the provider variables when it loads, so each test set loads it afresh. */
function loadAuthOptions(): AuthOptionsModule['authOptions'] {
  let loaded: AuthOptionsModule['authOptions'] | undefined;
  jest.isolateModules(() => {
    loaded = (require('@/lib/auth/auth-options') as AuthOptionsModule)
      .authOptions;
  });
  if (!loaded) throw new Error('authOptions did not load');
  return loaded;
}

interface NextAuthInternals {
  callbackHandler: (params: unknown) => Promise<{
    user: { id: string };
    isNewUser: boolean;
  }>;
  parseProviders: (params: {
    providers: unknown[];
    url: string;
    providerId: string;
  }) => { provider: Record<string, unknown> };
}

function nextAuthInternals(): NextAuthInternals {
  const dir = '../../../node_modules/next-auth/core/lib/';
  return {
    callbackHandler: jest.requireActual(`${dir}callback-handler`).default,
    parseProviders: jest.requireActual(`${dir}providers`).default,
  };
}

describe('OAuth account linking (CODE-05)', () => {
  const saved = new Map<string, string | undefined>();
  let authOptions: AuthOptionsModule['authOptions'];

  beforeAll(() => {
    for (const key of Object.keys(OAUTH_ENV)) saved.set(key, process.env[key]);
    for (const [key, value] of Object.entries(OAUTH_ENV)) setEnv(key, value);
    authOptions = loadAuthOptions();
  });

  afterAll(() => {
    for (const key of Object.keys(OAUTH_ENV)) setEnv(key, saved.get(key));
  });

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
    mockUserCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  function signIn(): SignInCallback {
    const callback = authOptions.callbacks?.signIn;
    if (!callback) throw new Error('callbacks.signIn is not configured');
    return callback as unknown as SignInCallback;
  }

  describe("the shipped providers' e-mail linking switch", () => {
    function providerOptions(id: string): Record<string, unknown> {
      const provider = authOptions.providers.find((p) => p.id === id) as
        | { options?: Record<string, unknown> }
        | undefined;
      if (!provider?.options) throw new Error(`${id} provider missing`);
      return provider.options;
    }

    it('Google keeps NextAuth e-mail linking (the signIn callback gates it on email_verified)', () => {
      expect(
        providerOptions('google')['allowDangerousEmailAccountLinking']
      ).toBe(true);
    });

    it.each(['twitter', 'linkedin'])(
      '%s does not link accounts by e-mail',
      (id) => {
        expect(providerOptions(id)['allowDangerousEmailAccountLinking']).toBe(
          undefined
        );
      }
    );
  });

  describe('what NextAuth does when the e-mail already belongs to an account', () => {
    const EXISTING = { id: 'user-existing', email: 'alice@example.com' };

    async function signInWith(
      providerId: 'google' | 'twitter' | 'linkedin',
      profileId: string
    ) {
      const { callbackHandler, parseProviders } = nextAuthInternals();
      const { provider } = parseProviders({
        providers: authOptions.providers.filter((p) =>
          ['google', 'twitter', 'linkedin'].includes(p.id)
        ),
        url: 'https://davintrade.app/api/auth',
        providerId,
      });
      const adapter = {
        getUserByAccount: jest.fn().mockResolvedValue(null),
        getUserByEmail: jest.fn().mockResolvedValue(EXISTING),
        getUser: jest.fn(),
        createUser: jest.fn().mockResolvedValue({ id: 'user-new' }),
        updateUser: jest.fn(),
        linkAccount: jest.fn().mockResolvedValue(undefined),
        createSession: jest.fn(),
        getSessionAndUser: jest.fn(),
        deleteSession: jest.fn(),
      };
      const run = () =>
        callbackHandler({
          sessionToken: undefined,
          profile: {
            id: profileId,
            name: 'Alice',
            email: 'alice@example.com',
          },
          account: {
            type: 'oauth',
            provider: providerId,
            providerAccountId: profileId,
          },
          options: {
            adapter,
            jwt: {},
            events: {},
            provider,
            session: { strategy: 'jwt', maxAge: 60 },
          },
        });
      return { adapter, run };
    }

    it('links a verified Google sign-in to the existing account', async () => {
      const { adapter, run } = await signInWith('google', 'google-sub-1');

      const result = await run();

      expect(result.user.id).toBe(EXISTING.id);
      expect(adapter.createUser).not.toHaveBeenCalled();
      expect(adapter.linkAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          userId: EXISTING.id,
        })
      );
    });

    it.each(['twitter', 'linkedin'] as const)(
      'refuses to link %s to the existing account (OAuthAccountNotLinked)',
      async (providerId) => {
        const { adapter, run } = await signInWith(
          providerId,
          `${providerId}-1`
        );

        await expect(run()).rejects.toMatchObject({
          name: 'AccountNotLinkedError',
        });
        expect(adapter.linkAccount).not.toHaveBeenCalled();
        expect(adapter.createUser).not.toHaveBeenCalled();
      }
    );
  });

  describe('signIn callback: Google needs a verified e-mail', () => {
    const googleAccount = {
      provider: 'google',
      type: 'oauth',
      providerAccountId: 'google-sub-1',
    };
    const googleUser = {
      id: 'google-sub-1',
      email: 'alice@example.com',
      name: 'Alice',
      image: null,
    };

    const existingActive = {
      id: 'user-existing',
      isActive: true,
      emailVerified: new Date('2026-01-01'),
      image: 'https://example.com/a.png',
      accounts: [{ id: 'acc-1' }],
    };

    it.each([
      ['false', false],
      ['missing', undefined],
      ['the string "true"', 'true'],
      ['1', 1],
    ])(
      'refuses a Google profile with email_verified %s',
      async (_label, value) => {
        mockUserFindUnique.mockResolvedValue(existingActive);

        const result = await signIn()({
          user: { ...googleUser },
          account: googleAccount,
          profile: {
            sub: 'google-sub-1',
            email: 'alice@example.com',
            email_verified: value,
          },
        });

        expect(result).toBe(false);
        expect(mockUserUpdate).not.toHaveBeenCalled();
      }
    );

    it('refuses an unverified Google profile even when no account has that e-mail', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await signIn()({
        user: { ...googleUser },
        account: googleAccount,
        profile: {
          sub: 'google-sub-1',
          email: 'alice@example.com',
          email_verified: false,
        },
      });

      expect(result).toBe(false);
    });

    it('allows a verified Google profile for an existing account', async () => {
      mockUserFindUnique.mockResolvedValue(existingActive);

      const result = await signIn()({
        user: { ...googleUser },
        account: googleAccount,
        profile: {
          sub: 'google-sub-1',
          email: 'alice@example.com',
          email_verified: true,
        },
      });

      expect(result).toBe(true);
    });

    it('allows a verified Google profile for a new person', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await signIn()({
        user: { ...googleUser },
        account: googleAccount,
        profile: {
          sub: 'google-sub-1',
          email: 'alice@example.com',
          email_verified: true,
        },
      });

      expect(result).toBe(true);
    });

    it('keeps refusing a deactivated account for a verified Google profile', async () => {
      mockUserFindUnique.mockResolvedValue({
        ...existingActive,
        isActive: false,
      });

      const result = await signIn()({
        user: { ...googleUser },
        account: googleAccount,
        profile: {
          sub: 'google-sub-1',
          email: 'alice@example.com',
          email_verified: true,
        },
      });

      expect(result).toBe('/login?error=ACCOUNT_DEACTIVATED');
    });

    it('does not ask LinkedIn or X for email_verified (they send none)', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        signIn()({
          user: { id: 'li-1', email: 'alice@example.com', name: 'Alice' },
          account: {
            provider: 'linkedin',
            type: 'oauth',
            providerAccountId: 'li-1',
          },
          profile: { email: 'alice@example.com' },
        })
      ).resolves.toBe(true);
      await expect(
        signIn()({
          user: { id: 'x-1', email: null, name: 'Alice' },
          account: {
            provider: 'twitter',
            type: 'oauth',
            providerAccountId: 'x-1',
          },
          profile: {},
        })
      ).resolves.toBe(true);
    });
  });
});

describe('log hygiene (CODE-14)', () => {
  const ROOT = path.resolve(__dirname, '../../..');

  /** The files whose `console.*` calls the order covers. */
  function auditedFiles(): string[] {
    const files: string[] = [];
    const tsIn = (dir: string): string[] =>
      fs
        .readdirSync(path.join(ROOT, dir))
        .filter((name) => name.endsWith('.ts'))
        .map((name) => path.join(dir, name));
    const routesIn = (dir: string): string[] =>
      fs
        .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(dir, entry.name, 'route.ts'))
        .filter((file) => fs.existsSync(path.join(ROOT, file)));
    files.push(...tsIn('lib/auth'));
    files.push(...routesIn('app/api/auth'));
    files.push(...routesIn('app/api/user/2fa'));
    return files;
  }

  interface Scanned {
    code: string;
    end: number;
  }

  /**
   * The code of a bracketed stretch of `src` that starts just after `open`: string literals and
   * comments are dropped, a template literal keeps only its `${...}` expressions. So the words of a
   * message (`'[token-login] ...'`) are not mistaken for data, and `${user.email}` is.
   */
  function scanBalanced(
    src: string,
    from: number,
    open: string,
    close: string
  ): Scanned {
    let i = from;
    let depth = 1;
    let code = '';
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === "'" || ch === '"') {
        i++;
        while (i < src.length && src[i] !== ch) i += src[i] === '\\' ? 2 : 1;
        i++;
        code += ' ';
      } else if (ch === '`') {
        i++;
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') {
            i += 2;
          } else if (src[i] === '$' && src[i + 1] === '{') {
            const inner = scanBalanced(src, i + 2, '{', '}');
            code += ` ${inner.code} `;
            i = inner.end;
          } else {
            i++;
          }
        }
        i++;
        code += ' ';
      } else if (ch === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end < 0 ? src.length : end + 2;
      } else {
        if (ch === open) depth++;
        else if (ch === close) depth--;
        if (depth === 0) return { code, end: i + 1 };
        code += ch;
        i++;
      }
    }
    return { code, end: i };
  }

  /** `src` with every comment blanked out (line breaks kept, so line numbers still match). */
  function withoutComments(src: string): string {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        while (j < src.length && src[j] !== ch) j += src[j] === '\\' ? 2 : 1;
        out += src.slice(i, j + 1);
        i = j + 1;
      } else if (ch === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        const stop = end < 0 ? src.length : end + 2;
        out += src.slice(i, stop).replace(/[^\n]/g, ' ');
        i = stop;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  }

  /** Every `console.<level>(...)` call: where it is and the code of its arguments. */
  function consoleCalls(raw: string): { line: number; code: string }[] {
    const source = withoutComments(raw);
    const calls: { line: number; code: string }[] = [];
    const start = /\bconsole\s*\.\s*(?:log|info|warn|error|debug)\s*\(/g;
    for (const match of source.matchAll(start)) {
      const argsFrom = (match.index ?? 0) + match[0].length;
      const line = source.slice(0, match.index).split('\n').length;
      calls.push({ line, code: scanBalanced(source, argsFrom, '(', ')').code });
    }
    return calls;
  }

  /**
   * An identifier that names an e-mail address or a token: `email`, `user.email`, `resetToken`. A
   * token object read for one of its fields (`token.id`) is not the token: the field decides.
   */
  function leaks(code: string): string[] {
    const found: string[] = [];
    for (const match of code.matchAll(/([A-Za-z_$][\w$]*)(\s*\??\.(?!\.))?/g)) {
      const id = match[1]!;
      const lower = id.toLowerCase();
      const readForAField = match[2] !== undefined;
      if (lower.endsWith('email') || lower === 'emailaddress') found.push(id);
      else if (lower.endsWith('token') && !readForAField) found.push(id);
    }
    return found;
  }

  describe('the scanner itself', () => {
    it('flags an e-mail or a token in the arguments, on one line or several', () => {
      const source = [
        "console.log('[a] user:', user.email);",
        'console.error(`[b] for ${validated.email}`);',
        'console.log(',
        "  '[c] sent to:',",
        '  result.userEmail',
        ');',
        "console.warn('[d]', { resetToken });",
        "console.log('[e]', session.token, token);",
      ].join('\n');
      const found = consoleCalls(source).map((call) => leaks(call.code));
      expect(found).toEqual([
        ['email'],
        ['email'],
        ['userEmail'],
        ['resetToken'],
        ['token', 'token'],
      ]);
    });

    it('does not flag the words of a message or an error object', () => {
      const source = [
        "console.error('[token-login] operation-service call failed:', error);",
        "console.log('Welcome email sent', emailResult.error, emailError);",
        "console.log('[JWT] User ID:', user.id, `at ${new Date().toISOString()}`);",
        "console.log('[Session] for user:', token.id);",
        '// console.log(user.email)',
        '/* console.log(token) */',
      ].join('\n');
      const found = consoleCalls(source).map((call) => leaks(call.code));
      expect(found).toEqual([[], [], [], []]);
    });
  });

  it('prints no e-mail address or token from the sign-in code, the auth routes or the 2FA routes', () => {
    const files = auditedFiles();
    expect(files.length).toBeGreaterThan(30);

    let calls = 0;
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const call of consoleCalls(source)) {
        calls++;
        const names = leaks(call.code);
        if (names.length > 0) {
          offenders.push(
            `${file.replace(/\\/g, '/')}:${call.line} prints ${names.join(', ')}`
          );
        }
      }
    }

    // The scan reads real calls (a vacuous pass would find none).
    expect(calls).toBeGreaterThan(60);
    expect(offenders).toEqual([]);
  });

  describe('at run time, with a real address in play', () => {
    const ADDRESS = 'alice@example.com';
    const saved = new Map<string, string | undefined>();
    let authOptions: AuthOptionsModule['authOptions'];
    let logged: string[];

    beforeAll(() => {
      for (const key of Object.keys(OAUTH_ENV))
        saved.set(key, process.env[key]);
      for (const [key, value] of Object.entries(OAUTH_ENV)) setEnv(key, value);
      authOptions = loadAuthOptions();
    });

    afterAll(() => {
      for (const key of Object.keys(OAUTH_ENV)) setEnv(key, saved.get(key));
    });

    beforeEach(() => {
      mockUserFindUnique.mockReset();
      mockUserUpdate.mockReset();
      mockUserCreate.mockReset();
      logged = [];
      for (const level of ['log', 'info', 'warn', 'error'] as const) {
        jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
          logged.push(
            args
              .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
              .join(' ')
          );
        });
      }
    });

    afterEach(() => jest.restoreAllMocks());

    it('the signIn callback names the provider and not the address', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        emailVerified: null,
        image: null,
        accounts: [],
      });

      const result = await (
        authOptions.callbacks!.signIn as unknown as SignInCallback
      )({
        user: { id: 'g-1', email: ADDRESS, name: 'Alice', image: null },
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'g-1',
        },
        profile: { email: ADDRESS, email_verified: true },
      });

      // The unverified-account takeover guard is what ran: it logs, and refuses.
      expect(result).toBe(false);
      expect(logged.length).toBeGreaterThan(0);
      expect(logged.join('\n')).toContain('[SignIn]');
      expect(logged.join('\n')).not.toContain(ADDRESS);
    });

    it('the X placeholder address is not logged', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await (authOptions.callbacks!.signIn as unknown as SignInCallback)({
        user: { id: 'x-1', email: null, name: 'Alice' },
        account: {
          provider: 'twitter',
          type: 'oauth',
          providerAccountId: 'x-1',
        },
        profile: {},
      });

      expect(logged.join('\n')).not.toContain('@twitter.placeholder');
    });

    it('the session callback does not log the address', async () => {
      const result = await authOptions.callbacks!.session!({
        session: { user: { name: 'Alice' }, expires: '2099-01-01' },
        token: { id: 'user-1', email: ADDRESS, tier: 'FREE', role: 'USER' },
      } as never);

      expect(result).toBeTruthy();
      expect(logged.join('\n')).not.toContain(ADDRESS);
    });

    it('creating an OAuth user does not log the address', async () => {
      mockUserCreate.mockResolvedValue({
        id: 'user-1',
        name: 'Alice',
        email: ADDRESS,
        emailVerified: new Date(),
        image: null,
      });

      await authOptions.adapter!.createUser!({
        email: ADDRESS,
        name: 'Alice',
        image: null,
        emailVerified: null,
      });

      expect(logged.join('\n')).toContain('[OAuth]');
      expect(logged.join('\n')).not.toContain(ADDRESS);
    });
  });
});
