import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { sendPasswordChangedEmail } from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';
import { formatLocation, getGeoLocation } from '../security/geo-location.util';
import { TwoFactorService } from '../auth/two-factor.service';
import {
  ChangePasswordInput,
  DEFAULT_PREFERENCES,
  mergePreferences,
  UpdatePreferencesInput,
  UpdateProfileInput,
  UserPreferencesShape,
} from './users.schemas';

export interface RequestContext {
  ipAddress?: string;
}

/**
 * Ports `app/api/user/{profile,preferences,password,sessions,sessions/[id],
 * login-history,account/deletion-*}/route.ts` (Session 4B-11). 2FA handlers
 * delegate to the existing `TwoFactorService` (built Session 3-4 for
 * operation-service's own native login flow, reused here verbatim per this
 * order's own resolved "Open question #1" — same `User.twoFactorSecret`/
 * `twoFactorBackupCodes` fields, same crypto scheme).
 *
 * @module users/users.service
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twoFactorService: TwoFactorService
  ) {}

  // F58 (DECISION-LOG.md): JwtAuthGuard-derived userId sometimes fails
  // findUnique({where:{id}}) against the live container for a user created
  // via the auth bridge's own token-register, despite the row provably
  // existing (proven correct in isolation against the same database — see
  // F58's full evidence chain; root cause not conclusively identified).
  // Resolving by email first when available is a reliable fallback (email
  // lookups have never exhibited this symptom in any of this session's
  // testing) — zero behavior change for the success path, since it only
  // fires when the id lookup already came back empty.
  private async resolveUserId(userId: string, email?: string): Promise<string> {
    const byId = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (byId) return userId;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }
    throw new NotFoundException('User not found');
  }

  // ─── Profile ──────────────────────────────────────────────────────────

  async getProfile(userId: string, email?: string) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        tier: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { user: { ...user, emailVerified: !!user.emailVerified } };
  }

  async updateProfile(
    userId: string,
    currentEmail: string,
    dto: UpdateProfileInput
  ) {
    const { name, email, avatarUrl } = dto;

    if (email && email !== currentEmail) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
      // SOURCE (app/api/user/profile/route.ts): updates directly without
      // sending a verification email — "not recommended for production",
      // preserved as-is (PORT dial: behavior preservation, not a fix).
      console.log(
        `[Profile] Email change requested: ${currentEmail} -> ${email}`
      );
    }

    const updateData: { name?: string; email?: string; image?: string | null } =
      {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (avatarUrl !== undefined) updateData.image = avatarUrl;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        tier: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      user: { ...updatedUser, emailVerified: !!updatedUser.emailVerified },
      message: 'Profile updated successfully',
    };
  }

  // ─── Preferences ──────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    try {
      const userPreferences = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });
      const stored =
        (userPreferences?.preferences as Partial<UserPreferencesShape>) || {};
      return { preferences: mergePreferences(DEFAULT_PREFERENCES, stored) };
    } catch (error) {
      // SOURCE returns defaults rather than 500 on any lookup error (e.g.
      // table not provisioned yet) — preserved as-is.
      console.error('[GET preferences] Error:', error);
      return { preferences: DEFAULT_PREFERENCES };
    }
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesInput) {
    const existing = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    const existingData =
      (existing?.preferences as Partial<UserPreferencesShape>) || {};
    const merged = { ...existingData, ...dto };

    const updated = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, preferences: merged },
      update: { preferences: merged },
    });

    const fullPreferences = mergePreferences(
      DEFAULT_PREFERENCES,
      updated.preferences as Partial<UserPreferencesShape>
    );

    return {
      preferences: fullPreferences,
      message: 'Preferences updated successfully',
    };
  }

  // ─── Password ─────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordInput,
    context: RequestContext = {},
    email?: string
  ) {
    const { currentPassword, newPassword } = dto;

    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, password: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.password) {
      throw new BadRequestException(
        'Your account uses social login. Please set a password first in your account settings.'
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password'
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    console.log(`[Password] Password changed for user: ${user.email}`);

    try {
      const prefs = await this.getSecurityPreferences(userId);
      if (prefs.passwordChangeAlerts) {
        const location = formatLocation(
          await getGeoLocation(context.ipAddress ?? '')
        );
        await this.prisma.securityAlert.create({
          data: {
            userId,
            type: 'PASSWORD_CHANGED',
            title: 'Password Changed',
            message: 'Your account password was changed.',
            ipAddress: context.ipAddress,
            location,
            emailSent: true,
            emailSentAt: new Date(),
          },
        });
        await sendPasswordChangedEmail(
          user.email,
          user.name || 'User',
          context.ipAddress ?? 'Unknown',
          location
        );
      }
    } catch (alertError) {
      console.error('[Password] Failed to send security alert:', alertError);
    }

    return { success: true, message: 'Password changed successfully' };
  }

  private async getSecurityPreferences(
    userId: string
  ): Promise<{ newDeviceAlerts: boolean; passwordChangeAlerts: boolean }> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    const defaultPrefs = { newDeviceAlerts: true, passwordChangeAlerts: true };
    if (!prefs) return defaultPrefs;
    const preferences = prefs.preferences as Record<string, unknown>;
    return {
      newDeviceAlerts: preferences['newDeviceAlerts'] !== false,
      passwordChangeAlerts: preferences['passwordChangeAlerts'] !== false,
    };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────

  async trackSession(
    userId: string,
    sessionToken: string,
    userAgent: string,
    ipAddress: string
  ): Promise<void> {
    const parsed = this.parseUserAgent(userAgent);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.upsert({
      where: { sessionToken },
      create: {
        userId,
        sessionToken,
        userAgent,
        ipAddress,
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        osVersion: parsed.osVersion,
        deviceType: parsed.deviceType,
        lastActiveAt: new Date(),
        expiresAt,
      },
      update: { lastActiveAt: new Date(), ipAddress },
    });
  }

  async getSessions(userId: string, currentSessionToken?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, isActive: true },
      orderBy: { lastActiveAt: 'desc' },
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        device: this.formatDevice(session.browser, session.os),
        browser: session.browser || 'Unknown',
        os: session.os || 'Unknown',
        location: this.formatSessionLocation(session.city, session.country),
        lastActive:
          session.sessionToken === currentSessionToken
            ? 'Current session'
            : this.formatRelativeTime(session.lastActiveAt),
        isCurrent: session.sessionToken === currentSessionToken,
        createdAt: session.createdAt.toISOString(),
      })),
    };
  }

  async revokeAllSessions(userId: string, exceptSessionToken?: string) {
    const sessionsToRevoke = await this.prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        sessionToken: exceptSessionToken
          ? { not: exceptSessionToken }
          : undefined,
      },
      select: { sessionToken: true },
    });

    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        isActive: true,
        sessionToken: exceptSessionToken
          ? { not: exceptSessionToken }
          : undefined,
      },
      data: { isActive: false },
    });

    const tokenList = sessionsToRevoke
      .map((s) => s.sessionToken)
      .filter((t): t is string => t !== null && t !== undefined);

    if (tokenList.length > 0) {
      await this.prisma.session.deleteMany({
        where: { sessionToken: { in: tokenList } },
      });
    }

    return {
      success: true,
      message: `Revoked ${result.count} session${result.count === 1 ? '' : 's'}`,
      revokedCount: result.count,
    };
  }

  async revokeSession(sessionId: string, userId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { isActive: false },
    });

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { sessionToken: true },
    });
    if (session?.sessionToken) {
      await this.prisma.session.deleteMany({
        where: { sessionToken: session.sessionToken },
      });
    }

    if (result.count === 0) {
      throw new NotFoundException('Session not found or already revoked');
    }
    return { success: true, message: 'Session revoked successfully' };
  }

  async getLoginHistory(userId: string, limit: number, offset: number) {
    const loginHistory = await this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        provider: true,
        deviceType: true,
        browser: true,
        browserVersion: true,
        os: true,
        osVersion: true,
        ipAddress: true,
        country: true,
        city: true,
        region: true,
        isNewDevice: true,
        createdAt: true,
      },
    });
    const totalCount = await this.prisma.loginHistory.count({
      where: { userId },
    });

    const formattedHistory = loginHistory.map((entry) => {
      const locationParts = [entry.city, entry.region, entry.country].filter(
        (p) => p && p !== 'Unknown'
      );
      const location =
        locationParts.length > 0 ? locationParts.join(', ') : 'Unknown';
      const deviceType = entry.deviceType || 'Unknown';
      const device = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
      const browser = entry.browser
        ? entry.browser +
          (entry.browserVersion ? ` ${entry.browserVersion}` : '')
        : 'Unknown';
      const os = entry.os
        ? entry.os + (entry.osVersion ? ` ${entry.osVersion}` : '')
        : 'Unknown';

      return {
        id: entry.id,
        status: entry.status,
        provider: entry.provider,
        device,
        browser,
        os,
        location,
        ipAddress: entry.ipAddress || 'Unknown',
        isNewDevice: entry.isNewDevice,
        createdAt: entry.createdAt.toISOString(),
      };
    });

    return {
      history: formattedHistory,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  }

  // A1-9/A2-12 (post-6-12 gap-matrix correction): SecurityAlert has had 6
  // writers (this file's own password/2FA flows, lib/security/device-
  // detection.ts) since Session 3-4 with zero UI-reachable reader anywhere
  // until this method. Mirrors getLoginHistory's own pagination shape
  // exactly (limit/offset, same Pagination response shape) for frontend
  // consistency between the two "activity" lists on /settings/security.
  async getSecurityAlerts(userId: string, limit: number, offset: number) {
    const alerts = await this.prisma.securityAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        ipAddress: true,
        deviceInfo: true,
        location: true,
        read: true,
        readAt: true,
        createdAt: true,
      },
    });
    const totalCount = await this.prisma.securityAlert.count({
      where: { userId },
    });

    return {
      alerts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  }

  // Ownership-scoped `updateMany` (matches this file's own revokeSession
  // convention, not notifications.service.ts's distinct-403 convention) —
  // a non-existent id and someone else's alert both resolve to the same
  // NotFoundException, so a caller can't enumerate other users' alert ids.
  // `read: false` in the where-clause additionally guards the invariant
  // that an already-read alert's `readAt` is never rewritten.
  async markSecurityAlertRead(userId: string, id: string) {
    const result = await this.prisma.securityAlert.updateMany({
      where: { id, userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await this.prisma.securityAlert.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('Security alert not found');
      }
      return {
        success: true,
        alreadyRead: true,
        message: 'Security alert was already marked as read',
      };
    }

    return {
      success: true,
      alreadyRead: false,
      message: 'Security alert marked as read',
    };
  }

  private parseUserAgent(userAgent: string): {
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
  } {
    const ua = userAgent.toLowerCase();
    let browser = 'Unknown';
    let browserVersion = '';
    if (ua.includes('edg/')) {
      browser = 'Edge';
      browserVersion = ua.match(/edg\/(\d+(\.\d+)?)/)?.[1] || '';
    } else if (ua.includes('chrome') && !ua.includes('chromium')) {
      browser = 'Chrome';
      browserVersion = ua.match(/chrome\/(\d+(\.\d+)?)/)?.[1] || '';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
      browserVersion = ua.match(/firefox\/(\d+(\.\d+)?)/)?.[1] || '';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
      browserVersion = ua.match(/version\/(\d+(\.\d+)?)/)?.[1] || '';
    } else if (ua.includes('opera') || ua.includes('opr/')) {
      browser = 'Opera';
      browserVersion = ua.match(/(?:opera|opr)\/(\d+(\.\d+)?)/)?.[1] || '';
    }

    let os = 'Unknown';
    let osVersion = '';
    if (ua.includes('windows')) {
      os = 'Windows';
      if (ua.includes('windows nt 10')) osVersion = '10';
      else if (ua.includes('windows nt 11')) osVersion = '11';
      else if (ua.includes('windows nt 6.3')) osVersion = '8.1';
      else if (ua.includes('windows nt 6.2')) osVersion = '8';
      else if (ua.includes('windows nt 6.1')) osVersion = '7';
    } else if (ua.includes('mac os x')) {
      os = 'MacOS';
      osVersion = (ua.match(/mac os x (\d+[._]\d+)/)?.[1] || '').replace(
        '_',
        '.'
      );
    } else if (ua.includes('iphone')) {
      os = 'iOS';
      osVersion = (ua.match(/os (\d+[._]\d+)/)?.[1] || '').replace('_', '.');
    } else if (ua.includes('ipad')) {
      os = 'iPadOS';
      osVersion = (ua.match(/os (\d+[._]\d+)/)?.[1] || '').replace('_', '.');
    } else if (ua.includes('android')) {
      os = 'Android';
      osVersion = ua.match(/android (\d+(\.\d+)?)/)?.[1] || '';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    }

    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (ua.includes('mobile') || ua.includes('iphone')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    }

    return { browser, browserVersion, os, osVersion, deviceType };
  }

  private formatDevice(browser?: string | null, os?: string | null): string {
    if (browser && os) return `${browser} on ${os}`;
    if (browser) return browser;
    if (os) return os;
    return 'Unknown device';
  }

  private formatSessionLocation(
    city?: string | null,
    country?: string | null
  ): string {
    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    return 'Unknown location';
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ─── 2FA (thin delegates to the existing TwoFactorService) ─────────────

  async get2FAStatus(userId: string, email?: string) {
    return this.twoFactorService.getStatus(userId, email);
  }

  async setup2FA(userId: string, email?: string) {
    return this.twoFactorService.setup(userId, email);
  }

  async verifySetup2FA(
    userId: string,
    code: string,
    ipAddress?: string,
    email?: string
  ) {
    return this.twoFactorService.verifySetup(
      userId,
      code,
      { ipAddress },
      email
    );
  }

  /** Unauthenticated by design — see UsersController's own guard note. */
  async verify2FA(code: string, token: string) {
    return this.twoFactorService.verify(code, token);
  }

  async getBackupCodesStatus(userId: string, email?: string) {
    return this.twoFactorService.getBackupCodesStatus(userId, email);
  }

  async regenerateBackupCodes(
    userId: string,
    password: string,
    email?: string
  ) {
    return this.twoFactorService.regenerateBackupCodes(userId, password, email);
  }

  async disable2FA(
    userId: string,
    password: string,
    code: string,
    ipAddress?: string,
    email?: string
  ) {
    return this.twoFactorService.disable(
      userId,
      password,
      code,
      { ipAddress },
      email
    );
  }

  // ─── Account Deletion (F21 stays OPEN; ports the existing 7-day flow) ──

  async requestDeletion(userId: string) {
    const existingRequest = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingRequest) {
      throw new BadRequestException({
        error: 'Deletion already requested',
        message: 'You already have a pending deletion request.',
        requestId: existingRequest.id,
        expiresAt: existingRequest.expiresAt,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const deletionRequest = await this.prisma.accountDeletionRequest.create({
      data: { userId, token, status: 'PENDING', expiresAt },
    });

    const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/account/confirm-deletion?token=${token}`;
    const cancelUrl = `${baseUrl}/account/cancel-deletion?token=${token}`;
    console.log('[AccountDeletion] Request created:', {
      userId,
      requestId: deletionRequest.id,
      confirmationUrl,
      cancelUrl,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    // TODO (preserved from SOURCE): send confirmation email.
    console.log(`[AccountDeletion] Email would be sent to: ${user?.email}`);

    return {
      success: true,
      message: 'Deletion request created. Check your email for confirmation.',
      requestId: deletionRequest.id,
      expiresAt,
    };
  }

  /** Unauthenticated by design — token-only, matches SOURCE exactly. */
  async confirmDeletion(token: string) {
    const deletionRequest = await this.prisma.accountDeletionRequest.findUnique(
      { where: { token } }
    );
    if (!deletionRequest) {
      throw new NotFoundException('Invalid or expired token');
    }
    if (deletionRequest.status !== 'PENDING') {
      throw new BadRequestException({
        error: 'Request already processed',
        message: `This deletion request has been ${deletionRequest.status.toLowerCase()}.`,
      });
    }
    if (new Date() > deletionRequest.expiresAt) {
      await this.prisma.accountDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException({
        error: 'Token expired',
        message:
          'The deletion request has expired. Please submit a new request.',
      });
    }

    const confirmedRequest = await this.prisma.accountDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: deletionRequest.userId },
      select: { email: true, name: true },
    });

    // SOURCE computes and returns this 24h figure but never persists or
    // enforces it (no `scheduledDeletionAt` field, no queued job) — the
    // literal "TODO: Queue deletion job for 24 hours later" from SOURCE is
    // preserved as-is, not implemented here (F21 stays OPEN).
    const scheduledDeletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[AccountDeletion] Deletion confirmed:', {
      userId: deletionRequest.userId,
      userEmail: user?.email,
      requestId: confirmedRequest.id,
      scheduledDeletionTime,
    });
    // TODO (preserved from SOURCE): queue deletion job; send confirmation email.

    return {
      success: true,
      message:
        'Account deletion confirmed. Your account will be deleted in 24 hours.',
      scheduledDeletionTime,
    };
  }

  /**
   * Unauthenticated at the route level — accepts EITHER a token (email-link
   * flow, `userId` undefined) OR a resolved session `userId` (logged-in
   * flow, `token` undefined). Matches SOURCE's own dual-mode branch exactly.
   */
  async cancelDeletion(token: string | undefined, userId: string | undefined) {
    let deletionRequest;

    if (token) {
      deletionRequest = await this.prisma.accountDeletionRequest.findUnique({
        where: { token },
      });
      if (!deletionRequest) {
        throw new NotFoundException('Invalid or expired token');
      }
    } else {
      if (!userId) {
        throw new UnauthorizedException(
          'Unauthorized - provide token or be logged in'
        );
      }
      deletionRequest = await this.prisma.accountDeletionRequest.findFirst({
        where: { userId, status: { in: ['PENDING', 'CONFIRMED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (!deletionRequest) {
        throw new NotFoundException('No active deletion request found');
      }
    }

    if (!['PENDING', 'CONFIRMED'].includes(deletionRequest.status)) {
      throw new BadRequestException({
        error: 'Cannot cancel this request',
        message: `This deletion request has been ${deletionRequest.status.toLowerCase()} and cannot be cancelled.`,
      });
    }

    const cancelledRequest = await this.prisma.accountDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: deletionRequest.userId },
      select: { email: true, name: true },
    });
    console.log('[AccountDeletion] Deletion cancelled:', {
      userId: deletionRequest.userId,
      userEmail: user?.email,
      requestId: cancelledRequest.id,
    });
    // TODO (preserved from SOURCE): send cancellation confirmation email.

    return {
      success: true,
      message: 'Account deletion cancelled. Your account will not be deleted.',
    };
  }
}
