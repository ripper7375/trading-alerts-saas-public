/**
 * Device Detection & Security Utilities
 *
 * Parses user agent strings to extract device, browser, and OS information.
 * Also handles geolocation from IP addresses and device fingerprinting.
 */

import { headers } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import {
  sendNewDeviceLoginEmail,
  type NewDeviceLoginDetails,
} from '@/lib/email/email';
import crypto from 'crypto';

export interface DeviceInfo {
  userAgent: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
}

export interface GeoLocation {
  country: string;
  city: string;
  region: string;
}

export interface LoginContext {
  device: DeviceInfo;
  location: GeoLocation;
  ipAddress: string;
  deviceFingerprint: string;
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType: DeviceInfo['deviceType'] = 'desktop';
  if (/mobile|android(?!.*tablet)|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|android.*tab|kindle|silk/i.test(ua)) {
    deviceType = 'tablet';
  }

  // Detect browser
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/edg\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
    browserVersion = ua.match(/chrome\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    browserVersion = ua.match(/firefox\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/version\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
    browserVersion = ua.match(/(?:opera|opr)\/(\d+(\.\d+)?)/)?.[1] || '';
  }

  // Detect OS
  let os = 'Unknown';
  let osVersion = '';

  if (ua.includes('windows nt')) {
    os = 'Windows';
    const ntVersion = ua.match(/windows nt (\d+\.\d+)/)?.[1];
    if (ntVersion === '10.0') osVersion = '10/11';
    else if (ntVersion === '6.3') osVersion = '8.1';
    else if (ntVersion === '6.2') osVersion = '8';
    else if (ntVersion === '6.1') osVersion = '7';
    else osVersion = ntVersion || '';
  } else if (ua.includes('mac os x')) {
    os = 'macOS';
    osVersion = ua.match(/mac os x (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('android')) {
    os = 'Android';
    osVersion = ua.match(/android (\d+(\.\d+)?)/)?.[1] || '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = ua.includes('ipad') ? 'iPadOS' : 'iOS';
    osVersion = ua.match(/os (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  return {
    userAgent,
    deviceType,
    browser,
    browserVersion,
    os,
    osVersion,
  };
}

/**
 * Get client IP address from request headers
 */
export async function getClientIP(): Promise<string> {
  const headersList = await headers();

  // Check various headers for the real IP
  const xForwardedFor = headersList.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for may contain multiple IPs; the first one is the client
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = headersList.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  const cfConnectingIP = headersList.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'Unknown';
}

/**
 * Get geolocation from IP address
 * Uses ip-api.com free service (no API key required for non-commercial use)
 */
export async function getGeoLocation(ipAddress: string): Promise<GeoLocation> {
  const defaultLocation: GeoLocation = {
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
  };

  // Skip for localhost/private IPs
  if (
    ipAddress === 'Unknown' ||
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.')
  ) {
    return defaultLocation;
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      return defaultLocation;
    }

    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
      };
    }

    return defaultLocation;
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
    return defaultLocation;
  }
}

/**
 * Generate a device fingerprint based on user agent, IP, and other factors
 * This is a simple fingerprint; for more accuracy, use a client-side library
 */
export function generateDeviceFingerprint(
  userAgent: string,
  _ipAddress: string
): string {
  const device = parseUserAgent(userAgent);
  // Create a fingerprint from device + browser + OS combination
  // Note: This is a simplified fingerprint. For production, consider using
  // client-side fingerprinting libraries like FingerprintJS
  // IP is not included in fingerprint to allow same device from different networks
  const fingerprintBase = `${device.browser}|${device.os}|${device.deviceType}|${userAgent.substring(0, 100)}`;
  return crypto.createHash('sha256').update(fingerprintBase).digest('hex').substring(0, 32);
}

/**
 * Get full login context from the current request
 */
export async function getLoginContext(): Promise<LoginContext> {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'Unknown';
  const ipAddress = await getClientIP();
  const device = parseUserAgent(userAgent);
  const location = await getGeoLocation(ipAddress);
  const deviceFingerprint = generateDeviceFingerprint(userAgent, ipAddress);

  return {
    device,
    location,
    ipAddress,
    deviceFingerprint,
  };
}

/**
 * Check if this is a new device for the user
 */
export async function isNewDevice(
  userId: string,
  deviceFingerprint: string
): Promise<boolean> {
  // Check if this fingerprint has been seen before
  const existingLogin = await prisma.loginHistory.findFirst({
    where: {
      userId,
      deviceFingerprint,
      status: 'SUCCESS',
    },
  });

  return !existingLogin;
}

/**
 * Get user's security notification preferences
 */
export async function getSecurityPreferences(
  userId: string
): Promise<{ newDeviceAlerts: boolean; passwordChangeAlerts: boolean }> {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  // Default preferences: all security alerts enabled
  const defaultPrefs = {
    newDeviceAlerts: true,
    passwordChangeAlerts: true,
  };

  if (!prefs) {
    return defaultPrefs;
  }

  const preferences = prefs.preferences as Record<string, unknown>;
  return {
    newDeviceAlerts: preferences.newDeviceAlerts !== false, // Default true
    passwordChangeAlerts: preferences.passwordChangeAlerts !== false, // Default true
  };
}

/**
 * Record a login attempt in the history
 */
export async function recordLoginAttempt(
  userId: string,
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED',
  provider: string,
  context: LoginContext,
  failureReason?: string
): Promise<{ isNewDevice: boolean }> {
  const newDevice = status === 'SUCCESS' ? await isNewDevice(userId, context.deviceFingerprint) : false;

  await prisma.loginHistory.create({
    data: {
      userId,
      status,
      provider,
      userAgent: context.device.userAgent,
      deviceType: context.device.deviceType,
      browser: context.device.browser,
      browserVersion: context.device.browserVersion,
      os: context.device.os,
      osVersion: context.device.osVersion,
      ipAddress: context.ipAddress,
      country: context.location.country,
      city: context.location.city,
      region: context.location.region,
      deviceFingerprint: context.deviceFingerprint,
      isNewDevice: newDevice,
      failureReason,
    },
  });

  // Update user's lastLoginIP
  if (status === 'SUCCESS') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginIP: context.ipAddress,
        deviceFingerprint: context.deviceFingerprint,
      },
    });
  }

  return { isNewDevice: newDevice };
}

