import enGBDict from '@/lib/i18n/dictionaries/en-GB.json';

/**
 * Server-safe mirror of `lib/context/locale-context.tsx`'s dictionary map.
 * In single-language mode, this always returns the GB English dictionary.
 */
export function getDictionary(_language?: string): Record<string, string> {
  return enGBDict;
}
