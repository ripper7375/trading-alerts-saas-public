'use client';

import React, {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import { useDisplayUsdRates } from '@/lib/fx/use-display-usd-rates';
import {
  SUPPORTED_COUNTRIES,
  getCountryByCode,
  formatCurrencyAmount,
  isSupportedCurrency,
} from '@/lib/country-config';
import type { CountryConfig, DisplayUsdRates } from '@/lib/country-config';
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  NO_COUNTRY_LANGUAGE_CURRENCY,
  currencyForLanguage,
  defaultPreferences,
  isValidTimezone,
  localeCookieString,
  preferenceCookieStrings,
  preferencesForCountryPrefix,
  preferencesForLanguage,
  preferencesFromCountry,
  serverRenderKey,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { isSupportedLanguage, textDirection } from '@/lib/i18n/languages';
import { syncLocaleCookiesAction } from '@/app/actions/locale';

import {
  formatDateInZone,
  formatDateTimeInZone,
  formatTimeInZone,
} from '@/lib/i18n/format-datetime';

import {
  BASE_DICTIONARY,
  loadDictionary,
  peekDictionary,
  type Dictionary,
} from '@/lib/i18n/client-dictionaries';
import { translate } from '@/lib/i18n/translate';

const subscribeNever = (): (() => void) => () => {};

/**
 * True while React renders on the server and while it hydrates that markup,
 * false for every render that starts in the browser (`useSyncExternalStore`
 * uses `getServerSnapshot` for exactly those two cases).
 */
function useIsServerOrHydrating(): boolean {
  return !useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
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
    // Storage is user-controlled and becomes the live language (and the
    // cookie on the next save), so an unknown one is replaced with the
    // country's own.
    if (!isSupportedLanguage(merged.language)) merged.language = base.language;
    // A currency that has since been withdrawn (CNY, AUD, CAD) falls back to
    // the language's own currency.
    if (!isSupportedCurrency(merged.currency)) {
      merged.currency = currencyForLanguage(merged.language);
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
  /** Date and time, e.g. `25/12/2024 14:30`, in the user's timezone. */
  formatDateTime: (utc: number | string | Date) => string;
  /** A USD amount in the viewer's currency, at the live rate when known. */
  formatCurrency: (amountInUSD: number) => string;
  /**
   * The rates behind formatCurrency (null: the fixed fallback rates). Prices
   * in any currency but USD are an approximation of the USD charge.
   */
  usdRates: DisplayUsdRates | null;
  formatRelativeTime: (minutesAgo: number) => string;
  t: (keyOrText: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

interface LocaleProviderProps {
  children: React.ReactNode;
  /** Full preference set resolved on the server in `app/layout.tsx`. */
  initialPreferences?: LocalePreferences;
  /** IANA timezone the edge detected from the visitor's IP, if any. */
  detectedTimezone?: string | null;
  /** @deprecated language-only entry point, kept for backwards compatibility. */
  initialLocale?: string;
  /**
   * Live USD display rates resolved on the server (app/layout.tsx), so the
   * server-rendered and hydrated prices agree. Refreshed every five minutes from
   * GET /api/fx/rates and on returning to the page. Providers remain cached hourly. Absent (e.g. in tests):
   * the fixed rates in lib/country-config.ts, and no refresh.
   */
  initialUsdRates?: DisplayUsdRates | null;
}

/** What the server resolved, from whichever entry point the caller used. */
function resolveServerPreferences({
  initialPreferences,
  initialLocale,
}: Pick<
  LocaleProviderProps,
  'initialPreferences' | 'initialLocale'
>): LocalePreferences {
  if (initialPreferences) return initialPreferences;
  if (initialLocale) {
    const match = Object.values(SUPPORTED_COUNTRIES).find(
      (c) => c.language === initialLocale
    );
    if (match) return preferencesFromCountry(match);
  }
  return defaultPreferences;
}

/**
 * The first render must hold the dictionary the server rendered with, or the
 * page paints in English and flips (or hydrates over mismatched text). English
 * (UK and US) is in the bundle; any other language is its own chunk, which the
 * server awaits here before it streams the page and the browser awaits before
 * it hydrates that page, so the markup and the first client render agree and
 * the chunk is never sent as RSC props. A render that starts in the browser (a
 * test, a client-only mount) never waits: it starts from English and the
 * provider's effect swaps the language in.
 *
 * The waiting is done by `SeedDictionary`, a component with no hooks but the
 * `use()` itself, and not by the provider body: in React's production build a
 * component that suspends on `use()` while it is still mounting (hydrating)
 * and then calls another hook fails with error #467, "Update hook called on
 * initial render". Keep every hook out of this component and out of whatever
 * runs after its `use()`.
 */
export function LocaleProvider(props: LocaleProviderProps) {
  const serverOrHydrating = useIsServerOrHydrating();
  return (
    <SeedDictionary
      language={resolveServerPreferences(props).language}
      wait={serverOrHydrating}
    >
      {(seedDictionary) => (
        <LocaleProviderBody {...props} seedDictionary={seedDictionary} />
      )}
    </SeedDictionary>
  );
}

function SeedDictionary({
  language,
  wait,
  children,
}: {
  language: string;
  wait: boolean;
  children: (dictionary: Dictionary) => React.ReactElement;
}): React.ReactElement {
  const ready = peekDictionary(language);
  // `use()` is the last thing this component does, and conditional by design.
  return children(
    ready ?? (wait ? use(loadDictionary(language)) : BASE_DICTIONARY)
  );
}

function LocaleProviderBody({
  children,
  initialPreferences,
  initialLocale,
  detectedTimezone: serverDetectedTimezone,
  initialUsdRates,
  seedDictionary,
}: LocaleProviderProps & { seedDictionary: Dictionary }) {
  const pathname = usePathname();

  const serverPreferences = useMemo<LocalePreferences>(
    () => resolveServerPreferences({ initialPreferences, initialLocale }),
    [initialPreferences, initialLocale]
  );

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

  const usdRates = useDisplayUsdRates(initialUsdRates);

  const [dictionary, setDictionary] = useState<Dictionary>(seedDictionary);

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

  // Server Components (the admin sidebar, BI dashboards, /academy, ...) are
  // rendered from the locale cookies, and the client router reuses cached
  // layouts, so a language or format change left them in the old language
  // until a reload. When what the server renders from changes, set the
  // cookies through a Server Action: Next.js re-renders the current route in
  // the same round trip and drops its cached routes.
  const serverRendered = useRef(serverRenderKey(serverPreferences));
  useEffect(() => {
    const key = serverRenderKey(preferences);
    if (key === serverRendered.current) return;
    serverRendered.current = key;
    void syncLocaleCookiesAction({
      language: preferences.language,
      currency: preferences.currency,
      dateFormat: preferences.dateFormat,
      timeFormat: preferences.timeFormat,
      timezone: preferences.timezone,
      timezoneSetByUser: !!preferences.timezoneSetByUser,
    }).catch(() => {
      /* the browser-side cookies still apply on the next load */
    });
  }, [preferences]);

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
      document.documentElement.dir = textDirection(preferences.language);
    }
  }, [preferences.language]);

  // Keep the dictionary in lockstep with the language. One that is already
  // loaded applies at once; another loads as its own chunk and the previous
  // dictionary stays on screen until it arrives (a chunk that cannot be
  // fetched leaves English).
  useEffect(() => {
    const language = preferences.language || 'en-GB';
    const ready = peekDictionary(language);
    if (ready) {
      setDictionary(ready);
      return;
    }

    let cancelled = false;
    void loadDictionary(language).then((loaded) => {
      if (!cancelled) setDictionary(loaded);
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
          } else {
            // No country of its own (Chinese, Spanish): keep the country and
            // formats, but stop showing the previous language's currency.
            updated = {
              ...prev,
              currency: NO_COUNTRY_LANGUAGE_CURRENCY,
              ...newPrefs,
            };
          }
        }
        if (!isSupportedCurrency(updated.currency)) {
          updated.currency = currencyForLanguage(updated.language);
        }
        persistPreferences(updated);
        return samePreferences(prev, updated) ? prev : updated;
      });
    },
    []
  );

  // The same lookup rule the server's `getServerTranslator()` uses.
  const t = useCallback(
    (keyOrText: string, fallback?: string): string =>
      translate(dictionary, keyOrText, fallback),
    [dictionary]
  );

  const value = useMemo<LocaleContextType>(() => {
    // All three use the user's timezone, date format and time format.
    const formatTimestamp = (utc: number | string | Date): string =>
      formatTimeInZone(utc, preferences, { seconds: true });

    const formatDate = (utc: number | string | Date): string =>
      formatDateInZone(utc, preferences);

    const formatDateTime = (utc: number | string | Date): string =>
      formatDateTimeInZone(utc, preferences);

    const formatCurrency = (amountInUSD: number): string =>
      formatCurrencyAmount(amountInUSD, {
        currency: preferences.currency || 'GBP',
        language: preferences.language,
        rates: usdRates?.rates,
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
      formatDateTime,
      formatCurrency,
      usdRates,
      formatRelativeTime,
      t,
    };
  }, [
    preferences,
    detectedTimezone,
    t,
    setCountryCode,
    updatePreferences,
    usdRates,
  ]);

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

/**
 * `t()` for shared UI primitives (dialog close button, toasts) that may also
 * render outside a LocaleProvider, e.g. in unit tests: there it returns the
 * fallback instead of throwing.
 */
export function useOptionalTranslation(): (
  key: string,
  fallback?: string
) => string {
  const context = useContext(LocaleContext);
  return context?.t ?? ((key: string, fallback?: string) => fallback ?? key);
}

/**
 * A translated string as an element, for Server Components and `loading`
 * fallbacks that cannot call a hook themselves.
 */
export function Translated({
  k,
  fallback,
}: {
  k: string;
  fallback: string;
}): React.ReactElement {
  const t = useOptionalTranslation();
  return <>{t(k, fallback)}</>;
}

export function T({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  if (typeof children === 'string') {
    return <>{t(children)}</>;
  }
  return <>{children}</>;
}
