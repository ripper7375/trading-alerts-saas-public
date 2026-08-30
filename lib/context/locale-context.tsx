'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { SUPPORTED_COUNTRIES, getCountryByCode } from '@/lib/country-config';
import type { CountryConfig } from '@/lib/country-config';
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  defaultPreferences,
  localeCookieString,
  preferencesForCountryPrefix,
  preferencesFromCountry,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';

import thDict from '@/lib/i18n/dictionaries/th.json';
import enGBDict from '@/lib/i18n/dictionaries/en-GB.json';
import enUSDict from '@/lib/i18n/dictionaries/en-US.json';

/**
 * Dictionaries bundled synchronously so the very first render — server AND
 * client — already has the real translations. An async `import()` inside an
 * effect would leave the first paint in English no matter how correct the
 * resolved language was.
 */
const staticDictionaries: Record<string, Record<string, string>> = {
  th: thDict,
  'en-GB': enGBDict,
  'en-US': enUSDict,
};

function dictionaryFor(language: string): Record<string, string> {
  return staticDictionaries[language] || staticDictionaries['en-GB'] || {};
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

function readLocaleCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
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
  /** Full preference set resolved on the server in `app/layout.tsx`. */
  initialPreferences?: LocalePreferences;
  /** @deprecated language-only entry point, kept for backwards compatibility. */
  initialLocale?: string;
}) {
  const pathname = usePathname();

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

  /**
   * Seeded from the server's resolution ONLY — deliberately not from
   * localStorage. Reading storage here made the client's first render disagree
   * with the streamed HTML, so React hydrated over mismatched text and every
   * label visibly flipped to the stored language. Storage is reconciled after
   * hydration instead (see the effect below), which in the normal case is a
   * no-op because the cookie and storage are written together.
   */
  const [preferences, setPreferences] =
    useState<LocalePreferences>(serverPreferences);

  const [dictionary, setDictionary] = useState<Record<string, string>>(() =>
    dictionaryFor(serverPreferences.language)
  );

  const geoLookupAttempted = useRef(false);

  const applyPreferences = useCallback(
    (next: LocalePreferences, options?: { persist?: boolean }) => {
      setPreferences((prev) => (samePreferences(prev, next) ? prev : next));
      if (options?.persist) persistPreferences(next);
    },
    []
  );

  // `<html lang>` is stamped by the server and by the inline script in
  // `app/layout.tsx`, neither of which sees a later language change. Without
  // this, switching language in Settings (or the storage reconciliation below)
  // left the document advertising the previous language to screen readers and
  // to the browser's hyphenation/font fallback.
  useEffect(() => {
    if (preferences.language) {
      document.documentElement.lang = preferences.language;
      document.documentElement.dir = ['ar', 'ur'].includes(preferences.language)
        ? 'rtl'
        : 'ltr';
    }
  }, [preferences.language]);

  // Keep the dictionary in lockstep with the language. Static dictionaries are
  // applied synchronously; anything else falls back to English while it loads.
  useEffect(() => {
    const language = preferences.language || 'en-GB';
    if (staticDictionaries[language]) {
      setDictionary(staticDictionaries[language]);
      return;
    }

    let cancelled = false;
    import(`@/lib/i18n/dictionaries/${language}.json`)
      .then((mod) => {
        if (!cancelled) setDictionary(mod.default || {});
      })
      .catch(() => {
        if (!cancelled) setDictionary(dictionaryFor('en-GB'));
      });

    return () => {
      cancelled = true;
    };
  }, [preferences.language]);

  useEffect(() => {
    if (!pathname) return;
    const firstSegment = pathname.split('/').filter(Boolean)[0]?.toLowerCase();

    // 1. Country prefix in the URL wins. On a full page load the server already
    //    resolved this (via the middleware header) so `applyPreferences` bails
    //    out as a no-op; this branch matters for client-side navigation between
    //    prefixes, where the root layout does not re-run.
    const fromUrl = preferencesForCountryPrefix(firstSegment);
    if (fromUrl) {
      applyPreferences(fromUrl, { persist: true });
      return;
    }

    // 2. An explicit stored choice. Normally identical to what the server used,
    //    so this is a no-op; it only bites when the cookie was cleared while
    //    localStorage survived, and the inline script in `app/layout.tsx` has
    //    already rewritten the cookie so the next load renders correctly.
    const stored = readStoredPreferences();
    if (stored) {
      applyPreferences(stored);
      return;
    }

    // 3. A cookie without storage is still an explicit choice the server
    //    honoured — never let geo detection override it.
    if (readLocaleCookie()) return;

    // 4. First-ever visit with no preference at all: detect once, then persist
    //    so every subsequent request is server-rendered in that language.
    if (geoLookupAttempted.current) return;
    geoLookupAttempted.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const detected = preferencesForCountryPrefix(data.country_code);
        if (detected && !cancelled) {
          applyPreferences(detected, { persist: true });
        }
      } catch {
        // Fallback safely to UK English default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, applyPreferences]);

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
              ...preferencesFromCountry(matches[0]!),
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
      const direct = dictionary[keyOrText];
      if (direct) return direct;
      const trimmed = dictionary[keyOrText.trim()];
      if (trimmed) return trimmed;
      const normalizedKey = keyOrText.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const normalized = dictionary[normalizedKey];
      if (normalized) return normalized;

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
        return new Intl.NumberFormat(preferences.language || 'en-GB', {
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
