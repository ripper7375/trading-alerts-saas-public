import 'server-only';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { type NextAuthOptions } from 'next-auth';
import type { Account, Profile, User } from 'next-auth';
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import TwitterProvider from 'next-auth/providers/twitter';

import { ACCOUNT_DEACTIVATED_CODE } from '@/lib/account/deletion';
import {
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_SECONDS,
  clear,
  clientIp,
  release,
  reserve,
  throttleKeys,
} from '@/lib/auth/auth-throttle';
import { BCRYPT_COST } from '@/lib/auth/password-hash';
import {
  COMPLETION_USED_TTL_SECONDS,
  TWO_FACTOR_VERIFIED,
  TwoFactorUnavailableError,
  consumeOnce,
  signChallenge,
  twoFactorKeys,
  verifyTwoFactorToken,
} from '@/lib/auth/two-factor-token';
import {
  ADAPTER_USER_SELECT,
  CREDENTIALS_USER_SELECT,
  ID_ONLY_SELECT,
  SESSION_USER_SELECT,
} from '@/lib/auth/user-select';
import { getSessionState, judgeSession } from '@/lib/auth/user-active';
import { prisma } from '@/lib/db/prisma';
import type { UserTier, UserRole } from '@/types';

// Helper to check if OAuth provider credentials are configured
const isGoogleConfigured = !!(
  process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']
);
const isTwitterConfigured = !!(
  process.env['TWITTER_CLIENT_ID'] && process.env['TWITTER_CLIENT_SECRET']
);
const isLinkedInConfigured = !!(
  process.env['LINKEDIN_CLIENT_ID'] && process.env['LINKEDIN_CLIENT_SECRET']
);

// The app is reachable on both https://davintrade.app (apex, NEXTAUTH_URL)
// and https://www.davintrade.app. NEXTAUTH_URL is fixed to one host, so
// NextAuth always builds the OAuth redirect_uri it sends to Google/Twitter/
// LinkedIn from that one host - regardless of which host a given user was
// actually browsing when they clicked "Sign in". The state/PKCE cookies set
// during signin used to be host-only (no `domain` below), so a user who
// started the flow on the *other* host arrived at the callback with none of
// the cookies NextAuth needed to validate - it threw, and that surfaced as
// `error=Callback` even though the provider's own consent screen succeeded.
// `.davintrade.app` (leading dot) makes these cookies valid for the apex
// domain AND every subdomain, so whichever host the callback lands on, the
// cookie set on the other host is still there.
// Gated on VERCEL_ENV (not NODE_ENV): Vercel sets NODE_ENV=production for
// *both* the real production deployment and preview deployments on
// *.vercel.app - a `.davintrade.app` Domain attribute is invalid for a
// vercel.app host and browsers silently drop the cookie rather than error,
// which would break OAuth on every preview deploy. VERCEL_ENV is
// 'production' only for the real davintrade.app deployment.
const COOKIE_DOMAIN =
  process.env['VERCEL_ENV'] === 'production' ? '.davintrade.app' : undefined;

// Log which providers are configured (helpful for debugging)
if (process.env.NODE_ENV === 'development') {
  console.log('[Auth] OAuth providers configured:', {
    google: isGoogleConfigured,
    twitter: isTwitterConfigured,
    linkedin: isLinkedInConfigured,
  });
}

/**
 * Custom Prisma Adapter that extends the default adapter to set default values
 * for new OAuth users (tier: FREE, role: USER, emailVerified: now)
 */
/** The columns `ADAPTER_USER_SELECT` returns. */
type AdapterUserRow = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
};

/**
 * This app's `AdapterUser` also declares tier, role, isAffiliate, isActive and the two dates, but
 * NextAuth only reads id, email, name, image and emailVerified from an adapter user, and the `jwt`
 * callback below reads the rest fresh from the database (its fallback tests `'tier' in user`).
 * So the narrow row is handed over as it is.
 */
