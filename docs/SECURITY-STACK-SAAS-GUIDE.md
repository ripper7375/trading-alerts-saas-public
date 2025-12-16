# COMPREHENSIVE SECURITY STACK GUIDE FOR SAAS

## Trading Alerts Platform - Enterprise Security Implementation

**Version:** 1.0.0
**Last Updated:** 2025-11-18
**Target Platform:** Next.js 15 + Flask MT5 Microservice
**Purpose:** Complete security architecture reference for modern SaaS applications

---

## 📖 TABLE OF CONTENTS

1. [Security Architecture Overview](#security-architecture-overview)
2. [Authentication & Authorization Stack](#authentication--authorization-stack)
3. [API Security Layer](#api-security-layer)
4. [Data Protection & Encryption](#data-protection--encryption)
5. [Infrastructure Security](#infrastructure-security)
6. [Application Security](#application-security)
7. [Payment Security](#payment-security)
8. [Third-Party Integration Security](#third-party-integration-security)
9. [Monitoring & Logging](#monitoring--logging)
10. [Compliance & Governance](#compliance--governance)
11. [Incident Response](#incident-response)
12. [Security Tools & Services](#security-tools--services)
13. [Implementation Roadmap](#implementation-roadmap)
14. [Security Checklist](#security-checklist)

---

## 🔐 SECURITY ARCHITECTURE OVERVIEW

### Multi-Layer Defense Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL THREAT LANDSCAPE                    │
│  DDoS • Bots • API Abuse • Credential Stuffing • Data Scraping │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: EDGE SECURITY (CDN + WAF)                             │
│ ✓ Cloudflare / AWS CloudFront + WAF                            │
│ ✓ DDoS Protection (L3/L4/L7)                                   │
│ ✓ Bot Detection & Mitigation                                   │
│ ✓ Rate Limiting (Global)                                       │
│ ✓ Geographic Blocking                                          │
│ ✓ SSL/TLS Termination                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: APPLICATION FIREWALL                                  │
│ ✓ OWASP Top 10 Protection                                      │
│ ✓ SQL Injection Prevention                                     │
│ ✓ XSS Protection                                               │
│ ✓ CSRF Protection                                              │
│ ✓ Request Validation                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: AUTHENTICATION & AUTHORIZATION                        │
│ ✓ NextAuth.js (OAuth + Credentials)                           │
│ ✓ JWT Tokens (Signed + Encrypted)                             │
│ ✓ Session Management                                           │
│ ✓ RBAC (Role-Based Access Control)                            │
│ ✓ MFA (Multi-Factor Authentication)                           │
│ ✓ OAuth 2.0 / OpenID Connect                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: API SECURITY                                          │
│ ✓ API Key Management                                           │
│ ✓ Rate Limiting (Per User/IP)                                 │
│ ✓ Request Signing                                              │
│ ✓ Input Validation (Zod)                                      │
│ ✓ Output Sanitization                                         │
│ ✓ CORS Configuration                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: APPLICATION SECURITY                                  │
│ ✓ Secure Headers (HSTS, CSP, etc.)                            │
│ ✓ Content Security Policy                                      │
│ ✓ Dependency Scanning                                          │
│ ✓ Secret Management (Vault)                                    │
│ ✓ Code Analysis (SAST)                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 6: DATA PROTECTION                                       │
│ ✓ Encryption at Rest (AES-256)                                │
│ ✓ Encryption in Transit (TLS 1.3)                             │
│ ✓ Database Encryption                                          │
│ ✓ PII/PCI Data Protection                                     │
│ ✓ Backup Encryption                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 7: INFRASTRUCTURE SECURITY                               │
│ ✓ VPC/Network Isolation                                        │
│ ✓ Private Subnets                                             │
│ ✓ Security Groups/Firewalls                                   │
│ ✓ Container Security                                           │
│ ✓ Secrets Rotation                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 8: MONITORING & RESPONSE                                 │
│ ✓ SIEM (Security Information & Event Management)              │
│ ✓ Intrusion Detection (IDS)                                   │
│ ✓ Audit Logging                                               │
│ ✓ Anomaly Detection                                           │
│ ✓ Incident Response Automation                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ✅ SECURE APPLICATION
```

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions by default
3. **Zero Trust**: Never trust, always verify
4. **Fail Secure**: Deny access when in doubt
5. **Security by Design**: Built-in from the start
6. **Continuous Monitoring**: Real-time threat detection

---

## 🔑 AUTHENTICATION & AUTHORIZATION STACK

### 1. Authentication Architecture

#### NextAuth.js Configuration

```typescript
// lib/auth/auth-config.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Session strategy
  session: {
    strategy: 'jwt', // JWT for scalability
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // Authentication providers
  providers: [
    // OAuth 2.0 - Google
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
      // Security: Email verification required
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          emailVerified: profile.email_verified ? new Date() : null,
          name: profile.name,
          image: profile.picture,
          role: 'USER',
          tier: 'FREE',
        };
      },
    }),

    // Credentials (Email + Password)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          // Log failed attempt
          await logFailedLogin(user.id, 'invalid_password');
          throw new Error('Invalid credentials');
        }

        // Check if email verified
        if (!user.emailVerified) {
          throw new Error('Email not verified');
        }

        // Check if account active
        if (!user.isActive) {
          throw new Error('Account suspended');
        }

        // Log successful login
        await logSuccessfulLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tier: user.tier,
        };
      },
    }),
  ],

  // Callbacks for JWT customization
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tier = user.tier;
        token.emailVerified = user.emailVerified;
      }

      // Update token on session update
      if (trigger === 'update' && session) {
        token.tier = session.user.tier;
        token.name = session.user.name;
      }

      // OAuth provider info
      if (account?.provider) {
        token.provider = account.provider;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tier = token.tier as string;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },

    // Redirect after authentication
    async redirect({ url, baseUrl }) {
      // Prevent open redirect vulnerability
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  // Custom pages
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-email',
    newUser: '/onboarding',
  },

  // Security settings
  useSecureCookies: process.env.NODE_ENV === 'production',

  // JWT secret (strong random string)
  secret: process.env.NEXTAUTH_SECRET,

  // Events for logging
  events: {
    async signIn({ user, account, isNewUser }) {
      await logAuditEvent({
        event: 'user_signin',
        userId: user.id,
        provider: account?.provider,
        isNewUser,
        timestamp: new Date(),
      });
    },
    async signOut({ token }) {
      await logAuditEvent({
        event: 'user_signout',
        userId: token.id,
        timestamp: new Date(),
      });
    },
  },
};
```

#### Security Features Explained

**1. JWT Token Security**

- **Signed tokens**: Prevents tampering (HS256/RS256)
- **Encrypted cookies**: Prevents token theft
- **Short expiration**: Reduces attack window
- **Token rotation**: Refresh tokens for long sessions
- **Secure transmission**: HTTPS only

**2. OAuth 2.0 Best Practices**

- **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception
- **State parameter**: CSRF protection
- **Nonce**: Replay attack prevention
- **Scope limitation**: Request minimal permissions
- **Token validation**: Verify issuer and audience

**3. Password Security**

- **bcrypt hashing**: Adaptive hash function (10+ rounds)
- **Salt**: Unique per password
- **No password exposure**: Never log or transmit plaintext
- **Complexity requirements**: Enforced via Zod validation

---

### 2. Role-Based Access Control (RBAC)

#### Permission System

```typescript
// lib/auth/permissions.ts

// Define roles
export enum UserRole {
  USER = 'USER',
  AFFILIATE = 'AFFILIATE',
  ADMIN = 'ADMIN',
}

// Define permissions
export enum Permission {
  // User permissions
  VIEW_OWN_DATA = 'view:own_data',
  UPDATE_OWN_PROFILE = 'update:own_profile',
  CREATE_ALERTS = 'create:alerts',
  DELETE_OWN_ALERTS = 'delete:own_alerts',

  // Affiliate permissions
  VIEW_AFFILIATE_STATS = 'view:affiliate_stats',
  GENERATE_AFFILIATE_LINKS = 'generate:affiliate_links',
  WITHDRAW_COMMISSIONS = 'withdraw:commissions',

  // Admin permissions
  VIEW_ALL_USERS = 'view:all_users',
  UPDATE_ANY_USER = 'update:any_user',
  DELETE_ANY_USER = 'delete:any_user',
  VIEW_SYSTEM_STATS = 'view:system_stats',
  MANAGE_SETTINGS = 'manage:settings',
  VIEW_AUDIT_LOGS = 'view:audit_logs',
}

// Role-Permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.VIEW_OWN_DATA,
    Permission.UPDATE_OWN_PROFILE,
    Permission.CREATE_ALERTS,
    Permission.DELETE_OWN_ALERTS,
  ],

  [UserRole.AFFILIATE]: [
    // Inherits USER permissions
    ...rolePermissions[UserRole.USER],
    Permission.VIEW_AFFILIATE_STATS,
    Permission.GENERATE_AFFILIATE_LINKS,
    Permission.WITHDRAW_COMMISSIONS,
  ],

  [UserRole.ADMIN]: [
    // Inherits AFFILIATE permissions
    ...rolePermissions[UserRole.AFFILIATE],
    Permission.VIEW_ALL_USERS,
    Permission.UPDATE_ANY_USER,
    Permission.DELETE_ANY_USER,
    Permission.VIEW_SYSTEM_STATS,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
  ],
};

// Check permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Check multiple permissions (AND logic)
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// Check multiple permissions (OR logic)
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
```

#### Middleware for Route Protection

```typescript
// middleware.ts (Next.js Edge Middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define protected routes
const protectedRoutes = [
  '/dashboard',
  '/alerts',
  '/watchlist',
  '/settings',
  '/billing',
];

const adminRoutes = ['/admin'];

const affiliateRoutes = ['/affiliate'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isAffiliateRoute = affiliateRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect unauthenticated users
  if (isProtectedRoute && !token) {
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Check admin access
  if (isAdminRoute && token?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Check affiliate access
  if (
    isAffiliateRoute &&
    !['AFFILIATE', 'ADMIN'].includes(token?.role as string)
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Add security headers
  const response = NextResponse.next();

  // Security headers (OWASP recommendations)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://api.minimaxi.com",
      "frame-src 'self' https://js.stripe.com",
    ].join('; ')
  );

  return response;
}

// Configure which routes use middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

---

### 3. Multi-Factor Authentication (MFA)

#### TOTP Implementation

```typescript
// lib/auth/mfa.ts
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export async function generateMFASecret(userId: string, email: string) {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `Trading Alerts (${email})`,
    issuer: 'Trading Alerts',
    length: 32,
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  // Store secret in database (encrypted)
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptSecret(secret.base32),
      mfaEnabled: false, // Enable after verification
    },
  });

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
  };
}

export function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps (±60 seconds)
  });
}

export async function enableMFA(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.mfaSecret) {
    throw new Error('MFA not configured');
  }

  const decryptedSecret = decryptSecret(user.mfaSecret);
  const isValid = verifyMFAToken(decryptedSecret, token);

  if (!isValid) {
    throw new Error('Invalid MFA token');
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaBackupCodes: encryptBackupCodes(backupCodes),
    },
  });

  return backupCodes;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
  }
  return codes;
}
```

#### MFA Enforcement Policies

```typescript
// lib/auth/mfa-policies.ts

export interface MFAPolicy {
  enforceForRole: UserRole[];
  enforceAfterDays?: number;
  allowedMethods: ('totp' | 'sms' | 'email')[];
  gracePeriodDays: number;
}

export const MFA_POLICIES: Record<string, MFAPolicy> = {
  // Admins must enable MFA
  admin: {
    enforceForRole: [UserRole.ADMIN],
    enforceAfterDays: 0, // Immediate
    allowedMethods: ['totp'],
    gracePeriodDays: 0,
  },

  // High-value users (optional but recommended)
  proUser: {
    enforceForRole: [UserRole.USER],
    enforceAfterDays: 30,
    allowedMethods: ['totp', 'email'],
    gracePeriodDays: 7,
  },
};

export async function checkMFARequirement(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) return { required: false };

  // Check if MFA already enabled
  if (user.mfaEnabled) {
    return { required: false, enabled: true };
  }

  // Check policies
  const policy = MFA_POLICIES[user.role.toLowerCase()] || MFA_POLICIES.admin;

  if (!policy.enforceForRole.includes(user.role as UserRole)) {
    return { required: false };
  }

  // Check grace period
  const accountAge = Date.now() - user.createdAt.getTime();
  const gracePeriodMs = policy.gracePeriodDays * 24 * 60 * 60 * 1000;

  if (accountAge < gracePeriodMs) {
    return {
      required: true,
      gracePeriod: true,
      daysRemaining: Math.ceil(
        (gracePeriodMs - accountAge) / (24 * 60 * 60 * 1000)
      ),
    };
  }

  return {
    required: true,
    gracePeriod: false,
  };
}
```

---

## 🛡️ API SECURITY LAYER

### 1. Rate Limiting

#### Multi-Tier Rate Limiting Strategy

```typescript
// lib/api/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Define rate limits per tier
export const RATE_LIMITS = {
  // Anonymous (IP-based)
  anonymous: {
    requests: 20,
    window: '1 m', // 20 requests per minute
  },

  // FREE tier
  free: {
    requests: 100,
    window: '1 m', // 100 requests per minute
  },

  // PRO tier
  pro: {
    requests: 1000,
    window: '1 m', // 1000 requests per minute
  },

  // Admin
  admin: {
    requests: 10000,
    window: '1 m', // 10,000 requests per minute
  },

  // Sensitive endpoints (login, signup)
  auth: {
    requests: 5,
    window: '1 m', // 5 attempts per minute
  },

  // Payment endpoints
  payment: {
    requests: 10,
    window: '1 h', // 10 requests per hour
  },
};

// Create rate limiters
export const rateLimiters = {
  anonymous: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.anonymous.requests,
      RATE_LIMITS.anonymous.window
    ),
    analytics: true,
    prefix: 'ratelimit:anon',
  }),

  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.free.requests,
      RATE_LIMITS.free.window
    ),
    analytics: true,
    prefix: 'ratelimit:free',
  }),

  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.pro.requests,
      RATE_LIMITS.pro.window
    ),
    analytics: true,
    prefix: 'ratelimit:pro',
  }),

  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.admin.requests,
      RATE_LIMITS.admin.window
    ),
    analytics: true,
    prefix: 'ratelimit:admin',
  }),

  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.auth.requests,
      RATE_LIMITS.auth.window
    ),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  payment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.payment.requests,
      RATE_LIMITS.payment.window
    ),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),
};

// Rate limit middleware
export async function checkRateLimit(
  identifier: string,
  tier: 'anonymous' | 'free' | 'pro' | 'admin' | 'auth' | 'payment'
) {
  const limiter = rateLimiters[tier];
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
    retryAfter: reset - Date.now(),
  };
}

// Helper to get rate limit headers
export function getRateLimitHeaders(
  result: Awaited<ReturnType<typeof checkRateLimit>>
) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    ...(result.retryAfter > 0 && {
      'Retry-After': Math.ceil(result.retryAfter / 1000).toString(),
    }),
  };
}
```

#### Usage in API Routes

```typescript
// app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    // Determine rate limit tier
    const identifier = session?.user?.id || req.ip || 'anonymous';
    const tier =
      session?.user?.tier === 'PRO'
        ? 'pro'
        : session?.user?.tier === 'FREE'
          ? 'free'
          : 'anonymous';

    // Check rate limit
    const rateLimitResult = await checkRateLimit(identifier, tier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${Math.ceil(rateLimitResult.retryAfter / 1000)} seconds`,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Process request...
    const data = await fetchData();

    return NextResponse.json(data, {
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 2. Input Validation & Sanitization

#### Zod Schemas for Validation

```typescript
// lib/validation/schemas.ts
import { z } from 'zod';

// Common patterns
const emailSchema = z.string().email().toLowerCase().trim();
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character');

const uuidSchema = z.string().uuid();

// User registration
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2).max(100).trim(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept terms and conditions',
  }),
});

// Alert creation
export const createAlertSchema = z.object({
  symbol: z.enum([
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPUSD',
    'USDJPY',
    'AUDUSD',
    'USDCAD',
    'NZDUSD',
    'EURGBP',
    'EURJPY',
    'US30',
    'US500',
    'US100',
    'XAUUSD',
    'XAGUSD',
  ]),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.enum(['above', 'below', 'cross_above', 'cross_below']),
  value: z.number().positive().finite(),
  notification: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
    })
    .optional(),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Sanitization helpers
export function sanitizeHtml(input: string): string {
  // Remove HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>\"\']/g, '')
    .trim();
}

export function sanitizeFilename(filename: string): string {
  // Only allow alphanumeric, dash, underscore, dot
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

// SQL injection prevention (additional layer with Prisma)
export function escapeSqlString(input: string): string {
  // Prisma handles this, but additional validation
  return input.replace(/'/g, "''");
}
```

#### Validation Middleware

```typescript
// lib/api/validate.ts
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

export function validateRequest<T>(schema: ZodSchema<T>) {
  return async (req: NextRequest): Promise<{ data: T } | NextResponse> => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return { data: validated };
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  };
}

// Usage
export async function POST(req: NextRequest) {
  const result = await validateRequest(createAlertSchema)(req);

  if (result instanceof NextResponse) {
    return result; // Validation error
  }

  const { data } = result;
  // Process validated data...
}
```

---

### 3. CORS Configuration

```typescript
// lib/api/cors.ts
import { NextRequest, NextResponse } from 'next/server';

export interface CorsOptions {
  origin: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const defaultOptions: CorsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export function cors(options: CorsOptions = defaultOptions) {
  return (req: NextRequest, res: NextResponse) => {
    const origin = req.headers.get('origin');

    // Check if origin is allowed
    let allowedOrigin: string | null = null;

    if (typeof options.origin === 'string') {
      allowedOrigin = options.origin;
    } else if (Array.isArray(options.origin)) {
      if (origin && options.origin.includes(origin)) {
        allowedOrigin = origin;
      }
    } else if (typeof options.origin === 'function') {
      if (origin && options.origin(origin)) {
        allowedOrigin = origin;
      }
    }

    if (allowedOrigin) {
      res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    }

    if (options.credentials) {
      res.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (options.methods) {
      res.headers.set(
        'Access-Control-Allow-Methods',
        options.methods.join(', ')
      );
    }

    if (options.allowedHeaders) {
      res.headers.set(
        'Access-Control-Allow-Headers',
        options.allowedHeaders.join(', ')
      );
    }

    if (options.exposedHeaders) {
      res.headers.set(
        'Access-Control-Expose-Headers',
        options.exposedHeaders.join(', ')
      );
    }

    if (options.maxAge) {
      res.headers.set('Access-Control-Max-Age', options.maxAge.toString());
    }

    return res;
  };
}

// Handle preflight requests
export function handlePreflight(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return cors()(req, response);
  }
  return null;
}
```

---

### 4. API Key Management

```typescript
// lib/api/api-keys.ts
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string; // Hashed
  prefix: string; // First 8 chars for identification
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export async function generateApiKey(
  userId: string,
  name: string,
  permissions: string[] = [],
  expiresInDays?: number
): Promise<{ key: string; prefix: string }> {
  // Generate random key (32 bytes = 256 bits)
  const rawKey = crypto.randomBytes(32).toString('hex');
  const prefix = `sk_${rawKey.substring(0, 8)}`;
  const fullKey = `${prefix}_${rawKey.substring(8)}`;

  // Hash key for storage
  const hashedKey = crypto.createHash('sha256').update(fullKey).digest('hex');

  // Calculate expiration
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Store in database
  await prisma.apiKey.create({
    data: {
      userId,
      name,
      key: hashedKey,
      prefix,
      permissions,
      expiresAt,
    },
  });

  // Return unhashed key (only time it's visible)
  return { key: fullKey, prefix };
}

export async function validateApiKey(key: string): Promise<ApiKey | null> {
  // Extract prefix
  const prefix = key.substring(0, 11); // sk_xxxxxxxx

  // Hash provided key
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

  // Find key in database
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      prefix,
      key: hashedKey,
      revokedAt: null,
    },
  });

  if (!apiKey) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey as ApiKey;
}

export async function revokeApiKey(apiKeyId: string, userId: string) {
  await prisma.apiKey.updateMany({
    where: {
      id: apiKeyId,
      userId, // Ensure user owns the key
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
```

#### API Key Authentication Middleware

```typescript
// lib/api/auth-api-key.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from './api-keys';

export async function authenticateApiKey(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const validKey = await validateApiKey(apiKey);

  if (!validKey) {
    return NextResponse.json(
      { error: 'Invalid or expired API key' },
      { status: 401 }
    );
  }

  return validKey;
}

// Usage in API routes
export async function GET(req: NextRequest) {
  const apiKey = await authenticateApiKey(req);

  if (apiKey instanceof NextResponse) {
    return apiKey; // Error response
  }

  // Check permissions
  if (!apiKey.permissions.includes('read:alerts')) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Process request with apiKey.userId
}
```

---

## 🔒 DATA PROTECTION & ENCRYPTION

### 1. Encryption at Rest

#### Database Encryption (PostgreSQL)

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  -- Encrypted PII
  phone_encrypted BYTEA,
  ssn_encrypted BYTEA, -- If required for compliance

  -- Encryption metadata
  encryption_key_id VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Function to encrypt data
CREATE OR REPLACE FUNCTION encrypt_data(
  data TEXT,
  key TEXT
) RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt data
CREATE OR REPLACE FUNCTION decrypt_data(
  encrypted BYTEA,
  key TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted, key);
END;
$$ LANGUAGE plpgsql;
```

#### Application-Level Encryption

```typescript
// lib/encryption/crypto.ts
import crypto from 'crypto';

// Use strong encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment (rotated regularly)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Derive key using PBKDF2
  return crypto.pbkdf2Sync(
    key,
    process.env.ENCRYPTION_SALT || 'default-salt',
    100000,
    KEY_LENGTH,
    'sha256'
  );
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Hash sensitive data (one-way)
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Secure random token generation
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
```

#### Field-Level Encryption in Prisma

```typescript
// lib/db/encrypted-fields.ts
import { encrypt, decrypt } from '@/lib/encryption/crypto';
import { Prisma } from '@prisma/client';

// Middleware to encrypt/decrypt fields
export const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  // Fields to encrypt
  const encryptedFields = ['phone', 'ssn', 'bankAccount'];

  // Encrypt on create/update
  if (params.action === 'create' || params.action === 'update') {
    if (params.args.data) {
      for (const field of encryptedFields) {
        if (params.args.data[field]) {
          params.args.data[`${field}Encrypted`] = encrypt(
            params.args.data[field]
          );
          delete params.args.data[field];
        }
      }
    }
  }

  const result = await next(params);

  // Decrypt on read
  if (
    params.action === 'findUnique' ||
    params.action === 'findFirst' ||
    params.action === 'findMany'
  ) {
    if (result) {
      const items = Array.isArray(result) ? result : [result];

      for (const item of items) {
        for (const field of encryptedFields) {
          if (item[`${field}Encrypted`]) {
            item[field] = decrypt(item[`${field}Encrypted`]);
            delete item[`${field}Encrypted`];
          }
        }
      }
    }
  }

  return result;
};

// Apply middleware
prisma.$use(encryptionMiddleware);
```

---

### 2. Encryption in Transit (TLS/SSL)

#### Next.js HTTPS Configuration

```javascript
// next.config.js
module.exports = {
  // Production: Always use HTTPS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Redirect HTTP to HTTPS
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://tradingalerts.com/:path*',
        permanent: true,
      },
    ];
  },
};
```

#### TLS Configuration (Nginx)

```nginx
# /etc/nginx/sites-available/tradingalerts.com
server {
    listen 443 ssl http2;
    server_name tradingalerts.com www.tradingalerts.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tradingalerts.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tradingalerts.com/privkey.pem;

    # Strong TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/tradingalerts.com/chain.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Forward real IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tradingalerts.com www.tradingalerts.com;
    return 301 https://$server_name$request_uri;
}
```

---

### 3. Secure Secret Management

#### AWS Secrets Manager Integration

```typescript
// lib/secrets/aws-secrets.ts
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export async function getSecret(secretName: string): Promise<string> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

    if (response.SecretString) {
      return response.SecretString;
    }

    throw new Error('Secret not found');
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error);
    throw error;
  }
}

