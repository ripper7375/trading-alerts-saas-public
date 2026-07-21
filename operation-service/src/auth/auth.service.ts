import { randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';

import {
  AccountExistsError,
  AuthError,
  EmailNotVerifiedError,
  ExpiredTokenError,
  InvalidCredentialsError,
  InvalidTokenError,
  RateLimitError,
  TwoFactorRequiredError,
} from './errors';
import { encodeNextAuthToken } from './next-auth-jwt-encode.util';
import {
  RefreshTokenContext,
  RefreshTokenService,
} from './refresh-token.service';

// 2FA-completion sentinel — ported from lib/auth/auth-options.ts's
// authorize(): the special email value the frontend re-submits, with the
// temp token (minted by generate2FAToken there) in the password field, to
// complete a login that already passed the password check once.
const TWO_FACTOR_VERIFIED_SENTINEL = '__2fa_verified__';
const TWO_FACTOR_TOKEN_TTL = '5m';
const TWO_FACTOR_TOKEN_PURPOSE = '2fa_verification';

export interface AuthUserClaims {
  id: string;
  email: string;
  tier: string;
  role: string;
  isAffiliate: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserClaims;
}

export interface RegisterResult {
  userId: string;
  message: string;
  autoVerified: boolean;
}

function getNextAuthSecret(): string {
  const secret = process.env['NEXTAUTH_SECRET'];
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET not configured');
  }
  return secret;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokens: RefreshTokenService
  ) {}

  /**
   * Ported from app/api/auth/register/route.ts (Session 3-2 finding — the
   * real SOURCE for this behavior, not lib/auth/*; see Deviations). Not
   * ported: actual email sending (lib/email/email.ts, a Resend/Next.js-only
   * integration, never in this order's file inventory) — the verification
   * token is generated and stored identically, but no email goes out yet.
   * Documented gap, not a silent skip (see Deviations) — this endpoint is
   * additive/not-yet-live this session anyway (Session 3-3 wires it up).
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<RegisterResult> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new AccountExistsError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const autoVerify = process.env['NODE_ENV'] === 'development';

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        emailVerified: autoVerify ? new Date() : null,
        verificationToken: autoVerify ? null : verificationToken,
      },
    });

    const message = autoVerify
      ? 'Registration successful. You can now log in. (Email verification skipped in development)'
      : 'Registration successful. Please check your email to verify your account.';

    return { userId: user.id, message, autoVerified: autoVerify };
  }

  /**
   * Ported from lib/auth/auth-options.ts's CredentialsProvider.authorize()
   * (Session 3-2, File 6/6) — same bcrypt check, same EMAIL_NOT_VERIFIED /
   * TWO_FACTOR_REQUIRED cases, same two-step 2FA sentinel mechanism. On
   * success, issues a NextAuth-compatible JWE (F24) instead of returning a
   * plain user object (auth-options.ts's return value becomes NextAuth's own
   * JWE via its jwt callback + encode() — this collapses both steps into
   * one, since operation-service has no separate NextAuth session layer).
   */
  async login(
    email: string,
    password: string,
    context: RefreshTokenContext = {}
  ): Promise<LoginResult> {
    const user =
      email === TWO_FACTOR_VERIFIED_SENTINEL
        ? await this.completeTwoFactorLogin(password)
        : await this.verifyPassword(email, password);

    return this.issueSession(user, context);
  }

  private async verifyPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (!user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          purpose: TWO_FACTOR_TOKEN_PURPOSE,
        },
        getNextAuthSecret(),
        { expiresIn: TWO_FACTOR_TOKEN_TTL }
      );
      throw new TwoFactorRequiredError(twoFactorToken);
    }

    return user;
  }

  private async completeTwoFactorLogin(twoFactorToken: string) {
    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(
        twoFactorToken,
        getNextAuthSecret()
      ) as typeof decoded;
    } catch {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    if (decoded.purpose !== TWO_FACTOR_TOKEN_PURPOSE) {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    return user;
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      tier: string;
      role: string;
      isAffiliate: boolean;
    },
    context: RefreshTokenContext
  ): Promise<LoginResult> {
    const accessToken = await encodeNextAuthToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
      },
      getNextAuthSecret()
    );

    const { rawToken } = await this.refreshTokens.issue(user.id, context);

    return {
      accessToken,
      refreshToken: rawToken,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
      },
    };
  }

  /**
   * New behavior (F23) — no prior live "refresh" flow existed to preserve
   * (the old RefreshToken stub was never wired in, F4 census). Rotates the
   * refresh token (see RefreshTokenService.rotate) and issues a fresh
   * access token.
   */
  async refresh(
    rawRefreshToken: string,
    context: RefreshTokenContext = {}
  ): Promise<LoginResult> {
    const { userId, issued } = await this.refreshTokens.rotate(
      rawRefreshToken,
      context
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new InvalidTokenError(
        'User for this refresh token no longer exists'
      );
    }

    const accessToken = await encodeNextAuthToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
      },
      getNextAuthSecret()
    );

    return {
      accessToken,
      refreshToken: issued.rawToken,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
      },
    };
  }

  /**
   * Idempotent by design — always succeeds whether or not the token existed
   * or was already revoked, so a logout call never leaks whether a given
   * refresh token was valid.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokens.revokeByRawToken(rawRefreshToken);
  }

  /**
   * Ported from app/api/auth/forgot-password/route.ts (Session 3-4, F29).
   * Always returns the same generic success message regardless of whether
   * the email exists — the source route's own anti-enumeration behavior,
   * preserved exactly. CSRF (validateOrigin()) stays Next.js-side, same as
   * register/login never having it here either.
   */
  async forgotPassword(
    email: string
  ): Promise<{ success: true; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      const emailResult = await sendPasswordResetEmail(
        email,
        user.name || 'User',
        resetToken
      );

      if (!emailResult.success) {
        console.error(
          'Failed to send password reset email:',
          emailResult.error
        );
      }
    }

    return {
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link.',
    };
  }

  /**
   * Ported from app/api/auth/reset-password/route.ts (Session 3-4, F29).
   */
  async resetPassword(
    token: string,
    password: string
  ): Promise<{ success: true; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token },
    });

    if (!user) {
      throw new InvalidTokenError('Invalid or expired reset token');
    }

    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new ExpiredTokenError('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      success: true,
      message:
        'Password reset successfully. You can now sign in with your new password.',
    };
  }

  /**
   * Ported from app/api/auth/verify-email/route.ts (Session 3-4, F29),
   * including the "wait 5 seconds" guard against Gmail's link-preview
   * bot pre-fetching the verification URL and burning the token before the
   * real user clicks it.
   */
  async verifyEmail(
    token: string
  ): Promise<{ success: true; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new InvalidTokenError('Invalid or expired verification token');
    }

    const tokenAge = Date.now() - user.updatedAt.getTime();
    const MIN_DELAY_MS = 5000; // 5 seconds

    if (tokenAge < MIN_DELAY_MS) {
      const waitSeconds = Math.ceil((MIN_DELAY_MS - tokenAge) / 1000);
      throw new RateLimitError(
        `Please wait ${waitSeconds} more seconds, then refresh this page.`,
        waitSeconds
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    try {
      const welcomeResult = await sendWelcomeEmail(
        user.email,
        user.name || 'User'
      );
      if (!welcomeResult.success) {
        console.error(
          '[verifyEmail] Failed to send welcome email:',
          welcomeResult.error
        );
      }
    } catch (emailError) {
      console.error(
        '[verifyEmail] Exception while sending welcome email:',
        emailError
      );
    }

    return {
      success: true,
      message: 'Email verified successfully. You can now sign in.',
    };
  }

  /**
   * Ported from app/api/auth/resend-verification/route.ts (Session 3-4,
   * F29). Anti-enumeration (unknown email / already-verified both return
   * the same generic success message) and the 60s per-user rate limit are
   * both preserved exactly.
   */
  async resendVerification(
    email: string
  ): Promise<{ success: true; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        verificationToken: true,
        updatedAt: true,
      },
    });

    const genericSuccess = {
      success: true as const,
      message:
        'If your email is registered, you will receive a verification email.',
    };

    if (!user || user.emailVerified) {
      return genericSuccess;
    }

    const timeSinceLastUpdate = Date.now() - user.updatedAt.getTime();
    const RATE_LIMIT_MS = 60 * 1000; // 60 seconds

    if (user.verificationToken && timeSinceLastUpdate < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil(
        (RATE_LIMIT_MS - timeSinceLastUpdate) / 1000
      );
      throw new RateLimitError(
        `Please wait ${waitSeconds} seconds before requesting another verification email.`,
        waitSeconds
      );
    }

    const verificationToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        updatedAt: new Date(),
      },
    });

    const emailResult = await sendVerificationEmail(
      user.email,
      user.name || 'User',
      verificationToken
    );

    if (!emailResult.success) {
      throw new AuthError(
        'Failed to send verification email. Please try again.',
        'EMAIL_SEND_FAILED',
        500
      );
    }

    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    };
  }
}
