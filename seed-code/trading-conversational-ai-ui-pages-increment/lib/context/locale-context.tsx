'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SUPPORTED_COUNTRIES, getCountryByCode } from '@/lib/country-config';
import type { CountryConfig } from '@/lib/country-config';
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  defaultPreferences,
  localeCookieString,
  preferencesFromCountry,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';

import enGBDict from '@/lib/i18n/dictionaries/en-GB.json';

const staticDictionaries: Record<string, Record<string, string>> = {
  'en-GB': enGBDict,
};

function dictionaryFor(_language: string): Record<string, string> {
  return enGBDict;
}

export type { LocalePreferences };
export { defaultPreferences };

function samePreferences(a: LocalePreferences, b: LocalePreferences): boolean {
  return (
    a.countryCode === b.countryCode &&
    a.language === b.language &&
    a.timezone === b.timezone &&
    a.dateFormat === b.dateFormat &&
    a.timeFormat === b.timeFormat &&
    a.currency === b.currency
  );
}

function readStoredPreferences(): LocalePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<LocalePreferences>;
    if (!parsed || !parsed.language) return null;
    const base = parsed.countryCode
      ? preferencesFromCountry(getCountryByCode(parsed.countryCode))
      : defaultPreferences;
    return { ...base, ...parsed } as LocalePreferences;
  } catch {
    return null;
  }
}

function persistPreferences(preferences: LocalePreferences): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
    document.cookie = localeCookieString(preferences.language);
  } catch {
    /* storage error fallback */
  }
}

interface LocaleContextType extends LocalePreferences {
  countryConfig: CountryConfig;
  setCountryCode: (code: string) => void;
  setLocalePreferences: (prefs: Partial<LocalePreferences>) => void;
  formatTimestamp: (utc: number | string | Date) => string;
  formatDate: (utc: number | string | Date) => string;
  formatCurrency: (amountInUSD: number) => string;
  formatRelativeTime: (minutesAgo: number) => string;
  t: (keyOrText: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({
  children,
  initialPreferences,
  initialLocale,
}: {
  children: React.ReactNode;
  initialPreferences?: LocalePreferences;
  initialLocale?: string;
}) {
  const serverPreferences = useMemo<LocalePreferences>(() => {
    if (initialPreferences) return initialPreferences;
    if (initialLocale) {
      const match = Object.values(SUPPORTED_COUNTRIES).find(
        (c) => c.language === initialLocale
      );
      if (match) return preferencesFromCountry(match);
    }
    return defaultPreferences;
  }, [initialPreferences, initialLocale]);

  const [preferences, setPreferences] =
    useState<LocalePreferences>(serverPreferences);

  const [dictionary] = useState<Record<string, string>>(() => enGBDict);

  const applyPreferences = useCallback(
    (next: LocalePreferences, options?: { persist?: boolean }) => {
      setPreferences((prev) => (samePreferences(prev, next) ? prev : next));
      if (options?.persist) persistPreferences(next);
    },
    []
  );

  useEffect(() => {
    document.documentElement.lang = 'en-GB';
  }, []);

  useEffect(() => {
    const stored = readStoredPreferences();
    if (stored) {
      applyPreferences(stored);
    }
  }, [applyPreferences]);

  const setCountryCode = useCallback(
    (code: string) => {
      applyPreferences(preferencesFromCountry(getCountryByCode(code)), {
        persist: true,
      });
    },
    [applyPreferences]
  );

  const updatePreferences = useCallback(
    (newPrefs: Partial<LocalePreferences>) => {
      setPreferences((prev) => {
        let updated: LocalePreferences = { ...prev, ...newPrefs };
        if (newPrefs.language && newPrefs.language !== prev.language) {
          const matches = Object.values(SUPPORTED_COUNTRIES).filter(
            (c) => c.language === newPrefs.language
          );
          if (matches.length === 1) {
            updated = {
              ...updated,
              ...preferencesFromCountry(matches[0]),
              ...newPrefs,
            };
          }
        }
        persistPreferences(updated);
        return samePreferences(prev, updated) ? prev : updated;
      });
    },
    []
  );

  const t = useCallback(
    (keyOrText: string, fallback?: string): string => {
      if (!keyOrText) return '';
      if (dictionary[keyOrText]) return dictionary[keyOrText];
      if (dictionary[keyOrText.trim()]) return dictionary[keyOrText.trim()];
      const normalizedKey = keyOrText.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (dictionary[normalizedKey]) return dictionary[normalizedKey];

      return fallback || keyOrText;
    },
    [dictionary]
  );

  const value = useMemo<LocaleContextType>(() => {
    const formatTimestamp = (utc: number | string | Date): string => {
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: preferences.timezone || 'Europe/London',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: preferences.timeFormat === '12h',
        }).format(new Date(utc));
      } catch {
        return '--:--:--';
      }
    };

    const formatDate = (utc: number | string | Date): string => {
      try {
        const date = new Date(utc);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        if (preferences.dateFormat === 'DMY') return `${day}/${month}/${year}`;
        if (preferences.dateFormat === 'YMD') return `${year}-${month}-${day}`;
        return `${month}/${day}/${year}`;
      } catch {
        return '--/--/----';
      }
    };

    const formatCurrency = (amountInUSD: number): string => {
      try {
        const config = getCountryByCode(preferences.countryCode);
        const convertedAmount = amountInUSD * (config.exchangeRate || 1.0);
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: preferences.currency || 'GBP',
          maximumFractionDigits: convertedAmount >= 1000 ? 0 : 2,
        }).format(convertedAmount);
      } catch {
        return `${preferences.currency || 'GBP'} ${amountInUSD.toFixed(2)}`;
      }
    };

    const formatRelativeTime = (minutesAgo: number): string => {
      if (minutesAgo < 1) return t('time.just_now', 'just now');
      if (minutesAgo < 60)
        return `${minutesAgo} ${t('time.mins_ago', 'mins ago')}`;
      const hours = Math.floor(minutesAgo / 60);
      if (hours < 24) return `${hours} ${t('time.hours_ago', 'hours ago')}`;
      const days = Math.floor(hours / 24);
      return `${days} ${t('time.days_ago', 'days ago')}`;
    };

    return {
      ...preferences,
      countryConfig: getCountryByCode(preferences.countryCode),
      setCountryCode,
      setLocalePreferences: updatePreferences,
      formatTimestamp,
      formatDate,
      formatCurrency,
      formatRelativeTime,
      t,
    };
  }, [preferences, t, setCountryCode, updatePreferences]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

export function T({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  if (typeof children === 'string') {
    return <>{t(children)}</>;
  }
  return <>{children}</>;
}