export async function getSecretJson<T = Record<string, any>>(
  secretName: string
): Promise<T> {
  const secret = await getSecret(secretName);
  return JSON.parse(secret);
}

// Cache secrets for performance
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedSecret(secretName: string): Promise<string> {
  const cached = secretCache.get(secretName);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await getSecret(secretName);
  secretCache.set(secretName, {
    value,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return value;
}
```

#### Environment Variable Security

```bash
# .env.example (NEVER commit actual values)
# ============================================

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://tradingalerts.com

# Database (use Secrets Manager in production)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
NEXTAUTH_URL=https://tradingalerts.com
NEXTAUTH_SECRET=<use `openssl rand -base64 32` to generate>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Encryption
ENCRYPTION_KEY=<use `openssl rand -base64 32` to generate>
ENCRYPTION_SALT=<use `openssl rand -base64 16` to generate>

# API Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DLOCAL_API_KEY=<from dLocal>
DLOCAL_API_SECRET=<from dLocal>

# Third-party services
UPSTASH_REDIS_REST_URL=<from Upstash>
UPSTASH_REDIS_REST_TOKEN=<from Upstash>
AWS_ACCESS_KEY_ID=<from AWS IAM>
AWS_SECRET_ACCESS_KEY=<from AWS IAM>
AWS_REGION=us-east-1

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<SendGrid API key>

# Monitoring
SENTRY_DSN=<from Sentry>
DATADOG_API_KEY=<from Datadog>
```

---

## 🏗️ INFRASTRUCTURE SECURITY

### 1. Container Security (Docker)

#### Secure Dockerfile

```dockerfile
# Use specific version (not 'latest')
FROM node:20-alpine3.18

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml ./

# Install dependencies (production only)
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Copy application files
COPY --chown=nextjs:nodejs . .

# Build application
RUN pnpm run build

# Remove development dependencies
RUN pnpm prune --prod

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "server.js"]

# Security labels
LABEL security.scan="enabled" \
      security.policy="strict"
```

#### Docker Compose Security

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    container_name: trading-alerts-app

    # Security options
    security_opt:
      - no-new-privileges:true

    # Read-only root filesystem
    read_only: true

    # Tmpfs for writable directories
    tmpfs:
      - /tmp
      - /app/.next/cache

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

    # Network
    networks:
      - app-network

    # Environment from secrets
    env_file:
      - .env

    # No privileged mode
    privileged: false

    # Drop all capabilities
    cap_drop:
      - ALL

    # Add only required capabilities
    cap_add:
      - NET_BIND_SERVICE

    # Restart policy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: trading-alerts-db

    security_opt:
      - no-new-privileges:true

    environment:
      POSTGRES_DB: trading_alerts
      POSTGRES_USER_FILE: /run/secrets/db_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

    secrets:
      - db_user
      - db_password

    volumes:
      - db-data:/var/lib/postgresql/data

    networks:
      - app-network

    restart: unless-stopped

networks:
  app-network:
    driver: bridge
    internal: false

volumes:
  db-data:
    driver: local

secrets:
  db_user:
    file: ./secrets/db_user.txt
  db_password:
    file: ./secrets/db_password.txt
```

---

### 2. Cloud Infrastructure Security (AWS)

#### VPC Configuration

```yaml
# infrastructure/vpc.yaml (CloudFormation/Terraform)
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: TradingAlerts-VPC

  # Public Subnets (for ALB)
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: false

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: false

  # Private Subnets (for Application)
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [1, !GetAZs '']

  # Database Subnets (isolated)
  DatabaseSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.20.0/24
      AvailabilityZone: !Select [0, !GetAZs '']

  DatabaseSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.21.0/24
      AvailabilityZone: !Select [1, !GetAZs '']

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # NAT Gateway (for private subnets to access internet)
  NATGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt EIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  EIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ALB Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Application Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Database Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref AppSecurityGroup
```

#### IAM Policies (Least Privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSecretsAccess",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:123456789:secret:trading-alerts/*"
      ]
    },
    {
      "Sid": "AllowS3Upload",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::trading-alerts-assets/*"]
    },
    {
      "Sid": "AllowCloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:123456789:log-group:/aws/ecs/trading-alerts:*"
      ]
    }
  ]
}
```

---

### 3. Database Security

#### PostgreSQL Security Hardening

```sql
-- Create database with specific encoding
CREATE DATABASE trading_alerts
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8';

-- Create application user with limited privileges
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password_here';

-- Grant only necessary privileges
GRANT CONNECT ON DATABASE trading_alerts TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Prevent DROP/CREATE TABLE
REVOKE CREATE ON SCHEMA public FROM app_user;

-- Create read-only user for analytics
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'readonly_password_here';
GRANT CONNECT ON DATABASE trading_alerts TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Enable row-level security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own data
CREATE POLICY user_isolation_policy ON users
  FOR ALL
  TO app_user
  USING (id = current_setting('app.current_user_id')::uuid);

CREATE POLICY alert_isolation_policy ON alerts
  FOR ALL
  TO app_user
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Configure audit settings
ALTER SYSTEM SET pgaudit.log = 'write, ddl';
ALTER SYSTEM SET pgaudit.log_catalog = off;
ALTER SYSTEM SET pgaudit.log_parameter = on;

-- Reload configuration
SELECT pg_reload_conf();
```

#### Connection Pooling Security

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],

    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },

    // Connection pooling
    // Max connections = (CPU cores * 2) + 1
    // For 4 cores: (4 * 2) + 1 = 9
    __internal: {
      engine: {
        connection_limit: 9,
      },
    },
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

---

## 💳 PAYMENT SECURITY

### 1. Stripe Integration Security

```typescript
// lib/payment/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
  // Security: Set application info
  appInfo: {
    name: 'Trading Alerts SaaS',
    version: '1.0.0',
    url: 'https://tradingalerts.com',
  },
});

// Create checkout session with security measures
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  email: string
) {
  try {
    const session = await stripe.checkout.sessions.create({
      // Security: Associate with customer
      customer_email: email,
      client_reference_id: userId,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      mode: 'subscription',

      // URLs
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,

      // Security: Prevent customer from updating email
      allow_promotion_codes: true,
      billing_address_collection: 'required',

      // Tax calculation
      automatic_tax: {
        enabled: true,
      },

      // Metadata for tracking
      metadata: {
        userId,
        source: 'web_app',
      },

      // Subscription options
      subscription_data: {
        metadata: {
          userId,
        },
        trial_period_days: 7,
      },
    });

    return session;
  } catch (error) {
    console.error('Stripe session creation failed:', error);
    throw error;
  }
}

// Verify webhook signature
export async function verifyStripeWebhook(
  payload: string,
  signature: string
): Promise<Stripe.Event | null> {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}
```

#### Stripe Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@/lib/payment/stripe';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  try {
    // Get raw body (required for signature verification)
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const event = await verifyStripeWebhook(payload, signature);

    if (!event) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;

  if (!userId) {
    throw new Error('Missing user ID');
  }

  // Update user to PRO tier
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: 'PRO',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    },
  });

  // Log event
  await logAuditEvent({
    event: 'subscription_created',
    userId,
    provider: 'stripe',
    data: {
      sessionId: session.id,
      amount: session.amount_total,
    },
  });
}
```

---

### 2. PCI DSS Compliance

**Key Requirements:**

1. **Never store full credit card numbers**
   - Use Stripe.js (card data never touches your server)
   - Tokenization for all card transactions

2. **Use Stripe Elements (PCI-compliant UI)**

   ```typescript
   // components/payment/CheckoutForm.tsx
   import { Elements } from '@stripe/react-stripe-js'
   import { loadStripe } from '@stripe/stripe-js'

   const stripePromise = loadStripe(
     process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
   )

   export function CheckoutForm() {
     return (
       <Elements stripe={stripePromise}>
         {/* Stripe handles all card data */}
         <CardElement />
       </Elements>
     )
   }
   ```

3. **Secure transmission (TLS 1.2+)**
   - All payment data encrypted in transit
   - Certificate pinning for mobile apps

4. **Access control**
   - Limit payment data access to authorized personnel only
   - Audit all access to payment systems

5. **Regular security testing**
   - Quarterly vulnerability scans
   - Annual penetration testing

---

## 🔍 MONITORING & LOGGING

### 1. Security Monitoring Stack

#### Sentry for Error Tracking

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }

    // Remove sensitive context
    if (event.contexts) {
      delete event.contexts.password;
      delete event.contexts.token;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection',
  ],
});
```

