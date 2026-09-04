'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useTransition,
} from 'react';

import { saveAppearanceAction } from '@/app/actions/appearance';
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
  ThemeMode,
} from '@/lib/appearance/types';

const THEME_STORAGE_KEY = 'davintrade-theme';

interface AppearanceContextValue {
  settings: AppearanceSettings;
  updateSettings: (newSettings: Partial<AppearanceSettings>) => void;
  saveSettings: () => Promise<boolean>;
  isSaving: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(
  undefined
);

/**
 * Applies appearance tokens directly to the document element for
 * instantaneous (no re-render) reactive feedback — chart colors and the
 * accent scheme update at 60 FPS as the user drags a color/slider control.
 */
function applyAppearanceToDOM(settings: AppearanceSettings): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--chart-candle-up', settings.chartUpColor);
  root.style.setProperty('--chart-candle-down', settings.chartDownColor);
  root.style.setProperty(
    '--chart-grid-opacity',
    (settings.gridOpacity / 100).toString()
  );
  root.setAttribute('data-accent', settings.accent);
}

function resolveThemeClass(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

/**
 * Applies the resolved theme class directly to <html>, deliberately NOT
 * routed through next-themes' own setTheme()/class-application effect.
 * next-themes keeps a `window` 'storage' listener for cross-tab sync that
 * unconditionally trusts ANY external write to its storageKey and
 * re-applies it immediately -- with multiple tabs of the app open (a
 * trading terminal is routinely used that way: dashboard, alerts, settings
 * each in their own tab) or any other agent writing to the same
 * localStorage key, that listener can silently override this DB-backed,
 * per-user theme choice moments after it's set, producing a rapid
 * light/dark flip-flop that settles on the wrong value. AppearanceProvider
 * IS the actual source of truth (server-resolved fresh on every full page
 * load, persisted to the DB via saveAppearanceAction), so it owns the DOM
 * class directly instead of delegating to next-themes for it.
 */
function applyThemeToDOM(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveThemeClass(theme);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) -- DOM class above is already correct.
  }
}

export function AppearanceProvider({
  children,
  initialSettings = DEFAULT_APPEARANCE_SETTINGS,
}: {
  children: React.ReactNode;
  initialSettings?: AppearanceSettings;
}): React.ReactElement {
  const [settings, setSettings] = useState<AppearanceSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  // Apply CSS variables/data-accent whenever settings change.
  useEffect(() => {
    applyAppearanceToDOM(settings);
  }, [settings]);

  // Own the .dark/.light class directly (see applyThemeToDOM's own comment
  // for why this bypasses next-themes) -- useLayoutEffect so there's no
  // flash between commit and paint when the user picks a new Theme Mode.
  // Deliberately depends on settings.theme alone: this must re-run only
  // when OUR value actually changes, never as a reaction to next-themes'
  // own internal churn.
  useLayoutEffect(() => {
    applyThemeToDOM(settings.theme);
  }, [settings.theme]);

  // Re-assert our theme if something external changes the storage key
  // afterward (another tab, a stray cross-context write) -- our value
  // always wins, since the DB is the actual source of truth, not
  // localStorage. Registered after next-themes' own <ThemeProvider> (a
  // parent, so it mounts and registers its listener first), so on a
  // genuine external write next-themes may apply the wrong class for one
  // event-handling pass before this listener corrects it back in the same
  // synchronous dispatch -- self-heals immediately rather than settling
  // wrong.
  useEffect(() => {
    function handleStorage(e: StorageEvent): void {
      if (e.key === THEME_STORAGE_KEY && e.newValue !== settings.theme) {
        applyThemeToDOM(settings.theme);
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [settings.theme]);

  // Keep the DOM in sync with OS-level scheme changes while in 'system' mode.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => applyThemeToDOM('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  const updateSettings = (newSettings: Partial<AppearanceSettings>): void => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      applyAppearanceToDOM(updated);
      return updated;
    });
  };

  const saveSettings = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await saveAppearanceAction(settings);
        resolve(res.success);
      });
    });
  };

  return (
    <AppearanceContext.Provider
      value={{
        settings,
        updateSettings,
        saveSettings,
        isSaving: isPending,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

/** Main hook to consume and modify appearance preferences. */
export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}

/**
 * High-performance hook for charting components (TradingView/Canvas/SVG) to
 * read appearance tokens without subscribing to the full settings object.
 */
export function useChartAppearance(): {
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number;
  gridOpacityDecimal: number;
} {
  const { settings } = useAppearance();
  return {
    chartUpColor: settings.chartUpColor,
    chartDownColor: settings.chartDownColor,
    gridOpacity: settings.gridOpacity,
    gridOpacityDecimal: settings.gridOpacity / 100,
  };
}
