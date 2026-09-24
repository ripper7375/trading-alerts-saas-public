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
import {
  SUPPORTED_COUNTRIES,
  getCountryByCode,
  formatCurrencyAmount,
  isSupportedCurrency,
} from '@/lib/country-config';
import type { CountryConfig } from '@/lib/country-config';
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  defaultPreferences,
  isValidTimezone,
  localeCookieString,
  preferenceCookieStrings,
  preferencesForCountryPrefix,
  preferencesForLanguage,
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
    a.currency === b.currency &&
    !!a.timezoneSetByUser === !!b.timezoneSetByUser
  );
}

/**
 * Apply a country's or language's defaults without touching the timezone:
 * that is IP-detected (or the user's own pick), never implied by a country.
 */
function keepTimezone(
  next: LocalePreferences,
  prev: LocalePreferences
): LocalePreferences {
  return {
    ...next,
    timezone: prev.timezone,
    timezoneSetByUser: !!prev.timezoneSetByUser,
  };
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
    const merged = { ...base, ...parsed } as LocalePreferences;
    // A currency that has since been withdrawn (CNY, AUD, CAD) falls back to
    // the language's own currency.
    if (!isSupportedCurrency(merged.currency)) {
      merged.currency =
        preferencesForLanguage(merged.language)?.currency ?? base.currency;
    }
    // Stored before the flag existed: a timezone other than the country's
    // default can only have been picked by the user.
    if (parsed.timezoneSetByUser === undefined) {
      merged.timezoneSetByUser =
        !!parsed.timezone && parsed.timezone !== base.timezone;
    }
    if (!isValidTimezone(merged.timezone)) {
      merged.timezone = base.timezone;
      merged.timezoneSetByUser = false;
    }
    return merged;
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
    for (const cookie of preferenceCookieStrings(preferences)) {
      document.cookie = cookie;
    }
  } catch {
    /* storage error fallback */
  }
}

interface LocaleContextType extends LocalePreferences {
  countryConfig: CountryConfig;
  /** The visitor's timezone as detected from their IP (or, without an edge
   *  header, from the browser); null until known. */
  detectedTimezone: string | null;
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
  detectedTimezone: serverDetectedTimezone,
}: {
  children: React.ReactNode;
  /** Full preference set resolved on the server in `app/layout.tsx`. */
  initialPreferences?: LocalePreferences;
  /** IANA timezone the edge detected from the visitor's IP, if any. */
  detectedTimezone?: string | null;
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

  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(
    isValidTimezone(serverDetectedTimezone) ? serverDetectedTimezone : null
  );

  const applyPreferences = useCallback(
    (
      next:
        | LocalePreferences
        | ((prev: LocalePreferences) => LocalePreferences),
      options?: { persist?: boolean }
    ) => {
      setPreferences((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (options?.persist) persistPreferences(resolved);
        return samePreferences(prev, resolved) ? prev : resolved;
      });
    },
    []
  );

  // Without an edge header (local dev, or a host that sends none) fall back
  // to the browser's own zone. Runs after hydration so SSR and the first
  // client render agree.
  useEffect(() => {
    if (detectedTimezone) return;
    try {
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (isValidTimezone(browserZone)) setDetectedTimezone(browserZone);
    } catch {
      /* keep the country default */
    }
  }, [detectedTimezone]);

  // Until the user picks a timezone, it follows the detected one.
  useEffect(() => {
    if (!detectedTimezone || preferences.timezoneSetByUser) return;
    if (preferences.timezone === detectedTimezone) return;
    applyPreferences((prev) =>
      prev.timezoneSetByUser ? prev : { ...prev, timezone: detectedTimezone }
    );
  }, [
    detectedTimezone,
    preferences.timezone,
    preferences.timezoneSetByUser,
    applyPreferences,
  ]);

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
      applyPreferences((prev) => keepTimezone(fromUrl, prev), {
        persist: true,
      });
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
        if (cancelled) return;
        if (isValidTimezone(data.timezone)) {
          setDetectedTimezone((current) => current ?? data.timezone);
        }
        const detected = preferencesForCountryPrefix(data.country_code);
        if (detected) {
          applyPreferences((prev) => keepTimezone(detected, prev), {
            persist: true,
          });
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
      // The header's country sets language, date/time format and currency;
      // the timezone stays IP-detected (or the user's own pick).
      applyPreferences(
        (prev) =>
          keepTimezone(preferencesFromCountry(getCountryByCode(code)), prev),
        { persist: true }
      );
    },
    [applyPreferences]
  );

  const updatePreferences = useCallback(
    (newPrefs: Partial<LocalePreferences>) => {
      setPreferences((prev) => {
        let updated: LocalePreferences = { ...prev, ...newPrefs };
        // A new language brings its country's date/time format and currency
        // (Thai: TH, DD/MM/YYYY, 24-hour, THB). Anything passed explicitly
        // overrides them, and the timezone is left alone.
        if (newPrefs.language && newPrefs.language !== prev.language) {
          const implied = preferencesForLanguage(newPrefs.language);
          if (implied) {
            updated = { ...keepTimezone(implied, prev), ...newPrefs };
          }
        }
        if (!isSupportedCurrency(updated.currency)) {
          updated.currency =
            preferencesForLanguage(updated.language)?.currency ??
            getCountryByCode(updated.countryCode).currency;
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

    const formatCurrency = (amountInUSD: number): string =>
      formatCurrencyAmount(amountInUSD, {
        currency: preferences.currency || 'GBP',
        language: preferences.language,
      });

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
      detectedTimezone,
      setCountryCode,
      setLocalePreferences: updatePreferences,
      formatTimestamp,
      formatDate,
      formatCurrency,
      formatRelativeTime,
      t,
    };
  }, [preferences, detectedTimezone, t, setCountryCode, updatePreferences]);

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