#### Datadog APM Integration

```typescript
// lib/monitoring/datadog.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'trading-alerts-api',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,

  // Distributed tracing
  analytics: true,
  runtimeMetrics: true,

  // Security: Redact sensitive data
  tags: {
    team: 'platform',
    tier: 'production',
  },
});

export default tracer;
```

---

### 2. Audit Logging

```typescript
// lib/logging/audit.ts
import { prisma } from '@/lib/db/prisma';

export interface AuditLogEntry {
  event: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  status: 'success' | 'failure';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>) {
  try {
    await prisma.auditLog.create({
      data: {
        ...entry,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Critical: Audit logging failure
    console.error('AUDIT LOG FAILURE:', error);

    // Fallback: Write to file
    await writeToFile('/var/log/audit/fallback.log', JSON.stringify(entry));
  }
}

// Log security events
export async function logSecurityEvent(
  type: 'auth_failure' | 'permission_denied' | 'suspicious_activity',
  details: Record<string, any>
) {
  await logAuditEvent({
    event: `security.${type}`,
    status: 'failure',
    metadata: details,
  });

  // Alert security team for critical events
  if (type === 'suspicious_activity') {
    await alertSecurityTeam(details);
  }
}
```

#### Audit Log Schema

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  event      String   // e.g., "user.login", "subscription.created"
  userId     String?
  ipAddress  String?
  userAgent  String?
  resource   String?  // e.g., "user", "alert", "subscription"
  resourceId String?
  action     String?  // e.g., "create", "update", "delete"
  status     String   // "success" or "failure"
  metadata   Json?
  timestamp  DateTime @default(now())

  user       User?    @relation(fields: [userId], references: [id])

  @@index([event, timestamp])
  @@index([userId, timestamp])
  @@index([status, timestamp])
}
```

---

### 3. Intrusion Detection

```typescript
// lib/security/intrusion-detection.ts
import { redis } from '@/lib/db/redis';

