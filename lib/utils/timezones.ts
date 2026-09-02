/**
 * All Round Clock Timezone Utilities
 *
 * Comprehensive list of global timezones sorted chronologically by GMT
 * offset from -12:00 to +14:00, formatted as `(GMT ±HH:MM) TimeZone`.
 */

export interface TimezoneOption {
  value: string;
  label: string;
  offsetMinutes: number;
  gmtPrefix: string;
  name: string;
}

interface IntlWithSupportedValuesOf {
  supportedValuesOf?: (key: string) => string[];
}

/**
 * Calculates current UTC offset in minutes for a given IANA timezone.
 */
export function getTimezoneOffsetMinutes(
  timeZone: string,
  date: Date = new Date()
): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / (60 * 1000));
  } catch {
    return 0;
  }
}

/**
 * Formats offset minutes into standard `(GMT ±HH:MM)` string.
 */
export function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');
  return `(GMT ${sign}${hours}:${minutes})`;
}

/**
 * Curated fallback list spanning every standard offset from GMT -12:00 to
 * GMT +14:00, used when `Intl.supportedValuesOf` is unavailable (older
 * runtimes, some SSR/test environments).
 */
const CURATED_TIMEZONES: string[] = [
  'Etc/GMT+12',
  'Pacific/Midway',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Tijuana',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/Mexico_City',
  'America/New_York',
  'America/Bogota',
  'America/Lima',
  'America/Halifax',
  'America/Caracas',
  'America/Santiago',
  'America/St_Johns',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Montevideo',
  'America/Noronha',
  'Atlantic/Cape_Verde',
  'Atlantic/Azores',
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Africa/Casablanca',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Monrovia',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Africa/Lagos',
  'Africa/Algiers',
  'Europe/Athens',
  'Europe/Helsinki',
  'Europe/Bucharest',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Jerusalem',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Africa/Nairobi',
  'Asia/Baghdad',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Baku',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Kabul',
  'Asia/Karachi',
  'Asia/Tashkent',
  'Asia/Kolkata',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Almaty',
  'Asia/Yangon',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Manila',
  'Australia/Perth',
  'Asia/Ulaanbaatar',
  'Australia/Eucla',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Pacific/Guam',
  'Australia/Lord_Howe',
  'Pacific/Noumea',
  'Pacific/Guadalcanal',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Chatham',
  'Pacific/Tongatapu',
  'Pacific/Apia',
  'Pacific/Kiritimati',
];

function resolveRawTimezones(): string[] {
  const intlWithSupport = Intl as unknown as IntlWithSupportedValuesOf;
  if (typeof intlWithSupport.supportedValuesOf === 'function') {
    try {
      return intlWithSupport.supportedValuesOf('timeZone');
    } catch {
      return CURATED_TIMEZONES;
    }
  }
  return CURATED_TIMEZONES;
}

/**
 * Builds the complete list of timezones sorted chronologically by GMT
 * offset, then alphabetically by IANA identifier.
 */
export function getAllTimezones(): TimezoneOption[] {
  const rawTimezones = resolveRawTimezones();
  if (!rawTimezones.includes('UTC')) {
    rawTimezones.unshift('UTC');
  }

  const now = new Date();
  const seen = new Set<string>();
  const timezoneOptions: TimezoneOption[] = [];

  for (const tz of rawTimezones) {
    if (seen.has(tz)) continue;
    seen.add(tz);

    const offsetMinutes = getTimezoneOffsetMinutes(tz, now);
    const gmtPrefix = formatGmtOffset(offsetMinutes);

    timezoneOptions.push({
      value: tz,
      label: `${gmtPrefix} ${tz}`,
      offsetMinutes,
      gmtPrefix,
      name: tz,
    });
  }

  return timezoneOptions.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) {
      return a.offsetMinutes - b.offsetMinutes;
    }
    return a.value.localeCompare(b.value);
  });
}

/**
 * Formatted `(GMT ±HH:MM) TimeZone` label for a single timezone value.
 */
export function getTimezoneLabel(timeZone: string): string {
  if (!timeZone) return '(GMT +00:00) UTC';
  const offset = getTimezoneOffsetMinutes(timeZone);
  return `${formatGmtOffset(offset)} ${timeZone}`;
}
