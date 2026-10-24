/**
 * Session Tracking Service
 *
 * Tracks user sessions with device/browser/location info for security monitoring.
 * Allows users to view and revoke active sessions.
 *
 * @module lib/auth/session-tracker
 */

import 'server-only';

import { decode } from 'next-auth/jwt';

import {
  DEVICE_SESSION_ROW_TTL_MS,
  forgetDeviceSession,
} from '@/lib/auth/user-active';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Local type for UserSession from Prisma (avoids CI generation issues) */
interface UserSessionRecord {
  id: string;
  userId: string;
  sessionToken: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface ParsedUserAgent {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

export interface SessionTrackingData {
  userId: string;
  sessionToken: string;
  userAgent: string;
  ipAddress: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER AGENT PARSER (Built-in, no external dependency)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse user agent string to extract browser, OS, and device info
 *
 * @param userAgent - User agent string from request headers
 * @returns Parsed user agent information
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('edg/')) {
    browser = 'Edge';
    browserVersion = extractVersion(userAgent, /edg\/(\d+(\.\d+)?)/i);
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
    browserVersion = extractVersion(userAgent, /chrome\/(\d+(\.\d+)?)/i);
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    browserVersion = extractVersion(userAgent, /firefox\/(\d+(\.\d+)?)/i);
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
    browserVersion = extractVersion(userAgent, /version\/(\d+(\.\d+)?)/i);
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
    browserVersion = extractVersion(userAgent, /(?:opera|opr)\/(\d+(\.\d+)?)/i);
  }

  // Detect OS
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
    osVersion = extractVersion(userAgent, /mac os x (\d+[._]\d+)/i).replace(
      '_',
      '.'
    );
  } else if (ua.includes('iphone')) {
    os = 'iOS';
    osVersion = extractVersion(userAgent, /os (\d+[._]\d+)/i).replace('_', '.');
  } else if (ua.includes('ipad')) {
    os = 'iPadOS';
    osVersion = extractVersion(userAgent, /os (\d+[._]\d+)/i).replace('_', '.');
  } else if (ua.includes('android')) {
    os = 'Android';
    osVersion = extractVersion(userAgent, /android (\d+(\.\d+)?)/i);
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  if (ua.includes('mobile') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
  };
}

/**
 * Extract version number from user agent string
 */
function extractVersion(userAgent: string, regex: RegExp): string {
  const match = userAgent.match(regex);
  return match && match[1] ? match[1] : '';
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION TRACKING FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * The `sid` a session cookie carries (CODE-02C), or `null` for a cookie that has none (minted
 * before the sign-in wrote a device row), cannot be decoded, or when there is no secret to decode
 * with. A bad cookie is not an error here: the caller falls back to the cookie value itself.
 */
async function sidOfSessionToken(
  sessionToken: string | undefined
): Promise<string | null> {
  const secret = process.env['NEXTAUTH_SECRET'];
  if (!sessionToken || !secret) return null;
  try {
    const claims = await decode({ token: sessionToken, secret });
    return typeof claims?.sid === 'string' && claims.sid !== ''
      ? claims.sid
      : null;
  } catch {
    return null;
  }
}

/**
 * Track a user session with device/browser info
 *
 * A cookie that carries a `sid` belongs to the row the sign-in wrote: that row is filled in (and
 * only an active row of this user), no second row is made for the cookie. A cookie without one
 * (minted before CODE-02C) gets the old row keyed by the cookie value.
 *
 * @param data - Session tracking data
 * @returns Created/updated session ID
 */
export async function trackSession(data: SessionTrackingData): Promise<string> {
  const { userId, sessionToken, userAgent, ipAddress } = data;

  // Parse user agent
  const parsed = parseUserAgent(userAgent);

  // Calculate expiry (30 days from now)
  const expiresAt = new Date(Date.now() + DEVICE_SESSION_ROW_TTL_MS);

  const sid = await sidOfSessionToken(sessionToken);
  if (sid) {
    await prisma.userSession.updateMany({
      where: { id: sid, userId, isActive: true },
      data: {
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
    });
    return sid;
  }

  // Upsert session
  const session = await prisma.userSession.upsert({
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
    update: {
      lastActiveAt: new Date(),
      ipAddress, // Update IP in case it changed
    },
  });

  return session.id;
}

/**
 * Update session activity timestamp
 *
 * Called on each authenticated request to track session activity.
 *
 * @param sessionToken - Session token to update
 */
export async function updateSessionActivity(
  sessionToken: string
): Promise<void> {
  await prisma.userSession.updateMany({
    where: { sessionToken, isActive: true },
    data: { lastActiveAt: new Date() },
  });
}

/**
 * Get all active sessions for a user
 *
 * @param userId - User ID
 * @param currentSessionToken - Token of current session to mark as "Current"
 * @returns Array of session info
 */
export async function getUserSessions(
  userId: string,
  currentSessionToken?: string
): Promise<SessionInfo[]> {
  const sessions = await prisma.userSession.findMany({
    where: { userId, isActive: true },
    orderBy: { lastActiveAt: 'desc' },
  });

  // The device of the cookie is the row named by its `sid`; a cookie without one is found by value.
  const currentSid = await sidOfSessionToken(currentSessionToken);
  const isCurrent = (session: UserSessionRecord): boolean =>
    (currentSid !== null && session.id === currentSid) ||
    (currentSessionToken !== undefined &&
      session.sessionToken === currentSessionToken);

  return sessions.map((session: UserSessionRecord) => {
    // A row the sign-in wrote has the raw user agent only, until that device lists its own
    // sessions: name it from that, so the list does not show "Unknown device" for every sign-in.
    const parsed = session.userAgent ? parseUserAgent(session.userAgent) : null;
    const browser =
      session.browser ||
      (parsed && parsed.browser !== 'Unknown' ? parsed.browser : null);
    const os =
      session.os || (parsed && parsed.os !== 'Unknown' ? parsed.os : null);

    return {
      id: session.id,
      device: formatDevice(browser, os),
      browser: browser || 'Unknown',
      os: os || 'Unknown',
      location: formatLocation(session.city, session.country),
      lastActive: isCurrent(session)
        ? 'Current session'
        : formatRelativeTime(session.lastActiveAt),
      isCurrent: isCurrent(session),
      createdAt: session.createdAt.toISOString(),
    };
  });
}

/**
 * Revoke a specific session ("log out this device", CODE-02C)
 *
 * The row stays, inactive: the `jwt` callback refuses a token whose `sid` names a revoked row
 * (`lib/auth/user-active.ts`), and this instance forgets its cached answer so that holds at once;
 * other instances follow within their 30 s window. Only the caller's own row is touched, and
 * nothing is deleted for a row that is not theirs.
 *
 * @param sessionId - Session ID to revoke
 * @param userId - User ID (for authorization check)
 * @returns True if session was revoked
 */
export async function revokeSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.userSession.updateMany({
    where: { id: sessionId, userId },
    data: { isActive: false },
  });
  if (result.count === 0) return false;

  forgetDeviceSession(sessionId);

  // Also delete the NextAuth session if linked, and the refresh token the row is bound to: a
  // session minted by operation-service keeps the hash of its refresh token here, and without
  // this the revoked device could still mint a new access token.
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { sessionToken: true },
  });