export interface SecurityThreshold {
  failedLogins: number;
  failedApiCalls: number;
  timeWindowSeconds: number;
}

const THRESHOLDS: SecurityThreshold = {
  failedLogins: 5,
  failedApiCalls: 100,
  timeWindowSeconds: 300, // 5 minutes
};

export async function trackFailedLogin(
  identifier: string, // email or IP
  type: 'email' | 'ip'
) {
  const key = `failed_login:${type}:${identifier}`;

  // Increment counter
  await redis.incr(key);
  await redis.expire(key, THRESHOLDS.timeWindowSeconds);

  // Check threshold
  const count = await redis.get(key);

  if (Number(count) >= THRESHOLDS.failedLogins) {
    await handleSuspiciousActivity({
      type: 'brute_force_login',
      identifier,
      count: Number(count),
    });
  }
}

export async function trackFailedApiCall(userId: string, endpoint: string) {
  const key = `failed_api:${userId}:${endpoint}`;

  await redis.incr(key);
  await redis.expire(key, THRESHOLDS.timeWindowSeconds);

  const count = await redis.get(key);

  if (Number(count) >= THRESHOLDS.failedApiCalls) {
    await handleSuspiciousActivity({
      type: 'api_abuse',
      userId,
      endpoint,
      count: Number(count),
    });
  }
}

