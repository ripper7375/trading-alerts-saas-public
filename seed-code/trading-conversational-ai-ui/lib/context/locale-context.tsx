'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  SUPPORTED_COUNTRIES,
  DEFAULT_COUNTRY,
  getCountryByCode,
  CountryConfig,
} from '@/lib/country-config';

import thDict from '@/lib/i18n/dictionaries/th.json';
import enGBDict from '@/lib/i18n/dictionaries/en-GB.json';

const staticDictionaries: Record<string, Record<string, string>> = {
  th: thDict,
  'en-GB': enGBDict,
  'en-US': enGBDict,
};

export interface LocalePreferences {
  countryCode: string;
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
}

export const defaultPreferences: LocalePreferences = {
  countryCode: DEFAULT_COUNTRY.code,
  language: DEFAULT_COUNTRY.language,
  timezone: DEFAULT_COUNTRY.timezone,
  dateFormat: DEFAULT_COUNTRY.dateFormat,
  timeFormat: DEFAULT_COUNTRY.timeFormat,
  currency: DEFAULT_COUNTRY.currency,
};

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

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<LocalePreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('davin_locale_preferences');
        const cookieMatch = document.cookie.match(/davintrade-locale=([^;]+)/);
        if (saved) {
          return { ...defaultPreferences, ...JSON.parse(saved) };
        } else if (cookieMatch && cookieMatch[1]) {
          const lang = cookieMatch[1];
          const country = Object.values(SUPPORTED_COUNTRIES).find(
            (c) => c.language === lang
          );
          if (country) {
            return {
              ...defaultPreferences,
              countryCode: country.code,
              language: country.language,
            };
          }
        }
      } catch {}
    }
    return defaultPreferences;
  });

  const [dictionary, setDictionary] = useState<Record<string, string>>(() => {
    const lang = preferences.language || 'en-GB';
    return staticDictionaries[lang] || staticDictionaries['en-GB'] || {};
  });

  // 1. Detect Country from URL Prefix (e.g. /th/settings, /gb/alerts, /vn/pricing)
  useEffect(() => {
    if (!pathname) return;
    const parts = pathname.split('/').filter(Boolean);
    const firstSegment = parts[0]?.toLowerCase();

    if (firstSegment && SUPPORTED_COUNTRIES[firstSegment]) {
      const matched = SUPPORTED_COUNTRIES[firstSegment];
      setPreferences((prev) => ({
        ...prev,
        countryCode: matched.code,
        language: matched.language,
        timezone: matched.timezone,
        dateFormat: matched.dateFormat,
        timeFormat: matched.timeFormat,
        currency: matched.currency,
      }));
      return;
    }

    // 2. Fallback: Check localStorage for manual override
    try {
      const saved = localStorage.getItem('davin_locale_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferences((prev) => ({ ...prev, ...parsed }));
        return;
      }
    } catch {}

    // 3. Automatic IP-Based GeoIP Country & Language Auto-Detection
    const detectCountryFromIP = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          const detectedCode = data.country_code?.toLowerCase();
          if (detectedCode && SUPPORTED_COUNTRIES[detectedCode]) {
            const detected = SUPPORTED_COUNTRIES[detectedCode];
            setPreferences((prev) => ({
              ...prev,
              countryCode: detected.code,
              language: detected.language,
              timezone: detected.timezone,
              dateFormat: detected.dateFormat,
              timeFormat: detected.timeFormat,
              currency: detected.currency,
            }));
          }
        }
      } catch {
        // Fallback safely to UK English default
      }
    };

    detectCountryFromIP();
  }, [pathname]);

  // Dynamically load language dictionary on-demand (using static cache when available)
  useEffect(() => {
    const loadDictionary = async () => {
      const lang = preferences.language || 'en-GB';
      if (staticDictionaries[lang]) {
        setDictionary(staticDictionaries[lang]);
        return;
      }
      try {
        const dict = await import(`@/lib/i18n/dictionaries/${lang}.json`);
        setDictionary(dict.default || {});
      } catch {
        setDictionary(staticDictionaries['en-GB'] || {});
      }
    };

    loadDictionary();
  }, [preferences.language]);

  const setCountryCode = (code: string) => {
    const config = getCountryByCode(code);
    const updated: LocalePreferences = {
      countryCode: config.code,
      language: config.language,
      timezone: config.timezone,
      dateFormat: config.dateFormat,
      timeFormat: config.timeFormat,
      currency: config.currency,
    };

    setPreferences(updated);
    try {
      localStorage.setItem('davin_locale_preferences', JSON.stringify(updated));
      document.cookie = `davintrade-locale=${updated.language}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };

  const updatePreferences = (newPrefs: Partial<LocalePreferences>) => {
    setPreferences((prev) => {
      let updated = { ...prev, ...newPrefs };

      // The header's Country & Region dropdown and this Settings > Language
      // page must stay in sync (single source of truth) — when the language
      // itself changes here and exactly one supported country uses that
      // language, adopt that country's region defaults too so the header
      // badge, currency, and timezone don't silently fall out of step.
      // Ambiguous languages shared by multiple countries (e.g. en-US) or
      // languages with no matching country (e.g. es, pt) are left alone —
      // there is no single correct country to infer.
      if (newPrefs.language && newPrefs.language !== prev.language) {
        const matches = Object.values(SUPPORTED_COUNTRIES).filter(
          (c) => c.language === newPrefs.language
        );
        if (matches.length === 1) {
          const match = matches[0];
          updated = {
            ...updated,
            countryCode: match.code,
            timezone: match.timezone,
            dateFormat: match.dateFormat,
            timeFormat: match.timeFormat,
            currency: match.currency,
          };
        }
      }

      try {
        localStorage.setItem(
          'davin_locale_preferences',
          JSON.stringify(updated)
        );
        document.cookie = `davintrade-locale=${updated.language}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      return updated;
    });
  };

  const formatTimestamp = (utc: number | string | Date): string => {
    try {
      const date = new Date(utc);
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: preferences.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: preferences.timeFormat === '12h',
      }).format(date);
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
      return `${preferences.currency} ${amountInUSD.toFixed(2)}`;
    }
  };

  const t = (keyOrText: string, fallback?: string): string => {
    if (!keyOrText) return '';
    // Direct key lookup
    if (dictionary[keyOrText]) return dictionary[keyOrText];
    // Exact text string lookup
    if (dictionary[keyOrText.trim()]) return dictionary[keyOrText.trim()];
    // Case-insensitive / normalized lookup
    const normalizedKey = keyOrText.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (dictionary[normalizedKey]) return dictionary[normalizedKey];

    return fallback || keyOrText;
  };

  const formatRelativeTime = (minutesAgo: number): string => {
    if (minutesAgo < 1) return t('time.just_now', 'เมื่อสักครู่');
    if (minutesAgo < 60)
      return `${minutesAgo} ${t('time.mins_ago', 'นาทีที่แล้ว')}`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours} ${t('time.hours_ago', 'ชั่วโมงที่แล้ว')}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t('time.days_ago', 'วันที่แล้ว')}`;
  };

  const currentCountryConfig = getCountryByCode(preferences.countryCode);

  return (
    <LocaleContext.Provider
      value={{
        ...preferences,
        countryConfig: currentCountryConfig,
        setCountryCode,
        setLocalePreferences: updatePreferences,
        formatTimestamp,
        formatDate,
        formatCurrency,
        formatRelativeTime,
        t,
      }}
    >
      {children}
    </LocaleContext.Provider>
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
