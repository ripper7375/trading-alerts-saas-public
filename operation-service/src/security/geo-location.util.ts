// Minimal port from lib/security/device-detection.ts (Session 3-4) — only
// the two functions the 2FA enable/disable security-alert emails actually
// need (getTwoFactorEnabledEmail/getTwoFactorDisabledEmail take just
// ipAddress + a formatted location string, not device/browser/OS). The
// rest of device-detection.ts (parseUserAgent, device fingerprinting,
// new-device-login alerts, login-history recording) belongs to the login
// flow's new-device-alert feature, which this order does not touch —
// porting it here would be scope creep beyond "2FA, email verification,
// password reset" (CLAUDE.md non-negotiable #4). ipAddress itself comes
// from Express's req.ip (main.ts's `trust proxy` setting), not from
// re-parsing x-forwarded-for by hand — same choice auth.controller.ts's
// requestContext() already made.

export interface GeoLocation {
  country: string;
  city: string;
  region: string;
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
    !ipAddress ||
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
      `http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city`
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
 * Format location string from context
 */
export function formatLocation(location: GeoLocation): string {
  const parts = [location.city, location.region, location.country].filter(
    (p) => p && p !== 'Unknown'
  );
  return parts.length > 0 ? parts.join(', ') : 'Unknown location';
}