const toAdapterUser = (row: AdapterUserRow): AdapterUser => row as AdapterUser;
const toAdapterUserOrNull = (row: AdapterUserRow | null): AdapterUser | null =>
  row ? toAdapterUser(row) : null;

function CustomPrismaAdapter(): Adapter {
  // @next-auth/prisma-adapter's PrismaAdapter() signature is hardcoded to
  // the default '@prisma/client' PrismaClient type (not generic) — it never
  // touches marketDataV6 or $metrics, only User/Account/Session/
  // VerificationToken (unchanged by the Session 2-3 FK audit), so this cast
  // is safe: the runtime shape it actually calls into is identical.
  const baseAdapter = PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0]
  );

  return {
    ...baseAdapter,
    // Override createUser to set default tier, role, and auto-verify OAuth users
    createUser: async (data: Omit<AdapterUser, 'id'>) => {
      try {
        console.log('[OAuth] Creating user');
        const user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            image: data.image,
            emailVerified: data.emailVerified ?? new Date(), // Auto-verify OAuth users
            tier: 'FREE',
            role: 'USER',
            isAffiliate: false,
          },
          // Only what NextAuth needs back: the INSERT must not RETURN columns the
          // database may not have yet (see lib/auth/user-select.ts).
          select: ADAPTER_USER_SELECT,
        });
        console.log('[OAuth] User created successfully:', user.id);
        return toAdapterUser(user);
      } catch (error) {
        console.error('[OAuth] Error creating user:', error);
        throw error;
      }
    },
    // The base adapter reads and returns whole `User` rows (`findUnique` with no
    // `select`, `account.select.user = true`, `include: { user: true }`). Each method
    // that returns a user is replaced here by the same call with an explicit
    // `select`, so a column the sign-in does not use can be added to the schema ahead
    // of its migration without breaking sign-in (lib/auth/user-select.ts).
    getUser: async (id: string) =>
      toAdapterUserOrNull(
        await prisma.user.findUnique({
          where: { id },
          select: ADAPTER_USER_SELECT,
        })
      ),
    getUserByEmail: async (email: string) =>
      toAdapterUserOrNull(
        await prisma.user.findUnique({
          where: { email },
          select: ADAPTER_USER_SELECT,
        })
      ),
    updateUser: async ({
      id,
      ...data
    }: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) =>
      toAdapterUser(
        await prisma.user.update({
          where: { id },
          data,
          select: ADAPTER_USER_SELECT,
        })
      ),
    deleteUser: async (id: string) =>
      toAdapterUser(
        await prisma.user.delete({
          where: { id },
          select: ADAPTER_USER_SELECT,
        })
      ),
    // Only used by a database session strategy (this app uses JWT); kept correct anyway.
    getSessionAndUser: async (sessionToken: string) => {
      const row = await prisma.session.findUnique({
        where: { sessionToken },
        select: {
          id: true,
          sessionToken: true,
          userId: true,
          expires: true,
          user: { select: ADAPTER_USER_SELECT },
        },
      });
      if (!row) return null;
      const { user, ...session } = row;
      return { user: toAdapterUser(user), session };
    },
    // Diagnostic wrappers (a failure in these during the OAuth callback used to bubble
    // up as a bare `error=Callback` with nothing in the server logs to say why).
    linkAccount: async (account: AdapterAccount) => {
      try {
        console.log(
          '[OAuth] Linking account:',
          account.provider,
          'to user:',
          account.userId
        );
        const result = await baseAdapter.linkAccount!(account);
        console.log('[OAuth] Account linked successfully:', account.provider);
        return result;
      } catch (error) {
        console.error(
          '[OAuth] Error linking account:',
          account.provider,
          error
        );
        throw error;
      }
    },
    getUserByAccount: async (
      providerAccountId: Pick<AdapterAccount, 'provider' | 'providerAccountId'>
    ) => {
      try {
        const account = await prisma.account.findUnique({
          where: { provider_providerAccountId: providerAccountId },
          select: { user: { select: ADAPTER_USER_SELECT } },
        });
        const user = toAdapterUserOrNull(account?.user ?? null);
        console.log(
          '[OAuth] getUserByAccount:',
          providerAccountId.provider,
          'found:',
          !!user
        );
        return user;
      } catch (error) {
        console.error(
          '[OAuth] Error in getUserByAccount:',
          providerAccountId.provider,
          error
        );
        throw error;
      }
    },
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 0. CREDENTIALS SIGN-IN HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * The `email` the verify-2fa page sends, with the one-use completion token in `password`, to finish
 * a sign-in that already passed the password step. Compared before any e-mail normalization: it is
 * never an address.
 */