async function handleSuspiciousActivity(details: Record<string, any>) {
  // Log to audit
  await logSecurityEvent('suspicious_activity', details);

  // Temporarily block
  await blockIdentifier(details.identifier || details.userId, 3600); // 1 hour

  // Alert security team
  await alertSecurityTeam({
    subject: 'Suspicious Activity Detected',
    details,
  });
}

async function blockIdentifier(identifier: string, durationSeconds: number) {
  const key = `blocked:${identifier}`;
  await redis.set(key, '1', 'EX', durationSeconds);
}

export async function isBlocked(identifier: string): Promise<boolean> {
  const key = `blocked:${identifier}`;
  const blocked = await redis.get(key);
  return blocked === '1';
}
```

---

## 📜 COMPLIANCE & GOVERNANCE

### 1. GDPR Compliance

#### Data Subject Rights Implementation

```typescript
// lib/compliance/gdpr.ts
import { prisma } from '@/lib/db/prisma';
import { generatePDF } from '@/lib/utils/pdf';

// Right to Access (Article 15)
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      alerts: true,
      watchlists: true,
      subscriptions: true,
      auditLogs: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Remove sensitive data
  const { password, mfaSecret, ...userData } = user;

  // Generate PDF
  const pdf = await generatePDF({
    title: 'Your Personal Data',
    data: userData,
  });

  // Log data export
  await logAuditEvent({
    event: 'gdpr.data_export',
    userId,
    status: 'success',
  });

  return pdf;
}

