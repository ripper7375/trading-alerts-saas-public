import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { type NextAuthOptions, type Provider } from 'next-auth';
import type { Account, User } from 'next-auth';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import TwitterProvider from 'next-auth/providers/twitter';

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

// Log which providers are configured (helpful for debugging)
if (process.env.NODE_ENV === 'development') {
  console.log('[Auth] OAuth providers configured:', {
    google: isGoogleConfigured,
    twitter: isTwitterConfigured,
    linkedin: isLinkedInConfigured,
  });
}

// Type for user with 2FA fields (until Prisma client is regenerated)
interface PrismaUserWith2FA {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password: string | null;
  tier: string;
  role: string;
  isAffiliate: boolean;
  isActive: boolean;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  twoFactorEnabled: boolean;
}

/**
 * Generate a temporary 2FA token for the verification step
 */
export function generate2FAToken(userId: string, email: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET not configured');
  }

  return jwt.sign(
    { userId, email, purpose: '2fa_verification' },
    secret,
    { expiresIn: '5m' } // Token expires in 5 minutes
  );
}

/**
 * Custom Prisma Adapter that extends the default adapter to set default values
 * for new OAuth users (tier: FREE, role: USER, emailVerified: now)
 */
function CustomPrismaAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(prisma);

  return {
    ...baseAdapter,
    // Override createUser to set default tier, role, and auto-verify OAuth users
    createUser: async (data: Omit<AdapterUser, 'id'>) => {
      try {
        console.log('[OAuth] Creating user with email:', data.email);
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
        });
        console.log('[OAuth] User created successfully:', user.id);
        return user as AdapterUser;
      } catch (error) {
        console.error('[OAuth] Error creating user:', error);
        throw error;
      }
    },
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. NEXT AUTH CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * NextAuth Configuration with Google OAuth + Credentials providers
 *
 * Features:
 * - Google OAuth 2.0 for seamless user authentication
 * - Twitter/X OAuth 2.0 for social login
 * - Email/password credentials provider for traditional login
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
    // OAuth providers are conditionally included based on environment variables
    // This prevents errors when OAuth credentials are not configured
    ...(isGoogleConfigured
      ? [
          GoogleProvider({
            clientId: process.env['GOOGLE_CLIENT_ID']!,
            clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
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

    // Credentials Provider (Email/Password) - Always available
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'john@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Handle 2FA-verified login (special case)
          if (credentials.email === '__2fa_verified__') {
            // The password contains the 2FA token
            const twoFactorToken = credentials.password;

            try {
              const secret = process.env.NEXTAUTH_SECRET;
              if (!secret) {
                throw new Error('NEXTAUTH_SECRET not configured');
              }

              const decoded = jwt.verify(twoFactorToken, secret) as {
                userId: string;
                email: string;
                purpose: string;
              };

              if (decoded.purpose !== '2fa_verification') {
                return null;
              }

              // Token is valid, get user and complete login
              const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
              });

              if (!user) {
                return null;
              }

              console.log('[Auth] 2FA verification complete for:', user.email);

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier as UserTier,
                role: user.role as UserRole,
                isAffiliate: user.isAffiliate,
                image: user.image,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              };
            } catch {
              console.error('[Auth] Invalid 2FA token');
              return null;
            }
          }

          // Find user in database
          const user = (await prisma.user.findUnique({
            where: { email: credentials.email },
          })) as PrismaUserWith2FA | null;

          // OAuth-only users don't have passwords
          if (!user || !user.password) {
            return null;
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Check if email is verified (only for email/password registration)
          // Users who registered via email must verify their email before logging in
          if (!user.emailVerified) {
            console.log(
              '[Auth] Login rejected: Email not verified for',
              user.email
            );
            throw new Error('EMAIL_NOT_VERIFIED');
          }

          // Check if 2FA is enabled
          if (user.twoFactorEnabled) {
            console.log('[Auth] 2FA required for user:', user.email);
            // Generate temporary token for 2FA verification
            const twoFactorToken = generate2FAToken(user.id, user.email);
            // Throw special error with token to trigger 2FA flow
            throw new Error(`TWO_FACTOR_REQUIRED:${twoFactorToken}`);
          }

          // Return user object with actual database values
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tier: user.tier as UserTier,
            role: user.role as UserRole,
            isAffiliate: user.isAffiliate,
            image: user.image,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };
        } catch (error) {
          // Re-throw EMAIL_NOT_VERIFIED and TWO_FACTOR_REQUIRED errors
          if (error instanceof Error) {
            if (
              error.message === 'EMAIL_NOT_VERIFIED' ||
              error.message.startsWith('TWO_FACTOR_REQUIRED:')
            ) {
              throw error;
            }
          }
          console.error('Credentials authorization error:', error);
          return null;
        }
      },
    }),
  ],

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION STRATEGY
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
    async signIn({ user, account }: { user: User; account: Account | null }) {
      try {
        console.log(
          '[SignIn] Provider:',
          account?.provider,
          'Email:',
          user.email
        );

        // Only apply security check to OAuth providers (not credentials)
        if (account?.provider && account.provider !== 'credentials') {
          if (!user.email) {
            console.error('[SignIn] OAuth user has no email');
            return false;
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: {
              accounts: true, // Include linked accounts
            },
          });

          console.log('[SignIn] Existing user found:', !!existingUser);

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
              `[SignIn] Prevented OAuth account takeover for unverified email: ${user.email}`
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
            });
            console.log('[SignIn] Auto-verified email for OAuth user');
          }

          // Update profile picture from OAuth if user doesn't have one
          if (existingUser && !existingUser.image && user.image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: user.image },
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
      try {
        console.log('[JWT] Trigger:', trigger, 'Has user:', !!user);

        // Initial sign-in: Fetch fresh user data from database
        // This is needed because OAuth adapter creates users without tier/role
        if (user) {
          console.log('[JWT] User ID:', user.id);

          // For credentials provider, user already has tier/role
          // For OAuth, we need to fetch from database
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
            console.log('[JWT] Token populated from DB');
          } else {
            // Fallback to user object (credentials provider)
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
        console.log('[Session] Building session for user:', token.email);
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
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Host-next-auth.csrf-token'
          : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