const TWO_FACTOR_VERIFIED_SENTINEL = '__2fa_verified__';

/** What the credentials sign-in reads of a `User` to build the object NextAuth gets. */
interface CredentialsUserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: string;
  role: string;
  isAffiliate: boolean;
  emailVerified: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toAuthUser(user: CredentialsUserRow): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    tier: user.tier as 'FREE' | 'PRO',
    role: (user.role === 'ADMIN' ? 'ADMIN' : 'USER') as 'USER' | 'ADMIN',
    isAffiliate: user.isAffiliate,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * The second step of a 2FA sign-in (CODE-01A). The token must be a COMPLETION minted by the verify
 * step (a challenge, a `2fa_verification` token of an earlier version or any other JWT is refused)
 * and is spent by this call. Any token or Redis failure is the same `INVALID_CREDENTIALS`: the
 * client learns nothing about why.
 */
async function completeTwoFactorSignIn(completionToken: string): Promise<User> {
  let userId: string;
  try {
    const claims = verifyTwoFactorToken(completionToken, TWO_FACTOR_VERIFIED);
    const first = await consumeOnce(
      twoFactorKeys.used(claims.jti),
      COMPLETION_USED_TTL_SECONDS
    );
    if (!first) {
      throw new Error('completion already used');
    }
    userId = claims.userId;
  } catch (error) {
    if (error instanceof TwoFactorUnavailableError) {
      console.error('[Auth] Two-factor state unavailable; sign-in refused');
    }
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: CREDENTIALS_USER_SELECT,
  });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // The account can be locked, or lose its 2FA, between the code and this call.
  if (!user.isActive) {
    throw new Error(ACCOUNT_DEACTIVATED_CODE);
  }
  if (user.emailVerified === null || user.emailVerified === undefined) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }
  if (!user.twoFactorEnabled) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return toAuthUser(user);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. NEXT AUTH CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * NextAuth Configuration — OAuth (Google, Twitter/X, LinkedIn) + Credentials fallback
 *
 * Email/password login routes through operation-service via `/api/auth/token-login`
 * when `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=true` (see `lib/auth/auth-bridge-flag.ts`),
 * while `CredentialsProvider` below remains the fallback path when the bridge flag
 * is off. OAuth sign-in stays handled here permanently (DECISION-LOG.md F56).
 *
 * Features:
 * - Google OAuth 2.0 for seamless user authentication
 * - Twitter/X OAuth 2.0 for social login
 * - LinkedIn OAuth 2.0 for social login
 * - JWT session strategy for serverless-friendly authentication
 * - Verified-only account linking (security-first)
 * - Tier, role, and affiliate status in JWT and session
 * - Automatic OAuth user verification
 * - Profile picture fallback from Google OAuth
 */