// Right to Erasure (Article 17)
export async function deleteUserData(userId: string, reason: string) {
  // Soft delete (keep for legal compliance)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted_${userId}@deleted.com`,
      name: 'Deleted User',
      password: null,
      phone: null,
      isActive: false,
      deletedAt: new Date(),
      deletionReason: reason,
    },
  });

  // Delete associated data
  await prisma.alert.deleteMany({ where: { userId } });
  await prisma.watchlist.deleteMany({ where: { userId } });

  // Log deletion
  await logAuditEvent({
    event: 'gdpr.data_deletion',
    userId,
    status: 'success',
    metadata: { reason },
  });
}

// Right to Portability (Article 20)
export async function exportUserDataJSON(userId: string) {
  const data = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      alerts: true,
      watchlists: true,
    },
  });

  return JSON.stringify(data, null, 2);
}

// Right to Rectification (Article 16)
// Implemented via user profile update endpoints

// Right to Restriction (Article 18)
export async function restrictUserProcessing(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      processingRestricted: true,
      restrictedAt: new Date(),
    },
  });
}
```

#### Cookie Consent

```typescript
// components/CookieConsent.tsx
'use client'

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = Cookies.get('cookie_consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptAll = () => {
    Cookies.set('cookie_consent', 'all', { expires: 365 })
    setShowBanner(false)
    enableAnalytics()
  }

  const acceptNecessary = () => {
    Cookies.set('cookie_consent', 'necessary', { expires: 365 })
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="cookie-banner">
      <p>
        We use cookies to improve your experience.
        <a href="/privacy">Learn more</a>
      </p>
      <button onClick={acceptAll}>Accept All</button>
      <button onClick={acceptNecessary}>Necessary Only</button>
    </div>
  )
}
```

---

### 2. SOC 2 Compliance

#### Key Controls to Implement

1. **Access Control**
   - MFA for all users
   - RBAC implementation
   - Regular access reviews

2. **Change Management**
   - All changes tracked in git
   - Code review required
   - Automated deployment with rollback

3. **System Operations**
   - Monitoring and alerting
   - Incident response plan
   - Regular backups

4. **Risk Management**
   - Regular security assessments
   - Vulnerability scanning
   - Penetration testing

---

## 🚨 INCIDENT RESPONSE

### 1. Incident Response Plan

```typescript
// lib/security/incident-response.ts

