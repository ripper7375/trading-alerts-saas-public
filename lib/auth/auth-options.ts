import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { type NextAuthOptions } from 'next-auth';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from '@/lib/db/prisma';
import type { UserTier, UserRole } from '@/types';

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
      return user as AdapterUser;
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
    // Google OAuth Provider
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

    // Credentials Provider (Email/Password)
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
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

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
    async signIn({ user, account }) {
      try {
        // Only apply security check to OAuth providers (not credentials)
        if (account?.provider && account.provider !== 'credentials') {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          // SECURITY: Prevent account takeover via unverified OAuth
          // If a user registered with email/password but hasn't verified,
          // don't allow someone else to link OAuth to that account
          if (existingUser && !existingUser.emailVerified) {
            console.error(
              `Prevented OAuth account takeover attempt for unverified email: ${user.email}`
            );
            return false; // Reject linking to unverified account
          }

          // Update profile picture from OAuth if user doesn't have one
          if (existingUser && !existingUser.image && user.image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: user.image },
            });
          }
        }

        return true; // Allow sign-in
      } catch (error) {
        console.error('SignIn callback error:', error);
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
        // Initial sign-in: Fetch fresh user data from database
        // This is needed because OAuth adapter creates users without tier/role
        if (user) {
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

          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.image = dbUser.image;
            token.tier = dbUser.tier as UserTier;
            token.role = dbUser.role as UserRole;
            token.isAffiliate = dbUser.isAffiliate;
          } else {
            // Fallback to user object (credentials provider)
            token.id = user.id;
            token.tier = user.tier || 'FREE';
            token.role = user.role || 'USER';
            token.isAffiliate = user.isAffiliate || false;
          }
        }

        // Session update: Refresh from database (e.g., after subscription upgrade)
        if (trigger === 'update') {
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
        console.error('JWT callback error:', error);
        return token;
      }
    },

    /**
     * Session Callback - Expose tier, role, and affiliate status to client
     */
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.tier = token.tier as UserTier;
          session.user.role = token.role as UserRole;
          session.user.isAffiliate = token.isAffiliate as boolean;
        }
        return session;
      } catch (error) {
        console.error('Session callback error:', error);
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
};