export const authOptions: NextAuthOptions = {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTHENTICATION PROVIDERS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('INVALID_CREDENTIALS');
        }

        // The second step of a 2FA sign-in (see completeTwoFactorSignIn).
        if (credentials.email === TWO_FACTOR_VERIFIED_SENTINEL) {
          return completeTwoFactorSignIn(credentials.password);
        }

        const email = credentials.email.toLowerCase().trim();

        // 1. Check if email matches a predefined non-admin test account (local development and
        // tests only)
        const FIXED_TEST_ACCOUNTS: Record<
          string,
          {
            passwords: string[];
            tier: 'FREE' | 'PRO';
            role: 'USER' | 'ADMIN';
            name: string;
            isAffiliate: boolean;
          }
        > = {
          'free-test@trading-alerts.test': {
            passwords: ['TestPassword123!'],
            tier: 'FREE',
            role: 'USER',
            name: 'Free Test User',
            isAffiliate: false,
          },
          'pro-test@trading-alerts.test': {
            passwords: ['TestPassword123!'],
            tier: 'PRO',
            role: 'USER',
            name: 'Pro Test User',
            isAffiliate: false,
          },
          'affiliate-test@trading-alerts.test': {
            passwords: ['AffiliatePassword123!', 'TestPassword123!'],
            tier: 'FREE',
            role: 'USER',
            name: 'Affiliate Test User',
            isAffiliate: true,
          },
          'affiliate-pro-test@trading-alerts.test': {
            passwords: ['AffiliatePassword123!', 'TestPassword123!'],
            tier: 'PRO',
            role: 'USER',
            name: 'Affiliate Pro Test User',
            isAffiliate: true,
          },
        };

        const runtimeNodeEnv = Reflect.get(process.env, 'NODE_ENV') as
          | string
          | undefined;
        // CODE-08: these passwords are in the source. Any Vercel deployment sets VERCEL_ENV, Preview
        // included, so on one of them the account must come from the database like any other.
        const isTestAccountsAllowed =
          (runtimeNodeEnv === 'development' || runtimeNodeEnv === 'test') &&
          !process.env['VERCEL_ENV'];
        const fixed = isTestAccountsAllowed
          ? FIXED_TEST_ACCOUNTS[email]
          : undefined;
        if (fixed) {
          const isPasswordValid = fixed.passwords.includes(
            credentials.password
          );
          if (!isPasswordValid) {
            throw new Error('INVALID_CREDENTIALS');
          }

          try {
            const hashed = await bcrypt.hash(credentials.password, BCRYPT_COST);
            const dbUser = await prisma.user.upsert({
              where: { email },
              update: {
                name: fixed.name,
                password: hashed,
                tier: fixed.tier,
                role: fixed.role,
                isAffiliate: fixed.isAffiliate,
                emailVerified: new Date(),
                isActive: true,
              },
              create: {
                email,
                name: fixed.name,
                password: hashed,
                tier: fixed.tier,
                role: fixed.role,
                isAffiliate: fixed.isAffiliate,
                emailVerified: new Date(),
                isActive: true,
              },
              select: SESSION_USER_SELECT,
            });

            if (fixed.isAffiliate) {
              const existingProfile = await prisma.affiliateProfile.findUnique({
                where: { userId: dbUser.id },
              });
              if (!existingProfile) {
                const code = email.includes('pro') ? 'PROTESTAFF' : 'TESTAFF10';
                await prisma.affiliateProfile.create({
                  data: {
                    userId: dbUser.id,
                    fullName: fixed.name,
                    country: 'US',
                    paymentMethod: 'PAYPAL',
                    paymentDetails: {},
                    status: 'ACTIVE',
                    verifiedAt: new Date(),
                    affiliateCodes: {
                      create: {
                        code,
                        discountPercent: 10,
                        commissionPercent: 15,
                        status: 'ACTIVE',
                        expiresAt: new Date(
                          Date.now() + 365 * 24 * 60 * 60 * 1000
                        ),
                      },
                    },
                  },
                });
              }
            }

            return {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
              image: dbUser.image,
              tier: dbUser.tier as 'FREE' | 'PRO',
              role: (dbUser.role === 'ADMIN' ? 'ADMIN' : 'USER') as
                | 'USER'
                | 'ADMIN',
              isAffiliate: dbUser.isAffiliate,
              emailVerified: dbUser.emailVerified,
              isActive: dbUser.isActive,
              createdAt: dbUser.createdAt,
              updatedAt: dbUser.updatedAt,
            };
          } catch (dbErr) {
            console.warn(
              '[Auth] Direct DB upsert failed, returning session object:',
              dbErr
            );
            return {
              id: `test-user-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
              email,
              name: fixed.name,
              image: null,
              tier: fixed.tier,
              role: fixed.role,
              isAffiliate: fixed.isAffiliate,
              emailVerified: new Date(),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
        }

        // 2. CODE-01B: failed passwords are limited per account (5 in 15 minutes) and per client
        // address (20 in 15 minutes). The attempt is counted BEFORE the password is looked at,
        // so a parallel burst cannot get past the limit; a right password gives the budget
        // back. An unknown e-mail counts like a wrong password, so nothing tells the two apart.
        // Past the limit even the right password is refused, before any database or bcrypt
        // work. NextAuth turns a thrown error into a 401 whose `error` is this message (never a
        // 429), and login-form.tsx shows its generic message for it. The account key is shared
        // with operation-service (decision D-4). Redis down: open (D-1).
        const ip = clientIp(req?.headers);
        const accountKey = throttleKeys.loginAccount(email);
        const ipKey = ip ? throttleKeys.loginIp(ip) : null;
        const attempt = await reserve([
          {
            key: accountKey,
            limit: LOGIN_ACCOUNT_LIMIT,
            windowSeconds: LOGIN_WINDOW_SECONDS,
          },
          ...(ipKey
            ? [
                {
                  key: ipKey,
                  limit: LOGIN_IP_LIMIT,
                  windowSeconds: LOGIN_WINDOW_SECONDS,
                },
              ]
            : []),
        ]);
        if (attempt.blocked) {
          throw new Error('RATE_LIMITED');
        }

        // 3. Regular user database lookup
        const user = await prisma.user
          .findUnique({
            where: { email },
            select: CREDENTIALS_USER_SELECT,
          })
          .catch(async (error: unknown) => {
            // The database failed, not the password: the attempt does not count.
            await release([accountKey, ...(ipKey ? [ipKey] : [])]);
            throw error;
          });

        if (!user || !user.password) {
          throw new Error('INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('INVALID_CREDENTIALS');
        }

        // The password is right (whatever else is wrong with the account): the account's run of
        // failures ends, and the address is not charged for a failure.
        await Promise.all([clear([accountKey]), release(ipKey ? [ipKey] : [])]);

        // Locked by a confirmed account deletion (F21) or suspended by an admin. After the
        // password check, so only someone who knows the password learns the account's state.
        if (!user.isActive) {
          throw new Error(ACCOUNT_DEACTIVATED_CODE);
        }

        if (user.emailVerified === null || user.emailVerified === undefined) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        // CODE-01A: a user with 2FA is asked for a code. The challenge travels in the error
        // message to login-form.tsx, which sends the user to /verify-2fa; the session comes from
        // the completion step above.
        if (user.twoFactorEnabled) {
          throw new Error(
            `TWO_FACTOR_REQUIRED:${signChallenge({ userId: user.id, email: user.email })}`
          );
        }

        return toAuthUser(user);
      },
    }),

    // OAuth providers are conditionally included based on environment variables
    // This prevents errors when OAuth credentials are not configured
    ...(isGoogleConfigured
      ? [
          GoogleProvider({
            clientId: process.env['GOOGLE_CLIENT_ID']!,
            clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
            // Google vouches for the address (`email_verified`), so a Google sign-in is linked to the
            // account that already uses it. The `signIn` callback refuses a profile where
            // `email_verified` is not exactly true (CODE-05). X and LinkedIn below do not link by
            // e-mail: NextAuth answers OAuthAccountNotLinked.
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),

    ...(isTwitterConfigured
      ? [
          TwitterProvider({
            clientId: process.env['TWITTER_CLIENT_ID']!,
            clientSecret: process.env['TWITTER_CLIENT_SECRET']!,
            version: '2.0',
            authorization: {
              params: {
                scope: 'tweet.read users.read offline.access',
              },
            },
          }),
        ]
      : []),

    ...(isLinkedInConfigured
      ? [
          LinkedInProvider({
            clientId: process.env['LINKEDIN_CLIENT_ID']!,
            clientSecret: process.env['LINKEDIN_CLIENT_SECRET']!,
            authorization: {
              params: {
                scope: 'openid profile email',
              },
            },
          }),
        ]
      : []),
  ],

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION STRATEGY
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 7 days, renewed once a day while the person is active (D-5). `maxAge` is global in NextAuth, so
  // the shorter life of an ADMIN session is enforced by `authTime` in the jwt callback instead.
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATABASE ADAPTER (for OAuth accounts)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  adapter: CustomPrismaAdapter(),

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CALLBACKS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  callbacks: {
    /**
     * SignIn Callback - Security Check for Account Linking
     *
     * SECURITY CRITICAL: Prevents account takeover via OAuth
     * - If OAuth user exists with unverified email → REJECT (prevents takeover)
     * - User creation is handled by CustomPrismaAdapter (not here)
     * - Account linking is handled automatically by NextAuth + adapter
     */
    async signIn({
      user,
      account,
      profile,
    }: {
      user: User;
      account: Account | null;
      profile?: Profile & { email_verified?: boolean };
    }) {
      try {
        console.log('[SignIn] Provider:', account?.provider);

        if (account?.provider === 'credentials') {
          return true;
        }

        // account.provider is an OAuth provider name here
        if (account?.provider) {
          // CODE-05: Google's sign-in links to the account that already uses the address, so it
          // goes through only when Google says it verified that address. Strictly `true`: a missing
          // field, a string or a number is a refusal. X and LinkedIn do not link by e-mail, so they
          // need no such field.
          if (
            account.provider === 'google' &&
            profile?.email_verified !== true
          ) {
            console.warn(
              '[SignIn] Refused a Google profile without a verified e-mail'
            );
            return false;
          }

          // Twitter doesn't provide email - generate a placeholder email using Twitter ID
          if (!user.email && account.provider === 'twitter') {
            const twitterId = account.providerAccountId;
            user.email = `twitter_${twitterId}@twitter.placeholder`;
            console.log(
              '[SignIn] Twitter user without email, using placeholder'
            );
          }

          if (!user.email) {
            console.error('[SignIn] OAuth user has no email');
            return false;
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            // Only what this callback reads (see lib/auth/user-select.ts).
            select: {
              id: true,
              isActive: true,
              emailVerified: true,
              image: true,
              accounts: { select: { id: true } }, // linked accounts
            },
          });

          console.log('[SignIn] Existing user found:', !!existingUser);

          // A locked account (confirmed deletion, F21, or an admin suspension) gets no
          // session through OAuth either. The login form reads the code from the URL.
          if (existingUser && !existingUser.isActive) {
            console.warn('[SignIn] Refused a deactivated account');
            return `/login?error=${ACCOUNT_DEACTIVATED_CODE}`;
          }

          // SECURITY: Prevent account takeover via unverified OAuth
          // Only block if:
          // 1. User exists
          // 2. Email is NOT verified
          // 3. User has NO OAuth accounts (meaning they registered with email/password)
          if (
            existingUser &&
            !existingUser.emailVerified &&
            existingUser.accounts &&
            existingUser.accounts.length === 0
          ) {
            console.error(
              `[SignIn] Prevented OAuth account takeover for unverified email, user: ${existingUser.id}`
            );
            return false; // Reject linking to unverified email/password account
          }

          // For OAuth sign-ins, auto-verify email since OAuth providers verify emails
          if (
            existingUser &&
            !existingUser.emailVerified &&
            existingUser.accounts &&
            existingUser.accounts.length > 0
          ) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { emailVerified: new Date() },
              select: ID_ONLY_SELECT,
            });
            console.log('[SignIn] Auto-verified email for OAuth user');
          }

          // Update profile picture from OAuth if user doesn't have one
          if (existingUser && !existingUser.image && user.image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: user.image },
              select: ID_ONLY_SELECT,
            });
            console.log('[SignIn] Updated user profile image');
          }
        }

        console.log('[SignIn] Allowing sign-in');
        return true; // Allow sign-in
      } catch (error) {
        console.error('[SignIn] Callback error:', error);
        return false;
      }
    },

    /**
     * JWT Callback - Include tier, role, and affiliate status
     *
     * Fetches fresh user data from database on initial sign-in to ensure
     * tier, role, and isAffiliate are correctly populated in the JWT token.
     */
    async jwt({ token, user, trigger }) {
      // Every session read after sign-in: is the account still live, and is this still the session
      // it was minted for? (F21, CODE-02A; the rules are in lib/auth/user-active.ts.) Outside the
      // try below on purpose: it swallows errors and returns the token, and this one must
      // escape. NextAuth turns a throw from this callback into "no session" and clears the
      // cookie, so a user who confirmed a deletion is signed out on their next request.
      if (!user && typeof token.id === 'string') {
        const verdict = judgeSession(token, await getSessionState(token.id));
        if (!verdict.ok) {
          throw new Error(verdict.code);
        }
        // Role and tier follow the database (within the 30 s cache window): a demotion or a PRO
        // expiry shows without a new sign-in.
        if (verdict.state) {
          token.role = verdict.state.role as UserRole;
          token.tier = verdict.state.tier as UserTier;
        }
      }

      try {
        console.log('[JWT] Trigger:', trigger, 'Has user:', !!user);

        // Initial sign-in: Fetch fresh user data from database
        // This is needed because OAuth adapter creates users without tier/role
        if (user) {
          console.log('[JWT] User ID:', user.id);

          // When the person signed in: an ADMIN session ends 12 hours after it.
          token.authTime = Math.floor(Date.now() / 1000);

          // Always fetch fresh from the database - OAuth's own user object
          // never carries tier/role.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              tier: true,
              role: true,
              isAffiliate: true,
              sessionVersion: true,
            },
          });

          console.log('[JWT] DB user found:', !!dbUser);

          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.image = dbUser.image;
            token.tier = dbUser.tier as UserTier;
            token.role = dbUser.role as UserRole;
            token.isAffiliate = dbUser.isAffiliate;
            token.sessionVersion = dbUser.sessionVersion;
            console.log('[JWT] Token populated from DB');
          } else {
            // Fallback: the DB lookup above found nothing (shouldn't happen
            // for a real OAuth sign-in, since the adapter creates the row
            // first) - keep whatever the user object itself carries.
            token.id = user.id;
            token.tier = ('tier' in user ? user.tier : 'FREE') as UserTier;
            token.role = ('role' in user ? user.role : 'USER') as UserRole;
            token.isAffiliate = (
              'isAffiliate' in user ? user.isAffiliate : false
            ) as boolean;
            console.log('[JWT] Token populated from user object (fallback)');
          }
        }

        // Session update: Refresh from database (e.g., after subscription upgrade)
        if (trigger === 'update') {
          console.log('[JWT] Session update, refreshing from DB');
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tier: true, role: true, isAffiliate: true },
          });

          if (dbUser) {
            token.tier = dbUser.tier as UserTier;
            token.role = dbUser.role as UserRole;
            token.isAffiliate = dbUser.isAffiliate;
          }
        }

        return token;
      } catch (error) {
        console.error('[JWT] Callback error:', error);
        return token;
      }
    },

    /**
     * Session Callback - Expose tier, role, and affiliate status to client
     */
    async session({ session, token }) {
      try {
        console.log('[Session] Building session for user:', token.id);
        if (session.user) {
          session.user.id = token.id as string;
          session.user.tier = token.tier as UserTier;
          session.user.role = token.role as UserRole;
          session.user.isAffiliate = token.isAffiliate as boolean;
        }
        console.log('[Session] Session built successfully');
        return session;
      } catch (error) {
        console.error('[Session] Callback error:', error);
        return session;
      }
    },

    /**
     * Redirect Callback - Only same-site destinations are allowed after sign-in
     * (open-redirect guard).
     *
     * Not delegated to safeCallbackUrl(): that helper refuses /login,
     * /register and /verify-2fa, which are legitimate destinations here
     * (lib/auth/errors.ts and several pages redirect to
     * /login?callbackUrl=... and /verify-2fa).
     */
    async redirect({ url, baseUrl }) {
      // A single leading slash is a path on this site. '//host' and '/\host'
      // are protocol-relative to a browser, so they are refused.
      if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        const base = new URL(baseUrl);

        // Exact origin (scheme + host + port), not a string prefix:
        // 'https://davintrade.app.evil.com' must not pass for baseUrl
        // 'https://davintrade.app'.
        if (target.origin === base.origin) {
          return url;
        }

        // The app is served on both the apex and www hosts: same scheme and
        // port, host equal once a leading 'www.' is dropped.
        const withoutWww = (host: string): string =>
          host.replace(/^www\./i, '');
        if (
          target.protocol === base.protocol &&
          target.port === base.port &&
          withoutWww(target.hostname) === withoutWww(base.hostname)
        ) {
          return url;
        }

        // Preview deployments: this deployment's own hostnames only, never
        // every *.vercel.app host.
        if (process.env['VERCEL_ENV'] === 'preview') {
          const previewHosts = [
            process.env['VERCEL_URL'],
            process.env['VERCEL_BRANCH_URL'],
          ].filter((host): host is string => Boolean(host));
          if (
            target.protocol === 'https:' &&
            previewHosts.includes(target.host)
          ) {
            return url;
          }
        }

        // Local development only. The scheme check keeps
        // 'javascript://localhost/...' out.
        const runtimeNodeEnv = Reflect.get(process.env, 'NODE_ENV') as
          | string
          | undefined;
        if (
          runtimeNodeEnv !== 'production' &&
          (target.protocol === 'http:' || target.protocol === 'https:') &&
          (target.hostname === 'localhost' || target.hostname === '127.0.0.1')
        ) {
          return url;
        }
      } catch {
        // Malformed URL: fall back to baseUrl
      }
      return baseUrl;
    },
  },

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGES CONFIGURATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pages: {
    signIn: '/login',
    error: '/login', // OAuth errors redirect to login page
  },

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECURITY SETTINGS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  debug: process.env.NODE_ENV === 'development',

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COOKIE SECURITY (explicit settings for security hardening)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.callback-url'
          : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.csrf-token'
          : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
    // These three were previously left undefined, silently falling back to
    // NextAuth's own defaults (host-only, no `domain`) - state and
    // pkceCodeVerifier are exactly the cookies the OAuth callback validates,
    // so leaving them host-only is what actually produced error=Callback for
    // any user who started sign-in on the other host. Explicit here so they
    // share COOKIE_DOMAIN like the rest.
    state: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.state'
          : 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900, // 15 minutes - matches NextAuth's own default
        domain: COOKIE_DOMAIN,
      },
    },
    pkceCodeVerifier: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.pkce.code_verifier'
          : 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900, // 15 minutes - matches NextAuth's own default
        domain: COOKIE_DOMAIN,
      },
    },
    nonce: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.nonce'
          : 'next-auth.nonce',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: COOKIE_DOMAIN,
      },
    },
  },
};
