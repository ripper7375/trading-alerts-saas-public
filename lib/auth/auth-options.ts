import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { type NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from '@/lib/db/prisma';
import type { UserTier, UserRole } from '@/types';

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

          // Return user object
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tier: user.tier as UserTier,
            role: user.role as UserRole,
            isAffiliate: false, // TODO: Add to Prisma schema in future
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

  adapter: PrismaAdapter(prisma) as Adapter,

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CALLBACKS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  callbacks: {
    /**
     * SignIn Callback - Verified-Only Account Linking
     *
     * SECURITY CRITICAL: Prevents account takeover via OAuth
     * 1. If Google OAuth user exists and email is NOT verified → REJECT linking
     * 2. If new Google OAuth user → Create with FREE tier + auto-verify
     * 3. If existing verified user → Link Google account
     */
    async signIn({ user, account }) {
      try {
        // Only apply security check to Google OAuth
        if (account?.provider === 'google') {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          // SECURITY: Prevent account takeover via unverified OAuth
          if (existingUser && !existingUser.emailVerified) {
            console.error(
              `Prevented OAuth account takeover attempt for email: ${user.email}`
            );
            return false; // Reject linking to unverified account
          }

          // If new user → Create with FREE tier and auto-verify
          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                emailVerified: new Date(), // Auto-verify OAuth users
                password: null, // OAuth-only users don't need passwords
                tier: 'FREE' as UserTier,
                role: 'USER' as UserRole,
                // isAffiliate: false, // TODO: Add to Prisma schema in future
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                  },
                },
              },
            });
          } else {
            // Existing verified user → Link Google account if not already linked
            const existingAccount = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'google',
                  providerAccountId: account.providerAccountId,
                },
              },
            });

            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              });
            }

            // Update profile picture from Google if user doesn't have one
            if (!existingUser.image && user.image) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { image: user.image },
              });
            }
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
     */
    async jwt({ token, user, trigger, session }) {
      try {
        // Initial sign-in: Add user data to token
        if (user) {
          token.id = user.id;
          token.tier = user.tier;
          token.role = user.role;
          token.isAffiliate = user.isAffiliate || false;
        }

        // Session update: Check for tier changes (e.g., subscription upgrade)
        if (trigger === 'update' && session?.tier) {
          token.tier = session.tier;
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
