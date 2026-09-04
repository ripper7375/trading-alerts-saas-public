/**
 * User Preferences Defaults and Types
 *
 * Provides default values and type definitions for user preferences
 * used throughout the settings system.
 */

// Theme options
export type Theme = 'light' | 'dark' | 'system';

// Color scheme options
export type ColorScheme = 'blue' | 'purple' | 'green' | 'orange';

// Date format options
export type DateFormat = 'MDY' | 'DMY' | 'YMD';

// Time format options
export type TimeFormat = '12h' | '24h';

// Profile visibility options
export type ProfileVisibility = 'public' | 'private' | 'connections';

/**
 * The 12 country prefixes supported by the locale system
 * (seed-code's `lib/country-config.ts` is the source of truth for the
 * full per-country bundle — this list exists here only so the stored
 * `countryCode` preference can be validated server-side).
 */
export const SUPPORTED_COUNTRY_CODES = [
  'GB',
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
  'US',
  'EU',
  'JP',
  'AE',
  'FR',
  'KR',
] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

/**
 * User Preferences Interface
 */
export interface UserPreferences {
  // Appearance
  theme: Theme;
  colorScheme: ColorScheme;

  // Language & Region
  countryCode: string;
  language: string;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  currency: string;

  // Privacy
  profileVisibility: ProfileVisibility;
  showStats: boolean;
  showEmail: boolean;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;

  // Security Alerts
  newDeviceAlerts: boolean;
  passwordChangeAlerts: boolean;

  // Chart Preferences
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number;
}

/**
 * Default User Preferences
 *
 * These values are used when a user hasn't set their preferences
 * or when creating a new user account.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  // Appearance
  theme: 'system',
  colorScheme: 'blue',

  // Language & Region
  countryCode: 'GB',
  language: 'en-GB',
  timezone: 'Europe/London',
  dateFormat: 'DMY',
  timeFormat: '24h',
  currency: 'GBP',

  // Privacy
  profileVisibility: 'private',
  showStats: false,
  showEmail: false,

  // Notifications
  emailNotifications: true,
  pushNotifications: true,

  // Security Alerts (enabled by default)
  newDeviceAlerts: true,
  passwordChangeAlerts: true,

  // Chart Preferences
  chartUpColor: '#22c55e',
  chartDownColor: '#ef4444',
  gridOpacity: 50,
};

/**
 * Merge custom preferences with defaults
 *
 * @param defaults - The default preferences
 * @param custom - Custom preferences to merge
 * @returns Merged preferences with defaults as fallback
 */
export function mergePreferences(
  defaults: UserPreferences,
  custom: Partial<UserPreferences>
): UserPreferences {
  return { ...defaults, ...custom };
}

/**
 * Validate a preference value against allowed options
 *
 * @param key - The preference key
 * @param value - The value to validate
 * @returns Whether the value is valid for the given key
 */
export function isValidPreference(
  key: keyof UserPreferences,
  value: unknown
): boolean {
  switch (key) {
    case 'theme':
      return ['light', 'dark', 'system'].includes(value as string);
    case 'colorScheme':
      return ['blue', 'purple', 'green', 'orange'].includes(value as string);
    case 'dateFormat':
      return ['MDY', 'DMY', 'YMD'].includes(value as string);
    case 'timeFormat':
      return ['12h', '24h'].includes(value as string);
    case 'profileVisibility':
      return ['public', 'private', 'connections'].includes(value as string);
    case 'showStats':
    case 'showEmail':
    case 'emailNotifications':
    case 'pushNotifications':
    case 'newDeviceAlerts':
    case 'passwordChangeAlerts':
      return typeof value === 'boolean';
    case 'countryCode':
      return (
        typeof value === 'string' &&
        (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(value)
      );
    case 'language':
    case 'timezone':
    case 'currency':
    case 'chartUpColor':
    case 'chartDownColor':
      return typeof value === 'string' && value.length > 0;
    case 'gridOpacity':
      return typeof value === 'number' && value >= 0 && value <= 100;
    default:
      return false;
  }
}

/**
 * Sanitize preferences object by removing invalid values
 *
 * @param preferences - Preferences object to sanitize
 * @returns Sanitized preferences with only valid values
 */
export function sanitizePreferences(
  preferences: Partial<UserPreferences>
): Partial<UserPreferences> {
  const sanitized: Partial<UserPreferences> = {};

  for (const [key, value] of Object.entries(preferences)) {
    if (isValidPreference(key as keyof UserPreferences, value)) {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}