/**
 * Send new device login alert if enabled
 */
export async function sendNewDeviceAlert(
  userId: string,
  context: LoginContext
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) return;

  const prefs = await getSecurityPreferences(userId);
  if (!prefs.newDeviceAlerts) return;

  const details: NewDeviceLoginDetails = {
    device: context.device.deviceType.charAt(0).toUpperCase() + context.device.deviceType.slice(1),
    browser: context.device.browser + (context.device.browserVersion ? ` ${context.device.browserVersion}` : ''),
    os: context.device.os + (context.device.osVersion ? ` ${context.device.osVersion}` : ''),
    location: `${context.location.city}, ${context.location.region}, ${context.location.country}`,
    ipAddress: context.ipAddress,
    timestamp: new Date(),
  };

  // Create security alert record
  await prisma.securityAlert.create({
    data: {
      userId,
      type: 'NEW_DEVICE_LOGIN',
      title: 'New Device Login Detected',
      message: `Login from ${details.device} in ${details.location}`,
      ipAddress: context.ipAddress,
      deviceInfo: `${details.browser} on ${details.os}`,
      location: details.location,
      emailSent: true,
      emailSentAt: new Date(),
    },
  });

  // Send email
  await sendNewDeviceLoginEmail(user.email, user.name || 'User', details);
}

/**
 * Format location string from context
 */
export function formatLocation(location: GeoLocation): string {
  const parts = [location.city, location.region, location.country].filter(
    (p) => p && p !== 'Unknown'
  );
  return parts.length > 0 ? parts.join(', ') : 'Unknown location';
}
