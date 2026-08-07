'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  SUPPORTED_COUNTRIES,
  DEFAULT_COUNTRY,
  getCountryByCode,
  CountryConfig,
} from '@/lib/country-config';

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
  formatCurrency: (amount: number) => string;
  t: (keyOrText: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [preferences, setPreferences] =
    useState<LocalePreferences>(defaultPreferences);
  const [dictionary, setDictionary] = useState<Record<string, string>>({});

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

  // Dynamically load language dictionary on-demand
  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const lang = preferences.language || 'en-GB';
        const dict = await import(`@/lib/i18n/dictionaries/${lang}.json`);
        setDictionary(dict.default || {});
      } catch {
        try {
          const fallbackDict = await import(
            `@/lib/i18n/dictionaries/en-GB.json`
          );
          setDictionary(fallbackDict.default || {});
        } catch {
          setDictionary({});
        }
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
    } catch {}
  };

  const updatePreferences = (newPrefs: Partial<LocalePreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(
          'davin_locale_preferences',
          JSON.stringify(updated)
        );
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

  const formatCurrency = (amount: number): string => {
    try {
      return new Intl.NumberFormat(preferences.language || 'en-GB', {
        style: 'currency',
        currency: preferences.currency || 'GBP',
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${preferences.currency} ${amount.toFixed(2)}`;
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
