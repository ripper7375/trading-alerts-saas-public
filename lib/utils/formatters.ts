/**
 * Formatting Utilities
 *
 * Functions for formatting dates, numbers, currencies, and other values.
 */

/**
 * Format number as currency
 *
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date to readable string
 *
 * @param date - Date to format (Date object or string)
 * @param format - Date format style ('short' | 'medium' | 'long' | 'full')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' | 'full' = 'medium',
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: format,
  }).format(dateObj);
}

/**
 * Format date with time
 *
 * @param date - Date to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: Date | string,
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param date - Date to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Relative time string
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, 'second');
  }
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  }
  if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  }
  if (diffDays < 7) {
    return rtf.format(-diffDays, 'day');
  }
  if (diffWeeks < 4) {
    return rtf.format(-diffWeeks, 'week');
  }
  if (diffMonths < 12) {
    return rtf.format(-diffMonths, 'month');
  }
  return rtf.format(-diffYears, 'year');
}

/**
 * Format number in compact notation (e.g., 1000 → 1K)
 *
 * @param num - Number to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Compact number string
 */
export function formatCompactNumber(
  num: number,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num);
}

/**
 * Format number with thousands separator
 *
 * @param num - Number to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted number string
 */
export function formatNumber(num: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format number as percentage
 *
 * @param num - Number to format (0.1 = 10%)
 * @param decimals - Number of decimal places (default: 2)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted percentage string
 */
export function formatPercent(
  num: number,
  decimals: number = 2,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format price for trading (with appropriate decimal places)
 *
 * @param price - Price to format
 * @param symbol - Trading symbol (to determine decimal places)
 * @returns Formatted price string
 */
export function formatPrice(price: number, symbol?: string): string {
  // Different symbols have different precision requirements
  const cryptoSymbols = ['BTCUSD', 'ETHUSD'];
  const forexSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'];

  let decimals = 2;

  if (symbol) {
    if (cryptoSymbols.includes(symbol)) {
      decimals = price >= 1000 ? 2 : 4;
    } else if (forexSymbols.includes(symbol)) {
      decimals = symbol.includes('JPY') ? 3 : 5;
    }
  }

  return price.toFixed(decimals);
}

/**
 * Format bytes to human readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format phone number (US format)
 *
 * @param phone - Phone number string (digits only)
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * Pluralize a word based on count
 *
 * @param count - Number to check
 * @param singular - Singular form
 * @param plural - Plural form (default: singular + 's')
 * @returns Appropriate form of the word
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const pluralForm = plural || `${singular}s`;
  return count === 1 ? singular : pluralForm;
}

/**
 * Format a count with its label
 *
 * @param count - Number to display
 * @param singular - Singular label
 * @param plural - Plural label (default: singular + 's')
 * @returns Formatted count string (e.g., "5 alerts")
 */
export function formatCount(
  count: number,
  singular: string,
  plural?: string
): string {
  return `${formatNumber(count)} ${pluralize(count, singular, plural)}`;
}
