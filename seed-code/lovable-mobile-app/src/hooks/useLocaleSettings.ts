import { useEffect, useState } from 'react';

const STORAGE_KEYS = {
  language: 'app-language',
  timezone: 'app-timezone',
  currency: 'app-currency',
};

/** Languages that read right-to-left, matching the monolith's
 *  lib/context/locale-context.tsx dir-switching rule. */
const RTL_LANGUAGES = new Set(['ar']);

export interface LocaleSettings {
  language: string;
  timezone: string;
  currency: string;
}

const DEFAULT_SETTINGS: LocaleSettings = {
  language: 'en',
  timezone: 'America/New_York',
  currency: 'USD',
};

function readSettings(): LocaleSettings {
  return {
    language:
      localStorage.getItem(STORAGE_KEYS.language) || DEFAULT_SETTINGS.language,
    timezone:
      localStorage.getItem(STORAGE_KEYS.timezone) || DEFAULT_SETTINGS.timezone,
    currency:
      localStorage.getItem(STORAGE_KEYS.currency) || DEFAULT_SETTINGS.currency,
  };
}

/**
 * App-wide language/timezone/currency preferences, persisted the same way
 * useAppearanceSettings persists font size -- localStorage plus a same-tab
 * polling fallback, since this app has no real backend to source them from.
 *
 * Also stamps `document.documentElement.dir` for RTL languages (Arabic),
 * mirroring the monolith's lib/context/locale-context.tsx behavior, so the
 * whole app -- not just the Language settings screen -- mirrors on Arabic.
 */
export const useLocaleSettings = () => {
  const [settings, setSettings] = useState<LocaleSettings>(() =>
    typeof window === 'undefined' ? DEFAULT_SETTINGS : readSettings()
  );

  useEffect(() => {
    document.documentElement.dir = RTL_LANGUAGES.has(settings.language)
      ? 'rtl'
      : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    const handleStorageChange = () => setSettings(readSettings());
    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const stored = readSettings();
      setSettings((prev) =>
        prev.language === stored.language &&
        prev.timezone === stored.timezone &&
        prev.currency === stored.currency
          ? prev
          : stored
      );
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const updateSettings = (next: Partial<LocaleSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      if (next.language !== undefined)
        localStorage.setItem(STORAGE_KEYS.language, next.language);
      if (next.timezone !== undefined)
        localStorage.setItem(STORAGE_KEYS.timezone, next.timezone);
      if (next.currency !== undefined)
        localStorage.setItem(STORAGE_KEYS.currency, next.currency);
      return merged;
    });
  };

  return { ...settings, updateSettings };
};