export enum IncidentSeverity {
  CRITICAL = 'critical', // Data breach, system compromise
  HIGH = 'high', // Unauthorized access, DDoS
  MEDIUM = 'medium', // Suspicious activity, failed attacks
  LOW = 'low', // Minor policy violations
}

export interface SecurityIncident {
  id: string;
  severity: IncidentSeverity;
  type: string;
  description: string;
  detectedAt: Date;
  detectedBy: 'automated' | 'manual';
  affectedSystems: string[];
  affectedUsers: string[];
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  assignedTo?: string;
  resolvedAt?: Date;
}

export async function reportIncident(
  incident: Omit<SecurityIncident, 'id' | 'detectedAt' | 'status'>
) {
  const incidentId = generateIncidentId();

  const fullIncident: SecurityIncident = {
    ...incident,
    id: incidentId,
    detectedAt: new Date(),
    status: 'detected',
  };

  // Store incident
  await prisma.securityIncident.create({
    data: fullIncident,
  });

  // Alert based on severity
  if (incident.severity === IncidentSeverity.CRITICAL) {
    await alertSecurityTeam(fullIncident);
    await alertExecutiveTeam(fullIncident);
  } else if (incident.severity === IncidentSeverity.HIGH) {
    await alertSecurityTeam(fullIncident);
  }

  // Execute automated response
  await executeIncidentPlaybook(fullIncident);

  return incidentId;
}

