import { randomBytes } from 'crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

import {
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_WINDOW_SECONDS,
  MAIL_LIMIT,
  MAIL_WINDOW_SECONDS,
  clear,
  release,
  reserve,
  throttleKeys,
} from './auth-throttle.util';
import {
  AccountDeactivatedError,
  AccountExistsError,
  AuthError,
  EmailNotVerifiedError,
  ExpiredTokenError,
  InvalidCredentialsError,
  InvalidTokenError,
  RateLimitError,
  TooManyAttemptsError,
  TwoFactorRequiredError,
} from './errors';
import { encodeNextAuthToken } from './next-auth-jwt-encode.util';
import {
  RefreshTokenContext,
  RefreshTokenService,
} from './refresh-token.service';
import {
  COMPLETION_USED_TTL_SECONDS,
  TWO_FACTOR_VERIFIED,
  TwoFactorUnavailableError,
  consumeOnce,
  signChallenge,
  twoFactorKeys,
  verifyTwoFactorToken,
} from './two-factor-token.util';
import { ADMIN_SESSION_MAX_AGE_SECONDS } from './user-active.util';
import {
  ID_ONLY_SELECT,
  LOGIN_USER_SELECT,
  REGISTERED_USER_SELECT,
  SESSION_USER_SELECT,
  TWO_FACTOR_COMPLETION_USER_SELECT,
} from './user-select';