  if (session?.sessionToken) {
    await prisma.session.deleteMany({
      where: { sessionToken: session.sessionToken },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId, hashedToken: session.sessionToken },
    });
  }

  return true;
}

/**
 * Revoke all sessions except the current one
 *
 * @param userId - User ID
 * @param exceptSessionToken - Session token to keep active
 * @returns Number of sessions revoked
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionToken?: string
): Promise<number> {
  // Every active row of the user except the current one. The current device is the row named by
  // the cookie's `sid`, or (a cookie without one) the row holding the cookie value. A row written
  // at sign-in holds no token at all, and SQL's `<>` is never true for NULL, so the token filter
  // says "no token, or another token" explicitly.
  const exceptSid = await sidOfSessionToken(exceptSessionToken);
  const others = {
    userId,
    isActive: true,
    ...(exceptSessionToken
      ? {
          OR: [
            { sessionToken: null },
            { sessionToken: { not: exceptSessionToken } },
          ],
        }
      : {}),
    ...(exceptSid ? { id: { not: exceptSid } } : {}),
  };

  // Get session tokens to delete from NextAuth
  const sessionsToRevoke = await prisma.userSession.findMany({
    where: others,
    select: { id: true, sessionToken: true },
  });

  // Deactivate user sessions
  const result = await prisma.userSession.updateMany({
    where: others,
    data: { isActive: false },
  });

  // This instance must not keep an "active" answer for a device that was just ended.
  for (const revoked of sessionsToRevoke) forgetDeviceSession(revoked.id);

  // Delete NextAuth sessions
  const tokenList = sessionsToRevoke
    .map((s: { sessionToken: string | null }) => s.sessionToken)
    .filter((t): t is string => t !== null && t !== undefined);

  if (tokenList.length > 0) {
    await prisma.session.deleteMany({
      where: { sessionToken: { in: tokenList } },
    });
  }

  return result.count;
}

/**
 * Clean up expired sessions
 *
 * Should be called by a cron job periodically.
 *
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
    },
  });

  return result.count;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Format device string from browser and OS
 */
function formatDevice(browser?: string | null, os?: string | null): string {
  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  if (os) {
    return os;
  }
  return 'Unknown device';
}

/**
 * Format location string from city and country
 */
function formatLocation(city?: string | null, country?: string | null): string {
  if (city && country) {
    return `${city}, ${country}`;
  }
  if (country) {
    return country;
  }
  return 'Unknown location';
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get device icon name based on device type
 *
 * @param deviceType - Device type (desktop, mobile, tablet)
 * @returns Icon name for lucide-react
 */
export function getDeviceIcon(
  deviceType?: string | null
): 'Monitor' | 'Smartphone' | 'Tablet' {
  switch (deviceType) {
    case 'mobile':
      return 'Smartphone';
    case 'tablet':
      return 'Tablet';
    default:
      return 'Monitor';
  }
}