async function executeIncidentPlaybook(incident: SecurityIncident) {
  switch (incident.type) {
    case 'brute_force_attack':
      await blockAttackerIPs(incident.affectedSystems);
      await enforceRateLimit(incident.affectedSystems);
      break;

    case 'data_breach':
      await isolateAffectedSystems(incident.affectedSystems);
      await notifyAffectedUsers(incident.affectedUsers);
      await escalateToLegal();
      break;

    case 'unauthorized_access':
      await revokeUserSessions(incident.affectedUsers);
      await forcePasswordReset(incident.affectedUsers);
      break;

    default:
      console.log(`No automated playbook for ${incident.type}`);
  }
}
```

---

## 🛠️ SECURITY TOOLS & SERVICES

### Recommended Security Stack

#### 1. Application Security

| Tool            | Purpose                              | Cost                |
| --------------- | ------------------------------------ | ------------------- |
| **Snyk**        | Dependency vulnerability scanning    | Free tier available |
| **SonarQube**   | Code quality & security analysis     | Free (self-hosted)  |
| **OWASP ZAP**   | Dynamic application security testing | Free                |
| **GitGuardian** | Secret detection in code             | Free tier available |

#### 2. Infrastructure Security

| Tool                   | Purpose                       | Cost                |
| ---------------------- | ----------------------------- | ------------------- |
| **AWS GuardDuty**      | Threat detection for AWS      | Pay per GB          |
| **Cloudflare**         | WAF, DDoS protection, CDN     | Free tier available |
| **Terraform Sentinel** | Infrastructure policy as code | Enterprise feature  |
| **Trivy**              | Container security scanning   | Free                |

#### 3. Monitoring & Logging

| Tool          | Purpose                     | Cost                |
| ------------- | --------------------------- | ------------------- |
| **Datadog**   | APM, logging, monitoring    | $15/host/month      |
| **Sentry**    | Error tracking              | Free tier available |
| **LogRocket** | Session replay & monitoring | $99/month           |
| **PagerDuty** | Incident management         | $21/user/month      |

#### 4. Access Management

| Tool                | Purpose                        | Cost                |
| ------------------- | ------------------------------ | ------------------- |
| **Auth0**           | Authentication service         | Free tier available |
| **Okta**            | Enterprise identity management | $2/user/month       |
| **AWS IAM**         | Cloud access management        | Free                |
| **HashiCorp Vault** | Secrets management             | Free (self-hosted)  |

---

## 📋 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)

- [ ] Set up HTTPS/TLS
- [ ] Configure security headers
- [ ] Implement authentication (NextAuth.js)
- [ ] Set up basic RBAC
- [ ] Configure environment variables
- [ ] Enable audit logging

### Phase 2: Core Security (Week 3-4)

- [ ] Implement rate limiting
- [ ] Add input validation (Zod)
- [ ] Set up CORS
- [ ] Enable encryption at rest
- [ ] Configure secure sessions
- [ ] Add CSRF protection

### Phase 3: Advanced Security (Week 5-6)

- [ ] Implement MFA
- [ ] Set up API key management
- [ ] Configure WAF (Cloudflare)
- [ ] Enable database encryption
- [ ] Add security monitoring (Sentry)
- [ ] Set up intrusion detection

### Phase 4: Compliance (Week 7-8)

- [ ] GDPR compliance features
- [ ] PCI DSS compliance (Stripe)
- [ ] SOC 2 controls
- [ ] Privacy policy & terms
- [ ] Cookie consent
- [ ] Data retention policies

### Phase 5: Monitoring & Response (Week 9-10)

- [ ] Set up centralized logging
- [ ] Configure alerting
- [ ] Create incident response plan
- [ ] Implement automated responses
- [ ] Security dashboard
- [ ] Regular security audits

---

## ✅ SECURITY CHECKLIST

### Pre-Launch Security Audit

#### Authentication & Authorization

- [ ] All passwords hashed with bcrypt (10+ rounds)
- [ ] JWT tokens signed and encrypted
- [ ] Session expiration configured
- [ ] MFA available for all users
- [ ] RBAC properly implemented
- [ ] OAuth properly configured

#### API Security

- [ ] Rate limiting on all endpoints
- [ ] Input validation with Zod
- [ ] CORS properly configured
- [ ] API keys encrypted at rest
- [ ] Request signing implemented
- [ ] Error messages don't leak info

#### Data Protection

- [ ] Database encrypted at rest
- [ ] TLS 1.3 for all connections
- [ ] Sensitive fields encrypted
- [ ] PII properly protected
- [ ] Backups encrypted
- [ ] Secrets in vault (not code)

#### Infrastructure

- [ ] VPC/network isolation
- [ ] Security groups configured
- [ ] Minimal IAM permissions
- [ ] Container security enabled
- [ ] No exposed ports
- [ ] Firewalls configured

#### Monitoring

- [ ] Audit logging enabled
- [ ] Error tracking (Sentry)
- [ ] APM configured
- [ ] Alerts set up
- [ ] Incident response plan
- [ ] Regular security scans

#### Compliance

- [ ] GDPR features implemented
- [ ] Privacy policy published
- [ ] Cookie consent added
- [ ] Terms of service agreed
- [ ] Data retention policies
- [ ] User data export available

---

## 📚 ADDITIONAL RESOURCES

### Security Standards & Frameworks

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CWE Top 25**: https://cwe.mitre.org/top25/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **SOC 2**: https://www.aicpa.org/soc
- **GDPR**: https://gdpr.eu/

### Tools Documentation

- **NextAuth.js**: https://next-auth.js.org/
- **Prisma**: https://www.prisma.io/docs/
- **Stripe**: https://stripe.com/docs/security
- **AWS Security**: https://aws.amazon.com/security/
- **Cloudflare**: https://developers.cloudflare.com/

### Security Learning

- **OWASP Cheat Sheets**: https://cheatsheetseries.owasp.org/
- **PortSwigger Web Security Academy**: https://portswigger.net/web-security
- **HackerOne Reports**: https://hackerone.com/hacktivity
- **Security Headers**: https://securityheaders.com/

---

## 🎯 CONCLUSION

Security is not a one-time implementation but a **continuous process**. This guide provides a comprehensive framework for building a secure SaaS application, but you must:

1. **Stay Updated**: Security threats evolve constantly
2. **Regular Audits**: Conduct quarterly security reviews
3. **Penetration Testing**: Annual third-party testing
4. **Dependency Updates**: Keep all packages up to date
5. **Team Training**: Security awareness for all developers
6. **Incident Preparedness**: Test your response plan

**Remember**: Security is everyone's responsibility!

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-18
**Next Review:** 2025-12-18
**Maintained By:** Security Team

For questions or security concerns, contact: security@tradingalerts.com