// 2FA-completion sentinel — ported from lib/auth/auth-options.ts's
// authorize(): the special email value the frontend re-submits, with the
// one-use COMPLETION token the 2FA verify step minted (CODE-01A) in the
// password field, to complete a login that already passed the password check
// and the code check. The password step's challenge is not accepted here.
const TWO_FACTOR_VERIFIED_SENTINEL = '__2fa_verified__';

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
    private readonly refreshTokens: RefreshTokenService,
    private readonly redis: RedisService
  ) {}

  /**
   * Ported from app/api/auth/register/route.ts (Session 3-2 finding — the
   * real SOURCE for this behavior, not lib/auth/*; see Deviations).
   * Session 4B-20 closed a gap left open since Session 3-2 (this method's
   * own prior comment: "no email goes out yet... Session 3-3 wires it up" —
   * 3-3 built login/refresh/logout instead, F27 correctly deferred
   * /auth/register routing until email-sending was ported, and nothing
   * revisited this specific method since): sendVerificationEmail() is now
   * called on the non-auto-verify path, matching SOURCE's own non-fatal
   * handling (log and continue, never fail the registration itself if the
   * email fails to send) — same call shape resendVerification() below
   * already uses for the identical email.
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<RegisterResult> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: ID_ONLY_SELECT,
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
      select: REGISTERED_USER_SELECT,
    });

    if (!autoVerify) {
      const emailResult = await sendVerificationEmail(
        user.email,
        user.name || 'User',
        verificationToken
      );
      if (!emailResult.success) {
        console.error(
          '[AuthService.register] Failed to send verification email:',
          emailResult.error
        );
      }
    }

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
    const normalizedEmail = email.toLowerCase().trim();

    const FIXED_TEST_ACCOUNTS: Record<
      string,
      {
        passwords: string[];
        tier: 'FREE' | 'PRO';
        role: string;
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

    const isTestAccountsAllowed =
      process.env['NODE_ENV'] === 'development' ||
      process.env['NODE_ENV'] === 'test';
    const fixed = isTestAccountsAllowed
      ? FIXED_TEST_ACCOUNTS[normalizedEmail]
      : undefined;
    if (fixed) {
      const isPasswordValid = fixed.passwords.includes(password);
      if (!isPasswordValid) {
        throw new InvalidCredentialsError();
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const dbUser = await this.prisma.user.upsert({
          where: { email: normalizedEmail },
          update: {
            name: fixed.name,
            password: hashedPassword,
            tier: fixed.tier,
            role: fixed.role,
            isAffiliate: fixed.isAffiliate,
            emailVerified: new Date(),
            isActive: true,
          },
          create: {
            email: normalizedEmail,
            name: fixed.name,
            password: hashedPassword,
            tier: fixed.tier,
            role: fixed.role,
            isAffiliate: fixed.isAffiliate,
            emailVerified: new Date(),
            isActive: true,
          },
          select: LOGIN_USER_SELECT,
        });

        return dbUser;
      } catch (dbErr) {
        console.warn(
          '[operation-service] DB upsert failed for test account, returning memory user:',
          dbErr
        );
        return {
          id: `test-user-${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
          email: normalizedEmail,
          password: await bcrypt.hash(password, 10),
          name: fixed.name,
          image: null,
          tier: fixed.tier,
          role: fixed.role,
          isAffiliate: fixed.isAffiliate,
          emailVerified: new Date(),
          isActive: true,
          sessionVersion: 0,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
          twoFactorVerifiedAt: null,
          trialStatus: 'NOT_STARTED' as const,
          trialStartDate: null,
          trialEndDate: null,
          trialConvertedAt: null,
          trialCancelledAt: null,
          hasUsedFreeTrial: false,
          hasUsedStripeTrial: false,
          stripeTrialStartedAt: null,
          hasUsedThreeDayPlan: false,
          threeDayPlanUsedAt: null,
          signupIP: null,
          lastLoginIP: null,
          deviceFingerprint: null,
          verificationToken: null,
          resetToken: null,
          resetTokenExpiry: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    // CODE-01B: the attempt is counted BEFORE the password is looked at, so a parallel burst
    // cannot get past the limit, and a right password gives the budget back. An unknown e-mail
    // is counted like a wrong password, so nothing tells the two apart. Refused here, even for
    // the right password, before any database or bcrypt work. The client address is limited in
    // the monolith (this service sees Vercel's address, D-4); the key is the one the monolith's
    // credentials provider writes, so one budget covers both ways in. Redis down: open (D-1).
    const redis = this.redis.getClient();
    const accountKey = throttleKeys.loginAccount(normalizedEmail);
    const attempt = await reserve(redis, [
      {
        key: accountKey,
        limit: LOGIN_ACCOUNT_LIMIT,
        windowSeconds: LOGIN_WINDOW_SECONDS,
      },
    ]);
    if (attempt.blocked) {
      throw new TooManyAttemptsError(undefined, attempt.retryAfterSeconds);
    }

    const user = await this.prisma.user
      .findUnique({
        where: { email: normalizedEmail },
        select: LOGIN_USER_SELECT,
      })
      .catch(async (error: unknown) => {
        // The database failed, not the password: the attempt does not count.
        await release(redis, [accountKey]);
        throw error;
      });

    if (!user || !user.password) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // The password is right (whatever else is wrong with the account): the run of failures ends.
    await clear(redis, [accountKey]);

    // After the password check, so only someone who knows the password learns the state of the
    // account, and before the 2FA challenge, so a locked account is not asked for a code.
    if (!user.isActive) {
      throw new AccountDeactivatedError();
    }

    if (!user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    if (user.twoFactorEnabled) {
      // A CHALLENGE (CODE-01A): proof of the password step only. The session comes from
      // completeTwoFactorLogin(), with the completion the verify step mints after a right code.
      throw new TwoFactorRequiredError(
        signChallenge({ userId: user.id, email: user.email })
      );
    }

    return user;
  }

  private async completeTwoFactorLogin(completionToken: string) {
    let claims: ReturnType<typeof verifyTwoFactorToken>;
    try {
      claims = verifyTwoFactorToken(completionToken, TWO_FACTOR_VERIFIED);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    // A completion works once. Redis down: the step fails closed (503), no session.
    let first: boolean;
    try {
      first = await consumeOnce(
        this.redis.getClient(),
        twoFactorKeys.used(claims.jti),
        COMPLETION_USED_TTL_SECONDS
      );
    } catch (error) {
      if (error instanceof TwoFactorUnavailableError) {
        throw new ServiceUnavailableException({
          error: 'Verification is temporarily unavailable. Please try again.',
          message: 'Verification is temporarily unavailable. Please try again.',
        });
      }
      throw error;
    }
    if (!first) {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.userId },
      select: TWO_FACTOR_COMPLETION_USER_SELECT,
    });
    if (!user) {
      throw new InvalidCredentialsError('Invalid or expired 2FA token');
    }

    // The account can be locked, or lose its 2FA, between the code and this step.
    if (!user.isActive) {
      throw new AccountDeactivatedError();
    }
    if (!user.emailVerified) {
      throw new EmailNotVerifiedError();
    }
    if (!user.twoFactorEnabled) {
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
      sessionVersion: number;
    },
    context: RefreshTokenContext
  ): Promise<LoginResult> {
    // CODE-02A: the token is stamped with the account's session version and the time of this
    // sign-in; the refresh token keeps the same time so a rotation cannot make the session younger.
    const sessionStartedAt = new Date();
    const accessToken = await encodeNextAuthToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
        sessionVersion: user.sessionVersion,
        authTime: Math.floor(sessionStartedAt.getTime() / 1000),
      },
      getNextAuthSecret()
    );

    const { rawToken } = await this.refreshTokens.issue(
      user.id,
      context,
      sessionStartedAt
    );

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
    const { userId, issued, sessionStartedAt } =
      await this.refreshTokens.rotate(rawRefreshToken, context);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SESSION_USER_SELECT,
    });
    if (!user) {
      throw new InvalidTokenError(
        'User for this refresh token no longer exists'
      );
    }
    if (!user.isActive) {
      // A confirmed deletion already deleted this user's refresh tokens; this covers a token
      // that survived (an admin suspension, a race). Revoke the one rotate() just issued so
      // nothing usable is left behind.
      await this.refreshTokens.revokeByRawToken(issued.rawToken);
      throw new AccountDeactivatedError();
    }

    // CODE-02A: an ADMIN session ends 12 hours after the sign-in it started with, and rotating
    // does not restart it. A session whose start is unknown (a token from before the column)
    // counts as expired for an ADMIN: they sign in once more. Same rule as the guards'.
    if (
      user.role === 'ADMIN' &&
      (!sessionStartedAt ||
        Date.now() - sessionStartedAt.getTime() >
          ADMIN_SESSION_MAX_AGE_SECONDS * 1000)
    ) {
      await this.refreshTokens.revokeByRawToken(issued.rawToken);
      throw new ExpiredTokenError('This session has expired');
    }

    // The CURRENT version of the account, not the one of the token being replaced; `authTime` is
    // the start of the session the refresh token carries (left out when it is unknown).
    const accessToken = await encodeNextAuthToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
        sessionVersion: user.sessionVersion,
        authTime: sessionStartedAt
          ? Math.floor(sessionStartedAt.getTime() / 1000)
          : undefined,
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
    // CODE-01B: three requests an hour per e-mail address. Past that the answer is the one
    // every request gets and nothing is looked up or sent, so the limit tells nothing about the
    // address. The client address is limited in the monolith (D-4). Redis down: open (D-1).
    const throttled = await reserve(this.redis.getClient(), [
      {
        key: throttleKeys.forgotAccount(email),
        limit: MAIL_LIMIT,
        windowSeconds: MAIL_WINDOW_SECONDS,
      },
    ]);

    const user = throttled.blocked
      ? null
      : await this.prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true },
        });

    if (user) {
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
        select: ID_ONLY_SELECT,
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
      select: { id: true, resetTokenExpiry: true },
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
      select: ID_ONLY_SELECT,
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
      select: { id: true, email: true, name: true, updatedAt: true },
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
      select: ID_ONLY_SELECT,
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
   * both preserved exactly. CODE-01B: the success message of an address
   * that did get an e-mail is now that same generic one, and an address
   * past its three requests an hour is answered with it too.
   */
  async resendVerification(
    email: string
  ): Promise<{ success: true; message: string }> {
    const genericSuccess = {
      success: true as const,
      message:
        'If your email is registered, you will receive a verification email.',
    };

    // CODE-01B: three requests an hour per e-mail address, answered like any other request once
    // used up (nothing looked up or sent), so the limit tells nothing about the address. The
    // client address is limited in the monolith (D-4). Redis down: open (D-1).
    const throttled = await reserve(this.redis.getClient(), [
      {
        key: throttleKeys.resendAccount(email),
        limit: MAIL_LIMIT,
        windowSeconds: MAIL_WINDOW_SECONDS,
      },
    ]);
    if (throttled.blocked) {
      return genericSuccess;
    }

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
      select: ID_ONLY_SELECT,
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

    // The same words an unknown or verified address gets (checklist 8B-14): the answer must not
    // tell a registered address from an unknown one.
    return genericSuccess;
  }
}
